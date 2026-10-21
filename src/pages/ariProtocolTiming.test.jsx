import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrainingARI from "./TrainingPage_ARI";
import TestARI from "./TestPage_ARI";
import { ARI_PRACTICE_AUDIO as cues } from "../utils/ariPracticeAudio";
import { saveUnifiedResult } from "../utils/resultManager";
import { useTestAttempt } from "../utils/useTestAttempt";

jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));

let audios;
let attempt;
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
const stage = () => screen.getByTestId("ari-training-stage");
const mouse = () => screen.queryByAltText("MOUSE 提示正確動物");
const result = () => saveUnifiedResult.mock.calls[0][0].rawResult;
const currentAnimalAudio = () => [...audios].reverse().find((audio) => /(?:cat|dog)\.mp3$/.test(audio.src));
const oppositeOfSound = () => currentAnimalAudio().src.includes("cat.mp3") ? "狗狗" : "貓咪";
const animal = (name) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("currentChild", JSON.stringify({ childId: "ari-child" }));
  audios = [];
  jest.spyOn(global, "Audio").mockImplementation((src) => {
    const audio = { src, play: jest.fn().mockResolvedValue(undefined), pause: jest.fn(), currentTime: 0,
      onplaying: null, onended: null, onerror: null };
    audios.push(audio);
    return audio;
  });
  attempt = { begin: jest.fn(), checkpoint: jest.fn(), interrupt: jest.fn(), complete: jest.fn((raw) => raw) };
  useTestAttempt.mockReturnValue(attempt);
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function renderPage(page, route) {
  render(<MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{page}</MemoryRouter>);
}
function start(difficulty) {
  renderPage(<TrainingARI />, `/training-ari?difficulty=${difficulty}`);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  advance(30000);
  expect(audios).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "下一步" }));
  advance(500);
  expect(stage()).toHaveAttribute("data-can-answer", "false");
}
function play() {
  act(() => currentAnimalAudio().onplaying?.());
  expect(stage()).toHaveAttribute("data-can-answer", "true");
}
function nextTrial() {
  advance(420);
  advance(260);
  advance(500);
  play();
}
function answer(correct = true) {
  advance(200);
  const expected = oppositeOfSound();
  fireEvent.click(animal(correct ? expected : expected === "貓咪" ? "狗狗" : "貓咪"));
}
function finishRemaining(startIndex) {
  for (let index = startIndex; index < 12; index += 1) {
    answer();
    if (index < 11) nextTrial();
    else advance(420);
  }
}

test.each([
  ["beginner", 10000, true, false], ["easy", 10000, true, false],
  ["medium", 5000, false, false], ["hard", 5000, false, true], ["expert", 3000, false, true],
])("%s enforces its exact time, replay, hint and interference settings", (difficulty, limit, replay, interference) => {
  start(difficulty);
  // No timeout or answer hint before the animal sound actually starts.
  advance(1000);
  expect(mouse()).toBeNull();
  play();
  expect(screen.getByRole("timer")).toHaveTextContent(`剩餘 ${limit / 1000} 秒`);
  expect(Boolean(screen.queryByRole("button", { name: "重播動物聲音" }))).toBe(replay);
  const noise = audios.filter((audio) => /voice\.mp3$/.test(audio.src));
  expect(noise).toHaveLength(interference ? 1 : 0);
  if (interference) expect(noise[0]).toMatchObject({ loop: true, volume: 0.25 });
  advance(limit - 1);
  expect(stage()).toHaveAttribute("data-can-answer", "true");
  if (difficulty !== "beginner") expect(mouse()).toBeNull();
  advance(1);
  expect(stage()).toHaveAttribute("data-can-answer", "false");
  if (interference) expect(noise[0].pause).toHaveBeenCalled();
  nextTrial();
  finishRemaining(1);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
  expect(result()).toMatchObject({ difficulty, completed: true, totalTrials: 12 });
  expect(result().records[0]).toMatchObject({ timeout: true, answerTimeLimit: limit, allowReplay: replay, interference });
  expect(result().promptCount).toBe(difficulty === "beginner" ? 1 : 0);
  expect(result().records.reduce((sum, row) => sum + row.promptCount, 0)).toBe(result().promptCount);
});

