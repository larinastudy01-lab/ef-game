// src/pages/TestPage_DPT.jsx

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

/* ========= 測驗參數 ========= */
const TOTAL_TRIALS = 20;
const FIXATION_TIME = 500;
const STIMULUS_TIME = 500;
const BLANK_TIME = 250;
const ANSWER_TIME_LIMIT = 3000;
const FEEDBACK_TIME = 650;
const NEXT_TRIAL_DELAY = 300;

/* ========= 素材整理 ========= */
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

/* ========= 小工具 ========= */
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

function averageRt(records) {
  const validRecords = records.filter(
    (record) =>
      record.isCorrect &&
      typeof record.reactionTime === "number" &&
      Number.isFinite(record.reactionTime)
  );

  if (validRecords.length === 0) return null;

  const sum = validRecords.reduce(
    (total, record) => total + record.reactionTime,
    0
  );

  return Math.round(sum / validRecords.length);
}

function buildTrials() {
  const conditions = [
    ...Array(TOTAL_TRIALS / 2).fill("congruent"),
    ...Array(TOTAL_TRIALS / 2).fill("incongruent"),
  ];

  const flySides = [
    ...Array(TOTAL_TRIALS / 2).fill("left"),
    ...Array(TOTAL_TRIALS / 2).fill("right"),
  ];

  const shuffledConditions = shuffleArray(conditions);
  const shuffledFlySides = shuffleArray(flySides);

  return Array.from({ length: TOTAL_TRIALS }, (_, index) => {
    const flySide = shuffledFlySides[index];
    const otherSide = flySide === "left" ? "right" : "left";
    const condition = shuffledConditions[index];

    const attractiveSide = condition === "congruent" ? flySide : otherSide;

    const leftItem = getRandomItem(asset.items);
    const rightItem = getDifferentItem(asset.items, leftItem);

    return {
      trialIndex: index + 1,
      condition,
      flySide,
      correctSide: flySide,
      targetSide: flySide,
      attractiveSide,
      distractorSide: attractiveSide === flySide ? otherSide : attractiveSide,
      leftItem,
      rightItem,
    };
  });
}

