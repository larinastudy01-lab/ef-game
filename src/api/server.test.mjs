import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { once } from "node:events";
import test from "node:test";

function startServer(environment) {
  const child = spawn(process.execPath, ["src/api/server.mjs"], {
    env: {
      ...process.env,
      SUPABASE_URL: "http://127.0.0.1:1",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
      OPENAI_API_KEY: "synthetic-model-key",
      ALLOWED_ORIGINS: "http://localhost:3000",
      ...environment,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", data => { stdout += data; });
  child.stderr.on("data", data => { stderr += data; });
  const exited = once(child, "exit");
  return { child, exited, output: () => ({ stdout, stderr }) };
}

async function withOccupiedPort(callback) {
  const server = net.createServer();
  server.listen(0);
  await once(server, "listening");
  try { await callback(server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function waitForPort(running) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const match = running.output().stdout.match(/server running on http:\/\/localhost:(\d+)/);
    if (match) return Number(match[1]);
    if (running.child.exitCode !== null) throw new Error(running.output().stderr);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("API did not become ready");
}

test("API uses CLINICAL_API_PORT when frontend PORT is occupied", { timeout: 20000 }, async () => {
  await withOccupiedPort(async frontendPort => {
    const running = startServer({ PORT: String(frontendPort), CLINICAL_API_PORT: "0" });
    try {
      const port = await waitForPort(running);
      assert.notEqual(port, frontendPort);
      const health = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(await health.text(), "Clinical Assistant API is running.");
      const response = await fetch(`http://127.0.0.1:${port}/api/clinical-assistant`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "synthetic question" }),
      });
      assert.equal(response.status, 401);
      assert.match((await response.json()).error, /登入憑證/);
    } finally {
      running.child.kill();
      await running.exited;
    }
  });
});

test("API retains hosting provider PORT fallback", { timeout: 20000 }, async () => {
  const running = startServer({ PORT: "0", CLINICAL_API_PORT: "" });
  try {
    const port = await waitForPort(running);
    assert.ok(port > 0);
  } finally {
    running.child.kill();
    await running.exited;
  }
});

test("occupied API port exits with failure and never claims to be running", { timeout: 20000 }, async () => {
  await withOccupiedPort(async occupiedPort => {
    const running = startServer({ PORT: "0", CLINICAL_API_PORT: String(occupiedPort) });
    try {
      const [code] = await Promise.race([
        running.exited,
        new Promise((_, reject) => {
          const timer = setTimeout(() => reject(new Error("Occupied port did not fail startup")), 15000);
          timer.unref();
        }),
      ]);
      assert.equal(code, 1);
      assert.match(running.output().stderr, /EADDRINUSE/);
      assert.doesNotMatch(running.output().stdout, /server running/);
    } finally {
      if (running.child.exitCode === null) {
        running.child.kill();
        await running.exited;
      }
    }
  });
});
