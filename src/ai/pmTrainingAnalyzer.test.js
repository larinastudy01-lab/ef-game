import analyzePMTraining, { calculatePMAIScore, PM_RT_TARGET_MAP } from "./pmTrainingAnalyzer";
import { PM_DIFFICULTY_ORDER } from "../utils/pmProtocol";

const correctTrial = (extra = {}) => ({
  memoryCount: 4, difficulty: "easy", difficultyLevel: 2,
  targetIds: ["PM01", "PM02", "PM03", "PM04"],
  selectedIds: ["PM01", "PM02", "PM03", "PM04"],
  isCorrect: true, reactionTime: 4000,
  clickLogs: [{ itemId: "PM01", action: "selected", timestamp: 500, isCorrectItem: true }],
  ...extra,
});

test("RT and variability are retained without changing the principal score or memory recommendation", () => {
  const input = { accuracy: 1, totalTrials: 2, difficultyLevel: "easy", memorySpan: 4, highestMemorySpan: 4 };
  const fast = calculatePMAIScore({ ...input, avgReactionTime: 1800, reactionTimeStd: 20 });
  const slower = calculatePMAIScore({ ...input, avgReactionTime: 14000, reactionTimeStd: 6000, fatigueLevel: 90 });
  expect(slower.aiScore).toBe(fast.aiScore);
  expect(slower.difficultyDecision).toBe(fast.difficultyDecision);
  expect(slower.difficultyDecision).toBe("increase");
  expect(slower.reactionScore).not.toBe(fast.reactionScore);
  expect(slower).toMatchObject({ avgReactionTime: 14000, reactionTimeStd: 6000,
    scoringWeights: { reaction: 0, stability: 0, fatigue: 0 }, reactionTimeIsObservational: true });
});

test("recommendation uses five levels and their 2/4/5/6/7 memory ceilings", () => {
  const caps = [2, 4, 5, 6, 7];
  PM_DIFFICULTY_ORDER.forEach((key, index) => {
    const records = [correctTrial({ memoryCount: caps[index], difficulty: key, difficultyLevel: index + 1 }),
      correctTrial({ memoryCount: caps[index], difficulty: key, difficultyLevel: index + 1 })];
    const analysis = analyzePMTraining({ records });
    expect(analysis.currentDifficulty).toBe(key);
    expect(analysis.nextDifficultyLevel).toBe(Math.min(5, index + 2));
    expect(analysis.nextMemorySpan).toBe(Math.min(7, caps[index] + 1));
    expect(analysis.nextAnswerTime).toBe(15);
    expect(analysis.nextShowTime).toBe(analysis.nextMemorySpan <= 3 ? 3 : 5);
  });
  expect(analyzePMTraining({ records: [correctTrial({ memoryCount: 3 }), correctTrial({ memoryCount: 3 })] }))
    .toMatchObject({ difficultyDecision: "maintain", recommendedDifficulty: "easy", nextMemorySpan: 3 });
});

test("speed does not affect recommendations from complete recorded trials", () => {
  const fast = analyzePMTraining({ records: [correctTrial({ reactionTime: 1000 }), correctTrial({ reactionTime: 1200 })] });
  const slow = analyzePMTraining({ records: [correctTrial({ reactionTime: 12000 }), correctTrial({ reactionTime: 14900 })] });
  expect(slow.aiScore).toBe(fast.aiScore);
  expect(slow.nextDifficultyLevel).toBe(fast.nextDifficultyLevel);
  expect(slow.nextMemorySpan).toBe(fast.nextMemorySpan);
  expect(slow.avgReactionTime).toBe(13450);
});

test("actual prompts and click histories from unfinished trials survive without lowering completed-answer accuracy", () => {
  const history = [correctTrial(), {
    completed: false, difficulty: "easy", memoryCount: 4, reactionTime: 12000,
    promptEvents: [{ type: "idle_mouse", at: 3000 }, { type: "idle_mouse", at: 8000 }],
    clickLogs: [{ itemId: "PM01", action: "selected", timestamp: 9000 }],
  }];
  const result = analyzePMTraining({ records: history, totalTrials: 2, accuracy: 0.5 });
  expect(result).toMatchObject({ totalTrials: 1, totalRecordedTrials: 2, unfinishedTrialCount: 1,
    correctTrials: 1, wrongTrials: 0, accuracyPercent: 100, promptCount: 2,
    avgReactionTime: 4000, highestSuccessfulMemorySpan: 0, difficultyDecision: "maintain" });
  expect(result.promptEvents).toHaveLength(2);
  expect(result.clickLogs).toHaveLength(2);
  expect(result.records[1]).toMatchObject({ completed: false, promptCount: 2 });
  expect(result.clinicianNotes).toMatchObject({ promptCount: 2, unfinishedTrialCount: 1 });
});

