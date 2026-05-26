import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import gameMapBackground from "../asset/GameMap.png";
import srtIcon from "../asset/SRT_icon.png";
import pmIcon from "../asset/PM_icon.png";
import cbtIcon from "../asset/CBT_icon.png";
import dptIcon from "../asset/DPT_icon.png";
import dccsIcon from "../asset/DCCS_icon.png";
import lbIcon from "../asset/LB_icon.png";
import "../styles/TestMapPage.css";

/**
 * TestMapPage.jsx
 *
 * 幼兒版森林測驗地圖：
 * - 全螢幕 GameMap.png 背景
 * - 測驗固定順序，避免孩子亂跳未解鎖關卡
 * - 關卡使用 asset 裡的圖片 icon + 簡短文字，不顯示大量測驗說明
 * - hover / focus 只讓關卡圓圈微微發光，不做大位移
 * - 移除「出發第 1 關 / 開始第一關」大型按鈕，讓孩子直接點目前發光關卡
 */

const TEST_GAMES = [
  {
    gameId: "SRT",
    level: 1,
    name: "橡實反應任務",
    childText: "找橡實",
    route: "/test-srt",
    icon: srtIcon,
    x: 9,
    y: 56,
  },
  {
    gameId: "PM",
    level: 2,
    name: "湖邊圖片記憶",
    childText: "記圖片",
    route: "/test-picture-memory",
    icon: pmIcon,
    x: 25,
    y: 61,
  },
  {
    gameId: "CBT",
    level: 3,
    name: "石頭小橋記憶",
    childText: "走石橋",
    route: "/test-cbt",
    icon: cbtIcon,
    x: 43,
    y: 54,
  },
  {
    gameId: "DPT",
    level: 4,
    name: "蒼蠅注意任務",
    childText: "找小蟲",
    route: "/test-dot-probe",
    icon: dptIcon,
    x: 56,
    y: 48,
  },
  {
    gameId: "DCCS",
    level: 5,
    name: "孔雀服飾分類",
    childText: "換規則",
    route: "/test-dccs",
    icon: dccsIcon,
    x: 73,
    y: 45,
  },
  {
    gameId: "LB",
    level: 6,
    name: "綿羊奶奶回家路",
    childText: "排路標",
    route: "/test-linking-balloons",
    icon: lbIcon,
    x: 89,
    y: 39,
  },
];

const PASSING_STARS = 1;

const STORAGE_KEYS = {
  latestResults: "ef_latest_results",
  aiRecommendation: "ef_ai_recommendation",
  testFlow: "ef_current_test_flow",
  result: (gameId) => `ef_${gameId.toLowerCase()}_test_result`,
  trainingSummary: (gameId) => `ef_${gameId.toLowerCase()}_training_summary`,
  stars: (gameId) => `ef_${gameId.toLowerCase()}_stars`,
};

const LEGACY_RESULT_KEYS = {
  SRT: ["srtTestResult", "SRT_RESULT", "srtResult", "testResult_SRT", "SRT_testResult"],
  PM: ["pmTestResult", "PM_RESULT", "pmResult", "pictureMemoryTestResult", "testResult_PM", "PM_testResult"],
  CBT: ["cbtTestResult", "CBT_RESULT", "cbtResult", "testResult_CBT", "CBT_testResult"],
  DPT: ["dptTestResult", "DPT_RESULT", "dotProbeTestResult", "testResult_DPT", "DPT_testResult"],
  DCCS: ["dccsTestResult", "DCCS_RESULT", "dccsResult", "testResult_DCCS", "DCCS_testResult"],
  LB: ["lbTestResult", "LB_RESULT", "linkingBalloonsTestResult", "testResult_LB", "LB_testResult"],
};

