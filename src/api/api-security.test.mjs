import assert from "node:assert/strict";
import test from "node:test";
import {
  createClinicalAuthMiddleware,
  createRateLimiter,
  extractBearerToken,
  parseAllowedOrigins,
} from "./api-security.mjs";

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("extracts only Bearer tokens", () => {
  assert.equal(extractBearerToken("Bearer abc.def"), "abc.def");
  assert.equal(extractBearerToken("Basic abc"), null);
});

test("requires explicit production origin allowlist", () => {
  assert.throws(() => parseAllowedOrigins("", { nodeEnv: "production" }), /ALLOWED_ORIGINS/);
  assert.deepEqual([...parseAllowedOrigins("https://a.test/, https://b.test")], [
    "https://a.test", "https://b.test",
  ]);
});

test("allows a verified clinical profile", async () => {
  const query = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: { role: "doctor" }, error: null }; },
  };
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: "user-1" } }, error: null }; } },
    from() { return query; },
  };
  const middleware = createClinicalAuthMiddleware({ supabase });
  const req = { headers: { authorization: "Bearer valid-token" } };
  const res = responseRecorder();
  let proceeded = false;
  await middleware(req, res, () => { proceeded = true; });
  assert.equal(proceeded, true);
  assert.deepEqual(req.auth, { userId: "user-1", role: "doctor" });
});

test("rejects an authenticated non-clinical profile", async () => {
  const query = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: { role: "guardian" }, error: null }; },
  };
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: "user-2" } }, error: null }; } },
    from() { return query; },
  };
  const res = responseRecorder();
  await createClinicalAuthMiddleware({ supabase })(
    { headers: { authorization: "Bearer valid-token" } }, res, () => assert.fail("must reject"),
  );
  assert.equal(res.statusCode, 403);
});

test("rate limiter is keyed by authenticated user", () => {
  let time = 1_000;
  const limiter = createRateLimiter({ max: 2, windowMs: 10_000, now: () => time });
  const req = { auth: { userId: "user-1" } };
  const first = responseRecorder();
  const second = responseRecorder();
  const third = responseRecorder();
  limiter(req, first, () => {});
  limiter(req, second, () => {});
  limiter(req, third, () => assert.fail("must be limited"));
  assert.equal(third.statusCode, 429);
  time = 11_001;
  const reset = responseRecorder();
  let proceeded = false;
  limiter(req, reset, () => { proceeded = true; });
  assert.equal(proceeded, true);
});
