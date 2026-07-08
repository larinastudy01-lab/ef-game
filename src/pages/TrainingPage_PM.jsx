import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { analyzePMTraining, calculatePMAIScore } from "../ai/pmTrainingAnalyzer";
import { calculatePMScore } from "../utils/pmScoring";
import { saveUnifiedResult } from "../utils/resultManager";

import PM01 from "../asset/PM/PM_01.png";
import PM02 from "../asset/PM/PM_02.png";
import PM03 from "../asset/PM/PM_03.png";
import PM04 from "../asset/PM/PM_04.png";
import PM05 from "../asset/PM/PM_05.png";
import PM06 from "../asset/PM/PM_06.png";
import PM07 from "../asset/PM/PM_07.png";
import PM08 from "../asset/PM/PM_08.png";
import PM09 from "../asset/PM/PM_09.png";
import PM10 from "../asset/PM/PM_10.png";
import PM11 from "../asset/PM/PM_11.png";
import rabbitAvatar from "../asset/avatar/rabbit.png";

import clickSfx from "../asset/Click_SRT.mp3";
import bgImage from "../asset/PM_testbackground.png";
import introVideo from "../asset/mp4/PM_start.mp4";
import stepVideo from "../asset/mp4/PM_step.mp4";
import endingVideo from "../asset/mp4/PM_end.mp4";
import mouseGuideImg from "../asset/mouse.png";
import homeResultBtn from "../asset/home/result.png";
import homeAgainBtn from "../asset/home/again.png";
import homeBackBtn from "../asset/home/back.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeStartBtn from "../asset/home/start.png";
import homeNextBtn from "../asset/home/next.png";

const ALL_ITEMS = [
  { id: "PM01", image: PM01 },
  { id: "PM02", image: PM02 },
  { id: "PM03", image: PM03 },
  { id: "PM04", image: PM04 },
  { id: "PM05", image: PM05 },
  { id: "PM06", image: PM06 },
  { id: "PM07", image: PM07 },
  { id: "PM08", image: PM08 },
  { id: "PM09", image: PM09 },
  { id: "PM10", image: PM10 },
  { id: "PM11", image: PM11 },
];


const COMPLETED_LEVELS_STORAGE_KEY = "ef_game_completed_training_levels";
const PM_STAGE_STAR_STORAGE_KEY = "ef_game_training_stage_stars";
const MAX_LEVEL_PER_GAME = 10;
const SPAN_TRIALS_PER_MEMORY_COUNT = 2;
const MAX_TRAINING_MEMORY_SPAN = 6;
const DEFAULT_TRAINING_TOTAL_ROUNDS = 6;

const clampNumber = (value, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
};

const clampStarCount = (value) => {
  const stars = Number(value);
  if (!Number.isFinite(stars)) return 1;
  return Math.min(3, Math.max(1, Math.round(stars)));
};

const safeParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const safeStorageGet = (storage, key) => {
  try {
    return storage?.getItem(key) || null;
  } catch (error) {
    console.warn(`[TrainingPage_PM] 無法讀取儲存資料 (${key})：`, error);
    return null;
  }
};

