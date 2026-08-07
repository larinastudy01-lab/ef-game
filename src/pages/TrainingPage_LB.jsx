import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/GamePage_LB.css";
import { saveUnifiedResult } from "../utils/resultManager";
import {
  analyzeAndSaveLBTraining,
  getLBInitialTrainingConfig,
} from "../ai/lbTrainingAnalyzer";

import backgroundImg from "../asset/LB/LB_background.webp";
import homeImg from "../asset/LB/grandma_sheep_house.webp";
import blowingBubblesImg from "../asset/LB/walk/blowing_bubbles.webp";
import introVideo from "../asset/optimized/mp4/LB_start.mp4";
import stepVideo from "../asset/optimized/mp4/LB_step.mp4";
import endingVideo from "../asset/optimized/mp4/LB_end.mp4";
import homeStartBtn from "../asset/home/start.webp";
import homeSkipBtn from "../asset/home/skip.webp";
import homeNextBtn from "../asset/home/next.webp";
import homeBackBtn from "../asset/return.webp";
import homeAgainBtn from "../asset/home/again.webp";
import homeResultBtn from "../asset/home/result.webp";
import mouseGuideImg from "../asset/mouse.webp";

const RESULT_ROUTE = "/result-lb";
const SESSION_KEY = "LB_TRAINING_RESULT";
const LOCAL_KEY = "lbTrainingResult";
const COMPLETED_LEVELS_STORAGE_KEY = "ef_game_completed_training_levels";
const LB_STAGE_STAR_STORAGE_KEY = "ef_game_training_stage_stars";
const TRAINING_TOTAL_ROUNDS = 1;

const clampNumber = (value, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
};

const clampStarCount = (value) => {
  const stars = Number(value);
  if (!Number.isFinite(stars)) return 1;
  return Math.min(3, Math.max(1, Math.round(stars)));
};

const safeParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const getQueryValue = (search, key) => {
  const params = new URLSearchParams(search || "");
  return params.get(key);
};

const doorplateAssets = require.context("../asset/LB", false, /(?:blue|yellow)_\d{2}\.webp$/);
const walkAssets = require.context("../asset/LB/walk", false, /\.webp$/);
const WALK_IMAGES = walkAssets.keys().sort().map(walkAssets);

function getDoorplateImage(color, number) {
  const imageColor = color === "blue" ? "blue" : "yellow";
  const safeNumber = String(Math.min(30, Math.max(1, Number(number) || 1))).padStart(2, "0");
  return doorplateAssets(`./${imageColor}_${safeNumber}.webp`);
}

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
  { x: 18, y: 68, r: -4 },
  { x: 34, y: 55, r: 3 },
  { x: 50, y: 66, r: -3 },
  { x: 66, y: 53, r: 4 },
  { x: 82, y: 64, r: -4 },
];

const DOORPLATE_POSITIONS_10 = [
  { x: 12, y: 68, r: -4 },
  { x: 22, y: 55, r: 3 },
  { x: 32, y: 66, r: -3 },
  { x: 42, y: 53, r: 4 },
  { x: 52, y: 64, r: -4 },
  { x: 62, y: 51, r: 3 },
  { x: 72, y: 62, r: -3 },
  { x: 80, y: 49, r: 4 },
  { x: 87, y: 36, r: -3 },
  { x: 91, y: 54, r: 3 },
];

const DOORPLATE_POSITIONS_20 = [
  { x: 10, y: 30, r: -4 },
  { x: 19, y: 28, r: 3 },
  { x: 28, y: 30, r: -3 },
  { x: 37, y: 28, r: 4 },
  { x: 46, y: 30, r: -4 },
  { x: 55, y: 28, r: 3 },
  { x: 64, y: 30, r: -3 },
  { x: 73, y: 28, r: 4 },
  { x: 82, y: 31, r: -3 },
  { x: 90, y: 40, r: 3 },
  { x: 82, y: 49, r: -4 },
  { x: 73, y: 47, r: 3 },
  { x: 64, y: 49, r: -3 },
  { x: 55, y: 47, r: 4 },
  { x: 46, y: 49, r: -4 },
  { x: 37, y: 47, r: 3 },
  { x: 28, y: 53, r: -3 },
  { x: 46, y: 66, r: 4 },
  { x: 66, y: 66, r: -3 },
  { x: 86, y: 70, r: 3 },
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
    title: "完整數字小路",
    ruleType: RULE_TYPES.FORWARD,
    taskType: TASK_TYPES.FIND_SEQUENCE,
    maxNumber: 10,
    sequenceLength: 10,
    hintMode: "afterWrong",
    hintAfterWrong: 2,
    iconHint: "1 → 10",
    ability: "持續注意、順序搜尋",
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
    shuffleAfterSteps: [4, 8],
    hintMode: "afterWrong",
    hintAfterWrong: 2,
    iconHint: "看規則 → 找門牌",
    ability: "綜合執行功能",
  },
];

