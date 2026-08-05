import { buildParticipantTimeline } from "../timeline";
import { buildLongitudinalFeatureSummary } from "../features";

const rows = [
  { participant_id: "P1", session_id: "S1", task_session_id: "T1", task_code: "CBT", assessment_or_training: "assessment", session_started_at: "2026-01-01", session_completed_at: "2026-01-01", accuracy: .5, rt_mean: 900, rt_variability_ms: 180, cbt_max_span: 2 },
  { participant_id: "P1", session_id: "S2", task_session_id: "T2", task_code: "CBT", assessment_or_training: "training", session_started_at: "2026-02-01", session_completed_at: "2026-02-01", accuracy: .7, rt_mean: 800, rt_variability_ms: 140, cbt_max_span: 3 },
  { participant_id: "P1", session_id: "S3", task_session_id: "T3", task_code: "CBT", assessment_or_training: "assessment", session_started_at: "2026-03-01", session_completed_at: "2026-03-01", accuracy: .8, rt_mean: 750, rt_variability_ms: 120, cbt_max_span: 4 },
];

test("timeline combines assessment, training, task, result, and recommendation chronologically", () => {
  const timeline = buildParticipantTimeline("P1", rows, [{ id: "R1", participant_id: "P1", recommendation_timestamp: "2026-01-15",
    policy_name: "Rule-based", selected_action: { task_code: "CBT", difficulty_level: 2 } }]);
  expect(new Set(timeline.map((item) => item.event_type))).toEqual(new Set(["Assessment", "Training", "Task", "Result", "Recommendation"]));
  expect(timeline.every((item, index) => index === 0 || item.occurred_at >= timeline[index - 1].occurred_at)).toBe(true);
});

test("feature summary compares latest with personal baseline and includes task-specific change", () => {
  const summary = buildLongitudinalFeatureSummary("P1", rows); const task = summary.tasks[0];
  const accuracy = task.metrics.find((metric) => metric.metric === "accuracy"); const span = task.metrics.find((metric) => metric.metric === "cbt_max_span");
  expect(accuracy).toEqual(expect.objectContaining({ baseline_value: .5, latest_value: .8, trend_reliable: true }));
  expect(accuracy.absolute_change).toBeCloseTo(.3);
  expect(span.absolute_change).toBe(2); expect(task.training_count).toBe(1);
});
