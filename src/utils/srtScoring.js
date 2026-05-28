// src/utils/srtScoring.js

/*
  =========================================================
  srtScoring.js
  Simple Reaction Time / SRT 評分邏輯

  評分目標：
  1. 正確率 Accuracy：35 分
  2. 反應速度 Speed：25 分
  3. 反應穩定度 Stability：15 分
  4. 注意力維持 Attention：10 分
  5. 干擾抑制 Inhibition：10 分
     - 壞橡實出現時，能不能忍住不點
  6. 獎勵搜尋 Reward Search：5 分
     - 金色橡實出現時，能不能成功點到

  星星保護條件：
  - 正確率 < 60%：最多 1 星
  - 漏點 / 逾時率 > 35%：最多 1 星
  - 壞橡實誤點率 > 40%：最多 2 星

  重要防呆：
  - 反應時間 < 150ms 視為預期性誤觸雜訊，不納入 RT、誤點、壞橡實懲罰。
  - attentionDrop 需至少 2 筆有效正確 RT，且前後半皆有資料才計算。
  - golden / rotten 特殊題型分母需大於 0 才計算比例或扣分。
  =========================================================
*/

const MIN_VALID_REACTION_TIME_MS = 150;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidReactionTime(value) {
  return isFiniteNumber(value) && value >= MIN_VALID_REACTION_TIME_MS;
}

function isAnticipatoryNoise(record) {
  return (
    isFiniteNumber(record?.reactionTime) &&
    record.reactionTime > 0 &&
    record.reactionTime < MIN_VALID_REACTION_TIME_MS
  );
}

