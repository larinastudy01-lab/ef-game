// Display only. Input precision, scoring, exports and missing source values are retained.
export const DATA_LABELS = Object.freeze({ missing: "未記錄", notApplicable: "不適用", incomplete: "未完成", insufficient: "資料不足", failed: "計算失敗", review: "待人工確認", noResponse: "無有效反應" });
export const missingLabel = (state = "missing") => DATA_LABELS[state] || DATA_LABELS.missing;
export const finiteNumber = (value) => (typeof value === "number" || (typeof value === "string" && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
export function formatNumber(value, digits = 1, state = "missing") {
  const number = finiteNumber(value);
  return number === null ? missingLabel(state) : number.toFixed(digits);
}
export function formatPercentage(value, { scale = "percent", detail = true, state = "missing" } = {}) {
  const number = finiteNumber(value);
  return number === null ? missingLabel(state) : `${(number * (scale === "ratio" ? 100 : 1)).toFixed(detail ? 1 : 0)}%`;
}
export function formatAccuracy(correct, total, { detail = true } = {}) {
  const n = finiteNumber(total), k = finiteNumber(correct);
  return n === null || n <= 0 || k === null ? missingLabel("insufficient") : `${formatPercentage(k / n, { scale: "ratio", detail })}（${k}／${n} 題）`;
}
export function formatReactionTime(value, { detail = true, n, state = "missing" } = {}) {
  const number = finiteNumber(value);
  if (number === null || number < 0) return missingLabel(number !== null ? "failed" : n === 0 ? "noResponse" : state);
  return `${number.toFixed(detail ? 1 : 0)} ms${finiteNumber(n) !== null ? `（n=${n}）` : ""}`;
}
export function formatDateTime(value, { seconds = false, dateOnly = false } = {}) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return missingLabel();
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${p.year}/${p.month}/${p.day}${dateOnly ? "" : ` ${p.hour}:${p.minute}${seconds ? `:${p.second}` : ""}`}`;
}
export function formatDifficulty(value, task) {
  if (value === null || value === undefined || value === "" || value === "-" || value === "default") return missingLabel();
  if (value === "adaptive_span_test") return "適性廣度測驗";
  // Verified against each existing task Protocol training config; unknown tasks keep their source code.
  if (["SRT", "PM", "CBT", "ARI", "DCCS", "LB"].includes(task)) {
    const labels = { beginner: "入門", easy: "簡單", medium: "中等", normal: "中等", hard: "難", expert: "專業" };
    if (labels[value]) return labels[value];
  }
  if (value === "normal") return "normal（原始難度；名稱待確認）";
  return String(value);
}
export function formatMetric(value, unit = "", digits = 1) {
  if (unit.trim() === "%") return formatPercentage(value, { detail: digits !== 0 });
  return finiteNumber(value) === null ? missingLabel() : `${formatNumber(value, digits)}${unit}`;
}
