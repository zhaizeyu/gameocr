#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"

stop_service() {
  local name="$1" pid_file="$2"
  if [[ ! -f "$pid_file" ]]; then
    echo "$name: no pid file, assuming not running."
    return 0
  fi
  local pid; pid=$(cat "$pid_file" 2>/dev/null || true)
  if [[ -z "$pid" ]]; then
    echo "$name: empty pid file, removing."
    rm -f "$pid_file"
    return 0
  fi
  kill -9 "$pid" && echo "$name: force stopped PID $pid"
  rm -f "$pid_file"
}

stop_service "Backend" "$PID_DIR/backend.pid"
stop_service "Frontend" "$PID_DIR/frontend.pid"

echo "All services stopped."
