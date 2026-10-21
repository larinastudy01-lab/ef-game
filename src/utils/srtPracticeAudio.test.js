import { SRT_PRACTICE_CONFIG } from "../config/srtPracticeConfig";
import { playSrtCue } from "./srtPracticeAudio";

let audio;
beforeEach(() => {
  jest.useFakeTimers();
  audio = document.createElement("audio");
  audio.play = jest.fn().mockResolvedValue(undefined);
  audio.pause = jest.fn();
  jest.spyOn(window, "Audio").mockImplementation(() => audio);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test.each(["ended", "error", "timeout", "rejection", "abort"])("audio %s always releases the practice flow and cleans up", async (event) => {
  const controller = new AbortController();
  if (event === "rejection") audio.play.mockRejectedValue(new Error("autoplay blocked"));
  const completion = playSrtCue("beforeTrial", SRT_PRACTICE_CONFIG.audio, controller.signal);
  if (event === "ended" || event === "error") audio.dispatchEvent(new Event(event));
  if (event === "timeout") jest.advanceTimersByTime(SRT_PRACTICE_CONFIG.audio.maxWaitMs);
  if (event === "abort") controller.abort();
  await expect(completion).resolves.toBe(({ ended: "ended", error: "failed", timeout: "timeout", rejection: "failed", abort: "aborted" })[event]);
  expect(audio.pause).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  audio.dispatchEvent(new Event("ended"));
  expect(audio.pause).toHaveBeenCalledTimes(1);
});
