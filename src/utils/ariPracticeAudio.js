import intro from "../asset/voice/仔細聽喔！這次要找跟聲音不一樣的動物！.mp3";
import dogRule from "../asset/voice/聽到狗狗的叫聲，就要點貓咪！.mp3";
import catRule from "../asset/voice/聽到貓咪的叫聲，就要點狗狗！.mp3";
import question from "../asset/voice/小耳朵準備好！聽一聽，再點相反的動物！.mp3";
import answer from "../asset/voice/點擊你的答案.mp3";
import correct from "../asset/voice/太棒了！你有找到正確的動物喔！.mp3";
import wrong from "../asset/voice/哎呀！要點另一隻動物.mp3";
import retry from "../asset/voice/沒關係，重新找另一隻動物！.mp3";
import complete from "../asset/voice/太棒了！你學會找相反的動物了！.mp3";
import assessmentStart from "../asset/voice/記得喔！聽到聲音，要點另一隻動物！.mp3";
import assessmentComplete from "../asset/voice/完成囉！你真的很努力！.mp3";
import cat from "../asset/ARI/cat.mp3";
import dog from "../asset/ARI/dog.mp3";

export const ARI_PRACTICE_AUDIO = {
  intro, dogRule, catRule, question, answer, correct, wrong, retry, complete,
  assessmentStart, assessmentComplete, cat, dog,
};

// Resolve only after ended. A blocked/missing/stalled recording is retried by
// the practice UI, never silently skipped (especially the stimulus/completion).
export function playAriPracticeAudio(src, signal, onPlayback) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    let audio;
    try { audio = new Audio(src); } catch (error) { reject(error); return; }
    let settled = false;
    let timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.onended = null;
      audio.onerror = null;
      audio.onplaying = null;
      audio.onpause = null;
      audio.onwaiting = null;
      signal.removeEventListener("abort", abort);
      audio.pause();
      onPlayback?.(false);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new DOMException("Cancelled", "AbortError"));
    const fail = () => finish(new Error("ARI practice recording could not finish"));
    audio.preload = "auto";
    audio.onended = () => finish();
    audio.onerror = fail;
    audio.onplaying = () => {
      onPlayback?.(true);
      window.clearTimeout(timer);
      const durationMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : 11000;
      timer = window.setTimeout(fail, Math.max(4000, durationMs + 4000));
    };
    audio.onpause = () => onPlayback?.(false);
    audio.onwaiting = () => onPlayback?.(false);
    signal.addEventListener("abort", abort, { once: true });
    timer = window.setTimeout(fail, 12000);
    try { Promise.resolve(audio.play()).catch(fail); } catch { fail(); }
  });
}

export function waitForAriPractice(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}
