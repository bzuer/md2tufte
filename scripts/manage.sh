#!/usr/bin/env bash
# Single entry point for building, serving and publishing the site. It takes no
# settings of its own: every value comes from config.ini, read through
# scripts/config.js, or is read off the machine.
#
# It follows the conventions of the other services on this server (~/app,
# ~/api): Nginx owns the site's port on loopback, the installed config is
# compared with the rendered one, a config Nginx rejects is rolled back, and
# `status` reports without writing anything. Root is asked for only when
# something outside the checkout has to change.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUN_USER="$(ls -ld "$ROOT_DIR" | awk '{print $3}')"
RUN_HOME="$(getent passwd "$RUN_USER" 2>/dev/null | cut -d: -f6 || true)"
RUN_HOME="${RUN_HOME:-$HOME}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()  { err "$*"; exit 1; }
step() { echo -e "\n${CYAN}${BOLD}── $* ──${NC}"; }

require() {
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null || die "Missing command: $cmd"
  done
}

# In a terminal sudo may prompt; unattended it must already be granted, and the
# operator is told what needed it rather than left with a half-applied step.
as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null && { sudo -n true 2>/dev/null || [ -t 0 ]; }; then
    sudo "$@"
  else
    die "root required for: $* — rerun in a terminal, or with sudo"
  fi
}

# The build writes dist/ and node_modules/. Run as root it would leave both owned
# by root, and the next ordinary deploy could not replace them.
as_owner() {
  if [ "$(id -u)" -eq 0 ] && [ "$RUN_USER" != root ]; then
    runuser -u "$RUN_USER" -- env HOME="$RUN_HOME" PATH="$PATH" "$@"
  else
    "$@"
  fi
}

# ─── Node and dependencies ───────────────────────────────────────────────────

# The Node the build needs is the one Astro declares in its engines field, which
# the lockfile records, so nothing here restates it.
node_satisfies() {
  "$1" -e '
    const range = require("./package-lock.json").packages["node_modules/astro"]?.engines?.node ?? "";
    const want = (range.match(/>=\s*v?([\d.]+)/)?.[1] ?? "0").split(".").map(Number);
    const have = process.versions.node.split(".").map(Number);
    const gap = [0, 1, 2].map((i) => (have[i] ?? 0) - (want[i] ?? 0)).find((d) => d !== 0) ?? 0;
    process.exit(gap < 0 ? 1 : 0);
  ' 2>/dev/null
}

