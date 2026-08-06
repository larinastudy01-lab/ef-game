// src/pages/TrainingPage_DCCS.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/GamePage_DCCS.css";

import dccsBackgroundImg from "../asset/DCCS/DCCS_background.webp";
import startVideo from "../asset/optimized/mp4/DCCS_start.mp4";
import stepVideo from "../asset/mp4/DCCS_step.mp4";
import endingVideo from "../asset/optimized/mp4/DCCS_end.mp4";
import homeStartBtn from "../asset/home/start.webp";
import homeSkipBtn from "../asset/home/skip.webp";
import homeNextBtn from "../asset/home/next.webp";
import homeBackBtn from "../asset/home/back.webp";
import homeAgainBtn from "../asset/home/again.webp";
import homeResultBtn from "../asset/home/result.webp";
import mouseGuideImg from "../asset/mouse.webp";

import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { saveUnifiedResult } from "../utils/resultManager";
import { calculateDccsScore } from "../utils/dccsScoring";
import { analyzeDccsTraining } from "../ai/dccsTrainingAnalyzer";

import peacockImg from "../asset/DCCS/dccs_peacock.webp";
import basketTopImg from "../asset/DCCS/box_left.webp";
import basketBottomImg from "../asset/DCCS/box_right.webp";

import {
  dccsClothingCards,
  normalCards,
  baggedCards,
  colorLabels as clothingColorLabels,
  typeLabels as clothingTypeLabels,
} from "../config/dccsClothingData";

import redHatImg from "../asset/DCCS/red hat.webp";
import blueHatImg from "../asset/DCCS/blue hat.webp";
import redShirtImg from "../asset/DCCS/red shirt.webp";
import blueShirtImg from "../asset/DCCS/blue shirt.webp";

const MENU_ROUTE = "/game-menu";
const RESULT_ROUTE = "/result-dccs";

// 訓練流程使用 DCCS_start.mp4、DCCS_step.mp4 與 DCCS_end.mp4。
const START_VIDEO_SRC = startVideo;
const STEP_VIDEO_SRC = stepVideo;
const END_VIDEO_SRC = endingVideo;

const COMPLETED_LEVELS_STORAGE_KEY = "ef_game_completed_training_levels";
const TRAINING_STAGE_STARS_KEY = "ef_game_training_stage_stars";
const TRAINING_RESULTS_KEY = "ef_game_training_results";

const safeParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const getStoredCurrentChild = () => {
  if (typeof window === "undefined") return null;

  const currentChild = safeParse(window.localStorage?.getItem("currentChild"), null);
  const currentChildId =
    currentChild?.childId ||
    currentChild?.id ||
    currentChild?.patientId ||
    window.localStorage?.getItem("currentChildId") ||
    null;

  if (!currentChildId) return currentChild || null;

  return {
    ...(currentChild && typeof currentChild === "object" ? currentChild : {}),
    id: currentChildId,
    childId: currentChildId,
    patientId: currentChildId,
    name: currentChild?.name || currentChild?.nickname || "",
    nickname: currentChild?.nickname || currentChild?.name || "",
  };
};

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

const getTodayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const getRouteTrainingContext = (location) => {
  const searchParams = new URLSearchParams(location.search);
  const levelFromQuery = searchParams.get("level");
  const stageFromQuery = searchParams.get("stage");
  const state = location.state || {};

  const trainingLevel = clampNumber(
    state.trainingLevel ?? levelFromQuery,
    1,
    10
  );

  return {
    trainingLevel,
    trainingStageId: state.trainingStageId || stageFromQuery || `${getTodayKey()}-dccs-L${trainingLevel}`,
    trainingOrder: state.trainingOrder || trainingLevel,
    trainingTotal: state.trainingTotal || 10,
    todayKey: state.todayKey || getTodayKey(),
    difficultyLabel: state.difficultyLabel || `第 ${trainingLevel} 關`,
    fromMap: Boolean(state.trainingStageId || stageFromQuery || levelFromQuery),
  };
};

const normalizePercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number <= 1 ? number * 100 : number;
};

const readLatestDccsTestResult = () => {
  const currentChild = getStoredCurrentChild();
  const childId =
    currentChild?.childId ||
    currentChild?.id ||
    currentChild?.patientId ||
    null;

  const keys = [
    "DCCS_TEST_RESULT",
    "DCCS_RESULT",
    "dccsTestResult",
    "latestDccsTestResult",
    childId ? `dccsTestResult_${childId}` : null,
    "dccs_test_result",
    "ef_game_dccs_test_result",
    "ef_game_DCCS_test_result",
  ].filter(Boolean);

  const candidates = keys
    .flatMap((key) => [sessionStorage.getItem(key), localStorage.getItem(key)])
    .map((value) => safeParse(value, null))
    .filter((value) => value && typeof value === "object");

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  })[0];
};

const getDccsTestProfile = () => {
  const result = readLatestDccsTestResult();

  if (!result) {
    return {
      hasTestResult: false,
      accuracy: null,
      switchAccuracy: null,
      avgReactionTime: null,
      baselineShift: 0,
    };
  }

  const accuracy = normalizePercent(
    result.accuracy ?? result.correctRate ?? result.score ?? result.totalAccuracy
  );
  const switchAccuracy = normalizePercent(
    result.switchAccuracy ?? result.ruleSwitchAccuracy ?? result.flexibilityScore
  );
  const avgReactionTime = Number(
    result.avgReactionTime ?? result.averageReactionTime ?? result.meanReactionTime
  );
  const score = [accuracy, switchAccuracy].filter((value) => Number.isFinite(value));
  const mainScore = score.length > 0 ? score.reduce((sum, value) => sum + value, 0) / score.length : null;

  let baselineShift = 0;
  if (mainScore !== null) {
    if (mainScore >= 85 && (!Number.isFinite(avgReactionTime) || avgReactionTime <= 2200)) baselineShift = 1;
    else if (mainScore < 55 || (Number.isFinite(avgReactionTime) && avgReactionTime >= 4200)) baselineShift = -1;
  }

  return {
    hasTestResult: true,
    accuracy,
    switchAccuracy,
    avgReactionTime: Number.isFinite(avgReactionTime) ? avgReactionTime : null,
    baselineShift,
  };
};

const DCCS_DIFFICULTY_ORDER = [
  "colorIntro",
  "colorStable",
  "typeIntro",
  "typeStable",
  "switchClear",
  "switchEarly",
  "switchMaintain",
  "lowInterference",
  "highInterference",
  "testLike",
];

const SINGLE_RULE_LEVEL_IDS = new Set([
  "colorIntro",
  "colorStable",
  "typeIntro",
  "typeStable",
]);

const getDifficultyForTrainingLevel = (trainingLevel, testProfile) => {
  const safeLevel = clampNumber(trainingLevel, 1, DCCS_DIFFICULTY_ORDER.length);
  const baseIndex = safeLevel - 1;
  const shiftedIndex = clampNumber(
    baseIndex + (testProfile?.baselineShift || 0),
    0,
    DCCS_DIFFICULTY_ORDER.length - 1
  );

  // 保留訓練關卡的基本節奏：
  // 第 1-2 關以顏色規則為主，第 3-4 關以種類規則為主。
  // 第 7 關後逐步增加切換與干擾，避免前面關卡跳太快。
  if (safeLevel <= 2) {
    return DCCS_DIFFICULTY_ORDER[Math.min(shiftedIndex, 2)];
  }

  if (safeLevel <= 4) {
    return DCCS_DIFFICULTY_ORDER[Math.min(Math.max(shiftedIndex, 1), 5)];
  }

  if (safeLevel >= 7) {
    return DCCS_DIFFICULTY_ORDER[Math.max(shiftedIndex, 6)];
  }

  return DCCS_DIFFICULTY_ORDER[shiftedIndex];
};

const getLevelCategory = (levelId) => {
  if (SINGLE_RULE_LEVEL_IDS.has(levelId)) return "singleRule";
  if (levelId === "lowInterference" || levelId === "highInterference") return "interference";
  if (levelId === "testLike") return "testLike";
  return "switch";
};

const mergeJsonObject = (key, patch) => {
  const previous = safeParse(localStorage.getItem(key), {});
  const next = {
    ...(previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {}),
    ...patch,
  };
  localStorage.setItem(key, JSON.stringify(next));
  return next;
};

const rememberCompletedStage = (stageId) => {
  const previous = safeParse(localStorage.getItem(COMPLETED_LEVELS_STORAGE_KEY), []);
  const list = Array.isArray(previous) ? previous : [];
  const next = [...new Set([...list, stageId])];
  localStorage.setItem(COMPLETED_LEVELS_STORAGE_KEY, JSON.stringify(next));
};

const persistTrainingStageResult = ({ context, result, stars }) => {
  const stageId = context.trainingStageId;
  const level = context.trainingLevel;
  const starPayload = {
    [stageId]: stars,
    [`dccs-${level}`]: stars,
    [`${context.todayKey}-dccs-${level}`]: stars,
    [`dccs_L${level}`]: stars,
  };

  rememberCompletedStage(stageId);
  mergeJsonObject(TRAINING_STAGE_STARS_KEY, starPayload);
  mergeJsonObject("trainingLevelStars", starPayload);
  mergeJsonObject(TRAINING_RESULTS_KEY, {
    [stageId]: {
      ...result,
      stars,
      trainingLevel: level,
      trainingStageId: stageId,
    },
  });

  localStorage.setItem(`ef_game_${stageId}_completed`, "true");
  localStorage.setItem(`ef_game_${stageId}_stars`, String(stars));
  localStorage.setItem(`ef_game_dccs_level_${level}_completed`, "true");
  localStorage.setItem(`ef_game_dccs_level_${level}_stars`, String(stars));
  localStorage.setItem(`training_dccs_level_${level}_completed`, "true");
  localStorage.setItem(`training_dccs_level_${level}_stars`, String(stars));
  localStorage.setItem(`dccs_training_level_${level}_completed`, "true");
  localStorage.setItem(`dccs_training_level_${level}_stars`, String(stars));
};

const PHASE = {
  START: "start",
  VIDEO_INTRO: "video_intro",
  VIDEO_STEP: "video_step",
  PLAYING: "playing",
  SWITCH_RULE: "switch_rule",
  BAG_RULE: "bag_rule",
  END_VIDEO: "end_video",
  FINISH: "finish",
};

const COLOR_PRIORITY = [
  "pink",
  "blue",
  "yellow",
  "green",
  "purple",
  "red",
  "orange",
];

