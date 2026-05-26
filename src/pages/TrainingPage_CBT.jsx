import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import stoneImg from "../asset/stone.png";
import personImg from "../asset/CBT_person.png";
import bgImg from "../asset/CBT_testbackground.png";
import introVideo from "../asset/SRT_start.mp4";
import clickSoundFile from "../asset/Click_SRT.mp3";
import startAvatar from "../asset/avatar/deer.png";
import homeStartBtn from "../asset/home/start.png";
import homeSkipBtn from "../asset/home/skip.png";
import homeBackBtn from "../asset/home/back.png";
import homeAgainBtn from "../asset/home/again.png";
import homeResultBtn from "../asset/home/result.png";
import mouseGuideImg from "../asset/mouse.png";

import "../styles/GamePage_CBT.css";

const SHOW_SPEED = 700;
const GAP_SPEED = 260;
const TOTAL_TRAINING_ROUNDS = 8;
const COMPLETED_LEVELS_STORAGE_KEY = "ef_game_completed_training_levels";
const STAGE_STARS_STORAGE_KEY = "ef_game_training_stage_stars";
const CBT_TRAINING_HISTORY_KEY = "ef_game_cbt_training_history";
const CBT_TRAINING_RESULT_KEY = "ef_game_cbt_training_result";

const BOARD_WIDTH = 760;
const BOARD_HEIGHT = 455;
const STONE_SIZE = 128;
const WARMUP_STONE_SIZE = 128;
const MIN_STONE_DISTANCE = 150;

const WARMUP_SEQUENCE = [0, 1];
const PERSON_WALK_MS = 260;

const MICRO_DIFFICULTY_ORDER = [
  "veryEasy1", "veryEasy2", "veryEasy3",
  "easy1", "easy2", "easy3",
  "normal1", "normal2", "normal3",
  "advanced1", "advanced2", "advanced3",
  "hard1", "hard2", "hard3",
  "expert1", "expert2", "expert3",
];

const LEVEL_BASE_MICRO_INDEX = [0, 1, 3, 4, 6, 7, 9, 10, 12, 13, 15, 16];
const LEVEL_MAX_MICRO_INDEX = [2, 2, 5, 5, 8, 8, 10, 10, 13, 13, 15, 15];

const MICRO_DIFFICULTY_RANK = MICRO_DIFFICULTY_ORDER.reduce((map, key, index) => {
  map[key] = index;
  return map;
}, {});

const MICRO_DIFFICULTY_CONFIG = {
  veryEasy1: {
    label: "暖身 1",
    macro: "veryEasy",
    storyTitle: "慢慢小路",
    storyText: "先熟悉玩法，只記短短兩步。",
    minLevel: 2,
    maxLevel: 2,
    blockCount: 4,
    answerTime: 16,
    showSpeed: 980,
    hintLevel: 3,
    allowActiveReplay: true,
    replayLimit: 2,
    distractor: { enabled: false, count: 0, interval: 0, duration: 0, avoidNextTarget: true },
  },
  veryEasy2: {
    label: "暖身 2",
    macro: "veryEasy",
    storyTitle: "慢慢小路",
    storyText: "一樣是短路線，速度稍微快一點。",
    minLevel: 2,
    maxLevel: 2,
    blockCount: 4,
    answerTime: 15,
    showSpeed: 930,
    hintLevel: 3,
    allowActiveReplay: true,
    replayLimit: 2,
    distractor: { enabled: false, count: 0, interval: 0, duration: 0, avoidNextTarget: true },
  },
  veryEasy3: {
    label: "暖身 3",
    macro: "veryEasy",
    storyTitle: "多一顆石頭",
    storyText: "石頭變多，但路線還是很短。",
    minLevel: 2,
    maxLevel: 2,
    blockCount: 5,
    answerTime: 15,
    showSpeed: 900,
    hintLevel: 2,
    allowActiveReplay: true,
    replayLimit: 1,
    distractor: { enabled: false, count: 0, interval: 0, duration: 0, avoidNextTarget: true },
  },
  easy1: {
    label: "基礎 1",
    macro: "easy",
    storyTitle: "短短小路",
    storyText: "開始練習 2 到 3 步。",
    minLevel: 2,
    maxLevel: 3,
    blockCount: 5,
    answerTime: 14,
    showSpeed: 850,
    hintLevel: 2,
    allowActiveReplay: true,
    replayLimit: 2,
    distractor: { enabled: false, count: 0, interval: 0, duration: 0, avoidNextTarget: true },
  },
  easy2: {
    label: "基礎 2",
    macro: "easy",
    storyTitle: "短短小路",
    storyText: "後半段會有很淡的小閃光。",
    minLevel: 2,
    maxLevel: 3,
    blockCount: 5,
    answerTime: 14,
    showSpeed: 820,
    hintLevel: 2,
    allowActiveReplay: true,
    replayLimit: 1,
    distractor: { enabled: true, startRound: 4, count: 1, interval: 4700, duration: 420, avoidNextTarget: true },
  },
  easy3: {
    label: "基礎 3",
    macro: "easy",
    storyTitle: "三步小路",
    storyText: "路線穩定到 3 步，提示會少一點。",
    minLevel: 3,
    maxLevel: 3,
    blockCount: 5,
    answerTime: 13,
    showSpeed: 790,
    hintLevel: 1,
    allowActiveReplay: true,
    replayLimit: 1,
    distractor: { enabled: true, startRound: 3, count: 1, interval: 4300, duration: 450, avoidNextTarget: true },
  },
  normal1: {
    label: "穩定 1",
    macro: "normal",
    storyTitle: "石頭小路",
    storyText: "3 步路線搭配 6 顆石頭。",
    minLevel: 3,
    maxLevel: 3,
    blockCount: 6,
    answerTime: 13,
    showSpeed: 740,
    hintLevel: 1,
    allowActiveReplay: true,
    replayLimit: 1,
    distractor: { enabled: true, startRound: 0, count: 1, interval: 3800, duration: 500, avoidNextTarget: true },
  },
  normal2: {
    label: "穩定 2",
    macro: "normal",
    storyTitle: "石頭小路",
    storyText: "慢慢進入 3 到 4 步。",
    minLevel: 3,
    maxLevel: 4,
    blockCount: 6,
    answerTime: 12,
    showSpeed: 710,
    hintLevel: 1,
    allowActiveReplay: true,
    replayLimit: 1,
    distractor: { enabled: true, startRound: 0, count: 1, interval: 3500, duration: 560, avoidNextTarget: true },
  },
  normal3: {
    label: "穩定 3",
    macro: "normal",
    storyTitle: "四步小路",
    storyText: "提示更少，主要練習 4 步。",
    minLevel: 4,
    maxLevel: 4,
    blockCount: 6,
    answerTime: 12,
    showSpeed: 690,
    hintLevel: 0,
    allowActiveReplay: true,
    replayLimit: 1,
    distractor: { enabled: true, startRound: 0, count: 1, interval: 3300, duration: 580, avoidNextTarget: true },
  },
  advanced1: {
    label: "進階 1",
    macro: "advanced",
    storyTitle: "彎彎小路",
    storyText: "石頭更多，但還保留一次重看。",
    minLevel: 4,
    maxLevel: 4,
    blockCount: 7,
    answerTime: 12,
    showSpeed: 660,
    hintLevel: 0,
    allowActiveReplay: true,
    replayLimit: 1,
    distractor: { enabled: true, startRound: 0, count: 1, interval: 3000, duration: 620, avoidNextTarget: true },
  },
  advanced2: {
    label: "進階 2",
    macro: "advanced",
    storyTitle: "彎彎小路",
    storyText: "開始練習 4 到 5 步，提示移除。",
    minLevel: 4,
    maxLevel: 5,
    blockCount: 7,
    answerTime: 11,
    showSpeed: 630,
    hintLevel: 0,
    allowActiveReplay: false,
    replayLimit: 0,
    distractor: { enabled: true, startRound: 0, count: 1, interval: 2800, duration: 650, avoidNextTarget: true },
  },
  advanced3: {
    label: "進階 3",
    macro: "advanced",
    storyTitle: "五步小路",
    storyText: "主要練習 5 步，干擾稍微增加。",
    minLevel: 5,
    maxLevel: 5,
    blockCount: 7,
    answerTime: 11,
    showSpeed: 610,
    hintLevel: 0,
    allowActiveReplay: false,
    replayLimit: 0,
    distractor: { enabled: true, startRound: 0, count: 1, interval: 2600, duration: 680, avoidNextTarget: true },
  },
  hard1: {
    label: "挑戰 1",
    macro: "hard",
    storyTitle: "迷霧小路",
    storyText: "5 步路線，石頭增加到 8 顆。",
    minLevel: 5,
    maxLevel: 5,
    blockCount: 8,
    answerTime: 10,
    showSpeed: 580,
    hintLevel: 0,
    allowActiveReplay: false,
    replayLimit: 0,
    distractor: { enabled: true, startRound: 0, count: 1, interval: 2500, duration: 680, avoidNextTarget: true },
  },
  hard2: {
    label: "挑戰 2",
    macro: "hard",
    storyTitle: "迷霧小路",
    storyText: "進入 5 到 6 步，干擾變多。",
    minLevel: 5,
    maxLevel: 6,
    blockCount: 8,
    answerTime: 10,
    showSpeed: 560,
    hintLevel: 0,
    allowActiveReplay: false,
    replayLimit: 0,
    distractor: { enabled: true, startRound: 0, count: 2, interval: 2400, duration: 680, avoidNextTarget: true },
  },
  hard3: {
    label: "挑戰 3",
    macro: "hard",
    storyTitle: "六步小路",
    storyText: "6 步路線，作答時間再短一點。",
    minLevel: 6,
    maxLevel: 6,
    blockCount: 8,
    answerTime: 9,
    showSpeed: 540,
    hintLevel: 0,
    allowActiveReplay: false,
    replayLimit: 0,
    distractor: { enabled: true, startRound: 0, count: 2, interval: 2300, duration: 700, avoidNextTarget: true },
  },
  expert1: {
    label: "高挑戰 1",
    macro: "expert",
    storyTitle: "森林深處",
    storyText: "6 步路線，速度較快。",
    minLevel: 6,
    maxLevel: 6,
    blockCount: 9,
    answerTime: 9,
    showSpeed: 520,
    hintLevel: 0,
    allowActiveReplay: false,
    replayLimit: 0,
    distractor: { enabled: true, startRound: 0, count: 2, interval: 2200, duration: 720, avoidNextTarget: true },
  },
  expert2: {
    label: "高挑戰 2",
    macro: "expert",
    storyTitle: "森林深處",
    storyText: "進入 6 到 7 步，干擾更頻繁。",
    minLevel: 6,
    maxLevel: 7,
    blockCount: 9,
    answerTime: 9,
    showSpeed: 500,
    hintLevel: 0,
    allowActiveReplay: false,
    replayLimit: 0,
    distractor: { enabled: true, startRound: 0, count: 2, interval: 2100, duration: 740, avoidNextTarget: true },
  },
  expert3: {
    label: "高挑戰 3",
    macro: "expert",
    storyTitle: "森林深處",
    storyText: "最長 7 步，適合已經很穩定的孩子。",
    minLevel: 7,
    maxLevel: 7,
    blockCount: 9,
    answerTime: 8,
    showSpeed: 480,
    hintLevel: 0,
    allowActiveReplay: false,
    replayLimit: 0,
    distractor: { enabled: true, startRound: 0, count: 2, interval: 2000, duration: 760, avoidNextTarget: true },
  },
};

