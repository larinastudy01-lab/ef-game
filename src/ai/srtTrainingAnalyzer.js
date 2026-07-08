// src/ai/srtTrainingAnalyzer.js

/*
  =========================================================
  SRT AI Training Analyzer
  用途：
  1. 分析 SRT 訓練表現
  2. 判斷專注力、衝動控制、疲勞、提示需求
  3. 推薦下一次難度
  4. 產生家長端 / 醫療端摘要

  注意：
  本檔案不做醫療診斷，只提供訓練表現分析與觀察建議。
  =========================================================
*/

const MIN_VALID_REACTION_TIME_MS = 150;
const MIN_TOTAL_TRIALS_FOR_RECOMMENDATION = 15;
const MIN_VALID_RT_FOR_RECOMMENDATION = 8;
const MIN_TOTAL_TRIALS_FOR_SEGMENT = 15;
const MIN_SPECIAL_TRIALS = 3;

const DIFFICULTY_ORDER = [
  "easy-1",
  "easy-2",
  "easy-3",
  "medium-1",
  "medium-2",
  "medium-3",
  "hard-1",
  "hard-2",
  "hard-3",
];

const clamp = (value, min, max) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, number));
};

const safePercent = (numerator, denominator) => {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
};

const average = (values = []) => {
  const validValues = Array.isArray(values)
    ? values.filter((value) => Number.isFinite(value))
    : [];

  if (validValues.length === 0) {
    return null;
  }

  return Math.round(
    validValues.reduce((sum, value) => sum + value, 0) /
      validValues.length
  );
};

const standardDeviation = (values = []) => {
  const validValues = Array.isArray(values)
    ? values.filter((value) => Number.isFinite(value))
    : [];

  if (validValues.length < 2) {
    return null;
  }

  const avg =
    validValues.reduce((sum, value) => sum + value, 0) /
    validValues.length;

  const variance =
    validValues.reduce(
      (sum, value) => sum + Math.pow(value - avg, 2),
      0
    ) / validValues.length;

  return Math.round(Math.sqrt(variance));
};

const getDifficultyStep = (difficultyKey) => {
  const index = DIFFICULTY_ORDER.indexOf(difficultyKey);

  return index >= 0 ? index + 1 : 1;
};

const getDifficultyFromStep = (step) => {
  const safeStep = clamp(step, 1, DIFFICULTY_ORDER.length);
  const index = safeStep - 1;

  return DIFFICULTY_ORDER[index];
};

const getDisplayDifficulty = (difficultyKey) => {
  const step = getDifficultyStep(difficultyKey);

  if (step <= 3) {
    return "easy";
  }

  if (step <= 6) {
    return "medium";
  }

  return "hard";
};

const isValidReactionTime = (value) =>
  Number.isFinite(value) &&
  value >= MIN_VALID_REACTION_TIME_MS;

const isAnticipatoryReactionTime = (value) =>
  Number.isFinite(value) &&
  value > 0 &&
  value < MIN_VALID_REACTION_TIME_MS;

const normalizeTrainingAction = (action) => {
  if (action === "correctReject") {
    return "correctAvoid";
  }

  if (action === "falseAlarm") {
    return "clickedRotten";
  }

  return action || null;
};

const normalizeRecord = (record = {}, index = 0) => {
  const trainingAction = normalizeTrainingAction(
    record.trainingAction
  );

  const targetType =
    record.targetType === "broken"
      ? "rotten"
      : record.targetType;

  const inferredCorrect =
    trainingAction === "hit" ||
    trainingAction === "correctAvoid";

  return {
    ...record,
    trialIndex:
      record.trialIndex ??
      record.trial ??
      index + 1,
    targetType,
    trainingAction,
    isCorrect:
      typeof record.isCorrect === "boolean"
        ? record.isCorrect
        : inferredCorrect,
  };
};

