#!/bin/bash
set -e

# LAT — SessionEnd Hook

LAT_PORT="${LAT_PORT:-4747}"
LAT_URL="http://127.0.0.1:${LAT_PORT}"

EVENT=$(cat)

if ! curl -sf "${LAT_URL}/health" > /dev/null 2>&1; then
  exit 0
fi

SESSION_ID=$(echo "$EVENT" | jq -r '.session_id // empty')
TRANSCRIPT=$(echo "$EVENT" | jq -r '.transcript_path // empty')

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

curl -sf -X POST "${LAT_URL}/api/session/${SESSION_ID}/end" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg transcript "$TRANSCRIPT" '{transcriptPath: $transcript}')" \
  --no-progress-bar > /dev/null 2>&1 || true

exit 0
