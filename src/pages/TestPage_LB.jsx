// src/pages/TestPage_LB.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import calculateLBScore from "../utils/lbScoring";
import { saveUnifiedResult } from "../utils/resultManager";

import backgroundImg from "../asset/LB/LB_background.webp";
import homeImg from "../asset/LB/grandma_sheep_house.webp";
import blowingBubblesImg from "../asset/LB/blowing_bubbles.webp";
import storyVideo from "../asset/mp4/LB_start.mp4";
import tutorialVideo from "../asset/mp4/LB_step.mp4";
import endingVideo from "../asset/mp4/LB_end.mp4";
import homeStartBtn from "../asset/home/start.webp";
import homeSkipBtn from "../asset/home/skip.webp";
import homeBackBtn from "../asset/home/back.webp";
import homeResultBtn from "../asset/home/result.webp";
import homeSendBtn from "../asset/home/send.webp";
import mouseGuideImg from "../asset/mouse.webp";

/*
  TestPage_LB.jsx

  使用全部指定門牌圖檔：green_01～green_10、red_01～red_06、blue_01～blue_07。
  流程：開始卡片 → LB_start.mp4 → LB_step.mp4 → 兩關測驗 → LB_end.mp4 → 結果。
  第二關共顯示 20 個門牌：10 個正確目標與 10 個相反顏色的干擾項。
  已移除反向數字關卡，並保留原本卡片與美術樣式。
*/

const RESULT_ROUTE = "/result-lb";
const SESSION_KEY = "LB_RESULT";
const LOCAL_KEY = "lbTestResult";

const doorplateAssets = require.context("../asset/LB", false, /(?:blue|yellow)_\d{2}\.webp$/);
const walkAssets = require.context("../asset/LB/walk", false, /\.webp$/);
const WALK_IMAGES = walkAssets.keys().sort().map(walkAssets);

function getDoorplateImage(item) {
  const color = item.color === "blue" ? "blue" : "yellow";
  const number = String(Math.min(30, Math.max(1, Number(item.number) || 1))).padStart(2, "0");
  return doorplateAssets(`./${color}_${number}.webp`);
}

function usesColorFallback() { return false; }

const STAGES = [
  {
    id: "forward",
    title: "第一關",
    subtitle: "請從 1 點到 10",
    ruleText: "1 → 2 → 3 → ... → 10",
    items: Array.from({ length: 10 }, (_, index) => ({
      key: `n-${index + 1}`,
      number: index + 1,
      color: "cream",
      label: `${index + 1}`,
    })),
    sequence: Array.from({ length: 10 }, (_, index) => `n-${index + 1}`),
  },
  {
    id: "red-blue",
    title: "第二關",
    subtitle: "請依序點紅 1、藍 2、紅 3、藍 4……藍 10",
    ruleText: "紅 1 → 藍 2 → 紅 3 → 藍 4 → … → 紅 9 → 藍 10",
    // 每個數字各有紅、藍兩個門牌；其中一個是目標，另一個是干擾項。
    // 正確規則：奇數選紅色、偶數選藍色，共 10 個目標 + 10 個干擾項。
    items: Array.from({ length: 10 }, (_, index) => {
      const number = index + 1;
      return [
        { key: `red-${number}`, number, color: "red", label: `${number}` },
        { key: `blue-${number}`, number, color: "blue", label: `${number}` },
      ];
    }).flat(),
    sequence: [
      "red-1", "blue-2", "red-3", "blue-4", "red-5",
      "blue-6", "red-7", "blue-8", "red-9", "blue-10",
    ],
  },
];

function toPercentPosition(x, y) {
  return { left: `${x}%`, top: `${y}%` };
}

const ROUTE_POSITIONS = {
  forward: {
    // 依照正確順序由左到右微幅 S 型排列，送出後連線不會互相交叉。
    route: [
      toPercentPosition(12, 66),
      toPercentPosition(22, 52),
      toPercentPosition(32, 64),
      toPercentPosition(42, 50),
      toPercentPosition(52, 62),
      toPercentPosition(62, 48),
      toPercentPosition(72, 60),
      toPercentPosition(80, 46),
      toPercentPosition(87, 34),
      toPercentPosition(91, 52),
    ],
    distractors: [],
  },
  "red-blue": {
    // 正確路線：紅1 → 藍2 → 紅3 → 藍4……一路靠近小屋，不交叉。
    route: [
      toPercentPosition(12, 66),
      toPercentPosition(22, 53),
      toPercentPosition(32, 65),
      toPercentPosition(42, 52),
      toPercentPosition(52, 64),
      toPercentPosition(62, 51),
      toPercentPosition(72, 62),
      toPercentPosition(80, 48),
      toPercentPosition(87, 36),
      toPercentPosition(91, 54),
    ],
    // 干擾門牌放在路線上下方，避免跟正確路線擠在同一條線上。
    distractors: [
      toPercentPosition(10, 31),
      toPercentPosition(21, 30),
      toPercentPosition(33, 34),
      toPercentPosition(45, 30),
      toPercentPosition(57, 34),
      toPercentPosition(69, 31),
      toPercentPosition(78, 72),
      toPercentPosition(65, 76),
      toPercentPosition(49, 75),
      toPercentPosition(30, 76),
    ],
  },
};

function buildStageItems(stage) {
  const layout = ROUTE_POSITIONS[stage.id] || { route: [], distractors: [] };
  const positionByKey = new Map();

  stage.sequence.forEach((key, index) => {
    if (layout.route[index]) positionByKey.set(key, layout.route[index]);
  });

  let distractorIndex = 0;
  return stage.items.map((item, index) => {
    const fallbackPosition = {
      left: `${12 + (index % 5) * 18}%`,
      top: `${18 + Math.floor(index / 5) * 24}%`,
    };

    if (!positionByKey.has(item.key)) {
      positionByKey.set(
        item.key,
        layout.distractors[distractorIndex] || layout.route[index] || fallbackPosition
      );
      distractorIndex += 1;
    }

    return {
      ...item,
      position: positionByKey.get(item.key) || fallbackPosition,
    };
  });
}

function nowISO() {
  return new Date().toISOString();
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function resolveCurrentChildId() {
  if (typeof window === "undefined") return null;

  const candidates = [
    safeJsonParse(localStorage.getItem("currentChild"), {}),
    safeJsonParse(localStorage.getItem("selectedChild"), {}),
    safeJsonParse(sessionStorage.getItem("currentChild"), {}),
    safeJsonParse(sessionStorage.getItem("selectedChild"), {}),
  ];

  for (const child of candidates) {
    const childId = child?.childId || child?.id || child?.child_id;
    if (childId) return String(childId);
  }

  return (
    localStorage.getItem("currentChildId") ||
    localStorage.getItem("selectedChildId") ||
    sessionStorage.getItem("currentChildId") ||
    sessionStorage.getItem("selectedChildId") ||
    null
  );
}

function getStageRuleType(stageId) {
  return stageId === "red-blue" ? "redBlueAlternating" : "forwardSequence";
}

function isStageSwitchTrial(stageId, stepIndex) {
  return stageId === "red-blue" && stepIndex > 0;
}

function hasStageInterference(stageId) {
  return stageId === "red-blue";
}

function getExpectedText(item) {
  if (!item) return "";
  if (item.color === "red") return `紅 ${item.number}`;
  if (item.color === "blue") return `藍 ${item.number}`;
  return `${item.number}`;
}

function createSelectionLog({ item, stageStartedAt, previousSelectedAt, order }) {
  const selectedAt = Date.now();

  return {
    key: item.key,
    selectedAt,
    selectedAtISO: new Date(selectedAt).toISOString(),
    order,
    cumulativeTime: Math.max(0, selectedAt - stageStartedAt),
    reactionTime: Math.max(0, selectedAt - previousSelectedAt),
  };
}

function normalizeSelectionLogs(logs, stageStartedAt) {
  return logs.map((log, index) => {
    const previousSelectedAt = index > 0 ? logs[index - 1].selectedAt : stageStartedAt;

    return {
      ...log,
      order: index + 1,
      reactionTime: Math.max(0, log.selectedAt - previousSelectedAt),
      cumulativeTime: Math.max(0, log.selectedAt - stageStartedAt),
    };
  });
}

function buildSimpleSummary({
  trials,
  startedAt,
  endedAt,
  completed,
  totalSelectionTime = 0,
}) {
  const total = trials.length;
  const correct = trials.filter((trial) => trial.correct).length;
  const wrong = trials.filter((trial) => !trial.correct && trial.errorType !== "timeout").length;
  const timeout = trials.filter((trial) => trial.errorType === "timeout").length;
  const reactionTimes = trials
    .filter((trial) => trial.correct)
    .map((trial) => safeNumber(trial.reactionTime, 0))
    .filter((value) => value > 0);

  const averageReactionTime =
    reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length)
      : 0;

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  let stars = 1;
  if (completed && accuracy >= 85) stars = 3;
  else if (completed && accuracy >= 60) stars = 2;

  return {
    gameId: "LB",
    gameName: "Linking Balloons",
    mode: "test",
    completed,
    startedAt,
    endedAt,
    totalTrials: total,
    correct,
    correctTrials: correct,
    wrong,
    wrongTrials: wrong,
    timeout,
    timeoutTrials: timeout,
    accuracy,
    averageReactionTime,
    totalSelectionTime,
    totalPlayTime: totalSelectionTime,
    totalReactionTime: totalSelectionTime,
    totalResponseTime: totalSelectionTime,
    stars,
  };
}

