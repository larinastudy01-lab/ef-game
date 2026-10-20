import { gameLocalStorage as localStorage, gameSessionStorage as sessionStorage } from "../temporaryGameTesting/runtime";
// src/utils/pmScoring.js

import { analyzePMConfusions } from "./pmItems";
import { PM_DIFFICULTY_ORDER, normalizePMDifficulty } from "./pmProtocol";

const MAX_PM_DIFFICULTY_LEVEL = 5;
const MAX_PM_MEMORY_SPAN = 7;
const TRAINING_SPAN_TRIAL_COUNT = 2;
const MIN_COMPLETION_RATE_FOR_STARS = 0.3;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

// Keep actual prompts/clicks from interrupted trials, without treating them as answers.
export function normalizePMRecord(record = {}) {
  const promptEvents = safeArray(record.promptEvents);
  const promptCount = Math.max(0, Number(record.promptCount) || 0,
    Number(record.idleHintCount) || 0, promptEvents.length);
  const sourceLogs = Array.isArray(record.clickLogs) ? record.clickLogs : safeArray(record.tapLogs);
  const tapLogs = sourceLogs.map((tap) => ({
    ...tap,
    action: tap.action === "selected" ? "select" : tap.action === "deselected" ? "deselect" : tap.action,
  }));
  const hasTargetIds = Array.isArray(record.targetIds) || Array.isArray(record.correctIds);
  const targetIds = safeArray(record.targetIds ?? record.correctIds);
  const selectedIds = safeArray(record.selectedIds);
  const computedConfusion = hasTargetIds && Array.isArray(record.selectedIds)
    ? analyzePMConfusions({ targetIds, selectedIds, optionIds: safeArray(record.optionIds) }) : null;
  const confusionAnalysis = computedConfusion ?? record.confusionAnalysis ?? {};
  const getCount = (...values) => Math.max(0, ...values.map((value) => Number(value) || 0));
  const visualConfusionCount = getCount(confusionAnalysis.visualSimilarityConfusionCount,
    confusionAnalysis.visualConfusionCount, record.visualConfusionCount);
  const categoryConfusionCount = getCount(confusionAnalysis.categoryConfusionCount, record.categoryConfusionCount);
  const possibleConfusionCount = getCount(confusionAnalysis.possibleConfusionCount,
    record.possibleConfusionCount, visualConfusionCount + categoryConfusionCount);
  const unrelatedWrongCount = getCount(confusionAnalysis.unrelatedErrorCount,
    confusionAnalysis.unrelatedWrongCount, record.unrelatedWrongCount);
  const completed = record.completed !== false;
  const isTimeout = completed && (record.isTimeout === true || record.timeout === true);
  const isCorrect = completed && !isTimeout && (record.isCorrect === true || record.correct === true);
  return {
    ...record, completed, isTimeout, isCorrect,
    targetIds, correctIds: targetIds, selectedIds,
    clickLogs: sourceLogs, tapLogs,
    promptCount, totalPromptCount: promptCount, idleHintCount: promptCount, promptEvents,
    usedSupport: record.usedSupport === true || record.usedHint === true || promptCount > 0,
    confusionAnalysis, possibleConfusionCount, visualConfusionCount,
    visualSimilarityConfusionCount: visualConfusionCount, categoryConfusionCount,
    unrelatedWrongCount, unrelatedErrorCount: unrelatedWrongCount,
  };
}

function getPMEventStats(history) {
  const promptEvents = history.flatMap((record) => record.promptEvents);
  const promptCount = history.reduce((total, record) => total + record.promptCount, 0);
  const sumField = (key) => history.reduce((total, record) => total + (Number(record[key]) || 0), 0);
  return {
    totalRecordedTrials: history.length,
    unfinishedTrialCount: history.filter((record) => !record.completed).length,
    promptCount, totalPromptCount: promptCount, idleHintCount: promptCount,
    totalIdleHintCount: promptCount, promptTrialCount: history.filter((record) => record.promptCount > 0).length,
    promptEvents,
    clickLogs: history.flatMap((record) => record.clickLogs),
    possibleConfusionCount: sumField("possibleConfusionCount"),
    visualConfusionCount: sumField("visualConfusionCount"),
    visualSimilarityConfusionCount: sumField("visualConfusionCount"),
    categoryConfusionCount: sumField("categoryConfusionCount"),
    unrelatedWrongCount: sumField("unrelatedWrongCount"),
    unrelatedErrorCount: sumField("unrelatedWrongCount"),
    confusionTrialCount: history.filter((record) => record.possibleConfusionCount > 0).length,
    confusionErrors: history.flatMap((record, index) => safeArray(record.confusionAnalysis?.errors)
      .map((error) => ({ ...error, trialIndex: record.trialIndex ?? index + 1 }))),
  };
}

function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function roundNumber(value, digits = 0) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function average(numbers) {
  const valid = safeArray(numbers).filter(
    (n) => typeof n === "number" && Number.isFinite(n)
  );
  if (valid.length === 0) return null;
  return valid.reduce((sum, n) => sum + n, 0) / valid.length;
}

function standardDeviation(numbers) {
  const valid = safeArray(numbers).filter(
    (n) => typeof n === "number" && Number.isFinite(n)
  );

  if (valid.length < 2) return null;

  const mean = average(valid);
  if (mean === null) return null;

  const variance =
    valid.reduce((sum, n) => sum + (n - mean) ** 2, 0) / valid.length;

  return Math.sqrt(variance);
}

function percentage(part, total) {
  if (!total || total <= 0) return 0;
  return roundNumber((part / total) * 100, 0);
}

function getFiniteReactionTime(record) {
  const rt = record?.reactionTime;
  return typeof rt === "number" && Number.isFinite(rt) ? rt : null;
}

function hasAction(record, action) {
  return safeArray(record?.tapLogs).some((tap) => tap?.action === action);
}

function hasWrongTap(record) {
  return safeArray(record?.tapLogs).some(
    (tap) => tap?.action === "select" && tap?.isCorrectItem === false
  );
}

