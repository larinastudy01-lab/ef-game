import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestPageSRT from "../pages/TestPage_SRT";
import TestPageCBT from "../pages/TestPage_CBT";
import TestPageLB from "../pages/TestPage_LB";
import TestPageDCCS from "../pages/TestPage_DCCS";
import TestPagePM from "../pages/TestPage_PM";
import TestPageARI from "../pages/TestPage_ARI";
import * as pmItems from "../utils/pmItems";
import { CBT_ASSESSMENT_VERSIONS } from "../config/cbtAssessmentConfig";
import { ARI_ASSESSMENT_VERSIONS } from "../config/ariAssessmentConfig";
import { resetGameTestingMemory, startTemporaryGameTesting } from "./runtime";

const mockAttempt = { begin: jest.fn(), checkpoint: jest.fn(), complete: jest.fn((raw) => raw) };
jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: () => mockAttempt }));
jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../utils/lbDoorplateAssets", () => ({
  getLBAssessmentImage: (version, color, number) => `${version}/${color}/${number}.webp`,
}));
jest.mock("../components/SrtTestTutorial", () => ({
  __esModule: true,
  default: ({ onReady }) => <button onClick={onReady}>通過試玩</button>,
}));

let audios;
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
const finishAudio = () => act(() => fireEvent.ended(audios.at(-1)));
const board = () => screen.getByTestId("cbt-board");
const targets = () => within(board()).getAllByRole("button");
const lit = () => targets().findIndex((button) => button.querySelector(".is-glowing"));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  startTemporaryGameTesting();
  resetGameTestingMemory();
  audios = [];
  jest.spyOn(window, "Audio").mockImplementation((src) => {
    const audio = document.createElement("audio");
    audio.src = src;
    audio.play = jest.fn().mockResolvedValue(undefined);
    audio.pause = jest.fn();
    audios.push(audio);
    return audio;
  });
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function open(Page, slug, version) {
  render(<MemoryRouter initialEntries={[`/test-${slug}?testVersion=${version}&gameTesting=1`]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Page /></MemoryRouter>);
}

test.each(["01", "02"])("ARI QA copy %s overrides rotation and uses matching practice images and rule audio", async (version) => {
  const assessment = ARI_ASSESSMENT_VERSIONS[version];
  open(TestPageARI, "ari", version);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.ended(document.querySelector("video"));
  expect(screen.getByTestId("ari-practice")).toHaveAttribute("data-test-version", version);
  expect(audios.at(-1).getAttribute("src")).toBe(assessment.audio.intro);
  await act(async () => { fireEvent.ended(audios.at(-1)); });
  expect(audios.at(-1).getAttribute("src")).toBe(assessment.audio.rule);
  for (const animal of Object.values(assessment.animals)) {
    expect(screen.getByRole("button", { name: animal.label }).querySelector("img")).toHaveAttribute("src", animal.image);
  }
  expect(mockAttempt.begin).not.toHaveBeenCalled();
});

test.each([["01", ["car", "clothes"]], ["02", ["car", "furniture"]]])("PM QA copy %s overrides usage selection and gives practice the same categories", (version, categoryKeys) => {
  const build = jest.spyOn(pmItems, "buildPMQuestion");
  open(TestPagePM, "picture-memory", version);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  expect(screen.getByTestId("pm-stage")).toHaveAttribute("data-test-version", version);
  expect(build).toHaveBeenCalledWith(2, { mode: "practice", categoryKeys });
  const targets = Array.from(screen.getByTestId("pm-practice").querySelectorAll("[data-memory-id]"));
  expect(targets).toHaveLength(2);
  expect(targets.every((target) => [...categoryKeys, "unclassified"].includes(pmItems.PM_ITEM_BY_ID[target.dataset.memoryId].assetCategoryKey))).toBe(true);
});

test.each([["01", /褲子|襪子/], ["02", /拖鞋|圍巾/]])("DCCS QA copy %s overrides rotation and never uses training stimuli", (version, names) => {
  localStorage.setItem("dccsTestLastVersion_temporary-game-tester", "02");
  open(TestPageDCCS, "dccs", version);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.ended(document.querySelector("video"));
  expect(screen.getByTestId("dccs-assessment")).toHaveAttribute("data-test-version", version);
  expect(screen.getByTestId("dccs-stimulus").getAttribute("alt")).toMatch(names);
  expect(screen.getByTestId("dccs-stimulus").getAttribute("alt")).not.toMatch(/上衣|帽子/);
  expect(localStorage.getItem("dccsTestLastVersion_temporary-game-tester")).toBe("02");
});

test.each([["01", "葡萄", "Grape_good.webp"], ["02", "蘋果", "Apple_good.webp"]])(
  "SRT copy %s retains its fruit and narration from opening through formal assessment", async (version, name, image) => {
    open(TestPageSRT, "srt", version);
    expect(screen.getByAltText("本次收集的水果")).toHaveAttribute("src", image);
    fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
    fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
    fireEvent.click(screen.getByRole("button", { name: "通過試玩" }));
    expect(audios.at(-1).getAttribute("src")).toBe(`看到好的${name}，要記得點一下喔！.mp3`);
    for (let cue = 0; cue < 3; cue += 1) {
      await act(async () => { fireEvent.ended(audios.at(-1)); });
    }
    expect(mockAttempt.begin).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".srt-test-page")).toHaveAttribute("data-test-version", version);
    expect(mockAttempt.checkpoint).toHaveBeenCalledWith(expect.objectContaining({ testVersion: version, stimulusName: name }));
  }
);

