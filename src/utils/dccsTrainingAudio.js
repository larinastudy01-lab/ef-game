import color from "../asset/voice/這一關要看衣服的顏色  把一樣顏色的衣服放到同一個籃子！.mp3";
import category from "../asset/voice/這次不看顏色，要看衣服的種類喔！上衣放在上衣的籃子 帽子放在帽子的籃子.mp3";
import bag from "../asset/voice/這次要看透明袋子裡的衣服喔！把衣服放到跟衣服顏色一樣的籃子裡！.mp3";
import change from "../asset/voice/注意喔，現在要換規則了。.mp3";
import changeAgain from "../asset/voice/又要換新玩法囉！.mp3";

// Reuse the recordings. The conditional and wind instructions have no matching
// recording in voice/, so speak only those missing lines in Traditional Chinese.
const windRule = { text: "風吹來的時候，要選另一個籃子。風停後，再照原本的規則分類。" };
export const DCCS_TRAINING_AUDIO = Object.freeze({
  color: [{ src: color }],
  colorWithWind: [{ src: color }, windRule],
  type: [{ src: change }, { src: category }],
  bag: [{ src: changeAgain }, { src: bag },
    { text: "沒有透明袋子時，就看衣服種類。上衣放到上衣的籃子，帽子放到帽子的籃子。" }],
  windReverse: [{ text: "風來了，選另一個籃子。" }],
  windRestore: [{ text: "風停了，照原本的規則分類。" }],
});

// A cue owns its whole queue. Replays, rule changes and unmount remove every
// handler and watchdog before another recording or utterance can start.
export function createDccsTrainingAudioPlayer(onPlayback) {
  let cancel = null;
  return {
    stop() { cancel?.(); },
    play(cue, { onEnded, onError } = {}) {
      this.stop();
      let stopped = false;
      let disposeClip = null;
      let index = 0;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        disposeClip?.();
        cancel = null;
        onPlayback?.(false);
      };
      const fail = () => {
        if (stopped) return;
        stop();
        onError?.();
      };
      const next = () => {
        if (stopped) return;
        disposeClip?.();
        disposeClip = null;
        onPlayback?.(false);
        const clip = DCCS_TRAINING_AUDIO[cue]?.[index++];
        if (!clip) { stop(); onEnded?.(); return; }
        let timer;
        let active = true;
        const playing = () => { if (!stopped && active) onPlayback?.(true); };
        const waiting = () => { if (!stopped && active) onPlayback?.(false); };
        const ended = () => { if (!stopped && active) next(); };
        const failed = () => { if (!stopped && active) fail(); };
        if (clip.src) {
          let audio;
          try { audio = new Audio(clip.src); } catch { fail(); return; }
          disposeClip = () => {
            active = false;
            clearTimeout(timer);
            audio.onended = audio.onerror = audio.onplaying = audio.onpause = audio.onwaiting = null;
            audio.pause();
          };
          audio.preload = "auto";
          audio.onended = ended;
          audio.onerror = failed;
          audio.onpause = audio.onwaiting = waiting;
          audio.onplaying = () => {
            if (stopped || !active) return;
            playing();
            clearTimeout(timer);
            timer = setTimeout(failed, Number.isFinite(audio.duration) ? audio.duration * 1000 + 5000 : 30000);
          };
          timer = setTimeout(failed, 15000);
          try { Promise.resolve(audio.play()).catch(failed); } catch { failed(); }
        } else {
          const synth = window.speechSynthesis;
          if (!synth || typeof window.SpeechSynthesisUtterance !== "function") { fail(); return; }
          let utterance;
          try {
            utterance = new window.SpeechSynthesisUtterance(clip.text);
            utterance.lang = "zh-TW";
            const voices = synth.getVoices();
            const voice = voices.find((item) => /^zh[-_]TW$/i.test(item.lang))
              || voices.find((item) => /^zh/i.test(item.lang));
            if (voice) utterance.voice = voice;
            utterance.rate = 1;
            utterance.onstart = utterance.onresume = playing;
            utterance.onpause = waiting;
            utterance.onend = ended;
            utterance.onerror = failed;
            disposeClip = () => {
              active = false;
              clearTimeout(timer);
              utterance.onstart = utterance.onresume = utterance.onpause = utterance.onend = utterance.onerror = null;
              synth.cancel();
            };
            timer = setTimeout(failed, 30000);
            synth.speak(utterance);
          } catch { failed(); }
        }
      };
      cancel = stop;
      next();
    },
  };
}
