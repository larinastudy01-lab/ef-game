import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import bgImg from "../asset/SRT/SRT_background.webp";
import normalImg from "../asset/SRT/acorn.webp";
import goldenImg from "../asset/SRT/golden_acorn.webp";
import rottenImg from "../asset/SRT/rotten_acorn.webp";
import levelIcon from "../asset/SRT/SRT_icon.webp";
import startAvatar from "../asset/SRT/bear.webp";
import tutorialAvatar from "../asset/SRT/chicken.webp";
import introVideo from "../asset/optimized/mp4/start.mp4";
import tutorialVideo from "../asset/optimized/mp4/SRT_step.mp4";
import endingVideo from "../asset/optimized/mp4/SRT_end.mp4";
import clickSoundFile from "../asset/Click.mp3";
import homeStartBtn from "../asset/SRT/start.webp";
import homeSkipBtn from "../asset/SRT/skip.webp";
import homeNextBtn from "../asset/SRT/next.webp";
import homeBackBtn from "../asset/return.webp";
import homeAgainBtn from "../asset/SRT/again.webp";
import homeResultBtn from "../asset/SRT/result.webp";
import mouseGuideImg from "../asset/mouse.webp";

import ResultPageSRT from "./ResultPage_SRT";
import { saveUnifiedResult } from "../utils/resultManager";
import { calculateSrtScore } from "../utils/srtScoring";
import { analyzeSrtTraining } from "../ai/srtTrainingAnalyzer";

import { createGameResult } from "../ai/gameResultTemplate";
import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { clampNumber, getTodayKey, safeParse } from "../utils/trainingDataUtils";

const GAME_ID = "srt";
const COMPLETED_LEVELS_STORAGE_KEY = "ef_game_completed_training_levels";

const clampStars = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(3, Math.max(1, Math.round(number)));
};

const getNestedValue = (source, keys) => {
  if (!source || typeof source !== "object") return null;

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }

  for (const value of Object.values(source)) {
    if (value && typeof value === "object") {
      const nested = getNestedValue(value, keys);
      if (nested !== null && nested !== undefined) return nested;
    }
  }

  return null;
};

const readSrtTestProfile = () => {
  const candidateKeys = [
    "srtTestResult",
    "SRTTestResult",
    "ef_game_srt_test_result",
    "ef_game_SRT_test_result",
    "test_srt_result",
    "srtResult",
  ];

  for (const key of candidateKeys) {
    const data = safeParse(localStorage.getItem(key), null);
    if (!data || typeof data !== "object") continue;

    const rawStars = getNestedValue(data, ["stars", "star", "rating", "scoreStars"]);
    const rawAccuracy = getNestedValue(data, ["accuracy", "accuracyRate", "correctRate"]);
    const rawAvgReactionTime = getNestedValue(data, [
      "avgReactionTime",
      "averageReactionTime",
      "avgRT",
      "averageRT",
      "meanRT",
    ]);

    const stars = rawStars !== null && rawStars !== undefined ? Number(rawStars) : null;
    const accuracy = rawAccuracy !== null && rawAccuracy !== undefined ? Number(rawAccuracy) : null;
    const avgReactionTime =
      rawAvgReactionTime !== null && rawAvgReactionTime !== undefined
        ? Number(rawAvgReactionTime)
        : null;

    if ([stars, accuracy, avgReactionTime].some((value) => Number.isFinite(value))) {
      return {
        sourceKey: key,
        stars: Number.isFinite(stars) ? stars : null,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        avgReactionTime: Number.isFinite(avgReactionTime) ? avgReactionTime : null,
      };
    }
  }

  return null;
};

const getSrtTestBand = () => {
  const testProfile = readSrtTestProfile();
  if (!testProfile) return null;

  const { stars, accuracy, avgReactionTime } = testProfile;

  if (
    (stars !== null && stars >= 3) ||
    (accuracy !== null && accuracy >= 85 && (avgReactionTime === null || avgReactionTime <= 850))
  ) {
    return "high";
  }

  if (
    (stars !== null && stars <= 1) ||
    (accuracy !== null && accuracy < 60) ||
    (avgReactionTime !== null && avgReactionTime >= 1250)
  ) {
    return "low";
  }

  return "middle";
};

const hashText = (text) => {
  return String(text || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
};

const getDifficultyKeyFromStep = (step) => {
  const normalizedStep = clampNumber(step, 1, 9);
  if (normalizedStep <= 3) return `easy-${normalizedStep}`;
  if (normalizedStep <= 6) return `medium-${normalizedStep - 3}`;
  return `hard-${normalizedStep - 6}`;
};

const getDifficultyStep = (difficultyKey) => {
  const config = difficultySettings[difficultyKey];
  return config?.step || 1;
};

const getDisplayDifficultyKey = (difficultyKey) => {
  const step = getDifficultyStep(difficultyKey);
  if (step <= 3) return "easy";
  if (step <= 6) return "medium";
  return "hard";
};

const getAutoDifficultyForStage = ({ level, stageId, todayKey }) => {
  const normalizedLevel = clampNumber(level, 1, 999);
  const patternLevelIndex = (normalizedLevel - 1) % 5;
  const cycleBoost = Math.floor((normalizedLevel - 1) / 5);
  const testBand = getSrtTestBand();

  const stepPatternsByBand = {
    low: [1, 2, 3, 4, 5],
    middle: [2, 3, 4, 5, 6],
    high: [4, 5, 6, 7, 8],
  };

  if (testBand) {
    const baseStep = stepPatternsByBand[testBand][patternLevelIndex] || 5;
    return getDifficultyKeyFromStep(baseStep + cycleBoost);
  }

  const fallbackStepPatterns = [
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5, 6],
    [1, 2, 4, 5, 7],
  ];
  const patternIndex = hashText(`${todayKey}-${stageId}`) % fallbackStepPatterns.length;
  const baseStep = fallbackStepPatterns[patternIndex][patternLevelIndex] || 5;

  return getDifficultyKeyFromStep(baseStep + cycleBoost);
};

const getTrainingStageInfo = (location) => {
  const params = new URLSearchParams(location.search || "");
  const state = location.state || {};
  const level = clampNumber(state.trainingLevel ?? params.get("level") ?? 1, 1, 999);
  const todayKey = state.todayKey || getTodayKey();

  return {
    level,
    stageId: state.trainingStageId || params.get("stage") || `${todayKey}-${GAME_ID}-L${level}`,
    order: Number(state.trainingOrder || level),
    total: Number(state.trainingTotal || 5),
    todayKey,
    abilityLabel: state.abilityLabel || "橡實練習",
    difficultyLabel: state.difficultyLabel || "準備練習",
    dailyTrainingPlan: Array.isArray(state.dailyTrainingPlan) ? state.dailyTrainingPlan : [],
    planId: state.planId || state.trainingPlanId || params.get("planId") || null,
    sessionId: state.sessionId || params.get("sessionId") || null,
    difficulty: state.difficulty || state.difficultyKey || params.get("difficulty") || null,
  };
};

const writeObjectStarMap = (key, entries) => {
  const current = safeParse(localStorage.getItem(key), {});
  const next = current && typeof current === "object" && !Array.isArray(current) ? current : {};

  entries.forEach(([entryKey, value]) => {
    next[entryKey] = value;
  });

  localStorage.setItem(key, JSON.stringify(next));
};

const appendUniqueStorageItems = (key, values) => {
  const current = safeParse(localStorage.getItem(key), []);
  const list = Array.isArray(current) ? current : [];
  const next = [...new Set([...list, ...values.filter(Boolean)])];
  localStorage.setItem(key, JSON.stringify(next));
};

const difficultySettings = {
  "easy-1": {
    key: "easy-1",
    step: 1,
    displayKey: "easy",
    label: "簡單",
    storyLabel: "橡實練習 1",
    subtitle: "3 分鐘低壓力練習，橡實最大、干擾最低。",
    totalTime: 180000,
    maxTrials: 60,
    visibleTime: 2200,
    nextDelay: 2400,
    itemSize: 146,
    normalRate: 1,
    goldenRate: 0,
    rottenRate: 0,
  },

  "easy-2": {
    key: "easy-2",
    step: 2,
    displayKey: "easy",
    label: "簡單",
    storyLabel: "橡實練習 2",
    subtitle: "3 分 30 秒練習，加入少量金色橡實。",
    totalTime: 210000,
    maxTrials: 70,
    visibleTime: 2000,
    nextDelay: 2200,
    itemSize: 138,
    normalRate: 0.95,
    goldenRate: 0.05,
    rottenRate: 0,
  },

  "easy-3": {
    key: "easy-3",
    step: 3,
    displayKey: "easy",
    label: "簡單",
    storyLabel: "橡實練習 3",
    subtitle: "4 分鐘練習，加入少量壞橡實，開始練習看清楚再點。",
    totalTime: 240000,
    maxTrials: 85,
    visibleTime: 1800,
    nextDelay: 2000,
    itemSize: 130,
    normalRate: 0.9,
    goldenRate: 0.05,
    rottenRate: 0.05,
  },

  "medium-1": {
    key: "medium-1",
    step: 4,
    displayKey: "medium",
    label: "普通",
    storyLabel: "橡實小任務 1",
    subtitle: "4 分 30 秒中等負荷，訓練持續注意與抑制控制。",
    totalTime: 270000,
    maxTrials: 100,
    visibleTime: 1600,
    nextDelay: 1800,
    itemSize: 122,
    normalRate: 0.82,
    goldenRate: 0.08,
    rottenRate: 0.1,
  },

  "medium-2": {
    key: "medium-2",
    step: 5,
    displayKey: "medium",
    label: "普通",
    storyLabel: "橡實小任務 2",
    subtitle: "5 分鐘練習，觀察兒童長時間專注維持。",
    totalTime: 300000,
    maxTrials: 120,
    visibleTime: 1400,
    nextDelay: 1650,
    itemSize: 116,
    normalRate: 0.76,
    goldenRate: 0.1,
    rottenRate: 0.14,
  },

  "medium-3": {
    key: "medium-3",
    step: 6,
    displayKey: "medium",
    label: "普通",
    storyLabel: "橡實小任務 3",
    subtitle: "6 分鐘練習，速度更快、干擾更多，觀察穩定度與疲勞。",
    totalTime: 360000,
    maxTrials: 150,
    visibleTime: 1250,
    nextDelay: 1500,
    itemSize: 108,
    normalRate: 0.7,
    goldenRate: 0.1,
    rottenRate: 0.2,
  },

  "hard-1": {
    key: "hard-1",
    step: 7,
    displayKey: "hard",
    label: "困難",
    storyLabel: "森林大挑戰 1",
    subtitle: "6 分 30 秒高負荷練習，壞橡實比例提高。",
    totalTime: 390000,
    maxTrials: 170,
    visibleTime: 1100,
    nextDelay: 1400,
    itemSize: 102,
    normalRate: 0.68,
    goldenRate: 0.08,
    rottenRate: 0.24,
  },

  "hard-2": {
    key: "hard-2",
    step: 8,
    displayKey: "hard",
    label: "困難",
    storyLabel: "森林大挑戰 2",
    subtitle: "7 分鐘高干擾練習，需要更穩定的抑制控制。",
    totalTime: 420000,
    maxTrials: 190,
    visibleTime: 950,
    nextDelay: 1300,
    itemSize: 94,
    normalRate: 0.64,
    goldenRate: 0.06,
    rottenRate: 0.3,
  },

  "hard-3": {
    key: "hard-3",
    step: 9,
    displayKey: "hard",
    label: "困難",
    storyLabel: "森林大挑戰 3",
    subtitle: "8 分鐘最高挑戰，觀察長時間專注、疲勞與抑制控制。",
    totalTime: 480000,
    maxTrials: 220,
    visibleTime: 850,
    nextDelay: 1200,
    itemSize: 88,
    normalRate: 0.6,
    goldenRate: 0.05,
    rottenRate: 0.35,
  },
};

const objectTypes = {
  normal: {
    key: "normal",
    img: normalImg,
    intrinsicWidth: 151,
    intrinsicHeight: 194,
    score: 3,
    label: "普通橡實",
    hint: "接到一顆橡實！小松鼠很開心！",
    shouldClick: true,
  },

  golden: {
    key: "golden",
    img: goldenImg,
    intrinsicWidth: 166,
    intrinsicHeight: 211,
    score: 4,
    label: "金色橡實",
    hint: "哇！金色橡實！小松鼠得到金色的橡實！",
    shouldClick: true,
  },

  rotten: {
    key: "rotten",
    img: rottenImg,
    intrinsicWidth: 166,
    intrinsicHeight: 201,
    score: -3,
    label: "壞掉橡實",
    hint: "這顆壞掉了，下次要幫小松鼠避開喔！",
    shouldClick: false,
  },
};


