import { saveGameResultToCloud } from "../lib/database";
import { createBehavioralId } from "../analytics/trials/buildBehavioralHierarchy";
import { awardTrainingCoins } from "./economyManager";
import { completeActiveRecommendation } from "../analytics/recommendation/onlineRecommendation";

/**
 * src/utils/resultManager.js
 *
 * 統一 test / training result 資料格式。
 * 目標：讓 ResultPage_CH / ResultPage_PA / ResultPage_DC / AI 小助手 / Supabase
 * 都讀同一種結構，不需要每個遊戲各自判斷欄位。
 *
 * 2026 hardening:
 * 1. currentChild / rawResult 全面採用防禦性讀取，避免訪客模式或快取清空時崩潰。
 * 2. 儲存前遞迴清洗 NaN / Infinity / -Infinity，避免 Supabase schema type mismatch。
 * 3. 本機歷史結果依 createdAt / finishedAt / generatedAt 顯式排序後再 slice(0, 200)。
 */

export const RESULT_VERSION = "1.0.0";
export const ALL_RESULTS_KEY = "efGameResults";
export const MAX_LOCAL_RESULTS = 200;

export const GAME_META = {
  SRT: {
    gameId: "SRT",
    gameName: "橡實反應任務",
    abilityType: "inhibition",
    abilityLabel: "抑制控制",
  },
  PM: {
    gameId: "PM",
    gameName: "圖片記憶任務",
    abilityType: "workingMemory",
    abilityLabel: "工作記憶",
  },
  CBT: {
    gameId: "CBT",
    gameName: "石頭記憶任務",
    abilityType: "workingMemory",
    abilityLabel: "工作記憶",
  },
  SSG: {
    gameId: "SSG",
    gameName: "蒼蠅注意任務",
    abilityType: "attention",
    abilityLabel: "注意力 / 抑制控制",
  },
  LB: {
    gameId: "LB",
    gameName: "順序切換任務",
    abilityType: "cognitiveFlexibility",
    abilityLabel: "認知彈性",
  },
  DCCS: {
    gameId: "DCCS",
    gameName: "規則分類任務",
    abilityType: "cognitiveFlexibility",
    abilityLabel: "認知彈性",
  },
};

export const LEGACY_RESULT_KEYS = {
  SRT: { test: "srtTestResult", training: "srtTrainingResult" },
  PM: { test: "pmTestResult", training: "pmTrainingResult" },
  CBT: { test: "cbtTestResult", training: "cbtTrainingResult" },
  SSG: { test: "ssgTestResult", training: "ssgTrainingResult" },
  LB: { test: "lbTestResult", training: "lbTrainingResult" },
  DCCS: { test: "dccsTestResult", training: "dccsTrainingResult" },
};

const isPlainObject = (value) => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const safeObject = (value) => {
  if (!isPlainObject(value)) return {};
  return value;
};

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const safeParse = (value, fallback = null) => {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const safeDateString = (value, fallback = null) => {
  if (!value) return fallback;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
};

const getResultTimestamp = (result) => {
  const candidate =
    result?.createdAt ??
    result?.session?.finishedAt ??
    result?.finishedAt ??
    result?.generatedAt ??
    result?.session?.startedAt ??
    result?.startedAt ??
    result?.timestamp ??
    0;

  const time = new Date(candidate).getTime();
  return Number.isFinite(time) ? time : 0;
};

/**
 * 遞迴清洗資料，避免 NaN / Infinity 污染 JSONB 或 numeric 欄位。
 * - number: 非有限值改為 fallbackNumber，預設 0
 * - array/object: 深層遞迴清洗
 * - Date: 轉 ISO 字串
 * - function / symbol / undefined: 移除或轉 null，避免 JSON.stringify 遺失造成結構不一致
 */
export const sanitizeForStorage = (value, fallbackNumber = 0) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallbackNumber;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value.toISOString() : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForStorage(item, fallbackNumber));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (
        typeof item === "undefined" ||
        typeof item === "function" ||
        typeof item === "symbol"
      ) {
        acc[key] = null;
        return acc;
      }

      acc[key] = sanitizeForStorage(item, fallbackNumber);
      return acc;
    }, {});
  }

  if (typeof value === "bigint") {
    return safeNumber(value, fallbackNumber);
  }

  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return null;
  }

  return value;
};

