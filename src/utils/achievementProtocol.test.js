import {
  achievementDayKey, evaluateAchievementResult, getGrowthAchievementStates,
  preserveLegacyAchievementAwards, readAchievementProgress, recordAchievementResult,
} from "./achievementProtocol";
import { createTrainingAchievementAssignment } from "./useTrainingAchievementAssignment";

jest.mock("../temporaryGameTesting/runtime", () => ({
  gameLocalStorage: globalThis.window.localStorage, isTemporaryGameTesting: jest.fn(() => false),
}));
const { isTemporaryGameTesting } = require("../temporaryGameTesting/runtime");

function result(overrides = {}, assignmentOverrides = {}) {
  return {
    gameId: "LB", childId: "child-1", resultId: "attempt-1", mode: "training", completed: true,
    status: "completed", difficulty: "easy", difficultyLabel: "簡單", totalTrials: 10, accuracy: 80,
    finishedAt: "2026-10-16T04:00:00.000Z", promptCount: 3,
    achievementAssignment: { policyVersion: 2, id: "plan-1", gameId: "LB", childId: "child-1",
      source: "system_plan", difficulty: "easy", issuedAt: "2026-10-16T03:00:00.000Z", ...assignmentOverrides },
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  isTemporaryGameTesting.mockReturnValue(false);
});

test.each(["SRT", "PM", "CBT", "ARI", "DCCS", "LB"])("%s uses the same 80-percent rule and allows original hints", (gameId) => {
  const raw = result({ gameId }, { gameId });
  expect(recordAchievementResult(raw)).toMatchObject({ qualified: true, credited: true, promptCount: 3 });
  const badge = getGrowthAchievementStates(readAchievementProgress("child-1")).find((item) => item.gameId === gameId);
  expect(badge).toMatchObject({ value: 1, level: 1, nextThreshold: 3 });
});

test.each([
  [{ accuracy: 79.99 }, {}, "below_accuracy_target"],
  [{ accuracy: null }, {}, "below_accuracy_target"],
  [{ accuracy: 101 }, {}, "below_accuracy_target"],
  [{ mode: "test" }, {}, "not_training"],
  [{ completed: false, accuracy: 100 }, {}, "incomplete"],
  [{ completed: undefined }, {}, "incomplete"],
  [{ status: "interrupted" }, {}, "incomplete"],
  [{ totalTrials: 0 }, {}, "incomplete"],
  [{ difficulty: "hard" }, {}, "difficulty_mismatch"],
  [{}, { childId: "another-child" }, "assignment_mismatch"],
  [{}, { gameId: "PM" }, "assignment_mismatch"],
  [{}, { source: "manual" }, "unassigned_difficulty"],
  [{ achievementAssignment: null }, {}, "unassigned_difficulty"],
  [{ finishedAt: "bad-date" }, {}, "invalid_timestamp"],
])("ineligible result %j does not change permanent progress", (overrides, assignmentOverrides, reason) => {
  expect(recordAchievementResult(result(overrides, assignmentOverrides))).toMatchObject({ qualified: false, credited: false, reason });
  expect(readAchievementProgress("child-1").credits).toEqual([]);
});

test("ratio accuracy, literal one percent and clinician assignment keep their intended meanings", () => {
  expect(evaluateAchievementResult(result({ accuracy: 0.8 }))).toMatchObject({ qualified: true, accuracy: 80 });
  expect(evaluateAchievementResult(result({ accuracy: 1 }))).toMatchObject({ qualified: true, accuracy: 100 });
  expect(evaluateAchievementResult(result({ accuracy: 1, accuracyPercent: 1 }))).toMatchObject({ qualified: false });
  expect(evaluateAchievementResult(result({}, { source: "clinician" }))).toMatchObject({ qualified: true, assignmentSource: "clinician" });
});

