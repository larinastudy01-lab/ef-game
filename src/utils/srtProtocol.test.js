import { createSrtTargetBlock, SRT_TRAINING_SETTINGS, normalizeSrtDifficulty } from "./srtProtocol";
import { calculateSrtScore } from "./srtScoring";
import { getSrtClinicalMetrics } from "./srtClinicalMetrics";
import { analyzeSrtTraining, recommendNextSrtDifficulty } from "../ai/srtTrainingAnalyzer";

const hit = (reactionTime, index, targetType = "normal") => ({
  trialIndex: index + 1, targetType, reactionTime, isCorrect: true, trainingAction: "hit",
});

test.each([["medium", 1, 6], ["hard", 2, 4], ["expert", 3, 2]])(
  "%s keeps the requested gold/no-go proportions after shuffling",
  (difficulty, gold, rotten) => {
    const block = createSrtTargetBlock(SRT_TRAINING_SETTINGS[difficulty]);
    expect(block.filter((type) => type === "golden")).toHaveLength(gold);
    expect(block.filter((type) => type === "rotten")).toHaveLength(rotten);
    expect(block).toHaveLength(20);
  }
);

test("legacy links and recommendations stay within five canonical levels", () => {
  expect(normalizeSrtDifficulty("medium-3")).toBe("medium");
  expect(normalizeSrtDifficulty("hard-3")).toBe("expert");
  const strong = { accuracy: 95, unassistedAccuracy: 95, totalTrials: 30, validRTCount: 30, rtCV: 0.1 };
  expect(recommendNextSrtDifficulty({ ...strong, difficulty: "medium-3" }).nextDifficulty).toBe("hard");
  expect(recommendNextSrtDifficulty({ ...strong, difficulty: "expert" }).nextDifficulty).toBe("expert");
  expect(recommendNextSrtDifficulty({ ...strong, difficulty: "beginner", accuracy: 20 }).nextDifficulty).toBe("beginner");
});

test("equal average speed still exposes increasing late-session variation", () => {
  const records = Array.from({ length: 30 }, (_, index) => hit(
    index < 10 ? 500 : index < 20 ? (index % 2 ? 600 : 400) : (index % 2 ? 800 : 200), index
  ));
  const scoring = calculateSrtScore(records);
  expect(scoring.summary.avgReactionTime).toBe(500);
  expect(scoring.summary.rtStd).toBeGreaterThan(0);
  expect(scoring.summary.longAttentionMetrics).toMatchObject({ rtSlowing: 0, rtStdIncrease: 300, rtCVIncrease: 0.6 });
  const analysis = analyzeSrtTraining({ records, difficulty: "medium", promptCount: 2 });
  expect(analysis.segmentAnalysis).toMatchObject({ rtSlowing: 0, rtStdIncrease: 300 });
  expect(analysis.clinicianSummary).toContain("promptCount=2");
});

test("gold earns game rewards without an independent assessment score", () => {
  const records = Array.from({ length: 20 }, (_, index) => hit(500, index, index < 4 ? "golden" : "normal"));
  const scoring = calculateSrtScore(records, { mode: "training" });
  expect(scoring.summary.goldenHitCount).toBe(4);
  expect(scoring.scoreBreakdown.rewardSearchScore).toBeNull();
  expect(scoring.scoreMeta.unavailableScoreKeys).toContain("rewardSearchScore");
});

test("insufficient RT samples are not presented as zero variation", () => {
  expect(calculateSrtScore([hit(500, 0)]).summary.rtStd).toBeNull();
  expect(calculateSrtScore([hit(500, 0)]).summary.rtCV).toBeNull();
});

test("medical view reads unified results and preserves real zero values and unclicked prompts", () => {
  const rawResult = { rtStd: 0, rtCV: 0, promptEvents: [{ trialIndex: 1 }],
    scoring: { summary: { promptCount: 0 } },
    longAttentionMetrics: { firstThird: { rtStd: 0, rtCV: 0 }, lastThird: { rtStd: 20, rtCV: 0.1 } },
  };
  expect(getSrtClinicalMetrics({ payload: { rawResult } })).toMatchObject({
    rtStd: 0, rtCV: 0, promptCount: 1, rtStdIncrease: 20, rtCVIncrease: 0.1,
  });
  expect(getSrtClinicalMetrics({})).toMatchObject({ rtStd: null, rtCV: null, promptCount: null });
});
