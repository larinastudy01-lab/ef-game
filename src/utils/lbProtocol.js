export const LB_PROTOCOL_VERSION = "2.0.0";
export const LB_DIFFICULTY_ORDER = ["beginner", "easy", "medium", "hard", "expert"];

const createLevel = (key, label, index, { backward = false, colorSwitch = false, hints = false, answerTimeLimit = 15 } = {}) => {
  const numbers = Array.from({ length: 10 }, (_, number) => number + 1);
  if (backward) numbers.reverse();
  const explicitSequence = numbers.map((number) => ({
    number, color: colorSwitch ? (number % 2 ? "red" : "blue") : "cream",
  }));
  const iconHint = explicitSequence.slice(0, 4).map(({ number, color }) =>
    `${colorSwitch ? (color === "red" ? "紅" : "藍") : ""}${number}`).join(" → ") + " → …";
  return {
    id: String(index), difficulty: key, difficultyLevel: index, difficultyLabel: label,
    chapter: label, title: `${backward ? "倒序" : "正序"}${colorSwitch ? "與顏色交替" : "門牌"}`,
    ruleType: colorSwitch ? "redBlue" : backward ? "backward" : "forward",
    taskType: colorSwitch ? "ruleSwitch" : "findSequence",
    maxNumber: 10, sequenceLength: 10, explicitSequence, iconHint,
    ability: colorSwitch ? "數字排序與顏色規則切換" : "數字排序",
    enableBackwardRule: backward, enableColorSwitchRule: colorSwitch,
    enableMemoryTask: false, enableMixedMission: false, enablePositionShuffle: false,
    hintMode: hints ? "delay" : "none", hintDelayMs: hints ? 3000 : null,
    hintOnRuleError: key === "easy", answerTimeLimit,
    feedbackDelayCorrectMs: 420, feedbackDelayWrongMs: 680, reviewStepMs: 520,
  };
};

export const LB_TRAINING_CONFIG = {
  beginner: createLevel("beginner", "入門", 1, { hints: true, answerTimeLimit: 20 }),
  easy: createLevel("easy", "簡單", 2, { colorSwitch: true, hints: true }),
  medium: createLevel("medium", "中等", 3, { colorSwitch: true }),
  hard: createLevel("hard", "難", 4, { backward: true }),
  expert: createLevel("expert", "專業", 5, { backward: true, colorSwitch: true }),
};

export function normalizeLBDifficulty(value) {
  const text = String(value ?? "").trim().toLowerCase();
  const aliases = { veryeasy: "beginner", normal: "medium", veryhard: "expert", 入門: "beginner", 非常簡單: "beginner", 簡單: "easy", 中等: "medium", 普通: "medium", 難: "hard", 困難: "hard", 專業: "expert", 非常困難: "expert" };
  if (LB_DIFFICULTY_ORDER.includes(text)) return text;
  if (aliases[text]) return aliases[text];
  const level = Number(text);
  return Number.isInteger(level) && level >= 1 && level <= 5 ? LB_DIFFICULTY_ORDER[level - 1] : null;
}

export function getLBTrainingConfig(value) {
  return LB_TRAINING_CONFIG[normalizeLBDifficulty(value) || "beginner"];
}