test("one credit per game per Taipei day, isolated by child, with retry deduplication", () => {
  recordAchievementResult(result());
  expect(recordAchievementResult(result())).toMatchObject({ credited: false, reason: "already_recorded" });
  expect(recordAchievementResult(result({ resultId: "attempt-2", finishedAt: "2026-10-16T15:59:59Z" }))).toMatchObject({ credited: false, reason: "daily_limit" });
  expect(recordAchievementResult(result({ resultId: "attempt-3", finishedAt: "2026-10-16T16:00:00Z" }))).toMatchObject({ credited: true, dayKey: "2026-10-17" });
  expect(recordAchievementResult(result({ gameId: "PM", resultId: "pm-1" }, { gameId: "PM" }))).toMatchObject({ credited: true });
  expect(recordAchievementResult(result({ childId: "child-2", resultId: "child-2-first" }, { childId: "child-2" }))).toMatchObject({ credited: true });
  expect(readAchievementProgress("child-1").credits).toHaveLength(3);
  expect(readAchievementProgress("child-2").credits).toHaveLength(1);
  expect(achievementDayKey("2026-10-16T16:00:00Z")).toBe("2026-10-17");
});

test("all five tiers unlock at 1/3/6/10/15 and remain after later failure, difficulty reduction, or old-history eviction", () => {
  const tierAtCount = { 1: 1, 2: 1, 3: 2, 5: 2, 6: 3, 9: 3, 10: 4, 14: 4, 15: 5 };
  for (let day = 1; day <= 15; day += 1) {
    recordAchievementResult(result({ resultId: `day-${day}`, finishedAt: `2026-11-${String(day).padStart(2, "0")}T04:00:00Z`, difficulty: day < 10 ? "hard" : "beginner" }, { difficulty: day < 10 ? "hard" : "beginner" }));
    const state = getGrowthAchievementStates(readAchievementProgress("child-1")).find((badge) => badge.gameId === "LB");
    if (tierAtCount[day]) expect(state.level).toBe(tierAtCount[day]);
  }
  const before = readAchievementProgress("child-1");
  recordAchievementResult(result({ resultId: "later-failure", accuracy: 0 }));
  localStorage.removeItem("efGameResults");
  localStorage.removeItem("achievementResultLedger_child-1");
  expect(readAchievementProgress("child-1")).toEqual(before);
  expect(before.awards.LB[5]).toMatchObject({ threshold: 15, difficulty: "beginner" });
});

test("legacy owned levels freeze once and remain in their child's collection", () => {
  expect(preserveLegacyAchievementAwards("child-1", [{ id: "old", level: 3 }, { id: "locked", level: 0 }])).toEqual([{ id: "old", level: 3 }]);
  expect(preserveLegacyAchievementAwards("child-1", [])).toEqual([{ id: "old", level: 3 }]);
  expect(preserveLegacyAchievementAwards("child-2", [])).toEqual([]);
});

test("QA records never grant achievements or persist state", () => {
  isTemporaryGameTesting.mockReturnValue(true);
  expect(recordAchievementResult(result())).toMatchObject({ credited: false, reason: "game_testing" });
  expect(localStorage.length).toBe(0);
});

test("assignment evidence distinguishes the training plan, clinical assignment, recommendation, default and manual practice", () => {
  localStorage.setItem("currentChild", JSON.stringify({ childId: "child-1" }));
  const options = { gameId: "LB", difficulty: "easy", trainingLevel: 2 };
  const plan = { gameId: "LB", childId: "child-1", trainingLevel: 2, source: "system_plan" };
  const assign = (location) => createTrainingAchievementAssignment({ ...options, location });
  expect(assign({ state: { trainingAssignment: plan, trainingLevel: 2 } })).toMatchObject({ source: "system_plan", difficulty: "easy" });
  expect(assign({ state: { trainingAssignment: { ...plan, source: "clinician" }, trainingLevel: 2 } })).toMatchObject({ source: "clinician" });
  expect(assign({ state: { isRecommended: true, difficulty: "easy" } })).toMatchObject({ source: "system_recommendation" });
  expect(assign({})).toMatchObject({ source: "system_default" });
  expect(assign({ search: "?difficulty=easy" })).toBeNull();
  expect(assign({ state: { trainingAssignment: { ...plan, trainingLevel: 4 }, trainingLevel: 2 } })).toBeNull();
  expect(assign({ search: "?gameTesting=1" })).toBeNull();
});
