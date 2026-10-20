// Presentation only: these helpers never infer a clinical diagnosis or threshold.
export const isResearchNumber = (value) =>
  (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value));

export const researchNumber = (value, digits = 3) => isResearchNumber(value) ? Number(value).toFixed(digits) : "—";
export const researchPercent = (value) => isResearchNumber(value) ? `${(Number(value) * 100).toFixed(1)}%` : "—";
export const researchDate = (value) => value && Number.isFinite(new Date(value).getTime())
  ? new Date(value).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" }) : "—";
export const researchMean = (values) => { const valid = values.filter(isResearchNumber).map(Number); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; };

export const RESEARCH_METRICS = {
  accuracy: { label: "正確率", unit: "%", format: researchPercent },
  error_rate: { label: "錯誤率", unit: "%", format: researchPercent },
  rt_mean: { label: "平均反應時間（RT）", unit: "ms", format: (value) => researchNumber(value, 1) },
  rt_variability_ms: { label: "反應時間變異", unit: "ms", format: (value) => researchNumber(value, 1) },
};

const timestamp = (row) => new Date(row.session_started_at || row.started_at || row.completed_at || 0).getTime() || 0;
export const orderResearchRows = (rows) => [...rows].sort((a, b) => timestamp(a) - timestamp(b));
export const validMetric = (value, metric) => isResearchNumber(value) && Number(value) >= 0
  && (!["accuracy", "error_rate"].includes(metric) || Number(value) <= 1);

/** Compare the latest task only with the same participant, mode and difficulty. */
export function buildResearchTaskContext(rows = [], taskCode) {
  const taskRows = orderResearchRows(rows.filter((row) => row.task_code === taskCode));
  const latest = taskRows.at(-1);
  if (!latest) return { rows: [], latest: null, metrics: [] };
  const comparable = taskRows.filter((row) => row.participant_id === latest.participant_id
    && row.assessment_or_training === latest.assessment_or_training && String(row.difficulty ?? "") === String(latest.difficulty ?? ""));
  const cleaned = comparable.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
    RESEARCH_METRICS[key] && (!validMetric(value, key) || (row.session_completion_status && row.session_completion_status !== "completed")) ? null : value])));
  const metrics = ["accuracy", "rt_mean", "rt_variability_ms"].map((metric) => {
    const observations = cleaned.filter((row) => validMetric(row[metric], metric));
    const baseline = observations[0];
    const latestValue = validMetric(cleaned.at(-1)?.[metric], metric) ? Number(cleaned.at(-1)[metric]) : null;
    const baselineValue = baseline ? Number(baseline[metric]) : null;
    return { metric, baseline_value: baselineValue, baseline_date: baseline?.session_started_at || baseline?.started_at,
      latest_value: latestValue, observation_count: observations.length,
      absolute_change: observations.length >= 2 && latestValue !== null ? latestValue - baselineValue : null };
  });
  return { rows: cleaned, latest, metrics };
}

export function buildResearchQualityAlerts(rows = []) {
  if (!rows.length) return [{ id: "no-observations", severity: "info", title: "尚無觀察資料", message: "目前範圍沒有可分析的場次，無法評估資料品質或判讀趨勢。" }];
  const invalid = rows.filter((row) => Object.keys(RESEARCH_METRICS).some((metric) => isResearchNumber(row[metric]) && !validMetric(row[metric], metric)));
  const missing = rows.filter((row) => !isResearchNumber(row.accuracy) || !isResearchNumber(row.rt_mean));
  const incomplete = rows.filter((row) => row.session_completion_status && row.session_completion_status !== "completed");
  return [
    invalid.length && { id: "invalid-values", severity: "warning", title: "數值範圍待核對", message: `${invalid.length} 筆場次包含超出 0–100% 的比率或負反應時間；趨勢圖會保留缺口。此為資料品質提示。` },
    missing.length && { id: "missing-values", severity: "info", title: "資料缺漏", message: `${missing.length} 筆場次缺少正確率或反應時間；缺失值顯示「—」，不以 0 取代。` },
    incomplete.length && { id: "incomplete-sessions", severity: "info", title: "場次未完成", message: `${incomplete.length} 筆場次尚未完成；個人趨勢比較不採用其指標。` },
  ].filter(Boolean);
}
