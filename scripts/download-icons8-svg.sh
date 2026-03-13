#!/usr/bin/env bash
# Download icon SVGs for shared-icons/svg/
#
# With ICONS8_API_KEY: fetches from Icons8 API (icons8.com)
# Without API key: fetches Lucide icons (lucide.dev, ISC license) - no signup needed
#
# Requires: curl, jq or python3

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAPPING_FILE="$PROJECT_ROOT/shared-icons/icon-mapping.json"
LUCIDE_MAPPING="$PROJECT_ROOT/shared-icons/lucide-mapping.json"
OUTPUT_DIR="$PROJECT_ROOT/shared-icons/svg"
API_BASE="https://api.icons8.com/api/iconsets/v3/icons"
LUCIDE_BASE="https://unpkg.com/lucide-static@0.468.0/icons"

if [[ ! -f "$MAPPING_FILE" ]]; then
  echo "Error: icon-mapping.json not found at $MAPPING_FILE"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Check for jq or python3 for JSON parsing
if command -v jq &>/dev/null; then
  USE_JQ=1
elif command -v python3 &>/dev/null; then
  USE_JQ=0
  echo "Note: jq not found, using python3 for JSON parsing"
else
  echo "Error: need jq or python3 for JSON parsing"
  exit 1
fi

extract_svg() {
  local json="$1"
  if [[ $USE_JQ -eq 1 ]]; then
    echo "$json" | jq -r '.icon.svg // empty'
  else
    echo "$json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('icon',{}).get('svg','') or '')"
  fi
}

get_lucide_name() {
  local name="$1"
  if [[ -f "$LUCIDE_MAPPING" ]]; then
    if [[ $USE_JQ -eq 1 ]]; then
      jq -r --arg k "$name" '.[$k] // empty' "$LUCIDE_MAPPING" 2>/dev/null || true
    else
      python3 -c "import json; d=json.load(open('$LUCIDE_MAPPING')); print(d.get('$name', ''))" 2>/dev/null || true
    fi
  fi
}

count=0
errors=0

# Get unique semantic names (skip keys starting with _)
if [[ $USE_JQ -eq 1 ]]; then
  names=$(jq -r 'keys[] | select(startswith("_") | not)' "$MAPPING_FILE" | sort -u)
else
  names=$(python3 -c "
import json
with open(\"$MAPPING_FILE\") as f:
    d = json.load(f)
for k in sorted(set(k for k in d if not k.startswith('_') and isinstance(d.get(k), str))):
    print(k)
")
fi

if [[ -n "$ICONS8_API_KEY" ]]; then
  echo "Using Icons8 API (ICONS8_API_KEY set)"
  echo ""

  if [[ $USE_JQ -eq 1 ]]; then
    pairs=$(jq -r 'to_entries[] | select(.key | startswith("_") | not) | select(.value | type == "string") | "\(.key) \(.value)"' "$MAPPING_FILE")
  else
    pairs=$(python3 -c "
import json
with open(\"$MAPPING_FILE\") as f:
    d = json.load(f)
for k, v in d.items():
    if not k.startswith('_') and isinstance(v, str):
        print(k, v)
")
  fi

  while read -r name id; do
    [[ -z "$name" ]] && continue
    [[ -z "$id" ]] && continue

    url="${API_BASE}/${id}?token=${ICONS8_API_KEY}"
    response=$(curl -sS "$url" 2>/dev/null) || true

    if [[ -z "$response" ]]; then
      echo "Failed to fetch $name (id=$id)"
      errors=$((errors + 1))
      continue
    fi

    svg=$(extract_svg "$response")
    if [[ -z "$svg" ]] || [[ "$svg" == "null" ]]; then
      echo "No SVG in response for $name (id=$id)"
      errors=$((errors + 1))
      continue
    fi

    echo "$svg" > "$OUTPUT_DIR/${name}.svg"
    echo "Saved: $name.svg (Icons8)"
    count=$((count + 1))
  done <<< "$pairs"
else
  echo "No ICONS8_API_KEY - downloading Lucide icons (free, no API key needed)"
  echo "Source: lucide.dev (ISC license)"
  echo ""

  # Use fixed list matching generate-icons8-components.js ICON_NAMES
  names="dashboard invoice bank box menu add delete edit refresh camera microphone settings user search close email lock visibility visibility-off check arrow-back receipt document subscription shield tools"

  for name in $names; do
    lucide_name=$(get_lucide_name "$name")
    [[ -z "$lucide_name" ]] && lucide_name="$name"

    url="${LUCIDE_BASE}/${lucide_name}.svg"
    svg=$(curl -sS "$url" 2>/dev/null) || true

    if [[ -z "$svg" ]] || [[ "$svg" == *"404"* ]] || ! echo "$svg" | grep -q "<svg"; then
      echo "Failed to fetch $name (tried $lucide_name)"
      errors=$((errors + 1))
      continue
    fi

    echo "$svg" > "$OUTPUT_DIR/${name}.svg"
    echo "Saved: $name.svg (Lucide)"
    count=$((count + 1))
  done
fi

echo ""
echo "Done: $count icons saved to $OUTPUT_DIR"
[[ $errors -gt 0 ]] && echo "Errors: $errors"
echo ""
echo "Next: cd frontend && npm run icons8:generate"
