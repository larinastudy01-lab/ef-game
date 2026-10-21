import colorIntro from "../asset/voice/看看這件衣服是什麼顏色，放到一樣顏色的地方！.mp3";
import categoryIntro from "../asset/voice/這次不看顏色，要看衣服的種類喔！上衣放在上衣的籃子 帽子放在帽子的籃子.mp3";
import bagIntro from "../asset/voice/這次要看透明袋子裡的衣服喔！把衣服放到跟衣服顏色一樣的籃子裡！.mp3";
import colorCorrect from "../asset/voice/答對了！顏色一樣！.mp3";
import categoryCorrect from "../asset/voice/答對了！種類一樣！.mp3";
import bagCorrect from "../asset/voice/答對了！你有看袋子裡的衣服！.mp3";
import colorRetry from "../asset/voice/再看看喔！這一關要看衣服的顏色！.mp3";
import categoryRetry from "../asset/voice/再看看喔！這一關要看衣服的種類！.mp3";
import bagRetry from "../asset/voice/再看一次喔！要看袋子裡面的衣服顏色！.mp3";
import colorFormal from "../asset/voice/現在要看衣服的顏色，把衣服放到對的地方。.mp3";
import categoryFormal from "../asset/voice/現在要看衣服的種類，把衣服放到對的地方。.mp3";
import bagFormal from "../asset/voice/現在要看袋子裡面的衣服，把衣服放到對的地方。.mp3";
import passed from "../asset/voice/你學會了！準備開始挑戰吧！.mp3";

export const DCCS_ASSESSMENT_AUDIO = Object.freeze({
  color: { intro: colorIntro, correct: colorCorrect, retry: colorRetry, formal: colorFormal, passed },
  category: { intro: categoryIntro, correct: categoryCorrect, retry: categoryRetry, formal: categoryFormal, passed },
  bag_color: { intro: bagIntro, correct: bagCorrect, retry: bagRetry, formal: bagFormal, passed },
});

// Every playback owns its callbacks and watchdog. Stop/replay/unmount cannot
// leave a stale callback that advances the next scene or creates overlapping audio.
export function createDccsAudioPlayer(onPlayback) {
  let cleanup = null;
  return {
    stop() { cleanup?.(); },
    play(rule, cue, { onEnded, onError } = {}) {
      this.stop();
      let audio;
      try { audio = new Audio(DCCS_ASSESSMENT_AUDIO[rule][cue]); }
      catch { onError?.(); return; }
      let stopped = false;
      let watchdog;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        clearTimeout(watchdog);
        audio.onended = audio.onerror = audio.onplaying = audio.onwaiting = audio.onpause = null;
        audio.pause();
        cleanup = null;
        onPlayback?.(false);
      };
      const finish = (failed) => {
        if (stopped) return;
        stop();
        if (failed) onError?.(); else onEnded?.();
      };
      cleanup = stop;
      audio.preload = "auto";
      audio.onended = () => finish(false);
      audio.onerror = () => finish(true);
      audio.onplaying = () => {
        if (stopped) return;
        onPlayback?.(true);
        clearTimeout(watchdog);
        watchdog = setTimeout(() => finish(true),
          Number.isFinite(audio.duration) ? audio.duration * 1000 + 5000 : 30000);
      };
      audio.onwaiting = audio.onpause = () => { if (!stopped) onPlayback?.(false); };
      watchdog = setTimeout(() => finish(true), 15000);
      try { Promise.resolve(audio.play()).catch(() => finish(true)); }
      catch { finish(true); }
    },
  };
}