# sudo and cron drop the PATH an nvm install lives on, so the owner's nvm
# versions are searched, newest first, when the Node on PATH is missing or old.
ensure_node() {
  local bin
  if command -v node >/dev/null && node_satisfies node; then
    return 0
  fi
  for bin in $(ls -1d "${NVM_DIR:-$RUN_HOME/.nvm}"/versions/node/*/bin 2>/dev/null | sort -rV); do
    if node_satisfies "$bin/node"; then
      export PATH="$bin:$PATH"
      return 0
    fi
  done
  die "No Node on PATH or in nvm meets Astro's engines requirement (package-lock.json; found: $(node -v 2>/dev/null || echo none)) — run: nvm install --lts"
}

load_config() {
  local settings
  settings="$(node scripts/config.js)" || exit 1
  eval "$settings"
}

# node_modules is rebuilt from the lockfile whenever it is missing or older than
# it, so a fresh checkout or a pulled dependency change needs no step of its own.
ensure_deps() {
  if [ -x node_modules/.bin/astro ] && ! [ package-lock.json -nt node_modules/.package-lock.json ]; then
    return 0
  fi
  step "Dependencies"
  require npm
  as_owner npm ci --no-fund --no-audit
}

build_site() {
  ensure_deps
  step "Build"
  as_owner npm run build
}

# ─── Nginx ───────────────────────────────────────────────────────────────────

nginx_user() {
  local user
  user="$(awk '$1 == "user" { sub(";", "", $2); print $2; exit }' /etc/nginx/nginx.conf 2>/dev/null || true)"
  printf '%s' "${user:-www-data}"
}

render_nginx_conf() {
  node scripts/nginx.js
}

nginx_conf_is_current() {
  [ -r "$NGINX_CONF" ] && [ "$(render_nginx_conf)" = "$(cat "$NGINX_CONF")" ]
}

# Every file Nginx loads from conf.d/ and sites-enabled/, and every file those
# include. A config can keep its server blocks in a tree of its own, pulled in
# by one include line, and a scan of conf.d/ alone would miss their listens.
# Nginx configs are world-readable, so reading them needs no root.
nginx_files() {
  local -a queue=(/etc/nginx/conf.d/*.conf /etc/nginx/sites-enabled/*)
  local -A seen=()
  local i=0 file include
  while [ "$i" -lt "${#queue[@]}" ]; do
    file="${queue[$i]}"
    i=$((i + 1))
    [ -f "$file" ] && [ -z "${seen[$file]:-}" ] || continue
    seen[$file]=1
    printf '%s\n' "$file"
    for include in $(awk '$1 == "include" { sub(/;$/, "", $2); print $2 }' "$file"); do
      [[ "$include" == /* ]] || include="/etc/nginx/${include}"
      # Unquoted, so an include's glob expands to the files it names.
      queue+=($include)
    done
  done
}

# The gateway in front of this site, if there is one: a server block in another
# config that answers for the site's host on a loopback port of its own. The
# tunnel dials it and it forwards to this site's port, so its address is read
# off the configs rather than written down a second time.
gateway_address() {
  nginx_files | grep -vFx "$NGINX_CONF" | xargs -r -d '\n' awk -v host="$SITE_HOST" -v port="$PORT" '
    FNR == 1 { depth = 0; block = -1 }
    {
      sub(/#.*/, "")
      if (block < 0 && /^[[:space:]]*server[[:space:]]*\{/) { block = depth; listens = ""; named = 0 }
      if (block >= 0 && $1 == "listen") { address = $2; sub(/;$/, "", address); listens = listens " " address }
      if (block >= 0 && $1 == "server_name") {
        for (i = 2; i <= NF; i++) { name = $i; sub(/;$/, "", name); if (name == host) named = 1 }
      }
      depth += gsub(/\{/, "{") - gsub(/\}/, "}")
      if (block >= 0 && depth <= block) {
        n = split(listens, bound, " ")
        for (i = 1; i <= n; i++) {
          if (bound[i] ~ /^[0-9]+$/) bound[i] = "127.0.0.1:" bound[i]
          if (named && bound[i] ~ /^127\./ && bound[i] !~ (":" port "$")) print bound[i]
        }
        block = -1
      }
    }' | LC_ALL=C sort -u | awk 'NR == 1'
}

port_addresses() {
  ss -lntH "sport = :$PORT" 2>/dev/null | awk '{print $4}' | LC_ALL=C sort -u | tr '\n' ' ' | sed 's/ $//'
}

port_exposed() {
  ss -lntH "sport = :$PORT" 2>/dev/null | awk '{print $4}' | grep -vE '^(127\.|\[::1\]|\[::ffff:127\.)' || true
}

# What the rendered config asks Nginx to listen on, so the sockets can be held
# to it without the address being written down a second time.
intended_addresses() {
  render_nginx_conf | awk '$1 == "listen" { sub(";", "", $2); print $2 }' | LC_ALL=C sort -u | tr '\n' ' ' | sed 's/ $//'
}

wait_for_listeners() {
  local waited=0
  while [ "$(port_addresses)" != "$1" ]; do
    [ "$waited" -ge 5 ] && return 1
    sleep 1
    waited=$((waited + 1))
  done
}

reload_nginx() {
  as_root systemctl reload nginx || as_root systemctl restart nginx
}

# The directories the rendered config writes its logs into.
log_dirs() {
  render_nginx_conf | awk '$1 == "access_log" || $1 == "error_log" { sub(";", "", $2); print $2 }' |
    xargs -r -n1 dirname | LC_ALL=C sort -u
}

# root:adm, mode 0755, is how the nginx package creates /var/log/nginx.
recreate_log_dir() {
  printf 'sudo install -d -m 0755 -o root -g adm %s' "$1"
}

# Nginx creates a log file but never its directory. Without it nginx -t and any
# restart fail for every site, while the running Nginx serves on as before.
require_log_dirs() {
  local dir
  for dir in $(log_dirs); do
    [ -d "$dir" ] || die "${dir} is missing, so Nginx cannot open this site's logs — run: $(recreate_log_dir "$dir")"
  done
}

