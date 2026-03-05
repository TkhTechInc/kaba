#!/usr/bin/env bash
# Generate PWA icons from the SVG logo
# Requires: rsvg-convert, inkscape, or sips (macOS)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SVG_SRC="$PROJECT_DIR/public/images/logo/logo-icon.svg"
OUT_DIR="$PROJECT_DIR/public/icons"

mkdir -p "$OUT_DIR"

generate_png() {
  local size=$1
  local out=$2

  if command -v rsvg-convert &>/dev/null; then
    rsvg-convert -w "$size" -h "$size" "$SVG_SRC" -o "$out"
  elif command -v inkscape &>/dev/null; then
    inkscape --export-type=png --export-width="$size" --export-height="$size" \
      --export-filename="$out" "$SVG_SRC"
  elif command -v sips &>/dev/null; then
    # sips cannot convert SVG directly; use node fallback below
    return 1
  else
    return 1
  fi
}

generate_with_node() {
  local size=$1
  local out=$2
  node -e "
const { execSync } = require('child_process');
const fs = require('fs');
// Try sharp if available
try {
  const sharp = require('sharp');
  const svg = fs.readFileSync('$SVG_SRC');
  sharp(svg).resize($size, $size).png().toFile('$out', (err) => {
    if (err) { console.error('sharp error:', err); process.exit(1); }
  });
} catch(e) {
  // Fallback: 1x1 transparent PNG
  const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync('$out', PNG_1x1);
  console.warn('Fallback: wrote 1x1 placeholder PNG to $out');
}
"
}

SIZES=(192 512)
VARIANTS=("" "-maskable")

for size in "${SIZES[@]}"; do
  for variant in "${VARIANTS[@]}"; do
    out="$OUT_DIR/icon${variant}-${size}.png"
    echo "Generating $out ..."
    if ! generate_png "$size" "$out" 2>/dev/null; then
      generate_with_node "$size" "$out"
    fi
  done
done

echo "Done. Icons written to $OUT_DIR"
