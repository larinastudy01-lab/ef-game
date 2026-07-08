// src/ai/cbtTrainingAnalyzer.js

/**
 * CBT Training Analyzer
 * ------------------------------------------------------------
 * 規則式 AI 分析器，用於分析 CBT / Corsi Block Tapping 訓練紀錄。
 *
 * 功能：
 * 1. 計算正確率、獨立完成率、重看率、逾時率、提示率
 * 2. 判斷錯誤型態：位置錯、順序錯、前段錯、後段錯、少點、多點
 * 3. 計算 independentSpan / assistedSpan / unstableSpan
 * 4. 偵測疲勞與注意下降
 * 5. 計算 performanceScore
 * 6. 推薦下一次訓練難度
 * 7. 產生家長端與醫療端摘要
 */

export const CBT_DIFFICULTY_ORDER = [
  "veryEasy1",
  "veryEasy2",
  "veryEasy3",
  "easy1",
  "easy2",
  "easy3",
  "normal1",
  "normal2",
  "normal3",
  "advanced1",
  "advanced2",
  "advanced3",
  "hard1",
  "hard2",
  "hard3",
  "expert1",
  "expert2",
  "expert3",
];

export const CBT_PERFORMANCE_LEVEL = {
  EXCELLENT: "excellent",
  STABLE: "stable",
  PRACTICE_ZONE: "practice_zone",
  DIFFICULT: "difficult",
  OVERLOAD: "overload",
};

export const CBT_MAIN_WEAKNESS = {
  NONE: "none",
  SEQUENCE_MEMORY: "sequence_memory",
  SPATIAL_MEMORY: "spatial_memory",
  ORDER_MEMORY: "order_memory",
  ATTENTION_INITIATION: "attention_initiation",
  RESPONSE_SPEED: "response_speed",
  FATIGUE: "fatigue",
  SUPPORT_DEPENDENCE: "support_dependence",
  IMPULSIVE_TAPPING: "impulsive_tapping",
};

export const CBT_RECOMMENDED_ACTION = {
  INCREASE_TWO_LEVELS: "increase_two_levels",
  INCREASE_ONE_LEVEL: "increase_one_level",
  MAINTAIN: "maintain",
  DECREASE_ONE_LEVEL: "decrease_one_level",
  DECREASE_TWO_LEVELS: "decrease_two_levels",

  DECREASE_SEQUENCE_LENGTH: "decrease_sequence_length",
  REDUCE_SPATIAL_LOAD: "reduce_spatial_load",
  REDUCE_PATH_COMPLEXITY: "reduce_path_complexity",
  INCREASE_ANSWER_TIME: "increase_answer_time",
  MAINTAIN_WITH_REPLAY: "maintain_with_replay",
  INCREASE_NONVERBAL_SUPPORT: "increase_nonverbal_support",
  REDUCE_FATIGUE_LOAD: "reduce_fatigue_load",
};

const clamp = (value, min = 0, max = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
};

const safeDiv = (num, den, fallback = 0) => {
  const n = Number(num);
  const d = Number(den);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return fallback;
  return n / d;
};

