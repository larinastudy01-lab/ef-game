// src/utils/lbTrainingAnalyzer.js
//
// LB 自適應訓練分析器
//
// 功能：
// 1. 從 LB 測驗結果決定初始訓練難度。
// 2. 從過往訓練紀錄調整下一次難度。
// 3. 分析本次訓練表現，產生下一關設定。
// 4. 支援 TrainingPage_LB.jsx 目前的 trialLogs 格式。
// 5. 支援 localStorage 中不同版本的 LB 結果 key。
// 6. 防止空資料、NaN、全錯、全逾時造成錯誤。
//
// 建議使用：
//
// import {
//   getLBInitialTrainingConfig,
//   analyzeLBTraining,
//   saveLBAdaptiveState,
// } from "../utils/lbTrainingAnalyzer";
//
// const initialConfig = getLBInitialTrainingConfig();
//
// const analysis = analyzeLBTraining({
//   records: finalLogs,
//   currentDifficulty: currentConfig.difficultyLevel,
//   currentLevelIndex: levelIndex,
// });
//
// saveLBAdaptiveState(analysis);

const GAME_ID = "LB";

const ADAPTIVE_STATE_KEY = "lbTrainingAdaptiveState";
const TRAINING_HISTORY_KEY = "lbTrainingHistory";

const TEST_RESULT_KEYS = [
  "latestLBTestResult",
  "lbTestResult",
  "LB_TEST_RESULT",
  "LB_RESULT",
];

const TRAINING_RESULT_KEYS = [
  "latestLBTrainingResult",
  "lbTrainingResult",
  "LB_TRAINING_RESULT",
];

export const LB_DIFFICULTY_LEVELS = {
  VERY_EASY: 1,
  EASY: 2,
  NORMAL: 3,
  HARD: 4,
  VERY_HARD: 5,
};

export const LB_DIFFICULTY_NAMES = {
  1: "veryEasy",
  2: "easy",
  3: "normal",
  4: "hard",
  5: "veryHard",
};

export const LB_DIFFICULTY_LABELS = {
  1: "非常簡單",
  2: "簡單",
  3: "普通",
  4: "困難",
  5: "非常困難",
};

const DEFAULT_OPTIONS = {
  minimumDifficulty: LB_DIFFICULTY_LEVELS.VERY_EASY,
  maximumDifficulty: LB_DIFFICULTY_LEVELS.VERY_HARD,
  defaultDifficulty: LB_DIFFICULTY_LEVELS.NORMAL,

  // 至少累積幾筆操作，才允許升高難度。
  minimumTrialsForIncrease: 5,

  // 至少幾筆正確 RT，才計算速度及穩定度。
  minimumCorrectRTCount: 2,

  // LB 合理反應時間範圍。
  idealReactionTime: 1100,
  acceptableReactionTime: 2600,
  slowReactionTime: 4500,
  maximumReactionTime: 10000,

  // 難度調整門檻。
  increaseScoreThreshold: 82,
  strongIncreaseScoreThreshold: 92,
  decreaseScoreThreshold: 55,
  strongDecreaseScoreThreshold: 35,

  // 避免單次偶然表現造成難度劇烈改變。
  maximumStepChange: 1,

  // 最多保留幾次訓練紀錄。
  maximumHistoryLength: 30,
};

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, safeNumber(value, min)));
}

function round(value, digits = 0) {
  const multiplier = 10 ** digits;
  return Math.round(safeNumber(value, 0) * multiplier) / multiplier;
}

function average(values, fallback = 0) {
  const validValues = values
    .map((value) => Number(value))
    .filter(Number.isFinite);

  if (!validValues.length) return fallback;

  return (
    validValues.reduce((sum, value) => sum + value, 0) /
    validValues.length
  );
}

function median(values, fallback = 0) {
  const validValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!validValues.length) return fallback;

  const middleIndex = Math.floor(validValues.length / 2);

  if (validValues.length % 2 === 0) {
    return (
      validValues[middleIndex - 1] + validValues[middleIndex]
    ) / 2;
  }

  return validValues[middleIndex];
}

function standardDeviation(values) {
  const validValues = values
    .map((value) => Number(value))
    .filter(Number.isFinite);

  if (validValues.length <= 1) return 0;

  const mean = average(validValues);
  const variance =
    validValues.reduce(
      (sum, value) => sum + Math.pow(value - mean, 2),
      0
    ) / validValues.length;

  return Math.sqrt(Math.max(0, variance));
}

function safeParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function safeGetStorage(storage, key) {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function safeSetStorage(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function normalizeDifficulty(value, fallback = 3) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(Math.round(value), 1, 5);
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

  const map = {
    "1": 1,
    veryeasy: 1,
    beginner: 1,
    simplest: 1,
    最簡單: 1,
    非常簡單: 1,

    "2": 2,
    easy: 2,
    simple: 2,
    簡單: 2,

    "3": 3,
    normal: 3,
    medium: 3,
    adaptive: 3,
    普通: 3,
    一般: 3,

    "4": 4,
    hard: 4,
    difficult: 4,
    困難: 4,

    "5": 5,
    veryhard: 5,
    expert: 5,
    hardest: 5,
    非常困難: 5,
    最困難: 5,
  };

  return map[normalized] || clamp(fallback, 1, 5);
}

function getDifficultyName(level) {
  const safeLevel = normalizeDifficulty(level);
  return LB_DIFFICULTY_NAMES[safeLevel];
}

function getDifficultyLabel(level) {
  const safeLevel = normalizeDifficulty(level);
  return LB_DIFFICULTY_LABELS[safeLevel];
}

function normalizeRecords(input) {
  if (Array.isArray(input)) return input;

  const candidates = [
    input?.records,
    input?.trialLogs,
    input?.trials,
    input?.history,
    input?.logs,
    input?.raw?.trials,
    input?.raw?.trialLogs,
    input?.raw?.records,
    input?.scoring?.clinicianMetrics?.trialLogs,
    input?.clinicianMetrics?.trialLogs,
    input?.lbResult?.trialLogs,
    input?.result?.trialLogs,
  ];

  return candidates.find(Array.isArray) || [];
}

function isCorrectRecord(record) {
  return (
    record?.isCorrect === true ||
    record?.correct === true ||
    record?.answerCorrect === true ||
    record?.status === "correct" ||
    record?.result === "correct"
  );
}

function isTimeoutRecord(record) {
  return (
    record?.isTimeout === true ||
    record?.timeout === true ||
    record?.status === "timeout" ||
    record?.result === "timeout" ||
    record?.wrongType === "timeout" ||
    record?.errorType === "timeout"
  );
}

function isHintUsed(record) {
  return (
    record?.hintShown === true ||
    record?.usedHint === true ||
    record?.hintUsed === true ||
    safeNumber(record?.hintCount, 0) > 0
  );
}

function getReactionTime(record) {
  return safeNumber(
    record?.reactionTime ??
      record?.rt ??
      record?.responseTime ??
      record?.answerTime ??
      record?.timeSpent,
    0
  );
}

function getRuleName(record) {
  return (
    record?.ruleType ||
    record?.rule ||
    record?.targetRule ||
    record?.activeRule ||
    record?.condition ||
    "unknown"
  );
}

function isSwitchRecord(record, index, records) {
  if (
    record?.isSwitch === true ||
    record?.switchTrial === true ||
    record?.trialType === "switch" ||
    record?.type === "switch" ||
    record?.wrongType === "ruleSwitchError"
  ) {
    return true;
  }

  if (index <= 0) return false;

  const currentRule = getRuleName(record);
  const previousRule = getRuleName(records[index - 1]);

  return (
    currentRule !== "unknown" &&
    previousRule !== "unknown" &&
    currentRule !== previousRule
  );
}

function isInterferenceRecord(record) {
  return (
    record?.hasInterference === true ||
    record?.interference === true ||
    record?.hasDistractor === true ||
    record?.isDistractorTrial === true ||
    record?.taskType === "distractorDoors" ||
    record?.taskType === "mixedMission" ||
    record?.wrongType === "distractorClick"
  );
}

function getMaximumConsecutiveErrors(records) {
  let currentErrors = 0;
  let maximumErrors = 0;

  records.forEach((record) => {
    if (isCorrectRecord(record)) {
      currentErrors = 0;
    } else {
      currentErrors += 1;
      maximumErrors = Math.max(maximumErrors, currentErrors);
    }
  });

  return maximumErrors;
}

function getMaximumConsecutiveCorrect(records) {
  let currentCorrect = 0;
  let maximumCorrect = 0;

  records.forEach((record) => {
    if (isCorrectRecord(record)) {
      currentCorrect += 1;
      maximumCorrect = Math.max(maximumCorrect, currentCorrect);
    } else {
      currentCorrect = 0;
    }
  });

  return maximumCorrect;
}

function getMetricValue(source, keys, fallback = null) {
  for (const key of keys) {
    const value = source?.[key];

    if (value !== undefined && value !== null) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }

  return fallback;
}

function normalizePercent(value, fallback = 0) {
  const number = safeNumber(value, fallback);

  // 相容 0～1 格式。
  if (number >= 0 && number <= 1) {
    return clamp(number * 100, 0, 100);
  }

  return clamp(number, 0, 100);
}

function calculateSpeedScore(
  averageReactionTime,
  correctRTCount,
  options
) {
  if (correctRTCount <= 0 || averageReactionTime <= 0) {
    return 0;
  }

  const ideal = options.idealReactionTime;
  const acceptable = options.acceptableReactionTime;
  const slow = options.slowReactionTime;

  if (averageReactionTime <= ideal) return 100;

  if (averageReactionTime <= acceptable) {
    const progress =
      (averageReactionTime - ideal) /
      Math.max(1, acceptable - ideal);

    return clamp(100 - progress * 25, 0, 100);
  }

  if (averageReactionTime <= slow) {
    const progress =
      (averageReactionTime - acceptable) /
      Math.max(1, slow - acceptable);

    return clamp(75 - progress * 40, 0, 100);
  }

  const progress =
    (averageReactionTime - slow) /
    Math.max(1, options.maximumReactionTime - slow);

  return clamp(35 - progress * 35, 0, 100);
}

function calculateStabilityScore(
  reactionTimeStandardDeviation,
  averageReactionTime,
  correctRTCount
) {
  if (correctRTCount <= 0 || averageReactionTime <= 0) {
    return 0;
  }

  if (correctRTCount === 1) {
    return 55;
  }

  const coefficientOfVariation =
    reactionTimeStandardDeviation / averageReactionTime;

  if (!Number.isFinite(coefficientOfVariation)) return 0;
  if (coefficientOfVariation <= 0.18) return 100;
  if (coefficientOfVariation <= 0.28) return 88;
  if (coefficientOfVariation <= 0.4) return 75;
  if (coefficientOfVariation <= 0.55) return 60;
  if (coefficientOfVariation <= 0.75) return 45;

  return 30;
}

function calculateHintIndependenceScore(hintRate) {
  return clamp(100 - normalizePercent(hintRate), 0, 100);
}

function calculateErrorControlScore({
  maximumConsecutiveErrors,
  timeoutRate,
  wrongRate,
}) {
  let score = 100;

  score -= normalizePercent(timeoutRate) * 0.35;
  score -= normalizePercent(wrongRate) * 0.25;

  if (maximumConsecutiveErrors >= 5) score -= 35;
  else if (maximumConsecutiveErrors === 4) score -= 28;
  else if (maximumConsecutiveErrors === 3) score -= 18;
  else if (maximumConsecutiveErrors === 2) score -= 8;

  return clamp(score, 0, 100);
}

function buildMetricsFromRecords(records, options) {
  const totalTrials = records.length;

  const correctRecords = records.filter(isCorrectRecord);
  const timeoutRecords = records.filter(isTimeoutRecord);
  const wrongRecords = records.filter(
    (record) =>
      !isCorrectRecord(record) &&
      !isTimeoutRecord(record)
  );

  const correctTrials = correctRecords.length;
  const timeoutTrials = timeoutRecords.length;
  const wrongTrials = wrongRecords.length;

  const accuracy =
    totalTrials > 0
      ? (correctTrials / totalTrials) * 100
      : 0;

  const timeoutRate =
    totalTrials > 0
      ? (timeoutTrials / totalTrials) * 100
      : 0;

  const wrongRate =
    totalTrials > 0
      ? (wrongTrials / totalTrials) * 100
      : 0;

  const hintTrials = records.filter(isHintUsed).length;
  const hintRate =
    totalTrials > 0
      ? (hintTrials / totalTrials) * 100
      : 0;

  const correctReactionTimes = correctRecords
    .map(getReactionTime)
    .filter(
      (reactionTime) =>
        reactionTime > 0 &&
        reactionTime <= options.maximumReactionTime
    );

  const allReactionTimes = records
    .map(getReactionTime)
    .filter(
      (reactionTime) =>
        reactionTime > 0 &&
        reactionTime <= options.maximumReactionTime
    );

  const fallbackReactionTime = median(
    allReactionTimes,
    options.acceptableReactionTime
  );

  const averageReactionTime = correctReactionTimes.length
    ? average(correctReactionTimes)
    : fallbackReactionTime;

  const reactionTimeStandardDeviation =
    correctReactionTimes.length > 1
      ? standardDeviation(correctReactionTimes)
      : 0;

  const switchRecords = records.filter((record, index) =>
    isSwitchRecord(record, index, records)
  );

  const switchCorrect = switchRecords.filter(isCorrectRecord).length;

  const switchAccuracy = switchRecords.length
    ? (switchCorrect / switchRecords.length) * 100
    : accuracy;

  const interferenceRecords = records.filter(isInterferenceRecord);
  const interferenceCorrect =
    interferenceRecords.filter(isCorrectRecord).length;

  const interferenceAccuracy = interferenceRecords.length
    ? (interferenceCorrect / interferenceRecords.length) * 100
    : accuracy;

  const maximumConsecutiveErrors =
    getMaximumConsecutiveErrors(records);

  const maximumConsecutiveCorrect =
    getMaximumConsecutiveCorrect(records);

  const speedScore = calculateSpeedScore(
    averageReactionTime,
    correctReactionTimes.length,
    options
  );

  const stabilityScore = calculateStabilityScore(
    reactionTimeStandardDeviation,
    averageReactionTime,
    correctReactionTimes.length
  );

  const hintIndependenceScore =
    calculateHintIndependenceScore(hintRate);

  const errorControlScore = calculateErrorControlScore({
    maximumConsecutiveErrors,
    timeoutRate,
    wrongRate,
  });

  return {
    totalTrials,
    correctTrials,
    wrongTrials,
    timeoutTrials,
    hintTrials,

    accuracy: round(accuracy),
    switchAccuracy: round(switchAccuracy),
    interferenceAccuracy: round(interferenceAccuracy),

    wrongRate: round(wrongRate),
    timeoutRate: round(timeoutRate),
    hintRate: round(hintRate),

    averageReactionTime: Math.round(averageReactionTime),
    reactionTimeStandardDeviation: Math.round(
      reactionTimeStandardDeviation
    ),
    correctRTCount: correctReactionTimes.length,
    correctReactionTimes,

    maximumConsecutiveErrors,
    maximumConsecutiveCorrect,

    speedScore: round(speedScore),
    stabilityScore: round(stabilityScore),
    hintIndependenceScore: round(hintIndependenceScore),
    errorControlScore: round(errorControlScore),
  };
}

function buildMetricsFromSummary(input, options) {
  const source =
    input?.scoring ||
    input?.scoreResult ||
    input?.analysis ||
    input?.result ||
    input ||
    {};

  const parentMetrics =
    source?.parentMetrics ||
    input?.parentMetrics ||
    {};

  const clinicianMetrics =
    source?.clinicianMetrics ||
    input?.clinicianMetrics ||
    {};

  const summary =
    input?.summary ||
    source?.summary ||
    input?.summaryData ||
    {};

  const totalTrials = safeNumber(
    getMetricValue(
      clinicianMetrics,
      ["totalTrials"],
      getMetricValue(
        summary,
        ["totalTrials", "completedTrials"],
        getMetricValue(input, ["totalTrials"], 0)
      )
    ),
    0
  );

  const accuracy = normalizePercent(
    getMetricValue(
      clinicianMetrics,
      ["accuracy"],
      getMetricValue(
        parentMetrics,
        ["ruleUnderstanding"],
        getMetricValue(
          summary,
          ["accuracy"],
          getMetricValue(input, ["accuracy"], 0)
        )
      )
    )
  );

  const switchAccuracy = normalizePercent(
    getMetricValue(
      clinicianMetrics,
      ["switchAccuracy"],
      getMetricValue(
        parentMetrics,
        ["cognitiveFlexibility"],
        accuracy
      )
    )
  );

  const interferenceAccuracy = normalizePercent(
    getMetricValue(
      clinicianMetrics,
      ["interferenceAccuracy", "interferenceRate"],
      getMetricValue(
        parentMetrics,
        ["interferenceControl"],
        accuracy
      )
    )
  );

  const averageReactionTime = safeNumber(
    getMetricValue(
      clinicianMetrics,
      ["avgReactionTime", "averageReactionTime"],
      getMetricValue(
        summary,
        ["averageReactionTime", "avgReactionTime"],
        getMetricValue(
          input,
          ["averageReactionTime", "avgReactionTime"],
          options.acceptableReactionTime
        )
      )
    ),
    options.acceptableReactionTime
  );

  const reactionTimeStandardDeviation = safeNumber(
    getMetricValue(
      clinicianMetrics,
      ["rtStd", "reactionTimeStandardDeviation"],
      getMetricValue(
        input,
        ["reactionTimeStd", "rtStd"],
        0
      )
    ),
    0
  );

  const correctRTCount = safeNumber(
    getMetricValue(
      clinicianMetrics,
      ["correctRtCount", "correctRTCount"],
      accuracy > 0 ? Math.max(1, Math.round(totalTrials * accuracy / 100)) : 0
    ),
    0
  );

  const timeoutTrials = safeNumber(
    getMetricValue(
      clinicianMetrics,
      ["timeoutTrials"],
      getMetricValue(summary, ["timeout"], 0)
    ),
    0
  );

  const wrongTrials = safeNumber(
    getMetricValue(
      clinicianMetrics,
      ["wrongTrials"],
      getMetricValue(summary, ["wrong"], 0)
    ),
    0
  );

  const hintTrials = safeNumber(
    getMetricValue(
      summary,
      ["hintCount", "hintTrials"],
      getMetricValue(input, ["hintCount", "hintTrials"], 0)
    ),
    0
  );

  const timeoutRate =
    totalTrials > 0
      ? (timeoutTrials / totalTrials) * 100
      : 0;

  const wrongRate =
    totalTrials > 0
      ? (wrongTrials / totalTrials) * 100
      : Math.max(0, 100 - accuracy);

  const hintRate =
    totalTrials > 0
      ? (hintTrials / totalTrials) * 100
      : 0;

  const maximumConsecutiveErrors = safeNumber(
    getMetricValue(
      clinicianMetrics,
      ["maxConsecutiveErrors", "maximumConsecutiveErrors"],
      0
    ),
    0
  );

  const speedScore = normalizePercent(
    getMetricValue(
      parentMetrics,
      ["processingSpeed"],
      calculateSpeedScore(
        averageReactionTime,
        correctRTCount,
        options
      )
    )
  );

  const stabilityScore = normalizePercent(
    getMetricValue(
      parentMetrics,
      ["attentionStability"],
      calculateStabilityScore(
        reactionTimeStandardDeviation,
        averageReactionTime,
        correctRTCount
      )
    )
  );

  return {
    totalTrials,
    correctTrials: Math.round(totalTrials * accuracy / 100),
    wrongTrials,
    timeoutTrials,
    hintTrials,

    accuracy: round(accuracy),
    switchAccuracy: round(switchAccuracy),
    interferenceAccuracy: round(interferenceAccuracy),

    wrongRate: round(wrongRate),
    timeoutRate: round(timeoutRate),
    hintRate: round(hintRate),

    averageReactionTime: Math.round(averageReactionTime),
    reactionTimeStandardDeviation: Math.round(
      reactionTimeStandardDeviation
    ),
    correctRTCount,

    maximumConsecutiveErrors,
    maximumConsecutiveCorrect: 0,

    speedScore: round(speedScore),
    stabilityScore: round(stabilityScore),
    hintIndependenceScore: round(
      calculateHintIndependenceScore(hintRate)
    ),
    errorControlScore: round(
      calculateErrorControlScore({
        maximumConsecutiveErrors,
        timeoutRate,
        wrongRate,
      })
    ),
  };
}

function calculateOverallScore(metrics) {
  // 與 LB 評分方向一致：
  // 規則理解、規則切換為主要能力；
  // 速度、穩定度、抗干擾與提示獨立性為輔助。
  const score =
    metrics.accuracy * 0.3 +
    metrics.switchAccuracy * 0.22 +
    metrics.interferenceAccuracy * 0.13 +
    metrics.speedScore * 0.1 +
    metrics.stabilityScore * 0.1 +
    metrics.hintIndependenceScore * 0.08 +
    metrics.errorControlScore * 0.07;

  return round(clamp(score, 0, 100));
}

function determineAdjustment(metrics, overallScore, options) {
  const insufficientData =
    metrics.totalTrials < options.minimumTrialsForIncrease;

  const severeDifficulty =
    metrics.accuracy < 35 ||
    metrics.switchAccuracy < 30 ||
    metrics.timeoutRate >= 45 ||
    metrics.maximumConsecutiveErrors >= 5;

  const needsSupport =
    metrics.accuracy < 58 ||
    metrics.switchAccuracy < 52 ||
    metrics.timeoutRate >= 30 ||
    metrics.hintRate >= 55 ||
    metrics.maximumConsecutiveErrors >= 3;

  const excellentPerformance =
    metrics.accuracy >= 92 &&
    metrics.switchAccuracy >= 85 &&
    metrics.timeoutRate <= 5 &&
    metrics.hintRate <= 10 &&
    metrics.maximumConsecutiveErrors <= 1;

  const readyToIncrease =
    metrics.accuracy >= 82 &&
    metrics.switchAccuracy >= 72 &&
    metrics.timeoutRate <= 15 &&
    metrics.hintRate <= 30 &&
    metrics.maximumConsecutiveErrors <= 2;

  if (
    severeDifficulty ||
    overallScore < options.strongDecreaseScoreThreshold
  ) {
    return {
      adjustment: -1,
      decision: "decrease",
      reasonCode: "performance_far_below_target",
      reason: "目前規則理解或作答穩定度較不足，下一次降低難度並增加提示。",
    };
  }

  if (
    needsSupport ||
    overallScore < options.decreaseScoreThreshold
  ) {
    return {
      adjustment: -1,
      decision: "decrease",
      reasonCode: "needs_more_support",
      reason: "目前仍需要較多提示或出現連續錯誤，下一次稍微降低難度。",
    };
  }

  if (
    !insufficientData &&
    excellentPerformance &&
    overallScore >= options.strongIncreaseScoreThreshold
  ) {
    return {
      adjustment: 1,
      decision: "increase",
      reasonCode: "excellent_performance",
      reason: "正確率、規則切換與作答穩定度都很好，下一次提高難度。",
    };
  }

  if (
    !insufficientData &&
    readyToIncrease &&
    overallScore >= options.increaseScoreThreshold
  ) {
    return {
      adjustment: 1,
      decision: "increase",
      reasonCode: "ready_for_next_difficulty",
      reason: "目前表現已達穩定標準，下一次可稍微提高難度。",
    };
  }

  return {
    adjustment: 0,
    decision: "maintain",
    reasonCode: insufficientData
      ? "insufficient_trials"
      : "appropriate_difficulty",
    reason: insufficientData
      ? "目前有效資料較少，先維持難度繼續觀察。"
      : "目前難度適合，下一次維持相同難度。",
  };
}

function buildTrainingConfig(difficulty, metrics = {}) {
  const level = normalizeDifficulty(difficulty);

  const configs = {
    1: {
      difficultyLevel: 1,
      difficulty: "veryEasy",
      difficultyLabel: "非常簡單",

      maxNumber: 5,
      sequenceLength: 5,
      colorRuleMaxNumber: 3,

      enableBackwardRule: false,
      enableColorSwitchRule: false,
      enableMixedMission: false,
      enableMemoryTask: false,
      enablePositionShuffle: false,

      hintMode: "always",
      hintDelayMs: 1800,
      hintAfterWrong: 1,
      previewMs: 4500,

      feedbackDelayCorrectMs: 600,
      feedbackDelayWrongMs: 900,

      maximumWrongBeforeHint: 1,
      maximumConsecutiveErrors: 5,

      recommendedTaskTypes: [
        "guidePath",
        "findSequence",
      ],
    },

    2: {
      difficultyLevel: 2,
      difficulty: "easy",
      difficultyLabel: "簡單",

      maxNumber: 7,
      sequenceLength: 7,
      colorRuleMaxNumber: 3,

      enableBackwardRule: true,
      enableColorSwitchRule: false,
      enableMixedMission: false,
      enableMemoryTask: true,
      enablePositionShuffle: false,

      hintMode: "delay",
      hintDelayMs: 2800,
      hintAfterWrong: 1,
      previewMs: 3800,

      feedbackDelayCorrectMs: 520,
      feedbackDelayWrongMs: 800,

      maximumWrongBeforeHint: 1,
      maximumConsecutiveErrors: 5,

      recommendedTaskTypes: [
        "guidePath",
        "findSequence",
        "memoryPath",
      ],
    },

    3: {
      difficultyLevel: 3,
      difficulty: "normal",
      difficultyLabel: "普通",

      maxNumber: 10,
      sequenceLength: 10,
      colorRuleMaxNumber: 5,

      enableBackwardRule: true,
      enableColorSwitchRule: true,
      enableMixedMission: false,
      enableMemoryTask: true,
      enablePositionShuffle: false,

      hintMode: "afterWrong",
      hintDelayMs: 3400,
      hintAfterWrong: 2,
      previewMs: 3000,

      feedbackDelayCorrectMs: 440,
      feedbackDelayWrongMs: 700,

      maximumWrongBeforeHint: 2,
      maximumConsecutiveErrors: 4,

      recommendedTaskTypes: [
        "findSequence",
        "memoryPath",
        "ruleSwitch",
      ],
    },

    4: {
      difficultyLevel: 4,
      difficulty: "hard",
      difficultyLabel: "困難",

      maxNumber: 10,
      sequenceLength: 12,
      colorRuleMaxNumber: 6,

      enableBackwardRule: true,
      enableColorSwitchRule: true,
      enableMixedMission: true,
      enableMemoryTask: true,
      enablePositionShuffle: true,

      hintMode: "afterWrong",
      hintDelayMs: 4200,
      hintAfterWrong: 3,
      previewMs: 2400,

      feedbackDelayCorrectMs: 380,
      feedbackDelayWrongMs: 620,

      maximumWrongBeforeHint: 3,
      maximumConsecutiveErrors: 4,

      recommendedTaskTypes: [
        "memoryPath",
        "ruleSwitch",
        "mixedMission",
      ],
    },

    5: {
      difficultyLevel: 5,
      difficulty: "veryHard",
      difficultyLabel: "非常困難",

      maxNumber: 10,
      sequenceLength: 20,
      colorRuleMaxNumber: 10,

      enableBackwardRule: true,
      enableColorSwitchRule: true,
      enableMixedMission: true,
      enableMemoryTask: true,
      enablePositionShuffle: true,

      hintMode: "afterWrong",
      hintDelayMs: 5000,
      hintAfterWrong: 3,
      previewMs: 1800,

      feedbackDelayCorrectMs: 320,
      feedbackDelayWrongMs: 560,

      maximumWrongBeforeHint: 3,
      maximumConsecutiveErrors: 3,

      recommendedTaskTypes: [
        "ruleSwitch",
        "mixedMission",
      ],
    },
  };

  const selected = {
    ...configs[level],
  };

  // 即使整體難度不變，也可針對弱項給局部協助。
  if (safeNumber(metrics.switchAccuracy, 100) < 55) {
    selected.hintAfterWrong = Math.min(
      selected.hintAfterWrong,
      2
    );

    selected.enablePositionShuffle = false;
  }

  if (safeNumber(metrics.stabilityScore, 100) < 50) {
    selected.hintDelayMs = Math.max(
      1800,
      selected.hintDelayMs - 700
    );
  }

  if (safeNumber(metrics.timeoutRate, 0) >= 30) {
    selected.previewMs += 700;
    selected.hintDelayMs = Math.max(
      1800,
      selected.hintDelayMs - 500
    );
  }

  if (safeNumber(metrics.hintRate, 0) >= 50) {
    selected.hintAfterWrong = Math.min(
      selected.hintAfterWrong,
      1
    );
  }

  return selected;
}

function getRecommendedLevelRange(difficulty) {
  const level = normalizeDifficulty(difficulty);

  const ranges = {
    1: {
      minimumLevelIndex: 0,
      maximumLevelIndex: 1,
      suggestedLevelIds: ["1-1", "1-2"],
    },
    2: {
      minimumLevelIndex: 1,
      maximumLevelIndex: 4,
      suggestedLevelIds: ["1-2", "1-3", "1-4", "2-1"],
    },
    3: {
      minimumLevelIndex: 3,
      maximumLevelIndex: 7,
      suggestedLevelIds: ["1-4", "2-1", "2-2", "2-3", "3-1"],
    },
    4: {
      minimumLevelIndex: 6,
      maximumLevelIndex: 9,
      suggestedLevelIds: ["2-3", "3-1", "3-2", "3-3"],
    },
    5: {
      minimumLevelIndex: 8,
      maximumLevelIndex: 11,
      suggestedLevelIds: ["3-2", "3-3", "4-1", "4-2"],
    },
  };

  return ranges[level];
}

function resolveNextLevelIndex({
  currentLevelIndex,
  adjustment,
  nextDifficulty,
  completed = true,
  maximumLevelIndex = 11,
}) {
  const currentIndex = clamp(
    safeNumber(currentLevelIndex, 0),
    0,
    maximumLevelIndex
  );

  const difficultyRange =
    getRecommendedLevelRange(nextDifficulty);

  let nextIndex = currentIndex;

  if (!completed || adjustment < 0) {
    // 表現較弱時不強制退關，只維持目前關卡，
    // 由較低難度設定提供更多提示。
    nextIndex = currentIndex;
  } else if (adjustment > 0) {
    nextIndex = currentIndex + 1;
  } else {
    nextIndex = currentIndex + 1;
  }

  return clamp(
    nextIndex,
    difficultyRange.minimumLevelIndex,
    Math.min(
      maximumLevelIndex,
      difficultyRange.maximumLevelIndex
    )
  );
}

function buildSupportSuggestions(metrics) {
  const suggestions = [];

  if (metrics.accuracy < 60) {
    suggestions.push("先練習較短的數字順序");
  }

  if (metrics.switchAccuracy < 60) {
    suggestions.push("增加紅藍規則提示");
  }

  if (metrics.interferenceAccuracy < 60) {
    suggestions.push("暫時關閉門牌換位或混合任務");
  }

  if (metrics.speedScore < 50) {
    suggestions.push("延長觀察與提示時間");
  }

  if (metrics.stabilityScore < 50) {
    suggestions.push("減少單次任務長度");
  }

  if (metrics.hintRate >= 50) {
    suggestions.push("保留即時目標提示");
  }

  if (metrics.maximumConsecutiveErrors >= 3) {
    suggestions.push("錯誤後立即示範正確下一步");
  }

  if (!suggestions.length) {
    suggestions.push("維持目前訓練方式");
  }

  return suggestions;
}

function getStoredPayload(storage, keys) {
  for (const key of keys) {
    const parsed = safeParse(
      safeGetStorage(storage, key),
      null
    );

    if (parsed && typeof parsed === "object") {
      return {
        key,
        value: parsed,
      };
    }
  }

  return null;
}

function getCurrentChildId() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("currentChildId") ||
    localStorage.getItem("selectedChildId") ||
    safeParse(localStorage.getItem("currentChild"), {})?.id ||
    safeParse(localStorage.getItem("selectedChild"), {})?.id ||
    null
  );
}

