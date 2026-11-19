import { ARI_PROTOCOL_VERSION, ARI_TRAINING_CONFIG, normalizeAriDifficulty } from "../utils/ariProtocol";
import { useTrainingAchievementAssignment } from "../utils/useTrainingAchievementAssignment";
import { gameLocalStorage as localStorage } from "../temporaryGameTesting/runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/GamePage_ARI.css";
import AriPageStyles from "../components/AriPageStyles";
import "../styles/ARITraining.css";

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
import startAvatar from "../asset/ARI_icon.webp";
import homeStartBtn from "../asset/home/start.webp";
import homeNextBtn from "../asset/home/next.webp";
import homeSkipBtn from "../asset/home/skip.webp";
import homeBackBtn from "../asset/home/back.webp";
import homeAgainBtn from "../asset/home/again.webp";
import homeResultBtn from "../asset/home/result.webp";
import mouseGuideImg from "../asset/mouse.webp";

import catImg from "../asset/ARI/training/cat.webp";
import dogImg from "../asset/ARI/training/dog.webp";
import catSound from "../asset/ARI/training/cat.mp3";
import dogSound from "../asset/ARI/training/dog.mp3";
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
        <AriPageStyles />
        <main className="ari-center-shell ari-start-shell">
          <section className="ari-soft-panel ari-start-panel game-start-card-artwork ari-opening-card-artwork" aria-label="開始畫面">
            <div className="ari-game-title">貓狗合唱團</div>
            <div className="ari-start-content">
              <div className="ari-dialog-bubble ari-opening-bubble">仔細聽聲音，選出相反的動物。</div>
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
    const onAction = isIntro ? handleIntroEnd : isTeaching ? startTest : handleEndingVideoEnd;
    const actionImage = isTeaching ? asset.homeNextBtn : asset.homeSkipBtn;
    const actionButtonClass = isTeaching ? "ari-btn-next" : "ari-btn-skip";
    const actionLabel = isTeaching ? "下一步" : "跳過動畫";
    return (
      <div className="ari-page ari-page--soft" style={{ "--ari-bg": `url(${asset.background})` }}>
        <AriPageStyles />
        <main className="ari-center-shell test-video-layout">
          <section className="ari-soft-panel ari-video-panel game-start-card-artwork ari-video-card-artwork test-video-card" aria-label={isIntro ? "開場影片" : isTeaching ? "步驟教學影片" : "結束影片"}>
            <div className="ari-video-frame test-step-video-frame test-video-frame">
              <video key={phase} className="ari-video test-step-video test-video" src={videoSrc} autoPlay muted playsInline controls preload="metadata" onEnded={onAction}>你的瀏覽器不支援影片播放。</video>
            </div>
            {isIntro ? <div className="ari-step-actions test-video-actions"><div className="ari-guided-action ari-guided-next">
              <button type="button" className={`ari-forest-button ari-image-button ${actionButtonClass}`} onClick={onAction} aria-label={actionLabel}>
                <img loading="lazy" src={actionImage} alt={actionLabel} draggable="false" />
              </button>
              <img loading="lazy" className="ari-mouse-guide ari-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
            </div></div> : <div className="ari-step-actions test-video-actions">
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
        <AriPageStyles />
        <main className="ari-center-shell ari-result-shell">
          <section className="ari-soft-panel ari-result-panel game-result-card-artwork" aria-label="測驗結果">
            <div className="ari-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1,2,3].map((star) => <span key={star} className={`ari-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>)}
            </div>
            <div className="ari-start-content ari-result-content">
              <div className="ari-dialog-bubble">{pendingResult?.completed ? "關卡完成！你很認真聽聲音並找到相反的動物。" : "聲音沒有成功播放，這次先休息一下，等等再試一次。"}</div>
              <div className="ari-round-icon ari-result-icon"><img src={asset.startAvatar} alt="狐狸角色" draggable="false" /></div>
            </div>
            <div className="ari-result-actions ari-training-result-actions">
              <div className="ari-guided-action ari-guided-result-main">
                <button type="button" className="ari-forest-button ari-image-button ari-btn-home" onClick={() => navigate(FOREST_ROUTE)} aria-label="回到森林">
                  <img loading="lazy" src={asset.homeBackBtn} alt="回到森林" draggable="false" />
                </button>
                <img loading="lazy" className="ari-mouse-guide ari-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
              </div>
              <button type="button" className="ari-forest-button ari-image-button ari-btn-replay" onClick={handleStart} aria-label="再玩一次">
                <img loading="lazy" src={asset.homeAgainBtn} alt="再玩一次" draggable="false" />
              </button>
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
    <div className="ari-page ari-page--soft ari-page--training" style={{ "--ari-bg": `url(${asset.background})` }}>
      <AriPageStyles />
      <div className="ari-container">
        <div className="ari-stage" onPointerDownCapture={handleStagePointerDown} data-testid="ari-training-stage" data-difficulty={difficultyKey} data-can-answer={canAnswer} data-trial={trialIndex + 1}>
          <div className={audioError ? "ari-listen-status" : "ari-assessment-status"} aria-live="polite">
            {audioError ? "聲音沒有成功播放" : isPreparingSound ? "請準備聽聲音" : canAnswer ? "請選擇相反的動物" : "請稍候"}
            {canAnswer && <span className="ari-answer-countdown" role="timer" aria-label="作答剩餘時間">{difficulty.label} · 剩餘 {remainingSeconds} 秒</span>}
          </div>
          <div className="ari-animal-choice-row" aria-label="選擇動物">
            <button type="button" className={`ari-animal-choice ${canAnswer ? "is-clickable" : ""} ${hintType === "direct" && leftTarget === currentTrial?.correctTarget ? "is-direct-hint" : ""} ${feedbackTarget === leftTarget ? "is-feedback" : ""}`} onClick={() => handleAnswer(leftTarget, "left")} data-answer-zone="true" aria-disabled={!canAnswer} disabled={!canAnswer}>
              <img loading="lazy" src={leftTarget === "cat" ? asset.cat : asset.dog} alt={leftTarget === "cat" ? "貓咪" : "狗狗"} draggable="false" />
              {hintType === "direct" && leftTarget === currentTrial?.correctTarget && <img className="ari-answer-mouse" src={asset.mouseGuideImg} alt="MOUSE 提示正確動物" draggable="false" />}
            </button>
            <button type="button" className={`ari-animal-choice ${canAnswer ? "is-clickable" : ""} ${hintType === "direct" && rightTarget === currentTrial?.correctTarget ? "is-direct-hint" : ""} ${feedbackTarget === rightTarget ? "is-feedback" : ""}`} onClick={() => handleAnswer(rightTarget, "right")} data-answer-zone="true" aria-disabled={!canAnswer} disabled={!canAnswer}>
              <img loading="lazy" src={rightTarget === "cat" ? asset.cat : asset.dog} alt={rightTarget === "cat" ? "貓咪" : "狗狗"} draggable="false" />
              {hintType === "direct" && rightTarget === currentTrial?.correctTarget && <img className="ari-answer-mouse" src={asset.mouseGuideImg} alt="MOUSE 提示正確動物" draggable="false" />}
            </button>
          </div>
          {difficulty.allowReplay && <button type="button" className="ari-replay-voice" data-replay-control="true" onClick={replayCurrentSound} disabled={(!canAnswer && !audioError) || isReplaying} aria-label="重播動物聲音">
            <img src={replayIcon} alt="" draggable="false" />
          </button>}
          {audioError && <button type="button" className="ari-retry-audio" onClick={() => finishTraining(trialRecordsRef.current, { reason: "audio_error" })}>結束本次訓練</button>}
        </div>
      </div>
    </div>
  );
}
