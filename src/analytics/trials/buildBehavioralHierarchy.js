import {
  BEHAVIORAL_SCHEMA_VERSION,
  TASK_NAMES,
  TRIAL_PROCESSING_VERSION,
  normalizeSessionMode,
  normalizeTaskCode,
} from "./constants";
import { mapRawTrial } from "./taskFieldMappers";
import { validateTrialCollection } from "./validation";

export function createBehavioralId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function iso(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function deviceInformation() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return {};
  return {
    userAgent: navigator.userAgent || null,
    language: navigator.language || null,
    platform: navigator.platform || null,
    screenWidth: window.screen?.width || null,
    screenHeight: window.screen?.height || null,
    pixelRatio: window.devicePixelRatio || null,
  };
}

function taskProtocolSnapshot(rawResult) {
  const excluded = new Set([
    "childId", "childName", "name", "nickname", "fullName", "patientId",
    "trials", "trialLogs", "records", "logs", "history", "rounds",
  ]);
  return Object.fromEntries(
    Object.entries(rawResult || {}).filter(([key]) => !excluded.has(key))
  );
}

export function buildBehavioralHierarchy(normalizedResult, options = {}) {
  const taskCode = normalizeTaskCode(normalizedResult?.game?.gameId);
  const mode = normalizeSessionMode(normalizedResult?.session?.mode);
  const now = new Date().toISOString();
  const sessionId = normalizedResult?.behavioral?.sessionId || options.sessionId || createBehavioralId();
  const taskSessionId = normalizedResult?.behavioral?.taskSessionId || options.taskSessionId || createBehavioralId();
  const rawTrials = Array.isArray(normalizedResult?.trials) ? normalizedResult.trials : [];
  const mapped = rawTrials.map((trial, index) => mapRawTrial(trial, taskCode, index));
  const trials = validateTrialCollection(mapped, {
    taskCode,
    interrupted: options.interrupted || normalizedResult?.session?.status === "interrupted",
    browserRefresh: Boolean(options.browserRefresh),
    repeatedSubmit: Boolean(options.repeatedSubmit),
  }).map((trial, index) => ({
    ...trial,
    trialId: normalizedResult?.behavioral?.trialIds?.[index] || createBehavioralId(),
  }));
  const startedAt = iso(normalizedResult?.session?.startedAt, normalizedResult?.createdAt || now);
  const completedAt = iso(normalizedResult?.session?.finishedAt, now);
  const validReactionTimes = trials.filter((trial) => trial.validTrial && Number.isFinite(trial.reactionTimeMs)).map((trial) => trial.reactionTimeMs);

  return {
    schemaVersion: BEHAVIORAL_SCHEMA_VERSION,
    participant: {
      // Transport reference only. Database resolves this patient UUID to a separate research participant UUID.
      patientReference: normalizedResult?.child?.childId || null,
      researchParticipantId: null,
    },
    session: {
      sessionId,
      participantId: null,
      sessionType: options.sessionType || "single_task_session",
      assessmentOrTraining: mode,
      startedAt,
      completedAt,
      deviceInformation: options.deviceInformation || deviceInformation(),
      taskOrder: options.taskOrder || [taskCode],
      sessionStatus: options.sessionStatus || "completed",
      sourceResultId: normalizedResult?.resultId || null,
    },
    taskSession: {
      taskSessionId,
      sessionId,
      taskName: TASK_NAMES[taskCode] || taskCode,
      taskCode,
      difficulty: normalizedResult?.session?.difficulty || "default",
      startedAt,
      completedAt,
      totalTrials: trials.length,
      correctTrials: trials.filter((trial) => trial.isCorrect === true).length,
      incorrectTrials: trials.filter((trial) => trial.isCorrect === false).length,
      meanReactionTime: validReactionTimes.length
        ? validReactionTimes.reduce((sum, value) => sum + value, 0) / validReactionTimes.length
        : null,
      completionStatus: options.completionStatus || "completed",
      // Trial raw data remains exact below. This task snapshot deliberately omits
      // identity fields and duplicated trial arrays from the research hierarchy.
      rawData: taskProtocolSnapshot(normalizedResult?.rawResult),
    },
    trials,
    processingVersion: TRIAL_PROCESSING_VERSION,
  };
}
