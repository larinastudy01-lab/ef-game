// src/config/stickerConfig.js

/**
 * 貼紙設定檔
 *
 * 建議素材位置：
 * public/stickers/common/
 * public/stickers/rare/
 * public/stickers/special/
 * public/stickers/achievement/
 *
 * 規則：
 * 1. 帽子遊戲只能抽到一般貼紙。
 * 2. 一般貼紙可以重複獲得。
 * 3. 3 張相同一般貼紙可固定合成 1 張稀有貼紙。
 * 4. 3 張相同稀有貼紙可固定合成 1 張特別貼紙。
 * 5. 特別貼紙不可再合成。
 * 6. 成就貼紙每個 achievementId + stage 只能取得一次。
 * 7. 成就貼紙不進入帽子遊戲獎池，也不可合成。
 */

export const STICKER_SCHEMA_VERSION = "1.0.0";

export const STICKER_TYPES = Object.freeze({
  COMMON: "common",
  RARE: "rare",
  SPECIAL: "special",
  ACHIEVEMENT: "achievement",
});

export const STICKER_TYPE_LABELS = Object.freeze({
  [STICKER_TYPES.COMMON]: "一般貼紙",
  [STICKER_TYPES.RARE]: "稀有貼紙",
  [STICKER_TYPES.SPECIAL]: "特別貼紙",
  [STICKER_TYPES.ACHIEVEMENT]: "成就貼紙",
});

export const STICKER_RARITY_ORDER = Object.freeze({
  [STICKER_TYPES.COMMON]: 1,
  [STICKER_TYPES.RARE]: 2,
  [STICKER_TYPES.SPECIAL]: 3,
  [STICKER_TYPES.ACHIEVEMENT]: 4,
});

export const STICKER_ASSET_BASE = "/stickers";

export const FUSION_REQUIRED_COUNT = 3;

export const FUSION_EXP_REWARDS = Object.freeze({
  COMMON_TO_RARE: 10,
  RARE_TO_SPECIAL: 20,
});

/**
 * 一般收藏貼紙
 *
 * hatWeight：
 * 帽子遊戲抽取權重，數字越高越容易抽到。
 *
 * fusionTargetId：
 * 三張相同一般貼紙固定合成的稀有貼紙 ID。
 */
export const COMMON_STICKERS = Object.freeze({
  common_leaf: {
    id: "common_leaf",
    name: "森林小葉子",
    description: "一片在森林中輕輕搖曳的小葉子。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/leaf.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/leaf.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_golden_leaf",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 12,
    tags: ["森林", "植物"],
  },

  common_acorn: {
    id: "common_acorn",
    name: "可愛橡實",
    description: "小松鼠最喜歡的森林橡實。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/acorn.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/acorn.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_golden_acorn",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 12,
    tags: ["森林", "橡實"],
  },

  common_mushroom: {
    id: "common_mushroom",
    name: "小蘑菇",
    description: "躲在樹蔭下的可愛小蘑菇。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/mushroom.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/mushroom.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_magic_mushroom",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 11,
    tags: ["森林", "植物"],
  },

  common_flower: {
    id: "common_flower",
    name: "森林小花",
    description: "在陽光下盛開的森林小花。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/flower.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/flower.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_rainbow_flower",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 11,
    tags: ["森林", "花朵"],
  },

  common_butterfly: {
    id: "common_butterfly",
    name: "彩色蝴蝶",
    description: "在森林花叢間飛舞的小蝴蝶。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/butterfly.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/butterfly.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_shining_butterfly",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 10,
    tags: ["森林", "昆蟲"],
  },

  common_bee: {
    id: "common_bee",
    name: "勤勞小蜜蜂",
    description: "每天認真採蜜的小蜜蜂。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/bee.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/bee.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_honey_bee",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 10,
    tags: ["森林", "昆蟲"],
  },

  common_apple: {
    id: "common_apple",
    name: "紅蘋果",
    description: "香甜又有精神的森林紅蘋果。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/apple.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/apple.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_crystal_apple",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 10,
    tags: ["森林", "水果"],
  },

  common_berry: {
    id: "common_berry",
    name: "森林莓果",
    description: "藏在森林深處的小莓果。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/berry.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/berry.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_star_berry",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 9,
    tags: ["森林", "水果"],
  },

  common_cloud: {
    id: "common_cloud",
    name: "軟綿白雲",
    description: "飄過森林上空的軟綿白雲。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/cloud.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/cloud.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_rainbow_cloud",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 9,
    tags: ["天空", "自然"],
  },

  common_moon: {
    id: "common_moon",
    name: "彎彎月亮",
    description: "晚上守護森林的彎彎月亮。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/moon.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/moon.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_dreamy_moon",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 8,
    tags: ["天空", "夜晚"],
  },

  common_star: {
    id: "common_star",
    name: "閃亮星星",
    description: "在夜空中閃閃發亮的小星星。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/star.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/star.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_golden_star",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 8,
    tags: ["天空", "星星"],
  },

  common_rainbow: {
    id: "common_rainbow",
    name: "小小彩虹",
    description: "雨後出現在森林上方的小彩虹。",
    type: STICKER_TYPES.COMMON,
    rarity: STICKER_TYPES.COMMON,
    image: `${STICKER_ASSET_BASE}/common/rainbow.png`,
    thumbnail: `${STICKER_ASSET_BASE}/common/rainbow.png`,
    obtainableFromHatGame: true,
    repeatable: true,
    fusionEnabled: true,
    fusionTargetId: "rare_shining_rainbow",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    hatWeight: 8,
    tags: ["天空", "彩虹"],
  },
});

