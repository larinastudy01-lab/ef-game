import { mean } from "./math";
import { FEATURE_VERSION } from "./version";
import { buildTaskFeatureRow } from "./pipeline";

const PREFIX_BY_TASK = {
  CBT: "corsi",
  PM: "picture_memory",
  SRT: "srt",
  SSG: "ssg",
  LB: "linking_balloons",
  DCCS: "dccs",
};

const IDENTIFIER_FIELDS = new Set([
  "participant_id", "session_id", "task_session_id", "task_code",
  "feature_version", "pipeline_version", "source_processing_versions",
]);

export const buildTaskLevelFeatureDataset = (inputs = []) =>
  inputs.map((input) => buildTaskFeatureRow(input));

function prefixTaskFeatures(row) {
  const prefix = PREFIX_BY_TASK[row.task_code] || String(row.task_code || "unknown").toLowerCase();
  const sourcePrefix = `${String(row.task_code || "").toLowerCase()}_`;
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !IDENTIFIER_FIELDS.has(key))
      .map(([key, featureValue]) => {
        const unprefixed = key.startsWith(sourcePrefix) ? key.slice(sourcePrefix.length) : key;
        return [`${prefix}_${unprefixed}`, featureValue];
      })
  );
}

/** One row per participant × multi-task session. No name or patient_id accepted. */
export function buildParticipantCrossTaskDataset(taskRows = [], featureVersion = FEATURE_VERSION) {
  const groups = taskRows.reduce((map, row) => {
    if (!row?.participant_id || !row?.session_id) return map;
    const key = `${row.participant_id}::${row.session_id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());

  return [...groups.values()].map((rows) => {
    const taskCodes = [...new Set(rows.map((row) => row.task_code))].sort();
    const scalarAccuracy = rows.map((row) => row.accuracy);
    const scalarRt = rows.map((row) => row.rt_mean);
    const taskFeatures = rows.reduce((features, row) => Object.assign(features, prefixTaskFeatures(row)), {});
    return {
      participant_id: rows[0].participant_id,
      session_id: rows[0].session_id,
      feature_version: featureVersion,
      included_task_codes: taskCodes,
      included_task_count: taskCodes.length,
      overall_mean_task_accuracy: mean(scalarAccuracy),
      overall_mean_task_rt_ms: mean(scalarRt),
      overall_total_analysis_trials: rows.reduce((total, row) => total + Number(row.analysis_trial_count || 0), 0),
      overall_total_excluded_trials: rows.reduce((total, row) => total + Number(row.excluded_trial_count || 0), 0),
      ...taskFeatures,
    };
  });
}
