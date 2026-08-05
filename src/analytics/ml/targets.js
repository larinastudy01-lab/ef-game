import { mean } from "../features/math";

const numeric = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
const trialValue = (trial, camel, snake) => trial?.[camel] ?? trial?.[snake];
const validTrials = (trials = []) => trials
  .filter((trial) => trialValue(trial, "validTrial", "valid_trial") !== false)
  .sort((a, b) => Number(trialValue(a, "trialIndex", "trial_index") || 0) - Number(trialValue(b, "trialIndex", "trial_index") || 0));

function segmentFeatures(trials) {
  const accuracyValues = trials.map((trial) => trialValue(trial, "isCorrect", "is_correct"))
    .filter((value) => typeof value === "boolean")
    .map((value) => Number(value));
  const rtValues = trials.map((trial) => trialValue(trial, "reactionTimeMs", "reaction_time_ms"))
    .filter(numeric).map(Number);
  const rtMean = mean(rtValues);
  const rtVariance = rtValues.length > 1
    ? rtValues.reduce((sum, value) => sum + ((value - rtMean) ** 2), 0) / (rtValues.length - 1)
    : null;
  return {
    trial_count: trials.length,
    accuracy: mean(accuracyValues),
    rt_mean: rtMean,
    rt_variability_ms: rtVariance === null ? null : Math.sqrt(rtVariance),
    error_rate: accuracyValues.length ? 1 - mean(accuracyValues) : null,
  };
}

/** Earlier trials are features; later trials alone define the outcome. */
export function buildFuturePerformanceDataset(inputs = [], fraction = 0.3, outcome = "accuracy") {
  if (![0.2, 0.3, 0.5].includes(fraction)) throw new Error("Early fraction must be 0.2, 0.3, or 0.5.");
  return inputs.flatMap((input) => {
    const trials = validTrials(input.trials);
    const boundary = Math.floor(trials.length * fraction);
    if (boundary < 1 || trials.length - boundary < 1) return [];
    const early = segmentFeatures(trials.slice(0, boundary));
    const late = segmentFeatures(trials.slice(boundary));
    const target = outcome === "rt_mean" ? late.rt_mean : late.accuracy;
    if (!numeric(target)) return [];
    return [{
      participant_id: input.participantId,
      session_id: input.sessionId,
      task_code: input.taskSession?.task_code || input.taskSession?.taskCode,
      features: Object.fromEntries(Object.entries(early).map(([key, value]) => [`early_${key}`, value])),
      target: Number(target),
      target_definition: `future_${outcome}_from_first_${Math.round(fraction * 100)}pct`,
    }];
  });
}

/** Assessment n features predict the same task at assessment n+1. */
export function buildNextSessionDataset(taskRows = [], outcome = "accuracy") {
  const rows = taskRows.filter((row) => row.assessment_or_training === "assessment")
    .sort((a, b) => String(a.session_started_at || "").localeCompare(String(b.session_started_at || "")));
  const grouped = rows.reduce((map, row) => {
    const key = `${row.participant_id}::${row.task_code}`;
    map.set(key, [...(map.get(key) || []), row]);
    return map;
  }, new Map());
  return [...grouped.values()].flatMap((participantRows) => participantRows.slice(0, -1).flatMap((row, index) => {
    const next = participantRows[index + 1];
    if (!numeric(next[outcome])) return [];
    return [{
      participant_id: row.participant_id,
      session_id: row.session_id,
      task_code: row.task_code,
      features: numericFeatures(row),
      target: Number(next[outcome]),
      target_definition: `next_assessment_${outcome}`,
    }];
  }));
}

/** Other tasks predict the selected task; the target task fields are removed. */
export function buildCrossTaskDataset(crossTaskRows = [], targetTask, outcome = "accuracy") {
  const prefix = taskPrefix(targetTask);
  const targetField = `${prefix}_${outcome}`;
  return crossTaskRows.flatMap((row) => {
    if (!numeric(row[targetField])) return [];
    const features = numericFeatures(row, (key) => !key.startsWith(`${prefix}_`) && !key.startsWith("overall_"));
    return [{ participant_id: row.participant_id, session_id: row.session_id, task_code: targetTask,
      features, target: Number(row[targetField]), target_definition: `cross_task_${targetTask}_${outcome}` }];
  });
}

export function toPerformanceCategory(rows = [], threshold = 0.7) {
  return rows.map((row) => ({ ...row, target: Number(row.target >= threshold),
    target_definition: `${row.target_definition}_category_at_${threshold}` }));
}

function numericFeatures(row, predicate = () => true) {
  return Object.fromEntries(Object.entries(row).filter(([key, value]) => predicate(key) && numeric(value)
    && !["participant_id", "session_id", "task_session_id"].includes(key)).map(([key, value]) => [key, Number(value)]));
}

function taskPrefix(task) {
  return ({ CBT: "corsi", PM: "picture_memory", SRT: "srt", SSG: "ssg", LB: "linking_balloons", DCCS: "dccs" })[task] || String(task).toLowerCase();
}

