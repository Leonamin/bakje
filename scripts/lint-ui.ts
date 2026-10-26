/**
 * Fails when app code hand-rolls an interactive control. Buttons go through
 * Button/IconButton, link-shaped CTAs through `gc-button`, and the few
 * exceptions opt in with a class: chip, press or media-tile.
 *
 *   pnpm lint:ui
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = /\b(chip|press|media-tile|gc-button|linkClass)\b/;
const bad: string[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (path.includes("components/goodcase")) continue;
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".tsx")) scan(path);
  }
}

function scan(path: string) {
  const src = readFileSync(path, "utf8");
  for (const m of src.matchAll(/<button\b[^>]*>/g)) {
    // Tag attributes may span lines and contain `>` inside arrow bodies; the class is always on the tag's opening lines.
    const tail = src.slice(m.index, m.index + 600).split(/>\s*\n/)[0];
    if (!ALLOWED.test(tail)) bad.push(`${path}:${src.slice(0, m.index).split("\n").length}  <button> without Button/IconButton`);
  }
  for (const m of src.matchAll(/<a\b[^>]*>/g)) {
    if (/bg-\[var\(--accent\)\]/.test(m[0])) bad.push(`${path}:${src.slice(0, m.index).split("\n").length}  accent <a>, use gc-button`);
  }
}

walk("src");
if (bad.length) {
  console.error(bad.join("\n"));
  process.exit(1);
}
console.log("ui lint ok");
