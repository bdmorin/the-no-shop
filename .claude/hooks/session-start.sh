#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/home/user/the-no-shop}"

# Install foldspace-console bun dependencies
if [ -f "$PROJECT_DIR/plugins/foldspace-console/package.json" ]; then
  cd "$PROJECT_DIR/plugins/foldspace-console"
  bun install
fi
