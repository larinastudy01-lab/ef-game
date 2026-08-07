import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/GamePage_SSG.css";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { saveUnifiedResult } from "../utils/resultManager";
import { calculateSsgScore } from "../utils/ssgScoring";

import backgroundImg from "../asset/SSG/SSG_background.webp";
import introVideo from "../asset/optimized/mp4/SSG_start.mp4";
import stepVideo from "../asset/optimized/mp4/SSG_step.mp4";
import endingVideo from "../asset/optimized/mp4/SSG_end.mp4";
import startAvatar from "../asset/avatar/fox.webp";
import homeStartBtn from "../asset/home/start.webp";
import homeNextBtn from "../asset/home/next.webp";
import homeSkipBtn from "../asset/home/skip.webp";
import homeBackBtn from "../asset/home/back.webp";
import homeResultBtn from "../asset/home/result.webp";
import mouseGuideImg from "../asset/mouse.webp";

import catImg from "../asset/SSG/cat.webp";
import dogImg from "../asset/SSG/dog.webp";
import catSound from "../asset/SSG/cat.mp3";
import dogSound from "../asset/SSG/dog.mp3";

const RESULT_ROUTE = "/result-ssg";
const TEST_PAGE_ROUTE = "/test-map";
const TOTAL_TRIALS = 20;
const PRE_SOUND_DELAY = 500;
const ANSWER_TIME_LIMIT = 5000;
const FEEDBACK_TIME = 420;
const NEXT_TRIAL_DELAY = 260;
const ANTICIPATION_RT = 150;
const TASK_VERSION = "audio-visual-opposite-v2";
const SCORING_VERSION = "2.0.0";

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
    console.warn(`[SSG] ${label} failed`, error);
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

function buildTrials() {
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
      soundSrc: trial.soundType === "cat" ? asset.catSound : asset.dogSound,
    };
  });
}

