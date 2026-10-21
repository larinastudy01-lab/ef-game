import { ARI_PROTOCOL_VERSION, ARI_TRAINING_CONFIG, normalizeAriDifficulty } from "../utils/ariProtocol";
import { useTrainingAchievementAssignment } from "../utils/useTrainingAchievementAssignment";
import { gameLocalStorage as localStorage } from "../temporaryGameTesting/runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/GamePage_ARI.css";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { saveUnifiedResult } from "../utils/resultManager";
import { calculateAriScore } from "../utils/ariScoring";
import { analyzeAriTraining } from "../ai/ariTrainingAnalyzer";

import backgroundImg from "../asset/ARI/ARI_background.webp";
import introVideo from "../asset/optimized/mp4/ARI_start.mp4";
import stepVideo from "../asset/optimized/mp4/ARI_step.mp4";
import endingVideo from "../asset/optimized/mp4/ARI_end.mp4";
import startAvatar from "../asset/avatar/fox.webp";
import homeStartBtn from "../asset/home/start.webp";
import homeNextBtn from "../asset/home/next.webp";
import homeSkipBtn from "../asset/home/skip.webp";
import homeBackBtn from "../asset/return.webp";
import homeAgainBtn from "../asset/home/again.webp";
import homeResultBtn from "../asset/home/result.webp";
import mouseGuideImg from "../asset/mouse.webp";

import catImg from "../asset/ARI/cat.webp";
import dogImg from "../asset/ARI/dog.webp";
import catSound from "../asset/ARI/cat.mp3";
import dogSound from "../asset/ARI/dog.mp3";
import replayIcon from "../asset/voice.webp";
import interferenceSound from "../asset/ARI/voice.mp3";
import "../styles/TestStepVideo.css";

const RESULT_ROUTE = "/result-ari";
const FOREST_ROUTE = "/game-menu";
const DIFFICULTY_CONFIG = ARI_TRAINING_CONFIG;
const FEEDBACK_TIME = 420;
const NEXT_TRIAL_DELAY = 260;
const ANTICIPATION_RT = 150;
const TASK_VERSION = "audio-visual-opposite-v2";
const SCORING_VERSION = "2.0.0";
const ARI_DIFFICULTY_KEY = "ariTrainingDifficulty";
const ARI_SELECTED_LEVEL_KEY = "ariSelectedTrainingLevel";

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

