import { getPatientById, saveGameResultToCloud } from "../lib/database";
import { supabase } from "../lib/supabaseClient";
import { createBehavioralId } from "../analytics/trials/buildBehavioralHierarchy";
import { isTemporaryGameTesting } from "../temporaryGameTesting/runtime";

export const RESULT_OUTBOX_PREFIX = "efGameResultOutbox:";
export const RESULT_SYNC_EVENT = "ef-game-result-sync";
const TAB_KEY = "efGameResultSyncTab";
const RETRY_MS = 30000;
const STALE_ATTEMPT_MS = 60000;
const liveAttempts = new Set();
const attemptLocks = new Map();
const MIRROR_OWNER_KEY = "efGameResultMirrorOwner";
const MIRROR_ARCHIVE_PREFIX = "efGameResultMirrorArchive:";
const MIRROR_CONFLICT_PREFIX = "efGameResultMirrorConflict:";
const fallbackTabId = createBehavioralId();
let accountId = null;
let worker = null;
let storageError = false;

// Display mirrors are shared by legacy result readers. Move them out of those
// readers' keys on an account boundary, retaining the exact strings for the
// original account. The durable upload outbox is never moved or deleted here.
const MIRROR_VERSION_KEY = "efGameResultMirrorVersion";
const MIRROR_VERSION = "2";
const isOriginalMirror = (key) => key === "efGameResults" || key.startsWith("result:")
  || /^(ari|cbt|dccs|lb|pm|srt)(Test|Training)Result$/.test(key)
  || /^(current|selected)(Child|Patient)(Id)?$/.test(key);
const isResultMirror = (key) => isOriginalMirror(key)
  || /^(latest)?(ari|cbt|dccs|lb|pm|srt|pictureMemory)(Test|Training)?Result(?:_|$|Mode|Version)/i.test(key)
  || /^(DCCS|LB)_(TRAINING_)?RESULT$/.test(key)
  || /^ef_(game_)?(ari|cbt|dccs|lb|pm|srt)_/i.test(key)
  || /^ef_test_(ari|cbt|dccs|lb|pm|srt)_completed(?:_|$)/i.test(key)
  || /^(activeChild|childId|patientId|childrenProfiles|ef_active_patient(_id|_version)?)$/.test(key);
const storageKeys = (storage) => Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);

function switchResultMirrors(nextOwnerId) {
  [localStorage, sessionStorage].forEach((storage) => {
    const previousOwner = storage.getItem(MIRROR_OWNER_KEY);
    const currentVersion = storage.getItem(MIRROR_VERSION_KEY) === MIRROR_VERSION;
    const changed = previousOwner !== nextOwnerId;
    const keys = storageKeys(storage);
    keys.filter(isResultMirror).forEach((key) => {
      if (!changed && (currentVersion || isOriginalMirror(key))) return;
      const value = storage.getItem(key);
      if (value === null) return; // Another tab may already have archived this key.
      let owner = previousOwner;
      if (!currentVersion && !isOriginalMirror(key)) {
        // Old expanded aliases were never covered by the owner marker. Retain
        // explicit ownership only; ambiguous legacy data stays unassigned.
        let source;
        try { source = JSON.parse(value); } catch { source = null; }
        const sources = Array.isArray(source) ? source : [source];
        const owners = sources.map((item) => item?.syncOwnerId || item?.rawResult?.syncOwnerId || item?.guardian_id);
        owner = owners.length && owners.every((id) => id && id === owners[0]) ? owners[0] : null;
      }
      const archivedKey = MIRROR_ARCHIVE_PREFIX + (owner || "unassigned") + ":" + encodeURIComponent(key);
      const previous = storage.getItem(archivedKey);
      if (previous !== null && previous !== value) {
        // Never overwrite an older acquisition history left by a legacy reader.
        const conflictKey = MIRROR_CONFLICT_PREFIX + (owner || "unassigned") + ":" + encodeURIComponent(key) + ":" + createBehavioralId();
        storage.setItem(conflictKey, previous);
        if (storage.getItem(conflictKey) !== previous) throw new Error("Result mirror conflict not acknowledged");
      }
      storage.setItem(archivedKey, value);
      if (storage.getItem(archivedKey) !== value) throw new Error("Result mirror archive not acknowledged");
      storage.removeItem(key);
    });
    if (nextOwnerId) {
      const prefix = MIRROR_ARCHIVE_PREFIX + nextOwnerId + ":";
      storageKeys(storage).filter((key) => key.startsWith(prefix)).forEach((key) => {
        const restoredKey = decodeURIComponent(key.slice(prefix.length));
        const value = storage.getItem(key);
        if (!isResultMirror(restoredKey) || value === null) return;
        const current = storage.getItem(restoredKey);
        if (current !== null && current !== value) return; // Preserve both histories for review.
        storage.setItem(restoredKey, value);
        if (storage.getItem(restoredKey) !== value) throw new Error("Result mirror restore not acknowledged");
        storage.removeItem(key); // Verified move, never an outbox key.
      });
      storage.setItem(MIRROR_OWNER_KEY, nextOwnerId);
    } else storage.removeItem(MIRROR_OWNER_KEY);
    storage.setItem(MIRROR_VERSION_KEY, MIRROR_VERSION);
  });
}

