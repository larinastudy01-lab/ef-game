import { fireEvent, render, screen, within } from "@testing-library/react";
import { ResearchDataExports } from "./ResearchDataExports";
import { downloadResearchFile } from "../../analytics/researchDashboard";
import { buildUnifiedResearchExport } from "../../analytics/reproducibility";

jest.mock("../../analytics/researchDashboard", () => ({ ...jest.requireActual("../../analytics/researchDashboard"), downloadResearchFile: jest.fn() }));
const source = (participantId, answer) => ({ participantId, sessionId: `session-${participantId}`,
  taskSession: { id: `task-${participantId}`, task_code: "ARI" }, sessionMetadata: { assessment_or_training: "assessment" },
  rawTrials: [{ id: `trial-${participantId}`, trial_index: 1,
    raw_data: { soundType: "cat", expectedTarget: "dog", selectedTarget: answer, isCorrect: false, reactionTime: 0, timeout: false } }] });

test("preview and Excel exports follow the current scope and preserve acquisition values", () => {
  const sources = [source("a", "cat"), source("b", "dog")]; const before = JSON.stringify(sources);
  const props = (inputs) => ({ inputs, taskRows: inputs.map((input) => ({ participant_id: input.participantId, task_code: "ARI", accuracy: 0 })),
    exportBundle: buildUnifiedResearchExport({ inputs }) });
  const { rerender } = render(<ResearchDataExports {...props([sources[0]])}/>);
  fireEvent.click(screen.getByText("預覽逐題作答資料"));
  const table = screen.getByRole("region", { name: "原始逐題作答表格" });
  expect(within(table).getByText("錯誤")).toBeInTheDocument();
  expect(within(table).getByText("0")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "逐題作答資料（CSV）" }));
  expect(downloadResearchFile).toHaveBeenLastCalledWith("逐題作答資料.csv", expect.stringContaining("a,session-a,task-a"));
  expect(downloadResearchFile.mock.calls.at(-1)[1].startsWith("\uFEFF")).toBe(true);
  rerender(<ResearchDataExports {...props([sources[1]])}/>);
  fireEvent.click(screen.getByRole("button", { name: "逐題作答資料（CSV）" }));
  expect(downloadResearchFile.mock.calls.at(-1)[1]).toContain("b,session-b,task-b");
  expect(downloadResearchFile.mock.calls.at(-1)[1]).not.toContain("a,session-a,task-a");
  expect(JSON.stringify(sources)).toBe(before);
});

test("missing raw data disables trial export while keeping field documentation available", () => {
  render(<ResearchDataExports inputs={[]} taskRows={[]} exportBundle={buildUnifiedResearchExport()}/>);
  expect(screen.getByRole("button", { name: "逐題作答資料（CSV）" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "場次摘要（CSV）" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "欄位說明（CSV）" })).toBeEnabled();
});
