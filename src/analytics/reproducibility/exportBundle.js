import { buildParticipantCrossTaskDataset } from "../features";
import { analyzeParticipantLongitudinal } from "../longitudinal";
import { buildPredictionRows, buildRawTrialRows, buildRecommendationRows, rowsToCsv } from "../researchDashboard";
import { buildExperimentRegistryExports } from "./experimentRegistry";
import { DATASET_VERSION, EXPORT_SCHEMA_VERSION, EXPORT_VERSION } from "./version";

export function buildCleanedTrialRows(inputs = []) {
  return inputs.flatMap((input) => (input.trials || []).map((trial) => ({ participant_id: input.participantId,
    session_id: input.sessionId, task_session_id: input.taskSession?.id, task_code: input.taskSession?.task_code,
    trial_id: trial.trial_id || trial.id, trial_index: trial.trial_index, stimulus: trial.stimulus, condition: trial.condition,
    difficulty: trial.difficulty, expected_response: trial.expected_response, actual_response: trial.actual_response,
    is_correct: trial.is_correct, reaction_time_ms: trial.reaction_time_ms, error_type: trial.error_type,
    task_specific_metadata: trial.task_specific_metadata, valid_trial: trial.valid_trial,
    exclusion_reasons: trial.exclusion_reasons, processing_version: trial.processing_version, processed_at: trial.processed_at })));
}

export function buildShapRows(explainability) {
  if (!explainability) return [];
  const global = (explainability.shap_summary || []).map((item) => ({ scope: "global", participant_id: null, session_id: null,
    model_name: explainability.model_name, model_version: explainability.model_version, target_definition: explainability.target_definition,
    feature: item.feature, feature_value: null, shap_value: item.mean_signed_shap, mean_absolute_shap: item.mean_absolute_shap,
    reference: item.reference, output_scale: item.output_scale }));
  const individual = (explainability.individual_explanations || []).flatMap((explanation) => explanation.contributors.map((item) => ({
    scope: "individual", participant_id: explanation.participant_id, session_id: explanation.session_id,
    model_name: explainability.model_name, model_version: explainability.model_version, target_definition: explainability.target_definition,
    feature: item.feature, feature_value: item.feature_value, shap_value: explanation.explanation_method.includes("shap") ? item.contribution : null,
    local_contribution: item.contribution, explanation_method: explanation.explanation_method })));
  return [...global, ...individual];
}

export function buildLongitudinalRows(taskRows = [], recommendations = []) {
  return [...new Set(taskRows.map((row) => row.participant_id).filter(Boolean))].flatMap((participantId) => {
    const analysis = analyzeParticipantLongitudinal(participantId, taskRows, recommendations);
    return analysis.feature_summary.tasks.flatMap((task) => task.metrics.map((metric) => ({ participant_id: participantId,
      task_code: task.task_code, session_count: task.session_count, assessment_count: task.assessment_count,
      training_count: task.training_count, training_frequency_per_30_days: task.training_frequency_per_30_days,
      ...metric, longitudinal_version: analysis.longitudinal_version, comparison_reference: analysis.comparison_reference })));
  });
}

export function createDatasetManifest({ inputs = [], taskRows = [], generatedAt = new Date().toISOString(),
  datasetVersion = DATASET_VERSION, codeVersion = getCodeVersion() } = {}) {
  const cleaned = buildCleanedTrialRows(inputs); const raw = buildRawTrialRows(inputs);
  const featureVersions = [...new Set(taskRows.map((row) => row.feature_version).filter(Boolean))].sort();
  return { dataset_version: datasetVersion, generated_at: generatedAt,
    participant_count: new Set(taskRows.map((row) => row.participant_id).filter(Boolean)).size,
    session_count: new Set(taskRows.map((row) => row.session_id).filter(Boolean)).size,
    task_count: new Set(taskRows.map((row) => row.task_session_id).filter(Boolean)).size,
    unique_task_code_count: new Set(taskRows.map((row) => row.task_code).filter(Boolean)).size,
    trial_count: raw.length, cleaned_trial_count: cleaned.length,
    excluded_trial_count: cleaned.filter((trial) => trial.valid_trial === false).length,
    feature_version: featureVersions.length === 1 ? featureVersions[0] : featureVersions,
    feature_versions: featureVersions, code_version: codeVersion,
    export_version: EXPORT_VERSION, export_schema_version: EXPORT_SCHEMA_VERSION };
}

export function buildUnifiedResearchExport({ inputs = [], taskRows = [], statistics = null, explainability = null,
  recommendations = [], experiments = [], generatedAt, codeVersion, datasetVersion } = {}) {
  const manifest = createDatasetManifest({ inputs, taskRows, generatedAt, codeVersion, datasetVersion });
  const statisticsFiles = Object.fromEntries(Object.entries(statistics?.exports || {}).map(([name, value]) => [`statistics_${name}`, value]));
  const files = {
    "raw_trial_data.csv": rowsToCsv(buildRawTrialRows(inputs)),
    "cleaned_trial_data.csv": rowsToCsv(buildCleanedTrialRows(inputs)),
    "task_features.csv": rowsToCsv(taskRows),
    "participant_features.csv": rowsToCsv(buildParticipantCrossTaskDataset(taskRows)),
    ...statisticsFiles,
    "ml_predictions.csv": rowsToCsv(buildPredictionRows(explainability)),
    "shap_results.csv": rowsToCsv(buildShapRows(explainability)),
    "recommendation_decisions.csv": rowsToCsv(buildRecommendationRows(recommendations)),
    "longitudinal_features.csv": rowsToCsv(buildLongitudinalRows(taskRows, recommendations)),
    ...buildExperimentRegistryExports(experiments),
    "dataset_manifest.json": JSON.stringify(manifest, null, 2),
    "export_metadata.json": JSON.stringify({ export_version: EXPORT_VERSION, generated_at: manifest.generated_at,
      formats: ["CSV", "JSON"], raw_processed_separation: true,
      interpretation: "Research/education behavioral data; no clinical diagnosis or normative classification." }, null, 2),
  };
  return { manifest, files };
}

export function getCodeVersion() {
  return process.env.REACT_APP_CODE_VERSION || process.env.REACT_APP_GIT_COMMIT || "repository_worktree_unknown";
}
