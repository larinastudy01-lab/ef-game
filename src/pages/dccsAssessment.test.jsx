/* DOM class assertions verify that formal assessments have no correctness cues. */
/* eslint-disable testing-library/no-node-access */
import React, { act, StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestPageDccs, { buildDccsTrialSets } from "./TestPage_DCCS";
import { useTestAttempt } from "../utils/useTestAttempt";
import { saveUnifiedResult } from "../utils/resultManager";
import { calculateDccsScore } from "../utils/dccsScoring";
import { buildDccsPracticeTrials, getDccsCorrectPosition } from "../utils/dccsAssessmentProtocol";
import { DCCS_ASSESSMENT_AUDIO } from "../utils/dccsAssessmentAudio";
import { DCCS_RULES, DCCS_BOX_REFERENCES } from "../config/dccsAssessmentConfig";

jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));
jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
let audios;
let attempt;
let monotonic;
const board = () => screen.getByTestId("dccs-assessment");
const phase = (name) => expect(board()).toHaveAttribute("data-phase", name);
const currentAudio = () => audios.at(-1);
const advance = (ms) => act(() => { jest.advanceTimersByTime(ms); });
const boxes = () => [screen.getByRole("button", { name: "左側分類箱" }), screen.getByRole("button", { name: "右側分類箱" })];
const latest = () => attempt.checkpoint.mock.calls.at(-1)[0];
const endVoice = () => act(() => currentAudio().onended?.());
function expectCleanBoard() {
  expect(board()).not.toHaveTextContent(/大人協助|先試試看|看看衣服的?顏色|現在規則不一樣|這次要看衣服的種類|新規則|這次要仔細看看透明袋子|準備好開始挑戰/);
  expect(board().querySelector("header, h1, .dccs-narrator-bubble, .dccs-voice, .dccs-adult-entry, .dccs-passed-message")).toBeNull();
  expect(board().querySelector('img[src="voice.webp"]')).toBeNull();
}
const bank = buildDccsTrialSets();
const formal = [bank.colorTestTrials, bank.typeTestTrials, bank.bagColorTestTrials];
const practice = formal.map((trials, index) => buildDccsPracticeTrials(trials, DCCS_RULES[index].id));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear(); sessionStorage.clear();
  monotonic = 1000;
  jest.spyOn(performance, "now").mockImplementation(() => monotonic);
  jest.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  jest.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(330);
  audios = [];
  jest.spyOn(global, "Audio").mockImplementation((src) => {
    const audio = { src, duration: 2, pause: jest.fn(), play: jest.fn().mockResolvedValue(), onended: null, onplaying: null };
    audios.push(audio); return audio;
  });
  attempt = {
    begin: jest.fn(() => ({ resultId: "dccs-attempt", behavioral: { sessionId: "research-session" } })),
    checkpoint: jest.fn(), complete: jest.fn((raw) => raw), interrupt: jest.fn(),
  };
  useTestAttempt.mockReturnValue(attempt);
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function start(entry = "ended", strict = false) {
  const page = <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TestPageDccs /></MemoryRouter>;
  const view = render(strict ? <StrictMode>{page}</StrictMode> : page);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  if (entry === "ended") fireEvent.ended(document.querySelector("video"));
  else fireEvent.click(screen.getByRole("button", { name: entry }));
  phase("practice_intro");
  return view;
}
function ready() { advance(350); expect(boxes()[0]).toBeEnabled(); }
function answer(trial, correct = true) {
  const side = getDccsCorrectPosition(trial) === "top" ? 0 : 1;
  monotonic += 735;
  fireEvent.click(boxes()[correct ? side : 1 - side]);
}
function settlePractice() { advance(450); endVoice(); advance(1000); }
function expectCorrectHand(trial) {
  expect(screen.getAllByTestId("dccs-practice-hand")).toHaveLength(1);
  const correctBox = boxes()[getDccsCorrectPosition(trial) === "top" ? 0 : 1];
  expect(screen.getByTestId("dccs-practice-hand").closest("button")).toBe(correctBox);
}
function passPractice(index) {
  endVoice(); phase("practice_question"); ready();
  expectCorrectHand(practice[index][0]);
  answer(practice[index][0]); settlePractice();
  phase("practice_question"); ready();
  expectCorrectHand(practice[index][1]);
  answer(practice[index][1]); settlePractice();
  phase("practice_passed");
  expect(screen.queryAllByTestId("dccs-practice-hand")).toHaveLength(0);
  endVoice(); advance(1200); phase("formal_intro");
  expect(screen.queryAllByTestId("dccs-practice-hand")).toHaveLength(0);
  expect(currentAudio().src).toBe(DCCS_ASSESSMENT_AUDIO[DCCS_RULES[index].id].formal);
  endVoice(); phase("formal_question");
}

