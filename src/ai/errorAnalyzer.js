export const analyzeErrors = (errorTypes) => {
  const totalErrors =
    errorTypes.miss +
    errorTypes.randomClick +
    errorTypes.wrongTarget +
    errorTypes.repeatedClick +
    errorTypes.timeout +
    errorTypes.sequenceError +
    errorTypes.ruleSwitchError;

  let warningLevel = "green";

  if (totalErrors >= 10) {
    warningLevel = "red";
  } else if (totalErrors >= 5) {
    warningLevel = "orange";
  }

  return {
    totalErrors,
    warningLevel,
  };
};