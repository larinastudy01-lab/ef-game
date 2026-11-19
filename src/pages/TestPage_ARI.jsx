import { gameLocalStorage as localStorage, getGameTestingVersion } from "../temporaryGameTesting/runtime";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/GamePage_ARI.css";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { saveUnifiedResult } from "../utils/resultManager";
import { useTestAttempt } from "../utils/useTestAttempt";
import { calculateAriScore } from "../utils/ariScoring";
import { ARI_ASSESSMENT_CONFIG } from "../utils/ariProtocol";
import AriPractice from "../components/AriPractice";
import AriPageStyles from "../components/AriPageStyles";
import { playAriPracticeAudio } from "../utils/ariPracticeAudio";
import { ARI_ASSESSMENT_VERSIONS, getAriAssessmentVersion } from "../config/ariAssessmentConfig";
import { getAriAssessmentChild, getNextAriTestVersion, markAriTestVersionUsed } from "../utils/ariAssessmentVersion";

import backgroundImg from "../asset/ARI/ARI_background.webp";
import stepVideo from "../asset/optimized/mp4/ARI_step.mp4";
import startAvatar from "../asset/ARI_icon.webp";
import homeStartBtn from "../asset/home/start.webp";
import homeNextBtn from "../asset/home/next.webp";
import homeSkipBtn from "../asset/home/skip.webp";
import homeBackBtn from "../asset/home/back.webp";
import homeResultBtn from "../asset/home/result.webp";
import mouseGuideImg from "../asset/mouse.webp";

import "../styles/TestStepVideo.css";

const RESULT_ROUTE = "/result-ari";
const TEST_PAGE_ROUTE = "/test-map";
const TOTAL_TRIALS = ARI_ASSESSMENT_CONFIG.totalTrials;
const PRE_SOUND_DELAY = ARI_ASSESSMENT_CONFIG.preSoundDelay;
const ANSWER_TIME_LIMIT = ARI_ASSESSMENT_CONFIG.answerTimeLimit;
const FEEDBACK_TIME = 420;
const NEXT_TRIAL_DELAY = 260;
const ANTICIPATION_RT = 150;
const TASK_VERSION = "audio-visual-opposite-v2";
const SCORING_VERSION = "2.0.0";

