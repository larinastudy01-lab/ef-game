// src/pages/TrainingPage_LB.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/GamePage_LB.css";

import backgroundImg from "../asset/LB/background.png";
import sheepImg from "../asset/LB/sheep.png";
import homeImg from "../asset/LB/home.png";
import houseNumber01Img from "../asset/LB/house number_01.png";

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
    `}</style>
  );
}

export default function TrainingPage_LB() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("menu");
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

  useEffect(() => {
    return () => {
      clearTrainingTimers();
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
    resetLevel(startIndex);
    showLevelIntro(startIndex);
  }

  function showLevelIntro(nextIndex) {
    resetLevel(nextIndex);
    setPhase("levelIntro");
    setFooterMessage("看任務卡，準備練習");
  }

  function startCurrentLevel() {
    resetLevel(levelIndex);
    clearTrainingTimers();
    setPhase("playing");
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
    setPhase("reviewing");
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
    setPhase("result");
  }

  function goResultPage() {
    const payload = summary || JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    navigate(RESULT_ROUTE, { state: payload, replace: true });
  }

  if (phase === "menu") {
    return (
      <div className="lb-page lb-page-with-bg lb-training-card-page" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
        <TrainingInlineStyle />
        <section className="lb-training-card">
          <h1>綿羊奶奶練習小路</h1>
          <p>訓練版會有提示、重試、假門牌、記憶門牌與紅藍規則切換。測驗前可以先在這裡練習。</p>

          <div className="lb-training-level-grid">
            {TRAINING_LEVELS.map((level, index) => (
              <div key={level.id} className="lb-training-level-card">
                <strong>{level.id}｜{level.title}</strong>
                <span>{level.chapter}</span>
                <span>{level.iconHint}</span>
              </div>
            ))}
          </div>

          <button type="button" className="lb-training-button" onClick={() => startTraining(0)}>
            開始訓練
          </button>
        </section>
      </div>
    );
  }

  if (phase === "levelIntro") {
    return (
      <div className="lb-page lb-page-with-bg lb-training-card-page" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
        <TrainingInlineStyle />
        <section className="lb-training-card">
          <h1>{currentLevel.chapter}</h1>
          <h2>{currentLevel.id}｜{currentLevel.title}</h2>
          <p>{currentLevel.ability}</p>
          <div className="lb-training-hint-card" style={{ margin: "24px 0" }}>
            {getRuleIcon(currentLevel)}
          </div>
          <p>
            {currentLevel.taskType === TASK_TYPES.MEMORY_PATH
              ? "先看門牌位置，數字藏起來後再照順序點。"
              : currentLevel.taskType === TASK_TYPES.DISTRACTOR_DOORS
                ? "有些是假門牌，不要被問號或多餘數字騙走。"
                : currentLevel.shuffleAfterSteps
                  ? "小路走到一半時，門牌可能會換位置。"
                  : "跟著任務卡上的規則，把綿羊奶奶帶回家。"}
          </p>
          <button type="button" className="lb-training-button" onClick={startCurrentLevel}>
            開始這一關
          </button>
        </section>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="lb-page lb-page-with-bg lb-training-card-page" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
        <TrainingInlineStyle />
        <section className="lb-training-card">
          <h1>訓練完成</h1>
          <p>星星：{"★".repeat(summary?.stars || 1)}{"☆".repeat(3 - (summary?.stars || 1))}</p>
          <div className="lb-training-result-list">
            <div className="lb-training-level-card"><strong>正確率</strong><span>{summary?.accuracy || 0}%</span></div>
            <div className="lb-training-level-card"><strong>提示次數</strong><span>{summary?.hintCount || 0}</span></div>
            <div className="lb-training-level-card"><strong>平均反應</strong><span>{summary?.avgReactionTime || 0} ms</span></div>
            <div className="lb-training-level-card"><strong>建議</strong><span>{summary?.recommendedNextTraining}</span></div>
          </div>
          <button type="button" className="lb-training-button" onClick={goResultPage}>
            查看詳細結果
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="lb-page lb-page-with-bg lb-training-page" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
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
