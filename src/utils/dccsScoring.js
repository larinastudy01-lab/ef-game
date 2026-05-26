// src/utils/dccsScoring.js

/**
 * DCCS 評分邏輯
 * Dimensional Change Card Sort
 *
 * 更新重點：
 * 1. 支援新版訓練 10 階難度。
 * 2. 將「衣服/種類正確率」typeAccuracy 與「切換後正確率」postSwitchAccuracy 分開。
 * 3. 舊規則干擾只在真正干擾題 isInterferenceTrial 中計算。
 * 4. 訓練分數依關卡類型使用不同權重。
 * 5. 家長端保留白話指標，醫療端保留細部數據。
 * 6. 對反應時間 CV 與切換後固著錯誤加入防呆。
 */

function safeDivide(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return numerator / denominator;
}

function clamp(value, min = 0, max = 100) {
  if (typeof value !== "number" || Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeRatio(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return value > 1 ? clamp(value, 0, 100) / 100 : clamp(value, 0, 1);
}

function toPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.round(normalizeRatio(value) * 100);
}

function filterValidReactionTimes(reactionTimes = []) {
  if (!Array.isArray(reactionTimes)) return [];

  return reactionTimes.filter(
    (time) => typeof time === "number" && Number.isFinite(time) && time > 0
  );
}

function average(numbers) {
  const validNumbers = filterValidReactionTimes(numbers);

  if (validNumbers.length === 0) return 0;

  return Math.round(
    validNumbers.reduce((sum, n) => sum + n, 0) / validNumbers.length
  );
}

function standardDeviation(numbers) {
  const validNumbers = filterValidReactionTimes(numbers);

  if (validNumbers.length <= 1) return 0;

  const avg = validNumbers.reduce((sum, n) => sum + n, 0) / validNumbers.length;
  const variance =
    validNumbers.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) /
    validNumbers.length;

  return Math.round(Math.sqrt(variance));
}

/**
 * 反應時間變異係數 CV = SD / Mean。
 * 有效 RT 少於 2 筆時不計算 CV，避免全超時或單筆 RT 造成 NaN / Infinity。
 */
function getReactionTimeCv(reactionTimes = []) {
  const validTimes = filterValidReactionTimes(reactionTimes);

  if (validTimes.length <= 1) {
    return {
      cv: 0,
      validCount: validTimes.length,
      isReliable: false,
    };
  }

  const mean =
    validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;

  if (!Number.isFinite(mean) || mean <= 0) {
    return {
      cv: 0,
      validCount: validTimes.length,
      isReliable: false,
    };
  }

  const sd = standardDeviation(validTimes);
  const cv = sd / mean;

  return {
    cv: Number.isFinite(cv) ? cv : 0,
    validCount: validTimes.length,
    isReliable: true,
  };
}

/**
 * DCCS 不建議過度重視速度，反應時間只作為輔助指標。
 */
function getReactionTimeScore(avgReactionTime) {
  if (!avgReactionTime || avgReactionTime <= 0) return 60;

  if (avgReactionTime <= 2000) return 100;
  if (avgReactionTime <= 3500) return 85;
  if (avgReactionTime <= 5000) return 70;
  if (avgReactionTime <= 7000) return 55;

  return 40;
}

function getResponseStabilityScore(reactionTimes = [], avgReactionTime = 0) {
  const validTimes = filterValidReactionTimes(reactionTimes);

  if (validTimes.length === 0) return 60;

  const rtScore = getReactionTimeScore(avgReactionTime);
  const sd = standardDeviation(validTimes);
  const { cv, isReliable } = getReactionTimeCv(validTimes);

  let stabilityScore = 100;

  if (validTimes.length <= 1 || !isReliable) {
    stabilityScore = 60;
  } else if (cv <= 0.2 && sd <= 500) {
    stabilityScore = 100;
  } else if (cv <= 0.35 && sd <= 1000) {
    stabilityScore = 85;
  } else if (cv <= 0.5 && sd <= 1800) {
    stabilityScore = 70;
  } else if (cv <= 0.7 && sd <= 2500) {
    stabilityScore = 55;
  } else {
    stabilityScore = 40;
  }

  return Math.round(rtScore * 0.4 + stabilityScore * 0.6);
}

function getReactionTimeLevel(avgReactionTime) {
  if (!avgReactionTime || avgReactionTime <= 0) {
    return {
      level: "未取得",
      description: "本次沒有取得有效反應時間資料。",
    };
  }

  if (avgReactionTime <= 2000) {
    return {
      level: "快速",
      description: "孩子能在短時間內完成規則判斷與分類反應。",
    };
  }

  if (avgReactionTime <= 3500) {
    return {
      level: "穩定",
      description: "孩子的作答速度大致穩定，能完成規則判斷。",
    };
  }

  if (avgReactionTime <= 5000) {
    return {
      level: "稍慢",
      description: "孩子可能需要更多時間理解規則或確認答案。",
    };
  }

  if (avgReactionTime <= 7000) {
    return {
      level: "偏慢",
      description: "孩子在分類前可能需要較長時間思考，建議搭配練習觀察。",
    };
  }

  return {
    level: "明顯偏慢",
    description: "孩子完成分類所需時間較長，可能需要更多規則提示與操作練習。",
  };
}

function isColorPhase(trial) {
  return Boolean(
    trial?.phase === "color_test" ||
      trial?.phase === "color" ||
      trial?.rule === "color" ||
      trial?.currentRule === "color"
  );
}

