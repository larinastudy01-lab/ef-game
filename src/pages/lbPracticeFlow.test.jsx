import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestPageLB from "./TestPage_LB";
import { LB_PRACTICE_STAGES } from "../utils/lbPracticeProtocol";
import { LB_PRACTICE_AUDIO } from "../utils/lbPracticeAudio";
import { saveUnifiedResult } from "../utils/resultManager";

const mockAttempt = { begin: jest.fn(), checkpoint: jest.fn(), complete: jest.fn((raw) => raw) };
jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: () => mockAttempt }));
jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../utils/lbDoorplateAssets", () => ({
  getLBDoorplateImage: (color, number) => `${color}_${number}.webp`,
}));

let recordings;
let audioSpy;
const advance = async (ms) => act(async () => { jest.advanceTimersByTime(ms); });
const board = () => document.querySelector("[data-mode]");
const plate = (key) => {
  const [color, number] = key.split("-");
  return screen.getByRole("button", { name: `${color === "blue" ? "藍色" : "黃色"}${number}`, exact: true });
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: "送出答案" }));
const select = (keys) => keys.forEach((key) => fireEvent.click(plate(key)));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockAttempt.complete.mockImplementation((raw) => raw);
  localStorage.clear();
  sessionStorage.clear();
  recordings = [];
  audioSpy = jest.spyOn(window, "Audio").mockImplementation((src) => {
    const audio = document.createElement("audio");
    audio.src = src;
    recordings.push(audio);
    return audio;
  });
});

afterEach(() => {
  cleanup();
  audioSpy.mockRestore();
  jest.useRealTimers();
});

function start() {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TestPageLB /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "開始", exact: true }));
  fireEvent.ended(document.querySelector("video"));
}

async function finishCue(event) {
  expect(recordings.at(-1).getAttribute("src")).toBe(LB_PRACTICE_AUDIO[event]);
  await act(async () => { fireEvent.ended(recordings.at(-1)); });
}

async function finishIntroduction(steps) {
  await finishCue("question");
  await advance(120);
  for (let index = 0; index < steps; index += 1) {
    await advance(650);
    await advance(550);
  }
  await finishCue("yourTurn");
}

async function finishReview(steps, correct = true) {
  await advance(steps * 700 + (correct ? 1000 : 80));
  if (correct) await finishCue("complete");
}

async function reachPracticeTwo() {
  start();
  await finishIntroduction(1);
  select(LB_PRACTICE_STAGES.practiceMode1.sequence);
  submit();
  await finishReview(5);
}

async function reachFormal() {
  await reachPracticeTwo();
  await finishIntroduction(2);
  select(LB_PRACTICE_STAGES.practiceMode2.sequence);
  submit();
  await finishReview(6);
}

test("STEP ends directly on practice one, with the existing art and controls locked during its one-step demonstration", async () => {
  start();
  expect(board()).toHaveAttribute("data-mode", "practiceMode1");
  expect(screen.queryByLabelText("第一關圖像操作說明")).not.toBeInTheDocument();
  expect(document.querySelectorAll(".lb-doorplate")).toHaveLength(5);
  expect(screen.queryByLabelText("作答進度")).not.toBeInTheDocument();
  expect(screen.getByAltText("綿羊奶奶的房子")).toBeInTheDocument();
  expect(plate("yellow-1")).toBeDisabled();
  expect(recordings).toHaveLength(1);
  await finishCue("question");
  await advance(120);
  expect(screen.getByAltText("滑鼠示範")).toBeInTheDocument();
  await advance(650);
  expect(plate("yellow-1")).toHaveAttribute("aria-pressed", "true");
  expect(plate("yellow-2")).toHaveAttribute("aria-pressed", "false");
  await advance(550);
  expect(screen.queryByAltText("滑鼠示範")).not.toBeInTheDocument();
  expect(plate("yellow-1")).toHaveAttribute("aria-pressed", "false");
  expect(plate("yellow-1")).toBeDisabled();
  await finishCue("yourTurn");
  expect(plate("yellow-1")).toBeEnabled();
  expect(screen.queryByText("0/5")).not.toBeInTheDocument();
  expect(mockAttempt.begin).not.toHaveBeenCalled();
  expect(mockAttempt.checkpoint).not.toHaveBeenCalled();
});