const TrainingPage_SRT = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const trainingStageInfo = useMemo(
    () => getTrainingStageInfo(location),
    [location]
  );

  const initialDifficulty = useMemo(() => {
    const fixedDifficulty = trainingStageInfo.difficulty;
    if (fixedDifficulty && difficultySettings[fixedDifficulty]) return fixedDifficulty;

    return getAutoDifficultyForStage({
      level: trainingStageInfo.level,
      stageId: trainingStageInfo.stageId,
      todayKey: trainingStageInfo.todayKey,
    });
  }, [
    trainingStageInfo.difficulty,
    trainingStageInfo.level,
    trainingStageInfo.stageId,
    trainingStageInfo.todayKey,
  ]);

  const [phase, setPhase] = useState("start");
  const phaseRef = useRef("start");

  const setGamePhase = (nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [, setTimeLeft] = useState(0);

  const [item, setItem] = useState(null);
  const [effect, setEffect] = useState(null);
  const [, setFalseStartWarning] = useState(null);
  const [, setShowMouseGuide] = useState(false);
  const [assistEffect, setAssistEffect] = useState(null);
  const [idleFlashId, setIdleFlashId] = useState(null);
  const [, setHintText] = useState("小松鼠準備好接橡實囉！");
  const [, setShowHint] = useState(false);
  const [showDetailedResult, setShowDetailedResult] = useState(false);
  const [warmupStep, setWarmupStep] = useState(0);
  const [warmupItem, setWarmupItem] = useState(null);
  const [warmupMessage, setWarmupMessage] = useState(
    "先跟小松鼠一起練習一下。"
  );
  const [warmupReady, setWarmupReady] = useState(false);

  const [score, setScore] = useState(0);
  const [trialRecords, setTrialRecords] = useState([]);
  const [falseClickCount, setFalseClickCount] = useState(0);
  const [repeatedClickCount, setRepeatedClickCount] = useState(0);

  const trialRecordsRef = useRef([]);
  const falseClickCountRef = useRef(0);
  const repeatedClickCountRef = useRef(0);
  const finishingRef = useRef(false);
  const startedAtRef = useRef(null);

  const difficultyRef = useRef(difficulty);
  const currentTrialRef = useRef(0);
  const spawnTimeRef = useRef(null);
  const currentItemRef = useRef(null);
  const trialLockedRef = useRef(false);
  const lastActionTimeRef = useRef(Date.now());
  const consecutiveMissRef = useRef(0);
  const consecutiveBackgroundClickRef = useRef(0);
  const assistedTrialRef = useRef(false);
  const assistTypeRef = useRef(null);
  const assistShownAtRef = useRef(null);
  const recentTypesRef = useRef([]);

  const itemTimeoutRef = useRef(null);
  const nextTrialTimeoutRef = useRef(null);
  const gameTimerRef = useRef(null);
  const clockIntervalRef = useRef(null);
  const idleCheckRef = useRef(null);
  const hintTimeoutRef = useRef(null);
  const mouseGuideTimeoutRef = useRef(null);
  const assistTimeoutRef = useRef(null);
  const assistClearTimeoutRef = useRef(null);
  const idleFlashTimeoutRef = useRef(null);
  const lastGuidanceHintTimeRef = useRef(0);
  const effectTimeoutRef = useRef(null);
  const falseStartWarningTimeoutRef = useRef(null);
  const spawnAnimationFrameRef = useRef(null);
  const warmupTimeoutRef = useRef(null);

  const clickAudioRef = useRef(null);

  const config = difficultySettings[difficulty] || difficultySettings["easy-1"];

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    setDifficulty(initialDifficulty);
    difficultyRef.current = initialDifficulty;
  }, [initialDifficulty]);

  useEffect(() => {
    clickAudioRef.current = new Audio(clickSoundFile);
    clickAudioRef.current.volume = 1.0;

    return () => {
      clearAllTimers();
    };
  }, []);

  const clearAllTimers = () => {
    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    if (nextTrialTimeoutRef.current) clearTimeout(nextTrialTimeoutRef.current);
    if (gameTimerRef.current) clearTimeout(gameTimerRef.current);
    if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    if (mouseGuideTimeoutRef.current) clearTimeout(mouseGuideTimeoutRef.current);
    if (assistTimeoutRef.current) clearTimeout(assistTimeoutRef.current);
    if (assistClearTimeoutRef.current) clearTimeout(assistClearTimeoutRef.current);
    if (idleFlashTimeoutRef.current) clearTimeout(idleFlashTimeoutRef.current);
    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    if (falseStartWarningTimeoutRef.current) clearTimeout(falseStartWarningTimeoutRef.current);
    if (spawnAnimationFrameRef.current) cancelAnimationFrame(spawnAnimationFrameRef.current);
    if (warmupTimeoutRef.current) clearTimeout(warmupTimeoutRef.current);

    itemTimeoutRef.current = null;
    nextTrialTimeoutRef.current = null;
    gameTimerRef.current = null;
    clockIntervalRef.current = null;
    idleCheckRef.current = null;
    hintTimeoutRef.current = null;
    mouseGuideTimeoutRef.current = null;
    assistTimeoutRef.current = null;
    assistClearTimeoutRef.current = null;
    idleFlashTimeoutRef.current = null;
    effectTimeoutRef.current = null;
    falseStartWarningTimeoutRef.current = null;
    spawnAnimationFrameRef.current = null;
    warmupTimeoutRef.current = null;
  };

  const playClickSound = () => {
    if (!clickAudioRef.current) return;

    clickAudioRef.current.currentTime = 0;
    clickAudioRef.current.play().catch(() => {});
  };

  const resetTraining = () => {
    clearAllTimers();

    setTimeLeft(0);
    setItem(null);
    setEffect(null);
    setFalseStartWarning(null);
    setShowMouseGuide(false);
    setAssistEffect(null);
    setIdleFlashId(null);
    setHintText("小松鼠準備好接橡實囉！");
    setShowHint(false);
    setShowDetailedResult(false);

    setWarmupStep(0);
    setWarmupItem(null);
    setWarmupMessage("先跟小松鼠一起練習一下。");
    setWarmupReady(false);

    setScore(0);
    setTrialRecords([]);
    setFalseClickCount(0);
    setRepeatedClickCount(0);

    trialRecordsRef.current = [];
    falseClickCountRef.current = 0;
    repeatedClickCountRef.current = 0;

    currentTrialRef.current = 0;
    spawnTimeRef.current = null;
    currentItemRef.current = null;
    trialLockedRef.current = false;
    lastActionTimeRef.current = Date.now();
    lastGuidanceHintTimeRef.current = 0;
    consecutiveMissRef.current = 0;
    consecutiveBackgroundClickRef.current = 0;
    assistedTrialRef.current = false;
    assistTypeRef.current = null;
    assistShownAtRef.current = null;
    recentTypesRef.current = [];
  };

  const addTrialRecord = (record) => {
    const nextRecords = [...trialRecordsRef.current, record];
    trialRecordsRef.current = nextRecords;
    setTrialRecords(nextRecords);
  };

  const getCurrentChildProfile = () => {
    try {
      const candidateKeys = ["currentChild", "selectedChild"];

      for (const key of candidateKeys) {
        const child = JSON.parse(localStorage.getItem(key) || "null");
        const childId = child?.childId || child?.id;

        if (childId) {
          return {
            ...child,
            childId,
            id: child.id || childId,
            name: child.name || child.nickname || "",
          };
        }
      }

      const storedChildId = localStorage.getItem("currentChildId");
      if (storedChildId) {
        return { childId: storedChildId, id: storedChildId, name: "" };
      }

      return { childId: null, id: null, name: "" };
    } catch (error) {
      return { childId: null, id: null, name: "" };
    }
  };

  const getCurrentChildId = () => {
    return getCurrentChildProfile()?.childId || null;
  };

  const getAverageRt = (records) => {
    const rts = records
      .filter((record) => record.isCorrect === true && typeof record.reactionTime === "number")
      .map((record) => record.reactionTime);

    if (rts.length === 0) return 0;
    return Math.round(rts.reduce((sum, rt) => sum + rt, 0) / rts.length);
  };


  const getRtStats = (records) => {
    const values = records
      .filter((record) => record.trainingAction === "hit" && typeof record.reactionTime === "number")
      .map((record) => record.reactionTime);

    if (values.length === 0) {
      return { count: 0, avg: 0, std: 0, cv: 0 };
    }

    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    return {
      count: values.length,
      avg: Math.round(avg),
      std: Math.round(std),
      cv: avg > 0 ? Number((std / avg).toFixed(2)) : 0,
    };
  };

  const getSegmentSummary = (records, segmentIndex, totalSegments = 3) => {
    const safeRecords = Array.isArray(records) ? records : [];
    const segmentSize = Math.ceil(safeRecords.length / totalSegments) || 1;
    const start = segmentIndex * segmentSize;
    const segmentRecords = safeRecords.slice(start, start + segmentSize);
    const total = segmentRecords.length;
    const hit = segmentRecords.filter((record) => record.trainingAction === "hit").length;
    const correctReject = segmentRecords.filter((record) => record.trainingAction === "correctAvoid").length;
    const miss = segmentRecords.filter((record) => record.missed || record.timeout).length;
    const falseAlarm = segmentRecords.filter((record) => record.trainingAction === "clickedRotten").length;
    const assisted = segmentRecords.filter((record) => record.assisted).length;
    const rtStats = getRtStats(segmentRecords);

    return {
      total,
      hit,
      correctReject,
      miss,
      falseAlarm,
      assisted,
      accuracy: total > 0 ? Math.round(((hit + correctReject) / total) * 100) : 0,
      missRate: total > 0 ? Math.round((miss / total) * 100) : 0,
      falseAlarmRate: total > 0 ? Math.round((falseAlarm / total) * 100) : 0,
      assistedRate: total > 0 ? Math.round((assisted / total) * 100) : 0,
      avgRT: rtStats.avg,
      rtStd: rtStats.std,
      rtCV: rtStats.cv,
    };
  };

  const buildLongAttentionMetrics = (records) => {
    const firstThird = getSegmentSummary(records, 0, 3);
    const middleThird = getSegmentSummary(records, 1, 3);
    const lastThird = getSegmentSummary(records, 2, 3);
    const rtStats = getRtStats(records);
    const assistedCount = records.filter((record) => record.assisted).length;
    const assistedHitRts = records
      .filter((record) => record.assisted && record.trainingAction === "hit" && typeof record.reactionTime === "number")
      .map((record) => record.reactionTime);
    const unassistedHitRts = records
      .filter((record) => !record.assisted && record.trainingAction === "hit" && typeof record.reactionTime === "number")
      .map((record) => record.reactionTime);

    const average = (values) =>
      values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

    const rtSlowing = lastThird.avgRT && firstThird.avgRT ? lastThird.avgRT - firstThird.avgRT : 0;
    const missIncrease = lastThird.missRate - firstThird.missRate;
    const wrongClickIncrease = lastThird.falseAlarmRate - firstThird.falseAlarmRate;
    const assistedRateIncrease = lastThird.assistedRate - firstThird.assistedRate;

    return {
      rtStd: rtStats.std,
      rtCV: rtStats.cv,
      assistedCount,
      assistedRate: records.length > 0 ? Math.round((assistedCount / records.length) * 100) : 0,
      assistedAvgRT: average(assistedHitRts),
      unassistedAvgRT: average(unassistedHitRts),
      firstThird,
      middleThird,
      lastThird,
      rtSlowing,
      missIncrease,
      wrongClickIncrease,
      assistedRateIncrease,
      attentionDrop: Math.max(0, missIncrease) + Math.max(0, wrongClickIncrease) + Math.max(0, Math.round(rtSlowing / 100)),
    };
  };

  const getLevelByThreshold = (value, mildThreshold, highThreshold) => {
    if (value >= highThreshold) return "high";
    if (value >= mildThreshold) return "medium";
    return "low";
  };

  const getNextDifficultyByAction = (currentDifficulty, action) => {
    const currentStep = getDifficultyStep(currentDifficulty);

    if (action === "upgrade") return getDifficultyKeyFromStep(currentStep + 1);
    if (action === "downgrade") return getDifficultyKeyFromStep(currentStep - 1);

    return currentDifficulty;
  };

  const buildRuleBasedSrtAiRecommendation = ({
    records,
    performanceResult,
    errorTypes,
    fatigueLevel,
    longAttentionMetrics,
    currentDifficulty,
  }) => {
    const totalTrials = Math.max(records.length, 1);
    const accuracy = performanceResult?.accuracy ?? 0;
    const avgReactionTime = performanceResult?.avgReactionTime ?? 0;
    const falseAlarmRate = Math.round(((errorTypes?.wrongTarget || 0) / totalTrials) * 100);
    const backgroundClickRate = Math.round(((errorTypes?.randomClick || 0) / totalTrials) * 100);
    const missRate = Math.round(((errorTypes?.miss || 0) / totalTrials) * 100);
    const rtCV = longAttentionMetrics?.rtCV ?? 0;
    const assistedRate = longAttentionMetrics?.assistedRate ?? 0;
    const attentionDrop = longAttentionMetrics?.attentionDrop ?? 0;
    const rtSlowing = longAttentionMetrics?.rtSlowing ?? 0;

    const attentionLevel =
      attentionDrop >= 25 || missRate >= 25 || longAttentionMetrics?.missIncrease >= 15
        ? "high_drop"
        : attentionDrop >= 12 || missRate >= 12 || longAttentionMetrics?.missIncrease >= 8
          ? "mild_drop"
          : "stable";

    const impulseLevel =
      falseAlarmRate >= 30 || backgroundClickRate >= 25
        ? "high"
        : falseAlarmRate >= 15 || backgroundClickRate >= 12
          ? "medium"
          : "low";

    const stabilityLevel = getLevelByThreshold(rtCV, 0.35, 0.5);
    const assistedNeed = getLevelByThreshold(assistedRate, 20, 40);
    const fatigueRisk =
      fatigueLevel === "high" || rtSlowing >= 450 || attentionDrop >= 25
        ? "high"
        : fatigueLevel === "medium" || rtSlowing >= 250 || attentionDrop >= 12
          ? "medium"
          : "low";

    let action = "maintain";

    if (
      accuracy >= 85 &&
      missRate <= 10 &&
      falseAlarmRate <= 15 &&
      assistedRate <= 20 &&
      rtCV <= 0.35 &&
      fatigueRisk !== "high"
    ) {
      action = "upgrade";
    }

    if (
      accuracy < 65 ||
      missRate > 25 ||
      falseAlarmRate > 30 ||
      assistedRate > 40 ||
      fatigueRisk === "high"
    ) {
      action = "downgrade";
    }

    const nextDifficulty = getNextDifficultyByAction(currentDifficulty, action);
    const actionLabel =
      action === "upgrade" ? "提高難度" : action === "downgrade" ? "降低難度" : "維持難度";

    const aiTags = [
      attentionLevel === "stable" ? "專注穩定" : attentionLevel === "mild_drop" ? "後段專注略降" : "後段專注明顯下降",
      impulseLevel === "low" ? "衝動控制佳" : impulseLevel === "medium" ? "衝動點擊偏多" : "衝動點擊明顯",
      stabilityLevel === "low" ? "反應穩定" : stabilityLevel === "medium" ? "反應波動偏高" : "反應波動明顯",
      assistedNeed === "low" ? "提示需求低" : assistedNeed === "medium" ? "需要少量提示" : "提示需求高",
    ];

    const parentSummary =
      action === "upgrade"
        ? "孩子這次反應穩定、漏答少，也不太需要提示。下次可以稍微提高難度。"
        : action === "downgrade"
          ? "孩子這次可能有些吃力，後段較容易漏掉或需要提示。下次建議降低一點難度，先維持成功經驗。"
          : "孩子這次表現大致穩定，建議下次先維持目前難度，繼續觀察後段專注狀態。";

    const clinicianSummary = [
      `AI 建議：${actionLabel}至 ${nextDifficulty}。`,
      `Accuracy ${accuracy}%，Avg RT ${avgReactionTime}ms，RT CV ${rtCV}，miss rate ${missRate}%，assisted rate ${assistedRate}%。`,
      `後段變慢 ${rtSlowing}ms，attention drop ${attentionDrop}，疲勞風險 ${fatigueRisk}。`,
      "本分析僅作為訓練觀察與難度調整參考，不作為醫療診斷。"
    ].join(" ");

    return {
      attentionLevel,
      impulseLevel,
      stabilityLevel,
      fatigueRisk,
      assistedNeed,
      action,
      nextDifficulty,
      aiTags,
      parentSummary,
      clinicianSummary,
      metrics: {
        accuracy,
        avgReactionTime,
        missRate,
        falseAlarmRate,
        backgroundClickRate,
        rtCV,
        assistedRate,
        attentionDrop,
        rtSlowing,
      },
    };
  };

  const buildSrtTrainingAiResult = (records, falseClicks, repeatedClicks) => {
    const totalTrials = Math.max(records.length, 1);
    const correctTrials = records.filter((record) => record.isCorrect === true).length;
    const reactionTimes = records
      .filter((record) => record.trainingAction === "hit" && typeof record.reactionTime === "number")
      .map((record) => record.reactionTime);

    const firstHalfRecords = records.slice(0, Math.floor(records.length / 2));
    const secondHalfRecords = records.slice(Math.floor(records.length / 2));
    const firstHalfMiss = firstHalfRecords.filter((record) => record.missed || record.timeout).length;
    const secondHalfMiss = secondHalfRecords.filter((record) => record.missed || record.timeout).length;

    const errorTypes = {
      miss: records.filter((record) => record.missed === true).length,
      randomClick: falseClicks,
      wrongTarget: records.filter((record) => record.trainingAction === "clickedRotten").length,
      repeatedClick: repeatedClicks,
      timeout: records.filter((record) => record.timeout === true).length,
      sequenceError: 0,
      ruleSwitchError: 0,
    };

    const goldenTotal = records.filter((record) => record.targetType === "golden").length;
    const goldenHitCount = records.filter(
      (record) => record.targetType === "golden" && record.trainingAction === "hit"
    ).length;
    const rottenTotal = records.filter((record) => record.targetType === "rotten").length;
    const falseAlarmCount = records.filter(
      (record) => record.trainingAction === "clickedRotten"
    ).length;

    const distractorMetrics = {
      goldenTotal,
      goldenHitCount,
      goldenHitRate: goldenTotal > 0 ? Math.round((goldenHitCount / goldenTotal) * 100) : null,
      rottenTotal,
      falseAlarmCount,
      rottenClickRate: rottenTotal > 0 ? Math.round((falseAlarmCount / rottenTotal) * 100) : null,
    };

    const longAttentionMetrics = buildLongAttentionMetrics(records);

    const currentConfig = difficultySettings[difficultyRef.current] || difficultySettings["easy-1"];
    const displayDifficulty = getDisplayDifficultyKey(difficultyRef.current);

    const performanceResult = analyzePerformance({
      totalTrials,
      correctTrials,
      reactionTimes,
      errorTypes,
      difficulty: displayDifficulty,
    });

    const errorResult = analyzeErrors(errorTypes);

    const calculatedFatigueLevel = analyzeFatigue({
      firstHalfRT: getAverageRt(firstHalfRecords),
      secondHalfRT: getAverageRt(secondHalfRecords),
      missIncrease: Math.max(0, secondHalfMiss - firstHalfMiss),
    });

    const fatigueLevel = calculatedFatigueLevel || "low";

    const recommendedDifficulty = getRecommendedDifficulty({
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      errorTypes,
      fatigueLevel,
    });

    const ruleBasedRecommendation = buildRuleBasedSrtAiRecommendation({
      records,
      performanceResult,
      errorTypes,
      fatigueLevel,
      longAttentionMetrics,
      currentDifficulty: difficultyRef.current,
    });

    const gameResult = createGameResult({
      childId: getCurrentChildId(),
      gameId: "SRT",
      abilityType: "inhibition",
      mode: "training",
      difficulty: displayDifficulty,
      score,
      stars: performanceResult.stars,
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      totalPlayTime: Math.round(currentConfig.totalTime / 1000),
      errorTypes,
      fatigueLevel,
      attemptCount: 1,
    });

    return {
      gameResult,
      performanceResult,
      errorResult,
      fatigueLevel,
      recommendedDifficulty: ruleBasedRecommendation.nextDifficulty || recommendedDifficulty,
      baselineRecommendedDifficulty: recommendedDifficulty,
      errorTypes,
      distractorMetrics,
      longAttentionMetrics,
      ruleBasedRecommendation,
      aiRecommendation: ruleBasedRecommendation,
      parentSummary: ruleBasedRecommendation.parentSummary || performanceResult.parentSummary,
      clinicianSummary: ruleBasedRecommendation.clinicianSummary,
    };
  };

  const getChildStorageKey = (baseKey, childId) => `${baseKey}_${childId}`;

  const buildDataQuality = (records, invalidClickCount) => {
    const safeRecords = Array.isArray(records) ? records : [];
    const total = safeRecords.length;
    const timeoutCount = safeRecords.filter((record) => record.timeout === true).length;
    const hintCount = safeRecords.filter((record) => record.assisted === true).length;
    const timeoutRate = total > 0 ? Math.round((timeoutCount / total) * 100) : 100;
    const hintRate = total > 0 ? Math.round((hintCount / total) * 100) : 0;
    const invalidClickRate = total > 0 ? Math.round((invalidClickCount / total) * 100) : 0;
    const warnings = [];

    if (total < 10) warnings.push("有效題數不足");
    if (timeoutRate >= 25) warnings.push("逾時比例偏高");
    if (invalidClickRate >= 20) warnings.push("背景誤點比例偏高");
    if (hintRate >= 40) warnings.push("提示使用比例偏高");

    let status = "valid";
    if (total < 5 || timeoutRate >= 50) status = "insufficient";
    else if (warnings.length > 0) status = "usable_with_caution";

    return {
      status,
      validTrialCount: total,
      timeoutRate,
      invalidClickRate,
      hintRate,
      warnings,
    };
  };

  const saveTrainingStageProgress = (stars, resultPayload) => {
    const childId = resultPayload?.childId;
    if (!childId) return;

    const starCount = clampStars(stars);
    const { stageId, level, todayKey } = trainingStageInfo;
    const levelKey = `${GAME_ID}-${level}`;
    const todayLevelKey = `${todayKey}-${GAME_ID}-${level}`;
    const prefix = `child_${childId}`;

    localStorage.setItem(`${prefix}_ef_game_${stageId}_completed`, "true");
    localStorage.setItem(`${prefix}_ef_game_${stageId}_stars`, String(starCount));
    localStorage.setItem(`${prefix}_training_${GAME_ID}_level_${level}_completed`, "true");
    localStorage.setItem(`${prefix}_training_${GAME_ID}_level_${level}_stars`, String(starCount));

    appendUniqueStorageItems(getChildStorageKey(COMPLETED_LEVELS_STORAGE_KEY, childId), [
      stageId,
      levelKey,
      todayLevelKey,
    ]);

    const starEntries = [
      [stageId, { stars: starCount, gameId: GAME_ID, level, todayKey, updatedAt: resultPayload.generatedAt }],
      [levelKey, starCount],
      [todayLevelKey, starCount],
      [`${GAME_ID}_L${level}`, starCount],
    ];

    [
      "ef_game_training_stage_stars",
      "ef_game_stage_stars",
      "ef_game_level_stars",
      "trainingStageStars",
      "trainingLevelStars",
      "gameStars",
    ].forEach((key) => writeObjectStarMap(getChildStorageKey(key, childId), starEntries));
  };

  const showStoryHint = (text, duration = 1200) => {
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);

    setHintText(text);
    setShowHint(true);

    hintTimeoutRef.current = setTimeout(() => {
      setShowHint(false);
    }, duration);
  };

  const handleStart = () => {
    resetTraining();
    setShowDetailedResult(false);
    setGamePhase("intro");
  };

  const handleIntroEnd = () => {
    clearAllTimers();
    setGamePhase("step");
  };

  const handleTutorialVideoEnd = () => {
    startTraining();
  };

  const startCountdown = () => {
    startTraining();
  };

  const startTraining = () => {
    clearAllTimers();

    const currentChild = getCurrentChildProfile();
    if (!currentChild?.childId) {
      navigate("/child-select", { replace: true });
      return;
    }

    finishingRef.current = false;
    startedAtRef.current = new Date().toISOString();

    const currentConfig = difficultySettings[difficultyRef.current] || difficultySettings["easy-1"];

    setScore(0);
    setTrialRecords([]);
    setFalseClickCount(0);
    setRepeatedClickCount(0);

    trialRecordsRef.current = [];
    falseClickCountRef.current = 0;
    repeatedClickCountRef.current = 0;
    setItem(null);
    setEffect(null);
    setFalseStartWarning(null);
    setShowMouseGuide(false);
    setAssistEffect(null);
    setIdleFlashId(null);

    currentTrialRef.current = 0;
    spawnTimeRef.current = null;
    currentItemRef.current = null;
    trialLockedRef.current = false;
    lastActionTimeRef.current = Date.now();
    lastGuidanceHintTimeRef.current = 0;
    consecutiveMissRef.current = 0;
    consecutiveBackgroundClickRef.current = 0;
    assistedTrialRef.current = false;
    assistTypeRef.current = null;
    assistShownAtRef.current = null;
    recentTypesRef.current = [];

    setTimeLeft(Math.ceil(currentConfig.totalTime / 1000));
    setGamePhase("playing");

    showStoryHint(getStartHint(difficultyRef.current), 1000);

    gameTimerRef.current = setTimeout(() => {
      finishTraining();
    }, currentConfig.totalTime);

    clockIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    idleCheckRef.current = setInterval(() => {
      if (phaseRef.current !== "playing") return;

      const idleDuration = Date.now() - lastActionTimeRef.current;
      const currentItem = currentItemRef.current;

      if (idleDuration >= 10000 && !currentItem) {
        triggerIdleFlash();
      }
    }, 1000);

    scheduleNextTrial(getRandomDelay(currentConfig));
  };

  const finishTraining = () => {
    if (finishingRef.current || phaseRef.current === "ending" || phaseRef.current === "result") return;
    finishingRef.current = true;

    clearAllTimers();

    setItem(null);
    setEffect(null);
    setFalseStartWarning(null);
    setShowMouseGuide(false);
    setAssistEffect(null);
    setIdleFlashId(null);
    setShowHint(false);

    currentItemRef.current = null;
    spawnTimeRef.current = null;
    trialLockedRef.current = false;

    const currentChild = getCurrentChildProfile();
    if (!currentChild?.childId) {
      finishingRef.current = false;
      navigate("/child-select", { replace: true });
      return;
    }

    const records = trialRecordsRef.current;
    const invalidClicks = falseClickCountRef.current;
    const scoringRecords = [
      ...records,
      ...Array.from({ length: invalidClicks }).map((_, index) => ({
        trialIndex: `FC-${index + 1}`,
        isCorrect: false,
        reactionTime: null,
        timeout: false,
        missed: false,
        falseClick: true,
        targetType: "background",
        trainingAction: "backgroundClick",
        scoreValue: 0,
        positionX: null,
        positionY: null,
        timestamp: Date.now(),
      })),
    ];

    let scoringResult = {};
    try {
      scoringResult = calculateSrtScore(scoringRecords) || {};
    } catch (error) {
      console.error("SRT 計分失敗，改用基本結果：", error);
    }

    let aiAnalysis = {};
    try {
      const legacyAnalysis = buildSrtTrainingAiResult(
        records,
        invalidClicks,
        repeatedClickCountRef.current
      ) || {};

      const trainingAnalysis = analyzeSrtTraining({
        records,
        falseClickCount: invalidClicks,
        repeatedClickCount: repeatedClickCountRef.current,
        difficulty: difficultyRef.current,
        totalTime: Math.round(
          (difficultySettings[difficultyRef.current]?.totalTime || 0) / 1000
        ),
        childProfile: currentChild,
      }) || {};

      aiAnalysis = {
        ...legacyAnalysis,
        ...trainingAnalysis,
        performanceResult: legacyAnalysis.performanceResult || {},
        gameResult: legacyAnalysis.gameResult || {},
        errorResult: legacyAnalysis.errorResult || {},
        errorTypes: legacyAnalysis.errorTypes || {},
        distractorMetrics:
          legacyAnalysis.distractorMetrics || trainingAnalysis.metrics || {},
        longAttentionMetrics:
          trainingAnalysis.segmentAnalysis || legacyAnalysis.longAttentionMetrics || {},
        ruleBasedRecommendation:
          trainingAnalysis.recommendation || legacyAnalysis.ruleBasedRecommendation || null,
        aiRecommendation:
          trainingAnalysis.recommendation || legacyAnalysis.aiRecommendation || null,
        recommendedDifficulty:
          trainingAnalysis.nextDifficulty ||
          legacyAnalysis.recommendedDifficulty ||
          difficultyRef.current,
        parentSummary:
          trainingAnalysis.parentSummary || legacyAnalysis.parentSummary,
        clinicianSummary:
          trainingAnalysis.clinicianSummary || legacyAnalysis.clinicianSummary,
      };
    } catch (error) {
      console.error("SRT AI 分析失敗，不影響結果保存：", error);
      aiAnalysis = {
        errorTypes: {},
        longAttentionMetrics: {},
        parentSummary: "本次訓練已完成，進階分析暫時無法產生。",
        clinicianSummary: "本次訓練已保存，但進階分析暫時無法產生。",
      };
    }

    const generatedAt = new Date().toISOString();
    const startedAt = startedAtRef.current || generatedAt;
    const durationMs = Math.max(0, Date.parse(generatedAt) - Date.parse(startedAt));
    const correctCount = records.filter((record) => record.isCorrect === true).length;
    const errorCount = Math.max(records.length - correctCount, 0) + invalidClicks;
    const reactionTimes = records
      .filter((record) => record.trainingAction === "hit" && typeof record.reactionTime === "number")
      .map((record) => record.reactionTime);
    const dataQuality = buildDataQuality(records, invalidClicks);
    const finalStars = clampStars(
      scoringResult?.stars ??
      aiAnalysis?.performanceResult?.stars ??
      aiAnalysis?.gameResult?.stars ??
      aiAnalysis?.gameResult?.scoreStars ??
      1
    );
    const resultId = `SRT-${currentChild.childId}-${trainingStageInfo.stageId}-${Date.now()}`;

    const resultPayload = {
      resultId,
      schemaVersion: "1.0.0",
      taskName: "Simple Reaction Time",
      taskCode: "SRT",
      gameId: "SRT",
      gameName: "橡實反應任務",
      mode: "training",
      abilityType: "inhibition",
      abilityLabel: "抑制控制",
      childId: currentChild.childId,
      childName: currentChild.name || currentChild.nickname || "",
      planId: trainingStageInfo.planId,
      sessionId: trainingStageInfo.sessionId,
      stageId: trainingStageInfo.stageId,
      level: trainingStageInfo.level,
      trainingOrder: trainingStageInfo.order,
      trainingTotal: trainingStageInfo.total,
      todayKey: trainingStageInfo.todayKey,
      startedAt,
      finishedAt: generatedAt,
      generatedAt,
      durationMs,
      difficulty: difficultyRef.current,
      difficultyStep: getDifficultyStep(difficultyRef.current),
      displayDifficulty: getDisplayDifficultyKey(difficultyRef.current),
      session: {
        planId: trainingStageInfo.planId,
        sessionId: trainingStageInfo.sessionId,
        stageId: trainingStageInfo.stageId,
        order: trainingStageInfo.order,
      },
      summary: {
        score,
        stars: finalStars,
        accuracy:
          aiAnalysis?.metrics?.accuracy ??
          aiAnalysis?.performanceResult?.accuracy ??
          0,
        avgReactionTime:
          aiAnalysis?.metrics?.avgRT ??
          aiAnalysis?.performanceResult?.avgReactionTime ??
          getAverageRt(records),
        totalTrials: records.length,
        correctCount,
        errorCount,
      },
      metrics: {
        errorTypes: aiAnalysis?.errorTypes || {},
        reactionTimes,
        longAttentionMetrics: aiAnalysis?.longAttentionMetrics || {},
        distractorMetrics: aiAnalysis?.distractorMetrics || {},
        repeatedClickCount: repeatedClickCountRef.current,
        invalidClickCount: invalidClicks,
      },
      trials: records,
      records,
      dataQuality,
      scoring: scoringResult,
      analysis: aiAnalysis,
      recommendation:
        aiAnalysis?.recommendation || aiAnalysis?.aiRecommendation || null,
      syncStatus: "pending",
      score,
      stars: finalStars,
      accuracy:
        aiAnalysis?.metrics?.accuracy ??
        aiAnalysis?.performanceResult?.accuracy ??
        0,
      avgReactionTime:
        aiAnalysis?.metrics?.avgRT ??
        aiAnalysis?.performanceResult?.avgReactionTime ??
        getAverageRt(records),
      totalTrials: records.length,
      correctCount,
      errorCount,
      errorTypes: aiAnalysis?.errorTypes || {},
      reactionTimes,
      longAttentionMetrics: aiAnalysis?.longAttentionMetrics || {},
      fatigueLevel: aiAnalysis?.fatigueLevel || "low",
      recommendedDifficulty: aiAnalysis?.recommendedDifficulty || difficultyRef.current,
      parentSummary: aiAnalysis?.parentSummary || "本次訓練已完成。",
      clinicianSummary: aiAnalysis?.clinicianSummary || "本次訓練已完成。",
      aiAnalysis,
    };

    saveTrainingStageProgress(finalStars, resultPayload);
    localStorage.setItem(
      getChildStorageKey("srtTrainingResult", currentChild.childId),
      JSON.stringify(resultPayload)
    );
    localStorage.setItem(
      getChildStorageKey("lastSrtTrainingResult", currentChild.childId),
      JSON.stringify(resultPayload)
    );

    try {
      const saveResult = saveUnifiedResult({
        rawResult: resultPayload,
        gameId: "SRT",
        mode: "training",
        difficulty: getDisplayDifficultyKey(difficultyRef.current),
        child: currentChild,
        route: "/training-srt",
        visibleRoles: ["child", "parent", "clinician"],
      });

      Promise.resolve(saveResult).catch((error) => {
        console.error("SRT 雲端同步失敗，結果已保存在本機：", error);
      });
    } catch (error) {
      console.error("SRT 結果同步失敗，結果已保存在本機：", error);
    }

    setGamePhase("ending");
  };

  const handleEndingVideoEnd = () => {
    clearAllTimers();
    setItem(null);
    setEffect(null);
    setFalseStartWarning(null);
    setShowMouseGuide(false);
    setAssistEffect(null);
    setIdleFlashId(null);
    setShowHint(false);
    setGamePhase("result");
  };

  const getStartHint = (levelKey) => {
    const displayKey = getDisplayDifficultyKey(levelKey);

    if (displayKey === "easy") {
      return "看到好橡實就點！";
    }

    if (displayKey === "medium") {
      return "好橡實點，壞橡實不點！";
    }

    return "看清楚，再快快點！";
  };

  const shouldShowGoldenWarmup = () => {
    const currentConfig = difficultySettings[difficultyRef.current] || difficultySettings["easy-1"];
    return currentConfig.goldenRate > 0;
  };

  const shouldShowRottenWarmup = () => {
    const currentConfig = difficultySettings[difficultyRef.current] || difficultySettings["easy-1"];
    return currentConfig.rottenRate > 0;
  };

  const spawnWarmupGolden = () => {
    if (phaseRef.current !== "warmup") return;

    setWarmupStep(2);
    setWarmupReady(false);
    setWarmupMessage("金色也可以點！");

    setWarmupItem({
      id: "warmup-golden",
      type: objectTypes.golden,
      x: 50,
      y: 55,
    });
  };

  const spawnWarmupRotten = () => {
    if (phaseRef.current !== "warmup") return;

    setWarmupStep(3);
    setWarmupReady(false);
    setWarmupMessage("壞橡實不要點！");

    setWarmupItem({
      id: "warmup-rotten",
      type: objectTypes.rotten,
      x: 50,
      y: 55,
    });

    warmupTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current !== "warmup") return;

      setWarmupItem(null);
      setWarmupStep(4);
      setWarmupReady(true);
      setWarmupMessage("很好！開始練習。 ");
    }, 1900);
  };

  const moveToNextWarmupStep = () => {
    if (warmupStep === 1) {
      if (shouldShowGoldenWarmup()) {
        warmupTimeoutRef.current = setTimeout(() => {
          spawnWarmupGolden();
        }, 850);
        return;
      }

      if (shouldShowRottenWarmup()) {
        warmupTimeoutRef.current = setTimeout(() => {
          spawnWarmupRotten();
        }, 850);
        return;
      }
    }

    if (warmupStep === 2) {
      if (shouldShowRottenWarmup()) {
        warmupTimeoutRef.current = setTimeout(() => {
          spawnWarmupRotten();
        }, 850);
        return;
      }
    }

    warmupTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current !== "warmup") return;

      setWarmupStep(4);
      setWarmupReady(true);
      setWarmupMessage("很好！開始練習。 ");
    }, 850);
  };

  const handleWarmupItemClick = (event) => {
    event.stopPropagation();

    if (phaseRef.current !== "warmup") return;
    if (!warmupItem) return;

    playClickSound();

    if (warmupItem.type.shouldClick) {
      setEffect({
        x: warmupItem.x,
        y: warmupItem.y,
        text: "接到！",
        type: "correct",
      });

      setWarmupItem(null);
      setWarmupMessage("接到了！");

      if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
      effectTimeoutRef.current = setTimeout(() => {
        setEffect(null);
      }, 650);

      moveToNextWarmupStep();
      return;
    }

    setEffect({
      x: warmupItem.x,
      y: warmupItem.y,
      text: "不要點",
      type: "penalty",
    });

    setWarmupMessage("壞橡實不要點喔！");

    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    effectTimeoutRef.current = setTimeout(() => {
      setEffect(null);
    }, 650);
  };

  const handleWarmupAreaClick = () => {
    if (phaseRef.current !== "warmup") return;

    if (warmupStep === 0) {
      setWarmupMessage("等橡實出現。 ");
      return;
    }

    if (warmupStep === 1 || warmupStep === 2) {
      setWarmupMessage("點橡實本身喔！");
      return;
    }

    if (warmupStep === 3) {
      setWarmupMessage("很好，壞橡實不用點。 ");
    }
  };

  const clearAssistState = () => {
    if (assistTimeoutRef.current) {
      clearTimeout(assistTimeoutRef.current);
      assistTimeoutRef.current = null;
    }

    if (assistClearTimeoutRef.current) {
      clearTimeout(assistClearTimeoutRef.current);
      assistClearTimeoutRef.current = null;
    }

    assistedTrialRef.current = false;
    assistTypeRef.current = null;
    assistShownAtRef.current = null;
    setAssistEffect(null);
  };

  const triggerIdleFlash = () => {
    const now = Date.now();

    if (idleFlashTimeoutRef.current) return;

    setIdleFlashId(now);
    idleFlashTimeoutRef.current = setTimeout(() => {
      setIdleFlashId(null);
      idleFlashTimeoutRef.current = null;
    }, 900);
  };

  const getAssistConfig = (targetType) => {
    const step = getDifficultyStep(difficultyRef.current);
    const missCount = consecutiveMissRef.current;

    if (!targetType?.shouldClick) return null;

    if (step <= 2) {
      return { delay: 1200, effect: "glow" };
    }

    if (step <= 3 && missCount >= 1) {
      return { delay: 1050, effect: "glow" };
    }

    if (step <= 6 && missCount >= 2) {
      return { delay: 950, effect: "shake" };
    }

    return null;
  };

  const triggerAssistEffect = (effectType) => {
    assistedTrialRef.current = true;
    assistTypeRef.current = effectType;
    assistShownAtRef.current = spawnTimeRef.current
      ? Math.round(performance.now() - spawnTimeRef.current)
      : null;
    setAssistEffect(effectType);

    if (effectType === "shake") {
      assistClearTimeoutRef.current = setTimeout(() => {
        setAssistEffect(null);
      }, 650);
    }
  };

  const getRandomPosition = () => {
    const step = getDifficultyStep(difficultyRef.current);
    const range =
      step <= 3
        ? { minX: 24, maxX: 76, minY: 28, maxY: 72 }
        : step <= 6
          ? { minX: 18, maxX: 82, minY: 22, maxY: 78 }
          : { minX: 12, maxX: 88, minY: 16, maxY: 84 };

    return {
      x: Math.random() * (range.maxX - range.minX) + range.minX,
      y: Math.random() * (range.maxY - range.minY) + range.minY,
    };
  };

  const getRandomDelay = (currentConfig = difficultySettings[difficultyRef.current] || difficultySettings["easy-1"]) => {
    const baseDelay = Number(currentConfig?.nextDelay) || 350;
    const minDelay = Math.max(450, Math.round(baseDelay * 0.7));
    const maxDelay = Math.max(minDelay + 160, Math.round(baseDelay * 1.6));
    return Math.round(Math.random() * (maxDelay - minDelay) + minDelay);
  };

  const scheduleNextTrial = (delay = getRandomDelay()) => {
    if (nextTrialTimeoutRef.current) {
      clearTimeout(nextTrialTimeoutRef.current);
      nextTrialTimeoutRef.current = null;
    }

    nextTrialTimeoutRef.current = setTimeout(() => {
      nextTrialTimeoutRef.current = null;
      spawnTrial();
    }, delay);
  };

  const drawRandomType = () => {
    const currentDifficulty = difficultyRef.current;
    const currentConfig = difficultySettings[currentDifficulty] || difficultySettings["easy-1"];
    const rand = Math.random();

    if (rand < currentConfig.normalRate) return objectTypes.normal;
    if (rand < currentConfig.normalRate + currentConfig.goldenRate) {
      return objectTypes.golden;
    }

    return objectTypes.rotten;
  };

  const getRandomType = (nextTrialNumber) => {
    const recentTypes = recentTypesRef.current;
    const recentTwo = recentTypes.slice(-2);
    const currentBlockTypes = recentTypes.slice(-4);
    const clickableCount = currentBlockTypes.filter(
      (typeKey) => typeKey === "normal" || typeKey === "golden"
    ).length;

    if (nextTrialNumber % 5 === 0 && clickableCount < 2) {
      return objectTypes.normal;
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = drawRandomType();
      const wouldRepeatSpecial =
        (candidate.key === "rotten" || candidate.key === "golden") &&
        recentTwo.length === 2 &&
        recentTwo.every((typeKey) => typeKey === candidate.key);

      if (!wouldRepeatSpecial) return candidate;
    }

    return objectTypes.normal;
  };

  const spawnTrial = () => {
    if (phaseRef.current !== "playing") return;

    if (itemTimeoutRef.current) {
      clearTimeout(itemTimeoutRef.current);
      itemTimeoutRef.current = null;
    }
    if (spawnAnimationFrameRef.current) {
      cancelAnimationFrame(spawnAnimationFrameRef.current);
      spawnAnimationFrameRef.current = null;
    }

    const currentDifficulty = difficultyRef.current;
    const currentConfig = difficultySettings[currentDifficulty] || difficultySettings["easy-1"];

    if (currentConfig.maxTrials && currentTrialRef.current >= currentConfig.maxTrials) {
      finishTraining();
      return;
    }

    const trialIndex = currentTrialRef.current + 1;
    currentTrialRef.current = trialIndex;

    const position = getRandomPosition();
    const type = getRandomType(trialIndex);
    recentTypesRef.current = [...recentTypesRef.current, type.key].slice(-24);

    const newItem = {
      id: `${Date.now()}-${trialIndex}`,
      trialIndex,
      x: position.x,
      y: position.y,
      type,
    };

    trialLockedRef.current = false;
    currentItemRef.current = newItem;
    spawnTimeRef.current = null;

    setFalseStartWarning(null);
    setShowMouseGuide(false);
    clearAssistState();
    if (mouseGuideTimeoutRef.current) {
      clearTimeout(mouseGuideTimeoutRef.current);
      mouseGuideTimeoutRef.current = null;
    }

    setItem(newItem);

    spawnAnimationFrameRef.current = requestAnimationFrame(() => {
      spawnAnimationFrameRef.current = null;
      if (phaseRef.current !== "playing") return;
      if (!currentItemRef.current || currentItemRef.current.id !== newItem.id) return;
      if (trialLockedRef.current) return;

      spawnTimeRef.current = performance.now();

      const assistConfig = getAssistConfig(type);

      if (assistConfig) {
        assistTimeoutRef.current = setTimeout(() => {
          if (phaseRef.current !== "playing") return;
          if (currentItemRef.current?.id !== newItem.id) return;
          if (trialLockedRef.current) return;
          triggerAssistEffect(assistConfig.effect);
        }, assistConfig.delay);
      }

      itemTimeoutRef.current = setTimeout(() => {
        handleTimeout(newItem);
      }, currentConfig.visibleTime);
    });
  };

  const handleTimeout = (targetItem) => {
    if (phaseRef.current !== "playing") return;
    if (!targetItem) return;
    if (trialLockedRef.current) return;

    if (!currentItemRef.current || targetItem.id !== currentItemRef.current.id) return;

    trialLockedRef.current = true;
    itemTimeoutRef.current = null;
    setShowMouseGuide(false);
    if (mouseGuideTimeoutRef.current) {
      clearTimeout(mouseGuideTimeoutRef.current);
      mouseGuideTimeoutRef.current = null;
    }
    if (assistTimeoutRef.current) {
      clearTimeout(assistTimeoutRef.current);
      assistTimeoutRef.current = null;
    }

    const currentDifficulty = difficultyRef.current;
    const currentConfig = difficultySettings[currentDifficulty] || difficultySettings["easy-1"];
    const isRotten = targetItem.type.key === "rotten";
    const wasAssisted = assistedTrialRef.current;
    const assistType = assistTypeRef.current;
    const assistShownAt = assistShownAtRef.current;

    if (isRotten) {
      setScore((prev) => prev + 1);

      addTrialRecord({
        trialIndex: targetItem.trialIndex,
        isCorrect: true,
        reactionTime: null,
        timeout: false,
        missed: false,
        falseClick: false,
        targetType: "rotten",
        trainingAction: "correctAvoid",
        scoreValue: 1,
        assisted: false,
        assistType: null,
        assistShownAt: null,
        reactionAfterAssist: null,
        positionX: targetItem.x,
        positionY: targetItem.y,
        timestamp: Date.now(),
      });

      consecutiveMissRef.current = 0;

    } else {
      addTrialRecord({
        trialIndex: targetItem.trialIndex,
        isCorrect: false,
        reactionTime: null,
        timeout: true,
        missed: true,
        falseClick: false,
        targetType: targetItem.type.key,
        trainingAction: "miss",
        scoreValue: 0,
        assisted: wasAssisted,
        assistType,
        assistShownAt,
        reactionAfterAssist: null,
        positionX: targetItem.x,
        positionY: targetItem.y,
        timestamp: Date.now(),
      });

      consecutiveMissRef.current += 1;

    }

    setAssistEffect(null);
    assistedTrialRef.current = false;
    assistTypeRef.current = null;
    assistShownAtRef.current = null;

    setItem(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;

    scheduleNextTrial(getRandomDelay(currentConfig));
  };

  const handleItemClick = (event, targetItem) => {
    event.stopPropagation();

    if (phaseRef.current !== "playing") return;
    if (!targetItem) return;
    if (!currentItemRef.current) return;
    if (targetItem.id !== currentItemRef.current.id) return;
    if (trialLockedRef.current) return;
    if (typeof spawnTimeRef.current !== "number") return;

    trialLockedRef.current = true;

    const currentDifficulty = difficultyRef.current;
    const currentConfig = difficultySettings[currentDifficulty] || difficultySettings["easy-1"];

    if (itemTimeoutRef.current) {
      clearTimeout(itemTimeoutRef.current);
      itemTimeoutRef.current = null;
    }
    if (mouseGuideTimeoutRef.current) {
      clearTimeout(mouseGuideTimeoutRef.current);
      mouseGuideTimeoutRef.current = null;
    }
    if (assistTimeoutRef.current) {
      clearTimeout(assistTimeoutRef.current);
      assistTimeoutRef.current = null;
    }
    setShowMouseGuide(false);
    playClickSound();

    lastActionTimeRef.current = Date.now();

    const reactionTime = Math.round(performance.now() - spawnTimeRef.current);

    const isRotten = targetItem.type.key === "rotten";
    const scoreValue = targetItem.type.score;
    const wasAssisted = assistedTrialRef.current;
    const assistType = assistTypeRef.current;
    const assistShownAt = assistShownAtRef.current;
    const reactionAfterAssist =
      wasAssisted && typeof assistShownAt === "number"
        ? Math.max(0, reactionTime - assistShownAt)
        : null;

    setScore((prev) => Math.max(0, prev + scoreValue));

    addTrialRecord({
      trialIndex: targetItem.trialIndex,
      isCorrect: !isRotten,
      reactionTime,
      timeout: false,
      missed: false,
      falseClick: isRotten,
      targetType: targetItem.type.key,
      trainingAction: isRotten ? "clickedRotten" : "hit",
      scoreValue,
      assisted: wasAssisted,
      assistType: wasAssisted ? assistType : null,
      assistShownAt: wasAssisted ? assistShownAt : null,
      reactionAfterAssist,
      positionX: targetItem.x,
      positionY: targetItem.y,
      timestamp: Date.now(),
    });

    if (isRotten) {
      consecutiveMissRef.current += 1;
    } else {
      consecutiveMissRef.current = 0;
    }

    consecutiveBackgroundClickRef.current = 0;

    setEffect({
      x: targetItem.x,
      y: targetItem.y,
    });

    setAssistEffect(null);
    assistedTrialRef.current = false;
    assistTypeRef.current = null;
    assistShownAtRef.current = null;

    setItem(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;

    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    effectTimeoutRef.current = setTimeout(() => {
      setEffect(null);
    }, 360);

    scheduleNextTrial(getRandomDelay(currentConfig));
  };

  const handleGameAreaClick = () => {
    if (phaseRef.current !== "playing") return;
    if (trialLockedRef.current && currentItemRef.current) return;

    const now = Date.now();

    setFalseClickCount((prev) => {
      const next = prev + 1;
      falseClickCountRef.current = next;
      return next;
    });

    if (lastActionTimeRef.current && now - lastActionTimeRef.current < 350) {
      setRepeatedClickCount((prev) => {
        const next = prev + 1;
        repeatedClickCountRef.current = next;
        return next;
      });
    }

    lastActionTimeRef.current = now;
    setShowMouseGuide(false);
    consecutiveBackgroundClickRef.current += 1;

    if (consecutiveBackgroundClickRef.current >= 3 || !currentItemRef.current) {
      triggerIdleFlash();
    }
  };

  const resultRecords = useMemo(() => {
    if (!falseClickCount || falseClickCount <= 0) return trialRecords;

    const extraFalseClickRecords = Array.from({ length: falseClickCount }).map(
      (_, index) => ({
        trialIndex: `FC-${index + 1}`,
        isCorrect: false,
        reactionTime: null,
        timeout: false,
        missed: false,
        falseClick: true,
        targetType: "background",
        trainingAction: "backgroundClick",
        scoreValue: 0,
        falseClickType: "backgroundClick",
        assisted: false,
        assistType: null,
        assistShownAt: null,
        reactionAfterAssist: null,
        positionX: null,
        positionY: null,
        timestamp: Date.now(),
      })
    );

    return [...trialRecords, ...extraFalseClickRecords];
  }, [trialRecords, falseClickCount]);

  const scoringResult = useMemo(() => {
    return calculateSrtScore(resultRecords);
  }, [resultRecords]);

  const scoringSummary = scoringResult?.summary || {};

  const rtRecords = useMemo(() => {
    return resultRecords
      .filter(
        (record) =>
          record.trainingAction === "hit" &&
          typeof record.reactionTime === "number"
      )
      .map((record) => record.reactionTime);
  }, [resultRecords]);

  const avgRT = useMemo(() => {
    if (rtRecords.length === 0) return 0;

    return Math.round(
      rtRecords.reduce((sum, rt) => sum + rt, 0) / rtRecords.length
    );
  }, [rtRecords]);

  const totalSpawn = trialRecords.length;

  const missCount = useMemo(() => {
    return resultRecords.filter(
      (record) => record.missed === true || record.timeout === true
    ).length;
  }, [resultRecords]);

  const aiAnalysis = useMemo(() => {
    const legacyAnalysis = buildSrtTrainingAiResult(
      trialRecords,
      falseClickCount,
      repeatedClickCount
    );

    const trainingAnalysis = analyzeSrtTraining({
      records: trialRecords,
      falseClickCount,
      repeatedClickCount,
      difficulty,
      totalTime: Math.round((config?.totalTime || 0) / 1000),
      childProfile: getCurrentChildProfile(),
    });

    return {
      ...legacyAnalysis,
      ...trainingAnalysis,
      performanceResult: legacyAnalysis?.performanceResult || {},
      gameResult: legacyAnalysis?.gameResult || {},
      errorResult: legacyAnalysis?.errorResult || {},
      errorTypes: legacyAnalysis?.errorTypes || {},
      distractorMetrics:
        legacyAnalysis?.distractorMetrics || trainingAnalysis?.metrics || {},
      longAttentionMetrics:
        trainingAnalysis?.segmentAnalysis || legacyAnalysis?.longAttentionMetrics || {},
      ruleBasedRecommendation:
        trainingAnalysis?.recommendation || legacyAnalysis?.ruleBasedRecommendation || null,
      aiRecommendation:
        trainingAnalysis?.recommendation || legacyAnalysis?.aiRecommendation || null,
      recommendedDifficulty:
        trainingAnalysis?.nextDifficulty ||
        legacyAnalysis?.recommendedDifficulty ||
        difficulty,
      parentSummary:
        trainingAnalysis?.parentSummary || legacyAnalysis?.parentSummary,
      clinicianSummary:
        trainingAnalysis?.clinicianSummary || legacyAnalysis?.clinicianSummary,
    };
    // Analyzer helpers are pure; these are their complete mutable data inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialRecords, falseClickCount, repeatedClickCount, score, difficulty, config]);

  /* eslint-disable react-hooks/exhaustive-deps -- buildLongAttentionMetrics is a pure render-local helper */
  const summaryData = useMemo(() => {
    const hitCount = resultRecords.filter(
      (record) => record.trainingAction === "hit"
    ).length;

    const correctRejectCount = resultRecords.filter(
      (record) => record.trainingAction === "correctAvoid"
    ).length;

    const falseAlarmCount = resultRecords.filter(
      (record) => record.trainingAction === "clickedRotten"
    ).length;

    const backgroundClickCount = resultRecords.filter(
      (record) => record.trainingAction === "backgroundClick"
    ).length;

    const validTrialCount = trialRecords.length;
    const assistedCount = resultRecords.filter((record) => record.assisted).length;
    const longAttentionMetrics = buildLongAttentionMetrics(trialRecords);
    const aiRecommendation =
      aiAnalysis.recommendation ||
      aiAnalysis.aiRecommendation ||
      aiAnalysis.ruleBasedRecommendation;

    const accuracy =
      validTrialCount > 0
        ? Math.round(((hitCount + correctRejectCount) / validTrialCount) * 100)
        : 0;

    return {
      mode: "training",
      difficulty: config.displayKey,
      difficultyKey: difficulty,
      difficultyStep: config.step,
      displayDifficulty: config.displayKey,
      difficultyLabel: config.label,
      difficultyStoryLabel: config.storyLabel,
      finalScore: score,
      totalTrials: validTrialCount,
      hitCount,
      missCount,
      correctRejectCount,
      falseAlarmCount,
      // 舊版 ResultPage 相容欄位；核心判定仍使用 correctReject / falseAlarm。
      correctAvoidCount: correctRejectCount,
      clickedRottenCount: falseAlarmCount,
      falseClickCount: backgroundClickCount,
      repeatedClickCount,
      errorTypes: aiAnalysis.errorTypes,
      distractorMetrics: aiAnalysis.distractorMetrics,
      warningLevel: aiAnalysis.errorResult?.warningLevel,
      fatigueLevel: aiAnalysis.fatigueLevel,
      recommendedDifficulty: aiAnalysis.recommendedDifficulty,
      parentSummary: aiAnalysis.parentSummary,
      clinicianSummary: aiAnalysis.clinicianSummary,
      aiRecommendation,
      aiTags: aiRecommendation?.aiTags || [],
      avgRT,
      accuracy,
      assistedCount,
      assistedRate: validTrialCount > 0 ? Math.round((assistedCount / validTrialCount) * 100) : 0,
      longAttentionMetrics,
      rtCV: longAttentionMetrics.rtCV,
      rtStd: longAttentionMetrics.rtStd,
      attentionDrop: longAttentionMetrics.attentionDrop,
    };
  }, [
    resultRecords,
    trialRecords,
    difficulty,
    config.displayKey,
    config.step,
    config.label,
    config.storyLabel,
    score,
    missCount,
    repeatedClickCount,
    aiAnalysis,
    avgRT,
    scoringResult,
    scoringSummary,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const resultStars = useMemo(() => {
    try {
      const childId = getCurrentChildId();
      const data = childId
        ? JSON.parse(localStorage.getItem(getChildStorageKey("srtTrainingResult", childId)) || "{}")
        : {};
      const stars =
        data?.scoring?.stars ??
        data?.stars ??
        data?.aiAnalysis?.performanceResult?.stars ??
        data?.aiAnalysis?.gameResult?.stars ??
        data?.aiAnalysis?.gameResult?.scoreStars ??
        summaryData?.scoringStars ??
        summaryData?.aiAnalysis?.performanceResult?.stars ??
        1;
      return clampStars(stars);
    } catch (error) {
      return clampStars(aiAnalysis?.performanceResult?.stars ?? 1);
    }
    // getCurrentChildId reads storage only when result state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, aiAnalysis, summaryData]);

  return (
    <div
      className="srt-training-page"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.22)),
          url(${bgImg})
        `,
      }}
    >
      <style>{trainingPageCss}</style>

      {phase === "start" && (
        <main className="srt-center-shell srt-start-shell">
          <section className="srt-soft-panel srt-start-panel game-start-card-artwork srt-opening-card-artwork" aria-label="訓練開始畫面">
            <div className="srt-game-title">幫小飛鼠弟弟接橡實</div>
            <div className="srt-start-content">
              <div className="srt-dialog-bubble srt-opening-bubble">
                一起幫小飛鼠弟弟接橡實！
              </div>
              <div className="srt-round-icon srt-start-avatar">
                <img src={startAvatar} width="364" height="364" alt="小飛鼠頭像" />
              </div>
            </div>
            <div className="srt-guided-action srt-guided-start">
              <button type="button" className="srt-forest-button srt-image-button srt-btn-start" onClick={handleStart} aria-label="進入遊戲">
                <img src={homeStartBtn} width="532" height="177" alt="進入遊戲" />
              </button>
              <img loading="lazy" className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} width="156" height="156" alt="" aria-hidden="true" />
            </div>
          </section>
        </main>
      )}

      {phase === "intro" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-video-panel game-start-card-artwork srt-video-card-artwork" aria-label="前導動畫">
            <div className="srt-video-frame">
              <video
                src={introVideo}
                autoPlay
                muted
                playsInline
                controls
                onEnded={handleIntroEnd}
                className="srt-video"
              />
            </div>
            <div className="srt-step-actions">
              <div className="srt-guided-action srt-guided-skip">
                <button type="button" className="srt-forest-button srt-image-button srt-btn-skip" onClick={handleIntroEnd} aria-label="跳過動畫">
                  <img src={homeSkipBtn} width="532" height="177" loading="lazy" alt="跳過動畫" />
                </button>
              </div>
              <div className="srt-guided-action srt-guided-next">
                <button type="button" className="srt-forest-button srt-image-button srt-btn-next" onClick={handleIntroEnd} aria-label="下一步">
                  <img src={homeNextBtn} width="532" height="177" loading="lazy" alt="下一步" />
                </button>
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} width="156" height="156" loading="lazy" alt="" aria-hidden="true" />
              </div>
            </div>
          </section>
        </main>
      )}

      {phase === "step" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-video-panel game-start-card-artwork srt-video-card-artwork" aria-label="步驟教學影片">
            <div className="srt-video-frame">
              <video
                src={tutorialVideo}
                autoPlay
                muted
                playsInline
                controls
                onEnded={handleTutorialVideoEnd}
                className="srt-video"
              />
            </div>
            <div className="srt-step-actions">
              <div className="srt-guided-action srt-guided-skip">
                <button type="button" className="srt-forest-button srt-image-button srt-btn-skip" onClick={startTraining} aria-label="跳過動畫">
                  <img src={homeSkipBtn} width="532" height="177" loading="lazy" alt="跳過動畫" />
                </button>
              </div>
              <div className="srt-guided-action srt-guided-next">
                <button type="button" className="srt-forest-button srt-image-button srt-btn-next" onClick={startTraining} aria-label="下一步">
                  <img src={homeNextBtn} width="532" height="177" loading="lazy" alt="下一步" />
                </button>
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} width="156" height="156" loading="lazy" alt="" aria-hidden="true" />
              </div>
            </div>
          </section>
        </main>
      )}

      {phase === "warmup" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-tutorial-panel" aria-label="互動暖身教學">
            <div
              className="srt-tutorial-scene srt-training-warmup-scene"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255, 255, 255, 0.24), rgba(255, 247, 216, 0.16)),
                  url(${bgImg})
                `,
              }}
              onClick={handleWarmupAreaClick}
            >
              <div className="srt-tutorial-grid srt-warmup-grid">
                <div className="srt-avatar-guide">
                  <img src={tutorialAvatar} width="364" height="364" loading="lazy" alt="皮皮小助手" />
                </div>

                <div className="srt-rule-steps srt-training-rule-steps" aria-label="訓練規則說明">
                  <div className="srt-guide-bubble srt-guide-main">{warmupMessage}</div>
                  <div className="srt-guide-arrow" aria-hidden="true" />
                  <div className="srt-guide-bubble srt-guide-wait">
                    {shouldShowRottenWarmup() ? "好橡實點，壞橡實不點" : "看到橡實就點"}
                  </div>
                </div>

                <div className="srt-tutorial-practice">
                  {warmupItem && (
                    <button
                      type="button"
                      className={`srt-practice-acorn ${warmupReady ? "is-ready" : ""}`}
                      onClick={handleWarmupItemClick}
                      aria-label={warmupItem.type.label}
                    >
                      <img loading="lazy" src={warmupItem.type.img} width={warmupItem.type.intrinsicWidth} height={warmupItem.type.intrinsicHeight} alt={warmupItem.type.label} />
                    </button>
                  )}
                  {warmupItem && warmupItem.type.shouldClick && (
                    <img loading="lazy" className="srt-mouse-guide srt-mouse-on-acorn" src={mouseGuideImg} width="156" height="156" alt="" aria-hidden="true" />
                  )}
                  <div className="srt-tap-hint">{warmupReady ? "很好！可以開始囉" : "先試試看"}</div>
                  {effect && (
                    <div
                      className={effect.text ? `srt-score-effect ${effect.type === "correct" ? "srt-score-effect-correct" : "srt-score-effect-penalty"}` : "srt-test-effect srt-demo-effect"}
                      style={{ left: `${effect.x}%`, top: `${effect.y}%` }}
                    >
                      {effect.text || ""}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`srt-guided-action srt-guided-start ${warmupReady ? "is-active" : "is-disabled"}`}>
              <button
                type="button"
                className="srt-forest-button srt-image-button srt-btn-start"
                onClick={startCountdown}
                disabled={!warmupReady}
                aria-label="開始練習"
              >
                <img src={homeStartBtn} width="532" height="177" alt="開始練習" />
              </button>
              {warmupReady && (
                <img loading="lazy" className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} width="156" height="156" alt="" aria-hidden="true" />
              )}
            </div>
          </section>
        </main>
      )}

      {phase === "playing" && (
        <main className="srt-play-page">
          <div className={`srt-test-game-area ${idleFlashId ? "srt-idle-flash" : ""}`} onClick={handleGameAreaClick}>
            {item && (
              <button
                type="button"
                className="srt-item-hitbox"
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${Math.round(config.itemSize * 1.42)}px`,
                  height: `${Math.round(config.itemSize * 1.42)}px`,
                }}
                onClick={(event) => handleItemClick(event, item)}
                aria-label={item.type.label}
              >
                <img loading="lazy"
                  src={item.type.img}
                  width={item.type.intrinsicWidth}
                  height={item.type.intrinsicHeight}
                  alt=""
                  draggable={false}
                  className={`srt-test-item ${getDisplayDifficultyKey(difficulty) === "hard" ? "srt-game-item-hard" : ""} ${assistEffect === "glow" ? "srt-assist-glow" : ""} ${assistEffect === "shake" ? "srt-assist-shake" : ""}`}
                  style={{ width: `${config.itemSize}px` }}
                />
              </button>
            )}

            {effect && <div className="srt-test-effect" style={{ left: `${effect.x}%`, top: `${effect.y}%` }} />}
          </div>
        </main>
      )}

      {phase === "ending" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-video-panel game-start-card-artwork srt-video-card-artwork" aria-label="結束動畫">
            <div className="srt-video-frame">
              <video
                src={endingVideo}
                autoPlay
                muted
                playsInline
                controls
                onEnded={handleEndingVideoEnd}
                className="srt-video"
              />
            </div>
            <div className="srt-guided-action srt-guided-skip">
              <button type="button" className="srt-forest-button srt-image-button srt-btn-skip" onClick={handleEndingVideoEnd} aria-label="跳過動畫">
                <img src={homeSkipBtn} width="532" height="177" loading="lazy" alt="跳過動畫" />
              </button>
              <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} width="156" height="156" loading="lazy" alt="" aria-hidden="true" />
            </div>
          </section>
        </main>
      )}

      {phase === "result" && !showDetailedResult && (
        <main className="srt-center-shell srt-result-shell">
          <section className="srt-soft-panel srt-result-panel game-result-card-artwork srt-summary-card-artwork" aria-label="訓練結果">
            <div className="srt-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span key={star} className={`srt-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>
              ))}
            </div>

            <div className="srt-start-content srt-result-content">
              <div className="srt-dialog-bubble">你完成了！</div>
              <div className="srt-round-icon srt-result-icon">
                <img src={levelIcon} width="340" height="340" loading="lazy" alt="SRT 關卡圖示" />
              </div>
            </div>


            <div className="srt-result-actions">
              <div className="srt-guided-action srt-guided-result-main">
                <button type="button" className="srt-forest-button srt-image-button srt-btn-home" onClick={() => navigate("/game-menu")} aria-label="回到森林">
                  <img src={homeBackBtn} width="532" height="177" loading="lazy" alt="回到森林" />
                </button>
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} width="156" height="156" loading="lazy" alt="" aria-hidden="true" />
              </div>
              <button type="button" className="srt-forest-button srt-image-button srt-btn-replay" onClick={handleStart} aria-label="再玩一次">
                <img src={homeAgainBtn} width="532" height="177" loading="lazy" alt="再玩一次" />
              </button>
              <button type="button" className="srt-forest-button srt-image-button srt-btn-detail" onClick={() => setShowDetailedResult(true)} aria-label="詳細結果">
                <img src={homeResultBtn} width="532" height="177" loading="lazy" alt="查看詳細結果" />
              </button>
            </div>
          </section>
        </main>
      )}

      {phase === "result" && showDetailedResult && (
        <ResultPageSRT
          mode="training"
          score={score}
          avgRT={avgRT}
          rtRecords={rtRecords}
          trialRecords={resultRecords}
          totalSpawn={totalSpawn}
          missCount={missCount}
          summaryData={summaryData}
          onRestart={handleStart}
          onBackToMenu={() => navigate("/game-menu")}
        />
      )}
    </div>
  );
};

