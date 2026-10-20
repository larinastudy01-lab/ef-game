import {
  CBT_MICRO_DIFFICULTY_ORDER,
  calculateCBTScore,
  getCBTBasicStats,
  getExpectedSpanByMicroDifficulty,
  normalizeMicroDifficultyKey,
  normalizeRecord,
} from "./cbtScoring";
import {
  analyzeCBTTraining,
  calculateCBTMetrics,
  detectCBTErrorPattern,
  recommendCBTNextDifficulty,
} from "../ai/cbtTrainingAnalyzer";

const cleanTrial = (extra = {}) => ({
  difficulty: "medium", targetSequence: [0, 2, 1], userSequence: [0, 2, 1],
  sequenceLength: 3, correct: true, reactionTime: 1500, ...extra,
});

test("scoring and recommendations use five levels with the requested sequence ceilings", () => {
  expect(CBT_MICRO_DIFFICULTY_ORDER).toEqual(["beginner", "easy", "medium", "hard", "expert"]);
  expect(CBT_MICRO_DIFFICULTY_ORDER.map(getExpectedSpanByMicroDifficulty)).toEqual([3, 4, 5, 6, 7]);
  expect(normalizeMicroDifficultyKey("veryEasy3")).toBe("beginner");
  expect(normalizeMicroDifficultyKey("normal2")).toBe("medium");
  expect(normalizeMicroDifficultyKey("advanced1")).toBe("medium");
  expect(recommendCBTNextDifficulty({ accuracy: 1 }, 100, "easy")).toMatchObject({
    currentDifficulty: "easy", recommendedDifficulty: "medium", indexDelta: 1,
  });
  expect(recommendCBTNextDifficulty({ accuracy: 1 }, 100, "expert").recommendedDifficulty).toBe("expert");
  expect(recommendCBTNextDifficulty({ accuracy: 0.7, timeoutRate: 0.4 }, 70, "hard")).toMatchObject({
    action: "decrease_sequence_length", recommendedDifficulty: "medium",
  });
});

test("early clicks remain timing events and do not change correct-answer scoring or imply impulsivity", () => {
  const baseline = calculateCBTScore([cleanTrial()]);
  const trial = cleanTrial({ earlyClickCount: 2, earlyClickEvents: [{ at: 300 }, { at: 600 }] });
  const result = calculateCBTScore([trial]);
  expect(result.totalScore).toBe(baseline.totalScore);
  expect(result.summary).toMatchObject({ correctCount: 1, wrongCount: 0, earlyClickCount: 2,
    extraTapErrorCount: 0, earlyErrorCount: 0 });
  expect(result.clinicalView.earlyClickEvents).toHaveLength(2);
  expect(result.clinicalView.interpretationFlags).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "early_click_observed" }),
  ]));
  expect(result.aiAnalysis.mainWeakness).not.toBe("impulsive_tapping");
  expect(result.parentView.plainLanguageSummary).toContain("不能直接據此認定衝動");
  expect(detectCBTErrorPattern({ ...trial, errorPattern: "early_click" })).toBe("clean_correct");
});

test("actual prompt totals include unfinished trials without counting them as failed answers", () => {
  const history = [cleanTrial({ idleHintCount: 2, wrongAnswerHintCount: 1, promptCount: 3 }), {
    completed: false, targetSequence: [1, 2], userSequence: [],
    promptEvents: [{ type: "idle_mouse" }, { type: "idle_mouse" }, { type: "wrong_answer_hint" }],
    earlyClickEvents: [{ at: 500 }],
  }];
  const result = calculateCBTScore(history);
  expect(result.summary).toMatchObject({
    totalTrials: 1, totalRecordedTrials: 2, unfinishedTrialCount: 1,
    correctCount: 1, wrongCount: 0, cleanCorrectCount: 0,
    idleHintCount: 4, totalIdleHintCount: 4, wrongAnswerHintCount: 2, promptCount: 6,
    earlyClickCount: 1,
  });
  expect(result.clinicalView.trialSummaries[1]).toMatchObject({
    completed: false, idleHintCount: 2, wrongAnswerHintCount: 1, promptCount: 3,
    earlyClickCount: 1, errorPattern: "unfinished_trial",
  });
  expect(calculateCBTMetrics(history)).toMatchObject({
    totalRounds: 1, totalRecordedRounds: 2, unfinishedRoundCount: 1,
    totalIdleHintCount: 4, totalWrongAnswerHintCount: 2, totalPromptCount: 6, earlyClickCount: 1,
  });
});

test("an interrupted session with only event records preserves medical evidence", () => {
  const history = [{ completed: false, idleHintCount: 1,
    earlyClickEvents: [{ at: 50 }], promptEvents: [{ type: "idle_mouse" }] }];
  const result = calculateCBTScore(history);
  expect(result.totalScore).toBe(0);
  expect(result.summary).toMatchObject({ totalTrials: 0, wrongCount: 0, idleHintCount: 1,
    promptCount: 1, earlyClickCount: 1 });
  expect(result.records).toHaveLength(1);
  expect(result.clinicalView.trialSummaries).toHaveLength(1);
  expect(analyzeCBTTraining(history).clinicianNotes).toMatchObject({
    totalPromptCount: 1, earlyClickCount: 1, unfinishedRoundCount: 1,
  });
  expect(analyzeCBTTraining(history, { currentDifficulty: "hard" })).toMatchObject({
    performanceScore: 0, recommendedDifficulty: "hard", recommendedAction: "maintain",
  });
});

test("wrong-answer hints mark assisted completion even if older booleans say no hint", () => {
  const record = normalizeRecord(cleanTrial({ usedHint: false, wrongAnswerHintCount: 1,
    promptEvents: [{ type: "wrong_answer_hint" }] }));
  expect(record).toMatchObject({ usedHint: true, cleanCorrect: false, promptCount: 1,
    wrongAnswerHintCount: 1, weightedCorrectValue: 0.75 });
  expect(detectCBTErrorPattern(record)).toBe("assisted_correct");
});

test("missing response times are not converted to zero-speed measurements", () => {
  const stats = getCBTBasicStats([cleanTrial({ reactionTime: null })]);
  expect(stats).toMatchObject({ validReactionTimeCount: 0, averageReactionTime: null,
    averageFirstTapTime: null, averageTapInterval: null, reactionTimeStd: null });
  expect(calculateCBTScore([cleanTrial({ reactionTime: null })]).scoreBreakdown.speedScore).toBe(0);
});
