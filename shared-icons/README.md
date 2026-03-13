# Shared Icons

Semantic icon mapping and SVG assets for the Kaba project.

## Downloading Icons (No API Key Needed)

```bash
# From project root - downloads Lucide icons directly (free, no signup)
./scripts/download-icons8-svg.sh
```

Icons are saved to `shared-icons/svg/{name}.svg`. The script fetches from [Lucide Icons](https://lucide.dev) (ISC license) when no Icons8 API key is set.

## Icons8 API (Optional)

For Icons8-branded icons instead of Lucide:

1. Get an API key at [Icons8 API Keys](https://developers.icons8.com/api-keys)
2. Run: `ICONS8_API_KEY="your_key" ./scripts/download-icons8-svg.sh`

## Generate frontend components

After downloading SVGs, generate React components for the web frontend:

```bash
cd frontend && npm run icons8:generate
# or from project root:
node scripts/generate-icons8-components.js
```

This overwrites `frontend/src/assets/icons8/icons.tsx` with components built from the SVG files.

## Structure

- `icon-mapping.json` – Maps semantic names to Icons8 icon IDs (used when API key is set)
- `lucide-mapping.json` – Maps semantic names to Lucide icon names (used when no API key)
- `svg/` – Downloaded SVG files (one per semantic name)

## Attribution

- **Lucide** (default): [lucide.dev](https://lucide.dev) – ISC license
- **Icons8** (with API key): [icons8.com](https://icons8.com) – check their [license](https://icons8.com/license) for attribution requirements
