import { fireEvent, render, screen, within } from "@testing-library/react";
import { RewardSimulation } from "./RewardSimulation";
import { largestComparableCount, ObservationResults } from "./ObservationResults";
import { runPolicySimulation } from "../../analytics/recommendation";
import { ResearchQualityPanel } from "../research/ResearchQualityPanel";
import { ResearchTrendChart } from "../research/ResearchPresentation";
import { ProfessionalRecords } from "./ProfessionalRecords";

jest.mock("recharts", () => {
  const React = require("react");
  const wrapper = ({ children }) => <div>{children}</div>;
  return { ResponsiveContainer: wrapper, LineChart: ({ data, children }) => <div data-testid="reward-chart" data-values={JSON.stringify(data)}>{children}</div>,
    CartesianGrid: () => null, Legend: () => null, ReferenceLine: () => null, XAxis: () => null,
    YAxis: ({ domain, ticks }) => <span data-testid="axis" data-domain={JSON.stringify(domain)} data-ticks={JSON.stringify(ticks)}/>,
    Tooltip: ({ formatter }) => <span data-testid="tooltip">{formatter(.123456, "UCB1").join(" ")}</span>,
    Line: ({ name }) => <span data-testid="series">{name}</span> };
});
const record = (id = "a", overrides = {}) => ({ id, participantId: "p", gameKey: "PM", type: "test", difficulty: "medium", date: "2026-11-01T00:00:00Z", raw: { status: "completed", protocolVersion: "fixture-v1" }, trials: [{ isCorrect: true, reactionTime: 400 }], ...overrides });

test("Reward defaults to UCB1, enables all six, selects round range and formats raw tooltip", () => {
  render(<RewardSimulation simulation={runPolicySimulation({ rounds: 120, seed: 20260730 })} rounds={120} seed={20260730}/>);
  expect(screen.getAllByRole("checkbox")).toHaveLength(6);
  expect(screen.getAllByTestId("series").map((e) => e.textContent)).toEqual(["UCB1"]);
  expect(screen.getByTestId("axis")).toHaveAttribute("data-domain", "[0,1]");
  expect(screen.getByTestId("axis")).toHaveAttribute("data-ticks", "[0,0.25,0.5,0.75,1]");
  expect(screen.getByTestId("tooltip")).toHaveTextContent("0.1235 UCB1");
  fireEvent.click(screen.getByRole("checkbox", { name: "Random" }));
  expect(screen.getAllByTestId("series")).toHaveLength(2);
  fireEvent.change(screen.getByRole("spinbutton", { name: "起始回合" }), { target: { value: "50" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "結束回合" }), { target: { value: "55" } });
  const data = JSON.parse(screen.getByTestId("reward-chart").getAttribute("data-values"));
  expect(data.map((r) => r.round)).toEqual([50, 51, 52, 53, 54, 55]);
});
test("sparse and incomparable results keep detail access and never create a chart", () => {
  const records = [record("a"), record("b")];
  expect(largestComparableCount(records)).toBe(2);
  expect(largestComparableCount([record("a"), record("b", { difficulty: "hard" })])).toBe(1);
  const { rerender } = render(<ObservationResults observations={[{ record: records[0] }]}/>);
  expect(screen.getByRole("heading", { name: "單次結果" })).toBeInTheDocument();
  rerender(<ResearchTrendChart metric="accuracy" data={records.map((r) => ({ accuracy: 1, professionalRecord: r, session_completion_status: "completed" }))}/>);
  expect(screen.getByRole("heading", { name: "兩次結果比較・描述性資料" })).toBeInTheDocument();
  expect(screen.queryByTestId("reward-chart")).not.toBeInTheDocument();
});
test("zero results show a reason while three comparable valid results enable the descriptive chart", () => {
  const { rerender } = render(<ResearchTrendChart metric="accuracy" data={[]}/>);
  expect(screen.getByRole("heading", { name: "尚無符合條件的有效紀錄" })).toBeInTheDocument();
  expect(screen.queryByTestId("reward-chart")).not.toBeInTheDocument();
  rerender(<ResearchTrendChart metric="accuracy" data={[1,2,3].map((id) => ({ accuracy: .5, professionalRecord: record(String(id)), session_completion_status: "completed" }))}/>);
  expect(screen.getByTestId("reward-chart")).toBeInTheDocument();
  expect(screen.getByText(/描述性資料。X 軸/)).toBeInTheDocument();
});
test("quality issues group by task without putting UUID in the default row and explain LB ambiguity", () => {
  render(<ResearchQualityPanel issues={[{ resultId: "secret-uuid", gameId: "LB", mode: "training", code: "DUPLICATE_SOURCE_KEY", message: "duplicate source key 1-4-5" }]}/>);
  const table = screen.getByRole("region", { name: "待檢查的歷史紀錄表格" });
  expect(within(table).getByText("待人工確認")).toBeInTheDocument();
  const uuid = within(table).getByText("secret-uuid");
  // Disclosure ancestry is the behavior under test: UUIDs stay inside a closed details element.
  // eslint-disable-next-line testing-library/no-node-access
  expect(uuid.closest("details")).not.toHaveAttribute("open");
  expect(table).toHaveTextContent("多次合法操作"); expect(table).toHaveTextContent("原始資料保留");
  expect(table).toHaveTextContent("1／1");
});
test("incomplete records retain actual planned count, compact operations and source-specific difficulty", () => {
  const r = record("partial", { gameName: "圖片記憶", difficulty: "adaptive_span_test", raw: { status: "interrupted", plannedTotalRounds: 3 }, trials: [{ isCorrect: true }, { isCorrect: false }] });
  const open = jest.fn(), toggle = jest.fn(), exportRecord = jest.fn();
  render(<ProfessionalRecords records={[r]} selectedIds={[]} onToggle={toggle} onOpen={open} onExport={exportRecord}/>);
  const table = screen.getByRole("table");
  expect(table).toHaveTextContent("未完成"); expect(table).toHaveTextContent("2／3 題已記錄");
  expect(table).toHaveTextContent("適性廣度測驗"); expect(table).toHaveTextContent("無有效反應");
  fireEvent.click(within(table).getByRole("checkbox")); expect(toggle).toHaveBeenCalledWith("partial");
  fireEvent.click(within(table).getByRole("button", { name: "查看詳細" })); expect(open).toHaveBeenCalledWith(r);
  fireEvent.click(within(table).getByRole("button", { name: "Excel" })); expect(exportRecord).toHaveBeenCalledWith(r);
});
