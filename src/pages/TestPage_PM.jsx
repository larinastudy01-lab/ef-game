import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { createGameResult } from "../ai/gameResultTemplate";

// ===== 圖片 =====
import PM01 from "../asset/PM/PM_01.png";
import PM02 from "../asset/PM/PM_02.png";
import PM03 from "../asset/PM/PM_03.png";
import PM04 from "../asset/PM/PM_04.png";
import PM05 from "../asset/PM/PM_05.png";
import PM06 from "../asset/PM/PM_06.png";
import PM07 from "../asset/PM/PM_07.png";
import PM08 from "../asset/PM/PM_08.png";
import PM09 from "../asset/PM/PM_09.png";
import PM10 from "../asset/PM/PM_10.png";
import PM11 from "../asset/PM/PM_11.png";
import rabbitAvatar from "../asset/avatar/rabbit.png";

// ===== 背景 / 前導影片 / 結束影片 =====
import bgImage from "../asset/PM_testbackground.png";
import introVideo from "../asset/SRT_start.mp4";
import endingVideo from "../asset/SRT_start.mp4";
import homeStartBtn from "../asset/home/start.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";

const ALL_ITEMS = [
  { id: "PM01", image: PM01 },
  { id: "PM02", image: PM02 },
  { id: "PM03", image: PM03 },
  { id: "PM04", image: PM04 },
  { id: "PM05", image: PM05 },
  { id: "PM06", image: PM06 },
  { id: "PM07", image: PM07 },
  { id: "PM08", image: PM08 },
  { id: "PM09", image: PM09 },
  { id: "PM10", image: PM10 },
  { id: "PM11", image: PM11 },
];

// PM 需求：一個畫面最多放 8 張圖片，避免兒童需要滑動螢幕。
const LEVELS = [
  { level: 1, memoryCount: 2, showTime: 5, answerTime: 10, optionCount: 6 },
  { level: 2, memoryCount: 3, showTime: 4.5, answerTime: 10, optionCount: 6 },
  { level: 3, memoryCount: 4, showTime: 4, answerTime: 10, optionCount: 8 },
  { level: 4, memoryCount: 5, showTime: 3.5, answerTime: 10, optionCount: 8 },
  { level: 5, memoryCount: 6, showTime: 3.2, answerTime: 10, optionCount: 8 },
  { level: 6, memoryCount: 7, showTime: 3, answerTime: 10, optionCount: 8 },
  { level: 7, memoryCount: 8, showTime: 2.8, answerTime: 10, optionCount: 8 },
];

const DEFAULT_ERRORS = {
  miss: 0,
  randomClick: 0,
  wrongTarget: 0,
  repeatedClick: 0,
  timeout: 0,
  sequenceError: 0,
  ruleSwitchError: 0,
};

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function arraysEqualAsSet(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  const sorted1 = [...arr1].sort().join(",");
  const sorted2 = [...arr2].sort().join(",");
  return sorted1 === sorted2;
}

function safeNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function safeNonNegative(value, fallback = 0) {
  return Math.max(0, safeNumber(value, fallback));
}

function getSafeElapsedTime(startTime) {
  if (!Number.isFinite(startTime)) return 0;
  return Math.max(0, Math.round(performance.now() - startTime));
}

function safeRecommendedDifficulty(payload) {
  try {
    return getRecommendedDifficulty({
      ...payload,
      accuracy: safeNonNegative(payload.accuracy, 0),
      avgReactionTime: safeNonNegative(payload.avgReactionTime, 0),
      fatigueLevel: safeNumber(payload.fatigueLevel, 0),
    });
  } catch (error) {
    console.warn("[TestPage_PM] getRecommendedDifficulty failed:", error);
    return "normal";
  }
}

function safeAnalyzeErrors(errorTypes) {
  try {
    return analyzeErrors(errorTypes);
  } catch (error) {
    console.warn("[TestPage_PM] analyzeErrors failed:", error);
    const totalErrors = Object.values(errorTypes).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );
    return {
      totalErrors,
      warningLevel: totalErrors >= 10 ? "red" : totalErrors >= 5 ? "orange" : "green",
    };
  }
}

function safeCreateGameResult(payload) {
  try {
    return createGameResult(payload);
  } catch (error) {
    console.warn("[TestPage_PM] createGameResult failed:", error);
    return {
      ...payload,
      createdAt: new Date().toISOString(),
    };
  }
}

