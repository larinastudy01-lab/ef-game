import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { RAG_SCENARIOS, SUITE_VERSION } from "./rag/scenarios.mjs";
import { runScenario, summarize, toCsv } from "./rag/evaluate.mjs";

async function main() {
  const { values } = parseArgs({ options: {
    mode: { type: "string", default: "offline" },
    case: { type: "string", multiple: true },
    out: { type: "string", default: "artifacts/rag-evaluation" },
    help: { type: "boolean", default: false },
  } });
  if (values.help) {
    console.log("npm run eval:rag -- [--mode=offline|model] [--case=RAG-01] [--out=artifacts/rag-evaluation]");
    console.log("offline 不連外；model 使用固定合成知識段落與真實模型，會產生 API 費用，不測試向量檢索或 HTTP 權限。");
    return;
  }
  if (!["offline", "model"].includes(values.mode)) throw new Error("--mode 僅支援 offline 或 model。");
  const selected = values.case ? RAG_SCENARIOS.filter((scenario) => values.case.includes(scenario.id)) : RAG_SCENARIOS;
  const unknown = (values.case || []).filter((id) => !RAG_SCENARIOS.some((scenario) => scenario.id === id));
  if (unknown.length) throw new Error(`未知情境：${unknown.join(", ")}`);

  let createResponse;
  if (values.mode === "model") {
    const { default: dotenv } = await import("dotenv");
    dotenv.config({ quiet: true });
    dotenv.config({ path: ".env.rag", quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error("model 模式需要 .env.rag 或環境變數中的 OPENAI_API_KEY。");
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 0 });
    createResponse = (request) => client.responses.create(request);
  }
  await mkdir(path.resolve(values.out), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileBase = path.resolve(values.out, `${stamp}-${values.mode}`);
  const results = [];
  const writeReport = async () => {
    const report = {
      suiteVersion: SUITE_VERSION, generatedAt: new Date().toISOString(), mode: values.mode,
      scope: values.mode === "offline" ? "合成檢索與回覆替身；僅驗證流程，不代表模型回答品質" : "合成檢索段落與真實模型；不含向量檢索、HTTP 或權限驗證",
      complete: results.length === selected.length, planned: selected.length,
      summary: summarize(results), results,
    };
    await writeFile(`${fileBase}.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(`${fileBase}.csv`, toCsv(results), "utf8");
  };
  console.log(`執行 ${selected.length} 種情境；模式：${values.mode}`);
  for (const scenario of selected) {
    const result = await runScenario(scenario, { mode: values.mode, createResponse });
    results.push(result);
    // Save after each case so a failed/interrupted API batch remains reviewable.
    await writeReport();
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id} ${result.title} (${result.durationMs} ms)`);
  }
  const summary = summarize(results);
  console.log(`自動檢查：${summary.automaticPassed}/${summary.total}；真實模型回答：${summary.modelAnswers}；待人工審查：${summary.humanReviewPending}`);
  console.log(`報告：${fileBase}.json\n報告：${fileBase}.csv`);
  if (values.mode === "offline") console.log("離線模式未評估真實模型回答，不可將此通過數當成 RAG 回答正確率。");
  if (summary.automaticFailed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`RAG 評估失敗：${error.message}`);
  process.exitCode = 1;
});