export default TrainingPage_SRT;

const trainingPageCss = `
.srt-training-page {
  min-height: 100vh;
  font-family: "jf-openhuninn", "Fredoka", "Nunito", "Noto Sans TC", sans-serif;
  text-align: center;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color: #4b2c16;
}

.srt-training-page::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 52% 9%, rgba(255,255,255,0.22), transparent 28%),
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,239,188,0.10));
  z-index: 0;
}

.srt-center-shell {
  width: min(88vw, 1180px);
  min-height: 100vh;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 28px 0;
  position: relative;
  z-index: 1;
}

.srt-start-shell,
.srt-result-shell {
  width: min(72vw, 860px);
}

.srt-soft-panel {
  width: 100%;
  position: relative;
  box-sizing: border-box;
  border: 7px solid #f6a51f;
  border-radius: 58px;
  background:
    linear-gradient(180deg, rgba(255, 252, 225, 0.98), rgba(255, 237, 168, 0.98));
  box-shadow:
    0 18px 0 rgba(202, 116, 24, 0.13),
    0 24px 42px rgba(95, 64, 22, 0.16),
    inset 0 0 0 8px rgba(255, 255, 255, 0.45),
    inset 0 0 0 16px rgba(255, 215, 105, 0.20);
}

.srt-soft-panel::before {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 42px;
  border: 2px dashed rgba(230, 170, 67, 0.42);
  pointer-events: none;
}

.srt-soft-panel::after {
  content: "";
  position: absolute;
  left: 30px;
  right: 30px;
  bottom: 18px;
  height: 42px;
  pointer-events: none;
  background:
    radial-gradient(circle at 4% 40%, #8bc947 0 13px, transparent 14px),
    radial-gradient(circle at 8% 15%, #a4da58 0 9px, transparent 10px),
    radial-gradient(circle at 92% 42%, #8bc947 0 13px, transparent 14px),
    radial-gradient(circle at 88% 18%, #a4da58 0 9px, transparent 10px);
  opacity: 0.92;
}

.srt-start-panel {
  min-height: 560px;
  padding: 58px 70px 74px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 34px;
}

.srt-game-title {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: min(100%, 420px);
  padding: 14px 42px 16px;
  border-radius: 20px;
  border: 4px solid #e9a33c;
  background:
    linear-gradient(180deg, rgba(255, 226, 129, 0.96), rgba(255, 244, 194, 0.98));
  color: #7a3f16;
  font-size: clamp(34px, 4vw, 52px);
  font-weight: 950;
  line-height: 1.08;
  letter-spacing: 2px;
  text-shadow: 0 3px 0 rgba(255, 255, 255, 0.85);
  box-shadow:
    0 8px 0 rgba(210, 130, 37, 0.24),
    0 14px 24px rgba(91, 57, 18, 0.12),
    inset 0 0 0 5px rgba(255, 255, 255, 0.34);
}

.srt-game-title::before,
.srt-game-title::after {
  content: "🌿";
  position: absolute;
  top: 50%;
  font-size: 28px;
  transform: translateY(-50%);
}

.srt-game-title::before { left: 18px; }
.srt-game-title::after { right: 18px; transform: translateY(-50%) scaleX(-1); }

.srt-start-content {
  position: relative;
  z-index: 2;
  width: min(100%, 690px);
  display: grid;
  grid-template-columns: minmax(300px, 1fr) 158px;
  align-items: center;
  justify-content: center;
  gap: 44px;
}

.srt-dialog-bubble {
  min-height: 138px;
  border: 4px solid #f0c77b;
  border-radius: 28px;
  background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
  color: #6d3717;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 30px;
  font-size: clamp(26px, 3vw, 38px);
  line-height: 1.32;
  font-weight: 900;
  box-sizing: border-box;
  position: relative;
  box-shadow: 0 8px 0 rgba(225, 169, 84, 0.12), inset 0 0 0 5px rgba(255, 235, 174, 0.35);
}

.srt-opening-bubble {
  min-height: 132px;
}

.srt-dialog-bubble::before {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: 20px;
  border: 2px dashed rgba(229, 189, 119, 0.55);
  pointer-events: none;
}

.srt-dialog-bubble::after {
  content: "";
  position: absolute;
  right: -30px;
  top: 50%;
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, #fff 0%, #fff9e9 80%);
  border-top: 4px solid #f0c77b;
  border-right: 4px solid #f0c77b;
  transform: translateY(-50%) rotate(45deg);
  border-radius: 4px;
}

.srt-round-icon {
  width: 158px;
  height: 158px;
  border-radius: 999px;
  background: linear-gradient(180deg, #82d9ff, #48aee8);
  border: 5px solid rgba(255,255,255,0.92);
  outline: 3px solid rgba(72, 157, 207, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  padding: 14px;
  box-shadow: 0 10px 0 rgba(42, 112, 165, 0.20), 0 18px 24px rgba(53, 91, 123, 0.18);
}

.srt-round-icon::after {
  content: "★";
  position: absolute;
  right: 4px;
  bottom: 2px;
  color: #ffd948;
  font-size: 36px;
  -webkit-text-stroke: 2px #e29b21;
  text-shadow: 0 3px 0 rgba(139, 96, 20, 0.14);
}

.srt-round-icon img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 50%;
  display: block;
}

.srt-start-avatar {
  background: linear-gradient(180deg, #84dcff, #42afe9);
}

.srt-forest-button {
  position: relative;
  z-index: 2;
  min-width: 220px;
  min-height: 76px;
  padding: 12px 36px;
  border-radius: 24px;
  color: #ffffff;
  font-family: inherit;
  font-size: clamp(25px, 2.8vw, 38px);
  font-weight: 950;
  line-height: 1.15;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
  text-shadow: 0 3px 0 rgba(35, 96, 36, 0.36), 0 0 8px rgba(35, 96, 36, 0.18);
}

.srt-forest-button::before,
.srt-forest-button::after {
  content: "";
  position: absolute;
  width: 30px;
  height: 22px;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 30% 55%, #e8ff9b 0 9px, transparent 10px),
    radial-gradient(ellipse at 72% 45%, #7bc946 0 11px, transparent 12px);
  filter: drop-shadow(0 2px 0 rgba(65, 115, 35, 0.20));
}

.srt-forest-button::before { left: 12px; bottom: 9px; transform: rotate(-18deg); }
.srt-forest-button::after { right: 12px; top: 9px; transform: rotate(154deg); }

.srt-forest-button:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.05);
}

.srt-forest-button:active:not(:disabled) {
  transform: translateY(1px);
}

.srt-forest-button:disabled {
  opacity: 0.52;
  cursor: default;
  filter: grayscale(0.18);
}

.srt-btn-start,
.srt-btn-home,
.srt-btn-replay,
.srt-btn-detail,
.srt-btn-skip,
.srt-btn-next {
  border: 4px solid rgba(255,255,255,0.86);
  outline: 3px solid #5d9d32;
  background: linear-gradient(180deg, #b9f235 0%, #77c927 48%, #4e9a23 100%);
  box-shadow:
    0 6px 0 #377721,
    0 13px 22px rgba(61, 97, 33, 0.20),
    inset 0 4px 0 rgba(255,255,255,0.48),
    inset 0 -5px 0 rgba(49, 128, 31, 0.26);
}

.srt-btn-replay {
  outline-color: #67a833;
}

.srt-btn-detail {
  outline-color: #598f2e;
}

.srt-btn-skip {
  min-width: 260px;
}


.srt-guided-action {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}

.srt-image-button {
  min-width: 0;
  min-height: 0;
  width: clamp(188px, 18vw, 254px);
  height: auto;
  padding: 0;
  border: none;
  outline: none;
  border-radius: 18px;
  background: transparent;
  box-shadow: none;
  line-height: 0;
  overflow: visible;
}

.srt-image-button.srt-btn-start,
.srt-image-button.srt-btn-home,
.srt-image-button.srt-btn-replay,
.srt-image-button.srt-btn-detail,
.srt-image-button.srt-btn-skip,
.srt-image-button.srt-btn-next {
  min-width: 0;
  min-height: 0;
  border: none;
  outline: none;
  background: transparent;
  box-shadow: none;
}

.srt-image-button::before,
.srt-image-button::after {
  display: none;
}

.srt-image-button img {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(74, 48, 16, 0.22));
}

.srt-image-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.03);
  filter: brightness(1.04);
}

.srt-image-button:active:not(:disabled) {
  transform: translateY(1px) scale(0.98);
}

.srt-image-button:disabled {
  opacity: 0.56;
}

.srt-image-button:disabled img {
  filter: grayscale(0.35) drop-shadow(0 6px 6px rgba(74, 48, 16, 0.16));
}

.srt-btn-skip.srt-image-button,
.srt-btn-next.srt-image-button {
  width: clamp(198px, 19vw, 266px);
}

.srt-step-actions {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: clamp(18px, 3vw, 34px);
  position: relative;
  z-index: 2;
}

.srt-mouse-guide {
  position: absolute;
  width: clamp(48px, 5.2vw, 78px);
  height: auto;
  z-index: 8;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(58, 38, 14, 0.24));
  animation: srt-mouse-tap 1.15s ease-in-out infinite;
}

.srt-mouse-on-button {
  right: -18px;
  bottom: -18px;
  transform-origin: 18% 18%;
}

.srt-mouse-on-acorn {
  right: clamp(8px, 1.4vw, 18px);
  top: clamp(38px, 5vw, 70px);
  transform-origin: 18% 18%;
}

@keyframes srt-mouse-tap {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.92; }
  45% { transform: translate(-10px, -9px) scale(1.08); opacity: 1; }
  62% { transform: translate(-4px, -4px) scale(0.96); opacity: 1; }
}

.srt-video-panel,
.srt-tutorial-panel {
  min-height: 78vh;
  padding: 48px 68px 38px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.srt-video-frame {
  width: 100%;
  height: min(60vh, 560px);
  min-height: 360px;
  border: 4px solid #6fb6ec;
  border-radius: 24px;
  background: linear-gradient(180deg, #2fb5ff, #3189e5);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  box-shadow:
    0 8px 0 rgba(55, 121, 177, 0.18),
    inset 0 0 0 4px rgba(255,255,255,0.28);
}

.srt-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 前導互動教學保持原本結構，只微調在新背景中不破版 */
.srt-tutorial-scene {
  width: 100%;
  height: min(58vh, 540px);
  min-height: 360px;
  border: 2px solid rgba(115, 144, 82, 0.55);
  border-radius: 26px;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  box-shadow: inset 0 0 0 999px rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(22px, 3vw, 42px);
}

.srt-tutorial-scene::before {
  content: "";
  position: absolute;
  left: 7%;
  right: 7%;
  bottom: 12%;
  height: 18%;
  border-radius: 999px;
  background: rgba(112, 174, 77, 0.14);
  filter: blur(2px);
}

.srt-tutorial-grid {
  width: min(100%, 1040px);
  height: 100%;
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(132px, 0.8fr) minmax(280px, 1.45fr) minmax(168px, 0.9fr);
  align-items: center;
  justify-items: center;
  column-gap: clamp(20px, 4vw, 56px);
}

.srt-avatar-guide {
  width: clamp(128px, 16vw, 182px);
  height: clamp(128px, 16vw, 182px);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 5px solid #ff9a4b;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 10px;
  box-shadow: 0 16px 24px rgba(92, 66, 29, 0.16);
  box-sizing: border-box;
}

.srt-avatar-guide img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
  display: block;
}

.srt-rule-steps {
  width: 100%;
  min-height: 260px;
  display: grid;
  grid-template-rows: auto 64px auto;
  align-items: center;
  justify-items: center;
  gap: 10px;
}

.srt-guide-bubble,
.srt-tap-hint {
  z-index: 2;
  padding: 12px 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  border: 3px solid rgba(255, 132, 38, 0.78);
  color: #2c1d12;
  font-size: clamp(22px, 2.5vw, 36px);
  font-weight: 900;
  box-shadow: 0 10px 18px rgba(95, 70, 30, 0.12);
  white-space: nowrap;
}

.srt-guide-main,
.srt-guide-wait {
  position: static;
}

.srt-guide-arrow {
  width: min(100%, 320px);
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 153, 54, 0.12), rgba(255, 134, 38, 0.92));
  position: relative;
  transform: rotate(-4deg);
  transform-origin: center;
}

.srt-guide-arrow::after {
  content: "";
  position: absolute;
  right: -4px;
  top: 50%;
  width: 24px;
  height: 24px;
  border-top: 8px solid rgba(255, 134, 38, 0.92);
  border-right: 8px solid rgba(255, 134, 38, 0.92);
  transform: translateY(-50%) rotate(45deg);
}

.srt-tutorial-practice {
  min-width: 168px;
  min-height: 240px;
  display: grid;
  grid-template-rows: 1fr auto;
  align-items: center;
  justify-items: center;
  gap: 16px;
  position: relative;
}

.srt-practice-acorn {
  width: clamp(96px, 12vw, 136px);
  height: clamp(96px, 12vw, 136px);
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  box-shadow: 0 12px 24px rgba(69, 49, 24, 0.18);
  animation: srt-practice-float 1.5s ease-in-out infinite;
}

.srt-practice-acorn img {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
}

.srt-practice-acorn.is-ready {
  box-shadow: 0 0 0 9px rgba(255, 230, 102, 0.32), 0 0 30px rgba(255, 204, 60, 0.85);
  animation: none;
}

.srt-tap-hint {
  font-size: clamp(18px, 2vw, 28px);
  color: #6b4b23;
  opacity: 0.95;
}

@keyframes srt-practice-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.06); }
}

.srt-demo-effect {
  left: 50%;
  top: 40%;
}

.srt-play-page {
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

.srt-test-game-area {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.srt-test-game-area::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.04), transparent 35%);
}

.srt-item-hitbox {
  position: absolute;
  transform: translate(-50%, -50%);
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  border: none;
  padding: 0;
  margin: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  -webkit-tap-highlight-color: transparent;
}

.srt-test-item {
  display: block;
  height: auto;
  max-height: 100%;
  object-fit: contain;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 11px 12px rgba(79, 57, 20, 0.24));
  animation: srt-test-item-pop 0.18s ease-out;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.srt-item-hitbox:hover .srt-test-item {
  transform: scale(1.04);
  filter: drop-shadow(0 13px 15px rgba(79, 57, 20, 0.28)) brightness(1.06);
}

.srt-item-hitbox:active .srt-test-item {
  transform: scale(0.94);
}

@keyframes srt-test-item-pop {
  from { transform: scale(0.72); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.srt-mouse-in-play {
  transform: translate(14%, 6%);
  z-index: 7;
  width: clamp(54px, 5.4vw, 82px);
}

.srt-false-start-warning {
  position: absolute;
  left: 50%;
  top: 18%;
  transform: translate(-50%, -50%);
  z-index: 8;
  padding: 12px 20px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.88);
  background: rgba(233, 83, 63, 0.92);
  color: #fff8ed;
  font-size: clamp(18px, 2.4vw, 26px);
  font-weight: 900;
  letter-spacing: 0.03em;
  box-shadow: 0 10px 22px rgba(139, 43, 31, 0.22);
  pointer-events: none;
  animation: srt-false-start-pop 0.62s ease-out forwards;
}

@keyframes srt-false-start-pop {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.82); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
  78% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -54%) scale(0.96); }
}

.srt-test-effect {
  position: absolute;
  width: 78px;
  height: 78px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 5;
  border: 5px solid rgba(255, 236, 94, 0.92);
  background: rgba(255, 245, 158, 0.18);
  box-shadow: 0 0 22px rgba(255, 204, 48, 0.55);
  animation: srt-test-effect-pop 0.42s ease-out forwards;
}

@keyframes srt-test-effect-pop {
  from { transform: translate(-50%, -50%) scale(0.7); opacity: 0.95; }
  to { transform: translate(-50%, -50%) scale(1.45); opacity: 0; }
}


.srt-assist-glow {
  animation: srt-assist-glow 0.92s ease-in-out infinite;
}

@keyframes srt-assist-glow {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 11px 12px rgba(79, 57, 20, 0.24)) drop-shadow(0 0 0 rgba(255, 226, 87, 0));
  }
  50% {
    transform: scale(1.08);
    filter: drop-shadow(0 11px 12px rgba(79, 57, 20, 0.24)) drop-shadow(0 0 22px rgba(255, 226, 87, 0.82));
  }
}

.srt-assist-shake {
  animation: srt-assist-shake 0.58s ease-in-out 1;
}

@keyframes srt-assist-shake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-5px) rotate(-4deg); }
  40% { transform: translateX(5px) rotate(4deg); }
  60% { transform: translateX(-3px) rotate(-2deg); }
  80% { transform: translateX(3px) rotate(2deg); }
}

.srt-idle-flash::after {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 32px;
  pointer-events: none;
  z-index: 4;
  box-shadow: inset 0 0 38px rgba(255, 230, 120, 0.62);
  animation: srt-idle-flash 0.9s ease-out forwards;
}

@keyframes srt-idle-flash {
  0% { opacity: 0; }
  35% { opacity: 1; }
  100% { opacity: 0; }
}


.srt-result-panel {
  min-height: 500px;
  padding: 92px 56px 60px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 52px;
}

.srt-result-panel::before {
  inset: 18px;
}

.srt-cute-stars {
  position: absolute;
  top: -78px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  z-index: 3;
}

.srt-cute-star {
  font-size: clamp(82px, 8vw, 116px);
  line-height: 0.9;
  color: #c2cfc9;
  opacity: 0.6;
  -webkit-text-stroke: 7px rgba(255,255,255,0.96);
  text-shadow:
    0 5px 0 rgba(85, 111, 84, 0.20),
    0 10px 16px rgba(72, 58, 32, 0.16);
  display: inline-block;
  transform: rotate(-8deg);
}

.srt-cute-star:nth-child(2) {
  transform: translateY(-12px) rotate(2deg) scale(1.15);
}

.srt-cute-star:nth-child(3) {
  transform: rotate(7deg);
}

.srt-cute-star.is-on {
  color: #ffd53d;
  opacity: 1;
  -webkit-text-stroke: 7px rgba(255,255,255,0.98);
  text-shadow:
    0 4px 0 #e39d19,
    0 8px 16px rgba(121, 74, 6, 0.30),
    0 0 18px rgba(255, 249, 171, 0.95);
}

.srt-result-content {
  width: min(100%, 720px);
}

.srt-result-icon {
  width: 170px;
  height: 170px;
  padding: 13px;
}


.srt-result-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
  width: 100%;
}

.srt-result-actions .srt-forest-button {
  min-width: 188px;
  min-height: 70px;
  font-size: clamp(22px, 2.2vw, 30px);
  border-radius: 20px;
}

.srt-result-actions .srt-image-button {
  min-width: 0;
  min-height: 0;
  width: clamp(168px, 16vw, 232px);
  border-radius: 18px;
}

@media (max-width: 1024px) {
  .srt-start-shell,
  .srt-result-shell {
    width: min(86vw, 920px);
  }

  .srt-soft-panel {
    border-radius: 50px;
  }

  .srt-start-panel,
  .srt-result-panel {
    padding-left: 44px;
    padding-right: 44px;
  }

  .srt-video-panel,
  .srt-tutorial-panel {
    padding: 42px 48px 30px;
  }
}

@media (max-width: 768px) {
  .srt-training-page {
    overflow-y: auto;
  }

  .srt-center-shell,
  .srt-start-shell,
  .srt-result-shell {
    width: 92vw;
    min-height: 100svh;
    padding: 42px 0 28px;
  }

  .srt-soft-panel {
    border-width: 6px;
    border-radius: 38px;
  }

  .srt-soft-panel::before {
    inset: 12px;
    border-radius: 28px;
  }

  .srt-start-panel {
    min-height: 540px;
    padding: 44px 22px 40px;
    gap: 28px;
  }

  .srt-game-title {
    font-size: 30px;
    padding: 12px 24px;
  }

  .srt-game-title::before,
  .srt-game-title::after {
    display: none;
  }

  .srt-start-content,
  .srt-result-content {
    grid-template-columns: 1fr;
    gap: 22px;
    justify-items: center;
  }

  .srt-dialog-bubble {
    width: 100%;
    min-height: 120px;
  }

  .srt-dialog-bubble::after {
    display: none;
  }

  .srt-round-icon,
  .srt-result-icon {
    width: 138px;
    height: 138px;
    padding: 10px;
  }

  .srt-video-panel,
  .srt-tutorial-panel {
    min-height: 560px;
    padding: 34px 26px 24px;
  }

  .srt-video-frame,
  .srt-tutorial-scene {
    height: 48vh;
    min-height: 320px;
  }

  .srt-tutorial-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    row-gap: 14px;
  }

  .srt-avatar-guide {
    width: 112px;
    height: 112px;
  }

  .srt-rule-steps {
    min-height: 130px;
    grid-template-rows: auto 24px auto;
  }

  .srt-guide-bubble,
  .srt-tap-hint {
    font-size: 20px;
    padding: 10px 16px;
  }

  .srt-guide-arrow {
    width: 150px;
  }

  .srt-practice-acorn {
    width: 92px;
    height: 92px;
  }

  .srt-tutorial-practice {
    min-height: 130px;
  }

  .srt-result-panel {
    min-height: 520px;
    padding: 84px 22px 40px;
    gap: 38px;
  }

  .srt-cute-stars {
    top: -54px;
    gap: 8px;
  }


  .srt-result-actions {
    gap: 16px;
  }

  .srt-result-actions .srt-forest-button {
    min-width: min(100%, 220px);
    min-height: 64px;
  }
}

@media (max-width: 480px) {
  .srt-center-shell,
  .srt-start-shell,
  .srt-result-shell {
    width: 94vw;
  }

  .srt-soft-panel {
    border-width: 5px;
    border-radius: 30px;
  }

  .srt-start-panel {
    padding: 34px 16px 30px;
  }

  .srt-game-title {
    font-size: 25px;
    padding: 10px 18px;
    min-width: auto;
  }

  .srt-dialog-bubble {
    padding: 18px 16px;
    font-size: 24px;
  }

  .srt-round-icon,
  .srt-result-icon {
    width: 114px;
    height: 114px;
    padding: 9px;
  }

  .srt-forest-button {
    min-width: 150px;
    min-height: 60px;
    padding: 10px 22px;
    font-size: 24px;
  }

  .srt-video-panel,
  .srt-tutorial-panel {
    min-height: 500px;
    padding: 26px 16px 22px;
  }

  .srt-video-frame,
  .srt-tutorial-scene {
    height: 44vh;
    min-height: 270px;
  }

  .srt-avatar-guide {
    width: 86px;
    height: 86px;
  }

  .srt-guide-bubble,
  .srt-tap-hint {
    font-size: 17px;
  }

  .srt-practice-acorn {
    width: 76px;
    height: 76px;
  }

  .srt-test-item {
    max-width: 96px;
  }
}
@media (max-width: 720px) {
  .srt-image-button,
  .srt-result-actions .srt-image-button {
    min-width: 0;
    min-height: 0;
    width: min(72vw, 206px);
    padding: 0;
  }

  .srt-btn-skip.srt-image-button,
  .srt-btn-next.srt-image-button {
    width: min(74vw, 214px);
  }

  .srt-mouse-guide {
    width: 52px;
  }

  .srt-mouse-on-button {
    right: -10px;
    bottom: -14px;
  }
}



/* Training-only additions, still following TestPage_SRT art direction */
.srt-stage-pill {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 999px;
  border: 3px solid rgba(233, 163, 60, 0.72);
  background: rgba(255, 248, 220, 0.92);
  color: #7a3f16;
  font-size: clamp(16px, 1.8vw, 22px);
  font-weight: 900;
  box-shadow: 0 6px 14px rgba(91, 57, 18, 0.10), inset 0 0 0 4px rgba(255,255,255,0.35);
}

.srt-stage-pill b {
  color: #4f8c2a;
  font-size: 1.16em;
}

.srt-training-warmup-scene {
  cursor: pointer;
}

.srt-warmup-grid .srt-practice-acorn {
  position: relative;
  z-index: 4;
}

.srt-hint-bubble {
  position: fixed;
  top: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 12;
  width: fit-content;
  max-width: min(82vw, 760px);
  border: 4px solid #f0c77b;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
  color: #6d3717;
  padding: 13px 28px;
  font-size: clamp(20px, 2.4vw, 30px);
  line-height: 1.25;
  font-weight: 950;
  box-shadow: 0 8px 0 rgba(225, 169, 84, 0.12), 0 14px 24px rgba(91, 57, 18, 0.14), inset 0 0 0 5px rgba(255, 235, 174, 0.35);
  pointer-events: none;
  animation: srt-hint-pop 0.25s ease-out;
}

@keyframes srt-hint-pop {
  from { opacity: 0; transform: translate(-50%, -8px) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

.srt-score-effect {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 950;
  pointer-events: none;
  z-index: 7;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(255,255,255,0.82);
  border: 3px solid rgba(255,255,255,0.9);
  text-shadow: 0 3px 8px rgba(255, 255, 255, 0.9);
  animation: srt-float-score 0.72s ease-out forwards;
  white-space: nowrap;
}

.srt-score-effect-correct { color: #438f2d; }
.srt-score-effect-penalty { color: #d34b35; }

.srt-game-item-hard {
  filter: drop-shadow(0 8px 10px rgba(79, 57, 20, 0.25)) brightness(1.02);
}

@keyframes srt-float-score {
  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  to { opacity: 0; transform: translate(-50%, -100%) scale(1.22); }
}
`;