function getChildSpecificTestResult(childId) {
  if (
    typeof window === "undefined" ||
    !childId
  ) {
    return null;
  }

  const keys = [
    `lbTestResult_${childId}`,
    `LBTestResult_${childId}`,
    `latestLBTestResult_${childId}`,
    `ef_game_lb_test_result_${childId}`,
  ];

  return getStoredPayload(localStorage, keys);
}

export function getLatestLBTestResult() {
  if (typeof window === "undefined") return null;

  const childId = getCurrentChildId();
  const childSpecificResult =
    getChildSpecificTestResult(childId);

  if (childSpecificResult) {
    return childSpecificResult.value;
  }

  const localResult = getStoredPayload(
    localStorage,
    TEST_RESULT_KEYS
  );

  if (localResult) return localResult.value;

  const sessionResult = getStoredPayload(
    sessionStorage,
    TEST_RESULT_KEYS
  );

  return sessionResult?.value || null;
}

export function getLatestLBTrainingResult() {
  if (typeof window === "undefined") return null;

  const localResult = getStoredPayload(
    localStorage,
    TRAINING_RESULT_KEYS
  );

  if (localResult) return localResult.value;

  const sessionResult = getStoredPayload(
    sessionStorage,
    TRAINING_RESULT_KEYS
  );

  return sessionResult?.value || null;
}

