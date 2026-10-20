/* React 18 createRoot is managed explicitly so these DOM-level integration tests need act.
 * Direct DOM access verifies disclosure structure and focus anchors. */
/* eslint-disable testing-library/no-dom-import, testing-library/no-unnecessary-act, testing-library/no-node-access */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen } from "@testing-library/dom";
import ResearchStatistics from "./ResearchStatistics";
import ResearchProfessionalDashboard from "./ResearchProfessionalDashboard";
import LongitudinalDashboard from "./LongitudinalDashboard";
import AIBehavioralAnalysis from "./AIBehavioralAnalysis";
import AdaptiveRecommendationResearch from "./AdaptiveRecommendationResearch";
import { getMyProfile, getResearchExperimentHistory, getResearchFeatureInputsFromCloud } from "../lib/database";
import { loadRecommendationHistory } from "../analytics/recommendation";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("../lib/database", () => ({ getMyProfile: jest.fn(), getResearchFeatureInputsFromCloud: jest.fn(), getResearchExperimentHistory: jest.fn().mockResolvedValue([]) }));
jest.mock("../lib/supabaseClient", () => ({ supabase: {} }));
jest.mock("../analytics/recommendation", () => ({ ...jest.requireActual("../analytics/recommendation"), loadRecommendationHistory: jest.fn().mockResolvedValue([]) }));
jest.mock("recharts", () => {
  const React = require("react"); const wrapper = ({ children }) => <div>{children}</div>;
  return Object.fromEntries(["Bar", "BarChart", "CartesianGrid", "Legend", "Line", "LineChart", "ReferenceLine", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis"].map((name) => [name, wrapper]));
});

let container, root;
const inputs = ["CBT", "PM"].flatMap((task) => [1, 2, 3].map((day) => ({ participantId: "anonymous-a", sessionId: `session-${day}`,
  taskSession: { id: `${task}-${day}`, task_code: task, difficulty: 1, completion_status: "completed" },
  sessionMetadata: { assessment_or_training: "assessment", session_started_at: `2026-10-0${day}T00:00:00Z` },
  trials: [1, 2, 3, 4].map((index) => ({ trial_index: index, is_correct: index <= day, reaction_time_ms: day * 100 + index, valid_trial: true })) })));

beforeEach(() => { localStorage.clear(); mockNavigate.mockClear(); getMyProfile.mockResolvedValue({ role: "clinician" }); getResearchFeatureInputsFromCloud.mockResolvedValue(inputs);
  getResearchExperimentHistory.mockResolvedValue([]); loadRecommendationHistory.mockResolvedValue([]);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const renderPage = async (Page) => { await act(async () => { root.render(<Page/>); }); };

test("all-task statistics show distributions for every task with visible units", async () => {
  await renderPage(ResearchStatistics);
  expect(screen.getByRole("heading", { name: "CBT · n = 3" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "PM · n = 3" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "資料分布 · 正確率（%）" })).toBeInTheDocument();
});

test.each([[ResearchProfessionalDashboard, "研究總覽"], [LongitudinalDashboard, "縱向追蹤"]])("participant tools include personal context and a separate quality review", async (Page, title) => {
  await renderPage(Page);
  expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "資料摘要" })).toHaveTextContent("增加 50.0 個百分點");
  act(() => fireEvent.click(screen.getByText(Page === ResearchProfessionalDashboard ? "檢視說明" : "與目前分析相關的資料品質")));
  expect(screen.getByRole("region", { name: "警示與資料品質" })).toHaveTextContent("臨床危急值監測：尚未啟用");
  expect(screen.getByRole("button", { name: "暗色模式" })).toBeInTheDocument();
});

test("AI never silently substitutes simulations for insufficient observations", async () => {
  await renderPage(AIBehavioralAnalysis);
  expect(screen.getByRole("heading", { name: "觀察模型尚未就緒" })).toBeInTheDocument();
  expect(screen.queryByText("模擬資料｜非實際研究結果")).not.toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "使用模擬資料預覽" })));
  expect(screen.getByText("模擬資料｜非實際研究結果")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "預測與模型表現" })).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "返回實際觀察資料" })));
  expect(screen.getByRole("heading", { name: "觀察模型尚未就緒" })).toBeInTheDocument();
});

test("adaptive research retains separate simulation and observed sections", async () => {
  await renderPage(AdaptiveRecommendationResearch);
  expect(screen.getByRole("heading", { name: "策略比較・模擬" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "建議歷程・實際資料" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "暗色模式" })).toBeInTheDocument();
});
