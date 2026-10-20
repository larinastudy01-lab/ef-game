import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SrtTestTutorial from "../components/SrtTestTutorial";
import TestPageSRT from "./TestPage_SRT";
import { useTestAttempt } from "../utils/useTestAttempt";
import { saveUnifiedResult } from "../utils/resultManager";

jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));

let audios;
const advance = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const practice = () => screen.getByRole("main", { name: "SRT 試玩" });
const result = () => JSON.parse(localStorage.getItem("srtPracticeResult_child-srt"));
const progress = () => screen.getByRole("progressbar");
const stimulus = () => screen.getByTestId("srt-practice-target");

async function reachStage(stage) {
  for (let count = 0; count < 40; count += 1) {
    if (practice().getAttribute("data-stage") === stage) return;
    await act(async () => { jest.advanceTimersToNextTimer(); });
  }
  throw new Error(`Expected ${stage}; got ${practice().getAttribute("data-stage")}`);
}

function mount(config = {}, props = {}) {
  return render(<SrtTestTutorial childId="child-srt" onReady={jest.fn()} onExit={jest.fn()}
    getPosition={() => ({ x: 36, y: 48 })}
    assessmentTiming={{ responseWindowMs: 500, stimulusIntervalsMs: [1000, 3000] }}
    config={{ audio: { enabled: false }, ...config }} {...props} />);
}

async function answer(click, windowMs = 1000) {
  await advance(100);
  if (click) await act(async () => { fireEvent.click(stimulus()); });
  await advance(windowMs - 100);
}

async function finishAudio() {
  await act(async () => { fireEvent.ended(audios.at(-1)); });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("currentChild", JSON.stringify({ childId: "child-srt", name: "測試" }));
  useTestAttempt.mockReturnValue({ begin: jest.fn(), checkpoint: jest.fn(), complete: (raw) => raw });
  jest.spyOn(Math, "random").mockReturnValue(0.99);
  audios = [];
  jest.spyOn(window, "Audio").mockImplementation((src) => {
    const audio = document.createElement("audio");
    audio.setAttribute("src", src);
    audio.play = jest.fn().mockResolvedValue(undefined);
    audio.pause = jest.fn();
    audios.push(audio);
    return audio;
  });
});

