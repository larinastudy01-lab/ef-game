// src/utils/cbtScoring.js

import analyzeCBTTraining, {
  detectCBTErrorPattern,
} from "../ai/cbtTrainingAnalyzer";

export const CBT_MICRO_DIFFICULTY_ORDER = [
  "veryEasy1",
  "veryEasy2",
  "veryEasy3",
  "easy1",
  "easy2",
  "easy3",
  "normal1",
  "normal2",
  "normal3",
  "advanced1",
  "advanced2",
  "advanced3",
  "hard1",
  "hard2",
  "hard3",
  "expert1",
  "expert2",
  "expert3",
];

const BASE_DIFFICULTY_ORDER = [
  "veryEasy",
  "easy",
  "normal",
  "advanced",
  "hard",
  "expert",
];

const DEFAULT_MODE = "training";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min = 0, max = 100) {
  const n = safeNumber(value, min);
  return Math.max(min, Math.min(max, n));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function roundNumber(value, digits = 0) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const factor = 10 ** Math.max(0, Math.floor(digits));
  return Math.round(n * factor) / factor;
}

function average(values) {
  const valid = safeArray(values)
    .map(Number)
    .filter(Number.isFinite);

  if (!valid.length) return null;
  return valid.reduce((sum, n) => sum + n, 0) / valid.length;
}

function standardDeviation(values) {
  const valid = safeArray(values)
    .map(Number)
    .filter(Number.isFinite);

  if (valid.length < 2) return null;

  const mean = average(valid);
  if (!Number.isFinite(mean)) return null;

  const variance =
    valid.reduce((sum, n) => sum + (n - mean) ** 2, 0) / valid.length;

  return Math.sqrt(variance);
}

function coefficientOfVariation(values) {
  const valid = safeArray(values)
    .map(Number)
    .filter(Number.isFinite);

  if (valid.length < 2) return null;

  const mean = average(valid);
  const sd = standardDeviation(valid);

  if (!Number.isFinite(mean) || mean <= 0 || !Number.isFinite(sd)) return null;
  return sd / mean;
}

function percentage(part, total) {
  const t = safeNumber(total, 0);
  if (t <= 0) return 0;
  return roundNumber((safeNumber(part, 0) / t) * 100, 0);
}

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "TRUE"
  );
}

export function normalizeBaseDifficultyKey(value) {
  if (value === null || value === undefined) return "normal";

  const raw = String(value).trim();
  if (!raw) return "normal";

  const key = raw.replace(/[-_\s]/g, "").toLowerCase();

  const aliases = {
    warmup: "veryEasy",
    veryeasy: "veryEasy",
    easy: "easy",
    normal: "normal",
    medium: "normal",
    advanced: "advanced",
    hard: "hard",
    expert: "expert",
  };

  if (aliases[key]) return aliases[key];

  const microMatch = key.match(
    /^(veryeasy|easy|normal|advanced|hard|expert)(1|2|3)$/
  );

  if (microMatch) {
    return microMatch[1] === "veryeasy" ? "veryEasy" : microMatch[1];
  }

  if (key.startsWith("veryeasy")) return "veryEasy";
  if (key.startsWith("easy")) return "easy";
  if (key.startsWith("normal")) return "normal";
  if (key.startsWith("advanced")) return "advanced";
  if (key.startsWith("hard")) return "hard";
  if (key.startsWith("expert")) return "expert";

  return "normal";
}

function getMicroDifficultyByOrder(order) {
  const index = clamp(
    Math.round(safeNumber(order, 8)) - 1,
    0,
    CBT_MICRO_DIFFICULTY_ORDER.length - 1
  );

  return CBT_MICRO_DIFFICULTY_ORDER[index];
}

export function normalizeMicroDifficultyKey(value) {
  if (value === null || value === undefined) return "normal2";

  const raw = String(value).trim();
  if (!raw) return "normal2";

  const numericOrder = Number(raw);
  if (Number.isFinite(numericOrder)) {
    return getMicroDifficultyByOrder(numericOrder);
  }

  const key = raw.replace(/[-_\s]/g, "").toLowerCase();

  const exact = CBT_MICRO_DIFFICULTY_ORDER.find(
    (item) => item.toLowerCase() === key
  );

  if (exact) return exact;

  const match = key.match(
    /^(veryeasy|easy|normal|advanced|hard|expert)(1|2|3)$/
  );

  if (match) {
    const base = match[1] === "veryeasy" ? "veryEasy" : match[1];
    const candidate = `${base}${match[2]}`;

    if (CBT_MICRO_DIFFICULTY_ORDER.includes(candidate)) {
      return candidate;
    }
  }

  const base = normalizeBaseDifficultyKey(raw);

  const defaultMicroByBase = {
    veryEasy: "veryEasy2",
    easy: "easy2",
    normal: "normal2",
    advanced: "advanced2",
    hard: "hard2",
    expert: "expert2",
  };

  return defaultMicroByBase[base] || "normal2";
}

function getBaseFromMicroDifficulty(microDifficultyKey) {
  return normalizeBaseDifficultyKey(microDifficultyKey);
}

function getDifficultyLabel(difficultyKey) {
  const labels = {
    veryEasy: "暖身",
    easy: "基礎",
    normal: "穩定",
    advanced: "進階",
    hard: "挑戰",
    expert: "高挑戰",
  };

  return labels[normalizeBaseDifficultyKey(difficultyKey)] || "穩定";
}

function getMicroDifficultyLabel(microDifficultyKey) {
  const key = normalizeMicroDifficultyKey(microDifficultyKey);
  const base = getBaseFromMicroDifficulty(key);
  const phase = key.match(/(1|2|3)$/)?.[1] || "2";

  const phaseLabels = {
    1: "前段",
    2: "中段",
    3: "後段",
  };

  return `${getDifficultyLabel(base)}-${phaseLabels[phase]}`;
}

function getDifficultyOrder(difficultyKey) {
  const key = normalizeBaseDifficultyKey(difficultyKey);
  const index = BASE_DIFFICULTY_ORDER.indexOf(key);
  return index >= 0 ? index + 1 : 3;
}

function getMicroDifficultyOrder(microDifficultyKey) {
  const key = normalizeMicroDifficultyKey(microDifficultyKey);
  const index = CBT_MICRO_DIFFICULTY_ORDER.indexOf(key);
  return index >= 0 ? index + 1 : 8;
}

export function getExpectedSpanByMicroDifficulty(microDifficultyKey) {
  const expected = {
    veryEasy1: 2,
    veryEasy2: 2,
    veryEasy3: 2,
    easy1: 2,
    easy2: 3,
    easy3: 3,
    normal1: 3,
    normal2: 4,
    normal3: 4,
    advanced1: 4,
    advanced2: 5,
    advanced3: 5,
    hard1: 5,
    hard2: 6,
    hard3: 6,
    expert1: 6,
    expert2: 7,
    expert3: 7,
  };

  return expected[normalizeMicroDifficultyKey(microDifficultyKey)] || 4;
}

function getFirstMismatchIndex(targetSequence = [], userSequence = []) {
  const target = safeArray(targetSequence);
  const user = safeArray(userSequence);
  const maxLength = Math.max(target.length, user.length);

  if (maxLength === 0) return null;

  for (let i = 0; i < maxLength; i += 1) {
    if (target[i] !== user[i]) return i;
  }

  return null;
}

function getSequenceMatchRate(targetSequence = [], userSequence = []) {
  const target = safeArray(targetSequence);
  const user = safeArray(userSequence);

  if (!target.length) return 0;

  let matched = 0;
  const compareLength = Math.min(target.length, user.length);

  for (let i = 0; i < compareLength; i += 1) {
    if (target[i] === user[i]) matched += 1;
  }

  return matched / target.length;
}

function normalizeAttemptType(record = {}) {
  const raw =
    record.attemptType ||
    record.tryType ||
    record.responseType ||
    record.completionType ||
    null;

  if (typeof raw === "string") {
    const key = raw.trim().replace(/[-_\s]/g, "").toLowerCase();

    if (["firsttry", "first", "initial", "normal"].includes(key)) {
      return "firstTry";
    }

    if (["replay", "afterreplay", "withreplay"].includes(key)) {
      return "replay";
    }

    if (["rescue", "retry", "afterrescue", "secondtry"].includes(key)) {
      return "rescue";
    }
  }

  if (toBoolean(record.wasRescued) || toBoolean(record.rescueUsed)) {
    return "rescue";
  }

  if (
    toBoolean(record.usedReplay) ||
    safeNumber(record.replayCount, 0) > 0
  ) {
    return "replay";
  }

  return "firstTry";
}

function getWeightedCorrectValue(record = {}) {
  if (!record.isCorrect) return 0;
  if (record.cleanCorrect) return 1;
  if (record.rescueCorrect) return 0.55;
  if (record.attemptType === "replay") return 0.7;
  if (record.attemptType === "rescue") return 0.5;

  if (
    record.usedReplay ||
    record.usedHint ||
    record.idleHintShown ||
    record.wasRescued ||
    record.supportWasUsed
  ) {
    return 0.75;
  }

  return 1;
}

