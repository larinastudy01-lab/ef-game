/**
 * hatRewardScheduler.js
 *
 * 猜帽子獎勵排程管理器
 *
 * 功能：
 * 1. 每完成 5～8 個有效訓練關卡，觸發一次帽子遊戲邀請。
 * 2. 同一個 trainingStageId 只計算一次。
 * 3. 所有資料依 childId 隔離。
 * 4. 邀請跳過、完成或取消後，重新抽取下一次 5～8 關間隔。
 * 5. 建立 pending reward session，避免直接輸入網址進入帽子遊戲。
 * 6. 防止重新整理或重複點擊造成同一關重複觸發。
 * 7. 同一 sourceStageId 不會建立多個 reward session。
 */

const HAT_SCHEDULER_VERSION = "1.0.0";

const MIN_TRIGGER_INTERVAL = 5;
const MAX_TRIGGER_INTERVAL = 8;

const STORAGE_PREFIX = "hatRewardScheduler";
const MAX_COUNTED_STAGE_IDS = 300;
const MAX_SESSION_HISTORY = 100;

export const HAT_REWARD_STATUS = Object.freeze({
  IDLE: "idle",
  INVITED: "invited",
  ACCEPTED: "accepted",
  SKIPPED: "skipped",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
});

export const HAT_SESSION_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  COMPLETED: "completed",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
});

function isBrowser() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeChildId(childId) {
  const value = normalizeString(childId);

  if (!value) {
    throw new Error("[hatRewardScheduler] childId is required.");
  }

  return value;
}

function normalizeStageId(trainingStageId) {
  const value = normalizeString(trainingStageId);

  if (!value) {
    throw new Error(
      "[hatRewardScheduler] trainingStageId is required."
    );
  }

  return value;
}

function clampInteger(value, min, max, fallback = min) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function safeJsonParse(value, fallback = null) {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn(
      "[hatRewardScheduler] Failed to parse stored data:",
      error
    );
    return fallback;
  }
}

function createId(prefix = "hat") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return [
    prefix,
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join("_");
}

function nowIso() {
  return new Date().toISOString();
}

function getRandomInteger(min, max, randomFn = Math.random) {
  const safeMin = Math.ceil(min);
  const safeMax = Math.floor(max);

  const randomValue = Number(randomFn());

  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(0.999999999, Math.max(0, randomValue))
    : Math.random();

  return Math.floor(
    normalizedRandom * (safeMax - safeMin + 1) + safeMin
  );
}

/**
 * 隨機抽取下一次帽子邀請間隔。
 *
 * @returns {5|6|7|8}
 */
export function drawNextHatInterval(randomFn = Math.random) {
  return getRandomInteger(
    MIN_TRIGGER_INTERVAL,
    MAX_TRIGGER_INTERVAL,
    randomFn
  );
}

function getStorageKey(childId) {
  return `${STORAGE_PREFIX}_${encodeURIComponent(childId)}`;
}

function createDefaultSchedule(childId, randomFn = Math.random) {
  const timestamp = nowIso();

  return {
    schemaVersion: HAT_SCHEDULER_VERSION,
    childId,
    interval: drawNextHatInterval(randomFn),
    completedStageCount: 0,

    countedStageIds: [],
    sessionHistory: [],

    pendingSession: null,

    status: HAT_REWARD_STATUS.IDLE,

    createdAt: timestamp,
    updatedAt: timestamp,
    lastCountedAt: null,
    lastCountedStageId: null,
    lastTriggeredAt: null,
    lastTriggeredStageId: null,
    lastResolvedAt: null,
  };
}

function normalizeSession(rawSession, childId) {
  if (!rawSession || typeof rawSession !== "object") {
    return null;
  }

  const sessionId = normalizeString(rawSession.sessionId);
  const sourceStageId = normalizeString(rawSession.sourceStageId);

  if (!sessionId || !sourceStageId) {
    return null;
  }

  const allowedStatuses = Object.values(HAT_SESSION_STATUS);

  return {
    sessionId,
    childId,
    sourceStageId,

    status: allowedStatuses.includes(rawSession.status)
      ? rawSession.status
      : HAT_SESSION_STATUS.PENDING,

    claimed: Boolean(rawSession.claimed),
    rewardGranted: Boolean(rawSession.rewardGranted),

    currentRound: clampInteger(rawSession.currentRound, 0, 5, 0),
    maxRounds: clampInteger(rawSession.maxRounds, 1, 5, 5),

    createdAt: rawSession.createdAt || nowIso(),
    acceptedAt: rawSession.acceptedAt || null,
    completedAt: rawSession.completedAt || null,
    skippedAt: rawSession.skippedAt || null,
    cancelledAt: rawSession.cancelledAt || null,
    expiredAt: rawSession.expiredAt || null,
    claimedAt: rawSession.claimedAt || null,

    metadata:
      rawSession.metadata &&
      typeof rawSession.metadata === "object" &&
      !Array.isArray(rawSession.metadata)
        ? rawSession.metadata
        : {},
  };
}

