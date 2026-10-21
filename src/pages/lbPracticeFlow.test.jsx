import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestPageLB from "./TestPage_LB";
import { LB_PRACTICE_STAGES } from "../utils/lbPracticeProtocol";
import { LB_FORMAL_AUDIO, LB_PRACTICE_AUDIO } from "../utils/lbPracticeAudio";
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
    audio.pause = jest.fn();
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
  await finishOpening(steps);
  await advance(120);
  for (let index = 0; index < steps; index += 1) {
    await advance(650);
    await advance(550);
  }
  await finishCue(steps === 1 ? "turn1" : "turn2");
}

async function finishOpening(steps) {
  for (const cue of steps === 1 ? ["intro", "rule1"] : ["transition", "rule2", "guide2"]) {
    await finishCue(cue);
  }
}

async function finishFormalCue(event) {
  expect(recordings.at(-1).getAttribute("src")).toBe(LB_FORMAL_AUDIO[event]);
  await act(async () => { fireEvent.ended(recordings.at(-1)); });
}

async function finishReview(steps, correct = true) {
  await advance(steps * 700 + (correct ? 1000 : 80));
  if (correct) await finishCue("complete");
  else await finishCue(steps === 5 ? "retry1" : "retry2");
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
  await finishFormalCue("rule1");
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
  await finishOpening(1);
  expect(screen.queryByAltText("滑鼠示範")).not.toBeInTheDocument();
  await advance(120);
  expect(screen.getByAltText("滑鼠示範")).toBeInTheDocument();
  expect(screen.getByAltText("滑鼠示範")).toHaveStyle({
    left: plate("yellow-1").style.left,
    top: plate("yellow-1").style.top,
  });
  await advance(650);
  expect(plate("yellow-1")).toHaveAttribute("aria-pressed", "true");
  expect(plate("yellow-2")).toHaveAttribute("aria-pressed", "false");
  await advance(550);
  expect(screen.queryByAltText("滑鼠示範")).not.toBeInTheDocument();
  expect(plate("yellow-1")).toHaveAttribute("aria-pressed", "false");
  expect(plate("yellow-1")).toBeDisabled();
  await finishCue("turn1");
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
  expect(recordings).toHaveLength(3);
  fireEvent.click(plate("yellow-1"));
  await advance(4999);
  expect(recordings).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "退回上一個門牌" }));
  await advance(4999);
  expect(recordings).toHaveLength(3);
  await advance(1);
  expect(recordings.at(-1).getAttribute("src")).toBe(LB_PRACTICE_AUDIO.idle);
  expect(screen.queryByAltText("滑鼠示範")).not.toBeInTheDocument();
  const idleAudio = recordings.at(-1);
  const pause = jest.spyOn(idleAudio, "pause");
  fireEvent.click(screen.getByRole("region", { name: "試玩一" }));
  expect(pause).toHaveBeenCalled();
  await advance(5000);
  expect(recordings).toHaveLength(5);
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
  expect(recordings.at(-1).getAttribute("src")).toBe(LB_PRACTICE_AUDIO.retry1);
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
  await finishOpening(2);
  await advance(120);
  await advance(650);
  expect(plate("yellow-1")).toHaveAttribute("aria-pressed", "true");
  await advance(550);
  await advance(650);
  expect(plate("blue-2")).toHaveAttribute("aria-pressed", "true");
  expect(plate("blue-1")).toHaveAttribute("aria-pressed", "false");
  await advance(550);
  await finishCue("turn2");
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
  expect(mockAttempt.begin).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "1", exact: true })).toBeDisabled();
  await finishFormalCue("rule1");
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
  await finishCue("rule1");
  await advance(120);
  await advance(650);
  await advance(550);
  await finishCue("turn1");
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
  await finishOpening(1);
  await advance(120);
  cleanup();
  await advance(30000);
  expect(recordings).toHaveLength(2);
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
  expect(recordings).toHaveLength(3);
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
  await advance(2400); // Rule speech must not add to stage two's selection time.
  expect(screen.getByRole("button", { name: "紅 1", exact: true })).toBeDisabled();
  await finishFormalCue("rule2");
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
  expect(recordings).toHaveLength(12);
  expect(recordings.at(-1).getAttribute("src")).toBe("完成囉 你實在是太棒了.mp3");
  startVoiceAt(0);
  expect(screen.getByAltText("小雞正在說明")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "測驗結果" })).not.toContainElement(
    screen.getByRole("complementary", { name: "語音說明區" })
  );
  await finishFormalCue("complete");
  expect(screen.queryByAltText("小雞正在說明")).not.toBeInTheDocument();
  expect(jest.getTimerCount()).toBe(0);
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
  expect(recordings).toHaveLength(11);
  expect(recordings.at(-1).getAttribute("src")).toBe(LB_FORMAL_AUDIO.rule2);
});

