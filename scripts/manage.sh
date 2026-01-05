#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [command] [options]

Commands:
  dev                Run npm run dev
  deploy             Build, sync, update Nginx (default)

Options:
  --port <port>           Nginx port (default: 1213)
  --server-name <name>    Nginx server_name (default: cruz.rio.br)
  --remote <user@host>    Remote SSH target (default: server@192.168.18.50)
  --remote-dir <path>     Remote project dir (default: /home/server/md2html)
  --skip-remote           Skip remote sync + Nginx updates
  -h, --help              Show this help
USAGE
}

require_cmd() {
  command -v "$1" >/dev/null || { echo "Missing command: $1"; exit 1; }
}

port="1213"
serverName="cruz.rio.br"
remoteHost="server@192.168.18.50"
remoteDir="/home/server/md2html"
skipRemote="0"

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
    --remote)
      remoteHost="$2"
      shift 2
      ;;
    --remote-dir)
      remoteDir="$2"
      shift 2
      ;;
    --skip-remote)
      skipRemote="1"
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
  require_cmd rsync
  require_cmd ssh
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

  if [[ "$skipRemote" -eq 0 ]]; then
    rsync -az --delete --info=stats2 "${DIR}/" "${remoteHost}:${remoteDir}/"
  fi
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
