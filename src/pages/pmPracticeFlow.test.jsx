import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PMPractice from "../components/PMPractice";
import TestPagePM from "./TestPage_PM";
import { PM_PRACTICE_AUDIO } from "../utils/pmPracticeAudio";
import { useTestAttempt } from "../utils/useTestAttempt";

jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));
let recordings;
let attempt;
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
const practice = () => screen.getByTestId("pm-practice");
const items = () => [...practice().querySelectorAll("button[data-item-id]")];
const memory = () => [...practice().querySelectorAll("[data-memory-id]")].map((item) => item.dataset.memoryId);
const currentAudio = () => recordings[recordings.length - 1];
const endAudio = () => act(() => currentAudio().onended?.());
const select = (ids) => ids.forEach((id) => fireEvent.click(items().find((item) => item.dataset.itemId === id)));
const submit = () => fireEvent.click(screen.getByRole("button", { name: "送出答案" }));
const narrator = () => screen.queryByTestId("pm-narrator");
const startSpeaking = () => act(() => currentAudio().onplaying());

beforeEach(() => {
  jest.useFakeTimers();
  recordings = [];
  jest.spyOn(window, "Audio").mockImplementation((src) => {
    const audio = document.createElement("audio");
    audio.src = src;
    recordings.push(audio);
    return audio;
  });
  attempt = { begin: jest.fn(() => ({ resultId: "formal-only" })), checkpoint: jest.fn(), complete: jest.fn() };
  useTestAttempt.mockReturnValue(attempt);
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function answer() {
  const targets = memory();
  expect(targets).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "送出答案" })).not.toBeInTheDocument();
  advance(4999);
  expect(practice()).toHaveAttribute("data-phase", "memorize");
  advance(1);
  expect(practice()).toHaveAttribute("data-phase", "answerIntro");
  expect(items()).toHaveLength(4);
  expect(items().every((item) => item.disabled)).toBe(true);
  expect(currentAudio().getAttribute("src")).toBe(PM_PRACTICE_AUDIO.answer);
  endAudio();
  expect(practice()).toHaveAttribute("data-can-answer", "true");
  expect(screen.queryByAltText("示範點擊")).not.toBeInTheDocument();
  expect(items().every((item) => item.getAttribute("aria-pressed") === "false")).toBe(true);
  return targets;
}
function feedback() { endAudio(); advance(1100); }

test("React StrictMode starts the memory instruction once, and selection renders do not restart narration", () => {
  render(<React.StrictMode><PMPractice onComplete={jest.fn()} /></React.StrictMode>);
  advance(0);
  expect(recordings.filter((audio) => audio.getAttribute("src") === PM_PRACTICE_AUDIO.memorize)).toHaveLength(1);
  const targets = answer();
  const count = recordings.length;
  select([targets[0]]);
  select([targets[0]]);
  expect(recordings).toHaveLength(count);
});

test("selection and cancellation keep positions fixed; empty submit is disabled and options start unselected", () => {
  render(<PMPractice onComplete={jest.fn()} />);
  const targets = answer();
  const positions = items().map((item) => item.getAttribute("style"));
  expect(screen.getByRole("button", { name: "送出答案" })).toBeDisabled();
  select([targets[0]]);
  expect(screen.getByRole("button", { name: "送出答案" })).toBeEnabled();
  advance(1200);
  expect(currentAudio().getAttribute("src")).toBe(PM_PRACTICE_AUDIO.cancel);
  endAudio();
  select([targets[0]]);
  expect(screen.getByRole("button", { name: "送出答案" })).toBeDisabled();
  expect(items().map((item) => item.getAttribute("style"))).toEqual(positions);
  select(items().map((item) => item.dataset.itemId));
  expect(items().every((item) => item.getAttribute("aria-pressed") === "true")).toBe(true);
  submit();
  expect(practice()).toHaveAttribute("data-streak", "0");
  expect(currentAudio().getAttribute("src")).toBe(PM_PRACTICE_AUDIO.retry);
});

test("a wrong answer resets the streak; only two consecutive exact answers pass, and completion waits for its recording", () => {
  const done = jest.fn();
  render(<PMPractice onComplete={done} />);
  select(answer()); submit(); submit();
  expect(practice()).toHaveAttribute("data-streak", "1");
  expect(recordings.filter((audio) => audio.getAttribute("src") === PM_PRACTICE_AUDIO.correct)).toHaveLength(1);
  feedback();
  const targets = answer();
  select([targets[0]]); submit();
  expect(practice()).toHaveAttribute("data-streak", "0");
  feedback();
  select(answer()); submit(); feedback();
  select(answer()); submit(); feedback();
  expect(practice()).toHaveAttribute("data-phase", "complete");
  expect(done).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "進入正式評測" })).not.toBeInTheDocument();
  endAudio();
  fireEvent.click(screen.getByRole("button", { name: "進入正式評測" }));
  fireEvent.click(screen.getByRole("button", { name: "進入正式評測" }));
  expect(done).toHaveBeenCalledTimes(1);
});

