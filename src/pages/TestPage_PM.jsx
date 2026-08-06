import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { createGameResult } from "../ai/gameResultTemplate";
import { saveUnifiedResult } from "../utils/resultManager";
import { calculatePMScore } from "../utils/pmScoring";

// ===== 圖片 =====
import PM01 from "../asset/PM/PM_01.webp";
import PM02 from "../asset/PM/PM_02.webp";
import PM03 from "../asset/PM/PM_03.webp";
import PM04 from "../asset/PM/PM_04.webp";
import PM05 from "../asset/PM/PM_05.webp";
import PM06 from "../asset/PM/PM_06.webp";
import PM07 from "../asset/PM/PM_07.webp";
import PM08 from "../asset/PM/PM_08.webp";
import PM09 from "../asset/PM/PM_09.webp";
import PM10 from "../asset/PM/PM_10.webp";
import PM11 from "../asset/PM/PM_11.webp";
import PM12 from "../asset/PM/PM_12.webp";
import rabbitAvatar from "../asset/avatar/rabbit.webp";

// ===== 背景 / 前導影片 / 結束影片 =====
import bgImage from "../asset/PM/PM_background.webp";
import introVideo from "../asset/optimized/mp4/PM_start.mp4";
import stepVideo from "../asset/optimized/mp4/PM_step.mp4";
import endingVideo from "../asset/optimized/mp4/PM_end.mp4";
import homeStartBtn from "../asset/home/start.webp";
import homeSkipBtn from "../asset/home/skip.webp";
import homeBackBtn from "../asset/home/back.webp";
import homeResultBtn from "../asset/home/result.webp";
import homeNextBtn from "../asset/home/next.webp";
import mouseGuideImg from "../asset/mouse.webp";

const TEST_PAGE_ROUTE = "/test-map";

const ALL_ITEMS = [
  { id: "PM01", image: PM01, alt: "生日蛋糕" },
  { id: "PM02", image: PM02, alt: "藍色水壺" },
  { id: "PM03", image: PM03, alt: "紫色禮物盒" },
  { id: "PM04", image: PM04, alt: "彩色棒棒糖" },
  { id: "PM05", image: PM05, alt: "黃色帽子" },
  { id: "PM06", image: PM06, alt: "黃色鞋子" },
  { id: "PM07", image: PM07, alt: "莓果果醬" },
  { id: "PM08", image: PM08, alt: "綠色樹葉" },
  { id: "PM09", image: PM09, alt: "黃色小鴨" },
  { id: "PM10", image: PM10, alt: "綠色手錶" },
  { id: "PM11", image: PM11, alt: "金色湯匙" },
  { id: "PM12", image: PM12, alt: "彩虹吊飾" },
];

// PM 完整測驗：7 個記憶跨度，每個跨度 2 題，最多 12 選。
const MAX_RECOGNITION_OPTION_COUNT = 12;
const FULL_TEST_SHOW_TIME = 5;

const getRecognitionOptionCount = (memoryCount, itemPoolSize = ALL_ITEMS.length) => {
  const safeMemoryCount = Math.max(1, Number(memoryCount) || 1);
  const targetOptionCount =
    safeMemoryCount >= 6
      ? MAX_RECOGNITION_OPTION_COUNT
      : safeMemoryCount * 2;

  return Math.min(targetOptionCount, itemPoolSize);
};

const LEVELS = [
  { level: 1, memoryCount: 1, showTime: FULL_TEST_SHOW_TIME, answerTime: 10 },
  { level: 2, memoryCount: 2, showTime: FULL_TEST_SHOW_TIME, answerTime: 10 },
  { level: 3, memoryCount: 3, showTime: FULL_TEST_SHOW_TIME, answerTime: 10 },
  { level: 4, memoryCount: 4, showTime: FULL_TEST_SHOW_TIME, answerTime: 10 },
  { level: 5, memoryCount: 5, showTime: FULL_TEST_SHOW_TIME, answerTime: 10 },
  { level: 6, memoryCount: 6, showTime: FULL_TEST_SHOW_TIME, answerTime: 10 },
  { level: 7, memoryCount: 7, showTime: FULL_TEST_SHOW_TIME, answerTime: 10 },
];

