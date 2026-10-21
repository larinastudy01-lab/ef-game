export const DCCS_TRAINING_PROTOCOL_VERSION = "dccs-training-5-levels-v1";
export const DCCS_DIFFICULTY_ORDER = Object.freeze(["beginner", "easy", "medium", "hard", "expert"]);

const level = (id, label, ruleSequence, totalTrials, hints, extra = {}) => Object.freeze({
  id, label, title: label, ruleSequence: Object.freeze(ruleSequence), totalTrials,
  hintPolicy: hints ? "idle" : "none", hintDelayMs: hints ? 3000 : null,
  answerTimeLimitMs: hints ? 15000 : 10000,
  showSwitchGuide: ruleSequence.includes("type"), showBagGuide: ruleSequence.includes("dualRule"),
  feedbackMode: hints ? "guided" : "resultOnly", interferenceRate: 0.5, bagInterferenceRate: 0.5,
  category: id === "beginner" ? "singleRule" : id === "expert" ? "interference" : "switch",
  focus: id === "beginner" ? "colorRule" : id === "expert" ? "inhibition" : "ruleSwitch",
  minimumTrials: id === "beginner" ? 3 : 4,
  ...extra,
});

export const DCCS_TRAINING_CONFIG = Object.freeze({
  beginner: level("beginner", "入門", ["color"], 6, true, {
    description: "先按照衣服顏色分類。", childGoal: "練習看顏色", parentGoal: "建立顏色分類規則",
  }),
  easy: level("easy", "簡單", ["color", "type"], 8, true, {
    switchPoint: 4, description: "先按照衣服顏色，再按照衣服種類分類。",
    childGoal: "練習顏色與種類切換", parentGoal: "觀察顏色轉換至種類的表現",
  }),
  medium: level("medium", "中等", ["color", "type", "dualRule"], 12, true, {
    firstSwitchPoint: 4, secondSwitchPoint: 8,
    description: "先看顏色，再看種類，最後依裝袋線索分類。",
    childGoal: "練習裝袋規則", parentGoal: "觀察多階段規則切換與提示需求",
  }),
  hard: level("hard", "難", ["color", "type", "dualRule"], 12, false, {
    firstSwitchPoint: 4, secondSwitchPoint: 8,
    description: "先看顏色，再看種類，最後依裝袋線索分類，每題 10 秒。",
    childGoal: "獨立完成分類", parentGoal: "觀察無提示下的規則切換",
  }),
  expert: level("expert", "專業", ["color", "type", "dualRule"], 15, false, {
    firstSwitchPoint: 5, secondSwitchPoint: 10, windEnabled: true,
    windCalmMs: 6000, windDurationMs: 6000,
    description: "風來時選相反的分類箱，風停後恢復原本規則，每題 10 秒。",
    childGoal: "跟著風切換正反規則", parentGoal: "觀察反向規則的切換與恢復",
  }),
});

// Old saved difficulty names remain readable; new sessions use only five IDs.
const LEGACY_DIFFICULTIES = {
  colorIntro: "beginner", colorStable: "beginner", color_intro: "beginner", color_stable: "beginner",
  typeIntro: "easy", typeStable: "easy", type_intro: "easy", type_stable: "easy",
  switchClear: "easy", switchEarly: "easy", switchMaintain: "easy",
  switch_clear: "easy", switch_early: "easy", switch_maintain: "easy",
  lowInterference: "medium", low_interference: "medium", highInterference: "hard", high_interference: "hard",
  testLike: "expert", test_like: "expert", normal: "medium", interference: "hard",
  easyIntro: "beginner", easyPlus: "beginner", switchIntro: "easy", switchPlus: "easy",
  入門: "beginner", 簡單: "easy", 中等: "medium", 普通: "medium", 難: "hard", 困難: "hard", 專業: "expert",
};

export function normalizeDccsTrainingDifficulty(value, fallback = "beginner") {
  if (DCCS_DIFFICULTY_ORDER.includes(value)) return value;
  const text = String(value ?? "").trim();
  if (LEGACY_DIFFICULTIES[text]) return LEGACY_DIFFICULTIES[text];
  const number = Number(text.replace(/^level/i, ""));
  if (text && Number.isFinite(number)) return DCCS_DIFFICULTY_ORDER[Math.min(4, Math.max(0, Math.round(number) - 1))];
  return fallback;
}

export function getDccsTrainingConfig(value) {
  return DCCS_TRAINING_CONFIG[normalizeDccsTrainingDifficulty(value)];
}

export function getDccsTrainingCorrectPosition(trial, windActive = false) {
  if (!trial) return null;
  const key = trial.card?.[trial.matchBy || trial.rule];
  const side = trial.topTarget?.key === key ? "top" : trial.bottomTarget?.key === key ? "bottom" : null;
  return side && windActive ? (side === "top" ? "bottom" : "top") : side;
}

export function getDccsWindState(elapsedMs, config = DCCS_TRAINING_CONFIG.expert) {
  if (!config.windEnabled) return { active: false, nextChangeMs: null };
  const offset = Math.max(0, elapsedMs) % (config.windCalmMs + config.windDurationMs);
  const active = offset >= config.windCalmMs;
  return { active, nextChangeMs: (active ? config.windCalmMs + config.windDurationMs : config.windCalmMs) - offset };
}
