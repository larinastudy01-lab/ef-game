// src/ai/pmTrainingAnalyzer.js

/*
  =========================================================
  PM 圖片記憶訓練分析器
  =========================================================

  給 TrainingPage_PM.jsx 使用：

  export:
  1. PM_RT_TARGET_MAP
  2. calculatePMAIScore()
  3. analyzePMTraining()

  已串接新版：
  - records 完整分析
  - memorySpan / spanTrialIndex / spanTrialTotal
  - 每個記憶跨度 2 題
  - 兩題都錯 / 兩題都逾時停止規則
  - 支援 PM 第 7 級、最多 8 張圖片
  =========================================================
*/

export const PM_RT_TARGET_MAP = {
  easy: 9000,
  normal: 7500,
  hard: 6000,

  1: 9000,
  2: 8500,
  3: 7500,
  4: 7000,
  5: 6500,
  6: 6000,
  7: 5500,
};

const MAX_PM_DIFFICULTY_LEVEL = 7;
const MAX_PM_MEMORY_SPAN = 8;
const SPAN_TRIAL_TOTAL = 2;

function clamp(value, min = 0, max = 100) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return min;
  return Math.max(min, Math.min(max, numericValue));
}

function safeNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function round(value, digits = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;

  const factor = 10 ** digits;
  return Math.round(numericValue * factor) / factor;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeAccuracy(value) {
  const numericValue = safeNumber(value, 0);

  if (numericValue > 1) {
    return clamp(numericValue / 100, 0, 1);
  }

  return clamp(numericValue, 0, 1);
}

function normalizeDifficultyLevel(value) {
  const numericValue = Math.round(safeNumber(value, 1));
  return clamp(numericValue, 1, MAX_PM_DIFFICULTY_LEVEL);
}

function normalizeMemorySpan(value) {
  const numericValue = Math.round(safeNumber(value, 0));
  return clamp(numericValue, 0, MAX_PM_MEMORY_SPAN);
}

function getBroadDifficulty(difficultyLevel) {
  const level = normalizeDifficultyLevel(difficultyLevel);

  if (level <= 2) return "easy";
  if (level <= 5) return "normal";
  return "hard";
}

function getReactionTimeTarget(difficultyLevel) {
  const level = normalizeDifficultyLevel(difficultyLevel);
  const broadDifficulty = getBroadDifficulty(level);

  return (
    PM_RT_TARGET_MAP[level] ||
    PM_RT_TARGET_MAP[broadDifficulty] ||
    PM_RT_TARGET_MAP.easy
  );
}

function average(numbers = []) {
  const validNumbers = safeArray(numbers).filter((value) =>
    Number.isFinite(Number(value))
  );

  if (validNumbers.length === 0) return 0;

  return (
    validNumbers.reduce((sum, value) => sum + Number(value), 0) /
    validNumbers.length
  );
}

function standardDeviation(numbers = []) {
  const validNumbers = safeArray(numbers).filter((value) =>
    Number.isFinite(Number(value))
  );

  if (validNumbers.length < 2) return 0;

  const mean = average(validNumbers);
  const variance =
    validNumbers.reduce((sum, value) => sum + (Number(value) - mean) ** 2, 0) /
    validNumbers.length;

  return Math.sqrt(variance);
}

function getRecordDifficultyLevel(record) {
  const rawDifficulty =
    record?.difficultyLevel ??
    record?.internalDifficulty ??
    record?.difficultyValue;

  const numericDifficulty = Number(rawDifficulty);

  if (Number.isFinite(numericDifficulty) && numericDifficulty > 0) {
    return normalizeDifficultyLevel(numericDifficulty);
  }

  const rawDifficultyText = String(record?.difficulty ?? "");
  if (/^\d+$/.test(rawDifficultyText)) {
    return normalizeDifficultyLevel(Number(rawDifficultyText));
  }

  const label = String(record?.difficultyLabel ?? "");

  if (
    label.includes("Lv.7") ||
    label.includes("8張") ||
    label.includes("最高挑戰")
  ) {
    return 7;
  }

  if (label.includes("高挑戰") || label.includes("Lv.6")) return 6;
  if (label.includes("記憶分辨") || label.includes("Lv.5")) return 5;
  if (label.includes("抗干擾") || label.includes("Lv.4")) return 4;
  if (label.includes("增加容量") || label.includes("Lv.3")) return 3;
  if (label.includes("基礎記憶") || label.includes("Lv.2")) return 2;
  if (label.includes("熟悉規則") || label.includes("Lv.1")) return 1;

  return 1;
}

function getRecordMemorySpan(record) {
  return normalizeMemorySpan(record?.memorySpan ?? record?.memoryCount ?? 0);
}

function getWrongTapCount(record) {
  const tapLogs = safeArray(record?.tapLogs);

  if (Number.isFinite(Number(record?.wrongTapCount))) {
    return Math.max(0, Number(record.wrongTapCount));
  }

  return tapLogs.filter(
    (tap) => tap?.action === "select" && tap?.isCorrectItem === false
  ).length;
}

function getDeselectCount(record) {
  const tapLogs = safeArray(record?.tapLogs);

  return tapLogs.filter((tap) => tap?.action === "deselect").length;
}

function calculateAccuracyScore(accuracy) {
  return round(clamp(normalizeAccuracy(accuracy) * 100, 0, 100));
}

function calculateReactionScore({
  avgReactionTime,
  difficultyLevel,
  accuracy,
}) {
  const reactionTime = safeNumber(avgReactionTime, 0);
  const safeAccuracy = normalizeAccuracy(accuracy);
  const target = getReactionTimeTarget(difficultyLevel);

  if (reactionTime <= 0) return 0;

  const ratio = reactionTime / target;

  let score = 20;

  if (ratio <= 0.65) score = 100;
  else if (ratio <= 0.85) score = 95;
  else if (ratio <= 1) score = 88;
  else if (ratio <= 1.2) score = 75;
  else if (ratio <= 1.5) score = 58;
  else if (ratio <= 2) score = 38;

  const accuracyWeight = 0.35 + safeAccuracy * 0.65;

  return round(clamp(score * accuracyWeight, 0, 100));
}

function calculateStabilityScore({
  reactionTimeStd,
  avgReactionTime,
  totalTrials,
}) {
  const standardDeviationValue = safeNumber(reactionTimeStd, 0);
  const averageReactionTime = safeNumber(avgReactionTime, 0);
  const trials = Math.max(0, Math.round(safeNumber(totalTrials, 0)));

  if (trials <= 1) return 70;
  if (standardDeviationValue <= 0 || averageReactionTime <= 0) return 55;

  const coefficientOfVariation =
    standardDeviationValue / Math.max(averageReactionTime, 1);

  if (coefficientOfVariation <= 0.12) return 100;
  if (coefficientOfVariation <= 0.2) return 90;
  if (coefficientOfVariation <= 0.3) return 78;
  if (coefficientOfVariation <= 0.45) return 62;
  if (coefficientOfVariation <= 0.6) return 45;

  return 25;
}

function calculateFocusScore({
  timeoutCount,
  totalTrials,
  totalWrongTapCount,
}) {
  const trials = Math.max(1, Math.round(safeNumber(totalTrials, 1)));
  const timeouts = clamp(Math.round(safeNumber(timeoutCount, 0)), 0, trials);
  const wrongTaps = Math.max(0, Math.round(safeNumber(totalWrongTapCount, 0)));

  const timeoutRate = timeouts / trials;
  const wrongTapRate = wrongTaps / trials;

  let score = 100;

  score -= timeoutRate * 65;
  score -= Math.min(wrongTapRate, 2) * 22;

  if (timeoutRate >= 0.8) {
    score = Math.min(score, 20);
  } else if (timeoutRate >= 0.5) {
    score = Math.min(score, 40);
  }

  return round(clamp(score, 0, 100));
}

function calculateFatigueScore(fatigueLevel) {
  const fatigue = clamp(safeNumber(fatigueLevel, 0), 0, 100);
  return round(clamp(100 - fatigue, 0, 100));
}

function calculateMemoryLoadScore({
  memorySpan,
  highestMemorySpan,
  difficultyLevel,
  accuracy,
}) {
  const span = normalizeMemorySpan(memorySpan || highestMemorySpan);
  const highestSpan = normalizeMemorySpan(highestMemorySpan || span);
  const level = normalizeDifficultyLevel(difficultyLevel);
  const safeAccuracy = normalizeAccuracy(accuracy);

  const spanScore = (highestSpan / MAX_PM_MEMORY_SPAN) * 45;
  const difficultyScore = (level / MAX_PM_DIFFICULTY_LEVEL) * 30;
  const accuracyScore = safeAccuracy * 25;

  return round(clamp(spanScore + difficultyScore + accuracyScore, 0, 100));
}

function getDifficultyDecision({
  aiScore,
  accuracy,
  timeoutRate,
  wrongTapRate,
  fatigueLevel,
  memorySpan,
  earlyStopReason,
}) {
  const safeAccuracy = normalizeAccuracy(accuracy);
  const safeScore = clamp(aiScore, 0, 100);
  const safeTimeoutRate = clamp(timeoutRate, 0, 1);
  const safeWrongTapRate = Math.max(0, safeNumber(wrongTapRate, 0));
  const safeFatigue = clamp(fatigueLevel, 0, 100);
  const safeMemorySpan = normalizeMemorySpan(memorySpan);

  if (
    earlyStopReason === "span_two_timeouts" ||
    safeTimeoutRate >= 0.5 ||
    safeAccuracy < 0.5 ||
    safeScore < 45 ||
    safeFatigue >= 75
  ) {
    return "decrease";
  }

  if (
    earlyStopReason === "span_two_failed" &&
    safeAccuracy < 0.65
  ) {
    return "decrease";
  }

  if (
    safeAccuracy >= 0.85 &&
    safeScore >= 82 &&
    safeTimeoutRate <= 0.15 &&
    safeWrongTapRate <= 0.3 &&
    safeFatigue < 55 &&
    safeMemorySpan < MAX_PM_MEMORY_SPAN
  ) {
    return "increase";
  }

  return "maintain";
}

function getTrainingSuggestion({
  difficultyDecision,
  accuracy,
  timeoutRate,
  wrongTapRate,
  fatigueLevel,
  reactionScore,
  memorySpan,
  earlyStopReason,
  stoppedMemorySpan,
}) {
  const safeAccuracy = normalizeAccuracy(accuracy);
  const spanText = stoppedMemorySpan || memorySpan || "目前";

  if (earlyStopReason === "span_two_timeouts") {
    return `在 ${spanText} 張圖片時連續兩題逾時，建議下次降低一個記憶跨度，或先延長作答時間。`;
  }

  if (earlyStopReason === "span_two_failed") {
    return `在 ${spanText} 張圖片時連續兩題未答對，建議下次從較低圖片數重新穩定練習。`;
  }

  if (timeoutRate >= 0.5) {
    return "逾時比例偏高，建議降低圖片數量或延長作答時間。";
  }

  if (fatigueLevel >= 75) {
    return "後段表現下降較明顯，建議先休息，再進行下一次訓練。";
  }

  if (safeAccuracy < 0.5) {
    return "目前記憶負荷可能過高，建議降低一級難度並加強基礎記憶。";
  }

  if (wrongTapRate >= 1) {
    return "誤點次數較多，建議減少干擾圖片並提醒看清楚後再作答。";
  }

  if (reactionScore < 45 && safeAccuracy >= 0.6) {
    return "正確率尚可，但回想時間較長，建議維持目前難度繼續練習。";
  }

  if (difficultyDecision === "increase") {
    return "目前表現穩定，可以嘗試增加圖片數量或縮短記憶時間。";
  }

  if (difficultyDecision === "decrease") {
    return "目前負荷偏高，建議降低一級難度，避免連續挫折。";
  }

  return "目前難度合適，建議維持難度並持續觀察作答穩定度。";
}

function buildSpanSummaries(records = []) {
  const groups = safeArray(records).reduce((map, record, index) => {
    const memorySpan = getRecordMemorySpan(record);
    if (!memorySpan) return map;

    if (!map.has(memorySpan)) {
      map.set(memorySpan, []);
    }

    map.get(memorySpan).push({ ...record, __index: index });
    return map;
  }, new Map());

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([memorySpan, spanRecords]) => {
      const trialCount = spanRecords.length;
      const correctCount = spanRecords.filter((record) => record?.isCorrect === true)
        .length;
      const timeoutCount = spanRecords.filter((record) => record?.isTimeout === true)
        .length;
      const wrongCount = spanRecords.filter(
        (record) => record?.isCorrect === false && record?.isTimeout !== true
      ).length;

      const latestTwoRecords = spanRecords.slice(-SPAN_TRIAL_TOTAL);
      const twoTrialReady = latestTwoRecords.length >= SPAN_TRIAL_TOTAL;

      const twoFailed =
        twoTrialReady && latestTwoRecords.every((record) => record?.isCorrect !== true);

      const twoTimeout =
        twoTrialReady && latestTwoRecords.every((record) => record?.isTimeout === true);

      return {
        memorySpan,
        trialCount,
        expectedTrialCount: SPAN_TRIAL_TOTAL,
        correctCount,
        wrongCount,
        timeoutCount,
        accuracy: trialCount > 0 ? round(correctCount / trialCount, 3) : 0,
        accuracyPercent: trialCount > 0 ? round((correctCount / trialCount) * 100) : 0,
        completedTwoTrialRule: trialCount >= SPAN_TRIAL_TOTAL,
        twoFailed,
        twoTimeout,
        shouldStopHere: twoFailed || twoTimeout,
        firstTrialIndex:
          spanRecords[0]?.trialIndex ?? spanRecords[0]?.level ?? spanRecords[0]?.round ?? null,
        lastTrialIndex:
          spanRecords[spanRecords.length - 1]?.trialIndex ??
          spanRecords[spanRecords.length - 1]?.level ??
          spanRecords[spanRecords.length - 1]?.round ??
          null,
      };
    });
}

