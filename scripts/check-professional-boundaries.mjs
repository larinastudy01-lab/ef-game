import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const root = process.cwd();
const baselinePath = resolve(root, "docs/professional-protected-baseline.json");
async function files(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? files(`${directory}/${entry.name}`) : `${directory}/${entry.name}`))).flat();
}
const protectedFiles = [...await files("src/analytics"), ...await files("supabase"), ...await files("src/config"),
  ...(await files("src/pages")).filter((path) => /\/(TestPage_|TrainingPage_)/.test(path)),
  ...(await files("src/utils")).filter((path) => /(?:Protocol|protocol|Scoring|scoring|Level|level)/.test(path))]
  .filter((path) => !/\.test\./.test(path)).sort();
const hashes = Object.fromEntries(await Promise.all(protectedFiles.map(async (path) =>
  [path, createHash("sha256").update(await readFile(resolve(root, path))).digest("hex")])));
if (process.argv.includes("--record")) {
  await writeFile(baselinePath, JSON.stringify({ scope: "Existing workspace before professional presentation refactor", hashes }, null, 2) + "\n");
  console.log(`Recorded ${protectedFiles.length} protected files in ${relative(root, baselinePath)}.`);
} else {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const changed = Object.keys(baseline.hashes).filter((path) => hashes[path] !== baseline.hashes[path]);
  if (changed.length) { console.error(JSON.stringify({ changed }, null, 2)); process.exitCode = 1; }
  else console.log(`Verified ${Object.keys(baseline.hashes).length} protected files unchanged.`);
  const additional = JSON.parse(await readFile(resolve(root, "docs/professional-v2.1-preservation-baseline.json"), "utf8"));
  const additionalChanged = (await Promise.all(Object.entries(additional).map(async ([path, hash]) =>
    createHash("sha256").update(await readFile(resolve(root, path))).digest("hex") === hash ? null : path))).filter(Boolean);
  if (additionalChanged.length) { console.error(JSON.stringify({ additionalChanged }, null, 2)); process.exitCode = 1; }
  else console.log(`Verified ${Object.keys(additional).length} additional V2.1 metric, export, data and permission files unchanged.`);
}