export const getCurrentChild = () => {
  if (typeof window === "undefined") return null;
  const parsedChild = safeParse(window.localStorage?.getItem("currentChild"), null);
  return isPlainObject(parsedChild) ? parsedChild : null;
};

export const createResultId = ({ gameId, mode, childId } = {}) => {
  const prefix = [childId || "guest", gameId || "GAME", mode || "test"].join("_");
  return `${prefix}_${Date.now()}`;
};

export const getLegacyResultKey = (gameId, mode = "test") => {
  const normalizedGameId = safeString(gameId, "game");

  return (
    LEGACY_RESULT_KEYS?.[normalizedGameId]?.[mode] ||
    `${normalizedGameId.toLowerCase()}${
      mode === "training" ? "Training" : "Test"
    }Result`
  );
};

export const getChildScopedResultKey = (gameId, mode = "test", childId = null) => {
  const safeGameId = safeString(gameId, "UNKNOWN");
  const safeMode = safeString(mode, "test");
  const safeChildId = safeString(childId || "unassigned", "unassigned");

  return `result:${safeChildId}:${safeGameId}:${safeMode}`;
};

const normalizeVisibleRoles = (visibleRoles) => {
  const roles = safeArray(visibleRoles).filter(Boolean);
  return roles.length > 0 ? roles : ["child", "parent"];
};

const normalizeTrials = (raw) => {
  return safeArray(
    raw?.trials ??
      raw?.trialLogs ??
      raw?.records ??
      raw?.logs ??
      raw?.history ??
      raw?.rounds
  );
};

/**
 * 將各遊戲舊格式轉成統一格式。
 * rawResult 仍會完整保留，避免舊 ResultPage 需要的欄位遺失。
 */