test("beginner points MOUSE at the opposite animal at exactly three seconds and records the actual appearance once", () => {
  start("beginner"); play();
  const expected = oppositeOfSound();
  advance(2999); expect(mouse()).toBeNull();
  advance(1); expect(mouse().closest("button")).toBe(animal(expected));
  advance(1000); answer();
  nextTrial(); finishRemaining(1);
  expect(result()).toMatchObject({ promptCount: 1, idleHintCount: 1, consecutiveErrorHintCount: 0 });
  expect(result().promptEvents[0]).toMatchObject({ trialIndex: 1, reason: "idle", target: expected === "貓咪" ? "cat" : "dog", elapsedMs: 3000 });
});

test("three consecutive errors prompt the next trial immediately; a correct response resets the streak", () => {
  start("beginner"); play();
  for (let index = 0; index < 3; index += 1) {
    expect(mouse()).toBeNull(); answer(false); nextTrial();
  }
  expect(mouse().closest("button")).toBe(animal(oppositeOfSound()));
  advance(3000); answer(); nextTrial();
  expect(mouse()).toBeNull();
  finishRemaining(4);
  expect(result()).toMatchObject({ promptCount: 1, idleHintCount: 0, consecutiveErrorHintCount: 1 });
  expect(result().promptEvents[0]).toMatchObject({ trialIndex: 4, reason: "consecutive_errors", elapsedMs: 0 });
});

test.each(["easy", "medium", "hard", "expert"])("%s gives no answer hint after three errors or slow answers", (difficulty) => {
  start(difficulty); play();
  for (let index = 0; index < 3; index += 1) { answer(false); nextTrial(); }
  expect(mouse()).toBeNull();
  advance(difficulty === "expert" ? 2999 : 3000);
  expect(mouse()).toBeNull();
});

test.each(["beginner", "easy"])("%s replays through voice.webp without restarting the deadline or reminder timer", (difficulty) => {
  start(difficulty); play();
  advance(2000);
  const replayButton = screen.getByRole("button", { name: "重播動物聲音" });
  expect(replayButton.querySelector("img")).toHaveAttribute("src", "voice.webp");
  fireEvent.click(replayButton);
  const replay = currentAnimalAudio();
  act(() => replay.onplaying?.());
  advance(999); expect(mouse()).toBeNull();
  advance(1); expect(Boolean(mouse())).toBe(difficulty === "beginner");
  advance(6999); expect(stage()).toHaveAttribute("data-can-answer", "true");
  advance(1); expect(stage()).toHaveAttribute("data-can-answer", "false");
  expect(replay.pause).toHaveBeenCalled();
  nextTrial(); finishRemaining(1);
  expect(result().replayCount).toBe(1);
  expect(result().records[0].replayEvents[0]).toMatchObject({ elapsedMs: 2000, reason: "replay" });
});

test("failed sound never reveals the answer; restricted levels end as an interrupted technical attempt", () => {
  start("hard");
  act(() => currentAnimalAudio().onerror());
  expect(mouse()).toBeNull();
  expect(screen.queryByRole("button", { name: "重播動物聲音" })).toBeNull();
  expect(stage()).toHaveAttribute("data-can-answer", "false");
  fireEvent.click(screen.getByRole("button", { name: "結束本次訓練" }));
  expect(result()).toMatchObject({ completed: false, status: "interrupted", finishReason: "audio_error", promptCount: 0 });
  expect(result().technicalEvents).toHaveLength(1);
});

test("leaving training cancels animal/replay/noise sounds and later timers", () => {
  start("expert"); play();
  const noise = audios.find((audio) => /voice\.mp3$/.test(audio.src));
  cleanup();
  expect(noise.pause).toHaveBeenCalled();
  advance(20000);
  expect(saveUnifiedResult).not.toHaveBeenCalled();
});