test.each([["01", "lightgray"], ["02", "red"]])(
  "LB copy %s loads its matching practice board", (version, color) => {
    open(TestPageLB, "linking-balloons", version);
    fireEvent.click(screen.getByRole("button", { name: "開始", exact: true }));
    fireEvent.ended(document.querySelector("video"));
    expect(document.querySelector("[data-mode]")).toHaveAttribute("data-test-version", version);
    const images = document.querySelectorAll(".lb-doorplate img:not(.lb-mouse-guide)");
    expect(Array.from(images).some((image) => image.getAttribute("src") === `${version}/${color}/1.webp`)).toBe(true);
    expect(mockAttempt.begin).not.toHaveBeenCalled();
  }
);

test.each([["01", true], ["01", false], ["02", true], ["02", false]])(
  "CBT copy %s uses matching images, footprints and audio for correct=%s", (version, correct) => {
  const assessment = CBT_ASSESSMENT_VERSIONS[version];
  open(TestPageCBT, "cbt", version);
  fireEvent.click(screen.getByRole("button", { name: "開始遊戲" }));
  fireEvent.ended(document.querySelector("video"));
  for (let round = 0; round < 2; round += 1) {
    expect(audios.at(-1).getAttribute("src")).toBe(assessment.audio.intro);
    expect(board().querySelector("img.cbt-stone")).toHaveAttribute("src", assessment.image);
    finishAudio();
    expect(targets()[lit()].querySelector("img")).toHaveAttribute("src", assessment.shinyImage);
    const sequence = [lit()];
    advance(1500);
    sequence.push(lit());
    advance(1000);
    expect(audios.at(-1).getAttribute("src")).toBe(assessment.audio.answer);
    finishAudio();
    fireEvent.click(targets()[sequence[0]]);
    expect(targets()[sequence[0]].querySelector("img")).toHaveAttribute("src", assessment.stepImage);
    advance(300);
    fireEvent.click(targets()[sequence[1]]);
    expect(targets()[sequence[0]].querySelector("img")).toHaveAttribute("src", assessment.stepImage);
    expect(targets()[sequence[1]].querySelector("img")).toHaveAttribute("src", assessment.stepImage);
    advance(300);
    finishAudio();
  }
  fireEvent.click(screen.getByRole("button", { name: "開始正式評測" }));
  expect(mockAttempt.begin).toHaveBeenCalledTimes(1);
  expect(document.querySelector(".cbt-page")).toHaveAttribute("data-test-version", version);
  expect(targets()[lit()].querySelector("img")).toHaveAttribute("src", assessment.shinyImage);
  const sequence = [lit()];
  fireEvent.click(targets()[0]);
  expect(board().querySelector(".is-stepped")).toBeNull();
  advance(800); advance(260);
  sequence.push(lit());
  advance(800); advance(260);
  expect(board()).toHaveAttribute("data-phase", "answerCue");
  expect(audios.at(-1).getAttribute("src")).toBe(assessment.audio.answer);
  finishAudio();
  expect(board()).toHaveAttribute("data-phase", "answer");
  expect(Array.from(board().querySelectorAll("img.cbt-stone")).every((image) => image.getAttribute("src") === assessment.image)).toBe(true);
  fireEvent.click(targets()[sequence[0]]);
  expect(targets()[sequence[0]].querySelector("img")).toHaveAttribute("src", assessment.stepImage);
  advance(260);
  const second = correct ? sequence[1] : targets().findIndex((_, index) => !sequence.includes(index));
  fireEvent.click(targets()[second]);
  expect(targets()[sequence[0]].querySelector("img")).toHaveAttribute("src", assessment.stepImage);
  expect(targets()[second].querySelector("img")).toHaveAttribute("src", assessment.stepImage);
  advance(700);
  fireEvent.click(screen.getByRole("button", { name: "進入下一題" }));
  expect(board()).toHaveAttribute("data-phase", "show");
  expect(board().querySelector(".is-stepped")).toBeNull();
});
