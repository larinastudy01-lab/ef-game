import { buildBehavioralHierarchy } from "../buildBehavioralHierarchy";
import { mapRawTrial } from "../taskFieldMappers";
import { validateTrial, validateTrialCollection } from "../validation";

const taskCases = [
  ["CBT", { trialIndex: 1, targetSequence: [1, 3], userSequence: [1, 3], isCorrect: true, reactionTime: 900 }, [1, 3]],
  ["PM", { trialNumber: 1, correctIds: ["a"], selectedIds: ["a"], isCorrect: true, reactionTime: 1200 }, ["a"]],
  ["SRT", { trialIndex: 1, targetType: "normal", trainingAction: "hit", isCorrect: true, reactionTime: 350 }, "hit"],
  ["SSG", { trialIndex: 1, expectedTarget: "dog", selectedTarget: "dog", isCorrect: true, reactionTime: 500 }, "dog"],
  ["LB", { trialId: "L1-1", stepInLevel: 1, expectedNumber: 1, clickedNumber: 1, isCorrect: true, rt: 650 }, 1],
  ["DCCS", { trialNumber: 1, ruleStage: "color", correctSide: "top", userAnswerSide: "top", isCorrect: true, responseTime: 700 }, "top"],
];

describe("six-task raw field mapping", () => {
  test.each(taskCases)("maps %s without discarding raw data", (task, raw, expectedActual) => {
    const mapped = mapRawTrial(raw, task, 0);
    expect(mapped.taskCode).toBe(task);
    expect(mapped.actualResponse).toEqual(expectedActual);
    expect(mapped.reactionTimeMs).toBeGreaterThan(0);
    expect(mapped.rawData).toBe(raw);
  });
});

describe("trial validation", () => {
  test("retains multiple exclusion reasons", () => {
    const result = validateTrial({
      taskCode: "SRT", reactionTimeMs: -1, actualResponse: null,
      responseRequired: true, timedOut: true, completed: false,
    });
    expect(result.validTrial).toBe(false);
    expect(result.exclusionReasons).toEqual(expect.arrayContaining([
      "negative_reaction_time", "unfinished_trial", "timeout",
    ]));
  });

  test("marks duplicate source keys instead of deleting them", () => {
    const trials = validateTrialCollection([
      { sourceTrialKey: "1", taskCode: "SRT", actualResponse: "hit", reactionTimeMs: 300 },
      { sourceTrialKey: "1", taskCode: "SRT", actualResponse: "hit", reactionTimeMs: 310 },
    ], { taskCode: "SRT" });
    expect(trials).toHaveLength(2);
    expect(trials[1].exclusionReasons).toContain("duplicated_trial");
  });
});

test("builds Participant to Session to Task to Trial hierarchy without names", () => {
  const hierarchy = buildBehavioralHierarchy({
    resultId: "SRT-test-patient-1",
    createdAt: "2026-07-30T00:00:00.000Z",
    child: { childId: "patient-uuid", name: "Do not export" },
    game: { gameId: "SRT" },
    session: { mode: "test", difficulty: "normal", finishedAt: "2026-07-30T00:01:00.000Z" },
    trials: [{ trialIndex: 1, targetType: "normal", trainingAction: "hit", isCorrect: true, reactionTime: 300 }],
    rawResult: { childName: "Do not export", difficulty: "normal", records: [] },
  }, { deviceInformation: {} });

  expect(hierarchy.participant.patientReference).toBe("patient-uuid");
  expect(hierarchy.participant).not.toHaveProperty("name");
  expect(hierarchy.session.assessmentOrTraining).toBe("assessment");
  expect(hierarchy.taskSession.taskCode).toBe("SRT");
  expect(hierarchy.taskSession.rawData).not.toHaveProperty("childName");
  expect(hierarchy.trials).toHaveLength(1);
  expect(hierarchy.trials[0].validTrial).toBe(true);
});