export function areResultMirrorsReady(ownerId = accountId) {
  if (!ownerId || ownerId !== accountId) return false;
  try {
    return [localStorage, sessionStorage].every((storage) =>
      storage.getItem(MIRROR_OWNER_KEY) === ownerId && storage.getItem(MIRROR_VERSION_KEY) === MIRROR_VERSION);
  } catch { return false; }
}

export const getResultSyncAccountId = () => accountId;

export function reportResultStorageFailure() {
  storageError = true;
  notify();
}

export function getResultSyncTabId() {
  try {
    let tabId = sessionStorage.getItem(TAB_KEY);
    if (!tabId) { tabId = fallbackTabId; sessionStorage.setItem(TAB_KEY, tabId); }
    return tabId;
  } catch {
    return fallbackTabId;
  }
}

export function readResultOutbox() {
  const entries = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(RESULT_OUTBOX_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      if (entry?.result?.resultId && key === `${RESULT_OUTBOX_PREFIX}${entry.result.resultId}`) {
        entries.push(entry);
      }
    } catch {
      // Never delete a damaged record automatically; leave it available for recovery.
    }
  }
  return entries;
}

export function getResultSyncState() {
  try {
    localStorage.getItem(MIRROR_OWNER_KEY); // Detect denied reads even with an empty outbox.
    const entries = readResultOutbox().filter((entry) => !entry.ownerId || entry.ownerId === accountId);
    return {
      pending: entries.filter((entry) => !entry.activeTabId).length,
      active: entries.filter((entry) => entry.activeTabId).length,
      online: navigator.onLine !== false,
      syncing: Boolean(worker),
      signedIn: Boolean(accountId),
      storageError,
    };
  } catch {
    return { pending: 0, active: 0, online: navigator.onLine !== false, syncing: false, storageError: true };
  }
}

function notify() {
  window.dispatchEvent(new CustomEvent(RESULT_SYNC_EVENT));
}

export function queueGameResult(result, options = {}) {
  if (isTemporaryGameTesting()) return null;
  const ownerId = options.ownerId !== undefined
    ? options.ownerId
    : result.rawResult?.syncOwnerId !== undefined ? result.rawResult.syncOwnerId : accountId;
  const entry = {
    result: { ...result, syncStatus: "pending", syncState: {
      gameResult: "pending", researchHierarchy: "pending",
      expectedTrialCount: result.trials?.length || 0, verifiedTrialCount: null,
    } },
    ownerId,
    activeTabId: options.activeTabId || null,
    revision: createBehavioralId(),
    updatedAt: new Date().toISOString(),
  };
  try {
    // Each record has its own key. Pending uploads are never truncated with the
    // display history, and tabs saving different attempts cannot overwrite it.
    localStorage.setItem(`${RESULT_OUTBOX_PREFIX}${result.resultId}`, JSON.stringify(entry));
    storageError = false;
  } catch (error) {
    storageError = true;
    notify();
    throw error;
  }
  notify();
  if (!entry.activeTabId) scheduleSync();
  return entry;
}

