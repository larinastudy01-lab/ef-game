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
const narrator = () => screen.queryByTestId("ari-narrator");
const advance = async (ms) => act(async () => { jest.advanceTimersByTime(ms); });
const animal = (target) => screen.getByRole("button", { name: target === "cat" ? "貓咪" : "狗狗", exact: true });

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
  const isAnimal = expected === cues.cat || expected === cues.dog;
  if (isAnimal) expect(narrator()).toBeNull();
  else {
    expect(narrator()).toBeInTheDocument();
    act(() => previous.onplaying());
    expect(narrator()).toHaveAttribute("data-speaking", "true");
  }
  await act(async () => previous.onended());
  expect(previous.pause).toHaveBeenCalled();
  expect(previous.onended).toBeNull();
  expect(previous.onpause).toBeNull();
  expect(previous.onwaiting).toBeNull();
}
async function finishIntro() {
  await endCue(cues.intro);
  expect(screen.getByRole("status")).toHaveTextContent("聽到狗狗的叫聲，就要點貓咪！");
  expect(animal("cat")).toBeDisabled();
  await endCue(cues.dogRule);
  expect(screen.getByRole("status")).toHaveTextContent("聽到貓咪的叫聲，就要點狗狗！");
  expect(animal("dog")).toBeDisabled();
  await endCue(cues.catRule);
}
async function openQuestion(sound = "cat") {
  expect(practice()).toHaveAttribute("data-state", "question_prompt");
  expect(narrator().closest(".ari-practice-scene")).toHaveAttribute("data-narrator-layout", "beside");
  expect(animal("cat")).toBeDisabled();
  expect(animal("dog")).toBeDisabled();
  expect(document.querySelector(".ari-practice-guide")).toBeNull();
  await endCue(cues.question);
  expect(practice()).toHaveAttribute("data-state", "stimulus_playing");
  await endCue(cues[sound]);
  expect(practice()).toHaveAttribute("data-state", "answer_prompt");
  expect(animal("cat")).toBeDisabled();
  expect(document.querySelector(".ari-practice-guide")).toBeNull();
  await endCue(cues.answer);
  expect(practice()).toHaveAttribute("data-state", "awaiting_answer");
  expect(animal("cat")).toBeEnabled();
  expect(narrator()).toBeNull();
  expect(screen.queryByRole("img", { name: /連續答對/ })).toBeNull();
  const guide = document.querySelector(".ari-practice-guide");
  expect(guide).toHaveAttribute("src", "mouse.webp");
  expect(guide.closest("button")).toBe(animal(sound === "cat" ? "dog" : "cat"));
  expect(document.querySelectorAll(".ari-practice-guide")).toHaveLength(1);
}
async function start() {
  renderPage();
  await finishIntro();
  await openQuestion();
}
async function answer(target) {
  fireEvent.click(animal(target));
  expect(practice()).toHaveAttribute("data-state", "feedback");
  const feedbackCue = current().src;
  expect([cues.correct, cues.wrong]).toContain(feedbackCue);
  await advance(1000);
  expect(practice()).toHaveAttribute("data-state", "feedback");
  expect(animal("cat")).toBeDisabled();
  expect(animal("dog")).toBeDisabled();
  await endCue(feedbackCue);
  if (current().src === cues.retry) await endCue(cues.retry);
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
  expect(document.querySelector(".ari-practice-guide")).toBeNull();
  expect(current().src).toBe(cues.intro);
  expect(narrator().closest(".ari-practice-scene")).toHaveAttribute("data-narrator-layout", "center");
  expect(screen.queryByRole("button", { name: "貓咪" })).toBeNull();
  expect(screen.queryByRole("button", { name: "狗狗" })).toBeNull();
  expect(screen.queryByRole("button", { name: "重播動物聲音" })).toBeNull();
  expect(audios).toHaveLength(1);
  await finishIntro();
  await openQuestion(first);
  await answer(second);
  await openQuestion(second);
  await answer(first);
  expect(practice()).toHaveAttribute("data-state", "completed");
  expect(screen.queryByRole("img", { name: /連續答對/ })).toBeNull();
  expect(screen.queryByText("完成囉！")).toBeNull();
  expect(screen.queryByRole("button", { name: "開始挑戰" })).toBeNull();
  expect(attempt.begin).not.toHaveBeenCalled();
  await advance(3000);
  expect(current().src).toBe(cues.complete);
  expect(screen.queryByRole("button", { name: "開始挑戰" })).toBeNull();
  await endCue(cues.complete);
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(attempt.checkpoint).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  const startButton = screen.getByRole("button", { name: "開始挑戰" });
  expect(startButton.querySelector(".ari-practice-start-image")).toHaveAttribute("src", "start.webp");
  expect(startButton.querySelector(".ari-practice-guide")).toHaveAttribute("src", "mouse.webp");
  expect(screen.queryByRole("img", { name: /連續答對/ })).toBeNull();
  expect(screen.queryByText("完成囉！")).toBeNull();
  fireEvent.click(startButton);
  expect(practice()).toHaveAttribute("data-state", "assessment_intro");
  expect(screen.getByRole("status")).toHaveTextContent("記得喔！聽到聲音，要點另一隻動物！");
  expect(attempt.begin).not.toHaveBeenCalled();
  await endCue(cues.assessmentStart);
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
  expect(document.querySelector(".ari-practice-guide")).toBeNull();
  await endCue(cues.cat);
  expect(button).toBeEnabled();
  expect(document.querySelector(".ari-practice-guide").closest("button")).toBe(animal("dog"));
  fireEvent.click(button);
  await endCue(cues.cat);
  await answer("dog");
  await openQuestion("dog");
});

