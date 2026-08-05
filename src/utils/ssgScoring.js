// src/utils/ssgScoring.js

/*
  =========================================================
  SSG Scoring
  聽聲音選擇相反動物任務

  現行規則：
  - 聽到貓叫，選擇狗
  - 聽到狗叫，選擇貓

  評分面向：
  1. 相反規則正確率             40 分
  2. 反應速度                   20 分
  3. 抑制原聲動物反應           15 分
  4. 逾時控制                   10 分
  5. 反應穩定度                 10 分
  6. 注意力維持                  5 分

  本版優化：
  - 避免過早反應重複扣分
  - 速度分數加入有效反應題數可信度
  - 速度計算改以中位數為主、平均數為輔
  - 左右側、聲音類型、前後半段加入最低樣本門檻
  - 空資料回傳 0 星與 insufficient_data
  - 訓練與測驗採用不同星級標準
  - 增加 nonCorrectCount、accuracyChange 等欄位
  - 改善同動物錯誤判定
  - localStorage 預設讀取最新結果
  - 保留舊版欄位相容，但標記 deprecated
  =========================================================
*/

/* =========================================================
   基本工具
   ========================================================= */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 100) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, number));
}

function roundNumber(value, digits = 0) {
  if (!isFiniteNumber(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sum(numbers) {
  return safeArray(numbers)
    .filter(isFiniteNumber)
    .reduce((total, number) => total + number, 0);
}

function average(numbers) {
  const validNumbers = safeArray(numbers).filter(isFiniteNumber);

  if (validNumbers.length === 0) {
    return null;
  }

  return sum(validNumbers) / validNumbers.length;
}

function median(numbers) {
  const validNumbers = safeArray(numbers)
    .filter(isFiniteNumber)
    .sort((a, b) => a - b);

  if (validNumbers.length === 0) {
    return null;
  }

  const middle = Math.floor(validNumbers.length / 2);

  if (validNumbers.length % 2 === 0) {
    return (
      validNumbers[middle - 1] +
      validNumbers[middle]
    ) / 2;
  }

  return validNumbers[middle];
}

function populationStandardDeviation(numbers) {
  const validNumbers = safeArray(numbers).filter(isFiniteNumber);

  if (validNumbers.length < 2) {
    return null;
  }

  const mean = average(validNumbers);

  if (!isFiniteNumber(mean)) {
    return null;
  }

  const variance =
    validNumbers.reduce(
      (total, number) =>
        total + (number - mean) ** 2,
      0
    ) / validNumbers.length;

  return Math.sqrt(variance);
}

function sampleStandardDeviation(numbers) {
  const validNumbers = safeArray(numbers).filter(isFiniteNumber);

  if (validNumbers.length < 2) {
    return null;
  }

  const mean = average(validNumbers);

  if (!isFiniteNumber(mean)) {
    return null;
  }

  const variance =
    validNumbers.reduce(
      (total, number) =>
        total + (number - mean) ** 2,
      0
    ) / (validNumbers.length - 1);

  return Math.sqrt(variance);
}

function coefficientOfVariation(numbers) {
  const mean = average(numbers);
  const deviation = populationStandardDeviation(numbers);

  if (
    !isFiniteNumber(mean) ||
    mean <= 0 ||
    !isFiniteNumber(deviation)
  ) {
    return null;
  }

  return deviation / mean;
}

function percentage(part, total, digits = 0) {
  const safePart = toFiniteNumber(part, 0);
  const safeTotal = toFiniteNumber(total, 0);

  if (safeTotal <= 0) {
    return 0;
  }

  return (
    roundNumber(
      (safePart / safeTotal) * 100,
      digits
    ) ?? 0
  );
}

function normalizeDifficulty(value) {
  const rawValue = String(value || "")
    .trim()
    .toLowerCase();

  if (
    rawValue === "easy" ||
    rawValue === "simple"
  ) {
    return "easy";
  }

  if (
    rawValue === "hard" ||
    rawValue === "difficult" ||
    rawValue === "advanced"
  ) {
    return "hard";
  }

  return "normal";
}

function getDifficultyLabel(difficulty) {
  if (difficulty === "easy") {
    return "簡單";
  }

  if (difficulty === "hard") {
    return "困難";
  }

  return "普通";
}

function normalizeMode(value) {
  return value === "training" ? "training" : "test";
}

/* =========================================================
   關卡規格
   ========================================================= */

const DIFFICULTY_RULES = {
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
  },

  hard: {
    expectedTrials: 16,
    answerTimeLimit: 3200,

    /*
      困難模式主要透過題數、提示與作答時間形成難度，
      速度能力標準不額外大幅提高，避免同樣 RT 因難度不同
      而被評為不同能力。
    */
    excellentRt: 900,
    goodRt: 1400,
    acceptableRt: 2000,
    slowRt: 2700,

    stableStd: 280,
    acceptableStd: 600,
    unstableStd: 900,
  },
};

const MIN_SIDE_TRIALS = 4;
const MIN_SOUND_TRIALS = 4;
const MIN_HALF_TRIALS = 3;

function resolveDifficulty(records, options = {}) {
  const optionDifficulty =
    options?.difficulty ||
    options?.difficultyKey ||
    options?.level;

  if (optionDifficulty) {
    return normalizeDifficulty(optionDifficulty);
  }

  const recordWithDifficulty = safeArray(records).find(
    (record) =>
      record?.difficulty ||
      record?.difficultyKey
  );

  return normalizeDifficulty(
    recordWithDifficulty?.difficulty ||
      recordWithDifficulty?.difficultyKey
  );
}

function resolveMode(records, options = {}) {
  if (
    options?.mode === "training" ||
    options?.mode === "test"
  ) {
    return normalizeMode(options.mode);
  }

  const recordMode = safeArray(records).find(
    (record) =>
      record?.mode === "training" ||
      record?.mode === "test"
  )?.mode;

  return normalizeMode(recordMode);
}

/* =========================================================
   紀錄判定
   ========================================================= */

function isTimeoutRecord(record) {
  return (
    record?.timeout === true ||
    record?.errorType === "miss" ||
    record?.errorType === "timeout"
  );
}

function isAnticipationRecord(record) {
  return (
    record?.isAnticipation === true ||
    record?.errorType === "anticipation" ||
    (
      isFiniteNumber(record?.reactionTime) &&
      record.reactionTime > 0 &&
      record.reactionTime < 150
    )
  );
}

function isCorrectRecord(record) {
  if (
    isTimeoutRecord(record) ||
    isAnticipationRecord(record)
  ) {
    return false;
  }

  return record?.isCorrect === true;
}

function isWrongRecord(record) {
  return (
    !isTimeoutRecord(record) &&
    !isAnticipationRecord(record) &&
    record?.isCorrect === false
  );
}

function isSameAnimalError(record) {
  if (
    isTimeoutRecord(record) ||
    isAnticipationRecord(record)
  ) {
    return false;
  }

  if (record?.errorType === "sameAnimalError") {
    return true;
  }

  const selectedTarget =
    record?.selectedTarget ||
    record?.selectedAnimal ||
    null;

  return Boolean(
    record?.soundType &&
      selectedTarget &&
      record.soundType === selectedTarget
  );
}

function isValidCorrectReactionTime(record) {
  return (
    isCorrectRecord(record) &&
    isFiniteNumber(record?.reactionTime) &&
    record.reactionTime >= 150
  );
}

function getCorrectReactionTimes(records) {
  return safeArray(records)
    .filter(isValidCorrectReactionTime)
    .map((record) => record.reactionTime);
}

function getCounterFromRecords(records, fieldName) {
  const values = safeArray(records)
    .map((record) => record?.[fieldName])
    .filter(
      (value) =>
        isFiniteNumber(value) && value >= 0
    );

  if (values.length === 0) {
    return 0;
  }

  /*
    頁面可能只在第一筆紀錄寫入全局點擊次數，
    也可能未來每筆都附帶相同數值，因此取最大值避免重複累加。
  */
  return Math.max(...values, 0);
}

function getExpectedTarget(soundType) {
  if (soundType === "cat") {
    return "dog";
  }

  if (soundType === "dog") {
    return "cat";
  }

  return null;
}

/* =========================================================
   各項能力分數
   ========================================================= */

function getAccuracyScore(accuracyPercent) {
  return (
    roundNumber(
      clamp(accuracyPercent, 0, 100) * 0.4,
      1
    ) ?? 0
  );
}

function getBaseSpeedAbility(
  representativeReactionTime,
  rule
) {
  if (!isFiniteNumber(representativeReactionTime)) {
    return 0;
  }

  if (
    representativeReactionTime <=
    rule.excellentRt
  ) {
    return 100;
  }

  if (
    representativeReactionTime <=
    rule.goodRt
  ) {
    const range =
      rule.goodRt - rule.excellentRt;

    const progress =
      (
        representativeReactionTime -
        rule.excellentRt
      ) / Math.max(range, 1);

    return 100 - progress * 15;
  }

  if (
    representativeReactionTime <=
    rule.acceptableRt
  ) {
    const range =
      rule.acceptableRt - rule.goodRt;

    const progress =
      (
        representativeReactionTime -
        rule.goodRt
      ) / Math.max(range, 1);

    return 85 - progress * 25;
  }

  if (
    representativeReactionTime <=
    rule.slowRt
  ) {
    const range =
      rule.slowRt - rule.acceptableRt;

    const progress =
      (
        representativeReactionTime -
        rule.acceptableRt
      ) / Math.max(range, 1);

    return 60 - progress * 30;
  }

  if (
    representativeReactionTime <=
    rule.answerTimeLimit
  ) {
    const range = Math.max(
      rule.answerTimeLimit - rule.slowRt,
      1
    );

    const progress =
      (
        representativeReactionTime -
        rule.slowRt
      ) / range;

    return 30 - progress * 20;
  }

  return 5;
}

function getSpeedAbility({
  representativeReactionTime,
  rule,
  validRtCount,
  totalTrials,
}) {
  if (
    !isFiniteNumber(representativeReactionTime) ||
    validRtCount <= 0 ||
    totalTrials <= 0
  ) {
    return 0;
  }

  const baseAbility = getBaseSpeedAbility(
    representativeReactionTime,
    rule
  );

  /*
    只有極少數題答對時，不應因少量快速反應取得完整速度分。
    達到全體題數 50% 的有效正確 RT 時，可信度為 1。
  */
  const requiredReliableRtCount = Math.max(
    3,
    Math.ceil(totalTrials * 0.5)
  );

  const reliability = clamp(
    validRtCount /
      Math.max(requiredReliableRtCount, 1),
    0,
    1
  );

  return clamp(
    baseAbility * (0.45 + reliability * 0.55),
    0,
    100
  );
}

function getSpeedScore(speedAbility) {
  return (
    roundNumber(
      clamp(speedAbility, 0, 100) * 0.2,
      1
    ) ?? 0
  );
}

function getInhibitionAbility({
  sameAnimalErrorRate,
  anticipationRate,
}) {
  /*
    同動物錯誤是相反規則抑制的主要指標。
    過早反應仍會影響抑制能力，但不再於額外行為扣分中重複重扣。
  */
  const penalty =
    sameAnimalErrorRate * 1.15 +
    anticipationRate * 0.45;

  return clamp(100 - penalty, 0, 100);
}

function getInhibitionScore(inhibitionAbility) {
  return (
    roundNumber(
      clamp(inhibitionAbility, 0, 100) * 0.15,
      1
    ) ?? 0
  );
}

function getTimeoutAbility(timeoutRate) {
  return clamp(
    100 - timeoutRate * 1.5,
    0,
    100
  );
}

function getTimeoutScore(timeoutAbility) {
  return (
    roundNumber(
      clamp(timeoutAbility, 0, 100) * 0.1,
      1
    ) ?? 0
  );
}

function getStabilityAbility(
  rtStd,
  rtCv,
  rule,
  validRtCount
) {
  if (validRtCount < 2) {
    return validRtCount === 1 ? 35 : 0;
  }

  let stdAbility;

  if (!isFiniteNumber(rtStd)) {
    stdAbility = 0;
  } else if (rtStd <= rule.stableStd) {
    stdAbility = 100;
  } else if (rtStd <= rule.acceptableStd) {
    const range =
      rule.acceptableStd - rule.stableStd;

    const progress =
      (rtStd - rule.stableStd) /
      Math.max(range, 1);

    stdAbility = 100 - progress * 30;
  } else if (rtStd <= rule.unstableStd) {
    const range =
      rule.unstableStd - rule.acceptableStd;

    const progress =
      (rtStd - rule.acceptableStd) /
      Math.max(range, 1);

    stdAbility = 70 - progress * 35;
  } else {
    stdAbility = 25;
  }

  let cvAbility = 55;

  if (isFiniteNumber(rtCv)) {
    if (rtCv <= 0.2) {
      cvAbility = 100;
    } else if (rtCv <= 0.3) {
      cvAbility = 85;
    } else if (rtCv <= 0.4) {
      cvAbility = 65;
    } else if (rtCv <= 0.55) {
      cvAbility = 40;
    } else {
      cvAbility = 20;
    }
  }

  return clamp(
    stdAbility * 0.65 +
      cvAbility * 0.35,
    0,
    100
  );
}

function getStabilityScore(stabilityAbility) {
  return (
    roundNumber(
      clamp(stabilityAbility, 0, 100) * 0.1,
      1
    ) ?? 0
  );
}

function getAttentionAbility({
  firstHalfAccuracy,
  secondHalfAccuracy,
  firstHalfRt,
  secondHalfRt,
  firstHalfCount,
  secondHalfCount,
  hasReliableHalfComparison,
}) {
  if (!hasReliableHalfComparison) {
    return 50;
  }

  if (
    !isFiniteNumber(firstHalfAccuracy) ||
    !isFiniteNumber(secondHalfAccuracy)
  ) {
    return 50;
  }

  const accuracyDrop = Math.max(
    firstHalfAccuracy -
      secondHalfAccuracy,
    0
  );

  const rtIncrease =
    isFiniteNumber(firstHalfRt) &&
    isFiniteNumber(secondHalfRt)
      ? Math.max(
          secondHalfRt - firstHalfRt,
          0
        )
      : 0;

  const accuracyPenalty =
    accuracyDrop * 1.4;

  const rtPenalty = Math.min(
    rtIncrease / 25,
    20
  );

  return clamp(
    100 -
      accuracyPenalty -
      rtPenalty,
    0,
    100
  );
}

function getAttentionScore(attentionAbility) {
  return (
    roundNumber(
      clamp(attentionAbility, 0, 100) * 0.05,
      1
    ) ?? 0
  );
}

/* =========================================================
   行為扣分與完成度
   ========================================================= */

function getBehaviorPenalty({
  randomClickCount,
  prematureClickCount,
  repeatedClickCount,
  totalTrials,
}) {
  if (totalTrials <= 0) {
    return 0;
  }

  const normalizedFactor = Math.min(
    1,
    12 / Math.max(totalTrials, 1)
  );

  /*
    過早反應已影響正確率與抑制控制，
    不再額外以 anticipationCount 重複扣分。
  */
  const rawPenalty =
    randomClickCount * 0.35 +
    prematureClickCount * 0.45 +
    repeatedClickCount * 0.25;

  return (
    roundNumber(
      clamp(
        rawPenalty * normalizedFactor,
        0,
        8
      ),
      1
    ) ?? 0
  );
}

function getCompletionRate(
  totalTrials,
  expectedTrials
) {
  if (expectedTrials <= 0) {
    return totalTrials > 0 ? 100 : 0;
  }

  return percentage(
    Math.min(
      totalTrials,
      expectedTrials
    ),
    expectedTrials
  );
}

function applyDataReliabilityAdjustment({
  score,
  totalTrials,
  expectedTrials,
}) {
  if (totalTrials <= 0) {
    return 0;
  }

  const minimumReliableTrials = Math.max(
    4,
    Math.ceil(expectedTrials * 0.5)
  );

  if (totalTrials >= minimumReliableTrials) {
    return score;
  }

  const reliability = clamp(
    totalTrials /
      minimumReliableTrials,
    0,
    1
  );

  return score * (
    0.55 +
    reliability * 0.45
  );
}

/* =========================================================
   星級
   ========================================================= */

function getStarRating({
  mode,
  totalScore,
  accuracyPercent,
  timeoutRate,
  totalTrials,
}) {
  if (totalTrials <= 0) {
    return 0;
  }

  if (mode === "training") {
    if (
      totalScore >= 78 &&
      accuracyPercent >= 75 &&
      timeoutRate <= 25
    ) {
      return 3;
    }

    if (
      totalScore >= 55 &&
      accuracyPercent >= 50 &&
      timeoutRate <= 50
    ) {
      return 2;
    }

    return 1;
  }

  if (
    totalScore >= 82 &&
    accuracyPercent >= 80 &&
    timeoutRate <= 20
  ) {
    return 3;
  }

  if (
    totalScore >= 60 &&
    accuracyPercent >= 55 &&
    timeoutRate <= 45
  ) {
    return 2;
  }

  return 1;
}

/* =========================================================
   等級文字
   ========================================================= */

function getAccuracyLevel(accuracyPercent) {
  if (accuracyPercent >= 85) {
    return "表現良好";
  }

  if (accuracyPercent >= 65) {
    return "持續發展中";
  }

  return "需要加強";
}

function getSpeedLevel(
  representativeReactionTime,
  rule,
  validRtCount
) {
  if (
    !isFiniteNumber(
      representativeReactionTime
    ) ||
    validRtCount <= 0
  ) {
    return "資料不足";
  }

  if (
    representativeReactionTime <=
    rule.excellentRt
  ) {
    return "反應快速";
  }

  if (
    representativeReactionTime <=
    rule.goodRt
  ) {
    return "反應穩定";
  }

  if (
    representativeReactionTime <=
    rule.acceptableRt
  ) {
    return "需要較多判斷時間";
  }

  return "反應偏慢";
}

function getInhibitionLevel(
  inhibitionAbility
) {
  if (inhibitionAbility >= 85) {
    return "規則抑制良好";
  }

  if (inhibitionAbility >= 65) {
    return "偶爾受直覺反應影響";
  }

  return "較容易依聲音直覺作答";
}

function getStabilityLevel(
  stabilityAbility,
  validRtCount
) {
  if (validRtCount < 2) {
    return "資料不足";
  }

  if (stabilityAbility >= 80) {
    return "反應穩定";
  }

  if (stabilityAbility >= 55) {
    return "略有波動";
  }

  return "反應較不穩定";
}

function getAttentionLevel(
  attentionAbility,
  hasReliableHalfComparison
) {
  if (!hasReliableHalfComparison) {
    return "資料不足";
  }

  if (attentionAbility >= 80) {
    return "注意力維持良好";
  }

  if (attentionAbility >= 55) {
    return "後段略有波動";
  }

  return "後段表現下降";
}

/* =========================================================
   兒童文字
   ========================================================= */

function getChildMessage(stars) {
  if (stars === 0) {
    return "這次資料還不夠，再完成一次就能看到結果！";
  }

  if (stars === 3) {
    return "太棒了！你有仔細聽聲音，也成功選出相反的動物！";
  }

  if (stars === 2) {
    return "做得很好！再多聽一下，就能更快找到相反的動物！";
  }

  return "沒關係！記得貓叫選狗、狗叫選貓，再試一次就會更進步！";
}

function getChildShortLabel(stars) {
  if (stars === 0) {
    return "資料不足";
  }

  if (stars === 3) {
    return "表現很棒";
  }

  if (stars === 2) {
    return "表現不錯";
  }

  return "繼續加油";
}

/* =========================================================
   家長摘要
   ========================================================= */

function buildParentSummary({
  totalTrials,
  accuracyPercent,
  representativeReactionTime,
  speedLevel,
  sameAnimalErrorRate,
  anticipationRate,
  timeoutRate,
  stabilityAbility,
  validRtCount,
  attentionDrop,
  hasReliableHalfComparison,
  catSoundAccuracy,
  dogSoundAccuracy,
  hasReliableSoundComparison,
}) {
  if (totalTrials <= 0) {
    return "目前沒有足夠的作答資料，完成任務後才能進行表現解讀。";
  }

  const parts = [];

  if (accuracyPercent >= 85) {
    parts.push(
      "孩子大多能記住「聽到哪一種聲音，就選擇相反動物」的規則。"
    );
  } else if (accuracyPercent >= 65) {
    parts.push(
      "孩子能完成多數題目，但偶爾會直接選擇發出聲音的動物。"
    );
  } else {
    parts.push(
      "孩子目前仍需要更多時間理解並穩定使用相反選擇規則。"
    );
  }

  if (
    isFiniteNumber(
      representativeReactionTime
    )
  ) {
    if (
      speedLevel === "反應快速" ||
      speedLevel === "反應穩定"
    ) {
      parts.push(
        "完成正確選擇時，整體反應速度穩定。"
      );
    } else {
      parts.push(
        "孩子通常需要較多時間先辨認聲音，再轉換成相反的選擇。"
      );
    }
  } else {
    parts.push(
      "目前正確反應時間資料不足，暫不解讀反應速度。"
    );
  }

  if (sameAnimalErrorRate >= 30) {
    parts.push(
      "同動物錯誤較多，表示孩子較容易依照聽到的聲音直接作答。"
    );
  } else if (sameAnimalErrorRate >= 15) {
    parts.push(
      "孩子偶爾會依照聲音直覺選擇原本的動物。"
    );
  } else {
    parts.push(
      "孩子較能抑制直接選擇聲音來源動物的直覺反應。"
    );
  }

  if (anticipationRate >= 20) {
    parts.push(
      "部分反應速度過快，可能尚未完成聲音判斷便先作答。"
    );
  }

  if (timeoutRate >= 30) {
    parts.push(
      "逾時比例偏高，下一次可使用較簡單難度或保留更明顯的提示。"
    );
  }

  if (validRtCount >= 2) {
    if (stabilityAbility >= 80) {
      parts.push(
        "每題的反應節奏大致穩定。"
      );
    } else if (stabilityAbility < 55) {
      parts.push(
        "不同題目間的反應時間差異較大，可繼續觀察注意力穩定程度。"
      );
    }
  }

  if (
    hasReliableHalfComparison &&
    isFiniteNumber(attentionDrop) &&
    attentionDrop >= 25
  ) {
    parts.push(
      "後半段正確率下降較明顯，可能出現疲勞或注意力維持困難。"
    );
  }

  if (
    hasReliableSoundComparison &&
    Math.abs(
      catSoundAccuracy -
      dogSoundAccuracy
    ) >= 30
  ) {
    const weakerSound =
      catSoundAccuracy <
      dogSoundAccuracy
        ? "貓叫"
        : "狗叫";

    parts.push(
      `孩子在「${weakerSound}」題型的表現較弱，可針對該聲音規則增加練習。`
    );
  }

  return parts.join("");
}

/* =========================================================
   醫療端旗標
   ========================================================= */

function buildClinicalFlags({
  totalTrials,
  accuracyPercent,
  representativeReactionTime,
  rule,
  sameAnimalErrorRate,
  anticipationRate,
  timeoutRate,
  rtStd,
  rtCv,
  attentionDrop,
  hasReliableHalfComparison,
  catSoundAccuracy,
  dogSoundAccuracy,
  hasReliableSoundComparison,
  leftAccuracy,
  rightAccuracy,
  hasReliableSideComparison,
  randomClickCount,
  prematureClickCount,
  repeatedClickCount,
}) {
  const flags = [];

  if (totalTrials <= 0) {
    return [
      {
        type: "no_data",
        level: "warning",
        message:
          "目前沒有可供解讀的 SSG 作答紀錄。",
      },
    ];
  }

  if (accuracyPercent < 60) {
    flags.push({
      type: "accuracy_low",
      level: "warning",
      message:
        "相反規則正確率偏低，建議確認是否理解「貓叫選狗、狗叫選貓」的任務規則。",
    });
  }

  if (
    isFiniteNumber(
      representativeReactionTime
    ) &&
    representativeReactionTime >
      rule.acceptableRt
  ) {
    flags.push({
      type: "reaction_slow",
      level: "notice",
      message:
        "代表性正確反應時間偏慢，可能表示聲音辨識、規則轉換或反應啟動需要較多時間。",
    });
  }

  if (sameAnimalErrorRate >= 25) {
    flags.push({
      type: "same_animal_error_high",
      level: "warning",
      message:
        "同動物錯誤比例偏高，可能較難抑制依照聲音來源直接作答的優勢反應。",
    });
  }

  if (anticipationRate >= 20) {
    flags.push({
      type: "anticipation_high",
      level: "notice",
      message:
        "過早反應比例偏高，可能存在猜測、衝動點擊或尚未完成規則判斷即作答的情形。",
    });
  }

  if (timeoutRate >= 25) {
    flags.push({
      type: "timeout_high",
      level: "warning",
      message:
        "逾時比例偏高，建議確認聲音播放、任務理解及目前反應時間限制是否合適。",
    });
  }

  if (
    isFiniteNumber(rtStd) &&
    rtStd > rule.unstableStd
  ) {
    flags.push({
      type: "rt_variability_high",
      level: "notice",
      message:
        "正確反應時間變異偏大，可能表示注意力或作答策略不穩定。",
    });
  }

  if (
    isFiniteNumber(rtCv) &&
    rtCv > 0.45
  ) {
    flags.push({
      type: "rt_cv_high",
      level: "notice",
      message:
        "反應時間變異係數偏高，代表不同題目間的反應節奏差異較大。",
    });
  }

  if (
    hasReliableHalfComparison &&
    isFiniteNumber(attentionDrop) &&
    attentionDrop >= 25
  ) {
    flags.push({
      type: "attention_drop",
      level: "notice",
      message:
        "後半段正確率明顯低於前半段，建議觀察注意力維持或疲勞情形。",
    });
  }

  if (
    hasReliableSoundComparison &&
    Math.abs(
      catSoundAccuracy -
      dogSoundAccuracy
    ) >= 30
  ) {
    flags.push({
      type: "sound_rule_asymmetry",
      level: "notice",
      message:
        "貓聲題與狗聲題的正確率差距較大，可能對其中一種聲音或規則方向較不熟悉。",
    });
  }

  if (
    hasReliableSideComparison &&
    Math.abs(
      leftAccuracy -
      rightAccuracy
    ) >= 30
  ) {
    flags.push({
      type: "side_bias",
      level: "notice",
      message:
        "左右側正確率差異較大，建議觀察側向偏好、視覺搜尋或操作習慣。",
    });
  }

  if (randomClickCount >= 3) {
    flags.push({
      type: "random_click_high",
      level: "notice",
      message:
        "非作答區點擊次數較多，可能有畫面探索、操作理解或衝動點擊情形。",
    });
  }

  if (prematureClickCount >= 3) {
    flags.push({
      type: "premature_click_high",
      level: "notice",
      message:
        "聲音或作答階段開始前的點擊次數較多，建議觀察等待能力與任務節奏理解。",
    });
  }

  if (repeatedClickCount >= 4) {
    flags.push({
      type: "repeated_click_high",
      level: "notice",
      message:
        "短時間重複點擊次數較多，可能與衝動反應或操作回饋不明確有關。",
    });
  }

  if (flags.length === 0) {
    flags.push({
      type: "normal",
      level: "normal",
      message:
        "目前未發現明顯異常旗標，可搭配其他注意力與抑制控制任務綜合解讀。",
    });
  }

  return flags;
}

/* =========================================================
   正式評分函式
   ========================================================= */

export function calculateSsgScore(
  inputRecords = [],
  options = {}
) {
  const records = safeArray(
    inputRecords
  ).filter(
    (record) =>
      record &&
      typeof record === "object"
  );

  const mode = resolveMode(
    records,
    options
  );

  const difficulty =
    resolveDifficulty(
      records,
      options
    );

  const difficultyLabel =
    getDifficultyLabel(
      difficulty
    );

  const rule =
    DIFFICULTY_RULES[
      difficulty
    ] ||
    DIFFICULTY_RULES.normal;

  const expectedTrials = Math.max(
    1,
    toFiniteNumber(
      options?.plannedTotalRounds ??
        options?.expectedTrials ??
        rule.expectedTrials,
      rule.expectedTrials
    )
  );

  /* -------------------------
     基本題數
     ------------------------- */

  const totalTrials =
    records.length;

  const correctRecords =
    records.filter(
      isCorrectRecord
    );

  const wrongRecords =
    records.filter(
      isWrongRecord
    );

  const timeoutRecords =
    records.filter(
      isTimeoutRecord
    );

  const anticipationRecords =
    records.filter(
      isAnticipationRecord
    );

  const sameAnimalErrorRecords =
    records.filter(
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
    getCompletionRate(
      totalTrials,
      expectedTrials
    );

  /* -------------------------
     反應時間
     ------------------------- */

  const correctReactionTimes =
    getCorrectReactionTimes(
      records
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

  /*
    中位數佔 70%，平均數佔 30%，
    降低單一極端慢反應對速度評分的影響。
  */
  const representativeReactionTime =
    isFiniteNumber(
      medianReactionTime
    ) &&
    isFiniteNumber(
      avgReactionTime
    )
      ? roundNumber(
          medianReactionTime * 0.7 +
            avgReactionTime * 0.3,
          0
        )
      : (
          medianReactionTime ??
          avgReactionTime
        );

  const rtStd =
    roundNumber(
      populationStandardDeviation(
        correctReactionTimes
      ),
      0
    );

  const sampleRtStd =
    roundNumber(
      sampleStandardDeviation(
        correctReactionTimes
      ),
      0
    );

  const rtCv =
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
    records.filter(
      (record) =>
        record?.soundType ===
        "cat"
    );

  const dogSoundRecords =
    records.filter(
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

  /* -------------------------
     目標動物
     ------------------------- */

  const expectedDogRecords =
    records.filter(
      (record) =>
        record?.expectedTarget ===
          "dog" ||
        getExpectedTarget(
          record?.soundType
        ) === "dog"
    );

  const expectedCatRecords =
    records.filter(
      (record) =>
        record?.expectedTarget ===
          "cat" ||
        getExpectedTarget(
          record?.soundType
        ) === "cat"
    );

  const dogTargetAccuracy =
    percentage(
      expectedDogRecords.filter(
        isCorrectRecord
      ).length,
      expectedDogRecords.length
    );

  const catTargetAccuracy =
    percentage(
      expectedCatRecords.filter(
        isCorrectRecord
      ).length,
      expectedCatRecords.length
    );

  /* -------------------------
     左右側
     ------------------------- */

  const leftRecords =
    records.filter(
      (record) =>
        record?.correctPosition ===
          "left" ||
        record?.correctSide ===
          "left" ||
        record?.targetSide ===
          "left"
    );

  const rightRecords =
    records.filter(
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
    records.slice(
      0,
      splitIndex
    );

  const secondHalfRecords =
    records.slice(
      splitIndex
    );

  const firstHalfCorrectCount =
    firstHalfRecords.filter(
      isCorrectRecord
    ).length;

  const secondHalfCorrectCount =
    secondHalfRecords.filter(
      isCorrectRecord
    ).length;

  const firstHalfAccuracy =
    percentage(
      firstHalfCorrectCount,
      firstHalfRecords.length
    );

  const secondHalfAccuracy =
    percentage(
      secondHalfCorrectCount,
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
     非作答行為
     ------------------------- */

  const randomClickCount =
    getCounterFromRecords(
      records,
      "randomClickCount"
    );

  const prematureClickCount =
    getCounterFromRecords(
      records,
      "prematureClickCount"
    );

  const repeatedClickCount =
    getCounterFromRecords(
      records,
      "repeatedClickCount"
    );

  /* -------------------------
     能力分數
     ------------------------- */

  const speedAbility =
    getSpeedAbility({
      representativeReactionTime,
      rule,
      validRtCount,
      totalTrials,
    });

  const inhibitionAbility =
    getInhibitionAbility({
      sameAnimalErrorRate,
      anticipationRate,
    });

  const timeoutAbility =
    getTimeoutAbility(
      timeoutRate
    );

  const stabilityAbility =
    getStabilityAbility(
      rtStd,
      rtCv,
      rule,
      validRtCount
    );

  const attentionAbility =
    getAttentionAbility({
      firstHalfAccuracy,
      secondHalfAccuracy,
      firstHalfRt,
      secondHalfRt,
      firstHalfCount:
        firstHalfRecords.length,
      secondHalfCount:
        secondHalfRecords.length,
      hasReliableHalfComparison,
    });

  /* -------------------------
     分數組成
     ------------------------- */

  const accuracyScore =
    getAccuracyScore(
      accuracyPercent
    );

  const speedScore =
    getSpeedScore(
      speedAbility
    );

  const inhibitionScore =
    getInhibitionScore(
      inhibitionAbility
    );

  const timeoutScore =
    getTimeoutScore(
      timeoutAbility
    );

  const stabilityScore =
    getStabilityScore(
      stabilityAbility
    );

  const attentionScore =
    getAttentionScore(
      attentionAbility
    );

  const behaviorPenalty =
    getBehaviorPenalty({
      randomClickCount,
      prematureClickCount,
      repeatedClickCount,
      totalTrials,
    });

  const rawTotalScore =
    accuracyScore +
    speedScore +
    inhibitionScore +
    timeoutScore +
    stabilityScore +
    attentionScore;

  const scoreAfterPenalty =
    Math.max(
      0,
      rawTotalScore -
        behaviorPenalty
    );

  const reliabilityAdjustedScore =
    applyDataReliabilityAdjustment({
      score:
        scoreAfterPenalty,
      totalTrials,
      expectedTrials,
    });

  const totalScore =
    clamp(
      roundNumber(
        reliabilityAdjustedScore,
        0
      ) ?? 0,
      0,
      100
    );

  const stars =
    getStarRating({
      mode,
      totalScore,
      accuracyPercent,
      timeoutRate,
      totalTrials,
    });

  const performanceLevel =
    stars === 0
      ? "insufficient_data"
      : stars === 3
        ? "good"
        : stars === 2
          ? "developing"
          : "needs_support";

  /* -------------------------
     家長端能力值
     ------------------------- */

  const abilityScores = {
    ruleAccuracy:
      clamp(
        accuracyPercent,
        0,
        100
      ),

    reactionSpeed:
      clamp(
        roundNumber(
          speedAbility,
          0
        ) ?? 0,
        0,
        100
      ),

    inhibitoryControl:
      clamp(
        roundNumber(
          inhibitionAbility,
          0
        ) ?? 0,
        0,
        100
      ),

    responseControl:
      clamp(
        roundNumber(
          100 -
            anticipationRate *
              1.25 -
            Math.min(
              prematureClickCount *
                5,
              25
            ) -
            Math.min(
              repeatedClickCount *
                2,
              15
            ),
          0
        ) ?? 0,
        0,
        100
      ),

    attentionStability:
      clamp(
        roundNumber(
          stabilityAbility *
            0.65 +
            attentionAbility *
              0.35,
          0
        ) ?? 0,
        0,
        100
      ),

    targetFinding:
      clamp(
        accuracyPercent,
        0,
        100
      ),

    inhibitoryControlLegacy:
      clamp(
        roundNumber(
          inhibitionAbility,
          0
        ) ?? 0,
        0,
        100
      ),

    antiInterference:
      clamp(
        roundNumber(
          inhibitionAbility,
          0
        ) ?? 0,
        0,
        100
      ),
  };

  const speedLevel =
    getSpeedLevel(
      representativeReactionTime,
      rule,
      validRtCount
    );

  const parentSummary =
    buildParentSummary({
      totalTrials,
      accuracyPercent,
      representativeReactionTime,
      speedLevel,
      sameAnimalErrorRate,
      anticipationRate,
      timeoutRate,
      stabilityAbility,
      validRtCount,
      attentionDrop,
      hasReliableHalfComparison,
      catSoundAccuracy,
      dogSoundAccuracy,
      hasReliableSoundComparison,
    });

  const clinicalFlags =
    buildClinicalFlags({
      totalTrials,
      accuracyPercent,
      representativeReactionTime,
      rule,
      sameAnimalErrorRate,
      anticipationRate,
      timeoutRate,
      rtStd,
      rtCv,
      attentionDrop,
      hasReliableHalfComparison,
      catSoundAccuracy,
      dogSoundAccuracy,
      hasReliableSoundComparison,
      leftAccuracy,
      rightAccuracy,
      hasReliableSideComparison,
      randomClickCount,
      prematureClickCount,
      repeatedClickCount,
    });

  /* =======================================================
     正式輸出
     ======================================================= */

  return {
    taskName:
      "聽聲音選相反動物",

    taskCode: "SSG",

    taskVersion:
      "audio-visual-opposite-v2",

    taskRule:
      "catSoundSelectDog_dogSoundSelectCat",

    abilityType:
      "attention_control",

    scoringVersion:
      "2.0.0",

    mode,
    difficulty,
    difficultyKey:
      difficulty,
    difficultyLabel,

    totalScore,
    score:
      totalScore,
    stars,
    performanceLevel,

    summary: {
      totalTrials,
      expectedTrials,
      completionRate,

      correctCount,
      wrongCount,
      incorrectCount,
      nonCorrectCount,
      timeoutCount,
      anticipationCount,
      sameAnimalErrorCount,

      accountedTrialCount,

      accuracyRate,
      accuracyPercent,
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
      fastestReactionTime,
      slowestReactionTime,
      rtStd,
      sampleRtStd,
      rtCv,

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

      expectedDogTotal:
        expectedDogRecords.length,

      expectedCatTotal:
        expectedCatRecords.length,

      dogTargetAccuracy,
      catTargetAccuracy,

      leftTotal:
        leftRecords.length,

      rightTotal:
        rightRecords.length,

      leftCorrectCount,
      rightCorrectCount,
      leftAccuracy,
      rightAccuracy,

      sideAccuracyDifference,
      hasReliableSideComparison,

      firstHalfTotal:
        firstHalfRecords.length,

      secondHalfTotal:
        secondHalfRecords.length,

      firstHalfCorrectCount,
      secondHalfCorrectCount,

      firstHalfAccuracy,
      secondHalfAccuracy,

      firstHalfRt,
      secondHalfRt,

      accuracyChange,
      attentionDrop,
      reactionTimeIncrease,

      hasReliableHalfComparison,

      randomClickCount,
      prematureClickCount,
      repeatedClickCount,
    },

    scoreBreakdown: {
      accuracyScore,
      speedScore,
      inhibitionScore,
      timeoutScore,
      stabilityScore,
      attentionScore,

      behaviorPenalty,

      rawTotalScore:
        roundNumber(
          rawTotalScore,
          1
        ) ?? 0,

      scoreAfterPenalty:
        roundNumber(
          scoreAfterPenalty,
          1
        ) ?? 0,

      reliabilityAdjustedScore:
        roundNumber(
          reliabilityAdjustedScore,
          1
        ) ?? 0,

      maximumScores: {
        accuracy: 40,
        speed: 20,
        inhibition: 15,
        timeout: 10,
        stability: 10,
        attention: 5,
      },
    },

    childView: {
      stars,
      score:
        totalScore,

      message:
        getChildMessage(
          stars
        ),

      shortLabel:
        getChildShortLabel(
          stars
        ),

      reminder:
        "記得：聽到貓叫要選狗，聽到狗叫要選貓。",
    },

    parentView: {
      abilityScores,

      indicators: [
        {
          key:
            "ruleAccuracy",

          label:
            "相反規則正確度",

          value:
            abilityScores.ruleAccuracy,

          level:
            totalTrials > 0
              ? getAccuracyLevel(
                  accuracyPercent
                )
              : "資料不足",

          description:
            "觀察孩子是否能記住聲音與動物之間的相反選擇規則。",
        },

        {
          key:
            "reactionSpeed",

          label:
            "反應速度",

          value:
            abilityScores.reactionSpeed,

          level:
            speedLevel,

          description:
            "觀察孩子辨認聲音並轉換成正確選擇所需的時間。",
        },

        {
          key:
            "inhibitoryControl",

          label:
            "抑制直覺反應",

          value:
            abilityScores.inhibitoryControl,

          level:
            totalTrials > 0
              ? getInhibitionLevel(
                  inhibitionAbility
                )
              : "資料不足",

          description:
            "觀察孩子是否能避免直接選擇發出聲音的動物，改選相反動物。",
        },

        {
          key:
            "responseControl",

          label:
            "作答控制",

          value:
            abilityScores.responseControl,

          level:
            totalTrials <= 0
              ? "資料不足"
              : abilityScores.responseControl >= 80
                ? "作答控制良好"
                : abilityScores.responseControl >= 55
                  ? "偶爾過早作答"
                  : "較常出現衝動反應",

          description:
            "觀察孩子是否能先聽完整聲音並完成判斷後再作答。",
        },

        {
          key:
            "attentionStability",

          label:
            "注意力穩定度",

          value:
            abilityScores.attentionStability,

          level:
            getAttentionLevel(
              attentionAbility,
              hasReliableHalfComparison
            ) === "資料不足"
              ? getStabilityLevel(
                  stabilityAbility,
                  validRtCount
                )
              : (
                  isFiniteNumber(
                    attentionDrop
                  ) &&
                  attentionDrop >= 25
                    ? getAttentionLevel(
                        attentionAbility,
                        hasReliableHalfComparison
                      )
                    : getStabilityLevel(
                        stabilityAbility,
                        validRtCount
                      )
                ),

          description:
            "觀察孩子每題反應是否穩定，以及後半段能否維持表現。",
        },
      ],

      plainLanguageSummary:
        parentSummary,

      summary:
        parentSummary,
    },

    clinicalView: {
      scoringVersion:
        "2.0.0",

      mode,
      difficulty,
      difficultyLabel,

      totalTrials,
      expectedTrials,
      completionRate,

      correctCount,
      wrongCount,
      incorrectCount,
      nonCorrectCount,
      timeoutCount,
      anticipationCount,
      sameAnimalErrorCount,

      accuracyPercent,
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
      fastestReactionTime,
      slowestReactionTime,
      rtStd,
      sampleRtStd,
      rtCv,

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

      dogTargetAccuracy,
      catTargetAccuracy,

      leftAccuracy,
      rightAccuracy,
      sideAccuracyDifference,
      hasReliableSideComparison,

      firstHalfAccuracy,
      secondHalfAccuracy,
      firstHalfRt,
      secondHalfRt,

      accuracyChange,
      attentionDrop,
      reactionTimeIncrease,
      hasReliableHalfComparison,

      speedAbility:
        roundNumber(
          speedAbility,
          0
        ) ?? 0,

      inhibitionAbility:
        roundNumber(
          inhibitionAbility,
          0
        ) ?? 0,

      timeoutAbility:
        roundNumber(
          timeoutAbility,
          0
        ) ?? 0,

      stabilityAbility:
        roundNumber(
          stabilityAbility,
          0
        ) ?? 0,

      attentionAbility:
        roundNumber(
          attentionAbility,
          0
        ) ?? 0,

      randomClickCount,
      prematureClickCount,
      repeatedClickCount,

      interpretationFlags:
        clinicalFlags,

      records,
    },

    legacyCompatibility: {
      deprecated: true,

      deprecatedSince:
        "audio-visual-opposite-v2",

      congruentAccuracy:
        null,

      incongruentAccuracy:
        accuracyPercent,

      interferenceEffect:
        null,

      distractorErrorRate:
        sameAnimalErrorRate,

      hasCongruentTrials:
        false,

      hasIncongruentTrials:
        totalTrials > 0,

      hasDistractorTrials:
        totalTrials > 0,
    },

    records,

    generatedAt:
      new Date().toISOString(),
  };
}

/* =========================================================
   localStorage 讀取
   ========================================================= */

function safeJsonParse(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(
      rawValue
    );
  } catch {
    return null;
  }
}

function getResultTimestamp(result) {
  const rawTimestamp =
    result?.finishedAt ||
    result?.generatedAt ||
    result?.scoring?.generatedAt ||
    null;

  if (!rawTimestamp) {
    return 0;
  }

  const timestamp =
    new Date(
      rawTimestamp
    ).getTime();

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : 0;
}

function scoreStoredResult(parsed) {
  if (!parsed) {
    return null;
  }

  if (Array.isArray(parsed)) {
    const scoring =
      calculateSsgScore(
        parsed
      );

    return {
      taskCode: "SSG",
      mode:
        scoring.mode,
      difficulty:
        scoring.difficulty,
      records:
        parsed,
      scoring,
      totalScore:
        scoring.totalScore,
      score:
        scoring.totalScore,
      stars:
        scoring.stars,
      generatedAt:
        scoring.generatedAt,
    };
  }

  if (
    parsed?.scoring &&
    typeof parsed.scoring ===
      "object"
  ) {
    return parsed;
  }

  if (
    Array.isArray(
      parsed?.records
    )
  ) {
    const scoring =
      calculateSsgScore(
        parsed.records,
        {
          mode:
            parsed.mode,

          difficulty:
            parsed.difficulty ||
            parsed.difficultyKey,

          plannedTotalRounds:
            parsed.expectedTrials ||
            parsed.totalTrials,
        }
      );

    return {
      ...parsed,

      scoring,

      totalScore:
        parsed.totalScore ??
        scoring.totalScore,

      score:
        parsed.score ??
        scoring.totalScore,

      stars:
        parsed.stars ??
        scoring.stars,

      performanceLevel:
        parsed.performanceLevel ??
        scoring.performanceLevel,

      generatedAt:
        parsed.generatedAt ||
        scoring.generatedAt,
    };
  }

  return null;
}

export function getStoredSsgResult(
  preferredMode = null
) {
  if (
    typeof localStorage ===
    "undefined"
  ) {
    return null;
  }

  try {
    const latestResult =
      scoreStoredResult(
        safeJsonParse(
          localStorage.getItem(
            "latestSsgResult"
          )
        )
      );

    const testResult =
      scoreStoredResult(
        safeJsonParse(
          localStorage.getItem(
            "ssgTestResult"
          )
        )
      );

    const trainingResult =
      scoreStoredResult(
        safeJsonParse(
          localStorage.getItem(
            "ssgTrainingResult"
          )
        )
      );

    if (
      preferredMode ===
      "test"
    ) {
      return (
        [
          latestResult,
          testResult,
        ]
          .filter(
            (result) =>
              result &&
              result.mode ===
                "test"
          )
          .sort(
            (a, b) =>
              getResultTimestamp(b) -
              getResultTimestamp(a)
          )[0] ||
        testResult ||
        null
      );
    }

    if (
      preferredMode ===
      "training"
    ) {
      return (
        [
          latestResult,
          trainingResult,
        ]
          .filter(
            (result) =>
              result &&
              result.mode ===
                "training"
          )
          .sort(
            (a, b) =>
              getResultTimestamp(b) -
              getResultTimestamp(a)
          )[0] ||
        trainingResult ||
        null
      );
    }

    const candidates = [
      latestResult,
      testResult,
      trainingResult,
    ].filter(Boolean);

    if (
      candidates.length === 0
    ) {
      return null;
    }

    return candidates.sort(
      (a, b) =>
        getResultTimestamp(b) -
        getResultTimestamp(a)
    )[0];
  } catch (error) {
    console.error(
      "讀取 SSG 結果失敗：",
      error
    );

    return null;
  }
}

export default calculateSsgScore;