function isTypePhase(trial) {
  return Boolean(
    trial?.phase === "type_test" ||
      trial?.phase === "shape_test" ||
      trial?.phase === "type" ||
      trial?.phase === "shape" ||
      trial?.rule === "type" ||
      trial?.rule === "shape" ||
      trial?.currentRule === "type" ||
      trial?.currentRule === "shape"
  );
}

function hasExplicitPostSwitchFlag(trial) {
  if (!trial) return false;

  if (typeof trial.wasAfterRuleSwitch === "boolean") {
    return trial.wasAfterRuleSwitch;
  }

  if (typeof trial.isPostSwitch === "boolean") {
    return trial.isPostSwitch;
  }

  if (typeof trial.afterSwitch === "boolean") {
    return trial.afterSwitch;
  }

  return Boolean(
    trial.phase === "post_switch" ||
      trial.phase === "type_after_switch" ||
      trial.phase === "shape_after_switch"
  );
}

function getTrialRule(trial) {
  if (isColorPhase(trial)) return "color";
  if (isTypePhase(trial)) return "type";
  return null;
}

function isInterferenceTrial(trial) {
  if (!trial) return false;

  return Boolean(
    trial.isInterferenceTrial ||
      trial.interferenceTrial ||
      trial.phase === "interference" ||
      trial.trialType === "interference"
  );
}

function isFormalTrial(trial) {
  if (!trial) return false;

  if (trial.isPractice) return false;
  if (trial.phase === "instruction") return false;
  if (trial.phase === "tutorial") return false;
  if (trial.phase === "rule_switch") return false;

  return (
    isColorPhase(trial) ||
    isTypePhase(trial) ||
    typeof trial.isCorrect === "boolean"
  );
}

/**
 * 嚴格的「切換後」時序判定。
 * type_test / shape_test 只能代表目前規則，不再單獨等於已切換。
 */
function buildSwitchTimeline(trialLogs = []) {
  const formalEntries = [];
  let previousRule = null;
  let hasSwitched = false;

  trialLogs.forEach((trial) => {
    if (!trial) return;

    if (
      trial.phase === "rule_switch" ||
      trial.trialType === "rule_switch" ||
      trial.isRuleSwitch === true
    ) {
      hasSwitched = true;
      return;
    }

    if (!isFormalTrial(trial)) return;

    const currentRule = getTrialRule(trial);

    if (previousRule && currentRule && previousRule !== currentRule) {
      hasSwitched = true;
    }

    const explicitPostSwitch = hasExplicitPostSwitchFlag(trial);
    const effectiveHasSwitched = hasSwitched || explicitPostSwitch;

    formalEntries.push({
      trial,
      hasSwitched: effectiveHasSwitched,
      isPostSwitch: effectiveHasSwitched,
    });

    if (currentRule) previousRule = currentRule;
  });

  return formalEntries;
}

function isPostSwitchEntry(entry) {
  return Boolean(entry?.hasSwitched && entry?.isPostSwitch);
}

function isFirstTryCorrect(trial) {
  if (!trial || !trial.isCorrect) return false;

  if (typeof trial.attemptCount === "number") {
    return trial.attemptCount <= 1;
  }

  if (typeof trial.isFirstTry === "boolean") {
    return trial.isFirstTry;
  }

  if (typeof trial.firstTryCorrect === "boolean") {
    return trial.firstTryCorrect;
  }

  return true;
}

function isOldRuleError(trial) {
  if (!trial) return false;

  return Boolean(
    trial.isPerseverativeError ||
      trial.isOldRuleInterference ||
      trial.oldRuleError ||
      trial.errorType === "perseverative" ||
      trial.errorType === "old_rule"
  );
}