export function registerLiveAttempt(resultId) {
  liveAttempts.add(resultId);
  if (navigator.locks?.request) {
    const token = { active: true, release: null };
    attemptLocks.set(resultId, token);
    void navigator.locks.request(`ef-game-attempt:${resultId}`, async () => {
      if (token.active) await new Promise((resolve) => { token.release = resolve; });
    }).catch(() => { /* Heartbeat recovery remains available without Web Locks. */ });
  }
}

export function unregisterLiveAttempt(resultId) {
  liveAttempts.delete(resultId);
  const token = attemptLocks.get(resultId);
  if (token) { token.active = false; token.release?.(); attemptLocks.delete(resultId); }
}

export async function recoverInterruptedResults() {
  const tabId = getResultSyncTabId();
  const locks = navigator.locks?.query ? await navigator.locks.query() : null;
  const activeLocks = new Set([...(locks?.held || []), ...(locks?.pending || [])].map((lock) => lock.name));
  readResultOutbox().forEach((entry) => {
    if (!entry.activeTabId || liveAttempts.has(entry.result.resultId)) return;
    if (activeLocks.has(`ef-game-attempt:${entry.result.resultId}`)) return;
    if (!locks && entry.activeTabId !== tabId && Date.now() - Date.parse(entry.updatedAt) < STALE_ATTEMPT_MS) return;
    const result = entry.result;
    const finishedAt = entry.updatedAt;
    queueGameResult({
      ...result,
      session: { ...result.session, status: "interrupted", finishedAt },
      rawResult: { ...result.rawResult, status: "interrupted", finishedAt, completionReason: "browser_closed" },
    }, { ownerId: entry.ownerId });
  });
}

function markLocalResultSynced(resultId, syncState, syncStatus = "synced") {
  // Update mirrors only after the database acknowledges the write. Failure to
  // update a display cache must not invalidate a successful cloud upload.
  [localStorage, sessionStorage].forEach((storage) => {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(RESULT_OUTBOX_PREFIX) || key?.startsWith(MIRROR_CONFLICT_PREFIX)) continue;
      try {
        const value = JSON.parse(storage.getItem(key));
        const mark = (result) => result?.resultId === resultId
          ? { ...result, syncStatus, syncState, ...(result.rawResult ? { rawResult: { ...result.rawResult, syncStatus } } : {}) }
          : result;
        if (value?.resultId === resultId || (Array.isArray(value) && value.some((result) => result?.resultId === resultId))) {
          storage.setItem(key, JSON.stringify(Array.isArray(value) ? value.map(mark) : mark(value)));
        }
      } catch {
        // Non-JSON preferences and unavailable display caches need no update.
      }
    }
  });
}

