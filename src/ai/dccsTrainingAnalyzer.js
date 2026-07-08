// src/ai/dccsTrainingAnalyzer.js

/**
 * DCCS 訓練分析器
 * Dimensional Change Card Sort Training Analyzer
 *
 * 功能：
 * 1. 支援 DCCS 十階訓練難度。
 * 2. 分析規則理解、規則切換、干擾抑制與固著錯誤。
 * 3. 分析反應時間、切換成本、作答穩定度與疲勞。
 * 4. 根據目前表現建議升級、維持或降級。
 * 5. 相容 TrainingPage_DCCS.jsx 與不同版本 trial log 欄位。
 * 6. 防止缺少切換題或干擾題時產生虛假的高分。
 * 7. 提供兒童端、家長端與醫療端可直接使用的分析結果。
 */

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

const DCCS_DIFFICULTY_INFO = {
  colorIntro: {
    level: 1,
    label: "第 1 階",
    title: "看顏色",
    category: "singleRule",
    focus: "colorRule",
    minimumTrials: 3,
  },

  colorStable: {
    level: 2,
    label: "第 2 階",
    title: "顏色穩定",
    category: "singleRule",
    focus: "colorRule",
    minimumTrials: 4,
  },

  typeIntro: {
    level: 3,
    label: "第 3 階",
    title: "看衣服",
    category: "singleRule",
    focus: "typeRule",
    minimumTrials: 3,
  },

  typeStable: {
    level: 4,
    label: "第 4 階",
    title: "衣服穩定",
    category: "singleRule",
    focus: "typeRule",
    minimumTrials: 4,
  },

  switchClear: {
    level: 5,
    label: "第 5 階",
    title: "明確換規則",
    category: "switch",
    focus: "ruleSwitch",
    minimumTrials: 4,
  },

  switchEarly: {
    level: 6,
    label: "第 6 階",
    title: "提前換規則",
    category: "switch",
    focus: "ruleSwitch",
    minimumTrials: 4,
  },

  switchMaintain: {
    level: 7,
    label: "第 7 階",
    title: "切換後維持",
    category: "switch",
    focus: "ruleMaintain",
    minimumTrials: 5,
  },

  lowInterference: {
    level: 8,
    label: "第 8 階",
    title: "少量干擾",
    category: "interference",
    focus: "inhibition",
    minimumTrials: 5,
  },

  highInterference: {
    level: 9,
    label: "第 9 階",
    title: "高干擾",
    category: "interference",
    focus: "inhibition",
    minimumTrials: 5,
  },

  testLike: {
    level: 10,
    label: "第 10 階",
    title: "接近測驗",
    category: "testLike",
    focus: "testReadiness",
    minimumTrials: 6,
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

function getDifficultyIndex(difficulty) {
  const normalized = normalizeDifficulty(difficulty);
  const index = DCCS_DIFFICULTY_ORDER.indexOf(normalized);

  return index >= 0 ? index : 4;
}

function getDifficultyInfo(difficulty) {
  const normalized = normalizeDifficulty(difficulty);

  return (
    DCCS_DIFFICULTY_INFO[normalized] ||
    DCCS_DIFFICULTY_INFO.switchClear
  );
}

/* -------------------------------------------------------------------------- */
/* Trial 欄位處理                                                              */
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
    trial.userAnswerSide ??
      trial.selectedSide ??
      trial.selectedPosition ??
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
  const fields = [
    "wasAfterRuleSwitch",
    "isAfterSwitch",
    "isPostSwitch",
    "afterSwitch",
    "postSwitch",
    "hasSwitched",
  ];

  for (const field of fields) {
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

function isInterferenceTrial(trial = {}) {
  if (
    trial.isInterferenceTrial === true ||
    trial.interferenceTrial === true ||
    trial.isConflictTrial === true ||
    trial.hasConflict === true ||
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
    trial.isOldRuleInterference === true ||
    trial.isPerseverativeError === true ||
    trial.oldRuleError === true ||
    trial.followedOldRule === true ||
    trial.errorType === "old_rule" ||
    trial.errorType === "oldRule" ||
    trial.errorType === "perseverative"
  ) {
    return true;
  }

  const selectedSide = getSelectedSide(trial);
  const correctSide = getCorrectSide(trial);
  const oldRuleSide = getOldRuleSide(trial);

  return Boolean(
    selectedSide &&
      correctSide &&
      oldRuleSide &&
      selectedSide === oldRuleSide &&
      selectedSide !== correctSide
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
    const explicitPostSwitch =
      getExplicitPostSwitchValue(trial);

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

function getReactionTimeStability(reactionTimes = []) {
  const validTimes =
    filterValidReactionTimes(reactionTimes);

  const mean = average(validTimes);
  const sd = standardDeviation(validTimes);

  if (validTimes.length <= 1 || mean <= 0) {
    return {
      score: 55,
      level: "資料不足",
      mean,
      standardDeviation: sd,
      coefficientOfVariation: 0,
      validCount: validTimes.length,
      reliable: false,
    };
  }

  const coefficientOfVariation = sd / mean;

  let score = 40;
  let level = "波動較大";

  if (
    coefficientOfVariation <= 0.2 &&
    sd <= 500
  ) {
    score = 100;
    level = "非常穩定";
  } else if (
    coefficientOfVariation <= 0.35 &&
    sd <= 1000
  ) {
    score = 85;
    level = "穩定";
  } else if (
    coefficientOfVariation <= 0.5 &&
    sd <= 1800
  ) {
    score = 70;
    level = "尚可";
  } else if (
    coefficientOfVariation <= 0.7 &&
    sd <= 2500
  ) {
    score = 55;
    level = "稍有波動";
  }

  return {
    score,
    level,
    mean,
    standardDeviation: sd,
    coefficientOfVariation:
      Number.isFinite(coefficientOfVariation)
        ? coefficientOfVariation
        : 0,
    validCount: validTimes.length,
    reliable: true,
  };
}

/* -------------------------------------------------------------------------- */
/* 疲勞分析                                                                    */
/* -------------------------------------------------------------------------- */

function analyzeFatigue(trials = []) {
  if (!Array.isArray(trials) || trials.length < 6) {
    return {
      fatigueLevel: "low",
      fatigueScore: 0,

      firstHalfTrials: 0,
      secondHalfTrials: 0,

      firstHalfAccuracy: 0,
      secondHalfAccuracy: 0,

      firstHalfReactionTime: 0,
      secondHalfReactionTime: 0,

      accuracyChange: 0,
      reactionTimeChange: 0,
      reactionTimeIncreaseRatio: 0,

      hasAccuracyDecline: false,
      hasReactionTimeDecline: false,
      hasFatigueSignal: false,
      reliable: false,

      description:
        "本次題數較少，暫時沒有足夠資料判斷疲勞變化。",
    };
  }

  const midpoint = Math.ceil(trials.length / 2);

  const firstHalf = trials.slice(0, midpoint);
  const secondHalf = trials.slice(midpoint);

  const firstHalfAccuracy = safeDivide(
    firstHalf.filter(getCorrectValue).length,
    firstHalf.length
  );

  const secondHalfAccuracy = safeDivide(
    secondHalf.filter(getCorrectValue).length,
    secondHalf.length
  );

  const firstHalfReactionTime = average(
    firstHalf.map(getReactionTime)
  );

  const secondHalfReactionTime = average(
    secondHalf.map(getReactionTime)
  );

  const accuracyChange =
    secondHalfAccuracy - firstHalfAccuracy;

  const reactionTimeChange =
    firstHalfReactionTime > 0 &&
    secondHalfReactionTime > 0
      ? secondHalfReactionTime -
        firstHalfReactionTime
      : 0;

  const reactionTimeIncreaseRatio =
    firstHalfReactionTime > 0
      ? safeDivide(
          reactionTimeChange,
          firstHalfReactionTime
        )
      : 0;

  const hasAccuracyDecline =
    accuracyChange <= -0.15;

  const hasReactionTimeDecline =
    reactionTimeIncreaseRatio >= 0.2;

  let fatigueScore = 0;

  if (accuracyChange <= -0.4) {
    fatigueScore += 55;
  } else if (accuracyChange <= -0.25) {
    fatigueScore += 40;
  } else if (accuracyChange <= -0.15) {
    fatigueScore += 25;
  } else if (accuracyChange <= -0.1) {
    fatigueScore += 10;
  }

  if (reactionTimeIncreaseRatio >= 0.5) {
    fatigueScore += 45;
  } else if (reactionTimeIncreaseRatio >= 0.3) {
    fatigueScore += 30;
  } else if (reactionTimeIncreaseRatio >= 0.2) {
    fatigueScore += 20;
  } else if (reactionTimeIncreaseRatio >= 0.1) {
    fatigueScore += 10;
  }

  fatigueScore = Math.round(
    clamp(fatigueScore, 0, 100)
  );

  let fatigueLevel = "low";

  if (fatigueScore >= 65) {
    fatigueLevel = "high";
  } else if (fatigueScore >= 30) {
    fatigueLevel = "medium";
  }

  const descriptions = {
    low:
      "前後半段表現大致穩定，沒有明顯疲勞訊號。",
    medium:
      "後半段正確率或反應速度略有下降，可能開始出現疲勞。",
    high:
      "後半段表現明顯下降，建議縮短回合或安排休息。",
  };

  return {
    fatigueLevel,
    fatigueScore,

    firstHalfTrials: firstHalf.length,
    secondHalfTrials: secondHalf.length,

    firstHalfAccuracy,
    secondHalfAccuracy,

    firstHalfReactionTime,
    secondHalfReactionTime,

    accuracyChange,
    reactionTimeChange,
    reactionTimeIncreaseRatio,

    hasAccuracyDecline,
    hasReactionTimeDecline,

    hasFatigueSignal:
      fatigueLevel !== "low",

    reliable: true,

    description:
      descriptions[fatigueLevel],
  };
}

/* -------------------------------------------------------------------------- */
/* Trial 分析                                                                  */
/* -------------------------------------------------------------------------- */

function analyzeTrials(trialLogs = []) {
  const logs = Array.isArray(trialLogs)
    ? trialLogs
    : [];

  const timeline = buildSwitchTimeline(logs);

  const trials = timeline.map((entry) => entry.trial);

  const colorTrials = timeline
    .filter((entry) => entry.rule === "color")
    .map((entry) => entry.trial);

  const typeTrials = timeline
    .filter((entry) => entry.rule === "type")
    .map((entry) => entry.trial);

  const preSwitchTrials = timeline
    .filter((entry) => !entry.isPostSwitch)
    .map((entry) => entry.trial);

  const switchTrials = timeline
    .filter((entry) => entry.isPostSwitch)
    .map((entry) => entry.trial);

  const interferenceTrials =
    switchTrials.filter(isInterferenceTrial);

  const correctTrials =
    trials.filter(getCorrectValue);

  const incorrectTrials =
    trials.filter((trial) => !getCorrectValue(trial));

  const timeoutTrials =
    trials.filter(isTimeoutTrial);

  const firstTryCorrectTrials =
    trials.filter(isFirstTryCorrect);

  const explicitOldRuleErrors =
    interferenceTrials.filter(isOldRuleError);

  const fallbackOldRuleErrors =
    switchTrials.filter(isOldRuleError);

  const effectiveOldRuleErrors =
    interferenceTrials.length > 0
      ? explicitOldRuleErrors
      : fallbackOldRuleErrors;

  const totalTrials = trials.length;
  const correctCount = correctTrials.length;
  const incorrectCount = incorrectTrials.length;
  const timeoutCount = timeoutTrials.length;

  const accuracy = safeDivide(
    correctCount,
    totalTrials
  );

  const colorAccuracy = safeDivide(
    colorTrials.filter(getCorrectValue).length,
    colorTrials.length
  );

  const typeAccuracy = safeDivide(
    typeTrials.filter(getCorrectValue).length,
    typeTrials.length
  );

  const switchAccuracy = safeDivide(
    switchTrials.filter(getCorrectValue).length,
    switchTrials.length
  );

  const interferenceAccuracy = safeDivide(
    interferenceTrials.filter(getCorrectValue).length,
    interferenceTrials.length
  );

  const firstTryAccuracy = safeDivide(
    firstTryCorrectTrials.length,
    totalTrials
  );

  const perseverativeErrors =
    effectiveOldRuleErrors.length;

  const perseverativeDenominator =
    interferenceTrials.length > 0
      ? interferenceTrials.length
      : switchTrials.length;

  const hasInhibitionData =
    perseverativeDenominator > 0;

  const perseverativeErrorRate =
    hasInhibitionData
      ? safeDivide(
          perseverativeErrors,
          perseverativeDenominator
        )
      : 0;

  const interferenceControl =
    hasInhibitionData
      ? clamp(
          1 - perseverativeErrorRate,
          0,
          1
        )
      : null;

  const reactionTimes =
    filterValidReactionTimes(
      trials.map(getReactionTime)
    );

  const colorReactionTimes =
    filterValidReactionTimes(
      colorTrials.map(getReactionTime)
    );

  const typeReactionTimes =
    filterValidReactionTimes(
      typeTrials.map(getReactionTime)
    );

  const preSwitchReactionTimes =
    filterValidReactionTimes(
      preSwitchTrials.map(getReactionTime)
    );

  const switchReactionTimes =
    filterValidReactionTimes(
      switchTrials.map(getReactionTime)
    );

  const interferenceReactionTimes =
    filterValidReactionTimes(
      interferenceTrials.map(getReactionTime)
    );

  const avgReactionTime =
    average(reactionTimes);

  const colorAvgReactionTime =
    average(colorReactionTimes);

  const typeAvgReactionTime =
    average(typeReactionTimes);

  const preSwitchAvgReactionTime =
    average(preSwitchReactionTimes);

  const switchAvgReactionTime =
    average(switchReactionTimes);

  const interferenceAvgReactionTime =
    average(interferenceReactionTimes);

  const switchCost =
    preSwitchAvgReactionTime > 0 &&
    switchAvgReactionTime > 0
      ? switchAvgReactionTime -
        preSwitchAvgReactionTime
      : 0;

  const switchCostRatio =
    preSwitchAvgReactionTime > 0 &&
    switchAvgReactionTime > 0
      ? safeDivide(
          switchCost,
          preSwitchAvgReactionTime
        )
      : 0;

  const stability =
    getReactionTimeStability(reactionTimes);

  return {
    trials,
    timeline,

    totalTrials,
    correctCount,
    incorrectCount,
    timeoutCount,

    colorTrials: colorTrials.length,
    typeTrials: typeTrials.length,
    preSwitchTrials: preSwitchTrials.length,
    switchTrials: switchTrials.length,
    postSwitchTrials: switchTrials.length,
    interferenceTrials:
      interferenceTrials.length,

    accuracy,
    colorAccuracy,
    typeAccuracy,
    switchAccuracy,
    postSwitchAccuracy: switchAccuracy,
    interferenceAccuracy,
    firstTryAccuracy,

    perseverativeErrors,
    oldRuleInterference:
      perseverativeErrors,

    perseverativeErrorRate,
    interferenceControl,
    hasInhibitionData,

    avgReactionTime,
    colorAvgReactionTime,
    typeAvgReactionTime,
    preSwitchAvgReactionTime,
    switchAvgReactionTime,
    postSwitchAvgReactionTime:
      switchAvgReactionTime,
    interferenceAvgReactionTime,

    switchCost,
    rtDifferenceAfterSwitch:
      switchCost,
    switchCostRatio,

    reactionTimeStandardDeviation:
      stability.standardDeviation,

    reactionTimeCv:
      stability.coefficientOfVariation,

    reactionTimeValidCount:
      stability.validCount,

    responseStabilityScore:
      stability.score,

    responseStabilityLevel:
      stability.level,

    reactionTimeReliable:
      stability.reliable,

    bestStreak:
      getBestStreak(trials),

    fatigue:
      analyzeFatigue(trials),
  };
}

/* -------------------------------------------------------------------------- */
/* 摘要欄位與 trial logs 合併                                                  */
/* -------------------------------------------------------------------------- */

function readRatio(input, keys, fallback = 0) {
  const keyList = Array.isArray(keys)
    ? keys
    : [keys];

  for (const key of keyList) {
    if (isFiniteNumber(input?.[key])) {
      return normalizeRatio(input[key]);
    }
  }

  return normalizeRatio(fallback);
}

function readCount(input, keys, fallback = 0) {
  const keyList = Array.isArray(keys)
    ? keys
    : [keys];

  for (const key of keyList) {
    if (isFiniteNumber(input?.[key])) {
      return safeInteger(input[key], fallback);
    }
  }

  return safeInteger(fallback, 0);
}

function readTime(input, keys, fallback = 0) {
  const keyList = Array.isArray(keys)
    ? keys
    : [keys];

  for (const key of keyList) {
    if (isFiniteNumber(input?.[key])) {
      return Math.max(0, input[key]);
    }
  }

  return Math.max(0, safeNumber(fallback, 0));
}

function mergeProvidedMetrics(analyzed, input = {}) {
  const hasTrialData =
    analyzed.totalTrials > 0;

  const reportedTotalTrials = readCount(
    input,
    ["totalTrials", "trialCount", "completedTrials"],
    0
  );

  const totalTrials = hasTrialData
    ? analyzed.totalTrials
    : reportedTotalTrials;

  const reportedCorrectCount = readCount(
    input,
    ["correctTrials", "correctCount", "correctAnswers"],
    0
  );

  const correctCount = hasTrialData
    ? analyzed.correctCount
    : Math.min(
        reportedCorrectCount,
        totalTrials
      );

  const incorrectCount = hasTrialData
    ? analyzed.incorrectCount
    : Math.max(0, totalTrials - correctCount);

  const accuracy = hasTrialData
    ? analyzed.accuracy
    : readRatio(
        input,
        ["accuracy", "accuracyRatio"],
        totalTrials > 0
          ? safeDivide(correctCount, totalTrials)
          : 0
      );

  const colorTrials = hasTrialData
    ? analyzed.colorTrials
    : readCount(input, "colorTrials", 0);

  const typeTrials = hasTrialData
    ? analyzed.typeTrials
    : readCount(input, "typeTrials", 0);

  const switchTrials = hasTrialData
    ? analyzed.switchTrials
    : readCount(
        input,
        ["switchTrials", "postSwitchTrials"],
        0
      );

  const interferenceTrials = hasTrialData
    ? analyzed.interferenceTrials
    : readCount(
        input,
        "interferenceTrials",
        0
      );

  const colorAccuracy =
    analyzed.colorTrials > 0
      ? analyzed.colorAccuracy
      : readRatio(
          input,
          ["colorAccuracy", "colorAccuracyRatio"],
          0
        );

  const typeAccuracy =
    analyzed.typeTrials > 0
      ? analyzed.typeAccuracy
      : readRatio(
          input,
          ["typeAccuracy", "typeAccuracyRatio"],
          0
        );

  const switchAccuracy =
    analyzed.switchTrials > 0
      ? analyzed.switchAccuracy
      : readRatio(
          input,
          [
            "switchAccuracy",
            "postSwitchAccuracy",
            "switchAccuracyRatio",
          ],
          0
        );

  const interferenceAccuracy =
    analyzed.interferenceTrials > 0
      ? analyzed.interferenceAccuracy
      : readRatio(
          input,
          [
            "interferenceAccuracy",
            "interferenceAccuracyRatio",
          ],
          0
        );

  const firstTryAccuracy = hasTrialData
    ? analyzed.firstTryAccuracy
    : readRatio(
        input,
        [
          "firstTryAccuracy",
          "firstTryAccuracyRatio",
        ],
        accuracy
      );

  const perseverativeErrors =
    analyzed.switchTrials > 0
      ? analyzed.perseverativeErrors
      : readCount(
          input,
          [
            "perseverativeErrors",
            "oldRuleInterference",
          ],
          0
        );

  const perseverativeDenominator =
    interferenceTrials > 0
      ? interferenceTrials
      : switchTrials;

  const hasInhibitionData =
    analyzed.hasInhibitionData ||
    perseverativeDenominator > 0;

  const perseverativeErrorRate =
    hasInhibitionData
      ? readRatio(
          input,
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
          input,
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

  const avgReactionTime =
    readTime(
      input,
      "avgReactionTime",
      analyzed.avgReactionTime
    );

  const preSwitchAvgReactionTime =
    readTime(
      input,
      "preSwitchAvgReactionTime",
      analyzed.preSwitchAvgReactionTime
    );

  const colorAvgReactionTime =
    readTime(
      input,
      "colorAvgReactionTime",
      analyzed.colorAvgReactionTime
    );

  const typeAvgReactionTime =
    readTime(
      input,
      "typeAvgReactionTime",
      analyzed.typeAvgReactionTime
    );

  const switchAvgReactionTime =
    readTime(
      input,
      [
        "switchAvgReactionTime",
        "postSwitchAvgReactionTime",
      ],
      analyzed.switchAvgReactionTime
    );

  const switchCost =
    isFiniteNumber(input.switchCost)
      ? input.switchCost
      : isFiniteNumber(
          input.rtDifferenceAfterSwitch
        )
      ? input.rtDifferenceAfterSwitch
      : analyzed.switchCost;

  const switchCostRatio =
    isFiniteNumber(input.switchCostRatio)
      ? input.switchCostRatio
      : preSwitchAvgReactionTime > 0 &&
        switchAvgReactionTime > 0
      ? safeDivide(
          switchCost,
          preSwitchAvgReactionTime
        )
      : analyzed.switchCostRatio;

  const responseStabilityScore =
    isFiniteNumber(
      input.responseStabilityScore
    )
      ? clamp(
          input.responseStabilityScore,
          0,
          100
        )
      : analyzed.responseStabilityScore;

  const reactionTimeStandardDeviation =
    readTime(
      input,
      [
        "reactionTimeStandardDeviation",
        "reactionTimeStd",
      ],
      analyzed.reactionTimeStandardDeviation
    );

  const reactionTimeCv =
    isFiniteNumber(input.reactionTimeCv)
      ? Math.max(0, input.reactionTimeCv)
      : analyzed.reactionTimeCv;

  const reactionTimeReliable =
    typeof input.reactionTimeReliable ===
    "boolean"
      ? input.reactionTimeReliable
      : typeof input.reactionTimeCvReliable ===
        "boolean"
      ? input.reactionTimeCvReliable
      : analyzed.reactionTimeReliable;

  const fatigue =
    input.fatigueResult &&
    typeof input.fatigueResult === "object"
      ? {
          ...analyzed.fatigue,
          ...input.fatigueResult,
        }
      : analyzed.fatigue;

  if (
    typeof input.fatigueLevel === "string"
  ) {
    fatigue.fatigueLevel =
      input.fatigueLevel;
  }

  return {
    ...analyzed,

    totalTrials,
    correctCount,
    incorrectCount,

    timeoutCount: readCount(
      input,
      ["timeoutCount", "timeouts"],
      analyzed.timeoutCount
    ),

    colorTrials,
    typeTrials,
    switchTrials,
    postSwitchTrials: switchTrials,
    interferenceTrials,

    accuracy,
    colorAccuracy,
    typeAccuracy,
    switchAccuracy,
    postSwitchAccuracy: switchAccuracy,
    interferenceAccuracy,
    firstTryAccuracy,

    perseverativeErrors,
    oldRuleInterference:
      perseverativeErrors,

    perseverativeErrorRate,
    interferenceControl,
    hasInhibitionData,

    avgReactionTime,
    preSwitchAvgReactionTime,
    colorAvgReactionTime,
    typeAvgReactionTime,
    switchAvgReactionTime,
    postSwitchAvgReactionTime:
      switchAvgReactionTime,

    switchCost,
    rtDifferenceAfterSwitch:
      switchCost,
    switchCostRatio,

    responseStabilityScore,

    responseStabilityLevel:
      input.responseStabilityLevel ||
      analyzed.responseStabilityLevel,

    reactionTimeStandardDeviation,
    reactionTimeCv,
    reactionTimeReliable,

    bestStreak:
      readCount(
        input,
        "bestStreak",
        analyzed.bestStreak
      ),

    fatigue,

    reportedTotalTrials,
    hasTrialData,
  };
}

/* -------------------------------------------------------------------------- */
/* 能力分數                                                                    */
/* -------------------------------------------------------------------------- */

function calculateRuleUnderstanding(
  metrics,
  difficulty
) {
  const info = getDifficultyInfo(difficulty);

  if (info.focus === "colorRule") {
    return metrics.colorTrials > 0
      ? metrics.colorAccuracy
      : metrics.accuracy;
  }

  if (info.focus === "typeRule") {
    return metrics.typeTrials > 0
      ? metrics.typeAccuracy
      : metrics.accuracy;
  }

  if (
    metrics.colorTrials > 0 &&
    metrics.typeTrials > 0
  ) {
    return (
      metrics.colorAccuracy +
      metrics.typeAccuracy
    ) / 2;
  }

  if (metrics.typeTrials > 0) {
    return metrics.typeAccuracy;
  }

  if (metrics.colorTrials > 0) {
    return metrics.colorAccuracy;
  }

  return metrics.accuracy;
}

function calculateAbilityScores(
  metrics,
  difficulty
) {
  const info = getDifficultyInfo(difficulty);

  const ruleUnderstandingRatio =
    calculateRuleUnderstanding(
      metrics,
      difficulty
    );

  const flexibilityRatio =
    metrics.switchTrials > 0
      ? metrics.switchAccuracy
      : null;

  const inhibitionRatio =
    metrics.hasInhibitionData &&
    metrics.interferenceControl !== null
      ? metrics.interferenceControl
      : null;

  const stabilityRatio =
    clamp(
      metrics.responseStabilityScore,
      0,
      100
    ) / 100;

  let compositeScore = 0;
  let activeWeight = 0;

  function addComponent(value, weight) {
    if (
      value === null ||
      !isFiniteNumber(value) ||
      weight <= 0
    ) {
      return;
    }

    compositeScore +=
      normalizeRatio(value) * 100 * weight;

    activeWeight += weight;
  }

  if (info.category === "singleRule") {
    addComponent(
      ruleUnderstandingRatio,
      0.7
    );

    addComponent(
      metrics.firstTryAccuracy,
      0.2
    );

    addComponent(
      stabilityRatio,
      0.1
    );
  } else if (info.category === "switch") {
    addComponent(
      metrics.accuracy,
      0.2
    );

    addComponent(
      flexibilityRatio,
      0.45
    );

    addComponent(
      metrics.firstTryAccuracy,
      0.15
    );

    addComponent(
      inhibitionRatio,
      0.1
    );

    addComponent(
      stabilityRatio,
      0.1
    );
  } else if (
    info.category === "interference"
  ) {
    addComponent(
      metrics.accuracy,
      0.15
    );

    addComponent(
      flexibilityRatio,
      0.25
    );

    addComponent(
      inhibitionRatio,
      0.3
    );

    addComponent(
      metrics.interferenceTrials > 0
        ? metrics.interferenceAccuracy
        : null,
      0.2
    );

    addComponent(
      stabilityRatio,
      0.1
    );
  } else {
    addComponent(
      metrics.accuracy,
      0.2
    );

    addComponent(
      flexibilityRatio,
      0.35
    );

    addComponent(
      inhibitionRatio,
      0.2
    );

    addComponent(
      metrics.interferenceTrials > 0
        ? metrics.interferenceAccuracy
        : null,
      0.1
    );

    addComponent(
      metrics.firstTryAccuracy,
      0.1
    );

    addComponent(
      stabilityRatio,
      0.05
    );
  }

  const overallScore =
    activeWeight > 0
      ? Math.round(
          clamp(
            compositeScore / activeWeight,
            0,
            100
          )
        )
      : 0;

  return {
    ruleUnderstanding:
      toPercent(ruleUnderstandingRatio),

    cognitiveFlexibility:
      flexibilityRatio === null
        ? null
        : toPercent(flexibilityRatio),

    inhibitionControl:
      inhibitionRatio === null
        ? null
        : toPercent(inhibitionRatio),

    interferenceAccuracy:
      metrics.interferenceTrials > 0
        ? toPercent(
            metrics.interferenceAccuracy
          )
        : null,

    firstTryAccuracy:
      toPercent(metrics.firstTryAccuracy),

    responseStability:
      Math.round(
        clamp(
          metrics.responseStabilityScore,
          0,
          100
        )
      ),

    overallScore,
  };
}

/* -------------------------------------------------------------------------- */
/* 表現等級                                                                    */
/* -------------------------------------------------------------------------- */

function getPerformanceBand(
  abilityScores,
  hasEnoughTrials
) {
  if (!hasEnoughTrials) {
    return {
      level: "insufficientData",
      label: "資料不足",
      description:
        "本次有效題數較少，暫時不建議單獨使用此結果判斷能力。",
    };
  }

  const score = abilityScores.overallScore;

  if (score >= 85) {
    return {
      level: "excellent",
      label: "表現穩定",
      description:
        "能穩定理解目前規則，並在需要時調整分類方式。",
    };
  }

  if (score >= 70) {
    return {
      level: "good",
      label: "表現良好",
      description:
        "大部分題目能正確完成，少數切換或干擾題仍需要確認。",
    };
  }

  if (score >= 55) {
    return {
      level: "developing",
      label: "持續發展中",
      description:
        "已具備部分分類能力，但規則切換或抑制舊規則仍不穩定。",
    };
  }

  return {
    level: "needsSupport",
    label: "需要更多支持",
    description:
      "目前對分類規則或玩法切換較容易混淆，建議降低難度並增加提示。",
  };
}

/* -------------------------------------------------------------------------- */
/* 資料品質                                                                    */
/* -------------------------------------------------------------------------- */

function calculateDataQuality(
  metrics,
  difficulty
) {
  const info = getDifficultyInfo(difficulty);

  const minimumRecommendedTrials =
    info.minimumTrials;

  const hasEnoughTrials =
    metrics.totalTrials >=
    minimumRecommendedTrials;

  const countMismatch =
    metrics.hasTrialData &&
    metrics.reportedTotalTrials > 0 &&
    metrics.reportedTotalTrials !==
      metrics.totalTrials;

  let confidence = 25;

  if (hasEnoughTrials) {
    confidence += 25;
  }

  if (
    metrics.totalTrials >=
    minimumRecommendedTrials + 2
  ) {
    confidence += 15;
  }

  if (metrics.reactionTimeReliable) {
    confidence += 15;
  } else if (
    metrics.reactionTimeValidCount >= 2
  ) {
    confidence += 8;
  }

  if (metrics.switchTrials >= 2) {
    confidence += 10;
  }

  if (metrics.interferenceTrials >= 2) {
    confidence += 10;
  }

  if (countMismatch) {
    confidence -= 10;
  }

  if (
    info.category !== "singleRule" &&
    metrics.switchTrials === 0
  ) {
    confidence = Math.min(confidence, 40);
  }

  if (
    (info.category === "interference" ||
      info.category === "testLike") &&
    metrics.interferenceTrials === 0
  ) {
    confidence = Math.min(confidence, 45);
  }

  return {
    hasEnoughTrials,
    minimumRecommendedTrials,

    actualTrialCount:
      metrics.totalTrials,

    reportedTrialCount:
      metrics.reportedTotalTrials,

    countMismatch,

    hasSwitchData:
      metrics.switchTrials > 0,

    hasInterferenceData:
      metrics.interferenceTrials > 0,

    hasInhibitionData:
      metrics.hasInhibitionData,

    reactionTimeReliable:
      metrics.reactionTimeReliable,

    confidence: Math.round(
      clamp(confidence, 0, 100)
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* 難度調整                                                                    */
/* -------------------------------------------------------------------------- */

function determineAdjustment({
  metrics,
  abilityScores,
  difficulty,
  dataQuality,
}) {
  const currentIndex =
    getDifficultyIndex(difficulty);

  const currentDifficulty =
    DCCS_DIFFICULTY_ORDER[currentIndex];

  const info =
    getDifficultyInfo(currentDifficulty);

  const requiresSwitch =
    info.category !== "singleRule";

  const requiresInterference =
    info.category === "interference" ||
    info.category === "testLike";

  const fatigueLevel =
    metrics.fatigue?.fatigueLevel ||
    "low";

  const reasons = [];

  if (!dataQuality.hasEnoughTrials) {
    return {
      adjustment: "maintain",
      levelChange: 0,

      currentDifficulty,
      currentDifficultyIndex:
        currentIndex,

      recommendedDifficulty:
        currentDifficulty,

      recommendedDifficultyIndex:
        currentIndex,

      currentDifficultyInfo:
        info,

      recommendedDifficultyInfo:
        info,

      reasons: [
        "本次有效題數不足，先維持目前難度並累積更多資料",
      ],
    };
  }

  const lowOverall =
    abilityScores.overallScore < 52;

  const strongOverall =
    abilityScores.overallScore >= 83;

  const lowAccuracy =
    metrics.accuracy < 0.55;

  const strongAccuracy =
    metrics.accuracy >= 0.8;

  const missingSwitchData =
    requiresSwitch &&
    metrics.switchTrials === 0;

  const switchWeak =
    requiresSwitch &&
    metrics.switchTrials > 0 &&
    metrics.switchAccuracy < 0.5;

  const switchReady =
    !requiresSwitch ||
    (
      metrics.switchTrials > 0 &&
      metrics.switchAccuracy >= 0.7
    );

  const missingInterferenceData =
    requiresInterference &&
    metrics.interferenceTrials === 0;

  const inhibitionWeak =
    requiresInterference &&
    metrics.hasInhibitionData &&
    metrics.interferenceControl !== null &&
    metrics.interferenceControl < 0.5;

  const inhibitionReady =
    !requiresInterference ||
    (
      metrics.interferenceTrials > 0 &&
      metrics.interferenceControl !== null &&
      metrics.interferenceControl >= 0.75 &&
      metrics.interferenceAccuracy >= 0.65
    );

  const tooManyOldRuleErrors =
    metrics.perseverativeErrors >= 3 ||
    (
      metrics.hasInhibitionData &&
      metrics.perseverativeErrorRate >= 0.5
    );

  const poorStability =
    metrics.responseStabilityScore < 50;

  const highFatigue =
    fatigueLevel === "high";

  const mediumFatigue =
    fatigueLevel === "medium";

  let adjustment = "maintain";
  let levelChange = 0;

  if (highFatigue) {
    adjustment = "decrease";
    levelChange = -1;

    reasons.push(
      "後半段表現明顯下降，可能已經疲勞"
    );
  } else if (
    lowOverall ||
    lowAccuracy ||
    switchWeak ||
    inhibitionWeak ||
    tooManyOldRuleErrors
  ) {
    adjustment = "decrease";
    levelChange = -1;

    if (lowOverall) {
      reasons.push(
        "目前綜合能力分數低於此難度的穩定標準"
      );
    }

    if (lowAccuracy) {
      reasons.push(
        "整體正確率低於目前難度需求"
      );
    }

    if (switchWeak) {
      reasons.push(
        "玩法改變後的正確率偏低"
      );
    }

    if (inhibitionWeak) {
      reasons.push(
        "容易受到前一個玩法干擾"
      );
    }

    if (tooManyOldRuleErrors) {
      reasons.push(
        "舊規則固著錯誤比例偏高"
      );
    }
  } else if (
    strongOverall &&
    strongAccuracy &&
    switchReady &&
    inhibitionReady &&
    fatigueLevel === "low" &&
    !poorStability &&
    !missingSwitchData &&
    !missingInterferenceData
  ) {
    adjustment = "increase";
    levelChange = 1;

    reasons.push(
      "目前難度下的正確率與核心能力皆表現穩定"
    );
  } else {
    adjustment = "maintain";
    levelChange = 0;

    if (missingSwitchData) {
      reasons.push(
        "目前難度需要切換題，但本次沒有足夠切換資料"
      );
    } else if (missingInterferenceData) {
      reasons.push(
        "目前難度需要干擾題，但本次沒有足夠干擾資料"
      );
    } else if (mediumFatigue) {
      reasons.push(
        "表現尚可，但後半段已有輕微疲勞訊號"
      );
    } else if (poorStability) {
      reasons.push(
        "正確率尚可，但作答反應波動較大"
      );
    } else {
      reasons.push(
        "目前表現適合維持相同難度繼續鞏固"
      );
    }
  }

  const nextIndex = clamp(
    currentIndex + levelChange,
    0,
    DCCS_DIFFICULTY_ORDER.length - 1
  );

  const nextDifficulty =
    DCCS_DIFFICULTY_ORDER[nextIndex];

  return {
    adjustment,

    levelChange:
      nextIndex - currentIndex,

    currentDifficulty,
    currentDifficultyIndex:
      currentIndex,

    recommendedDifficulty:
      nextDifficulty,

    recommendedDifficultyIndex:
      nextIndex,

    currentDifficultyInfo:
      getDifficultyInfo(
        currentDifficulty
      ),

    recommendedDifficultyInfo:
      getDifficultyInfo(
        nextDifficulty
      ),

    reasons,
  };
}

/* -------------------------------------------------------------------------- */
/* 優勢與練習需求                                                              */
/* -------------------------------------------------------------------------- */

function getStrengths(
  metrics,
  abilityScores
) {
  const strengths = [];

  if (
    abilityScores.ruleUnderstanding >= 80
  ) {
    strengths.push({
      key: "ruleUnderstanding",
      title: "規則理解穩定",
      description:
        "能理解目前要依照顏色或衣服種類進行分類。",
    });
  }

  if (
    abilityScores.cognitiveFlexibility !==
      null &&
    abilityScores.cognitiveFlexibility >= 75
  ) {
    strengths.push({
      key: "cognitiveFlexibility",
      title: "換玩法能力良好",
      description:
        "玩法改變後，能調整並套用新的分類規則。",
    });
  }

  if (
    abilityScores.inhibitionControl !==
      null &&
    abilityScores.inhibitionControl >= 75
  ) {
    strengths.push({
      key: "inhibitionControl",
      title: "能抑制舊玩法",
      description:
        "不容易被前一個分類規則影響。",
    });
  }

  if (
    metrics.interferenceTrials > 0 &&
    metrics.interferenceAccuracy >= 0.75
  ) {
    strengths.push({
      key: "interferenceAccuracy",
      title: "干擾題表現良好",
      description:
        "面對新舊規則衝突時，仍能選擇正確的分類方式。",
    });
  }

  if (
    metrics.firstTryAccuracy >= 0.8
  ) {
    strengths.push({
      key: "firstTryAccuracy",
      title: "第一次判斷正確率高",
      description:
        "多數題目不需要反覆嘗試就能作答。",
    });
  }

  if (
    metrics.responseStabilityScore >= 80 &&
    metrics.reactionTimeReliable
  ) {
    strengths.push({
      key: "responseStability",
      title: "作答反應穩定",
      description:
        "整體反應速度的波動較小。",
    });
  }

  if (strengths.length === 0) {
    strengths.push({
      key: "participation",
      title: "完成本次練習",
      description:
        "孩子已完成目前訓練，可持續從多次結果觀察進步。",
    });
  }

  return strengths;
}

function getNeedsPractice(
  metrics,
  abilityScores,
  difficulty,
  dataQuality
) {
  const needsPractice = [];
  const info = getDifficultyInfo(difficulty);

  if (!dataQuality.hasEnoughTrials) {
    needsPractice.push({
      key: "moreData",
      title: "再完成一個短回合",
      description:
        "本次有效題數較少，建議在孩子狀態穩定時再完成一個短回合。",
      priority: "medium",
    });
  }

  if (
    abilityScores.ruleUnderstanding < 60
  ) {
    needsPractice.push({
      key: "ruleUnderstanding",
      title: "加強規則理解",
      description:
        "建議先使用單一規則，並清楚提醒要看顏色還是衣服種類。",
      priority: "high",
    });
  }

  if (
    info.category !== "singleRule" &&
    abilityScores.cognitiveFlexibility !==
      null &&
    abilityScores.cognitiveFlexibility < 60
  ) {
    needsPractice.push({
      key: "cognitiveFlexibility",
      title: "加強玩法切換",
      description:
        "玩法改變時可增加明確提示，並先練習少量切換題。",
      priority: "high",
    });
  }

  if (
    metrics.perseverativeErrors >= 2 ||
    (
      abilityScores.inhibitionControl !==
        null &&
      abilityScores.inhibitionControl < 60
    )
  ) {
    needsPractice.push({
      key: "inhibitionControl",
      title: "減少舊玩法干擾",
      description:
        "換玩法時可先停一下，讓孩子說出新規則後再作答。",
      priority:
        metrics.perseverativeErrors >= 3
          ? "high"
          : "medium",
    });
  }

  if (
    metrics.interferenceTrials > 0 &&
    metrics.interferenceAccuracy < 0.55
  ) {
    needsPractice.push({
      key: "interferenceAccuracy",
      title: "加強干擾題判斷",
      description:
        "可先降低干擾題比例，讓孩子逐步熟悉新舊規則不同的情境。",
      priority: "high",
    });
  }

  if (
    metrics.firstTryAccuracy < 0.6
  ) {
    needsPractice.push({
      key: "firstTryAccuracy",
      title: "增加作答前確認",
      description:
        "鼓勵孩子先觀察卡片，再選擇正確的籃子。",
      priority: "medium",
    });
  }

  if (
    metrics.responseStabilityScore < 55 &&
    metrics.reactionTimeReliable
  ) {
    needsPractice.push({
      key: "responseStability",
      title: "提升反應穩定度",
      description:
        "建議縮短每回合題數，不急著作答並維持穩定節奏。",
      priority: "medium",
    });
  }

  if (
    metrics.fatigue?.fatigueLevel === "high"
  ) {
    needsPractice.push({
      key: "fatigue",
      title: "縮短訓練時間",
      description:
        "後半段表現明顯下降，建議降低單次題數或安排休息。",
      priority: "high",
    });
  }

  if (needsPractice.length === 0) {
    needsPractice.push({
      key: "consolidation",
      title: "持續鞏固",
      description:
        "目前沒有明顯弱項，可維持短回合練習並逐步增加難度。",
      priority: "low",
    });
  }

  return needsPractice;
}

/* -------------------------------------------------------------------------- */
/* 回饋文字                                                                    */
/* -------------------------------------------------------------------------- */

function getParentFeedback({
  performanceBand,
  adjustment,
  metrics,
  dataQuality,
}) {
  if (!dataQuality.hasEnoughTrials) {
    return {
      title: "再多觀察一次",
      summary:
        "本次完成的有效題數較少，暫時不適合只根據這一次結果判斷能力。",
      suggestion:
        "可在孩子精神較穩定時，再完成一個短回合並比較兩次表現。",
    };
  }

  if (
    adjustment.adjustment === "increase"
  ) {
    return {
      title: "可以嘗試下一個難度",
      summary:
        "孩子在目前玩法中表現穩定，能理解規則並完成分類。",
      suggestion:
        "可逐步增加換玩法或干擾題，仍以短回合為主。",
    };
  }

  if (
    adjustment.adjustment === "decrease"
  ) {
    if (
      metrics.fatigue?.fatigueLevel ===
      "high"
    ) {
      return {
        title: "先休息或縮短回合",
        summary:
          "孩子後半段的表現下降，可能是訓練時間較長或開始疲勞。",
        suggestion:
          "可先休息，再用較少題數或較簡單玩法重新練習。",
      };
    }

    if (
      metrics.perseverativeErrors >= 2
    ) {
      return {
        title: "換玩法時需要更多提示",
        summary:
          "孩子在規則改變後，仍可能依照前一個玩法進行分類。",
        suggestion:
          "換玩法時先停一下，清楚提醒新規則，再讓孩子開始作答。",
      };
    }

    return {
      title: "先回到較簡單的玩法",
      summary:
        "孩子目前對分類規則或玩法切換仍容易混淆。",
      suggestion:
        "建議先練習單一規則，熟悉後再慢慢加入玩法切換。",
    };
  }

  return {
    title: performanceBand.label,
    summary:
      "孩子目前的表現適合維持相同難度，繼續練習規則理解與玩法切換。",
    suggestion:
      "可保持每次短時間練習，等表現更穩定後再提高難度。",
  };
}

function getClinicianInterpretation({
  metrics,
  abilityScores,
  adjustment,
  dataQuality,
}) {
  const observations = [];

  observations.push(
    `整體正確率為 ${toPercent(
      metrics.accuracy
    )}%，第一次答對率為 ${toPercent(
      metrics.firstTryAccuracy
    )}%。`
  );

  if (metrics.colorTrials > 0) {
    observations.push(
      `顏色規則正確率為 ${toPercent(
        metrics.colorAccuracy
      )}%。`
    );
  }

  if (metrics.typeTrials > 0) {
    observations.push(
      `衣服種類規則正確率為 ${toPercent(
        metrics.typeAccuracy
      )}%。`
    );
  }

  if (metrics.switchTrials > 0) {
    observations.push(
      `切換後正確率為 ${toPercent(
        metrics.switchAccuracy
      )}%，切換成本為 ${
        metrics.switchCost
      } ms。`
    );
  } else {
    observations.push(
      "本次沒有足夠切換題，無法完整評估規則轉換能力。"
    );
  }

  if (metrics.hasInhibitionData) {
    observations.push(
      `固著錯誤共 ${
        metrics.perseverativeErrors
      } 次，固著錯誤率為 ${toPercent(
        metrics.perseverativeErrorRate
      )}%，抑制控制指標為 ${
        metrics.interferenceControl === null
          ? "無資料"
          : `${toPercent(
              metrics.interferenceControl
            )}%`
      }。`
    );
  } else {
    observations.push(
      "本次沒有足夠舊規則干擾資料，抑制控制不列為主要判讀指標。"
    );
  }

  observations.push(
    `平均反應時間為 ${
      metrics.avgReactionTime
    } ms，反應穩定度為 ${
      metrics.responseStabilityScore
    } 分。`
  );

  observations.push(
    `本次資料信心度為 ${
      dataQuality.confidence
    }%，有效題數為 ${
      dataQuality.actualTrialCount
    } 題。`
  );

  return {
    overview:
      `DCCS 訓練綜合表現為 ${
        abilityScores.overallScore
      } 分。`,

    observations,

    recommendation:
      adjustment.adjustment === "increase"
        ? "目前表現符合升級條件，可逐步增加規則切換或干擾比例。"
        : adjustment.adjustment ===
          "decrease"
        ? "目前表現未達此難度的穩定標準，建議降低一階並增加規則提示。"
        : "建議維持目前難度，以重複練習確認表現穩定性。",

    fatigueObservation:
      metrics.fatigue.description,

    dataQualityObservation:
      dataQuality.countMismatch
        ? "系統回報題數與逐題紀錄題數不一致，建議檢查資料儲存流程。"
        : "逐題紀錄與摘要資料未發現明顯題數衝突。",
  };
}

/* -------------------------------------------------------------------------- */
/* 主分析函式                                                                  */
/* -------------------------------------------------------------------------- */

export function analyzeDccsTraining(input = {}) {
  const trialLogs = Array.isArray(input.trialLogs)
    ? input.trialLogs
    : Array.isArray(input.records)
    ? input.records
    : Array.isArray(input.logs)
    ? input.logs
    : Array.isArray(input.trials)
    ? input.trials
    : [];

  const difficulty = normalizeDifficulty(
    input.difficultyLevel ||
      input.trainingDifficulty ||
      input.difficulty ||
      input.levelId ||
      input.currentDifficulty ||
      input.currentTrainingLevel ||
      "switchClear"
  );

  const analyzed = analyzeTrials(trialLogs);

  const metrics = mergeProvidedMetrics(
    analyzed,
    input
  );

  const dataQuality =
    calculateDataQuality(
      metrics,
      difficulty
    );

  const abilityScores =
    calculateAbilityScores(
      metrics,
      difficulty
    );

  const performanceBand =
    getPerformanceBand(
      abilityScores,
      dataQuality.hasEnoughTrials
    );

  const adjustment =
    determineAdjustment({
      metrics,
      abilityScores,
      difficulty,
      dataQuality,
    });

  const strengths =
    getStrengths(
      metrics,
      abilityScores
    );

  const needsPractice =
    getNeedsPractice(
      metrics,
      abilityScores,
      difficulty,
      dataQuality
    );

  const parentFeedback =
    getParentFeedback({
      performanceBand,
      adjustment,
      metrics,
      dataQuality,
    });

  const clinicianInterpretation =
    getClinicianInterpretation({
      metrics,
      abilityScores,
      adjustment,
      dataQuality,
    });

  const currentDifficultyInfo =
    getDifficultyInfo(difficulty);

  const recommendedDifficultyInfo =
    getDifficultyInfo(
      adjustment.recommendedDifficulty
    );

  return {
    gameId: "DCCS",
    task: "DCCS",
    abilityType: "cognitiveFlexibility",
    mode: "training",

    difficulty,
    currentDifficulty: difficulty,

    difficultyLevel:
      currentDifficultyInfo.level,

    currentTrainingLevel:
      currentDifficultyInfo.level,

    difficultyLabel:
      currentDifficultyInfo.label,

    difficultyTitle:
      currentDifficultyInfo.title,

    difficultyCategory:
      currentDifficultyInfo.category,

    abilityFocus:
      currentDifficultyInfo.focus,

    recommendedDifficulty:
      adjustment.recommendedDifficulty,

    recommendedDifficultyLevel:
      recommendedDifficultyInfo.level,

    recommendedDifficultyLabel:
      recommendedDifficultyInfo.label,

    recommendedDifficultyTitle:
      recommendedDifficultyInfo.title,

    recommendedDifficultyCategory:
      recommendedDifficultyInfo.category,

    nextRecommendedDccsLevel:
      recommendedDifficultyInfo.level,

    nextRecommendedDifficulty:
      adjustment.recommendedDifficulty,

    adjustment:
      adjustment.adjustment,

    levelChange:
      adjustment.levelChange,

    adjustmentReasons:
      adjustment.reasons,

    shouldIncreaseDifficulty:
      adjustment.adjustment === "increase",

    shouldDecreaseDifficulty:
      adjustment.adjustment === "decrease",

    shouldMaintainDifficulty:
      adjustment.adjustment === "maintain",

    overallScore:
      abilityScores.overallScore,

    performanceLevel:
      performanceBand.level,

    performanceLabel:
      performanceBand.label,

    performanceDescription:
      performanceBand.description,

    abilityScores,

    totalTrials:
      metrics.totalTrials,

    correctTrials:
      metrics.correctCount,

    correctCount:
      metrics.correctCount,

    incorrectTrials:
      metrics.incorrectCount,

    incorrectCount:
      metrics.incorrectCount,

    timeoutCount:
      metrics.timeoutCount,

    accuracy:
      toPercent(metrics.accuracy),

    accuracyRatio:
      metrics.accuracy,

    colorTrials:
      metrics.colorTrials,

    colorAccuracy:
      toPercent(
        metrics.colorAccuracy
      ),

    colorAccuracyRatio:
      metrics.colorAccuracy,

    typeTrials:
      metrics.typeTrials,

    typeAccuracy:
      toPercent(
        metrics.typeAccuracy
      ),

    typeAccuracyRatio:
      metrics.typeAccuracy,

    preSwitchTrials:
      metrics.preSwitchTrials,

    switchTrials:
      metrics.switchTrials,

    postSwitchTrials:
      metrics.postSwitchTrials,

    switchAccuracy:
      toPercent(
        metrics.switchAccuracy
      ),

    postSwitchAccuracy:
      toPercent(
        metrics.postSwitchAccuracy
      ),

    switchAccuracyRatio:
      metrics.switchAccuracy,

    postSwitchAccuracyRatio:
      metrics.postSwitchAccuracy,

    interferenceTrials:
      metrics.interferenceTrials,

    interferenceAccuracy:
      toPercent(
        metrics.interferenceAccuracy
      ),

    interferenceAccuracyRatio:
      metrics.interferenceAccuracy,

    firstTryAccuracy:
      toPercent(
        metrics.firstTryAccuracy
      ),

    firstTryAccuracyRatio:
      metrics.firstTryAccuracy,

    perseverativeErrors:
      metrics.perseverativeErrors,

    oldRuleInterference:
      metrics.oldRuleInterference,

    perseverativeErrorRate:
      toPercent(
        metrics.perseverativeErrorRate
      ),

    perseverativeErrorRateRatio:
      metrics.perseverativeErrorRate,

    interferenceControl:
      metrics.interferenceControl === null
        ? null
        : toPercent(
            metrics.interferenceControl
          ),

    interferenceControlRatio:
      metrics.interferenceControl,

    hasInhibitionData:
      metrics.hasInhibitionData,

    bestStreak:
      metrics.bestStreak,

    avgReactionTime:
      metrics.avgReactionTime,

    preSwitchAvgReactionTime:
      metrics.preSwitchAvgReactionTime,

    colorAvgReactionTime:
      metrics.colorAvgReactionTime,

    typeAvgReactionTime:
      metrics.typeAvgReactionTime,

    switchAvgReactionTime:
      metrics.switchAvgReactionTime,

    postSwitchAvgReactionTime:
      metrics.postSwitchAvgReactionTime,

    interferenceAvgReactionTime:
      metrics.interferenceAvgReactionTime,

    switchCost:
      metrics.switchCost,

    rtDifferenceAfterSwitch:
      metrics.rtDifferenceAfterSwitch,

    switchCostRatio:
      metrics.switchCostRatio,

    reactionTimeStd:
      metrics.reactionTimeStandardDeviation,

    reactionTimeStandardDeviation:
      metrics.reactionTimeStandardDeviation,

    reactionTimeCv:
      metrics.reactionTimeCv,

    reactionTimeValidCount:
      metrics.reactionTimeValidCount,

    responseStabilityScore:
      metrics.responseStabilityScore,

    responseStabilityLevel:
      metrics.responseStabilityLevel,

    reactionTimeReliable:
      metrics.reactionTimeReliable,

    fatigueLevel:
      metrics.fatigue.fatigueLevel,

    fatigueScore:
      metrics.fatigue.fatigueScore,

    fatigueResult:
      metrics.fatigue,

    strengths,
    needsPractice,

    parentFeedback,
    clinicianInterpretation,

    confidence:
      dataQuality.confidence,

    dataConfidence:
      dataQuality.confidence,

    dataQuality,

    hasEnoughTrials:
      dataQuality.hasEnoughTrials,

    minimumRecommendedTrials:
      dataQuality.minimumRecommendedTrials,

    trialLogs,

    createdAt:
      new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* 對外工具函式                                                                */
/* -------------------------------------------------------------------------- */

export function getRecommendedDccsDifficulty(
  input = {}
) {
  return analyzeDccsTraining(
    input
  ).recommendedDifficulty;
}

export function getRecommendedDccsLevel(
  input = {}
) {
  return analyzeDccsTraining(
    input
  ).recommendedDifficultyLevel;
}

export function shouldIncreaseDccsDifficulty(
  input = {}
) {
  return analyzeDccsTraining(
    input
  ).shouldIncreaseDifficulty;
}

export function shouldDecreaseDccsDifficulty(
  input = {}
) {
  return analyzeDccsTraining(
    input
  ).shouldDecreaseDifficulty;
}

export function shouldMaintainDccsDifficulty(
  input = {}
) {
  return analyzeDccsTraining(
    input
  ).shouldMaintainDifficulty;
}

export function analyzeDccsTrialLogs(
  trialLogs = []
) {
  return analyzeTrials(trialLogs);
}

export function normalizeDccsTrainingDifficulty(
  difficulty
) {
  return normalizeDifficulty(difficulty);
}

/*
 * 保留不同大小寫與舊命名，避免既有頁面 import 失效。
 */
export const analyzeDCCSTraining =
  analyzeDccsTraining;

export const analyzeDCCSTrainingPerformance =
  analyzeDccsTraining;

export const analyzeDccsTrainingPerformance =
  analyzeDccsTraining;

export const getRecommendedDCCSDifficulty =
  getRecommendedDccsDifficulty;

export const getRecommendedDCCSLevel =
  getRecommendedDccsLevel;

export const shouldIncreaseDCCSDifficulty =
  shouldIncreaseDccsDifficulty;

export const shouldDecreaseDCCSDifficulty =
  shouldDecreaseDccsDifficulty;

export default analyzeDccsTraining;