test("one position twice cannot pass; a mistake clears the streak and begins a new random pair", async () => {
  await start();
  await answer("dog");
  await openQuestion("dog");
  fireEvent.click(animal("dog"));
  fireEvent.click(animal("cat"));
  expect(screen.getByRole("status")).toHaveTextContent("哎呀！要點另一隻動物！");
  expect(document.querySelector(".ari-practice-guide")).toBeNull();
  expect(document.querySelectorAll(".ari-practice-animal.is-correct")).toHaveLength(0);
  await advance(999);
  expect(practice()).toHaveAttribute("data-state", "feedback");
  await advance(1);
  expect(practice()).toHaveAttribute("data-state", "feedback");
  await endCue(cues.wrong);
  expect(screen.getByRole("status")).toHaveTextContent("沒關係，重新找另一隻動物！");
  expect(animal("dog")).toBeDisabled();
  await endCue(cues.retry);
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
  expect(screen.getByText(/請家長或專業人員陪同/)).toBeInTheDocument();
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(attempt.complete).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "開始挑戰" })).toBeNull();
}

test("three unsuccessful pairs offer assistance; restart clears all progress and the round cap", async () => {
  await requireAssistance();
  fireEvent.click(screen.getByRole("button", { name: "重新試玩" }));
  expect(practice()).toHaveAttribute("data-state", "intro");
  await finishIntro();
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
  expect(practice()).toHaveAttribute("data-state", "intro");
  await finishIntro();
  await openQuestion();
  expect(attempt.begin).not.toHaveBeenCalled();
});

test.each(["error", "timeout", "rejected"])("failed stimulus (%s) retries the same sound and never unlocks an unheard question", async (failure) => {
  renderPage();
  await finishIntro();
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
  expect(current().pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "再播一次" }));
  expect(current().src).toBe(cues.cat);
  await endCue(cues.cat);
  await endCue(cues.answer);
  await answer("dog");
});