function createResultPayload({ trials, stageRecords, startedAt, completed }) {
  const endedAt = nowISO();
  const totalSelectionTime = stageRecords.reduce(
    (sum, record) => sum + safeNumber(record.selectionTimeMs ?? record.durationMs, 0),
    0
  );
  const summary = buildSimpleSummary({
    trials,
    stageRecords,
    startedAt,
    endedAt,
    completed,
    totalSelectionTime,
  });

  let scoreResult = null;
  try {
    if (typeof calculateLBScore === "function") {
      scoreResult = calculateLBScore(trials, {
        mode: "test",
        difficulty: "normal",
      });
    }
  } catch (error) {
    console.warn("[TestPage_LB] calculateLBScore failed, using simple summary.", error);
  }

  return {
    ...summary,
    ...(scoreResult || {}),
    summary: {
      ...summary,
      finalScore: scoreResult?.finalScore ?? summary.accuracy,
      stars: scoreResult?.stars ?? summary.stars,
    },
    scoring: scoreResult || null,
    trialLogs: trials,
    records: trials,
    stageRecords,
    totalSelectionTime,
    totalPlayTime: totalSelectionTime,
    totalReactionTime: totalSelectionTime,
    totalResponseTime: totalSelectionTime,
    raw: {
      trials,
      stageRecords,
      startedAt,
      endedAt,
      completed,
      totalSelectionTime,
      totalPlayTime: totalSelectionTime,
    },
  };
}

function DoorplateButton({ item, disabled, completed, isWrong, isCorrect, onClick }) {
  return (
    <button
      type="button"
      className={[
        "lb-doorplate",
        `lb-doorplate-${item.color}`,
        completed ? "is-completed" : "",
        isWrong ? "is-wrong" : "",
        isCorrect ? "is-correct" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: item.position.left,
        top: item.position.top,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick(item);
      }}
      disabled={disabled}
      aria-label={getExpectedText(item)}
    >
      <img
        className={usesColorFallback(item) ? "lb-doorplate-color-fallback" : ""}
        src={getDoorplateImage(item)}
        alt={`${item.color} ${item.number}`}
        draggable="false"
      />
      {completed && <b className="lb-select-order">✓</b>}
    </button>
  );
}

