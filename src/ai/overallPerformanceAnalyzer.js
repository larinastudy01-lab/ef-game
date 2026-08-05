/**
 * src/ai/overallPerformanceAnalyzer.js
 *
 * 用途：
 * 1. 整合 6 個測驗結果
 * 2. 分析三大能力：工作記憶、抑制控制、認知彈性
 * 3. 產生家長端摘要
 * 4. 產生醫療端指標
 */

const ABILITY_MAP = {
  CBT: "workingMemory",
  PM: "workingMemory",

  SRT: "inhibition",
  SSG: "inhibition",

  LB: "cognitiveFlexibility",
  DCCS: "cognitiveFlexibility",
};

const ABILITY_LABELS = {
  workingMemory: "工作記憶",
  inhibition: "抑制控制",
  cognitiveFlexibility: "認知彈性",
};

const DEFAULT_ERROR_TYPES = {
  miss: 0,
  randomClick: 0,
  wrongTarget: 0,
  repeatedClick: 0,
  timeout: 0,
  sequenceError: 0,
  ruleSwitchError: 0,
};

export const analyzeOverallPerformance = (gameResults = []) => {
  const validResults = gameResults.filter((item) => item && item.result);

  const abilityGroups = {
    workingMemory: [],
    inhibition: [],
    cognitiveFlexibility: [],
  };

  validResults.forEach((item) => {
    const gameId = item.gameId || item.result?.gameId;
    const ability = ABILITY_MAP[gameId];

    if (ability) {
      abilityGroups[ability].push(normalizeResult(item.result));
    }
  });

  const abilityScores = {};

  Object.entries(abilityGroups).forEach(([ability, results]) => {
    abilityScores[ability] = analyzeAbilityGroup(results);
  });

  const overallScore = calculateOverallScore(abilityScores);

  const riskLevel = getRiskLevel({
    overallScore,
    abilityScores,
  });

  const parentSummary = generateParentSummary({
    overallScore,
    abilityScores,
    riskLevel,
  });

  const clinicalSummary = generateClinicalSummary({
    overallScore,
    abilityScores,
    riskLevel,
  });

  const recommendedTraining = getRecommendedTraining(abilityScores);

  return {
    overallScore,
    riskLevel,

    abilityScores,

    parentSummary,
    clinicalSummary,

    recommendedTraining,

    createdAt: new Date().toISOString(),
  };
};

const normalizeResult = (result = {}) => {
  const errorTypes = {
    ...DEFAULT_ERROR_TYPES,
    ...(result.errorTypes || {}),
  };

  const totalErrors = Object.values(errorTypes).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );

  return {
    accuracy: Number(result.accuracy || 0),
    avgReactionTime: Number(result.avgReactionTime || 0),
    stars: Number(result.stars || 1),
    totalErrors,
    errorTypes,
    fatigueLevel: result.fatigueLevel || "low",
    warningLevel: result.warningLevel || "green",
  };
};

const analyzeAbilityGroup = (results = []) => {
  if (results.length === 0) {
    return {
      score: 0,
      accuracy: 0,
      avgReactionTime: 0,
      totalErrors: 0,
      status: "noData",
      warningLevel: "none",
      mainWeakness: "noData",
    };
  }

  const accuracy = average(results.map((item) => item.accuracy));

  const validRT = results
    .map((item) => item.avgReactionTime)
    .filter((rt) => rt > 0);

  const avgReactionTime = validRT.length > 0 ? average(validRT) : 0;

  const totalErrors = results.reduce(
    (sum, item) => sum + item.totalErrors,
    0
  );

  const mergedErrors = mergeErrors(results);

  const score = calculateAbilityScore({
    accuracy,
    avgReactionTime,
    totalErrors,
    mergedErrors,
  });

  const warningLevel = getAbilityWarningLevel({
    score,
    totalErrors,
    results,
  });

  return {
    score,
    accuracy,
    avgReactionTime,
    totalErrors,
    errorTypes: mergedErrors,
    status: getAbilityStatus(score),
    warningLevel,
    mainWeakness: getMainWeakness(mergedErrors),
  };
};

const calculateAbilityScore = ({
  accuracy,
  avgReactionTime,
  totalErrors,
  mergedErrors,
}) => {
  let score = accuracy;

  if (avgReactionTime > 2500) {
    score -= 10;
  } else if (avgReactionTime > 1800) {
    score -= 5;
  }

  score -= Math.min(20, totalErrors * 2);

  if (mergedErrors.randomClick >= 3) score -= 5;
  if (mergedErrors.ruleSwitchError >= 3) score -= 8;
  if (mergedErrors.sequenceError >= 3) score -= 8;

  return clamp(Math.round(score), 0, 100);
};

const calculateOverallScore = (abilityScores) => {
  const scores = Object.values(abilityScores)
    .map((item) => item.score)
    .filter((score) => score > 0);

  if (scores.length === 0) return 0;

  return Math.round(average(scores));
};

const getRiskLevel = ({ overallScore, abilityScores }) => {
  const redCount = Object.values(abilityScores).filter(
    (item) => item.warningLevel === "red"
  ).length;

  const orangeCount = Object.values(abilityScores).filter(
    (item) => item.warningLevel === "orange"
  ).length;

  if (overallScore < 60 || redCount >= 1) {
    return "red";
  }

  if (overallScore < 80 || orangeCount >= 1) {
    return "orange";
  }

  return "green";
};