test("blocked intro can resume from a gesture, and completion failure must be replayed fully", async () => {
  renderPage();
  await act(async () => current().onerror());
  fireEvent.click(screen.getByRole("button", { name: "再播一次" }));
  await finishIntro();
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

test("short feedback still holds the answer lock for the minimum feedback time", async () => {
  await start();
  fireEvent.click(animal("dog"));
  await endCue(cues.correct);
  await advance(999);
  expect(practice()).toHaveAttribute("data-state", "feedback");
  expect(animal("dog")).toBeDisabled();
  await advance(1);
  await openQuestion("dog");
});

test("the chicken uses both mouth images and stops talking during pauses, buffering, errors and recovery", async () => {
  renderPage();
  expect(narrator().querySelector(".ari-narrator-open")).toHaveAttribute("src", "chicken.webp");
  expect(narrator().querySelector(".ari-narrator-closed")).toHaveAttribute("src", "chicken01.webp");
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  act(() => current().onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  act(() => current().onwaiting());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  act(() => current().onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  act(() => current().onpause());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  act(() => current().onplaying());
  await act(async () => current().onerror());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  fireEvent.click(screen.getByRole("button", { name: "再播一次" }));
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  await finishIntro();
  await openQuestion();
  fireEvent.click(screen.getByRole("button", { name: "重播動物聲音" }));
  expect(narrator()).toBeNull();
  await endCue(cues.cat);
});

test.each(["correct", "wrong", "retry"])("failed %s narration retries only the failed cue without counting another answer", async (cue) => {
  await start();
  fireEvent.click(animal(cue === "correct" ? "dog" : "cat"));
  if (cue === "retry") await endCue(cues.wrong);
  expect(current().src).toBe(cues[cue]);
  await act(async () => current().onerror());
  await advance(30000);
  expect(animal("dog")).toBeDisabled();
  expect(screen.getByRole("button", { name: "重播動物聲音" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "再播一次" }));
  await endCue(cues[cue]);
  if (cue === "wrong") await endCue(cues.retry);
  await openQuestion(cue === "correct" ? "dog" : "cat");
  if (cue !== "correct") {
    await answer("cat");
    await openQuestion("cat");
    await answer("cat");
    expect(practice()).toHaveAttribute("data-state", "assistance_required");
  }
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(attempt.checkpoint).not.toHaveBeenCalled();
});

test.each(["error", "timeout", "rejected"])("assessment reminder %s never starts timing before a successful retry", async (failure) => {
  await pass();
  await endCue(cues.complete);
  if (failure === "rejected") {
    const implementation = Audio.getMockImplementation();
    Audio.mockImplementationOnce((src) => {
      const audio = implementation(src);
      audio.play.mockRejectedValue(new Error("autoplay blocked"));
      return audio;
    });
  }
  const button = screen.getByRole("button", { name: "開始挑戰" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(current().src).toBe(cues.assessmentStart);
  if (failure === "error") await act(async () => current().onerror());
  await advance(30000);
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(attempt.checkpoint).not.toHaveBeenCalled();
  expect(screen.queryByTestId("ari-assessment-stage")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "再播一次" }));
  await endCue(cues.assessmentStart);
  expect(attempt.begin).toHaveBeenCalledTimes(1);
  await advance(500);
  expect(screen.getByTestId("ari-assessment-stage")).toHaveAttribute("data-can-answer", "false");
  act(() => current().onplaying());
  expect(screen.getByTestId("ari-assessment-stage")).toHaveAttribute("data-can-answer", "true");
});

test.each(["intro", "rule", "feedback", "retry_prompt", "replay", "completed", "assessment_intro"])("unmount during %s cancels playback, timers and stale callbacks", async (phase) => {
  if (phase === "completed" || phase === "assessment_intro") {
    await pass();
    if (phase === "assessment_intro") {
      await endCue(cues.complete);
      fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
    }
  }
  else if (phase === "rule") {
    renderPage();
    await endCue(cues.intro);
  }
  else if (phase === "intro") renderPage();
  else {
    await start();
    if (phase === "feedback") fireEvent.click(animal("dog"));
    else if (phase === "retry_prompt") {
      fireEvent.click(animal("cat"));
      await endCue(cues.wrong);
    }
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
  await finishIntro();
  await openQuestion();
  expect(audios).toHaveLength(7);
});
