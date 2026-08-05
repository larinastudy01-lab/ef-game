import { mean, rate } from "./math";
import { normalizeTaskCode } from "../trials/constants";

const correct = (trial) => trial.isCorrect ?? trial.is_correct;
const rt = (trial) => trial.reactionTimeMs ?? trial.reaction_time_ms;
const meta = (trial) => trial.taskSpecificMetadata ?? trial.task_specific_metadata ?? {};

const accuracy = (trials) => {
  const known = trials.filter((trial) => typeof correct(trial) === "boolean");
  return rate(known.filter((trial) => correct(trial)).length, known.length);
};
const groupedAccuracy = (trials, getKey) => Object.fromEntries(
  [...trials.reduce((map, trial) => {
    const key = getKey(trial);
    if (key !== null && key !== undefined && key !== "") map.set(String(key), [...(map.get(String(key)) || []), trial]);
    return map;
  }, new Map())].map(([key, rows]) => [key, { trial_count: rows.length, accuracy: accuracy(rows) }])
);

function cbtFeatures(trials) {
  const span = (trial) => Number(meta(trial).memorySpan ?? meta(trial).sequenceLength ?? meta(trial).length ?? 0);
  const correctSpans = trials.filter((trial) => correct(trial) && span(trial) > 0).map(span);
  const attemptedSpans = trials.map(span).filter((value) => value > 0);
  return {
    cbt_max_correct_span: correctSpans.length ? Math.max(...correctSpans) : null,
    cbt_max_attempted_span: attemptedSpans.length ? Math.max(...attemptedSpans) : null,
    cbt_accuracy_by_sequence_length: groupedAccuracy(trials, span),
    cbt_hint_trial_rate: rate(trials.filter((trial) => meta(trial).usedHint || meta(trial).idleHintShown).length, trials.length),
    cbt_replay_trial_rate: rate(trials.filter((trial) => meta(trial).usedReplay).length, trials.length),
    cbt_mean_first_tap_time_ms: mean(trials.map((trial) => meta(trial).firstTapTime)),
    cbt_mean_tap_interval_ms: mean(trials.map((trial) => meta(trial).averageTapInterval)),
  };
}

function pmFeatures(trials) {
  const load = (trial) => Number(meta(trial).memoryCount ?? meta(trial).memorySpan ?? 0);
  const correctLoads = trials.filter((trial) => correct(trial) && load(trial) > 0).map(load);
  return {
    pm_max_correct_memory_load: correctLoads.length ? Math.max(...correctLoads) : null,
    pm_accuracy_by_memory_load: groupedAccuracy(trials, load),
    pm_accuracy_by_difficulty: groupedAccuracy(trials, (trial) => trial.difficulty),
    pm_timeout_rate: rate(trials.filter((trial) => trial.timedOut || meta(trial).isTimeout).length, trials.length),
    pm_mean_wrong_tap_count: mean(trials.map((trial) => meta(trial).wrongTapCount)),
    pm_mean_missed_target_count: mean(trials.map((trial) => meta(trial).missedTargetCount)),
    pm_mean_deselect_count: mean(trials.map((trial) => meta(trial).deselectCount)),
  };
}

function srtFeatures(trials) {
  const action = (trial) => meta(trial).trainingAction ?? meta(trial).action ?? trial.actualResponse ?? trial.actual_response;
  const noGo = (trial) => meta(trial).targetType === "rotten";
  const goTrials = trials.filter((trial) => !noGo(trial));
  const noGoTrials = trials.filter(noGo);
  const numericRts = trials.map(rt).filter(Number.isFinite);
  return {
    srt_go_accuracy: accuracy(goTrials),
    srt_no_go_accuracy: accuracy(noGoTrials),
    srt_omission_error_rate: rate(trials.filter((trial) => action(trial) === "miss").length, goTrials.length),
    srt_commission_error_rate: rate(trials.filter((trial) => ["clickedRotten", "falseAlarm"].includes(action(trial))).length, noGoTrials.length),
    srt_extreme_fast_response_rate: rate(numericRts.filter((value) => value < 150).length, numericRts.length),
    srt_extreme_slow_response_rate: rate(numericRts.filter((value) => value > 2000).length, numericRts.length),
    srt_false_click_rate: rate(trials.filter((trial) => meta(trial).falseClick).length, trials.length),
    srt_assisted_trial_rate: rate(trials.filter((trial) => meta(trial).assisted).length, trials.length),
  };
}

