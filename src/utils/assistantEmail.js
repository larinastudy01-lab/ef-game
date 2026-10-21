import { supabase } from "../lib/supabaseClient";

export function createAssistantQuestionId() {
  return window.crypto?.randomUUID?.() || `question-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export async function sendAssistantQuestionEmail({ userId, record }, { fetchImpl = window.fetch } = {}) {
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;
  if (error || !session?.access_token || session.user?.id !== userId) {
    throw new Error("登入狀態已變更，未寄送本次問答。請確認原帳號後重試。");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl("/api/assistant-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ...record, sendEmail: true }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || "問答寄送失敗，請稍後重試。");
    if (result?.status !== "accepted" || !result.recipient) throw new Error("尚未確認交寄結果，請重試本次寄送。");
    return result;
  } catch (error) {
    if (error.name === "AbortError" || error instanceof TypeError) {
      throw new Error("暫時無法連線至寄信服務，可重試本次寄送。問答內容不受影響。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
