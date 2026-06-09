#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

cd "${CLAUDE_PROJECT_DIR:-/home/user/Foerderpilot}"

# Install dependencies
npm install

# Start the Next.js dev server in the background if not already running
PIDFILE=/tmp/next-dev.pid
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "Next.js dev server already running (PID $(cat "$PIDFILE"))"
else
  nohup npm run dev > /tmp/next-dev.log 2>&1 &
  echo $! > "$PIDFILE"
  disown
  echo "Next.js dev server started on port 3000 (PID $(cat "$PIDFILE"))"
fi
