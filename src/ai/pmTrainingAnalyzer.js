// PM recommendations change memory load; reaction time is retained for observation.
import { getPMBasicStats, normalizePMRecord } from "../utils/pmScoring";
import {
  PM_ANSWER_TIME_SECONDS, PM_DIFFICULTY_ORDER, PM_MAX_MEMORY_COUNT,
  PM_TRAINING_CONFIG, getPMShowTime, normalizePMDifficulty,
} from "../utils/pmProtocol";

// Compatibility export: the fixed answer limit is not an adaptive speed threshold.
export const PM_RT_TARGET_MAP = Object.fromEntries(
  [...PM_DIFFICULTY_ORDER, "normal", 1, 2, 3, 4, 5, 6, 7]
    .map((key) => [key, PM_ANSWER_TIME_SECONDS * 1000])
);

const SPAN_TRIAL_TOTAL = 2;
const MAX_PM_DIFFICULTY_LEVEL = PM_DIFFICULTY_ORDER.length;
const safeArray = (value) => Array.isArray(value) ? value : [];
function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, safeNumber(value, min)));
const round = (value, digits = 0) => Math.round(safeNumber(value) * 10 ** digits) / 10 ** digits;
const roundNullable = (value) => value == null || !Number.isFinite(Number(value)) ? null : round(value);
function normalizeAccuracy(value) {
  const number = safeNumber(value);
  return clamp(number > 1 ? number / 100 : number, 0, 1);
}
function normalizeDifficultyLevel(value) {
  const key = normalizePMDifficulty(value);
  if (key) return PM_DIFFICULTY_ORDER.indexOf(key) + 1;
  const legacyLevel = String(value ?? "").match(/Lv\.?\s*(\d)/i)?.[1];
  return clamp(Math.round(safeNumber(legacyLevel ?? value, 1)), 1, MAX_PM_DIFFICULTY_LEVEL);
}
const normalizeMemorySpan = (value) => clamp(Math.round(safeNumber(value)), 0, PM_MAX_MEMORY_COUNT);
const getBroadDifficulty = (level) => PM_DIFFICULTY_ORDER[normalizeDifficultyLevel(level) - 1];
function getRecordDifficultyLevel(record) {
  const numeric = record.difficultyLevel ?? record.internalDifficulty ?? record.difficultyValue;
  if (numeric != null) return normalizeDifficultyLevel(numeric);
  return normalizeDifficultyLevel(record.difficulty ?? record.difficultyKey ?? record.difficultyLabel);
}
const getRecordMemorySpan = (record) => normalizeMemorySpan(record.memorySpan ?? record.memoryCount);

function buildSpanSummaries(records) {
  const groups = records.reduce((map, record) => {
    const span = getRecordMemorySpan(record);
    if (span) map.set(span, [...(map.get(span) ?? []), record]);
    return map;
  }, new Map());
  return Array.from(groups.entries()).sort(([a], [b]) => a - b).map(([memorySpan, trials]) => {
    const lastTwo = trials.slice(-SPAN_TRIAL_TOTAL);
    const correctCount = trials.filter((trial) => trial.isCorrect).length;
    const timeoutCount = trials.filter((trial) => trial.isTimeout).length;
    const assistedCorrectCount = trials.filter((trial) => trial.isCorrect && trial.usedSupport).length;
    const cleanCorrectCount = correctCount - assistedCorrectCount;
    const twoFailed = lastTwo.length === SPAN_TRIAL_TOTAL && lastTwo.every((trial) => !trial.isCorrect);
    const twoTimeout = lastTwo.length === SPAN_TRIAL_TOTAL && lastTwo.every((trial) => trial.isTimeout);
    return {
      memorySpan, trialCount: trials.length, expectedTrialCount: SPAN_TRIAL_TOTAL,
      correctCount, wrongCount: trials.length - correctCount - timeoutCount, timeoutCount,
      cleanCorrectCount, assistedCorrectCount,
      promptCount: trials.reduce((sum, trial) => sum + trial.promptCount, 0),
      accuracy: round(correctCount / trials.length, 3), accuracyPercent: round(correctCount / trials.length * 100),
      completedTwoTrialRule: trials.length >= SPAN_TRIAL_TOTAL,
      twoFailed, twoTimeout, shouldStopHere: twoFailed || twoTimeout,
      firstTrialIndex: trials[0].trialIndex ?? trials[0].level ?? trials[0].round ?? null,
      lastTrialIndex: trials[trials.length - 1].trialIndex ?? trials[trials.length - 1].level ?? trials[trials.length - 1].round ?? null,
    };
  });
}

