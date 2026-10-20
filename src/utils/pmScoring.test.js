import { calculatePMScore, getPMBasicStats } from "./pmScoring";

const correctTrials = (times) => times.map((reactionTime, index) => ({
  trialIndex: index + 1, mode: "training", memoryCount: 5, difficulty: "medium",
  targetIds: ["PM01", "PM02", "PM03", "PM04", "PM05"], selectedIds: ["PM01", "PM02", "PM03", "PM04", "PM05"],
  isCorrect: true, reactionTime, tapLogs: [],
}));

test("speed and RT variation stay observations and do not change the primary score", () => {
  const fast = calculatePMScore(correctTrials([1000, 1200]), { mode: "training" });
  const slow = calculatePMScore(correctTrials([9000, 14000]), { mode: "training" });
  expect(fast.totalScore).toBe(slow.totalScore);
  expect(fast.stars).toBe(slow.stars);
  expect(fast.summary.averageCorrectReactionTime).not.toBe(slow.summary.averageCorrectReactionTime);
  expect(fast.summary.reactionTimeStd).not.toBe(slow.summary.reactionTimeStd);
  expect(fast.scoreBreakdown.scoringWeights).toMatchObject({ speed: 0, stability: 0 });
});

test("actual hints, unfinished clicks and supported correct responses remain distinguishable", () => {
  const records = correctTrials([1000, 2000]);
  records[0].promptEvents = [{ type: "idle_mouse", timestamp: 3000 }];
  records.push({ completed: false, promptCount: 1, promptEvents: [{ type: "idle_mouse" }], clickLogs: [{ action: "select", itemId: "PM06" }] });
  const result = calculatePMScore(records);
  expect(result.summary).toMatchObject({ totalTrials: 2, unfinishedTrialCount: 1, promptCount: 2, cleanCorrectCount: 1, assistedCorrectCount: 1 });
  expect(result.clinicalView.interpretationFlags.map((flag) => flag.type)).toContain("support_used");
  expect(result.clinicalView.levelSummaries[0]).toMatchObject({ promptCount: 1, usedSupport: true });
  expect(result.records[2].clickLogs).toEqual(records[2].clickLogs);
});

test("final lookalike confusion uses missed targets and survives clinical and per-trial summaries", () => {
  const records = [{ targetIds: ["PM10", "PM13"], selectedIds: ["PM22", "PM26"], isCorrect: false,
    memoryCount: 2, reactionTime: 5000, clickLogs: [{ itemId: "PM22", action: "select", isCorrectItem: false, timestamp: 1000 }] }];
  const result = calculatePMScore(records);
  for (const view of [result.summary, result.clinicalView]) expect(view).toMatchObject({ possibleConfusionCount: 2, visualConfusionCount: 1, categoryConfusionCount: 1 });
  expect(result.clinicalView.levelSummaries[0].confusionAnalysis.errors).toHaveLength(2);
  expect(result.clinicalView.interpretationFlags.map((flag) => flag.type)).toContain("possible_confusion");
});

test("timeout upper limits do not invent an observed RT or standard deviation", () => {
  const stats = getPMBasicStats([{ isTimeout: true, reactionTime: 15000 }, { isTimeout: true, reactionTime: 15000 }]);
  expect(stats.averageReactionTime).toBeNull();
  expect(stats.reactionTimeStd).toBeNull();
});
