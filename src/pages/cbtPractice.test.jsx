import React, { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestPageCBT from "./TestPage_CBT";
import { CBT_PRACTICE_AUDIO as cues } from "../utils/cbtPracticeAudio";
import { useTestAttempt } from "../utils/useTestAttempt";
import { saveUnifiedResult } from "../utils/resultManager";

jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));
jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));

let audios;
let attempt;
let nextPlayError;
const current = () => audios.at(-1);
const practice = () => screen.getByTestId("cbt-practice");
const board = () => screen.getByTestId("cbt-board");
const stones = () => within(board()).getAllByRole("button");
const lit = () => stones().findIndex((button) => button.querySelector(".is-glowing"));
const narrator = () => screen.queryByTestId("cbt-narrator");
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
const phase = (expected) => expect(practice()).toHaveAttribute("data-phase", expected);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear();
  audios = [];
  nextPlayError = null;
  jest.spyOn(Math, "random").mockReturnValue(0.2);
  jest.spyOn(global, "Audio").mockImplementation((src) => {
    const audio = { src, duration: 4, pause: jest.fn(), onended: null, onplaying: null,
      play: jest.fn(() => {
        const error = nextPlayError;
        nextPlayError = null;
        return error ? Promise.reject(error) : Promise.resolve();
      }) };
    audios.push(audio);
    return audio;
  });
  attempt = { begin: jest.fn(), checkpoint: jest.fn(), complete: jest.fn((raw) => raw) };
  useTestAttempt.mockReturnValue(attempt);
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function start(entry = "ended", strict = false) {
  const page = <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TestPageCBT /></MemoryRouter>;
  const view = render(strict ? <StrictMode>{page}</StrictMode> : page);
  expect(document.querySelector('img[src="mouse.webp"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "開始遊戲" }));
  expect(screen.queryByText(/看完再點/)).toBeNull();
  expect(document.querySelector('img[src="mouse.webp"]')).toBeNull();
  if (entry === "ended") fireEvent.ended(document.querySelector("video"));
  else fireEvent.click(screen.getByRole("button", { name: entry }));
  return view;
}
function endVoice(cue) {
  expect(current().src).toBe(cue);
  const audio = current();
  expect(narrator()).toBeInTheDocument();
  expect(narrator().querySelector(".cbt-narrator-open")).toHaveAttribute("src", "chicken.webp");
  expect(narrator().querySelector(".cbt-narrator-closed")).toHaveAttribute("src", "chicken01.webp");
  act(() => audio.onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  act(() => audio.onended());
  expect(audio.pause).toHaveBeenCalled();
  expect(audio.onended).toBeNull();
}
function showSequence() {
  phase("SHOW_SEQUENCE");
  const sequence = [lit()];
  advance(1000);
  expect(lit()).toBe(-1);
  advance(500);
  sequence.push(lit());
  advance(1000);
  phase("YOUR_TURN");
  expect(sequence[0]).not.toBe(sequence[1]);
  return sequence;
}
function openQuestion() {
  endVoice(cues.intro);
  const sequence = showSequence();
  endVoice(cues.answer);
  phase("WAIT_RESPONSE");
  return sequence;
}
function answer(sequence) {
  fireEvent.click(stones()[sequence[0]]);
  advance(300);
  fireEvent.click(stones()[sequence[1]]);
  advance(300);
}
function pass() {
  const first = openQuestion();
  answer(first);
  endVoice(cues.correct);
  const second = openQuestion();
  expect(second).not.toEqual(first);
  answer(second);
  phase("PASSED");
}

test.each(["ended", "跳過動畫", "下一步"])("STEP %s enters practice directly with the existing assets and grid", (entry) => {
  start(entry);
  phase("INTRO");
  expect(document.querySelector("video")).toBeNull();
  expect(document.querySelector(".cbt-practice-guide")).toBeNull();
  expect(document.querySelector('img[src="voice.webp"]')).toBeNull();
  expect(screen.queryByAltText("點石頭的小手提示")).toBeNull();
  expect(practice().textContent).toBe("");
  expect(stones()).toHaveLength(9);
  expect(stones().map((button) => [button.style.top, button.style.left])).toEqual([
    ["82px", "130px"], ["82px", "380px"], ["82px", "630px"],
    ["227px", "130px"], ["227px", "380px"], ["227px", "630px"],
    ["372px", "130px"], ["372px", "380px"], ["372px", "630px"],
  ]);
  expect(stones().every((button) => button.style.width === "250px")).toBe(true);
  expect(stones().every((button) => button.disabled)).toBe(true);
  expect(attempt.begin).not.toHaveBeenCalled();
});

test("narration gates exactly 1000 ms lights and a 500 ms gap, with no overlapping audio", () => {
  start();
  act(() => current().onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  expect(lit()).toBe(-1);
  const intro = current();
  endVoice(cues.intro);
  const audioCount = audios.length;
  const first = lit();
  expect(first).toBeGreaterThanOrEqual(0);
  expect(screen.queryByAltText("點石頭的小手提示")).toBeNull();
  expect(narrator()).toBeNull();
  advance(999);
  expect(lit()).toBe(first);
  advance(1);
  expect(lit()).toBe(-1);
  advance(499);
  expect(lit()).toBe(-1);
  advance(1);
  expect(lit()).not.toBe(first);
  expect(audios).toHaveLength(audioCount);
  expect(intro.pause).toHaveBeenCalled();
  advance(999);
  phase("SHOW_SEQUENCE");
  advance(1);
  phase("YOUR_TURN");
  expect(lit()).toBe(-1);
  expect(stones().every((button) => button.disabled)).toBe(true);
  expect(screen.queryByAltText("點石頭的小手提示")).toBeNull();
  // Even a slow narration cannot consume any response time.
  current().duration = 25;
  act(() => current().onplaying());
  advance(16000);
  phase("YOUR_TURN");
  endVoice(cues.answer);
  phase("WAIT_RESPONSE");
  expect(screen.getByAltText("點石頭的小手提示")).toBeInTheDocument();
  expect(stones().every((button) => !button.disabled)).toBe(true);
  advance(14999);
  phase("WAIT_RESPONSE");
  advance(1);
  phase("FEEDBACK");
  expect(current().src).toBe(cues.retry);
});

test("the hand guides stone clicks only during practice response and moves to the next stone", () => {
  start();
  const sequence = openQuestion();
  const hand = () => screen.getByAltText("點石頭的小手提示");
  expect(hand()).toHaveAttribute("src", "mouse.webp");
  expect(hand().closest("button")).toBe(stones()[sequence[0]]);
  const count = audios.length;
  fireEvent.click(hand());
  phase("WAIT_RESPONSE");
  expect(hand().closest("button")).toBe(stones()[sequence[1]]);
  expect(board().querySelector(".is-glowing")).toBeNull();
  expect(audios).toHaveLength(count);
  advance(300);
  fireEvent.click(hand());
  phase("LANDING");
  expect(screen.queryByAltText("點石頭的小手提示")).toBeNull();
  advance(300);
  phase("FEEDBACK");
  expect(screen.queryByAltText("點石頭的小手提示")).toBeNull();
  expect(practice()).toHaveAttribute("data-streak", "1");
});

test("a narrow viewport uniformly scales the same nine coordinates without replaying narration", () => {
  jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(380);
  start();
  const frame = board().parentElement;
  expect(frame.style.height).toBe("227.5px");
  expect(frame.style.getPropertyValue("--cbt-practice-board-scale")).toBe("0.5");
  expect(stones()[8].style.left).toBe("630px");
  const count = audios.length;
  act(() => window.dispatchEvent(new Event("resize")));
  expect(audios).toHaveLength(count);
});

test("two taps are judged together, with neutral ripple feedback and rapid-click protection", () => {
  start();
  const sequence = openQuestion();
  const wrong = (sequence[0] + 1) % 9;
  fireEvent.click(stones()[wrong]);
  phase("WAIT_RESPONSE");
  expect(stones()[wrong].querySelector(".cbt-practice-ripple")).toBeInTheDocument();
  expect(stones()[wrong].querySelector("img")).toHaveClass("is-practice-tapped");
  fireEvent.click(stones()[sequence[1]]);
  phase("WAIT_RESPONSE");
  advance(300);
  fireEvent.click(stones()[sequence[1]]);
  advance(300);
  phase("FEEDBACK");
  expect(practice()).toHaveAttribute("data-streak", "0");
  expect(current().src).toBe(cues.retry);
  expect(board().querySelector(".is-wrong, .is-selected, .is-glowing")).toBeNull();
  expect(board().querySelector(".cbt-person")).toBeNull();
  expect(document.querySelector(".is-happy")).toBeNull();
});

test("every accepted tap shows step.webp, finishes a landing and keeps footprints until the next question", () => {
  start();
  const sequence = openQuestion();
  const originalLayout = stones().map((stone) => stone.getAttribute("style"));
  const imageAt = (index) => within(stones()[index]).getByAltText(`第 ${index + 1} 顆石頭`);
  const footprints = () => board().querySelectorAll('img[src="step.webp"]');
  expect(footprints()).toHaveLength(0);
  fireEvent.click(stones()[sequence[0]]);
  expect(imageAt(sequence[0])).toHaveAttribute("src", "step.webp");
  expect(imageAt(sequence[0])).toHaveClass("is-practice-tapped");
  expect(stones()[sequence[0]].querySelector(".cbt-practice-landing-shadow")).toBeInTheDocument();
  advance(300);
  const audioCount = audios.length;
  fireEvent.click(stones()[sequence[1]]);
  phase("LANDING");
  expect(footprints()).toHaveLength(2);
  expect(imageAt(sequence[1])).toHaveClass("is-practice-tapped");
  expect(stones().map((stone) => stone.getAttribute("style"))).toEqual(originalLayout);
  expect(stones().every((stone) => stone.disabled)).toBe(true);
  advance(299);
  phase("LANDING");
  expect(audios).toHaveLength(audioCount);
  advance(1);
  phase("FEEDBACK");
  expect(footprints()).toHaveLength(2);
  endVoice(cues.correct);
  phase("INTRO");
  expect(footprints()).toHaveLength(0);
  expect(board().querySelector(".is-practice-tapped, .cbt-practice-landing-shadow")).toBeNull();
});

test("a second tap before the deadline completes even when its landing finishes after fifteen seconds", () => {
  start();
  const sequence = openQuestion();
  fireEvent.click(stones()[sequence[0]]);
  advance(14999);
  fireEvent.click(stones()[sequence[1]]);
  phase("LANDING");
  advance(1);
  phase("LANDING");
  advance(299);
  phase("FEEDBACK");
  expect(practice()).toHaveAttribute("data-streak", "1");
  expect(current().src).toBe(cues.correct);
});

test("the chicken stops its mouth while waiting or paused and stays outside all icons", () => {
  start();
  const scene = screen.getByTestId("cbt-practice-scene");
  expect(scene).toHaveAttribute("data-narrator-layout", "beside");
  expect(narrator().closest(".cbt-practice-narrator-slot")).toBeInTheDocument();
  expect(board().contains(narrator())).toBe(false);
  expect(document.querySelector(".cbt-practice-guide")).toBeNull();
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  act(() => current().onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  act(() => current().onwaiting());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  act(() => current().onplaying());
  act(() => current().onpause());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  endVoice(cues.intro);
  expect(narrator()).toBeNull();
  showSequence();
  expect(narrator()).toBeInTheDocument();
  endVoice(cues.answer);
  expect(narrator()).toBeNull();
});

test("the completed scene centers a large chicken and keeps the start button in a separate footer", () => {
  start();
  pass();
  const scene = screen.getByTestId("cbt-practice-scene");
  expect(scene).toHaveAttribute("data-narrator-layout", "center");
  expect(screen.queryByTestId("cbt-board")).toBeNull();
  expect(narrator()).toBeInTheDocument();
  const button = screen.getByRole("button", { name: "開始正式評測" });
  expect(scene.contains(button)).toBe(false);
  expect(button.querySelector(".cbt-practice-start-pointer")).toBeNull();
  endVoice(cues.passed);
  expect(button).toBeEnabled();
  expect(button.querySelector(".cbt-practice-start-pointer")).toHaveAttribute("src", "mouse.webp");
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  expect(button.textContent).toBe("");
  expect(screen.queryByText("開始正式評測")).toBeNull();
  expect(document.querySelector('img[src="voice.webp"]')).toBeNull();
});

test("only two consecutive correct answers pass; mistakes reset the streak and use fresh questions", () => {
  start();
  const first = openQuestion();
  answer(first);
  expect(practice()).toHaveAttribute("data-streak", "1");
  expect(practice().textContent).toBe("");
  expect(document.querySelector(".is-happy")).toBeInTheDocument();
  endVoice(cues.correct);
  const second = openQuestion();
  expect(second).not.toEqual(first);
  answer([second[1], second[0]]);
  expect(practice()).toHaveAttribute("data-streak", "0");
  endVoice(cues.retry);
  const third = openQuestion();
  expect(third).not.toEqual(second);
  answer(third);
  expect(practice()).toHaveAttribute("data-streak", "1");
  endVoice(cues.correct);
  answer(openQuestion());
  phase("PASSED");
  expect(practice()).toHaveAttribute("data-round", "4");
  expect(screen.getByRole("button", { name: "開始正式評測" })).toBeDisabled();
  endVoice(cues.passed);
  expect(screen.getByRole("button", { name: "開始正式評測" })).toBeEnabled();
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(attempt.checkpoint).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(localStorage.getItem("cbtTestResult")).toBeNull();
});

test("a partial response times out at the original deadline and resets a previous success", () => {
  start();
  answer(openQuestion());
  endVoice(cues.correct);
  const next = openQuestion();
  advance(14900);
  fireEvent.click(stones()[next[0]]);
  advance(99);
  phase("WAIT_RESPONSE");
  advance(1);
  phase("FEEDBACK");
  expect(practice()).toHaveAttribute("data-streak", "0");
  expect(current().src).toBe(cues.retry);
  const count = audios.length;
  fireEvent.click(stones()[next[1]]);
  advance(300);
  expect(audios).toHaveLength(count);
  endVoice(cues.retry);
  expect(openQuestion()).not.toEqual(next);
});

test.each(["NotAllowedError", "NetworkError"])("a %s offers an explicit click to retry without starting sequence or deadline", async (name) => {
  nextPlayError = { name };
  start();
  await act(async () => {});
  phase("INTRO");
  const previous = current();
  expect(previous.pause).toHaveBeenCalled();
  expect(previous.onended).toBeNull();
  expect(screen.getByRole("button", { name: "點擊播放語音提示" }).contains(narrator())).toBe(true);
  expect(practice().textContent).toBe("");
  advance(20000);
  phase("INTRO");
  expect(lit()).toBe(-1);
  fireEvent.click(screen.getByRole("button", { name: "點擊播放語音提示" }));
  endVoice(cues.intro);
  showSequence();
});

test("the passed button enters the original five-second countdown and records only formal trials", () => {
  start();
  pass();
  endVoice(cues.passed);
  const button = screen.getByRole("button", { name: "開始正式評測" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(attempt.begin).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("cbt-practice")).toBeNull();
  expect(document.querySelector('img[src="mouse.webp"]')).toBeNull();
  for (let second = 0; second < 5; second += 1) advance(1000);
  expect(board()).toHaveAttribute("data-phase", "show");
  const sequence = [lit()];
  advance(800);
  advance(260);
  sequence.push(lit());
  advance(800);
  advance(260);
  expect(board()).toHaveAttribute("data-phase", "answer");
  expect(audios.find((audio) => audio.src === "start.mp3").play).toHaveBeenCalledTimes(1);
  answer(sequence);
  advance(1000);
  expect(document.querySelector('img[src="mouse.webp"]')).toBeNull();
  const trials = attempt.checkpoint.mock.calls.flatMap(([payload]) => payload.trials || []);
  expect(trials).toHaveLength(1);
  expect(trials[0].trialIndex).toBe(1);
  expect(audios.filter((audio) => Object.values(cues).includes(audio.src))).toHaveLength(6);
});

test.each(["INTRO", "SHOW_SEQUENCE", "YOUR_TURN", "WAIT_RESPONSE", "LANDING", "FEEDBACK", "PASSED"])("leaving %s clears every audio callback and timer", (target) => {
  const view = start();
  if (target === "PASSED") pass();
  else if (target !== "INTRO") {
    endVoice(cues.intro);
    if (target !== "SHOW_SEQUENCE") {
      const sequence = showSequence();
      if (target !== "YOUR_TURN") {
        endVoice(cues.answer);
        if (target === "FEEDBACK") answer(sequence);
        if (target === "LANDING") {
          fireEvent.click(stones()[sequence[0]]);
          advance(300);
          fireEvent.click(stones()[sequence[1]]);
        }
      }
    }
  }
  phase(target);
  const staleEnd = current().onended;
  view.unmount();
  const count = audios.length;
  if (staleEnd) act(() => staleEnd());
  advance(60000);
  expect(audios).toHaveLength(count);
  expect(audios.every((audio) => audio.pause.mock.calls.length || !audio.play.mock.calls.length)).toBe(true);
  expect(current().onended).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
  expect(attempt.begin).not.toHaveBeenCalled();
});

test("StrictMode cancels its first setup before the active practice flow", () => {
  start("ended", true);
  const intros = audios.filter((audio) => audio.src === cues.intro);
  expect(intros).toHaveLength(2);
  expect(intros[0].pause).toHaveBeenCalled();
  expect(intros[0].onended).toBeNull();
  pass();
});
