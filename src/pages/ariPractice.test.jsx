import React, { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestARI from "./TestPage_ARI";
import { ARI_PRACTICE_AUDIO as cues } from "../utils/ariPracticeAudio";
import { useTestAttempt } from "../utils/useTestAttempt";
import { saveUnifiedResult } from "../utils/resultManager";

jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));
jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));

let audios;
let attempt;
const current = () => audios.at(-1);
const practice = () => screen.getByTestId("ari-practice");
const advance = async (ms) => act(async () => { jest.advanceTimersByTime(ms); });
const animal = (target) => screen.getByRole("button", { name: target === "cat" ? "貓咪" : "狗狗", exact: true });
const progress = (n) => expect(screen.getByRole("img", { name: `連續答對 ${n}/2 題` })).toBeInTheDocument();

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  audios = [];
  jest.spyOn(Math, "random").mockReturnValue(0.1);
  jest.spyOn(global, "Audio").mockImplementation((src) => {
    const audio = { src, currentTime: 0, play: jest.fn().mockResolvedValue(), pause: jest.fn(), onplaying: null, onended: null, onerror: null };
    audios.push(audio);
    return audio;
  });
  attempt = { begin: jest.fn(), checkpoint: jest.fn(), complete: jest.fn((raw) => raw), interrupt: jest.fn() };
  useTestAttempt.mockReturnValue(attempt);
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function renderPage(strict = false, enterPractice = true) {
  const page = <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TestARI /></MemoryRouter>;
  const view = render(strict ? <StrictMode>{page}</StrictMode> : page);
  if (enterPractice) {
    fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
    fireEvent.ended(document.querySelector("video"));
  }
  return view;
}
async function endCue(expected) {
  expect(current().src).toBe(expected);
  const previous = current();
  await act(async () => previous.onended());
  expect(previous.pause).toHaveBeenCalled();
  expect(previous.onended).toBeNull();
}
async function openQuestion(sound = "cat") {
  expect(practice()).toHaveAttribute("data-state", "question_prompt");
  expect(animal("cat")).toBeDisabled();
  expect(animal("dog")).toBeDisabled();
  await endCue(cues.question);
  expect(practice()).toHaveAttribute("data-state", "stimulus_playing");
  await endCue(cues[sound]);
  expect(practice()).toHaveAttribute("data-state", "answer_prompt");
  expect(animal("cat")).toBeDisabled();
  await endCue(cues.answer);
  expect(practice()).toHaveAttribute("data-state", "awaiting_answer");
  expect(animal("cat")).toBeEnabled();
}
async function start() {
  renderPage();
  await endCue(cues.intro);
  await openQuestion();
}
async function answer(target) {
  fireEvent.click(animal(target));
  expect(practice()).toHaveAttribute("data-state", "feedback");
  await advance(1000);
}
async function pass() {
  await start();
  await answer("dog");
  await openQuestion("dog");
  await answer("cat");
}

test.each(["ended", "skip", "next"])("original start screen and STEP precede practice after %s", (action) => {
  renderPage(false, false);
  expect(screen.getByRole("region", { name: "開始畫面" })).toBeInTheDocument();
  expect(screen.getByText("貓狗合唱團")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "進入遊戲" }).querySelector("img")).toHaveAttribute("src", "start.webp");
  expect(screen.queryByTestId("ari-practice")).toBeNull();
  expect(audios).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  const video = document.querySelector("video");
  expect(video).toHaveAttribute("src", "ARI_step.mp4");
  expect(screen.getByRole("region", { name: "步驟教學影片" })).toBeInTheDocument();
  expect(screen.queryByTestId("ari-practice")).toBeNull();
  expect(audios).toHaveLength(0);
  if (action === "ended") fireEvent.ended(video);
  else fireEvent.click(screen.getByRole("button", { name: action === "skip" ? "跳過動畫" : "下一步" }));
  expect(practice()).toHaveAttribute("data-state", "intro");
  expect(current().src).toBe(cues.intro);
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
});

test.each([[0.1, "cat", "dog"], [0.9, "dog", "cat"]])("practice after STEP plays serial cues and passes only after both opposite answers (%s)", async (random, first, second) => {
  Math.random.mockReturnValue(random);
  renderPage();
  expect(screen.getByText("請選擇相反的動物")).toBeInTheDocument();
  expect(document.querySelector("video")).toBeNull();
  expect(screen.queryByRole("button", { name: "進入遊戲" })).toBeNull();
  expect(document.querySelector(".ari-practice-guide")).toHaveAttribute("src", "mouse.webp");
  expect(current().src).toBe(cues.intro);
  progress(0);
  fireEvent.click(animal(second));
  expect(audios).toHaveLength(1);
  await endCue(cues.intro);
  await openQuestion(first);
  await answer(second);
  progress(1);
  await openQuestion(second);
  await answer(first);
  progress(2);
  expect(practice()).toHaveAttribute("data-state", "completed");
  expect(screen.queryByRole("button", { name: "開始挑戰" })).toBeNull();
  expect(attempt.begin).not.toHaveBeenCalled();
  await advance(3000);
  expect(current().src).toBe(cues.complete);
  expect(screen.queryByRole("button", { name: "開始挑戰" })).toBeNull();
  await endCue(cues.complete);
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(attempt.checkpoint).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
  expect(attempt.begin).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("ari-practice")).toBeNull();
  expect(screen.queryByRole("img", { name: /連續答對/ })).toBeNull();
  await advance(500);
  expect(screen.getByTestId("ari-assessment-stage")).toHaveAttribute("data-can-answer", "false");
  act(() => current().onplaying());
  expect(screen.getByTestId("ari-assessment-stage")).toHaveAttribute("data-can-answer", "true");
});

