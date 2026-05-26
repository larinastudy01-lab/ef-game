<<<<<<< HEAD
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { createGameResult } from "../ai/gameResultTemplate";

=======
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
// ===== 圖片 =====
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

// ===== 背景 / 前導影片 / 結束影片 =====
import bgImage from "../asset/PM_testbackground.png";
import introVideo from "../asset/SRT_start.mp4";
import endingVideo from "../asset/SRT_start.mp4";
import homeStartBtn from "../asset/home/start.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";
=======

// ===== 音效 / 背景 / 前導影片 =====
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
// PM 需求：一個畫面最多放 8 張圖片，避免兒童需要滑動螢幕。
const LEVELS = [
  { level: 1, memoryCount: 2, showTime: 5, answerTime: 10, optionCount: 6 },
  { level: 2, memoryCount: 3, showTime: 4.5, answerTime: 10, optionCount: 6 },
  { level: 3, memoryCount: 4, showTime: 4, answerTime: 10, optionCount: 8 },
  { level: 4, memoryCount: 5, showTime: 3.5, answerTime: 10, optionCount: 8 },
  { level: 5, memoryCount: 6, showTime: 3.2, answerTime: 10, optionCount: 8 },
  { level: 6, memoryCount: 7, showTime: 3, answerTime: 10, optionCount: 8 },
  { level: 7, memoryCount: 8, showTime: 2.8, answerTime: 10, optionCount: 8 },
];

const DEFAULT_ERRORS = {
  miss: 0,
  randomClick: 0,
  wrongTarget: 0,
  repeatedClick: 0,
  timeout: 0,
  sequenceError: 0,
  ruleSwitchError: 0,
};

=======
// ===== 難度設定 =====
const LEVELS = [
  { level: 1, memoryCount: 2, showTime: 5 },
  { level: 2, memoryCount: 3, showTime: 4 },
  { level: 3, memoryCount: 4, showTime: 3 },
  { level: 4, memoryCount: 5, showTime: 3 },
  { level: 5, memoryCount: 6, showTime: 2.5 },
  { level: 6, memoryCount: 7, showTime: 2.5 },
  { level: 7, memoryCount: 8, showTime: 2 },
  { level: 8, memoryCount: 9, showTime: 2 },
  { level: 9, memoryCount: 10, showTime: 2 },
];

>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
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
<<<<<<< HEAD
  const sorted1 = [...arr1].sort().join(",");
  const sorted2 = [...arr2].sort().join(",");
  return sorted1 === sorted2;
}

function safeNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function safeNonNegative(value, fallback = 0) {
  return Math.max(0, safeNumber(value, fallback));
}

function getSafeElapsedTime(startTime) {
  if (!Number.isFinite(startTime)) return 0;
  return Math.max(0, Math.round(performance.now() - startTime));
}

function safeRecommendedDifficulty(payload) {
  try {
    return getRecommendedDifficulty({
      ...payload,
      accuracy: safeNonNegative(payload.accuracy, 0),
      avgReactionTime: safeNonNegative(payload.avgReactionTime, 0),
      fatigueLevel: safeNumber(payload.fatigueLevel, 0),
    });
  } catch (error) {
    console.warn("[TestPage_PM] getRecommendedDifficulty failed:", error);
    return "normal";
  }
}

function safeAnalyzeErrors(errorTypes) {
  try {
    return analyzeErrors(errorTypes);
  } catch (error) {
    console.warn("[TestPage_PM] analyzeErrors failed:", error);
    const totalErrors = Object.values(errorTypes).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );
    return {
      totalErrors,
      warningLevel: totalErrors >= 10 ? "red" : totalErrors >= 5 ? "orange" : "green",
    };
  }
}

function safeCreateGameResult(payload) {
  try {
    return createGameResult(payload);
  } catch (error) {
    console.warn("[TestPage_PM] createGameResult failed:", error);
    return {
      ...payload,
      createdAt: new Date().toISOString(),
    };
  }
=======
  return [...arr1].sort().join(",") === [...arr2].sort().join(",");
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
}

