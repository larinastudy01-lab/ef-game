import { buildParticipantCrossTaskDataset } from "../features";

const scalar = (value) => value !== null && typeof value === "object" ? JSON.stringify(value) : value;
const escape = (value) => { const text = value === null || value === undefined ? "" : String(scalar(value)); return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };

export function rowsToCsv(rows = []) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  if (!columns.length) return "";
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
}

export function buildRawTrialRows(inputs = []) {
  return inputs.flatMap((input) => (input.rawTrials || []).map((trial) => ({ participant_id: input.participantId,
    session_id: input.sessionId, task_session_id: input.taskSession?.id, task_code: input.taskSession?.task_code,
    trial_id: trial.id, source_trial_key: trial.source_trial_key, trial_index: trial.trial_index,
    occurred_at: trial.occurred_at, received_at: trial.received_at, raw_schema_version: trial.raw_schema_version,
    raw_data: trial.raw_data })));
}

export function buildPredictionRows(explainability) {
  return (explainability?.individual_explanations || []).map((item) => ({ participant_id: item.participant_id,
    session_id: item.session_id, model_name: explainability.model_name, model_version: explainability.model_version,
    dataset_version: explainability.data_version, feature_version: explainability.feature_version,
    target_definition: explainability.target_definition, prediction: item.prediction, probability: item.probability,
    confidence: item.confidence, explanation_method: item.explanation_method,
    top_positive_contributors: item.top_positive_contributors, top_negative_contributors: item.top_negative_contributors,
    interpretation: "Behavioral performance prediction research prototype; not diagnosis." }));
}

export function buildRecommendationRows(rows = []) {
  return rows.map((row) => ({ recommendation_id: row.id || row.recommendation_id, participant_id: row.participant_id,
    timestamp: row.recommendation_timestamp || row.timestamp, policy: row.policy_name || row.policy, policy_version: row.policy_version,
    reward_version: row.reward_version, context: row.context, available_actions: row.available_actions,
    selected_action: row.selected_action, predicted_reward: row.predicted_reward, actual_outcome: row.actual_outcome,
    actual_reward: row.actual_reward }));
}

export function buildResearchExportBundle({ inputs = [], taskRows = [], statistics = null, explainability = null, recommendations = [] } = {}) {
  const statisticsExports = statistics?.exports || {};
  const participantIds = new Set(taskRows.map((row) => row.participant_id).filter(Boolean));
  return {
    "raw_trials.csv": rowsToCsv(buildRawTrialRows(inputs)),
    "task_features.csv": rowsToCsv(taskRows),
    "participant_features.csv": rowsToCsv(buildParticipantCrossTaskDataset(taskRows)),
    "statistics.csv": statisticsExports["statistics_summary.csv"] || "",
    "prediction.csv": rowsToCsv(buildPredictionRows(explainability).filter((row) => participantIds.has(row.participant_id))),
    "recommendation.csv": rowsToCsv(buildRecommendationRows(recommendations)),
  };
}

export function downloadResearchFile(filename, contents) {
  const type = filename.endsWith(".json") ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
  const blob = new Blob([contents], { type }); const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