const MAX_LEVEL_PER_GAME = TRAINING_LEVELS.length;

function hasExplicitTrainingLevel(location) {
  const state = location?.state || {};
  const search = location?.search || "";

  return Boolean(
    state.trainingLevel ??
      state.level ??
      getQueryValue(search, "level") ??
      getQueryValue(search, "trainingLevel")
  );
}

function applyAdaptiveConfigToLevel(level, adaptiveConfig = {}) {
  if (!level) return level;

  const nextLevel = { ...level };

  if (adaptiveConfig.hintMode) {
    nextLevel.hintMode = adaptiveConfig.hintMode;
  }

  if (Number.isFinite(Number(adaptiveConfig.hintDelayMs))) {
    nextLevel.hintDelayMs = Number(adaptiveConfig.hintDelayMs);
  }

  if (Number.isFinite(Number(adaptiveConfig.hintAfterWrong))) {
    nextLevel.hintAfterWrong = Number(adaptiveConfig.hintAfterWrong);
  }

  if (Number.isFinite(Number(adaptiveConfig.previewMs))) {
    nextLevel.previewMs = Number(adaptiveConfig.previewMs);
  }

  // 低難度時關閉換位干擾；高難度且原關卡允許時保留換位。
  if (adaptiveConfig.enablePositionShuffle === false) {
    nextLevel.shuffleAfterSteps = [];
  }

  return nextLevel;
}

const getTrainingStageInfo = (location) => {
  const state = location?.state || {};
  const search = location?.search || "";
  const levelFromRoute =
    state.trainingLevel ??
    state.level ??
    getQueryValue(search, "level") ??
    getQueryValue(search, "trainingLevel");

  const level = clampNumber(levelFromRoute || 1, 1, MAX_LEVEL_PER_GAME);
  const stageId =
    state.trainingStageId ||
    state.stageId ||
    getQueryValue(search, "stage") ||
    getQueryValue(search, "trainingStageId") ||
    `lb-L${level}`;

  return {
    level,
    stageId,
    order: Number(state.trainingOrder || getQueryValue(search, "order") || level),
    total: Number(state.trainingTotal || getQueryValue(search, "total") || MAX_LEVEL_PER_GAME),
    todayKey: state.todayKey || getQueryValue(search, "todayKey") || "",
    abilityLabel: state.abilityLabel || "彈性",
  };
};

const saveTrainingStageProgress = ({ stageId, level, stars, finalResult, completed = false }) => {
  const safeStars = clampStarCount(stars);
  const resultMap = safeParse(localStorage.getItem("ef_game_training_stage_results"), {});
  const normalizedResultMap =
    resultMap && typeof resultMap === "object" && !Array.isArray(resultMap) ? resultMap : {};
  const nextResultMap = {
    ...normalizedResultMap,
    [completed ? stageId : `${stageId}_latestAttempt`]: finalResult,
  };

  localStorage.setItem("ef_game_training_stage_results", JSON.stringify(nextResultMap));

  if (!completed) {
    window.dispatchEvent(new Event("storage"));
    return;
  }

  const completedLevels = safeParse(localStorage.getItem(COMPLETED_LEVELS_STORAGE_KEY), []);
  const nextCompletedLevels = Array.isArray(completedLevels)
    ? [...new Set([...completedLevels, stageId, `lb-${level}`])]
    : [stageId, `lb-${level}`];

  localStorage.setItem(COMPLETED_LEVELS_STORAGE_KEY, JSON.stringify(nextCompletedLevels));
  localStorage.setItem(`ef_game_${stageId}_completed`, "true");
  localStorage.setItem(`ef_game_${stageId}_stars`, String(safeStars));
  localStorage.setItem(`ef_game_lb_level_${level}_completed`, "true");
  localStorage.setItem(`ef_game_lb_level_${level}_stars`, String(safeStars));
  localStorage.setItem(`training_lb_level_${level}_completed`, "true");
  localStorage.setItem(`training_lb_level_${level}_stars`, String(safeStars));
  localStorage.setItem(`lb_training_level_${level}_completed`, "true");
  localStorage.setItem(`lb_training_level_${level}_stars`, String(safeStars));

  const starMap = safeParse(localStorage.getItem(LB_STAGE_STAR_STORAGE_KEY), {});
  const nextStarMap = {
    ...(starMap && typeof starMap === "object" && !Array.isArray(starMap) ? starMap : {}),
    [stageId]: { stars: safeStars, gameId: "lb", level, updatedAt: new Date().toISOString() },
    [`lb-${level}`]: safeStars,
  };
  localStorage.setItem(LB_STAGE_STAR_STORAGE_KEY, JSON.stringify(nextStarMap));

  window.dispatchEvent(new Event("storage"));
};

