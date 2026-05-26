// src/pages/TestPage_DCCS.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/GamePage_DCCS.css";

import dccsBackgroundImg from "../asset/DCCS_testbackground.png";
import introVideo from "../asset/SRT_start.mp4";
import endingVideo from "../asset/SRT_start.mp4";
import homeStartBtn from "../asset/home/start.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";

import { createGameResult } from "../ai/gameResultTemplate";
import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";

import peacockImg from "../asset/DCCS/dccs_peacock.png";
import basketTopImg from "../asset/DCCS/dccs_basket_left.png";
import basketBottomImg from "../asset/DCCS/dccs_basket_right.png";

import pinkSkirtImg from "../asset/DCCS/dccs_pink_skirt.png";
import blueSkirtImg from "../asset/DCCS/dccs_blue_skirt.png";
import pinkSocksImg from "../asset/DCCS/dccs_pink_socks.png";
import greenSocksImg from "../asset/DCCS/dccs_green_socks.png";
import yellowShirtImg from "../asset/DCCS/dccs_yellow_shirt.png";
import blueShirtImg from "../asset/DCCS/dccs_blue_shirt.png";
import yellowPantsImg from "../asset/DCCS/dccs_yellow_pants.png";
import purplePantsImg from "../asset/DCCS/dccs_purple_pants.png";

const RESULT_ROUTE = "/result-dccs";
const SESSION_KEY = "DCCS_RESULT";

// 前導影片與結束影片分開吃不同變數；目前先共用 SRT_start.mp4，之後可各自替換。
const INTRO_VIDEO_SRC = introVideo;
const END_VIDEO_SRC = endingVideo;

const PHASE = {
  START: "start",
  VIDEO_INTRO: "video_intro",
  STORY_INTRO: "story_intro",
  COLOR_RULE: "color_rule",
  PRACTICE: "practice",
  COLOR_TEST: "color_test",
  SWITCH_RULE: "switch_rule",
  TYPE_TEST: "type_test",
  END_VIDEO: "end_video",
  RESULT: "result",
};

const colorLabels = {
  pink: "粉紅色",
  blue: "藍色",
  yellow: "黃色",
  green: "綠色",
  purple: "紫色",
};

const typeLabels = {
  skirt: "裙子",
  socks: "襪子",
  shirt: "上衣",
  pants: "褲子",
};

const colorClassMap = {
  pink: "dccs-color-pink",
  blue: "dccs-color-blue",
  yellow: "dccs-color-yellow",
  green: "dccs-color-green",
  purple: "dccs-color-purple",
};

const colorHexMap = {
  pink: "#f7a6c8",
  blue: "#5aa8ff",
  yellow: "#ffd84d",
  green: "#79d67a",
  purple: "#b692ff",
};

const allCards = [
  {
    id: "pink_skirt",
    img: pinkSkirtImg,
    color: "pink",
    type: "skirt",
    colorText: "粉紅色",
    typeText: "裙子",
  },
  {
    id: "blue_skirt",
    img: blueSkirtImg,
    color: "blue",
    type: "skirt",
    colorText: "藍色",
    typeText: "裙子",
  },
  {
    id: "pink_socks",
    img: pinkSocksImg,
    color: "pink",
    type: "socks",
    colorText: "粉紅色",
    typeText: "襪子",
  },
  {
    id: "green_socks",
    img: greenSocksImg,
    color: "green",
    type: "socks",
    colorText: "綠色",
    typeText: "襪子",
  },
  {
    id: "yellow_shirt",
    img: yellowShirtImg,
    color: "yellow",
    type: "shirt",
    colorText: "黃色",
    typeText: "上衣",
  },
  {
    id: "blue_shirt",
    img: blueShirtImg,
    color: "blue",
    type: "shirt",
    colorText: "藍色",
    typeText: "上衣",
  },
  {
    id: "yellow_pants",
    img: yellowPantsImg,
    color: "yellow",
    type: "pants",
    colorText: "黃色",
    typeText: "褲子",
  },
  {
    id: "purple_pants",
    img: purplePantsImg,
    color: "purple",
    type: "pants",
    colorText: "紫色",
    typeText: "褲子",
  },
];

const colorSampleImg = {
  pink: pinkSkirtImg,
  blue: blueSkirtImg,
  yellow: yellowShirtImg,
  green: greenSocksImg,
  purple: purplePantsImg,
};

const typeSampleImg = {
  skirt: pinkSkirtImg,
  socks: greenSocksImg,
  shirt: yellowShirtImg,
  pants: purplePantsImg,
};

function getCard(cardId) {
  return allCards.find((card) => card.id === cardId);
}

function average(numbers = []) {
  const valid = numbers.filter(
    (n) => typeof n === "number" && Number.isFinite(n)
  );

  if (valid.length === 0) return 0;

  return Math.round(valid.reduce((sum, n) => sum + n, 0) / valid.length);
}

function saveSessionResult(resultData) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(resultData));
    localStorage.setItem("dccsTestResult", JSON.stringify(resultData));
  } catch (error) {
    console.warn("DCCS_RESULT 儲存失敗：", error);
  }
}

function positionToLegacySide(position) {
  if (position === "top") return "left";
  if (position === "bottom") return "right";
  return null;
}

function ColorDot({ colorKey, size = "guide" }) {
  return (
    <span
      className={`Dcss-color-dot-inline ${colorClassMap[colorKey] || ""} ${size}`}
      aria-hidden="true"
      style={{
        backgroundColor: colorHexMap[colorKey] || "#ddd",
      }}
    />
  );
}

function ShadowCloth({ src, label }) {
  return (
    <img
      src={src}
      alt={label}
      className="Dcss-shadow-cloth"
      aria-label={label}
    />
  );
}

