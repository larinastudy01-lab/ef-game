// src/pages/TrainingPage_DPT.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/GamePage_DPT.css";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";

/* ========= 圖片 / 影片素材 ========= */
import backgroundImg from "../asset/DPT_testbackground.png";
import introVideo from "../asset/SRT_start.mp4";
import endingVideo from "../asset/SRT_start.mp4";
import startAvatar from "../asset/avatar/fox.png";
import tutorialAvatar from "../asset/avatar/chicken.png";

import homeStartBtn from "../asset/home/start.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";

import foxImg from "../asset/DPT/dpt_fox.png";
import flyImg from "../asset/DPT/dpt_fly.png";
import beeImg from "../asset/DPT/bee.png";

import honeyImg from "../asset/DPT/dpt_honey.png";
import cakeImg from "../asset/DPT/dpt_cake.png";
import giftImg from "../asset/DPT/dpt_pudding.png";
import candyImg from "../asset/DPT/dpt_candy.png";
import cookieImg from "../asset/DPT/dpt_cookie.png";
import juiceImg from "../asset/DPT/dpt_pancake.png";

/* ========= 路由 ========= */
const RESULT_ROUTE = "/result-dpt";
const FOREST_ROUTE = "/game-menu";

/* ========= 訓練參數 ========= */
const FIXATION_TIME = 550;
const RULE_CARD_TIME = 1050;
const ITEM_PREVIEW_TIME = 700;
const BLANK_TIME = 180;
const FEEDBACK_TIME = 720;
const NEXT_TRIAL_DELAY = 420;

const DIFFICULTY_CONFIG = {
  easy: {
    label: "簡單",
    totalTrials: 5,
    answerTimeLimit: 5200,
    showRuleEveryTrial: false,
    showMouseHint: true,
    mouseHintDelay: 1800,
    rulePlan: ["catchFly"],
  },
  normal: {
    label: "普通",
    totalTrials: 10,
    answerTimeLimit: 4200,
    showRuleEveryTrial: true,
    showMouseHint: true,
    mouseHintDelay: 2400,
    rulePlan: ["catchFly", "protectSnack"],
  },
  hard: {
    label: "困難",
    totalTrials: 15,
    answerTimeLimit: 3300,
    showRuleEveryTrial: true,
    showMouseHint: false,
    mouseHintDelay: 99999,
    rulePlan: ["catchFly", "protectSnack", "oppositeDay"],
  },
};

const RULES = {
  catchFly: {
    key: "catchFly",
    shortLabel: "趕蒼蠅",
    title: "趕走蒼蠅",
    cue: "🪰",
    parentText: "看到蒼蠅，點有蒼蠅的那邊。",
    childText: "點蒼蠅那邊",
    getCorrectSide: (trial) => trial.flySide,
  },
  protectSnack: {
    key: "protectSnack",
    shortLabel: "保護點心",
    title: "保護乾淨點心",
    cue: "🍰",
    parentText: "不要點蒼蠅，點沒有蒼蠅的點心。",
    childText: "點乾淨點心",
    getCorrectSide: (trial) => (trial.flySide === "left" ? "right" : "left"),
  },
  oppositeDay: {
    key: "oppositeDay",
    shortLabel: "相反日",
    title: "相反日",
    cue: "↔️",
    parentText: "看到蒼蠅時，要做相反選擇。",
    childText: "點另一邊",
    getCorrectSide: (trial) => (trial.flySide === "left" ? "right" : "left"),
  },
};

const asset = {
  background: backgroundImg,
  introVideo,
  endingVideo,
  startAvatar,
  tutorialAvatar,
  homeStartBtn,
  homeSkipBtn,
  homeBackBtn,
  homeAgainBtn,
  homeResultBtn,
  mouseGuideImg,
  fox: foxImg,
  fly: flyImg,
  bee: beeImg,
  items: [honeyImg, cakeImg, giftImg, candyImg, cookieImg, juiceImg],
};

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getDifferentItem(items, usedItem) {
  const candidates = items.filter((item) => item !== usedItem);
  return getRandomItem(candidates.length > 0 ? candidates : items);
}

function normalizeDifficulty(value) {
  if (value === "simple") return "easy";
  if (value === "medium") return "normal";
  if (value === "difficult") return "hard";
  if (DIFFICULTY_CONFIG[value]) return value;
  return "normal";
}

function getInitialDifficulty() {
  try {
    const fromTraining = localStorage.getItem("dptTrainingDifficulty");
    const fromGlobal = localStorage.getItem("trainingDifficulty");
    const selectedLevel = JSON.parse(localStorage.getItem("selectedTrainingLevel") || "null");
    return normalizeDifficulty(fromTraining || selectedLevel?.difficulty || fromGlobal || "normal");
  } catch (error) {
    return "normal";
  }
}

function getCurrentChildId() {
  try {
    const selectedChild = JSON.parse(localStorage.getItem("selectedChild") || "null");
    return selectedChild?.childId || selectedChild?.id || "unknown-child";
  } catch (error) {
    return "unknown-child";
  }
}

function averageRt(records) {
  const valid = records
    .filter((record) => record.isCorrect && typeof record.reactionTime === "number")
    .map((record) => record.reactionTime);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, rt) => sum + rt, 0) / valid.length);
}

function buildRuleSequence(difficultyKey, totalTrials) {
  const config = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.normal;

  if (difficultyKey === "easy") {
    return Array.from({ length: totalTrials }, () => config.rulePlan[0]);
  }

  if (difficultyKey === "normal") {
    const half = Math.ceil(totalTrials / 2);
    return Array.from({ length: totalTrials }, (_, index) =>
      index < half ? "catchFly" : "protectSnack"
    );
  }

  const base = [];
  while (base.length < totalTrials) {
    base.push(...shuffleArray(config.rulePlan));
  }
  return base.slice(0, totalTrials);
}

function buildTrials(difficultyKey) {
  const config = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.normal;
  const ruleSequence = buildRuleSequence(difficultyKey, config.totalTrials);

  const flySides = shuffleArray(
    Array.from({ length: config.totalTrials }, (_, index) =>
      index % 2 === 0 ? "left" : "right"
    )
  );

  return Array.from({ length: config.totalTrials }, (_, index) => {
    const flySide = flySides[index];
    const leftItem = getRandomItem(asset.items);
    const rightItem = getDifferentItem(asset.items, leftItem);
    const ruleKey = ruleSequence[index];
    const rule = RULES[ruleKey] || RULES.catchFly;
    const correctSide = rule.getCorrectSide({ flySide });

    return {
      trialIndex: index + 1,
      ruleKey,
      ruleLabel: rule.shortLabel,
      flySide,
      correctSide,
      leftItem,
      rightItem,
      isSwitchTrial: index > 0 && ruleSequence[index - 1] !== ruleKey,
    };
  });
}