export function getLBTrainingHistory() {
  if (typeof window === "undefined") return [];

  const storedHistory = safeParse(
    localStorage.getItem(TRAINING_HISTORY_KEY),
    []
  );

  if (Array.isArray(storedHistory)) {
    return storedHistory.filter(isPlainObject);
  }

  return [];
}

export function getLBAdaptiveState() {
  if (typeof window === "undefined") return null;

  const state = safeParse(
    localStorage.getItem(ADAPTIVE_STATE_KEY),
    null
  );

  return isPlainObject(state) ? state : null;
}

function calculateInitialDifficultyFromMetrics(
  metrics,
  score = null
) {
  const finalScore = Number.isFinite(Number(score))
    ? normalizePercent(score)
    : calculateOverallScore(metrics);

  if (
    finalScore >= 88 &&
    metrics.accuracy >= 88 &&
    metrics.switchAccuracy >= 80
  ) {
    return 5;
  }

  if (
    finalScore >= 76 &&
    metrics.accuracy >= 78 &&
    metrics.switchAccuracy >= 68
  ) {
    return 4;
  }

  if (
    finalScore >= 58 &&
    metrics.accuracy >= 58
  ) {
    return 3;
  }

  if (
    finalScore >= 38 &&
    metrics.accuracy >= 38
  ) {
    return 2;
  }

  return 1;
}

