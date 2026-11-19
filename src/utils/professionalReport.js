import { formatMetric as metricText, formatReactionTime } from "./professionalFormatters";
import { PROFESSIONAL_TASKS } from "../config/professionalIndicators";
import { compareRecords, describeRecord, taskHistory } from "./professionalMetrics";

export function buildProfessionalReport({ patientName, demographics = "", records = [], notes = [], reminders = [], formatDate = (v) => v || "未記錄" }) {
  const dates = records.map((r) => r.date).filter(Boolean).sort();
  const lines = [`個案：${patientName}`, demographics, `資料範圍：${dates.length ? `${formatDate(dates[0])} 至 ${formatDate(dates.at(-1))}` : "尚無紀錄"}`, "尚無臨床風險分級", "", "客觀測驗／訓練摘要", `測驗 ${records.filter((r) => r.type === "test").length} 筆；訓練 ${records.filter((r) => r.type === "training").length} 筆（分開解讀）`];
  Object.entries(PROFESSIONAL_TASKS).forEach(([task, definition]) => { const h = taskHistory(records, task); if (!h.latest) { lines.push(`${definition.name}：尚無有效正式測驗`); return; } const d = describeRecord(h.latest); lines.push(`${definition.name}｜${formatDate(h.latest.date)}｜正確 ${d.correct}/${d.total}（${metricText(d.accuracy, "%")}）；正確有效 RT ${formatReactionTime(d.rtMean, { n: d.rtN })}。`); if (h.previous) { const c = compareRecords(h.previous, h.latest); lines.push(`同條件前次 ${formatDate(h.previous.date)}：正確率差 ${metricText(c.change, " 個百分點")}；僅為當次變化。`); } else lines.push("尚無條件完整且一致的前次紀錄，暫不判定趨勢。"); lines.push(`限制：${definition.limitation}`); });
  lines.push("", "資料品質與限制", "缺值不補 0；題次不明或重複來源不納入顯示指標。施測版本、難度、模式及條件組成須一致才比較；不計算跨作業能力總分。", "", "專業人員觀察（人工紀錄）");
  lines.push(...(notes.length ? notes.map((n) => `${formatDate(n.created_at)}｜建立者 ${n.clinician_id || "未記錄"}：${n.note}`) : ["尚無已儲存備註"]));
  lines.push("", "後續追蹤（已建立提醒）", ...(reminders.length ? reminders.map((r) => `${formatDate(r.created_at)}｜${r.title || r.reminder_type}｜${r.status}：${r.message}`) : ["尚無已讀取提醒"]));
  return lines.filter((line) => line !== undefined).join("\n");
}