function getStabilitySampleFromCorrectRTs(correctReactionTimes, allReactionTimes) {
  return {
    sample: correctReactionTimes.length >= 2 ? correctReactionTimes : allReactionTimes,
    source: correctReactionTimes.length >= 2 ? "correct_rt" : allReactionTimes.length >= 2 ? "observed_all_rt" : "insufficient_observed_rt",
    usedFallback: false,
    fallbackMedianRt: null,
  };
}

function getAccuracyScore(accuracyRate) {
  if (typeof accuracyRate !== "number" || Number.isNaN(accuracyRate)) return 0;
  return roundNumber(clamp(accuracyRate, 0, 1) * 50, 0);
}

function getMemoryScore({
  highestPassedLevel,
  highestSuccessfulDifficulty,
  memorySpan,
  highLoadAccuracyRate,
}) {
  const safeDifficulty =
    typeof highestSuccessfulDifficulty === "number" &&
    highestSuccessfulDifficulty > 0
      ? highestSuccessfulDifficulty
      : highestPassedLevel;

  const difficultyPart = clamp(
    (safeDifficulty / MAX_PM_DIFFICULTY_LEVEL) * 12,
    0,
    12
  );
  const spanPart = clamp((memorySpan / MAX_PM_MEMORY_SPAN) * 13, 0, 13);
  const highLoadPart = clamp(highLoadAccuracyRate, 0, 1) * 10;

  return roundNumber(difficultyPart + spanPart + highLoadPart, 0);
}

function getSpeedScore(avgCorrectReactionTime, correctCount = 0) {
  if (correctCount < 2) return 0;
  if (avgCorrectReactionTime === null || avgCorrectReactionTime === undefined) {
    return 0;
  }

  if (avgCorrectReactionTime <= 3500) return 5;
  if (avgCorrectReactionTime <= 5500) return 4;
  if (avgCorrectReactionTime <= 7500) return 3;
  if (avgCorrectReactionTime <= 9500) return 2;
  return 1;
}

function getAttentionScore({
  accuracyRate,
  timeoutRate,
  wrongTapRate,
  deselectRate,
}) {
  let score = 15;

  score += accuracyRate * 2;
  score -= timeoutRate * 9;
  score -= wrongTapRate * 4;
  // A correction remains in the click history; it does not reduce the main score.

  if (timeoutRate >= 0.8) score -= 6;
  else if (timeoutRate >= 0.5) score -= 3;

  return roundNumber(clamp(score, 0, 15), 0);
}

function getStabilityScore(reactionTimeStd) {
  if (reactionTimeStd === null || reactionTimeStd === undefined) return 0;

  if (reactionTimeStd <= 800) return 10;
  if (reactionTimeStd <= 1500) return 8;
  if (reactionTimeStd <= 2500) return 6;
  if (reactionTimeStd <= 4000) return 4;
  return 2;
}

function getStarRating(totalScore, { totalLevels = 0, completionRate = 1 } = {}) {
  if (totalLevels <= 0) return 0;
  if (completionRate < MIN_COMPLETION_RATE_FOR_STARS) return 0;

  if (totalScore >= 80) return 3;
  if (totalScore >= 60) return 2;
  return 1;
}

function getChildMessage(stars) {
  if (stars <= 0) return "這次資料還不夠，我們再玩一次看看！";
  if (stars === 3) return "太棒了！你記得很清楚，找到了正確圖片！";
  if (stars === 2) return "做得很好！你已經記住很多圖片了，再練習會更厲害！";
  return "沒關係！我們再一起練習記圖片，會越來越熟悉！";
}

function getMemoryLevel(memorySpan) {
  if (memorySpan >= 5) return "記憶廣度良好";
  if (memorySpan >= 3) return "記憶廣度尚可";
  return "需要加強";
}

function getAccuracyLevel(accuracyPercent) {
  if (accuracyPercent >= 85) return "表現良好";
  if (accuracyPercent >= 65) return "尚可";
  return "需要加強";
}

function getSpeedLevel(avgCorrectReactionTime) {
  if (avgCorrectReactionTime === null) return "資料不足";
  if (avgCorrectReactionTime <= 3500) return "作答快速";
  if (avgCorrectReactionTime <= 7500) return "作答穩定";
  return "作答偏慢";
}

function getAttentionLevel({ timeoutRate, wrongTapRate, deselectRate }) {
  if (timeoutRate >= 0.5) return "逾時偏高，需優先觀察";
  if (timeoutRate >= 0.3) return "逾時略高";
  if (wrongTapRate >= 0.5) return "容易誤點";
  if (deselectRate >= 0.5) return "作答猶豫較明顯";
  if (wrongTapRate >= 0.25 || deselectRate >= 0.25) return "略有波動";
  return "專注表現穩定";
}

function getStabilityLevel(reactionTimeStd) {
  if (reactionTimeStd === null) return "資料不足";
  if (reactionTimeStd <= 1500) return "作答穩定";
  if (reactionTimeStd <= 3000) return "略有波動";
  return "作答不穩定";
}

function getRecordDifficultyLevel(record) {
  const difficultyKey = normalizePMDifficulty(record?.difficulty ?? record?.difficultyKey ?? record?.difficultyLabel);
  if (difficultyKey) return PM_DIFFICULTY_ORDER.indexOf(difficultyKey) + 1;
  const rawDifficulty =
    record?.difficultyLevel ??
    record?.internalDifficulty ??
    record?.difficultyValue;

  const numericDifficulty = Number(rawDifficulty);
  if (Number.isFinite(numericDifficulty) && numericDifficulty > 0) {
    return clamp(numericDifficulty, 1, MAX_PM_DIFFICULTY_LEVEL);
  }

  const rawDifficultyText = String(record?.difficulty ?? "");
  if (/^\d+$/.test(rawDifficultyText)) {
    return clamp(Number(rawDifficultyText), 1, MAX_PM_DIFFICULTY_LEVEL);
  }

  const rawLabel = String(record?.difficultyLabel ?? "");

  if (
    rawLabel.includes("Lv.7") ||
    rawLabel.includes("8張") ||
    rawLabel.includes("最高挑戰")
  ) {
    return 5;
  }

  if (rawLabel.includes("高挑戰") || rawLabel.includes("Lv.6")) return 5;
  if (rawLabel.includes("記憶分辨") || rawLabel.includes("Lv.5")) return 5;
  if (rawLabel.includes("抗干擾") || rawLabel.includes("Lv.4")) return 4;
  if (rawLabel.includes("增加容量") || rawLabel.includes("Lv.3")) return 3;
  if (rawLabel.includes("基礎記憶") || rawLabel.includes("Lv.2")) return 2;
  if (rawLabel.includes("熟悉規則") || rawLabel.includes("Lv.1")) return 1;

  return 0;
}

