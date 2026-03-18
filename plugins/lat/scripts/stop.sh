#!/bin/bash
set -e

# LAT — Stop Hook
# Sends last_assistant_message to daemon tagged with session_id.
# CRITICAL: last_assistant_message is provided directly in stdin JSON — do NOT parse transcript JSONL.

LAT_PORT="${LAT_PORT:-4747}"
LAT_URL="http://127.0.0.1:${LAT_PORT}"

EVENT=$(cat)

STOP_ACTIVE=$(echo "$EVENT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

if ! curl -sf "${LAT_URL}/health" > /dev/null 2>&1; then
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

curl -sf -X POST "${LAT_URL}/api/response" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" --no-progress-bar > /dev/null 2>&1 || true

exit 0
