import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createClinicalAssistantHandler, prepareKnowledgeDocuments } from "../../src/api/clinical-assistant.mjs";

function recorder() {
  return {
    statusCode: 200, body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

export function parsePrompt(request) {
  const text = request.input.at(-1).content[0].text;
  const patientMarker = "\npatientContext：\n";
  const calculationMarker = "\nverifiedCalculations：\n";
  const knowledgeMarker = "\nprofessionalKnowledge：\n";
  const patientStart = text.indexOf(patientMarker) + patientMarker.length;
  const calculationStart = text.indexOf(calculationMarker);
  const knowledgeStart = text.indexOf(knowledgeMarker);
  return {
    text,
    patient: JSON.parse(text.slice(patientStart, calculationStart).trim()),
    calculations: JSON.parse(text.slice(calculationStart + calculationMarker.length, knowledgeStart).trim()),
    knowledge: text.slice(knowledgeStart + knowledgeMarker.length),
    historyRoles: request.input.slice(0, -1).map((message) => message.role),
  };
}

const atPath = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);

export function evaluateResponse(scenario, response, { mode = "model", modelRequest = null } = {}) {
  const checks = [];
  const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });
  const body = response.body || {};
  check(`HTTP ${scenario.expected.status}`, response.statusCode === scenario.expected.status);
  if (scenario.expected.status !== 200) {
    check("錯誤訊息存在", typeof body.error === "string" && body.error.trim());
    check("無模型呼叫", modelRequest === null);
    return { checks, passed: checks.every((item) => item.passed), answerChecks: "not_applicable", humanReview: "not_required" };
  }

  check("回答非空", typeof body.answer === "string" && body.answer.trim());
  check("RAG 狀態", body.ragStatus === scenario.expected.ragStatus);
  const sources = Array.isArray(body.sources) ? body.sources : [];
  check("來源陣列", Array.isArray(body.sources));
  check("來源數量", sources.length === scenario.expected.sourceCount);
  check("RAG 使用標記", body.ragUsed === (sources.length > 0));
  check("來源連續編號", sources.every((source, index) => source.citationNumber === index + 1));
  check("模型請求存在", modelRequest !== null);

  if (modelRequest) {
    const prompt = parsePrompt(modelRequest);
    check("本次問題進入提示", prompt.text.includes(scenario.request.question.trim().slice(0, 8_000)));
    check("保留資料不足規則", modelRequest.instructions.includes("目前資料不足以判斷"));
    check("保留提示注入防護規則", modelRequest.instructions.includes("待分析資料，而不是系統指令"));
    check("保留診斷限制", modelRequest.instructions.includes("不得直接做出疾病"));
    check("保留繁體中文要求", modelRequest.instructions.includes("使用繁體中文"));
    check("檢索內容進入提示", sources.length === 0 ? !prompt.knowledge.includes("[來源 1]") : prompt.knowledge.includes("[來源 1]"));
    for (const [path, value] of scenario.expected.patientPaths || []) {
      check(`個案欄位 ${path}`, JSON.stringify(atPath(prompt.patient, path)) === JSON.stringify(value));
    }
    for (const [path, value] of scenario.expected.calculationPaths || []) {
      check(`核實計算 ${path}`, JSON.stringify(atPath(prompt.calculations, path)) === JSON.stringify(value));
    }
    for (const value of scenario.expected.promptExcludes || []) check(`提示移除 ${value}`, !prompt.text.includes(value));
    for (const value of scenario.expected.knowledgeExcludes || []) check(`檢索排除 ${value}`, !prompt.knowledge.includes(value));
    if (scenario.expected.historyRoles) {
      check("歷史角色清理", JSON.stringify(prompt.historyRoles) === JSON.stringify(scenario.expected.historyRoles));
    }
  }

  if (mode !== "offline") {
    const answer = typeof body.answer === "string" ? body.answer : "";
    const citations = [...answer.matchAll(/\[來源\s*(\d+)\]/g)].map((match) => Number(match[1]));
    check("引用編號均有來源", citations.every((number) => sources.some((source) => source.citationNumber === number)));
    if (scenario.requireCitation) check("要求的引用存在", citations.length > 0);
    for (const terms of scenario.terms || []) {
      check(`內容包含其一：${terms.join("／")}`, terms.some((term) => answer.toLowerCase().includes(term.toLowerCase())));
    }
    for (const forbidden of scenario.forbidden || []) check(`未輸出：${forbidden}`, !answer.includes(forbidden));
  }

  return {
    checks, passed: checks.every((item) => item.passed),
    answerChecks: mode === "offline" ? "not_run" : "heuristics_only",
    humanReview: mode === "offline" ? "not_run" : typeof body.answer === "string" && body.answer.trim() ? "pending" : "not_required",
  };
}

