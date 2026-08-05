import { buildFuturePerformanceDataset, buildNextSessionDataset, toPerformanceCategory } from "../targets";

test("future target uses only the late trial segment", () => {
  const rows = buildFuturePerformanceDataset([{ participantId: "P1", sessionId: "S1", taskSession: { task_code: "SRT" },
    trials: Array.from({ length: 10 }, (_, index) => ({ trial_index: index + 1, valid_trial: true,
      is_correct: index >= 3, reaction_time_ms: 300 + index })) }], 0.3);
  expect(rows[0].features.early_accuracy).toBe(0);
  expect(rows[0].target).toBe(1);
  expect(toPerformanceCategory(rows, 0.7)[0].target).toBe(1);
});

test("next-session target uses assessment sessions only", () => {
  const rows = buildNextSessionDataset([
    { participant_id: "P1", session_id: "S1", task_code: "CBT", assessment_or_training: "assessment", session_started_at: "2026-01-01", accuracy: 0.4, rt_mean: 800 },
    { participant_id: "P1", session_id: "T1", task_code: "CBT", assessment_or_training: "training", session_started_at: "2026-01-02", accuracy: 1 },
    { participant_id: "P1", session_id: "S2", task_code: "CBT", assessment_or_training: "assessment", session_started_at: "2026-02-01", accuracy: 0.8, rt_mean: 700 },
  ]);
  expect(rows).toHaveLength(1); expect(rows[0].target).toBe(0.8);
});

test("invalid trials cannot enter future-performance features or target", () => {
  const rows = buildFuturePerformanceDataset([{ participantId: "P", trials: [
    { trial_index: 1, valid_trial: true, is_correct: true, reaction_time_ms: 300 },
    { trial_index: 2, valid_trial: false, is_correct: false, reaction_time_ms: -1 },
    { trial_index: 3, valid_trial: true, is_correct: true, reaction_time_ms: 320 },
  ] }], 0.5);
  expect(rows[0].target).toBe(1);
});