const TRIALS_PER_MEMORY_COUNT = 2;

const TEST_TRIALS = LEVELS.flatMap((levelConfig) =>
  Array.from({ length: TRIALS_PER_MEMORY_COUNT }, (_, index) => ({
    ...levelConfig,
    trialInMemoryCount: index + 1,
    plannedTrialsInMemoryCount: TRIALS_PER_MEMORY_COUNT,
  }))
);

const DEFAULT_ERRORS = {
  miss: 0,
  randomClick: 0,
  wrongTarget: 0,
  repeatedClick: 0,
  timeout: 0,
  sequenceError: 0,
  ruleSwitchError: 0,
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
}

function hasTwoConsecutiveErrorsInSameMemoryCount(records = []) {
  if (!Array.isArray(records) || records.length < 2) return false;

  const lastTwo = records.slice(-2);
  return (
    lastTwo[0]?.memoryCount === lastTwo[1]?.memoryCount &&
    lastTwo.every((record) => record?.isCorrect !== true)
  );
}

function hasTwoConsecutiveTimeouts(records = []) {
  if (!Array.isArray(records) || records.length < 2) return false;

  return records.slice(-2).every((record) => record?.isTimeout === true);
}

function getPMStopReason({ records, nextIndex }) {
  if (hasTwoConsecutiveTimeouts(records)) return "two_consecutive_timeouts";
  if (hasTwoConsecutiveErrorsInSameMemoryCount(records)) {
    return "same_memory_two_errors";
  }
  if (nextIndex >= TEST_TRIALS.length) return "completed_all_trials";
  return null;
}

function getPMStopReasonText(reason) {
  switch (reason) {
    case "two_consecutive_timeouts":
      return "連續兩題逾時，測驗結束。";
    case "same_memory_two_errors":
      return "同一記憶數量連續兩題未通過，測驗結束。";
    case "completed_all_trials":
      return "已完成全部測驗題目。";
    default:
      return "測驗結束。";
  }
}


function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("[TestPage_PM] JSON 解析失敗：", error);
    return fallback;
  }
}

function resolveCurrentChildId() {
  const candidates = [
    safeJsonParse(localStorage.getItem("currentChild")),
    safeJsonParse(localStorage.getItem("selectedChild")),
    safeJsonParse(sessionStorage.getItem("currentChild")),
    safeJsonParse(sessionStorage.getItem("selectedChild")),
  ];

  for (const child of candidates) {
    const childId = child?.id || child?.childId || child?.child_id;
    if (childId) return String(childId);
  }

  return (
    localStorage.getItem("currentChildId") ||
    localStorage.getItem("selectedChildId") ||
    sessionStorage.getItem("currentChildId") ||
    sessionStorage.getItem("selectedChildId") ||
    ""
  );
}

function createResultId(childId) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `pm-test-${childId || "unknown"}-${Date.now()}-${randomPart}`;
}

function buildPMDataQuality(records = []) {
  const totalTrials = records.length;
  const validTrials = records.filter((record) => !record.isTimeout);
  const timeoutCount = records.filter((record) => record.isTimeout).length;
  const invalidClickCount = records.reduce(
    (sum, record) => sum + safeNonNegative(record.randomClickCount, 0),
    0
  );
  const hintCount = records.filter((record) => record.hintShown).length;
  const totalOptionTaps = records.reduce(
    (sum, record) =>
      sum +
      (Array.isArray(record.tapLogs)
        ? record.tapLogs.filter((tap) => tap.action === "select").length
        : 0),
    0
  );

  const timeoutRate = totalTrials > 0 ? timeoutCount / totalTrials : 1;
  const invalidClickRate =
    totalOptionTaps + invalidClickCount > 0
      ? invalidClickCount / (totalOptionTaps + invalidClickCount)
      : 0;
  const hintRate = totalTrials > 0 ? hintCount / totalTrials : 0;
  const warnings = [];

  if (validTrials.length < 4) warnings.push("有效作答題數不足");
  if (timeoutRate >= 0.25) warnings.push("逾時比例偏高");
  if (invalidClickRate >= 0.2) warnings.push("背景誤觸比例偏高");
  if (hintRate > 0) warnings.push("測驗過程曾出現提示");

  let status = "valid";
  if (validTrials.length < 2 || timeoutRate >= 0.5) {
    status = "insufficient";
  } else if (warnings.length > 0) {
    status = "usable_with_caution";
  }

  return {
    status,
    validTrialCount: validTrials.length,
    totalTrialCount: totalTrials,
    timeoutCount,
    timeoutRate,
    invalidClickCount,
    invalidClickRate,
    hintCount,
    hintRate,
    warnings,
  };
}

