import React, { useEffect, useRef, useState } from "react";
<<<<<<< HEAD
import { useLocation, useNavigate } from "react-router-dom";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
=======
import { useNavigate } from "react-router-dom";
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

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
<<<<<<< HEAD
import rabbitAvatar from "../asset/avatar/rabbit.png";

import clickSfx from "../asset/Click_SRT.mp3";
import bgImage from "../asset/PM_testbackground.png";
import introVideo from "../asset/SRT_start.mp4";
import mouseGuideImg from "../asset/mouse.png";
import homeResultBtn from "../asset/home/result.png";
import homeAgainBtn from "../asset/home/again.png";
import homeBackBtn from "../asset/home/back.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeStartBtn from "../asset/home/start.png";
=======

import clickSfx from "../asset/Click_SRT.mp3";
import bgImage from "../asset/SRT_background.jpg";
import introVideo from "../asset/SRT_start.mp4";
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

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

<<<<<<< HEAD

const COMPLETED_LEVELS_STORAGE_KEY = "ef_game_completed_training_levels";
const PM_STAGE_STAR_STORAGE_KEY = "ef_game_training_stage_stars";
const MAX_LEVEL_PER_GAME = 10;
const TRAINING_TOTAL_ROUNDS = 5;

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

const getLatestPMTestResult = () => {
  const possibleKeys = [
    "pmTestResult",
    "PMTestResult",
    "pictureMemoryTestResult",
    "result_picture_memory_test",
    "ef_game_pm_test_result",
    "latestPMTestResult",
  ];

  for (const key of possibleKeys) {
    const result = safeParse(localStorage.getItem(key), null);
    if (result && typeof result === "object") return result;
  }

  const allResults = safeParse(localStorage.getItem("ef_game_test_results"), null);
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
    showTime: 6.5,
    minShowTime: 6,
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
    showTime: 6,
    minShowTime: 5.5,
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
    showTime: 5,
    minShowTime: 4.5,
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
    showTime: 4.5,
    minShowTime: 4,
    answerTime: 12,
    distractorExtra: 3,
    motion: "flicker",
    modeHint: "湖面會輕輕閃動，請專心記住真正掉進湖裡的物品。",
  },
  5: {
    level: 5,
    shortLabel: "記憶分辨",
    desc: "要記住較多物品，也要避開更多非答案選項。",
    baseMemoryCount: 4,
    maxMemoryCount: 5,
    showTime: 4,
    minShowTime: 3.5,
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
    showTime: 3.5,
    minShowTime: 3,
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

const calculateStageStars = ({ accuracy, avgReactionTime, timeoutCount, totalTrials, difficulty }) => {
  if (!totalTrials) return 1;

  let stars = 1;
  const rtTargetMap = {
    1: 11000,
    2: 10000,
    3: 9000,
    4: 8200,
    5: 7600,
    6: 7000,
  };
  const rtTarget = rtTargetMap[difficulty] || 9000;
  const timeoutRate = timeoutCount / totalTrials;

  if (accuracy >= 0.6 && timeoutRate <= 0.45) stars = 2;
  if (accuracy >= 0.82 && avgReactionTime > 0 && avgReactionTime <= rtTarget && timeoutRate <= 0.25) stars = 3;

  return stars;
};

const saveTrainingStageProgress = ({ stageId, level, stars, finalResult }) => {
  const safeStars = clampStarCount(stars);
  const completedLevels = safeParse(localStorage.getItem(COMPLETED_LEVELS_STORAGE_KEY), []);
  const nextCompletedLevels = Array.isArray(completedLevels)
    ? [...new Set([...completedLevels, stageId, `pm-${level}`])]
    : [stageId, `pm-${level}`];

  localStorage.setItem(COMPLETED_LEVELS_STORAGE_KEY, JSON.stringify(nextCompletedLevels));
  localStorage.setItem(`ef_game_${stageId}_completed`, "true");
  localStorage.setItem(`ef_game_${stageId}_stars`, String(safeStars));
  localStorage.setItem(`ef_game_pm_level_${level}_completed`, "true");
  localStorage.setItem(`ef_game_pm_level_${level}_stars`, String(safeStars));
  localStorage.setItem(`training_pm_level_${level}_completed`, "true");
  localStorage.setItem(`training_pm_level_${level}_stars`, String(safeStars));
  localStorage.setItem(`pm_training_level_${level}_completed`, "true");
  localStorage.setItem(`pm_training_level_${level}_stars`, String(safeStars));

  const starMap = safeParse(localStorage.getItem(PM_STAGE_STAR_STORAGE_KEY), {});
  const nextStarMap = {
    ...(starMap && typeof starMap === "object" && !Array.isArray(starMap) ? starMap : {}),
    [stageId]: { stars: safeStars, gameId: "pm", level, updatedAt: new Date().toISOString() },
    [`pm-${level}`]: safeStars,
  };
  localStorage.setItem(PM_STAGE_STAR_STORAGE_KEY, JSON.stringify(nextStarMap));

  const resultMap = safeParse(localStorage.getItem("ef_game_training_stage_results"), {});
  localStorage.setItem(
    "ef_game_training_stage_results",
    JSON.stringify({
      ...(resultMap && typeof resultMap === "object" && !Array.isArray(resultMap) ? resultMap : {}),
      [stageId]: finalResult,
    })
  );

  window.dispatchEvent(new Event("storage"));
};

function shuffleArray(arr) {
  const copy = [...arr];

=======
function shuffleArray(arr) {
  const copy = [...arr];
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
<<<<<<< HEAD

=======
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  return copy;
}

function arraysEqualAsSet(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
<<<<<<< HEAD

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

  const [phase, setPhase] = useState("rules");
  // rules -> tutorial -> introVideo -> readyCountdown -> memorize -> answer -> result

  const [baseDifficulty] = useState(() => getStageDifficulty(trainingStage.level, pmTestResult));
  const [adaptiveOffset, setAdaptiveOffset] = useState(0);
=======
  return [...arr1].sort().join(",") === [...arr2].sort().join(",");
}

export default function TrainingPage_PM() {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const answerStartRef = useRef(null);

  const [phase, setPhase] = useState("difficulty");
  // difficulty -> rules -> introVideo -> readyCountdown -> memorize -> answer -> feedback

  const [difficulty, setDifficulty] = useState(1);
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  const [round, setRound] = useState(1);

  const [currentMemorizeItems, setCurrentMemorizeItems] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [readyCountdown, setReadyCountdown] = useState(5);
  const [memorizeCountdown, setMemorizeCountdown] = useState(0);
<<<<<<< HEAD
  const [answerCountdown, setAnswerCountdown] = useState(15);

  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [lastRecord, setLastRecord] = useState(null);
  const [backgroundWarning, setBackgroundWarning] = useState(false);

  const [motionTick, setMotionTick] = useState(0);
=======
  const [feedbackText, setFeedbackText] = useState("");
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

  useEffect(() => {
    audioRef.current = new Audio(clickSfx);
  }, []);

<<<<<<< HEAD
  useEffect(() => {
    return () => {
      if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
      if (roundTransitionRef.current) clearTimeout(roundTransitionRef.current);
      if (backgroundWarningTimerRef.current) clearTimeout(backgroundWarningTimerRef.current);
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
    const memoryCount = Math.min(
      preset.baseMemoryCount + Math.floor(roundProgress / 3),
      preset.maxMemoryCount
    );
    const showTime = Math.max(
      preset.showTime - Math.floor(roundProgress / 4) * 0.5,
      preset.minShowTime
    );

    return {
      ...preset,
      difficulty: difficultyLevel,
      broadDifficulty: getBroadDifficultyKey(difficultyLevel),
      label: `第 ${trainingStage.level} 關`,
      memoryCount,
      showTime,
      answerTime: preset.answerTime,
      adaptiveOffset,
      baseDifficulty,
    };
  };

  const currentConfig = getDifficultyConfig();

  const resetRuntimeRefs = () => {
    if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
    if (backgroundWarningTimerRef.current) clearTimeout(backgroundWarningTimerRef.current);
    answerStartFrameRef.current = null;
    backgroundWarningTimerRef.current = null;
    answerStartRef.current = null;
    tapLogsRef.current = [];
    selectedIdsRef.current = [];
    hasSubmittedRef.current = false;
    setBackgroundWarning(false);
  };

  const setupRound = () => {
    const config = getDifficultyConfig();

    const memorizeItems = shuffleArray(ALL_ITEMS).slice(0, config.memoryCount);

    const distractorCount = Math.min(
      ALL_ITEMS.length - memorizeItems.length,
      config.memoryCount + config.distractorExtra
    );

    const distractors = shuffleArray(
      ALL_ITEMS.filter(
        (item) => !memorizeItems.some((memoryItem) => memoryItem.id === item.id)
      )
    ).slice(0, distractorCount);

    const options = shuffleArray([...memorizeItems, ...distractors]).slice(0, 8);

    resetRuntimeRefs();
=======
  const playClick = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

    const getDifficultyConfig = () => {
    if (difficulty === 1) {
        return {
        label: "Lv1 簡單",
        memoryCount: Math.min(2 + Math.floor((round - 1) / 3), 3),
        showTime: Math.max(6 - Math.floor((round - 1) / 5) * 0.5, 5),
        };
    }

    if (difficulty === 2) {
        return {
        label: "Lv2 普通",
        memoryCount: Math.min(4 + Math.floor((round - 1) / 3), 5),
        showTime: Math.max(4 - Math.floor((round - 1) / 5) * 0.4, 3),
        };
    }

    return {
        label: "Lv3 困難",
        memoryCount: Math.min(5 + Math.floor((round - 1) / 3), 6),
        showTime: Math.max(4 - Math.floor((round - 1) / 5) * 0.4, 3),
    };
    };

  const currentConfig = getDifficultyConfig();

  const setupRound = () => {
    const memorizeItems = shuffleArray(ALL_ITEMS).slice(0, currentConfig.memoryCount);

    const distractorCount = Math.max(currentConfig.memoryCount, 2);
    const distractors = shuffleArray(
      ALL_ITEMS.filter((item) => !memorizeItems.some((m) => m.id === item.id))
    ).slice(0, distractorCount);

    const options = shuffleArray([...memorizeItems, ...distractors]);
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

    setCurrentMemorizeItems(memorizeItems);
    setCurrentOptions(options);
    setSelectedIds([]);
<<<<<<< HEAD
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

    setRound(1);
    setAdaptiveOffset(0);
    setReadyCountdown(5);
    setMemorizeCountdown(0);
    setAnswerCountdown(15);
    setFeedbackText("");
    setFeedbackType("success");
    setLastRecord(null);
=======
    setMemorizeCountdown(currentConfig.showTime);
    setPhase("memorize");
  };

  const handleSelectDifficulty = (level) => {
    playClick();
    setDifficulty(level);
  };

  const handleStartFromDifficulty = () => {
    playClick();
    setRound(1);
    setReadyCountdown(5);
    setFeedbackText("");
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
    setSelectedIds([]);
    setCurrentMemorizeItems([]);
    setCurrentOptions([]);
    setPhase("rules");
  };

  const handleStart = () => {
    playClick();
<<<<<<< HEAD
    setPhase("tutorial");
  };

  const handleTutorialDone = () => {
    playClick();
    answerStartRef.current = performance.now();
=======
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
    setReadyCountdown(5);
    setPhase("introVideo");
  };

  const handleVideoEnd = () => {
<<<<<<< HEAD
    answerStartRef.current = performance.now();
=======
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
    setReadyCountdown(5);
    setPhase("readyCountdown");
  };

<<<<<<< HEAD
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

=======
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  useEffect(() => {
    if (phase !== "readyCountdown") return undefined;

    if (readyCountdown <= 0) {
<<<<<<< HEAD
      answerStartRef.current = performance.now();
=======
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
      setupRound();
      return undefined;
    }

    const timer = setTimeout(() => {
      setReadyCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
<<<<<<< HEAD
  }, [phase, readyCountdown]);
=======
  }, [phase, readyCountdown, difficulty, round]);
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

  useEffect(() => {
    if (phase !== "memorize") return undefined;

    if (memorizeCountdown <= 0) {
<<<<<<< HEAD
      const config = getDifficultyConfig();

      setAnswerCountdown(config.answerTime);
      setPhase("answer");
      answerStartRef.current = null;
      if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
      answerStartFrameRef.current = requestAnimationFrame(() => {
        answerStartRef.current = performance.now();
      });

=======
      setPhase("answer");
      answerStartRef.current = performance.now();
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
      return undefined;
    }

    const timer = setTimeout(() => {
      setMemorizeCountdown((prev) => Math.max(0, +(prev - 0.5).toFixed(1)));
    }, 500);

    return () => clearTimeout(timer);
  }, [phase, memorizeCountdown]);

<<<<<<< HEAD
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

  const toggleSelect = (itemId) => {
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;

    playClick();

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

    const record = {
      task: "PM_TRAINING",
      level: round,
      round,
      difficulty: config.difficulty,
      difficultyLabel: config.shortLabel,
      stageLabel: config.label,
      broadDifficulty: config.broadDifficulty,
      motionMode: config.motion,
      adaptiveOffset: config.adaptiveOffset,
      memoryCount: config.memoryCount,
      showTime: config.showTime,
      answerTimeLimit: config.answerTime,

      isCorrect,
      isTimeout,
      isFast: reactionTime > 0 && reactionTime <= 5000,

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

    if (recordsRef.current.length >= TRAINING_TOTAL_ROUNDS) {
      handleEndTraining({ withClick: false });
      return;
    }

    if (roundTransitionRef.current) clearTimeout(roundTransitionRef.current);
    const nextRound = Math.min(TRAINING_TOTAL_ROUNDS, round + 1);

    roundTransitionRef.current = setTimeout(() => {
      roundTransitionRef.current = null;
      updateAdaptiveDifficulty();
      setRound(nextRound);
      answerStartRef.current = performance.now();
      setReadyCountdown(5);
      setSelectedIds([]);
      setCurrentMemorizeItems([]);
      setCurrentOptions([]);
      resetRuntimeRefs();
      setPhase("readyCountdown");
    }, 200);
=======
  const toggleSelect = (itemId) => {
    if (phase !== "answer") return;

    playClick();

    setSelectedIds((prev) => {
      const alreadySelected = prev.includes(itemId);

      if (alreadySelected) {
        return prev.filter((id) => id !== itemId);
      }

      if (prev.length >= currentConfig.memoryCount) {
        return prev;
      }

      return [...prev, itemId];
    });
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  };

  const handleSubmit = () => {
    if (phase !== "answer") return;
<<<<<<< HEAD
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
    const recentTwo = records.slice(-2);
    const last = records[records.length - 1];

    if (recentTwo.length === 2 && recentTwo.every((record) => record.isCorrect)) {
      setAdaptiveOffset((prev) => clampNumber(prev + 1, -2, 2));
      return;
    }

    if (recentTwo.length === 2 && recentTwo.every((record) => record.isTimeout || !record.isCorrect)) {
      setAdaptiveOffset((prev) => clampNumber(prev - 1, -2, 2));
      return;
    }

    if (last?.isTimeout) {
      setAdaptiveOffset((prev) => clampNumber(prev - 1, -2, 2));
    }
=======

    playClick();

    const correctIds = currentMemorizeItems.map((item) => item.id);
    const isCorrect = arraysEqualAsSet(selectedIds, correctIds);

    if (isCorrect) {
      setFeedbackText("太棒了！你越來越厲害了 💖");
    } else {
      setFeedbackText("沒關係，我們再試一次看看 🌱");
    }

    setPhase("feedback");
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  };

  const handleNext = () => {
    playClick();
<<<<<<< HEAD
    if (roundTransitionRef.current) return;

    const nextRound = Math.min(TRAINING_TOTAL_ROUNDS, round + 1);
    roundTransitionRef.current = setTimeout(() => {
      roundTransitionRef.current = null;
      updateAdaptiveDifficulty();
      setRound(nextRound);
      answerStartRef.current = performance.now();
      setReadyCountdown(5);
      setSelectedIds([]);
      setCurrentMemorizeItems([]);
      setCurrentOptions([]);
      setFeedbackText("");
      setFeedbackType("success");
      setLastRecord(null);
      resetRuntimeRefs();
      setPhase("readyCountdown");
    }, 200);
  };

  const handleRetrySameRound = () => {
    playClick();

    answerStartRef.current = performance.now();
=======
    setRound((prev) => prev + 1);
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
    setReadyCountdown(5);
    setSelectedIds([]);
    setCurrentMemorizeItems([]);
    setCurrentOptions([]);
<<<<<<< HEAD
    setFeedbackText("");
    setFeedbackType("success");
    setLastRecord(null);
    resetRuntimeRefs();
    setPhase("readyCountdown");
  };

  const handleBackToMap = () => {
    playClick();
    navigate("/game-menu");
  };

  const handleEndTraining = ({ withClick = true } = {}) => {
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
    const stars = calculateStageStars({
      accuracy,
      avgReactionTime,
      timeoutCount: errorTypes.timeout,
      totalTrials,
      difficulty: currentConfig.difficulty,
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
      errorTypes,
      stars,
      ...performanceResult,
      ...errorResult,
      fatigueLevel,
      recommendedDifficulty,
      visibleRoles: ["child", "parent"],
      createdAt: new Date().toISOString(),
    };

    finalResultRef.current = finalResult;
    localStorage.setItem("pmTrainingResult", JSON.stringify(finalResult));
    localStorage.setItem("latestPMTrainingResult", JSON.stringify(finalResult));
    saveTrainingStageProgress({
      stageId: trainingStage.stageId,
      level: trainingStage.level,
      stars,
      finalResult,
    });
    setPhase("result");
  };

  const handleGameAreaClick = () => {
    if (phase !== "answer" || hasSubmittedRef.current) return;

    setBackgroundWarning(true);
    if (backgroundWarningTimerRef.current) clearTimeout(backgroundWarningTimerRef.current);
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
        button[aria-label]:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.03);
          filter: brightness(1.04);
        }
        button[aria-label]:active:not(:disabled) {
          transform: translateY(1px) scale(0.98);
        }
        @media (max-width: 760px) {
          .pm-tutorial-row { grid-template-columns: 1fr !important; }
          .pm-tutorial-arrow { transform: rotate(90deg); }
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

          {phase === "tutorial" && (
            <div style={styles.card}>
              <p style={styles.kicker}>前導教學</p>
              <h1 style={styles.title}>先記住，再點回來</h1>

              <div className="pm-tutorial-row" style={styles.tutorialRow}>
                <div style={styles.tutorialPanel}>
                  <p style={styles.tutorialLabel}>第一步：先看圖片</p>
                  <div style={styles.demoGrid}>
                    {[PM01, PM02, PM03].map((image, index) => (
                      <div key={index} style={styles.demoCard}>
                        <img src={image} alt="教學記憶圖片" style={styles.demoImage} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pm-tutorial-arrow" style={styles.tutorialArrow}>→</div>

                <div style={styles.tutorialPanel}>
                  <p style={styles.tutorialLabel}>第二步：從選項點出來</p>
                  <div style={styles.demoGrid}>
                    {[PM01, PM05, PM02].map((image, index) => (
                      <div
                        key={index}
                        style={{
                          ...styles.demoCard,
                          ...(index === 0 || index === 2 ? styles.demoCardSelected : {}),
                        }}
                      >
                        <img src={image} alt="教學作答圖片" style={styles.demoImage} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p style={styles.textCompact}>點滿指定數量後，再按「放進小籃子」。</p>
              {renderImageButton({ src: homeStartBtn, alt: "開始遊戲", onClick: handleTutorialDone })}
=======
    setPhase("readyCountdown");
  };

  const intensity = Math.min(1, (round - 1) / 8);

  return (
    <div style={styles.page(bgImage)}>
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1 style={styles.title}>Picture Memory 訓練</h1>

          {phase === "difficulty" && (
            <div style={styles.card}>
              <h2 style={styles.subtitle}>選擇難度</h2>
              <p style={styles.text}>先選擇你想要的訓練模式喔！</p>

              <div style={styles.difficultyGrid}>
                <button
                  type="button"
                  onClick={() => handleSelectDifficulty(1)}
                  style={{
                    ...styles.difficultyCard,
                    ...(difficulty === 1 ? styles.difficultyCardActive : {}),
                  }}
                >
                  <div style={styles.difficultyLabel}>簡單</div>
                  <div style={styles.difficultyDesc}>無干擾</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectDifficulty(2)}
                  style={{
                    ...styles.difficultyCard,
                    ...(difficulty === 2 ? styles.difficultyCardActive : {}),
                  }}
                >
                  <div style={styles.difficultyLabel}>普通</div>
                  <div style={styles.difficultyDesc}>⭐ 閃爍 </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectDifficulty(3)}
                  style={{
                    ...styles.difficultyCard,
                    ...(difficulty === 3 ? styles.difficultyCardActive : {}),
                  }}
                >
                  <div style={styles.difficultyLabel}>困難</div>
                  <div style={styles.difficultyDesc}>🔥 動態移動 </div>
                </button>
              </div>

              <button style={styles.mainButton} onClick={handleStartFromDifficulty}>
                開始
              </button>
            </div>
          )}

          {phase === "rules" && (
            <div style={styles.smallCard}>
              <h2 style={styles.subtitle}>遊戲規則</h2>
              <p style={styles.text}>
                兔子妹妹經過湖畔時，不小心把隨身的物品掉丟了。
                <br />
                請你先記住她掉了哪些東西，
                <br />
                等一下再把它們找出來！
                <br />
                練習時會依照難度加入不同干擾喔！
              </p>

              <button style={styles.mainButton} onClick={handleStart}>
                開始
              </button>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
            </div>
          )}

          {phase === "introVideo" && (
<<<<<<< HEAD
            <div style={styles.videoPanel}>
              <div style={styles.videoFrame}>
=======
            <div style={styles.mediumCard}>
              <h2 style={styles.subtitle}>準備開始囉！</h2>
              <p style={styles.text}>請先看看遊戲小故事</p>

              <div style={styles.videoWrapper}>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
                <video
                  src={introVideo}
                  style={styles.video}
                  autoPlay
<<<<<<< HEAD
                  playsInline
=======
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
                  controls={false}
                  onEnded={handleVideoEnd}
                />
              </div>

<<<<<<< HEAD
              {renderImageButton({
                src: homeSkipBtn,
                alt: "跳過動畫",
                variant: "skip",
                onClick: () => {
                  playClick();
                  handleVideoEnd();
                },
              })}
=======
              <button style={styles.secondaryButton} onClick={handleVideoEnd}>
                跳過
              </button>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
            </div>
          )}

          {phase === "readyCountdown" && (
            <div style={styles.smallCard}>
<<<<<<< HEAD
              <p style={styles.kicker}>第 {round} / {TRAINING_TOTAL_ROUNDS} 題</p>
              <h1 style={styles.title}>看清楚湖裡的小物品</h1>
              <div style={styles.bigCountdown}>{readyCountdown}</div>
              <p style={styles.textCompact}>皮皮會陪你一起看，等湖面亮起來就開始。</p>
=======
              <p style={styles.levelText}>{currentConfig.label}</p>
              <h2 style={styles.subtitle}>準備開始</h2>
              <p style={styles.bigCountdown}>{readyCountdown}</p>
              <p style={styles.text}>遊戲即將開始！</p>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
            </div>
          )}

          {phase === "memorize" && (
            <div style={styles.card}>
<<<<<<< HEAD
              <p style={styles.kicker}>第 {round} / {TRAINING_TOTAL_ROUNDS} 題</p>
              <h1 style={styles.title}>看清楚湖裡的小物品</h1>

              <div style={styles.iconHint}>
                <span>請記住這些圖片</span>
              </div>
=======
              <p style={styles.levelText}>
                {currentConfig.label}｜第 {round} 回合
              </p>
              <h2 style={styles.subtitle}>
                請記住這 {currentConfig.memoryCount} 個物品
              </h2>

              <p style={styles.hintText}>請仔細記住這些物品喔！</p>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

              <div style={styles.memoryGrid}>
                {currentMemorizeItems.map((item, index) => {
                  const imageStyle = { ...styles.memoryImage };

<<<<<<< HEAD
                  if (currentConfig.motion === "flicker") {
                    const flickerValue = 0.7 + 0.3 * Math.sin(motionTick * 0.9 + index * 1.3 + round * 0.4);
                    imageStyle.opacity = Math.max(0.45, flickerValue - intensity * 0.15);
                  }

                  if (currentConfig.motion === "move") {
                    const offset = Math.sin(motionTick * 0.45 + index) * (10 + intensity * 20);
=======
                  if (difficulty === 2) {
                    const flicker = Math.random() < 0.3 + intensity * 0.5;
                    imageStyle.opacity = flicker ? 0.45 : 1;
                  }

                  if (difficulty === 3) {
                    const offset = Math.sin(Date.now() / 220 + index) * (8 + intensity * 18);
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
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
<<<<<<< HEAD
            <div
              style={{
                ...styles.card,
                ...(backgroundWarning ? styles.warningCard : {}),
              }}
              onClick={handleGameAreaClick}
            >
              <p style={styles.kicker}>第 {round} / {TRAINING_TOTAL_ROUNDS} 題</p>
              <h1 style={styles.title}>找回剛剛看過的物品</h1>

              <div style={styles.iconHint}>
                <span>已找到 {selectedIds.length} / {currentConfig.memoryCount}</span>
              </div>

              {backgroundWarning && (
                <div style={styles.backgroundWarning}>先看清楚圖片，再點選物品喔！</div>
              )}
=======
            <div style={styles.card}>
              <p style={styles.levelText}>
                {currentConfig.label}｜第 {round} 回合
              </p>
              <h2 style={styles.subtitle}>
                請選出剛剛出現的 {currentConfig.memoryCount} 個物品
              </h2>

              <p style={styles.hintText}>
                已選 {selectedIds.length} / {currentConfig.memoryCount}
              </p>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

              <div style={styles.optionGrid}>
                {currentOptions.map((item) => {
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
<<<<<<< HEAD
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelect(item.id);
                      }}
=======
                      onClick={() => toggleSelect(item.id)}
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
                      style={{
                        ...styles.optionCard,
                        ...(isSelected ? styles.optionCardSelected : {}),
                      }}
                    >
                      <img src={item.image} alt={item.id} style={styles.optionImage} />
                    </button>
                  );
                })}
              </div>

              <button
<<<<<<< HEAD
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
=======
                style={{
                  ...styles.mainButton,
                  opacity: selectedIds.length === currentConfig.memoryCount ? 1 : 0.5,
                  cursor:
                    selectedIds.length === currentConfig.memoryCount
                      ? "pointer"
                      : "not-allowed",
                }}
                onClick={handleSubmit}
                disabled={selectedIds.length !== currentConfig.memoryCount}
              >
                送出答案
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
              </button>
            </div>
          )}

<<<<<<< HEAD
          {phase === "endingVideo" && (
            <div style={styles.videoPanel}>
              <div style={styles.videoFrame}>
                <video
                  src={introVideo}
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
=======
         {phase === "feedback" && (
  <div style={styles.smallCard}>
    <h2 style={styles.subtitle}>{feedbackText}</h2>

            {/* 按鈕容器（重點） */}
            <div
            style={{
                display: "flex",
                justifyContent: "center",
                gap: "16px",
                marginTop: "20px",
            }}
            >
            <button style={styles.mainButton} onClick={handleNext}>
                下一回合
            </button>

            <button
                style={styles.secondaryButton}
                onClick={() => {
                playClick();
                navigate("/result-picture-memory");
                }}
            >
                結束遊戲
            </button>
            </div>
        </div>
        )}
          )
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
        </div>
      </div>
    </div>
  );
}

<<<<<<< HEAD
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
=======
const styles = {
  page: (bgImage) => ({
    minHeight: "100vh",
    width: "100%",
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
    backgroundImage: `url(${bgImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
<<<<<<< HEAD
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
=======
  }),

  overlay: {
    minHeight: "100vh",
    width: "100%",
    background: "rgba(255,255,255,0.18)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  },

  container: {
    width: "100%",
<<<<<<< HEAD
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
=======
    maxWidth: "1150px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
  },

  card: {
    width: "100%",
    backgroundColor: "rgba(255, 248, 235, 0.96)",
    borderRadius: "30px",
    padding: "34px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
    textAlign: "center",
  },

  smallCard: {
    width: "100%",
    maxWidth: "520px",
    backgroundColor: "rgba(255, 248, 235, 0.96)",
    borderRadius: "30px",
    padding: "40px 34px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
    textAlign: "center",
  },

  mediumCard: {
    width: "100%",
    maxWidth: "900px",
    backgroundColor: "rgba(255, 248, 235, 0.96)",
    borderRadius: "30px",
    padding: "34px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
    textAlign: "center",
  },

  title: {
    fontSize: "42px",
    fontWeight: "800",
    color: "#5C4033",
    textShadow: "2px 2px 0 #fff",
    margin: 0,
  },

  subtitle: {
    fontSize: "34px",
    color: "#7A4F2B",
    marginBottom: "18px",
    fontWeight: "800",
  },

  text: {
    fontSize: "24px",
    lineHeight: 1.8,
    color: "#4D3B2F",
    marginBottom: "28px",
  },

  hintText: {
    fontSize: "22px",
    color: "#7A4F2B",
    fontWeight: "700",
    marginBottom: "22px",
  },

  levelText: {
    fontSize: "22px",
    color: "#8B5E3C",
    fontWeight: "700",
    marginBottom: "10px",
  },

  bigCountdown: {
    fontSize: "100px",
    fontWeight: "900",
    color: "#F4A261",
    margin: "20px 0",
    textShadow: "2px 2px 0 #fff",
  },

  difficultyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "18px",
    marginTop: "18px",
    marginBottom: "28px",
  },

  difficultyCard: {
    border: "3px solid transparent",
    borderRadius: "24px",
    padding: "24px 18px",
    backgroundColor: "#fff",
    boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
    cursor: "pointer",
    transition: "0.2s",
    color: "#5C4033",
  },

  difficultyCardActive: {
    border: "3px solid #F4A261",
    backgroundColor: "#FFF3E8",
    transform: "translateY(-2px)",
  },

  difficultyTitle: {
    fontSize: "28px",
    fontWeight: "800",
    marginBottom: "8px",
    color: "#7A4F2B",
  },

  difficultyLabel: {
    fontSize: "22px",
    fontWeight: "800",
    marginBottom: "8px",
    color: "#5C4033",
  },

  difficultyDesc: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#8B5E3C",
  },

  memoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "22px",
    marginTop: "16px",
    justifyItems: "center",
  },

  memoryCard: {
    backgroundColor: "#fff",
    borderRadius: "22px",
    padding: "18px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
    width: "180px",
    maxWidth: "220px",
  },

  memoryImage: {
    width: "100%",
    maxWidth: "200px",
    height: "200px",
    objectFit: "contain",
    transition: "0.2s",
  },

  optionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "20px",
    marginTop: "20px",
    marginBottom: "28px",
    justifyItems: "center",
  },

  optionCard: {
    border: "4px solid transparent",
    borderRadius: "24px",
    padding: "18px",
    backgroundColor: "#fff",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
    transition: "0.2s",
    width: "180px",
    maxWidth: "220px",
  },

  optionCardSelected: {
    border: "4px solid #7B61FF",
    backgroundColor: "#F3F0FF",
    transform: "scale(1.02)",
  },

  optionImage: {
    width: "100%",
    maxWidth: "180px",
    height: "180px",
    objectFit: "contain",
    marginBottom: "8px",
  },

  mainButton: {
    backgroundColor: "#F4A261",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    padding: "16px 36px",
    fontSize: "22px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(0,0,0,0.15)",
    marginTop: "12px"
  },

  secondaryButton: {
    backgroundColor: "#8D6E63",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    padding: "16px 36px",
    fontSize: "22px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(0,0,0,0.15)",
    marginTop: "12px",
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  },

  videoWrapper: {
    width: "100%",
<<<<<<< HEAD
    maxWidth: "720px",
    margin: "0 auto 18px",
    borderRadius: "26px",
    overflow: "hidden",
    boxShadow: "0 12px 26px rgba(77, 53, 30, 0.2)",
=======
    maxWidth: "760px",
    margin: "0 auto 24px",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
    backgroundColor: "#000",
  },

  video: {
    width: "100%",
<<<<<<< HEAD
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

=======
    height: "auto",
    display: "block",
    aspectRatio: "16 / 9",
    objectFit: "contain",
  },
};
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
