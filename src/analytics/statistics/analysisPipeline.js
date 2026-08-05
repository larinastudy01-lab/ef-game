import { buildFeatureCorrelationMatrix, buildTaskToTaskCorrelationMatrix } from "./correlations";
import { calculateDescriptiveStatistics, discoverTaskFeatureNames } from "./descriptive";
import { assessRepeatedMeasuresReadiness, calculateLongitudinalChanges, summarizeLongitudinalChanges } from "./longitudinal";
import { benjaminiHochberg } from "./multipleComparison";
import { buildStatisticalExports } from "./reports";
import { STATISTICS_VERSION } from "./version";

const CORRELATION_FEATURES = [
  "accuracy", "rt_mean", "rt_variability_ms", "error_rate",
  "maximum_error_streak", "rt_slope_ms_per_trial", "performance_slope_per_trial",
];

export function analyzeBehavioralStatistics(taskRows = []) {
  const taskCodes = [...new Set(taskRows.map((row) => row.task_code).filter(Boolean))].sort();
  const taskStatistics = taskCodes.flatMap((taskCode) => {
    const rows = taskRows.filter((row) => row.task_code === taskCode);
    return calculateDescriptiveStatistics(rows, discoverTaskFeatureNames(taskRows, taskCode))
      .map((result) => ({ task_code: taskCode, ...result }));
  });
  const availableCorrelationFeatures = CORRELATION_FEATURES.filter((feature) =>
    taskRows.some((row) => row[feature] !== null && row[feature] !== undefined && row[feature] !== "" && Number.isFinite(Number(row[feature])))
  );
  const featureCorrelations = benjaminiHochberg(
    buildFeatureCorrelationMatrix(taskRows, availableCorrelationFeatures)
  );
  const taskCorrelations = ["accuracy", "rt_mean"].flatMap((metric) =>
    benjaminiHochberg(buildTaskToTaskCorrelationMatrix(taskRows, metric))
  );
  const longitudinalChanges = calculateLongitudinalChanges(taskRows);
  const longitudinalSummary = summarizeLongitudinalChanges(longitudinalChanges);
  const analysis = {
    statisticsVersion: STATISTICS_VERSION,
    taskRows,
    taskStatistics,
    featureCorrelations,
    taskCorrelations,
    longitudinalChanges,
    longitudinalSummary,
    repeatedMeasuresReadiness: assessRepeatedMeasuresReadiness(taskRows),
    languageGuardrail: "Describe association, difference, or pattern only. Do not infer causation from observational data.",
  };
  return { ...analysis, exports: buildStatisticalExports(analysis) };
}
