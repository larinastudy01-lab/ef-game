import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const buildDirectory = path.resolve("build");
const forbiddenNames = new Set(["knowledge_base", "node_modules", ".cache"]);
const violations = [];

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(buildDirectory, absolutePath);

    if (forbiddenNames.has(entry.name)) {
      violations.push(relativePath);
    }

    if (entry.isDirectory()) {
      await inspect(absolutePath);
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

console.log("Deployment check passed: build/ excludes knowledge_base, node_modules, and .cache.");
