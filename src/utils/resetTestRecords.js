const GAME_IDS = ["SSG", "DCCS", "PM", "CBT", "LB", "SRT"];

const LEGACY_RESULT_KEYS = {
  SRT: ["srtTestResult", "latestSRTTestResult", "SRT_RESULT", "srtResult", "testResult_SRT", "SRT_testResult"],
  PM: ["pmTestResult", "latestPMTestResult", "PM_RESULT", "pmResult", "pictureMemoryTestResult", "testResult_PM", "PM_testResult"],
  CBT: [
    "cbtTestResult",
    "latestCBTTestResult",
    "ef_game_cbt_test_result",
    "CBT_RESULT",
    "cbtResult",
    "testResult_CBT",
    "CBT_testResult",
  ],
  SSG: ["ssgTestResult", "latestSSGTestResult", "SSG_RESULT", "testResult_SSG", "SSG_testResult"],
  DCCS: ["dccsTestResult", "latestDCCSTestResult", "DCCS_RESULT", "dccsResult", "testResult_DCCS", "DCCS_testResult"],
  LB: ["lbTestResult", "latestLBTestResult", "LB_RESULT", "linkingBalloonsTestResult", "testResult_LB", "LB_testResult"],
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

const removeTestResultsFromUnifiedHistory = (childId) => {
  [localStorage, sessionStorage].forEach((storage) => {
    try {
      const stored = JSON.parse(storage.getItem("efGameResults") || "[]");
      if (!Array.isArray(stored)) return;

      const remaining = stored.filter((result) => {
        const isTest = result?.session?.mode === "test" || result?.mode === "test";
        if (!isTest) return true;
        if (!childId) return false;

        const resultChildId =
          result?.child?.childId || result?.childId || result?.patientId || null;
        return resultChildId && String(resultChildId) !== String(childId);
      });

      if (remaining.length === 0) storage.removeItem("efGameResults");
      else storage.setItem("efGameResults", JSON.stringify(remaining));
    } catch {
      storage.removeItem("efGameResults");
    }
  });
};

export const resetTestRecords = (childId) => {
  GAME_IDS.forEach((gameId) => {
    const lowerGameId = gameId.toLowerCase();
    const canonicalKeys = [
      `ef_${lowerGameId}_test_result`,
      `ef_game_${lowerGameId}_test_result`,
      `ef_${lowerGameId}_training_summary`,
      `ef_${lowerGameId}_stars`,
      `ef_test_${gameId}_completed`,
      `result:${gameId}:test`,
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
  removeTestResultsFromUnifiedHistory(childId);
};