# The one failure a host can cause on its own: a listen on an address it no
# longer has. The usual case is ::1 after IPv6 was turned off at runtime, which
# VPN clients do while connected; sockets bound before survive, so the running
# Nginx looks healthy while nginx -t and any restart fail for every site.
explain_nginx_failure() {
  local address files why
  address="$(sed -n 's/.*bind() to \([^ ]*\) failed (99:.*/\1/p' <<<"$1" | head -1)"
  [ -n "$address" ] || return 0
  files="$(nginx_files | xargs -r -d '\n' grep -lF "listen ${address}" 2>/dev/null | tr '\n' ' ' | sed 's/ $//' || true)"
  why="${address} is not an address this host has"
  if [[ "$address" == \[* ]] && [ "$(cat /proc/sys/net/ipv6/conf/lo/disable_ipv6 2>/dev/null)" = 1 ]; then
    why="${why}: IPv6 is turned off (net.ipv6.conf.lo.disable_ipv6 = 1)"
  fi
  err "${why}. Remove that listen from ${files:-the config that declares it}, or bring the address back."
}

install_nginx_conf() {
  require nginx ss
  [ -f "$DIST/index.html" ] || die "No build in ${DIST} — run: scripts/manage.sh build"
  require_log_dirs

  # Asked once, in the open: sudo's own messages must not land in a captured or
  # discarded stream further down.
  as_root true

  # Two default_server blocks on one address stop Nginx from loading at all,
  # which would take down every site on this server, not just this one.
  local taken
  taken="$(nginx_files | grep -vFx "$NGINX_CONF" |
    xargs -r -d '\n' grep -lE "^[[:space:]]*listen[[:space:]]+([^;]*:)?${PORT}\b" 2>/dev/null || true)"
  if [ -n "$taken" ]; then
    err "Port ${PORT} is already used by:"
    printf '  %s\n' $taken >&2
    die "Change [server] port in config.ini, or remove that config."
  fi

  local rendered backup=""
  rendered="$(mktemp)"
  render_nginx_conf >"$rendered"
  if [ -f "$NGINX_CONF" ]; then
    backup="$(mktemp)"
    as_root cat "$NGINX_CONF" >"$backup"
  fi

  log "Installing ${NGINX_CONF}"
  as_root install -m 644 -o root -g root "$rendered" "$NGINX_CONF"
  rm -f "$rendered"

  # A rejected config must not stay on disk: the next reload of any other site
  # on this server would fail on it. nginx -t tests every site at once, so the
  # test is repeated without this change to tell whose config is at fault.
  local test_output
  if ! test_output="$(as_root nginx -t -q 2>&1)"; then
    if [ -n "$backup" ]; then
      as_root install -m 644 -o root -g root "$backup" "$NGINX_CONF"
      rm -f "$backup"
    else
      as_root rm -f "$NGINX_CONF"
    fi
    if as_root nginx -t -q >/dev/null 2>&1; then
      printf '%s\n' "$test_output" >&2
      die "Nginx rejected the generated config; ${NGINX_CONF} was left as it was."
    fi
    test_output="$(as_root nginx -t -q 2>&1 || true)"
    printf '%s\n' "$test_output" >&2
    explain_nginx_failure "$test_output"
    die "nginx -t fails without this site's change too, so the fault is not in this site's config. ${NGINX_CONF} was left as it was."
  fi
  [ -z "$backup" ] || rm -f "$backup"

  # A reload cannot move a listener: Nginx binds the new address while the old
  # socket is still open, the bind fails, and the reload still reports success.
  local want
  want="$(intended_addresses)"
  reload_nginx
  if ! wait_for_listeners "$want"; then
    warn "Reload kept the previous listeners on port ${PORT}; restarting Nginx to rebind them"
    as_root systemctl restart nginx
    wait_for_listeners "$want" ||
      die "Port ${PORT} is bound to '$(port_addresses)', not '${want}' — another process may hold it"
  fi
  log "Nginx serving ${DIST} on ${want}"
}

