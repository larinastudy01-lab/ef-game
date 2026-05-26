// src/utils/lbScoring.js
// LB 評分邏輯
// 對應 ResultPage_LB.jsx：幼兒星級、家長雷達圖、醫療端詳細數據
//
// 使用方式：
// import calculateLBScore from "../utils/lbScoring";
//
// const scoreResult = calculateLBScore(trialLogs, {
//   mode: "test",
//   difficulty: "normal",
//   childAge: 4,
// });

const DEFAULT_OPTIONS = {
  mode: "test",
  difficulty: "normal",
  childAge: null,

  // LB 類型屬於規則判斷 + 規則切換任務
  // 幼兒作答不應只看速度，因此速度只佔 15%
  maxReactionTime: 5000,
  idealReactionTime: 900,

  // 全錯、全逾時或正確 RT 不足時，用於阻斷 NaN 的安全保底值
  fallbackReactionTime: 2500,
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min = 0, max = 100) {
  const n = toNumber(value, min);
  return Math.max(min, Math.min(max, n));
}

function average(arr) {
  const safeArr = arr
    .map((value) => toNumber(value, null))
    .filter(Number.isFinite);

  if (!safeArr.length) return 0;

  return safeArr.reduce((sum, value) => sum + value, 0) / safeArr.length;
}

function median(arr, fallback = 0) {
  const safeArr = arr
    .map((value) => toNumber(value, null))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!safeArr.length) return fallback;

  const middle = Math.floor(safeArr.length / 2);

  if (safeArr.length % 2 === 0) {
    return (safeArr[middle - 1] + safeArr[middle]) / 2;
  }

  return safeArr[middle];
}

function standardDeviation(arr) {
  const safeArr = arr
    .map((value) => toNumber(value, null))
    .filter(Number.isFinite);

  if (safeArr.length <= 1) return 0;

  const avg = average(safeArr);
  const variance =
    safeArr.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
    safeArr.length;

  return Math.sqrt(Math.max(0, variance));
}

function normalizeLogs(input) {
  if (Array.isArray(input)) return input;

  if (Array.isArray(input?.trialLogs)) return input.trialLogs;
  if (Array.isArray(input?.lbHistory)) return input.lbHistory;
  if (Array.isArray(input?.history)) return input.history;
  if (Array.isArray(input?.trials)) return input.trials;
  if (Array.isArray(input?.records)) return input.records;
  if (Array.isArray(input?.lbResult?.trialLogs)) return input.lbResult.trialLogs;

  return [];
}

function isCorrectTrial(trial) {
  return (
    trial?.isCorrect === true ||
    trial?.correct === true ||
    trial?.answerCorrect === true ||
    trial?.result === "correct" ||
    trial?.status === "correct"
  );
}

function isTimeoutTrial(trial) {
  return (
    trial?.isTimeout === true ||
    trial?.timeout === true ||
    trial?.result === "timeout" ||
    trial?.status === "timeout"
  );
}

function getReactionTime(trial) {
  return toNumber(
    trial?.reactionTime ??
      trial?.rt ??
      trial?.responseTime ??
      trial?.timeSpent ??
      trial?.answerTime,
    0
  );
}

function getRuleName(trial) {
  return (
    trial?.rule ||
    trial?.targetRule ||
    trial?.activeRule ||
    trial?.condition ||
    trial?.ruleType ||
    "未分類規則"
  );
}

function isSwitchTrial(trial, index, logs) {
  if (
    trial?.isSwitch === true ||
    trial?.switchTrial === true ||
    trial?.trialType === "switch" ||
    trial?.type === "switch"
  ) {
    return true;
  }

  if (index <= 0) return false;

  const currentRule = getRuleName(trial);
  const previousRule = getRuleName(logs[index - 1]);

  return (
    currentRule &&
    previousRule &&
    currentRule !== "未分類規則" &&
    previousRule !== "未分類規則" &&
    currentRule !== previousRule
  );
}

function hasInterference(trial) {
  return (
    trial?.hasInterference === true ||
    trial?.interference === true ||
    trial?.distractor === true ||
    trial?.hasDistractor === true ||
    trial?.isDistractorTrial === true ||
    trial?.trialType === "interference" ||
    trial?.type === "interference" ||
    trial?.difficulty === "hard" ||
    trial?.level === "hard"
  );
}

