export const STATUS_COLORS = Object.freeze({
  success: { background: "#E2F1E8", color: "#246B49" }, warning: { background: "#FFF1D7", color: "#98640C" },
  error: { background: "#F9E2E1", color: "#AC3633" }, neutral: { background: "#E8EBEF", color: "#52606D" },
});
export function patientDataStatus(records, describe) {
  if (!records.length) return { key: "empty", tone: "neutral", label: "尚無紀錄", text: "可安排初次測驗；尚無臨床風險分級。" };
  const descriptions = records.map(describe);
  if (descriptions.some((d) => d.integrityError)) return { key: "warning", tone: "warning", label: "來源待確認", text: "同一來源鍵可能對應多筆操作，需核對事件與題次關係；原始紀錄保留，不表示能力異常。" };
  if (descriptions.some((d) => d.status.tone !== "success")) return { key: "warning", tone: "warning", label: "待確認", text: "部分完成狀態或題次資料待確認。" };
  return { key: "safe", tone: "success", label: "品質檢查通過", text: "已記錄題次通過顯示層品質檢查；尚無臨床風險分級。" };
}