function calculateReactionScore(reactionTime, accuracy) {
  const time = safeNumber(reactionTime);
  if (time <= 0) return 0;
  return round(clamp(100 * (1 - time / (PM_ANSWER_TIME_SECONDS * 2000))) * normalizeAccuracy(accuracy));
}
function calculateStabilityScore(reactionTimeStd, avgReactionTime, totalTrials) {
  const mean = safeNumber(avgReactionTime);
  if (totalTrials < 2 || reactionTimeStd == null || mean <= 0) return 0;
  return round(clamp(100 * (1 - safeNumber(reactionTimeStd) / mean)));
}
function getDifficultyDecision({ accuracy, timeoutRate, supportRate, totalTrials, memorySpan, difficultyLevel, earlyStopReason }) {
  if (totalTrials <= 0) return "maintain";
  if (earlyStopReason === "span_two_timeouts" || timeoutRate >= 0.5 || accuracy < 0.5 ||
      (earlyStopReason === "span_two_failed" && accuracy < 0.65)) return "decrease";
  if (totalTrials >= SPAN_TRIAL_TOTAL && accuracy >= 0.85 && timeoutRate <= 0.15 &&
      supportRate <= 0.1 && memorySpan >= PM_TRAINING_CONFIG[getBroadDifficulty(difficultyLevel)].maxMemory &&
      memorySpan < PM_MAX_MEMORY_COUNT && !earlyStopReason) return "increase";
  return "maintain";
}
function getTrainingSuggestion({ difficultyDecision, totalTrials, supportRate, possibleConfusionCount, earlyStopReason, stoppedMemorySpan }) {
  const conditions = "維持作答上限 15 秒；2～3 個物件觀看 3 秒，4～7 個物件觀看 5 秒，不增加閃爍、波動或移動干擾。";
  if (totalTrials <= 0) return `目前尚無完成題目，先確認孩子理解規則並繼續目前記憶負荷。${conditions}`;
  const confusionNote = possibleConfusionCount > 0
    ? "同類或外形相近的錯選已列為可能混淆，需搭配漏選目標及點擊歷程觀察，不能直接認定為衝動或確認錯誤原因。" : "";
  if (earlyStopReason === "span_two_timeouts" || earlyStopReason === "span_two_failed") {
    return `在 ${stoppedMemorySpan || "目前"} 個物件的負荷連續兩題未完成或未答對，下次先減少記憶數量並確認規則理解。${conditions}${confusionNote}`;
  }
  if (supportRate > 0.1) return `目前需要提示協助，先在原記憶數量練習，觀察能否在較少提示下完成。${conditions}${confusionNote}`;
  if (difficultyDecision === "increase") return `能穩定完成目前記憶負荷，下次可逐步增加記憶數量，最多 7 個物件。${conditions}${confusionNote}`;
  if (difficultyDecision === "decrease") return `先減少記憶數量，確認規則與圖片辨識，再逐步恢復記憶負荷。${conditions}${confusionNote}`;
  return `維持目前記憶數量，持續觀察正確率、提示需求與點擊歷程。${conditions}${confusionNote}`;
}

