export const CLINICAL_API_STORAGE_KEY = "efGame.clinicalApiBaseUrl";

export function normalizeClinicalApiBase(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const url = new URL(text);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("請填入 HTTPS 服務網址；本機可使用 http://localhost:3001。網址不應包含路徑、帳密或查詢參數。");
  }
  return url.origin;
}

export function readClinicalApiBase() {
  const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(CLINICAL_API_STORAGE_KEY) : null;
  return normalizeClinicalApiBase(stored ?? process.env.REACT_APP_CLINICAL_API_BASE_URL ?? "");
}

export function needsClinicalApiSetup() {
  return typeof window !== "undefined" && window.location.hostname.endsWith(".github.io") && !readClinicalApiBase();
}

export function saveClinicalApiBase(value) {
  const normalized = normalizeClinicalApiBase(value);
  if (normalized) window.sessionStorage.setItem(CLINICAL_API_STORAGE_KEY, normalized);
  else window.sessionStorage.removeItem(CLINICAL_API_STORAGE_KEY);
  const url = new URL(window.location.href);
  url.searchParams.delete("aiEndpoint");
  window.history.replaceState(window.history.state, "", url);
  return normalized;
}

export function clinicalApiUrl(path) {
  if (!path.startsWith("/api/")) throw new Error("不支援的服務路徑。");
  const base = readClinicalApiBase();
  const suggestion = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("aiEndpoint") : null;
  // A shared URL may suggest an endpoint, but cannot redirect login tokens
  // or clinical records until the user explicitly saves that destination.
  if (suggestion !== null && normalizeClinicalApiBase(suggestion) !== base) {
    throw new Error("請先在 AI 連線設定中確認這次的服務網址。");
  }
  if (needsClinicalApiSetup()) {
    throw new Error("尚未連線至本機 AI。請先展開「AI 連線設定」，貼上 Start-Local-AI.cmd 顯示的 HTTPS API 網址，再按「確認並使用此服務」。");
  }
  return `${base}${path}`;
}