# The directory entries are all Nginx's user needs on the way to dist/: traverse
# on each parent, read on dist/ itself. dist/ also gets a default entry, so what
# a later build writes there stays readable without running this again. Root is
# needed only for a parent the checkout's owner does not own.
nginx_can_enter() {
  local user="$1" dir="$2" rights
  rights="$(getfacl -p --omit-header "$dir" 2>/dev/null | awk -v entry="user:$user:" '
    index($1, entry) == 1 {
      rights = substr($1, length(entry) + 1)
      if ($2 ~ /^#effective:/) rights = substr($2, 12)
      print rights
      exit
    }')"
  if [ -n "$rights" ]; then
    [ "${rights:2:1}" = x ]
  else
    case "$(stat -c %A "$dir")" in *x|*t) return 0 ;; *) return 1 ;; esac
  fi
}

grant_access() {
  require setfacl getfacl
  local user dir
  user="$(nginx_user)"
  dir="$(dirname "$DIST")"
  while [ "$dir" != / ]; do
    if ! nginx_can_enter "$user" "$dir"; then
      if [ -O "$dir" ]; then
        setfacl -m "u:${user}:x" "$dir"
      else
        as_root setfacl -m "u:${user}:x" "$dir"
      fi
    fi
    dir="$(dirname "$dir")"
  done
  as_owner setfacl -R -m "u:${user}:rX" "$DIST"
  as_owner setfacl -d -m "u:${user}:rX" "$DIST"
}

ensure_nginx() {
  step "Nginx"
  require nginx ss
  if nginx_conf_is_current && [ "$(port_addresses)" = "$(intended_addresses)" ]; then
    log "Nginx config current (${NGINX_CONF})"
  else
    install_nginx_conf
  fi
  grant_access
}

# ─── Status ──────────────────────────────────────────────────────────────────

http_head() {
  curl -sI --max-time 20 -A md2tufte-status "$@" 2>/dev/null | tr -d '\r' || true
}

status_code() {
  awk 'NR == 1 { print $2; exit }'
}

header() {
  awk -v name="$1:" 'tolower($1) == name { sub(/^[^:]*:[ \t]*/, ""); print; exit }'
}

# Distinct lines, in order, on one line.
summarize() {
  awk 'NF && !seen[$0]++ { printf "%s%s", (n++ ? " / " : ""), $0 }'
}

# The tunnel's routes are set in the Cloudflare Zero Trust dashboard, not on any
# host, so a wrong one shows up only here, as a public site that is not this
# origin's. $1 is what the routes must dial: the gateway, or else this port.
tunnel_hint() {
  if systemctl is-active --quiet cloudflared 2>/dev/null; then
    printf "another host's connector of the tunnel answered, or the tunnel's routes do not dial %s (Cloudflare Zero Trust dashboard)" "$1"
  else
    printf "cloudflared is not running on this host, so another host's connector answered"
  fi
}

