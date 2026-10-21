import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrainingPagePM from "./TrainingPage_PM";
import TestPagePM from "./TestPage_PM";
import { saveUnifiedResult } from "../utils/resultManager";
import { useTestAttempt } from "../utils/useTestAttempt";

jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));
// Practice has its own flow tests; these tests exercise the formal clock.
jest.mock("../components/PMPractice", () => ({ onComplete }) => <button onClick={onComplete}>完成試玩</button>);

const advance = (milliseconds) => act(() => jest.advanceTimersByTime(milliseconds));
const stage = () => screen.getByTestId("pm-stage");
const options = () => within(stage()).queryAllByRole("button")
  .filter((button) => button.dataset.itemId);
const option = (id) => options().find((button) => button.dataset.itemId === id);
const memoryIds = () => within(stage()).queryAllByRole("img")
  .map((image) => image.getAttribute("src")?.match(/PM_(\d{2})\.(?:webp|png)$/)?.[1])
  .filter(Boolean).map((number) => `PM${number}`);
let attempt;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  window.HTMLMediaElement.prototype.play.mockResolvedValue(undefined);
  localStorage.clear();
  localStorage.setItem("currentChild", JSON.stringify({ childId: "child-pm", name: "測試" }));
  attempt = {
    begin: jest.fn(() => ({ resultId: "pm-attempt" })),
    checkpoint: jest.fn(),
    complete: jest.fn((result) => result),
  };
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

function finishReadyCountdown() {
  expect(stage()).toHaveAttribute("data-phase", "readyCountdown");
  // Let each countdown update commit before scheduling the next second.
  for (let second = 0; second < 5; second += 1) advance(1000);
  expect(stage()).toHaveAttribute("data-phase", "memorize");
}

