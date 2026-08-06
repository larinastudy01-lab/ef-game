import { analyzeDistribution } from "./distributions";

export const DEFAULT_PRIMARY_FEATURES = [
  "accuracy", "rt_mean", "rt_variability_ms", "error_rate",
];

export function calculateDescriptiveStatistics(rows = [], featureNames = DEFAULT_PRIMARY_FEATURES) {
  return featureNames.map((feature) => {
    const values = rows.map((row) => row?.[feature]);
    const distribution = analyzeDistribution(values, rows.length);
    return {
      feature,
      n: distribution.count,
      mean: distribution.mean,
      median: distribution.median,
      sd: distribution.sd,
      iqr: distribution.iqr,
      min: distribution.min,
      max: distribution.max,
      missing_count: distribution.missing_count,
      missing_rate: distribution.missing_rate,
      outlier_count: distribution.outlier_count,
      outlier_rate: distribution.outlier_rate,
      distribution_summary: distribution.distribution_summary,
      histogram: distribution.histogram,
      box_plot: distribution.box_plot,
      skewness: distribution.skewness,
    };
  });
}

export function calculateTaskStatistics(rows = [], featureNames = DEFAULT_PRIMARY_FEATURES) {
  const groups = rows.reduce((map, row) => {
    const task = row?.task_code || "UNKNOWN";
    if (!map.has(task)) map.set(task, []);
    map.get(task).push(row);
    return map;
  }, new Map());
  return [...groups.entries()].flatMap(([taskCode, taskRows]) =>
    calculateDescriptiveStatistics(taskRows, featureNames).map((result) => ({ task_code: taskCode, ...result }))
  );
}

export function discoverTaskFeatureNames(rows = [], taskCode) {
  const prefix = `${String(taskCode || "").toLowerCase()}_`;
  const taskRows = rows.filter((row) => row.task_code === taskCode);
  const discovered = [...new Set(taskRows.flatMap((row) => Object.entries(row)
    .filter(([key, value]) => key.startsWith(prefix) && (typeof value === "number" || value === null))
    .map(([key]) => key)))];
  return [...new Set([...DEFAULT_PRIMARY_FEATURES, ...discovered])];
}
