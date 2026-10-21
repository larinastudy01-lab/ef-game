/* DOM queries check that the mouse appears inside the correct answer box. */
/* eslint-disable testing-library/no-node-access */
import React, { act, StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrainingPage, { DCCS_TRAINING_LEVELS } from "./TrainingPage_DCCS";
import { DCCS_DIFFICULTY_ORDER, getDccsTrainingCorrectPosition } from "../utils/dccsTrainingProtocol";
import { saveUnifiedResult } from "../utils/resultManager";
import { getDccsClinicalMetrics } from "../utils/dccsClinicalMetrics";

jest.mock("../utils/resultManager", () => ({ createResultId: jest.fn(() => "dccs-training-attempt"), saveUnifiedResult: jest.fn() }));
jest.mock("../utils/useTrainingAchievementAssignment", () => ({ useTrainingAchievementAssignment: jest.fn(() => null) }));
const advance = (ms) => act(() => { jest.advanceTimersByTime(ms); });
const board = () => screen.getByTestId("dccs-training");
const sideButton = (side) => screen.getByRole("button", { name: side === "top" ? "左側分類箱" : "右側分類箱" });
const mouse = () => screen.queryByTestId("dccs-training-mouse");
const result = () => saveUnifiedResult.mock.calls.at(-1)[0].rawResult;

beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-21T00:00:00Z"));
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => window.clearTimeout(id));
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function start(difficulty, strict = false, state = {}) {
  const page = <MemoryRouter initialEntries={[{ pathname: "/training-dccs", search: `?difficulty=${difficulty}`, state }]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TrainingPage /></MemoryRouter>;
  const view = render(strict ? <StrictMode>{page}</StrictMode> : page);
  fireEvent.click(screen.getByRole("button", { name: "開始遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過" }));
  // Guides do not consume answer time or emit answer hints.
  advance(20000);
  fireEvent.click(screen.getByRole("button", { name: "開始本關" }));
  advance(20);
  return view;
}
function currentTrial(difficulty) {
  return DCCS_TRAINING_LEVELS[difficulty].trials[Number(board().dataset.trial) - 1];
}
function correctAnswer(difficulty) {
  fireEvent.click(sideButton(getDccsTrainingCorrectPosition(currentTrial(difficulty), board().dataset.windActive === "true")));
}
function settle() {
  advance(1200);
  const next = screen.queryByRole("button", { name: "繼續" });
  if (next && !screen.queryByTestId("dccs-training")) fireEvent.click(next);
  advance(20);
}
function complete(difficulty) {
  let guard = 0;
  while (screen.queryByTestId("dccs-training") && guard++ < 20) {
    correctAnswer(difficulty); settle();
  }
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
}

test.each(DCCS_DIFFICULTY_ORDER)("%s uses the selected level, rule order and time limit", (difficulty) => {
  const config = DCCS_TRAINING_LEVELS[difficulty];
  expect(Object.keys(DCCS_TRAINING_LEVELS)).toHaveLength(5);
  const stages = [...new Set(config.trials.map((trial) => trial.ruleStage))];
  expect(stages).toEqual(config.ruleSequence);
  expect(config.trials).toHaveLength(config.totalTrials);
  start(difficulty, true);
  expect(board()).toHaveAttribute("data-difficulty", difficulty);
  expect(mouse()).toBeNull();
  advance(3000);
  expect(mouse()?.closest("button") ?? null).toBe(config.hintDelayMs
    ? sideButton(getDccsTrainingCorrectPosition(currentTrial(difficulty))) : null);
  correctAnswer(difficulty); settle(); complete(difficulty);
  expect(result()).toMatchObject({ difficulty, difficultyLabel: config.label, trainingTotal: 5,
    protocol: { answerTimeLimitMs: config.answerTimeLimitMs },
    promptCount: config.hintDelayMs ? 1 : 0, testBasedDifficulty: false, completed: true });
  expect(result().trialLogs).toHaveLength(config.totalTrials);
  expect(result().trialLogs[0].promptCount).toBe(config.hintDelayMs ? 1 : 0);
  expect(result().trialLogs.every((trial) => trial.answerTimeLimitMs === config.answerTimeLimitMs)).toBe(true);
  expect(getDccsClinicalMetrics({ payload: { rawResult: result() } }).promptCount).toBe(config.hintDelayMs ? 1 : 0);
});

test("3-second hint counts once; 15-second timeout advances and saves no answer", () => {
  start("beginner");
  advance(2990); expect(mouse()).toBeNull();
  advance(10); expect(mouse()).not.toBeNull();
  advance(11980); expect(board()).toHaveAttribute("data-trial", "1");
  advance(20); expect(mouse()).toBeNull();
  expect(sideButton("top")).toBeDisabled();
  settle(); complete("beginner");
  expect(result().trialLogs[0]).toMatchObject({ isTimeout: true, result: "timeout", userAnswerSide: null,
    promptCount: 1, hintCount: 1, isCorrect: false });
  expect(result().trialLogs[0].reactionTime).toBe(15000);
  expect(result().promptEvents).toHaveLength(1);
  expect(result().timeoutCount).toBe(1);
});

test("hard times out after 10 seconds without an answer hint", () => {
  start("hard"); advance(9980);
  expect(mouse()).toBeNull(); expect(sideButton("top")).toBeEnabled();
  advance(20); expect(sideButton("top")).toBeDisabled();
  settle(); complete("hard");
  expect(result().trialLogs[0]).toMatchObject({ isTimeout: true, promptCount: 0, reactionTime: 10000 });
});

test("wind reverses the pending trial and restores the original answer when it ends", () => {
  start("expert"); advance(6480);
  expect(screen.getByTestId("dccs-training-wind")).toBeInTheDocument();
  const first = currentTrial("expert");
  const reversed = getDccsTrainingCorrectPosition(first, true);
  expect(reversed).not.toBe(getDccsTrainingCorrectPosition(first));
  fireEvent.click(sideButton(reversed)); settle();
  advance(5000);
  expect(screen.queryByTestId("dccs-training-wind")).toBeNull();
  correctAnswer("expert"); settle(); complete("expert");
  expect(result().trialLogs[0]).toMatchObject({ isReverseRule: true, correctSide: reversed, isCorrect: true });
  expect(result().trialLogs[1]).toMatchObject({ isReverseRule: false, isCorrect: true });
  expect(result().windEvents.map((event) => event.active)).toEqual(expect.arrayContaining([true, false]));
  expect(result().promptCount).toBe(0);
});

test("early answers cancel hints, rapid double clicks save one trial, and unmount clears timers", () => {
  const view = start("easy");
  correctAnswer("easy"); correctAnswer("easy"); settle();
  expect(board()).toHaveAttribute("data-trial", "2");
  complete("easy");
  expect(result().promptCount).toBe(0);
  expect(result().trialLogs).toHaveLength(8);
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});

test.each(["beginner", "expert"])("leaving %s during an active trial clears hint, wind and deadline timers", (difficulty) => {
  const view = start(difficulty);
  advance(6500);
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
  advance(20000);
  expect(saveUnifiedResult).not.toHaveBeenCalled();
});
