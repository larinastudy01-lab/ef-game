export const SESSION_EXPIRED_MESSAGE = "登入已失效，請重新登入。尚未上傳的測驗紀錄仍保留在此瀏覽器。";

export function isSessionExpiredError(error) {
  return ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired", "bad_jwt"].includes(error?.code)
    || error?.name === "AuthSessionMissingError"
    || error?.status === 401
    || /invalid refresh token|refresh token.*(not found|already used)|jwt expired/i.test(error?.message || "");
}

export function researchLoadErrorMessage(error) {
  if (isSessionExpiredError(error)) return SESSION_EXPIRED_MESSAGE;
  if (error?.code === "42501" || error?.status === 403) return "目前帳號沒有讀取研究資料的權限，請聯絡管理者確認醫療端授權。";
  if (["42P01", "PGRST200", "PGRST205"].includes(error?.code)) return "研究資料來源尚未完成設定，請聯絡管理者確認資料庫設定。";
  return "研究資料暫時無法載入，請確認網路連線後重試。若持續發生，請聯絡管理者。";
}
