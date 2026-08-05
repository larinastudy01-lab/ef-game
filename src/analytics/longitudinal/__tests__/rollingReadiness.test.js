import { addRollingFeatures } from "../rolling";
import { assessMixedEffectsReadiness } from "../modelReadiness";
import { analyzeParticipantLongitudinal } from "../pipeline";

test("rolling values are withheld until enough ordered sessions exist", () => {
  const two = addRollingFeatures([{ session_started_at: "2026-01-01", accuracy: .5 }, { session_started_at: "2026-02-01", accuracy: .7 }]);
  expect(two.every((row) => row.accuracy_rolling_mean === null && !row.rolling_reliable)).toBe(true);
  const three = addRollingFeatures([...two, { session_started_at: "2026-03-01", accuracy: .9 }]);
  expect(three[2].accuracy_rolling_mean).toBeCloseTo(.7); expect(three[2].accuracy_rolling_median).toBe(.7);
});

test("all six task series exist even when some tasks have no observations", () => {
  const result = analyzeParticipantLongitudinal("P1", [{ participant_id: "P1", session_id: "S", task_code: "SRT",
    session_started_at: "2026-01-01", accuracy: .8 }]);
  expect(Object.keys(result.task_series)).toEqual(["CBT", "PM", "SRT", "SSG", "LB", "DCCS"]);
  expect(result.task_series.CBT).toEqual([]); expect(result.comparison_reference).toContain("Personal baseline");
});

test("mixed-effects architecture never claims a fitted result", () => {
  const rows = Array.from({ length: 10 }, (_, participant) => Array.from({ length: 3 }, (_, session) => ({ participant_id: `P${participant}`,
    task_code: "CBT", session_id: `S${session}` }))).flat();
  const readiness = assessMixedEffectsReadiness(rows); expect(readiness.ready).toBe(false); expect(readiness.model_fitted).toBe(false);
  expect(readiness.reason).toContain("No mixed-effects result");
});

