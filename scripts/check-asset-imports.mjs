import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve("src");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".css"]);
const assetExtensions = new Set([
  ".avif", ".gif", ".jpeg", ".jpg", ".mp3", ".mp4", ".ogg",
  ".png", ".svg", ".ttf", ".wav", ".webm", ".webp", ".woff", ".woff2",
]);
const missing = [];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
  }
  return files;
}

function referencesFrom(source) {
  const references = [];
  const patterns = [
    /(?:import|from)\s*(?:[^"']*?\sfrom\s*)?["']([^"']+)["']/g,
    /url\(\s*["']?([^"')]+)["']?\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) references.push(match[1]);
  }
  return references;
}

for (const file of await walk(sourceRoot)) {
  const source = await readFile(file, "utf8");
  for (const reference of referencesFrom(source)) {
    if (!reference.startsWith(".")) continue;
    const cleanReference = reference.split(/[?#]/, 1)[0];
    if (!assetExtensions.has(path.extname(cleanReference).toLowerCase())) continue;
    const target = path.resolve(path.dirname(file), cleanReference);
    try {
      await access(target);
    } catch {
      missing.push(`${path.relative(process.cwd(), file)} -> ${reference}`);
    }
  }
}

if (missing.length) {
  console.error("Asset import check failed. Missing files:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Asset import check passed.");
