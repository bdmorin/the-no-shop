#!/bin/bash
set -e

# Foldspace Console — Stop Hook
# Sends last_assistant_message to daemon tagged with session_id.

FOLDSPACE_PORT="${FOLDSPACE_PORT:-3377}"
FOLDSPACE_URL="http://localhost:${FOLDSPACE_PORT}"

EVENT=$(cat)

STOP_ACTIVE=$(echo "$EVENT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

if ! curl -sf "${FOLDSPACE_URL}/api/health" > /dev/null 2>&1; then
  exit 0
fi

CONTENT=$(echo "$EVENT" | jq -r '.last_assistant_message // empty')
SESSION_ID=$(echo "$EVENT" | jq -r '.session_id // "unknown"')

if [ -z "$CONTENT" ]; then
  exit 0
fi

PAYLOAD=$(jq -n \
  --arg content "$CONTENT" \
  --arg role "assistant" \
  --arg sid "$SESSION_ID" \
  '{role: $role, content: $content, sessionId: $sid}')

curl -sf -X POST "${FOLDSPACE_URL}/api/response" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" --no-progress-bar > /dev/null 2>&1 || true

exit 0