function getRecordMemorySpan(record) {
  const span = Number(record?.memoryCount ?? record?.memorySpan ?? 0);
  return Number.isFinite(span) && span > 0 ? span : 0;
}

function getHighLoadRecords(records) {
  return safeArray(records).filter((record) => {
    const difficultyLevel = getRecordDifficultyLevel(record);
    const memoryCount = getRecordMemorySpan(record);

    return difficultyLevel >= 4 || memoryCount >= 4;
  });
}

function buildSpanSummaries(records = []) {
  const grouped = safeArray(records).reduce((map, record, index) => {
    const memorySpan = getRecordMemorySpan(record);
    if (!memorySpan) return map;

    if (!map.has(memorySpan)) {
      map.set(memorySpan, []);
    }

    map.get(memorySpan).push({ ...record, __index: index });
    return map;
  }, new Map());

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([memorySpan, spanRecords]) => {
      const trialCount = spanRecords.length;
      const correctCount = spanRecords.filter((r) => r?.isCorrect === true).length;
      const timeoutCount = spanRecords.filter((r) => r?.isTimeout === true).length;
      const wrongCount = spanRecords.filter(
        (r) => r?.isCorrect === false && r?.isTimeout !== true
      ).length;

      const latestTwoRecords = spanRecords.slice(-TRAINING_SPAN_TRIAL_COUNT);
      const twoTrialRuleReady =
        latestTwoRecords.length >= TRAINING_SPAN_TRIAL_COUNT;

      const twoFailed =
        twoTrialRuleReady &&
        latestTwoRecords.every((r) => r?.isCorrect !== true);

      const twoTimeout =
        twoTrialRuleReady &&
        latestTwoRecords.every((r) => r?.isTimeout === true);

      return {
        memorySpan,
        trialCount,
        expectedTrialCount: TRAINING_SPAN_TRIAL_COUNT,
        correctCount,
        wrongCount,
        timeoutCount,
        accuracyRate: trialCount > 0 ? roundNumber(correctCount / trialCount, 2) : 0,
        accuracyPercent: percentage(correctCount, trialCount),
        completedTwoTrialRule: trialCount >= TRAINING_SPAN_TRIAL_COUNT,
        twoFailed,
        twoTimeout,
        shouldStopHere: twoFailed || twoTimeout,
        firstTrialIndex: spanRecords[0]?.trialIndex ?? spanRecords[0]?.level ?? null,
        lastTrialIndex:
          spanRecords[spanRecords.length - 1]?.trialIndex ??
          spanRecords[spanRecords.length - 1]?.level ??
          null,
      };
    });
}

function inferEarlyStopReason({ options = {}, spanSummaries = [] }) {
  if (typeof options?.earlyStopReason === "string" && options.earlyStopReason) {
    return options.earlyStopReason;
  }

  const stoppedSpan = safeArray(spanSummaries).find(
    (summary) => summary.shouldStopHere === true
  );

  if (!stoppedSpan) return null;
  if (stoppedSpan.twoTimeout) return "span_two_timeouts";
  if (stoppedSpan.twoFailed) return "span_two_failed";

  return null;
}

function getStoppedMemorySpan({ options = {}, spanSummaries = [] }) {
  const explicit = Number(options?.stoppedMemorySpan);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const stoppedSpan = safeArray(spanSummaries).find(
    (summary) => summary.shouldStopHere === true
  );

  return stoppedSpan?.memorySpan ?? null;
}

