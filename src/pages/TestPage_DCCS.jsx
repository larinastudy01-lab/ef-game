// src/pages/TestPage_DCCS.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/GamePage_DCCS.css";

import dccsBackgroundImg from "../asset/DCCS_testbackground.png";
import startVideo from "../asset/mp4/DCCS_start.mp4";
import stepVideo from "../asset/mp4/DCCS_step.mp4";
import endingVideo from "../asset/mp4/DCCS_end.mp4";
import homeStartBtn from "../asset/home/start.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeNextBtn from "../asset/home/next.png";
import homeBackBtn from "../asset/home/back.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";

import { createGameResult } from "../ai/gameResultTemplate";
import { analyzePerformance } from "../ai/performanceAnalyzer";
import { analyzeErrors } from "../ai/errorAnalyzer";
import { analyzeFatigue } from "../ai/fatigueAnalyzer";
import { getRecommendedDifficulty } from "../ai/aiDifficultyEngine";
import { saveUnifiedResult } from "../utils/resultManager";
import { calculateDccsScore } from "../utils/dccsScoring";

import peacockImg from "../asset/DCCS/dccs_peacock.png";
import basketTopImg from "../asset/DCCS/dccs_basket_left.png";
import basketBottomImg from "../asset/DCCS/dccs_basket_right.png";

// 所有一般服飾與裝袋服飾統一由此資料檔提供。
// 直接使用 dccsClothingData.js 實際存在的具名匯出，避免 Webpack 對不存在匯出的編譯錯誤。
import {
  dccsClothingCards,
  normalCards,
  baggedCards,
  colorLabels as clothingColorLabels,
  typeLabels as clothingTypeLabels,
} from "../config/dccsClothingData";

const RESULT_ROUTE = "/result-dccs";
const TEST_PAGE_ROUTE = "/test-map";
const SESSION_KEY = "DCCS_RESULT";
const TEST_SESSION_KEY = "DCCS_TEST_RESULT";
const TEST_STORAGE_KEY = "dccsTestResult";
const LATEST_TEST_STORAGE_KEY = "latestDccsTestResult";

// 開始動畫使用 DCCS_start.mp4；前導教學使用 DCCS_step.mp4；結束動畫使用 DCCS_end.mp4。
const START_VIDEO_SRC = startVideo;
const STEP_VIDEO_SRC = stepVideo;
const END_VIDEO_SRC = endingVideo;

