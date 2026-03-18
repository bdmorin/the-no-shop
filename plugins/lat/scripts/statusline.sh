#!/bin/bash
# Outputs "LAT" if active, empty string if not
LAT_PORT="${LAT_PORT:-4747}"
[ -f ~/.lat/active ] && [ "$(cat ~/.lat/active)" = "on" ] && \
  curl -sf "http://127.0.0.1:${LAT_PORT}/health" > /dev/null 2>&1 && \
  printf "LAT"
