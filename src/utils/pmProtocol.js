export const PM_PROTOCOL_VERSION = "2.0.0";
export const PM_ANSWER_TIME_SECONDS = 15;
export const PM_MAX_MEMORY_COUNT = 7;
export const PM_TEST_SHOW_TIME = 5;
export const PM_DIFFICULTY_ORDER = ["beginner", "easy", "medium", "hard", "expert"];

export const PM_TRAINING_CONFIG = {
  beginner: { key: "beginner", label: "入門", step: 1, minMemory: 2, maxMemory: 2, answerTime: 15, hintLevel: 1, idleHintDelay: 3000 },
  easy: { key: "easy", label: "簡單", step: 2, minMemory: 3, maxMemory: 4, answerTime: 15, hintLevel: 0, idleHintDelay: null },
  medium: { key: "medium", label: "中等", step: 3, minMemory: 4, maxMemory: 5, answerTime: 15, hintLevel: 0, idleHintDelay: null },
  hard: { key: "hard", label: "難", step: 4, minMemory: 5, maxMemory: 6, answerTime: 15, hintLevel: 0, idleHintDelay: null },
  expert: { key: "expert", label: "專業", step: 5, minMemory: 6, maxMemory: 7, answerTime: 15, hintLevel: 0, idleHintDelay: null },
};

export function normalizePMDifficulty(value) {
  const raw = String(value ?? "").trim();
  const aliases = { 入門: "beginner", 簡單: "easy", 中等: "medium", 難: "hard", 專業: "expert", veryEasy: "beginner", warmup: "beginner", normal: "medium" };
  if (PM_DIFFICULTY_ORDER.includes(raw)) return raw;
  if (aliases[raw]) return aliases[raw];
  const legacyLevel = raw.match(/^Lv\.?\s*([1-7])$/i);
  const index = Number(legacyLevel?.[1] ?? raw);
  return Number.isInteger(index) && index >= 1 && index <= 7 ? PM_DIFFICULTY_ORDER[Math.min(5, index) - 1] : null;
}

export function getPMShowTime(memoryCount) {
  return Number(memoryCount) <= 3 ? 3 : 5;
}

// Promotion uses demonstrated memory capacity; response speed remains an observation.
export function getPMRecommendedDifficulty(memorySpan, accuracy = 1) {
  if (Number(accuracy) < 0.6) return "beginner";
  const span = Number(memorySpan) || 0;
  if (span >= 6) return "expert";
  if (span >= 5) return "hard";
  if (span >= 4) return "medium";
  if (span >= 3) return "easy";
  return "beginner";
}
