import { SRT_PRACTICE_CONFIG } from "../config/srtPracticeConfig";
import { gameLocalStorage } from "../temporaryGameTesting/runtime";

const positive = (value) => Number.isFinite(value) && value > 0;

export function resolveSrtPracticeConfig(overrides = {}, assessmentTiming = {}) {
  const config = {
    ...SRT_PRACTICE_CONFIG, ...overrides,
    ratio: { ...SRT_PRACTICE_CONFIG.ratio, ...overrides.ratio },
    handAnimation: { ...SRT_PRACTICE_CONFIG.handAnimation, ...overrides.handAnimation },
    audio: {
      ...SRT_PRACTICE_CONFIG.audio, ...overrides.audio,
      events: { ...SRT_PRACTICE_CONFIG.audio.events, ...overrides.audio?.events },
    },
  };
  const responseWindowMs = config.responseWindowMs ?? assessmentTiming.responseWindowMs;
  const configuredInterval = config.interStimulusIntervalMs ?? assessmentTiming.stimulusIntervalsMs;
  const intervals = Array.isArray(configuredInterval) ? configuredInterval : [configuredInterval];
  if (!positive(responseWindowMs) || !intervals.length || !intervals.every(positive)) {
    throw new Error("SRT practice requires a positive response window and stimulus interval.");
  }
  for (const field of ["stimulusDurationMs", "maxTrials", "requiredCorrectStreak", "feedbackDurationMs", "completionAnimationMs"]) {
    if (!positive(config[field])) throw new Error(`Invalid SRT practice setting: ${field}`);
  }
  if (!positive(config.handAnimation.durationMs) || !positive(config.audio.maxWaitMs) ||
      !Number.isInteger(config.maxTrials) || !Number.isInteger(config.requiredCorrectStreak) ||
      config.ratio.target !== 3 || config.ratio.nonTarget !== 1) {
    throw new Error("Invalid SRT practice limits, cue timing, or 3:1 stimulus ratio.");
  }
  if (responseWindowMs < config.stimulusDurationMs) {
    throw new Error("SRT practice response window cannot end before the stimulus disappears.");
  }
  return {
    ...config, responseWindowMs, stimulusIntervalsMs: [...intervals],
    timingSource: {
      responseWindowMs: config.responseWindowMs == null ? "inherited_assessment_pending_confirmation" : "practice_config",
      interStimulusIntervalMs: config.interStimulusIntervalMs == null ? "inherited_assessment_pending_confirmation" : "practice_config",
    },
  };
}

// An independent queue; examples and hints never consume a practice trial.
export function createSrtPracticeQueue(random = Math.random, ratio = SRT_PRACTICE_CONFIG.ratio) {
  let queue = [];
  let previous = null;
  return () => {
    if (!queue.length) {
      queue = [...Array(ratio.target).fill("normal"), ...Array(ratio.nonTarget).fill("rotten")];
      for (let index = queue.length - 1; index > 0; index -= 1) {
        const swap = Math.min(index, Math.floor(random() * (index + 1)));
        [queue[index], queue[swap]] = [queue[swap], queue[index]];
      }
      if (previous === "rotten" && queue[0] === "rotten") {
        const normalIndex = queue.indexOf("normal");
        [queue[0], queue[normalIndex]] = [queue[normalIndex], queue[0]];
      }
    }
    previous = queue.shift();
    return previous;
  };
}

export const emptySrtPracticeProgress = () => ({
  correctStreak: 0, maxStreak: 0, hasCorrectGo: false, hasCorrectNoGo: false, passed: false,
});

export function updateSrtPracticeProgress(progress, record, config) {
  const correctStreak = record.isCorrect ? progress.correctStreak + 1 : 0;
  const hasCorrectGo = progress.hasCorrectGo || (record.isCorrect && record.targetType === "normal");
  const hasCorrectNoGo = progress.hasCorrectNoGo || (record.isCorrect && record.targetType === "rotten");
  return {
    correctStreak, hasCorrectGo, hasCorrectNoGo,
    maxStreak: Math.max(progress.maxStreak, correctStreak),
    passed: correctStreak >= config.requiredCorrectStreak &&
      (!config.requireBothTypesCorrect || (hasCorrectGo && hasCorrectNoGo)),
  };
}

export function buildSrtPracticeResult({ records, progress, hintCount, startedAtMs, status, config, audioEvents = [] }) {
  return {
    gameId: "SRT", mode: "practice", status,
    startedAt: new Date(startedAtMs).toISOString(),
    updatedAt: new Date().toISOString(),
    practice_attempt_count: records.length,
    practice_correct_count: records.filter((record) => record.isCorrect).length,
    practice_error_count: records.filter((record) => !record.isCorrect).length,
    practice_timeout_count: records.filter((record) => record.timeout).length,
    practice_max_streak: progress.maxStreak,
    practice_hint_count: hintCount,
    practice_passed: progress.passed,
    practice_duration_ms: Math.max(0, Date.now() - startedAtMs),
    hasCorrectGo: progress.hasCorrectGo, hasCorrectNoGo: progress.hasCorrectNoGo,
    protocol: {
      version: config.version, stimulusDurationMs: config.stimulusDurationMs,
      responseWindowMs: config.responseWindowMs, stimulusIntervalsMs: config.stimulusIntervalsMs,
      timingSource: config.timingSource, targetToNonTargetRatio: [3, 1],
      requiredCorrectStreak: config.requiredCorrectStreak, maxTrials: config.maxTrials,
    },
    trials: [...records], audioEvents: [...audioEvents],
  };
}

// Deliberately bypass resultManager: it only handles scored test/training results.
export function saveSrtPracticeResult(result, childId, storage = gameLocalStorage) {
  if (!childId) return;
  try {
    storage.setItem(`srtPracticeResult_${childId}`, JSON.stringify({ ...result, childId }));
  } catch (error) {
    console.error("SRT 試玩紀錄無法儲存：", error);
  }
}
