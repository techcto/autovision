#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
case "${1:-up}" in
 up) docker network inspect application-platforms-local >/dev/null 2>&1 || docker network create application-platforms-local >/dev/null; docker compose up --build -d --wait ;;
 down) docker compose down ;;
 logs) docker compose logs -f ;;
 *) echo 'Usage: bash app.sh [up|down|logs]' >&2; exit 2 ;;
esac

