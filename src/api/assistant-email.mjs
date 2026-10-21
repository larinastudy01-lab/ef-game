import { createHash } from "node:crypto";

export const ASSISTANT_EMAIL_ROLES = ["guardian", "parent", "clinician", "medical", "doctor"];
const CLINICAL_ROLES = new Set(["clinician", "medical", "doctor"]);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const cleanText = (value) => typeof value === "string" ? value.replaceAll("\u0000", "").trim() : "";

function normalizeRecord(body) {
  const question = cleanText(body.question);
  const answer = cleanText(body.answer);
  const requestId = cleanText(body.requestId);
  const askedAt = cleanText(body.askedAt);
  if (!question || question.length > 8_000 || !answer || answer.length > 25_000) {
    throw new Error("問答內容不完整或超過可寄送長度。");
  }
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) throw new Error("問答紀錄編號不正確。");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(askedAt) || !Number.isFinite(Date.parse(askedAt))) {
    throw new Error("問答時間格式不正確。");
  }
  const sources = (Array.isArray(body.sources) ? body.sources : []).slice(0, 6).filter(isObject).map((source, index) => {
    let url = "";
    try {
      const parsed = new URL(cleanText(source.url));
      if (["http:", "https:"].includes(parsed.protocol)) url = parsed.href.slice(0, 2_000);
    } catch { /* A missing or invalid link is not included in the email. */ }
    return {
      number: index + 1, title: cleanText(source.title).slice(0, 500) || "未命名資料來源",
      author: cleanText(source.author).slice(0, 500),
      year: Number.isInteger(source.year) ? source.year : null,
      page: Number.isInteger(source.page) ? source.page : null,
      url,
    };
  });
  return { question, answer, requestId, askedAt, sources, fallback: body.fallback === true };
}

export function buildAssistantEmail({ record, role }) {
  const audience = CLINICAL_ROLES.has(role) ? "醫療端" : "家長端";
  const time = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date(record.askedAt));
  const sources = record.sources.map((source) => [
    `[來源 ${source.number}] ${source.title}`,
    [source.author, source.year, source.page !== null ? `第 ${source.page} 頁` : ""].filter(Boolean).join("・"),
    source.url,
  ].filter(Boolean).join("\n"));
  return {
    subject: `執行功能森林遊戲｜${audience}小助手問答紀錄`,
    text: [
      "AI 小助手問答紀錄", `使用介面：${audience}`, `詢問時間：${time}（台灣時間）`,
      `紀錄編號：${record.requestId}`, "", "您的問題", record.question, "", "小助手回覆", record.answer,
      ...(record.fallback ? ["", "本次為系統備援回覆。"] : []),
      ...(sources.length ? ["", "本次提供的資料來源", sources.join("\n\n")] : []),
      "", "此信依您本次詢問的寄送選擇寄至登入帳號的註冊信箱。下一次詢問可重新選擇。",
      "本信為問答紀錄副本，供您留存；AI 回覆不取代專業評估。",
    ].join("\n"),
  };
}

export function createAssistantEmailHandler({ fetchImpl = globalThis.fetch, config = process.env } = {}) {
  return async function assistantEmailHandler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "僅支援 POST 請求。" });
    }
    // authEmail is attached by the server's verified-user middleware, never from the body.
    if (!req.auth?.userId || !ASSISTANT_EMAIL_ROLES.includes(req.auth.role)) {
      return res.status(401).json({ error: "請先登入可使用小助手的帳號。" });
    }
    const body = req.body;
    if (!isObject(body) || typeof body.sendEmail !== "boolean") {
      return res.status(400).json({ error: "請明確選擇是否寄送本次問答。" });
    }
    if (!body.sendEmail) return res.status(200).json({ status: "not_requested" });
    const recipient = cleanText(req.authEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || /[\r\n]/.test(recipient)) {
      return res.status(400).json({ error: "登入帳號沒有可用的註冊信箱，請先確認帳號資料。" });
    }
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > 150_000) {
      return res.status(413).json({ error: "問答紀錄過大，無法寄送。" });
    }
    let record;
    try { record = normalizeRecord(body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    if (!cleanText(config.RESEND_API_KEY) || !cleanText(config.ASSISTANT_EMAIL_FROM)) {
      return res.status(503).json({ error: "管理員尚未啟用問答寄信服務，本次問答仍保留在聊天室。" });
    }

    const email = buildAssistantEmail({ record, role: req.auth.role });
    // Stable for retries, scoped to the verified account. No recipient supplied by the client is used.
    const idempotencyKey = createHash("sha256").update(`${req.auth.userId}:${record.requestId}`).digest("hex");
    try {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json",
          "Idempotency-Key": `assistant-${idempotencyKey}`,
        },
        body: JSON.stringify({ from: config.ASSISTANT_EMAIL_FROM, to: [recipient], ...email }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.id !== "string" || !result.id.trim()) {
        return res.status(502).json({ error: "寄信服務未接受本次寄送，請稍後重試。問答內容不受影響。" });
      }
      return res.status(200).json({ status: "accepted", recipient, messageId: result.id });
    } catch {
      return res.status(502).json({ error: "暫時無法確認交寄結果，可重試本次寄送。問答內容不受影響。" });
    }
  };
}
