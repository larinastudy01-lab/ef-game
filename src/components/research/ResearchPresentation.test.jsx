import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen } from "@testing-library/dom";
import { ResearchAlerts, ResearchHandoff, ResearchPage, ResearchTrendChart } from "./ResearchPresentation";
import { buildResearchTaskContext } from "../../utils/researchPresentation";

jest.mock("recharts", () => {
  const React = require("react");
  const wrapper = ({ children }) => <div>{children}</div>;
  return { ResponsiveContainer: wrapper, LineChart: ({ data, children }) => <div data-testid="chart-data" data-values={JSON.stringify(data)}>{children}</div>,
    CartesianGrid: () => null, Legend: () => null, ReferenceLine: () => null, Tooltip: () => null, XAxis: () => null,
    YAxis: ({ domain, unit }) => <span data-testid="y-axis" data-domain={JSON.stringify(domain)} data-unit={unit}/>,
    Line: ({ connectNulls }) => <span data-testid="chart-line" data-connected={String(connectNulls)}/> };
});

let container, root;
beforeEach(() => { localStorage.clear(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (element) => act(() => root.render(element));
const critical = { id: "clinical-rule", title: "來源規則警示", severity: "critical", message: "由已驗證的外部規則提供", validatedClinicalRule: true,
  ruleId: "test-rule", ruleVersion: "v1", thresholdLabel: "測試規則，非臨床數值", observationVersion: "observation-1" };

test("critical rules require explicit acknowledgement and a changed observation needs acknowledgement again", () => {
  render(<ResearchAlerts alerts={[{ ...critical, severity: "info", id: "info" }, critical]}/>);
  expect(screen.getByRole("alert")).toHaveTextContent("危急警示");
  act(() => fireEvent.click(screen.getByRole("button", { name: "確認危急警示" })));
  expect(screen.getByRole("button", { name: "本頁已確認" })).toBeDisabled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  render(<ResearchAlerts alerts={[{ ...critical, observationVersion: "observation-2" }]}/>);
  expect(screen.getByRole("button", { name: "確認危急警示" })).toBeEnabled();
});

test("unvalidated rules cannot create a critical alert or acknowledgement control", () => {
  render(<ResearchAlerts alerts={[{ ...critical, validatedClinicalRule: false }]}/>);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("待核對");
});

test("dark mode persists when another research page mounts", () => {
  render(<ResearchPage className="xai-page">內容</ResearchPage>);
  act(() => fireEvent.click(screen.getByRole("button", { name: "暗色模式" })));
  expect(screen.getByRole("main")).toHaveAttribute("data-research-theme", "dark");
  render(<ResearchPage key="next-page" className="long-page">另一頁</ResearchPage>);
  expect(screen.getByRole("button", { name: "暗色模式" })).toHaveAttribute("aria-pressed", "true");
});

test("accuracy charts use a complete percentage scale and preserve invalid observations as gaps", () => {
  render(<ResearchTrendChart metric="accuracy" data={[{ accuracy: .5 }, { accuracy: null }, { accuracy: 2 }]}/>);
  expect(screen.getByTestId("y-axis")).toHaveAttribute("data-domain", "[0,1]");
  expect(JSON.parse(screen.getByTestId("chart-data").getAttribute("data-values")).map((item) => item.accuracy)).toEqual([.5, null, null]);
  expect(screen.getByTestId("chart-line")).toHaveAttribute("data-connected", "false");
});

test("generated summaries express rate differences as percentage points and disclose missing current values", () => {
  const context = buildResearchTaskContext([1, 2].map((day) => ({ participant_id: "a", task_code: "CBT", assessment_or_training: "assessment", difficulty: 1,
    session_started_at: `2026-10-0${day}`, accuracy: day === 1 ? .5 : .8, rt_mean: day === 1 ? 400 : null })), "CBT");
  render(<ResearchHandoff context={context} taskLabel="CBT"/>);
  expect(screen.getByRole("region", { name: "資料摘要" })).toHaveTextContent("增加 30.0 個百分點");
  expect(screen.getByRole("region", { name: "資料摘要" })).toHaveTextContent("最新 — ms");
});
