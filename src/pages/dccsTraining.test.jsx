/* DOM queries check that the mouse appears inside the correct answer box. */
/* eslint-disable testing-library/no-node-access */
import React, { act, StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrainingPage, { DCCS_TRAINING_LEVELS } from "./TrainingPage_DCCS";
import { DCCS_DIFFICULTY_ORDER, getDccsTrainingCorrectPosition } from "../utils/dccsTrainingProtocol";
import { saveUnifiedResult } from "../utils/resultManager";
import { getDccsClinicalMetrics } from "../utils/dccsClinicalMetrics";
import { DCCS_TRAINING_AUDIO } from "../utils/dccsTrainingAudio";

jest.mock("../utils/resultManager", () => ({ createResultId: jest.fn(() => "dccs-training-attempt"), saveUnifiedResult: jest.fn() }));
jest.mock("../utils/useTrainingAchievementAssignment", () => ({ useTrainingAchievementAssignment: jest.fn(() => null) }));
const advance = (ms) => act(() => { jest.advanceTimersByTime(ms); });
const board = () => screen.getByTestId("dccs-training");
const sideButton = (side) => screen.getByRole("button", { name: side === "top" ? "左側分類箱" : "右側分類箱" });
const mouse = () => screen.queryByTestId("dccs-training-mouse");
const result = () => saveUnifiedResult.mock.calls.at(-1)[0].rawResult;
let audios;
let utterances;
const narrator = () => screen.getByTestId("dccs-training-narrator");
function finishNarration() {
  act(() => {
    let pending;
    let guard = 0;
    while ((pending = [...audios, ...utterances].find((clip) => clip.onended || clip.onend)) && guard++ < 10) {
      (pending.onended || pending.onend)();
    }
  });
}

beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-21T00:00:00Z"));
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  audios = []; utterances = [];
  jest.spyOn(global, "Audio").mockImplementation((src) => {
    const audio = { src, duration: 5, play: jest.fn().mockResolvedValue(), pause: jest.fn() };
    audios.push(audio); return audio;
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true,
    value: jest.fn().mockImplementation((text) => ({ text })) });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    getVoices: () => [{ lang: "zh-TW" }], cancel: jest.fn(),
    speak: jest.fn((utterance) => utterances.push(utterance)),
  } });
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => window.clearTimeout(id));
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function openRule(difficulty, strict = false, state = {}) {
  const page = <MemoryRouter initialEntries={[{ pathname: "/training-dccs", search: `?difficulty=${difficulty}`, state }]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TrainingPage /></MemoryRouter>;
  const view = render(strict ? <StrictMode>{page}</StrictMode> : page);
  fireEvent.click(screen.getByRole("button", { name: "開始遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過" }));
  return view;
}
function start(difficulty, strict = false, state = {}) {
  const view = openRule(difficulty, strict, state);
  // The complete narration starts the trial without another click.
  advance(5000);
  expect(screen.queryByTestId("dccs-training")).toBeNull();
  finishNarration();
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
  if (screen.queryByTestId("dccs-training-rule")) finishNarration();
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
  for (const trial of config.trials) {
    expect(trial.topTarget).toMatchObject({ colorKey: "blue", typeKey: "tshirt" });
    expect(trial.bottomTarget).toMatchObject({ colorKey: "red", typeKey: "hat" });
    const expectedSide = trial.matchBy === "color"
      ? (trial.card.color === "blue" ? "top" : "bottom")
      : (trial.card.type === "tshirt" ? "top" : "bottom");
    expect(getDccsTrainingCorrectPosition(trial)).toBe(expectedSide);
    expect(getDccsTrainingCorrectPosition(trial, true)).not.toBe(expectedSide);
  }
  start(difficulty, true);
  expect(board()).toHaveAttribute("data-difficulty", difficulty);
  expect(board().querySelector(".Dcss-basket-choice-label, .Dcss-target-clothing")).toBeNull();
  expect(sideButton("top").querySelectorAll("img")).toHaveLength(1);
  expect(sideButton("bottom").querySelectorAll("img")).toHaveLength(1);
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

test.each(["correct", "wrong", "timeout"])("wind ends with one %s response and never carries into the next question", (response) => {
  start("expert"); advance(6480);
  expect(screen.getByTestId("dccs-training-wind")).toBeInTheDocument();
  const first = currentTrial("expert");
  const reversed = getDccsTrainingCorrectPosition(first, true);
  expect(reversed).not.toBe(getDccsTrainingCorrectPosition(first));
  if (response === "timeout") advance(3520);
  else {
    fireEvent.click(sideButton(response === "correct" ? reversed : getDccsTrainingCorrectPosition(first)));
    fireEvent.click(sideButton(reversed)); // A locked second click cannot extend the wind.
  }
  expect(screen.queryByTestId("dccs-training-wind")).toBeNull();
  expect(board()).toHaveAttribute("data-wind-active", "false");
  settle();
  expect(board()).toHaveAttribute("data-trial", "2");
  expect(screen.queryByTestId("dccs-training-wind")).toBeNull();
  correctAnswer("expert"); settle(); complete("expert");
  expect(result().trialLogs[0]).toMatchObject({ isReverseRule: true, correctSide: reversed,
    isCorrect: response === "correct", isTimeout: response === "timeout" });
  expect(result().trialLogs[1]).toMatchObject({ isReverseRule: false, isCorrect: true });
  expect(result().reverseRuleTrials).toBe(1);
  expect(result().windEvents).toMatchObject([
    { active: true, trialNumber: 1 },
    { active: false, trialNumber: 1, reason: response === "timeout" ? "trial_timeout" : "trial_answer" },
  ]);
  expect(result().protocol).toMatchObject({ windEndPolicy: "trial_end", windDurationMs: null });
  expect(result().promptCount).toBe(0);
});

test("each new wind waits a full calm interval after the previous affected question", () => {
  start("expert"); advance(6480); correctAnswer("expert");
  expect(screen.queryByTestId("dccs-training-wind")).toBeNull();
  advance(850);
  expect(board()).toHaveAttribute("data-trial", "2");
  advance(5999); expect(screen.queryByTestId("dccs-training-wind")).toBeNull();
  advance(1); expect(screen.getByTestId("dccs-training-wind")).toBeInTheDocument();
  correctAnswer("expert");
  expect(screen.queryByTestId("dccs-training-wind")).toBeNull();
  settle(); complete("expert");
  expect(result().windEvents.map((event) => [event.active, event.trialNumber])).toEqual([
    [true, 1], [false, 1], [true, 2], [false, 2],
  ]);
  expect(result().reverseRuleTrials).toBe(2);
});

test("feedback pauses a pending wind and active wind lasts until its question ends", () => {
  start("expert"); advance(5979);
  expect(screen.queryByTestId("dccs-training-wind")).toBeNull();
  correctAnswer("expert");
  advance(849); expect(screen.queryByTestId("dccs-training-wind")).toBeNull();
  advance(1); expect(board()).toHaveAttribute("data-trial", "2");
  advance(1); expect(screen.getByTestId("dccs-training-wind")).toBeInTheDocument();
  advance(7000); expect(screen.getByTestId("dccs-training-wind")).toBeInTheDocument();
  correctAnswer("expert");
  expect(screen.queryByTestId("dccs-training-wind")).toBeNull();
  settle(); complete("expert");
  expect(result().windEvents.map((event) => [event.active, event.trialNumber])).toEqual([[true, 2], [false, 2]]);
  expect(result().trialLogs[1]).toMatchObject({ isReverseRule: true, isCorrect: true });
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

test("rule narration has no text, follows actual playback, and gates the full answer deadline", () => {
  openRule("beginner");
  const rule = screen.getByTestId("dccs-training-rule");
  expect(rule.textContent).toBe("");
  expect(narrator().querySelector(".dccs-training-narrator-open")).toHaveAttribute("src", "chicken.webp");
  expect(narrator().querySelector(".dccs-training-narrator-closed")).toHaveAttribute("src", "chicken01.webp");
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  const audio = audios.at(-1);
  expect(audio.src).toBe(DCCS_TRAINING_AUDIO.color[0].src);
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  act(() => audio.onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  act(() => audio.onwaiting());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  act(() => audio.onplaying());
  act(() => audio.onpause());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  advance(5000);
  expect(screen.queryByTestId("dccs-training")).toBeNull();
  expect(mouse()).toBeNull();
  finishNarration();
  advance(20);
  expect(board().textContent).toBe("");
  advance(14980); expect(sideButton("top")).toBeEnabled();
  advance(20); expect(sideButton("top")).toBeDisabled();
});

test.each(["medium", "hard", "expert"])("%s plays the matching bag instructions before starting the final block", (difficulty) => {
  const config = DCCS_TRAINING_LEVELS[difficulty];
  start(difficulty);
  for (let i = 0; i < config.firstSwitchPoint; i++) { correctAnswer(difficulty); advance(850); advance(20); }
  expect(screen.getByTestId("dccs-training-rule")).toHaveAttribute("data-rule", "type");
  expect(screen.getByTestId("dccs-training-rule").textContent).toBe("");
  expect(audios.at(-1).src).toBe(DCCS_TRAINING_AUDIO.type[0].src);
  act(() => audios.at(-1).onended());
  expect(audios.at(-1).src).toBe(DCCS_TRAINING_AUDIO.type[1].src);
  expect(screen.queryByTestId("dccs-training")).toBeNull();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  finishNarration();
  advance(20);
  for (let i = config.firstSwitchPoint; i < config.secondSwitchPoint; i++) { correctAnswer(difficulty); advance(850); advance(20); }
  const spokenBeforeBag = utterances.length;
  expect(screen.getByTestId("dccs-training-rule")).toHaveAttribute("data-rule", "bagColor");
  expect(screen.getByTestId("dccs-training-rule").textContent).toBe("");
  act(() => audios.at(-1).onended());
  expect(audios.at(-1).src).toBe(DCCS_TRAINING_AUDIO.bagColor[1].src);
  expect(screen.queryByTestId("dccs-training")).toBeNull();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  act(() => audios.at(-1).onended());
  expect(utterances).toHaveLength(spokenBeforeBag);
  expect(utterances.some((utterance) => utterance.text.includes("沒有透明袋子時"))).toBe(false);
  expect(screen.queryByTestId("dccs-training-rule")).toBeNull();
  advance(20);
  expect(board()).toHaveAttribute("data-trial", String(config.secondSwitchPoint + 1));
  for (let index = config.secondSwitchPoint; index < config.totalTrials; index++) {
    expect(board()).toHaveAttribute("data-trial", String(index + 1));
    expect(board()).toHaveAttribute("data-rule", "bagColor");
    expect(screen.getByRole("img", { name: /^裝袋的/ })).toHaveAttribute("src", config.trials[index].card.bagImg);
    correctAnswer(difficulty); settle();
  }
  const finalBlockLength = config.totalTrials - config.secondSwitchPoint;
  const finalLogs = result().trialLogs.slice(config.secondSwitchPoint);
  expect(finalLogs).toHaveLength(finalBlockLength);
  expect(finalLogs.every((trial) => trial.isBagged && trial.matchBy === "color" && trial.isBagColorTrial)).toBe(true);
  expect(result().bagColorTrials).toBe(finalBlockLength);
  expect(result().dualRuleTrials).toBe(0);
  complete(difficulty);
});

test("a failed recording requires icon retry and stale playback cannot unlock a replay", async () => {
  openRule("beginner");
  const first = audios.at(-1);
  const staleEnded = first.onended;
  const stalePlaying = first.onplaying;
  act(() => first.onerror());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  expect(screen.queryByTestId("dccs-training")).toBeNull();
  expect(screen.getByTestId("dccs-training-rule").textContent).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "重試規則語音" }));
  act(() => { stalePlaying(); staleEnded(); });
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  expect(screen.queryByTestId("dccs-training")).toBeNull();
  act(() => audios.at(-1).onerror());
  global.Audio.mockImplementationOnce(() => ({ pause: jest.fn(), play: () => Promise.reject(new Error("autoplay")) }));
  fireEvent.click(screen.getByRole("button", { name: "重試規則語音" }));
  await act(async () => { await Promise.resolve(); });
  expect(screen.queryByTestId("dccs-training")).toBeNull();
  expect(screen.getByRole("button", { name: "重試規則語音" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "重試規則語音" }));
  finishNarration(); advance(20);
  expect(board()).toHaveAttribute("data-trial", "1");
});

test("wind announcements use the chicken, replace pending speech, and do not restart the answer clock", () => {
  start("expert");
  expect(utterances[0].text).toContain("風吹來的時候");
  advance(6480);
  const reverse = utterances.at(-1);
  expect(reverse.text).toBe("風來了，選另一個籃子。");
  act(() => reverse.onstart());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  const staleEnd = reverse.onend;
  // The existing ten-second deadline keeps running during the announcement.
  advance(3500); expect(sideButton("top")).toBeEnabled();
  advance(20); expect(sideButton("top")).toBeDisabled();
  advance(2000);
  expect(utterances.at(-1).text).toBe("風停了，照原本的規則分類。");
  expect(reverse.onend).toBeNull();
  act(() => staleEnd());
  expect(narrator()).toHaveAttribute("data-cue", "windRestore");
  expect(board().textContent).toBe("");
});

test("unmount during a synthesized rule cancels speech and every late callback", () => {
  const view = openRule("expert", true);
  act(() => audios.at(-1).onended());
  const utterance = utterances.at(-1);
  const staleEnd = utterance.onend;
  view.unmount();
  expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  expect(utterance.onend).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
  act(() => staleEnd());
  expect(saveUnifiedResult).not.toHaveBeenCalled();
});

test("finishing the narrated game still shows the result and supports replay", () => {
  start("beginner"); complete("beginner");
  fireEvent.click(screen.getByRole("button", { name: "跳過說明" }));
  expect(screen.getByRole("region", { name: "練習結果" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "再玩一次" }));
  fireEvent.click(screen.getByRole("button", { name: "開始遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過" }));
  expect(screen.queryByTestId("dccs-training")).toBeNull();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(narrator()).toHaveAttribute("data-cue", "color");
});