function TestPageLB() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("start");
  const [stageIndex, setStageIndex] = useState(0);
  const [completedKeys, setCompletedKeys] = useState([]);
  const [routeKeys, setRouteKeys] = useState([]);
  const [routeVisible, setRouteVisible] = useState(false);
  const [submittedCorrect, setSubmittedCorrect] = useState(null);
  const [trials, setTrials] = useState([]);
  const [stageRecords, setStageRecords] = useState([]);
  const [message, setMessage] = useState("請依照前導教學中的規則完成測驗。");
  const [wrongKey, setWrongKey] = useState("");
  const [correctKey, setCorrectKey] = useState("");
  const [walkImageIndex, setWalkImageIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [resultPayload, setResultPayload] = useState(null);

  const startedAtRef = useRef(nowISO());
  const stageStartedAtRef = useRef(Date.now());
  const selectionLogsRef = useRef([]);
  const finishedRef = useRef(false);
  const timeoutRef = useRef(null);
  const storyVideoRef = useRef(null);
  const tutorialVideoRef = useRef(null);
  const endingVideoRef = useRef(null);

  const currentStage = STAGES[stageIndex];
  const displayItems = useMemo(() => buildStageItems(currentStage), [currentStage]);
  const stageDone = completedKeys.length === currentStage.sequence.length;
  const routePolylinePoints = routeKeys
    .map((key) => displayItems.find((item) => item.key === key))
    .filter(Boolean)
    .map((item) => `${parseFloat(item.position.left)},${parseFloat(item.position.top)}`)
    .join(" ");

  const pauseVideo = useCallback((videoRef) => {
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
  }, []);

  const pauseAllVideos = useCallback(() => {
    pauseVideo(storyVideoRef);
    pauseVideo(tutorialVideoRef);
    pauseVideo(endingVideoRef);
  }, [pauseVideo]);

  const setGamePhase = useCallback((nextPhase) => {
    pauseAllVideos();
    setPhase(nextPhase);
  }, [pauseAllVideos]);

  useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current);
      pauseAllVideos();
    };
  }, [pauseAllVideos]);

  const resetWholeTest = () => {
    window.clearTimeout(timeoutRef.current);
    finishedRef.current = false;
    startedAtRef.current = nowISO();
    stageStartedAtRef.current = Date.now();
    selectionLogsRef.current = [];
    setStageIndex(0);
    setCompletedKeys([]);
    setRouteKeys([]);
    setRouteVisible(false);
    setSubmittedCorrect(null);
    setTrials([]);
    setStageRecords([]);
    setMessage("請依照前導教學中的規則完成測驗。");
    setWrongKey("");
    setCorrectKey("");
    setIsLocked(false);
    setResultPayload(null);
  };

  const handleStart = () => {
    resetWholeTest();
    setGamePhase("storyVideo");
  };

  const handleStoryVideoEnd = () => {
    setGamePhase("tutorialVideo");
  };

  const handleTutorialVideoEnd = () => {
    startGame();
  };

  const handleEndingVideoEnd = () => {
    setGamePhase("result");
  };

  const resetStageState = (nextStageIndex) => {
    window.clearTimeout(timeoutRef.current);
    setStageIndex(nextStageIndex);
    setCompletedKeys([]);
    setRouteKeys([]);
    setRouteVisible(false);
    setSubmittedCorrect(null);
    setWrongKey("");
    setCorrectKey("");
    setIsLocked(false);
    stageStartedAtRef.current = Date.now();
    selectionLogsRef.current = [];

    setMessage("請依照剛剛記住的規則繼續完成測驗。");
  };

  const startGame = () => {
    startedAtRef.current = nowISO();
    resetStageState(0);
    setTrials([]);
    setStageRecords([]);
    setGamePhase("playing");
  };

  const handleNumberClick = (item) => {
    if (phase !== "playing" || isLocked || routeVisible || finishedRef.current) return;

    setCompletedKeys((previous) => {
      if (previous.includes(item.key)) {
        const next = previous.filter((key) => key !== item.key);
        selectionLogsRef.current = normalizeSelectionLogs(
          selectionLogsRef.current.filter((log) => log.key !== item.key),
          stageStartedAtRef.current
        );
        setMessage("已取消這個門牌，請繼續選擇。");
        return next;
      }

      if (previous.length >= currentStage.sequence.length) {
        setMessage(`這一段只要選 ${currentStage.sequence.length} 個門牌，可先取消再重選。`);
        return previous;
      }

      const next = [...previous, item.key];
      const previousSelectedAt =
        selectionLogsRef.current.at(-1)?.selectedAt || stageStartedAtRef.current;
      selectionLogsRef.current = [
        ...selectionLogsRef.current,
        createSelectionLog({
          item,
          stageStartedAt: stageStartedAtRef.current,
          previousSelectedAt,
          order: next.length,
        }),
      ];
      setMessage(
        next.length === currentStage.sequence.length
          ? "選好了，請按送出答案。"
          : `已選 ${next.length} 個，請繼續。`
      );
      return next;
    });
  };

  const handleBlankClick = () => {
    if (phase !== "playing" || isLocked || routeVisible || finishedRef.current) return;
    setMessage("請點門牌；再次點同一個門牌可以取消。");
  };

  const handleUndoLastSelection = () => {
    if (
      phase !== "playing" ||
      isLocked ||
      routeVisible ||
      finishedRef.current ||
      completedKeys.length === 0
    ) {
      return;
    }

    setCompletedKeys((previous) => {
      const removedKey = previous.at(-1);
      const next = previous.slice(0, -1);
      selectionLogsRef.current = normalizeSelectionLogs(
        selectionLogsRef.current.filter((log) => log.key !== removedKey),
        stageStartedAtRef.current
      );
      return next;
    });
    setMessage("已退回上一個門牌，可以重新選。");
  };

  const saveStageRecord = ({ selectedKeys = completedKeys, correctSteps = 0 } = {}) => {
    const now = Date.now();
    const finalSelectionLog = selectionLogsRef.current.at(-1);
    const selectionTimeMs =
      selectedKeys.length >= currentStage.sequence.length && finalSelectionLog
        ? Math.max(0, finalSelectionLog.cumulativeTime)
        : Math.max(0, now - stageStartedAtRef.current);
    const stageRecord = {
      stageId: currentStage.id,
      stageTitle: currentStage.title,
      startedAt: new Date(stageStartedAtRef.current).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationMs: Math.max(0, now - stageStartedAtRef.current),
      selectionTimeMs,
      totalSelectionTime: selectionTimeMs,
      totalPlayTime: selectionTimeMs,
      totalReactionTime: selectionTimeMs,
      completedSteps: selectedKeys.length,
      correctSteps,
      selectedOrder: [...selectedKeys],
      totalSteps: currentStage.sequence.length,
      accuracy: currentStage.sequence.length
        ? Math.round((correctSteps / currentStage.sequence.length) * 100)
        : 0,
      ruleType: getStageRuleType(currentStage.id),
      hasInterference: hasStageInterference(currentStage.id),
      difficulty: currentStage.id === "red-blue" ? "hard" : "normal",
      difficultyLevel: currentStage.id === "red-blue" ? 4 : 3,
    };

    setStageRecords((previous) => [...previous, stageRecord]);
    return stageRecord;
  };

  const handleSubmitStage = () => {
    if (!stageDone || isLocked || routeVisible) return;

    const selectedKeys = [...completedKeys];
    const submittedAt = Date.now();
    const itemByKey = new Map(currentStage.items.map((item) => [item.key, item]));
    const selectionLogByKey = new Map(selectionLogsRef.current.map((log) => [log.key, log]));
    const fallbackReactionTime = Math.max(
      0,
      Math.round((submittedAt - stageStartedAtRef.current) / Math.max(1, selectedKeys.length))
    );
    const submittedTrials = selectedKeys.map((key, index) => {
      const item = itemByKey.get(key);
      const expected = currentStage.sequence[index];
      const expectedItem = itemByKey.get(expected);
      const selectionLog = selectionLogByKey.get(key);
      const reactionTime = selectionLog?.reactionTime ?? fallbackReactionTime;

      return {
        gameId: "LB",
        mode: "test",
        stageId: currentStage.id,
        stageTitle: currentStage.title,
        stepIndex: index,
        expectedKey: expected,
        expectedNumber: expectedItem?.number ?? null,
        expectedColor: expectedItem?.color ?? null,
        clickedKey: item?.key ?? null,
        clickedNumber: item?.number ?? null,
        clickedColor: item?.color ?? null,
        correct: key === expected,
        isCorrect: key === expected,
        status: key === expected ? "correct" : "wrong",
        errorType: key === expected ? null : "sequenceError",
        rule: getStageRuleType(currentStage.id),
        ruleType: getStageRuleType(currentStage.id),
        isSwitch: isStageSwitchTrial(currentStage.id, index),
        switchTrial: isStageSwitchTrial(currentStage.id, index),
        hasInterference: hasStageInterference(currentStage.id),
        hasDistractor: hasStageInterference(currentStage.id),
        difficulty: currentStage.id === "red-blue" ? "hard" : "normal",
        difficultyLevel: currentStage.id === "red-blue" ? 4 : 3,
        reactionTime: Math.max(0, Math.round(reactionTime)),
        cumulativeTime: selectionLog?.cumulativeTime ?? Math.max(0, submittedAt - stageStartedAtRef.current),
        selectionOrder: selectionLog?.order ?? index + 1,
        timestamp: selectionLog?.selectedAtISO ?? nowISO(),
      };
    });

    const correctSteps = submittedTrials.filter((trial) => trial.correct).length;
    const isAllCorrect = correctSteps === currentStage.sequence.length;
    const currentRecord = saveStageRecord({ selectedKeys, correctSteps });
    const nextStageIndex = stageIndex + 1;
    const mergedTrials = [...trials, ...submittedTrials];

    setTrials(mergedTrials);
    setRouteKeys(selectedKeys);
    setWalkImageIndex(Math.floor(Math.random() * Math.max(1, WALK_IMAGES.length)));
    setRouteVisible(true);
    setSubmittedCorrect(isAllCorrect);
    setIsLocked(true);
    setMessage(isAllCorrect ? "完成！路線連起來了。" : "答案已送出，現在顯示你走的路線。");

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      if (nextStageIndex < STAGES.length) {
        setGamePhase("stageComplete");
        setMessage(`${currentStage.title}完成。`);
        return;
      }

      finishGame({
        completed: true,
        extraStageRecord: currentRecord,
        finalTrials: mergedTrials,
      });
    }, 1500);
  };

  const goNextStage = () => {
    const nextStageIndex = stageIndex + 1;
    if (nextStageIndex >= STAGES.length) return;

    resetStageState(nextStageIndex);
    setGamePhase("playing");
  };

  const finishGame = ({ completed, extraStageRecord = null, finalTrials = trials }) => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const finalStageRecords = extraStageRecord
      ? [...stageRecords, extraStageRecord]
      : [...stageRecords];

    const resultPayload = createResultPayload({
      trials: finalTrials,
      stageRecords: finalStageRecords,
      startedAt: startedAtRef.current,
      completed,
    });

    try {
      const serializedResult = JSON.stringify(resultPayload);
      const childId = resolveCurrentChildId();

      sessionStorage.setItem(SESSION_KEY, serializedResult);
      sessionStorage.setItem("latestLBTestResult", serializedResult);

      localStorage.setItem(LOCAL_KEY, serializedResult);
      localStorage.setItem("latestLBTestResult", serializedResult);
      localStorage.setItem("LB_TEST_RESULT", serializedResult);

      if (childId) {
        localStorage.setItem(`lbTestResult_${childId}`, serializedResult);
        localStorage.setItem(`latestLBTestResult_${childId}`, serializedResult);
      }
    } catch (error) {
      console.warn("[TestPage_LB] failed to save result", error);
    }

    try {
      saveUnifiedResult({
        rawResult: resultPayload,
        gameId: "LB",
        mode: "test",
        difficulty: "normal",
        route: "/test-linking-balloons",
        visibleRoles: ["child", "parent", "clinician"],
      });
    } catch (error) {
      console.warn("[TestPage_LB] failed to save unified result", error);
    }

    setResultPayload(resultPayload);
    setGamePhase("endingVideo");
  };

  const goDetailedResult = () => {
    navigate(RESULT_ROUTE, {
      replace: true,
      state: {
        ...resultPayload,
        result: resultPayload,
        gameId: "LB",
        mode: "test",
      },
    });
  };

  const resultStars = Math.max(1, Math.min(3, Number(resultPayload?.stars || resultPayload?.summary?.stars || 1)));

  if (phase === "start") {
    return (
      <div className="lb-simple-page lb-srt-skin">
        <LBResetStyle />
        <main className="lb-center-shell lb-start-shell">
          <section className="lb-soft-panel lb-start-panel game-start-card-artwork" aria-label="LB 測驗開始">
            <h1 className="lb-game-title">Linking Balloons</h1>
            <div className="lb-start-content">
              <div className="lb-dialog-bubble">幫綿羊奶奶照順序找到門牌，一起走回家。</div>
              <div className="lb-round-icon lb-start-avatar">
                <img width={1024} height={1024} loading="lazy" src={blowingBubblesImg} alt="綿羊奶奶和朋友們" />
              </div>
            </div>
            <div className="lb-guided-action lb-guided-start">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-start" onClick={handleStart} aria-label="開始">
                <img width={1024} height={341} src={homeStartBtn} alt="開始" />
              </button>
              <img width={1024} height={1024} loading="lazy" className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "storyVideo") {
    return (
      <div className="lb-simple-page lb-srt-skin">
        <LBResetStyle />
        <main className="lb-center-shell">
          <section className="lb-soft-panel lb-video-panel game-start-card-artwork" aria-label="故事動畫">
            <div className="lb-video-frame">
              <video ref={storyVideoRef} src={storyVideo} autoPlay muted playsInline controls onEnded={handleStoryVideoEnd} className="lb-video" />
            </div>
            <div className="lb-guided-action lb-guided-skip">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-skip" onClick={handleStoryVideoEnd} aria-label="跳過故事動畫">
                <img width={1024} height={341} loading="lazy" src={homeSkipBtn} alt="跳過故事動畫" />
              </button>
              <img width={1024} height={1024} loading="lazy" className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "tutorialVideo") {
    return (
      <div className="lb-simple-page lb-srt-skin">
        <LBResetStyle />
        <main className="lb-center-shell">
          <section className="lb-soft-panel lb-video-panel game-start-card-artwork" aria-label="前導教學影片">
            <div className="lb-video-frame">
              <video ref={tutorialVideoRef} src={tutorialVideo} autoPlay muted playsInline controls onEnded={handleTutorialVideoEnd} className="lb-video" />
            </div>
            <div className="lb-guided-action lb-guided-skip">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-skip" onClick={handleTutorialVideoEnd} aria-label="跳過前導教學">
                <img width={1024} height={341} loading="lazy" src={homeSkipBtn} alt="跳過前導教學" />
              </button>
              <img width={1024} height={1024} loading="lazy" className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "stageComplete") {
    const nextStage = STAGES[stageIndex + 1];

    return (
      <div className="lb-simple-page lb-srt-skin">
        <LBResetStyle />
        <main className="lb-stage-open" aria-label={`${currentStage.title}完成`}>
          <img width={1024} height={1024} loading="lazy" className="lb-stage-home" src={homeImg} alt="小屋" draggable="false" />
          <section className="lb-stage-open-content">
            <p className="lb-kicker">Linking Balloons</p>
            <h1>{currentStage.title}完成</h1>
            <p>很好，準備走下一段小路。</p>
            <button type="button" className="lb-primary-button" onClick={goNextStage}>
              開始{nextStage?.title || "下一關"}
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "endingVideo") {
    return (
      <div className="lb-simple-page lb-srt-skin">
        <LBResetStyle />
        <main className="lb-center-shell">
          <section className="lb-soft-panel lb-video-panel game-start-card-artwork" aria-label="結束動畫">
            <div className="lb-video-frame">
              <video
                ref={endingVideoRef}
                src={endingVideo}
                autoPlay
                muted
                playsInline
                controls
                onEnded={handleEndingVideoEnd}
                className="lb-video"
              />
            </div>
            <div className="lb-guided-action lb-guided-skip">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-skip" onClick={handleEndingVideoEnd} aria-label="跳過動畫">
                <img width={1024} height={341} loading="lazy" src={homeSkipBtn} alt="跳過動畫" />
              </button>
              <img width={1024} height={1024} loading="lazy" className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="lb-simple-page lb-srt-skin">
        <LBResetStyle />
        <main className="lb-center-shell lb-result-shell">
          <section className="lb-soft-panel lb-result-panel game-result-card-artwork" aria-label="測驗結果">
            <div className="lb-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span key={star} className={`lb-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>
              ))}
            </div>
            <div className="lb-start-content lb-result-content">
              <div className="lb-dialog-bubble">完成了！你有照順序找到門牌屋。</div>
              <div className="lb-round-icon lb-result-icon">
                <img width={1024} height={1024} loading="lazy" src={homeImg} alt="門牌屋" />
              </div>
            </div>
            <div className="lb-result-actions">
              <div className="lb-guided-action lb-guided-result-main">
                <button type="button" className="lb-forest-button lb-image-button lb-btn-home" onClick={() => navigate("/test-map")} aria-label="回到森林">
                  <img width={1024} height={341} loading="lazy" src={homeBackBtn} alt="回到森林" />
                </button>
                <img width={1024} height={1024} loading="lazy" className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
              </div>
              <button type="button" className="lb-forest-button lb-image-button lb-btn-detail" onClick={goDetailedResult} aria-label="詳細結果">
                <img width={1024} height={341} loading="lazy" src={homeResultBtn} alt="詳細結果" />
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="lb-simple-page lb-srt-skin">
      <LBResetStyle />
      <main className="lb-game-card lb-playing-panel">
        <section className="lb-play-board" onClick={handleBlankClick}>
          {routeVisible && routeKeys.length > 1 && routePolylinePoints && (
            <svg className="lb-route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline className="lb-route-outline" points={routePolylinePoints} />
              <polyline
                points={routePolylinePoints}
                className={submittedCorrect ? "lb-route-main is-correct" : "lb-route-main is-submitted"}
              />
            </svg>
          )}
          <img width={1024} height={1024} loading="lazy" className="lb-map-home" src={homeImg} alt="綿羊奶奶的房子" draggable="false" />
          {routeVisible && routeKeys.length > 0 && WALK_IMAGES.length > 0 && (() => {
            const lastItem = displayItems.find((item) => item.key === routeKeys[routeKeys.length - 1]);
            if (!lastItem) return null;
            const walkImg = WALK_IMAGES[walkImageIndex % WALK_IMAGES.length];
            return (
              <img loading="lazy"
                className="lb-route-walker"
                src={walkImg}
                alt="沿著答案路線前進的朋友"
                draggable="false"
                style={{ left: lastItem.position.left, top: lastItem.position.top }}
              />
            );
          })()}
          {displayItems.map((item) => (
            <DoorplateButton
              key={item.key}
              item={item}
              disabled={isLocked}
              completed={completedKeys.includes(item.key)}
              isWrong={wrongKey === item.key}
              isCorrect={correctKey === item.key}
              onClick={handleNumberClick}
            />
          ))}
        </section>

        <footer className="lb-game-footer">
          <div className="lb-message" aria-live="polite">
            <strong>{message}</strong>
            <span>
              {completedKeys.length}/{currentStage.sequence.length}
            </span>
          </div>
          <button
            type="button"
            className="lb-undo-button"
            onClick={handleUndoLastSelection}
            disabled={completedKeys.length === 0 || isLocked}
            aria-label="退回上一個門牌"
          >
            退回
          </button>
          <button
            type="button"
            className="lb-submit-button"
            onClick={handleSubmitStage}
            disabled={!stageDone || isLocked}
            aria-label="送出答案"
          >
            <img width={1024} height={341} loading="lazy" src={homeSendBtn} alt="送出答案" draggable="false" />
          </button>
        </footer>
      </main>
    </div>
  );
}

function LBResetStyle() {
  return (
    <style>{`
      .lb-simple-page,
      .lb-simple-page * {
        box-sizing: border-box;
      }

      .lb-simple-page {
        width: 100%;
        min-height: 100dvh;
        height: 100dvh;
        padding: clamp(10px, 1.4vw, 18px);
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at 50% 22%, rgba(255, 255, 220, 0.25) 0%, rgba(255, 255, 255, 0.08) 42%, rgba(69, 118, 38, 0.08) 100%),
          linear-gradient(rgba(241, 255, 237, 0.18), rgba(255, 248, 222, 0.22)),
          url(${backgroundImg});
        background-size: cover;
        background-position: center;
        overflow: hidden;
        font-family:
          'jf-openhuninn',
          'Fredoka',
          'Nunito',
          'Noto Sans TC',
          'Microsoft JhengHei',
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          sans-serif;
        touch-action: manipulation;
      }

      .lb-simple-card,
      .lb-game-card {
        position: relative;
        width: min(1180px, calc(100vw - clamp(20px, 2.8vw, 36px)));
        max-width: calc(100vw - clamp(20px, 2.8vw, 36px));
        border: clamp(4px, 0.65vw, 6px) solid #f6a51f;
        outline: 3px solid rgba(255, 132, 38, 0.86);
        outline-offset: -12px;
        border-radius: clamp(34px, 4.6vw, 56px);
        background:
          linear-gradient(180deg, rgba(255, 252, 225, 0.985) 0%, rgba(255, 242, 185, 0.985) 52%, rgba(255, 229, 145, 0.985) 100%);
        box-shadow:
          0 14px 0 rgba(194, 125, 33, 0.13),
          0 24px 42px rgba(86, 61, 27, 0.18),
          inset 0 0 0 7px rgba(255, 255, 255, 0.42),
          inset 0 0 0 15px rgba(255, 215, 105, 0.16);
        overflow: hidden;
      }

      .lb-simple-card::before,
      .lb-game-card::before {
        content: '';
        position: absolute;
        inset: clamp(12px, 1.6vw, 18px);
        border-radius: clamp(24px, 3.6vw, 42px);
        border: 2px dashed rgba(230, 170, 67, 0.42);
        pointer-events: none;
        z-index: 0;
      }

      .lb-simple-card::after,
      .lb-game-card::after {
        content: '';
        position: absolute;
        left: 34px;
        right: 34px;
        bottom: 13px;
        height: 34px;
        pointer-events: none;
        background:
          radial-gradient(circle at 4% 40%, #8bc947 0 12px, transparent 13px),
          radial-gradient(circle at 8% 15%, #a4da58 0 8px, transparent 9px),
          radial-gradient(circle at 92% 42%, #8bc947 0 12px, transparent 13px),
          radial-gradient(circle at 88% 18%, #a4da58 0 8px, transparent 9px);
        opacity: 0.82;
        z-index: 0;
      }

      .lb-simple-card > *,
      .lb-game-card > * {
        position: relative;
        z-index: 1;
        min-width: 0;
      }

      .lb-simple-card {
        height: min(690px, calc(100dvh - clamp(22px, 3vw, 38px)));
        min-height: 0;
        padding: clamp(22px, 3.4vw, 44px) clamp(28px, 4.6vw, 58px);
        display: grid;
        grid-template-columns: minmax(220px, 0.88fr) minmax(430px, 1.12fr);
        align-items: center;
        justify-content: center;
        gap: clamp(22px, 4vw, 52px);
        text-align: left;
      }

      .lb-intro-visual {
        min-width: 0;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .lb-intro-sheep {
        width: min(250px, 24vw);
        max-width: 100%;
        max-height: min(280px, 46vh);
        object-fit: contain;
        border: 0;
        background: transparent;
        filter:
          drop-shadow(0 16px 20px rgba(78, 57, 28, 0.22))
          drop-shadow(0 0 18px rgba(255, 223, 112, 0.32));
        animation: lbFloat 2.8s ease-in-out infinite;
      }

      .lb-stage-card {
        grid-template-columns: minmax(210px, 0.85fr) minmax(390px, 1.15fr);
        text-align: left;
      }

      .lb-stage-open {
        width: min(980px, calc(100vw - 48px));
        min-height: min(520px, calc(100dvh - 56px));
        display: grid;
        grid-template-columns: minmax(240px, 0.9fr) minmax(360px, 1.1fr);
        align-items: center;
        justify-content: center;
        gap: clamp(32px, 7vw, 88px);
        padding: clamp(24px, 4vw, 54px);
      }

      .lb-stage-open-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: clamp(12px, 2vh, 20px);
        padding: clamp(18px, 2.5vw, 30px);
      }

      .lb-stage-open-content h1 {
        margin: 0;
        color: #744018;
        font-size: clamp(38px, 5.3vw, 68px);
        font-weight: 950;
        line-height: 1.05;
        letter-spacing: 0.035em;
        text-shadow: 0 4px 0 rgba(255, 255, 255, 0.82), 0 8px 18px rgba(93, 63, 34, 0.18);
      }

      .lb-stage-open-content > p:not(.lb-kicker) {
        margin: 0;
        color: #5d3f22;
        font-size: clamp(18px, 2.1vw, 27px);
        font-weight: 900;
        line-height: 1.45;
        text-shadow: 0 2px 0 rgba(255, 255, 255, 0.78);
      }

      .lb-stage-home {
        width: min(260px, 30vw);
        max-height: min(240px, 42vh);
        object-fit: contain;
        filter: drop-shadow(0 16px 18px rgba(78, 57, 28, 0.20));
      }

      .lb-tutorial-content {
        width: 100%;
        min-width: 0;
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: clamp(8px, 1.3vh, 12px);
      }

      .lb-stage-card .lb-tutorial-content {
        align-items: flex-start;
      }

      .lb-kicker {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 6px 16px;
        border-radius: 999px;
        border: 2px solid rgba(243, 181, 75, 0.56);
        background: linear-gradient(180deg, #fff5c9, #ffe28c);
        color: #8a531d;
        font-size: clamp(14px, 1.35vw, 18px);
        font-weight: 950;
        letter-spacing: 0.06em;
        box-shadow: inset 0 -3px 0 rgba(140, 92, 35, 0.12);
      }

      .lb-intro-card h1,
      .lb-stage-card h1,
      .lb-game-top h1 {
        margin: 0;
        color: #744018;
        font-size: clamp(30px, 4.1vw, 50px);
        font-weight: 950;
        line-height: 1.05;
        letter-spacing: 0.035em;
        text-shadow: 0 3px 0 rgba(255, 255, 255, 0.78);
      }

      .lb-intro-text,
      .lb-stage-card p,
      .lb-game-top p,
      .lb-tutorial-text {
        margin: 0;
        color: #5d3f22;
        font-size: clamp(16px, 1.8vw, 22px);
        font-weight: 850;
        line-height: 1.42;
      }

      .lb-tutorial-text {
        width: 100%;
        padding: clamp(10px, 1.3vw, 14px) clamp(14px, 1.7vw, 20px);
        border: 4px solid #f0c77b;
        border-radius: 24px;
        background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
        box-shadow:
          0 7px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.35);
      }


      .lb-rule-card {
        width: 100%;
        padding: clamp(8px, 1.2vw, 14px) clamp(14px, 1.9vw, 22px);
        border: 4px solid #f0c77b;
        border-radius: 26px;
        background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
        box-shadow:
          0 7px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.35);
      }

      .lb-rule-icons {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: clamp(8px, 1vw, 12px);
      }

      .lb-rule-icons span {
        min-width: 34px;
        min-height: 34px;
        padding: 4px 9px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 245, 201, 0.82);
        color: #744018;
        font-size: clamp(17px, 1.9vw, 25px);
        font-weight: 950;
        box-shadow: inset 0 -2px 0 rgba(140, 92, 35, 0.10);
      }

      .lb-rule-icons span.is-arrow {
        min-width: auto;
        background: transparent;
        box-shadow: none;
        padding-inline: 0;
      }

      .lb-rule-icons span.is-red {
        color: #9a2f2f;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #ffdddd 0%, #f36f63 100%);
        border: 3px solid rgba(229, 77, 68, 0.58);
      }

      .lb-rule-icons span.is-blue {
        color: #16517e;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #dff2ff 0%, #65aee6 100%);
        border: 3px solid rgba(63, 144, 213, 0.58);
      }

      .lb-tutorial-board {        width: 100%;
        max-width: 100%;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: clamp(8px, 1.2vw, 14px);
        padding: clamp(12px, 1.5vw, 18px);
        border-radius: 30px;
        border: 4px solid rgba(113, 144, 60, 0.35);
        background:
          radial-gradient(circle at 20% 15%, rgba(255,255,255,0.72), transparent 28%),
          linear-gradient(180deg, rgba(206, 238, 161, 0.9), rgba(151, 211, 119, 0.92));
        box-shadow:
          inset 0 10px 22px rgba(255, 255, 255, 0.36),
          inset 0 -12px 24px rgba(57, 105, 49, 0.14),
          0 10px 18px rgba(87, 81, 38, 0.12);
        overflow: visible;
      }

      .lb-tutorial-chip {
        width: 100%;
        min-width: 0;
        min-height: clamp(58px, 8.2vh, 78px);
        border: 4px solid rgba(255, 255, 255, 0.86);
        outline: 3px solid #e9a33c;
        border-radius: 24px;
        background:
          linear-gradient(180deg, #fff8d0 0%, #ffe28c 58%, #ffc657 100%);
        color: #744018;
        font-family: inherit;
        font-size: clamp(23px, 2.6vw, 34px);
        font-weight: 950;
        cursor: pointer;
        box-shadow:
          0 7px 0 rgba(178, 103, 21, 0.22),
          0 14px 22px rgba(91, 57, 18, 0.13),
          inset 0 4px 0 rgba(255, 255, 255, 0.48),
          inset 0 -5px 0 rgba(177, 116, 20, 0.12);
        transition: transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease;
      }

      .lb-tutorial-chip.is-red {
        outline-color: #e1705d;
        background: linear-gradient(180deg, #ffe6df 0%, #ffb3a6 58%, #ef705d 100%);
        color: #8f2e24;
      }

      .lb-tutorial-chip.is-blue {
        outline-color: #4c9bdc;
        background: linear-gradient(180deg, #e6f3ff 0%, #b9dcff 58%, #55a3e0 100%);
        color: #1e5a93;
      }

      .lb-tutorial-chip:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.025);
        filter: brightness(1.05);
      }

      .lb-tutorial-chip:active:not(:disabled) {
        transform: translateY(1px) scale(0.98);
      }

      .lb-tutorial-chip.is-expected {
        filter: drop-shadow(0 0 14px rgba(255, 215, 91, 0.72));
      }

      .lb-tutorial-chip.is-completed {
        opacity: 0.48;
        filter: grayscale(0.16);
        transform: translateY(5px);
        box-shadow:
          0 2px 0 rgba(178, 103, 21, 0.20),
          inset 0 4px 0 rgba(255, 255, 255, 0.42);
      }

      .lb-tutorial-chip.is-success {
        animation: lbPop 0.32s cubic-bezier(.18, .89, .32, 1.28);
        filter: drop-shadow(0 0 18px rgba(255, 223, 73, 0.95));
      }

      .lb-tutorial-chip.is-error {
        animation: lbChipShake 0.30s ease;
        filter: drop-shadow(0 0 16px rgba(255, 95, 95, 0.86));
      }

      .lb-tutorial-message {
        width: 100%;
        min-height: 28px;
        margin: 0;
        color: #7a4a1a;
        font-size: clamp(15px, 1.55vw, 19px);
        font-weight: 900;
        line-height: 1.35;
      }

      .lb-tutorial-message.is-done {
        color: #4f7d3a;
      }

      .lb-tutorial-dots {
        display: flex;
        gap: 9px;
        align-items: center;
      }

      .lb-tutorial-dots span {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: rgba(138, 83, 29, 0.22);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
      }

      .lb-tutorial-dots span.is-active {
        width: 30px;
        background: linear-gradient(90deg, #8ed36f, #f7c44c);
      }

      .lb-tutorial-actions {
        width: 100%;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        margin-top: 2px;
      }

      .lb-primary-button,
      .lb-secondary-button,
      .lb-undo-button,
      .lb-submit-button {
        position: relative;
        border: 4px solid rgba(255, 255, 255, 0.86);
        border-radius: 22px;
        color: #ffffff;
        font-family: inherit;
        font-weight: 950;
        line-height: 1.15;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
        text-shadow: 0 3px 0 rgba(35, 96, 36, 0.32), 0 0 8px rgba(35, 96, 36, 0.18);
      }

      .lb-primary-button,
      .lb-submit-button {
        outline: 3px solid #5d9d32;
        background: linear-gradient(180deg, #b9f235 0%, #77c927 48%, #4e9a23 100%);
        box-shadow:
          0 7px 0 #377721,
          0 14px 22px rgba(61, 97, 33, 0.20),
          inset 0 4px 0 rgba(255,255,255,0.48),
          inset 0 -5px 0 rgba(49, 128, 31, 0.26);
      }

      .lb-secondary-button,
      .lb-undo-button {
        outline: 3px solid #d28525;
        background: linear-gradient(180deg, #ffd868 0%, #f6a83b 52%, #d97a25 100%);
        box-shadow:
          0 7px 0 #a85e1d,
          0 14px 22px rgba(97, 65, 33, 0.18),
          inset 0 4px 0 rgba(255,255,255,0.42),
          inset 0 -5px 0 rgba(143, 76, 20, 0.22);
      }

      .lb-primary-button,
      .lb-secondary-button {
        min-width: 134px;
        min-height: 56px;
        padding: 10px 22px;
        font-size: clamp(18px, 2vw, 26px);
        white-space: nowrap;
      }

      .lb-undo-button {
        min-width: 96px;
        min-height: 54px;
        padding: 0 18px;
        font-size: clamp(17px, 1.6vw, 22px);
        white-space: nowrap;
      }

      .lb-primary-button:hover:not(:disabled),
      .lb-secondary-button:hover:not(:disabled),
      .lb-undo-button:hover:not(:disabled),
      .lb-submit-button:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.025);
        filter: brightness(1.05);
      }

      .lb-primary-button:active:not(:disabled),
      .lb-secondary-button:active:not(:disabled),
      .lb-undo-button:active:not(:disabled),
      .lb-submit-button:active:not(:disabled) {
        transform: translateY(1px) scale(0.98);
      }

      .lb-primary-button:disabled,
      .lb-secondary-button:disabled,
      .lb-undo-button:disabled,
      .lb-submit-button:disabled {
        opacity: 0.48;
        cursor: not-allowed;
        filter: grayscale(0.28);
      }

      .lb-game-card {
        height: min(740px, calc(100dvh - clamp(20px, 2.8vw, 34px)));
        min-height: 0;
        padding: clamp(16px, 2vw, 28px);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .lb-game-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 4px 12px 0;
        flex: 0 0 auto;
      }

      .lb-game-top h1 {
        font-size: clamp(28px, 3.6vw, 44px);
      }

      .lb-game-top p {
        margin-top: 5px;
        font-size: clamp(15px, 1.55vw, 19px);
      }

      .lb-progress-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 12px;
        color: #7a5730;
        font-size: clamp(15px, 1.5vw, 19px);
        font-weight: 950;
        flex: 0 0 auto;
      }

      .lb-progress-bar {
        flex: 1;
        height: 16px;
        padding: 4px;
        border-radius: 999px;
        background: rgba(127, 91, 45, 0.18);
        box-shadow:
          inset 0 2px 4px rgba(83, 60, 24, 0.16),
          0 2px 0 rgba(255,255,255,0.55);
        overflow: hidden;
      }

      .lb-progress-bar div {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #8ed36f 0%, #f7c44c 58%, #ffb545 100%);
        box-shadow: 0 0 14px rgba(247, 196, 76, 0.42);
        transition: width 0.2s ease;
      }


      .lb-route-layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
        pointer-events: none;
        overflow: visible;
      }

      .lb-route-outline {
        fill: none;
        stroke: rgba(255, 255, 232, 0.96);
        stroke-width: 9.4;
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 4px 5px rgba(62, 42, 18, 0.34));
        animation: lbDrawRoute 1.15s ease forwards;
      }

      .lb-route-main {
        fill: none;
        stroke: rgba(255, 137, 38, 0.98);
        stroke-width: 5.4;
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 0 5px rgba(255, 218, 82, 0.70));
        animation: lbDrawRoute 1.15s ease forwards;
      }

      .lb-route-main.is-correct {
        stroke: rgba(255, 91, 36, 1);
        stroke-width: 6.4;
      }

      .lb-select-order {
        position: absolute;
        right: -7px;
        top: -8px;
        width: 25px;
        height: 25px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        border: 3px solid #fff;
        background: #79b84a;
        color: #fff;
        font-size: 14px;
        box-shadow: 0 3px 8px rgba(49, 92, 32, .28);
      }

      @keyframes lbDrawRoute {
        from { stroke-dashoffset: 45; opacity: 0; }
        to { stroke-dashoffset: 0; opacity: 1; }
      }

      .lb-play-board {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        border-radius: 36px;
        background:
          radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.72), transparent 26%),
          radial-gradient(circle at 80% 10%, rgba(255, 240, 154, 0.35), transparent 22%),
          linear-gradient(180deg, rgba(195, 232, 150, 0.92), rgba(126, 200, 108, 0.94));
        border: 5px solid rgba(255, 255, 255, 0.72);
        outline: 4px solid rgba(91, 147, 56, 0.45);
        outline-offset: -10px;
        overflow: hidden;
        box-shadow:
          0 12px 0 rgba(89, 134, 53, 0.10),
          inset 0 14px 26px rgba(255, 255, 255, 0.38),
          inset 0 -18px 32px rgba(57, 105, 49, 0.16);
      }

      .lb-play-board::before {
        content: '';
        position: absolute;
        inset: auto -10% -28% -10%;
        height: 48%;
        border-radius: 50% 50% 0 0;
        background:
          radial-gradient(circle at 18% 38%, rgba(255,255,255,0.14), transparent 10%),
          linear-gradient(180deg, rgba(104, 174, 82, 0.42), rgba(77, 145, 68, 0.38));
        pointer-events: none;
      }

      .lb-play-board::after {
        content: '';
        position: absolute;
        inset: 24px;
        border-radius: 30px;
        border: 2px dashed rgba(255, 255, 255, 0.36);
        pointer-events: none;
      }

      .lb-map-home {
        position: absolute;
        right: 4%;
        bottom: 4%;
        width: clamp(86px, 11vw, 140px);
        max-height: 140px;
        object-fit: contain;
        z-index: 1;
        opacity: 0.96;
        filter: drop-shadow(0 12px 14px rgba(54, 82, 42, 0.22));
        pointer-events: none;
      }

      .lb-doorplate {
        position: absolute;
        z-index: 3;
        width: clamp(54px, 6.7vw, 82px);
        height: clamp(54px, 6.7vw, 82px);
        transform: translate(-50%, -50%);
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 0;
        transition: transform 0.12s ease, filter 0.12s ease, opacity 0.12s ease;
      }

      .lb-doorplate img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        filter:
          drop-shadow(0 8px 0 rgba(144, 84, 31, 0.10))
          drop-shadow(0 12px 12px rgba(80, 58, 31, 0.20));
      }

      .lb-doorplate-red img.lb-doorplate-color-fallback {
        filter:
          sepia(1) saturate(5.5) hue-rotate(320deg) brightness(1.02)
          drop-shadow(0 8px 0 rgba(144, 84, 31, 0.10))
          drop-shadow(0 12px 12px rgba(80, 58, 31, 0.20));
      }

      .lb-doorplate-blue img.lb-doorplate-color-fallback {
        filter:
          sepia(1) saturate(5) hue-rotate(165deg) brightness(0.98)
          drop-shadow(0 8px 0 rgba(144, 84, 31, 0.10))
          drop-shadow(0 12px 12px rgba(80, 58, 31, 0.20));
      }

      .lb-doorplate span {
        position: absolute;
        left: 50%;
        top: 49%;
        transform: translate(-50%, -50%);
        min-width: clamp(30px, 3.4vw, 40px);
        height: clamp(30px, 3.4vw, 40px);
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #5b3818;
        background: linear-gradient(180deg, #fff8d9 0%, #ffe8a8 100%);
        border: 3px solid rgba(255, 255, 255, 0.82);
        outline: 2px solid rgba(128, 87, 33, 0.18);
        font-size: clamp(19px, 2.3vw, 29px);
        font-weight: 950;
        line-height: 1;
        text-shadow: 0 2px 0 rgba(255,255,255,0.78);
        box-shadow:
          0 3px 0 rgba(144, 84, 31, 0.12),
          inset 0 -3px 0 rgba(165, 102, 31, 0.10);
      }

      .lb-doorplate-red span {
        background: linear-gradient(180deg, #ffe5df 0%, #ffb0a4 100%);
        color: #9e3328;
        outline-color: rgba(177, 56, 42, 0.26);
      }

      .lb-doorplate-blue span {
        background: linear-gradient(180deg, #e5f3ff 0%, #b9dcff 100%);
        color: #1f5f9f;
        outline-color: rgba(39, 99, 170, 0.26);
      }

      .lb-doorplate:hover:not(:disabled) {
        transform: translate(-50%, -50%) scale(1.055);
        filter: brightness(1.06) drop-shadow(0 0 12px rgba(255, 226, 94, 0.48));
      }

      .lb-doorplate.is-completed {
        opacity: 0.86;
        filter:
          brightness(1.08)
          drop-shadow(0 0 14px rgba(255, 221, 86, 0.70));
      }

      .lb-doorplate.is-correct {
        transform: translate(-50%, -50%) scale(1.14);
        filter:
          brightness(1.15)
          drop-shadow(0 0 18px rgba(255, 212, 73, 0.95));
      }

      .lb-doorplate.is-wrong {
        animation: lbShake 0.30s ease;
        filter:
          brightness(0.95)
          drop-shadow(0 0 16px rgba(255, 95, 95, 0.90));
      }

      .lb-game-footer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        flex: 0 0 auto;
      }

      .lb-message {
        min-width: 0;
        min-height: 58px;
        padding: 10px 18px;
        border-radius: 26px;
        background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,249,230,0.92));
        border: 4px solid #f0c77b;
        color: #674522;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        box-shadow:
          0 8px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.32);
      }

      .lb-message strong {
        font-size: clamp(15px, 1.7vw, 20px);
        font-weight: 900;
        overflow-wrap: anywhere;
      }

      .lb-message span {
        flex: 0 0 auto;
        min-width: 70px;
        text-align: center;
        padding: 7px 12px;
        border-radius: 999px;
        background: linear-gradient(180deg, #fff5c9, #ffe28c);
        color: #8a531d;
        font-size: clamp(16px, 1.8vw, 22px);
        font-weight: 950;
        box-shadow: inset 0 -3px 0 rgba(140, 92, 35, 0.12);
      }

      .lb-submit-button {
        min-width: clamp(150px, 16vw, 210px);
        min-height: 58px;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        box-shadow: none;
        overflow: visible;
        white-space: nowrap;
      }

      .lb-submit-button img {
        display: block;
        width: 100%;
        max-height: 72px;
        object-fit: contain;
        filter: drop-shadow(0 7px 0 rgba(55, 119, 33, 0.3));
        pointer-events: none;
      }

      @keyframes lbFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }

      @keyframes lbPop {
        0% { transform: scale(1); }
        55% { transform: scale(1.12); }
        100% { transform: scale(1); }
      }

      @keyframes lbShake {
        0%, 100% { transform: translate(-50%, -50%); }
        25% { transform: translate(calc(-50% - 7px), -50%); }
        75% { transform: translate(calc(-50% + 7px), -50%); }
      }

      @keyframes lbChipShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-7px); }
        75% { transform: translateX(7px); }
      }

      @media (max-width: 920px) {
        .lb-simple-card {
          width: calc(100vw - 20px);
          max-width: calc(100vw - 20px);
          height: calc(100dvh - 20px);
          padding: 22px 24px;
          grid-template-columns: minmax(150px, 0.72fr) minmax(0, 1.28fr);
          gap: 22px;
          border-radius: 34px;
          outline-offset: -9px;
        }

        .lb-intro-sheep {
          width: min(190px, 23vw);
          max-height: 220px;
        }

        .lb-intro-card h1,
        .lb-stage-card h1,
        .lb-game-top h1 {
          font-size: clamp(27px, 4.4vw, 40px);
        }

        .lb-intro-text,
        .lb-stage-card p,
        .lb-game-top p,
        .lb-tutorial-text {
          font-size: clamp(15px, 2vw, 19px);
        }

  
      .lb-rule-card {
        width: 100%;
        padding: clamp(8px, 1.2vw, 14px) clamp(14px, 1.9vw, 22px);
        border: 4px solid #f0c77b;
        border-radius: 26px;
        background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
        box-shadow:
          0 7px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.35);
      }

      .lb-rule-icons {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: clamp(8px, 1vw, 12px);
      }

      .lb-rule-icons span {
        min-width: 34px;
        min-height: 34px;
        padding: 4px 9px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 245, 201, 0.82);
        color: #744018;
        font-size: clamp(17px, 1.9vw, 25px);
        font-weight: 950;
        box-shadow: inset 0 -2px 0 rgba(140, 92, 35, 0.10);
      }

      .lb-rule-icons span.is-arrow {
        min-width: auto;
        background: transparent;
        box-shadow: none;
        padding-inline: 0;
      }

      .lb-rule-icons span.is-red {
        color: #9a2f2f;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #ffdddd 0%, #f36f63 100%);
        border: 3px solid rgba(229, 77, 68, 0.58);
      }

      .lb-rule-icons span.is-blue {
        color: #16517e;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #dff2ff 0%, #65aee6 100%);
        border: 3px solid rgba(63, 144, 213, 0.58);
      }

      .lb-tutorial-board {          gap: 8px;
          padding: 12px;
        }

        .lb-tutorial-chip {
          min-height: 56px;
          font-size: clamp(21px, 3.2vw, 29px);
          border-radius: 20px;
        }

        .lb-primary-button,
        .lb-secondary-button {
          min-width: 116px;
          min-height: 50px;
          padding: 9px 18px;
          font-size: clamp(17px, 2.4vw, 23px);
        }

        .lb-game-card {
          width: calc(100vw - 20px);
          max-width: calc(100vw - 20px);
          height: calc(100dvh - 20px);
          padding: 15px;
          border-radius: 34px;
          outline-offset: -9px;
        }

        .lb-doorplate {
          width: clamp(48px, 6.5vw, 62px);
          height: clamp(48px, 6.5vw, 62px);
        }

        .lb-doorplate span {
          min-width: 28px;
          height: 28px;
          font-size: 19px;
          border-width: 2px;
        }
      }

      @media (max-height: 650px) {
        .lb-simple-card {
          height: calc(100dvh - 20px);
          padding-top: 18px;
          padding-bottom: 18px;
          gap: 20px;
        }

        .lb-tutorial-content {
          gap: 7px;
        }

        .lb-intro-sheep {
          max-height: 190px;
        }

        .lb-tutorial-chip {
          min-height: 50px;
          font-size: clamp(20px, 2.5vw, 28px);
        }

        .lb-tutorial-text {
          padding-top: 9px;
          padding-bottom: 9px;
        }

        .lb-primary-button,
        .lb-secondary-button {
          min-height: 46px;
        }

        .lb-game-card {
          height: calc(100dvh - 20px);
          padding: 14px;
          gap: 9px;
        }

        .lb-game-top p:not(.lb-kicker) {
          display: none;
        }

        .lb-message,
        .lb-submit-button {
          min-height: 52px;
        }
      }

      @media (max-width: 720px) {
        .lb-simple-page {
          overflow: hidden;
        }

        .lb-simple-card {
          grid-template-columns: minmax(96px, 0.55fr) minmax(0, 1.45fr);
          padding: 18px;
          gap: 14px;
        }

        .lb-intro-sheep,
        .lb-stage-home {
          width: min(132px, 23vw);
          max-height: 160px;
        }

        .lb-kicker {
          font-size: 12px;
          padding: 5px 12px;
        }

  
      .lb-rule-card {
        width: 100%;
        padding: clamp(8px, 1.2vw, 14px) clamp(14px, 1.9vw, 22px);
        border: 4px solid #f0c77b;
        border-radius: 26px;
        background: linear-gradient(180deg, #ffffff 0%, #fff9e9 100%);
        box-shadow:
          0 7px 0 rgba(225, 169, 84, 0.12),
          inset 0 0 0 5px rgba(255, 235, 174, 0.35);
      }

      .lb-rule-icons {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: clamp(8px, 1vw, 12px);
      }

      .lb-rule-icons span {
        min-width: 34px;
        min-height: 34px;
        padding: 4px 9px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 245, 201, 0.82);
        color: #744018;
        font-size: clamp(17px, 1.9vw, 25px);
        font-weight: 950;
        box-shadow: inset 0 -2px 0 rgba(140, 92, 35, 0.10);
      }

      .lb-rule-icons span.is-arrow {
        min-width: auto;
        background: transparent;
        box-shadow: none;
        padding-inline: 0;
      }

      .lb-rule-icons span.is-red {
        color: #9a2f2f;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #ffdddd 0%, #f36f63 100%);
        border: 3px solid rgba(229, 77, 68, 0.58);
      }

      .lb-rule-icons span.is-blue {
        color: #16517e;
        background:
          radial-gradient(circle at 38% 34%, rgba(255,255,255,0.78) 0 16%, transparent 17%),
          linear-gradient(180deg, #dff2ff 0%, #65aee6 100%);
        border: 3px solid rgba(63, 144, 213, 0.58);
      }

      .lb-tutorial-board {          border-width: 3px;
          border-radius: 22px;
          padding: 9px;
        }

        .lb-tutorial-chip {
          min-height: 48px;
          border-width: 3px;
          outline-width: 2px;
          border-radius: 18px;
        }

        .lb-tutorial-message {
          font-size: 13px;
        }

        .lb-tutorial-actions {
          gap: 8px;
        }

        .lb-primary-button,
        .lb-secondary-button {
          min-width: 96px;
          min-height: 44px;
          padding: 8px 12px;
          border-width: 3px;
          outline-width: 2px;
          border-radius: 18px;
          font-size: 16px;
        }

        .lb-game-footer {
          grid-template-columns: 1fr auto;
          gap: 9px;
        }

        .lb-message {
          padding: 8px 12px;
          border-radius: 22px;
        }

        .lb-message strong {
          font-size: 14px;
        }

        .lb-message span {
          min-width: 58px;
          font-size: 16px;
        }

        .lb-submit-button {
          min-width: 116px;
          padding: 8px 14px;
          font-size: 17px;
        }
      }
    


      /* SRT-aligned additions: video button below frame, result stars floating above card */
      .lb-srt-skin {
        text-align: center;
        color: #4b2c16;
        user-select: none;
        -webkit-user-select: none;
      }

      .lb-center-shell {
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

      .lb-start-shell,
      .lb-result-shell {
        width: min(72vw, 900px);
      }

      .lb-soft-panel {
        width: 100%;
        position: relative;
        box-sizing: border-box;
        border: 7px solid #f6a51f;
        border-radius: 58px;
        background: linear-gradient(180deg, rgba(255, 252, 225, 0.98), rgba(255, 237, 168, 0.98));
        box-shadow:
          0 18px 0 rgba(202, 116, 24, 0.13),
          0 24px 42px rgba(95, 64, 22, 0.16),
          inset 0 0 0 8px rgba(255, 255, 255, 0.45),
          inset 0 0 0 16px rgba(255, 215, 105, 0.20);
      }

      .lb-soft-panel::before {
        content: "";
        position: absolute;
        inset: 18px;
        border-radius: 42px;
        border: 2px dashed rgba(230, 170, 67, 0.42);
        pointer-events: none;
      }

      .lb-start-panel,
      .lb-result-panel {
        min-height: 520px;
        padding: 58px 70px 74px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 30px;
      }

      .lb-game-title {
        position: relative;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: min(100%, 420px);
        padding: 14px 42px 16px;
        border-radius: 20px;
        border: 4px solid #e9a33c;
        background: linear-gradient(180deg, rgba(255, 226, 129, 0.96), rgba(255, 244, 194, 0.98));
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

      .lb-start-content {
        position: relative;
        z-index: 2;
        width: min(100%, 690px);
        display: grid;
        grid-template-columns: minmax(300px, 1fr) 158px;
        align-items: center;
        justify-content: center;
        gap: 44px;
      }

      .lb-dialog-bubble {
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

      .lb-dialog-bubble::before {
        content: "";
        position: absolute;
        inset: 13px;
        border-radius: 20px;
        border: 2px dashed rgba(229, 189, 119, 0.55);
        pointer-events: none;
      }

      .lb-dialog-bubble::after {
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

      .lb-round-icon {
        position: relative;
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

      .lb-round-icon img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }

      .lb-forest-button {
        position: relative;
        z-index: 2;
        border: 0;
        background: transparent;
        cursor: pointer;
        transition: transform 0.14s ease, filter 0.14s ease;
      }

      .lb-image-button {
        min-width: 0;
        min-height: 0;
        padding: 0;
      }

      .lb-image-button img {
        display: block;
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 8px 0 rgba(112, 78, 25, 0.12)) drop-shadow(0 14px 20px rgba(91, 57, 18, 0.18));
        transition: transform 0.14s ease, filter 0.14s ease;
        pointer-events: none;
      }

      .lb-image-button:hover img {
        transform: translateY(-3px) scale(1.03);
        filter: drop-shadow(0 10px 0 rgba(112, 78, 25, 0.10)) drop-shadow(0 18px 24px rgba(91, 57, 18, 0.22)) brightness(1.05);
      }

      .lb-image-button:active img { transform: translateY(2px) scale(0.99); }
      .lb-btn-start img { width: clamp(210px, 23vw, 300px); }
      .lb-btn-skip img { width: clamp(154px, 16vw, 224px); }
      .lb-btn-home img,
      .lb-btn-replay img,
      .lb-btn-detail img { width: clamp(136px, 15vw, 188px); }

      .lb-guided-action {
        position: relative;
        z-index: 3;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .lb-mouse-guide {
        position: absolute;
        width: clamp(58px, 7vw, 92px);
        height: auto;
        object-fit: contain;
        pointer-events: none;
        z-index: 4;
        filter: drop-shadow(0 8px 10px rgba(73, 48, 18, 0.20));
        animation: lbMouseTap 1.18s ease-in-out infinite;
      }

      .lb-mouse-on-button { right: -28px; bottom: -22px; }

      .lb-video-panel {
        width: min(84vw, 1120px);
        padding: 32px 34px 28px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        overflow: visible;
      }

      .lb-video-frame {
        position: relative;
        z-index: 2;
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 38px;
        overflow: hidden;
        background: rgba(255, 245, 210, 0.82);
        border: 5px solid rgba(255, 255, 255, 0.72);
        outline: 3px solid rgba(230, 170, 67, 0.42);
        box-shadow: inset 0 0 0 8px rgba(255, 220, 120, 0.20), 0 18px 30px rgba(76, 53, 22, 0.15);
      }

      .lb-video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }

      .lb-guided-skip {
        position: relative;
        right: auto;
        bottom: auto;
        margin-top: 4px;
        align-self: center;
      }

      .lb-result-panel {
        min-height: 470px;
        overflow: visible;
        padding-top: 112px;
      }

      .lb-cute-stars {
        position: absolute;
        left: 50%;
        top: -95px;
        z-index: 5;
        transform: translateX(-50%);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        gap: clamp(18px, 3.2vw, 48px);
        pointer-events: none;
      }

      .lb-cute-star {
        font-size: clamp(92px, 10vw, 148px);
        line-height: 1;
        color: rgba(255, 255, 255, 0.90);
        -webkit-text-stroke: 6px rgba(255, 255, 255, 0.96);
        text-shadow: 10px 15px 0 rgba(80, 77, 58, 0.10), 0 18px 20px rgba(71, 69, 50, 0.18);
        transform: rotate(-8deg) scale(0.94);
      }

      .lb-cute-star:nth-child(2) {
        transform: translateY(-48px) scale(1.08);
      }

      .lb-cute-star:nth-child(3) {
        transform: rotate(8deg) scale(0.94);
      }

      .lb-cute-star.is-on {
        color: #ffd83f;
        -webkit-text-stroke: 6px rgba(255, 246, 206, 0.98);
        text-shadow: 8px 12px 0 rgba(213, 159, 37, 0.18), 0 18px 24px rgba(255, 205, 58, 0.26);
      }

      .lb-result-content { margin: 6px 0 10px; }

      .lb-result-actions {
        position: relative;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: clamp(12px, 2vw, 26px);
        flex-wrap: wrap;
      }

      /* 正式遊戲畫面：移除大型卡片與綠色內框，門牌、路線及小屋直接放在森林背景上。 */
      .lb-playing-panel {
        width: 100%;
        max-width: none;
        height: 100%;
        min-height: 0;
        padding: 0;
        border: 0;
        outline: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        overflow: visible;
        gap: 0;
      }

      .lb-playing-panel::before,
      .lb-playing-panel::after {
        display: none;
      }

      .lb-playing-panel .lb-game-top {
        display: none;
      }

      .lb-playing-panel .lb-progress-wrap {
        display: none;
      }

      .lb-playing-panel .lb-play-board {
        position: absolute;
        inset: 28px 34px 96px;
        min-height: 0;
        height: auto;
        border: 0;
        outline: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        overflow: visible;
      }

      .lb-playing-panel .lb-play-board::before,
      .lb-playing-panel .lb-play-board::after {
        display: none;
      }

      .lb-playing-panel .lb-map-home {
        right: 2%;
        bottom: 0;
        width: clamp(118px, 14vw, 188px);
        max-height: 188px;
        mix-blend-mode: multiply;
        filter: drop-shadow(0 12px 14px rgba(54, 82, 42, 0.26));
      }

      .lb-playing-panel .lb-doorplate {
        width: clamp(66px, 7.8vw, 104px);
        height: clamp(66px, 7.8vw, 104px);
      }

      .lb-playing-panel .lb-game-footer {
        position: fixed;
        z-index: 20;
        left: 50%;
        right: auto;
        bottom: clamp(14px, 2.4vh, 28px);
        transform: translateX(-50%);
        width: min(92vw, 680px);
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: clamp(10px, 1.6vw, 16px);
        pointer-events: none;
      }

      .lb-playing-panel .lb-message {
        flex: 1 1 auto;
        min-height: clamp(50px, 5.6vh, 66px);
        padding: 8px 14px;
        pointer-events: none;
      }

      .lb-playing-panel .lb-submit-button {
        min-width: clamp(168px, 15vw, 230px);
        min-height: clamp(56px, 6.2vh, 76px);
        pointer-events: auto;
      }

      .lb-playing-panel .lb-undo-button {
        min-width: clamp(82px, 9vw, 112px);
        min-height: clamp(48px, 5.4vh, 62px);
        pointer-events: auto;
      }

      @media (max-width: 760px) {
        .lb-playing-panel .lb-play-board {
          inset: 18px 12px 92px;
        }

        .lb-playing-panel .lb-game-footer {
          bottom: 12px;
          width: 96vw;
          gap: 8px;
        }

        .lb-playing-panel .lb-submit-button {
          min-width: 128px;
        }

        .lb-playing-panel .lb-undo-button {
          min-width: 76px;
          padding-inline: 12px;
        }
      }

      @keyframes lbMouseTap {
        0%, 100% { transform: translate(0, 0) rotate(-6deg) scale(1); }
        50% { transform: translate(-8px, -8px) rotate(-10deg) scale(1.04); }
      }

      @media (max-width: 1024px) {
        .lb-start-shell, .lb-result-shell { width: min(88vw, 860px); }
        .lb-start-panel, .lb-result-panel { padding-inline: 42px; }
        .lb-start-content { grid-template-columns: minmax(240px, 1fr) 134px; gap: 30px; }
        .lb-round-icon { width: 134px; height: 134px; }
        .lb-cute-stars { top: -76px; }
        .lb-cute-star { font-size: clamp(82px, 11vw, 126px); }
        .lb-cute-star:nth-child(2) { transform: translateY(-38px) scale(1.08); }
      }

      @media (max-width: 768px) {
        .lb-center-shell { width: min(94vw, 720px); padding: 16px 0; }
        .lb-start-shell, .lb-result-shell { width: 94vw; }
        .lb-start-panel, .lb-result-panel { min-height: 0; padding: 34px 24px 54px; border-radius: 40px; }
        .lb-result-panel { padding-top: 86px; }
        .lb-start-content, .lb-result-content { grid-template-columns: 1fr; justify-items: center; gap: 18px; }
        .lb-dialog-bubble::after { display: none; }
        .lb-round-icon { width: 116px; height: 116px; }
        .lb-video-panel { width: 94vw; padding: 20px 18px 20px; border-radius: 38px; }
        .lb-video-frame { border-radius: 26px; }
        .lb-cute-stars { top: -52px; gap: 12px; }
        .lb-cute-star { font-size: 78px; -webkit-text-stroke-width: 4px; }
        .lb-cute-star:nth-child(2) { transform: translateY(-24px) scale(1.05); }
        .lb-result-actions { gap: 10px; }
      }


      @media (max-width: 760px) {
        .lb-stage-open {
          grid-template-columns: 1fr;
          min-height: auto;
          gap: 18px;
          text-align: center;
        }

        .lb-stage-open .lb-stage-home {
          width: min(230px, 58vw);
          margin-inline: auto;
        }

        .lb-stage-open-content {
          align-items: center;
          text-align: center;
        }
      }
    `}</style>
  );
}

export default TestPageLB;
