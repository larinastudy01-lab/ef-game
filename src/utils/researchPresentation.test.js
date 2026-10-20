import { buildResearchQualityAlerts, buildResearchTaskContext, researchMean, researchNumber, researchPercent } from "./researchPresentation";

const row = (session, overrides = {}) => ({ participant_id: "anonymous-a", task_code: "CBT", assessment_or_training: "assessment", difficulty: 1,
  session_started_at: `2026-10-${String(session).padStart(2, "0")}T00:00:00Z`, session_completion_status: "completed", accuracy: .5, rt_mean: 500, rt_variability_ms: 20, ...overrides });

test("missing and nonnumeric values are never presented as zero", () => {
  [null, undefined, "", " ", false, [], NaN, Infinity].forEach((value) => {
    expect(researchNumber(value)).toBe("—"); expect(researchPercent(value)).toBe("—");
  });
  expect(researchNumber(0)).toBe("0.000");
  expect(researchPercent(.8)).toBe("80.0%");
  expect(researchMean([null, "", .5, 1])).toBe(.75);
});

test("personal baseline uses chronological observations of the same participant, task, mode and difficulty", () => {
  const context = buildResearchTaskContext([row(8, { accuracy: .8 }), row(1, { accuracy: 0, difficulty: 2 }),
    row(2, { accuracy: .1, assessment_or_training: "training" }), row(3, { accuracy: .2, task_code: "PM" }),
    row(4, { accuracy: .3, participant_id: "anonymous-b" }), row(5, { accuracy: .4 }), row(6, { accuracy: null })], "CBT");
  expect(context.rows).toHaveLength(3);
  expect(context.metrics[0]).toMatchObject({ baseline_value: .4, latest_value: .8, observation_count: 2, absolute_change: .4 });
  expect(context.rows[1].accuracy).toBeNull();
});

test("a missing latest value is withheld rather than replaced with an older observation", () => {
  const context = buildResearchTaskContext([row(1), row(2, { accuracy: .8 }), row(3, { accuracy: null })], "CBT");
  expect(context.metrics[0]).toMatchObject({ baseline_value: .5, latest_value: null, absolute_change: null });
});

test("invalid and unfinished observations remain gaps and never generate clinical critical alerts", () => {
  const rows = [row(1, { accuracy: 1.2, rt_mean: -5 }), row(2, { session_completion_status: "interrupted" })];
  const context = buildResearchTaskContext(rows, "CBT");
  expect(context.rows.every((item) => item.accuracy === null && item.rt_mean === null)).toBe(true);
  expect(buildResearchQualityAlerts(rows).some((item) => item.severity === "critical")).toBe(false);
  expect(buildResearchQualityAlerts(rows).map((item) => item.id)).toEqual(["invalid-values", "incomplete-sessions"]);
});
