import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrainingPageLB from "./TrainingPage_LB";
import { LB_TEST_STAGES } from "./TestPage_LB";
import { saveUnifiedResult } from "../utils/resultManager";
import { analyzeAndSaveLBTraining } from "../ai/lbTrainingAnalyzer";

jest.mock("../utils/lbDoorplateAssets", () => ({
  getLBDoorplateImage: (color, number) => `${color}_${number}.webp`,
}));
jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../ai/lbTrainingAnalyzer", () => ({
  getLBInitialTrainingConfig: () => ({ difficultyLevel: 5, difficulty: "expert", difficultyLabel: "舊設定", recommendedLevelIndex: 4,
    trainingConfig: { hintMode: "always", hintDelayMs: 100, feedbackDelayCorrectMs: 1 } }),
  analyzeAndSaveLBTraining: jest.fn(() => ({ nextDifficulty: "medium", nextDifficultyLevel: 3 })),
}));

const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
const nextTimer = () => act(() => jest.advanceTimersToNextTimer());
const mouse = () => screen.queryByAltText("MOUSE 提示正確答案");
const result = () => saveUnifiedResult.mock.calls[0][0].rawResult;
const plate = (number, color) => screen.getByRole("button", { name: `${color === "red" ? "黃色" : color === "blue" ? "藍色" : "門牌"}${number}`, exact: true });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  analyzeAndSaveLBTraining.mockReturnValue({ nextDifficulty: "medium", nextDifficultyLevel: 3 });
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function start(difficulty, finishStepVideo = false) {
  render(<MemoryRouter initialEntries={[`/training-linking-balloons?difficulty=${difficulty}`]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TrainingPageLB /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "開始訓練" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  // Watching the step video must not consume answer time or trigger reminders.
  advance(25000);
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(mouse()).toBeNull();
  expect(screen.queryByTestId("lb-training-stage")).not.toBeInTheDocument();
  if (finishStepVideo) {
    fireEvent.ended(screen.getByLabelText("步驟說明動畫").querySelector("video"));
  } else {
    fireEvent.click(screen.getByRole("button", { name: "跳過步驟說明" }));
  }
  expect(screen.getByTestId("lb-training-stage")).toHaveAttribute("data-phase", "playing");
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  nextTimer(); // first enabled frame
}

const trainingPositions = () => Object.fromEntries(
  screen.getAllByRole("button", { name: /^(門牌|黃色|藍色)\d+$/ }).map((button) => [
    button.getAttribute("aria-label"),
    [button.style.getPropertyValue("--door-x"), button.style.getPropertyValue("--door-y")].join(","),
  ])
);

test.each([["beginner", 10], ["easy", 20]])("%s keeps shuffled positions through answers and hints, then reshuffles on replay", (difficulty, count) => {
  const random = jest.spyOn(Math, "random").mockReturnValue(0);
  start(difficulty);
  const initialPositions = trainingPositions();
  expect(Object.keys(initialPositions)).toHaveLength(count);
  expect(new Set(Object.values(initialPositions)).size).toBe(count);

  fireEvent.click(plate(2, difficulty === "easy" ? "blue" : "cream"));
  advance(3000);
  expect(mouse()).toBeInTheDocument();
  expect(trainingPositions()).toEqual(initialPositions);

  fireEvent.click(plate(1, difficulty === "easy" ? "red" : "cream"));
  advance(420);
  nextTimer();
  expect(trainingPositions()).toEqual(initialPositions);

  advance(20000);
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  random.mockReturnValue(.73);
  fireEvent.click(screen.getByRole("button", { name: "再玩一次" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過步驟說明" }));
  nextTimer();
  const replayPositions = trainingPositions();
  expect(Object.keys(replayPositions).sort()).toEqual(Object.keys(initialPositions).sort());
  expect(new Set(Object.values(replayPositions)).size).toBe(count);
  expect(replayPositions).not.toEqual(initialPositions);
});

test.each([
  ["beginner", false, false, 20],
  ["easy", false, true, 15],
  ["medium", false, true, 15],
  ["hard", true, false, 15],
  ["expert", true, true, 15],
])("%s completes only its specified ten-target route and records the selected difficulty", (difficulty, backward, colored, seconds) => {
  start(difficulty, true);
  expect(screen.getByTestId("lb-training-stage")).toHaveAttribute("data-difficulty", difficulty);
  const numbers = Array.from({ length: 10 }, (_, index) => backward ? 10 - index : index + 1);
  const targets = numbers.map((number) => plate(number, colored ? number % 2 ? "red" : "blue" : "cream"));
  numbers.forEach((number, index) => {
    advance(100);
    expect(mouse()).toBeNull();
    fireEvent.click(targets[index]);
    advance(420);
    if (index < 9) nextTimer();
  });
  expect(screen.getByTestId("lb-training-stage")).toHaveAttribute("data-phase", "reviewing");
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  expect(screen.queryByText(/路線完成/)).not.toBeInTheDocument();
  const finish = screen.getByRole("button", { name: "完成作答" });
  expect(finish).toBeDisabled();
  fireEvent.click(finish);
  targets.forEach((target, index) => {
    expect(target).toHaveClass("lb-training-visited");
    targets.slice(index + 1).forEach((upcoming) => expect(upcoming).not.toHaveClass("lb-training-visited"));
    const walker = screen.getByAltText("綿羊奶奶走路");
    expect(walker).toHaveClass("is-jumping");
    expect(walker.style.getPropertyValue("--person-x")).toBe(target.style.getPropertyValue("--door-x"));
    expect(walker.style.getPropertyValue("--person-y")).toBe(target.style.getPropertyValue("--door-y"));
    expect(saveUnifiedResult).not.toHaveBeenCalled();
    advance(700);
  });
  expect(screen.getByAltText("綿羊奶奶走路")).toHaveClass("is-entering-home");
  advance(999);
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  advance(1);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
  expect(result()).toMatchObject({ difficulty, completed: true, completedSteps: 10, promptCount: 0, finishReason: "completed", trainingLevel: ["beginner", "easy", "medium", "hard", "expert"].indexOf(difficulty) + 1 });
  expect(result().logs.map((log) => log.expectedNumber)).toEqual(numbers);
  expect(result().logs.every((log) => log.isCorrect && log.answerTimeLimit === seconds)).toBe(true);
  advance(30000);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
});

test("leaving during route review cancels the walk and prevents a late completion save", () => {
  start("beginner");
  for (let number = 1; number <= 10; number += 1) {
    fireEvent.click(plate(number));
    advance(420);
    if (number < 10) nextTimer();
  }
  expect(screen.getByAltText("綿羊奶奶走路")).toBeInTheDocument();
  advance(700);
  cleanup();
  advance(20000);
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test("beginner waits exactly three seconds, counts one visible reminder, and times out at twenty seconds despite wrong clicks", () => {
  start("beginner");
  advance(2999);
  expect(mouse()).toBeNull();
  fireEvent.click(plate(2));
  advance(1);
  expect(mouse()).toBeInTheDocument();
  expect(mouse().closest("button")).toBe(plate(1));
  fireEvent.click(plate(2));
  advance(16999);
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  fireEvent.click(plate(2));
  advance(1);
  expect(result()).toMatchObject({ completed: false, status: "interrupted", finishReason: "timeout", timeoutCount: 1, promptCount: 1, hintCount: 1, idleHintCount: 1, ruleErrorHintCount: 0 });
  expect(result().logs.at(-1)).toMatchObject({ status: "timeout", reactionTime: 20000 });
  expect(result().logs.reduce((sum, log) => sum + log.promptCount, 0)).toBe(1);
  expect(localStorage.getItem("training_lb_level_1_completed")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  expect(screen.getByText(/這次時間到了/)).toBeInTheDocument();
});

test("easy gives an immediate color-rule hint, avoids duplicates, and resets hints only for a new target", () => {
  start("easy");
  advance(100);
  fireEvent.click(plate(1, "blue"));
  expect(mouse().closest("button")).toBe(plate(1, "red"));
  advance(2900);
  fireEvent.click(plate(1, "blue"));
  fireEvent.click(plate(1, "red"));
  advance(420);
  nextTimer();
  expect(mouse()).toBeNull();
  advance(2999);
  expect(mouse()).toBeNull();
  advance(1);
  expect(mouse().closest("button")).toBe(plate(2, "blue"));
  advance(12000);
  expect(result()).toMatchObject({ completed: false, completedSteps: 1, promptCount: 2, idleHintCount: 1, ruleErrorHintCount: 1 });
  expect(result().promptEvents.map((event) => [event.reason, event.stepInLevel, event.elapsedMs])).toEqual([
    ["rule_error", 1, 100], ["idle", 2, 3000],
  ]);
  expect(result().logs.reduce((sum, log) => sum + log.promptCount, 0)).toBe(2);
});

test("a partially completed timeout retains progress without earning a completion achievement", () => {
  start("hard");
  for (let number = 10; number >= 2; number -= 1) {
    fireEvent.click(plate(number));
    advance(420);
    nextTimer();
  }
  advance(15000);
  expect(result()).toMatchObject({ completedSteps: 9, completionRate: 90, completed: false, stars: 1, status: "interrupted", finishReason: "timeout" });
  expect(localStorage.getItem("training_lb_level_4_completed")).toBeNull();
});

test("easy number-only errors use the three-second timer and do not extend the fifteen-second deadline", () => {
  start("easy");
  advance(1000);
  fireEvent.click(plate(3, "red"));
  expect(mouse()).toBeNull();
  advance(1999);
  expect(mouse()).toBeNull();
  advance(1);
  expect(mouse()).toBeInTheDocument();
  advance(11999);
  fireEvent.click(plate(3, "red"));
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  advance(1);
  expect(result()).toMatchObject({ finishReason: "timeout", promptCount: 1, idleHintCount: 1, ruleErrorHintCount: 0 });
});

test.each(["medium", "hard", "expert"])("%s never reveals the answer after errors, finish-button presses or waiting", (difficulty) => {
  start(difficulty);
  const wrongPlate = difficulty === "hard" ? plate(1) : plate(difficulty === "expert" ? 10 : 1, difficulty === "expert" ? "red" : "blue");
  fireEvent.click(wrongPlate);
  fireEvent.click(wrongPlate);
  fireEvent.click(wrongPlate);
  fireEvent.click(screen.getByRole("button", { name: "完成作答" }));
  expect(mouse()).toBeNull();
  advance(14999);
  expect(mouse()).toBeNull();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  fireEvent.click(wrongPlate);
  advance(1);
  expect(result()).toMatchObject({ promptCount: 0, idleHintCount: 0, ruleErrorHintCount: 0, finishReason: "timeout" });
  expect(result().promptEvents).toEqual([]);
});

test("formal assessment retains its two original ascending routes and red/blue parity", () => {
  expect(LB_TEST_STAGES).toHaveLength(2);
  expect(LB_TEST_STAGES[0].sequence).toEqual(Array.from({ length: 10 }, (_, index) => `n-${index + 1}`));
  expect(LB_TEST_STAGES[1].sequence).toEqual(Array.from({ length: 10 }, (_, index) => `${index % 2 ? "blue" : "red"}-${index + 1}`));
  expect(LB_TEST_STAGES[1].items).toHaveLength(20);
});
