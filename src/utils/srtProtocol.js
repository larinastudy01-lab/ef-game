// Intervals are stimulus onset-to-onset times, independent of response speed.
export const SRT_PROTOCOL_VERSION = "2.0.0";
export const SRT_TEST_PROTOCOL_VERSION = "2.1.0";
export const SRT_ITEM_SIZE = 118;
export const SRT_TEST_INTERVALS = [1000, 3000];
export const SRT_TEST_VISIBLE_TIME = 500;
export const SRT_TEST_TYPE_BLOCK = ["normal", "normal", "normal", "rotten"];
export const SRT_VARIABLE_INTERVALS = [1000, 1500, 2000, 2500, 3000];
export const SRT_DIFFICULTY_ORDER = ["beginner", "easy", "medium", "hard", "expert"];

const makeConfig = (key, step, label, totalTime, goldenRate, rottenRate, extra = {}) => ({
  key, step, displayKey: key, label, storyLabel: label,
  totalTime,
  // A safety cap must not truncate the planned session at the fastest interval.
  maxTrials: Math.ceil(totalTime / 1000) + 1,
  itemSize: SRT_ITEM_SIZE,
  visibleTime: 1000,
  intervals: [1000],
  normalRate: Number((1 - goldenRate - rottenRate).toFixed(2)),
  goldenRate,
  rottenRate,
  waitForResponse: false,
  ...extra,
});

export const SRT_TRAINING_SETTINGS = {
  beginner: makeConfig("beginner", 1, "入門", 180000, 0, 0, {
    waitForResponse: true,
    visibleTime: null,
    promptDelay: 3000,
    subtitle: "點擊後才出現下一顆；等待 3 秒會顯示滑鼠提示。",
  }),
  easy: makeConfig("easy", 2, "簡單", 210000, 0, 0, {
    subtitle: "每秒一顆普通橡實，沒有金色或壞橡實。",
  }),
  medium: makeConfig("medium", 3, "中等", 300000, 0.05, 0.3, {
    subtitle: "每秒一顆，壞橡實 30%，金色獎勵橡實 5%。",
  }),
  hard: makeConfig("hard", 4, "難", 390000, 0.1, 0.2, {
    intervals: SRT_VARIABLE_INTERVALS,
    subtitle: "間隔 1～3 秒隨機變化，壞橡實 20%，金色獎勵橡實 10%。",
  }),
  expert: makeConfig("expert", 5, "專業", 480000, 0.15, 0.1, {
    intervals: SRT_VARIABLE_INTERVALS,
    visibleTime: 800,
    subtitle: "間隔 1～3 秒隨機變化，停留 0.8 秒；壞橡實 10%，金色獎勵橡實 15%。",
  }),
};

// Existing saved plans and links continue to resolve to one of the five levels.
const LEGACY_DIFFICULTIES = {
  "easy-1": "beginner", "easy-2": "easy", "easy-3": "easy",
  "medium-1": "medium", "medium-2": "medium", "medium-3": "medium",
  "hard-1": "hard", "hard-2": "hard", "hard-3": "expert",
  normal: "medium",
  入門: "beginner", 簡單: "easy", 中等: "medium", 難: "hard", 專業: "expert",
};

export function normalizeSrtDifficulty(key) {
  return SRT_TRAINING_SETTINGS[key] ? key : LEGACY_DIFFICULTIES[key] || null;
}

export function getSrtDifficultyStep(key) {
  return SRT_TRAINING_SETTINGS[normalizeSrtDifficulty(key)]?.step || 1;
}

export function getSrtDifficultyFromStep(step) {
  const index = Math.min(5, Math.max(1, Math.round(Number(step) || 1))) - 1;
  return SRT_DIFFICULTY_ORDER[index];
}

export function pickSrtInterval(intervals, random = Math.random) {
  return intervals[Math.min(intervals.length - 1, Math.floor(random() * intervals.length))];
}

export function createSrtTargetBlock(config, random = Math.random) {
  const goldenCount = Math.round(config.goldenRate * 20);
  const rottenCount = Math.round(config.rottenRate * 20);
  const block = [
    ...Array(20 - goldenCount - rottenCount).fill("normal"),
    ...Array(goldenCount).fill("golden"),
    ...Array(rottenCount).fill("rotten"),
  ];
  for (let index = block.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [block[index], block[swapIndex]] = [block[swapIndex], block[index]];
  }
  return block;
}