test("idle reminders start five seconds after controls unlock and reset after a selection, removal or blank click without showing a mouse", async () => {
  start();
  await advance(6000); // Opening audio is still running, so no idle cue.
  expect(recordings).toHaveLength(1);
  await finishIntroduction(1);
  await advance(4999);
  expect(recordings).toHaveLength(2);
  fireEvent.click(plate("yellow-1"));
  await advance(4999);
  expect(recordings).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "退回上一個門牌" }));
  await advance(4999);
  expect(recordings).toHaveLength(2);
  await advance(1);
  expect(recordings.at(-1).getAttribute("src")).toBe(LB_PRACTICE_AUDIO.idle);
  expect(screen.queryByAltText("滑鼠示範")).not.toBeInTheDocument();
  const idleAudio = recordings.at(-1);
  const pause = jest.spyOn(idleAudio, "pause");
  fireEvent.click(screen.getByRole("region", { name: "試玩一" }));
  expect(pause).toHaveBeenCalled();
  await advance(5000);
  expect(recordings).toHaveLength(4);
});

test("incomplete or wrong practice answers cannot advance, and the shared undo button removes only the last selection", async () => {
  start();
  await finishIntroduction(1);
  select(["yellow-1", "yellow-3"]);
  expect(screen.getByRole("button", { name: "送出答案" })).toBeDisabled();
  select(["yellow-2", "yellow-4", "yellow-5"]);
  submit();
  expect(board()).toHaveAttribute("data-mode", "practiceMode1");
  expect(board()).toHaveAttribute("data-practice-status", "reviewing");
  expect(screen.getByAltText("沿著答案路線前進的綿羊奶奶")).toHaveAttribute("src", "walk.webp");
  expect(screen.getByRole("button", { name: "退回上一個門牌" })).toBeDisabled();
  await finishReview(5, false);
  expect(board()).toHaveAttribute("data-practice-status", "answering");
  expect(screen.queryByAltText("沿著答案路線前進的綿羊奶奶")).not.toBeInTheDocument();
  expect(recordings).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "退回上一個門牌" }));
  expect(plate("yellow-5")).toHaveAttribute("aria-pressed", "false");
  expect(plate("yellow-4")).toHaveAttribute("aria-pressed", "true");
  for (let index = 0; index < 4; index += 1) fireEvent.click(screen.getByRole("button", { name: "退回上一個門牌" }));
  select(LB_PRACTICE_STAGES.practiceMode1.sequence);
  submit();
  expect(screen.getByRole("button", { name: "送出答案" })).toBeDisabled();
  expect(board()).toHaveAttribute("data-mode", "practiceMode1");
  await finishReview(5);
  expect(board()).toHaveAttribute("data-mode", "practiceMode2");
  expect(mockAttempt.begin).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
});

test("practice two demonstrates yellow 1 then blue 2, clears them, and requires the complete A-rule sequence before formal mode", async () => {
  await reachPracticeTwo();
  expect(document.querySelectorAll(".lb-doorplate")).toHaveLength(10);
  expect(screen.queryByLabelText("作答進度")).not.toBeInTheDocument();
  await finishCue("question");
  await advance(120);
  await advance(650);
  expect(plate("yellow-1")).toHaveAttribute("aria-pressed", "true");
  await advance(550);
  await advance(650);
  expect(plate("blue-2")).toHaveAttribute("aria-pressed", "true");
  expect(plate("blue-1")).toHaveAttribute("aria-pressed", "false");
  await advance(550);
  await finishCue("yourTurn");
  expect(screen.queryByText("0/6")).not.toBeInTheDocument();
  expect(document.querySelectorAll('.lb-doorplate[aria-pressed="true"]')).toHaveLength(0);
  // The right numbers in the wrong colors must fail.
  select(["blue-1", "yellow-2", "blue-3", "yellow-4", "yellow-5", "blue-6"]);
  submit();
  expect(board()).toHaveAttribute("data-practice-status", "reviewing");
  await finishReview(6, false);
  expect(board()).toHaveAttribute("data-practice-status", "answering");
  for (let index = 0; index < 6; index += 1) fireEvent.click(screen.getByRole("button", { name: "退回上一個門牌" }));
  select(LB_PRACTICE_STAGES.practiceMode2.sequence);
  submit();
  submit(); // Double submission cannot trigger two completion cues.
  expect(recordings.filter((audio) => audio.getAttribute("src") === LB_PRACTICE_AUDIO.complete)).toHaveLength(1);
  expect(screen.getByAltText("沿著答案路線前進的綿羊奶奶")).toHaveClass("is-jumping");
  await advance(4200);
  expect(screen.getByAltText("沿著答案路線前進的綿羊奶奶")).toHaveClass("is-entering-home");
  expect(board()).toHaveAttribute("data-mode", "practiceMode2");
  await advance(999);
  expect(board()).toHaveAttribute("data-practice-status", "reviewing");
  await advance(1);
  expect(recordings.filter((audio) => audio.getAttribute("src") === LB_PRACTICE_AUDIO.complete)).toHaveLength(2);
  await finishCue("complete");
  expect(board()).toHaveAttribute("data-mode", "formalMode");
  expect(document.querySelectorAll(".lb-doorplate")).toHaveLength(10);
  expect(screen.queryByText("0/10")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("作答進度")).not.toBeInTheDocument();
  expect(mockAttempt.begin).toHaveBeenCalledTimes(1);
  const audioCount = recordings.length;
  await advance(10000);
  expect(recordings).toHaveLength(audioCount);
  expect(document.querySelector(".lb-mouse-guide, .lb-practice-mouse")).toBeNull();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
});