const isTrialRecord = (record) => {
  if (!record) {
    return false;
  }

  const isTargetTrial = [
    "normal",
    "golden",
    "rotten",
    "broken",
  ].includes(record.targetType);

  const isTrialAction = [
    "hit",
    "correctAvoid",
    "clickedRotten",
    "miss",
    "timeout",
  ].includes(record.trainingAction);

  return isTargetTrial || isTrialAction;
};

const getRtStats = (records = []) => {
  const hitRecords = records.filter(
    (record) =>
      record.trainingAction === "hit" &&
      isValidReactionTime(record.reactionTime)
  );

  const hitReactionTimes = hitRecords.map(
    (record) => record.reactionTime
  );

  const unassistedReactionTimes = hitRecords
    .filter((record) => record.assisted !== true)
    .map((record) => record.reactionTime);

  const assistedReactionTimes = hitRecords
    .filter((record) => record.assisted === true)
    .map((record) => record.reactionTime);

  const avgRT = average(hitReactionTimes);
  const rtStd = standardDeviation(hitReactionTimes);

  const rtCV =
    avgRT !== null &&
    avgRT > 0 &&
    rtStd !== null
      ? Number((rtStd / avgRT).toFixed(2))
      : null;

  return {
    count: hitReactionTimes.length,
    avgRT,
    rtStd,
    rtCV,
    unassistedAvgRT: average(
      unassistedReactionTimes
    ),
    assistedAvgRT: average(
      assistedReactionTimes
    ),
  };
};

const getSegmentName = (index, total) => {
  if (total <= 0) {
    return "first";
  }

  const ratio = index / total;

  if (ratio < 1 / 3) {
    return "first";
  }

  if (ratio < 2 / 3) {
    return "middle";
  }

  return "last";
};

const summarizeRecords = (records = []) => {
  const allRecords = Array.isArray(records)
    ? records
    : [];

  const trialRecords = allRecords.filter(
    isTrialRecord
  );

  const totalTrials = trialRecords.length;

  const hitCount = trialRecords.filter(
    (record) =>
      record.trainingAction === "hit" &&
      isValidReactionTime(record.reactionTime)
  ).length;

  const correctAvoidCount = trialRecords.filter(
    (record) =>
      record.trainingAction === "correctAvoid"
  ).length;

  const missCount = trialRecords.filter(
    (record) =>
      record.missed === true ||
      record.timeout === true
  ).length;

  const clickedRottenCount = trialRecords.filter(
    (record) =>
      record.trainingAction === "clickedRotten"
  ).length;

  const backgroundClickCount = allRecords.filter(
    (record) =>
      record.trainingAction === "backgroundClick"
  ).length;

  const repeatedClickCount = allRecords.filter(
    (record) =>
      record.trainingAction === "repeatedClick"
  ).length;

  const anticipatoryNoiseCount = trialRecords.filter(
    (record) =>
      isAnticipatoryReactionTime(
        record.reactionTime
      )
  ).length;

  const assistEligibleTrials = trialRecords.filter(
    (record) =>
      ["normal", "golden"].includes(
        record.targetType
      )
  );

  const assistedCount = assistEligibleTrials.filter(
    (record) => record.assisted === true
  ).length;

  const unassistedEligibleTrials =
    assistEligibleTrials.filter(
      (record) => record.assisted !== true
    );

  const unassistedCorrectCount =
    unassistedEligibleTrials.filter(
      (record) =>
        record.trainingAction === "hit" &&
        isValidReactionTime(
          record.reactionTime
        )
    ).length;

  const goldenRecords = trialRecords.filter(
    (record) =>
      record.targetType === "golden"
  );

  const goldenTotal = goldenRecords.length;

  const goldenHitCount = goldenRecords.filter(
    (record) =>
      record.trainingAction === "hit" &&
      isValidReactionTime(
        record.reactionTime
      )
  ).length;

  const rottenRecords = trialRecords.filter(
    (record) =>
      record.targetType === "rotten"
  );

  const rottenTotal = rottenRecords.length;

  const rtStats = getRtStats(trialRecords);

  const correctCount =
    hitCount + correctAvoidCount;

  return {
    totalTrials,
    hitCount,
    correctAvoidCount,
    correctCount,
    missCount,
    clickedRottenCount,
    backgroundClickCount,
    repeatedClickCount,
    anticipatoryNoiseCount,
    assistedCount,
    assistEligibleCount:
      assistEligibleTrials.length,
    unassistedCorrectCount,
    goldenTotal,
    goldenHitCount,
    rottenTotal,

    accuracy: safePercent(
      correctCount,
      totalTrials
    ),

    missRate: safePercent(
      missCount,
      totalTrials
    ),

    clickedRottenRate: safePercent(
      clickedRottenCount,
      rottenTotal || totalTrials
    ),

    backgroundClickRate: safePercent(
      backgroundClickCount,
      totalTrials
    ),

    repeatedClickRate: safePercent(
      repeatedClickCount,
      totalTrials
    ),

    assistedRate: safePercent(
      assistedCount,
      assistEligibleTrials.length
    ),

    unassistedAccuracy: safePercent(
      unassistedCorrectCount,
      unassistedEligibleTrials.length
    ),

    goldenHitRate:
      goldenTotal >= MIN_SPECIAL_TRIALS
        ? safePercent(
            goldenHitCount,
            goldenTotal
          )
        : null,

    rottenClickRate:
      rottenTotal >= MIN_SPECIAL_TRIALS
        ? safePercent(
            clickedRottenCount,
            rottenTotal
          )
        : null,

    inhibitionDataSufficient:
      rottenTotal >= MIN_SPECIAL_TRIALS,

    rewardDataSufficient:
      goldenTotal >= MIN_SPECIAL_TRIALS,

    avgRT: rtStats.avgRT,
    rtStd: rtStats.rtStd,
    rtCV: rtStats.rtCV,
    validRTCount: rtStats.count,
    unassistedAvgRT:
      rtStats.unassistedAvgRT,
    assistedAvgRT:
      rtStats.assistedAvgRT,
  };
};

