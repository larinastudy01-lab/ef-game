// src/utils/dccsScoring.js

/**
 * DCCS 評分模組
 * Dimensional Change Card Sort
 *
 * 支援：
 * 1. 正式測驗模式
 * 2. 十階訓練模式
 * 3. TestPage_DCCS / TrainingPage_DCCS 不同欄位格式
 * 4. 顏色規則、種類規則、切換後表現、干擾抑制
 * 5. 固著錯誤、第一次答對率、反應時間與穩定度
 * 6. 兒童端、家長端、醫療端結果
 * 7. NaN、零除、題數不足、無效 RT 與缺失欄位防護
 */

const DEFAULT_STABILITY_SCORE = 55;
const DEFAULT_MISSING_RT_SCORE = 55;

const DCCS_DIFFICULTY_ORDER = [
  "colorIntro",
  "colorStable",
  "typeIntro",
  "typeStable",
  "switchClear",
  "switchEarly",
  "switchMaintain",
  "lowInterference",
  "highInterference",
  "testLike",
];

const DCCS_LEVEL_SCORING = {
  colorIntro: {
    level: 1,
    label: "第 1 階",
    title: "看顏色",
    category: "singleRule",
    abilityFocus: "colorRule",
    starRule: "singleRule",
    minimumTrials: 3,
    weights: {
      colorAccuracy: 0.7,
      firstTryAccuracy: 0.2,
      responseStability: 0.1,
    },
  },

  colorStable: {
    level: 2,
    label: "第 2 階",
    title: "顏色穩定",
    category: "singleRule",
    abilityFocus: "colorRule",
    starRule: "singleRule",
    minimumTrials: 4,
    weights: {
      colorAccuracy: 0.65,
      firstTryAccuracy: 0.25,
      responseStability: 0.1,
    },
  },

  typeIntro: {
    level: 3,
    label: "第 3 階",
    title: "看衣服",
    category: "singleRule",
    abilityFocus: "typeRule",
    starRule: "singleRule",
    minimumTrials: 3,
    weights: {
      typeAccuracy: 0.7,
      firstTryAccuracy: 0.2,
      responseStability: 0.1,
    },
  },

  typeStable: {
    level: 4,
    label: "第 4 階",
    title: "衣服穩定",
    category: "singleRule",
    abilityFocus: "typeRule",
    starRule: "singleRule",
    minimumTrials: 4,
    weights: {
      typeAccuracy: 0.65,
      firstTryAccuracy: 0.25,
      responseStability: 0.1,
    },
  },

  switchClear: {
    level: 5,
    label: "第 5 階",
    title: "明確換規則",
    category: "switch",
    abilityFocus: "ruleSwitch",
    starRule: "clearSwitch",
    minimumTrials: 4,
    weights: {
      postSwitchAccuracy: 0.45,
      accuracy: 0.25,
      firstTryAccuracy: 0.2,
      responseStability: 0.1,
    },
  },

  switchEarly: {
    level: 6,
    label: "第 6 階",
    title: "提前換規則",
    category: "switch",
    abilityFocus: "ruleSwitch",
    starRule: "clearSwitch",
    minimumTrials: 4,
    weights: {
      postSwitchAccuracy: 0.5,
      accuracy: 0.2,
      firstTryAccuracy: 0.2,
      responseStability: 0.1,
    },
  },

  switchMaintain: {
    level: 7,
    label: "第 7 階",
    title: "切換後維持",
    category: "switch",
    abilityFocus: "ruleMaintain",
    starRule: "switchMaintain",
    minimumTrials: 5,
    weights: {
      postSwitchAccuracy: 0.4,
      interferenceControl: 0.2,
      firstTryAccuracy: 0.15,
      accuracy: 0.15,
      responseStability: 0.1,
    },
  },

  lowInterference: {
    level: 8,
    label: "第 8 階",
    title: "少量干擾",
    category: "interference",
    abilityFocus: "inhibition",
    starRule: "interference",
    minimumTrials: 5,
    weights: {
      interferenceControl: 0.3,
      interferenceAccuracy: 0.2,
      postSwitchAccuracy: 0.25,
      accuracy: 0.15,
      responseStability: 0.1,
    },
  },

  highInterference: {
    level: 9,
    label: "第 9 階",
    title: "高干擾",
    category: "interference",
    abilityFocus: "inhibition",
    starRule: "interference",
    minimumTrials: 5,
    weights: {
      interferenceControl: 0.35,
      interferenceAccuracy: 0.2,
      postSwitchAccuracy: 0.25,
      accuracy: 0.1,
      responseStability: 0.1,
    },
  },

  testLike: {
    level: 10,
    label: "第 10 階",
    title: "接近測驗",
    category: "testLike",
    abilityFocus: "testReadiness",
    starRule: "testLike",
    minimumTrials: 6,
    weights: {
      postSwitchAccuracy: 0.35,
      accuracy: 0.25,
      interferenceControl: 0.15,
      interferenceAccuracy: 0.1,
      firstTryAccuracy: 0.1,
      responseStability: 0.05,
    },
  },
};

/* -------------------------------------------------------------------------- */
/* 基礎工具                                                                    */
/* -------------------------------------------------------------------------- */

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function safeNumber(value, fallback = 0) {
  return isFiniteNumber(value) ? value : fallback;
}

function safeInteger(value, fallback = 0) {
  return isFiniteNumber(value)
    ? Math.max(0, Math.round(value))
    : fallback;
}

