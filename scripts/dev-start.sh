#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.dev.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Dev server already running (PID: $PID)"
    exit 0
  fi
  rm "$PID_FILE"
fi

cd "$PROJECT_DIR"
npm run dev &
echo $! > "$PID_FILE"
echo "Dev server started (PID: $(cat "$PID_FILE"))"
