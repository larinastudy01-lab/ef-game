import assert from "node:assert/strict";
import test from "node:test";
import { createClinicalAssistantHandler, prepareKnowledgeDocuments, resolveRagFilters } from "../../src/api/clinical-assistant.mjs";
import { knowledge, RAG_SCENARIOS } from "./scenarios.mjs";
import { evaluateResponse, runScenario, summarize, toCsv } from "./evaluate.mjs";

const find = (id) => RAG_SCENARIOS.find((scenario) => scenario.id === id);

test("dashboard Chinese ability labels resolve to the knowledge importer's exact keys", () => {
  const expected = {
    SRT: "reaction_time_processing_speed", PM: "visual_working_memory",
    CBT: "sequence_spatial_working_memory", ARI: "selective_attention_response_inhibition",
    DCCS: "cognitive_flexibility_task_switching", LB: "rule_sequence_planning",
  };
  for (const [gameKey, ability] of Object.entries(expected)) {
    const record = { gameKey, ability: "畫面顯示的中文能力標籤" };
    for (const context of [{ selectedRecord: record }, { latestRecord: record }, { comparison: { first: record } }]) {
      assert.deepEqual(resolveRagFilters(context), { gameKey, ability });
    }
  }
  assert.deepEqual(resolveRagFilters({ selectedRecord: { gameKey: "COMMON", ability: "一般文獻" } }), { gameKey: "COMMON", ability: null });
  assert.deepEqual(resolveRagFilters({}), { gameKey: null, ability: null });
});

test("suite contains 50 unique, ordered scenarios covering all six tasks", () => {
  assert.equal(RAG_SCENARIOS.length, 50);
  assert.deepEqual(RAG_SCENARIOS.map((scenario) => scenario.id), Array.from({ length: 50 }, (_, index) => `RAG-${String(index + 1).padStart(2, "0")}`));
  assert.deepEqual(RAG_SCENARIOS.slice(0, 6).map((scenario) => scenario.request.context.selectedRecord.gameKey), ["SRT", "PM", "CBT", "ARI", "DCCS", "LB"]);
});

for (const scenario of RAG_SCENARIOS) {
  test(`offline ${scenario.id}: ${scenario.title}`, async () => {
    const result = await runScenario(scenario);
    assert.deepEqual(result.checks.filter((check) => !check.passed), []);
    assert.equal(result.passed, true);
    assert.equal(result.answer, null, "a stub must never be reported as a real model answer");
    assert.notEqual(result.humanReview, "pending");
    assert.equal(summarize([result]).modelAnswers, 0);
  });
}

test("model mode checks an answer against supplied evidence and still requires human review", async () => {
  const result = await runScenario(find("RAG-31"), {
    mode: "model",
    createResponse: async () => ({ id: "synthetic-response", output_text: "DCCS 觀察規則切換與認知彈性。[來源 1]" }),
  });
  assert.equal(result.passed, true);
  assert.equal(result.answerChecks, "heuristics_only");
  assert.equal(result.humanReview, "pending");
  assert.equal(summarize([result]).humanReviewPending, 1);
  assert.match(result.evidence.input.at(-1).content[0].text, /合成測試資料/);
});

