<<<<<<< HEAD
// src/pages/TrainingPage_SRT.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import bgImg from "../asset/SRT_testbackground.png";
import levelIcon from "../asset/SRT_icon.png";
import startAvatar from "../asset/avatar/bear.png";
import tutorialAvatar from "../asset/avatar/chicken.png";
import introVideo from "../asset/SRT_start.mp4";
import endingVideo from "../asset/SRT_start.mp4";
import clickSoundFile from "../asset/Click_SRT.mp3";
import homeStartBtn from "../asset/home/start.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";

import ResultPage_SRT from "./ResultPage_SRT";

import { createGameResult } from "../ai/gameResultTemplate";
import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";

/*
  =========================================================
  TrainingPage_SRT.jsx
  SRT 反應力訓練頁

  更新重點：
  1. 改為地圖關卡制：從 GameMenuPage 帶入 level / stageId
  2. 移除「簡單 / 普通 / 困難」兒童選擇畫面
  3. 依照 SRT 測驗結果自動安排每關難度，內部使用 1～9 階細緻難度
  4. 若尚未測驗，使用預設漸進式關卡難度，仍維持後面較難
  5. 訓練中不顯示星級、進度條、分數條或即時分數
  6. 完成訓練後把星級寫入 GameMenuPage 會讀取的 localStorage key
  7. 訓練不寫入 srtTestResult，避免覆蓋正式測驗資料
  =========================================================
*/


const GAME_ID = "srt";
const COMPLETED_LEVELS_STORAGE_KEY = "ef_game_completed_training_levels";

const safeParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const clampNumber = (value, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
};

const clampStars = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(3, Math.max(1, Math.round(number)));
};

const getTodayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
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
    storyLabel: "森林散步 1",
    subtitle: "橡實最大、停留最久，先建立成功感。",
    totalTime: 60000,
    visibleTime: 6000,
    nextDelay: 480,
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
    storyLabel: "森林散步 2",
    subtitle: "偶爾出現金色橡實，增加正向驚喜。",
    totalTime: 60000,
    visibleTime: 5800,
    nextDelay: 430,
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
    storyLabel: "森林散步 3",
    subtitle: "加入少量壞橡實，提醒孩子先看清楚。",
    totalTime: 60000,
    visibleTime: 5600,
    nextDelay: 390,
    itemSize: 130,
    normalRate: 0.87,
    goldenRate: 0.08,
    rottenRate: 0.05,
  },

  "medium-1": {
    key: "medium-1",
    step: 4,
    displayKey: "medium",
    label: "普通",
    storyLabel: "橡實小任務 1",
    subtitle: "開始訓練看到壞橡實時忍住不點。",
    totalTime: 60000,
    visibleTime: 5300,
    nextDelay: 360,
    itemSize: 122,
    normalRate: 0.82,
    goldenRate: 0.1,
    rottenRate: 0.08,
  },

  "medium-2": {
    key: "medium-2",
    step: 5,
    displayKey: "medium",
    label: "普通",
    storyLabel: "橡實小任務 2",
    subtitle: "金色橡實與壞橡實穩定出現，練習辨識與抑制。",
    totalTime: 60000,
    visibleTime: 5000,
    nextDelay: 330,
    itemSize: 116,
    normalRate: 0.76,
    goldenRate: 0.12,
    rottenRate: 0.12,
  },

  "medium-3": {
    key: "medium-3",
    step: 6,
    displayKey: "medium",
    label: "普通",
    storyLabel: "橡實小任務 3",
    subtitle: "速度稍快、干擾稍多，但仍保留主要目標。",
    totalTime: 60000,
    visibleTime: 4700,
    nextDelay: 300,
    itemSize: 108,
    normalRate: 0.7,
    goldenRate: 0.14,
    rottenRate: 0.16,
  },

  "hard-1": {
    key: "hard-1",
    step: 7,
    displayKey: "hard",
    label: "困難",
    storyLabel: "森林大挑戰 1",
    subtitle: "進入困難階段，壞橡實比例提高。",
    totalTime: 60000,
    visibleTime: 4500,
    nextDelay: 270,
    itemSize: 102,
    normalRate: 0.67,
    goldenRate: 0.15,
    rottenRate: 0.18,
  },

  "hard-2": {
    key: "hard-2",
    step: 8,
    displayKey: "hard",
    label: "困難",
    storyLabel: "森林大挑戰 2",
    subtitle: "橡實更小、出現更快，需要更穩定的抑制控制。",
    totalTime: 60000,
    visibleTime: 4300,
    nextDelay: 230,
    itemSize: 94,
    normalRate: 0.62,
    goldenRate: 0.16,
    rottenRate: 0.22,
  },

  "hard-3": {
    key: "hard-3",
    step: 9,
    displayKey: "hard",
    label: "困難",
    storyLabel: "森林大挑戰 3",
    subtitle: "最高挑戰，干擾提高但壞橡實仍控制在 25%。",
    totalTime: 60000,
    visibleTime: 4100,
    nextDelay: 200,
    itemSize: 88,
    normalRate: 0.59,
    goldenRate: 0.16,
    rottenRate: 0.25,
  },
};

const objectTypes = {
  normal: {
    key: "normal",
    score: 3,
    label: "普通橡實",
    hint: "接到一顆橡實！小松鼠很開心！",
    shouldClick: true,
  },

  golden: {
    key: "golden",
    score: 5,
    label: "金色橡實",
    hint: "哇！金色橡實！小松鼠得到大大的能量！",
    shouldClick: true,
  },

  rotten: {
    key: "rotten",
    score: -1,
    label: "壞掉橡實",
    hint: "這顆壞掉了，下次要幫小松鼠避開喔！",
    shouldClick: false,
  },
};


const SrtCssAcorn = ({ typeKey = "normal", className = "", ariaHidden = true, style }) => {
  const safeType = ["normal", "golden", "rotten"].includes(typeKey) ? typeKey : "normal";

  return (
    <span
      className={`srt-css-acorn srt-css-acorn-${safeType} ${className}`}
      aria-hidden={ariaHidden ? "true" : undefined}
      style={style}
    >
      <span className="srt-acorn-aura" />
      <span className="srt-acorn-sparkle srt-acorn-sparkle-1" />
      <span className="srt-acorn-sparkle srt-acorn-sparkle-2" />
      <span className="srt-acorn-sparkle srt-acorn-sparkle-3" />
      <span className="srt-acorn-gas srt-acorn-gas-1" />
      <span className="srt-acorn-gas srt-acorn-gas-2" />
      <span className="srt-acorn-alert srt-acorn-alert-1">!</span>
      <span className="srt-acorn-alert srt-acorn-alert-2">!</span>
      <span className="srt-acorn-cap" />
      <span className="srt-acorn-body">
        <span className="srt-acorn-crack srt-acorn-crack-1" />
        <span className="srt-acorn-crack srt-acorn-crack-2" />
      </span>
    </span>
  );
};

