// src/utils/stickerManager.js

import {
  STICKER_CONFIG,
  getStickerById,
} from "../config/stickerConfig";

/**
 * stickerManager.js
 *
 * 功能：
 * 1. 依 childId 隔離貼紙收藏
 * 2. 帽子遊戲貼紙可保留重複數量
 * 3. 成就貼紙每個 achievementId + stage 只能發放一次
 * 4. 三張普通貼紙可合成固定稀有貼紙
 * 5. 三張稀有貼紙可合成固定特別貼紙
 * 6. 帽子 rewardSessionId 防止重新整理後重複領取
 * 7. 所有 localStorage 讀寫皆有錯誤保護
 */

export const STICKER_MANAGER_VERSION = "1.0.0";

export const STICKER_RARITY = Object.freeze({
  COMMON: "common",
  RARE: "rare",
  SPECIAL: "special",
  ACHIEVEMENT: "achievement",
});

export const STICKER_SOURCE = Object.freeze({
  HAT_GAME: "hat_game",
  ACHIEVEMENT: "achievement",
  FUSION: "fusion",
  SYSTEM: "system",
});

export const FUSION_REQUIREMENT = Object.freeze({
  common: 3,
  rare: 3,
});

const STORAGE_PREFIX = "childStickerCollection";
const MAX_HISTORY_LENGTH = 300;
const MAX_PROCESSED_SESSION_LENGTH = 300;
const MAX_ACHIEVEMENT_CLAIM_LENGTH = 500;

/* -------------------------------------------------------------------------- */
/*                              基礎工具函式                                    */
/* -------------------------------------------------------------------------- */

function isBrowser() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = "sticker") {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeCount(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return Math.max(0, Math.floor(fallback));
  }

  return Math.max(0, Math.floor(numericValue));
}

function safeJsonParse(value, fallback) {
  if (!value || typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("[stickerManager] JSON 解析失敗：", error);
    return fallback;
  }
}

function uniqueStrings(values, maxLength = 300) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map(normalizeString)
        .filter(Boolean)
    )
  );

  return normalized.slice(-maxLength);
}

function assertChildId(childId) {
  const normalizedChildId = normalizeString(childId);

  if (!normalizedChildId) {
    throw new Error("stickerManager：缺少有效的 childId。");
  }

  return normalizedChildId;
}

function assertStickerId(stickerId) {
  const normalizedStickerId = normalizeString(stickerId);

  if (!normalizedStickerId) {
    throw new Error("stickerManager：缺少有效的 stickerId。");
  }

  return normalizedStickerId;
}

function getStorageKey(childId) {
  return `${STORAGE_PREFIX}_${encodeURIComponent(assertChildId(childId))}`;
}

function cloneData(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // 使用 JSON 備援
    }
  }

  return safeJsonParse(JSON.stringify(value), value);
}

function dispatchStickerEvent(eventName, detail) {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function" ||
    typeof CustomEvent !== "function"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: cloneData(detail),
    })
  );
}

/* -------------------------------------------------------------------------- */
/*                            stickerConfig 相容讀取                            */
/* -------------------------------------------------------------------------- */

function flattenStickerConfig(config) {
  if (!config) return [];

  if (Array.isArray(config)) {
    return config.flatMap((item) => {
      if (!item) return [];
      if (Array.isArray(item)) return flattenStickerConfig(item);
      return [item];
    });
  }

  if (typeof config !== "object") {
    return [];
  }

  return Object.values(config).flatMap((value) => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return flattenStickerConfig(value);
    }

    if (
      typeof value === "object" &&
      ("id" in value || "stickerId" in value)
    ) {
      return [value];
    }

    if (typeof value === "object") {
      return flattenStickerConfig(value);
    }

    return [];
  });
}

function resolveSticker(stickerId) {
  const normalizedStickerId = assertStickerId(stickerId);

  if (typeof getStickerById === "function") {
    try {
      const sticker = getStickerById(normalizedStickerId);
      if (sticker) return sticker;
    } catch (error) {
      console.warn("[stickerManager] getStickerById 執行失敗：", error);
    }
  }

  const allStickers = flattenStickerConfig(STICKER_CONFIG);

  return (
    allStickers.find((sticker) => {
      const configId = normalizeString(
        sticker?.id ?? sticker?.stickerId
      );

      return configId === normalizedStickerId;
    }) || null
  );
}

function normalizeRarity(value) {
  const rarity = normalizeString(value).toLowerCase();

  if (Object.values(STICKER_RARITY).includes(rarity)) {
    return rarity;
  }

  return STICKER_RARITY.COMMON;
}

function getStickerRarity(sticker) {
  if (!sticker) return STICKER_RARITY.COMMON;

  if (sticker.isAchievement === true) {
    return STICKER_RARITY.ACHIEVEMENT;
  }

  return normalizeRarity(
    sticker.rarity ??
      sticker.type ??
      sticker.category ??
      STICKER_RARITY.COMMON
  );
}

