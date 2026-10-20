/* React 18 createRoot is managed explicitly so these DOM-level integration tests need act.
 * Direct DOM access verifies disclosure structure and focus anchors. */
/* eslint-disable testing-library/no-dom-import, testing-library/no-unnecessary-act, testing-library/no-node-access */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen, within } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import ResearchTools from "./ResearchTools";
import { getMyProfile, getResearchExperimentHistory, getResearchFeatureInputsFromCloud } from "../lib/database";
import { loadRecommendationHistory } from "../analytics/recommendation";

jest.mock("../lib/database", () => ({ getMyProfile: jest.fn(), getResearchExperimentHistory: jest.fn(), getResearchFeatureInputsFromCloud: jest.fn() }));
jest.mock("../lib/supabaseClient", () => ({ supabase: {} }));
jest.mock("../analytics/recommendation", () => ({ ...jest.requireActual("../analytics/recommendation"), loadRecommendationHistory: jest.fn() }));
jest.mock("recharts", () => {
  const React = require("react"); const wrapper = ({ children }) => <div>{children}</div>;
  return Object.fromEntries(["Bar", "BarChart", "CartesianGrid", "Legend", "Line", "LineChart", "ReferenceLine", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis"].map((name) => [name, wrapper]));
});

const inputs = ["a", "b"].flatMap((participantId) => ["CBT", "ARI", "PM"].flatMap((task_code) => [1, 2].map((day) => ({
  participantId, sessionId: `${participantId}-${day}`, taskSession: { id: `${participantId}-${task_code}-${day}`, task_code, difficulty: 1, completion_status: "completed" },
  sessionMetadata: { assessment_or_training: "assessment", session_started_at: `2026-10-0${day}T00:00:00Z` },
  trials: [1, 2, 3, 4].map((trial_index) => ({ trial_index, is_correct: trial_index <= day, reaction_time_ms: 500 + trial_index, valid_trial: true })),
}))));
const retired = ["DPT", "SSG", "SSS"].map((task_code) => ({ ...inputs[0], participantId: `old-${task_code}`, taskSession: { task_code }, trials: [] }));
let container, root;
beforeEach(() => {
  localStorage.clear(); getMyProfile.mockResolvedValue({ role: "clinician" }); getResearchFeatureInputsFromCloud.mockResolvedValue([...inputs, ...retired]); getResearchExperimentHistory.mockResolvedValue([]);
  loadRecommendationHistory.mockResolvedValue(["a", "b"].map((participant_id) => ({ id: participant_id, participant_id, selected_action: { task_code: "ARI", difficulty_level: 1 }, recommendation_timestamp: "2026-10-01", policy_name: `current-policy-${participant_id}` }))
    .concat(retired.map((input) => ({ id: input.participantId, participant_id: "a", selected_action: { task_code: input.taskSession.task_code }, policy_name: "removed-policy" }))));
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const renderWorkspace = async (entry = "/research-tools") => { await act(async () => { root.render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ResearchTools/></MemoryRouter>); }); };
const tab = async (name) => { await act(async () => fireEvent.click(screen.getByRole("tab", { name }))); };
const choose = async (name, value) => { await act(async () => fireEvent.change(screen.getByRole("combobox", { name }), { target: { value } })); };

test("five tools share a single main, dataset, theme, and current task catalog", async () => {
  await renderWorkspace();
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getAllByRole("tab")).toHaveLength(5);
  expect(screen.getAllByRole("button", { name: "暗色模式" })).toHaveLength(1);
  const options = within(screen.getByRole("region", { name: "共用分析範圍" })).getByRole("combobox", { name: "任務" }).textContent;
  expect(options).toContain("ARI · 貓狗反向"); expect(options).not.toMatch(/DPT|SSG|SSS|點探測/);
  expect(screen.getByText(/已排除 3 筆非現行任務紀錄/)).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "暗色模式" })));
  await choose("任務", "ARI");
  for (const name of ["研究統計", "AI 行為分析", "自適應建議", "縱向追蹤", "研究總覽"]) await tab(name);
  expect(screen.getByRole("main")).toHaveAttribute("data-research-theme", "dark");
  expect(screen.getByRole("combobox", { name: "任務" })).toHaveValue("ARI");
  expect(screen.getByRole("region", { name: "資料摘要" })).toHaveTextContent("ARI · 貓狗反向");
  expect(container.textContent).not.toMatch(/DPT|SSG|SSS|點探測|removed-policy/);
  expect(getMyProfile).toHaveBeenCalledTimes(1); expect(getResearchFeatureInputsFromCloud).toHaveBeenCalledTimes(1);
  expect(loadRecommendationHistory).toHaveBeenCalledTimes(1); expect(getResearchExperimentHistory).toHaveBeenCalledTimes(1);
});