const idlePrompts = [
  "等橡實出現再點！",
  "看到好橡實就點！",
  "壞橡實不要點！",
=======
import bgImg from "../asset/SRT_testbackground.jpg";
import React, { useEffect, useRef, useState } from "react";
import normalImg from "../asset/acorn.png";
import goldenImg from "../asset/golden_acorn.png";
import rottenImg from "../asset/rotten_acorn.png";
import introVideo from "../asset/SRT_start.mp4";
import clickSoundFile from "../asset/Click_SRT.mp3";
import ResultPage_SRT from "./ResultPage_SRT";
import { useNavigate } from "react-router-dom";

// ===== 訓練模式固定總時長 =====
const TOTAL_TIME = 10000; // 10秒

// ===== 難度設定 =====
const difficultySettings = {
  easy: {
    label: "簡單",
    spawnInterval: 1600,
    visibleTime: 1200,
    itemSize: 90,
  },
  medium: {
    label: "普通",
    spawnInterval: 1600, // 跟簡單一致
    visibleTime: 1200,
    itemSize: 120,
  },
  hard: {
    label: "困難",
    spawnInterval: 1100, // 更快
    visibleTime: 850,
    itemSize: 90,
  },
};

// ===== 物件種類 =====
const objectTypes = {
  normal: {
    key: "normal",
    img: normalImg,
    score: 3,
    label: "普通橡實",
  },
  golden: {
    key: "golden",
    img: goldenImg,
    score: 5,
    label: "金色橡實",
  },
  rotten: {
    key: "rotten",
    img: rottenImg,
    score: -2,
    label: "壞掉橡實",
  },
};

// ===== 提示文字池 =====
const idlePrompts = [
  "快看看畫面喔！",
  "小飛鼠在等你幫忙！",
  "橡實出現了，快點一下！",
  "再試試看，我們一起加油！",
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
];

const TrainingPage_SRT = () => {
  const navigate = useNavigate();
<<<<<<< HEAD
  const location = useLocation();

  const trainingStageInfo = useMemo(
    () => getTrainingStageInfo(location),
    [location]
  );

  const initialDifficulty = useMemo(
    () =>
      getAutoDifficultyForStage({
        level: trainingStageInfo.level,
        stageId: trainingStageInfo.stageId,
        todayKey: trainingStageInfo.todayKey,
      }),
    [trainingStageInfo.level, trainingStageInfo.stageId, trainingStageInfo.todayKey]
  );

  /*
    =========================================================
    1. 畫面流程
    =========================================================
  */

  const [phase, setPhase] = useState("start");
  // start | intro | warmup | playing | ending | result

  const phaseRef = useRef("start");

  const setGamePhase = (nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [timeLeft, setTimeLeft] = useState(0); // 只用於內部計時，不顯示給兒童

  const [item, setItem] = useState(null);
  const [effect, setEffect] = useState(null);
  const [comboBurst, setComboBurst] = useState(null);
  const [falseStartWarning, setFalseStartWarning] = useState(null);
  const [showMouseGuide, setShowMouseGuide] = useState(false);
  const [hintText, setHintText] = useState("小松鼠準備好接橡實囉！");
  const [showHint, setShowHint] = useState(false);
  const [showDetailedResult, setShowDetailedResult] = useState(false);

  /*
    =========================================================
    2. 暖身教學
    =========================================================
  */

  const [warmupStep, setWarmupStep] = useState(0);
  const [warmupItem, setWarmupItem] = useState(null);
  const [warmupMessage, setWarmupMessage] = useState(
    "先跟小松鼠一起練習一下。"
  );
  const [warmupReady, setWarmupReady] = useState(false);

  /*
    warmupStep:
    0 = 說明
    1 = 點普通橡實
    2 = 點金色橡實（普通 / 困難）
    3 = 避開壞掉橡實（普通 / 困難）
    4 = 完成
  */

  /*
    =========================================================
    3. 訓練資料
    =========================================================
  */

  const [score, setScore] = useState(0);
  const [trialRecords, setTrialRecords] = useState([]);
  const [falseClickCount, setFalseClickCount] = useState(0);
  const [repeatedClickCount, setRepeatedClickCount] = useState(0);

  const trialRecordsRef = useRef([]);
  const falseClickCountRef = useRef(0);
  const repeatedClickCountRef = useRef(0);
  const comboCountRef = useRef(0);

  /*
    =========================================================
    4. refs
    =========================================================
  */

  const difficultyRef = useRef(difficulty);
  const currentTrialRef = useRef(0);
  const spawnTimeRef = useRef(null);
  const currentItemRef = useRef(null);
  const trialLockedRef = useRef(false);
  const lastActionTimeRef = useRef(Date.now());

  const itemTimeoutRef = useRef(null);
  const nextTrialTimeoutRef = useRef(null);
  const gameTimerRef = useRef(null);
  const clockIntervalRef = useRef(null);
  const idleCheckRef = useRef(null);
  const hintTimeoutRef = useRef(null);
  const mouseGuideTimeoutRef = useRef(null);
  const lastGuidanceHintTimeRef = useRef(0);
  const effectTimeoutRef = useRef(null);
  const comboTimeoutRef = useRef(null);
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

  /*
    =========================================================
    5. 初始化與清除
    =========================================================
  */

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
    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
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
    effectTimeoutRef.current = null;
    comboTimeoutRef.current = null;
    falseStartWarningTimeoutRef.current = null;
    spawnAnimationFrameRef.current = null;
    warmupTimeoutRef.current = null;
  };

  const playClickSound = () => {
    if (!clickAudioRef.current) return;

=======

  const [difficulty, setDifficulty] = useState("medium");
  const [item, setItem] = useState(null);
  const [score, setScore] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnd, setIsEnd] = useState(false);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [showRulePage, setShowRulePage] = useState(false);
  const [isCountdown, setIsCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const [effect, setEffect] = useState(null);
  const [isClickable, setIsClickable] = useState(true);

  const [hintText, setHintText] = useState("準備好幫小飛鼠接橡實了嗎？");
  const [showHint, setShowHint] = useState(false);

  // ===== 訓練資料 =====
  const [trialRecords, setTrialRecords] = useState([]);
  const [rtRecords, setRtRecords] = useState([]);
  const [missCount, setMissCount] = useState(0);
  const [wrongClickCount, setWrongClickCount] = useState(0);
  const [totalSpawn, setTotalSpawn] = useState(0);

  const spawnTimeRef = useRef(null);
  const itemTimeoutRef = useRef(null);
  const spawnIntervalRef = useRef(null);
  const gameTimerRef = useRef(null);
  const idleCheckRef = useRef(null);
  const countdownRef = useRef(null);
  const lastActionTimeRef = useRef(Date.now());
  const currentTrialRef = useRef(0);

  const clickAudioRef = useRef(null);

  const config = difficultySettings[difficulty];

  // ===== 點擊音效初始化 =====
  useEffect(() => {
    clickAudioRef.current = new Audio(clickSoundFile);
    clickAudioRef.current.volume = 1.0;
  }, []);

  const playClickSound = () => {
    if (!clickAudioRef.current) return;
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
    clickAudioRef.current.currentTime = 0;
    clickAudioRef.current.play().catch(() => {});
  };

<<<<<<< HEAD
  const resetTraining = () => {
    clearAllTimers();

    setTimeLeft(0);
    setItem(null);
    setEffect(null);
    setComboBurst(null);
    setFalseStartWarning(null);
    setShowMouseGuide(false);
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
    comboCountRef.current = 0;

    currentTrialRef.current = 0;
    spawnTimeRef.current = null;
    currentItemRef.current = null;
    trialLockedRef.current = false;
    lastActionTimeRef.current = Date.now();
    lastGuidanceHintTimeRef.current = 0;
  };

  const addTrialRecord = (record) => {
    const nextRecords = [...trialRecordsRef.current, record];
    trialRecordsRef.current = nextRecords;
    setTrialRecords(nextRecords);
  };

  const getCurrentChildId = () => {
    try {
      const selectedChild = JSON.parse(localStorage.getItem("selectedChild") || "null");
      return selectedChild?.childId || selectedChild?.id || "unknown-child";
    } catch (error) {
      return "unknown-child";
    }
  };

  const getAverageRt = (records) => {
    const rts = records
      .filter((record) => record.isCorrect === true && typeof record.reactionTime === "number")
      .map((record) => record.reactionTime);

    if (rts.length === 0) return 0;
    return Math.round(rts.reduce((sum, rt) => sum + rt, 0) / rts.length);
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
    const clickedRottenCount = records.filter(
      (record) => record.trainingAction === "clickedRotten"
    ).length;

    const distractorMetrics = {
      goldenTotal,
      goldenHitCount,
      goldenHitRate: goldenTotal > 0 ? Math.round((goldenHitCount / goldenTotal) * 100) : null,
      rottenTotal,
      clickedRottenCount,
      rottenClickRate: rottenTotal > 0 ? Math.round((clickedRottenCount / rottenTotal) * 100) : null,
    };

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
      recommendedDifficulty,
      errorTypes,
      distractorMetrics,
      parentSummary: performanceResult.parentSummary,
    };
  };

  const saveTrainingStageProgress = (stars, resultPayload) => {
    const starCount = clampStars(stars);
    const { stageId, level, todayKey } = trainingStageInfo;
    const levelKey = `${GAME_ID}-${level}`;
    const todayLevelKey = `${todayKey}-${GAME_ID}-${level}`;

    localStorage.setItem(`ef_game_${stageId}_completed`, "true");
    localStorage.setItem(`ef_game_${stageId}_stars`, String(starCount));
    localStorage.setItem(`ef_game_${GAME_ID}_level_${level}_completed`, "true");
    localStorage.setItem(`ef_game_${GAME_ID}_level_${level}_stars`, String(starCount));
    localStorage.setItem(`training_${GAME_ID}_level_${level}_completed`, "true");
    localStorage.setItem(`training_${GAME_ID}_level_${level}_stars`, String(starCount));
    localStorage.setItem(`${GAME_ID}_training_level_${level}_completed`, "true");
    localStorage.setItem(`${GAME_ID}_training_level_${level}_stars`, String(starCount));

    appendUniqueStorageItems(COMPLETED_LEVELS_STORAGE_KEY, [stageId, levelKey, todayLevelKey]);

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
    ].forEach((key) => writeObjectStarMap(key, starEntries));
  };

  const showStoryHint = (text, duration = 1200) => {
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);

    setHintText(text);
    setShowHint(true);

    hintTimeoutRef.current = setTimeout(() => {
      setShowHint(false);
    }, duration);
  };

  const showGuidanceHint = (text, duration = 1000, cooldown = 3500) => {
    const now = Date.now();

    if (now - lastGuidanceHintTimeRef.current < cooldown) return;

    lastGuidanceHintTimeRef.current = now;
    showStoryHint(text, duration);
  };

  /*
    =========================================================
    6. 流程控制
    =========================================================
  */

  const handleStart = () => {
    resetTraining();
    setShowDetailedResult(false);
    setGamePhase("intro");
  };

  const startWarmup = () => {
    clearAllTimers();

    setGamePhase("warmup");
    setWarmupStep(0);
    setWarmupItem(null);
    setWarmupReady(false);
    setEffect(null);

    setWarmupMessage("先試試看！");

    warmupTimeoutRef.current = setTimeout(() => {
      spawnWarmupNormal();
    }, 1000);
  };

  const startCountdown = () => {
    /*
      新版幼兒介面不顯示數字倒數。
      暖身完成後直接進入正式訓練，避免倒數造成壓力。
    */
    startTraining();
  };

  const startTraining = () => {
    clearAllTimers();

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

    currentTrialRef.current = 0;
    spawnTimeRef.current = null;
    currentItemRef.current = null;
    trialLockedRef.current = false;
    lastActionTimeRef.current = Date.now();
    lastGuidanceHintTimeRef.current = 0;

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

      if (idleDuration >= 3600 && currentItem?.type?.shouldClick) {
        setShowMouseGuide(true);
      }
    }, 700);

    scheduleNextTrial(getRandomDelay(currentConfig));
  };

  const finishTraining = () => {
    if (phaseRef.current === "ending" || phaseRef.current === "result") return;

    clearAllTimers();

    setItem(null);
    setEffect(null);
    setFalseStartWarning(null);
    setShowMouseGuide(false);
    setShowHint(false);

    currentItemRef.current = null;
    spawnTimeRef.current = null;
    trialLockedRef.current = false;

    const records = trialRecordsRef.current;
    const aiAnalysis = buildSrtTrainingAiResult(
      records,
      falseClickCountRef.current,
      repeatedClickCountRef.current
    );

    const resultPayload = {
      taskName: "Simple Reaction Time",
      taskCode: "SRT",
      mode: "training",
      gameId: GAME_ID,
      stageId: trainingStageInfo.stageId,
      level: trainingStageInfo.level,
      trainingOrder: trainingStageInfo.order,
      trainingTotal: trainingStageInfo.total,
      todayKey: trainingStageInfo.todayKey,
      difficulty: difficultyRef.current,
      difficultyStep: getDifficultyStep(difficultyRef.current),
      displayDifficulty: getDisplayDifficultyKey(difficultyRef.current),
      records,
      aiAnalysis,
      generatedAt: new Date().toISOString(),
    };

    const finalStars =
      aiAnalysis.performanceResult?.stars ??
      aiAnalysis.gameResult?.stars ??
      aiAnalysis.gameResult?.scoreStars ??
      1;

    saveTrainingStageProgress(finalStars, resultPayload);
    localStorage.setItem("srtTrainingResult", JSON.stringify(resultPayload));
    localStorage.setItem("lastSrtTrainingResult", JSON.stringify(resultPayload));

    setGamePhase("ending");
  };

  const handleEndingVideoEnd = () => {
    clearAllTimers();
    setItem(null);
    setEffect(null);
    setFalseStartWarning(null);
    setShowMouseGuide(false);
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

  /*
    =========================================================
    7. 暖身教學邏輯
    =========================================================
  */

  const spawnWarmupNormal = () => {
    if (phaseRef.current !== "warmup") return;

    setWarmupStep(1);
    setWarmupReady(false);
    setWarmupMessage("點好橡實！");

    setWarmupItem({
      id: "warmup-normal",
      type: objectTypes.normal,
      x: 50,
      y: 55,
    });
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
        text: warmupItem.type.key === "golden" ? "+30" : "+10",
        type: warmupItem.type.key === "golden" ? "bonus" : "correct",
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
      text: "-50",
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

  /*
    =========================================================
    8. 產生正式訓練題目
    =========================================================
  */

  const getRandomPosition = () => {
    const minX = 18;
    const maxX = 82;
    const minY = 22;
    const maxY = 78;

    return {
      x: Math.random() * (maxX - minX) + minX,
      y: Math.random() * (maxY - minY) + minY,
    };
  };

  const getRandomDelay = (currentConfig = difficultySettings[difficultyRef.current] || difficultySettings["easy-1"]) => {
    const baseDelay = Number(currentConfig?.nextDelay) || 350;
    const minDelay = Math.max(160, Math.round(baseDelay * 0.75));
    const maxDelay = Math.max(minDelay + 80, Math.round(baseDelay * 1.45));
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

  const getRandomType = () => {
    const currentDifficulty = difficultyRef.current;
    const currentConfig = difficultySettings[currentDifficulty] || difficultySettings["easy-1"];
    const rand = Math.random();

    if (rand < currentConfig.normalRate) return objectTypes.normal;
    if (rand < currentConfig.normalRate + currentConfig.goldenRate) {
      return objectTypes.golden;
    }

    return objectTypes.rotten;
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

    const trialIndex = currentTrialRef.current + 1;
    currentTrialRef.current = trialIndex;

    const position = getRandomPosition();
    const type = getRandomType();

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

      if (type.shouldClick) {
        mouseGuideTimeoutRef.current = setTimeout(() => {
          if (phaseRef.current !== "playing") return;
          if (currentItemRef.current?.id !== newItem.id) return;
          if (trialLockedRef.current) return;
          setShowMouseGuide(true);
        }, 3400);
      }

      itemTimeoutRef.current = setTimeout(() => {
        handleTimeout(newItem);
      }, currentConfig.visibleTime);
    });
  };

  /*
    =========================================================
    9. 沒點到 / 時間到
    =========================================================
  */

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

    const currentDifficulty = difficultyRef.current;
    const currentConfig = difficultySettings[currentDifficulty] || difficultySettings["easy-1"];
    const isRotten = targetItem.type.key === "rotten";

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
        positionX: targetItem.x,
        positionY: targetItem.y,
        timestamp: Date.now(),
      });

      // 正確避開時不跳文字提示，避免每題干擾兒童。
    } else {
      comboCountRef.current = 0;
      setComboBurst(null);

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
        positionX: targetItem.x,
        positionY: targetItem.y,
        timestamp: Date.now(),
      });

      // 訓練中不額外跳提示，避免每一題都干擾孩子。
    }

    setItem(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;

    scheduleNextTrial(getRandomDelay(currentConfig));
  };

  /*
    =========================================================
    10. 點擊正式訓練物件
    =========================================================
  */

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
    setShowMouseGuide(false);
    playClickSound();

    lastActionTimeRef.current = Date.now();

    const reactionTime = Math.round(performance.now() - spawnTimeRef.current);

    const isRotten = targetItem.type.key === "rotten";
    const scoreValue = targetItem.type.score;

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
      positionX: targetItem.x,
      positionY: targetItem.y,
      timestamp: Date.now(),
    });

    const floatingScoreText = isRotten
      ? "-50"
      : targetItem.type.key === "golden"
        ? "+30"
        : "+10";

    if (isRotten) {
      comboCountRef.current = 0;
      setComboBurst(null);
    } else {
      comboCountRef.current += 1;

      if (comboCountRef.current >= 3) {
        setComboBurst({
          id: `${targetItem.id}-combo-${comboCountRef.current}`,
          x: targetItem.x,
          y: targetItem.y,
          count: comboCountRef.current,
        });

        if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
        comboTimeoutRef.current = setTimeout(() => {
          setComboBurst(null);
          comboTimeoutRef.current = null;
        }, 720);
      }
    }

    setEffect({
      x: targetItem.x,
      y: targetItem.y,
      text: floatingScoreText,
      type: isRotten ? "penalty" : targetItem.type.key === "golden" ? "bonus" : "correct",
    });

    setItem(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;

    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    effectTimeoutRef.current = setTimeout(() => {
      setEffect(null);
    }, 720);

    scheduleNextTrial(getRandomDelay(currentConfig));
  };

  /*
    =========================================================
    11. 點擊空白區
    =========================================================
  */

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

    setFalseStartWarning({
      id: now,
      text: currentItemRef.current ? "點橡實本身喔！" : "等橡實出現再點喔！",
    });

    if (falseStartWarningTimeoutRef.current) {
      clearTimeout(falseStartWarningTimeoutRef.current);
    }
    falseStartWarningTimeoutRef.current = setTimeout(() => {
      setFalseStartWarning(null);
      falseStartWarningTimeoutRef.current = null;
    }, 620);
  };

  /*
    =========================================================
    12. 統計資料
    =========================================================
  */

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
        positionX: null,
        positionY: null,
        timestamp: Date.now(),
      })
    );

    return [...trialRecords, ...extraFalseClickRecords];
  }, [trialRecords, falseClickCount]);

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
    return buildSrtTrainingAiResult(
      trialRecords,
      falseClickCount,
      repeatedClickCount
    );
  }, [trialRecords, falseClickCount, repeatedClickCount, score]);

  const summaryData = useMemo(() => {
    const hitCount = resultRecords.filter(
      (record) => record.trainingAction === "hit"
    ).length;

    const correctAvoidCount = resultRecords.filter(
      (record) => record.trainingAction === "correctAvoid"
    ).length;

    const clickedRottenCount = resultRecords.filter(
      (record) => record.trainingAction === "clickedRotten"
    ).length;

    const backgroundClickCount = resultRecords.filter(
      (record) => record.trainingAction === "backgroundClick"
    ).length;

    const validTrialCount = trialRecords.length;

    const accuracy =
      validTrialCount > 0
        ? Math.round(((hitCount + correctAvoidCount) / validTrialCount) * 100)
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
      correctAvoidCount,
      clickedRottenCount,
      falseClickCount: backgroundClickCount,
      repeatedClickCount,
      errorTypes: aiAnalysis.errorTypes,
      distractorMetrics: aiAnalysis.distractorMetrics,
      warningLevel: aiAnalysis.errorResult?.warningLevel,
      fatigueLevel: aiAnalysis.fatigueLevel,
      recommendedDifficulty: aiAnalysis.recommendedDifficulty,
      parentSummary: aiAnalysis.parentSummary,
      avgRT,
      accuracy,
    };
  }, [
    resultRecords,
    trialRecords.length,
    difficulty,
    config.label,
    config.storyLabel,
    score,
    missCount,
    repeatedClickCount,
    aiAnalysis,
    avgRT,
  ]);

  const resultStars = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem("srtTrainingResult") || "{}");
      const stars =
        data?.aiAnalysis?.performanceResult?.stars ??
        data?.aiAnalysis?.gameResult?.stars ??
        data?.aiAnalysis?.gameResult?.scoreStars ??
        summaryData?.aiAnalysis?.performanceResult?.stars ??
        1;
      return clampStars(stars);
    } catch (error) {
      return clampStars(aiAnalysis?.performanceResult?.stars ?? 1);
    }
  }, [phase, aiAnalysis, summaryData]);

  /*
    =========================================================
    13. 畫面
    =========================================================
  */

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
          <section className="srt-soft-panel srt-start-panel" aria-label="訓練開始畫面">
            <div className="srt-game-title">小松鼠的橡實練習</div>
            <div className="srt-start-content">
              <div className="srt-dialog-bubble srt-opening-bubble">
                幫小松鼠找橡實！
              </div>
              <div className="srt-round-icon srt-start-avatar">
                <img src={startAvatar} alt="小松鼠頭像" />
              </div>
            </div>
            <div className="srt-guided-action srt-guided-start">
              <button type="button" className="srt-forest-button srt-image-button srt-btn-start" onClick={handleStart} aria-label="進入遊戲">
                <img src={homeStartBtn} alt="進入遊戲" />
              </button>
              <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      )}

      {phase === "intro" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-video-panel" aria-label="前導動畫">
            <div className="srt-video-frame">
              <video
                src={introVideo}
                autoPlay
                playsInline
                controls={false}
                onEnded={startWarmup}
                className="srt-video"
              />
            </div>
            <div className="srt-guided-action srt-guided-skip">
              <button type="button" className="srt-forest-button srt-image-button srt-btn-skip" onClick={startWarmup} aria-label="跳過動畫">
                <img src={homeSkipBtn} alt="跳過動畫" />
              </button>
              <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
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
                  <img src={tutorialAvatar} alt="皮皮小助手" />
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
                      <SrtCssAcorn typeKey={warmupItem.type.key} ariaHidden={false} />
                    </button>
                  )}
                  {warmupItem && warmupItem.type.shouldClick && (
                    <img className="srt-mouse-guide srt-mouse-on-acorn" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
                  )}
                  <div className="srt-tap-hint">{warmupReady ? "很好！可以開始囉" : "先試試看"}</div>
                  {effect && (
                    <div
                      className={effect.text ? `srt-score-effect srt-score-effect-${effect.type || "correct"}` : "srt-test-effect srt-demo-effect"}
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
                <img src={homeStartBtn} alt="開始練習" />
              </button>
              {warmupReady && (
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
              )}
            </div>
          </section>
        </main>
      )}

      {phase === "playing" && (
        <main className="srt-play-page">
          <div className="srt-test-game-area" onClick={handleGameAreaClick}>
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
                <SrtCssAcorn
                  typeKey={item.type.key}
                  className={`srt-test-item ${getDisplayDifficultyKey(difficulty) === "hard" ? "srt-game-item-hard" : ""}`}
                  ariaHidden
                  style={{ width: `${config.itemSize}px`, height: `${config.itemSize}px` }}
                />
              </button>
            )}

            {item && showMouseGuide && item.type.shouldClick && (
              <img
                className="srt-mouse-guide srt-mouse-in-play"
                src={mouseGuideImg}
                alt="提示點擊"
                aria-hidden="true"
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
=======
  // ===== 單一物件隨機位置 =====
  const getRandomPosition = () => {
    const spread = 58;
    return {
      x: Math.random() * spread + (100 - spread) / 2,
      y: Math.random() * spread + (100 - spread) / 2,
    };
  };

  // ===== 重置 =====
  const resetGame = () => {
    setItem(null);
    setScore(0);
    setIsEnd(false);
    setEffect(null);
    setIsClickable(true);
    setIsPlaying(false);
    setIsIntroPlaying(false);
    setIsCountdown(false);
    setCountdown(5);

    setTrialRecords([]);
    setRtRecords([]);
    setMissCount(0);
    setWrongClickCount(0);
    setTotalSpawn(0);

    setHintText("準備好幫小飛鼠接橡實了嗎？");
    setShowHint(false);

    currentTrialRef.current = 0;
    lastActionTimeRef.current = Date.now();

    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
    if (gameTimerRef.current) clearTimeout(gameTimerRef.current);
    if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  // ===== 按開始：先進規則頁 =====
  const handleStart = () => {
    resetGame();
    setShowRulePage(true);
  };

  // ===== 規則頁按「知道了！」後播放影片 =====
  const handleRuleConfirm = () => {
    setShowRulePage(false);
    setIsIntroPlaying(true);
  };

  // ===== 影片結束後倒數 =====
  const startCountdown = () => {
    setIsIntroPlaying(false);
    setIsCountdown(true);
    setCountdown(5);

    let count = 5;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);

      if (count <= 0) {
        clearInterval(countdownRef.current);
        setIsCountdown(false);
        startTraining();
      }
    }, 1000);
  };

  // ===== 真正開始訓練 =====
  const startTraining = () => {
    setIsPlaying(true);
    setHintText("看到橡實就趕快點一下！");
    setShowHint(true);

    setTimeout(() => setShowHint(false), 1800);

    gameTimerRef.current = setTimeout(() => {
      setIsPlaying(false);
      setIsEnd(true);
    }, TOTAL_TIME);
  };

  // ===== 檢查孩子是否停太久 =====
  useEffect(() => {
    if (!isPlaying) return;

    idleCheckRef.current = setInterval(() => {
      const now = Date.now();
      const idleDuration = now - lastActionTimeRef.current;

      if (idleDuration >= 4000) {
        const randomPrompt =
          idlePrompts[Math.floor(Math.random() * idlePrompts.length)];
        setHintText(randomPrompt);
        setShowHint(true);

        setTimeout(() => {
          setShowHint(false);
        }, 1800);

        lastActionTimeRef.current = Date.now();
      }
    }, 1000);

    return () => {
      if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    };
  }, [isPlaying]);

  // ===== 固定節奏生成（每次只出現一顆）=====
  useEffect(() => {
    if (!isPlaying) return;

    const runSpawn = () => {
      setIsClickable(true);

      // 清掉上一輪 timeout
      if (itemTimeoutRef.current) {
        clearTimeout(itemTimeoutRef.current);
      }

      const pos = getRandomPosition();
      const id = Date.now();
      const trialNumber = currentTrialRef.current + 1;
      currentTrialRef.current = trialNumber;

      spawnTimeRef.current = performance.now();

      // ===== 主目標類型 =====
      let mainType = objectTypes.normal;

      // 簡單：只有普通
      // 普通 / 困難：加入金色與壞掉，但金色降低機率
      if (difficulty === "medium" || difficulty === "hard") {
        const rand = Math.random();

        if (rand < 0.75) {
          mainType = objectTypes.normal;
        } else if (rand < 0.85) {
          mainType = objectTypes.golden; // ⭐ 10%
        } else {
          mainType = objectTypes.rotten; // 15%
        }
      }

      setItem({
        x: pos.x,
        y: pos.y,
        id,
        trial: trialNumber,
        type: mainType,
      });

      setTotalSpawn((prev) => prev + 1);

      // 時間到自動消失（沒點就算 miss）
      itemTimeoutRef.current = setTimeout(() => {
        setItem((current) => {
          if (current && current.id === id) {
            setMissCount((prev) => prev + 1);

            setTrialRecords((prev) => [
              ...prev,
              {
                trial: trialNumber,
                hit: false,
                miss: true,
                wrongClick: false,
                reactionTime: null,
                positionX: pos.x,
                positionY: pos.y,
                itemType: mainType.key,
                scoreValue: mainType.score,
              },
            ]);

            return null;
          }
          return current;
        });
      }, config.visibleTime);
    };

    runSpawn();
    spawnIntervalRef.current = setInterval(runSpawn, config.spawnInterval);

    return () => {
      if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
      if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    };
  }, [isPlaying, difficulty, config.spawnInterval, config.visibleTime]);

  // ===== 點到主目標 =====
  const handleTargetClick = (x, y, id, trial, type) => {
    if (!item || item.id !== id) return;
    if (!isClickable) return;

    playClickSound();
    lastActionTimeRef.current = Date.now();
    setIsClickable(false);

    const clickTime = performance.now();
    const rt = Math.round(clickTime - spawnTimeRef.current);

    setRtRecords((prev) => [...prev, rt]);
    setScore((prev) => prev + type.score);

    setTrialRecords((prev) => [
      ...prev,
      {
        trial,
        hit: true,
        miss: false,
        wrongClick: false,
        reactionTime: rt,
        positionX: x,
        positionY: y,
        itemType: type.key,
        scoreValue: type.score,
      },
    ]);

    setEffect({
      x,
      y,
      type: type.score > 0 ? "correct" : "penalty",
      score: type.score,
    });

    if (type.key === "golden") {
      setHintText("金色橡實！+5");
    } else if (type.key === "rotten") {
      setHintText("哎呀！是壞掉的橡實！-2");
    } else {
      setHintText("普通橡實！+3");
    }

    setShowHint(true);

    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);

    setTimeout(() => {
      setItem(null);
    }, 80);

    setTimeout(() => setEffect(null), 700);
    setTimeout(() => setShowHint(false), 1000);
  };

  // ===== 統計資料 =====
  const avgRT =
    rtRecords.length > 0
      ? Math.round(rtRecords.reduce((a, b) => a + b, 0) / rtRecords.length)
      : 0;

  const stdRT =
    rtRecords.length > 1
      ? Math.round(
          Math.sqrt(
            rtRecords.reduce((sum, rt) => sum + Math.pow(rt - avgRT, 2), 0) /
              rtRecords.length
          )
        )
      : 0;

  const hitRate =
    totalSpawn > 0 ? Math.round((rtRecords.length / totalSpawn) * 100) : 0;

  const firstHalf = rtRecords.slice(0, Math.floor(rtRecords.length / 2));
  const secondHalf = rtRecords.slice(-Math.floor(rtRecords.length / 2));

  const firstHalfAvg =
    firstHalf.length > 0
      ? Math.round(firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length)
      : avgRT;

  const secondHalfAvg =
    secondHalf.length > 0
      ? Math.round(secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length)
      : avgRT;

  const reactionSpeed = Math.max(0, Math.min(100, 100 - (avgRT - 300) / 7));
  const responseAccuracy = hitRate;
  const responseConsistency = Math.max(0, Math.min(100, 100 - stdRT / 4));
  const sustainedAttention = Math.max(
    0,
    Math.min(100, 100 - (secondHalfAvg - firstHalfAvg) / 4)
  );

  const radarData = [
    { subject: "反應速度", value: Math.round(reactionSpeed) },
    { subject: "反應準確度", value: Math.round(responseAccuracy) },
    { subject: "反應穩定度", value: Math.round(responseConsistency) },
    { subject: "持續注意力", value: Math.round(sustainedAttention) },
  ];

  const summaryData = {
    avgRT,
    stdRT,
    hitRate,
    firstHalfAvg,
    secondHalfAvg,
    totalTrials: totalSpawn,
    hitCount: rtRecords.length,
    missCount,
    wrongClickCount,
    difficulty,
    finalScore: score,
  };

  return (
    <div style={styles.container}>
      {/* ===== 開始畫面 ===== */}
      {!isPlaying &&
        !isEnd &&
        !isIntroPlaying &&
        !showRulePage &&
        !isCountdown && (
          <div style={styles.startCard}>
            <h2 style={styles.title}>反應力訓練</h2>
            <p style={styles.subtitle}>幫小飛鼠接住掉下來的橡實！</p>

            <div style={styles.diffBox}>
              <p style={styles.diffTitle}>選擇訓練難度</p>
              <div style={styles.diffBtns}>
                {Object.keys(difficultySettings).map((level) => (
                  <button
                    key={level}
                    style={{
                      ...styles.diffBtn,
                      ...(difficulty === level ? styles.diffBtnActive : {}),
                    }}
                    onClick={() => setDifficulty(level)}
                  >
                    {difficultySettings[level].label}
                  </button>
                ))}
              </div>
            </div>

            <button style={styles.startBtn} onClick={handleStart}>
              開始訓練
            </button>
          </div>
        )}

      {/* ===== 規則頁 ===== */}
      {showRulePage && (
        <div style={styles.overlayCard}>
          <h2 style={styles.title}>遊戲規則</h2>

          <div style={styles.ruleContent}>
            <p>看到橡實就快點一下！</p>

            {difficulty === "easy" && (
              <>
                <p>普通橡實：+3 分</p>
                <p>專心看畫面，把橡實接住！</p>
              </>
            )}

            {(difficulty === "medium" || difficulty === "hard") && (
              <>
                <p>普通橡實：+3 分</p>
                <p>金色橡實：+5 分</p>
                <p>壞掉橡實：-2 分</p>
              </>
            )}

            {difficulty === "hard" && <p>這一關會更快喔！</p>}

            <p>準備好了就按下方按鈕開始！</p>
          </div>

          <button style={styles.startBtn} onClick={handleRuleConfirm}>
            知道了！
          </button>
        </div>
      )}

      {/* ===== Intro影片 ===== */}
      
      {isIntroPlaying && (
        <div style={styles.introPage}>
          <h1 style={styles.pageTitle}>幫小飛鼠弟弟接住掉落的橡實</h1>

          <div style={styles.introCard}>
            <h2 style={styles.introTitle}>準備開始囉！</h2>
            <p style={styles.introText}>請先看看遊戲小故事</p>

            <div style={styles.introVideoFrame}>
              <video
                src={introVideo}
                autoPlay
                controls={false}
                onEnded={startCountdown}
                style={styles.introVideo}
              />
            </div>

            <button style={styles.introSkipBtn} onClick={startCountdown}>
              跳過
            </button>
          </div>
        </div>
      )}

      {/* ===== 倒數頁 ===== */}
      {isCountdown && (
        <div style={styles.countdownWrapper}>
          <h2 style={styles.countdownTitle}>準備開始</h2>
          <div style={styles.countdownNumber}>{countdown}</div>
        </div>
      )}

      {/* ===== 遊戲中 ===== */}
      {isPlaying && (
        <>
          <div style={styles.topBar}>
            <h2 style={styles.score}>目前分數：{score}</h2>
            <p style={styles.modeText}>
              訓練難度：{difficultySettings[difficulty].label}
            </p>
          </div>

          {showHint && <div style={styles.hintBubble}>{hintText}</div>}

          <div style={styles.gameArea}>
            {item && (
              <img
                src={item.type.img}
                alt={item.type.label}
                style={{
                  ...styles.item,
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${config.itemSize}px`,
                }}
                onClick={() =>
                  handleTargetClick(
                    item.x,
                    item.y,
                    item.id,
                    item.trial,
                    item.type
                  )
                }
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
              />
            )}

            {effect && (
              <div
<<<<<<< HEAD
                className={
                  effect.text
                    ? `srt-score-effect srt-score-effect-${effect.type || "correct"}`
                    : "srt-test-effect"
                }
                style={{ left: `${effect.x}%`, top: `${effect.y}%` }}
              >
                {effect.text || ""}
              </div>
            )}

            {comboBurst && (
              <div
                key={comboBurst.id}
                className="srt-combo-burst"
                style={{ left: `${comboBurst.x}%`, top: `${comboBurst.y}%` }}
                role="status"
                aria-live="polite"
              >
                COMBO!
              </div>
            )}

            {falseStartWarning && (
              <div key={falseStartWarning.id} className="srt-false-start-warning" role="status" aria-live="polite">
                {falseStartWarning.text}
              </div>
            )}
          </div>
        </main>
      )}

      {phase === "ending" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-video-panel" aria-label="結束動畫">
            <div className="srt-video-frame">
              <video
                src={endingVideo}
                autoPlay
                playsInline
                controls={false}
                onEnded={handleEndingVideoEnd}
                className="srt-video"
              />
            </div>
            <div className="srt-guided-action srt-guided-skip">
              <button type="button" className="srt-forest-button srt-image-button srt-btn-skip" onClick={handleEndingVideoEnd} aria-label="跳過動畫">
                <img src={homeSkipBtn} alt="跳過動畫" />
              </button>
              <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      )}

      {phase === "result" && !showDetailedResult && (
        <main className="srt-center-shell srt-result-shell">
          <section className="srt-soft-panel srt-result-panel" aria-label="訓練結果">
            <div className="srt-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span key={star} className={`srt-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>
              ))}
            </div>

            <div className="srt-start-content srt-result-content">
              <div className="srt-dialog-bubble">你完成了！</div>
              <div className="srt-round-icon srt-result-icon">
                <img src={levelIcon} alt="SRT 圖示" />
              </div>
            </div>


            <div className="srt-result-actions">
              <div className="srt-guided-action srt-guided-result-main">
                <button type="button" className="srt-forest-button srt-image-button srt-btn-home" onClick={() => navigate("/game-menu")} aria-label="回到森林">
                  <img src={homeBackBtn} alt="回到森林" />
                </button>
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
              </div>
              <button type="button" className="srt-forest-button srt-image-button srt-btn-replay" onClick={handleStart} aria-label="再玩一次">
                <img src={homeAgainBtn} alt="再玩一次" />
              </button>
              <button type="button" className="srt-forest-button srt-image-button srt-btn-detail" onClick={() => setShowDetailedResult(true)} aria-label="詳細結果">
                <img src={homeResultBtn} alt="詳細結果" />
              </button>
            </div>
          </section>
        </main>
      )}

      {phase === "result" && showDetailedResult && (
=======
                style={{
                  ...styles.effect,
                  left: `${effect.x}%`,
                  top: `${effect.y}%`,
                  color:
                    effect.type === "correct"
                      ? "#4caf50"
                      : "#e53935",
                }}
              >
                {effect.score > 0 ? `+${effect.score}` : `${effect.score}`}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 結果頁 ===== */}
      {isEnd && (
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
        <ResultPage_SRT
          mode="training"
          score={score}
          avgRT={avgRT}
          rtRecords={rtRecords}
<<<<<<< HEAD
          trialRecords={resultRecords}
          totalSpawn={totalSpawn}
          missCount={missCount}
=======
          trialRecords={trialRecords}
          totalSpawn={totalSpawn}
          missCount={missCount}
          radarData={radarData}
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
          summaryData={summaryData}
          onRestart={handleStart}
          onBackToMenu={() => navigate("/game-menu")}
        />
      )}
    </div>
  );
};

export default TrainingPage_SRT;

<<<<<<< HEAD
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
.srt-btn-skip {
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
.srt-image-button.srt-btn-skip {
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

.srt-btn-skip.srt-image-button {
  width: clamp(198px, 19vw, 266px);
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
  height: 100%;
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


/* =========================================================
   Hyper-dynamic CSS-only training asset pack
   Forest claymorphism / no image assets for acorns or VFX
   ========================================================= */

.srt-soft-panel {
  border-color: rgba(255, 171, 31, 0.98);
  background:
    radial-gradient(circle at 16% 8%, rgba(255, 255, 255, 0.92) 0 9%, transparent 30%),
    radial-gradient(circle at 86% 16%, rgba(255, 231, 100, 0.56) 0 12%, transparent 34%),
    linear-gradient(145deg, rgba(255, 254, 222, 0.99) 0%, rgba(255, 231, 132, 0.98) 46%, rgba(244, 171, 64, 0.96) 100%);
  box-shadow:
    0 22px 0 rgba(150, 86, 25, 0.18),
    0 38px 66px rgba(58, 37, 12, 0.30),
    0 16px 26px rgba(255, 218, 95, 0.20),
    inset 0 13px 20px rgba(255, 255, 255, 0.76),
    inset 0 2px 0 rgba(255, 255, 255, 0.96),
    inset 0 -20px 28px rgba(137, 75, 18, 0.22),
    inset 0 -46px 76px rgba(106, 68, 17, 0.12);
}

.srt-soft-panel::before {
  border-color: rgba(255, 247, 205, 0.62);
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.54),
    inset 0 -4px 9px rgba(139, 84, 20, 0.14);
}

.srt-test-game-area::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 16% 20%, rgba(186, 255, 81, 0.13), transparent 18%),
    radial-gradient(circle at 82% 78%, rgba(255, 168, 36, 0.15), transparent 22%),
    radial-gradient(circle at 62% 36%, rgba(255, 224, 80, 0.09), transparent 18%);
  mix-blend-mode: screen;
}

.srt-css-acorn {
  --acorn-size: 100%;
  --cap-top: 11%;
  --cap-height: 36%;
  --body-top: 32%;
  position: relative;
  display: inline-block;
  width: var(--acorn-size);
  height: var(--acorn-size);
  min-width: 58px;
  min-height: 58px;
  isolation: isolate;
  transform-origin: 50% 68%;
  filter:
    drop-shadow(0 13px 11px rgba(48, 32, 12, 0.35))
    drop-shadow(0 3px 1px rgba(100, 62, 20, 0.16));
}

.srt-acorn-body,
.srt-acorn-cap,
.srt-acorn-aura,
.srt-acorn-sparkle,
.srt-acorn-gas,
.srt-acorn-alert,
.srt-acorn-crack {
  position: absolute;
  pointer-events: none;
}

.srt-acorn-aura {
  inset: -20%;
  border-radius: 50%;
  opacity: 0;
  z-index: 0;
}

.srt-acorn-body {
  left: 22%;
  top: var(--body-top);
  width: 56%;
  height: 58%;
  border-radius: 46% 46% 53% 53% / 48% 48% 60% 60%;
  z-index: 2;
  overflow: hidden;
  transform: rotate(-2deg);
}

.srt-acorn-body::before {
  content: "";
  position: absolute;
  inset: 7% 14% 46% 14%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.36);
  filter: blur(1px);
  transform: rotate(-18deg);
}

