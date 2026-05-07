/**
 * One-off: list referenced assets/ paths that do not exist on disk.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const exts = new Set([".html", ".js", ".json", ".css"]);
const skipDirs = new Set(["node_modules", ".git", "dist"]);

const assetRe = /(["'`])(assets\/[^"'`\s)]+)\1/g;
/** CSS url() with ../ prefix resolved against repo root */
const urlAssetRe = /url\(\s*["']?(\.\.\/assets\/[^)"'\s]+)["']?\s*\)/g;

const missing = new Map();

function recordMissing(clean, fromFile) {
  if (clean.includes("${")) return;
  const diskPath = path.join(root, clean);
  if (!fs.existsSync(diskPath)) {
    if (!missing.has(clean)) missing.set(clean, new Set());
    missing.get(clean).add(fromFile);
  }
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = ent.name;
    if (skipDirs.has(name)) continue;
    const full = path.join(dir, name);
    if (ent.isDirectory()) walk(full);
    else if (exts.has(path.extname(name))) {
      let text;
      try {
        text = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      const rel = path.relative(root, full);
      let m;
      while ((m = assetRe.exec(text))) {
        const raw = m[2];
        const clean = raw.split("#")[0].split("?")[0];
        if (clean.includes("*")) continue;
        recordMissing(clean, rel);
      }
      while ((m = urlAssetRe.exec(text))) {
        const raw = m[1].replace(/^\.\.\//, "");
        const clean = raw.split("#")[0].split("?")[0];
        if (clean.includes("*")) continue;
        recordMissing(clean, rel);
      }
    }
  }
}

walk(root);

const entries = [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log("Missing:", entries.length);
for (const [p, files] of entries) {
  console.log(p, "<=", [...files].join(", "));
}
