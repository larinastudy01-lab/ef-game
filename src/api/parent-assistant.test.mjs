import assert from "node:assert/strict";
import test from "node:test";
import { createParentAssistantHandler, createParentRagHandler } from "./parent-assistant.mjs";
import { createClinicalAuthMiddleware } from "./api-security.mjs";

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function database({ owned = true, failRecords = false } = {}) {
  const filters = [];
  return { filters, from(table) {
    const query = { select() { return this; }, eq(key, value) { filters.push([table, key, value]); return this; }, order() { return this; }, limit() { return this; },
      async maybeSingle() { return { data: owned ? { id: "child-a", birth_date: "2020-01-01", gender: "female", full_name: "must-not-send-name" } : null, error: null }; },
      then(resolve, reject) { return Promise.resolve({ data: [{ id: "result-a", game_id: "DCCS", mode: "test", accuracy: 80, avg_reaction_time: 450, payload: { session: { status: "completed" }, summary: { totalTrials: 10 }, rawResult: { secret: "must-not-send-raw" } } }], error: failRecords ? new Error("private-details") : null }).then(resolve, reject); },
    }; return query;
  } };
}
const request = (body = {}, role = "guardian") => ({ method: "POST", auth: { userId: "parent-a", role }, body: { patientId: "child-a", question: "規則切換能力是什麼？", ...body } });

test("parent RAG checks patient ownership and both result filters before sharing minimal context", async () => {
  const supabase = database(); let sent;
  const res = response();
  await createParentAssistantHandler({ supabase, assistantHandler: async (req, res) => { sent = req.body; return res.status(200).json({ answer: "合成回答" }); } })(request({ resultId: "result-a", context: { patient: { name: "forged-child" } } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(supabase.filters, [["patients", "id", "child-a"], ["patients", "guardian_id", "parent-a"], ["game_results", "patient_id", "child-a"], ["game_results", "guardian_id", "parent-a"]]);
  assert.equal(sent.context.selectedRecord.accuracy, 80);
  assert.equal(sent.context.selectedRecord.avgRt, 450);
  assert.equal(sent.context.selectedRecord.wrong, null);
  assert.match(sent.computedAnalysis.currentResultSource, /雲端/);
  assert.doesNotMatch(JSON.stringify(sent), /must-not-send|forged-child|parent-a|child-a|2020-01-01/);
});

test("foreign children, missing authentication and professional accounts cannot reach parent RAG", async () => {
  for (const [req, owned] of [[request(), false], [{ method: "POST", body: {} }, true], [request({}, "doctor"), true]]) {
    const supabase = database({ owned }); const res = response();
    await createParentAssistantHandler({ supabase, assistantHandler: () => assert.fail("must not retrieve or generate") })(req, res);
    assert.equal(res.statusCode, 403);
    assert.ok(!supabase.filters.some(([table]) => table === "game_results"));
  }
});

test("device results stay labeled unverified and cannot claim another child or overwrite cloud values", async () => {
  const supabase = database(); let sent;
  const handler = createParentAssistantHandler({ supabase, assistantHandler: async (req, res) => { sent = req.body; return res.json({ answer: "合成" }); } });
  await handler(request({ currentResult: { patientId: "child-a", gameKey: "PM", accuracy: 72, full_name: "must-not-send" } }), response());
  assert.equal(sent.context.selectedRecord.accuracy, 72);
  assert.match(sent.computedAnalysis.currentResultSource, /尚未經雲端核對/);
  assert.doesNotMatch(JSON.stringify(sent), /must-not-send/);
  const res = response();
  await handler(request({ currentResult: { patientId: "foreign-child" } }), res);
  assert.equal(res.statusCode, 400);
});

test("data access failures stop generation and never expose database details", async () => {
  const res = response();
  await createParentAssistantHandler({ supabase: database({ failRecords: true }), assistantHandler: () => assert.fail("must not run") })(request(), res);
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(JSON.stringify(res.body), /private-details/);
});

test("verified family profiles are admitted by the family guard while the clinical guard stays restricted", async () => {
  for (const role of ["guardian", "parent"]) {
    const supabase = { auth: { getUser: async () => ({ data: { user: { id: "parent-a" } }, error: null }) }, from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { role }, error: null }) }) };
    let next = false; const req = { headers: { authorization: "Bearer synthetic" } };
    await createClinicalAuthMiddleware({ supabase, allowedRoles: ["guardian", "parent"] })(req, response(), () => { next = true; });
    assert.equal(next, true);
    const res = response();
    await createClinicalAuthMiddleware({ supabase })(req, res, () => assert.fail("clinical route must remain restricted"));
    assert.equal(res.statusCode, 403);
  }
});

test("family handler actually retrieves sources and sends family instructions and context to the model", async () => {
  let prompt; let retrieved;
  const assistantHandler = createParentRagHandler({ isConfigured: () => true,
    modelSettings: () => ({ provider: "ollama" }),
    retrieveKnowledge: async args => { retrieved = args; return [{ id: "source-a", title: "合成研究", content: "規則切換需要注意規則與切換。", similarity: 0.9 }]; },
    createResponse: async args => { prompt = args; return { output_text: "這是規則切換的一般說明。[來源 1]" }; },
  });
  const res = response();
  await createParentAssistantHandler({ supabase: database(), assistantHandler })(request({ resultId: "result-a" }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.ragUsed, true); assert.equal(res.body.provider, "ollama");
  assert.equal(res.body.sources.length, 1); assert.match(res.body.answer, /來源 1/);
  assert.equal(retrieved.context.selectedRecord.gameKey, "DCCS");
  assert.match(prompt.instructions, /家長/); assert.match(prompt.instructions, /不得.*診斷/);
  assert.match(JSON.stringify(prompt.input), /合成研究/);
});

test("unsupported normality claims are rewritten and persistent claims fall back to labeled excerpts", async () => {
  for (const corrected of [true, false]) {
    let calls = 0;
    const handler = createParentRagHandler({ isConfigured: () => true, modelSettings: () => ({ provider: "ollama", retrievalFallback: true }),
      retrieveKnowledge: async () => [{ id: "source-1", title: "合成研究", content: "工作記憶是暫時保留資訊的歷程。", similarity: 0.9 }],
      createResponse: async () => ({ output_text: ++calls === 2 && corrected ? "這次正確率80%，尚無常模，無法判斷是否正常。[來源 1]" : "6歲兒童的表現通常在正常範圍內。" }),
    });
    const res = response();
    await handler({ method: "POST", body: { question: "合成測試" } }, res);
    assert.equal(calls, 2); assert.equal(res.statusCode, 200);
    assert.equal(res.body.responseMode, corrected ? "generated" : "retrieval");
    assert.doesNotMatch(res.body.answer, /通常在正常範圍/);
    if (!corrected) assert.match(res.body.answer, /未由 AI 生成回答/);
  }
});
