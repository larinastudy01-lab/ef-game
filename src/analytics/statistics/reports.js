const stringifyCell = (value) => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function rowsToCsv(rows = []) {
  if (!rows.length) return "";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    columns.map(stringifyCell).join(","),
    ...rows.map((row) => columns.map((column) => stringifyCell(row[column])).join(",")),
  ].join("\n");
}

const summaryRows = (analysis) => [
  { section: "dataset", metric: "task_feature_rows", value: analysis.taskRows?.length || 0 },
  { section: "dataset", metric: "participants", value: new Set((analysis.taskRows || []).map((row) => row.participant_id).filter(Boolean)).size },
  { section: "dataset", metric: "tasks", value: new Set((analysis.taskRows || []).map((row) => row.task_code).filter(Boolean)).size },
  { section: "quality", metric: "excluded_trials", value: (analysis.taskRows || []).reduce((total, row) => total + Number(row.excluded_trial_count || 0), 0) },
  { section: "longitudinal", metric: "change_rows", value: analysis.longitudinalChanges?.length || 0 },
  { section: "guardrail", metric: "interpretation", value: "association/difference/pattern only; no causal claim" },
];

export function buildStatisticalExports(analysis = {}) {
  const correlationRows = [
    ...(analysis.featureCorrelations || []).map((row) => ({ matrix: "feature", ...row })),
    ...(analysis.taskCorrelations || []).map((row) => ({ matrix: "task_to_task", ...row })),
  ];
  return {
    "statistics_summary.csv": rowsToCsv(summaryRows(analysis)),
    "correlations.csv": rowsToCsv(correlationRows),
    "task_statistics.csv": rowsToCsv(analysis.taskStatistics || []),
    "longitudinal_statistics.csv": rowsToCsv([
      ...(analysis.longitudinalChanges || []).map((row) => ({ level: "participant_change", ...row })),
      ...(analysis.longitudinalSummary || []).map((row) => ({ level: "task_summary", ...row })),
    ]),
  };
}

export function downloadCsvExports(exportsByName) {
  if (typeof document === "undefined") return;
  Object.entries(exportsByName).forEach(([fileName, content]) => {
    const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = fileName; anchor.click();
    URL.revokeObjectURL(url);
  });
}

