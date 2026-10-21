import { createDccsAudioPlayer, DCCS_ASSESSMENT_AUDIO } from "./dccsAssessmentAudio";

let audios;
beforeEach(() => {
  jest.useFakeTimers();
  audios = [];
  jest.spyOn(global, "Audio").mockImplementation((src) => {
    const audio = { src, duration: 2, pause: jest.fn(), play: jest.fn().mockResolvedValue() };
    audios.push(audio); return audio;
  });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test("replacing a clip removes old handlers and callbacks, and completion fires only once", () => {
  const firstEnded = jest.fn();
  const nextEnded = jest.fn();
  const playback = jest.fn();
  const player = createDccsAudioPlayer(playback);
  player.play("color", "intro", { onEnded: firstEnded });
  const stale = audios[0].onended;
  player.play("category", "intro", { onEnded: nextEnded });
  expect(audios[0].pause).toHaveBeenCalledTimes(1);
  expect(audios[0].onended).toBeNull();
  stale(); expect(firstEnded).not.toHaveBeenCalled();
  const audio = audios[1];
  expect(audio.src).toBe(DCCS_ASSESSMENT_AUDIO.category.intro);
  audio.onplaying(); expect(playback).toHaveBeenLastCalledWith(true);
  const ended = audio.onended;
  ended(); ended();
  jest.advanceTimersByTime(60000);
  expect(nextEnded).toHaveBeenCalledTimes(1);
  expect(playback).toHaveBeenLastCalledWith(false);
});

test("a rejected play is reported once and cannot advance into a question", async () => {
  global.Audio.mockImplementation(() => ({ pause: jest.fn(), play: () => Promise.reject(new Error("autoplay")) }));
  const ended = jest.fn(); const failed = jest.fn();
  const player = createDccsAudioPlayer();
  player.play("bag_color", "formal", { onEnded: ended, onError: failed });
  await Promise.resolve(); jest.advanceTimersByTime(60000);
  expect(failed).toHaveBeenCalledTimes(1);
  expect(ended).not.toHaveBeenCalled();
});

test("stalled clips have a bounded watchdog and explicit stop cancels it", () => {
  const failed = jest.fn();
  const player = createDccsAudioPlayer();
  player.play("color", "intro", { onError: failed });
  jest.advanceTimersByTime(15000);
  expect(failed).toHaveBeenCalledTimes(1);
  player.play("color", "intro", { onError: failed });
  player.stop(); jest.advanceTimersByTime(60000);
  expect(failed).toHaveBeenCalledTimes(1);
  expect(audios.every((audio) => !audio.onended)).toBe(true);
});