function startTraining(difficulty) {
  renderPage(<TrainingPagePM />, `/training-picture-memory?difficulty=${difficulty}`);
  fireEvent.click(screen.getByRole("button", { name: "開始遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  finishReadyCountdown();
}

function startAssessment() {
  renderPage(<TestPagePM />, "/test-picture-memory");
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  fireEvent.click(screen.getByRole("button", { name: "完成試玩" }));
  expect(stage()).toHaveAttribute("data-phase", "memorize");
}

function observe(showSeconds, checkBoundary = false) {
  const targets = memoryIds();
  expect(targets).toHaveLength(Number(stage().dataset.memoryCount));
  if (checkBoundary) {
    advance(showSeconds * 1000 - 1);
    expect(stage()).toHaveAttribute("data-phase", "memorize");
    advance(1);
  } else advance(showSeconds * 1000);
  expect(stage()).toHaveAttribute("data-phase", "answer");
  // The clock begins on the first rendered answer frame. Advancing that frame
  // separately gives exact boundaries for reminders and the answer deadline.
  act(() => jest.advanceTimersToNextTimer());
  expect(stage()).toHaveAttribute("data-phase", "answer");
  return targets;
}

function submitIds(ids) {
  ids.forEach((id) => {
    expect(option(id)).toBeTruthy();
    fireEvent.click(option(id));
  });
  fireEvent.click(screen.getByRole("button", { name: "放進小籃子" }));
}

function nextTrainingRound() {
  advance(200);
  finishReadyCountdown();
}

function nextAssessmentRound() {
  fireEvent.click(screen.getByRole("button", { name: "下一步" }));
  advance(200);
}

const trainingResult = () => saveUnifiedResult.mock.calls[0][0].rawResult;
const recordedAssessmentTrials = () => attempt.checkpoint.mock.calls
  .flatMap(([payload]) => payload.trials || []);

test.each([
  ["beginner", [2, 2]],
  ["easy", [3, 3, 4, 4]],
  ["medium", [4, 4, 5, 5]],
  ["hard", [5, 5, 6, 6]],
  ["expert", [6, 6, 7, 7]],
])("%s training adjusts memory load with the agreed viewing times and one fifteen-second limit", (difficulty, counts) => {
  startTraining(difficulty);
  counts.forEach((count, index) => {
    const showTime = count <= 3 ? 3 : 5;
    expect(stage()).toHaveAttribute("data-difficulty", difficulty);
    expect(stage()).toHaveAttribute("data-memory-count", String(count));
    expect(stage()).toHaveAttribute("data-show-time", String(showTime));
    expect(stage()).toHaveAttribute("data-answer-limit", "15");
    within(stage()).getAllByRole("img").forEach((image) => {
      expect(image.style.transform).toBe("");
      expect(image.style.opacity).toBe("");
      expect(image.style.animation).toBe("");
    });
    const targets = observe(showTime, true);
    expect(options().length).toBeLessThanOrEqual(12);
    expect(new Set(options().map((button) => button.dataset.itemId)).size).toBe(options().length);
    advance(300);
    submitIds(targets);
    if (index < counts.length - 1) nextTrainingRound();
  });
  expect(stage()).toHaveAttribute("data-phase", "endingVideo");
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
  expect(trainingResult().stimulusPolicy.poolSize).toBe(29);
  const trials = trainingResult().trials;
  expect(trials.map((trial) => trial.memoryCount)).toEqual(counts);
  expect(trials.every((trial) => trial.answerTimeLimit === 15 && trial.isCorrect)).toBe(true);
  expect(trials.every((trial) => trial.motionMode === "none" && trial.adaptiveOffset === 0)).toBe(true);
});

test("formal assessment holds viewing at five seconds across twelve trials, with loads two through seven and no practice prompts", () => {
  startAssessment();
  const counts = [2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7];
  counts.forEach((count) => {
    expect(stage()).toHaveAttribute("data-memory-count", String(count));
    expect(stage()).toHaveAttribute("data-show-time", "5");
    expect(stage()).toHaveAttribute("data-answer-limit", "15");
    const targets = observe(5, true);
    expect(screen.queryByTestId("pm-idle-hint")).not.toBeInTheDocument();
    expect(screen.queryByAltText("示範點擊")).not.toBeInTheDocument();
    advance(300);
    submitIds(targets);
    expect(stage()).toHaveAttribute("data-phase", "feedback");
    nextAssessmentRound();
  });
  expect(attempt.complete).toHaveBeenCalledTimes(1);
  const result = attempt.complete.mock.calls[0][0];
  expect(result.trials.map((trial) => trial.memoryCount)).toEqual(counts);
  expect(result.trials.every((trial) => trial.showTime === 5 && trial.answerTimeLimit === 15)).toBe(true);
  expect(result.trials.every((trial) => trial.promptCount === 0)).toBe(true);
});

test("entry reminder appears after three seconds on an option and saves each actual display once", () => {
  startTraining("beginner");
  observe(3);
  advance(2999);
  expect(screen.queryByTestId("pm-idle-hint")).not.toBeInTheDocument();
  advance(1);
  const hint = screen.getByAltText("點擊物件提示");
  expect(within(options()[0]).getByAltText("點擊物件提示")).toBe(hint);
  advance(12000);
  nextTrainingRound();
  observe(3);
  advance(15000);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
  const result = trainingResult();
  expect(result.trials).toHaveLength(2);
  result.trials.forEach((trial) => {
    expect(trial).toMatchObject({ promptCount: 1, isTimeout: true, reactionTime: 15000 });
    expect(trial.promptEvents).toHaveLength(1);
    expect(trial.promptEvents[0]).toMatchObject({ type: "idle_mouse", timestamp: 3000 });
    expect(trial.optionIds).toContain(trial.promptEvents[0].optionId);
  });
  expect(result.promptCount).toBe(2);
  expect(result.summary.promptCount).toBe(2);
  expect(result.metrics.promptCount).toBe(2);
});

test("an entry object click cancels the reminder even if the child later deselects it", () => {
  startTraining("beginner");
  const targets = observe(3);
  advance(1000);
  fireEvent.click(option(targets[0]));
  advance(100);
  fireEvent.click(option(targets[0]));
  advance(3000);
  expect(screen.queryByTestId("pm-idle-hint")).not.toBeInTheDocument();
  submitIds(targets);
  nextTrainingRound();
  submitIds(observe(3));
  const first = trainingResult().trials[0];
  expect(first.promptCount).toBe(0);
  expect(first.tapLogs.slice(0, 2)).toMatchObject([
    { itemId: targets[0], action: "select", timestamp: 1000 },
    { itemId: targets[0], action: "deselect", timestamp: 1100 },
  ]);
  expect(first.clickLogs).toEqual(first.tapLogs);
});

test.each(["easy", "medium", "hard", "expert"])("%s training has no idle object reminder", (difficulty) => {
  startTraining(difficulty);
  observe(Number(stage().dataset.showTime));
  advance(6000);
  expect(screen.queryByTestId("pm-idle-hint")).not.toBeInTheDocument();
  advance(9000);
  nextTrainingRound();
  observe(Number(stage().dataset.showTime));
  advance(15000);
  expect(stage()).toHaveAttribute("data-phase", "endingVideo");
  expect(trainingResult().trials.every((trial) => trial.promptCount === 0)).toBe(true);
  expect(trainingResult().promptCount).toBe(0);
});

test.each(["beginner", "expert"])("%s training cannot extend the fifteen-second deadline by toggling an option", (difficulty) => {
  startTraining(difficulty);
  const targets = observe(Number(stage().dataset.showTime));
  advance(14900);
  fireEvent.click(option(targets[0]));
  advance(50);
  fireEvent.click(option(targets[0]));
  advance(49);
  expect(stage()).toHaveAttribute("data-phase", "answer");
  advance(1);
  fireEvent.click(option(targets[0]));
  expect(option(targets[0])).toHaveAttribute("aria-pressed", "false");
  nextTrainingRound();
  observe(Number(stage().dataset.showTime));
  advance(15000);
  const first = trainingResult().trials[0];
  expect(first).toMatchObject({ isTimeout: true, reactionTime: 15000, selectedIds: [] });
  expect(first.tapLogs.map((tap) => tap.timestamp)).toEqual([14900, 14950]);
});

test("assessment timeout is fifteen seconds even after a late object selection", () => {
  startAssessment();
  const targets = observe(5);
  advance(14900);
  targets.forEach((id) => fireEvent.click(option(id)));
  advance(99);
  expect(recordedAssessmentTrials()).toHaveLength(0);
  advance(1);
  expect(stage()).toHaveAttribute("data-phase", "feedback");
  const trial = recordedAssessmentTrials()[0];
  expect(trial).toMatchObject({ isTimeout: true, reactionTime: 15000, selectedIds: targets });
  expect(trial.tapLogs[0]).toMatchObject({ itemId: targets[0], timestamp: 14900 });
  expect(trial.promptCount).toBe(0);
});

test("a selected lookalike is recorded as possible confusion with a missed target and preserves click history", () => {
  startTraining("beginner");
  const targets = observe(3);
  expect(targets).toContain("PM10");
  expect(options().map((button) => button.dataset.itemId)).toContain("PM22");
  advance(250);
  const selected = targets.map((id) => id === "PM10" ? "PM22" : id);
  submitIds(selected);
  nextTrainingRound();
  submitIds(observe(3));
  const first = trainingResult().trials[0];
  expect(first).toMatchObject({
    isCorrect: false, selectedIds: selected, possibleConfusionCount: 1,
    visualSimilarityConfusionCount: 1, categoryConfusionCount: 0,
  });
  expect(first.confusionAnalysis.errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ selectedId: "PM22", type: "visual_similarity", matchedTargetIds: ["PM10"], possibleConfusion: true }),
  ]));
  expect(first.confusionAnalysis.definition).toContain("不能確認實際錯誤原因");
  expect(first.tapLogs).toHaveLength(2);
  expect(first.tapLogs.every((tap) => tap.timestamp === 250)).toBe(true);
  expect(first.clickLogs).toEqual(first.tapLogs);
});

