import intro from "../asset/voice/一起幫綿羊奶奶找到回家的路吧！.mp3";
import rule1 from "../asset/voice/按照數字，從一開始，照順序點下去喔！.mp3";
import turn1 from "../asset/voice/從數字一開始，換你試試看！.mp3";
import transition from "../asset/voice/現在要換一種玩法囉！.mp3";
import rule2 from "../asset/voice/這次要照數字順序，黃色、藍色，輪流點喔！.mp3";
import guide2 from "../asset/voice/先點黃色的一，再點藍色的二，接著繼續往下找！.mp3";
import turn2 from "../asset/voice/記得喔！數字要照順序，顏色也要輪流！.mp3";
import numberError1 from "../asset/voice/哎呀！看看下一個數字是多少？.mp3";
import numberError2 from "../asset/voice/再看看喔！數字要照順序！.mp3";
import colorError from "../asset/voice/哎呀！看看這次應該點什麼顏色？.mp3";
import retry1 from "../asset/voice/沒關係，再從一開始試試看！.mp3";
import retry2 from "../asset/voice/沒關係！記住黃色、藍色的順序，輪流點！.mp3";
import idle from "../asset/voice/點擊你的答案.mp3";
import complete from "../asset/voice/完成囉 你實在是太棒了.mp3";

export const LB_PRACTICE_AUDIO = {
  intro, rule1, turn1, transition, rule2, guide2, turn2,
  numberError1, numberError2, colorError, retry1, retry2, idle, complete,
};

// The second rule's recording includes its transition into the color rule.
// Practice and assessment share the selected completion recording.
export const LB_FORMAL_AUDIO = { rule1, rule2, complete };

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
export function playLBPracticeCue(event, signal, onPlayback) {
  return playLBAudio(LB_PRACTICE_AUDIO[event], signal, event, onPlayback);
}

export function playLBFormalCue(event, signal, onPlayback) {
  return playLBAudio(LB_FORMAL_AUDIO[event], signal, event, onPlayback);
}

function playLBAudio(src, signal, event, onPlayback) {
  if (signal.aborted || !src) return Promise.resolve();
  return new Promise((resolve) => {
    let audio;
    try { audio = new Audio(src); } catch { resolve(); return; }
    let finished = false;
    let playing = false;
    const update = () => {
      if (playing && !finished) onPlayback?.({ event, currentTime: audio.currentTime });
    };
    const started = () => { playing = true; update(); };
    const paused = () => { playing = false; onPlayback?.(null); };
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", finish);
      audio.removeEventListener("playing", started);
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("seeked", update);
      audio.removeEventListener("pause", paused);
      signal.removeEventListener("abort", finish);
      audio.pause();
      onPlayback?.(null);
      resolve();
    };
    // Bound failures to load or emit ended so controls cannot remain locked.
    const timer = window.setTimeout(finish, 12000);
    audio.preload = "auto";
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    audio.addEventListener("playing", started);
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("seeked", update);
    audio.addEventListener("pause", paused);
    signal.addEventListener("abort", finish, { once: true });
    try { Promise.resolve(audio.play()).catch(finish); } catch { finish(); }
  });
}