test.each(["ended", "跳過", "下一步"])("STEP %s enters rule-one practice with existing assets", (entry) => {
  start(entry);
  expect(board()).toHaveAttribute("data-mode", "practice");
  expect(board()).toHaveAttribute("data-rule", "color");
  expect(screen.getByRole("img", { name: "小雞旁白" })).toBeInTheDocument();
  expect(board().querySelector('img[src="chicken.webp"]')).toBeInTheDocument();
  expect(board().querySelector('img[src="chicken01.webp"]')).toBeInTheDocument();
  expect(board().querySelector('img[src="mouse.webp"]')).toBeNull();
  expectCleanBoard();
  expect(latest().trials).toEqual([]);
  expect(currentAudio().src).toBe(DCCS_ASSESSMENT_AUDIO.color.intro);
  expect(boxes()[0]).toBeDisabled();
});

test("all three independent practice gates lead through the unchanged formal banks and complete once", () => {
  start("ended", true);
  for (let ruleIndex = 0; ruleIndex < 3; ruleIndex += 1) {
    expect(board()).toHaveAttribute("data-rule", DCCS_RULES[ruleIndex].id);
    expectCleanBoard();
    passPractice(ruleIndex);
    expectCleanBoard();
    expect(boxes().map((box) => box.getAttribute("data-position"))).toEqual(["left", "right"]);
    boxes().forEach((box) => {
      expect(box.querySelector(".dccs-box-reference img").getAttribute("src"))
        .toBe(box.querySelector("img[data-stimulus-asset]").getAttribute("src"));
    });
    expect(screen.queryByRole("button", { name: "重播目前說明" })).toBeNull();
    for (let index = 0; index < formal[ruleIndex].length; index += 1) {
      ready();
      expect(screen.queryAllByTestId("dccs-practice-hand")).toHaveLength(0);
      answer(formal[ruleIndex][index], index % 2 === 0);
      phase("formal_transition");
      expect(board().querySelector(".dccs-soft-stars, .dccs-practice-progress, .dccs-narrator, .dccs-practice-hand")).toBeNull();
      expect(board().innerHTML).not.toMatch(/is-happy|is-encourage|class="[^"]*(correct|wrong)/);
      advance(600);
    }
    if (ruleIndex < 2) phase("practice_intro");
  }
  expect(screen.getByRole("button", { name: "詳細結果" })).toBeInTheDocument();
  expect(attempt.complete).toHaveBeenCalledTimes(1);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
  const result = attempt.complete.mock.calls[0][0];
  expect(result.trials).toHaveLength(formal.flat().length);
  expect(result.trials.map((trial) => trial.stimulus_id)).toEqual(formal.flat().map((trial) => trial.card.id));
  expect(result.trials.every((trial) => trial.mode === "formal" && trial.session_id === "research-session")).toBe(true);
  expect(result.practiceLogs).toHaveLength(6);
  expect(result.practiceSummary.map((entry) => entry.passed)).toEqual([true, true, true]);
  expect(result.trials.every((trial) => trial.reaction_time_ms === 735)).toBe(true);
  expect(result.trials[5]).toEqual(expect.objectContaining({
    stimulus_id: "red_hat", is_correct: false, selected_target: "left",
    error_type: "wrong_target", error_type_basis: "displayed_box_references",
    previous_rule_target: "right",
  }));
  const expected = calculateDccsScore({ gameId: "DCCS", mode: "test", difficulty: "normal", totalTrials: result.totalTrials,
    correctCount: result.correctCount, trialLogs: result.trials.map((trial) => trial.phase === "bag_color_test" ? { ...trial, phase: "color_test", originalPhase: trial.phase } : trial) });
  expect(result.score).toBe(expected.totalScore);
  fireEvent.click(screen.getByRole("button", { name: "詳細結果" }));
  expect(attempt.complete).toHaveBeenCalledTimes(1);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
});

test("the practice hand guides only the correct box and disappears as soon as an answer locks", () => {
  start();
  expect(screen.queryAllByTestId("dccs-practice-hand")).toHaveLength(0);
  endVoice(); phase("practice_question");
  expect(screen.queryAllByTestId("dccs-practice-hand")).toHaveLength(0);
  ready();
  expectCorrectHand(practice[0][0]);
  const hand = screen.getByTestId("dccs-practice-hand");
  expect(hand).toHaveAttribute("src", "mouse.webp");
  expect(hand).toHaveAttribute("aria-hidden", "true");
  answer(practice[0][0], false);
  fireEvent.click(boxes()[0]); fireEvent.click(boxes()[1]);
  phase("practice_feedback");
  expect(screen.queryAllByTestId("dccs-practice-hand")).toHaveLength(0);
  expect(latest().practiceLogs).toHaveLength(1);
  expect(latest().practiceLogs[0].is_correct).toBe(false);
  expect(latest().trials).toEqual([]);
  settlePractice(); phase("practice_question");
  expect(screen.queryAllByTestId("dccs-practice-hand")).toHaveLength(0);
  ready();
  expectCorrectHand(practice[0][1]);
});

