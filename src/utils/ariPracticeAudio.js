import intro from "../asset/voice/換你開始點囉.mp3";
import question from "../asset/voice/題目要開始囉.mp3";
import answer from "../asset/voice/點擊你的答案.mp3";
import complete from "../asset/voice/完成囉 你實在是太棒了.mp3";
import cat from "../asset/ARI/cat.mp3";
import dog from "../asset/ARI/dog.mp3";

export const ARI_PRACTICE_AUDIO = { intro, question, answer, complete, cat, dog };

// Resolve only after ended. A blocked/missing/stalled recording is retried by
// the practice UI, never silently skipped (especially the stimulus/completion).
export function playAriPracticeAudio(src, signal) {
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
      signal.removeEventListener("abort", abort);
      audio.pause();
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new DOMException("Cancelled", "AbortError"));
    const fail = () => finish(new Error("ARI practice recording could not finish"));
    audio.preload = "auto";
    audio.onended = () => finish();
    audio.onerror = fail;
    audio.onplaying = () => {
      window.clearTimeout(timer);
      const durationMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : 11000;
      timer = window.setTimeout(fail, Math.max(4000, durationMs + 4000));
    };
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
