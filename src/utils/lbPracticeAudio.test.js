import { playLBPracticeCue } from "./lbPracticeAudio";
import { getLBAssessmentVersion } from "../config/lbAssessmentConfig";

let audio;
let audioSpy;
beforeEach(() => {
  jest.useFakeTimers();
  audio = document.createElement("audio");
  audio.pause = jest.fn();
  audioSpy = jest.spyOn(window, "Audio").mockReturnValue(audio);
});
afterEach(() => {
  audioSpy.mockRestore();
  jest.useRealTimers();
});

test("a 13.49-second copy guide plays past the old 12-second cutoff and finishes on ended", async () => {
  const controller = new AbortController();
  const done = jest.fn();
  const playing = playLBPracticeCue("guide2", controller.signal, undefined,
    getLBAssessmentVersion("01").practiceAudio).then(done);
  Object.defineProperty(audio, "duration", { value: 13.49 });
  audio.dispatchEvent(new Event("loadedmetadata"));
  jest.advanceTimersByTime(13490);
  await Promise.resolve();
  expect(audio.pause).not.toHaveBeenCalled();
  expect(done).not.toHaveBeenCalled();
  audio.dispatchEvent(new Event("ended"));
  await playing;
  expect(done).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test("duration-based fallback still releases controls and abort removes metadata listeners", async () => {
  const controller = new AbortController();
  const playing = playLBPracticeCue("guide2", controller.signal, undefined,
    getLBAssessmentVersion("01").practiceAudio);
  Object.defineProperty(audio, "duration", { value: 13.49 });
  audio.dispatchEvent(new Event("durationchange"));
  jest.advanceTimersByTime(16490);
  await playing;
  expect(audio.pause).toHaveBeenCalledTimes(1);
  audio.dispatchEvent(new Event("loadedmetadata"));
  expect(jest.getTimerCount()).toBe(0);

  const next = playLBPracticeCue("guide2", controller.signal);
  controller.abort();
  await next;
  audio.dispatchEvent(new Event("loadedmetadata"));
  expect(jest.getTimerCount()).toBe(0);
});
