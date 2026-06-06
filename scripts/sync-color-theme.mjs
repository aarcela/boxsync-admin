/**
 * Writes lib/constants/pits-theme.css from colorTokens.js.
 * Run: npm run sync:theme (also runs before dev/build)
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { toPitsThemeCssVars } = require("../lib/constants/colorTokens.js");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "lib/constants/pits-theme.css");

const css = `/* AUTO-GENERATED — do not edit. Run: npm run sync:theme */
@theme {
${toPitsThemeCssVars()}
}
`;

writeFileSync(outPath, css, "utf8");
console.log(`Synced ${outPath}`);