test("practice one replaces idle speech with a number reminder and stops it on the next operation", async () => {
  start();
  await finishIntroduction(1);
  await advance(5000);
  const idleAudio = recordings.at(-1);
  fireEvent.click(plate("yellow-3"));
  const errorAudio = recordings.at(-1);
  expect(idleAudio.pause).toHaveBeenCalledTimes(1);
  expect(errorAudio.getAttribute("src")).toBe("哎呀！看看下一個數字是多少？.mp3");
  expect(errorAudio.pause).not.toHaveBeenCalled();
  expect(plate("yellow-3")).toBeEnabled();
  const count = recordings.length;
  fireEvent.click(plate("yellow-3")); // Deselecting is not a new wrong answer.
  fireEvent.click(plate("yellow-1"));
  expect(errorAudio.pause).toHaveBeenCalledTimes(1);
  expect(recordings).toHaveLength(count);
  expect(mockAttempt.checkpoint).not.toHaveBeenCalled();
});

test.each([
  ["yellow-2", "再看看喔！數字要照順序！.mp3"],
  ["blue-1", "哎呀！看看這次應該點什麼顏色？.mp3"],
  ["blue-2", "再看看喔！數字要照順序！.mp3"],
])("practice two distinguishes the first selection %s by number before color", async (key, filename) => {
  await reachPracticeTwo();
  await finishIntroduction(2);
  fireEvent.click(plate(key));
  const audio = recordings.at(-1);
  expect(audio.getAttribute("src")).toBe(filename);
  expect(audio.pause).not.toHaveBeenCalled();
  cleanup();
  expect(audio.pause).toHaveBeenCalledTimes(1);
  await advance(20000);
  expect(recordings.at(-1)).toBe(audio);
});

test("retry speech finishes before editing unlocks, and leaving cancels its callbacks", async () => {
  start();
  await finishIntroduction(1);
  select(["yellow-2", "yellow-1", "yellow-3", "yellow-4", "yellow-5"]);
  submit();
  await advance(3580);
  expect(board()).toHaveAttribute("data-practice-status", "retrying");
  expect(recordings.at(-1).getAttribute("src")).toBe(LB_PRACTICE_AUDIO.retry1);
  expect(screen.getByRole("button", { name: "退回上一個門牌" })).toBeDisabled();
  const audio = startVoiceAt(1.8);
  expect(plate("yellow-1")).toHaveClass("is-voice-highlighted");
  expect(plate("yellow-1")).not.toHaveClass("is-visited");
  expect(plate("yellow-1")).toBeDisabled();
  cleanup();
  expect(audio.pause).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.ended(audio); });
  await advance(30000);
  expect(recordings.at(-1)).toBe(audio);
  expect(mockAttempt.begin).not.toHaveBeenCalled();
});

test("formal speech excludes all introduction time and gives no number, color or idle reminders in either rule", async () => {
  await reachPracticeTwo();
  await finishIntroduction(2);
  select(LB_PRACTICE_STAGES.practiceMode2.sequence);
  submit();
  await finishReview(6);
  await advance(8000);
  expect(mockAttempt.begin).not.toHaveBeenCalled();
  expect(mockAttempt.checkpoint).not.toHaveBeenCalled();
  await finishFormalCue("rule1");
  const audioCount = recordings.length;
  await advance(10000);
  for (const number of [2, 1, 3, 4, 5, 6, 7, 8, 9, 10]) {
    fireEvent.click(screen.getByRole("button", { name: String(number), exact: true }));
  }
  expect(recordings).toHaveLength(audioCount);
  submit();
  await advance(7080);
  expect(recordings).toHaveLength(audioCount + 1);
  await advance(7000);
  await finishFormalCue("rule2");
  const secondStageAudioCount = recordings.length;
  await advance(10000);
  fireEvent.click(screen.getByRole("button", { name: "藍色2", exact: true })); // Wrong number and color.
  fireEvent.click(screen.getByRole("button", { name: "紅 2", exact: true })); // Wrong color.
  fireEvent.click(screen.getByRole("button", { name: "退回上一個門牌" }));
  await advance(10000);
  expect(recordings).toHaveLength(secondStageAudioCount);
  expect(document.querySelector(".lb-practice-mouse")).toBeNull();
});