validate_all() {
  require curl ss
  step "Status"
  local ok=0 fail=0

  pass()  { echo "  [OK]   $*"; ok=$((ok + 1)); }
  flunk() { echo "  [FAIL] $*"; fail=$((fail + 1)); }

  if [ -f "$DIST/index.html" ]; then
    pass "site built (${DIST})"
  else
    flunk "no build in ${DIST} — run: scripts/manage.sh build"
  fi

  if systemctl is-active --quiet nginx 2>/dev/null; then
    pass "nginx service"
  else
    flunk "nginx service is not active — run: sudo systemctl start nginx"
  fi

  if nginx_conf_is_current; then
    pass "nginx config current (${NGINX_CONF})"
  else
    flunk "nginx config missing or stale (${NGINX_CONF}) — run: scripts/manage.sh nginx"
  fi

  local dir
  for dir in $(log_dirs); do
    if [ -d "$dir" ]; then
      pass "log directory present (${dir})"
    else
      flunk "log directory ${dir} is missing, so nginx -t and any restart fail — run: $(recreate_log_dir "$dir")"
    fi
  done

  local addrs want exposed
  addrs="$(port_addresses)"
  want="$(intended_addresses)"
  exposed="$(port_exposed)"
  if [ -z "$addrs" ]; then
    flunk "nothing listens on port ${PORT}"
  elif [ -n "$exposed" ]; then
    flunk "port ${PORT} is reachable outside loopback (${addrs})"
  elif [ "$addrs" != "$want" ]; then
    flunk "port ${PORT} is bound to ${addrs}, the config asks for ${want} — run: scripts/manage.sh nginx"
  else
    pass "port ${PORT} on loopback only (${addrs})"
  fi

  local head code server here there
  head="$(http_head "http://127.0.0.1:${PORT}/")"
  code="$(status_code <<<"$head")"
  server="$(header server <<<"$head")"
  here="$(header last-modified <<<"$head")"
  case "${code}:${server}" in
    200:nginx*) pass "origin answers 200 from nginx (http://127.0.0.1:${PORT}/)" ;;
    403:nginx*) flunk "origin answers 403 — the nginx user cannot read ${DIST}; run: scripts/manage.sh nginx" ;;
    :*)         flunk "origin does not answer on http://127.0.0.1:${PORT}/" ;;
    *:nginx*)   flunk "origin answers ${code} (http://127.0.0.1:${PORT}/)" ;;
    *)          flunk "port ${PORT} is answered by '${server:-unknown}', not nginx" ;;
  esac

  # The tunnel dials the gateway, when there is one, and the gateway forwards to
  # this port: a stale upstream there answers with another build or a 502.
  local gateway target
  gateway="$(gateway_address || true)"
  target="${gateway:-127.0.0.1:${PORT}}"
  if [ -n "$gateway" ]; then
    head="$(http_head -H "Host: ${SITE_HOST}" "http://${gateway}/")"
    code="$(status_code <<<"$head")"
    there="$(header last-modified <<<"$head")"
    if [ "$code" = 200 ] && [ -n "$here" ] && [ "$there" = "$here" ]; then
      pass "gateway forwards ${SITE_HOST} to this origin (${gateway} → 127.0.0.1:${PORT})"
    elif [ -z "$code" ]; then
      flunk "gateway ${gateway} does not answer"
    else
      flunk "gateway ${gateway} answers ${SITE_HOST} with ${code}${there:+ (Last-Modified ${there})}, not this build — it must forward to 127.0.0.1:${PORT}"
    fi
  fi

  # Nginx sends the file's mtime as Last-Modified and Cloudflare passes it on, so
  # an equal value is this build and a different one is another host's. A tunnel
  # with connectors on several hosts hands each request to one of them, so one
  # answer says nothing about the next: the site is asked several times.
  local asked=8 mine=0 i errors="" others="" detail=""
  for ((i = 0; i < asked; i++)); do
    head="$(http_head "${SITE_URL}/")"
    code="$(status_code <<<"$head")"
    there="$(header last-modified <<<"$head")"
    if [ "$code" != 200 ]; then
      errors+="${code:-nothing}"$'\n'
    elif [ -n "$here" ] && [ "$there" = "$here" ]; then
      mine=$((mine + 1))
    else
      others+="${there:-no Last-Modified}"$'\n'
    fi
  done
  [ -z "$others" ] || detail="$(grep -c . <<<"$others") got Last-Modified $(summarize <<<"$others")"
  [ -z "$errors" ] || detail="${detail:+${detail}, }$(grep -c . <<<"$errors") answered $(summarize <<<"$errors")"
  if [ -z "$here" ]; then
    warn "the origin sent no Last-Modified, so which host serves ${SITE_URL} is unknown"
  elif [ "$mine" -eq "$asked" ]; then
    pass "public site serves this build (${asked} of ${asked} requests to ${SITE_URL}/)"
  elif [ "$mine" -gt 0 ]; then
    flunk "public site serves this build to ${mine} of ${asked} requests; ${detail} — the tunnel also has a connector on another host, which serves its own build"
  elif [ -z "$others" ]; then
    flunk "public site answers $(summarize <<<"$errors") (${SITE_URL}/) — $(tunnel_hint "$target")"
  else
    flunk "public site is not this build (${detail}; here ${here}) — $(tunnel_hint "$target")"
  fi

  if [ -f .env.deploy ]; then
    if [ -n "$(find .env.deploy -perm /077)" ]; then
      flunk ".env.deploy is readable by other accounts — run: chmod 600 .env.deploy"
    else
      pass ".env.deploy readable by its owner only"
    fi
  fi

  echo
  if [ "$fail" -eq 0 ]; then
    log "All ${ok} checks passed"
  else
    err "${fail} check(s) failed, ${ok} passed"
  fi
  return "$fail"
}

