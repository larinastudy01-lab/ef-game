import enterPractice from "../asset/voice/小松鼠要收集橡實囉！一起來幫忙吧！.mp3";
import ruleGo from "../asset/voice/看到好的橡實，就快快點！.mp3";
import ruleNoGo from "../asset/voice/看到壞掉的橡實，千萬不要點喔！.mp3";
import beforeTrial from "../asset/voice/準備好了嗎？看仔細，開始囉！.mp3";
import correct from "../asset/voice/太棒了！你真厲害！.mp3";
import wrongNoGo from "../asset/voice/哎呀！壞掉的橡實不能撿喔！.mp3";
import missedGo from "../asset/voice/看到好的橡實，要快快點擊喔！.mp3";
import retry from "../asset/voice/沒關係，我們再試一次！.mp3";
import practiceComplete from "../asset/voice/你學會了！準備開始挑戰吧！.mp3";
import assessmentComplete from "../asset/voice/完成囉！你真的很努力！.mp3";

// Reuse the recorded prompts; replace individual files here when new recordings arrive.
export const SRT_AUDIO_CONFIG = {
  enabled: true,
  maxWaitMs: 10000,
  events: {
    enterPractice, ruleGo, ruleNoGo, beforeTrial, correct,
    wrongNoGo, missedGo, retry, practiceComplete, assessmentComplete,
  },
};

export const SRT_ASSESSMENT_INTRO_CUES = ["ruleGo", "ruleNoGo", "beforeTrial"];
