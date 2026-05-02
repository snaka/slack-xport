#!/usr/bin/env bash
# Build a distributable ZIP for Chrome Web Store submission.
# Excludes development-only files (icons/preview.html, icons/build.sh,
# icons/icon.svg, dotfiles, README, LICENSE, this script, etc.).
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(awk -F'"' '/"version":/ {print $4; exit}' manifest.json)
OUT="slack-xport-${VERSION}.zip"
rm -f "$OUT"

zip -r "$OUT" \
  manifest.json \
  content_script.js \
  popup/popup.html \
  popup/popup.js \
  icons/icon16.png \
  icons/icon32.png \
  icons/icon48.png \
  icons/icon128.png

echo "Built: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Contents:"
unzip -l "$OUT"