function normalizeSchedule(rawSchedule, childId, randomFn = Math.random) {
  const fallback = createDefaultSchedule(childId, randomFn);

  if (!rawSchedule || typeof rawSchedule !== "object") {
    return fallback;
  }

  if (
    rawSchedule.childId &&
    normalizeString(rawSchedule.childId) !== childId
  ) {
    return fallback;
  }

  const countedStageIds = Array.isArray(rawSchedule.countedStageIds)
    ? [
        ...new Set(
          rawSchedule.countedStageIds
            .map(normalizeString)
            .filter(Boolean)
        ),
      ].slice(-MAX_COUNTED_STAGE_IDS)
    : [];

  const sessionHistory = Array.isArray(rawSchedule.sessionHistory)
    ? rawSchedule.sessionHistory
        .map((session) => normalizeSession(session, childId))
        .filter(Boolean)
        .slice(-MAX_SESSION_HISTORY)
    : [];

  const pendingSession = normalizeSession(
    rawSchedule.pendingSession,
    childId
  );

  return {
    ...fallback,
    ...rawSchedule,

    schemaVersion: HAT_SCHEDULER_VERSION,
    childId,

    interval: clampInteger(
      rawSchedule.interval,
      MIN_TRIGGER_INTERVAL,
      MAX_TRIGGER_INTERVAL,
      fallback.interval
    ),

    completedStageCount: Math.max(
      0,
      clampInteger(
        rawSchedule.completedStageCount,
        0,
        Number.MAX_SAFE_INTEGER,
        0
      )
    ),

    countedStageIds,
    sessionHistory,
    pendingSession,

    status: pendingSession
      ? pendingSession.status === HAT_SESSION_STATUS.ACTIVE
        ? HAT_REWARD_STATUS.ACCEPTED
        : HAT_REWARD_STATUS.INVITED
      : HAT_REWARD_STATUS.IDLE,

    createdAt: rawSchedule.createdAt || fallback.createdAt,
    updatedAt: rawSchedule.updatedAt || fallback.updatedAt,
  };
}

function saveSchedule(schedule) {
  if (!isBrowser()) {
    return schedule;
  }

  const childId = normalizeChildId(schedule.childId);
  const normalized = normalizeSchedule(schedule, childId);

  normalized.updatedAt = nowIso();

  try {
    window.localStorage.setItem(
      getStorageKey(childId),
      JSON.stringify(normalized)
    );
  } catch (error) {
    console.error(
      "[hatRewardScheduler] Failed to save schedule:",
      error
    );
  }

  return normalized;
}

/**
 * 取得兒童目前的帽子排程。
 */
export function getHatRewardSchedule(
  childId,
  options = {}
) {
  const normalizedChildId = normalizeChildId(childId);
  const randomFn = options.randomFn || Math.random;

  if (!isBrowser()) {
    return createDefaultSchedule(normalizedChildId, randomFn);
  }

  const rawValue = window.localStorage.getItem(
    getStorageKey(normalizedChildId)
  );

  const parsed = safeJsonParse(rawValue, null);

  return normalizeSchedule(parsed, normalizedChildId, randomFn);
}

/**
 * 若兒童尚未建立排程，建立一份初始排程。
 */
export function initializeHatRewardSchedule(
  childId,
  options = {}
) {
  const schedule = getHatRewardSchedule(childId, options);
  return saveSchedule(schedule);
}

function hasSessionForSourceStage(schedule, sourceStageId) {
  if (
    schedule.pendingSession?.sourceStageId === sourceStageId
  ) {
    return true;
  }

  return schedule.sessionHistory.some(
    (session) => session.sourceStageId === sourceStageId
  );
}