function distance(a, b) {
  const dx = a.left - b.left;
  const dy = a.top - b.top;
  return Math.sqrt(dx * dx + dy * dy);
}

function shuffleArray(array) {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function createRandomBlocks(count) {
  const blocks = [];
  const paddingX = 86;
  const paddingY = 72;
  const maxTry = 900;

  for (let i = 0; i < count; i += 1) {
    let candidate = null;

    for (let attempt = 0; attempt < maxTry; attempt += 1) {
      const top = Math.round(
        paddingY + Math.random() * (BOARD_HEIGHT - paddingY * 2)
      );
      const left = Math.round(
        paddingX + Math.random() * (BOARD_WIDTH - paddingX * 2)
      );

      candidate = { top, left };

      const safe = blocks.every(
        (block) => distance(block, candidate) >= MIN_STONE_DISTANCE
      );

      if (safe) break;
    }

    if (!candidate) {
      candidate = {
        top: paddingY + Math.round(Math.random() * 200),
        left: paddingX + Math.round(Math.random() * 520),
      };
    }

    blocks.push(candidate);
  }

  return blocks;
}

function createSequence(level, blockCount, previousLast = null) {
  const seq = [];

  for (let i = 0; i < level; i += 1) {
    let next;

    do {
      next = Math.floor(Math.random() * blockCount);
    } while (
      (i > 0 && next === seq[i - 1]) ||
      (i === 0 && previousLast !== null && next === previousLast)
    );

    seq.push(next);
  }

  return seq;
}

function createDistractorIndices({ blockCount, count, avoid = [] }) {
  const candidates = [];

  for (let i = 0; i < blockCount; i += 1) {
    if (!avoid.includes(i)) candidates.push(i);
  }

  return shuffleArray(candidates).slice(0, count);
}

function getLevelBaseMicroIndex(trainingLevel) {
  const level = clampNumber(trainingLevel, 1, 18);

  if (level <= LEVEL_BASE_MICRO_INDEX.length) {
    return LEVEL_BASE_MICRO_INDEX[level - 1];
  }

  return Math.min(MICRO_DIFFICULTY_ORDER.length - 1, level - 1);
}

function getLevelMaxMicroIndex(trainingLevel) {
  const level = clampNumber(trainingLevel, 1, 18);

  if (level <= LEVEL_MAX_MICRO_INDEX.length) {
    return LEVEL_MAX_MICRO_INDEX[level - 1];
  }

  return Math.min(MICRO_DIFFICULTY_ORDER.length - 1, level - 1);
}

function getConfigByMicroDifficulty(microDifficulty) {
  return MICRO_DIFFICULTY_CONFIG[microDifficulty] || MICRO_DIFFICULTY_CONFIG.easy1;
}

function getMacroDifficultyFromMicro(microDifficulty) {
  return getConfigByMicroDifficulty(microDifficulty).macro || "easy";
}

function getAdaptiveMicroDifficulty({
  trainingLevel,
  targetRound,
  testCapIndex,
  correctStreak,
  wrongStreak,
  history = [],
}) {
  const baseIndex = getLevelBaseMicroIndex(trainingLevel);
  const levelMaxIndex = getLevelMaxMicroIndex(trainingLevel);
  const roundProgressBonus = Math.floor(targetRound / 3);
  const latestTrial = history[history.length - 1];

  let nextIndex = baseIndex + roundProgressBonus;

  const latestWasCleanCorrect =
    latestTrial &&
    (latestTrial.correct || latestTrial.isCorrect) &&
    !latestTrial.usedReplay &&
    !latestTrial.timeout &&
    Number(latestTrial.reactionTime || 0) <= 9000;

  const latestWasEarlyWrong =
    latestTrial &&
    !(latestTrial.correct || latestTrial.isCorrect) &&
    (latestTrial.timeout || Number(latestTrial.firstErrorPosition || 99) <= 1);

  if (correctStreak >= 2 && latestWasCleanCorrect) nextIndex += 1;
  if (wrongStreak >= 2 || latestWasEarlyWrong) nextIndex -= 1;

  const testProtectedMax =
    Number.isFinite(testCapIndex)
      ? Math.min(levelMaxIndex, Math.max(baseIndex, testCapIndex + Math.floor((trainingLevel - 1) / 3)))
      : levelMaxIndex;

  nextIndex = Math.max(0, Math.min(testProtectedMax, nextIndex));

  return MICRO_DIFFICULTY_ORDER[nextIndex] || MICRO_DIFFICULTY_ORDER[0];
}

function getAdaptiveSequenceLength(roundIndex, microDifficulty, correctStreak, wrongStreak) {
  const config = getConfigByMicroDifficulty(microDifficulty);
  let level = config.minLevel + Math.floor(roundIndex / 2);

  if (correctStreak >= 2) level += 1;
  if (wrongStreak >= 2) level -= 1;

  return Math.max(config.minLevel, Math.min(config.maxLevel, level));
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function safeParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readJsonArray(key) {
  const value = safeParse(localStorage.getItem(key), []);
  return Array.isArray(value) ? value : [];
}

function writeJsonArrayUnique(key, values) {
  const current = readJsonArray(key);
  const merged = [...new Set([...current, ...values].filter(Boolean))];
  localStorage.setItem(key, JSON.stringify(merged));
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function getStoredObjectCandidates(keys) {
  return keys
    .flatMap((key) => [localStorage.getItem(key), sessionStorage.getItem(key)])
    .map((value) => safeParse(value, null))
    .filter((value) => value && typeof value === "object");
}

function getHistoryFromResult(result) {
  const candidates = [
    result?.cbtHistory,
    result?.history,
    result?.trials,
    result?.trialData,
    result?.testHistory,
    result?.records,
  ];

  return candidates.find((value) => Array.isArray(value) && value.length > 0) || [];
}

function summarizeCbtTestResult(result) {
  if (!result || typeof result !== "object") return null;

  const history = Array.isArray(result) ? result : getHistoryFromResult(result);
  const totalFromHistory = history.length;
  const correctFromHistory = history.filter((item) => item.correct || item.isCorrect).length;
  const bestSpanFromHistory = history.reduce((max, item) => {
    if (!item.correct && !item.isCorrect) return max;
    return Math.max(max, Number(item.length || item.sequenceLength || item.level || 0));
  }, 0);

  const total = Number(result.totalQuestions ?? result.totalTrials ?? result.total ?? totalFromHistory);
  const correct = Number(result.correctCount ?? result.correct ?? result.score ?? correctFromHistory);
  const accuracyCandidate = Number(result.accuracy ?? result.accuracyRate ?? result.correctRate);
  const accuracy = Number.isFinite(accuracyCandidate)
    ? accuracyCandidate > 1
      ? accuracyCandidate / 100
      : accuracyCandidate
    : total > 0
      ? correct / total
      : null;

  const bestSpan = Number(result.bestSpan ?? result.maxSpan ?? result.span ?? bestSpanFromHistory);

  if (accuracy === null && !Number.isFinite(bestSpan)) return null;

  return {
    accuracy: Number.isFinite(accuracy) ? clampNumber(accuracy, 0, 1) : 0.5,
    bestSpan: Number.isFinite(bestSpan) ? bestSpan : 0,
  };
}

function readLatestCbtTestSummary() {
  const objectCandidates = getStoredObjectCandidates([
    "ef_game_cbt_test_result",
    "cbt_test_result",
    "cbtTestResult",
    "CBT_test_result",
    "ef_game_test_cbt_result",
    "result_cbt_test",
    "cbtResult",
    "ef_game_latest_cbt_result",
  ]);

  for (const candidate of objectCandidates) {
    const summary = summarizeCbtTestResult(candidate);
    if (summary) return summary;
  }

  const historyCandidates = getStoredObjectCandidates([
    "ef_game_cbt_test_history",
    "cbt_test_history",
    "cbtHistory",
    "CBTHistory",
  ]);

  for (const candidate of historyCandidates) {
    const summary = summarizeCbtTestResult(Array.isArray(candidate) ? candidate : candidate?.history);
    if (summary) return summary;
  }

  return null;
}

function getSuggestedMicroDifficultyFromTest() {
  const testSummary = readLatestCbtTestSummary();

  if (!testSummary) return null;

  const { accuracy, bestSpan } = testSummary;

  if (accuracy >= 0.9 && bestSpan >= 6) return "expert1";
  if (accuracy >= 0.85 && bestSpan >= 5) return "advanced3";
  if (accuracy >= 0.7 && bestSpan >= 4) return "normal3";
  if (accuracy >= 0.55 && bestSpan >= 3) return "easy3";
  return "veryEasy3";
}

function getInitialMicroDifficultyForTrainingLevel(trainingLevel) {
  const baseIndex = getLevelBaseMicroIndex(trainingLevel);
  const levelMaxIndex = getLevelMaxMicroIndex(trainingLevel);
  const suggested = getSuggestedMicroDifficultyFromTest();
  const suggestedIndex = suggested ? MICRO_DIFFICULTY_RANK[suggested] : null;
  const protectedMax = Number.isFinite(suggestedIndex)
    ? Math.min(levelMaxIndex, Math.max(baseIndex, suggestedIndex))
    : levelMaxIndex;

  return MICRO_DIFFICULTY_ORDER[Math.min(protectedMax, baseIndex)] || "easy1";
}

function getTrainingScoreSummary(history) {
  const total = history.length;

  if (total <= 0) {
    return {
      stars: 1,
      score: 0,
      accuracy: 0,
      avgReactionTime: 0,
      timeoutCount: 0,
      replayCount: 0,
      rescueCount: 0,
    };
  }

  const correctCount = history.filter((item) => item.correct || item.isCorrect).length;
  const accuracy = correctCount / total;
  const validReactionTimes = history
    .map((item) => Number(item.reactionTime || item.answerTime || 0))
    .filter((value) => value > 0);
  const avgReactionTime =
    validReactionTimes.length > 0
      ? validReactionTimes.reduce((sum, value) => sum + value, 0) / validReactionTimes.length
      : 0;
  const timeoutCount = history.filter((item) => item.timeout || item.isTimeout).length;
  const replayCount = history.reduce((sum, item) => sum + Number(item.replayCount || 0), 0);
  const rescueCount = history.filter((item) => item.rescueUsed || item.isRescueAttempt).length;

  const speedScore = avgReactionTime <= 0
    ? 10
    : Math.max(0, Math.min(15, 15 * (1 - Math.max(0, avgReactionTime - 5000) / 9000)));
  const noTimeoutScore = Math.max(0, 10 - timeoutCount * 4);
  const lowReplayScore = Math.max(0, 5 - replayCount * 1.5 - rescueCount * 1.5);
  const score = Math.round(
    accuracy * 70 +
    speedScore +
    noTimeoutScore +
    lowReplayScore
  );

  return {
    stars: score >= 85 ? 3 : score >= 60 ? 2 : 1,
    score,
    accuracy,
    avgReactionTime,
    timeoutCount,
    replayCount,
    rescueCount,
  };
}

function getStarCountFromTrainingHistory(history) {
  return getTrainingScoreSummary(history).stars;
}

function saveTrainingStageResult({ stageId, gameId, level, todayKey, stars, history, summary }) {
  const safeLevel = Number(level) || 1;
  const safeTodayKey = todayKey || getTodayKey();
  const levelKey = `${gameId}-${safeLevel}`;
  const todayLevelKey = `${safeTodayKey}-${gameId}-${safeLevel}`;

  writeJsonArrayUnique(COMPLETED_LEVELS_STORAGE_KEY, [stageId, levelKey, todayLevelKey]);

  localStorage.setItem(`ef_game_${stageId}_completed`, "true");
  localStorage.setItem(`ef_game_${gameId}_level_${safeLevel}_completed`, "true");
  localStorage.setItem(`training_${gameId}_level_${safeLevel}_completed`, "true");
  localStorage.setItem(`${gameId}_training_level_${safeLevel}_completed`, "true");

  localStorage.setItem(`ef_game_${stageId}_stars`, String(stars));
  localStorage.setItem(`ef_game_${gameId}_level_${safeLevel}_stars`, String(stars));
  localStorage.setItem(`training_${gameId}_level_${safeLevel}_stars`, String(stars));
  localStorage.setItem(`${gameId}_training_level_${safeLevel}_stars`, String(stars));

  const stageStarMap = safeParse(localStorage.getItem(STAGE_STARS_STORAGE_KEY), {}) || {};
  stageStarMap[stageId] = {
    stars,
    gameId,
    level: safeLevel,
    updatedAt: new Date().toISOString(),
  };
  stageStarMap[levelKey] = stars;
  stageStarMap[todayLevelKey] = stars;
  localStorage.setItem(STAGE_STARS_STORAGE_KEY, JSON.stringify(stageStarMap));

  const savedHistory = safeParse(localStorage.getItem(CBT_TRAINING_HISTORY_KEY), []);
  const nextHistory = Array.isArray(savedHistory) ? [...savedHistory, ...history] : history;
  localStorage.setItem(CBT_TRAINING_HISTORY_KEY, JSON.stringify(nextHistory));
  localStorage.setItem(CBT_TRAINING_RESULT_KEY, JSON.stringify(summary));
}


const cbtTrainingTouchCss = `
.cbt-page {
  min-height: 100dvh;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background-image: var(--cbt-bg);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(10px, 1.5vw, 20px);
  box-sizing: border-box;
  font-family: 'jf-openhuninn', 'Fredoka', 'Nunito', 'Microsoft JhengHei', sans-serif;
}

.cbt-start-shell,
.cbt-guide-shell,
.cbt-result-shell {
  background: linear-gradient(180deg, rgba(255, 252, 225, 0.98) 0%, rgba(255, 242, 185, 0.98) 52%, rgba(255, 229, 145, 0.98) 100%);
  border: 5px solid #ffb21e;
  outline: 3px solid rgba(255, 132, 38, 0.92);
  outline-offset: -12px;
  border-radius: 58px;
  box-sizing: border-box;
  box-shadow: 0 18px 0 rgba(194, 125, 33, 0.14), 0 22px 36px rgba(86, 61, 27, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: visible;
}

.cbt-start-shell {
  width: min(78vw, 820px);
  min-height: min(68vh, 610px);
  padding: clamp(30px, 4.6vw, 54px) clamp(34px, 5vw, 62px);
  gap: clamp(24px, 3.8vw, 42px);
}

.cbt-start-title {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: min(82%, 560px);
  padding: 14px 44px 18px;
  margin: 0;
  border-radius: 24px;
  border: 4px solid #f2ad35;
  outline: 2px solid rgba(255, 235, 160, 0.9);
  outline-offset: -10px;
  background: linear-gradient(180deg, #fff2ab 0%, #ffd764 100%);
  color: #744018;
  font-size: clamp(42px, 4.6vw, 62px);
  font-weight: 900;
  line-height: 1.08;
  text-align: center;
  letter-spacing: 0.04em;
  text-shadow: 0 3px 0 rgba(255,255,255,0.78);
  box-shadow: 0 8px 0 rgba(178, 103, 21, 0.18), inset 0 -4px 0 rgba(177, 116, 20, 0.12);
}

.cbt-start-content,
.cbt-result-content {
  width: min(760px, 86%);
  display: grid;
  grid-template-columns: 1fr 150px;
  align-items: center;
  gap: 34px;
  margin-bottom: 38px;
}

.cbt-dialog-bubble {
  padding: 22px 32px;
  border: 4px solid #ffb43d;
  border-radius: 28px;
  background: rgba(255, 255, 250, 0.9);
  color: #784014;
  font-size: clamp(27px, 3.2vw, 40px);
  font-weight: 900;
  line-height: 1.42;
  text-align: center;
  box-shadow: inset 0 0 0 2px rgba(245, 204, 132, 0.38), 0 6px 0 rgba(241, 167, 53, 0.28);
  position: relative;
}

.cbt-dialog-bubble::after {
  content: "";
  position: absolute;
  inset: 10px;
  border: 2px dashed rgba(238, 190, 111, 0.55);
  border-radius: 18px;
  pointer-events: none;
}

.cbt-round-avatar {
  width: 148px;
  height: 148px;
  border-radius: 50%;
  padding: 9px;
  border: 7px solid #69c6e8;
  background: radial-gradient(circle, #fff1bb 0%, #f6d78c 100%);
  box-shadow: 0 10px 0 rgba(90, 112, 92, 0.2), 0 10px 22px rgba(73, 54, 20, 0.2);
  display: grid;
  place-items: center;
}

.cbt-round-avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
}

.cbt-video-only-card {
  width: min(92vw, 900px);
  min-height: 610px;
  padding: 30px 28px 24px;
  border-radius: 36px;
  background: rgba(255, 252, 242, 0.94);
  box-shadow: 0 14px 30px rgba(51, 39, 20, 0.14);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.cbt-video-only-card .cbt-video-wrapper {
  width: min(78vw, 720px);
  margin: 0 auto 24px;
}

.cbt-video-only-card .cbt-video {
  width: 100%;
  max-height: 390px;
  object-fit: cover;
  border-radius: 22px;
  border: 3px solid rgba(40, 28, 18, 0.9);
  box-shadow: 0 12px 18px rgba(54, 38, 16, 0.16);
}

.cbt-guide-shell {
  min-height: 455px;
  justify-content: flex-start;
  gap: 14px;
}

.cbt-guide-pill {
  padding: 7px 20px;
  border-radius: 999px;
  border: 1px solid #f2b548;
  background: #fff1a5;
  color: #93551a;
  font-size: 18px;
  font-weight: 900;
}

.cbt-guide-title {
  margin: 0;
  color: #7a3f14;
  font-size: clamp(38px, 4.6vw, 58px);
  font-weight: 950;
  line-height: 1.05;
  letter-spacing: 0.04em;
}

.cbt-guide-flow {
  width: min(900px, 94%);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  margin-top: 2px;
}

.cbt-guide-card {
  min-height: 150px;
  padding: 18px 22px 22px;
  border-radius: 22px;
  background: rgba(255, 255, 250, 0.86);
  box-shadow: inset 0 0 0 1px rgba(255, 190, 73, 0.28);
}

.cbt-guide-card-title {
  margin-bottom: 12px;
  color: #7b4117;
  font-size: clamp(20px, 2vw, 26px);
  font-weight: 900;
  text-align: center;
}

.cbt-guide-items {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(12px, 2vw, 26px);
}

.cbt-guide-item {
  width: clamp(74px, 8vw, 96px);
  height: clamp(74px, 8vw, 96px);
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.78);
  border: 4px solid rgba(169, 153, 132, 0.2);
  position: relative;
}

.cbt-guide-item img {
  width: 76%;
  height: 76%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.cbt-guide-item.is-memory {
  border-color: rgba(255, 203, 71, 0.92);
  box-shadow: 0 0 0 8px rgba(255, 217, 103, 0.22), 0 0 20px rgba(255, 193, 40, 0.42);
}

.cbt-guide-item.is-pick {
  border-color: #6caf5a;
  background: #ecffe5;
  box-shadow: 0 0 0 7px rgba(110, 175, 90, 0.18);
}

.cbt-guide-fake {
  width: 64%;
  height: 64%;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #c98ef6, #7a57d7 58%, #5736af);
  box-shadow: inset 0 0 0 8px rgba(255,255,255,0.24);
}

.cbt-guide-arrow {
  color: #8b531d;
  font-size: clamp(42px, 4vw, 58px);
  font-weight: 900;
}

.cbt-guide-note {
  color: #7b4117;
  font-size: clamp(20px, 2vw, 26px);
  font-weight: 900;
  text-align: center;
  margin: 0 0 4px;
}

.cbt-forest-button {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  line-height: 0;
  cursor: pointer;
  transition: transform 0.16s ease, filter 0.16s ease, opacity 0.16s ease;
}

.cbt-forest-button img {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(74, 48, 16, 0.22));
}

.cbt-forest-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.035);
  filter: brightness(1.04);
}

.cbt-forest-button:active:not(:disabled) { transform: translateY(1px) scale(0.98); }
.cbt-forest-button:disabled { opacity: 0.46; cursor: default; filter: grayscale(0.25); }
.cbt-btn-start { width: clamp(170px, 18vw, 236px); }
.cbt-btn-skip { width: clamp(170px, 18vw, 232px); }
.cbt-btn-home, .cbt-btn-replay, .cbt-btn-detail { width: clamp(180px, 18vw, 238px); }

.cbt-guided-action {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}

.cbt-mouse-guide {
  position: absolute;
  width: clamp(48px, 5.2vw, 78px);
  height: auto;
  z-index: 30;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 8px 8px rgba(58, 38, 14, 0.24));
  animation: cbt-mouse-tap 1.15s ease-in-out infinite;
}

.cbt-mouse-on-button { right: -14px; bottom: -18px; transform-origin: 18% 18%; }
.cbt-mouse-on-guide-stone { right: -20px; bottom: -22px; transform-origin: 18% 18%; }

@keyframes cbt-mouse-tap {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.93; }
  45% { transform: translate(-10px, -9px) scale(1.08); opacity: 1; }
  62% { transform: translate(-4px, -4px) scale(0.96); opacity: 1; }
}

.cbt-result-shell {
  /* 對齊 TestPage_PM.jsx 的最終結果卡片：中型置中，不鋪滿全畫面 */
  width: min(82vw, 920px);
  min-height: 0;
  padding: clamp(34px, 4vw, 58px) clamp(30px, 5vw, 64px);
  border: 5px solid #ffb21e;
  outline: 3px solid rgba(255, 132, 38, 0.92);
  outline-offset: -12px;
  border-radius: 58px;
  background: linear-gradient(180deg, rgba(255, 252, 224, 0.97), rgba(255, 239, 166, 0.97));
  box-shadow: 0 18px 0 rgba(114, 108, 68, 0.22), 0 24px 34px rgba(60, 45, 12, 0.16);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(22px, 3vw, 34px);
  position: relative;
  overflow: visible;
  margin-top: 0;
  box-sizing: border-box;
}

/* 星星改成 PM 的大顆弧形排列 */
.cbt-cute-stars {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: clamp(22px, 2.8vw, 36px);
  height: clamp(138px, 12vw, 176px);
  margin-top: calc(clamp(96px, 9vw, 130px) * -1);
  margin-bottom: -18px;
  filter: drop-shadow(0 8px 0 rgba(63, 76, 111, 0.14));
  pointer-events: none;
}

.cbt-cute-star-shell {
  width: clamp(108px, 9.8vw, 148px);
  height: clamp(102px, 9.2vw, 140px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform-origin: 50% 80%;
}

.cbt-cute-star-shell:nth-child(1) { transform: translateY(14px) rotate(-14deg); }
.cbt-cute-star-shell:nth-child(2) { transform: translateY(-26px) scale(1.08); }
.cbt-cute-star-shell:nth-child(3) { transform: translateY(14px) rotate(14deg); }

.cbt-cute-star-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cbt-cute-star-path.is-on {
  fill: #ffd735;
  stroke: #fff9d6;
  stroke-width: 6;
  filter: drop-shadow(0 4px 0 rgba(230, 160, 0, 0.34));
}

.cbt-cute-star-path.is-off {
  fill: rgba(255, 251, 208, 0.68);
  stroke: #ffffff;
  stroke-width: 5;
}

.cbt-star-highlight { fill: rgba(255, 255, 153, 0.72); }
.cbt-star-shadow { fill: rgba(236, 155, 0, 0.52); }

.cbt-result-content {
  width: min(100%, 760px);
  display: grid;
  grid-template-columns: minmax(300px, 1fr) 172px;
  align-items: center;
  justify-content: center;
  gap: clamp(28px, 4vw, 54px);
  margin: 0;
}

.cbt-result-content .cbt-dialog-bubble {
  min-height: 132px;
  border: 4px solid #ffb545;
  outline: 3px dashed rgba(238, 178, 76, 0.38);
  outline-offset: -15px;
  border-radius: 34px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,252,238,0.96));
  color: #744018;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px 34px;
  font-size: clamp(28px, 3vw, 40px);
  line-height: 1.28;
  font-weight: 900;
  text-align: center;
  box-sizing: border-box;
  box-shadow: 0 8px 0 rgba(234, 171, 77, 0.16), inset 0 0 0 6px rgba(255, 239, 190, 0.3);
}

.cbt-result-content .cbt-dialog-bubble::after { display: none; }

.cbt-result-content .cbt-round-avatar {
  width: 172px;
  height: 172px;
  border-radius: 999px;
  background: linear-gradient(180deg, #7fdcff 0%, #43aee5 100%);
  border: 4px solid #f7d35a;
  outline: 3px dashed rgba(255,255,255,0.72);
  outline-offset: -12px;
  overflow: hidden;
  box-sizing: border-box;
  padding: 14px;
  box-shadow: 0 12px 0 rgba(50, 114, 169, 0.16), 0 16px 22px rgba(44, 83, 139, 0.18);
}

.cbt-result-content .cbt-round-avatar img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 999px;
  display: block;
  pointer-events: none;
}

.cbt-result-actions {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(14px, 2vw, 22px);
  flex-wrap: wrap;
}

.cbt-result-actions .cbt-btn-home,
.cbt-result-actions .cbt-btn-replay,
.cbt-result-actions .cbt-btn-detail {
  width: clamp(168px, 16vw, 232px);
}



/* 正式測驗卡片調淡，讓石頭更清楚。 */
.cbt-test-card {
  background: rgba(255, 253, 241, 0.68) !important;
  box-shadow: 0 14px 26px rgba(45, 33, 12, 0.12) !important;
  backdrop-filter: blur(0.6px);
}

.cbt-test-card .cbt-board {
  background: rgba(255, 253, 241, 0.10) !important;
}

.cbt-page,
.cbt-board,
.cbt-block,
.cbt-btn-home,
.cbt-btn-replay,
.cbt-btn-detail,
.cbt-btn-start,
.cbt-btn-skip {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.cbt-old-guide-card {
  width: min(92vw, 900px);
  min-height: 610px;
  padding: 30px 28px 34px;
  border-radius: 36px;
  background: rgba(255, 252, 242, 0.86);
  box-shadow: 0 14px 30px rgba(51, 39, 20, 0.14);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.cbt-old-guide-title {
  margin: 8px 0 6px;
  color: #754217;
  font-size: clamp(30px, 4vw, 42px);
  font-weight: 950;
  line-height: 1.2;
  text-align: center;
}

.cbt-old-guide-subtitle {
  margin: 0 0 12px;
  color: #754217;
  font-size: clamp(18px, 2.2vw, 22px);
  font-weight: 900;
  text-align: center;
}

.cbt-guide-board-old {
  width: min(78vw, 650px);
  height: 330px;
  position: relative;
  margin: 8px auto 10px;
}

.cbt-guide-stone-old {
  position: absolute;
  width: 112px;
  height: 112px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  transform: translate(-50%, -50%);
}

.cbt-guide-stone-old img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.cbt-guide-stone-old.is-lit img {
  filter: brightness(1.24) drop-shadow(0 0 18px rgba(255, 202, 65, 0.9)) drop-shadow(0 0 28px rgba(255, 202, 65, 0.58));
}

.cbt-guide-stone-old.is-picked img {
  filter: drop-shadow(0 0 15px rgba(105, 180, 86, 0.88));
}

.cbt-guide-stone-old:disabled {
  cursor: default;
}

.cbt-guide-person-old {
  position: absolute;
  width: 82px;
  height: 82px;
  object-fit: contain;
  transform: translate(-50%, -45%);
  filter: drop-shadow(0 8px 8px rgba(64, 44, 17, 0.22));
  pointer-events: none;
}

.cbt-guide-mouse-stone-old {
  right: -8px;
  bottom: -2px;
}

.cbt-guide-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 4px 0 16px;
}

.cbt-guide-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 203, 82, 0.36);
}

.cbt-guide-dot.is-active {
  width: 18px;
  background: #ffc64d;
}

.cbt-old-guide-action-row {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}



/* 起始與結果內部內容也對齊 PM：對話框 + 圓形角色框同尺寸 */
.cbt-start-content,
.cbt-result-content {
  width: min(100%, 760px) !important;
  display: grid;
  grid-template-columns: minmax(300px, 1fr) 172px !important;
  align-items: center;
  justify-content: center;
  gap: clamp(28px, 4vw, 54px) !important;
  margin: 0 !important;
}

.cbt-start-content .cbt-dialog-bubble,
.cbt-result-content .cbt-dialog-bubble {
  min-height: 132px;
  border: 4px solid #ffb545;
  outline: 3px dashed rgba(238, 178, 76, 0.38);
  outline-offset: -15px;
  border-radius: 34px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,252,238,0.96));
  color: #744018;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px 34px;
  font-size: clamp(28px, 3vw, 40px);
  line-height: 1.28;
  font-weight: 900;
  text-align: center;
  box-sizing: border-box;
  box-shadow: 0 8px 0 rgba(234, 171, 77, 0.16), inset 0 0 0 6px rgba(255, 239, 190, 0.3);
}

.cbt-start-content .cbt-dialog-bubble::after,
.cbt-result-content .cbt-dialog-bubble::after {
  display: none;
}

.cbt-start-content .cbt-round-avatar,
.cbt-result-content .cbt-round-avatar {
  width: 172px;
  height: 172px;
  border-radius: 999px;
  background: linear-gradient(180deg, #7fdcff 0%, #43aee5 100%);
  border: 4px solid #f7d35a;
  outline: 3px dashed rgba(255,255,255,0.72);
  outline-offset: -12px;
  overflow: hidden;
  box-sizing: border-box;
  padding: 14px;
  box-shadow: 0 12px 0 rgba(50, 114, 169, 0.16), 0 16px 22px rgba(44, 83, 139, 0.18);
}

.cbt-start-content .cbt-round-avatar img,
.cbt-result-content .cbt-round-avatar img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 999px;
  display: block;
  pointer-events: none;
}

/* 對齊 TestPage_PM.jsx：所有 CBT 卡片統一用 PM 的暖黃厚卡、橘色描邊與置中尺寸 */
.cbt-card,
.cbt-old-guide-card,
.cbt-video-only-card {
  background: linear-gradient(180deg, rgba(255, 252, 225, 0.98) 0%, rgba(255, 242, 185, 0.98) 52%, rgba(255, 229, 145, 0.98) 100%) !important;
  border: 5px solid #ffb21e !important;
  outline: 3px solid rgba(255, 132, 38, 0.86) !important;
  outline-offset: -12px !important;
  border-radius: 54px !important;
  box-shadow: 0 18px 0 rgba(194, 125, 33, 0.14), 0 22px 36px rgba(86, 61, 27, 0.18) !important;
  box-sizing: border-box;
  text-align: center;
}

.cbt-card {
  width: min(92vw, 1080px) !important;
  max-height: calc(100dvh - 26px);
  overflow: hidden;
  padding: clamp(16px, 2.1vw, 28px) clamp(18px, 2.4vw, 34px) !important;
}

.cbt-card--small {
  width: min(88vw, 760px) !important;
  max-height: calc(100dvh - 28px);
  padding: clamp(28px, 4vw, 44px) !important;
}

.cbt-card--wide {
  width: min(92vw, 1080px) !important;
}

.cbt-test-card {
  background: linear-gradient(180deg, rgba(255, 252, 225, 0.98) 0%, rgba(255, 242, 185, 0.98) 52%, rgba(255, 229, 145, 0.98) 100%) !important;
  backdrop-filter: none !important;
}

.cbt-subtitle,
.cbt-title,
.cbt-old-guide-title {
  color: #744018 !important;
  text-shadow: 0 3px 0 rgba(255,255,255,0.78);
  letter-spacing: 0.02em;
}

.cbt-subtitle {
  font-size: clamp(28px, 3.7vw, 46px) !important;
  font-weight: 900 !important;
  margin: 0 0 12px !important;
  line-height: 1.15;
}

.cbt-title {
  font-size: clamp(34px, 4.2vw, 54px) !important;
}

.cbt-text,
.cbt-old-guide-subtitle {
  color: #5d3f22 !important;
  font-weight: 800 !important;
}

.cbt-board {
  background: rgba(255,255,255,0.36) !important;
  border: 2px solid rgba(243, 181, 75, 0.32);
  border-radius: 34px;
  box-shadow: inset 0 0 0 4px rgba(255,255,255,0.16), 0 10px 20px rgba(77, 53, 30, 0.08);
}

.cbt-video-only-card {
  width: min(92vw, 1120px) !important;
  min-height: min(86vh, 790px) !important;
  padding: clamp(22px, 3vw, 34px) !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(16px, 2vw, 22px);
}

.cbt-video-only-card .cbt-video-wrapper {
  width: 100% !important;
  height: min(69vh, 635px);
  min-height: 430px;
  margin: 0;
  border-radius: 34px;
  background: linear-gradient(180deg, #36b3ff, #2f82df);
  border: 4px solid rgba(255,255,255,0.85);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  box-shadow: inset 0 0 0 4px rgba(41, 113, 206, 0.18), 0 14px 28px rgba(77, 53, 30, 0.16);
}

.cbt-video-only-card .cbt-video {
  width: 100%;
  height: 100%;
  max-height: none;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.cbt-old-guide-card {
  width: min(92vw, 900px) !important;
  min-height: 0 !important;
  max-height: calc(100dvh - 28px);
  padding: clamp(16px, 2vw, 28px) !important;
  overflow: hidden;
}

@media (max-width: 768px) {
  .cbt-start-shell, .cbt-guide-shell, .cbt-result-shell {
    width: min(92vw, 620px);
    min-height: 0;
    padding: 28px 18px;
    border-radius: 34px;
    outline-offset: -12px;
  }
  .cbt-start-title { min-width: 0; width: min(90%, 430px); padding: 12px 20px; margin-bottom: 24px; font-size: clamp(34px, 8vw, 48px); }
  .cbt-start-content, .cbt-result-content { grid-template-columns: 1fr; gap: 18px; justify-items: center; margin-bottom: 24px; }
  .cbt-dialog-bubble { font-size: clamp(24px, 6vw, 32px); padding: 18px 22px; }
  .cbt-round-avatar { width: 116px; height: 116px; }
  .cbt-guide-flow { grid-template-columns: 1fr; gap: 10px; }
  .cbt-guide-arrow { transform: rotate(90deg); }
  .cbt-video-only-card { min-height: 0; padding: 20px 14px; }
  .cbt-video-only-card .cbt-video-wrapper { width: 100% !important; min-height: 250px; height: min(54vh, 430px); }
  .cbt-btn-home, .cbt-btn-replay, .cbt-btn-detail, .cbt-btn-start, .cbt-btn-skip { width: clamp(142px, 38vw, 196px); }
  .cbt-result-shell { width: min(92vw, 620px); border-radius: 34px; padding: 44px 18px 28px; }
  .cbt-cute-stars { height: 112px; margin-top: -76px; margin-bottom: -10px; gap: 8px; }
  .cbt-cute-star-shell { width: 88px; height: 84px; }
  .cbt-result-content { width: min(100%, 500px); }
}


/* TrainingPage_CBT：使用 TestPage_CBT 美術，並讓訓練畫面更乾淨 */
.cbt-main-button,
.cbt-secondary-button {
  min-width: 170px;
  min-height: 58px;
  padding: 12px 28px 15px;
  border-radius: 999px;
  border: 4px solid #f0a22e;
  outline: 2px solid rgba(255, 245, 185, 0.92);
  outline-offset: -9px;
  background: linear-gradient(180deg, #fff2a9 0%, #ffd463 48%, #ffad34 100%);
  color: #744018;
  font-size: clamp(20px, 2.2vw, 28px);
  font-weight: 900;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: 0 8px 0 rgba(154, 89, 24, 0.2), 0 12px 20px rgba(86, 61, 27, 0.16), inset 0 3px 0 rgba(255,255,255,0.55);
  transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
}

.cbt-secondary-button {
  background: linear-gradient(180deg, #f7ffcf 0%, #dff7a8 48%, #9ed66f 100%);
  border-color: #8abf58;
  color: #42682a;
}

.cbt-main-button:hover,
.cbt-secondary-button:hover {
  transform: translateY(-2px) scale(1.02);
  filter: brightness(1.04);
}

.cbt-main-button:active,
.cbt-secondary-button:active {
  transform: translateY(4px) scale(0.98);
}

.cbt-play-card-minimal {
  padding-top: clamp(24px, 3.4vh, 42px);
}

.cbt-play-card-minimal .cbt-subtitle {
  margin-bottom: 12px;
}

.cbt-play-card-minimal .cbt-board {
  margin-top: 6px !important;
}

.cbt-quiet-prompt {
  margin: 0 0 12px;
  color: #744018;
  font-size: clamp(21px, 2vw, 28px);
  font-weight: 800;
  letter-spacing: 0.04em;
}

.cbt-feedback-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.cbt-result-stars {
  position: absolute;
  top: -56px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  pointer-events: none;
}

.cbt-result-stars span {
  color: rgba(255, 255, 255, 0.35);
  -webkit-text-stroke: 4px rgba(255, 235, 145, 0.46);
  text-shadow: 0 8px 12px rgba(115, 77, 23, 0.18);
  font-size: clamp(70px, 8vw, 108px);
  line-height: 0.8;
}

.cbt-result-stars span.is-earned {
  color: #ffd83f;
  -webkit-text-stroke: 4px rgba(255, 249, 190, 0.92);
  text-shadow: 0 8px 16px rgba(136, 88, 17, 0.26), 0 0 22px rgba(255, 214, 46, 0.42);
}

`;

export default function TrainingPage_CBT() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const trainingLevel = clampNumber(
    location.state?.trainingLevel ?? searchParams.get("level") ?? 1,
    1,
    12
  );
  const trainingStageId =
    location.state?.trainingStageId ||
    searchParams.get("stage") ||
    `${getTodayKey()}-cbt-L${trainingLevel}`;
  const todayKey = location.state?.todayKey || getTodayKey();
  const trainingOrder = Number(location.state?.trainingOrder || trainingLevel);
  const trainingTotal = Number(location.state?.trainingTotal || 12);

  const [phase, setPhase] = useState("ready");
  const [finalSummary, setFinalSummary] = useState(null);
  const [testSuggestedMicroDifficulty] = useState(() => getSuggestedMicroDifficultyFromTest());
  const testCapIndex = testSuggestedMicroDifficulty
    ? MICRO_DIFFICULTY_RANK[testSuggestedMicroDifficulty]
    : null;
  const [currentMicroDifficulty, setCurrentMicroDifficulty] = useState(() =>
    getInitialMicroDifficultyForTrainingLevel(trainingLevel)
  );
  const [roundIndex, setRoundIndex] = useState(0);

  const [sequence, setSequence] = useState([]);
  const [userInput, setUserInput] = useState([]);
  const [blocks, setBlocks] = useState(() => createRandomBlocks(5));

  const [showStep, setShowStep] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [wrongIndex, setWrongIndex] = useState(null);
  const [distractorIndices, setDistractorIndices] = useState([]);

  const [personIndex, setPersonIndex] = useState(null);
  const [isWalking, setIsWalking] = useState(false);

  const [timeLeft, setTimeLeft] = useState(12);
  const [message, setMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState("neutral");

  const [correctStreak, setCorrectStreak] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [roundReplayCount, setRoundReplayCount] = useState(0);
  const [, setTrainingHistory] = useState([]);

  const clickAudioRef = useRef(null);
  const answerStartRef = useRef(null);
  const lastClickTimeRef = useRef(null);
  const stepReactionTimesRef = useRef([]);
  const lockedRef = useRef(false);
  const walkingLockRef = useRef(false);
  const sequenceTimerRef = useRef(new Set());
  const userSequenceRef = useRef([]);
  const historyRef = useRef([]);
  const lastSequenceLastRef = useRef(null);
  const blockSetRef = useRef({ group: null, blocks: [] });
  const totalReplayCountRef = useRef(0);
  const roundReplayCountRef = useRef(0);
  const rescueUsedRef = useRef(false);
  const [roundRescueUsed, setRoundRescueUsed] = useState(false);

  const config = getConfigByMicroDifficulty(currentMicroDifficulty);
  const difficulty = getMacroDifficultyFromMicro(currentMicroDifficulty);
  const canReplayThisRound = roundReplayCount < Number(config.replayLimit || 0);
  const canUseFeedbackReplay = feedbackType === "wrong" && canReplayThisRound;
  const shouldOfferRescueRetry = feedbackType === "wrongRescue";

  const isWarmup =
    phase === "warmupShow" ||
    phase === "warmupAnswer" ||
    phase === "warmupFeedback";

  useEffect(() => {
    clickAudioRef.current = new Audio(clickSoundFile);

    return () => {
      clickAudioRef.current = null;
    };
  }, []);

  function clearSequenceTimer(timerId) {
    if (!timerId) return;
    clearTimeout(timerId);
    sequenceTimerRef.current.delete(timerId);
  }

  function clearSequenceTimers() {
    sequenceTimerRef.current.forEach((timerId) => clearTimeout(timerId));
    sequenceTimerRef.current.clear();
    walkingLockRef.current = false;
  }

  function setSequenceTimer(callback, delay) {
    const timerId = setTimeout(() => {
      sequenceTimerRef.current.delete(timerId);
      callback();
    }, delay);

    sequenceTimerRef.current.add(timerId);
    return timerId;
  }

  useEffect(() => {
    return () => {
      clearSequenceTimers();
    };
  }, []);

  function playClickSound() {
    if (!clickAudioRef.current) return;

    clickAudioRef.current.currentTime = 0;
    clickAudioRef.current.play().catch(() => {});
  }

  function resetBoardState() {
    clearSequenceTimers();
    lockedRef.current = false;
    walkingLockRef.current = false;
    userSequenceRef.current = [];
    stepReactionTimesRef.current = [];
    lastClickTimeRef.current = null;

    setUserInput([]);
    setShowStep(0);
    setActiveIndex(null);
    setSelectedIndex(null);
    setWrongIndex(null);
    setDistractorIndices([]);
    setPersonIndex(null);
    setIsWalking(false);
    setMessage("");
    setFeedbackType("neutral");
  }

  function startWarmup() {
    clearSequenceTimers();
    setCorrectStreak(0);
    setWrongStreak(0);
    setRoundReplayCount(0);
    setTrainingHistory([]);
    historyRef.current = [];
    lastSequenceLastRef.current = null;
    blockSetRef.current = { group: null, blocks: [] };
    totalReplayCountRef.current = 0;
    roundReplayCountRef.current = 0;
    rescueUsedRef.current = false;
    setRoundRescueUsed(false);

    setRoundIndex(0);
    setBlocks(createRandomBlocks(5));
    setSequence(WARMUP_SEQUENCE);
    resetBoardState();
    setPhase("warmupShow");
  }

  function startTraining() {
    clearSequenceTimers();
    setCorrectStreak(0);
    setWrongStreak(0);
    setRoundReplayCount(0);
    setTrainingHistory([]);
    historyRef.current = [];
    lastSequenceLastRef.current = null;
    blockSetRef.current = { group: null, blocks: [] };
    totalReplayCountRef.current = 0;
    roundReplayCountRef.current = 0;
    rescueUsedRef.current = false;
    setRoundRescueUsed(false);

    setRoundIndex(0);
    startRound(0, 0, 0);
  }

  function startRound(
    targetRound,
    nextCorrectStreak = correctStreak,
    nextWrongStreak = wrongStreak
  ) {
    const nextMicroDifficulty = getAdaptiveMicroDifficulty({
      trainingLevel,
      targetRound,
      testCapIndex,
      correctStreak: nextCorrectStreak,
      wrongStreak: nextWrongStreak,
      history: historyRef.current,
    });
    const roundConfig = getConfigByMicroDifficulty(nextMicroDifficulty);
    const level = getAdaptiveSequenceLength(
      targetRound,
      nextMicroDifficulty,
      nextCorrectStreak,
      nextWrongStreak
    );

    const blockGroup = `${nextMicroDifficulty}-${Math.floor(targetRound / 4)}`;
    let newBlocks = blockSetRef.current.blocks;

    if (blockSetRef.current.group !== blockGroup || newBlocks.length !== roundConfig.blockCount) {
      newBlocks = createRandomBlocks(roundConfig.blockCount);
      blockSetRef.current = { group: blockGroup, blocks: newBlocks };
    }

    const newSequence = createSequence(
      level,
      roundConfig.blockCount,
      lastSequenceLastRef.current
    );

    lastSequenceLastRef.current = newSequence[newSequence.length - 1] ?? null;

    setCurrentMicroDifficulty(nextMicroDifficulty);
    setRoundIndex(targetRound);
    setRoundReplayCount(0);
    roundReplayCountRef.current = 0;
    rescueUsedRef.current = false;
    setRoundRescueUsed(false);
    setBlocks(newBlocks);
    setSequence(newSequence);
    resetBoardState();
    setTimeLeft(roundConfig.answerTime);
    setPhase("show");
  }

  function replaySequence() {
    clearSequenceTimers();
    if (phase !== "answer" && phase !== "feedback") return;
    if (roundReplayCountRef.current >= Number(config.replayLimit || 0)) return;

    const nextReplayCount = roundReplayCountRef.current + 1;
    roundReplayCountRef.current = nextReplayCount;
    totalReplayCountRef.current += 1;
    setRoundReplayCount(nextReplayCount);

    resetBoardState();
    setTimeLeft(config.answerTime);
    setMessage("再看一次。");
    setPhase("show");
  }

  function replayCurrentRoundAfterMistake() {
    clearSequenceTimers();
    const nextReplayCount = roundReplayCountRef.current + 1;
    roundReplayCountRef.current = nextReplayCount;
    totalReplayCountRef.current += 1;
    setRoundReplayCount(nextReplayCount);

    rescueUsedRef.current = true;
    setRoundRescueUsed(true);
    resetBoardState();
    setTimeLeft(config.answerTime);
    setMessage("再看一次，等等再試一次。");
    setPhase("show");
  }

  function replayWarmup() {
    clearSequenceTimers();
    setSequence(WARMUP_SEQUENCE);
    setBlocks(createRandomBlocks(5));
    resetBoardState();
    setPhase("warmupShow");
  }

  function getReactionTimeMs() {
    const stepTotal = stepReactionTimesRef.current.reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );

    if (stepTotal > 0) return Math.round(stepTotal);
    if (!answerStartRef.current) return null;

    return Math.max(0, Date.now() - answerStartRef.current);
  }

  function recordTrainingTrial({ correct, input, errorType }) {
    const reactionTime = getReactionTimeMs();

    const trial = {
      trialIndex: roundIndex + 1,
      roundIndex: roundIndex + 1,
      mode: "training",
      taskName: "Corsi Block Tapping",
      taskCode: "CBT",
      difficulty,
      microDifficulty: currentMicroDifficulty,
      trainingLevel,
      trainingStageId,
      trainingOrder,
      trainingTotal,
      difficultyLabel: config.label,
      difficultyMacro: config.macro,

      correct,
      isCorrect: correct,

      errorType,
      timeout: errorType === "timeout",
      isTimeout: errorType === "timeout",

      level: sequence.length,
      length: sequence.length,
      sequenceLength: sequence.length,
      blockCount: config.blockCount,

      sequence,
      targetSequence: sequence,
      correctSequence: sequence,

      answer: input,
      userSequence: input,
      clickedSequence: input,
      inputLength: input.length,
      targetLength: sequence.length,
      firstErrorPosition: correct
        ? null
        : input.findIndex((value, index) => value !== sequence[index]) >= 0
          ? input.findIndex((value, index) => value !== sequence[index]) + 1
          : input.length + 1,

      reactionTime,
      answerTime: reactionTime,
      timeUsed: reactionTime,
      remainingTime: timeLeft,
      replayCount: roundReplayCountRef.current,
      usedReplay: roundReplayCountRef.current > 0,
      totalReplayCount: totalReplayCountRef.current,
      hintLevel: Number(config.hintLevel || 0),
      hintAvailable: Number(config.hintLevel || 0) > 0,
      activeReplayAllowed: Boolean(config.allowActiveReplay),
      rescueUsed: roundRescueUsed,
      isRescueAttempt: rescueUsedRef.current,

      distractorEnabled: Boolean(config.distractor?.enabled),
      distractorCount: config.distractor?.count || 0,

      createdAt: new Date().toISOString(),
    };

    const nextHistory = [...historyRef.current, trial];

    historyRef.current = nextHistory;
    setTrainingHistory(nextHistory);

    return nextHistory;
  }

  function goResultPage(finalHistory = historyRef.current, showDetail = false) {
    const correctCount = finalHistory.filter(
      (item) => item.correct || item.isCorrect
    ).length;

    const bestSpan = finalHistory.reduce((max, item) => {
      if (!item.correct && !item.isCorrect) return max;
      return Math.max(max, item.length || item.sequenceLength || 0);
    }, 0);

    const scoreSummary = getTrainingScoreSummary(finalHistory);
    const stars = scoreSummary.stars;
    const totalQuestions = finalHistory.length || TOTAL_TRAINING_ROUNDS;
    const summary = {
      source: "training",
      mode: "training",
      taskCode: "CBT",
      trainingStageId,
      trainingLevel,
      trainingOrder,
      trainingTotal,
      difficulty,
      microDifficulty: currentMicroDifficulty,
      difficultyLabel: config.label,
      difficultyMacro: config.macro,
      testSuggestedMicroDifficulty,
      stars,
      score: scoreSummary.score,
      scoreSummary,
      correctCount,
      bestSpan,
      totalQuestions,
      accuracy: totalQuestions > 0 ? correctCount / totalQuestions : 0,
      totalReplayCount: finalHistory.reduce((sum, item) => sum + Number(item.replayCount || 0), 0),
      history: finalHistory,
      updatedAt: new Date().toISOString(),
    };

    saveTrainingStageResult({
      stageId: trainingStageId,
      gameId: "cbt",
      level: trainingLevel,
      todayKey,
      stars,
      history: finalHistory,
      summary,
    });

    if (!showDetail) {
      setFinalSummary(summary);
      setPhase("result");
      return;
    }

    navigate("/result-cbt", {
      state: {
        ...summary,
        resultType: "training",

        cbtHistory: finalHistory,
        trials: finalHistory,

        fromPath: "/training-cbt",
        returnPath: "/game-menu",
        visibleResultRoles: ["child", "parent"],
        hideMedicalResult: true,
      },
    });
  }

  function restartTraining() {
    clearSequenceTimers();
    historyRef.current = [];
    userSequenceRef.current = [];
    stepReactionTimesRef.current = [];
    rescueUsedRef.current = false;
    lockedRef.current = false;
    walkingLockRef.current = false;
    totalReplayCountRef.current = 0;
    setFinalSummary(null);
    setTrainingHistory([]);
    setRoundIndex(0);
    setCorrectStreak(0);
    setWrongStreak(0);
    setRoundReplayCount(0);
    setFeedbackType(null);
    setMessage("");
    setUserInput([]);
    setSelectedIndex(null);
    setWrongIndex(null);
    setPersonIndex(null);
    setIsWalking(false);
    setDistractorIndices([]);
    setBlocks(createRandomBlocks(5));
    setPhase("ready");
  }

  function handleCorrectRound(nextInput) {
    lockedRef.current = true;

    const finalHistory = recordTrainingTrial({
      correct: true,
      input: nextInput,
      errorType: null,
    });

    const nextCorrectStreak = correctStreak + 1;

    setCorrectStreak(nextCorrectStreak);
    setWrongStreak(0);
    setFeedbackType("correct");
    setMessage(getCorrectMessage(nextCorrectStreak));
    setPhase("feedback");

    return finalHistory;
  }

  function handleWrongRound(nextInput, errorType = "sequence_error") {
    lockedRef.current = true;

    const finalHistory = recordTrainingTrial({
      correct: false,
      input: nextInput,
      errorType,
    });

    const nextWrongStreak = wrongStreak + 1;
    const canRescueThisRound = !rescueUsedRef.current;

    setCorrectStreak(0);
    setWrongStreak(nextWrongStreak);
    setFeedbackType(canRescueThisRound ? "wrongRescue" : "wrong");

    if (canRescueThisRound) {
      setMessage(errorType === "timeout" ? "沒關係，再看一次。" : "差一點，再看一次。");
    } else {
      setMessage(errorType === "timeout" ? "下一題再試試。" : "下一題再加油。");
    }

    setPhase("feedback");

    return finalHistory;
  }

  function goNextRound() {
    clearSequenceTimers();
    const nextRoundIndex = roundIndex + 1;

    if (nextRoundIndex >= TOTAL_TRAINING_ROUNDS) {
      setPhase("finish");

      setSequenceTimer(() => {
        setPhase("endingVideo");
      }, 550);

      return;
    }

    startRound(nextRoundIndex);
  }


  function finishPersonWalk({ onComplete } = {}) {
    setSequenceTimer(() => {
      setIsWalking(false);
      walkingLockRef.current = false;

      if (typeof onComplete === "function") {
        onComplete();
      }
    }, PERSON_WALK_MS);
  }

  function handleWarmupClick(index) {
    if (phase !== "warmupAnswer") return;
    if (walkingLockRef.current) return;

    playClickSound();

    const currentUserSeq = userSequenceRef.current;
    const nextUserSeq = [...currentUserSeq, index];
    const correctIndex = sequence[nextUserSeq.length - 1];

    setSelectedIndex(index);
    setPersonIndex(index);
    setIsWalking(true);
    walkingLockRef.current = true;

    if (index !== correctIndex) {
      setWrongIndex(index);
      setMessage("再看一次。");

      finishPersonWalk({
        onComplete: () => {
          setSequenceTimer(() => {
            replayWarmup();
          }, 590);
        },
      });

      return;
    }

    finishPersonWalk({
      onComplete: () => {
        userSequenceRef.current = nextUserSeq;
        setUserInput(nextUserSeq);

        if (nextUserSeq.length === sequence.length) {
          setMessage("做得好！");
          setPhase("warmupFeedback");
        }
      },
    });
  }

  function handleBlockClick(index) {
    if (phase !== "answer") return;
    if (lockedRef.current || walkingLockRef.current) return;

    playClickSound();

    const currentUserSeq = userSequenceRef.current;
    const nextUserSeq = [...currentUserSeq, index];
    const nextUserSeqLength = nextUserSeq.length;
    const correctIndex = sequence[nextUserSeqLength - 1];

    if (lastClickTimeRef.current) {
      stepReactionTimesRef.current = [
        ...stepReactionTimesRef.current,
        Math.max(0, Date.now() - lastClickTimeRef.current),
      ];
    }

    setSelectedIndex(index);
    setPersonIndex(index);
    setIsWalking(true);
    walkingLockRef.current = true;

    if (index !== correctIndex) {
      setWrongIndex(index);

      finishPersonWalk({
        onComplete: () => {
          userSequenceRef.current = nextUserSeq;
          setUserInput(nextUserSeq);

          handleWrongRound(nextUserSeq, "sequence_error");
        },
      });

      return;
    }

    finishPersonWalk({
      onComplete: () => {
        userSequenceRef.current = nextUserSeq;
        setUserInput(nextUserSeq);

        if (nextUserSeqLength === sequence.length) {
          handleCorrectRound(nextUserSeq);
          return;
        }

        // 下一步的計時起點放在小人走路動畫完全結束後，
        // 避免動畫時間被算進下一次反應時間。
        lastClickTimeRef.current = Date.now();
      },
    });
  }

  useEffect(() => {
    if (phase !== "show" && phase !== "warmupShow") return;
    if (sequence.length === 0) return;

    if (showStep >= sequence.length) {
      setActiveIndex(null);
      setSelectedIndex(null);
      setWrongIndex(null);
      setDistractorIndices([]);
      setPersonIndex(null);
      userSequenceRef.current = [];
      setUserInput([]);

      if (phase === "warmupShow") {
        setPhase("warmupAnswer");
      } else {
        setTimeLeft(config.answerTime);
        userSequenceRef.current = [];
        stepReactionTimesRef.current = [];
        answerStartRef.current = Date.now();
        lastClickTimeRef.current = Date.now();
        setPhase("answer");
      }

      return;
    }

    const currentBlock = sequence[showStep];

    setActiveIndex(currentBlock);

    let gapTimer = null;
    const showTimer = setSequenceTimer(() => {
      setActiveIndex(null);

      gapTimer = setSequenceTimer(() => {
        setShowStep((prev) => prev + 1);
      }, GAP_SPEED);
    }, isWarmup ? SHOW_SPEED : config.showSpeed);

    return () => {
      clearSequenceTimer(showTimer);
      clearSequenceTimer(gapTimer);
    };
  }, [phase, showStep, sequence, config.answerTime, config.showSpeed, isWarmup]);

  useEffect(() => {
    if (phase !== "answer") {
      setDistractorIndices([]);
      return;
    }

    if (!config.distractor?.enabled) return;
    if (roundIndex < Number(config.distractor.startRound || 0)) return;

    const flash = () => {
      const nextTarget = sequence[userSequenceRef.current.length];
      const avoid = config.distractor.avoidNextTarget ? [nextTarget] : [];

      const nextDistractors = createDistractorIndices({
        blockCount: config.blockCount,
        count: config.distractor.count,
        avoid,
      });

      setDistractorIndices(nextDistractors);

      setSequenceTimer(() => {
        setDistractorIndices([]);
      }, config.distractor.duration);
    };

    const firstDelay = setSequenceTimer(flash, 520);
    const interval = setInterval(flash, config.distractor.interval);

    return () => {
      clearSequenceTimer(firstDelay);
      clearInterval(interval);
      setDistractorIndices([]);
    };
  }, [phase, currentMicroDifficulty, sequence, userInput.length, config]);

  useEffect(() => {
    if (phase !== "answer") return;
    if (lockedRef.current || walkingLockRef.current) return;

    if (timeLeft <= 0) {
      handleWrongRound(userSequenceRef.current, "timeout");
      return;
    }

    const timer = setSequenceTimer(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearSequenceTimer(timer);
  }, [phase, timeLeft]);

  return (
    <div
      className="cbt-page"
      style={{
        "--cbt-bg": `url(${bgImg})`,
      }}
    >
      <style>{cbtTrainingTouchCss}</style>

      {phase === "ready" && (
        <main className="cbt-start-shell" aria-label="石頭練習開始畫面">
          <h1 className="cbt-start-title">石頭練習</h1>

          <div className="cbt-start-content">
            <div className="cbt-dialog-bubble">
              看亮燈，照順序點。
            </div>
            <div className="cbt-round-avatar">
              <img src={startAvatar} alt="小鹿頭像" draggable="false" />
            </div>
          </div>

          <GuidedImageButton
            imgSrc={homeStartBtn}
            imgAlt="開始練習"
            ariaLabel="開始練習"
            onClick={() => setPhase("intro")}
            showMouse
            variant="start"
          />
        </main>
      )}

      {phase === "intro" && (
        <VideoOnlyPage
          videoSrc={introVideo}
          onDone={startWarmup}
        />
      )}

      {(phase === "warmupShow" || phase === "warmupAnswer") && (
        <div className="cbt-card cbt-card--wide cbt-play-card-minimal">
          <h2 className="cbt-subtitle">
            {phase === "warmupShow" ? "看亮燈" : "換你點"}
          </h2>

          <p className="cbt-quiet-prompt">
            {phase === "warmupShow" ? "先看。" : "照順序點。"}
          </p>

          <CBTBoard
            blocks={blocks}
            phase={phase}
            activeIndex={activeIndex}
            selectedIndex={selectedIndex}
            wrongIndex={wrongIndex}
            distractorIndices={[]}
            personIndex={personIndex}
            isWalking={isWalking}
            disabled={phase !== "warmupAnswer"}
            onBlockClick={handleWarmupClick}
            stoneSize={WARMUP_STONE_SIZE}
          />
        </div>
      )}

      {phase === "warmupFeedback" && (
        <div className="cbt-card cbt-card--small">
          <h1 className="cbt-title">做得好！</h1>

          <div className="cbt-result-message">{message}</div>

          <GuidedImageButton
            imgSrc={homeStartBtn}
            imgAlt="開始練習"
            ariaLabel="開始練習"
            onClick={startTraining}
            showMouse
            variant="start"
          />
        </div>
      )}

      {(phase === "show" || phase === "answer") && (
        <div className="cbt-card cbt-card--wide cbt-play-card-minimal">
          <h2 className="cbt-subtitle">
            {phase === "show" ? "看亮燈" : "換你點"}
          </h2>

          <p className="cbt-quiet-prompt">
            {phase === "show" ? "先看，不用點。" : "照順序點。"}
          </p>

          <CBTBoard
            blocks={blocks}
            phase={phase}
            activeIndex={activeIndex}
            selectedIndex={selectedIndex}
            wrongIndex={wrongIndex}
            distractorIndices={distractorIndices}
            personIndex={personIndex}
            isWalking={isWalking}
            disabled={phase !== "answer" || lockedRef.current}
            onBlockClick={handleBlockClick}
            stoneSize={STONE_SIZE}
          />
        </div>
      )}

      {phase === "feedback" && (
        <div className="cbt-card cbt-card--small">
          <h1 className="cbt-title">
            {feedbackType === "correct" ? "答對了" : "再試一次"}
          </h1>

          <div className="cbt-result-message">{message}</div>

          <div className="cbt-feedback-actions">
            {shouldOfferRescueRetry && (
              <button
                type="button"
                className="cbt-main-button"
                onClick={replayCurrentRoundAfterMistake}
              >
                再看一次
              </button>
            )}

            {!shouldOfferRescueRetry && canUseFeedbackReplay && (
              <button
                type="button"
                className="cbt-secondary-button"
                onClick={replaySequence}
              >
                重看（{Number(config.replayLimit || 0) - roundReplayCount}）
              </button>
            )}

            {!shouldOfferRescueRetry && (
              <button
                type="button"
                className="cbt-main-button"
                onClick={goNextRound}
              >
                下一題
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "finish" && (
        <div className="cbt-card cbt-card--small">
          <h1 className="cbt-title">完成了！</h1>

          <div className="cbt-result-message" style={{ marginTop: 12 }}>
            準備看結果。
          </div>
        </div>
      )}

      {phase === "endingVideo" && (
        <VideoOnlyPage
          videoSrc={introVideo}
          onDone={() => goResultPage(historyRef.current, false)}
        />
      )}

      {phase === "result" && (
        <main className="cbt-result-shell" aria-label="訓練結果">
          <div className="cbt-result-stars" aria-label={`${finalSummary?.stars || 1} 顆星`}>
            {[1, 2, 3].map((star) => (
              <span
                key={star}
                className={star <= Number(finalSummary?.stars || 1) ? "is-earned" : ""}
              >
                ★
              </span>
            ))}
          </div>

          <div className="cbt-result-content">
            <div className="cbt-dialog-bubble">
              關卡完成！你很認真記住圖片喔。
            </div>
            <div className="cbt-round-avatar">
              <img src={startAvatar} alt="小鹿頭像" draggable="false" />
            </div>
          </div>

          <div className="cbt-result-actions">
            <GuidedImageButton
              imgSrc={homeBackBtn}
              imgAlt="回到森林"
              ariaLabel="回到森林"
              onClick={() => navigate("/game-menu")}
              showMouse
              variant="home"
            />
            <GuidedImageButton
              imgSrc={homeAgainBtn}
              imgAlt="再玩一次"
              ariaLabel="再玩一次"
              onClick={restartTraining}
              variant="replay"
            />
            <GuidedImageButton
              imgSrc={homeResultBtn}
              imgAlt="詳細結果"
              ariaLabel="詳細結果"
              onClick={() => goResultPage(historyRef.current, true)}
              variant="detail"
            />
          </div>
        </main>
      )}
    </div>
  );
}

function VideoOnlyPage({ videoSrc, onDone }) {
  return (
    <main className="cbt-video-only-card" aria-label="影片">
      <div className="cbt-video-wrapper">
        <video
          src={videoSrc}
          autoPlay
          playsInline
          controls={false}
          className="cbt-video"
          onEnded={onDone}
        />
      </div>

      <GuidedImageButton
        imgSrc={homeSkipBtn}
        imgAlt="跳過動畫"
        ariaLabel="跳過動畫"
        onClick={onDone}
        showMouse
        variant="skip"
      />
    </main>
  );
}

function GuidedImageButton({
  imgSrc,
  imgAlt,
  ariaLabel,
  onClick,
  disabled = false,
  showMouse = false,
  variant = "start",
}) {
  return (
    <div className={`cbt-guided-action cbt-guided-action--${variant}`}>
      <button
        type="button"
        className={`cbt-forest-button cbt-btn-${variant}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel || imgAlt}
      >
        <img src={imgSrc} alt={imgAlt} draggable="false" />
      </button>
      {showMouse && !disabled && (
        <img
          className="cbt-mouse-guide cbt-mouse-on-button"
          src={mouseGuideImg}
          alt="提示點擊"
          aria-hidden="true"
          draggable="false"
        />
      )}
    </div>
  );
}

function CBTBoard({
  blocks,
  phase,
  activeIndex,
  selectedIndex,
  wrongIndex,
  distractorIndices,
  personIndex,
  isWalking,
  disabled,
  onBlockClick,
  stoneSize,
}) {
  return (
    <div
      className="cbt-board"
      style={{
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        marginTop: 4,
        position: "relative",
      }}
    >
      {blocks.map((block, index) => {
        const isGlowing = activeIndex === index;
        const isSelected = selectedIndex === index;
        const isWrong = wrongIndex === index;
        const isDistractor = distractorIndices.includes(index);

        return (
          <button
            key={index}
            type="button"
            className="cbt-block"
            style={{
              top: block.top,
              left: block.left,
              width: stoneSize,
              height: stoneSize,
              transform: "translate(-50%, -50%)",
            }}
            disabled={disabled}
            onClick={() => onBlockClick(index)}
          >
            <img
              src={stoneImg}
              alt={`stone-${index + 1}`}
              className={[
                "cbt-stone",
                isGlowing ? "is-glowing" : "",
                isSelected ? "is-selected" : "",
                isWrong ? "is-wrong" : "",
                isDistractor ? "is-distractor" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={getStoneStyle({
                stoneSize,
                isGlowing,
                isSelected,
                isWrong,
                isDistractor,
              })}
              draggable="false"
            />
          </button>
        );
      })}

      {(phase === "answer" || phase === "warmupAnswer") &&
        personIndex !== null && (
          <img
            src={personImg}
            alt="person"
            className={["cbt-person", isWalking ? "is-walking" : ""]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: blocks[personIndex]?.left ?? "50%",
              top: (blocks[personIndex]?.top ?? 0) - 74,
              transform: "translate(-50%, -50%)",
            }}
            draggable="false"
          />
        )}
    </div>
  );
}

function getStoneStyle({
  stoneSize,
  isGlowing,
  isSelected,
  isWrong,
  isDistractor,
}) {
  let filter = "drop-shadow(0 10px 18px rgba(70, 45, 25, 0.18))";
  let transform = "scale(1)";
  let opacity = 1;

  if (isDistractor) {
    filter = "drop-shadow(0 0 14px rgba(90, 165, 255, 0.58)) brightness(1.08)";
    transform = "scale(1.04)";
    opacity = 0.92;
  }

  if (isGlowing) {
    filter = "drop-shadow(0 0 26px rgba(255, 210, 65, 0.96)) brightness(1.23)";
    transform = "scale(1.12)";
    opacity = 1;
  }

  if (isSelected) {
    filter = "drop-shadow(0 0 22px rgba(76, 175, 80, 0.78)) brightness(1.12)";
    transform = "scale(1.08)";
  }

  if (isWrong) {
    filter = "drop-shadow(0 0 22px rgba(255, 80, 80, 0.85)) brightness(1.06)";
    transform = "scale(1.08)";
  }

  return {
    width: stoneSize,
    height: "auto",
    opacity,
    filter,
    transform,
    transition: "transform 180ms ease, filter 180ms ease, opacity 180ms ease",
  };
}

function getCorrectMessage(correctStreak) {
  if (correctStreak >= 3) {
    return "很棒！";
  }

  if (correctStreak >= 2) {
    return "越來越會了！";
  }

  return "做得好！";
}
