#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [command] [options]

Commands:
  dev                Run npm run dev
  deploy             Build, update Nginx, clear cache, reload (default)

Options:
  --port <port>           Nginx port (default: 1213)
  --server-name <name>    Nginx server_name (default: cruz.rio.br)
  -h, --help              Show this help
USAGE
}

require_cmd() {
  command -v "$1" >/dev/null || { echo "Missing command: $1"; exit 1; }
}

port="1213"
serverName="cruz.rio.br"

command="deploy"
if [[ $# -gt 0 && "$1" != -* ]]; then
  command="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      port="$2"
      shift 2
      ;;
    --server-name)
      serverName="$2"
      shift 2
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

clear_nginx_cache() {
  if [[ -d /var/cache/nginx ]]; then
    sudo find /var/cache/nginx -mindepth 1 -type f -delete
    sudo find /var/cache/nginx -mindepth 1 -type d -empty -delete
  fi
}

reload_nginx() {
  if command -v systemctl >/dev/null; then
    sudo systemctl reload nginx || sudo systemctl restart nginx
  else
    sudo nginx -s reload
  fi
}

run_dev() {
  require_cmd npm
  pushd "$DIR" >/dev/null
  npm run dev
  popd >/dev/null
}

run_deploy() {
  require_cmd npm
  require_cmd sudo

  sudo -v

  pushd "$DIR" >/dev/null
  npm run build
  popd >/dev/null

  "$DIR/scripts/setup-nginx.sh" \
    --port "$port" \
    --server-name "$serverName" \
    --skip-build \
    --no-reload

  clear_nginx_cache
  reload_nginx
}

case "$command" in
  dev)
    run_dev
    ;;
  deploy)
    run_deploy
    ;;
  *)
    echo "Unknown command: $command"
    usage
    exit 1
    ;;
esac