export function normalizeRecord(record = {}, fallbackMode = DEFAULT_MODE) {
  const targetSequence =
    safeArray(record.targetSequence).length > 0
      ? safeArray(record.targetSequence)
      : safeArray(record.correctSequence).length > 0
      ? safeArray(record.correctSequence)
      : safeArray(record.sequence);

  const userSequence =
    safeArray(record.userSequence).length > 0
      ? safeArray(record.userSequence)
      : safeArray(record.clickedSequence).length > 0
      ? safeArray(record.clickedSequence)
      : safeArray(record.selectedSequence).length > 0
      ? safeArray(record.selectedSequence)
      : safeArray(record.inputSequence);

  const sequenceLength = Math.max(
    0,
    safeNumber(
      record.length ??
        record.sequenceLength ??
        record.memoryLength ??
        record.memorySpan ??
        record.targetLength ??
        targetSequence.length,
      0
    )
  );

  const isTimeout =
    toBoolean(record.isTimeout) ||
    toBoolean(record.timeout) ||
    record.errorType === "timeout";

  const rawCorrect =
    toBoolean(record.isCorrect) ||
    toBoolean(record.correct) ||
    toBoolean(record.cleanCorrect) ||
    toBoolean(record.rescueCorrect);

  const replayCount = safeNumber(
    record.replayCount,
    toBoolean(record.usedReplay) || toBoolean(record.replayUsed) ? 1 : 0
  );

  const usedReplay =
    toBoolean(record.usedReplay) ||
    toBoolean(record.replayUsed) ||
    replayCount > 0;

  const usedHint =
    toBoolean(record.usedHint) ||
    toBoolean(record.hintUsed) ||
    toBoolean(record.usedSupport);

  const idleHintShown = toBoolean(record.idleHintShown);
  const idleHintCount = Math.max(
    0,
    safeNumber(record.idleHintCount, idleHintShown ? 1 : 0)
  );

  const wasRescued =
    toBoolean(record.wasRescued) ||
    toBoolean(record.rescueUsed) ||
    toBoolean(record.usedRescue) ||
    toBoolean(record.isRescueAttempt);

  const rescueCorrect = toBoolean(record.rescueCorrect);
  const rescueFailed = toBoolean(record.rescueFailed);

  const hintLevel = Number.isFinite(Number(record.hintLevel))
    ? clamp(Number(record.hintLevel), 0, 3)
    : toBoolean(record.hintAvailable) ||
      toBoolean(record.hasHint) ||
      toBoolean(record.hint)
    ? 2
    : 0;

  const hintAvailable =
    hintLevel > 0 ||
    toBoolean(record.hintAvailable) ||
    toBoolean(record.hasHint) ||
    toBoolean(record.hint);

  const supportWasUsed =
    usedReplay || usedHint || idleHintShown || wasRescued || rescueCorrect;

  const attemptType = normalizeAttemptType({
    ...record,
    replayCount,
    usedReplay,
    wasRescued,
  });

  const reactionTime = Number.isFinite(
    Number(record.reactionTime ?? record.answerTime ?? record.responseTime)
  )
    ? Number(record.reactionTime ?? record.answerTime ?? record.responseTime)
    : null;

  const firstTapTime = Number.isFinite(Number(record.firstTapTime))
    ? Number(record.firstTapTime)
    : null;

  const averageTapInterval = Number.isFinite(Number(record.averageTapInterval))
    ? Number(record.averageTapInterval)
    : null;

  const errorIndex = Number.isFinite(Number(record.errorIndex))
    ? Number(record.errorIndex)
    : Number.isFinite(Number(record.firstErrorPosition))
    ? Number(record.firstErrorPosition)
    : getFirstMismatchIndex(targetSequence, userSequence);

  const microDifficultyKey = normalizeMicroDifficultyKey(
    record.microDifficultyKey ||
      record.microDifficulty ||
      record.difficultyKey ||
      record.difficulty ||
      record.modeDifficulty ||
      "normal2"
  );

  const difficultyKey = normalizeBaseDifficultyKey(
    record.difficultyKey ||
      record.difficulty ||
      record.modeDifficulty ||
      getBaseFromMicroDifficulty(microDifficultyKey)
  );

  const cleanCorrect =
    rawCorrect &&
    !isTimeout &&
    !usedReplay &&
    !usedHint &&
    !idleHintShown &&
    !wasRescued &&
    !rescueCorrect &&
    attemptType === "firstTry";

  const mode = record.mode || record.resultType || fallbackMode || DEFAULT_MODE;

  const normalizedBase = {
    ...record,

    mode,
    resultType: record.resultType || mode,

    isCorrect: rawCorrect,
    correct: rawCorrect,

    isTimeout,
    timeout: isTimeout,

    sequenceLength,
    length: sequenceLength,
    memorySpan: sequenceLength,

    targetLength: Math.max(0, safeNumber(record.targetLength, sequenceLength)),
    inputLength: Math.max(0, safeNumber(record.inputLength, userSequence.length)),

    targetSequence,
    userSequence,

    reactionTime,
    firstTapTime,
    averageTapInterval,

    errorIndex,
    firstErrorPosition: errorIndex,

    replayCount: Math.max(0, replayCount),
    usedReplay,

    hintLevel,
    hintAvailable,
    usedHint,

    idleHintShown,
    idleHintCount,
    idleBeforeFirstTapMs: Number.isFinite(Number(record.idleBeforeFirstTapMs))
      ? Number(record.idleBeforeFirstTapMs)
      : null,

    supportWasUsed,

    wasRescued,
    rescueUsed: wasRescued,
    rescueCorrect,
    rescueFailed,

    cleanCorrect,

    attemptType,

    spatialSimilarity: record.spatialSimilarity || null,
    pathComplexity: record.pathComplexity || null,
    reverseMode: toBoolean(record.reverseMode),
    distractorEnabled: toBoolean(record.distractorEnabled),
    distractorCount: Math.max(0, safeNumber(record.distractorCount, 0)),

    difficultyKey,
    difficulty: difficultyKey,
    difficultyLabel: record.difficultyLabel || getDifficultyLabel(difficultyKey),

    microDifficultyKey,
    microDifficulty: microDifficultyKey,
    microDifficultyLabel:
      record.microDifficultyLabel || getMicroDifficultyLabel(microDifficultyKey),

    difficultyOrder: getDifficultyOrder(difficultyKey),
    microDifficultyOrder: getMicroDifficultyOrder(microDifficultyKey),
  };

  const errorPattern =
    record.errorPattern ||
    record.errorType ||
    detectCBTErrorPattern(normalizedBase);

  const weightedCorrectValue = getWeightedCorrectValue({
    ...normalizedBase,
    errorPattern,
  });

  return {
    ...normalizedBase,
    errorPattern,
    weightedCorrectValue,
  };
}