function ssgFeatures(trials) {
  const selectedPosition = (trial) => meta(trial).selectedPosition ?? meta(trial).clickedSide;
  return {
    ssg_cat_sound_accuracy: accuracy(trials.filter((trial) => meta(trial).soundType === "cat")),
    ssg_dog_sound_accuracy: accuracy(trials.filter((trial) => meta(trial).soundType === "dog")),
    ssg_left_response_accuracy: accuracy(trials.filter((trial) => selectedPosition(trial) === "left")),
    ssg_right_response_accuracy: accuracy(trials.filter((trial) => selectedPosition(trial) === "right")),
    ssg_anticipation_rate: rate(trials.filter((trial) => meta(trial).isAnticipation || trial.errorType === "anticipation").length, trials.length),
    ssg_same_animal_error_rate: rate(trials.filter((trial) => trial.errorType === "sameAnimalError").length, trials.length),
    ssg_audio_fallback_rate: rate(trials.filter((trial) => meta(trial).audioPlaybackFailed).length, trials.length),
    ssg_attentional_bias_available: false,
    ssg_attentional_bias_unavailable_reason: "Current task records auditory animal/position selection and lacks comparable congruent-versus-incongruent probe conditions.",
  };
}

function lbFeatures(trials) {
  const isSwitch = (trial) => Boolean(meta(trial).isSwitch || meta(trial).switchTrial);
  const expectedSteps = new Set(trials.map((trial) => meta(trial).trialId ?? meta(trial).stepInLevel ?? trial.trialIndex).filter((value) => value !== null && value !== undefined));
  const completedSteps = new Set(trials.filter((trial) => correct(trial)).map((trial) => meta(trial).trialId ?? meta(trial).stepInLevel ?? trial.trialIndex));
  return {
    lb_completion_rate: rate(completedSteps.size, expectedSteps.size),
    lb_sequence_error_rate: rate(trials.filter((trial) => ["sequenceError", "numberError", "colorError", "ruleSwitchError"].includes(trial.errorType)).length, trials.length),
    lb_switch_accuracy: accuracy(trials.filter(isSwitch)),
    lb_non_switch_accuracy: accuracy(trials.filter((trial) => !isSwitch(trial))),
    lb_hint_trial_rate: rate(trials.filter((trial) => meta(trial).hintShown).length, trials.length),
    lb_path_total_time_ms: Math.max(0, ...trials.map((trial) => Number(meta(trial).cumulativeTime || 0))),
    lb_accuracy_by_rule: groupedAccuracy(trials, (trial) => meta(trial).ruleType ?? meta(trial).rule),
  };
}

function dccsFeatures(trials) {
  const isSwitch = (trial) => Boolean(meta(trial).isSwitch || meta(trial).wasAfterRuleSwitch || meta(trial).isAfterSwitch || meta(trial).isPostSwitch);
  const switchTrials = trials.filter(isSwitch);
  const nonSwitchTrials = trials.filter((trial) => !isSwitch(trial));
  const switchRt = mean(switchTrials.filter((trial) => correct(trial)).map(rt));
  const nonSwitchRt = mean(nonSwitchTrials.filter((trial) => correct(trial)).map(rt));
  return {
    dccs_switch_accuracy: accuracy(switchTrials),
    dccs_non_switch_accuracy: accuracy(nonSwitchTrials),
    dccs_switch_cost_ms: switchRt === null || nonSwitchRt === null ? null : switchRt - nonSwitchRt,
    dccs_perseverative_error_rate: rate(trials.filter((trial) => meta(trial).isPerseverativeError || meta(trial).isOldRuleInterference).length, trials.length),
    dccs_interference_accuracy: accuracy(trials.filter((trial) => meta(trial).isInterferenceTrial)),
    dccs_accuracy_by_rule_stage: groupedAccuracy(trials, (trial) => meta(trial).ruleStage ?? meta(trial).rule),
  };
}

export function calculateTaskSpecificFeatures(taskValue, validTrials = []) {
  const taskCode = normalizeTaskCode(taskValue);
  if (taskCode === "CBT") return cbtFeatures(validTrials);
  if (taskCode === "PM") return pmFeatures(validTrials);
  if (taskCode === "SRT") return srtFeatures(validTrials);
  if (taskCode === "SSG") return ssgFeatures(validTrials);
  if (taskCode === "LB") return lbFeatures(validTrials);
  if (taskCode === "DCCS") return dccsFeatures(validTrials);
  return {};
}

