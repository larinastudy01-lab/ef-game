// src/pages/TrainingPage_DPT.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/GamePage_DPT.css";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { saveUnifiedResult } from "../utils/resultManager";
import { calculateDptScore } from "../utils/dptScoring";
import { analyzeDptTraining } from "../ai/dptTrainingAnalyzer";

import backgroundImg from "../asset/DPT_testbackground.png";
import introVideo from "../asset/mp4/DPT_start.mp4";
import stepVideo from "../asset/mp4/DPT_step.mp4";
import endingVideo from "../asset/mp4/DPT_end.mp4";
import startAvatar from "../asset/avatar/fox.png";
import homeStartBtn from "../asset/home/start.png";
import homeNextBtn from "../asset/home/next.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";

import catImg from "../asset/DPT/cat.png";
import dogImg from "../asset/DPT/dog.png";
import catSound from "../asset/DPT/cat.mp3";
import dogSound from "../asset/DPT/dog.mp3";

const RESULT_ROUTE = "/result-dpt";
const FOREST_ROUTE = "/game-menu";
const DIFFICULTY_CONFIG = {
  easy: { label: "簡單", totalTrials: 8, answerTimeLimit: 5000, preSoundDelay: 600, hintDelay1: 2200, hintDelay2: 3400, hintLevel: "direct", allowReplay: true, maxSameRun: 2 },
  normal: { label: "普通", totalTrials: 12, answerTimeLimit: 4000, preSoundDelay: 500, hintDelay1: 2600, hintDelay2: null, hintLevel: "neutral", allowReplay: true, maxSameRun: 2 },
  hard: { label: "困難", totalTrials: 16, answerTimeLimit: 3200, preSoundDelay: 350, hintDelay1: 2500, hintDelay2: null, hintLevel: "attentionOnly", allowReplay: false, maxSameRun: 3 },
};
const FEEDBACK_TIME = 420;
const NEXT_TRIAL_DELAY = 260;
const ANTICIPATION_RT = 150;
const TASK_VERSION = "audio-visual-opposite-v2";
const SCORING_VERSION = "2.0.0";
const DPT_DIFFICULTY_KEY = "dptTrainingDifficulty";
const DPT_SELECTED_LEVEL_KEY = "dptSelectedTrainingLevel";

