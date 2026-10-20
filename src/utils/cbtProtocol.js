export const CBT_PROTOCOL_VERSION = "2.1.0";
export const CBT_ANSWER_TIME_SECONDS = 15;
export const CBT_MAX_SEQUENCE_LENGTH = 7;
export const CBT_MAX_STONES = 9;
// Leave room to move training stones while keeping every click target separate.
export const CBT_TRAINING_STONE_SIZE = 220;
export const CBT_DIFFICULTY_ORDER = ["beginner", "easy", "medium", "hard", "expert"];

const settings = (key, label, minLevel, maxLevel, extra = {}) => ({
  key, label, macro: key, storyTitle: label,
  minLevel, maxLevel, blockCount: Math.min(CBT_MAX_STONES, maxLevel + 2),
  answerTime: CBT_ANSWER_TIME_SECONDS,
  showSpeed: 800,
  hintLevel: 0,
  idleHintDelay: null,
  allowActiveReplay: false,
  replayLimit: 0,
  spatialSimilarity: "low",
  pathComplexity: "simple",
  backwardRecall: false,
  reverseMode: false,
  randomizePositions: true,
  environment: true,
  ...extra,
});

export const CBT_TRAINING_CONFIG = {
  beginner: settings("beginner", "入門", 2, 3, {
    showSpeed: 1000, hintLevel: 1, idleHintDelay: 3000,
    randomizePositions: false, environment: false,
    storyText: "最多記住 3 步；看完再點，需要時會有滑鼠提示。",
  }),
  easy: settings("easy", "簡單", 3, 4, {
    randomizePositions: false, environment: false,
    storyText: "最多記住 4 步，石頭位置固定。",
  }),
  medium: settings("medium", "中等", 4, 5, {
    storyText: "最多記住 5 步；每題換位置，觀察時會有環境干擾。",
  }),
  hard: settings("hard", "難", 5, 6, {
    storyText: "最多記住 6 步；每題換位置，觀察時會有環境干擾。",
  }),
  expert: settings("expert", "專業", 6, 7, {
    storyText: "最多記住 7 步；每題換位置，觀察時會有環境干擾。",
  }),
};

export function normalizeCBTDifficulty(value) {
  const text = String(value || "").trim().replace(/[-_\s]/g, "").toLowerCase();
  if (CBT_DIFFICULTY_ORDER.includes(text)) return text;
  if (/^veryeasy[123]?$/.test(text) || text === "beginner" || text === "warmup" || text === "入門") return "beginner";
  if (/^easy[123]?$/.test(text) || text === "簡單") return "easy";
  if (/^(normal|advanced)[123]?$/.test(text) || text === "中等") return "medium";
  if (/^hard[123]?$/.test(text) || text === "難") return "hard";
  if (/^expert[123]?$/.test(text) || text === "專業") return "expert";
  return null;
}

// Stable IDs and coordinates: the assessment always uses the same nine stones.
const FIXED_POSITIONS = [
  { top: 82, left: 130 }, { top: 82, left: 380 }, { top: 82, left: 630 },
  { top: 227, left: 130 }, { top: 227, left: 380 }, { top: 227, left: 630 },
  { top: 372, left: 130 }, { top: 372, left: 380 }, { top: 372, left: 630 },
];

export function createFixedCBTBlocks(count = CBT_MAX_STONES) {
  return FIXED_POSITIONS.slice(0, Math.min(CBT_MAX_STONES, Math.max(1, count)))
    .map((position, stoneId) => ({ ...position, stoneId }));
}

export function createVariableCBTBlocks(count, previous = [], random = Math.random) {
  // Move the visible coordinates as well as the IDs. Shuffling a full nine-stone
  // grid alone would leave the expert board looking identical between trials.
  // With 220 × 124 click targets, these offsets preserve at least a 2px gap.
  const positions = createFixedCBTBlocks().map((position) => {
    let left = position.left + Math.round((random() * 2 - 1) * 14);
    const top = position.top + Math.round((random() * 2 - 1) * 10);
    if (previous.some((block) => block.left === left && block.top === top)) {
      left = position.left + (left <= position.left ? 14 : -14);
    }
    return { left, top };
  });
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];
  }
  const next = positions.slice(0, Math.min(CBT_MAX_STONES, Math.max(1, count)));
  return next.map((position, stoneId) => ({ ...position, stoneId }));
}
