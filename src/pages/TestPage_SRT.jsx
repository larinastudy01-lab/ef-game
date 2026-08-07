import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import bgImg from "../asset/SRT/SRT_background.webp";
import normalImg from "../asset/SRT/acorn.webp";
import goldenImg from "../asset/SRT/golden_acorn.webp";
import rottenImg from "../asset/SRT/rotten_acorn.webp";
import levelIcon from "../asset/SRT/SRT_icon.webp";
import startAvatar from "../asset/SRT/bear.webp";
import introVideo from "../asset/optimized/mp4/SRT_start.mp4";
import tutorialVideo from "../asset/optimized/mp4/SRT_step.mp4";
import endingVideo from "../asset/optimized/mp4/SRT_end.mp4";
import homeStartBtn from "../asset/SRT/start.webp";
import homeSkipBtn from "../asset/SRT/skip.webp";
import homeNextBtn from "../asset/SRT/next.webp";
import homeBackBtn from "../asset/SRT/back.webp";
import homeResultBtn from "../asset/SRT/result.webp";
import mouseImg from "../asset/mouse.webp";

import SrtResultPage from "./ResultPage_SRT";
import { calculateSrtScore } from "../utils/srtScoring";
import { saveUnifiedResult } from "../utils/resultManager";

import { createGameResult } from "../ai/gameResultTemplate";
import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";

const TEST_DURATION_MS = 300000; // 5 分鐘正式測驗
const MAX_TRIALS = 180; // 保護上限，主要結束條件仍是時間到
const ITEM_VISIBLE_TIME = 1200;
const MIN_NEXT_DELAY = 900;
const MAX_NEXT_DELAY = 1600;
const ITEM_SIZE = 118;
const TEST_PAGE_ROUTE = "/test-map";

const TEST_TYPE_BLOCK = [
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "golden",
  "rotten",
  "rotten",
];

const targetTypes = {
  normal: {
    key: "normal",
    label: "普通橡實",
    img: normalImg,
    intrinsicWidth: 151,
    intrinsicHeight: 194,
    shouldClick: true,
    score: 3,
  },
  golden: {
    key: "golden",
    label: "金色橡實",
    img: goldenImg,
    intrinsicWidth: 166,
    intrinsicHeight: 211,
    shouldClick: true,
    score: 4,
  },
  rotten: {
    key: "rotten",
    label: "壞橡實",
    img: rottenImg,
    intrinsicWidth: 166,
    intrinsicHeight: 201,
    shouldClick: false,
    score: -3,
  },
};