/**
 * 稀有貼紙
 *
 * 稀有貼紙不可從帽子遊戲直接取得，
 * 只能由 3 張固定的一般貼紙合成。
 */
export const RARE_STICKERS = Object.freeze({
  rare_golden_leaf: {
    id: "rare_golden_leaf",
    name: "金色森林葉",
    description: "被森林陽光染成金色的葉子。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/golden_leaf.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/golden_leaf.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_leaf",
    fusionTargetId: "special_star_tree",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["森林", "植物", "金色"],
  },

  rare_golden_acorn: {
    id: "rare_golden_acorn",
    name: "金色橡實",
    description: "只有努力探索森林才能找到的金色橡實。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/golden_acorn.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/golden_acorn.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_acorn",
    fusionTargetId: "special_acorn_guardian",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["森林", "橡實", "金色"],
  },

  rare_magic_mushroom: {
    id: "rare_magic_mushroom",
    name: "魔法蘑菇",
    description: "會散發柔和光芒的神奇蘑菇。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/magic_mushroom.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/magic_mushroom.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_mushroom",
    fusionTargetId: "special_magic_forest",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["森林", "魔法"],
  },

  rare_rainbow_flower: {
    id: "rare_rainbow_flower",
    name: "彩虹花朵",
    description: "擁有彩虹色花瓣的森林花朵。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/rainbow_flower.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/rainbow_flower.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_flower",
    fusionTargetId: "special_flower_garden",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["森林", "花朵", "彩虹"],
  },

  rare_shining_butterfly: {
    id: "rare_shining_butterfly",
    name: "星光蝴蝶",
    description: "翅膀上帶著星光的小蝴蝶。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/shining_butterfly.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/shining_butterfly.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_butterfly",
    fusionTargetId: "special_butterfly_dream",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["森林", "昆蟲", "星光"],
  },

  rare_honey_bee: {
    id: "rare_honey_bee",
    name: "蜂蜜守護者",
    description: "守護森林蜂蜜的小蜜蜂。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/honey_bee.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/honey_bee.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_bee",
    fusionTargetId: "special_honey_castle",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["森林", "昆蟲", "蜂蜜"],
  },

  rare_crystal_apple: {
    id: "rare_crystal_apple",
    name: "水晶蘋果",
    description: "像水晶一樣閃亮的森林蘋果。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/crystal_apple.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/crystal_apple.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_apple",
    fusionTargetId: "special_crystal_tree",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["森林", "水果", "水晶"],
  },

  rare_star_berry: {
    id: "rare_star_berry",
    name: "星星莓果",
    description: "表面有著小星星圖案的莓果。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/star_berry.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/star_berry.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_berry",
    fusionTargetId: "special_star_picnic",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["森林", "水果", "星星"],
  },

  rare_rainbow_cloud: {
    id: "rare_rainbow_cloud",
    name: "彩虹雲朵",
    description: "帶著淡淡彩虹光芒的雲朵。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/rainbow_cloud.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/rainbow_cloud.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_cloud",
    fusionTargetId: "special_sky_castle",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["天空", "雲朵", "彩虹"],
  },

  rare_dreamy_moon: {
    id: "rare_dreamy_moon",
    name: "夢幻月亮",
    description: "會守護森林夥伴好夢的月亮。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/dreamy_moon.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/dreamy_moon.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_moon",
    fusionTargetId: "special_moonlight_forest",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["天空", "夜晚", "夢幻"],
  },

  rare_golden_star: {
    id: "rare_golden_star",
    name: "金色星星",
    description: "閃耀著溫暖金光的星星。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/golden_star.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/golden_star.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_star",
    fusionTargetId: "special_starry_sky",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["天空", "星星", "金色"],
  },

  rare_shining_rainbow: {
    id: "rare_shining_rainbow",
    name: "閃耀彩虹",
    description: "照亮整座森林的閃耀彩虹。",
    type: STICKER_TYPES.RARE,
    rarity: STICKER_TYPES.RARE,
    image: `${STICKER_ASSET_BASE}/rare/shining_rainbow.png`,
    thumbnail: `${STICKER_ASSET_BASE}/rare/shining_rainbow.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: true,
    fusionSourceId: "common_rainbow",
    fusionTargetId: "special_rainbow_forest",
    fusionRequiredCount: FUSION_REQUIRED_COUNT,
    tags: ["天空", "彩虹", "光芒"],
  },
});

/**
 * 特別貼紙
 *
 * 只能由 3 張相同稀有貼紙固定合成。
 * 特別貼紙不可再合成。
 */
export const SPECIAL_STICKERS = Object.freeze({
  special_star_tree: {
    id: "special_star_tree",
    name: "星光生命樹",
    description: "守護整座森林的星光生命樹。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/star_tree.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/star_tree.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_golden_leaf",
    fusionTargetId: null,
    tags: ["森林", "生命樹", "星光"],
  },

  special_acorn_guardian: {
    id: "special_acorn_guardian",
    name: "橡實森林守護者",
    description: "帶領森林夥伴勇敢探索的橡實守護者。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/acorn_guardian.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/acorn_guardian.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_golden_acorn",
    fusionTargetId: null,
    tags: ["森林", "橡實", "守護者"],
  },

  special_magic_forest: {
    id: "special_magic_forest",
    name: "魔法蘑菇森林",
    description: "充滿柔和光點的魔法蘑菇森林。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/magic_forest.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/magic_forest.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_magic_mushroom",
    fusionTargetId: null,
    tags: ["森林", "蘑菇", "魔法"],
  },

  special_flower_garden: {
    id: "special_flower_garden",
    name: "彩虹花園",
    description: "開滿彩虹花朵的夢幻花園。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/flower_garden.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/flower_garden.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_rainbow_flower",
    fusionTargetId: null,
    tags: ["森林", "花園", "彩虹"],
  },

  special_butterfly_dream: {
    id: "special_butterfly_dream",
    name: "星蝶之夢",
    description: "許多星光蝴蝶共同編織出的美麗夢境。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/butterfly_dream.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/butterfly_dream.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_shining_butterfly",
    fusionTargetId: null,
    tags: ["森林", "蝴蝶", "夢境"],
  },

  special_honey_castle: {
    id: "special_honey_castle",
    name: "蜂蜜城堡",
    description: "由森林蜜蜂守護的甜蜜城堡。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/honey_castle.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/honey_castle.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_honey_bee",
    fusionTargetId: null,
    tags: ["森林", "蜂蜜", "城堡"],
  },

  special_crystal_tree: {
    id: "special_crystal_tree",
    name: "水晶果樹",
    description: "結滿閃亮水晶果實的神奇大樹。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/crystal_tree.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/crystal_tree.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_crystal_apple",
    fusionTargetId: null,
    tags: ["森林", "果樹", "水晶"],
  },

  special_star_picnic: {
    id: "special_star_picnic",
    name: "星光野餐會",
    description: "森林夥伴一起分享星星莓果的野餐會。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/star_picnic.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/star_picnic.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_star_berry",
    fusionTargetId: null,
    tags: ["森林", "野餐", "星光"],
  },

  special_sky_castle: {
    id: "special_sky_castle",
    name: "彩雲天空城",
    description: "藏在彩虹雲朵後方的天空城堡。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/sky_castle.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/sky_castle.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_rainbow_cloud",
    fusionTargetId: null,
    tags: ["天空", "彩雲", "城堡"],
  },

  special_moonlight_forest: {
    id: "special_moonlight_forest",
    name: "月光森林",
    description: "被溫柔月光照亮的寧靜森林。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/moonlight_forest.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/moonlight_forest.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_dreamy_moon",
    fusionTargetId: null,
    tags: ["森林", "月光", "夜晚"],
  },

  special_starry_sky: {
    id: "special_starry_sky",
    name: "金色星空",
    description: "無數金色星星照亮的森林夜空。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/starry_sky.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/starry_sky.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_golden_star",
    fusionTargetId: null,
    tags: ["天空", "星星", "金色"],
  },

  special_rainbow_forest: {
    id: "special_rainbow_forest",
    name: "彩虹奇蹟森林",
    description: "被巨大彩虹環抱的奇蹟森林。",
    type: STICKER_TYPES.SPECIAL,
    rarity: STICKER_TYPES.SPECIAL,
    image: `${STICKER_ASSET_BASE}/special/rainbow_forest.png`,
    thumbnail: `${STICKER_ASSET_BASE}/special/rainbow_forest.png`,
    obtainableFromHatGame: false,
    repeatable: true,
    fusionEnabled: false,
    fusionSourceId: "rare_shining_rainbow",
    fusionTargetId: null,
    tags: ["森林", "彩虹", "奇蹟"],
  },
});

/**
 * 成就貼紙五階段
 */
export const ACHIEVEMENT_STAGES = Object.freeze({
  SEED: {
    id: "seed",
    level: 1,
    name: "種子",
    expReward: 10,
    frame: "seed",
  },
  SPROUT: {
    id: "sprout",
    level: 2,
    name: "嫩芽",
    expReward: 15,
    frame: "sprout",
  },
  FLOWER: {
    id: "flower",
    level: 3,
    name: "花朵",
    expReward: 20,
    frame: "flower",
  },
  FRUIT: {
    id: "fruit",
    level: 4,
    name: "果實",
    expReward: 25,
    frame: "fruit",
  },
  STARLIGHT: {
    id: "starlight",
    level: 5,
    name: "星耀",
    expReward: 30,
    frame: "starlight",
  },
});

export const ACHIEVEMENT_STAGE_LIST = Object.freeze(
  Object.values(ACHIEVEMENT_STAGES).sort((a, b) => a.level - b.level)
);

/**
 * 建立成就貼紙設定
 *
 * 素材命名建議：
 * public/stickers/achievement/{achievementId}_{stage}.png
 *
 * 例如：
 * public/stickers/achievement/star_collector_seed.png
 * public/stickers/achievement/star_collector_sprout.png
 * public/stickers/achievement/star_collector_flower.png
 * public/stickers/achievement/star_collector_fruit.png
 * public/stickers/achievement/star_collector_starlight.png
 */
export function createAchievementSticker({
  achievementId,
  achievementName,
  stage,
  description = "",
  image = null,
}) {
  const safeAchievementId = String(achievementId || "").trim();
  const safeAchievementName = String(achievementName || "").trim();
  const safeStage = String(stage || "").trim();

  const stageConfig = ACHIEVEMENT_STAGE_LIST.find(
    (item) => item.id === safeStage
  );

  if (!safeAchievementId) {
    throw new Error("createAchievementSticker 缺少 achievementId");
  }

  if (!safeAchievementName) {
    throw new Error("createAchievementSticker 缺少 achievementName");
  }

  if (!stageConfig) {
    throw new Error(`無效的成就階段：${safeStage}`);
  }

  const id = `achievement_${safeAchievementId}_${safeStage}`;

  return Object.freeze({
    id,
    name: `${safeAchievementName}・${stageConfig.name}`,
    description:
      description ||
      `完成「${safeAchievementName}」${stageConfig.name}階段獲得的成就貼紙。`,
    type: STICKER_TYPES.ACHIEVEMENT,
    rarity: STICKER_TYPES.ACHIEVEMENT,
    image:
      image ||
      `${STICKER_ASSET_BASE}/achievement/${safeAchievementId}_${safeStage}.png`,
    thumbnail:
      image ||
      `${STICKER_ASSET_BASE}/achievement/${safeAchievementId}_${safeStage}.png`,
    obtainableFromHatGame: false,
    repeatable: false,
    fusionEnabled: false,
    fusionSourceId: null,
    fusionTargetId: null,
    achievementId: safeAchievementId,
    achievementStage: safeStage,
    achievementStageLevel: stageConfig.level,
    expReward: stageConfig.expReward,
    uniqueKey: `${safeAchievementId}:${safeStage}`,
    tags: ["成就", stageConfig.name],
  });
}

/**
 * 一次建立某個成就的五階貼紙
 */
export function createAchievementStickerSeries({
  achievementId,
  achievementName,
  descriptions = {},
  images = {},
}) {
  return ACHIEVEMENT_STAGE_LIST.reduce((result, stageConfig) => {
    const sticker = createAchievementSticker({
      achievementId,
      achievementName,
      stage: stageConfig.id,
      description: descriptions?.[stageConfig.id] || "",
      image: images?.[stageConfig.id] || null,
    });

    result[sticker.id] = sticker;
    return result;
  }, {});
}

/**
 * 將 achievementConfig 中的全部成就轉為貼紙設定。
 *
 * 支援：
 * [
 *   { id: "star_collector", name: "星星收藏家" },
 *   ...
 * ]
 *
 * 或：
 * {
 *   star_collector: { id: "star_collector", name: "星星收藏家" }
 * }
 */
export function buildAchievementStickerConfig(achievementConfig) {
  const achievements = Array.isArray(achievementConfig)
    ? achievementConfig
    : Object.values(achievementConfig || {});

  return achievements.reduce((result, achievement) => {
    if (!achievement?.id || !achievement?.name) {
      return result;
    }

    return {
      ...result,
      ...createAchievementStickerSeries({
        achievementId: achievement.id,
        achievementName: achievement.name,
        descriptions: achievement.stickerDescriptions || {},
        images: achievement.stickerImages || {},
      }),
    };
  }, {});
}

/**
 * 所有一般、稀有、特別貼紙。
 * 成就貼紙由 achievementConfig 動態建立，因此不直接放在這裡。
 */
export const COLLECTION_STICKERS = Object.freeze({
  ...COMMON_STICKERS,
  ...RARE_STICKERS,
  ...SPECIAL_STICKERS,
});

/**
 * 帽子遊戲獎池。
 * 僅包含一般貼紙。
 */
export const HAT_STICKER_POOL = Object.freeze(
  Object.values(COMMON_STICKERS).filter(
    (sticker) => sticker.obtainableFromHatGame === true
  )
);

/**
 * 固定合成對應表。
 *
 * stickerManager 合成時應只讀這個設定，
 * 不可隨機決定合成結果。
 */
export const STICKER_FUSION_MAP = Object.freeze({
  common_leaf: {
    sourceId: "common_leaf",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_golden_leaf",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_acorn: {
    sourceId: "common_acorn",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_golden_acorn",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_mushroom: {
    sourceId: "common_mushroom",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_magic_mushroom",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_flower: {
    sourceId: "common_flower",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_rainbow_flower",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_butterfly: {
    sourceId: "common_butterfly",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_shining_butterfly",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_bee: {
    sourceId: "common_bee",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_honey_bee",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_apple: {
    sourceId: "common_apple",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_crystal_apple",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_berry: {
    sourceId: "common_berry",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_star_berry",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_cloud: {
    sourceId: "common_cloud",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_rainbow_cloud",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_moon: {
    sourceId: "common_moon",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_dreamy_moon",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_star: {
    sourceId: "common_star",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_golden_star",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  common_rainbow: {
    sourceId: "common_rainbow",
    sourceType: STICKER_TYPES.COMMON,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "rare_shining_rainbow",
    targetType: STICKER_TYPES.RARE,
    expReward: FUSION_EXP_REWARDS.COMMON_TO_RARE,
  },

  rare_golden_leaf: {
    sourceId: "rare_golden_leaf",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_star_tree",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_golden_acorn: {
    sourceId: "rare_golden_acorn",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_acorn_guardian",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_magic_mushroom: {
    sourceId: "rare_magic_mushroom",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_magic_forest",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_rainbow_flower: {
    sourceId: "rare_rainbow_flower",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_flower_garden",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_shining_butterfly: {
    sourceId: "rare_shining_butterfly",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_butterfly_dream",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_honey_bee: {
    sourceId: "rare_honey_bee",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_honey_castle",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_crystal_apple: {
    sourceId: "rare_crystal_apple",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_crystal_tree",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_star_berry: {
    sourceId: "rare_star_berry",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_star_picnic",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_rainbow_cloud: {
    sourceId: "rare_rainbow_cloud",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_sky_castle",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_dreamy_moon: {
    sourceId: "rare_dreamy_moon",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_moonlight_forest",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_golden_star: {
    sourceId: "rare_golden_star",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_starry_sky",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },

  rare_shining_rainbow: {
    sourceId: "rare_shining_rainbow",
    sourceType: STICKER_TYPES.RARE,
    requiredCount: FUSION_REQUIRED_COUNT,
    targetId: "special_rainbow_forest",
    targetType: STICKER_TYPES.SPECIAL,
    expReward: FUSION_EXP_REWARDS.RARE_TO_SPECIAL,
  },
});

/**
 * 依 ID 取得一般、稀有或特別貼紙。
 */
export function getStickerById(stickerId, achievementStickers = {}) {
  if (!stickerId) return null;

  return (
    COLLECTION_STICKERS[stickerId] ||
    achievementStickers?.[stickerId] ||
    null
  );
}

/**
 * 判斷貼紙是否存在。
 */
export function isValidStickerId(stickerId, achievementStickers = {}) {
  return Boolean(getStickerById(stickerId, achievementStickers));
}

/**
 * 取得指定類型貼紙。
 */
export function getStickersByType(type, achievementStickers = {}) {
  const allStickers = {
    ...COLLECTION_STICKERS,
    ...achievementStickers,
  };

  return Object.values(allStickers).filter(
    (sticker) => sticker.type === type
  );
}

/**
 * 判斷是否為帽子遊戲可抽貼紙。
 */
export function isHatGameSticker(stickerOrId) {
  const sticker =
    typeof stickerOrId === "string"
      ? getStickerById(stickerOrId)
      : stickerOrId;

  return Boolean(
    sticker &&
      sticker.type === STICKER_TYPES.COMMON &&
      sticker.obtainableFromHatGame === true
  );
}

/**
 * 判斷貼紙是否允許重複取得。
 */
export function isRepeatableSticker(stickerOrId) {
  const sticker =
    typeof stickerOrId === "string"
      ? getStickerById(stickerOrId)
      : stickerOrId;

  return Boolean(sticker?.repeatable);
}

/**
 * 取得合成規則。
 */
export function getFusionRule(sourceStickerId) {
  if (!sourceStickerId) return null;
  return STICKER_FUSION_MAP[sourceStickerId] || null;
}

/**
 * 判斷指定貼紙數量是否可合成。
 */
export function canFuseSticker(sourceStickerId, count) {
  const rule = getFusionRule(sourceStickerId);

  if (!rule) return false;

  const safeCount = Number.isFinite(Number(count))
    ? Math.max(0, Math.floor(Number(count)))
    : 0;

  return safeCount >= rule.requiredCount;
}

/**
 * 取得貼紙下一階合成目標。
 */
export function getFusionTarget(sourceStickerId) {
  const rule = getFusionRule(sourceStickerId);

  if (!rule) return null;

  return getStickerById(rule.targetId);
}

/**
 * 依權重隨機抽取帽子遊戲貼紙。
 *
 * randomFn 可在測試時傳入固定函式，例如：
 * () => 0.5
 */
export function drawRandomHatSticker(randomFn = Math.random) {
  if (!Array.isArray(HAT_STICKER_POOL) || HAT_STICKER_POOL.length === 0) {
    return null;
  }

  const weightedPool = HAT_STICKER_POOL.map((sticker) => ({
    sticker,
    weight:
      Number.isFinite(Number(sticker.hatWeight)) &&
      Number(sticker.hatWeight) > 0
        ? Number(sticker.hatWeight)
        : 1,
  }));

  const totalWeight = weightedPool.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  if (totalWeight <= 0) {
    return HAT_STICKER_POOL[0] || null;
  }

  const randomValue = Math.min(
    0.999999999,
    Math.max(0, Number(randomFn()) || 0)
  );

  let cursor = randomValue * totalWeight;

  for (const item of weightedPool) {
    cursor -= item.weight;

    if (cursor < 0) {
      return item.sticker;
    }
  }

  return weightedPool[weightedPool.length - 1]?.sticker || null;
}

/**
 * 將貼紙依稀有度與名稱排序。
 */
export function sortStickers(stickers = []) {
  return [...stickers].sort((a, b) => {
    const rarityA = STICKER_RARITY_ORDER[a?.type] || 999;
    const rarityB = STICKER_RARITY_ORDER[b?.type] || 999;

    if (rarityA !== rarityB) {
      return rarityA - rarityB;
    }

    return String(a?.name || "").localeCompare(
      String(b?.name || ""),
      "zh-Hant"
    );
  });
}

/**
 * 驗證設定中的合成來源與目標是否都存在。
 * 可在開發環境啟動時呼叫。
 */
export function validateStickerConfig() {
  const errors = [];

  Object.values(COMMON_STICKERS).forEach((sticker) => {
    if (!sticker.id) {
      errors.push("發現缺少 id 的一般貼紙");
    }

    if (!sticker.fusionTargetId) {
      errors.push(`${sticker.id} 缺少 fusionTargetId`);
    }

    if (!RARE_STICKERS[sticker.fusionTargetId]) {
      errors.push(
        `${sticker.id} 的稀有合成目標不存在：${sticker.fusionTargetId}`
      );
    }

    if (!sticker.obtainableFromHatGame) {
      errors.push(`${sticker.id} 未設定為帽子遊戲獎池貼紙`);
    }
  });

  Object.values(RARE_STICKERS).forEach((sticker) => {
    if (!sticker.fusionTargetId) {
      errors.push(`${sticker.id} 缺少 fusionTargetId`);
    }

    if (!SPECIAL_STICKERS[sticker.fusionTargetId]) {
      errors.push(
        `${sticker.id} 的特別合成目標不存在：${sticker.fusionTargetId}`
      );
    }

    if (sticker.obtainableFromHatGame) {
      errors.push(`${sticker.id} 不應進入帽子遊戲獎池`);
    }
  });

  Object.values(SPECIAL_STICKERS).forEach((sticker) => {
    if (sticker.fusionEnabled) {
      errors.push(`${sticker.id} 為特別貼紙，不應允許繼續合成`);
    }

    if (sticker.obtainableFromHatGame) {
      errors.push(`${sticker.id} 不應進入帽子遊戲獎池`);
    }
  });

  Object.values(STICKER_FUSION_MAP).forEach((rule) => {
    const sourceSticker = getStickerById(rule.sourceId);
    const targetSticker = getStickerById(rule.targetId);

    if (!sourceSticker) {
      errors.push(`合成來源不存在：${rule.sourceId}`);
    }

    if (!targetSticker) {
      errors.push(`合成目標不存在：${rule.targetId}`);
    }

    if (rule.requiredCount !== FUSION_REQUIRED_COUNT) {
      errors.push(
        `${rule.sourceId} 的合成數量不是 ${FUSION_REQUIRED_COUNT}`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    commonCount: Object.keys(COMMON_STICKERS).length,
    rareCount: Object.keys(RARE_STICKERS).length,
    specialCount: Object.keys(SPECIAL_STICKERS).length,
    hatPoolCount: HAT_STICKER_POOL.length,
    fusionRuleCount: Object.keys(STICKER_FUSION_MAP).length,
  };
}

const stickerConfig = Object.freeze({
  schemaVersion: STICKER_SCHEMA_VERSION,
  types: STICKER_TYPES,
  typeLabels: STICKER_TYPE_LABELS,
  rarityOrder: STICKER_RARITY_ORDER,
  assetBase: STICKER_ASSET_BASE,
  fusionRequiredCount: FUSION_REQUIRED_COUNT,
  fusionExpRewards: FUSION_EXP_REWARDS,
  common: COMMON_STICKERS,
  rare: RARE_STICKERS,
  special: SPECIAL_STICKERS,
  collection: COLLECTION_STICKERS,
  hatPool: HAT_STICKER_POOL,
  fusionMap: STICKER_FUSION_MAP,
  achievementStages: ACHIEVEMENT_STAGES,
});

export default stickerConfig;