const LEGACY_STAR_KEYS = {
  SRT: ["srtStars", "srt_stars", "SRT_stars", "trainingSrtStars", "srtTrainingStars", "srtTrainingResult"],
  PM: ["pmStars", "pm_stars", "PM_stars", "trainingPmStars", "pmTrainingStars", "pmTrainingResult"],
  CBT: ["cbtStars", "cbt_stars", "CBT_stars", "trainingCbtStars", "cbtTrainingStars", "cbtTrainingResult"],
  DPT: ["dptStars", "dpt_stars", "DPT_stars", "trainingDptStars", "dptTrainingStars", "dptTrainingResult"],
  DCCS: ["dccsStars", "dccs_stars", "DCCS_stars", "trainingDccsStars", "dccsTrainingStars", "dccsTrainingResult"],
  LB: ["lbStars", "lb_stars", "LB_stars", "trainingLbStars", "lbTrainingStars", "lbTrainingResult"],
};

const safeParse = (value) => {
  if (value === null || value === undefined || value === "") return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const readStorage = (key) => {
  if (!key) return null;

  const localValue = safeParse(localStorage.getItem(key));
  if (localValue !== null && localValue !== undefined) return localValue;

  const sessionValue = safeParse(sessionStorage.getItem(key));
  if (sessionValue !== null && sessionValue !== undefined) return sessionValue;

  return null;
};

const writeCanonicalStorage = (key, value) => {
  if (!key || value === null || value === undefined) return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage 可能在隱私模式或容量不足時失敗；不影響頁面繼續運作。
  }
};

const normalizeStars = (value) => {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((max, item) => Math.max(max, normalizeStars(item)), 0);
  }

  if (typeof value === "object") {
    const candidates = [
      value.stars,
      value.star,
      value.starCount,
      value.rating,
      value.bestStars,
      value.trainingStars,
      value.testStars,
      value?.summary?.stars,
      value?.result?.stars,
    ];

    return candidates.reduce((max, item) => Math.max(max, normalizeStars(item)), 0);
  }

  return 0;
};

const getCurrentChild = () => {
  return readStorage("currentChild") || readStorage("selectedChild");
};

const getStoredResult = (gameId) => {
  const canonicalKey = STORAGE_KEYS.result(gameId);
  const keys = [canonicalKey, ...(LEGACY_RESULT_KEYS[gameId] || [])];

  for (const key of keys) {
    const result = readStorage(key);
    if (result && typeof result === "object") {
      if (key !== canonicalKey) writeCanonicalStorage(canonicalKey, result);
      return result;
    }
  }

  return null;
};

const getStoredStars = (gameId, result) => {
  const canonicalKey = STORAGE_KEYS.stars(gameId);
  const canonicalSummaryKey = STORAGE_KEYS.trainingSummary(gameId);
  const keys = [
    canonicalKey,
    canonicalSummaryKey,
    ...(LEGACY_STAR_KEYS[gameId] || []),
    ...(LEGACY_RESULT_KEYS[gameId] || []),
  ];

  let bestStars = normalizeStars(result);

  for (const key of keys) {
    const storedValue = readStorage(key);
    const stars = normalizeStars(storedValue);
    if (stars > bestStars) bestStars = stars;

    if (stars > 0 && key !== canonicalKey) {
      writeCanonicalStorage(canonicalKey, stars);
      if (storedValue && typeof storedValue === "object") {
        writeCanonicalStorage(canonicalSummaryKey, {
          ...storedValue,
          gameId,
          stars,
          migratedFrom: key,
          migratedAt: new Date().toISOString(),
        });
      }
    }
  }

  return Math.min(3, Math.max(0, bestStars));
};

const isObjectWithData = (value) => {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
};

const getLatestResults = () => {
  const candidates = [
    readStorage(STORAGE_KEYS.latestResults),
    readStorage("latestResults"),
    readStorage("latestTestResults"),
    readStorage("parentLatestResults"),
  ];

  const latest = candidates.find(isObjectWithData) || null;
  if (latest) writeCanonicalStorage(STORAGE_KEYS.latestResults, latest);

  return latest;
};