export default function TestPage_PM() {
  const navigate = useNavigate();

<<<<<<< HEAD
  const answerStartRef = useRef(null);
  const recordsRef = useRef([]);
  const tapLogsRef = useRef([]);
  const selectedIdsRef = useRef([]);
  const lastResultRef = useRef(null);
  const pendingResultRef = useRef(null);
  const hasSubmittedRef = useRef(false);
  const timeoutRef = useRef(null);
  const answerTimeoutRef = useRef(null);
  const answerStartFrameRef = useRef(null);
  const levelTransitionRef = useRef(null);

  const [phase, setPhase] = useState("rules");
  // rules -> tutorial -> introVideo -> memorize -> answer -> feedback -> endingVideo -> result
=======
  const audioRef = useRef(null);
  const answerStartRef = useRef(null);
  const lastResultRef = useRef(null);
  const recordsRef = useRef([]);
  const hasSubmittedRef = useRef(false);

  const [phase, setPhase] = useState("rules");
  // rules -> introVideo -> readyCountdown -> memorize -> answer -> feedback
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [currentMemorizeItems, setCurrentMemorizeItems] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

<<<<<<< HEAD
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");

  const currentLevel = LEVELS[currentLevelIndex];

  const selectedDifficulty = useMemo(() => {
    if (currentLevelIndex <= 1) return "easy";
    if (currentLevelIndex <= 4) return "normal";
    return "hard";
  }, [currentLevelIndex]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
      if (levelTransitionRef.current) clearTimeout(levelTransitionRef.current);
      if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
    };
  }, []);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
    if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);

    if (phase === "memorize" && currentLevel) {
      timeoutRef.current = setTimeout(() => {
        setPhase("answer");
      }, currentLevel.showTime * 1000);
    }

    if (phase === "answer" && currentLevel && !hasSubmittedRef.current) {
      answerStartRef.current = null;
      answerStartFrameRef.current = requestAnimationFrame(() => {
        answerStartRef.current = performance.now();
        answerTimeoutRef.current = setTimeout(() => {
          finalizeAnswer({
            isTimeout: true,
            forceSelectedIds: selectedIdsRef.current,
          });
        }, currentLevel.answerTime * 1000);
      });
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
      if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
    };
  }, [phase, currentLevel]);


  const resetRuntimeRefs = () => {
    if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
    if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
    answerStartRef.current = null;
    tapLogsRef.current = [];
    selectedIdsRef.current = [];
    lastResultRef.current = null;
    hasSubmittedRef.current = false;
=======
  const [readyCountdown, setReadyCountdown] = useState(5);
  const [memorizeCountdown, setMemorizeCountdown] = useState(0); // 不顯示
  const [answerCountdown, setAnswerCountdown] = useState(10); // 顯示

  const [feedbackText, setFeedbackText] = useState("");
  const [records, setRecords] = useState([]);
  const [tapLogs, setTapLogs] = useState([]);

  const currentLevel = LEVELS[currentLevelIndex];

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  useEffect(() => {
    audioRef.current = new Audio(clickSfx);
  }, []);

  const debugLog = (label, payload = {}) => {
    console.log(`[TestPage_PM] ${label}`, payload);
  };

  const playClick = () => {
    if (!audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (error) {
      console.warn("[TestPage_PM] audio play failed:", error);
    }
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  };

  const pushRecord = (record) => {
    lastResultRef.current = record;
<<<<<<< HEAD
    recordsRef.current = [...recordsRef.current, record];
    console.log("[TestPage_PM] record saved:", record);
  };

=======
    setRecords((prev) => {
      const next = [...prev, record];
      return next;
    });
    debugLog("record_saved", record);
  };

  // ===== 建立關卡 =====
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  const setupLevel = (levelConfig) => {
    if (!levelConfig) return;

    const memorizeItems = shuffleArray(ALL_ITEMS).slice(0, levelConfig.memoryCount);
<<<<<<< HEAD
    const maxDistractors = Math.max(levelConfig.optionCount - memorizeItems.length, 0);
    const distractors = shuffleArray(
      ALL_ITEMS.filter(
        (item) => !memorizeItems.some((memoryItem) => memoryItem.id === item.id)
      )
    ).slice(0, maxDistractors);

    const options = shuffleArray([...memorizeItems, ...distractors]).slice(
      0,
      levelConfig.optionCount
    );

    resetRuntimeRefs();
    setCurrentMemorizeItems(memorizeItems);
    setCurrentOptions(options);
    setSelectedIds([]);
    setFeedbackText("");
    setFeedbackType("success");
    setPhase("memorize");
  };

  const handleStart = () => {
    if (levelTransitionRef.current) clearTimeout(levelTransitionRef.current);
    recordsRef.current = [];
    pendingResultRef.current = null;
    resetRuntimeRefs();
    setCurrentLevelIndex(0);
    setCurrentMemorizeItems([]);
    setCurrentOptions([]);
    setSelectedIds([]);
    setFeedbackText("");
    setFeedbackType("success");
    setPhase("tutorial");
  };

  const handleTutorialDone = () => {
    setPhase("introVideo");
  };

  const handleVideoEnd = () => {
    setupLevel(LEVELS[0]);
  };

  const trackRandomClick = () => {
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;

    const now = getSafeElapsedTime(answerStartRef.current);

    tapLogsRef.current = [
      ...tapLogsRef.current,
      {
        order: tapLogsRef.current.length + 1,
        itemId: "background",
        timestamp: now,
        action: "randomClick",
        isCorrectItem: false,
        selectedCountAfter: selectedIdsRef.current.length,
      },
    ];
  };

  const toggleSelect = (event, itemId) => {
    event.stopPropagation();
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;

    const correctIds = currentMemorizeItems.map((item) => item.id);
    const prevSelected = selectedIdsRef.current;
    const alreadySelected = prevSelected.includes(itemId);

    let nextSelected = prevSelected;
    if (alreadySelected) {
      nextSelected = prevSelected.filter((id) => id !== itemId);
    } else if (prevSelected.length < currentLevel.memoryCount) {
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
    if (!currentLevel) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
    if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);

    const finalSelectedIds = forceSelectedIds || selectedIdsRef.current;
    const correctIds = currentMemorizeItems.map((item) => item.id);

    const reactionTime = isTimeout
      ? safeNonNegative(currentLevel.answerTime * 1000, 0)
      : getSafeElapsedTime(answerStartRef.current);

    const isCorrect = !isTimeout && arraysEqualAsSet(finalSelectedIds, correctIds);

    const wrongTapCount = tapLogsRef.current.filter(
      (tap) => tap.action === "select" && !tap.isCorrectItem
    ).length;
    const randomClickCount = tapLogsRef.current.filter(
      (tap) => tap.action === "randomClick"
    ).length;
    const deselectCount = tapLogsRef.current.filter(
      (tap) => tap.action === "deselect"
    ).length;
    const missedTargetCount = correctIds.filter((id) => !finalSelectedIds.includes(id)).length;
    const firstTapTime = tapLogsRef.current.length > 0 ? tapLogsRef.current[0].timestamp : 0;

    const errorTypes = {
      ...DEFAULT_ERRORS,
      miss: isTimeout || finalSelectedIds.length < correctIds.length ? missedTargetCount : 0,
      randomClick: randomClickCount,
      wrongTarget: wrongTapCount,
      repeatedClick: deselectCount,
      timeout: isTimeout ? 1 : 0,
    };

    const record = {
      task: "PM",
      level: currentLevel.level,
      difficulty: selectedDifficulty,
      memoryCount: currentLevel.memoryCount,
      showTime: currentLevel.showTime,
      answerTimeLimit: currentLevel.answerTime,
      isCorrect,
      isTimeout,
      isFast: reactionTime > 0 && reactionTime <= 5000,
      reactionTime,
      firstTapTime,
      wrongTapCount,
      randomClickCount,
      deselectCount,
      missedTargetCount,
      errorTypes,
      selectedIds: finalSelectedIds,
      correctIds,
      tapLogs: tapLogsRef.current,
      createdAt: new Date().toISOString(),
=======

    const distractorCount = Math.max(levelConfig.memoryCount, 2);
    const distractors = shuffleArray(
      ALL_ITEMS.filter((item) => !memorizeItems.some((m) => m.id === item.id))
    ).slice(0, distractorCount);

    const options = shuffleArray([...memorizeItems, ...distractors]);

    hasSubmittedRef.current = false;
    answerStartRef.current = null;
    lastResultRef.current = null;

    setCurrentMemorizeItems(memorizeItems);
    setCurrentOptions(options);
    setSelectedIds([]);
    setTapLogs([]);
    setMemorizeCountdown(levelConfig.showTime);
    setPhase("memorize");

    debugLog("setup_level", {
      level: levelConfig.level,
      memoryCount: levelConfig.memoryCount,
      showTime: levelConfig.showTime,
      memorizeIds: memorizeItems.map((item) => item.id),
      optionIds: options.map((item) => item.id),
    });
  };

  // ===== 開始 =====
  const handleStart = () => {
    playClick();
    hasSubmittedRef.current = false;
    answerStartRef.current = null;
    lastResultRef.current = null;
    recordsRef.current = [];

    setCurrentLevelIndex(0);
    setRecords([]);
    setSelectedIds([]);
    setTapLogs([]);
    setFeedbackText("");
    setReadyCountdown(5);
    setPhase("introVideo");

    debugLog("start_test");
  };

  // ===== 影片播完 =====
  const handleVideoEnd = () => {
    setReadyCountdown(5);
    setPhase("readyCountdown");
    debugLog("intro_end");
  };

  // ===== 開始前倒數 =====
  useEffect(() => {
    if (phase !== "readyCountdown") return undefined;

    if (readyCountdown <= 0) {
      setupLevel(LEVELS[currentLevelIndex]);
      return undefined;
    }

    const timer = setTimeout(() => {
      setReadyCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, readyCountdown, currentLevelIndex]);

  // ===== 記憶倒數（不顯示）=====
  useEffect(() => {
    if (phase !== "memorize") return undefined;

    if (memorizeCountdown <= 0) {
      setAnswerCountdown(10);
      setPhase("answer");
      answerStartRef.current = performance.now();
      debugLog("memorize_end_answer_start", {
        level: currentLevel?.level,
        answerStart: answerStartRef.current,
      });
      return undefined;
    }

    const timer = setTimeout(() => {
      setMemorizeCountdown((prev) => Math.max(0, +(prev - 0.5).toFixed(1)));
    }, 500);

    return () => clearTimeout(timer);
  }, [phase, memorizeCountdown, currentLevel]);

  // ===== 作答倒數（10 秒內沒完成 = 失敗）=====
  useEffect(() => {
    if (phase !== "answer") return undefined;
    if (hasSubmittedRef.current) return undefined;

    if (answerCountdown <= 0) {
      const correctIds = currentMemorizeItems.map((item) => item.id);

      const record = {
        level: currentLevel.level,
        memoryCount: currentLevel.memoryCount,
        showTime: currentLevel.showTime,
        isCorrect: false,
        isTimeout: true,
        reactionTime: 10000,
        isFast: false,
        selectedIds,
        correctIds,
        tapLogs,
      };

      hasSubmittedRef.current = true;
      pushRecord(record);
      setFeedbackText("時間到，挑戰失敗！");
      setPhase("feedback");
      return undefined;
    }

    const timer = setTimeout(() => {
      setAnswerCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, answerCountdown, currentMemorizeItems, currentLevel, selectedIds, tapLogs]);

  // ===== 點選答案（記錄每次點擊）=====
  const toggleSelect = (itemId) => {
    if (phase !== "answer" || hasSubmittedRef.current) return;

    playClick();

    const correctIds = currentMemorizeItems.map((item) => item.id);
    const now = answerStartRef.current
      ? Math.round(performance.now() - answerStartRef.current)
      : 0;

    setSelectedIds((prev) => {
      const alreadySelected = prev.includes(itemId);
      let nextSelected = prev;

      if (alreadySelected) {
        nextSelected = prev.filter((id) => id !== itemId);
      } else if (prev.length < currentLevel.memoryCount) {
        nextSelected = [...prev, itemId];
      }

      if (nextSelected !== prev) {
        setTapLogs((prevLogs) => [
          ...prevLogs,
          {
            order: prevLogs.length + 1,
            itemId,
            timestamp: now,
            isCorrectItem: correctIds.includes(itemId),
            action: alreadySelected ? "deselect" : "select",
            selectedCountAfter: nextSelected.length,
          },
        ]);
      }

      return nextSelected;
    });
  };

  // ===== 送出答案 =====
  const handleSubmit = () => {
    if (phase !== "answer" || hasSubmittedRef.current) return;
    if (selectedIds.length !== currentLevel.memoryCount) return;

    playClick();

    const correctIds = currentMemorizeItems.map((item) => item.id);
    const isCorrect = arraysEqualAsSet(selectedIds, correctIds);

    const reactionTime = answerStartRef.current
      ? Math.round(performance.now() - answerStartRef.current)
      : 0;

    const isFast = reactionTime < 5000;

    const record = {
      level: currentLevel.level,
      memoryCount: currentLevel.memoryCount,
      showTime: currentLevel.showTime,
      isCorrect,
      isTimeout: false,
      reactionTime,
      isFast,
      selectedIds,
      correctIds,
      tapLogs,
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
    };

    hasSubmittedRef.current = true;
    pushRecord(record);
<<<<<<< HEAD

    if (isTimeout) {
      setFeedbackText("時間到了，皮皮會陪你一起看看這次結果。");
      setFeedbackType("error");
    } else if (isCorrect) {
      setFeedbackText("找到了！剛剛看到的小物品都放進籃子了。");
      setFeedbackType("success");
    } else {
      setFeedbackText("有幾個小物品好像拿錯了，我們一起看看結果。");
      setFeedbackType("error");
    }

    setPhase("feedback");
  };

  const handleSubmit = () => {
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;
    if (selectedIdsRef.current.length !== currentLevel.memoryCount) return;

    finalizeAnswer({
      isTimeout: false,
      forceSelectedIds: selectedIdsRef.current,
    });
  };

  const buildFinalResult = () => {
    const records = recordsRef.current;
    const totalTrials = records.length;
    const correctTrials = records.filter((record) => record.isCorrect).length;
    const reactionTimes = records
      .map((record) => record.reactionTime)
      .filter((rt) => typeof rt === "number" && rt > 0);

    const errorTypes = records.reduce(
      (sum, record) => {
        Object.keys(DEFAULT_ERRORS).forEach((key) => {
          sum[key] += Number(record.errorTypes?.[key]) || 0;
        });
        return sum;
      },
      { ...DEFAULT_ERRORS }
    );

    const half = Math.max(1, Math.floor(reactionTimes.length / 2));
    const firstHalf = reactionTimes.slice(0, half);
    const secondHalf = reactionTimes.slice(half);
    const avg = (values) =>
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;

    const firstHalfRT = avg(firstHalf);
    const secondHalfRT = avg(secondHalf);
    const firstHalfMiss = records
      .slice(0, Math.max(1, Math.floor(records.length / 2)))
      .reduce((sum, record) => sum + (Number(record.errorTypes?.miss) || 0), 0);
    const secondHalfMiss = records
      .slice(Math.max(1, Math.floor(records.length / 2)))
      .reduce((sum, record) => sum + (Number(record.errorTypes?.miss) || 0), 0);

    const rawPerformanceResult = analyzePerformance({
      totalTrials,
      correctTrials,
      reactionTimes: reactionTimes.filter((rt) => Number.isFinite(rt) && rt > 0),
      errorTypes,
      difficulty: selectedDifficulty,
    });

    const performanceResult = {
      ...rawPerformanceResult,
      accuracy: safeNonNegative(rawPerformanceResult?.accuracy, 0),
      avgReactionTime: safeNonNegative(rawPerformanceResult?.avgReactionTime, 0),
      stars: Math.max(1, Math.min(3, safeNumber(rawPerformanceResult?.stars, 1))),
    };

    const errorResult = safeAnalyzeErrors(errorTypes);
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

    const gameResult = safeCreateGameResult({
      childId: "guest-child",
      gameId: "PM",
      abilityType: "memory",
      mode: "test",
      difficulty: selectedDifficulty,
      score: performanceResult.accuracy,
      stars: performanceResult.stars,
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      totalPlayTime: records.reduce((sum, record) => sum + safeNonNegative(record.reactionTime, 0), 0),
      errorTypes,
      fatigueLevel,
      attemptCount: totalTrials,
    });

    return {
      ...gameResult,
      ...performanceResult,
      ...errorResult,
      fatigueLevel,
      recommendedDifficulty,
      records,
      visibleRoles: ["child", "parent"],
      aiSummary: {
        recommendedDifficulty,
        reason:
          errorTypes.miss > 0
            ? "本次有漏選情形，建議下次可放大圖片或延長觀看時間。"
            : errorTypes.randomClick > 0 || errorTypes.wrongTarget > 0
            ? "本次有亂點或點錯目標，建議先降低干擾物數量。"
            : "本次表現穩定，可以維持目前難度或嘗試更高挑戰。",
      },
    };
  };

  const goResult = () => {
    const finalResult = buildFinalResult();
    pendingResultRef.current = finalResult;
    localStorage.setItem("pmTestResult", JSON.stringify(finalResult));
    setPhase("endingVideo");
  };

  const navigateToResult = () => {
    const finalResult = pendingResultRef.current || buildFinalResult();
    localStorage.setItem("pmTestResult", JSON.stringify(finalResult));
    navigate("/result-picture-memory", {
      state: {
        ...finalResult,
        mode: "test",
        visibleRoles: ["child", "parent"],
      },
    });
  };

  const handleNext = () => {
    const lastRecord = lastResultRef.current;
    if (!lastRecord) return;
    if (levelTransitionRef.current) return;

    const nextIndex = currentLevelIndex + 1;

    levelTransitionRef.current = setTimeout(() => {
      levelTransitionRef.current = null;

      if (lastRecord.isCorrect && nextIndex < LEVELS.length) {
        setCurrentLevelIndex(nextIndex);
        setupLevel(LEVELS[nextIndex]);
        return;
      }

      goResult();
    }, 200);
  };

  const resultStars = Math.max(1, Math.min(3, Number(pendingResultRef.current?.stars) || 1));

  return (
    <div style={styles.page(bgImage)}>
      <style>{`
        @keyframes pmMouseTap {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.92; }
          45% { transform: translate(-10px, -9px) scale(1.08); opacity: 1; }
          62% { transform: translate(-4px, -4px) scale(0.96); opacity: 1; }
        }
        button[aria-label="進入遊戲"]:hover:not(:disabled),
        button[aria-label="跳過動畫"]:hover:not(:disabled),
        button[aria-label="下一步"]:hover:not(:disabled),
        button[aria-label="回到森林"]:hover:not(:disabled),
        button[aria-label="再玩一次"]:hover:not(:disabled),
        button[aria-label="詳細結果"]:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.03);
          filter: brightness(1.04);
        }
        button[aria-label="進入遊戲"]:active:not(:disabled),
        button[aria-label="跳過動畫"]:active:not(:disabled),
        button[aria-label="下一步"]:active:not(:disabled),
        button[aria-label="回到森林"]:active:not(:disabled),
        button[aria-label="再玩一次"]:active:not(:disabled),
        button[aria-label="詳細結果"]:active:not(:disabled) {
          transform: translateY(1px) scale(0.98);
        }
        @media (max-width: 720px) {
          button[aria-label="進入遊戲"],
          button[aria-label="下一步"],
          button[aria-label="回到森林"],
          button[aria-label="再玩一次"],
          button[aria-label="詳細結果"] {
            width: min(72vw, 206px) !important;
          }
          button[aria-label="跳過動畫"] {
            width: min(74vw, 214px) !important;
          }
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

              <div style={styles.guidedAction}>
                <button type="button" style={styles.imageButton} onClick={handleStart} aria-label="進入遊戲">
                  <img src={homeStartBtn} alt="進入遊戲" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
            </div>
          )}

          {phase === "tutorial" && (
            <div style={styles.card}>
              <p style={styles.kicker}>前導教學</p>
              <h1 style={styles.title}>先記住，再點回來</h1>

              <div style={styles.tutorialRow}>
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

                <div style={styles.tutorialArrow}>→</div>

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
              <div style={styles.guidedAction}>
                <button type="button" style={styles.imageButton} onClick={handleTutorialDone} aria-label="進入遊戲">
                  <img src={homeStartBtn} alt="進入遊戲" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
=======
    setFeedbackText(isCorrect ? "答對了！準備進入下一關" : "答錯了，本次測驗結束！");
    setPhase("feedback");
  };

  // ===== 下一步 =====
  const handleNext = () => {
    playClick();

    const lastRecord = lastResultRef.current;
    if (!lastRecord) return;

    if (lastRecord.isCorrect) {
      const nextIndex = currentLevelIndex + 1;

      if (nextIndex < LEVELS.length) {
        setCurrentLevelIndex(nextIndex);
        setSelectedIds([]);
        setCurrentMemorizeItems([]);
        setCurrentOptions([]);
        setTapLogs([]);
        setFeedbackText("");
        lastResultRef.current = null;
        hasSubmittedRef.current = false;
        answerStartRef.current = null;
        setReadyCountdown(5);
        setPhase("readyCountdown");
      } else {
        navigate("/result-picture-memory", {
          state: { records: [...recordsRef.current] },
        });
      }
    } else {
      navigate("/result-picture-memory", {
        state: { records: [...recordsRef.current] },
      });
    }
  };

  return (
    <div style={styles.page(bgImage)}>
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1 style={styles.title}>Picture Memory 測驗</h1>

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
                每答對一關，就會變得更難喔！
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
              <div style={styles.guidedAction}>
                <button type="button" style={{ ...styles.imageButton, ...styles.skipImageButton }} onClick={handleVideoEnd} aria-label="跳過動畫">
                  <img src={homeSkipBtn} alt="跳過動畫" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
=======
              <button
                style={styles.secondaryButton}
                onClick={() => {
                  playClick();
                  handleVideoEnd();
                }}
              >
                跳過
              </button>
            </div>
          )}

          {phase === "readyCountdown" && (
            <div style={styles.smallCard}>
              <h2 style={styles.subtitle}>準備開始</h2>
              <p style={styles.bigCountdown}>{readyCountdown}</p>
              <p style={styles.text}>遊戲即將開始！</p>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
            </div>
          )}

          {phase === "memorize" && currentLevel && (
            <div style={styles.card}>
<<<<<<< HEAD
              <p style={styles.kicker}>第 {currentLevel.level} 關</p>
              <h1 style={styles.title}>看清楚湖裡的小物品</h1>

              <div style={styles.iconHint}>
                <span>👀</span>
                <span>請記住這些圖片</span>
              </div>
=======
              <p style={styles.levelText}>第 {currentLevel.level} 關</p>
              <h2 style={styles.subtitle}>
                請記住這 {currentLevel.memoryCount} 個物品
              </h2>

              <p style={styles.hintText}>請仔細記住這些物品喔！</p>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

              <div style={styles.memoryGrid}>
                {currentMemorizeItems.map((item) => (
                  <div key={item.id} style={styles.memoryCard}>
                    <img src={item.image} alt={item.id} style={styles.memoryImage} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "answer" && currentLevel && (
<<<<<<< HEAD
            <div style={styles.card} onClick={trackRandomClick}>
              <p style={styles.kicker}>第 {currentLevel.level} 關</p>
              <h1 style={styles.title}>找回剛剛看過的物品</h1>

              <div style={styles.iconHint}>
                <span>🧺</span>
                <span>
                  已找到 {selectedIds.length} / {currentLevel.memoryCount}
                </span>
              </div>
=======
            <div style={styles.card}>
              <p style={styles.levelText}>第 {currentLevel.level} 關</p>
              <h2 style={styles.subtitle}>
                請選出剛剛出現的 {currentLevel.memoryCount} 個物品
              </h2>

              <p style={styles.hintText}>
                已選 {selectedIds.length} / {currentLevel.memoryCount}
              </p>

              <p style={styles.answerTimer}>剩下 {answerCountdown} 秒</p>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d

              <div style={styles.optionGrid}>
                {currentOptions.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
<<<<<<< HEAD
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(event) => toggleSelect(event, item.id)}
=======

                  return (
                    <button
                      key={item.id}
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
=======
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
                style={{
                  ...styles.mainButton,
                  opacity: selectedIds.length === currentLevel.memoryCount ? 1 : 0.5,
                  cursor:
<<<<<<< HEAD
                    selectedIds.length === currentLevel.memoryCount ? "pointer" : "not-allowed",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSubmit();
                }}
                disabled={selectedIds.length !== currentLevel.memoryCount}
              >
                放進小籃子
=======
                    selectedIds.length === currentLevel.memoryCount
                      ? "pointer"
                      : "not-allowed",
                }}
                onClick={handleSubmit}
                disabled={selectedIds.length !== currentLevel.memoryCount}
              >
                送出答案
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
              </button>
            </div>
          )}

          {phase === "feedback" && (
            <div style={styles.smallCard}>
<<<<<<< HEAD
              <p style={styles.kicker}>{feedbackType === "success" ? "任務成功" : "任務完成"}</p>
              <h1
                style={{
                  ...styles.title,
                  color: feedbackType === "success" ? "#4f7d3a" : "#b65f2a",
                }}
              >
                {feedbackText}
              </h1>

              <p style={styles.textCompact}>
                {feedbackType === "success"
                  ? "做得很好，我們繼續下一關。"
                  : "這次先到這裡，接著看看完成結果。"}
              </p>

              <div style={styles.guidedAction}>
                <button type="button" style={styles.imageButton} onClick={handleNext} aria-label="下一步">
                  <img src={homeStartBtn} alt="下一步" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
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
                  onEnded={() => setPhase("result")}
                />
              </div>

              <div style={styles.guidedAction}>
                <button type="button" style={{ ...styles.imageButton, ...styles.skipImageButton }} onClick={() => setPhase("result")} aria-label="跳過動畫">
                  <img src={homeSkipBtn} alt="跳過動畫" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
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
                <div style={styles.dialogBubble}>
                  關卡完成！你很認真記住圖片喔。
                </div>
                <div style={styles.roundIcon}>
                  <img src={rabbitAvatar} alt="兔子妹妹" style={styles.roundIconImage} />
                </div>
              </div>

              <div style={styles.resultActions}>
                <div style={styles.guidedAction}>
                  <button type="button" style={styles.resultImageButton} onClick={() => navigate("/test-map")} aria-label="回到森林">
                    <img src={homeBackBtn} alt="回到森林" style={styles.imageButtonImg} />
                  </button>
                  <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
                </div>
                <button type="button" style={styles.resultImageButton} onClick={handleStart} aria-label="再玩一次">
                  <img src={homeAgainBtn} alt="再玩一次" style={styles.imageButtonImg} />
                </button>
                <button type="button" style={styles.resultImageButton} onClick={navigateToResult} aria-label="詳細結果">
                  <img src={homeResultBtn} alt="詳細結果" style={styles.imageButtonImg} />
                </button>
              </div>
=======
              <h2 style={styles.subtitle}>{feedbackText}</h2>

              <button style={styles.mainButton} onClick={handleNext}>
                下一步
              </button>
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
            </div>
          )}
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

  pipiBox: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    backgroundColor: "rgba(255,255,255,0.62)",
    borderRadius: "26px",
    padding: "18px 20px",
    marginBottom: "20px",
  },

  pipiIcon: {
    fontSize: "clamp(42px, 5vw, 54px)",
    flex: "0 0 auto",
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

  answerTimer: {
    fontSize: "26px",
    fontWeight: "800",
    color: "#D97706",
    marginBottom: "18px",
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
=======
    height: "auto",
    display: "block",
    aspectRatio: "16 / 9",
    objectFit: "contain",
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  },

  memoryGrid: {
    display: "grid",
<<<<<<< HEAD
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
=======
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
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  },

  memoryImage: {
    width: "100%",
<<<<<<< HEAD
    height: "100%",
    objectFit: "contain",
    borderRadius: "999px",
    display: "block",
    pointerEvents: "none",
=======
    maxWidth: "200px",
    height: "200px",
    objectFit: "contain",
    marginBottom: "10px",
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  },

  optionGrid: {
    display: "grid",
<<<<<<< HEAD
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
=======
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
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
  },

  optionImage: {
    width: "100%",
<<<<<<< HEAD
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

  mainButton: {
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
    touchAction: "manipulation",
  },

  secondaryButton: {
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
    touchAction: "manipulation",
  },

  greenButton: {
    minWidth: "184px",
    minHeight: "72px",
    padding: "12px 34px",
    borderRadius: "22px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(24px, 2.5vw, 34px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #347d23",
    background: glossyGreen,
    textShadow: "0 3px 0 rgba(33, 93, 24, 0.38)",
    boxShadow: "0 7px 0 rgba(43, 104, 28, 0.62), 0 12px 22px rgba(67, 93, 38, 0.18), inset 0 3px 0 rgba(255,255,255,0.35)",
    touchAction: "manipulation",
  },

  orangeButton: {
    minWidth: "184px",
    minHeight: "72px",
    padding: "12px 34px",
    borderRadius: "22px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(24px, 2.5vw, 34px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #b45f18",
    background: "linear-gradient(180deg, #ffd36f 0%, #ffac3d 48%, #ef7d22 100%)",
    textShadow: "0 3px 0 rgba(133, 68, 17, 0.34)",
    boxShadow: "0 7px 0 rgba(154, 86, 22, 0.52), 0 12px 22px rgba(154, 86, 22, 0.16), inset 0 3px 0 rgba(255,255,255,0.35)",
    touchAction: "manipulation",
  },

  blueButton: {
    minWidth: "184px",
    minHeight: "72px",
    padding: "12px 34px",
    borderRadius: "22px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(24px, 2.5vw, 34px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #2c72a8",
    background: "linear-gradient(180deg, #91dcff 0%, #54b7ef 48%, #2b8ed9 100%)",
    textShadow: "0 3px 0 rgba(30, 83, 137, 0.34)",
    boxShadow: "0 7px 0 rgba(38, 92, 137, 0.5), 0 12px 22px rgba(38, 78, 137, 0.16), inset 0 3px 0 rgba(255,255,255,0.35)",
    touchAction: "manipulation",
  },
};
=======
    maxWidth: "200px",
    height: "200px",
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
  },
};
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