test("assisted completion remains distinct and blocks automatic promotion", () => {
  const records = [correctTrial({ promptCount: 1, promptEvents: [{ type: "idle_mouse", at: 3000 }] }), correctTrial()];
  expect(analyzePMTraining({ records })).toMatchObject({ accuracyPercent: 100,
    cleanCorrectCount: 1, assistedCorrectCount: 1, supportedTrialCount: 1,
    supportRate: 0.5, highestIndependentMemorySpan: 0,
    difficultyDecision: "maintain", recommendedDifficulty: "easy" });
});

test("wrong selections are reported as possible visual/category confusion without making a causal impulsivity claim", () => {
  const records = [correctTrial({ isCorrect: false, targetIds: ["PM01", "PM06", "PM02"],
    selectedIds: ["PM15", "PM10", "PM08"],
    clickLogs: [{ itemId: "PM15", action: "select", timestamp: 2000, isCorrectItem: false }],
  })];
  const result = analyzePMTraining({ records });
  expect(result).toMatchObject({ possibleConfusionCount: 2, visualConfusionCount: 1,
    visualSimilarityConfusionCount: 1, categoryConfusionCount: 1,
    unrelatedWrongCount: 1, unrelatedErrorCount: 1 });
  expect(result.records[0].confusionAnalysis.errors).toHaveLength(3);
  expect(result.trainingSuggestion).toContain("不能直接認定為衝動");
  expect(result.clinicianNotes.confusionInterpretation).toContain("不能確認原因");
});

test("timeouts are censored limits and never enter reaction-time averages or variability", () => {
  const records = [correctTrial({ reactionTime: 2000 }), correctTrial({ reactionTime: 4000 }),
    correctTrial({ isCorrect: false, isTimeout: true, reactionTime: 15000 })];
  const result = analyzePMTraining({ records, avgReactionTime: 7000, reactionTimeStd: 5800 });
  expect(result).toMatchObject({ avgReactionTime: 3000, reactionTimeStd: 1000,
    timeoutTrials: 1, totalTrials: 3 });
  expect(analyzePMTraining({ records: [correctTrial({ isTimeout: true, reactionTime: 15000 })] }))
    .toMatchObject({ avgReactionTime: null, reactionTimeStd: null });
});

test("interrupted sessions with no completed answers retain events and preserve the current level", () => {
  const result = analyzePMTraining({ records: [{ completed: false, difficulty: "hard",
    promptEvents: [{ type: "idle_mouse", at: 3000 }] }] });
  expect(result).toMatchObject({ aiScore: 0, totalTrials: 0, promptCount: 1,
    difficultyDecision: "maintain", recommendedDifficulty: "hard", nextDifficultyLevel: 4,
    avgReactionTime: null, reactionTimeStd: null });
  expect(result.records).toHaveLength(1);
});

test("two failures reduce memory load without changing the viewing rule or answer limit", () => {
  const records = [correctTrial({ difficulty: "hard", difficultyLevel: 4, memoryCount: 6, isCorrect: false }),
    correctTrial({ difficulty: "hard", difficultyLevel: 4, memoryCount: 6, isCorrect: false })];
  const result = analyzePMTraining({ records });
  expect(result).toMatchObject({ earlyStopReason: "span_two_failed", stoppedMemorySpan: 6,
    difficultyDecision: "decrease", recommendedDifficulty: "medium", nextMemorySpan: 5,
    nextShowTime: 5, nextAnswerTime: 15 });
  expect(result.trainingSuggestion).not.toMatch(/延長作答|縮短觀看|縮短作答|增加干擾/);
});

test("legacy numeric difficulty and excessive memory counts clamp to five levels and seven objects", () => {
  expect(calculatePMAIScore({ difficultyLevel: 7, memorySpan: 8, highestMemorySpan: 8,
    accuracy: 1, totalTrials: 2 })).toMatchObject({ difficultyLevel: 5, broadDifficulty: "expert",
    memorySpan: 7, highestMemorySpan: 7, difficultyDecision: "maintain" });
  expect(PM_RT_TARGET_MAP).toMatchObject({ beginner: 15000, easy: 15000, normal: 15000, expert: 15000, 7: 15000 });
});
