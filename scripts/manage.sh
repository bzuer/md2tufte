#!/usr/bin/env bash
# Single entry point for running and publishing the site. Every setting comes
# from config.ini, read through scripts/config.js.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

require() {
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null || { echo "Missing command: $cmd"; exit 1; }
  done
}

require node
eval "$(node scripts/config.js)"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [command] [options]

Commands:
  dev        Astro dev server with hot reload
  build      Minified CSS and static build into dist/
  nginx      Install the generated Nginx config and reload
  deploy     build, nginx, verify the origin, publish, verify the public site (default)
  publish    Purge the Cloudflare cache and submit the URLs to IndexNow
  verify     Check a running origin over HTTP

Options:
  --origin <url>   Origin to verify (default: ${SITE_URL})
  --print          With nginx: print the config instead of installing it
  --no-publish     Deploy without purging the cache or notifying search engines
  --no-verify      Deploy without the HTTP checks
  -h, --help       Show this help

Settings come from config.ini: port ${PORT}, config ${NGINX_CONF}.
USAGE
}

command="deploy"
if [[ $# -gt 0 && "$1" != -* ]]; then
  command="$1"
  shift
fi

origin=""
print="0"
publish="1"
verify="1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --origin) origin="$2"; shift 2 ;;
    --print) print="1"; shift ;;
    --no-publish) publish="0"; shift ;;
    --no-verify) verify="0"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# Nginx must be able to traverse into the site root, which lives under a home
# directory it has no access to by default.
grant_access() {
  local user dir dirs=()
  user="$(awk '$1 == "user" { gsub(";", "", $2); print $2; exit }' /etc/nginx/nginx.conf 2>/dev/null || true)"
  dir="$DIST"

  while [[ "$dir" != "/" && -n "$dir" ]]; do
    dirs+=("$dir")
    dir="$(dirname "$dir")"
  done

  if command -v setfacl >/dev/null; then
    sudo setfacl -m "u:${user:-www-data}:rx" "${dirs[@]}"
    sudo setfacl -R -m "u:${user:-www-data}:rX" "$DIST"
  else
    sudo chmod o+rx "${dirs[@]}"
    sudo chmod -R o+rX "$DIST"
  fi
}

reload_nginx() {
  if command -v systemctl >/dev/null; then
    sudo systemctl reload nginx || sudo systemctl restart nginx
  else
    sudo nginx -s reload
  fi
}

run_nginx() {
  if [[ "$print" -eq 1 ]]; then
    node scripts/nginx.js
    return
  fi

  require nginx sudo
  [[ -d "$DIST" ]] || { echo "Site root not found: ${DIST} — run '$(basename "$0") build' first."; exit 1; }

  local rendered
  rendered="$(mktemp)"
  node scripts/nginx.js >"$rendered"
  sudo install -m 644 "$rendered" "$NGINX_CONF"
  rm -f "$rendered"

  grant_access
  sudo nginx -t
  reload_nginx
  echo "Nginx serving ${DIST} on 127.0.0.1:${PORT} (${NGINX_CONF})."
}

run_verify() {
  node scripts/verify.js --origin "${1:-${origin:-$SITE_URL}}"
}

run_deploy() {
  require npm sudo
  sudo -v

  npm run build
  run_nginx

  # The origin is checked before anything is published: an edge purge and a crawl
  # invitation are worth nothing if the server behind them is answering wrongly.
  if [[ "$verify" -eq 1 ]]; then
    echo
    run_verify "http://127.0.0.1:${PORT}"
  fi

  if [[ "$publish" -eq 1 ]]; then
    echo
    node scripts/publish.js
  fi

  # And again through the edge, which is what a reader and a crawler actually get.
  if [[ "$verify" -eq 1 ]]; then
    echo
    run_verify "$SITE_URL"
  fi
}

case "$command" in
  dev) require npm; npm run dev ;;
  build) require npm; npm run build ;;
  nginx) run_nginx ;;
  deploy) run_deploy ;;
  publish) node scripts/publish.js ;;
  verify) run_verify ;;
  *) echo "Unknown command: $command"; usage; exit 1 ;;
esac