function getBestStreak(trials = []) {
  let best = 0;
  let current = 0;

  trials.forEach((trial) => {
    if (trial.isCorrect) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return best;
}

function analyzeTrialLogs(trialLogs = []) {
  const timelineEntries = Array.isArray(trialLogs)
    ? buildSwitchTimeline(trialLogs)
    : [];

  const formalTrials = timelineEntries.map((entry) => entry.trial);

  const colorTrials = formalTrials.filter(isColorPhase);
  const typeTrials = formalTrials.filter(isTypePhase);
  const postSwitchTrials = timelineEntries
    .filter(isPostSwitchEntry)
    .map((entry) => entry.trial);

  const interferenceTrials = formalTrials.filter(isInterferenceTrial);

  const correctTrials = formalTrials.filter((trial) => trial.isCorrect);
  const colorCorrectTrials = colorTrials.filter((trial) => trial.isCorrect);
  const typeCorrectTrials = typeTrials.filter((trial) => trial.isCorrect);
  const postSwitchCorrectTrials = postSwitchTrials.filter(
    (trial) => trial.isCorrect
  );
  const interferenceCorrectTrials = interferenceTrials.filter(
    (trial) => trial.isCorrect
  );

  const firstTryCorrectTrials = formalTrials.filter(isFirstTryCorrect);

  /**
   * 固著錯誤只允許在「已切換後」統計。
   * 如果有明確干擾題，則只在切換後 + 干擾題 + old rule error 時計入。
   * 若舊資料沒有 interference 標記，才退回切換後 old rule error。
   */
  const perseverativeErrors = postSwitchTrials.filter(
    (trial) => isInterferenceTrial(trial) && isOldRuleError(trial)
  ).length;

  const legacyPerseverativeErrors =
    postSwitchTrials.filter(isOldRuleError).length;

  const effectivePerseverativeErrors =
    interferenceTrials.length > 0
      ? perseverativeErrors
      : legacyPerseverativeErrors;

  const totalTrials = formalTrials.length;
  const correctCount = correctTrials.length;

  const accuracy = safeDivide(correctCount, totalTrials);
  const colorAccuracy = safeDivide(
    colorCorrectTrials.length,
    colorTrials.length
  );
  const typeAccuracy = safeDivide(typeCorrectTrials.length, typeTrials.length);
  const postSwitchAccuracy = safeDivide(
    postSwitchCorrectTrials.length,
    postSwitchTrials.length
  );
  const interferenceAccuracy = safeDivide(
    interferenceCorrectTrials.length,
    interferenceTrials.length
  );
  const firstTryAccuracy = safeDivide(firstTryCorrectTrials.length, totalTrials);

  const reactionTimes = filterValidReactionTimes(
    formalTrials.map((trial) => trial.reactionTime)
  );
  const colorReactionTimes = filterValidReactionTimes(
    colorTrials.map((trial) => trial.reactionTime)
  );
  const typeReactionTimes = filterValidReactionTimes(
    typeTrials.map((trial) => trial.reactionTime)
  );
  const postSwitchReactionTimes = filterValidReactionTimes(
    postSwitchTrials.map((trial) => trial.reactionTime)
  );

  const avgReactionTime = average(reactionTimes);
  const colorAvgReactionTime = average(colorReactionTimes);
  const typeAvgReactionTime = average(typeReactionTimes);
  const postSwitchAvgReactionTime = average(postSwitchReactionTimes);

  const reactionTimeCvResult = getReactionTimeCv(reactionTimes);
  const colorReactionTimeCvResult = getReactionTimeCv(colorReactionTimes);
  const typeReactionTimeCvResult = getReactionTimeCv(typeReactionTimes);
  const postSwitchReactionTimeCvResult = getReactionTimeCv(
    postSwitchReactionTimes
  );

  const perseverativeErrorRate = safeDivide(
    effectivePerseverativeErrors,
    interferenceTrials.length > 0
      ? interferenceTrials.length
      : postSwitchTrials.length
  );

  const interferenceControl = clamp(1 - perseverativeErrorRate, 0, 1);

  const rtDifferenceAfterSwitch =
    colorAvgReactionTime > 0 && postSwitchAvgReactionTime > 0
      ? postSwitchAvgReactionTime - colorAvgReactionTime
      : 0;

  const responseStabilityScore = getResponseStabilityScore(
    reactionTimes,
    avgReactionTime
  );

  return {
    totalTrials,
    correctCount,

    colorTrials: colorTrials.length,
    typeTrials: typeTrials.length,
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

    perseverativeErrors: effectivePerseverativeErrors,
    perseverativeErrorRate,
    interferenceControl,

    avgReactionTime,
    colorAvgReactionTime,
    typeAvgReactionTime,
    postSwitchAvgReactionTime,
    switchAvgReactionTime: postSwitchAvgReactionTime,
    rtDifferenceAfterSwitch,
    responseStabilityScore,

    reactionTimeCv: reactionTimeCvResult.cv,
    reactionTimeValidCount: reactionTimeCvResult.validCount,
    reactionTimeCvReliable: reactionTimeCvResult.isReliable,
    colorReactionTimeCv: colorReactionTimeCvResult.cv,
    typeReactionTimeCv: typeReactionTimeCvResult.cv,
    postSwitchReactionTimeCv: postSwitchReactionTimeCvResult.cv,

    bestStreak: getBestStreak(formalTrials),
    reactionTimes,
  };
}

const DCCS_LEVEL_SCORING = {
  colorIntro: {
    label: "第 1 階",
    title: "看顏色",
    starRule: "singleRule",
    abilityFocus: "colorRule",
    weights: {
      accuracy: 0.7,
      firstTryAccuracy: 0.2,
      responseStability: 0.1,
    },
  },

  colorStable: {
    label: "第 2 階",
    title: "顏色穩定",
    starRule: "singleRule",
    abilityFocus: "colorRule",
    weights: {
      accuracy: 0.65,
      firstTryAccuracy: 0.25,
      responseStability: 0.1,
    },
  },

  typeIntro: {
    label: "第 3 階",
    title: "看衣服",
    starRule: "singleRule",
    abilityFocus: "typeRule",
    weights: {
      typeAccuracy: 0.7,
      firstTryAccuracy: 0.2,
      responseStability: 0.1,
    },
  },

  typeStable: {
    label: "第 4 階",
    title: "衣服穩定",
    starRule: "singleRule",
    abilityFocus: "typeRule",
    weights: {
      typeAccuracy: 0.65,
      firstTryAccuracy: 0.25,
      responseStability: 0.1,
    },
  },

  switchClear: {
    label: "第 5 階",
    title: "明確換規則",
    starRule: "clearSwitch",
    abilityFocus: "ruleSwitch",
    weights: {
      postSwitchAccuracy: 0.45,
      accuracy: 0.25,
      firstTryAccuracy: 0.15,
      interferenceControl: 0.15,
    },
  },

  switchEarly: {
    label: "第 6 階",
    title: "提前換規則",
    starRule: "clearSwitch",
    abilityFocus: "ruleSwitch",
    weights: {
      postSwitchAccuracy: 0.5,
      accuracy: 0.2,
      firstTryAccuracy: 0.15,
      interferenceControl: 0.15,
    },
  },

  switchMaintain: {
    label: "第 7 階",
    title: "切換後維持",
    starRule: "switchMaintain",
    abilityFocus: "ruleMaintain",
    weights: {
      postSwitchAccuracy: 0.4,
      interferenceControl: 0.25,
      firstTryAccuracy: 0.15,
      accuracy: 0.1,
      responseStability: 0.1,
    },
  },

  lowInterference: {
    label: "第 8 階",
    title: "少量干擾",
    starRule: "interference",
    abilityFocus: "inhibition",
    weights: {
      interferenceControl: 0.35,
      postSwitchAccuracy: 0.35,
      accuracy: 0.2,
      responseStability: 0.1,
    },
  },

  highInterference: {
    label: "第 9 階",
    title: "高干擾",
    starRule: "interference",
    abilityFocus: "inhibition",
    weights: {
      interferenceControl: 0.4,
      postSwitchAccuracy: 0.35,
      accuracy: 0.15,
      responseStability: 0.1,
    },
  },

  testLike: {
    label: "第 10 階",
    title: "接近測驗",
    starRule: "testLike",
    abilityFocus: "testReadiness",
    weights: {
      postSwitchAccuracy: 0.4,
      accuracy: 0.25,
      interferenceControl: 0.2,
      firstTryAccuracy: 0.1,
      responseStability: 0.05,
    },
  },
};

function normalizeDifficulty(difficulty) {
  const map = {
    easy: "colorIntro",
    normal: "switchClear",
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
  };

  return map[difficulty] || "switchClear";
}

function getLevelScoringConfig(difficulty) {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const fallbackDifficulty = "switchClear";

  return {
    normalizedDifficulty,
    config:
      DCCS_LEVEL_SCORING[normalizedDifficulty] ||
      DCCS_LEVEL_SCORING[fallbackDifficulty],
  };
}

function getScoreValue(key, source) {
  if (key === "responseStability") return source.responseStabilityScore;
  return normalizeRatio(source[key]) * 100;
}

function getPrimarySingleRuleAccuracy(config, source) {
  if (config.abilityFocus === "typeRule") {
    return source.typeTrials > 0 ? source.typeAccuracy : source.accuracy;
  }

  if (config.abilityFocus === "colorRule") {
    return source.colorTrials > 0 ? source.colorAccuracy : source.accuracy;
  }

  return source.accuracy;
}

function calculateTrainingLevelScore({
  difficulty,
  accuracy,
  colorAccuracy,
  typeAccuracy,
  postSwitchAccuracy,
  switchAccuracy,
  firstTryAccuracy,
  interferenceControl,
  interferenceAccuracy,
  responseStabilityScore,
  colorTrials,
  typeTrials,
  switchTrials,
  postSwitchTrials,
  interferenceTrials,
  perseverativeErrors,
}) {
  const { normalizedDifficulty, config } = getLevelScoringConfig(difficulty);

  const effectivePostSwitchAccuracy =
    typeof postSwitchAccuracy === "number" ? postSwitchAccuracy : switchAccuracy;

  const scoreSource = {
    accuracy,
    colorAccuracy,
    typeAccuracy,
    postSwitchAccuracy: effectivePostSwitchAccuracy,
    switchAccuracy: effectivePostSwitchAccuracy,
    firstTryAccuracy,
    interferenceControl,
    interferenceAccuracy,
    responseStabilityScore,
    colorTrials,
    typeTrials,
    switchTrials: postSwitchTrials ?? switchTrials,
    postSwitchTrials: postSwitchTrials ?? switchTrials,
    interferenceTrials,
  };

  let totalScore = 0;

  Object.entries(config.weights || {}).forEach(([key, weight]) => {
    totalScore += getScoreValue(key, scoreSource) * weight;
  });

  totalScore = Math.round(clamp(totalScore, 0, 100));

  const primarySingleRuleAccuracy = getPrimarySingleRuleAccuracy(
    config,
    scoreSource
  );

  const hasSwitchTrials = (postSwitchTrials ?? switchTrials ?? 0) > 0;
  const hasInterferenceTrials = (interferenceTrials ?? 0) > 0;

  const effectiveInterferenceControl = hasInterferenceTrials
    ? interferenceControl
    : 1 - safeDivide(perseverativeErrors, postSwitchTrials || switchTrials || 1);

  let stars = 1;

  if (config.starRule === "singleRule") {
    if (totalScore >= 85 && primarySingleRuleAccuracy >= 0.8) {
      stars = 3;
    } else if (totalScore >= 60 && primarySingleRuleAccuracy >= 0.55) {
      stars = 2;
    }
  }

  if (config.starRule === "clearSwitch") {
    if (hasSwitchTrials && effectivePostSwitchAccuracy < 0.5) {
      stars = 1;
    } else if (totalScore >= 82 && effectivePostSwitchAccuracy >= 0.7) {
      stars = 3;
    } else if (totalScore >= 58 && effectivePostSwitchAccuracy >= 0.5) {
      stars = 2;
    }
  }

  if (config.starRule === "switchMaintain") {
    if (hasSwitchTrials && effectivePostSwitchAccuracy < 0.5) {
      stars = 1;
    } else if (
      totalScore >= 82 &&
      effectivePostSwitchAccuracy >= 0.7 &&
      perseverativeErrors <= 1
    ) {
      stars = 3;
    } else if (totalScore >= 58 && effectivePostSwitchAccuracy >= 0.5) {
      stars = 2;
    }
  }

  if (config.starRule === "interference") {
    if (
      (hasSwitchTrials && effectivePostSwitchAccuracy < 0.5) ||
      effectiveInterferenceControl < 0.45
    ) {
      stars = 1;
    } else if (
      totalScore >= 82 &&
      effectivePostSwitchAccuracy >= 0.7 &&
      effectiveInterferenceControl >= 0.75 &&
      perseverativeErrors <= 1
    ) {
      stars = 3;
    } else if (
      totalScore >= 58 &&
      effectivePostSwitchAccuracy >= 0.5 &&
      effectiveInterferenceControl >= 0.55
    ) {
      stars = 2;
    }
  }

  if (config.starRule === "testLike") {
    if (hasSwitchTrials && effectivePostSwitchAccuracy < 0.5) {
      stars = 1;
    } else if (
      totalScore >= 80 &&
      effectivePostSwitchAccuracy >= 0.75 &&
      perseverativeErrors <= 1
    ) {
      stars = 3;
    } else if (totalScore >= 55 && effectivePostSwitchAccuracy >= 0.5) {
      stars = 2;
    }
  }

  return {
    difficulty: normalizedDifficulty,
    difficultyLabel: config.label,
    difficultyTitle: config.title,
    abilityFocus: config.abilityFocus,
    totalScore,
    stars,
    scoringMode: "training",
    scoringWeights: config.weights,
    starRule: config.starRule,
  };
}

function calculateFormalTestScore({
  accuracy,
  colorAccuracy,
  postSwitchAccuracy,
  switchAccuracy,
  interferenceControl,
  avgReactionTime,
  switchTrials,
  postSwitchTrials,
  perseverativeErrors,
}) {
  const effectivePostSwitchAccuracy =
    typeof postSwitchAccuracy === "number" ? postSwitchAccuracy : switchAccuracy;

  const effectiveSwitchTrials = postSwitchTrials ?? switchTrials ?? 0;

  const switchScore = effectivePostSwitchAccuracy * 40;
  const accuracyScore = accuracy * 25;
  const perseverativeScore = interferenceControl * 20;
  const colorScore = colorAccuracy * 10;
  const reactionTimeScore = getReactionTimeScore(avgReactionTime) * 0.05;

  const totalScore = Math.round(
    clamp(
      switchScore +
        accuracyScore +
        perseverativeScore +
        colorScore +
        reactionTimeScore,
      0,
      100
    )
  );

  let stars = 1;

  if (effectiveSwitchTrials > 0 && effectivePostSwitchAccuracy < 0.5) {
    stars = 1;
  } else if (
    totalScore >= 80 &&
    effectivePostSwitchAccuracy >= 0.75 &&
    perseverativeErrors <= 1
  ) {
    stars = 3;
  } else if (
    totalScore >= 55 &&
    (effectiveSwitchTrials === 0 || effectivePostSwitchAccuracy >= 0.5)
  ) {
    stars = 2;
  }

  return {
    totalScore,
    stars,
    scoringMode: "test",

    switchScore: Math.round(switchScore),
    accuracyScore: Math.round(accuracyScore),
    perseverativeScore: Math.round(perseverativeScore),
    colorScore: Math.round(colorScore),
    reactionTimeScore: Math.round(reactionTimeScore),
  };
}

function readRatio(resultData, key, fallback) {
  return typeof resultData[key] === "number"
    ? normalizeRatio(resultData[key])
    : fallback;
}

export function calculateDccsScore(resultData = {}) {
  const trialLogs = Array.isArray(resultData.trialLogs)
    ? resultData.trialLogs
    : [];

  const analyzed = analyzeTrialLogs(trialLogs);

  const totalTrials = resultData.totalTrials ?? analyzed.totalTrials;

  const correctCount =
    resultData.correctCount ?? resultData.correctTrials ?? analyzed.correctCount;

  const accuracy = readRatio(resultData, "accuracy", analyzed.accuracy);

  const colorAccuracy = readRatio(
    resultData,
    "colorAccuracy",
    analyzed.colorAccuracy
  );

  const typeAccuracy = readRatio(
    resultData,
    "typeAccuracy",
    analyzed.typeAccuracy
  );

  const postSwitchAccuracy =
    typeof resultData.postSwitchAccuracy === "number"
      ? normalizeRatio(resultData.postSwitchAccuracy)
      : typeof resultData.switchAccuracy === "number"
      ? normalizeRatio(resultData.switchAccuracy)
      : analyzed.postSwitchAccuracy;

  const switchAccuracy = postSwitchAccuracy;

  const interferenceAccuracy = readRatio(
    resultData,
    "interferenceAccuracy",
    analyzed.interferenceAccuracy
  );

  const firstTryAccuracy = readRatio(
    resultData,
    "firstTryAccuracy",
    analyzed.firstTryAccuracy
  );

  const perseverativeErrors =
    typeof resultData.perseverativeErrors === "number"
      ? resultData.perseverativeErrors
      : typeof resultData.oldRuleInterference === "number"
      ? resultData.oldRuleInterference
      : analyzed.perseverativeErrors;

  const colorTrials =
    typeof resultData.colorTrials === "number"
      ? resultData.colorTrials
      : analyzed.colorTrials;

  const typeTrials =
    typeof resultData.typeTrials === "number"
      ? resultData.typeTrials
      : analyzed.typeTrials;

  const postSwitchTrials =
    typeof resultData.postSwitchTrials === "number"
      ? resultData.postSwitchTrials
      : typeof resultData.switchTrials === "number"
      ? resultData.switchTrials
      : analyzed.postSwitchTrials;

  const switchTrials = postSwitchTrials;

  const interferenceTrials =
    typeof resultData.interferenceTrials === "number"
      ? resultData.interferenceTrials
      : analyzed.interferenceTrials;

  const perseverativeErrorRate =
    typeof resultData.perseverativeErrorRate === "number"
      ? normalizeRatio(resultData.perseverativeErrorRate)
      : safeDivide(
          perseverativeErrors,
          interferenceTrials > 0 ? interferenceTrials : postSwitchTrials
        );

  const interferenceControl =
    typeof resultData.interferenceControl === "number"
      ? normalizeRatio(resultData.interferenceControl)
      : clamp(1 - perseverativeErrorRate, 0, 1);

  const avgReactionTime =
    typeof resultData.avgReactionTime === "number"
      ? resultData.avgReactionTime
      : analyzed.avgReactionTime;

  const colorAvgReactionTime =
    typeof resultData.colorAvgReactionTime === "number"
      ? resultData.colorAvgReactionTime
      : analyzed.colorAvgReactionTime;

  const typeAvgReactionTime =
    typeof resultData.typeAvgReactionTime === "number"
      ? resultData.typeAvgReactionTime
      : analyzed.typeAvgReactionTime;

  const postSwitchAvgReactionTime =
    typeof resultData.postSwitchAvgReactionTime === "number"
      ? resultData.postSwitchAvgReactionTime
      : typeof resultData.switchAvgReactionTime === "number"
      ? resultData.switchAvgReactionTime
      : analyzed.postSwitchAvgReactionTime;

  const switchAvgReactionTime = postSwitchAvgReactionTime;

  const rtDifferenceAfterSwitch =
    typeof resultData.rtDifferenceAfterSwitch === "number"
      ? resultData.rtDifferenceAfterSwitch
      : analyzed.rtDifferenceAfterSwitch;

  const responseStabilityScore =
    typeof resultData.responseStabilityScore === "number"
      ? resultData.responseStabilityScore
      : analyzed.responseStabilityScore;

  const reactionTimeCv =
    typeof resultData.reactionTimeCv === "number"
      ? safeNumber(resultData.reactionTimeCv, 0)
      : analyzed.reactionTimeCv;

  const reactionTimeValidCount =
    typeof resultData.reactionTimeValidCount === "number"
      ? resultData.reactionTimeValidCount
      : analyzed.reactionTimeValidCount;

  const reactionTimeCvReliable =
    typeof resultData.reactionTimeCvReliable === "boolean"
      ? resultData.reactionTimeCvReliable
      : analyzed.reactionTimeCvReliable;

  const colorReactionTimeCv =
    typeof resultData.colorReactionTimeCv === "number"
      ? safeNumber(resultData.colorReactionTimeCv, 0)
      : analyzed.colorReactionTimeCv;

  const typeReactionTimeCv =
    typeof resultData.typeReactionTimeCv === "number"
      ? safeNumber(resultData.typeReactionTimeCv, 0)
      : analyzed.typeReactionTimeCv;

  const postSwitchReactionTimeCv =
    typeof resultData.postSwitchReactionTimeCv === "number"
      ? safeNumber(resultData.postSwitchReactionTimeCv, 0)
      : analyzed.postSwitchReactionTimeCv;

  const bestStreak =
    typeof resultData.bestStreak === "number"
      ? resultData.bestStreak
      : analyzed.bestStreak;

  const mode = resultData.mode || resultData.scoringMode || "test";

  const isTraining =
    mode === "training" ||
    Boolean(
      resultData.trainingDifficulty ||
        resultData.difficulty ||
        resultData.levelDifficulty
    );

  const difficulty =
    resultData.trainingDifficulty ||
    resultData.difficulty ||
    resultData.levelDifficulty ||
    "switchClear";

  const scoringResult = isTraining
    ? calculateTrainingLevelScore({
        difficulty,
        accuracy,
        colorAccuracy,
        typeAccuracy,
        postSwitchAccuracy,
        switchAccuracy,
        firstTryAccuracy,
        interferenceControl,
        interferenceAccuracy,
        responseStabilityScore,
        colorTrials,
        typeTrials,
        switchTrials,
        postSwitchTrials,
        interferenceTrials,
        perseverativeErrors,
      })
    : calculateFormalTestScore({
        accuracy,
        colorAccuracy,
        postSwitchAccuracy,
        switchAccuracy,
        interferenceControl,
        avgReactionTime,
        switchTrials,
        postSwitchTrials,
        perseverativeErrors,
      });

  const totalScore = scoringResult.totalScore;
  const stars = scoringResult.stars;
  const reactionTimeLevel = getReactionTimeLevel(avgReactionTime);

  const ruleUnderstandingValue = (() => {
    if (typeTrials > 0 && colorTrials === 0) return typeAccuracy;
    if (colorTrials > 0 && typeTrials === 0) return colorAccuracy;
    return accuracy;
  })();

  const parentIndicators = {
    ruleUnderstanding: toPercent(ruleUnderstandingValue),
    cognitiveFlexibility:
      postSwitchTrials > 0 ? toPercent(postSwitchAccuracy) : null,
    inhibitionControl:
      postSwitchTrials > 0 || interferenceTrials > 0
        ? toPercent(interferenceControl)
        : null,
    responseStability: Math.round(responseStabilityScore),

    understandRule: {
      label: "看懂規則",
      value: toPercent(ruleUnderstandingValue),
      description: "孩子是否能理解目前要依照什麼規則分類。",
    },

    switchRule: {
      label: "換玩法能力",
      value: postSwitchTrials > 0 ? toPercent(postSwitchAccuracy) : null,
      description:
        postSwitchTrials > 0
          ? "孩子在玩法改變後，是否能跟上新的分類方式。"
          : "此關卡尚未加入換玩法，因此不計算此指標。",
    },

    avoidOldRule: {
      label: "不被舊玩法影響",
      value:
        postSwitchTrials > 0 || interferenceTrials > 0
          ? toPercent(interferenceControl)
          : null,
      description:
        postSwitchTrials > 0 || interferenceTrials > 0
          ? "孩子換玩法後，是否能避免被前一個玩法干擾。"
          : "此關卡尚未加入舊玩法干擾，因此不計算此指標。",
    },

    stableResponse: {
      label: "作答穩定度",
      value: Math.round(responseStabilityScore),
      description: "觀察孩子作答速度與反應是否穩定，不是單純越快越好。",
    },
  };

  const clinicianMetrics = {
    totalTrials,
    correctCount,

    accuracy,
    accuracyPercent: toPercent(accuracy),

    colorTrials,
    colorAccuracy,
    colorAccuracyPercent: toPercent(colorAccuracy),

    typeTrials,
    typeAccuracy,
    typeAccuracyPercent: toPercent(typeAccuracy),

    postSwitchTrials,
    switchTrials,
    postSwitchAccuracy,
    switchAccuracy,
    postSwitchAccuracyPercent: toPercent(postSwitchAccuracy),
    switchAccuracyPercent: toPercent(switchAccuracy),

    interferenceTrials,
    interferenceAccuracy,
    interferenceAccuracyPercent: toPercent(interferenceAccuracy),

    firstTryAccuracy,
    firstTryAccuracyPercent: toPercent(firstTryAccuracy),

    perseverativeErrors,
    perseverativeErrorRate,
    perseverativeErrorRatePercent: toPercent(perseverativeErrorRate),

    interferenceControl,
    interferenceControlPercent: toPercent(interferenceControl),

    bestStreak,
    avgReactionTime,
    colorAvgReactionTime,
    typeAvgReactionTime,
    postSwitchAvgReactionTime,
    switchAvgReactionTime,
    rtDifferenceAfterSwitch,

    responseStabilityScore,
    reactionTimeCv,
    reactionTimeValidCount,
    reactionTimeCvReliable,
    colorReactionTimeCv,
    typeReactionTimeCv,
    postSwitchReactionTimeCv,

    scoringMode: scoringResult.scoringMode,
    scoringWeights: scoringResult.scoringWeights || null,
    starRule: scoringResult.starRule || null,
    abilityFocus: scoringResult.abilityFocus || null,

    switchScore: scoringResult.switchScore,
    accuracyScore: scoringResult.accuracyScore,
    perseverativeScore: scoringResult.perseverativeScore,
    colorScore: scoringResult.colorScore,
    reactionTimeScore: scoringResult.reactionTimeScore,

    trialLogs,
  };

  return {
    task: "DCCS",

    totalScore,
    stars,

    scoringMode: scoringResult.scoringMode,
    difficulty: scoringResult.difficulty || null,
    difficultyLabel: scoringResult.difficultyLabel || null,
    difficultyTitle: scoringResult.difficultyTitle || null,
    abilityFocus: scoringResult.abilityFocus || null,

    totalTrials,
    correctCount,

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

    colorTrials,
    typeTrials,
    postSwitchTrials,
    switchTrials,
    interferenceTrials,

    bestStreak,
    avgReactionTime,
    colorAvgReactionTime,
    typeAvgReactionTime,
    postSwitchAvgReactionTime,
    switchAvgReactionTime,
    rtDifferenceAfterSwitch,
    responseStabilityScore,
    reactionTimeCv,
    reactionTimeValidCount,
    reactionTimeCvReliable,
    colorReactionTimeCv,
    typeReactionTimeCv,
    postSwitchReactionTimeCv,

    accuracyPercent: toPercent(accuracy),
    colorAccuracyPercent: toPercent(colorAccuracy),
    typeAccuracyPercent: toPercent(typeAccuracy),
    postSwitchAccuracyPercent: toPercent(postSwitchAccuracy),
    switchAccuracyPercent: toPercent(switchAccuracy),
    interferenceAccuracyPercent: toPercent(interferenceAccuracy),
    firstTryAccuracyPercent: toPercent(firstTryAccuracy),
    perseverativeErrorRatePercent: toPercent(perseverativeErrorRate),
    interferenceControlPercent: toPercent(interferenceControl),

    parentIndicators,
    clinicianMetrics,

    childMessage: getChildMessage(stars),

    parentSummary: getParentSummary({
      stars,
      postSwitchAccuracy,
      switchAccuracy,
      perseverativeErrors,
      avgReactionTime,
      isTraining,
      difficulty: scoringResult.difficulty,
      difficultyTitle: scoringResult.difficultyTitle,
      postSwitchTrials,
      switchTrials,
      interferenceTrials,
    }),

    clinicianSummary: getClinicianSummary({
      totalScore,
      accuracy,
      colorAccuracy,
      typeAccuracy,
      postSwitchAccuracy,
      switchAccuracy,
      interferenceAccuracy,
      firstTryAccuracy,
      perseverativeErrors,
      perseverativeErrorRate,
      avgReactionTime,
      rtDifferenceAfterSwitch,
      responseStabilityScore,
      postSwitchTrials,
      switchTrials,
      interferenceTrials,
    }),

    reactionTimeLevel,
  };
}

function getChildMessage(stars) {
  if (stars === 3) {
    return {
      title: "太棒了！",
      text: "你很會跟著新玩法整理衣服，孔雀小姐很開心！",
    };
  }

  if (stars === 2) {
    return {
      title: "做得不錯！",
      text: "你已經會分類了，換玩法的時候再多想一下會更棒！",
    };
  }

  return {
    title: "再練習一次！",
    text: "沒關係，我們再陪孔雀小姐一起練習分類玩法！",
  };
}

function getParentSummary({
  stars,
  postSwitchAccuracy,
  switchAccuracy,
  perseverativeErrors,
  isTraining,
  difficultyTitle,
  postSwitchTrials,
  switchTrials,
  interferenceTrials,
}) {
  const effectiveSwitchAccuracy =
    typeof postSwitchAccuracy === "number" ? postSwitchAccuracy : switchAccuracy;

  const hasSwitch = (postSwitchTrials ?? switchTrials ?? 0) > 0;
  const hasInterference = (interferenceTrials ?? 0) > 0;
  const levelText = difficultyTitle ? `「${difficultyTitle}」` : "本次";

  if (isTraining) {
    if (stars === 3) {
      if (hasSwitch) {
        return `孩子在${levelText}訓練中表現穩定，能在玩法改變後跟上新的分類方式。`;
      }

      return `孩子在${levelText}訓練中能穩定依照目前規則完成分類。`;
    }

    if (stars === 2) {
      if (hasInterference || perseverativeErrors > 0) {
        return "孩子已能完成部分分類任務，但在舊玩法干擾出現時，可能還需要多一點時間確認。建議維持短回合練習。";
      }

      if (hasSwitch && effectiveSwitchAccuracy < 0.7) {
        return "孩子能完成基本分類，但在玩法改變後需要更多練習來穩定套用新規則。";
      }

      return "孩子已能完成部分分類任務，建議維持短回合練習，讓孩子慢慢熟悉。";
    }

    return "孩子在本次訓練中可能仍需要較多提示。建議先從單一規則分類開始，再逐步加入換玩法與干擾練習。";
  }

  if (stars === 3) {
    return "孩子在本次分類任務中表現穩定，尤其在規則改變後仍能依照新規則作答。";
  }

  if (stars === 2) {
    return "孩子能完成基本分類任務，但在規則切換後仍可能受到前一個規則影響。建議透過短回合、明確提示的分類練習來熟悉換規則情境。";
  }

  if (!hasSwitch) {
    return "孩子在本次任務中對基本分類規則仍需要更多練習。建議先從單一規則分類開始。";
  }

  return "孩子在本次任務中對規則轉換較容易混淆，可能需要更多視覺提示與重複練習。";
}

function getClinicianSummary({
  totalScore,
  accuracy,
  colorAccuracy,
  typeAccuracy,
  postSwitchAccuracy,
  switchAccuracy,
  interferenceAccuracy,
  firstTryAccuracy,
  perseverativeErrors,
  perseverativeErrorRate,
  avgReactionTime,
  rtDifferenceAfterSwitch,
  responseStabilityScore,
  postSwitchTrials,
  switchTrials,
  interferenceTrials,
}) {
  const effectiveSwitchAccuracy =
    typeof postSwitchAccuracy === "number" ? postSwitchAccuracy : switchAccuracy;

  const effectiveSwitchTrials = postSwitchTrials ?? switchTrials ?? 0;

  return {
    overview: `DCCS 綜合分數為 ${totalScore} 分，整體正確率為 ${toPercent(
      accuracy
    )}%，顏色規則正確率為 ${toPercent(
      colorAccuracy
    )}%，種類規則正確率為 ${toPercent(typeAccuracy)}%。`,

    switchObservation:
      effectiveSwitchTrials > 0
        ? `切換後正確率為 ${toPercent(
            effectiveSwitchAccuracy
          )}%，可作為觀察規則轉換能力的主要指標。`
        : "本次任務未包含切換後規則階段，因此不計算切換後正確率作為主要判讀依據。",

    inhibitionObservation:
      effectiveSwitchTrials > 0 || interferenceTrials > 0
        ? `固著錯誤共 ${perseverativeErrors} 次，固著錯誤率為 ${toPercent(
            perseverativeErrorRate
          )}%，干擾題正確率為 ${toPercent(
            interferenceAccuracy
          )}%。此指標可用於觀察孩子是否仍受到前一個規則影響。`
        : "本次任務未包含舊規則干擾階段，因此固著錯誤不作為主要判讀依據。",

    firstTryObservation: `第一次答對率為 ${toPercent(
      firstTryAccuracy
    )}%，可輔助觀察孩子是否能在不反覆試錯的情況下理解規則。`,

    reactionTimeObservation: `平均反應時間為 ${avgReactionTime} ms，切換後反應時間差為 ${rtDifferenceAfterSwitch} ms，作答穩定度為 ${Math.round(
      responseStabilityScore
    )} 分。若切換後反應時間明顯增加，可能表示孩子需要更多時間抑制舊規則並重新套用新規則。`,
  };
}

export function getDccsStars(resultData = {}) {
  return calculateDccsScore(resultData).stars;
}

export const calculateDcssScore = calculateDccsScore;
export const getDcssStars = getDccsStars;

export default calculateDccsScore;