import { buildTaskFeatureRow } from "../../analytics/features";
import { finiteNumber } from "../../utils/professionalFormatters";
import { researchTaskLabel } from "../../utils/professionalLabels";
import { MetricCard, ResearchDataTable, StatusIndicator } from "./ResearchStudioUI";

export function ResearchQualityPanel({ inputs = [], issues = [], excludedCount = 0 }) {
  const rows = inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata }));
  const classification = (row) => {
    const a = finiteNumber(row.accuracy), rt = finiteNumber(row.rt_mean), n = finiteNumber(row.analysis_trial_count);
    if ((a !== null && (a < 0 || a > 1)) || (rt !== null && rt < 0)) return "error";
    if (n === null || n <= 0) return "neutral";
    return row.session_completion_status === "completed" && a !== null && rt !== null ? "success" : "warning";
  };
  const classified = rows.map((row) => ({ ...row, tone: classification(row) }));
  const passed = classified.filter((r) => r.tone === "success").length;
  const pending = classified.filter((r) => r.tone === "warning").length + issues.length;
  const checked = rows.length + issues.length;
  const excluded = rows.length && rows.every((r) => finiteNumber(r.excluded_trial_count) !== null) ? rows.reduce((n, r) => n + Number(r.excluded_trial_count), 0) : null;
  const affected = new Set([...classified.filter((r) => r.tone !== "success").map((r) => r.task_code), ...issues.map((i) => i.gameId)].filter(Boolean));
  const grouped = new Map();
  issues.forEach((issue) => {
    const key = `${issue.gameId}:${issue.mode}:${issue.code}`;
    const group = grouped.get(key) || { key, task: issue.gameId, mode: issue.mode, type: issue.code === "DUPLICATE_SOURCE_KEY" ? "同一題次來源鍵對應多筆操作" : "題次來源校驗待確認", tone: "warning", entries: [] };
    group.entries.push(issue); grouped.set(key, group);
  });
  classified.filter((r) => r.tone !== "success").forEach((row) => {
    const key = `${row.task_code}:${row.assessment_or_training}:${row.tone}`;
    const group = grouped.get(key) || { key, task: row.task_code, mode: row.assessment_or_training, tone: row.tone, type: row.tone === "error" ? "數值不符合指標範圍" : row.tone === "neutral" ? "無足夠有效題次" : "未完成或核心欄位缺漏", entries: [] };
    group.entries.push({ resultId: row.task_session_id || row.session_id, message: `完成狀態：${row.session_completion_status || "未記錄"}；有效題次：${row.analysis_trial_count ?? "未記錄"}` }); grouped.set(key, group);
  });
  return <><p>範圍：本次載入全部現行任務紀錄（不隨頁面個案篩選縮減）；原始資料全數保留。檢查的是資料品質，不表示幼兒能力。</p>
    <div className="studio-kpi-grid"><MetricCard label="本次檢查紀錄" value={checked} detail={`${rows.length} 筆可讀＋${issues.length} 筆隔離紀錄`}/><MetricCard label="通過紀錄" value={`${passed}／${checked}`} detail="已完成、有效題次及核心欄位可用"/><MetricCard label="待確認紀錄" value={`${pending}／${checked}`} detail="人工查核或補核對完成狀態"/><MetricCard label="排除分析 Trial" value={excluded === null ? "未完整記錄" : excluded} detail={`僅 ${rows.length} 筆可讀紀錄的來源排除標記；隔離 ${issues.length} 筆的題次數未知`}/><MetricCard label="受影響任務" value={`${affected.size}／6`} detail="本次載入的六項現行任務"/></div>
    <ResearchDataTable title="待檢查的歷史紀錄" rows={[...grouped.values()]} getKey={(r) => r.key} columns={[
      { key: "task", label: "遊戲", render: (r) => researchTaskLabel(r.task) }, { key: "mode", label: "模式", render: (r) => r.mode === "training" ? "訓練" : ["assessment", "test"].includes(r.mode) ? "測驗" : "未記錄" }, { key: "type", label: "問題類型" }, { key: "count", label: "影響紀錄", numeric: true, render: (r) => `${r.entries.length}／${checked}` },
      { key: "status", label: "處理狀態", render: (r) => <StatusIndicator tone={r.tone}>{r.tone === "error" ? "確認錯誤（範圍）" : r.tone === "neutral" ? "資料不足" : "待人工確認"}</StatusIndicator> },
      { key: "details", label: "詳細", render: (r) => <details><summary>查看詳細</summary><p>影響：{r.entries.some((i) => i.code) ? "整筆紀錄暫未納入研究特徵、統計、AI 與縱向分析；不能計算可信任的題次正確率、RT 或規則指標。既有計分未改動，是否受影響仍待人工核對。" : "缺漏或未完成的指標不納入趨勢與模型對應數值；其他可用資料依既有分析流程處理。"}</p><p>原始資料保留，未刪除、補零、改鍵或重算正式分數。</p><p>{r.task === "LB" && r.entries.some((i) => i.code === "DUPLICATE_SOURCE_KEY") ? "舊 LB 訓練來源鍵來自 level.id 與 stepIndex 的計畫步驟，不一定是一筆操作事件；新版正式題次另以 stageId 與 stepIndex 組鍵。舊紀錄可能在同一步驟留下多次合法操作；需對照 plannedSteps、操作時間、事件類型、stageRecords 與原始計分，確認重試、事件合併或真正重複後再決定處理方式。目前不能逕認為重複試次。" : "人工需核對來源題次、完成狀態、缺漏欄位與排除原因；數值錯誤的判定僅針對來源範圍，不涉及認知能力。"}</p><details><summary>來源識別碼與技術資訊</summary>{r.entries.map((i, index) => <div key={index}><code>{i.resultId || "識別碼未記錄"}</code><p>{i.message}</p></div>)}</details></details> },
    ]}/>
    <details className="studio-advanced"><summary>分類、缺漏與既有排除原因</summary><p>通過：綠；待人工確認：黃；已確認不合法的數值範圍：紅；無足夠資料：灰。資料不足 {classified.filter((r) => r.tone === "neutral").length}／{checked}；確認數值錯誤 {classified.filter((r) => r.tone === "error").length}／{checked}。來源鍵重複尚未證實為重複操作，列黃色待確認。</p><h3>缺失欄位</h3><dl>{["accuracy", "rt_mean", "rt_variability_ms"].map((key) => <div key={key}><dt>{key} 未記錄</dt><dd>{rows.filter((r) => finiteNumber(r[key]) === null).length}／{rows.length} 筆可讀紀錄</dd></div>)}</dl><dl>{Object.entries(rows.reduce((counts, row) => { Object.entries(row.exclusion_reason_counts || {}).forEach(([reason, count]) => { if (finiteNumber(count) !== null) counts[reason] = (counts[reason] || 0) + Number(count); }); return counts; }, {})).map(([reason, n]) => <div key={reason}><dt>{reason}</dt><dd>{n} 次標記（同題次可有多個原因，勿相加為總題數）</dd></div>)}</dl><p>非現行任務 {excludedCount} 筆：另屬任務範圍排除，不列入上方本次現行任務分母。通過此摘要檢查不代表所有研究假設均成立。</p></details>
  </>;
}
