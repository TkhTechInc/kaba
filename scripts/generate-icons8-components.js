#!/usr/bin/env node
/**
 * Generates React icon components from shared-icons/svg/*.svg
 * Run after: ./scripts/download-icons8-svg.sh (with ICONS8_API_KEY)
 * Output: frontend/src/assets/icons8/icons.tsx
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SVG_DIR = path.join(PROJECT_ROOT, "shared-icons", "svg");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "frontend", "src", "assets", "icons8", "icons.tsx");

const ICON_NAMES = [
  "dashboard", "invoice", "bank", "box", "menu", "add", "delete", "edit",
  "refresh", "camera", "microphone", "settings", "user", "search", "close",
  "email", "lock", "visibility", "visibility-off", "check", "arrow-back",
  "receipt", "document", "subscription", "shield", "tools"
];

function toPascalCase(str) {
  return str.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}

function extractSvgContent(svgStr) {
  const match = svgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!match) return null;
  let inner = match[1].trim();
  const viewBoxMatch = svgStr.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";
  return { inner, viewBox };
}

function normalizeSvg(inner) {
  return inner
    .replace(/\bstroke="[^"]*"/g, 'stroke="currentColor"')
    .replace(/\bfill="[^"]*"/g, (m) => m.includes("none") ? m : 'fill="currentColor"');
}

let output = `/**
 * Icons8 icon components.
 * Auto-generated from shared-icons/svg/ - run: node scripts/generate-icons8-components.js
 * Icons from Icons8 (icons8.com). Free license requires attribution - add link in About/Settings.
 */

import type { IconProps } from "@/types/icon-props";

const defaultSize = 24;

`;

for (const name of ICON_NAMES) {
  const svgPath = path.join(SVG_DIR, `${name}.svg`);
  const componentName = toPascalCase(name) + "Icon";

  if (!fs.existsSync(svgPath)) {
    output += `// ${name}.svg not found - using placeholder\n`;
    output += `export function ${componentName}(props: IconProps) {\n`;
    output += `  return (\n`;
    output += `    <svg width={defaultSize} height={defaultSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>\n`;
    output += `      <rect x="4" y="4" width="16" height="16" rx="2" />\n`;
    output += `    </svg>\n`;
    output += `  );\n}\n\n`;
    continue;
  }

  const svgStr = fs.readFileSync(svgPath, "utf8");
  const extracted = extractSvgContent(svgStr);
  if (!extracted) {
    output += `// ${name}.svg - failed to parse\n`;
    continue;
  }

  const { inner, viewBox } = extracted;
  const normalized = normalizeSvg(inner);

  output += `export function ${componentName}(props: IconProps) {\n`;
  output += `  return (\n`;
  output += `    <svg width={defaultSize} height={defaultSize} viewBox="${viewBox}" fill="currentColor" stroke="currentColor" aria-hidden {...props}>\n`;
  output += `      ${normalized.replace(/\n/g, "\n      ")}\n`;
  output += `    </svg>\n`;
  output += `  );\n}\n\n`;
}

output += `\n`;

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, output);
console.log(`Generated ${OUTPUT_FILE}`);
console.log(`Icons: ${ICON_NAMES.filter(n => fs.existsSync(path.join(SVG_DIR, `${n}.svg`))).length}/${ICON_NAMES.length} from shared-icons/svg/`);
