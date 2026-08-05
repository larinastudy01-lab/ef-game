import { calculateTaskSpecificFeatures } from "../taskSpecificFeatures";

const t = (isCorrect, reactionTimeMs, taskSpecificMetadata = {}, extra = {}) => ({
  isCorrect, reactionTimeMs, taskSpecificMetadata, ...extra,
});

test("CBT uses recorded sequence length and span", () => {
  const features = calculateTaskSpecificFeatures("CBT", [
    t(true, 900, { memorySpan: 3, sequenceLength: 3 }),
    t(false, 1100, { memorySpan: 4, sequenceLength: 4 }),
  ]);
  expect(features.cbt_max_correct_span).toBe(3);
  expect(features.cbt_accuracy_by_sequence_length[4].accuracy).toBe(0);
});

test("PM stratifies observed memory load", () => {
  const features = calculateTaskSpecificFeatures("PM", [
    t(true, 900, { memoryCount: 3 }),
    t(false, 1000, { memoryCount: 4 }),
  ]);
  expect(features.pm_max_correct_memory_load).toBe(3);
  expect(features.pm_accuracy_by_memory_load[4].accuracy).toBe(0);
});

test("SSG explicitly does not invent attentional bias", () => {
  const features = calculateTaskSpecificFeatures("SSG", [
    t(true, 500, { soundType: "cat", selectedPosition: "left", isIncongruent: true }),
  ]);
  expect(features.ssg_cat_sound_accuracy).toBe(1);
  expect(features.ssg_attentional_bias_available).toBe(false);
});

test("DCCS calculates switch cost only from observed switch markers", () => {
  const features = calculateTaskSpecificFeatures("DCCS", [
    t(true, 500, { ruleStage: "color", isSwitch: false }),
    t(true, 800, { ruleStage: "type", isAfterSwitch: true }),
  ]);
  expect(features.dccs_switch_accuracy).toBe(1);
  expect(features.dccs_non_switch_accuracy).toBe(1);
  expect(features.dccs_switch_cost_ms).toBe(300);
});

test("LB preserves sequence completion and error behavior", () => {
  const features = calculateTaskSpecificFeatures("LB", [
    t(false, 400, { trialId: "L1-1", stepInLevel: 1 }, { errorType: "sequenceError" }),
    t(true, 500, { trialId: "L1-1", stepInLevel: 1 }),
    t(true, 600, { trialId: "L1-2", stepInLevel: 2 }),
  ]);
  expect(features.lb_completion_rate).toBe(1);
  expect(features.lb_sequence_error_rate).toBeCloseTo(1 / 3);
});
