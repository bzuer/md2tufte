#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [command] [options]

Commands:
  dev                Run npm run dev
  deploy             Build, update Nginx, reload, publish, verify (default)
  publish            Purge the Cloudflare cache and submit URLs to IndexNow
  verify             Check a running origin over HTTP

Options:
  --port <port>           Nginx port (default: 1213)
  --server-name <name>    Nginx server_name (default: cruz.rio.br)
  --origin <url>          Origin for verify (default: the public site)
  --no-publish            Deploy without purging the cache or notifying engines
  --no-verify             Deploy without the HTTP checks
  -h, --help              Show this help
USAGE
}

require_cmd() {
  command -v "$1" >/dev/null || { echo "Missing command: $1"; exit 1; }
}

port="1213"
serverName="cruz.rio.br"
origin=""
publish="1"
verify="1"

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
    --origin)
      origin="$2"
      shift 2
      ;;
    --no-publish)
      publish="0"
      shift
      ;;
    --no-verify)
      verify="0"
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

run_publish() {
  require_cmd node
  node "$DIR/scripts/publish.js"
}

run_verify() {
  require_cmd node
  if [[ -n "$origin" ]]; then
    node "$DIR/scripts/verify.js" --origin "$origin"
  else
    node "$DIR/scripts/verify.js"
  fi
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

  # The origin is checked before anything is published: an edge purge and a crawl
  # invitation are worth nothing if the server behind them is answering wrongly.
  if [[ "$verify" -eq 1 ]]; then
    echo
    node "$DIR/scripts/verify.js" --origin "http://127.0.0.1:${port}"
  fi

  if [[ "$publish" -eq 1 ]]; then
    echo
    run_publish
  fi

  # And again through the edge, which is what a reader and a crawler actually get.
  if [[ "$verify" -eq 1 ]]; then
    echo
    node "$DIR/scripts/verify.js"
  fi
}

case "$command" in
  dev)
    run_dev
    ;;
  deploy)
    run_deploy
    ;;
  publish)
    run_publish
    ;;
  verify)
    run_verify
    ;;
  *)
    echo "Unknown command: $command"
    usage
    exit 1
    ;;
esac