export const normalizeGameResult = ({
  rawResult = {},
  gameId,
  mode = "test",
  difficulty = null,
  child = null,
  route = null,
  visibleRoles = ["child", "parent"],
} = {}) => {
  const raw = safeObject(rawResult);
  const currentChild = isPlainObject(child) ? child : getCurrentChild() || {};

  const normalizedGameId =
    gameId ??
    raw?.gameId ??
    raw?.taskCode ??
    raw?.gameCode ??
    raw?.taskName ??
    "UNKNOWN";

  const meta = GAME_META?.[normalizedGameId] || {
    gameId: normalizedGameId,
    gameName: raw?.gameName ?? raw?.taskName ?? normalizedGameId,
    abilityType: raw?.abilityType ?? "unknown",
    abilityLabel: raw?.abilityLabel ?? "未分類",
  };

  const trials = normalizeTrials(raw);

  const totalTrials = safeNumber(
    raw?.totalTrials ?? raw?.totalQuestions ?? raw?.trialCount ?? trials.length,
    trials.length
  );

  const correctCount = safeNumber(
    raw?.correctCount ??
      raw?.correct ??
      raw?.performance?.correctCount ??
      trials.filter((trial) => trial?.correct || trial?.isCorrect).length,
    0
  );

  const errorCount = safeNumber(
    raw?.errorCount ??
      raw?.totalErrors ??
      raw?.errorAnalysis?.totalErrors ??
      Math.max(totalTrials - correctCount, 0),
    0
  );

  const accuracy =
    raw?.accuracy ??
    raw?.performance?.accuracy ??
    (totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0);

  const avgReactionTime =
    raw?.avgReactionTime ??
    raw?.avgRt ??
    raw?.averageRt ??
    raw?.scoring?.avgReactionTime ??
    raw?.performance?.avgReactionTime ??
    raw?.performance?.avgRt ??
    0;

  const createdAt = safeDateString(
    raw?.createdAt ?? raw?.generatedAt ?? raw?.finishedAt ?? raw?.endTime,
    new Date().toISOString()
  );

  const startedAt = safeDateString(raw?.startedAt ?? raw?.startTime, null);

  const finishedAt = safeDateString(
    raw?.finishedAt ?? raw?.endTime ?? raw?.generatedAt ?? raw?.createdAt,
    createdAt
  );

  const normalized = {
    schemaVersion: RESULT_VERSION,
    createdAt,

    resultId:
      raw?.resultId ||
      createResultId({
        gameId: meta?.gameId,
        mode: raw?.mode || mode,
        childId: currentChild?.childId || currentChild?.id || raw?.childId,
      }),

    child: {
      childId: currentChild?.childId || currentChild?.id || raw?.childId || null,
      name: currentChild?.name || currentChild?.nickname || raw?.childName || "",
      age: raw?.childAge ?? currentChild?.age ?? null,
      gender: currentChild?.gender || raw?.childGender || null,
    },

    game: {
      gameId: meta?.gameId || normalizedGameId,
      gameName: raw?.gameName || meta?.gameName || normalizedGameId,
      abilityType: raw?.abilityType || meta?.abilityType || "unknown",
      abilityLabel: raw?.abilityLabel || meta?.abilityLabel || "未分類",
    },

    session: {
      mode: raw?.mode || mode,
      difficulty: raw?.difficulty || difficulty || "default",
      startedAt,
      finishedAt,
      totalPlayTime: safeNumber(
        raw?.totalPlayTime ?? raw?.duration ?? raw?.playTime,
        0
      ),
      route,
    },

    summary: {
      score: safeNumber(
        raw?.score ?? raw?.performance?.score ?? raw?.scoring?.score,
        0
      ),
      stars: safeNumber(
        raw?.stars ?? raw?.performance?.stars ?? raw?.scoring?.stars,
        0
      ),
      accuracy: safeNumber(accuracy, 0),
      avgReactionTime: safeNumber(avgReactionTime, 0),
      totalTrials: safeNumber(totalTrials, 0),
      correctCount: safeNumber(correctCount, 0),
      errorCount: safeNumber(errorCount, 0),
      performanceLevel:
        raw?.performanceLevel || raw?.performance?.performanceLevel || raw?.level || null,
    },

    metrics: {
      reactionTimes: safeArray(raw?.reactionTimes),
      errorTypes: safeObject(
        raw?.errorTypes ?? raw?.errorAnalysis?.errorTypes ?? raw?.scoring?.errorTypes
      ),
      fatigueLevel: raw?.fatigueLevel || raw?.aiAnalysis?.fatigueLevel || null,
      recommendedDifficulty:
        raw?.recommendedDifficulty || raw?.aiSummary?.recommendedDifficulty || null,
      abilityScores: safeObject(raw?.abilityScores ?? raw?.radarScores ?? raw?.radar),
    },

    ai: {
      parentSummary:
        raw?.parentSummary ||
        raw?.performance?.parentSummary ||
        raw?.aiAnalysis?.parentSummary ||
        "",
      suggestedAction:
        raw?.suggestedAction ||
        raw?.performance?.suggestedAction ||
        raw?.aiAnalysis?.suggestedAction ||
        "",
      aiSummary: raw?.aiSummary || raw?.aiAnalysis || null,
      warningLevel: raw?.warningLevel || raw?.errorAnalysis?.warningLevel || null,
    },

    visibility: {
      visibleRoles: normalizeVisibleRoles(
        raw?.visibleRoles || raw?.visibleResultRoles || visibleRoles
      ),
      hideMedicalResult: raw?.hideMedicalResult ?? true,
    },

    behavioral: {
      sessionId: raw?.behavioral?.sessionId || createBehavioralId(),
      taskSessionId: raw?.behavioral?.taskSessionId || createBehavioralId(),
      trialIds: trials.map((_, index) => raw?.behavioral?.trialIds?.[index] || createBehavioralId()),
    },

    trials,
    rawResult: raw,
  };

  return sanitizeForStorage(normalized);
};

