// src/pages/TrainingPage_LB.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/GamePage_LB.css";

import backgroundImg from "../asset/LB/background.png";
import sheepImg from "../asset/LB/sheep.png";
import homeImg from "../asset/LB/home.png";
import houseNumber01Img from "../asset/LB/house number_01.png";
import introVideo from "../asset/SRT_start.mp4";
import endingVideo from "../asset/SRT_start.mp4";
import homeStartBtn from "../asset/home/start.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";

/*
  =========================================================
  TrainingPage_LB.jsx
  Linking Balloons｜綿羊奶奶回家小路訓練頁（初版）

  訓練版設計重點：
  - 與 TestPage_LB.jsx 使用同一套 LB 素材與門牌互動。
  - 訓練版允許提示、重試、任務變體與溫和錯誤回饋。
  - 初版包含 12 個小關卡：順序、倒序、紅藍規則、混合任務。
  - taskType 支援：guidePath / findSequence / memoryPath / distractorDoors / ruleSwitch / mixedMission。
  - 訓練資料存入 sessionStorage: LB_TRAINING_RESULT 與 localStorage: lbTrainingResult。
  - 修正過關判定：用 nextCompleted.length 即時計算，避免 React state 非同步造成跳關。
  - 修正 RT 起點：引導結束、門牌解鎖並完成畫面繪製後才重設 stepStartTimeRef。
  - 所有提示、錯誤鎖定、預覽、回顧動畫 timer 都集中 useRef 管理並在跳關/卸載時清除。
  =========================================================
*/

const RESULT_ROUTE = "/result-lb";
const SESSION_KEY = "LB_TRAINING_RESULT";
const LOCAL_KEY = "lbTrainingResult";

const TRAINING_CONFIG = {
  mode: "training",
  difficulty: "adaptive",
  hintDelayMs: 3200,
  feedbackDelayCorrectMs: 420,
  feedbackDelayWrongMs: 680,
  reviewStepMs: 520,
};

const TASK_TYPES = {
  GUIDE_PATH: "guidePath",
  FIND_SEQUENCE: "findSequence",
  MEMORY_PATH: "memoryPath",
  DISTRACTOR_DOORS: "distractorDoors",
  RULE_SWITCH: "ruleSwitch",
  MIXED_MISSION: "mixedMission",
};

const RULE_TYPES = {
  FORWARD: "forward",
  BACKWARD: "backward",
  RED_BLUE: "redBlue",
  BLUE_RED: "blueRed",
};

const DOORPLATE_POSITIONS_5 = [
  { x: 22, y: 64, r: -5 },
  { x: 38, y: 45, r: 4 },
  { x: 52, y: 65, r: -3 },
  { x: 66, y: 44, r: 5 },
  { x: 80, y: 62, r: -4 },
];

const DOORPLATE_POSITIONS_10 = [
  { x: 23, y: 64, r: -5 },
  { x: 34, y: 49, r: 4 },
  { x: 46, y: 66, r: -3 },
  { x: 58, y: 50, r: 5 },
  { x: 70, y: 63, r: -4 },
  { x: 79, y: 48, r: 4 },
  { x: 24, y: 34, r: 3 },
  { x: 40, y: 25, r: -4 },
  { x: 60, y: 29, r: 4 },
  { x: 76, y: 33, r: -3 },
];

const DOORPLATE_POSITIONS_20 = [
  { x: 21, y: 65, r: -5 },
  { x: 31, y: 53, r: 4 },
  { x: 41, y: 67, r: -3 },
  { x: 51, y: 54, r: 5 },
  { x: 61, y: 66, r: -5 },
  { x: 71, y: 52, r: 4 },
  { x: 80, y: 63, r: -4 },
  { x: 78, y: 40, r: 5 },
  { x: 20, y: 43, r: 3 },
  { x: 29, y: 30, r: -4 },
  { x: 39, y: 41, r: 4 },
  { x: 49, y: 28, r: -3 },
  { x: 59, y: 40, r: 5 },
  { x: 69, y: 30, r: -4 },
  { x: 79, y: 27, r: 2 },
  { x: 27, y: 74, r: 3 },
  { x: 47, y: 76, r: -2 },
  { x: 67, y: 74, r: 4 },
  { x: 36, y: 20, r: 2 },
  { x: 64, y: 20, r: -2 },
];

const HOME_PATH_POINT = {
  key: "home",
  number: null,
  color: "home",
  label: "home",
  position: { x: 92, y: 78, r: 0 },
};

const TRAINING_LEVELS = [
  {
    id: "1-1",
    chapter: "數字小路",
    title: "跟著腳印走",
    ruleType: RULE_TYPES.FORWARD,
    taskType: TASK_TYPES.GUIDE_PATH,
    maxNumber: 5,
    sequenceLength: 5,
    hintMode: "always",
    iconHint: "1 → 2 → 3",
    ability: "順序理解、視覺搜尋",
  },
  {
    id: "1-2",
    chapter: "數字小路",
    title: "自己找門牌",
    ruleType: RULE_TYPES.FORWARD,
    taskType: TASK_TYPES.FIND_SEQUENCE,
    maxNumber: 10,
    sequenceLength: 10,
    hintMode: "delay",
    iconHint: "1 → 10",
    ability: "持續注意、順序搜尋",
  },
  {
    id: "1-3",
    chapter: "數字小路",
    title: "記住亮過的路",
    ruleType: RULE_TYPES.FORWARD,
    taskType: TASK_TYPES.MEMORY_PATH,
    maxNumber: 7,
    sequenceLength: 7,
    previewMs: 3000,
    hintMode: "afterWrong",
    hintAfterWrong: 2,
    iconHint: "看 → 記 → 點",
    ability: "工作記憶、順序保持",
  },
  {
    id: "1-4",
    chapter: "數字小路",
    title: "避開假門牌",
    ruleType: RULE_TYPES.FORWARD,
    taskType: TASK_TYPES.DISTRACTOR_DOORS,
    maxNumber: 10,
    sequenceLength: 10,
    distractorCount: 4,
    hintMode: "afterWrong",
    hintAfterWrong: 2,
    iconHint: "1 → 10  ✕ ?",
    ability: "抑制控制、視覺辨識",
  },
  {
    id: "2-1",
    chapter: "回家的倒路",
    title: "倒著走示範",
    ruleType: RULE_TYPES.BACKWARD,
    taskType: TASK_TYPES.GUIDE_PATH,
    maxNumber: 10,
    startNumber: 10,
    sequenceLength: 5,
    hintMode: "always",
    iconHint: "10 → 9 → 8",
    ability: "倒序概念、規則轉換",
  },
  {
    id: "2-2",
    chapter: "回家的倒路",
    title: "倒序找門牌",
    ruleType: RULE_TYPES.BACKWARD,
    taskType: TASK_TYPES.FIND_SEQUENCE,
    maxNumber: 10,
    sequenceLength: 10,
    hintMode: "delay",
    iconHint: "10 → 1",
    ability: "工作記憶、抑制順序習慣",
  },
  {
    id: "2-3",
    chapter: "回家的倒路",
    title: "門牌會換位置",
    ruleType: RULE_TYPES.BACKWARD,
    taskType: TASK_TYPES.MIXED_MISSION,
    maxNumber: 10,
    sequenceLength: 10,
    shuffleAfterSteps: [3, 6],
    hintMode: "afterWrong",
    hintAfterWrong: 2,
    iconHint: "10 → 1  ↻",
    ability: "重新搜尋、抗干擾",
  },
  {
    id: "3-1",
    chapter: "紅藍換換路",
    title: "紅色再藍色",
    ruleType: RULE_TYPES.RED_BLUE,
    taskType: TASK_TYPES.RULE_SWITCH,
    maxNumber: 3,
    sequenceLength: 6,
    hintMode: "always",
    iconHint: "紅1 → 藍1 → 紅2",
    ability: "顏色切換、規則配對",
  },
  {
    id: "3-2",
    chapter: "紅藍換換路",
    title: "藍色先出發",
    ruleType: RULE_TYPES.BLUE_RED,
    taskType: TASK_TYPES.RULE_SWITCH,
    maxNumber: 5,
    sequenceLength: 10,
    hintMode: "delay",
    iconHint: "藍1 → 紅1 → 藍2",
    ability: "認知彈性、規則切換",
  },
  {
    id: "3-3",
    chapter: "紅藍換換路",
    title: "紅藍完整挑戰",
    ruleType: RULE_TYPES.RED_BLUE,
    taskType: TASK_TYPES.RULE_SWITCH,
    maxNumber: 10,
    sequenceLength: 20,
    hintMode: "afterWrong",
    hintAfterWrong: 2,
    iconHint: "紅 → 藍 → 紅 → 藍",
    ability: "雙規則維持、認知彈性",
  },
  {
    id: "4-1",
    chapter: "森林任務",
    title: "任務卡：倒著紅藍",
    ruleType: RULE_TYPES.RED_BLUE,
    taskType: TASK_TYPES.MIXED_MISSION,
    maxNumber: 5,
    reverseNumbers: true,
    sequenceLength: 10,
    distractorCount: 2,
    hintMode: "afterWrong",
    hintAfterWrong: 2,
    iconHint: "紅5 → 藍5 → 紅4",
    ability: "混合規則、彈性轉換",
  },
  {
    id: "4-2",
    chapter: "森林任務",
    title: "森林綜合挑戰",
    ruleType: RULE_TYPES.RED_BLUE,
    taskType: TASK_TYPES.MIXED_MISSION,
    maxNumber: 6,
    sequenceLength: 12,
    distractorCount: 4,
    shuffleAfterSteps: [4, 8],
    hintMode: "afterWrong",
    hintAfterWrong: 2,
    iconHint: "看規則 → 找門牌",
    ability: "綜合執行功能",
  },
];

