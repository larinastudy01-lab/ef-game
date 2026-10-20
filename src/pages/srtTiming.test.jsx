import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrainingPageSRT from "./TrainingPage_SRT";
import TestPageSRT from "./TestPage_SRT";
import { saveUnifiedResult } from "../utils/resultManager";
import { useTestAttempt } from "../utils/useTestAttempt";

jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));
// These regression tests isolate the existing assessment/training timers.
// The real practice gate is covered in srtPractice.test.jsx.
jest.mock("../components/SrtTestTutorial", () => ({
  __esModule: true,
  default: ({ onReady }) => <section aria-label="SRT 試玩"><button onClick={onReady}>通過試玩</button></section>,
}));

const advance = (milliseconds) => act(() => jest.advanceTimersByTime(milliseconds));
const acorn = () => screen.queryByTestId("srt-stimulus");

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  window.HTMLMediaElement.prototype.play.mockResolvedValue(undefined);
  localStorage.clear();
  localStorage.setItem("currentChild", JSON.stringify({ childId: "child-srt", name: "測試" }));
  useTestAttempt.mockReturnValue({ begin: jest.fn(), checkpoint: jest.fn(), complete: (result) => result });
  jest.spyOn(Math, "random").mockReturnValue(0.99);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function startTraining(difficulty) {
  render(<MemoryRouter initialEntries={[`/training-srt?difficulty=${difficulty}`]}><TrainingPageSRT /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
}

function startTest() {
  render(<MemoryRouter><TestPageSRT /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  fireEvent.click(screen.getByRole("button", { name: "通過試玩" }));
}

test.each(["ended", "跳過動畫", "下一步"])("assessment waits for the practice gate after %s", (action) => {
  const { container } = render(<MemoryRouter><TestPageSRT /></MemoryRouter>);
  localStorage.setItem("srtTestResult_child-srt", JSON.stringify({ score: 42 }));
  expect(screen.getByAltText("小松鼠頭像").getAttribute("src")).toBe("SRT_icon.webp");
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  if (action === "ended") fireEvent.ended(container.querySelector("video"));
  else fireEvent.click(screen.getByRole("button", { name: action }));

  expect(screen.getByRole("region", { name: "SRT 試玩" })).toBeInTheDocument();
  expect(screen.queryByTestId("srt-game-area")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("srtTestResult_child-srt"))).toEqual({ score: 42 });
  expect(useTestAttempt().begin).not.toHaveBeenCalled();
  expect(useTestAttempt().checkpoint).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "通過試玩" }));
  expect(useTestAttempt().begin).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("srt-game-area")).toBeInTheDocument();
});

test.each([0, 0.25, 0.99])("assessment presents only the two requested stimuli at 3:1, with 500ms windows (random %s)", (random) => {
  Math.random.mockReturnValue(random);
  startTest();
  const interval = random < 0.5 ? 1000 : 3000;
  const stimulusTypes = [];
  for (let index = 0; index < 12; index += 1) {
    advance(index === 0 ? interval + 20 : interval - 500 + 20);
    const stimulus = acorn();
    expect(stimulus).toBeInTheDocument();
    stimulusTypes.push(stimulus.getAttribute("alt"));
    expect(stimulus.getAttribute("src")).toBe(stimulus.getAttribute("alt") === "壞橡實" ? "rotten_acorn.webp" : "acorn.webp");
    // Never advance the next onset just because the response window expires.
    advance(500);
    expect(acorn()).toBeNull();
  }
  expect(stimulusTypes.filter((type) => type === "普通橡實")).toHaveLength(9);
  expect(stimulusTypes.filter((type) => type === "壞橡實")).toHaveLength(3);
  for (let index = 0; index < stimulusTypes.length; index += 4) {
    expect(stimulusTypes.slice(index, index + 4).filter((type) => type === "壞橡實")).toHaveLength(1);
  }
  const records = useTestAttempt().checkpoint.mock.calls.at(-1)[0].trials;
  expect(records).toHaveLength(12);
  expect(records.every((record) => record.visibleTimeMs === 500)).toBe(true);
  expect(records.filter((record) => record.targetType === "normal").every((record) => record.action === "miss")).toBe(true);
  expect(records.filter((record) => record.targetType === "rotten").every((record) => record.action === "correctAvoid")).toBe(true);
});

test.each([0, 0.99])("assessment random %s keeps 500ms stimuli and finishes at exactly eight minutes", (random) => {
  Math.random.mockReturnValue(random);
  let onset = null;
  const requestFrame = window.requestAnimationFrame;
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => requestFrame((time) => {
    onset = performance.now();
    callback(time);
  }));
  startTest();
  const startedAt = performance.now();
  advance((random < 0.5 ? 1000 : 3000) + 20);
  expect(onset).not.toBeNull();
  advance(499 - (performance.now() - onset));
  expect(acorn()).toBeInTheDocument();
  advance(1);
  expect(acorn()).toBeNull();
  expect(useTestAttempt().checkpoint.mock.calls.at(-1)[0].trials[0]).toMatchObject({
    visibleTimeMs: 500, action: "miss", targetType: "normal", timeout: true,
  });
  advance(480000 - (performance.now() - startedAt) - 1);
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(screen.getByTestId("srt-game-area")).toBeInTheDocument();
  advance(1);
  expect(saveUnifiedResult.mock.calls[0][0].rawResult).toMatchObject({
    durationMs: 480000,
    plannedDurationMs: 480000,
    maxTrials: 481,
    completionReason: "time_up",
    protocol: {
      version: "2.1.0", visibleTimeMs: 500, stimulusIntervalsMs: [1000, 3000],
      normalRate: 0.75, rottenRate: 0.25, targetToNonTargetRatio: [3, 1],
    },
  });
});

