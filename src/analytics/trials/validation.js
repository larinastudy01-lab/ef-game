import { REACTION_TIME_LIMITS_MS, normalizeTaskCode } from "./constants";

export const EXCLUSION_REASONS = Object.freeze({
  NEGATIVE_REACTION_TIME: "negative_reaction_time",
  IMPOSSIBLE_REACTION_TIME: "impossible_reaction_time",
  MISSING_RESPONSE: "missing_response",
  DUPLICATED_TRIAL: "duplicated_trial",
  INTERRUPTED_SESSION: "interrupted_session",
  UNFINISHED_TRIAL: "unfinished_trial",
  BROWSER_REFRESH: "browser_refresh",
  REPEATED_SUBMIT: "repeated_submit",
  ACCIDENTAL_DOUBLE_CLICK: "accidental_double_click",
  TIMEOUT: "timeout",
  INVALID_RESPONSE: "invalid_response",
});

const hasValue = (value) => value !== null && value !== undefined && value !== "";

export function validateTrial(trial, context = {}) {
  const reasons = [];
  const taskCode = normalizeTaskCode(context.taskCode || trial?.taskName || trial?.taskCode);
  const limits = REACTION_TIME_LIMITS_MS[taskCode] || { minimum: 0, maximum: 120000 };
  const reactionTime = trial?.reactionTimeMs;
  const timedOut = Boolean(trial?.timedOut);
  const completed = trial?.completed !== false;

  if (Number.isFinite(reactionTime)) {
    if (reactionTime < 0) reasons.push(EXCLUSION_REASONS.NEGATIVE_REACTION_TIME);
    else if (reactionTime < limits.minimum || reactionTime > limits.maximum) {
      reasons.push(EXCLUSION_REASONS.IMPOSSIBLE_REACTION_TIME);
    }
  }

  if (!hasValue(trial?.actualResponse) && !timedOut && trial?.responseRequired !== false) {
    reasons.push(EXCLUSION_REASONS.MISSING_RESPONSE);
  }
  if (context.duplicate) reasons.push(EXCLUSION_REASONS.DUPLICATED_TRIAL);
  if (context.interrupted) reasons.push(EXCLUSION_REASONS.INTERRUPTED_SESSION);
  if (context.browserRefresh) reasons.push(EXCLUSION_REASONS.BROWSER_REFRESH);
  if (context.repeatedSubmit) reasons.push(EXCLUSION_REASONS.REPEATED_SUBMIT);
  if (!completed) reasons.push(EXCLUSION_REASONS.UNFINISHED_TRIAL);
  if (timedOut) reasons.push(EXCLUSION_REASONS.TIMEOUT);
  if (trial?.invalidResponse) reasons.push(EXCLUSION_REASONS.INVALID_RESPONSE);
  if (Number(trial?.doubleClickCount || 0) > 0) {
    reasons.push(EXCLUSION_REASONS.ACCIDENTAL_DOUBLE_CLICK);
  }

  const uniqueReasons = [...new Set(reasons)];
  return { validTrial: uniqueReasons.length === 0, exclusionReasons: uniqueReasons };
}

export function validateTrialCollection(trials, context = {}) {
  const seen = new Set();
  return trials.map((trial) => {
    const sourceKey = String(trial.sourceTrialKey || trial.trialIndex);
    const duplicate = seen.has(sourceKey);
    seen.add(sourceKey);
    return { ...trial, ...validateTrial(trial, { ...context, duplicate }) };
  });
}
