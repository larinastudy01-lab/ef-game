// src/pages/TrainingPage_DCCS.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

const MENU_ROUTE = "/game-menu";
const TEST_ROUTE = "/test-dccs";

const INTRO_VIDEO_SRC = introVideo;
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
  const keys = [
    "DCCS_TEST_RESULT",
    "dccsTestResult",
    "dccs_test_result",
    "ef_game_dccs_test_result",
    "ef_game_DCCS_test_result",
  ];

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

const COLOR_ONLY_LEVEL_IDS = new Set(["colorIntro", "colorStable"]);
const TYPE_ONLY_LEVEL_IDS = new Set(["typeIntro", "typeStable"]);
const SWITCH_LEVEL_IDS = new Set([
  "switchClear",
  "switchEarly",
  "switchMaintain",
  "lowInterference",
  "highInterference",
  "testLike",
]);

const getDifficultyForTrainingLevel = (trainingLevel, testProfile) => {
  const safeLevel = clampNumber(trainingLevel, 1, DCCS_DIFFICULTY_ORDER.length);
  const baseIndex = safeLevel - 1;
  const shiftedIndex = clampNumber(
    baseIndex + (testProfile?.baselineShift || 0),
    0,
    DCCS_DIFFICULTY_ORDER.length - 1
  );

  // 保留關卡成長感：
  // 1～2 關不會直接跳到切換；3～4 關不會跳過「看衣服」練習；
  // 7 關以後至少維持在切換層，避免退回太基礎。
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

const calculateTrainingStars = ({ summary, levelId }) => {
  const accuracyScore = summary.accuracy || 0;
  const firstTryScore = summary.firstTryAccuracy || 0;
  const switchScore = summary.switchAccuracy || 0;
  const interferenceAccuracy = summary.interferenceAccuracy ?? accuracyScore;
  const oldRulePenalty = Math.min(30, (summary.oldRuleInterference || 0) * 7);
  const category = getLevelCategory(levelId);

  let totalScore = 0;

  if (category === "singleRule") {
    totalScore = accuracyScore * 0.65 + firstTryScore * 0.35;
  } else if (category === "switch") {
    totalScore = accuracyScore * 0.3 + switchScore * 0.5 + firstTryScore * 0.2 - oldRulePenalty;
  } else if (category === "interference") {
    totalScore =
      accuracyScore * 0.25 +
      switchScore * 0.35 +
      interferenceAccuracy * 0.3 +
      firstTryScore * 0.1 -
      oldRulePenalty;
  } else {
    totalScore =
      accuracyScore * 0.35 +
      switchScore * 0.35 +
      interferenceAccuracy * 0.2 +
      firstTryScore * 0.1 -
      oldRulePenalty;
  }

  const finalScore = Math.round(clampNumber(totalScore, 0, 100));

  if (finalScore >= 85) return 3;
  if (finalScore >= 60) return 2;
  return 1;
};

const getNextRecommendedDccsLevel = ({ stars, summary, currentTrainingLevel }) => {
  const safeLevel = clampNumber(currentTrainingLevel, 1, DCCS_DIFFICULTY_ORDER.length);

  if (
    stars === 3 &&
    (summary.oldRuleInterference || 0) <= 1 &&
    (summary.accuracy || 0) >= 80
  ) {
    return Math.min(DCCS_DIFFICULTY_ORDER.length, safeLevel + 1);
  }

  if (
    stars === 1 ||
    (summary.oldRuleInterference || 0) >= 3 ||
    (summary.switchAccuracy || 100) < 50
  ) {
    return Math.max(1, safeLevel - 1);
  }

  return safeLevel;
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
  COLOR_RULE: "color_rule",
  PLAYING: "playing",
  SWITCH_RULE: "switch_rule",
  END_VIDEO: "end_video",
  FINISH: "finish",
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

const typeSampleImg = {
  skirt: pinkSkirtImg,
  socks: greenSocksImg,
  shirt: yellowShirtImg,
  pants: purplePantsImg,
};

function ColorDot({ colorKey, size = "training" }) {
  return (
    <span
      className={`Dcss-color-dot-inline ${colorClassMap[colorKey] || ""} ${size}`}
      aria-hidden="true"
      style={{ backgroundColor: colorHexMap[colorKey] || "#ddd" }}
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

function RuleIconSet({ rule }) {
  if (rule === "type") {
    return (
      <div className="Dcss-current-rule-icons Dcss-current-type-icons" aria-label="看衣服種類">
        <ShadowCloth src={yellowShirtImg} label="上衣剪影" />
        <ShadowCloth src={purplePantsImg} label="褲子剪影" />
        <ShadowCloth src={greenSocksImg} label="襪子剪影" />
        <ShadowCloth src={pinkSkirtImg} label="裙子剪影" />
      </div>
    );
  }

  return (
    <div className="Dcss-current-rule-icons Dcss-current-color-icons" aria-label="看顏色">
      <ColorDot colorKey="pink" size="small" />
      <ColorDot colorKey="blue" size="small" />
      <ColorDot colorKey="yellow" size="small" />
      <ColorDot colorKey="green" size="small" />
      <ColorDot colorKey="purple" size="small" />
    </div>
  );
}

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
  const errorTypes = getDccsErrorTypes(logs);
  const correctTrials = logs.filter((log) => log.isCorrect).length;
  const reactionTimes = logs.map((log) => log.reactionTime);

  const performanceResult = analyzePerformance({
    totalTrials: currentLevel.trials.length,
    correctTrials,
    reactionTimes,
    errorTypes,
    difficulty: levelId,
  });

  const errorResult = analyzeErrors(errorTypes);
  const fatigueResult = analyzeFatigue(getFatigueInput(logs));
  const fatigueLevel = fatigueResult?.fatigueLevel || "low";

  const recommendedDifficulty = getRecommendedDifficulty({
    accuracy: performanceResult.accuracy,
    avgReactionTime: performanceResult.avgReactionTime,
    errorTypes,
    fatigueLevel,
  });

  const switchLogs = logs.filter((log) => log.rule === "type" && log.wasAfterRuleSwitch);
  const switchCorrect = switchLogs.filter((log) => log.isCorrect).length;
  const interferenceLogs = logs.filter((log) => log.isInterferenceTrial);
  const interferenceCorrect = interferenceLogs.filter((log) => log.isCorrect).length;

  return {
    gameId: "DCCS",
    abilityType: "flexibility",
    mode: "training",
    difficulty: levelId,
    levelLabel: currentLevel.label,
    levelCategory: getLevelCategory(levelId),
    totalTrials: currentLevel.trials.length,
    correctTrials,
    firstTryCorrect: logs.filter(
      (log) => log.isCorrect && log.attemptCount === 1
    ).length,
    switchAccuracy:
      switchLogs.length > 0
        ? Math.round((switchCorrect / switchLogs.length) * 100)
        : SINGLE_RULE_LEVEL_IDS.has(levelId)
        ? 100
        : 0,
    interferenceAccuracy:
      interferenceLogs.length > 0
        ? Math.round((interferenceCorrect / interferenceLogs.length) * 100)
        : null,
    bestStreak: getBestStreak(logs),
    oldRuleInterference: errorTypes.ruleSwitchError,
    trialLogs: logs,
    errorTypes,
    ...performanceResult,
    ...errorResult,
    fatigueLevel,
    fatigueResult,
    recommendedDifficulty,
    createdAt: new Date().toISOString(),
  };
}

const makeColorTrial = (cardId, topColor, bottomColor) => ({
  card: getCard(cardId),
  rule: "color",
  topTarget: { key: topColor, label: colorLabels[topColor] },
  bottomTarget: { key: bottomColor, label: colorLabels[bottomColor] },
  isInterferenceTrial: false,
  wasAfterRuleSwitch: false,
});

const makeTypeTrial = (cardId, topType, bottomType, topColorKey, bottomColorKey, options = {}) => {
  const card = getCard(cardId);
  const correctKey = card?.type;
  const correctSide = topType === correctKey ? "top" : bottomType === correctKey ? "bottom" : null;
  const oldRuleSide =
    topColorKey === card?.color ? "top" : bottomColorKey === card?.color ? "bottom" : null;
  const isInterferenceTrial = Boolean(
    options.isInterferenceTrial ?? (oldRuleSide && correctSide && oldRuleSide !== correctSide)
  );

  return {
    card,
    rule: "type",
    topTarget: {
      key: topType,
      label: typeLabels[topType],
      colorKey: topColorKey,
    },
    bottomTarget: {
      key: bottomType,
      label: typeLabels[bottomType],
      colorKey: bottomColorKey,
    },
    isInterferenceTrial,
    wasAfterRuleSwitch: Boolean(options.wasAfterRuleSwitch),
  };
};

const createColorTrials = (count, pairs = [["pink", "blue"], ["yellow", "green"], ["purple", "blue"]]) => {
  const cards = [
    "pink_skirt",
    "blue_skirt",
    "yellow_shirt",
    "green_socks",
    "purple_pants",
    "pink_socks",
    "blue_shirt",
    "yellow_pants",
  ];

  return Array.from({ length: count }, (_, index) => {
    const cardId = cards[index % cards.length];
    const card = getCard(cardId);
    const pair = pairs.find(([a, b]) => a === card.color || b === card.color) || [
      card.color,
      pairs[index % pairs.length][0],
    ];
    const topColor = index % 2 === 0 ? pair[0] : pair[1];
    const bottomColor = index % 2 === 0 ? pair[1] : pair[0];

    return makeColorTrial(cardId, topColor, bottomColor);
  });
};

const createTypeTrials = (count, options = {}) => {
  const cards = [
    "pink_skirt",
    "green_socks",
    "yellow_shirt",
    "purple_pants",
    "blue_skirt",
    "pink_socks",
    "blue_shirt",
    "yellow_pants",
  ];
  const typePairs = [
    ["skirt", "socks"],
    ["shirt", "pants"],
    ["socks", "skirt"],
    ["pants", "shirt"],
  ];
  const colorPairs = [
    ["pink", "green"],
    ["yellow", "purple"],
    ["blue", "yellow"],
    ["green", "pink"],
  ];

  return Array.from({ length: count }, (_, index) => {
    const cardId = cards[index % cards.length];
    const card = getCard(cardId);
    const baseTypePair =
      typePairs.find(([a, b]) => a === card.type || b === card.type) || typePairs[index % typePairs.length];
    const targetConflict = index < Math.round(count * (options.interferenceRate ?? 0));
    const matchingColor = card.color;
    const otherColor =
      colorPairs[index % colorPairs.length].find((color) => color !== matchingColor) ||
      ["pink", "blue", "yellow", "green", "purple"].find((color) => color !== matchingColor);

    let topType = index % 2 === 0 ? baseTypePair[0] : baseTypePair[1];
    let bottomType = index % 2 === 0 ? baseTypePair[1] : baseTypePair[0];

    const correctSide = topType === card.type ? "top" : "bottom";

    let topColorKey;
    let bottomColorKey;

    if (targetConflict) {
      topColorKey = correctSide === "top" ? otherColor : matchingColor;
      bottomColorKey = correctSide === "bottom" ? otherColor : matchingColor;
    } else {
      topColorKey = correctSide === "top" ? matchingColor : otherColor;
      bottomColorKey = correctSide === "bottom" ? matchingColor : otherColor;
    }

    return makeTypeTrial(cardId, topType, bottomType, topColorKey, bottomColorKey, {
      wasAfterRuleSwitch: Boolean(options.wasAfterRuleSwitch),
      isInterferenceTrial: targetConflict,
    });
  });
};

const buildLevelTrials = ({ totalTrials, ruleSequence, switchPoint, interferenceRate = 0 }) => {
  if (ruleSequence.length === 1 && ruleSequence[0] === "color") {
    return createColorTrials(totalTrials);
  }

  if (ruleSequence.length === 1 && ruleSequence[0] === "type") {
    return createTypeTrials(totalTrials, { interferenceRate: 0, wasAfterRuleSwitch: false });
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
    label: "第 1 階",
    tag: "顏色認識",
    emoji: "1",
    title: "找一樣顏色",
    description: "先練習看衣服的顏色，把衣服放進一樣顏色的籃子。",
    helper: "看顏色，找一樣顏色的籃子。",
    childGoal: "看顏色",
    parentGoal: "單一顏色規則理解",
    ruleSequence: ["color"],
    totalTrials: 4,
    feedbackMode: "full",
    hintPolicy: "always",
    showSwitchGuide: false,
    interferenceRate: 0,
  }),

  colorStable: createLevelConfig({
    id: "colorStable",
    label: "第 2 階",
    tag: "顏色穩定",
    emoji: "2",
    title: "顏色小練習",
    description: "衣服種類變多，但這一關仍然只看顏色。",
    helper: "不用管衣服是哪一種，先找一樣的顏色。",
    childGoal: "顏色小練習",
    parentGoal: "單一顏色規則維持",
    ruleSequence: ["color"],
    totalTrials: 6,
    feedbackMode: "normal",
    hintPolicy: "always",
    showSwitchGuide: false,
    interferenceRate: 0,
  }),

  typeIntro: createLevelConfig({
    id: "typeIntro",
    label: "第 3 階",
    tag: "衣服認識",
    emoji: "3",
    title: "找一樣衣服",
    description: "這一關只看衣服種類，不看顏色。",
    helper: "看衣服是哪一種，找一樣剪影的籃子。",
    childGoal: "看衣服",
    parentGoal: "單一種類規則理解",
    ruleSequence: ["type"],
    totalTrials: 4,
    feedbackMode: "full",
    hintPolicy: "always",
    showSwitchGuide: false,
    interferenceRate: 0,
  }),

  typeStable: createLevelConfig({
    id: "typeStable",
    label: "第 4 階",
    tag: "衣服穩定",
    emoji: "4",
    title: "衣服小練習",
    description: "穩定練習看衣服種類，為後面的換規則做準備。",
    helper: "看剪影，不用管顏色。",
    childGoal: "衣服小練習",
    parentGoal: "單一種類規則維持",
    ruleSequence: ["type"],
    totalTrials: 6,
    feedbackMode: "normal",
    hintPolicy: "always",
    showSwitchGuide: false,
    interferenceRate: 0,
  }),

  switchClear: createLevelConfig({
    id: "switchClear",
    label: "第 5 階",
    tag: "明確切換",
    emoji: "5",
    title: "換玩法囉",
    description: "前面看顏色，後面改看衣服剪影。",
    helper: "看到換規則後，就改看衣服是哪一種。",
    childGoal: "換玩法囉",
    parentGoal: "第一次規則切換",
    ruleSequence: ["color", "type"],
    switchPoint: 4,
    totalTrials: 8,
    feedbackMode: "guided",
    hintPolicy: "always",
    showSwitchGuide: true,
    interferenceRate: 0.2,
  }),

  switchEarly: createLevelConfig({
    id: "switchEarly",
    label: "第 6 階",
    tag: "提前切換",
    emoji: "6",
    title: "早一點換玩法",
    description: "還沒完全習慣顏色規則，就要提早改看衣服。",
    helper: "規則換了之後，先停一下，再看剪影。",
    childGoal: "記得新玩法",
    parentGoal: "較早切換規則",
    ruleSequence: ["color", "type"],
    switchPoint: 3,
    totalTrials: 8,
    feedbackMode: "guided",
    hintPolicy: "afterWrong",
    showSwitchGuide: true,
    interferenceRate: 0.3,
  }),

  switchMaintain: createLevelConfig({
    id: "switchMaintain",
    label: "第 7 階",
    tag: "切換後維持",
    emoji: "7",
    title: "不要忘記玩法",
    description: "換規則後要持續照新規則分類。",
    helper: "記得現在要看衣服，不要跑回顏色。",
    childGoal: "不要忘記玩法",
    parentGoal: "切換後維持新規則",
    ruleSequence: ["color", "type"],
    switchPoint: 5,
    totalTrials: 10,
    feedbackMode: "simple",
    hintPolicy: "afterWrong",
    showSwitchGuide: true,
    interferenceRate: 0.4,
  }),

  lowInterference: createLevelConfig({
    id: "lowInterference",
    label: "第 8 階",
    tag: "少量干擾",
    emoji: "8",
    title: "不要被騙到",
    description: "有些題目的顏色會故意干擾，要記得看衣服。",
    helper: "先停一下，想想現在看哪一個。",
    childGoal: "不要被騙到",
    parentGoal: "低強度舊規則干擾抑制",
    ruleSequence: ["color", "type"],
    switchPoint: 5,
    totalTrials: 10,
    feedbackMode: "simple",
    hintPolicy: "afterTwoWrong",
    showSwitchGuide: true,
    interferenceRate: 0.5,
  }),

  highInterference: createLevelConfig({
    id: "highInterference",
    label: "第 9 階",
    tag: "高干擾",
    emoji: "9",
    title: "看清楚再放",
    description: "大多數題目都有顏色干擾，重點是抑制舊規則。",
    helper: "不要被顏色騙，現在要看衣服是哪一種。",
    childGoal: "看清楚再放",
    parentGoal: "高強度舊規則干擾抑制",
    ruleSequence: ["color", "type"],
    switchPoint: 5,
    totalTrials: 12,
    feedbackMode: "resultOnly",
    hintPolicy: "afterTwoWrong",
    showSwitchGuide: true,
    interferenceRate: 0.75,
  }),

  testLike: createLevelConfig({
    id: "testLike",
    label: "第 10 階",
    tag: "接近測驗",
    emoji: "10",
    title: "自己試試看",
    description: "接近正式測驗的訓練，不主動給文字提示。",
    helper: "自己試試看。",
    childGoal: "自己試試看",
    parentGoal: "近測驗模式",
    ruleSequence: ["color", "type"],
    switchPoint: 6,
    totalTrials: 12,
    feedbackMode: "resultOnly",
    hintPolicy: "none",
    showSwitchGuide: false,
    interferenceRate: 0.75,
  }),
};

const DCCS_TRAINING_TOUCH_STYLE_ID = "dccs-training-touch-fix";
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

  const trialStartTimeRef = useRef(null);
  const nextTrialTimerRef = useRef(null);
  const trialStartRafRef = useRef(null);

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
    if (typeof document !== "undefined" && !document.getElementById(DCCS_TRAINING_TOUCH_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = DCCS_TRAINING_TOUCH_STYLE_ID;
      style.textContent = DCCS_TRAINING_TOUCH_STYLE;
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

  const summary = useMemo(() => {
    const total = logs.length;
    const correct = logs.filter((log) => log.isCorrect).length;
    const firstTryCorrect = logs.filter(
      (log) => log.isCorrect && log.attemptCount === 1
    ).length;
    const switchLogs = logs.filter((log) => log.rule === "type" && log.wasAfterRuleSwitch);
    const switchCorrect = switchLogs.filter((log) => log.isCorrect).length;
    const interferenceLogs = logs.filter((log) => log.isInterferenceTrial);
    const interferenceCorrect = interferenceLogs.filter((log) => log.isCorrect).length;
    const oldRuleInterference = logs.filter(
      (log) => log.isOldRuleInterference
    ).length;

    return {
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      firstTryAccuracy:
        total > 0 ? Math.round((firstTryCorrect / total) * 100) : 0,
      switchAccuracy:
        switchLogs.length > 0
          ? Math.round((switchCorrect / switchLogs.length) * 100)
          : SINGLE_RULE_LEVEL_IDS.has(levelId)
          ? 100
          : 0,
      interferenceAccuracy:
        interferenceLogs.length > 0
          ? Math.round((interferenceCorrect / interferenceLogs.length) * 100)
          : null,
      bestStreak: getBestStreak(logs),
      oldRuleInterference,
      avgReactionTime: average(logs.map((log) => log.reactionTime)),
    };
  }, [logs, levelId]);

  const handleStart = () => {
    clearPendingTiming();
    setPhase(PHASE.VIDEO_INTRO);
  };

  const handleIntroVideoDone = () => {
    clearPendingTiming();
    setPhase(PHASE.COLOR_RULE);
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


  const shouldShowRuleHint = () => {
    const policy = currentLevel.hintPolicy || "always";
    const wrongCount = logs.filter((log) => !log.isCorrect).length;

    if (policy === "none") return false;
    if (policy === "afterWrong") return wrongCount >= 1 || Boolean(feedback?.type === "wrong");
    if (policy === "afterTwoWrong") return wrongCount >= 2 || Boolean(feedback?.type === "wrong");
    return true;
  };


  const getWrongFeedbackText = ({ isOldRuleInterference, rule }) => {
    const mode = currentLevel.feedbackMode;

    if (mode === "resultOnly") return "";

    if (isOldRuleInterference) {
      if (mode === "simple") return "先停一下，想想現在看哪一個。";
      return "規則換了，現在看衣服喔。";
    }

    if (rule === "color") {
      return mode === "full" ? "看衣服的顏色，找一樣顏色的籃子。" : "看顏色。";
    }

    if (mode === "guided") return "現在不看顏色，要看衣服是哪一種。";
    if (mode === "simple") return "看剪影。";
    return "看衣服。";
  };

  const shouldShowSwitchRule = (nextTrialIndex) => {
    if (!currentLevel.showSwitchGuide) return false;

    const current = currentLevel.trials[trialIndex];
    const next = currentLevel.trials[nextTrialIndex];

    return current?.rule === "color" && next?.rule === "type";
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
      currentTrial.rule === "type" &&
      !isCorrect &&
      position === oldRulePosition;

    const nextLog = {
      trialNumber: trialIndex + 1,
      level: levelId,
      levelLabel: currentLevel.label,
      levelCategory: getLevelCategory(levelId),
      rule: currentTrial.rule,
      cardId: currentTrial.card.id,
      cardColor: currentTrial.card.color,
      cardColorText: currentTrial.card.colorText,
      cardType: currentTrial.card.type,
      cardTypeText: currentTrial.card.typeText,
      userAnswerSide: position,
      correctSide: correctPosition,
      oldRuleSide: oldRulePosition,
      isCorrect,
      isInterferenceTrial: Boolean(currentTrial.isInterferenceTrial),
      wasAfterRuleSwitch: Boolean(currentTrial.wasAfterRuleSwitch),
      isOldRuleInterference,
      reactionTime,
      attemptCount: 1,
      timestamp: now,
    };

    const nextLogs = [...logs, nextLog];
    setLogs(nextLogs);

    if (isCorrect) {
      setFeedback({
        type: "correct",
        title: "放對了！",
        text: "",
      });
    } else {
      setFeedback({
        type: "wrong",
        title: isOldRuleInterference ? "差一點！" : "再想一下！",
        text: getWrongFeedbackText({
          isOldRuleInterference,
          rule: currentTrial.rule,
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

      const finalSummary = {
        total: nextLogs.length,
        correct: nextLogs.filter((log) => log.isCorrect).length,
        accuracy:
          nextLogs.length > 0
            ? Math.round((nextLogs.filter((log) => log.isCorrect).length / nextLogs.length) * 100)
            : 0,
        firstTryAccuracy:
          nextLogs.length > 0
            ? Math.round(
                (nextLogs.filter((log) => log.isCorrect && log.attemptCount === 1).length /
                  nextLogs.length) *
                  100
              )
            : 0,
        switchAccuracy: (() => {
          const switchLogs = nextLogs.filter((log) => log.rule === "type" && log.wasAfterRuleSwitch);
          const switchCorrect = switchLogs.filter((log) => log.isCorrect).length;
          return switchLogs.length > 0
            ? Math.round((switchCorrect / switchLogs.length) * 100)
            : SINGLE_RULE_LEVEL_IDS.has(levelId)
            ? 100
            : 0;
        })(),
        interferenceAccuracy: (() => {
          const interferenceLogs = nextLogs.filter((log) => log.isInterferenceTrial);
          const interferenceCorrect = interferenceLogs.filter((log) => log.isCorrect).length;
          return interferenceLogs.length > 0
            ? Math.round((interferenceCorrect / interferenceLogs.length) * 100)
            : null;
        })(),
        oldRuleInterference: nextLogs.filter((log) => log.isOldRuleInterference).length,
      };

      const stars = calculateTrainingStars({ summary: finalSummary, levelId });
      const nextRecommendedDccsLevel = getNextRecommendedDccsLevel({
        stars,
        summary: finalSummary,
        currentTrainingLevel: trainingContext.trainingLevel,
      });

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
        childGoal: currentLevel.childGoal,
        parentGoal: currentLevel.parentGoal,
      };

      try {
        sessionStorage.setItem("DCCS_TRAINING_RESULT", JSON.stringify(resultWithStage));
        localStorage.setItem("dccsTrainingResult", JSON.stringify(resultWithStage));
        persistTrainingStageResult({
          context: trainingContext,
          result: resultWithStage,
          stars,
        });
      } catch (error) {
        console.warn("DCCS training result save failed:", error);
      }

      clearPendingTiming();
      setPhase(PHASE.END_VIDEO);
      return;
    }

    if (shouldShowSwitchRule(nextIndex)) {
      setTrialIndex(nextIndex);
      setPhase(PHASE.SWITCH_RULE);
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
    setFeedback(null);
    setSelectedPosition(null);
    setIsLocked(false);
    trialStartTimeRef.current = null;
  };

  const getRuleTitle = () => {
    if (!currentTrial) return "";

    if (currentTrial.rule === "color") return "看顏色";
    return "看衣服";
  };

  const getHelperSpeech = () => {
    if (!currentTrial || !shouldShowRuleHint()) return "";

    if (currentTrial.rule === "color") {
      return "看顏色";
    }

    return "看衣服";
  };

  const getRuleHint = () => {
    if (!currentTrial || !shouldShowRuleHint()) return "";

    if (currentTrial.rule === "color") {
      return "看圓點顏色";
    }

    return "看黑色剪影";
  };

  const renderWarmupGuide = () => {
    const firstRule = currentLevel.ruleSequence?.[0];

    if (currentLevel.ruleSequence?.length === 1 && firstRule === "type") {
      return (
        <div className="Dcss-training-visual-guide">
          <div className="Dcss-guide-piece">
            <ShadowCloth src={yellowShirtImg} label="衣服剪影" />
            <img src={basketBottomImg} alt="種類籃子" />
          </div>
        </div>
      );
    }

    return (
      <div className="Dcss-training-visual-guide">
        <div className="Dcss-guide-piece">
          <ColorDot colorKey="pink" />
          <img src={basketTopImg} alt="顏色籃子" />
        </div>

        {currentLevel.showSwitchGuide && (
          <>
            <span className="Dcss-big-arrow">→</span>
            <div className="Dcss-guide-piece">
              <ShadowCloth src={yellowShirtImg} label="衣服剪影" />
              <img src={basketBottomImg} alt="種類籃子" />
            </div>
          </>
        )}
      </div>
    );
  };

  const renderTargetVisual = (target) => {
    if (!currentTrial) return null;

    if (currentTrial.rule === "color") {
      return (
        <div className="Dcss-visual-target Dcss-color-target Dcss-color-target-only">
          <ColorDot colorKey={target.key} size="training" />
        </div>
      );
    }

    return (
      <div className="Dcss-visual-target Dcss-type-target Dcss-type-target-neutral">
        <ShadowCloth
          src={typeSampleImg[target.key]}
          label={`${target.label}剪影`}
        />
      </div>
    );
  };

  const renderStartPage = () => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTrainingPageCss}</style>
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
                aria-label="開始遊戲"
              >
                <img src={homeStartBtn} alt="開始遊戲" />
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
        <style>{dccsTrainingPageCss}</style>
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

  const renderColorRulePage = () => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTrainingPageCss}</style>
        <div className="Dcss-rule-card Dcss-picture-rule-card">
          <img src={peacockImg} alt="孔雀小姐" className="Dcss-peacock-rule" />

          <div className="Dcss-rule-content Dcss-picture-rule-content">
            <div className="Dcss-tag">先看顏色</div>

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
                onClick={startPlaying}
                aria-label="開始遊戲"
              >
                <img src={homeStartBtn} alt="開始遊戲" />
              </button>
              <img className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSwitchRulePage = () => {
    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTrainingPageCss}</style>
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
                onClick={continueAfterSwitchRule}
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

  const getResultStars = () => {
    if (summary.accuracy >= 85) return 3;
    if (summary.accuracy >= 60) return 2;
    return 1;
  };

  const renderFinishPage = () => {
    const resultStars = getResultStars();

    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        <style>{dccsTrainingPageCss}</style>
        <main className="Dcss-center-shell Dcss-result-shell">
          <section className="Dcss-soft-panel Dcss-result-panel" aria-label="練習結果">
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
                  onClick={() => navigate(MENU_ROUTE)}
                  aria-label="回到森林"
                >
                  <img src={homeBackBtn} alt="回到森林" />
                </button>
                <img className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
              </div>

              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-replay"
                onClick={restartTraining}
                aria-label="再玩一次"
              >
                <img src={homeAgainBtn} alt="再玩一次" />
              </button>

              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-detail"
                onClick={() => navigate(TEST_ROUTE)}
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
      onDone: handleIntroVideoDone,
    });
  }

  if (phase === PHASE.COLOR_RULE) return renderColorRulePage();
  if (phase === PHASE.SWITCH_RULE) return renderSwitchRulePage();

  if (phase === PHASE.END_VIDEO) {
    return renderVideoPage({
      src: END_VIDEO_SRC,
      title: "完成影片",
      buttonText: "跳過動畫",
      onDone: handleEndingVideoDone,
    });
  }

  if (phase === PHASE.FINISH) return renderFinishPage();

  if (!currentTrial) return null;

  return (
    <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
      <style>{dccsTrainingPageCss}</style>
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
              disabled={isLocked}
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
              disabled={isLocked}
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
}

function getCurrentStreak(logs = []) {
  let streak = 0;

  for (let i = logs.length - 1; i >= 0; i -= 1) {
    if (!logs[i].isCorrect) break;
    streak += 1;
  }

  return streak;
}

function getBestStreak(logs = []) {
  let best = 0;
  let current = 0;

  logs.forEach((log) => {
    if (log.isCorrect) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return best;
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
    grid-template-columns: 1fr !important;
    width: min(100%, 330px) !important;
  }
}
`;

export default TrainingPage_DCCS;