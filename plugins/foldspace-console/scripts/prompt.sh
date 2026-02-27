#!/bin/bash
set -e

# Foldspace Console — UserPromptSubmit Hook
# Fetches pending annotations for THIS session and injects as context.

FOLDSPACE_PORT="${FOLDSPACE_PORT:-3377}"
FOLDSPACE_URL="http://localhost:${FOLDSPACE_PORT}"

EVENT=$(cat)
SESSION_ID=$(echo "$EVENT" | jq -r '.session_id // empty')

if ! curl -sf "${FOLDSPACE_URL}/api/health" > /dev/null 2>&1; then
  exit 0
fi

ANNOTATIONS=$(curl -sf "${FOLDSPACE_URL}/api/annotations?session=${SESSION_ID}" --no-progress-bar 2>/dev/null || echo "[]")

COUNT=$(echo "$ANNOTATIONS" | jq 'length')
if [ "$COUNT" = "0" ] || [ "$COUNT" = "null" ]; then
  exit 0
fi

echo "$ANNOTATIONS" | jq -r '
  "--- Annotations from Foldspace Console ---\n" +
  (to_entries | map(
    "\n[" + ((.key + 1) | tostring) + "] On text:\n> " +
    (.value.selectedText | gsub("\n"; "\n> ")) +
    "\n\nComment: " + .value.comment + "\n"
  ) | join("\n")) +
  "\n--- End annotations ---"
'

curl -sf -X DELETE "${FOLDSPACE_URL}/api/annotations?session=${SESSION_ID}" --no-progress-bar > /dev/null 2>&1 || true

exit 0