export function getLBInitialTrainingConfig(userOptions = {}) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
  };

  const adaptiveState = getLBAdaptiveState();
  const trainingHistory = getLBTrainingHistory();
  const latestTrainingResult = getLatestLBTrainingResult();
  const latestTestResult = getLatestLBTestResult();

  let source = "default";
  let sourceResult = null;
  let metrics = null;
  let difficulty = options.defaultDifficulty;

  // 優先順序：
  // 1. 已儲存的自適應狀態
  // 2. 過往訓練歷史
  // 3. 最新訓練結果
  // 4. 測驗結果
  if (
    adaptiveState &&
    adaptiveState.nextDifficultyLevel
  ) {
    difficulty = normalizeDifficulty(
      adaptiveState.nextDifficultyLevel,
      options.defaultDifficulty
    );

    metrics = adaptiveState.metrics || null;
    source = "adaptiveState";
    sourceResult = adaptiveState;
  } else if (trainingHistory.length > 0) {
    const latestHistory =
      trainingHistory[trainingHistory.length - 1];

    difficulty = normalizeDifficulty(
      latestHistory.nextDifficultyLevel ??
        latestHistory.difficultyLevel,
      options.defaultDifficulty
    );

    metrics = latestHistory.metrics || null;
    source = "trainingHistory";
    sourceResult = latestHistory;
  } else if (latestTrainingResult) {
    const records = normalizeRecords(latestTrainingResult);

    metrics = records.length
      ? buildMetricsFromRecords(records, options)
      : buildMetricsFromSummary(
          latestTrainingResult,
          options
        );

    difficulty = calculateInitialDifficultyFromMetrics(
      metrics,
      latestTrainingResult?.finalScore ??
        latestTrainingResult?.score ??
        latestTrainingResult?.scoring?.finalScore
    );

    source = "trainingResult";
    sourceResult = latestTrainingResult;
  } else if (latestTestResult) {
    const records = normalizeRecords(latestTestResult);

    metrics = records.length
      ? buildMetricsFromRecords(records, options)
      : buildMetricsFromSummary(
          latestTestResult,
          options
        );

    difficulty = calculateInitialDifficultyFromMetrics(
      metrics,
      latestTestResult?.finalScore ??
        latestTestResult?.score ??
        latestTestResult?.scoring?.finalScore
    );

    source = "testResult";
    sourceResult = latestTestResult;
  }

  difficulty = clamp(
    difficulty,
    options.minimumDifficulty,
    options.maximumDifficulty
  );

  const trainingConfig = buildTrainingConfig(
    difficulty,
    metrics || {}
  );

  const recommendedLevelRange =
    getRecommendedLevelRange(difficulty);

  return {
    gameId: GAME_ID,
    mode: "training",

    source,
    sourceResult,

    difficultyLevel: difficulty,
    difficulty: getDifficultyName(difficulty),
    difficultyLabel: getDifficultyLabel(difficulty),

    metrics,
    trainingConfig,
    recommendedLevelRange,

    recommendedLevelIndex:
      recommendedLevelRange.minimumLevelIndex,

    createdAt: new Date().toISOString(),
  };
}

