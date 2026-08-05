import { groupKFold, participantHoldout, stratifiedGroupKFold } from "./splitting";
import { fitPreprocessor, transformRows } from "./preprocessing";
import { trainDecisionTree, trainLinearRegression, trainLogisticRegression, trainRandomForest } from "./models";
import { classificationMetrics, regressionMetrics, classDistribution } from "./metrics";
import { createExperimentRecord, experimentTable } from "./experimentTracking";
import { DEFAULT_SEED, MIN_REAL_PARTICIPANTS } from "./version";

const averageMetrics = (metrics) => {
  const result = Object.fromEntries(Object.keys(metrics[0] || {}).filter((key) => typeof metrics[0][key] === "number")
    .map((key) => [key, metrics.map((item) => item[key]).filter(Number.isFinite).reduce((a, b, _, values) => a + b / values.length, 0)]));
  const matrices = metrics.map((item) => item.confusion_matrix).filter(Boolean);
  if (matrices.length) result.confusion_matrix = matrices.reduce((total, matrix) => ({
    tn: total.tn + matrix.tn, fp: total.fp + matrix.fp, fn: total.fn + matrix.fn, tp: total.tp + matrix.tp,
  }), { tn: 0, fp: 0, fn: 0, tp: 0 });
  result.fold_metrics = metrics;
  return result;
};

function balancedWeights(rows) {
  const counts = classDistribution(rows); const total = rows.length; const classes = Object.keys(counts).length;
  return Object.fromEntries(Object.entries(counts).map(([label, count]) => [label, total / (classes * count)]));
}

function trainers(targetType, includeComparison, rows, seed) {
  const baseline = targetType === "classification"
    ? [
      (foldRows) => trainLogisticRegression(foldRows),
      (foldRows) => trainLogisticRegression(foldRows, { class_weight: balancedWeights(foldRows) }),
      (foldRows) => trainDecisionTree(foldRows, "classification"),
    ] : [
      (foldRows) => trainLinearRegression(foldRows),
      (foldRows) => trainDecisionTree(foldRows, "regression"),
    ];
  if (includeComparison && new Set(rows.map((row) => row.participant_id)).size >= 30) {
    baseline.push((foldRows) => trainRandomForest(foldRows, targetType, {}, seed));
  }
  return baseline;
}

/** Imputation/scaling/variance selection are fitted independently inside each training fold. */
export function runMlExperiment(rows = [], { targetType = "regression", folds = 5, seed = DEFAULT_SEED,
  featureVersion = "features_v1", datasetVersion, includeComparison = true, demoMode = false, codeVersion = null } = {}) {
  if (!rows.length) throw new Error("No ML rows are available.");
  if (rows.some((row) => !row.participant_id)) throw new Error("Every row requires anonymous participant_id.");
  if (targetType === "classification" && new Set(rows.map((row) => row.target)).size < 2) throw new Error("Classification requires at least two outcome classes.");
  const participantCount = new Set(rows.map((row) => row.participant_id)).size;
  const dataSufficiency = { participant_count: participantCount, minimum_recommended: MIN_REAL_PARTICIPANTS,
    sufficient_for_research_interpretation: !demoMode && participantCount >= MIN_REAL_PARTICIPANTS };
  const splitMethod = targetType === "classification" ? "StratifiedGroupKFold" : "GroupKFold";
  const holdout = participantHoldout(rows, 0.2, seed);
  const groupedFolds = targetType === "classification" ? stratifiedGroupKFold(holdout.development, folds, seed) : groupKFold(holdout.development, folds, seed);
  const records = trainers(targetType, includeComparison, rows, seed).map((train) => {
    const started = Date.now(); let representativeModel = null;
    const foldMetrics = groupedFolds.map((fold) => {
      const preprocessor = fitPreprocessor(fold.train, { scale: true, varianceThreshold: 0 });
      if (!preprocessor.feature_names.length) throw new Error("No non-constant features remain in this training fold.");
      const training = transformRows(fold.train, preprocessor); const testing = transformRows(fold.test, preprocessor);
      const model = train(training); representativeModel = model;
      const predictions = testing.map((row) => model.predict(row.x));
      if (targetType === "classification") return classificationMetrics(testing.map((row) => row.y), predictions,
        testing.map((row) => model.predictProbability ? model.predictProbability(row.x) : model.predict(row.x)));
      return regressionMetrics(testing.map((row) => row.y), predictions);
    });
    const validationMetrics = averageMetrics(foldMetrics);
    const finalPreprocessor = fitPreprocessor(holdout.development, { scale: true, varianceThreshold: 0 });
    const finalModel = train(transformRows(holdout.development, finalPreprocessor));
    const untouchedTest = transformRows(holdout.test, finalPreprocessor);
    const finalPredictions = untouchedTest.map((row) => finalModel.predict(row.x));
    const testMetrics = targetType === "classification"
      ? classificationMetrics(untouchedTest.map((row) => row.y), finalPredictions,
        untouchedTest.map((row) => finalModel.predictProbability ? finalModel.predictProbability(row.x) : finalModel.predict(row.x)))
      : regressionMetrics(untouchedTest.map((row) => row.y), finalPredictions);
    const metrics = { ...testMetrics, validation_cv: validationMetrics };
    return createExperimentRecord({ rows, model: representativeModel, targetType, featureVersion, datasetVersion, seed,
      splitMethod: `ParticipantHoldout + ${splitMethod}`, folds: groupedFolds, holdout, metrics,
      trainingTimeMs: Date.now() - started, demoMode, codeVersion });
  });
  return { data_mode: demoMode ? "DEMO / SYNTHETIC DATA" : "OBSERVED RESEARCH DATA", data_sufficiency: dataSufficiency,
    split_method: `ParticipantHoldout + ${splitMethod}`, class_distribution: targetType === "classification" ? classDistribution(rows) : null,
    experiments: records, experiment_table: experimentTable(records),
    skipped_models: ["XGBoost", "SVM", "KNN", "MLP"].map((model) => ({ model, reason: "Not enabled in ml_pipeline_v1; requires dependency review, tuning design, and sufficient participants." })),
    interpretation_guardrail: demoMode ? "DEMO / SYNTHETIC DATA — pipeline validation only; not a research result."
      : "Behavioral performance prediction research prototype; not clinical diagnosis or causal evidence." };
}