# ─── Commands ────────────────────────────────────────────────────────────────

run_verify() {
  node scripts/verify.js --origin "$1"
}

cmd_deploy() {
  build_site
  ensure_nginx

  # The origin is checked before anything is published: an edge purge and a crawl
  # invitation are worth nothing if the server behind them is answering wrongly.
  if [ "$verify" -eq 1 ]; then
    step "Origin"
    run_verify "http://127.0.0.1:${PORT}"
  fi

  if [ "$publish" -eq 1 ]; then
    step "Publish"
    node scripts/publish.js
  fi

  # And again through the edge, which is what a reader and a crawler actually get.
  if [ "$verify" -eq 1 ]; then
    validate_all
    step "Public site"
    run_verify "$SITE_URL"
  fi
}

cmd_nginx() {
  if [ "$print" -eq 1 ]; then
    render_nginx_conf
    return
  fi
  step "Nginx"
  install_nginx_conf
  grant_access
}

cmd_uninstall() {
  step "Nginx"
  if [ ! -e "$NGINX_CONF" ]; then
    warn "${NGINX_CONF} not found"
  elif ! grep -qF "root ${DIST};" "$NGINX_CONF"; then
    # config.ini names the file, but only one that serves this checkout is ours.
    warn "${NGINX_CONF} does not serve ${DIST} — left in place"
  else
    as_root rm -f "$NGINX_CONF"
    if systemctl is-active --quiet nginx 2>/dev/null; then
      reload_nginx
    fi
    log "Removed ${NGINX_CONF}"
  fi

  step "Build output and dependencies"
  rm -rf "${DIST:?}" .astro node_modules
  log "Removed dist/, .astro/ and node_modules/ — content/, config.ini and the source are kept"
  log "The nginx user's traverse entries on parent directories stay: other sites may rely on them"
}

usage() {
  cat <<USAGE
md2tufte — build, serve and publish the site

Usage: $(basename "$0") [command] [options]

Lifecycle:
  deploy            deps → build → nginx → verify origin → publish → status → verify public site (default)
  status            Check the build, Nginx, the port, the origin, the gateway and the public site; writes nothing
  verify            Check an origin's routing, metadata and headers over HTTP
  publish           Purge the Cloudflare cache and submit the URLs to IndexNow
  uninstall         Remove this site's Nginx config, dist/, .astro/ and node_modules/

Nginx (the site is only ever served through it):
  nginx             Render and install the config, nginx -t, reload (needs sudo)
  nginx --print     Print the rendered config without installing it

Build and development:
  build             Minified CSS and static build into dist/
  dev               Astro dev server with hot reload

Options:
  --origin <url>    With verify: the origin to check (default: ${SITE_URL})
  --no-publish      With deploy: skip the cache purge and IndexNow
  --no-verify       With deploy: skip the HTTP checks and the status report
  -h, --help        Show this help

Settings come from config.ini: port ${PORT}, config ${NGINX_CONF}.
USAGE
}

ensure_node
load_config

command="deploy"
if [[ $# -gt 0 && "$1" != -* ]]; then
  command="$1"
  shift
fi

origin=""
print=0
publish=1
verify=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --origin) [[ $# -ge 2 ]] || die "--origin needs a URL"; origin="$2"; shift 2 ;;
    --print) print=1; shift ;;
    --no-publish) publish=0; shift ;;
    --no-verify) verify=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown option: $1"; usage; exit 1 ;;
  esac
done

case "$command" in
  deploy)    cmd_deploy ;;
  status)    validate_all ;;
  verify)    run_verify "${origin:-$SITE_URL}" ;;
  publish)   node scripts/publish.js ;;
  uninstall) cmd_uninstall ;;
  nginx)     cmd_nginx ;;
  build)     build_site ;;
  dev)       ensure_deps; as_owner npm run dev ;;
  help)      usage ;;
  *)         err "Unknown command: $command"; usage; exit 1 ;;
esac
