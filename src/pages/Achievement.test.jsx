import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Achievement from "./Achievement";
import TrainingPageLB from "./TrainingPage_LB";
import { readAchievementProgress, recordAchievementResult } from "../utils/achievementProtocol";
import { analyzeAndSaveLBTraining } from "../ai/lbTrainingAnalyzer";
import { queueGameResult } from "../utils/resultSync";
import { awardTrainingCoins } from "../utils/economyManager";
import { completeActiveRecommendation } from "../analytics/recommendation/onlineRecommendation";

jest.mock("../utils/achievementAssets", () => ({ getAchievementAsset: (id, level) => `${id}-${level}.webp` }));
jest.mock("../utils/lbDoorplateAssets", () => ({ getLBDoorplateImage: (color, number) => `${color}-${number}.webp` }));
jest.mock("../utils/resultSync", () => ({ queueGameResult: jest.fn() }));
jest.mock("../utils/economyManager", () => ({ awardTrainingCoins: jest.fn() }));
jest.mock("../analytics/recommendation/onlineRecommendation", () => ({ completeActiveRecommendation: jest.fn() }));
jest.mock("../ai/lbTrainingAnalyzer", () => ({
  getLBInitialTrainingConfig: () => ({ recommendedLevelIndex: 0 }), analyzeAndSaveLBTraining: jest.fn(),
}));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks();
  localStorage.setItem("currentChild", JSON.stringify({ childId: "child-1", name: "測試" }));
  analyzeAndSaveLBTraining.mockReturnValue({ nextDifficulty: "medium", nextDifficultyLevel: 3 });
  awardTrainingCoins.mockReturnValue({ awarded: false });
  completeActiveRecommendation.mockResolvedValue(null);
});
afterEach(() => { cleanup(); jest.useRealTimers(); });
const renderPage = (page, entry = "/achievement") => render(<MemoryRouter initialEntries={[entry]}
  future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{page}</MemoryRouter>);

test("all six badges show the common rule, retained award, next goal and original difficulty evidence", () => {
  recordAchievementResult({ gameId: "LB", childId: "child-1", resultId: "lb-one", mode: "training", completed: true,
    totalTrials: 10, accuracy: 90, difficulty: "easy", difficultyLabel: "簡單", promptCount: 2,
    finishedAt: "2026-10-16T05:00:00Z", achievementAssignment: { policyVersion: 2, id: "assigned", gameId: "LB", childId: "child-1", source: "system_plan", difficulty: "easy", issuedAt: "2026-10-16T04:00:00Z" } });
  renderPage(<Achievement />);
  expect(screen.getAllByRole("article")).toHaveLength(6);
  expect(screen.getByLabelText("徽章獲得通則")).toHaveTextContent("正確率達 80%");
  expect(screen.getByLabelText("徽章獲得通則")).toHaveTextContent("星耀級 15 次");
  const badge = screen.getByRole("heading", { name: "門牌導航員" }).closest("article");
  expect(within(badge).getByText("銅級")).toBeInTheDocument();
  expect(within(badge).getByText("再達標 2 次，獲得銀級徽章")).toBeInTheDocument();
  fireEvent.click(within(badge).getByText("查看達標與獲得紀錄"));
  expect(within(badge).getByText(/2026-10-16 · 簡單 · 正確率 90%/)).toHaveTextContent("提醒 2 次");
  cleanup();
  renderPage(<Achievement />);
  expect(screen.getByRole("heading", { name: "門牌導航員" }).closest("article")).toHaveTextContent("銅級");
});

test("existing legacy badges freeze permanently, stay out of new progress, and remain isolated by child", () => {
  localStorage.setItem("achievementResultLedger_child-1", JSON.stringify([{ id: "old-lb", gameId: "LB", mode: "training", childId: "child-1",
    timestamp: "2026-10-01T04:00:00Z", totalTrials: 10, correctCount: 10, accuracy: 100, timeoutCount: 0, trainingLevel: 2, stars: 3, records: [] }]));
  renderPage(<Achievement />);
  expect(screen.getByRole("heading", { name: "已解鎖 0 個成就" })).toBeInTheDocument();
  fireEvent.click(screen.getByTitle("舊制收藏"));
  const oldBadge = screen.getByRole("heading", { name: "森林任務王" }).closest("article");
  expect(oldBadge).toHaveTextContent("銀級 · 舊制收藏");
  localStorage.removeItem("achievementResultLedger_child-1");
  fireEvent.click(screen.getByRole("button", { name: "更新成就進度" }));
  expect(screen.getByRole("heading", { name: "森林任務王" }).closest("article")).toHaveTextContent("永久保留");
  localStorage.setItem("latestLBTrainingResult", JSON.stringify({ gameId: "LB", mode: "training", trainingLevel: 5, stars: 3, totalTrials: 10, accuracy: 100 }));
  localStorage.setItem("currentChild", JSON.stringify({ childId: "child-2" }));
  act(() => window.dispatchEvent(new Event("storage")));
  expect(screen.queryByRole("heading", { name: "森林任務王" })).not.toBeInTheDocument();
  expect(screen.getByText("目前沒有舊制收藏")).toBeInTheDocument();
});

test("finishing an assigned LB route grants exactly one persisted credit and uploads assignment evidence", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-16T04:00:00Z"));
  renderPage(<TrainingPageLB />, { pathname: "/training-linking-balloons", search: "?level=2", state: {
    trainingLevel: 2, trainingAssignment: { source: "system_plan", gameId: "LB", childId: "child-1", trainingLevel: 2 },
  } });
  const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
  fireEvent.click(screen.getByRole("button", { name: "開始訓練" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過動畫" }));
  fireEvent.click(screen.getByRole("button", { name: "跳過步驟說明" }));
  fireEvent.click(screen.getByRole("button", { name: "看完說明，開始第 2 關" }));
  act(() => jest.advanceTimersToNextTimer());
  for (let number = 1; number <= 10; number += 1) {
    advance(100);
    fireEvent.click(screen.getByRole("button", { name: `${number % 2 ? "紅色" : "藍色"}${number}`, exact: true }));
    advance(420);
    if (number < 10) act(() => jest.advanceTimersToNextTimer());
  }
  advance(5820);
  expect(readAchievementProgress("child-1").credits).toHaveLength(1);
  expect(queueGameResult).toHaveBeenCalledTimes(1);
  const uploaded = queueGameResult.mock.calls[0][0];
  expect(uploaded.rawResult.achievementEligibility).toMatchObject({ qualified: true, credited: true });
  expect(uploaded.rawResult.achievementAssignment).toMatchObject({ source: "system_plan", difficulty: "easy" });
  cleanup();
  renderPage(<Achievement />);
  expect(readAchievementProgress("child-1").credits).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "門牌導航員" }).closest("article")).toHaveTextContent("銅級");
});
