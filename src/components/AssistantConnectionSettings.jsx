import { useState } from "react";
import { needsClinicalApiSetup, readClinicalApiBase, saveClinicalApiBase } from "../utils/clinicalApi";

export function AssistantConnectionSettings({ disabled = false }) {
  const suggestion = new URLSearchParams(window.location.search).get("aiEndpoint");
  const [draft, setDraft] = useState(() => suggestion ?? readClinicalApiBase());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(needsClinicalApiSetup);
  const save = value => {
    try {
      const base = saveClinicalApiBase(value);
      setDraft(base);
      setError("");
      setSetupRequired(needsClinicalApiSetup());
      setStatus(base ? `這個分頁將連線至 ${base}` : needsClinicalApiSetup() ? "" : "已使用網站預設連線。");
    } catch {
      setError("網址不正確。請貼上一鍵啟動所顯示的完整 HTTPS 服務網址。");
    }
  };
  return (
    <details open={suggestion !== null || setupRequired || undefined} style={{ margin: "8px 16px", fontSize: 13 }}>
      <summary>AI 連線設定{setupRequired ? "（尚未連線）" : ""}</summary>
      {setupRequired && <p role="status">請先執行電腦上的 Start-Local-AI.cmd，再貼上啟動視窗顯示的 HTTPS API 網址。</p>}
      <p>使用本機 AI 時，請貼上啟動視窗的服務網址。確認後，此分頁的問題與個案資料將送到該服務。</p>
      <label htmlFor="clinical-api-base">AI 服務網址</label>
      <input id="clinical-api-base" type="url" value={draft} onChange={event => setDraft(event.target.value)} disabled={disabled} placeholder="https://…trycloudflare.com" style={{ display: "block", width: "100%", boxSizing: "border-box", margin: "6px 0", padding: 8 }} />
      <button type="button" disabled={disabled} onClick={() => save(draft)}>確認並使用此服務</button>{" "}
      <button type="button" disabled={disabled} onClick={() => save("")}>使用網站預設</button>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </details>
  );
}