export function getPMBasicStats(inputRecords = []) {
  const history = safeArray(inputRecords).map(normalizePMRecord);
  const records = history.filter((record) => record.completed);
  const events = getPMEventStats(history);

  if (records.length === 0) {
    return {
      ...events,
      totalLevels: 0,
      totalTrials: 0,
      cleanCorrectCount: 0,
      assistedCorrectCount: 0,
      supportedTrialCount: 0,
      supportRate: 0,
      correctCount: 0,
      wrongCount: 0,
      timeoutCount: 0,
      accuracyRate: 0,
      accuracy: 0,
      accuracyPercent: 0,
      highestPassedLevel: 0,
      highestSuccessfulDifficulty: 0,
      memorySpan: 0,
      highLoadTrialCount: 0,
      highLoadCorrectCount: 0,
      highLoadAccuracyRate: 0,
      highLoadAccuracyPercent: 0,
      averageReactionTime: null,
      averageCorrectReactionTime: null,
      averageWrongReactionTime: null,
      reactionTimeStd: null,
      reactionTimeStdSource: "no_records",
      usedRtFallbackForStd: false,
      fallbackMedianRt: null,
      totalTapCount: history.reduce((total, record) => total + record.tapLogs.length, 0),
      wrongTapCount: 0,
      wrongTapTrialCount: 0,
      deselectCount: 0,
      deselectTrialCount: 0,
      averageFirstTapTime: null,
      fastCorrectCount: 0,
      fastCorrectRate: 0,
    };
  }

  const correctRecords = records.filter((r) => r?.isCorrect === true);
  const wrongRecords = records.filter(
    (r) => r?.isCorrect === false && r?.isTimeout !== true
  );
  const timeoutRecords = records.filter((r) => r?.isTimeout === true);

  const correctCount = correctRecords.length;
  const wrongCount = wrongRecords.length;
  const timeoutCount = timeoutRecords.length;

  const accuracyRate = records.length > 0 ? correctCount / records.length : 0;
  const accuracyPercent = percentage(correctCount, records.length);

  const reactionTimes = records
    .filter((record) => !record.isTimeout)
    .map(getFiniteReactionTime)
    .filter((rt) => rt !== null);

  const correctReactionTimes = correctRecords
    .map(getFiniteReactionTime)
    .filter((rt) => rt !== null);

  const wrongReactionTimes = wrongRecords
    .map(getFiniteReactionTime)
    .filter((rt) => rt !== null);

  const stabilitySampleInfo = getStabilitySampleFromCorrectRTs(
    correctReactionTimes,
    reactionTimes
  );

  const highestPassedLevel =
    correctRecords.length > 0
      ? Math.max(...correctRecords.map((r) => Number(r.level || r.trialIndex || 0)))
      : 0;

  const passedMemorySpans = buildSpanSummaries(records)
    .filter((summary) => summary.correctCount >= TRAINING_SPAN_TRIAL_COUNT)
    .map((summary) => summary.memorySpan);

  const memorySpan =
    passedMemorySpans.length > 0 ? Math.max(...passedMemorySpans) : 0;

  const successfulDifficultyLevels = correctRecords
    .map(getRecordDifficultyLevel)
    .filter((level) => level > 0);

  const highestSuccessfulDifficulty =
    successfulDifficultyLevels.length > 0
      ? Math.max(...successfulDifficultyLevels)
      : 0;

  const highLoadRecords = getHighLoadRecords(records);
  const highLoadCorrectCount = highLoadRecords.filter(
    (r) => r?.isCorrect === true
  ).length;
  const highLoadTrialCount = highLoadRecords.length;

  const highLoadAccuracyRate =
    highLoadTrialCount > 0
      ? highLoadCorrectCount / highLoadTrialCount
      : accuracyRate;

  const highLoadAccuracyPercent =
    highLoadTrialCount > 0
      ? percentage(highLoadCorrectCount, highLoadTrialCount)
      : accuracyPercent;

  const allTapLogs = records.flatMap((r) => safeArray(r.tapLogs));

  const wrongTapCount = allTapLogs.filter(
    (t) => t?.action === "select" && t?.isCorrectItem === false
  ).length;

  const wrongTapTrialCount = records.filter(hasWrongTap).length;

  const deselectCount = allTapLogs.filter(
    (t) => t?.action === "deselect"
  ).length;

  const deselectTrialCount = records.filter((record) =>
    hasAction(record, "deselect")
  ).length;

  const firstTapTimes = records
    .map((r) =>
      Array.isArray(r.tapLogs) && r.tapLogs.length > 0
        ? r.tapLogs[0].timestamp
        : null
    )
    .filter((v) => typeof v === "number" && Number.isFinite(v));

  const fastCorrectCount = records.filter(
    (r) => r?.isFast === true && r?.isCorrect === true
  ).length;

  const fastCorrectRate =
    records.length > 0 ? fastCorrectCount / records.length : 0;
  const supportedTrialCount = records.filter((record) => record.usedSupport).length;
  const assistedCorrectCount = correctRecords.filter((record) => record.usedSupport).length;

  return {
    ...events,
    totalLevels: records.length,
    totalTrials: records.length,
    cleanCorrectCount: correctCount - assistedCorrectCount,
    assistedCorrectCount,
    supportedTrialCount,
    supportRate: supportedTrialCount / records.length,
    correctCount,
    wrongCount,
    timeoutCount,
    accuracyRate,
    accuracy: accuracyRate,
    accuracyPercent,
    highestPassedLevel,
    highestSuccessfulDifficulty,
    memorySpan,
    highLoadTrialCount,
    highLoadCorrectCount,
    highLoadAccuracyRate,
    highLoadAccuracyPercent,
    averageReactionTime: roundNumber(average(reactionTimes), 0),
    averageCorrectReactionTime: roundNumber(average(correctReactionTimes), 0),
    averageWrongReactionTime: roundNumber(average(wrongReactionTimes), 0),
    reactionTimeStd: roundNumber(
      standardDeviation(stabilitySampleInfo.sample),
      0
    ),
    reactionTimeStdSource: stabilitySampleInfo.source,
    usedRtFallbackForStd: stabilitySampleInfo.usedFallback,
    fallbackMedianRt: roundNumber(stabilitySampleInfo.fallbackMedianRt, 0),
    totalTapCount: allTapLogs.length,
    wrongTapCount,
    wrongTapTrialCount,
    deselectCount,
    deselectTrialCount,
    averageFirstTapTime: roundNumber(average(firstTapTimes), 0),
    fastCorrectCount,
    fastCorrectRate,
  };
}