function getStars(accuracy, switchAccuracy) {
  if (accuracy >= 85 && switchAccuracy >= 70) return 3;
  if (accuracy >= 60) return 2;
  return 1;
}

export default function TrainingPage_DPT() {
  const navigate = useNavigate();
  const [difficultyKey, setDifficultyKey] = useState(getInitialDifficulty);
  const difficulty = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.normal;

  const trials = useMemo(() => buildTrials(difficultyKey), [difficultyKey]);

  const [phase, setPhase] = useState("start");
  const [teachingStep, setTeachingStep] = useState(0);
  const [practiceResult, setPracticeResult] = useState(null);
  const [trialIndex, setTrialIndex] = useState(0);

  const [showFixation, setShowFixation] = useState(false);
  const [showRuleCard, setShowRuleCard] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [showFly, setShowFly] = useState(false);
  const [canAnswer, setCanAnswer] = useState(false);
  const [showMouseHint, setShowMouseHint] = useState(false);

  const [feedbackSide, setFeedbackSide] = useState(null);
  const [feedbackType, setFeedbackType] = useState(null);
  const [flyHit, setFlyHit] = useState(false);
  const [foxHappy, setFoxHappy] = useState(false);
  const [randomClickWarning, setRandomClickWarning] = useState(false);

  const [trialRecords, setTrialRecords] = useState([]);
  const [pendingResult, setPendingResult] = useState(null);

  const timeoutRefs = useRef([]);
  const animationFrameRef = useRef(null);
  const probeStartTimeRef = useRef(null);
  const answeredRef = useRef(false);
  const trialIndexRef = useRef(0);
  const trialRecordsRef = useRef([]);
  const randomClickCountRef = useRef(0);
  const repeatedClickCountRef = useRef(0);
  const lastPointerTimeRef = useRef(0);

  const currentTrial = trials[trialIndex];
  const currentRule = RULES[currentTrial?.ruleKey] || RULES.catchFly;

  useEffect(() => {
    trialIndexRef.current = trialIndex;
  }, [trialIndex]);

  useEffect(() => {
    trialRecordsRef.current = trialRecords;
  }, [trialRecords]);

  function addTimeout(callback, delay) {
    const timeoutId = window.setTimeout(() => {
      timeoutRefs.current = timeoutRefs.current.filter((id) => id !== timeoutId);
      callback();
    }, delay);

    timeoutRefs.current.push(timeoutId);
    return timeoutId;
  }

  function clearCurrentTimers() {
    timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRefs.current = [];

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  useEffect(() => {
    return () => clearCurrentTimers();
  }, []);

  function resetRound(nextDifficulty = difficultyKey) {
    clearCurrentTimers();
    setDifficultyKey(nextDifficulty);
    setTeachingStep(0);
    setPracticeResult(null);
    setTrialIndex(0);
    setTrialRecords([]);
    setPendingResult(null);
    setShowFixation(false);
    setShowRuleCard(false);
    setShowItems(false);
    setShowFly(false);
    setCanAnswer(false);
    setShowMouseHint(false);
    setFeedbackSide(null);
    setFeedbackType(null);
    setFlyHit(false);
    setFoxHappy(false);
    setRandomClickWarning(false);

    trialIndexRef.current = 0;
    trialRecordsRef.current = [];
    randomClickCountRef.current = 0;
    repeatedClickCountRef.current = 0;
    lastPointerTimeRef.current = 0;
    answeredRef.current = false;
    probeStartTimeRef.current = null;
  }

  function handleDifficultyChange(nextDifficulty) {
    resetRound(nextDifficulty);
    localStorage.setItem("dptTrainingDifficulty", nextDifficulty);
  }

  function handleStart() {
    resetRound(difficultyKey);
    setPhase("introVideo");
  }

  function handleIntroEnd() {
    clearCurrentTimers();
    setTeachingStep(0);
    setPracticeResult(null);
    setPhase("teaching");
  }

  function nextTeachingStep() {
    clearCurrentTimers();
    setPracticeResult(null);
    if (teachingStep < 3) {
      setTeachingStep((prev) => prev + 1);
      return;
    }
    startTraining();
  }

  function handlePracticeClick(side) {
    if (teachingStep !== 3) return;
    setPracticeResult(side === "right" ? "correct" : "wrong");
  }

  function startTraining() {
    clearCurrentTimers();
    setPhase("playing");
    setTrialIndex(0);
    setTrialRecords([]);
    trialIndexRef.current = 0;
    trialRecordsRef.current = [];
    randomClickCountRef.current = 0;
    repeatedClickCountRef.current = 0;
    lastPointerTimeRef.current = 0;
    startTrial(0);
  }

  function triggerRandomClickWarning() {
    setRandomClickWarning(true);
    addTimeout(() => setRandomClickWarning(false), 420);
  }

  function handleStagePointerDown(event) {
    if (phase !== "playing") return;

    const now = performance.now();
    if (lastPointerTimeRef.current && now - lastPointerTimeRef.current < 250) {
      repeatedClickCountRef.current += 1;
    }
    lastPointerTimeRef.current = now;

    const isAnswerZone = event.target.closest("[data-answer-zone='true']");
    if (!isAnswerZone) {
      triggerRandomClickWarning();
      if (canAnswer) {
        randomClickCountRef.current += 1;
      }
    }
  }

  function startTrial(index) {
    clearCurrentTimers();
    answeredRef.current = false;
    probeStartTimeRef.current = null;

    setShowFixation(true);
    setShowRuleCard(false);
    setShowItems(false);
    setShowFly(false);
    setCanAnswer(false);
    setShowMouseHint(false);
    setFeedbackSide(null);
    setFeedbackType(null);
    setFlyHit(false);
    setFoxHappy(false);
    setRandomClickWarning(false);

    addTimeout(() => {
      setShowFixation(false);
      setShowRuleCard(true);

      addTimeout(() => {
        setShowRuleCard(false);
        setShowItems(true);

        addTimeout(() => {
          setShowItems(false);

          addTimeout(() => {
            setShowFly(true);

            animationFrameRef.current = window.requestAnimationFrame(() => {
              animationFrameRef.current = null;

              if (answeredRef.current || trialIndexRef.current !== index) return;

              probeStartTimeRef.current = performance.now();
              setCanAnswer(true);

              if (difficulty.showMouseHint) {
                addTimeout(() => {
                  if (!answeredRef.current) setShowMouseHint(true);
                }, difficulty.mouseHintDelay);
              }

              addTimeout(() => {
                if (!answeredRef.current) handleTimeout(index);
              }, difficulty.answerTimeLimit);
            });
          }, BLANK_TIME);
        }, ITEM_PREVIEW_TIME);
      }, RULE_CARD_TIME);
    }, FIXATION_TIME);
  }

  function handleAnswer(clickedSide) {
    if (!canAnswer || answeredRef.current || phase !== "playing") return;
    answeredRef.current = true;
    clearCurrentTimers();

    const currentIndex = trialIndexRef.current;
    const trial = trials[currentIndex];
    if (!trial) return;

    const reactionTime = probeStartTimeRef.current
      ? Math.round(performance.now() - probeStartTimeRef.current)
      : null;
    const isCorrect = clickedSide === trial.correctSide;

    const record = {
      trialIndex: trial.trialIndex,
      mode: "training",
      difficulty: difficultyKey,
      ruleKey: trial.ruleKey,
      ruleLabel: trial.ruleLabel,
      isSwitchTrial: trial.isSwitchTrial,
      flySide: trial.flySide,
      correctSide: trial.correctSide,
      clickedSide,
      isCorrect,
      reactionTime,
      timeout: false,
      errorType: isCorrect ? null : trial.isSwitchTrial ? "ruleSwitchError" : "wrongTarget",
      leftItem: trial.leftItem,
      rightItem: trial.rightItem,
      timestamp: new Date().toISOString(),
    };

    const updatedRecords = [...trialRecordsRef.current, record];
    trialRecordsRef.current = updatedRecords;
    setTrialRecords(updatedRecords);

    setCanAnswer(false);
    setShowMouseHint(false);
    setFeedbackSide(clickedSide);
    setFeedbackType(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setFlyHit(true);
      setFoxHappy(true);
    }

    addTimeout(() => {
      goNextTrial(updatedRecords, currentIndex);
    }, FEEDBACK_TIME);
  }

  function handleTimeout(index) {
    if (answeredRef.current) return;
    answeredRef.current = true;
    clearCurrentTimers();

    const trial = trials[index];
    if (!trial) return;

    const record = {
      trialIndex: trial.trialIndex,
      mode: "training",
      difficulty: difficultyKey,
      ruleKey: trial.ruleKey,
      ruleLabel: trial.ruleLabel,
      isSwitchTrial: trial.isSwitchTrial,
      flySide: trial.flySide,
      correctSide: trial.correctSide,
      clickedSide: null,
      isCorrect: false,
      reactionTime: null,
      timeout: true,
      errorType: "miss",
      leftItem: trial.leftItem,
      rightItem: trial.rightItem,
      timestamp: new Date().toISOString(),
    };

    const updatedRecords = [...trialRecordsRef.current, record];
    trialRecordsRef.current = updatedRecords;
    setTrialRecords(updatedRecords);

    setCanAnswer(false);
    setShowMouseHint(false);
    setFeedbackSide(trial.correctSide);
    setFeedbackType("hint");

    addTimeout(() => {
      goNextTrial(updatedRecords, index);
    }, FEEDBACK_TIME);
  }

  function goNextTrial(updatedRecords, currentIndex) {
    clearCurrentTimers();
    setShowFixation(false);
    setShowRuleCard(false);
    setShowItems(false);
    setShowFly(false);
    setCanAnswer(false);
    setShowMouseHint(false);
    setFeedbackSide(null);
    setFeedbackType(null);
    setFlyHit(false);
    setFoxHappy(false);
    setRandomClickWarning(false);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= trials.length) {
      finishTraining(updatedRecords);
      return;
    }

    trialIndexRef.current = nextIndex;
    setTrialIndex(nextIndex);
    addTimeout(() => startTrial(nextIndex), NEXT_TRIAL_DELAY);
  }

  function finishTraining(records) {
    const totalTrials = records.length;
    const correctCount = records.filter((record) => record.isCorrect).length;
    const wrongCount = records.filter((record) => !record.isCorrect && !record.timeout).length;
    const timeoutCount = records.filter((record) => record.timeout).length;
    const switchRecords = records.filter((record) => record.isSwitchTrial);
    const switchCorrect = switchRecords.filter((record) => record.isCorrect).length;

    const accuracy = totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0;
    const switchAccuracy = switchRecords.length > 0
      ? Math.round((switchCorrect / switchRecords.length) * 100)
      : accuracy;

    const avgReactionTime = averageRt(records);
    const firstHalfRecords = records.slice(0, Math.ceil(records.length / 2));
    const secondHalfRecords = records.slice(Math.ceil(records.length / 2));
    const firstHalfRT = averageRt(firstHalfRecords) || 0;
    const secondHalfRT = averageRt(secondHalfRecords) || 0;
    const firstHalfMiss = firstHalfRecords.filter((record) => record.timeout).length;
    const secondHalfMiss = secondHalfRecords.filter((record) => record.timeout).length;

    const errorTypes = {
      miss: timeoutCount,
      randomClick: randomClickCountRef.current,
      wrongTarget: records.filter((record) => record.errorType === "wrongTarget").length,
      repeatedClick: repeatedClickCountRef.current,
      timeout: timeoutCount,
      sequenceError: 0,
      ruleSwitchError: records.filter((record) => record.errorType === "ruleSwitchError").length,
    };

    const performanceResult = analyzePerformance({
      totalTrials,
      correctTrials: correctCount,
      reactionTimes: records
        .map((record) => record.reactionTime)
        .filter((reactionTime) => typeof reactionTime === "number"),
      errorTypes,
      difficulty: difficultyKey,
    });

    const errorResult = analyzeErrors(errorTypes);
    const fatigueResult = analyzeFatigue({
      firstHalfRT,
      secondHalfRT,
      missIncrease: Math.max(secondHalfMiss - firstHalfMiss, 0),
    });
    const fatigueLevel =
      typeof fatigueResult === "object" && fatigueResult !== null
        ? fatigueResult.fatigueLevel || "low"
        : fatigueResult || "low";

    const recommendedDifficulty = getRecommendedDifficulty({
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      errorTypes,
      fatigueLevel,
    });

    const stars = getStars(accuracy, switchAccuracy);

    const result = {
      taskName: "Dot Probe Task Training",
      taskCode: "DPT",
      gameId: "DPT",
      abilityType: "cognitive_flexibility",
      mode: "training",
      difficulty: difficultyKey,
      difficultyLabel: difficulty.label,
      childId: getCurrentChildId(),

      resultViews: ["child", "parent"],
      totalTrials,
      correctCount,
      wrongCount,
      timeoutCount,
      accuracy,
      accuracyPercent: accuracy,
      switchTotal: switchRecords.length,
      switchCorrect,
      switchAccuracy,
      avgReactionTime,
      errorTypes,
      fatigueLevel,
      fatigueAnalysis: fatigueResult,
      recommendedDifficulty,
      aiSuggestion: recommendedDifficulty,
      performance: performanceResult,
      errorAnalysis: errorResult,
      stars,
      performanceLevel: stars >= 3 ? "good" : stars >= 2 ? "developing" : "needs_support",
      parentSummary:
        stars >= 3
          ? "孩子能根據提示切換規則，認知彈性表現穩定。"
          : stars >= 2
            ? "孩子已能理解規則，但在換規則時仍需要一點提示。"
            : "孩子在規則切換時較容易沿用上一題想法，建議從固定規則開始練習。",
      suggestedAction:
        stars >= 3
          ? "可以嘗試困難模式，增加每題規則切換。"
          : stars >= 2
            ? "建議維持普通模式，練習中途換規則。"
            : "建議先用簡單模式，讓孩子熟悉每一種規則。",
      warningLevel: errorResult.warningLevel,
      records,
      startedFrom: "TrainingPage_DPT",
      finishedAt: new Date().toISOString(),
    };

    localStorage.setItem("dptTrainingResult", JSON.stringify(result));
    setPendingResult(result);
    setPhase("endingVideo");
  }

  function handleEndingVideoEnd() {
    setPhase("result");
  }

  function handleReplay() {
    resetRound(difficultyKey);
    setPhase("introVideo");
  }

  function goResultPage() {
    if (!pendingResult) return;
    navigate(RESULT_ROUTE, { state: pendingResult, replace: true });
  }

  const resultStars = Math.max(1, Math.min(3, Number(pendingResult?.stars) || 1));
  const progressText = `${Math.min(trialIndex + 1, trials.length)} / ${trials.length}`;

  const framelessZoneStyle = {
    border: "none",
    outline: "none",
    boxShadow: "none",
    background: "transparent",
  };

  const largeItemStyle = {
    width: "clamp(180px, 21vw, 292px)",
    height: "clamp(180px, 21vw, 292px)",
    objectFit: "contain",
  };

  const largeFlyStyle = {
    width: "clamp(82px, 8.5vw, 124px)",
    height: "clamp(82px, 8.5vw, 124px)",
    objectFit: "contain",
  };

  if (phase === "start") {
    return (
      <div className="dpt-page dpt-page--soft dpt-training-page" style={{ "--dpt-bg": `url(${asset.background})` }}>
        <style>{dptTrainingInlineCss}</style>
        <main className="dpt-center-shell dpt-start-shell">
          <section className="dpt-soft-panel dpt-start-panel" aria-label="開始畫面">
            <div className="dpt-game-title">小狐狸的規則挑戰</div>

            <div className="dpt-start-content">
              <div className="dpt-dialog-bubble dpt-opening-bubble">
                先看小卡片，再幫狐狸選對邊。
              </div>

              <div className="dpt-round-icon dpt-start-avatar">
                <img src={asset.startAvatar} alt="小狐狸" draggable="false" />
              </div>
            </div>

            <div className="dpt-difficulty-row" aria-label="選擇難度">
              {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  className={`dpt-difficulty-pill ${difficultyKey === key ? "is-active" : ""}`}
                  onClick={() => handleDifficultyChange(key)}
                >
                  {config.label}
                </button>
              ))}
            </div>

            <div className="dpt-rule-preview-row" aria-label="訓練規則預覽">
              {difficulty.rulePlan.map((ruleKey) => (
                <div className="dpt-rule-mini-card" key={ruleKey}>
                  <span>{RULES[ruleKey].cue}</span>
                  <strong>{RULES[ruleKey].shortLabel}</strong>
                </div>
              ))}
            </div>

            <div className="dpt-guided-action dpt-guided-start">
              <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-start" onClick={handleStart} aria-label="開始訓練">
                <img src={asset.homeStartBtn} alt="開始訓練" draggable="false" />
              </button>
              <img className="dpt-mouse-guide dpt-mouse-on-button" src={asset.mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "introVideo") {
    return (
      <div className="dpt-page dpt-page--soft dpt-training-page" style={{ "--dpt-bg": `url(${asset.background})` }}>
        <style>{dptTrainingInlineCss}</style>
        <main className="dpt-center-shell">
          <section className="dpt-soft-panel dpt-video-panel" aria-label="前導動畫">
            <div className="dpt-video-frame">
              <video className="dpt-video" src={asset.introVideo} autoPlay muted playsInline controls={false} preload="auto" onEnded={handleIntroEnd}>
                你的瀏覽器不支援影片播放。
              </video>
            </div>
            <div className="dpt-guided-action dpt-guided-skip">
              <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-skip" onClick={handleIntroEnd} aria-label="跳過動畫">
                <img src={asset.homeSkipBtn} alt="跳過動畫" draggable="false" />
              </button>
              <img className="dpt-mouse-guide dpt-mouse-on-button" src={asset.mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "teaching") {
    const teachingScreens = [
      {
        key: "ruleCard",
        title: "先看規則卡",
        content: (
          <div className="dpt-training-teach-scene">
            <div className="dpt-big-rule-card"><span>🪰</span><strong>點蒼蠅</strong></div>
            <div className="dpt-teach-arrow">→</div>
            <div className="dpt-big-rule-card"><span>🍰</span><strong>點乾淨點心</strong></div>
          </div>
        ),
      },
      {
        key: "catch",
        title: "蒼蠅卡：點蒼蠅那邊",
        content: (
          <div className="dpt-practice-icon-wrap">
            <div className="dpt-practice-choice is-target"><img className="dpt-teach-fly" src={asset.fly} alt="蒼蠅" draggable="false" /></div>
            <div className="dpt-practice-choice"><span className="dpt-empty-dot">空</span></div>
          </div>
        ),
      },
      {
        key: "protect",
        title: "點心卡：點沒有蒼蠅那邊",
        content: (
          <div className="dpt-practice-icon-wrap">
            <div className="dpt-practice-choice"><img className="dpt-teach-fly" src={asset.fly} alt="蒼蠅" draggable="false" /></div>
            <div className="dpt-practice-choice is-target"><img src={asset.items[1]} alt="乾淨點心" draggable="false" /></div>
          </div>
        ),
      },
      {
        key: "try",
        title: "試試看：點乾淨點心",
        content: (
          <div className="dpt-practice-icon-wrap">
            <button type="button" className={`dpt-practice-choice ${practiceResult === "wrong" ? "is-wrong" : ""}`} onClick={() => handlePracticeClick("left")} aria-label="左邊練習">
              <img className="dpt-teach-fly" src={asset.fly} alt="蒼蠅" draggable="false" />
            </button>
            <button type="button" className={`dpt-practice-choice ${practiceResult === "correct" ? "is-correct" : ""}`} onClick={() => handlePracticeClick("right")} aria-label="右邊練習">
              <img src={asset.items[2]} alt="乾淨點心" draggable="false" />
            </button>
          </div>
        ),
      },
    ];
    const screen = teachingScreens[teachingStep] || teachingScreens[0];

    return (
      <div className="dpt-page dpt-page--soft dpt-training-page" style={{ "--dpt-bg": `url(${asset.background})` }}>
        <style>{dptTrainingInlineCss}</style>
        <div className="dpt-rule-card dpt-rule-card--icons">
          <div className="dpt-teaching-head">
            <div className="dpt-avatar-guide"><img src={asset.tutorialAvatar} alt="小助手" draggable="false" /></div>
            <div>
              <h1 className="dpt-rule-title">看卡片換規則</h1>
              <h2 className="dpt-rule-icon-title">{screen.title}</h2>
            </div>
          </div>

          {screen.content}

          {practiceResult === "correct" && <div className="dpt-icon-feedback dpt-icon-feedback--success">✓</div>}
          {practiceResult === "wrong" && <div className="dpt-icon-feedback dpt-icon-feedback--error">↺</div>}

          <div className="dpt-guided-action dpt-guided-start">
            <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-start" onClick={nextTeachingStep} aria-label={screen.key === "try" ? "開始訓練" : "下一步"}>
              <img src={asset.homeStartBtn} alt={screen.key === "try" ? "開始訓練" : "下一步"} draggable="false" />
            </button>
            <img className="dpt-mouse-guide dpt-mouse-on-button" src={asset.mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "endingVideo") {
    return (
      <div className="dpt-page dpt-page--soft dpt-training-page" style={{ "--dpt-bg": `url(${asset.background})` }}>
        <style>{dptTrainingInlineCss}</style>
        <main className="dpt-center-shell">
          <section className="dpt-soft-panel dpt-video-panel" aria-label="結束動畫">
            <div className="dpt-video-frame">
              <video className="dpt-video" src={asset.endingVideo} autoPlay muted playsInline controls={false} preload="auto" onEnded={handleEndingVideoEnd}>
                你的瀏覽器不支援影片播放。
              </video>
            </div>
            <div className="dpt-guided-action dpt-guided-skip">
              <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-skip" onClick={handleEndingVideoEnd} aria-label="跳過動畫">
                <img src={asset.homeSkipBtn} alt="跳過動畫" draggable="false" />
              </button>
              <img className="dpt-mouse-guide dpt-mouse-on-button" src={asset.mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="dpt-page dpt-page--soft dpt-training-page" style={{ "--dpt-bg": `url(${asset.background})` }}>
        <style>{dptTrainingInlineCss}</style>
        <main className="dpt-center-shell dpt-result-shell">
          <section className="dpt-soft-panel dpt-result-panel" aria-label="訓練結果">
            <div className="dpt-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => <span key={star} className={`dpt-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>)}
            </div>

            <div className="dpt-start-content dpt-result-content">
              <div className="dpt-dialog-bubble">
                練習完成！你有照著卡片換規則喔。
              </div>
              <div className="dpt-round-icon dpt-result-icon"><img src={asset.startAvatar} alt="狐狸角色" draggable="false" /></div>
            </div>

            <div className="dpt-result-summary-row">
              <div><strong>{pendingResult?.accuracy ?? 0}%</strong><span>答對率</span></div>
              <div><strong>{pendingResult?.switchAccuracy ?? 0}%</strong><span>換規則</span></div>
              <div><strong>{pendingResult?.difficultyLabel || difficulty.label}</strong><span>難度</span></div>
            </div>

            <div className="dpt-result-actions">
              <div className="dpt-guided-action dpt-guided-result-main">
                <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-home" onClick={() => navigate(FOREST_ROUTE)} aria-label="回到森林">
                  <img src={asset.homeBackBtn} alt="回到森林" draggable="false" />
                </button>
                <img className="dpt-mouse-guide dpt-mouse-on-button" src={asset.mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
              </div>

              <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-replay" onClick={handleReplay} aria-label="再玩一次">
                <img src={asset.homeAgainBtn} alt="再玩一次" draggable="false" />
              </button>
              <button type="button" className="dpt-forest-button dpt-image-button dpt-btn-detail" onClick={goResultPage} aria-label="詳細結果">
                <img src={asset.homeResultBtn} alt="詳細結果" draggable="false" />
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="dpt-page dpt-page--soft dpt-training-page" style={{ "--dpt-bg": `url(${asset.background})` }}>
      <style>{dptTrainingInlineCss}</style>
      <div className="dpt-training-topbar">
        <div className="dpt-progress-pill">{progressText}</div>
        <div className="dpt-current-rule-pill"><span>{currentRule.cue}</span>{currentRule.shortLabel}</div>
      </div>

      <div className="dpt-container">
        <div className={`dpt-stage ${randomClickWarning ? "is-random-warning" : ""}`} onPointerDownCapture={handleStagePointerDown}>
          {randomClickWarning && (
            <div className="dpt-random-click-warning" role="status" aria-live="polite">
              先看清楚再點喔！
            </div>
          )}

          {showFixation && <img className="dpt-fixation-bee" src={asset.bee} alt="注視蜜蜂" draggable="false" />}

          {showRuleCard && (
            <div className={`dpt-floating-rule-card dpt-rule-${currentRule.key}`}>
              <span>{currentRule.cue}</span>
              <strong>{currentRule.title}</strong>
              <small>{currentRule.childText}</small>
            </div>
          )}

          <button
            type="button"
            className={`dpt-side-zone dpt-side-zone--left ${canAnswer ? "is-clickable" : ""} ${feedbackSide === "left" && feedbackType === "correct" ? "is-correct" : ""} ${feedbackSide === "left" && feedbackType === "wrong" ? "is-wrong" : ""} ${feedbackSide === "left" && feedbackType === "hint" ? "is-hint" : ""}`}
            style={framelessZoneStyle}
            onClick={() => handleAnswer("left")}
            disabled={!canAnswer}
            aria-label="左邊"
            data-answer-zone="true"
          >
            {showItems && currentTrial?.leftItem && <img className="dpt-item" src={currentTrial.leftItem} alt="左邊點心" draggable="false" style={largeItemStyle} />}
          </button>

          <button
            type="button"
            className={`dpt-side-zone dpt-side-zone--right ${canAnswer ? "is-clickable" : ""} ${feedbackSide === "right" && feedbackType === "correct" ? "is-correct" : ""} ${feedbackSide === "right" && feedbackType === "wrong" ? "is-wrong" : ""} ${feedbackSide === "right" && feedbackType === "hint" ? "is-hint" : ""}`}
            style={framelessZoneStyle}
            onClick={() => handleAnswer("right")}
            disabled={!canAnswer}
            aria-label="右邊"
            data-answer-zone="true"
          >
            {showItems && currentTrial?.rightItem && <img className="dpt-item" src={currentTrial.rightItem} alt="右邊點心" draggable="false" style={largeItemStyle} />}
          </button>

          {showFly && (
            <img
              className={`dpt-fly ${currentTrial?.flySide === "left" ? "dpt-fly--left" : "dpt-fly--right"} ${flyHit ? "is-hit" : ""}`}
              src={asset.fly}
              alt="蒼蠅"
              draggable="false"
              style={largeFlyStyle}
            />
          )}

          {showMouseHint && currentTrial && (
            <img
              className={`dpt-mouse-guide dpt-mouse-answer-hint ${currentTrial.correctSide === "left" ? "is-left" : "is-right"}`}
              src={asset.mouseGuideImg}
              alt="提示點擊"
              aria-hidden="true"
              draggable="false"
            />
          )}

          <img className={`dpt-fox ${foxHappy ? "is-happy" : ""}`} src={asset.fox} alt="狐狸" draggable="false" />

          {feedbackSide && (
            <div
              className={`dpt-effect ${feedbackType === "correct" ? "dpt-effect--correct" : feedbackType === "hint" ? "dpt-effect--hint" : "dpt-effect--wrong"}`}
              style={{ left: feedbackSide === "left" ? "28%" : "72%", top: "32%" }}
            >
              {feedbackType === "correct" ? "✓" : feedbackType === "hint" ? "○" : "↺"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const dptTrainingInlineCss = `
.dpt-page,
.dpt-page *,
.dpt-stage,
.dpt-side-zone,
.dpt-practice-choice,
.dpt-forest-button,
.dpt-image-button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.dpt-page--soft {
  min-height: 100vh;
  font-family: "jf-openhuninn", "Fredoka", "Nunito", "Noto Sans TC", sans-serif;
  text-align: center;
  overflow: hidden;
  background-image: linear-gradient(rgba(255,255,255,.30), rgba(255,255,255,.30)), var(--dpt-bg);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.dpt-center-shell {
  min-height: 100vh;
  width: min(94vw, 1180px);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(18px, 3vw, 34px);
  box-sizing: border-box;
}

.dpt-soft-panel,
.dpt-rule-card {
  position: relative;
  border-radius: 54px;
  border: 7px solid #f59a3d;
  background: linear-gradient(180deg, rgba(255,252,225,.98), rgba(255,237,168,.98));
  box-shadow: 0 18px 0 rgba(202,116,24,.13), 0 24px 42px rgba(95,64,22,.16), inset 0 0 0 8px rgba(255,255,255,.45), inset 0 0 0 16px rgba(255,215,105,.20);
}

.dpt-soft-panel::before,
.dpt-rule-card::before {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 42px;
  border: 2px dashed rgba(230,170,67,.42);
  pointer-events: none;
}

.dpt-soft-panel::after,
.dpt-rule-card::after {
  content: "";
  position: absolute;
  left: 30px;
  right: 30px;
  bottom: 18px;
  height: 42px;
  pointer-events: none;
  background: radial-gradient(circle at 4% 40%, #8bc947 0 13px, transparent 14px), radial-gradient(circle at 8% 15%, #a4da58 0 9px, transparent 10px), radial-gradient(circle at 92% 42%, #8bc947 0 13px, transparent 14px), radial-gradient(circle at 88% 18%, #a4da58 0 9px, transparent 10px);
  opacity: .92;
}

.dpt-soft-panel > *,
.dpt-rule-card > * { position: relative; z-index: 1; }

.dpt-start-panel,
.dpt-result-panel,
.dpt-video-panel {
  width: min(92vw, 980px);
  min-height: 560px;
  padding: 54px 64px 74px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  box-sizing: border-box;
}

.dpt-game-title,
.dpt-rule-title {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 74px;
  padding: 10px 34px;
  border-radius: 999px;
  border: 5px solid #ff9a4b;
  background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,246,213,.98));
  color: #3b2414;
  font-size: clamp(30px, 4.2vw, 54px);
  font-weight: 900;
  letter-spacing: .04em;
  box-shadow: 0 8px 0 rgba(231,124,32,.18), 0 14px 26px rgba(108,67,25,.12), inset 0 0 0 5px rgba(255,222,145,.26);
}

.dpt-start-content,
.dpt-result-content {
  width: min(100%, 820px);
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 28px;
}

.dpt-dialog-bubble {
  border: 5px solid #f0782e;
  border-radius: 34px;
  background: linear-gradient(180deg, #fff, #fff9e9);
  color: #4a2a16;
  font-size: clamp(24px, 3vw, 38px);
  font-weight: 900;
  line-height: 1.35;
  padding: 28px 34px;
  box-shadow: 0 8px 0 rgba(240,125,45,.12), inset 0 0 0 6px rgba(255,226,150,.28);
}

.dpt-round-icon,
.dpt-avatar-guide {
  border-radius: 999px;
  background: rgba(255,255,255,.90);
  border: 5px solid #ff9a4b;
  box-shadow: 0 16px 24px rgba(92,66,29,.16);
  overflow: hidden;
}

.dpt-round-icon { width: clamp(150px, 18vw, 220px); height: clamp(150px, 18vw, 220px); padding: 10px; }
.dpt-avatar-guide { width: clamp(104px, 12vw, 154px); height: clamp(104px, 12vw, 154px); padding: 8px; }
.dpt-round-icon img,
.dpt-avatar-guide img { width: 100%; height: 100%; object-fit: contain; display: block; }

.dpt-guided-action {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}

.dpt-image-button,
.dpt-image-button.dpt-btn-start,
.dpt-image-button.dpt-btn-home,
.dpt-image-button.dpt-btn-replay,
.dpt-image-button.dpt-btn-detail,
.dpt-image-button.dpt-btn-skip {
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
  cursor: pointer;
}

.dpt-image-button::before,
.dpt-image-button::after { display: none; }
.dpt-image-button img { width: 100%; height: auto; display: block; pointer-events: none; user-select: none; -webkit-user-drag: none; filter: drop-shadow(0 8px 8px rgba(74,48,16,.22)); }
.dpt-image-button:hover:not(:disabled) { transform: translateY(-2px) scale(1.03); filter: brightness(1.04); }
.dpt-image-button:active:not(:disabled) { transform: translateY(1px) scale(.98); }
.dpt-btn-skip.dpt-image-button { width: clamp(198px, 19vw, 266px); }

.dpt-mouse-guide {
  position: absolute;
  width: clamp(48px, 5.2vw, 78px);
  height: auto;
  z-index: 8;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(58,38,14,.24));
  animation: dptMouseTap 1.15s ease-in-out infinite;
}
.dpt-mouse-on-button { right: -18px; bottom: -18px; transform-origin: 18% 18%; }
@keyframes dptMouseTap { 0%,100% { transform: translate(0,0) scale(1); opacity: .92; } 45% { transform: translate(-10px,-9px) scale(1.08); opacity: 1; } 62% { transform: translate(-4px,-4px) scale(.96); opacity: 1; } }

.dpt-difficulty-row,
.dpt-rule-preview-row,
.dpt-result-summary-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
}

.dpt-difficulty-pill {
  border: 4px solid #f4a04a;
  border-radius: 999px;
  background: #fff8de;
  color: #5c3517;
  font-size: clamp(18px, 2vw, 24px);
  font-weight: 900;
  padding: 10px 22px;
  cursor: pointer;
  box-shadow: 0 6px 0 rgba(163,99,31,.16);
}
.dpt-difficulty-pill.is-active { background: #ffcf68; transform: translateY(-2px); }

.dpt-rule-mini-card {
  min-width: 130px;
  border: 4px solid #ffb457;
  border-radius: 24px;
  background: rgba(255,255,255,.74);
  padding: 12px 16px;
  display: grid;
  gap: 4px;
  place-items: center;
  color: #4b2d19;
  font-weight: 900;
}
.dpt-rule-mini-card span { font-size: 34px; }

.dpt-video-frame {
  width: min(100%, 820px);
  aspect-ratio: 16 / 9;
  border: 4px solid #6fb6ec;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(180deg, #2fb5ff, #3189e5);
  box-shadow: 0 8px 0 rgba(55,121,177,.18), inset 0 0 0 4px rgba(255,255,255,.28);
}
.dpt-video { width: 100%; height: 100%; object-fit: cover; display: block; }

.dpt-rule-card {
  width: min(92vw, 1100px);
  min-height: 76vh;
  margin: 8vh auto 0;
  padding: clamp(30px, 4vw, 54px) clamp(34px, 5vw, 70px) 70px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 26px;
}
.dpt-teaching-head {
  width: min(100%, 860px);
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: clamp(18px, 3vw, 34px);
}
.dpt-rule-icon-title {
  margin: 14px 0 0;
  color: #633717;
  font-size: clamp(24px, 3vw, 42px);
  font-weight: 900;
}
.dpt-training-teach-scene,
.dpt-practice-icon-wrap {
  width: min(100%, 760px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(18px, 4vw, 44px);
}
.dpt-big-rule-card,
.dpt-practice-choice {
  width: clamp(160px, 22vw, 250px);
  height: clamp(150px, 20vw, 230px);
  border: 5px solid #ff9a4b;
  border-radius: 34px;
  background: rgba(255,255,255,.86);
  display: grid;
  place-items: center;
  color: #4c2e18;
  font-size: clamp(22px, 2.6vw, 32px);
  font-weight: 900;
  box-shadow: 0 10px 0 rgba(221,126,41,.14);
}
.dpt-big-rule-card span { font-size: clamp(48px, 7vw, 86px); }
.dpt-practice-choice { border-color: #f2b65a; cursor: pointer; }
.dpt-practice-choice img { max-width: 72%; max-height: 72%; object-fit: contain; }
.dpt-practice-choice.is-target,
.dpt-practice-choice.is-correct { border-color: #64c65f; box-shadow: 0 0 0 8px rgba(99,205,88,.18), 0 10px 0 rgba(79,147,61,.12); }
.dpt-practice-choice.is-wrong { border-color: #f07064; animation: dptTinyShake .32s ease; }
.dpt-teach-arrow { font-size: clamp(42px, 6vw, 78px); color: #71411b; font-weight: 900; }
.dpt-teach-fly { max-width: 86px; }
.dpt-empty-dot { font-size: 34px; color: #a77b4d; }
.dpt-icon-feedback { position: absolute; right: 9%; top: 16%; font-size: clamp(50px, 8vw, 92px); font-weight: 900; }
.dpt-icon-feedback--success { color: #41ad42; }
.dpt-icon-feedback--error { color: #e86b4e; }

.dpt-container { min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; }
.dpt-stage {
  position: relative;
  width: min(96vw, 1180px);
  height: min(76vh, 720px);
  min-height: 520px;
  overflow: visible;
}
.dpt-training-topbar {
  position: fixed;
  left: 50%;
  top: clamp(14px, 2.2vw, 26px);
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.dpt-progress-pill,
.dpt-current-rule-pill {
  border: 4px solid #f49a3c;
  border-radius: 999px;
  background: rgba(255, 250, 224, .94);
  color: #513018;
  font-weight: 900;
  font-size: clamp(18px, 2vw, 26px);
  padding: 8px 18px;
  box-shadow: 0 8px 18px rgba(80,50,20,.13);
}
.dpt-current-rule-pill span { margin-right: 6px; }

.dpt-stage.is-random-warning::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 42px;
  border: 8px solid rgba(235, 70, 55, .82);
  box-shadow: inset 0 0 38px rgba(235, 70, 55, .20), 0 0 28px rgba(235, 70, 55, .22);
  pointer-events: none;
  animation: dptWarningPulse .42s ease both;
  z-index: 12;
}
.dpt-random-click-warning {
  position: absolute;
  left: 50%;
  top: 12%;
  transform: translateX(-50%);
  z-index: 13;
  border: 5px solid #e95f4e;
  border-radius: 999px;
  background: rgba(255, 250, 238, .96);
  color: #9b2d20;
  font-size: clamp(20px, 2.5vw, 32px);
  font-weight: 1000;
  padding: 10px 22px;
  box-shadow: 0 8px 22px rgba(120,50,30,.18);
  pointer-events: none;
  animation: dptWarningPop .42s ease both;
}

.dpt-fixation-bee {
  position: absolute;
  left: 50%;
  top: 42%;
  width: clamp(78px, 8vw, 116px);
  transform: translate(-50%, -50%);
  object-fit: contain;
  animation: dptFloat 1.4s ease-in-out infinite;
}
.dpt-floating-rule-card {
  position: absolute;
  left: 50%;
  top: 32%;
  transform: translate(-50%, -50%);
  z-index: 7;
  min-width: clamp(230px, 28vw, 360px);
  border: 6px solid #ff9a4b;
  border-radius: 36px;
  background: rgba(255,255,255,.94);
  box-shadow: 0 16px 34px rgba(83,52,18,.18), inset 0 0 0 7px rgba(255,222,145,.28);
  padding: 20px 28px;
  display: grid;
  gap: 8px;
  place-items: center;
  color: #4c2e18;
  animation: dptRulePop .32s ease both;
}
.dpt-floating-rule-card span { font-size: clamp(48px, 7vw, 88px); }
.dpt-floating-rule-card strong { font-size: clamp(26px, 3vw, 40px); }
.dpt-floating-rule-card small { font-size: clamp(18px, 2vw, 24px); font-weight: 900; color: #7a4b25; }

.dpt-side-zone {
  position: absolute;
  top: 24%;
  width: 34%;
  height: 48%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  transition: transform .16s ease, filter .16s ease;
}
.dpt-side-zone--left { left: 7%; }
.dpt-side-zone--right { right: 7%; }
.dpt-side-zone.is-clickable { cursor: pointer; }
.dpt-side-zone.is-clickable:hover { transform: scale(1.025); }
.dpt-side-zone.is-correct { filter: drop-shadow(0 0 20px rgba(91,210,72,.58)); }
.dpt-side-zone.is-wrong { animation: dptTinyShake .28s ease; filter: drop-shadow(0 0 16px rgba(235,90,70,.42)); }
.dpt-side-zone.is-hint { filter: drop-shadow(0 0 22px rgba(255,203,62,.70)); }
.dpt-item { pointer-events: none; user-select: none; -webkit-user-drag: none; }
.dpt-fly {
  position: absolute;
  top: 32%;
  z-index: 4;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  animation: dptFlyBuzz .42s ease-in-out infinite alternate;
}
.dpt-fly--left { left: 28%; transform: translate(-50%, -50%); }
.dpt-fly--right { left: 72%; transform: translate(-50%, -50%); }
.dpt-fly.is-hit { animation: dptFlyHit .42s ease forwards; }
.dpt-fox {
  position: absolute;
  left: 50%;
  bottom: -2%;
  width: clamp(220px, 28vw, 390px);
  transform: translateX(-50%);
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  transition: transform .24s ease;
}
.dpt-fox.is-happy { transform: translateX(-50%) translateY(-8px) scale(1.03); }
.dpt-effect {
  position: absolute;
  z-index: 8;
  transform: translate(-50%, -50%);
  width: clamp(72px, 8vw, 112px);
  height: clamp(72px, 8vw, 112px);
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: clamp(46px, 6vw, 78px);
  font-weight: 1000;
  background: rgba(255,255,255,.86);
  animation: dptEffectPop .58s ease forwards;
}
.dpt-effect--correct { color: #2daf43; border: 5px solid #72ce6a; }
.dpt-effect--wrong { color: #e16a4e; border: 5px solid #f08b78; }
.dpt-effect--hint { color: #e1a90b; border: 5px solid #ffd15b; }
.dpt-mouse-answer-hint { top: 48%; z-index: 9; }
.dpt-mouse-answer-hint.is-left { left: 24%; }
.dpt-mouse-answer-hint.is-right { right: 24%; }

.dpt-result-actions {
  width: min(100%, 780px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
}
.dpt-result-actions .dpt-image-button { width: clamp(168px, 16vw, 224px); }
.dpt-cute-stars { display: flex; justify-content: center; gap: 12px; font-size: clamp(54px, 7vw, 90px); line-height: 1; }
.dpt-cute-star { color: rgba(143,98,38,.25); text-shadow: 0 4px 0 rgba(91,54,19,.08); }
.dpt-cute-star.is-on { color: #ffc83d; text-shadow: 0 5px 0 rgba(205,126,20,.22), 0 0 18px rgba(255,214,80,.45); }
.dpt-result-summary-row div {
  min-width: 140px;
  border: 4px solid #f3a24a;
  border-radius: 24px;
  background: rgba(255,255,255,.74);
  padding: 12px 18px;
  display: grid;
  gap: 3px;
  color: #563219;
}
.dpt-result-summary-row strong { font-size: clamp(26px, 3vw, 38px); }
.dpt-result-summary-row span { font-size: 16px; font-weight: 900; }

@keyframes dptFloat { 0%,100% { transform: translate(-50%,-50%) translateY(0); } 50% { transform: translate(-50%,-50%) translateY(-10px); } }
@keyframes dptRulePop { from { transform: translate(-50%,-50%) scale(.86); opacity: 0; } to { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
@keyframes dptFlyBuzz { from { margin-top: -4px; } to { margin-top: 5px; } }
@keyframes dptFlyHit { to { transform: translate(-50%,-50%) rotate(18deg) scale(.55); opacity: 0; } }
@keyframes dptEffectPop { 0% { transform: translate(-50%,-50%) scale(.6); opacity: 0; } 30% { transform: translate(-50%,-50%) scale(1.05); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(.9); opacity: 0; } }
@keyframes dptTinyShake { 0%,100% { transform: translateX(0); } 33% { transform: translateX(-8px); } 66% { transform: translateX(8px); } }
@keyframes dptWarningPulse { 0% { opacity: 0; transform: scale(.98); } 35% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.01); } }
@keyframes dptWarningPop { 0% { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(.92); } 35% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } 100% { opacity: 0; transform: translateX(-50%) translateY(-2px) scale(.98); } }

@media (max-width: 780px) {
  .dpt-start-panel,
  .dpt-result-panel,
  .dpt-video-panel { padding: 34px 22px 58px; min-height: 520px; }
  .dpt-start-content,
  .dpt-result-content { grid-template-columns: 1fr; justify-items: center; }
  .dpt-teaching-head { grid-template-columns: 1fr; justify-items: center; }
  .dpt-rule-card { width: min(94vw, 720px); margin-top: 3vh; padding-bottom: 62px; }
  .dpt-training-teach-scene,
  .dpt-practice-icon-wrap { gap: 14px; }
  .dpt-big-rule-card,
  .dpt-practice-choice { width: clamp(126px, 38vw, 176px); height: clamp(120px, 34vw, 164px); }
  .dpt-result-actions .dpt-image-button,
  .dpt-image-button,
  .dpt-image-button.dpt-btn-skip { width: clamp(174px, 50vw, 230px); }
  .dpt-stage { min-height: 500px; height: 72vh; }
  .dpt-side-zone { width: 42%; }
  .dpt-side-zone--left { left: 1%; }
  .dpt-side-zone--right { right: 1%; }
  .dpt-fox { width: clamp(190px, 52vw, 300px); }
  .dpt-training-topbar { width: 95vw; top: 10px; }
  .dpt-progress-pill,
  .dpt-current-rule-pill { font-size: 16px; padding: 7px 12px; }
}
`;
