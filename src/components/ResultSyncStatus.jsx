import { useEffect, useState } from "react";
import { getResultSyncState, RESULT_SYNC_EVENT, startResultSync } from "../utils/resultSync";

export default function ResultSyncStatus() {
  const [state, setState] = useState(getResultSyncState);
  useEffect(() => {
    const refresh = () => setState(getResultSyncState());
    window.addEventListener(RESULT_SYNC_EVENT, refresh);
    const stop = startResultSync();
    return () => { stop(); window.removeEventListener(RESULT_SYNC_EVENT, refresh); };
  }, []);
  if (!state.storageError && !state.pending) return null;
  const message = state.storageError
    ? "本機儲存失敗，測驗紀錄可能無法保留。請確認瀏覽器允許儲存且空間足夠。"
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
  }}>{message}</div>;
}