test.each(["error", "timeout"])("formal introduction %s releases controls without counting speech as response time", async (failure) => {
  await reachPracticeTwo();
  await finishIntroduction(2);
  select(LB_PRACTICE_STAGES.practiceMode2.sequence);
  submit();
  await finishReview(6);
  const audio = recordings.at(-1);
  if (failure === "error") await act(async () => { fireEvent.error(audio); });
  else await advance(12000);
  expect(audio.pause).toHaveBeenCalledTimes(1);
  expect(mockAttempt.begin).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "1", exact: true })).toBeEnabled();
  cleanup();
  expect(jest.getTimerCount()).toBe(0);
});

test("leaving during formal rule speech stops playback and prevents a late assessment start", async () => {
  await reachPracticeTwo();
  await finishIntroduction(2);
  select(LB_PRACTICE_STAGES.practiceMode2.sequence);
  submit();
  await finishReview(6);
  const audio = recordings.at(-1);
  cleanup();
  expect(audio.pause).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.ended(audio); });
  await advance(30000);
  expect(mockAttempt.begin).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

function startVoiceAt(seconds) {
  const audio = recordings.at(-1);
  audio.currentTime = seconds;
  fireEvent.playing(audio);
  return audio;
}

function moveVoiceTo(audio, seconds) {
  audio.currentTime = seconds;
  fireEvent.timeUpdate(audio);
}

function formalPositions(count) {
  const signs = within(screen.getByRole("region", { name: "正式測驗" })).getAllByRole("button");
  expect(signs).toHaveLength(count);
  const xs = signs.map((sign) => parseFloat(sign.style.left));
  const ys = signs.map((sign) => parseFloat(sign.style.top));
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(75);
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(70);
  return signs.map((sign) => sign.getAttribute("style"));
}

test("the large chicken centers without icons, moves beside the rule's cards, and follows the recording clock", async () => {
  start();
  expect(screen.queryByAltText("小雞正在說明")).not.toBeInTheDocument();
  startVoiceAt(0);
  const companion = screen.getByRole("complementary", { name: "語音說明區" });
  expect(companion).toContainElement(screen.getByAltText("小雞正在說明"));
  expect(screen.getByAltText("小雞正在說明")).toHaveAttribute("src", "chicken.webp");
  expect(within(companion).getAllByRole("img", { hidden: true }).map((frame) => frame.getAttribute("src")))
    .toEqual(["chicken.webp", "chicken01.webp"]);
  expect(companion).toHaveClass("is-centered");
  expect(screen.queryByRole("region", { name: "試玩一" })).not.toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "綿羊奶奶的房子" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "送出答案" })).not.toBeInTheDocument();
  await finishCue("intro");
  const rule = startVoiceAt(0);
  expect(companion).not.toHaveClass("is-centered");
  expect(screen.getByRole("region", { name: "試玩一" })).not.toContainElement(companion);
  expect(screen.getByRole("img", { name: "綿羊奶奶的房子" })).toBeInTheDocument();
  expect(plate("yellow-1")).not.toHaveClass("is-voice-highlighted");
  moveVoiceTo(rule, 1.8);
  expect(plate("yellow-1")).toHaveClass("is-voice-highlighted");
  expect(plate("yellow-2")).not.toHaveClass("is-voice-highlighted");
  expect(plate("yellow-1")).toHaveAttribute("aria-pressed", "false");
  await advance(1000); // Buffering leaves the media clock and highlighted card still.
  expect(plate("yellow-1")).toHaveClass("is-voice-highlighted");
  fireEvent.pause(rule);
  expect(screen.queryByAltText("小雞正在說明")).not.toBeInTheDocument();
  expect(plate("yellow-1")).not.toHaveClass("is-voice-highlighted");
  fireEvent.playing(rule);
  expect(plate("yellow-1")).toHaveClass("is-voice-highlighted");
  moveVoiceTo(rule, 4.2);
  expect(plate("yellow-1")).not.toHaveClass("is-voice-highlighted");
  await finishCue("rule1");
  expect(screen.queryByAltText("小雞正在說明")).not.toBeInTheDocument();
  expect(plate("yellow-1")).not.toHaveClass("is-voice-highlighted");
});