test("a wrong practice response resets the streak, retains practice-only logs and reveals no answer", () => {
  start(); endVoice(); ready(); answer(practice[0][0]); settlePractice();
  ready(); answer(practice[0][1], false);
  expect(latest().practiceLogs.map((log) => log.consecutive_correct_after_trial)).toEqual([1, 0]);
  expect(latest().trials).toEqual([]);
  advance(450);
  expect(board().querySelector(".dccs-narrator")).toHaveAttribute("data-state", "encourage");
  expect(board().querySelector(".dccs-soft-stars")).toBeNull();
  endVoice(); advance(1000); phase("practice_question");
  ready(); answer(practice[0][2 % practice[0].length]); settlePractice();
  phase("practice_question"); ready(); answer(practice[0][3 % practice[0].length]); settlePractice();
  phase("practice_passed");
  expect(latest().practiceLogs.map((log) => log.practice_passed)).toEqual([false, false, false, true]);
});

test("failed-audio retries cancel old callbacks, never overlap and count separately from formal trials", () => {
  start(); const first = currentAudio(); const staleEnded = first.onended;
  act(() => currentAudio().onerror());
  for (let index = 0; index < 3; index += 1) {
    fireEvent.click(screen.getByRole("button", { name: "重試語音" }));
    if (index < 2) act(() => currentAudio().onerror());
  }
  expect(audios.filter((audio) => audio.onended)).toHaveLength(1);
  expect(first.pause).toHaveBeenCalled();
  act(() => staleEnded()); phase("practice_intro");
  act(() => currentAudio().onplaying());
  expect(screen.getByTestId("dccs-narrator").closest(".dccs-narrator")).toHaveAttribute("data-speaking", "true");
  const playedCount = audios.length;
  endVoice(); ready();
  expect(audios).toHaveLength(playedCount); // entering a question does not replay a past scene
  answer(practice[0][0]);
  expect(latest().practiceLogs[0].voice_replay_count).toBe(3);
});

