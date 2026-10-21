import memorize from "../asset/voice/仔細看看，把這些圖片記起來喔！.mp3";
import answer from "../asset/voice/找找看，剛剛看過哪些圖片？.mp3";
import reminder from "../asset/voice/點擊你的答案.mp3";
import cancel from "../asset/voice/點錯了嗎？再點一次就可以取消.mp3";
import correct from "../asset/voice/太棒了！你真厲害！.mp3";
import retry from "../asset/voice/沒關係，我們再試一次！.mp3";
import complete from "../asset/voice/你的記憶力真棒！準備開始囉！.mp3";

export const PM_PRACTICE_AUDIO = { memorize, answer, reminder, cancel, correct, retry, complete };

// One owned audio channel. Replaying replaces the active clip, and stopping a
// scene removes its callbacks as well as its failure watchdog.
export function createPMPracticeAudioPlayer(onPlayback) {
  let cleanup = null;
  return {
    get playing() { return cleanup !== null; },
    stop() { cleanup?.(); },
    play(event, onFinished) {
      this.stop();
      let audio;
      try { audio = new Audio(PM_PRACTICE_AUDIO[event]); } catch { onFinished?.(); return; }
      let finished = false;
      let watchdog;
      const stop = () => {
        if (finished) return;
        finished = true;
        clearTimeout(watchdog);
        audio.onended = null;
        audio.onerror = null;
        audio.onplaying = null;
        audio.onpause = null;
        audio.onwaiting = null;
        audio.pause();
        cleanup = null;
        onPlayback?.(null);
      };
      const finish = () => { if (finished) return; stop(); onFinished?.(); };
      cleanup = stop;
      onPlayback?.({ event, speaking: false });
      audio.preload = "auto";
      audio.onended = finish;
      audio.onerror = finish;
      audio.onplaying = () => {
        onPlayback?.({ event, speaking: true });
        clearTimeout(watchdog);
        watchdog = setTimeout(finish, Number.isFinite(audio.duration) ? audio.duration * 1000 + 3000 : 15000);
      };
      audio.onpause = () => onPlayback?.({ event, speaking: false });
      audio.onwaiting = () => onPlayback?.({ event, speaking: false });
      watchdog = setTimeout(finish, 12000);
      try { Promise.resolve(audio.play()).catch(finish); } catch { finish(); }
    },
  };
}
