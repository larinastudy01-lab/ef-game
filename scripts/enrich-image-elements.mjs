import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const parser = require("@babel/parser");
const projectRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(projectRoot, "src");
const publicRoot = resolve(projectRoot, "public");
const imageExtensions = new Set([".webp", ".avif", ".jpg", ".jpeg", ".png"]);

const files = execFileSync("rg", ["--files", "src", "-g", "*.jsx", "-g", "*.js"], {
  cwd: projectRoot,
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);

const dimensionsCache = new Map();

function getDimensions(imagePath) {
  if (dimensionsCache.has(imagePath)) return dimensionsCache.get(imagePath);
  try {
    const output = execFileSync("webpinfo", ["-summary", imagePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const canvas = output.match(/Canvas size (\d+) x (\d+)/);
    const width = Number(canvas?.[1] || output.match(/Width:\s+(\d+)/)?.[1]);
    const height = Number(canvas?.[2] || output.match(/Height:\s+(\d+)/)?.[1]);
    const value = width && height ? { width, height } : null;
    dimensionsCache.set(imagePath, value);
    return value;
  } catch {
    dimensionsCache.set(imagePath, null);
    return null;
  }
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "tokens" || key === "comments") continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value.type === "string") walk(value, visit);
  }
}

let changedFiles = 0;
let sizedImages = 0;
let lazyImages = 0;
let altImages = 0;
let unresolvedImages = 0;
const unresolvedLocations = [];

for (const relativeFile of files) {
  const filePath = resolve(projectRoot, relativeFile);
  const source = readFileSync(filePath, "utf8");
  const ast = parser.parse(source, {
    sourceType: "unambiguous",
    plugins: ["jsx", "classProperties", "optionalChaining", "dynamicImport"],
  });
  const imports = new Map();
  for (const statement of ast.program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const importedPath = statement.source.value;
    if (!imageExtensions.has(extname(importedPath).toLowerCase())) continue;
    const absoluteImagePath = resolve(dirname(filePath), importedPath);
    for (const specifier of statement.specifiers) imports.set(specifier.local.name, absoluteImagePath);
  }

  const edits = [];
  let imageIndex = 0;
  walk(ast.program, (node) => {
    if (node.type !== "JSXOpeningElement" || node.name?.type !== "JSXIdentifier" || node.name.name !== "img") return;
    imageIndex += 1;
    const attributes = new Map(
      node.attributes
        .filter((attribute) => attribute.type === "JSXAttribute" && attribute.name?.name)
        .map((attribute) => [attribute.name.name, attribute]),
    );
    const src = attributes.get("src")?.value;
    let imagePath = null;
    if (src?.type === "JSXExpressionContainer" && src.expression?.type === "Identifier") {
      imagePath = imports.get(src.expression.name) || null;
    } else if (src?.type === "StringLiteral") {
      imagePath = src.value.startsWith("/")
        ? resolve(publicRoot, src.value.slice(1))
        : resolve(dirname(filePath), src.value);
    }

    const additions = [];
    if (!attributes.has("alt")) {
      additions.push('alt=""');
      altImages += 1;
    }
    if (!attributes.has("width") || !attributes.has("height")) {
      const dimensions = imagePath ? getDimensions(imagePath) : null;
      if (dimensions) {
        if (!attributes.has("width")) additions.push(`width={${dimensions.width}}`);
        if (!attributes.has("height")) additions.push(`height={${dimensions.height}}`);
        sizedImages += 1;
      } else {
        unresolvedImages += 1;
        unresolvedLocations.push(`${relativeFile}:${node.loc.start.line}`);
      }
    }

    const tagText = source.slice(node.start, node.end);
    const looksCritical = imageIndex === 1 || /hero|logo|background|intro|start|banner/i.test(tagText);
    if (!attributes.has("loading") && !looksCritical) {
      additions.push('loading="lazy"');
      lazyImages += 1;
    }
    if (additions.length) edits.push({ at: node.name.end, text: ` ${additions.join(" ")}` });
  });

  if (edits.length) {
    let updated = source;
    for (const edit of edits.sort((a, b) => b.at - a.at)) {
      updated = updated.slice(0, edit.at) + edit.text + updated.slice(edit.at);
    }
    writeFileSync(filePath, updated, "utf8");
    changedFiles += 1;
  }
}

console.log(JSON.stringify({ changedFiles, sizedImages, lazyImages, altImages, unresolvedImages, unresolvedLocations }, null, 2));