const PHASE = {
  START: "start",
  VIDEO_INTRO: "video_intro",
  VIDEO_STEP: "video_step",
  PRACTICE: "practice",
  COLOR_TEST: "color_test",
  SWITCH_RULE: "switch_rule",
  TYPE_TEST: "type_test",
  BAG_RULE: "bag_rule",
  BAG_COLOR_TEST: "bag_color_test",
  END_VIDEO: "end_video",
  RESULT: "result",
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
  tshirt: "T 恤",
  dress: "洋裝",
  gloves: "手套",
  jacket: "夾克",
  scarf: "圍巾",
  shorts: "短褲",
  skirt: "裙子",
  sneakers: "運動鞋",
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
    粉紅: "pink",
    粉色: "pink",
    藍: "blue",
    黃: "yellow",
    綠: "green",
    紫: "purple",
    紅: "red",
    橘: "orange",
    橙: "orange",
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
    上衣: "tshirt",
    洋裝: "dress",
    手套: "gloves",
    夾克: "jacket",
    圍巾: "scarf",
    短褲: "shorts",
    裙子: "skirt",
    運動鞋: "sneakers",
    鞋子: "sneakers",
    襪子: "socks",
    帽子: "hat",
    褲子: "pants",
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

function buildDccsTrialSets() {
  const availableColors = getAvailableValues("color", COLOR_PRIORITY);
  const availableTypes = getAvailableValues("type", TYPE_PRIORITY);
  const normalCards = allCards.filter((card) => card.normalImg);
  const bagCards = allCards.filter((card) => card.bagImg);

  if (normalCards.length < 2 || availableColors.length < 2) {
    console.warn(
      "dccsClothingData.js 至少需要兩種顏色、兩張一般服飾圖片。"
    );
  }

  const colorPair = availableColors.slice(0, 2);
  const practiceCards = colorPair
    .map((color) => findCard({ color }))
    .filter(Boolean);

  const practiceTrials = practiceCards.map((card, index) => {
    const otherColor =
      colorPair.find((color) => color !== card.color) ||
      availableColors.find((color) => color !== card.color);
    const correctSample =
      findCard({
        color: card.color,
        excludeId: card.id,
        preferDifferentType: card.type,
      }) || card;
    const wrongSample = findCard({ color: otherColor }) || normalCards[0];
    const targets = arrangeTargets(
      makeTarget(correctSample, "color"),
      makeTarget(wrongSample, "color"),
      index % 2 === 0
    );

    return {
      id: `practice_${card.id}`,
      card,
      rule: "color",
      matchBy: "color",
      imageVariant: "normal",
      ...targets,
    };
  });

  const orderedColorCards = pickDiverseCards(
    [
      ...availableColors
        .map((color, index) =>
          findCard({
            color,
            type: availableTypes[index % Math.max(availableTypes.length, 1)],
          }) || findCard({ color })
        )
        .filter(Boolean),
      ...normalCards,
    ],
    Math.min(6, normalCards.length)
  );

  const colorTestTrials = orderedColorCards.map((card, index) => {
    const otherColor =
      availableColors[
        (availableColors.indexOf(card.color) + 1 + index) %
          Math.max(availableColors.length, 1)
      ] || availableColors.find((color) => color !== card.color);
    const correctSample =
      findCard({
        color: card.color,
        excludeId: card.id,
        preferDifferentType: card.type,
      }) || card;
    const wrongSample =
      findCard({
        color: otherColor,
        preferDifferentType: correctSample.type,
      }) || normalCards.find((item) => item.color !== card.color);
    const targets = arrangeTargets(
      makeTarget(correctSample, "color"),
      makeTarget(wrongSample, "color"),
      index % 2 === 0
    );

    return {
      id: `color_${index + 1}_${card.id}`,
      card,
      rule: "color",
      matchBy: "color",
      imageVariant: "normal",
      ...targets,
    };
  });

  const orderedTypeCards = pickDiverseCards(
    [
      ...availableTypes
        .map((type, index) =>
          findCard({
            type,
            color:
              availableColors[
                (index + 2) % Math.max(availableColors.length, 1)
              ],
          }) || findCard({ type })
        )
        .filter(Boolean),
      ...normalCards,
    ],
    Math.min(8, normalCards.length)
  );

  const typeTestTrials = orderedTypeCards.map((card, index) => {
    const wrongType =
      availableTypes[
        (availableTypes.indexOf(card.type) + 1 + index) %
          Math.max(availableTypes.length, 1)
      ] || availableTypes.find((type) => type !== card.type);

    const correctSample =
      findCard({
        type: card.type,
        excludeId: card.id,
        preferDifferentColor: card.color,
      }) || card;

    const wrongSample =
      findCard({ color: card.color, type: wrongType }) ||
      findCard({
        type: wrongType,
        preferDifferentColor: correctSample.color,
      }) ||
      normalCards.find((item) => item.type !== card.type);

    const targets = arrangeTargets(
      makeTarget(correctSample, "type"),
      makeTarget(wrongSample, "type"),
      index % 2 === 0
    );

    return {
      id: `type_${index + 1}_${card.id}`,
      card,
      rule: "type",
      matchBy: "type",
      imageVariant: "normal",
      previousRule: "color",
      ...targets,
    };
  });

  const orderedBagCards = pickDiverseCards(
    [
      ...availableColors
        .map((color, index) =>
          findCard({
            color,
            type:
              availableTypes[
                (index + 4) % Math.max(availableTypes.length, 1)
              ],
            requireBag: true,
          }) || findCard({ color, requireBag: true })
        )
        .filter(Boolean),
      ...bagCards,
    ],
    Math.min(6, bagCards.length)
  );

  const bagColorTestTrials = orderedBagCards.map((card, index) => {
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
      findCard({ type: card.type, color: wrongColor }) ||
      findCard({
        color: wrongColor,
        preferDifferentType: correctSample.type,
      }) ||
      normalCards.find((item) => item.color !== card.color);

    const targets = arrangeTargets(
      makeTarget(correctSample, "color"),
      makeTarget(wrongSample, "color"),
      index % 2 !== 0
    );

    return {
      id: `bag_color_${index + 1}_${card.id}`,
      card,
      rule: "color",
      ruleStage: "bagColor",
      matchBy: "color",
      imageVariant: "bag",
      previousRule: "type",
      isBagColorTrial: true,
      ...targets,
    };
  });

  return {
    practiceTrials,
    colorTestTrials,
    typeTestTrials,
    bagColorTestTrials,
  };
}

function average(numbers = []) {
  const valid = numbers.filter(
    (n) => typeof n === "number" && Number.isFinite(n)
  );

  if (valid.length === 0) return 0;

  return Math.round(valid.reduce((sum, n) => sum + n, 0) / valid.length);
}

function safeParseStorageItem(key, fallback = null) {
  try {
    const value = window.localStorage?.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getStoredCurrentChild() {
  if (typeof window === "undefined") return null;

  const currentChild = safeParseStorageItem("currentChild", null);
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
}

function saveSessionResult(resultData, { syncUnified = true } = {}) {
  const currentChild = getStoredCurrentChild();
  const childId =
    resultData?.childId ||
    currentChild?.childId ||
    currentChild?.id ||
    currentChild?.patientId ||
    null;

  try {
    const serializedResult = JSON.stringify(resultData);

    // 結果頁重新整理時使用的暫存結果。
    sessionStorage.setItem(SESSION_KEY, serializedResult);
    sessionStorage.setItem(TEST_SESSION_KEY, serializedResult);

    // 家長端、醫療端及訓練頁可讀取的最新正式測驗結果。
    localStorage.setItem(TEST_STORAGE_KEY, serializedResult);
    localStorage.setItem(LATEST_TEST_STORAGE_KEY, serializedResult);

    // 同一裝置有多位兒童時，保留 child-specific 結果，避免互相覆蓋。
    if (childId) {
      localStorage.setItem(
        `${TEST_STORAGE_KEY}_${childId}`,
        serializedResult
      );
    }
  } catch (error) {
    console.warn("DCCS 測驗結果儲存失敗：", error);
  }

  if (!syncUnified) return;

  try {
    saveUnifiedResult({
      rawResult: resultData,
      gameId: "DCCS",
      mode: "test",
      difficulty: resultData?.difficulty || "normal",
      child: currentChild,
      route: RESULT_ROUTE,
      visibleRoles: ["child", "parent", "clinician"],
    });
  } catch (error) {
    console.warn("DCCS 測驗結果同步到統一紀錄失敗：", error);
  }
}

function positionToLegacySide(position) {
  if (position === "top") return "left";
  if (position === "bottom") return "right";
  return null;
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

  const {
    practiceTrials,
    colorTestTrials,
    typeTestTrials,
    bagColorTestTrials,
  } = useMemo(() => buildDccsTrialSets(), []);

  const currentTrials = useMemo(() => {
    switch (phase) {
      case PHASE.PRACTICE:
        return practiceTrials;
      case PHASE.COLOR_TEST:
        return colorTestTrials;
      case PHASE.TYPE_TEST:
        return typeTestTrials;
      case PHASE.BAG_COLOR_TEST:
        return bagColorTestTrials;
      default:
        return [];
    }
  }, [
    bagColorTestTrials,
    colorTestTrials,
    phase,
    practiceTrials,
    typeTestTrials,
  ]);

  const currentTrial = currentTrials[trialIndex];
  const formalTotalTrials =
    colorTestTrials.length +
    typeTestTrials.length +
    bagColorTestTrials.length;

  const pageBackgroundStyle = useMemo(() => ({
    backgroundImage: `
      linear-gradient(rgba(255, 244, 206, 0.30), rgba(255, 244, 206, 0.30)),
      url(${dccsBackgroundImg})
    `,
  }), []);
  const dccsStyleElement = useMemo(
    () => <style>{dccsTestPageCss}</style>,
    []
  );

  const clearPendingTiming = useCallback(() => {
    if (nextTrialTimerRef.current) {
      window.clearTimeout(nextTrialTimerRef.current);
      nextTrialTimerRef.current = null;
    }

    if (trialStartRafRef.current) {
      window.cancelAnimationFrame(trialStartRafRef.current);
      trialStartRafRef.current = null;
    }
  }, []);

  const markTrialStartAfterPaint = useCallback(() => {
    if (trialStartRafRef.current) {
      window.cancelAnimationFrame(trialStartRafRef.current);
    }

    trialStartTimeRef.current = null;
    trialStartRafRef.current = window.requestAnimationFrame(() => {
      trialStartTimeRef.current = Date.now();
      trialStartRafRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      clearPendingTiming();
    };
  }, [clearPendingTiming]);

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
      setPhase(PHASE.VIDEO_STEP);
      return;
    }

    if (phase === PHASE.VIDEO_STEP) {
      startTrialPhase(PHASE.PRACTICE);
      return;
    }

    if (phase === PHASE.SWITCH_RULE) {
      startTrialPhase(PHASE.TYPE_TEST);
      return;
    }

    if (phase === PHASE.BAG_RULE) {
      startTrialPhase(PHASE.BAG_COLOR_TEST);
    }
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

    if (trial.previousRule === "color" || trial.rule === "type") {
      const oldColorKey = trial.card.color;

      if (trial.topTarget?.colorKey === oldColorKey) return "top";
      if (trial.bottomTarget?.colorKey === oldColorKey) return "bottom";
    }

    if (trial.previousRule === "type" || trial.ruleStage === "bagColor") {
      const oldTypeKey = trial.card.type;

      if (trial.topTarget?.typeKey === oldTypeKey) return "top";
      if (trial.bottomTarget?.typeKey === oldTypeKey) return "bottom";
    }

    return null;
  };

  const buildResultData = (finalLogs) => {
    const formalLogs = finalLogs.filter(
      (trial) =>
        trial.phase === PHASE.COLOR_TEST ||
        trial.phase === PHASE.TYPE_TEST ||
        trial.phase === PHASE.BAG_COLOR_TEST
    );

    const colorLogs = formalLogs.filter(
      (trial) => trial.phase === PHASE.COLOR_TEST
    );
    const typeLogs = formalLogs.filter(
      (trial) => trial.phase === PHASE.TYPE_TEST
    );
    const bagColorLogs = formalLogs.filter(
      (trial) => trial.phase === PHASE.BAG_COLOR_TEST
    );
    const switchLogs = [...typeLogs, ...bagColorLogs];

    // dccsScoring 舊版若只辨識 color_test，將第三關映射成顏色題供評分，
    // 原始 phase 仍完整保留在正式 trialLogs 中。
    const scoringLogs = formalLogs.map((trial) =>
      trial.phase === PHASE.BAG_COLOR_TEST
        ? {
            ...trial,
            originalPhase: trial.phase,
            phase: PHASE.COLOR_TEST,
            isBagColorTrial: true,
          }
        : trial
    );

    const totalTrials = formalLogs.length;
    const correctCount = formalLogs.filter(
      (trial) => trial.isCorrect
    ).length;

    const firstHalfLogs = formalLogs.slice(
      0,
      Math.ceil(formalLogs.length / 2)
    );
    const secondHalfLogs = formalLogs.slice(
      Math.ceil(formalLogs.length / 2)
    );

    const firstHalfRT = average(
      firstHalfLogs.map((trial) => trial.reactionTime)
    );
    const secondHalfRT = average(
      secondHalfLogs.map((trial) => trial.reactionTime)
    );
    const firstHalfErrors = firstHalfLogs.filter(
      (trial) => !trial.isCorrect
    ).length;
    const secondHalfErrors = secondHalfLogs.filter(
      (trial) => !trial.isCorrect
    ).length;

    const standardColorCorrectCount = colorLogs.filter(
      (trial) => trial.isCorrect
    ).length;
    const bagColorCorrectCount = bagColorLogs.filter(
      (trial) => trial.isCorrect
    ).length;
    const standardColorAccuracy =
      colorLogs.length > 0
        ? Math.round((standardColorCorrectCount / colorLogs.length) * 100)
        : 0;
    const bagColorAccuracy =
      bagColorLogs.length > 0
        ? Math.round((bagColorCorrectCount / bagColorLogs.length) * 100)
        : 0;
    const standardColorAvgReactionTime = average(
      colorLogs.map((trial) => trial.reactionTime)
    );
    const bagColorAvgReactionTime = average(
      bagColorLogs.map((trial) => trial.reactionTime)
    );
    const visualInterferenceCost =
      bagColorLogs.length > 0 && colorLogs.length > 0
        ? bagColorAvgReactionTime - standardColorAvgReactionTime
        : 0;
    const secondSwitchPerseverativeErrors = bagColorLogs.filter(
      (trial) => trial.isPerseverativeError
    ).length;

    const perseverativeErrors = switchLogs.filter(
      (trial) => trial.isPerseverativeError
    ).length;
    const wrongTarget = formalLogs.filter(
      (trial) => !trial.isCorrect && !trial.isPerseverativeError
    ).length;

    const errorTypes = {
      miss: 0,
      randomClick: clickBehaviorRef.current.randomClick,
      wrongTarget,
      repeatedClick: clickBehaviorRef.current.repeatedClick,
      timeout: 0,
      sequenceError: 0,
      ruleSwitchError: perseverativeErrors,
    };

    // 通用分析仍保留作為疲勞與錯誤型態的補充資料，
    // 但正式分數與星級統一由 dccsScoring.js 計算。
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

    const scoring = calculateDccsScore({
      gameId: "DCCS",
      task: "DCCS",
      mode: "test",
      scoringMode: "test",
      difficulty: "normal",
      totalTrials,
      correctCount,
      trialLogs: scoringLogs,
    });

    const recommendedDifficulty = getRecommendedDifficulty({
      accuracy: scoring.accuracyPercent,
      avgReactionTime: scoring.avgReactionTime,
      errorTypes,
      fatigueLevel,
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

    const baseResult = createGameResult({
      childId,
      gameId: "DCCS",
      abilityType: "cognitiveFlexibility",
      mode: "test",
      difficulty: "normal",
      score: scoring.totalScore,
      stars: scoring.stars,
      accuracy: scoring.accuracyPercent,
      avgReactionTime: scoring.avgReactionTime,
      totalPlayTime,
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
      abilityType: "cognitiveFlexibility",
      mode: "test",
      scoringMode: "test",
      difficulty: "normal",
      childId,

      // DCCS 專用評分結果是正式資料來源。
      score: scoring.totalScore,
      totalScore: scoring.totalScore,
      stars: scoring.stars,
      scoring,

      totalTrials: scoring.totalTrials,
      correctCount: scoring.correctCount,
      correctTrials: scoring.correctCount,
      incorrectTrials: Math.max(
        0,
        scoring.totalTrials - scoring.correctCount
      ),

      accuracy: scoring.accuracyPercent,
      accuracyRatio: scoring.accuracy,

      colorTrials: scoring.colorTrials,
      colorAccuracy: scoring.colorAccuracyPercent,
      colorAccuracyRatio: scoring.colorAccuracy,

      standardColorTrials: colorLogs.length,
      standardColorCorrectCount,
      standardColorAccuracy,
      standardColorAvgReactionTime,

      bagColorTrials: bagColorLogs.length,
      bagColorCorrectCount,
      bagColorAccuracy,
      bagColorAvgReactionTime,
      visualInterferenceCost,
      secondSwitchPerseverativeErrors,

      typeTrials: scoring.typeTrials,
      typeAccuracy: scoring.typeAccuracyPercent,
      typeAccuracyRatio: scoring.typeAccuracy,

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

      firstTryAccuracy: scoring.firstTryAccuracyPercent,
      firstTryAccuracyRatio: scoring.firstTryAccuracy,

      perseverativeErrors: scoring.perseverativeErrors,
      oldRuleInterference: scoring.perseverativeErrors,
      perseverativeErrorRate: scoring.perseverativeErrorRatePercent,
      perseverativeErrorRateRatio: scoring.perseverativeErrorRate,

      avgReactionTime: scoring.avgReactionTime,
      preSwitchAvgReactionTime: scoring.preSwitchAvgReactionTime,
      colorAvgReactionTime: scoring.colorAvgReactionTime,
      typeAvgReactionTime: scoring.typeAvgReactionTime,
      switchAvgReactionTime: scoring.switchAvgReactionTime,
      postSwitchAvgReactionTime: scoring.postSwitchAvgReactionTime,
      rtDifferenceAfterSwitch: scoring.rtDifferenceAfterSwitch,
      responseStabilityScore: scoring.responseStabilityScore,
      reactionTimeCv: scoring.reactionTimeCv,
      reactionTimeValidCount: scoring.reactionTimeValidCount,
      reactionTimeCvReliable: scoring.reactionTimeCvReliable,
      bestStreak: scoring.bestStreak,

      parentIndicators: scoring.parentIndicators,
      clinicianMetrics: scoring.clinicianMetrics,
      childMessage: scoring.childMessage,
      parentSummary: scoring.parentSummary,
      clinicianSummary: scoring.clinicianSummary,
      reactionTimeLevel: scoring.reactionTimeLevel,
      hasEnoughTrials: scoring.hasEnoughTrials,
      minimumReliableTrials: scoring.minimumReliableTrials,

      errorTypes,
      fatigueLevel,
      fatigueResult,
      recommendedDifficulty,
      firstHalfRT,
      secondHalfRT,
      totalPlayTime,
      trialLogs: formalLogs,
      records: formalLogs,
      trials: formalLogs,

      createdAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
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

    // finishTest 已同步過統一紀錄；進入結果頁只更新本機備援，避免重複新增紀錄。
    saveSessionResult(resultData, {
      syncUnified: !pendingResult,
    });

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
      setPhase(PHASE.BAG_RULE);
      setTrialIndex(0);
      trialStartTimeRef.current = null;
      return;
    }

    if (phase === PHASE.BAG_COLOR_TEST) {
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
    const isAfterRuleSwitch =
      phase === PHASE.TYPE_TEST || phase === PHASE.BAG_COLOR_TEST;
    const isPerseverativeError =
      isAfterRuleSwitch && !isCorrect && position === oldRulePosition;

    const formalTrialNumber =
      phase === PHASE.COLOR_TEST
        ? trialIndex + 1
        : phase === PHASE.TYPE_TEST
        ? colorTestTrials.length + trialIndex + 1
        : phase === PHASE.BAG_COLOR_TEST
        ? colorTestTrials.length + typeTestTrials.length + trialIndex + 1
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
      topTargetType: currentTrial.topTarget.typeKey || null,
      topTargetSampleCardId: currentTrial.topTarget.sampleCardId || null,

      bottomTarget: currentTrial.bottomTarget.key,
      bottomTargetLabel: currentTrial.bottomTarget.label,
      bottomTargetOldColor: currentTrial.bottomTarget.colorKey || null,
      bottomTargetType: currentTrial.bottomTarget.typeKey || null,
      bottomTargetSampleCardId: currentTrial.bottomTarget.sampleCardId || null,

      userAnswerSide: position,
      correctSide: correctPosition,
      oldRuleSide: oldRulePosition,

      userAnswerSideLegacy: positionToLegacySide(position),
      correctSideLegacy: positionToLegacySide(correctPosition),
      oldRuleSideLegacy: positionToLegacySide(oldRulePosition),

      isCorrect,
      correct: isCorrect,
      reactionTime,
      responseTime: reactionTime,
      attemptCount: 1,
      wrongTapCount: 0,
      isFirstTry: true,

      imageVariant: currentTrial.imageVariant || "normal",
      isBagged: currentTrial.imageVariant === "bag",
      isBagColorTrial: phase === PHASE.BAG_COLOR_TEST,
      switchIndex:
        phase === PHASE.TYPE_TEST
          ? 1
          : phase === PHASE.BAG_COLOR_TEST
          ? 2
          : 0,
      switchDirection:
        phase === PHASE.TYPE_TEST
          ? "color_to_type"
          : phase === PHASE.BAG_COLOR_TEST
          ? "type_to_color"
          : null,

      wasAfterRuleSwitch: isAfterRuleSwitch,
      isAfterSwitch: isAfterRuleSwitch,
      isPostSwitch: isAfterRuleSwitch,

      isInterferenceTrial:
        isAfterRuleSwitch &&
        Boolean(correctPosition) &&
        Boolean(oldRulePosition) &&
        correctPosition !== oldRulePosition,

      isPerseverativeError,
      isOldRuleInterference: isPerseverativeError,
      oldRuleError: isPerseverativeError,
      errorType: isPerseverativeError
        ? "perseverative"
        : isCorrect
        ? null
        : "wrong_target",
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
        {dccsStyleElement}
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
        {dccsStyleElement}
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

  const renderSwitchRule = () => {
    const examples = typeTestTrials.slice(0, 2);

    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        {dccsStyleElement}
        <div className="Dcss-switch-card Dcss-picture-rule-card">
          <img src={peacockImg} alt="孔雀小姐" className="Dcss-peacock-rule" />

          <div className="Dcss-rule-content Dcss-picture-rule-content">
            <div className="Dcss-tag danger">換規則</div>
            <h1 className="Dcss-switch-title">接下來改看衣服種類</h1>
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
                      src={getCardImage(example.card, "normal")}
                      alt={`${example.card.colorText}${example.card.typeText}`}
                    />
                    <span className="Dcss-big-arrow">→</span>
                    <div className="Dcss-demo-target Dcss-demo-target-type">
                      <ShadowCloth
                        src={correctTarget?.image}
                        label={`${correctTarget?.label || "服飾"}剪影`}
                      />
                      <img
                        src={index % 2 === 0 ? basketTopImg : basketBottomImg}
                        alt={`${correctTarget?.label || "服飾"}籃子`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="Dcss-guided-action Dcss-guided-rule">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-next"
                onClick={goNextStaticPage}
                aria-label="下一步"
              >
                <img src={homeNextBtn} alt="下一步" />
              </button>
              <img
                className="Dcss-mouse-guide Dcss-mouse-on-button"
                src={mouseGuideImg}
                alt="提示點擊"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBagRule = () => {
    const examples = bagColorTestTrials.slice(0, 2);

    return (
      <div className="Dcss-page Dcss-srt-like-page" style={pageBackgroundStyle}>
        {dccsStyleElement}
        <div className="Dcss-switch-card Dcss-picture-rule-card">
          <img src={peacockImg} alt="孔雀小姐" className="Dcss-peacock-rule" />

          <div className="Dcss-rule-content Dcss-picture-rule-content">
            <div className="Dcss-tag danger">再換一次規則</div>
            <h1 className="Dcss-switch-title">
              衣服裝在袋子裡，也要按照顏色分類
            </h1>
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
                      src={getCardImage(example.card, "bag")}
                      alt={`裝袋的${example.card.colorText}${example.card.typeText}`}
                      className="Dcss-rule-bagged-cloth"
                    />
                    <span className="Dcss-big-arrow">→</span>
                    <div className="Dcss-demo-target Dcss-demo-target-type">
                      <ShadowCloth
                        src={correctTarget?.image}
                        label={`${correctTarget?.label || "相同顏色"}服飾`}
                      />
                      <img
                        src={index % 2 === 0 ? basketTopImg : basketBottomImg}
                        alt={`${correctTarget?.label || "相同顏色"}籃子`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {examples.length === 0 && (
              <div className="Dcss-data-warning">
                dccsClothingData.js 尚未提供 bagImg，請先加入裝袋服飾圖片。
              </div>
            )}

            <div className="Dcss-guided-action Dcss-guided-rule">
              <button
                type="button"
                className="Dcss-forest-button Dcss-image-button Dcss-btn-next"
                onClick={goNextStaticPage}
                aria-label="下一步"
                disabled={examples.length === 0}
              >
                <img src={homeNextBtn} alt="下一步" />
              </button>
              {examples.length > 0 && (
                <img
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

  const getRuleTitle = () => {
    if (phase === PHASE.PRACTICE) return "看顏色";
    if (phase === PHASE.COLOR_TEST) return "看顏色";
    if (phase === PHASE.TYPE_TEST) return "看衣服種類";
    if (phase === PHASE.BAG_COLOR_TEST) return "看袋子裡衣服的顏色";
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

    if (phase === PHASE.BAG_COLOR_TEST) {
      return `${
        colorTestTrials.length + typeTestTrials.length + trialIndex + 1
      } / ${formalTotalTrials}`;
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
        image: target.image,
      };
    }

    return {
      mode,
      label: typeLabels[target.key] || target.label,
      image: target.image,
    };
  };

  const renderTargetVisual = (target) => {
    const visual = getTargetVisual(target);

    if (!visual.image) return null;

    return (
      <div
        className={`Dcss-visual-target Dcss-target-clothing ${
          visual.mode === "color"
            ? "Dcss-color-target-clothing"
            : "Dcss-type-target-clothing"
        }`}
      >
        <img
          src={visual.image}
          alt={
            visual.mode === "color"
              ? `${visual.label}衣服`
              : `${visual.label}圖示`
          }
        />
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
        {dccsStyleElement}
        <div className="Dcss-test-shell Dcss-test-shell-visual Dcss-training-shell-visual">
          <div className="Dcss-top-bar Dcss-top-bar-compact">
            <div className="Dcss-top-spacer" aria-hidden="true" />

            <div className="Dcss-progress-pill">{getProgressText()}</div>
          </div>

          <div
            className="Dcss-main-area Dcss-main-area-bottom-baskets Dcss-main-area-visual Dcss-training-main-area-visual"
            onClick={handleTrialAreaClick}
          >
            <div className="Dcss-play-row">
              <div className="Dcss-card-stage Dcss-card-stage-visual">
                <div
                  className={`Dcss-cloth-card ${
                    currentTrial.imageVariant === "bag"
                      ? "Dcss-cloth-card-bagged"
                      : ""
                  } ${feedback ? feedback.type : ""}`}
                  aria-label={getRuleTitle()}
                >
                  <img
                    src={getCardImage(
                      currentTrial.card,
                      currentTrial.imageVariant || "normal"
                    )}
                    alt={`${
                      currentTrial.imageVariant === "bag" ? "裝袋的" : ""
                    }${currentTrial.card.colorText}${currentTrial.card.typeText}`}
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
                aria-label={currentTrial.topTarget.label}
              >
                <div className="Dcss-basket-choice-label">
                  {renderTargetVisual(currentTrial.topTarget)}
                </div>
                <div className="Dcss-basket-choice-image">
                  <img src={basketTopImg} alt="左側籃子" />
                </div>
              </button>

              <button
                type="button"
                className={`Dcss-basket-btn Dcss-visual-basket-btn ${
                  selectedPosition === "bottom" ? "selected" : ""
                }`}
                onClick={() => handleAnswer("bottom")}
                disabled={isLocked}
                aria-label={currentTrial.bottomTarget.label}
              >
                <div className="Dcss-basket-choice-label">
                  {renderTargetVisual(currentTrial.bottomTarget)}
                </div>
                <div className="Dcss-basket-choice-image">
                  <img src={basketBottomImg} alt="右側籃子" />
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
        {dccsStyleElement}
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
                  onClick={() => navigate(TEST_PAGE_ROUTE)}
                  aria-label="回到森林"
                >
                  <img src={homeBackBtn} alt="回到森林" />
                </button>
                <img className="Dcss-mouse-guide Dcss-mouse-on-button" src={mouseGuideImg} alt="提示點擊" aria-hidden="true" />
              </div>
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
      src: START_VIDEO_SRC,
      title: "開始影片",
      buttonText: "跳過",
      onDone: goNextStaticPage,
    });
  }

  if (phase === PHASE.VIDEO_STEP) {
    return renderVideoPage({
      src: STEP_VIDEO_SRC,
      title: "前導教學",
      buttonText: "跳過",
      onDone: goNextStaticPage,
    });
  }

  if (phase === PHASE.SWITCH_RULE) return renderSwitchRule();

  if (phase === PHASE.BAG_RULE) return renderBagRule();

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
.Dcss-btn-next { width: clamp(172px, 17vw, 238px); }
.Dcss-btn-home,
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


/* 與 TrainingPage_DCCS 一致的測驗遊戲區版面。 */
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
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: clamp(6px, 1vh, 12px) !important;
  min-height: clamp(210px, 27vh, 300px) !important;
  padding: clamp(10px, 1.4vw, 18px) clamp(8px, 1vw, 14px) !important;
  overflow: visible !important;
}

.Dcss-training-main-area-visual .Dcss-feedback {
  grid-column: 1 !important;
  grid-row: auto !important;
  position: relative !important;
  inset: auto !important;
  transform: none !important;
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
  .Dcss-training-main-area-visual .Dcss-baskets-bottom {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    width: min(100%, 560px) !important;
    gap: 12px !important;
  }

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


/* DCCS 測驗畫面：保留原本衣服與籃子配置，只移除後方卡片裝飾 */
.Dcss-test-shell-visual {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.Dcss-test-shell-visual::before {
  display: none !important;
}

.Dcss-test-shell-visual .Dcss-main-area,
.Dcss-test-shell-visual .Dcss-main-area-bottom-baskets,
.Dcss-test-shell-visual .Dcss-card-stage,
.Dcss-test-shell-visual .Dcss-cloth-card,
.Dcss-test-shell-visual .Dcss-visual-basket-btn,
.Dcss-test-shell-visual .Dcss-basket-btn {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.Dcss-test-shell-visual .Dcss-cloth-card::before,
.Dcss-test-shell-visual .Dcss-cloth-card::after,
.Dcss-test-shell-visual .Dcss-visual-basket-btn::before,
.Dcss-test-shell-visual .Dcss-visual-basket-btn::after,
.Dcss-test-shell-visual .Dcss-basket-btn::before,
.Dcss-test-shell-visual .Dcss-basket-btn::after {
  display: none !important;
}

.Dcss-test-shell-visual .Dcss-cloth-card,
.Dcss-test-shell-visual .Dcss-visual-basket-btn {
  overflow: visible !important;
}


/* 結果頁下方按鈕置中 */
.Dcss-result-actions {
  width: fit-content !important;
  max-width: 100%;
  grid-template-columns: repeat(2, auto) !important;
  justify-content: center !important;
  justify-items: center !important;
  align-items: center;
  margin-inline: auto;
}

@media (max-width: 620px) {
  .Dcss-result-actions {
    width: min(100%, 360px) !important;
    grid-template-columns: 1fr !important;
  }
}

/* 第三關：裝袋服飾顯示與資料提示 */
.Dcss-cloth-card-bagged img {
  width: 118% !important;
  height: 118% !important;
  max-width: 118% !important;
  max-height: 118% !important;
  object-fit: contain !important;
  filter: drop-shadow(0 12px 10px rgba(48, 39, 28, 0.18));
}

.Dcss-rule-bagged-cloth {
  transform: scale(1.08);
  transform-origin: center;
}

.Dcss-data-warning {
  width: min(100%, 720px);
  margin: 6px auto 0;
  padding: 14px 18px;
  border: 2px solid #d97706;
  border-radius: 16px;
  background: rgba(255, 247, 220, 0.96);
  color: #7c2d12;
  font-size: clamp(17px, 1.8vw, 24px);
  font-weight: 800;
  line-height: 1.5;
}

.Dcss-btn-next:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  filter: grayscale(0.5);
}

`;
