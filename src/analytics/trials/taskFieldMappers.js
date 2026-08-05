import { normalizeTaskCode } from "./constants";

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
  if (taskCode === "SSG") return first(raw.stimulus, raw.target, raw.targetSide, raw.probeSide, raw.imageUrl);
  if (taskCode === "LB") return { expectedKey: raw.expectedKey, expectedNumber: raw.expectedNumber, expectedColor: raw.expectedColor };
  if (taskCode === "DCCS") return { cardId: raw.cardId, color: raw.cardColor, type: raw.cardType, cue: raw.cue };
  return first(raw.stimulus, null);
}

function mapExpectedResponse(taskCode, raw) {
  if (taskCode === "CBT") return first(raw.targetSequence, raw.sequence, raw.correctSequence);
  if (taskCode === "PM") return first(raw.correctIds, raw.expectedResponse);
  if (taskCode === "SRT") return first(raw.shouldClick, raw.targetType === "rotten" ? "withhold" : null, raw.expectedResponse);
  if (taskCode === "SSG") return first(raw.expectedTarget, raw.correctAnswer, raw.expectedResponse, raw.targetSide, raw.probeSide);
  if (taskCode === "LB") return first(raw.expectedKey, raw.expectedNumber, raw.expectedResponse);
  if (taskCode === "DCCS") return first(raw.correctSide, raw.correctPosition, raw.expectedResponse);
  return raw.expectedResponse;
}

function mapActualResponse(taskCode, raw) {
  if (taskCode === "CBT") return first(raw.userSequence, raw.clickedSequence, raw.answer);
  if (taskCode === "PM") return first(raw.selectedIds, raw.actualResponse);
  if (taskCode === "SRT") return first(raw.trainingAction, raw.action, raw.actualResponse);
  if (taskCode === "SSG") return first(raw.selectedTarget, raw.userAnswer, raw.selectedPosition, raw.selectedSide, raw.response, raw.actualResponse);
  if (taskCode === "LB") return first(raw.clickedKey, raw.clickedNumber, raw.actualResponse);
  if (taskCode === "DCCS") return first(raw.userAnswerSide, raw.selectedPosition, raw.actualResponse);
  return raw.actualResponse;
}

export function mapRawTrial(rawTrial = {}, taskValue, fallbackIndex = 0) {
  const taskCode = normalizeTaskCode(taskValue || rawTrial.taskCode || rawTrial.task || rawTrial.taskName);
  const timedOut = Boolean(first(rawTrial.isTimeout, rawTrial.timeout, false));
  const actualResponse = mapActualResponse(taskCode, rawTrial);
  return {
    sourceTrialKey: String(first(rawTrial.trialId, rawTrial.trial_id, rawTrial.trialIndex, rawTrial.trialNumber, rawTrial.stepIndex, fallbackIndex + 1)),
    taskCode,
    taskName: taskCode,
    trialIndex: asNumber(first(rawTrial.trialIndex, rawTrial.trialNumber, rawTrial.stepIndex, rawTrial.stepInLevel, rawTrial.roundIndex, fallbackIndex + 1)),
    stimulus: mapStimulus(taskCode, rawTrial),
    condition: first(rawTrial.condition, rawTrial.ruleStage, rawTrial.rule, rawTrial.targetType, rawTrial.stageId, null),
    difficulty: String(first(rawTrial.difficulty, rawTrial.microDifficulty, rawTrial.level, "default")),
    expectedResponse: mapExpectedResponse(taskCode, rawTrial),
    actualResponse,
    isCorrect: asBoolean(first(rawTrial.isCorrect, rawTrial.correct)),
    reactionTimeMs: asNumber(first(rawTrial.reactionTime, rawTrial.responseTime, rawTrial.answerTime, rawTrial.rt)),
    errorType: first(rawTrial.errorType, rawTrial.wrongType, timedOut ? "timeout" : null),
    occurredAt: first(rawTrial.createdAt, rawTrial.timestamp, null),
    timedOut,
    completed: first(rawTrial.completed, true) !== false,
    responseRequired: !(taskCode === "SRT" && rawTrial.targetType === "rotten"),
    invalidResponse: Boolean(rawTrial.invalidResponse),
    doubleClickCount: asNumber(first(rawTrial.repeatedClickCount, rawTrial.deselectCount, 0)),
    taskSpecificMetadata: taskSpecificMetadata(rawTrial),
    rawData: rawTrial,
  };
}