test("chicken mouth follows playback and enlarges when the central stimulus is absent", () => {
  start();
  const narrator = () => screen.getByTestId("dccs-narrator").closest(".dccs-narrator");
  expect(narrator()).toHaveAttribute("data-layout", "fixed");
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  act(() => currentAudio().onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  expect(narrator().querySelector(".dccs-narrator-open")).toHaveAttribute("src", "chicken.webp");
  expect(narrator().querySelector(".dccs-narrator-closed")).toHaveAttribute("src", "chicken01.webp");
  act(() => currentAudio().onwaiting());
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  act(() => currentAudio().onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  endVoice(); ready();
  expect(narrator()).toHaveAttribute("data-speaking", "false");
  answer(practice[0][0]);
  expect(narrator()).toHaveAttribute("data-layout", "fixed");
  advance(450);
  expect(narrator()).toHaveAttribute("data-layout", "above-boxes");
  expect(screen.getByTestId("dccs-stimulus").closest(".dccs-stimulus-stage")).toHaveClass("is-hidden");
  endVoice(); advance(1000);
  expect(narrator()).toHaveAttribute("data-layout", "fixed");
  ready(); answer(practice[0][1]); settlePractice(); phase("practice_passed");
  expectCleanBoard();
  expect(narrator()).toHaveAttribute("data-layout", "center");
  expect(screen.queryByTestId("dccs-stimulus")).toBeNull();
  expect(screen.queryByRole("button", { name: "左側分類箱" })).toBeNull();
  expect(screen.queryByRole("button", { name: "右側分類箱" })).toBeNull();
  act(() => currentAudio().onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  endVoice(); advance(1200); phase("formal_intro");
  expect(narrator()).toHaveAttribute("data-layout", "above-boxes");
  act(() => currentAudio().onplaying());
  expect(narrator()).toHaveAttribute("data-speaking", "true");
  endVoice(); phase("formal_question"); ready();
  expect(screen.queryByTestId("dccs-narrator")).toBeNull();
});

test("first-click locking and monotonic RT exclude entry, reveal and deposit, even if the wall clock changes", () => {
  start(); passPractice(0);
  fireEvent.click(boxes()[0]); expect(latest().trials).toEqual([]);
  ready(); monotonic = 2500;
  jest.setSystemTime(new Date("2001-01-01"));
  act(() => { boxes()[0].click(); boxes()[1].click(); boxes()[0].click(); });
  const logs = latest().trials;
  expect(logs).toHaveLength(1);
  expect(logs[0].reaction_time_ms).toBe(30); // ready started at 2470 after two practice responses
  monotonic += 10000; advance(600);
  expect(logs).toHaveLength(1);
  expect(logs[0].reaction_time_ms).toBe(30);
  expect(logs[0]).toEqual(expect.objectContaining({ trial_index: 1, task: "DCCS", rule_type: "color", session_id: "research-session" }));
});

test("missing stimulus pixels keep responses locked until images are actually loaded", () => {
  jest.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
  start(); endVoice(); advance(5000); expect(boxes()[0]).toBeDisabled();
  expect(screen.queryAllByTestId("dccs-practice-hand")).toHaveLength(0);
  jest.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(330);
  fireEvent.load(screen.getByTestId("dccs-stimulus")); ready();
});

test("audio failure supports replay and an explicit recorded text fallback", () => {
  start(); act(() => currentAudio().onerror());
  phase("practice_intro");
  expect(screen.getByRole("button", { name: "開始試玩" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "開始試玩" }));
  phase("practice_question"); ready();
  expect(latest().audioEvents.some((entry) => entry.event === "manual_audio_fallback")).toBe(true);
});

test("unmount cancels pending transitions and stale voice callbacks", () => {
  const view = start(); const stale = currentAudio().onended;
  view.unmount(); act(() => stale()); advance(60000);
  expect(attempt.complete).not.toHaveBeenCalled();
  expect(audios.every((audio) => !audio.onended)).toBe(true);
});

test("a hidden/restored page cannot advance or resubmit its completed formal response", () => {
  start(); passPractice(0); ready(); answer(formal[0][0]);
  const saved = latest().trials[0];
  act(() => window.dispatchEvent(new Event("pagehide")));
  advance(60000);
  expect(screen.getByRole("button", { name: "進入遊戲" })).toBeInTheDocument();
  expect(attempt.complete).not.toHaveBeenCalled();
  const restore = new Event("pageshow");
  Object.defineProperty(restore, "persisted", { value: true });
  act(() => window.dispatchEvent(restore));
  expect(attempt.interrupt).toHaveBeenCalledWith("page_restored");
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.ended(document.querySelector("video"));
  expect(latest().trials).toEqual([]);
  expect(saved.trial_index).toBe(1);
});

test("a failed formal introduction requires acknowledgment and grants no replay during formal questions", () => {
  start(); endVoice(); ready(); answer(practice[0][0]); settlePractice();
  ready(); answer(practice[0][1]); settlePractice();
  endVoice(); advance(1200); phase("formal_intro");
  act(() => currentAudio().onerror()); phase("formal_intro");
  advance(60000); phase("formal_intro");
  fireEvent.click(screen.getByRole("button", { name: "重試語音" }));
  expect(currentAudio().src).toBe(DCCS_ASSESSMENT_AUDIO.color.formal);
  endVoice(); phase("formal_question"); ready();
  expect(screen.queryByRole("button", { name: "重播目前說明" })).toBeNull();
});

test("classification follows metadata when targets exchange positions; practice construction leaves formal data exact", () => {
  const before = JSON.stringify(bank);
  for (let index = 0; index < 3; index += 1) {
    const trials = buildDccsPracticeTrials(formal[index], DCCS_RULES[index].id);
    expect(new Set(trials.map(getDccsCorrectPosition))).toEqual(new Set(["top", "bottom"]));
    for (const trial of trials) {
      expect(getDccsCorrectPosition({ ...trial, topTarget: trial.bottomTarget, bottomTarget: trial.topTarget }))
        .not.toBe(getDccsCorrectPosition(trial));
    }
  }
  expect(practice[1].every((trial) => {
    const correct = getDccsCorrectPosition(trial);
    return DCCS_BOX_REFERENCES[correct === "top" ? "bottom" : "top"].color === trial.card.color;
  })).toBe(true);
  expect(formal[1].every((trial) => trial.topTarget.key === "tshirt" && trial.bottomTarget.key === "hat")).toBe(true);
  expect(JSON.stringify(bank)).toBe(before);
  expect(formal.map((trials) => trials.length)).toEqual([4, 4, 4]);
  expect(formal.map((trials) => trials.map((trial) => trial.card.id))).toEqual([
    ["blue_tshirt", "red_hat", "blue_hat", "red_tshirt"],
    ["blue_tshirt", "red_hat", "blue_hat", "red_tshirt"],
    ["blue_tshirt", "red_hat", "blue_hat", "red_tshirt"],
  ]);
  expect(formal.map((trials) => trials.map((trial) => trial.imageVariant))).toEqual([
    ["normal", "normal", "normal", "normal"], ["normal", "normal", "normal", "normal"], ["bag", "bag", "bag", "bag"],
  ]);
});
