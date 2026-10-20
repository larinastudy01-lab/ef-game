import question from "../asset/voice/題目要開始囉.mp3";
import yourTurn from "../asset/voice/換你開始點囉.mp3";
import idle from "../asset/voice/點擊你的答案.mp3";
import complete from "../asset/voice/完成囉 你實在是太棒了.mp3";

export const LB_PRACTICE_AUDIO = { question, yourTurn, idle, complete };

export function waitForLBPractice(ms, signal) {
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

// Wait for each recording to end before advancing. Errors, blocked autoplay or
// missing media must not leave the child's controls permanently locked.
export function playLBPracticeCue(event, signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let audio;
    try { audio = new Audio(LB_PRACTICE_AUDIO[event]); } catch { resolve(); return; }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", finish);
      signal.removeEventListener("abort", finish);
      audio.pause();
      resolve();
    };
    // All four existing clips are short; bound failures to load or emit ended.
    const timer = window.setTimeout(finish, 12000);
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    signal.addEventListener("abort", finish, { once: true });
    try { Promise.resolve(audio.play()).catch(finish); } catch { finish(); }
  });
}
