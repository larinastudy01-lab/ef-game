import {
  getPMRecommendedDifficulty,
  getPMShowTime,
  normalizePMDifficulty,
  PM_ANSWER_TIME_SECONDS,
  PM_DIFFICULTY_ORDER,
  PM_MAX_MEMORY_COUNT,
  PM_PROTOCOL_VERSION,
  PM_TEST_SHOW_TIME,
  PM_TRAINING_CONFIG,
} from "./pmProtocol";

test("the five training stages increase memory load with ceilings 2, 4, 5, 6, and 7", () => {
  expect(PM_PROTOCOL_VERSION).toBe("2.0.0");
  expect(PM_DIFFICULTY_ORDER).toEqual(["beginner", "easy", "medium", "hard", "expert"]);
  expect(PM_MAX_MEMORY_COUNT).toBe(7);
  expect(PM_DIFFICULTY_ORDER.map((key) => PM_TRAINING_CONFIG[key].maxMemory)).toEqual([2, 4, 5, 6, 7]);
  expect(PM_DIFFICULTY_ORDER.map((key) => PM_TRAINING_CONFIG[key].minMemory)).toEqual([2, 3, 4, 5, 6]);
  expect(PM_DIFFICULTY_ORDER.map((key) => PM_TRAINING_CONFIG[key].step)).toEqual([1, 2, 3, 4, 5]);
});

test("every stage retains a 15-second answer limit while training viewing time follows memory load", () => {
  expect(PM_ANSWER_TIME_SECONDS).toBe(15);
  PM_DIFFICULTY_ORDER.forEach((key) => expect(PM_TRAINING_CONFIG[key].answerTime).toBe(15));
  expect([2, 3, 4, 5, 6, 7].map(getPMShowTime)).toEqual([3, 3, 5, 5, 5, 5]);
  expect(PM_TEST_SHOW_TIME).toBe(5);
});

test("only the entry stage requests a mouse prompt after 3 seconds", () => {
  expect(PM_TRAINING_CONFIG.beginner).toMatchObject({ hintLevel: 1, idleHintDelay: 3000 });
  PM_DIFFICULTY_ORDER.slice(1).forEach((key) => {
    expect(PM_TRAINING_CONFIG[key]).toMatchObject({ hintLevel: 0, idleHintDelay: null });
  });
});

test("canonical keys, Chinese labels, and existing saved difficulty values resolve to five levels", () => {
  PM_DIFFICULTY_ORDER.forEach((key, index) => {
    expect(normalizePMDifficulty(key)).toBe(key);
    expect(normalizePMDifficulty(index + 1)).toBe(key);
    expect(normalizePMDifficulty(PM_TRAINING_CONFIG[key].label)).toBe(key);
    expect(normalizePMDifficulty(`Lv.${index + 1}`)).toBe(key);
  });
  expect(normalizePMDifficulty("veryEasy")).toBe("beginner");
  expect(normalizePMDifficulty("normal")).toBe("medium");
  expect(normalizePMDifficulty(6)).toBe("expert");
  expect(normalizePMDifficulty("Lv.7")).toBe("expert");
  expect(normalizePMDifficulty("unrecognized")).toBeNull();
});

test("recommendations follow demonstrated memory capacity and accuracy", () => {
  expect([2, 3, 4, 5, 6, 7].map((span) => getPMRecommendedDifficulty(span, 1)))
    .toEqual(["beginner", "easy", "medium", "hard", "expert", "expert"]);
  expect(getPMRecommendedDifficulty(7, 0.59)).toBe("beginner");
});
