import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

function MockGamePage() {
  return <main>遊戲畫面<button>操作</button><video aria-label="教學影片" muted /><audio aria-label="旁白" /></main>;
}

jest.mock("./components/ResultSyncStatus", () => () => null);
jest.mock("./components/ResultAccessRoute", () => ({ children }) => children);
jest.mock("./components/ProtectedRoute", () => ({ children }) => children);
jest.mock("./pages/ResearchTools", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/HomePage", () => () => (
  <main>首頁<button>操作</button><video aria-label="教學影片" muted /><audio aria-label="旁白" /></main>
));
jest.mock("./pages/TestMapPage", () => () => <main>測驗地圖</main>);
jest.mock("./pages/TestPage_SRT", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TrainingPage_SRT", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TestPage_PM", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TrainingPage_PM", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TestPage_CBT", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TrainingPage_CBT", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TestPage_LB", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TrainingPage_LB", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TestPage_ARI", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TrainingPage_ARI", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TestPage_DCCS", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/TrainingPage_DCCS", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/ResultPage_SRT", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/ResultPage_PA", () => ({ __esModule: true, default: MockGamePage }));
jest.mock("./pages/HatStickerGamePage", () => ({ __esModule: true, default: MockGamePage }));

beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });
afterEach(cleanup);

async function mount(path = "/") {
  window.history.replaceState(null, "", path);
  render(<App />);
  await screen.findByText(path === "/" ? "首頁" : "遊戲畫面");
  const bgm = screen.getByTestId("app-bgm");
  // Track only BGM calls, independently of other audio/video play methods.
  bgm.play = jest.fn().mockResolvedValue(undefined);
  bgm.pause = jest.fn();
  return bgm;
}

async function navigate(path) {
  await act(async () => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

const taskRoutes = [
  ...["srt", "picture-memory", "cbt", "linking-balloons", "ari", "dccs"].flatMap(
    (game) => [`/test-${game}`, `/training-${game}`]
  ),
  "/result-srt", "/result-pa", "/hat-sticker-game", "/test-srt/?gameTesting=1",
];

test.each(["/research-tools", "/research-tools/?view=statistics", "/research-statistics", "/research-professional-dashboard",
  "/ai-behavioral-analysis", "/adaptive-recommendation-research", "/longitudinal-dashboard"])("%s pauses existing music and stays silent after interaction and media ends", async (path) => {
  const bgm = await mount();
  fireEvent.click(screen.getByRole("button", { name: "操作" }));
  expect(bgm.play).toHaveBeenCalledTimes(1);
  bgm.play.mockClear();
  await navigate(path);
  expect(await screen.findByText("遊戲畫面")).toBeInTheDocument();
  expect(bgm.pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "操作" }));
  fireEvent.play(screen.getByLabelText("教學影片"));
  fireEvent.ended(screen.getByLabelText("教學影片"));
  expect(bgm.play).not.toHaveBeenCalled();
  await navigate("/");
  expect(bgm.play).toHaveBeenCalledTimes(1);
});

test.each(taskRoutes)("%s stays without BGM after interaction and after video/narration end", async (path) => {
  const bgm = await mount(path);
  fireEvent.click(screen.getByRole("button", { name: "操作" }));
  expect(bgm.play).not.toHaveBeenCalled();
  fireEvent.play(screen.getByLabelText("教學影片"));
  expect(screen.getByLabelText("教學影片").muted).toBe(false);
  fireEvent.ended(screen.getByLabelText("教學影片"));
  fireEvent.play(screen.getByLabelText("旁白"));
  fireEvent.ended(screen.getByLabelText("旁白"));
  expect(bgm.play).not.toHaveBeenCalled();
});

test("leaving a music page pauses BGM for the whole game, including when the user enables music", async () => {
  const bgm = await mount();
  fireEvent.click(screen.getByRole("button", { name: "操作" }));
  expect(bgm.play).toHaveBeenCalledTimes(1);
  bgm.play.mockClear();
  await navigate("/test-srt");
  expect(bgm.pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "開啟設定" }));
  fireEvent.click(screen.getByRole("button", { name: "關閉背景音樂" }));
  fireEvent.click(screen.getByRole("button", { name: "開啟背景音樂" }));
  fireEvent.ended(screen.getByLabelText("教學影片"));
  const narration = new Audio("narration.mp3"); // Game voices are detached from the DOM.
  await narration.play();
  narration.pause();
  await navigate("/training-srt");
  expect(bgm.play).not.toHaveBeenCalled();
  await navigate("/");
  expect(bgm.play).toHaveBeenCalledTimes(1);
});

test("on other pages, overlapping foreground video/audio both have to stop before music resumes", async () => {
  const bgm = await mount();
  fireEvent.click(screen.getByRole("button", { name: "操作" }));
  expect(bgm.play).toHaveBeenCalledTimes(1);
  const video = screen.getByLabelText("教學影片");
  const narration = screen.getByLabelText("旁白");
  fireEvent.play(video);
  expect(bgm.pause).toHaveBeenCalled();
  fireEvent.play(narration);
  fireEvent.ended(video);
  expect(bgm.play).toHaveBeenCalledTimes(1);
  fireEvent.ended(narration);
  expect(bgm.play).toHaveBeenCalledTimes(2);
  const pauseCount = bgm.pause.mock.calls.length;
  fireEvent.play(bgm);
  expect(bgm.pause).toHaveBeenCalledTimes(pauseCount);
});

test("manual mute is preserved after narration finishes and after returning from a game", async () => {
  const bgm = await mount();
  fireEvent.click(screen.getByRole("button", { name: "操作" }));
  fireEvent.play(screen.getByLabelText("旁白"));
  fireEvent.click(screen.getByRole("button", { name: "開啟設定" }));
  fireEvent.click(screen.getByRole("button", { name: "關閉背景音樂" }));
  bgm.play.mockClear();
  fireEvent.ended(screen.getByLabelText("旁白"));
  await navigate("/test-srt");
  await navigate("/");
  expect(bgm.play).not.toHaveBeenCalled();
});

test("removing a playing video during navigation does not leave music stuck on the map", async () => {
  const bgm = await mount();
  fireEvent.click(screen.getByRole("button", { name: "操作" }));
  fireEvent.play(screen.getByLabelText("教學影片"));
  bgm.play.mockClear();
  await navigate("/test-map");
  expect(await screen.findByText("測驗地圖")).toBeInTheDocument();
  expect(bgm.play).toHaveBeenCalledTimes(1);
});

test("a failed narration releases music on other pages", async () => {
  const bgm = await mount();
  fireEvent.click(screen.getByRole("button", { name: "操作" }));
  fireEvent.play(screen.getByLabelText("旁白"));
  bgm.play.mockClear();
  fireEvent.error(screen.getByLabelText("旁白"));
  expect(bgm.play).toHaveBeenCalledTimes(1);
});