test("a wrong item from the same category stays distinct from an explicitly defined visual lookalike", () => {
  Math.random.mockReturnValue(0.9999);
  startTraining("beginner");
  const targets = observe(3);
  expect(targets).toEqual(["PM01", "PM02"]);
  expect(option("PM04")).toBeTruthy();
  submitIds(["PM04", "PM02"]);
  nextTrainingRound();
  submitIds(observe(3));
  const first = trainingResult().trials[0];
  expect(first).toMatchObject({ possibleConfusionCount: 1, visualSimilarityConfusionCount: 0, categoryConfusionCount: 1 });
  expect(first.confusionAnalysis.errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ selectedId: "PM04", type: "same_category", matchedTargetIds: ["PM01"] }),
  ]));
});

test("a corrected wrong click remains in the click history without becoming a final confusion error", () => {
  startTraining("beginner");
  const targets = observe(3);
  fireEvent.click(option("PM22"));
  advance(100);
  fireEvent.click(option("PM22"));
  submitIds(targets);
  nextTrainingRound();
  submitIds(observe(3));
  const first = trainingResult().trials[0];
  expect(first).toMatchObject({ isCorrect: true, wrongTapCount: 1, possibleConfusionCount: 0 });
  expect(first.confusionAnalysis.errors).toEqual([]);
  expect(first.tapLogs.slice(0, 2)).toMatchObject([
    { itemId: "PM22", action: "select", isCorrectItem: false },
    { itemId: "PM22", action: "deselect", isCorrectItem: false },
  ]);
});

