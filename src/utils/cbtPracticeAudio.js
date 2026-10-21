import intro from "../asset/voice/仔細看，記住亮起來的順序！.mp3";
import answer from "../asset/voice/換你囉！照剛剛的順序點一點！.mp3";
import correct from "../asset/voice/太棒了！你記住順序了！.mp3";
import retry from "../asset/voice/沒關係，再從一開始試試看！.mp3";
import passed from "../asset/voice/你學會了！準備開始挑戰吧！.mp3";

// Exact imports let the bundler resolve punctuation and encode asset URLs.
export const CBT_PRACTICE_AUDIO = { intro, answer, correct, retry, passed };

export function createCBTPracticeAudioPlayer() {
  let cleanup = null;
  return {
    stop() { cleanup?.(); },
    play(cue, { onEnded, onPlaying, onWaiting, onBlocked }) {
      this.stop();
      let audio;
      try { audio = new Audio(CBT_PRACTICE_AUDIO[cue]); }
      catch { onBlocked("error"); return; }
      let stopped = false;
      let watchdog;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        clearTimeout(watchdog);
        audio.onended = null;
        audio.onerror = null;
        audio.onplaying = null;
        audio.onwaiting = null;
        audio.onpause = null;
        audio.pause();
        cleanup = null;
      };
      const failed = (reason) => {
        if (stopped) return;
        stop();
        onBlocked(reason);
      };
      cleanup = stop;
      audio.preload = "auto";
      audio.onended = () => { if (!stopped) { stop(); onEnded(); } };
      audio.onerror = () => failed("error");
      audio.onwaiting = onWaiting;
      audio.onpause = onWaiting;
      audio.onplaying = () => {
        if (stopped) return;
        clearTimeout(watchdog);
        watchdog = setTimeout(() => failed("error"),
          Number.isFinite(audio.duration) ? audio.duration * 1000 + 5000 : 30000);
        onPlaying();
      };
      // A stalled or rejected clip requires a user retry; it never silently
      // advances into sequence playback or starts the response deadline.
      watchdog = setTimeout(() => failed("error"), 15000);
      try {
        Promise.resolve(audio.play()).catch((error) =>
          failed(error?.name === "NotAllowedError" ? "blocked" : "error"));
      } catch (error) {
        failed(error?.name === "NotAllowedError" ? "blocked" : "error");
      }
    },
  };
}
