import acorn from "../asset/SRT/training/acorn.webp";
import rottenAcorn from "../asset/SRT/training/rotten_acorn.webp";
import { SRT_AUDIO_CONFIG } from "./srtAudioConfig";
import { SRT_ITEM_SIZE } from "../utils/srtProtocol";

// Practice owns its settings. Null means inherit the current assessment runtime,
// not that the independent practice timing has been clinically confirmed.
export const SRT_PRACTICE_CONFIG = {
  version: "1.5.0",
  stimuli: {
    normal: { img: acorn, label: "好橡實", width: 151, height: 194 },
    rotten: { img: rottenAcorn, label: "壞橡實", width: 166, height: 201 },
  },
  ratio: { target: 3, nonTarget: 1 },
  itemSizePx: SRT_ITEM_SIZE,
  stimulusDurationMs: 2000,
  responseWindowMs: 2000,
  interStimulusIntervalMs: 2500, // 2000ms visible, then 500ms without an acorn.
  requiredCorrectStreak: 2,
  requireBothTypesCorrect: true,
  maxTrials: 20,
  feedbackDurationMs: 500,
  completionAnimationMs: 1000,
  feedbackAnimationEnabled: true,
  handAnimation: { enabled: true, durationMs: 1800, showDuringTrials: false },
  audio: SRT_AUDIO_CONFIG,
};