export function calculatePMScore(inputRecords = [], options = {}) {
  const history = safeArray(inputRecords).map(normalizePMRecord);
  const records = history.filter((record) => record.completed);
  const stats = getPMBasicStats(history);
  const eventStats = getPMEventStats(history);

  const mode = typeof options?.mode === "string" ? options.mode : "test";

  const plannedTotalRounds = Math.max(
    records.length,
    Number.isFinite(Number(options?.plannedTotalRounds))
      ? Number(options.plannedTotalRounds)
      : records.length
  );

  const completionRate =
    plannedTotalRounds > 0
      ? roundNumber(records.length / plannedTotalRounds, 2)
      : 0;

  const {
    totalLevels,
    correctCount,
    wrongCount,
    timeoutCount,
    accuracyRate,
    accuracyPercent,
    highestPassedLevel,
    highestSuccessfulDifficulty,
    memorySpan,
    highLoadTrialCount,
    highLoadCorrectCount,
    highLoadAccuracyRate,
    highLoadAccuracyPercent,
    averageReactionTime,
    averageCorrectReactionTime,
    averageWrongReactionTime,
    reactionTimeStd,
    reactionTimeStdSource,
    usedRtFallbackForStd,
    fallbackMedianRt,
    totalTapCount,
    wrongTapCount,
    wrongTapTrialCount,
    deselectCount,
    deselectTrialCount,
    averageFirstTapTime,
    fastCorrectCount,
    fastCorrectRate,
  } = stats;

  const timeoutRate = totalLevels > 0 ? timeoutCount / totalLevels : 0;
  const wrongTapRate =
    totalLevels > 0 ? wrongTapTrialCount / totalLevels : 0;
  const deselectRate =
    totalLevels > 0 ? deselectTrialCount / totalLevels : 0;

  const wrongTapIntensity =
    wrongTapTrialCount > 0 ? wrongTapCount / wrongTapTrialCount : 0;
  const deselectIntensity =
    deselectTrialCount > 0 ? deselectCount / deselectTrialCount : 0;

  const highTimeoutRisk = timeoutRate >= 0.5;
  const extremeTimeoutRisk = timeoutRate >= 0.8;

  const accuracyScore = getAccuracyScore(accuracyRate);

  const memoryScore = getMemoryScore({
    highestPassedLevel,
    highestSuccessfulDifficulty,
    memorySpan,
    highLoadAccuracyRate,
  });

  const speedScore = getSpeedScore(averageCorrectReactionTime, correctCount);

  const attentionScore = getAttentionScore({
    accuracyRate,
    timeoutRate,
    wrongTapRate,
    deselectRate,
  });

  const stabilityScore = getStabilityScore(reactionTimeStd);

  // PM difficulty is memory load. RT and RT variation remain observational only.
  let totalScore = totalLevels > 0
    ? roundNumber(accuracyScore + memoryScore + attentionScore, 0) : 0;
  const fastBonus = 0;

  if (extremeTimeoutRisk) {
    totalScore = clamp(totalScore - 20, 0, 25);
  } else if (highTimeoutRisk) {
    totalScore = clamp(totalScore - 12, 0, 40);
  } else if (timeoutRate >= 0.3) {
    totalScore = clamp(totalScore - 6, 0, 55);
  }

  const spanSummaries = buildSpanSummaries(records);
  const highestAttemptedMemorySpan =
    spanSummaries.length > 0
      ? Math.max(...spanSummaries.map((summary) => summary.memorySpan || 0))
      : 0;
  const firstMemorySpan = spanSummaries[0]?.memorySpan ?? null;
  const lastMemorySpan =
    spanSummaries[spanSummaries.length - 1]?.memorySpan ?? null;

  const earlyStopReason = inferEarlyStopReason({ options, spanSummaries });
  const stoppedMemorySpan = getStoppedMemorySpan({ options, spanSummaries });

  const completedByRule =
    typeof options?.completedByRule === "boolean"
      ? options.completedByRule
      : !earlyStopReason && records.length >= plannedTotalRounds;

  const stars = getStarRating(totalScore, { totalLevels, completionRate });

  const parentAbilityScores = {
    visualMemory: roundNumber((memoryScore / 35) * 100, 0),
    responseAccuracy: accuracyPercent,
    reactionSpeed: roundNumber((speedScore / 5) * 100, 0),
    attentionControl: roundNumber((attentionScore / 15) * 100, 0),
    answerStability: roundNumber((stabilityScore / 10) * 100, 0),
  };

  const levelSummaries = buildLevelSummaries(history);

  return {
    taskName: "Picture Memory",
    taskCode: "PM",
    mode,

    totalScore,
    stars,

    summary: {
      ...eventStats,
      totalLevels,
      totalTrials: totalLevels,
      cleanCorrectCount: stats.cleanCorrectCount,
      assistedCorrectCount: stats.assistedCorrectCount,
      supportedTrialCount: stats.supportedTrialCount,
      supportRate: roundNumber(stats.supportRate, 3),
      plannedTotalRounds,
      completionRate,

      correctCount,
      wrongCount,
      timeoutCount,

      accuracyRate,
      accuracyPercent,

      highestPassedLevel,
      highestSuccessfulDifficulty,
      memorySpan,

      highLoadTrialCount,
      highLoadCorrectCount,
      highLoadAccuracyRate: roundNumber(highLoadAccuracyRate, 2),
      highLoadAccuracyPercent,

      averageReactionTime,
      averageCorrectReactionTime,
      averageWrongReactionTime,

      reactionTimeStd,
      reactionTimeStdSource,
      usedRtFallbackForStd,
      fallbackMedianRt,

      totalTapCount,
      wrongTapCount,
      wrongTapTrialCount,
      deselectCount,
      deselectTrialCount,
      averageFirstTapTime,

      timeoutRate: roundNumber(timeoutRate, 2),
      wrongTapRate: roundNumber(wrongTapRate, 2),
      deselectRate: roundNumber(deselectRate, 2),
      wrongTapIntensity: roundNumber(wrongTapIntensity, 2),
      deselectIntensity: roundNumber(deselectIntensity, 2),

      highTimeoutRisk,
      extremeTimeoutRisk,

      fastCorrectCount,
      fastCorrectRate: roundNumber(fastCorrectRate, 2),
      fastBonus,

      spanSummaries,
      highestAttemptedMemorySpan,
      firstMemorySpan,
      lastMemorySpan,
      expectedSpanTrialCount: TRAINING_SPAN_TRIAL_COUNT,
      earlyStopReason,
      stoppedMemorySpan,
      completedByRule,
    },

    scoreBreakdown: {
      accuracyScore,
      memoryScore,
      speedScore,
      attentionScore,
      stabilityScore,
      fastBonus,
      maxScores: {
        accuracyScore: 50,
        memoryScore: 35,
        attentionScore: 15,
        stabilityScore: 10,
        speedScore: 5,
      },
      scoringWeights: { accuracy: 50, memory: 35, attention: 15, speed: 0, stability: 0 },
      reactionTimeIsObservational: true,
    },

    childView: {
      stars,
      message: getChildMessage(stars),
      shortLabel:
        stars === 3
          ? "表現很棒"
          : stars === 2
          ? "表現不錯"
          : stars === 1
          ? "繼續加油"
          : "資料不足",
    },

    parentView: {
      abilityScores: parentAbilityScores,

      indicators: [
        {
          key: "visualMemory",
          label: "視覺記憶力",
          value: parentAbilityScores.visualMemory,
          level: getMemoryLevel(memorySpan),
          description: "觀察孩子能記住幾個圖片位置與內容。",
        },
        {
          key: "responseAccuracy",
          label: "作答正確性",
          value: parentAbilityScores.responseAccuracy,
          level: getAccuracyLevel(accuracyPercent),
          description: "觀察孩子是否能正確選出剛剛記住的圖片。",
        },
        {
          key: "reactionSpeed",
          label: "作答速度",
          value: parentAbilityScores.reactionSpeed,
          level: getSpeedLevel(averageCorrectReactionTime),
          description: "觀察孩子在作答階段完成選取的速度。",
        },
        {
          key: "attentionControl",
          label: "專注與錯誤控制",
          value: parentAbilityScores.attentionControl,
          level: getAttentionLevel({ timeoutRate, wrongTapRate, deselectRate }),
          description: "觀察孩子是否容易逾時、誤點或反覆更改答案。",
        },
        {
          key: "answerStability",
          label: "作答穩定度",
          value: parentAbilityScores.answerStability,
          level: getStabilityLevel(reactionTimeStd),
          description: "觀察孩子每一關的作答時間是否穩定。",
        },
      ],

      plainLanguageSummary: buildParentSummary({
        mode,
        accuracyPercent,
        memorySpan,
        averageCorrectReactionTime,
        reactionTimeStd,
        timeoutRate,
        wrongTapRate,
        deselectRate,
        spanSummaries,
        earlyStopReason,
        stoppedMemorySpan,
      }),
    },

    clinicalView: {
      ...eventStats,
      totalLevels,
      totalTrials: totalLevels,
      cleanCorrectCount: stats.cleanCorrectCount,
      assistedCorrectCount: stats.assistedCorrectCount,
      supportedTrialCount: stats.supportedTrialCount,
      supportRate: roundNumber(stats.supportRate, 3),
      plannedTotalRounds,
      completionRate,

      correctCount,
      wrongCount,
      timeoutCount,
      accuracyPercent,

      highestPassedLevel,
      highestSuccessfulDifficulty,
      memorySpan,

      highLoadTrialCount,
      highLoadCorrectCount,
      highLoadAccuracyRate: roundNumber(highLoadAccuracyRate, 2),
      highLoadAccuracyPercent,

      averageReactionTime,
      averageCorrectReactionTime,
      averageWrongReactionTime,

      reactionTimeStd,
      reactionTimeStdSource,
      usedRtFallbackForStd,
      fallbackMedianRt,

      totalTapCount,
      wrongTapCount,
      wrongTapTrialCount,
      deselectCount,
      deselectTrialCount,
      averageFirstTapTime,

      timeoutRate: roundNumber(timeoutRate, 2),
      wrongTapRate: roundNumber(wrongTapRate, 2),
      deselectRate: roundNumber(deselectRate, 2),
      wrongTapIntensity: roundNumber(wrongTapIntensity, 2),
      deselectIntensity: roundNumber(deselectIntensity, 2),

      highTimeoutRisk,
      extremeTimeoutRisk,

      fastCorrectCount,
      fastCorrectRate: roundNumber(fastCorrectRate, 2),

      spanSummaries,
      highestAttemptedMemorySpan,
      firstMemorySpan,
      lastMemorySpan,
      expectedSpanTrialCount: TRAINING_SPAN_TRIAL_COUNT,
      earlyStopReason,
      stoppedMemorySpan,
      completedByRule,

      interpretationFlags: buildClinicalFlags({
        accuracyPercent,
        memorySpan,
        averageCorrectReactionTime,
        reactionTimeStd,
        timeoutRate,
        wrongTapRate,
        deselectRate,
        usedRtFallbackForStd,
        earlyStopReason,
        stoppedMemorySpan,
        possibleConfusionCount: eventStats.possibleConfusionCount,
        promptCount: eventStats.promptCount,
      }),

      levelSummaries,

      records: history,
    },

    records: history,
    scoringVersion: "PM_MEMORY_LOAD_V4",
    generatedAt: new Date().toISOString(),
  };
}

