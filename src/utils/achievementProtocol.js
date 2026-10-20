import { gameLocalStorage as storage, isTemporaryGameTesting } from "../temporaryGameTesting/runtime";
import { getAriTrainingConfig, normalizeAriDifficulty } from "./ariProtocol";

export const ACHIEVEMENT_POLICY_VERSION = 2;
export const ACHIEVEMENT_THRESHOLDS = [1, 3, 6, 10, 15];
export const ACHIEVEMENT_LEVEL_NAMES = ["銅級", "銀級", "金級", "鑽石級", "星耀級"];
export const ACHIEVEMENT_RULE_TEXT = "依推薦或指定難度完整完成訓練，正確率達 80%，每天每款遊戲累積一次。可使用該難度原有提示。";
export const GROWTH_ACHIEVEMENTS = [
  ["SRT", "橡實守護者", "srt_acorn_guardian"],
  ["PM", "圖片記憶家", "pm_memory_span"],
  ["CBT", "石頭路記憶家", "cbt_memory_span"],
  ["ARI", "聲音反轉家", "ari_opposite_master"],
  ["DCCS", "規則切換家", "dccs_rule_switcher"],
  ["LB", "門牌導航員", "lb_doorplate_navigator"],
].map(([gameId, name, imageId]) => ({
  id: `growth_${gameId.toLowerCase()}`, gameId, category: gameId, name, imageId,
  thresholds: ACHIEVEMENT_THRESHOLDS, description: ACHIEVEMENT_RULE_TEXT, unit: "次",
}));

const parse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
const numeric = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
const keyFor = (childId) => `achievementProgress_v2_${childId}`;
export const legacyAchievementKey = (childId) => `achievementLegacyAwards_v1_${childId}`;

export function achievementDayKey(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  // A fixed calendar prevents a timezone change from crediting the same day twice.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type).value).join("-");
}

export function achievementDifficultyKey(value, gameId) {
  const text = String(value ?? "").trim().toLowerCase();
  if (gameId === "ARI") return normalizeAriDifficulty(value, null) || text;
  const aliases = gameId === "ARI"
    ? { beginner: "easy", medium: "normal", expert: "hard", 簡單: "easy", 普通: "normal", 困難: "hard" }
    : { veryeasy: "beginner", normal: "medium", veryhard: "expert", 入門: "beginner", 簡單: "easy", 中等: "medium", 普通: "medium", 難: "hard", 專業: "expert" };
  return aliases[text] || text;
}

export function achievementDifficultyLabel(value, gameId) {
  const key = achievementDifficultyKey(value, gameId);
  if (gameId === "ARI" && normalizeAriDifficulty(value, null)) return getAriTrainingConfig(value).label;
  const labels = gameId === "ARI" ? { easy: "簡單", normal: "普通", hard: "困難" }
    : { beginner: "入門", easy: "簡單", medium: "中等", hard: "難", expert: "專業" };
  return labels[key] || String(value || "未記錄");
}

export function readAchievementProgress(childId) {
  const raw = parse(storage.getItem(keyFor(childId)), {});
  return { version: ACHIEVEMENT_POLICY_VERSION, credits: Array.isArray(raw.credits) ? raw.credits : [], awards: raw.awards && typeof raw.awards === "object" ? raw.awards : {} };
}

