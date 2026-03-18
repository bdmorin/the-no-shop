#!/bin/bash
set -e

# LAT — UserPromptSubmit Hook
# Injects lat-active directive and pending annotations as context.

LAT_PORT="${LAT_PORT:-4747}"
LAT_URL="http://127.0.0.1:${LAT_PORT}"

EVENT=$(cat)
SESSION_ID=$(echo "$EVENT" | jq -r '.session_id // empty')

# Check ~/.lat/active — exit 0 if file doesn't exist or contains "off"
if [ ! -f ~/.lat/active ] || [ "$(cat ~/.lat/active)" = "off" ]; then
  exit 0
fi

# Check daemon health
if ! curl -sf "${LAT_URL}/health" > /dev/null 2>&1; then
  exit 0
fi

# ALWAYS inject the lat-active formatting directive
cat <<'EOF'
<lat-active>
When LLMAnnotationTerminal is active, follow these formatting rules:
- Use explicit markdown headings to separate topics
- Put each question on its own line, as a standalone paragraph
- When presenting options, use a consistent labeled format (A/B/C or numbered)
- Wrap mermaid diagrams in ```mermaid fenced blocks
- For long responses, start with a 1-2 sentence summary
- Separate decisions/questions from explanatory prose with a heading or horizontal rule
</lat-active>
EOF

# Consume pending annotations for this session
ANNOTATIONS=$(curl -sf "${LAT_URL}/api/annotations/consume?session=${SESSION_ID}" --no-progress-bar 2>/dev/null || echo "[]")

COUNT=$(echo "$ANNOTATIONS" | jq 'length' 2>/dev/null || echo "0")
if [ "$COUNT" = "0" ] || [ "$COUNT" = "null" ]; then
  exit 0
fi

# CLI indicator
echo "LAT: ${COUNT} annotation(s) injected" >&2

# Format annotations as XML
RESPONSE_ID=$(echo "$ANNOTATIONS" | jq -r '.[0].responseId // ""')
TIMESTAMP=$(echo "$ANNOTATIONS" | jq -r '.[0].timestamp // ""')

echo "<lat-annotations session=\"${SESSION_ID}\" response=\"${RESPONSE_ID}\" timestamp=\"${TIMESTAMP}\">"

echo "$ANNOTATIONS" | jq -r '.[] |
  if .type == "answer" then
    "  <answer block=\"" + (.blockId // "") + "\" question=\"" + (.question // "") + "\">" + (.content // "") + "</answer>"
  elif .type == "choice" then
    "  <choice block=\"" + (.blockId // "") + "\" question=\"" + (.question // "") + "\"><selected option=\"" + (.selectedOption // "") + "\">" + (.content // "") + "</selected></choice>"
  elif .type == "highlight" then
    "  <highlight block=\"" + (.blockId // "") + "\" text=\"" + (.selectedText // "") + "\">" + (.comment // "") + "</highlight>"
  elif .type == "comment" then
    "  <comment block=\"" + (.blockId // "") + "\">" + (.content // "") + "</comment>"
  elif .type == "reject" then
    "  <reject block=\"" + (.blockId // "") + "\" reason=\"" + (.reason // "") + "\" />"
  elif .type == "approve" then
    "  <approve block=\"" + (.blockId // "") + "\" />"
  else
    "  <!-- unknown annotation type: " + (.type // "?") + " -->"
  end'

echo "</lat-annotations>"

exit 0