const avg = (arr = []) => {
  const valid = arr.map(Number).filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const normalizeBool = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

const normalizeDifficulty = (difficulty = "normal1") => {
  const raw = String(difficulty || "normal1").trim();
  if (CBT_DIFFICULTY_ORDER.includes(raw)) return raw;

  const key = raw.replace(/[-_\s]/g, "").toLowerCase();

  const found = CBT_DIFFICULTY_ORDER.find(
    (item) => item.toLowerCase() === key
  );

  if (found) return found;

  if (key.startsWith("veryeasy")) return "veryEasy2";
  if (key.startsWith("easy")) return "easy2";
  if (key.startsWith("normal")) return "normal2";
  if (key.startsWith("advanced")) return "advanced2";
  if (key.startsWith("hard")) return "hard2";
  if (key.startsWith("expert")) return "expert2";

  return "normal1";
};

const getSequenceLength = (round) =>
  Number(
    round?.sequenceLength ??
      round?.memorySpan ??
      round?.length ??
      round?.targetLength ??
      round?.targetSequence?.length ??
      round?.sequence?.length ??
      0
  ) || 0;

const getTargetSequence = (round) => {
  if (Array.isArray(round?.targetSequence)) return round.targetSequence;
  if (Array.isArray(round?.correctSequence)) return round.correctSequence;
  if (Array.isArray(round?.sequence)) return round.sequence;
  return [];
};

const getUserSequence = (round) => {
  if (Array.isArray(round?.userSequence)) return round.userSequence;
  if (Array.isArray(round?.inputSequence)) return round.inputSequence;
  if (Array.isArray(round?.clickedSequence)) return round.clickedSequence;
  if (Array.isArray(round?.selectedSequence)) return round.selectedSequence;
  return [];
};

const isTimeoutRound = (round) =>
  normalizeBool(round?.timeout) ||
  normalizeBool(round?.isTimeout) ||
  round?.errorType === "timeout";

const isRoundCorrect = (round) =>
  normalizeBool(round?.correct) ||
  normalizeBool(round?.isCorrect) ||
  normalizeBool(round?.cleanCorrect) ||
  normalizeBool(round?.rescueCorrect);

const getReplayCount = (round) =>
  Math.max(0, Number(round?.replayCount ?? round?.replays ?? 0) || 0);

const usedReplay = (round) =>
  normalizeBool(round?.usedReplay) ||
  normalizeBool(round?.replayUsed) ||
  getReplayCount(round) > 0;

const usedHint = (round) =>
  normalizeBool(round?.usedHint) ||
  normalizeBool(round?.hintUsed) ||
  normalizeBool(round?.usedSupport);

const isIdleHintShown = (round) => normalizeBool(round?.idleHintShown);

const isRescueCorrect = (round) => normalizeBool(round?.rescueCorrect);

const isCleanCorrect = (round) =>
  isRoundCorrect(round) &&
  !isTimeoutRound(round) &&
  !usedReplay(round) &&
  !usedHint(round) &&
  !isIdleHintShown(round) &&
  !normalizeBool(round?.wasRescued) &&
  !normalizeBool(round?.rescueUsed) &&
  !isRescueCorrect(round);

const isAssistedCorrect = (round) =>
  isRoundCorrect(round) &&
  !isCleanCorrect(round) &&
  (usedReplay(round) ||
    usedHint(round) ||
    isIdleHintShown(round) ||
    normalizeBool(round?.wasRescued) ||
    normalizeBool(round?.rescueUsed) ||
    isRescueCorrect(round));

const getFirstErrorPosition = (round) => {
  const existing = Number(round?.firstErrorPosition ?? round?.errorIndex);
  if (Number.isFinite(existing) && existing >= 0) return existing;

  const target = getTargetSequence(round);
  const user = getUserSequence(round);
  const len = Math.max(target.length, user.length);

  for (let i = 0; i < len; i += 1) {
    if (target[i] !== user[i]) return i;
  }

  return -1;
};

export function detectCBTErrorPattern(round) {
  if (!round) return "unknown";

  if (isTimeoutRound(round)) return "timeout_error";

  if (isRoundCorrect(round)) {
    if (isCleanCorrect(round)) return "clean_correct";
    if (isAssistedCorrect(round)) return "assisted_correct";
    return "correct";
  }

  if (round.errorPattern) return round.errorPattern;
  if (round.errorType === "timeout") return "timeout_error";

  const target = getTargetSequence(round);
  const user = getUserSequence(round);

  if (!target.length && !user.length) return "unknown";

  if (user.length < target.length) return "omission_error";
  if (user.length > target.length) return "extra_tap_error";

  const firstErrorPosition = getFirstErrorPosition(round);
  const targetSet = new Set(target);
  const userSet = new Set(user);

  const allUserInTarget = user.every((item) => targetSet.has(item));
  const sameItems =
    target.length === user.length &&
    target.every((item) => userSet.has(item)) &&
    user.every((item) => targetSet.has(item));

  if (sameItems && firstErrorPosition >= 0) return "order_error";
  if (!allUserInTarget) return "location_error";

  if (firstErrorPosition >= 0) {
    const half = Math.max(1, Math.floor(target.length / 2));
    return firstErrorPosition < half ? "early_error" : "late_error";
  }

  return "sequence_error";
}

export function calculateCBTMetrics(history = []) {
  const rounds = Array.isArray(history) ? history.filter(Boolean) : [];
  const totalRounds = rounds.length;

  if (!totalRounds) {
    return {
      totalRounds: 0,
      correctCount: 0,
      wrongCount: 0,
      cleanCorrectCount: 0,
      assistedCorrectCount: 0,
      rescueCorrectCount: 0,
      timeoutCount: 0,
      replayUsedCount: 0,
      idleHintShownCount: 0,

      accuracy: 0,
      cleanAccuracy: 0,
      assistedAccuracy: 0,
      timeoutRate: 0,
      replayRate: 0,
      idleHintRate: 0,
      rescueCorrectRate: 0,

      earlyErrorRate: 0,
      lateErrorRate: 0,
      orderErrorRate: 0,
      locationErrorRate: 0,
      omissionErrorRate: 0,
      extraTapErrorRate: 0,

      independentSpan: 0,
      assistedSpan: 0,
      unstableSpan: 0,
      maxAttemptedSpan: 0,
      targetSpan: 0,

      firstHalfAccuracy: 0,
      secondHalfAccuracy: 0,
      fatigueDrop: 0,

      averageReactionTime: 0,
      averageFirstTapTime: 0,
      averageTapInterval: 0,

      errorPatternCounts: {},
      supportNeedRate: 0,
      spanStats: [],
    };
  }

  let correctCount = 0;
  let cleanCorrectCount = 0;
  let assistedCorrectCount = 0;
  let rescueCorrectCount = 0;
  let timeoutCount = 0;
  let replayUsedCount = 0;
  let idleHintShownCount = 0;

  const errorPatternCounts = {};
  const wrongRounds = [];
  const reactionTimes = [];
  const firstTapTimes = [];
  const tapIntervals = [];
  const spanStatsMap = {};

  rounds.forEach((round) => {
    const correct = isRoundCorrect(round);
    const cleanCorrect = isCleanCorrect(round);
    const assistedCorrect = isAssistedCorrect(round);
    const rescueCorrect = isRescueCorrect(round);
    const timeout = isTimeoutRound(round);
    const replay = usedReplay(round);
    const idleHint = isIdleHintShown(round);
    const sequenceLength = getSequenceLength(round);

    if (sequenceLength > 0) {
      if (!spanStatsMap[sequenceLength]) {
        spanStatsMap[sequenceLength] = {
          total: 0,
          correct: 0,
          cleanCorrect: 0,
          assistedCorrect: 0,
          timeout: 0,
          wrong: 0,
        };
      }

      spanStatsMap[sequenceLength].total += 1;
      if (correct) spanStatsMap[sequenceLength].correct += 1;
      if (cleanCorrect) spanStatsMap[sequenceLength].cleanCorrect += 1;
      if (assistedCorrect) spanStatsMap[sequenceLength].assistedCorrect += 1;
      if (timeout) spanStatsMap[sequenceLength].timeout += 1;
      if (!correct) spanStatsMap[sequenceLength].wrong += 1;
    }

    if (correct) correctCount += 1;
    if (cleanCorrect) cleanCorrectCount += 1;
    if (assistedCorrect) assistedCorrectCount += 1;
    if (rescueCorrect) rescueCorrectCount += 1;
    if (timeout) timeoutCount += 1;
    if (replay) replayUsedCount += 1;
    if (idleHint) idleHintShownCount += 1;

    if (Number.isFinite(Number(round?.reactionTime))) {
      reactionTimes.push(Number(round.reactionTime));
    }

    if (Number.isFinite(Number(round?.firstTapTime))) {
      firstTapTimes.push(Number(round.firstTapTime));
    }

    if (Number.isFinite(Number(round?.averageTapInterval))) {
      tapIntervals.push(Number(round.averageTapInterval));
    }

    const pattern = detectCBTErrorPattern(round);
    errorPatternCounts[pattern] = (errorPatternCounts[pattern] || 0) + 1;

    if (!correct) {
      wrongRounds.push({
        ...round,
        errorPattern: pattern,
      });
    }
  });

  const wrongCount = totalRounds - correctCount;

  const countWrongPattern = (patterns) => {
    const list = Array.isArray(patterns) ? patterns : [patterns];
    return wrongRounds.filter((round) => list.includes(round.errorPattern))
      .length;
  };

  const earlyErrorCount = wrongRounds.filter((round) => {
    const pos = getFirstErrorPosition(round);
    const len = Math.max(1, getSequenceLength(round));
    return pos >= 0 && pos < Math.floor(len / 2);
  }).length;

  const lateErrorCount = wrongRounds.filter((round) => {
    const pos = getFirstErrorPosition(round);
    const len = Math.max(1, getSequenceLength(round));
    return pos >= Math.floor(len / 2);
  }).length;

  const orderErrorCount = countWrongPattern("order_error");
  const locationErrorCount = countWrongPattern("location_error");
  const omissionErrorCount = countWrongPattern("omission_error");
  const extraTapErrorCount = countWrongPattern("extra_tap_error");

  const spanStats = Object.entries(spanStatsMap)
    .map(([span, stat]) => ({
      span: Number(span),
      ...stat,
      accuracy: safeDiv(stat.correct, stat.total),
      cleanAccuracy: safeDiv(stat.cleanCorrect, stat.total),
      assistedAccuracy: safeDiv(
        stat.cleanCorrect + stat.assistedCorrect,
        stat.total
      ),
      timeoutRate: safeDiv(stat.timeout, stat.total),
      wrongRate: safeDiv(stat.wrong, stat.total),
    }))
    .sort((a, b) => a.span - b.span);

  const maxAttemptedSpan = spanStats.length
    ? Math.max(...spanStats.map((item) => item.span))
    : 0;

  const targetSpan =
    Math.round(avg(rounds.map((round) => getSequenceLength(round)))) ||
    maxAttemptedSpan ||
    1;

  const independentSpan =
    spanStats
      .filter((item) => item.total >= 1 && item.cleanAccuracy >= 0.5)
      .map((item) => item.span)
      .pop() || 0;

  const assistedSpan =
    spanStats
      .filter((item) => item.total >= 1 && item.assistedAccuracy >= 0.5)
      .map((item) => item.span)
      .pop() || independentSpan;

  const unstableSpan =
    spanStats
      .filter(
        (item) => item.total >= 1 && item.accuracy > 0 && item.accuracy < 0.75
      )
      .map((item) => item.span)
      .pop() || 0;

  const halfIndex = Math.ceil(totalRounds / 2);
  const firstHalf = rounds.slice(0, halfIndex);
  const secondHalf = rounds.slice(halfIndex);

  const firstHalfAccuracy = safeDiv(
    firstHalf.filter((round) => isRoundCorrect(round)).length,
    firstHalf.length
  );

  const secondHalfAccuracy = safeDiv(
    secondHalf.filter((round) => isRoundCorrect(round)).length,
    secondHalf.length,
    firstHalfAccuracy
  );

  const fatigueDrop = Math.max(0, firstHalfAccuracy - secondHalfAccuracy);

  const accuracy = safeDiv(correctCount, totalRounds);
  const cleanAccuracy = safeDiv(cleanCorrectCount, totalRounds);
  const assistedAccuracy = safeDiv(assistedCorrectCount, totalRounds);
  const timeoutRate = safeDiv(timeoutCount, totalRounds);
  const replayRate = safeDiv(replayUsedCount, totalRounds);
  const idleHintRate = safeDiv(idleHintShownCount, totalRounds);
  const rescueCorrectRate = safeDiv(rescueCorrectCount, totalRounds);

  const supportNeedRate = clamp(
    replayRate * 0.4 + idleHintRate * 0.3 + timeoutRate * 0.3,
    0,
    1
  );

  return {
    totalRounds,
    correctCount,
    wrongCount,
    cleanCorrectCount,
    assistedCorrectCount,
    rescueCorrectCount,
    timeoutCount,
    replayUsedCount,
    idleHintShownCount,

    accuracy,
    cleanAccuracy,
    assistedAccuracy,
    timeoutRate,
    replayRate,
    idleHintRate,
    rescueCorrectRate,

    earlyErrorRate: safeDiv(earlyErrorCount, wrongCount),
    lateErrorRate: safeDiv(lateErrorCount, wrongCount),
    orderErrorRate: safeDiv(orderErrorCount, wrongCount),
    locationErrorRate: safeDiv(locationErrorCount, wrongCount),
    omissionErrorRate: safeDiv(omissionErrorCount, wrongCount),
    extraTapErrorRate: safeDiv(extraTapErrorCount, wrongCount),

    independentSpan,
    assistedSpan,
    unstableSpan,
    maxAttemptedSpan,
    targetSpan,

    firstHalfAccuracy,
    secondHalfAccuracy,
    fatigueDrop,

    averageReactionTime: avg(reactionTimes),
    averageFirstTapTime: avg(firstTapTimes),
    averageTapInterval: avg(tapIntervals),

    errorPatternCounts,
    supportNeedRate,
    spanStats,
  };
}

export function calculateCBTPerformanceScore(metrics = {}) {
  const accuracy = clamp(metrics.accuracy ?? 0, 0, 1);
  const cleanAccuracy = clamp(metrics.cleanAccuracy ?? 0, 0, 1);

  const spanScore =
    clamp(safeDiv(metrics.independentSpan ?? 0, metrics.targetSpan ?? 1), 0, 1) *
    15;

  const stabilityScore =
    Math.max(0, 1 - clamp(metrics.fatigueDrop ?? 0, 0, 1)) * 10;

  const independenceScore =
    Math.max(0, 1 - clamp(metrics.supportNeedRate ?? 0, 0, 1)) * 10;

  const score =
    accuracy * 45 +
    cleanAccuracy * 20 +
    spanScore +
    stabilityScore +
    independenceScore;

  return Math.round(clamp(score, 0, 100));
}

export function getCBTPerformanceLevel(score = 0) {
  if (score >= 85) return CBT_PERFORMANCE_LEVEL.EXCELLENT;
  if (score >= 70) return CBT_PERFORMANCE_LEVEL.STABLE;
  if (score >= 55) return CBT_PERFORMANCE_LEVEL.PRACTICE_ZONE;
  if (score >= 40) return CBT_PERFORMANCE_LEVEL.DIFFICULT;
  return CBT_PERFORMANCE_LEVEL.OVERLOAD;
}

export function detectCBTMainWeakness(metrics = {}) {
  if ((metrics.fatigueDrop ?? 0) >= 0.3) {
    return CBT_MAIN_WEAKNESS.FATIGUE;
  }

  if ((metrics.timeoutRate ?? 0) >= 0.35) {
    return CBT_MAIN_WEAKNESS.RESPONSE_SPEED;
  }

  if ((metrics.idleHintRate ?? 0) >= 0.35) {
    return CBT_MAIN_WEAKNESS.ATTENTION_INITIATION;
  }

  if ((metrics.locationErrorRate ?? 0) >= 0.45) {
    return CBT_MAIN_WEAKNESS.SPATIAL_MEMORY;
  }

  if ((metrics.orderErrorRate ?? 0) >= 0.45) {
    return CBT_MAIN_WEAKNESS.ORDER_MEMORY;
  }

  if ((metrics.extraTapErrorRate ?? 0) >= 0.35) {
    return CBT_MAIN_WEAKNESS.IMPULSIVE_TAPPING;
  }

  if ((metrics.earlyErrorRate ?? 0) >= 0.4 && (metrics.accuracy ?? 0) < 0.6) {
    return CBT_MAIN_WEAKNESS.SEQUENCE_MEMORY;
  }

  if (
    (metrics.replayRate ?? 0) >= 0.4 ||
    (metrics.supportNeedRate ?? 0) >= 0.4
  ) {
    return CBT_MAIN_WEAKNESS.SUPPORT_DEPENDENCE;
  }

  return CBT_MAIN_WEAKNESS.NONE;
}

export function getCBTSupportNeed(metrics = {}) {
  const supportNeedRate = metrics.supportNeedRate ?? 0;

  if (supportNeedRate >= 0.5) return "high";
  if (supportNeedRate >= 0.25) return "medium";
  return "low";
}

export function getCBTFatigueRisk(metrics = {}) {
  const fatigueDrop = metrics.fatigueDrop ?? 0;

  if (fatigueDrop >= 0.4) return "high";
  if (fatigueDrop >= 0.25) return "medium";
  return "low";
}

export function getCBTStageFromDifficulty(difficulty = "") {
  const key = normalizeDifficulty(difficulty);

  if (key.startsWith("veryEasy")) return "veryEasy";
  if (key.startsWith("easy")) return "easy";
  if (key.startsWith("normal")) return "normal";
  if (key.startsWith("advanced")) return "advanced";
  if (key.startsWith("hard")) return "hard";
  if (key.startsWith("expert")) return "expert";

  return "normal";
}

export function getCBTUpgradeThreshold(currentDifficulty = "normal1") {
  const stage = getCBTStageFromDifficulty(currentDifficulty);

  switch (stage) {
    case "veryEasy":
      return 65;
    case "easy":
      return 70;
    case "normal":
      return 75;
    case "advanced":
      return 80;
    case "hard":
      return 85;
    case "expert":
      return 90;
    default:
      return 75;
  }
}

export function recommendCBTNextDifficulty(
  metrics = {},
  score = 0,
  currentDifficulty = "normal1",
  difficultyOrder = CBT_DIFFICULTY_ORDER
) {
  const order =
    Array.isArray(difficultyOrder) && difficultyOrder.length
      ? difficultyOrder
      : CBT_DIFFICULTY_ORDER;

  const safeCurrentDifficulty = normalizeDifficulty(currentDifficulty);
  const currentIndex = Math.max(0, order.indexOf(safeCurrentDifficulty));
  const upgradeThreshold = getCBTUpgradeThreshold(safeCurrentDifficulty);

  let action = CBT_RECOMMENDED_ACTION.MAINTAIN;
  let reason = "目前表現接近練習區，建議維持相同難度再練習。";
  let indexDelta = 0;

  if ((metrics.fatigueDrop ?? 0) >= 0.3) {
    action = CBT_RECOMMENDED_ACTION.REDUCE_FATIGUE_LOAD;
    reason = "後半段表現下降，可能有疲勞或注意維持下降，下一輪不建議升級。";
    indexDelta = 0;
  } else if (
    (metrics.accuracy ?? 0) < 0.55 &&
    (metrics.earlyErrorRate ?? 0) >= 0.4
  ) {
    action = CBT_RECOMMENDED_ACTION.DECREASE_SEQUENCE_LENGTH;
    reason = "孩子常在前半段就出錯，代表目前記憶長度可能過高，建議降低序列長度。";
    indexDelta = -1;
  } else if ((metrics.locationErrorRate ?? 0) >= 0.45) {
    action = CBT_RECOMMENDED_ACTION.REDUCE_SPATIAL_LOAD;
    reason = "位置錯誤比例較高，建議減少方塊數或拉開方塊距離。";
    indexDelta = -1;
  } else if ((metrics.orderErrorRate ?? 0) >= 0.45) {
    action = CBT_RECOMMENDED_ACTION.REDUCE_PATH_COMPLEXITY;
    reason = "孩子大致記得位置，但順序較容易混淆，建議維持長度並降低路徑複雜度。";
    indexDelta = 0;
  } else if (
    (metrics.timeoutRate ?? 0) >= 0.3 &&
    (metrics.accuracy ?? 0) >= 0.5
  ) {
    action = CBT_RECOMMENDED_ACTION.INCREASE_ANSWER_TIME;
    reason = "孩子可能記得內容，但回想或作答啟動較慢，建議延長作答時間。";
    indexDelta = 0;
  } else if ((metrics.rescueCorrectRate ?? 0) >= 0.4) {
    action = CBT_RECOMMENDED_ACTION.MAINTAIN_WITH_REPLAY;
    reason = "孩子在提示或重看後可以完成，代表目前難度接近能力邊界，建議維持難度並保留支持。";
    indexDelta = 0;
  } else if ((metrics.idleHintRate ?? 0) >= 0.35) {
    action = CBT_RECOMMENDED_ACTION.INCREASE_NONVERBAL_SUPPORT;
    reason = "孩子需要較多非文字提示才能開始作答，建議保留提示支持。";
    indexDelta = 0;
  } else if (score >= 90 && score >= upgradeThreshold + 10) {
    action = CBT_RECOMMENDED_ACTION.INCREASE_TWO_LEVELS;
    reason = "孩子表現非常穩定，正確率與獨立完成率都高，可小幅加快進階。";
    indexDelta = 2;
  } else if (score >= upgradeThreshold) {
    action = CBT_RECOMMENDED_ACTION.INCREASE_ONE_LEVEL;
    reason = "孩子已穩定完成目前難度，可以提升一級。";
    indexDelta = 1;
  } else if (score >= 55) {
    action = CBT_RECOMMENDED_ACTION.MAINTAIN;
    reason = "目前難度落在適合練習的範圍，建議維持。";
    indexDelta = 0;
  } else if (score >= 40) {
    action = CBT_RECOMMENDED_ACTION.DECREASE_ONE_LEVEL;
    reason = "目前難度稍高，建議降低一級或增加提示支持。";
    indexDelta = -1;
  } else {
    action = CBT_RECOMMENDED_ACTION.DECREASE_TWO_LEVELS;
    reason = "目前難度明顯過高，建議降低兩級，先建立成功經驗。";
    indexDelta = -2;
  }

  const recommendedIndex = clamp(currentIndex + indexDelta, 0, order.length - 1);
  const recommendedDifficulty = order[recommendedIndex];

  return {
    currentDifficulty: safeCurrentDifficulty,
    recommendedDifficulty,
    action,
    reason,
    indexDelta,
    upgradeThreshold,
  };
}

export function buildCBTParentSummary(analysis = {}) {
  const metrics = analysis.metrics || {};
  const score = analysis.performanceScore ?? 0;
  const weakness = analysis.mainWeakness || CBT_MAIN_WEAKNESS.NONE;
  const recommendation = analysis.recommendation || {};

  const independentSpan = metrics.independentSpan ?? 0;
  const assistedSpan = metrics.assistedSpan ?? independentSpan;
  const accuracyPercent = Math.round((metrics.accuracy ?? 0) * 100);

  let summary = `本次方塊記憶訓練整體完成率約 ${accuracyPercent}%。`;

  if (independentSpan > 0) {
    summary += ` 孩子目前可獨立記住約 ${independentSpan} 步的空間順序`;
    if (assistedSpan > independentSpan) {
      summary += `，在提示或重看後可嘗試到 ${assistedSpan} 步`;
    }
    summary += "。";
  }

  switch (weakness) {
    case CBT_MAIN_WEAKNESS.SEQUENCE_MEMORY:
      summary += " 錯誤較常出現在序列前段，代表目前記憶長度可能偏高，建議先從較短序列建立穩定度。";
      break;

    case CBT_MAIN_WEAKNESS.SPATIAL_MEMORY:
      summary += " 孩子較容易點到非目標位置，表示空間位置辨識與記憶仍需要練習。";
      break;

    case CBT_MAIN_WEAKNESS.ORDER_MEMORY:
      summary += " 孩子大致能記得出現過的位置，但較容易混淆先後順序，建議維持目前長度並多練習順序記憶。";
      break;

    case CBT_MAIN_WEAKNESS.ATTENTION_INITIATION:
      summary += " 孩子需要較多非文字提示才開始作答，可能需要更多注意啟動支持。";
      break;

    case CBT_MAIN_WEAKNESS.RESPONSE_SPEED:
      summary += " 孩子可能需要較長時間回想，不一定代表不會，建議訓練時先保留較充裕的作答時間。";
      break;

    case CBT_MAIN_WEAKNESS.FATIGUE:
      summary += " 後半段表現有下降，可能與疲勞或注意維持有關，下一次可先維持難度。";
      break;

    case CBT_MAIN_WEAKNESS.SUPPORT_DEPENDENCE:
      summary += " 孩子在提示或重看後較能完成，表示目前難度接近能力邊界，適合持續練習。";
      break;

    case CBT_MAIN_WEAKNESS.IMPULSIVE_TAPPING:
      summary += " 孩子有較多多點或過快點擊情形，可能需要在作答時加入較穩定的節奏引導。";
      break;

    default:
      if (score >= 70) {
        summary += " 整體表現穩定，可以考慮逐步增加記憶長度或方塊數量。";
      } else {
        summary += " 建議先維持目前難度，透過短序列與穩定練習提升成功率。";
      }
      break;
  }

  if (recommendation.reason) {
    summary += ` 系統建議：${recommendation.reason}`;
  }

  return summary;
}

export function buildCBTClinicianNotes(analysis = {}) {
  const metrics = analysis.metrics || {};
  const recommendation = analysis.recommendation || {};

  return {
    score: analysis.performanceScore ?? 0,
    performanceLevel: analysis.performanceLevel,
    mainWeakness: analysis.mainWeakness,
    fatigueRisk: analysis.fatigueRisk,
    supportNeed: analysis.supportNeed,

    independentSpan: metrics.independentSpan ?? 0,
    assistedSpan: metrics.assistedSpan ?? 0,
    unstableSpan: metrics.unstableSpan ?? 0,
    maxAttemptedSpan: metrics.maxAttemptedSpan ?? 0,
    targetSpan: metrics.targetSpan ?? 0,

    accuracy: metrics.accuracy ?? 0,
    cleanAccuracy: metrics.cleanAccuracy ?? 0,
    assistedAccuracy: metrics.assistedAccuracy ?? 0,

    timeoutRate: metrics.timeoutRate ?? 0,
    replayRate: metrics.replayRate ?? 0,
    idleHintRate: metrics.idleHintRate ?? 0,
    rescueCorrectRate: metrics.rescueCorrectRate ?? 0,
    supportNeedRate: metrics.supportNeedRate ?? 0,

    earlyErrorRate: metrics.earlyErrorRate ?? 0,
    lateErrorRate: metrics.lateErrorRate ?? 0,
    orderErrorRate: metrics.orderErrorRate ?? 0,
    locationErrorRate: metrics.locationErrorRate ?? 0,
    omissionErrorRate: metrics.omissionErrorRate ?? 0,
    extraTapErrorRate: metrics.extraTapErrorRate ?? 0,

    fatigueDrop: metrics.fatigueDrop ?? 0,
    averageReactionTime: metrics.averageReactionTime ?? 0,
    averageFirstTapTime: metrics.averageFirstTapTime ?? 0,
    averageTapInterval: metrics.averageTapInterval ?? 0,

    spanStats: metrics.spanStats || [],
    errorPatternCounts: metrics.errorPatternCounts || {},

    recommendedDifficulty: recommendation.recommendedDifficulty,
    recommendedAction: recommendation.action,
    recommendationReason: recommendation.reason,
  };
}

export function analyzeCBTTraining(history = [], options = {}) {
  const {
    currentDifficulty = "normal1",
    difficultyOrder = CBT_DIFFICULTY_ORDER,
    includeSummary = true,
    mode = "training",
  } = options;

  const metrics = calculateCBTMetrics(history);
  const performanceScore = calculateCBTPerformanceScore(metrics);
  const performanceLevel = getCBTPerformanceLevel(performanceScore);
  const mainWeakness = detectCBTMainWeakness(metrics);
  const fatigueRisk = getCBTFatigueRisk(metrics);
  const supportNeed = getCBTSupportNeed(metrics);

  const recommendation = recommendCBTNextDifficulty(
    metrics,
    performanceScore,
    currentDifficulty,
    difficultyOrder
  );

  const analysis = {
    game: "CBT",
    mode,

    performanceScore,
    performanceLevel,
    mainWeakness,
    fatigueRisk,
    supportNeed,

    metrics,
    recommendation,

    recommendedDifficulty: recommendation.recommendedDifficulty,
    recommendedAction: recommendation.action,
    recommendationReason: recommendation.reason,

    independentSpan: metrics.independentSpan,
    assistedSpan: metrics.assistedSpan,
    unstableSpan: metrics.unstableSpan,
    maxAttemptedSpan: metrics.maxAttemptedSpan,
    targetSpan: metrics.targetSpan,

    accuracy: metrics.accuracy,
    cleanAccuracy: metrics.cleanAccuracy,
    assistedAccuracy: metrics.assistedAccuracy,
    timeoutRate: metrics.timeoutRate,
    replayRate: metrics.replayRate,
    idleHintRate: metrics.idleHintRate,
    rescueCorrectRate: metrics.rescueCorrectRate,
    supportNeedRate: metrics.supportNeedRate,
    fatigueDrop: metrics.fatigueDrop,
  };

  if (includeSummary) {
    analysis.parentSummary = buildCBTParentSummary(analysis);
    analysis.clinicianNotes = buildCBTClinicianNotes(analysis);
  }

  return analysis;
}

export default analyzeCBTTraining;