const TYPE_PRIORITY = [
  "tshirt",
  "dress",
  "gloves",
  "jacket",
  "scarf",
  "shorts",
  "skirt",
  "sneakers",
  "socks",
  "hat",
  "pants",
  "shirt",
];

const DEFAULT_COLOR_LABELS = {
  pink: "粉紅色",
  blue: "藍色",
  yellow: "黃色",
  green: "綠色",
  purple: "紫色",
  red: "紅色",
  orange: "橘色",
};

const DEFAULT_TYPE_LABELS = {
  tshirt: "上衣",
  dress: "洋裝",
  gloves: "手套",
  jacket: "外套",
  scarf: "圍巾",
  shorts: "短褲",
  skirt: "裙子",
  sneakers: "鞋子",
  socks: "襪子",
  hat: "帽子",
  pants: "褲子",
  shirt: "上衣",
};

const colorLabels = {
  ...DEFAULT_COLOR_LABELS,
  ...(clothingColorLabels || {}),
};

const typeLabels = {
  ...DEFAULT_TYPE_LABELS,
  ...(clothingTypeLabels || {}),
};

function normalizeToken(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\.(png|jpe?g|webp|svg)$/i, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

function normalizeColor(value = "") {
  const token = normalizeToken(value);
  const aliases = {
    pink: "pink",
    blue: "blue",
    yellow: "yellow",
    green: "green",
    purple: "purple",
    red: "red",
    orange: "orange",
    "粉紅色": "pink",
    "粉紅": "pink",
    "藍色": "blue",
    "黃色": "yellow",
    "綠色": "green",
    "紫色": "purple",
    "紅色": "red",
    "橘色": "orange",
    "橙色": "orange",
  };

  if (aliases[token]) return aliases[token];
  return COLOR_PRIORITY.find((color) => token.includes(color)) || token;
}

function normalizeType(value = "") {
  const token = normalizeToken(value);
  const aliases = {
    t_shirt: "tshirt",
    t_shirts: "tshirt",
    tshirt: "tshirt",
    tshirts: "tshirt",
    shirt: "tshirt",
    shirts: "tshirt",
    top: "tshirt",
    tops: "tshirt",
    dress: "dress",
    dresses: "dress",
    glove: "gloves",
    gloves: "gloves",
    jacket: "jacket",
    jackets: "jacket",
    scarf: "scarf",
    scarves: "scarf",
    short: "shorts",
    shorts: "shorts",
    skirt: "skirt",
    skirts: "skirt",
    sneaker: "sneakers",
    sneakers: "sneakers",
    shoe: "sneakers",
    shoes: "sneakers",
    sock: "socks",
    socks: "socks",
    hat: "hat",
    hats: "hat",
    cap: "hat",
    caps: "hat",
    pants: "pants",
    trouser: "pants",
    trousers: "pants",
    "上衣": "tshirt",
    "洋裝": "dress",
    "手套": "gloves",
    "外套": "jacket",
    "圍巾": "scarf",
    "短褲": "shorts",
    "裙子": "skirt",
    "鞋子": "sneakers",
    "襪子": "socks",
    "帽子": "hat",
    "褲子": "pants",
  };

  if (aliases[token]) return aliases[token];

  const matched = Object.keys(aliases).find((key) => token.includes(key));
  return matched ? aliases[matched] : token;
}

function getImageSource(raw = {}) {
  return (
    raw.normalImg ||
    raw.normalImage ||
    raw.img ||
    raw.image ||
    raw.src ||
    raw.url ||
    raw.asset ||
    null
  );
}

function getBagImageSource(raw = {}) {
  return (
    raw.bagImg ||
    raw.bagImage ||
    raw.packagedImg ||
    raw.packagedImage ||
    raw.bag ||
    null
  );
}

function isBagRecord(raw = {}) {
  if (raw.isBagged === true || raw.bagged === true || raw.variant === "bag") {
    return true;
  }

  const sourceText = [
    raw.id,
    raw.key,
    raw.name,
    raw.filename,
    raw.path,
    raw.src,
    raw.url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /(^|[\\/_-])bag([\\/_-]|$)|packaged|plastic/.test(sourceText);
}

function inferColor(raw = {}) {
  const direct = raw.color || raw.colorKey || raw.colour || raw.colorName;
  if (direct) return normalizeColor(direct);

  const sourceText = [raw.id, raw.key, raw.name, raw.filename, raw.path]
    .filter(Boolean)
    .join("_");

  return normalizeColor(sourceText);
}

function inferType(raw = {}) {
  const direct =
    raw.type || raw.typeKey || raw.category || raw.clothingType || raw.kind;
  if (direct) return normalizeType(direct);

  const sourceText = [raw.id, raw.key, raw.name, raw.filename, raw.path]
    .filter(Boolean)
    .join("_");

  return normalizeType(sourceText);
}

function collectRawCards() {
  const rawCards = [dccsClothingCards, normalCards, baggedCards]
    .filter(Array.isArray)
    .flat()
    .filter((item) => item && typeof item === "object");

  return Array.from(new Set(rawCards));
}

function normalizeClothingCards(rawCards = []) {
  const grouped = new Map();

  rawCards.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;

    const color = inferColor(raw);
    const type = inferType(raw);
    if (!color || !type) return;

    const rawId =
      raw.id || raw.key || raw.name || raw.filename || `${color}_${type}_${index}`;
    const normalizedId = normalizeToken(rawId) || `${color}_${type}_${index}`;
    const compositeKey = `${color}:${type}`;
    const previous = grouped.get(compositeKey) || {
      id: `${color}_${type}`,
      color,
      type,
      colorText: colorLabels[color] || raw.colorText || color,
      typeText: typeLabels[type] || raw.typeText || type,
      normalImg: null,
      bagImg: null,
    };

    const directNormal = getImageSource(raw);
    const directBag = getBagImageSource(raw);
    const recordIsBag = isBagRecord(raw);

    grouped.set(compositeKey, {
      ...previous,
      id: previous.id || normalizedId,
      sourceIds: [...(previous.sourceIds || []), normalizedId],
      colorText: raw.colorText || previous.colorText,
      typeText: raw.typeText || previous.typeText,
      normalImg:
        directBag && directNormal && directBag !== directNormal
          ? directNormal
          : recordIsBag
          ? previous.normalImg
          : directNormal || previous.normalImg,
      bagImg:
        directBag || (recordIsBag ? directNormal : null) || previous.bagImg,
    });
  });

  return Array.from(grouped.values())
    .map((card) => ({
      ...card,
      img: card.normalImg || card.bagImg,
      colorText: card.colorText || colorLabels[card.color] || card.color,
      typeText: card.typeText || typeLabels[card.type] || card.type,
    }))
    .filter((card) => card.img);
}

const allCards = normalizeClothingCards(collectRawCards());

function getCardImage(card, variant = "normal") {
  if (!card) return null;
  if (variant === "bag") return card.bagImg || card.normalImg || card.img;
  return card.normalImg || card.img || card.bagImg;
}

function getAvailableValues(field, priority = []) {
  const values = Array.from(
    new Set(allCards.map((card) => card?.[field]).filter(Boolean))
  );

  return [
    ...priority.filter((value) => values.includes(value)),
    ...values.filter((value) => !priority.includes(value)),
  ];
}

function findCard({
  color,
  type,
  excludeId,
  requireBag = false,
  preferDifferentType,
  preferDifferentColor,
} = {}) {
  const candidates = allCards.filter((card) => {
    if (!card) return false;
    if (excludeId && card.id === excludeId) return false;
    if (color && card.color !== color) return false;
    if (type && card.type !== type) return false;
    if (requireBag && !card.bagImg) return false;
    if (!requireBag && !card.normalImg) return false;
    if (!getCardImage(card, requireBag ? "bag" : "normal")) return false;
    return true;
  });

  return (
    candidates.find(
      (card) =>
        (!preferDifferentType || card.type !== preferDifferentType) &&
        (!preferDifferentColor || card.color !== preferDifferentColor)
    ) ||
    candidates[0] ||
    null
  );
}

function makeTarget(card, matchBy) {
  if (!card) return null;

  return {
    key: matchBy === "type" ? card.type : card.color,
    label:
      matchBy === "type"
        ? typeLabels[card.type] || card.typeText
        : colorLabels[card.color] || card.colorText,
    image: getCardImage(card, "normal"),
    sampleCardId: card.id,
    colorKey: card.color,
    typeKey: card.type,
  };
}

function arrangeTargets(correctTarget, wrongTarget, correctOnTop) {
  return correctOnTop
    ? { topTarget: correctTarget, bottomTarget: wrongTarget }
    : { topTarget: wrongTarget, bottomTarget: correctTarget };
}

function getTargetSideForKey(targets, field, key) {
  if (!key) return null;
  if (targets.topTarget?.[field] === key) return "top";
  if (targets.bottomTarget?.[field] === key) return "bottom";
  return null;
}

function pickDiverseCards(cards, count) {
  const selected = [];
  const usedIds = new Set();
  const usedPairs = new Set();

  for (const card of cards) {
    const pair = `${card.color}:${card.type}`;
    if (!usedIds.has(card.id) && !usedPairs.has(pair)) {
      selected.push(card);
      usedIds.add(card.id);
      usedPairs.add(pair);
    }
    if (selected.length >= count) return selected;
  }

  for (const card of cards) {
    if (!usedIds.has(card.id)) {
      selected.push(card);
      usedIds.add(card.id);
    }
    if (selected.length >= count) break;
  }

  return selected;
}

function repeatCardsToCount(cards, count) {
  if (!Array.isArray(cards) || cards.length === 0 || count <= 0) return [];
  const ordered = pickDiverseCards(cards, cards.length);
  return Array.from({ length: count }, (_, index) => ordered[index % ordered.length]);
}

function ShadowCloth({ src, label }) {
  return (
    <img
      src={src}
      alt={label}
      className="Dcss-shadow-cloth"
      aria-label={label}
      width="330"
      height="330"
      loading="lazy"
    />
  );
}

function average(numbers = []) {
  const valid = numbers.filter(
    (n) => typeof n === "number" && Number.isFinite(n)
  );

  if (valid.length === 0) return 0;

  return Math.round(valid.reduce((sum, n) => sum + n, 0) / valid.length);
}

function getDccsErrorTypes(logs = []) {
  const incorrectLogs = logs.filter((log) => !log.isCorrect);
  const ruleSwitchError = logs.filter((log) => log.isOldRuleInterference).length;

  return {
    miss: 0,
    randomClick: 0,
    wrongTarget: Math.max(incorrectLogs.length - ruleSwitchError, 0),
    repeatedClick: 0,
    timeout: 0,
    sequenceError: 0,
    ruleSwitchError,
  };
}

