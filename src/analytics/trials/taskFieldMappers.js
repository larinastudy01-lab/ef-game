import { normalizeTaskCode } from "./constants";
import { getTrialResponseState } from "./validation";

const first = (...values) => values.find((value) => value !== undefined && value !== null);
const asBoolean = (value) => (typeof value === "boolean" ? value : null);
const asNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const COMMON_SOURCE_KEYS = new Set([
  "trialId", "trial_id", "trialIndex", "trialNumber", "stepIndex", "roundIndex",
  "task", "taskName", "taskCode", "difficulty", "level", "condition", "isCorrect",
  "correct", "reactionTime", "responseTime", "answerTime", "rt", "errorType", "wrongType", "timestamp",
  "createdAt", "completed", "isTimeout", "timeout", "actualResponse", "expectedResponse",
]);

function taskSpecificMetadata(raw) {
  return Object.fromEntries(Object.entries(raw || {}).filter(([key]) => !COMMON_SOURCE_KEYS.has(key)));
}

function mapStimulus(taskCode, raw) {
  if (taskCode === "CBT") return first(raw.targetSequence, raw.sequence, raw.correctSequence);
  if (taskCode === "PM") return first(raw.correctIds, raw.memorizeItems, raw.memoryItems);
  if (taskCode === "SRT") return { targetType: raw.targetType, positionX: raw.positionX, positionY: raw.positionY };
  if (taskCode === "ARI") return first(raw.stimulus, raw.target, raw.targetSide, raw.probeSide, raw.imageUrl);
  if (taskCode === "LB") return { expectedKey: raw.expectedKey, expectedNumber: raw.expectedNumber, expectedColor: raw.expectedColor };
  if (taskCode === "DCCS") return { cardId: raw.cardId, color: raw.cardColor, type: raw.cardType, cue: raw.cue };
  return first(raw.stimulus, null);
}

function mapExpectedResponse(taskCode, raw) {
  if (taskCode === "CBT") return first(raw.targetSequence, raw.sequence, raw.correctSequence);
  if (taskCode === "PM") return first(raw.correctIds, raw.expectedResponse);
  if (taskCode === "SRT") return first(raw.shouldClick, raw.targetType === "rotten" ? "withhold" : null, raw.expectedResponse);
  if (taskCode === "ARI") return first(raw.expectedTarget, raw.correctAnswer, raw.expectedResponse, raw.targetSide, raw.probeSide);
  if (taskCode === "LB") return first(raw.expectedKey, raw.expectedNumber, raw.expectedResponse);
  if (taskCode === "DCCS") return first(raw.correctSide, raw.correctPosition, raw.expectedResponse);
  return raw.expectedResponse;
}

function mapActualResponse(taskCode, raw) {
  if (taskCode === "CBT") return first(raw.userSequence, raw.clickedSequence, raw.answer);
  if (taskCode === "PM") return first(raw.selectedIds, raw.actualResponse);
  if (taskCode === "SRT") return first(raw.trainingAction, raw.action, raw.actualResponse);
  if (taskCode === "ARI") return first(raw.selectedTarget, raw.userAnswer, raw.selectedPosition, raw.selectedSide, raw.response, raw.actualResponse);
  if (taskCode === "LB") return first(raw.clickedKey, raw.clickedNumber, raw.actualResponse);
  if (taskCode === "DCCS") return first(raw.userAnswerSide, raw.selectedPosition, raw.actualResponse);
  return raw.actualResponse;
}

export function mapRawTrial(rawTrial = {}, taskValue, fallbackIndex = 0) {
  const taskCode = normalizeTaskCode(taskValue || rawTrial.taskCode || rawTrial.task || rawTrial.taskName);
  const timedOut = Boolean(first(rawTrial.isTimeout, rawTrial.timeout, false));
  const actualResponse = mapActualResponse(taskCode, rawTrial);
  const legacySourceTrialKey = String(first(rawTrial.trialId, rawTrial.trial_id, rawTrial.trialIndex, rawTrial.trialNumber, rawTrial.stepIndex, fallbackIndex + 1));
  const stagedLB = taskCode === "LB" && rawTrial.stageId != null;
  const sourceTrialKey = stagedLB
    ? `LB:${rawTrial.stageId}:${first(rawTrial.stepIndex, rawTrial.stepInLevel, rawTrial.trialNumber, rawTrial.trialIndex, fallbackIndex + 1)}`
    : legacySourceTrialKey;
  // A PM deselection is a legal edit. Missing duplicate-click evidence stays
  // unknown; neither a deselection nor a repeated selection implies a double click.
  const pmEvents = rawTrial.clickLogs || rawTrial.tapLogs;
  const duplicateEvents = taskCode === "PM" && Array.isArray(pmEvents)
    ? pmEvents.filter((event) => ["doubleClick", "repeatedClick"].includes(event.action)).length : 0;
  const pmDuplicateCounts = [rawTrial.doubleClickCount, rawTrial.repeatedClickCount, rawTrial.errorTypes?.repeatedClick]
    .map(asNumber).filter((count) => count !== null && count >= 0);
  const pmState = taskCode === "PM" ? getTrialResponseState(rawTrial) : null;
  return {
    sourceTrialKey,
    ...(stagedLB ? { legacySourceTrialKey } : {}),
    taskCode,
    taskName: taskCode,
    trialIndex: stagedLB ? fallbackIndex + 1 : asNumber(first(rawTrial.trialIndex, rawTrial.trialNumber, rawTrial.stepIndex, rawTrial.stepInLevel, rawTrial.roundIndex, fallbackIndex + 1)),
    stimulus: mapStimulus(taskCode, rawTrial),
    condition: first(rawTrial.condition, rawTrial.ruleStage, rawTrial.rule, rawTrial.targetType, rawTrial.stageId, null),
    difficulty: String(first(rawTrial.difficulty, rawTrial.microDifficulty, rawTrial.level, "default")),
    expectedResponse: mapExpectedResponse(taskCode, rawTrial),
    actualResponse,
    isCorrect: asBoolean(first(rawTrial.isCorrect, rawTrial.correct)),
    reactionTimeMs: asNumber(first(rawTrial.reactionTime, rawTrial.responseTime, rawTrial.answerTime, rawTrial.rt)),
    errorType: first(rawTrial.errorType, rawTrial.wrongType, (pmState?.timedOut ?? timedOut) ? "timeout" : null),
    occurredAt: first(rawTrial.createdAt, rawTrial.timestamp, null),
    timedOut: pmState?.timedOut ?? timedOut,
    completed: first(rawTrial.completed, true) !== false,
    responseRequired: !(taskCode === "SRT" && rawTrial.targetType === "rotten"),
    invalidResponse: Boolean(rawTrial.invalidResponse),
    doubleClickCount: taskCode === "PM"
      ? (pmDuplicateCounts.length || duplicateEvents ? Math.max(duplicateEvents, ...pmDuplicateCounts) : null)
      : asNumber(first(rawTrial.repeatedClickCount, rawTrial.deselectCount, 0)),
    taskSpecificMetadata: {
      ...taskSpecificMetadata(rawTrial),
      ...(pmState ? pmState : {}),
    },
    rawData: rawTrial,
  };
}