test("tab-specific controls survive switching while participant and task scopes synchronize", async () => {
  await renderWorkspace("/research-tools?view=ai");
  await choose("結果類型", "classification");
  await tab("研究統計"); await choose("分布特徵", "rt_mean");
  await tab("AI 行為分析"); expect(screen.getByRole("combobox", { name: "結果類型" })).toHaveValue("classification");
  await tab("研究統計"); expect(screen.getByRole("combobox", { name: "分布特徵" })).toHaveValue("rt_mean");
  await choose("匿名參與者", "b"); await choose("任務", "ARI"); await tab("自適應建議");
  const panel = screen.getByRole("tabpanel"); expect(panel).toHaveTextContent("current-policy-b"); expect(panel).not.toHaveTextContent("current-policy-a");
  await tab("縱向追蹤"); expect(screen.getByRole("region", { name: "資料摘要" })).toHaveTextContent("增加 25.0 個百分點");
  expect(screen.getByRole("combobox", { name: "匿名參與者" })).toHaveValue("b");
});

test("tab keyboard navigation updates selection and focus", async () => {
  await renderWorkspace();
  await act(async () => fireEvent.keyDown(screen.getByRole("tab", { name: "研究總覽" }), { key: "End" }));
  expect(screen.getByRole("tab", { name: "縱向追蹤" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "縱向追蹤" })).toHaveFocus();
});

test("sidebar uses the game logo and provides six game guides when expanded or collapsed", async () => {
  await renderWorkspace();
  expect(screen.getByRole("img", { name: "蒐秘密遊戲 Logo" })).toHaveAttribute("src", "/logo192.webp");
  expect(screen.queryByRole("button", { name: "開啟既有設定" })).not.toBeInTheDocument();
  const guide = screen.getByRole("region", { name: "遊戲規則與收集資料" });
  expect(guide.querySelectorAll("details")).toHaveLength(6);
  expect(guide).toHaveTextContent("CBT石頭記憶");
  expect(guide).toHaveTextContent("主要測驗規則");
  expect(guide).toHaveTextContent("收集的資料");
  expect(guide).toHaveTextContent("reactionTime");
  expect(guide).not.toHaveTextContent(/DPT|SSG|SSS/);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "收合側邊導覽" })));
  expect(localStorage.getItem("research-sidebar-collapsed")).toBe("true");
  screen.getByRole("button", { name: "遊戲規則與收集資料" }).focus();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "遊戲規則與收集資料" })));
  const dialog = screen.getByRole("dialog", { name: "遊戲規則與收集資料" });
  expect(dialog.querySelectorAll("details")).toHaveLength(6);
  await act(async () => fireEvent.keyDown(dialog, { key: "Escape" }));
  expect(screen.getByRole("button", { name: "遊戲規則與收集資料" })).toHaveFocus();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "展開側邊導覽" })));
  expect(screen.getByRole("region", { name: "遊戲規則與收集資料" })).toBeInTheDocument();
});

test("mobile navigation and quality drawers close with Escape and export navigation reveals original exports", async () => {
  await renderWorkspace("/research-tools?view=ai");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "開啟研究導覽" })));
  const navigation = screen.getByRole("dialog", { name: "研究導覽" });
  expect(within(navigation).getAllByRole("tab")).toHaveLength(5);
  expect(within(navigation).getByRole("region", { name: "遊戲規則與收集資料" })).toBeInTheDocument();
  await act(async () => fireEvent.click(within(navigation).getByRole("tab", { name: "研究統計" })));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "研究統計" })).toHaveAttribute("aria-selected", "true");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "開啟資料品質詳情" })));
  const quality = screen.getByRole("dialog", { name: "資料品質詳情" });
  expect(quality).toHaveTextContent("缺失欄位");
  await act(async () => fireEvent.keyDown(quality, { key: "Escape" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "研究資料匯出" })));
  expect(screen.getByRole("tab", { name: "研究總覽" })).toHaveAttribute("aria-selected", "true");
  expect(container.querySelector("#research-09")).toHaveFocus();
});

test("an unavailable primary source exposes a retry instead of an empty analysis", async () => {
  getResearchFeatureInputsFromCloud.mockRejectedValueOnce(new Error("unavailable"));
  await renderWorkspace(); expect(screen.getByRole("alert")).toHaveTextContent("資料尚未就緒"); expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "重新整理資料" })));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  expect(getResearchFeatureInputsFromCloud).toHaveBeenCalledTimes(2);
});
