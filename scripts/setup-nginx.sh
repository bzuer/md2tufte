#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Options:
  --port <port>           Local port for Nginx (default: 1213)
  --server-name <name>    Nginx server_name (repeatable, default: _)
  --root <path>           Site root (default: dist/)
  --config-path <path>    Nginx config path (default: /etc/nginx/conf.d/md2html.conf)
  --skip-build            Skip npm run build
  --no-reload             Skip nginx reload
  -h, --help              Show this help
USAGE
}

require_cmd() {
  command -v "$1" >/dev/null || { echo "Missing command: $1"; exit 1; }
}

port="1213"
siteRoot="${DIR}/dist"
configPath="/etc/nginx/conf.d/md2html.conf"
skipBuild="0"
reloadNginx="1"
serverNames=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      port="$2"
      shift 2
      ;;
    --server-name)
      serverNames+=("$2")
      shift 2
      ;;
    --root)
      siteRoot="$2"
      shift 2
      ;;
    --config-path)
      configPath="$2"
      shift 2
      ;;
    --skip-build)
      skipBuild="1"
      shift
      ;;
    --no-reload)
      reloadNginx="0"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

require_cmd nginx
require_cmd sudo
if [[ "$skipBuild" -eq 0 ]]; then
  require_cmd npm
  pushd "$DIR" >/dev/null
  npm run build
  popd >/dev/null
fi

if command -v pm2 >/dev/null; then
  if pm2 describe md2html >/dev/null 2>&1; then
    pm2 delete md2html
  fi
fi

if [[ ! -d "$siteRoot" ]]; then
  echo "Site root not found: $siteRoot"
  exit 1
fi

if [[ "${#serverNames[@]}" -eq 0 ]]; then
  serverNames=("_")
fi

tmpConfig="$(mktemp)"
cat >"$tmpConfig" <<CONFIG
server {
  listen 127.0.0.1:${port};
  server_name ${serverNames[*]};
  root ${siteRoot};
  index index.html;

  location / {
    try_files \$uri \$uri/index.html /index.html;
  }
}
CONFIG

configDir="$(dirname "$configPath")"
if [[ -w "$configDir" ]]; then
  mv "$tmpConfig" "$configPath"
else
  sudo mv "$tmpConfig" "$configPath"
fi

if ! sudo -v; then
  echo "Sudo authentication failed."
  exit 1
fi

nginxUser="$(awk '$1 == "user" { gsub(";", "", $2); print $2; exit }' /etc/nginx/nginx.conf 2>/dev/null || true)"
if [[ -z "$nginxUser" ]]; then
  nginxUser="www-data"
fi

parentDir="$siteRoot"
parentDirs=()
while [[ "$parentDir" != "/" && -n "$parentDir" ]]; do
  parentDirs+=("$parentDir")
  parentDir="$(dirname "$parentDir")"
done

if command -v setfacl >/dev/null; then
  sudo setfacl -m "u:${nginxUser}:rx" "${parentDirs[@]}"
  sudo setfacl -R -m "u:${nginxUser}:rX" "$siteRoot"
else
  sudo chmod o+rx "${parentDirs[@]}"
  sudo chmod -R o+rX "$siteRoot"
fi

if [[ -w /etc/nginx/nginx.conf ]]; then
  nginx -t
else
  sudo nginx -t
fi

if [[ "$reloadNginx" -eq 1 ]]; then
  if command -v systemctl >/dev/null; then
    sudo systemctl reload nginx || sudo systemctl restart nginx
  else
    sudo nginx -s reload
  fi
fi

echo "Nginx serving ${siteRoot} on 127.0.0.1:${port} (${configPath})."