.srt-acorn-body::after {
  content: "";
  position: absolute;
  right: 7%;
  bottom: 4%;
  width: 34%;
  height: 46%;
  border-radius: 50%;
  background: rgba(77, 35, 13, 0.10);
  filter: blur(3px);
}

.srt-acorn-cap {
  left: 16%;
  top: var(--cap-top);
  width: 68%;
  height: var(--cap-height);
  border-radius: 48% 48% 42% 42% / 58% 58% 40% 40%;
  z-index: 3;
  transform: rotate(-4deg);
  overflow: hidden;
}

.srt-acorn-cap::before {
  content: "";
  position: absolute;
  left: 45%;
  top: -34%;
  width: 20%;
  height: 42%;
  border-radius: 999px;
  transform: rotate(18deg);
}

.srt-acorn-cap::after {
  content: "";
  position: absolute;
  inset: 16% 8% 42% 8%;
  border-radius: 999px;
  background:
    repeating-linear-gradient(135deg, rgba(255,255,255,0.28) 0 4px, rgba(255,255,255,0) 4px 10px);
  opacity: 0.72;
}

.srt-css-acorn-normal .srt-acorn-body {
  background:
    radial-gradient(circle at 31% 24%, rgba(255, 233, 151, 0.78) 0 12%, transparent 30%),
    linear-gradient(145deg, #d78a34 0%, #a85c25 54%, #6f3517 100%);
  box-shadow:
    inset 8px 8px 11px rgba(255, 204, 116, 0.32),
    inset -8px -12px 16px rgba(75, 31, 10, 0.28);
}

.srt-css-acorn-normal .srt-acorn-cap {
  background:
    radial-gradient(circle at 32% 18%, rgba(255, 226, 135, 0.58), transparent 35%),
    linear-gradient(145deg, #7d4a1e 0%, #5a3217 56%, #351a0b 100%);
  box-shadow:
    inset 5px 6px 8px rgba(255, 207, 116, 0.23),
    inset -6px -9px 13px rgba(34, 15, 5, 0.24);
}

.srt-css-acorn-normal .srt-acorn-cap::before {
  background: linear-gradient(180deg, #7b4b20, #3c1c0b);
}

.srt-css-acorn-golden {
  filter:
    drop-shadow(0 14px 12px rgba(55, 35, 8, 0.36))
    drop-shadow(0 0 16px rgba(255, 224, 76, 0.78))
    drop-shadow(0 0 36px rgba(255, 170, 28, 0.46));
  animation: srt-golden-acorn-pulse 1.05s ease-in-out infinite;
}

.srt-css-acorn-golden .srt-acorn-aura {
  opacity: 1;
  background:
    radial-gradient(circle, rgba(255, 250, 176, 0.46) 0 22%, rgba(255, 201, 42, 0.22) 38%, transparent 70%);
  filter: blur(1px);
  animation: srt-golden-aura-spin 2.6s linear infinite;
}

.srt-css-acorn-golden .srt-acorn-body {
  background:
    radial-gradient(circle at 29% 20%, #fff8c7 0 10%, transparent 28%),
    radial-gradient(circle at 72% 70%, rgba(215, 113, 8, 0.24), transparent 32%),
    linear-gradient(145deg, #fff27a 0%, #ffc328 43%, #e07c0f 100%);
  box-shadow:
    inset 9px 9px 12px rgba(255, 255, 255, 0.42),
    inset -8px -14px 18px rgba(145, 65, 0, 0.22);
}

.srt-css-acorn-golden .srt-acorn-cap {
  background:
    radial-gradient(circle at 28% 18%, #fffbd2 0 8%, transparent 28%),
    linear-gradient(145deg, #ffe66c 0%, #f6a91d 52%, #ba5c0b 100%);
  box-shadow:
    inset 7px 8px 10px rgba(255, 255, 255, 0.40),
    inset -8px -10px 15px rgba(125, 55, 0, 0.22);
}

.srt-css-acorn-golden .srt-acorn-cap::before {
  background: linear-gradient(180deg, #fff077, #bd650b);
}

.srt-css-acorn-golden .srt-acorn-sparkle {
  opacity: 1;
  z-index: 5;
  color: #fff9a8;
  width: 16%;
  height: 16%;
  filter: drop-shadow(0 0 8px rgba(255, 234, 96, 0.9));
}

.srt-css-acorn-golden .srt-acorn-sparkle::before,
.srt-css-acorn-golden .srt-acorn-sparkle::after {
  content: "";
  position: absolute;
  background: currentColor;
  border-radius: 999px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.srt-css-acorn-golden .srt-acorn-sparkle::before {
  width: 100%;
  height: 22%;
}

.srt-css-acorn-golden .srt-acorn-sparkle::after {
  width: 22%;
  height: 100%;
}

.srt-acorn-sparkle-1 { left: 5%; top: 8%; animation: srt-sparkle-twinkle 0.9s ease-in-out infinite; }
.srt-acorn-sparkle-2 { right: 1%; top: 30%; animation: srt-sparkle-twinkle 1.15s ease-in-out infinite 0.18s; }
.srt-acorn-sparkle-3 { left: 17%; bottom: 2%; animation: srt-sparkle-twinkle 1.25s ease-in-out infinite 0.36s; }

.srt-css-acorn-rotten {
  filter:
    drop-shadow(0 13px 10px rgba(43, 31, 45, 0.38))
    drop-shadow(0 0 18px rgba(122, 62, 170, 0.32));
}

.srt-css-acorn-rotten .srt-acorn-body {
  background:
    radial-gradient(circle at 28% 21%, rgba(255, 255, 255, 0.22) 0 9%, transparent 29%),
    radial-gradient(circle at 63% 66%, rgba(98, 214, 82, 0.22) 0 12%, transparent 30%),
    linear-gradient(145deg, #817087 0%, #625066 48%, #332637 100%);
  box-shadow:
    inset 8px 9px 12px rgba(255, 255, 255, 0.15),
    inset -9px -14px 17px rgba(21, 12, 25, 0.34);
}

.srt-css-acorn-rotten .srt-acorn-cap {
  background:
    radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 30%),
    linear-gradient(145deg, #706076 0%, #4d3b54 54%, #25192d 100%);
  box-shadow:
    inset 6px 7px 10px rgba(255, 255, 255, 0.12),
    inset -8px -10px 14px rgba(18, 10, 25, 0.32);
}

.srt-css-acorn-rotten .srt-acorn-cap::before {
  background: linear-gradient(180deg, #76617a, #281934);
}

.srt-css-acorn-rotten .srt-acorn-crack {
  z-index: 4;
  width: 4%;
  height: 42%;
  border-radius: 999px;
  background: #241527;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.08);
  transform-origin: top;
}

.srt-css-acorn-rotten .srt-acorn-crack-1 {
  left: 43%;
  top: 16%;
  transform: rotate(24deg);
}

.srt-css-acorn-rotten .srt-acorn-crack-2 {
  left: 57%;
  top: 39%;
  height: 25%;
  transform: rotate(-42deg);
}

.srt-css-acorn-rotten .srt-acorn-gas {
  opacity: 1;
  z-index: 1;
  width: 35%;
  height: 22%;
  border-radius: 50%;
  border: 3px solid rgba(187, 101, 255, 0.34);
  border-left-color: transparent;
  border-bottom-color: transparent;
  filter: blur(0.2px) drop-shadow(0 0 8px rgba(161, 75, 222, 0.38));
}

.srt-acorn-gas-1 {
  left: -14%;
  top: 28%;
  animation: srt-toxic-swirl 1.45s ease-in-out infinite;
}

.srt-acorn-gas-2 {
  right: -18%;
  top: 8%;
  animation: srt-toxic-swirl 1.75s ease-in-out infinite 0.22s reverse;
}

.srt-css-acorn-rotten .srt-acorn-alert {
  opacity: 1;
  z-index: 6;
  width: 22%;
  height: 22%;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #ff5d55, #9e1f49);
  color: #fff5dd;
  font-weight: 1000;
  font-size: 0.32em;
  text-shadow: 0 2px 0 rgba(70, 0, 18, 0.34);
  box-shadow:
    0 4px 0 rgba(85, 15, 42, 0.32),
    0 0 14px rgba(255, 42, 75, 0.45);
  animation: srt-alert-pop 0.86s ease-in-out infinite;
}

.srt-acorn-alert-1 { left: -8%; top: 0%; transform: rotate(-12deg); }
.srt-acorn-alert-2 { right: -11%; top: 40%; transform: rotate(12deg) scale(0.86); animation-delay: 0.2s; }

.srt-test-item {
  animation: srt-test-item-pop 0.28s cubic-bezier(0.19, 1.34, 0.32, 1) both;
  transition:
    transform 0.18s cubic-bezier(0.2, 1.25, 0.38, 1),
    filter 0.18s ease;
  will-change: transform, filter;
}

.srt-item-hitbox:hover .srt-test-item {
  transform: scale(1.08) rotate(-1.5deg);
}

.srt-item-hitbox:active .srt-test-item {
  transform: scale(0.9) rotate(1.5deg);
}

@keyframes srt-test-item-pop {
  0% { transform: scale(0.42) rotate(-7deg); opacity: 0; }
  68% { transform: scale(1.12) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.srt-test-effect {
  width: 86px;
  height: 86px;
  border: 0;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.92) 0 10%, rgba(255, 243, 128, 0.86) 11% 24%, rgba(255, 191, 44, 0.40) 25% 47%, rgba(255, 156, 20, 0.00) 70%),
    conic-gradient(from 14deg, rgba(255,255,255,0), rgba(255,247,153,0.78), rgba(255,184,28,0.18), rgba(255,255,255,0));
  box-shadow:
    0 0 0 7px rgba(255, 238, 123, 0.20),
    0 0 22px rgba(255, 218, 67, 0.86),
    0 0 48px rgba(255, 178, 28, 0.55),
    inset 0 0 18px rgba(255, 255, 255, 0.74);
  mix-blend-mode: screen;
  animation: srt-test-effect-pop 0.54s cubic-bezier(0.12, 1.55, 0.38, 1) forwards;
}

@keyframes srt-test-effect-pop {
  0% { transform: translate(-50%, -50%) scale(0.28); opacity: 0; filter: blur(0) saturate(1.05); }
  18% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; filter: blur(0) saturate(1.22); }
  52% { transform: translate(-50%, -50%) scale(1.62); opacity: 0.78; }
  100% { transform: translate(-50%, -50%) scale(2.15); opacity: 0; filter: blur(2px) saturate(1.15); }
}

.srt-score-effect {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: clamp(34px, 5.4vw, 74px);
  font-weight: 1000;
  line-height: 0.92;
  letter-spacing: 0.5px;
  -webkit-text-stroke: 3px #4b2510;
  text-shadow:
    0 4px 0 rgba(77, 32, 10, 0.42),
    0 11px 14px rgba(52, 26, 10, 0.28),
    0 0 18px rgba(255, 232, 118, 0.48);
  filter: drop-shadow(0 0 16px rgba(255, 210, 68, 0.44));
  animation: srt-float-score 0.74s cubic-bezier(0.14, 1.45, 0.3, 1) forwards;
}

.srt-score-effect-correct {
  color: #fff3a3;
  background: linear-gradient(180deg, #fff8b9 0%, #ffcf2f 44%, #ff8a1c 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

.srt-score-effect-bonus {
  color: #ffe752;
  background: linear-gradient(180deg, #ffffff 0%, #ffef65 30%, #ffb11c 62%, #ff6c19 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-stroke: 3px #5a2c0d;
  filter:
    drop-shadow(0 0 12px rgba(255, 244, 135, 0.82))
    drop-shadow(0 0 28px rgba(255, 176, 29, 0.56));
}

.srt-score-effect-penalty {
  color: #ff594e;
  background:
    linear-gradient(180deg, #ffddd3 0%, #ff5546 48%, #9d1635 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-stroke: 3px #5b0719;
  text-shadow:
    0 4px 0 rgba(94, 0, 22, 0.52),
    0 10px 14px rgba(51, 0, 17, 0.30);
  filter: drop-shadow(0 0 15px rgba(255, 49, 71, 0.42));
}

.srt-score-effect-penalty::before,
.srt-score-effect-penalty::after {
  content: "";
  position: absolute;
  width: 36%;
  height: 5px;
  left: 32%;
  top: 50%;
  border-radius: 999px;
  background: rgba(90, 7, 25, 0.78);
  transform: rotate(16deg);
}

.srt-score-effect-penalty::after {
  transform: rotate(-15deg);
}

.srt-combo-burst {
  position: absolute;
  z-index: 9;
  transform: translate(-50%, -108%);
  pointer-events: none;
  font-size: clamp(36px, 7vw, 88px);
  font-weight: 1000;
  line-height: 0.9;
  letter-spacing: 1px;
  color: #ffb323;
  background: linear-gradient(180deg, #fff8c2 0%, #ffd42e 32%, #ff8922 74%, #f15b1a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-stroke: 5px #4b2510;
  text-shadow:
    0 5px 0 rgba(92, 38, 12, 0.52),
    0 13px 15px rgba(56, 27, 8, 0.30),
    0 0 20px rgba(255, 222, 91, 0.72);
  filter:
    drop-shadow(0 0 12px rgba(255, 238, 121, 0.62))
    drop-shadow(0 0 28px rgba(255, 128, 29, 0.38));
  animation: srt-combo-pop 0.72s cubic-bezier(0.16, 1.56, 0.34, 1) forwards;
  white-space: nowrap;
}

.srt-combo-burst::after {
  content: "";
  position: absolute;
  inset: -10% -12%;
  border-radius: 999px;
  background:
    radial-gradient(circle at 18% 28%, rgba(255,255,255,0.80), transparent 8%),
    radial-gradient(circle at 76% 18%, rgba(255,246,140,0.68), transparent 10%),
    linear-gradient(180deg, rgba(255,255,255,0.16), transparent 48%);
  z-index: -1;
  filter: blur(1px);
}

.srt-image-button {
  transform-origin: 50% 58%;
  transition:
    transform 0.2s cubic-bezier(0.18, 1.25, 0.38, 1),
    filter 0.2s ease;
  will-change: transform, filter;
}

.srt-image-button img {
  filter:
    drop-shadow(0 10px 8px rgba(74, 48, 16, 0.26))
    drop-shadow(0 0 14px rgba(255, 238, 150, 0.22));
  transition: filter 0.2s ease;
}

.srt-image-button:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.045);
  filter: brightness(1.06) saturate(1.05);
  animation:
    srt-button-breathe 1.15s ease-in-out infinite,
    srt-button-wobble 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.srt-image-button:hover:not(:disabled) img {
  filter:
    drop-shadow(0 14px 10px rgba(74, 48, 16, 0.30))
    drop-shadow(0 0 18px rgba(255, 238, 150, 0.38));
}

.srt-image-button:active:not(:disabled) {
  transform: translateY(2px) scale(0.965);
  animation: none;
}

@keyframes srt-golden-acorn-pulse {
  0%, 100% { transform: translateY(0) scale(1) rotate(-1deg); }
  50% { transform: translateY(-4px) scale(1.055) rotate(1deg); }
}

@keyframes srt-golden-aura-spin {
  from { transform: rotate(0deg) scale(1); }
  to { transform: rotate(360deg) scale(1.02); }
}

@keyframes srt-sparkle-twinkle {
  0%, 100% { transform: scale(0.62) rotate(0deg); opacity: 0.55; }
  50% { transform: scale(1.22) rotate(45deg); opacity: 1; }
}

@keyframes srt-toxic-swirl {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(0.86); opacity: 0.38; }
  50% { transform: translate(6px, -8px) rotate(28deg) scale(1.1); opacity: 0.72; }
}

@keyframes srt-alert-pop {
  0%, 100% { transform: translateY(0) scale(0.88) rotate(-8deg); }
  50% { transform: translateY(-4px) scale(1.08) rotate(5deg); }
}

@keyframes srt-combo-pop {
  0% { opacity: 0; transform: translate(-50%, -86%) scale(0.36) rotate(-8deg); }
  24% { opacity: 1; transform: translate(-50%, -112%) scale(1.16) rotate(3deg); }
  62% { opacity: 1; transform: translate(-50%, -124%) scale(1) rotate(-1deg); }
  100% { opacity: 0; transform: translate(-50%, -156%) scale(0.92) rotate(2deg); }
}

@keyframes srt-float-score {
  0% { opacity: 0; transform: translate(-50%, -42%) scale(0.42) rotate(-6deg); }
  18% { opacity: 1; transform: translate(-50%, -62%) scale(1.18) rotate(2deg); }
  58% { opacity: 1; transform: translate(-50%, -94%) scale(1.02) rotate(-1deg); }
  100% { opacity: 0; transform: translate(-50%, -142%) scale(0.9) rotate(3deg); }
}

@keyframes srt-button-wobble {
  0% { transform: translateY(-3px) scale(1.045) rotate(0deg); }
  18% { transform: translateY(-4px) scale(1.055) rotate(-2.6deg); }
  36% { transform: translateY(-3px) scale(1.05) rotate(2.1deg); }
  54% { transform: translateY(-4px) scale(1.052) rotate(-1.4deg); }
  72% { transform: translateY(-3px) scale(1.047) rotate(0.8deg); }
  100% { transform: translateY(-3px) scale(1.045) rotate(0deg); }
}

@keyframes srt-button-breathe {
  0%, 100% { transform: translateY(-3px) scale(1.045); }
  50% { transform: translateY(-5px) scale(1.065); }
}

@media (prefers-reduced-motion: reduce) {
  .srt-css-acorn,
  .srt-test-item,
  .srt-test-effect,
  .srt-score-effect,
  .srt-combo-burst,
  .srt-image-button,
  .srt-image-button:hover:not(:disabled) {
    animation-duration: 0.01ms;
    animation-iteration-count: 1;
    transition-duration: 0.01ms;
  }
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

  .srt-btn-skip.srt-image-button {
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
=======
const styles = {
  container: {
    minHeight: "100vh",
    textAlign: "center",
    paddingTop: "20px",
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)),
      url(${bgImg})
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  },

  startCard: {
    margin: "80px auto",
    width: "90%",
    maxWidth: "580px",
    background: "white",
    borderRadius: "24px",
    padding: "40px 30px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
  },

  overlayCard: {
    margin: "100px auto",
    width: "90%",
    maxWidth: "600px",
    background: "white",
    borderRadius: "24px",
    padding: "45px 35px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
  },

  title: {
    fontSize: "38px",
    color: "#5d4037",
    marginBottom: "18px",
  },

  subtitle: {
    fontSize: "22px",
    color: "#6d4c41",
    marginBottom: "24px",
  },

  ruleContent: {
    fontSize: "24px",
    lineHeight: "2",
    color: "#6d4c41",
    marginBottom: "25px",
  },

  diffBox: {
    background: "#fff7ef",
    borderRadius: "18px",
    padding: "20px",
    marginBottom: "28px",
  },

  diffTitle: {
    fontSize: "20px",
    color: "#6d4c41",
    marginBottom: "15px",
    fontWeight: "bold",
  },

  diffBtns: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  diffBtn: {
    padding: "12px 20px",
    fontSize: "18px",
    borderRadius: "14px",
    border: "2px solid #ffcc9c",
    background: "white",
    color: "#8d6e63",
    cursor: "pointer",
    fontWeight: "bold",
  },

  diffBtnActive: {
    background: "#ffb26b",
    color: "white",
    border: "2px solid #ff8c42",
  },

  startBtn: {
    padding: "15px 32px",
    fontSize: "22px",
    borderRadius: "16px",
    border: "none",
    backgroundColor: "#ff8c42",
    color: "white",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
  },

  topBar: {
    marginTop: "15px",
  },

  score: {
    fontSize: "30px",
    color: "#5d4037",
    marginBottom: "8px",
  },

  modeText: {
    fontSize: "18px",
    color: "#8d6e63",
  },

  hintBubble: {
    margin: "18px auto 0",
    width: "fit-content",
    maxWidth: "80%",
    background: "#fff3cd",
    color: "#7a5c00",
    padding: "14px 22px",
    borderRadius: "18px",
    fontSize: "22px",
    fontWeight: "bold",
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
  },

  gameArea: {
    position: "relative",
    width: "100%",
    height: "75vh",
  },

  item: {
    position: "absolute",
    cursor: "pointer",
    transform: "translate(-50%, -50%)",
    userSelect: "none",
    zIndex: 2,
  },

  effect: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    fontSize: "34px",
    fontWeight: "bold",
    pointerEvents: "none",
    zIndex: 3,
  },

  videoWrapper: {
    position: "relative",
    width: "100%",
    height: "100vh",
    background: "black",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
  },

  video: {
    width: "90%",
    maxWidth: "900px",
    borderRadius: "20px",
  },

  countdownWrapper: {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },

  countdownTitle: {
    fontSize: "42px",
    color: "#5d4037",
    marginBottom: "20px",
  },

  countdownNumber: {
    fontSize: "120px",
    fontWeight: "bold",
    color: "#ff8c42",
    textShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  introPage: {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingTop: "35px",
},

pageTitle: {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#5d4037",
  marginBottom: "28px",
  textShadow: "0 2px 6px rgba(255,255,255,0.4)",
},

introCard: {
  width: "88%",
  maxWidth: "980px",
  background: "#f7f1e8",
  borderRadius: "28px",
  padding: "38px 40px 28px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
},

introTitle: {
  fontSize: "26px",
  fontWeight: "bold",
  color: "#8b5e3c",
  marginBottom: "12px",
},

introText: {
  fontSize: "18px",
  color: "#7b6a58",
  marginBottom: "28px",
  fontWeight: "600",
},

introVideoFrame: {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: "24px",
},

introVideo: {
  width: "72%",
  maxWidth: "630px",
  borderRadius: "24px",
  objectFit: "cover",
  boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
},

introSkipBtn: {
  padding: "14px 34px",
  fontSize: "18px",
  fontWeight: "bold",
  borderRadius: "999px",
  border: "none",
  backgroundColor: "#9c7563",
  color: "white",
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
  transition: "0.2s ease",
},
};
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
