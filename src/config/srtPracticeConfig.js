import acorn from "../asset/SRT/training/acorn.webp";
import rottenAcorn from "../asset/SRT/training/rotten_acorn.webp";
import enterPractice from "../asset/voice/換你開始點囉.mp3";
import beforeTrial from "../asset/voice/題目要開始囉.mp3";
import operationHint from "../asset/voice/點擊你的答案.mp3";
import practiceComplete from "../asset/voice/完成囉 你實在是太棒了.mp3";
import { SRT_ITEM_SIZE } from "../utils/srtProtocol";

// Practice owns its settings. Null means inherit the current assessment runtime,
// not that the independent practice timing has been clinically confirmed.
export const SRT_PRACTICE_CONFIG = {
  version: "1.2.0",
  stimuli: {
    normal: { img: acorn, label: "好橡實", width: 151, height: 194 },
    rotten: { img: rottenAcorn, label: "壞橡實", width: 166, height: 201 },
  },
  ratio: { target: 3, nonTarget: 1 },
  itemSizePx: SRT_ITEM_SIZE,
  stimulusDurationMs: 1000,
  responseWindowMs: 1000,
  interStimulusIntervalMs: 1500, // 1000ms visible, then 500ms without an acorn.
  requiredCorrectStreak: 2,
  requireBothTypesCorrect: true,
  maxTrials: 20,
  feedbackDurationMs: 500,
  completionAnimationMs: 1000,
  feedbackAnimationEnabled: true,
  handAnimation: { enabled: true, durationMs: 1800, showDuringTrials: false },
  audio: {
    enabled: true,
    maxWaitMs: 10000,
    events: { enterPractice, beforeTrial, operationHint, practiceComplete },
  },
};