function TestPage_DCCS() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState(PHASE.START);
  const [trialIndex, setTrialIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [trialLogs, setTrialLogs] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [pendingResult, setPendingResult] = useState(null);

  const trialStartTimeRef = useRef(null);
  const clickBehaviorRef = useRef({
    randomClick: 0,
    repeatedClick: 0,
  });
  const nextTrialTimerRef = useRef(null);
  const trialStartRafRef = useRef(null);

  const practiceTrials = useMemo(
    () => [
      {
        card: getCard("pink_skirt"),
        rule: "color",
        topTarget: { key: "pink", label: "粉紅色" },
        bottomTarget: { key: "blue", label: "藍色" },
      },
      {
        card: getCard("blue_shirt"),
        rule: "color",
        topTarget: { key: "pink", label: "粉紅色" },
        bottomTarget: { key: "blue", label: "藍色" },
      },
    ],
    []
  );

  const colorTestTrials = useMemo(
    () => [
      {
        card: getCard("pink_skirt"),
        rule: "color",
        topTarget: { key: "pink", label: "粉紅色" },
        bottomTarget: { key: "blue", label: "藍色" },
      },
      {
        card: getCard("blue_skirt"),
        rule: "color",
        topTarget: { key: "pink", label: "粉紅色" },
        bottomTarget: { key: "blue", label: "藍色" },
      },
      {
        card: getCard("yellow_shirt"),
        rule: "color",
        topTarget: { key: "yellow", label: "黃色" },
        bottomTarget: { key: "blue", label: "藍色" },
      },
      {
        card: getCard("blue_shirt"),
        rule: "color",
        topTarget: { key: "yellow", label: "黃色" },
        bottomTarget: { key: "blue", label: "藍色" },
      },
      {
        card: getCard("green_socks"),
        rule: "color",
        topTarget: { key: "green", label: "綠色" },
        bottomTarget: { key: "purple", label: "紫色" },
      },
      {
        card: getCard("purple_pants"),
        rule: "color",
        topTarget: { key: "green", label: "綠色" },
        bottomTarget: { key: "purple", label: "紫色" },
      },
    ],
    []
  );

  const typeTestTrials = useMemo(
    () => [
      {
        card: getCard("yellow_pants"),
        rule: "type",
        topTarget: { key: "shirt", label: "上衣", colorKey: "yellow" },
        bottomTarget: { key: "pants", label: "褲子", colorKey: "purple" },
      },
      {
        card: getCard("purple_pants"),
        rule: "type",
        topTarget: { key: "pants", label: "褲子", colorKey: "yellow" },
        bottomTarget: { key: "shirt", label: "上衣", colorKey: "purple" },
      },
      {
        card: getCard("blue_shirt"),
        rule: "type",
        topTarget: { key: "shirt", label: "上衣", colorKey: "yellow" },
        bottomTarget: { key: "pants", label: "褲子", colorKey: "blue" },
      },
      {
        card: getCard("yellow_shirt"),
        rule: "type",
        topTarget: { key: "pants", label: "褲子", colorKey: "yellow" },
        bottomTarget: { key: "shirt", label: "上衣", colorKey: "blue" },
      },
      {
        card: getCard("pink_socks"),
        rule: "type",
        topTarget: { key: "skirt", label: "裙子", colorKey: "pink" },
        bottomTarget: { key: "socks", label: "襪子", colorKey: "green" },
      },
      {
        card: getCard("green_socks"),
        rule: "type",
        topTarget: { key: "socks", label: "襪子", colorKey: "pink" },
        bottomTarget: { key: "skirt", label: "裙子", colorKey: "green" },
      },
      {
        card: getCard("blue_skirt"),
        rule: "type",
        topTarget: { key: "skirt", label: "裙子", colorKey: "blue" },
        bottomTarget: { key: "socks", label: "襪子", colorKey: "pink" },
      },
      {
        card: getCard("pink_skirt"),
        rule: "type",
        topTarget: { key: "socks", label: "襪子", colorKey: "blue" },
        bottomTarget: { key: "skirt", label: "裙子", colorKey: "pink" },
      },
    ],
    []
  );

  const currentTrials =
    phase === PHASE.PRACTICE
      ? practiceTrials
      : phase === PHASE.COLOR_TEST
      ? colorTestTrials
      : phase === PHASE.TYPE_TEST
      ? typeTestTrials
      : [];

  const currentTrial = currentTrials[trialIndex];
  const formalTotalTrials = colorTestTrials.length + typeTestTrials.length;

  const pageBackgroundStyle = {
    backgroundImage: `
      linear-gradient(rgba(255, 244, 206, 0.30), rgba(255, 244, 206, 0.30)),
      url(${dccsBackgroundImg})
    `,
  };

  const clearPendingTiming = () => {
    if (nextTrialTimerRef.current) {
      window.clearTimeout(nextTrialTimerRef.current);
      nextTrialTimerRef.current = null;
    }

    if (trialStartRafRef.current) {
      window.cancelAnimationFrame(trialStartRafRef.current);
      trialStartRafRef.current = null;
    }
  };

  const markTrialStartAfterPaint = () => {
    if (trialStartRafRef.current) {
      window.cancelAnimationFrame(trialStartRafRef.current);
    }

    trialStartTimeRef.current = null;
    trialStartRafRef.current = window.requestAnimationFrame(() => {
      trialStartTimeRef.current = Date.now();
      trialStartRafRef.current = null;
    });
  };

  useEffect(() => {
    return () => {
      clearPendingTiming();
    };
  }, []);

  const resetDccsTest = () => {
    clearPendingTiming();
    setTrialIndex(0);
    setFeedback(null);
    setSelectedPosition(null);
    setTrialLogs([]);
    setIsLocked(false);
    setPendingResult(null);
    trialStartTimeRef.current = null;
    clickBehaviorRef.current = { randomClick: 0, repeatedClick: 0 };
  };

  const handleStart = () => {
    resetDccsTest();
    setPhase(PHASE.VIDEO_INTRO);
  };

  const handleRestart = () => {
    handleStart();
  };

  const startTrialPhase = (nextPhase) => {
    clearPendingTiming();
    setPhase(nextPhase);
    setTrialIndex(0);
    setFeedback(null);
    setSelectedPosition(null);
    setIsLocked(false);
    markTrialStartAfterPaint();
  };

  const goNextStaticPage = () => {
    if (phase === PHASE.VIDEO_INTRO) {
      setPhase(PHASE.STORY_INTRO);
      return;
    }

    if (phase === PHASE.STORY_INTRO) {
      setPhase(PHASE.COLOR_RULE);
      return;
    }

    if (phase === PHASE.COLOR_RULE) {
      startTrialPhase(PHASE.PRACTICE);
      return;
    }

    if (phase === PHASE.SWITCH_RULE) {
      startTrialPhase(PHASE.TYPE_TEST);
    }
  };

  const getCorrectPosition = (trial) => {
    if (!trial) return null;

    const correctKey = trial.rule === "color" ? trial.card.color : trial.card.type;

    if (trial.topTarget.key === correctKey) return "top";
    if (trial.bottomTarget.key === correctKey) return "bottom";

    return null;
  };

  const getOldRulePosition = (trial) => {
    if (!trial || trial.rule !== "type") return null;

    const oldColorKey = trial.card.color;

    if (trial.topTarget.colorKey === oldColorKey) return "top";
    if (trial.bottomTarget.colorKey === oldColorKey) return "bottom";

    return null;
  };

  const buildResultData = (finalLogs) => {
    const formalLogs = finalLogs.filter(
      (trial) => trial.phase === PHASE.COLOR_TEST || trial.phase === PHASE.TYPE_TEST
    );

    const colorLogs = formalLogs.filter((trial) => trial.phase === PHASE.COLOR_TEST);
    const switchLogs = formalLogs.filter((trial) => trial.phase === PHASE.TYPE_TEST);

    const totalTrials = formalLogs.length;
    const correctCount = formalLogs.filter((trial) => trial.isCorrect).length;
    const colorCorrectCount = colorLogs.filter((trial) => trial.isCorrect).length;
    const switchCorrectCount = switchLogs.filter((trial) => trial.isCorrect).length;

    const avgReactionTime = average(formalLogs.map((trial) => trial.reactionTime));
    const colorAvgReactionTime = average(colorLogs.map((trial) => trial.reactionTime));
    const switchAvgReactionTime = average(
      switchLogs.map((trial) => trial.reactionTime)
    );

    const rtDifferenceAfterSwitch =
      colorAvgReactionTime > 0 && switchAvgReactionTime > 0
        ? switchAvgReactionTime - colorAvgReactionTime
        : 0;

    const perseverativeErrors = switchLogs.filter(
      (trial) => trial.isPerseverativeError
    ).length;

    const wrongTarget = formalLogs.filter(
      (trial) => !trial.isCorrect && !trial.isPerseverativeError
    ).length;

    const firstHalfLogs = formalLogs.slice(0, Math.ceil(formalLogs.length / 2));
    const secondHalfLogs = formalLogs.slice(Math.ceil(formalLogs.length / 2));

    const firstHalfRT = average(firstHalfLogs.map((trial) => trial.reactionTime));
    const secondHalfRT = average(secondHalfLogs.map((trial) => trial.reactionTime));
    const firstHalfErrors = firstHalfLogs.filter((trial) => !trial.isCorrect).length;
    const secondHalfErrors = secondHalfLogs.filter((trial) => !trial.isCorrect).length;

    const errorTypes = {
      miss: 0,
      randomClick: clickBehaviorRef.current.randomClick,
      wrongTarget,
      repeatedClick: clickBehaviorRef.current.repeatedClick,
      timeout: 0,
      sequenceError: 0,
      ruleSwitchError: perseverativeErrors,
    };

    const performanceResult = analyzePerformance({
      totalTrials,
      correctTrials: correctCount,
      reactionTimes: formalLogs.map((trial) => trial.reactionTime),
      errorTypes,
      difficulty: "normal",
    });

    const errorResult = analyzeErrors(errorTypes);

    const fatigueResult = analyzeFatigue({
      firstHalfRT,
      secondHalfRT,
      missIncrease: Math.max(secondHalfErrors - firstHalfErrors, 0),
    });
    const fatigueLevel = fatigueResult?.fatigueLevel || "low";

    const recommendedDifficulty = getRecommendedDifficulty({
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      errorTypes,
      fatigueLevel,
    });

    const baseResult = createGameResult({
      childId: "current-child",
      gameId: "DCCS",
      abilityType: "flexibility",
      mode: "test",
      difficulty: "normal",
      score: performanceResult.accuracy,
      stars: performanceResult.stars,
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      totalPlayTime:
        formalLogs.length > 0
          ? formalLogs[formalLogs.length - 1].timestamp - formalLogs[0].timestamp
          : 0,
      errorTypes,
      fatigueLevel,
      fatigueResult,
      attemptCount: 1,
    });

    return {
      ...baseResult,
      ...performanceResult,
      ...errorResult,
      task: "DCCS",
      gameId: "DCCS",
      abilityType: "flexibility",
      mode: "test",
      difficulty: "normal",

      totalTrials,
      correctCount,
      colorTrials: colorLogs.length,
      switchTrials: switchLogs.length,

      colorAccuracy:
        colorLogs.length > 0 ? Math.round((colorCorrectCount / colorLogs.length) * 100) : 0,
      switchAccuracy:
        switchLogs.length > 0 ? Math.round((switchCorrectCount / switchLogs.length) * 100) : 0,

      avgReactionTime,
      colorAvgReactionTime,
      switchAvgReactionTime,
      rtDifferenceAfterSwitch,

      perseverativeErrors,
      perseverativeErrorRate:
        switchLogs.length > 0 ? perseverativeErrors / switchLogs.length : 0,

      errorTypes,
      fatigueLevel,
      fatigueResult,
      recommendedDifficulty,
      firstHalfRT,
      secondHalfRT,
      trialLogs: formalLogs,
      completedAt: new Date().toISOString(),
    };
  };

  const finishTest = (finalLogs) => {
    const resultData = buildResultData(finalLogs);
    saveSessionResult(resultData);
    setPendingResult(resultData);
    setPhase(PHASE.END_VIDEO);
  };

  const handleEndingVideoDone = () => {
    setPhase(PHASE.RESULT);
  };

  const goResultPage = () => {
    const resultData = pendingResult || buildResultData(trialLogs);
    saveSessionResult(resultData);

    navigate(RESULT_ROUTE, {
      state: resultData,
      replace: true,
    });
  };

  const goNextTrial = (nextLogs) => {
    const isLastTrial = trialIndex >= currentTrials.length - 1;

    setFeedback(null);
    setSelectedPosition(null);
    setIsLocked(false);

    if (!isLastTrial) {
      setTrialIndex((prev) => prev + 1);
      markTrialStartAfterPaint();
      return;
    }

    if (phase === PHASE.PRACTICE) {
      startTrialPhase(PHASE.COLOR_TEST);
      return;
    }

    if (phase === PHASE.COLOR_TEST) {
      setPhase(PHASE.SWITCH_RULE);
      setTrialIndex(0);
      trialStartTimeRef.current = null;
      return;
    }

    if (phase === PHASE.TYPE_TEST) {
      finishTest(nextLogs);
    }
  };

  const handleAnswer = (position) => {
    if (!currentTrial) return;

    if (isLocked) {
      clickBehaviorRef.current.repeatedClick += 1;
      return;
    }

    setIsLocked(true);
    setSelectedPosition(position);

    const now = Date.now();
    const reactionTime = Math.max(0, now - (trialStartTimeRef.current || now));

    const correctPosition = getCorrectPosition(currentTrial);
    const oldRulePosition = getOldRulePosition(currentTrial);

    const isCorrect = position === correctPosition;
    const isPerseverativeError =
      phase === PHASE.TYPE_TEST && !isCorrect && position === oldRulePosition;

    const formalTrialNumber =
      phase === PHASE.COLOR_TEST
        ? trialIndex + 1
        : phase === PHASE.TYPE_TEST
        ? colorTestTrials.length + trialIndex + 1
        : null;

    const log = {
      trialIndex:
        phase === PHASE.PRACTICE ? trialIndex + 1 : formalTrialNumber,

      phase,
      rule: currentTrial.rule,

      cardId: currentTrial.card.id,
      cardColor: currentTrial.card.color,
      cardColorText: currentTrial.card.colorText,
      cardType: currentTrial.card.type,
      cardTypeText: currentTrial.card.typeText,

      topTarget: currentTrial.topTarget.key,
      topTargetLabel: currentTrial.topTarget.label,
      topTargetOldColor: currentTrial.topTarget.colorKey || null,

      bottomTarget: currentTrial.bottomTarget.key,
      bottomTargetLabel: currentTrial.bottomTarget.label,
      bottomTargetOldColor: currentTrial.bottomTarget.colorKey || null,

      userAnswerSide: position,
      correctSide: correctPosition,
      oldRuleSide: oldRulePosition,

      userAnswerSideLegacy: positionToLegacySide(position),
      correctSideLegacy: positionToLegacySide(correctPosition),
      oldRuleSideLegacy: positionToLegacySide(oldRulePosition),

      isCorrect,
      reactionTime,
      isAfterSwitch: phase === PHASE.TYPE_TEST,
      isPerseverativeError,
      timestamp: now,
    };

    let nextLogs = trialLogs;

    if (phase !== PHASE.PRACTICE) {
      nextLogs = [...trialLogs, log];
      setTrialLogs(nextLogs);
    }

    if (phase === PHASE.PRACTICE) {
      setFeedback(
        isCorrect
          ? { type: "correct", text: "好棒！" }
          : { type: "wrong", text: "看顏色喔" }
      );
    } else {
      setFeedback({ type: isCorrect ? "correct" : "wrong", text: "" });
    }

    if (nextTrialTimerRef.current) {
      window.clearTimeout(nextTrialTimerRef.current);
    }

    nextTrialTimerRef.current = window.setTimeout(() => {
      nextTrialTimerRef.current = null;
      goNextTrial(nextLogs);
    }, phase === PHASE.PRACTICE ? 900 : 600);
  };

  const renderStartPage = () => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTestPageCss}</style>
        <main className="Dcss-center-shell Dcss-start-shell">
          <section className="Dcss-soft-panel Dcss-start-panel" aria-label="開始畫面">
            <div className="Dcss-game-title">孔雀小姐的服飾店</div>

            <div className="Dcss-start-content">
              <div className="Dcss-dialog-bubble Dcss-opening-bubble">
                幫孔雀小姐把衣服放進正確的籃子。
              </div>

              <div className="Dcss-round-icon Dcss-start-icon">
                <img src={peacockImg} alt="孔雀小姐" />
              </div>
            </div>

            <div className="Dcss-guided-action Dcss-guided-start">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-start"
                onClick={handleStart}
                aria-label="進入遊戲"
              >
                <img src={homeStartBtn} alt="進入遊戲" />
              </button>
              <img className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      </div>
    );
  };

  const renderVideoPage = ({ src, title, buttonText, onDone }) => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTestPageCss}</style>
        <main className="Dcss-center-shell Dcss-video-shell">
          <section className="Dcss-soft-panel Dcss-video-card" aria-label={title}>
            <div className="Dcss-video-frame">
              <video
                className="Dcss-guide-video"
                src={src}
                autoPlay
                playsInline
                controls={false}
                onEnded={onDone}
                onError={onDone}
              />
            </div>

            <div className="Dcss-guided-action Dcss-guided-skip">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-skip"
                onClick={onDone}
                aria-label={buttonText}
              >
                <img src={homeSkipBtn} alt={buttonText} />
              </button>
              <img className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      </div>
    );
  };

  const renderStoryIntro = () => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTestPageCss}</style>
        <div className="Dcss-intro-card Dcss-icon-intro-card">
          <div className="Dcss-intro-left">
            <img
              src={peacockImg}
              alt="孔雀小姐"
              className="Dcss-peacock-large"
            />
          </div>

          <div className="Dcss-intro-content Dcss-icon-intro-content">
            <div className="Dcss-tag">孔雀小姐的服飾店</div>

            <h1>幫衣服找籃子</h1>

            <div className="Dcss-picture-rule-row" aria-label="遊戲故事示意">
              <img src={pinkSkirtImg} alt="粉紅裙子" className="Dcss-rule-cloth-demo" />
              <span className="Dcss-big-arrow">→</span>
              <img src={basketTopImg} alt="籃子" className="Dcss-rule-basket-demo" />
            </div>

            <div className="Dcss-guided-action Dcss-guided-rule">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-start"
                onClick={goNextStaticPage}
                aria-label="開始"
              >
                <img src={homeStartBtn} alt="開始" />
              </button>
              <img className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderColorRule = () => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTestPageCss}</style>
        <div className="Dcss-rule-card Dcss-picture-rule-card">
          <img src={peacockImg} alt="孔雀小姐" className="Dcss-peacock-rule" />

          <div className="Dcss-rule-content Dcss-picture-rule-content">
            <div className="Dcss-tag">先看顏色</div>

            <div className="Dcss-rule-icon-title">
              <span className="Dcss-eye-icon" aria-hidden="true">👀</span>
              <span className="Dcss-color-dots" aria-hidden="true">
                <i className="dccs-color-pink" />
                <i className="dccs-color-blue" />
                <i className="dccs-color-yellow" />
              </span>
            </div>

            <div className="Dcss-picture-rule-row">
              <div className="Dcss-mini-example">
                <img src={pinkSkirtImg} alt="粉紅裙子" />
                <span className="Dcss-big-arrow">→</span>
                <div className="Dcss-demo-target Dcss-demo-target-color">
                  <ColorDot colorKey="pink" />
                  <img src={basketTopImg} alt="粉紅籃" />
                </div>
              </div>

              <div className="Dcss-mini-example">
                <img src={blueShirtImg} alt="藍色上衣" />
                <span className="Dcss-big-arrow">→</span>
                <div className="Dcss-demo-target Dcss-demo-target-color">
                  <ColorDot colorKey="blue" />
                  <img src={basketBottomImg} alt="藍色籃" />
                </div>
              </div>
            </div>

            <div className="Dcss-guided-action Dcss-guided-rule">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-start"
                onClick={goNextStaticPage}
                aria-label="試試看"
              >
                <img src={homeStartBtn} alt="試試看" />
              </button>
              <img className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSwitchRule = () => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTestPageCss}</style>
        <div className="Dcss-switch-card Dcss-picture-rule-card">
          <img src={peacockImg} alt="孔雀小姐" className="Dcss-peacock-rule" />

          <div className="Dcss-rule-content Dcss-picture-rule-content">
            <div className="Dcss-tag danger">換規則</div>
            <h1 className="Dcss-switch-title">接下來改看衣服種類</h1>
            <div className="Dcss-picture-rule-row">
              <div className="Dcss-mini-example">
                <img src={blueShirtImg} alt="上衣" />
                <span className="Dcss-big-arrow">→</span>
                <div className="Dcss-demo-target Dcss-demo-target-type">
                  <ShadowCloth src={yellowShirtImg} label="上衣剪影" />
                  <img src={basketTopImg} alt="上衣籃子" />
                </div>
              </div>

              <div className="Dcss-mini-example">
                <img src={pinkSkirtImg} alt="裙子" />
                <span className="Dcss-big-arrow">→</span>
                <div className="Dcss-demo-target Dcss-demo-target-type">
                  <ShadowCloth src={blueSkirtImg} label="裙子剪影" />
                  <img src={basketBottomImg} alt="裙子籃子" />
                </div>
              </div>
            </div>

            <div className="Dcss-guided-action Dcss-guided-rule">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-start"
                onClick={goNextStaticPage}
                aria-label="開始"
              >
                <img src={homeStartBtn} alt="開始" />
              </button>
              <img className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getRuleTitle = () => {
    if (phase === PHASE.PRACTICE) return "看顏色";
    if (phase === PHASE.COLOR_TEST) return "看顏色";
    if (phase === PHASE.TYPE_TEST) return "看衣服";
    return "";
  };

  const getProgressText = () => {
    if (phase === PHASE.PRACTICE) {
      return `練習 ${trialIndex + 1} / ${practiceTrials.length}`;
    }

    if (phase === PHASE.COLOR_TEST) {
      return `${trialIndex + 1} / ${formalTotalTrials}`;
    }

    if (phase === PHASE.TYPE_TEST) {
      return `${colorTestTrials.length + trialIndex + 1} / ${formalTotalTrials}`;
    }

    return "";
  };

  const getRuleMode = () => {
    return phase === PHASE.TYPE_TEST ? "type" : "color";
  };

  const getTargetVisual = (target) => {
    const mode = getRuleMode();

    if (mode === "color") {
      return {
        mode,
        label: colorLabels[target.key] || target.label,
        colorKey: target.key,
        image: colorSampleImg[target.key],
      };
    }

    return {
      mode,
      label: typeLabels[target.key] || target.label,
      image: typeSampleImg[target.key],
    };
  };

  const renderTargetVisual = (target) => {
    const visual = getTargetVisual(target);

    // 正式測驗不可直接把「同一件衣服」放在答案籃上。
    // 顏色規則：只顯示色塊，不顯示衣服圖。
    // 種類規則：只顯示灰階類別圖示，避免用顏色提示答案。
    if (visual.mode === "color") {
      return (
        <div className="Dcss-visual-target Dcss-color-target Dcss-color-target-only">
          <ColorDot colorKey={visual.colorKey} size="test" />
        </div>
      );
    }

    return (
      <div className="Dcss-visual-target Dcss-type-target Dcss-type-target-neutral">
        <ShadowCloth src={visual.image} label={`${visual.label}剪影`} />
      </div>
    );
  };

  const handleTrialAreaClick = (event) => {
    if (!currentTrial || isLocked) return;

    const clickedBasket = event.target.closest(".Dcss-basket-btn");
    const clickedCloth = event.target.closest(".Dcss-cloth-card");

    if (!clickedBasket && !clickedCloth) {
      clickBehaviorRef.current.randomClick += 1;
    }
  };

  const renderTrialPage = () => {
    if (!currentTrial) return null;

    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTestPageCss}</style>
        <div className="Dcss-test-shell Dcss-test-shell-visual">
          <div className="Dcss-top-bar Dcss-top-bar-compact">
            <div className="Dcss-top-spacer" aria-hidden="true" />

            <div className="Dcss-progress-pill">{getProgressText()}</div>
          </div>

          <div
            className="Dcss-main-area Dcss-main-area-bottom-baskets Dcss-main-area-visual"
            onClick={handleTrialAreaClick}
          >
            <div className="Dcss-play-row">
              <div className="Dcss-card-stage Dcss-card-stage-visual">
                <div className={`Dcss-cloth-card ${feedback ? feedback.type : ""}`}>
                  <img src={currentTrial.card.img} alt={currentTrial.card.id} />
                </div>
              </div>
            </div>

            <div className="Dcss-baskets-row Dcss-baskets-bottom Dcss-visual-baskets-bottom">
              <button
                type="button"
                className={`Dcss-basket-btn Dcss-visual-basket-btn ${
                  selectedPosition === "top" ? "selected" : ""
                }`}
                onClick={() => handleAnswer("top")}
                aria-label={currentTrial.topTarget.label}
              >
                {renderTargetVisual(currentTrial.topTarget)}
                <img src={basketTopImg} alt="上方籃子" />
              </button>

              <button
                type="button"
                className={`Dcss-basket-btn Dcss-visual-basket-btn ${
                  selectedPosition === "bottom" ? "selected" : ""
                }`}
                onClick={() => handleAnswer("bottom")}
                aria-label={currentTrial.bottomTarget.label}
              >
                {renderTargetVisual(currentTrial.bottomTarget)}
                <img src={basketBottomImg} alt="下方籃子" />
              </button>
            </div>

            {feedback && feedback.text && (
              <div className={`Dcss-feedback ${feedback.type}`}>
                {feedback.text}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getResultStars = () => {
    const stars = Number(pendingResult?.stars || pendingResult?.gameResult?.stars);
    if (Number.isFinite(stars) && stars > 0) return Math.max(1, Math.min(3, Math.round(stars)));

    const accuracy = Number(pendingResult?.accuracy);
    if (accuracy >= 85) return 3;
    if (accuracy >= 60) return 2;
    return 1;
  };

  const renderResultPage = () => {
    const resultStars = getResultStars();

    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTestPageCss}</style>
        <main className="Dcss-center-shell Dcss-result-shell">
          <section className="Dcss-soft-panel Dcss-result-panel" aria-label="測驗結果">
            <div className="Dcss-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span key={star} className={`Dcss-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>
              ))}
            </div>

            <div className="Dcss-start-content Dcss-result-content">
              <div className="Dcss-dialog-bubble">
                完成了！孔雀小姐謝謝你幫忙整理衣服。
              </div>

              <div className="Dcss-round-icon Dcss-result-icon">
                <img src={peacockImg} alt="孔雀小姐" />
              </div>
            </div>

            <div className="Dcss-result-actions">
              <div className="Dcss-guided-action Dcss-guided-result-main">
                <button
                  type="button"
                  className="Dcss-forest-button Dcss-image-button Dcss-btn-home"
                  onClick={() => navigate("/test-map")}
                  aria-label="回到森林"
                >
                  <img src={homeBackBtn} alt="回到森林" />
                </button>
                <img className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
              </div>
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-replay"
                onClick={handleRestart}
                aria-label="再玩一次"
              >
                <img src={homeAgainBtn} alt="再玩一次" />
              </button>
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-detail"
                onClick={goResultPage}
                aria-label="詳細結果"
              >
                <img src={homeResultBtn} alt="詳細結果" />
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  };

  if (phase === PHASE.START) return renderStartPage();

  if (phase === PHASE.VIDEO_INTRO) {
    return renderVideoPage({
      src: INTRO_VIDEO_SRC,
      title: "前導影片",
      buttonText: "跳過",
      onDone: goNextStaticPage,
    });
  }

  if (phase === PHASE.STORY_INTRO) return renderStoryIntro();
  if (phase === PHASE.COLOR_RULE) return renderColorRule();
  if (phase === PHASE.SWITCH_RULE) return renderSwitchRule();

  if (phase === PHASE.END_VIDEO) {
    return renderVideoPage({
      src: END_VIDEO_SRC,
      title: "完成影片",
      buttonText: "跳過動畫",
      onDone: handleEndingVideoDone,
    });
  }

  if (phase === PHASE.RESULT) return renderResultPage();

  return renderTrialPage();
}