function inferEarlyStopReason({ records = [], explicitReason = null }) {
  if (explicitReason) return explicitReason;

  const spanSummaries = buildSpanSummaries(records);
  const stoppedSpan = spanSummaries.find((summary) => summary.shouldStopHere);

  if (!stoppedSpan) return null;
  if (stoppedSpan.twoTimeout) return "span_two_timeouts";
  if (stoppedSpan.twoFailed) return "span_two_failed";

  return null;
}

function getStoppedMemorySpan({ records = [], explicitSpan = null }) {
  const numericSpan = Number(explicitSpan);
  if (Number.isFinite(numericSpan) && numericSpan > 0) {
    return normalizeMemorySpan(numericSpan);
  }

  const spanSummaries = buildSpanSummaries(records);
  const stoppedSpan = spanSummaries.find((summary) => summary.shouldStopHere);

  return stoppedSpan?.memorySpan ?? null;
}

function calculateFatigueFromRecords(records = []) {
  const safeRecords = safeArray(records);

  if (safeRecords.length < 4) return 0;

  const half = Math.floor(safeRecords.length / 2);
  const firstHalf = safeRecords.slice(0, half);
  const secondHalf = safeRecords.slice(half);

  const firstAccuracy =
    firstHalf.length > 0
      ? firstHalf.filter((record) => record?.isCorrect === true).length / firstHalf.length
      : 0;

  const secondAccuracy =
    secondHalf.length > 0
      ? secondHalf.filter((record) => record?.isCorrect === true).length / secondHalf.length
      : 0;

  const firstRt = average(
    firstHalf
      .map((record) => safeNumber(record?.reactionTime, -1))
      .filter((value) => value >= 0)
  );

  const secondRt = average(
    secondHalf
      .map((record) => safeNumber(record?.reactionTime, -1))
      .filter((value) => value >= 0)
  );

  const accuracyDrop = Math.max(0, firstAccuracy - secondAccuracy) * 70;
  const rtIncrease =
    firstRt > 0 && secondRt > firstRt
      ? clamp(((secondRt - firstRt) / firstRt) * 30, 0, 30)
      : 0;

  return round(clamp(accuracyDrop + rtIncrease, 0, 100));
}