const TestPage_SRT = () => {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("start");
  const [item, setItem] = useState(null);
  const [effect, setEffect] = useState(null);
  const [trialRecords, setTrialRecords] = useState([]);
  const [showDetailedResult, setShowDetailedResult] = useState(false);
  const [idleFlashId, setIdleFlashId] = useState(null);
  const [finalResult, setFinalResult] = useState(null);

  const phaseRef = useRef("start");
  const trialRecordsRef = useRef([]);
  const currentTrialRef = useRef(0);
  const spawnTimeRef = useRef(null);
  const currentItemRef = useRef(null);
  const trialLockedRef = useRef(false);
  const falseClickInCurrentTrialRef = useRef(false);
  const falseClickCountInCurrentTrialRef = useRef(0);
  const repeatedClickCountInCurrentTrialRef = useRef(0);
  const lastBlankClickTimeRef = useRef(null);
  const lastActionTimeRef = useRef(Date.now());
  const consecutiveMissRef = useRef(0);
  const promptedTrialRef = useRef(false);
  const promptTypeRef = useRef(null);
  const promptShownAtRef = useRef(null);
  const promptEventsRef = useRef([]);
  const targetQueueRef = useRef([]);
  const recentTargetTypesRef = useRef([]);
  const finishingRef = useRef(false);
  const testStartedAtRef = useRef(null);
  const completionReasonRef = useRef("time_up");

  const itemTimeoutRef = useRef(null);
  const nextTrialTimeoutRef = useRef(null);
  const effectTimeoutRef = useRef(null);
  const testTimerRef = useRef(null);
  const idleCheckRef = useRef(null);
  const idleFlashTimeoutRef = useRef(null);
  const spawnAnimationFrameRef = useRef(null);
  const introVideoRef = useRef(null);
  const tutorialVideoRef = useRef(null);
  const endingVideoRef = useRef(null);

  const pauseVideo = (videoRef) => {
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
  };

  const pauseAllVideos = () => {
    pauseVideo(introVideoRef);
    pauseVideo(tutorialVideoRef);
    pauseVideo(endingVideoRef);
  };

  const setGamePhase = (nextPhase) => {
    pauseAllVideos();
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  const clearAllTimers = () => {
    if (itemTimeoutRef.current) clearTimeout(itemTimeoutRef.current);
    if (nextTrialTimeoutRef.current) clearTimeout(nextTrialTimeoutRef.current);
    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    if (testTimerRef.current) clearTimeout(testTimerRef.current);
    if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    if (idleFlashTimeoutRef.current) clearTimeout(idleFlashTimeoutRef.current);
    if (spawnAnimationFrameRef.current) cancelAnimationFrame(spawnAnimationFrameRef.current);

    itemTimeoutRef.current = null;
    nextTrialTimeoutRef.current = null;
    effectTimeoutRef.current = null;
    testTimerRef.current = null;
    idleCheckRef.current = null;
    idleFlashTimeoutRef.current = null;
    spawnAnimationFrameRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearAllTimers();
      pauseAllVideos();
    };
    // Cleanup must run only on unmount; video refs always expose their latest nodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetRuntimeState = () => {
    clearAllTimers();
    setItem(null);
    setEffect(null);
    setIdleFlashId(null);
    setTrialRecords([]);
    trialRecordsRef.current = [];
    currentTrialRef.current = 0;
    spawnTimeRef.current = null;
    currentItemRef.current = null;
    trialLockedRef.current = false;
    falseClickInCurrentTrialRef.current = false;
    falseClickCountInCurrentTrialRef.current = 0;
    repeatedClickCountInCurrentTrialRef.current = 0;
    lastBlankClickTimeRef.current = null;
    lastActionTimeRef.current = Date.now();
    consecutiveMissRef.current = 0;
    promptedTrialRef.current = false;
    promptTypeRef.current = null;
    promptShownAtRef.current = null;
    promptEventsRef.current = [];
    targetQueueRef.current = [];
    recentTargetTypesRef.current = [];
    finishingRef.current = false;
    testStartedAtRef.current = null;
    completionReasonRef.current = "time_up";
  };

  const resetTest = () => {
    resetRuntimeState();
    setFinalResult(null);
    const childId = getCurrentChildProfile()?.childId;
    if (childId) localStorage.removeItem(`srtTestResult_${childId}`);
  };

  const addTrialRecord = (record) => {
    const nextRecords = [...trialRecordsRef.current, record];
    trialRecordsRef.current = nextRecords;
    setTrialRecords(nextRecords);
  };

  const shuffleArray = (array) => {
    const next = [...array];

    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
  };

  const getNextTargetType = () => {
    if (targetQueueRef.current.length === 0) {
      let nextBlock = shuffleArray(TEST_TYPE_BLOCK);
      const lastType = recentTargetTypesRef.current.at(-1);

      if (lastType === "rotten" && nextBlock[0] === "rotten") {
        const swapIndex = nextBlock.findIndex((type) => type !== "rotten");
        if (swapIndex > 0) {
          [nextBlock[0], nextBlock[swapIndex]] = [nextBlock[swapIndex], nextBlock[0]];
        }
      }

      targetQueueRef.current = nextBlock;
    }

    const nextType = targetQueueRef.current.shift() || "normal";
    recentTargetTypesRef.current = [...recentTargetTypesRef.current, nextType].slice(-12);

    return nextType;
  };

  const clearCurrentPrompt = () => {
    promptedTrialRef.current = false;
    promptTypeRef.current = null;
    promptShownAtRef.current = null;
  };

  const triggerIdleFlash = (reason = "idle") => {
    if (phaseRef.current !== "playing") return;
    if (idleFlashTimeoutRef.current) return;

    const now = Date.now();
    const currentItem = currentItemRef.current;

    promptEventsRef.current = [
      ...promptEventsRef.current,
      {
        type: "idleFlash",
        reason,
        timestamp: now,
        trialIndex: currentItem?.trialIndex ?? null,
      },
    ];

    if (currentItem && !trialLockedRef.current) {
      promptedTrialRef.current = true;
      promptTypeRef.current = "idleFlash";
      promptShownAtRef.current =
        typeof spawnTimeRef.current === "number"
          ? Math.round(performance.now() - spawnTimeRef.current)
          : null;
    }

    setIdleFlashId(now);

    idleFlashTimeoutRef.current = setTimeout(() => {
      setIdleFlashId(null);
      idleFlashTimeoutRef.current = null;
    }, 900);
  };

  const handleStart = () => {
    resetTest();
    setShowDetailedResult(false);
    setGamePhase("intro");
  };

  const handleIntroEnd = () => {
    setGamePhase("step");
  };

  const handleTutorialVideoEnd = () => {
    startTest();
  };

  const safeParseStorage = (key, fallback = null) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  };

  const getCurrentChildProfile = () => {
    const currentChild = safeParseStorage("currentChild", null);
    const selectedChild = safeParseStorage("selectedChild", null);
    const currentChildId = localStorage.getItem("currentChildId") || localStorage.getItem("selectedChildId");

    const child = currentChild || selectedChild || {};
    return {
      ...child,
      childId: child?.childId || child?.id || currentChildId || null,
      id: child?.id || child?.childId || currentChildId || null,
      name: child?.name || child?.nickname || child?.full_name || "",
      nickname: child?.nickname || child?.name || child?.full_name || "",
    };
  };

  const getCurrentChildId = () => getCurrentChildProfile()?.childId || null;

  const getResultStorageKey = (childId = getCurrentChildId()) =>
    childId ? `srtTestResult_${childId}` : null;

  const buildDataQuality = (records, completionReason) => {
    const validTrialCount = records.length;
    const timeoutCount = records.filter((record) => record.timeout === true).length;
    const invalidClickCount = records.reduce(
      (sum, record) => sum + (Number(record.falseClickCount) || 0),
      0
    );
    const hintCount = records.filter((record) => record.assisted === true).length;
    const timeoutRate = validTrialCount > 0 ? timeoutCount / validTrialCount : 1;
    const invalidClickRate = validTrialCount > 0 ? invalidClickCount / validTrialCount : 0;
    const hintRate = validTrialCount > 0 ? hintCount / validTrialCount : 0;
    const warnings = [];

    if (validTrialCount < 30) warnings.push("有效題數不足");
    if (timeoutRate >= 0.25) warnings.push("逾時比例偏高");
    if (invalidClickRate >= 0.2) warnings.push("背景點擊比例偏高");
    if (hintRate >= 0.2) warnings.push("中性提醒介入比例偏高");
    if (completionReason !== "time_up") warnings.push("測驗未依預定時間正常結束");

    const status =
      validTrialCount < 20 || completionReason === "aborted"
        ? "insufficient"
        : warnings.length > 0
          ? "usable_with_caution"
          : "valid";

    return {
      status,
      validTrialCount,
      timeoutRate: Number(timeoutRate.toFixed(4)),
      invalidClickRate: Number(invalidClickRate.toFixed(4)),
      hintRate: Number(hintRate.toFixed(4)),
      warnings,
    };
  };

  const saveResultToLocalStorage = (resultPayload, childId) => {
    const resultKey = getResultStorageKey(childId);

    try {
      if (resultKey) localStorage.setItem(resultKey, JSON.stringify(resultPayload));
      localStorage.setItem("srtTestResult", JSON.stringify(resultPayload)); // 舊版結果頁相容
    } catch (error) {
      console.error("SRT 本機結果保存失敗：", error);
    }

    return resultKey;
  };

  const buildSrtAiResult = (records, scoring) => {
    const totalTrials = records.length || MAX_TRIALS;
    const correctTrials = records.filter((record) => record.isCorrect === true).length;
    const reactionTimes = records
      .filter((record) => record.action === "hit" && typeof record.reactionTime === "number")
      .map((record) => record.reactionTime);

    const firstHalfRecords = records.slice(0, Math.floor(records.length / 2));
    const secondHalfRecords = records.slice(Math.floor(records.length / 2));

    const getAverageRt = (targetRecords) => {
      const rts = targetRecords
        .filter((record) => record.isCorrect === true && typeof record.reactionTime === "number")
        .map((record) => record.reactionTime);
      if (rts.length === 0) return 0;
      return Math.round(rts.reduce((sum, rt) => sum + rt, 0) / rts.length);
    };

    const firstHalfMiss = firstHalfRecords.filter((record) => record.missed || record.timeout).length;
    const secondHalfMiss = secondHalfRecords.filter((record) => record.missed || record.timeout).length;

    const errorTypes = {
      miss: records.filter((record) => record.missed === true).length,
      randomClick: records.reduce((sum, record) => sum + (Number(record.falseClickCount) || (record.falseClick ? 1 : 0)), 0),
      wrongTarget: records.filter((record) => (record.action === "clickedRotten" || record.action === "falseAlarm")).length,
      repeatedClick: records.reduce((sum, record) => sum + (Number(record.repeatedClickCount) || 0), 0),
      timeout: records.filter((record) => record.timeout === true).length,
      sequenceError: 0,
      ruleSwitchError: 0,
    };

    const performanceResult = analyzePerformance({
      totalTrials,
      correctTrials,
      reactionTimes,
      errorTypes,
      difficulty: "normal",
    });

    const errorResult = analyzeErrors(errorTypes);

    const fatigueLevel = analyzeFatigue({
      firstHalfRT: getAverageRt(firstHalfRecords),
      secondHalfRT: getAverageRt(secondHalfRecords),
      missIncrease: Math.max(0, secondHalfMiss - firstHalfMiss),
    });

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
      mode: "test",
      difficulty: "normal",
      score: scoring?.totalScore ?? performanceResult.accuracy,
      stars: scoring?.stars ?? performanceResult.stars,
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      totalPlayTime: Math.round(TEST_DURATION_MS / 1000),
      errorTypes,
      fatigueLevel,
      attemptCount: 1,
    });

    const goldenTotal = records.filter((record) => record.targetType === "golden").length;
    const goldenHitCount = records.filter(
      (record) => record.targetType === "golden" && record.action === "hit"
    ).length;
    const rottenTotal = records.filter((record) => record.targetType === "rotten").length;
    const clickedRottenCount = records.filter(
      (record) => (record.action === "clickedRotten" || record.action === "falseAlarm")
    ).length;

    return {
      gameResult,
      performanceResult,
      errorResult,
      fatigueLevel,
      recommendedDifficulty,
      errorTypes,
      distractorMetrics: {
        normalTotal: records.filter((record) => record.targetType === "normal").length,
        normalHitCount: records.filter(
          (record) => record.targetType === "normal" && record.action === "hit"
        ).length,
        goldenTotal,
        goldenHitCount,
        goldenHitRate: goldenTotal > 0 ? Math.round((goldenHitCount / goldenTotal) * 100) : null,
        rottenTotal,
        clickedRottenCount,
        rottenFalseAlarmRate: rottenTotal > 0 ? Math.round((clickedRottenCount / rottenTotal) * 100) : null,
        inhibitionAccuracy: rottenTotal > 0 ? Math.round(((rottenTotal - clickedRottenCount) / rottenTotal) * 100) : null,
      },
      promptEvents: promptEventsRef.current,
      parentSummary: performanceResult.parentSummary,
    };
  };

  const finishTest = async (completionReason = completionReasonRef.current || "time_up") => {
    if (finishingRef.current) return;
    if (phaseRef.current === "ending" || phaseRef.current === "result") return;

    const childProfile = getCurrentChildProfile();
    if (!childProfile?.childId) {
      navigate("/child-select", { replace: true });
      return;
    }

    finishingRef.current = true;
    completionReasonRef.current = completionReason;
    clearAllTimers();
    setItem(null);
    setEffect(null);
    setIdleFlashId(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;
    trialLockedRef.current = false;
    falseClickInCurrentTrialRef.current = false;
    clearCurrentPrompt();

    const records = trialRecordsRef.current;
    const scoring = calculateSrtScore(records);
    const aiAnalysis = buildSrtAiResult(records, scoring);
    const finishedAtMs = Date.now();
    const startedAtMs = testStartedAtRef.current || finishedAtMs;
    const durationMs = Math.max(0, finishedAtMs - startedAtMs);
    const startedAt = new Date(startedAtMs).toISOString();
    const finishedAt = new Date(finishedAtMs).toISOString();

    const dataQuality = buildDataQuality(records, completionReason);

    const resultId = `SRT-${childProfile.childId}-${finishedAtMs}`;
    const resultPayload = {
      resultId,
      schemaVersion: "1.0.0",
      taskName: "Simple Reaction Time",
      taskCode: "SRT",
      gameId: "SRT",
      gameName: "橡實反應任務",
      abilityType: "inhibition",
      abilityLabel: "抑制控制",
      mode: "test",
      difficulty: "normal",
      childId: childProfile.childId,
      childName: childProfile.nickname || childProfile.name || "",
      startedAt,
      finishedAt,
      durationMs,
      plannedDurationMs: TEST_DURATION_MS,
      completionReason,
      status: completionReason === "aborted" ? "aborted" : "completed",
      totalTrials: records.length,
      maxTrials: MAX_TRIALS,
      promptEvents: promptEventsRef.current,
      promptCount: promptEventsRef.current.length,
      correctCount: records.filter((record) => record.isCorrect === true).length,
      errorCount: records.filter((record) => record.isCorrect !== true).length,
      score: scoring?.totalScore ?? 0,
      stars: scoring?.stars ?? 0,
      accuracy:
        scoring?.summary?.accuracyPercent ??
        scoring?.parentMetrics?.accuracy ??
        aiAnalysis?.performanceResult?.accuracy ??
        0,
      avgReactionTime:
        scoring?.summary?.avgReactionTime ??
        scoring?.clinicalMetrics?.avgRT ??
        aiAnalysis?.performanceResult?.avgReactionTime ??
        0,
      rtStd: scoring?.summary?.rtStd ?? null,
      rtCV: scoring?.summary?.rtCV ?? null,
      assistedRate: scoring?.summary?.assistedRate ?? 0,
      longAttentionMetrics: scoring?.summary?.longAttentionMetrics ?? null,
      distractorMetrics: aiAnalysis?.distractorMetrics,
      trials: records,
      records,
      metrics: scoring?.summary ?? {},
      summary: scoring?.parentMetrics ?? {},
      scoring,
      analysis: aiAnalysis,
      aiAnalysis,
      dataQuality,
      syncStatus: "pending",
      generatedAt: finishedAt,
    };

    saveResultToLocalStorage(resultPayload, childProfile.childId);
    setFinalResult(resultPayload);

    try {
      await saveUnifiedResult({
        rawResult: resultPayload,
        gameId: "SRT",
        mode: "test",
        difficulty: "normal",
        child: childProfile,
        route: "/test-srt",
        visibleRoles: ["child", "parent", "clinician"],
      });
      resultPayload.syncStatus = "synced";
      saveResultToLocalStorage(resultPayload, childProfile.childId);
      setFinalResult({ ...resultPayload });
    } catch (error) {
      console.error("SRT 雲端同步失敗，結果已保留在本機：", error);
    }

    setGamePhase("ending");
  };

  const handleEndingVideoEnd = () => {
    clearAllTimers();
    setItem(null);
    setEffect(null);
    setGamePhase("result");
  };

  const getRandomDelay = () => Math.round(Math.random() * (MAX_NEXT_DELAY - MIN_NEXT_DELAY) + MIN_NEXT_DELAY);

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

  const getRandomPosition = () => {
    const minX = 18;
    const maxX = 82;
    const minY = 24;
    const maxY = 78;

    return {
      x: Math.random() * (maxX - minX) + minX,
      y: Math.random() * (maxY - minY) + minY,
    };
  };

  const startTest = () => {
    const childProfile = getCurrentChildProfile();
    if (!childProfile?.childId) {
      navigate("/child-select", { replace: true });
      return;
    }

    resetRuntimeState();
    setFinalResult(null);
    testStartedAtRef.current = Date.now();
    setShowDetailedResult(false);

    setGamePhase("playing");

    testTimerRef.current = setTimeout(() => {
      completionReasonRef.current = "time_up";
      finishTest("time_up");
    }, TEST_DURATION_MS);

    idleCheckRef.current = setInterval(() => {
      if (phaseRef.current !== "playing") return;

      const idleDuration = Date.now() - lastActionTimeRef.current;

      if (idleDuration >= 10000) {
        triggerIdleFlash("idle_10s");
        lastActionTimeRef.current = Date.now();
      }
    }, 1000);

    scheduleNextTrial(getRandomDelay());
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

    if (currentTrialRef.current >= MAX_TRIALS) {
      completionReasonRef.current = "safety_limit";
      finishTest("safety_limit");
      return;
    }

    const nextTrial = currentTrialRef.current + 1;
    currentTrialRef.current = nextTrial;

    const position = getRandomPosition();
    const targetType = getNextTargetType();
    const typeConfig = targetTypes[targetType] || targetTypes.normal;

    const newItem = {
      id: `${Date.now()}-${nextTrial}`,
      trialIndex: nextTrial,
      x: position.x,
      y: position.y,
      targetType,
      shouldClick: typeConfig.shouldClick,
      scoreValue: typeConfig.score,
      img: typeConfig.img,
      label: typeConfig.label,
    };

    trialLockedRef.current = false;
    falseClickInCurrentTrialRef.current = false;
    falseClickCountInCurrentTrialRef.current = 0;
    repeatedClickCountInCurrentTrialRef.current = 0;
    lastBlankClickTimeRef.current = null;
    clearCurrentPrompt();
    currentItemRef.current = newItem;
    spawnTimeRef.current = null;

    setItem(newItem);

    spawnAnimationFrameRef.current = requestAnimationFrame(() => {
      spawnAnimationFrameRef.current = null;
      if (phaseRef.current !== "playing") return;
      if (!currentItemRef.current || currentItemRef.current.id !== newItem.id) return;
      if (trialLockedRef.current) return;

      spawnTimeRef.current = performance.now();

      itemTimeoutRef.current = setTimeout(() => {
        handleMissedTrial(newItem);
      }, ITEM_VISIBLE_TIME);
    });
  };

  const handleMissedTrial = (targetItem) => {
    if (phaseRef.current !== "playing") return;
    if (!targetItem) return;
    if (trialLockedRef.current) return;

    if (currentItemRef.current && targetItem.id !== currentItemRef.current.id) return;

    trialLockedRef.current = true;
    itemTimeoutRef.current = null;

    const isNoGo = targetItem.shouldClick === false || targetItem.targetType === "rotten";
    const wasPrompted = promptedTrialRef.current;
    const assistType = promptTypeRef.current;
    const assistShownAt = promptShownAtRef.current;

    addTrialRecord({
      trialIndex: targetItem.trialIndex,
      isCorrect: isNoGo,
      reactionTime: null,
      timeout: !isNoGo,
      missed: !isNoGo,
      falseClick: falseClickInCurrentTrialRef.current,
      falseClickCount: falseClickCountInCurrentTrialRef.current,
      repeatedClickCount: repeatedClickCountInCurrentTrialRef.current,
      targetType: targetItem.targetType || "normal",
      action: isNoGo ? "correctAvoid" : "miss",
      trainingAction: isNoGo ? "correctAvoid" : "miss",
      legacyAction: isNoGo ? "correctReject" : "miss",
      scoreValue: isNoGo ? 1 : 0,
      assisted: wasPrompted,
      assistType: wasPrompted ? assistType : null,
      assistShownAt: wasPrompted ? assistShownAt : null,
      reactionAfterAssist: null,
      positionX: targetItem.x,
      positionY: targetItem.y,
      timestamp: Date.now(),
    });

    if (isNoGo) {
      consecutiveMissRef.current = 0;
    } else {
      consecutiveMissRef.current += 1;
    }

    setItem(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;
    falseClickInCurrentTrialRef.current = false;
    falseClickCountInCurrentTrialRef.current = 0;
    repeatedClickCountInCurrentTrialRef.current = 0;
    lastBlankClickTimeRef.current = null;
    clearCurrentPrompt();

    scheduleNextTrial();
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
    if (itemTimeoutRef.current) {
      clearTimeout(itemTimeoutRef.current);
      itemTimeoutRef.current = null;
    }

    const reactionTime = Math.round(performance.now() - spawnTimeRef.current);
    const isNoGo = targetItem.shouldClick === false || targetItem.targetType === "rotten";
    const wasPrompted = promptedTrialRef.current;
    const assistType = promptTypeRef.current;
    const assistShownAt = promptShownAtRef.current;
    const reactionAfterAssist =
      wasPrompted && typeof assistShownAt === "number"
        ? Math.max(0, reactionTime - assistShownAt)
        : null;

    addTrialRecord({
      trialIndex: targetItem.trialIndex,
      isCorrect: !isNoGo,
      reactionTime,
      timeout: false,
      missed: false,
      falseClick: falseClickInCurrentTrialRef.current,
      falseClickCount: falseClickCountInCurrentTrialRef.current,
      repeatedClickCount: repeatedClickCountInCurrentTrialRef.current,
      targetType: targetItem.targetType || "normal",
      action: isNoGo ? "clickedRotten" : "hit",
      trainingAction: isNoGo ? "clickedRotten" : "hit",
      legacyAction: isNoGo ? "falseAlarm" : "hit",
      clickedRotten: isNoGo,
      scoreValue: targetItem.scoreValue ?? (isNoGo ? -3 : 3),
      assisted: wasPrompted,
      assistType: wasPrompted ? assistType : null,
      assistShownAt: wasPrompted ? assistShownAt : null,
      reactionAfterAssist,
      positionX: targetItem.x,
      positionY: targetItem.y,
      timestamp: Date.now(),
    });

    if (isNoGo) {
      consecutiveMissRef.current += 1;
    } else {
      consecutiveMissRef.current = 0;
    }

    lastActionTimeRef.current = Date.now();

    setEffect({ x: targetItem.x, y: targetItem.y, type: isNoGo ? "penalty" : "correct" });
    setItem(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;
    falseClickInCurrentTrialRef.current = false;
    falseClickCountInCurrentTrialRef.current = 0;
    repeatedClickCountInCurrentTrialRef.current = 0;
    lastBlankClickTimeRef.current = null;
    clearCurrentPrompt();

    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    effectTimeoutRef.current = setTimeout(() => setEffect(null), 360);

    scheduleNextTrial();
  };

  const handleGameAreaClick = () => {
    if (phaseRef.current !== "playing") return;

    lastActionTimeRef.current = Date.now();

    if (!currentItemRef.current) {
      return;
    }

    if (trialLockedRef.current) return;

    const now = performance.now();
    falseClickInCurrentTrialRef.current = true;
    falseClickCountInCurrentTrialRef.current += 1;

    if (lastBlankClickTimeRef.current && now - lastBlankClickTimeRef.current < 260) {
      repeatedClickCountInCurrentTrialRef.current += 1;
    }

    lastBlankClickTimeRef.current = now;
  };

  const score = useMemo(() => trialRecords.filter((record) => record.action === "hit").length, [trialRecords]);

  const rtRecords = useMemo(() => {
    return trialRecords
      .filter((record) => record.isCorrect === true && typeof record.reactionTime === "number")
      .map((record) => record.reactionTime);
  }, [trialRecords]);

  const avgRT = useMemo(() => {
    if (rtRecords.length === 0) return 0;
    return Math.round(rtRecords.reduce((sum, rt) => sum + rt, 0) / rtRecords.length);
  }, [rtRecords]);

  const missCount = useMemo(() => {
    return trialRecords.filter((record) => record.missed === true || record.timeout === true).length;
  }, [trialRecords]);

  const storedResult = useMemo(() => {
    if (finalResult) return finalResult;

    const resultKey = getResultStorageKey();
    return safeParseStorage(
      resultKey,
      safeParseStorage("srtTestResult", null)
    );
    // Storage is intentionally re-read only when the result-view state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, showDetailedResult, finalResult]);

  const resultStars = useMemo(() => {
    try {
      return Math.max(
        1,
        Math.min(3, Number(storedResult?.scoring?.stars ?? storedResult?.stars) || 1)
      );
    } catch (error) {
      return 1;
    }
  }, [storedResult]);

  return (
    <div
      className="srt-test-page"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.22)),
          url(${bgImg})
        `,
      }}
    >
      <style>{testPageCss}</style>

      {phase === "start" && (
        <main className="srt-center-shell srt-start-shell">
          <section className="srt-soft-panel srt-start-panel game-start-card-artwork srt-opening-card-artwork" aria-label="開始畫面">
            <div className="srt-game-title">幫小松鼠撿橡實</div>
            <div className="srt-start-content">
              <div className="srt-dialog-bubble srt-opening-bubble">小松鼠想請你一起找橡實。</div>
              <div className="srt-round-icon srt-start-avatar">
                <img src={startAvatar} width="364" height="364" alt="小松鼠頭像" />
              </div>
            </div>
            <div className="srt-guided-action srt-guided-start">
              <button type="button" className="srt-forest-button srt-image-button srt-btn-start" onClick={handleStart} aria-label="進入遊戲">
                <img src={homeStartBtn} width="532" height="177" alt="進入遊戲" />
              </button>
              <img loading="lazy" className="srt-mouse-guide srt-mouse-on-button" src={mouseImg} width="156" height="156" alt="" aria-hidden="true" />
            </div>
          </section>
        </main>
      )}

      {phase === "intro" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-video-panel game-start-card-artwork srt-video-card-artwork" aria-label="前導動畫">
            <div className="srt-video-frame">
              <video
                ref={introVideoRef}
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
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseImg} width="156" height="156" loading="lazy" alt="" aria-hidden="true" />
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
                ref={tutorialVideoRef}
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
                <button type="button" className="srt-forest-button srt-image-button srt-btn-skip" onClick={startTest} aria-label="跳過動畫">
                  <img src={homeSkipBtn} width="532" height="177" loading="lazy" alt="跳過動畫" />
                </button>
              </div>
              <div className="srt-guided-action srt-guided-next">
                <button type="button" className="srt-forest-button srt-image-button srt-btn-next" onClick={startTest} aria-label="下一步">
                  <img src={homeNextBtn} width="532" height="177" loading="lazy" alt="下一步" />
                </button>
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseImg} width="156" height="156" loading="lazy" alt="" aria-hidden="true" />
              </div>
            </div>
          </section>
        </main>
      )}

      {phase === "playing" && (
        <main className="srt-play-page">
          <div className={`srt-test-game-area ${idleFlashId ? "srt-idle-flash" : ""}`} onClick={handleGameAreaClick}>
            {item && (
              <img loading="lazy"
                src={item.img || normalImg}
                width={item.intrinsicWidth || 151}
                height={item.intrinsicHeight || 194}
                alt={item.label || "橡實"}
                draggable={false}
                className="srt-test-item"
                style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${ITEM_SIZE}px` }}
                onClick={(event) => handleItemClick(event, item)}
              />
            )}

            {effect && <div className={`srt-test-effect ${effect.type === "penalty" ? "is-penalty" : ""}`} style={{ left: `${effect.x}%`, top: `${effect.y}%` }} />}
          </div>
        </main>
      )}

      {phase === "ending" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-video-panel game-start-card-artwork srt-video-card-artwork" aria-label="結束動畫">
            <div className="srt-video-frame">
              <video
                ref={endingVideoRef}
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
            </div>
          </section>
        </main>
      )}

      {phase === "result" && !showDetailedResult && (
        <main className="srt-center-shell srt-result-shell">
          <section className="srt-soft-panel srt-result-panel game-result-card-artwork srt-summary-card-artwork" aria-label="測驗結果">
            <div className="srt-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span key={star} className={`srt-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>
              ))}
            </div>

            <div className="srt-start-content srt-result-content">
              <div className="srt-dialog-bubble">完成了！你有很認真看森林喔。</div>
              <div className="srt-round-icon srt-result-icon">
                <img src={levelIcon} width="340" height="340" loading="lazy" alt="SRT 關卡圖示" />
              </div>
            </div>

            <div className="srt-result-actions">
              <div className="srt-guided-action srt-guided-result-main">
                <button type="button" className="srt-forest-button srt-image-button srt-btn-home" onClick={() => navigate(TEST_PAGE_ROUTE)} aria-label="回到森林">
                  <img src={homeBackBtn} width="532" height="177" loading="lazy" alt="回到森林" />
                </button>
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseImg} width="156" height="156" loading="lazy" alt="" aria-hidden="true" />
              </div>
              <button type="button" className="srt-forest-button srt-image-button srt-btn-detail" onClick={() => setShowDetailedResult(true)} aria-label="詳細結果">
                <img src={homeResultBtn} width="532" height="177" loading="lazy" alt="查看詳細結果" />
              </button>
            </div>
          </section>
        </main>
      )}

      {phase === "result" && showDetailedResult && (
        <SrtResultPage
          mode="test"
          score={storedResult?.score ?? score}
          avgRT={avgRT}
          rtRecords={rtRecords}
          trialRecords={trialRecords}
          totalSpawn={storedResult?.totalTrials ?? (trialRecords.length || MAX_TRIALS)}
          missCount={missCount}
          summaryData={storedResult?.summary ?? {}}
          starResult={storedResult?.scoring ?? null}
          aiAnalysis={storedResult?.aiAnalysis ?? null}
          onBackToMenu={() => navigate(TEST_PAGE_ROUTE)}
        />
      )}
    </div>
  );
};