test.each(["error", "rejected", "timeout"])("%s audio still allows practice and cleans up on unmount", async (failure) => {
  if (failure === "rejected") window.HTMLMediaElement.prototype.play.mockRejectedValueOnce(new Error("autoplay blocked"));
  start();
  const openingAudio = recordings[0];
  const pause = jest.spyOn(openingAudio, "pause");
  if (failure === "error") await act(async () => { fireEvent.error(openingAudio); });
  else if (failure === "timeout") await advance(12000);
  else await act(async () => {});
  await advance(120);
  await advance(650);
  await advance(550);
  await finishCue("yourTurn");
  expect(plate("yellow-1")).toBeEnabled();
  expect(pause).toHaveBeenCalled();
  const count = recordings.length;
  cleanup();
  await advance(30000);
  expect(recordings).toHaveLength(count);
  expect(mockAttempt.begin).not.toHaveBeenCalled();
});

test("leaving during demonstration cancels all later animation and voice callbacks", async () => {
  start();
  await finishCue("question");
  await advance(120);
  cleanup();
  await advance(30000);
  expect(recordings).toHaveLength(1);
  expect(mockAttempt.begin).not.toHaveBeenCalled();
});

test("leaving during practice route review cancels the walker, completion cue and transition", async () => {
  start();
  await finishIntroduction(1);
  select(LB_PRACTICE_STAGES.practiceMode1.sequence);
  submit();
  expect(screen.getByAltText("沿著答案路線前進的綿羊奶奶")).toBeInTheDocument();
  cleanup();
  await advance(30000);
  expect(recordings).toHaveLength(2);
  expect(mockAttempt.begin).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
});

test("both original formal stages still submit twenty scored trials, excluding practice answers and time", async () => {
  await reachFormal();
  const formalStartedAt = Date.now();
  for (let number = 1; number <= 10; number += 1) {
    await advance(100);
    fireEvent.click(screen.getByRole("button", { name: String(number), exact: true }));
  }
  submit();
  await advance(7999);
  expect(screen.getByAltText("沿著答案路線前進的綿羊奶奶")).toHaveClass("is-entering-home");
  expect(document.querySelectorAll(".lb-doorplate")).toHaveLength(10);
  await advance(1); // Enter stage two automatically after the sheep gets home.
  expect(document.querySelectorAll(".lb-doorplate")).toHaveLength(20);
  expect(screen.queryByLabelText("第二關圖像操作說明")).not.toBeInTheDocument();
  expect(document.querySelector(".lb-mouse-guide, .lb-practice-mouse")).toBeNull();
  for (let number = 1; number <= 10; number += 1) {
    await advance(100);
    fireEvent.click(screen.getByRole("button", { name: number % 2 ? `紅 ${number}` : `藍色${number}`, exact: true }));
  }
  submit();
  await advance(8000);
  expect(mockAttempt.begin).toHaveBeenCalledTimes(1);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
  const result = saveUnifiedResult.mock.calls[0][0].rawResult;
  expect(result.trialLogs).toHaveLength(20);
  expect(result.stageRecords).toHaveLength(2);
  expect(result.trialLogs.every((trial) => trial.correct && trial.mode === "test")).toBe(true);
  expect(result.trialLogs.every((trial) => Date.parse(trial.timestamp) >= formalStartedAt)).toBe(true);
  expect(result.totalSelectionTime).toBe(2000);
  expect(recordings).toHaveLength(6);
});

test("the existing formal scoring still accepts a wrong answer without forcing practice-style retry", async () => {
  await reachFormal();
  for (const number of [2, 1, 3, 4, 5, 6, 7, 8, 9, 10]) {
    fireEvent.click(screen.getByRole("button", { name: String(number), exact: true }));
  }
  submit();
  await advance(7080);
  expect(board()).toHaveAttribute("data-mode", "formalMode");
  expect(document.querySelectorAll(".lb-doorplate")).toHaveLength(20);
  expect(screen.queryByText("再試一次，可以按移除調整順序。")).not.toBeInTheDocument();
  const checkpoint = mockAttempt.checkpoint.mock.calls.find(([raw]) => raw.trials?.length);
  expect(checkpoint[0].trials.filter((trial) => !trial.correct)).toHaveLength(2);
  expect(recordings).toHaveLength(6);
});