function roundNumber(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(numbers) {
  const validNumbers = safeArray(numbers).filter(isFiniteNumber);

  if (validNumbers.length === 0) return null;

  return validNumbers.reduce((acc, n) => acc + n, 0) / validNumbers.length;
}

function standardDeviation(numbers) {
  const validNumbers = safeArray(numbers).filter(isFiniteNumber);

  if (validNumbers.length < 2) return null;

  const mean = average(validNumbers);
  if (mean === null) return null;

  const variance =
    validNumbers.reduce((acc, n) => acc + (n - mean) ** 2, 0) /
    validNumbers.length;

  return Math.sqrt(variance);
}

function percentage(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return roundNumber((part / total) * 100, 0) ?? 0;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampScore(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function isTargetType(record, targetTypes = []) {
  return targetTypes.includes(record?.targetType);
}

function isRottenRecord(record) {
  return isTargetType(record, ["rotten", "broken"]);
}

function isClickedRotten(record) {
  if (!isRottenRecord(record)) return false;
  if (isAnticipatoryNoise(record)) return false;

  return (
    record?.trainingAction === "clickedRotten" ||
    record?.clickedRotten === true ||
    record?.isCorrect === false
  );
}

function isGoldenHit(record) {
  if (record?.targetType !== "golden") return false;
  if (isAnticipatoryNoise(record)) return false;

  return record?.isCorrect === true || record?.trainingAction === "hit";
}

function isActionFalseClick(record) {
  if (isAnticipatoryNoise(record)) return false;

  return record?.falseClick === true || record?.trainingAction === "falseClick";
}

function splitValidReactionTimesForAttention(validRtRecords) {
  const validRecords = safeArray(validRtRecords).filter((r) =>
    isValidReactionTime(r?.reactionTime)
  );

  if (validRecords.length < 2) {
    return {
      firstHalfRt: [],
      secondHalfRt: [],
      firstHalfAvg: null,
      secondHalfAvg: null,
      attentionDrop: null,
      attentionValidCount: validRecords.length,
      attentionDataSufficient: false,
    };
  }

  const halfIndex = Math.ceil(validRecords.length / 2);

  const firstHalfRt = validRecords
    .slice(0, halfIndex)
    .map((r) => r.reactionTime);

  const secondHalfRt = validRecords
    .slice(halfIndex)
    .map((r) => r.reactionTime);

  if (firstHalfRt.length === 0 || secondHalfRt.length === 0) {
    return {
      firstHalfRt,
      secondHalfRt,
      firstHalfAvg: null,
      secondHalfAvg: null,
      attentionDrop: null,
      attentionValidCount: validRecords.length,
      attentionDataSufficient: false,
    };
  }

  const firstHalfAvg = roundNumber(average(firstHalfRt), 0);
  const secondHalfAvg = roundNumber(average(secondHalfRt), 0);

  const attentionDrop =
    firstHalfAvg !== null && secondHalfAvg !== null
      ? roundNumber(secondHalfAvg - firstHalfAvg, 0)
      : null;

  return {
    firstHalfRt,
    secondHalfRt,
    firstHalfAvg,
    secondHalfAvg,
    attentionDrop,
    attentionValidCount: validRecords.length,
    attentionDataSufficient: attentionDrop !== null,
  };
}

/* =========================
   分數轉換
   ========================= */

function getAccuracyScore(accuracyRate) {
  if (!Number.isFinite(accuracyRate)) return 0;
  return roundNumber(clamp(accuracyRate, 0, 1) * 35, 0) ?? 0;
}

function getSpeedScore(avgReactionTime) {
  if (avgReactionTime === null || avgReactionTime === undefined) return 0;
  if (!Number.isFinite(avgReactionTime)) return 0;

  if (avgReactionTime <= 500) return 25;
  if (avgReactionTime <= 650) return 22;
  if (avgReactionTime <= 850) return 18;
  if (avgReactionTime <= 1100) return 13;
  if (avgReactionTime <= 1400) return 8;

  return 4;
}

function getStabilityScore(rtStd) {
  if (rtStd === null || rtStd === undefined) return 0;
  if (!Number.isFinite(rtStd)) return 0;

  if (rtStd <= 120) return 15;
  if (rtStd <= 180) return 13;
  if (rtStd <= 260) return 10;
  if (rtStd <= 400) return 7;
  if (rtStd <= 600) return 4;

  return 2;
}

function getAttentionScore(attentionDrop) {
  if (attentionDrop === null || attentionDrop === undefined) return 5;
  if (!Number.isFinite(attentionDrop)) return 5;

  if (attentionDrop <= 50) return 10;
  if (attentionDrop <= 120) return 8;
  if (attentionDrop <= 220) return 6;
  if (attentionDrop <= 350) return 4;

  return 2;
}

function getInhibitionScore(rottenClickRate, rottenTotal) {
  if (!Number.isFinite(rottenTotal) || rottenTotal <= 0) return 10;
  if (!Number.isFinite(rottenClickRate)) return 10;

  let score = 10;

  if (rottenClickRate > 5) score = 8;
  if (rottenClickRate > 15) score = 6;
  if (rottenClickRate > 30) score = 3;
  if (rottenClickRate > 45) score = 1;

  return Math.max(0, score);
}

function getRewardSearchScore(goldenHitRate, goldenTotal) {
  if (!Number.isFinite(goldenTotal) || goldenTotal <= 0) return 5;
  if (!Number.isFinite(goldenHitRate)) return 5;

  if (goldenHitRate >= 85) return 5;
  if (goldenHitRate >= 65) return 4;
  if (goldenHitRate >= 45) return 3;
  if (goldenHitRate >= 25) return 2;

  return 1;
}

/* =========================
   星級與文字
   ========================= */

function getBaseStarRating(totalScore) {
  if (totalScore >= 80) return 3;
  if (totalScore >= 60) return 2;
  return 1;
}

function getStarGuards({
  accuracyPercent,
  missRate,
  rottenClickRate,
  rottenTotal,
}) {
  let maxStars = 3;
  const reasons = [];

  if (Number.isFinite(accuracyPercent) && accuracyPercent < 60) {
    maxStars = Math.min(maxStars, 1);
    reasons.push("accuracy_below_60");
  }

  if (Number.isFinite(missRate) && missRate > 35) {
    maxStars = Math.min(maxStars, 1);
    reasons.push("miss_rate_above_35");
  }

  if (
    rottenTotal > 0 &&
    Number.isFinite(rottenClickRate) &&
    rottenClickRate > 40
  ) {
    maxStars = Math.min(maxStars, 2);
    reasons.push("rotten_click_rate_above_40");
  }

  return { maxStars, reasons };
}

function getStarRating(totalScore, guards = {}) {
  const baseStars = getBaseStarRating(totalScore);
  const maxStars = guards.maxStars || 3;

  return Math.max(1, Math.min(baseStars, maxStars));
}

function getChildMessage(stars) {
  if (stars === 3) {
    return "太棒了！你反應很快，也很專心完成任務！";
  }

  if (stars === 2) {
    return "做得很好！你已經抓到節奏了，再練習會更穩定！";
  }

  return "沒關係！慢慢來，多玩幾次會越來越熟悉！";
}

function getAccuracyLevel(accuracyPercent) {
  if (accuracyPercent >= 85) return "表現良好";
  if (accuracyPercent >= 65) return "尚可";
  return "需要加強";
}

function getSpeedLevel(avgReactionTime) {
  if (avgReactionTime === null) return "資料不足";
  if (avgReactionTime <= 650) return "反應快速";
  if (avgReactionTime <= 850) return "反應穩定";
  if (avgReactionTime <= 1100) return "反應稍慢";

  return "反應偏慢";
}

function getStabilityLevel(rtStd) {
  if (rtStd === null) return "資料不足";
  if (rtStd <= 180) return "反應穩定";
  if (rtStd <= 350) return "略有波動";

  return "反應不穩定";
}

function getAttentionLevel(attentionDrop) {
  if (attentionDrop === null) return "資料不足";
  if (attentionDrop <= 120) return "注意力維持良好";
  if (attentionDrop <= 300) return "後段略有變慢";

  return "後段明顯變慢";
}

function getInhibitionLevel(rottenClickRate, rottenTotal) {
  if (!rottenTotal || rottenTotal <= 0) return "本關未出現壞橡實";
  if (rottenClickRate <= 15) return "抑制控制穩定";
  if (rottenClickRate <= 30) return "偶爾衝動點擊";

  return "容易受到壞橡實干擾";
}

function getRewardSearchLevel(goldenHitRate, goldenTotal) {
  if (!goldenTotal || goldenTotal <= 0) return "本關未出現金色橡實";
  if (goldenHitRate >= 75) return "能注意到獎勵目標";
  if (goldenHitRate >= 45) return "偶爾漏掉獎勵目標";

  return "較容易漏掉獎勵目標";
}

/* =========================
   主要評分函式
   ========================= */

export function calculateSrtScore(inputRecords = []) {
  const records = safeArray(inputRecords);
  const totalTrials = records.length;

  const correctRecords = records.filter((r) => r?.isCorrect === true);

  const wrongRecords = records.filter(
    (r) =>
      r?.isCorrect === false &&
      r?.timeout !== true &&
      r?.missed !== true &&
      !isAnticipatoryNoise(r)
  );

  const timeoutRecords = records.filter((r) => r?.timeout === true);
  const missedRecords = records.filter((r) => r?.missed === true);
  const anticipatoryNoiseRecords = records.filter(isAnticipatoryNoise);
  const falseClickRecords = records.filter(isActionFalseClick);

  const correctCount = correctRecords.length;
  const wrongCount = wrongRecords.length;
  const timeoutCount = timeoutRecords.length;
  const missedCount = missedRecords.length;
  const anticipatoryNoiseCount = anticipatoryNoiseRecords.length;
  const falseClickCount = falseClickRecords.length;

  const accuracyRate = totalTrials > 0 ? correctCount / totalTrials : 0;
  const accuracyPercent = percentage(correctCount, totalTrials);
  const missRate = percentage(missedCount + timeoutCount, totalTrials);
  const falseClickRate = percentage(falseClickCount, totalTrials);

  const validCorrectRtRecords = correctRecords.filter((r) =>
    isValidReactionTime(r?.reactionTime)
  );

  const correctReactionTimes = validCorrectRtRecords.map((r) => r.reactionTime);
  const avgReactionTime = roundNumber(average(correctReactionTimes), 0);
  const rtStd = roundNumber(standardDeviation(correctReactionTimes), 0);

  const {
    firstHalfRt,
    secondHalfRt,
    firstHalfAvg,
    secondHalfAvg,
    attentionDrop,
    attentionValidCount,
    attentionDataSufficient,
  } = splitValidReactionTimesForAttention(validCorrectRtRecords);

  const normalRecords = records.filter((r) => r.targetType === "normal");
  const goldenRecords = records.filter((r) => r.targetType === "golden");
  const rottenRecords = records.filter(isRottenRecord);

  const normalCorrectCount = normalRecords.filter((r) => r.isCorrect).length;
  const goldenCorrectCount = goldenRecords.filter(isGoldenHit).length;

  const rottenCorrectCount = rottenRecords.filter(
    (r) => r.isCorrect === true && !isAnticipatoryNoise(r)
  ).length;

  const normalAccuracy = percentage(normalCorrectCount, normalRecords.length);
  const goldenAccuracy = percentage(goldenCorrectCount, goldenRecords.length);
  const rottenAccuracy = percentage(rottenCorrectCount, rottenRecords.length);

  const goldenTotal = goldenRecords.length;
  const goldenHitCount =
    goldenTotal > 0 ? goldenRecords.filter(isGoldenHit).length : 0;
  const goldenMissCount =
    goldenTotal > 0 ? Math.max(0, goldenTotal - goldenHitCount) : 0;
  const goldenHitRate =
    goldenTotal > 0 ? percentage(goldenHitCount, goldenTotal) : 0;

  const rottenTotal = rottenRecords.length;
  const clickedRottenCount =
    rottenTotal > 0 ? rottenRecords.filter(isClickedRotten).length : 0;
  const rottenAvoidedCount =
    rottenTotal > 0 ? Math.max(0, rottenTotal - clickedRottenCount) : 0;
  const rottenClickRate =
    rottenTotal > 0 ? percentage(clickedRottenCount, rottenTotal) : 0;
  const rottenAvoidRate =
    rottenTotal > 0 ? percentage(rottenAvoidedCount, rottenTotal) : 0;

  const accuracyScore = getAccuracyScore(accuracyRate);
  const speedScore = getSpeedScore(avgReactionTime);
  const stabilityScore = getStabilityScore(rtStd);
  const attentionScore = getAttentionScore(attentionDrop);
  const inhibitionScore = Math.max(
    0,
    getInhibitionScore(rottenClickRate, rottenTotal)
  );
  const rewardSearchScore = getRewardSearchScore(goldenHitRate, goldenTotal);

  const totalScore = clampScore(
    roundNumber(
      accuracyScore +
        speedScore +
        stabilityScore +
        attentionScore +
        inhibitionScore +
        rewardSearchScore,
      0
    ) ?? 0,
    0,
    100
  );

  const starGuards = getStarGuards({
    accuracyPercent,
    missRate,
    rottenClickRate,
    rottenTotal,
  });

  const stars = getStarRating(totalScore, starGuards);

  const parentAbilityScores = {
    responseAccuracy: accuracyPercent,
    reactionSpeed: roundNumber((speedScore / 25) * 100, 0),
    responseStability: roundNumber((stabilityScore / 15) * 100, 0),
    attentionMaintenance: roundNumber((attentionScore / 10) * 100, 0),
    inhibitionControl: roundNumber((inhibitionScore / 10) * 100, 0),
    rewardSearch: roundNumber((rewardSearchScore / 5) * 100, 0),
  };

  const distractorMetrics = {
    goldenTotal,
    goldenHitCount,
    goldenMissCount,
    goldenHitRate,
    rottenTotal,
    clickedRottenCount,
    rottenAvoidedCount,
    rottenClickRate,
    rottenAvoidRate,
  };

  return {
    taskName: "Simple Reaction Time",
    taskCode: "SRT",
    mode: "test",

    totalScore,
    stars,
    baseStars: getBaseStarRating(totalScore),
    starGuards,

    summary: {
      totalTrials,
      correctCount,
      wrongCount,
      timeoutCount,
      missedCount,
      falseClickCount,
      anticipatoryNoiseCount,

      accuracyRate,
      accuracyPercent,
      missRate,
      falseClickRate,

      avgReactionTime,
      rtStd,
      firstHalfAvg,
      secondHalfAvg,
      attentionDrop,
      attentionValidCount,
      attentionDataSufficient,
      firstHalfValidCount: firstHalfRt.length,
      secondHalfValidCount: secondHalfRt.length,

      normalAccuracy,
      goldenAccuracy,
      brokenAccuracy: rottenAccuracy,
      rottenAccuracy,

      ...distractorMetrics,
    },

    scoreBreakdown: {
      accuracyScore,
      speedScore,
      stabilityScore,
      attentionScore,
      inhibitionScore,
      rewardSearchScore,
    },

    childView: {
      stars,
      message: getChildMessage(stars),
      shortLabel:
        stars === 3 ? "表現很棒" : stars === 2 ? "表現不錯" : "繼續加油",
    },

    parentView: {
      abilityScores: parentAbilityScores,
      indicators: [
        {
          key: "responseAccuracy",
          label: "反應正確性",
          value: parentAbilityScores.responseAccuracy,
          level: getAccuracyLevel(accuracyPercent),
          description: "觀察孩子是否能在目標出現後，正確完成點擊反應。",
        },
        {
          key: "reactionSpeed",
          label: "反應速度",
          value: parentAbilityScores.reactionSpeed,
          level: getSpeedLevel(avgReactionTime),
          description: "觀察孩子看到目標後，能多快做出點擊反應。",
        },
        {
          key: "responseStability",
          label: "反應穩定度",
          value: parentAbilityScores.responseStability,
          level: getStabilityLevel(rtStd),
          description: "觀察孩子每一題的反應是否穩定，是否忽快忽慢。",
        },
        {
          key: "attentionMaintenance",
          label: "注意力維持",
          value: parentAbilityScores.attentionMaintenance,
          level: getAttentionLevel(attentionDrop),
          description: "觀察孩子後半段是否出現反應變慢或專注力下降。",
        },
        {
          key: "inhibitionControl",
          label: "干擾抑制",
          value: parentAbilityScores.inhibitionControl,
          level: getInhibitionLevel(rottenClickRate, rottenTotal),
          description: "觀察孩子看到壞橡實時，是否能先辨認並忍住不點。",
        },
        {
          key: "rewardSearch",
          label: "獎勵目標搜尋",
          value: parentAbilityScores.rewardSearch,
          level: getRewardSearchLevel(goldenHitRate, goldenTotal),
          description: "觀察孩子是否能注意到金色橡實，並成功完成點擊。",
        },
      ],
      plainLanguageSummary: buildParentSummary({
        accuracyPercent,
        avgReactionTime,
        rtStd,
        attentionDrop,
        missRate,
        goldenTotal,
        goldenHitRate,
        rottenTotal,
        rottenClickRate,
        attentionDataSufficient,
      }),
    },

    clinicalView: {
      totalTrials,
      correctCount,
      wrongCount,
      timeoutCount,
      missedCount,
      falseClickCount,
      anticipatoryNoiseCount,

      accuracyPercent,
      missRate,
      falseClickRate,

      avgReactionTime,
      rtStd,
      firstHalfAvg,
      secondHalfAvg,
      attentionDrop,
      attentionValidCount,
      attentionDataSufficient,
      firstHalfValidCount: firstHalfRt.length,
      secondHalfValidCount: secondHalfRt.length,

      normalAccuracy,
      goldenAccuracy,
      brokenAccuracy: rottenAccuracy,
      rottenAccuracy,

      ...distractorMetrics,

      interpretationFlags: buildClinicalFlags({
        accuracyPercent,
        avgReactionTime,
        rtStd,
        attentionDrop,
        attentionDataSufficient,
        attentionValidCount,
        timeoutCount,
        missedCount,
        falseClickCount,
        anticipatoryNoiseCount,
        totalTrials,
        goldenTotal,
        goldenHitRate,
        rottenTotal,
        rottenClickRate,
      }),

      records,
    },

    records,
    generatedAt: new Date().toISOString(),
  };
}

function buildParentSummary({
  accuracyPercent,
  avgReactionTime,
  rtStd,
  attentionDrop,
  missRate,
  goldenTotal,
  goldenHitRate,
  rottenTotal,
  rottenClickRate,
  attentionDataSufficient,
}) {
  const accuracyText =
    accuracyPercent >= 85
      ? "孩子大多能在目標出現後正確完成點擊。"
      : accuracyPercent >= 65
      ? "孩子可以完成部分反應，但偶爾會漏點或點錯。"
      : "孩子在目標出現後的正確反應仍需要更多練習。";

  const speedText =
    avgReactionTime === null
      ? "目前有效反應時間資料不足。"
      : avgReactionTime <= 650
      ? "反應速度整體很快。"
      : avgReactionTime <= 850
      ? "反應速度大致穩定。"
      : "反應速度較慢，可能需要更多時間注意到目標。";

  const stabilityText =
    rtStd === null
      ? "目前反應穩定度資料不足。"
      : rtStd <= 180
      ? "每題反應時間相當穩定。"
      : rtStd <= 350
      ? "反應時間略有波動。"
      : "反應時間變化較大，代表注意力穩定度可以再觀察。";

  const attentionText =
    !attentionDataSufficient || attentionDrop === null
      ? "目前有效題數不足，無法完整比較前後段注意力變化。"
      : attentionDrop <= 120
      ? "前後段表現差異不大，注意力維持良好。"
      : attentionDrop <= 300
      ? "後半段反應略有變慢，可能出現些微疲勞。"
      : "後半段反應明顯變慢，建議觀察是否有專注力下降。";

  const missText =
    missRate >= 25
      ? "另外，漏點或逾時比例偏高，可能需要確認孩子是否理解規則或是否容易分心。"
      : "";

  const inhibitionText =
    rottenTotal > 0 && rottenClickRate >= 35
      ? "在壞橡實出現時，孩子較容易衝動點擊，後續可降低干擾比例並練習先看清楚再點。"
      : rottenTotal > 0
      ? "孩子在壞橡實出現時大致能維持抑制控制。"
      : "";

  const rewardText =
    goldenTotal > 0 && goldenHitRate < 50
      ? "金色橡實的命中率較低，代表獎勵目標搜尋可以再練習。"
      : goldenTotal > 0
      ? "孩子能注意到金色橡實並完成點擊。"
      : "";

  return `${accuracyText}${speedText}${stabilityText}${attentionText}${missText}${inhibitionText}${rewardText}`;
}

function buildClinicalFlags({
  accuracyPercent,
  avgReactionTime,
  rtStd,
  attentionDrop,
  attentionDataSufficient,
  attentionValidCount,
  timeoutCount,
  missedCount,
  falseClickCount,
  anticipatoryNoiseCount,
  totalTrials,
  goldenTotal,
  goldenHitRate,
  rottenTotal,
  rottenClickRate,
}) {
  const flags = [];

  if (accuracyPercent < 60) {
    flags.push({
      type: "accuracy_low",
      level: "warning",
      message: "整體正確率偏低，建議觀察是否理解規則或是否有注意力維持困難。",
    });
  }

  if (avgReactionTime !== null && avgReactionTime > 1100) {
    flags.push({
      type: "reaction_slow",
      level: "notice",
      message: "平均反應時間偏慢，可能表示目標偵測或動作反應速度較慢。",
    });
  }

  if (rtStd !== null && rtStd > 350) {
    flags.push({
      type: "stability_low",
      level: "notice",
      message: "反應時間變異較大，可能代表注意力穩定度不足或反應節奏不穩。",
    });
  }

  if (!attentionDataSufficient && attentionValidCount < 2) {
    flags.push({
      type: "attention_data_insufficient",
      level: "notice",
      message:
        "有效正確反應時間少於 2 筆，未計算前後半注意力下降值以避免零除或 NaN。",
    });
  }

  if (attentionDrop !== null && attentionDrop > 300) {
    flags.push({
      type: "attention_drop",
      level: "warning",
      message: "後半段反應明顯變慢，可能代表疲勞或持續注意力下降。",
    });
  }

  if (totalTrials > 0 && timeoutCount / totalTrials >= 0.2) {
    flags.push({
      type: "timeout_high",
      level: "warning",
      message: "逾時比例偏高，建議確認孩子是否理解任務或反應時間限制是否過短。",
    });
  }

  if (totalTrials > 0 && missedCount / totalTrials >= 0.2) {
    flags.push({
      type: "miss_high",
      level: "warning",
      message: "漏點比例偏高，可能表示孩子沒有注意到目標或容易分心。",
    });
  }

  if (totalTrials > 0 && falseClickCount / totalTrials >= 0.2) {
    flags.push({
      type: "false_click_high",
      level: "notice",
      message: "誤點比例偏高，可能表示衝動點擊或尚未穩定掌握規則。",
    });
  }

  if (anticipatoryNoiseCount > 0) {
    flags.push({
      type: "anticipatory_noise_filtered",
      level: "notice",
      message:
        "已過濾小於 150ms 的預期性誤觸雜訊，避免污染反應時間與壞橡實懲罰。",
    });
  }

  if (rottenTotal > 0 && rottenClickRate >= 35) {
    flags.push({
      type: "inhibition_control_low",
      level: "warning",
      message: "壞橡實誤點率偏高，可能表示干擾抑制或衝動控制較不穩定。",
    });
  }

  if (goldenTotal >= 3 && goldenHitRate < 50) {
    flags.push({
      type: "reward_attention_low",
      level: "notice",
      message: "金色橡實命中率偏低，可能表示獎勵目標搜尋或視覺注意分配較不穩定。",
    });
  }

  if (flags.length === 0) {
    flags.push({
      type: "normal",
      level: "normal",
      message: "目前未看到明顯異常旗標，可搭配其他 EF 任務一起解讀。",
    });
  }

  return flags;
}

export function calculateSRTStar({
  hitRate = 0,
  avgRT = null,
  stdRT = null,
  firstHalfAvg = null,
  secondHalfAvg = null,
  totalTrials = 0,
  hitCount = 0,
  missCount = 0,
  falseClickCount = 0,
  reactionTimes = [],
}) {
  const validReactionTimes = safeArray(reactionTimes).filter(
    isValidReactionTime
  );

  const attentionFromReactionTimes = splitValidReactionTimesForAttention(
    validReactionTimes.map((reactionTime) => ({ reactionTime }))
  );

  const attentionDrop =
    firstHalfAvg !== null &&
    secondHalfAvg !== null &&
    Number.isFinite(firstHalfAvg) &&
    Number.isFinite(secondHalfAvg)
      ? roundNumber(secondHalfAvg - firstHalfAvg, 0)
      : attentionFromReactionTimes.attentionDrop;

  const accuracyRate = Number.isFinite(hitRate) ? hitRate / 100 : 0;

  const accuracyScore = getAccuracyScore(accuracyRate);
  const speedScore = getSpeedScore(avgRT);
  const stabilityScore = getStabilityScore(stdRT);
  const attentionScore = getAttentionScore(attentionDrop);

  const inhibitionScore = 10;
  const rewardSearchScore = 5;

  const totalScore = clampScore(
    roundNumber(
      accuracyScore +
        speedScore +
        stabilityScore +
        attentionScore +
        inhibitionScore +
        rewardSearchScore,
      0
    ) ?? 0,
    0,
    100
  );

  const missRate = percentage(missCount, totalTrials);

  const starGuards = getStarGuards({
    accuracyPercent: roundNumber(hitRate, 0) ?? 0,
    missRate,
    rottenClickRate: 0,
    rottenTotal: 0,
  });

  const stars = getStarRating(totalScore, starGuards);

  return {
    star: stars,
    stars,
    baseStars: getBaseStarRating(totalScore),
    starGuards,
    level: stars === 3 ? "表現很好" : stars === 2 ? "表現不錯" : "需再練習",
    feedback: getChildMessage(stars),
    totalScore,
    attentionDrop: roundNumber(attentionDrop, 0),

    parentMetrics: {
      accuracy: roundNumber(hitRate, 0),
      speed: roundNumber((speedScore / 25) * 100, 0),
      stability: roundNumber((stabilityScore / 15) * 100, 0),
      attention: roundNumber((attentionScore / 10) * 100, 0),
      inhibition: roundNumber((inhibitionScore / 10) * 100, 0),
      rewardSearch: roundNumber((rewardSearchScore / 5) * 100, 0),
    },

    clinicalMetrics: {
      totalTrials,
      hitCount,
      missCount,
      falseClickCount,
      hitRate,
      avgRT,
      stdRT,
      firstHalfAvg,
      secondHalfAvg,
      attentionDrop: roundNumber(attentionDrop, 0),
      attentionValidCount: attentionFromReactionTimes.attentionValidCount,
      attentionDataSufficient:
        attentionFromReactionTimes.attentionDataSufficient,
      reactionTimes: validReactionTimes,
    },
  };
}

export function getStoredSrtResult() {
  try {
    const raw = localStorage.getItem("srtTestResult");
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return calculateSrtScore(parsed);
    }

    if (Array.isArray(parsed.records)) {
      return {
        ...parsed,
        scoring: calculateSrtScore(parsed.records),
      };
    }

    return null;
  } catch (error) {
    console.error("讀取 SRT 測驗結果失敗：", error);
    return null;
  }
}

export default calculateSrtScore;