export function evaluateAchievementResult(result = {}) {
  const payload = result.payload || result;
  const raw = payload.rawResult || payload;
  const gameId = String(payload.game?.gameId || raw.gameId || raw.taskCode || "").toUpperCase();
  const assignment = raw.achievementAssignment;
  const childId = String(payload.child?.childId || raw.childId || assignment?.childId || "");
  const mode = payload.session?.mode || raw.mode;
  const timestamp = payload.session?.finishedAt || raw.finishedAt || raw.createdAt;
  const dayKey = achievementDayKey(timestamp);
  const reject = (reason) => ({ policyVersion: ACHIEVEMENT_POLICY_VERSION, qualified: false, credited: false, reason });
  if (mode !== "training") return reject("not_training");
  if (!GROWTH_ACHIEVEMENTS.some((badge) => badge.gameId === gameId) || !childId || childId === "unassigned") return reject("missing_identity");
  if (!assignment || assignment.policyVersion !== ACHIEVEMENT_POLICY_VERSION || !["system_plan", "system_recommendation", "system_default", "clinician"].includes(assignment.source)) return reject("unassigned_difficulty");
  if (String(assignment.childId) !== childId || assignment.gameId !== gameId) return reject("assignment_mismatch");
  const difficulty = achievementDifficultyKey(raw.microDifficulty || raw.difficultyKey || raw.difficulty || payload.session?.difficulty, gameId);
  if (!difficulty || difficulty !== achievementDifficultyKey(assignment.difficulty, gameId)) return reject("difficulty_mismatch");
  const status = raw.status || payload.session?.status;
  const trials = raw.trials || raw.trialLogs || raw.logs || raw.records || raw.history;
  const total = numeric(raw.totalTrials ?? raw.totalQuestions ?? payload.summary?.totalTrials ?? (Array.isArray(trials) ? trials.length : null));
  if (raw.completed !== true || ["in_progress", "interrupted", "aborted", "abandoned"].includes(status) || !total || total < 1) return reject("incomplete");
  if (!dayKey || !Number.isFinite(Date.parse(assignment.issuedAt)) || Date.parse(timestamp) < Date.parse(assignment.issuedAt)) return reject("invalid_timestamp");
  const explicitPercent = numeric(raw.accuracyPercent ?? raw.scoring?.summary?.accuracyPercent);
  const accuracyValue = explicitPercent ?? numeric(raw.accuracy ?? payload.summary?.accuracy);
  const accuracy = explicitPercent != null ? explicitPercent : accuracyValue != null && accuracyValue <= 1 ? accuracyValue * 100 : accuracyValue;
  // Never round 79.99 up across the award boundary, or treat missing data as success.
  if (accuracy == null || accuracy < 80 || accuracy > 100) return reject("below_accuracy_target");
  return {
    policyVersion: ACHIEVEMENT_POLICY_VERSION, qualified: true, credited: false, reason: "qualified",
    resultId: result.resultId || payload.resultId || raw.resultId, childId, gameId, dayKey,
    timestamp, accuracy, difficulty, difficultyLabel: raw.difficultyLabel || assignment.difficultyLabel || achievementDifficultyLabel(difficulty, gameId),
    assignmentSource: assignment.source, assignmentId: assignment.id,
    promptCount: numeric(raw.promptCount ?? raw.scoring?.summary?.promptCount),
    protocolVersion: raw.protocolVersion || raw.protocol?.version || null,
  };
}

export function recordAchievementResult(result, { notify = true } = {}) {
  if (isTemporaryGameTesting()) return { policyVersion: ACHIEVEMENT_POLICY_VERSION, qualified: false, credited: false, reason: "game_testing" };
  const evaluation = evaluateAchievementResult(result);
  if (!evaluation.qualified || !evaluation.resultId) return evaluation;
  const progress = readAchievementProgress(evaluation.childId);
  if (progress.credits.some((credit) => credit.resultId === evaluation.resultId)) return { ...evaluation, reason: "already_recorded" };
  if (progress.credits.some((credit) => credit.gameId === evaluation.gameId && credit.dayKey === evaluation.dayKey)) return { ...evaluation, reason: "daily_limit" };
  const credit = { ...evaluation, credited: true };
  const credits = [...progress.credits, credit].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const count = credits.filter((item) => item.gameId === credit.gameId).length;
  const awards = { ...progress.awards };
  const earned = { ...(awards[credit.gameId] || {}) };
  ACHIEVEMENT_THRESHOLDS.forEach((threshold, index) => {
    if (count >= threshold && !earned[index + 1]) earned[index + 1] = { level: index + 1, threshold, earnedAt: credit.timestamp, resultId: credit.resultId, difficulty: credit.difficulty, difficultyLabel: credit.difficultyLabel };
  });
  awards[credit.gameId] = earned;
  storage.setItem(keyFor(credit.childId), JSON.stringify({ version: ACHIEVEMENT_POLICY_VERSION, credits, awards }));
  if (notify && typeof window !== "undefined") window.dispatchEvent(new Event("achievementResultsUpdated"));
  return credit;
}

export function preserveLegacyAchievementAwards(childId, snapshots) {
  const existing = parse(storage.getItem(legacyAchievementKey(childId)), null);
  if (Array.isArray(existing)) return existing;
  const awards = snapshots.filter((badge) => badge.level > 0).map(({ id, level }) => ({ id, level }));
  if (!isTemporaryGameTesting()) storage.setItem(legacyAchievementKey(childId), JSON.stringify(awards));
  return awards;
}

export function getGrowthAchievementStates(progress) {
  return GROWTH_ACHIEVEMENTS.map((badge) => {
    const credits = progress.credits.filter((credit) => credit.gameId === badge.gameId);
    const value = credits.length;
    const earned = progress.awards[badge.gameId] || {};
    const level = Math.max(0, ...Object.keys(earned).map(Number).filter((number) => number >= 1 && number <= 5));
    const nextThreshold = ACHIEVEMENT_THRESHOLDS[Math.min(level, 4)];
    const previous = level ? ACHIEVEMENT_THRESHOLDS[level - 1] : 0;
    return { ...badge, value, level, nextThreshold, credits, earned,
      progressPercent: level >= 5 ? 100 : Math.max(0, Math.min(100, (value - previous) / (nextThreshold - previous) * 100)) };
  });
}
