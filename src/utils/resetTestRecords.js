const GAME_IDS = ["SSG", "DCCS", "PM", "CBT", "LB", "SRT"];

const LEGACY_RESULT_KEYS = {
  SRT: ["srtTestResult", "SRT_RESULT", "srtResult", "testResult_SRT", "SRT_testResult"],
  PM: ["pmTestResult", "PM_RESULT", "pmResult", "pictureMemoryTestResult", "testResult_PM", "PM_testResult"],
  CBT: ["cbtTestResult", "CBT_RESULT", "cbtResult", "testResult_CBT", "CBT_testResult"],
  SSG: ["ssgTestResult", "SSG_RESULT", "testResult_SSG", "SSG_testResult"],
  DCCS: ["dccsTestResult", "DCCS_RESULT", "dccsResult", "testResult_DCCS", "DCCS_testResult"],
  LB: ["lbTestResult", "LB_RESULT", "linkingBalloonsTestResult", "testResult_LB", "LB_testResult"],
};

const LEGACY_STAR_KEYS = {
  SRT: ["srtStars", "srt_stars", "SRT_stars", "trainingSrtStars", "srtTrainingStars", "srtTrainingResult"],
  PM: ["pmStars", "pm_stars", "PM_stars", "trainingPmStars", "pmTrainingStars", "pmTrainingResult"],
  CBT: ["cbtStars", "cbt_stars", "CBT_stars", "trainingCbtStars", "cbtTrainingStars", "cbtTrainingResult"],
  SSG: ["ssgStars", "ssg_stars", "SSG_stars", "trainingSsgStars", "ssgTrainingStars", "ssgTrainingResult"],
  DCCS: ["dccsStars", "dccs_stars", "DCCS_stars", "trainingDccsStars", "dccsTrainingStars", "dccsTrainingResult"],
  LB: ["lbStars", "lb_stars", "LB_stars", "trainingLbStars", "lbTrainingStars", "lbTrainingResult"],
};

const SHARED_KEYS = [
  "ef_latest_results",
  "ef_ai_recommendation",
  "ef_current_test_flow",
  "latestResults",
  "latestTestResults",
  "parentLatestResults",
  "aiRecommendation",
  "aiDifficultyRecommendation",
  "recommendedDifficulty",
  "trainingRecommendation",
  "currentAIRecommendation",
  "latestRecommendation",
  "currentTestFlow",
];

const removeFromBrowserStorage = (key) => {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
};

export const resetTestRecords = (childId) => {
  GAME_IDS.forEach((gameId) => {
    const lowerGameId = gameId.toLowerCase();
    const canonicalKeys = [
      `ef_${lowerGameId}_test_result`,
      `ef_${lowerGameId}_training_summary`,
      `ef_${lowerGameId}_stars`,
      `ef_test_${gameId}_completed`,
    ];
    const legacyKeys = [
      ...(LEGACY_RESULT_KEYS[gameId] || []),
      ...(LEGACY_STAR_KEYS[gameId] || []),
    ];
    const childScopedKeys = childId
      ? [
          `result:${childId}:${gameId}:test`,
          `ef_test_${gameId}_completed_${childId}`,
          ...canonicalKeys.map((key) => `${key}_${childId}`),
          ...legacyKeys.map((key) => `${key}_${childId}`),
        ]
      : [];

    [...canonicalKeys, ...legacyKeys, ...childScopedKeys].forEach(removeFromBrowserStorage);
  });

  SHARED_KEYS.forEach(removeFromBrowserStorage);
};
