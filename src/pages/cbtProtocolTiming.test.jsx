import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrainingPageCBT from "./TrainingPage_CBT";
import TestPageCBT from "./TestPage_CBT";
import { saveUnifiedResult } from "../utils/resultManager";
import { useTestAttempt } from "../utils/useTestAttempt";

jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));

const advance = (milliseconds) => act(() => jest.advanceTimersByTime(milliseconds));
const board = () => screen.queryByTestId("cbt-board");
const stones = () => within(board()).getAllByRole("button");
const layout = () => stones().map((stone) => ({ top: stone.style.top, left: stone.style.left }));
const visibleLayout = () => layout().map(({ top, left }) => `${top},${left}`).sort();
const glowingStones = () => stones().filter((stone) =>
  within(stone).getByAltText(/^第 \d+ 顆石頭$/).getAttribute("src") === "stone_shiny.webp");
const activeStone = () => glowingStones()[0];
const playedSounds = () => window.HTMLMediaElement.prototype.play.mock.instances
  .map((media) => media.src.split("/").pop());
let attempt;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  window.HTMLMediaElement.prototype.play.mockResolvedValue(undefined);
  localStorage.clear();
  localStorage.setItem("currentChild", JSON.stringify({ childId: "child-cbt", name: "測試" }));
  attempt = { begin: jest.fn(), checkpoint: jest.fn(), complete: jest.fn((result) => result) };
  useTestAttempt.mockReturnValue(attempt);
  jest.spyOn(Math, "random").mockReturnValue(0.2);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function renderPage(page, route) {
  render(<MemoryRouter initialEntries={[route]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{page}</MemoryRouter>);
}

// Each timer advance lets React commit the next playback step before the next
// advance; one large batch would leave subsequent useEffect timers unscheduled.
function playSequence(showMilliseconds) {
  const sequence = [];
  for (let step = 0; step < 8 && /Show$|^show$/.test(board()?.dataset.phase || ""); step += 1) {
    const target = activeStone();
    expect(target).toBeTruthy();
    sequence.push(stones().indexOf(target));
    advance(showMilliseconds);
    advance(260);
  }
  expect(board()).toHaveAttribute("data-phase", expect.stringMatching(/Answer$|^answer$/));
  return sequence;
}

function answer(sequence) {
  sequence.forEach((index) => {
    fireEvent.click(stones()[index]);
    advance(260);
  });
  advance(650);
}

function startTraining(difficulty) {
  renderPage(<TrainingPageCBT />, `/training-cbt?difficulty=${difficulty}`);
  fireEvent.click(screen.getByRole("button", { name: "開始練習" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  expect(screen.getByText(/先看完亮燈.*再.*點石頭/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  const warmup = playSequence(1000);
  answer(warmup);
  fireEvent.click(screen.getByRole("button", { name: "進入正式訓練" }));
}

function startAssessment() {
  renderPage(<TestPageCBT />, "/test-cbt");
  fireEvent.click(screen.getByRole("button", { name: "開始遊戲" }));
  expect(screen.getByText(/先看完亮燈.*再.*點石頭/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  for (let second = 0; second < 5; second += 1) advance(1000);
}

function nextTrainingRound() {
  fireEvent.click(screen.getByRole("button", { name: "進入下一題" }));
}

function finishAfterTwoTrainingTimeouts(showMilliseconds) {
  advance(15000);
  nextTrainingRound();
  playSequence(showMilliseconds);
  advance(15000);
  nextTrainingRound();
  advance(550);
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
  return saveUnifiedResult.mock.calls[0][0].rawResult;
}

test("assessment keeps all nine stone positions fixed and reaches at most seven steps", () => {
  startAssessment();
  const original = layout();
  expect(original).toHaveLength(9);
  const lengths = [];
  for (let question = 0; question < 12; question += 1) {
    expect(layout()).toEqual(original);
    const sequence = playSequence(800);
    lengths.push(sequence.length);
    answer(sequence);
    if (question < 11) fireEvent.click(screen.getByRole("button", { name: "進入下一題" }));
  }
  expect(lengths).toEqual([2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
  advance(2000);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
});

test.each(["training", "assessment"])("%s stone click targets do not overlap neighboring rows", (mode) => {
  if (mode === "training") startTraining("expert");
  else startAssessment();
  const targets = stones().map((stone) => ({
    left: parseFloat(stone.style.left), top: parseFloat(stone.style.top),
    width: parseFloat(stone.style.width), height: parseFloat(stone.style.height),
  }));
  expect(targets).toHaveLength(9);
  const overlappingPairs = targets.flatMap((target, index) => targets.slice(index + 1)
    .filter((other) => Math.abs(target.left - other.left) < (target.width + other.width) / 2
      && Math.abs(target.top - other.top) < (target.height + other.height) / 2));
  expect(overlappingPairs).toHaveLength(0);
});

test.each(["beginner", "easy"])("%s training retains the stone layout between questions", (difficulty) => {
  startTraining(difficulty);
  const original = layout();
  expect(screen.queryByTestId("cbt-environment")).not.toBeInTheDocument();
  answer(playSequence(difficulty === "beginner" ? 1000 : 800));
  Math.random.mockReturnValue(0.8);
  nextTrainingRound();
  expect(layout()).toEqual(original);
});

test.each([["beginner", 3], ["easy", 4], ["medium", 5], ["hard", 6], ["expert", 7]])(
  "%s training completes at its %s-step ceiling with no more than nine visible stones", (difficulty, maximum) => {
    startTraining(difficulty);
    const lengths = [];
    for (let question = 0; question < 4; question += 1) {
      expect(stones().length).toBeLessThanOrEqual(9);
      const sequence = playSequence(difficulty === "beginner" ? 1000 : 800);
      lengths.push(sequence.length);
      answer(sequence);
      nextTrainingRound();
    }
    expect(lengths).toEqual([maximum - 1, maximum - 1, maximum, maximum]);
    expect(board()).not.toBeInTheDocument();
    expect(screen.getByText("完成了！")).toBeInTheDocument();
  }
);

test.each(["medium", "hard", "expert"])("%s changes positions and confines weather to observation outside the stones", (difficulty) => {
  startTraining(difficulty);
  const original = visibleLayout();
  const environment = screen.getByTestId("cbt-environment");
  expect(within(environment).queryByTestId("cbt-board")).not.toBeInTheDocument();
  expect(within(board()).queryByTestId("cbt-environment")).not.toBeInTheDocument();
  expect(screen.getByAltText("下雨")).toBeInTheDocument();
  expect(screen.getByAltText("雷電")).toBeInTheDocument();
  expect(glowingStones()).toHaveLength(1);
  const sequence = playSequence(800);
  expect(screen.queryByTestId("cbt-environment")).not.toBeInTheDocument();
  expect(glowingStones()).toHaveLength(0);
  answer(sequence);
  Math.random.mockReturnValue(0.8);
  nextTrainingRound();
  expect(visibleLayout()).not.toEqual(original);
  expect(screen.getByTestId("cbt-environment")).toBeInTheDocument();
});

test.each([["beginner", 1000], ["easy", 800], ["medium", 800], ["hard", 800], ["expert", 800]])(
  "%s shows each target for %sms without flashing unrelated stones", (difficulty, duration) => {
    startTraining(difficulty);
    const original = activeStone();
    advance(duration - 1);
    expect(activeStone()).toBe(original);
    expect(glowingStones()).toHaveLength(1);
    advance(1);
    expect(activeStone()).toBeUndefined();
    advance(259);
    expect(activeStone()).toBeUndefined();
    advance(1);
    expect(activeStone()).toBeTruthy();
    expect(glowingStones()).toHaveLength(1);
  }
);

test.each(["training", "assessment"])("%s records early taps silently and announces when playback finishes", (mode) => {
  if (mode === "training") startTraining("easy");
  else startAssessment();
  window.HTMLMediaElement.prototype.play.mockClear();
  fireEvent.click(stones()[0]);
  expect(board()).toHaveAttribute("data-early-click-count", "1");
  expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  expect(screen.queryByTestId("cbt-ready-cue")).not.toBeInTheDocument();
  playSequence(800);
  expect(screen.getByTestId("cbt-ready-cue")).toHaveTextContent("可以開始點了");
  expect(playedSounds()).toEqual(["start.mp3"]);
  expect(board()).toHaveAttribute("data-early-click-count", "1");
});

test("entry training prompts at three seconds and saves actual reminders and early taps", () => {
  startTraining("beginner");
  fireEvent.click(stones()[0]);
  playSequence(1000);
  advance(2999);
  expect(screen.queryByAltText("點擊石頭提示")).not.toBeInTheDocument();
  advance(1);
  expect(screen.getByAltText("點擊石頭提示")).toBeInTheDocument();
  expect(board()).toHaveAttribute("data-prompt-count", "1");
  advance(12000);
  nextTrainingRound();
  playSequence(1000);
  advance(15000);
  nextTrainingRound();
  advance(550);
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  const result = saveUnifiedResult.mock.calls[0][0].rawResult;
  const trials = result.history;
  expect(trials[0]).toMatchObject({ promptCount: 1, earlyClickCount: 1, timeout: true });
  expect(trials[0].earlyClickEvents).toHaveLength(1);
  expect(trials[0].earlyClickEvents[0]).toMatchObject({ interpretation: "timing_event_requires_context" });
  expect(result.promptCount).toBe(2);
  expect(result.summary.promptCount).toBe(2);
  expect(result.metrics.promptCount).toBe(2);
});

test("entry training reveals the correct second target after an error and lets the child retry", () => {
  startTraining("beginner");
  const sequence = playSequence(1000);
  fireEvent.click(stones()[sequence[0]]);
  advance(260);
  const wrong = stones().findIndex((stone, index) => index !== sequence[1]);
  fireEvent.click(stones()[wrong]);
  advance(260);
  expect(board()).toHaveAttribute("data-phase", "answer");
  expect(screen.getByTestId("cbt-answer-hint")).toBeInTheDocument();
  expect(within(stones()[sequence[1]]).getByAltText("點擊石頭提示")).toBeInTheDocument();
  expect(board()).toHaveAttribute("data-prompt-count", "1");
  advance(3000);
  expect(board()).toHaveAttribute("data-prompt-count", "1");
  expect(screen.getByTestId("cbt-answer-hint")).toBeInTheDocument();
  fireEvent.click(stones()[sequence[1]]);
  advance(260);
  expect(screen.getByRole("button", { name: "進入下一題" })).toBeInTheDocument();
});

test("training ends an unanswered trial at fifteen seconds even during a walking animation", () => {
  startTraining("easy");
  const sequence = playSequence(800);
  advance(14900);
  fireEvent.click(stones()[sequence[0]]);
  advance(99);
  expect(board()).toHaveAttribute("data-phase", "answer");
  advance(1);
  expect(screen.getByRole("button", { name: "進入下一題" })).toBeInTheDocument();
  advance(260);
  expect(screen.getByRole("button", { name: "進入下一題" })).toBeInTheDocument();
});

test("training timeout records the full fifteen seconds after an accepted early step", () => {
  startTraining("easy");
  const sequence = playSequence(800);
  advance(500);
  fireEvent.click(stones()[sequence[0]]);
  advance(260);
  advance(14240);
  nextTrainingRound();
  playSequence(800);
  advance(15000);
  nextTrainingRound();
  advance(550);
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  const firstTrial = saveUnifiedResult.mock.calls[0][0].rawResult.history[0];
  expect(firstTrial).toMatchObject({
    timeout: true, userSequence: [sequence[0]], firstTapTime: 500,
    reactionTime: 15000, answerTime: 15000,
  });
});

test("assessment records timeout at fifteen seconds even during a walking animation", () => {
  startAssessment();
  const sequence = playSequence(800);
  advance(14900);
  fireEvent.click(stones()[sequence[0]]);
  advance(99);
  const recordedTimeouts = () => attempt.checkpoint.mock.calls
    .flatMap(([payload]) => payload.trials || []).filter((trial) => trial.timeout);
  expect(recordedTimeouts()).toHaveLength(0);
  advance(1);
  expect(recordedTimeouts()).toHaveLength(1);
  advance(260);
  expect(recordedTimeouts()).toHaveLength(1);
});

test("assessment timeout retains all fifteen seconds after a completed walking animation", () => {
  startAssessment();
  const sequence = playSequence(800);
  advance(500);
  fireEvent.click(stones()[sequence[0]]);
  advance(260);
  advance(14240);
  const trials = attempt.checkpoint.mock.calls.flatMap(([payload]) => payload.trials || []);
  expect(trials[0]).toMatchObject({
    timeout: true, userSequence: [sequence[0]], firstTapTime: 500,
    reactionTime: 15000, answerTime: 15000, responseElapsedMs: 15000,
  });
});

test("training without hints still enforces the same fifteen-second answer limit", () => {
  startTraining("expert");
  playSequence(800);
  expect(screen.queryByAltText("點擊石頭提示")).not.toBeInTheDocument();
  const result = finishAfterTwoTrainingTimeouts(800);
  const trials = result.history;
  expect(trials).toHaveLength(2);
  expect(trials.every((trial) => trial.timeout && trial.promptCount === 0)).toBe(true);
});