async function startAssessment() {
  renderPage(<TestARI />, "/test-ari");
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "下一步" }));
  for (const cue of [cues.intro, cues.dogRule, cues.catRule]) {
    expect(audios.at(-1).src).toBe(cue);
    await act(async () => audios.at(-1).onended());
  }
  for (let index = 0; index < 2; index += 1) {
    await act(async () => audios.at(-1).onended()); // Question prompt.
    await act(async () => audios.at(-1).onended()); // Animal stimulus.
    await act(async () => audios.at(-1).onended()); // Answer prompt.
    fireEvent.click(animal(oppositeOfSound()));
    await act(async () => jest.advanceTimersByTime(1000));
    expect(audios.at(-1).src).toBe(cues.correct);
    await act(async () => audios.at(-1).onended()); // Correct answer feedback.
  }
  await act(async () => audios.at(-1).onended()); // Completion prompt.
  fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(audios.at(-1).src).toBe(cues.assessmentStart);
  await act(async () => audios.at(-1).onended()); // Reminder before timing starts.
  expect(attempt.begin).toHaveBeenCalledTimes(1);
  advance(500);
}

test("assessment retains twenty trials and five seconds, without replay, hints or interference", async () => {
  await startAssessment();
  for (let index = 0; index < 20; index += 1) {
    act(() => currentAnimalAudio().onplaying());
    expect(screen.queryByRole("button", { name: /重播|重新播放/ })).toBeNull();
    expect(mouse()).toBeNull();
    expect(audios.filter((audio) => /voice\.mp3$/.test(audio.src))).toHaveLength(0);
    advance(4999);
    expect(screen.getByTestId("ari-assessment-stage")).toHaveAttribute("data-can-answer", "true");
    advance(1);
    advance(420);
    if (index < 19) { advance(260); advance(500); }
  }
  expect(attempt.complete).toHaveBeenCalledTimes(1);
  expect(attempt.complete.mock.calls[0][0]).toMatchObject({ totalTrials: 20, replayCount: 0, promptCount: 0, protocol: { answerTimeLimit: 5000, allowReplay: false } });
  expect(audios.at(-1).src).toBe(cues.assessmentComplete);
  expect(screen.getByRole("region", { name: "測驗結果" })).toBeInTheDocument();
  const narrator = screen.getByTestId("ari-narrator");
  expect(narrator.closest(".ari-result-with-narrator")).toBeInTheDocument();
  expect(narrator.querySelector(".ari-narrator-open")).toHaveAttribute("src", "chicken.webp");
  expect(narrator.querySelector(".ari-narrator-closed")).toHaveAttribute("src", "chicken01.webp");
  act(() => audios.at(-1).onplaying());
  expect(narrator).toHaveAttribute("data-speaking", "true");
  const failedCompletion = audios.at(-1);
  await act(async () => failedCompletion.onerror());
  expect(narrator).toHaveAttribute("data-speaking", "false");
  expect(failedCompletion.pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "重新播放完成語音" }));
  expect(audios.at(-1).src).toBe(cues.assessmentComplete);
  act(() => audios.at(-1).onplaying());
  expect(narrator).toHaveAttribute("data-speaking", "true");
  await act(async () => audios.at(-1).onended());
  expect(narrator).toHaveAttribute("data-speaking", "false");
  expect(attempt.complete).toHaveBeenCalledTimes(1);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test("assessment audio errors interrupt the attempt and never offer a replay", async () => {
  await startAssessment();
  act(() => currentAnimalAudio().onerror());
  expect(attempt.interrupt).toHaveBeenCalledWith("audio_playback_failed");
  expect(screen.queryByRole("button", { name: /重播|重新播放/ })).toBeNull();
  expect(screen.getByRole("button", { name: "返回測驗地圖" })).toBeInTheDocument();
  expect(screen.getByTestId("ari-assessment-stage")).toHaveAttribute("data-can-answer", "false");
});
