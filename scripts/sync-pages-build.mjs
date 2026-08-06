import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const projectRoot = process.cwd();
const buildDirectory = resolve(projectRoot, "build");
const pagesDirectory = resolve(projectRoot, "site");

const relativePagesDirectory = relative(projectRoot, pagesDirectory);
if (!relativePagesDirectory || relativePagesDirectory.startsWith("..") || isAbsolute(relativePagesDirectory)) {
  throw new Error("Refusing to replace a Pages directory outside the project.");
}

await access(resolve(buildDirectory, "index.html"));
await rm(pagesDirectory, { recursive: true, force: true });
await mkdir(pagesDirectory, { recursive: true });
await cp(buildDirectory, pagesDirectory, { recursive: true });
await cp(resolve(pagesDirectory, "index.html"), resolve(pagesDirectory, "404.html"));
await writeFile(resolve(pagesDirectory, ".nojekyll"), "");

console.log(`Synced ${buildDirectory} to ${pagesDirectory}`);