test("entry level waits for the click, prompts once after 3s and saves even an unclicked prompt", () => {
  startTraining("beginner");
  advance(1020);
  const original = acorn();
  expect(original).toHaveStyle({ width: "118px" });
  advance(2980);
  expect(screen.queryByAltText("點擊橡實提示")).not.toBeInTheDocument();
  advance(20);
  expect(screen.getByAltText("點擊橡實提示")).toBeInTheDocument();
  advance(10000);
  expect(acorn()).toBe(original);
  advance(180000 - 14020);
  const result = saveUnifiedResult.mock.calls[0][0].rawResult;
  expect(result.trials).toHaveLength(0);
  expect(result.promptCount).toBe(1);
  expect(result.metrics.promptCount).toBe(1);
  expect(result.pendingTrial).toMatchObject({ promptCount: 1, assisted: true });
});

test("entry level clears its prompt on click and records assistance without timing out", () => {
  startTraining("easy-1"); // An existing link uses the new entry level.
  advance(4020);
  fireEvent.click(screen.getByRole("button", { name: "普通橡實" }));
  expect(screen.queryByAltText("點擊橡實提示")).not.toBeInTheDocument();
  expect(acorn()).toBeNull();
  advance(1020);
  expect(acorn()).not.toBeNull();
  advance(180000 - 5040);
  const result = saveUnifiedResult.mock.calls[0][0].rawResult;
  expect(result.trials[0]).toMatchObject({ assisted: true, assistType: "mouse", promptCount: 1, timeout: false });
  expect(result.score).toBe(3);
});

test.each(["easy", "medium"])("%s spawns every second even after an early hit or a timeout", (difficulty) => {
  startTraining(difficulty);
  advance(1020);
  advance(200);
  fireEvent.click(acorn());
  advance(790);
  expect(acorn()).not.toBeNull(); // Next onset is ~2008ms, rather than 1s after the hit.
  expect(screen.queryByAltText("點擊橡實提示")).not.toBeInTheDocument();
  expect(screen.getByTestId("srt-target")).toHaveAttribute("data-trial-index", "2");
  advance(1010);
  expect(acorn()).not.toBeNull();
  expect(screen.getByTestId("srt-target")).toHaveAttribute("data-trial-index", "3");
});

test.each([["hard", 1000], ["expert", 800]])("%s waits 3s between onsets and expires at its response window", (difficulty, visibleTime) => {
  startTraining(difficulty);
  advance(3020);
  expect(acorn()).toHaveStyle({ width: "118px" });
  advance(visibleTime);
  expect(acorn()).toBeNull();
  advance(3000 - visibleTime - 30);
  expect(acorn()).toBeNull();
  advance(40);
  expect(acorn()).not.toBeNull();
});

test.each([[0.01, 1000], [0.25, 1500], [0.45, 2000], [0.65, 2500]])(
  "advanced training can select interval %s → %sms", (random, interval) => {
    Math.random.mockReturnValue(random);
    startTraining("hard");
    advance(interval - 1);
    expect(acorn()).toBeNull();
    advance(21);
    expect(acorn()).not.toBeNull();
    advance(1000);
    expect(Boolean(acorn())).toBe(interval === 1000);
    advance(interval - 1000 + 20);
    expect(acorn()).not.toBeNull();
  }
);

test.each([[0, 1000], [0.99, 3000]])("assessment random %s uses %sms onsets, independent of hit time", (random, interval) => {
  Math.random.mockReturnValue(random);
  startTest();
  advance(interval + 20);
  expect(acorn()).toHaveStyle({ width: "118px" });
  expect(screen.queryByAltText("金色橡實")).not.toBeInTheDocument();
  advance(200);
  fireEvent.click(acorn());
  advance(interval - 240);
  expect(acorn()).toBeNull();
  advance(80);
  expect(acorn()).not.toBeNull();
  fireEvent.click(acorn());
  const secondTrial = useTestAttempt().checkpoint.mock.calls.at(-1)[0].trials[1];
  expect(secondTrial.stimulusIntervalMs).toBeGreaterThanOrEqual(interval);
  expect(secondTrial.stimulusIntervalMs).toBeLessThanOrEqual(interval + 16);
});

test("assessment records clicks during the empty gap", () => {
  startTest();
  fireEvent.click(screen.getByTestId("srt-game-area"));
  expect(useTestAttempt().checkpoint).toHaveBeenLastCalledWith(expect.objectContaining({
    behaviorRecords: [expect.objectContaining({ targetType: "background", falseClickCount: 1 })],
  }));
});
