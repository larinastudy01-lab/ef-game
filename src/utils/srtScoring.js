// src/utils/srtScoring.js

/*
  =========================================================
  SRT Scoring

  評分項目：
  1. 正確率 Accuracy：35
  2. 反應速度 Speed：25
  3. 反應穩定度 Stability：15
  4. 注意力維持 Attention：10
  5. 干擾抑制 Inhibition：10
  6. 獎勵搜尋 Reward Search：5

  重要規則：
  - 正式題目與背景誤點紀錄分開。
  - missed 與 timeout 同一題只計算一次。
  - 小於 150ms 的反應視為預期性誤觸，不納入 RT。
  - 壞橡實與金色橡實至少 3 題才納入該分項。
  - 前中後段至少 15 題才進行長時間注意力分析。
  - 無有效資料的分項不直接給 0 或滿分，而是以有效分項重新加權。
  - 相容舊版 correctReject / falseAlarm。
  =========================================================
*/

const MIN_VALID_REACTION_TIME_MS = 150;
const MIN_SPECIAL_TRIALS = 3;
const MIN_LONG_ATTENTION_TRIALS = 15;
const MIN_SCORING_TRIALS = 15;
const MIN_VALID_RT_COUNT = 8;

const SCORE_WEIGHTS = {
  accuracy: 35,
  speed: 25,
  stability: 15,
  attention: 10,
  inhibition: 10,
  rewardSearch: 5,
};

const TRIAL_TARGET_TYPES = new Set([
  "normal",
  "golden",
  "rotten",
  "broken",
]);

const TRIAL_ACTIONS = new Set([
  "hit",
  "correctAvoid",
  "clickedRotten",
  "miss",
  "timeout",
]);

/* =========================
   基礎工具
   ========================= */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function roundNumber(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values = []) {
  const validValues = safeArray(values).filter(isFiniteNumber);

  if (validValues.length === 0) {
    return null;
  }

  return (
    validValues.reduce((sum, value) => sum + value, 0) /
    validValues.length
  );
}

function standardDeviation(values = []) {
  const validValues = safeArray(values).filter(isFiniteNumber);

  if (validValues.length < 2) {
    return null;
  }

  const mean = average(validValues);

  if (mean === null) {
    return null;
  }

  const variance =
    validValues.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0
    ) / validValues.length;

  return Math.sqrt(variance);
}

