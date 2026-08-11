import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const buildDirectory = path.resolve("build");
const forbiddenNames = new Set(["knowledge_base", "node_modules", ".cache"]);
const violations = [];
const sourceMaps = [];
const oversizedAssets = [];
const lfsPointers = [];
const maxDeploymentBytes = Number(process.env.MAX_DEPLOYMENT_MIB || 190) * 1024 * 1024;
const maxAssetBytes = Number(process.env.MAX_ASSET_MIB || 24) * 1024 * 1024;
let deploymentBytes = 0;

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(buildDirectory, absolutePath);

    if (forbiddenNames.has(entry.name)) {
      violations.push(relativePath);
    }

    if (entry.isDirectory()) {
      await inspect(absolutePath);
      continue;
    }

    const fileStats = await stat(absolutePath);
    deploymentBytes += fileStats.size;
    if (entry.name.endsWith(".map")) sourceMaps.push(relativePath);
    if (fileStats.size > maxAssetBytes) oversizedAssets.push({ path: relativePath, size: fileStats.size });

    // A Git LFS pointer is a tiny text file, not playable media. Catching it in
    // CI prevents a successful deploy that would later show broken videos.
    if (fileStats.size < 1024 && /\.(mp4|webm|mp3|wav)$/i.test(entry.name)) {
      const content = await readFile(absolutePath, "utf8");
      if (content.startsWith("version https://git-lfs.github.com/spec/v1")) {
        lfsPointers.push(relativePath);
      }
    }
  }
}

try {
  await stat(buildDirectory);
} catch {
  console.error("Deployment check failed: build/ does not exist. Run npm run build first.");
  process.exit(1);
}

await inspect(buildDirectory);

if (violations.length > 0) {
  console.error("Deployment check failed. Forbidden paths found in build/:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

if (sourceMaps.length > 0) {
  console.error(`Deployment check failed: ${sourceMaps.length} source map(s) would be published.`);
  process.exit(1);
}

if (lfsPointers.length > 0) {
  console.error("Deployment check failed: unresolved Git LFS media pointers found:");
  for (const pointer of lfsPointers) console.error(`- ${pointer}`);
  process.exit(1);
}

if (oversizedAssets.length > 0) {
  console.error(`Deployment check failed: assets exceed MAX_ASSET_MIB=${maxAssetBytes / 1024 / 1024}:`);
  for (const asset of oversizedAssets) {
    console.error(`- ${asset.path}: ${(asset.size / 1024 / 1024).toFixed(2)} MiB`);
  }
  process.exit(1);
}

if (deploymentBytes > maxDeploymentBytes) {
  console.error(
    `Deployment check failed: build is ${(deploymentBytes / 1024 / 1024).toFixed(2)} MiB; ` +
    `budget is ${(maxDeploymentBytes / 1024 / 1024).toFixed(2)} MiB.`
  );
  process.exit(1);
}

console.log(
  `Deployment check passed: ${(deploymentBytes / 1024 / 1024).toFixed(2)} MiB, ` +
  `no forbidden paths, source maps, oversized assets, or LFS pointers.`
);