const asset = {
  background: backgroundImg,
  introVideo,
  stepVideo,
  endingVideo,
  startAvatar,
  homeStartBtn,
  homeNextBtn,
  homeSkipBtn,
  homeBackBtn,
  homeAgainBtn,
  homeResultBtn,
  mouseGuideImg,
  cat: catImg,
  dog: dogImg,
  catSound,
  dogSound,
};

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function averageRt(records) {
  const values = records
    .filter((record) => record.isCorrect && !record.isAnticipation)
    .map((record) => record.reactionTime)
    .filter(Number.isFinite);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function normalizeDifficulty(value) {
  if (value === "simple") return "easy";
  if (value === "medium") return "normal";
  if (value === "difficult") return "hard";
  return DIFFICULTY_CONFIG[value] ? value : "normal";
}
function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getInitialDifficulty() {
  try {
    const selected =
      safeJsonParse(localStorage.getItem(DPT_SELECTED_LEVEL_KEY)) ||
      safeJsonParse(localStorage.getItem("selectedTrainingLevel"));

    return normalizeDifficulty(
      selected?.difficulty ||
        localStorage.getItem(DPT_DIFFICULTY_KEY) ||
        localStorage.getItem("trainingDifficulty") ||
        "normal"
    );
  } catch {
    return "normal";
  }
}

function resolveCurrentChildId() {
  try {
    const directKeys = [
      "currentChildId",
      "selectedChildId",
      "activeChildId",
      "childId",
      "efGameCurrentChildId",
      "ef_game_current_child_id",
    ];

    for (const key of directKeys) {
      const value = localStorage.getItem(key);
      if (value && value !== "null" && value !== "undefined") return String(value);
    }

    const objectKeys = [
      "currentChild",
      "selectedChild",
      "activeChild",
      "childProfile",
      "efGameSelectedChild",
      "ef_game_selected_child",
      "parentSelectedChild",
    ];

    for (const key of objectKeys) {
      const value = safeJsonParse(localStorage.getItem(key));
      const id = value?.childId || value?.id || value?.studentId || value?.profileId;
      if (id) return String(id);
    }
  } catch {}

  return null;
}

function getPreviousDptAnalysis(childId = resolveCurrentChildId()) {
  try {
    const possibleKeys = childId
      ? [`dptTrainingResult_${childId}`, `latestDptResult_${childId}`, "dptTrainingResult", "latestDptResult"]
      : ["dptTrainingResult_unassigned", "dptTrainingResult", "latestDptResult"];

    for (const key of possibleKeys) {
      const previousResult = safeJsonParse(localStorage.getItem(key));
      if (previousResult?.aiAnalysis) return previousResult.aiAnalysis;
    }
  } catch {}

  return null;
}

function hasLimitedRun(trials, field, maxSameRun) {
  let runValue = null;
  let runLength = 0;

  for (const trial of trials) {
    if (trial[field] === runValue) {
      runLength += 1;
    } else {
      runValue = trial[field];
      runLength = 1;
    }

    if (runLength > maxSameRun) return false;
  }

  return true;
}

function arrangeTrialsWithRunLimit(trials, maxSameRun) {
  let best = shuffleArray(trials);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const candidate = shuffleArray(trials);
    const soundOk = hasLimitedRun(candidate, "soundType", maxSameRun);
    const positionOk = hasLimitedRun(candidate, "correctPosition", maxSameRun);

    if (soundOk && positionOk) return candidate;

    let score = 0;
    ["soundType", "correctPosition"].forEach((field) => {
      let runValue = null;
      let runLength = 0;
      candidate.forEach((trial) => {
        if (trial[field] === runValue) {
          runLength += 1;
          if (runLength > maxSameRun) score += runLength - maxSameRun;
        } else {
          runValue = trial[field];
          runLength = 1;
        }
      });
    });

    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function buildTrials(difficultyKey) {
  const config = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.normal;
  const combinations = [
    { soundType: "cat", correctTarget: "dog", correctPosition: "left" },
    { soundType: "cat", correctTarget: "dog", correctPosition: "right" },
    { soundType: "dog", correctTarget: "cat", correctPosition: "left" },
    { soundType: "dog", correctTarget: "cat", correctPosition: "right" },
  ];

  const repeatCount = Math.ceil(config.totalTrials / combinations.length);
  const baseTrials = combinations
    .flatMap((combination) =>
      Array.from({ length: repeatCount }, () => ({ ...combination }))
    )
    .slice(0, config.totalTrials);

  return arrangeTrialsWithRunLimit(baseTrials, config.maxSameRun).map((trial, index) => {
    const catPosition = trial.correctTarget === "cat"
      ? trial.correctPosition
      : trial.correctPosition === "left" ? "right" : "left";
    const dogPosition = catPosition === "left" ? "right" : "left";

    return {
      ...trial,
      trialIndex: index + 1,
      catPosition,
      dogPosition,
      soundSrc: trial.soundType === "cat" ? asset.catSound : asset.dogSound,
    };
  });
}

export default function TrainingPage_DPT() {
  const navigate = useNavigate();
  const [difficultyKey] = useState(getInitialDifficulty);
  const difficulty = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.normal;
  const trials = useMemo(() => buildTrials(difficultyKey), [difficultyKey]);
  const [phase, setPhase] = useState("start");
  const [trialIndex, setTrialIndex] = useState(0);
  const [canAnswer, setCanAnswer] = useState(false);
  const [isPreparingSound, setIsPreparingSound] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [hintType, setHintType] = useState(null);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [trialRecords, setTrialRecords] = useState([]);
  const [pendingResult, setPendingResult] = useState(null);

  const timeoutRefs = useRef([]);
  const audioRef = useRef(null);
  const probeStartTimeRef = useRef(null);
  const answeredRef = useRef(false);
  const finishingRef = useRef(false);
  const trialIndexRef = useRef(0);
  const trialRecordsRef = useRef([]);
  const randomClickCountRef = useRef(0);
  const prematureClickCountRef = useRef(0);
  const repeatedClickCountRef = useRef(0);
  const lastPointerTimeRef = useRef(0);
  const audioFallbackRef = useRef(false);

  const currentTrial = trials[trialIndex];

  useEffect(() => { trialIndexRef.current = trialIndex; }, [trialIndex]);
  useEffect(() => { trialRecordsRef.current = trialRecords; }, [trialRecords]);

  function addTimeout(callback, delay) {
    const id = window.setTimeout(() => {
      timeoutRefs.current = timeoutRefs.current.filter((value) => value !== id);
      callback();
    }, delay);
    timeoutRefs.current.push(id);
    return id;
  }

  function stopAudio() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.onplaying = null;
    audioRef.current.onerror = null;
    audioRef.current = null;
  }

  function clearCurrentTimer() {
    timeoutRefs.current.forEach(window.clearTimeout);
    timeoutRefs.current = [];
    stopAudio();
  }

  useEffect(() => () => clearCurrentTimer(), []);

  function resetTestState() {
    clearCurrentTimer();
    setPendingResult(null);
    setTrialIndex(0);
    setTrialRecords([]);
    setCanAnswer(false);
    setIsPreparingSound(false);
    setAudioError(false);
    setHintType(null);
    setFeedbackTarget(null);
    trialIndexRef.current = 0;
    trialRecordsRef.current = [];
    randomClickCountRef.current = 0;
    prematureClickCountRef.current = 0;
    repeatedClickCountRef.current = 0;
    lastPointerTimeRef.current = 0;
    audioFallbackRef.current = false;
    answeredRef.current = false;
    finishingRef.current = false;
    probeStartTimeRef.current = null;
  }

  function handleStart() {
    resetTestState();
    setPhase("introVideo");
  }

  function handleIntroEnd() {
    clearCurrentTimer();
    setPhase("teaching");
  }

  function startTest() {
    resetTestState();
    setPhase("playing");
    addTimeout(() => startTrial(0), 0);
  }

  function handleStagePointerDown(event) {
    if (phase !== "playing") return;
    const now = performance.now();
    if (lastPointerTimeRef.current && now - lastPointerTimeRef.current < 250) {
      repeatedClickCountRef.current += 1;
    }
    lastPointerTimeRef.current = now;
    const answerZone = event.target.closest("[data-answer-zone='true']");
    if (!answerZone) randomClickCountRef.current += 1;
    else if (!canAnswer) prematureClickCountRef.current += 1;
  }

  function startTrial(index) {
    clearCurrentTimer();
    answeredRef.current = false;
    probeStartTimeRef.current = null;
    setCanAnswer(false);
    setAudioError(false);
    setHintType(null);
    setFeedbackTarget(null);
    setIsPreparingSound(true);
    audioFallbackRef.current = false;
    addTimeout(() => playTrialSound(index), difficulty.preSoundDelay);
  }

  function openAnswerWindow(index, { audioFallback = false } = {}) {
    if (answeredRef.current || trialIndexRef.current !== index) return;

    audioFallbackRef.current = audioFallback;
    probeStartTimeRef.current = performance.now();
    setIsPreparingSound(false);
    setAudioError(audioFallback);
    setCanAnswer(true);
    setHintType(audioFallback ? "direct" : null);

    if (!audioFallback && difficulty.hintDelay1 != null) addTimeout(() => {
      if (!answeredRef.current && trialIndexRef.current === index) setHintType(difficulty.hintLevel === "direct" ? "neutral" : difficulty.hintLevel);
    }, difficulty.hintDelay1);
    if (!audioFallback && difficulty.hintDelay2 != null) addTimeout(() => {
      if (!answeredRef.current && trialIndexRef.current === index) setHintType("direct");
    }, difficulty.hintDelay2);
    addTimeout(() => {
      if (!answeredRef.current && trialIndexRef.current === index) handleTimeout(index);
    }, difficulty.answerTimeLimit);
  }

  function handleAudioPlaybackFailure(index) {
    if (answeredRef.current || trialIndexRef.current !== index) return;
    stopAudio();
    setIsPreparingSound(false);
    setAudioError(true);
    setCanAnswer(false);
    addTimeout(() => openAnswerWindow(index, { audioFallback: true }), 450);
  }

  function playTrialSound(index) {
    const trial = trials[index];
    if (!trial || answeredRef.current || trialIndexRef.current !== index) return;
    stopAudio();
    const audio = new Audio(trial.soundSrc);
    audio.preload = "auto";
    audioRef.current = audio;
    audio.onplaying = () => openAnswerWindow(index);
    audio.onerror = () => handleAudioPlaybackFailure(index);
    audio.play().catch(() => handleAudioPlaybackFailure(index));
  }

  function retryCurrentSound() {
    if (!audioError || answeredRef.current) return;
    clearCurrentTimer();
    audioFallbackRef.current = false;
    probeStartTimeRef.current = null;
    setCanAnswer(false);
    setHintType(null);
    setFeedbackTarget(null);
    setAudioError(false);
    setIsPreparingSound(true);
    playTrialSound(trialIndexRef.current);
  }

  function buildRecord({ trial, selectedTarget, selectedPosition, reactionTime, timeout }) {
    const targetCorrect = !timeout && selectedTarget === trial.correctTarget;
    const isAnticipation = Number.isFinite(reactionTime) && reactionTime < ANTICIPATION_RT;
    const isCorrect = targetCorrect && !isAnticipation;
    return {
      trialIndex: trial.trialIndex,
      mode: "training",
      difficulty: difficultyKey,
      difficultyKey,
      taskVersion: TASK_VERSION,
      soundType: trial.soundType,
      expectedTarget: trial.correctTarget,
      selectedTarget,
      correctPosition: trial.correctPosition,
      selectedPosition,
      catPosition: trial.catPosition,
      dogPosition: trial.dogPosition,
      targetCorrect,
      isAnticipation,
      isCorrect,
      reactionTime,
      timeout,
      audioPlaybackFailed: audioFallbackRef.current,
      technicalFallback: audioFallbackRef.current ? "directVisualHint" : null,
      errorType: timeout ? "miss" : isAnticipation ? "anticipation" : targetCorrect ? null : "sameAnimalError",
      // 暫時保留舊計分器相容欄位
      condition: trial.soundType,
      isIncongruent: true,
      correctSide: trial.correctPosition,
      clickedSide: selectedPosition,
      targetSide: trial.correctPosition,
      timestamp: new Date().toISOString(),
    };
  }

  function handleAnswer(selectedTarget, selectedPosition) {
    if (!canAnswer || answeredRef.current || phase !== "playing") return;
    answeredRef.current = true;
    clearCurrentTimer();
    const index = trialIndexRef.current;
    const trial = trials[index];
    if (!trial) return;
    const reactionTime = Number.isFinite(probeStartTimeRef.current)
      ? Math.round(performance.now() - probeStartTimeRef.current)
      : null;
    const record = buildRecord({ trial, selectedTarget, selectedPosition, reactionTime, timeout: false });
    const updated = [...trialRecordsRef.current, record];
    trialRecordsRef.current = updated;
    setTrialRecords(updated);
    setCanAnswer(false);
    setFeedbackTarget(record.isCorrect ? selectedTarget : trial.correctTarget);
    addTimeout(() => goNextTrial(updated, index), FEEDBACK_TIME);
  }

  function handleTimeout(index) {
    if (answeredRef.current || trialIndexRef.current !== index) return;
    answeredRef.current = true;
    clearCurrentTimer();
    const trial = trials[index];
    if (!trial) return;
    const record = buildRecord({ trial, selectedTarget: null, selectedPosition: null, reactionTime: null, timeout: true });
    const updated = [...trialRecordsRef.current, record];
    trialRecordsRef.current = updated;
    setTrialRecords(updated);
    setCanAnswer(false);
    setFeedbackTarget(trial.correctTarget);
    addTimeout(() => goNextTrial(updated, index), FEEDBACK_TIME);
  }

  function goNextTrial(records, currentIndex) {
    clearCurrentTimer();
    setCanAnswer(false);
    setAudioError(false);
    setIsPreparingSound(false);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= trials.length) {
      finishTraining(records);
      return;
    }
    trialIndexRef.current = nextIndex;
    setTrialIndex(nextIndex);
    addTimeout(() => startTrial(nextIndex), NEXT_TRIAL_DELAY);
  }

  function safeScoring(records) {
    try {
      return calculateDptScore(records, {
        mode: "training",
        difficulty: difficultyKey,
        plannedTotalRounds: trials.length,
      }) || {};
    } catch (error) {
      console.error("DPT 訓練評分失敗：", error);
      return {};
    }
  }

  function finishTraining(records) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearCurrentTimer();

    const recordsWithMeta = records.map((record, index) => index === 0 ? {
      ...record,
      randomClickCount: randomClickCountRef.current,
      prematureClickCount: prematureClickCountRef.current,
      repeatedClickCount: repeatedClickCountRef.current,
    } : record);

    const totalTrials = recordsWithMeta.length;
    const correctCount = recordsWithMeta.filter((record) => record.isCorrect).length;
    const timeoutCount = recordsWithMeta.filter((record) => record.timeout).length;
    const wrongCount = totalTrials - correctCount - timeoutCount;
    const accuracy = percent(correctCount, totalTrials);
    const avgReactionTime = averageRt(recordsWithMeta);
    const catRecords = recordsWithMeta.filter((record) => record.soundType === "cat");
    const dogRecords = recordsWithMeta.filter((record) => record.soundType === "dog");
    const sameAnimalErrorCount = recordsWithMeta.filter((record) => record.errorType === "sameAnimalError").length;
    const anticipationCount = recordsWithMeta.filter((record) => record.errorType === "anticipation").length;
    const firstHalf = recordsWithMeta.slice(0, Math.ceil(totalTrials / 2));
    const secondHalf = recordsWithMeta.slice(Math.ceil(totalTrials / 2));
    const firstHalfAccuracy = percent(firstHalf.filter((record) => record.isCorrect).length, firstHalf.length);
    const secondHalfAccuracy = percent(secondHalf.filter((record) => record.isCorrect).length, secondHalf.length);
    const attentionDrop = Math.max(firstHalfAccuracy - secondHalfAccuracy, 0);

    const errorTypes = {
      miss: timeoutCount,
      timeout: timeoutCount,
      sameAnimalError: sameAnimalErrorCount,
      wrongTarget: sameAnimalErrorCount,
      anticipation: anticipationCount,
      randomClick: randomClickCountRef.current,
      prematureClick: prematureClickCountRef.current,
      repeatedClick: repeatedClickCountRef.current,
      distractorError: 0,
      incongruentError: 0,
      sequenceError: 0,
      ruleSwitchError: 0,
    };

    const dptScoring = safeScoring(recordsWithMeta);
    let performanceResult = {};
    let errorResult = {};
    let fatigueResult = {};
    let recommendedDifficulty = "normal";

    try {
      performanceResult = analyzePerformance({
        totalTrials,
        correctTrials: correctCount,
        reactionTimes: recordsWithMeta.map((r) => r.reactionTime).filter(Number.isFinite),
        errorTypes,
        difficulty: difficultyKey,
      }) || {};
    } catch {}
    try { errorResult = analyzeErrors(errorTypes) || {}; } catch {}
    try {
      fatigueResult = analyzeFatigue({
        firstHalfRT: averageRt(firstHalf) || 0,
        secondHalfRT: averageRt(secondHalf) || 0,
        missIncrease: Math.max(secondHalf.filter((r) => r.timeout).length - firstHalf.filter((r) => r.timeout).length, 0),
      }) || {};
    } catch {}

    const fatigueLevel = fatigueResult?.fatigueLevel || "low";
    try {
      recommendedDifficulty = getRecommendedDifficulty({
        accuracy: performanceResult.accuracy ?? accuracy,
        avgReactionTime: performanceResult.avgReactionTime ?? avgReactionTime,
        errorTypes,
        fatigueLevel,
      });
    } catch {}

    const childId = resolveCurrentChildId();
    const previousAnalysis = getPreviousDptAnalysis(childId);

    let dptAiAnalysis = {};
    try {
      dptAiAnalysis = analyzeDptTraining({
        records: recordsWithMeta,
        difficultyKey,
        randomClickCount: randomClickCountRef.current,
        prematureClickCount: prematureClickCountRef.current,
        repeatedClickCount: repeatedClickCountRef.current,
        plannedTotalRounds: trials.length,
        previousAnalysis,
        requireRepeatedUpgrade: true,
        requireRepeatedDowngrade: false,
      }) || {};
    } catch (error) {
      console.error("DPT 訓練分析失敗：", error);
    }

    const scoringSummary = dptScoring.summary || {};
    const scoringParentView = dptScoring.parentView || {};
    const scoringClinicalView = dptScoring.clinicalView || {};
    const finalRecommendedDifficulty =
      dptAiAnalysis.recommendedDifficulty ||
      recommendedDifficulty ||
      difficultyKey;
    const stars = Number(dptScoring.stars) || (accuracy >= 85 ? 3 : accuracy >= 65 ? 2 : 1);
    const totalScore = Number.isFinite(Number(dptScoring.totalScore))
      ? Number(dptScoring.totalScore)
      : accuracy;
    const finishedAt = new Date().toISOString();

    const result = {
      taskName: "聽聲音選相反動物訓練",
      taskCode: "DPT",
      taskVersion: TASK_VERSION,
      taskRule: "catSoundSelectDog_dogSoundSelectCat",
      scoringVersion: dptScoring.scoringVersion || SCORING_VERSION,
      gameId: "DPT",
      abilityType: "attention_control",
      mode: "training",
      difficulty: difficultyKey,
      difficultyKey,
      difficultyLabel: dptScoring.difficultyLabel || difficulty.label,
      expectedTrials: trials.length,
      resultViews: ["child", "parent", "clinician"],
      resultSource: "dptScoring",
      childId: childId || null,
      isFinalized: true,

      // 頂層摘要與正式評分器一致，方便結果頁與醫療端直接取用。
      totalTrials: scoringSummary.totalTrials ?? totalTrials,
      completionRate: scoringSummary.completionRate ?? percent(totalTrials, trials.length),
      correctCount: scoringSummary.correctCount ?? correctCount,
      wrongCount: scoringSummary.wrongCount ?? wrongCount,
      timeoutCount: scoringSummary.timeoutCount ?? timeoutCount,
      anticipationCount: scoringSummary.anticipationCount ?? anticipationCount,
      sameAnimalErrorCount: scoringSummary.sameAnimalErrorCount ?? sameAnimalErrorCount,
      accuracy: scoringSummary.accuracyPercent ?? accuracy,
      accuracyPercent: scoringSummary.accuracyPercent ?? accuracy,
      timeoutRate: scoringSummary.timeoutRate ?? percent(timeoutCount, totalTrials),
      anticipationRate: scoringSummary.anticipationRate ?? percent(anticipationCount, totalTrials),
      sameAnimalErrorRate: scoringSummary.sameAnimalErrorRate ?? percent(sameAnimalErrorCount, totalTrials),
      avgReactionTime: scoringSummary.avgReactionTime ?? avgReactionTime,
      medianReactionTime: scoringSummary.medianReactionTime ?? null,
      reactionTimeStd: scoringSummary.rtStd ?? null,
      reactionTimeCv: scoringSummary.rtCv ?? null,
      catSoundAccuracy: scoringSummary.catSoundAccuracy ?? percent(catRecords.filter((r) => r.isCorrect).length, catRecords.length),
      dogSoundAccuracy: scoringSummary.dogSoundAccuracy ?? percent(dogRecords.filter((r) => r.isCorrect).length, dogRecords.length),
      leftAccuracy: scoringSummary.leftAccuracy ?? 0,
      rightAccuracy: scoringSummary.rightAccuracy ?? 0,
      firstHalfAccuracy: scoringSummary.firstHalfAccuracy ?? firstHalfAccuracy,
      secondHalfAccuracy: scoringSummary.secondHalfAccuracy ?? secondHalfAccuracy,
      attentionDrop: scoringSummary.attentionDrop ?? attentionDrop,

      errorTypes,
      fatigueLevel,
      recommendedDifficulty: finalRecommendedDifficulty,
      aiSuggestion: finalRecommendedDifficulty,
      aiScore: dptAiAnalysis.aiScore ?? null,
      aiAnalysis: dptAiAnalysis,
      recommendedHintLevel: dptAiAnalysis.recommendedHintLevel || difficulty.hintLevel,
      nextRoundConfig: dptAiAnalysis.nextRoundConfig || null,

      scoring: dptScoring,
      clinicalView: scoringClinicalView,
      parentView: scoringParentView,
      childView: dptScoring.childView || null,
      totalScore,
      score: totalScore,
      stars,
      performanceLevel: dptScoring.performanceLevel || (stars >= 3 ? "good" : stars >= 2 ? "developing" : "needs_support"),
      suggestedAction:
        dptAiAnalysis.suggestedAction ||
        performanceResult.suggestedAction ||
        "建議維持目前難度，繼續練習聽完聲音後再選擇相反動物。",
      parentSummary:
        dptAiAnalysis.parentSummary ||
        dptAiAnalysis.parentView?.plainLanguageSummary ||
        scoringParentView.plainLanguageSummary ||
        scoringParentView.summary ||
        performanceResult.parentSummary ||
        "",
      warningLevel: errorResult.warningLevel || "none",

      // 保留通用分析，供既有儀表板相容；正式評分與難度建議分別以 scoring、aiAnalysis 為準。
      performance: performanceResult,
      errorAnalysis: errorResult,
      fatigueAnalysis: fatigueResult,
      records: recordsWithMeta,
      startedFrom: "TrainingPage_DPT",
      finishedAt,
      generatedAt: dptScoring.generatedAt || dptAiAnalysis.generatedAt || finishedAt,
    };

    try {
      saveUnifiedResult({
        rawResult: result,
        gameId: "DPT",
        mode: "training",
        difficulty: difficultyKey,
        route: "/training-dpt",
        visibleRoles: ["child", "parent", "clinician"],
      });
    } catch {}

    try {
      localStorage.setItem("dptTrainingResult", JSON.stringify(result));
      localStorage.setItem("latestDptResult", JSON.stringify(result));
      if (childId) {
        localStorage.setItem(`dptTrainingResult_${childId}`, JSON.stringify(result));
        localStorage.setItem(`latestDptResult_${childId}`, JSON.stringify(result));
      } else {
        localStorage.setItem("dptTrainingResult_unassigned", JSON.stringify(result));
      }
      localStorage.setItem("latestDptResultMode", "training");
      localStorage.setItem("latestDptResultVersion", TASK_VERSION);
      localStorage.setItem(DPT_DIFFICULTY_KEY, finalRecommendedDifficulty);
      localStorage.setItem(
        DPT_SELECTED_LEVEL_KEY,
        JSON.stringify({
          gameId: "DPT",
          difficulty: finalRecommendedDifficulty,
          hintLevel: dptAiAnalysis.recommendedHintLevel || difficulty.hintLevel,
          source: "DPTTrainingAnalyzer",
          taskVersion: TASK_VERSION,
          updatedAt: finishedAt,
        })
      );
    } catch (error) {
      console.error("儲存 DPT 訓練結果失敗：", error);
    }

    setPendingResult(result);
    setPhase("endingVideo");
  }

  function goResultPage() {
    if (!pendingResult) return;
    navigate(RESULT_ROUTE, { state: pendingResult, replace: true });
  }

  function handleEndingVideoEnd() { setPhase("result"); }
  function handleReplay() { resetTestState(); setPhase("introVideo"); }

  const resultStars = Math.max(
    1,
    Math.min(
      3,
      Number(pendingResult?.scoring?.stars) ||
        Number(pendingResult?.stars) ||
        1
    )
  );

  if (phase === "start") {
    return (
      <div className="dpt-page dpt-page--soft" style={{ "--dpt-bg": `url(${asset.background})` }}>
        <style>{dptInlineCss}</style>
        <main className="dpt-center-shell dpt-start-shell">
          <section className="dpt-soft-panel dpt-start-panel" aria-label="開始畫面">
            <div className="dpt-game-title">聽聲音找動物訓練</div>
            <div className="dpt-start-content">
              <div className="dpt-dialog-bubble dpt-opening-bubble">貓叫要點狗狗，狗叫要點貓咪喔！一起來練習吧！</div>
              <div className="dpt-round-icon dpt-start-avatar"><img src={asset.startAvatar} alt="開始角色" draggable="false" /></div>
            </div>
            <div className="dpt-guided-action dpt-guided-start">
              <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-start" onClick={handleStart} aria-label="進入遊戲">
                <img src={asset.homeStartBtn} alt="進入遊戲" draggable="false" />
              </button>
              <img className="dpt-mouse-guide dpt-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "introVideo" || phase === "teaching" || phase === "endingVideo") {
    const isIntro = phase === "introVideo";
    const isTeaching = phase === "teaching";
    const videoSrc = isIntro ? asset.introVideo : isTeaching ? asset.stepVideo : asset.endingVideo;
    const onEnded = isIntro ? handleIntroEnd : isTeaching ? undefined : handleEndingVideoEnd;
    const onAction = isIntro ? handleIntroEnd : isTeaching ? startTest : handleEndingVideoEnd;
    const actionImage = isTeaching ? asset.homeNextBtn : asset.homeSkipBtn;
    const actionButtonClass = isTeaching ? "dpt-btn-next" : "dpt-btn-skip";
    const actionLabel = isTeaching ? "下一步" : "跳過動畫";
    return (
      <div className="dpt-page dpt-page--soft" style={{ "--dpt-bg": `url(${asset.background})` }}>
        <style>{dptInlineCss}</style>
        <main className="dpt-center-shell">
          <section className="dpt-soft-panel dpt-video-panel" aria-label="遊戲影片">
            <div className="dpt-video-frame">
              <video className="dpt-video" src={videoSrc} autoPlay muted playsInline controls={false} preload="auto" onEnded={onEnded}>你的瀏覽器不支援影片播放。</video>
            </div>
            <div className="dpt-guided-action dpt-guided-next">
              <button type="button" className={`dpt-forest-button dpt-image-button ${actionButtonClass}`} onClick={onAction} aria-label={actionLabel}>
                <img src={actionImage} alt={actionLabel} draggable="false" />
              </button>
              <img className="dpt-mouse-guide dpt-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="dpt-page dpt-page--soft" style={{ "--dpt-bg": `url(${asset.background})` }}>
        <style>{dptInlineCss}</style>
        <main className="dpt-center-shell dpt-result-shell">
          <section className="dpt-soft-panel dpt-result-panel" aria-label="測驗結果">
            <div className="dpt-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1,2,3].map((star) => <span key={star} className={`dpt-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>)}
            </div>
            <div className="dpt-start-content dpt-result-content">
              <div className="dpt-dialog-bubble">關卡完成！你很認真聽聲音並找到相反的動物。</div>
              <div className="dpt-round-icon dpt-result-icon"><img src={asset.startAvatar} alt="狐狸角色" draggable="false" /></div>
            </div>
            <div className="dpt-result-actions">
              <div className="dpt-guided-action dpt-guided-result-main">
                <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-home" onClick={() => navigate(FOREST_ROUTE)} aria-label="回到森林">
                  <img src={asset.homeBackBtn} alt="回到森林" draggable="false" />
                </button>
                <img className="dpt-mouse-guide dpt-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
              </div>
              <button type="button" className="dpt-forest-button dpt-image-button" onClick={handleReplay} aria-label="再玩一次"><img src={asset.homeAgainBtn} alt="再玩一次" draggable="false" /></button>
              <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-detail" onClick={goResultPage} aria-label="詳細結果">
                <img src={asset.homeResultBtn} alt="詳細結果" draggable="false" />
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const leftTarget = currentTrial?.catPosition === "left" ? "cat" : "dog";
  const rightTarget = leftTarget === "cat" ? "dog" : "cat";

  return (
    <div className="dpt-page dpt-page--soft" style={{ "--dpt-bg": `url(${asset.background})` }}>
      <style>{dptInlineCss}</style>
      <div className="dpt-container">
        <div className="dpt-stage" onPointerDownCapture={handleStagePointerDown}>
          <div className="dpt-listen-status" aria-live="polite">
            {audioError ? "聲音沒有成功播放，請依提示選擇或重新播放" : isPreparingSound ? "請準備聽聲音" : canAnswer ? "請選擇相反的動物" : "請稍候"}
          </div>
          <div className="dpt-animal-choice-row" aria-label="選擇動物">
            <button type="button" className={`dpt-animal-choice ${canAnswer ? "is-clickable" : ""} ${hintType === "neutral" ? "is-neutral-hint" : ""} ${hintType === "direct" && leftTarget === currentTrial?.correctTarget ? "is-direct-hint" : ""} ${feedbackTarget === leftTarget ? "is-feedback" : ""}`} onClick={() => handleAnswer(leftTarget, "left")} data-answer-zone="true" aria-disabled={!canAnswer}>
              <img src={leftTarget === "cat" ? asset.cat : asset.dog} alt={leftTarget === "cat" ? "貓咪" : "狗狗"} draggable="false" />
            </button>
            <button type="button" className={`dpt-animal-choice ${canAnswer ? "is-clickable" : ""} ${hintType === "neutral" ? "is-neutral-hint" : ""} ${hintType === "direct" && rightTarget === currentTrial?.correctTarget ? "is-direct-hint" : ""} ${feedbackTarget === rightTarget ? "is-feedback" : ""}`} onClick={() => handleAnswer(rightTarget, "right")} data-answer-zone="true" aria-disabled={!canAnswer}>
              <img src={rightTarget === "cat" ? asset.cat : asset.dog} alt={rightTarget === "cat" ? "貓咪" : "狗狗"} draggable="false" />
            </button>
          </div>
          {audioError && <button type="button" className="dpt-retry-audio" onClick={retryCurrentSound}>重新播放聲音</button>}
        </div>
      </div>
    </div>
  );
}

const dptInlineCss = `
.dpt-page,
.dpt-page *,
.dpt-forest-button,
.dpt-image-button,
.dpt-arrow-button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.dpt-page--soft {
  min-height: 100vh;
  font-family: "jf-openhuninn", "Fredoka", "Nunito", "Noto Sans TC", sans-serif;
  text-align: center;
  overflow: hidden;
  background-image: linear-gradient(rgba(255,255,255,.3), rgba(255,255,255,.3)), var(--dpt-bg);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.dpt-center-shell { width: min(90vw, 1220px); min-height: 100vh; margin: 0 auto; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 28px 0; }
.dpt-start-shell, .dpt-result-shell { width: min(78vw, 960px); }
.dpt-soft-panel { width: 100%; background: linear-gradient(180deg, rgba(255,238,174,.98), rgba(255,229,151,.98)); border: 7px solid #ff8426; border-radius: 72px; box-sizing: border-box; box-shadow: 0 18px 34px rgba(108,67,25,.12); }
.dpt-start-panel { min-height: 500px; padding: 52px 72px 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 44px; }
.dpt-game-title { display: inline-flex; align-items: center; justify-content: center; padding: 12px 34px; border-radius: 999px; border: 4px solid #ff8a37; background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,246,213,.98)); color: #3b2414; font-size: clamp(30px,3.8vw,48px); font-weight: 950; line-height: 1.08; letter-spacing: 1px; box-shadow: 0 8px 0 rgba(231,124,32,.2), 0 14px 26px rgba(108,67,25,.12); margin: 0; }
.dpt-start-content { width: min(100%,760px); display: grid; grid-template-columns: minmax(300px,1fr) 170px; align-items: center; justify-content: center; gap: 64px; }
.dpt-dialog-bubble { min-height: 138px; border: 5px solid #f0782e; border-radius: 28px; background: linear-gradient(180deg,#fff 0%,#fff9e9 100%); color: #1e1711; display: flex; align-items: center; justify-content: center; padding: 18px 30px; font-size: clamp(26px,3vw,38px); line-height: 1.32; font-weight: 900; box-sizing: border-box; box-shadow: 0 8px 0 rgba(240,125,45,.12), inset 0 0 0 6px rgba(255,226,150,.28); }
.dpt-round-icon { width: 170px; height: 170px; border-radius: 999px; background: linear-gradient(180deg,#4e82d5,#2f68c2); border: 3px solid #173466; display: flex; align-items: center; justify-content: center; overflow: hidden; box-sizing: border-box; padding: 10px; box-shadow: 0 10px 20px rgba(44,83,139,.18); }
.dpt-round-icon img { width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 50%; display: block; }
.dpt-forest-button { min-width: 184px; min-height: 72px; padding: 12px 34px; border-radius: 14px; color: #fff; font-family: inherit; font-size: clamp(23px,2.5vw,32px); font-weight: 900; line-height: 1.15; cursor: pointer; transition: transform .14s ease, filter .14s ease; border: 2px solid #74513a; background: linear-gradient(180deg,#b28a68,#8e664f); box-shadow: 0 4px 0 rgba(84,56,38,.34),0 10px 18px rgba(84,56,38,.14); }
.dpt-forest-button:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.04); }
.dpt-image-button { display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; box-shadow: none; min-width: 0; min-height: 0; }
.dpt-image-button img { width: clamp(126px, 13vw, 190px); height: auto; display: block; object-fit: contain; }
.dpt-guided-action { position: relative; display: inline-flex; align-items: center; justify-content: center; }
.dpt-mouse-guide { position: absolute; width: clamp(54px, 6vw, 86px); height: auto; pointer-events: none; filter: drop-shadow(0 10px 10px rgba(74,54,25,.18)); animation: dptMouseTap 1s ease-in-out infinite; }
.dpt-mouse-on-button { right: -34px; bottom: -24px; }
.dpt-video-panel { min-height: 78vh; padding: 48px 72px 34px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; }
.dpt-video-frame { width: 100%; height: min(60vh,560px); min-height: 360px; border: 2px solid rgba(97,123,74,.55); border-radius: 22px; background: rgba(255,255,255,.38); overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.dpt-video { width: 100%; height: 100%; object-fit: cover; display: block; }
.dpt-result-panel { min-height: 520px; padding: 48px 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
.dpt-cute-stars { font-size: clamp(48px, 7vw, 86px); letter-spacing: 10px; line-height: 1; color: rgba(114,83,46,.25); }
.dpt-cute-star.is-on { color: #ffc531; text-shadow: 0 8px 0 rgba(160,98,24,.18), 0 12px 18px rgba(115,73,14,.18); }
.dpt-result-actions { display: flex; align-items: center; justify-content: center; gap: 22px; flex-wrap: wrap; }

.dpt-page--soft::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 52% 9%, rgba(255,255,255,.22), transparent 28%),
    linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,239,188,.1));
  z-index: 0;
}

.dpt-center-shell {
  position: relative;
  z-index: 1;
}

.dpt-start-shell,
.dpt-result-shell {
  width: min(72vw, 860px);
}

.dpt-soft-panel {
  position: relative;
  border-color: rgba(246,165,31,.96);
  border-radius: 58px;
  background:
    radial-gradient(circle at 18% 8%, rgba(255,255,255,.88) 0 9%, transparent 29%),
    radial-gradient(circle at 84% 18%, rgba(255,238,160,.58) 0 13%, transparent 34%),
    linear-gradient(145deg, rgba(255,252,222,.99) 0%, rgba(255,229,139,.98) 48%, rgba(239,178,83,.96) 100%);
  box-shadow:
    0 22px 0 rgba(151,87,28,.18),
    0 36px 62px rgba(66,44,15,.28),
    0 12px 26px rgba(255,223,128,.22),
    inset 0 12px 18px rgba(255,255,255,.72),
    inset 0 2px 0 rgba(255,255,255,.92),
    inset 0 -18px 24px rgba(139,77,22,.2),
    inset 0 -42px 72px rgba(119,75,21,.12);
}

.dpt-soft-panel::before {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 42px;
  border: 2px dashed rgba(255,245,205,.58);
  pointer-events: none;
  box-shadow:
    inset 0 2px 5px rgba(255,255,255,.5),
    inset 0 -3px 8px rgba(139,88,23,.12);
}

.dpt-soft-panel::after {
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
  filter:
    drop-shadow(0 4px 2px rgba(60,105,27,.22))
    drop-shadow(0 10px 10px rgba(88,57,19,.16));
  opacity: .92;
}

.dpt-start-panel {
  min-height: 560px;
  padding: 58px 70px 74px;
  gap: 34px;
}

.dpt-game-title,
.dpt-start-content,
.dpt-guided-action,
.dpt-result-actions {
  position: relative;
  z-index: 2;
}

.dpt-game-title {
  min-width: min(100%, 420px);
  padding: 14px 42px 16px;
  border-radius: 20px;
  border-color: #e9a33c;
  background: linear-gradient(180deg, rgba(255,226,129,.96), rgba(255,244,194,.98));
  color: #7a3f16;
  font-size: clamp(34px, 4vw, 52px);
  letter-spacing: 2px;
  text-shadow: 0 3px 0 rgba(255,255,255,.85);
  box-shadow:
    0 8px 0 rgba(210,130,37,.24),
    0 14px 24px rgba(91,57,18,.12),
    inset 0 0 0 5px rgba(255,255,255,.34);
}

.dpt-start-content {
  width: min(100%, 690px);
  grid-template-columns: minmax(300px, 1fr) 158px;
  gap: 44px;
}

.dpt-dialog-bubble {
  border: 4px solid #f0c77b;
  color: #6d3717;
  position: relative;
  box-shadow: 0 8px 0 rgba(225,169,84,.12), inset 0 0 0 5px rgba(255,235,174,.35);
}

.dpt-dialog-bubble::before {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: 20px;
  border: 2px dashed rgba(229,189,119,.55);
  pointer-events: none;
}

.dpt-dialog-bubble::after {
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

.dpt-round-icon {
  position: relative;
  width: 158px;
  height: 158px;
  background: linear-gradient(180deg, #82d9ff, #48aee8);
  border: 5px solid rgba(255,255,255,.92);
  outline: 3px solid rgba(72,157,207,.65);
  padding: 14px;
  box-shadow: 0 10px 0 rgba(42,112,165,.2), 0 18px 24px rgba(53,91,123,.18);
}

.dpt-forest-button {
  position: relative;
  z-index: 2;
  min-width: 220px;
  min-height: 76px;
  border-radius: 24px;
  font-size: clamp(25px, 2.8vw, 38px);
  font-weight: 950;
  letter-spacing: 1px;
  transition: transform .2s cubic-bezier(.18,1.25,.38,1), filter .2s ease, opacity .14s ease;
}

.dpt-image-button {
  width: clamp(188px, 18vw, 254px);
  padding: 0;
  border: none;
  outline: none;
  border-radius: 18px;
  background: transparent;
  box-shadow: none;
  line-height: 0;
  overflow: visible;
  transform-origin: 50% 58%;
  will-change: transform, filter;
}

.dpt-image-button.dpt-btn-start,
.dpt-image-button.dpt-btn-home,
.dpt-image-button.dpt-btn-replay,
.dpt-image-button.dpt-btn-detail,
.dpt-image-button.dpt-btn-skip,
.dpt-image-button.dpt-btn-next {
  min-width: 0;
  min-height: 0;
  border: none;
  outline: none;
  background: transparent;
  box-shadow: none;
}

.dpt-image-button img {
  width: 100%;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter:
    drop-shadow(0 10px 8px rgba(74,48,16,.26))
    drop-shadow(0 0 14px rgba(255,238,150,.22));
  transition: filter .2s ease;
}

.dpt-image-button:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.045);
  filter: brightness(1.06) saturate(1.05);
  animation: dptButtonBreathe 1.15s ease-in-out infinite, dptButtonWobble .62s cubic-bezier(.34,1.56,.64,1) both;
}

.dpt-image-button:hover:not(:disabled) img {
  filter:
    drop-shadow(0 14px 10px rgba(74,48,16,.3))
    drop-shadow(0 0 18px rgba(255,238,150,.38));
}

.dpt-image-button:active:not(:disabled) {
  transform: translateY(2px) scale(.965);
  animation: none;
}

.dpt-btn-skip.dpt-image-button,
.dpt-btn-next.dpt-image-button {
  width: clamp(198px, 19vw, 266px);
}

.dpt-video-frame {
  border: 4px solid #6fb6ec;
  border-radius: 24px;
  background: linear-gradient(180deg, #2fb5ff, #3189e5);
  box-shadow:
    0 8px 0 rgba(55,121,177,.18),
    inset 0 0 0 4px rgba(255,255,255,.28);
}

.dpt-result-panel {
  min-height: 500px;
  padding: 92px 56px 60px;
  gap: 44px;
}

.dpt-cute-stars {
  position: absolute;
  top: -78px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 24px;
  z-index: 3;
  letter-spacing: 0;
}

.dpt-cute-star {
  font-size: clamp(82px, 8vw, 116px);
  line-height: .9;
  color: #c2cfc9;
  opacity: .6;
  -webkit-text-stroke: 7px rgba(255,255,255,.96);
  text-shadow: 0 5px 0 rgba(85,111,84,.2), 0 10px 16px rgba(72,58,32,.16);
  display: inline-block;
  transform: rotate(-8deg);
}

.dpt-cute-star:nth-child(2) { transform: translateY(-12px) rotate(2deg) scale(1.15); }
.dpt-cute-star:nth-child(3) { transform: rotate(7deg); }

.dpt-cute-star.is-on {
  color: #ffd53d;
  opacity: 1;
  -webkit-text-stroke: 7px rgba(255,255,255,.98);
  text-shadow:
    0 4px 0 #e39d19,
    0 8px 16px rgba(121,74,6,.3),
    0 0 18px rgba(255,249,171,.95);
}

.dpt-result-actions .dpt-image-button {
  width: clamp(168px, 16vw, 232px);
}

@keyframes dptButtonWobble {
  0% { rotate: 0deg; }
  24% { rotate: -2.2deg; }
  52% { rotate: 1.6deg; }
  78% { rotate: -.8deg; }
  100% { rotate: 0deg; }
}

@keyframes dptButtonBreathe {
  0%, 100% { scale: 1; }
  50% { scale: 1.015; }
}

.dpt-container { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: clamp(12px, 2vw, 28px); }
.dpt-stage { position: relative; width: min(96vw, 1180px); height: min(82vh, 720px); border-radius: 42px; background: rgba(255,255,255,.38); border: 6px solid rgba(255,132,38,.65); box-shadow: inset 0 0 0 8px rgba(255,255,255,.25), 0 22px 44px rgba(108,67,25,.16); overflow: hidden; }
.dpt-fixation-bee { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); width: clamp(92px, 11vw, 150px); height: auto; object-fit: contain; filter: drop-shadow(0 12px 12px rgba(74,54,25,.18)); animation: dptFloat 1.05s ease-in-out infinite; }
.dpt-food-pair { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; align-items: center; pointer-events: none; }
.dpt-food-zone { display: flex; align-items: center; justify-content: center; }
.dpt-item { filter: drop-shadow(0 14px 14px rgba(74,54,25,.16)); transition: transform .2s ease, filter .2s ease; }
.dpt-item--glow { transform: scale(1.08); filter: drop-shadow(0 0 24px rgba(255,199,62,.9)) drop-shadow(0 14px 14px rgba(74,54,25,.16)); animation: dptGlow 0.8s ease-in-out infinite alternate; }
.dpt-fly { position: absolute; top: 44%; transform: translate(-50%, -50%); filter: drop-shadow(0 10px 14px rgba(74,54,25,.18)); }
.dpt-fly--left { left: 42%; }
.dpt-fly--right { left: 58%; }
.dpt-fly.is-hit { animation: dptFlyHit .35s ease-out both; }
.dpt-fly.is-attention-hint { animation: dptAttentionPulse .42s ease-in-out 0s 3 both; }
.dpt-arrow-actions { position: absolute; left: 50%; bottom: clamp(22px, 5vh, 58px); transform: translateX(-50%); display: flex; align-items: center; justify-content: center; gap: clamp(72px, 14vw, 180px); }
.dpt-arrow-actions.is-neutral-hint .dpt-arrow-button.is-clickable { animation: dptNeutralHint .38s ease-in-out 0s 3 both; }
.dpt-arrow-button { width: clamp(110px, 13vw, 170px); height: clamp(90px, 10vw, 142px); border: none; background: transparent; padding: 0; cursor: pointer; opacity: .45; transition: transform .14s ease, opacity .14s ease, filter .14s ease; }
.dpt-arrow-button img { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none; }
.dpt-arrow-button.is-clickable { opacity: 1; }
.dpt-arrow-button.is-clickable:hover { transform: translateY(-4px) scale(1.03); }
.dpt-arrow-button.is-soft-correct { filter: drop-shadow(0 0 14px rgba(87, 203, 105, .72)); }
.dpt-arrow-button.is-soft-wrong { filter: drop-shadow(0 0 10px rgba(221, 90, 70, .55)); }

@keyframes dptMouseTap { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-6px,-6px) scale(.96); } }
@keyframes dptFloat { 0%, 100% { transform: translate(-50%, -50%) translateY(0); } 50% { transform: translate(-50%, -50%) translateY(-10px); } }
@keyframes dptGlow { from { filter: drop-shadow(0 0 12px rgba(255,199,62,.65)) drop-shadow(0 14px 14px rgba(74,54,25,.16)); } to { filter: drop-shadow(0 0 28px rgba(255,199,62,.95)) drop-shadow(0 14px 14px rgba(74,54,25,.16)); } }
@keyframes dptFlyHit { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(.2) rotate(16deg); opacity: .15; } }
@keyframes dptAttentionPulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 10px 14px rgba(74,54,25,.18)); } 50% { transform: translate(-50%, -50%) scale(1.16); filter: drop-shadow(0 0 18px rgba(255,216,61,.78)); } }
@keyframes dptNeutralHint { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }

@media (max-width: 780px) {
  .dpt-start-content, .dpt-result-content { grid-template-columns: 1fr; gap: 28px; }
  .dpt-start-panel, .dpt-result-panel, .dpt-video-panel { padding: 28px 22px; border-radius: 40px; }
  .dpt-round-icon { width: 132px; height: 132px; margin: 0 auto; }
  .dpt-arrow-actions { gap: clamp(36px, 10vw, 96px); }
  .dpt-fly--left { left: 40%; }
  .dpt-fly--right { left: 60%; }
}


/* 貓狗反向選擇：保留原本卡片與場景，只替換遊戲核心 */
.dpt-animal-choice-row {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  justify-items: center;
  padding: clamp(70px, 10vh, 110px) clamp(70px, 8vw, 130px) clamp(150px, 20vh, 190px);
  gap: clamp(70px, 12vw, 190px);
}

.dpt-animal-choice {
  width: clamp(220px, 25vw, 330px);
  height: clamp(220px, 25vw, 330px);
  border: 6px solid rgba(255,255,255,.92);
  outline: 4px solid #f3a33b;
  border-radius: 38px;
  background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,245,205,.94));
  box-shadow: 0 12px 0 rgba(205,125,35,.20), 0 20px 28px rgba(87,58,24,.16), inset 0 0 0 8px rgba(255,224,134,.26);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  cursor: default;
  opacity: .78;
  transition: transform .15s ease, filter .15s ease, opacity .15s ease, box-shadow .15s ease;
}

.dpt-animal-choice img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 12px 12px rgba(74,54,25,.16));
}

.dpt-animal-choice.is-clickable {
  cursor: pointer;
  opacity: 1;
  animation: dptAnimalReady 1s ease-in-out infinite alternate;
}

.dpt-animal-choice.is-clickable:hover,
.dpt-animal-choice.is-clickable:focus-visible {
  transform: translateY(-7px) scale(1.035);
  filter: brightness(1.04);
  outline-color: #74b947;
}

.dpt-animal-choice.is-clickable:active {
  transform: translateY(2px) scale(.98);
}

.dpt-listen-status {
  position: absolute;
  z-index: 3;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 280px;
  padding: 12px 26px;
  border: 4px solid #f0c77b;
  border-radius: 999px;
  background: rgba(255,255,255,.94);
  color: #6d3717;
  font-size: clamp(22px, 2.6vw, 34px);
  font-weight: 900;
  box-shadow: 0 7px 0 rgba(225,169,84,.14);
}

.dpt-retry-audio {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  border: 4px solid rgba(255,255,255,.9);
  border-radius: 22px;
  padding: 13px 28px;
  background: linear-gradient(180deg,#ffba62,#e87731);
  color: #fff;
  font-family: inherit;
  font-size: clamp(20px,2.2vw,28px);
  font-weight: 900;
  box-shadow: 0 7px 0 #b95324;
  cursor: pointer;
}

.dpt-animal-choice.is-neutral-hint { animation: dptNeutralHint .38s ease-in-out 0s 3 both; }
.dpt-animal-choice.is-direct-hint { box-shadow: 0 0 0 10px rgba(112,190,72,.28), 0 0 32px rgba(112,190,72,.75); transform: scale(1.06); }
.dpt-animal-choice.is-feedback { filter: drop-shadow(0 0 20px rgba(93,190,76,.8)); }
@keyframes dptNeutralHint { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 75% { transform: translateX(7px); } }

@keyframes dptAnimalReady {
  from { box-shadow: 0 12px 0 rgba(205,125,35,.20), 0 20px 28px rgba(87,58,24,.16), inset 0 0 0 8px rgba(255,224,134,.26); }
  to { box-shadow: 0 12px 0 rgba(205,125,35,.20), 0 20px 38px rgba(117,180,61,.34), inset 0 0 0 8px rgba(255,224,134,.26); }
}

@media (max-width: 780px) {
  .dpt-animal-choice-row {
    padding: 92px 28px 135px;
    gap: 24px;
  }
  .dpt-animal-choice {
    width: min(38vw, 240px);
    height: min(38vw, 240px);
    border-radius: 28px;
    padding: 14px;
  }
  .dpt-listen-status { top: 34px; min-width: 230px; }
}
`;
