import { FEATURE_PIPELINE_VERSION, FEATURE_VERSION } from "./version";
import { calculateGeneralFeatures } from "./generalFeatures";
import { calculateTaskSpecificFeatures } from "./taskSpecificFeatures";
import { normalizeTaskCode } from "../trials/constants";

const value = (object, camel, snake) => object?.[camel] ?? object?.[snake];

function normalizeFeatureTrial(trial) {
  return {
    ...trial,
    trialIndex: value(trial, "trialIndex", "trial_index"),
    isCorrect: value(trial, "isCorrect", "is_correct"),
    reactionTimeMs: value(trial, "reactionTimeMs", "reaction_time_ms"),
    actualResponse: value(trial, "actualResponse", "actual_response"),
    expectedResponse: value(trial, "expectedResponse", "expected_response"),
    errorType: value(trial, "errorType", "error_type"),
    taskSpecificMetadata: value(trial, "taskSpecificMetadata", "task_specific_metadata") || {},
    validTrial: value(trial, "validTrial", "valid_trial") !== false,
    exclusionReasons: value(trial, "exclusionReasons", "exclusion_reasons") || [],
  };
}

const exclusionCounts = (trials) => trials.reduce((counts, trial) => {
  trial.exclusionReasons.forEach((reason) => {
    counts[reason] = (counts[reason] || 0) + 1;
  });
  return counts;
}, {});

/**
 * Pure and deterministic: identical canonical inputs + feature_version produce
 * identical feature values. generated_at is lineage metadata, not a feature.
 */
export function buildTaskFeatureRow({
  participantId,
  sessionId,
  taskSession = {},
  trials = [],
  featureVersion = FEATURE_VERSION,
} = {}) {
  const normalizedTrials = trials.map(normalizeFeatureTrial)
    .sort((left, right) => Number(left.trialIndex ?? 0) - Number(right.trialIndex ?? 0));
  const status = value(taskSession, "completionStatus", "completion_status") || "completed";
  const interrupted = status === "interrupted" || status === "abandoned";
  const validTrials = interrupted ? [] : normalizedTrials.filter((trial) => trial.validTrial);
  const taskCode = normalizeTaskCode(value(taskSession, "taskCode", "task_code") || normalizedTrials[0]?.taskCode);
  const quality = {
    totalTrialCount: normalizedTrials.length,
    excludedTrialCount: normalizedTrials.length - validTrials.length,
  };

  return {
    participant_id: participantId || null,
    session_id: sessionId || value(taskSession, "sessionId", "session_id") || null,
    task_session_id: value(taskSession, "taskSessionId", "id") || null,
    task_code: taskCode,
    feature_version: featureVersion,
    pipeline_version: FEATURE_PIPELINE_VERSION,
    source_processing_versions: [...new Set(normalizedTrials.map((trial) => value(trial, "processingVersion", "processing_version")).filter(Boolean))].sort(),
    session_completion_status: status,
    interrupted_session: interrupted,
    exclusion_reason_counts: exclusionCounts(normalizedTrials),
    ...calculateGeneralFeatures(validTrials, quality),
    ...calculateTaskSpecificFeatures(taskCode, validTrials),
  };
}