afterEach(async () => {
  await act(async () => { cleanup(); });
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("a go tap gives immediate feedback and progress, and repeated taps only record one response", async () => {
  mount();
  await reachStage("trial");
  expect(stimulus()).toHaveAttribute("data-target-type", "normal");
  expect(stimulus()).toHaveStyle({ width: "118px", left: "36%", top: "48%" });
  expect(stimulus().querySelector("img")).toHaveAttribute("src", "acorn.webp");
  expect(screen.queryByTestId("srt-hand-hint")).not.toBeInTheDocument();
  expect(document.querySelector(".srt-practice-header").textContent).toBe("");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await advance(100);
  const target = stimulus();
  await act(async () => { fireEvent.click(target); fireEvent.click(target); });
  expect(stimulus()).toHaveAttribute("data-visible", "true");
  expect(document.querySelector(".srt-practice-response-feedback")).toHaveTextContent("✓");
  expect(progress()).toHaveAttribute("aria-valuenow", "1");
  expect(result()).toBeNull();
  await advance(899);
  expect(stimulus()).toHaveAttribute("data-visible", "true");
  await advance(1);
  expect(screen.queryByTestId("srt-practice-target")).not.toBeInTheDocument();
  expect(result()).toMatchObject({ practice_attempt_count: 1, practice_correct_count: 1, practice_passed: false });
  expect(result().trials[0]).toMatchObject({ reactionTime: 100, targetType: "normal", clicked: true, isCorrect: true });
});

test("the guided example also responds immediately, without awarding independent practice credit", async () => {
  mount();
  await reachStage("demonstration");
  const example = screen.getByTestId("srt-practice-example");
  expect(example).toBeEnabled();
  expect(screen.getByTestId("srt-hand-hint")).toBeInTheDocument();
  await act(async () => { fireEvent.click(example); });
  expect(screen.queryByTestId("srt-practice-example")).not.toBeInTheDocument();
  expect(screen.queryByTestId("srt-hand-hint")).not.toBeInTheDocument();
  expect(document.querySelector(".srt-practice-feedback")).toHaveTextContent("✓");
  expect(progress()).toHaveAttribute("aria-valuenow", "0");
  expect(result()).toBeNull();
  await reachStage("trial");
  await answer(true);
  expect(result()).toMatchObject({ practice_attempt_count: 1, practice_correct_count: 1, practice_passed: false });
});

test("an unanswered practice acorn stays visible and accepts input for one second", async () => {
  mount();
  await reachStage("trial");
  await advance(999);
  expect(stimulus()).toHaveAttribute("data-visible", "true");
  expect(result()).toBeNull();
  await advance(1);
  expect(screen.queryByTestId("srt-practice-target")).not.toBeInTheDocument();
  expect(result().trials[0]).toMatchObject({
    timeout: true, isCorrect: false, stimulusDurationMs: 1000, responseWindowMs: 1000,
  });
});

test("each one-second acorn is followed by a 500ms blank, independent of early taps", async () => {
  mount();
  await reachStage("trial");
  await advance(100);
  await act(async () => { fireEvent.click(stimulus()); });
  await advance(900);
  expect(screen.queryByTestId("srt-practice-target")).not.toBeInTheDocument();
  expect(document.querySelector(".srt-practice-feedback")).not.toBeInTheDocument();
  await advance(499);
  expect(screen.queryByTestId("srt-practice-target")).not.toBeInTheDocument();
  await advance(1);
  await advance(0);
  await advance(16);
  expect(stimulus()).toHaveAttribute("data-visible", "true");
  await act(async () => { fireEvent.click(stimulus()); });
  await advance(1000);
  const secondTrial = result().trials[1];
  expect(secondTrial.stimulusIntervalMs).toBeGreaterThanOrEqual(1500);
  expect(secondTrial.stimulusIntervalMs).toBeLessThanOrEqual(1516);
});

test("tapping the example gives feedback while keeping voice cues sequential", async () => {
  mount({ audio: { enabled: true } });
  await finishAudio();
  expect(audios.at(-1).getAttribute("src")).toBe("點擊你的答案.mp3");
  await act(async () => { fireEvent.click(screen.getByTestId("srt-practice-example")); });
  expect(practice()).toHaveAttribute("data-stage", "demonstrationFeedback");
  expect(document.querySelector(".srt-practice-feedback")).toHaveTextContent("✓");
  await advance(800);
  expect(audios).toHaveLength(2);
  expect(screen.queryByTestId("srt-practice-target")).not.toBeInTheDocument();
  await finishAudio();
  expect(audios).toHaveLength(3);
  expect(audios[1].pause).toHaveBeenCalledTimes(1);
  expect(audios.at(-1).getAttribute("src")).toBe("題目要開始囉.mp3");
});

test("leaving during the example cancels both hand and display timers", async () => {
  const { unmount } = mount();
  await reachStage("demonstration");
  expect(screen.getByTestId("srt-hand-hint")).toBeInTheDocument();
  await act(async () => { unmount(); });
  expect(jest.getTimerCount()).toBe(0);
  expect(result()).toMatchObject({ status: "interrupted", practice_attempt_count: 0, practice_passed: false });
});

test("500ms visibility is independent from a longer response window, including late go responses", async () => {
  mount({ stimulusDurationMs: 500, responseWindowMs: 1200, interStimulusIntervalMs: 1500 });
  await reachStage("trial");
  await advance(500);
  expect(stimulus()).toHaveAttribute("data-visible", "false");
  expect(stimulus().querySelector("img")).toHaveStyle({ visibility: "hidden" });
  await advance(200);
  await act(async () => { fireEvent.click(stimulus()); });
  expect(result().trials[0]).toMatchObject({ reactionTime: 700, isCorrect: true, responseWindowMs: 1200, stimulusDurationMs: 500 });
});

test("two correct go trials are insufficient; no-go only succeeds after its entire response window", async () => {
  mount({ stimulusDurationMs: 500, responseWindowMs: 1200, interStimulusIntervalMs: 1500 });
  for (let index = 0; index < 3; index += 1) {
    await reachStage("trial");
    await answer(true, 1200);
    expect(screen.queryByRole("button", { name: "開始測驗" })).not.toBeInTheDocument();
  }
  expect(result()).toMatchObject({ practice_attempt_count: 3, practice_max_streak: 3, practice_passed: false });
  await reachStage("trial");
  expect(stimulus().querySelector("img")).toHaveAttribute("src", "rotten_acorn.webp");
  await advance(500);
  expect(stimulus()).toHaveAttribute("data-visible", "false");
  await advance(699);
  expect(result().practice_attempt_count).toBe(3);
  expect(result().practice_passed).toBe(false);
  await advance(1);
  expect(result()).toMatchObject({ practice_attempt_count: 4, practice_passed: true });
  expect(result().trials[3]).toMatchObject({ targetType: "rotten", clicked: false, isCorrect: true, responseElapsedMs: 1200 });
  await advance(1000);
  expect(screen.getByRole("button", { name: "開始測驗" })).toBeInTheDocument();
  expect(result().status).toBe("passed");
});

test("a missed go or clicked no-go resets progress and replays only a go example between trials", async () => {
  mount();
  await reachStage("trial");
  await answer(true);
  await reachStage("trial");
  await answer(false);
  expect(progress()).toHaveAttribute("aria-valuenow", "0");
  expect(result()).toMatchObject({ practice_attempt_count: 2, practice_error_count: 1, practice_timeout_count: 1 });
  await reachStage("demonstration");
  expect(screen.getByTestId("srt-hand-hint")).toBeInTheDocument();
  expect(screen.getByTestId("srt-practice-example")).toHaveAttribute("data-target-type", "normal");
  expect(result().practice_attempt_count).toBe(2);
  await reachStage("trial");
  expect(screen.queryByTestId("srt-hand-hint")).not.toBeInTheDocument();
  await answer(true);
  expect(result().trials[2].afterExtraHint).toBe(true);
  await reachStage("trial");
  expect(stimulus()).toHaveAttribute("data-target-type", "rotten");
  await answer(true);
  expect(progress()).toHaveAttribute("aria-valuenow", "0");
  expect(result()).toMatchObject({ practice_error_count: 2, practice_passed: false, practice_hint_count: 1 });
  expect(result().trials[3]).toMatchObject({ action: "falseAlarm", isCorrect: false });
});

test("the practice cap pauses for adult help and offers a fresh attempt without bypassing the gate", async () => {
  const onReady = jest.fn();
  mount({ maxTrials: 2 }, { onReady });
  for (let index = 0; index < 2; index += 1) {
    await reachStage("trial");
    await answer(false);
  }
  expect(practice()).toHaveAttribute("data-stage", "help");
  expect(result()).toMatchObject({ practice_attempt_count: 2, practice_passed: false, status: "assistance_required" });
  expect(screen.queryByRole("button", { name: "開始測驗" })).not.toBeInTheDocument();
  expect(onReady).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "重新試玩" })); });
  await reachStage("trial");
  expect(progress()).toHaveAttribute("aria-valuenow", "0");
  await answer(true);
  expect(result().practice_attempt_count).toBe(1);
});

