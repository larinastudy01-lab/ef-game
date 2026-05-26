// src/pages/TestPage_SRT.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import bgImg from "../asset/SRT_testbackground.png";
import normalImg from "../asset/acorn.png";
import levelIcon from "../asset/SRT_icon.png";
import startAvatar from "../asset/avatar/bear.png";
import tutorialAvatar from "../asset/avatar/chicken.png";
import introVideo from "../asset/SRT_start.mp4";
import endingVideo from "../asset/SRT_start.mp4";
import homeStartBtn from "../asset/home/start.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";

import ResultPage_SRT from "./ResultPage_SRT";
import { calculateSrtScore } from "../utils/srtScoring";

import { createGameResult } from "../ai/gameResultTemplate";
import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";

const TOTAL_TRIALS = 60;
const ITEM_VISIBLE_TIME = 1000;
const MIN_NEXT_DELAY = 420;
const MAX_NEXT_DELAY = 850;
const ITEM_SIZE = 118;

const targetTypes = {
  normal: {
    key: "normal",
    label: "普通橡實",
    img: normalImg,
  },
};

const TestPage_SRT = () => {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("start");
  const [item, setItem] = useState(null);
  const [effect, setEffect] = useState(null);
  const [trialRecords, setTrialRecords] = useState([]);
  const [tutorialReady, setTutorialReady] = useState(false);
  const [showDetailedResult, setShowDetailedResult] = useState(false);

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

  const itemTimeoutRef = useRef(null);
  const nextTrialTimeoutRef = useRef(null);
  const effectTimeoutRef = useRef(null);
  const spawnAnimationFrameRef = useRef(null);
  const introVideoRef = useRef(null);
  const endingVideoRef = useRef(null);

  const pauseVideo = (videoRef) => {
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
  };

  const pauseAllVideos = () => {
    pauseVideo(introVideoRef);
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
    if (spawnAnimationFrameRef.current) cancelAnimationFrame(spawnAnimationFrameRef.current);

    itemTimeoutRef.current = null;
    nextTrialTimeoutRef.current = null;
    effectTimeoutRef.current = null;
    spawnAnimationFrameRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearAllTimers();
      pauseAllVideos();
    };
  }, []);

  const resetTest = () => {
    clearAllTimers();
    setItem(null);
    setEffect(null);
    setTrialRecords([]);
    setTutorialReady(false);

    trialRecordsRef.current = [];
    currentTrialRef.current = 0;
    spawnTimeRef.current = null;
    currentItemRef.current = null;
    trialLockedRef.current = false;
    falseClickInCurrentTrialRef.current = false;
    falseClickCountInCurrentTrialRef.current = 0;
    repeatedClickCountInCurrentTrialRef.current = 0;
    lastBlankClickTimeRef.current = null;

    localStorage.removeItem("srtTestResult");
  };

  const addTrialRecord = (record) => {
    const nextRecords = [...trialRecordsRef.current, record];
    trialRecordsRef.current = nextRecords;
    setTrialRecords(nextRecords);
  };

  const handleStart = () => {
    resetTest();
    setShowDetailedResult(false);
    setGamePhase("intro");
  };

  const handleIntroEnd = () => {
    setTutorialReady(false);
    setGamePhase("rule");
  };

  const handleTutorialClick = () => {
    setTutorialReady(true);
    setEffect({ x: 66, y: 50 });
    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    effectTimeoutRef.current = setTimeout(() => setEffect(null), 420);
  };

  const handleRuleConfirm = () => {
    if (!tutorialReady) return;
    startTest();
  };

  const getCurrentChildId = () => {
    try {
      const selectedChild = JSON.parse(localStorage.getItem("selectedChild") || "null");
      return selectedChild?.childId || selectedChild?.id || "unknown-child";
    } catch (error) {
      return "unknown-child";
    }
  };

  const buildSrtAiResult = (records, scoring) => {
    const totalTrials = records.length || TOTAL_TRIALS;
    const correctTrials = records.filter((record) => record.isCorrect === true).length;
    const reactionTimes = records
      .filter((record) => record.isCorrect === true && typeof record.reactionTime === "number")
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
      wrongTarget: 0,
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
      totalPlayTime: Math.round((TOTAL_TRIALS * ITEM_VISIBLE_TIME) / 1000),
      errorTypes,
      fatigueLevel,
      attemptCount: 1,
    });

    return {
      gameResult,
      performanceResult,
      errorResult,
      fatigueLevel,
      recommendedDifficulty,
      errorTypes,
      parentSummary: performanceResult.parentSummary,
    };
  };

  const finishTest = () => {
    if (phaseRef.current === "ending" || phaseRef.current === "result") return;

    clearAllTimers();
    setItem(null);
    setEffect(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;
    trialLockedRef.current = false;
    falseClickInCurrentTrialRef.current = false;

    const records = trialRecordsRef.current;
    const scoring = calculateSrtScore(records);
    const aiAnalysis = buildSrtAiResult(records, scoring);

    const resultPayload = {
      taskName: "Simple Reaction Time",
      taskCode: "SRT",
      mode: "test",
      totalTrials: TOTAL_TRIALS,
      records,
      scoring,
      aiAnalysis,
      generatedAt: new Date().toISOString(),
    };

    localStorage.setItem("srtTestResult", JSON.stringify(resultPayload));
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
    clearAllTimers();
    setTrialRecords([]);
    trialRecordsRef.current = [];
    setItem(null);
    setEffect(null);
    currentTrialRef.current = 0;
    spawnTimeRef.current = null;
    currentItemRef.current = null;
    trialLockedRef.current = false;
    falseClickInCurrentTrialRef.current = false;
    falseClickCountInCurrentTrialRef.current = 0;
    repeatedClickCountInCurrentTrialRef.current = 0;
    lastBlankClickTimeRef.current = null;
    setShowDetailedResult(false);

    setGamePhase("playing");

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

    if (currentTrialRef.current >= TOTAL_TRIALS) {
      finishTest();
      return;
    }

    const nextTrial = currentTrialRef.current + 1;
    currentTrialRef.current = nextTrial;

    const position = getRandomPosition();
    const targetType = "normal";

    const newItem = {
      id: `${Date.now()}-${nextTrial}`,
      trialIndex: nextTrial,
      x: position.x,
      y: position.y,
      targetType,
      img: targetTypes[targetType].img,
      label: targetTypes[targetType].label,
    };

    trialLockedRef.current = false;
    falseClickInCurrentTrialRef.current = false;
    falseClickCountInCurrentTrialRef.current = 0;
    repeatedClickCountInCurrentTrialRef.current = 0;
    lastBlankClickTimeRef.current = null;
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

    addTrialRecord({
      trialIndex: targetItem.trialIndex,
      isCorrect: false,
      reactionTime: null,
      timeout: true,
      missed: true,
      falseClick: falseClickInCurrentTrialRef.current,
      falseClickCount: falseClickCountInCurrentTrialRef.current,
      repeatedClickCount: repeatedClickCountInCurrentTrialRef.current,
      targetType: targetItem.targetType || "normal",
      positionX: targetItem.x,
      positionY: targetItem.y,
      timestamp: Date.now(),
    });

    setItem(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;
    falseClickInCurrentTrialRef.current = false;
    falseClickCountInCurrentTrialRef.current = 0;
    repeatedClickCountInCurrentTrialRef.current = 0;
    lastBlankClickTimeRef.current = null;

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

    addTrialRecord({
      trialIndex: targetItem.trialIndex,
      isCorrect: true,
      reactionTime,
      timeout: false,
      missed: false,
      falseClick: falseClickInCurrentTrialRef.current,
      falseClickCount: falseClickCountInCurrentTrialRef.current,
      repeatedClickCount: repeatedClickCountInCurrentTrialRef.current,
      targetType: targetItem.targetType || "normal",
      positionX: targetItem.x,
      positionY: targetItem.y,
      timestamp: Date.now(),
    });

    setEffect({ x: targetItem.x, y: targetItem.y });
    setItem(null);
    currentItemRef.current = null;
    spawnTimeRef.current = null;
    falseClickInCurrentTrialRef.current = false;
    falseClickCountInCurrentTrialRef.current = 0;
    repeatedClickCountInCurrentTrialRef.current = 0;
    lastBlankClickTimeRef.current = null;

    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    effectTimeoutRef.current = setTimeout(() => setEffect(null), 360);

    scheduleNextTrial();
  };

  const handleGameAreaClick = () => {
    if (phaseRef.current !== "playing") return;
    if (!currentItemRef.current) return;
    if (trialLockedRef.current) return;

    const now = performance.now();
    falseClickInCurrentTrialRef.current = true;
    falseClickCountInCurrentTrialRef.current += 1;

    if (lastBlankClickTimeRef.current && now - lastBlankClickTimeRef.current < 260) {
      repeatedClickCountInCurrentTrialRef.current += 1;
    }

    lastBlankClickTimeRef.current = now;
  };

  const score = useMemo(() => trialRecords.filter((record) => record.isCorrect === true).length, [trialRecords]);

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

  const resultStars = useMemo(() => {
    try {
      const scoring = JSON.parse(localStorage.getItem("srtTestResult") || "{}").scoring;
      return Math.max(1, Math.min(3, Number(scoring?.stars) || 1));
    } catch (error) {
      return 1;
    }
  }, [phase]);

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
          <section className="srt-soft-panel srt-start-panel" aria-label="開始畫面">
            <div className="srt-game-title">幫小松鼠撿橡實</div>
            <div className="srt-start-content">
              <div className="srt-dialog-bubble srt-opening-bubble">小松鼠想請你一起找橡實。</div>
              <div className="srt-round-icon srt-start-avatar">
                <img src={startAvatar} alt="小松鼠頭像" />
              </div>
            </div>
            <div className="srt-guided-action srt-guided-start">
              <button type="button" className="srt-forest-button srt-image-button srt-btn-start" onClick={handleStart} aria-label="進入遊戲">
                <img src={homeStartBtn} alt="進入遊戲" />
              </button>
              <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      )}

      {phase === "intro" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-video-panel" aria-label="前導動畫">
            <div className="srt-video-frame">
              <video
                ref={introVideoRef}
                src={introVideo}
                autoPlay
                playsInline
                controls={false}
                onEnded={handleIntroEnd}
                className="srt-video"
              />
            </div>
            <div className="srt-guided-action srt-guided-skip">
              <button type="button" className="srt-forest-button srt-image-button srt-btn-skip" onClick={handleIntroEnd} aria-label="跳過動畫">
                <img src={homeSkipBtn} alt="跳過動畫" />
              </button>
              <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      )}

      {phase === "rule" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-tutorial-panel" aria-label="互動前導教學">
            <div
              className="srt-tutorial-scene"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255, 255, 255, 0.24), rgba(255, 247, 216, 0.16)),
                  url(${bgImg})
                `,
              }}
            >
              <div className="srt-tutorial-grid">
                <div className="srt-avatar-guide">
                  <img src={tutorialAvatar} alt="小雞頭像" />
                </div>

                <div className="srt-rule-steps" aria-label="遊戲規則說明">
                  <div className="srt-guide-bubble srt-guide-main">看到橡實</div>
                  <div className="srt-guide-arrow" aria-hidden="true" />
                  <div className="srt-guide-bubble srt-guide-wait">沒有橡實就等一下</div>
                </div>

                <div className="srt-tutorial-practice">
                  <button
                    type="button"
                    className={`srt-practice-acorn ${tutorialReady ? "is-ready" : ""}`}
                    onClick={handleTutorialClick}
                    aria-label="點一下橡實練習"
                  >
                    <img src={normalImg} alt="橡實" />
                  </button>
                  {!tutorialReady && (
                    <img className="srt-mouse-guide srt-mouse-on-acorn" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
                  )}
                  <div className="srt-tap-hint">{tutorialReady ? "很好！可以開始囉" : "輕輕點一下"}</div>
                  {effect && <div className="srt-test-effect srt-demo-effect" />}
                </div>
              </div>
            </div>

            <div className={`srt-guided-action srt-guided-start ${tutorialReady ? "is-active" : "is-disabled"}`}>
              <button
                type="button"
                className="srt-forest-button srt-image-button srt-btn-start"
                onClick={handleRuleConfirm}
                disabled={!tutorialReady}
                aria-label="進入遊戲"
              >
                <img src={homeStartBtn} alt="進入遊戲" />
              </button>
              {tutorialReady && (
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
              )}
            </div>
          </section>
        </main>
      )}

      {phase === "playing" && (
        <main className="srt-play-page">
          <div className="srt-test-game-area" onClick={handleGameAreaClick}>
            {item && (
              <img
                src={item.img || normalImg}
                alt={item.label || "橡實"}
                draggable={false}
                className="srt-test-item"
                style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${ITEM_SIZE}px` }}
                onClick={(event) => handleItemClick(event, item)}
              />
            )}

            {effect && <div className="srt-test-effect" style={{ left: `${effect.x}%`, top: `${effect.y}%` }} />}
          </div>
        </main>
      )}

      {phase === "ending" && (
        <main className="srt-center-shell">
          <section className="srt-soft-panel srt-video-panel" aria-label="結束動畫">
            <div className="srt-video-frame">
              <video
                ref={endingVideoRef}
                src={endingVideo}
                autoPlay
                playsInline
                controls={false}
                onEnded={handleEndingVideoEnd}
                className="srt-video"
              />
            </div>
            <div className="srt-guided-action srt-guided-skip">
              <button type="button" className="srt-forest-button srt-image-button srt-btn-skip" onClick={handleEndingVideoEnd} aria-label="跳過動畫">
                <img src={homeSkipBtn} alt="跳過動畫" />
              </button>
              <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      )}

      {phase === "result" && !showDetailedResult && (
        <main className="srt-center-shell srt-result-shell">
          <section className="srt-soft-panel srt-result-panel" aria-label="測驗結果">
            <div className="srt-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span key={star} className={`srt-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>
              ))}
            </div>

            <div className="srt-start-content srt-result-content">
              <div className="srt-dialog-bubble">完成了！你有很認真看森林喔。</div>
              <div className="srt-round-icon srt-result-icon">
                <img src={levelIcon} alt="SRT 關卡圖示" />
              </div>
            </div>

            <div className="srt-result-actions">
              <div className="srt-guided-action srt-guided-result-main">
                <button type="button" className="srt-forest-button srt-image-button srt-btn-home" onClick={() => navigate("/test-map")} aria-label="回到森林">
                  <img src={homeBackBtn} alt="回到森林" />
                </button>
                <img className="srt-mouse-guide srt-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
              </div>
              <button type="button" className="srt-forest-button srt-image-button srt-btn-replay" onClick={handleStart} aria-label="再玩一次">
                <img src={homeAgainBtn} alt="再玩一次" />
              </button>
              <button type="button" className="srt-forest-button srt-image-button srt-btn-detail" onClick={() => setShowDetailedResult(true)} aria-label="詳細結果">
                <img src={homeResultBtn} alt="詳細結果" />
              </button>
            </div>
          </section>
        </main>
      )}

      {phase === "result" && showDetailedResult && (
        <ResultPage_SRT
          mode="test"
          score={score}
          avgRT={avgRT}
          rtRecords={rtRecords}
          trialRecords={trialRecords}
          totalSpawn={TOTAL_TRIALS}
          missCount={missCount}
          aiAnalysis={JSON.parse(localStorage.getItem("srtTestResult") || "{}").aiAnalysis}
          onRestart={handleStart}
          onBackToMenu={() => navigate("/test-map")}
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
.srt-btn-skip {
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
.srt-image-button.srt-btn-skip {
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

.srt-btn-skip.srt-image-button {
  width: clamp(198px, 19vw, 266px);
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
  height: 100%;
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

.srt-test-item {
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

  .srt-btn-skip.srt-image-button {
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
