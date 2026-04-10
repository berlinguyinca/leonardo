#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.dev.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "No dev server running"
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null
  echo "Dev server stopped (PID: $PID)"
else
  echo "Dev server not running (stale PID: $PID)"
fi
rm -f "$PID_FILE"
