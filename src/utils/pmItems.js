import PM01 from "../asset/PM/food/PM_01.webp";
import PM02 from "../asset/PM/PM_02.webp";
import PM03 from "../asset/PM/PM_03.webp";
import PM04 from "../asset/PM/food/PM_04.webp";
import PM05 from "../asset/PM/food/PM_05.webp";
import PM06 from "../asset/PM/clothes/PM_06.webp";
import PM07 from "../asset/PM/PM_07.webp";
import PM08 from "../asset/PM/PM_08.png";
import PM09 from "../asset/PM/food/PM_09.webp";
import PM10 from "../asset/PM/clothes/PM_10.webp";
import PM11 from "../asset/PM/PM_11.webp";
import PM12 from "../asset/PM/clothes/PM_12.webp";
import PM13 from "../asset/PM/food/PM_13.webp";
import PM14 from "../asset/PM/food/PM_14.webp";
import PM15 from "../asset/PM/food/PM_15.webp";
import PM16 from "../asset/PM/food/PM_16.webp";
import PM17 from "../asset/PM/clothes/PM_17.webp";
import PM18 from "../asset/PM/clothes/PM_18.webp";
import PM19 from "../asset/PM/PM_19.webp";
import PM20 from "../asset/PM/PM_20.webp";
import PM21 from "../asset/PM/PM_21.webp";
import PM22 from "../asset/PM/clothes/PM_22.webp";
import PM23 from "../asset/PM/PM_23.webp";
import PM24 from "../asset/PM/PM_24.webp";
import PM25 from "../asset/PM/PM_25.webp";
import PM26 from "../asset/PM/food/PM_26.webp";
import PM27 from "../asset/PM/food/PM_27.webp";
import PM28 from "../asset/PM/clothes/PM_28.webp";
import PM29 from "../asset/PM/clothes/PM_29.webp";

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
const images = [PM01, PM02, PM03, PM04, PM05, PM06, PM07, PM08, PM09, PM10, PM11, PM12, PM13, PM14, PM15, PM16, PM17, PM18, PM19, PM20, PM21, PM22, PM23, PM24, PM25, PM26, PM27, PM28, PM29];
const descriptions = ["紫色奶油蛋糕", "藍色水壺", "紫色禮物盒", "彩色棒棒糖", "莓果果醬", "奶黃色皮鞋", "綠色葉子", "黃色小鴨玩偶", "金色湯匙", "綠色圓面手錶", "彩虹吊飾", "紅色帽子", "金色筷子", "金色叉子", "巧克力蛋糕", "草莓蛋糕", "彩色運動鞋", "奶黃色短靴", "粉紅色兔子玩偶", "藍色熊玩偶", "紫色狗玩偶", "紫色方面手錶", "紫色鬧鐘", "白色雲朵", "黃色太陽", "藍色馬克杯", "粉紅色茶壺", "紫色棒球帽", "粉紅色漁夫帽"];
export const PM_CONFUSION_DEFINITION = "錯選物件與漏選目標具有預先定義的相近外形，或屬於同一素材分類時，記錄為可能混淆；此關聯不能確認實際錯誤原因。";
export const PM_ITEMS = images.map((image, index) => {
  const number = index + 1;
  const [categoryKey, categoryLabel] = categories.find(([, , ids]) => ids.includes(number));
  const group = visualGroups.find(([, , ids]) => ids.includes(number));
  const id = `PM${String(number).padStart(2, "0")}`;
  return { id, image, alt: descriptions[index], categoryKey, categoryLabel,
    similarityGroup: group?.[0] ?? null, similarityDefinition: group?.[1] ?? null };
});
export const PM_ITEM_BY_ID = Object.fromEntries(PM_ITEMS.map((item) => [item.id, item]));

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildPMQuestion(memoryCount, { mode = "training", random = Math.random } = {}) {
  const count = Math.max(1, Math.min(7, Math.round(Number(memoryCount) || 1)));
  const targets = shuffle(PM_ITEMS, random).slice(0, count);
  const targetIds = targets.map((item) => item.id);
  const recognitionOptionCount = Math.min(12, count * 2);
  const distractors = shuffle(PM_ITEMS.filter((item) => !targetIds.includes(item.id)), random)
    .slice(0, recognitionOptionCount - count);
  const options = shuffle([...targets, ...distractors], random);
  const similarityCondition = {
    policy: "uniform_random_pool", mode, categoryScheme: "asset_categories_v1",
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
    const categoryMatches = missedTargetIds.filter((id) => item && item.categoryKey === PM_ITEM_BY_ID[id]?.categoryKey);
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