export function analyzeLBTraining(input = {}, userOptions = {}) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
  };

  const records = normalizeRecords(input);

  const metrics = records.length
    ? buildMetricsFromRecords(records, options)
    : buildMetricsFromSummary(input, options);

  const overallScore = calculateOverallScore(metrics);

  const currentDifficulty = clamp(
    normalizeDifficulty(
      input?.currentDifficulty ??
        input?.difficultyLevel ??
        input?.difficulty ??
        input?.currentConfig?.difficultyLevel ??
        input?.currentConfig?.difficulty,
      options.defaultDifficulty
    ),
    options.minimumDifficulty,
    options.maximumDifficulty
  );

  const adjustmentResult = determineAdjustment(
    metrics,
    overallScore,
    options
  );

  const safeAdjustment = clamp(
    adjustmentResult.adjustment,
    -options.maximumStepChange,
    options.maximumStepChange
  );

  const nextDifficulty = clamp(
    currentDifficulty + safeAdjustment,
    options.minimumDifficulty,
    options.maximumDifficulty
  );

  const completed =
    input?.completed !== false &&
    input?.reason !== "manual" &&
    input?.finishReason !== "manual";

  const currentLevelIndex = safeNumber(
    input?.currentLevelIndex ??
      input?.levelIndex ??
      input?.currentLevel ??
      input?.trainingLevel,
    0
  );

  const maximumLevelIndex = safeNumber(
    input?.maximumLevelIndex ??
      input?.maxLevelIndex,
    11
  );

  const nextLevelIndex = resolveNextLevelIndex({
    currentLevelIndex,
    adjustment: safeAdjustment,
    nextDifficulty,
    completed,
    maximumLevelIndex,
  });

  const nextTrainingConfig = buildTrainingConfig(
    nextDifficulty,
    metrics
  );

  const recommendedLevelRange =
    getRecommendedLevelRange(nextDifficulty);

  const result = {
    gameId: GAME_ID,
    mode: "training",
    analyzerVersion: "1.0.0",

    analyzedAt: new Date().toISOString(),

    completed,
    totalTrials: metrics.totalTrials,

    currentDifficultyLevel: currentDifficulty,
    currentDifficulty: getDifficultyName(currentDifficulty),
    currentDifficultyLabel:
      getDifficultyLabel(currentDifficulty),

    adjustment: safeAdjustment,
    decision: adjustmentResult.decision,
    reasonCode: adjustmentResult.reasonCode,
    reason: adjustmentResult.reason,

    nextDifficultyLevel: nextDifficulty,
    nextDifficulty: getDifficultyName(nextDifficulty),
    nextDifficultyLabel: getDifficultyLabel(nextDifficulty),

    currentLevelIndex,
    nextLevelIndex,

    overallScore,
    metrics,

    nextTrainingConfig,
    recommendedLevelRange,
    suggestedLevelIds:
      recommendedLevelRange.suggestedLevelIds,

    supportSuggestions:
      buildSupportSuggestions(metrics),

    records,
  };

  return result;
}