export const saveUnifiedResult = ({
  rawResult = {},
  gameId,
  mode = "test",
  difficulty = null,
  child = null,
  route = null,
  visibleRoles = ["child", "parent"],
  saveLegacy = true,
} = {}) => {
  const normalized = normalizeGameResult({
    rawResult,
    gameId,
    mode,
    difficulty,
    child,
    route,
    visibleRoles,
  });

  if (typeof window === "undefined") return normalized;

  const legacyKey = getLegacyResultKey(
    normalized?.game?.gameId,
    normalized?.session?.mode
  );

  const childScopedLatestKey = getChildScopedResultKey(
    normalized?.game?.gameId,
    normalized?.session?.mode || mode,
    normalized?.child?.childId
  );

  const unifiedLatestKey = `result:${normalized?.game?.gameId || "UNKNOWN"}:${
    normalized?.session?.mode || mode
  }`;

  try {
    const safeRawResult = sanitizeForStorage(rawResult);

    if (normalized?.session?.mode === "training") {
      const reward = awardTrainingCoins({
        resultId: normalized.resultId,
        stars: normalized.summary?.stars,
        difficulty: normalized.session?.difficulty,
        childId: normalized.child?.childId || "default",
      });
      normalized.reward = {
        coins: reward.awarded ? reward.amount : 0,
        coinBalance: reward.economy?.coins || 0,
        awarded: reward.awarded,
      };
    }

    window.localStorage?.setItem(unifiedLatestKey, JSON.stringify(normalized));
    window.sessionStorage?.setItem(unifiedLatestKey, JSON.stringify(normalized));
    window.localStorage?.setItem(childScopedLatestKey, JSON.stringify(normalized));
    window.sessionStorage?.setItem(childScopedLatestKey, JSON.stringify(normalized));

    if (saveLegacy) {
      window.localStorage?.setItem(legacyKey, JSON.stringify(safeRawResult));
    }

    const allResults = safeArray(
      safeParse(window.localStorage?.getItem(ALL_RESULTS_KEY), [])
    );

    const nextResults = [normalized, ...allResults]
      .map((item) => sanitizeForStorage(item))
      .filter((item) => item?.resultId)
      .filter((item, index, array) => {
        return (
          array.findIndex(
            (candidate) => candidate?.resultId === item?.resultId
          ) === index
        );
      })
      .sort((a, b) => getResultTimestamp(b) - getResultTimestamp(a))
      .slice(0, MAX_LOCAL_RESULTS);

    window.localStorage?.setItem(ALL_RESULTS_KEY, JSON.stringify(nextResults));

    // 雲端同步：不阻塞遊戲流程。若 Supabase 尚未設定或離線，仍保留 localStorage 結果。
    saveGameResultToCloud(normalized).catch((cloudError) => {
      console.warn("Supabase 結果同步失敗，已保留本機紀錄：", cloudError);
    });
    if (normalized?.session?.mode === "training") {
      completeActiveRecommendation(normalized).catch((recommendationError) => {
        console.warn("Adaptive recommendation outcome sync failed:", recommendationError);
      });
    }
  } catch (error) {
    console.warn("統一結果資料儲存失敗：", error);
  }

  return normalized;
};

export const getUnifiedResult = ({ gameId, mode = "test", childId = null, fallback = null } = {}) => {
  if (typeof window === "undefined") return fallback;

  const key = `result:${gameId}:${mode}`;
  const currentChild = getCurrentChild();
  const resolvedChildId = childId || currentChild?.childId || currentChild?.id || null;
  const childKey = resolvedChildId
    ? getChildScopedResultKey(gameId, mode, resolvedChildId)
    : null;

  const result =
    (childKey ? safeParse(window.sessionStorage?.getItem(childKey), null) : null) ||
    (childKey ? safeParse(window.localStorage?.getItem(childKey), null) : null) ||
    safeParse(window.sessionStorage?.getItem(key), null) ||
    safeParse(window.localStorage?.getItem(key), fallback);

  return sanitizeForStorage(result);
};

export const getAllUnifiedResults = () => {
  if (typeof window === "undefined") return [];

  return safeArray(safeParse(window.localStorage?.getItem(ALL_RESULTS_KEY), []))
    .map((item) => sanitizeForStorage(item))
    .filter((item) => item?.resultId)
    .sort((a, b) => getResultTimestamp(b) - getResultTimestamp(a))
    .slice(0, MAX_LOCAL_RESULTS);
};

export const getResultsByChild = (childId) => {
  if (!childId) return [];

  return getAllUnifiedResults().filter((result) => {
    return result?.child?.childId === childId;
  });
};

export const getResultsByGame = (gameId, mode = null) => {
  if (!gameId) return [];

  return getAllUnifiedResults().filter((result) => {
    const sameGame = result?.game?.gameId === gameId;
    const sameMode = mode ? result?.session?.mode === mode : true;
    return sameGame && sameMode;
  });
};
