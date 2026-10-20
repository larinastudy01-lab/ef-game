/* React 18 createRoot is managed explicitly so these DOM-level integration tests need act.
 * Direct DOM access verifies disclosure structure and focus anchors. */
/* eslint-disable testing-library/no-dom-import, testing-library/no-unnecessary-act, testing-library/no-node-access */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen, within } from "@testing-library/dom";
import { ModelStatusCard, ResearchDataTable, ResearchDrawer, ResearchTimeline } from "./ResearchStudioUI";

let root, container;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (element) => act(() => root.render(element));

test("table sorting and searching operate on display copies and retain missing observations", () => {
  const rows = Object.freeze([Object.freeze({ name: "CBT", value: 20 }), Object.freeze({ name: "PM", value: null }), Object.freeze({ name: "ARI", value: 3 })]);
  const original = JSON.stringify(rows);
  render(<ResearchDataTable title="數值" rows={rows} columns={[{ key: "name", label: "任務" }, { key: "value", label: "數值", numeric: true }]}/>);
  act(() => fireEvent.click(screen.getByRole("button", { name: "數值" })));
  const table = screen.getByRole("region", { name: "數值表格" });
  expect(within(table).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual(["ARI3", "CBT20", "PM—"]);
  expect(screen.getByRole("columnheader", { name: "數值" })).toHaveAttribute("aria-sort", "ascending");
  act(() => fireEvent.change(screen.getByRole("searchbox", { name: "數值搜尋" }), { target: { value: "PM" } }));
  expect(within(table).getAllByRole("row")).toHaveLength(2); expect(table).toHaveTextContent("PM—"); expect(JSON.stringify(rows)).toBe(original);
});

test("drawer traps keyboard focus, closes with Escape and restores the invoking control", () => {
  const opener = document.createElement("button"); document.body.appendChild(opener); opener.focus();
  const close = jest.fn(); render(<ResearchDrawer title="測試面板" onClose={close}><button type="button">最後操作</button></ResearchDrawer>);
  const dialog = screen.getByRole("dialog", { name: "測試面板" }); expect(dialog).toHaveFocus();
  const last = screen.getByRole("button", { name: "最後操作" }); last.focus();
  act(() => fireEvent.keyDown(last, { key: "Tab" })); expect(screen.getByRole("button", { name: "關閉測試面板" })).toHaveFocus();
  act(() => fireEvent.keyDown(dialog, { key: "Escape" })); expect(close).toHaveBeenCalledTimes(1);
  render(null); expect(opener).toHaveFocus(); opener.remove();
});

test("model progress reports observed participant readiness and never presents it as accuracy", () => {
  render(<ModelStatusCard count={7}/>);
  expect(screen.getByRole("progressbar", { name: "模型資料準備進度" })).toHaveAttribute("value", "7");
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "20");
  expect(screen.getByText(/尚缺 13 位/)).toBeInTheDocument(); expect(screen.getByText(/不是模型準確率/)).toBeInTheDocument();
});

test("record details expose the existing trial-level fields without adding values", () => {
  render(<ResearchTimeline events={[{ event_id: "task:t1", event_type: "Task", task_session_id: "t1", task_code: "ARI", occurred_at: "2026-10-01" }]} inputs={[{ taskSession: { id: "t1" }, trials: [{ trial_index: 1, reaction_time_ms: null, is_correct: null, valid_trial: false, exclusion_reasons: ["timeout"] }] }]}/>);
  act(() => fireEvent.click(screen.getByRole("button", { name: /詳情/ })));
  const dialog = screen.getByRole("dialog", { name: "研究事件詳情" }); expect(dialog).toHaveTextContent("timeout");
  expect(within(dialog).getByRole("region", { name: "題次紀錄表格" })).toHaveTextContent("已排除");
  expect(within(dialog).getByRole("region", { name: "題次紀錄表格" })).toHaveTextContent("—");
});