function getMaxConsecutiveErrors(logs) {
  let current = 0;
  let max = 0;

  logs.forEach((trial) => {
    if (!isCorrectTrial(trial)) {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  });

  return max;
}

function buildRuleBreakdown(logs) {
  const map = {};

  logs.forEach((trial) => {
    const rule = getRuleName(trial);

    if (!map[rule]) {
      map[rule] = {
        rule,
        total: 0,
        correct: 0,
        wrong: 0,
        timeout: 0,
        accuracy: 0,
        avgReactionTime: 0,
        reactionTimes: [],
      };
    }

    map[rule].total += 1;

    if (isCorrectTrial(trial)) {
      map[rule].correct += 1;
    } else if (isTimeoutTrial(trial)) {
      map[rule].timeout += 1;
    } else {
      map[rule].wrong += 1;
    }

    const rt = getReactionTime(trial);

    // 規則層級 RT 僅統計正確作答，避免錯誤/逾時污染速度解釋
    if (isCorrectTrial(trial) && rt > 0) {
      map[rule].reactionTimes.push(rt);
    }
  });

  return Object.values(map).map((item) => ({
    ...item,
    accuracy: item.total
      ? Math.round(clamp((item.correct / item.total) * 100))
      : 0,
    avgReactionTime: item.reactionTimes.length
      ? Math.round(average(item.reactionTimes))
      : 0,
  }));
}

function getSafeFallbackReactionTime(options, allReactionTimes = []) {
  const fallbackFromOptions = toNumber(options?.fallbackReactionTime, 0);
  const fallbackFromMedian = median(allReactionTimes, 0);
  const ideal = toNumber(
    options?.idealReactionTime,
    DEFAULT_OPTIONS.idealReactionTime
  );
  const max = toNumber(
    options?.maxReactionTime,
    DEFAULT_OPTIONS.maxReactionTime
  );
  const fallbackFromBounds = (ideal + max) / 2;

  return Math.round(
    clamp(
      fallbackFromMedian || fallbackFromOptions || fallbackFromBounds,
      1,
      Math.max(max, DEFAULT_OPTIONS.maxReactionTime)
    )
  );
}

function buildReactionTimeStats(logs, options) {
  const allReactionTimes = logs.map(getReactionTime).filter((rt) => rt > 0);

  const correctReactionTimes = logs
    .filter(isCorrectTrial)
    .map(getReactionTime)
    .filter((rt) => rt > 0);

  const fallbackMedian = getSafeFallbackReactionTime(options, allReactionTimes);

  // 重點防線：
  // 全錯 / 全逾時時，正確 RT 會是 0 筆。
  // 此時仍建立一筆安全保底 RT，避免 average / std / CV 鏈條產生 NaN。
  const rtForStats = correctReactionTimes.length
    ? correctReactionTimes
    : [fallbackMedian];

  return {
    reactionTimes: allReactionTimes,
    correctReactionTimes,
    correctRtCount: correctReactionTimes.length,
    fallbackMedian,
    avgReactionTime: Math.round(average(rtForStats)),
    rtStd: Math.round(standardDeviation(rtForStats)),
  };
}

function calculateProcessingSpeedScore(avgReactionTime, options, correctRtCount) {
  if (!Number.isFinite(avgReactionTime) || avgReactionTime <= 0) return 0;

  // 全錯或全逾時時，不用保底 RT 人為灌高速度分數
  if (correctRtCount <= 0) return 0;

  const ideal = toNumber(
    options.idealReactionTime,
    DEFAULT_OPTIONS.idealReactionTime
  );
  const max = toNumber(
    options.maxReactionTime,
    DEFAULT_OPTIONS.maxReactionTime
  );

  if (max <= ideal) return 0;
  if (avgReactionTime <= ideal) return 100;

  const score = 100 - ((avgReactionTime - ideal) / (max - ideal)) * 100;
  return Math.round(clamp(score));
}

function calculateStabilityScore(rtStd, avgReactionTime, correctRtCount) {
  if (!Number.isFinite(avgReactionTime) || avgReactionTime <= 0) return 0;

  // 沒有任何正確 RT 時，代表穩定度沒有可解釋的正確作答基礎
  if (correctRtCount <= 0) return 0;

  // 只有一筆正確 RT 無法估計變異，給保守中間分，避免單題猜對被高估
  if (correctRtCount === 1) return 60;

  const cv = rtStd / avgReactionTime;

  if (!Number.isFinite(cv)) return 0;

  if (cv <= 0.2) return 100;
  if (cv <= 0.35) return 85;
  if (cv <= 0.5) return 70;
  if (cv <= 0.7) return 55;

  return 40;
}

function calculateInterferenceAccuracy(interferenceTrials) {
  // 如果測驗沒有設計干擾題，不應該把抗干擾能力直接打 0
  if (!interferenceTrials.length) return 75;

  const correct = interferenceTrials.filter(isCorrectTrial).length;

  // 抗干擾指標改為「干擾題正確率百分比」
  // 避免測驗/訓練總題數不同時，用錯誤絕對次數造成診斷偏誤
  return Math.round(clamp((correct / interferenceTrials.length) * 100));
}

function applyAgeAdjustment(score, childAge) {
  const safeScore = clamp(score);
  const age = toNumber(childAge, null);

  // 未設定身分、null、undefined、空字串、NaN、非合理年齡時，不做校正
  if (!Number.isFinite(age) || age <= 0) {
    return safeScore;
  }

  // 2~3 歲幼兒速度與穩定度發展差異較大，因此略微放寬
  if (age <= 3) return clamp(safeScore + 5);

  // 5 歲以上可稍微提高規則切換標準
  if (age >= 5) return clamp(safeScore - 2);

  return safeScore;
}

function getStars(finalScore, accuracy, switchAccuracy) {
  if (finalScore >= 80 && accuracy >= 75 && switchAccuracy >= 65) {
    return 3;
  }

  if (finalScore >= 55 && accuracy >= 50) {
    return 2;
  }

  return 1;
}

function getChildFeedback(stars) {
  if (stars === 3) {
    return "太棒了！你很會觀察規則，也能跟著變化完成任務！";
  }

  if (stars === 2) {
    return "做得不錯！再多練習幾次，你會更快找到正確規則！";
  }

  return "沒關係！我們再慢慢練習，先看清楚規則再選答案！";
}

function getParentSummary(finalScore, parentMetrics) {
  const weakItems = [];

  if (parentMetrics.ruleUnderstanding < 60) weakItems.push("規則理解");
  if (parentMetrics.cognitiveFlexibility < 60) weakItems.push("規則切換");
  if (parentMetrics.processingSpeed < 60) weakItems.push("反應速度");
  if (parentMetrics.attentionStability < 60) weakItems.push("作答穩定度");
  if (parentMetrics.interferenceControl < 60) weakItems.push("抗干擾能力");

  if (finalScore >= 80) {
    return "孩子在本次任務中能穩定理解規則，並在規則變化時維持良好的作答表現。";
  }

  if (finalScore >= 55) {
    if (weakItems.length) {
      return `孩子已具備基本規則判斷能力，後續可加強${weakItems.join(
        "、"
      )}。`;
    }

    return "孩子整體表現穩定，仍可透過重複練習提升反應速度與規則切換能力。";
  }

  if (weakItems.length) {
    return `孩子在本次任務中較容易受到規則變化影響，建議先從${weakItems.join(
      "、"
    )}開始練習。`;
  }

  return "孩子目前仍需要更多熟悉任務規則的時間，建議以簡單模式重複練習。";
}

function buildEmptyResult() {
  return {
    finalScore: 0,
    stars: 1,
    childFeedback: "還沒有完成測驗資料，請重新進行一次任務。",
    parentSummary: "目前沒有足夠資料可供分析。",
    parentMetrics: {
      ruleUnderstanding: 0,
      cognitiveFlexibility: 0,
      processingSpeed: 0,
      attentionStability: 0,
      interferenceControl: 0,
    },
    clinicianMetrics: {
      totalTrials: 0,
      correctTrials: 0,
      wrongTrials: 0,
      timeoutTrials: 0,
      accuracy: 0,
      switchAccuracy: 0,
      avgReactionTime: 0,
      rtStd: 0,
      correctRtCount: 0,
      correctReactionTimes: [],
      reactionTimes: [],
      fallbackMedianRt: DEFAULT_OPTIONS.fallbackReactionTime,
      maxConsecutiveErrors: 0,
      interferenceErrors: 0,
      interferenceAccuracy: 0,
      interferenceRate: 0,
      ruleBreakdown: [],
      trialLogs: [],
    },
  };
}

export default function calculateLBScore(inputLogs = [], userOptions = {}) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
  };

  const logs = normalizeLogs(inputLogs);
  const totalTrials = logs.length;

  if (totalTrials === 0) {
    return buildEmptyResult();
  }

  const correctTrials = logs.filter(isCorrectTrial).length;
  const timeoutTrials = logs.filter(isTimeoutTrial).length;
  const wrongTrials = totalTrials - correctTrials - timeoutTrials;

  const accuracy = Math.round(clamp((correctTrials / totalTrials) * 100));

  const {
    reactionTimes,
    correctReactionTimes,
    correctRtCount,
    fallbackMedian,
    avgReactionTime,
    rtStd,
  } = buildReactionTimeStats(logs, options);

  const switchTrials = logs.filter((trial, index) =>
    isSwitchTrial(trial, index, logs)
  );

  const switchCorrectTrials = switchTrials.filter(isCorrectTrial).length;

  const switchAccuracy = switchTrials.length
    ? Math.round(clamp((switchCorrectTrials / switchTrials.length) * 100))
    : accuracy;

  const interferenceTrials = logs.filter(hasInterference);

  const interferenceErrors = interferenceTrials.filter(
    (trial) => !isCorrectTrial(trial)
  ).length;

  // 抗干擾指標統一採用「干擾題正確率百分比」
  const interferenceAccuracy = calculateInterferenceAccuracy(interferenceTrials);

  // 為了相容舊 ResultPage 命名，interferenceRate 保留，但語意改為正確率百分比
  const interferenceRate = interferenceAccuracy;

  const parentMetrics = {
    ruleUnderstanding: Math.round(clamp(accuracy)),
    cognitiveFlexibility: Math.round(clamp(switchAccuracy)),
    processingSpeed: Math.round(
      clamp(
        calculateProcessingSpeedScore(
          avgReactionTime,
          options,
          correctRtCount
        )
      )
    ),
    attentionStability: Math.round(
      clamp(calculateStabilityScore(rtStd, avgReactionTime, correctRtCount))
    ),
    interferenceControl: Math.round(clamp(interferenceAccuracy)),
  };

  // LB 權重：
  // 規則理解 35%
  // 規則切換 25%
  // 反應速度 15%
  // 作答穩定 15%
  // 抗干擾 10%
  const rawFinalScore =
    parentMetrics.ruleUnderstanding * 0.35 +
    parentMetrics.cognitiveFlexibility * 0.25 +
    parentMetrics.processingSpeed * 0.15 +
    parentMetrics.attentionStability * 0.15 +
    parentMetrics.interferenceControl * 0.1;

  const finalScore = Math.round(
    applyAgeAdjustment(clamp(rawFinalScore), options.childAge)
  );

  const stars = getStars(finalScore, accuracy, switchAccuracy);

  const clinicianMetrics = {
    totalTrials,
    correctTrials,
    wrongTrials: Math.max(0, wrongTrials),
    timeoutTrials,
    accuracy,
    switchAccuracy,
    avgReactionTime,
    rtStd,
    correctRtCount,
    correctReactionTimes,
    reactionTimes,
    fallbackMedianRt: fallbackMedian,
    maxConsecutiveErrors: getMaxConsecutiveErrors(logs),

    // 舊欄位保留：錯誤絕對次數只給醫療端參考，不再作為抗干擾分數主體
    interferenceErrors,

    // 新主指標：干擾題正確率百分比
    interferenceAccuracy,
    interferenceRate,

    ruleBreakdown: buildRuleBreakdown(logs),
    trialLogs: logs,
  };

  return {
    finalScore,
    stars,
    childFeedback: getChildFeedback(stars),
    parentSummary: getParentSummary(finalScore, parentMetrics),
    parentMetrics,
    clinicianMetrics,
  };
}

export { calculateLBScore };