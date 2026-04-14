// utils/pmScoring.js


function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, n) => sum + n, 0) / arr.length;
}

function standardDeviation(arr) {
  if (!arr || arr.length <= 1) return 0;
  const avg = average(arr);
  const variance =
    arr.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

// ============================================
// 基本資料整理
// ============================================

export function getPMBasicStats(records = []) {
  if (!records || records.length === 0) {
    return {
      totalLevels: 0,
      correctCount: 0,
      timeoutCount: 0,
      accuracy: 0,
      highestPassedLevel: 0,
      memorySpan: 0,
      averageReactionTime: 0,
      averageCorrectReactionTime: 0,
      averageWrongReactionTime: 0,
      reactionTimeStd: 0,
      totalTapCount: 0,
      wrongTapCount: 0,
      deselectCount: 0,
      averageFirstTapTime: 0,
    };
  }

  const correctRecords = records.filter((r) => r.isCorrect);
  const wrongRecords = records.filter((r) => !r.isCorrect && !r.isTimeout);
  const timeoutRecords = records.filter((r) => r.isTimeout);

  const reactionTimes = records.map((r) => r.reactionTime || 0);
  const correctReactionTimes = correctRecords.map((r) => r.reactionTime || 0);
  const wrongReactionTimes = wrongRecords.map((r) => r.reactionTime || 0);

  const highestPassedLevel =
    correctRecords.length > 0
      ? Math.max(...correctRecords.map((r) => r.level || 0))
      : 0;

  const memorySpan =
    correctRecords.length > 0
      ? Math.max(...correctRecords.map((r) => r.memoryCount || 0))
      : 0;

  const allTapLogs = records.flatMap((r) => r.tapLogs || []);

  const wrongTapCount = allTapLogs.filter(
    (t) => t.action === "select" && !t.isCorrectItem
  ).length;

  const deselectCount = allTapLogs.filter(
    (t) => t.action === "deselect"
  ).length;

  const firstTapTimes = records
    .map((r) => (r.tapLogs && r.tapLogs.length > 0 ? r.tapLogs[0].timestamp : null))
    .filter((v) => v !== null);

  return {
    totalLevels: records.length,
    correctCount: correctRecords.length,
    timeoutCount: timeoutRecords.length,
    accuracy: records.length > 0 ? correctRecords.length / records.length : 0,

    highestPassedLevel,
    memorySpan,

    averageReactionTime: Math.round(average(reactionTimes)),
    averageCorrectReactionTime: Math.round(average(correctReactionTimes)),
    averageWrongReactionTime: Math.round(average(wrongReactionTimes)),
    reactionTimeStd: Math.round(standardDeviation(reactionTimes)),

    totalTapCount: allTapLogs.length,
    wrongTapCount,
    deselectCount,
    averageFirstTapTime: Math.round(average(firstTapTimes)),
  };
}

// ============================================
// 1) 星級（幼兒端）
// ============================================

export function calculatePMStars(records = []) {
  if (!records || records.length === 0) return 0;

  const stats = getPMBasicStats(records);

  const { highestPassedLevel, accuracy, timeoutCount, totalLevels } = stats;

  let star = 0;

  if (highestPassedLevel >= 1 || accuracy > 0) star = 1;
  if (highestPassedLevel >= 3 && accuracy >= 0.5) star = 2;
  if (highestPassedLevel >= 5 && accuracy >= 0.7) star = 3;

  // ⭐ 提前完成加成（只新增這段）
  const fastCount = records.filter((r) => r.isFast && r.isCorrect).length;
  const fastRate = records.length > 0 ? fastCount / records.length : 0;
  if (star === 2 && fastRate >= 0.5) star = 3;

  // timeout 懲罰（原本保留）
  if (totalLevels > 0 && timeoutCount / totalLevels >= 0.5) {
    star = Math.max(1, star - 1);
  }

  return clamp(star, 0, 3);
}

// ============================================
// 2) 雷達圖（家長端）
// ============================================

export function calculatePMRadar(records = []) {
  if (!records || records.length === 0) {
    return [
      { subject: "記憶力", value: 0, fullMark: 100 },
      { subject: "反應速度", value: 0, fullMark: 100 },
      { subject: "專注力", value: 0, fullMark: 100 },
      { subject: "作答穩定度", value: 0, fullMark: 100 },
    ];
  }

  const stats = getPMBasicStats(records);

  const {
    accuracy,
    highestPassedLevel,
    memorySpan,
    averageReactionTime,
    reactionTimeStd,
    wrongTapCount,
    deselectCount,
    timeoutCount,
    totalLevels,
  } = stats;

  const memoryScore = clamp(
    highestPassedLevel * 10 + memorySpan * 6 + accuracy * 40,
    0,
    100
  );

  let speedScore = 0;
  if (averageReactionTime <= 2000) speedScore = 100;
  else if (averageReactionTime >= 10000) speedScore = 20;
  else {
    speedScore = 100 - ((averageReactionTime - 2000) / 8000) * 80;
  }
  speedScore = clamp(Math.round(speedScore), 0, 100);

  const timeoutPenalty =
    totalLevels > 0 ? (timeoutCount / totalLevels) * 35 : 0;

  const wrongTapPenalty =
    totalLevels > 0 ? (wrongTapCount / totalLevels) * 8 : 0;

  const attentionScore = clamp(
    75 + accuracy * 25 - timeoutPenalty - wrongTapPenalty,
    0,
    100
  );

  const rtStabilityPenalty = Math.min(reactionTimeStd / 40, 40);
  const deselectPenalty = Math.min(deselectCount * 5, 25);
  const wrongPenalty = Math.min(wrongTapCount * 4, 25);

  const stabilityScore = clamp(
    100 - rtStabilityPenalty - deselectPenalty - wrongPenalty,
    0,
    100
  );

  return [
    { subject: "記憶力", value: Math.round(memoryScore), fullMark: 100 },
    { subject: "反應速度", value: Math.round(speedScore), fullMark: 100 },
    { subject: "專注力", value: Math.round(attentionScore), fullMark: 100 },
    { subject: "作答穩定度", value: Math.round(stabilityScore), fullMark: 100 },
  ];
}

// ============================================
// 3) 詳細資料（醫療 / 詳細頁）
// ============================================

export function calculatePMDetails(records = []) {
  const stats = getPMBasicStats(records);

  return {
    ...stats,

    accuracyPercent: Math.round(stats.accuracy * 100),

    levelSummaries: records.map((r) => {
      const wrongTapCount = (r.tapLogs || []).filter(
        (t) => t.action === "select" && !t.isCorrectItem
      ).length;

      const deselectCount = (r.tapLogs || []).filter(
        (t) => t.action === "deselect"
      ).length;

      const firstTapTime =
        r.tapLogs && r.tapLogs.length > 0 ? r.tapLogs[0].timestamp : null;

      return {
        level: r.level,
        memoryCount: r.memoryCount,
        showTime: r.showTime,
        isCorrect: r.isCorrect,
        isTimeout: r.isTimeout,
        reactionTime: r.reactionTime,
        selectedIds: r.selectedIds || [],
        correctIds: r.correctIds || [],
        wrongTapCount,
        deselectCount,
        firstTapTime,
        tapLogs: r.tapLogs || [],
      };
    }),
  };
}

export function getPMPerformanceLabel(records = []) {
  const stars = calculatePMStars(records);

  if (stars === 3) return "表現優秀";
  if (stars === 2) return "表現良好";
  if (stars === 1) return "持續加油";
  return "再試一次";
}