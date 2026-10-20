export const ARI_PROTOCOL_VERSION = "3.0.0";
export const ARI_DIFFICULTY_ORDER = ["beginner", "easy", "medium", "hard", "expert"];

export const ARI_TRAINING_CONFIG = Object.fromEntries(ARI_DIFFICULTY_ORDER.map((difficulty, index) => {
  const label = ["入門", "簡單", "中等", "難", "專業"][index];
  return [difficulty, {
    difficulty, difficultyLevel: index + 1, label, difficultyLabel: label,
    totalTrials: 12, answerTimeLimit: [10000, 10000, 5000, 5000, 3000][index],
    preSoundDelay: 500, maxSameRun: 2,
    hintDelayMs: index === 0 ? 3000 : null,
    hintAfterConsecutiveErrors: index === 0 ? 3 : null,
    hintLevel: index === 0 ? "direct" : "none",
    allowReplay: index <= 1, interference: index >= 3, interferenceVolume: 0.25,
  }];
}));

export const ARI_ASSESSMENT_CONFIG = {
  totalTrials: 20, preSoundDelay: 500, answerTimeLimit: 5000, allowReplay: false,
};

export function normalizeAriDifficulty(value, fallback = "beginner") {
  const text = String(value ?? "").trim().toLowerCase();
  const aliases = { veryeasy: "beginner", simple: "easy", normal: "medium", difficult: "hard", advanced: "hard", veryhard: "expert", 入門: "beginner", 初階: "beginner", 簡單: "easy", 中等: "medium", 普通: "medium", 難: "hard", 困難: "hard", 專業: "expert" };
  if (ARI_DIFFICULTY_ORDER.includes(text)) return text;
  if (aliases[text]) return aliases[text];
  const level = Number(text);
  return Number.isInteger(level) && level >= 1 && level <= 5 ? ARI_DIFFICULTY_ORDER[level - 1] : fallback;
}

export const getAriTrainingConfig = (value) => ARI_TRAINING_CONFIG[normalizeAriDifficulty(value)];