const summarizeSegment = (records = []) =>
  summarizeRecords(records);

const buildSegmentAnalysis = (records = []) => {
  const trialRecords = (
    Array.isArray(records)
      ? records
      : []
  ).filter(isTrialRecord);

  const total = trialRecords.length;

  if (
    total <
    MIN_TOTAL_TRIALS_FOR_SEGMENT
  ) {
    return {
      first: null,
      middle: null,
      last: null,
      rtSlowing: null,
      missIncrease: null,
      wrongClickIncrease: null,
      assistedRateIncrease: null,
      attentionDrop: null,
      attentionDropScore: null,
      dataSufficient: false,
      reason:
        `有效題數少於 ${MIN_TOTAL_TRIALS_FOR_SEGMENT} 題，暫不判斷前後段變化。`,
    };
  }

  const withSegment = trialRecords.map(
    (record, index) => ({
      ...record,
      segment:
        record.segment ||
        getSegmentName(index, total),
    })
  );

  const firstRecords = withSegment.filter(
    (record) =>
      record.segment === "first"
  );

  const middleRecords = withSegment.filter(
    (record) =>
      record.segment === "middle"
  );

  const lastRecords = withSegment.filter(
    (record) =>
      record.segment === "last"
  );

  const first =
    summarizeSegment(firstRecords);

  const middle =
    summarizeSegment(middleRecords);

  const last =
    summarizeSegment(lastRecords);

  const rtSlowing =
    first.avgRT !== null &&
    last.avgRT !== null
      ? last.avgRT - first.avgRT
      : null;

  const missIncrease =
    last.missRate - first.missRate;

  const wrongClickIncrease =
    last.backgroundClickRate +
    (last.rottenClickRate ?? 0) -
    (
      first.backgroundClickRate +
      (first.rottenClickRate ?? 0)
    );

  const assistedRateIncrease =
    last.assistedRate -
    first.assistedRate;

  const normalizedRtDrop =
    rtSlowing === null
      ? 0
      : clamp(
          rtSlowing / 500,
          0,
          1
        );

  const normalizedMissDrop =
    clamp(
      missIncrease / 30,
      0,
      1
    );

  const normalizedWrongClickDrop =
    clamp(
      wrongClickIncrease / 30,
      0,
      1
    );

  const normalizedAssistDrop =
    clamp(
      assistedRateIncrease / 40,
      0,
      1
    );

  const attentionDrop = Math.round(
    (
      normalizedRtDrop * 0.35 +
      normalizedMissDrop * 0.3 +
      normalizedWrongClickDrop * 0.2 +
      normalizedAssistDrop * 0.15
    ) * 100
  );

  return {
    first,
    middle,
    last,
    rtSlowing,
    missIncrease,
    wrongClickIncrease,
    assistedRateIncrease,
    attentionDrop,
    attentionDropScore:
      attentionDrop,
    dataSufficient: true,
    reason: null,
  };
};