function clamp(value, min = 0, max = 100) {
  if (!isFiniteNumber(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function safeDivide(numerator, denominator, fallback = 0) {
  const safeNumerator = safeNumber(numerator, 0);
  const safeDenominator = safeNumber(denominator, 0);

  if (safeDenominator <= 0) return fallback;

  const result = safeNumerator / safeDenominator;

  return Number.isFinite(result) ? result : fallback;
}

function normalizeRatio(value, fallback = 0) {
  if (!isFiniteNumber(value)) return fallback;

  if (value > 1) {
    return clamp(value, 0, 100) / 100;
  }

  return clamp(value, 0, 1);
}

function toPercent(value) {
  return Math.round(normalizeRatio(value) * 100);
}

function round(value, digits = 0) {
  if (!isFiniteNumber(value)) return 0;

  const multiplier = Math.pow(10, digits);

  return Math.round(value * multiplier) / multiplier;
}

function average(values = []) {
  const validValues = Array.isArray(values)
    ? values.filter(
        (value) => isFiniteNumber(value) && value > 0
      )
    : [];

  if (validValues.length === 0) return 0;

  return Math.round(
    validValues.reduce((sum, value) => sum + value, 0) /
      validValues.length
  );
}

function standardDeviation(values = []) {
  const validValues = Array.isArray(values)
    ? values.filter(
        (value) => isFiniteNumber(value) && value > 0
      )
    : [];

  if (validValues.length <= 1) return 0;

  const mean =
    validValues.reduce((sum, value) => sum + value, 0) /
    validValues.length;

  const variance =
    validValues.reduce(
      (sum, value) => sum + Math.pow(value - mean, 2),
      0
    ) / validValues.length;

  return Math.round(Math.sqrt(variance));
}

function filterValidReactionTimes(values = []) {
  if (!Array.isArray(values)) return [];

  return values.filter(
    (value) => isFiniteNumber(value) && value > 0
  );
}

function getCoefficientOfVariation(values = []) {
  const validValues = filterValidReactionTimes(values);

  if (validValues.length <= 1) {
    return {
      value: 0,
      validCount: validValues.length,
      reliable: false,
    };
  }

  const mean = average(validValues);
  const sd = standardDeviation(validValues);

  if (mean <= 0) {
    return {
      value: 0,
      validCount: validValues.length,
      reliable: false,
    };
  }

  const value = sd / mean;

  return {
    value: Number.isFinite(value) ? value : 0,
    validCount: validValues.length,
    reliable: Number.isFinite(value),
  };
}

/* -------------------------------------------------------------------------- */
/* 難度                                                                        */
/* -------------------------------------------------------------------------- */

function normalizeDifficulty(difficulty) {
  if (isFiniteNumber(difficulty)) {
    const index = clamp(
      Math.round(difficulty) - 1,
      0,
      DCCS_DIFFICULTY_ORDER.length - 1
    );

    return DCCS_DIFFICULTY_ORDER[index];
  }

  const key =
    typeof difficulty === "string"
      ? difficulty.trim()
      : "";

  const map = {
    easy: "colorIntro",
    normal: "switchClear",
    medium: "switchClear",
    hard: "highInterference",

    easyIntro: "colorIntro",
    easyPlus: "colorStable",
    switchIntro: "switchClear",
    switchPlus: "switchMaintain",
    interference: "highInterference",

    colorIntro: "colorIntro",
    colorStable: "colorStable",
    typeIntro: "typeIntro",
    typeStable: "typeStable",
    switchClear: "switchClear",
    switchEarly: "switchEarly",
    switchMaintain: "switchMaintain",
    lowInterference: "lowInterference",
    highInterference: "highInterference",
    testLike: "testLike",

    color_intro: "colorIntro",
    color_stable: "colorStable",
    type_intro: "typeIntro",
    type_stable: "typeStable",
    switch_clear: "switchClear",
    switch_early: "switchEarly",
    switch_maintain: "switchMaintain",
    low_interference: "lowInterference",
    high_interference: "highInterference",
    test_like: "testLike",

    level1: "colorIntro",
    level2: "colorStable",
    level3: "typeIntro",
    level4: "typeStable",
    level5: "switchClear",
    level6: "switchEarly",
    level7: "switchMaintain",
    level8: "lowInterference",
    level9: "highInterference",
    level10: "testLike",
  };

  return map[key] || "switchClear";
}

function getDifficultyConfig(difficulty) {
  const normalizedDifficulty =
    normalizeDifficulty(difficulty);

  return {
    difficulty: normalizedDifficulty,
    config:
      DCCS_LEVEL_SCORING[normalizedDifficulty] ||
      DCCS_LEVEL_SCORING.switchClear,
  };
}

/* -------------------------------------------------------------------------- */
/* Trial 欄位相容處理                                                          */
/* -------------------------------------------------------------------------- */

function normalizeRuleName(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "color" ||
    normalized === "colour" ||
    normalized === "顏色"
  ) {
    return "color";
  }

  if (
    normalized === "type" ||
    normalized === "shape" ||
    normalized === "clothes" ||
    normalized === "category" ||
    normalized === "種類" ||
    normalized === "衣服" ||
    normalized === "服飾"
  ) {
    return "type";
  }

  return null;
}

function getTrialRule(trial = {}) {
  const directRule =
    normalizeRuleName(trial.rule) ||
    normalizeRuleName(trial.currentRule) ||
    normalizeRuleName(trial.sortRule) ||
    normalizeRuleName(trial.targetRule) ||
    normalizeRuleName(trial.ruleType);

  if (directRule) return directRule;

  const phase = String(trial.phase || "").toLowerCase();

  if (
    phase === "color" ||
    phase.includes("color_rule") ||
    phase.includes("color_test") ||
    phase.includes("color_training")
  ) {
    return "color";
  }

  if (
    phase === "type" ||
    phase === "shape" ||
    phase.includes("type_rule") ||
    phase.includes("shape_rule") ||
    phase.includes("type_test") ||
    phase.includes("shape_test") ||
    phase.includes("type_training")
  ) {
    return "type";
  }

  return null;
}

function getCorrectValue(trial = {}) {
  if (typeof trial.isCorrect === "boolean") {
    return trial.isCorrect;
  }

  if (typeof trial.correct === "boolean") {
    return trial.correct;
  }

  if (typeof trial.wasCorrect === "boolean") {
    return trial.wasCorrect;
  }

  if (typeof trial.success === "boolean") {
    return trial.success;
  }

  if (typeof trial.result === "string") {
    const normalized = trial.result.trim().toLowerCase();

    if (
      normalized === "correct" ||
      normalized === "success" ||
      normalized === "passed"
    ) {
      return true;
    }

    if (
      normalized === "wrong" ||
      normalized === "incorrect" ||
      normalized === "timeout" ||
      normalized === "failed"
    ) {
      return false;
    }
  }

  return false;
}

function isTimeoutTrial(trial = {}) {
  return Boolean(
    trial.isTimeout === true ||
      trial.timeout === true ||
      trial.timedOut === true ||
      trial.result === "timeout" ||
      trial.errorType === "timeout"
  );
}

function getReactionTime(trial = {}) {
  const candidates = [
    trial.reactionTime,
    trial.responseTime,
    trial.rt,
    trial.responseTimeMs,
    trial.reactionTimeMs,
    trial.elapsedTime,
  ];

  for (const candidate of candidates) {
    if (isFiniteNumber(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return 0;
}

function normalizeSide(value) {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim().toLowerCase();

  if (
    normalized === "left" ||
    normalized === "l" ||
    normalized === "0" ||
    normalized === "左"
  ) {
    return "left";
  }

  if (
    normalized === "right" ||
    normalized === "r" ||
    normalized === "1" ||
    normalized === "右"
  ) {
    return "right";
  }

  if (
    normalized === "top" ||
    normalized === "up" ||
    normalized === "上"
  ) {
    return "top";
  }

  if (
    normalized === "bottom" ||
    normalized === "down" ||
    normalized === "下"
  ) {
    return "bottom";
  }

  return normalized || null;
}

function getCorrectSide(trial = {}) {
  return normalizeSide(
    trial.correctSide ??
      trial.correctPosition ??
      trial.targetSide ??
      trial.answerSide ??
      trial.correctBasket ??
      trial.correctAnswer
  );
}

function getOldRuleSide(trial = {}) {
  return normalizeSide(
    trial.oldRuleSide ??
      trial.oldRulePosition ??
      trial.previousRuleSide ??
      trial.previousCorrectSide ??
      trial.colorRuleSide ??
      trial.oldAnswerSide
  );
}

function getSelectedSide(trial = {}) {
  return normalizeSide(
    trial.selectedSide ??
      trial.selectedPosition ??
      trial.userAnswerSide ??
      trial.answer ??
      trial.userChoice ??
      trial.chosenSide ??
      trial.selectedBasket
  );
}

function isRuleSwitchMarker(trial = {}) {
  return Boolean(
    trial.phase === "rule_switch" ||
      trial.trialType === "rule_switch" ||
      trial.isRuleSwitch === true ||
      trial.ruleChanged === true ||
      trial.switchMarker === true
  );
}

function getExplicitPostSwitchValue(trial = {}) {
  const booleanFields = [
    "wasAfterRuleSwitch",
    "isPostSwitch",
    "afterSwitch",
    "isAfterSwitch",
    "postSwitch",
    "hasSwitched",
  ];

  for (const field of booleanFields) {
    if (typeof trial[field] === "boolean") {
      return trial[field];
    }
  }

  const phase = String(trial.phase || "").toLowerCase();
  const trialType = String(trial.trialType || "").toLowerCase();

  if (
    phase === "post_switch" ||
    phase === "type_after_switch" ||
    phase === "shape_after_switch" ||
    trialType === "post_switch"
  ) {
    return true;
  }

  return null;
}

function isFormalTrial(trial = {}) {
  if (!trial || typeof trial !== "object") return false;

  const phase = String(trial.phase || "").toLowerCase();

  if (
    trial.isPractice === true ||
    trial.practice === true ||
    trial.isTutorial === true ||
    phase === "instruction" ||
    phase === "tutorial" ||
    phase === "intro" ||
    phase === "practice" ||
    isRuleSwitchMarker(trial)
  ) {
    return false;
  }

  return Boolean(
    getTrialRule(trial) ||
      typeof trial.isCorrect === "boolean" ||
      typeof trial.correct === "boolean" ||
      typeof trial.wasCorrect === "boolean" ||
      typeof trial.result === "string"
  );
}

function isFirstTryCorrect(trial = {}) {
  if (!getCorrectValue(trial)) return false;

  if (isFiniteNumber(trial.attemptCount)) {
    return trial.attemptCount <= 1;
  }

  if (isFiniteNumber(trial.wrongTapCount)) {
    return trial.wrongTapCount <= 0;
  }

  if (isFiniteNumber(trial.errorCount)) {
    return trial.errorCount <= 0;
  }

  if (typeof trial.isFirstTry === "boolean") {
    return trial.isFirstTry;
  }

  if (typeof trial.firstTryCorrect === "boolean") {
    return trial.firstTryCorrect;
  }

  return true;
}

function isInterferenceTrial(trial = {}) {
  if (
    trial.isInterferenceTrial === true ||
    trial.interferenceTrial === true ||
    trial.hasConflict === true ||
    trial.isConflictTrial === true ||
    trial.phase === "interference" ||
    trial.trialType === "interference" ||
    trial.trialType === "conflict"
  ) {
    return true;
  }

  const correctSide = getCorrectSide(trial);
  const oldRuleSide = getOldRuleSide(trial);

  return Boolean(
    correctSide &&
      oldRuleSide &&
      correctSide !== oldRuleSide
  );
}

function isOldRuleError(trial = {}) {
  if (getCorrectValue(trial)) return false;

  if (
    trial.isPerseverativeError === true ||
    trial.isOldRuleInterference === true ||
    trial.oldRuleError === true ||
    trial.followedOldRule === true ||
    trial.errorType === "perseverative" ||
    trial.errorType === "old_rule" ||
    trial.errorType === "oldRule"
  ) {
    return true;
  }

  const selectedSide = getSelectedSide(trial);
  const oldRuleSide = getOldRuleSide(trial);
  const correctSide = getCorrectSide(trial);

  return Boolean(
    selectedSide &&
      oldRuleSide &&
      correctSide &&
      selectedSide === oldRuleSide &&
      selectedSide !== correctSide
  );
}

function getBestStreak(trials = []) {
  let current = 0;
  let best = 0;

  trials.forEach((trial) => {
    if (getCorrectValue(trial)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return best;
}

/* -------------------------------------------------------------------------- */
/* 規則切換時序                                                                */
/* -------------------------------------------------------------------------- */

function buildSwitchTimeline(trialLogs = []) {
  const entries = [];

  let previousRule = null;
  let switchOccurred = false;

  trialLogs.forEach((trial, originalIndex) => {
    if (!trial || typeof trial !== "object") return;

    if (isRuleSwitchMarker(trial)) {
      switchOccurred = true;
      return;
    }

    if (!isFormalTrial(trial)) return;

    const rule = getTrialRule(trial);
    const explicitPostSwitch = getExplicitPostSwitchValue(trial);

    if (
      previousRule &&
      rule &&
      previousRule !== rule
    ) {
      switchOccurred = true;
    }

    const isPostSwitch =
      explicitPostSwitch === true ||
      (explicitPostSwitch !== false && switchOccurred);

    entries.push({
      trial,
      originalIndex,
      rule,
      isPostSwitch,
    });

    if (rule) {
      previousRule = rule;
    }
  });

  return entries;
}

/* -------------------------------------------------------------------------- */
/* 反應時間                                                                    */
/* -------------------------------------------------------------------------- */

function getReactionTimeScore(avgReactionTime) {
  const rt = safeNumber(avgReactionTime, 0);

  if (rt <= 0) return DEFAULT_MISSING_RT_SCORE;
  if (rt <= 1800) return 100;
  if (rt <= 2800) return 90;
  if (rt <= 4000) return 78;
  if (rt <= 5500) return 65;
  if (rt <= 7500) return 50;

  return 35;
}

function getResponseStability(reactionTimes = []) {
  const validTimes = filterValidReactionTimes(reactionTimes);
  const mean = average(validTimes);
  const sd = standardDeviation(validTimes);
  const cvResult = getCoefficientOfVariation(validTimes);

  if (validTimes.length <= 1 || mean <= 0) {
    return {
      score: DEFAULT_STABILITY_SCORE,
      level: "資料不足",
      mean,
      standardDeviation: sd,
      coefficientOfVariation: 0,
      validCount: validTimes.length,
      reliable: false,
    };
  }

  const cv = cvResult.value;

  let consistencyScore = 40;
  let level = "波動較大";

  if (cv <= 0.2 && sd <= 500) {
    consistencyScore = 100;
    level = "非常穩定";
  } else if (cv <= 0.35 && sd <= 1000) {
    consistencyScore = 85;
    level = "穩定";
  } else if (cv <= 0.5 && sd <= 1800) {
    consistencyScore = 70;
    level = "尚可";
  } else if (cv <= 0.7 && sd <= 2500) {
    consistencyScore = 55;
    level = "稍有波動";
  }

  const speedScore = getReactionTimeScore(mean);

  return {
    score: Math.round(
      consistencyScore * 0.75 + speedScore * 0.25
    ),
    level,
    mean,
    standardDeviation: sd,
    coefficientOfVariation: cv,
    validCount: validTimes.length,
    reliable: cvResult.reliable,
  };
}

function getReactionTimeLevel(avgReactionTime) {
  const rt = safeNumber(avgReactionTime, 0);

  if (rt <= 0) {
    return {
      level: "未取得",
      description: "本次沒有取得有效反應時間資料。",
    };
  }

  if (rt <= 2000) {
    return {
      level: "快速",
      description: "能在短時間內完成規則判斷與分類反應。",
    };
  }

  if (rt <= 3500) {
    return {
      level: "穩定",
      description: "作答速度大致穩定，能完成規則判斷。",
    };
  }

  if (rt <= 5000) {
    return {
      level: "稍慢",
      description: "可能需要更多時間理解規則或確認答案。",
    };
  }

  if (rt <= 7000) {
    return {
      level: "偏慢",
      description: "分類前需要較長思考時間，建議搭配練習觀察。",
    };
  }

  return {
    level: "明顯偏慢",
    description: "完成分類所需時間較長，建議增加規則提示。",
  };
}

/* -------------------------------------------------------------------------- */
/* Trial logs 分析                                                             */
/* -------------------------------------------------------------------------- */

function analyzeTrialLogs(trialLogs = []) {
  const safeLogs = Array.isArray(trialLogs)
    ? trialLogs
    : [];

  const timeline = buildSwitchTimeline(safeLogs);

  const formalTrials = timeline.map((entry) => entry.trial);

  const colorTrials = timeline
    .filter((entry) => entry.rule === "color")
    .map((entry) => entry.trial);

  const typeTrials = timeline
    .filter((entry) => entry.rule === "type")
    .map((entry) => entry.trial);

  const preSwitchTrials = timeline
    .filter((entry) => !entry.isPostSwitch)
    .map((entry) => entry.trial);

  const postSwitchTrials = timeline
    .filter((entry) => entry.isPostSwitch)
    .map((entry) => entry.trial);

  const interferenceTrials =
    postSwitchTrials.filter(isInterferenceTrial);

  const correctTrials =
    formalTrials.filter(getCorrectValue);

  const incorrectTrials =
    formalTrials.filter((trial) => !getCorrectValue(trial));

  const timeoutTrials =
    formalTrials.filter(isTimeoutTrial);

  const colorCorrect =
    colorTrials.filter(getCorrectValue);

  const typeCorrect =
    typeTrials.filter(getCorrectValue);

  const postSwitchCorrect =
    postSwitchTrials.filter(getCorrectValue);

  const interferenceCorrect =
    interferenceTrials.filter(getCorrectValue);

  const firstTryCorrect =
    formalTrials.filter(isFirstTryCorrect);

  const explicitPerseverativeErrors =
    interferenceTrials.filter(isOldRuleError);

  const fallbackPerseverativeErrors =
    postSwitchTrials.filter(isOldRuleError);

  const perseverativeErrorTrials =
    interferenceTrials.length > 0
      ? explicitPerseverativeErrors
      : fallbackPerseverativeErrors;

  const totalTrials = formalTrials.length;
  const correctCount = correctTrials.length;
  const incorrectCount = incorrectTrials.length;
  const timeoutCount = timeoutTrials.length;

  const accuracy = safeDivide(correctCount, totalTrials);

  const colorAccuracy = safeDivide(
    colorCorrect.length,
    colorTrials.length
  );

  const typeAccuracy = safeDivide(
    typeCorrect.length,
    typeTrials.length
  );

  const postSwitchAccuracy = safeDivide(
    postSwitchCorrect.length,
    postSwitchTrials.length
  );

  const interferenceAccuracy = safeDivide(
    interferenceCorrect.length,
    interferenceTrials.length
  );

  const firstTryAccuracy = safeDivide(
    firstTryCorrect.length,
    totalTrials
  );

  const reactionTimes = filterValidReactionTimes(
    formalTrials.map(getReactionTime)
  );

  const preSwitchReactionTimes =
    filterValidReactionTimes(
      preSwitchTrials.map(getReactionTime)
    );

  const postSwitchReactionTimes =
    filterValidReactionTimes(
      postSwitchTrials.map(getReactionTime)
    );

  const colorReactionTimes =
    filterValidReactionTimes(
      colorTrials.map(getReactionTime)
    );

  const typeReactionTimes =
    filterValidReactionTimes(
      typeTrials.map(getReactionTime)
    );

  const interferenceReactionTimes =
    filterValidReactionTimes(
      interferenceTrials.map(getReactionTime)
    );

  const avgReactionTime = average(reactionTimes);

  const preSwitchAvgReactionTime =
    average(preSwitchReactionTimes);

  const postSwitchAvgReactionTime =
    average(postSwitchReactionTimes);

  const colorAvgReactionTime =
    average(colorReactionTimes);

  const typeAvgReactionTime =
    average(typeReactionTimes);

  const interferenceAvgReactionTime =
    average(interferenceReactionTimes);

  const rtDifferenceAfterSwitch =
    preSwitchAvgReactionTime > 0 &&
    postSwitchAvgReactionTime > 0
      ? postSwitchAvgReactionTime -
        preSwitchAvgReactionTime
      : 0;

  const switchCostRatio =
    preSwitchAvgReactionTime > 0 &&
    postSwitchAvgReactionTime > 0
      ? safeDivide(
          rtDifferenceAfterSwitch,
          preSwitchAvgReactionTime
        )
      : 0;

  const perseverativeErrors =
    perseverativeErrorTrials.length;

  const perseverativeDenominator =
    interferenceTrials.length > 0
      ? interferenceTrials.length
      : postSwitchTrials.length;

  const perseverativeErrorRate = safeDivide(
    perseverativeErrors,
    perseverativeDenominator
  );

  const hasInhibitionData =
    perseverativeDenominator > 0;

  const interferenceControl =
    hasInhibitionData
      ? clamp(1 - perseverativeErrorRate, 0, 1)
      : null;

  const overallStability =
    getResponseStability(reactionTimes);

  const colorStability =
    getResponseStability(colorReactionTimes);

  const typeStability =
    getResponseStability(typeReactionTimes);

  const postSwitchStability =
    getResponseStability(postSwitchReactionTimes);

  return {
    formalTrials,
    timeline,

    totalTrials,
    correctCount,
    incorrectCount,
    timeoutCount,

    colorTrials: colorTrials.length,
    typeTrials: typeTrials.length,
    preSwitchTrials: preSwitchTrials.length,
    postSwitchTrials: postSwitchTrials.length,
    switchTrials: postSwitchTrials.length,
    interferenceTrials: interferenceTrials.length,

    accuracy,
    colorAccuracy,
    typeAccuracy,
    postSwitchAccuracy,
    switchAccuracy: postSwitchAccuracy,
    interferenceAccuracy,
    firstTryAccuracy,

    perseverativeErrors,
    perseverativeErrorRate,
    interferenceControl,
    hasInhibitionData,

    bestStreak: getBestStreak(formalTrials),

    reactionTimes,
    avgReactionTime,
    preSwitchAvgReactionTime,
    postSwitchAvgReactionTime,
    switchAvgReactionTime: postSwitchAvgReactionTime,
    colorAvgReactionTime,
    typeAvgReactionTime,
    interferenceAvgReactionTime,

    rtDifferenceAfterSwitch,
    switchCost: rtDifferenceAfterSwitch,
    switchCostRatio,

    responseStabilityScore: overallStability.score,
    responseStabilityLevel: overallStability.level,

    reactionTimeStandardDeviation:
      overallStability.standardDeviation,

    reactionTimeCv:
      overallStability.coefficientOfVariation,

    reactionTimeValidCount:
      overallStability.validCount,

    reactionTimeCvReliable:
      overallStability.reliable,

    colorReactionTimeCv:
      colorStability.coefficientOfVariation,

    typeReactionTimeCv:
      typeStability.coefficientOfVariation,

    postSwitchReactionTimeCv:
      postSwitchStability.coefficientOfVariation,
  };
}

/* -------------------------------------------------------------------------- */
/* 輸入資料讀取                                                                */
/* -------------------------------------------------------------------------- */

function readRatio(resultData, keys, fallback = 0) {
  const keyList = Array.isArray(keys) ? keys : [keys];

  for (const key of keyList) {
    if (isFiniteNumber(resultData?.[key])) {
      return normalizeRatio(resultData[key]);
    }
  }

  return normalizeRatio(fallback);
}

function readCount(resultData, keys, fallback = 0) {
  const keyList = Array.isArray(keys) ? keys : [keys];

  for (const key of keyList) {
    if (isFiniteNumber(resultData?.[key])) {
      return safeInteger(resultData[key], fallback);
    }
  }

  return safeInteger(fallback, 0);
}

function readTime(resultData, keys, fallback = 0) {
  const keyList = Array.isArray(keys) ? keys : [keys];

  for (const key of keyList) {
    if (isFiniteNumber(resultData?.[key])) {
      return Math.max(0, resultData[key]);
    }
  }

  return Math.max(0, safeNumber(fallback, 0));
}

function resolveMode(resultData = {}) {
  const explicitMode =
    resultData.mode ||
    resultData.scoringMode ||
    resultData.gameMode ||
    resultData.sourceMode;

  if (typeof explicitMode === "string") {
    const normalized = explicitMode.trim().toLowerCase();

    if (
      normalized === "training" ||
      normalized === "train" ||
      normalized === "practice"
    ) {
      return "training";
    }

    if (
      normalized === "test" ||
      normalized === "assessment" ||
      normalized === "formal"
    ) {
      return "test";
    }
  }

  if (
    resultData.isTraining === true ||
    resultData.training === true
  ) {
    return "training";
  }

  if (
    resultData.isTest === true ||
    resultData.formalTest === true
  ) {
    return "test";
  }

  if (
    resultData.trainingDifficulty ||
    resultData.levelDifficulty ||
    resultData.trainingLevel ||
    resultData.trainingConfig
  ) {
    return "training";
  }

  return "test";
}

function getResultDifficulty(resultData = {}) {
  return (
    resultData.trainingDifficulty ||
    resultData.levelDifficulty ||
    resultData.trainingLevel ||
    resultData.difficultyLevel ||
    resultData.levelId ||
    resultData.difficulty ||
    "switchClear"
  );
}

/* -------------------------------------------------------------------------- */
/* 訓練模式評分                                                                */
/* -------------------------------------------------------------------------- */

function getMetricScore(metric, source) {
  if (metric === "responseStability") {
    return clamp(
      source.responseStabilityScore,
      0,
      100
    );
  }

  if (
    metric === "interferenceControl" &&
    source.interferenceControl === null
  ) {
    return null;
  }

  return normalizeRatio(source[metric]) * 100;
}

function calculateWeightedScore(weights, source) {
  let weightedScore = 0;
  let activeWeight = 0;

  Object.entries(weights || {}).forEach(
    ([metric, rawWeight]) => {
      const weight = safeNumber(rawWeight, 0);
      const metricScore = getMetricScore(metric, source);

      if (
        weight <= 0 ||
        metricScore === null ||
        !Number.isFinite(metricScore)
      ) {
        return;
      }

      weightedScore += metricScore * weight;
      activeWeight += weight;
    }
  );

  if (activeWeight <= 0) return 0;

  return Math.round(
    clamp(weightedScore / activeWeight, 0, 100)
  );
}

function getPrimaryRuleAccuracy(config, source) {
  if (config.abilityFocus === "colorRule") {
    return source.colorTrials > 0
      ? source.colorAccuracy
      : source.accuracy;
  }

  if (config.abilityFocus === "typeRule") {
    return source.typeTrials > 0
      ? source.typeAccuracy
      : source.accuracy;
  }

  return source.accuracy;
}

function calculateTrainingLevelScore(metrics, difficulty) {
  const {
    difficulty: normalizedDifficulty,
    config,
  } = getDifficultyConfig(difficulty);

  const scoreSource = {
    ...metrics,
    responseStabilityScore: clamp(
      metrics.responseStabilityScore,
      0,
      100
    ),
  };

  const totalScore = calculateWeightedScore(
    config.weights,
    scoreSource
  );

  const primaryRuleAccuracy =
    getPrimaryRuleAccuracy(config, scoreSource);

  const hasSwitchTrials =
    scoreSource.postSwitchTrials > 0;

  const hasInterferenceTrials =
    scoreSource.interferenceTrials > 0;

  const interferenceControl =
    scoreSource.interferenceControl;

  const perseverativeErrors =
    safeInteger(scoreSource.perseverativeErrors, 0);

  let stars = 1;

  if (config.starRule === "singleRule") {
    if (
      totalScore >= 85 &&
      primaryRuleAccuracy >= 0.8 &&
      scoreSource.firstTryAccuracy >= 0.7
    ) {
      stars = 3;
    } else if (
      totalScore >= 60 &&
      primaryRuleAccuracy >= 0.55
    ) {
      stars = 2;
    }
  }

  if (config.starRule === "clearSwitch") {
    if (
      hasSwitchTrials &&
      scoreSource.postSwitchAccuracy >= 0.7 &&
      totalScore >= 80
    ) {
      stars = 3;
    } else if (
      hasSwitchTrials &&
      scoreSource.postSwitchAccuracy >= 0.5 &&
      totalScore >= 55
    ) {
      stars = 2;
    }
  }

  if (config.starRule === "switchMaintain") {
    if (
      hasSwitchTrials &&
      scoreSource.postSwitchAccuracy >= 0.7 &&
      totalScore >= 80 &&
      perseverativeErrors <= 1
    ) {
      stars = 3;
    } else if (
      hasSwitchTrials &&
      scoreSource.postSwitchAccuracy >= 0.5 &&
      totalScore >= 55
    ) {
      stars = 2;
    }
  }

  if (config.starRule === "interference") {
    if (
      hasSwitchTrials &&
      hasInterferenceTrials &&
      scoreSource.postSwitchAccuracy >= 0.7 &&
      scoreSource.interferenceAccuracy >= 0.65 &&
      interferenceControl !== null &&
      interferenceControl >= 0.75 &&
      perseverativeErrors <= 1 &&
      totalScore >= 80
    ) {
      stars = 3;
    } else if (
      hasSwitchTrials &&
      hasInterferenceTrials &&
      scoreSource.postSwitchAccuracy >= 0.5 &&
      scoreSource.interferenceAccuracy >= 0.5 &&
      interferenceControl !== null &&
      interferenceControl >= 0.55 &&
      totalScore >= 55
    ) {
      stars = 2;
    }
  }

  if (config.starRule === "testLike") {
    if (
      hasSwitchTrials &&
      scoreSource.postSwitchAccuracy >= 0.75 &&
      scoreSource.accuracy >= 0.75 &&
      perseverativeErrors <= 1 &&
      totalScore >= 80
    ) {
      stars = 3;
    } else if (
      hasSwitchTrials &&
      scoreSource.postSwitchAccuracy >= 0.5 &&
      scoreSource.accuracy >= 0.55 &&
      totalScore >= 55
    ) {
      stars = 2;
    }
  }

  return {
    totalScore,
    stars,

    difficulty: normalizedDifficulty,
    difficultyLevel: config.level,
    difficultyLabel: config.label,
    difficultyTitle: config.title,
    difficultyCategory: config.category,

    abilityFocus: config.abilityFocus,
    scoringMode: "training",
    scoringWeights: config.weights,
    starRule: config.starRule,
    minimumReliableTrials: config.minimumTrials,
  };
}

/* -------------------------------------------------------------------------- */
/* 正式測驗評分                                                                */
/* -------------------------------------------------------------------------- */

function calculateFormalTestScore(metrics) {
  const hasSwitchData =
    metrics.postSwitchTrials > 0;

  const hasInhibitionData =
    metrics.hasInhibitionData === true;

  const basicRuleAccuracy = (() => {
    if (
      metrics.colorTrials > 0 &&
      metrics.typeTrials > 0
    ) {
      return (
        metrics.colorAccuracy +
        metrics.typeAccuracy
      ) / 2;
    }

    if (metrics.colorTrials > 0) {
      return metrics.colorAccuracy;
    }

    if (metrics.typeTrials > 0) {
      return metrics.typeAccuracy;
    }

    return metrics.accuracy;
  })();

  /*
   * 正式測驗基礎權重：
   * 規則切換 40%
   * 整體正確率 25%
   * 抑制舊規則 20%
   * 基本規則理解 10%
   * 反應時間 5%
   *
   * 缺少某類資料時，會重新正規化剩餘權重，
   * 避免缺少干擾題卻直接獲得滿分。
   */
  const components = [
    {
      key: "switchScore",
      available: hasSwitchData,
      weight: 0.4,
      score: metrics.postSwitchAccuracy * 100,
    },
    {
      key: "accuracyScore",
      available: metrics.totalTrials > 0,
      weight: 0.25,
      score: metrics.accuracy * 100,
    },
    {
      key: "perseverativeScore",
      available: hasInhibitionData,
      weight: 0.2,
      score:
        metrics.interferenceControl === null
          ? 0
          : metrics.interferenceControl * 100,
    },
    {
      key: "ruleScore",
      available: metrics.totalTrials > 0,
      weight: 0.1,
      score: basicRuleAccuracy * 100,
    },
    {
      key: "reactionTimeScore",
      available: metrics.avgReactionTime > 0,
      weight: 0.05,
      score: getReactionTimeScore(
        metrics.avgReactionTime
      ),
    },
  ];

  const availableComponents =
    components.filter((component) => component.available);

  const activeWeight =
    availableComponents.reduce(
      (sum, component) => sum + component.weight,
      0
    );

  const totalScore =
    activeWeight > 0
      ? Math.round(
          clamp(
            availableComponents.reduce(
              (sum, component) =>
                sum +
                component.score * component.weight,
              0
            ) / activeWeight,
            0,
            100
          )
        )
      : 0;

  const componentScores = {};

  components.forEach((component) => {
    componentScores[component.key] =
      component.available
        ? Math.round(component.score)
        : null;
  });

  let stars = 1;

  if (
    hasSwitchData &&
    metrics.postSwitchAccuracy >= 0.75 &&
    metrics.accuracy >= 0.75 &&
    metrics.perseverativeErrors <= 1 &&
    totalScore >= 80
  ) {
    stars = 3;
  } else if (
    hasSwitchData &&
    metrics.postSwitchAccuracy >= 0.5 &&
    metrics.accuracy >= 0.55 &&
    totalScore >= 55
  ) {
    stars = 2;
  }

  return {
    totalScore,
    stars,
    scoringMode: "test",
    minimumReliableTrials: 4,

    ...componentScores,

    colorScore: componentScores.ruleScore,
  };
}

/* -------------------------------------------------------------------------- */
/* 資料品質                                                                    */
/* -------------------------------------------------------------------------- */

function calculateDataQuality({
  totalTrials,
  analyzedTrialCount,
  reportedTrialCount,
  minimumReliableTrials,
  reactionTimeValidCount,
  reactionTimeReliable,
  postSwitchTrials,
  interferenceTrials,
  mode,
}) {
  const actualTrialCount =
    analyzedTrialCount > 0
      ? analyzedTrialCount
      : totalTrials;

  const hasEnoughTrials =
    actualTrialCount >= minimumReliableTrials;

  const countMismatch =
    analyzedTrialCount > 0 &&
    reportedTrialCount > 0 &&
    analyzedTrialCount !== reportedTrialCount;

  let confidence = 25;

  if (actualTrialCount >= minimumReliableTrials) {
    confidence += 25;
  }

  if (actualTrialCount >= minimumReliableTrials + 2) {
    confidence += 15;
  }

  if (reactionTimeReliable) {
    confidence += 15;
  } else if (reactionTimeValidCount >= 2) {
    confidence += 8;
  }

  if (postSwitchTrials >= 2) {
    confidence += 10;
  }

  if (interferenceTrials >= 2) {
    confidence += 10;
  }

  if (countMismatch) {
    confidence -= 10;
  }

  if (
    mode === "test" &&
    postSwitchTrials <= 0
  ) {
    confidence = Math.min(confidence, 45);
  }

  return {
    hasEnoughTrials,
    minimumReliableTrials,
    actualTrialCount,
    analyzedTrialCount,
    reportedTrialCount,
    countMismatch,
    reactionTimeReliable,
    confidence: Math.round(
      clamp(confidence, 0, 100)
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* 主評分函式                                                                  */
/* -------------------------------------------------------------------------- */

export function calculateDccsScore(resultData = {}) {
  const trialLogs = Array.isArray(resultData.trialLogs)
    ? resultData.trialLogs
    : Array.isArray(resultData.records)
    ? resultData.records
    : Array.isArray(resultData.trials)
    ? resultData.trials
    : Array.isArray(resultData.logs)
    ? resultData.logs
    : [];

  const analyzed = analyzeTrialLogs(trialLogs);

  const reportedTotalTrials = readCount(
    resultData,
    ["totalTrials", "trialCount", "completedTrials"],
    0
  );

  const totalTrials =
    analyzed.totalTrials > 0
      ? analyzed.totalTrials
      : reportedTotalTrials;

  const reportedCorrectCount = readCount(
    resultData,
    [
      "correctCount",
      "correctTrials",
      "correctAnswers",
    ],
    -1
  );

  const correctCount =
    analyzed.totalTrials > 0
      ? analyzed.correctCount
      : reportedCorrectCount >= 0
      ? Math.min(reportedCorrectCount, totalTrials)
      : 0;

  const incorrectCount =
    analyzed.totalTrials > 0
      ? analyzed.incorrectCount
      : Math.max(0, totalTrials - correctCount);

  const timeoutCount = readCount(
    resultData,
    ["timeoutCount", "timeouts"],
    analyzed.timeoutCount
  );

  const fallbackAccuracy =
    totalTrials > 0
      ? safeDivide(correctCount, totalTrials)
      : 0;

  const accuracy =
    analyzed.totalTrials > 0
      ? analyzed.accuracy
      : readRatio(
          resultData,
          ["accuracy", "accuracyRatio"],
          fallbackAccuracy
        );

  const colorTrials = readCount(
    resultData,
    "colorTrials",
    analyzed.colorTrials
  );

  const typeTrials = readCount(
    resultData,
    "typeTrials",
    analyzed.typeTrials
  );

  const postSwitchTrials = readCount(
    resultData,
    ["postSwitchTrials", "switchTrials"],
    analyzed.postSwitchTrials
  );

  const switchTrials = postSwitchTrials;

  const interferenceTrials = readCount(
    resultData,
    "interferenceTrials",
    analyzed.interferenceTrials
  );

  const colorAccuracy =
    analyzed.colorTrials > 0
      ? analyzed.colorAccuracy
      : readRatio(
          resultData,
          ["colorAccuracy", "colorAccuracyRatio"],
          0
        );

  const typeAccuracy =
    analyzed.typeTrials > 0
      ? analyzed.typeAccuracy
      : readRatio(
          resultData,
          ["typeAccuracy", "typeAccuracyRatio"],
          0
        );

  const postSwitchAccuracy =
    analyzed.postSwitchTrials > 0
      ? analyzed.postSwitchAccuracy
      : readRatio(
          resultData,
          [
            "postSwitchAccuracy",
            "switchAccuracy",
            "switchAccuracyRatio",
          ],
          0
        );

  const switchAccuracy =
    postSwitchAccuracy;

  const interferenceAccuracy =
    analyzed.interferenceTrials > 0
      ? analyzed.interferenceAccuracy
      : readRatio(
          resultData,
          [
            "interferenceAccuracy",
            "interferenceAccuracyRatio",
          ],
          0
        );

  const firstTryAccuracy =
    analyzed.totalTrials > 0
      ? analyzed.firstTryAccuracy
      : readRatio(
          resultData,
          [
            "firstTryAccuracy",
            "firstTryAccuracyRatio",
          ],
          accuracy
        );

  const perseverativeErrors =
    analyzed.postSwitchTrials > 0
      ? analyzed.perseverativeErrors
      : readCount(
          resultData,
          [
            "perseverativeErrors",
            "oldRuleInterference",
          ],
          0
        );

  const perseverativeDenominator =
    interferenceTrials > 0
      ? interferenceTrials
      : postSwitchTrials;

  const hasInhibitionData =
    analyzed.hasInhibitionData ||
    perseverativeDenominator > 0;

  const perseverativeErrorRate =
    hasInhibitionData
      ? readRatio(
          resultData,
          [
            "perseverativeErrorRateRatio",
            "perseverativeErrorRate",
          ],
          safeDivide(
            perseverativeErrors,
            perseverativeDenominator
          )
        )
      : 0;

  const interferenceControl =
    hasInhibitionData
      ? readRatio(
          resultData,
          [
            "interferenceControlRatio",
            "interferenceControl",
          ],
          clamp(
            1 - perseverativeErrorRate,
            0,
            1
          )
        )
      : null;

  const avgReactionTime = readTime(
    resultData,
    "avgReactionTime",
    analyzed.avgReactionTime
  );

  const preSwitchAvgReactionTime = readTime(
    resultData,
    "preSwitchAvgReactionTime",
    analyzed.preSwitchAvgReactionTime
  );

  const colorAvgReactionTime = readTime(
    resultData,
    "colorAvgReactionTime",
    analyzed.colorAvgReactionTime
  );

  const typeAvgReactionTime = readTime(
    resultData,
    "typeAvgReactionTime",
    analyzed.typeAvgReactionTime
  );

  const postSwitchAvgReactionTime = readTime(
    resultData,
    [
      "postSwitchAvgReactionTime",
      "switchAvgReactionTime",
    ],
    analyzed.postSwitchAvgReactionTime
  );

  const switchAvgReactionTime =
    postSwitchAvgReactionTime;

  const interferenceAvgReactionTime = readTime(
    resultData,
    "interferenceAvgReactionTime",
    analyzed.interferenceAvgReactionTime
  );

  const rtDifferenceAfterSwitch =
    isFiniteNumber(resultData.rtDifferenceAfterSwitch)
      ? resultData.rtDifferenceAfterSwitch
      : isFiniteNumber(resultData.switchCost)
      ? resultData.switchCost
      : analyzed.rtDifferenceAfterSwitch;

  const switchCost =
    rtDifferenceAfterSwitch;

  const switchCostRatio =
    isFiniteNumber(resultData.switchCostRatio)
      ? resultData.switchCostRatio
      : preSwitchAvgReactionTime > 0 &&
        postSwitchAvgReactionTime > 0
      ? safeDivide(
          rtDifferenceAfterSwitch,
          preSwitchAvgReactionTime
        )
      : analyzed.switchCostRatio;

  const responseStabilityScore =
    isFiniteNumber(resultData.responseStabilityScore)
      ? clamp(
          resultData.responseStabilityScore,
          0,
          100
        )
      : analyzed.responseStabilityScore;

  const responseStabilityLevel =
    resultData.responseStabilityLevel ||
    analyzed.responseStabilityLevel ||
    "資料不足";

  const reactionTimeStandardDeviation =
    readTime(
      resultData,
      [
        "reactionTimeStandardDeviation",
        "reactionTimeStd",
      ],
      analyzed.reactionTimeStandardDeviation
    );

  const reactionTimeCv =
    isFiniteNumber(resultData.reactionTimeCv)
      ? Math.max(0, resultData.reactionTimeCv)
      : analyzed.reactionTimeCv;

  const reactionTimeValidCount = readCount(
    resultData,
    "reactionTimeValidCount",
    analyzed.reactionTimeValidCount
  );

  const reactionTimeCvReliable =
    typeof resultData.reactionTimeCvReliable === "boolean"
      ? resultData.reactionTimeCvReliable
      : analyzed.reactionTimeCvReliable;

  const colorReactionTimeCv =
    isFiniteNumber(resultData.colorReactionTimeCv)
      ? Math.max(0, resultData.colorReactionTimeCv)
      : analyzed.colorReactionTimeCv;

  const typeReactionTimeCv =
    isFiniteNumber(resultData.typeReactionTimeCv)
      ? Math.max(0, resultData.typeReactionTimeCv)
      : analyzed.typeReactionTimeCv;

  const postSwitchReactionTimeCv =
    isFiniteNumber(resultData.postSwitchReactionTimeCv)
      ? Math.max(
          0,
          resultData.postSwitchReactionTimeCv
        )
      : analyzed.postSwitchReactionTimeCv;

  const bestStreak = readCount(
    resultData,
    "bestStreak",
    analyzed.bestStreak
  );

  const mode = resolveMode(resultData);
  const isTraining = mode === "training";

  const difficulty =
    getResultDifficulty(resultData);

  const metrics = {
    totalTrials,
    correctCount,
    incorrectCount,
    timeoutCount,

    colorTrials,
    typeTrials,
    postSwitchTrials,
    switchTrials,
    interferenceTrials,

    accuracy,
    colorAccuracy,
    typeAccuracy,
    postSwitchAccuracy,
    switchAccuracy,
    interferenceAccuracy,
    firstTryAccuracy,

    perseverativeErrors,
    perseverativeErrorRate,
    interferenceControl,
    hasInhibitionData,

    avgReactionTime,
    preSwitchAvgReactionTime,
    colorAvgReactionTime,
    typeAvgReactionTime,
    postSwitchAvgReactionTime,
    switchAvgReactionTime,
    interferenceAvgReactionTime,

    rtDifferenceAfterSwitch,
    switchCost,
    switchCostRatio,

    responseStabilityScore,
    responseStabilityLevel,

    reactionTimeStandardDeviation,
    reactionTimeCv,
    reactionTimeValidCount,
    reactionTimeCvReliable,

    colorReactionTimeCv,
    typeReactionTimeCv,
    postSwitchReactionTimeCv,

    bestStreak,
  };

  const scoringResult = isTraining
    ? calculateTrainingLevelScore(
        metrics,
        difficulty
      )
    : calculateFormalTestScore(metrics);

  const minimumReliableTrials =
    scoringResult.minimumReliableTrials;

  const dataQuality = calculateDataQuality({
    totalTrials,
    analyzedTrialCount: analyzed.totalTrials,
    reportedTrialCount: reportedTotalTrials,
    minimumReliableTrials,
    reactionTimeValidCount,
    reactionTimeReliable:
      reactionTimeCvReliable,
    postSwitchTrials,
    interferenceTrials,
    mode,
  });

  let stars = scoringResult.stars;

  if (!dataQuality.hasEnoughTrials) {
    stars = 1;
  }

  if (
    mode === "test" &&
    postSwitchTrials <= 0
  ) {
    stars = 1;
  }

  const totalScore = scoringResult.totalScore;

  const ruleUnderstandingRatio = (() => {
    if (colorTrials > 0 && typeTrials > 0) {
      return (
        colorAccuracy + typeAccuracy
      ) / 2;
    }

    if (typeTrials > 0) {
      return typeAccuracy;
    }

    if (colorTrials > 0) {
      return colorAccuracy;
    }

    return accuracy;
  })();

  const parentIndicators = {
    ruleUnderstanding:
      toPercent(ruleUnderstandingRatio),

    cognitiveFlexibility:
      postSwitchTrials > 0
        ? toPercent(postSwitchAccuracy)
        : null,

    inhibitionControl:
      hasInhibitionData &&
      interferenceControl !== null
        ? toPercent(interferenceControl)
        : null,

    responseStability:
      Math.round(responseStabilityScore),

    understandRule: {
      label: "看懂規則",
      value: toPercent(ruleUnderstandingRatio),
      description:
        "孩子是否能理解目前要依照顏色或衣服種類進行分類。",
    },

    switchRule: {
      label: "換玩法能力",
      value:
        postSwitchTrials > 0
          ? toPercent(postSwitchAccuracy)
          : null,
      description:
        postSwitchTrials > 0
          ? "孩子在玩法改變後，是否能跟上新的分類方式。"
          : "此關卡未包含玩法切換，因此不計算此指標。",
    },

    avoidOldRule: {
      label: "不被舊玩法影響",
      value:
        hasInhibitionData &&
        interferenceControl !== null
          ? toPercent(interferenceControl)
          : null,
      description:
        hasInhibitionData
          ? "孩子換玩法後，是否能避免被前一個玩法干擾。"
          : "此關卡沒有足夠的舊規則干擾資料。",
    },

    stableResponse: {
      label: "作答穩定度",
      value: Math.round(responseStabilityScore),
      description:
        "觀察孩子每題反應速度是否穩定，並非單純越快越好。",
    },
  };

  const clinicianMetrics = {
    ...metrics,

    accuracyPercent: toPercent(accuracy),
    colorAccuracyPercent:
      toPercent(colorAccuracy),
    typeAccuracyPercent:
      toPercent(typeAccuracy),
    postSwitchAccuracyPercent:
      toPercent(postSwitchAccuracy),
    switchAccuracyPercent:
      toPercent(switchAccuracy),
    interferenceAccuracyPercent:
      toPercent(interferenceAccuracy),
    firstTryAccuracyPercent:
      toPercent(firstTryAccuracy),

    perseverativeErrorRatePercent:
      toPercent(perseverativeErrorRate),

    interferenceControlPercent:
      interferenceControl === null
        ? null
        : toPercent(interferenceControl),

    scoringMode:
      scoringResult.scoringMode,

    scoringWeights:
      scoringResult.scoringWeights || null,

    starRule:
      scoringResult.starRule || null,

    abilityFocus:
      scoringResult.abilityFocus || null,

    switchScore:
      scoringResult.switchScore ?? null,

    accuracyScore:
      scoringResult.accuracyScore ?? null,

    perseverativeScore:
      scoringResult.perseverativeScore ?? null,

    colorScore:
      scoringResult.colorScore ?? null,

    ruleScore:
      scoringResult.ruleScore ?? null,

    reactionTimeScore:
      scoringResult.reactionTimeScore ?? null,

    dataQuality,

    trialLogs,
  };

  const reactionTimeLevel =
    getReactionTimeLevel(avgReactionTime);

  return {
    task: "DCCS",
    gameId: "DCCS",
    mode,
    scoringMode: scoringResult.scoringMode,

    totalScore,
    score: totalScore,
    stars,

    difficulty:
      scoringResult.difficulty || null,

    difficultyLevel:
      scoringResult.difficultyLevel || null,

    difficultyLabel:
      scoringResult.difficultyLabel || null,

    difficultyTitle:
      scoringResult.difficultyTitle || null,

    difficultyCategory:
      scoringResult.difficultyCategory || null,

    abilityFocus:
      scoringResult.abilityFocus || null,

    totalTrials,
    correctCount,
    correctTrials: correctCount,
    incorrectCount,
    incorrectTrials: incorrectCount,
    timeoutCount,

    colorTrials,
    typeTrials,
    postSwitchTrials,
    switchTrials,
    interferenceTrials,

    accuracy,
    colorAccuracy,
    typeAccuracy,
    postSwitchAccuracy,
    switchAccuracy,
    interferenceAccuracy,
    firstTryAccuracy,

    accuracyPercent: toPercent(accuracy),
    colorAccuracyPercent:
      toPercent(colorAccuracy),
    typeAccuracyPercent:
      toPercent(typeAccuracy),
    postSwitchAccuracyPercent:
      toPercent(postSwitchAccuracy),
    switchAccuracyPercent:
      toPercent(switchAccuracy),
    interferenceAccuracyPercent:
      toPercent(interferenceAccuracy),
    firstTryAccuracyPercent:
      toPercent(firstTryAccuracy),

    perseverativeErrors,
    oldRuleInterference:
      perseverativeErrors,

    perseverativeErrorRate,
    perseverativeErrorRatePercent:
      toPercent(perseverativeErrorRate),

    interferenceControl,
    interferenceControlPercent:
      interferenceControl === null
        ? null
        : toPercent(interferenceControl),

    hasInhibitionData,

    bestStreak,

    avgReactionTime,
    preSwitchAvgReactionTime,
    colorAvgReactionTime,
    typeAvgReactionTime,
    postSwitchAvgReactionTime,
    switchAvgReactionTime,
    interferenceAvgReactionTime,

    rtDifferenceAfterSwitch,
    switchCost,
    switchCostRatio,

    reactionTimeStandardDeviation,
    reactionTimeStd:
      reactionTimeStandardDeviation,

    reactionTimeCv,
    reactionTimeValidCount,
    reactionTimeCvReliable,

    colorReactionTimeCv,
    typeReactionTimeCv,
    postSwitchReactionTimeCv,

    responseStabilityScore,
    responseStabilityLevel,

    hasEnoughTrials:
      dataQuality.hasEnoughTrials,

    minimumReliableTrials,
    dataConfidence:
      dataQuality.confidence,

    dataQuality,

    scoringWeights:
      scoringResult.scoringWeights || null,

    starRule:
      scoringResult.starRule || null,

    switchScore:
      scoringResult.switchScore ?? null,

    accuracyScore:
      scoringResult.accuracyScore ?? null,

    perseverativeScore:
      scoringResult.perseverativeScore ?? null,

    colorScore:
      scoringResult.colorScore ?? null,

    ruleScore:
      scoringResult.ruleScore ?? null,

    reactionTimeScore:
      scoringResult.reactionTimeScore ?? null,

    parentIndicators,
    clinicianMetrics,

    childMessage:
      getChildMessage({
        stars,
        hasEnoughTrials:
          dataQuality.hasEnoughTrials,
      }),

    parentSummary:
      getParentSummary({
        stars,
        isTraining,
        difficultyTitle:
          scoringResult.difficultyTitle,
        accuracy,
        postSwitchAccuracy,
        perseverativeErrors,
        postSwitchTrials,
        interferenceTrials,
        hasInhibitionData,
        hasEnoughTrials:
          dataQuality.hasEnoughTrials,
      }),

    clinicianSummary:
      getClinicianSummary({
        totalScore,
        accuracy,
        colorAccuracy,
        typeAccuracy,
        postSwitchAccuracy,
        interferenceAccuracy,
        firstTryAccuracy,
        perseverativeErrors,
        perseverativeErrorRate,
        interferenceControl,
        avgReactionTime,
        rtDifferenceAfterSwitch,
        switchCostRatio,
        responseStabilityScore,
        postSwitchTrials,
        interferenceTrials,
        hasInhibitionData,
        dataQuality,
      }),

    reactionTimeLevel,
  };
}

/* -------------------------------------------------------------------------- */
/* 文字結果                                                                    */
/* -------------------------------------------------------------------------- */

function getChildMessage({
  stars,
  hasEnoughTrials,
}) {
  if (!hasEnoughTrials) {
    return {
      title: "完成練習！",
      text: "這次完成的題目比較少，下次再多玩幾題看看吧！",
    };
  }

  if (stars === 3) {
    return {
      title: "太棒了！",
      text: "你很會跟著新玩法整理衣服，孔雀小姐很開心！",
    };
  }

  if (stars === 2) {
    return {
      title: "做得不錯！",
      text: "你已經會分類了，換玩法時再多想一下會更棒！",
    };
  }

  return {
    title: "再練習一次！",
    text: "沒關係，我們再陪孔雀小姐一起練習分類玩法！",
  };
}

function getParentSummary({
  stars,
  isTraining,
  difficultyTitle,
  accuracy,
  postSwitchAccuracy,
  perseverativeErrors,
  postSwitchTrials,
  interferenceTrials,
  hasInhibitionData,
  hasEnoughTrials,
}) {
  if (!hasEnoughTrials) {
    return "本次完成的有效題數較少，結果暫時只適合作為練習紀錄，不建議單獨用來判斷能力。";
  }

  const levelText =
    difficultyTitle
      ? `「${difficultyTitle}」`
      : "本次";

  if (isTraining) {
    if (stars === 3) {
      if (postSwitchTrials > 0) {
        return `孩子在${levelText}訓練中表現穩定，能在玩法改變後跟上新的分類方式。`;
      }

      return `孩子在${levelText}訓練中能穩定依照目前規則完成分類。`;
    }

    if (stars === 2) {
      if (
        hasInhibitionData &&
        perseverativeErrors > 0
      ) {
        return "孩子已能完成部分分類，但換玩法後仍可能受到前一個玩法影響，建議維持短回合練習。";
      }

      if (
        postSwitchTrials > 0 &&
        postSwitchAccuracy < 0.7
      ) {
        return "孩子能完成基本分類，但在玩法改變後仍需要更多練習來穩定套用新規則。";
      }

      return "孩子已能完成部分分類任務，建議維持相同難度，讓規則理解更加穩定。";
    }

    if (accuracy < 0.5) {
      return "孩子目前對分類規則仍較容易混淆，建議先降低難度並增加清楚的視覺提示。";
    }

    return "孩子在目前難度下仍需要較多提示，建議先維持單一規則或減少切換題。";
  }

  if (stars === 3) {
    return "孩子在本次分類任務中表現穩定，規則改變後仍能依照新的分類方式作答。";
  }

  if (stars === 2) {
    return "孩子能完成基本分類，但規則切換後仍可能受到前一個玩法影響，建議透過短回合練習加強。";
  }

  if (postSwitchTrials <= 0) {
    return "本次沒有足夠的規則切換題，暫時無法完整判斷換玩法能力。";
  }

  if (
    interferenceTrials > 0 &&
    perseverativeErrors > 0
  ) {
    return "孩子在規則轉換後較容易受到舊玩法影響，建議增加明確提示並放慢切換節奏。";
  }

  return "孩子在規則轉換時較容易混淆，建議先從單一規則開始，再逐步加入換玩法練習。";
}

function getClinicianSummary({
  totalScore,
  accuracy,
  colorAccuracy,
  typeAccuracy,
  postSwitchAccuracy,
  interferenceAccuracy,
  firstTryAccuracy,
  perseverativeErrors,
  perseverativeErrorRate,
  interferenceControl,
  avgReactionTime,
  rtDifferenceAfterSwitch,
  switchCostRatio,
  responseStabilityScore,
  postSwitchTrials,
  interferenceTrials,
  hasInhibitionData,
  dataQuality,
}) {
  const switchCostPercent =
    Number.isFinite(switchCostRatio)
      ? Math.round(switchCostRatio * 100)
      : 0;

  return {
    overview:
      `DCCS 綜合分數為 ${totalScore} 分，` +
      `整體正確率 ${toPercent(accuracy)}%，` +
      `顏色規則正確率 ${toPercent(colorAccuracy)}%，` +
      `種類規則正確率 ${toPercent(typeAccuracy)}%。`,

    switchObservation:
      postSwitchTrials > 0
        ? `切換後正確率為 ${toPercent(
            postSwitchAccuracy
          )}%，切換後反應時間差為 ${rtDifferenceAfterSwitch} ms，` +
          `相對切換成本約為 ${switchCostPercent}%。`
        : "本次缺少切換後試題，無法將規則轉換能力作為主要判讀依據。",

    inhibitionObservation:
      hasInhibitionData
        ? `固著錯誤共 ${perseverativeErrors} 次，` +
          `固著錯誤率為 ${toPercent(
            perseverativeErrorRate
          )}%，` +
          `抑制控制指標為 ${
            interferenceControl === null
              ? "無資料"
              : `${toPercent(interferenceControl)}%`
          }，` +
          `干擾題正確率為 ${toPercent(
            interferenceAccuracy
          )}%。`
        : "本次沒有足夠的舊規則干擾資料，因此不計算抑制控制指標。",

    firstTryObservation:
      `第一次答對率為 ${toPercent(
        firstTryAccuracy
      )}%，可輔助觀察是否能在不反覆試錯的情況下理解規則。`,

    reactionTimeObservation:
      `平均反應時間為 ${avgReactionTime} ms，` +
      `作答穩定度為 ${Math.round(
        responseStabilityScore
      )} 分。`,

    dataQualityObservation:
      `本次有效題數為 ${
        dataQuality.actualTrialCount
      } 題，最低建議題數為 ${
        dataQuality.minimumReliableTrials
      } 題，資料信心度為 ${
        dataQuality.confidence
      }%。` +
      (dataQuality.countMismatch
        ? " 系統回報題數與逐題紀錄題數不一致，建議檢查資料儲存流程。"
        : ""),
  };
}

/* -------------------------------------------------------------------------- */
/* 對外工具                                                                    */
/* -------------------------------------------------------------------------- */

export function getDccsStars(resultData = {}) {
  return calculateDccsScore(resultData).stars;
}

export function getDccsScore(resultData = {}) {
  return calculateDccsScore(resultData).totalScore;
}

export function analyzeDccsTrials(trialLogs = []) {
  return analyzeTrialLogs(trialLogs);
}

export function normalizeDccsDifficulty(difficulty) {
  return normalizeDifficulty(difficulty);
}

/*
 * 保留舊拼字 Dcss，避免既有 import 失效。
 */
export const calculateDcssScore =
  calculateDccsScore;

export const getDcssStars =
  getDccsStars;

export default calculateDccsScore;