export function calculatePMAIScore({
  accuracy = 0, avgReactionTime = null, reactionTimeStd = null,
  timeoutCount = 0, totalTrials = 0, totalWrongTapCount = 0,
  fatigueLevel = 0, difficultyLevel = 1, memorySpan = 0, highestMemorySpan = 0,
  earlyStopReason = null, stoppedMemorySpan = null,
  promptCount = 0, supportedTrialCount = 0, supportRate = null,
  possibleConfusionCount = 0, visualConfusionCount = 0, categoryConfusionCount = 0, unrelatedWrongCount = 0,
} = {}) {
  const trials = Math.max(0, Math.round(safeNumber(totalTrials)));
  const safeAccuracy = trials > 0 ? normalizeAccuracy(accuracy) : 0;
  const timeouts = clamp(Math.round(safeNumber(timeoutCount)), 0, trials);
  const timeoutRate = trials > 0 ? timeouts / trials : 0;
  const wrongTapCount = Math.max(0, Math.round(safeNumber(totalWrongTapCount)));
  const wrongTapRate = trials > 0 ? wrongTapCount / trials : 0;
  const level = normalizeDifficultyLevel(difficultyLevel);
  const span = normalizeMemorySpan(memorySpan);
  const highestSpan = normalizeMemorySpan(highestMemorySpan || span);
  const safePromptCount = Math.max(0, Math.round(safeNumber(promptCount)));
  const assistedTrials = clamp(Math.round(safeNumber(supportedTrialCount)), 0, trials);
  const resolvedSupportRate = supportRate != null ? clamp(supportRate, 0, 1)
    : trials > 0 ? Math.min(1, Math.max(assistedTrials, safePromptCount > 0 ? 1 : 0) / trials) : 0;
  const accuracyScore = round(safeAccuracy * 100);
  const memoryLoadScore = trials > 0
    ? round(clamp((highestSpan / PM_MAX_MEMORY_COUNT * 75 + level / MAX_PM_DIFFICULTY_LEVEL * 25) * safeAccuracy)) : 0;
  const supportScore = trials > 0 ? round((1 - resolvedSupportRate) * 100) : 0;
  const reactionScore = calculateReactionScore(avgReactionTime, safeAccuracy);
  const stabilityScore = calculateStabilityScore(reactionTimeStd, avgReactionTime, trials);
  const focusScore = trials > 0 ? round(clamp(100 - timeoutRate * 65 - Math.min(wrongTapRate, 2) * 22)) : 0;
  const fatigueScore = trials > 0 ? round(100 - clamp(fatigueLevel)) : 0;
  // Observational sub-scores cannot alter the principal score or recommendation.
  let aiScore = round(accuracyScore * 0.65 + memoryLoadScore * 0.25 + supportScore * 0.1);
  if (timeoutRate >= 0.8) aiScore = Math.min(aiScore, 25);
  else if (timeoutRate >= 0.5) aiScore = Math.min(aiScore, 42);
  if (safeAccuracy === 0) aiScore = Math.min(aiScore, 35);
  if (earlyStopReason === "span_two_timeouts") aiScore = Math.min(aiScore, 40);
  if (earlyStopReason === "span_two_failed") aiScore = Math.min(aiScore, 55);
  const difficultyDecision = getDifficultyDecision({ accuracy: safeAccuracy, timeoutRate,
    supportRate: resolvedSupportRate, totalTrials: trials, memorySpan: span, difficultyLevel: level, earlyStopReason });
  const trainingSuggestion = getTrainingSuggestion({ difficultyDecision, totalTrials: trials,
    supportRate: resolvedSupportRate, possibleConfusionCount, earlyStopReason, stoppedMemorySpan });
  return {
    aiScore, accuracyScore, memoryLoadScore, supportScore,
    reactionScore, stabilityScore, focusScore, fatigueScore,
    accuracy: round(safeAccuracy, 3), accuracyPercent: round(safeAccuracy * 100),
    avgReactionTime: roundNullable(avgReactionTime), reactionTimeStd: roundNullable(reactionTimeStd),
    timeoutCount: timeouts, timeoutRate: round(timeoutRate, 3),
    wrongTapCount, wrongTapRate: round(wrongTapRate, 3), totalTrials: trials,
    fatigueLevel: round(clamp(fatigueLevel)),
    difficultyLevel: level, broadDifficulty: getBroadDifficulty(level),
    reactionTimeTarget: PM_ANSWER_TIME_SECONDS * 1000,
    answerTimeLimit: PM_ANSWER_TIME_SECONDS, memorySpan: span, highestMemorySpan: highestSpan,
    promptCount: safePromptCount, totalPromptCount: safePromptCount,
    supportedTrialCount: assistedTrials, supportRate: round(resolvedSupportRate, 3),
    possibleConfusionCount: Math.max(0, round(possibleConfusionCount)),
    visualConfusionCount: Math.max(0, round(visualConfusionCount)),
    visualSimilarityConfusionCount: Math.max(0, round(visualConfusionCount)),
    categoryConfusionCount: Math.max(0, round(categoryConfusionCount)),
    unrelatedWrongCount: Math.max(0, round(unrelatedWrongCount)),
    unrelatedErrorCount: Math.max(0, round(unrelatedWrongCount)),
    earlyStopReason, stoppedMemorySpan, difficultyDecision, trainingSuggestion,
    scoringWeights: { accuracy: 0.65, memoryLoad: 0.25, support: 0.1, reaction: 0, stability: 0, focus: 0, fatigue: 0 },
    reactionTimeIsObservational: true,
  };
}