export default function TestPage_SSG() {
  const navigate = useNavigate();
  const trials = useMemo(() => buildTrials(), []);
  const [phase, setPhase] = useState("start");
  const [trialIndex, setTrialIndex] = useState(0);
  const [canAnswer, setCanAnswer] = useState(false);
  const [isPreparingSound, setIsPreparingSound] = useState(false);
  const [audioError, setAudioError] = useState(false);
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
      if (answeredRef.current || trialIndexRef.current !== index) return;
      probeStartTimeRef.current = performance.now();
      setIsPreparingSound(false);
      setAudioError(false);
      setCanAnswer(true);
      addTimeout(() => {
        if (!answeredRef.current && trialIndexRef.current === index) handleTimeout(index);
      }, ANSWER_TIME_LIMIT);
    };
    audio.onerror = () => {
      if (trialIndexRef.current !== index) return;
      setIsPreparingSound(false);
      setCanAnswer(false);
      setAudioError(true);
    };
    audio.play().catch(() => {
      if (trialIndexRef.current !== index) return;
      setIsPreparingSound(false);
      setCanAnswer(false);
      setAudioError(true);
    });
  }

  function retryCurrentSound() {
    if (!audioError) return;
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
      mode: "test",
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
      return calculateSsgScore(records, {
        mode: "test",
        difficulty: "normal",
        plannedTotalRounds: TOTAL_TRIALS,
      }) || {};
    } catch (error) {
      console.error("SSG 測驗評分失敗：", error);
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

    const ssgScoring = safeScoring(recordsWithMeta);
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

    const scoringSummary = ssgScoring.summary || {};
    const scoringParentView = ssgScoring.parentView || {};
    const scoringClinicalView = ssgScoring.clinicalView || {};
    const finalRecommendedDifficulty = recommendedDifficulty || "normal";
    const stars = Number(ssgScoring.stars) || (accuracy >= 85 ? 3 : accuracy >= 65 ? 2 : 1);
    const totalScore = Number.isFinite(Number(ssgScoring.totalScore))
      ? Number(ssgScoring.totalScore)
      : accuracy;
    const finishedAt = new Date().toISOString();

    const result = {
      taskName: "貓狗合唱團",
      taskCode: "SSG",
      taskVersion: TASK_VERSION,
      scoringVersion: ssgScoring.scoringVersion || SCORING_VERSION,
      taskRule: "catSoundSelectDog_dogSoundSelectCat",
      gameId: "SSG",
      abilityType: "attention_control",
      mode: "test",
      difficulty: "normal",
      difficultyKey: "normal",
      difficultyLabel: ssgScoring.difficultyLabel || "普通",
      expectedTrials: TOTAL_TRIALS,
      resultViews: ["child", "parent", "clinician"],
      resultSource: "ssgScoring",
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

      scoring: ssgScoring,
      clinicalView: scoringClinicalView,
      parentView: scoringParentView,
      childView: ssgScoring.childView || null,
      totalScore,
      score: totalScore,
      stars,
      performanceLevel: ssgScoring.performanceLevel || (stars >= 3 ? "good" : stars >= 2 ? "developing" : "needs_support"),

      // 測驗模式不進行自動升降級；此欄提供家長可執行的下一步建議。
      suggestedAction: getSuggestedAction(stars),
      parentSummary: scoringParentView.plainLanguageSummary || scoringParentView.summary || performanceResult.parentSummary || "",
      warningLevel: errorResult.warningLevel || "none",

      // 保留通用分析，供既有儀表板相容使用；正式分數以 scoring 為準。
      performance: performanceResult,
      errorAnalysis: errorResult,
      fatigueAnalysis: fatigueResult,
      records: recordsWithMeta,
      startedFrom: "TestPage_SSG",
      finishedAt,
      generatedAt: ssgScoring.generatedAt || finishedAt,
    };

    try {
      saveUnifiedResult({
        rawResult: result,
        gameId: "SSG",
        mode: "test",
        difficulty: "normal",
        route: "/test-ssg",
        visibleRoles: ["child", "parent", "clinician"],
      });
    } catch (error) {
      console.warn("[SSG] saveUnifiedResult failed", error);
    }

    try {
      localStorage.setItem("ssgTestResult", JSON.stringify(result));
      localStorage.setItem("latestSsgResult", JSON.stringify(result));
      localStorage.setItem("latestSsgResultMode", "test");
      localStorage.setItem("latestSsgResultVersion", TASK_VERSION);
    } catch (error) {
      console.error("儲存 SSG 測驗結果失敗：", error);
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
      <div className="ssg-page ssg-page--soft" style={{ "--ssg-bg": `url(${asset.background})` }}>
        <style>{ssgInlineCss}</style>
        <main className="ssg-center-shell ssg-start-shell">
          <section className="ssg-soft-panel ssg-start-panel game-start-card-artwork ssg-opening-card-artwork" aria-label="開始畫面">
            <div className="ssg-game-title">貓狗合唱團</div>
            <div className="ssg-start-content">
              <div className="ssg-dialog-bubble ssg-opening-bubble">仔細聽聲音，選出相反的動物。</div>
              <div className="ssg-round-icon ssg-start-avatar"><img src={asset.startAvatar} alt="開始角色" draggable="false" /></div>
            </div>
            <div className="ssg-guided-action ssg-guided-start">
              <button type="button" className="ssg-forest-button ssg-image-button ssg-btn-start" onClick={handleStart} aria-label="進入遊戲">
                <img src={asset.homeStartBtn} alt="進入遊戲" draggable="false" />
              </button>
              <img loading="lazy" className="ssg-mouse-guide ssg-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "introVideo" || phase === "teaching" || phase === "endingVideo") {
    const isIntro = phase === "introVideo";
    const isTeaching = phase === "teaching";
    const isEnding = phase === "endingVideo";
    const videoSrc = isIntro ? asset.introVideo : isTeaching ? asset.stepVideo : asset.endingVideo;
    const onEnded = isIntro ? handleIntroEnd : isTeaching ? startTest : handleEndingVideoEnd;
    const continueAction = isIntro ? handleIntroEnd : isTeaching ? startTest : handleEndingVideoEnd;

    return (
      <div className="ssg-page ssg-page--soft" style={{ "--ssg-bg": `url(${asset.background})` }}>
        <style>{ssgInlineCss}</style>
        <main className="ssg-center-shell">
          <section className="ssg-soft-panel ssg-video-panel game-start-card-artwork ssg-video-card-artwork" aria-label={isIntro ? "前導動畫" : isTeaching ? "步驟教學影片" : "結束動畫"}>
            <div className="ssg-video-frame">
              <video className="ssg-video" src={videoSrc} autoPlay muted playsInline controls preload="metadata" onEnded={onEnded}>
                你的瀏覽器不支援影片播放。
              </video>
            </div>
            <div className="ssg-step-actions">
              {!isEnding && (
                <div className="ssg-guided-action ssg-guided-skip">
                  <button type="button" className="ssg-forest-button ssg-image-button ssg-btn-skip" onClick={continueAction} aria-label="跳過動畫">
                    <img loading="lazy" src={asset.homeSkipBtn} alt="跳過動畫" draggable="false" />
                  </button>
                </div>
              )}
              <div className="ssg-guided-action ssg-guided-next">
                <button type="button" className="ssg-forest-button ssg-image-button ssg-btn-next" onClick={continueAction} aria-label={isEnding ? "查看結果" : "下一步"}>
                  <img loading="lazy" src={isEnding ? asset.homeResultBtn : asset.homeNextBtn} alt={isEnding ? "查看結果" : "下一步"} draggable="false" />
                </button>
                <img loading="lazy" className="ssg-mouse-guide ssg-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="ssg-page ssg-page--soft" style={{ "--ssg-bg": `url(${asset.background})` }}>
        <style>{ssgInlineCss}</style>
        <main className="ssg-center-shell ssg-result-shell">
          <section className="ssg-soft-panel ssg-result-panel game-result-card-artwork" aria-label="測驗結果">
            <div className="ssg-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1,2,3].map((star) => <span key={star} className={`ssg-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>)}
            </div>
            <div className="ssg-start-content ssg-result-content">
              <div className="ssg-dialog-bubble">測驗完成！你有仔細聽聲音並選出相反的動物。</div>
              <div className="ssg-round-icon ssg-result-icon"><img src={asset.startAvatar} alt="狐狸角色" draggable="false" /></div>
            </div>
            <div className="ssg-result-actions">
              <div className="ssg-guided-action ssg-guided-result-main">
                <button type="button" className="ssg-forest-button ssg-image-button ssg-btn-home" onClick={() => navigate(TEST_PAGE_ROUTE)} aria-label="回到森林">
                  <img loading="lazy" src={asset.homeBackBtn} alt="回到森林" draggable="false" />
                </button>
                <img loading="lazy" className="ssg-mouse-guide ssg-mouse-on-button" src={asset.mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
              </div>
              <button type="button" className="ssg-forest-button ssg-image-button ssg-btn-detail" onClick={goResultPage} aria-label="詳細結果">
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
    <div className="ssg-page ssg-page--soft" style={{ "--ssg-bg": `url(${asset.background})` }}>
      <style>{ssgInlineCss}</style>
      <div className="ssg-container">
        <div className="ssg-stage" onPointerDownCapture={handleStagePointerDown}>
          <div className="ssg-listen-status" aria-live="polite">
            {audioError ? "聲音沒有成功播放" : isPreparingSound ? "請準備聽聲音" : canAnswer ? "請選擇相反的動物" : "請稍候"}
          </div>
          <div className="ssg-animal-choice-row" aria-label="選擇動物">
            <button type="button" className={`ssg-animal-choice ${canAnswer ? "is-clickable" : ""}`} onClick={() => handleAnswer(leftTarget, "left")} data-answer-zone="true" aria-disabled={!canAnswer} disabled={!canAnswer}>
              <img loading="lazy" src={leftTarget === "cat" ? asset.cat : asset.dog} alt={leftTarget === "cat" ? "貓咪" : "狗狗"} draggable="false" />
            </button>
            <button type="button" className={`ssg-animal-choice ${canAnswer ? "is-clickable" : ""}`} onClick={() => handleAnswer(rightTarget, "right")} data-answer-zone="true" aria-disabled={!canAnswer} disabled={!canAnswer}>
              <img loading="lazy" src={rightTarget === "cat" ? asset.cat : asset.dog} alt={rightTarget === "cat" ? "貓咪" : "狗狗"} draggable="false" />
            </button>
          </div>
          {audioError && <button type="button" className="ssg-retry-audio" onClick={retryCurrentSound}>重新播放聲音</button>}
        </div>
      </div>
    </div>
  );
}

const ssgInlineCss = `
.ssg-page--soft {
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

.ssg-page--soft::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 52% 9%, rgba(255,255,255,0.22), transparent 28%),
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,239,188,0.10));
  z-index: 0;
}

.ssg-center-shell {
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

.ssg-start-shell,
.ssg-result-shell {
  width: min(72vw, 860px);
}

.ssg-soft-panel {
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

.ssg-soft-panel::before {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 42px;
  border: 2px dashed rgba(230, 170, 67, 0.42);
  pointer-events: none;
}

.ssg-soft-panel::after {
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

.ssg-start-panel {
  min-height: 560px;
  padding: 58px 70px 74px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 34px;
}

.ssg-game-title {
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

.ssg-game-title::before,
.ssg-game-title::after {
  content: "🌿";
  position: absolute;
  top: 50%;
  font-size: 28px;
  transform: translateY(-50%);
}

.ssg-game-title::before { left: 18px; }
.ssg-game-title::after { right: 18px; transform: translateY(-50%) scaleX(-1); }

.ssg-start-content {
  position: relative;
  z-index: 2;
  width: min(100%, 690px);
  display: grid;
  grid-template-columns: minmax(300px, 1fr) 158px;
  align-items: center;
  justify-content: center;
  gap: 44px;
}

.ssg-dialog-bubble {
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

.ssg-opening-bubble {
  min-height: 132px;
}

.ssg-dialog-bubble::before {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: 20px;
  border: 2px dashed rgba(229, 189, 119, 0.55);
  pointer-events: none;
}

.ssg-dialog-bubble::after {
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

.ssg-round-icon {
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

.ssg-round-icon::after {
  content: "★";
  position: absolute;
  right: 4px;
  bottom: 2px;
  color: #ffd948;
  font-size: 36px;
  -webkit-text-stroke: 2px #e29b21;
  text-shadow: 0 3px 0 rgba(139, 96, 20, 0.14);
}

.ssg-round-icon img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 50%;
  display: block;
}

.ssg-start-avatar {
  background: linear-gradient(180deg, #84dcff, #42afe9);
}

.ssg-forest-button {
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

.ssg-forest-button::before,
.ssg-forest-button::after {
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

.ssg-forest-button::before { left: 12px; bottom: 9px; transform: rotate(-18deg); }
.ssg-forest-button::after { right: 12px; top: 9px; transform: rotate(154deg); }

.ssg-forest-button:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.05);
}

.ssg-forest-button:active:not(:disabled) {
  transform: translateY(1px);
}

.ssg-forest-button:disabled {
  opacity: 0.52;
  cursor: default;
  filter: grayscale(0.18);
}

.ssg-btn-start,
.ssg-btn-home,
.ssg-btn-replay,
.ssg-btn-detail,
.ssg-btn-skip,
.ssg-btn-next {
  border: 4px solid rgba(255,255,255,0.86);
  outline: 3px solid #5d9d32;
  background: linear-gradient(180deg, #b9f235 0%, #77c927 48%, #4e9a23 100%);
  box-shadow:
    0 6px 0 #377721,
    0 13px 22px rgba(61, 97, 33, 0.20),
    inset 0 4px 0 rgba(255,255,255,0.48),
    inset 0 -5px 0 rgba(49, 128, 31, 0.26);
}

.ssg-btn-replay {
  outline-color: #67a833;
}

.ssg-btn-detail {
  outline-color: #598f2e;
}

.ssg-btn-skip {
  min-width: 260px;
}


.ssg-guided-action {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}

.ssg-image-button {
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

.ssg-image-button.ssg-btn-start,
.ssg-image-button.ssg-btn-home,
.ssg-image-button.ssg-btn-replay,
.ssg-image-button.ssg-btn-detail,
.ssg-image-button.ssg-btn-skip,
.ssg-image-button.ssg-btn-next {
  min-width: 0;
  min-height: 0;
  border: none;
  outline: none;
  background: transparent;
  box-shadow: none;
}

.ssg-image-button::before,
.ssg-image-button::after {
  display: none;
}

.ssg-image-button img {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(74, 48, 16, 0.22));
}

.ssg-image-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.03);
  filter: brightness(1.04);
}

.ssg-image-button:active:not(:disabled) {
  transform: translateY(1px) scale(0.98);
}

.ssg-image-button:disabled {
  opacity: 0.56;
}

.ssg-image-button:disabled img {
  filter: grayscale(0.35) drop-shadow(0 6px 6px rgba(74, 48, 16, 0.16));
}

.ssg-btn-skip.ssg-image-button,
.ssg-btn-next.ssg-image-button {
  width: clamp(198px, 19vw, 266px);
}

.ssg-step-actions {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: clamp(18px, 3vw, 34px);
  position: relative;
  z-index: 2;
}

.ssg-mouse-guide {
  position: absolute;
  width: clamp(48px, 5.2vw, 78px);
  height: auto;
  z-index: 8;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(58, 38, 14, 0.24));
  animation: ssg-mouse-tap 1.15s ease-in-out infinite;
}

.ssg-mouse-on-button {
  right: -18px;
  bottom: -18px;
  transform-origin: 18% 18%;
}

.ssg-mouse-on-acorn {
  right: clamp(8px, 1.4vw, 18px);
  top: clamp(38px, 5vw, 70px);
  transform-origin: 18% 18%;
}

@keyframes ssg-mouse-tap {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.92; }
  45% { transform: translate(-10px, -9px) scale(1.08); opacity: 1; }
  62% { transform: translate(-4px, -4px) scale(0.96); opacity: 1; }
}

.ssg-video-panel,
.ssg-tutorial-panel {
  min-height: 78vh;
  padding: 48px 68px 38px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.ssg-video-frame {
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

.ssg-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 前導互動教學保持原本結構，只微調在新背景中不破版 */
.ssg-tutorial-scene {
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

.ssg-tutorial-scene::before {
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

.ssg-tutorial-grid {
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

.ssg-avatar-guide {
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

.ssg-avatar-guide img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
  display: block;
}

.ssg-rule-steps {
  width: 100%;
  min-height: 260px;
  display: grid;
  grid-template-rows: auto 64px auto;
  align-items: center;
  justify-items: center;
  gap: 10px;
}

.ssg-guide-bubble,
.ssg-tap-hint {
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

.ssg-guide-main,
.ssg-guide-wait {
  position: static;
}

.ssg-guide-arrow {
  width: min(100%, 320px);
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 153, 54, 0.12), rgba(255, 134, 38, 0.92));
  position: relative;
  transform: rotate(-4deg);
  transform-origin: center;
}

.ssg-guide-arrow::after {
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

.ssg-tutorial-practice {
  min-width: 168px;
  min-height: 240px;
  display: grid;
  grid-template-rows: 1fr auto;
  align-items: center;
  justify-items: center;
  gap: 16px;
  position: relative;
}

.ssg-practice-acorn {
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
  animation: ssg-practice-float 1.5s ease-in-out infinite;
}

.ssg-practice-acorn img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ssg-practice-acorn.is-ready {
  box-shadow: 0 0 0 9px rgba(255, 230, 102, 0.32), 0 0 30px rgba(255, 204, 60, 0.85);
  animation: none;
}

.ssg-tap-hint {
  font-size: clamp(18px, 2vw, 28px);
  color: #6b4b23;
  opacity: 0.95;
}

@keyframes ssg-practice-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.06); }
}

.ssg-demo-effect {
  left: 50%;
  top: 40%;
}

.ssg-play-page {
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

.ssg-test-game-area {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.ssg-test-game-area::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.04), transparent 35%);
}

.ssg-idle-flash::after {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 32px;
  pointer-events: none;
  z-index: 4;
  box-shadow: inset 0 0 40px rgba(255, 230, 120, 0.64);
  animation: ssg-idle-flash 0.9s ease-out forwards;
}

@keyframes ssg-idle-flash {
  0% { opacity: 0; }
  35% { opacity: 1; }
  100% { opacity: 0; }
}

.ssg-test-item {
  position: absolute;
  cursor: pointer;
  transform: translate(-50%, -50%);
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  -webkit-tap-highlight-color: transparent;
  z-index: 2;
  filter: drop-shadow(0 11px 12px rgba(79, 57, 20, 0.24));
  animation: ssg-test-item-pop 0.18s ease-out;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.ssg-test-item:hover {
  transform: translate(-50%, -50%) scale(1.04);
  filter: drop-shadow(0 13px 15px rgba(79, 57, 20, 0.28)) brightness(1.06);
}

.ssg-test-item:active {
  transform: translate(-50%, -50%) scale(0.94);
}

@keyframes ssg-test-item-pop {
  from { transform: translate(-50%, -50%) scale(0.72); opacity: 0; }
  to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

.ssg-test-effect {
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
  animation: ssg-test-effect-pop 0.42s ease-out forwards;
}

.ssg-test-effect.is-penalty {
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.86) 0 10%, rgba(255, 138, 120, 0.72) 11% 35%, rgba(255, 70, 50, 0.16) 60%, rgba(255, 70, 50, 0) 72%);
  box-shadow:
    0 0 0 7px rgba(255, 108, 87, 0.16),
    0 0 24px rgba(255, 96, 70, 0.52),
    0 0 44px rgba(209, 58, 38, 0.26);
}

@keyframes ssg-test-effect-pop {
  from { transform: translate(-50%, -50%) scale(0.7); opacity: 0.95; }
  to { transform: translate(-50%, -50%) scale(1.45); opacity: 0; }
}

.ssg-result-panel {
  min-height: 500px;
  padding: 92px 56px 60px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 44px;
}

.ssg-result-panel::before {
  inset: 18px;
}

.ssg-cute-stars {
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

.ssg-cute-star {
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

.ssg-cute-star:nth-child(2) {
  transform: translateY(-12px) rotate(2deg) scale(1.15);
}

.ssg-cute-star:nth-child(3) {
  transform: rotate(7deg);
}

.ssg-cute-star.is-on {
  color: #ffd53d;
  opacity: 1;
  -webkit-text-stroke: 7px rgba(255,255,255,0.98);
  text-shadow:
    0 4px 0 #e39d19,
    0 8px 16px rgba(121, 74, 6, 0.30),
    0 0 18px rgba(255, 249, 171, 0.95);
}

.ssg-result-content {
  width: min(100%, 720px);
}

.ssg-result-icon {
  width: 170px;
  height: 170px;
  padding: 13px;
}

.ssg-result-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
  width: 100%;
}

.ssg-result-actions .ssg-forest-button {
  min-width: 188px;
  min-height: 70px;
  font-size: clamp(22px, 2.2vw, 30px);
  border-radius: 20px;
}

.ssg-result-actions .ssg-image-button {
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

.ssg-soft-panel {
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

.ssg-soft-panel::before {
  border-color: rgba(255, 245, 205, 0.58);
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.50),
    inset 0 -3px 8px rgba(139, 88, 23, 0.12);
}

.ssg-soft-panel::after {
  filter:
    drop-shadow(0 4px 2px rgba(60, 105, 27, 0.22))
    drop-shadow(0 10px 10px rgba(88, 57, 19, 0.16));
}

.ssg-test-item {
  filter:
    drop-shadow(0 14px 13px rgba(54, 38, 15, 0.34))
    drop-shadow(0 5px 2px rgba(118, 76, 23, 0.18))
    drop-shadow(0 0 15px rgba(255, 219, 75, 0.62))
    drop-shadow(0 0 32px rgba(255, 184, 28, 0.34));
  animation: ssg-test-item-pop 0.28s cubic-bezier(0.19, 1.34, 0.32, 1) both;
  transition:
    transform 0.18s cubic-bezier(0.2, 1.25, 0.38, 1),
    filter 0.18s ease;
  will-change: transform, filter;
}

.ssg-test-item:hover {
  transform: translate(-50%, -50%) scale(1.075) rotate(-1.5deg);
  filter:
    drop-shadow(0 17px 16px rgba(54, 38, 15, 0.38))
    drop-shadow(0 6px 2px rgba(118, 76, 23, 0.20))
    drop-shadow(0 0 19px rgba(255, 230, 97, 0.78))
    drop-shadow(0 0 42px rgba(255, 190, 34, 0.48))
    brightness(1.08)
    saturate(1.06);
}

.ssg-test-item:active {
  transform: translate(-50%, -50%) scale(0.9) rotate(1.5deg);
  filter:
    drop-shadow(0 8px 8px rgba(54, 38, 15, 0.30))
    drop-shadow(0 0 18px rgba(255, 218, 72, 0.58))
    brightness(1.12);
}

@keyframes ssg-test-item-pop {
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

.ssg-test-effect {
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
  animation: ssg-test-effect-pop 0.54s cubic-bezier(0.12, 1.55, 0.38, 1) forwards;
  will-change: transform, opacity, filter;
}

.ssg-test-effect::before,
.ssg-test-effect::after {
  content: "";
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  pointer-events: none;
}

.ssg-test-effect::before {
  border: 4px solid rgba(255, 245, 145, 0.70);
  box-shadow:
    0 0 18px rgba(255, 234, 95, 0.72),
    inset 0 0 12px rgba(255, 255, 255, 0.50);
}

.ssg-test-effect::after {
  inset: 10px;
  background:
    radial-gradient(circle, rgba(255,255,255,0.86), rgba(255,229,85,0.48) 44%, transparent 70%);
  filter: blur(1px);
}

@keyframes ssg-test-effect-pop {
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

.ssg-image-button {
  transform-origin: 50% 58%;
  transition:
    transform 0.2s cubic-bezier(0.18, 1.25, 0.38, 1),
    filter 0.2s ease;
  will-change: transform, filter;
}

.ssg-image-button img {
  filter:
    drop-shadow(0 10px 8px rgba(74, 48, 16, 0.26))
    drop-shadow(0 0 14px rgba(255, 238, 150, 0.22));
  transition: filter 0.2s ease;
}

.ssg-image-button:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.045);
  filter: brightness(1.06) saturate(1.05);
  animation:
    ssg-button-breathe 1.15s ease-in-out infinite,
    ssg-button-wobble 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.ssg-image-button:hover:not(:disabled) img {
  filter:
    drop-shadow(0 14px 10px rgba(74, 48, 16, 0.30))
    drop-shadow(0 0 18px rgba(255, 238, 150, 0.38));
}

.ssg-image-button:active:not(:disabled) {
  transform: translateY(2px) scale(0.965);
  animation: none;
}

@keyframes ssg-button-wobble {
  0% { transform: translateY(-3px) scale(1.045) rotate(0deg); }
  18% { transform: translateY(-4px) scale(1.055) rotate(-2.6deg); }
  36% { transform: translateY(-3px) scale(1.05) rotate(2.1deg); }
  54% { transform: translateY(-4px) scale(1.052) rotate(-1.4deg); }
  72% { transform: translateY(-3px) scale(1.047) rotate(0.8deg); }
  100% { transform: translateY(-3px) scale(1.045) rotate(0deg); }
}

@keyframes ssg-button-breathe {
  0%, 100% { transform: translateY(-3px) scale(1.045); }
  50% { transform: translateY(-5px) scale(1.065); }
}

@media (prefers-reduced-motion: reduce) {
  .ssg-test-item,
  .ssg-test-effect,
  .ssg-image-button,
  .ssg-image-button:hover:not(:disabled) {
    animation-duration: 0.01ms;
    animation-iteration-count: 1;
    transition-duration: 0.01ms;
  }
}


@media (max-width: 1024px) {
  .ssg-start-shell,
  .ssg-result-shell {
    width: min(86vw, 920px);
  }

  .ssg-soft-panel {
    border-radius: 50px;
  }

  .ssg-start-panel,
  .ssg-result-panel {
    padding-left: 44px;
    padding-right: 44px;
  }

  .ssg-video-panel,
  .ssg-tutorial-panel {
    padding: 42px 48px 30px;
  }
}

@media (max-width: 768px) {
  .ssg-page--soft {
    overflow-y: auto;
  }

  .ssg-center-shell,
  .ssg-start-shell,
  .ssg-result-shell {
    width: 92vw;
    min-height: 100svh;
    padding: 42px 0 28px;
  }

  .ssg-soft-panel {
    border-width: 6px;
    border-radius: 38px;
  }

  .ssg-soft-panel::before {
    inset: 12px;
    border-radius: 28px;
  }

  .ssg-start-panel {
    min-height: 540px;
    padding: 44px 22px 40px;
    gap: 28px;
  }

  .ssg-game-title {
    font-size: 30px;
    padding: 12px 24px;
  }

  .ssg-game-title::before,
  .ssg-game-title::after {
    display: none;
  }

  .ssg-start-content,
  .ssg-result-content {
    grid-template-columns: 1fr;
    gap: 22px;
    justify-items: center;
  }

  .ssg-dialog-bubble {
    width: 100%;
    min-height: 120px;
  }

  .ssg-dialog-bubble::after {
    display: none;
  }

  .ssg-round-icon,
  .ssg-result-icon {
    width: 138px;
    height: 138px;
    padding: 10px;
  }

  .ssg-video-panel,
  .ssg-tutorial-panel {
    min-height: 560px;
    padding: 34px 26px 24px;
  }

  .ssg-video-frame,
  .ssg-tutorial-scene {
    height: 48vh;
    min-height: 320px;
  }

  .ssg-tutorial-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    row-gap: 14px;
  }

  .ssg-avatar-guide {
    width: 112px;
    height: 112px;
  }

  .ssg-rule-steps {
    min-height: 130px;
    grid-template-rows: auto 24px auto;
  }

  .ssg-guide-bubble,
  .ssg-tap-hint {
    font-size: 20px;
    padding: 10px 16px;
  }

  .ssg-guide-arrow {
    width: 150px;
  }

  .ssg-practice-acorn {
    width: 92px;
    height: 92px;
  }

  .ssg-tutorial-practice {
    min-height: 130px;
  }

  .ssg-result-panel {
    min-height: 590px;
    padding: 84px 22px 40px;
    gap: 34px;
  }

  .ssg-cute-stars {
    top: -54px;
    gap: 8px;
  }

  .ssg-result-actions {
    gap: 16px;
  }

  .ssg-result-actions .ssg-forest-button {
    min-width: min(100%, 220px);
    min-height: 64px;
  }
}

@media (max-width: 480px) {
  .ssg-center-shell,
  .ssg-start-shell,
  .ssg-result-shell {
    width: 94vw;
  }

  .ssg-soft-panel {
    border-width: 5px;
    border-radius: 30px;
  }

  .ssg-start-panel {
    padding: 34px 16px 30px;
  }

  .ssg-game-title {
    font-size: 25px;
    padding: 10px 18px;
    min-width: auto;
  }

  .ssg-dialog-bubble {
    padding: 18px 16px;
    font-size: 24px;
  }

  .ssg-round-icon,
  .ssg-result-icon {
    width: 114px;
    height: 114px;
    padding: 9px;
  }

  .ssg-forest-button {
    min-width: 150px;
    min-height: 60px;
    padding: 10px 22px;
    font-size: 24px;
  }

  .ssg-video-panel,
  .ssg-tutorial-panel {
    min-height: 500px;
    padding: 26px 16px 22px;
  }

  .ssg-video-frame,
  .ssg-tutorial-scene {
    height: 44vh;
    min-height: 270px;
  }

  .ssg-avatar-guide {
    width: 86px;
    height: 86px;
  }

  .ssg-guide-bubble,
  .ssg-tap-hint {
    font-size: 17px;
  }

  .ssg-practice-acorn {
    width: 76px;
    height: 76px;
  }

  .ssg-test-item {
    width: 96px !important;
  }
}
@media (max-width: 720px) {
  .ssg-image-button,
  .ssg-result-actions .ssg-image-button {
    min-width: 0;
    min-height: 0;
    width: min(72vw, 206px);
    padding: 0;
  }

  .ssg-btn-skip.ssg-image-button,
  .ssg-btn-next.ssg-image-button {
    width: min(74vw, 214px);
  }

  .ssg-mouse-guide {
    width: 52px;
  }

  .ssg-mouse-on-button {
    right: -10px;
    bottom: -14px;
  }
}



/* SSG 正式測驗區：保留 SRT 視覺語言，但動物直接顯示，不使用卡片。 */
.ssg-container {
  position: relative;
  z-index: 1;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: clamp(12px, 2vw, 28px);
}

.ssg-stage {
  position: relative;
  width: min(96vw, 1180px);
  height: min(88vh, 760px);
  overflow: visible;
}

.ssg-listen-status {
  position: absolute;
  z-index: 4;
  top: 4%;
  left: 50%;
  transform: translateX(-50%);
  min-width: 300px;
  padding: 13px 30px;
  border: 4px solid #f0c77b;
  border-radius: 999px;
  background: linear-gradient(180deg, #fff 0%, #fff9e9 100%);
  color: #6d3717;
  font-size: clamp(22px, 2.6vw, 34px);
  font-weight: 900;
  box-shadow: 0 8px 0 rgba(225,169,84,.12), inset 0 0 0 5px rgba(255,235,174,.35);
}

.ssg-animal-choice-row {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  justify-items: center;
  padding: clamp(108px, 15vh, 150px) clamp(45px, 8vw, 115px) 34px;
  gap: clamp(50px, 10vw, 150px);
}

.ssg-animal-choice {
  width: clamp(235px, 28vw, 370px);
  height: clamp(235px, 28vw, 370px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  outline: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  opacity: .72;
  cursor: default;
  transition: transform .16s ease, filter .16s ease, opacity .16s ease;
}

.ssg-animal-choice img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 18px 16px rgba(74,54,25,.24));
}

.ssg-animal-choice.is-clickable {
  cursor: pointer;
  opacity: 1;
  animation: ssg-animal-ready 1s ease-in-out infinite alternate;
}

.ssg-animal-choice.is-clickable:hover,
.ssg-animal-choice.is-clickable:focus-visible {
  transform: translateY(-8px) scale(1.045);
  filter: brightness(1.05);
}

.ssg-animal-choice.is-clickable:active {
  transform: translateY(2px) scale(.97);
}

.ssg-retry-audio {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: 7%;
  transform: translateX(-50%);
  min-width: 220px;
  min-height: 66px;
  padding: 12px 28px;
  border: 4px solid rgba(255,255,255,.86);
  outline: 3px solid #5d9d32;
  border-radius: 22px;
  background: linear-gradient(180deg, #b9f235 0%, #77c927 48%, #4e9a23 100%);
  color: #fff;
  font-family: inherit;
  font-size: clamp(20px,2.2vw,28px);
  font-weight: 900;
  box-shadow: 0 6px 0 #377721, 0 13px 22px rgba(61,97,33,.20);
  cursor: pointer;
}

@keyframes ssg-animal-ready {
  from { filter: drop-shadow(0 18px 16px rgba(74,54,25,.20)); }
  to { filter: drop-shadow(0 0 24px rgba(255,218,84,.72)) drop-shadow(0 18px 16px rgba(74,54,25,.20)); }
}

@media (max-width: 780px) {
  .ssg-animal-choice-row { padding: 100px 18px 34px; gap: 16px; }
  .ssg-animal-choice { width: min(43vw, 260px); height: min(43vw, 260px); }
  .ssg-listen-status { top: 3%; min-width: 220px; padding: 10px 18px; }
}
`;