export function calculatePMAIScore({
  accuracy = 0,
  avgReactionTime = 0,
  reactionTimeStd = 0,
  timeoutCount = 0,
  totalTrials = 1,
  totalWrongTapCount = 0,
  fatigueLevel = 0,
  difficultyLevel = 1,
  memorySpan = 0,
  highestMemorySpan = 0,
  earlyStopReason = null,
  stoppedMemorySpan = null,
} = {}) {
  const safeAccuracy = normalizeAccuracy(accuracy);
  const safeTotalTrials = Math.max(1, Math.round(safeNumber(totalTrials, 1)));
  const safeTimeoutCount = clamp(
    Math.round(safeNumber(timeoutCount, 0)),
    0,
    safeTotalTrials
  );
  const safeWrongTapCount = Math.max(
    0,
    Math.round(safeNumber(totalWrongTapCount, 0))
  );
  const safeFatigueLevel = clamp(safeNumber(fatigueLevel, 0), 0, 100);
  const safeDifficultyLevel = normalizeDifficultyLevel(difficultyLevel);
  const safeMemorySpan = normalizeMemorySpan(memorySpan);
  const safeHighestMemorySpan = normalizeMemorySpan(
    highestMemorySpan || memorySpan
  );

  const timeoutRate = safeTimeoutCount / safeTotalTrials;
  const wrongTapRate = safeWrongTapCount / safeTotalTrials;

  const accuracyScore = calculateAccuracyScore(safeAccuracy);

  const reactionScore = calculateReactionScore({
    avgReactionTime,
    difficultyLevel: safeDifficultyLevel,
    accuracy: safeAccuracy,
  });

  const stabilityScore = calculateStabilityScore({
    reactionTimeStd,
    avgReactionTime,
    totalTrials: safeTotalTrials,
  });

  const focusScore = calculateFocusScore({
    timeoutCount: safeTimeoutCount,
    totalTrials: safeTotalTrials,
    totalWrongTapCount: safeWrongTapCount,
  });

  const fatigueScore = calculateFatigueScore(safeFatigueLevel);

  const memoryLoadScore = calculateMemoryLoadScore({
    memorySpan: safeMemorySpan,
    highestMemorySpan: safeHighestMemorySpan,
    difficultyLevel: safeDifficultyLevel,
    accuracy: safeAccuracy,
  });

  let aiScore =
    accuracyScore * 0.34 +
    memoryLoadScore * 0.24 +
    reactionScore * 0.14 +
    stabilityScore * 0.1 +
    focusScore * 0.12 +
    fatigueScore * 0.06;

  if (timeoutRate >= 0.8) {
    aiScore = Math.min(aiScore, 25);
  } else if (timeoutRate >= 0.5) {
    aiScore = Math.min(aiScore, 42);
  }

  if (safeAccuracy === 0) {
    aiScore = Math.min(aiScore, 35);
  }

  if (earlyStopReason === "span_two_timeouts") {
    aiScore = Math.min(aiScore, 40);
  }

  if (earlyStopReason === "span_two_failed") {
    aiScore = Math.min(aiScore, 55);
  }

  aiScore = round(clamp(aiScore, 0, 100));

  const difficultyDecision = getDifficultyDecision({
    aiScore,
    accuracy: safeAccuracy,
    timeoutRate,
    wrongTapRate,
    fatigueLevel: safeFatigueLevel,
    memorySpan: safeMemorySpan,
    earlyStopReason,
  });

  const trainingSuggestion = getTrainingSuggestion({
    difficultyDecision,
    accuracy: safeAccuracy,
    timeoutRate,
    wrongTapRate,
    fatigueLevel: safeFatigueLevel,
    reactionScore,
    memorySpan: safeMemorySpan,
    earlyStopReason,
    stoppedMemorySpan,
  });

  return {
    aiScore,

    accuracyScore,
    memoryLoadScore,
    reactionScore,
    stabilityScore,
    focusScore,
    fatigueScore,

    accuracy: round(safeAccuracy, 3),
    accuracyPercent: round(safeAccuracy * 100),

    avgReactionTime: round(avgReactionTime),
    reactionTimeStd: round(reactionTimeStd),

    timeoutCount: safeTimeoutCount,
    timeoutRate: round(timeoutRate, 3),

    wrongTapCount: safeWrongTapCount,
    wrongTapRate: round(wrongTapRate, 3),

    totalTrials: safeTotalTrials,

    fatigueLevel: round(safeFatigueLevel),

    difficultyLevel: safeDifficultyLevel,
    broadDifficulty: getBroadDifficulty(safeDifficultyLevel),
    reactionTimeTarget: getReactionTimeTarget(safeDifficultyLevel),

    memorySpan: safeMemorySpan,
    highestMemorySpan: safeHighestMemorySpan,

    earlyStopReason,
    stoppedMemorySpan,

    difficultyDecision,
    trainingSuggestion,
  };
}