export default TestPage_SRT;

const testPageCss = `
.srt-test-page {
  min-height: 100vh;
  font-family: "jf-openhuninn", "Fredoka", "Nunito", "Noto Sans TC", sans-serif;
  text-align: center;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color: #4b2c16;
  user-select: none;
  -webkit-user-select: none;
}

.srt-test-page::before {
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

.srt-idle-flash::after {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 32px;
  pointer-events: none;
  z-index: 4;
  box-shadow: inset 0 0 40px rgba(255, 230, 120, 0.64);
  animation: srt-idle-flash 0.9s ease-out forwards;
}

@keyframes srt-idle-flash {
  0% { opacity: 0; }
  35% { opacity: 1; }
  100% { opacity: 0; }
}

.srt-test-item {
  position: absolute;
  height: auto;
  object-fit: contain;
  cursor: pointer;
  transform: translate(-50%, -50%);
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  -webkit-tap-highlight-color: transparent;
  z-index: 2;
  filter: drop-shadow(0 11px 12px rgba(79, 57, 20, 0.24));
  animation: srt-test-item-pop 0.18s ease-out;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.srt-test-item:hover {
  transform: translate(-50%, -50%) scale(1.04);
  filter: drop-shadow(0 13px 15px rgba(79, 57, 20, 0.28)) brightness(1.06);
}

.srt-test-item:active {
  transform: translate(-50%, -50%) scale(0.94);
}

@keyframes srt-test-item-pop {
  from { transform: translate(-50%, -50%) scale(0.72); opacity: 0; }
  to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
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

.srt-test-effect.is-penalty {
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.86) 0 10%, rgba(255, 138, 120, 0.72) 11% 35%, rgba(255, 70, 50, 0.16) 60%, rgba(255, 70, 50, 0) 72%);
  box-shadow:
    0 0 0 7px rgba(255, 108, 87, 0.16),
    0 0 24px rgba(255, 96, 70, 0.52),
    0 0 44px rgba(209, 58, 38, 0.26);
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
  gap: 44px;
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
   Claymorphism visual upgrade: SRT forest test page
   - Keeps existing RWD structure intact.
   - Only enhances depth, glow, shadows, and motion.
   ========================================================= */

.srt-soft-panel {
  border-color: rgba(246, 165, 31, 0.96);
  background:
    radial-gradient(circle at 18% 8%, rgba(255, 255, 255, 0.88) 0 9%, transparent 29%),
    radial-gradient(circle at 84% 18%, rgba(255, 238, 160, 0.58) 0 13%, transparent 34%),
    linear-gradient(145deg, rgba(255, 252, 222, 0.99) 0%, rgba(255, 229, 139, 0.98) 48%, rgba(239, 178, 83, 0.96) 100%);
  box-shadow:
    0 22px 0 rgba(151, 87, 28, 0.18),
    0 36px 62px rgba(66, 44, 15, 0.28),
    0 12px 26px rgba(255, 223, 128, 0.22),
    inset 0 12px 18px rgba(255, 255, 255, 0.72),
    inset 0 2px 0 rgba(255, 255, 255, 0.92),
    inset 0 -18px 24px rgba(139, 77, 22, 0.20),
    inset 0 -42px 72px rgba(119, 75, 21, 0.12);
}

.srt-soft-panel::before {
  border-color: rgba(255, 245, 205, 0.58);
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.50),
    inset 0 -3px 8px rgba(139, 88, 23, 0.12);
}

.srt-soft-panel::after {
  filter:
    drop-shadow(0 4px 2px rgba(60, 105, 27, 0.22))
    drop-shadow(0 10px 10px rgba(88, 57, 19, 0.16));
}

.srt-test-item {
  filter:
    drop-shadow(0 14px 13px rgba(54, 38, 15, 0.34))
    drop-shadow(0 5px 2px rgba(118, 76, 23, 0.18))
    drop-shadow(0 0 15px rgba(255, 219, 75, 0.62))
    drop-shadow(0 0 32px rgba(255, 184, 28, 0.34));
  animation: srt-test-item-pop 0.28s cubic-bezier(0.19, 1.34, 0.32, 1) both;
  transition:
    transform 0.18s cubic-bezier(0.2, 1.25, 0.38, 1),
    filter 0.18s ease;
  will-change: transform, filter;
}

.srt-test-item:hover {
  transform: translate(-50%, -50%) scale(1.075) rotate(-1.5deg);
  filter:
    drop-shadow(0 17px 16px rgba(54, 38, 15, 0.38))
    drop-shadow(0 6px 2px rgba(118, 76, 23, 0.20))
    drop-shadow(0 0 19px rgba(255, 230, 97, 0.78))
    drop-shadow(0 0 42px rgba(255, 190, 34, 0.48))
    brightness(1.08)
    saturate(1.06);
}

.srt-test-item:active {
  transform: translate(-50%, -50%) scale(0.9) rotate(1.5deg);
  filter:
    drop-shadow(0 8px 8px rgba(54, 38, 15, 0.30))
    drop-shadow(0 0 18px rgba(255, 218, 72, 0.58))
    brightness(1.12);
}

@keyframes srt-test-item-pop {
  0% {
    transform: translate(-50%, -50%) scale(0.42) rotate(-7deg);
    opacity: 0;
    filter:
      drop-shadow(0 4px 5px rgba(54, 38, 15, 0.18))
      drop-shadow(0 0 4px rgba(255, 224, 88, 0.12));
  }
  68% {
    transform: translate(-50%, -50%) scale(1.12) rotate(2deg);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
    opacity: 1;
  }
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
  will-change: transform, opacity, filter;
}

.srt-test-effect::before,
.srt-test-effect::after {
  content: "";
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  pointer-events: none;
}

.srt-test-effect::before {
  border: 4px solid rgba(255, 245, 145, 0.70);
  box-shadow:
    0 0 18px rgba(255, 234, 95, 0.72),
    inset 0 0 12px rgba(255, 255, 255, 0.50);
}

.srt-test-effect::after {
  inset: 10px;
  background:
    radial-gradient(circle, rgba(255,255,255,0.86), rgba(255,229,85,0.48) 44%, transparent 70%);
  filter: blur(1px);
}

@keyframes srt-test-effect-pop {
  0% {
    transform: translate(-50%, -50%) scale(0.28);
    opacity: 0;
    filter: blur(0) saturate(1.05);
  }
  18% {
    transform: translate(-50%, -50%) scale(1.08);
    opacity: 1;
    filter: blur(0) saturate(1.22);
  }
  52% {
    transform: translate(-50%, -50%) scale(1.62);
    opacity: 0.78;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.15);
    opacity: 0;
    filter: blur(2px) saturate(1.15);
  }
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
  .srt-test-item,
  .srt-test-effect,
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
  .srt-test-page {
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
    min-height: 590px;
    padding: 84px 22px 40px;
    gap: 34px;
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
    width: 96px !important;
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

`;