test("spoken yellow one and blue two light separately, including after a seek, without selecting either card", async () => {
  await reachPracticeTwo();
  startVoiceAt(0);
  expect(screen.getByRole("complementary", { name: "語音說明區" })).toHaveClass("is-centered");
  expect(screen.queryByRole("region", { name: "試玩二" })).not.toBeInTheDocument();
  await finishCue("transition");
  startVoiceAt(3.7);
  expect(screen.getByRole("complementary", { name: "語音說明區" })).not.toHaveClass("is-centered");
  expect(screen.getByRole("region", { name: "試玩二" })).toBeInTheDocument();
  expect(plate("yellow-1")).toHaveClass("is-voice-highlighted");
  await finishCue("rule2");
  const guide = startVoiceAt(0.5);
  expect(plate("yellow-1")).toHaveClass("is-voice-highlighted");
  expect(plate("blue-2")).not.toHaveClass("is-voice-highlighted");
  moveVoiceTo(guide, 3.2);
  expect(plate("yellow-1")).not.toHaveClass("is-voice-highlighted");
  expect(plate("blue-2")).toHaveClass("is-voice-highlighted");
  expect(plate("blue-1")).not.toHaveClass("is-voice-highlighted");
  expect(plate("yellow-2")).not.toHaveClass("is-voice-highlighted");
  guide.currentTime = 1;
  fireEvent.seeked(guide);
  expect(plate("yellow-1")).toHaveClass("is-voice-highlighted");
  expect(plate("blue-2")).not.toHaveClass("is-voice-highlighted");
  expect(plate("yellow-1")).toHaveAttribute("aria-pressed", "false");
  moveVoiceTo(guide, 5.5);
  expect(plate("yellow-1")).not.toHaveClass("is-voice-highlighted");
  expect(plate("blue-2")).not.toHaveClass("is-voice-highlighted");
  await finishCue("guide2");
  await advance(120);
  expect(plate("yellow-1")).toHaveClass("is-voice-highlighted");
  await advance(650);
  await advance(550);
  expect(plate("yellow-1")).not.toHaveClass("is-voice-highlighted");
  expect(plate("blue-2")).toHaveClass("is-voice-highlighted");
});

test("voice failure removes the chicken and glow and late media events cannot restore them", async () => {
  start();
  await finishCue("intro");
  const audio = startVoiceAt(1.8);
  expect(plate("yellow-1")).toHaveClass("is-voice-highlighted");
  await act(async () => { fireEvent.error(audio); });
  expect(screen.queryByAltText("小雞正在說明")).not.toBeInTheDocument();
  expect(plate("yellow-1")).not.toHaveClass("is-voice-highlighted");
  fireEvent.playing(audio);
  moveVoiceTo(audio, 2);
  expect(screen.queryByAltText("小雞正在說明")).not.toBeInTheDocument();
  expect(plate("yellow-1")).not.toHaveClass("is-voice-highlighted");
});

test("formal rule speech lights the spoken card and removes both companion and highlight before assessed answers", async () => {
  await reachPracticeTwo();
  await finishIntroduction(2);
  select(LB_PRACTICE_STAGES.practiceMode2.sequence);
  submit();
  await finishReview(6);
  startVoiceAt(1.8);
  const one = screen.getByRole("button", { name: "1", exact: true });
  expect(one).toHaveClass("is-voice-highlighted");
  expect(one).toBeDisabled();
  expect(board()).not.toHaveClass("lb-formal-fullscreen");
  const firstPositions = formalPositions(10);
  expect(screen.getByAltText("小雞正在說明")).toBeInTheDocument();
  await finishFormalCue("rule1");
  expect(one).toBeEnabled();
  expect(board()).toHaveClass("lb-formal-fullscreen");
  expect(formalPositions(10)).toEqual(firstPositions);
  expect(one).not.toHaveClass("is-voice-highlighted");
  expect(screen.queryByAltText("小雞正在說明")).not.toBeInTheDocument();
  for (let number = 1; number <= 10; number += 1) {
    fireEvent.click(screen.getByRole("button", { name: String(number), exact: true }));
  }
  expect(formalPositions(10)).toEqual(firstPositions);
  submit();
  await advance(8000);
  const colorRule = startVoiceAt(3.7);
  expect(board()).not.toHaveClass("lb-formal-fullscreen");
  const secondPositions = formalPositions(20);
  expect(screen.getByRole("button", { name: "紅 1", exact: true })).toHaveClass("is-voice-highlighted");
  moveVoiceTo(colorRule, 5.4);
  expect(screen.getByRole("button", { name: "紅 1", exact: true })).not.toHaveClass("is-voice-highlighted");
  expect(screen.getByRole("button", { name: "藍色2", exact: true })).toHaveClass("is-voice-highlighted");
  await finishFormalCue("rule2");
  expect(board()).toHaveClass("lb-formal-fullscreen");
  expect(formalPositions(20)).toEqual(secondPositions);
  expect(screen.getByRole("button", { name: "藍色2", exact: true })).not.toHaveClass("is-voice-highlighted");
  expect(screen.queryByAltText("小雞正在說明")).not.toBeInTheDocument();
  await advance(10000);
  expect(screen.queryByAltText("小雞正在說明")).not.toBeInTheDocument();
  expect(formalPositions(20)).toEqual(secondPositions);
});

