import { analyzeDistribution } from "./distributions";
import { mean, pearsonCorrelation } from "../features/math";
import { twoSidedTTestP } from "./inferenceMath";

function ranks(values) {
  const indexed = values.map((value, index) => ({ value: Number(value), index }))
    .sort((a, b) => a.value - b.value);
  const result = Array(values.length);
  for (let start = 0; start < indexed.length;) {
    let end = start + 1;
    while (end < indexed.length && indexed[end].value === indexed[start].value) end += 1;
    const averageRank = mean(Array.from({ length: end - start }, (_, offset) => start + offset + 1));
    for (let index = start; index < end; index += 1) result[indexed[index].index] = averageRank;
    start = end;
  }
  return result;
}

export function spearmanCorrelation(left = [], right = []) {
  const pairs = left.map((value, index) => [value, right[index]])
    .filter(([x, y]) => x !== null && x !== undefined && x !== "" && y !== null && y !== undefined && y !== "")
    .map(([x, y]) => [Number(x), Number(y)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) return null;
  return pearsonCorrelation(ranks(pairs.map(([x]) => x)), ranks(pairs.map(([, y]) => y)));
}

export function chooseCorrelationMethod(left, right, requested = "auto") {
  if (requested === "pearson" || requested === "spearman") {
    return { method: requested, reason: `Method explicitly requested: ${requested}.` };
  }
  const leftDistribution = analyzeDistribution(left);
  const rightDistribution = analyzeDistribution(right);
  const suitableForPearson = leftDistribution.count >= 10 && rightDistribution.count >= 10
    && Math.abs(leftDistribution.skewness ?? Infinity) < 1
    && Math.abs(rightDistribution.skewness ?? Infinity) < 1
    && (leftDistribution.outlier_rate ?? 1) <= 0.05
    && (rightDistribution.outlier_rate ?? 1) <= 0.05;
  return suitableForPearson
    ? { method: "pearson", reason: "Both variables had at least 10 paired observations, relatively symmetric distributions, and no substantial Tukey-outlier rate." }
    : { method: "spearman", reason: "Spearman was selected because normality was not assumed or sample/distribution conditions were insufficient for Pearson." };
}

export function calculateCorrelation(left, right, options = {}) {
  const pairs = left.map((value, index) => [value, right[index]])
    .filter(([x, y]) => x !== null && x !== undefined && x !== "" && y !== null && y !== undefined && y !== "")
    .map(([x, y]) => [Number(x), Number(y)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const x = pairs.map(([value]) => value);
  const y = pairs.map(([, value]) => value);
  const selection = chooseCorrelationMethod(x, y, options.method);
  const coefficient = selection.method === "pearson" ? pearsonCorrelation(x, y) : spearmanCorrelation(x, y);
  const tStatistic = pairs.length > 2 && Number.isFinite(coefficient) && Math.abs(coefficient) < 1
    ? coefficient * Math.sqrt((pairs.length - 2) / (1 - coefficient ** 2))
    : null;
  return {
    n: pairs.length,
    method: selection.method,
    method_reason: selection.reason,
    coefficient,
    p_value: tStatistic === null ? null : twoSidedTTestP(tStatistic, pairs.length - 2),
    p_value_method: tStatistic === null ? null : `${selection.method} correlation t approximation`,
    interpretation: pairs.length < 3
      ? "Insufficient data to describe an association pattern."
      : "Coefficient describes an association pattern and does not establish causation.",
  };
}

export function buildFeatureCorrelationMatrix(rows = [], featureNames = []) {
  return featureNames.flatMap((leftFeature, leftIndex) =>
    featureNames.slice(leftIndex).map((rightFeature) => ({
      left_feature: leftFeature,
      right_feature: rightFeature,
      ...calculateCorrelation(rows.map((row) => row[leftFeature]), rows.map((row) => row[rightFeature])),
    }))
  );
}

export function buildTaskToTaskCorrelationMatrix(rows = [], metric = "accuracy") {
  const taskCodes = [...new Set(rows.map((row) => row.task_code).filter(Boolean))].sort();
  const byUnit = rows.reduce((map, row) => {
    const unit = `${row.participant_id}::${row.session_id}`;
    map.set(unit, { ...(map.get(unit) || {}), [row.task_code]: row[metric] });
    return map;
  }, new Map());
  const units = [...byUnit.values()];
  return taskCodes.flatMap((leftTask, leftIndex) =>
    taskCodes.slice(leftIndex).map((rightTask) => ({
      left_task: leftTask,
      right_task: rightTask,
      metric,
      ...calculateCorrelation(units.map((unit) => unit[leftTask]), units.map((unit) => unit[rightTask])),
    }))
  );
}