function percentage(part, total) {
  if (
    !Number.isFinite(part) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return 0;
  }

  return roundNumber((part / total) * 100, 0) ?? 0;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function isValidReactionTime(value) {
  return (
    isFiniteNumber(value) &&
    value >= MIN_VALID_REACTION_TIME_MS
  );
}

function isAnticipatoryNoise(record) {
  return (
    isFiniteNumber(record?.reactionTime) &&
    record.reactionTime > 0 &&
    record.reactionTime < MIN_VALID_REACTION_TIME_MS
  );
}

/* =========================
   紀錄標準化
   ========================= */

function normalizeTrainingAction(action) {
  if (action === "correctReject") {
    return "correctAvoid";
  }

  if (action === "falseAlarm") {
    return "clickedRotten";
  }

  if (action === "falseClick") {
    return "backgroundClick";
  }

  return action || null;
}

function normalizeTargetType(targetType) {
  if (targetType === "broken") {
    return "rotten";
  }

  return targetType || null;
}

function normalizeSrtRecord(record = {}, index = 0) {
  const trainingAction = normalizeTrainingAction(
    record.trainingAction
  );

  const targetType = normalizeTargetType(
    record.targetType
  );

  const inferredCorrect =
    trainingAction === "hit" ||
    trainingAction === "correctAvoid";

  const inferredMiss =
    trainingAction === "miss" ||
    trainingAction === "timeout";

  return {
    ...record,

    trialIndex:
      record.trialIndex ??
      record.trial ??
      index + 1,

    trainingAction,
    targetType,

    isCorrect:
      typeof record.isCorrect === "boolean"
        ? record.isCorrect
        : inferredCorrect,

    missed:
      record.missed === true ||
      inferredMiss,

    timeout:
      record.timeout === true ||
      trainingAction === "timeout",

    clickedRotten:
      record.clickedRotten === true ||
      trainingAction === "clickedRotten",
  };
}

function isTrialRecord(record) {
  if (!record) {
    return false;
  }

  return (
    TRIAL_TARGET_TYPES.has(record.targetType) ||
    TRIAL_ACTIONS.has(record.trainingAction)
  );
}

function isBehaviorRecord(record) {
  return [
    "backgroundClick",
    "repeatedClick",
  ].includes(record?.trainingAction);
}

function isRottenRecord(record) {
  return record?.targetType === "rotten";
}

function isGoldenRecord(record) {
  return record?.targetType === "golden";
}

function isNormalRecord(record) {
  return record?.targetType === "normal";
}

function isHitRecord(record) {
  return (
    record?.trainingAction === "hit" &&
    !isAnticipatoryNoise(record)
  );
}

function isCorrectAvoidRecord(record) {
  return (
    record?.trainingAction === "correctAvoid" &&
    !isAnticipatoryNoise(record)
  );
}

function isClickedRotten(record) {
  if (!isRottenRecord(record)) {
    return false;
  }

  if (isAnticipatoryNoise(record)) {
    return false;
  }

  return (
    record?.trainingAction === "clickedRotten" ||
    record?.clickedRotten === true
  );
}

function isGoldenHit(record) {
  if (!isGoldenRecord(record)) {
    return false;
  }

  if (isAnticipatoryNoise(record)) {
    return false;
  }

  return (
    record?.trainingAction === "hit" ||
    record?.isCorrect === true
  );
}

/* =========================
   分段分析
   ========================= */

function splitIntoThirds(records = []) {
  const safeRecords = safeArray(records);

  if (safeRecords.length === 0) {
    return {
      firstThird: [],
      middleThird: [],
      lastThird: [],
    };
  }

  const firstEnd = Math.ceil(
    safeRecords.length / 3
  );

  const secondEnd = Math.ceil(
    (safeRecords.length * 2) / 3
  );

  return {
    firstThird: safeRecords.slice(0, firstEnd),
    middleThird: safeRecords.slice(
      firstEnd,
      secondEnd
    ),
    lastThird: safeRecords.slice(secondEnd),
  };
}

function summarizeSegment(records = []) {
  const trialRecords = safeArray(records).filter(
    isTrialRecord
  );

  const total = trialRecords.length;

  const hitRecords = trialRecords.filter(
    isHitRecord
  );

  const correctAvoidRecords =
    trialRecords.filter(
      isCorrectAvoidRecord
    );

  const missedOrTimeoutRecords =
    trialRecords.filter(
      (record) =>
        record.missed === true ||
        record.timeout === true
    );

  const rottenRecords =
    trialRecords.filter(isRottenRecord);

  const clickedRottenRecords =
    rottenRecords.filter(isClickedRotten);

  const assistEligibleRecords =
    trialRecords.filter((record) =>
      ["normal", "golden"].includes(
        record.targetType
      )
    );

  const assistedRecords =
    assistEligibleRecords.filter(
      (record) =>
        record.assisted === true
    );

  const validRtRecords =
    hitRecords.filter((record) =>
      isValidReactionTime(
        record.reactionTime
      )
    );

  const reactionTimes =
    validRtRecords.map(
      (record) => record.reactionTime
    );

  const avgRT = roundNumber(
    average(reactionTimes),
    0
  );

  const rtStd = roundNumber(
    standardDeviation(reactionTimes),
    0
  );

  const rtCV =
    avgRT !== null &&
    avgRT > 0 &&
    rtStd !== null
      ? roundNumber(rtStd / avgRT, 2)
      : null;

  const correctCount =
    hitRecords.length +
    correctAvoidRecords.length;

  return {
    total,
    correctCount,
    hitCount: hitRecords.length,
    correctAvoidCount:
      correctAvoidRecords.length,
    missedOrTimeoutCount:
      missedOrTimeoutRecords.length,
    rottenTotal: rottenRecords.length,
    clickedRottenCount:
      clickedRottenRecords.length,
    assistedCount:
      assistedRecords.length,
    assistEligibleCount:
      assistEligibleRecords.length,
    validRTCount:
      validRtRecords.length,

    accuracyPercent: percentage(
      correctCount,
      total
    ),

    missRate: percentage(
      missedOrTimeoutRecords.length,
      total
    ),

    rottenClickRate:
      rottenRecords.length > 0
        ? percentage(
            clickedRottenRecords.length,
            rottenRecords.length
          )
        : null,

    assistedRate: percentage(
      assistedRecords.length,
      assistEligibleRecords.length
    ),

    avgRT,
    rtStd,
    rtCV,
  };
}

function buildLongAttentionMetrics(
  trialRecords = []
) {
  const records = safeArray(
    trialRecords
  ).filter(isTrialRecord);

  if (
    records.length <
    MIN_LONG_ATTENTION_TRIALS
  ) {
    return {
      firstThird: null,
      middleThird: null,
      lastThird: null,

      rtSlowing: null,
      missIncrease: null,
      rottenClickIncrease: null,
      assistedRateIncrease: null,

      attentionDropScore: null,
      attentionDrop: null,

      dataSufficient: false,
      reason:
        `有效題數少於 ${MIN_LONG_ATTENTION_TRIALS} 題，暫不判斷前中後段注意力變化。`,
    };
  }

  const {
    firstThird,
    middleThird,
    lastThird,
  } = splitIntoThirds(records);

  const firstSummary =
    summarizeSegment(firstThird);

  const middleSummary =
    summarizeSegment(middleThird);

  const lastSummary =
    summarizeSegment(lastThird);

  const rtSlowing =
    firstSummary.avgRT !== null &&
    lastSummary.avgRT !== null
      ? lastSummary.avgRT -
        firstSummary.avgRT
      : null;

  const missIncrease =
    lastSummary.missRate -
    firstSummary.missRate;

  const rottenClickIncrease =
    (lastSummary.rottenClickRate ?? 0) -
    (firstSummary.rottenClickRate ?? 0);

  const assistedRateIncrease =
    lastSummary.assistedRate -
    firstSummary.assistedRate;

  const rtDropScore =
    rtSlowing === null
      ? 0
      : clamp(
          rtSlowing / 500,
          0,
          1
        );

  const missDropScore = clamp(
    missIncrease / 30,
    0,
    1
  );

  const rottenDropScore = clamp(
    rottenClickIncrease / 30,
    0,
    1
  );

  const assistDropScore = clamp(
    assistedRateIncrease / 40,
    0,
    1
  );

  const attentionDropScore = Math.round(
    (
      rtDropScore * 0.4 +
      missDropScore * 0.3 +
      rottenDropScore * 0.15 +
      assistDropScore * 0.15
    ) * 100
  );

  return {
    firstThird: firstSummary,
    middleThird: middleSummary,
    lastThird: lastSummary,

    rtSlowing,
    missIncrease,
    rottenClickIncrease,
    assistedRateIncrease,

    attentionDropScore,

    // 向下相容舊版結果頁
    attentionDrop:
      attentionDropScore,

    dataSufficient: true,
    reason: null,
  };
}

function buildHalfAttentionMetrics(
  validRtRecords = []
) {
  const records = safeArray(
    validRtRecords
  ).filter((record) =>
    isValidReactionTime(
      record?.reactionTime
    )
  );

  if (records.length < 2) {
    return {
      firstHalfAvg: null,
      secondHalfAvg: null,
      attentionRtSlowingMs: null,

      // 向下相容
      attentionDrop: null,

      firstHalfValidCount: 0,
      secondHalfValidCount: 0,
      attentionValidCount:
        records.length,
      attentionDataSufficient: false,
    };
  }

  const halfIndex = Math.ceil(
    records.length / 2
  );

  const firstHalf = records.slice(
    0,
    halfIndex
  );

  const secondHalf = records.slice(
    halfIndex
  );

  if (
    firstHalf.length === 0 ||
    secondHalf.length === 0
  ) {
    return {
      firstHalfAvg: null,
      secondHalfAvg: null,
      attentionRtSlowingMs: null,
      attentionDrop: null,
      firstHalfValidCount:
        firstHalf.length,
      secondHalfValidCount:
        secondHalf.length,
      attentionValidCount:
        records.length,
      attentionDataSufficient: false,
    };
  }

  const firstHalfAvg = roundNumber(
    average(
      firstHalf.map(
        (record) =>
          record.reactionTime
      )
    ),
    0
  );

  const secondHalfAvg = roundNumber(
    average(
      secondHalf.map(
        (record) =>
          record.reactionTime
      )
    ),
    0
  );

  const attentionRtSlowingMs =
    firstHalfAvg !== null &&
    secondHalfAvg !== null
      ? secondHalfAvg -
        firstHalfAvg
      : null;

  return {
    firstHalfAvg,
    secondHalfAvg,
    attentionRtSlowingMs,

    // 向下相容
    attentionDrop:
      attentionRtSlowingMs,

    firstHalfValidCount:
      firstHalf.length,
    secondHalfValidCount:
      secondHalf.length,
    attentionValidCount:
      records.length,
    attentionDataSufficient:
      attentionRtSlowingMs !== null,
  };
}

/* =========================
   分數換算
   ========================= */

function getAccuracyScore(
  accuracyPercent
) {
  if (
    !Number.isFinite(
      accuracyPercent
    )
  ) {
    return null;
  }

  return roundNumber(
    clamp(
      accuracyPercent / 100,
      0,
      1
    ) * SCORE_WEIGHTS.accuracy,
    0
  );
}

function getSpeedScore(
  avgReactionTime
) {
  if (
    avgReactionTime === null ||
    !Number.isFinite(
      avgReactionTime
    )
  ) {
    return null;
  }

  if (avgReactionTime <= 500) {
    return 25;
  }

  if (avgReactionTime <= 650) {
    return 22;
  }

  if (avgReactionTime <= 850) {
    return 18;
  }

  if (avgReactionTime <= 1100) {
    return 13;
  }

  if (avgReactionTime <= 1400) {
    return 8;
  }

  return 4;
}

function getStabilityScore(rtStd) {
  if (
    rtStd === null ||
    !Number.isFinite(rtStd)
  ) {
    return null;
  }

  if (rtStd <= 120) {
    return 15;
  }

  if (rtStd <= 180) {
    return 13;
  }

  if (rtStd <= 260) {
    return 10;
  }

  if (rtStd <= 400) {
    return 7;
  }

  if (rtStd <= 600) {
    return 4;
  }

  return 2;
}

function getAttentionScore(
  attentionRtSlowingMs,
  attentionDataSufficient
) {
  if (
    !attentionDataSufficient ||
    attentionRtSlowingMs === null ||
    !Number.isFinite(
      attentionRtSlowingMs
    )
  ) {
    return null;
  }

  if (
    attentionRtSlowingMs <= 50
  ) {
    return 10;
  }

  if (
    attentionRtSlowingMs <= 120
  ) {
    return 8;
  }

  if (
    attentionRtSlowingMs <= 220
  ) {
    return 6;
  }

  if (
    attentionRtSlowingMs <= 350
  ) {
    return 4;
  }

  return 2;
}

function getInhibitionScore({
  rottenClickRate,
  rottenTotal,
}) {
  if (
    rottenTotal <
    MIN_SPECIAL_TRIALS
  ) {
    return null;
  }

  if (
    !Number.isFinite(
      rottenClickRate
    )
  ) {
    return null;
  }

  if (rottenClickRate <= 5) {
    return 10;
  }

  if (rottenClickRate <= 15) {
    return 8;
  }

  if (rottenClickRate <= 30) {
    return 6;
  }

  if (rottenClickRate <= 45) {
    return 3;
  }

  return 1;
}

function getRewardSearchScore({
  goldenHitRate,
  goldenTotal,
}) {
  if (
    goldenTotal <
    MIN_SPECIAL_TRIALS
  ) {
    return null;
  }

  if (
    !Number.isFinite(
      goldenHitRate
    )
  ) {
    return null;
  }

  if (goldenHitRate >= 85) {
    return 5;
  }

  if (goldenHitRate >= 65) {
    return 4;
  }

  if (goldenHitRate >= 45) {
    return 3;
  }

  if (goldenHitRate >= 25) {
    return 2;
  }

  return 1;
}

function calculateWeightedTotal(
  breakdown
) {
  const items = [
    {
      key: "accuracyScore",
      score:
        breakdown.accuracyScore,
      max: SCORE_WEIGHTS.accuracy,
    },
    {
      key: "speedScore",
      score:
        breakdown.speedScore,
      max: SCORE_WEIGHTS.speed,
    },
    {
      key: "stabilityScore",
      score:
        breakdown.stabilityScore,
      max: SCORE_WEIGHTS.stability,
    },
    {
      key: "attentionScore",
      score:
        breakdown.attentionScore,
      max: SCORE_WEIGHTS.attention,
    },
    {
      key: "inhibitionScore",
      score:
        breakdown.inhibitionScore,
      max: SCORE_WEIGHTS.inhibition,
    },
    {
      key: "rewardSearchScore",
      score:
        breakdown.rewardSearchScore,
      max:
        SCORE_WEIGHTS.rewardSearch,
    },
  ];

  const validItems = items.filter(
    (item) =>
      Number.isFinite(item.score)
  );

  const earnedScore =
    validItems.reduce(
      (sum, item) =>
        sum + item.score,
      0
    );

  const availableScore =
    validItems.reduce(
      (sum, item) =>
        sum + item.max,
      0
    );

  const totalScore =
    availableScore > 0
      ? Math.round(
          (earnedScore /
            availableScore) *
            100
        )
      : 0;

  return {
    totalScore: clamp(
      totalScore,
      0,
      100
    ),
    earnedScore,
    availableScore,
    validScoreKeys:
      validItems.map(
        (item) => item.key
      ),
    unavailableScoreKeys:
      items
        .filter(
          (item) =>
            !Number.isFinite(
              item.score
            )
        )
        .map(
          (item) => item.key
        ),
  };
}

/* =========================
   星級
   ========================= */

function getBaseStarRating(
  totalScore
) {
  if (totalScore >= 80) {
    return 3;
  }

  if (totalScore >= 60) {
    return 2;
  }

  return 1;
}

function getStarGuards({
  accuracyPercent,
  missRate,
  rottenClickRate,
  rottenTotal,
  assistedRate,
  scoringDataSufficient,
}) {
  let maxStars = 3;
  const reasons = [];

  if (!scoringDataSufficient) {
    maxStars = Math.min(
      maxStars,
      2
    );

    reasons.push(
      "scoring_data_insufficient"
    );
  }

  if (
    Number.isFinite(
      accuracyPercent
    ) &&
    accuracyPercent < 60
  ) {
    maxStars = Math.min(
      maxStars,
      1
    );

    reasons.push(
      "accuracy_below_60"
    );
  }

  if (
    Number.isFinite(missRate) &&
    missRate > 35
  ) {
    maxStars = Math.min(
      maxStars,
      1
    );

    reasons.push(
      "miss_rate_above_35"
    );
  }

  if (
    rottenTotal >=
      MIN_SPECIAL_TRIALS &&
    Number.isFinite(
      rottenClickRate
    ) &&
    rottenClickRate > 40
  ) {
    maxStars = Math.min(
      maxStars,
      2
    );

    reasons.push(
      "rotten_click_rate_above_40"
    );
  }

  if (
    Number.isFinite(
      assistedRate
    ) &&
    assistedRate > 40
  ) {
    maxStars = Math.min(
      maxStars,
      2
    );

    reasons.push(
      "assisted_rate_above_40"
    );
  }

  return {
    maxStars,
    reasons,
  };
}

function getStarRating(
  totalScore,
  guards
) {
  const baseStars =
    getBaseStarRating(
      totalScore
    );

  return Math.max(
    1,
    Math.min(
      baseStars,
      guards?.maxStars ?? 3
    )
  );
}

/* =========================
   文字說明
   ========================= */

function getChildMessage(stars) {
  if (stars === 3) {
    return "太棒了！你反應很快，也很專心完成任務！";
  }

  if (stars === 2) {
    return "做得很好！你已經抓到節奏了，再練習會更穩定！";
  }

  return "沒關係！慢慢來，多玩幾次會越來越熟悉！";
}

function getAccuracyLevel(
  accuracyPercent
) {
  if (accuracyPercent >= 85) {
    return "表現良好";
  }

  if (accuracyPercent >= 65) {
    return "尚可";
  }

  return "需要加強";
}

function getSpeedLevel(
  avgReactionTime
) {
  if (
    avgReactionTime === null
  ) {
    return "資料不足";
  }

  if (
    avgReactionTime <= 650
  ) {
    return "反應快速";
  }

  if (
    avgReactionTime <= 850
  ) {
    return "反應穩定";
  }

  if (
    avgReactionTime <= 1100
  ) {
    return "反應稍慢";
  }

  return "反應偏慢";
}

function getStabilityLevel(rtStd) {
  if (rtStd === null) {
    return "資料不足";
  }

  if (rtStd <= 180) {
    return "反應穩定";
  }

  if (rtStd <= 350) {
    return "略有波動";
  }

  return "反應波動較大";
}

function getAttentionLevel({
  attentionRtSlowingMs,
  attentionDataSufficient,
}) {
  if (
    !attentionDataSufficient ||
    attentionRtSlowingMs === null
  ) {
    return "資料不足";
  }

  if (
    attentionRtSlowingMs <= 120
  ) {
    return "注意力維持良好";
  }

  if (
    attentionRtSlowingMs <= 300
  ) {
    return "後段略有變慢";
  }

  return "後段明顯變慢";
}

function getInhibitionLevel({
  rottenClickRate,
  rottenTotal,
}) {
  if (rottenTotal === 0) {
    return "本次未出現壞橡實";
  }

  if (
    rottenTotal <
    MIN_SPECIAL_TRIALS
  ) {
    return "壞橡實題數不足";
  }

  if (
    rottenClickRate <= 15
  ) {
    return "抑制控制穩定";
  }

  if (
    rottenClickRate <= 30
  ) {
    return "偶爾衝動點擊";
  }

  return "容易受到壞橡實干擾";
}

function getRewardSearchLevel({
  goldenHitRate,
  goldenTotal,
}) {
  if (goldenTotal === 0) {
    return "本次未出現金色橡實";
  }

  if (
    goldenTotal <
    MIN_SPECIAL_TRIALS
  ) {
    return "金色橡實題數不足";
  }

  if (
    goldenHitRate >= 75
  ) {
    return "能注意到獎勵目標";
  }

  if (
    goldenHitRate >= 45
  ) {
    return "偶爾漏掉獎勵目標";
  }

  return "較容易漏掉獎勵目標";
}

function getAssistLevel(
  assistedRate,
  assistEligibleCount
) {
  if (
    assistEligibleCount <= 0
  ) {
    return "資料不足";
  }

  if (assistedRate <= 15) {
    return "很少需要提醒";
  }

  if (assistedRate <= 35) {
    return "偶爾需要提醒";
  }

  return "較常需要提醒";
}

function getRtCvLevel(rtCV) {
  if (rtCV === null) {
    return "資料不足";
  }

  if (rtCV <= 0.25) {
    return "反應穩定";
  }

  if (rtCV <= 0.4) {
    return "稍有波動";
  }

  return "反應波動較大";
}

function buildParentSummary({
  accuracyPercent,
  avgReactionTime,
  rtStd,
  attentionRtSlowingMs,
  attentionDataSufficient,
  missRate,
  assistedRate,
  assistEligibleCount,
  rtCV,
  unassistedAvgReactionTime,
  goldenTotal,
  goldenHitRate,
  rottenTotal,
  rottenClickRate,
  scoringDataSufficient,
}) {
  const messages = [];

  if (!scoringDataSufficient) {
    messages.push(
      "本次有效題數或反應時間資料較少，結果建議搭配後續多次紀錄一起觀察。"
    );
  }

  if (accuracyPercent >= 85) {
    messages.push(
      "孩子大多能在目標出現後正確完成反應。"
    );
  } else if (
    accuracyPercent >= 65
  ) {
    messages.push(
      "孩子可以完成多數反應，但偶爾會漏答或點錯。"
    );
  } else {
    messages.push(
      "孩子本次正確反應較少，建議先確認規則理解並降低任務負荷。"
    );
  }

  if (
    avgReactionTime === null
  ) {
    messages.push(
      "目前有效反應時間資料不足。"
    );
  } else if (
    avgReactionTime <= 650
  ) {
    messages.push(
      "本次反應速度較快。"
    );
  } else if (
    avgReactionTime <= 850
  ) {
    messages.push(
      "本次反應速度大致穩定。"
    );
  } else {
    messages.push(
      "本次反應速度較慢，可能需要更多時間注意到目標。"
    );
  }

  if (rtStd === null) {
    messages.push(
      "目前無法完整判斷反應穩定度。"
    );
  } else if (rtStd <= 180) {
    messages.push(
      "每題反應時間相當穩定。"
    );
  } else if (rtStd <= 350) {
    messages.push(
      "反應時間稍有波動。"
    );
  } else {
    messages.push(
      "反應時間變化較大，建議搭配後續紀錄持續觀察。"
    );
  }

  if (
    !attentionDataSufficient ||
    attentionRtSlowingMs === null
  ) {
    messages.push(
      "目前有效反應資料不足，暫不比較前後段注意力變化。"
    );
  } else if (
    attentionRtSlowingMs <= 120
  ) {
    messages.push(
      "前後段反應差異不大，注意力維持大致穩定。"
    );
  } else if (
    attentionRtSlowingMs <= 300
  ) {
    messages.push(
      "後半段反應稍微變慢，可能與疲勞或當下注意力波動有關。"
    );
  } else {
    messages.push(
      "後半段反應明顯變慢，建議縮短時間或安排短暫休息。"
    );
  }

  if (missRate >= 25) {
    messages.push(
      "本次漏答或逾時比例偏高，建議確認孩子是否理解規則，或目前速度是否過快。"
    );
  }

  if (
    assistEligibleCount > 0 &&
    assistedRate >= 40
  ) {
    messages.push(
      "本次較常需要提示，可先保留低干擾提醒並維持目前難度。"
    );
  } else if (
    assistEligibleCount > 0 &&
    assistedRate >= 20
  ) {
    messages.push(
      "本次偶爾需要提示，但多數題目仍可自行完成。"
    );
  }

  if (
    rtCV !== null &&
    rtCV > 0.4
  ) {
    messages.push(
      "反應時間波動較大，建議搭配多次紀錄一起觀察。"
    );
  }

  if (
    unassistedAvgReactionTime !==
      null &&
    assistedRate > 0
  ) {
    messages.push(
      `未提示題目的平均反應約 ${(unassistedAvgReactionTime / 1000).toFixed(2)} 秒。`
    );
  }

  if (
    rottenTotal >=
      MIN_SPECIAL_TRIALS
  ) {
    if (
      rottenClickRate >= 35
    ) {
      messages.push(
        "壞橡實誤點率較高，後續可先降低干擾比例，練習看清楚再點。"
      );
    } else {
      messages.push(
        "孩子本次大致能控制自己，不會持續點擊壞橡實。"
      );
    }
  }

  if (
    goldenTotal >=
      MIN_SPECIAL_TRIALS
  ) {
    if (goldenHitRate < 50) {
      messages.push(
        "金色橡實命中率較低，可繼續練習獎勵目標搜尋。"
      );
    } else {
      messages.push(
        "孩子能注意到多數金色橡實並完成點擊。"
      );
    }
  }

  return messages
    .filter(Boolean)
    .join(" ");
}

/* =========================
   臨床旗標
   ========================= */

function buildClinicalFlags({
  accuracyPercent,
  avgReactionTime,
  rtStd,
  rtCV,
  attentionRtSlowingMs,
  attentionDataSufficient,
  assistedRate,
  assistEligibleCount,
  missedOrTimeoutCount,
  backgroundClickCount,
  repeatedClickCount,
  anticipatoryNoiseCount,
  totalTrials,
  rottenTotal,
  rottenClickRate,
  goldenTotal,
  goldenHitRate,
  scoringDataSufficient,
}) {
  const flags = [];

  if (!scoringDataSufficient) {
    flags.push({
      type: "scoring_data_insufficient",
      level: "notice",
      message:
        "有效題數或有效反應時間不足，總分與能力解讀應搭配後續紀錄。",
    });
  }

  if (accuracyPercent < 60) {
    flags.push({
      type: "accuracy_low",
      level: "warning",
      message:
        "整體正確率偏低，建議確認規則理解、任務速度及注意力狀態。",
    });
  }

  if (
    avgReactionTime !== null &&
    avgReactionTime > 1100
  ) {
    flags.push({
      type: "reaction_slow",
      level: "notice",
      message:
        "平均反應時間偏慢，可能與目標偵測、動作反應或當下狀態有關。",
    });
  }

  if (
    rtStd !== null &&
    rtStd > 350
  ) {
    flags.push({
      type: "stability_low",
      level: "notice",
      message:
        "反應時間變異較大，建議觀察反應節奏與注意力穩定度。",
    });
  }

  if (
    rtCV !== null &&
    rtCV > 0.4
  ) {
    flags.push({
      type: "rt_cv_high",
      level: "notice",
      message:
        "反應時間變異係數偏高，代表反應速度波動較大。",
    });
  }

  if (
    assistEligibleCount > 0 &&
    assistedRate > 40
  ) {
    flags.push({
      type: "assisted_rate_high",
      level: "notice",
      message:
        "提示比例偏高，代表本次較常需要低干擾提醒。",
    });
  }

  if (!attentionDataSufficient) {
    flags.push({
      type: "attention_data_insufficient",
      level: "notice",
      message:
        "有效反應時間不足，未完整判斷前後半注意力變化。",
    });
  }

  if (
    attentionRtSlowingMs !==
      null &&
    attentionRtSlowingMs > 300
  ) {
    flags.push({
      type: "attention_drop",
      level: "warning",
      message:
        "後半段反應明顯變慢，建議觀察疲勞或持續注意力變化。",
    });
  }

  if (
    totalTrials > 0 &&
    missedOrTimeoutCount /
      totalTrials >=
      0.2
  ) {
    flags.push({
      type: "miss_high",
      level: "warning",
      message:
        "漏答或逾時比例偏高，建議確認規則理解與反應時間設定。",
    });
  }

  if (
    totalTrials > 0 &&
    backgroundClickCount /
      totalTrials >=
      0.2
  ) {
    flags.push({
      type: "background_click_high",
      level: "notice",
      message:
        "空白區域點擊比例偏高，可能有衝動點擊或操作定位不穩。",
    });
  }

  if (
    totalTrials > 0 &&
    repeatedClickCount /
      totalTrials >=
      0.1
  ) {
    flags.push({
      type: "repeated_click_high",
      level: "notice",
      message:
        "重複點擊次數偏高，建議確認觸控事件、操作習慣或衝動反應。",
    });
  }

  if (anticipatoryNoiseCount > 0) {
    flags.push({
      type: "anticipatory_noise_filtered",
      level: "notice",
      message:
        "已排除小於 150ms 的預期性誤觸，避免污染反應時間統計。",
    });
  }

  if (
    rottenTotal >=
      MIN_SPECIAL_TRIALS &&
    rottenClickRate >= 35
  ) {
    flags.push({
      type: "inhibition_control_low",
      level: "warning",
      message:
        "壞橡實誤點率偏高，建議觀察干擾抑制與衝動控制表現。",
    });
  }

  if (
    goldenTotal >=
      MIN_SPECIAL_TRIALS &&
    goldenHitRate < 50
  ) {
    flags.push({
      type: "reward_search_low",
      level: "notice",
      message:
        "金色橡實命中率偏低，可觀察獎勵目標搜尋與視覺注意分配。",
    });
  }

  if (flags.length === 0) {
    flags.push({
      type: "normal",
      level: "normal",
      message:
        "本次未出現明顯異常旗標，建議搭配多次紀錄與其他任務一起解讀。",
    });
  }

  return flags;
}

/* =========================
   主要評分函式
   ========================= */

export function calculateSrtScore(
  inputRecords = [],
  options = {}
) {
  const {
    mode = "test",
    baselineAvgRT = null,
    deviceType = null,
  } = options;

  const allRecords = safeArray(
    inputRecords
  ).map(normalizeSrtRecord);

  const trialRecords =
    allRecords.filter(isTrialRecord);

  const behaviorRecords =
    allRecords.filter(isBehaviorRecord);

  const totalTrials =
    trialRecords.length;

  const hitRecords =
    trialRecords.filter(isHitRecord);

  const correctAvoidRecords =
    trialRecords.filter(
      isCorrectAvoidRecord
    );

  const correctRecords = [
    ...hitRecords,
    ...correctAvoidRecords,
  ];

  const wrongRecords =
    trialRecords.filter(
      (record) =>
        record.isCorrect === false &&
        record.missed !== true &&
        record.timeout !== true &&
        !isAnticipatoryNoise(
          record
        )
    );

  const timeoutRecords =
    trialRecords.filter(
      (record) =>
        record.timeout === true
    );

  const missedRecords =
    trialRecords.filter(
      (record) =>
        record.missed === true
    );

  const missedOrTimeoutRecords =
    trialRecords.filter(
      (record) =>
        record.missed === true ||
        record.timeout === true
    );

  const anticipatoryNoiseRecords =
    trialRecords.filter(
      isAnticipatoryNoise
    );

  const backgroundClickRecords =
    allRecords.filter(
      (record) =>
        record.trainingAction ===
        "backgroundClick"
    );

  const repeatedClickRecords =
    allRecords.filter(
      (record) =>
        record.trainingAction ===
        "repeatedClick"
    );

  const assistEligibleRecords =
    trialRecords.filter((record) =>
      ["normal", "golden"].includes(
        record.targetType
      )
    );

  const assistedRecords =
    assistEligibleRecords.filter(
      (record) =>
        record.assisted === true
    );

  const unassistedEligibleRecords =
    assistEligibleRecords.filter(
      (record) =>
        record.assisted !== true
    );

  const unassistedCorrectRecords =
    unassistedEligibleRecords.filter(
      isHitRecord
    );

  const validCorrectRtRecords =
    hitRecords.filter((record) =>
      isValidReactionTime(
        record.reactionTime
      )
    );

  const correctReactionTimes =
    validCorrectRtRecords.map(
      (record) =>
        record.reactionTime
    );

  const avgReactionTime =
    roundNumber(
      average(
        correctReactionTimes
      ),
      0
    );

  const rtStd = roundNumber(
    standardDeviation(
      correctReactionTimes
    ),
    0
  );

  const rtCV =
    avgReactionTime !== null &&
    avgReactionTime > 0 &&
    rtStd !== null
      ? roundNumber(
          rtStd /
            avgReactionTime,
          2
        )
      : null;

  const unassistedCorrectRtRecords =
    unassistedCorrectRecords.filter(
      (record) =>
        isValidReactionTime(
          record.reactionTime
        )
    );

  const assistedCorrectRtRecords =
    assistedRecords.filter(
      (record) =>
        isHitRecord(record) &&
        isValidReactionTime(
          record.reactionTime
        )
    );

  const unassistedAvgReactionTime =
    roundNumber(
      average(
        unassistedCorrectRtRecords.map(
          (record) =>
            record.reactionTime
        )
      ),
      0
    );

  const assistedAvgReactionTime =
    roundNumber(
      average(
        assistedCorrectRtRecords.map(
          (record) =>
            record.reactionTime
        )
      ),
      0
    );

  const correctCount =
    correctRecords.length;

  const wrongCount =
    wrongRecords.length;

  const timeoutCount =
    timeoutRecords.length;

  const missedCount =
    missedRecords.length;

  const missedOrTimeoutCount =
    missedOrTimeoutRecords.length;

  const anticipatoryNoiseCount =
    anticipatoryNoiseRecords.length;

  const backgroundClickCount =
    backgroundClickRecords.length;

  const repeatedClickCount =
    repeatedClickRecords.length;

  const falseClickCount =
    backgroundClickCount +
    repeatedClickCount;

  const assistedCount =
    assistedRecords.length;

  const assistEligibleCount =
    assistEligibleRecords.length;

  const accuracyRate =
    totalTrials > 0
      ? correctCount /
        totalTrials
      : 0;

  const accuracyPercent =
    percentage(
      correctCount,
      totalTrials
    );

  const missRate = percentage(
    missedOrTimeoutCount,
    totalTrials
  );

  const falseClickRate =
    percentage(
      falseClickCount,
      totalTrials
    );

  const backgroundClickRate =
    percentage(
      backgroundClickCount,
      totalTrials
    );

  const repeatedClickRate =
    percentage(
      repeatedClickCount,
      totalTrials
    );

  const assistedRate =
    percentage(
      assistedCount,
      assistEligibleCount
    );

  const unassistedAccuracy =
    percentage(
      unassistedCorrectRecords.length,
      unassistedEligibleRecords.length
    );

  const normalRecords =
    trialRecords.filter(
      isNormalRecord
    );

  const goldenRecords =
    trialRecords.filter(
      isGoldenRecord
    );

  const rottenRecords =
    trialRecords.filter(
      isRottenRecord
    );

  const normalCorrectCount =
    normalRecords.filter(
      isHitRecord
    ).length;

  const goldenHitCount =
    goldenRecords.filter(
      isGoldenHit
    ).length;

  const goldenTotal =
    goldenRecords.length;

  const goldenMissCount =
    Math.max(
      0,
      goldenTotal -
        goldenHitCount
    );

  const goldenHitRate =
    goldenTotal > 0
      ? percentage(
          goldenHitCount,
          goldenTotal
        )
      : null;

  const clickedRottenCount =
    rottenRecords.filter(
      isClickedRotten
    ).length;

  const rottenTotal =
    rottenRecords.length;

  const rottenAvoidedCount =
    Math.max(
      0,
      rottenTotal -
        clickedRottenCount
    );

  const rottenClickRate =
    rottenTotal > 0
      ? percentage(
          clickedRottenCount,
          rottenTotal
        )
      : null;

  const rottenAvoidRate =
    rottenTotal > 0
      ? percentage(
          rottenAvoidedCount,
          rottenTotal
        )
      : null;

  const normalAccuracy =
    percentage(
      normalCorrectCount,
      normalRecords.length
    );

  const goldenAccuracy =
    goldenHitRate ?? 0;

  const rottenAccuracy =
    rottenAvoidRate ?? 0;

  const halfAttentionMetrics =
    buildHalfAttentionMetrics(
      validCorrectRtRecords
    );

  const longAttentionMetrics =
    buildLongAttentionMetrics(
      trialRecords
    );

  const inhibitionDataSufficient =
    rottenTotal >=
    MIN_SPECIAL_TRIALS;

  const rewardDataSufficient =
    goldenTotal >=
    MIN_SPECIAL_TRIALS;

  const scoringDataSufficient =
    totalTrials >=
      MIN_SCORING_TRIALS &&
    validCorrectRtRecords.length >=
      MIN_VALID_RT_COUNT;

  const accuracyScore =
    getAccuracyScore(
      accuracyPercent
    );

  const speedScore =
    getSpeedScore(
      avgReactionTime
    );

  const stabilityScore =
    getStabilityScore(rtStd);

  const attentionScore =
    getAttentionScore(
      halfAttentionMetrics
        .attentionRtSlowingMs,
      halfAttentionMetrics
        .attentionDataSufficient
    );

  const inhibitionScore =
    getInhibitionScore({
      rottenClickRate,
      rottenTotal,
    });

  const rewardSearchScore =
    getRewardSearchScore({
      goldenHitRate,
      goldenTotal,
    });

  const scoreBreakdown = {
    accuracyScore,
    speedScore,
    stabilityScore,
    attentionScore,
    inhibitionScore,
    rewardSearchScore,
  };

  const weightedScore =
    calculateWeightedTotal(
      scoreBreakdown
    );

  const totalScore =
    weightedScore.totalScore;

  const starGuards =
    getStarGuards({
      accuracyPercent,
      missRate,
      rottenClickRate,
      rottenTotal,
      assistedRate,
      scoringDataSufficient,
    });

  const stars = getStarRating(
    totalScore,
    starGuards
  );

  const relativeRtChange =
    Number.isFinite(
      baselineAvgRT
    ) &&
    baselineAvgRT > 0 &&
    avgReactionTime !== null
      ? roundNumber(
          (
            (avgReactionTime -
              baselineAvgRT) /
            baselineAvgRT
          ) * 100,
          0
        )
      : null;

  const dataQuality = {
    totalRecords:
      allRecords.length,
    totalTrials,
    behaviorRecordCount:
      behaviorRecords.length,

    validRTCount:
      validCorrectRtRecords.length,

    anticipatoryNoiseCount,

    scoringDataSufficient,

    attentionDataSufficient:
      halfAttentionMetrics
        .attentionDataSufficient,

    longAttentionDataSufficient:
      longAttentionMetrics
        .dataSufficient,

    inhibitionDataSufficient,
    rewardDataSufficient,

    minValidReactionTime:
      MIN_VALID_REACTION_TIME_MS,

    minScoringTrials:
      MIN_SCORING_TRIALS,

    minValidRtCount:
      MIN_VALID_RT_COUNT,

    minSpecialTrials:
      MIN_SPECIAL_TRIALS,
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

    inhibitionDataSufficient,
    rewardDataSufficient,
  };

  const parentAbilityScores = {
    responseAccuracy:
      accuracyPercent,

    reactionSpeed:
      speedScore === null
        ? null
        : roundNumber(
            (
              speedScore /
              SCORE_WEIGHTS.speed
            ) * 100,
            0
          ),

    responseStability:
      stabilityScore === null
        ? null
        : roundNumber(
            (
              stabilityScore /
              SCORE_WEIGHTS.stability
            ) * 100,
            0
          ),

    attentionMaintenance:
      attentionScore === null
        ? null
        : roundNumber(
            (
              attentionScore /
              SCORE_WEIGHTS.attention
            ) * 100,
            0
          ),

    inhibitionControl:
      inhibitionScore === null
        ? null
        : roundNumber(
            (
              inhibitionScore /
              SCORE_WEIGHTS.inhibition
            ) * 100,
            0
          ),

    rewardSearch:
      rewardSearchScore === null
        ? null
        : roundNumber(
            (
              rewardSearchScore /
              SCORE_WEIGHTS.rewardSearch
            ) * 100,
            0
          ),
  };

  const parentSummary =
    buildParentSummary({
      accuracyPercent,
      avgReactionTime,
      rtStd,

      attentionRtSlowingMs:
        halfAttentionMetrics
          .attentionRtSlowingMs,

      attentionDataSufficient:
        halfAttentionMetrics
          .attentionDataSufficient,

      missRate,
      assistedRate,
      assistEligibleCount,
      rtCV,
      unassistedAvgReactionTime,

      goldenTotal,
      goldenHitRate:
        goldenHitRate ?? 0,

      rottenTotal,
      rottenClickRate:
        rottenClickRate ?? 0,

      scoringDataSufficient,
    });

  const interpretationFlags =
    buildClinicalFlags({
      accuracyPercent,
      avgReactionTime,
      rtStd,
      rtCV,

      attentionRtSlowingMs:
        halfAttentionMetrics
          .attentionRtSlowingMs,

      attentionDataSufficient:
        halfAttentionMetrics
          .attentionDataSufficient,

      assistedRate,
      assistEligibleCount,

      missedOrTimeoutCount,
      backgroundClickCount,
      repeatedClickCount,
      anticipatoryNoiseCount,
      totalTrials,

      rottenTotal,
      rottenClickRate:
        rottenClickRate ?? 0,

      goldenTotal,
      goldenHitRate:
        goldenHitRate ?? 0,

      scoringDataSufficient,
    });

  return {
    taskName:
      "Simple Reaction Time",

    taskCode: "SRT",
    mode,

    totalScore,
    stars,

    baseStars:
      getBaseStarRating(
        totalScore
      ),

    starGuards,
    dataQuality,

    scoreMeta: {
      earnedScore:
        weightedScore.earnedScore,

      availableScore:
        weightedScore.availableScore,

      validScoreKeys:
        weightedScore.validScoreKeys,

      unavailableScoreKeys:
        weightedScore.unavailableScoreKeys,

      normalizedTo100: true,
    },

    summary: {
      totalTrials,
      correctCount,
      wrongCount,

      timeoutCount,
      missedCount,
      missedOrTimeoutCount,

      falseClickCount,
      backgroundClickCount,
      repeatedClickCount,

      anticipatoryNoiseCount,

      accuracyRate,
      accuracyPercent,
      missRate,

      falseClickRate,
      backgroundClickRate,
      repeatedClickRate,

      assistedCount,
      assistEligibleCount,
      assistedRate,

      unassistedCorrectCount:
        unassistedCorrectRecords.length,

      unassistedAccuracy,

      avgReactionTime,
      unassistedAvgReactionTime,
      assistedAvgReactionTime,

      rtStd,
      rtCV,

      firstHalfAvg:
        halfAttentionMetrics
          .firstHalfAvg,

      secondHalfAvg:
        halfAttentionMetrics
          .secondHalfAvg,

      attentionRtSlowingMs:
        halfAttentionMetrics
          .attentionRtSlowingMs,

      // 向下相容舊版 ResultPage
      attentionDrop:
        halfAttentionMetrics
          .attentionRtSlowingMs,

      attentionValidCount:
        halfAttentionMetrics
          .attentionValidCount,

      attentionDataSufficient:
        halfAttentionMetrics
          .attentionDataSufficient,

      firstHalfValidCount:
        halfAttentionMetrics
          .firstHalfValidCount,

      secondHalfValidCount:
        halfAttentionMetrics
          .secondHalfValidCount,

      longAttentionMetrics,

      normalAccuracy,
      goldenAccuracy,

      brokenAccuracy:
        rottenAccuracy,

      rottenAccuracy,

      relativeRtChange,
      baselineAvgRT,
      deviceType,

      ...distractorMetrics,
    },

    scoreBreakdown,

    childView: {
      stars,

      message:
        getChildMessage(stars),

      shortLabel:
        stars === 3
          ? "表現很棒"
          : stars === 2
          ? "表現不錯"
          : "繼續加油",

      dataSufficient:
        scoringDataSufficient,
    },

    parentView: {
      abilityScores:
        parentAbilityScores,

      indicators: [
        {
          key:
            "responseAccuracy",
          label:
            "反應正確性",
          value:
            parentAbilityScores
              .responseAccuracy,
          level:
            getAccuracyLevel(
              accuracyPercent
            ),
          description:
            "觀察目標出現後，是否能正確完成點擊或避開壞橡實。",
        },
        {
          key:
            "reactionSpeed",
          label:
            "反應速度",
          value:
            parentAbilityScores
              .reactionSpeed,
          level:
            getSpeedLevel(
              avgReactionTime
            ),
          description:
            "觀察看到目標後，需要多久做出反應。",
        },
        {
          key:
            "responseStability",
          label:
            "反應穩定度",
          value:
            parentAbilityScores
              .responseStability,
          level:
            getStabilityLevel(
              rtStd
            ),
          description:
            "觀察不同題目的反應時間是否穩定。",
        },
        {
          key:
            "assistNeed",
          label:
            "提示需求",
          value:
            assistEligibleCount > 0
              ? assistedRate
              : null,
          level:
            getAssistLevel(
              assistedRate,
              assistEligibleCount
            ),
          description:
            "觀察普通與金色橡實題目是否需要提示協助。",
        },
        {
          key:
            "rtCV",
          label:
            "反應波動",
          value:
            rtCV === null
              ? null
              : roundNumber(
                  rtCV * 100,
                  0
                ),
          level:
            getRtCvLevel(rtCV),
          description:
            "反應時間變異係數越高，代表反應越不穩定。",
        },
        {
          key:
            "attentionMaintenance",
          label:
            "注意力維持",
          value:
            parentAbilityScores
              .attentionMaintenance,
          level:
            getAttentionLevel({
              attentionRtSlowingMs:
                halfAttentionMetrics
                  .attentionRtSlowingMs,
              attentionDataSufficient:
                halfAttentionMetrics
                  .attentionDataSufficient,
            }),
          description:
            "觀察後半段是否出現反應變慢。",
        },
        {
          key:
            "inhibitionControl",
          label:
            "干擾抑制",
          value:
            parentAbilityScores
              .inhibitionControl,
          level:
            getInhibitionLevel({
              rottenClickRate:
                rottenClickRate ??
                0,
              rottenTotal,
            }),
          description:
            "觀察看到壞橡實時，是否能忍住不點。",
        },
        {
          key:
            "rewardSearch",
          label:
            "獎勵目標搜尋",
          value:
            parentAbilityScores
              .rewardSearch,
          level:
            getRewardSearchLevel({
              goldenHitRate:
                goldenHitRate ??
                0,
              goldenTotal,
            }),
          description:
            "觀察是否能注意到金色橡實並完成點擊。",
        },
      ],

      plainLanguageSummary:
        parentSummary,

      dataQuality,
    },

    clinicalView: {
      totalTrials,
      correctCount,
      wrongCount,

      timeoutCount,
      missedCount,
      missedOrTimeoutCount,

      falseClickCount,
      backgroundClickCount,
      repeatedClickCount,

      anticipatoryNoiseCount,

      accuracyPercent,
      missRate,

      falseClickRate,
      backgroundClickRate,
      repeatedClickRate,

      assistedCount,
      assistEligibleCount,
      assistedRate,

      unassistedAccuracy,

      avgReactionTime,
      unassistedAvgReactionTime,
      assistedAvgReactionTime,

      rtStd,
      rtCV,

      firstHalfAvg:
        halfAttentionMetrics
          .firstHalfAvg,

      secondHalfAvg:
        halfAttentionMetrics
          .secondHalfAvg,

      attentionRtSlowingMs:
        halfAttentionMetrics
          .attentionRtSlowingMs,

      attentionDrop:
        halfAttentionMetrics
          .attentionRtSlowingMs,

      attentionValidCount:
        halfAttentionMetrics
          .attentionValidCount,

      attentionDataSufficient:
        halfAttentionMetrics
          .attentionDataSufficient,

      longAttentionMetrics,

      normalAccuracy,
      goldenAccuracy,

      brokenAccuracy:
        rottenAccuracy,

      rottenAccuracy,

      relativeRtChange,
      baselineAvgRT,
      deviceType,

      ...distractorMetrics,

      dataQuality,
      interpretationFlags,

      records: allRecords,
      trialRecords,
      behaviorRecords,
    },

    records: allRecords,
    trialRecords,
    behaviorRecords,

    generatedAt:
      new Date().toISOString(),
  };
}

/* =========================
   舊版星級函式相容
   ========================= */

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
  assistedCount = 0,
  reactionTimes = [],
}) {
  const validReactionTimes =
    safeArray(
      reactionTimes
    ).filter(
      isValidReactionTime
    );

  const attentionRtSlowingMs =
    Number.isFinite(
      firstHalfAvg
    ) &&
    Number.isFinite(
      secondHalfAvg
    )
      ? secondHalfAvg -
        firstHalfAvg
      : null;

  const accuracyScore =
    getAccuracyScore(hitRate);

  const speedScore =
    getSpeedScore(avgRT);

  const stabilityScore =
    getStabilityScore(stdRT);

  const attentionScore =
    getAttentionScore(
      attentionRtSlowingMs,
      attentionRtSlowingMs !== null
    );

  const weightedScore =
    calculateWeightedTotal({
      accuracyScore,
      speedScore,
      stabilityScore,
      attentionScore,

      // 舊版函式沒有特殊題資料
      inhibitionScore: null,
      rewardSearchScore: null,
    });

  const missRate =
    percentage(
      missCount,
      totalTrials
    );

  const assistedRate =
    percentage(
      assistedCount,
      totalTrials
    );

  const scoringDataSufficient =
    totalTrials >=
      MIN_SCORING_TRIALS &&
    validReactionTimes.length >=
      MIN_VALID_RT_COUNT;

  const starGuards =
    getStarGuards({
      accuracyPercent:
        hitRate,

      missRate,

      rottenClickRate: null,
      rottenTotal: 0,

      assistedRate,

      scoringDataSufficient,
    });

  const stars =
    getStarRating(
      weightedScore.totalScore,
      starGuards
    );

  return {
    star: stars,
    stars,

    baseStars:
      getBaseStarRating(
        weightedScore.totalScore
      ),

    starGuards,

    level:
      stars === 3
        ? "表現很好"
        : stars === 2
        ? "表現不錯"
        : "需再練習",

    feedback:
      getChildMessage(stars),

    totalScore:
      weightedScore.totalScore,

    attentionDrop:
      attentionRtSlowingMs,

    attentionRtSlowingMs,

    parentMetrics: {
      accuracy:
        roundNumber(
          hitRate,
          0
        ),

      speed:
        speedScore === null
          ? null
          : roundNumber(
              (
                speedScore /
                SCORE_WEIGHTS.speed
              ) * 100,
              0
            ),

      stability:
        stabilityScore === null
          ? null
          : roundNumber(
              (
                stabilityScore /
                SCORE_WEIGHTS.stability
              ) * 100,
              0
            ),

      attention:
        attentionScore === null
          ? null
          : roundNumber(
              (
                attentionScore /
                SCORE_WEIGHTS.attention
              ) * 100,
              0
            ),

      inhibition: null,
      rewardSearch: null,
    },

    clinicalMetrics: {
      totalTrials,
      hitCount,
      missCount,
      falseClickCount,
      assistedCount,
      assistedRate,
      hitRate,
      avgRT,
      stdRT,
      firstHalfAvg,
      secondHalfAvg,
      attentionDrop:
        attentionRtSlowingMs,
      attentionRtSlowingMs,
      scoringDataSufficient,
      reactionTimes:
        validReactionTimes,
    },
  };
}

/* =========================
   localStorage
   ========================= */

export function getStoredSrtResult(
  options = {}
) {
  try {
    if (
      typeof localStorage ===
      "undefined"
    ) {
      return null;
    }

    const raw =
      localStorage.getItem(
        "srtTestResult"
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return calculateSrtScore(
        parsed,
        options
      );
    }

    const storedRecords =
      parsed.records ||
      parsed.trialRecords ||
      parsed.resultRecords;

    if (
      Array.isArray(
        storedRecords
      )
    ) {
      return {
        ...parsed,

        scoring:
          calculateSrtScore(
            storedRecords,
            {
              mode:
                parsed.mode ||
                options.mode ||
                "test",

              baselineAvgRT:
                options.baselineAvgRT,

              deviceType:
                options.deviceType,
            }
          ),
      };
    }

    if (parsed.scoring) {
      return parsed;
    }

    return null;
  } catch (error) {
    console.error(
      "讀取 SRT 結果失敗：",
      error
    );

    return null;
  }
}

export {
  MIN_VALID_REACTION_TIME_MS,
  MIN_SPECIAL_TRIALS,
  MIN_LONG_ATTENTION_TRIALS,
  normalizeSrtRecord,
};

export default calculateSrtScore;