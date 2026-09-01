/**
 * src/utils/TestFlowManager.js
 *
 * 用途：
 * 1. 管理完整六關測驗流程
 * 2. 判斷目前測驗結束後要去哪一關
 * 3. 支援單關測驗 / 完整測驗
 * 4. 以 childId 動態隔離 currentTestFlow，避免多孩家庭 / 機構情境下進度交叉污染
 * 5. 對全關卡完成狀態回傳明確終點訊號，避免 double click 後讀取 null.route 崩潰
 * 6. 關卡元數據優先與 resultManager 對接，若 resultManager 尚未提供則使用本檔 fallback
 */

import * as resultManager from "./resultManager";

const FALLBACK_TEST_FLOW_GAMES = [
  {
    gameId: "SRT",
    name: "橡實反應任務",
    ability: "抑制控制",
    route: "/test-srt",
    resultKeys: ["srtTestResult"],
  },
  {
    gameId: "PM",
    name: "圖片記憶任務",
    ability: "工作記憶",
    route: "/test-picture-memory",
    resultKeys: ["pmTestResult"],
  },
  {
    gameId: "CBT",
    name: "石頭記憶任務",
    ability: "工作記憶",
    route: "/test-cbt",
    resultKeys: ["cbtTestResult"],
  },
  {
    gameId: "SSG",
    name: "蒼蠅注意任務",
    ability: "抑制控制",
    route: "/test-ssg",
    resultKeys: ["ssgTestResult"],
  },
  {
    gameId: "LB",
    name: "幫助迷路的綿羊奶奶",
    ability: "認知彈性",
    route: "/test-linking-balloons",
    resultKeys: ["lbTestResult", "LB_RESULT"],
  },
  {
    gameId: "DCCS",
    name: "規則分類任務",
    ability: "認知彈性",
    route: "/test-dccs",
    resultKeys: ["dccsTestResult", "DCCS_RESULT"],
  },
];

const TEST_FLOW_STORAGE_KEY = "currentTestFlow";
const TEST_FLOW_ACTIVE_CHILD_KEY = "currentTestFlowActiveChildId";
const TEST_FLOW_GUEST_CHILD_ID = "guest";

const ACTIVE_CHILD_STORAGE_KEYS = [
  "currentChild",
  "selectedChild",
  "selectedPatient",
  "activeChild",
  "childProfile",
];

export const FLOW_ACTION_TYPES = Object.freeze({
  NEXT: "next",
  RESULT: "result",
  COMPLETED: "completed",
});

export const FLOW_END_GAME = Object.freeze({
  gameId: "__FLOW_COMPLETED__",
  name: "完整測驗已完成",
  ability: "summary",
  route: "/result-ch",
  completed: true,
  isFlowEnd: true,
});

const isBrowserStorageAvailable = () => {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
};

const getSessionStorage = () => {
  return isBrowserStorageAvailable() ? window.sessionStorage : null;
};

const getLocalStorage = () => {
  return typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : null;
};

