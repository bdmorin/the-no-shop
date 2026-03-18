#!/bin/bash
set -e

# LAT — SessionStart Hook
# Registers session with daemon. Auto-starts daemon if not running.

LAT_PORT="${LAT_PORT:-4747}"
LAT_URL="http://127.0.0.1:${LAT_PORT}"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

mkdir -p ~/.lat

EVENT=$(cat)

# Auto-start daemon if not running
if ! curl -sf "${LAT_URL}/health" > /dev/null 2>&1; then
  if command -v bun > /dev/null 2>&1; then
    nohup bun run "${PLUGIN_ROOT}/daemon/index.ts" > /dev/null 2>&1 &
    # Wait for startup
    for i in $(seq 1 10); do
      if curl -sf "${LAT_URL}/health" > /dev/null 2>&1; then
        break
      fi
      sleep 0.3
    done
  fi
fi

# Check daemon is up
if ! curl -sf "${LAT_URL}/health" > /dev/null 2>&1; then
  exit 0
fi

SESSION_ID=$(echo "$EVENT" | jq -r '.session_id // empty')
CWD=$(echo "$EVENT" | jq -r '.cwd // empty')
MODEL=$(echo "$EVENT" | jq -r '.model // "unknown"')
SOURCE=$(echo "$EVENT" | jq -r '.source // "startup"')
TRANSCRIPT=$(echo "$EVENT" | jq -r '.transcript_path // empty')

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

PAYLOAD=$(jq -n \
  --arg sid "$SESSION_ID" \
  --arg cwd "$CWD" \
  --arg model "$MODEL" \
  --arg source "$SOURCE" \
  --arg transcript "$TRANSCRIPT" \
  '{sessionId: $sid, cwd: $cwd, model: $model, source: $source, transcriptPath: $transcript}')

curl -sf -X POST "${LAT_URL}/api/session" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" --no-progress-bar > /dev/null 2>&1 || true

exit 0
