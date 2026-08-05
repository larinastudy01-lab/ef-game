import { analyzeBehavioralStatistics } from "../analysisPipeline";
import { calculateLongitudinalChanges, summarizeLongitudinalChanges } from "../longitudinal";

const row = (session, date, accuracy, rt, mode = "assessment") => ({
  participant_id: "rp-1", session_id: session, task_session_id: `${session}-SRT`, task_code: "SRT",
  assessment_or_training: mode, session_started_at: date,
  accuracy, rt_mean: rt, rt_variability_ms: 100, error_rate: 1 - accuracy,
  maximum_error_streak: 1, rt_slope_ms_per_trial: 2, performance_slope_per_trial: 0,
  analysis_trial_count: 10, excluded_trial_count: 0,
});

test("longitudinal comparison orders assessments and ignores training", () => {
  const changes = calculateLongitudinalChanges([
    row("a2", "2026-02-01", 0.8, 500), row("training", "2026-01-15", 1, 100, "training"),
    row("a1", "2026-01-01", 0.6, 600),
  ]);
  expect(changes).toHaveLength(1);
  expect(changes[0].accuracy_change).toBeCloseTo(0.2);
  expect(changes[0].rt_change_ms).toBe(-100);
});

test("small longitudinal samples remain descriptive", () => {
  const summary = summarizeLongitudinalChanges(calculateLongitudinalChanges([
    row("a1", "2026-01-01", 0.6, 600), row("a2", "2026-02-01", 0.8, 500),
  ]));
  expect(summary[0].inferential_test_performed).toBe(false);
  expect(summary[0].inferential_reason).toMatch(/descriptive/i);
});

test("analysis pipeline creates the four required exports", () => {
  const analysis = analyzeBehavioralStatistics([
    row("a1", "2026-01-01", 0.6, 600), row("a2", "2026-02-01", 0.8, 500),
  ]);
  expect(Object.keys(analysis.exports).sort()).toEqual([
    "correlations.csv", "longitudinal_statistics.csv", "statistics_summary.csv", "task_statistics.csv",
  ]);
  expect(analysis.exports["task_statistics.csv"]).toContain("task_code");
  expect(analysis.languageGuardrail).toMatch(/causation/i);
});