test("invented citations fail even when answer keywords are present", async () => {
  const result = await runScenario(find("RAG-31"), {
    mode: "model", createResponse: async () => ({ output_text: "規則切換。[來源 99]" }),
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((check) => check.name === "引用編號均有來源").passed, false);
});

test("required citation cannot be replaced by a plausible uncited answer", async () => {
  const result = await runScenario(find("RAG-31"), {
    mode: "model", createResponse: async () => ({ output_text: "DCCS 可觀察規則切換。" }),
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((check) => check.name === "要求的引用存在").passed, false);
});

test("zero retrieval matches prohibit fabricated numbered citations", async () => {
  const result = await runScenario(find("RAG-35"), {
    mode: "model", createResponse: async () => ({ output_text: "個案正確率 80%。[來源 1]" }),
  });
  assert.equal(result.passed, false);
  assert.equal(result.ragStatus, "no_match");
});

test("injection canaries and incorrect numeric answers fail automatic checks", async () => {
  const result = await runScenario(find("RAG-45"), {
    mode: "model", createResponse: async () => ({ output_text: "RECORD_OVERRIDE，正確率 100%。" }),
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.filter((check) => !check.passed).length, 2);
});

test("a wrong HTTP status never passes as an expected validation failure", () => {
  const result = evaluateResponse(find("RAG-49"), { statusCode: 401, body: { error: "unauthorized" } });
  assert.equal(result.passed, false);
});

test("empty model output fails rather than counting as a successful simulation", async (context) => {
  context.mock.method(console, "error", () => {});
  const result = await runScenario(find("RAG-31"), { mode: "model", createResponse: async () => ({ output_text: "" }) });
  assert.equal(result.passed, false);
  assert.equal(result.statusCode, 502);
  assert.equal(summarize([result]).modelAnswers, 0);
});

for (const status of [401, 429, 503]) {
  test(`model service error ${status} is a failure, with no raw error in the report`, async (context) => {
    context.mock.method(console, "error", () => {});
    const result = await runScenario(find("RAG-31"), {
      mode: "model", createResponse: async () => { throw Object.assign(new Error("SYNTHETIC_SECRET"), { status }); },
    });
    assert.equal(result.passed, false);
    assert.equal(result.statusCode, status);
    assert.doesNotMatch(result.error, /SYNTHETIC_SECRET/);
  });
}

for (const code of ["credit_balance_exhausted", "insufficient_quota"]) {
  test(`quota error ${code} explains that API credit must be restored`, async (context) => {
    context.mock.method(console, "error", () => {});
    const result = await runScenario(find("RAG-31"), {
      mode: "model",
      createResponse: async () => { throw Object.assign(new Error("SYNTHETIC_SECRET"), { status: 429, code }); },
    });
    assert.equal(result.statusCode, 429);
    assert.match(result.error, /額度不足/);
    assert.doesNotMatch(result.error, /SYNTHETIC_SECRET|請求過多/);
  });
}

test("rate limiting continues to suggest retrying instead of billing changes", async (context) => {
  context.mock.method(console, "error", () => {});
  const result = await runScenario(find("RAG-31"), {
    mode: "model",
    createResponse: async () => { throw Object.assign(new Error("SYNTHETIC_SECRET"), { status: 429, code: "rate_limit_exceeded" }); },
  });
  assert.equal(result.statusCode, 429);
  assert.match(result.error, /請求過多/);
  assert.doesNotMatch(result.error, /SYNTHETIC_SECRET|額度不足/);
});

test("missing configuration returns the existing safe API error without calling dependencies", async (context) => {
  context.mock.method(console, "error", () => {});
  let code;
  let body;
  const handler = createClinicalAssistantHandler({
    isConfigured: () => false,
    retrieveKnowledge: () => assert.fail("must not retrieve"),
    createResponse: () => assert.fail("must not generate"),
  });
  await handler({ method: "POST", body: find("RAG-31").request }, {
    status(value) { code = value; return this; }, json(value) { body = value; return this; },
  });
  assert.equal(code, 500);
  assert.match(body.error, /尚未設定/);
});

test("retrieval removes empty, duplicate and low similarity passages and sorts/caps six sources", () => {
  const documents = Array.from({ length: 9 }, (_, index) => knowledge("DCCS", {
    id: `synthetic-${index}`, title: `Synthetic ${index}`, similarity: 0.5 + index * 0.04,
  }));
  const prepared = prepareKnowledgeDocuments([null, {}, knowledge("DCCS", { similarity: 0.1 }), ...documents, documents[8]]);
  assert.equal(prepared.length, 6);
  assert.equal(prepared[0].id, "synthetic-8");
  assert.equal(prepared.at(-1).id, "synthetic-3");
  assert.equal(prepared[0].year, null, "an absent publication year must not become year zero");
  assert.deepEqual(prepareKnowledgeDocuments(null), []);
});

test("null and blank numeric values stay missing while actual zero stays zero", async () => {
  const base = find("RAG-20");
  for (const value of [null, undefined, "", "   "]) {
    const scenario = { ...base, request: { ...base.request, context: { selectedRecord: { ...base.request.context.selectedRecord, avgRt: value } } } };
    const result = await runScenario(scenario);
    assert.equal(result.passed, true);
  }
  const zero = find("RAG-21");
  assert.equal((await runScenario(zero)).passed, true);
});

test("CSV preserves Chinese, multiline quotes and treats formula-like values as text", async () => {
  const result = await runScenario(find("RAG-31"));
  const csv = toCsv([{ ...result, question: '=SUM(1,2)\n"quoted"' }]);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /情境編號/);
  assert.ok(csv.includes('"\'=SUM(1,2)\n""quoted"""'));
});

test("unknown modes and model mode without a response client are rejected", async () => {
  await assert.rejects(runScenario(find("RAG-31"), { mode: "unknown" }), /不支援/);
  await assert.rejects(runScenario(find("RAG-31"), { mode: "model" }), /模型呼叫/);
});
