import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import gameMapBackground from "../asset/GameMap.png";
import srtIcon from "../asset/SRT_icon.png";
import pmIcon from "../asset/PM_icon.png";
import cbtIcon from "../asset/CBT_icon.png";
import dptIcon from "../asset/DPT_icon.png";
import dccsIcon from "../asset/DCCS_icon.png";
import lbIcon from "../asset/LB_icon.png";
import mouseGuide from "../asset/mouse.png";
import resetIcon from "../asset/home/remove.png";
import "../styles/TestMapPage.css";

/**
 * TestMapPage.jsx
 *
 * 幼兒版森林測驗地圖：
 * - 全螢幕 GameMap.png 背景
 * - 測驗固定順序，避免孩子亂跳未解鎖關卡
 * - 關卡使用 asset 裡的大圖片 icon，不在 icon 下方顯示文字
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
    x: 8.2,
    y: 62.4,
  },
  {
    gameId: "PM",
    level: 2,
    name: "湖邊圖片記憶",
    childText: "記圖片",
    route: "/test-picture-memory",
    icon: pmIcon,
    x: 24.8,
    y: 65.1,
  },
  {
    gameId: "CBT",
    level: 3,
    name: "石頭小橋記憶",
    childText: "走石橋",
    route: "/test-cbt",
    icon: cbtIcon,
    x: 43.8,
    y: 55.1,
  },
  {
    gameId: "DPT",
    level: 4,
    name: "蒼蠅注意任務",
    childText: "找小蟲",
    route: "/test-dot-probe",
    icon: dptIcon,
    x: 56.4,
    y: 49.7,
  },
  {
    gameId: "DCCS",
    level: 5,
    name: "孔雀服飾分類",
    childText: "換規則",
    route: "/test-dccs",
    icon: dccsIcon,
    x: 74.5,
    y: 45.0,
  },
  {
    gameId: "LB",
    level: 6,
    name: "綿羊奶奶回家路",
    childText: "排路標",
    route: "/test-linking-balloons",
    icon: lbIcon,
    x: 90.6,
    y: 36.8,
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

const MAP_PATH_D = "M 2.8 62.6 C 10.5 60.4, 17.1 64.3, 24.8 65.1 C 33.8 66.0, 37.6 60.0, 43.8 55.1 C 49.0 50.9, 52.6 49.4, 56.4 49.7 C 64.3 50.4, 68.2 46.6, 74.5 45.0 C 81.5 43.2, 85.0 38.9, 92.5 36.7";

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
  const [resetVersion, setResetVersion] = useState(0);

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
      const isUnlocked = isCompleted || isSequentiallyAvailable || isUnlockedByPreviousStars;
      const isActive = !isCompleted && isUnlocked;
      const isLocked = !isUnlocked;
      const status = isCompleted ? "completed" : isActive && game.isAiRecommended ? "recommended" : isActive ? "active" : "locked";

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
  }, [resetVersion]);

  const completedCount = gamesWithStatus.filter((game) => game.isCompleted).length;
  const guideGame = gamesWithStatus.find((game) => game.isActive) || null;

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

  const resetAllTests = () => {
    TEST_GAMES.forEach((game) => {
      localStorage.removeItem(STORAGE_KEYS.result(game.gameId));
      localStorage.removeItem(STORAGE_KEYS.trainingSummary(game.gameId));
      localStorage.removeItem(STORAGE_KEYS.stars(game.gameId));
      sessionStorage.removeItem(STORAGE_KEYS.result(game.gameId));
      sessionStorage.removeItem(STORAGE_KEYS.trainingSummary(game.gameId));
      sessionStorage.removeItem(STORAGE_KEYS.stars(game.gameId));

      (LEGACY_RESULT_KEYS[game.gameId] || []).forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      (LEGACY_STAR_KEYS[game.gameId] || []).forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    });

    [
      STORAGE_KEYS.latestResults,
      STORAGE_KEYS.aiRecommendation,
      STORAGE_KEYS.testFlow,
      "latestResults",
      "latestTestResults",
      "parentLatestResults",
      "aiRecommendation",
      "aiDifficultyRecommendation",
      "recommendedDifficulty",
      "trainingRecommendation",
      "currentAIRecommendation",
      "latestRecommendation",
      "currentTestFlow",
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    setResetVersion((value) => value + 1);
    setResultModal(null);
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
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
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
        .kid-map-right-tools,
        .kid-map-progress,
        .kid-map-parent,
        .kid-map-reset {
          pointer-events: auto;
        }

        .kid-map-right-tools {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }

        .kid-map-back,
        .kid-map-parent,
        .kid-map-reset {
          border: 0;
          cursor: pointer;
          font-weight: 950;
          transition: filter 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
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


        .kid-map-parent {
          min-height: 48px;
          padding: 0 18px;
          border-radius: 999px;
          color: #fff;
          font-size: 1rem;
          background: linear-gradient(180deg, #78caff, #3685dd);
          box-shadow: inset 0 -5px 0 rgba(0, 0, 0, 0.18), 0 10px 18px rgba(51, 80, 41, 0.23);
        }

        .kid-map-reset {
          width: 72px;
          height: 72px;
          padding: 0;
          border-radius: 20;
          display: grid;
          place-items: center;
          background: transparent;
          box-shadow: none;
        }

        .kid-map-reset img {
          width: 180%;
          height: 180%;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 8px 10px rgba(51, 80, 41, 0.22));
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

        .kid-map-path-base {
          stroke: rgba(92, 116, 57, 0.32);
          stroke-width: 8.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .kid-map-path-inner {
          stroke: rgba(210, 222, 145, 0.46);
          stroke-width: 4.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .kid-map-path-dots {
          stroke: rgba(64, 133, 61, 0.38);
          stroke-width: 9.6;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 0.75 8.2;
        }

        .kid-level-node {
          position: absolute;
          left: var(--node-x);
          top: var(--node-y);
          z-index: 5;
          width: clamp(92px, 8.6vw, 130px);
          height: clamp(92px, 8.6vw, 130px);
          transform: translate(-50%, -50%);
          border: 0;
          background: transparent;
          cursor: pointer;
          display: grid;
          place-items: center;
          padding: 0;
        }

        .kid-level-node:disabled {
          cursor: not-allowed;
        }

        .kid-level-circle {
          position: relative;
          width: clamp(86px, 7.6vw, 118px);
          height: clamp(86px, 7.6vw, 118px);
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 7px solid rgba(190, 190, 190, 0.95);
          background:
            radial-gradient(circle at 45% 38%, rgba(255,255,255,0.42) 0 12%, transparent 13%),
            radial-gradient(circle, #f8f8f8 0 30%, #d4d4d4 31% 54%, #a5a5a5 55% 100%);
          box-shadow: inset 0 -9px 0 rgba(75, 39, 16, 0.12), 0 14px 22px rgba(49, 75, 37, 0.26);
          transition: box-shadow 0.18s ease, filter 0.18s ease, border-color 0.18s ease;
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
          border-color: rgba(196, 196, 196, 0.98);
          background:
            radial-gradient(circle at 45% 38%, rgba(255,255,255,0.5) 0 12%, transparent 13%),
            radial-gradient(circle, #ffffff 0 30%, #d9d9d9 31% 58%, #9d9d9d 59% 100%);
          animation: kidSoftGlow 1.45s ease-in-out infinite;
        }

        .kid-level-node.recommended .kid-level-circle {
          border-color: rgba(196, 196, 196, 0.98);
          background:
            radial-gradient(circle at 45% 38%, rgba(255,255,255,0.5) 0 12%, transparent 13%),
            radial-gradient(circle, #ffffff 0 30%, #d9d9d9 31% 58%, #9d9d9d 59% 100%);
          animation: kidAiGlow 1.3s ease-in-out infinite;
        }

        .kid-level-node.locked .kid-level-circle {
          border-color: rgba(176, 176, 176, 0.96);
          background:
            radial-gradient(circle at 45% 38%, rgba(255,255,255,0.28) 0 12%, transparent 13%),
            radial-gradient(circle, #eeeeee 0 30%, #bdbdbd 31% 58%, #7c7c7c 59% 100%);
          filter: grayscale(0.55);
          opacity: 0.88;
        }

        .kid-level-main-icon {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          width: clamp(58px, 5.6vw, 82px);
          height: clamp(58px, 5.6vw, 82px);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          overflow: hidden;
          box-shadow: inset 0 -3px 0 rgba(113, 70, 30, 0.12);
        }

        .kid-level-main-icon img {
          width: 104%;
          height: 104%;
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

        .kid-mouse-guide {
          position: absolute;
          left: var(--mouse-x);
          top: var(--mouse-y);
          z-index: 7;
          width: clamp(54px, 5.4vw, 84px);
          height: auto;
          transform: translate(-8%, -110%);
          pointer-events: none;
          filter: drop-shadow(0 10px 10px rgba(46, 67, 32, 0.28));
          animation: kidMousePoint 1.15s ease-in-out infinite;
        }

        .kid-level-node:not(:disabled):hover .kid-level-circle,
        .kid-level-node:not(:disabled):focus-visible .kid-level-circle {
          box-shadow:
            inset 0 -9px 0 rgba(75, 39, 16, 0.12),
            0 14px 22px rgba(49, 75, 37, 0.26),
            0 0 0 8px rgba(255, 244, 156, 0.35),
            0 0 24px rgba(255, 243, 128, 0.62);
          filter: brightness(1.04);
        }

        .kid-map-back:hover,
        .kid-map-parent:hover,
        .kid-map-reset:hover {
          filter: brightness(1.04);
        }

        @keyframes kidSoftGlow {
          0%, 100% {
            box-shadow: inset 0 -9px 0 rgba(75, 39, 16, 0.12), 0 14px 22px rgba(49, 75, 37, 0.26), 0 0 0 0 rgba(255, 226, 92, 0.42);
          }
          50% {
            box-shadow: inset 0 -9px 0 rgba(75, 39, 16, 0.12), 0 14px 22px rgba(49, 75, 37, 0.26), 0 0 0 12px rgba(255, 226, 92, 0);
          }
        }

        @keyframes kidAiGlow {
          0%, 100% {
            box-shadow: inset 0 -9px 0 rgba(75, 39, 16, 0.12), 0 14px 22px rgba(49, 75, 37, 0.26), 0 0 0 0 rgba(116, 210, 255, 0.44);
          }
          50% {
            box-shadow: inset 0 -9px 0 rgba(75, 39, 16, 0.12), 0 14px 22px rgba(49, 75, 37, 0.26), 0 0 0 13px rgba(116, 210, 255, 0);
          }
        }

        @keyframes kidMousePoint {
          0%, 100% {
            transform: translate(-8%, -110%) rotate(-6deg) scale(1);
          }
          50% {
            transform: translate(-2%, -122%) rotate(-10deg) scale(1.05);
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
            gap: 8px;
          }


          .kid-map-right-tools {
            flex-direction: row;
            align-items: center;
          }

          .kid-map-progress {
            min-height: 42px;
            padding: 0 14px;
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



          .kid-map-parent {
            min-height: 46px;
            font-size: 0.9rem;
            padding: 0 14px;
          }

          .kid-level-node {
            width: 74px;
            height: 74px;
          }

          .kid-level-circle {
            width: 70px;
            height: 70px;
            border-width: 5px;
          }

          .kid-level-main-icon {
            width: 48px;
            height: 48px;
          }

          .kid-level-status {
            width: 24px;
            height: 24px;
            right: -7px;
            top: -7px;
            font-size: 0.78rem;
          }

          .kid-map-reset {
            width: 62px;
            height: 62px;
            padding: 0;
          }

          .kid-mouse-guide {
            width: 48px;
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

          </div>

          <div className="kid-map-right-tools">
            <div className="kid-map-progress" aria-label={`目前完成 ${completedCount} 關，共 6 關`}>
              <span>⭐</span>
              <strong>{completedCount}</strong>
              <span>/ 6</span>
            </div>

            <button
              type="button"
              className="kid-map-reset"
              onClick={resetAllTests}
              aria-label="重新測驗"
              title="重新測驗"
            >
              <img src={resetIcon} alt="" draggable="false" />
            </button>

            <button type="button" className="kid-map-parent" onClick={openParentResult}>
              給大人看結果
            </button>
          </div>
        </header>

        <svg className="kid-map-path-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={MAP_PATH_D} fill="none" className="kid-map-path-base" />
          <path d={MAP_PATH_D} fill="none" className="kid-map-path-inner" />
          <path d={MAP_PATH_D} fill="none" className="kid-map-path-dots" />

          <ForestLeaf x={17} y={63.5} rotate={-22} />
          <ForestLeaf x={22} y={65.4} rotate={16} />
          <ForestLeaf x={35} y={61.3} rotate={-8} />
          <ForestLeaf x={49} y={51.6} rotate={25} />
          <ForestLeaf x={62} y={49.2} rotate={-18} />
          <ForestLeaf x={70} y={46.3} rotate={12} />
          <ForestLeaf x={84} y={40.4} rotate={-20} />
        </svg>

        {gamesWithStatus.map((game) => {
          const statusIcon = game.isCompleted ? "✓" : game.status === "recommended" ? "AI" : game.isActive ? "▶" : "🔒";
          const actionLabel = game.isCompleted
            ? "已完成，可重新開始"
            : game.status === "recommended"
              ? "AI 建議挑戰，可以開始"
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
            </button>
          );
        })}

        {guideGame && (
          <img
            className="kid-mouse-guide"
            src={mouseGuide}
            alt=""
            aria-hidden="true"
            draggable="false"
            style={{ "--mouse-x": `${guideGame.x}%`, "--mouse-y": `${guideGame.y}%` }}
          />
        )}

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

