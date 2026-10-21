import { DCCS_DIFFICULTY_ORDER, DCCS_TRAINING_CONFIG, getDccsWindState, normalizeDccsTrainingDifficulty } from "./dccsTrainingProtocol";
import { analyzeDccsTraining } from "../ai/dccsTrainingAnalyzer";
import { getDccsClinicalMetrics } from "./dccsClinicalMetrics";
import { normalizeGameResult } from "./resultManager";

test("wind changes at the exact onset and end, and has no effect on other levels", () => {
  expect(getDccsWindState(5999)).toEqual({ active: false, nextChangeMs: 1 });
  expect(getDccsWindState(6000)).toEqual({ active: true, nextChangeMs: 6000 });
  expect(getDccsWindState(11999)).toEqual({ active: true, nextChangeMs: 1 });
  expect(getDccsWindState(12000)).toEqual({ active: false, nextChangeMs: 6000 });
  expect(getDccsWindState(6000, DCCS_TRAINING_CONFIG.hard).active).toBe(false);
});

test("legacy IDs and out-of-range routes resolve to the five supported levels", () => {
  expect(normalizeDccsTrainingDifficulty("colorStable")).toBe("beginner");
  expect(normalizeDccsTrainingDifficulty("lowInterference")).toBe("medium");
  expect(normalizeDccsTrainingDifficulty("testLike")).toBe("expert");
  expect(normalizeDccsTrainingDifficulty(10)).toBe("expert");
  expect(normalizeDccsTrainingDifficulty(-1)).toBe("beginner");
  expect(normalizeDccsTrainingDifficulty(null)).toBe("beginner");
  expect(normalizeDccsTrainingDifficulty("unknown", null)).toBeNull();
});

test.each(DCCS_DIFFICULTY_ORDER)("analysis recommendations for %s stay within the five levels", (difficulty) => {
  const result = analyzeDccsTraining({ difficulty, trialLogs: [] });
  expect(result.difficulty).toBe(difficulty);
  expect(result.difficultyLabel).toBe(DCCS_TRAINING_CONFIG[difficulty].label);
  expect(DCCS_DIFFICULTY_ORDER).toContain(result.recommendedDifficulty);
  expect(result.recommendedDifficultyLevel).toBeGreaterThanOrEqual(1);
  expect(result.recommendedDifficultyLevel).toBeLessThanOrEqual(5);
});

test("actual hints, including zero, survive unified payloads and clinical fallbacks", () => {
  for (const promptCount of [0, 2]) {
    const rawResult = { mode: "training", difficulty: "medium", promptCount, reverseRuleTrials: 1,
      promptEvents: Array.from({ length: promptCount }, () => ({ reason: "idle", timestamp: 3000 })),
      protocol: { answerTimeLimitMs: 15000 }, windEvents: [{ active: true }] };
    const normalized = normalizeGameResult({ rawResult, gameId: "DCCS" });
    expect(normalized.metrics).toMatchObject({ promptCount, answerTimeLimitMs: 15000, reverseRuleTrials: 1 });
    expect(getDccsClinicalMetrics({ payload: normalized }).promptCount).toBe(promptCount);
    expect(getDccsClinicalMetrics({ payload: { metrics: normalized.metrics } }).promptCount).toBe(promptCount);
  }
  expect(getDccsClinicalMetrics({ trialLogs: [{ promptCount: 1 }, { promptCount: 0 }] }).promptCount).toBe(1);
  expect(getDccsClinicalMetrics({}).promptCount).toBeNull();
});