export function calculatePMStars(records = [], options = {}) {
  const result = calculatePMScore(records, options);
  return result.stars;
}

export function calculatePMRadar(records = [], options = {}) {
  const result = calculatePMScore(records, options);
  const scores = result.parentView.abilityScores;

  return [
    { subject: "記憶力", value: scores.visualMemory, fullMark: 100 },
    { subject: "正確性", value: scores.responseAccuracy, fullMark: 100 },
    { subject: "反應速度", value: scores.reactionSpeed, fullMark: 100 },
    { subject: "專注力", value: scores.attentionControl, fullMark: 100 },
    { subject: "作答穩定度", value: scores.answerStability, fullMark: 100 },
  ];
}

export function calculatePMDetails(records = [], options = {}) {
  const result = calculatePMScore(records, options);

  return {
    ...result.summary,
    accuracyPercent: result.summary.accuracyPercent,
    levelSummaries: result.clinicalView.levelSummaries,
    clinicalView: result.clinicalView,
    parentView: result.parentView,
    childView: result.childView,
    scoreBreakdown: result.scoreBreakdown,
  };
}

export function getPMPerformanceLabel(records = [], options = {}) {
  const stars = calculatePMStars(records, options);

  if (stars === 3) return "表現優秀";
  if (stars === 2) return "表現良好";
  if (stars === 1) return "持續加油";
  return "再試一次";
}