test("STEP, all four sequential voice cues, practice pass, and formal start remain isolated end to end", async () => {
  const { container } = render(<MemoryRouter><TestPageSRT /></MemoryRouter>);
  localStorage.setItem("srtTestResult_child-srt", JSON.stringify({ score: 42 }));
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  await act(async () => { fireEvent.ended(container.querySelector("video")); });
  expect(audios.at(-1).getAttribute("src")).toBe("換你開始點囉.mp3");
  await finishAudio();
  expect(audios.at(-1).getAttribute("src")).toBe("點擊你的答案.mp3");
  expect(screen.getByTestId("srt-hand-hint")).toBeInTheDocument();
  await advance(1800);
  // The teaching example ends before the separate, timed practice trials.
  expect(screen.queryByTestId("srt-hand-hint")).not.toBeInTheDocument();
  expect(screen.queryByTestId("srt-practice-example")).not.toBeInTheDocument();
  expect(screen.queryByTestId("srt-practice-target")).not.toBeInTheDocument();
  await finishAudio();
  expect(audios.at(-1).getAttribute("src")).toBe("題目要開始囉.mp3");
  expect(screen.queryByTestId("srt-hand-hint")).not.toBeInTheDocument();
  await finishAudio();
  await reachStage("trial");
  for (let index = 0; index < 4; index += 1) {
    expect(audios.every((audio) => audio.pause.mock.calls.length > 0)).toBe(true);
    expect(screen.queryByTestId("srt-hand-hint")).not.toBeInTheDocument();
    await answer(index < 3);
    if (index < 3) {
      await reachStage("trial");
    }
  }
  expect(audios.at(-1).getAttribute("src")).toBe("完成囉 你實在是太棒了.mp3");
  expect(audios.filter((audio) => audio.getAttribute("src") === "題目要開始囉.mp3")).toHaveLength(1);
  expect(audios.filter((audio) => audio.getAttribute("src") === "完成囉 你實在是太棒了.mp3")).toHaveLength(1);
  expect(useTestAttempt().begin).not.toHaveBeenCalled();
  expect(useTestAttempt().checkpoint).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("srtTestResult_child-srt"))).toEqual({ score: 42 });
  await finishAudio();
  await advance(1000);
  expect(result()).toMatchObject({ mode: "practice", practice_passed: true, practice_attempt_count: 4 });
  fireEvent.click(screen.getByRole("button", { name: "開始測驗" }));
  expect(useTestAttempt().begin).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-mode="assessment"]')).toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.queryByTestId("srt-hand-hint")).not.toBeInTheDocument();
});

test("leaving practice stops voice playback, clears all timers and persists only an interrupted practice", async () => {
  const { unmount } = mount({ audio: { enabled: true } });
  expect(audios).toHaveLength(1);
  await act(async () => { unmount(); });
  expect(audios[0].pause).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  expect(result()).toMatchObject({ mode: "practice", status: "interrupted", practice_attempt_count: 0 });
  expect(localStorage.getItem("srtTestResult_child-srt")).toBeNull();
});