const safeParse = (value) => {
  if (!value || typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
};

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const sanitizeChildId = (rawChildId) => {
  if (rawChildId === null || rawChildId === undefined || rawChildId === "") {
    return null;
  }

  return String(rawChildId).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
};

const pickChildId = (childLike = null) => {
  if (!childLike) return null;

  if (typeof childLike === "string" || typeof childLike === "number") {
    return sanitizeChildId(childLike);
  }

  return sanitizeChildId(
    childLike.childId ||
      childLike.id ||
      childLike.patientId ||
      childLike.patient_id ||
      childLike.uuid
  );
};

const getStoredActiveChildId = () => {
  const storages = [getSessionStorage(), getLocalStorage()].filter(Boolean);

  for (const storage of storages) {
    for (const key of ACTIVE_CHILD_STORAGE_KEYS) {
      const parsed = safeParse(storage.getItem(key));
      const childId = pickChildId(parsed);
      if (childId) return childId;
    }
  }

  return null;
};

const resolveChildId = ({ child = null, childId = null, flow = null } = {}) => {
  return (
    sanitizeChildId(childId) ||
    pickChildId(child) ||
    pickChildId(flow) ||
    getStoredActiveChildId() ||
    TEST_FLOW_GUEST_CHILD_ID
  );
};

const getTestFlowStorageKey = (childId = TEST_FLOW_GUEST_CHILD_ID) => {
  return `${TEST_FLOW_STORAGE_KEY}:${
    sanitizeChildId(childId) || TEST_FLOW_GUEST_CHILD_ID
  }`;
};

const getScopedDataKeys = (key, childId = TEST_FLOW_GUEST_CHILD_ID) => {
  const normalizedChildId =
    sanitizeChildId(childId) || TEST_FLOW_GUEST_CHILD_ID;

  return [
    `${key}:${normalizedChildId}`,
    `${normalizedChildId}:${key}`,
    `${key}_${normalizedChildId}`,
  ];
};

const getArrayFromResultManager = () => {
  const candidates = [
    resultManager.TEST_FLOW_GAMES,
    resultManager.TEST_GAMES,
    resultManager.TEST_GAME_CONFIGS,
    resultManager.GAME_RESULT_CONFIGS,
    resultManager.GAME_METADATA,
    resultManager.GAME_META,
    resultManager.RESULT_GAME_META,
    typeof resultManager.getTestFlowGames === "function"
      ? resultManager.getTestFlowGames()
      : null,
    typeof resultManager.getTestGameMetadata === "function"
      ? resultManager.getTestGameMetadata()
      : null,
    typeof resultManager.getGameMetadata === "function"
      ? resultManager.getGameMetadata()
      : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }

    if (candidate && typeof candidate === "object") {
      const values = Object.entries(candidate).map(([gameId, config]) => ({
        gameId: config?.gameId || gameId,
        ...(config || {}),
      }));

      if (values.length > 0) return values;
    }
  }

  return FALLBACK_TEST_FLOW_GAMES;
};

const normalizeGameConfig = (rawGame = {}) => {
  const gameId = String(rawGame.gameId || rawGame.id || "")
    .trim()
    .toUpperCase();

  const fallback =
    FALLBACK_TEST_FLOW_GAMES.find((game) => game.gameId === gameId) || {};

  return {
    ...fallback,
    ...rawGame,
    gameId: gameId || fallback.gameId,
    name: rawGame.name || rawGame.title || fallback.name || gameId,
    ability: rawGame.ability || rawGame.domain || fallback.ability || "",
    route:
      rawGame.route ||
      rawGame.testRoute ||
      rawGame.path ||
      fallback.route ||
      "/test-map",
    resultKeys:
      rawGame.resultKeys ||
      rawGame.storageKeys ||
      rawGame.localStorageKeys ||
      [rawGame.resultKey, rawGame.storageKey].filter(Boolean) ||
      fallback.resultKeys ||
      [],
    completed: Boolean(rawGame.completed),
  };
};

const normalizeGameList = (games = FALLBACK_TEST_FLOW_GAMES) => {
  const normalized = games
    .map(normalizeGameConfig)
    .filter((game) => Boolean(game.gameId));

  const fallbackOrder = FALLBACK_TEST_FLOW_GAMES.map((game) => game.gameId);

  return normalized.sort((a, b) => {
    const aIndex = fallbackOrder.indexOf(a.gameId);
    const bIndex = fallbackOrder.indexOf(b.gameId);

    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;

    return aIndex - bIndex;
  });
};

export const TEST_FLOW_GAMES = normalizeGameList(getArrayFromResultManager());

const markCompletedOnGames = (games = TEST_FLOW_GAMES, completedGames = []) => {
  const completedSet = new Set(
    completedGames.map((item) => item?.gameId).filter(Boolean)
  );

  return games.map((game) => ({
    ...game,
    completed: completedSet.has(game.gameId) || Boolean(game.completed),
  }));
};

const isEveryGameCompleted = (games = TEST_FLOW_GAMES, completedGames = []) => {
  if (!games.length) return false;

  const completedSet = new Set(
    completedGames.map((item) => item?.gameId).filter(Boolean)
  );

  return games.every(
    (game) => game.completed || completedSet.has(game.gameId)
  );
};