export function analyzePMTraining({
  records = [], accuracy = null, avgReactionTime = null, reactionTimeStd = null,
  timeoutCount = null, totalTrials = null, totalWrongTapCount = null,
  fatigueLevel = null, difficultyLevel = null,
  earlyStopReason = null, stoppedMemorySpan = null, completedByRule = null,
} = {}) {
  const history = safeArray(records).map(normalizePMRecord);
  const completedRecords = history.filter((record) => record.completed);
  const stats = getPMBasicStats(history);
  // With trial evidence, the recorded completed answers are the denominator.
  const trials = history.length > 0 ? completedRecords.length : Math.max(0, round(totalTrials));
  const resolvedAccuracy = history.length > 0 ? stats.accuracyRate : normalizeAccuracy(accuracy);
  const resolvedTimeoutCount = history.length > 0 ? stats.timeoutCount : Math.max(0, round(timeoutCount));
  const spanSummaries = buildSpanSummaries(completedRecords);
  const memorySpans = completedRecords.map(getRecordMemorySpan).filter((span) => span > 0);
  const highestAttemptedMemorySpan = memorySpans.length > 0 ? Math.max(...memorySpans) : 0;
  const passedSpans = spanSummaries.filter((summary) => summary.correctCount >= SPAN_TRIAL_TOTAL).map((summary) => summary.memorySpan);
  const independentlyPassedSpans = spanSummaries.filter((summary) => summary.cleanCorrectCount >= SPAN_TRIAL_TOTAL).map((summary) => summary.memorySpan);
  const highestSuccessfulMemorySpan = passedSpans.length > 0 ? Math.max(...passedSpans) : 0;
  const highestIndependentMemorySpan = independentlyPassedSpans.length > 0 ? Math.max(...independentlyPassedSpans) : 0;
  const latestMemorySpan = memorySpans[memorySpans.length - 1] ?? 0;
  const latestRecord = history[history.length - 1];
  const resolvedDifficultyLevel = difficultyLevel != null ? normalizeDifficultyLevel(difficultyLevel)
    : latestRecord ? getRecordDifficultyLevel(latestRecord) : 1;
  const stoppedSummary = spanSummaries.find((summary) => summary.shouldStopHere);
  const resolvedEarlyStopReason = earlyStopReason ?? (stoppedSummary?.twoTimeout ? "span_two_timeouts" : stoppedSummary?.twoFailed ? "span_two_failed" : null);
  const resolvedStoppedMemorySpan = stoppedMemorySpan != null ? normalizeMemorySpan(stoppedMemorySpan) : stoppedSummary?.memorySpan ?? null;
  // No RT-based fatigue estimate: slower retrieval must not lower a memory level.
  const resolvedFatigueLevel = clamp(fatigueLevel ?? 0);
  const result = calculatePMAIScore({
    accuracy: resolvedAccuracy,
    avgReactionTime: history.length > 0 ? stats.averageReactionTime : avgReactionTime,
    reactionTimeStd: history.length > 0 ? stats.reactionTimeStd : reactionTimeStd,
    timeoutCount: resolvedTimeoutCount, totalTrials: trials,
    totalWrongTapCount: totalWrongTapCount ?? stats.wrongTapCount,
    fatigueLevel: resolvedFatigueLevel, difficultyLevel: resolvedDifficultyLevel,
    memorySpan: latestMemorySpan, highestMemorySpan: highestSuccessfulMemorySpan,
    earlyStopReason: resolvedEarlyStopReason, stoppedMemorySpan: resolvedStoppedMemorySpan,
    promptCount: stats.promptCount, supportedTrialCount: stats.supportedTrialCount, supportRate: stats.supportRate,
    possibleConfusionCount: stats.possibleConfusionCount,
    visualConfusionCount: stats.visualConfusionCount, categoryConfusionCount: stats.categoryConfusionCount,
    unrelatedWrongCount: stats.unrelatedWrongCount,
  });
  // Promotion must be supported by two successful independent answers at a span.
  if (history.length > 0 && result.difficultyDecision === "increase" && highestIndependentMemorySpan < latestMemorySpan) {
    result.difficultyDecision = "maintain";
    result.trainingSuggestion = getTrainingSuggestion({ ...result });
  }
  const nextDifficultyLevel = clamp(resolvedDifficultyLevel +
    (result.difficultyDecision === "increase" ? 1 : result.difficultyDecision === "decrease" ? -1 : 0),
  1, MAX_PM_DIFFICULTY_LEVEL);
  const currentDifficulty = getBroadDifficulty(resolvedDifficultyLevel);
  const recommendedDifficulty = getBroadDifficulty(nextDifficultyLevel);
  const nextConfig = PM_TRAINING_CONFIG[recommendedDifficulty];
  let nextMemorySpan = highestIndependentMemorySpan || latestMemorySpan || nextConfig.minMemory;
  if (result.difficultyDecision === "increase") nextMemorySpan = (highestIndependentMemorySpan || latestMemorySpan || 2) + 1;
  if (result.difficultyDecision === "decrease") nextMemorySpan = (resolvedStoppedMemorySpan || latestMemorySpan || 3) - 1;
  nextMemorySpan = clamp(nextMemorySpan, nextConfig.minMemory, nextConfig.maxMemory);
  const observationStats = {
    totalRecordedTrials: history.length, unfinishedTrialCount: history.length - completedRecords.length,
    promptCount: stats.promptCount, totalPromptCount: stats.promptCount,
    idleHintCount: stats.idleHintCount, totalIdleHintCount: stats.idleHintCount,
    promptTrialCount: stats.promptTrialCount, promptEvents: stats.promptEvents, clickLogs: stats.clickLogs,
    possibleConfusionCount: stats.possibleConfusionCount,
    visualConfusionCount: stats.visualConfusionCount, visualSimilarityConfusionCount: stats.visualConfusionCount,
    categoryConfusionCount: stats.categoryConfusionCount,
    unrelatedWrongCount: stats.unrelatedWrongCount, unrelatedErrorCount: stats.unrelatedWrongCount,
    confusionTrialCount: stats.confusionTrialCount, confusionErrors: stats.confusionErrors,
    supportedTrialCount: stats.supportedTrialCount, supportRate: round(stats.supportRate, 3),
    cleanCorrectCount: stats.cleanCorrectCount, assistedCorrectCount: stats.assistedCorrectCount,
  };
  return {
    ...result, ...observationStats,
    correctTrials: stats.correctCount, wrongTrials: stats.wrongCount, timeoutTrials: stats.timeoutCount,
    totalTrials: trials, wrongRate: trials > 0 ? round(stats.wrongCount / trials, 3) : 0,
    deselectCount: stats.deselectCount,
    spanSummaries, spanTrialTotal: SPAN_TRIAL_TOTAL,
    highestAttemptedMemorySpan, highestSuccessfulMemorySpan, highestIndependentMemorySpan, latestMemorySpan,
    earlyStopReason: resolvedEarlyStopReason, stoppedMemorySpan: resolvedStoppedMemorySpan,
    completedByRule: typeof completedByRule === "boolean" ? completedByRule : trials > 0 && !resolvedEarlyStopReason,
    nextDifficultyLevel, nextMemorySpan, currentDifficulty, recommendedDifficulty,
    recommendedAction: result.difficultyDecision,
    nextShowTime: getPMShowTime(nextMemorySpan), nextAnswerTime: PM_ANSWER_TIME_SECONDS,
    clinicianNotes: { ...observationStats,
      confusionInterpretation: "可能混淆依錯選物件與漏選目標的素材分類或預定相近外形記錄，不能確認原因或直接認定為衝動。",
      reactionTimeIsObservational: true,
    },
    records: history,
    analysisVersion: "PM_ANALYZER_V4_MEMORY_LOAD",
    analyzedAt: new Date().toISOString(),
  };
}

export default analyzePMTraining;
