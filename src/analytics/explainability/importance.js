import { classificationMetrics, regressionMetrics } from "../ml/metrics";
import { seededRandom } from "../ml/random";
import { fitPreprocessor, transformRows } from "../ml/preprocessing";
import { groupKFold, stratifiedGroupKFold } from "../ml/splitting";
import { trainByModelName } from "./modelSelection";

const predict = (model, row, targetType) => targetType === "classification" && model.predictProbability
  ? model.predictProbability(row.x) : model.predict(row.x);

function loss(model, rows, targetType) {
  const actual = rows.map((row) => row.y); const predicted = rows.map((row) => model.predict(row.x));
  if (targetType === "classification") return 1 - classificationMetrics(actual, predicted, rows.map((row) => predict(model, row, targetType))).balanced_accuracy;
  return regressionMetrics(actual, predicted).rmse;
}

function shuffleFeature(rows, featureIndex, seed) {
  const result = rows.map((row) => ({ ...row, x: [...row.x] })); const random = seededRandom(seed);
  const values = result.map((row) => row.x[featureIndex]);
  for (let index = values.length - 1; index > 0; index -= 1) { const swap = Math.floor(random() * (index + 1)); [values[index], values[swap]] = [values[swap], values[index]]; }
  result.forEach((row, index) => { row.x[featureIndex] = values[index]; }); return result;
}

/** Held-out permutation importance. Positive values mean performance worsened after shuffling. */
export function permutationImportance(model, rows, featureNames, targetType, seed = 20260730) {
  const baseline = loss(model, rows, targetType);
  const values = featureNames.map((feature, index) => ({ feature,
    importance: loss(model, shuffleFeature(rows, index, seed + index), targetType) - baseline,
    method: "held_out_permutation_importance" }));
  const total = values.reduce((sum, item) => sum + Math.max(0, item.importance), 0);
  return values.map((item) => ({ ...item, normalized_importance: total ? Math.max(0, item.importance) / total : 0 }))
    .sort((a, b) => b.importance - a.importance);
}

export function linearGlobalImportance(model, featureNames) {
  const total = model.weights.reduce((sum, value) => sum + Math.abs(value), 0);
  return featureNames.map((feature, index) => ({ feature, importance: Math.abs(model.weights[index]),
    direction: Math.sign(model.weights[index]), normalized_importance: total ? Math.abs(model.weights[index]) / total : 0,
    method: "standardized_linear_coefficient" })).sort((a, b) => b.importance - a.importance);
}

export function globalImportance(artifact) {
  return artifact.model.weights
    ? linearGlobalImportance(artifact.model, artifact.preprocessor.feature_names)
    : permutationImportance(artifact.model, artifact.test, artifact.preprocessor.feature_names, artifact.targetType, artifact.seed);
}

function rankMap(items) { return new Map([...items].sort((a, b) => b.importance - a.importance).map((item, index) => [item.feature, index + 1])); }
const average = (values) => values.reduce((a, b) => a + b, 0) / values.length;

export function importanceStability(artifact, folds = 5) {
  const split = artifact.targetType === "classification"
    ? stratifiedGroupKFold(artifact.holdout.development, folds, artifact.seed)
    : groupKFold(artifact.holdout.development, folds, artifact.seed);
  const foldImportances = split.map((fold, foldIndex) => {
    const preprocessor = fitPreprocessor(fold.train); const training = transformRows(fold.train, preprocessor); const validation = transformRows(fold.test, preprocessor);
    const model = trainByModelName(artifact.model.name, training, artifact.targetType, artifact.seed + foldIndex, artifact.model.parameters);
    const items = model.weights ? linearGlobalImportance(model, preprocessor.feature_names)
      : permutationImportance(model, validation, preprocessor.feature_names, artifact.targetType, artifact.seed + foldIndex);
    return { fold: foldIndex + 1, items, ranks: rankMap(items) };
  });
  const features = artifact.preprocessor.feature_names;
  const summary = features.map((feature) => {
    const ranks = foldImportances.map((fold) => fold.ranks.get(feature) || features.length);
    const importances = foldImportances.map((fold) => fold.items.find((item) => item.feature === feature)?.importance || 0);
    const meanImportance = average(importances); const sd = Math.sqrt(average(importances.map((value) => (value - meanImportance) ** 2)));
    return { feature, mean_rank: average(ranks), rank_range: Math.max(...ranks) - Math.min(...ranks),
      importance_cv: meanImportance === 0 ? null : Math.abs(sd / meanImportance), stable: Math.max(...ranks) - Math.min(...ranks) <= 2 };
  }).sort((a, b) => a.mean_rank - b.mean_rank);
  const top = summary.slice(0, Math.min(10, summary.length)); const stableRate = top.length ? top.filter((item) => item.stable).length / top.length : null;
  return { folds: foldImportances.map(({ fold, items }) => ({ fold, importance: items })), summary,
    top_feature_stability_rate: stableRate, stability_label: stableRate === null ? "not_available" : stableRate >= 0.7 ? "stable" : stableRate >= 0.4 ? "mixed" : "unstable",
    disclosure: stableRate !== null && stableRate < 0.7 ? "Feature importance differs across participant folds; interpret rankings cautiously." : "Top feature rankings are reasonably consistent across participant folds." };
}

