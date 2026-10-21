export function waitForSrtPractice(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

// Each cue finishes (or fails and is stopped) before the next cue/trial begins.
export function playSrtCue(event, audioConfig, signal) {
  if (signal.aborted || !audioConfig.enabled) return Promise.resolve("skipped");
  const src = audioConfig.events[event];
  if (!src) return Promise.resolve("missing");
  return new Promise((resolve) => {
    let audio;
    try { audio = new Audio(src); } catch { resolve("failed"); return; }
    let finished = false;
    const finish = (outcome) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
      audio.pause();
      resolve(outcome);
    };
    const ended = () => finish("ended");
    const failed = () => finish("failed");
    const aborted = () => finish("aborted");
    const timer = setTimeout(() => finish("timeout"), audioConfig.maxWaitMs);
    audio.addEventListener("ended", ended);
    audio.addEventListener("error", failed);
    signal.addEventListener("abort", aborted, { once: true });
    try { Promise.resolve(audio.play()).catch(failed); } catch { failed(); }
  });
}
