// src/utils/dptScoring.js

/*
  =========================================================
  dptScoring.js
  Dot Probe Task / DPT 評分邏輯

  任務設定：
  幼兒需要看清楚蒼蠅停在哪一邊，並點擊正確位置。

  核心指標：
  1. Accuracy 正確率
  2. Average RT 平均反應時間
  3. Interference Effect 干擾影響
     = avgIncongruentRt - avgCongruentRt
  4. RT Stability 反應穩定度
     = 正確題 RT 的標準差
  5. RT CV 反應時間變異係數
     = 標準差 / 平均 RT

  本版強化：
  - 全錯 / 全逾時 / 無有效 RT 時，不產生 NaN
  - 干擾影響值必須 congruent 與 incongruent 兩側正確有效 RT 皆 >= 2 才計算
  - 誤觸與逾時倒扣後，總分仍會被限制在 0～100
  - 所有圖表用能力分數都會被 clamp，避免 width: NaN%
  =========================================================
*/

/* =========================
   基本工具
   ========================= */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value, min = 0, max = 100) {
  if (!isFiniteNumber(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundNumber(value, digits = 0) {
  if (!isFiniteNumber(value)) return null;

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(numbers) {
  const validNumbers = safeArray(numbers).filter(isFiniteNumber);

  if (validNumbers.length === 0) return null;

  const sum = validNumbers.reduce((acc, n) => acc + n, 0);
  return sum / validNumbers.length;
}

function standardDeviation(numbers) {
  const validNumbers = safeArray(numbers).filter(isFiniteNumber);

  if (validNumbers.length < 2) return null;

  const mean = average(validNumbers);
  if (!isFiniteNumber(mean)) return null;

  const variance =
    validNumbers.reduce((acc, n) => acc + (n - mean) ** 2, 0) /
    validNumbers.length;

  return Math.sqrt(variance);
}

function coefficientOfVariation(numbers) {
  const validNumbers = safeArray(numbers).filter(isFiniteNumber);

  /*
    CV = SD / Mean

    防禦重點：
    1. 少於 2 筆有效 RT，沒有穩定度意義
    2. 平均 RT 為 0 或非法時，不能除
    3. 全錯 / 全逾時時，validNumbers.length 會是 0，直接回傳 null
  */
  if (validNumbers.length < 2) return null;

  const mean = average(validNumbers);
  const sd = standardDeviation(validNumbers);

  if (!isFiniteNumber(mean) || mean <= 0) return null;
  if (!isFiniteNumber(sd)) return null;

  return sd / mean;
}

function percentage(part, total) {
  if (!isFiniteNumber(part) || !isFiniteNumber(total) || total <= 0) return 0;
  return roundNumber((part / total) * 100, 0) ?? 0;
}

/* =========================
   分數轉換
   ========================= */

function getAccuracyScore(accuracyRate) {
  /*
    accuracyRate 使用 0～1
    正確率最高佔 40 分
  */
  if (!isFiniteNumber(accuracyRate)) return 0;
  return roundNumber(clamp(accuracyRate, 0, 1) * 40, 0) ?? 0;
}

function getSpeedScore(avgReactionTime) {
  /*
    平均反應時間最高佔 25 分
    只計算答對題的 RT
  */
  if (!isFiniteNumber(avgReactionTime)) return 0;

  if (avgReactionTime <= 800) return 25;
  if (avgReactionTime <= 1200) return 20;
  if (avgReactionTime <= 1600) return 15;
  if (avgReactionTime <= 2200) return 10;
  return 5;
}

function getInterferenceScore(interferenceEffect) {
  /*
    抗干擾能力最高佔 25 分

    interferenceEffect =
      avgIncongruentRt - avgCongruentRt

    本版重點：
    - 若資料不足，interferenceEffect 會是 null
    - 不把單題猜對造成的負值誤判為高抗干擾能力
    - 資料不足時給中低保底分 10，不高估能力
  */
  if (!isFiniteNumber(interferenceEffect)) {
    return 10;
  }

  /*
    理論上若兩側樣本充足，負值可代表不一致題沒有更慢。
    但仍以 <=150 歸為干擾影響小，不額外加分超過滿分。
  */
  if (interferenceEffect <= 150) return 25;
  if (interferenceEffect <= 300) return 20;
  if (interferenceEffect <= 500) return 15;
  if (interferenceEffect <= 800) return 10;
  return 5;
}

function getStabilityScore(rtStd) {
  /*
    反應穩定度最高佔 10 分
    使用答對題 reactionTime 的標準差
  */
  if (!isFiniteNumber(rtStd)) return 0;

  if (rtStd <= 250) return 10;
  if (rtStd <= 400) return 8;
  if (rtStd <= 600) return 6;
  if (rtStd <= 900) return 4;
  return 2;
}

function getErrorPenalty({ wrongCount, timeoutCount, totalTrials }) {
  /*
    誤觸 / 逾時倒扣

    設計：
    - wrong：每題扣 1 分
    - timeout：每題扣 1.5 分
    - 最多扣 15 分，避免低齡幼兒因單次狀態差被極端懲罰
    - 最終仍會在 totalScore 使用 Math.max(0, ...) 截斷
  */
  if (!isFiniteNumber(totalTrials) || totalTrials <= 0) return 0;

  const rawPenalty = wrongCount * 1 + timeoutCount * 1.5;
  return clamp(roundNumber(rawPenalty, 0) ?? 0, 0, 15);
}

/* =========================
   星級與文字
   ========================= */

function getStarRating(totalScore) {
  const safeScore = clamp(totalScore, 0, 100);

  if (safeScore >= 80) return 3;
  if (safeScore >= 60) return 2;
  return 1;
}

function getChildMessage(stars) {
  if (stars === 3) {
    return "太棒了！你很快就找到蒼蠅，成功幫狐狸大蹄保護派對！";
  }

  if (stars === 2) {
    return "做得很好！再多練習幾次，你會更快找到蒼蠅！";
  }

  return "沒關係！我們再幫狐狸大蹄一起趕走蒼蠅！";
}

function getAccuracyLevel(accuracyPercent) {
  if (accuracyPercent >= 85) return "表現良好";
  if (accuracyPercent >= 65) return "尚可";
  return "需要加強";
}

function getSpeedLevel(avgReactionTime) {
  if (!isFiniteNumber(avgReactionTime)) return "資料不足";
  if (avgReactionTime <= 800) return "反應快速";
  if (avgReactionTime <= 1200) return "反應穩定";
  if (avgReactionTime <= 1600) return "反應稍慢";
  return "反應偏慢";
}

function getInterferenceLevel(interferenceEffect) {
  if (!isFiniteNumber(interferenceEffect)) return "資料不足";
  if (interferenceEffect <= 150) return "干擾影響小";
  if (interferenceEffect <= 350) return "有中等干擾影響";
  return "容易受干擾影響";
}

function getStabilityLevel(rtStd) {
  if (!isFiniteNumber(rtStd)) return "資料不足";
  if (rtStd <= 250) return "反應穩定";
  if (rtStd <= 500) return "略有波動";
  return "反應不穩定";
}

/* =========================
   主要評分函式
   ========================= */

export function calculateDptScore(inputRecords = []) {
  const records = safeArray(inputRecords);

  const totalTrials = records.length;

  const correctRecords = records.filter((r) => r?.isCorrect === true);
  const wrongRecords = records.filter(
    (r) => r?.isCorrect === false && r?.timeout !== true
  );
  const timeoutRecords = records.filter((r) => r?.timeout === true);

  const correctCount = correctRecords.length;
  const wrongCount = wrongRecords.length;
  const timeoutCount = timeoutRecords.length;

  const accuracyRate = totalTrials > 0 ? correctCount / totalTrials : 0;
  const accuracyPercent = percentage(correctCount, totalTrials);

  /*
    RT 只使用答對且 reactionTime 有效的題目。
    避免亂點、timeout、undefined、NaN 影響平均反應時間。
  */
  const validCorrectRtRecords = correctRecords.filter((r) =>
    isFiniteNumber(r?.reactionTime)
  );

  const validRtCount = validCorrectRtRecords.length;

  const correctReactionTimes = validCorrectRtRecords.map(
    (r) => r.reactionTime
  );

  /*
    全錯 / 全逾時時：
    - correctReactionTimes = []
    - average 回傳 null
    - standardDeviation 回傳 null
    - coefficientOfVariation 回傳 null
    不會產生 NaN
  */
  const avgReactionTime = roundNumber(average(correctReactionTimes), 0);
  const rtStd = roundNumber(standardDeviation(correctReactionTimes), 0);
  const rtCv = roundNumber(coefficientOfVariation(correctReactionTimes), 3);

  /*
    Congruent / Incongruent RT
    只計算答對題。

    醫療級防禦：
    - congruentCorrectRt.length >= 2
    - incongruentCorrectRt.length >= 2
    兩側皆滿足才計算 interferenceEffect。
    避免單題猜對造成「不一致題反而更快」的假性負值。
  */
  const congruentCorrectRt = validCorrectRtRecords
    .filter((r) => r.condition === "congruent")
    .map((r) => r.reactionTime);

  const incongruentCorrectRt = validCorrectRtRecords
    .filter((r) => r.condition === "incongruent")
    .map((r) => r.reactionTime);

  const congruentValidRtCount = congruentCorrectRt.length;
  const incongruentValidRtCount = incongruentCorrectRt.length;

  const hasEnoughInterferenceSamples =
    congruentValidRtCount >= 2 && incongruentValidRtCount >= 2;

  const avgCongruentRt = hasEnoughInterferenceSamples
    ? roundNumber(average(congruentCorrectRt), 0)
    : null;

  const avgIncongruentRt = hasEnoughInterferenceSamples
    ? roundNumber(average(incongruentCorrectRt), 0)
    : null;

  const interferenceEffect =
    hasEnoughInterferenceSamples &&
    isFiniteNumber(avgCongruentRt) &&
    isFiniteNumber(avgIncongruentRt)
      ? roundNumber(avgIncongruentRt - avgCongruentRt, 0)
      : null;

  /*
    左右側表現
  */
  const leftRecords = records.filter((r) => r?.correctSide === "left");
  const rightRecords = records.filter((r) => r?.correctSide === "right");

  const leftCorrectCount = leftRecords.filter((r) => r?.isCorrect).length;
  const rightCorrectCount = rightRecords.filter((r) => r?.isCorrect).length;

  const leftAccuracy = percentage(leftCorrectCount, leftRecords.length);
  const rightAccuracy = percentage(rightCorrectCount, rightRecords.length);

  /*
    條件正確率
  */
  const congruentRecords = records.filter((r) => r?.condition === "congruent");
  const incongruentRecords = records.filter(
    (r) => r?.condition === "incongruent"
  );

  const congruentCorrectCount = congruentRecords.filter(
    (r) => r?.isCorrect
  ).length;
  const incongruentCorrectCount = incongruentRecords.filter(
    (r) => r?.isCorrect
  ).length;

  const congruentAccuracy = percentage(
    congruentCorrectCount,
    congruentRecords.length
  );

  const incongruentAccuracy = percentage(
    incongruentCorrectCount,
    incongruentRecords.length
  );

  /*
    100 分制
  */
  const accuracyScore = getAccuracyScore(accuracyRate);
  const speedScore = getSpeedScore(avgReactionTime);
  const interferenceScore = getInterferenceScore(interferenceEffect);
  const stabilityScore = getStabilityScore(rtStd);

  const errorPenalty = getErrorPenalty({
    wrongCount,
    timeoutCount,
    totalTrials,
  });

  /*
    總分防禦：
    - 先加總
    - 扣除誤觸 / 逾時懲罰
    - Math.max(0, ...) 防止跌破 0
    - clamp 到 0～100，防止圖表或星級異常
  */
  const rawTotalScore =
    accuracyScore + speedScore + interferenceScore + stabilityScore;

  const totalScore = clamp(
    Math.max(0, roundNumber(rawTotalScore - errorPenalty, 0) ?? 0),
    0,
    100
  );

  const stars = getStarRating(totalScore);

  /*
    家長端能力分數：轉成 0～100，方便圖表使用
    所有值都 clamp，避免 NaN 破壞雷達圖 / 進度條。
  */
  const parentAbilityScores = {
    targetFinding: clamp(accuracyPercent, 0, 100),
    reactionSpeed: clamp(roundNumber((speedScore / 25) * 100, 0) ?? 0, 0, 100),
    antiInterference: clamp(
      roundNumber((interferenceScore / 25) * 100, 0) ?? 0,
      0,
      100
    ),
    attentionStability: clamp(
      roundNumber((stabilityScore / 10) * 100, 0) ?? 0,
      0,
      100
    ),
  };

  return {
    taskName: "Dot Probe Task",
    taskCode: "DPT",
    mode: "test",

    totalScore,
    stars,

    summary: {
      totalTrials,
      correctCount,
      wrongCount,
      timeoutCount,

      accuracyRate,
      accuracyPercent,

      validRtCount,
      avgReactionTime,
      rtStd,
      rtCv,

      avgCongruentRt,
      avgIncongruentRt,
      interferenceEffect,
      hasEnoughInterferenceSamples,
      congruentValidRtCount,
      incongruentValidRtCount,

      leftAccuracy,
      rightAccuracy,
      congruentAccuracy,
      incongruentAccuracy,
    },

    scoreBreakdown: {
      accuracyScore,
      speedScore,
      interferenceScore,
      stabilityScore,
      errorPenalty,
      rawTotalScore,
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
          key: "targetFinding",
          label: "找到目標能力",
          value: parentAbilityScores.targetFinding,
          level: getAccuracyLevel(accuracyPercent),
          description: "觀察孩子是否能正確找到蒼蠅停在哪一邊。",
        },
        {
          key: "reactionSpeed",
          label: "反應速度",
          value: parentAbilityScores.reactionSpeed,
          level: getSpeedLevel(avgReactionTime),
          description: "觀察孩子看到蒼蠅後，能多快做出點擊反應。",
        },
        {
          key: "antiInterference",
          label: "抗干擾能力",
          value: parentAbilityScores.antiInterference,
          level: getInterferenceLevel(interferenceEffect),
          description:
            "觀察孩子是否容易被比較亮、會動或較吸引人的物品分散注意力。",
        },
        {
          key: "attentionStability",
          label: "注意力穩定度",
          value: parentAbilityScores.attentionStability,
          level: getStabilityLevel(rtStd),
          description: "觀察孩子每一題的反應是否穩定，是否忽快忽慢。",
        },
      ],

      plainLanguageSummary: buildParentSummary({
        accuracyPercent,
        avgReactionTime,
        interferenceEffect,
        rtStd,
        hasEnoughInterferenceSamples,
      }),
    },

    clinicalView: {
      totalTrials,
      correctCount,
      wrongCount,
      timeoutCount,

      accuracyPercent,
      validRtCount,
      avgReactionTime,
      rtStd,
      rtCv,

      avgCongruentRt,
      avgIncongruentRt,
      interferenceEffect,
      hasEnoughInterferenceSamples,
      congruentValidRtCount,
      incongruentValidRtCount,

      leftAccuracy,
      rightAccuracy,
      congruentAccuracy,
      incongruentAccuracy,

      interpretationFlags: buildClinicalFlags({
        accuracyPercent,
        avgReactionTime,
        interferenceEffect,
        rtStd,
        rtCv,
        timeoutCount,
        totalTrials,
        leftAccuracy,
        rightAccuracy,
        hasEnoughInterferenceSamples,
        congruentValidRtCount,
        incongruentValidRtCount,
      }),

      records,
    },

    records,
    generatedAt: new Date().toISOString(),
  };
}

/* =========================
   文字摘要
   ========================= */

function buildParentSummary({
  accuracyPercent,
  avgReactionTime,
  interferenceEffect,
  rtStd,
  hasEnoughInterferenceSamples,
}) {
  const accuracyText =
    accuracyPercent >= 85
      ? "孩子大多能正確找到蒼蠅的位置。"
      : accuracyPercent >= 65
      ? "孩子可以找到部分蒼蠅，但偶爾會點錯位置。"
      : "孩子在找出蒼蠅位置時仍需要更多練習。";

  const speedText =
    !isFiniteNumber(avgReactionTime)
      ? "目前有效反應時間資料不足。"
      : avgReactionTime <= 1200
      ? "反應速度整體穩定。"
      : "反應速度較慢，可能需要更多時間搜尋目標。";

  const interferenceText =
    !hasEnoughInterferenceSamples || !isFiniteNumber(interferenceEffect)
      ? "目前答對的干擾題與一般題數量不足，暫時不建議解讀抗干擾差異。"
      : interferenceEffect <= 150
      ? "在有干擾物時，孩子仍能維持穩定表現。"
      : interferenceEffect <= 350
      ? "孩子在干擾情境下會稍微變慢。"
      : "孩子在干擾情境下反應明顯變慢，可能較容易被吸引物分散注意力。";

  const stabilityText =
    !isFiniteNumber(rtStd)
      ? "目前反應穩定度資料不足。"
      : rtStd <= 250
      ? "每題反應時間相當穩定。"
      : rtStd <= 500
      ? "反應時間略有波動。"
      : "反應時間變化較大，代表注意力穩定度可以再觀察。";

  return `${accuracyText}${speedText}${interferenceText}${stabilityText}`;
}

/* =========================
   醫療端提醒旗標
   ========================= */

function buildClinicalFlags({
  accuracyPercent,
  avgReactionTime,
  interferenceEffect,
  rtStd,
  rtCv,
  timeoutCount,
  totalTrials,
  leftAccuracy,
  rightAccuracy,
  hasEnoughInterferenceSamples,
  congruentValidRtCount,
  incongruentValidRtCount,
}) {
  const flags = [];

  if (accuracyPercent < 60) {
    flags.push({
      type: "accuracy_low",
      level: "warning",
      message: "整體正確率偏低，建議觀察是否理解規則或是否有注意力維持困難。",
    });
  }

  if (isFiniteNumber(avgReactionTime) && avgReactionTime > 1600) {
    flags.push({
      type: "reaction_slow",
      level: "notice",
      message: "平均反應時間偏慢，可能表示搜尋目標速度較慢。",
    });
  }

  if (!hasEnoughInterferenceSamples) {
    flags.push({
      type: "interference_insufficient_samples",
      level: "notice",
      message: `干擾效應樣本不足，congruent 有效答對 RT 題數為 ${congruentValidRtCount}，incongruent 有效答對 RT 題數為 ${incongruentValidRtCount}。兩側皆至少 2 題才建議解讀干擾影響值。`,
    });
  }

  if (
    hasEnoughInterferenceSamples &&
    isFiniteNumber(interferenceEffect) &&
    interferenceEffect > 350
  ) {
    flags.push({
      type: "interference_high",
      level: "warning",
      message:
        "不一致題反應明顯變慢，可能代表較容易受到吸引性刺激干擾。",
    });
  }

  if (isFiniteNumber(rtStd) && rtStd > 500) {
    flags.push({
      type: "stability_low",
      level: "notice",
      message: "反應時間變異較大，可能代表注意力穩定度不足。",
    });
  }

  if (isFiniteNumber(rtCv) && rtCv > 0.35) {
    flags.push({
      type: "rt_cv_high",
      level: "notice",
      message: "反應時間變異係數偏高，代表作答節奏可能較不穩定。",
    });
  }

  if (totalTrials > 0 && timeoutCount / totalTrials >= 0.2) {
    flags.push({
      type: "timeout_high",
      level: "warning",
      message: "逾時比例偏高，建議確認孩子是否理解任務或搜尋時間是否不足。",
    });
  }

  if (
    isFiniteNumber(leftAccuracy) &&
    isFiniteNumber(rightAccuracy) &&
    Math.abs(leftAccuracy - rightAccuracy) >= 30
  ) {
    flags.push({
      type: "side_bias",
      level: "notice",
      message:
        "左右側正確率差異較大，建議觀察是否有側向偏好、視覺掃描或操作習慣差異。",
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

/* =========================
   從 localStorage 讀取 TestPage_DPT 結果
   ========================= */

export function getStoredDptResult() {
  try {
    const raw = localStorage.getItem("dptTestResult");
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return calculateDptScore(parsed);
    }

    if (Array.isArray(parsed.records)) {
      return {
        ...parsed,
        scoring: calculateDptScore(parsed.records),
      };
    }

    return null;
  } catch (error) {
    console.error("讀取 DPT 測驗結果失敗：", error);
    return null;
  }
}

/* =========================
   預設匯出
   ========================= */

export default calculateDptScore;