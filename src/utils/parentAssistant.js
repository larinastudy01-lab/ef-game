import { supabase } from "../lib/supabaseClient";
import { clinicalApiUrl } from "./clinicalApi";

// Send only numeric task results, never raw trials, names, dates of birth or pictures.
export function buildParentResultSnapshot(raw = {}, gameKey, patientId) {
  const payload = raw.payload || raw;
  const summary = payload.summary || {};
  const metrics = payload.metrics || {};
  const session = payload.session || {};
  const numeric = value => (typeof value === "number" || typeof value === "string") && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  return {
    patientId, gameKey,
    mode: raw.mode || session.mode || null,
    date: raw.finished_at || raw.finishedAt || session.finishedAt || raw.createdAt || null,
    completionStatus: session.status || raw.status || null,
    accuracy: numeric(raw.accuracy ?? summary.accuracy),
    avgRt: numeric(raw.avg_reaction_time ?? raw.avgReactionTime ?? raw.averageReactionTime ?? metrics.avgReactionTime ?? summary.avgReactionTime),
    total: numeric(raw.total_trials ?? raw.totalTrials ?? summary.totalTrials),
    correct: numeric(raw.correct_count ?? raw.correctCount ?? summary.correctCount),
    wrong: numeric(raw.error_count ?? raw.errorCount ?? summary.errorCount),
    difficulty: typeof (raw.difficulty ?? session.difficulty) === "number" ? raw.difficulty ?? session.difficulty : String(raw.difficulty ?? session.difficulty ?? "").slice(0, 40) || null,
    score: numeric(raw.score ?? summary.score), stars: numeric(raw.stars ?? summary.stars),
    errorTypes: Object.fromEntries(["miss", "timeout", "randomClick", "repeatedClick", "ruleSwitchError", "sequenceError"].map(key => [key, numeric((raw.errorTypes || metrics.errorTypes || {})[key])]).filter(([, value]) => value !== null)),
  };
}

export async function askParentAssistant(request, { signal, fetchImpl = window.fetch, expectedUserId } = {}) {
  const url = clinicalApiUrl("/api/parent-assistant");
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;
  if (error || !session?.access_token || (expectedUserId && session.user?.id !== expectedUserId)) throw new Error("登入狀態已變更，請重新登入家長帳號。");
  const response = await fetchImpl(url, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(request),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "目前無法使用家長 AI，請確認本機服務已啟動及連線設定正確。");
  const current = await supabase.auth.getSession();
  if (current.error || current.data?.session?.user?.id !== session.user?.id) throw new Error("登入狀態已變更，請重新登入家長帳號。");
  if (!result?.answer?.trim()) throw new Error("AI 尚未回傳有效回答，請稍後重試。");
  return {
    ...result, sources: (Array.isArray(result.sources) ? result.sources : []).slice(0, 6).map((source, index) => {
      let url = "";
      try { const parsed = new URL(source.url); if (["https:", "http:"].includes(parsed.protocol)) url = parsed.href; } catch { /* A source can lack a public link. */ }
      return { ...source, citationNumber: index + 1, url };
    }),
  };
}