function getFatigueInput(logs = []) {
  if (logs.length < 2) {
    return {
      firstHalfRT: 0,
      secondHalfRT: 0,
      missIncrease: 0,
    };
  }

  const midpoint = Math.ceil(logs.length / 2);
  const firstHalf = logs.slice(0, midpoint);
  const secondHalf = logs.slice(midpoint);

  return {
    firstHalfRT: average(firstHalf.map((log) => log.reactionTime)),
    secondHalfRT: average(secondHalf.map((log) => log.reactionTime)),
    missIncrease: 0,
  };
}

function buildDccsTrainingResult({ logs, levelId, currentLevel }) {
  const formalLogs = Array.isArray(logs)
    ? logs.filter((log) => log && typeof log === "object")
    : [];

  const errorTypes = getDccsErrorTypes(formalLogs);
  const correctTrials = formalLogs.filter((log) => log.isCorrect).length;
  const reactionTimes = formalLogs.map((log) => log.reactionTime);
  const standardColorLogs = formalLogs.filter(
    (log) => log.ruleStage === "color" && !log.isBagColorTrial
  );
  const typeStageLogs = formalLogs.filter((log) => log.ruleStage === "type");
  const bagColorLogs = formalLogs.filter(
    (log) => log.ruleStage === "bagColor" || log.isBagColorTrial
  );
  const dualRuleLogs = formalLogs.filter(
    (log) => log.ruleStage === "dualRule" || log.isDualRuleTrial
  );
  const bagColorCorrectCount = bagColorLogs.filter((log) => log.isCorrect).length;
  const bagColorAccuracy =
    bagColorLogs.length > 0 ? bagColorCorrectCount / bagColorLogs.length : 0;
  const bagColorAvgReactionTime = average(
    bagColorLogs.map((log) => log.reactionTime)
  );
  const secondSwitchPerseverativeErrors = bagColorLogs.filter(
    (log) => log.isPerseverativeError || log.isOldRuleInterference
  ).length;
  const dualRuleCorrectCount = dualRuleLogs.filter((log) => log.isCorrect).length;
  const dualRuleAccuracy =
    dualRuleLogs.length > 0 ? dualRuleCorrectCount / dualRuleLogs.length : 0;
  const dualRuleAvgReactionTime = average(
    dualRuleLogs.map((log) => log.reactionTime)
  );
  const dualRulePerseverativeErrors = dualRuleLogs.filter(
    (log) => log.isPerseverativeError || log.isOldRuleInterference
  ).length;
  const standardColorAvgReactionTime = average(
    standardColorLogs.map((log) => log.reactionTime)
  );
  const secondSwitchCost =
    bagColorLogs.length > 0 && standardColorLogs.length > 0
      ? bagColorAvgReactionTime - standardColorAvgReactionTime
      : 0;

  // 沿用舊版分析工具產生輔助指標，再交給 DCCS 訓練分析整合。
  // 這些資料會一併保存到結果頁，方便家長與臨床端查看。
  const performanceResult = analyzePerformance({
    totalTrials: formalLogs.length,
    correctTrials,
    reactionTimes,
    errorTypes,
    difficulty: levelId,
  });

  const errorResult = analyzeErrors(errorTypes);
  const legacyFatigueResult = analyzeFatigue(getFatigueInput(formalLogs));

  const scoring = calculateDccsScore({
    gameId: "DCCS",
    task: "DCCS",
    mode: "training",
    scoringMode: "training",
    difficulty: levelId,
    trainingDifficulty: levelId,
    difficultyLevel: levelId,
    totalTrials: formalLogs.length,
    correctCount: correctTrials,
    trialLogs: formalLogs,
  });

  const trainingAnalysis = analyzeDccsTraining({
    trialLogs: formalLogs,
    difficultyLevel: levelId,
    trainingDifficulty: levelId,
    currentTrainingLevel: DCCS_DIFFICULTY_ORDER.indexOf(levelId) + 1,
    totalTrials: scoring.totalTrials,
    correctTrials: scoring.correctCount,
    accuracy: scoring.accuracy,
    colorTrials: scoring.colorTrials,
    colorAccuracy: scoring.colorAccuracy,
    typeTrials: scoring.typeTrials,
    typeAccuracy: scoring.typeAccuracy,
    switchTrials: scoring.switchTrials,
    postSwitchTrials: scoring.postSwitchTrials,
    switchAccuracy: scoring.switchAccuracy,
    postSwitchAccuracy: scoring.postSwitchAccuracy,
    interferenceTrials: scoring.interferenceTrials,
    interferenceAccuracy: scoring.interferenceAccuracy,
    interferenceControl: scoring.interferenceControl,
    firstTryAccuracy: scoring.firstTryAccuracy,
    perseverativeErrors: scoring.perseverativeErrors,
    oldRuleInterference: scoring.perseverativeErrors,
    perseverativeErrorRate: scoring.perseverativeErrorRate,
    avgReactionTime: scoring.avgReactionTime,
    responseStabilityScore: scoring.responseStabilityScore,
    bagColorTrials: bagColorLogs.length,
    bagColorCorrectCount,
    bagColorAccuracy,
    bagColorAvgReactionTime,
    secondSwitchTrials: bagColorLogs.length,
    secondSwitchAccuracy: bagColorAccuracy,
    secondSwitchPerseverativeErrors,
    secondSwitchCost,
    dualRuleTrials: dualRuleLogs.length,
    dualRuleCorrectCount,
    dualRuleAccuracy,
    dualRuleAvgReactionTime,
    dualRulePerseverativeErrors,
  });

  const currentChild = getStoredCurrentChild();
  const childId =
    currentChild?.childId ||
    currentChild?.id ||
    currentChild?.patientId ||
    "current-child";

  const totalPlayTime =
    formalLogs.length > 1
      ? Math.max(
          0,
          formalLogs[formalLogs.length - 1].timestamp -
            formalLogs[0].timestamp
        )
      : 0;

  return {
    gameId: "DCCS",
    task: "DCCS",
    abilityType: "cognitiveFlexibility",
    mode: "training",
    scoringMode: "training",
    childId,

    ...performanceResult,
    ...errorResult,

    difficulty: levelId,
    trainingDifficulty: levelId,
    difficultyLevel: levelId,
    difficultyLabel: scoring.difficultyLabel || currentLevel.label,
    difficultyTitle: scoring.difficultyTitle || currentLevel.title,
    levelLabel: currentLevel.label,
    levelCategory: getLevelCategory(levelId),

    score: scoring.totalScore,
    totalScore: scoring.totalScore,
    stars: scoring.stars,
    scoring: {
      ...scoring,
      standardColorTrials: standardColorLogs.length,
      typeStageTrials: typeStageLogs.length,
      bagColorTrials: bagColorLogs.length,
      bagColorCorrectCount,
      bagColorAccuracy,
      bagColorAccuracyPercent: Math.round(bagColorAccuracy * 100),
      bagColorAvgReactionTime,
      secondSwitchTrials: bagColorLogs.length,
      secondSwitchAccuracy: bagColorAccuracy,
      secondSwitchAccuracyPercent: Math.round(bagColorAccuracy * 100),
      secondSwitchPerseverativeErrors,
      secondSwitchCost,
      dualRuleTrials: dualRuleLogs.length,
      dualRuleCorrectCount,
      dualRuleAccuracy,
      dualRuleAccuracyPercent: Math.round(dualRuleAccuracy * 100),
      dualRuleAvgReactionTime,
      dualRulePerseverativeErrors,
    },
    trainingAnalysis,
    aiAnalysis: trainingAnalysis,

    totalTrials: scoring.totalTrials,
    correctCount: scoring.correctCount,
    correctTrials: scoring.correctCount,
    incorrectTrials: Math.max(0, scoring.totalTrials - scoring.correctCount),

    accuracy: scoring.accuracyPercent,
    accuracyRatio: scoring.accuracy,

    colorTrials: scoring.colorTrials,
    colorAccuracy: scoring.colorAccuracyPercent,
    colorAccuracyRatio: scoring.colorAccuracy,

    typeTrials: scoring.typeTrials,
    typeAccuracy: scoring.typeAccuracyPercent,
    typeAccuracyRatio: scoring.typeAccuracy,

    standardColorTrials: standardColorLogs.length,
    typeStageTrials: typeStageLogs.length,
    bagColorTrials: bagColorLogs.length,
    bagColorCorrectCount,
    bagColorAccuracy: Math.round(bagColorAccuracy * 100),
    bagColorAccuracyRatio: bagColorAccuracy,
    bagColorAvgReactionTime,
    secondSwitchTrials: bagColorLogs.length,
    secondSwitchAccuracy: Math.round(bagColorAccuracy * 100),
    secondSwitchAccuracyRatio: bagColorAccuracy,
    secondSwitchPerseverativeErrors,
    secondSwitchCost,
    dualRuleTrials: dualRuleLogs.length,
    dualRuleCorrectCount,
    dualRuleAccuracy: Math.round(dualRuleAccuracy * 100),
    dualRuleAccuracyRatio: dualRuleAccuracy,
    dualRuleAvgReactionTime,
    dualRulePerseverativeErrors,

    switchTrials: scoring.switchTrials,
    postSwitchTrials: scoring.postSwitchTrials,
    switchAccuracy: scoring.switchAccuracyPercent,
    postSwitchAccuracy: scoring.postSwitchAccuracyPercent,
    switchAccuracyRatio: scoring.switchAccuracy,
    postSwitchAccuracyRatio: scoring.postSwitchAccuracy,

    interferenceTrials: scoring.interferenceTrials,
    interferenceAccuracy: scoring.interferenceAccuracyPercent,
    interferenceAccuracyRatio: scoring.interferenceAccuracy,
    interferenceControl: scoring.interferenceControlPercent,
    interferenceControlRatio: scoring.interferenceControl,

    firstTryCorrect: formalLogs.filter(
      (log) => log.isCorrect && log.attemptCount <= 1
    ).length,
    firstTryAccuracy: scoring.firstTryAccuracyPercent,
    firstTryAccuracyRatio: scoring.firstTryAccuracy,

    perseverativeErrors: scoring.perseverativeErrors,
    oldRuleInterference: scoring.perseverativeErrors,
    perseverativeErrorRate: scoring.perseverativeErrorRatePercent,
    perseverativeErrorRateRatio: scoring.perseverativeErrorRate,

    bestStreak: scoring.bestStreak,
    avgReactionTime: scoring.avgReactionTime,
    preSwitchAvgReactionTime: scoring.preSwitchAvgReactionTime,
    colorAvgReactionTime: scoring.colorAvgReactionTime,
    typeAvgReactionTime: scoring.typeAvgReactionTime,
    switchAvgReactionTime: scoring.switchAvgReactionTime,
    postSwitchAvgReactionTime: scoring.postSwitchAvgReactionTime,
    switchCost: scoring.rtDifferenceAfterSwitch,
    rtDifferenceAfterSwitch: scoring.rtDifferenceAfterSwitch,
    reactionTimeCv: scoring.reactionTimeCv,
    reactionTimeValidCount: scoring.reactionTimeValidCount,
    reactionTimeCvReliable: scoring.reactionTimeCvReliable,
    responseStabilityScore: scoring.responseStabilityScore,

    fatigueLevel: trainingAnalysis.fatigueLevel,
    fatigueScore: trainingAnalysis.fatigueScore,
    fatigueResult: trainingAnalysis.fatigueResult,
    legacyFatigueResult,

    recommendedDifficulty: trainingAnalysis.recommendedDifficulty,
    recommendedDifficultyLevel: trainingAnalysis.recommendedDifficultyLevel,
    adjustment: trainingAnalysis.adjustment,
    levelChange: trainingAnalysis.levelChange,
    adjustmentReasons: trainingAnalysis.adjustmentReasons,
    shouldIncreaseDifficulty: trainingAnalysis.shouldIncreaseDifficulty,
    shouldDecreaseDifficulty: trainingAnalysis.shouldDecreaseDifficulty,
    shouldMaintainDifficulty: trainingAnalysis.shouldMaintainDifficulty,

    overallScore: trainingAnalysis.overallScore,
    performanceLevel: trainingAnalysis.performanceLevel,
    performanceLabel: trainingAnalysis.performanceLabel,
    performanceDescription: trainingAnalysis.performanceDescription,
    abilityScores: trainingAnalysis.abilityScores,
    strengths: trainingAnalysis.strengths,
    needsPractice: trainingAnalysis.needsPractice,
    parentFeedback: trainingAnalysis.parentFeedback,
    clinicianInterpretation: trainingAnalysis.clinicianInterpretation,
    confidence: trainingAnalysis.confidence,

    parentIndicators: scoring.parentIndicators,
    clinicianMetrics: scoring.clinicianMetrics,
    childMessage: scoring.childMessage,
    parentSummary: scoring.parentSummary,
    clinicianSummary: scoring.clinicianSummary,
    reactionTimeLevel: scoring.reactionTimeLevel,
    hasEnoughTrials: scoring.hasEnoughTrials,
    minimumReliableTrials: scoring.minimumReliableTrials,

    errorTypes,
    totalPlayTime,
    trialLogs: formalLogs,
    records: formalLogs,
    trials: formalLogs,


    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

const createColorTrials = (count) => {
  const availableColors = getAvailableValues("color", COLOR_PRIORITY);
  const normalPool = allCards.filter((card) => card.normalImg);
  const cards = repeatCardsToCount(normalPool, count);

  return cards
    .map((card, index) => {
      const alternativeColors = availableColors.filter(
        (color) => color !== card.color
      );
      const wrongColor =
        alternativeColors[index % Math.max(alternativeColors.length, 1)] ||
        alternativeColors[0];
      const correctSample =
        findCard({
          color: card.color,
          excludeId: card.id,
          preferDifferentType: card.type,
        }) || card;
      const wrongSample =
        findCard({
          color: wrongColor,
          preferDifferentType: correctSample.type,
        }) || normalPool.find((item) => item.color !== card.color);

      if (!correctSample || !wrongSample) return null;

      return {
        id: `training_color_${index + 1}_${card.id}`,
        card,
        rule: "color",
        ruleStage: "color",
        matchBy: "color",
        imageVariant: "normal",
        previousRule: null,
        isInterferenceTrial: false,
        wasAfterRuleSwitch: false,
        ...arrangeTargets(
          makeTarget(correctSample, "color"),
          makeTarget(wrongSample, "color"),
          index % 2 === 0
        ),
      };
    })
    .filter(Boolean);
};

const createTypeTrials = (count, options = {}) => {
  const availableTypes = getAvailableValues("type", TYPE_PRIORITY);
  const normalPool = allCards.filter((card) => card.normalImg);
  const cards = repeatCardsToCount(normalPool, count);
  const interferenceCount = Math.round(
    count * clampNumber(options.interferenceRate ?? 0, 0, 1)
  );

  return cards
    .map((card, index) => {
      const targetConflict = index < interferenceCount;
      const alternativeTypes = availableTypes.filter(
        (type) => type !== card.type
      );
      const wrongType =
        alternativeTypes[index % Math.max(alternativeTypes.length, 1)] ||
        alternativeTypes[0];

      const correctSample =
        findCard({
          type: card.type,
          excludeId: card.id,
          preferDifferentColor: card.color,
        }) || card;

      const conflictWrong = findCard({
        color: card.color,
        type: wrongType,
      });
      const neutralWrong =
        findCard({
          type: wrongType,
          preferDifferentColor: correctSample.color,
        }) || normalPool.find((item) => item.type !== card.type);
      const wrongSample = targetConflict ? conflictWrong || neutralWrong : neutralWrong;

      if (!correctSample || !wrongSample) return null;

      const targets = arrangeTargets(
        makeTarget(correctSample, "type"),
        makeTarget(wrongSample, "type"),
        index % 2 === 0
      );
      const correctSide = targets.topTarget.key === card.type ? "top" : "bottom";
      const oldRuleSide =
        targets.topTarget.colorKey === card.color
          ? "top"
          : targets.bottomTarget.colorKey === card.color
          ? "bottom"
          : null;

      return {
        id: `training_type_${index + 1}_${card.id}`,
        card,
        rule: "type",
        ruleStage: "type",
        matchBy: "type",
        imageVariant: "normal",
        previousRule: options.wasAfterRuleSwitch ? "color" : null,
        isInterferenceTrial: Boolean(
          targetConflict && oldRuleSide && oldRuleSide !== correctSide
        ),
        wasAfterRuleSwitch: Boolean(options.wasAfterRuleSwitch),
        ...targets,
      };
    })
    .filter(Boolean);
};

const createDualRuleTrials = (count, options = {}) => {
  const availableColors = getAvailableValues("color", COLOR_PRIORITY);
  const availableTypes = getAvailableValues("type", TYPE_PRIORITY);
  const normalPool = allCards.filter((card) => card.normalImg);
  const bagPool = allCards.filter((card) => card.bagImg);
  const sourcePool = repeatCardsToCount([...bagPool, ...normalPool], count);
  const interferenceCount = Math.round(
    count * clampNumber(options.interferenceRate ?? 0.5, 0, 1)
  );

  return sourcePool
    .map((card, index) => {
      const useBagCue = index % 2 === 0 && Boolean(card.bagImg);
      const targetConflict = index < interferenceCount;

      if (useBagCue) {
        const alternativeColors = availableColors.filter(
          (color) => color !== card.color
        );
        const wrongColor =
          alternativeColors[index % Math.max(alternativeColors.length, 1)] ||
          alternativeColors[0];
        const correctSample =
          findCard({
            color: card.color,
            excludeId: card.id,
            preferDifferentType: card.type,
          }) || card;
        const conflictWrong = findCard({
          type: card.type,
          color: wrongColor,
        });
        const neutralWrong =
          findCard({
            color: wrongColor,
            preferDifferentType: correctSample.type,
          }) || normalPool.find((item) => item.color !== card.color);
        const wrongSample = targetConflict ? conflictWrong || neutralWrong : neutralWrong;

        if (!correctSample || !wrongSample) return null;

        const targets = arrangeTargets(
          makeTarget(correctSample, "color"),
          makeTarget(wrongSample, "color"),
          index % 2 !== 0
        );

        const correctSide = getTargetSideForKey(targets, "key", card.color);
        const oldRuleSide = getTargetSideForKey(targets, "typeKey", card.type);

        return {
          id: `training_dual_${index + 1}_${card.id}`,
          card,
          rule: "color",
          ruleStage: "dualRule",
          matchBy: "color",
          imageVariant: "bag",
          previousRule: "type",
          cue: "bagged",
          inactiveRule: "type",
          isBagColorTrial: false,
          isDualRuleTrial: true,
          isInterferenceTrial: Boolean(
            targetConflict && oldRuleSide && correctSide && oldRuleSide !== correctSide
          ),
          wasAfterRuleSwitch: true,
          ...targets,
        };
      }

      const alternativeTypes = availableTypes.filter(
        (type) => type !== card.type
      );
      const wrongType =
        alternativeTypes[index % Math.max(alternativeTypes.length, 1)] ||
        alternativeTypes[0];
      const correctSample =
        findCard({
          type: card.type,
          excludeId: card.id,
          preferDifferentColor: card.color,
        }) || card;
      const conflictWrong = findCard({
        color: card.color,
        type: wrongType,
      });
      const neutralWrong =
        findCard({
          type: wrongType,
          preferDifferentColor: correctSample.color,
        }) || normalPool.find((item) => item.type !== card.type);
      const wrongSample = targetConflict ? conflictWrong || neutralWrong : neutralWrong;

      if (!correctSample || !wrongSample) return null;

      const targets = arrangeTargets(
        makeTarget(correctSample, "type"),
        makeTarget(wrongSample, "type"),
        index % 2 === 0
      );
      const correctSide = getTargetSideForKey(targets, "key", card.type);
      const oldRuleSide = getTargetSideForKey(targets, "colorKey", card.color);

      return {
        id: `training_dual_${index + 1}_${card.id}`,
        card,
        rule: "type",
        ruleStage: "dualRule",
        matchBy: "type",
        imageVariant: "normal",
        previousRule: "color",
        cue: "normal",
        inactiveRule: "color",
        isBagColorTrial: false,
        isDualRuleTrial: true,
        isInterferenceTrial: Boolean(
          targetConflict && oldRuleSide && correctSide && oldRuleSide !== correctSide
        ),
        wasAfterRuleSwitch: true,
        ...targets,
      };
    })
    .filter(Boolean);
};

const buildLevelTrials = ({
  totalTrials,
  ruleSequence,
  switchPoint,
  firstSwitchPoint,
  secondSwitchPoint,
  interferenceRate = 0,
  bagInterferenceRate = 0,
}) => {
  if (ruleSequence.length === 1 && ruleSequence[0] === "color") {
    return createColorTrials(totalTrials);
  }

  if (ruleSequence.length === 1 && ruleSequence[0] === "type") {
    return createTypeTrials(totalTrials, {
      interferenceRate: 0,
      wasAfterRuleSwitch: false,
    });
  }

  if (ruleSequence.includes("dualRule")) {
    const firstEnd = clampNumber(
      firstSwitchPoint ?? switchPoint ?? Math.floor(totalTrials / 3),
      1,
      Math.max(1, totalTrials - 2)
    );
    const secondEnd = clampNumber(
      secondSwitchPoint ?? Math.floor((totalTrials * 2) / 3),
      firstEnd + 1,
      Math.max(firstEnd + 1, totalTrials - 1)
    );
    const colorCount = firstEnd;
    const typeCount = Math.max(1, secondEnd - firstEnd);
    const dualCount = Math.max(1, totalTrials - secondEnd);

    return [
      ...createColorTrials(colorCount),
      ...createTypeTrials(typeCount, {
        interferenceRate,
        wasAfterRuleSwitch: true,
      }),
      ...createDualRuleTrials(dualCount, {
        interferenceRate: bagInterferenceRate || interferenceRate,
      }),
    ];
  }

  const firstBlockCount = switchPoint || Math.floor(totalTrials / 2);
  const secondBlockCount = totalTrials - firstBlockCount;

  return [
    ...createColorTrials(firstBlockCount),
    ...createTypeTrials(secondBlockCount, {
      interferenceRate,
      wasAfterRuleSwitch: true,
    }),
  ];
};

const createLevelConfig = (config) => ({
  ...config,
  totalText: `${config.totalTrials} 題`,
  trials: buildLevelTrials(config),
});

const LEVEL_CONFIG = {
  colorIntro: createLevelConfig({
    id: "colorIntro",
    label: "第 1 關",
    tag: "顏色入門",
    emoji: "1",
    title: "先看顏色",
    description: "依照衣服的顏色，把衣服放到相同顏色的籃子。",
    helper: "看顏色，選一樣顏色的籃子。",
    childGoal: "練習看顏色",
    parentGoal: "建立顏色分類規則",
    ruleSequence: ["color"],
    totalTrials: 6,
    feedbackMode: "full",
    hintPolicy: "always",
    showSwitchGuide: false,
    showBagGuide: false,
  }),
  colorStable: createLevelConfig({
    id: "colorStable",
    label: "第 2 關",
    tag: "顏色穩定",
    emoji: "2",
    title: "穩定看顏色",
    description: "連續練習顏色分類，減少提示。",
    helper: "先看顏色，再選籃子。",
    childGoal: "穩定依顏色分類",
    parentGoal: "觀察顏色規則維持能力",
    ruleSequence: ["color"],
    totalTrials: 8,
    feedbackMode: "normal",
    hintPolicy: "always",
    showSwitchGuide: false,
    showBagGuide: false,
  }),
  typeIntro: createLevelConfig({
    id: "typeIntro",
    label: "第 3 關",
    tag: "衣服入門",
    emoji: "3",
    title: "改看衣服種類",
    description: "不看顏色，依照衣服種類放到對應籃子。",
    helper: "看衣服種類，選一樣種類的籃子。",
    childGoal: "練習看衣服種類",
    parentGoal: "建立種類分類規則",
    ruleSequence: ["type"],
    totalTrials: 6,
    feedbackMode: "full",
    hintPolicy: "always",
    showSwitchGuide: false,
    showBagGuide: false,
  }),
  typeStable: createLevelConfig({
    id: "typeStable",
    label: "第 4 關",
    tag: "衣服穩定",
    emoji: "4",
    title: "穩定看衣服種類",
    description: "連續練習種類分類，保持同一個規則。",
    helper: "只看衣服種類，不被顏色影響。",
    childGoal: "穩定依種類分類",
    parentGoal: "觀察種類規則維持能力",
    ruleSequence: ["type"],
    totalTrials: 8,
    feedbackMode: "normal",
    hintPolicy: "always",
    showSwitchGuide: false,
    showBagGuide: false,
  }),
  switchClear: createLevelConfig({
    id: "switchClear",
    label: "第 5 關",
    tag: "清楚切換",
    emoji: "5",
    title: "從顏色切到衣服種類",
    description: "前半段看顏色，後半段改看衣服種類。",
    helper: "規則改變時，跟著新規則選籃子。",
    childGoal: "練習規則切換",
    parentGoal: "觀察第一次規則轉換",
    ruleSequence: ["color", "type"],
    switchPoint: 4,
    totalTrials: 8,
    feedbackMode: "guided",
    hintPolicy: "always",
    showSwitchGuide: true,
    showBagGuide: false,
    interferenceRate: 0.2,
  }),
  switchEarly: createLevelConfig({
    id: "switchEarly",
    label: "第 6 關",
    tag: "提早切換",
    emoji: "6",
    title: "更快改規則",
    description: "較早遇到規則切換，練習快速調整。",
    helper: "聽到換規則後，立刻改看衣服種類。",
    childGoal: "加快切換反應",
    parentGoal: "觀察切換後錯誤修正",
    ruleSequence: ["color", "type"],
    switchPoint: 3,
    totalTrials: 10,
    feedbackMode: "guided",
    hintPolicy: "afterWrong",
    showSwitchGuide: true,
    showBagGuide: false,
    interferenceRate: 0.35,
  }),
  switchMaintain: createLevelConfig({
    id: "switchMaintain",
    label: "第 7 關",
    tag: "切換維持",
    emoji: "7",
    title: "切換後保持新規則",
    description: "切換後持續使用新規則，避免回到舊規則。",
    helper: "換規則後，要一直照新規則做。",
    childGoal: "維持新規則",
    parentGoal: "觀察保留舊規則的干擾",
    ruleSequence: ["color", "type"],
    switchPoint: 4,
    totalTrials: 12,
    feedbackMode: "simple",
    hintPolicy: "afterWrong",
    showSwitchGuide: true,
    showBagGuide: false,
    interferenceRate: 0.5,
  }),
  lowInterference: createLevelConfig({
    id: "lowInterference",
    label: "第 8 關",
    tag: "低干擾",
    emoji: "8",
    title: "加入袋子顏色",
    description: "先看顏色，再看衣服種類，最後看袋子的顏色。",
    helper: "裝進袋子後，要看袋子的顏色。",
    childGoal: "練習多規則切換",
    parentGoal: "觀察多階段規則調整",
    ruleSequence: ["color", "type", "dualRule"],
    firstSwitchPoint: 4,
    secondSwitchPoint: 8,
    totalTrials: 12,
    feedbackMode: "simple",
    hintPolicy: "afterWrong",
    showSwitchGuide: true,
    showBagGuide: true,
    interferenceRate: 0.45,
    bagInterferenceRate: 0.45,
  }),
  highInterference: createLevelConfig({
    id: "highInterference",
    label: "第 9 關",
    tag: "高干擾",
    emoji: "9",
    title: "更強的規則干擾",
    description: "袋子顏色可能和衣服種類互相干擾，要抓住目前規則。",
    helper: "想清楚現在要看哪一個規則。",
    childGoal: "抗干擾切換",
    parentGoal: "觀察高干擾下的彈性控制",
    ruleSequence: ["color", "type", "dualRule"],
    firstSwitchPoint: 4,
    secondSwitchPoint: 9,
    totalTrials: 14,
    feedbackMode: "resultOnly",
    hintPolicy: "afterTwoWrong",
    showSwitchGuide: true,
    showBagGuide: true,
    interferenceRate: 0.65,
    bagInterferenceRate: 0.7,
  }),
  testLike: createLevelConfig({
    id: "testLike",
    label: "第 10 關",
    tag: "接近測驗",
    emoji: "10",
    title: "綜合挑戰",
    description: "完整練習顏色、衣服種類與袋子顏色的規則切換。",
    helper: "看清楚目前規則再作答。",
    childGoal: "完成綜合挑戰",
    parentGoal: "觀察接近測驗情境的表現",
    ruleSequence: ["color", "type", "dualRule"],
    firstSwitchPoint: 5,
    secondSwitchPoint: 10,
    totalTrials: 15,
    feedbackMode: "resultOnly",
    hintPolicy: "none",
    showSwitchGuide: false,
    showBagGuide: false,
    interferenceRate: 0.75,
    bagInterferenceRate: 0.8,
  }),
};

const DCCS_TRAINING_TOUCH_STYLE_ID = "dccs-training-touch-fix";
const DCCS_TRAINING_PAGE_STYLE_ID = "dccs-training-page-style";
const DCCS_TRAINING_TOUCH_STYLE = `
.Dcss-page,
.Dcss-test-shell,
.Dcss-training-shell,
.Dcss-main-area,
.Dcss-cloth-card,
.Dcss-basket-btn,
.Dcss-forest-button,
.Dcss-image-button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
`;

function TrainingPage_DCCS() {
  const navigate = useNavigate();
  const location = useLocation();
  const trainingContext = useMemo(() => getRouteTrainingContext(location), [location]);
  const testProfile = useMemo(() => getDccsTestProfile(), []);
  const initialLevelId = useMemo(
    () => getDifficultyForTrainingLevel(trainingContext.trainingLevel, testProfile),
    [trainingContext.trainingLevel, testProfile]
  );

  const [phase, setPhase] = useState(PHASE.START);
  const [levelId, setLevelId] = useState(initialLevelId);
  const [trialIndex, setTrialIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [logs, setLogs] = useState([]);
  const [finalResult, setFinalResult] = useState(null);

  const trialStartTimeRef = useRef(null);
  const nextTrialTimerRef = useRef(null);
  const trialStartRafRef = useRef(null);

  const pageBackgroundStyle = useMemo(() => ({
    backgroundImage: `
      linear-gradient(rgba(255, 244, 206, 0.30), rgba(255, 244, 206, 0.30)),
      url(${dccsBackgroundImg})
    `,
  }), []);

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
    if (typeof document !== "undefined" && !document.getElementById(DCCS_TRAINING_TOUCH_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = DCCS_TRAINING_TOUCH_STYLE_ID;
      style.textContent = DCCS_TRAINING_TOUCH_STYLE;
      document.head.appendChild(style);
    }

    if (typeof document !== "undefined" && !document.getElementById(DCCS_TRAINING_PAGE_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = DCCS_TRAINING_PAGE_STYLE_ID;
      style.textContent = dccsTrainingPageCss;
      document.head.appendChild(style);
    }

    return () => {
      clearPendingTiming();
    };
  }, []);

  const currentLevel = LEVEL_CONFIG[levelId] || LEVEL_CONFIG.colorIntro;

  const currentTrial = useMemo(() => {
    return currentLevel.trials[trialIndex] || null;
  }, [currentLevel, trialIndex]);

  const handleStart = () => {
    clearPendingTiming();
    setPhase(PHASE.VIDEO_INTRO);
  };

  const handleIntroVideoDone = () => {
    clearPendingTiming();
    setPhase(PHASE.VIDEO_STEP);
  };

  const handleStepVideoDone = () => {
    startPlaying();
  };

  const handleEndingVideoDone = () => {
    clearPendingTiming();
    setPhase(PHASE.FINISH);
  };

  const startPlaying = () => {
    clearPendingTiming();
    setPhase(PHASE.PLAYING);
    setTrialIndex(0);
    setFeedback(null);
    setSelectedPosition(null);
    setIsLocked(false);
    markTrialStartAfterPaint();
  };

  const getCorrectPosition = (trial) => {
    if (!trial) return null;

    const matchBy = trial.matchBy || (trial.rule === "type" ? "type" : "color");
    const correctKey = trial.card?.[matchBy];

    if (trial.topTarget?.key === correctKey) return "top";
    if (trial.bottomTarget?.key === correctKey) return "bottom";

    return null;
  };

  const getOldRulePosition = (trial) => {
    if (!trial) return null;

    if (
      trial.previousRule === "color" ||
      trial.ruleStage === "type" ||
      trial.inactiveRule === "color"
    ) {
      const oldColorKey = trial.card.color;

      if (trial.topTarget?.colorKey === oldColorKey) return "top";
      if (trial.bottomTarget?.colorKey === oldColorKey) return "bottom";
    }

    if (
      trial.previousRule === "type" ||
      trial.ruleStage === "bagColor" ||
      trial.inactiveRule === "type"
    ) {
      const oldTypeKey = trial.card.type;

      if (trial.topTarget?.typeKey === oldTypeKey) return "top";
      if (trial.bottomTarget?.typeKey === oldTypeKey) return "bottom";
    }

    return null;
  };


  const getWrongFeedbackText = ({ isOldRuleInterference, rule, ruleStage }) => {
    const mode = currentLevel.feedbackMode;

    if (mode === "resultOnly") return "";

    if (ruleStage === "dualRule") {
      if (isOldRuleInterference) {
        return "剛剛被另一個規則干擾了，再看一次袋子線索。";
      }
      return mode === "full"
        ? "有袋子時看顏色，沒有袋子時看衣服種類。"
        : "請先看有沒有袋子，再選規則。";
    }

    if (ruleStage === "bagColor") {
      if (isOldRuleInterference) {
        return "現在要看袋子的顏色，不是衣服種類。";
      }
      return mode === "full"
        ? "衣服裝進袋子後，請選和袋子顏色一樣的籃子。"
        : "請看袋子的顏色。";
    }

    if (isOldRuleInterference) {
      if (mode === "simple") return "規則已經換了，請跟著新規則。";
      return "先停一下，現在要使用新的分類規則。";
    }

    if (rule === "color") {
      return mode === "full"
        ? "請看衣服的顏色，選相同顏色的籃子。"
        : "請看顏色。";
    }

    if (mode === "guided") return "請看衣服種類，不要被顏色影響。";
    if (mode === "simple") return "請看衣服種類。";
    return "請選相同種類的籃子。";
  };

  const getRuleTransition = (nextTrialIndex) => {
    const current = currentLevel.trials[trialIndex];
    const next = currentLevel.trials[nextTrialIndex];

    if (
      currentLevel.showSwitchGuide &&
      current?.ruleStage !== "type" &&
      next?.ruleStage === "type"
    ) {
      return "type";
    }

    if (
      currentLevel.showBagGuide &&
      current?.ruleStage === "type" &&
      (next?.ruleStage === "bagColor" || next?.ruleStage === "dualRule")
    ) {
      return "dualRule";
    }

    return null;
  };

  const handleAnswer = (position) => {
    if (!currentTrial || isLocked) return;

    setIsLocked(true);
    setSelectedPosition(position);

    const now = Date.now();
    const reactionTime = Math.max(0, now - (trialStartTimeRef.current || now));
    const correctPosition = getCorrectPosition(currentTrial);
    const oldRulePosition = getOldRulePosition(currentTrial);

    const isCorrect = position === correctPosition;
    const isOldRuleInterference =
      currentTrial.isInterferenceTrial &&
      !isCorrect &&
      position === oldRulePosition;

    const nextLog = {
      trialNumber: trialIndex + 1,
      level: levelId,
      levelLabel: currentLevel.label,
      levelCategory: getLevelCategory(levelId),
      rule: currentTrial.rule,
      ruleStage: currentTrial.ruleStage || currentTrial.rule,
      matchBy: currentTrial.matchBy || currentTrial.rule,
      imageVariant: currentTrial.imageVariant || "normal",
      isBagged: currentTrial.imageVariant === "bag",
      isBagColorTrial: currentTrial.ruleStage === "bagColor",
      isDualRuleTrial: currentTrial.ruleStage === "dualRule",
      cue: currentTrial.cue || null,
      inactiveRule: currentTrial.inactiveRule || null,
      previousRule: currentTrial.previousRule || null,
      switchIndex:
        currentTrial.ruleStage === "type"
          ? 1
          : currentTrial.ruleStage === "bagColor" ||
            currentTrial.ruleStage === "dualRule"
          ? 2
          : 0,
      switchDirection:
        currentTrial.ruleStage === "type"
          ? "color_to_type"
          : currentTrial.ruleStage === "bagColor"
          ? "type_to_color"
          : currentTrial.ruleStage === "dualRule"
          ? "conditional_dual_rule"
          : null,
      cardId: currentTrial.card.id,
      cardColor: currentTrial.card.color,
      cardColorText: currentTrial.card.colorText,
      cardType: currentTrial.card.type,
      cardTypeText: currentTrial.card.typeText,
      userAnswerSide: position,
      correctSide: correctPosition,
      oldRuleSide: oldRulePosition,
      topTargetKey: currentTrial.topTarget?.key || null,
      topTargetColor: currentTrial.topTarget?.colorKey || null,
      topTargetType: currentTrial.topTarget?.typeKey || null,
      topTargetSampleCardId: currentTrial.topTarget?.sampleCardId || null,
      bottomTargetKey: currentTrial.bottomTarget?.key || null,
      bottomTargetColor: currentTrial.bottomTarget?.colorKey || null,
      bottomTargetType: currentTrial.bottomTarget?.typeKey || null,
      bottomTargetSampleCardId: currentTrial.bottomTarget?.sampleCardId || null,
      isCorrect,
      correct: isCorrect,
      isInterferenceTrial: Boolean(currentTrial.isInterferenceTrial),
      interferenceTrial: Boolean(currentTrial.isInterferenceTrial),
      wasAfterRuleSwitch: Boolean(currentTrial.wasAfterRuleSwitch),
      isAfterSwitch: Boolean(currentTrial.wasAfterRuleSwitch),
      isPostSwitch: Boolean(currentTrial.wasAfterRuleSwitch),
      isOldRuleInterference,
      isPerseverativeError: isOldRuleInterference,
      oldRuleError: isOldRuleInterference,
      errorType: isOldRuleInterference
        ? "perseverative"
        : isCorrect
        ? null
        : "wrong_target",
      reactionTime,
      responseTime: reactionTime,
      attemptCount: 1,
      wrongTapCount: 0,
      isFirstTry: true,
      timestamp: now,
    };

    const nextLogs = [...logs, nextLog];
    setLogs(nextLogs);

    if (isCorrect) {
      setFeedback({
        type: "correct",
        title: "答對了！",
        text: "",
      });
    } else {
      setFeedback({
        type: "wrong",
        title: isOldRuleInterference ? "還在用舊規則" : "再想一下",
        text: getWrongFeedbackText({
          isOldRuleInterference,
          rule: currentTrial.rule,
          ruleStage: currentTrial.ruleStage,
        }),
      });
    }

    if (nextTrialTimerRef.current) {
      window.clearTimeout(nextTrialTimerRef.current);
    }

    nextTrialTimerRef.current = window.setTimeout(() => {
      nextTrialTimerRef.current = null;
      goNextTrial(nextLogs);
    }, isCorrect ? 850 : 1150);
  };

  const saveTrainingResult = (resultWithStage, stars) => {
    try {
      const serializedResult = JSON.stringify(resultWithStage);
      const currentChild = getStoredCurrentChild();
      const currentChildId =
        resultWithStage.childId ||
        currentChild?.childId ||
        currentChild?.id ||
        currentChild?.patientId ||
        null;

      sessionStorage.setItem("DCCS_RESULT", serializedResult);
      sessionStorage.setItem("DCCS_TRAINING_RESULT", serializedResult);
      localStorage.setItem("dccsTrainingResult", serializedResult);
      localStorage.setItem("latestDccsTrainingResult", serializedResult);

      if (currentChildId) {
        localStorage.setItem(
          `dccsTrainingResult_${currentChildId}`,
          serializedResult
        );
      }

      persistTrainingStageResult({
        context: trainingContext,
        result: resultWithStage,
        stars,
      });

      saveUnifiedResult({
        rawResult: resultWithStage,
        gameId: "DCCS",
        mode: "training",
        difficulty: levelId || "normal",
        child: currentChild,
        route: RESULT_ROUTE,
        visibleRoles: ["child", "parent", "clinician"],
      });
    } catch (error) {
      console.warn("DCCS training result save failed:", error);
    }
  };

  const goNextTrial = (nextLogs) => {
    const nextIndex = trialIndex + 1;

    setFeedback(null);
    setSelectedPosition(null);
    setIsLocked(false);

    if (nextIndex >= currentLevel.trials.length) {
      const finalResult = buildDccsTrainingResult({
        logs: nextLogs,
        levelId,
        currentLevel,
      });

      const stars = finalResult.stars;
      const nextRecommendedDccsLevel = clampNumber(
        finalResult.recommendedDifficultyLevel ??
          trainingContext.trainingLevel,
        1,
        DCCS_DIFFICULTY_ORDER.length
      );

      const resultWithStage = {
        ...finalResult,
        stars,
        trainingLevel: trainingContext.trainingLevel,
        trainingStageId: trainingContext.trainingStageId,
        trainingOrder: trainingContext.trainingOrder,
        trainingTotal: trainingContext.trainingTotal,
        testBasedDifficulty: testProfile.hasTestResult,
        sourceTestProfile: testProfile,
        nextRecommendedDccsLevel,
        nextRecommendedDifficulty: finalResult.recommendedDifficulty,
        trainingAdjustment: finalResult.adjustment,
        trainingAdjustmentReasons: finalResult.adjustmentReasons,
        childGoal: currentLevel.childGoal,
        parentGoal: currentLevel.parentGoal,
      };

      setFinalResult(resultWithStage);
      saveTrainingResult(resultWithStage, stars);

      clearPendingTiming();
      setPhase(PHASE.END_VIDEO);
      return;
    }

    const transition = getRuleTransition(nextIndex);

    if (transition === "type") {
      setTrialIndex(nextIndex);
      setPhase(PHASE.SWITCH_RULE);
      trialStartTimeRef.current = null;
      return;
    }

    if (transition === "bagColor" || transition === "dualRule") {
      setTrialIndex(nextIndex);
      setPhase(PHASE.BAG_RULE);
      trialStartTimeRef.current = null;
      return;
    }

    setTrialIndex(nextIndex);
    markTrialStartAfterPaint();
  };

  const continueAfterSwitchRule = () => {
    clearPendingTiming();
    setPhase(PHASE.PLAYING);
    setFeedback(null);
    setSelectedPosition(null);
    setIsLocked(false);
    markTrialStartAfterPaint();
  };

  const restartTraining = () => {
    clearPendingTiming();
    setPhase(PHASE.START);
    setLevelId(initialLevelId);
    setTrialIndex(0);
    setLogs([]);
    setFinalResult(null);
    setFeedback(null);
    setSelectedPosition(null);
    setIsLocked(false);
    trialStartTimeRef.current = null;
  };

  const renderTargetVisual = (target) => {
    if (!currentTrial || !target?.image) return null;

    const matchBy =
      currentTrial.matchBy || (currentTrial.rule === "type" ? "type" : "color");

    return (
      <div
        className={`Dcss-visual-target Dcss-target-clothing ${
          matchBy === "type"
            ? "Dcss-type-target-clothing"
            : "Dcss-color-target-clothing"
        }`}
      >
        <img loading="lazy"
          src={target.image}
          alt={matchBy === "type" ? `${target.label}種類目標` : `${target.label}顏色目標`}
        />
      </div>
    );
  };

  const renderStartPage = () => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <main className="Dcss-center-shell Dcss-start-shell">
          <section className="Dcss-soft-panel Dcss-start-panel game-start-card-artwork" aria-label="開始練習">
            <div className="Dcss-game-title">孔雀衣櫃分類練習</div>

            <div className="Dcss-start-content">
              <div className="Dcss-dialog-bubble Dcss-opening-bubble">
                幫孔雀小姐整理衣服，依照目前規則放到正確的籃子裡。
              </div>

              <div className="Dcss-round-icon Dcss-start-icon">
                <img loading="lazy" src={peacockImg} alt="孔雀小姐" width="360" height="360" />
              </div>
            </div>

            <div className="Dcss-guided-action Dcss-guided-start">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-start"
                onClick={handleStart}
                aria-label="開始遊戲"
              >
                <img width={1024} height={341} src={homeStartBtn} alt="開始遊戲" />
              </button>
              <img width={1024} height={1024} loading="lazy" className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="點擊提示" aria-hidden="true" />
            </div>
          </section>
        </main>
      </div>
    );
  };

  const renderVideoPage = ({ src, title, buttonText, onDone }) => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <main className="Dcss-center-shell Dcss-video-shell">
          <section className="Dcss-soft-panel Dcss-video-card game-start-card-artwork" aria-label={title}>
            <div className="Dcss-video-frame">
              <video
                className="Dcss-guide-video"
                src={src}
                autoPlay
                muted
                playsInline
                controls
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
                <img width={1024} height={341} loading="lazy" src={homeSkipBtn} alt={buttonText} />
              </button>
              <img width={1024} height={1024} loading="lazy" className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="點擊提示" aria-hidden="true" />
            </div>
          </section>
        </main>
      </div>
    );
  };

  const renderSwitchRulePage = () => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <div className="Dcss-switch-card Dcss-picture-rule-card">
          <img src={peacockImg} alt="孔雀小姐" className="Dcss-peacock-rule" width="360" height="360" loading="lazy" />

          <div className="Dcss-rule-content Dcss-picture-rule-content">
            <div className="Dcss-tag danger">換規則</div>
            <h1 className="Dcss-switch-title">接下來改看衣服種類</h1>

            <div className="Dcss-picture-rule-row">
              <div className="Dcss-mini-example">
                <img src={blueShirtImg} alt="藍色上衣" width="326" height="324" loading="lazy" />
                <span className="Dcss-big-arrow">→</span>
                <div className="Dcss-demo-target Dcss-demo-target-type">
                  <ShadowCloth src={redShirtImg} label="上衣剪影" />
                  <img src={basketTopImg} alt="上衣分類箱" width="319" height="131" loading="lazy" />
                </div>
              </div>

              <div className="Dcss-mini-example">
                <img src={redHatImg} alt="紅色帽子" width="244" height="202" loading="lazy" />
                <span className="Dcss-big-arrow">→</span>
                <div className="Dcss-demo-target Dcss-demo-target-type">
                  <ShadowCloth src={blueHatImg} label="帽子剪影" />
                  <img src={basketBottomImg} alt="帽子分類箱" width="319" height="131" loading="lazy" />
                </div>
              </div>
            </div>

            <div className="Dcss-guided-action Dcss-guided-rule">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-next"
                onClick={continueAfterSwitchRule}
                aria-label="繼續"
              >
                <img width={1024} height={341} loading="lazy" src={homeNextBtn} alt="繼續" />
              </button>
              <img width={1024} height={1024} loading="lazy" className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBagRulePage = () => {
    const examples = currentLevel.trials
      .filter(
        (trial) => trial.ruleStage === "bagColor" || trial.ruleStage === "dualRule"
      )
      .slice(0, 2);

    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <div className="Dcss-switch-card Dcss-picture-rule-card">
          <img src={peacockImg} alt="孔雀小姐" className="Dcss-peacock-rule" width="360" height="360" loading="lazy" />

          <div className="Dcss-rule-content Dcss-picture-rule-content">
            <div className="Dcss-tag danger">再換一次規則</div>
            <h1 className="Dcss-switch-title">衣服裝袋後，改看袋子的顏色</h1>
            <p className="Dcss-switch-description">
              不看衣服種類，也不看原本衣服的顏色；請看袋子的顏色。
            </p>

            <div className="Dcss-picture-rule-row">
              {examples.map((example, index) => {
                const correctPosition = getCorrectPosition(example);
                const correctTarget =
                  correctPosition === "top"
                    ? example.topTarget
                    : example.bottomTarget;

                return (
                  <div className="Dcss-mini-example" key={example.id}>
                    <img
                      src={getCardImage(example.card, example.imageVariant)}
                      alt={`裝袋的${example.card.colorText}${example.card.typeText}`}
                      className="Dcss-rule-bagged-cloth"
                      width="330"
                      height="330"
                      loading="lazy"
                    />
                    <span className="Dcss-big-arrow">→</span>
                    <div className="Dcss-demo-target Dcss-demo-target-type">
                      <ShadowCloth
                        src={correctTarget?.image}
                        label={`${correctTarget?.label || "正確顏色"}範例`}
                      />
                      <img
                        src={index % 2 === 0 ? basketTopImg : basketBottomImg}
                        alt={`${correctTarget?.label || "正確顏色"}籃子`}
                        width="319"
                        height="131"
                        loading="lazy"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {examples.length === 0 && (
              <div className="Dcss-data-warning">
                dccsClothingData.js 目前沒有可用的 bagImg，無法顯示裝袋規則範例。
              </div>
            )}

            <div className="Dcss-guided-action Dcss-guided-rule">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-next"
                onClick={continueAfterSwitchRule}
                aria-label="繼續"
                disabled={examples.length === 0}
              >
                <img width={1024} height={341} loading="lazy" src={homeNextBtn} alt="繼續" />
              </button>
              {examples.length > 0 && (
                <img width={1024} height={1024} loading="lazy"
                  className="Dcss-mouse-guide Dcss-mouse-on-button"
                  src={mouseGuideImg}
                  alt="提示點擊"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getResultStars = () => {
    if (finalResult?.scoring?.stars) {
      return clampStarCount(finalResult.scoring.stars);
    }

    if (finalResult?.stars) {
      return clampStarCount(finalResult.stars);
    }

    return 1;
  };

  const renderFinishPage = () => {
    const resultStars = getResultStars();

    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <main className="Dcss-center-shell Dcss-result-shell">
          <section className="Dcss-soft-panel Dcss-result-panel game-result-card-artwork" aria-label="練習結果">
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
                <img src={peacockImg} alt="孔雀小姐" width="360" height="360" loading="lazy" />
              </div>
            </div>

            <div className="Dcss-result-actions">
              <div className="Dcss-guided-action Dcss-guided-result-main">
                <button
                  type="button"
                  className="Dcss-forest-button Dcss-image-button Dcss-btn-home"
                  onClick={() => navigate(MENU_ROUTE)}
                  aria-label="回到選單"
                >
                  <img width={1024} height={341} loading="lazy" src={homeBackBtn} alt="回到選單" />
                </button>
                <img width={1024} height={1024} loading="lazy" className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
              </div>

              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-replay"
                onClick={restartTraining}
                aria-label="再玩一次"
              >
                <img width={1024} height={341} loading="lazy" src={homeAgainBtn} alt="再玩一次" />
              </button>

              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-detail"
                onClick={() => {
                  const storedResult =
                    finalResult ||
                    safeParse(
                      sessionStorage.getItem("DCCS_TRAINING_RESULT"),
                      null
                    ) ||
                    safeParse(
                      localStorage.getItem("latestDccsTrainingResult"),
                      null
                    );

                  navigate(RESULT_ROUTE, {
                    state: storedResult || {},
                  });
                }}
                aria-label="詳細結果"
              >
                <img width={1024} height={341} loading="lazy" src={homeResultBtn} alt="詳細結果" />
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
      src: START_VIDEO_SRC,
      title: "開始說明",
      buttonText: "跳過",
      onDone: handleIntroVideoDone,
    });
  }

  if (phase === PHASE.VIDEO_STEP) {
    return renderVideoPage({
      src: STEP_VIDEO_SRC,
      title: "下一步說明",
      buttonText: "跳過",
      onDone: handleStepVideoDone,
    });
  }

  if (phase === PHASE.SWITCH_RULE) return renderSwitchRulePage();
  if (phase === PHASE.BAG_RULE) return renderBagRulePage();

  if (phase === PHASE.END_VIDEO) {
    return renderVideoPage({
      src: END_VIDEO_SRC,
      title: "完成說明",
      buttonText: "跳過說明",
      onDone: handleEndingVideoDone,
    });
  }

  if (phase === PHASE.FINISH) return renderFinishPage();

  if (!currentTrial) return null;

  return (
    <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
      <div className="Dcss-test-shell Dcss-test-shell-visual Dcss-training-shell Dcss-training-shell-visual">
        <div className="Dcss-top-bar Dcss-top-bar-compact">
          <div className="Dcss-top-spacer" aria-hidden="true" />

          <div className="Dcss-progress-pill">
            練習 {trialIndex + 1} / {currentLevel.trials.length}
          </div>
        </div>

        <div className="Dcss-main-area Dcss-main-area-bottom-baskets Dcss-main-area-visual Dcss-training-main-area Dcss-training-main-area-visual">
          <div className="Dcss-play-row">
            <div className="Dcss-card-stage Dcss-training-card-stage Dcss-card-stage-visual">
              <div
                className={`Dcss-cloth-card ${
                  currentTrial.imageVariant === "bag"
                    ? "Dcss-cloth-card-bagged"
                    : ""
                } ${feedback ? feedback.type : ""}`}
              >
                <img loading="lazy"
                  src={getCardImage(
                    currentTrial.card,
                    currentTrial.imageVariant || "normal"
                  )}
                  alt={`${
                    currentTrial.imageVariant === "bag" ? "裝袋的" : ""
                  }${currentTrial.card.colorText}${currentTrial.card.typeText}`}
                  width="330"
                  height="330"
                />
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
              disabled={isLocked}
            >
              <div className="Dcss-basket-choice-label">
                {renderTargetVisual(currentTrial.topTarget)}
              </div>
              <div className="Dcss-basket-choice-image">
                <img loading="lazy" src={basketTopImg} alt="左側分類箱" width="319" height="131" />
              </div>
            </button>

            <button
              type="button"
              className={`Dcss-basket-btn Dcss-visual-basket-btn ${
                selectedPosition === "bottom" ? "selected" : ""
              }`}
              onClick={() => handleAnswer("bottom")}
              disabled={isLocked}
            >
              <div className="Dcss-basket-choice-label">
                {renderTargetVisual(currentTrial.bottomTarget)}
              </div>
              <div className="Dcss-basket-choice-image">
                <img loading="lazy" src={basketBottomImg} alt="右側分類箱" width="319" height="131" />
              </div>
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
}

const dccsTrainingPageCss = `
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


/* DCCS 訓練版主要遊戲區：卡片置中，籃子固定在下方。 */
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

/* 覆蓋 GamePage_DCCS.css 的舊定位設定，避免籃子在訓練頁跑位。 */
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

/* DCCS 訓練版改成兩個下方籃子，讓孩子直接點選上方或下方答案。 */
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
  content: "?";
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
  content: "??;
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
.Dcss-btn-next { width: clamp(172px, 17vw, 238px); }
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

/* 小螢幕版：縮小卡片與籃子間距。 */
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



/* Training DCCS: force exact TestPage visual layout while keeping training logic. */
.Dcss-training-shell-visual {
  width: min(94vw, 1460px) !important;
  min-height: min(88vh, 900px) !important;
}

.Dcss-training-main-area-visual {
  grid-template-columns: 1fr !important;
  grid-template-rows: auto auto auto !important;
  justify-content: center !important;
  justify-items: center !important;
}

.Dcss-training-main-area-visual .Dcss-play-row,
.Dcss-training-main-area-visual .Dcss-baskets-bottom,
.Dcss-training-main-area-visual .Dcss-visual-baskets-bottom {
  grid-column: 1 !important;
  width: min(100%, 720px) !important;
  margin-inline: auto !important;
}

.Dcss-training-main-area-visual .Dcss-card-stage {
  width: min(100%, 660px) !important;
  margin-inline: auto !important;
}

.Dcss-training-main-area-visual .Dcss-cloth-card {
  width: min(100%, 640px) !important;
  height: clamp(310px, 36vh, 430px) !important;
}

.Dcss-training-main-area-visual .Dcss-baskets-bottom {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: clamp(22px, 2.4vw, 36px) !important;
}

.Dcss-training-main-area-visual .Dcss-visual-basket-btn {
  width: 100% !important;
  min-width: 0 !important;
  min-height: clamp(150px, 18vh, 190px) !important;
}

.Dcss-training-main-area-visual .Dcss-feedback {
  grid-column: 1 !important;
  grid-row: auto !important;
  position: relative !important;
  inset: auto !important;
  transform: none !important;
}

@media (max-width: 620px) {
  .Dcss-training-main-area-visual .Dcss-baskets-bottom {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    width: min(100%, 560px) !important;
    gap: 12px !important;
  }
}

/* DCCS 籃子容器：確保兩個答案按鈕維持一致大小。 */
.Dcss-training-main-area-visual .Dcss-visual-basket-btn {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: clamp(6px, 1vh, 12px) !important;
  min-height: clamp(210px, 27vh, 300px) !important;
  padding: clamp(10px, 1.4vw, 18px) clamp(8px, 1vw, 14px) !important;
  overflow: visible !important;
}

.Dcss-basket-choice-label {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  height: clamp(78px, 10vh, 118px) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: visible !important;
  pointer-events: none;
  z-index: 2;
}

.Dcss-basket-choice-label .Dcss-visual-target,
.Dcss-basket-choice-label .Dcss-target-clothing {
  position: relative !important;
  inset: auto !important;
  transform: none !important;
  width: clamp(74px, 7.4vw, 112px) !important;
  height: clamp(74px, 7.4vw, 112px) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: visible !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.Dcss-basket-choice-label .Dcss-target-clothing img {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain !important;
  filter: drop-shadow(0 8px 7px rgba(83, 50, 18, 0.18));
}

.Dcss-basket-choice-image {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  height: clamp(105px, 14vh, 160px) !important;
  display: flex !important;
  align-items: flex-end !important;
  justify-content: center !important;
  overflow: visible !important;
  pointer-events: none;
  z-index: 1;
}

.Dcss-basket-choice-image > img {
  position: relative !important;
  inset: auto !important;
  transform: none !important;
  width: min(96%, 300px) !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain !important;
}

@media (max-width: 620px) {
  .Dcss-training-main-area-visual .Dcss-visual-basket-btn {
    min-height: 176px !important;
    gap: 2px !important;
    padding: 8px 4px !important;
    border-radius: 22px !important;
  }

  .Dcss-basket-choice-label {
    height: 70px !important;
  }

  .Dcss-basket-choice-label .Dcss-visual-target,
  .Dcss-basket-choice-label .Dcss-target-clothing {
    width: 66px !important;
    height: 66px !important;
  }

  .Dcss-basket-choice-image {
    height: 88px !important;
  }
}

/* Training gameplay: match the TestPage_DCCS card/basket art layout. */
.Dcss-training-shell-visual.Dcss-test-shell-visual {
  width: min(94vw, 1360px) !important;
  min-height: min(88vh, 860px) !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.Dcss-training-shell-visual.Dcss-test-shell-visual::before {
  display: none !important;
}

.Dcss-training-main-area-visual.Dcss-main-area-bottom-baskets {
  grid-template-columns: minmax(520px, 700px) !important;
  grid-template-rows: auto auto !important;
  justify-content: center !important;
  justify-items: center !important;
  align-content: center !important;
  gap: clamp(18px, 2.2vh, 28px) !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.Dcss-training-main-area-visual .Dcss-play-row {
  display: contents !important;
  width: auto !important;
  margin: 0 !important;
}

.Dcss-training-main-area-visual .Dcss-card-stage {
  grid-column: 1 !important;
  grid-row: 1 !important;
  width: auto !important;
  min-height: 0 !important;
  margin: 0 !important;
  justify-self: center !important;
  align-self: end !important;
}

.Dcss-training-main-area-visual .Dcss-card-stage-visual .Dcss-cloth-card {
  width: clamp(210px, 25vw, 330px) !important;
  height: clamp(210px, 25vw, 330px) !important;
  min-width: 0 !important;
  padding: clamp(16px, 2vw, 26px) !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
}

.Dcss-training-main-area-visual .Dcss-cloth-card::before,
.Dcss-training-main-area-visual .Dcss-cloth-card::after {
  display: none !important;
}

.Dcss-training-main-area-visual .Dcss-card-stage-visual .Dcss-cloth-card img {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain !important;
}

.Dcss-training-main-area-visual .Dcss-baskets-bottom,
.Dcss-training-main-area-visual .Dcss-visual-baskets-bottom {
  grid-column: 1 !important;
  grid-row: 2 !important;
  width: min(100%, 700px) !important;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: clamp(22px, 2.4vw, 36px) !important;
  margin: 0 auto !important;
  justify-self: center !important;
}

.Dcss-training-main-area-visual .Dcss-visual-basket-btn {
  width: 100% !important;
  min-width: 0 !important;
  min-height: clamp(150px, 18vh, 190px) !important;
  padding: clamp(10px, 1.4vw, 18px) clamp(8px, 1vw, 14px) !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  outline: 0 !important;
  overflow: visible !important;
}

.Dcss-training-main-area-visual .Dcss-visual-basket-btn::before,
.Dcss-training-main-area-visual .Dcss-visual-basket-btn::after {
  display: none !important;
}

@media (max-width: 980px) {
  .Dcss-training-main-area-visual.Dcss-main-area-bottom-baskets {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 620px) {
  .Dcss-training-main-area-visual .Dcss-baskets-bottom,
  .Dcss-training-main-area-visual .Dcss-visual-baskets-bottom {
    width: min(100%, 560px) !important;
    gap: 12px !important;
  }

  .Dcss-training-main-area-visual .Dcss-card-stage-visual .Dcss-cloth-card {
    width: clamp(180px, 54vw, 250px) !important;
    height: clamp(180px, 54vw, 250px) !important;
  }
}
.Dcss-cloth-card-bagged img,
.Dcss-rule-bagged-cloth {
  object-fit: contain;
  filter: drop-shadow(0 10px 10px rgba(67, 54, 38, 0.2));
}

.Dcss-rule-bagged-cloth {
  width: clamp(110px, 14vw, 190px);
  height: clamp(110px, 14vw, 190px);
}

.Dcss-switch-description {
  margin: 0.35rem auto 1rem;
  max-width: 720px;
  text-align: center;
  font-size: clamp(1rem, 1.7vw, 1.3rem);
  line-height: 1.6;
  color: #5f4b3d;
}

`;

export default TrainingPage_DCCS;
