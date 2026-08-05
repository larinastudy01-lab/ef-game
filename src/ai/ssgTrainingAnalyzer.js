// src/ai/ssgTrainingAnalyzer.js

/*
  =========================================================
  SSG Training Analyzer
  聽聲音選擇相反動物－訓練分析與個人化難度推薦

  現行規則：
  - 聽到貓叫，選擇狗
  - 聽到狗叫，選擇貓

  分析面向：
  1. 相反規則正確率
  2. 同動物直覺錯誤
  3. 過早反應與作答控制
  4. 逾時與反應啟動
  5. 正確反應速度
  6. 反應時間穩定度
  7. 前後半段注意力變化
  8. 貓聲／狗聲規則差異
  9. 左右側偏誤
  10. 下一輪難度、提示、題數與作答時間建議

  本版優化：
  - 避免過早反應重複扣分
  - 速度評估以中位數為主、平均數為輔
  - 速度分數加入有效正確題數可信度
  - 小樣本不進行左右、聲音與前後段誤判
  - 題數不足時不自動升級
  - 空資料輸出 insufficient_data
  - 支援連續多輪升降級確認
  - 可傳入上一輪結果，避免難度反覆跳動
  - 輸出完整 decisionReasons 與 nextRoundConfig
  - 與新版 ssgScoring.js 欄位命名一致
  =========================================================
*/

/* =========================================================
   難度設定
   ========================================================= */

const DIFFICULTY_ORDER = [
  "easy",
  "normal",
  "hard",
];

const DIFFICULTY_CONFIG = {
  easy: {
    expectedTrials: 8,
    answerTimeLimit: 5000,

    excellentRt: 1000,
    goodRt: 1500,
    acceptableRt: 2100,
    slowRt: 3000,

    stableStd: 300,
    acceptableStd: 650,
    unstableStd: 1000,

    upgradeAccuracy: 85,
    upgradeTimeoutRate: 12,
    upgradeSameAnimalErrorRate: 12,
    upgradeAnticipationRate: 12,
    upgradeStabilityScore: 60,

    downgradeAccuracy: 50,
    downgradeTimeoutRate: 38,
    downgradeSameAnimalErrorRate: 38,
  },

  normal: {
    expectedTrials: 12,
    answerTimeLimit: 4000,

    excellentRt: 900,
    goodRt: 1400,
    acceptableRt: 2000,
    slowRt: 2800,

    stableStd: 280,
    acceptableStd: 600,
    unstableStd: 900,

    upgradeAccuracy: 85,
    upgradeTimeoutRate: 10,
    upgradeSameAnimalErrorRate: 10,
    upgradeAnticipationRate: 10,
    upgradeStabilityScore: 65,

    downgradeAccuracy: 55,
    downgradeTimeoutRate: 32,
    downgradeSameAnimalErrorRate: 32,
  },

  hard: {
    expectedTrials: 16,
    answerTimeLimit: 3200,

    /*
      困難模式主要透過較短時間、較少提示及較多題數增加難度，
      不額外大幅提高速度能力標準。
    */
    excellentRt: 900,
    goodRt: 1400,
    acceptableRt: 2000,
    slowRt: 2700,

    stableStd: 280,
    acceptableStd: 600,
    unstableStd: 900,

    upgradeAccuracy: 90,
    upgradeTimeoutRate: 8,
    upgradeSameAnimalErrorRate: 8,
    upgradeAnticipationRate: 8,
    upgradeStabilityScore: 70,

    downgradeAccuracy: 58,
    downgradeTimeoutRate: 28,
    downgradeSameAnimalErrorRate: 28,
  },
};

const MIN_SOUND_TRIALS = 4;
const MIN_SIDE_TRIALS = 4;
const MIN_HALF_TRIALS = 3;