function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getPositionsForCount(count) {
  if (count <= 5) return DOORPLATE_POSITIONS_5;
  if (count <= 10) return DOORPLATE_POSITIONS_10;
  return DOORPLATE_POSITIONS_20;
}

function withDoorplateMeta(items, positions) {
  return items.map((item, index) => ({
    ...item,
    plateImg: houseNumber01Img,
    position: positions[index % positions.length],
  }));
}

function buildForwardSequence(maxNumber, length) {
  return Array.from({ length: Math.min(maxNumber, length) }, (_, index) => ({
    key: `n-${index + 1}`,
    number: index + 1,
    color: "cream",
    label: `${index + 1}`,
    expectedColor: null,
  }));
}

function buildBackwardSequence(maxNumber, length, startNumber = maxNumber) {
  return Array.from({ length: Math.min(startNumber, length) }, (_, index) => ({
    key: `n-${startNumber - index}`,
    number: startNumber - index,
    color: "cream",
    label: `${startNumber - index}`,
    expectedColor: null,
  }));
}

function buildColorSequence({ maxNumber, ruleType, reverseNumbers = false, length }) {
  const numbers = Array.from({ length: maxNumber }, (_, index) => index + 1);
  const orderedNumbers = reverseNumbers ? numbers.reverse() : numbers;
  const pairColors = ruleType === RULE_TYPES.BLUE_RED ? ["blue", "red"] : ["red", "blue"];
  const sequence = orderedNumbers.flatMap((number) =>
    pairColors.map((color) => ({
      key: `${color}-${number}`,
      number,
      color,
      label: `${number}`,
      expectedColor: color,
    }))
  );

  return sequence.slice(0, length || sequence.length);
}

function buildSequence(level) {
  if (level.ruleType === RULE_TYPES.FORWARD) {
    return buildForwardSequence(level.maxNumber, level.sequenceLength);
  }

  if (level.ruleType === RULE_TYPES.BACKWARD) {
    return buildBackwardSequence(level.maxNumber, level.sequenceLength, level.startNumber || level.maxNumber);
  }

  return buildColorSequence({
    maxNumber: level.maxNumber,
    ruleType: level.ruleType,
    reverseNumbers: level.reverseNumbers,
    length: level.sequenceLength,
  });
}

function buildDisplayItems(level) {
  const sequence = buildSequence(level);
  let baseItems = [];

  if (level.ruleType === RULE_TYPES.FORWARD || level.ruleType === RULE_TYPES.BACKWARD) {
    baseItems = Array.from({ length: level.maxNumber }, (_, index) => ({
      key: `n-${index + 1}`,
      number: index + 1,
      color: "cream",
      label: `${index + 1}`,
      expectedColor: null,
    }));
  } else {
    baseItems = Array.from({ length: level.maxNumber }, (_, index) => {
      const number = index + 1;
      return [
        { key: `red-${number}`, number, color: "red", label: `${number}`, expectedColor: "red" },
        { key: `blue-${number}`, number, color: "blue", label: `${number}`, expectedColor: "blue" },
      ];
    }).flat();
  }

  const distractors = Array.from({ length: level.distractorCount || 0 }, (_, index) => ({
    key: `fake-${level.id}-${index + 1}`,
    number: index % 2 === 0 ? "?" : level.maxNumber + index + 1,
    color: "fake",
    label: index % 2 === 0 ? "?" : `${level.maxNumber + index + 1}`,
    expectedColor: null,
    isDistractor: true,
  }));

  const items = shuffleItems([...baseItems, ...distractors]);
  return withDoorplateMeta(items, getPositionsForCount(items.length));
}

function getExpectedText(expectedItem) {
  if (!expectedItem) return "";
  if (expectedItem.expectedColor === "red") return `紅色 ${expectedItem.number}`;
  if (expectedItem.expectedColor === "blue") return `藍色 ${expectedItem.number}`;
  return `${expectedItem.number}`;
}

function getRuleIcon(level) {
  if (level.ruleType === RULE_TYPES.FORWARD) return "① → ② → ③";
  if (level.ruleType === RULE_TYPES.BACKWARD) return "⑩ → ⑨ → ⑧";
  if (level.ruleType === RULE_TYPES.BLUE_RED) return "🔵1 → 🔴1 → 🔵2";
  if (level.reverseNumbers) return "🔴5 → 🔵5 → 🔴4";
  return "🔴1 → 🔵1 → 🔴2";
}

function isCorrectStep(clickedItem, expectedItem) {
  if (!clickedItem || !expectedItem || clickedItem.isDistractor) return false;
  const clickedNumber = Number(clickedItem.number);
  const expectedNumber = Number(expectedItem.number);
  if (clickedNumber !== expectedNumber) return false;
  if (expectedItem.expectedColor && clickedItem.color !== expectedItem.expectedColor) return false;
  return true;
}

function getWrongType(clickedItem, expectedItem) {
  if (!clickedItem) return "blankClick";
  if (clickedItem.isDistractor) return "distractorClick";
  if (expectedItem?.expectedColor) {
    if (clickedItem.number === expectedItem.number && clickedItem.color !== expectedItem.expectedColor) {
      return "colorError";
    }
    if (clickedItem.color === expectedItem.expectedColor && clickedItem.number !== expectedItem.number) {
      return "numberError";
    }
    return "ruleSwitchError";
  }
  return "sequenceError";
}