function createPendingSession({
  childId,
  sourceStageId,
  metadata = {},
}) {
  return {
    sessionId: createId("hat_reward"),
    childId,
    sourceStageId,

    status: HAT_SESSION_STATUS.PENDING,

    claimed: false,
    rewardGranted: false,

    currentRound: 0,
    maxRounds: 5,

    createdAt: nowIso(),
    acceptedAt: null,
    completedAt: null,
    skippedAt: null,
    cancelledAt: null,
    expiredAt: null,
    claimedAt: null,

    metadata:
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata)
        ? metadata
        : {},
  };
}

/**
 * 登記一個已完成的有效訓練關卡。
 *
 * 注意：
 * - 必須只在「有效完成」後呼叫。
 * - 同一 trainingStageId 重複呼叫不會再次增加計數。
 * - 若目前已有 pending 帽子邀請，不會繼續累積下一次邀請。
 *
 * @returns {{
 *   counted: boolean,
 *   triggered: boolean,
 *   reason: string,
 *   schedule: object,
 *   session: object|null,
 *   progress: {
 *     current: number,
 *     target: number,
 *     remaining: number
 *   }
 * }}
 */
export function registerCompletedTrainingStage({
  childId,
  trainingStageId,
  isValid = true,
  metadata = {},
  randomFn = Math.random,
}) {
  const normalizedChildId = normalizeChildId(childId);
  const normalizedStageId = normalizeStageId(trainingStageId);

  let schedule = getHatRewardSchedule(normalizedChildId, {
    randomFn,
  });

  if (!isValid) {
    return {
      counted: false,
      triggered: false,
      reason: "invalid_training_stage",
      schedule,
      session: schedule.pendingSession,
      progress: getScheduleProgress(schedule),
    };
  }

  if (schedule.countedStageIds.includes(normalizedStageId)) {
    return {
      counted: false,
      triggered: false,
      reason: "stage_already_counted",
      schedule,
      session: schedule.pendingSession,
      progress: getScheduleProgress(schedule),
    };
  }

  if (schedule.pendingSession) {
    return {
      counted: false,
      triggered: false,
      reason: "pending_session_exists",
      schedule,
      session: schedule.pendingSession,
      progress: getScheduleProgress(schedule),
    };
  }

  const countedStageIds = [
    ...schedule.countedStageIds,
    normalizedStageId,
  ].slice(-MAX_COUNTED_STAGE_IDS);

  schedule = {
    ...schedule,
    countedStageIds,
    completedStageCount: schedule.completedStageCount + 1,
    lastCountedStageId: normalizedStageId,
    lastCountedAt: nowIso(),
  };

  const shouldTrigger =
    schedule.completedStageCount >= schedule.interval;

  if (!shouldTrigger) {
    schedule.status = HAT_REWARD_STATUS.IDLE;
    schedule = saveSchedule(schedule);

    return {
      counted: true,
      triggered: false,
      reason: "progress_recorded",
      schedule,
      session: null,
      progress: getScheduleProgress(schedule),
    };
  }

  if (hasSessionForSourceStage(schedule, normalizedStageId)) {
    schedule = saveSchedule(schedule);

    return {
      counted: true,
      triggered: false,
      reason: "source_stage_session_already_exists",
      schedule,
      session: schedule.pendingSession,
      progress: getScheduleProgress(schedule),
    };
  }

  const pendingSession = createPendingSession({
    childId: normalizedChildId,
    sourceStageId: normalizedStageId,
    metadata,
  });

  schedule = {
    ...schedule,
    pendingSession,
    status: HAT_REWARD_STATUS.INVITED,
    lastTriggeredAt: nowIso(),
    lastTriggeredStageId: normalizedStageId,
  };

  schedule = saveSchedule(schedule);

  return {
    counted: true,
    triggered: true,
    reason: "hat_reward_triggered",
    schedule,
    session: pendingSession,
    progress: getScheduleProgress(schedule),
  };
}

/**
 * 取得目前排程進度。
 */
export function getScheduleProgress(scheduleOrChildId) {
  const schedule =
    typeof scheduleOrChildId === "string"
      ? getHatRewardSchedule(scheduleOrChildId)
      : scheduleOrChildId;

  const current = Math.max(
    0,
    Number(schedule?.completedStageCount) || 0
  );

  const target = clampInteger(
    schedule?.interval,
    MIN_TRIGGER_INTERVAL,
    MAX_TRIGGER_INTERVAL,
    MIN_TRIGGER_INTERVAL
  );

  return {
    current,
    target,
    remaining: Math.max(0, target - current),
    percentage: Math.min(
      100,
      Math.round((current / target) * 100)
    ),
  };
}

