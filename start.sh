#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

mkdir -p "$PID_DIR" "$LOG_DIR"

ensure_not_running() {
  local name="$1" pid_file="$2"
  if [[ -f "$pid_file" ]]; then
    local pid; pid=$(cat "$pid_file" 2>/dev/null || true)
    if [[ -n "$pid" && -e "/proc/$pid" ]]; then
      echo "$name already running with PID $pid (see $pid_file)" >&2
      return 1
    fi
    rm -f "$pid_file"
  fi
  return 0
}

start_backend() {
  local pid_file="$PID_DIR/backend.pid"
  ensure_not_running "Backend" "$pid_file" || return 1
  if [[ ! -x "$ROOT_DIR/.venv/bin/uvicorn" ]]; then
    echo "uvicorn not found. Ensure .venv is created and dependencies installed." >&2
    return 1
  fi
  (
    cd "$ROOT_DIR/backend"
    nohup "$ROOT_DIR/.venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8000 >>"$BACKEND_LOG" 2>&1 &
    echo $! >"$pid_file"
  )
  echo "Backend started (PID $(cat "$pid_file")), logs: $BACKEND_LOG"
}

start_frontend() {
  local pid_file="$PID_DIR/frontend.pid"
  ensure_not_running "Frontend" "$pid_file" || return 1
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm not found. Install Node.js to run the frontend." >&2
    return 1
  fi
  (
    cd "$ROOT_DIR/frontend"
    nohup npm run dev -- --host 0.0.0.0 --port 5173 >>"$FRONTEND_LOG" 2>&1 &
    echo $! >"$pid_file"
  )
  echo "Frontend started (PID $(cat "$pid_file")), logs: $FRONTEND_LOG"
}

start_backend
start_frontend

echo "All services started."
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