export default function TestPage_PM() {
  const navigate = useNavigate();

  const answerStartRef = useRef(null);
  const recordsRef = useRef([]);
  const tapLogsRef = useRef([]);
  const selectedIdsRef = useRef([]);
  const lastResultRef = useRef(null);
  const pendingResultRef = useRef(null);
  const hasSubmittedRef = useRef(false);
  const timeoutRef = useRef(null);
  const answerTimeoutRef = useRef(null);
  const answerStartFrameRef = useRef(null);
  const levelTransitionRef = useRef(null);

  const [phase, setPhase] = useState("rules");
  // rules -> tutorial -> introVideo -> memorize -> answer -> feedback -> endingVideo -> result

  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [currentMemorizeItems, setCurrentMemorizeItems] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");

  const currentLevel = LEVELS[currentLevelIndex];

  const selectedDifficulty = useMemo(() => {
    if (currentLevelIndex <= 1) return "easy";
    if (currentLevelIndex <= 4) return "normal";
    return "hard";
  }, [currentLevelIndex]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
      if (levelTransitionRef.current) clearTimeout(levelTransitionRef.current);
      if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
    };
  }, []);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
    if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);

    if (phase === "memorize" && currentLevel) {
      timeoutRef.current = setTimeout(() => {
        setPhase("answer");
      }, currentLevel.showTime * 1000);
    }

    if (phase === "answer" && currentLevel && !hasSubmittedRef.current) {
      answerStartRef.current = null;
      answerStartFrameRef.current = requestAnimationFrame(() => {
        answerStartRef.current = performance.now();
        answerTimeoutRef.current = setTimeout(() => {
          finalizeAnswer({
            isTimeout: true,
            forceSelectedIds: selectedIdsRef.current,
          });
        }, currentLevel.answerTime * 1000);
      });
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
      if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
    };
  }, [phase, currentLevel]);


  const resetRuntimeRefs = () => {
    if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
    if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);
    answerStartRef.current = null;
    tapLogsRef.current = [];
    selectedIdsRef.current = [];
    lastResultRef.current = null;
    hasSubmittedRef.current = false;
  };

  const pushRecord = (record) => {
    lastResultRef.current = record;
    recordsRef.current = [...recordsRef.current, record];
    console.log("[TestPage_PM] record saved:", record);
  };

  const setupLevel = (levelConfig) => {
    if (!levelConfig) return;

    const memorizeItems = shuffleArray(ALL_ITEMS).slice(0, levelConfig.memoryCount);
    const maxDistractors = Math.max(levelConfig.optionCount - memorizeItems.length, 0);
    const distractors = shuffleArray(
      ALL_ITEMS.filter(
        (item) => !memorizeItems.some((memoryItem) => memoryItem.id === item.id)
      )
    ).slice(0, maxDistractors);

    const options = shuffleArray([...memorizeItems, ...distractors]).slice(
      0,
      levelConfig.optionCount
    );

    resetRuntimeRefs();
    setCurrentMemorizeItems(memorizeItems);
    setCurrentOptions(options);
    setSelectedIds([]);
    setFeedbackText("");
    setFeedbackType("success");
    setPhase("memorize");
  };

  const handleStart = () => {
    if (levelTransitionRef.current) clearTimeout(levelTransitionRef.current);
    recordsRef.current = [];
    pendingResultRef.current = null;
    resetRuntimeRefs();
    setCurrentLevelIndex(0);
    setCurrentMemorizeItems([]);
    setCurrentOptions([]);
    setSelectedIds([]);
    setFeedbackText("");
    setFeedbackType("success");
    setPhase("tutorial");
  };

  const handleTutorialDone = () => {
    setPhase("introVideo");
  };

  const handleVideoEnd = () => {
    setupLevel(LEVELS[0]);
  };

  const trackRandomClick = () => {
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;

    const now = getSafeElapsedTime(answerStartRef.current);

    tapLogsRef.current = [
      ...tapLogsRef.current,
      {
        order: tapLogsRef.current.length + 1,
        itemId: "background",
        timestamp: now,
        action: "randomClick",
        isCorrectItem: false,
        selectedCountAfter: selectedIdsRef.current.length,
      },
    ];
  };

  const toggleSelect = (event, itemId) => {
    event.stopPropagation();
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;

    const correctIds = currentMemorizeItems.map((item) => item.id);
    const prevSelected = selectedIdsRef.current;
    const alreadySelected = prevSelected.includes(itemId);

    let nextSelected = prevSelected;
    if (alreadySelected) {
      nextSelected = prevSelected.filter((id) => id !== itemId);
    } else if (prevSelected.length < currentLevel.memoryCount) {
      nextSelected = [...prevSelected, itemId];
    }

    if (nextSelected === prevSelected) return;

    const now = getSafeElapsedTime(answerStartRef.current);

    const newLog = {
      order: tapLogsRef.current.length + 1,
      itemId,
      timestamp: now,
      action: alreadySelected ? "deselect" : "select",
      isCorrectItem: correctIds.includes(itemId),
      selectedCountAfter: nextSelected.length,
    };

    tapLogsRef.current = [...tapLogsRef.current, newLog];
    selectedIdsRef.current = nextSelected;
    setSelectedIds(nextSelected);
  };

  const finalizeAnswer = ({ isTimeout = false, forceSelectedIds = null }) => {
    if (hasSubmittedRef.current) return;
    if (!currentLevel) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
    if (answerStartFrameRef.current) cancelAnimationFrame(answerStartFrameRef.current);

    const finalSelectedIds = forceSelectedIds || selectedIdsRef.current;
    const correctIds = currentMemorizeItems.map((item) => item.id);

    const reactionTime = isTimeout
      ? safeNonNegative(currentLevel.answerTime * 1000, 0)
      : getSafeElapsedTime(answerStartRef.current);

    const isCorrect = !isTimeout && arraysEqualAsSet(finalSelectedIds, correctIds);

    const wrongTapCount = tapLogsRef.current.filter(
      (tap) => tap.action === "select" && !tap.isCorrectItem
    ).length;
    const randomClickCount = tapLogsRef.current.filter(
      (tap) => tap.action === "randomClick"
    ).length;
    const deselectCount = tapLogsRef.current.filter(
      (tap) => tap.action === "deselect"
    ).length;
    const missedTargetCount = correctIds.filter((id) => !finalSelectedIds.includes(id)).length;
    const firstTapTime = tapLogsRef.current.length > 0 ? tapLogsRef.current[0].timestamp : 0;

    const errorTypes = {
      ...DEFAULT_ERRORS,
      miss: isTimeout || finalSelectedIds.length < correctIds.length ? missedTargetCount : 0,
      randomClick: randomClickCount,
      wrongTarget: wrongTapCount,
      repeatedClick: deselectCount,
      timeout: isTimeout ? 1 : 0,
    };

    const record = {
      task: "PM",
      level: currentLevel.level,
      difficulty: selectedDifficulty,
      memoryCount: currentLevel.memoryCount,
      showTime: currentLevel.showTime,
      answerTimeLimit: currentLevel.answerTime,
      isCorrect,
      isTimeout,
      isFast: reactionTime > 0 && reactionTime <= 5000,
      reactionTime,
      firstTapTime,
      wrongTapCount,
      randomClickCount,
      deselectCount,
      missedTargetCount,
      errorTypes,
      selectedIds: finalSelectedIds,
      correctIds,
      tapLogs: tapLogsRef.current,
      createdAt: new Date().toISOString(),
    };

    hasSubmittedRef.current = true;
    pushRecord(record);

    if (isTimeout) {
      setFeedbackText("時間到了，皮皮會陪你一起看看這次結果。");
      setFeedbackType("error");
    } else if (isCorrect) {
      setFeedbackText("找到了！剛剛看到的小物品都放進籃子了。");
      setFeedbackType("success");
    } else {
      setFeedbackText("有幾個小物品好像拿錯了，我們一起看看結果。");
      setFeedbackType("error");
    }

    setPhase("feedback");
  };

  const handleSubmit = () => {
    if (phase !== "answer") return;
    if (hasSubmittedRef.current) return;
    if (selectedIdsRef.current.length !== currentLevel.memoryCount) return;

    finalizeAnswer({
      isTimeout: false,
      forceSelectedIds: selectedIdsRef.current,
    });
  };

  const buildFinalResult = () => {
    const records = recordsRef.current;
    const totalTrials = records.length;
    const correctTrials = records.filter((record) => record.isCorrect).length;
    const reactionTimes = records
      .map((record) => record.reactionTime)
      .filter((rt) => typeof rt === "number" && rt > 0);

    const errorTypes = records.reduce(
      (sum, record) => {
        Object.keys(DEFAULT_ERRORS).forEach((key) => {
          sum[key] += Number(record.errorTypes?.[key]) || 0;
        });
        return sum;
      },
      { ...DEFAULT_ERRORS }
    );

    const half = Math.max(1, Math.floor(reactionTimes.length / 2));
    const firstHalf = reactionTimes.slice(0, half);
    const secondHalf = reactionTimes.slice(half);
    const avg = (values) =>
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;

    const firstHalfRT = avg(firstHalf);
    const secondHalfRT = avg(secondHalf);
    const firstHalfMiss = records
      .slice(0, Math.max(1, Math.floor(records.length / 2)))
      .reduce((sum, record) => sum + (Number(record.errorTypes?.miss) || 0), 0);
    const secondHalfMiss = records
      .slice(Math.max(1, Math.floor(records.length / 2)))
      .reduce((sum, record) => sum + (Number(record.errorTypes?.miss) || 0), 0);

    const rawPerformanceResult = analyzePerformance({
      totalTrials,
      correctTrials,
      reactionTimes: reactionTimes.filter((rt) => Number.isFinite(rt) && rt > 0),
      errorTypes,
      difficulty: selectedDifficulty,
    });

    const performanceResult = {
      ...rawPerformanceResult,
      accuracy: safeNonNegative(rawPerformanceResult?.accuracy, 0),
      avgReactionTime: safeNonNegative(rawPerformanceResult?.avgReactionTime, 0),
      stars: Math.max(1, Math.min(3, safeNumber(rawPerformanceResult?.stars, 1))),
    };

    const errorResult = safeAnalyzeErrors(errorTypes);
    const rawFatigueLevel = analyzeFatigue({
      firstHalfRT: safeNonNegative(firstHalfRT, 0),
      secondHalfRT: safeNonNegative(secondHalfRT, 0),
      missIncrease: Math.max(0, secondHalfMiss - firstHalfMiss),
    });
    const fatigueLevel = safeNumber(rawFatigueLevel, 0);

    const recommendedDifficulty = safeRecommendedDifficulty({
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      errorTypes,
      fatigueLevel,
    });

    const gameResult = safeCreateGameResult({
      childId: "guest-child",
      gameId: "PM",
      abilityType: "memory",
      mode: "test",
      difficulty: selectedDifficulty,
      score: performanceResult.accuracy,
      stars: performanceResult.stars,
      accuracy: performanceResult.accuracy,
      avgReactionTime: performanceResult.avgReactionTime,
      totalPlayTime: records.reduce((sum, record) => sum + safeNonNegative(record.reactionTime, 0), 0),
      errorTypes,
      fatigueLevel,
      attemptCount: totalTrials,
    });

    return {
      ...gameResult,
      ...performanceResult,
      ...errorResult,
      fatigueLevel,
      recommendedDifficulty,
      records,
      visibleRoles: ["child", "parent"],
      aiSummary: {
        recommendedDifficulty,
        reason:
          errorTypes.miss > 0
            ? "本次有漏選情形，建議下次可放大圖片或延長觀看時間。"
            : errorTypes.randomClick > 0 || errorTypes.wrongTarget > 0
            ? "本次有亂點或點錯目標，建議先降低干擾物數量。"
            : "本次表現穩定，可以維持目前難度或嘗試更高挑戰。",
      },
    };
  };

  const goResult = () => {
    const finalResult = buildFinalResult();
    pendingResultRef.current = finalResult;
    localStorage.setItem("pmTestResult", JSON.stringify(finalResult));
    setPhase("endingVideo");
  };

  const navigateToResult = () => {
    const finalResult = pendingResultRef.current || buildFinalResult();
    localStorage.setItem("pmTestResult", JSON.stringify(finalResult));
    navigate("/result-picture-memory", {
      state: {
        ...finalResult,
        mode: "test",
        visibleRoles: ["child", "parent"],
      },
    });
  };

  const handleNext = () => {
    const lastRecord = lastResultRef.current;
    if (!lastRecord) return;
    if (levelTransitionRef.current) return;

    const nextIndex = currentLevelIndex + 1;

    levelTransitionRef.current = setTimeout(() => {
      levelTransitionRef.current = null;

      if (lastRecord.isCorrect && nextIndex < LEVELS.length) {
        setCurrentLevelIndex(nextIndex);
        setupLevel(LEVELS[nextIndex]);
        return;
      }

      goResult();
    }, 200);
  };

  const resultStars = Math.max(1, Math.min(3, Number(pendingResultRef.current?.stars) || 1));

  return (
    <div style={styles.page(bgImage)}>
      <style>{`
        @keyframes pmMouseTap {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.92; }
          45% { transform: translate(-10px, -9px) scale(1.08); opacity: 1; }
          62% { transform: translate(-4px, -4px) scale(0.96); opacity: 1; }
        }
        button[aria-label="進入遊戲"]:hover:not(:disabled),
        button[aria-label="跳過動畫"]:hover:not(:disabled),
        button[aria-label="下一步"]:hover:not(:disabled),
        button[aria-label="回到森林"]:hover:not(:disabled),
        button[aria-label="再玩一次"]:hover:not(:disabled),
        button[aria-label="詳細結果"]:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.03);
          filter: brightness(1.04);
        }
        button[aria-label="進入遊戲"]:active:not(:disabled),
        button[aria-label="跳過動畫"]:active:not(:disabled),
        button[aria-label="下一步"]:active:not(:disabled),
        button[aria-label="回到森林"]:active:not(:disabled),
        button[aria-label="再玩一次"]:active:not(:disabled),
        button[aria-label="詳細結果"]:active:not(:disabled) {
          transform: translateY(1px) scale(0.98);
        }
        @media (max-width: 720px) {
          button[aria-label="進入遊戲"],
          button[aria-label="下一步"],
          button[aria-label="回到森林"],
          button[aria-label="再玩一次"],
          button[aria-label="詳細結果"] {
            width: min(72vw, 206px) !important;
          }
          button[aria-label="跳過動畫"] {
            width: min(74vw, 214px) !important;
          }
        }
      `}</style>
      <div style={styles.overlay}>
        <div style={styles.container}>
          {phase === "rules" && (
            <div style={styles.startPanel}>
              <div style={styles.gameTitle}>圖片記憶任務</div>

              <div style={styles.startContent}>
                <div style={styles.dialogBubble}>
                  幫兔子妹妹記住湖邊的小物品。
                </div>
                <div style={styles.roundIcon}>
                  <img src={rabbitAvatar} alt="兔子妹妹" style={styles.roundIconImage} />
                </div>
              </div>

              <div style={styles.guidedAction}>
                <button type="button" style={styles.imageButton} onClick={handleStart} aria-label="進入遊戲">
                  <img src={homeStartBtn} alt="進入遊戲" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
            </div>
          )}

          {phase === "tutorial" && (
            <div style={styles.card}>
              <p style={styles.kicker}>前導教學</p>
              <h1 style={styles.title}>先記住，再點回來</h1>

              <div style={styles.tutorialRow}>
                <div style={styles.tutorialPanel}>
                  <p style={styles.tutorialLabel}>第一步：先看圖片</p>
                  <div style={styles.demoGrid}>
                    {[PM01, PM02, PM03].map((image, index) => (
                      <div key={index} style={styles.demoCard}>
                        <img src={image} alt="教學記憶圖片" style={styles.demoImage} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.tutorialArrow}>→</div>

                <div style={styles.tutorialPanel}>
                  <p style={styles.tutorialLabel}>第二步：從選項點出來</p>
                  <div style={styles.demoGrid}>
                    {[PM01, PM05, PM02].map((image, index) => (
                      <div
                        key={index}
                        style={{
                          ...styles.demoCard,
                          ...(index === 0 || index === 2 ? styles.demoCardSelected : {}),
                        }}
                      >
                        <img src={image} alt="教學作答圖片" style={styles.demoImage} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p style={styles.textCompact}>點滿指定數量後，再按「放進小籃子」。</p>
              <div style={styles.guidedAction}>
                <button type="button" style={styles.imageButton} onClick={handleTutorialDone} aria-label="進入遊戲">
                  <img src={homeStartBtn} alt="進入遊戲" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
            </div>
          )}

          {phase === "introVideo" && (
            <div style={styles.videoPanel}>
              <div style={styles.videoFrame}>
                <video
                  src={introVideo}
                  style={styles.video}
                  autoPlay
                  playsInline
                  controls={false}
                  onEnded={handleVideoEnd}
                />
              </div>

              <div style={styles.guidedAction}>
                <button type="button" style={{ ...styles.imageButton, ...styles.skipImageButton }} onClick={handleVideoEnd} aria-label="跳過動畫">
                  <img src={homeSkipBtn} alt="跳過動畫" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
            </div>
          )}

          {phase === "memorize" && currentLevel && (
            <div style={styles.card}>
              <p style={styles.kicker}>第 {currentLevel.level} 關</p>
              <h1 style={styles.title}>看清楚湖裡的小物品</h1>

              <div style={styles.iconHint}>
                <span>請記住這些圖片</span>
              </div>

              <div style={styles.memoryGrid}>
                {currentMemorizeItems.map((item) => (
                  <div key={item.id} style={styles.memoryCard}>
                    <img src={item.image} alt={item.id} style={styles.memoryImage} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "answer" && currentLevel && (
            <div style={styles.card} onClick={trackRandomClick}>
              <p style={styles.kicker}>第 {currentLevel.level} 關</p>
              <h1 style={styles.title}>找回剛剛看過的物品</h1>

              <div style={styles.iconHint}>
                <span>🧺</span>
                <span>
                  已找到 {selectedIds.length} / {currentLevel.memoryCount}
                </span>
              </div>

              <div style={styles.optionGrid}>
                {currentOptions.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(event) => toggleSelect(event, item.id)}
                      style={{
                        ...styles.optionCard,
                        ...(isSelected ? styles.optionCardSelected : {}),
                      }}
                    >
                      <img src={item.image} alt={item.id} style={styles.optionImage} />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                style={{
                  ...styles.mainButton,
                  opacity: selectedIds.length === currentLevel.memoryCount ? 1 : 0.5,
                  cursor:
                    selectedIds.length === currentLevel.memoryCount ? "pointer" : "not-allowed",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSubmit();
                }}
                disabled={selectedIds.length !== currentLevel.memoryCount}
              >
                放進小籃子
              </button>
            </div>
          )}

          {phase === "feedback" && (
            <div style={styles.smallCard}>
              <p style={styles.kicker}>{feedbackType === "success" ? "任務成功" : "任務完成"}</p>
              <h1
                style={{
                  ...styles.title,
                  color: feedbackType === "success" ? "#4f7d3a" : "#b65f2a",
                }}
              >
                {feedbackText}
              </h1>

              <p style={styles.textCompact}>
                {feedbackType === "success"
                  ? "做得很好，我們繼續下一關。"
                  : "這次先到這裡，接著看看完成結果。"}
              </p>

              <div style={styles.guidedAction}>
                <button type="button" style={styles.imageButton} onClick={handleNext} aria-label="下一步">
                  <img src={homeStartBtn} alt="下一步" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
            </div>
          )}

          {phase === "endingVideo" && (
            <div style={styles.videoPanel}>
              <div style={styles.videoFrame}>
                <video
                  src={endingVideo}
                  style={styles.video}
                  autoPlay
                  playsInline
                  controls={false}
                  onEnded={() => setPhase("result")}
                />
              </div>

              <div style={styles.guidedAction}>
                <button type="button" style={{ ...styles.imageButton, ...styles.skipImageButton }} onClick={() => setPhase("result")} aria-label="跳過動畫">
                  <img src={homeSkipBtn} alt="跳過動畫" style={styles.imageButtonImg} />
                </button>
                <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
              </div>
            </div>
          )}

          {phase === "result" && (
            <div style={styles.resultPanel}>
              <div style={styles.starRow} aria-label={`${resultStars} 顆星`}>
                {[1, 2, 3].map((star, index) => {
                  const curveStyles = [styles.starLeft, styles.starCenter, styles.starRight];
                  return (
                    <span key={star} style={{ ...styles.starShell, ...curveStyles[index] }}>
                      <svg viewBox="0 0 100 95" style={styles.starSvg} aria-hidden="true">
                        <path
                          d="M50 3 L61.8 34.2 L95 36.1 L69 56.8 L77.6 89 L50 71.2 L22.4 89 L31 56.8 L5 36.1 L38.2 34.2 Z"
                          style={star <= resultStars ? styles.starPathOn : styles.starPathOff}
                        />
                        {star <= resultStars && (
                          <>
                            <path d="M48 14 C53 14 55 26 53 34 C51 42 46 43 43 38 C40 32 42 15 48 14 Z" style={styles.starHighlight} />
                            <path d="M72 43 C80 43 84 47 82 53 C80 60 70 61 66 56 C62 51 65 44 72 43 Z" style={styles.starShadow} />
                          </>
                        )}
                      </svg>
                    </span>
                  );
                })}
              </div>

              <div style={styles.startContent}>
                <div style={styles.dialogBubble}>
                  關卡完成！你很認真記住圖片喔。
                </div>
                <div style={styles.roundIcon}>
                  <img src={rabbitAvatar} alt="兔子妹妹" style={styles.roundIconImage} />
                </div>
              </div>

              <div style={styles.resultActions}>
                <div style={styles.guidedAction}>
                  <button type="button" style={styles.resultImageButton} onClick={() => navigate("/test-map")} aria-label="回到森林">
                    <img src={homeBackBtn} alt="回到森林" style={styles.imageButtonImg} />
                  </button>
                  <img src={mouseGuideImg} alt="提示點擊" aria-hidden="true" style={{ ...styles.mouseGuide, ...styles.mouseOnButton }} />
                </div>
                <button type="button" style={styles.resultImageButton} onClick={handleStart} aria-label="再玩一次">
                  <img src={homeAgainBtn} alt="再玩一次" style={styles.imageButtonImg} />
                </button>
                <button type="button" style={styles.resultImageButton} onClick={navigateToResult} aria-label="詳細結果">
                  <img src={homeResultBtn} alt="詳細結果" style={styles.imageButtonImg} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const forestFont = "'jf-openhuninn', 'Fredoka', 'Nunito', 'Microsoft JhengHei', sans-serif";

const glossyGreen = "linear-gradient(180deg, #b7f05d 0%, #7fca36 46%, #4f9827 100%)";
const softCream = "linear-gradient(180deg, rgba(255, 252, 225, 0.98) 0%, rgba(255, 242, 185, 0.98) 52%, rgba(255, 229, 145, 0.98) 100%)";
const leafShadow = "0 18px 0 rgba(194, 125, 33, 0.14), 0 22px 36px rgba(86, 61, 27, 0.18)";

const styles = {
  page: (bgImage) => ({
    height: "100dvh",
    minHeight: "100dvh",
    width: "100%",
    overflow: "hidden",
    backgroundImage: `url(${bgImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    fontFamily: forestFont,
    touchAction: "manipulation",
  }),

  overlay: {
    height: "100dvh",
    width: "100%",
    overflow: "hidden",
    background:
      "radial-gradient(circle at 50% 24%, rgba(255,255,220,0.24) 0%, rgba(255,255,255,0.08) 42%, rgba(69,118,38,0.08) 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "clamp(10px, 1.5vw, 20px)",
    boxSizing: "border-box",
  },

  container: {
    width: "100%",
    maxWidth: "1180px",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  startPanel: {
    width: "min(78vw, 820px)",
    minHeight: "min(68vh, 610px)",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.92)",
    outlineOffset: "-12px",
    borderRadius: "58px",
    boxSizing: "border-box",
    boxShadow: leafShadow,
    padding: "clamp(30px, 4.6vw, 54px) clamp(34px, 5vw, 62px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(24px, 3.8vw, 42px)",
  },

  resultPanel: {
    width: "min(82vw, 920px)",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.92)",
    outlineOffset: "-12px",
    borderRadius: "58px",
    boxSizing: "border-box",
    boxShadow: leafShadow,
    padding: "clamp(34px, 4vw, 58px) clamp(30px, 5vw, 64px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(22px, 3vw, 34px)",
    position: "relative",
  },

  gameTitle: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "min(82%, 560px)",
    padding: "14px 44px 18px",
    borderRadius: "24px",
    border: "4px solid #f2ad35",
    outline: "2px solid rgba(255, 235, 160, 0.9)",
    outlineOffset: "-10px",
    background: "linear-gradient(180deg, #fff2ab 0%, #ffd764 100%)",
    color: "#744018",
    fontSize: "clamp(42px, 4.6vw, 62px)",
    fontWeight: 900,
    lineHeight: 1.08,
    letterSpacing: "0.04em",
    textShadow: "0 3px 0 rgba(255,255,255,0.78)",
    boxShadow: "0 8px 0 rgba(178, 103, 21, 0.18), inset 0 -4px 0 rgba(177, 116, 20, 0.12)",
  },

  startContent: {
    width: "min(100%, 760px)",
    display: "grid",
    gridTemplateColumns: "minmax(300px, 1fr) 172px",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(28px, 4vw, 54px)",
  },

  dialogBubble: {
    minHeight: "132px",
    border: "4px solid #ffb545",
    outline: "3px dashed rgba(238, 178, 76, 0.38)",
    outlineOffset: "-15px",
    borderRadius: "34px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,252,238,0.96))",
    color: "#744018",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "22px 34px",
    fontSize: "clamp(28px, 3vw, 40px)",
    lineHeight: 1.28,
    fontWeight: 900,
    textAlign: "center",
    boxSizing: "border-box",
    boxShadow: "0 8px 0 rgba(234, 171, 77, 0.16), inset 0 0 0 6px rgba(255, 239, 190, 0.3)",
  },

  roundIcon: {
    width: "172px",
    height: "172px",
    borderRadius: "999px",
    background: "linear-gradient(180deg, #7fdcff 0%, #43aee5 100%)",
    border: "4px solid #f7d35a",
    outline: "3px dashed rgba(255,255,255,0.72)",
    outlineOffset: "-12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxSizing: "border-box",
    padding: "14px",
    boxShadow: "0 12px 0 rgba(50, 114, 169, 0.16), 0 16px 22px rgba(44, 83, 139, 0.18)",
  },

  roundIconImage: {
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    borderRadius: "999px",
    display: "block",
    pointerEvents: "none",
  },

  card: {
    width: "min(92vw, 1080px)",
    maxHeight: "calc(100dvh - 26px)",
    overflow: "hidden",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.86)",
    outlineOffset: "-12px",
    borderRadius: "54px",
    padding: "clamp(16px, 2.1vw, 28px) clamp(18px, 2.4vw, 34px)",
    boxShadow: leafShadow,
    textAlign: "center",
    boxSizing: "border-box",
  },

  smallCard: {
    width: "min(88vw, 760px)",
    maxHeight: "calc(100dvh - 28px)",
    overflow: "hidden",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.86)",
    outlineOffset: "-12px",
    borderRadius: "54px",
    padding: "clamp(28px, 4vw, 44px)",
    boxShadow: leafShadow,
    textAlign: "center",
    boxSizing: "border-box",
  },

  mediumCard: {
    width: "min(92vw, 900px)",
    maxHeight: "calc(100dvh - 28px)",
    overflow: "hidden",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.86)",
    outlineOffset: "-12px",
    borderRadius: "54px",
    padding: "clamp(16px, 2vw, 28px)",
    boxShadow: leafShadow,
    textAlign: "center",
    boxSizing: "border-box",
  },

  kicker: {
    display: "inline-block",
    background: "linear-gradient(180deg, #fff5c9, #ffe28c)",
    color: "#8a531d",
    border: "2px solid rgba(243, 181, 75, 0.55)",
    borderRadius: "999px",
    padding: "7px 18px",
    margin: "0 0 10px",
    fontSize: "clamp(16px, 1.8vw, 20px)",
    fontWeight: 900,
    boxShadow: "inset 0 -3px 0 rgba(140, 92, 35, 0.12)",
  },

  title: {
    fontSize: "clamp(28px, 3.7vw, 46px)",
    fontWeight: 900,
    color: "#744018",
    textShadow: "0 3px 0 rgba(255,255,255,0.78)",
    margin: "0 0 12px",
    lineHeight: 1.15,
    letterSpacing: "0.02em",
  },

  textCompact: {
    fontSize: "clamp(18px, 2.1vw, 23px)",
    lineHeight: 1.45,
    color: "#5d3f22",
    margin: "0 0 16px",
    fontWeight: 800,
  },

  storyText: {
    fontSize: "clamp(19px, 2.3vw, 24px)",
    lineHeight: 1.65,
    color: "#5d3f22",
    margin: 0,
    fontWeight: 800,
    textAlign: "left",
  },

  pipiBox: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    backgroundColor: "rgba(255,255,255,0.62)",
    borderRadius: "26px",
    padding: "18px 20px",
    marginBottom: "20px",
  },

  pipiIcon: {
    fontSize: "clamp(42px, 5vw, 54px)",
    flex: "0 0 auto",
  },

  iconHint: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    background: "rgba(255,255,255,0.74)",
    color: "#79512f",
    border: "2px solid rgba(243, 181, 75, 0.46)",
    borderRadius: "999px",
    padding: "9px 20px",
    fontSize: "clamp(18px, 2vw, 23px)",
    fontWeight: 900,
    marginBottom: "14px",
    boxShadow: "0 5px 0 rgba(176, 119, 38, 0.09)",
  },

  videoPanel: {
    width: "min(92vw, 1120px)",
    minHeight: "min(86vh, 790px)",
    background: softCream,
    border: "5px solid #ffb21e",
    outline: "3px solid rgba(255, 132, 38, 0.86)",
    outlineOffset: "-12px",
    borderRadius: "58px",
    boxSizing: "border-box",
    boxShadow: leafShadow,
    padding: "clamp(22px, 3vw, 34px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(16px, 2vw, 22px)",
  },

  videoFrame: {
    width: "100%",
    height: "min(69vh, 635px)",
    minHeight: "430px",
    borderRadius: "34px",
    background: "linear-gradient(180deg, #36b3ff, #2f82df)",
    border: "4px solid rgba(255,255,255,0.85)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    boxShadow: "inset 0 0 0 4px rgba(41, 113, 206, 0.18), 0 14px 28px rgba(77, 53, 30, 0.16)",
  },

  videoWrapper: {
    width: "100%",
    maxWidth: "720px",
    margin: "0 auto 18px",
    borderRadius: "26px",
    overflow: "hidden",
    boxShadow: "0 12px 26px rgba(77, 53, 30, 0.2)",
    backgroundColor: "#000",
  },

  video: {
    width: "100%",
    height: "100%",
    display: "block",
    aspectRatio: "16 / 9",
    objectFit: "cover",
  },

  tutorialRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: "16px",
    alignItems: "center",
    margin: "10px 0 16px",
  },

  tutorialPanel: {
    background: "rgba(255,255,255,0.66)",
    border: "2px solid rgba(243, 181, 75, 0.36)",
    borderRadius: "26px",
    padding: "16px",
  },

  tutorialLabel: {
    margin: "0 0 12px",
    fontSize: "clamp(18px, 2vw, 22px)",
    fontWeight: 900,
    color: "#744018",
  },

  tutorialArrow: {
    fontSize: "clamp(28px, 4vw, 44px)",
    fontWeight: 900,
    color: "#8a5a28",
  },

  demoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(70px, 1fr))",
    gap: "10px",
    justifyItems: "center",
  },

  demoCard: {
    width: "clamp(82px, 9vw, 120px)",
    height: "clamp(82px, 9vw, 120px)",
    backgroundColor: "#fffdf4",
    border: "4px solid rgba(151, 105, 58, 0.15)",
    borderRadius: "999px",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxSizing: "border-box",
  },

  demoCardSelected: {
    border: "4px solid #79a85b",
    backgroundColor: "#f0ffe5",
    boxShadow: "0 10px 18px rgba(80, 112, 58, 0.16)",
  },

  demoImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "999px",
    display: "block",
    pointerEvents: "none",
  },

  memoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(128px, 1fr))",
    gap: "clamp(10px, 1.5vw, 16px)",
    marginTop: "4px",
    justifyItems: "center",
    alignItems: "center",
  },

  memoryCard: {
    background: "linear-gradient(180deg, #fffdf4, #fff3cf)",
    border: "4px solid rgba(255, 177, 57, 0.45)",
    borderRadius: "999px",
    padding: "10px",
    boxShadow: "0 10px 20px rgba(77, 53, 30, 0.12), inset 0 -4px 0 rgba(233, 179, 91, 0.14)",
    width: "clamp(120px, 15.2vw, 162px)",
    height: "clamp(120px, 15.2vw, 162px)",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  memoryImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "999px",
    display: "block",
    pointerEvents: "none",
  },

  optionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(128px, 1fr))",
    gap: "clamp(10px, 1.4vw, 15px)",
    marginTop: "2px",
    marginBottom: "14px",
    justifyItems: "center",
    alignItems: "center",
  },

  optionCard: {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    border: "4px solid rgba(255, 177, 57, 0.42)",
    borderRadius: "999px",
    padding: "10px",
    background: "linear-gradient(180deg, #fffdf4, #fff3cf)",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(77, 53, 30, 0.12), inset 0 -4px 0 rgba(233, 179, 91, 0.14)",
    transition: "transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease",
    width: "clamp(120px, 15.2vw, 162px)",
    height: "clamp(120px, 15.2vw, 162px)",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  optionCardSelected: {
    border: "4px solid #79c843",
    background: "linear-gradient(180deg, #f4ffe7, #dfffc4)",
    transform: "translateY(-3px) scale(1.02)",
    boxShadow: "0 14px 24px rgba(80, 112, 58, 0.18), 0 0 0 7px rgba(139, 216, 86, 0.18)",
  },

  optionImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "999px",
    display: "block",
    pointerEvents: "none",
  },

  starRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: "clamp(20px, 2.4vw, 32px)",
    height: "clamp(120px, 10vw, 152px)",
    marginTop: "calc(clamp(78px, 8vw, 112px) * -1)",
    marginBottom: "-10px",
    filter: "drop-shadow(0 8px 0 rgba(63, 76, 111, 0.14))",
    pointerEvents: "none",
  },

  starShell: {
    width: "clamp(92px, 8.6vw, 126px)",
    height: "clamp(88px, 8.1vw, 118px)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transformOrigin: "50% 80%",
  },

  starLeft: {
    transform: "translateY(12px) rotate(-14deg)",
  },

  starCenter: {
    transform: "translateY(-22px) scale(1.06)",
  },

  starRight: {
    transform: "translateY(12px) rotate(14deg)",
  },

  starSvg: {
    width: "100%",
    height: "100%",
    overflow: "visible",
  },

  starPathOn: {
    fill: "#ffd735",
    stroke: "#fff9d6",
    strokeWidth: 6,
    filter: "drop-shadow(0 4px 0 rgba(230, 160, 0, 0.34))",
  },

  starPathOff: {
    fill: "rgba(255, 251, 208, 0.68)",
    stroke: "#ffffff",
    strokeWidth: 5,
  },

  starHighlight: {
    fill: "rgba(255, 255, 153, 0.72)",
  },

  starShadow: {
    fill: "rgba(236, 155, 0, 0.52)",
  },

  resultActions: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "clamp(14px, 2vw, 22px)",
    flexWrap: "wrap",
  },

  guidedAction: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    isolation: "isolate",
  },

  imageButton: {
    position: "relative",
    zIndex: 2,
    width: "clamp(188px, 18vw, 254px)",
    minWidth: 0,
    minHeight: 0,
    padding: 0,
    border: "none",
    outline: "none",
    borderRadius: "18px",
    background: "transparent",
    boxShadow: "none",
    lineHeight: 0,
    cursor: "pointer",
    overflow: "visible",
    transition: "transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease",
    touchAction: "manipulation",
  },

  skipImageButton: {
    width: "clamp(198px, 19vw, 266px)",
  },

  resultImageButton: {
    position: "relative",
    zIndex: 2,
    width: "clamp(168px, 16vw, 232px)",
    minWidth: 0,
    minHeight: 0,
    padding: 0,
    border: "none",
    outline: "none",
    borderRadius: "18px",
    background: "transparent",
    boxShadow: "none",
    lineHeight: 0,
    cursor: "pointer",
    overflow: "visible",
    transition: "transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease",
    touchAction: "manipulation",
  },

  imageButtonImg: {
    width: "100%",
    height: "auto",
    display: "block",
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserDrag: "none",
    filter: "drop-shadow(0 8px 8px rgba(74, 48, 16, 0.22))",
  },

  mouseGuide: {
    position: "absolute",
    width: "clamp(48px, 5.2vw, 78px)",
    height: "auto",
    zIndex: 8,
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserDrag: "none",
    filter: "drop-shadow(0 8px 8px rgba(58, 38, 14, 0.24))",
    animation: "pmMouseTap 1.15s ease-in-out infinite",
  },

  mouseOnButton: {
    right: "-18px",
    bottom: "-18px",
    transformOrigin: "18% 18%",
  },

  mainButton: {
    minWidth: "220px",
    minHeight: "74px",
    padding: "12px 40px",
    borderRadius: "22px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(25px, 2.6vw, 38px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #347d23",
    background: glossyGreen,
    textShadow: "0 3px 0 rgba(33, 93, 24, 0.38)",
    boxShadow: "0 7px 0 rgba(43, 104, 28, 0.62), 0 12px 22px rgba(67, 93, 38, 0.18), inset 0 3px 0 rgba(255,255,255,0.35)",
    marginTop: "6px",
    touchAction: "manipulation",
  },

  secondaryButton: {
    minWidth: "220px",
    minHeight: "74px",
    padding: "12px 40px",
    borderRadius: "22px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(25px, 2.6vw, 38px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #347d23",
    background: glossyGreen,
    textShadow: "0 3px 0 rgba(33, 93, 24, 0.38)",
    boxShadow: "0 7px 0 rgba(43, 104, 28, 0.62), 0 12px 22px rgba(67, 93, 38, 0.18), inset 0 3px 0 rgba(255,255,255,0.35)",
    marginTop: "6px",
    touchAction: "manipulation",
  },

  greenButton: {
    minWidth: "184px",
    minHeight: "72px",
    padding: "12px 34px",
    borderRadius: "22px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(24px, 2.5vw, 34px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #347d23",
    background: glossyGreen,
    textShadow: "0 3px 0 rgba(33, 93, 24, 0.38)",
    boxShadow: "0 7px 0 rgba(43, 104, 28, 0.62), 0 12px 22px rgba(67, 93, 38, 0.18), inset 0 3px 0 rgba(255,255,255,0.35)",
    touchAction: "manipulation",
  },

  orangeButton: {
    minWidth: "184px",
    minHeight: "72px",
    padding: "12px 34px",
    borderRadius: "22px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(24px, 2.5vw, 34px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #b45f18",
    background: "linear-gradient(180deg, #ffd36f 0%, #ffac3d 48%, #ef7d22 100%)",
    textShadow: "0 3px 0 rgba(133, 68, 17, 0.34)",
    boxShadow: "0 7px 0 rgba(154, 86, 22, 0.52), 0 12px 22px rgba(154, 86, 22, 0.16), inset 0 3px 0 rgba(255,255,255,0.35)",
    touchAction: "manipulation",
  },

  blueButton: {
    minWidth: "184px",
    minHeight: "72px",
    padding: "12px 34px",
    borderRadius: "22px",
    color: "#ffffff",
    fontFamily: forestFont,
    fontSize: "clamp(24px, 2.5vw, 34px)",
    fontWeight: 900,
    lineHeight: 1.15,
    cursor: "pointer",
    border: "3px solid #2c72a8",
    background: "linear-gradient(180deg, #91dcff 0%, #54b7ef 48%, #2b8ed9 100%)",
    textShadow: "0 3px 0 rgba(30, 83, 137, 0.34)",
    boxShadow: "0 7px 0 rgba(38, 92, 137, 0.5), 0 12px 22px rgba(38, 78, 137, 0.16), inset 0 3px 0 rgba(255,255,255,0.35)",
    touchAction: "manipulation",
  },
};