function getPositionsForCount(count) {
  if (count <= 5) return DOORPLATE_POSITIONS_5;
  if (count <= 10) return DOORPLATE_POSITIONS_10;
  return DOORPLATE_POSITIONS_20;
}

function withDoorplateMeta(items, positions, sequence = []) {
  const positionByKey = new Map();
  let nextPositionIndex = 0;

  sequence.forEach((sequenceItem) => {
    if (!sequenceItem?.key || positionByKey.has(sequenceItem.key)) return;
    positionByKey.set(
      sequenceItem.key,
      positions[nextPositionIndex % positions.length]
    );
    nextPositionIndex += 1;
  });

  items.forEach((item) => {
    if (!item?.key || positionByKey.has(item.key)) return;
    positionByKey.set(item.key, positions[nextPositionIndex % positions.length]);
    nextPositionIndex += 1;
  });

  return items.map((item, index) => ({
    ...item,
    plateImg: getDoorplateImage(item.color, item.number),
    position: positionByKey.get(item.key) || positions[index % positions.length],
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

  return withDoorplateMeta(baseItems, getPositionsForCount(baseItems.length), sequence);
}

function getExpectedText(expectedItem) {
  if (!expectedItem) return "";
  if (expectedItem.expectedColor === "red") return `紅色 ${expectedItem.number}`;
  if (expectedItem.expectedColor === "blue") return `藍色 ${expectedItem.number}`;
  return `${expectedItem.number}`;
}

// eslint-disable-next-line no-unused-vars
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

function summarizeLogs(logs, options = {}) {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const correctLogs = safeLogs.filter((log) => log.isCorrect);
  const wrongLogs = safeLogs.filter((log) => !log.isCorrect);
  const hintCount = safeLogs.filter((log) => log.hintShown).length;
  const expectedSteps = Math.max(0, Number(options.expectedSteps) || 0);
  const completedSteps = Math.min(correctLogs.length, expectedSteps || correctLogs.length);
  const completionRate = expectedSteps
    ? Math.round((completedSteps / expectedSteps) * 100)
    : (safeLogs.length ? 100 : 0);
  const reactionTimes = correctLogs.map((log) => log.rt).filter((rt) => typeof rt === "number" && rt > 0);
  const avgReactionTime = reactionTimes.length
    ? Math.round(reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length)
    : 0;

  const errorTypes = wrongLogs.reduce((acc, log) => {
    const key = log.wrongType || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const accuracy = safeLogs.length ? Math.round((correctLogs.length / safeLogs.length) * 100) : 0;
  const score = Math.round((accuracy * 0.65) + (completionRate * 0.35));
  const stars = completionRate >= 100 && score >= 85 ? 3 : completionRate >= 60 && score >= 60 ? 2 : 1;

  return {
    accuracy,
    completionRate,
    completedSteps,
    expectedSteps,
    score,
    stars,
    completed: expectedSteps > 0 && completedSteps >= expectedSteps,
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
  const hidePlateNumber = memoryHidden && !completed && !activeHint;

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
      <img
        src={item.plateImg}
        alt={`${item.color === "red" ? "紅色" : item.color === "blue" ? "藍色" : "綠色"}${item.label}號門牌`}
        className={`lb-doorplate-art ${hidePlateNumber ? "lb-doorplate-art-hidden" : ""}`}
        draggable="false"
      />
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
      <polyline className="lb-connect-line-outline" points={polylinePoints} />
      <polyline className={active ? "lb-connect-line lb-connect-line-active" : "lb-connect-line"} points={polylinePoints} />
    </svg>
  );
}

function WalkingPerson({ point }) {
  if (!point?.position) return null;

  return (
    <img loading="lazy"
      src={WALK_IMAGES[Math.abs(String(point.key || point.number || "walk").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % WALK_IMAGES.length]}
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

      .lb-doorplate-art-hidden {
        opacity: 0.18 !important;
        filter: grayscale(1) brightness(1.35) !important;
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

      .lb-connect-line-outline {
        fill: none !important;
        stroke: rgba(255, 255, 232, 0.95) !important;
        stroke-width: 9.4 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 4px 5px rgba(62, 42, 18, 0.34));
      }

      .lb-connect-line {
        fill: none !important;
        stroke: rgba(255, 137, 38, 0.98) !important;
        stroke-width: 5.4 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 0 5px rgba(255, 218, 82, 0.70));
      }

      .lb-connect-line-active {
        stroke: rgba(255, 91, 36, 1) !important;
        stroke-width: 6.4 !important;
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
        .lb-doorplate-art-hidden {
        opacity: 0.18 !important;
        filter: grayscale(1) brightness(1.35) !important;
      }

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
        left: 50%;
        right: auto;
        bottom: 28px;
        transform: translateX(-50%);
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
      .lb-result-content { margin: 8px 0 18px; }
      .lb-result-panel {
        min-height: 500px;
        gap: 24px;
        padding-top: 42px;
        padding-bottom: 58px;
      }
      .lb-result-panel .lb-result-actions {
        margin-top: 8px;
      }
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

      /* 簡化訓練畫面：移除上方進度條與下方提示，只保留遊戲區與正下方完成按鈕 */
      .lb-training-simple-frame {
        position: relative;
        width: 100vw;
        height: 100svh;
        padding: 0;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: minmax(0, 1fr);
        z-index: 1;
      }

      .lb-training-simple-play {
        position: relative;
        min-height: 0;
        overflow: hidden;
      }

      .lb-training-simple-play .lb-floating-doorplate-layer {
        inset: 28px 34px 96px;
      }

      .lb-training-simple-bottom {
        position: fixed;
        left: 50%;
        bottom: clamp(14px, 2.4vh, 28px);
        transform: translateX(-50%);
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }

      .lb-training-simple-finish {
        min-width: clamp(168px, 15vw, 230px) !important;
        min-height: clamp(56px, 6.2vh, 76px) !important;
        padding: 10px 28px !important;
        border-radius: 24px !important;
        pointer-events: auto;
      }

      @media (max-width: 760px) {
        .lb-training-simple-play .lb-floating-doorplate-layer { inset: 18px 12px 92px; }
        .lb-training-simple-bottom { bottom: 12px; }
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
        .lb-guided-skip { left: 50%; right: auto; bottom: 22px; transform: translateX(-50%); }
        .lb-result-actions { gap: 10px; }
        .lb-result-metrics { grid-template-columns: 1fr !important; }
      }

    `}</style>
  );
}

export default function TrainingPage_LB() {
  const navigate = useNavigate();
  const location = useLocation();
  const trainingStage = getTrainingStageInfo(location);
  const stageLevelIndex = clampNumber(trainingStage.level, 1, TRAINING_LEVELS.length) - 1;
  const adaptiveInitial = useMemo(() => getLBInitialTrainingConfig(), []);
  const adaptiveStartIndex = hasExplicitTrainingLevel(location)
    ? stageLevelIndex
    : clampNumber(
        adaptiveInitial?.recommendedLevelIndex ?? stageLevelIndex,
        0,
        TRAINING_LEVELS.length - 1
      );
  const stageLevel = applyAdaptiveConfigToLevel(
    TRAINING_LEVELS[adaptiveStartIndex],
    adaptiveInitial?.trainingConfig
  );

  const [phase, setPhase] = useState("start");
  const [levelIndex, setLevelIndex] = useState(adaptiveStartIndex);
  const [stepIndex, setStepIndex] = useState(0);
  const [displayItems, setDisplayItems] = useState(() => buildDisplayItems(stageLevel));
  const [completedKeys, setCompletedKeys] = useState([]);
  const [clickedPath, setClickedPath] = useState([]);
  const [wrongKey, setWrongKey] = useState(null);
  const [correctGlowKey, setCorrectGlowKey] = useState(null);
  const [hintKey, setHintKey] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [, setFooterMessage] = useState("先選一條小路開始練習");
  const [memoryHidden, setMemoryHidden] = useState(false);
  const [walkingIndex, setWalkingIndex] = useState(0);
  const [summary, setSummary] = useState(null);

  const delayTimerRef = useRef(null);
  const wrongFlashTimerRef = useRef(null);
  const hintTimerRef = useRef(null);
  const previewTimerRef = useRef(null);
  const stepRafRef = useRef(null);
  const reviewIntervalRef = useRef(null);
  const reviewEndTimerRef = useRef(null);
  const stepStartTimeRef = useRef(0);
  const logsRef = useRef([]);
  const completedKeysRef = useRef([]);
  const wrongStepCountRef = useRef(0);
  const totalStartedAtRef = useRef(0);
  const clickedPathRef = useRef([]);
  const introVideoRef = useRef(null);
  const stepVideoRef = useRef(null);
  const endingVideoRef = useRef(null);

  const currentLevel = useMemo(
    () =>
      applyAdaptiveConfigToLevel(
        TRAINING_LEVELS[levelIndex],
        adaptiveInitial?.trainingConfig
      ),
    [levelIndex, adaptiveInitial]
  );
  const currentSequence = useMemo(() => buildSequence(currentLevel), [currentLevel]);
  const adaptiveDifficultyLevel = clampNumber(
    adaptiveInitial?.difficultyLevel ?? 3,
    1,
    5
  );
  const adaptiveDifficulty = adaptiveInitial?.difficulty || "normal";
  const activeFeedbackConfig = {
    ...TRAINING_CONFIG,
    ...(adaptiveInitial?.trainingConfig || {}),
  };
  const expectedItem = currentSequence[stepIndex] || null;

  const clearTrainingTimers = useCallback(() => {
    clearTimeout(delayTimerRef.current);
    clearTimeout(wrongFlashTimerRef.current);
    clearTimeout(hintTimerRef.current);
    clearTimeout(previewTimerRef.current);
    clearTimeout(reviewEndTimerRef.current);
    clearInterval(reviewIntervalRef.current);
    cancelAnimationFrame(stepRafRef.current);

    delayTimerRef.current = null;
    wrongFlashTimerRef.current = null;
    hintTimerRef.current = null;
    previewTimerRef.current = null;
    reviewEndTimerRef.current = null;
    reviewIntervalRef.current = null;
    stepRafRef.current = null;
  }, []);

  const pauseVideo = useCallback((videoRef) => {
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
  }, []);

  const pauseAllVideos = useCallback(() => {
    pauseVideo(introVideoRef);
    pauseVideo(stepVideoRef);
    pauseVideo(endingVideoRef);
  }, [pauseVideo]);

  function setTrainingPhase(nextPhase) {
    pauseAllVideos();
    setPhase(nextPhase);
  }

  useEffect(() => {
    return () => {
      clearTrainingTimers();
      pauseAllVideos();
    };
  }, [clearTrainingTimers, pauseAllVideos]);

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
    const level = applyAdaptiveConfigToLevel(
      TRAINING_LEVELS[nextLevelIndex],
      adaptiveInitial?.trainingConfig
    );
    clearTrainingTimers();

    setLevelIndex(nextLevelIndex);
    setStepIndex(0);
    setDisplayItems(buildDisplayItems(level));
    setCompletedKeys([]);
    completedKeysRef.current = [];
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

  function startTraining(startIndex = stageLevelIndex) {
    logsRef.current = [];
    totalStartedAtRef.current = performance.now();
    sessionStorage.removeItem(SESSION_KEY);
    setSummary(null);
    resetLevel(startIndex);
    setTrainingPhase("introVideo");
    setFooterMessage("先看動畫，等等開始練習");
  }

  function handleIntroVideoEnd() {
    setTrainingPhase("stepVideo");
    setFooterMessage("看看這一關要怎麼玩");
  }

  function handleStepVideoEnd() {
    startCurrentLevel();
  }

  function handleEndingVideoEnd() {
    setTrainingPhase("result");
  }


  function startCurrentLevel() {
    resetLevel(levelIndex);
    clearTrainingTimers();
    setTrainingPhase("playing");
    const level = applyAdaptiveConfigToLevel(
      TRAINING_LEVELS[levelIndex],
      adaptiveInitial?.trainingConfig
    );
    setFooterMessage(`找：${getExpectedText(buildSequence(level)[0])}`);

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
      difficulty: adaptiveDifficulty,
      difficultyLevel: adaptiveDifficultyLevel,
      difficultyLabel: adaptiveInitial?.difficultyLabel || "普通",
      abilityType: "flexibility",

      levelId: currentLevel.id,
      chapter: currentLevel.chapter,
      levelTitle: currentLevel.title,
      taskType: currentLevel.taskType,
      ruleType: currentLevel.ruleType,
      isSwitch: currentLevel.ruleType === RULE_TYPES.RED_BLUE || currentLevel.ruleType === RULE_TYPES.BLUE_RED,
      hasInterference:
        currentLevel.taskType === TASK_TYPES.DISTRACTOR_DOORS ||
        currentLevel.taskType === TASK_TYPES.MIXED_MISSION ||
        Boolean(currentLevel.shuffleAfterSteps?.length),
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
    clearTimeout(wrongFlashTimerRef.current);
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
      setWrongKey(null);
      setHintKey(null);

      // 過關判定改用本次點擊後即時計算出的 nextCompleted.length，
      // 避免依賴 React 非同步 state 導致混合任務或記憶隱藏關卡判定錯位。
      const nextCompleted = [...completedKeysRef.current, item.key];
      completedKeysRef.current = nextCompleted;
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
          setDisplayItems((prev) =>
            withDoorplateMeta(prev, getPositionsForCount(prev.length), currentSequence)
          );
          setFooterMessage("門牌位置已整理，繼續照順序找");
        }

        setStepIndex(nextStep);
        setIsLocked(false);
      }, activeFeedbackConfig.feedbackDelayCorrectMs);
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

    // 誤點後不前進、不把錯誤門牌設為完成，並立即解鎖讓孩子可以重新點選。
    setIsLocked(false);
    wrongFlashTimerRef.current = setTimeout(() => {
      setWrongKey(null);
      wrongFlashTimerRef.current = null;
    }, activeFeedbackConfig.feedbackDelayWrongMs);
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
          finishTraining();
        }, 620);
      }
    }, activeFeedbackConfig.reviewStepMs || TRAINING_CONFIG.reviewStepMs);
  }

  function skipToNextLevel() {
    const completedStepCount = completedKeysRef.current.length;

    if (completedStepCount < currentSequence.length) {
      setHintKey(expectedItem?.key || null);
      setFooterMessage(
        expectedItem
          ? `還沒完成，下一個請找：${getExpectedText(expectedItem)}`
          : "還沒完成這條小路"
      );
      return;
    }

    if (clickedPathRef.current.length > 0 && phase !== "reviewing") {
      reviewPathThenNext();
      return;
    }

    clearTrainingTimers();
    finishTraining();
  }

  function finishTraining() {
    clearTrainingTimers();

    const finalLogs = logsRef.current;
    const expectedStepCount = currentSequence.length;
    const completedStepCount = finalLogs.filter((log) => log.levelId === currentLevel.id && log.isCorrect).length;
    const isLevelCompleted = expectedStepCount > 0 && completedStepCount >= expectedStepCount;
    const finishReason = isLevelCompleted ? "completed" : "manualIncomplete";
    const resultSummary = summarizeLogs(finalLogs, { expectedSteps: expectedStepCount });

    const levelSummaries = [currentLevel].map((level) => {
      const levelLogs = finalLogs.filter((log) => log.levelId === level.id);
      const levelExpectedSteps = buildSequence(level).length;
      return {
        levelId: level.id,
        chapter: level.chapter,
        title: level.title,
        taskType: level.taskType,
        ability: level.ability,
        ...summarizeLogs(levelLogs, { expectedSteps: levelExpectedSteps }),
      };
    });

    const weakestLevel = levelSummaries
      .filter((item) => item.correctTrials + item.wrongTrials > 0)
      .sort((a, b) => a.accuracy - b.accuracy || b.hintCount - a.hintCount)[0];

    const adaptiveAnalysis = analyzeAndSaveLBTraining({
      records: finalLogs,
      currentDifficulty: adaptiveDifficultyLevel,
      currentLevelIndex: levelIndex,
      maximumLevelIndex: TRAINING_LEVELS.length - 1,
      completed: isLevelCompleted,
      finishReason,
    });

    const payload = {
      task: "LB",
      gameId: "LB",
      taskName: "Linking Balloons Training",
      mode: TRAINING_CONFIG.mode,
      difficulty: adaptiveDifficulty,
      difficultyLevel: adaptiveDifficultyLevel,
      difficultyLabel: adaptiveInitial?.difficultyLabel || "普通",
      nextDifficulty: adaptiveAnalysis.nextDifficulty,
      nextDifficultyLevel: adaptiveAnalysis.nextDifficultyLevel,
      nextDifficultyLabel: adaptiveAnalysis.nextDifficultyLabel,
      abilityType: "flexibility",
      stageId: trainingStage.stageId,
      trainingLevel: trainingStage.level,
      trainingOrder: trainingStage.order,
      trainingTotal: trainingStage.total || TRAINING_LEVELS.length,
      totalRounds: TRAINING_TOTAL_ROUNDS,
      totalLevels: 1,
      completedLevels: levelSummaries.filter((item) => item.completed).length,
      totalPlayTime: Math.round(performance.now() - totalStartedAtRef.current),
      ...resultSummary,
      completed: isLevelCompleted,
      finishReason,
      score: resultSummary.score,
      levelSummaries,
      weakestLevel,
      recommendedNextTraining:
        adaptiveAnalysis?.reason ||
        (weakestLevel
          ? `下次可以多練「${weakestLevel.chapter}：${weakestLevel.title}」。`
          : "下次可以從數字小路開始暖身。"),
      adaptiveSource: adaptiveInitial?.source || "default",
      adaptiveAnalysis,
      nextTrainingConfig: adaptiveAnalysis.nextTrainingConfig,
      recommendedLevelRange: adaptiveAnalysis.recommendedLevelRange,
      nextLevelIndex: adaptiveAnalysis.nextLevelIndex,
      supportSuggestions: adaptiveAnalysis.supportSuggestions,
      logs: finalLogs,
      trialLogs: finalLogs,
      config: activeFeedbackConfig,
      adaptiveConfig: adaptiveInitial,
      finishedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
    localStorage.setItem("latestLBTrainingResult", JSON.stringify(payload));
    saveTrainingStageProgress({
      stageId: trainingStage.stageId,
      level: trainingStage.level,
      stars: resultSummary.stars,
      finalResult: payload,
      completed: isLevelCompleted,
    });

    saveUnifiedResult({
      rawResult: payload,
      gameId: "LB",
      mode: TRAINING_CONFIG.mode,
      difficulty: adaptiveDifficulty,
      route: "/training-linking-balloons",
      visibleRoles: ["child", "parent", "clinician"],
    });

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
          <section className="lb-soft-panel lb-start-panel game-start-card-artwork lb-opening-card-artwork" aria-label="LB 訓練開始">
            <h1 className="lb-game-title">Linking Balloons</h1>
            <div className="lb-start-content">
              <div className="lb-dialog-bubble lb-opening-bubble">
                先跟綿羊奶奶練習這一關的小路，照順序把小路連回家。
              </div>
              <div className="lb-round-icon lb-start-avatar">
                <img width={1024} height={1024} loading="lazy" src={blowingBubblesImg} alt="綿羊奶奶和朋友們" draggable="false" />
              </div>
            </div>
            <div className="lb-guided-action lb-guided-start">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-start" onClick={() => startTraining(adaptiveStartIndex)} aria-label="開始訓練">
                <img width={1024} height={341} src={homeStartBtn} alt="開始" draggable="false" />
              </button>
              <img width={1024} height={1024} loading="lazy" className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
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
          <section className="lb-soft-panel lb-video-panel game-start-card-artwork lb-video-card-artwork" aria-label="開始動畫">
            <div className="lb-video-frame">
              <video
                ref={introVideoRef}
                src={introVideo}
                autoPlay
                muted
                playsInline
                controls
                onEnded={handleIntroVideoEnd}
                className="lb-video"
              />
            </div>
            <div className="lb-video-actions"><div className="lb-guided-action lb-guided-skip">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-skip" onClick={handleIntroVideoEnd} aria-label="跳過動畫">
                <img width={1024} height={341} loading="lazy" src={homeSkipBtn} alt="跳過動畫" draggable="false" />
              </button>
            </div><div className="lb-guided-action lb-guided-next">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-next" onClick={handleIntroVideoEnd} aria-label="下一步"><img width={1024} height={341} loading="lazy" src={homeNextBtn} alt="下一步" draggable="false" /></button>
              <img width={1024} height={1024} loading="lazy" className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
            </div></div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "stepVideo") {
    return (
      <div className="lb-page lb-page-with-bg lb-training-card-page lb-srt-skin" style={{ "--lb-bg-image": `url(${backgroundImg})` }}>
        <TrainingInlineStyle />
        <main className="lb-center-shell">
          <section className="lb-soft-panel lb-video-panel game-start-card-artwork lb-video-card-artwork" aria-label="步驟說明動畫">
            <div className="lb-video-frame">
              <video
                ref={stepVideoRef}
                src={stepVideo}
                autoPlay
                muted
                playsInline
                controls
                onEnded={handleStepVideoEnd}
                className="lb-video"
              />
            </div>
            <div className="lb-video-actions"><div className="lb-guided-action lb-guided-skip">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-skip" onClick={handleStepVideoEnd} aria-label="跳過步驟說明">
                <img width={1024} height={341} loading="lazy" src={homeSkipBtn} alt="跳過步驟說明" draggable="false" />
              </button>
            </div><div className="lb-guided-action lb-guided-next">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-next" onClick={handleStepVideoEnd} aria-label="下一步"><img width={1024} height={341} loading="lazy" src={homeNextBtn} alt="下一步" draggable="false" /></button>
              <img width={1024} height={1024} loading="lazy" className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="" aria-hidden="true" draggable="false" />
            </div></div>
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
          <section className="lb-soft-panel lb-video-panel game-start-card-artwork lb-video-card-artwork" aria-label="結束動畫">
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
                <img width={1024} height={341} loading="lazy" src={homeSkipBtn} alt="跳過動畫" draggable="false" />
              </button>
              <img width={1024} height={1024} loading="lazy" className="lb-mouse-guide lb-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" draggable="false" />
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
          <section className="lb-soft-panel lb-result-panel game-result-card-artwork lb-summary-card-artwork" aria-label="訓練結果">
            <div className="lb-cute-stars" aria-label={`${resultStars} 顆星`}>
              {[1, 2, 3].map((star) => (
                <span key={star} className={`lb-cute-star ${star <= resultStars ? "is-on" : ""}`}>★</span>
              ))}
            </div>
            <div className="lb-start-content lb-result-content">
              <div className="lb-dialog-bubble">
                訓練完成！你幫綿羊奶奶完成這一關的小路。
              </div>
              <div className="lb-round-icon lb-result-icon">
                <img width={1024} height={1024} loading="lazy" src={homeImg} alt="LB 訓練圖示" draggable="false" />
              </div>
            </div>
            <div className="lb-result-actions">
              <button type="button" className="lb-forest-button lb-image-button lb-btn-home" onClick={() => navigate("/game-menu")} aria-label="回到森林">
                <img width={1024} height={341} loading="lazy" src={homeBackBtn} alt="回到森林" draggable="false" />
              </button>
              <button type="button" className="lb-forest-button lb-image-button lb-btn-replay" onClick={() => startTraining(adaptiveStartIndex)} aria-label="再練一次">
                <img width={1024} height={341} loading="lazy" src={homeAgainBtn} alt="再練一次" draggable="false" />
              </button>
              <button type="button" className="lb-forest-button lb-image-button lb-btn-detail" onClick={goResultPage} aria-label="詳細結果">
                <img width={1024} height={341} loading="lazy" src={homeResultBtn} alt="詳細結果" draggable="false" />
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
      <div className="lb-training-simple-frame">
        <main className="lb-training-simple-play" onClick={handleBlankClick}>
          <div className="lb-floating-doorplate-layer" aria-label="訓練門牌遊戲區">
            <LBPathOverlay points={clickedPath} active={phase === "reviewing"} />
            <img width={1024} height={1024} loading="lazy" src={homeImg} alt="小屋" className="lb-map-home-img" draggable="false" />
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
        </main>

        <footer className="lb-training-simple-bottom">
          <button type="button" className="lb-forest-button lb-training-simple-finish" onClick={skipToNextLevel}>
            完成作答
          </button>
        </footer>
      </div>
    </div>
  );
}