function getFusionTargetId(sticker) {
  if (!sticker) return "";

  return normalizeString(
    sticker.fusionTargetId ??
      sticker.fusionTarget ??
      sticker.mergeTargetId ??
      sticker.evolutionTargetId ??
      sticker.upgradeTo
  );
}

function isRepeatableSticker(sticker, source) {
  const rarity = getStickerRarity(sticker);

  if (rarity === STICKER_RARITY.ACHIEVEMENT) {
    return false;
  }

  if (source === STICKER_SOURCE.ACHIEVEMENT) {
    return false;
  }

  if (typeof sticker?.repeatable === "boolean") {
    return sticker.repeatable;
  }

  // 規格中只有帽子遊戲的一般收藏貼紙允許重複。
  return (
    source === STICKER_SOURCE.HAT_GAME &&
    rarity === STICKER_RARITY.COMMON
  );
}

/* -------------------------------------------------------------------------- */
/*                              收藏資料格式                                    */
/* -------------------------------------------------------------------------- */

function createEmptyCollection(childId) {
  const timestamp = nowIso();

  return {
    schemaVersion: STICKER_MANAGER_VERSION,
    childId: assertChildId(childId),

    stickers: {},

    processedRewardSessionIds: [],
    claimedAchievementRewards: [],

    history: [],

    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeStickerEntry(stickerId, rawEntry = {}) {
  const count = normalizeCount(rawEntry.count);

  return {
    stickerId: assertStickerId(stickerId),
    count,
    firstObtainedAt:
      normalizeString(rawEntry.firstObtainedAt) || null,
    lastObtainedAt:
      normalizeString(rawEntry.lastObtainedAt) || null,
    source:
      normalizeString(rawEntry.source) || STICKER_SOURCE.SYSTEM,
  };
}

function normalizeCollection(rawData, childId) {
  const normalizedChildId = assertChildId(childId);
  const emptyCollection = createEmptyCollection(normalizedChildId);

  if (!rawData || typeof rawData !== "object") {
    return emptyCollection;
  }

  if (
    normalizeString(rawData.childId) &&
    normalizeString(rawData.childId) !== normalizedChildId
  ) {
    console.warn(
      "[stickerManager] 收藏資料 childId 不一致，已忽略舊資料。"
    );

    return emptyCollection;
  }

  const normalizedStickers = {};

  const rawStickers =
    rawData.stickers && typeof rawData.stickers === "object"
      ? rawData.stickers
      : {};

  Object.entries(rawStickers).forEach(([stickerId, entry]) => {
    const normalizedStickerId = normalizeString(stickerId);

    if (!normalizedStickerId) return;

    const normalizedEntry = normalizeStickerEntry(
      normalizedStickerId,
      entry
    );

    if (normalizedEntry.count > 0) {
      normalizedStickers[normalizedStickerId] = normalizedEntry;
    }
  });

  return {
    schemaVersion: STICKER_MANAGER_VERSION,
    childId: normalizedChildId,

    stickers: normalizedStickers,

    processedRewardSessionIds: uniqueStrings(
      rawData.processedRewardSessionIds,
      MAX_PROCESSED_SESSION_LENGTH
    ),

    claimedAchievementRewards: uniqueStrings(
      rawData.claimedAchievementRewards,
      MAX_ACHIEVEMENT_CLAIM_LENGTH
    ),

    history: Array.isArray(rawData.history)
      ? rawData.history.slice(-MAX_HISTORY_LENGTH)
      : [],

    createdAt:
      normalizeString(rawData.createdAt) ||
      emptyCollection.createdAt,

    updatedAt:
      normalizeString(rawData.updatedAt) ||
      emptyCollection.updatedAt,
  };
}

function readCollection(childId) {
  const normalizedChildId = assertChildId(childId);

  if (!isBrowser()) {
    return createEmptyCollection(normalizedChildId);
  }

  const key = getStorageKey(normalizedChildId);
  const rawValue = window.localStorage.getItem(key);
  const parsedValue = safeJsonParse(rawValue, null);

  return normalizeCollection(parsedValue, normalizedChildId);
}

function writeCollection(childId, collection) {
  const normalizedChildId = assertChildId(childId);

  const normalizedCollection = normalizeCollection(
    {
      ...collection,
      childId: normalizedChildId,
      schemaVersion: STICKER_MANAGER_VERSION,
      updatedAt: nowIso(),
    },
    normalizedChildId
  );

  normalizedCollection.updatedAt = nowIso();

  if (!isBrowser()) {
    return normalizedCollection;
  }

  try {
    window.localStorage.setItem(
      getStorageKey(normalizedChildId),
      JSON.stringify(normalizedCollection)
    );
  } catch (error) {
    console.error("[stickerManager] 收藏資料儲存失敗：", error);

    const storageError = new Error(
      "貼紙收藏暫時無法儲存，請確認瀏覽器儲存空間。"
    );

    storageError.cause = error;
    throw storageError;
  }

  dispatchStickerEvent("sticker-collection-updated", {
    childId: normalizedChildId,
    collection: normalizedCollection,
  });

  return normalizedCollection;
}

function addHistory(collection, historyItem) {
  const history = Array.isArray(collection.history)
    ? collection.history
    : [];

  return {
    ...collection,
    history: [
      ...history,
      {
        id: createId("sticker_history"),
        createdAt: nowIso(),
        ...historyItem,
      },
    ].slice(-MAX_HISTORY_LENGTH),
  };
}

function createStickerEntry(stickerId, count, source) {
  const timestamp = nowIso();

  return {
    stickerId,
    count: normalizeCount(count),
    firstObtainedAt: timestamp,
    lastObtainedAt: timestamp,
    source,
  };
}

/* -------------------------------------------------------------------------- */
/*                                查詢功能                                      */
/* -------------------------------------------------------------------------- */

export function getStickerCollection(childId) {
  return cloneData(readCollection(childId));
}

export function getStickerCount(childId, stickerId) {
  const normalizedStickerId = assertStickerId(stickerId);
  const collection = readCollection(childId);

  return normalizeCount(
    collection.stickers?.[normalizedStickerId]?.count
  );
}

export function hasSticker(childId, stickerId) {
  return getStickerCount(childId, stickerId) > 0;
}

export function getOwnedStickers(childId, options = {}) {
  const collection = readCollection(childId);

  const rarityFilter = normalizeString(options.rarity).toLowerCase();
  const sourceFilter = normalizeString(options.source).toLowerCase();

  return Object.values(collection.stickers)
    .filter((entry) => entry.count > 0)
    .map((entry) => {
      const sticker = resolveSticker(entry.stickerId);

      return {
        ...entry,
        sticker: sticker || {
          id: entry.stickerId,
          name: entry.stickerId,
          rarity: STICKER_RARITY.COMMON,
        },
        rarity: getStickerRarity(sticker),
      };
    })
    .filter((entry) => {
      if (rarityFilter && entry.rarity !== rarityFilter) {
        return false;
      }

      if (
        sourceFilter &&
        normalizeString(entry.source).toLowerCase() !== sourceFilter
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const timeA = Date.parse(a.firstObtainedAt || "") || 0;
      const timeB = Date.parse(b.firstObtainedAt || "") || 0;

      return timeB - timeA;
    });
}

export function getStickerCollectionSummary(childId) {
  const stickers = getOwnedStickers(childId);

  const summary = {
    uniqueCount: stickers.length,
    totalCount: 0,
    commonCount: 0,
    rareCount: 0,
    specialCount: 0,
    achievementCount: 0,
    craftableCount: 0,
  };

  stickers.forEach((entry) => {
    summary.totalCount += normalizeCount(entry.count);

    switch (entry.rarity) {
      case STICKER_RARITY.RARE:
        summary.rareCount += 1;
        break;

      case STICKER_RARITY.SPECIAL:
        summary.specialCount += 1;
        break;

      case STICKER_RARITY.ACHIEVEMENT:
        summary.achievementCount += 1;
        break;

      case STICKER_RARITY.COMMON:
      default:
        summary.commonCount += 1;
        break;
    }

    const craftStatus = getStickerFusionStatus(
      childId,
      entry.stickerId
    );

    if (craftStatus.canFuse) {
      summary.craftableCount += 1;
    }
  });

  return summary;
}

/* -------------------------------------------------------------------------- */
/*                                發放貼紙                                      */
/* -------------------------------------------------------------------------- */

export function grantSticker({
  childId,
  stickerId,
  quantity = 1,
  source = STICKER_SOURCE.SYSTEM,
  rewardSessionId = null,
  achievementId = null,
  achievementStage = null,
  metadata = {},
}) {
  const normalizedChildId = assertChildId(childId);
  const normalizedStickerId = assertStickerId(stickerId);
  const normalizedQuantity = Math.max(1, normalizeCount(quantity, 1));
  const normalizedSource =
    normalizeString(source) || STICKER_SOURCE.SYSTEM;

  const sticker = resolveSticker(normalizedStickerId);

  if (!sticker) {
    throw new Error(
      `stickerManager：找不到貼紙設定「${normalizedStickerId}」。`
    );
  }

  const collection = readCollection(normalizedChildId);
  const currentEntry =
    collection.stickers[normalizedStickerId] || null;

  const currentCount = normalizeCount(currentEntry?.count);
  const repeatable = isRepeatableSticker(sticker, normalizedSource);

  if (!repeatable && currentCount > 0) {
    return {
      success: true,
      granted: false,
      reason: "already_owned",
      isNew: false,
      sticker,
      count: currentCount,
      collection: cloneData(collection),
    };
  }

  const quantityToAdd = repeatable ? normalizedQuantity : 1;
  const nextCount = repeatable
    ? currentCount + quantityToAdd
    : Math.max(1, currentCount);

  const timestamp = nowIso();

  const nextEntry = currentEntry
    ? {
        ...currentEntry,
        count: nextCount,
        lastObtainedAt: timestamp,
        source: normalizedSource,
      }
    : createStickerEntry(
        normalizedStickerId,
        nextCount,
        normalizedSource
      );

  let nextCollection = {
    ...collection,
    stickers: {
      ...collection.stickers,
      [normalizedStickerId]: nextEntry,
    },
  };

  nextCollection = addHistory(nextCollection, {
    action: "grant",
    stickerId: normalizedStickerId,
    quantity: quantityToAdd,
    source: normalizedSource,
    rewardSessionId: normalizeString(rewardSessionId) || null,
    achievementId: normalizeString(achievementId) || null,
    achievementStage:
      normalizeString(achievementStage) || null,
    metadata:
      metadata && typeof metadata === "object" ? metadata : {},
  });

  const savedCollection = writeCollection(
    normalizedChildId,
    nextCollection
  );

  const result = {
    success: true,
    granted: true,
    reason: currentCount > 0 ? "duplicate_added" : "new_sticker",
    isNew: currentCount === 0,
    sticker,
    addedQuantity: quantityToAdd,
    count: nextCount,
    collection: cloneData(savedCollection),
  };

  dispatchStickerEvent("sticker-granted", {
    childId: normalizedChildId,
    ...result,
  });

  return result;
}

/* -------------------------------------------------------------------------- */
/*                       帽子遊戲 Session 防重複領取                            */
/* -------------------------------------------------------------------------- */

export function isRewardSessionProcessed(childId, rewardSessionId) {
  const normalizedSessionId = normalizeString(rewardSessionId);

  if (!normalizedSessionId) return false;

  const collection = readCollection(childId);

  return collection.processedRewardSessionIds.includes(
    normalizedSessionId
  );
}

export function claimHatGameSticker({
  childId,
  rewardSessionId,
  stickerId,
  quantity = 1,
  round = null,
  sourceStageId = null,
  metadata = {},
}) {
  const normalizedChildId = assertChildId(childId);
  const normalizedSessionId = normalizeString(rewardSessionId);

  if (!normalizedSessionId) {
    throw new Error(
      "stickerManager：帽子遊戲缺少 rewardSessionId。"
    );
  }

  const normalizedStickerId = assertStickerId(stickerId);
  const sticker = resolveSticker(normalizedStickerId);

  if (!sticker) {
    throw new Error(
      `stickerManager：找不到貼紙設定「${normalizedStickerId}」。`
    );
  }

  if (getStickerRarity(sticker) === STICKER_RARITY.ACHIEVEMENT) {
    throw new Error("成就貼紙不可由帽子遊戲發放。");
  }

  const collection = readCollection(normalizedChildId);

  if (
    collection.processedRewardSessionIds.includes(
      normalizedSessionId
    )
  ) {
    return {
      success: true,
      claimed: false,
      granted: false,
      reason: "reward_session_already_processed",
      sticker,
      count: getStickerCount(
        normalizedChildId,
        normalizedStickerId
      ),
      collection: cloneData(collection),
    };
  }

  const grantResult = grantSticker({
    childId: normalizedChildId,
    stickerId: normalizedStickerId,
    quantity,
    source: STICKER_SOURCE.HAT_GAME,
    rewardSessionId: normalizedSessionId,
    metadata: {
      ...metadata,
      round,
      sourceStageId:
        normalizeString(sourceStageId) || null,
    },
  });

  // grantSticker 已先寫入一次，這裡再讀最新資料後標記 session。
  const latestCollection = readCollection(normalizedChildId);

  let nextCollection = {
    ...latestCollection,
    processedRewardSessionIds: uniqueStrings(
      [
        ...latestCollection.processedRewardSessionIds,
        normalizedSessionId,
      ],
      MAX_PROCESSED_SESSION_LENGTH
    ),
  };

  nextCollection = addHistory(nextCollection, {
    action: "hat_session_claimed",
    stickerId: normalizedStickerId,
    rewardSessionId: normalizedSessionId,
    round,
    sourceStageId:
      normalizeString(sourceStageId) || null,
  });

  const savedCollection = writeCollection(
    normalizedChildId,
    nextCollection
  );

  const result = {
    ...grantResult,
    success: true,
    claimed: true,
    rewardSessionId: normalizedSessionId,
    collection: cloneData(savedCollection),
  };

  dispatchStickerEvent("hat-sticker-claimed", {
    childId: normalizedChildId,
    ...result,
  });

  return result;
}

/**
 * 若你的帽子遊戲「一個活動 session 最多五輪」，
 * 建議每輪使用不同 claim ID：
 *
 * `${rewardSessionId}_round_${round}`
 *
 * 範例：
 * claimHatGameRoundSticker({
 *   childId,
 *   rewardSessionId,
 *   round: 1,
 *   stickerId: "leaf_01"
 * });
 */
export function claimHatGameRoundSticker({
  childId,
  rewardSessionId,
  round,
  stickerId,
  quantity = 1,
  sourceStageId = null,
  metadata = {},
}) {
  const normalizedRound = normalizeCount(round);

  if (normalizedRound < 1 || normalizedRound > 5) {
    throw new Error("帽子遊戲輪次必須介於 1～5。");
  }

  const normalizedSessionId = normalizeString(rewardSessionId);

  if (!normalizedSessionId) {
    throw new Error(
      "stickerManager：帽子遊戲缺少 rewardSessionId。"
    );
  }

  const roundClaimId = `${normalizedSessionId}_round_${normalizedRound}`;

  return claimHatGameSticker({
    childId,
    rewardSessionId: roundClaimId,
    stickerId,
    quantity,
    round: normalizedRound,
    sourceStageId,
    metadata: {
      ...metadata,
      parentRewardSessionId: normalizedSessionId,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                              成就貼紙發放                                    */
/* -------------------------------------------------------------------------- */

function createAchievementClaimKey(
  achievementId,
  achievementStage
) {
  const normalizedAchievementId = normalizeString(achievementId);
  const normalizedStage = normalizeString(achievementStage);

  if (!normalizedAchievementId || !normalizedStage) {
    throw new Error(
      "stickerManager：成就貼紙缺少 achievementId 或 achievementStage。"
    );
  }

  return `${normalizedAchievementId}::${normalizedStage}`;
}

export function hasClaimedAchievementSticker({
  childId,
  achievementId,
  achievementStage,
}) {
  const claimKey = createAchievementClaimKey(
    achievementId,
    achievementStage
  );

  const collection = readCollection(childId);

  return collection.claimedAchievementRewards.includes(claimKey);
}

export function grantAchievementSticker({
  childId,
  achievementId,
  achievementStage,
  stickerId,
  metadata = {},
}) {
  const normalizedChildId = assertChildId(childId);
  const normalizedStickerId = assertStickerId(stickerId);

  const claimKey = createAchievementClaimKey(
    achievementId,
    achievementStage
  );

  const sticker = resolveSticker(normalizedStickerId);

  if (!sticker) {
    throw new Error(
      `stickerManager：找不到成就貼紙「${normalizedStickerId}」。`
    );
  }

  const collection = readCollection(normalizedChildId);

  if (collection.claimedAchievementRewards.includes(claimKey)) {
    return {
      success: true,
      granted: false,
      reason: "achievement_stage_already_claimed",
      sticker,
      count: getStickerCount(
        normalizedChildId,
        normalizedStickerId
      ),
      collection: cloneData(collection),
    };
  }

  const grantResult = grantSticker({
    childId: normalizedChildId,
    stickerId: normalizedStickerId,
    quantity: 1,
    source: STICKER_SOURCE.ACHIEVEMENT,
    achievementId,
    achievementStage,
    metadata,
  });

  const latestCollection = readCollection(normalizedChildId);

  let nextCollection = {
    ...latestCollection,
    claimedAchievementRewards: uniqueStrings(
      [
        ...latestCollection.claimedAchievementRewards,
        claimKey,
      ],
      MAX_ACHIEVEMENT_CLAIM_LENGTH
    ),
  };

  nextCollection = addHistory(nextCollection, {
    action: "achievement_claimed",
    stickerId: normalizedStickerId,
    achievementId: normalizeString(achievementId),
    achievementStage: normalizeString(achievementStage),
    claimKey,
  });

  const savedCollection = writeCollection(
    normalizedChildId,
    nextCollection
  );

  const result = {
    ...grantResult,
    success: true,
    granted: true,
    achievementClaimKey: claimKey,
    collection: cloneData(savedCollection),
  };

  dispatchStickerEvent("achievement-sticker-granted", {
    childId: normalizedChildId,
    ...result,
  });

  return result;
}

/* -------------------------------------------------------------------------- */
/*                                合成功能                                      */
/* -------------------------------------------------------------------------- */

export function getStickerFusionStatus(childId, stickerId) {
  const normalizedStickerId = assertStickerId(stickerId);
  const sticker = resolveSticker(normalizedStickerId);

  if (!sticker) {
    return {
      canFuse: false,
      reason: "sticker_not_found",
      sticker: null,
      targetSticker: null,
      currentCount: 0,
      requiredCount: 0,
      missingCount: 0,
    };
  }

  const rarity = getStickerRarity(sticker);
  const targetStickerId = getFusionTargetId(sticker);
  const targetSticker = targetStickerId
    ? resolveSticker(targetStickerId)
    : null;

  if (
    rarity !== STICKER_RARITY.COMMON &&
    rarity !== STICKER_RARITY.RARE
  ) {
    return {
      canFuse: false,
      reason: "rarity_not_fusible",
      sticker,
      targetSticker,
      currentCount: getStickerCount(childId, normalizedStickerId),
      requiredCount: 0,
      missingCount: 0,
    };
  }

  if (!targetStickerId || !targetSticker) {
    return {
      canFuse: false,
      reason: "fusion_target_missing",
      sticker,
      targetSticker: null,
      currentCount: getStickerCount(childId, normalizedStickerId),
      requiredCount: FUSION_REQUIREMENT[rarity] || 3,
      missingCount: 0,
    };
  }

  const expectedTargetRarity =
    rarity === STICKER_RARITY.COMMON
      ? STICKER_RARITY.RARE
      : STICKER_RARITY.SPECIAL;

  if (getStickerRarity(targetSticker) !== expectedTargetRarity) {
    return {
      canFuse: false,
      reason: "invalid_target_rarity",
      sticker,
      targetSticker,
      currentCount: getStickerCount(childId, normalizedStickerId),
      requiredCount: FUSION_REQUIREMENT[rarity] || 3,
      missingCount: 0,
    };
  }

  const requiredCount = FUSION_REQUIREMENT[rarity] || 3;
  const currentCount = getStickerCount(
    childId,
    normalizedStickerId
  );

  return {
    canFuse: currentCount >= requiredCount,
    reason:
      currentCount >= requiredCount
        ? "ready"
        : "not_enough_stickers",
    sticker,
    targetSticker,
    currentCount,
    requiredCount,
    missingCount: Math.max(0, requiredCount - currentCount),
  };
}

export function getCraftableStickers(childId) {
  return getOwnedStickers(childId)
    .map((entry) =>
      getStickerFusionStatus(childId, entry.stickerId)
    )
    .filter((status) => status.canFuse);
}

/**
 * 合成屬於同一次 localStorage 寫入：
 * - 先檢查來源數量
 * - 扣除來源
 * - 增加固定目標
 * - 最後一次寫入
 *
 * 正式接 Supabase 時，仍應改由 RPC / transaction 執行。
 */
export function fuseSticker({
  childId,
  sourceStickerId,
  fusionCount = 1,
  metadata = {},
}) {
  const normalizedChildId = assertChildId(childId);
  const normalizedSourceId = assertStickerId(sourceStickerId);
  const normalizedFusionCount = Math.max(
    1,
    normalizeCount(fusionCount, 1)
  );

  const fusionStatus = getStickerFusionStatus(
    normalizedChildId,
    normalizedSourceId
  );

  if (!fusionStatus.sticker) {
    throw new Error("找不到要合成的來源貼紙。");
  }

  if (
    fusionStatus.reason === "rarity_not_fusible" ||
    fusionStatus.reason === "fusion_target_missing" ||
    fusionStatus.reason === "invalid_target_rarity"
  ) {
    return {
      success: false,
      fused: false,
      reason: fusionStatus.reason,
      ...fusionStatus,
    };
  }

  const requiredPerFusion = fusionStatus.requiredCount;
  const totalRequired =
    requiredPerFusion * normalizedFusionCount;

  const collection = readCollection(normalizedChildId);
  const sourceEntry =
    collection.stickers[normalizedSourceId] || null;

  const sourceCurrentCount = normalizeCount(sourceEntry?.count);

  if (sourceCurrentCount < totalRequired) {
    return {
      success: false,
      fused: false,
      reason: "not_enough_stickers",
      sticker: fusionStatus.sticker,
      targetSticker: fusionStatus.targetSticker,
      currentCount: sourceCurrentCount,
      requiredCount: totalRequired,
      missingCount: Math.max(
        0,
        totalRequired - sourceCurrentCount
      ),
      collection: cloneData(collection),
    };
  }

  const targetStickerId = assertStickerId(
    fusionStatus.targetSticker?.id ??
      fusionStatus.targetSticker?.stickerId
  );

  const targetEntry =
    collection.stickers[targetStickerId] || null;

  const targetCurrentCount = normalizeCount(targetEntry?.count);
  const sourceNextCount = Math.max(
    0,
    sourceCurrentCount - totalRequired
  );

  const timestamp = nowIso();

  const nextStickers = {
    ...collection.stickers,
    [targetStickerId]: targetEntry
      ? {
          ...targetEntry,
          count: targetCurrentCount + normalizedFusionCount,
          lastObtainedAt: timestamp,
          source: STICKER_SOURCE.FUSION,
        }
      : createStickerEntry(
          targetStickerId,
          normalizedFusionCount,
          STICKER_SOURCE.FUSION
        ),
  };

  if (sourceNextCount > 0) {
    nextStickers[normalizedSourceId] = {
      ...sourceEntry,
      count: sourceNextCount,
      lastObtainedAt: timestamp,
    };
  } else {
    delete nextStickers[normalizedSourceId];
  }

  let nextCollection = {
    ...collection,
    stickers: nextStickers,
  };

  nextCollection = addHistory(nextCollection, {
    action: "fusion",
    sourceStickerId: normalizedSourceId,
    sourceQuantityUsed: totalRequired,
    targetStickerId,
    targetQuantityAdded: normalizedFusionCount,
    fusionCount: normalizedFusionCount,
    metadata:
      metadata && typeof metadata === "object" ? metadata : {},
  });

  const savedCollection = writeCollection(
    normalizedChildId,
    nextCollection
  );

  const sourceRarity = getStickerRarity(fusionStatus.sticker);

  const experienceReward =
    sourceRarity === STICKER_RARITY.COMMON
      ? 10 * normalizedFusionCount
      : 20 * normalizedFusionCount;

  const result = {
    success: true,
    fused: true,
    reason: "fusion_completed",

    sourceSticker: fusionStatus.sticker,
    sourceStickerId: normalizedSourceId,
    sourceQuantityUsed: totalRequired,
    sourceRemainingCount: sourceNextCount,

    targetSticker: fusionStatus.targetSticker,
    targetStickerId,
    targetQuantityAdded: normalizedFusionCount,
    targetCount: targetCurrentCount + normalizedFusionCount,

    fusionCount: normalizedFusionCount,
    experienceReward,

    collection: cloneData(savedCollection),
  };

  /**
   * animalGrowthManager 可監聽此事件後增加經驗：
   * common -> rare：每次 +10
   * rare -> special：每次 +20
   */
  dispatchStickerEvent("sticker-fused", {
    childId: normalizedChildId,
    ...result,
  });

  return result;
}

/* -------------------------------------------------------------------------- */
/*                             帽子遊戲獎池工具                                 */
/* -------------------------------------------------------------------------- */

export function getHatGameStickerPool(options = {}) {
  const {
    includeRare = false,
    excludeStickerIds = [],
  } = options;

  const excludedIds = new Set(
    (Array.isArray(excludeStickerIds)
      ? excludeStickerIds
      : []
    )
      .map(normalizeString)
      .filter(Boolean)
  );

  return flattenStickerConfig(STICKER_CONFIG)
    .filter(Boolean)
    .filter((sticker) => {
      const stickerId = normalizeString(
        sticker.id ?? sticker.stickerId
      );

      if (!stickerId || excludedIds.has(stickerId)) {
        return false;
      }

      if (sticker.enabled === false) {
        return false;
      }

      if (sticker.availableInHatGame === false) {
        return false;
      }

      const rarity = getStickerRarity(sticker);

      if (rarity === STICKER_RARITY.ACHIEVEMENT) {
        return false;
      }

      if (rarity === STICKER_RARITY.SPECIAL) {
        return false;
      }

      if (
        rarity === STICKER_RARITY.RARE &&
        !includeRare
      ) {
        return false;
      }

      return (
        rarity === STICKER_RARITY.COMMON ||
        (includeRare && rarity === STICKER_RARITY.RARE)
      );
    });
}

export function drawRandomHatSticker(options = {}) {
  const pool = getHatGameStickerPool(options);

  if (pool.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * pool.length);

  return pool[randomIndex];
}

/* -------------------------------------------------------------------------- */
/*                          管理與資料清理功能                                  */
/* -------------------------------------------------------------------------- */

export function removeSticker({
  childId,
  stickerId,
  quantity = 1,
  reason = "manual_remove",
}) {
  const normalizedChildId = assertChildId(childId);
  const normalizedStickerId = assertStickerId(stickerId);
  const normalizedQuantity = Math.max(1, normalizeCount(quantity, 1));

  const collection = readCollection(normalizedChildId);
  const currentEntry =
    collection.stickers[normalizedStickerId] || null;

  if (!currentEntry) {
    return {
      success: false,
      removed: false,
      reason: "sticker_not_owned",
      count: 0,
      collection: cloneData(collection),
    };
  }

  const currentCount = normalizeCount(currentEntry.count);
  const removedQuantity = Math.min(
    currentCount,
    normalizedQuantity
  );

  const nextCount = Math.max(
    0,
    currentCount - removedQuantity
  );

  const nextStickers = {
    ...collection.stickers,
  };

  if (nextCount > 0) {
    nextStickers[normalizedStickerId] = {
      ...currentEntry,
      count: nextCount,
      lastObtainedAt: nowIso(),
    };
  } else {
    delete nextStickers[normalizedStickerId];
  }

  let nextCollection = {
    ...collection,
    stickers: nextStickers,
  };

  nextCollection = addHistory(nextCollection, {
    action: "remove",
    stickerId: normalizedStickerId,
    quantity: removedQuantity,
    reason: normalizeString(reason) || "manual_remove",
  });

  const savedCollection = writeCollection(
    normalizedChildId,
    nextCollection
  );

  return {
    success: true,
    removed: true,
    reason: "removed",
    removedQuantity,
    count: nextCount,
    collection: cloneData(savedCollection),
  };
}

export function resetStickerCollection(childId) {
  const normalizedChildId = assertChildId(childId);
  const emptyCollection = createEmptyCollection(normalizedChildId);

  return writeCollection(normalizedChildId, emptyCollection);
}

export function deleteStickerCollection(childId) {
  const normalizedChildId = assertChildId(childId);

  if (!isBrowser()) {
    return true;
  }

  try {
    window.localStorage.removeItem(
      getStorageKey(normalizedChildId)
    );

    dispatchStickerEvent("sticker-collection-deleted", {
      childId: normalizedChildId,
    });

    return true;
  } catch (error) {
    console.error("[stickerManager] 刪除收藏失敗：", error);
    return false;
  }
}

export function exportStickerCollection(childId) {
  return JSON.stringify(
    getStickerCollection(childId),
    null,
    2
  );
}

export function importStickerCollection({
  childId,
  collectionData,
  merge = false,
}) {
  const normalizedChildId = assertChildId(childId);

  const parsedData =
    typeof collectionData === "string"
      ? safeJsonParse(collectionData, null)
      : collectionData;

  if (!parsedData || typeof parsedData !== "object") {
    throw new Error("貼紙收藏匯入資料格式錯誤。");
  }

  const importedCollection = normalizeCollection(
    {
      ...parsedData,
      childId: normalizedChildId,
    },
    normalizedChildId
  );

  if (!merge) {
    return writeCollection(
      normalizedChildId,
      importedCollection
    );
  }

  const currentCollection = readCollection(normalizedChildId);
  const mergedStickers = {
    ...currentCollection.stickers,
  };

  Object.entries(importedCollection.stickers).forEach(
    ([stickerId, importedEntry]) => {
      const currentEntry = mergedStickers[stickerId];
      const mergedCount = Math.max(
        normalizeCount(currentEntry?.count),
        normalizeCount(importedEntry?.count)
      );

      mergedStickers[stickerId] = {
        ...importedEntry,
        ...currentEntry,
        count: mergedCount,
        firstObtainedAt:
          currentEntry?.firstObtainedAt ||
          importedEntry?.firstObtainedAt ||
          nowIso(),
        lastObtainedAt:
          importedEntry?.lastObtainedAt ||
          currentEntry?.lastObtainedAt ||
          nowIso(),
      };
    }
  );

  const mergedCollection = {
    ...currentCollection,
    stickers: mergedStickers,

    processedRewardSessionIds: uniqueStrings(
      [
        ...currentCollection.processedRewardSessionIds,
        ...importedCollection.processedRewardSessionIds,
      ],
      MAX_PROCESSED_SESSION_LENGTH
    ),

    claimedAchievementRewards: uniqueStrings(
      [
        ...currentCollection.claimedAchievementRewards,
        ...importedCollection.claimedAchievementRewards,
      ],
      MAX_ACHIEVEMENT_CLAIM_LENGTH
    ),

    history: [
      ...currentCollection.history,
      ...importedCollection.history,
    ].slice(-MAX_HISTORY_LENGTH),
  };

  return writeCollection(
    normalizedChildId,
    mergedCollection
  );
}

/* -------------------------------------------------------------------------- */
/*                                預設輸出                                      */
/* -------------------------------------------------------------------------- */

const stickerManager = {
  getStickerCollection,
  getStickerCount,
  hasSticker,
  getOwnedStickers,
  getStickerCollectionSummary,

  grantSticker,
  claimHatGameSticker,
  claimHatGameRoundSticker,
  isRewardSessionProcessed,

  grantAchievementSticker,
  hasClaimedAchievementSticker,

  getStickerFusionStatus,
  getCraftableStickers,
  fuseSticker,

  getHatGameStickerPool,
  drawRandomHatSticker,

  removeSticker,
  resetStickerCollection,
  deleteStickerCollection,

  exportStickerCollection,
  importStickerCollection,
};

export default stickerManager;