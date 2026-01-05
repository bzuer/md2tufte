#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [command] [options]

Commands:
  dev                   Run npm run dev
  deploy                Build, clear Nginx cache, sync dist/ (default)

Options:
  --deploy-dir <path>   Nginx site root (default: /var/www/md2html)
  --skip-clean          Skip Nginx cache cleanup
  --skip-sync           Skip rsync to deploy dir
  -h, --help            Show this help
USAGE
}

require_cmd() {
  command -v "$1" >/dev/null || { echo "Missing command: $1"; exit 1; }
}

deployDir="/var/www/md2html"
skipClean="0"
skipSync="0"

command="deploy"
if [[ $# -gt 0 && "$1" != -* ]]; then
  command="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy-dir)
      deployDir="$2"
      shift 2
      ;;
    --skip-clean)
      skipClean="1"
      shift
      ;;
    --skip-sync)
      skipSync="1"
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

run_dev() {
  require_cmd npm
  pushd "$DIR" >/dev/null
  npm run dev
  popd >/dev/null
}

run_deploy() {
  require_cmd npm
  require_cmd rsync
  require_cmd sudo

  pushd "$DIR" >/dev/null
  npm run build
  popd >/dev/null

  if [[ "$skipClean" -eq 0 ]]; then
    clear_nginx_cache
  fi

  if [[ "$skipSync" -eq 0 ]]; then
    if [[ ! -d "$deployDir" ]]; then
      sudo mkdir -p "$deployDir"
    fi
    sudo rsync -a --delete "$DIR/dist/" "$deployDir/"
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
