import assert from "node:assert/strict";
import test from "node:test";
import { ASSISTANT_EMAIL_ROLES, createAssistantEmailHandler } from "./assistant-email.mjs";
import { createClinicalAuthMiddleware } from "./api-security.mjs";

const config = { RESEND_API_KEY: "synthetic-key", ASSISTANT_EMAIL_FROM: "Forest <assistant@example.invalid>" };
const record = {
  sendEmail: true, requestId: "question-synthetic-0001", askedAt: "2026-10-20T10:00:00.000Z",
  question: "請摘要本次表現", answer: "本次正確率為 80%。", sources: [],
};
const request = (body = record, overrides = {}) => ({
  method: "POST", auth: { userId: "synthetic-user-1", role: "guardian" },
  authEmail: "registered@example.invalid", body, ...overrides,
});
function responseRecorder() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
const accepted = async () => ({ ok: true, json: async () => ({ id: "synthetic-email-id" }) });

test("opt-out never contacts the email service, even without service configuration", async () => {
  const res = responseRecorder();
  await createAssistantEmailHandler({ config: {}, fetchImpl: () => assert.fail("must not send") })(request({ sendEmail: false }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "not_requested");
});

test("sending requires an explicit boolean opt-in", async () => {
  const handler = createAssistantEmailHandler({ config, fetchImpl: () => assert.fail("must not send") });
  for (const body of [null, [], {}, { ...record, sendEmail: "true" }, { ...record, sendEmail: 1 }]) {
    const res = responseRecorder();
    await handler(request(body), res);
    assert.equal(res.statusCode, 400);
  }
});

test("a forged frontend recipient is ignored and the email is sent only to the verified account", async () => {
  let sent;
  const res = responseRecorder();
  const handler = createAssistantEmailHandler({ config, fetchImpl: async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    sent = JSON.parse(options.body);
    return accepted();
  } });
  await handler(request({ ...record, to: "other@example.invalid", email: "other@example.invalid", audience: "clinical", html: "<script>evil</script>" }), res);
  assert.deepEqual(sent.to, ["registered@example.invalid"]);
  assert.equal(sent.from, config.ASSISTANT_EMAIL_FROM);
  assert.equal(sent.html, undefined, "untrusted chat text is never rendered as HTML");
  assert.match(sent.subject, /家長端/);
  assert.match(sent.text, /80%/);
  assert.match(sent.text, /18:00:00/);
  assert.equal(res.body.status, "accepted", "provider acceptance must not claim inbox delivery");
});

test("clinical emails include the current question, reply, fallback label and safe sources only", async () => {
  let sent;
  const handler = createAssistantEmailHandler({ config, fetchImpl: async (url, options) => {
    sent = JSON.parse(options.body); return accepted();
  } });
  const res = responseRecorder();
  await handler(request({ ...record, fallback: true, sources: [
    { title: "專業來源", author: "合成作者", year: 2026, page: 3, url: "https://example.invalid/source" },
    { title: "其他來源", url: "javascript:alert(1)" },
  ] }, { auth: { userId: "synthetic-doctor", role: "doctor" } }), res);
  assert.match(sent.subject, /醫療端/);
  for (const value of ["請摘要本次表現", "本次正確率為 80%", "系統備援回覆", "專業來源", "第 3 頁", "https://example.invalid/source"]) assert.ok(sent.text.includes(value));
  assert.doesNotMatch(sent.text, /javascript:/);
});

test("the idempotency key and provider payload remain stable on retry and differ between users", async () => {
  const calls = [];
  const handler = createAssistantEmailHandler({ config, fetchImpl: async (url, options) => { calls.push(options); return accepted(); } });
  await handler(request(), responseRecorder());
  await handler(request(), responseRecorder());
  await handler(request(record, { auth: { userId: "synthetic-user-2", role: "guardian" } }), responseRecorder());
  assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
  assert.equal(calls[0].body, calls[1].body);
  assert.notEqual(calls[0].headers["Idempotency-Key"], calls[2].headers["Idempotency-Key"]);
});

test("unconfigured service reports unavailable instead of pretending to send", async () => {
  const res = responseRecorder();
  await createAssistantEmailHandler({ config: {}, fetchImpl: () => assert.fail("must not send") })(request(), res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /尚未啟用/);
});

test("anonymous users and unknown roles cannot send", async () => {
  const handler = createAssistantEmailHandler({ config, fetchImpl: () => assert.fail("must not send") });
  for (const auth of [undefined, { userId: "x", role: "unapproved" }]) {
    const res = responseRecorder(); await handler(request(record, { auth }), res);
    assert.equal(res.statusCode, 401);
  }
});

test("invalid content, missing email, oversized bodies and bad methods are rejected", async () => {
  const handler = createAssistantEmailHandler({ config, fetchImpl: () => assert.fail("must not send") });
  for (const overrides of [{ question: "" }, { answer: "" }, { question: "x".repeat(8_001) }, { requestId: "bad" }, { askedAt: "not-a-date" }]) {
    const res = responseRecorder(); await handler(request({ ...record, ...overrides }), res);
    assert.equal(res.statusCode, 400);
  }
  for (const authEmail of [null, "", "a@example.invalid\r\nBcc:other@example.invalid"]) {
    const res = responseRecorder(); await handler(request(record, { authEmail }), res);
    assert.equal(res.statusCode, 400);
  }
  const huge = responseRecorder(); await handler(request({ ...record, padding: "x".repeat(150_001) }), huge);
  assert.equal(huge.statusCode, 413);
  const method = responseRecorder(); await handler(request(record, { method: "GET" }), method);
  assert.equal(method.statusCode, 405);
});

test("provider errors, missing IDs and network failures never leak provider secrets or report success", async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, json: async () => ({ message: "synthetic-provider-secret" }) }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => { throw new Error("synthetic-provider-secret"); },
  ]) {
    const res = responseRecorder();
    await createAssistantEmailHandler({ config, fetchImpl })(request(), res);
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(JSON.stringify(res.body), /synthetic-provider-secret/);
  }
});

test("email route authenticates registered email via Supabase and permits parents without expanding the clinical route", async () => {
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { role: "guardian" }, error: null }; } };
  const supabase = {
    auth: { async getUser(token) {
      assert.equal(token, "verified-token");
      return { data: { user: { id: "synthetic-user-1", email: "auth-registered@example.invalid" } }, error: null };
    } }, from() { return query; },
  };
  const req = { headers: { authorization: "Bearer verified-token" }, body: { email: "forged@example.invalid" } };
  let allowed = false;
  await createClinicalAuthMiddleware({ supabase, allowedRoles: ASSISTANT_EMAIL_ROLES })(req, responseRecorder(), () => { allowed = true; });
  assert.equal(allowed, true);
  assert.equal(req.authEmail, "auth-registered@example.invalid");
  const clinicalResponse = responseRecorder();
  await createClinicalAuthMiddleware({ supabase })(req, clinicalResponse, () => assert.fail("clinical route must still reject parents"));
  assert.equal(clinicalResponse.statusCode, 403);
});