export default TestPage_DCCS;

const dccsTestPageCss = `
.Dcss-srt-like-page {
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  font-family: "jf-openhuninn", "Fredoka", "Nunito", "Noto Sans TC", sans-serif;
  text-align: center;
}

.Dcss-center-shell {
  width: min(90vw, 1180px);
  min-height: 100vh;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 28px 0;
}

.Dcss-start-shell {
  width: min(78vw, 960px);
}

.Dcss-soft-panel {
  width: 100%;
  background: linear-gradient(180deg, rgba(255, 238, 174, 0.98), rgba(255, 229, 151, 0.98));
  border: 7px solid #ff8426;
  border-radius: 72px;
  box-sizing: border-box;
  box-shadow: 0 18px 34px rgba(108, 67, 25, 0.12);
}

.Dcss-start-panel {
  min-height: 500px;
  padding: 32px 72px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 42px;
}

.Dcss-game-title {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: min(100%, 560px);
  padding: 14px 34px;
  border-radius: 18px;
  border: 6px solid #ff8a37;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 245, 201, 0.98));
  color: #3b2414;
  font-size: clamp(26px, 3vw, 42px);
  font-weight: 900;
  line-height: 1.1;
}

.Dcss-start-content {
  width: min(100%, 780px);
  display: grid;
  grid-template-columns: minmax(300px, 1fr) 160px;
  align-items: center;
  justify-content: center;
  gap: 56px;
}

.Dcss-dialog-bubble {
  position: relative;
  min-height: 124px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 34px;
  border: 4px solid #f27a2e;
  border-radius: 26px;
  background: rgba(255,255,255,0.98);
  color: #251407;
  font-size: clamp(28px, 3vw, 42px);
  font-weight: 900;
  line-height: 1.35;
  box-sizing: border-box;
}

.Dcss-dialog-bubble::after {
  content: "";
  position: absolute;
  right: -44px;
  top: 58%;
  width: 48px;
  height: 34px;
  background: rgba(255,255,255,0.98);
  border-top: 4px solid #f27a2e;
  border-right: 4px solid #f27a2e;
  transform: translateY(-50%) skewX(-34deg) rotate(10deg);
}

.Dcss-round-icon {
  width: 154px;
  height: 154px;
  border-radius: 50%;
  border: 3px solid #22345f;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  padding: 8px;
}

.Dcss-round-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.Dcss-forest-button,
.Dcss-main-btn {
  min-width: 194px;
  min-height: 78px;
  border: 2px solid #34651e;
  border-radius: 14px;
  background: #72b247;
  color: #fff;
  font-size: clamp(26px, 2.6vw, 38px);
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 5px 0 rgba(43, 93, 28, 0.22);
}

.Dcss-video-card {
  width: min(80vw, 1150px) !important;
  min-height: 640px;
  margin: auto;
  padding: 52px 64px 32px !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: linear-gradient(180deg, rgba(255, 238, 174, 0.98), rgba(255, 229, 151, 0.98)) !important;
  border: 7px solid #ff8426 !important;
  border-radius: 72px !important;
  box-sizing: border-box;
}

.Dcss-guide-video {
  width: min(100%, 1006px) !important;
  height: min(58vh, 466px) !important;
  object-fit: cover;
  background: #4778c7;
  border: 2px solid rgba(42, 45, 65, 0.6);
}

.Dcss-result-shell {
  width: min(84vw, 1040px) !important;
  min-height: 100vh;
  padding: 46px 0 30px;
  background: transparent !important;
}

.Dcss-result-panel {
  position: relative;
  width: 100%;
  min-height: 520px;
  max-height: 580px;
  padding: 92px 70px 58px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 44px;
  box-sizing: border-box;
}

.Dcss-result-content {
  width: min(100%, 860px);
  grid-template-columns: minmax(430px, 1fr) 154px;
  align-items: center;
  justify-content: center;
  gap: 58px;
}

.Dcss-result-content .Dcss-dialog-bubble {
  min-height: 132px;
  padding: 22px 42px;
  font-size: clamp(30px, 2.9vw, 40px);
}

.Dcss-result-icon {
  width: 154px;
  height: 154px;
}

.Dcss-cute-stars {
  position: absolute;
  top: -78px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 42px;
  pointer-events: none;
}

.Dcss-cute-star {
  color: #d8ddd2;
  -webkit-text-stroke: 6px rgba(81, 101, 74, 0.35);
  text-shadow: 0 9px 0 rgba(98, 82, 42, 0.10);
  font-size: clamp(82px, 7.8vw, 112px);
  line-height: 0.9;
  transform: rotate(-8deg);
}

.Dcss-cute-star.is-on {
  color: #ffd637;
  -webkit-text-stroke: 6px #b37600;
}

.Dcss-cute-star:nth-child(2) {
  transform: translateY(-20px) rotate(3deg);
}

.Dcss-cute-star:nth-child(3) {
  transform: rotate(10deg);
}

.Dcss-result-actions {
  width: min(100%, 770px);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 30px;
}

.Dcss-result-actions .Dcss-forest-button {
  min-width: 0;
  min-height: 78px;
  font-size: clamp(28px, 2.7vw, 38px);
}

.Dcss-btn-home { background: #72b247; }
.Dcss-btn-replay { background: #73aee8; border-color: #376a9a; }
.Dcss-btn-detail { background: #f2ad45; border-color: #9d6422; }

.Dcss-rule-change-visual,
.Dcss-rule-banner,
.Dcss-icon-rule-banner,
.Dcss-current-rule-icons {
  display: none !important;
}

.Dcss-helper img,
.Dcss-peacock-large,
.Dcss-peacock-rule,
.Dcss-cloth-card img,
.Dcss-rule-cloth-demo,
.Dcss-rule-basket-demo,
.Dcss-mini-example img,
.Dcss-basket-btn img,
.Dcss-visual-target img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.Dcss-helper,
.Dcss-cloth-card,
.Dcss-visual-target,
.Dcss-demo-target,
.Dcss-basket-btn {
  overflow: hidden;
}


/* DCCS 測驗版：把答案籃移到衣服下方，避免右側畫面過擠 */
.Dcss-main-area-bottom-baskets {
  width: min(100%, 1480px);
  min-height: clamp(560px, 72vh, 820px);
  margin: 0 auto;
  padding: clamp(18px, 2.2vw, 34px) clamp(20px, 3vw, 48px);
  display: grid !important;
  grid-template-rows: minmax(0, 1fr) auto;
  align-items: center;
  justify-items: center;
  gap: clamp(14px, 2vh, 26px);
  box-sizing: border-box;
  position: relative;
}

.Dcss-play-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(180px, 270px) minmax(360px, 560px) minmax(180px, 270px);
  align-items: center;
  justify-items: center;
  gap: clamp(18px, 4vw, 72px);
}

.Dcss-play-row .Dcss-helper {
  grid-column: 1;
  justify-self: center;
}

.Dcss-play-row .Dcss-card-stage {
  grid-column: 2;
  justify-self: center;
}

.Dcss-baskets-bottom,
.Dcss-visual-baskets-bottom {
  width: min(100%, 860px);
  display: grid !important;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: clamp(18px, 3vw, 44px);
  align-items: stretch;
  justify-content: center;
  justify-items: stretch;
  margin: 0 auto;
}

.Dcss-baskets-bottom .Dcss-visual-basket-btn {
  width: 100%;
  min-height: clamp(142px, 19vh, 210px);
  padding: clamp(12px, 1.8vw, 22px);
  display: grid;
  grid-template-rows: 64px minmax(78px, 1fr);
  align-items: center;
  justify-items: center;
  box-sizing: border-box;
}

.Dcss-baskets-bottom .Dcss-visual-target {
  width: clamp(54px, 5.5vw, 78px);
  height: clamp(54px, 5.5vw, 78px);
}

.Dcss-baskets-bottom .Dcss-basket-btn > img {
  width: min(62%, 170px);
  max-height: 112px;
  object-fit: contain;
}

.Dcss-baskets-bottom .Dcss-color-dot-inline.test {
  width: clamp(50px, 5vw, 72px);
  height: clamp(50px, 5vw, 72px);
}

.Dcss-baskets-bottom .Dcss-shadow-cloth {
  width: clamp(52px, 5.2vw, 76px);
  height: clamp(52px, 5.2vw, 76px);
}

/* 修正：外部 GamePage_DCCS.css 可能仍把籃子或按鈕設成 absolute，
   這裡全部重設，避免籃子浮到衣服卡片上。 */
.Dcss-main-area-bottom-baskets .Dcss-play-row,
.Dcss-main-area-bottom-baskets .Dcss-card-stage,
.Dcss-main-area-bottom-baskets .Dcss-helper,
.Dcss-main-area-bottom-baskets .Dcss-baskets-bottom,
.Dcss-main-area-bottom-baskets .Dcss-visual-baskets-bottom,
.Dcss-main-area-bottom-baskets .Dcss-basket-btn {
  position: relative !important;
  inset: auto !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;
  transform: none !important;
}

.Dcss-main-area-bottom-baskets .Dcss-play-row {
  grid-row: 1;
  z-index: 1;
}

.Dcss-main-area-bottom-baskets .Dcss-baskets-bottom,
.Dcss-main-area-bottom-baskets .Dcss-visual-baskets-bottom {
  grid-row: 2;
  z-index: 2;
}

.Dcss-main-area-bottom-baskets .Dcss-cloth-card {
  position: relative !important;
  z-index: 1;
}

@media (max-width: 980px) {
  .Dcss-main-area-bottom-baskets {
    min-height: auto;
    padding: 18px 14px 22px;
  }

  .Dcss-play-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .Dcss-play-row .Dcss-helper,
  .Dcss-play-row .Dcss-card-stage {
    grid-column: 1;
  }

  .Dcss-baskets-bottom,
  .Dcss-visual-baskets-bottom {
    width: min(100%, 620px);
    grid-template-columns: repeat(2, minmax(160px, 1fr));
    gap: 14px;
  }

  .Dcss-baskets-bottom .Dcss-visual-basket-btn {
    min-height: 132px;
    grid-template-rows: 52px minmax(70px, 1fr);
  }

  .Dcss-baskets-bottom .Dcss-basket-btn > img {
    width: min(70%, 130px);
    max-height: 82px;
  }
}


@media (max-width: 820px) {
  .Dcss-start-shell {
    width: min(92vw, 720px);
  }

  .Dcss-result-shell {
    width: min(92vw, 720px) !important;
    padding: 44px 0 24px;
  }

  .Dcss-soft-panel {
    border-radius: 44px;
  }

  .Dcss-start-panel {
    padding: 34px 24px;
    gap: 28px;
  }

  .Dcss-result-panel {
    min-height: 0;
    max-height: none;
    padding: 68px 24px 34px;
    gap: 28px;
  }

  .Dcss-start-content,
  .Dcss-result-content {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 22px;
  }

  .Dcss-dialog-bubble::after {
    display: none;
  }

  .Dcss-result-actions {
    width: min(100%, 360px);
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .Dcss-result-actions .Dcss-forest-button {
    min-height: 66px;
  }
}

/* DCCS 測驗版修正 2：籃子固定在衣服卡片下方，不再延伸到孔雀區或被左側裁切 */
.Dcss-test-shell-visual {
  overflow: visible !important;
}

.Dcss-main-area-bottom-baskets {
  width: min(100%, 1320px) !important;
  min-height: clamp(560px, 70vh, 760px) !important;
  grid-template-columns: minmax(210px, 300px) minmax(520px, 700px) !important;
  grid-template-rows: minmax(300px, auto) auto !important;
  column-gap: clamp(24px, 4vw, 70px) !important;
  row-gap: clamp(12px, 1.6vh, 22px) !important;
  align-items: center !important;
  justify-content: center !important;
  justify-items: center !important;
  padding: clamp(16px, 2vw, 30px) clamp(20px, 3vw, 46px) clamp(20px, 2.2vw, 36px) !important;
}

.Dcss-main-area-bottom-baskets .Dcss-play-row {
  display: contents !important;
  width: auto !important;
}

.Dcss-main-area-bottom-baskets .Dcss-helper {
  grid-column: 1 !important;
  grid-row: 1 / 3 !important;
  align-self: center !important;
  justify-self: center !important;
  width: min(100%, 290px) !important;
  max-width: 290px !important;
}

.Dcss-main-area-bottom-baskets .Dcss-card-stage {
  grid-column: 2 !important;
  grid-row: 1 !important;
  align-self: end !important;
  justify-self: center !important;
  width: min(100%, 640px) !important;
  max-width: 640px !important;
}

.Dcss-main-area-bottom-baskets .Dcss-cloth-card {
  width: min(100%, 560px) !important;
  height: clamp(300px, 36vh, 430px) !important;
  margin: 0 auto !important;
}

.Dcss-main-area-bottom-baskets .Dcss-baskets-bottom,
.Dcss-main-area-bottom-baskets .Dcss-visual-baskets-bottom {
  grid-column: 2 !important;
  grid-row: 2 !important;
  width: min(100%, 640px) !important;
  max-width: 640px !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: clamp(14px, 2vw, 28px) !important;
  margin: 0 auto !important;
  align-self: start !important;
  justify-self: center !important;
  overflow: visible !important;
}

.Dcss-main-area-bottom-baskets .Dcss-visual-basket-btn {
  width: 100% !important;
  min-width: 0 !important;
  min-height: clamp(150px, 18vh, 190px) !important;
  max-height: none !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}

.Dcss-main-area-bottom-baskets .Dcss-feedback {
  grid-column: 2 !important;
  grid-row: 3 !important;
  position: relative !important;
  inset: auto !important;
  transform: none !important;
}

@media (max-width: 980px) {
  .Dcss-main-area-bottom-baskets {
    grid-template-columns: 1fr !important;
    grid-template-rows: auto auto auto !important;
    min-height: auto !important;
  }

  .Dcss-main-area-bottom-baskets .Dcss-helper,
  .Dcss-main-area-bottom-baskets .Dcss-card-stage,
  .Dcss-main-area-bottom-baskets .Dcss-baskets-bottom,
  .Dcss-main-area-bottom-baskets .Dcss-visual-baskets-bottom,
  .Dcss-main-area-bottom-baskets .Dcss-feedback {
    grid-column: 1 !important;
    grid-row: auto !important;
  }

  .Dcss-main-area-bottom-baskets .Dcss-helper {
    max-width: 260px !important;
  }

  .Dcss-main-area-bottom-baskets .Dcss-card-stage,
  .Dcss-main-area-bottom-baskets .Dcss-baskets-bottom,
  .Dcss-main-area-bottom-baskets .Dcss-visual-baskets-bottom {
    width: min(100%, 620px) !important;
  }

  .Dcss-main-area-bottom-baskets .Dcss-cloth-card {
    height: clamp(250px, 34vh, 360px) !important;
  }
}

@media (max-width: 620px) {
  .Dcss-main-area-bottom-baskets .Dcss-baskets-bottom,
  .Dcss-main-area-bottom-baskets .Dcss-visual-baskets-bottom {
    grid-template-columns: 1fr !important;
    width: min(100%, 310px) !important;
  }
}


/* === SRT-like card/button visual sync === */
.Dcss-srt-like-page::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 52% 9%, rgba(255,255,255,0.22), transparent 28%),
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,239,188,0.10));
  z-index: 0;
}

.Dcss-center-shell,
.Dcss-test-shell,
.Dcss-test-shell-visual,
.Dcss-intro-card,
.Dcss-rule-card,
.Dcss-switch-card {
  position: relative;
  z-index: 1;
}

.Dcss-start-shell,
.Dcss-result-shell {
  width: min(72vw, 860px) !important;
}

.Dcss-soft-panel,
.Dcss-intro-card,
.Dcss-rule-card,
.Dcss-switch-card,
.Dcss-test-shell-visual {
  position: relative;
  box-sizing: border-box;
  border: 7px solid #f6a51f !important;
  border-radius: 58px !important;
  background:
    linear-gradient(180deg, rgba(255, 252, 225, 0.98), rgba(255, 237, 168, 0.98)) !important;
  box-shadow:
    0 18px 0 rgba(202, 116, 24, 0.13),
    0 24px 42px rgba(95, 64, 22, 0.16),
    inset 0 0 0 8px rgba(255, 255, 255, 0.45),
    inset 0 0 0 16px rgba(255, 215, 105, 0.20) !important;
  overflow: visible !important;
}

.Dcss-soft-panel::before,
.Dcss-intro-card::before,
.Dcss-rule-card::before,
.Dcss-switch-card::before,
.Dcss-test-shell-visual::before {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 42px;
  border: 2px dashed rgba(230, 170, 67, 0.42);
  pointer-events: none;
  z-index: 0;
}

.Dcss-start-panel {
  min-height: 560px;
  padding: 58px 70px 74px;
  gap: 34px;
}

.Dcss-game-title {
  position: relative;
  z-index: 2;
  min-width: min(100%, 460px);
  padding: 14px 42px 16px;
  border-radius: 20px;
  border: 4px solid #e9a33c;
  background: linear-gradient(180deg, rgba(255, 226, 129, 0.96), rgba(255, 244, 194, 0.98));
  color: #7a3f16;
  font-size: clamp(34px, 4vw, 52px);
  font-weight: 950;
  letter-spacing: 2px;
  text-shadow: 0 3px 0 rgba(255, 255, 255, 0.85);
  box-shadow:
    0 8px 0 rgba(210, 130, 37, 0.24),
    0 14px 24px rgba(91, 57, 18, 0.12),
    inset 0 0 0 5px rgba(255, 255, 255, 0.34);
}

.Dcss-game-title::before,
.Dcss-game-title::after {
  content: "🌿";
  position: absolute;
  top: 50%;
  font-size: 28px;
  transform: translateY(-50%);
}

.Dcss-game-title::before { left: 18px; }
.Dcss-game-title::after { right: 18px; transform: translateY(-50%) scaleX(-1); }

.Dcss-dialog-bubble {
  z-index: 2;
  min-height: 138px;
  border: 4px solid #f0c77b;
  border-radius: 28px;
  background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
  color: #6d3717;
  padding: 18px 30px;
  box-shadow: 0 8px 0 rgba(225, 169, 84, 0.12), inset 0 0 0 5px rgba(255, 235, 174, 0.35);
}

.Dcss-dialog-bubble::before {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: 20px;
  border: 2px dashed rgba(229, 189, 119, 0.55);
  pointer-events: none;
}

.Dcss-dialog-bubble::after {
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

.Dcss-round-icon {
  position: relative;
  z-index: 2;
  width: 158px;
  height: 158px;
  border-radius: 999px;
  background: linear-gradient(180deg, #82d9ff, #48aee8);
  border: 5px solid rgba(255,255,255,0.92);
  outline: 3px solid rgba(72, 157, 207, 0.65);
  padding: 14px;
  box-shadow: 0 10px 0 rgba(42, 112, 165, 0.20), 0 18px 24px rgba(53, 91, 123, 0.18);
}

.Dcss-round-icon::after {
  content: "★";
  position: absolute;
  right: 4px;
  bottom: 2px;
  color: #ffd948;
  font-size: 36px;
  -webkit-text-stroke: 2px #e29b21;
  text-shadow: 0 3px 0 rgba(139, 96, 20, 0.14);
}

.Dcss-forest-button,
.Dcss-main-btn {
  position: relative;
  z-index: 2;
  min-width: 220px;
  min-height: 76px;
  border-radius: 24px;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
}

.Dcss-forest-button:hover:not(:disabled),
.Dcss-main-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.05);
}

.Dcss-forest-button:active:not(:disabled),
.Dcss-main-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.Dcss-image-button {
  min-width: 0 !important;
  min-height: 0 !important;
  width: clamp(172px, 17vw, 238px);
  height: auto;
  padding: 0 !important;
  border: 0 !important;
  outline: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.Dcss-image-button::before,
.Dcss-image-button::after {
  display: none !important;
}

.Dcss-image-button img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
  filter: drop-shadow(0 9px 0 rgba(86, 73, 32, 0.13)) drop-shadow(0 16px 18px rgba(80, 55, 18, 0.18));
  pointer-events: none;
}

.Dcss-btn-skip { width: clamp(190px, 18vw, 260px); }
.Dcss-btn-home,
.Dcss-btn-replay,
.Dcss-btn-detail { width: clamp(160px, 15vw, 218px); }

.Dcss-guided-action {
  position: relative;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.Dcss-guided-rule { margin-top: 8px; }

.Dcss-mouse-guide {
  position: absolute;
  width: clamp(54px, 6vw, 86px);
  height: auto;
  pointer-events: none;
  z-index: 5;
  filter: drop-shadow(0 8px 8px rgba(69, 47, 19, 0.18));
  animation: DcssMouseTap 1.15s ease-in-out infinite;
}

.Dcss-mouse-on-button {
  right: -34px;
  bottom: -26px;
}

@keyframes DcssMouseTap {
  0%, 100% { transform: translate(0, 0) rotate(-8deg); }
  50% { transform: translate(7px, 8px) rotate(-8deg); }
}

.Dcss-video-shell {
  width: min(88vw, 1180px);
}

.Dcss-video-card {
  width: 100% !important;
  min-height: 620px;
  margin: 0 auto;
  padding: 42px 58px 34px !important;
  gap: 24px;
}

.Dcss-video-frame {
  position: relative;
  z-index: 2;
  width: min(100%, 1006px);
  border-radius: 34px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.52);
  box-shadow: inset 0 0 0 4px rgba(255, 236, 176, 0.48), 0 12px 24px rgba(91, 57, 18, 0.12);
}

.Dcss-guide-video {
  width: 100% !important;
  height: min(56vh, 466px) !important;
  border-radius: 24px;
  border: 0 !important;
  display: block;
}

.Dcss-intro-card,
.Dcss-rule-card,
.Dcss-switch-card {
  width: min(88vw, 1120px) !important;
  min-height: min(76vh, 660px);
  margin: 0 auto;
  padding: clamp(34px, 5vw, 58px) clamp(38px, 6vw, 76px) !important;
  display: grid !important;
  grid-template-columns: minmax(180px, 280px) minmax(0, 1fr);
  align-items: center;
  gap: clamp(28px, 5vw, 64px);
}

.Dcss-intro-left,
.Dcss-rule-content,
.Dcss-intro-content {
  position: relative;
  z-index: 2;
}

.Dcss-tag,
.Dcss-progress-pill {
  border-radius: 999px;
  border: 3px solid rgba(233, 163, 60, 0.72);
  background: linear-gradient(180deg, #fff8dc, #ffe697);
  color: #7a3f16;
  box-shadow: inset 0 0 0 4px rgba(255,255,255,0.28), 0 5px 0 rgba(210, 130, 37, 0.16);
}

.Dcss-test-shell-visual {
  width: min(94vw, 1360px) !important;
  min-height: min(88vh, 860px);
  margin: 24px auto;
  padding: clamp(24px, 3vw, 38px) clamp(24px, 3vw, 46px) !important;
}

.Dcss-top-bar,
.Dcss-top-bar-compact {
  position: relative;
  z-index: 2;
  width: min(100%, 1120px);
  margin: 0 auto 14px;
  padding: 0 8px;
}

.Dcss-top-bar h2 {
  color: #7a3f16;
  font-size: clamp(36px, 4.2vw, 56px);
  font-weight: 950;
  margin: 10px 0 0;
  text-shadow: 0 3px 0 rgba(255,255,255,0.78);
}

.Dcss-main-area-bottom-baskets {
  position: relative;
  z-index: 2;
}

.Dcss-helper-compact {
  border: 5px solid rgba(255, 255, 255, 0.86) !important;
  outline: 3px solid rgba(72, 157, 207, 0.45);
  border-radius: 34px !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 249, 226, 0.92)) !important;
  box-shadow: 0 10px 0 rgba(202, 116, 24, 0.10), 0 14px 22px rgba(91, 57, 18, 0.12) !important;
}

.Dcss-cloth-card {
  border: 7px solid #f6a51f !important;
  border-radius: 46px !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.90), rgba(255, 247, 216, 0.84)) !important;
  box-shadow:
    0 16px 0 rgba(202, 116, 24, 0.12),
    0 24px 34px rgba(95, 64, 22, 0.14),
    inset 0 0 0 8px rgba(255, 255, 255, 0.36) !important;
  backdrop-filter: blur(1px);
}

.Dcss-cloth-card::before {
  content: "";
  position: absolute;
  inset: 14px;
  border-radius: 32px;
  border: 2px dashed rgba(230, 170, 67, 0.34);
  pointer-events: none;
}

.Dcss-cloth-card.correct {
  box-shadow:
    0 16px 0 rgba(94, 164, 48, 0.14),
    0 0 0 8px rgba(142, 213, 75, 0.20),
    inset 0 0 0 8px rgba(255,255,255,0.38) !important;
}

.Dcss-cloth-card.wrong {
  animation: DcssSoftShake 0.32s ease-in-out;
}

@keyframes DcssSoftShake {
  0%, 100% { transform: translateX(0); }
  35% { transform: translateX(-8px); }
  70% { transform: translateX(8px); }
}

.Dcss-basket-btn,
.Dcss-visual-basket-btn {
  border: 5px solid rgba(255,255,255,0.88) !important;
  outline: 3px solid rgba(233, 163, 60, 0.62);
  border-radius: 34px !important;
  background: linear-gradient(180deg, rgba(255, 253, 235, 0.96), rgba(255, 235, 167, 0.92)) !important;
  box-shadow:
    0 10px 0 rgba(202, 116, 24, 0.12),
    0 16px 22px rgba(91, 57, 18, 0.12),
    inset 0 0 0 6px rgba(255,255,255,0.32) !important;
  cursor: pointer;
  transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease;
}

.Dcss-basket-btn:hover:not(:disabled) {
  transform: translateY(-2px) !important;
  filter: brightness(1.04);
}

.Dcss-basket-btn.selected {
  outline-color: #77c927;
  box-shadow:
    0 10px 0 rgba(78, 154, 35, 0.16),
    0 0 0 8px rgba(119, 201, 39, 0.18),
    inset 0 0 0 6px rgba(255,255,255,0.32) !important;
}

@media (max-width: 820px) {
  .Dcss-start-shell,
  .Dcss-result-shell {
    width: min(92vw, 720px) !important;
  }

  .Dcss-soft-panel,
  .Dcss-intro-card,
  .Dcss-rule-card,
  .Dcss-switch-card,
  .Dcss-test-shell-visual {
    border-radius: 44px !important;
  }

  .Dcss-start-panel {
    padding: 34px 24px;
  }

  .Dcss-intro-card,
  .Dcss-rule-card,
  .Dcss-switch-card {
    grid-template-columns: 1fr;
    min-height: auto;
    padding: 32px 22px !important;
  }

  .Dcss-dialog-bubble::after {
    display: none;
  }

  .Dcss-result-actions {
    width: min(100%, 360px);
    grid-template-columns: 1fr !important;
    justify-items: center;
    gap: 14px;
  }
}

/* 精確計時與行動裝置操作修正 */
.Dcss-page,
.Dcss-test-shell-visual,
.Dcss-main-area-bottom-baskets,
.Dcss-cloth-card,
.Dcss-basket-btn,
.Dcss-forest-button,
.Dcss-image-button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.Dcss-switch-title {
  margin: 12px 0 6px;
  color: #7a3f16;
  font-size: clamp(34px, 4vw, 52px);
  font-weight: 950;
  line-height: 1.15;
  text-shadow: 0 3px 0 rgba(255, 255, 255, 0.78);
}

.Dcss-switch-note {
  width: min(100%, 720px);
  margin: 0 auto 18px;
  padding: 12px 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: #7a3f16;
  font-size: clamp(18px, 2vw, 26px);
  font-weight: 850;
  line-height: 1.35;
}

/* DCCS requested cleanup: centered gameplay, no test feedback text, less transparent cards, no result outer frame */
.Dcss-top-bar-compact {
  display: flex !important;
  justify-content: flex-end !important;
  align-items: center !important;
}

.Dcss-top-spacer {
  flex: 1 1 auto;
}

.Dcss-main-area-bottom-baskets {
  grid-template-columns: minmax(520px, 700px) !important;
  justify-content: center !important;
}

.Dcss-main-area-bottom-baskets .Dcss-play-row {
  display: contents !important;
}

.Dcss-main-area-bottom-baskets .Dcss-card-stage {
  grid-column: 1 !important;
  grid-row: 1 !important;
  justify-self: center !important;
  align-self: end !important;
}

.Dcss-main-area-bottom-baskets .Dcss-baskets-bottom,
.Dcss-main-area-bottom-baskets .Dcss-visual-baskets-bottom {
  grid-column: 1 !important;
  grid-row: 2 !important;
  justify-self: center !important;
}

.Dcss-main-area-bottom-baskets .Dcss-feedback {
  display: none !important;
}

.Dcss-cloth-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.90), rgba(255, 247, 216, 0.84)) !important;
}

.Dcss-basket-btn,
.Dcss-visual-basket-btn {
  background: linear-gradient(180deg, rgba(255, 253, 235, 0.96), rgba(255, 235, 167, 0.92)) !important;
}

.Dcss-result-shell {
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
}

.Dcss-result-shell::before,
.Dcss-result-shell::after {
  display: none !important;
}

@media (max-width: 980px) {
  .Dcss-main-area-bottom-baskets {
    grid-template-columns: 1fr !important;
  }
}

`;
