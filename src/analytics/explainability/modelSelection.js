import { runMlExperiment } from "../ml/pipeline";
import { participantHoldout } from "../ml/splitting";
import { fitPreprocessor, transformRows } from "../ml/preprocessing";
import { trainDecisionTree, trainLinearRegression, trainLogisticRegression, trainRandomForest } from "../ml/models";
import { DEFAULT_SEED } from "../ml/version";

export function validationScore(experiment, targetType) {
  const validation = experiment.metrics?.validation_cv || {};
  if (targetType === "classification") return Number.isFinite(validation.roc_auc) ? validation.roc_auc : validation.balanced_accuracy;
  return Number.isFinite(validation.rmse) ? -validation.rmse : -Infinity;
}

export function trainByModelName(name, rows, targetType, seed = DEFAULT_SEED, parameters = {}) {
  if (name === "Linear Regression") return trainLinearRegression(rows, parameters);
  if (name === "Logistic Regression") return trainLogisticRegression(rows, parameters);
  if (name === "Decision Tree" || name === "Decision Tree Regressor") return trainDecisionTree(rows, targetType, parameters);
  if (name === "Random Forest" || name === "Random Forest Regressor") return trainRandomForest(rows, targetType, parameters, seed);
  throw new Error(`Unsupported explainable model: ${name}`);
}

/** Selection uses validation CV only; untouched test metrics never select the model. */
export function fitBestExplainableModel(rows, options = {}) {
  const targetType = options.targetType || "regression"; const seed = options.seed ?? DEFAULT_SEED;
  const comparison = runMlExperiment(rows, { ...options, targetType, seed });
  const bestExperiment = [...comparison.experiments].sort((a, b) => validationScore(b, targetType) - validationScore(a, targetType))[0];
  const holdout = participantHoldout(rows, 0.2, seed);
  const preprocessor = fitPreprocessor(holdout.development, { scale: true, varianceThreshold: 0 });
  const development = transformRows(holdout.development, preprocessor); const test = transformRows(holdout.test, preprocessor);
  const model = trainByModelName(bestExperiment.model_name, development, targetType, seed, bestExperiment.hyperparameters);
  return { comparison, bestExperiment, holdout, preprocessor, development, test, model, targetType, seed };
}

