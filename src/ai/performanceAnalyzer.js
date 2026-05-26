// src/ai/performanceAnalyzer.js

export const analyzePerformance = ({
  totalTrials = 0,
  correctTrials = 0,
  reactionTimes = [],
  errorTypes = {},
  difficulty = "normal",
}) => {
  const safeTotalTrials = Math.max(totalTrials, 1);

  const accuracy = Math.round((correctTrials / safeTotalTrials) * 100);

  const validReactionTimes = reactionTimes.filter(
    (rt) => typeof rt === "number" && rt > 0
  );

  const avgReactionTime =
    validReactionTimes.length > 0
      ? Math.round(
          validReactionTimes.reduce((sum, rt) => sum + rt, 0) /
            validReactionTimes.length
        )
      : 0;

  const totalErrors = Object.values(errorTypes).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );

  let stars = 1;

  if (accuracy >= 85 && totalErrors <= 2) {
    stars = 3;
  } else if (accuracy >= 60 && totalErrors <= 6) {
    stars = 2;
  }

  let performanceLevel = "needsSupport";

  if (stars === 3) {
    performanceLevel = "stable";
  } else if (stars === 2) {
    performanceLevel = "developing";
  }

  let suggestedAction = "keep";

  if (accuracy < 60 || totalErrors >= 8) {
    suggestedAction = "decreaseDifficulty";
  } else if (accuracy >= 85 && totalErrors <= 2 && avgReactionTime > 0) {
    suggestedAction = "increaseDifficulty";
  }

  const parentSummary = generateParentSummary({
    accuracy,
    avgReactionTime,
    totalErrors,
    stars,
    difficulty,
  });

  return {
    accuracy,
    avgReactionTime,
    totalErrors,
    stars,
    performanceLevel,
    suggestedAction,
    parentSummary,
  };
};

const generateParentSummary = ({
  accuracy,
  avgReactionTime,
  totalErrors,
  stars,
  difficulty,
}) => {
  if (stars === 3) {
    return `本次表現穩定，正確率達 ${accuracy}%，錯誤次數較少，可以維持目前難度，或視情況嘗試更高挑戰。`;
  }

  if (stars === 2) {
    return `本次表現尚可，正確率為 ${accuracy}%，仍有少量錯誤。建議先維持 ${translateDifficulty(
      difficulty
    )} 難度，讓孩子熟悉規則後再提升。`;
  }

  return `本次表現需要多一些協助，正確率為 ${accuracy}%，錯誤次數為 ${totalErrors} 次。建議降低難度、放大目標或增加提示。`;
};

const translateDifficulty = (difficulty) => {
  const map = {
    easy: "簡單",
    normal: "普通",
    hard: "困難",
  };

  return map[difficulty] || difficulty;
};