const classifyAttention = ({
  missRate,
  rtCV,
  attentionDrop,
  dataSufficient,
}) => {
  if (
    !dataSufficient &&
    rtCV === null
  ) {
    return "insufficient";
  }

  if (
    missRate >= 25 ||
    (rtCV !== null && rtCV >= 0.45) ||
    (attentionDrop ?? 0) >= 50
  ) {
    return "high_drop";
  }

  if (
    missRate >= 12 ||
    (rtCV !== null && rtCV >= 0.3) ||
    (attentionDrop ?? 0) >= 25
  ) {
    return "mild_drop";
  }

  return "stable";
};

const classifyImpulse = ({
  clickedRottenRate,
  backgroundClickRate,
  repeatedClickCount,
}) => {
  if (
    (clickedRottenRate !== null &&
      clickedRottenRate >= 30) ||
    backgroundClickRate >= 20 ||
    repeatedClickCount >= 8
  ) {
    return "high";
  }

  if (
    (clickedRottenRate !== null &&
      clickedRottenRate >= 15) ||
    backgroundClickRate >= 10 ||
    repeatedClickCount >= 3
  ) {
    return "medium";
  }

  return "low";
};

const classifyFatigue = ({
  rtSlowing,
  missIncrease,
  assistedRateIncrease,
  dataSufficient,
}) => {
  if (!dataSufficient) {
    return "insufficient";
  }

  if (
    (rtSlowing ?? 0) >= 450 ||
    missIncrease >= 20 ||
    assistedRateIncrease >= 25
  ) {
    return "high";
  }

  if (
    (rtSlowing ?? 0) >= 220 ||
    missIncrease >= 10 ||
    assistedRateIncrease >= 12
  ) {
    return "medium";
  }

  return "low";
};

const classifyAssistedNeed = ({
  assistedRate,
  assistEligibleCount,
}) => {
  if (!assistEligibleCount) {
    return "insufficient";
  }

  if (assistedRate >= 40) {
    return "high";
  }

  if (assistedRate >= 20) {
    return "medium";
  }

  return "low";
};