function buildMemoryCountSummary(records = []) {
  const grouped = records.reduce((acc, record) => {
    const key = String(record.memoryCount);
    if (!acc[key]) {
      acc[key] = { memoryCount: record.memoryCount, attempted: 0, correct: 0, timeout: 0 };
    }
    acc[key].attempted += 1;
    if (record.isCorrect) acc[key].correct += 1;
    if (record.isTimeout) acc[key].timeout += 1;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => a.memoryCount - b.memoryCount)
    .map((entry) => ({
      ...entry,
      accuracy: entry.attempted > 0 ? entry.correct / entry.attempted : 0,
      timeoutRate: entry.attempted > 0 ? entry.timeout / entry.attempted : 0,
      passed: entry.attempted >= TRIALS_PER_MEMORY_COUNT && entry.correct >= TRIALS_PER_MEMORY_COUNT,
    }));
}

const LEGACY_PM_TEST_RESULT_KEYS = [
  "pmTestResult",
  "latestPMTestResult",
  "pictureMemoryTestResult",
  "result_picture_memory_test",
  "ef_game_pm_test_result",
];

const SESSION_PM_TEST_RESULT_KEYS = ["pmTestResult", "latestPMTestResult"];

export default function TestPage_PM() {
  const navigate = useNavigate();

  const answerStartRef = useRef(null);
  const recordsRef = useRef([]);
  const tapLogsRef = useRef([]);
  const selectedIdsRef = useRef([]);
  const finalizeAnswerRef = useRef(null);
  const lastResultRef = useRef(null);
  const pendingResultRef = useRef(null);
  const hasSavedUnifiedResultRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  const timeoutRef = useRef(null);
  const answerTimeoutRef = useRef(null);
  const answerStartFrameRef = useRef(null);
  const levelTransitionRef = useRef(null);
  const stopReasonRef = useRef(null);
  const testStartedAtRef = useRef(null);
  const resultIdRef = useRef(null);
  const videoTransitioningRef = useRef(false);
  const finishingRef = useRef(false);

  const [phase, setPhase] = useState("rules");
  // rules -> introVideo -> stepVideo -> memorize -> answer -> feedback -> endingVideo -> result

  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [currentMemorizeItems, setCurrentMemorizeItems] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [feedbackText, setFeedbackText] = useState("");


  const currentLevel = TEST_TRIALS[currentLevelIndex];

  const selectedDifficulty = useMemo(() => {
    const level = currentLevel?.level ?? 1;
    if (level <= 2) return "easy";
    if (level <= 5) return "normal";
    return "hard";
  }, [currentLevel]);

  const clearAnswerTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
    if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);

    timeoutRef.current = null;
    answerTimeoutRef.current = null;
    answerStartFrameRef.current = null;
  }, []);

  const clearAllTimers = useCallback(() => {
    clearAnswerTimers();
    if (levelTransitionRef.current) clearTimeout(levelTransitionRef.current);
    levelTransitionRef.current = null;
  }, [clearAnswerTimers]);

  const writePmTestResult = useCallback((result) => {
    const serializedResult = JSON.stringify(result);
    const childKey = result.childId ? `pmTestResult_${result.childId}` : "pmTestResult_unassigned";

    localStorage.setItem(childKey, serializedResult);
    sessionStorage.setItem(childKey, serializedResult);

    LEGACY_PM_TEST_RESULT_KEYS.forEach((key) => {
      localStorage.setItem(key, serializedResult);
    });

    SESSION_PM_TEST_RESULT_KEYS.forEach((key) => {
      sessionStorage.setItem(key, serializedResult);
    });
  }, []);

  useEffect(() => {
    return clearAllTimers;
  }, [clearAllTimers]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    clearAnswerTimers();

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
          finalizeAnswerRef.current?.({
            isTimeout: true,
            forceSelectedIds: selectedIdsRef.current,
          });
        }, currentLevel.answerTime * 1000);
      });
    }

    return clearAnswerTimers;
  }, [phase, currentLevel, clearAnswerTimers]);


  const resetRuntimeRefs = () => {
    clearAnswerTimers();
    answerStartRef.current = null;
    tapLogsRef.current = [];
    selectedIdsRef.current = [];
    lastResultRef.current = null;
    hasSubmittedRef.current = false;
  };

  const pushRecord = (record) => {
    lastResultRef.current = record;
    recordsRef.current = [...recordsRef.current, record];
  };

  const setupLevel = (levelConfig) => {
    if (!levelConfig) return;

    const memorizeItems = shuffleArray(ALL_ITEMS).slice(0, levelConfig.memoryCount);
    const optionCount = getRecognitionOptionCount(levelConfig.memoryCount);
    const maxDistractors = Math.max(optionCount - memorizeItems.length, 0);
    const distractors = shuffleArray(
      ALL_ITEMS.filter(
        (item) => !memorizeItems.some((memoryItem) => memoryItem.id === item.id)
      )
    ).slice(0, maxDistractors);

    const options = shuffleArray([...memorizeItems, ...distractors]).slice(
      0,
      optionCount
    );

    resetRuntimeRefs();
    setCurrentMemorizeItems(memorizeItems);
    setCurrentOptions(options);
    setSelectedIds([]);
    setFeedbackText("");
    setPhase("memorize");
  };

  const handleStart = () => {
    clearAllTimers();
    recordsRef.current = [];
    pendingResultRef.current = null;
    stopReasonRef.current = null;
    hasSavedUnifiedResultRef.current = false;
    finishingRef.current = false;
    videoTransitioningRef.current = false;
    testStartedAtRef.current = new Date().toISOString();
    resultIdRef.current = null;
    resetRuntimeRefs();
    setCurrentLevelIndex(0);
    setCurrentMemorizeItems([]);
    setCurrentOptions([]);
    setSelectedIds([]);
    setFeedbackText("");
    setPhase("introVideo");
  };

  const handleIntroVideoEnd = () => {
    if (videoTransitioningRef.current) return;
    videoTransitioningRef.current = true;
    setPhase("stepVideo");
    requestAnimationFrame(() => {
      videoTransitioningRef.current = false;
    });
  };

  const handleStepVideoEnd = () => {
    if (videoTransitioningRef.current) return;
    videoTransitioningRef.current = true;
    setupLevel(TEST_TRIALS[0]);
    requestAnimationFrame(() => {
      videoTransitioningRef.current = false;
    });
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

    clearAnswerTimers();

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
    const firstOptionTap = tapLogsRef.current.find((tap) => tap.action === "select");
    const firstTapTime = firstOptionTap?.timestamp || 0;

    const errorTypes = {
      ...DEFAULT_ERRORS,
      miss: missedTargetCount,
      randomClick: randomClickCount,
      wrongTarget: wrongTapCount,
      repeatedClick: deselectCount,
      timeout: isTimeout ? 1 : 0,
    };

    const record = {
      task: "PM",
      level: currentLevel.level,
      trialNumber: currentLevelIndex + 1,
      trialInMemoryCount: currentLevel.trialInMemoryCount,
      plannedTrialsInMemoryCount: currentLevel.plannedTrialsInMemoryCount,
      plannedTotalRounds: TEST_TRIALS.length,
      difficulty: selectedDifficulty,
      difficultyLevel: currentLevel.level,
      memoryCount: currentLevel.memoryCount,
      optionCount: currentOptions.length,
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
      hintShown: false,
      errorTypes,
      selectedIds: finalSelectedIds,
      correctIds,
      tapLogs: tapLogsRef.current,
      createdAt: new Date().toISOString(),
    };

    hasSubmittedRef.current = true;
    pushRecord(record);

    setFeedbackText("這一題完成了。");
    setPhase("feedback");
  };
  finalizeAnswerRef.current = finalizeAnswer;

  const handleSubmit = () => {
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;
    if (selectedIdsRef.current.length !== currentLevel.memoryCount) return;

    finalizeAnswer({
      isTimeout: false,
      forceSelectedIds: selectedIdsRef.current,
    });
  };

  const buildFinalResult = (stopReason = stopReasonRef.current || "completed_all_trials") => {
    const records = recordsRef.current;
    const totalTrials = records.length;
    const correctTrials = records.filter((record) => record.isCorrect).length;
    const reactionTimes = records
      .filter((record) => !record.isTimeout)
      .map((record) => record.reactionTime)
      .filter((rt) => typeof rt === "number" && Number.isFinite(rt) && rt > 0);

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

    const childId = resolveCurrentChildId();
    const dataQuality = buildPMDataQuality(records);
    const memoryCountSummary = buildMemoryCountSummary(records);
    const highestPresentedMemoryCount = records.reduce(
      (max, record) => Math.max(max, safeNonNegative(record.memoryCount, 0)),
      0
    );
    const highestPassedMemoryCount = memoryCountSummary.reduce(
      (max, entry) => (entry.passed ? Math.max(max, entry.memoryCount) : max),
      0
    );

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
      stars: Math.max(0, Math.min(3, safeNumber(rawPerformanceResult?.stars, 0))),
    };

    const errorResult = safeAnalyzeErrors(errorTypes);
    const rawFatigueLevel = analyzeFatigue({
      firstHalfRT: safeNonNegative(firstHalfRT, 0),
      secondHalfRT: safeNonNegative(secondHalfRT, 0),
      missIncrease: Math.max(0, secondHalfMiss - firstHalfMiss),
    });
    const fatigueLevel = safeNumber(rawFatigueLevel, 0);

    const recommendedDifficulty =
      dataQuality.status === "insufficient"
        ? "easy"
        : safeRecommendedDifficulty({
            accuracy: performanceResult.accuracy,
            avgReactionTime: performanceResult.avgReactionTime,
            errorTypes,
            fatigueLevel,
          });

    const scoring = calculatePMScore(records, {
      mode: "test",
      plannedTotalRounds: TEST_TRIALS.length,
    });

    // 正式結果以 pmScoring.js 為主，避免測驗頁、結果頁、家長端星星不同步。
    const officialScore =
      dataQuality.status === "insufficient"
        ? 0
        : safeNonNegative(scoring?.totalScore, 0);
    const officialStars =
      dataQuality.status === "insufficient"
        ? 0
        : Math.max(0, Math.min(3, safeNumber(scoring?.stars, 0)));

    const gameResult = safeCreateGameResult({
      childId,
      gameId: "PM",
      abilityType: "memory",
      mode: "test",
      difficulty: "adaptive_span_test",
      score: officialScore,
      stars: officialStars,
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      totalPlayTime: records.reduce((sum, record) => sum + safeNonNegative(record.reactionTime, 0), 0),
      errorTypes,
      fatigueLevel,
      attemptCount: totalTrials,
    });

    const finishedAt = new Date().toISOString();
    const startedAt = testStartedAtRef.current || records[0]?.createdAt || finishedAt;
    const resultId = resultIdRef.current || createResultId(childId);
    resultIdRef.current = resultId;

    return {
      ...gameResult,
      resultId,
      schemaVersion: "1.0.0",
      childId,
      gameId: "PM",
      mode: "test",
      startedAt,
      finishedAt,
      durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
      difficulty: "adaptive_span_test",
      ...performanceResult,
      ...errorResult,
      score: officialScore,
      totalScore: officialScore,
      stars: officialStars,
      fatigueLevel,
      recommendedDifficulty,
      plannedTotalRounds: TEST_TRIALS.length,
      stopReason,
      stopReasonText: getPMStopReasonText(stopReason),
      scoring,
      summary: {
        accuracy: performanceResult.accuracy,
        accuracyPercent: scoring?.summary?.accuracyPercent ?? Math.round(performanceResult.accuracy * 100),
        score: officialScore,
        totalScore: officialScore,
        stars: officialStars,
        completedTrials: totalTrials,
        highestPresentedMemoryCount,
        highestPassedMemoryCount,
        memorySpan: highestPassedMemoryCount,
        stopReason,
      },
      metrics: {
        accuracy: performanceResult.accuracy,
        avgReactionTime: performanceResult.avgReactionTime,
        timeoutRate: dataQuality.timeoutRate,
        highestPresentedMemoryCount,
        highestPassedMemoryCount,
        memorySpan: highestPassedMemoryCount,
        accuracyByMemoryCount: Object.fromEntries(
          memoryCountSummary.map((entry) => [entry.memoryCount, entry.accuracy])
        ),
        timeoutRateByMemoryCount: Object.fromEntries(
          memoryCountSummary.map((entry) => [entry.memoryCount, entry.timeoutRate])
        ),
        memoryCountSummary,
      },
      dataQuality,
      trials: records,
      analysis: {
        performance: {
          ...performanceResult,
          score: officialScore,
          totalScore: officialScore,
          stars: officialStars,
        },
        scoring,
        errors: errorResult,
        fatigueLevel,
      },
      recommendation: {
        difficulty: recommendedDifficulty,
        shouldAutoAdjust: dataQuality.status !== "insufficient",
        reason:
          dataQuality.status === "insufficient"
            ? "本次有效作答資料不足，暫不提高難度。"
            : errorTypes.miss > 0
            ? "本次有漏選情形，建議維持或降低圖片數量。"
            : "本次作答資料可供下一次難度安排參考。",
      },
      syncStatus: "pending",
      records,
      visibleRoles: ["child", "parent", "clinician"],
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

  const persistPmTestResult = (result) => {
    const persistableResult = {
      ...result,
      mode: "test",
      visibleRoles: ["child", "parent", "clinician"],
    };

    try {
      writePmTestResult(persistableResult);
    } catch (error) {
      console.warn("[TestPage_PM] localStorage 儲存失敗：", error);
    }

    if (!hasSavedUnifiedResultRef.current) {
      hasSavedUnifiedResultRef.current = true;
      Promise.resolve(
        saveUnifiedResult({
          rawResult: persistableResult,
          gameId: "PM",
          mode: "test",
          difficulty: "adaptive_span_test",
          route: "/test-picture-memory",
          visibleRoles: ["child", "parent", "clinician"],
        })
      )
        .then(() => {
          persistableResult.syncStatus = "synced";
          if (pendingResultRef.current?.resultId === persistableResult.resultId) {
            pendingResultRef.current = persistableResult;
          }
          try {
            writePmTestResult(persistableResult);
          } catch (error) {
            console.warn("[TestPage_PM] syncStatus 回寫失敗：", error);
          }
        })
        .catch((error) => {
          hasSavedUnifiedResultRef.current = false;
          persistableResult.syncStatus = "pending";
          console.warn("[TestPage_PM] 統一結果儲存失敗，已保留本機結果：", error);
        });
    }

    return persistableResult;
  };

  const goResult = (stopReason = "completed_all_trials") => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    stopReasonRef.current = stopReason;
    const finalResult = persistPmTestResult(buildFinalResult(stopReason));
    pendingResultRef.current = finalResult;
    setPhase("endingVideo");
  };

  const navigateToResult = () => {
    const finalResult =
      pendingResultRef.current ||
      persistPmTestResult(buildFinalResult(stopReasonRef.current || "completed_all_trials"));

    pendingResultRef.current = finalResult;
    navigate("/result-picture-memory", {
      state: {
        ...finalResult,
        mode: "test",
        visibleRoles: ["child", "parent", "clinician"],
      },
    });
  };

  const handleNext = () => {
    const lastRecord = lastResultRef.current;
    if (!lastRecord) return;
    if (levelTransitionRef.current) return;

    const records = recordsRef.current;
    const nextIndex = currentLevelIndex + 1;
    const stopReason = getPMStopReason({ records, nextIndex });

    levelTransitionRef.current = setTimeout(() => {
      levelTransitionRef.current = null;

      if (stopReason) {
        goResult(stopReason);
        return;
      }

      setCurrentLevelIndex(nextIndex);
      setupLevel(TEST_TRIALS[nextIndex]);
    }, 200);
  };

  const resultStars = Math.max(0, Math.min(3, Number(pendingResultRef.current?.stars) || 0));

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
        button[aria-label="詳細結果"]:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.03);
          filter: brightness(1.04);
        }
        button[aria-label="進入遊戲"]:active:not(:disabled),
        button[aria-label="跳過動畫"]:active:not(:disabled),
        button[aria-label="下一步"]:active:not(:disabled),
        button[aria-label="回到森林"]:active:not(:disabled),
        button[aria-label="詳細結果"]:active:not(:disabled) {
          transform: translateY(1px) scale(0.98);
        }
        @media (max-width: 720px) {
          button[aria-label="進入遊戲"],
          button[aria-label="下一步"],
          button[aria-label="回到森林"],
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
            <div className="game-start-card-artwork pm-opening-card-artwork" style={styles.startPanel}>
              <div style={styles.gameTitle}>圖片記憶任務</div>

              <div style={styles.startContent}>
                <div style={styles.dialogBubble}>
                  幫兔子妹妹記住湖邊的小物品。
                </div>
                <div style={styles.roundIcon}>
                  <img width={512} height={512} src={rabbitAvatar} alt="兔子妹妹" style={styles.roundIconImage} />
                </div>
              </div>

              <div style={styles.guidedAction}>
                <button type="button" style={styles.imageButton} onClick={handleStart} aria-label="進入遊戲">
                  <img width={1024} height={341} src={homeStartBtn} alt="進入遊戲" style={styles.imageButtonImg} />
                </button>
                <img width={1024} height={1024} loading="lazy" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
            </div>
          )}


          {phase === "introVideo" && (
            <div className="game-start-card-artwork pm-video-card-artwork" style={styles.videoPanel}>
              <div style={styles.videoFrame}>
                <video
                  src={introVideo}
                  style={styles.video}
                  autoPlay
                  muted
                  playsInline
                  controls
                  onEnded={handleIntroVideoEnd}
                />
              </div>

              <div style={styles.guidedAction}>
                <button type="button" style={{ ...styles.imageButton, ...styles.skipImageButton }} onClick={handleIntroVideoEnd} aria-label="跳過動畫">
                  <img width={1024} height={341} loading="lazy" src={homeSkipBtn} alt="跳過動畫" style={styles.imageButtonImg} />
                </button>
                <img width={1024} height={1024} loading="lazy" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
            </div>
          )}

          {phase === "stepVideo" && (
            <div className="game-start-card-artwork pm-video-card-artwork" style={styles.videoPanel}>
              <div style={styles.videoFrame}>
                <video
                  src={stepVideo}
                  style={styles.video}
                  autoPlay
                  muted
                  playsInline
                  controls
                  onEnded={handleStepVideoEnd}
                />
              </div>

              <div style={styles.guidedAction}>
                <button type="button" style={styles.imageButton} onClick={handleStepVideoEnd} aria-label="下一步">
                  <img width={1024} height={341} loading="lazy" src={homeNextBtn} alt="下一步" style={styles.imageButtonImg} />
                </button>
                <img width={1024} height={1024} loading="lazy" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
            </div>
          )}

          {phase === "memorize" && currentLevel && (
            <div style={styles.card}>
              <p style={styles.kicker}>第 {currentLevelIndex + 1} / {TEST_TRIALS.length} 題</p>
              <h1 style={styles.title}>看清楚湖裡的小物品</h1>

              <div style={styles.iconHint}>
                <span>請記住 {currentLevel.memoryCount} 個圖片</span>
              </div>

              <div style={styles.memoryGrid}>
                {currentMemorizeItems.map((item) => (
                  <div key={item.id} style={styles.memoryCard}>
                    <img src={item.image} alt={item.alt} width="162" height="162" loading="lazy" style={styles.memoryImage} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "answer" && currentLevel && (
            <div style={styles.card} onClick={trackRandomClick}>
              <p style={styles.kicker}>第 {currentLevelIndex + 1} / {TEST_TRIALS.length} 題</p>
              <h1 style={styles.title}>找回剛剛看過的物品</h1>

              <div style={styles.iconHint}>
                <span>🧺</span>
                <span>
                  已找到 {selectedIds.length} / {currentLevel.memoryCount}
                </span>
              </div>

              <div style={styles.optionGrid}>
                {currentOptions.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(event) => toggleSelect(event, item.id)}
                      style={{
                        ...styles.optionCard,
                        ...(isSelected ? styles.optionCardSelected : {}),
                      }}
                    >
                      <img src={item.image} alt={item.alt} width="162" height="162" loading="lazy" style={styles.optionImage} />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                style={{
                  ...styles.mainButton,
                  opacity: selectedIds.length === currentLevel.memoryCount ? 1 : 0.5,
                  cursor:
                    selectedIds.length === currentLevel.memoryCount ? "pointer" : "not-allowed",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSubmit();
                }}
                disabled={selectedIds.length !== currentLevel.memoryCount}
              >
                放進小籃子
              </button>
            </div>
          )}

          {phase === "feedback" && (
            <div style={styles.smallCard}>
              <p style={styles.kicker}>任務完成</p>
              <h1
                style={{
                  ...styles.title,
                  color: "#5c4033",
                }}
              >
                {feedbackText}
              </h1>

              <p style={styles.textCompact}>
                請按下一步，準備下一題或查看結果。
              </p>

              <div style={styles.guidedAction}>
                <button type="button" style={styles.imageButton} onClick={handleNext} aria-label="下一步">
                  <img width={1024} height={341} loading="lazy" src={homeNextBtn} alt="下一步" style={styles.imageButtonImg} />
                </button>
              </div>
            </div>
          )}

          {phase === "endingVideo" && (
            <div className="game-start-card-artwork pm-video-card-artwork" style={styles.videoPanel}>
              <div style={styles.videoFrame}>
                <video
                  src={endingVideo}
                  style={styles.video}
                  autoPlay
                  muted
                  playsInline
                  controls
                  onEnded={() => {
                    if (!videoTransitioningRef.current) {
                      videoTransitioningRef.current = true;
                      setPhase("result");
                    }
                  }}
                />
              </div>

              <div style={styles.guidedAction}>
                <button type="button" style={{ ...styles.imageButton, ...styles.skipImageButton }} onClick={() => {
                  if (!videoTransitioningRef.current) {
                    videoTransitioningRef.current = true;
                    setPhase("result");
                  }
                }} aria-label="跳過動畫">
                  <img width={1024} height={341} loading="lazy" src={homeSkipBtn} alt="跳過動畫" style={styles.imageButtonImg} />
                </button>
              </div>
            </div>
          )}

          {phase === "result" && (
            <div className="game-result-card-artwork pm-summary-card-artwork" style={styles.resultPanel}>
              <div style={styles.starRow} aria-label={`${resultStars} 顆星`}>
                {[1, 2, 3].map((star, index) => {
                  const curveStyles = [styles.starLeft, styles.starCenter, styles.starRight];
                  return (
                    <span key={star} className={`game-result-star ${star <= resultStars ? "is-earned" : ""}`} style={{ ...styles.starShell, ...curveStyles[index] }}>
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
                  測驗完成！你很認真記住圖片喔。
                </div>
                <div style={styles.roundIcon}>
                  <img width={512} height={512} loading="lazy" src={rabbitAvatar} alt="兔子妹妹" style={styles.roundIconImage} />
                </div>
              </div>

              <div style={styles.resultActions}>
                <div style={styles.guidedAction}>
                  <button type="button" style={styles.resultImageButton} onClick={() => navigate(TEST_PAGE_ROUTE)} aria-label="回到森林">
                    <img width={1024} height={341} loading="lazy" src={homeBackBtn} alt="回到森林" style={styles.imageButtonImg} />
                  </button>
                </div>
                <button type="button" style={styles.resultImageButton} onClick={navigateToResult} aria-label="詳細結果">
                  <img width={1024} height={341} loading="lazy" src={homeResultBtn} alt="詳細結果" style={styles.imageButtonImg} />
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