/* =========================================================
   基本工具
   ========================================================= */

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function isFiniteNumber(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function toFiniteNumber(
  value,
  fallback = 0
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function clamp(
  value,
  min = 0,
  max = 100
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(
    min,
    Math.min(max, number)
  );
}

function roundNumber(
  value,
  digits = 0
) {
  if (!isFiniteNumber(value)) {
    return null;
  }

  const factor =
    10 ** digits;

  return (
    Math.round(value * factor) /
    factor
  );
}

function percentage(
  part,
  total,
  digits = 0
) {
  const safePart =
    toFiniteNumber(part, 0);

  const safeTotal =
    toFiniteNumber(total, 0);

  if (safeTotal <= 0) {
    return 0;
  }

  return (
    roundNumber(
      (safePart / safeTotal) *
        100,
      digits
    ) ?? 0
  );
}

function average(values) {
  const validValues =
    safeArray(values).filter(
      isFiniteNumber
    );

  if (
    validValues.length === 0
  ) {
    return null;
  }

  return (
    validValues.reduce(
      (total, value) =>
        total + value,
      0
    ) / validValues.length
  );
}

function median(values) {
  const validValues =
    safeArray(values)
      .filter(isFiniteNumber)
      .sort((a, b) => a - b);

  if (
    validValues.length === 0
  ) {
    return null;
  }

  const middle =
    Math.floor(
      validValues.length / 2
    );

  if (
    validValues.length % 2 === 0
  ) {
    return (
      validValues[middle - 1] +
      validValues[middle]
    ) / 2;
  }

  return validValues[middle];
}

function populationStandardDeviation(
  values
) {
  const validValues =
    safeArray(values).filter(
      isFiniteNumber
    );

  if (
    validValues.length < 2
  ) {
    return null;
  }

  const mean =
    average(validValues);

  if (!isFiniteNumber(mean)) {
    return null;
  }

  const variance =
    validValues.reduce(
      (total, value) =>
        total +
        (value - mean) ** 2,
      0
    ) / validValues.length;

  return Math.sqrt(variance);
}

function sampleStandardDeviation(
  values
) {
  const validValues =
    safeArray(values).filter(
      isFiniteNumber
    );

  if (
    validValues.length < 2
  ) {
    return null;
  }

  const mean =
    average(validValues);

  if (!isFiniteNumber(mean)) {
    return null;
  }

  const variance =
    validValues.reduce(
      (total, value) =>
        total +
        (value - mean) ** 2,
      0
    ) /
    (validValues.length - 1);

  return Math.sqrt(variance);
}

function coefficientOfVariation(
  values
) {
  const mean =
    average(values);

  const deviation =
    populationStandardDeviation(
      values
    );

  if (
    !isFiniteNumber(mean) ||
    mean <= 0 ||
    !isFiniteNumber(deviation)
  ) {
    return null;
  }

  return deviation / mean;
}

function normalizeDifficulty(
  value
) {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    normalized === "easy" ||
    normalized === "simple"
  ) {
    return "easy";
  }

  if (
    normalized === "hard" ||
    normalized === "difficult" ||
    normalized === "advanced"
  ) {
    return "hard";
  }

  return "normal";
}

function getDifficultyLabel(
  difficultyKey
) {
  if (
    difficultyKey === "easy"
  ) {
    return "簡單";
  }

  if (
    difficultyKey === "hard"
  ) {
    return "困難";
  }

  return "普通";
}

function getDifficultyIndex(
  difficulty
) {
  const normalized =
    normalizeDifficulty(
      difficulty
    );

  const index =
    DIFFICULTY_ORDER.indexOf(
      normalized
    );

  return index >= 0
    ? index
    : 1;
}

function getNextDifficulty(
  currentDifficulty,
  direction
) {
  const currentIndex =
    getDifficultyIndex(
      currentDifficulty
    );

  if (
    direction === "harder"
  ) {
    return DIFFICULTY_ORDER[
      Math.min(
        currentIndex + 1,
        DIFFICULTY_ORDER.length -
          1
      )
    ];
  }

  if (
    direction === "easier"
  ) {
    return DIFFICULTY_ORDER[
      Math.max(
        currentIndex - 1,
        0
      )
    ];
  }

  return DIFFICULTY_ORDER[
    currentIndex
  ];
}

function getExpectedTarget(
  soundType
) {
  if (soundType === "cat") {
    return "dog";
  }

  if (soundType === "dog") {
    return "cat";
  }

  return null;
}

/* =========================================================
   紀錄辨識
   ========================================================= */

function isTimeoutRecord(
  record
) {
  return (
    record?.timeout === true ||
    record?.errorType ===
      "timeout" ||
    record?.errorType ===
      "miss"
  );
}

function isAnticipationRecord(
  record
) {
  return (
    record?.isAnticipation ===
      true ||
    record?.errorType ===
      "anticipation" ||
    (
      isFiniteNumber(
        record?.reactionTime
      ) &&
      record.reactionTime > 0 &&
      record.reactionTime < 150
    )
  );
}

function isCorrectRecord(
  record
) {
  if (
    isTimeoutRecord(record) ||
    isAnticipationRecord(record)
  ) {
    return false;
  }

  return (
    record?.isCorrect === true
  );
}

function isWrongRecord(
  record
) {
  return (
    !isTimeoutRecord(record) &&
    !isAnticipationRecord(
      record
    ) &&
    record?.isCorrect === false
  );
}

function isSameAnimalError(
  record
) {
  if (
    isTimeoutRecord(record) ||
    isAnticipationRecord(record)
  ) {
    return false;
  }

  if (
    record?.errorType ===
    "sameAnimalError"
  ) {
    return true;
  }

  const selectedTarget =
    record?.selectedTarget ||
    record?.selectedAnimal ||
    null;

  return Boolean(
    record?.soundType &&
      selectedTarget &&
      record.soundType ===
        selectedTarget
  );
}

function getCorrectReactionTimes(
  records
) {
  return safeArray(records)
    .filter(
      (record) =>
        isCorrectRecord(
          record
        ) &&
        isFiniteNumber(
          record?.reactionTime
        ) &&
        record.reactionTime >=
          150
    )
    .map(
      (record) =>
        record.reactionTime
    );
}

function getGlobalCounter(
  records,
  explicitValue,
  fieldName
) {
  if (
    isFiniteNumber(
      explicitValue
    ) &&
    explicitValue >= 0
  ) {
    return explicitValue;
  }

  const values =
    safeArray(records)
      .map(
        (record) =>
          record?.[fieldName]
      )
      .filter(
        (value) =>
          isFiniteNumber(
            value
          ) &&
          value >= 0
      );

  if (
    values.length === 0
  ) {
    return 0;
  }

  return Math.max(...values);
}

/* =========================================================
   分數轉換
   ========================================================= */

function getBaseReactionSpeedScore(
  reactionTime,
  config
) {
  if (
    !isFiniteNumber(
      reactionTime
    )
  ) {
    return 0;
  }

  if (
    reactionTime <=
    config.excellentRt
  ) {
    return 100;
  }

  if (
    reactionTime <=
    config.goodRt
  ) {
    const progress =
      (
        reactionTime -
        config.excellentRt
      ) /
      Math.max(
        config.goodRt -
          config.excellentRt,
        1
      );

    return (
      100 -
      progress * 15
    );
  }

  if (
    reactionTime <=
    config.acceptableRt
  ) {
    const progress =
      (
        reactionTime -
        config.goodRt
      ) /
      Math.max(
        config.acceptableRt -
          config.goodRt,
        1
      );

    return (
      85 -
      progress * 25
    );
  }

  if (
    reactionTime <=
    config.slowRt
  ) {
    const progress =
      (
        reactionTime -
        config.acceptableRt
      ) /
      Math.max(
        config.slowRt -
          config.acceptableRt,
        1
      );

    return (
      60 -
      progress * 30
    );
  }

  if (
    reactionTime <=
    config.answerTimeLimit
  ) {
    const progress =
      (
        reactionTime -
        config.slowRt
      ) /
      Math.max(
        config.answerTimeLimit -
          config.slowRt,
        1
      );

    return (
      30 -
      progress * 20
    );
  }

  return 5;
}

function getReactionSpeedScore({
  representativeReactionTime,
  validRtCount,
  totalTrials,
  config,
}) {
  if (
    !isFiniteNumber(
      representativeReactionTime
    ) ||
    validRtCount <= 0 ||
    totalTrials <= 0
  ) {
    return 0;
  }

  const baseScore =
    getBaseReactionSpeedScore(
      representativeReactionTime,
      config
    );

  const reliableRtTarget =
    Math.max(
      3,
      Math.ceil(
        totalTrials * 0.5
      )
    );

  const reliability =
    clamp(
      validRtCount /
        reliableRtTarget,
      0,
      1
    );

  return clamp(
    baseScore *
      (
        0.45 +
        reliability * 0.55
      ),
    0,
    100
  );
}

function getStabilityScore({
  rtStd,
  rtCv,
  validRtCount,
  config,
}) {
  if (
    validRtCount <= 0
  ) {
    return 0;
  }

  if (
    validRtCount === 1
  ) {
    return 35;
  }

  let deviationScore = 0;

  if (
    !isFiniteNumber(rtStd)
  ) {
    deviationScore = 0;
  } else if (
    rtStd <=
    config.stableStd
  ) {
    deviationScore = 100;
  } else if (
    rtStd <=
    config.acceptableStd
  ) {
    const progress =
      (
        rtStd -
        config.stableStd
      ) /
      Math.max(
        config.acceptableStd -
          config.stableStd,
        1
      );

    deviationScore =
      100 -
      progress * 30;
  } else if (
    rtStd <=
    config.unstableStd
  ) {
    const progress =
      (
        rtStd -
        config.acceptableStd
      ) /
      Math.max(
        config.unstableStd -
          config.acceptableStd,
        1
      );

    deviationScore =
      70 -
      progress * 35;
  } else {
    deviationScore = 25;
  }

  let cvScore = 55;

  if (
    isFiniteNumber(rtCv)
  ) {
    if (rtCv <= 0.2) {
      cvScore = 100;
    } else if (
      rtCv <= 0.3
    ) {
      cvScore = 85;
    } else if (
      rtCv <= 0.4
    ) {
      cvScore = 65;
    } else if (
      rtCv <= 0.55
    ) {
      cvScore = 40;
    } else {
      cvScore = 20;
    }
  }

  return clamp(
    deviationScore * 0.65 +
      cvScore * 0.35,
    0,
    100
  );
}

function getRuleInhibitionScore({
  sameAnimalErrorRate,
  anticipationRate,
}) {
  /*
    過早反應已影響正確率與作答控制，
    因此在抑制分數中的權重低於同動物錯誤。
  */
  return clamp(
    100 -
      sameAnimalErrorRate *
        1.15 -
      anticipationRate *
        0.45,
    0,
    100
  );
}

function getResponseControlScore({
  timeoutRate,
  anticipationRate,
  randomClickCount,
  prematureClickCount,
  repeatedClickCount,
  totalTrials,
}) {
  const normalizedTrialCount =
    Math.max(
      totalTrials,
      1
    );

  const randomClickRate =
    (
      randomClickCount /
      normalizedTrialCount
    ) * 100;

  const prematureClickRate =
    (
      prematureClickCount /
      normalizedTrialCount
    ) * 100;

  const repeatedClickRate =
    (
      repeatedClickCount /
      normalizedTrialCount
    ) * 100;

  return clamp(
    100 -
      timeoutRate * 1.0 -
      anticipationRate * 1.15 -
      randomClickRate * 0.18 -
      prematureClickRate *
        0.22 -
      repeatedClickRate *
        0.12,
    0,
    100
  );
}

function getAttentionMaintenanceScore({
  firstHalfAccuracy,
  secondHalfAccuracy,
  firstHalfRt,
  secondHalfRt,
  hasReliableHalfComparison,
}) {
  if (
    !hasReliableHalfComparison
  ) {
    return 50;
  }

  const accuracyDrop =
    Math.max(
      firstHalfAccuracy -
        secondHalfAccuracy,
      0
    );

  const reactionTimeIncrease =
    isFiniteNumber(
      firstHalfRt
    ) &&
    isFiniteNumber(
      secondHalfRt
    )
      ? Math.max(
          secondHalfRt -
            firstHalfRt,
          0
        )
      : 0;

  return clamp(
    100 -
      accuracyDrop * 1.5 -
      Math.min(
        reactionTimeIncrease /
          25,
        20
      ),
    0,
    100
  );
}

/* =========================================================
   注意力類型與弱項
   ========================================================= */

function getAttentionProfile({
  totalTrials,
  accuracy,
  timeoutRate,
  sameAnimalErrorRate,
  anticipationRate,
  attentionDrop,
  hasReliableHalfComparison,
  stabilityScore,
  soundAccuracyDifference,
  hasReliableSoundComparison,
}) {
  if (totalTrials <= 0) {
    return "insufficient_data";
  }

  if (
    timeoutRate >= 30 &&
    accuracy < 65
  ) {
    return "slow_start";
  }

  if (
    anticipationRate >= 20
  ) {
    return "impulsive";
  }

  if (
    sameAnimalErrorRate >= 25
  ) {
    return "rule_inhibition_weak";
  }

  if (
    hasReliableHalfComparison &&
    isFiniteNumber(
      attentionDrop
    ) &&
    attentionDrop >= 25
  ) {
    return "fatigue";
  }

  if (
    hasReliableSoundComparison &&
    soundAccuracyDifference >=
      30
  ) {
    return "sound_rule_asymmetry";
  }

  if (
    stabilityScore < 50
  ) {
    return "unstable";
  }

  if (
    accuracy >= 82 &&
    timeoutRate <= 12 &&
    sameAnimalErrorRate <=
      12 &&
    anticipationRate <= 12
  ) {
    return "stable";
  }

  return "developing";
}

function getMainWeakness({
  totalTrials,
  accuracy,
  timeoutRate,
  sameAnimalErrorRate,
  anticipationRate,
  representativeReactionTime,
  attentionDrop,
  hasReliableHalfComparison,
  stabilityScore,
  soundAccuracyDifference,
  hasReliableSoundComparison,
  sideAccuracyDifference,
  hasReliableSideComparison,
  config,
}) {
  if (totalTrials <= 0) {
    return "insufficient_data";
  }

  if (
    timeoutRate >= 30
  ) {
    return "response_initiation";
  }

  if (
    anticipationRate >= 20
  ) {
    return "impulse_control";
  }

  if (
    sameAnimalErrorRate >= 25
  ) {
    return "rule_inhibition";
  }

  if (
    accuracy < 55
  ) {
    return "rule_understanding";
  }

  if (
    isFiniteNumber(
      representativeReactionTime
    ) &&
    representativeReactionTime >
      config.acceptableRt *
        1.15
  ) {
    return "response_speed";
  }

  if (
    hasReliableHalfComparison &&
    isFiniteNumber(
      attentionDrop
    ) &&
    attentionDrop >= 25
  ) {
    return "sustained_attention";
  }

  if (
    stabilityScore < 45
  ) {
    return "response_stability";
  }

  if (
    hasReliableSoundComparison &&
    soundAccuracyDifference >=
      30
  ) {
    return "sound_discrimination";
  }

  if (
    hasReliableSideComparison &&
    sideAccuracyDifference >=
      30
  ) {
    return "side_bias";
  }

  return "none";
}

/* =========================================================
   提示建議
   ========================================================= */

function getRecommendedHintLevel({
  totalTrials,
  accuracy,
  timeoutRate,
  sameAnimalErrorRate,
  anticipationRate,
  attentionDrop,
  hasReliableHalfComparison,
}) {
  if (totalTrials <= 0) {
    return "neutral";
  }

  if (
    accuracy < 50 ||
    timeoutRate >= 35 ||
    sameAnimalErrorRate >= 35
  ) {
    return "direct";
  }

  if (
    anticipationRate >= 20
  ) {
    return "neutral";
  }

  if (
    hasReliableHalfComparison &&
    isFiniteNumber(
      attentionDrop
    ) &&
    attentionDrop >= 25
  ) {
    return "neutral";
  }

  if (
    accuracy >= 90 &&
    timeoutRate <= 8 &&
    sameAnimalErrorRate <= 8 &&
    anticipationRate <= 8
  ) {
    return "none";
  }

  if (
    accuracy >= 78 &&
    timeoutRate <= 15 &&
    sameAnimalErrorRate <= 15
  ) {
    return "attentionOnly";
  }

  return "neutral";
}

/* =========================================================
   難度升降判定
   ========================================================= */

function getDifficultyDirection({
  aiScore,
  accuracy,
  timeoutRate,
  sameAnimalErrorRate,
  anticipationRate,
  attentionDrop,
  hasReliableHalfComparison,
  stabilityScore,
  totalTrials,
  expectedTrials,
  config,
}) {
  const minimumReliableTrials =
    Math.max(
      4,
      Math.ceil(
        expectedTrials * 0.5
      )
    );

  if (
    totalTrials <
    minimumReliableTrials
  ) {
    if (
      accuracy < 45 ||
      timeoutRate >= 45 ||
      sameAnimalErrorRate >=
        45
    ) {
      return "easier";
    }

    return "same";
  }

  const noAttentionDecline =
    !hasReliableHalfComparison ||
    !isFiniteNumber(
      attentionDrop
    ) ||
    attentionDrop < 20;

  const canUpgrade =
    aiScore >= 82 &&
    accuracy >=
      config.upgradeAccuracy &&
    timeoutRate <=
      config.upgradeTimeoutRate &&
    sameAnimalErrorRate <=
      config.upgradeSameAnimalErrorRate &&
    anticipationRate <=
      config.upgradeAnticipationRate &&
    stabilityScore >=
      config.upgradeStabilityScore &&
    noAttentionDecline;

  if (canUpgrade) {
    return "harder";
  }

  const shouldDowngrade =
    aiScore < 55 ||
    accuracy <
      config.downgradeAccuracy ||
    timeoutRate >=
      config.downgradeTimeoutRate ||
    sameAnimalErrorRate >=
      config.downgradeSameAnimalErrorRate;

  if (shouldDowngrade) {
    return "easier";
  }

  return "same";
}

/*
  防止難度因單次偶然表現反覆升降。

  previousAnalysis 可傳入上一輪 analyzeSsgTraining 的結果。
  若沒有傳入，仍會依本輪結果直接判定。
*/
function stabilizeDifficultyDirection({
  rawDirection,
  currentDifficulty,
  previousAnalysis,
  requireRepeatedUpgrade = true,
  requireRepeatedDowngrade = false,
}) {
  if (!previousAnalysis) {
    return rawDirection;
  }

  const previousDirection =
    previousAnalysis?.difficultyDirection ||
    previousAnalysis?.rawDifficultyDirection ||
    "same";

  const previousRecommended =
    normalizeDifficulty(
      previousAnalysis
        ?.recommendedDifficulty ||
        currentDifficulty
    );

  const normalizedCurrent =
    normalizeDifficulty(
      currentDifficulty
    );

  if (
    rawDirection === "harder" &&
    requireRepeatedUpgrade
  ) {
    const previousAlsoSuggestedUpgrade =
      previousDirection ===
        "harder" ||
      getDifficultyIndex(
        previousRecommended
      ) >
        getDifficultyIndex(
          normalizedCurrent
        );

    return previousAlsoSuggestedUpgrade
      ? "harder"
      : "same";
  }

  if (
    rawDirection === "easier" &&
    requireRepeatedDowngrade
  ) {
    const previousAlsoSuggestedDowngrade =
      previousDirection ===
        "easier" ||
      getDifficultyIndex(
        previousRecommended
      ) <
        getDifficultyIndex(
          normalizedCurrent
        );

    return previousAlsoSuggestedDowngrade
      ? "easier"
      : "same";
  }

  return rawDirection;
}

/* =========================================================
   摘要文字
   ========================================================= */

function buildParentSummary({
  totalTrials,
  attentionProfile,
  mainWeakness,
  accuracy,
  representativeReactionTime,
  sameAnimalErrorRate,
  timeoutRate,
  soundAccuracyDifference,
  hasReliableSoundComparison,
}) {
  if (totalTrials <= 0) {
    return "目前沒有足夠的訓練資料，完成一輪訓練後才能提供個人化建議。";
  }

  if (
    attentionProfile ===
    "stable"
  ) {
    return (
      "孩子大多能記住「貓叫選狗、狗叫選貓」的相反規則，" +
      "並能維持穩定的反應速度與注意力。"
    );
  }

  if (
    mainWeakness ===
    "response_initiation"
  ) {
    return (
      "孩子逾時比例較高，可能需要更多時間辨認聲音並開始作答。" +
      "建議先延長作答時間，並保留較明顯的注意提示。"
    );
  }

  if (
    mainWeakness ===
    "impulse_control"
  ) {
    return (
      "孩子有較多過早反應或快速點擊的情況，" +
      "可能尚未完整聽完聲音便開始作答。"
    );
  }

  if (
    mainWeakness ===
    "rule_inhibition"
  ) {
    return (
      "孩子較常直接選擇發出聲音的動物，" +
      "表示抑制直覺反應並轉換成相反選擇的能力仍需要練習。"
    );
  }

  if (
    mainWeakness ===
    "rule_understanding"
  ) {
    return (
      "孩子目前對「聽到聲音後選擇相反動物」的規則仍不夠穩定，" +
      "建議先使用簡單模式並增加規則示範。"
    );
  }

  if (
    mainWeakness ===
    "response_speed"
  ) {
    return (
      "孩子大多能完成相反選擇，但需要較多時間辨認聲音與轉換規則，" +
      "建議先維持目前難度，讓作答速度逐漸穩定。"
    );
  }

  if (
    mainWeakness ===
    "sustained_attention"
  ) {
    return (
      "孩子後半段的正確率或反應速度下降，" +
      "可能出現注意力維持困難或疲勞。"
    );
  }

  if (
    mainWeakness ===
    "response_stability"
  ) {
    return (
      "孩子不同題目間的反應時間差異較大，" +
      "建議維持目前難度並觀察作答節奏是否逐漸穩定。"
    );
  }

  if (
    mainWeakness ===
    "sound_discrimination"
  ) {
    return (
      "孩子在貓叫與狗叫兩種題型的表現差距較大，" +
      "可能對其中一種聲音或規則方向較不熟悉。"
    );
  }

  if (
    mainWeakness ===
    "side_bias"
  ) {
    return (
      "孩子在左右兩側的作答表現差距較大，" +
      "建議觀察是否有固定點選某一側的習慣。"
    );
  }

  const speedText =
    isFiniteNumber(
      representativeReactionTime
    )
      ? `代表性正確反應時間約為 ${Math.round(
          representativeReactionTime
        )} 毫秒。`
      : "目前正確反應時間資料不足。";

  if (
    accuracy >= 65 &&
    sameAnimalErrorRate < 25 &&
    timeoutRate < 30
  ) {
    return (
      `孩子已能完成多數相反選擇題目，${speedText}` +
      "目前可繼續維持難度，累積更穩定的表現。"
    );
  }

  if (
    hasReliableSoundComparison &&
    soundAccuracyDifference >= 25
  ) {
    return (
      "孩子已開始理解相反選擇規則，" +
      "但在貓聲與狗聲題型間仍有明顯差異，建議分別加強練習。"
    );
  }

  return (
    "孩子目前仍需要更多時間熟悉聲音與相反動物之間的關係，" +
    "建議使用較長的作答時間與清楚的非文字提示。"
  );
}

function buildSuggestedAction({
  totalTrials,
  recommendedDifficulty,
  recommendedHintLevel,
  mainWeakness,
  weakerSoundType,
}) {
  if (totalTrials <= 0) {
    return "請先完成一輪訓練，再依實際表現調整下一輪難度。";
  }

  if (
    mainWeakness ===
    "response_initiation"
  ) {
    return (
      "下一輪建議延長作答時間，聲音播放完成後加入輕微閃爍提示，" +
      "協助孩子開始反應。"
    );
  }

  if (
    mainWeakness ===
    "impulse_control"
  ) {
    return (
      "下一輪建議加入短暫等待提示，避免聲音尚未播放完成就能點擊，" +
      "並維持中性提示，不直接顯示答案。"
    );
  }

  if (
    mainWeakness ===
    "rule_inhibition"
  ) {
    return (
      "下一輪建議維持或降低難度，增加「貓叫選狗、狗叫選貓」的示範，" +
      "並使用短暫的相反規則提示。"
    );
  }

  if (
    mainWeakness ===
    "rule_understanding"
  ) {
    return (
      "建議改用簡單模式，先播放聲音，再以圖片示範相反選擇，" +
      "確認孩子理解規則後再開始正式題目。"
    );
  }

  if (
    mainWeakness ===
    "response_speed"
  ) {
    return (
      "建議維持目前難度與作答時間，先提升正確作答的熟練度，" +
      "暫時不要進一步縮短反應時間。"
    );
  }

  if (
    mainWeakness ===
    "sustained_attention"
  ) {
    return (
      "建議降低單輪題數或在中間加入短暫休息，" +
      "並觀察後半段正確率是否改善。"
    );
  }

  if (
    mainWeakness ===
    "response_stability"
  ) {
    return (
      "建議維持目前難度，讓每題的聲音播放與提示節奏保持一致，" +
      "先建立穩定的作答節奏。"
    );
  }

  if (
    mainWeakness ===
    "sound_discrimination"
  ) {
    const soundLabel =
      weakerSoundType === "cat"
        ? "貓叫"
        : weakerSoundType ===
            "dog"
          ? "狗叫"
          : "較弱的聲音題型";

    return (
      `建議增加「${soundLabel}」題型的練習，` +
      "但仍應保留另一種聲音題，避免只記住單一配對。"
    );
  }

  if (
    mainWeakness ===
    "side_bias"
  ) {
    return (
      "建議下一輪平衡正確答案出現在左右兩側的次數，" +
      "並避免連續多題答案位於同一側。"
    );
  }

  if (
    recommendedDifficulty ===
      "hard" &&
    recommendedHintLevel ===
      "none"
  ) {
    return (
      "孩子目前表現穩定，可嘗試困難模式，縮短作答時間並取消直接提示。"
    );
  }

  if (
    recommendedDifficulty ===
    "hard"
  ) {
    return (
      "可以嘗試困難模式，但仍保留輕微的注意提示，" +
      "觀察孩子能否在較短時間內維持相反選擇規則。"
    );
  }

  if (
    recommendedDifficulty ===
    "normal"
  ) {
    if (
      recommendedHintLevel ===
        "attentionOnly" ||
      recommendedHintLevel ===
        "none"
    ) {
      return (
        "建議使用普通模式並減少直接提示，" +
        "讓孩子練習自行聽聲音、轉換規則並作答。"
      );
    }

    return (
      "建議使用普通模式，搭配輕微閃爍或晃動提示，" +
      "協助孩子維持注意但不直接提供答案。"
    );
  }

  return (
    "建議先使用簡單模式，延長作答時間並保留清楚的相反規則提示。"
  );
}

/* =========================================================
   下一輪題型配置
   ========================================================= */

function buildNextRoundSoundDistribution({
  recommendedRoundLength,
  weakerSoundType,
  mainWeakness,
}) {
  const total =
    Math.max(
      2,
      Math.round(
        recommendedRoundLength
      )
    );

  let catCount =
    Math.floor(total / 2);

  let dogCount =
    total - catCount;

  if (
    mainWeakness ===
      "sound_discrimination" &&
    weakerSoundType
  ) {
    const extraPracticeCount =
      Math.max(
        1,
        Math.round(
          total * 0.15
        )
      );

    if (
      weakerSoundType === "cat"
    ) {
      catCount =
        Math.min(
          total - 1,
          catCount +
            extraPracticeCount
        );

      dogCount =
        total - catCount;
    } else if (
      weakerSoundType === "dog"
    ) {
      dogCount =
        Math.min(
          total - 1,
          dogCount +
            extraPracticeCount
        );

      catCount =
        total - dogCount;
    }
  }

  return {
    catSoundTrials:
      catCount,

    dogSoundTrials:
      dogCount,

    weakerSoundType:
      weakerSoundType ||
      null,

    isWeightedPractice:
      mainWeakness ===
      "sound_discrimination",
  };
}

function resolveRecommendedRoundLength({
  recommendedDifficulty,
  expectedTrials,
  mainWeakness,
  attentionDrop,
}) {
  const baseLength =
    DIFFICULTY_CONFIG[
      recommendedDifficulty
    ]?.expectedTrials ??
    expectedTrials;

  if (
    mainWeakness ===
      "sustained_attention" ||
    (
      isFiniteNumber(
        attentionDrop
      ) &&
      attentionDrop >= 25
    )
  ) {
    return Math.max(
      6,
      Math.min(
        baseLength - 2,
        expectedTrials
      )
    );
  }

  if (
    mainWeakness ===
      "rule_understanding" ||
    mainWeakness ===
      "impulse_control"
  ) {
    return Math.max(
      6,
      Math.min(
        baseLength,
        10
      )
    );
  }

  return baseLength;
}

/* =========================================================
   訓練分析主函式
   ========================================================= */

export function analyzeSsgTraining({
  records = [],

  difficultyKey = "normal",
  difficulty = null,

  randomClickCount = null,
  prematureClickCount = null,
  repeatedClickCount = null,

  plannedTotalRounds = null,
  expectedTrials = null,

  /*
    可選：傳入上一輪 analyzeSsgTraining 的結果，
    用於防止單輪偶然表現造成難度反覆跳動。
  */
  previousAnalysis = null,

  /*
    預設升級需連續兩輪達標；
    降級則可立即生效，以降低挫折。
  */
  requireRepeatedUpgrade = true,
  requireRepeatedDowngrade = false,
} = {}) {
  const safeRecords =
    safeArray(records).filter(
      (record) =>
        record &&
        typeof record ===
          "object"
    );

  const recordWithDifficulty =
    safeRecords.find(
      (record) =>
        record?.difficulty ||
        record?.difficultyKey
    );

  const resolvedDifficulty =
    normalizeDifficulty(
      difficulty ||
        difficultyKey ||
        recordWithDifficulty
          ?.difficulty ||
        recordWithDifficulty
          ?.difficultyKey
    );

  const config =
    DIFFICULTY_CONFIG[
      resolvedDifficulty
    ] ||
    DIFFICULTY_CONFIG.normal;

  const difficultyLabel =
    getDifficultyLabel(
      resolvedDifficulty
    );

  const resolvedExpectedTrials =
    Math.max(
      1,
      toFiniteNumber(
        plannedTotalRounds ??
          expectedTrials ??
          config.expectedTrials,
        config.expectedTrials
      )
    );

  const totalTrials =
    safeRecords.length;

  /* -------------------------
     基本作答表現
     ------------------------- */

  const correctRecords =
    safeRecords.filter(
      isCorrectRecord
    );

  const wrongRecords =
    safeRecords.filter(
      isWrongRecord
    );

  const timeoutRecords =
    safeRecords.filter(
      isTimeoutRecord
    );

  const anticipationRecords =
    safeRecords.filter(
      isAnticipationRecord
    );

  const sameAnimalErrorRecords =
    safeRecords.filter(
      isSameAnimalError
    );

  const correctCount =
    correctRecords.length;

  const wrongCount =
    wrongRecords.length;

  const timeoutCount =
    timeoutRecords.length;

  const anticipationCount =
    anticipationRecords.length;

  const sameAnimalErrorCount =
    sameAnimalErrorRecords.length;

  const incorrectCount =
    wrongCount +
    anticipationCount;

  const nonCorrectCount =
    Math.max(
      totalTrials -
        correctCount,
      0
    );

  const accountedTrialCount =
    correctCount +
    wrongCount +
    timeoutCount +
    anticipationCount;

  const accuracy =
    percentage(
      correctCount,
      totalTrials
    );

  const wrongRate =
    percentage(
      wrongCount,
      totalTrials
    );

  const incorrectRate =
    percentage(
      incorrectCount,
      totalTrials
    );

  const nonCorrectRate =
    percentage(
      nonCorrectCount,
      totalTrials
    );

  const timeoutRate =
    percentage(
      timeoutCount,
      totalTrials
    );

  const anticipationRate =
    percentage(
      anticipationCount,
      totalTrials
    );

  const sameAnimalErrorRate =
    percentage(
      sameAnimalErrorCount,
      totalTrials
    );

  const completionRate =
    percentage(
      Math.min(
        totalTrials,
        resolvedExpectedTrials
      ),
      resolvedExpectedTrials
    );

  /* -------------------------
     反應時間
     ------------------------- */

  const correctReactionTimes =
    getCorrectReactionTimes(
      safeRecords
    );

  const validRtCount =
    correctReactionTimes.length;

  const avgReactionTime =
    roundNumber(
      average(
        correctReactionTimes
      ),
      0
    );

  const medianReactionTime =
    roundNumber(
      median(
        correctReactionTimes
      ),
      0
    );

  const representativeReactionTime =
    isFiniteNumber(
      medianReactionTime
    ) &&
    isFiniteNumber(
      avgReactionTime
    )
      ? roundNumber(
          medianReactionTime *
            0.7 +
            avgReactionTime *
              0.3,
          0
        )
      : (
          medianReactionTime ??
          avgReactionTime
        );

  const reactionTimeStd =
    roundNumber(
      populationStandardDeviation(
        correctReactionTimes
      ),
      0
    );

  const sampleReactionTimeStd =
    roundNumber(
      sampleStandardDeviation(
        correctReactionTimes
      ),
      0
    );

  const reactionTimeCv =
    roundNumber(
      coefficientOfVariation(
        correctReactionTimes
      ),
      3
    );

  const fastestReactionTime =
    correctReactionTimes.length > 0
      ? Math.min(
          ...correctReactionTimes
        )
      : null;

  const slowestReactionTime =
    correctReactionTimes.length > 0
      ? Math.max(
          ...correctReactionTimes
        )
      : null;

  /* -------------------------
     貓聲／狗聲題型
     ------------------------- */

  const catSoundRecords =
    safeRecords.filter(
      (record) =>
        record?.soundType ===
        "cat"
    );

  const dogSoundRecords =
    safeRecords.filter(
      (record) =>
        record?.soundType ===
        "dog"
    );

  const catSoundCorrectCount =
    catSoundRecords.filter(
      isCorrectRecord
    ).length;

  const dogSoundCorrectCount =
    dogSoundRecords.filter(
      isCorrectRecord
    ).length;

  const catSoundAccuracy =
    percentage(
      catSoundCorrectCount,
      catSoundRecords.length
    );

  const dogSoundAccuracy =
    percentage(
      dogSoundCorrectCount,
      dogSoundRecords.length
    );

  const catSoundRt =
    roundNumber(
      median(
        getCorrectReactionTimes(
          catSoundRecords
        )
      ),
      0
    );

  const dogSoundRt =
    roundNumber(
      median(
        getCorrectReactionTimes(
          dogSoundRecords
        )
      ),
      0
    );

  const soundAccuracyDifference =
    Math.abs(
      catSoundAccuracy -
        dogSoundAccuracy
    );

  const hasReliableSoundComparison =
    catSoundRecords.length >=
      MIN_SOUND_TRIALS &&
    dogSoundRecords.length >=
      MIN_SOUND_TRIALS;

  const weakerSoundType =
    hasReliableSoundComparison
      ? catSoundAccuracy <
        dogSoundAccuracy
        ? "cat"
        : dogSoundAccuracy <
            catSoundAccuracy
          ? "dog"
          : null
      : null;

  /* -------------------------
     目標動物
     ------------------------- */

  const dogTargetRecords =
    safeRecords.filter(
      (record) =>
        record?.expectedTarget ===
          "dog" ||
        getExpectedTarget(
          record?.soundType
        ) === "dog"
    );

  const catTargetRecords =
    safeRecords.filter(
      (record) =>
        record?.expectedTarget ===
          "cat" ||
        getExpectedTarget(
          record?.soundType
        ) === "cat"
    );

  const dogTargetCorrectCount =
    dogTargetRecords.filter(
      isCorrectRecord
    ).length;

  const catTargetCorrectCount =
    catTargetRecords.filter(
      isCorrectRecord
    ).length;

  const dogTargetAccuracy =
    percentage(
      dogTargetCorrectCount,
      dogTargetRecords.length
    );

  const catTargetAccuracy =
    percentage(
      catTargetCorrectCount,
      catTargetRecords.length
    );

  /* -------------------------
     左右側
     ------------------------- */

  const leftRecords =
    safeRecords.filter(
      (record) =>
        record?.correctPosition ===
          "left" ||
        record?.correctSide ===
          "left" ||
        record?.targetSide ===
          "left"
    );

  const rightRecords =
    safeRecords.filter(
      (record) =>
        record?.correctPosition ===
          "right" ||
        record?.correctSide ===
          "right" ||
        record?.targetSide ===
          "right"
    );

  const leftCorrectCount =
    leftRecords.filter(
      isCorrectRecord
    ).length;

  const rightCorrectCount =
    rightRecords.filter(
      isCorrectRecord
    ).length;

  const leftAccuracy =
    percentage(
      leftCorrectCount,
      leftRecords.length
    );

  const rightAccuracy =
    percentage(
      rightCorrectCount,
      rightRecords.length
    );

  const sideAccuracyDifference =
    Math.abs(
      leftAccuracy -
        rightAccuracy
    );

  const hasReliableSideComparison =
    leftRecords.length >=
      MIN_SIDE_TRIALS &&
    rightRecords.length >=
      MIN_SIDE_TRIALS;

  /* -------------------------
     前後半段
     ------------------------- */

  const splitIndex =
    Math.ceil(
      totalTrials / 2
    );

  const firstHalfRecords =
    safeRecords.slice(
      0,
      splitIndex
    );

  const secondHalfRecords =
    safeRecords.slice(
      splitIndex
    );

  const firstHalfCorrect =
    firstHalfRecords.filter(
      isCorrectRecord
    ).length;

  const secondHalfCorrect =
    secondHalfRecords.filter(
      isCorrectRecord
    ).length;

  const firstHalfAccuracy =
    percentage(
      firstHalfCorrect,
      firstHalfRecords.length
    );

  const secondHalfAccuracy =
    percentage(
      secondHalfCorrect,
      secondHalfRecords.length
    );

  const firstHalfRt =
    roundNumber(
      median(
        getCorrectReactionTimes(
          firstHalfRecords
        )
      ),
      0
    );

  const secondHalfRt =
    roundNumber(
      median(
        getCorrectReactionTimes(
          secondHalfRecords
        )
      ),
      0
    );

  const hasReliableHalfComparison =
    firstHalfRecords.length >=
      MIN_HALF_TRIALS &&
    secondHalfRecords.length >=
      MIN_HALF_TRIALS;

  const accuracyChange =
    hasReliableHalfComparison
      ? roundNumber(
          secondHalfAccuracy -
            firstHalfAccuracy,
          0
        )
      : null;

  const attentionDrop =
    hasReliableHalfComparison
      ? Math.max(
          firstHalfAccuracy -
            secondHalfAccuracy,
          0
        )
      : null;

  const reactionTimeIncrease =
    hasReliableHalfComparison &&
    isFiniteNumber(
      firstHalfRt
    ) &&
    isFiniteNumber(
      secondHalfRt
    )
      ? Math.max(
          secondHalfRt -
            firstHalfRt,
          0
        )
      : null;

  /* -------------------------
     點擊行為
     ------------------------- */

  const resolvedRandomClickCount =
    getGlobalCounter(
      safeRecords,
      randomClickCount,
      "randomClickCount"
    );

  const resolvedPrematureClickCount =
    getGlobalCounter(
      safeRecords,
      prematureClickCount,
      "prematureClickCount"
    );

  const resolvedRepeatedClickCount =
    getGlobalCounter(
      safeRecords,
      repeatedClickCount,
      "repeatedClickCount"
    );

  /* -------------------------
     AI 能力分數
     ------------------------- */

  const accuracyScore =
    clamp(
      accuracy,
      0,
      100
    );

  const reactionSpeedScore =
    clamp(
      roundNumber(
        getReactionSpeedScore({
          representativeReactionTime,
          validRtCount,
          totalTrials,
          config,
        }),
        0
      ) ?? 0,
      0,
      100
    );

  const ruleInhibitionScore =
    clamp(
      roundNumber(
        getRuleInhibitionScore({
          sameAnimalErrorRate,
          anticipationRate,
        }),
        0
      ) ?? 0,
      0,
      100
    );

  const responseControlScore =
    clamp(
      roundNumber(
        getResponseControlScore({
          timeoutRate,
          anticipationRate,

          randomClickCount:
            resolvedRandomClickCount,

          prematureClickCount:
            resolvedPrematureClickCount,

          repeatedClickCount:
            resolvedRepeatedClickCount,

          totalTrials,
        }),
        0
      ) ?? 0,
      0,
      100
    );

  const stabilityScore =
    clamp(
      roundNumber(
        getStabilityScore({
          rtStd:
            reactionTimeStd,

          rtCv:
            reactionTimeCv,

          validRtCount,
          config,
        }),
        0
      ) ?? 0,
      0,
      100
    );

  const attentionMaintenanceScore =
    clamp(
      roundNumber(
        getAttentionMaintenanceScore({
          firstHalfAccuracy,
          secondHalfAccuracy,
          firstHalfRt,
          secondHalfRt,
          hasReliableHalfComparison,
        }),
        0
      ) ?? 0,
      0,
      100
    );

  /*
    AI 分數權重：
    - 正確率             30%
    - 相反規則抑制       25%
    - 反應速度           15%
    - 作答控制           15%
    - 反應穩定度         10%
    - 注意力維持          5%
  */

  let aiScore =
    accuracyScore * 0.3 +
    ruleInhibitionScore *
      0.25 +
    reactionSpeedScore *
      0.15 +
    responseControlScore *
      0.15 +
    stabilityScore * 0.1 +
    attentionMaintenanceScore *
      0.05;

  const minimumReliableTrials =
    Math.max(
      4,
      Math.ceil(
        resolvedExpectedTrials *
          0.5
      )
    );

  const reliability =
    totalTrials >=
    minimumReliableTrials
      ? 1
      : clamp(
          totalTrials /
            minimumReliableTrials,
          0,
          1
        );

  if (reliability < 1) {
    aiScore *=
      0.65 +
      reliability * 0.35;
  }

  aiScore =
    clamp(
      Math.round(aiScore),
      0,
      100
    );

  /* -------------------------
     個人化判定
     ------------------------- */

  const rawDifficultyDirection =
    getDifficultyDirection({
      aiScore,
      accuracy,
      timeoutRate,
      sameAnimalErrorRate,
      anticipationRate,
      attentionDrop,
      hasReliableHalfComparison,
      stabilityScore,
      totalTrials,
      expectedTrials:
        resolvedExpectedTrials,
      config,
    });

  const difficultyDirection =
    stabilizeDifficultyDirection({
      rawDirection:
        rawDifficultyDirection,

      currentDifficulty:
        resolvedDifficulty,

      previousAnalysis,

      requireRepeatedUpgrade,

      requireRepeatedDowngrade,
    });

  const recommendedDifficulty =
    getNextDifficulty(
      resolvedDifficulty,
      difficultyDirection
    );

  const attentionProfile =
    getAttentionProfile({
      totalTrials,
      accuracy,
      timeoutRate,
      sameAnimalErrorRate,
      anticipationRate,
      attentionDrop,
      hasReliableHalfComparison,
      stabilityScore,
      soundAccuracyDifference,
      hasReliableSoundComparison,
    });

  const mainWeakness =
    getMainWeakness({
      totalTrials,
      accuracy,
      timeoutRate,
      sameAnimalErrorRate,
      anticipationRate,

      representativeReactionTime,

      attentionDrop,
      hasReliableHalfComparison,

      stabilityScore,

      soundAccuracyDifference,
      hasReliableSoundComparison,

      sideAccuracyDifference,
      hasReliableSideComparison,

      config,
    });

  const recommendedHintLevel =
    getRecommendedHintLevel({
      totalTrials,
      accuracy,
      timeoutRate,
      sameAnimalErrorRate,
      anticipationRate,
      attentionDrop,
      hasReliableHalfComparison,
    });

  const parentSummary =
    buildParentSummary({
      totalTrials,
      attentionProfile,
      mainWeakness,
      accuracy,

      representativeReactionTime,

      sameAnimalErrorRate,
      timeoutRate,

      soundAccuracyDifference,
      hasReliableSoundComparison,
    });

  const suggestedAction =
    buildSuggestedAction({
      totalTrials,
      recommendedDifficulty,
      recommendedHintLevel,
      mainWeakness,
      weakerSoundType,
    });

  const recommendedRoundLength =
    resolveRecommendedRoundLength({
      recommendedDifficulty,

      expectedTrials:
        resolvedExpectedTrials,

      mainWeakness,
      attentionDrop,
    });

  const soundDistribution =
    buildNextRoundSoundDistribution({
      recommendedRoundLength,
      weakerSoundType,
      mainWeakness,
    });

  const recommendedConfig =
    DIFFICULTY_CONFIG[
      recommendedDifficulty
    ] ||
    DIFFICULTY_CONFIG.normal;

  const performanceLevel =
    totalTrials <= 0
      ? "insufficient_data"
      : aiScore >= 82
        ? "good"
        : aiScore >= 58
          ? "developing"
          : "needs_support";

  /* =======================================================
     正式輸出
     ======================================================= */

  return {
    taskCode: "SSG",

    taskName:
      "聽聲音選相反動物",

    taskVersion:
      "audio-visual-opposite-v2",

    analyzerVersion:
      "2.0.0",

    performanceLevel,

    aiScore,

    reliability:
      roundNumber(
        reliability,
        3
      ) ?? 0,

    minimumReliableTrials,

    currentDifficulty:
      resolvedDifficulty,

    currentDifficultyLabel:
      difficultyLabel,

    rawDifficultyDirection,

    difficultyDirection,

    recommendedDifficulty,

    recommendedDifficultyLabel:
      getDifficultyLabel(
        recommendedDifficulty
      ),

    recommendedHintLevel,

    attentionProfile,
    mainWeakness,

    totalTrials,

    expectedTrials:
      resolvedExpectedTrials,

    completionRate,

    correctCount,
    wrongCount,
    incorrectCount,
    nonCorrectCount,

    timeoutCount,
    anticipationCount,
    sameAnimalErrorCount,

    accountedTrialCount,

    accuracy,
    wrongRate,
    incorrectRate,
    nonCorrectRate,
    timeoutRate,
    anticipationRate,
    sameAnimalErrorRate,

    validRtCount,

    avgReactionTime,
    medianReactionTime,

    representativeReactionTime,

    reactionTimeStd,
    sampleReactionTimeStd,
    reactionTimeCv,

    fastestReactionTime,
    slowestReactionTime,

    catSoundTotal:
      catSoundRecords.length,

    catSoundCorrectCount,
    catSoundAccuracy,
    catSoundRt,

    dogSoundTotal:
      dogSoundRecords.length,

    dogSoundCorrectCount,
    dogSoundAccuracy,
    dogSoundRt,

    soundAccuracyDifference,

    hasReliableSoundComparison,

    weakerSoundType,

    dogTargetTotal:
      dogTargetRecords.length,

    dogTargetCorrectCount,
    dogTargetAccuracy,

    catTargetTotal:
      catTargetRecords.length,

    catTargetCorrectCount,
    catTargetAccuracy,

    leftTotal:
      leftRecords.length,

    leftCorrectCount,
    leftAccuracy,

    rightTotal:
      rightRecords.length,

    rightCorrectCount,
    rightAccuracy,

    sideAccuracyDifference,

    hasReliableSideComparison,

    firstHalfTotal:
      firstHalfRecords.length,

    firstHalfCorrect,
    firstHalfAccuracy,
    firstHalfRt,

    secondHalfTotal:
      secondHalfRecords.length,

    secondHalfCorrect,
    secondHalfAccuracy,
    secondHalfRt,

    accuracyChange,
    attentionDrop,
    reactionTimeIncrease,

    hasReliableHalfComparison,

    randomClickCount:
      resolvedRandomClickCount,

    prematureClickCount:
      resolvedPrematureClickCount,

    repeatedClickCount:
      resolvedRepeatedClickCount,

    scores: {
      accuracyScore,

      reactionSpeedScore,

      ruleInhibitionScore,

      responseControlScore,

      stabilityScore,

      attentionMaintenanceScore,
    },

    nextRoundConfig: {
      difficulty:
        recommendedDifficulty,

      difficultyLabel:
        getDifficultyLabel(
          recommendedDifficulty
        ),

      hintLevel:
        recommendedHintLevel,

      shouldIncreaseDifficulty:
        difficultyDirection ===
        "harder",

      shouldDecreaseDifficulty:
        difficultyDirection ===
        "easier",

      shouldKeepDifficulty:
        difficultyDirection ===
        "same",

      wasUpgradeHeldForConfirmation:
        rawDifficultyDirection ===
          "harder" &&
        difficultyDirection ===
          "same",

      wasDowngradeHeldForConfirmation:
        rawDifficultyDirection ===
          "easier" &&
        difficultyDirection ===
          "same",

      suggestedAnswerTimeLimit:
        recommendedConfig
          .answerTimeLimit,

      recommendedRoundLength,

      soundDistribution,

      balanceTargetPositions: true,

      avoidSameSideStreak:
        mainWeakness ===
          "side_bias",

      allowSoundReplay:
        recommendedDifficulty !==
        "hard",

      showDirectRuleHint:
        recommendedHintLevel ===
        "direct",

      showAttentionHint:
        recommendedHintLevel ===
          "direct" ||
        recommendedHintLevel ===
          "neutral" ||
        recommendedHintLevel ===
          "attentionOnly",

      lockInputUntilSoundEnds:
        mainWeakness ===
          "impulse_control" ||
        anticipationRate >= 20,

      insertMidRoundBreak:
        mainWeakness ===
          "sustained_attention",

      suggestedBreakDurationMs:
        mainWeakness ===
          "sustained_attention"
          ? 5000
          : 0,
    },

    parentView: {
      summary:
        parentSummary,

      plainLanguageSummary:
        parentSummary,

      strengths: [
        accuracy >= 85
          ? "相反規則正確率良好"
          : null,

        ruleInhibitionScore >=
        80
          ? "能抑制直接選擇聲音來源動物"
          : null,

        reactionSpeedScore >=
        80
          ? "正確反應速度良好"
          : null,

        stabilityScore >= 80
          ? "作答節奏穩定"
          : null,

        attentionMaintenanceScore >=
        80
          ? "能維持後半段注意力"
          : null,
      ].filter(Boolean),

      needsSupport: [
        timeoutRate >= 30
          ? "反應啟動與逾時控制"
          : null,

        anticipationRate >= 20
          ? "等待與衝動控制"
          : null,

        sameAnimalErrorRate >=
        25
          ? "相反規則與抑制控制"
          : null,

        hasReliableHalfComparison &&
        isFiniteNumber(
          attentionDrop
        ) &&
        attentionDrop >= 25
          ? "注意力維持"
          : null,

        stabilityScore < 50
          ? "反應節奏穩定度"
          : null,

        hasReliableSoundComparison &&
        soundAccuracyDifference >=
          30
          ? "貓聲與狗聲規則平衡"
          : null,

        hasReliableSideComparison &&
        sideAccuracyDifference >=
          30
          ? "左右側作答平衡"
          : null,
      ].filter(Boolean),
    },

    parentSummary,
    suggestedAction,

    decisionReasons: {
      insufficientData:
        totalTrials <= 0,

      insufficientTrials:
        totalTrials <
        minimumReliableTrials,

      rawUpgradeCriteriaMet:
        rawDifficultyDirection ===
        "harder",

      rawDowngradeCriteriaMet:
        rawDifficultyDirection ===
        "easier",

      finalUpgradeDecision:
        difficultyDirection ===
        "harder",

      finalDowngradeDecision:
        difficultyDirection ===
        "easier",

      upgradeRequiresConfirmation:
        Boolean(
          requireRepeatedUpgrade
        ),

      downgradeRequiresConfirmation:
        Boolean(
          requireRepeatedDowngrade
        ),

      upgradeHeldForConfirmation:
        rawDifficultyDirection ===
          "harder" &&
        difficultyDirection ===
          "same",

      downgradeHeldForConfirmation:
        rawDifficultyDirection ===
          "easier" &&
        difficultyDirection ===
          "same",

      highTimeout:
        timeoutRate >= 30,

      highAnticipation:
        anticipationRate >=
        20,

      highSameAnimalError:
        sameAnimalErrorRate >=
        25,

      attentionDecline:
        hasReliableHalfComparison &&
        isFiniteNumber(
          attentionDrop
        ) &&
        attentionDrop >= 25,

      unstableReaction:
        stabilityScore < 50,

      soundRuleDifference:
        hasReliableSoundComparison &&
        soundAccuracyDifference >=
          30,

      sideBias:
        hasReliableSideComparison &&
        sideAccuracyDifference >=
          30,

      lowValidReactionTimeCount:
        validRtCount <
        Math.max(
          3,
          Math.ceil(
            totalTrials * 0.5
          )
        ),
    },

    legacyCompatibility: {
      deprecated: true,

      deprecatedSince:
        "audio-visual-opposite-v2",

      impulsiveCount:
        anticipationCount,

      impulsiveRate:
        anticipationRate,

      incongruentAccuracy:
        accuracy,

      incongruentScore:
        ruleInhibitionScore,

      distractorErrorCount:
        sameAnimalErrorCount,

      distractorErrorRate:
        sameAnimalErrorRate,

      distractorScore:
        ruleInhibitionScore,

      attentionScore:
        attentionMaintenanceScore,

      rtScore:
        reactionSpeedScore,

      timeoutScore:
        clamp(
          Math.round(
            100 -
              timeoutRate * 1.5
          ),
          0,
          100
        ),

      congruentTotal: 0,
      congruentCorrect: 0,
      congruentAccuracy: null,
      congruentRT: null,

      incongruentTotal:
        totalTrials,

      incongruentCorrect:
        correctCount,

      incongruentRT:
        representativeReactionTime,

      attentionBiasScore:
        null,

      rtDrop:
        reactionTimeIncrease,
    },

    records:
      safeRecords,

    generatedAt:
      new Date().toISOString(),
  };
}

export default analyzeSsgTraining;