function buildLevelSummaries(records = []) {
  return safeArray(records).map((record, index) => {
    const tapLogs = safeArray(record.tapLogs);

    const wrongTapCount = tapLogs.filter(
      (tap) => tap?.action === "select" && tap?.isCorrectItem === false
    ).length;

    const deselectCount = tapLogs.filter(
      (tap) => tap?.action === "deselect"
    ).length;

    const firstTapTime = tapLogs.find((tap) => tap.action === "select")?.timestamp ?? null;

    return {
      trialIndex: record.trialIndex ?? index + 1,
      completed: record.completed,
      promptCount: record.promptCount,
      promptEvents: record.promptEvents,
      usedSupport: record.usedSupport,
      confusionAnalysis: record.confusionAnalysis,
      possibleConfusionCount: record.possibleConfusionCount,
      visualConfusionCount: record.visualConfusionCount,
      categoryConfusionCount: record.categoryConfusionCount,
      unrelatedWrongCount: record.unrelatedWrongCount,
      clickLogs: record.clickLogs,
      level: record.level ?? null,
      difficultyLevel: getRecordDifficultyLevel(record) || null,
      difficultyLabel: record.difficultyLabel ?? null,

      memoryCount: record.memoryCount ?? record.memorySpan ?? null,
      memorySpan: record.memorySpan ?? record.memoryCount ?? null,
      spanTrialIndex: record.spanTrialIndex ?? null,
      spanTrialTotal: record.spanTrialTotal ?? null,

      showTime: record.showTime ?? null,

      isCorrect: record.isCorrect === true,
      isTimeout: record.isTimeout === true,
      isFast: record.isFast === true,

      reactionTime: getFiniteReactionTime(record),

      aiRoundScore:
        typeof record.aiRoundScore === "number" &&
        Number.isFinite(record.aiRoundScore)
          ? record.aiRoundScore
          : null,

      selectedIds: safeArray(record.selectedIds),
      correctIds: safeArray(record.correctIds),

      wrongTapCount,
      wrongTapOccurred: wrongTapCount > 0,
      deselectCount,
      deselectOccurred: deselectCount > 0,
      firstTapTime,

      tapLogs,
    };
  });
}

function buildParentSummary({
  mode,
  accuracyPercent,
  memorySpan,
  averageCorrectReactionTime,
  reactionTimeStd,
  timeoutRate,
  wrongTapRate,
  deselectRate,
  spanSummaries = [],
  earlyStopReason = null,
  stoppedMemorySpan = null,
}) {
  const memoryText =
    memorySpan >= 5
      ? "孩子能記住較多圖片，視覺記憶表現良好。"
      : memorySpan >= 3
      ? "孩子可以記住部分圖片，記憶廣度表現尚可。"
      : "孩子目前能記住的圖片數量較少，仍需要透過練習累積記憶策略。";

  const accuracyText =
    accuracyPercent >= 85
      ? "作答正確率高，能穩定選出正確圖片。"
      : accuracyPercent >= 65
      ? "作答正確率尚可，但偶爾會選錯或漏選。"
      : "作答正確率偏低，可能需要確認是否理解規則或記憶負荷是否過高。";

  const speedText =
    averageCorrectReactionTime === null
      ? "目前答對題的有效作答時間資料不足。"
      : averageCorrectReactionTime <= 3000
      ? "答對題的作答速度很快。"
      : averageCorrectReactionTime <= 6000
      ? "答對題的作答速度大致穩定。"
      : "答對題的作答時間較長，可能需要更多時間回想圖片位置。";

  const stabilityText =
    reactionTimeStd === null
      ? "目前作答穩定度資料不足。"
      : reactionTimeStd <= 1500
      ? "各關作答時間相當穩定。"
      : reactionTimeStd <= 3000
      ? "作答時間略有波動。"
      : "作答時間變化較大，代表作答穩定度可以再觀察。";

  const attentionText =
    timeoutRate >= 0.5
      ? "逾時比例明顯偏高，需優先確認孩子是否放空、未理解規則，或作答時間設定是否過短。"
      : timeoutRate >= 0.3
      ? "逾時比例偏高，可能表示孩子需要更長的搜尋或回想時間。"
      : wrongTapRate >= 0.5
      ? "錯選題數比例偏高，可搭配漏選目標及可能混淆的物件分類一起觀察。"
      : deselectRate >= 0.5
      ? "取消選取題數比例偏高，可能表示孩子作答時較猶豫或對答案不確定。"
      : "整體作答過程沒有明顯過高的逾時、誤點或取消選取情況。";

  const trainingText =
    mode === "training"
      ? buildTrainingSpanText({
          spanSummaries,
          earlyStopReason,
          stoppedMemorySpan,
        })
      : "";

  return `${memoryText}${accuracyText}${speedText}${stabilityText}${attentionText}${trainingText}`;
}

function buildTrainingSpanText({
  spanSummaries = [],
  earlyStopReason = null,
  stoppedMemorySpan = null,
}) {
  const summaries = safeArray(spanSummaries);
  if (summaries.length === 0) return "";

  const firstSpan = summaries[0]?.memorySpan;
  const lastSpan = summaries[summaries.length - 1]?.memorySpan;

  const bestPassedSpan = summaries
    .filter((summary) => summary.correctCount >= TRAINING_SPAN_TRIAL_COUNT)
    .reduce((best, summary) => Math.max(best, summary.memorySpan || 0), 0);

  const baseText = `本次訓練從 ${firstSpan} 張圖片開始，最後進行到 ${lastSpan} 張圖片；目前可成功答對的最高跨度約為 ${bestPassedSpan || 0} 張。`;

  if (earlyStopReason === "span_two_timeouts") {
    return `${baseText}因為 ${stoppedMemorySpan || lastSpan} 張圖片連續兩題逾時，建議下次先降低一個跨度，作答上限維持 15 秒。`;
  }

  if (earlyStopReason === "span_two_failed") {
    return `${baseText}因為 ${stoppedMemorySpan || lastSpan} 張圖片連續兩題未答對，建議下次從較低跨度穩定練習。`;
  }

  return `${baseText}若孩子能穩定完成目前跨度，可以下次再逐步增加圖片數量。`;
}

