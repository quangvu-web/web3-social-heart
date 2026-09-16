#!/usr/bin/env sh
set -eu

HLS_ROOT="${HLS_ROOT:-/var/www/hls/live}"
MAX_AGE_MINUTES="${MAX_AGE_MINUTES:-180}"

if [ ! -d "$HLS_ROOT" ]; then
  exit 0
fi

find "$HLS_ROOT" -mindepth 1 -maxdepth 1 -type d -mmin +"$MAX_AGE_MINUTES" -exec rm -rf {} +
find "$HLS_ROOT" -mindepth 1 -maxdepth 1 -type f \( -name '*.m3u8' -o -name '*.ts' \) -mmin +"$MAX_AGE_MINUTES" -delete
