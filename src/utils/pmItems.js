import { PM_ASSET_ITEMS, PM_ASSET_CATALOG_VERSION, PM_TEST_CATEGORIES, PM_TRAINING_CATEGORIES } from "../config/pmAssets";

const categories = [
  ["food", "食物／甜點", [1, 4, 5, 15, 16]],
  ["wearables", "穿戴配件", [6, 10, 12, 17, 18, 22, 28, 29]],
  ["animal_toys", "動物玩偶", [8, 19, 20, 21]],
  ["kitchen", "餐廚用品", [9, 13, 14, 26, 27]],
  ["nature", "自然物件", [7, 11, 24, 25]],
  ["other", "其他生活物品", [2, 3, 23]],
];
const visualGroups = [
  ["cakes", "蛋糕的外形與層狀結構相近", [1, 15, 16]],
  ["shoes", "鞋子的輪廓與結構相近", [6, 17, 18]],
  ["hats", "帽子的輪廓相近，款式不同", [12, 28, 29]],
  ["watches", "手錶的錶面與錶帶結構相近", [10, 22]],
  ["handled_utensils", "湯匙與叉子的長柄輪廓相近", [9, 14]],
];
const descriptions = ["紫色奶油蛋糕", "藍色水壺", "紫色禮物盒", "彩色棒棒糖", "莓果果醬", "奶黃色皮鞋", "綠色葉子", "黃色小鴨玩偶", "金色湯匙", "綠色圓面手錶", "彩虹吊飾", "紅色帽子", "金色筷子", "金色叉子", "巧克力蛋糕", "草莓蛋糕", "彩色運動鞋", "奶黃色短靴", "粉紅色兔子玩偶", "藍色熊玩偶", "紫色狗玩偶", "紫色方面手錶", "紫色鬧鐘", "白色雲朵", "黃色太陽", "藍色馬克杯", "粉紅色茶壺", "紫色棒球帽", "粉紅色漁夫帽"];
export const PM_CONFUSION_DEFINITION = "錯選物件與漏選目標具有預先定義的相近外形，或屬於同一素材分類時，記錄為可能混淆；此關聯不能確認實際錯誤原因。";
// Retain the old identifiers' analysis metadata without mapping them to new
// pictures that happen to reuse the same filenames.
const legacyItems = Array.from({ length: 29 }, (_, index) => {
  const number = index + 1;
  const [categoryKey, categoryLabel] = categories.find(([, , ids]) => ids.includes(number));
  const group = visualGroups.find(([, , ids]) => ids.includes(number));
  const id = `PM${String(number).padStart(2, "0")}`;
  return { id, alt: descriptions[index], categoryKey, categoryLabel,
    similarityGroup: group?.[0] ?? null, similarityDefinition: group?.[1] ?? null };
});
export const PM_ITEMS = PM_ASSET_ITEMS;
export const PM_ITEM_BY_ID = Object.fromEntries([...legacyItems, ...PM_ITEMS].map((item) => [item.id, item]));

