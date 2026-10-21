import { SRT_PRACTICE_CONFIG } from "../config/srtPracticeConfig";
import {
  createSrtPracticeQueue, emptySrtPracticeProgress, resolveSrtPracticeConfig,
  saveSrtPracticeResult, updateSrtPracticeProgress,
} from "./srtPracticeProtocol";

const timing = { responseWindowMs: 500, stimulusIntervalsMs: [1000, 3000] };

test("practice uses a two-second display and response window followed by a half-second blank", () => {
  expect(SRT_PRACTICE_CONFIG.responseWindowMs).toBe(2000);
  expect(SRT_PRACTICE_CONFIG.interStimulusIntervalMs).toBe(2500);
  expect(resolveSrtPracticeConfig({}, timing)).toMatchObject({
    stimulusDurationMs: 2000, responseWindowMs: 2000, stimulusIntervalsMs: [2500],
    timingSource: { responseWindowMs: "practice_config", interStimulusIntervalMs: "practice_config" },
  });
  expect(resolveSrtPracticeConfig({ stimulusDurationMs: 500, responseWindowMs: 1200, interStimulusIntervalMs: 2000 })).toMatchObject({
    stimulusDurationMs: 500, responseWindowMs: 1200, stimulusIntervalsMs: [2000],
  });
  expect(() => resolveSrtPracticeConfig({ responseWindowMs: null, interStimulusIntervalMs: null })).toThrow();
  expect(() => resolveSrtPracticeConfig({ responseWindowMs: 200, interStimulusIntervalMs: 1000 })).toThrow();
});

test.each([0, 0.25, 0.5, 0.99])("practice has three go and one no-go per shuffled block (seed %s)", (random) => {
  const next = createSrtPracticeQueue(() => random);
  const types = Array.from({ length: 80 }, next);
  for (let offset = 0; offset < types.length; offset += 4) {
    const block = types.slice(offset, offset + 4);
    expect(block.filter((type) => type === "normal")).toHaveLength(3);
    expect(block.filter((type) => type === "rotten")).toHaveLength(1);
  }
  expect(types.some((type, index) => type === "rotten" && types[index + 1] === "rotten")).toBe(false);
});

test("practice order varies instead of presenting a fixed rule sequence", () => {
  const low = createSrtPracticeQueue(() => 0);
  const high = createSrtPracticeQueue(() => 0.99);
  expect(Array.from({ length: 4 }, low)).not.toEqual(Array.from({ length: 4 }, high));
});

test("two correct go trials alone cannot pass; a mistake resets the streak but preserves independently demonstrated rules", () => {
  const config = resolveSrtPracticeConfig({}, timing);
  let progress = emptySrtPracticeProgress();
  const go = { isCorrect: true, targetType: "normal" };
  progress = updateSrtPracticeProgress(progress, go, config);
  progress = updateSrtPracticeProgress(progress, go, config);
  expect(progress).toMatchObject({ correctStreak: 2, passed: false, hasCorrectNoGo: false });
  progress = updateSrtPracticeProgress(progress, { isCorrect: false, targetType: "rotten" }, config);
  expect(progress).toMatchObject({ correctStreak: 0, hasCorrectGo: true });
  progress = updateSrtPracticeProgress(progress, { isCorrect: true, targetType: "rotten" }, config);
  expect(progress.passed).toBe(false);
  progress = updateSrtPracticeProgress(progress, go, config);
  expect(progress).toMatchObject({ correctStreak: 2, passed: true, maxStreak: 2 });
});

test("practice persistence only writes a child-scoped practice key", () => {
  const storage = { setItem: jest.fn() };
  saveSrtPracticeResult({ mode: "practice", practice_passed: true }, "child-a", storage);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  expect(storage.setItem).toHaveBeenCalledWith("srtPracticeResult_child-a", expect.any(String));
});
