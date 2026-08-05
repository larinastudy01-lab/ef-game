import {
  describe,
  linearSlope,
  mean,
  pearsonCorrelation,
  rate,
  sampleSd,
} from "./math";

const correctness = (trial) => trial.isCorrect ?? trial.is_correct;
const reactionTime = (trial) => trial.reactionTimeMs ?? trial.reaction_time_ms;
const actualResponse = (trial) => trial.actualResponse ?? trial.actual_response;

function flattenDescription(prefix, description) {
  return Object.fromEntries(Object.entries(description).map(([key, value]) => [`${prefix}_${key}`, value]));
}

function maximumErrorStreak(trials) {
  let current = 0;
  let maximum = 0;
  let streakCount = 0;
  trials.forEach((trial) => {
    if (correctness(trial) === false) {
      if (current === 0) streakCount += 1;
      current += 1;
      maximum = Math.max(maximum, current);
    } else {
      current = 0;
    }
  });
  return { maximum, streakCount };
}

function responseConsistency(trials) {
  const responses = trials.map(actualResponse).filter((value) => value !== null && value !== undefined)
    .map((value) => JSON.stringify(value));
  if (!responses.length) return null;
  const counts = responses.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map());
  return Math.max(...counts.values()) / responses.length;
}

function temporalSegments(trials) {
  if (!trials.length) return { early: [], middle: [], late: [] };
  const edgeSize = Math.max(1, Math.floor(trials.length * 0.25));
  return {
    early: trials.slice(0, edgeSize),
    middle: trials.slice(edgeSize, Math.max(edgeSize, trials.length - edgeSize)),
    late: trials.slice(Math.max(0, trials.length - edgeSize)),
  };
}

const segmentAccuracy = (trials) => {
  const known = trials.map(correctness).filter((value) => typeof value === "boolean");
  return rate(known.filter(Boolean).length, known.length);
};
const segmentRt = (trials) => mean(trials.map(reactionTime));

export function calculateGeneralFeatures(validTrials = [], quality = {}) {
  const knownTrials = validTrials.filter((trial) => typeof correctness(trial) === "boolean");
  const correctTrials = knownTrials.filter((trial) => correctness(trial) === true);
  const incorrectTrials = knownTrials.filter((trial) => correctness(trial) === false);
  const allRts = validTrials.map(reactionTime);
  const correctRts = correctTrials.map(reactionTime);
  const incorrectRts = incorrectTrials.map(reactionTime);
  const orderedRts = validTrials.map(reactionTime);
  const rtChanges = orderedRts.slice(1).map((value, index) => {
    const previous = Number(orderedRts[index]);
    const current = Number(value);
    return Number.isFinite(previous) && Number.isFinite(current) ? current - previous : null;
  });
  const streak = maximumErrorStreak(knownTrials);
  const segments = temporalSegments(validTrials);
  const earlyAccuracy = segmentAccuracy(segments.early);
  const middleAccuracy = segmentAccuracy(segments.middle);
  const lateAccuracy = segmentAccuracy(segments.late);
  const earlyRt = segmentRt(segments.early);
  const middleRt = segmentRt(segments.middle);
  const lateRt = segmentRt(segments.late);
  const accuracy = rate(correctTrials.length, knownTrials.length);
  const meanRt = mean(allRts);

  return {
    total_trial_count: quality.totalTrialCount ?? validTrials.length,
    analysis_trial_count: validTrials.length,
    excluded_trial_count: quality.excludedTrialCount ?? 0,
    valid_trial_rate: rate(validTrials.length, quality.totalTrialCount ?? validTrials.length),
    accuracy,
    error_rate: rate(incorrectTrials.length, knownTrials.length),
    correct_trial_count: correctTrials.length,
    incorrect_trial_count: incorrectTrials.length,
    ...flattenDescription("rt", describe(allRts)),
    ...flattenDescription("correct_rt", describe(correctRts)),
    ...flattenDescription("incorrect_rt", describe(incorrectRts)),
    rt_variability_ms: sampleSd(allRts),
    accuracy_variability: sampleSd(knownTrials.map((trial) => correctness(trial) ? 1 : 0)),
    mean_trial_to_trial_rt_change_ms: mean(rtChanges),
    mean_absolute_trial_to_trial_rt_change_ms: mean(rtChanges.map((value) => value === null ? null : Math.abs(value))),
    error_streak_count: streak.streakCount,
    maximum_error_streak: streak.maximum,
    response_consistency: responseConsistency(validTrials),
    early_trial_count: segments.early.length,
    middle_trial_count: segments.middle.length,
    late_trial_count: segments.late.length,
    early_accuracy: earlyAccuracy,
    middle_accuracy: middleAccuracy,
    late_accuracy: lateAccuracy,
    early_rt_mean_ms: earlyRt,
    middle_rt_mean_ms: middleRt,
    late_rt_mean_ms: lateRt,
    accuracy_change_late_minus_early: earlyAccuracy === null || lateAccuracy === null ? null : lateAccuracy - earlyAccuracy,
    rt_change_late_minus_early_ms: earlyRt === null || lateRt === null ? null : lateRt - earlyRt,
    rt_slope_ms_per_trial: linearSlope(validTrials.map(reactionTime)),
    performance_slope_per_trial: linearSlope(validTrials.map((trial) => {
      const value = correctness(trial);
      return typeof value === "boolean" ? (value ? 1 : 0) : null;
    })),
    learning_related_accuracy_change: earlyAccuracy === null || lateAccuracy === null ? null : lateAccuracy - earlyAccuracy,
    learning_related_rt_improvement_ms: earlyRt === null || lateRt === null ? null : earlyRt - lateRt,
    fatigue_related_accuracy_drop: earlyAccuracy === null || lateAccuracy === null ? null : Math.max(earlyAccuracy - lateAccuracy, 0),
    fatigue_related_rt_slowing_ms: earlyRt === null || lateRt === null ? null : Math.max(lateRt - earlyRt, 0),
    rt_accuracy_correlation: pearsonCorrelation(
      knownTrials.map(reactionTime),
      knownTrials.map((trial) => correctness(trial) ? 1 : 0)
    ),
    inverse_efficiency_ms: accuracy && meanRt !== null ? meanRt / accuracy : null,
    correct_responses_per_second: meanRt && accuracy !== null ? accuracy / (meanRt / 1000) : null,
  };
}