const sanitizeResultSummary = (resultData = null) => {
  if (!resultData) return null;

  return {
    stars: toFiniteNumber(resultData.stars, 0),
    accuracy: toFiniteNumber(resultData.accuracy, 0),
    avgReactionTime: toFiniteNumber(resultData.avgReactionTime, 0),
    warningLevel: resultData.warningLevel || "normal",
    recommendedDifficulty: resultData.recommendedDifficulty || "normal",
  };
};

const normalizeFlow = (flow = null) => {
  if (!flow) return null;

  const games = normalizeGameList(flow.games || TEST_FLOW_GAMES);
  const completedGames = Array.isArray(flow.completedGames)
    ? flow.completedGames.filter((item) => item?.gameId)
    : [];

  const childId = resolveChildId({ flow });
  const currentIndex = Number.isInteger(flow.currentIndex)
    ? Math.max(0, Math.min(flow.currentIndex, games.length))
    : 0;

  return {
    ...flow,
    childId,
    mode: flow.mode || "full",
    currentIndex,
    completedGames,
    games: markCompletedOnGames(games, completedGames),
    isCompleted: isEveryGameCompleted(games, completedGames),
  };
};

export const createTestFlow = ({
  child = null,
  childId = null,
  mode = "full",
  startGameId = "SRT",
} = {}) => {
  const games = normalizeGameList(TEST_FLOW_GAMES);
  const startIndex = games.findIndex((game) => game.gameId === startGameId);
  const normalizedStartIndex = startIndex >= 0 ? startIndex : 0;
  const resolvedChildId = resolveChildId({ child, childId });

  const flow = {
    flowId: `test_flow_${resolvedChildId}_${Date.now()}`,
    childId: resolvedChildId,
    childName: child?.name || child?.nickname || "",
    mode,
    currentIndex: normalizedStartIndex,
    completedGames: [],
    games,
    isCompleted: false,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveTestFlow(flow);

  return flow;
};

export const saveTestFlow = (flow, options = {}) => {
  if (!flow) return null;

  const storage = getSessionStorage();
  if (!storage) return normalizeFlow(flow);

  const normalizedFlow = normalizeFlow({
    ...flow,
    childId: resolveChildId({
      child: options.child,
      childId: options.childId,
      flow,
    }),
    updatedAt: new Date().toISOString(),
  });

  const storageKey = getTestFlowStorageKey(normalizedFlow.childId);

  storage.setItem(storageKey, safeStringify(normalizedFlow));
  storage.setItem(TEST_FLOW_ACTIVE_CHILD_KEY, normalizedFlow.childId);

  // 移除舊版全域 Key，避免下次切換孩子時誤讀靜態 currentTestFlow。
  storage.removeItem(TEST_FLOW_STORAGE_KEY);

  return normalizedFlow;
};

export const getCurrentTestFlow = ({ child = null, childId = null } = {}) => {
  const storage = getSessionStorage();
  if (!storage) return null;

  const activeChildId =
    sanitizeChildId(childId) ||
    pickChildId(child) ||
    sanitizeChildId(storage.getItem(TEST_FLOW_ACTIVE_CHILD_KEY)) ||
    getStoredActiveChildId() ||
    TEST_FLOW_GUEST_CHILD_ID;

  const scopedFlow = safeParse(
    storage.getItem(getTestFlowStorageKey(activeChildId))
  );

  if (scopedFlow) return normalizeFlow(scopedFlow);

  // 舊資料遷移：若還有舊版 currentTestFlow，僅在 childId 相符或缺 childId 時遷移。
  const legacyFlow = safeParse(storage.getItem(TEST_FLOW_STORAGE_KEY));
  if (!legacyFlow) return null;

  const legacyChildId = pickChildId(legacyFlow) || TEST_FLOW_GUEST_CHILD_ID;
  const canMigrate =
    !activeChildId ||
    activeChildId === TEST_FLOW_GUEST_CHILD_ID ||
    legacyChildId === activeChildId;

  if (!canMigrate) return null;

  return saveTestFlow({
    ...legacyFlow,
    childId: legacyChildId,
  });
};

export const clearTestFlow = ({
  child = null,
  childId = null,
  clearAll = false,
} = {}) => {
  const storage = getSessionStorage();
  if (!storage) return;

  if (clearAll) {
    Object.keys(storage).forEach((key) => {
      if (
        key === TEST_FLOW_STORAGE_KEY ||
        key === TEST_FLOW_ACTIVE_CHILD_KEY ||
        key.startsWith(`${TEST_FLOW_STORAGE_KEY}:`)
      ) {
        storage.removeItem(key);
      }
    });

    return;
  }

  const resolvedChildId = resolveChildId({ child, childId });

  storage.removeItem(getTestFlowStorageKey(resolvedChildId));
  storage.removeItem(TEST_FLOW_STORAGE_KEY);

  if (storage.getItem(TEST_FLOW_ACTIVE_CHILD_KEY) === resolvedChildId) {
    storage.removeItem(TEST_FLOW_ACTIVE_CHILD_KEY);
  }
};

export const getGameById = (gameId) => {
  return TEST_FLOW_GAMES.find((game) => game.gameId === gameId) || null;
};

export const getCurrentGame = (flow = getCurrentTestFlow()) => {
  const normalizedFlow = normalizeFlow(flow);

  if (!normalizedFlow || normalizedFlow.isCompleted) {
    return FLOW_END_GAME;
  }

  return normalizedFlow.games?.[normalizedFlow.currentIndex] || FLOW_END_GAME;
};

export const getNextGame = ({
  currentGameId,
  flow = getCurrentTestFlow(),
} = {}) => {
  const normalizedFlow = normalizeFlow(flow);
  if (!normalizedFlow) return null;

  const games = normalizedFlow.games || TEST_FLOW_GAMES;

  if (isEveryGameCompleted(games, normalizedFlow.completedGames)) {
    return FLOW_END_GAME;
  }

  const completedSet = new Set(
    (normalizedFlow.completedGames || []).map((item) => item.gameId)
  );

  const currentIndex = Number.isInteger(normalizedFlow.currentIndex)
    ? normalizedFlow.currentIndex
    : games.findIndex((game) => game.gameId === currentGameId);

  // 先找 currentIndex 之後尚未完成的關卡。
  // 即使 double click 讓 index 到尾端，也不會讀取 null.route。
  const nextUncompletedAfterCurrent = games.find((game, index) => {
    return (
      index > currentIndex &&
      !game.completed &&
      !completedSet.has(game.gameId)
    );
  });

  if (nextUncompletedAfterCurrent) return nextUncompletedAfterCurrent;

  // 若有被跳過或狀態錯位的未完成關卡，回補第一個未完成關卡。
  const firstUncompleted = games.find(
    (game) => !game.completed && !completedSet.has(game.gameId)
  );

  return firstUncompleted || FLOW_END_GAME;
};

export const markGameCompleted = ({
  gameId,
  resultData = null,
  flow = getCurrentTestFlow(),
} = {}) => {
  const normalizedFlow = normalizeFlow(flow);

  if (!normalizedFlow || !gameId) return null;

  const games = normalizedFlow.games || TEST_FLOW_GAMES;
  const currentIndex = games.findIndex((game) => game.gameId === gameId);

  const completedGame = {
    gameId,
    completedAt: new Date().toISOString(),
    resultSummary: sanitizeResultSummary(resultData),
  };

  const completedGames = [
    ...(normalizedFlow.completedGames || []).filter(
      (item) => item.gameId !== gameId
    ),
    completedGame,
  ];

  const updatedGames = markCompletedOnGames(games, completedGames);
  const flowCompleted = isEveryGameCompleted(updatedGames, completedGames);

  const updatedFlow = {
    ...normalizedFlow,
    currentIndex:
      currentIndex >= 0
        ? Math.min(currentIndex + 1, updatedGames.length)
        : normalizedFlow.currentIndex,
    completedGames,
    games: updatedGames,
    isCompleted: flowCompleted,
    updatedAt: new Date().toISOString(),
  };

  return saveTestFlow(updatedFlow);
};

export const getFlowProgress = (flow = getCurrentTestFlow()) => {
  const normalizedFlow = normalizeFlow(flow);

  if (!normalizedFlow) {
    return {
      completed: 0,
      total: TEST_FLOW_GAMES.length,
      percent: 0,
      isCompleted: false,
    };
  }

  const total = normalizedFlow.games?.length || TEST_FLOW_GAMES.length;
  const completed = Math.min(normalizedFlow.completedGames?.length || 0, total);

  return {
    completed,
    total,
    percent:
      total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0,
    isCompleted: total > 0 && completed >= total,
  };
};

export const getStoredGameResult = (
  gameId,
  { child = null, childId = null } = {}
) => {
  const game = getGameById(gameId);
  if (!game) return null;

  const resolvedChildId = resolveChildId({ child, childId });
  const storages = [getLocalStorage(), getSessionStorage()].filter(Boolean);

  for (const key of game.resultKeys || []) {
    const scopedKeys = getScopedDataKeys(key, resolvedChildId);

    for (const scopedKey of scopedKeys) {
      for (const storage of storages) {
        const scopedValue = safeParse(storage.getItem(scopedKey));
        if (scopedValue) return scopedValue;
      }
    }
  }

  // 相容舊版靜態 result key；但只在沒有 scoped 結果時讀取。
  for (const key of game.resultKeys || []) {
    for (const storage of storages) {
      const value = safeParse(storage.getItem(key));
      if (value) return value;
    }
  }

  return null;
};

export const getAllTestResults = ({ child = null, childId = null } = {}) => {
  return TEST_FLOW_GAMES.map((game) => {
    return {
      gameId: game.gameId,
      name: game.name,
      ability: game.ability,
      result: getStoredGameResult(game.gameId, { child, childId }),
    };
  });
};

export const isFullTestCompleted = ({ child = null, childId = null } = {}) => {
  const results = getAllTestResults({ child, childId });
  return results.every((item) => Boolean(item.result));
};

const buildSingleGameResultAction = ({ gameId, resultData }) => {
  const game = getGameById(gameId);

  return {
    type: FLOW_ACTION_TYPES.RESULT,
    route: "/result-ch",
    state: {
      gameId,
      mode: "test",
      resultData,
      replayPath: game?.route || "/test-map",
      difficultyPath: game?.route || "/test-map",
      forestPath: "/test-map",
    },
  };
};

const buildCompletedAction = ({ gameId, resultData, child, updatedFlow }) => {
  return {
    type: FLOW_ACTION_TYPES.COMPLETED,
    route: "/result-ch",
    state: {
      child,
      gameId,
      mode: "test",
      resultData,
      testFlow: updatedFlow,
      isFullTest: true,
      isFullTestCompleted: true,
      replayPath: "/test-map",
      difficultyPath: "/test-map",
      forestPath: "/test-map",
    },
  };
};

export const getNextTestAction = ({
  gameId,
  resultData = null,
  child = null,
  childId = null,
  flow = getCurrentTestFlow({ child, childId }),
} = {}) => {
  const normalizedFlow = normalizeFlow(flow);

  // 單關測驗或沒有完整流程：直接進結果頁，不污染完整測驗進度。
  if (!normalizedFlow || normalizedFlow.mode === "single") {
    return buildSingleGameResultAction({ gameId, resultData });
  }

  // 若 double click 已經把流程推到 completed，直接回完成 action。
  if (normalizedFlow.isCompleted) {
    return buildCompletedAction({
      gameId,
      resultData,
      child,
      updatedFlow: normalizedFlow,
    });
  }

  const updatedFlow = markGameCompleted({
    gameId,
    resultData,
    flow: normalizedFlow,
  });

  if (!updatedFlow) {
    return buildSingleGameResultAction({ gameId, resultData });
  }

  const nextGame = getNextGame({
    currentGameId: gameId,
    flow: updatedFlow,
  });

  if (!nextGame || nextGame.isFlowEnd || nextGame.completed) {
    return buildCompletedAction({
      gameId,
      resultData,
      child,
      updatedFlow,
    });
  }

  return {
    type: FLOW_ACTION_TYPES.NEXT,
    route: nextGame.route || "/test-map",
    state: {
      child,
      gameId: nextGame.gameId,
      testFlow: updatedFlow,
      isFullTest: true,
      forestPath: "/test-map",
    },
  };
};

export const finishTestGameAndGetAction = ({
  gameId,
  resultData,
  child = null,
  childId = null,
} = {}) => {
  return getNextTestAction({
    gameId,
    resultData,
    child,
    childId,
  });
};