const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[TrainingPage_PM] 無法寫入儲存資料 (${key})：`, error);
    return false;
  }
};

const safeStorageSetJson = (key, value) =>
  safeStorageSet(key, JSON.stringify(value));

const dispatchStorageRefresh = () => {
  try {
    window.dispatchEvent(new Event("storage"));
  } catch (error) {
    console.warn("[TrainingPage_PM] 無法通知儲存資料更新：", error);
  }
};

const getQueryValue = (search, key) => {
  const params = new URLSearchParams(search || "");
  return params.get(key);
};

const getTrainingStageInfo = (location) => {
  const state = location?.state || {};
  const search = location?.search || "";
  const levelFromRoute =
    state.trainingLevel ??
    state.level ??
    getQueryValue(search, "level") ??
    getQueryValue(search, "trainingLevel");

  const level = clampNumber(levelFromRoute || 1, 1, MAX_LEVEL_PER_GAME);
  const stageId =
    state.trainingStageId ||
    state.stageId ||
    getQueryValue(search, "stage") ||
    getQueryValue(search, "trainingStageId") ||
    `pm-L${level}`;

  return {
    level,
    stageId,
    order: Number(state.trainingOrder || getQueryValue(search, "order") || level),
    total: Number(state.trainingTotal || getQueryValue(search, "total") || MAX_LEVEL_PER_GAME),
    todayKey: state.todayKey || getQueryValue(search, "todayKey") || "",
    abilityLabel: state.abilityLabel || "記憶",
  };
};

const resolveCurrentChildId = () => {
  const possibleKeys = [
    "currentChildId",
    "selectedChildId",
    "activeChildId",
    "childId",
  ];

  for (const key of possibleKeys) {
    const value =
      safeStorageGet(localStorage, key) || safeStorageGet(sessionStorage, key);
    if (value) return value;
  }

  const currentChild =
    safeParse(safeStorageGet(localStorage, "currentChild"), null) ||
    safeParse(safeStorageGet(sessionStorage, "currentChild"), null) ||
    safeParse(safeStorageGet(localStorage, "selectedChild"), null) ||
    safeParse(safeStorageGet(sessionStorage, "selectedChild"), null);

  return currentChild?.id || currentChild?.childId || currentChild?.profileId || null;
};

const getLatestPMTestResult = () => {
  const childId = resolveCurrentChildId();
  const possibleKeys = [
    ...(childId ? [`pmTestResult_${childId}`] : []),
    "pmTestResult",
    "latestPMTestResult",
    "PMTestResult",
    "pictureMemoryTestResult",
    "result_picture_memory_test",
    "ef_game_pm_test_result",
  ];

  for (const key of possibleKeys) {
    const result = safeParse(safeStorageGet(localStorage, key), null);
    if (result && typeof result === "object") return result;
  }

  const allResults = safeParse(safeStorageGet(localStorage, "ef_game_test_results"), null);
  if (allResults && typeof allResults === "object") {
    return allResults.pm || allResults.PM || allResults.pictureMemory || null;
  }

  return null;
};

const getAccuracyFromResult = (result) => {
  if (!result || typeof result !== "object") return null;

  const directAccuracy = Number(result.accuracy ?? result.correctRate ?? result.accuracyRate);
  if (Number.isFinite(directAccuracy)) {
    return directAccuracy > 1 ? directAccuracy / 100 : directAccuracy;
  }

  const correct = Number(result.correctTrials ?? result.correctCount ?? result.correct);
  const total = Number(result.totalTrials ?? result.totalCount ?? result.total);
  if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
    return correct / total;
  }

  if (Array.isArray(result.records) && result.records.length > 0) {
    const correctRecords = result.records.filter((record) => record.isCorrect || record.correct).length;
    return correctRecords / result.records.length;
  }

  return null;
};

const getAvgReactionTimeFromResult = (result) => {
  if (!result || typeof result !== "object") return null;

  const directRT = Number(result.avgReactionTime ?? result.averageReactionTime ?? result.avgRT);
  if (Number.isFinite(directRT) && directRT > 0) return directRT;

  if (Array.isArray(result.records)) {
    const reactionTimes = result.records
      .map((record) => Number(record.reactionTime ?? record.rt))
      .filter((rt) => Number.isFinite(rt) && rt > 0);

    if (reactionTimes.length > 0) {
      return reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length;
    }
  }

  return null;
};

const DIFFICULTY_CONFIGS = {
  1: {
    level: 1,
    shortLabel: "熟悉規則",
    desc: "物品少、時間長，先熟悉怎麼記住與找回物品。",
    baseMemoryCount: 2,
    maxMemoryCount: 2,
    showTime: 5,
    minShowTime: 4.5,
    answerTime: 16,
    distractorExtra: 1,
    motion: "none",
    modeHint: "先慢慢看清楚兔子妹妹掉了什麼，再幫她找回來。",
  },
  2: {
    level: 2,
    shortLabel: "基礎記憶",
    desc: "物品稍微增加，但湖面還是很平靜。",
    baseMemoryCount: 2,
    maxMemoryCount: 3,
    showTime: 4.5,
    minShowTime: 4,
    answerTime: 15,
    distractorExtra: 2,
    motion: "none",
    modeHint: "這次會多一點選項，請只找剛剛真的看過的物品。",
  },
  3: {
    level: 3,
    shortLabel: "增加容量",
    desc: "要記住更多物品，並從更多選項中找回來。",
    baseMemoryCount: 3,
    maxMemoryCount: 4,
    showTime: 4,
    minShowTime: 3.5,
    answerTime: 13,
    distractorExtra: 3,
    motion: "none",
    modeHint: "森林裡的物品變多了，請一個一個看清楚。",
  },
  4: {
    level: 4,
    shortLabel: "輕度抗干擾",
    desc: "湖面會有很輕微的波紋，需要更專心。",
    baseMemoryCount: 4,
    maxMemoryCount: 4,
    showTime: 3.5,
    minShowTime: 3,
    answerTime: 12,
    distractorExtra: 3,
    motion: "none",
    modeHint: "湖面會輕輕閃動，請專心記住真正掉進湖裡的物品。",
  },
  5: {
    level: 5,
    shortLabel: "記憶分辨",
    desc: "要記住較多物品，也要避開更多非答案選項。",
    baseMemoryCount: 4,
    maxMemoryCount: 5,
    showTime: 3,
    minShowTime: 2.8,
    answerTime: 10,
    distractorExtra: 4,
    motion: "flicker",
    modeHint: "有些物品會混在一起，請找回剛剛真的出現過的物品。",
  },
  6: {
    level: 6,
    shortLabel: "高挑戰",
    desc: "物品較多、時間較短，湖水會輕輕晃動。",
    baseMemoryCount: 5,
    maxMemoryCount: 6,
    showTime: 2.8,
    minShowTime: 2.5,
    answerTime: 9,
    distractorExtra: 4,
    motion: "move",
    modeHint: "湖水會晃動，請看清楚後再幫兔子妹妹找回來。",
  },
};

const getBaseDifficultyFromTestResult = (result) => {
  const accuracy = getAccuracyFromResult(result);
  const avgReactionTime = getAvgReactionTimeFromResult(result);

  if (accuracy == null) return null;

  if (accuracy >= 0.9 && (!avgReactionTime || avgReactionTime <= 6000)) return 4;
  if (accuracy >= 0.78 && (!avgReactionTime || avgReactionTime <= 7500)) return 3;
  if (accuracy >= 0.6) return 2;
  return 1;
};

const getStageDifficulty = (stageLevel, testResult) => {
  const baseDifficulty = getBaseDifficultyFromTestResult(testResult);

  if (baseDifficulty == null) {
    if (stageLevel >= 10) return 6;
    if (stageLevel >= 8) return 5;
    if (stageLevel >= 6) return 4;
    if (stageLevel >= 4) return 3;
    if (stageLevel >= 2) return 2;
    return 1;
  }

  const stageBoost = Math.floor((stageLevel - 1) / 2);
  return clampNumber(baseDifficulty + stageBoost, 1, 6);
};

const getBroadDifficultyKey = (difficultyLevel) => {
  if (difficultyLevel <= 2) return "easy";
  if (difficultyLevel <= 4) return "normal";
  return "hard";
};

const getTrainingMemorySpanPlan = (difficultyLevel) => {
  const level = clampNumber(difficultyLevel, 1, 6);
  const config = DIFFICULTY_CONFIGS[level] || DIFFICULTY_CONFIGS[1];
  const startSpan = clampNumber(config.baseMemoryCount || 2, 2, MAX_TRAINING_MEMORY_SPAN);
  const endSpan = clampNumber(
    Math.max(config.maxMemoryCount || startSpan, startSpan + 2),
    startSpan,
    MAX_TRAINING_MEMORY_SPAN
  );

  return Array.from(
    { length: endSpan - startSpan + 1 },
    (_, index) => startSpan + index
  );
};

const getTrainingTotalRounds = (difficultyLevel) =>
  getTrainingMemorySpanPlan(difficultyLevel).length * SPAN_TRIALS_PER_MEMORY_COUNT;

const getSpanInfoForRound = (roundNumber, difficultyLevel) => {
  const plan = getTrainingMemorySpanPlan(difficultyLevel);
  const safeRound = Math.max(1, Math.round(safeNumber(roundNumber, 1)));
  const spanIndex = clampNumber(
    Math.floor((safeRound - 1) / SPAN_TRIALS_PER_MEMORY_COUNT),
    0,
    Math.max(0, plan.length - 1)
  );

  return {
    memorySpan: plan[spanIndex] || plan[0] || 2,
    memorySpanIndex: spanIndex + 1,
    memorySpanTotal: plan.length,
    spanTrialIndex: ((safeRound - 1) % SPAN_TRIALS_PER_MEMORY_COUNT) + 1,
    spanTrialTotal: SPAN_TRIALS_PER_MEMORY_COUNT,
    spanPlan: plan,
  };
};

const shouldStopBySpanFailure = (records, memorySpan) => {
  const spanRecords = (Array.isArray(records) ? records : []).filter(
    (record) => Number(record?.memoryCount ?? record?.memorySpan) === Number(memorySpan)
  );

  if (spanRecords.length < SPAN_TRIALS_PER_MEMORY_COUNT) {
    return { shouldStop: false, reason: null, spanRecords };
  }

  const latestSpanRecords = spanRecords.slice(-SPAN_TRIALS_PER_MEMORY_COUNT);
  const bothFailed = latestSpanRecords.every((record) => record?.isCorrect !== true);
  const bothTimeout = latestSpanRecords.every((record) => record?.isTimeout === true);

  return {
    shouldStop: bothFailed || bothTimeout,
    reason: bothTimeout ? "span_two_timeouts" : bothFailed ? "span_two_failed" : null,
    spanRecords: latestSpanRecords,
  };
};

const saveTrainingStageProgress = ({ stageId, level, stars, finalResult }) => {
  const safeStars = clampStarCount(stars);
  const completedLevels = safeParse(safeStorageGet(localStorage, COMPLETED_LEVELS_STORAGE_KEY), []);
  const nextCompletedLevels = Array.isArray(completedLevels)
    ? [...new Set([...completedLevels, stageId, `pm-${level}`])]
    : [stageId, `pm-${level}`];

  const progressWrites = [
    [COMPLETED_LEVELS_STORAGE_KEY, JSON.stringify(nextCompletedLevels)],
    [`ef_game_${stageId}_completed`, "true"],
    [`ef_game_${stageId}_stars`, String(safeStars)],
    [`ef_game_pm_level_${level}_completed`, "true"],
    [`ef_game_pm_level_${level}_stars`, String(safeStars)],
    [`training_pm_level_${level}_completed`, "true"],
    [`training_pm_level_${level}_stars`, String(safeStars)],
    [`pm_training_level_${level}_completed`, "true"],
    [`pm_training_level_${level}_stars`, String(safeStars)],
  ];

  progressWrites.forEach(([key, value]) => safeStorageSet(key, value));

  const starMap = safeParse(safeStorageGet(localStorage, PM_STAGE_STAR_STORAGE_KEY), {});
  const nextStarMap = {
    ...(starMap && typeof starMap === "object" && !Array.isArray(starMap) ? starMap : {}),
    [stageId]: { stars: safeStars, gameId: "pm", level, updatedAt: new Date().toISOString() },
    [`pm-${level}`]: safeStars,
  };
  safeStorageSetJson(PM_STAGE_STAR_STORAGE_KEY, nextStarMap);

  const resultMap = safeParse(safeStorageGet(localStorage, "ef_game_training_stage_results"), {});
  safeStorageSetJson("ef_game_training_stage_results", {
    ...(resultMap && typeof resultMap === "object" && !Array.isArray(resultMap) ? resultMap : {}),
    [stageId]: finalResult,
  });

  dispatchStorageRefresh();
};

function shuffleArray(arr) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function arraysEqualAsSet(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;

  return [...arr1].sort().join(",") === [...arr2].sort().join(",");
}

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const safeNonNegative = (value, fallback = 0) => Math.max(0, safeNumber(value, fallback));

const getSafeElapsedTime = (startTime) => {
  if (!Number.isFinite(startTime)) return 0;
  return Math.max(0, Math.round(performance.now() - startTime));
};

const safeRecommendedDifficulty = (payload) => {
  try {
    return getRecommendedDifficulty({
      ...payload,
      accuracy: safeNonNegative(payload?.accuracy, 0),
      avgReactionTime: safeNonNegative(payload?.avgReactionTime, 0),
      fatigueLevel: safeNumber(payload?.fatigueLevel, 0),
    });
  } catch (error) {
    console.warn("[TrainingPage_PM] difficulty recommendation failed:", error);
    return "normal";
  }
};

const safeCalculatePMScore = (records, options) => {
  try {
    return calculatePMScore(records, options) || { stars: 1, totalScore: 0 };
  } catch (error) {
    console.warn("[TrainingPage_PM] PM scoring failed:", error);
    return { stars: 1, totalScore: 0 };
  }
};

export default function TrainingPage_PM() {
  const navigate = useNavigate();
  const location = useLocation();
  const trainingStage = getTrainingStageInfo(location);
  const pmTestResult = getLatestPMTestResult();

  const audioRef = useRef(null);
  const answerStartRef = useRef(null);
  const recordsRef = useRef([]);
  const tapLogsRef = useRef([]);
  const selectedIdsRef = useRef([]);
  const hasSubmittedRef = useRef(false);
  const finalResultRef = useRef(null);
  const answerStartFrameRef = useRef(null);
  const roundTransitionRef = useRef(null);
  const backgroundWarningTimerRef = useRef(null);
  const idleHintTimerRef = useRef(null);

  const [phase, setPhase] = useState("rules");
  // rules -> introVideo -> stepVideo -> readyCountdown -> memorize -> answer -> endingVideo -> result

  const [baseDifficulty] = useState(() => getStageDifficulty(trainingStage.level, pmTestResult));
  const trainingSpanPlan = Number.isFinite(baseDifficulty)
    ? getTrainingMemorySpanPlan(baseDifficulty)
    : getTrainingMemorySpanPlan(1);
  const trainingTotalRounds = trainingSpanPlan.length > 0
    ? trainingSpanPlan.length * SPAN_TRIALS_PER_MEMORY_COUNT
    : DEFAULT_TRAINING_TOTAL_ROUNDS;
  const [adaptiveOffset, setAdaptiveOffset] = useState(0);
  const [round, setRound] = useState(1);

  const [currentMemorizeItems, setCurrentMemorizeItems] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [readyCountdown, setReadyCountdown] = useState(5);
  const [memorizeCountdown, setMemorizeCountdown] = useState(0);
  const [answerCountdown, setAnswerCountdown] = useState(15);

  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [lastRecord, setLastRecord] = useState(null);
  const [backgroundWarning, setBackgroundWarning] = useState(false);
  const [idleHintActive, setIdleHintActive] = useState(false);

  const [motionTick, setMotionTick] = useState(0);

  useEffect(() => {
    audioRef.current = new Audio(clickSfx);
  }, []);

  useEffect(() => {
    return () => {
      if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
      [roundTransitionRef, backgroundWarningTimerRef, idleHintTimerRef].forEach((timerRef) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
      });
    };
  }, []);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    const activeConfig = DIFFICULTY_CONFIGS[clampNumber(baseDifficulty + adaptiveOffset, 1, 6)];

    if (phase !== "memorize" || activeConfig.motion === "none") {
      return undefined;
    }

    const timer = setInterval(() => {
      setMotionTick((prev) => prev + 1);
    }, 120);

    return () => clearInterval(timer);
  }, [phase, baseDifficulty, adaptiveOffset]);

  const playClick = () => {
    if (!audioRef.current) return;

    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (error) {
      console.warn("[TrainingPage_PM] 音效播放失敗：", error);
    }
  };

  const getDifficultyConfig = () => {
    const difficultyLevel = clampNumber(baseDifficulty + adaptiveOffset, 1, 6);
    const preset = DIFFICULTY_CONFIGS[difficultyLevel] || DIFFICULTY_CONFIGS[1];
    const roundProgress = Math.max(0, round - 1);
    const spanInfo = getSpanInfoForRound(round, baseDifficulty);

    // 每個記憶跨度固定 2 題。AI 自適應只調整時間、干擾與動畫，不降低目前跨度。
    const memoryCount = Math.min(spanInfo.memorySpan, ALL_ITEMS.length);

    const showTime = Math.max(
      preset.showTime - Math.floor(roundProgress / SPAN_TRIALS_PER_MEMORY_COUNT) * 0.25,
      preset.minShowTime
    );

    return {
      ...preset,
      difficulty: difficultyLevel,
      broadDifficulty: getBroadDifficultyKey(difficultyLevel),
      label: `第 ${trainingStage.level} 關`,
      memoryCount,
      memorySpan: memoryCount,
      memorySpanIndex: spanInfo.memorySpanIndex,
      memorySpanTotal: spanInfo.memorySpanTotal,
      spanTrialIndex: spanInfo.spanTrialIndex,
      spanTrialTotal: spanInfo.spanTrialTotal,
      spanPlan: spanInfo.spanPlan,
      showTime,
      answerTime: preset.answerTime,
      adaptiveOffset,
      baseDifficulty,
    };
  };

  const currentConfig = getDifficultyConfig();

  const clearTimeoutRef = (timerRef) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const clearAnimationFrameRef = (frameRef) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  const resetRoundViewState = ({ resetFeedback = true } = {}) => {
    setSelectedIds([]);
    setCurrentMemorizeItems([]);
    setCurrentOptions([]);

    if (resetFeedback) {
      setFeedbackText("");
      setFeedbackType("success");
      setLastRecord(null);
    }
  };

  const enterReadyCountdown = ({ resetFeedback = true } = {}) => {
    resetRuntimeRefs();
    resetRoundViewState({ resetFeedback });
    answerStartRef.current = performance.now();
    setReadyCountdown(5);
    setPhase("readyCountdown");
  };

  const resetRuntimeRefs = () => {
    clearAnimationFrameRef(answerStartFrameRef);
    clearTimeoutRef(backgroundWarningTimerRef);
    clearTimeoutRef(idleHintTimerRef);
    answerStartRef.current = null;
    tapLogsRef.current = [];
    selectedIdsRef.current = [];
    hasSubmittedRef.current = false;
    setBackgroundWarning(false);
    setIdleHintActive(false);
  };

  const setupRound = () => {
    const config = getDifficultyConfig();

    const memorizeItems = shuffleArray(ALL_ITEMS).slice(0, config.memoryCount);

    // 選項最多顯示 8 個，但必須先完整保留所有正確答案。
    // 舊寫法把答案和干擾項一起洗牌後再 slice(0, 8)，會隨機切掉正確答案。
    const maxOptionCount = Math.min(8, ALL_ITEMS.length);
    const availableDistractorSlots = Math.max(
      0,
      maxOptionCount - memorizeItems.length
    );
    const distractorCount = Math.min(
      ALL_ITEMS.length - memorizeItems.length,
      config.memoryCount + config.distractorExtra,
      availableDistractorSlots
    );

    const distractors = shuffleArray(
      ALL_ITEMS.filter(
        (item) => !memorizeItems.some((memoryItem) => memoryItem.id === item.id)
      )
    ).slice(0, distractorCount);

    // 只洗牌、不再裁切，確保 memorizeItems 每一個都一定出現在選項中。
    const options = shuffleArray([...memorizeItems, ...distractors]);

    resetRuntimeRefs();

    setCurrentMemorizeItems(memorizeItems);
    setCurrentOptions(options);
    setSelectedIds([]);
    setMemorizeCountdown(config.showTime);
    setAnswerCountdown(config.answerTime);
    setFeedbackText("");
    setFeedbackType("success");
    setLastRecord(null);
    setPhase("memorize");

    console.log("[TrainingPage_PM] setup round:", {
      stageLabel: config.label,
      difficultyLevel: config.difficulty,
      difficultyLabel: config.shortLabel,
      adaptiveOffset: config.adaptiveOffset,
      round,
      memoryCount: config.memoryCount,
      memorySpan: config.memorySpan,
      spanTrialIndex: config.spanTrialIndex,
      spanTrialTotal: config.spanTrialTotal,
      showTime: config.showTime,
      answerTime: config.answerTime,
      correctIds: memorizeItems.map((item) => item.id),
      optionIds: options.map((item) => item.id),
    });
  };

  const handleRestartStage = () => {
    playClick();

    recordsRef.current = [];
    finalResultRef.current = null;
    resetRuntimeRefs();
    resetRoundViewState();

    setRound(1);
    setAdaptiveOffset(0);
    setReadyCountdown(5);
    setMemorizeCountdown(0);
    setAnswerCountdown(15);
    setPhase("rules");
  };

  const handleStart = () => {
    playClick();
    setPhase("introVideo");
  };

  const handleIntroVideoEnd = () => {
    playClick();
    setPhase("stepVideo");
  };

  const handleStepVideoEnd = () => {
    playClick();
    enterReadyCountdown();
  };

  const handleEndingVideoEnd = () => {
    const finalResult = finalResultRef.current;

    if (!finalResult) return;

    setPhase("result");
  };

  const navigateToResult = () => {
    playClick();
    const finalResult = finalResultRef.current;

    if (!finalResult) return;

    navigate("/result-picture-memory", {
      state: finalResult,
    });
  };

  useEffect(() => {
    if (phase !== "readyCountdown") return undefined;

    if (readyCountdown <= 0) {
      answerStartRef.current = performance.now();
      setupRound();
      return undefined;
    }

    const timer = setTimeout(() => {
      setReadyCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, readyCountdown]);

  useEffect(() => {
    if (phase !== "memorize") return undefined;

    if (memorizeCountdown <= 0) {
      const config = getDifficultyConfig();

      setAnswerCountdown(config.answerTime);
      setPhase("answer");
      answerStartRef.current = null;
      clearAnimationFrameRef(answerStartFrameRef);
      answerStartFrameRef.current = requestAnimationFrame(() => {
        answerStartRef.current = performance.now();
      });

      return undefined;
    }

    const timer = setTimeout(() => {
      setMemorizeCountdown((prev) => Math.max(0, +(prev - 0.5).toFixed(1)));
    }, 500);

    return () => clearTimeout(timer);
  }, [phase, memorizeCountdown]);

  useEffect(() => {
    if (phase !== "answer") return undefined;
    if (hasSubmittedRef.current) return undefined;

    if (answerCountdown <= 0) {
      finalizeAnswer({
        isTimeout: true,
        forceSelectedIds: selectedIdsRef.current,
      });

      return undefined;
    }

    const timer = setTimeout(() => {
      setAnswerCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, answerCountdown]);

  useEffect(() => {
    if (phase !== "answer" || hasSubmittedRef.current || selectedIds.length > 0) {
      clearTimeoutRef(idleHintTimerRef);
      setIdleHintActive(false);
      return undefined;
    }

    idleHintTimerRef.current = setTimeout(() => {
      setIdleHintActive(true);
    }, 5500);

    return () => {
      clearTimeoutRef(idleHintTimerRef);
    };
  }, [phase, selectedIds.length, round]);

  const toggleSelect = (itemId) => {
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;

    playClick();

    clearTimeoutRef(idleHintTimerRef);
    setIdleHintActive(false);

    const correctIds = currentMemorizeItems.map((item) => item.id);
    const prevSelected = selectedIdsRef.current;
    const alreadySelected = prevSelected.includes(itemId);

    let nextSelected = prevSelected;

    if (alreadySelected) {
      nextSelected = prevSelected.filter((id) => id !== itemId);
    } else if (prevSelected.length < currentConfig.memoryCount) {
      nextSelected = [...prevSelected, itemId];
    }

    if (nextSelected === prevSelected) return;

    const now = getSafeElapsedTime(answerStartRef.current);

    const newLog = {
      order: tapLogsRef.current.length + 1,
      itemId,
      timestamp: now,
      action: alreadySelected ? "deselect" : "select",
      isCorrectItem: correctIds.includes(itemId),
      selectedCountAfter: nextSelected.length,
    };

    tapLogsRef.current = [...tapLogsRef.current, newLog];
    selectedIdsRef.current = nextSelected;

    setSelectedIds(nextSelected);
  };

  const finalizeAnswer = ({ isTimeout = false, forceSelectedIds = null }) => {
    if (hasSubmittedRef.current) return;

    const config = getDifficultyConfig();
    const finalSelectedIds = forceSelectedIds || selectedIdsRef.current;
    const correctIds = currentMemorizeItems.map((item) => item.id);

    const reactionTime = isTimeout
      ? safeNonNegative(config.answerTime * 1000, 0)
      : getSafeElapsedTime(answerStartRef.current);

    const isCorrect =
      !isTimeout && arraysEqualAsSet(finalSelectedIds, correctIds);

    const wrongTapCount = tapLogsRef.current.filter(
      (tap) => tap.action === "select" && !tap.isCorrectItem
    ).length;

    const deselectCount = tapLogsRef.current.filter(
      (tap) => tap.action === "deselect"
    ).length;

    const firstTapTime =
      tapLogsRef.current.length > 0 ? tapLogsRef.current[0].timestamp : 0;

    const roundAIResult = calculatePMAIScore({
      accuracy: isCorrect ? 1 : 0,
      avgReactionTime: reactionTime,
      timeoutCount: isTimeout ? 1 : 0,
      totalTrials: 1,
      totalWrongTapCount: wrongTapCount,
      fatigueLevel: 0,
      difficultyLevel: config.difficulty,
    });

    const record = {
      task: "PM_TRAINING",
      level: round,
      round,
      trialIndex: round,
      difficulty: config.broadDifficulty,
      difficultyLevel: config.difficulty,
      internalDifficulty: config.difficulty,
      difficultyLabel: config.shortLabel,
      stageLabel: config.label,
      broadDifficulty: config.broadDifficulty,
      motionMode: config.motion,
      adaptiveOffset: config.adaptiveOffset,
      memoryCount: config.memoryCount,
      memorySpan: config.memorySpan,
      memorySpanIndex: config.memorySpanIndex,
      memorySpanTotal: config.memorySpanTotal,
      spanTrialIndex: config.spanTrialIndex,
      spanTrialTotal: config.spanTrialTotal,
      showTime: config.showTime,
      answerTimeLimit: config.answerTime,

      isCorrect,
      isTimeout,
      isFast: reactionTime > 0 && reactionTime <= 5000,
      aiRoundScore: roundAIResult.aiScore,

      reactionTime,
      firstTapTime,
      wrongTapCount,
      deselectCount,

      selectedIds: finalSelectedIds,
      correctIds,
      tapLogs: tapLogsRef.current,

      createdAt: new Date().toISOString(),
    };

    hasSubmittedRef.current = true;

    recordsRef.current = [...recordsRef.current, record];
    setLastRecord(record);

    if (isTimeout) {
      setFeedbackText("湖中小精靈等太久了，這次先休息一下。");
      setFeedbackType("error");
    } else if (isCorrect) {
      setFeedbackText("答對了，你幫兔子妹妹找回物品了！");
      setFeedbackType("success");
    } else {
      setFeedbackText("這次找錯了，兔子妹妹還需要你再幫一次。");
      setFeedbackType("error");
    }

    console.log("[TrainingPage_PM] record saved:", record);

    const spanStopStatus = shouldStopBySpanFailure(recordsRef.current, config.memoryCount);
    const isTrainingComplete = recordsRef.current.length >= trainingTotalRounds;

    if (isTrainingComplete || spanStopStatus.shouldStop) {
      handleEndTraining({
        withClick: false,
        earlyStopReason: spanStopStatus.reason,
        stoppedMemorySpan: spanStopStatus.shouldStop ? config.memoryCount : null,
      });
      return;
    }

    clearTimeoutRef(roundTransitionRef);
    const nextRound = Math.min(trainingTotalRounds, round + 1);

    roundTransitionRef.current = setTimeout(() => {
      roundTransitionRef.current = null;
      updateAdaptiveDifficulty();
      setRound(nextRound);
      enterReadyCountdown({ resetFeedback: false });
    }, 200);
  };

  const handleSubmit = () => {
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;
    if (selectedIdsRef.current.length !== currentConfig.memoryCount) return;

    playClick();

    finalizeAnswer({
      isTimeout: false,
      forceSelectedIds: selectedIdsRef.current,
    });
  };

  const updateAdaptiveDifficulty = () => {
    const records = recordsRef.current || [];
    const recentThree = records.slice(-3);
    const recentTwo = records.slice(-2);

    if (recentThree.length >= 3) {
      const recentCorrect = recentThree.filter((record) => record.isCorrect).length;
      const recentTimeout = recentThree.filter((record) => record.isTimeout).length;
      const recentAiScore =
        recentThree.reduce((sum, record) => sum + safeNonNegative(record.aiRoundScore, 0), 0) /
        recentThree.length;

      if (recentCorrect === 3 && recentAiScore >= 82) {
        setAdaptiveOffset((prev) => clampNumber(prev + 1, -2, 2));
        return;
      }

      if (recentCorrect <= 1 || recentTimeout >= 2 || recentAiScore < 45) {
        setAdaptiveOffset((prev) => clampNumber(prev - 1, -2, 2));
        return;
      }
    }

    if (recentTwo.length === 2 && recentTwo.every((record) => record.isTimeout)) {
      setAdaptiveOffset((prev) => clampNumber(prev - 1, -2, 2));
    }
  };

  const handleNext = () => {
    playClick();
    if (roundTransitionRef.current) return;

    const nextRound = Math.min(trainingTotalRounds, round + 1);
    roundTransitionRef.current = setTimeout(() => {
      roundTransitionRef.current = null;
      updateAdaptiveDifficulty();
      setRound(nextRound);
      enterReadyCountdown();
    }, 200);
  };

  const handleRetrySameRound = () => {
    playClick();
    enterReadyCountdown();
  };

  const handleBackToMap = () => {
    playClick();
    navigate("/game-menu");
  };

  const handleEndTraining = ({ withClick = true, earlyStopReason = null, stoppedMemorySpan = null } = {}) => {
    if (withClick) playClick();

    const records = recordsRef.current || [];
    const totalTrials = records.length;
    const correctTrials = records.filter((record) => record.isCorrect).length;
    const reactionTimes = records
      .map((record) => safeNonNegative(record.reactionTime, 0))
      .filter((rt) => Number.isFinite(rt) && rt > 0);

    const errorTypes = records.reduce(
      (acc, record) => {
        if (record.isTimeout) acc.timeout += 1;
        if (!record.isCorrect && !record.isTimeout) acc.wrongTarget += 1;
        acc.randomClick += record.wrongTapCount || 0;
        acc.repeatedClick += record.deselectCount || 0;
        if (!record.isTimeout && (!record.selectedIds || record.selectedIds.length === 0)) {
          acc.miss += 1;
        }
        return acc;
      },
      {
        miss: 0,
        randomClick: 0,
        wrongTarget: 0,
        repeatedClick: 0,
        timeout: 0,
        sequenceError: 0,
        ruleSwitchError: 0,
      }
    );

    const mid = Math.ceil(reactionTimes.length / 2);
    const firstHalf = reactionTimes.slice(0, mid);
    const secondHalf = reactionTimes.slice(mid);
    const average = (list) =>
      list.length > 0
        ? list.reduce((sum, value) => sum + value, 0) / list.length
        : 0;

    const firstHalfRT = average(firstHalf);
    const secondHalfRT = average(secondHalf);
    const firstHalfMiss = records
      .slice(0, Math.ceil(records.length / 2))
      .filter((record) => record.isTimeout || !record.isCorrect).length;
    const secondHalfMiss = records
      .slice(Math.ceil(records.length / 2))
      .filter((record) => record.isTimeout || !record.isCorrect).length;

    const rawPerformanceResult = analyzePerformance({
      totalTrials,
      correctTrials,
      reactionTimes,
      errorTypes,
      difficulty: currentConfig.broadDifficulty,
    });

    const performanceResult = {
      ...rawPerformanceResult,
      accuracy: safeNonNegative(rawPerformanceResult?.accuracy, totalTrials > 0 ? correctTrials / totalTrials : 0),
      avgReactionTime: safeNonNegative(rawPerformanceResult?.avgReactionTime, 0),
      stars: clampStarCount(rawPerformanceResult?.stars || 1),
    };

    const errorResult = analyzeErrors(errorTypes);

    const rawFatigueLevel = analyzeFatigue({
      firstHalfRT: safeNonNegative(firstHalfRT, 0),
      secondHalfRT: safeNonNegative(secondHalfRT, 0),
      missIncrease: Math.max(0, secondHalfMiss - firstHalfMiss),
    });
    const fatigueLevel = safeNumber(rawFatigueLevel, 0);

    const recommendedDifficulty = safeRecommendedDifficulty({
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      errorTypes,
      fatigueLevel,
    });

    const accuracy = totalTrials > 0 ? correctTrials / totalTrials : 0;
    const avgReactionTime =
      reactionTimes.length > 0
        ? reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length
        : 0;
    const scoring = safeCalculatePMScore(records, {
      mode: "training",
      plannedTotalRounds: trainingTotalRounds,
    });

    const officialScore = safeNonNegative(scoring?.totalScore, 0);
    const stars = clampStarCount(scoring?.stars || 1);

    const totalWrongTapCount = records.reduce(
      (sum, record) => sum + safeNonNegative(record.wrongTapCount, 0),
      0
    );
    const pmAIResult = analyzePMTraining({
      records,
      accuracy,
      avgReactionTime,
      timeoutCount: errorTypes.timeout,
      totalTrials,
      totalWrongTapCount,
      fatigueLevel,
      difficultyLevel: currentConfig.difficulty,
    });

    const finalResult = {
      gameId: "PM",
      gameKey: "pm",
      abilityType: "memory",
      mode: "training",
      stageId: trainingStage.stageId,
      trainingLevel: trainingStage.level,
      trainingOrder: trainingStage.order,
      trainingTotal: trainingStage.total,
      difficulty: currentConfig.broadDifficulty,
      difficultyLevel: currentConfig.difficulty,
      difficultyLabel: currentConfig.shortLabel,
      baseDifficultyLevel: currentConfig.baseDifficulty,
      adaptiveOffset: currentConfig.adaptiveOffset,
      records,
      totalTrials,
      correctTrials,
      plannedTotalRounds: trainingTotalRounds,
      completedByRule: !earlyStopReason,
      earlyStopReason,
      stoppedMemorySpan,
      spanTrialsPerMemoryCount: SPAN_TRIALS_PER_MEMORY_COUNT,
      spanPlan: trainingSpanPlan,
      errorTypes,
      scoring,
      timeoutRate: pmAIResult.timeoutRate,
      wrongTapRate: pmAIResult.wrongTapRate,
      aiScore: pmAIResult.aiScore,
      aiDifficultyDecision: pmAIResult.difficultyDecision,
      aiTrainingSuggestion: pmAIResult.trainingSuggestion,
      aiSubScores: {
        accuracyScore: pmAIResult.accuracyScore,
        reactionScore: pmAIResult.reactionScore,
        stabilityScore: pmAIResult.stabilityScore,
        focusScore: pmAIResult.focusScore,
        fatigueScore: pmAIResult.fatigueScore,
      },
      ...performanceResult,
      stars,
      score: officialScore,
      totalScore: officialScore,
      ...errorResult,
      fatigueLevel,
      recommendedDifficulty,
      visibleRoles: ["child", "parent", "clinician"],
      createdAt: new Date().toISOString(),
    };

    finalResultRef.current = finalResult;

    try {
      saveUnifiedResult({
        rawResult: finalResult,
        gameId: "PM",
        mode: "training",
        difficulty: currentConfig.broadDifficulty,
        route: "/training-picture-memory",
        visibleRoles: ["child", "parent", "clinician"],
      });
    } catch (error) {
      console.warn("[TrainingPage_PM] 統一結果儲存失敗：", error);
    }

    safeStorageSetJson("pmTrainingResult", finalResult);
    safeStorageSetJson("latestPMTrainingResult", finalResult);
    saveTrainingStageProgress({
      stageId: trainingStage.stageId,
      level: trainingStage.level,
      stars,
      finalResult,
    });
    setPhase("endingVideo");
  };

  const handleGameAreaClick = () => {
    if (phase !== "answer" || hasSubmittedRef.current) return;

    setBackgroundWarning(true);
    clearTimeoutRef(backgroundWarningTimerRef);
    backgroundWarningTimerRef.current = setTimeout(() => {
      setBackgroundWarning(false);
    }, 450);
  };

  const intensity = Math.min(1, (round - 1) / 8);
  const resultStars = clampStarCount(finalResultRef.current?.stars || 1);

  const buttonMouse = (
    <img
      src={mouseGuideImg}
      alt="提示點擊"
      aria-hidden="true"
      style={{ ...styles.mouseGuide, ...styles.mouseOnButton }}
    />
  );

  const renderImageButton = ({ src, alt, onClick, variant = "main", disabled = false }) => (
    <div style={styles.guidedAction}>
      <button
        type="button"
        style={{
          ...(variant === "result" ? styles.resultImageButton : styles.imageButton),
          ...(variant === "skip" ? styles.skipImageButton : {}),
          ...(disabled ? styles.disabledImageButton : {}),
        }}
        onClick={onClick}
        aria-label={alt}
        disabled={disabled}
      >
        <img src={src} alt={alt} style={styles.imageButtonImg} />
      </button>
      {buttonMouse}
    </div>
  );

  return (
    <div style={styles.page(bgImage)}>
      <style>{`
        @keyframes pmMouseTap {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.92; }
          45% { transform: translate(-10px, -9px) scale(1.08); opacity: 1; }
          62% { transform: translate(-4px, -4px) scale(0.96); opacity: 1; }
        }
        @keyframes pmIdleHint {
          0%, 100% { transform: scale(1); box-shadow: 0 10px 20px rgba(77, 53, 30, 0.12), inset 0 -4px 0 rgba(233, 179, 91, 0.14); }
          50% { transform: scale(1.035); box-shadow: 0 14px 24px rgba(80, 112, 58, 0.18), 0 0 0 7px rgba(139, 216, 86, 0.18); }
        }
        button[aria-label]:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.03);
          filter: brightness(1.04);
        }
        button[aria-label]:active:not(:disabled) {
          transform: translateY(1px) scale(0.98);
        }
      `}</style>
      <div style={styles.overlay}>
        <div style={styles.container}>
          {phase === "rules" && (
            <div style={styles.startPanel}>
              <div style={styles.gameTitle}>圖片記憶任務</div>

              <div style={styles.startContent}>
                <div style={styles.dialogBubble}>
                  幫兔子妹妹記住湖邊的小物品。
                </div>
                <div style={styles.roundIcon}>
                  <img src={rabbitAvatar} alt="兔子妹妹" style={styles.roundIconImage} />
                </div>
              </div>

              {renderImageButton({ src: homeStartBtn, alt: "開始遊戲", onClick: handleStart })}
            </div>
          )}

          {phase === "introVideo" && (
            <div style={styles.videoPanel}>
              <div style={styles.videoFrame}>
                <video
                  src={introVideo}
                  style={styles.video}
                  autoPlay
                  playsInline
                  controls={false}
                  onEnded={handleIntroVideoEnd}
                />
              </div>

              {renderImageButton({
                src: homeSkipBtn,
                alt: "跳過動畫",
                variant: "skip",
                onClick: handleIntroVideoEnd,
              })}
            </div>
          )}

          {phase === "stepVideo" && (
            <div style={styles.videoPanel}>
              <div style={styles.videoFrame}>
                <video
                  src={stepVideo}
                  style={styles.video}
                  autoPlay
                  playsInline
                  controls={false}
                  onEnded={handleStepVideoEnd}
                />
              </div>

              {renderImageButton({
                src: homeNextBtn,
                alt: "下一步",
                onClick: handleStepVideoEnd,
              })}
            </div>
          )}

          {phase === "readyCountdown" && (
            <div style={styles.smallCard}>
              <p style={styles.kicker}>第 {round} / {trainingTotalRounds} 題｜{currentConfig.memorySpan} 張第 {currentConfig.spanTrialIndex} / {currentConfig.spanTrialTotal} 題</p>
              <h1 style={styles.title}>看清楚湖裡的小物品</h1>
              <div style={styles.bigCountdown}>{readyCountdown}</div>
              <p style={styles.textCompact}>皮皮會陪你一起看，等湖面亮起來就開始。</p>
            </div>
          )}

          {phase === "memorize" && (
            <div style={styles.card}>
              <p style={styles.kicker}>第 {round} / {trainingTotalRounds} 題｜{currentConfig.memorySpan} 張第 {currentConfig.spanTrialIndex} / {currentConfig.spanTrialTotal} 題</p>
              <h1 style={styles.title}>看清楚湖裡的小物品</h1>

              <div style={styles.iconHint}>
                <span>請記住這些圖片</span>
              </div>

              <div style={styles.memoryGrid}>
                {currentMemorizeItems.map((item, index) => {
                  const imageStyle = { ...styles.memoryImage };

                  if (currentConfig.motion === "flicker") {
                    const flickerValue = 0.7 + 0.3 * Math.sin(motionTick * 0.9 + index * 1.3 + round * 0.4);
                    imageStyle.opacity = Math.max(0.45, flickerValue - intensity * 0.15);
                  }

                  if (currentConfig.motion === "move") {
                    const offset = Math.sin(motionTick * 0.45 + index) * (10 + intensity * 20);
                    imageStyle.transform = `translateX(${offset}px)`;
                  }

                  return (
                    <div key={item.id} style={styles.memoryCard}>
                      <img src={item.image} alt={item.id} style={imageStyle} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "answer" && (
            <div
              style={{
                ...styles.card,
                ...(backgroundWarning ? styles.warningCard : {}),
              }}
              onClick={handleGameAreaClick}
            >
              <p style={styles.kicker}>第 {round} / {trainingTotalRounds} 題｜{currentConfig.memorySpan} 張第 {currentConfig.spanTrialIndex} / {currentConfig.spanTrialTotal} 題</p>
              <h1 style={styles.title}>找回剛剛看過的物品</h1>

              <div style={styles.iconHint}>
                <span>已找到 {selectedIds.length} / {currentConfig.memoryCount}</span>
              </div>

              {backgroundWarning && (
                <div style={styles.backgroundWarning}>先看清楚圖片，再點選物品喔！</div>
              )}

              <div style={styles.optionGrid}>
                {currentOptions.map((item) => {
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      style={{
                        ...styles.optionCard,
                        ...(idleHintActive && selectedIds.length === 0 ? styles.optionCardIdleHint : {}),
                        ...(isSelected ? styles.optionCardSelected : {}),
                      }}
                    >
                      <img src={item.image} alt={item.id} style={styles.optionImage} />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                style={{
                  ...styles.mainButton,
                  opacity: selectedIds.length === currentConfig.memoryCount ? 1 : 0.5,
                  cursor: selectedIds.length === currentConfig.memoryCount ? "pointer" : "not-allowed",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSubmit();
                }}
                disabled={selectedIds.length !== currentConfig.memoryCount}
              >
                放進小籃子
              </button>
            </div>
          )}

          {phase === "endingVideo" && (
            <div style={styles.videoPanel}>
              <div style={styles.videoFrame}>
                <video
                  src={endingVideo}
                  style={styles.video}
                  autoPlay
                  playsInline
                  controls={false}
                  onEnded={handleEndingVideoEnd}
                />
              </div>

              {renderImageButton({
                src: homeSkipBtn,
                alt: "跳過動畫",
                variant: "skip",
                onClick: () => {
                  playClick();
                  handleEndingVideoEnd();
                },
              })}
            </div>
          )}

          {phase === "result" && (
            <div style={styles.resultPanel}>
              <div style={styles.starRow} aria-label={`${resultStars} 顆星`}>
                {[1, 2, 3].map((star, index) => {
                  const curveStyles = [styles.starLeft, styles.starCenter, styles.starRight];
                  return (
                    <span key={star} style={{ ...styles.starShell, ...curveStyles[index] }}>
                      <svg viewBox="0 0 100 95" style={styles.starSvg} aria-hidden="true">
                        <path
                          d="M50 3 L61.8 34.2 L95 36.1 L69 56.8 L77.6 89 L50 71.2 L22.4 89 L31 56.8 L5 36.1 L38.2 34.2 Z"
                          style={star <= resultStars ? styles.starPathOn : styles.starPathOff}
                        />
                        {star <= resultStars && (
                          <>
                            <path d="M48 14 C53 14 55 26 53 34 C51 42 46 43 43 38 C40 32 42 15 48 14 Z" style={styles.starHighlight} />
                            <path d="M72 43 C80 43 84 47 82 53 C80 60 70 61 66 56 C62 51 65 44 72 43 Z" style={styles.starShadow} />
                          </>
                        )}
                      </svg>
                    </span>
                  );
                })}
              </div>

              <div style={styles.startContent}>
                <div style={styles.dialogBubble}>訓練完成！跟著小手回到森林吧。</div>
                <div style={styles.roundIcon}>
                  <img src={rabbitAvatar} alt="兔子妹妹" style={styles.roundIconImage} />
                </div>
              </div>

              <div style={styles.resultActions}>
                <div style={styles.guidedAction}>
                  <button type="button" style={styles.resultImageButton} onClick={handleBackToMap} aria-label="回到森林">
                    <img src={homeBackBtn} alt="回到森林" style={styles.imageButtonImg} />
                  </button>
                  <img src={mouseGuideImg} alt="提示回到森林" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
                </div>
                <button type="button" style={styles.resultImageButton} onClick={handleRestartStage} aria-label="再玩一次">
                  <img src={homeAgainBtn} alt="再玩一次" style={styles.imageButtonImg} />
                </button>
                <button type="button" style={styles.resultImageButton} onClick={navigateToResult} aria-label="詳細結果">
                  <img src={homeResultBtn} alt="詳細結果" style={styles.imageButtonImg} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const forestFont = "'jf-openhuninn', 'Fredoka', 'Nunito', 'Microsoft JhengHei', sans-serif";

const glossyGreen = "linear-gradient(180deg, #b7f05d 0%, #7fca36 46%, #4f9827 100%)";
const softCream = "linear-gradient(180deg, rgba(255, 252, 225, 0.98) 0%, rgba(255, 242, 185, 0.98) 52%, rgba(255, 229, 145, 0.98) 100%)";
const leafShadow = "0 18px 0 rgba(194, 125, 33, 0.14), 0 22px 36px rgba(86, 61, 27, 0.18)";

const styles = {
  page: (bgImage) => ({
    height: "100dvh",
    minHeight: "100dvh",
    width: "100%",
    overflow: "hidden",
    backgroundImage: `url(${bgImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    fontFamily: forestFont,
    touchAction: "manipulation",
  }),

  overlay: {
    height: "100dvh",
    width: "100%",
    overflow: "hidden",
    background:
      "radial-gradient(circle at 50% 24%, rgba(255,255,220,0.24) 0%, rgba(255,255,255,0.08) 42%, rgba(69,118,38,0.08) 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "clamp(10px, 1.5vw, 20px)",
    boxSizing: "border-box",
  },

  container: {
    width: "100%",
    maxWidth: "1180px",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  startPanel: {
    width: "min(78vw, 820px)",
    minHeight: "min(68vh, 610px)",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.92)",
    outlineOffset: "-12px",
    borderRadius: "58px",
    boxSizing: "border-box",
    boxShadow: leafShadow,
    padding: "clamp(30px, 4.6vw, 54px) clamp(34px, 5vw, 62px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(24px, 3.8vw, 42px)",
  },

  resultPanel: {
    width: "min(82vw, 920px)",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.92)",
    outlineOffset: "-12px",
    borderRadius: "58px",
    boxSizing: "border-box",
    boxShadow: leafShadow,
    padding: "clamp(34px, 4vw, 58px) clamp(30px, 5vw, 64px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(22px, 3vw, 34px)",
    position: "relative",
  },

  gameTitle: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "min(82%, 560px)",
    padding: "14px 44px 18px",
    borderRadius: "24px",
    border: "4px solid #f2ad35",
    outline: "2px solid rgba(255, 235, 160, 0.9)",
    outlineOffset: "-10px",
    background: "linear-gradient(180deg, #fff2ab 0%, #ffd764 100%)",
    color: "#744018",
    fontSize: "clamp(42px, 4.6vw, 62px)",
    fontWeight: 900,
    lineHeight: 1.08,
    letterSpacing: "0.04em",
    textShadow: "0 3px 0 rgba(255,255,255,0.78)",
    boxShadow: "0 8px 0 rgba(178, 103, 21, 0.18), inset 0 -4px 0 rgba(177, 116, 20, 0.12)",
  },

  startContent: {
    width: "min(100%, 760px)",
    display: "grid",
    gridTemplateColumns: "minmax(300px, 1fr) 172px",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(28px, 4vw, 54px)",
  },

  dialogBubble: {
    minHeight: "132px",
    border: "4px solid #ffb545",
    outline: "3px dashed rgba(238, 178, 76, 0.38)",
    outlineOffset: "-15px",
    borderRadius: "34px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,252,238,0.96))",
    color: "#744018",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "22px 34px",
    fontSize: "clamp(28px, 3vw, 40px)",
    lineHeight: 1.28,
    fontWeight: 900,
    textAlign: "center",
    boxSizing: "border-box",
    boxShadow: "0 8px 0 rgba(234, 171, 77, 0.16), inset 0 0 0 6px rgba(255, 239, 190, 0.3)",
  },

  roundIcon: {
    width: "172px",
    height: "172px",
    borderRadius: "999px",
    background: "linear-gradient(180deg, #7fdcff 0%, #43aee5 100%)",
    border: "4px solid #f7d35a",
    outline: "3px dashed rgba(255,255,255,0.72)",
    outlineOffset: "-12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxSizing: "border-box",
    padding: "14px",
    boxShadow: "0 12px 0 rgba(50, 114, 169, 0.16), 0 16px 22px rgba(44, 83, 139, 0.18)",
  },

  roundIconImage: {
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    borderRadius: "999px",
    display: "block",
    pointerEvents: "none",
  },

  card: {
    width: "min(92vw, 1080px)",
    maxHeight: "calc(100dvh - 26px)",
    overflow: "hidden",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.86)",
    outlineOffset: "-12px",
    borderRadius: "54px",
    padding: "clamp(16px, 2.1vw, 28px) clamp(18px, 2.4vw, 34px)",
    boxShadow: leafShadow,
    textAlign: "center",
    boxSizing: "border-box",
  },

  warningCard: {
    borderColor: "#ff5f5f",
    boxShadow: "0 0 0 7px rgba(255, 93, 93, 0.2), 0 18px 0 rgba(194, 125, 33, 0.14), 0 22px 36px rgba(86, 61, 27, 0.18)",
  },

  backgroundWarning: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
    padding: "8px 18px",
    borderRadius: "999px",
    background: "rgba(255, 86, 86, 0.94)",
    color: "#ffffff",
    border: "3px solid rgba(255,255,255,0.9)",
    fontSize: "clamp(17px, 1.9vw, 22px)",
    fontWeight: 900,
    boxShadow: "0 6px 0 rgba(139, 41, 41, 0.18)",
  },

  smallCard: {
    width: "min(88vw, 760px)",
    maxHeight: "calc(100dvh - 28px)",
    overflow: "hidden",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.86)",
    outlineOffset: "-12px",
    borderRadius: "54px",
    padding: "clamp(28px, 4vw, 44px)",
    boxShadow: leafShadow,
    textAlign: "center",
    boxSizing: "border-box",
  },

  mediumCard: {
    width: "min(92vw, 900px)",
    maxHeight: "calc(100dvh - 28px)",
    overflow: "hidden",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.86)",
    outlineOffset: "-12px",
    borderRadius: "54px",
    padding: "clamp(16px, 2vw, 28px)",
    boxShadow: leafShadow,
    textAlign: "center",
    boxSizing: "border-box",
  },

  kicker: {
    display: "inline-block",
    background: "linear-gradient(180deg, #fff5c9, #ffe28c)",
    color: "#8a531d",
    border: "2px solid rgba(243, 181, 75, 0.55)",
    borderRadius: "999px",
    padding: "7px 18px",
    margin: "0 0 10px",
    fontSize: "clamp(16px, 1.8vw, 20px)",
    fontWeight: 900,
    boxShadow: "inset 0 -3px 0 rgba(140, 92, 35, 0.12)",
  },

  title: {
    fontSize: "clamp(28px, 3.7vw, 46px)",
    fontWeight: 900,
    color: "#744018",
    textShadow: "0 3px 0 rgba(255,255,255,0.78)",
    margin: "0 0 12px",
    lineHeight: 1.15,
    letterSpacing: "0.02em",
  },

  text: {
    fontSize: "clamp(19px, 2.2vw, 24px)",
    lineHeight: 1.55,
    color: "#5d3f22",
    margin: "0 0 18px",
    fontWeight: 800,
  },

  textCompact: {
    fontSize: "clamp(18px, 2.1vw, 23px)",
    lineHeight: 1.45,
    color: "#5d3f22",
    margin: "0 0 16px",
    fontWeight: 800,
  },

  storyText: {
    fontSize: "clamp(19px, 2.3vw, 24px)",
    lineHeight: 1.65,
    color: "#5d3f22",
    margin: 0,
    fontWeight: 800,
    textAlign: "left",
  },

  hintText: {
    fontSize: "clamp(18px, 2vw, 23px)",
    lineHeight: 1.45,
    color: "#5d3f22",
    margin: "0 0 16px",
    fontWeight: 800,
  },

  levelText: {
    color: "#8a531d",
    fontSize: "clamp(16px, 1.8vw, 20px)",
    fontWeight: 900,
    margin: "0 0 8px",
  },

  bigCountdown: {
    color: "#f3a536",
    fontSize: "clamp(58px, 8vw, 94px)",
    fontWeight: 900,
    lineHeight: 1,
    margin: "8px 0 18px",
    textShadow: "0 4px 0 rgba(255,255,255,0.75)",
  },

  iconHint: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    background: "rgba(255,255,255,0.74)",
    color: "#79512f",
    border: "2px solid rgba(243, 181, 75, 0.46)",
    borderRadius: "999px",
    padding: "9px 20px",
    fontSize: "clamp(18px, 2vw, 23px)",
    fontWeight: 900,
    marginBottom: "14px",
    boxShadow: "0 5px 0 rgba(176, 119, 38, 0.09)",
  },

  videoPanel: {
    width: "min(92vw, 1120px)",
    minHeight: "min(86vh, 790px)",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.86)",
    outlineOffset: "-12px",
    borderRadius: "58px",
    boxSizing: "border-box",
    boxShadow: leafShadow,
    padding: "clamp(22px, 3vw, 34px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(16px, 2vw, 22px)",
  },

  videoFrame: {
    width: "100%",
    height: "min(69vh, 635px)",
    minHeight: "430px",
    borderRadius: "34px",
    background: "linear-gradient(180deg, #36b3ff, #2f82df)",
    border: "4px solid rgba(255,255,255,0.85)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    boxShadow: "inset 0 0 0 4px rgba(41, 113, 206, 0.18), 0 14px 28px rgba(77, 53, 30, 0.16)",
  },

  videoWrapper: {
    width: "100%",
    maxWidth: "720px",
    margin: "0 auto 18px",
    borderRadius: "26px",
    overflow: "hidden",
    boxShadow: "0 12px 26px rgba(77, 53, 30, 0.2)",
    backgroundColor: "#000",
  },

  video: {
    width: "100%",
    height: "100%",
    display: "block",
    aspectRatio: "16 / 9",
    objectFit: "cover",
  },

  tutorialRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: "16px",
    alignItems: "center",
    margin: "10px 0 16px",
  },

  tutorialPanel: {
    background: "rgba(255,255,255,0.66)",
    border: "2px solid rgba(243, 181, 75, 0.36)",
    borderRadius: "26px",
    padding: "16px",
  },

  tutorialLabel: {
    margin: "0 0 12px",
    fontSize: "clamp(18px, 2vw, 22px)",
    fontWeight: 900,
    color: "#744018",
  },

  tutorialArrow: {
    fontSize: "clamp(28px, 4vw, 44px)",
    fontWeight: 900,
    color: "#8a5a28",
  },

  demoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(70px, 1fr))",
    gap: "10px",
    justifyItems: "center",
  },

  demoCard: {
    width: "clamp(82px, 9vw, 120px)",
    height: "clamp(82px, 9vw, 120px)",
    backgroundColor: "#fffdf4",
    border: "4px solid rgba(151, 105, 58, 0.15)",
    borderRadius: "999px",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxSizing: "border-box",
  },

  demoCardSelected: {
    border: "4px solid #79a85b",
    backgroundColor: "#f0ffe5",
    boxShadow: "0 10px 18px rgba(80, 112, 58, 0.16)",
  },

  demoImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "999px",
    display: "block",
    pointerEvents: "none",
  },

  memoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(128px, 1fr))",
    gap: "clamp(10px, 1.5vw, 16px)",
    marginTop: "4px",
    justifyItems: "center",
    alignItems: "center",
  },

  memoryCard: {
    background: "linear-gradient(180deg, #fffdf4, #fff3cf)",
    border: "4px solid rgba(255, 177, 57, 0.45)",
    borderRadius: "999px",
    padding: "10px",
    boxShadow: "0 10px 20px rgba(77, 53, 30, 0.12), inset 0 -4px 0 rgba(233, 179, 91, 0.14)",
    width: "clamp(120px, 15.2vw, 162px)",
    height: "clamp(120px, 15.2vw, 162px)",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  memoryImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "999px",
    display: "block",
    pointerEvents: "none",
  },

  optionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(128px, 1fr))",
    gap: "clamp(10px, 1.4vw, 15px)",
    marginTop: "2px",
    marginBottom: "14px",
    justifyItems: "center",
    alignItems: "center",
  },

  optionCard: {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    border: "4px solid rgba(255, 177, 57, 0.42)",
    borderRadius: "999px",
    padding: "10px",
    background: "linear-gradient(180deg, #fffdf4, #fff3cf)",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(77, 53, 30, 0.12), inset 0 -4px 0 rgba(233, 179, 91, 0.14)",
    transition: "transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease",
    width: "clamp(120px, 15.2vw, 162px)",
    height: "clamp(120px, 15.2vw, 162px)",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  optionCardIdleHint: {
    animation: "pmIdleHint 1.05s ease-in-out 2",
    border: "4px solid rgba(121, 200, 67, 0.7)",
  },

  optionCardSelected: {
    border: "4px solid #79c843",
    background: "linear-gradient(180deg, #f4ffe7, #dfffc4)",
    transform: "translateY(-3px) scale(1.02)",
    boxShadow: "0 14px 24px rgba(80, 112, 58, 0.18), 0 0 0 7px rgba(139, 216, 86, 0.18)",
  },

  optionImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "999px",
    display: "block",
    pointerEvents: "none",
  },

  starRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: "clamp(20px, 2.4vw, 32px)",
    height: "clamp(120px, 10vw, 152px)",
    marginTop: "calc(clamp(78px, 8vw, 112px) * -1)",
    marginBottom: "-10px",
    filter: "drop-shadow(0 8px 0 rgba(63, 76, 111, 0.14))",
    pointerEvents: "none",
  },

  starShell: {
    width: "clamp(92px, 8.6vw, 126px)",
    height: "clamp(88px, 8.1vw, 118px)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transformOrigin: "50% 80%",
  },

  starLeft: {
    transform: "translateY(12px) rotate(-14deg)",
  },

  starCenter: {
    transform: "translateY(-22px) scale(1.06)",
  },

  starRight: {
    transform: "translateY(12px) rotate(14deg)",
  },

  starSvg: {
    width: "100%",
    height: "100%",
    overflow: "visible",
  },

  starPathOn: {
    fill: "#ffd735",
    stroke: "#fff9d6",
    strokeWidth: 6,
    filter: "drop-shadow(0 4px 0 rgba(230, 160, 0, 0.34))",
  },

  starPathOff: {
    fill: "rgba(255, 251, 208, 0.68)",
    stroke: "#ffffff",
    strokeWidth: 5,
  },

  starHighlight: {
    fill: "rgba(255, 255, 153, 0.72)",
  },

  starShadow: {
    fill: "rgba(236, 155, 0, 0.52)",
  },

  resultActions: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "clamp(14px, 2vw, 22px)",
    flexWrap: "wrap",
  },

  buttonRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "14px",
    marginTop: "20px",
    flexWrap: "wrap",
  },

  mainButton: {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    minWidth: "220px",
    minHeight: "74px",
    padding: "12px 40px",
    borderRadius: "22px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(25px, 2.6vw, 38px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #347d23",
    background: glossyGreen,
    textShadow: "0 3px 0 rgba(33, 93, 24, 0.38)",
    boxShadow: "0 7px 0 rgba(43, 104, 28, 0.62), 0 12px 22px rgba(67, 93, 38, 0.18), inset 0 3px 0 rgba(255,255,255,0.35)",
    marginTop: "6px",
  },

  secondaryButton: {
    minWidth: "150px",
    minHeight: "54px",
    padding: "10px 22px",
    borderRadius: "18px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(18px, 1.8vw, 22px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #7b5642",
    background: "linear-gradient(180deg, #b6947b 0%, #8d6e63 100%)",
    boxShadow: "0 6px 0 rgba(94, 66, 53, 0.38), 0 10px 18px rgba(67, 48, 38, 0.15)",
    touchAction: "manipulation",
  },

  guidedAction: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    isolation: "isolate",
  },

  imageButton: {
    position: "relative",
    zIndex: 2,
    width: "clamp(188px, 18vw, 254px)",
    minWidth: 0,
    minHeight: 0,
    padding: 0,
    border: "none",
    outline: "none",
    borderRadius: "18px",
    background: "transparent",
    boxShadow: "none",
    lineHeight: 0,
    cursor: "pointer",
    overflow: "visible",
    transition: "transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease",
    touchAction: "manipulation",
  },

  skipImageButton: {
    width: "clamp(198px, 19vw, 266px)",
  },

  disabledImageButton: {
    opacity: 0.5,
    cursor: "not-allowed",
  },

  resultImageButton: {
    position: "relative",
    zIndex: 2,
    width: "clamp(168px, 16vw, 232px)",
    minWidth: 0,
    minHeight: 0,
    padding: 0,
    border: "none",
    outline: "none",
    borderRadius: "18px",
    background: "transparent",
    boxShadow: "none",
    lineHeight: 0,
    cursor: "pointer",
    overflow: "visible",
    transition: "transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease",
    touchAction: "manipulation",
  },

  imageButtonImg: {
    width: "100%",
    height: "auto",
    display: "block",
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserDrag: "none",
    filter: "drop-shadow(0 8px 8px rgba(74, 48, 16, 0.22))",
  },

  mouseGuide: {
    position: "absolute",
    width: "clamp(48px, 5.2vw, 78px)",
    height: "auto",
    zIndex: 8,
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserDrag: "none",
    filter: "drop-shadow(0 8px 8px rgba(58, 38, 14, 0.24))",
    animation: "pmMouseTap 1.15s ease-in-out infinite",
  },

  mouseOnButton: {
    right: "-18px",
    bottom: "-18px",
    transformOrigin: "18% 18%",
  },
};
