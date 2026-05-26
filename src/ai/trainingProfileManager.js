export const getTrainingConfig = ({
  difficulty,
  childProfile,
}) => {
  const configs = {
    easy: {
      itemCount: 4,
      displayTime: 5,
      objectSize: "large",
      distractorCount: 0,
    },

    normal: {
      itemCount: 6,
      displayTime: 4,
      objectSize: "medium",
      distractorCount: 1,
    },

    hard: {
      itemCount: 8,
      displayTime: 3,
      objectSize: "small",
      distractorCount: 2,
    },
  };

  const baseConfig = configs[difficulty];

  // 個人化調整
  if (childProfile.needLargeObjects) {
    baseConfig.objectSize = "large";
  }

  return baseConfig;
};