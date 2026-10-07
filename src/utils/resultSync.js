import { getPatientById, saveGameResultToCloud } from "../lib/database";
import { supabase } from "../lib/supabaseClient";
import { createBehavioralId } from "../analytics/trials/buildBehavioralHierarchy";

export const RESULT_OUTBOX_PREFIX = "efGameResultOutbox:";
export const RESULT_SYNC_EVENT = "ef-game-result-sync";
const TAB_KEY = "efGameResultSyncTab";
const RETRY_MS = 30000;
const STALE_ATTEMPT_MS = 60000;
const liveAttempts = new Set();
const attemptLocks = new Map();
const fallbackTabId = createBehavioralId();
let accountId = null;
let worker = null;
let storageError = false;

export const getResultSyncAccountId = () => accountId;

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
  const ownerId = options.ownerId !== undefined
    ? options.ownerId
    : result.rawResult?.syncOwnerId !== undefined ? result.rawResult.syncOwnerId : accountId;
  const entry = {
    result: { ...result, syncStatus: "pending" },
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

function markLocalResultSynced(resultId) {
  // Update mirrors only after the database acknowledges the write. Failure to
  // update a display cache must not invalidate a successful cloud upload.
  [localStorage, sessionStorage].forEach((storage) => {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(RESULT_OUTBOX_PREFIX)) continue;
      try {
        const value = JSON.parse(storage.getItem(key));
        const mark = (result) => result?.resultId === resultId
          ? { ...result, syncStatus: "synced", ...(result.rawResult ? { rawResult: { ...result.rawResult, syncStatus: "synced" } } : {}) }
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
      // No session / no child is not a successful upload.
      if (!saved) continue;
      const key = `${RESULT_OUTBOX_PREFIX}${entry.result.resultId}`;
      const latest = JSON.parse(localStorage.getItem(key) || "null");
      // A completion or a new checkpoint can arrive during an older upload.
      if (latest?.revision === entry.revision) {
        markLocalResultSynced(entry.result.resultId);
        localStorage.removeItem(key);
        notify();
      }
    } catch {
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
    accountId = session?.user?.id || null;
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