test("automatic instructions preserve memory timing, selections and the unhurried answer stage", () => {
  render(<PMPractice onComplete={jest.fn()} />);
  advance(4000);
  const oldAudio = currentAudio();
  advance(1000);
  expect(practice()).toHaveAttribute("data-phase", "answerIntro");
  expect(oldAudio.onended).toBeNull();
  expect(currentAudio().getAttribute("src")).toBe(PM_PRACTICE_AUDIO.answer);
  advance(1500);
  expect(practice()).toHaveAttribute("data-phase", "answerIntro");
  endAudio();
  const id = items()[0].dataset.itemId;
  select([id]);
  expect(items()[0]).toHaveAttribute("aria-pressed", "true");
  advance(16000);
  expect(practice()).toHaveAttribute("data-phase", "answer");
  expect(recordings.filter((audio) => audio.getAttribute("src") === PM_PRACTICE_AUDIO.answer)).toHaveLength(1);
});

test("audio failure unlocks the practice and unmount stops narration and all pending work", () => {
  const view = render(<PMPractice onComplete={jest.fn()} />);
  advance(5000);
  act(() => currentAudio().onerror());
  expect(practice()).toHaveAttribute("data-phase", "answer");
  advance(5000);
  expect(currentAudio().getAttribute("src")).toBe(PM_PRACTICE_AUDIO.reminder);
  view.unmount();
  expect(recordings.every((audio) => audio.onended === null && audio.onerror === null && audio.onplaying === null && audio.onpause === null && audio.onwaiting === null)).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test("the two chicken frames follow actual playback, pause, buffering, stage transitions, completion and errors", () => {
  render(<PMPractice onComplete={jest.fn()} />);
  advance(0);
  expect(narrator().querySelector(".pm-narrator-open")).toHaveAttribute("src", "chicken.webp");
  expect(narrator().querySelector(".pm-narrator-closed")).toHaveAttribute("src", "chicken01.webp");
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  startSpeaking();
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  act(() => currentAudio().onpause());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  startSpeaking();
  act(() => currentAudio().onwaiting());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  startSpeaking();
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  endAudio();
  expect(narrator()).toBeNull();
  advance(5000);
  startSpeaking();
  expect(narrator()).toHaveAttribute("data-narration-event", "answer");
  act(() => currentAudio().onerror());
  expect(narrator()).toBeNull();
});

test("every practice narration has a chicken; only the scene without question pictures centers it", () => {
  render(<PMPractice onComplete={jest.fn()} />);
  const check = (event, layout = "beside") => {
    startSpeaking();
    expect(narrator()).toHaveAttribute("data-speaking", "true");
    expect(narrator()).toHaveAttribute("data-narration-event", event);
    expect(screen.getByTestId("pm-practice-scene")).toHaveAttribute("data-narrator-layout", layout);
    if (layout === "beside") {
      expect(narrator().closest(".pm-practice-narrator-slot")).not.toBeNull();
      expect(screen.getByTestId("pm-scatter-board").contains(narrator())).toBe(false);
    }
  };
  advance(0); check("memorize");
  const targets = memory();
  advance(5000); check("answer");
  endAudio();
  const positions = items().map((item) => item.getAttribute("style"));
  advance(5000); check("reminder");
  endAudio();
  select([targets[0]]); advance(1200); check("cancel");
  expect(items().map((item) => item.getAttribute("style"))).toEqual(positions);
  endAudio(); submit(); check("retry"); feedback();
  select(answer()); submit(); check("correct"); feedback();
  select(answer()); submit(); feedback(); check("complete", "center");
  expect(screen.queryByTestId("pm-scatter-board")).not.toBeInTheDocument();
  endAudio();
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  expect(screen.getByRole("button", { name: "進入正式評測" })).toBeEnabled();
});

test("STEP goes straight to practice; one start click after passing begins the formal assessment directly", () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TestPagePM /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.ended(document.querySelector("video"));
  select(answer()); submit(); feedback();
  select(answer()); submit(); feedback();
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(attempt.checkpoint).not.toHaveBeenCalled();
  endAudio();
  fireEvent.click(screen.getByRole("button", { name: "進入正式評測" }));
  expect(screen.getByTestId("pm-stage")).toHaveAttribute("data-phase", "memorize");
  expect(attempt.begin).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("pm-stage")).toHaveAttribute("data-memory-count", "2");
  expect(screen.queryByTestId("pm-practice")).not.toBeInTheDocument();
  expect(recordings.every((audio) => audio.onended === null)).toBe(true);
});
