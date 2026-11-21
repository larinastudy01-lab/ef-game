import fs from "node:fs";
import { execFileSync } from "node:child_process";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.rag", quiet: true });
if (process.argv.includes("--configure")) {
  const filename = ".env.rag";
  let contents = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
  const settings = { AI_PROVIDER: "ollama", AI_RETRIEVAL_FALLBACK: "true", OLLAMA_MODEL: "qwen3:4b-instruct-2507-q4_K_M", OLLAMA_BASE_URL: "http://127.0.0.1:11434", OLLAMA_CONTEXT_LENGTH: "16384", OLLAMA_TIMEOUT_MS: "180000" };
  for (const [key, value] of Object.entries(settings)) {
    const line = new RegExp(`^${key}=.*$`, "gm");
    contents = line.test(contents) ? contents.replace(line, `${key}=${value}`) : `${contents.trimEnd()}\n${key}=${value}\n`;
  }
  fs.writeFileSync(filename, contents);
}
let siteUrl = process.env.LOCAL_AI_SITE_URL || "";
if (!siteUrl) {
  try {
    const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8", windowsHide: true }).trim();
    const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (match) siteUrl = `https://${match[1].toLowerCase()}.github.io${match[2].toLowerCase() === `${match[1].toLowerCase()}.github.io` ? "" : `/${match[2]}`}`;
  } catch { /* A local checkout does not have to have a remote. */ }
}
const origins = new Set(["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"]);
for (const origin of (process.env.ALLOWED_ORIGINS || "").split(",")) if (origin.trim()) origins.add(new URL(origin.trim()).origin);
if (siteUrl) origins.add(new URL(siteUrl).origin);
console.log(JSON.stringify({ apiPort: Number(process.env.CLINICAL_API_PORT || 3001), siteUrl, allowedOrigins: [...origins].join(",") }));