function summarizeLogs(logs) {
  const correctLogs = logs.filter((log) => log.isCorrect);
  const wrongLogs = logs.filter((log) => !log.isCorrect);
  const hintCount = logs.filter((log) => log.hintShown).length;
  const reactionTimes = correctLogs.map((log) => log.rt).filter((rt) => typeof rt === "number" && rt > 0);
  const avgReactionTime = reactionTimes.length
    ? Math.round(reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length)
    : 0;

  const errorTypes = wrongLogs.reduce((acc, log) => {
    const key = log.wrongType || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const accuracy = logs.length ? Math.round((correctLogs.length / logs.length) * 100) : 0;
  const stars = accuracy >= 85 ? 3 : accuracy >= 60 ? 2 : 1;

  return {
    accuracy,
    stars,
    correctTrials: correctLogs.length,
    wrongTrials: wrongLogs.length,
    hintCount,
    avgReactionTime,
    errorTypes,
  };
}

function DoorplateButton({
  item,
  disabled,
  completed,
  activeWrong,
  activeCorrect,
  activeHint,
  memoryHidden,
  onClick,
}) {
  const numberText = memoryHidden && !completed && !activeHint ? "" : item.label;

  return (
    <button
      type="button"
      className={[
        "lb-doorplate-node",
        "lb-number-node",
        `lb-doorplate-node-${item.color}`,
        `lb-number-node-${item.color}`,
        item.isDistractor ? "lb-training-distractor-node" : "",
        completed ? "lb-doorplate-node-completed lb-number-node-completed" : "",
        activeCorrect ? "lb-doorplate-node-correct-flash lb-training-correct" : "",
        activeWrong ? "lb-doorplate-node-wrong lb-number-node-wrong" : "",
        activeHint ? "lb-training-hint-target" : "",
        memoryHidden ? "lb-training-memory-hidden" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        item.position
          ? {
              "--door-x": `${item.position.x}%`,
              "--door-y": `${item.position.y}%`,
              "--door-r": `${item.position.r || 0}deg`,
            }
          : undefined
      }
      disabled={disabled || completed}
      onClick={(event) => {
        event.stopPropagation();
        onClick(item);
      }}
      aria-label={`${item.color === "red" ? "紅色" : item.color === "blue" ? "藍色" : "門牌"}${item.label}`}
    >
      <img src={item.plateImg} alt="" className="lb-doorplate-art" draggable="false" aria-hidden="true" />
      <span className="lb-doorplate-number">{numberText}</span>
    </button>
  );
}

function LBPathOverlay({ points, active = true }) {
  if (!points || points.length < 2) return null;

  const polylinePoints = points
    .map((item) => `${item.position?.x || 50},${item.position?.y || 50}`)
    .join(" ");

  return (
    <svg className="lb-connect-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline className={active ? "lb-connect-line lb-connect-line-active" : "lb-connect-line"} points={polylinePoints} />
    </svg>
  );
}

function WalkingPerson({ point }) {
  if (!point?.position) return null;

  return (
    <img
      src={sheepImg}
      alt="綿羊奶奶走路"
      className="lb-walking-person"
      draggable="false"
      style={{
        "--person-x": `${point.position.x}%`,
        "--person-y": `${point.position.y}%`,
      }}
    />
  );
}

function TrainingInlineStyle() {
  return (
    <style>{`
      html, body, #root {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      .lb-page {
        width: 100vw !important;
        height: 100vh !important;
        height: 100svh !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      .lb-page-with-bg {
        background-image: var(--lb-bg-image) !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
      }

      .lb-training-frame {
        width: 100vw !important;
        height: 100svh !important;
        max-width: none !important;
        margin: 0 !important;
        padding: clamp(14px, 2vw, 34px) clamp(16px, 2.6vw, 46px) clamp(10px, 1.5vh, 24px) !important;
        display: grid !important;
        grid-template-columns: minmax(260px, 27vw) minmax(0, 1fr) !important;
        grid-template-rows: auto auto minmax(0, 1fr) auto !important;
        grid-template-areas:
          "header play"
          "hint play"
          "helper play"
          "footer footer" !important;
        gap: clamp(10px, 1.4vw, 22px) clamp(18px, 2.5vw, 40px) !important;
        background: transparent !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }

      .lb-training-header,
      .lb-training-hint-card,
      .lb-training-helper-card {
        border-radius: 28px !important;
        background: rgba(255, 249, 224, 0.94) !important;
        border: 2px solid rgba(255,255,255,0.78) !important;
        box-shadow: 0 14px 30px rgba(88, 64, 24, 0.16) !important;
        color: #5b351d !important;
      }

      .lb-training-header {
        grid-area: header !important;
        padding: clamp(14px, 1.8vw, 24px) !important;
      }

      .lb-training-header h1,
      .lb-training-card h1,
      .lb-training-card h2 {
        margin: 0 !important;
        color: #5b351d !important;
        font-size: clamp(30px, 3vw, 46px) !important;
        line-height: 1.08 !important;
        font-weight: 950 !important;
      }

      .lb-training-header p,
      .lb-training-card p {
        margin: 8px 0 0 !important;
        color: #694125 !important;
        font-size: clamp(16px, 1.55vw, 22px) !important;
        line-height: 1.35 !important;
        font-weight: 850 !important;
      }

      .lb-training-progress {
        margin-top: 12px !important;
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
      }

      .lb-training-dot {
        width: 13px !important;
        height: 13px !important;
        border-radius: 999px !important;
        background: rgba(135, 102, 54, 0.24) !important;
        border: 2px solid rgba(255,255,255,0.85) !important;
      }

      .lb-training-dot-active { background: #ff9a55 !important; transform: scale(1.2); }
      .lb-training-dot-done { background: #7fc56b !important; }

      .lb-training-hint-card {
        grid-area: hint !important;
        padding: 14px 18px !important;
        font-size: clamp(24px, 2.6vw, 42px) !important;
        font-weight: 950 !important;
        text-align: center !important;
        min-height: 80px !important;
        display: grid !important;
        place-items: center !important;
      }

      .lb-training-helper-card {
        grid-area: helper !important;
        align-self: start !important;
        padding: 14px 16px !important;
        display: grid !important;
        gap: 10px !important;
      }

      .lb-training-helper-row {
        display: grid !important;
        grid-template-columns: auto 1fr !important;
        gap: 10px !important;
        align-items: center !important;
      }

      .lb-training-mini-sheep {
        width: clamp(54px, 5.6vw, 84px) !important;
        filter: drop-shadow(0 8px 10px rgba(70, 45, 18, 0.2));
      }

      .lb-training-next {
        border-radius: 20px !important;
        padding: 10px 14px !important;
        background: rgba(255, 236, 171, 0.85) !important;
        color: #6b3f14 !important;
        font-size: clamp(17px, 1.7vw, 24px) !important;
        font-weight: 950 !important;
      }

      .lb-play-area {
        grid-area: play !important;
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        border-radius: clamp(30px, 3vw, 48px) !important;
        background: rgba(255, 249, 225, 0.50) !important;
        border: 3px solid rgba(255, 255, 255, 0.84) !important;
        box-shadow: inset 0 0 0 1px rgba(142, 107, 48, 0.08), 0 18px 42px rgba(71, 55, 25, 0.14) !important;
        box-sizing: border-box !important;
      }

      .lb-sky,
      .lb-number-sky {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
        background: transparent !important;
      }

      .lb-floating-doorplate-layer {
        position: absolute !important;
        inset: clamp(28px, 3.5vw, 58px) clamp(34px, 4vw, 70px) clamp(28px, 3.5vw, 58px) clamp(34px, 4vw, 70px) !important;
        z-index: 6 !important;
        pointer-events: auto !important;
        overflow: visible !important;
      }

      .lb-doorplate-node {
        position: absolute !important;
        left: var(--door-x, 50%) !important;
        top: var(--door-y, 50%) !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        transform: translate(-50%, -50%) rotate(var(--door-r, 0deg)) !important;
        transition: filter 160ms ease, opacity 160ms ease, transform 160ms ease !important;
        cursor: pointer !important;
        z-index: 4 !important;
      }

      .lb-doorplate-node:hover,
      .lb-doorplate-node:focus,
      .lb-doorplate-node:active {
        transform: translate(-50%, -50%) rotate(var(--door-r, 0deg)) !important;
      }

      .lb-doorplate-art {
        width: clamp(60px, 6.2vw, 104px) !important;
        height: auto !important;
        display: block !important;
        pointer-events: none !important;
        user-select: none !important;
        filter: drop-shadow(0 10px 8px rgba(89, 58, 22, 0.18));
      }

      .lb-doorplate-number {
        position: absolute !important;
        left: 50% !important;
        top: 38% !important;
        transform: translate(-50%, -50%) !important;
        color: #6b3a16 !important;
        font-size: clamp(20px, 2.3vw, 35px) !important;
        font-weight: 950 !important;
        line-height: 1 !important;
        pointer-events: none !important;
      }

      .lb-doorplate-node-red .lb-doorplate-number { color: #b74030 !important; }
      .lb-doorplate-node-blue .lb-doorplate-number { color: #2f68a7 !important; }
      .lb-training-distractor-node .lb-doorplate-art { filter: grayscale(.28) drop-shadow(0 10px 8px rgba(89,58,22,.16)) !important; opacity: .9 !important; }
      .lb-training-distractor-node .lb-doorplate-number { color: #8a7a69 !important; }
      .lb-doorplate-node-completed { opacity: 0.68 !important; }
      .lb-doorplate-node-correct-flash { filter: drop-shadow(0 0 18px rgba(255, 222, 96, 0.95)) !important; }
      .lb-doorplate-node-wrong { filter: drop-shadow(0 0 14px rgba(255, 92, 92, 0.95)) !important; }
      .lb-training-hint-target { filter: drop-shadow(0 0 22px rgba(255, 225, 73, 1)) drop-shadow(0 0 12px rgba(255, 153, 44, .75)) !important; }
      .lb-training-memory-hidden .lb-doorplate-number:empty::after { content: "?"; color: rgba(107, 58, 22, .35); }

      .lb-map-home-img {
        position: absolute !important;
        left: 92% !important;
        top: 78% !important;
        width: clamp(78px, 8.8vw, 136px) !important;
        transform: translate(-50%, -50%) !important;
        z-index: 3 !important;
        filter: drop-shadow(0 13px 14px rgba(80, 50, 18, 0.22));
        user-select: none !important;
        pointer-events: none !important;
      }

      .lb-connect-line-svg {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 2 !important;
        pointer-events: none !important;
        overflow: visible !important;
      }

      .lb-connect-line {
        fill: none !important;
        stroke: rgba(123, 78, 34, 0.72) !important;
        stroke-width: 3.4 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 3px 4px rgba(94, 63, 28, 0.22));
      }

      .lb-connect-line-active {
        stroke: rgba(92, 58, 24, 0.86) !important;
        stroke-width: 4.2 !important;
      }

      .lb-walking-person {
        position: absolute !important;
        left: var(--person-x, 50%) !important;
        top: var(--person-y, 50%) !important;
        width: clamp(48px, 5.8vw, 86px) !important;
        z-index: 8 !important;
        transform: translate(-50%, -92%) !important;
        pointer-events: none !important;
        filter: drop-shadow(0 8px 10px rgba(70, 45, 18, 0.22));
        transition: left 520ms ease, top 520ms ease;
      }

      .lb-training-footer {
        grid-area: footer !important;
        min-height: 58px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 12px !important;
      }

      .lb-training-message {
        margin: 0 !important;
        padding: 11px 20px !important;
        border-radius: 999px !important;
        color: #5d3a24 !important;
        background: rgba(255, 255, 255, 0.92) !important;
        box-shadow: 0 8px 18px rgba(86, 60, 22, 0.13) !important;
        font-size: clamp(16px, 1.7vw, 22px) !important;
        font-weight: 900 !important;
      }

      .lb-training-button {
        border: 0 !important;
        border-radius: 999px !important;
        padding: 12px 26px !important;
        font-size: clamp(16px, 1.7vw, 21px) !important;
        font-weight: 950 !important;
        color: #6b3f14 !important;
        background: linear-gradient(180deg, #ffe89a, #ffc95f) !important;
        box-shadow: 0 8px 18px rgba(128, 86, 34, 0.2) !important;
        cursor: pointer !important;
      }

      .lb-training-button:disabled { opacity: 0.48 !important; cursor: not-allowed !important; }

      .lb-training-card-page {
        display: grid !important;
        place-items: center !important;
        padding: clamp(10px, 1.6vw, 26px) !important;
      }

      .lb-training-card {
        width: min(1180px, 94vw) !important;
        max-height: 94svh !important;
        overflow: auto !important;
        border-radius: 36px !important;
        padding: clamp(20px, 2.6vw, 38px) !important;
        background: rgba(255, 249, 224, 0.95) !important;
        border: 2px solid rgba(255,255,255,0.84) !important;
        box-shadow: 0 18px 45px rgba(76, 52, 21, 0.18) !important;
        box-sizing: border-box !important;
      }

      .lb-training-level-grid {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 12px !important;
        margin: 20px 0 !important;
      }

      .lb-training-level-card {
        border: 2px solid rgba(255,255,255,.78) !important;
        border-radius: 24px !important;
        padding: 14px !important;
        background: rgba(255,255,255,.56) !important;
        text-align: left !important;
      }

      .lb-training-level-card strong {
        display: block !important;
        color: #5b351d !important;
        font-size: 18px !important;
      }

      .lb-training-level-card span {
        display: block !important;
        margin-top: 5px !important;
        color: #765235 !important;
        font-weight: 800 !important;
      }

      .lb-training-result-list {
        margin: 18px 0 !important;
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 12px !important;
      }

      @media (max-width: 960px), (max-height: 620px) {
        .lb-training-frame {
          grid-template-columns: 1fr !important;
          grid-template-rows: auto auto auto minmax(0, 1fr) auto !important;
          grid-template-areas: "header" "hint" "helper" "play" "footer" !important;
          padding: 10px 12px 8px !important;
          gap: 8px !important;
        }

        .lb-training-helper-card { display: none !important; }
        .lb-training-hint-card { min-height: 54px !important; font-size: clamp(21px, 5vw, 32px) !important; padding: 8px 12px !important; }
        .lb-training-header { padding: 10px 14px !important; }
        .lb-training-header h1 { font-size: clamp(24px, 6vw, 34px) !important; }
        .lb-training-header p { font-size: clamp(14px, 3.3vw, 18px) !important; margin-top: 4px !important; }
        .lb-floating-doorplate-layer { inset: 22px 30px 26px 30px !important; }
        .lb-doorplate-art { width: clamp(52px, 8.4vw, 82px) !important; }
        .lb-doorplate-number { font-size: clamp(18px, 3vw, 29px) !important; }
        .lb-map-home-img { width: clamp(66px, 11vw, 98px) !important; }
        .lb-training-level-grid,
        .lb-training-result-list { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      }


      /* TestPage_LB-aligned start/video/result visual system */
      .lb-srt-skin {
        text-align: center;
        color: #4b2c16;
        user-select: none;
        -webkit-user-select: none;
      }

      .lb-srt-skin::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 52% 9%, rgba(255,255,255,0.22), transparent 28%),
          linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,239,188,0.10));
        z-index: 0;
      }

      .lb-center-shell {
        width: min(88vw, 1180px);
        min-height: 100vh;
        min-height: 100svh;
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
      .lb-result-shell,
      .lb-rule-shell {
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
        overflow: hidden;
      }

      .lb-soft-panel::before {
        content: "";
        position: absolute;
        inset: 18px;
        border-radius: 42px;
        border: 2px dashed rgba(230, 170, 67, 0.42);
        pointer-events: none;
      }

      .lb-soft-panel::after {
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

      .lb-start-panel,
      .lb-result-panel,
      .lb-rule-panel {
        min-height: 560px;
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

      .lb-game-title::before,
      .lb-game-title::after {
        content: "🌿";
        position: absolute;
        top: 50%;
        font-size: 28px;
        transform: translateY(-50%);
      }
      .lb-game-title::before { left: 18px; }
      .lb-game-title::after { right: 18px; transform: translateY(-50%) scaleX(-1); }

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

      .lb-level-bubble {
        min-height: 160px;
        flex-direction: column;
        gap: 10px;
      }

      .lb-level-bubble small {
        display: block;
        font-size: clamp(28px, 4vw, 46px);
        line-height: 1.15;
      }

      .lb-level-desc,
      .lb-result-suggestion {
        position: relative;
        z-index: 3;
        margin: -8px 0 0;
        padding: 12px 24px;
        border-radius: 999px;
        color: #6b3f14;
        background: rgba(255, 255, 255, 0.72);
        font-size: clamp(18px, 1.8vw, 24px);
        font-weight: 900;
        box-shadow: 0 8px 18px rgba(86, 60, 22, 0.10);
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
      .lb-round-icon::after {
        content: "★";
        position: absolute;
        right: 4px;
        bottom: 2px;
        color: #ffd948;
        font-size: 36px;
        -webkit-text-stroke: 2px #e29b21;
        text-shadow: 0 3px 0 rgba(139, 96, 20, 0.14);
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
        min-width: 220px;
        min-height: 76px;
        padding: 12px 36px;
        border-radius: 24px;
        border: 4px solid rgba(255,255,255,0.86);
        outline: 3px solid rgba(54, 133, 54, 0.35);
        background: linear-gradient(180deg, #7dd15f 0%, #47a640 100%);
        color: #ffffff;
        font-family: inherit;
        font-size: clamp(25px, 2.8vw, 38px);
        font-weight: 950;
        line-height: 1.15;
        letter-spacing: 1px;
        cursor: pointer;
        transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
        box-shadow: 0 8px 0 rgba(52, 126, 43, 0.20), 0 14px 22px rgba(72, 64, 28, 0.16);
        text-shadow: 0 3px 0 rgba(35, 96, 36, 0.36), 0 0 8px rgba(35, 96, 36, 0.18);
      }

      .lb-forest-button:hover { transform: translateY(-3px) scale(1.03); filter: brightness(1.04); }
      .lb-forest-button:active { transform: translateY(2px) scale(0.99); }

      .lb-image-button {
        border: 0;
        background: transparent;
        box-shadow: none;
        outline: 0;
        min-width: 0;
        min-height: 0;
        padding: 0;
        border-radius: 0;
        text-shadow: none;
      }
      .lb-image-button img {
        display: block;
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 10px 0 rgba(112, 78, 25, 0.12)) drop-shadow(0 16px 24px rgba(91, 57, 18, 0.20));
        transition: transform 0.14s ease, filter 0.14s ease;
        pointer-events: none;
      }
      .lb-image-button:hover { transform: none; filter: none; }
      .lb-image-button:hover img { transform: translateY(-3px) scale(1.03); filter: drop-shadow(0 12px 0 rgba(112, 78, 25, 0.10)) drop-shadow(0 20px 26px rgba(91, 57, 18, 0.22)) brightness(1.05); }
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
        width: min(84vw, 1020px);
        padding: 30px 34px 92px;
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
        position: absolute;
        right: 70px;
        bottom: 28px;
      }

      .lb-cute-stars {
        position: relative;
        z-index: 4;
        display: flex;
        justify-content: center;
        gap: clamp(14px, 2vw, 24px);
        margin-bottom: 2px;
      }
      .lb-cute-star {
        font-size: clamp(58px, 8vw, 112px);
        line-height: 1;
        color: rgba(170, 126, 63, 0.25);
        -webkit-text-stroke: 3px rgba(125, 84, 27, 0.24);
        text-shadow: 0 8px 0 rgba(113, 81, 26, 0.08);
        transform: rotate(-5deg) scale(0.92);
      }
      .lb-cute-star:nth-child(2) { transform: translateY(-10px) scale(1.05); }
      .lb-cute-star:nth-child(3) { transform: rotate(5deg) scale(0.92); }
      .lb-cute-star.is-on {
        color: #ffd84e;
        -webkit-text-stroke: 3px #e69a1e;
        text-shadow: 0 8px 0 rgba(169, 106, 20, 0.15), 0 12px 24px rgba(255, 209, 66, 0.26);
      }
      .lb-result-actions {
        position: relative;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: clamp(12px, 2vw, 26px);
        flex-wrap: wrap;
      }
      .lb-result-content { margin: 2px 0 8px; }
      .lb-result-metrics {
        position: relative;
        z-index: 3;
        width: min(100%, 720px);
        margin: -4px 0 0 !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      .lb-training-page .lb-training-frame {
        position: relative;
        z-index: 1;
      }

      .lb-training-page .lb-training-button {
        border-radius: 22px !important;
        border: 4px solid rgba(255,255,255,0.86) !important;
        outline: 3px solid rgba(54, 133, 54, 0.35) !important;
        background: linear-gradient(180deg, #7dd15f 0%, #47a640 100%) !important;
        color: #fff !important;
        box-shadow: 0 8px 0 rgba(52, 126, 43, 0.20), 0 14px 22px rgba(72, 64, 28, 0.16) !important;
      }

      @keyframes lbMouseTap {
        0%, 100% { transform: translate(0, 0) rotate(-6deg) scale(1); }
        50% { transform: translate(-8px, -8px) rotate(-10deg) scale(1.04); }
      }

      @media (max-width: 1024px) {
        .lb-start-shell, .lb-result-shell, .lb-rule-shell { width: min(88vw, 860px); }
        .lb-start-panel, .lb-result-panel, .lb-rule-panel { padding: 46px 42px 64px; }
        .lb-start-content { grid-template-columns: minmax(240px, 1fr) 134px; gap: 30px; }
        .lb-round-icon { width: 134px; height: 134px; }
        .lb-result-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
      }

      @media (max-width: 768px) {
        .lb-center-shell { width: min(94vw, 720px); padding: 16px 0; }
        .lb-start-shell, .lb-result-shell, .lb-rule-shell { width: 94vw; }
        .lb-start-panel, .lb-result-panel, .lb-rule-panel { min-height: 0; padding: 34px 24px 54px; border-radius: 40px; }
        .lb-start-content, .lb-result-content { grid-template-columns: 1fr; justify-items: center; gap: 18px; }
        .lb-dialog-bubble::after { display: none; }
        .lb-round-icon { width: 116px; height: 116px; }
        .lb-video-panel { width: 94vw; padding: 20px 18px 78px; border-radius: 38px; }
        .lb-video-frame { border-radius: 26px; }
        .lb-guided-skip { right: 38px; bottom: 22px; }
        .lb-result-actions { gap: 10px; }
        .lb-result-metrics { grid-template-columns: 1fr !important; }
      }

    `}</style>
  );
}

export default function TrainingPage_LB() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("start");
  const [levelIndex, setLevelIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [displayItems, setDisplayItems] = useState(() => buildDisplayItems(TRAINING_LEVELS[0]));
  const [completedKeys, setCompletedKeys] = useState([]);
  const [clickedPath, setClickedPath] = useState([]);
  const [wrongKey, setWrongKey] = useState(null);
  const [correctGlowKey, setCorrectGlowKey] = useState(null);
  const [hintKey, setHintKey] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [footerMessage, setFooterMessage] = useState("先選一條小路開始練習");
  const [memoryHidden, setMemoryHidden] = useState(false);
  const [walkingIndex, setWalkingIndex] = useState(0);
  const [summary, setSummary] = useState(null);

  const delayTimerRef = useRef(null);
  const hintTimerRef = useRef(null);
  const previewTimerRef = useRef(null);
  const stepRafRef = useRef(null);
  const reviewIntervalRef = useRef(null);
  const reviewEndTimerRef = useRef(null);
  const stepStartTimeRef = useRef(0);
  const logsRef = useRef([]);
  const wrongStepCountRef = useRef(0);
  const totalStartedAtRef = useRef(0);
  const clickedPathRef = useRef([]);
  const introVideoRef = useRef(null);
  const endingVideoRef = useRef(null);

  const currentLevel = TRAINING_LEVELS[levelIndex];
  const currentSequence = useMemo(() => buildSequence(currentLevel), [currentLevel]);
  const expectedItem = currentSequence[stepIndex] || null;
  const progressText = `${levelIndex + 1} / ${TRAINING_LEVELS.length}`;

  function clearTrainingTimers() {
    clearTimeout(delayTimerRef.current);
    clearTimeout(hintTimerRef.current);
    clearTimeout(previewTimerRef.current);
    clearTimeout(reviewEndTimerRef.current);
    clearInterval(reviewIntervalRef.current);
    cancelAnimationFrame(stepRafRef.current);

    delayTimerRef.current = null;
    hintTimerRef.current = null;
    previewTimerRef.current = null;
    reviewEndTimerRef.current = null;
    reviewIntervalRef.current = null;
    stepRafRef.current = null;
  }

  function pauseVideo(videoRef) {
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
  }

  function pauseAllVideos() {
    pauseVideo(introVideoRef);
    pauseVideo(endingVideoRef);
  }

  function setTrainingPhase(nextPhase) {
    pauseAllVideos();
    setPhase(nextPhase);
  }

  useEffect(() => {
    return () => {
      clearTrainingTimers();
      pauseAllVideos();
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing" || !expectedItem || isLocked) return undefined;

    clearTimeout(hintTimerRef.current);
    cancelAnimationFrame(stepRafRef.current);

    // 計時起點必須在引導結束、門牌正式啟用，且畫面完成繪製後才重設。
    // 避免把任務說明、記憶預覽、錯誤鎖定提示時間算進第一步或下一步 RT。
    stepRafRef.current = requestAnimationFrame(() => {
      stepStartTimeRef.current = performance.now();

      if (currentLevel.hintMode === "always") {
        setHintKey(expectedItem.key);
      } else {
        setHintKey(null);
      }

      if (currentLevel.hintMode === "delay") {
        hintTimerRef.current = setTimeout(() => {
          setHintKey(expectedItem.key);
          setFooterMessage(`提示：找 ${getExpectedText(expectedItem)}`);
        }, currentLevel.hintDelayMs || TRAINING_CONFIG.hintDelayMs);
      }
    });

    return () => {
      clearTimeout(hintTimerRef.current);
      cancelAnimationFrame(stepRafRef.current);
    };
  }, [phase, levelIndex, stepIndex, expectedItem, currentLevel, isLocked]);

  function resetLevel(nextLevelIndex) {
    const level = TRAINING_LEVELS[nextLevelIndex];
    clearTrainingTimers();

    setLevelIndex(nextLevelIndex);
    setStepIndex(0);
    setDisplayItems(buildDisplayItems(level));
    setCompletedKeys([]);
    setClickedPath([]);
    clickedPathRef.current = [];
    setWrongKey(null);
    setCorrectGlowKey(null);
    setHintKey(null);
    setIsLocked(false);
    setWalkingIndex(0);
    setMemoryHidden(false);
    wrongStepCountRef.current = 0;
  }

  function startTraining(startIndex = 0) {
    logsRef.current = [];
    totalStartedAtRef.current = performance.now();
    sessionStorage.removeItem(SESSION_KEY);
    setSummary(null);
    resetLevel(startIndex);
    setTrainingPhase("introVideo");
    setFooterMessage("先看動畫，等等開始練習");
  }

  function handleIntroVideoEnd() {
    showLevelIntro(0);
  }

  function handleEndingVideoEnd() {
    setTrainingPhase("result");
  }

  function showLevelIntro(nextIndex) {
    resetLevel(nextIndex);
    setTrainingPhase("levelIntro");
    setFooterMessage("看任務卡，準備練習");
  }

  function startCurrentLevel() {
    resetLevel(levelIndex);
    clearTrainingTimers();
    setTrainingPhase("playing");
    setFooterMessage(`找：${getExpectedText(buildSequence(TRAINING_LEVELS[levelIndex])[0])}`);

    const level = TRAINING_LEVELS[levelIndex];
    if (level.taskType === TASK_TYPES.MEMORY_PATH) {
      setHintKey(null);
      setMemoryHidden(false);
      setIsLocked(true);
      setFooterMessage("先看清楚門牌，等等數字會藏起來");
      previewTimerRef.current = setTimeout(() => {
        setMemoryHidden(true);
        setIsLocked(false);
        setFooterMessage(`開始找：${getExpectedText(buildSequence(level)[0])}`);
      }, level.previewMs || 2800);
    }
  }

  function buildLog({ clickedItem, isCorrect, reactionTime, status, wrongType, hintShown }) {
    return {
      task: "LB",
      gameId: "LB",
      mode: TRAINING_CONFIG.mode,
      difficulty: TRAINING_CONFIG.difficulty,
      abilityType: "flexibility",

      levelId: currentLevel.id,
      chapter: currentLevel.chapter,
      levelTitle: currentLevel.title,
      taskType: currentLevel.taskType,
      ruleType: currentLevel.ruleType,
      ability: currentLevel.ability,
      trialId: `${currentLevel.id}-${stepIndex + 1}`,
      stepInLevel: stepIndex + 1,

      expectedNumber: expectedItem?.number || null,
      expectedColor: expectedItem?.expectedColor || null,
      expectedLabel: getExpectedText(expectedItem),
      clickedNumber: clickedItem?.number || null,
      clickedColor: clickedItem?.color || null,
      clickedKey: clickedItem?.key || null,

      isCorrect,
      correct: isCorrect,
      status,
      result: status,
      wrongType: wrongType || null,
      hintShown: Boolean(hintShown),
      rt: reactionTime,
      reactionTime,
      timestamp: new Date().toISOString(),
    };
  }

  function appendLog(log) {
    logsRef.current = [...logsRef.current, log];
    return logsRef.current;
  }

  function handleBlankClick(event) {
    if (event.target !== event.currentTarget) return;
    if (phase !== "playing" || isLocked) return;

    const reactionTime = Math.max(0, Math.round(performance.now() - stepStartTimeRef.current));
    appendLog(
      buildLog({
        clickedItem: null,
        isCorrect: false,
        reactionTime,
        status: "blankClick",
        wrongType: "blankClick",
        hintShown: Boolean(hintKey),
      })
    );

    setFooterMessage("請點門牌");
  }

  function handleDoorplateClick(item) {
    if (phase !== "playing" || isLocked || !expectedItem) return;

    clearTimeout(hintTimerRef.current);
    clearTimeout(delayTimerRef.current);
    setIsLocked(true);

    const reactionTime = Math.max(0, Math.round(performance.now() - stepStartTimeRef.current));
    const correct = isCorrectStep(item, expectedItem);
    const wrongType = correct ? null : getWrongType(item, expectedItem);

    appendLog(
      buildLog({
        clickedItem: item,
        isCorrect: correct,
        reactionTime,
        status: correct ? "correct" : "wrong",
        wrongType,
        hintShown: Boolean(hintKey),
      })
    );

    if (correct) {
      wrongStepCountRef.current = 0;
      setCorrectGlowKey(item.key);
      setHintKey(null);

      // 過關判定改用本次點擊後即時計算出的 nextCompleted.length，
      // 避免依賴 React 非同步 state 導致混合任務或記憶隱藏關卡判定錯位。
      const nextCompleted = [...completedKeys, item.key];
      setCompletedKeys(nextCompleted);

      const isLastStep = nextCompleted.length >= currentSequence.length;
      const nextPath = isLastStep ? [...clickedPathRef.current, item, HOME_PATH_POINT] : [...clickedPathRef.current, item];
      clickedPathRef.current = nextPath;
      setClickedPath(nextPath);

      setFooterMessage(isLastStep ? "這條小路完成了！" : `下一個：${getExpectedText(currentSequence[nextCompleted.length])}`);

      delayTimerRef.current = setTimeout(() => {
        setCorrectGlowKey(null);
        if (isLastStep) {
          reviewPathThenNext();
          return;
        }

        const nextStep = nextCompleted.length;
        if (currentLevel.shuffleAfterSteps?.includes(nextStep)) {
          setDisplayItems((prev) => withDoorplateMeta(shuffleItems(prev), getPositionsForCount(prev.length)));
          setFooterMessage("門牌換位置了，重新找找看");
        }

        setStepIndex(nextStep);
        setIsLocked(false);
      }, TRAINING_CONFIG.feedbackDelayCorrectMs);
      return;
    }

    wrongStepCountRef.current += 1;
    setWrongKey(item.key);

    const messageMap = {
      colorError: "顏色不對，先看紅藍順序",
      numberError: "數字不對，找同一個順序的數字",
      distractorClick: "這是假門牌，換一個看看",
      sequenceError: "方向不對，再看下一個數字",
      ruleSwitchError: "規則換了，先看任務卡",
      blankClick: "請點門牌",
    };

    setFooterMessage(messageMap[wrongType] || "再試一次");

    if (wrongStepCountRef.current >= (currentLevel.hintAfterWrong || 2)) {
      setHintKey(expectedItem.key);
    }

    delayTimerRef.current = setTimeout(() => {
      setWrongKey(null);
      setIsLocked(false);
    }, TRAINING_CONFIG.feedbackDelayWrongMs);
  }

  function reviewPathThenNext() {
    clearTrainingTimers();
    setIsLocked(true);
    setTrainingPhase("reviewing");
    setWalkingIndex(0);
    setFooterMessage("綿羊奶奶沿著你連好的路走回家");

    let index = 0;
    const pathLength = clickedPathRef.current.length;
    reviewIntervalRef.current = setInterval(() => {
      index += 1;
      setWalkingIndex(Math.min(index, pathLength - 1));

      if (index >= pathLength - 1) {
        clearInterval(reviewIntervalRef.current);
        reviewIntervalRef.current = null;

        reviewEndTimerRef.current = setTimeout(() => {
          if (levelIndex >= TRAINING_LEVELS.length - 1) {
            finishTraining();
          } else {
            showLevelIntro(levelIndex + 1);
          }
        }, 620);
      }
    }, TRAINING_CONFIG.reviewStepMs);
  }

  function skipToNextLevel() {
    clearTrainingTimers();
    if (levelIndex >= TRAINING_LEVELS.length - 1) {
      finishTraining();
      return;
    }
    showLevelIntro(levelIndex + 1);
  }

  function finishTraining() {
    clearTrainingTimers();

    const finalLogs = logsRef.current;
    const resultSummary = summarizeLogs(finalLogs);

    const levelSummaries = TRAINING_LEVELS.map((level) => {
      const levelLogs = finalLogs.filter((log) => log.levelId === level.id);
      return {
        levelId: level.id,
        chapter: level.chapter,
        title: level.title,
        taskType: level.taskType,
        ability: level.ability,
        ...summarizeLogs(levelLogs),
      };
    });

    const weakestLevel = levelSummaries
      .filter((item) => item.correctTrials + item.wrongTrials > 0)
      .sort((a, b) => a.accuracy - b.accuracy || b.hintCount - a.hintCount)[0];

    const payload = {
      task: "LB",
      gameId: "LB",
      taskName: "Linking Balloons Training",
      mode: TRAINING_CONFIG.mode,
      difficulty: TRAINING_CONFIG.difficulty,
      abilityType: "flexibility",
      totalLevels: TRAINING_LEVELS.length,
      completedLevels: levelSummaries.filter((item) => item.correctTrials > 0).length,
      totalPlayTime: Math.round(performance.now() - totalStartedAtRef.current),
      ...resultSummary,
      score: resultSummary.accuracy,
      levelSummaries,
      weakestLevel,
      recommendedNextTraining: weakestLevel
        ? `下次可以多練「${weakestLevel.chapter}：${weakestLevel.title}」。`
        : "下次可以從數字小路開始暖身。",
      logs: finalLogs,
      trialLogs: finalLogs,
      config: TRAINING_CONFIG,
      finishedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
    setSummary(payload);
    setTrainingPhase("endingVideo");
  }

  function goResultPage() {
    const payload = summary || JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    navigate(RESULT_ROUTE, { state: payload, replace: true });
  }

  if (phase === "start") {
    return (
      <div className="lb-page lb-page-with-bg lb-training-card-page lb-srt-skin" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
        <TrainingInlineStyle />
        <main className="lb-center-shell lb-start-shell">
          <section className="lb-soft-panel lb-start-panel" aria-label="LB 訓練開始">
            <h1 className="lb-game-title">Linking Balloons</h1>
            <div className="lb-start-content">
              <div className="lb-dialog-bubble lb-opening-bubble">
                先跟綿羊奶奶練習找門牌，照順序把小路連回家。
              </div>
              <div className="lb-round-icon lb-start-avatar">
                <img src={sheepImg} alt="綿羊奶奶" draggable="false" />
              </div>
            </div>
            <div className="lb-guided-action lb-guided-start">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-start" onClick={() => startTraining(0)} aria-label="開始訓練">
                <img src={homeStartBtn} alt="開始" draggable="false" />
              </button>
              <img className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "introVideo") {
    return (
      <div className="lb-page lb-page-with-bg lb-training-card-page lb-srt-skin" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
        <TrainingInlineStyle />
        <main className="lb-center-shell">
          <section className="lb-soft-panel lb-video-panel" aria-label="開始動畫">
            <div className="lb-video-frame">
              <video
                ref={introVideoRef}
                src={introVideo}
                autoPlay
                playsInline
                controls={false}
                onEnded={handleIntroVideoEnd}
                className="lb-video"
              />
            </div>
            <div className="lb-guided-action lb-guided-skip">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-skip" onClick={handleIntroVideoEnd} aria-label="跳過動畫">
                <img src={homeSkipBtn} alt="跳過動畫" draggable="false" />
              </button>
              <img className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "levelIntro") {
    return (
      <div className="lb-page lb-page-with-bg lb-training-card-page lb-srt-skin" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
        <TrainingInlineStyle />
        <main className="lb-center-shell lb-rule-shell">
          <section className="lb-soft-panel lb-rule-panel">
            <h1 className="lb-game-title">{currentLevel.chapter}</h1>
            <div className="lb-start-content lb-level-content">
              <div className="lb-dialog-bubble lb-level-bubble">
                <span>{currentLevel.id}｜{currentLevel.title}</span>
                <small>{getRuleIcon(currentLevel)}</small>
              </div>
              <div className="lb-round-icon lb-start-avatar">
                <img src={sheepImg} alt="綿羊奶奶" draggable="false" />
              </div>
            </div>
            <p className="lb-level-desc">
              {currentLevel.taskType === TASK_TYPES.MEMORY_PATH
                ? "先看門牌位置，數字藏起來後再照順序點。"
                : currentLevel.taskType === TASK_TYPES.DISTRACTOR_DOORS
                  ? "有些是假門牌，不要被問號或多餘數字騙走。"
                  : currentLevel.shuffleAfterSteps
                    ? "小路走到一半時，門牌可能會換位置。"
                    : "跟著任務卡上的規則，把綿羊奶奶帶回家。"}
            </p>
            <div className="lb-guided-action lb-guided-start">
              <button type="button" className="lb-forest-button lb-primary-button" onClick={startCurrentLevel}>
                開始這一關
              </button>
              <img className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "endingVideo") {
    return (
      <div className="lb-page lb-page-with-bg lb-training-card-page lb-srt-skin" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
        <TrainingInlineStyle />
        <main className="lb-center-shell">
          <section className="lb-soft-panel lb-video-panel" aria-label="結束動畫">
            <div className="lb-video-frame">
              <video
                ref={endingVideoRef}
                src={endingVideo}
                autoPlay
                playsInline
                controls={false}
                onEnded={handleEndingVideoEnd}
                className="lb-video"
              />
            </div>
            <div className="lb-guided-action lb-guided-skip">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-skip" onClick={handleEndingVideoEnd} aria-label="跳過動畫">
                <img src={homeSkipBtn} alt="跳過動畫" draggable="false" />
              </button>
              <img className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "result") {
    const resultStars = Math.max(1, Math.min(3, Number(summary?.stars || 1)));

    return (
      <div className="lb-page lb-page-with-bg lb-training-card-page lb-srt-skin" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
        <TrainingInlineStyle />
        <main className="lb-center-shell lb-result-shell">
          <section className="lb-soft-panel lb-result-panel" aria-label="訓練結果">
            <div className="lb-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span key={star} className={`lb-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>
              ))}
            </div>
            <div className="lb-start-content lb-result-content">
              <div className="lb-dialog-bubble">
                訓練完成！你幫綿羊奶奶練習了好多條小路。
              </div>
              <div className="lb-round-icon lb-result-icon">
                <img src={homeImg} alt="LB 訓練圖示" draggable="false" />
              </div>
            </div>
            <div className="lb-training-result-list lb-result-metrics">
              <div className="lb-training-level-card"><strong>正確率</strong><span>{summary?.accuracy || 0}%</span></div>
              <div className="lb-training-level-card"><strong>提示次數</strong><span>{summary?.hintCount || 0}</span></div>
              <div className="lb-training-level-card"><strong>平均反應</strong><span>{summary?.avgReactionTime || 0} ms</span></div>
            </div>
            <p className="lb-result-suggestion">{summary?.recommendedNextTraining}</p>
            <div className="lb-result-actions">
              <div className="lb-guided-action lb-guided-result-main">
                <button type="button" className="lb-forest-button lb-image-button lb-btn-home" onClick={() => navigate("/game-menu")} aria-label="回到森林">
                  <img src={homeBackBtn} alt="回到森林" draggable="false" />
                </button>
                <img className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
              </div>
              <button type="button" className="lb-forest-button lb-image-button lb-btn-replay" onClick={() => startTraining(0)} aria-label="再練一次">
                <img src={homeAgainBtn} alt="再練一次" draggable="false" />
              </button>
              <button type="button" className="lb-forest-button lb-image-button lb-btn-detail" onClick={goResultPage} aria-label="詳細結果">
                <img src={homeResultBtn} alt="詳細結果" draggable="false" />
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }


  return (
    <div className="lb-page lb-page-with-bg lb-training-page lb-srt-skin" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
      <TrainingInlineStyle />
      <div className="lb-training-frame">
        <header className="lb-training-header">
          <h1>{currentLevel.title}</h1>
          <p>{currentLevel.chapter}｜{progressText}</p>
          <div className="lb-training-progress" aria-label="訓練進度">
            {TRAINING_LEVELS.map((level, index) => (
              <span
                key={level.id}
                className={[
                  "lb-training-dot",
                  index === levelIndex ? "lb-training-dot-active" : "",
                  index < levelIndex ? "lb-training-dot-done" : "",
                ].filter(Boolean).join(" ")}
              />
            ))}
          </div>
        </header>

        <div className="lb-training-hint-card" aria-label="任務卡">
          {getRuleIcon(currentLevel)}
        </div>

        <aside className="lb-training-helper-card">
          <div className="lb-training-helper-row">
            <img src={sheepImg} alt="綿羊奶奶" className="lb-training-mini-sheep" draggable="false" />
            <p>看任務卡，照規則找下一個門牌。</p>
          </div>
          <div className="lb-training-next">
            {expectedItem ? `下一個：${getExpectedText(expectedItem)}` : "完成"}
          </div>
        </aside>

        <main className="lb-play-area" onClick={handleBlankClick}>
          <div className="lb-sky lb-number-sky">
            <div className="lb-floating-doorplate-layer" aria-label="訓練門牌遊戲區">
              <LBPathOverlay points={clickedPath} active={phase === "reviewing"} />
              <img src={homeImg} alt="小屋" className="lb-map-home-img" draggable="false" />
              {phase === "reviewing" && <WalkingPerson point={clickedPath[walkingIndex]} />}
              {displayItems.map((item) => (
                <DoorplateButton
                  key={item.key}
                  item={item}
                  disabled={isLocked || phase === "reviewing"}
                  completed={completedKeys.includes(item.key)}
                  activeWrong={wrongKey === item.key}
                  activeCorrect={correctGlowKey === item.key}
                  activeHint={hintKey === item.key}
                  memoryHidden={memoryHidden}
                  onClick={handleDoorplateClick}
                />
              ))}
            </div>
          </div>
        </main>

        <footer className="lb-training-footer">
          <p className="lb-training-message">{footerMessage}</p>
          <button type="button" className="lb-training-button" onClick={skipToNextLevel}>
            下一關
          </button>
        </footer>
      </div>
    </div>
  );
}