export const recommendNextSrtDifficulty = ({
  difficulty = "easy-1",
  accuracy = 0,
  unassistedAccuracy = 0,
  missRate = 0,
  clickedRottenRate = null,
  backgroundClickRate = 0,
  assistedRate = 0,
  rtCV = null,
  fatigueLevel = "low",
  totalTrials = 0,
  validRTCount = 0,
  inhibitionDataSufficient = false,
  segmentDataSufficient = false,
}) => {
  const currentStep =
    getDifficultyStep(difficulty);

  const dataSufficient =
    totalTrials >=
      MIN_TOTAL_TRIALS_FOR_RECOMMENDATION &&
    validRTCount >=
      MIN_VALID_RT_FOR_RECOMMENDATION;

  if (!dataSufficient) {
    return {
      action: "maintain",
      nextDifficulty:
        getDifficultyFromStep(
          currentStep
        ),
      reason:
        "本次有效題數或有效反應時間不足，建議先維持目前難度再觀察一次。",
      dataSufficient: false,
    };
  }

  const inhibitionPassed =
    !inhibitionDataSufficient ||
    clickedRottenRate === null ||
    clickedRottenRate <= 15;

  const inhibitionFailed =
    inhibitionDataSufficient &&
    clickedRottenRate !== null &&
    clickedRottenRate > 30;

  const rtStable =
    rtCV === null ||
    rtCV <= 0.35;

  const rtUnstable =
    rtCV !== null &&
    rtCV > 0.5;

  const shouldUpgrade =
    accuracy >= 85 &&
    unassistedAccuracy >= 80 &&
    missRate <= 10 &&
    inhibitionPassed &&
    backgroundClickRate <= 10 &&
    assistedRate <= 20 &&
    rtStable &&
    fatigueLevel !== "high";

  const shouldDowngrade =
    accuracy < 65 ||
    missRate > 25 ||
    inhibitionFailed ||
    backgroundClickRate > 25 ||
    assistedRate > 40 ||
    rtUnstable ||
    fatigueLevel === "high";

  if (shouldUpgrade) {
    return {
      action: "upgrade",
      nextDifficulty:
        getDifficultyFromStep(
          currentStep + 1
        ),
      reason:
        "表現穩定、未提示正確率良好，可以提高一階難度。",
      dataSufficient: true,
    };
  }

  if (shouldDowngrade) {
    return {
      action: "downgrade",
      nextDifficulty:
        getDifficultyFromStep(
          currentStep - 1
        ),
      reason:
        "漏答、錯點、提示需求、反應波動或疲勞偏高，建議降低一階難度。",
      dataSufficient: true,
    };
  }

  return {
    action: "maintain",
    nextDifficulty:
      getDifficultyFromStep(
        currentStep
      ),
    reason:
      segmentDataSufficient &&
      fatigueLevel === "medium"
        ? "整體能力可維持目前難度，但後段略有疲勞，建議縮短訓練時間或安排短暫休息。"
        : "目前難度大致符合本次表現，建議先維持並搭配後續紀錄觀察。",
    dataSufficient: true,
  };
};

export const generateSrtParentSummary = (
  analysis
) => {
  const {
    attentionLevel,
    impulseLevel,
    fatigueLevel,
    assistedNeed,
    recommendation,
    dataQuality,
  } = analysis;

  const messages = [];

  if (
    !dataQuality
      ?.recommendationDataSufficient
  ) {
    messages.push(
      "本次有效資料較少，結果建議搭配後續多次訓練一起觀察。"
    );
  }

  if (
    attentionLevel === "insufficient"
  ) {
    messages.push(
      "本次題數不足，暫時無法完整比較前後段的注意力變化。"
    );
  } else if (
    attentionLevel === "stable"
  ) {
    messages.push(
      "孩子本次在遊戲中的注意力大致維持穩定。"
    );
  } else if (
    attentionLevel === "mild_drop"
  ) {
    messages.push(
      "本次訓練後段有些漏答或反應變慢，可能與疲勞、注意力波動或當下狀態有關。"
    );
  } else {
    messages.push(
      "本次訓練後段的漏答或反應變慢較明顯，建議安排休息並搭配後續紀錄觀察。"
    );
  }

  if (
    impulseLevel === "high"
  ) {
    messages.push(
      "本次有較多太快點擊、空白點擊或點到壞橡實的情況，下次可先練習看清楚再點。"
    );
  } else if (
    impulseLevel === "medium"
  ) {
    messages.push(
      "本次偶爾出現較快點擊或誤點的情況，可以持續觀察。"
    );
  } else {
    messages.push(
      "孩子本次大多能控制點擊，不會持續亂點。"
    );
  }

  if (
    fatigueLevel === "high"
  ) {
    messages.push(
      "本次後段疲勞表現較明顯，下次建議縮短時間或先不要提高難度。"
    );
  } else if (
    fatigueLevel === "medium"
  ) {
    messages.push(
      "本次後段稍微變慢，可以維持目前難度並安排短暫休息。"
    );
  }

  if (
    assistedNeed === "high"
  ) {
    messages.push(
      "本次需要較多提示，下次可保留較明顯但不干擾的提醒。"
    );
  } else if (
    assistedNeed === "medium"
  ) {
    messages.push(
      "本次偶爾需要提示，但多數題目仍可自行完成。"
    );
  }

  messages.push(
    `下次建議：${recommendation.nextDifficulty}（${recommendation.reason}）`
  );

  return messages
    .filter(Boolean)
    .join(" ");
};