function buildClinicalFlags({
  accuracyPercent,
  memorySpan,
  averageCorrectReactionTime,
  reactionTimeStd,
  timeoutRate,
  wrongTapRate,
  deselectRate,
  usedRtFallbackForStd,
  earlyStopReason = null,
  stoppedMemorySpan = null,
  possibleConfusionCount = 0,
  promptCount = 0,
}) {
  const flags = [];
  if (promptCount > 0) flags.push({ type: "support_used", level: "notice", message: `本次實際出現 ${promptCount} 次等待提示，應區分有提示與獨立作答的表現。` });
  if (possibleConfusionCount > 0) flags.push({ type: "possible_confusion", level: "notice", message: `本次有 ${possibleConfusionCount} 個錯選物件與漏選目標具有相近外形或同類關聯；此紀錄不能確認實際錯誤原因。` });

  if (timeoutRate >= 0.8) {
    flags.push({
      type: "timeout_extreme",
      level: "critical",
      message:
        "逾時比例極高，需優先判讀為放空、未理解規則、拒答或作答時間不足；不應因誤點數為 0 而視為正常表現。",
    });
  } else if (timeoutRate >= 0.5) {
    flags.push({
      type: "timeout_high",
      level: "warning",
      message:
        "逾時比例偏高，建議優先確認孩子是否理解規則、是否需要較長搜尋時間，或是否出現放空不作答。",
    });
  } else if (timeoutRate >= 0.3) {
    flags.push({
      type: "timeout_moderate",
      level: "notice",
      message:
        "逾時比例略高，建議搭配錯誤型態與反應時間一起觀察。",
    });
  }

  if (accuracyPercent < 60) {
    flags.push({
      type: "accuracy_low",
      level: "warning",
      message:
        "整體正確率偏低，建議觀察孩子是否理解規則、是否記憶負荷過高，或是否容易分心。",
    });
  }

  if (memorySpan < 3) {
    flags.push({
      type: "memory_span_low",
      level: "notice",
      message:
        "成功記住的圖片數量較少，可能代表視覺工作記憶廣度仍需觀察。",
    });
  }

  if (
    averageCorrectReactionTime !== null &&
    averageCorrectReactionTime > 7000
  ) {
    flags.push({
      type: "reaction_slow",
      level: "notice",
      message:
        "答對題平均作答時間偏長，可能表示回想圖片或搜尋答案需要較多時間。",
    });
  }

  if (usedRtFallbackForStd) {
    flags.push({
      type: "rt_std_fallback_used",
      level: "notice",
      message:
        "正確題反應時間數不足，系統已使用中位數保底樣本計算穩定度，避免全錯或全逾時造成 NaN。",
    });
  }

  if (reactionTimeStd !== null && reactionTimeStd > 3000) {
    flags.push({
      type: "stability_low",
      level: "notice",
      message:
        "作答時間變異較大，可能代表作答策略不穩定或注意力波動較明顯。",
    });
  }

  if (wrongTapRate >= 0.5) {
    flags.push({
      type: "wrong_tap_high",
      level: "notice",
      message:
        "發生錯選的題數比例偏高，需搭配目標、選項、漏選及可能混淆分類判讀，不能僅依錯選認定衝動。",
    });
  }

  if (deselectRate >= 0.5) {
    flags.push({
      type: "deselect_high",
      level: "notice",
      message:
        "發生取消選取的題數比例偏高，可能表示作答猶豫或對答案不確定。",
    });
  }

  if (earlyStopReason === "span_two_timeouts") {
    flags.push({
      type: "training_span_timeout_stop",
      level: "warning",
      message: `訓練在 ${stoppedMemorySpan || "某一"} 張圖片跨度因連續兩題逾時而停止，建議降低記憶負荷，作答上限維持 15 秒。`,
    });
  }

  if (earlyStopReason === "span_two_failed") {
    flags.push({
      type: "training_span_failed_stop",
      level: "notice",
      message: `訓練在 ${stoppedMemorySpan || "某一"} 張圖片跨度因連續兩題未答對而停止，建議下次從較低記憶跨度穩定練習。`,
    });
  }

  if (flags.length === 0) {
    flags.push({
      type: "normal",
      level: "normal",
      message: "目前未看到明顯異常旗標，可搭配其他 EF 任務一起解讀。",
    });
  }

  return flags;
}

export function getStoredPMResult(options = {}) {
  try {
    const childId =
      options?.childId ||
      getStoredValue("currentChildId") ||
      getStoredValue("selectedChildId") ||
      getStoredValue("activeChildId") ||
      getStoredValue("childId") ||
      getStoredChildIdFromObject();

    const keys = [
      ...(options?.preferTraining
        ? ["latestPMTrainingResult", "pmTrainingResult"]
        : []),
      ...(childId ? [`pmTestResult_${childId}`] : []),
      "latestPMTestResult",
      "pmTestResult",
      "PMTestResult",
      "pictureMemoryTestResult",
      "result_picture_memory_test",
      "ef_game_pm_test_result",
      "latestPMTrainingResult",
      "pmTrainingResult",
    ];

    for (const key of keys) {
      const parsed = parseStoredJson(key);
      if (!parsed) continue;

      if (Array.isArray(parsed)) {
        return calculatePMScore(parsed, {
          mode: key.toLowerCase().includes("training") ? "training" : "test",
        });
      }

      if (Array.isArray(parsed.records)) {
        return {
          ...parsed,
          scoring:
            parsed.scoring ||
            calculatePMScore(parsed.records, {
              mode:
                parsed.mode ||
                (key.toLowerCase().includes("training") ? "training" : "test"),
              plannedTotalRounds: parsed.plannedTotalRounds,
              earlyStopReason: parsed.earlyStopReason,
              stoppedMemorySpan: parsed.stoppedMemorySpan,
              completedByRule: parsed.completedByRule,
            }),
        };
      }
    }

    return null;
  } catch (error) {
    console.error("讀取 PM 測驗/訓練結果失敗：", error);
    return null;
  }
}

function getStoredValue(key) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function parseStoredJson(key) {
  const raw = getStoredValue(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function getStoredChildIdFromObject() {
  const childObject =
    parseStoredJson("currentChild") ||
    parseStoredJson("selectedChild") ||
    parseStoredJson("activeChild");

  return childObject?.id || childObject?.childId || childObject?.profileId || null;
}

export default calculatePMScore;