/**
 * 取得尚未處理的帽子 session。
 */
export function getPendingHatRewardSession(childId) {
  const schedule = getHatRewardSchedule(childId);

  if (!schedule.pendingSession) {
    return null;
  }

  const allowedStatuses = [
    HAT_SESSION_STATUS.PENDING,
    HAT_SESSION_STATUS.ACTIVE,
  ];

  if (
    !allowedStatuses.includes(schedule.pendingSession.status)
  ) {
    return null;
  }

  return schedule.pendingSession;
}

/**
 * 確認 session 是否為目前有效的 pending session。
 */
export function validatePendingHatSession({
  childId,
  sessionId,
}) {
  const normalizedChildId = normalizeChildId(childId);
  const normalizedSessionId = normalizeString(sessionId);

  if (!normalizedSessionId) {
    return {
      valid: false,
      reason: "missing_session_id",
      session: null,
    };
  }

  const session =
    getPendingHatRewardSession(normalizedChildId);

  if (!session) {
    return {
      valid: false,
      reason: "no_pending_session",
      session: null,
    };
  }

  if (session.sessionId !== normalizedSessionId) {
    return {
      valid: false,
      reason: "session_id_mismatch",
      session: null,
    };
  }

  if (session.childId !== normalizedChildId) {
    return {
      valid: false,
      reason: "child_id_mismatch",
      session: null,
    };
  }

  return {
    valid: true,
    reason: "valid",
    session,
  };
}

/**
 * 接受帽子遊戲邀請。
 */
export function acceptHatRewardInvite({
  childId,
  sessionId,
}) {
  const normalizedChildId = normalizeChildId(childId);
  const validation = validatePendingHatSession({
    childId: normalizedChildId,
    sessionId,
  });

  if (!validation.valid) {
    return {
      success: false,
      reason: validation.reason,
      session: null,
      schedule: getHatRewardSchedule(normalizedChildId),
    };
  }

  let schedule = getHatRewardSchedule(normalizedChildId);

  const acceptedAt =
    schedule.pendingSession.acceptedAt || nowIso();

  const pendingSession = {
    ...schedule.pendingSession,
    status: HAT_SESSION_STATUS.ACTIVE,
    acceptedAt,
  };

  schedule = {
    ...schedule,
    pendingSession,
    status: HAT_REWARD_STATUS.ACCEPTED,
  };

  schedule = saveSchedule(schedule);

  return {
    success: true,
    reason: "invite_accepted",
    session: pendingSession,
    schedule,
  };
}

function resolvePendingSession({
  childId,
  sessionId,
  sessionStatus,
  scheduleStatus,
  resolvedField,
  randomFn = Math.random,
  extraSessionData = {},
}) {
  const normalizedChildId = normalizeChildId(childId);

  const validation = validatePendingHatSession({
    childId: normalizedChildId,
    sessionId,
  });

  if (!validation.valid) {
    return {
      success: false,
      reason: validation.reason,
      resolvedSession: null,
      schedule: getHatRewardSchedule(normalizedChildId),
    };
  }

  let schedule = getHatRewardSchedule(normalizedChildId);

  const resolvedAt = nowIso();

  const resolvedSession = {
    ...schedule.pendingSession,
    ...extraSessionData,
    status: sessionStatus,
    [resolvedField]: resolvedAt,
  };

  const sessionHistory = [
    ...schedule.sessionHistory,
    resolvedSession,
  ].slice(-MAX_SESSION_HISTORY);

  schedule = {
    ...schedule,

    interval: drawNextHatInterval(randomFn),
    completedStageCount: 0,

    pendingSession: null,
    sessionHistory,

    status: scheduleStatus,
    lastResolvedAt: resolvedAt,
  };

  schedule = saveSchedule(schedule);

  return {
    success: true,
    reason: sessionStatus,
    resolvedSession,
    schedule,
    progress: getScheduleProgress(schedule),
  };
}

/**
 * 跳過帽子遊戲邀請。
 *
 * 跳過後：
 * - 不扣星星
 * - 不扣經驗
 * - 不影響訓練路徑
 * - 重新抽取下一次 5～8 關間隔
 */
export function skipHatRewardInvite({
  childId,
  sessionId,
  randomFn = Math.random,
}) {
  return resolvePendingSession({
    childId,
    sessionId,
    sessionStatus: HAT_SESSION_STATUS.SKIPPED,
    scheduleStatus: HAT_REWARD_STATUS.SKIPPED,
    resolvedField: "skippedAt",
    randomFn,
  });
}

