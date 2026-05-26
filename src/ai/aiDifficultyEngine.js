export const getRecommendedDifficulty = ({
  accuracy,
  avgReactionTime,
  errorTypes,
  fatigueLevel,
}) => {
  const totalErrors =
    Object.values(errorTypes).reduce(
      (sum, value) => sum + value,
      0
    );

  // 難度下降
  if (
    accuracy < 60 ||
    fatigueLevel === "high" ||
    totalErrors >= 10
  ) {
    return "easy";
  }

  // 難度提升
  if (
    accuracy >= 85 &&
    totalErrors <= 2 &&
    avgReactionTime < 1500
  ) {
    return "hard";
  }

  // 預設
  return "normal";
};