export function getPMItemPool({ mode = "training", categoryKeys } = {}) {
  const allowed = mode === "training" ? PM_TRAINING_CATEGORIES
    : ["test", "practice"].includes(mode) ? PM_TEST_CATEGORIES : null;
  if (!allowed) throw new Error(`Unknown PM mode: ${mode}`);
  const selected = categoryKeys || allowed;
  if (!selected.length || selected.some((category) => !allowed.includes(category))) {
    throw new Error(`Invalid PM ${mode} stimulus categories`);
  }
  return PM_ITEMS.filter((item) => item.assetCategoryKey === "unclassified" || selected.includes(item.assetCategoryKey));
}

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildPMQuestion(memoryCount, { mode = "training", categoryKeys, random = Math.random } = {}) {
  const count = Math.max(1, Math.min(7, Math.round(Number(memoryCount) || 1)));
  const pool = getPMItemPool({ mode, categoryKeys });
  // Include both a categorized item and a shared item, then sample the rest
  // uniformly. The same rule applies to test, practice and training.
  const shared = pool.filter((item) => item.assetCategoryKey === "unclassified");
  const categorized = pool.filter((item) => item.assetCategoryKey !== "unclassified");
  const anchors = count >= 2 ? [shuffle(categorized, random)[0], shuffle(shared, random)[0]] : [];
  const targets = shuffle([...anchors, ...shuffle(pool.filter((item) => !anchors.includes(item)), random).slice(0, count - anchors.length)], random);
  const targetIds = targets.map((item) => item.id);
  const recognitionOptionCount = Math.min(12, count * 2);
  const distractors = shuffle(pool.filter((item) => !targetIds.includes(item.id)), random)
    .slice(0, recognitionOptionCount - count);
  const options = shuffle([...targets, ...distractors], random);
  const similarityCondition = {
    policy: "categorized_and_shared_pool", mode, categoryScheme: "asset_categories_v2",
    assetCatalogVersion: PM_ASSET_CATALOG_VERSION,
    categoryKeys: [...(categoryKeys || (mode === "training" ? PM_TRAINING_CATEGORIES : PM_TEST_CATEGORIES))],
    poolSize: pool.length,
    forcedSimilarity: false, definition: PM_CONFUSION_DEFINITION,
    distractorAssociations: analyzePMConfusions({ targetIds, selectedIds: distractors.map((item) => item.id), optionIds: options.map((item) => item.id) }).errors,
  };
  return { targets, options, targetIds, optionIds: options.map((item) => item.id),
    memoryCount: count, recognitionOptionCount, similarityCondition };
}

export function analyzePMConfusions({ targetIds = [], selectedIds = [], optionIds = [] } = {}) {
  const targetSet = new Set(targetIds);
  const selectedSet = new Set(selectedIds);
  const wrongSelectedIds = [...selectedSet].filter((id) => !targetSet.has(id));
  const missedTargetIds = [...targetSet].filter((id) => !selectedSet.has(id));
  const errors = wrongSelectedIds.map((selectedId) => {
    const item = PM_ITEM_BY_ID[selectedId];
    const visualMatches = missedTargetIds.filter((id) => item?.similarityGroup && item.similarityGroup === PM_ITEM_BY_ID[id]?.similarityGroup);
    const categoryMatches = missedTargetIds.filter((id) => item?.categoryKey && item.categoryKey !== "unclassified" && item.categoryKey === PM_ITEM_BY_ID[id]?.categoryKey);
    const type = visualMatches.length ? "visual_similarity" : categoryMatches.length ? "same_category" : "unrelated";
    return { selectedId, categoryKey: item?.categoryKey ?? null, categoryLabel: item?.categoryLabel ?? null,
      similarityGroup: item?.similarityGroup ?? null, type, possibleConfusion: type !== "unrelated",
      matchedTargetIds: visualMatches.length ? visualMatches : categoryMatches,
      definition: type === "visual_similarity" ? item.similarityDefinition : type === "same_category" ? "同一素材分類，未必外形相近" : "未符合已定義的相近外形或同分類關聯" };
  });
  const visualSimilarityConfusionCount = errors.filter((error) => error.type === "visual_similarity").length;
  const categoryConfusionCount = errors.filter((error) => error.type === "same_category").length;
  const unrelatedErrorCount = errors.filter((error) => error.type === "unrelated").length;
  return { wrongSelectedIds, missedTargetIds, optionIds, errors,
    possibleConfusion: visualSimilarityConfusionCount + categoryConfusionCount > 0,
    possibleConfusionCount: visualSimilarityConfusionCount + categoryConfusionCount,
    visualSimilarityConfusionCount, visualConfusionCount: visualSimilarityConfusionCount,
    categoryConfusionCount, unrelatedErrorCount, unrelatedWrongCount: unrelatedErrorCount,
    definition: PM_CONFUSION_DEFINITION };
}
