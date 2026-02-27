#!/bin/bash
set -e

# Foldspace Console — SessionEnd Hook

FOLDSPACE_PORT="${FOLDSPACE_PORT:-3377}"
FOLDSPACE_URL="http://localhost:${FOLDSPACE_PORT}"

EVENT=$(cat)

if ! curl -sf "${FOLDSPACE_URL}/api/health" > /dev/null 2>&1; then
  exit 0
fi

SESSION_ID=$(echo "$EVENT" | jq -r '.session_id // empty')
REASON=$(echo "$EVENT" | jq -r '.reason // "unknown"')
TRANSCRIPT=$(echo "$EVENT" | jq -r '.transcript_path // empty')

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

PAYLOAD=$(jq -n \
  --arg sid "$SESSION_ID" \
  --arg reason "$REASON" \
  --arg transcript "$TRANSCRIPT" \
  '{sessionId: $sid, reason: $reason, transcriptPath: $transcript}')

curl -sf -X POST "${FOLDSPACE_URL}/api/session/end" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" --no-progress-bar > /dev/null 2>&1 || true

exit 0
