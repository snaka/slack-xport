#!/usr/bin/env bash
# Regenerate icon PNGs from icon.svg.
# Requires rsvg-convert (brew install librsvg).
set -euo pipefail

cd "$(dirname "$0")"
for size in 16 32 48 128; do
  rsvg-convert -w "$size" -h "$size" icon.svg -o "icon${size}.png"
done
echo "Generated icon16.png icon32.png icon48.png icon128.png"
