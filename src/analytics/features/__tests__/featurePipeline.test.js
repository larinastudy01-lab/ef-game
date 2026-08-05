import { buildParticipantCrossTaskDataset } from "../datasetBuilders";
import { buildTaskFeatureRow } from "../pipeline";

const taskSession = (taskCode = "SRT", completionStatus = "completed") => ({
  id: `${taskCode}-task-session`, taskCode, completionStatus,
});
const trial = (overrides = {}) => ({
  trialIndex: 1,
  taskCode: "SRT",
  isCorrect: true,
  reactionTimeMs: 500,
  actualResponse: "hit",
  validTrial: true,
  exclusionReasons: [],
  taskSpecificMetadata: { targetType: "normal", trainingAction: "hit" },
  processingVersion: "trial-normalizer-1.0.0",
  ...overrides,
});
const build = (trials, options = {}) => buildTaskFeatureRow({
  participantId: "research-participant-1",
  sessionId: "session-1",
  taskSession: taskSession(options.taskCode, options.status),
  trials,
});

describe("general feature edge cases", () => {
  test("empty trials", () => {
    const row = build([]);
    expect(row.analysis_trial_count).toBe(0);
    expect(row.accuracy).toBeNull();
    expect(row.rt_mean).toBeNull();
  });

  test("single trial", () => {
    const row = build([trial()]);
    expect(row.accuracy).toBe(1);
    expect(row.rt_sd).toBe(0);
    expect(row.rt_slope_ms_per_trial).toBeNull();
  });

  test("all correct", () => {
    const row = build([trial(), trial({ trialIndex: 2, reactionTimeMs: 600 })]);
    expect(row.accuracy).toBe(1);
    expect(row.error_rate).toBe(0);
    expect(row.maximum_error_streak).toBe(0);
  });

  test("all incorrect", () => {
    const row = build([
      trial({ isCorrect: false, actualResponse: "miss" }),
      trial({ trialIndex: 2, isCorrect: false, actualResponse: "miss" }),
    ]);
    expect(row.accuracy).toBe(0);
    expect(row.error_rate).toBe(1);
    expect(row.maximum_error_streak).toBe(2);
  });

  test("extreme RT remains if quality layer marks it valid", () => {
    const row = build([trial({ reactionTimeMs: 999999 })]);
    expect(row.rt_max).toBe(999999);
    expect(row.srt_extreme_slow_response_rate).toBe(1);
  });

  test("missing RT does not become zero", () => {
    const row = build([trial({ reactionTimeMs: null })]);
    expect(row.rt_count).toBe(0);
    expect(row.rt_mean).toBeNull();
    expect(row.accuracy).toBe(1);
  });

  test("interrupted session produces no analytical trials", () => {
    const row = build([trial()], { status: "interrupted" });
    expect(row.interrupted_session).toBe(true);
    expect(row.analysis_trial_count).toBe(0);
    expect(row.excluded_trial_count).toBe(1);
  });

  test("duplicated and invalid trials are excluded, not removed from quality counts", () => {
    const row = build([
      trial(),
      trial({ trialIndex: 2, validTrial: false, exclusionReasons: ["duplicated_trial"] }),
      trial({ trialIndex: 3, validTrial: false, exclusionReasons: ["impossible_reaction_time"] }),
    ]);
    expect(row.total_trial_count).toBe(3);
    expect(row.analysis_trial_count).toBe(1);
    expect(row.excluded_trial_count).toBe(2);
    expect(row.exclusion_reason_counts.duplicated_trial).toBe(1);
  });
});

test("temporal and speed-accuracy features preserve their base variables", () => {
  const row = build([
    trial({ trialIndex: 1, isCorrect: true, reactionTimeMs: 800 }),
    trial({ trialIndex: 2, isCorrect: true, reactionTimeMs: 700 }),
    trial({ trialIndex: 3, isCorrect: false, reactionTimeMs: 600 }),
    trial({ trialIndex: 4, isCorrect: false, reactionTimeMs: 500 }),
  ]);
  expect(row.early_accuracy).toBe(1);
  expect(row.late_accuracy).toBe(0);
  expect(row.accuracy_change_late_minus_early).toBe(-1);
  expect(row.accuracy).toBe(0.5);
  expect(row.rt_mean).toBe(650);
  expect(row.inverse_efficiency_ms).toBe(1300);
});

test("participant cross-task dataset prefixes features and excludes identity bridge", () => {
  const srt = build([trial()]);
  const pm = buildTaskFeatureRow({
    participantId: "research-participant-1",
    sessionId: "session-1",
    taskSession: taskSession("PM"),
    trials: [trial({ taskCode: "PM", taskSpecificMetadata: { memoryCount: 3 }, actualResponse: ["a"] })],
  });
  const [row] = buildParticipantCrossTaskDataset([srt, pm]);
  expect(row.included_task_codes).toEqual(["PM", "SRT"]);
  expect(row.srt_accuracy).toBe(1);
  expect(row.picture_memory_accuracy).toBe(1);
  expect(row).not.toHaveProperty("patient_id");
});

