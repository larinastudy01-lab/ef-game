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
  NOT_ADMINISTERED: "not_administered",
});

const hasValue = (value) => value !== null && value !== undefined && value !== "";

/** Acquisition state is independent of RT/analysis validity. For legacy rows,
 * use recorded responses/outcomes, never the planned question count or index.
 * Unknown acquisition state is not included in the PM timeout denominator.
 */
export function getTrialResponseState(trial = {}) {
  const metadata = trial.taskSpecificMetadata || trial.task_specific_metadata || {};
  const sources = [trial, metadata, trial.rawData || trial.raw_data || {}];
  const statuses = sources.flatMap((source) => [source.responseStatus, source.response_status, source.status]);
  const notAdministered = sources.some((source) => source.administered === false || source.isAdministered === false)
    || statuses.some((status) => ["not_administered", "not_presented", "not_started", "planned"].includes(status));
  if (notAdministered) return { administered: false, responseStatus: "not_administered", timedOut: false };
  const timedOut = sources.some((source) => source.timedOut === true || source.isTimeout === true || source.timeout === true
    || source.errorType === "timeout" || source.error_type === "timeout"
    || (source.exclusionReasons || source.exclusion_reasons || []).includes("timeout"))
    || statuses.includes("timed_out") || statuses.includes("timeout");
  if (timedOut) return { administered: true, responseStatus: "timed_out", timedOut: true };
  const responded = sources.some((source) => typeof (source.isCorrect ?? source.is_correct ?? source.correct) === "boolean"
    || [source.actualResponse, source.actual_response, source.selectedIds].some((response) =>
      Array.isArray(response) ? response.length > 0 : hasValue(response)))
    || statuses.includes("responded");
  if (responded) return { administered: true, responseStatus: "responded", timedOut: false };
  const presented = sources.some((source) => source.administered === true || source.isAdministered === true
    || hasValue(source.presentedAt) || hasValue(source.presented_at)) || statuses.includes("unfinished");
  return { administered: presented ? true : null, responseStatus: presented ? "unfinished" : "unknown", timedOut: false };
}

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
  if (taskCode === "PM" && getTrialResponseState(trial).administered === false) {
    reasons.push(EXCLUSION_REASONS.NOT_ADMINISTERED);
  }
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