/**
 * 完成帽子遊戲。
 *
 * rewardGranted 只表示此 session 是否已完成貼紙發放。
 * 真正的貼紙數量與防重複發放，仍建議交給 stickerManager.js。
 */
export function completeHatRewardSession({
  childId,
  sessionId,
  currentRound = 1,
  rewardGranted = true,
  metadata = {},
  randomFn = Math.random,
}) {
  return resolvePendingSession({
    childId,
    sessionId,
    sessionStatus: HAT_SESSION_STATUS.COMPLETED,
    scheduleStatus: HAT_REWARD_STATUS.COMPLETED,
    resolvedField: "completedAt",
    randomFn,
    extraSessionData: {
      currentRound: clampInteger(currentRound, 0, 5, 1),
      rewardGranted: Boolean(rewardGranted),
      metadata:
        metadata &&
        typeof metadata === "object" &&
        !Array.isArray(metadata)
          ? metadata
          : {},
    },
  });
}

/**
 * 取消帽子遊戲。
 *
 * 適合玩家進入帽子頁後主動返回地圖。
 */
export function cancelHatRewardSession({
  childId,
  sessionId,
  reason = "user_cancelled",
  randomFn = Math.random,
}) {
  return resolvePendingSession({
    childId,
    sessionId,
    sessionStatus: HAT_SESSION_STATUS.CANCELLED,
    scheduleStatus: HAT_REWARD_STATUS.CANCELLED,
    resolvedField: "cancelledAt",
    randomFn,
    extraSessionData: {
      metadata: {
        cancelReason: normalizeString(reason) || "user_cancelled",
      },
    },
  });
}

/**
 * 更新目前帽子遊戲進行到第幾輪。
 */
export function updateHatSessionRound({
  childId,
  sessionId,
  currentRound,
}) {
  const normalizedChildId = normalizeChildId(childId);

  const validation = validatePendingHatSession({
    childId: normalizedChildId,
    sessionId,
  });

  if (!validation.valid) {
    return {
      success: false,
      reason: validation.reason,
      session: null,
      schedule: getHatRewardSchedule(normalizedChildId),
    };
  }

  let schedule = getHatRewardSchedule(normalizedChildId);

  const session = {
    ...schedule.pendingSession,
    status: HAT_SESSION_STATUS.ACTIVE,
    acceptedAt:
      schedule.pendingSession.acceptedAt || nowIso(),
    currentRound: clampInteger(currentRound, 0, 5, 0),
  };

  schedule = {
    ...schedule,
    pendingSession: session,
    status: HAT_REWARD_STATUS.ACCEPTED,
  };

  schedule = saveSchedule(schedule);

  return {
    success: true,
    reason: "round_updated",
    session,
    schedule,
  };
}

/**
 * 標記帽子 session 的獎勵已領取。
 *
 * 此函式主要提供前端 localStorage 防重複。
 * 若有 Supabase，仍建議在資料庫將 session_id 設為 unique，
 * 並使用 transaction/RPC 發放貼紙。
 */
export function markHatRewardClaimed({
  childId,
  sessionId,
}) {
  const normalizedChildId = normalizeChildId(childId);

  const validation = validatePendingHatSession({
    childId: normalizedChildId,
    sessionId,
  });

  if (!validation.valid) {
    return {
      success: false,
      reason: validation.reason,
      alreadyClaimed: false,
      session: null,
      schedule: getHatRewardSchedule(normalizedChildId),
    };
  }

  let schedule = getHatRewardSchedule(normalizedChildId);

  if (schedule.pendingSession.claimed) {
    return {
      success: true,
      reason: "already_claimed",
      alreadyClaimed: true,
      session: schedule.pendingSession,
      schedule,
    };
  }

  const session = {
    ...schedule.pendingSession,
    claimed: true,
    rewardGranted: true,
    claimedAt: nowIso(),
  };

  schedule = {
    ...schedule,
    pendingSession: session,
  };

  schedule = saveSchedule(schedule);

  return {
    success: true,
    reason: "reward_claimed",
    alreadyClaimed: false,
    session,
    schedule,
  };
}

/**
 * 查詢指定 session 是否已領取。
 */
