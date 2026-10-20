import {
  analyzePMConfusions,
  buildPMQuestion,
  PM_CONFUSION_DEFINITION,
  PM_ITEM_BY_ID,
  PM_ITEMS,
} from "./pmItems";

const itemIds = (numbers) => numbers.map((number) => `PM${String(number).padStart(2, "0")}`);
const seededRandom = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

test("all 29 object assets have the supplied categories and exclude the background", () => {
  expect(PM_ITEMS).toHaveLength(29);
  expect(new Set(PM_ITEMS.map((item) => item.id)).size).toBe(29);
  expect(PM_ITEMS.map((item) => item.id)).toEqual(itemIds(Array.from({ length: 29 }, (_, index) => index + 1)));
  const expectedCategories = {
    food: [1, 4, 5, 15, 16],
    wearables: [6, 10, 12, 17, 18, 22, 28, 29],
    animal_toys: [8, 19, 20, 21],
    kitchen: [9, 13, 14, 26, 27],
    nature: [7, 11, 24, 25],
    other: [2, 3, 23],
  };
  Object.entries(expectedCategories).forEach(([category, numbers]) => {
    expect(PM_ITEMS.filter((item) => item.categoryKey === category).map((item) => item.id)).toEqual(itemIds(numbers));
  });
  PM_ITEMS.forEach((item, index) => {
    const number = String(index + 1).padStart(2, "0");
    // Jest resolves the imported assets before replacing them with their basename.
    expect(item.image).toBe(`PM_${number}.${index === 7 ? "png" : "webp"}`);
    expect(item.image).not.toContain("background");
    expect(item.alt).toBeTruthy();
    expect(PM_ITEM_BY_ID[item.id]).toBe(item);
  });
});

test.each([1, 2, 3, 4, 5, 6, 7])(
  "a %i-object question includes every target once and caps recognition options at 12",
  (memoryCount) => {
    for (let seed = 1; seed <= 15; seed += 1) {
      const question = buildPMQuestion(memoryCount, { random: seededRandom(seed) });
      expect(question.memoryCount).toBe(memoryCount);
      expect(question.targets).toHaveLength(memoryCount);
      expect(question.options).toHaveLength(Math.min(12, memoryCount * 2));
      expect(question.recognitionOptionCount).toBe(question.options.length);
      expect(new Set(question.optionIds).size).toBe(question.options.length);
      expect(question.optionIds).toEqual(expect.arrayContaining(question.targetIds));
      question.optionIds.forEach((id) => expect(PM_ITEM_BY_ID[id]).toBeDefined());
      expect(question.similarityCondition).toMatchObject({
        policy: "uniform_random_pool", forcedSimilarity: false,
      });
    }
  }
);

test("formal and training questions use the same unscaled stimulus selection policy", () => {
  const training = buildPMQuestion(7, { mode: "training", random: seededRandom(21) });
  const assessment = buildPMQuestion(7, { mode: "test", random: seededRandom(21) });
  expect(assessment.targetIds).toEqual(training.targetIds);
  expect(assessment.optionIds).toEqual(training.optionIds);
  expect(assessment.similarityCondition).toMatchObject({ mode: "test", forcedSimilarity: false });
  expect(buildPMQuestion(99, { random: seededRandom(2) }).targets).toHaveLength(7);
});

test("wrong selections distinguish a defined visual match, a category association, and an unrelated item", () => {
  const result = analyzePMConfusions({
    targetIds: ["PM01", "PM06", "PM07"],
    selectedIds: ["PM15", "PM10", "PM03"],
    optionIds: ["PM01", "PM06", "PM07", "PM15", "PM10", "PM03"],
  });
  expect(result).toMatchObject({
    possibleConfusion: true, possibleConfusionCount: 2,
    visualSimilarityConfusionCount: 1, categoryConfusionCount: 1, unrelatedErrorCount: 1,
  });
  expect(result.errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ selectedId: "PM15", type: "visual_similarity", matchedTargetIds: ["PM01"] }),
    expect.objectContaining({ selectedId: "PM10", type: "same_category", matchedTargetIds: ["PM06"] }),
    expect.objectContaining({ selectedId: "PM03", type: "unrelated", possibleConfusion: false }),
  ]));
  expect(result.definition).toBe(PM_CONFUSION_DEFINITION);
  expect(result.definition).toContain("不能確認實際錯誤原因");
});

test("similarity is checked against missed targets, not targets already recalled correctly", () => {
  const result = analyzePMConfusions({
    targetIds: ["PM01", "PM07"], selectedIds: ["PM01", "PM15"],
  });
  expect(result.missedTargetIds).toEqual(["PM07"]);
  expect(result).toMatchObject({ possibleConfusionCount: 0, unrelatedErrorCount: 1 });
  expect(result.errors[0]).toMatchObject({ selectedId: "PM15", type: "unrelated", matchedTargetIds: [] });
});

test("one wrong selected object is counted once even when it resembles multiple missed targets", () => {
  const result = analyzePMConfusions({
    targetIds: ["PM01", "PM16", "PM01"], selectedIds: ["PM15", "PM15"],
  });
  expect(result.wrongSelectedIds).toEqual(["PM15"]);
  expect(result.missedTargetIds).toEqual(["PM01", "PM16"]);
  expect(result.errors).toHaveLength(1);
  expect(result.possibleConfusionCount).toBe(1);
  expect(result.visualSimilarityConfusionCount).toBe(1);
  expect(result.categoryConfusionCount).toBe(0);
  expect(result.errors[0].matchedTargetIds).toEqual(["PM01", "PM16"]);
});

test("chopsticks share a kitchen category without inheriting the spoon and fork visual group", () => {
  expect(PM_ITEM_BY_ID.PM09.similarityGroup).toBe("handled_utensils");
  expect(PM_ITEM_BY_ID.PM14.similarityGroup).toBe("handled_utensils");
  expect(PM_ITEM_BY_ID.PM13.similarityGroup).toBeNull();
  expect(analyzePMConfusions({ targetIds: ["PM09"], selectedIds: ["PM13"] })).toMatchObject({
    visualSimilarityConfusionCount: 0, categoryConfusionCount: 1,
  });
});

test("correct recall has no confusion errors and unknown ids do not acquire a category", () => {
  expect(analyzePMConfusions({ targetIds: ["PM01"], selectedIds: ["PM01"] })).toMatchObject({
    errors: [], wrongSelectedIds: [], missedTargetIds: [], possibleConfusionCount: 0,
  });
  expect(analyzePMConfusions({ targetIds: ["PM01"], selectedIds: ["unknown"] }).errors[0]).toMatchObject({
    type: "unrelated", categoryKey: null, similarityGroup: null, possibleConfusion: false,
  });
});
