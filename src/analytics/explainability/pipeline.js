import { fitBestExplainableModel } from "./modelSelection";
import { globalImportance, importanceStability } from "./importance";
import { individualExplanation } from "./individual";
import { assertNonDiagnosticText, buildBehavioralNarrative, RESEARCH_LIMITATION_NOTICE } from "./narrative";
import { EXPLAINABILITY_VERSION } from "./version";

export function analyzeModelExplainability(rows, options = {}) {
  const artifact = fitBestExplainableModel(rows, options);
  const global = globalImportance(artifact); const stability = importanceStability(artifact, options.folds || 5);
  const individuals = artifact.test.map((row) => { const explanation = individualExplanation(artifact, row);
    return { ...explanation, narrative: assertNonDiagnosticText(buildBehavioralNarrative(explanation)) }; });
  const shapSummary = artifact.model.weights ? artifact.preprocessor.feature_names.map((feature) => {
    const contributions = individuals.map((item) => item.contributors.find((value) => value.feature === feature)?.contribution || 0);
    return { feature, mean_absolute_shap: contributions.reduce((sum, value) => sum + Math.abs(value), 0) / contributions.length,
      mean_signed_shap: contributions.reduce((sum, value) => sum + value, 0) / contributions.length,
      reference: "training_mean", output_scale: artifact.targetType === "classification" ? "log_odds" : "prediction" };
  }).sort((a, b) => b.mean_absolute_shap - a.mean_absolute_shap) : null;
  return { explainability_version: EXPLAINABILITY_VERSION, model_version: artifact.bestExperiment.ml_pipeline_version,
    model_name: artifact.model.name, data_version: artifact.bestExperiment.dataset_version,
    feature_version: artifact.bestExperiment.feature_version, target_definition: artifact.bestExperiment.target_definition,
    sample_size: rows.length, participant_count: new Set(rows.map((row) => row.participant_id)).size,
    validation_method: artifact.bestExperiment.split_method, data_mode: artifact.comparison.data_mode,
    model_performance: artifact.bestExperiment.metrics, global_importance: global, shap_summary: shapSummary, importance_stability: stability,
    individual_explanations: individuals, limitation_notice: RESEARCH_LIMITATION_NOTICE,
    interpretation_guardrail: artifact.comparison.interpretation_guardrail,
    method_note: artifact.model.weights
      ? "Linear additive contributions use the training-mean reference; classification contributions are additive on log-odds."
      : "Tree explanations use held-out permutation importance globally and training-mean perturbation locally; they are not labeled as SHAP." };
}