const getAbilityWarningLevel = ({ score, totalErrors, results }) => {
  const hasHighFatigue = results.some(
    (item) => item.fatigueLevel === "high"
  );

  if (score < 60 || totalErrors >= 10 || hasHighFatigue) {
    return "red";
  }

  if (score < 80 || totalErrors >= 5) {
    return "orange";
  }

  return "green";
};

const getAbilityStatus = (score) => {
  if (score === 0) return "noData";
  if (score >= 85) return "stable";
  if (score >= 65) return "developing";
  return "needsSupport";
};

const getMainWeakness = (errorTypes = {}) => {
  const entries = Object.entries(errorTypes);

  if (entries.length === 0) return "none";

  const [key, value] = entries.sort(
    (a, b) => Number(b[1]) - Number(a[1])
  )[0];

  if (!value || value === 0) return "none";

  return key;
};

const mergeErrors = (results = []) => {
  const merged = { ...DEFAULT_ERROR_TYPES };

  results.forEach((item) => {
    Object.entries(item.errorTypes || {}).forEach(([key, value]) => {
      merged[key] = (merged[key] || 0) + (Number(value) || 0);
    });
  });

  return merged;
};

const getRecommendedTraining = (abilityScores) => {
  const sorted = Object.entries(abilityScores)
    .filter(([, data]) => data.score > 0)
    .sort((a, b) => a[1].score - b[1].score);

  if (sorted.length === 0) {
    return {
      ability: "workingMemory",
      abilityLabel: "工作記憶",
      reason: "目前資料不足，建議先從工作記憶任務開始建立基礎紀錄。",
      suggestedGames: ["CBT", "PM"],
      suggestedDifficulty: "easy",
    };
  }

  const [ability, data] = sorted[0];

  return {
    ability,
    abilityLabel: ABILITY_LABELS[ability],
    reason: getRecommendationReason(ability, data),
    suggestedGames: getSuggestedGames(ability),
    suggestedDifficulty: getSuggestedDifficulty(data),
  };
};

const getSuggestedGames = (ability) => {
  const map = {
    workingMemory: ["CBT", "PM"],
    inhibition: ["SRT", "SSG"],
    cognitiveFlexibility: ["LB", "DCCS"],
  };

  return map[ability] || [];
};

const getSuggestedDifficulty = (data) => {
  if (data.warningLevel === "red") return "easy";
  if (data.warningLevel === "orange") return "normal";
  if (data.score >= 85) return "hard";

  return "normal";
};

const getRecommendationReason = (ability, data) => {
  const abilityLabel = ABILITY_LABELS[ability];

  if (data.warningLevel === "red") {
    return `${abilityLabel}目前較需要協助，建議先從簡單難度開始，並增加提示或放慢速度。`;
  }

  if (data.warningLevel === "orange") {
    return `${abilityLabel}有部分表現需要觀察，建議維持普通難度，讓孩子穩定練習。`;
  }

  return `${abilityLabel}目前表現穩定，可以維持訓練，也可以視情況增加挑戰。`;
};

const generateParentSummary = ({
  overallScore,
  abilityScores,
  riskLevel,
}) => {
  const weakest = getRecommendedTraining(abilityScores);

  if (riskLevel === "red") {
    return `本次整體表現需要多一些協助，綜合分數為 ${overallScore}。皮皮建議優先練習「${weakest.abilityLabel}」，並先從較簡單的任務開始。`;
  }

  if (riskLevel === "orange") {
    return `本次整體表現有些地方需要觀察，綜合分數為 ${overallScore}。可以先穩定練習「${weakest.abilityLabel}」。`;
  }

  return `本次整體表現穩定，綜合分數為 ${overallScore}。可以依照皮皮推薦繼續維持訓練。`;
};

const generateClinicalSummary = ({
  overallScore,
  abilityScores,
  riskLevel,
}) => {
  return {
    executiveFunctionScore: overallScore,

    riskLevel,

    workingMemoryScore:
      abilityScores.workingMemory?.score || 0,

    inhibitionScore:
      abilityScores.inhibition?.score || 0,

    cognitiveFlexibilityScore:
      abilityScores.cognitiveFlexibility?.score || 0,

    inattentionScore: calculateInattentionScore(abilityScores),

    impulsivityScore: calculateImpulsivityScore(abilityScores),
  };
};

const calculateInattentionScore = (abilityScores) => {
  const miss =
    Object.values(abilityScores).reduce(
      (sum, ability) => sum + (ability.errorTypes?.miss || 0),
      0
    );

  const timeout =
    Object.values(abilityScores).reduce(
      (sum, ability) => sum + (ability.errorTypes?.timeout || 0),
      0
    );

  return clamp(miss * 5 + timeout * 4, 0, 100);
};

const calculateImpulsivityScore = (abilityScores) => {
  const randomClick =
    Object.values(abilityScores).reduce(
      (sum, ability) =>
        sum + (ability.errorTypes?.randomClick || 0),
      0
    );

  const repeatedClick =
    Object.values(abilityScores).reduce(
      (sum, ability) =>
        sum + (ability.errorTypes?.repeatedClick || 0),
      0
    );

  return clamp(randomClick * 5 + repeatedClick * 4, 0, 100);
};

const average = (numbers = []) => {
  if (numbers.length === 0) return 0;

  return Math.round(
    numbers.reduce((sum, value) => sum + Number(value || 0), 0) /
      numbers.length
  );
};

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};