const normalizeDifficulty = normalizeAriDifficulty;
function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getInitialDifficulty(location) {
  const requested = location?.state?.difficulty || new URLSearchParams(location?.search || "").get("difficulty");
  if (requested) return normalizeDifficulty(requested);
  const level = location?.state?.trainingLevel || new URLSearchParams(location?.search || "").get("level");
  if (level) return normalizeDifficulty(level);
  try {
    const selected =
      safeJsonParse(localStorage.getItem(ARI_SELECTED_LEVEL_KEY)) ||
      safeJsonParse(localStorage.getItem("selectedTrainingLevel"));

    return normalizeDifficulty(
      selected?.difficulty ||
        localStorage.getItem(ARI_DIFFICULTY_KEY) ||
        localStorage.getItem("trainingDifficulty") ||
        "beginner"
    );
  } catch {
    return "beginner";
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

function getPreviousAriAnalysis(childId = resolveCurrentChildId()) {
  try {
    const possibleKeys = childId
      ? [`ariTrainingResult_${childId}`, `latestAriResult_${childId}`, "ariTrainingResult", "latestAriResult"]
      : ["ariTrainingResult_unassigned", "ariTrainingResult", "latestAriResult"];

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
  const config = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.beginner;
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

export default function TrainingPage_ARI() {
  const navigate = useNavigate();
  const location = useLocation();
  const [difficultyKey] = useState(() => getInitialDifficulty(location));
  const difficulty = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.beginner;
  const achievementAssignment = useTrainingAchievementAssignment({ gameId: "ARI", difficulty: difficultyKey, difficultyLabel: difficulty.label, trainingLevel: location.state?.trainingLevel || new URLSearchParams(location.search).get("level"), location });
  const trials = useMemo(() => buildTrials(difficultyKey), [difficultyKey]);
  const [phase, setPhase] = useState("start");
  const [trialIndex, setTrialIndex] = useState(0);
  const [canAnswer, setCanAnswer] = useState(false);
  const [isPreparingSound, setIsPreparingSound] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [hintType, setHintType] = useState(null);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(difficulty.answerTimeLimit / 1000);
  const [isReplaying, setIsReplaying] = useState(false);
  const [trialRecords, setTrialRecords] = useState([]);
  const [pendingResult, setPendingResult] = useState(null);

  const timeoutRefs = useRef([]);
  const audioRef = useRef(null);
  const replayAudioRef = useRef(null);
  const noiseAudioRef = useRef(null);
  const answerActiveRef = useRef(false);
  const countdownRef = useRef(null);
  const hintedTrialRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const promptEventsRef = useRef([]);
  const replayEventsRef = useRef([]);
  const technicalEventsRef = useRef([]);
  const replayingRef = useRef(false);
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
    clearInterval(countdownRef.current);
    answerActiveRef.current = false;
    [replayAudioRef, noiseAudioRef].forEach((ref) => {
      if (ref.current) { ref.current.onplaying = null; ref.current.onended = null; ref.current.onerror = null; ref.current.pause(); ref.current = null; }
    });
    replayingRef.current = false;
  }

  useEffect(() => () => clearCurrentTimer(), []); // eslint-disable-line react-hooks/exhaustive-deps -- unmount-only cleanup reads refs

  function resetTestState() {
    clearCurrentTimer();
    setPendingResult(null);
    promptEventsRef.current = [];
    replayEventsRef.current = [];
    technicalEventsRef.current = [];
    consecutiveErrorsRef.current = 0;
    setIsReplaying(false);
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
    if (event.target.closest("[data-replay-control='true']")) return;
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
    hintedTrialRef.current = false;
    setIsReplaying(false);
    setRemainingSeconds(difficulty.answerTimeLimit / 1000);
    setFeedbackTarget(null);
    setIsPreparingSound(true);
    audioFallbackRef.current = false;
    addTimeout(() => playTrialSound(index), difficulty.preSoundDelay);
  }

  function showAnswerHint(index, reason) {
    if (difficulty.hintLevel !== "direct" || !answerActiveRef.current || answeredRef.current || trialIndexRef.current !== index || hintedTrialRef.current) return;
    hintedTrialRef.current = true;
    promptEventsRef.current.push({
      trialIndex: index + 1, reason, target: trials[index].correctTarget,
      position: trials[index].correctPosition,
      elapsedMs: Math.round(performance.now() - probeStartTimeRef.current),
      shownAt: new Date().toISOString(),
    });
    setHintType("direct");
  }

  function openAnswerWindow(index) {
    if (answeredRef.current || trialIndexRef.current !== index || answerActiveRef.current) return;
    probeStartTimeRef.current = performance.now();
    answerActiveRef.current = true;
    setIsPreparingSound(false);
    setAudioError(false);
    setCanAnswer(true);
    setRemainingSeconds(difficulty.answerTimeLimit / 1000);
    if (difficulty.hintLevel === "direct") {
      if (consecutiveErrorsRef.current >= difficulty.hintAfterConsecutiveErrors) showAnswerHint(index, "consecutive_errors");
      addTimeout(() => showAnswerHint(index, "idle"), difficulty.hintDelayMs);
    }
    addTimeout(() => {
      if (!answeredRef.current && trialIndexRef.current === index) handleTimeout(index);
    }, difficulty.answerTimeLimit);
    countdownRef.current = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((difficulty.answerTimeLimit - (performance.now() - probeStartTimeRef.current)) / 1000)));
    }, 200);
    if (difficulty.interference) {
      const noise = new Audio(interferenceSound);
      noise.loop = true;
      noise.volume = difficulty.interferenceVolume;
      noiseAudioRef.current = noise;
      noise.play().catch(() => {
        if (noiseAudioRef.current !== noise) return;
        technicalEventsRef.current.push({ trialIndex: index + 1, type: "interference_playback_failed", timestamp: new Date().toISOString() });
      });
    }
  }

  function handleAudioPlaybackFailure(index) {
    if (answeredRef.current || trialIndexRef.current !== index) return;
    technicalEventsRef.current.push({ trialIndex: index + 1, type: "stimulus_playback_failed", timestamp: new Date().toISOString() });
    if (answerActiveRef.current) {
      finishTraining(trialRecordsRef.current, { reason: "audio_error" });
      return;
    }
    stopAudio();
    setIsPreparingSound(false);
    setAudioError(true);
    setCanAnswer(false);
  }

  function playTrialSound(index, isRetry = false) {
    const trial = trials[index];
    if (!trial || answeredRef.current || trialIndexRef.current !== index) return;
    stopAudio();
    const audio = new Audio(trial.soundSrc);
    audio.preload = "auto";
    audioRef.current = audio;
    audio.onplaying = () => {
      if (audioRef.current !== audio) return;
      audio.onplaying = null;
      if (isRetry) replayEventsRef.current.push({ trialIndex: index + 1, reason: "audio_retry", elapsedMs: null, timestamp: new Date().toISOString() });
      openAnswerWindow(index);
    };
    const fail = () => { if (audioRef.current === audio) handleAudioPlaybackFailure(index); };
    audio.onerror = fail;
    audio.play().catch(fail);
    addTimeout(() => { if (!answerActiveRef.current) fail(); }, 4000);
  }

  function replayCurrentSound() {
    if (!difficulty.allowReplay || answeredRef.current || replayingRef.current || phase !== "playing") return;
    const index = trialIndexRef.current;
    if (!answerActiveRef.current) {
      if (!audioError) return;
      setAudioError(false);
      setIsPreparingSound(true);
      playTrialSound(index, true);
      return;
    }
    if (performance.now() - probeStartTimeRef.current >= difficulty.answerTimeLimit) { handleTimeout(index); return; }
    stopAudio();
    replayingRef.current = true;
    setIsReplaying(true);
    const replay = new Audio(trials[index].soundSrc);
    replayAudioRef.current = replay;
    replay.onplaying = () => {
      if (replayAudioRef.current !== replay) return;
      replay.onplaying = null;
      replayEventsRef.current.push({ trialIndex: index + 1, reason: "replay", elapsedMs: Math.round(performance.now() - probeStartTimeRef.current), timestamp: new Date().toISOString() });
    };
    const stopReplay = () => {
      if (replayAudioRef.current !== replay) return;
      replay.onplaying = null; replay.onended = null; replay.onerror = null;
      replay.pause(); replayAudioRef.current = null;
      replayingRef.current = false; setIsReplaying(false);
    };
    replay.onended = stopReplay;
    const fail = () => {
      if (replayAudioRef.current !== replay) return;
      technicalEventsRef.current.push({ trialIndex: index + 1, type: "replay_playback_failed", timestamp: new Date().toISOString() });
      stopReplay();
    };
    replay.onerror = fail;
    replay.play().catch(fail);
  }

  function buildRecord({ trial, selectedTarget, selectedPosition, reactionTime, timeout }) {
    const targetCorrect = !timeout && selectedTarget === trial.correctTarget;
    const isAnticipation = Number.isFinite(reactionTime) && reactionTime < ANTICIPATION_RT;
    const isCorrect = targetCorrect && !isAnticipation;
    const promptEvents = promptEventsRef.current.filter((event) => event.trialIndex === trial.trialIndex);
    const replayEvents = replayEventsRef.current.filter((event) => event.trialIndex === trial.trialIndex);
    return {
      trialIndex: trial.trialIndex,
      mode: "training",
      difficulty: difficultyKey,
      difficultyKey,
      protocolVersion: ARI_PROTOCOL_VERSION,
      difficultyLevel: difficulty.difficultyLevel,
      difficultyLabel: difficulty.label,
      answerTimeLimit: difficulty.answerTimeLimit,
      allowReplay: difficulty.allowReplay,
      interference: difficulty.interference,
      hintShown: promptEvents.length > 0,
      hintUsed: promptEvents.length > 0,
      promptEvents, promptCount: promptEvents.length,
      idleHintCount: promptEvents.filter((event) => event.reason === "idle").length,
      consecutiveErrorHintCount: promptEvents.filter((event) => event.reason === "consecutive_errors").length,
      replayEvents, replayCount: replayEvents.length,
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
      responseElapsedMs: timeout ? difficulty.answerTimeLimit : reactionTime,
      timeout,
      audioPlaybackFailed: audioFallbackRef.current,
      technicalFallback: null,
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
    if (!canAnswer || !answerActiveRef.current || answeredRef.current || phase !== "playing") return;
    if (performance.now() - probeStartTimeRef.current >= difficulty.answerTimeLimit) { handleTimeout(trialIndexRef.current); return; }
    answeredRef.current = true;
    clearCurrentTimer();
    const index = trialIndexRef.current;
    const trial = trials[index];
    if (!trial) return;
    const reactionTime = Number.isFinite(probeStartTimeRef.current)
      ? Math.round(performance.now() - probeStartTimeRef.current)
      : null;
    const record = buildRecord({ trial, selectedTarget, selectedPosition, reactionTime, timeout: false });
    consecutiveErrorsRef.current = record.isCorrect ? 0 : consecutiveErrorsRef.current + 1;
    const updated = [...trialRecordsRef.current, record];
    trialRecordsRef.current = updated;
    setTrialRecords(updated);
    setCanAnswer(false);
    setHintType(null);
    setFeedbackTarget(record.isCorrect ? selectedTarget : null);
    addTimeout(() => goNextTrial(updated, index), FEEDBACK_TIME);
  }

  function handleTimeout(index) {
    if (answeredRef.current || trialIndexRef.current !== index) return;
    answeredRef.current = true;
    clearCurrentTimer();
    const trial = trials[index];
    if (!trial) return;
    const record = buildRecord({ trial, selectedTarget: null, selectedPosition: null, reactionTime: null, timeout: true });
    consecutiveErrorsRef.current += 1;
    const updated = [...trialRecordsRef.current, record];
    trialRecordsRef.current = updated;
    setTrialRecords(updated);
    setCanAnswer(false);
    setHintType(null);
    setFeedbackTarget(null);
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
      return calculateAriScore(records, {
        mode: "training",
        difficulty: difficultyKey,
        plannedTotalRounds: trials.length,
      }) || {};
    } catch (error) {
      console.error("ARI 訓練評分失敗：", error);
      return {};
    }
  }

  function finishTraining(records, { reason = "completed" } = {}) {
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

    const ariScoring = safeScoring(recordsWithMeta);
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
    const previousAnalysis = getPreviousAriAnalysis(childId);

    let ariAiAnalysis = {};
    try {
      ariAiAnalysis = analyzeAriTraining({
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
      console.error("ARI 訓練分析失敗：", error);
    }

    const scoringSummary = ariScoring.summary || {};
    const scoringParentView = ariScoring.parentView || {};
    const scoringClinicalView = ariScoring.clinicalView || {};
    const finalRecommendedDifficulty = reason !== "completed" ? difficultyKey : normalizeAriDifficulty(
      ariAiAnalysis.recommendedDifficulty ||
      recommendedDifficulty ||
      difficultyKey);
    const stars = Number(ariScoring.stars) || (accuracy >= 85 ? 3 : accuracy >= 65 ? 2 : 1);
    const totalScore = Number.isFinite(Number(ariScoring.totalScore))
      ? Number(ariScoring.totalScore)
      : accuracy;
    const finishedAt = new Date().toISOString();

    const result = {
      achievementAssignment, completed: totalTrials >= trials.length && reason === "completed",
      status: reason === "completed" ? "completed" : "interrupted", finishReason: reason,
      protocolVersion: ARI_PROTOCOL_VERSION, protocol: difficulty,
      promptEvents: [...promptEventsRef.current], promptCount: promptEventsRef.current.length,
      idleHintCount: promptEventsRef.current.filter((event) => event.reason === "idle").length,
      consecutiveErrorHintCount: promptEventsRef.current.filter((event) => event.reason === "consecutive_errors").length,
      replayEvents: [...replayEventsRef.current], replayCount: replayEventsRef.current.length,
      technicalEvents: [...technicalEventsRef.current],
      taskName: "貓狗合唱團",
      taskCode: "ARI",
      taskVersion: TASK_VERSION,
      taskRule: "catSoundSelectDog_dogSoundSelectCat",
      scoringVersion: ariScoring.scoringVersion || SCORING_VERSION,
      gameId: "ARI",
      abilityType: "attention_control",
      mode: "training",
      difficulty: difficultyKey,
      difficultyKey,
      difficultyLevel: difficulty.difficultyLevel,
      difficultyLabel: difficulty.label,
      expectedTrials: trials.length,
      resultViews: ["child", "parent", "clinician"],
      resultSource: "ariScoring",
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
      aiScore: ariAiAnalysis.aiScore ?? null,
      aiAnalysis: ariAiAnalysis,
      recommendedHintLevel: ariAiAnalysis.recommendedHintLevel || difficulty.hintLevel,
      nextRoundConfig: ariAiAnalysis.nextRoundConfig || null,

      scoring: ariScoring,
      clinicalView: scoringClinicalView,
      parentView: scoringParentView,
      childView: ariScoring.childView || null,
      totalScore,
      score: totalScore,
      stars,
      performanceLevel: ariScoring.performanceLevel || (stars >= 3 ? "good" : stars >= 2 ? "developing" : "needs_support"),
      suggestedAction:
        ariAiAnalysis.suggestedAction ||
        performanceResult.suggestedAction ||
        "建議維持目前難度，繼續練習聽完聲音後再選擇相反動物。",
      parentSummary:
        ariAiAnalysis.parentSummary ||
        ariAiAnalysis.parentView?.plainLanguageSummary ||
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
      startedFrom: "TrainingPage_ARI",
      finishedAt,
      generatedAt: ariScoring.generatedAt || ariAiAnalysis.generatedAt || finishedAt,
    };

    try {
      saveUnifiedResult({
        rawResult: result,
        gameId: "ARI",
        mode: "training",
        difficulty: difficultyKey,
        route: "/training-ari",
        visibleRoles: ["child", "parent", "clinician"],
      });
    } catch {}

    try {
      localStorage.setItem("ariTrainingResult", JSON.stringify(result));
      localStorage.setItem("latestAriResult", JSON.stringify(result));
      if (childId) {
        localStorage.setItem(`ariTrainingResult_${childId}`, JSON.stringify(result));
        localStorage.setItem(`latestAriResult_${childId}`, JSON.stringify(result));
      } else {
        localStorage.setItem("ariTrainingResult_unassigned", JSON.stringify(result));
      }
      localStorage.setItem("latestAriResultMode", "training");
      localStorage.setItem("latestAriResultVersion", TASK_VERSION);
      localStorage.setItem(ARI_DIFFICULTY_KEY, finalRecommendedDifficulty);
      localStorage.setItem(
        ARI_SELECTED_LEVEL_KEY,
        JSON.stringify({
          gameId: "ARI",
          difficulty: finalRecommendedDifficulty,
          hintLevel: ariAiAnalysis.recommendedHintLevel || difficulty.hintLevel,
          source: "ARITrainingAnalyzer",
          taskVersion: TASK_VERSION,
          updatedAt: finishedAt,
        })
      );
    } catch (error) {
      console.error("儲存 ARI 訓練結果失敗：", error);
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
      <div className="ari-page ari-page--soft" style={{ "--ari-bg": `url(${asset.background})` }}>
        <style>{ariInlineCss}</style>
        <main className="ari-center-shell ari-start-shell">
          <section className="ari-soft-panel ari-start-panel game-start-card-artwork ari-opening-card-artwork" aria-label="開始畫面">
            <div className="ari-game-title">貓狗合唱團</div>
            <div className="ari-start-content">
              <div className="ari-dialog-bubble ari-opening-bubble">{difficulty.label}：貓叫要點狗狗，狗叫要點貓咪喔！每題有 {difficulty.answerTimeLimit / 1000} 秒作答時間。</div>
              <div className="ari-round-icon ari-start-avatar"><img src={asset.startAvatar} alt="開始角色" draggable="false" /></div>
            </div>
            <div className="ari-guided-action ari-guided-start">
              <button type="button" className="ari-forest-button ari-image-button ari-btn-start" onClick={handleStart} aria-label="進入遊戲">
                <img src={asset.homeStartBtn} alt="進入遊戲" draggable="false" />
              </button>
              <img loading="lazy" className="ari-mouse-guide ari-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
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
    const actionButtonClass = isTeaching ? "ari-btn-next" : "ari-btn-skip";
    const actionLabel = isTeaching ? "下一步" : "跳過動畫";
    return (
      <div className="ari-page ari-page--soft" style={{ "--ari-bg": `url(${asset.background})` }}>
        <style>{ariInlineCss}</style>
        <main className={`ari-center-shell ${!isIntro ? "test-video-layout" : ""}`}>
          <section className={`ari-soft-panel ari-video-panel game-start-card-artwork ari-video-card-artwork ${!isIntro ? "test-video-card" : ""}`} aria-label="遊戲影片">
            <div className="ari-video-frame test-video-frame">
              <video className="ari-video test-video" src={videoSrc} autoPlay muted playsInline controls preload="metadata" onEnded={onEnded}>你的瀏覽器不支援影片播放。</video>
            </div>
            {isIntro ? <div className="ari-guided-action ari-guided-next">
              <button type="button" className={`ari-forest-button ari-image-button ${actionButtonClass}`} onClick={onAction} aria-label={actionLabel}>
                <img loading="lazy" src={actionImage} alt={actionLabel} draggable="false" />
              </button>
              <img loading="lazy" className="ari-mouse-guide ari-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
            </div> : <div className="test-video-actions">
              <div className="ari-guided-action ari-guided-skip">
                <button type="button" className="ari-forest-button ari-image-button ari-btn-skip" onClick={onAction} aria-label="跳過動畫">
                  <img loading="lazy" src={asset.homeSkipBtn} alt="跳過動畫" draggable="false" />
                </button>
              </div>
              <div className="ari-guided-action ari-guided-next">
                <button type="button" className="ari-forest-button ari-image-button ari-btn-next" onClick={onAction} aria-label="下一步">
                  <img loading="lazy" src={asset.homeNextBtn} alt="下一步" draggable="false" />
                </button>
                <img loading="lazy" className="ari-mouse-guide ari-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
              </div>
            </div>}
          </section>
        </main>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="ari-page ari-page--soft" style={{ "--ari-bg": `url(${asset.background})` }}>
        <style>{ariInlineCss}</style>
        <main className="ari-center-shell ari-result-shell">
          <section className="ari-soft-panel ari-result-panel game-result-card-artwork" aria-label="測驗結果">
            <div className="ari-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1,2,3].map((star) => <span key={star} className={`ari-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>)}
            </div>
            <div className="ari-start-content ari-result-content">
              <div className="ari-dialog-bubble">{pendingResult?.completed ? "關卡完成！你很認真聽聲音並找到相反的動物。" : "聲音沒有成功播放，這次先休息一下，等等再試一次。"}</div>
              <div className="ari-round-icon ari-result-icon"><img src={asset.startAvatar} alt="狐狸角色" draggable="false" /></div>
            </div>
            <div className="ari-result-actions">
              <div className="ari-guided-action ari-guided-result-main">
                <button type="button" className="ari-forest-button ari-image-button ari-btn-home" onClick={() => navigate(FOREST_ROUTE)} aria-label="回到森林">
                  <img loading="lazy" src={asset.homeBackBtn} alt="回到森林" draggable="false" />
                </button>
                <img loading="lazy" className="ari-mouse-guide ari-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
              </div>
              <button type="button" className="ari-forest-button ari-image-button" onClick={handleReplay} aria-label="再玩一次"><img loading="lazy" src={asset.homeAgainBtn} alt="再玩一次" draggable="false" /></button>
              <button type="button" className="ari-forest-button ari-image-button ari-btn-detail" onClick={goResultPage} aria-label="詳細結果">
                <img loading="lazy" src={asset.homeResultBtn} alt="詳細結果" draggable="false" />
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
    <div className="ari-page ari-page--soft" style={{ "--ari-bg": `url(${asset.background})` }}>
      <style>{ariInlineCss}</style>
      <div className="ari-container">
        <div className="ari-stage" onPointerDownCapture={handleStagePointerDown} data-testid="ari-training-stage" data-difficulty={difficultyKey} data-can-answer={canAnswer} data-trial={trialIndex + 1}>
          <div className="ari-listen-status" aria-live="polite">
            {audioError ? "聲音沒有成功播放" : isPreparingSound ? "請準備聽聲音" : canAnswer ? "請選擇相反的動物" : "請稍候"}
            {canAnswer && <span className="ari-answer-countdown" role="timer" aria-label="作答剩餘時間">{difficulty.label} · 剩餘 {remainingSeconds} 秒</span>}
          </div>
          <div className="ari-animal-choice-row" aria-label="選擇動物">
            <button type="button" className={`ari-animal-choice ${canAnswer ? "is-clickable" : ""} ${hintType === "neutral" ? "is-neutral-hint" : ""} ${hintType === "direct" && leftTarget === currentTrial?.correctTarget ? "is-direct-hint" : ""} ${feedbackTarget === leftTarget ? "is-feedback" : ""}`} onClick={() => handleAnswer(leftTarget, "left")} data-answer-zone="true" aria-disabled={!canAnswer}>
              <img loading="lazy" src={leftTarget === "cat" ? asset.cat : asset.dog} alt={leftTarget === "cat" ? "貓咪" : "狗狗"} draggable="false" />
              {hintType === "direct" && leftTarget === currentTrial?.correctTarget && <img className="ari-answer-mouse" src={asset.mouseGuideImg} alt="MOUSE 提示正確動物" draggable="false" />}
            </button>
            <button type="button" className={`ari-animal-choice ${canAnswer ? "is-clickable" : ""} ${hintType === "neutral" ? "is-neutral-hint" : ""} ${hintType === "direct" && rightTarget === currentTrial?.correctTarget ? "is-direct-hint" : ""} ${feedbackTarget === rightTarget ? "is-feedback" : ""}`} onClick={() => handleAnswer(rightTarget, "right")} data-answer-zone="true" aria-disabled={!canAnswer}>
              <img loading="lazy" src={rightTarget === "cat" ? asset.cat : asset.dog} alt={rightTarget === "cat" ? "貓咪" : "狗狗"} draggable="false" />
              {hintType === "direct" && rightTarget === currentTrial?.correctTarget && <img className="ari-answer-mouse" src={asset.mouseGuideImg} alt="MOUSE 提示正確動物" draggable="false" />}
            </button>
          </div>
          {difficulty.allowReplay && <button type="button" className="ari-replay-voice" data-replay-control="true" onClick={replayCurrentSound} disabled={(!canAnswer && !audioError) || isReplaying} aria-label="重播動物聲音">
            <img src={replayIcon} alt="" draggable="false" />
          </button>}
          {audioError && <button type="button" className="ari-audio-abort" onClick={() => finishTraining(trialRecordsRef.current, { reason: "audio_error" })}>結束本次訓練</button>}
        </div>
      </div>
    </div>
  );
}

const ariInlineCss = `
.ari-stage .ari-animal-choice { position: relative; overflow: visible; }
.ari-animal-choice img.ari-answer-mouse { position: absolute; width: 30%; height: auto; right: -8%; bottom: -6%; z-index: 10; pointer-events: none; object-fit: contain; animation: ariMouseTap 1s ease-in-out infinite; }
.ari-answer-countdown { display: block; font-size: .75em; margin-top: 5px; }
.ari-replay-voice { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); width: clamp(64px, 8vw, 100px); border: 0; background: transparent; padding: 0; cursor: pointer; z-index: 5; }
.ari-replay-voice img { width: 100%; height: auto; display: block; }
.ari-replay-voice:disabled { opacity: .45; cursor: default; }
.ari-audio-abort { position: absolute; bottom: 130px; left: 50%; transform: translateX(-50%); padding: 10px 20px; border-radius: 12px; z-index: 6; }
.ari-page,
.ari-page *,
.ari-forest-button,
.ari-image-button,
.ari-arrow-button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.ari-page--soft {
  min-height: 100vh;
  font-family: "jf-openhuninn", "Fredoka", "Nunito", "Noto Sans TC", sans-serif;
  text-align: center;
  overflow: hidden;
  background-image: linear-gradient(rgba(255,255,255,.3), rgba(255,255,255,.3)), var(--ari-bg);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.ari-center-shell { width: min(90vw, 1220px); min-height: 100vh; margin: 0 auto; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 28px 0; }
.ari-start-shell, .ari-result-shell { width: min(78vw, 960px); }
.ari-soft-panel { width: 100%; background: linear-gradient(180deg, rgba(255,238,174,.98), rgba(255,229,151,.98)); border: 7px solid #ff8426; border-radius: 72px; box-sizing: border-box; box-shadow: 0 18px 34px rgba(108,67,25,.12); }
.ari-start-panel { min-height: 500px; padding: 52px 72px 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 44px; }
.ari-game-title { display: inline-flex; align-items: center; justify-content: center; padding: 12px 34px; border-radius: 999px; border: 4px solid #ff8a37; background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,246,213,.98)); color: #3b2414; font-size: clamp(30px,3.8vw,48px); font-weight: 950; line-height: 1.08; letter-spacing: 1px; box-shadow: 0 8px 0 rgba(231,124,32,.2), 0 14px 26px rgba(108,67,25,.12); margin: 0; }
.ari-start-content { width: min(100%,760px); display: grid; grid-template-columns: minmax(300px,1fr) 170px; align-items: center; justify-content: center; gap: 64px; }
.ari-dialog-bubble { min-height: 138px; border: 5px solid #f0782e; border-radius: 28px; background: linear-gradient(180deg,#fff 0%,#fff9e9 100%); color: #1e1711; display: flex; align-items: center; justify-content: center; padding: 18px 30px; font-size: clamp(26px,3vw,38px); line-height: 1.32; font-weight: 900; box-sizing: border-box; box-shadow: 0 8px 0 rgba(240,125,45,.12), inset 0 0 0 6px rgba(255,226,150,.28); }
.ari-round-icon { width: 170px; height: 170px; border-radius: 999px; background: linear-gradient(180deg,#4e82d5,#2f68c2); border: 3px solid #173466; display: flex; align-items: center; justify-content: center; overflow: hidden; box-sizing: border-box; padding: 10px; box-shadow: 0 10px 20px rgba(44,83,139,.18); }
.ari-round-icon img { width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 50%; display: block; }
.ari-forest-button { min-width: 184px; min-height: 72px; padding: 12px 34px; border-radius: 14px; color: #fff; font-family: inherit; font-size: clamp(23px,2.5vw,32px); font-weight: 900; line-height: 1.15; cursor: pointer; transition: transform .14s ease, filter .14s ease; border: 2px solid #74513a; background: linear-gradient(180deg,#b28a68,#8e664f); box-shadow: 0 4px 0 rgba(84,56,38,.34),0 10px 18px rgba(84,56,38,.14); }
.ari-forest-button:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.04); }
.ari-image-button { display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; box-shadow: none; min-width: 0; min-height: 0; }
.ari-image-button img { width: clamp(126px, 13vw, 190px); height: auto; display: block; object-fit: contain; }
.ari-guided-action { position: relative; display: inline-flex; align-items: center; justify-content: center; }
.ari-mouse-guide { position: absolute; width: clamp(54px, 6vw, 86px); height: auto; pointer-events: none; filter: drop-shadow(0 10px 10px rgba(74,54,25,.18)); animation: ariMouseTap 1s ease-in-out infinite; }
.ari-mouse-on-button { right: -34px; bottom: -24px; }
.ari-video-panel { min-height: 78vh; padding: 48px 72px 34px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; }
.ari-video-frame { width: 100%; height: min(60vh,560px); min-height: 360px; border: 2px solid rgba(97,123,74,.55); border-radius: 22px; background: rgba(255,255,255,.38); overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.ari-video { width: 100%; height: 100%; object-fit: cover; display: block; }
.ari-result-panel { min-height: 520px; padding: 48px 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
.ari-cute-stars { font-size: clamp(48px, 7vw, 86px); letter-spacing: 10px; line-height: 1; color: rgba(114,83,46,.25); }
.ari-cute-star.is-on { color: #ffc531; text-shadow: 0 8px 0 rgba(160,98,24,.18), 0 12px 18px rgba(115,73,14,.18); }
.ari-result-actions { display: flex; align-items: center; justify-content: center; gap: 22px; flex-wrap: wrap; }

.ari-page--soft::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 52% 9%, rgba(255,255,255,.22), transparent 28%),
    linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,239,188,.1));
  z-index: 0;
}

.ari-center-shell {
  position: relative;
  z-index: 1;
}

.ari-start-shell,
.ari-result-shell {
  width: min(72vw, 860px);
}

.ari-soft-panel {
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

.ari-soft-panel::before {
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

.ari-soft-panel::after {
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

.ari-start-panel {
  min-height: 560px;
  padding: 58px 70px 74px;
  gap: 34px;
}

.ari-game-title,
.ari-start-content,
.ari-guided-action,
.ari-result-actions {
  position: relative;
  z-index: 2;
}

.ari-game-title {
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

.ari-start-content {
  width: min(100%, 690px);
  grid-template-columns: minmax(300px, 1fr) 158px;
  gap: 44px;
}

.ari-dialog-bubble {
  border: 4px solid #f0c77b;
  color: #6d3717;
  position: relative;
  box-shadow: 0 8px 0 rgba(225,169,84,.12), inset 0 0 0 5px rgba(255,235,174,.35);
}

.ari-dialog-bubble::before {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: 20px;
  border: 2px dashed rgba(229,189,119,.55);
  pointer-events: none;
}

.ari-dialog-bubble::after {
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

.ari-round-icon {
  position: relative;
  width: 158px;
  height: 158px;
  background: linear-gradient(180deg, #82d9ff, #48aee8);
  border: 5px solid rgba(255,255,255,.92);
  outline: 3px solid rgba(72,157,207,.65);
  padding: 14px;
  box-shadow: 0 10px 0 rgba(42,112,165,.2), 0 18px 24px rgba(53,91,123,.18);
}

.ari-forest-button {
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

.ari-image-button {
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

.ari-image-button.ari-btn-start,
.ari-image-button.ari-btn-home,
.ari-image-button.ari-btn-replay,
.ari-image-button.ari-btn-detail,
.ari-image-button.ari-btn-skip,
.ari-image-button.ari-btn-next {
  min-width: 0;
  min-height: 0;
  border: none;
  outline: none;
  background: transparent;
  box-shadow: none;
}

.ari-image-button img {
  width: 100%;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter:
    drop-shadow(0 10px 8px rgba(74,48,16,.26))
    drop-shadow(0 0 14px rgba(255,238,150,.22));
  transition: filter .2s ease;
}

.ari-image-button:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.045);
  filter: brightness(1.06) saturate(1.05);
  animation: ariButtonBreathe 1.15s ease-in-out infinite, ariButtonWobble .62s cubic-bezier(.34,1.56,.64,1) both;
}

.ari-image-button:hover:not(:disabled) img {
  filter:
    drop-shadow(0 14px 10px rgba(74,48,16,.3))
    drop-shadow(0 0 18px rgba(255,238,150,.38));
}

.ari-image-button:active:not(:disabled) {
  transform: translateY(2px) scale(.965);
  animation: none;
}

.ari-btn-skip.ari-image-button,
.ari-btn-next.ari-image-button {
  width: clamp(198px, 19vw, 266px);
}

.ari-video-frame {
  border: 4px solid #6fb6ec;
  border-radius: 24px;
  background: linear-gradient(180deg, #2fb5ff, #3189e5);
  box-shadow:
    0 8px 0 rgba(55,121,177,.18),
    inset 0 0 0 4px rgba(255,255,255,.28);
}

.ari-result-panel {
  min-height: 500px;
  padding: 92px 56px 60px;
  gap: 44px;
}

.ari-cute-stars {
  position: absolute;
  top: -78px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 24px;
  z-index: 3;
  letter-spacing: 0;
}

.ari-cute-star {
  font-size: clamp(82px, 8vw, 116px);
  line-height: .9;
  color: #c2cfc9;
  opacity: .6;
  -webkit-text-stroke: 7px rgba(255,255,255,.96);
  text-shadow: 0 5px 0 rgba(85,111,84,.2), 0 10px 16px rgba(72,58,32,.16);
  display: inline-block;
  transform: rotate(-8deg);
}

.ari-cute-star:nth-child(2) { transform: translateY(-12px) rotate(2deg) scale(1.15); }
.ari-cute-star:nth-child(3) { transform: rotate(7deg); }

.ari-cute-star.is-on {
  color: #ffd53d;
  opacity: 1;
  -webkit-text-stroke: 7px rgba(255,255,255,.98);
  text-shadow:
    0 4px 0 #e39d19,
    0 8px 16px rgba(121,74,6,.3),
    0 0 18px rgba(255,249,171,.95);
}

.ari-result-actions .ari-image-button {
  width: clamp(168px, 16vw, 232px);
}

@keyframes ariButtonWobble {
  0% { rotate: 0deg; }
  24% { rotate: -2.2deg; }
  52% { rotate: 1.6deg; }
  78% { rotate: -.8deg; }
  100% { rotate: 0deg; }
}

@keyframes ariButtonBreathe {
  0%, 100% { scale: 1; }
  50% { scale: 1.015; }
}

.ari-container { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: clamp(12px, 2vw, 28px); }
.ari-stage { position: relative; width: min(96vw, 1180px); height: min(82vh, 720px); border-radius: 42px; background: rgba(255,255,255,.38); border: 6px solid rgba(255,132,38,.65); box-shadow: inset 0 0 0 8px rgba(255,255,255,.25), 0 22px 44px rgba(108,67,25,.16); overflow: hidden; }
.ari-fixation-bee { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); width: clamp(92px, 11vw, 150px); height: auto; object-fit: contain; filter: drop-shadow(0 12px 12px rgba(74,54,25,.18)); animation: ariFloat 1.05s ease-in-out infinite; }
.ari-food-pair { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; align-items: center; pointer-events: none; }
.ari-food-zone { display: flex; align-items: center; justify-content: center; }
.ari-item { filter: drop-shadow(0 14px 14px rgba(74,54,25,.16)); transition: transform .2s ease, filter .2s ease; }
.ari-item--glow { transform: scale(1.08); filter: drop-shadow(0 0 24px rgba(255,199,62,.9)) drop-shadow(0 14px 14px rgba(74,54,25,.16)); animation: ariGlow 0.8s ease-in-out infinite alternate; }
.ari-fly { position: absolute; top: 44%; transform: translate(-50%, -50%); filter: drop-shadow(0 10px 14px rgba(74,54,25,.18)); }
.ari-fly--left { left: 42%; }
.ari-fly--right { left: 58%; }
.ari-fly.is-hit { animation: ariFlyHit .35s ease-out both; }
.ari-fly.is-attention-hint { animation: ariAttentionPulse .42s ease-in-out 0s 3 both; }
.ari-arrow-actions { position: absolute; left: 50%; bottom: clamp(22px, 5vh, 58px); transform: translateX(-50%); display: flex; align-items: center; justify-content: center; gap: clamp(72px, 14vw, 180px); }
.ari-arrow-actions.is-neutral-hint .ari-arrow-button.is-clickable { animation: ariNeutralHint .38s ease-in-out 0s 3 both; }
.ari-arrow-button { width: clamp(110px, 13vw, 170px); height: clamp(90px, 10vw, 142px); border: none; background: transparent; padding: 0; cursor: pointer; opacity: .45; transition: transform .14s ease, opacity .14s ease, filter .14s ease; }
.ari-arrow-button img { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none; }
.ari-arrow-button.is-clickable { opacity: 1; }
.ari-arrow-button.is-clickable:hover { transform: translateY(-4px) scale(1.03); }
.ari-arrow-button.is-soft-correct { filter: drop-shadow(0 0 14px rgba(87, 203, 105, .72)); }
.ari-arrow-button.is-soft-wrong { filter: drop-shadow(0 0 10px rgba(221, 90, 70, .55)); }

@keyframes ariMouseTap { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-6px,-6px) scale(.96); } }
@keyframes ariFloat { 0%, 100% { transform: translate(-50%, -50%) translateY(0); } 50% { transform: translate(-50%, -50%) translateY(-10px); } }
@keyframes ariGlow { from { filter: drop-shadow(0 0 12px rgba(255,199,62,.65)) drop-shadow(0 14px 14px rgba(74,54,25,.16)); } to { filter: drop-shadow(0 0 28px rgba(255,199,62,.95)) drop-shadow(0 14px 14px rgba(74,54,25,.16)); } }
@keyframes ariFlyHit { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(.2) rotate(16deg); opacity: .15; } }
@keyframes ariAttentionPulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 10px 14px rgba(74,54,25,.18)); } 50% { transform: translate(-50%, -50%) scale(1.16); filter: drop-shadow(0 0 18px rgba(255,216,61,.78)); } }
@keyframes ariNeutralHint { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }

@media (max-width: 780px) {
  .ari-start-content, .ari-result-content { grid-template-columns: 1fr; gap: 28px; }
  .ari-start-panel, .ari-result-panel, .ari-video-panel { padding: 28px 22px; border-radius: 40px; }
  .ari-round-icon { width: 132px; height: 132px; margin: 0 auto; }
  .ari-arrow-actions { gap: clamp(36px, 10vw, 96px); }
  .ari-fly--left { left: 40%; }
  .ari-fly--right { left: 60%; }
}


/* 貓狗反向選擇：保留原本卡片與場景，只替換遊戲核心 */
.ari-animal-choice-row {
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

.ari-animal-choice {
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

.ari-animal-choice img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 12px 12px rgba(74,54,25,.16));
}

.ari-animal-choice.is-clickable {
  cursor: pointer;
  opacity: 1;
  animation: ariAnimalReady 1s ease-in-out infinite alternate;
}

.ari-animal-choice.is-clickable:hover,
.ari-animal-choice.is-clickable:focus-visible {
  transform: translateY(-7px) scale(1.035);
  filter: brightness(1.04);
  outline-color: #74b947;
}

.ari-animal-choice.is-clickable:active {
  transform: translateY(2px) scale(.98);
}

.ari-listen-status {
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

.ari-retry-audio {
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

.ari-animal-choice.is-neutral-hint { animation: ariNeutralHint .38s ease-in-out 0s 3 both; }
.ari-animal-choice.is-direct-hint { box-shadow: 0 0 0 10px rgba(112,190,72,.28), 0 0 32px rgba(112,190,72,.75); transform: scale(1.06); }
.ari-animal-choice.is-feedback { filter: drop-shadow(0 0 20px rgba(93,190,76,.8)); }
@keyframes ariNeutralHint { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 75% { transform: translateX(7px); } }

@keyframes ariAnimalReady {
  from { box-shadow: 0 12px 0 rgba(205,125,35,.20), 0 20px 28px rgba(87,58,24,.16), inset 0 0 0 8px rgba(255,224,134,.26); }
  to { box-shadow: 0 12px 0 rgba(205,125,35,.20), 0 20px 38px rgba(117,180,61,.34), inset 0 0 0 8px rgba(255,224,134,.26); }
}

@media (max-width: 780px) {
  .ari-animal-choice-row {
    padding: 92px 28px 135px;
    gap: 24px;
  }
  .ari-animal-choice {
    width: min(38vw, 240px);
    height: min(38vw, 240px);
    border-radius: 28px;
    padding: 14px;
  }
  .ari-listen-status { top: 34px; min-width: 230px; }
}
`;