export function saveLBAdaptiveState(
  analysis,
  userOptions = {}
) {
  if (
    typeof window === "undefined" ||
    !analysis ||
    typeof analysis !== "object"
  ) {
    return false;
  }

  const options = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
  };

  const normalizedAnalysis = {
    ...analysis,
    gameId: GAME_ID,
    updatedAt: new Date().toISOString(),
  };

  safeSetStorage(
    localStorage,
    ADAPTIVE_STATE_KEY,
    JSON.stringify(normalizedAnalysis)
  );

  const history = getLBTrainingHistory();

  const historyItem = {
    analyzedAt:
      normalizedAnalysis.analyzedAt ||
      new Date().toISOString(),

    currentDifficultyLevel:
      normalizedAnalysis.currentDifficultyLevel,

    nextDifficultyLevel:
      normalizedAnalysis.nextDifficultyLevel,

    currentLevelIndex:
      normalizedAnalysis.currentLevelIndex,

    nextLevelIndex:
      normalizedAnalysis.nextLevelIndex,

    adjustment:
      normalizedAnalysis.adjustment,

    decision:
      normalizedAnalysis.decision,

    reasonCode:
      normalizedAnalysis.reasonCode,

    overallScore:
      normalizedAnalysis.overallScore,

    metrics:
      normalizedAnalysis.metrics,
  };

  const nextHistory = [
    ...history,
    historyItem,
  ].slice(-options.maximumHistoryLength);

  safeSetStorage(
    localStorage,
    TRAINING_HISTORY_KEY,
    JSON.stringify(nextHistory)
  );

  return true;
}

export function analyzeAndSaveLBTraining(
  input = {},
  userOptions = {}
) {
  const analysis = analyzeLBTraining(
    input,
    userOptions
  );

  saveLBAdaptiveState(
    analysis,
    userOptions
  );

  return analysis;
}

export function resetLBAdaptiveState() {
  if (typeof window === "undefined") return false;

  try {
    localStorage.removeItem(ADAPTIVE_STATE_KEY);
    localStorage.removeItem(TRAINING_HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}

export function getLBDifficultyConfig(
  difficulty,
  metrics = {}
) {
  return buildTrainingConfig(
    difficulty,
    metrics
  );
}

export function getLBRecommendedLevelRange(
  difficulty
) {
  return getRecommendedLevelRange(difficulty);
}

export default analyzeLBTraining;