export const generateSrtClinicianSummary = (
  analysis
) => {
  const {
    metrics,
    segmentAnalysis,
    dataQuality,
    attentionLevel,
    impulseLevel,
    fatigueLevel,
    assistedNeed,
    recommendation,
  } = analysis;

  const formatValue = (
    value,
    fallback = "NA"
  ) =>
    value === null ||
    value === undefined
      ? fallback
      : value;

  return [
    `SRT 訓練分析：accuracy=${metrics.accuracy}%，unassistedAccuracy=${metrics.unassistedAccuracy}%，avgRT=${formatValue(metrics.avgRT)}ms，rtCV=${formatValue(metrics.rtCV)}。`,
    `資料品質：totalTrials=${dataQuality.totalTrials}，validRTCount=${dataQuality.validRTCount}，anticipatoryNoiseCount=${dataQuality.anticipatoryNoiseCount}，recommendationDataSufficient=${dataQuality.recommendationDataSufficient}。`,
    `錯誤型態：missRate=${metrics.missRate}%，rottenClickRate=${formatValue(metrics.rottenClickRate)}%，backgroundClickRate=${metrics.backgroundClickRate}%，repeatedClickRate=${metrics.repeatedClickRate}%。`,
    `特殊題資料：rottenTotal=${metrics.rottenTotal}，goldenTotal=${metrics.goldenTotal}，inhibitionDataSufficient=${dataQuality.inhibitionDataSufficient}，rewardDataSufficient=${dataQuality.rewardDataSufficient}。`,
    `提示需求：assistedRate=${metrics.assistedRate}%，assistedNeed=${assistedNeed}，unassistedAvgRT=${formatValue(metrics.unassistedAvgRT)}ms，assistedAvgRT=${formatValue(metrics.assistedAvgRT)}ms。`,
    `長時間表現：segmentDataSufficient=${dataQuality.segmentDataSufficient}，rtSlowing=${formatValue(segmentAnalysis.rtSlowing)}ms，missIncrease=${formatValue(segmentAnalysis.missIncrease)}%，attentionDrop=${formatValue(segmentAnalysis.attentionDrop)}。`,
    `AI 標籤：attention=${attentionLevel}，impulse=${impulseLevel}，fatigue=${fatigueLevel}。`,
    `建議：${recommendation.action} → ${recommendation.nextDifficulty}。${recommendation.reason}`,
    "備註：此分析僅作為訓練表現追蹤與臨床觀察輔助，不作為診斷依據。",
  ].join("\n");
};