test("replay uses only the current stimulus, blocks overlapping clicks and does not advance the question", async () => {
  await start();
  const button = screen.getByRole("button", { name: "重播動物聲音" });
  expect(button.querySelector("img")).toHaveAttribute("src", "voice.webp");
  const count = audios.length;
  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.click(animal("dog"));
  expect(audios).toHaveLength(count + 1);
  expect(current().src).toBe(cues.cat);
  expect(button).toBeDisabled();
  progress(0);
  await endCue(cues.cat);
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await endCue(cues.cat);
  await answer("dog");
  progress(1);
  await openQuestion("dog");
});

test("one position twice cannot pass; a mistake clears the streak and begins a new random pair", async () => {
  await start();
  await answer("dog");
  progress(1);
  await openQuestion("dog");
  fireEvent.click(animal("dog"));
  fireEvent.click(animal("cat"));
  progress(0);
  expect(screen.getByRole("status")).toHaveTextContent("再試試看");
  expect(document.querySelector(".ari-practice-guide")).toHaveClass("is-wrong");
  expect(document.querySelectorAll(".ari-practice-animal.is-correct")).toHaveLength(0);
  await advance(999);
  expect(practice()).toHaveAttribute("data-state", "feedback");
  await advance(1);
  await openQuestion("cat");
  await answer("dog");
  await openQuestion("dog");
  await answer("cat");
  await endCue(cues.complete);
  expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
});

async function requireAssistance() {
  await start();
  for (let round = 0; round < 3; round += 1) {
    await answer("cat");
    if (round < 2) await openQuestion();
  }
  expect(practice()).toHaveAttribute("data-state", "assistance_required");
  progress(0);
  expect(screen.getByText(/請家長或專業人員陪同/)).toBeInTheDocument();
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(attempt.complete).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "開始挑戰" })).toBeNull();
}

test("three unsuccessful pairs offer assistance; restart clears all progress and the round cap", async () => {
  await requireAssistance();
  fireEvent.click(screen.getByRole("button", { name: "重新試玩" }));
  progress(0);
  await endCue(cues.intro);
  await openQuestion();
  await answer("cat");
  await openQuestion(); // The old three failures were cleared.
  await answer("dog");
  await openQuestion("dog");
  await answer("cat");
  await endCue(cues.complete);
  expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
});

test.each(["ended", "skip", "next"])("existing STEP %s returns directly to a fresh practice", async (action) => {
  await requireAssistance();
  fireEvent.click(screen.getByRole("button", { name: "重看 STEP 示範" }));
  const video = document.querySelector("video");
  expect(video).toHaveAttribute("src", "ARI_step.mp4");
  if (action === "ended") fireEvent.ended(video);
  else fireEvent.click(screen.getByRole("button", { name: action === "skip" ? "跳過動畫" : "下一步" }));
  progress(0);
  await endCue(cues.intro);
  await openQuestion();
  expect(attempt.begin).not.toHaveBeenCalled();
});

test.each(["error", "timeout", "rejected"])("failed stimulus (%s) retries the same sound and never unlocks an unheard question", async (failure) => {
  renderPage();
  await endCue(cues.intro);
  if (failure === "rejected") {
    // Reject just the upcoming animal recording, after the question cue.
    const implementation = Audio.getMockImplementation();
    Audio.mockImplementationOnce((src) => {
      const audio = implementation(src);
      audio.play.mockRejectedValue(new Error("autoplay blocked"));
      return audio;
    });
  }
  await endCue(cues.question);
  if (failure === "error") await act(async () => current().onerror());
  if (failure === "timeout") await advance(12000);
  expect(animal("dog")).toBeDisabled();
  progress(0);
  expect(current().pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "再播一次" }));
  expect(current().src).toBe(cues.cat);
  await endCue(cues.cat);
  await endCue(cues.answer);
  await answer("dog");
  progress(1);
});

test("blocked intro can resume from a gesture, and completion failure must be replayed fully", async () => {
  renderPage();
  await act(async () => current().onerror());
  fireEvent.click(screen.getByRole("button", { name: "再播一次" }));
  await endCue(cues.intro);
  await openQuestion();
  await answer("dog");
  await openQuestion("dog");
  await answer("cat");
  await act(async () => current().onerror());
  expect(screen.queryByRole("button", { name: "開始挑戰" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "再播一次" }));
  await endCue(cues.complete);
  expect(screen.getByRole("button", { name: "開始挑戰" })).toBeEnabled();
  expect(attempt.begin).not.toHaveBeenCalled();
});

test.each(["intro", "feedback", "replay", "completed"])("unmount during %s cancels playback, timers and stale callbacks", async (phase) => {
  if (phase === "completed") await pass();
  else if (phase === "intro") renderPage();
  else {
    await start();
    if (phase === "feedback") fireEvent.click(animal("dog"));
    else fireEvent.click(screen.getByRole("button", { name: "重播動物聲音" }));
  }
  const count = audios.length;
  cleanup();
  expect(audios.every((audio) => audio.pause.mock.calls.length > 0)).toBe(true);
  await advance(30000);
  expect(audios).toHaveLength(count);
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test("StrictMode cancels its first setup before starting the active intro", async () => {
  renderPage(true);
  expect(audios).toHaveLength(2);
  expect(audios[0].pause).toHaveBeenCalled();
  expect(audios[0].onended).toBeNull();
  await endCue(cues.intro);
  await openQuestion();
  expect(audios).toHaveLength(5);
});