const normalizeRecommendedIds = (value) => {
  if (!value) return [];

  if (typeof value === "string") return [value.toUpperCase()];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeRecommendedIds(item))
      .filter(Boolean);
  }

  if (typeof value === "object") {
    const candidates = [
      value.gameId,
      value.game,
      value.targetGame,
      value.recommendedGame,
      value.nextGame,
      value.currentGame,
      value.module,
      value.task,
      value?.recommendation?.gameId,
      value?.recommendation?.targetGame,
      value?.currentRecommendation?.gameId,
      value?.difficultyRecommendation?.gameId,
      value?.aiRecommendation?.gameId,
      value?.aiRecommendation?.targetGame,
    ];

    const nestedLists = [
      value.recommendedGames,
      value.recommendations,
      value.unlockedGames,
      value.challengeGames,
      value.targets,
    ];

    return [
      ...candidates.flatMap((item) => normalizeRecommendedIds(item)),
      ...nestedLists.flatMap((item) => normalizeRecommendedIds(item)),
    ].filter(Boolean);
  }

  return [];
};

const getAiRecommendedGameIds = () => {
  const candidates = [
    readStorage(STORAGE_KEYS.aiRecommendation),
    readStorage("aiRecommendation"),
    readStorage("aiDifficultyRecommendation"),
    readStorage("recommendedDifficulty"),
    readStorage("trainingRecommendation"),
    readStorage("currentAIRecommendation"),
    readStorage("latestRecommendation"),
  ];

  const ids = [...new Set(candidates.flatMap((item) => normalizeRecommendedIds(item)))];
  return ids.filter((id) => TEST_GAMES.some((game) => game.gameId === id));
};

const createTestFlow = ({ child, startIndex = 0, mode = "full" }) => {
  return {
    flowId: `test_flow_${Date.now()}`,
    childId: child?.childId || child?.id || null,
    childName: child?.name || child?.nickname || "",
    mode,
    currentIndex: startIndex,
    games: TEST_GAMES.map((game) => ({
      gameId: game.gameId,
      route: game.route,
      name: game.name,
    })),
    startedAt: new Date().toISOString(),
  };
};