export const analyzeSrtTraining = ({
  records = [],
  falseClickCount = 0,
  repeatedClickCount = 0,
  difficulty = "easy-1",
  totalTime = 0,
  childProfile = null,
} = {}) => {
  const normalizedRecords = (
    Array.isArray(records)
      ? records
      : []
  ).map(normalizeRecord);

  const recordedBackgroundClicks =
    normalizedRecords.filter(
      (record) =>
        record.trainingAction ===
        "backgroundClick"
    ).length;

  const recordedRepeatedClicks =
    normalizedRecords.filter(
      (record) =>
        record.trainingAction ===
        "repeatedClick"
    ).length;

  const missingBackgroundClickCount =
    Math.max(
      0,
      (Number(falseClickCount) || 0) -
        recordedBackgroundClicks
    );

  const missingRepeatedClickCount =
    Math.max(
      0,
      (Number(repeatedClickCount) || 0) -
        recordedRepeatedClicks
    );

  const generatedAt = Date.now();

  const backgroundClickRecords =
    Array.from({
      length:
        missingBackgroundClickCount,
    }).map((_, index) => ({
      trialIndex: `FC-${index + 1}`,
      isCorrect: false,
      reactionTime: null,
      timeout: false,
      missed: false,
      falseClick: true,
      targetType: "background",
      trainingAction:
        "backgroundClick",
      scoreValue: 0,
      assisted: false,
      assistType: null,
      timestamp: generatedAt,
    }));

  const repeatedClickRecords =
    Array.from({
      length:
        missingRepeatedClickCount,
    }).map((_, index) => ({
      trialIndex: `RC-${index + 1}`,
      isCorrect: false,
      reactionTime: null,
      timeout: false,
      missed: false,
      falseClick: true,
      targetType: "background",
      trainingAction:
        "repeatedClick",
      scoreValue: 0,
      assisted: false,
      assistType: null,
      timestamp: generatedAt,
    }));

  const allRecords = [
    ...normalizedRecords,
    ...backgroundClickRecords,
    ...repeatedClickRecords,
  ];

  const metrics =
    summarizeRecords(allRecords);

  const segmentAnalysis =
    buildSegmentAnalysis(
      normalizedRecords
    );

  const attentionLevel =
    classifyAttention({
      missRate: metrics.missRate,
      rtCV: metrics.rtCV,
      attentionDrop:
        segmentAnalysis.attentionDrop,
      dataSufficient:
        segmentAnalysis.dataSufficient,
    });

  const impulseLevel =
    classifyImpulse({
      clickedRottenRate:
        metrics.rottenClickRate,
      backgroundClickRate:
        metrics.backgroundClickRate,
      repeatedClickCount:
        metrics.repeatedClickCount,
    });

  const fatigueLevel =
    classifyFatigue({
      rtSlowing:
        segmentAnalysis.rtSlowing,
      missIncrease:
        segmentAnalysis.missIncrease ??
        0,
      assistedRateIncrease:
        segmentAnalysis
          .assistedRateIncrease ?? 0,
      dataSufficient:
        segmentAnalysis.dataSufficient,
    });

  const assistedNeed =
    classifyAssistedNeed({
      assistedRate:
        metrics.assistedRate,
      assistEligibleCount:
        metrics.assistEligibleCount,
    });

  const recommendation =
    recommendNextSrtDifficulty({
      difficulty,
      accuracy:
        metrics.accuracy,
      unassistedAccuracy:
        metrics.unassistedAccuracy,
      missRate:
        metrics.missRate,
      clickedRottenRate:
        metrics.rottenClickRate,
      backgroundClickRate:
        metrics.backgroundClickRate,
      assistedRate:
        metrics.assistedRate,
      rtCV:
        metrics.rtCV,
      fatigueLevel,
      totalTrials:
        metrics.totalTrials,
      validRTCount:
        metrics.validRTCount,
      inhibitionDataSufficient:
        metrics.inhibitionDataSufficient,
      segmentDataSufficient:
        segmentAnalysis.dataSufficient,
    });

  const dataQuality = {
    totalTrials:
      metrics.totalTrials,
    validRTCount:
      metrics.validRTCount,
    anticipatoryNoiseCount:
      metrics.anticipatoryNoiseCount,
    segmentDataSufficient:
      segmentAnalysis.dataSufficient,
    inhibitionDataSufficient:
      metrics.inhibitionDataSufficient,
    rewardDataSufficient:
      metrics.rewardDataSufficient,
    recommendationDataSufficient:
      recommendation.dataSufficient,
  };

  const analysis = {
    gameId: "SRT",
    mode: "training",
    difficulty,
    displayDifficulty:
      getDisplayDifficulty(difficulty),
    totalTime,
    childProfile,
    metrics,
    segmentAnalysis,
    dataQuality,
    attentionLevel,
    impulseLevel,
    fatigueLevel,
    assistedNeed,
    recommendation,
    nextDifficulty:
      recommendation.nextDifficulty,
    action:
      recommendation.action,
    generatedAt:
      new Date().toISOString(),
  };

  return {
    ...analysis,
    parentSummary:
      generateSrtParentSummary(
        analysis
      ),
    clinicianSummary:
      generateSrtClinicianSummary(
        analysis
      ),
  };
};

export default analyzeSrtTraining;