const asset = {
  background: backgroundImg,
  stepVideo,
  startAvatar,
  homeStartBtn,
  homeNextBtn,
  homeSkipBtn,
  homeBackBtn,
  homeResultBtn,
  mouseGuideImg,
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

function countRecords(records, predicate) {
  return records.filter(predicate).length;
}

function withInteractionMeta(records, interactionCounts) {
  return records.map((record, index) => index === 0 ? {
    ...record,
    ...interactionCounts,
  } : record);
}

function getSuggestedAction(stars) {
  if (stars >= 3) {
    return "孩子已能穩定使用相反規則，可進入訓練模式挑戰更短的作答時間。";
  }

  if (stars === 2) {
    return "建議進入訓練模式維持普通難度，繼續練習聽完聲音後再選擇相反動物。";
  }

  return "建議先使用簡單訓練模式，延長作答時間並加強「貓叫選狗、狗叫選貓」的示範。";
}

function safeCall(label, callback, fallback = {}) {
  try {
    return callback() || fallback;
  } catch (error) {
    console.warn(`[ARI] ${label} failed`, error);
    return fallback;
  }
}

function summarizeRecords(recordsWithMeta) {
  const totalTrials = recordsWithMeta.length;
  const correctCount = countRecords(recordsWithMeta, (record) => record.isCorrect);
  const timeoutCount = countRecords(recordsWithMeta, (record) => record.timeout);
  const wrongCount = totalTrials - correctCount - timeoutCount;
  const accuracy = percent(correctCount, totalTrials);
  const avgReactionTime = averageRt(recordsWithMeta);
  const catRecords = recordsWithMeta.filter((record) => record.soundType === "cat");
  const dogRecords = recordsWithMeta.filter((record) => record.soundType === "dog");
  const sameAnimalErrorCount = countRecords(recordsWithMeta, (record) => record.errorType === "sameAnimalError");
  const anticipationCount = countRecords(recordsWithMeta, (record) => record.errorType === "anticipation");
  const firstHalf = recordsWithMeta.slice(0, Math.ceil(totalTrials / 2));
  const secondHalf = recordsWithMeta.slice(Math.ceil(totalTrials / 2));
  const firstHalfAccuracy = percent(countRecords(firstHalf, (record) => record.isCorrect), firstHalf.length);
  const secondHalfAccuracy = percent(countRecords(secondHalf, (record) => record.isCorrect), secondHalf.length);
  const attentionDrop = Math.max(firstHalfAccuracy - secondHalfAccuracy, 0);

  return {
    totalTrials,
    correctCount,
    timeoutCount,
    wrongCount,
    accuracy,
    avgReactionTime,
    catRecords,
    dogRecords,
    sameAnimalErrorCount,
    anticipationCount,
    firstHalf,
    secondHalf,
    firstHalfAccuracy,
    secondHalfAccuracy,
    attentionDrop,
  };
}

export function buildAriAssessmentTrials(assessment) {
  const combinations = [
    { soundType: "cat", correctTarget: "dog", correctPosition: "left" },
    { soundType: "cat", correctTarget: "dog", correctPosition: "right" },
    { soundType: "dog", correctTarget: "cat", correctPosition: "left" },
    { soundType: "dog", correctTarget: "cat", correctPosition: "right" },
  ];

  const baseRepeats = Math.floor(TOTAL_TRIALS / combinations.length);
  const remainder = TOTAL_TRIALS % combinations.length;
  const trials = combinations.flatMap((combination, index) =>
    Array.from({ length: baseRepeats + (index < remainder ? 1 : 0) }, () => ({ ...combination }))
  );

  return shuffleArray(trials).map((trial, index) => {
    const catPosition = trial.correctTarget === "cat"
      ? trial.correctPosition
      : trial.correctPosition === "left" ? "right" : "left";
    const dogPosition = catPosition === "left" ? "right" : "left";

    return {
      ...trial,
      trialIndex: index + 1,
      catPosition,
      dogPosition,
      soundSrc: assessment.animals[trial.soundType].sound,
    };
  });
}

export default function TestPage_ARI() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const testingVersion = getGameTestingVersion(search, Object.keys(ARI_ASSESSMENT_VERSIONS));
  const [assessmentChild, setAssessmentChild] = useState(getAriAssessmentChild);
  const [assessment, setAssessment] = useState(() =>
    getAriAssessmentVersion(testingVersion || getNextAriTestVersion(assessmentChild?.childId)));
  const assessmentMeta = {
    testVersion: assessment.testVersion,
    stimulusSetId: assessment.stimulusSetId,
    stimulusName: assessment.stimulusName,
    stimulusAnimals: assessment.stimulusAnimals,
    stimulusAnimalLabels: assessment.stimulusAnimalLabels,
  };
  const testAttempt = useTestAttempt({ gameId: "ARI", route: "/test-ari" });
  const trials = useMemo(() => buildAriAssessmentTrials(assessment), [assessment]);
  const [phase, setPhase] = useState("start");
  const [trialIndex, setTrialIndex] = useState(0);
  const [canAnswer, setCanAnswer] = useState(false);
  const [isPreparingSound, setIsPreparingSound] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [trialRecords, setTrialRecords] = useState([]);
  const [pendingResult, setPendingResult] = useState(null);
  const [resultAudioIssue, setResultAudioIssue] = useState(false);
  const [resultAudioRetry, setResultAudioRetry] = useState(0);

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

  const stopAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.onplaying = null;
    audioRef.current.onerror = null;
    audioRef.current = null;
  }, []);

  const clearCurrentTimer = useCallback(() => {
    timeoutRefs.current.forEach(window.clearTimeout);
    timeoutRefs.current = [];
    stopAudio();
  }, [stopAudio]);

  useEffect(() => () => clearCurrentTimer(), [clearCurrentTimer]);

  useEffect(() => {
    if (phase !== "result") return undefined;
    const controller = new AbortController();
    setResultAudioIssue(false);
    playAriPracticeAudio(assessment.audio.assessmentComplete, controller.signal).catch(() => {
      if (!controller.signal.aborted) setResultAudioIssue(true);
    });
    return () => controller.abort();
  }, [phase, resultAudioRetry, assessment]);

  function resetTestState() {
    clearCurrentTimer();
    setPendingResult(null);
    setTrialIndex(0);
    setTrialRecords([]);
    setCanAnswer(false);
    setIsPreparingSound(false);
    setAudioError(false);
    trialIndexRef.current = 0;
    trialRecordsRef.current = [];
    randomClickCountRef.current = 0;
    prematureClickCountRef.current = 0;
    repeatedClickCountRef.current = 0;
    lastPointerTimeRef.current = 0;
    answeredRef.current = false;
    finishingRef.current = false;
    probeStartTimeRef.current = null;
  }

  function handleStart() {
    const child = getAriAssessmentChild();
    setAssessmentChild(child);
    setAssessment(getAriAssessmentVersion(testingVersion || getNextAriTestVersion(child?.childId)));
    resetTestState();
    setPhase("teaching");
  }

  function startTest() {
    resetTestState();
    testAttempt.begin(assessmentChild);
    testAttempt.checkpoint(assessmentMeta);
    markAriTestVersionUsed(assessmentChild?.childId, assessment.testVersion);
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
    setIsPreparingSound(true);
    addTimeout(() => playTrialSound(index), PRE_SOUND_DELAY);
  }

  function playTrialSound(index) {
    const trial = trials[index];
    if (!trial || answeredRef.current || trialIndexRef.current !== index) return;
    stopAudio();
    const audio = new Audio(trial.soundSrc);
    audio.preload = "auto";
    audioRef.current = audio;
    audio.onplaying = () => {
      if (audioRef.current !== audio || answeredRef.current || trialIndexRef.current !== index || Number.isFinite(probeStartTimeRef.current)) return;
      audio.onplaying = null;
      probeStartTimeRef.current = performance.now();
      setIsPreparingSound(false);
      setAudioError(false);
      setCanAnswer(true);
      addTimeout(() => {
        if (!answeredRef.current && trialIndexRef.current === index) handleTimeout(index);
      }, ANSWER_TIME_LIMIT);
    };
    const fail = () => {
      if (audioRef.current !== audio || trialIndexRef.current !== index || finishingRef.current) return;
      clearCurrentTimer();
      finishingRef.current = true;
      setIsPreparingSound(false);
      setCanAnswer(false);
      setAudioError(true);
      testAttempt.checkpoint({ trials: trialRecordsRef.current, audioPlaybackFailure: { trialIndex: index + 1, timestamp: new Date().toISOString() } });
      testAttempt.interrupt("audio_playback_failed");
    };
    audio.onerror = fail;
    audio.play().catch(fail);
    addTimeout(() => { if (!Number.isFinite(probeStartTimeRef.current)) fail(); }, 4000);
  }

  function buildRecord({ trial, selectedTarget, selectedPosition, reactionTime, timeout }) {
    const targetCorrect = !timeout && selectedTarget === trial.correctTarget;
    const isAnticipation = Number.isFinite(reactionTime) && reactionTime < ANTICIPATION_RT;
    const isCorrect = targetCorrect && !isAnticipation;
    return {
      ...assessmentMeta,
      soundAnimal: assessment.animals[trial.soundType].id,
      expectedAnimal: assessment.animals[trial.correctTarget].id,
      selectedAnimal: selectedTarget ? assessment.animals[selectedTarget].id : null,
      trialIndex: trial.trialIndex,
      mode: "test",
      allowReplay: false,
      answerTimeLimit: ANSWER_TIME_LIMIT,
      difficulty: "normal",
      difficultyKey: "normal",
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
    if (performance.now() - probeStartTimeRef.current >= ANSWER_TIME_LIMIT) { handleTimeout(trialIndexRef.current); return; }
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
    testAttempt.checkpoint({ trials: updated });
    setTrialRecords(updated);
    setCanAnswer(false);
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
    testAttempt.checkpoint({ trials: updated });
    setTrialRecords(updated);
    setCanAnswer(false);
    addTimeout(() => goNextTrial(updated, index), FEEDBACK_TIME);
  }

  function goNextTrial(records, currentIndex) {
    clearCurrentTimer();
    setCanAnswer(false);
    setAudioError(false);
    setIsPreparingSound(false);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= TOTAL_TRIALS) {
      finishTest(records);
      return;
    }
    trialIndexRef.current = nextIndex;
    setTrialIndex(nextIndex);
    addTimeout(() => startTrial(nextIndex), NEXT_TRIAL_DELAY);
  }

  function safeScoring(records) {
    try {
      return calculateAriScore(records, {
        mode: "test",
        difficulty: "normal",
        plannedTotalRounds: TOTAL_TRIALS,
        taskRule: assessment.taskRule,
      }) || {};
    } catch (error) {
      console.error("ARI 測驗評分失敗：", error);
      return {};
    }
  }

  function finishTest(records) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearCurrentTimer();

    const interactionCounts = {
      randomClickCount: randomClickCountRef.current,
      prematureClickCount: prematureClickCountRef.current,
      repeatedClickCount: repeatedClickCountRef.current,
    };
    const recordsWithMeta = withInteractionMeta(records, interactionCounts);
    const summary = summarizeRecords(recordsWithMeta);
    const {
      totalTrials,
      correctCount,
      timeoutCount,
      wrongCount,
      accuracy,
      avgReactionTime,
      catRecords,
      dogRecords,
      sameAnimalErrorCount,
      anticipationCount,
      firstHalf,
      secondHalf,
      firstHalfAccuracy,
      secondHalfAccuracy,
      attentionDrop,
    } = summary;

    const errorTypes = {
      miss: timeoutCount,
      timeout: timeoutCount,
      sameAnimalError: sameAnimalErrorCount,
      wrongTarget: sameAnimalErrorCount,
      anticipation: anticipationCount,
      randomClick: interactionCounts.randomClickCount,
      prematureClick: interactionCounts.prematureClickCount,
      repeatedClick: interactionCounts.repeatedClickCount,
      distractorError: 0,
      incongruentError: 0,
      sequenceError: 0,
      ruleSwitchError: 0,
    };

    const ariScoring = safeScoring(recordsWithMeta);
    const performanceResult = safeCall("analyzePerformance", () =>
      analyzePerformance({
        totalTrials,
        correctTrials: correctCount,
        reactionTimes: recordsWithMeta.map((r) => r.reactionTime).filter(Number.isFinite),
        errorTypes,
        difficulty: "normal",
      })
    );
    const errorResult = safeCall("analyzeErrors", () => analyzeErrors(errorTypes));
    const fatigueResult = safeCall("analyzeFatigue", () =>
      analyzeFatigue({
        firstHalfRT: averageRt(firstHalf) || 0,
        secondHalfRT: averageRt(secondHalf) || 0,
        missIncrease: Math.max(countRecords(secondHalf, (r) => r.timeout) - countRecords(firstHalf, (r) => r.timeout), 0),
      })
    );

    const fatigueLevel = fatigueResult?.fatigueLevel || "low";
    const recommendedDifficulty = safeCall("getRecommendedDifficulty", () =>
      getRecommendedDifficulty({
        accuracy: performanceResult.accuracy ?? accuracy,
        avgReactionTime: performanceResult.avgReactionTime ?? avgReactionTime,
        errorTypes,
        fatigueLevel,
      }),
      "normal"
    );

    const scoringSummary = ariScoring.summary || {};
    const scoringParentView = ariScoring.parentView || {};
    const scoringClinicalView = ariScoring.clinicalView || {};
    const finalRecommendedDifficulty = recommendedDifficulty || "normal";
    const stars = Number(ariScoring.stars) || (accuracy >= 85 ? 3 : accuracy >= 65 ? 2 : 1);
    const totalScore = Number.isFinite(Number(ariScoring.totalScore))
      ? Number(ariScoring.totalScore)
      : accuracy;
    const finishedAt = new Date().toISOString();

    const result = testAttempt.complete({
      protocol: ARI_ASSESSMENT_CONFIG,
      promptCount: 0, promptEvents: [], replayCount: 0, replayEvents: [],
      taskName: "貓狗合唱團",
      taskCode: "ARI",
      taskVersion: TASK_VERSION,
      scoringVersion: ariScoring.scoringVersion || SCORING_VERSION,
      ...assessmentMeta,
      taskRule: assessment.taskRule,
      gameId: "ARI",
      abilityType: "attention_control",
      mode: "test",
      difficulty: "normal",
      difficultyKey: "normal",
      difficultyLabel: ariScoring.difficultyLabel || "普通",
      expectedTrials: TOTAL_TRIALS,
      resultViews: ["child", "parent", "clinician"],
      resultSource: "ariScoring",
      isFinalized: true,

      // 頂層摘要與正式評分器保持一致，方便結果頁、歷史紀錄與醫療端直接讀取。
      totalTrials: scoringSummary.totalTrials ?? totalTrials,
      completionRate: scoringSummary.completionRate ?? percent(totalTrials, TOTAL_TRIALS),
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

      scoring: ariScoring,
      clinicalView: scoringClinicalView,
      parentView: scoringParentView,
      childView: ariScoring.childView || null,
      totalScore,
      score: totalScore,
      stars,
      performanceLevel: ariScoring.performanceLevel || (stars >= 3 ? "good" : stars >= 2 ? "developing" : "needs_support"),

      // 測驗模式不進行自動升降級；此欄提供家長可執行的下一步建議。
      suggestedAction: getSuggestedAction(stars),
      parentSummary: scoringParentView.plainLanguageSummary || scoringParentView.summary || performanceResult.parentSummary || "",
      warningLevel: errorResult.warningLevel || "none",

      // 保留通用分析，供既有儀表板相容使用；正式分數以 scoring 為準。
      performance: performanceResult,
      errorAnalysis: errorResult,
      fatigueAnalysis: fatigueResult,
      records: recordsWithMeta,
      startedFrom: "TestPage_ARI",
      finishedAt,
      generatedAt: ariScoring.generatedAt || finishedAt,
    });

    try {
      saveUnifiedResult({
        rawResult: result,
        gameId: "ARI",
        mode: "test",
        difficulty: "normal",
        route: "/test-ari",
        visibleRoles: ["child", "parent", "clinician"],
      });
    } catch (error) {
      console.warn("[ARI] saveUnifiedResult failed", error);
    }

    try {
      localStorage.setItem("ariTestResult", JSON.stringify(result));
      localStorage.setItem("latestAriResult", JSON.stringify(result));
      localStorage.setItem("latestAriResultMode", "test");
      localStorage.setItem("latestAriResultVersion", TASK_VERSION);
    } catch (error) {
      console.error("儲存 ARI 測驗結果失敗：", error);
    }

    setPendingResult(result);
    setPhase("result");
  }

  function goResultPage() {
    if (!pendingResult) return;
    navigate(RESULT_ROUTE, { state: pendingResult, replace: true });
  }

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

  if (phase === "practice") {
    return (
      <div className="ari-page ari-page--soft ari-page--practice" style={{ "--ari-bg": `url(${asset.background})` }}>
        <AriPageStyles />
        <AriPractice assessment={assessment} onComplete={startTest} onReviewStep={() => setPhase("teaching")} />
      </div>
    );
  }

  if (phase === "teaching") {
    return (
      <div className="ari-page ari-page--soft" style={{ "--ari-bg": `url(${asset.background})` }}>
        <AriPageStyles />
        <main className="ari-center-shell test-video-layout">
          <section className="ari-soft-panel ari-video-panel game-start-card-artwork ari-video-card-artwork test-video-card" aria-label="步驟教學影片">
            <div className="ari-video-frame test-step-video-frame test-video-frame">
              <video className="ari-video test-step-video test-video" src={asset.stepVideo} autoPlay muted playsInline controls preload="metadata" onEnded={() => setPhase("practice")}>
                你的瀏覽器不支援影片播放。
              </video>
            </div>
            <div className="ari-step-actions test-video-actions">
              <div className="ari-guided-action ari-guided-skip">
                <button type="button" className="ari-forest-button ari-image-button ari-btn-skip" onClick={() => setPhase("practice")} aria-label="跳過動畫">
                  <img loading="lazy" src={asset.homeSkipBtn} alt="跳過動畫" draggable="false" />
                </button>
              </div>
              <div className="ari-guided-action ari-guided-next">
                <button type="button" className="ari-forest-button ari-image-button ari-btn-next" onClick={() => setPhase("practice")} aria-label="下一步">
                  <img loading="lazy" src={asset.homeNextBtn} alt="下一步" draggable="false" />
                </button>
                <img loading="lazy" className="ari-mouse-guide ari-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
              </div>
            </div>
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
              <div className="ari-dialog-bubble">測驗完成！你有仔細聽聲音並選出相反的動物。</div>
              <div className="ari-round-icon ari-result-icon"><img src={asset.startAvatar} alt="狐狸角色" draggable="false" /></div>
            </div>
            <div className="ari-result-actions">
              {resultAudioIssue && <button type="button" className="ari-forest-button" onClick={() => setResultAudioRetry((value) => value + 1)}>重新播放完成語音</button>}
              <div className="ari-guided-action ari-guided-result-main">
                <button type="button" className="ari-forest-button ari-image-button ari-btn-home" onClick={() => navigate(TEST_PAGE_ROUTE)} aria-label="回到森林">
                  <img loading="lazy" src={asset.homeBackBtn} alt="回到森林" draggable="false" />
                </button>
                <img loading="lazy" className="ari-mouse-guide ari-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
              </div>
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
      <AriPageStyles />
      <div className="ari-container">
        <div className="ari-stage" onPointerDownCapture={handleStagePointerDown} data-testid="ari-assessment-stage" data-trial={trialIndex + 1} data-can-answer={canAnswer} data-test-version={assessment.testVersion} data-stimulus-set={assessment.stimulusSetId}>
          <div className={audioError ? "ari-listen-status" : "ari-assessment-status"} aria-live="polite">
            {audioError ? "聲音未能播放，本次評測已中斷，請返回測驗地圖重新開始。" : isPreparingSound ? "請準備聽聲音" : canAnswer ? "請選擇相反的動物" : "請稍候"}
          </div>
          <div className="ari-animal-choice-row" aria-label="選擇動物">
            <button type="button" className={`ari-animal-choice ${canAnswer ? "is-clickable" : ""}`} onClick={() => handleAnswer(leftTarget, "left")} data-answer-zone="true" aria-disabled={!canAnswer} disabled={!canAnswer}>
              <img loading="lazy" src={assessment.animals[leftTarget].image} alt={assessment.animals[leftTarget].label} draggable="false" />
            </button>
            <button type="button" className={`ari-animal-choice ${canAnswer ? "is-clickable" : ""}`} onClick={() => handleAnswer(rightTarget, "right")} data-answer-zone="true" aria-disabled={!canAnswer} disabled={!canAnswer}>
              <img loading="lazy" src={assessment.animals[rightTarget].image} alt={assessment.animals[rightTarget].label} draggable="false" />
            </button>
          </div>
          {audioError && <button type="button" className="ari-retry-audio" onClick={() => navigate(TEST_PAGE_ROUTE)}>返回測驗地圖</button>}
        </div>
      </div>
    </div>
  );
}