const ForestLeaf = ({ x, y, rotate = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <ellipse cx="0" cy="0" rx="1.1" ry="0.5" fill="rgba(89, 152, 68, 0.72)" />
    <path
      d="M -0.62 0 C -0.2 -0.16, 0.25 -0.13, 0.68 0"
      stroke="rgba(255,255,255,0.42)"
      strokeWidth="0.12"
      fill="none"
    />
  </g>
);

const TestMapPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const child = location.state?.child || getCurrentChild();
  const [resultModal, setResultModal] = useState(null);

  const gamesWithStatus = useMemo(() => {
    const aiRecommendedIds = getAiRecommendedGameIds();
    const games = TEST_GAMES.map((game) => {
      const result = getStoredResult(game.gameId);
      const stars = getStoredStars(game.gameId, result);

      return {
        ...game,
        result,
        stars,
        isPassedByStars: stars >= PASSING_STARS,
        isAiRecommended: aiRecommendedIds.includes(game.gameId),
      };
    });

    const firstIncompleteIndex = games.findIndex((game) => !game.result && !game.isPassedByStars);
    const activeIndex = firstIncompleteIndex === -1 ? games.length - 1 : firstIncompleteIndex;

    return games.map((game, index) => {
      const previousGame = games[index - 1];
      const isCompleted = Boolean(game.result) || game.isPassedByStars;
      const isSequentiallyAvailable = index <= activeIndex;
      const isUnlockedByPreviousStars = index === 0 || Boolean(previousGame?.isPassedByStars || previousGame?.result);
      const isUnlocked = isCompleted || isSequentiallyAvailable || isUnlockedByPreviousStars || game.isAiRecommended;
      const isActive = !isCompleted && isUnlocked;
      const isLocked = !isUnlocked;
      const status = isCompleted ? "completed" : game.isAiRecommended ? "recommended" : isActive ? "active" : "locked";

      return {
        ...game,
        fullIndex: index,
        status,
        isCompleted,
        isActive,
        isLocked,
        unlockReason: game.isAiRecommended
          ? "AI 建議挑戰"
          : game.isPassedByStars
            ? "星等通過"
            : isSequentiallyAvailable
              ? "目前關卡"
              : isUnlockedByPreviousStars
                ? "前一關已通過"
                : "尚未解鎖",
      };
    });
  }, []);

  const completedCount = gamesWithStatus.filter((game) => game.isCompleted).length;

  const startTest = (game, mode = "single") => {
    if (!game || game.isLocked) return;

    const testFlow = createTestFlow({
      child,
      startIndex: game.fullIndex,
      mode,
    });

    sessionStorage.setItem(STORAGE_KEYS.testFlow, JSON.stringify(testFlow));
    sessionStorage.setItem("currentTestFlow", JSON.stringify(testFlow));

    navigate(game.route, {
      state: {
        child,
        gameId: game.gameId,
        testFlow,
        isFullTest: mode === "full",
        replayPath: game.route,
        difficultyPath: game.route,
        forestPath: "/test-map",
        unlockReason: game.unlockReason,
        isAiRecommended: game.isAiRecommended,
      },
    });
  };

  const closeResultModal = () => setResultModal(null);

  const openParentResult = () => {
    const latestResults = getLatestResults();
    const hasAnyGameResult = gamesWithStatus.some((game) => game.result || game.stars > 0);

    if (!isObjectWithData(latestResults) && !hasAnyGameResult) {
      setResultModal({
        title: "還沒有可以看的結果",
        message: "先完成至少一個森林任務後，大人就可以看到孩子的星等與表現摘要。",
      });
      return;
    }

    navigate("/result-pa", {
      state: {
        fromTestMap: true,
        child,
        latestResults: latestResults || gamesWithStatus.filter((game) => game.result || game.stars > 0),
      },
    });
  };

  return (
    <main className="test-map-page preschool-test-map-page">
      <style>{`
        html,
        body,
        #root {
          width: 100%;
          min-height: 100%;
          margin: 0;
        }

        .preschool-test-map-page {
          position: relative;
          width: 100vw;
          height: 100vh;
          min-height: 100vh;
          overflow: hidden;
          font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
          color: #3f2d1c;
          background: #86d6f5;
        }

        .kid-map-stage {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background-image: var(--game-map-bg);
          background-size: cover;
          background-position: center center;
          background-repeat: no-repeat;
          isolation: isolate;
        }

        .kid-map-stage::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(circle at 24% 17%, rgba(255, 255, 255, 0.18), transparent 28%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(34, 81, 31, 0.1));
          pointer-events: none;
        }

        .kid-map-topbar {
          position: absolute;
          top: max(10px, env(safe-area-inset-top));
          left: max(12px, env(safe-area-inset-left));
          right: max(12px, env(safe-area-inset-right));
          z-index: 8;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: start;
          gap: 10px;
          pointer-events: none;
        }

        .kid-map-left-tools {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          pointer-events: auto;
        }

        .kid-map-back,
        .kid-map-title-pill,
        .kid-map-right-tools,
        .kid-map-progress,
        .kid-map-parent {
          pointer-events: auto;
        }

        .kid-map-right-tools {
          justify-self: end;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }

        .kid-map-back,
        .kid-map-parent {
          border: 0;
          cursor: pointer;
          font-weight: 950;
          transition: filter 0.16s ease, box-shadow 0.16s ease;
        }

        .kid-map-back {
          min-height: 46px;
          padding: 0 18px;
          border-radius: 999px;
          color: #5e4027;
          background: linear-gradient(180deg, #fff7cd, #f2cd74);
          box-shadow: inset 0 -5px 0 rgba(147, 93, 33, 0.22), 0 9px 16px rgba(58, 91, 48, 0.18);
          white-space: nowrap;
        }

        .kid-map-title-pill {
          justify-self: center;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: min(470px, 46vw);
          padding: 10px 18px;
          border: 3px solid rgba(255, 255, 255, 0.86);
          border-radius: 999px;
          background: rgba(255, 250, 223, 0.85);
          box-shadow: 0 12px 24px rgba(60, 87, 42, 0.18), inset 0 -4px 0 rgba(183, 139, 63, 0.12);
          backdrop-filter: blur(8px);
        }

        .kid-map-title-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #fff4a8;
          box-shadow: inset 0 -4px 0 rgba(174, 119, 39, 0.14);
          font-size: 1.35rem;
        }

        .kid-map-title-text {
          min-width: 0;
        }

        .kid-map-title-text p {
          margin: 0;
          color: #4d9c49;
          font-size: 0.76rem;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .kid-map-title-text h1 {
          margin: 2px 0 0;
          color: #4a331f;
          font-size: clamp(1rem, 1.8vw, 1.48rem);
          line-height: 1.12;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kid-map-progress {
          min-height: 50px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 16px;
          border-radius: 999px;
          color: #fff;
          background: linear-gradient(180deg, #62c66e, #269549);
          box-shadow: inset 0 -5px 0 rgba(19, 86, 44, 0.28), 0 9px 16px rgba(40, 95, 48, 0.2);
          font-weight: 950;
          white-space: nowrap;
        }

        .kid-map-progress strong {
          font-size: 1.3rem;
        }

        .kid-map-story-card {
          display: flex;
          align-items: center;
          gap: 10px;
          width: min(310px, 31vw);
          padding: 12px 14px;
          border: 4px solid rgba(255, 255, 255, 0.86);
          border-radius: 26px;
          background: rgba(255, 250, 223, 0.88);
          box-shadow: 0 14px 26px rgba(53, 84, 42, 0.2), inset 0 -5px 0 rgba(162, 119, 55, 0.1);
          backdrop-filter: blur(8px);
        }

        .kid-map-story-character {
          width: 54px;
          height: 54px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: linear-gradient(180deg, #fff2a2, #ffc65b);
          box-shadow: inset 0 -5px 0 rgba(147, 88, 26, 0.18);
          font-size: 2rem;
        }

        .kid-map-story-card h2 {
          margin: 0;
          font-size: 1.04rem;
          color: #4a331f;
        }

        .kid-map-story-card p {
          margin: 2px 0 0;
          color: #6a5138;
          font-size: 0.9rem;
          line-height: 1.35;
          font-weight: 850;
        }

        .kid-map-parent {
          min-height: 48px;
          padding: 0 18px;
          border-radius: 999px;
          color: #fff;
          font-size: 1rem;
          background: linear-gradient(180deg, #78caff, #3685dd);
          box-shadow: inset 0 -5px 0 rgba(0, 0, 0, 0.18), 0 10px 18px rgba(51, 80, 41, 0.23);
        }

        .kid-map-path-svg {
          position: absolute;
          inset: 0;
          z-index: 2;
          width: 100%;
          height: 100%;
          pointer-events: none;
          filter: drop-shadow(0 8px 8px rgba(55, 76, 34, 0.16));
        }

        .kid-level-node {
          position: absolute;
          left: var(--node-x);
          top: var(--node-y);
          z-index: 5;
          width: clamp(76px, 7.2vw, 104px);
          min-height: clamp(96px, 8.9vw, 126px);
          transform: translate(-50%, -50%);
          border: 0;
          background: transparent;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          padding: 0;
        }

        .kid-level-node:disabled {
          cursor: not-allowed;
        }

        .kid-level-circle {
          position: relative;
          width: clamp(64px, 6.3vw, 88px);
          height: clamp(64px, 6.3vw, 88px);
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 5px solid rgba(255, 246, 205, 0.96);
          background:
            radial-gradient(circle at 45% 38%, rgba(255,255,255,0.42) 0 12%, transparent 13%),
            radial-gradient(circle, #f7d286 0 30%, #bd7941 31% 54%, #875231 55% 100%);
          box-shadow: inset 0 -8px 0 rgba(75, 39, 16, 0.16), 0 12px 18px rgba(49, 75, 37, 0.24);
          transition: box-shadow 0.18s ease, filter 0.18s ease;
        }

        .kid-level-circle::before,
        .kid-level-circle::after {
          content: "";
          position: absolute;
          inset: 12px;
          border: 2px solid rgba(112, 67, 31, 0.3);
          border-radius: 50%;
          pointer-events: none;
        }

        .kid-level-circle::after {
          inset: 22px;
          border-width: 1px;
        }

        .kid-level-node.completed .kid-level-circle {
          border-color: #fff8bd;
          background:
            radial-gradient(circle at 45% 38%, rgba(255,255,255,0.44) 0 12%, transparent 13%),
            radial-gradient(circle, #9beb79 0 30%, #40ad4b 31% 58%, #237d3e 59% 100%);
        }

        .kid-level-node.active .kid-level-circle {
          border-color: #fff7b7;
          background:
            radial-gradient(circle at 45% 38%, rgba(255,255,255,0.5) 0 12%, transparent 13%),
            radial-gradient(circle, #ffdfa0 0 30%, #ff9b43 31% 58%, #d35b1f 59% 100%);
          animation: kidSoftGlow 1.45s ease-in-out infinite;
        }

        .kid-level-node.recommended .kid-level-circle {
          border-color: #fff7c5;
          background:
            radial-gradient(circle at 45% 38%, rgba(255,255,255,0.5) 0 12%, transparent 13%),
            radial-gradient(circle, #dff7ff 0 30%, #62c8ff 31% 58%, #2f7ad8 59% 100%);
          animation: kidAiGlow 1.3s ease-in-out infinite;
        }

        .kid-level-node.recommended .kid-level-caption {
          color: #25517c;
          background: rgba(230, 248, 255, 0.94);
        }

        .kid-level-node.locked .kid-level-circle {
          border-color: rgba(245, 245, 245, 0.88);
          background:
            radial-gradient(circle at 45% 38%, rgba(255,255,255,0.28) 0 12%, transparent 13%),
            radial-gradient(circle, #d9d9d9 0 30%, #a1a1a1 31% 58%, #707070 59% 100%);
          filter: grayscale(0.36);
          opacity: 0.82;
        }

        .kid-level-main-icon {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          width: clamp(42px, 4.3vw, 58px);
          height: clamp(42px, 4.3vw, 58px);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.42);
          overflow: hidden;
          box-shadow: inset 0 -3px 0 rgba(113, 70, 30, 0.12);
        }

        .kid-level-main-icon img {
          width: 92%;
          height: 92%;
          object-fit: contain;
          display: block;
        }

        .kid-level-status {
          position: absolute;
          right: -9px;
          top: -8px;
          z-index: 2;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: #fff9d9;
          box-shadow: 0 4px 10px rgba(57, 81, 40, 0.22);
          font-size: 0.95rem;
          font-weight: 950;
        }

        .kid-level-caption {
          max-width: 118px;
          padding: 5px 10px;
          border: 2px solid rgba(255, 255, 255, 0.75);
          border-radius: 999px;
          background: rgba(255, 249, 221, 0.92);
          color: #4f3721;
          font-size: 0.78rem;
          font-weight: 950;
          line-height: 1.15;
          box-shadow: 0 6px 12px rgba(58, 91, 48, 0.14);
          white-space: nowrap;
        }

        .kid-level-node:not(:disabled):hover .kid-level-circle,
        .kid-level-node:not(:disabled):focus-visible .kid-level-circle {
          box-shadow:
            inset 0 -8px 0 rgba(75, 39, 16, 0.16),
            0 12px 18px rgba(49, 75, 37, 0.24),
            0 0 0 8px rgba(255, 244, 156, 0.35),
            0 0 24px rgba(255, 243, 128, 0.62);
          filter: brightness(1.04);
        }

        .kid-map-back:hover,
        .kid-map-parent:hover {
          filter: brightness(1.04);
        }

        @keyframes kidSoftGlow {
          0%, 100% {
            box-shadow: inset 0 -8px 0 rgba(75, 39, 16, 0.16), 0 12px 18px rgba(49, 75, 37, 0.24), 0 0 0 0 rgba(255, 226, 92, 0.42);
          }
          50% {
            box-shadow: inset 0 -8px 0 rgba(75, 39, 16, 0.16), 0 12px 18px rgba(49, 75, 37, 0.24), 0 0 0 12px rgba(255, 226, 92, 0);
          }
        }

        @keyframes kidAiGlow {
          0%, 100% {
            box-shadow: inset 0 -8px 0 rgba(20, 58, 96, 0.16), 0 12px 18px rgba(49, 75, 37, 0.24), 0 0 0 0 rgba(116, 210, 255, 0.44);
          }
          50% {
            box-shadow: inset 0 -8px 0 rgba(20, 58, 96, 0.16), 0 12px 18px rgba(49, 75, 37, 0.24), 0 0 0 13px rgba(116, 210, 255, 0);
          }
        }

        .kid-result-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 30;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(31, 42, 27, 0.42);
          backdrop-filter: blur(4px);
        }

        .kid-result-modal-card {
          width: min(420px, calc(100vw - 36px));
          border: 4px solid rgba(255, 255, 255, 0.9);
          border-radius: 30px;
          padding: 22px 22px 18px;
          color: #4a331f;
          background: rgba(255, 250, 223, 0.96);
          box-shadow: 0 22px 52px rgba(35, 54, 29, 0.28), inset 0 -6px 0 rgba(162, 119, 55, 0.1);
        }

        .kid-result-modal-card h2 {
          margin: 0 0 8px;
          font-size: 1.32rem;
          font-weight: 950;
        }

        .kid-result-modal-card p {
          margin: 0;
          color: #6a5138;
          font-size: 1rem;
          line-height: 1.55;
          font-weight: 850;
        }

        .kid-result-modal-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 18px;
        }

        .kid-result-modal-close {
          min-height: 44px;
          padding: 0 18px;
          border: 0;
          border-radius: 999px;
          color: #fff;
          font-weight: 950;
          cursor: pointer;
          background: linear-gradient(180deg, #62c66e, #269549);
          box-shadow: inset 0 -5px 0 rgba(19, 86, 44, 0.28), 0 9px 16px rgba(40, 95, 48, 0.2);
        }

        @media (max-width: 920px) {
          .kid-map-topbar {
            grid-template-columns: auto 1fr;
            gap: 8px;
          }

          .kid-map-title-pill {
            min-width: 0;
            justify-self: stretch;
            padding: 8px 12px;
          }

          .kid-map-right-tools {
            grid-column: 1 / -1;
            justify-self: end;
            flex-direction: row;
            align-items: center;
          }

          .kid-map-progress {
            min-height: 42px;
            padding: 0 14px;
          }

          .kid-map-story-card {
            width: min(292px, calc(100vw - 32px));
            padding: 10px 12px;
          }
        }

        @media (max-width: 640px) {
          .kid-map-stage {
            background-position: center center;
          }

          .kid-map-topbar {
            left: 8px;
            right: 8px;
            top: 8px;
          }

          .kid-map-back {
            min-height: 40px;
            padding: 0 12px;
            font-size: 0.86rem;
          }

          .kid-map-title-icon {
            display: none;
          }

          .kid-map-title-text h1 {
            font-size: 0.96rem;
          }

          .kid-map-title-text p {
            font-size: 0.68rem;
          }

          .kid-map-story-card {
            display: none;
          }

          .kid-map-parent {
            min-height: 46px;
            font-size: 0.9rem;
            padding: 0 14px;
          }

          .kid-level-node {
            width: 66px;
            min-height: 82px;
          }

          .kid-level-caption {
            font-size: 0.66rem;
            padding: 4px 7px;
          }
        }
      `}</style>

      <section
        className="kid-map-stage"
        style={{ "--game-map-bg": `url(${gameMapBackground})` }}
        aria-label="幼兒森林測驗地圖"
      >
        <header className="kid-map-topbar">
          <div className="kid-map-left-tools">
            <button
              type="button"
              className="kid-map-back"
              onClick={() => navigate("/mode-select", { state: { child } })}
            >
              ← 返回
            </button>

            <aside className="kid-map-story-card">
              <span className="kid-map-story-character" aria-hidden="true">🐥</span>
              <div>
                <h2>皮皮在等你</h2>
                <p>點發光的圓圈，沿著小路完成森林任務！</p>
              </div>
            </aside>
          </div>

          <div className="kid-map-title-pill">
            <span className="kid-map-title-icon" aria-hidden="true">🐥</span>
            <div className="kid-map-title-text">
              <p>森林任務</p>
              <h1>{child?.name || child?.nickname || "小冒險家"}，跟著小路出發！</h1>
            </div>
          </div>

          <div className="kid-map-right-tools">
            <div className="kid-map-progress" aria-label={`目前完成 ${completedCount} 關，共 6 關`}>
              <span>⭐</span>
              <strong>{completedCount}</strong>
              <span>/ 6</span>
            </div>

            <button type="button" className="kid-map-parent" onClick={openParentResult}>
              給大人看結果
            </button>
          </div>
        </header>

        <svg className="kid-map-path-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M 6 58 C 14 55, 17 60, 25 61 C 33 62, 37 58, 43 54 C 49 50, 51 47, 56 48 C 64 49, 67 45, 73 45 C 80 45, 84 41, 91 39"
            fill="none"
            stroke="rgba(103, 70, 39, 0.48)"
            strokeWidth="7.8"
            strokeLinecap="round"
          />
          <path
            d="M 6 58 C 14 55, 17 60, 25 61 C 33 62, 37 58, 43 54 C 49 50, 51 47, 56 48 C 64 49, 67 45, 73 45 C 80 45, 84 41, 91 39"
            fill="none"
            stroke="rgba(255, 232, 164, 0.64)"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeDasharray="1.4 3.5"
          />
          <path
            d="M 6 58 C 14 55, 17 60, 25 61 C 33 62, 37 58, 43 54 C 49 50, 51 47, 56 48 C 64 49, 67 45, 73 45 C 80 45, 84 41, 91 39"
            fill="none"
            stroke="rgba(63, 130, 55, 0.32)"
            strokeWidth="10.5"
            strokeLinecap="round"
            strokeDasharray="0.8 7.8"
          />

          <ForestLeaf x={17} y={57} rotate={-22} />
          <ForestLeaf x={22} y={61} rotate={16} />
          <ForestLeaf x={35} y={59} rotate={-8} />
          <ForestLeaf x={48} y={51} rotate={25} />
          <ForestLeaf x={61} y={48} rotate={-18} />
          <ForestLeaf x={69} y={45} rotate={12} />
          <ForestLeaf x={82} y={42} rotate={-20} />
        </svg>

        {gamesWithStatus.map((game) => {
          const statusIcon = game.isCompleted ? "✓" : game.isAiRecommended ? "AI" : game.isActive ? "▶" : "🔒";
          const actionLabel = game.isCompleted
            ? "已完成，可重新開始"
            : game.isAiRecommended
              ? "AI 建議解鎖，可以開始"
              : game.isActive
                ? "可以開始"
                : "尚未解鎖";

          return (
            <button
              key={game.gameId}
              type="button"
              className={`kid-level-node ${game.status}`}
              style={{ "--node-x": `${game.x}%`, "--node-y": `${game.y}%` }}
              onClick={() => startTest(game, "single")}
              disabled={game.isLocked}
              aria-label={`第 ${game.level} 關，${game.name}，${actionLabel}`}
              title=""
            >
              <span className="kid-level-circle">
                <span className="kid-level-main-icon" aria-hidden="true">
                  <img src={game.icon} alt="" draggable="false" />
                </span>
                <span className="kid-level-status" aria-hidden="true">{statusIcon}</span>
              </span>

              <span className="kid-level-caption">{game.childText}</span>
            </button>
          );
        })}

        {resultModal && (
          <div
            className="kid-result-modal-backdrop"
            role="presentation"
            onClick={closeResultModal}
          >
            <section
              className="kid-result-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="kid-result-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="kid-result-modal-title">{resultModal.title}</h2>
              <p>{resultModal.message}</p>
              <div className="kid-result-modal-actions">
                <button type="button" className="kid-result-modal-close" onClick={closeResultModal}>
                  我知道了
                </button>
              </div>
            </section>
          </div>
        )}

      </section>
    </main>
  );
};

export default TestMapPage;

