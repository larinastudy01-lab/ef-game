import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestARI, { buildAriAssessmentTrials } from "./TestPage_ARI";
import { ARI_ASSESSMENT_VERSIONS, getAriAssessmentVersion } from "../config/ariAssessmentConfig";
import { useTestAttempt } from "../utils/useTestAttempt";
import { saveUnifiedResult } from "../utils/resultManager";

jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));
jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));

let audios;
let attempt;
const current = () => audios.at(-1);
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
const endCue = async (source) => {
  expect(current().src).toBe(source);
  await act(async () => current().onended());
};
const select = (animal) => fireEvent.click(screen.getByRole("button", { name: animal.label, exact: true }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("currentChild", JSON.stringify({ childId: "a" }));
  audios = [];
  jest.spyOn(global, "Audio").mockImplementation((src) => {
    const audio = { src, play: jest.fn().mockResolvedValue(), pause: jest.fn(), currentTime: 0 };
    audios.push(audio);
    return audio;
  });
  attempt = { begin: jest.fn(), checkpoint: jest.fn(), complete: jest.fn((raw) => raw), interrupt: jest.fn() };
  useTestAttempt.mockReturnValue(attempt);
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

function openPractice() {
  // Public query parameters cannot force a copy or select training assets.
  render(<MemoryRouter initialEntries={["/test-ari?testVersion=training"]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TestARI /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.ended(document.querySelector("video"));
}

async function passPractice(assessment) {
  const { audio, animals } = assessment;
  await endCue(audio.intro);
  expect(screen.getByRole("status")).toHaveTextContent(assessment.ruleText);
  await endCue(audio.rule);
  for (let index = 0; index < 2; index += 1) {
    await endCue(audio.question);
    const sound = current().src === audio.cat ? "cat" : "dog";
    await endCue(audio[sound]);
    await endCue(audio.answer);
    const expected = animals[sound === "cat" ? "dog" : "cat"];
    expect(screen.getByRole("button", { name: expected.label }).querySelector("img")).toHaveAttribute("src", expected.image);
    select(expected);
    await act(async () => jest.advanceTimersByTime(1000));
    await endCue(audio.correct);
  }
  await endCue(audio.complete);
  fireEvent.click(screen.getByRole("button", { name: "開始挑戰" }));
  expect(attempt.begin).not.toHaveBeenCalled();
  expect(localStorage.getItem("ariTestLastVersion_a")).toBe(assessment.testVersion === "01" ? "02" : "01");
  await endCue(audio.assessmentStart);
  expect(attempt.begin).toHaveBeenCalledWith(expect.objectContaining({ childId: "a" }));
  expect(localStorage.getItem("ariTestLastVersion_a")).toBe(assessment.testVersion);
  advance(500);
}

test.each(["01", "02"])("copy %s stays consistent through practice, twenty scored trials, completion and next visit", async (version) => {
  const assessment = ARI_ASSESSMENT_VERSIONS[version];
  const previous = version === "01" ? "02" : "01";
  localStorage.setItem("ariTestLastVersion_a", previous);
  openPractice();
  expect(screen.getByTestId("ari-practice")).toHaveAttribute("data-test-version", version);
  expect(localStorage.getItem("ariTestLastVersion_a")).toBe(previous);
  await passPractice(assessment);
  for (let index = 0; index < 20; index += 1) {
    expect(screen.getByTestId("ari-assessment-stage")).toHaveAttribute("data-test-version", version);
    const sound = current().src === assessment.audio.cat ? "cat" : "dog";
    expect(current().src).toBe(assessment.animals[sound].sound);
    act(() => current().onplaying());
    advance(200);
    select(assessment.animals[sound === "cat" ? "dog" : "cat"]);
    advance(420);
    if (index < 19) { advance(260); advance(500); }
  }
  const result = attempt.complete.mock.calls[0][0];
  expect(result).toMatchObject({ testVersion: version, stimulusSetId: `test${version}`, accuracy: 100, correctCount: 20, stars: 3 });
  expect(result.records).toHaveLength(20);
  for (const record of result.records) {
    expect(record).toMatchObject({ testVersion: version, isCorrect: true,
      soundAnimal: assessment.animals[record.soundType].id,
      expectedAnimal: assessment.animals[record.expectedTarget].id,
      selectedAnimal: assessment.animals[record.expectedTarget].id });
    expect(record.soundAnimal).not.toBe(record.selectedAnimal);
  }
  expect(result.scoring.childView.reminder).not.toMatch(/貓|狗/);
  expect(saveUnifiedResult).toHaveBeenCalledTimes(1);
  expect(current().src).toBe(assessment.audio.assessmentComplete);
  expect(audios.every((audio) => !/(cat|dog)\.mp3$/.test(audio.src))).toBe(true);
  cleanup();
  openPractice();
  expect(screen.getByTestId("ari-practice")).toHaveAttribute("data-test-version", previous);
});

test("leaving before formal start keeps the same copy and another child starts at 01", () => {
  localStorage.setItem("ariTestLastVersion_a", "01");
  openPractice();
  expect(screen.getByTestId("ari-practice")).toHaveAttribute("data-test-version", "02");
  cleanup(); openPractice();
  expect(screen.getByTestId("ari-practice")).toHaveAttribute("data-test-version", "02");
  cleanup();
  localStorage.setItem("currentChild", JSON.stringify({ childId: "b" }));
  openPractice();
  expect(screen.getByTestId("ari-practice")).toHaveAttribute("data-test-version", "01");
  expect(attempt.begin).not.toHaveBeenCalled();
});

test.each(["01", "02"])("copy %s balances both sounds and both answer positions", (version) => {
  const assessment = ARI_ASSESSMENT_VERSIONS[version];
  const trials = buildAriAssessmentTrials(assessment);
  expect(trials).toHaveLength(20);
  for (const sound of ["cat", "dog"]) {
    for (const side of ["left", "right"]) {
      const group = trials.filter((trial) => trial.soundType === sound && trial.correctPosition === side);
      expect(group).toHaveLength(5);
      expect(group.every((trial) => trial.soundSrc === assessment.animals[sound].sound && trial.correctTarget !== sound)).toBe(true);
    }
  }
  expect(getAriAssessmentVersion("training").testVersion).toBe("01");
});
