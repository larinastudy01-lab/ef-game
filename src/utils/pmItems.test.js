import {
  analyzePMConfusions,
  buildPMQuestion,
  getPMItemPool,
  PM_CONFUSION_DEFINITION,
  PM_ITEM_BY_ID,
  PM_ITEMS,
} from "./pmItems";

const seededRandom = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

test("all 81 new assets have unique category-qualified identifiers and exclude the background", () => {
  expect(PM_ITEMS).toHaveLength(81);
  expect(new Set(PM_ITEMS.map((item) => item.id)).size).toBe(81);
  const expectedCategories = {
    unclassified: 26, car: 7, clothes: 8, furniture: 17, food: 15, ball: 8,
  };
  Object.entries(expectedCategories).forEach(([category, count]) => {
    const items = PM_ITEMS.filter((item) => item.assetCategoryKey === category);
    expect(items).toHaveLength(count);
    items.forEach((item, index) => {
      const number = String(index + 1).padStart(2, "0");
      expect(item.id).toBe(`PM_${category.toUpperCase()}_${number}`);
      expect(item.sourcePath).toBe(`PM/${category === "unclassified" ? "" : `${category}/`}PM_${number}.${category === "unclassified" && number === "07" ? "png" : "webp"}`);
    });
  });
  PM_ITEMS.forEach((item) => {
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
        policy: "categorized_and_shared_pool", forcedSimilarity: false,
      });
      if (memoryCount >= 2) {
        expect(question.targets.some((item) => item.assetCategoryKey === "unclassified")).toBe(true);
        expect(question.targets.some((item) => item.assetCategoryKey !== "unclassified")).toBe(true);
      }
    }
  }
);

test("formal and training questions keep their category pools separate with shared unclassified objects", () => {
  const training = buildPMQuestion(7, { mode: "training", random: seededRandom(21) });
  const assessment = buildPMQuestion(7, { mode: "test", random: seededRandom(21) });
  expect(training.options.every((item) => ["food", "ball", "unclassified"].includes(item.assetCategoryKey))).toBe(true);
  expect(assessment.options.every((item) => ["car", "furniture", "clothes", "unclassified"].includes(item.assetCategoryKey))).toBe(true);
  expect(assessment.similarityCondition).toMatchObject({ mode: "test", forcedSimilarity: false });
  expect(buildPMQuestion(99, { random: seededRandom(2) }).targets).toHaveLength(7);
});

test.each([
  ["test", ["food"]], ["test", ["ball"]], ["practice", ["food"]],
  ["training", ["car"]], ["training", ["clothes"]], ["training", ["furniture"]],
])("%s rejects forbidden categories %s", (mode, categoryKeys) => {
  expect(() => getPMItemPool({ mode, categoryKeys })).toThrow(/Invalid PM/);
});

test.each([
  ["test", ["car", "clothes"], 41], ["test", ["car", "furniture"], 50],
  ["training", ["food"], 41], ["training", ["ball"], 34],
])("%s pool %s has exactly the permitted assets", (mode, categoryKeys, size) => {
  const pool = getPMItemPool({ mode, categoryKeys });
  expect(pool).toHaveLength(size);
  for (let seed = 1; seed <= 20; seed += 1) {
    const question = buildPMQuestion(7, { mode, categoryKeys, random: seededRandom(seed) });
    expect(question.options.every((item) => pool.includes(item))).toBe(true);
  }
});

test("uncategorized objects are not classified as semantically similar just because they share a folder", () => {
  expect(analyzePMConfusions({ targetIds: ["PM_UNCLASSIFIED_01"], selectedIds: ["PM_UNCLASSIFIED_02"] }).errors[0].type).toBe("unrelated");
  // Legacy analysis keeps its original metadata and never points at renamed images.
  expect(PM_ITEM_BY_ID.PM10.categoryKey).toBe("wearables");
  expect(PM_ITEM_BY_ID.PM10.image).toBeUndefined();
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