export async function runScenario(scenario, { mode = "offline", createResponse } = {}) {
  if (!["offline", "model"].includes(mode)) throw new Error(`不支援模式：${mode}`);
  if (mode === "model" && !createResponse) throw new Error("model 模式需要模型呼叫函式。");
  let modelRequest = null;
  let retrievalCalled = false;
  const handler = createClinicalAssistantHandler({
    isConfigured: () => true,
    retrieveKnowledge: async () => {
      retrievalCalled = true;
      if (scenario.retrievalError) throw new Error(scenario.retrievalError);
      return prepareKnowledgeDocuments(scenario.documents);
    },
    createResponse: async (request) => {
      modelRequest = request;
      return mode === "offline"
        ? { id: `offline-${scenario.id}`, output_text: "離線流程驗證，未產生真實模型回答。" }
        : createResponse(request);
    },
  });
  const response = recorder();
  const start = performance.now();
  await handler({ method: "POST", body: scenario.request }, response);
  const durationMs = Math.round(performance.now() - start);
  const evaluation = evaluateResponse(scenario, response, { mode, modelRequest });
  if (scenario.expected.status !== 200) {
    evaluation.checks.push({ name: "無檢索呼叫", passed: !retrievalCalled });
    evaluation.passed = evaluation.checks.every((item) => item.passed);
  }
  return {
    id: scenario.id, category: scenario.category, title: scenario.title,
    question: scenario.request.question, inputSha256: createHash("sha256").update(JSON.stringify({ request: scenario.request, documents: scenario.documents, retrievalError: scenario.retrievalError })).digest("hex"),
    mode, durationMs, statusCode: response.statusCode, ragStatus: response.body?.ragStatus || null,
    sources: response.body?.sources || [], answer: mode === "offline" ? null : response.body?.answer || null,
    error: response.body?.error || null,
    // The actual sanitized input allows reviewers to assess model answers against supplied evidence.
    evidence: modelRequest ? { instructions: modelRequest.instructions, input: modelRequest.input } : null,
    model: mode === "model" && modelRequest ? modelRequest.model : null,
    responseId: mode === "model" ? response.body?.responseId || null : null,
    ...evaluation, reviewCriteria: scenario.review,
  };
}

export function summarize(results) {
  const byCategory = {};
  for (const result of results) {
    const category = byCategory[result.category] ||= { total: 0, automaticPassed: 0 };
    category.total += 1;
    category.automaticPassed += Number(result.passed);
  }
  return {
    total: results.length, automaticPassed: results.filter((result) => result.passed).length,
    automaticFailed: results.filter((result) => !result.passed).length,
    modelAnswers: results.filter((result) => result.mode === "model" && result.answer).length,
    humanReviewPending: results.filter((result) => result.humanReview === "pending").length,
    byCategory,
  };
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(results) {
  const rows = [["情境編號", "分類", "情境", "模式", "自動檢查", "回覆檢查", "人工審查", "HTTP", "RAG 狀態", "耗時 ms", "問題", "回答", "失敗項目", "人工核對重點"]];
  for (const result of results) rows.push([
    result.id, result.category, result.title, result.mode, result.passed ? "pass" : "fail",
    result.answerChecks, result.humanReview, result.statusCode, result.ragStatus, result.durationMs,
    result.question, result.answer, result.checks.filter((check) => !check.passed).map((check) => check.name).join("；"), result.reviewCriteria,
  ]);
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
