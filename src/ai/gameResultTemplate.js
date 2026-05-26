export const createGameResult = ({
  childId,
  gameId,
  abilityType,
  mode,
  difficulty,
  score,
  stars,
  accuracy,
  avgReactionTime,
  totalPlayTime,
  errorTypes = {},
  fatigueLevel = "low",
  attemptCount = 1,
}) => {
  return {
    childId,

    gameId, // PM / CBT / SRT ...

    abilityType, // memory / inhibition / flexibility

    mode, // training / test

    difficulty, // easy / normal / hard

    score,
    stars,

    accuracy,

    avgReactionTime,

    totalPlayTime,

    errorTypes: {
      miss: errorTypes.miss || 0,
      randomClick: errorTypes.randomClick || 0,
      wrongTarget: errorTypes.wrongTarget || 0,
      repeatedClick: errorTypes.repeatedClick || 0,
      timeout: errorTypes.timeout || 0,
      sequenceError: errorTypes.sequenceError || 0,
      ruleSwitchError: errorTypes.ruleSwitchError || 0,
    },

    fatigueLevel,

    attemptCount,

    createdAt: new Date().toISOString(),
  };
};