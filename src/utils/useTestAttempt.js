import { useEffect, useMemo, useRef } from "react";
import { createResultId, getCurrentChild, normalizeGameResult } from "./resultManager";
import {
  getResultSyncAccountId, getResultSyncTabId, queueGameResult,
  registerLiveAttempt, unregisterLiveAttempt,
} from "./resultSync";

export function createTestAttempt({ gameId, difficulty = "normal", route }) {
  let attempt = null;
  const persist = (active) => {
    const result = normalizeGameResult({
      rawResult: attempt.raw, gameId, mode: "test", difficulty,
      route, child: attempt.child, visibleRoles: ["child", "parent", "clinician"],
    });
    attempt.raw.behavioral = result.behavioral;
    queueGameResult(result, { ownerId: attempt.ownerId, activeTabId: active ? getResultSyncTabId() : null });
  };
  const recorder = {
    begin(child = getCurrentChild()) {
      if (attempt) recorder.interrupt("restarted");
      const startedAt = new Date().toISOString();
      const resultId = createResultId({ gameId, mode: "test", childId: child?.childId || child?.id });
      const ownerId = getResultSyncAccountId() || child?.guardian_id || null;
      attempt = { child: child || {}, ownerId, raw: { resultId, startedAt, status: "in_progress", syncOwnerId: ownerId, trials: [] } };
      registerLiveAttempt(resultId);
      persist(true);
      return attempt.raw;
    },
    checkpoint(raw = {}) {
      if (!attempt) return;
      attempt.raw = { ...attempt.raw, ...raw, resultId: attempt.raw.resultId, startedAt: attempt.raw.startedAt, status: "in_progress" };
      persist(true);
    },
    complete(raw) {
      if (!attempt) recorder.begin();
      const result = {
        ...raw, resultId: attempt.raw.resultId, startedAt: attempt.raw.startedAt,
        behavioral: attempt.raw.behavioral, syncOwnerId: attempt.ownerId,
        status: raw.status === "aborted" ? "interrupted" : raw.status || "completed",
        finishedAt: raw.finishedAt || raw.endedAt || raw.generatedAt || new Date().toISOString(),
        syncStatus: "pending",
      };
      attempt.raw = result;
      // Durable completion precedes legacy display caches and navigation.
      persist(false);
      unregisterLiveAttempt(result.resultId);
      attempt = null;
      return result;
    },
    interrupt(reason = "left_test") {
      if (!attempt) return;
      const finishedAt = new Date().toISOString();
      attempt.raw = {
        ...attempt.raw, status: "interrupted", finishedAt, completionReason: reason,
        totalPlayTime: Math.max(0, (Date.parse(finishedAt) - Date.parse(attempt.raw.startedAt)) / 1000),
      };
      persist(false);
      unregisterLiveAttempt(attempt.raw.resultId);
      attempt = null;
    },
  };
  return recorder;
}

export function useTestAttempt(options) {
  const optionsRef = useRef(options);
  const recorder = useMemo(() => createTestAttempt(optionsRef.current), []);
  useEffect(() => {
    const pageHide = (event) => {
      if (event.persisted) recorder.checkpoint();
      else recorder.interrupt("page_closed");
    };
    const heartbeat = window.setInterval(() => recorder.checkpoint(), 15000);
    window.addEventListener("pagehide", pageHide);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", pageHide);
      recorder.interrupt("left_test");
    };
  }, [recorder]);
  return recorder;
}
