import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestPageSRT from "./TestPage_SRT";
import { useTestAttempt } from "../utils/useTestAttempt";
import { saveUnifiedResult } from "../utils/resultManager";

jest.mock("../utils/resultManager", () => ({ saveUnifiedResult: jest.fn() }));
jest.mock("../utils/useTestAttempt", () => ({ useTestAttempt: jest.fn() }));
jest.mock("../components/SrtTestTutorial", () => ({
  __esModule: true,
  default: ({ onReady }) => <button onClick={onReady}>通過試玩</button>,
}));

let audios;
const advance = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const finishAudio = async () => { await act(async () => { fireEvent.ended(audios.at(-1)); }); };
function enterIntro() {
  const rendered = render(<MemoryRouter><TestPageSRT /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "進入遊戲" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  fireEvent.click(screen.getByRole("button", { name: "通過試玩" }));
  return rendered;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("currentChild", JSON.stringify({ childId: "child-srt", name: "測試" }));
  useTestAttempt.mockReturnValue({ begin: jest.fn(), checkpoint: jest.fn(), complete: (raw) => raw });
  jest.spyOn(Math, "random").mockReturnValue(0.99);
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

afterEach(async () => {
  await act(async () => { cleanup(); });
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("all rules and start speech finish before the eight-minute clock; assessed responses are silent", async () => {
  enterIntro();
  const intro = screen.getByRole("region", { name: "測驗準備" });
  const chicken = within(intro).getByRole("img", { name: "小雞陪你記住規則" });
  expect(chicken.querySelector(".srt-narrator-frame-open")).toHaveAttribute("src", "chicken.webp");
  expect(chicken.querySelector(".srt-narrator-frame-closed")).toHaveAttribute("src", "chicken01.webp");
  expect(within(intro).getByTestId("srt-rule-mouse")).toHaveAttribute("src", "mouse.webp");
  expect(within(intro).getByRole("img", { name: "壞橡實上打叉，不要點擊" })).toContainElement(within(intro).getByTestId("srt-rule-cross"));
  for (const [filename, prompt, currentRule] of [
    ["看到好的橡實，就快快點！.mp3", "看到好的橡實，就快快點！", "用手指點擊好橡實"],
    ["看到壞掉的橡實，千萬不要點喔！.mp3", "看到壞掉的橡實，千萬不要點喔！", "壞橡實上打叉，不要點擊"],
    ["準備好了嗎？看仔細，開始囉！.mp3", "準備好了嗎？看仔細，開始囉！", null],
  ]) {
    expect(audios.at(-1).getAttribute("src")).toBe(filename);
    expect(screen.getByTestId("srt-narrator")).toBeInTheDocument();
    expect(chicken).toHaveAttribute("data-speaking", "true");
    expect(within(intro).getByRole("status")).toHaveTextContent(prompt);
    if (currentRule) expect(within(intro).getByRole("img", { name: currentRule }).closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(intro).getByRole("img", { name: "用手指點擊好橡實" })).toHaveAttribute("data-animate", String(currentRule === "用手指點擊好橡實"));
    await advance(1500);
    expect(useTestAttempt().begin).not.toHaveBeenCalled();
    expect(useTestAttempt().checkpoint).not.toHaveBeenCalled();
    expect(screen.queryByTestId("srt-game-area")).not.toBeInTheDocument();
    await finishAudio();
  }
  expect(useTestAttempt().begin).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("srt-narrator")).not.toBeInTheDocument();
  expect(screen.queryByTestId("srt-rule-cross")).not.toBeInTheDocument();
  expect(screen.queryByTestId("srt-rule-mouse")).not.toBeInTheDocument();
  const startedAt = performance.now();
  expect(audios.every((audio) => audio.pause.mock.calls.length === 1)).toBe(true);
  await advance(3020);
  fireEvent.click(screen.getByTestId("srt-stimulus"));
  fireEvent.click(screen.getByTestId("srt-game-area"));
  // Miss the next normal acorns and incorrectly click the rotten one.
  await advance(9000);
  expect(screen.getByTestId("srt-stimulus")).toHaveAttribute("alt", "壞橡實");
  fireEvent.click(screen.getByTestId("srt-stimulus"));
  expect(audios).toHaveLength(3);
  await advance(480000 - (performance.now() - startedAt) - 1);
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  expect(audios).toHaveLength(3);
  await advance(1);
  expect(saveUnifiedResult.mock.calls[0][0].rawResult).toMatchObject({ durationMs: 480000, completionReason: "time_up" });
  expect(audios).toHaveLength(4);
  expect(audios.at(-1).getAttribute("src")).toBe("完成囉！你真的很努力！.mp3");
  expect(screen.getByTestId("srt-narrator")).toHaveAttribute("data-narration-event", "assessmentComplete");
  expect(screen.getByAltText("SRT 關卡圖示")).toBeInTheDocument();
  await finishAudio();
  expect(screen.queryByTestId("srt-narrator")).not.toBeInTheDocument();
  expect(jest.getTimerCount()).toBe(0);
});

test.each(["error", "timeout", "rejection"])("intro %s keeps timing paused until a successful replay", async (failure) => {
  enterIntro();
  if (failure === "error") await act(async () => { fireEvent.error(audios.at(-1)); });
  if (failure === "timeout") await advance(10000);
  if (failure === "rejection") {
    // Reject the next clip's actual play promise.
    const audioConstructor = window.Audio.getMockImplementation();
    window.Audio.mockImplementationOnce((src) => {
      const audio = audioConstructor(src);
      audio.play.mockRejectedValueOnce(new Error("autoplay blocked"));
      return audio;
    });
    await finishAudio();
  }
  await advance(480000);
  expect(useTestAttempt().begin).not.toHaveBeenCalled();
  expect(screen.getByTestId("srt-narrator")).toHaveAttribute("data-speaking", "false");
  expect(saveUnifiedResult).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "重新播放語音" }));
  await finishAudio();
  await finishAudio();
  await finishAudio();
  expect(useTestAttempt().begin).toHaveBeenCalledTimes(1);
});

test("leaving during introduction cancels speech and prevents late events from starting assessment", async () => {
  const { unmount } = enterIntro();
  await act(async () => { unmount(); });
  expect(audios[0].pause).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  await finishAudio();
  await advance(500000);
  expect(useTestAttempt().begin).not.toHaveBeenCalled();
  expect(saveUnifiedResult).not.toHaveBeenCalled();
});
