import { useEffect, useState } from "react";
import { getResultSyncState, RESULT_SYNC_EVENT, retryResultStorage, startResultSync } from "../utils/resultSync";

export default function ResultSyncStatus() {
  const [state, setState] = useState(getResultSyncState);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const refresh = () => setState(getResultSyncState());
    window.addEventListener(RESULT_SYNC_EVENT, refresh);
    const stop = startResultSync();
    return () => { stop(); window.removeEventListener(RESULT_SYNC_EVENT, refresh); };
  }, []);
  if (!state.storageError && !state.pending) return null;
  const storageReason = state.storageErrorKind === "quota" ? "此網站的瀏覽器儲存空間已滿。"
    : state.storageErrorKind === "denied" ? "瀏覽器目前不允許此網站儲存資料。" : "請重試，若持續發生請聯絡管理者。";
  const storageMessage = state.storageErrorSource?.startsWith("cache:")
    ? "測驗原始紀錄已保留，部分本機顯示快取尚未更新。"
    : state.storageErrorSource === "mirrors"
      ? "本機資料尚未完成帳號切換，暫時無法顯示結果。"
      : "本機儲存尚未完成，測驗紀錄可能無法保留。";
  const retry = async () => {
    setRetrying(true);
    try { setState(await retryResultStorage()); }
    finally { setRetrying(false); }
  };
  const message = state.storageError
    ? storageMessage + storageReason
    : !state.online
      ? `已保留 ${state.pending} 筆紀錄，連線後自動上傳`
      : !state.signedIn
        ? `已保留 ${state.pending} 筆紀錄，登入家長帳號後自動上傳`
      : state.syncing
        ? `正在上傳 ${state.pending} 筆紀錄…`
        : `本機有 ${state.pending} 筆紀錄待上傳，系統會自動重試`;
  return <div role={state.storageError ? "alert" : "status"} style={{
    position: "fixed", bottom: 12, left: 12, zIndex: 10000, maxWidth: "min(420px, calc(100vw - 24px))",
    padding: "8px 12px", borderRadius: 12, background: state.storageError ? "#fff1f0" : "#fff9e8",
    color: state.storageError ? "#a12622" : "#61431b", boxShadow: "0 2px 10px #0002", fontSize: 14,
  }}>{message}{state.pending > 0 || state.storageError ? "請勿清除瀏覽器資料，以免遺失尚未上傳的紀錄。" : ""}
    {state.storageError && <button type="button" onClick={retry} disabled={retrying}
      style={{ display: "block", marginTop: 8, padding: "4px 10px", cursor: "pointer" }}>{retrying ? "正在重試…" : "重試儲存"}</button>}
  </div>;
}