export function analyzePMTraining({
  records = [],

  accuracy = null,
  avgReactionTime = null,
  reactionTimeStd = null,
  timeoutCount = null,
  totalTrials = null,
  totalWrongTapCount = null,
  fatigueLevel = null,
  difficultyLevel = null,

  earlyStopReason = null,
  stoppedMemorySpan = null,
  completedByRule = null,
} = {}) {
  const safeRecords = safeArray(records);

  const resolvedTotalTrials =
    totalTrials !== null && totalTrials !== undefined
      ? Math.max(1, Math.round(safeNumber(totalTrials, 1)))
      : Math.max(1, safeRecords.length);

  const correctRecords = safeRecords.filter((record) => record?.isCorrect === true);

  const timeoutRecords = safeRecords.filter((record) => record?.isTimeout === true);

  const wrongRecords = safeRecords.filter(
    (record) => record?.isCorrect === false && record?.isTimeout !== true
  );

  const reactionTimes = safeRecords
    .map((record) => safeNumber(record?.reactionTime, -1))
    .filter((value) => value >= 0);

  const correctReactionTimes = correctRecords
    .map((record) => safeNumber(record?.reactionTime, -1))
    .filter((value) => value >= 0);

  const resolvedAccuracy =
    accuracy !== null && accuracy !== undefined
      ? normalizeAccuracy(accuracy)
      : correctRecords.length / resolvedTotalTrials;

  const resolvedAvgReactionTime =
    avgReactionTime !== null && avgReactionTime !== undefined
      ? safeNumber(avgReactionTime, 0)
      : reactionTimes.length > 0
      ? average(reactionTimes)
      : 0;

  const resolvedReactionTimeStd =
    reactionTimeStd !== null && reactionTimeStd !== undefined
      ? safeNumber(reactionTimeStd, 0)
      : correctReactionTimes.length >= 2
      ? standardDeviation(correctReactionTimes)
      : standardDeviation(reactionTimes);

  const resolvedTimeoutCount =
    timeoutCount !== null && timeoutCount !== undefined
      ? Math.max(0, Math.round(safeNumber(timeoutCount, 0)))
      : timeoutRecords.length;

  const resolvedWrongTapCount =
    totalWrongTapCount !== null && totalWrongTapCount !== undefined
      ? Math.max(0, Math.round(safeNumber(totalWrongTapCount, 0)))
      : safeRecords.reduce((sum, record) => sum + getWrongTapCount(record), 0);

  const resolvedDeselectCount = safeRecords.reduce(
    (sum, record) => sum + getDeselectCount(record),
    0
  );

  const memorySpans = safeRecords
    .map(getRecordMemorySpan)
    .filter((span) => span > 0);

  const correctMemorySpans = correctRecords
    .map(getRecordMemorySpan)
    .filter((span) => span > 0);

  const highestAttemptedMemorySpan =
    memorySpans.length > 0 ? Math.max(...memorySpans) : 0;

  const highestSuccessfulMemorySpan =
    correctMemorySpans.length > 0 ? Math.max(...correctMemorySpans) : 0;

  const latestMemorySpan =
    memorySpans.length > 0 ? memorySpans[memorySpans.length - 1] : 0;

  const difficultyLevels = safeRecords
    .map(getRecordDifficultyLevel)
    .filter((level) => level > 0);

  const resolvedDifficultyLevel =
    difficultyLevel !== null && difficultyLevel !== undefined
      ? normalizeDifficultyLevel(difficultyLevel)
      : difficultyLevels.length > 0
      ? normalizeDifficultyLevel(Math.max(...difficultyLevels))
      : 1;

  const spanSummaries = buildSpanSummaries(safeRecords);

  const resolvedEarlyStopReason = inferEarlyStopReason({
    records: safeRecords,
    explicitReason: earlyStopReason,
  });

  const resolvedStoppedMemorySpan = getStoppedMemorySpan({
    records: safeRecords,
    explicitSpan: stoppedMemorySpan,
  });

  const resolvedCompletedByRule =
    typeof completedByRule === "boolean"
      ? completedByRule
      : !resolvedEarlyStopReason;

  const resolvedFatigueLevel =
    fatigueLevel !== null && fatigueLevel !== undefined
      ? clamp(safeNumber(fatigueLevel, 0), 0, 100)
      : calculateFatigueFromRecords(safeRecords);

  const result = calculatePMAIScore({
    accuracy: resolvedAccuracy,
    avgReactionTime: resolvedAvgReactionTime,
    reactionTimeStd: resolvedReactionTimeStd,
    timeoutCount: resolvedTimeoutCount,
    totalTrials: resolvedTotalTrials,
    totalWrongTapCount: resolvedWrongTapCount,
    fatigueLevel: resolvedFatigueLevel,
    difficultyLevel: resolvedDifficultyLevel,
    memorySpan: latestMemorySpan,
    highestMemorySpan: highestSuccessfulMemorySpan || highestAttemptedMemorySpan,
    earlyStopReason: resolvedEarlyStopReason,
    stoppedMemorySpan: resolvedStoppedMemorySpan,
  });

  const timeoutRate = resolvedTimeoutCount / resolvedTotalTrials;
  const wrongRate = wrongRecords.length / resolvedTotalTrials;

  const nextDifficultyLevel = (() => {
    if (result.difficultyDecision === "increase") {
      return clamp(resolvedDifficultyLevel + 1, 1, MAX_PM_DIFFICULTY_LEVEL);
    }

    if (result.difficultyDecision === "decrease") {
      return clamp(resolvedDifficultyLevel - 1, 1, MAX_PM_DIFFICULTY_LEVEL);
    }

    return resolvedDifficultyLevel;
  })();

  const nextMemorySpan = (() => {
    if (result.difficultyDecision === "increase") {
      return clamp(
        (highestSuccessfulMemorySpan || latestMemorySpan || 2) + 1,
        2,
        MAX_PM_MEMORY_SPAN
      );
    }

    if (result.difficultyDecision === "decrease") {
      return clamp(
        (resolvedStoppedMemorySpan || latestMemorySpan || 3) - 1,
        2,
        MAX_PM_MEMORY_SPAN
      );
    }

    return clamp(highestSuccessfulMemorySpan || latestMemorySpan || 2, 2, MAX_PM_MEMORY_SPAN);
  })();

  return {
    ...result,

    correctTrials: correctRecords.length,
    wrongTrials: wrongRecords.length,
    timeoutTrials: timeoutRecords.length,

    totalTrials: resolvedTotalTrials,

    timeoutRate: round(timeoutRate, 3),
    wrongRate: round(wrongRate, 3),

    deselectCount: resolvedDeselectCount,

    spanSummaries,
    spanTrialTotal: SPAN_TRIAL_TOTAL,

    highestAttemptedMemorySpan,
    highestSuccessfulMemorySpan,
    latestMemorySpan,

    earlyStopReason: resolvedEarlyStopReason,
    stoppedMemorySpan: resolvedStoppedMemorySpan,
    completedByRule: resolvedCompletedByRule,

    nextDifficultyLevel,
    nextMemorySpan,

    records: safeRecords,

    analysisVersion: "PM_ANALYZER_V3_SPAN_CONNECTED",
    analyzedAt: new Date().toISOString(),
  };
}

export default analyzePMTraining;