export default function TestPage_DPT() {
  const navigate = useNavigate();

  const trials = useMemo(() => buildTrials(), []);

  const [phase, setPhase] = useState("start");
  const [teachingStep, setTeachingStep] = useState(0);
  const [practiceResult, setPracticeResult] = useState(null);

  const [trialIndex, setTrialIndex] = useState(0);

  const [showFixation, setShowFixation] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [showFly, setShowFly] = useState(false);
  const [canAnswer, setCanAnswer] = useState(false);

  const [feedbackSide, setFeedbackSide] = useState(null);
  const [feedbackType, setFeedbackType] = useState(null);
  const [flyHit, setFlyHit] = useState(false);
  const [foxHappy, setFoxHappy] = useState(false);

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

  const framelessZoneStyle = {
    border: "none",
    outline: "none",
    boxShadow: "none",
    background: "transparent",
  };

  const largeItemStyle = {
    width: "clamp(190px, 22vw, 300px)",
    height: "clamp(190px, 22vw, 300px)",
    objectFit: "contain",
  };

  const largeFlyStyle = {
    width: "clamp(80px, 8.5vw, 120px)",
    height: "clamp(80px, 8.5vw, 120px)",
    objectFit: "contain",
  };

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

  function clearCurrentTimer() {
    timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRefs.current = [];

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearCurrentTimer();
    };
  }, []);

  /* ========= 互動教學 ========= */
  function nextTeachingStep() {
    setPracticeResult(null);

    if (teachingStep < 3) {
      setTeachingStep((prev) => prev + 1);
      return;
    }

    startTest();
  }

  function handlePracticeClick(side) {
    if (teachingStep !== 3) return;

    if (side === "left") {
      setPracticeResult("correct");
    } else {
      setPracticeResult("wrong");
    }
  }

  /* ========= 開始測驗 ========= */
  function startTest() {
    clearCurrentTimer();

    randomClickCountRef.current = 0;
    repeatedClickCountRef.current = 0;
    lastPointerTimeRef.current = 0;

    setPendingResult(null);
    setPhase("playing");
    setTrialIndex(0);
    trialIndexRef.current = 0;
    setTrialRecords([]);
    trialRecordsRef.current = [];

    startTrial(0);
  }

  function handleStagePointerDown(event) {
    if (phase !== "playing") return;

    const now = performance.now();

    if (lastPointerTimeRef.current && now - lastPointerTimeRef.current < 250) {
      repeatedClickCountRef.current += 1;
    }

    lastPointerTimeRef.current = now;

    const isAnswerZone = event.target.closest("[data-answer-zone='true']");

    if (canAnswer && !isAnswerZone) {
      randomClickCountRef.current += 1;
    }
  }

  /* ========= 開始單題 ========= */
  function startTrial(index) {
    clearCurrentTimer();

    answeredRef.current = false;
    probeStartTimeRef.current = null;

    setShowFixation(true);
    setShowItems(false);
    setShowFly(false);
    setCanAnswer(false);
    setFeedbackSide(null);
    setFeedbackType(null);
    setFlyHit(false);
    setFoxHappy(false);

    addTimeout(() => {
      setShowFixation(false);
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

            addTimeout(() => {
              if (!answeredRef.current) {
                handleTimeout(index);
              }
            }, ANSWER_TIME_LIMIT);
          });
        }, BLANK_TIME);
      }, STIMULUS_TIME);
    }, FIXATION_TIME);
  }

  /* ========= 作答 ========= */
  function handleAnswer(clickedSide) {
    if (!canAnswer || answeredRef.current || phase !== "playing") return;

    answeredRef.current = true;
    clearCurrentTimer();

    const currentIndex = trialIndexRef.current;
    const trial = trials[currentIndex];

    if (!trial) return;

    const reactionTime = probeStartTimeRef.current
      ? Math.round(performance.now() - probeStartTimeRef.current)
      : null;

    const isCorrect = clickedSide === trial.correctSide;

    const record = {
      trialIndex: trial.trialIndex,

      condition: trial.condition,
      flySide: trial.flySide,
      correctSide: trial.correctSide,
      clickedSide,

      attractiveSide: trial.attractiveSide,
      targetSide: trial.targetSide,
      distractorSide: trial.distractorSide,

      isCorrect,
      reactionTime,
      timeout: false,
      errorType: isCorrect ? null : "wrongTarget",

      leftItem: trial.leftItem,
      rightItem: trial.rightItem,

      timestamp: new Date().toISOString(),
    };

    const updatedRecords = [...trialRecordsRef.current, record];

    trialRecordsRef.current = updatedRecords;
    setTrialRecords(updatedRecords);

    setCanAnswer(false);
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

  /* ========= Timeout ========= */
  function handleTimeout(index) {
    if (answeredRef.current) return;

    answeredRef.current = true;
    clearCurrentTimer();

    const trial = trials[index];

    if (!trial) return;

    const record = {
      trialIndex: trial.trialIndex,

      condition: trial.condition,
      flySide: trial.flySide,
      correctSide: trial.correctSide,
      clickedSide: null,

      attractiveSide: trial.attractiveSide,
      targetSide: trial.targetSide,
      distractorSide: trial.distractorSide,

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
    setFeedbackSide(trial.correctSide);
    setFeedbackType("wrong");

    addTimeout(() => {
      goNextTrial(updatedRecords, index);
    }, FEEDBACK_TIME);
  }

  /* ========= 下一題 / 結束 ========= */
  function goNextTrial(updatedRecords, currentIndex) {
    clearCurrentTimer();

    setShowFixation(false);
    setShowItems(false);
    setShowFly(false);
    setCanAnswer(false);
    setFeedbackSide(null);
    setFeedbackType(null);
    setFlyHit(false);
    setFoxHappy(false);

    const nextIndex = currentIndex + 1;

    if (nextIndex >= TOTAL_TRIALS) {
      finishTest(updatedRecords);
      return;
    }

    trialIndexRef.current = nextIndex;
    setTrialIndex(nextIndex);

    addTimeout(() => {
      startTrial(nextIndex);
    }, NEXT_TRIAL_DELAY);
  }

  /* ========= 結束測驗，整理資料 ========= */
  function finishTest(records) {
    const totalTrials = records.length;
    const correctCount = records.filter((record) => record.isCorrect).length;
    const wrongCount = records.filter(
      (record) => !record.isCorrect && !record.timeout
    ).length;
    const timeoutCount = records.filter((record) => record.timeout).length;

    const avgReactionTime = averageRt(records);

    const congruentRecords = records.filter(
      (record) => record.condition === "congruent"
    );

    const incongruentRecords = records.filter(
      (record) => record.condition === "incongruent"
    );

    const avgCongruentRt = averageRt(congruentRecords);
    const avgIncongruentRt = averageRt(incongruentRecords);

    const interferenceEffect =
      avgCongruentRt !== null && avgIncongruentRt !== null
        ? avgIncongruentRt - avgCongruentRt
        : null;

    const accuracy =
      totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0;

    const congruentCorrectCount = congruentRecords.filter(
      (record) => record.isCorrect
    ).length;

    const incongruentCorrectCount = incongruentRecords.filter(
      (record) => record.isCorrect
    ).length;

    const congruentAccuracy =
      congruentRecords.length > 0
        ? Math.round((congruentCorrectCount / congruentRecords.length) * 100)
        : 0;

    const incongruentAccuracy =
      incongruentRecords.length > 0
        ? Math.round(
            (incongruentCorrectCount / incongruentRecords.length) * 100
          )
        : 0;

    const firstHalfRecords = records.slice(0, Math.ceil(records.length / 2));
    const secondHalfRecords = records.slice(Math.ceil(records.length / 2));

    const firstHalfRT = averageRt(firstHalfRecords) || 0;
    const secondHalfRT = averageRt(secondHalfRecords) || 0;

    const firstHalfMiss = firstHalfRecords.filter((record) => record.timeout)
      .length;
    const secondHalfMiss = secondHalfRecords.filter((record) => record.timeout)
      .length;

    const errorTypes = {
      miss: timeoutCount,
      randomClick: randomClickCountRef.current,
      wrongTarget: wrongCount,
      repeatedClick: repeatedClickCountRef.current,
      timeout: timeoutCount,
      sequenceError: 0,
      ruleSwitchError: 0,
    };

    const performanceResult = analyzePerformance({
      totalTrials,
      correctTrials: correctCount,
      reactionTimes: records
        .map((record) => record.reactionTime)
        .filter((reactionTime) => typeof reactionTime === "number"),
      errorTypes,
      difficulty: "normal",
    });

    const errorResult = analyzeErrors(errorTypes);

    const fatigueResult = analyzeFatigue({
      firstHalfRT,
      secondHalfRT,
      missIncrease: Math.max(secondHalfMiss - firstHalfMiss, 0),
    });

    const fatigueLevel =
      typeof fatigueResult === "object" && fatigueResult !== null
        ? fatigueResult.fatigueLevel
        : fatigueResult;

    const recommendedDifficulty = getRecommendedDifficulty({
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      errorTypes,
      fatigueLevel,
    });

    const result = {
      taskName: "Dot Probe Task",
      taskCode: "DPT",
      gameId: "DPT",
      abilityType: "inhibition",
      mode: "test",
      difficulty: "normal",

      resultViews: ["child", "parent"],

      totalTrials,
      correctCount,
      wrongCount,
      timeoutCount,

      accuracy,
      accuracyPercent: accuracy,

      avgReactionTime,
      avgCongruentRt,
      avgIncongruentRt,
      interferenceEffect,

      congruentTotal: congruentRecords.length,
      incongruentTotal: incongruentRecords.length,
      congruentCorrectCount,
      incongruentCorrectCount,
      congruentAccuracy,
      incongruentAccuracy,

      errorTypes,
      fatigueLevel,
      recommendedDifficulty,
      aiSuggestion: recommendedDifficulty,

      performance: performanceResult,
      errorAnalysis: errorResult,
      fatigueAnalysis: fatigueResult,

      stars: performanceResult.stars,
      performanceLevel: performanceResult.performanceLevel,
      suggestedAction: performanceResult.suggestedAction,
      parentSummary: performanceResult.parentSummary,
      warningLevel: errorResult.warningLevel,

      records,

      startedFrom: "TestPage_DPT",
      finishedAt: new Date().toISOString(),
    };

    localStorage.setItem("dptTestResult", JSON.stringify(result));

    setPendingResult(result);
    setPhase("endingVideo");
  }

  function goResultPage() {
    if (!pendingResult) return;

    navigate(RESULT_ROUTE, {
      state: pendingResult,
      replace: true,
    });
  }

  function handleStart() {
    clearCurrentTimer();
    setPendingResult(null);
    setTeachingStep(0);
    setPracticeResult(null);
    setTrialIndex(0);
    setTrialRecords([]);
    trialRecordsRef.current = [];
    trialIndexRef.current = 0;
    randomClickCountRef.current = 0;
    repeatedClickCountRef.current = 0;
    lastPointerTimeRef.current = 0;
    setShowFixation(false);
    setShowItems(false);
    setShowFly(false);
    setCanAnswer(false);
    setFeedbackSide(null);
    setFeedbackType(null);
    setFlyHit(false);
    setFoxHappy(false);
    setPhase("introVideo");
  }

  function handleIntroEnd() {
    clearCurrentTimer();
    setTeachingStep(0);
    setPracticeResult(null);
    setPhase("teaching");
  }

  function handleEndingVideoEnd() {
    setPhase("result");
  }

  function handleReplay() {
    handleStart();
  }

  const resultStars = Math.max(
    1,
    Math.min(3, Number(pendingResult?.stars) || Number(pendingResult?.performance?.stars) || 1)
  );

  /* ========= 畫面：開始 / 前導影片 ========= */
  if (phase === "start") {
    return (
      <div
        className="dpt-page dpt-page--soft"
        style={{ "--dpt-bg": `url(${asset.background})` }}
      >
        <style>{dptInlineCss}</style>
        <main className="dpt-center-shell dpt-start-shell">
          <section className="dpt-soft-panel dpt-start-panel" aria-label="開始畫面">
            <div className="dpt-game-title">幫狐狸守住點心</div>

            <div className="dpt-start-content">
              <div className="dpt-dialog-bubble dpt-opening-bubble">
                小狐狸想請你一起保護點心。
              </div>

              <div className="dpt-round-icon dpt-start-avatar">
                <img src={asset.startAvatar} alt="開始角色" draggable="false" />
              </div>
            </div>

            <div className="dpt-guided-action dpt-guided-start">
              <button
                type="button"
                className="dpt-forest-button dpt-image-button dpt-btn-start"
                onClick={handleStart}
                aria-label="進入遊戲"
              >
                <img src={asset.homeStartBtn} alt="進入遊戲" draggable="false" />
              </button>
              <img
                className="dpt-mouse-guide dpt-mouse-on-button"
                src={asset.mouseGuideImg}
                alt="提示點擊"
                aria-hidden="true"
                draggable="false"
              />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "introVideo") {
    return (
      <div
        className="dpt-page dpt-page--soft"
        style={{ "--dpt-bg": `url(${asset.background})` }}
      >
        <style>{dptInlineCss}</style>
        <main className="dpt-center-shell">
          <section className="dpt-soft-panel dpt-video-panel" aria-label="前導動畫">
            <div className="dpt-video-frame">
              <video
                className="dpt-video"
                src={asset.introVideo}
                autoPlay
                muted
                playsInline
                controls={false}
                preload="auto"
                onEnded={handleIntroEnd}
              >
                你的瀏覽器不支援影片播放。
              </video>
            </div>

            <div className="dpt-guided-action dpt-guided-skip">
              <button
                type="button"
                className="dpt-forest-button dpt-image-button dpt-btn-skip"
                onClick={handleIntroEnd}
                aria-label="跳過動畫"
              >
                <img src={asset.homeSkipBtn} alt="跳過動畫" draggable="false" />
              </button>
              <img
                className="dpt-mouse-guide dpt-mouse-on-button"
                src={asset.mouseGuideImg}
                alt="提示點擊"
                aria-hidden="true"
                draggable="false"
              />
            </div>
          </section>
        </main>
      </div>
    );
  }

  /* ========= 畫面：前導圖片 / 互動教學 ========= */
  if (phase === "teaching") {
    const teachingScreens = [
      {
        key: "focus",
        title: "看中間",
        button: "下一步",
        content: (
          <div className="dpt-icon-flow dpt-icon-flow--single">
            <div className="dpt-mini-scene dpt-mini-scene--focus">
              <img className="dpt-teach-fox" src={asset.fox} alt="狐狸" draggable="false" />
              <div className="dpt-focus-ring">
                <img className="dpt-teach-bee" src={asset.bee} alt="中間小蜜蜂" draggable="false" />
              </div>
              <div className="dpt-eye-line">👀</div>
            </div>
          </div>
        ),
      },
      {
        key: "remember",
        title: "記住左右",
        button: "下一步",
        content: (
          <div className="dpt-icon-flow">
            <div className="dpt-teach-side dpt-teach-side--left">
              <span className="dpt-side-label">左</span>
              <img src={asset.items[0]} alt="左邊圖片" draggable="false" />
            </div>
            <div className="dpt-teach-symbol">＋</div>
            <div className="dpt-teach-side dpt-teach-side--right">
              <span className="dpt-side-label">右</span>
              <img src={asset.items[1]} alt="右邊圖片" draggable="false" />
            </div>
            <div className="dpt-memory-hint">👀 → 🧠</div>
          </div>
        ),
      },
      {
        key: "probe",
        title: "圖片不見，找蒼蠅",
        button: "我知道了",
        content: (
          <div className="dpt-icon-flow">
            <div className="dpt-teach-ghost">
              <img src={asset.items[2]} alt="消失的左圖" draggable="false" />
            </div>
            <div className="dpt-teach-arrow">→</div>
            <div className="dpt-teach-probe">
              <img className="dpt-teach-fly" src={asset.fly} alt="小蒼蠅" draggable="false" />
              <span className="dpt-side-label">左</span>
            </div>
            <div className="dpt-memory-hint">✨</div>
          </div>
        ),
      },
      {
        key: "answer",
        title: "點蒼蠅那一邊",
        button: "開始測驗",
        content: (
          <div className="dpt-practice-icon-wrap">
            <button
              type="button"
              className={[
                "dpt-practice-choice",
                practiceResult === "correct" ? "is-correct" : "",
              ].join(" ")}
              onClick={() => handlePracticeClick("left")}
              aria-label="教學左邊"
            >
              <span className="dpt-side-label">左</span>
              <img className="dpt-teach-fly" src={asset.fly} alt="左邊小蒼蠅" draggable="false" />
            </button>
            <button
              type="button"
              className={[
                "dpt-practice-choice",
                practiceResult === "wrong" ? "is-wrong" : "",
              ].join(" ")}
              onClick={() => handlePracticeClick("right")}
              aria-label="教學右邊"
            >
              <span className="dpt-side-label">右</span>
              <span className="dpt-empty-dot">?</span>
            </button>
          </div>
        ),
      },
    ];

    const screen = teachingScreens[teachingStep] || teachingScreens[0];

    return (
      <div
        className="dpt-page dpt-page--soft"
        style={{ "--dpt-bg": `url(${asset.background})` }}
      >
        <style>{dptInlineCss}</style>
        <div className="dpt-rule-card dpt-rule-card--icons">
          <div className="dpt-teaching-head">
            <div className="dpt-avatar-guide">
              <img src={asset.tutorialAvatar} alt="小助手" draggable="false" />
            </div>
            <div>
              <h1 className="dpt-rule-title">幫狐狸守住點心</h1>
              <h2 className="dpt-rule-icon-title">{screen.title}</h2>
            </div>
          </div>

          {screen.content}

          {practiceResult === "correct" && (
            <div className="dpt-icon-feedback dpt-icon-feedback--success">✓</div>
          )}

          {practiceResult === "wrong" && (
            <div className="dpt-icon-feedback dpt-icon-feedback--error">↺</div>
          )}

          <div className="dpt-guided-action dpt-guided-start">
            <button
              type="button"
              className="dpt-forest-button dpt-image-button dpt-btn-start"
              onClick={screen.key === "answer" ? startTest : nextTeachingStep}
              aria-label={screen.button}
            >
              <img src={asset.homeStartBtn} alt={screen.button} draggable="false" />
            </button>
            <img
              className="dpt-mouse-guide dpt-mouse-on-button"
              src={asset.mouseGuideImg}
              alt="提示點擊"
              aria-hidden="true"
              draggable="false"
            />
          </div>
        </div>
      </div>
    );
  }

  /* ========= 畫面：結束影片 ========= */
  if (phase === "endingVideo") {
    return (
      <div
        className="dpt-page dpt-page--soft"
        style={{ "--dpt-bg": `url(${asset.background})` }}
      >
        <style>{dptInlineCss}</style>
        <main className="dpt-center-shell">
          <section className="dpt-soft-panel dpt-video-panel" aria-label="結束動畫">
            <div className="dpt-video-frame">
              <video
                className="dpt-video"
                src={asset.endingVideo}
                autoPlay
                muted
                playsInline
                controls={false}
                preload="auto"
                onEnded={handleEndingVideoEnd}
              >
                你的瀏覽器不支援影片播放。
              </video>
            </div>

            <div className="dpt-guided-action dpt-guided-skip">
              <button
                type="button"
                className="dpt-forest-button dpt-image-button dpt-btn-skip"
                onClick={handleEndingVideoEnd}
                aria-label="跳過動畫"
              >
                <img src={asset.homeSkipBtn} alt="跳過動畫" draggable="false" />
              </button>
              <img
                className="dpt-mouse-guide dpt-mouse-on-button"
                src={asset.mouseGuideImg}
                alt="提示點擊"
                aria-hidden="true"
                draggable="false"
              />
            </div>
          </section>
        </main>
      </div>
    );
  }

  /* ========= 畫面：測驗完成 ========= */
  if (phase === "result") {
    return (
      <div
        className="dpt-page dpt-page--soft"
        style={{ "--dpt-bg": `url(${asset.background})` }}
      >
        <style>{dptInlineCss}</style>
        <main className="dpt-center-shell dpt-result-shell">
          <section className="dpt-soft-panel dpt-result-panel" aria-label="測驗結果">
            <div className="dpt-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span
                  key={star}
                  className={`dpt-cute-star ${star <= resultStars ? "is-on" : ""}`}
                >
                  ★
                </span>
              ))}
            </div>

            <div className="dpt-start-content dpt-result-content">
              <div className="dpt-dialog-bubble">
                關卡完成！你很認真幫狐狸守住點心喔。
              </div>

              <div className="dpt-round-icon dpt-result-icon">
                <img src={asset.startAvatar} alt="狐狸角色" draggable="false" />
              </div>
            </div>

            <div className="dpt-result-actions">
              <div className="dpt-guided-action dpt-guided-result-main">
                <button
                  type="button"
                  className="dpt-forest-button dpt-image-button dpt-btn-home"
                  onClick={() => navigate("/test-map")}
                  aria-label="回到森林"
                >
                  <img src={asset.homeBackBtn} alt="回到森林" draggable="false" />
                </button>
                <img
                  className="dpt-mouse-guide dpt-mouse-on-button"
                  src={asset.mouseGuideImg}
                  alt="提示點擊"
                  aria-hidden="true"
                  draggable="false"
                />
              </div>
              <button
                type="button"
                className="dpt-forest-button dpt-image-button dpt-btn-replay"
                onClick={handleReplay}
                aria-label="再玩一次"
              >
                <img src={asset.homeAgainBtn} alt="再玩一次" draggable="false" />
              </button>
              <button
                type="button"
                className="dpt-forest-button dpt-image-button dpt-btn-detail"
                onClick={goResultPage}
                aria-label="詳細結果"
              >
                <img src={asset.homeResultBtn} alt="詳細結果" draggable="false" />
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  /* ========= 畫面：正式測驗 ========= */
  return (
    <div
      className="dpt-page dpt-page--soft"
      style={{ "--dpt-bg": `url(${asset.background})` }}
    >
      <style>{dptInlineCss}</style>
      <div className="dpt-container">
        <div className="dpt-stage" onPointerDownCapture={handleStagePointerDown}>
          {showFixation && (
            <img
              className="dpt-fixation-bee"
              src={asset.bee}
              alt="注視蜜蜂"
              draggable="false"
            />
          )}

          <button
            type="button"
            className={[
              "dpt-side-zone",
              "dpt-side-zone--left",
              canAnswer ? "is-clickable" : "",
              feedbackSide === "left" && feedbackType === "correct"
                ? "is-correct"
                : "",
              feedbackSide === "left" && feedbackType === "wrong"
                ? "is-wrong"
                : "",
            ].join(" ")}
            style={framelessZoneStyle}
            onClick={() => handleAnswer("left")}
            disabled={!canAnswer}
            aria-label="左邊"
            data-answer-zone="true"
          >
            {showItems && currentTrial?.leftItem && (
              <img
                className="dpt-item"
                src={currentTrial.leftItem}
                alt="左邊物品"
                draggable="false"
                style={largeItemStyle}
              />
            )}
          </button>

          <button
            type="button"
            className={[
              "dpt-side-zone",
              "dpt-side-zone--right",
              canAnswer ? "is-clickable" : "",
              feedbackSide === "right" && feedbackType === "correct"
                ? "is-correct"
                : "",
              feedbackSide === "right" && feedbackType === "wrong"
                ? "is-wrong"
                : "",
            ].join(" ")}
            style={framelessZoneStyle}
            onClick={() => handleAnswer("right")}
            disabled={!canAnswer}
            aria-label="右邊"
            data-answer-zone="true"
          >
            {showItems && currentTrial?.rightItem && (
              <img
                className="dpt-item"
                src={currentTrial.rightItem}
                alt="右邊物品"
                draggable="false"
                style={largeItemStyle}
              />
            )}
          </button>

          {showFly && (
            <img
              className={[
                "dpt-fly",
                currentTrial?.flySide === "left"
                  ? "dpt-fly--left"
                  : "dpt-fly--right",
                flyHit ? "is-hit" : "",
              ].join(" ")}
              src={asset.fly}
              alt="蒼蠅"
              draggable="false"
              style={largeFlyStyle}
            />
          )}

          <img
            className={["dpt-fox", foxHappy ? "is-happy" : ""].join(" ")}
            src={asset.fox}
            alt="狐狸夫婦"
            draggable="false"
          />

          {feedbackSide && (
            <div
              className={[
                "dpt-effect",
                feedbackType === "correct"
                  ? "dpt-effect--correct"
                  : "dpt-effect--wrong",
              ].join(" ")}
              style={{
                left: feedbackSide === "left" ? "28%" : "72%",
                top: "32%",
              }}
            >
              {feedbackType === "correct" ? "✓" : "×"}
            </div>
          )}
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
.dpt-side-zone,
.dpt-practice-choice {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
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
.dpt-soft-panel, .dpt-rule-card { width: 100%; background: linear-gradient(180deg, rgba(255,238,174,.98), rgba(255,229,151,.98)); border: 7px solid #ff8426; border-radius: 72px; box-sizing: border-box; box-shadow: 0 18px 34px rgba(108,67,25,.12); }
.dpt-start-panel { min-height: 500px; padding: 52px 72px 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 44px; }
.dpt-game-title, .dpt-rule-title { display: inline-flex; align-items: center; justify-content: center; padding: 12px 34px; border-radius: 999px; border: 4px solid #ff8a37; background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,246,213,.98)); color: #3b2414; font-size: clamp(30px,3.8vw,48px); font-weight: 950; line-height: 1.08; letter-spacing: 1px; box-shadow: 0 8px 0 rgba(231,124,32,.2), 0 14px 26px rgba(108,67,25,.12); margin: 0; }
.dpt-start-content { width: min(100%,760px); display: grid; grid-template-columns: minmax(300px,1fr) 170px; align-items: center; justify-content: center; gap: 64px; }
.dpt-dialog-bubble { min-height: 138px; border: 5px solid #f0782e; border-radius: 28px; background: linear-gradient(180deg,#fff 0%,#fff9e9 100%); color: #1e1711; display: flex; align-items: center; justify-content: center; padding: 18px 30px; font-size: clamp(26px,3vw,38px); line-height: 1.32; font-weight: 900; box-sizing: border-box; position: relative; box-shadow: 0 8px 0 rgba(240,125,45,.12), inset 0 0 0 6px rgba(255,226,150,.28); }
.dpt-dialog-bubble::after { content: ""; position: absolute; right: -44px; top: 50%; width: 46px; height: 40px; background: #fff9e9; border-top: 5px solid #f0782e; border-right: 5px solid #f0782e; transform: translateY(-50%) skewX(-32deg) rotate(12deg); }
.dpt-round-icon { width: 170px; height: 170px; border-radius: 999px; background: linear-gradient(180deg,#4e82d5,#2f68c2); border: 3px solid #173466; display: flex; align-items: center; justify-content: center; overflow: hidden; box-sizing: border-box; padding: 10px; box-shadow: 0 10px 20px rgba(44,83,139,.18); }
.dpt-round-icon img { width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 50%; display: block; }
.dpt-forest-button, .dpt-start-button, .dpt-main-button { min-width: 184px; min-height: 72px; padding: 12px 34px; border-radius: 14px; color: #fff; font-family: inherit; font-size: clamp(23px,2.5vw,32px); font-weight: 900; line-height: 1.15; cursor: pointer; transition: transform .14s ease, filter .14s ease, box-shadow .14s ease, opacity .14s ease; }
.dpt-forest-button:hover:not(:disabled), .dpt-start-button:hover:not(:disabled), .dpt-main-button:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.04); }
.dpt-btn-start, .dpt-start-button, .dpt-main-button { border: 2px solid #2d6e31; background: linear-gradient(180deg,#7ec65b,#66a83f); box-shadow: 0 4px 0 rgba(34,92,35,.34), 0 10px 18px rgba(67,93,38,.16); }
.dpt-btn-skip { border: 2px solid #74513a; background: linear-gradient(180deg,#b28a68,#8e664f); box-shadow: 0 4px 0 rgba(84,56,38,.34),0 10px 18px rgba(84,56,38,.14); }
.dpt-btn-home { border: 2px solid #2d6e31; background: linear-gradient(180deg,#7ac65a,#5fa742); box-shadow: 0 4px 0 rgba(34,92,35,.34),0 10px 18px rgba(67,93,38,.14); }
.dpt-btn-replay { border: 2px solid #b45f18; background: linear-gradient(180deg,#ffbc58,#f08a2a); box-shadow: 0 4px 0 rgba(154,86,22,.34),0 10px 18px rgba(154,86,22,.14); }
.dpt-btn-detail { border: 2px solid #2c5e9a; background: linear-gradient(180deg,#75a8ff,#4d80d8); box-shadow: 0 4px 0 rgba(38,78,137,.34),0 10px 18px rgba(38,78,137,.14); }
.dpt-video-panel { min-height: 78vh; padding: 48px 72px 34px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; }
.dpt-video-frame { width: 100%; height: min(60vh,560px); min-height: 360px; border: 2px solid rgba(97,123,74,.55); border-radius: 22px; background: rgba(255,255,255,.38); overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.dpt-video { width: 100%; height: 100%; object-fit: cover; display: block; }
.dpt-rule-card { width: min(90vw,1120px); min-height: 72vh; margin: 8vh auto 0; padding: clamp(28px,4vw,52px); }
.dpt-rule-card--icons { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(18px,2.3vw,28px); }
.dpt-rule-icon-title { margin: 0; color: #3b2414; font-size: clamp(28px,3.2vw,44px); font-weight: 950; line-height: 1.15; }
.dpt-icon-flow { position: relative; width: min(760px,92vw); min-height: clamp(230px,30vw,330px); display: flex; align-items: center; justify-content: center; gap: clamp(20px,4vw,52px); margin: 2px auto 4px; }
.dpt-icon-flow--single { min-height: clamp(260px,32vw,360px); }
.dpt-mini-scene { position: relative; width: min(650px,88vw); height: clamp(250px,31vw,340px); }
.dpt-teach-fox { position: absolute; left: 8%; bottom: 0; width: clamp(150px,21vw,250px); height: auto; object-fit: contain; filter: drop-shadow(0 12px 12px rgba(74,54,25,.16)); }
.dpt-focus-ring { position: absolute; left: 50%; top: 45%; transform: translate(-50%,-50%); width: clamp(130px,16vw,190px); height: clamp(130px,16vw,190px); border-radius: 999px; background: rgba(255,255,255,.72); border: 6px solid #ff8a37; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 9px rgba(255,217,96,.35), 0 14px 22px rgba(108,67,25,.12); }
.dpt-teach-bee { width: 86%; height: 86%; object-fit: contain; animation: dptFloat 1.1s ease-in-out infinite; }
.dpt-eye-line { position: absolute; right: 13%; top: 38%; font-size: clamp(44px,7vw,82px); filter: drop-shadow(0 8px 10px rgba(74,54,25,.16)); }
.dpt-teach-side, .dpt-teach-probe, .dpt-teach-ghost, .dpt-practice-choice { position: relative; width: clamp(160px,21vw,250px); height: clamp(160px,21vw,250px); border-radius: 34px; background: rgba(255,255,255,.52); border: 5px solid rgba(255,138,55,.72); display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 22px rgba(108,67,25,.10); }
.dpt-teach-side img, .dpt-teach-ghost img { width: 80%; height: 80%; object-fit: contain; }
.dpt-teach-symbol, .dpt-teach-arrow { color: #7a4b25; font-size: clamp(42px,6vw,76px); font-weight: 950; }
.dpt-side-label { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); min-width: 62px; padding: 6px 14px; border-radius: 999px; background: #fff8dc; border: 4px solid #ff8a37; color: #3b2414; font-size: clamp(24px,2.7vw,34px); font-weight: 950; line-height: 1; box-shadow: 0 6px 0 rgba(231,124,32,.18); }
.dpt-memory-hint { position: absolute; left: 50%; bottom: -4px; transform: translateX(-50%); font-size: clamp(42px,5vw,64px); font-weight: 950; color: #5d361d; }
.dpt-teach-ghost { opacity: .34; border-style: dashed; }
.dpt-teach-probe { background: rgba(255,247,205,.68); }
.dpt-teach-fly { width: 72%; height: 72%; object-fit: contain; animation: dptFlyOnly 1.1s ease-in-out infinite; }
.dpt-practice-icon-wrap { width: min(680px,92vw); display: grid; grid-template-columns: 1fr 1fr; gap: clamp(24px,5vw,56px); margin: 8px auto 2px; }
.dpt-practice-choice { width: 100%; cursor: pointer; font-family: inherit; }
.dpt-practice-choice.is-correct { border-color: #65b943; box-shadow: 0 0 0 9px rgba(126,198,91,.22), 0 12px 22px rgba(108,67,25,.10); }
.dpt-practice-choice.is-wrong { border-color: #d84b38; box-shadow: 0 0 0 9px rgba(216,75,56,.16), 0 12px 22px rgba(108,67,25,.10); }
.dpt-empty-dot { color: #7a4b25; font-size: clamp(64px,8vw,92px); font-weight: 950; }
.dpt-icon-feedback { width: 68px; height: 68px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: 950; line-height: 1; margin: -8px auto -4px; }
.dpt-icon-feedback--success { color: #fff; background: #65b943; }
.dpt-icon-feedback--error { color: #fff; background: #d84b38; }
.dpt-rule-text { margin: 18px auto; color: #2c1d12; font-size: clamp(24px,2.8vw,36px); font-weight: 900; line-height: 1.35; }
.dpt-feedback-text { margin: 10px 0 16px; font-size: clamp(22px,2.5vw,30px); font-weight: 900; }
.dpt-feedback-text--success { color: #368131; }
.dpt-feedback-text--error { color: #c94d31; }
.dpt-container { width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 3vh 4vw; }
.dpt-stage { position: relative; width: min(86vw,1120px); height: min(78vh,650px); max-height: calc(100vh - 48px); overflow: hidden; border-radius: 34px; border: 4px solid rgba(255,255,255,.86); background: rgba(255,255,220,.34); box-shadow: inset 0 0 0 1px rgba(255,255,255,.40); }
.dpt-side-zone { position: absolute; top: 31%; width: 30%; height: 34%; display: flex; align-items: center; justify-content: center; padding: 0; }
.dpt-side-zone--left { left: 13%; }
.dpt-side-zone--right { right: 13%; }
.dpt-side-zone.is-clickable { cursor: pointer; }
.dpt-item, .dpt-fly, .dpt-fox, .dpt-fixation-bee { user-select: none; -webkit-user-drag: none; filter: drop-shadow(0 10px 14px rgba(74,54,25,.18)); }
.dpt-item--glow { filter: drop-shadow(0 0 22px rgba(255,216,61,.76)) drop-shadow(0 10px 14px rgba(74,54,25,.18)); }
.dpt-fixation-bee { position: absolute; left: 50%; top: 39%; width: clamp(88px,9vw,132px); height: auto; object-fit: contain; transform: translate(-50%,-50%); z-index: 6; animation: dptBeePulse .9s ease-in-out infinite; filter: drop-shadow(0 10px 14px rgba(74,54,25,.18)); }
.dpt-fly { position: absolute; top: 42%; z-index: 4; transform: translateX(-50%); animation: dptFlyFloat 1.2s ease-in-out infinite; }
.dpt-fly--left { left: 28%; }
.dpt-fly--right { left: 72%; right: auto; }
.dpt-fly.is-hit { animation: none; transform: translateX(-50%) scale(.82); opacity: .42; }
.dpt-fox { position: absolute; left: 50%; bottom: 1%; width: clamp(130px,14vw,190px); height: auto; transform: translateX(-50%); transition: transform .18s ease; }
.dpt-fox.is-happy { transform: translateX(-50%) translateY(-7px) scale(1.04); }
.dpt-effect { position: absolute; transform: translate(-50%,-50%); width: 74px; height: 74px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 56px; font-weight: 950; z-index: 10; pointer-events: none; animation: dptEffectPop .58s ease-out forwards; }
.dpt-effect--correct { color: #41a035; background: rgba(255,248,185,.38); box-shadow: 0 0 24px rgba(255,218,72,.52); }
.dpt-effect--wrong { color: #d84b38; background: rgba(255,255,255,.32); }
.dpt-result-panel { min-height: 520px; padding: 92px 72px 62px; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 58px; }
.dpt-cute-stars { position: absolute; top: -92px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; gap: 28px; z-index: 3; }
.dpt-cute-star { font-size: clamp(94px,10vw,136px); line-height: .9; color: #fff7cb; opacity: .9; -webkit-text-stroke: 5px #235395; text-shadow: 0 8px 0 rgba(64,84,70,.18),0 14px 18px rgba(72,58,32,.14); display: inline-block; transform: rotate(-10deg); }
.dpt-cute-star:nth-child(2) { transform: translateY(-22px) rotate(2deg); }
.dpt-cute-star:nth-child(3) { transform: rotate(12deg); }
.dpt-cute-star.is-on { color: #ffd83d; opacity: 1; -webkit-text-stroke: 5px #f3a91f; text-shadow: 0 6px 0 #d89a1b,0 12px 20px rgba(112,65,0,.26),0 0 20px rgba(255,246,158,.95); }
.dpt-result-actions { width: min(100%,760px); display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 20px; }
.dpt-result-actions .dpt-forest-button { width: 100%; min-width: 0; padding-inline: 16px; }
@keyframes dptBeePulse { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.08); } }
@keyframes dptFlyOnly { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes dptFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes dptFlyFloat { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-8px); } }
@keyframes dptEffectPop { from { opacity: .95; transform: translate(-50%,-50%) scale(.72); } to { opacity: 0; transform: translate(-50%,-50%) scale(1.45); } }
@media (max-width: 780px) { .dpt-center-shell,.dpt-start-shell,.dpt-result-shell { width: min(94vw,720px); } .dpt-soft-panel,.dpt-rule-card { border-radius: 42px; border-width: 5px; } .dpt-start-panel,.dpt-result-panel,.dpt-video-panel { padding: 34px 22px; } .dpt-start-content,.dpt-result-content { grid-template-columns: 1fr; gap: 26px; } .dpt-dialog-bubble::after { display: none; } .dpt-round-icon { width: 138px; height: 138px; } .dpt-result-actions { grid-template-columns: 1fr; } .dpt-video-frame { min-height: 280px; height: 52vh; } .dpt-rule-card { margin-top: 4vh; min-height: auto; } .dpt-stage { width: 92vw; height: 74vh; } .dpt-side-zone { top: 32%; width: 35%; height: 34%; } .dpt-side-zone--left { left: 6%; } .dpt-side-zone--right { right: 6%; } .dpt-fly { top: 43%; } .dpt-fly--left { left: 23.5%; } .dpt-fly--right { left: 76.5%; right: auto; } }
@media (max-width: 780px) { .dpt-rule-card--icons { gap: 16px; } .dpt-icon-flow { min-height: 230px; gap: 14px; } .dpt-teach-side, .dpt-teach-probe, .dpt-teach-ghost, .dpt-practice-choice { width: clamp(128px,38vw,180px); height: clamp(128px,38vw,180px); border-radius: 24px; } .dpt-practice-icon-wrap { gap: 16px; } .dpt-teach-symbol, .dpt-teach-arrow { font-size: 38px; } .dpt-memory-hint { bottom: -14px; } .dpt-focus-ring { left: 55%; } .dpt-eye-line { right: 4%; } }

/* ========= SRT style card + image button overrides ========= */
.dpt-page--soft {
  color: #4b2c16;
  background-image:
    radial-gradient(circle at 52% 9%, rgba(255,255,255,0.20), transparent 28%),
    linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.22)),
    var(--dpt-bg);
}

.dpt-center-shell {
  position: relative;
  z-index: 1;
}

.dpt-start-shell,
.dpt-result-shell {
  width: min(72vw, 860px);
}

.dpt-soft-panel,
.dpt-rule-card {
  position: relative;
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

.dpt-soft-panel::before,
.dpt-rule-card::before {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 42px;
  border: 2px dashed rgba(230, 170, 67, 0.42);
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
  background:
    radial-gradient(circle at 4% 40%, #8bc947 0 13px, transparent 14px),
    radial-gradient(circle at 8% 15%, #a4da58 0 9px, transparent 10px),
    radial-gradient(circle at 92% 42%, #8bc947 0 13px, transparent 14px),
    radial-gradient(circle at 88% 18%, #a4da58 0 9px, transparent 10px);
  opacity: 0.92;
}

.dpt-start-panel,
.dpt-result-panel,
.dpt-video-panel,
.dpt-rule-card > * {
  position: relative;
  z-index: 1;
}

.dpt-start-panel {
  min-height: 560px;
  padding: 58px 70px 74px;
  gap: 36px;
}

.dpt-game-title,
.dpt-rule-title {
  border: 5px solid #ff9a4b;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,246,213,0.98));
  color: #3b2414;
  box-shadow:
    0 8px 0 rgba(231, 124, 32, 0.18),
    0 14px 26px rgba(108, 67, 25, 0.12),
    inset 0 0 0 5px rgba(255, 222, 145, 0.26);
}

.dpt-dialog-bubble {
  border: 5px solid #f0782e;
  background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
  box-shadow:
    0 8px 0 rgba(240, 125, 45, 0.12),
    inset 0 0 0 6px rgba(255, 226, 150, 0.28);
}

.dpt-round-icon,
.dpt-avatar-guide {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.90);
  border: 5px solid #ff9a4b;
  box-shadow: 0 16px 24px rgba(92, 66, 29, 0.16);
}

.dpt-round-icon img,
.dpt-avatar-guide img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
  display: block;
}

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
}

.dpt-image-button::before,
.dpt-image-button::after {
  display: none;
}

.dpt-image-button img {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(74, 48, 16, 0.22));
}

.dpt-image-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.03);
  filter: brightness(1.04);
}

.dpt-image-button:active:not(:disabled) {
  transform: translateY(1px) scale(0.98);
}

.dpt-btn-skip.dpt-image-button {
  width: clamp(198px, 19vw, 266px);
}

.dpt-mouse-guide {
  position: absolute;
  width: clamp(48px, 5.2vw, 78px);
  height: auto;
  z-index: 8;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(58, 38, 14, 0.24));
  animation: dptMouseTap 1.15s ease-in-out infinite;
}

.dpt-mouse-on-button {
  right: -18px;
  bottom: -18px;
  transform-origin: 18% 18%;
}

@keyframes dptMouseTap {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.92; }
  45% { transform: translate(-10px, -9px) scale(1.08); opacity: 1; }
  62% { transform: translate(-4px, -4px) scale(0.96); opacity: 1; }
}

.dpt-video-frame {
  border: 4px solid #6fb6ec;
  border-radius: 24px;
  background: linear-gradient(180deg, #2fb5ff, #3189e5);
  box-shadow:
    0 8px 0 rgba(55, 121, 177, 0.18),
    inset 0 0 0 4px rgba(255,255,255,0.28);
}

.dpt-teaching-head {
  width: min(100%, 860px);
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  justify-items: center;
  gap: clamp(18px, 3vw, 34px);
}

.dpt-avatar-guide {
  width: clamp(112px, 13vw, 158px);
  height: clamp(112px, 13vw, 158px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 10px;
  box-sizing: border-box;
}

.dpt-rule-icon-title {
  margin-top: 14px;
}

.dpt-rule-card {
  width: min(88vw, 1100px);
  min-height: 76vh;
  padding: clamp(30px, 4vw, 54px) clamp(34px, 5vw, 70px) 70px;
}

.dpt-result-actions {
  align-items: center;
}

.dpt-result-actions .dpt-image-button {
  width: clamp(168px, 16vw, 224px);
}

.dpt-container,
.dpt-stage {
  position: relative;
  z-index: 1;
}

@media (max-width: 780px) {
  .dpt-start-shell,
  .dpt-result-shell {
    width: min(94vw, 720px);
  }

  .dpt-soft-panel,
  .dpt-rule-card {
    border-radius: 42px;
    border-width: 5px;
  }

  .dpt-soft-panel::before,
  .dpt-rule-card::before {
    inset: 12px;
    border-radius: 30px;
  }

  .dpt-start-panel,
  .dpt-result-panel,
  .dpt-video-panel {
    padding: 34px 22px 58px;
  }

  .dpt-teaching-head {
    grid-template-columns: 1fr;
  }

  .dpt-rule-card {
    width: min(94vw, 720px);
    padding-bottom: 62px;
  }

  .dpt-result-actions .dpt-image-button,
  .dpt-image-button,
  .dpt-image-button.dpt-btn-skip {
    width: clamp(174px, 50vw, 230px);
  }
}

`;