async function uploadPendingResults() {
  const ownerId = accountId;
  if (!ownerId || navigator.onLine === false) return;
  const attempted = new Set();
  while (navigator.onLine !== false && accountId === ownerId) {
    const entry = readResultOutbox().find((candidate) =>
      !candidate.activeTabId && (!candidate.ownerId || candidate.ownerId === ownerId) && !attempted.has(candidate.revision)
    );
    if (!entry) break;
    attempted.add(entry.revision);
    try {
      if (!entry.ownerId) {
        // An offline initial session may not have resolved an account yet.
        // Bind only after the server confirms this child's actual guardian.
        const patient = await getPatientById(entry.result.child?.childId);
        const latest = JSON.parse(localStorage.getItem(`${RESULT_OUTBOX_PREFIX}${entry.result.resultId}`) || "null");
        if (patient?.guardian_id === ownerId && accountId === ownerId && latest?.revision === entry.revision) {
          queueGameResult({ ...entry.result, rawResult: { ...entry.result.rawResult, syncOwnerId: ownerId } }, { ownerId });
        }
        continue;
      }
      const saved = await saveGameResultToCloud(entry.result, { expectedOwnerId: ownerId });
      // Only a verified hierarchy and acknowledged main result are a complete
      // upload. Legacy/partial acknowledgements must retain the durable source.
      if (saved?.id !== entry.result.resultId || saved.syncState?.gameResult !== "saved"
        || saved.syncState?.researchHierarchy !== "verified"
        || saved.syncState.expectedTrialCount !== entry.result.trials?.length
        || saved.syncState.verifiedTrialCount !== saved.syncState.expectedTrialCount) continue;
      const key = `${RESULT_OUTBOX_PREFIX}${entry.result.resultId}`;
      const latest = JSON.parse(localStorage.getItem(key) || "null");
      // A completion or a new checkpoint can arrive during an older upload.
      if (latest?.revision === entry.revision) {
        markLocalResultSynced(entry.result.resultId, saved.syncState);
        localStorage.removeItem(key);
        notify();
      }
    } catch (error) {
      if (error.syncState) {
        const key = `${RESULT_OUTBOX_PREFIX}${entry.result.resultId}`;
        const latest = JSON.parse(localStorage.getItem(key) || "null");
        if (latest?.revision === entry.revision) {
          latest.result = { ...latest.result, syncStatus: "pending", syncState: error.syncState };
          localStorage.setItem(key, JSON.stringify(latest));
          markLocalResultSynced(entry.result.resultId, error.syncState, "pending");
          notify();
        }
      }
      // Leave failed records on disk. Other independent records can still sync.
    }
  }
}

export function flushResultOutbox() {
  if (worker) return worker;
  worker = Promise.resolve().then(async () => {
    if (navigator.locks?.request) {
      await navigator.locks.request("ef-game-result-upload", { ifAvailable: true }, async (lock) => {
        if (lock) await uploadPendingResults();
      });
    } else {
      await uploadPendingResults();
    }
  }).catch(() => {
    // Storage or connectivity may disappear while the worker is running.
  }).finally(() => {
    worker = null;
    notify();
  });
  notify();
  return worker;
}

function scheduleSync() {
  // Supabase auth callbacks must return before starting another auth operation.
  window.setTimeout(() => { void flushResultOutbox(); }, 0);
}

export function startResultSync() {
  const recoverAndSync = () => {
    void recoverInterruptedResults().catch(() => { storageError = true; }).finally(() => {
      notify(); scheduleSync();
    });
  };
  const visible = () => { if (document.visibilityState === "visible") recoverAndSync(); };
  const storageChanged = (event) => {
    if (event.key?.startsWith(RESULT_OUTBOX_PREFIX)) { notify(); scheduleSync(); }
  };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const nextOwnerId = session?.user?.id || null;
    try { switchResultMirrors(nextOwnerId); } catch { storageError = true; }
    accountId = nextOwnerId;
    notify();
    scheduleSync();
  });
  window.addEventListener("online", recoverAndSync);
  window.addEventListener("offline", notify);
  window.addEventListener("focus", recoverAndSync);
  window.addEventListener("storage", storageChanged);
  document.addEventListener("visibilitychange", visible);
  const timer = window.setInterval(recoverAndSync, RETRY_MS);
  recoverAndSync();
  return () => {
    data?.subscription?.unsubscribe();
    window.clearInterval(timer);
    window.removeEventListener("online", recoverAndSync);
    window.removeEventListener("offline", notify);
    window.removeEventListener("focus", recoverAndSync);
    window.removeEventListener("storage", storageChanged);
    document.removeEventListener("visibilitychange", visible);
  };
}