test("training preserves a blocked selection at the limit without changing answers or counting a confusion error", () => {
  startTraining("beginner");
  const targets = observe(3);
  targets.forEach((id) => fireEvent.click(option(id)));
  const blockedId = options().find((button) => !targets.includes(button.dataset.itemId)).dataset.itemId;
  advance(125);
  fireEvent.click(option(blockedId));
  expect(option(blockedId)).toHaveAttribute("aria-pressed", "false");
  expect(options().filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.dataset.itemId).sort()).toEqual([...targets].sort());
  fireEvent.click(screen.getByRole("button", { name: "放進小籃子" }));
  nextTrainingRound();
  submitIds(observe(3));
  const first = trainingResult().trials[0];
  expect(first).toMatchObject({ isCorrect: true, selectedIds: targets, wrongTapCount: 0, possibleConfusionCount: 0 });
  expect(first.confusionAnalysis.errors).toEqual([]);
  expect(first.tapLogs).toHaveLength(3);
  expect(first.tapLogs[2]).toMatchObject({
    itemId: blockedId, timestamp: 125, action: "blocked_select", reason: "selection_limit",
    isCorrectItem: false, selectedCountAfter: 2,
  });
  expect(first.clickLogs).toEqual(first.tapLogs);
});

test("assessment preserves a blocked selection at the limit without changing answers or counting a confusion error", () => {
  startAssessment();
  const targets = observe(5);
  expect(targets).toHaveLength(2);
  targets.forEach((id) => fireEvent.click(option(id)));
  const blockedId = options().find((button) => !targets.includes(button.dataset.itemId)).dataset.itemId;
  advance(125);
  fireEvent.click(option(blockedId));
  expect(option(blockedId)).toHaveAttribute("aria-pressed", "false");
  expect(options().filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.dataset.itemId).sort()).toEqual([...targets].sort());
  fireEvent.click(screen.getByRole("button", { name: "放進小籃子" }));
  const first = recordedAssessmentTrials().find((trial) => trial.trialNumber === 1);
  expect(first).toMatchObject({ isCorrect: true, selectedIds: targets, wrongTapCount: 0, possibleConfusionCount: 0 });
  expect(first.confusionAnalysis.errors).toEqual([]);
  expect(first.tapLogs).toHaveLength(3);
  expect(first.tapLogs[2]).toMatchObject({
    itemId: blockedId, timestamp: 125, action: "blocked_select", reason: "selection_limit",
    isCorrectItem: false, selectedCountAfter: 2,
  });
  expect(first.clickLogs).toEqual(first.tapLogs);
});