export function getCBTBasicStats(inputHistory = [], options = {}) {
  const mode = options.mode || DEFAULT_MODE;
  const history = safeArray(inputHistory).map((record) =>
    normalizeRecord(record, mode)
  );

  if (!history.length) {
    return {
      totalTrials: 0,
      correctCount: 0,
      wrongCount: 0,
      timeoutCount: 0,

      rawAccuracyRate: 0,
      accuracyRate: 0,
      accuracy: 0,
      accuracyPercent: 0,

      weightedAccuracyRate: 0,
      weightedAccuracyPercent: 0,

      firstTryCorrectCount: 0,
      firstTryAccuracyRate: 0,
      firstTryAccuracyPercent: 0,

      cleanCorrectCount: 0,
      cleanAccuracyRate: 0,
      cleanAccuracyPercent: 0,

      rescueTrialCount: 0,
      rescueSuccessCount: 0,
      rescueRate: 0,
      rescueSuccessRate: 0,

      rawSpan: 0,
      span: 0,
      memorySpan: 0,
      independentSpan: 0,
      assistedSpan: 0,
      effectiveSpan: 0,
      maxAttemptedLength: 0,

      averageReactionTime: null,
      averageCorrectReactionTime: null,
      averageWrongReactionTime: null,
      reactionTimeStd: null,
      reactionTimeCv: null,
      validReactionTimeCount: 0,

      averageSequenceMatchRate: 0,
      sequenceMatchPercent: 0,

      firstErrorAvgIndex: null,
      earlyErrorCount: 0,
      lateErrorCount: 0,

      totalReplayCount: 0,
      replayTrialCount: 0,
      replayRate: 0,
      averageReplayCount: 0,

      hintAvailableCount: 0,
      usedHintCount: 0,
      hintUseRate: 0,
      averageHintLevel: 0,

      idleHintShownCount: 0,
      totalIdleHintCount: 0,
      idleHintRate: 0,
      averageIdleBeforeFirstTapMs: null,
      averageFirstTapTime: null,
      averageTapInterval: null,

      errorPatternCounts: {},
      locationErrorCount: 0,
      orderErrorCount: 0,
      omissionErrorCount: 0,
      extraTapErrorCount: 0,
      timeoutErrorCount: 0,

      locationErrorRate: 0,
      orderErrorRate: 0,
      omissionErrorRate: 0,
      extraTapErrorRate: 0,

      firstHalfAccuracy: 0,
      secondHalfAccuracy: 0,
      fatigueDrop: 0,
      fatigueRisk: "low",

      spatialSimilarityCounts: {},
      pathComplexityCounts: {},
      reverseModeCount: 0,
      distractorTrialCount: 0,
      averageDistractorCount: 0,

      dominantDifficultyKey: "normal",
      dominantDifficultyLabel: "穩定",
      highestDifficultyKey: "normal",
      highestDifficultyLabel: "穩定",
      averageDifficultyOrder: 3,

      dominantMicroDifficultyKey: "normal2",
      dominantMicroDifficultyLabel: "穩定-中段",
      highestMicroDifficultyKey: "normal2",
      highestMicroDifficultyLabel: "穩定-中段",
      finalMicroDifficultyKey: "normal2",
      finalMicroDifficultyLabel: "穩定-中段",
      averageMicroDifficultyOrder: 8,
    };
  }

  const correctRecords = history.filter((r) => r.isCorrect);
  const wrongRecords = history.filter((r) => !r.isCorrect && !r.isTimeout);
  const timeoutRecords = history.filter((r) => r.isTimeout);

  const correctCount = correctRecords.length;
  const wrongCount = wrongRecords.length;
  const timeoutCount = timeoutRecords.length;

  const weightedCorrectSum = history.reduce(
    (sum, r) => sum + safeNumber(r.weightedCorrectValue, 0),
    0
  );

  const rawAccuracyRate = correctCount / history.length;
  const weightedAccuracyRate = weightedCorrectSum / history.length;

  const cleanCorrectCount = history.filter((r) => r.cleanCorrect).length;
  const cleanAccuracyRate = cleanCorrectCount / history.length;

  const firstTryCorrectCount = history.filter(
    (r) =>
      r.isCorrect &&
      r.attemptType === "firstTry" &&
      r.replayCount === 0 &&
      !r.usedReplay &&
      !r.usedHint &&
      !r.idleHintShown &&
      !r.wasRescued &&
      !r.supportWasUsed
  ).length;

  const firstTryAccuracyRate = firstTryCorrectCount / history.length;

  const rescueTrialCount = history.filter(
    (r) => r.wasRescued || r.rescueCorrect || r.attemptType === "rescue"
  ).length;

  const rescueSuccessCount = history.filter(
    (r) =>
      (r.wasRescued || r.rescueCorrect || r.attemptType === "rescue") &&
      r.isCorrect
  ).length;

  const rescueRate = rescueTrialCount / history.length;
  const rescueSuccessRate =
    rescueTrialCount > 0 ? rescueSuccessCount / rescueTrialCount : 0;

  const rawSpan = correctRecords.length
    ? Math.max(...correctRecords.map((r) => r.sequenceLength || 0))
    : 0;

  const independentCorrectRecords = correctRecords.filter((r) => r.cleanCorrect);

  const assistedCorrectRecords = correctRecords.filter(
    (r) =>
      r.supportWasUsed ||
      r.replayCount > 0 ||
      r.usedReplay ||
      r.usedHint ||
      r.idleHintShown ||
      r.wasRescued ||
      r.rescueCorrect ||
      r.attemptType === "replay" ||
      r.attemptType === "rescue"
  );

  const independentSpan = independentCorrectRecords.length
    ? Math.max(...independentCorrectRecords.map((r) => r.sequenceLength || 0))
    : 0;

  const assistedSpan = assistedCorrectRecords.length
    ? Math.max(...assistedCorrectRecords.map((r) => r.sequenceLength || 0))
    : 0;

  const effectiveSpan = roundNumber(
    Math.max(
      independentSpan,
      independentSpan + Math.max(0, assistedSpan - independentSpan) * 0.5
    ),
    1
  );

  const maxAttemptedLength = Math.max(
    ...history.map((r) => r.sequenceLength || 0)
  );

  const validRtRecords = history.filter((r) =>
    Number.isFinite(Number(r.reactionTime))
  );
  const validCorrectRtRecords = correctRecords.filter((r) =>
    Number.isFinite(Number(r.reactionTime))
  );
  const validWrongRtRecords = wrongRecords.filter((r) =>
    Number.isFinite(Number(r.reactionTime))
  );

  const reactionTimes = validRtRecords.map((r) => r.reactionTime);
  const correctReactionTimes = validCorrectRtRecords.map((r) => r.reactionTime);
  const wrongReactionTimes = validWrongRtRecords.map((r) => r.reactionTime);

  const sequenceMatchRates = history.map((r) =>
    r.isCorrect ? 1 : getSequenceMatchRate(r.targetSequence, r.userSequence)
  );

  const averageSequenceMatchRate = average(sequenceMatchRates) ?? 0;

  const errorIndexes = wrongRecords
    .map((r) => r.errorIndex)
    .filter((v) => typeof v === "number" && Number.isFinite(v));

  const firstErrorAvgIndex = roundNumber(average(errorIndexes), 1);

  const earlyErrorCount = wrongRecords.filter((r) => {
    if (typeof r.errorIndex !== "number") return false;
    const len = r.sequenceLength || 1;
    return r.errorIndex < Math.floor(len / 2);
  }).length;

  const lateErrorCount = wrongRecords.filter((r) => {
    if (typeof r.errorIndex !== "number") return false;
    const len = r.sequenceLength || 1;
    return r.errorIndex >= Math.floor(len / 2);
  }).length;

  const totalReplayCount = history.reduce(
    (sum, r) => sum + safeNumber(r.replayCount, 0),
    0
  );

  const replayTrialCount = history.filter((r) => r.usedReplay).length;
  const replayRate = replayTrialCount / history.length;
  const averageReplayCount = totalReplayCount / history.length;

  const hintAvailableCount = history.filter((r) => r.hintAvailable).length;
  const usedHintCount = history.filter((r) => r.usedHint).length;
  const hintUseRate =
    hintAvailableCount > 0 ? usedHintCount / hintAvailableCount : 0;
  const averageHintLevel = average(history.map((r) => r.hintLevel)) ?? 0;

  const idleHintShownCount = history.filter((r) => r.idleHintShown).length;
  const totalIdleHintCount = history.reduce(
    (sum, r) => sum + safeNumber(r.idleHintCount, 0),
    0
  );
  const idleHintRate = idleHintShownCount / history.length;

  const idleBeforeFirstTapValues = history
    .map((r) => r.idleBeforeFirstTapMs)
    .filter((v) => Number.isFinite(Number(v)));

  const firstTapTimes = history
    .map((r) => r.firstTapTime)
    .filter((v) => Number.isFinite(Number(v)));

  const averageTapIntervals = history
    .map((r) => r.averageTapInterval)
    .filter((v) => Number.isFinite(Number(v)));

  const errorPatternCounts = history.reduce((acc, r) => {
    const key = r.errorPattern || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const locationErrorCount = wrongRecords.filter(
    (r) => r.errorPattern === "location_error"
  ).length;

  const orderErrorCount = wrongRecords.filter(
    (r) => r.errorPattern === "order_error"
  ).length;

  const omissionErrorCount = wrongRecords.filter(
    (r) => r.errorPattern === "omission_error"
  ).length;

  const extraTapErrorCount = wrongRecords.filter(
    (r) => r.errorPattern === "extra_tap_error"
  ).length;

  const timeoutErrorCount = timeoutRecords.length;

  const locationErrorRate = wrongRecords.length
    ? locationErrorCount / wrongRecords.length
    : 0;

  const orderErrorRate = wrongRecords.length
    ? orderErrorCount / wrongRecords.length
    : 0;

  const omissionErrorRate = wrongRecords.length
    ? omissionErrorCount / wrongRecords.length
    : 0;

  const extraTapErrorRate = wrongRecords.length
    ? extraTapErrorCount / wrongRecords.length
    : 0;

  const halfIndex = Math.ceil(history.length / 2);
  const firstHalf = history.slice(0, halfIndex);
  const secondHalf = history.slice(halfIndex);

  const firstHalfAccuracy = firstHalf.length
    ? firstHalf.filter((r) => r.isCorrect).length / firstHalf.length
    : 0;

  const secondHalfAccuracy = secondHalf.length
    ? secondHalf.filter((r) => r.isCorrect).length / secondHalf.length
    : firstHalfAccuracy;

  const fatigueDrop = Math.max(0, firstHalfAccuracy - secondHalfAccuracy);
  const fatigueRisk =
    fatigueDrop >= 0.4 ? "high" : fatigueDrop >= 0.25 ? "medium" : "low";

  const spatialSimilarityCounts = history.reduce((acc, r) => {
    if (!r.spatialSimilarity) return acc;
    acc[r.spatialSimilarity] = (acc[r.spatialSimilarity] || 0) + 1;
    return acc;
  }, {});

  const pathComplexityCounts = history.reduce((acc, r) => {
    if (!r.pathComplexity) return acc;
    acc[r.pathComplexity] = (acc[r.pathComplexity] || 0) + 1;
    return acc;
  }, {});

  const reverseModeCount = history.filter((r) => r.reverseMode).length;
  const distractorTrialCount = history.filter((r) => r.distractorEnabled).length;
  const averageDistractorCount =
    average(history.map((r) => r.distractorCount)) ?? 0;

  const difficultyCounts = history.reduce((acc, r) => {
    const key = normalizeBaseDifficultyKey(r.difficultyKey);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const dominantDifficultyKey =
    Object.entries(difficultyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "normal";

  const highestDifficultyKey =
    history
      .map((r) => normalizeBaseDifficultyKey(r.difficultyKey))
      .sort((a, b) => getDifficultyOrder(b) - getDifficultyOrder(a))[0] ||
    "normal";

  const averageDifficultyOrder =
    average(history.map((r) => getDifficultyOrder(r.difficultyKey))) ?? 3;

  const microDifficultyCounts = history.reduce((acc, r) => {
    const key = normalizeMicroDifficultyKey(r.microDifficultyKey);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const dominantMicroDifficultyKey =
    Object.entries(microDifficultyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "normal2";

  const highestMicroDifficultyKey =
    history
      .map((r) => normalizeMicroDifficultyKey(r.microDifficultyKey))
      .sort(
        (a, b) => getMicroDifficultyOrder(b) - getMicroDifficultyOrder(a)
      )[0] || "normal2";

  const finalMicroDifficultyKey = normalizeMicroDifficultyKey(
    history[history.length - 1]?.microDifficultyKey || "normal2"
  );

  const averageMicroDifficultyOrder =
    average(history.map((r) => getMicroDifficultyOrder(r.microDifficultyKey))) ??
    8;

  return {
    totalTrials: history.length,
    correctCount,
    wrongCount,
    timeoutCount,

    rawAccuracyRate: roundNumber(rawAccuracyRate, 2),
    accuracyRate: roundNumber(rawAccuracyRate, 2),
    accuracy: roundNumber(rawAccuracyRate, 2),
    accuracyPercent: percentage(correctCount, history.length),

    weightedAccuracyRate: roundNumber(weightedAccuracyRate, 2),
    weightedAccuracyPercent: roundNumber(weightedAccuracyRate * 100, 0),

    firstTryCorrectCount,
    firstTryAccuracyRate: roundNumber(firstTryAccuracyRate, 2),
    firstTryAccuracyPercent: roundNumber(firstTryAccuracyRate * 100, 0),

    cleanCorrectCount,
    cleanAccuracyRate: roundNumber(cleanAccuracyRate, 2),
    cleanAccuracyPercent: roundNumber(cleanAccuracyRate * 100, 0),

    rescueTrialCount,
    rescueSuccessCount,
    rescueRate: roundNumber(rescueRate, 2),
    rescueSuccessRate: roundNumber(rescueSuccessRate, 2),

    rawSpan,
    span: rawSpan,
    memorySpan: rawSpan,
    independentSpan,
    assistedSpan,
    effectiveSpan,
    maxAttemptedLength,

    averageReactionTime: roundNumber(average(reactionTimes), 0),
    averageCorrectReactionTime: roundNumber(average(correctReactionTimes), 0),
    averageWrongReactionTime: roundNumber(average(wrongReactionTimes), 0),
    reactionTimeStd: roundNumber(standardDeviation(reactionTimes), 0),
    reactionTimeCv: roundNumber(coefficientOfVariation(reactionTimes), 2),
    validReactionTimeCount: validRtRecords.length,

    averageSequenceMatchRate: roundNumber(averageSequenceMatchRate, 2),
    sequenceMatchPercent: roundNumber(averageSequenceMatchRate * 100, 0),

    firstErrorAvgIndex,
    earlyErrorCount,
    lateErrorCount,

    totalReplayCount,
    replayTrialCount,
    replayRate: roundNumber(replayRate, 2),
    averageReplayCount: roundNumber(averageReplayCount, 2),

    hintAvailableCount,
    usedHintCount,
    hintUseRate: roundNumber(hintUseRate, 2),
    averageHintLevel: roundNumber(averageHintLevel, 1),

    idleHintShownCount,
    totalIdleHintCount,
    idleHintRate: roundNumber(idleHintRate, 2),
    averageIdleBeforeFirstTapMs: roundNumber(average(idleBeforeFirstTapValues), 0),
    averageFirstTapTime: roundNumber(average(firstTapTimes), 0),
    averageTapInterval: roundNumber(average(averageTapIntervals), 0),

    errorPatternCounts,
    locationErrorCount,
    orderErrorCount,
    omissionErrorCount,
    extraTapErrorCount,
    timeoutErrorCount,
    locationErrorRate: roundNumber(locationErrorRate, 2),
    orderErrorRate: roundNumber(orderErrorRate, 2),
    omissionErrorRate: roundNumber(omissionErrorRate, 2),
    extraTapErrorRate: roundNumber(extraTapErrorRate, 2),

    firstHalfAccuracy: roundNumber(firstHalfAccuracy, 2),
    secondHalfAccuracy: roundNumber(secondHalfAccuracy, 2),
    fatigueDrop: roundNumber(fatigueDrop, 2),
    fatigueRisk,

    spatialSimilarityCounts,
    pathComplexityCounts,
    reverseModeCount,
    distractorTrialCount,
    averageDistractorCount: roundNumber(averageDistractorCount, 1),

    dominantDifficultyKey,
    dominantDifficultyLabel: getDifficultyLabel(dominantDifficultyKey),
    highestDifficultyKey,
    highestDifficultyLabel: getDifficultyLabel(highestDifficultyKey),
    averageDifficultyOrder: roundNumber(averageDifficultyOrder, 1),

    dominantMicroDifficultyKey,
    dominantMicroDifficultyLabel: getMicroDifficultyLabel(dominantMicroDifficultyKey),
    highestMicroDifficultyKey,
    highestMicroDifficultyLabel: getMicroDifficultyLabel(highestMicroDifficultyKey),
    finalMicroDifficultyKey,
    finalMicroDifficultyLabel: getMicroDifficultyLabel(finalMicroDifficultyKey),
    averageMicroDifficultyOrder: roundNumber(averageMicroDifficultyOrder, 1),
  };
}

function getSpanScore({
  effectiveSpan,
  independentSpan,
  assistedSpan,
  averageMicroDifficultyOrder,
}) {
  const spanValue = safeNumber(effectiveSpan, 0);

  let baseScore = 0;

  if (spanValue >= 7) baseScore = 30;
  else if (spanValue >= 6.5) baseScore = 28;
  else if (spanValue >= 6) baseScore = 26;
  else if (spanValue >= 5.5) baseScore = 24;
  else if (spanValue >= 5) baseScore = 22;
  else if (spanValue >= 4.5) baseScore = 19;
  else if (spanValue >= 4) baseScore = 17;
  else if (spanValue >= 3.5) baseScore = 14;
  else if (spanValue >= 3) baseScore = 12;
  else if (spanValue >= 2.5) baseScore = 9;
  else if (spanValue >= 2) baseScore = 7;
  else if (spanValue >= 1) baseScore = 4;

  const independentBonus =
    independentSpan >= 6 ? 2 : independentSpan >= 5 ? 1 : 0;

  const assistedPenalty = assistedSpan > independentSpan ? 1 : 0;

  const difficultyBonus =
    averageMicroDifficultyOrder >= 15
      ? 2
      : averageMicroDifficultyOrder >= 12
      ? 1
      : 0;

  return clamp(
    baseScore + independentBonus + difficultyBonus - assistedPenalty,
    0,
    30
  );
}

function getWeightedAccuracyScore(weightedAccuracyRate) {
  return roundNumber(clamp01(weightedAccuracyRate) * 25, 0);
}

function getSequenceScore(sequenceMatchPercent) {
  const score = safeNumber(sequenceMatchPercent, 0);

  if (score >= 90) return 15;
  if (score >= 75) return 12;
  if (score >= 60) return 9;
  if (score >= 40) return 6;
  if (score >= 20) return 3;

  return 0;
}

function getSpeedScore(avgCorrectReactionTime) {
  if (!Number.isFinite(Number(avgCorrectReactionTime))) return 0;

  const rt = Number(avgCorrectReactionTime);

  if (rt <= 2500) return 5;
  if (rt <= 4000) return 4;
  if (rt <= 6000) return 3;
  if (rt <= 8000) return 2;

  return 1;
}

function getStabilityScore({
  reactionTimeStd,
  timeoutRate,
  fatigueDrop,
  earlyErrorCount,
  wrongCount,
}) {
  let score = 10;

  if (reactionTimeStd === null || reactionTimeStd === undefined) {
    score -= 2;
  } else if (reactionTimeStd > 4500) {
    score -= 5;
  } else if (reactionTimeStd > 3000) {
    score -= 3;
  } else if (reactionTimeStd > 1800) {
    score -= 1;
  }

  if (timeoutRate >= 0.5) score -= 4;
  else if (timeoutRate >= 0.3) score -= 2;
  else if (timeoutRate >= 0.15) score -= 1;

  if (fatigueDrop >= 0.4) score -= 4;
  else if (fatigueDrop >= 0.25) score -= 2;

  if (wrongCount > 0 && earlyErrorCount / wrongCount >= 0.5) {
    score -= 2;
  }

  return clamp(score, 0, 10);
}

function getIndependenceScore({
  totalTrials,
  totalReplayCount,
  replayTrialCount,
  usedHintCount,
  idleHintShownCount,
  rescueTrialCount,
  firstTryAccuracyRate,
}) {
  if (!totalTrials || totalTrials <= 0) return 0;

  const replayRate = replayTrialCount / totalTrials;
  const averageReplayCount = totalReplayCount / totalTrials;
  const hintRate = usedHintCount / totalTrials;
  const idleHintRate = idleHintShownCount / totalTrials;
  const rescueRate = rescueTrialCount / totalTrials;

  let score = 15;

  if (averageReplayCount >= 1.5) score -= 5;
  else if (averageReplayCount >= 1) score -= 4;
  else if (averageReplayCount >= 0.5) score -= 2;
  else if (averageReplayCount > 0) score -= 1;

  if (replayRate >= 0.6) score -= 3;
  else if (replayRate >= 0.35) score -= 2;
  else if (replayRate >= 0.15) score -= 1;

  if (hintRate >= 0.6) score -= 3;
  else if (hintRate >= 0.3) score -= 2;
  else if (hintRate > 0) score -= 1;

  if (idleHintRate >= 0.6) score -= 3;
  else if (idleHintRate >= 0.35) score -= 2;
  else if (idleHintRate > 0) score -= 1;

  if (rescueRate >= 0.5) score -= 4;
  else if (rescueRate >= 0.3) score -= 3;
  else if (rescueRate >= 0.15) score -= 1;

  if (firstTryAccuracyRate >= 0.85) score += 1;
  else if (firstTryAccuracyRate < 0.4) score -= 2;

  return clamp(score, 0, 15);
}

function getDifficultyStarCapByMicroDifficulty(microDifficultyKey, mode) {
  const key = normalizeMicroDifficultyKey(microDifficultyKey);

  if (mode === "test") return 3;
  if (key === "veryEasy1" || key === "veryEasy2") return 2;

  return 3;
}

function getStarRating({
  mode,
  totalTrials,
  totalScore,
  weightedAccuracyRate,
  accuracyPercent,
  independentSpan,
  rawSpan,
  timeoutRate,
  totalReplayCount,
  replayTrialCount,
  rescueTrialCount,
  dominantMicroDifficultyKey,
  averageMicroDifficultyOrder,
  idleHintRate,
}) {
  if (!totalTrials || totalTrials <= 0) return 0;

  const averageKey = getMicroDifficultyByOrder(averageMicroDifficultyOrder);
  const dominantKey = normalizeMicroDifficultyKey(dominantMicroDifficultyKey);
  const expectedSpan = getExpectedSpanByMicroDifficulty(averageKey);

  const replayRate = totalTrials > 0 ? replayTrialCount / totalTrials : 0;
  const averageReplayCount = totalTrials > 0 ? totalReplayCount / totalTrials : 0;
  const rescueRate = totalTrials > 0 ? rescueTrialCount / totalTrials : 0;

  const isTraining = mode !== "test";

  let stars = 1;

  const threeStarScore = isTraining ? 82 : 85;
  const twoStarScore = isTraining ? 55 : 60;
  const twoStarAccuracy = isTraining ? 50 : 55;

  if (
    totalScore >= threeStarScore &&
    weightedAccuracyRate >= 0.8 &&
    accuracyPercent >= 80 &&
    independentSpan >= expectedSpan &&
    timeoutRate < 0.2 &&
    replayRate <= 0.35 &&
    averageReplayCount <= 0.4 &&
    rescueRate <= 0.25 &&
    idleHintRate <= 0.35
  ) {
    stars = 3;
  } else if (
    totalScore >= twoStarScore &&
    weightedAccuracyRate >= 0.55 &&
    accuracyPercent >= twoStarAccuracy &&
    rawSpan >= Math.max(2, expectedSpan - 1)
  ) {
    stars = 2;
  }

  if (stars === 3 && independentSpan < expectedSpan) stars = 2;
  if (stars === 3 && rescueRate > 0.25) stars = 2;
  if (stars === 3 && averageReplayCount > 0.6) stars = 2;
  if (stars === 3 && idleHintRate > 0.4) stars = 2;
  if (stars === 2 && weightedAccuracyRate < 0.5) stars = 1;

  return Math.min(
    stars,
    getDifficultyStarCapByMicroDifficulty(dominantKey, mode)
  );
}

function getChildMessage(stars) {
  if (stars === 3) return "太棒了！你記住了石頭路線，而且可以自己完成！";
  if (stars === 2) return "做得很好！你已經能記住石頭路線了，再練習會更厲害！";
  if (stars === 1) return "沒關係！我們先從短一點的石頭路線開始練習！";
  return "目前還沒有足夠資料，完成練習後就可以看到結果。";
}

function getSpanLevel({ independentSpan, assistedSpan }) {
  if (independentSpan >= 6) return "可獨立記住較長路線";
  if (independentSpan >= 4) return "可獨立記住中等路線";
  if (independentSpan >= 2 && assistedSpan > independentSpan) {
    return "短路線可獨立完成，長一點需要提示";
  }
  if (assistedSpan >= 4) return "在提示下可完成中等路線";
  if (assistedSpan >= 2) return "適合短路線練習";
  return "需要先熟悉玩法";
}

function getAccuracyLevel(weightedAccuracyPercent) {
  if (weightedAccuracyPercent >= 85) return "完成度高";
  if (weightedAccuracyPercent >= 60) return "完成度尚可";
  return "需要更多練習";
}

function getSequenceLevel(sequenceMatchPercent) {
  if (sequenceMatchPercent >= 85) return "路線順序穩定";
  if (sequenceMatchPercent >= 60) return "偶爾會順序混淆";
  return "容易忘記或點錯順序";
}

function getSpeedLevel(avgCorrectReactionTime) {
  if (avgCorrectReactionTime === null) return "資料不足";
  if (avgCorrectReactionTime <= 3000) return "作答快速";
  if (avgCorrectReactionTime <= 6000) return "作答穩定";
  return "需要較多時間回想";
}

function getStabilityLevel({ reactionTimeStd, fatigueDrop }) {
  if (fatigueDrop >= 0.3) return "後半段有下降";
  if (reactionTimeStd === null) return "資料不足";
  if (reactionTimeStd <= 1500) return "很穩定";
  if (reactionTimeStd <= 3000) return "略有波動";
  return "波動較明顯";
}

function getIndependenceLevel({
  totalTrials,
  totalReplayCount,
  replayTrialCount,
  rescueTrialCount,
  idleHintShownCount,
  firstTryAccuracyRate,
}) {
  if (!totalTrials || totalTrials <= 0) return "資料不足";

  const replayRate = replayTrialCount / totalTrials;
  const averageReplayCount = totalReplayCount / totalTrials;
  const rescueRate = rescueTrialCount / totalTrials;
  const idleHintRate = idleHintShownCount / totalTrials;

  if (
    replayRate === 0 &&
    averageReplayCount === 0 &&
    rescueRate === 0 &&
    idleHintRate === 0 &&
    firstTryAccuracyRate >= 0.8
  ) {
    return "可獨立完成";
  }

  if (
    averageReplayCount <= 0.4 &&
    replayRate <= 0.3 &&
    rescueRate <= 0.2 &&
    idleHintRate <= 0.3
  ) {
    return "偶爾需要提醒";
  }

  if (averageReplayCount <= 1 || rescueRate <= 0.35 || idleHintRate <= 0.5) {
    return "需要一些輔助";
  }

  return "較依賴重看或提示";
}

function buildParentSummary({
  independentSpan,
  assistedSpan,
  weightedAccuracyPercent,
  sequenceMatchPercent,
  averageCorrectReactionTime,
  reactionTimeStd,
  timeoutRate,
  totalReplayCount,
  replayTrialCount,
  rescueTrialCount,
  totalTrials,
  dominantMicroDifficultyLabel,
  highestMicroDifficultyLabel,
  firstErrorAvgIndex,
  earlyErrorCount,
  lateErrorCount,
  wrongCount,
  idleHintRate,
  locationErrorRate,
  orderErrorRate,
  omissionErrorRate,
  extraTapErrorRate,
  fatigueDrop,
}) {
  if (!totalTrials || totalTrials <= 0) {
    return "目前尚未有足夠題目資料，完成測驗或訓練後即可看到分析結果。";
  }

  const replayRate = totalTrials > 0 ? replayTrialCount / totalTrials : 0;
  const averageReplayCount = totalTrials > 0 ? totalReplayCount / totalTrials : 0;
  const rescueRate = totalTrials > 0 ? rescueTrialCount / totalTrials : 0;

  const parts = [];

  parts.push(
    `這次主要難度為「${dominantMicroDifficultyLabel}」，最高曾進入「${highestMicroDifficultyLabel}」。`
  );

  if (independentSpan >= 6) {
    parts.push(`孩子目前可以獨立記住較長的石頭路線，最高可獨立完成約 ${independentSpan} 步。`);
  } else if (independentSpan >= 4) {
    parts.push(`孩子目前可以獨立記住中等長度的石頭路線，最高可獨立完成約 ${independentSpan} 步。`);
  } else if (independentSpan >= 2 && assistedSpan > independentSpan) {
    parts.push(`孩子目前可獨立完成約 ${independentSpan} 步，在提示或重看後最高可完成約 ${assistedSpan} 步。`);
  } else if (assistedSpan >= 2) {
    parts.push(`孩子目前在提示或重看後可完成約 ${assistedSpan} 步，建議先從短路線建立成功經驗。`);
  } else {
    parts.push("孩子目前還在熟悉石頭亮起與依序點擊的規則。");
  }

  if (weightedAccuracyPercent >= 85) {
    parts.push("整體完成度高，大多數題目都能按照正確順序完成。");
  } else if (weightedAccuracyPercent >= 60) {
    parts.push("整體完成度尚可，但路線變長時可能會出現漏點或順序混淆。");
  } else {
    parts.push("整體完成度偏低，建議先降低路線長度，讓孩子建立成功經驗。");
  }

  if (sequenceMatchPercent >= 80) {
    parts.push("即使路線變長，也能保留不錯的前後順序。");
  } else if (sequenceMatchPercent >= 60) {
    parts.push("孩子通常能記得部分路線，但偶爾會把前後順序弄混。");
  } else {
    parts.push("孩子在重現順序時較不穩定，建議觀察是否容易忘記中後段路線。");
  }

  if (averageReplayCount === 0 && rescueRate === 0 && idleHintRate === 0) {
    parts.push("這次幾乎不需要使用重看、補救提示或太久未操作提醒，表示孩子可以較獨立完成。");
  } else if (
    averageReplayCount <= 0.5 &&
    replayRate <= 0.35 &&
    rescueRate <= 0.25 &&
    idleHintRate <= 0.35
  ) {
    parts.push(`這次偶爾使用輔助，共重看 ${totalReplayCount} 次，表示孩子在少量提醒下可以完成。`);
  } else {
    parts.push(`這次較常使用輔助，共重看 ${totalReplayCount} 次，且有 ${rescueTrialCount} 題進入補救，表示孩子目前仍需要一些支持來完成較長路線。`);
  }

  if (wrongCount <= 0) {
    parts.push("這次沒有明顯錯誤題型。");
  } else if (earlyErrorCount > lateErrorCount) {
    parts.push("錯誤比較常出現在路線前半段，可能代表孩子一開始沒有完整記住路線。");
  } else if (lateErrorCount > earlyErrorCount) {
    parts.push("錯誤比較常出現在路線後半段，可能代表孩子前面能記住，但路線變長後容易忘記後面。");
  } else if (firstErrorAvgIndex !== null) {
    parts.push(`錯誤大約出現在第 ${Math.round(firstErrorAvgIndex) + 1} 步附近，可以觀察孩子在哪一段開始不穩定。`);
  } else {
    parts.push("可以再觀察孩子是漏點、點錯位置，還是順序混淆。");
  }

  if (averageCorrectReactionTime === null) {
    parts.push("目前有效作答時間資料不足。");
  } else if (averageCorrectReactionTime <= 3000) {
    parts.push("答對題的作答節奏很快。");
  } else if (averageCorrectReactionTime <= 6000) {
    parts.push("答對題的作答節奏大致穩定。");
  } else {
    parts.push("答對題作答時間較長，可能需要更多時間回想石頭順序。");
  }

  if (fatigueDrop >= 0.3) {
    parts.push("孩子後半段表現下降，可能與疲勞或注意維持有關。");
  } else if (reactionTimeStd === null) {
    parts.push("目前作答穩定度資料不足。");
  } else if (reactionTimeStd <= 1500) {
    parts.push("各題作答時間相當穩定。");
  } else if (reactionTimeStd <= 3000) {
    parts.push("作答時間略有波動。");
  } else {
    parts.push("作答時間變化較大，代表孩子有時能很快完成，有時需要較久時間。");
  }

  if (timeoutRate >= 0.3) {
    parts.push("逾時比例偏高，建議給孩子更短的路線或更多練習時間。");
  }

  if (idleHintRate >= 0.35) {
    parts.push("孩子在部分題目中需要非文字提醒後才開始作答，表示注意啟動或任務維持可能需要一些支持。");
  }

  if (locationErrorRate >= 0.45) {
    parts.push("孩子較容易點到沒有出現在路線中的位置，表示空間位置辨識與記憶仍需要練習。");
  } else if (orderErrorRate >= 0.45) {
    parts.push("孩子大致記得出現過的位置，但較容易混淆先後順序。");
  } else if (omissionErrorRate >= 0.35) {
    parts.push("孩子較常出現少點情形，可能表示後段路線容易忘記或記憶維持不足。");
  } else if (extraTapErrorRate >= 0.35) {
    parts.push("孩子較常出現多點情形，建議觀察是否有衝動點擊或作答節奏過快。");
  }

  return parts.join("");
}

function buildClinicalFlags(stats) {
  const flags = [];
  const {
    weightedAccuracyPercent,
    accuracyPercent,
    independentSpan,
    assistedSpan,
    sequenceMatchPercent,
    averageCorrectReactionTime,
    reactionTimeStd,
    timeoutRate,
    earlyErrorCount,
    lateErrorCount,
    wrongCount,
    totalReplayCount,
    replayTrialCount,
    rescueTrialCount,
    totalTrials,
    averageMicroDifficultyOrder,
    idleHintRate,
    locationErrorRate,
    orderErrorRate,
    omissionErrorRate,
    extraTapErrorRate,
    fatigueDrop,
  } = stats;

  if (!totalTrials || totalTrials <= 0) {
    return [
      {
        type: "insufficient_data",
        level: "notice",
        message: "目前題目資料不足，暫不進行臨床解讀。",
      },
    ];
  }

  const replayRate = totalTrials > 0 ? replayTrialCount / totalTrials : 0;
  const averageReplayCount = totalTrials > 0 ? totalReplayCount / totalTrials : 0;
  const rescueRate = totalTrials > 0 ? rescueTrialCount / totalTrials : 0;
  const expectedKey = getMicroDifficultyByOrder(averageMicroDifficultyOrder);
  const expectedSpan = getExpectedSpanByMicroDifficulty(expectedKey);

  if (weightedAccuracyPercent < 60) {
    flags.push({
      type: "weighted_accuracy_low",
      level: "warning",
      message: "加權完成度偏低。若孩子有補救後答對，仍需解讀為在輔助下完成，而非完全獨立完成。",
    });
  }

  if (accuracyPercent < 60) {
    flags.push({
      type: "raw_accuracy_low",
      level: "warning",
      message: "整體完成度偏低，建議觀察孩子是否理解規則、是否記憶負荷過高，或是否容易分心。",
    });
  }

  if (independentSpan < Math.max(2, expectedSpan - 1)) {
    flags.push({
      type: "independent_span_low_for_difficulty",
      level: "notice",
      message: "獨立完成跨度低於此微難度的期待範圍，建議降低訓練難度或增加提示階段。",
    });
  }

  if (assistedSpan > independentSpan + 1) {
    flags.push({
      type: "assisted_span_higher_than_independent_span",
      level: "notice",
      message: "提示下完成跨度明顯高於獨立完成跨度，表示孩子在輔助下可以表現更好，但目前仍需要支持。",
    });
  }

  if (sequenceMatchPercent < 60) {
    flags.push({
      type: "sequence_reproduction_low",
      level: "notice",
      message: "順序重現比例偏低，可能表示孩子容易遺漏、倒置或混淆石頭順序。",
    });
  }

  if (averageCorrectReactionTime !== null && averageCorrectReactionTime > 7000) {
    flags.push({
      type: "reaction_slow",
      level: "notice",
      message: "答對題平均作答時間偏長，可能表示回想順序或執行點擊需要較多時間。",
    });
  }

  if (reactionTimeStd !== null && reactionTimeStd > 3000) {
    flags.push({
      type: "stability_low",
      level: "notice",
      message: "作答時間變異較大，可能代表作答策略不穩定或注意力波動較明顯。",
    });
  }

  if (timeoutRate >= 0.3) {
    flags.push({
      type: "timeout_high",
      level: "warning",
      message: "逾時比例偏高，建議確認作答時間是否足夠，或孩子是否需要更短的序列。",
    });
  }

  if (wrongCount > 0 && earlyErrorCount / wrongCount >= 0.5) {
    flags.push({
      type: "early_sequence_error",
      level: "notice",
      message: "錯誤多出現在序列前段，建議觀察孩子是否一開始就未能完整編碼石頭順序。",
    });
  }

  if (wrongCount > 0 && lateErrorCount / wrongCount >= 0.5) {
    flags.push({
      type: "late_sequence_error",
      level: "notice",
      message: "錯誤多出現在序列後段，可能表示孩子前段記憶尚可，但序列加長後容量負荷提高。",
    });
  }

  if (averageReplayCount >= 1 || replayRate >= 0.5) {
    flags.push({
      type: "replay_dependency_high",
      level: "notice",
      message: "重看比例偏高，建議將此結果解讀為「在重看輔助下可完成」，而非完全獨立完成。",
    });
  }

  if (rescueRate >= 0.3) {
    flags.push({
      type: "rescue_dependency_high",
      level: "notice",
      message: "補救重播比例偏高，表示孩子目前需要教學式提示才能完成部分題目。",
    });
  }

  if (idleHintRate >= 0.35) {
    flags.push({
      type: "idle_hint_high",
      level: "notice",
      message: "非文字啟動提示比例偏高，建議觀察孩子是否需要外部提醒才能開始作答。",
    });
  }

  if (locationErrorRate >= 0.45) {
    flags.push({
      type: "location_error_high",
      level: "notice",
      message: "位置錯誤比例偏高，可能代表空間位置辨識或記憶負荷過高。",
    });
  }

  if (orderErrorRate >= 0.45) {
    flags.push({
      type: "order_error_high",
      level: "notice",
      message: "順序錯誤比例偏高，表示孩子可能記得位置，但前後順序較不穩定。",
    });
  }

  if (omissionErrorRate >= 0.35) {
    flags.push({
      type: "omission_error_high",
      level: "notice",
      message: "漏點比例偏高，可能與記憶維持或中後段序列負荷有關。",
    });
  }

  if (extraTapErrorRate >= 0.35) {
    flags.push({
      type: "extra_tap_high",
      level: "notice",
      message: "多點比例偏高，建議觀察是否有衝動點擊或作答節奏過快。",
    });
  }

  if (fatigueDrop >= 0.3) {
    flags.push({
      type: "fatigue_drop_high",
      level: "notice",
      message: "後半段正確率明顯下降，可能與疲勞或注意維持下降有關。",
    });
  }

  if (!flags.length) {
    flags.push({
      type: "normal",
      level: "normal",
      message: "目前未看到明顯異常旗標，可搭配其他 EF 任務一起解讀。",
    });
  }

  return flags;
}

function buildTrialSummaries(history = []) {
  return safeArray(history).map((record, index) => {
    const r = normalizeRecord(record);

    const sequenceMatchRate = r.isCorrect
      ? 1
      : getSequenceMatchRate(r.targetSequence, r.userSequence);

    return {
      trialIndex: r.trialIndex ?? index + 1,
      level: r.level ?? null,

      mode: r.mode,
      resultType: r.resultType,

      difficultyKey: r.difficultyKey,
      difficultyLabel: r.difficultyLabel,

      microDifficultyKey: r.microDifficultyKey,
      microDifficultyLabel: r.microDifficultyLabel,
      microDifficultyOrder: r.microDifficultyOrder,

      length: r.sequenceLength,
      sequenceLength: r.sequenceLength,
      memorySpan: r.memorySpan,

      isCorrect: r.isCorrect,
      isTimeout: r.isTimeout,

      weightedCorrectValue: r.weightedCorrectValue,
      attemptType: r.attemptType,
      wasRescued: r.wasRescued,

      reactionTime: r.reactionTime,
      firstTapTime: r.firstTapTime,
      averageTapInterval: r.averageTapInterval,

      targetSequence: r.targetSequence,
      userSequence: r.userSequence,

      targetLength: r.targetLength,
      inputLength: r.inputLength,

      sequenceMatchRate: roundNumber(sequenceMatchRate, 2),
      sequenceMatchPercent: roundNumber(sequenceMatchRate * 100, 0),

      errorIndex: r.errorIndex,
      firstErrorPosition: r.firstErrorPosition,
      errorPattern: r.errorPattern,

      replayCount: r.replayCount,
      usedReplay: r.usedReplay,
      supportWasUsed: r.supportWasUsed,

      hintLevel: r.hintLevel,
      hintAvailable: r.hintAvailable,
      usedHint: r.usedHint,

      idleHintShown: r.idleHintShown,
      idleHintCount: r.idleHintCount,
      idleBeforeFirstTapMs: r.idleBeforeFirstTapMs,

      cleanCorrect: r.cleanCorrect,
      rescueCorrect: r.rescueCorrect,
      rescueFailed: r.rescueFailed,

      spatialSimilarity: r.spatialSimilarity,
      pathComplexity: r.pathComplexity,
      reverseMode: r.reverseMode,
      distractorEnabled: r.distractorEnabled,
      distractorCount: r.distractorCount,
    };
  });
}

export function calculateCBTScore(inputHistory = [], options = {}) {
  const mode = options.mode || inputHistory?.mode || DEFAULT_MODE;
  const history = safeArray(inputHistory).map((record) =>
    normalizeRecord(record, mode)
  );

  const stats = getCBTBasicStats(history, { mode });
  const timeoutRate =
    stats.totalTrials > 0 ? stats.timeoutCount / stats.totalTrials : 0;

  if (!stats.totalTrials) {
    const emptySummary = {
      ...stats,
      timeoutRate: 0,
    };

    return {
      taskName: "Corsi Block Tapping",
      taskCode: "CBT",
      mode,

      totalScore: 0,
      score: 0,
      stars: 0,

      summary: emptySummary,

      aiAnalysis: null,
      recommendedDifficulty: "normal2",
      recommendedAction: "maintain",
      recommendationReason: "目前資料不足，建議完成測驗或訓練後再判斷下一次難度。",
      mainWeakness: "insufficient_data",

      scoreBreakdown: {
        spanScore: 0,
        accuracyScore: 0,
        weightedAccuracyScore: 0,
        sequenceScore: 0,
        independenceScore: 0,
        stabilityScore: 0,
        speedScore: 0,
        supportScore: 0,
      },

      childView: {
        stars: 0,
        message: getChildMessage(0),
        shortLabel: "資料不足",
      },

      parentView: {
        abilityScores: {
          routeMemoryLength: 0,
          routeCompletion: 0,
          orderMemory: 0,
          independentCompletion: 0,
          answerStability: 0,
          responsePace: 0,
        },
        indicators: [],
        plainLanguageSummary: buildParentSummary(emptySummary),
        shortSummary: "目前尚未有足夠資料。",
        detailSummary: buildParentSummary(emptySummary),
        suggestions: ["完成測驗或訓練後，再查看結果分析。"],
        aiSummary: "",
      },

      clinicalView: {
        ...emptySummary,
        aiAnalysis: null,
        interpretationFlags: buildClinicalFlags(emptySummary),
        trialSummaries: [],
        history: [],
      },

      history: [],
      records: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const aiAnalysis = analyzeCBTTraining(history, {
    currentDifficulty: stats.finalMicroDifficultyKey,
    difficultyOrder: CBT_MICRO_DIFFICULTY_ORDER,
    includeSummary: true,
  });

  const spanScore = getSpanScore({
    effectiveSpan: stats.effectiveSpan,
    independentSpan: stats.independentSpan,
    assistedSpan: stats.assistedSpan,
    averageMicroDifficultyOrder: stats.averageMicroDifficultyOrder,
  });

  const weightedAccuracyScore = getWeightedAccuracyScore(
    stats.weightedAccuracyRate
  );

  const sequenceScore = getSequenceScore(stats.sequenceMatchPercent);

  const independenceScore = getIndependenceScore({
    totalTrials: stats.totalTrials,
    totalReplayCount: stats.totalReplayCount,
    replayTrialCount: stats.replayTrialCount,
    usedHintCount: stats.usedHintCount,
    idleHintShownCount: stats.idleHintShownCount,
    rescueTrialCount: stats.rescueTrialCount,
    firstTryAccuracyRate: stats.firstTryAccuracyRate,
  });

  const stabilityScore = getStabilityScore({
    reactionTimeStd: stats.reactionTimeStd,
    timeoutRate,
    fatigueDrop: stats.fatigueDrop,
    earlyErrorCount: stats.earlyErrorCount,
    wrongCount: stats.wrongCount,
  });

  const speedScore = getSpeedScore(stats.averageCorrectReactionTime);

  let totalScore = roundNumber(
    spanScore +
      weightedAccuracyScore +
      sequenceScore +
      independenceScore +
      stabilityScore +
      speedScore,
    0
  );

  if (timeoutRate >= 0.5) totalScore = clamp(totalScore - 10, 0, 100);
  else if (timeoutRate >= 0.3) totalScore = clamp(totalScore - 5, 0, 100);

  if (stats.averageReplayCount >= 1.5) {
    totalScore = clamp(totalScore - 8, 0, 100);
  } else if (stats.averageReplayCount >= 1) {
    totalScore = clamp(totalScore - 4, 0, 100);
  }

  if (stats.rescueRate >= 0.5) {
    totalScore = clamp(totalScore - 6, 0, 100);
  } else if (stats.rescueRate >= 0.3) {
    totalScore = clamp(totalScore - 3, 0, 100);
  }

  if (stats.idleHintRate >= 0.6) {
    totalScore = clamp(totalScore - 6, 0, 100);
  } else if (stats.idleHintRate >= 0.35) {
    totalScore = clamp(totalScore - 3, 0, 100);
  }

  if (stats.fatigueDrop >= 0.4) {
    totalScore = clamp(totalScore - 6, 0, 100);
  } else if (stats.fatigueDrop >= 0.3) {
    totalScore = clamp(totalScore - 3, 0, 100);
  }

  totalScore = safeNumber(totalScore, 0);

  const stars = getStarRating({
    mode,
    totalTrials: stats.totalTrials,
    totalScore,
    weightedAccuracyRate: stats.weightedAccuracyRate,
    accuracyPercent: stats.accuracyPercent,
    independentSpan: stats.independentSpan,
    rawSpan: stats.rawSpan,
    timeoutRate,
    totalReplayCount: stats.totalReplayCount,
    replayTrialCount: stats.replayTrialCount,
    rescueTrialCount: stats.rescueTrialCount,
    dominantMicroDifficultyKey: stats.dominantMicroDifficultyKey,
    averageMicroDifficultyOrder: stats.averageMicroDifficultyOrder,
    idleHintRate: stats.idleHintRate,
  });

  const parentAbilityScores = {
    routeMemoryLength: roundNumber((spanScore / 30) * 100, 0),
    routeCompletion: stats.weightedAccuracyPercent,
    orderMemory: roundNumber((sequenceScore / 15) * 100, 0),
    independentCompletion: roundNumber((independenceScore / 15) * 100, 0),
    answerStability: roundNumber((stabilityScore / 10) * 100, 0),
    responsePace: roundNumber((speedScore / 5) * 100, 0),
  };

  const summary = {
    ...stats,
    mode,
    timeoutRate: roundNumber(timeoutRate, 2),
  };

  const plainLanguageSummary = buildParentSummary(summary);

  return {
    taskName: "Corsi Block Tapping",
    taskCode: "CBT",
    mode,

    totalScore,
    score: totalScore,
    stars,

    summary,

    aiAnalysis,
    recommendedDifficulty: aiAnalysis?.recommendedDifficulty || "normal2",
    recommendedAction: aiAnalysis?.recommendedAction || "maintain",
    recommendationReason:
      aiAnalysis?.recommendationReason ||
      aiAnalysis?.recommendation?.reason ||
      "建議維持目前難度並觀察下一次表現。",
    mainWeakness: aiAnalysis?.mainWeakness || "none",

    scoreBreakdown: {
      spanScore,
      accuracyScore: weightedAccuracyScore,
      weightedAccuracyScore,
      sequenceScore,
      independenceScore,
      stabilityScore,
      speedScore,
      supportScore: independenceScore,
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
          key: "routeMemoryLength",
          label: "可以記住幾步路線",
          value: parentAbilityScores.routeMemoryLength,
          level: getSpanLevel({
            independentSpan: stats.independentSpan,
            assistedSpan: stats.assistedSpan,
          }),
          description:
            "觀察孩子可以獨立記住幾個石頭亮起的位置與順序，也會區分是否是在提示後完成。",
        },
        {
          key: "routeCompletion",
          label: "路線完成度",
          value: parentAbilityScores.routeCompletion,
          level: getAccuracyLevel(stats.weightedAccuracyPercent),
          description:
            "觀察孩子能不能按照剛剛看到的石頭路線完成點擊。若是重看或補救後才答對，會以較低權重計算。",
        },
        {
          key: "orderMemory",
          label: "順序記憶",
          value: parentAbilityScores.orderMemory,
          level: getSequenceLevel(stats.sequenceMatchPercent),
          description:
            "觀察孩子是否容易把石頭的前後順序弄混，或只記得前面幾步。",
        },
        {
          key: "independentCompletion",
          label: "獨立完成度",
          value: parentAbilityScores.independentCompletion,
          level: getIndependenceLevel({
            totalTrials: stats.totalTrials,
            totalReplayCount: stats.totalReplayCount,
            replayTrialCount: stats.replayTrialCount,
            rescueTrialCount: stats.rescueTrialCount,
            idleHintShownCount: stats.idleHintShownCount,
            firstTryAccuracyRate: stats.firstTryAccuracyRate,
          }),
          description:
            "觀察孩子完成任務時，是否需要使用重看、補救、提示或太久未操作提醒。",
        },
        {
          key: "answerStability",
          label: "作答穩定度",
          value: parentAbilityScores.answerStability,
          level: getStabilityLevel({
            reactionTimeStd: stats.reactionTimeStd,
            fatigueDrop: stats.fatigueDrop,
          }),
          description:
            "觀察孩子每一題是否都能穩定完成，或後半段是否有疲勞與注意下降。",
        },
        {
          key: "responsePace",
          label: "作答節奏",
          value: parentAbilityScores.responsePace,
          level: getSpeedLevel(stats.averageCorrectReactionTime),
          description:
            "觀察孩子答對時需要多少時間回想與點擊。此指標僅作輔助，不鼓勵過快作答。",
        },
      ],

      plainLanguageSummary,
      shortSummary: plainLanguageSummary,
      detailSummary: plainLanguageSummary,
      suggestions: [
        aiAnalysis?.recommendationReason ||
          aiAnalysis?.recommendation?.reason ||
          "建議維持目前難度並觀察下一次表現。",
      ],
      aiSummary: aiAnalysis?.parentSummary || "",
    },

    clinicalView: {
      ...summary,
      aiAnalysis,
      interpretationFlags: buildClinicalFlags(summary),
      trialSummaries: buildTrialSummaries(history),
      history,
    },

    history,
    records: history,
    generatedAt: new Date().toISOString(),
  };
}

export const calculateSpan = (history = []) => {
  const stats = getCBTBasicStats(history);
  return stats.span;
};

export const calculateIndependentSpan = (history = []) => {
  const stats = getCBTBasicStats(history);
  return stats.independentSpan;
};

export const calculateAssistedSpan = (history = []) => {
  const stats = getCBTBasicStats(history);
  return stats.assistedSpan;
};

export const calculateAccuracy = (history = []) => {
  const stats = getCBTBasicStats(history);
  return stats.accuracyRate;
};

export const calculateWeightedAccuracy = (history = []) => {
  const stats = getCBTBasicStats(history);
  return stats.weightedAccuracyRate;
};

export const calculateCorrectCount = (history = []) => {
  const stats = getCBTBasicStats(history);
  return stats.correctCount;
};

export const getStars = (span, accuracy) => {
  if (span >= 5 && accuracy >= 0.6) return 3;
  if (span >= 3 && accuracy >= 0.4) return 2;
  if (span >= 4) return 2;
  return 1;
};

export const getStarLabel = (stars) => {
  if (stars === 3) return "表現良好";
  if (stars === 2) return "表現穩定";
  if (stars === 1) return "需要練習";
  return "資料不足";
};

export const getParentFeedback = (span, accuracy, stars) => {
  const safeSpan = safeNumber(span, 0);
  const accuracyPercent = Math.round(clamp01(safeNumber(accuracy, 0)) * 100);

  if (stars === 3) {
    return `孩子目前可以穩定記住較長的石頭路線，最高可完成 ${safeSpan} 步，整體完成度約為 ${accuracyPercent}%。這表示孩子在記住位置與順序上表現良好。`;
  }

  if (stars === 2) {
    return `孩子目前最高可完成 ${safeSpan} 步石頭路線，整體完成度約為 ${accuracyPercent}%。這表示孩子已經能掌握基本路線記憶，但路線變長時仍可以再練習。`;
  }

  if (stars === 1) {
    return `孩子目前最高可完成 ${safeSpan} 步石頭路線，整體完成度約為 ${accuracyPercent}%。建議先從短路線開始，慢慢增加到更長的路線。`;
  }

  return "目前資料不足，完成測驗或訓練後即可看到結果。";
};

export const getCBTIndicators = (span, accuracy) => {
  const safeSpan = safeNumber(span, 0);
  const safeAccuracy = clamp01(safeNumber(accuracy, 0));

  return {
    memorySpan: safeSpan,
    accuracyRate: Math.round(safeAccuracy * 100),
    workingMemoryScore: Math.min(100, Math.round((safeSpan / 6) * 100)),
    stabilityScore: Math.round(safeAccuracy * 100),
  };
};

export const getCBTResult = (history = [], options = {}) => {
  const result = calculateCBTScore(history, options);

  return {
    span: result.summary.span,
    memorySpan: result.summary.memorySpan,

    independentSpan: result.summary.independentSpan,
    assistedSpan: result.summary.assistedSpan,
    effectiveSpan: result.summary.effectiveSpan,

    accuracy: result.summary.accuracyRate,
    accuracyPercent: result.summary.accuracyPercent,

    weightedAccuracy: result.summary.weightedAccuracyRate,
    weightedAccuracyPercent: result.summary.weightedAccuracyPercent,

    total: result.summary.totalTrials,
    correct: result.summary.correctCount,
    wrong: result.summary.wrongCount,

    stars: result.stars,
    label: getStarLabel(result.stars),
    feedback: getParentFeedback(
      result.summary.span,
      result.summary.accuracyRate,
      result.stars
    ),

    indicators: getCBTIndicators(
      result.summary.span,
      result.summary.accuracyRate
    ),

    totalScore: result.totalScore,
    score: result.totalScore,
    summary: result.summary,
    scoreBreakdown: result.scoreBreakdown,
    childView: result.childView,
    parentView: result.parentView,
    clinicalView: result.clinicalView,

    aiAnalysis: result.aiAnalysis,
    recommendedDifficulty: result.recommendedDifficulty,
    recommendedAction: result.recommendedAction,
    recommendationReason: result.recommendationReason,
    mainWeakness: result.mainWeakness,

    history: result.history,
    records: result.records,
    generatedAt: result.generatedAt,
  };
};

function safeJsonParse(raw, fallback = null) {
  try {
    if (!raw || typeof raw !== "string") return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function hasCBTRecords(value) {
  if (!value || typeof value !== "object") return false;

  return (
    Array.isArray(value) ||
    Array.isArray(value.history) ||
    Array.isArray(value.records) ||
    Array.isArray(value.trials) ||
    Array.isArray(value.cbtHistory) ||
    Boolean(value.scoring?.summary)
  );
}

function getCurrentChildId() {
  if (typeof window === "undefined") return null;

  const keys = [
    "selectedChildId",
    "currentChildId",
    "activeChildId",
    "childId",
    "ef_current_child_id",
  ];

  for (const key of keys) {
    const value =
      window.localStorage.getItem(key) || window.sessionStorage.getItem(key);

    if (value && value !== "null" && value !== "undefined") return value;
  }

  return null;
}

export function getStoredCBTResult(storageKey = null, options = {}) {
  if (typeof window === "undefined" || !window.localStorage) return null;

  const childId = getCurrentChildId();

  const keys = [
    storageKey,
    "latestCBTTrainingResult",
    "cbtTrainingResult",
    "ef_game_cbt_training_result",
    childId ? `cbtTrainingResult_${childId}` : null,
    "latestCBTTestResult",
    "cbtTestResult",
    "ef_game_cbt_test_result",
    childId ? `cbtTestResult_${childId}` : null,
    "cbtFinalResult",
    "cbtLatestResult",
  ].filter(Boolean);

  for (const key of keys) {
    const parsed = safeJsonParse(window.localStorage.getItem(key), null);

    if (!hasCBTRecords(parsed)) continue;

    if (parsed?.scoring?.summary) return parsed.scoring;

    if (Array.isArray(parsed)) {
      return calculateCBTScore(parsed, options);
    }

    const records =
      parsed.cbtHistory ||
      parsed.history ||
      parsed.records ||
      parsed.trials ||
      parsed.clinicalView?.history ||
      [];

    if (Array.isArray(records)) {
      return {
        ...parsed,
        scoring: calculateCBTScore(records, {
          mode: parsed.mode || parsed.resultType || options.mode || DEFAULT_MODE,
        }),
      };
    }
  }

  return null;
}

export default calculateCBTScore;