export function isHatRewardClaimed({
  childId,
  sessionId,
}) {
  const normalizedChildId = normalizeChildId(childId);
  const normalizedSessionId = normalizeString(sessionId);

  if (!normalizedSessionId) return false;

  const schedule = getHatRewardSchedule(normalizedChildId);

  if (
    schedule.pendingSession?.sessionId === normalizedSessionId
  ) {
    return Boolean(schedule.pendingSession.claimed);
  }

  const historicalSession = schedule.sessionHistory.find(
    (session) => session.sessionId === normalizedSessionId
  );

  return Boolean(historicalSession?.claimed);
}

/**
 * 取得指定 session。
 *
 * 會先找 pendingSession，再找歷史紀錄。
 */
export function getHatRewardSession({
  childId,
  sessionId,
}) {
  const normalizedChildId = normalizeChildId(childId);
  const normalizedSessionId = normalizeString(sessionId);

  if (!normalizedSessionId) {
    return null;
  }

  const schedule = getHatRewardSchedule(normalizedChildId);

  if (
    schedule.pendingSession?.sessionId === normalizedSessionId
  ) {
    return schedule.pendingSession;
  }

  return (
    schedule.sessionHistory.find(
      (session) => session.sessionId === normalizedSessionId
    ) || null
  );
}

/**
 * 強制清除過期或損壞的 pending session。
 *
 * 一般遊戲流程不需要呼叫。
 */
export function expirePendingHatSession({
  childId,
  sessionId,
  randomFn = Math.random,
}) {
  return resolvePendingSession({
    childId,
    sessionId,
    sessionStatus: HAT_SESSION_STATUS.EXPIRED,
    scheduleStatus: HAT_REWARD_STATUS.EXPIRED,
    resolvedField: "expiredAt",
    randomFn,
  });
}

/**
 * 重設目前兒童的帽子排程。
 *
 * 預設會保留 countedStageIds，避免重設後舊關卡再次被計數。
 */
export function resetHatRewardSchedule(
  childId,
  options = {}
) {
  const normalizedChildId = normalizeChildId(childId);
  const {
    preserveCountedStageIds = true,
    preserveSessionHistory = true,
    randomFn = Math.random,
  } = options;

  const previous = getHatRewardSchedule(normalizedChildId, {
    randomFn,
  });

  const next = createDefaultSchedule(
    normalizedChildId,
    randomFn
  );

  if (preserveCountedStageIds) {
    next.countedStageIds = previous.countedStageIds;
  }

  if (preserveSessionHistory) {
    next.sessionHistory = previous.sessionHistory;
  }

  return saveSchedule(next);
}

/**
 * 完全刪除指定兒童的帽子排程。
 *
 * 建議只在刪除兒童資料時使用。
 */
export function removeHatRewardSchedule(childId) {
  const normalizedChildId = normalizeChildId(childId);

  if (!isBrowser()) {
    return false;
  }

  try {
    window.localStorage.removeItem(
      getStorageKey(normalizedChildId)
    );

    return true;
  } catch (error) {
    console.error(
      "[hatRewardScheduler] Failed to remove schedule:",
      error
    );

    return false;
  }
}

/**
 * 取得可供 ResultPage 使用的帽子邀請資料。
 */
export function getHatInviteViewModel(childId) {
  const schedule = getHatRewardSchedule(childId);
  const session = getPendingHatRewardSession(childId);

  return {
    shouldShowInvite:
      Boolean(session) &&
      session.status === HAT_SESSION_STATUS.PENDING,

    sessionId: session?.sessionId || null,
    sourceStageId: session?.sourceStageId || null,

    title: "神祕帽子來了，要去找貼紙嗎？",
    acceptText: "我要猜貼紙",
    skipText: "先去下一關",

    progress: getScheduleProgress(schedule),
  };
}

export default {
  initializeHatRewardSchedule,
  getHatRewardSchedule,
  registerCompletedTrainingStage,

  getScheduleProgress,
  getPendingHatRewardSession,
  getHatRewardSession,
  getHatInviteViewModel,

  validatePendingHatSession,
  acceptHatRewardInvite,
  skipHatRewardInvite,
  completeHatRewardSession,
  cancelHatRewardSession,
  expirePendingHatSession,

  updateHatSessionRound,
  markHatRewardClaimed,
  isHatRewardClaimed,

  resetHatRewardSchedule,
  removeHatRewardSchedule,

  drawNextHatInterval,

  HAT_REWARD_STATUS,
  HAT_SESSION_STATUS,
};