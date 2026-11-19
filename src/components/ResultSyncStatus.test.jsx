/* eslint-disable testing-library/no-dom-import, testing-library/no-unnecessary-act, testing-library/no-node-access */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen } from "@testing-library/dom";
import ResultSyncStatus from "./ResultSyncStatus";
import { getResultSyncState, retryResultStorage, startResultSync } from "../utils/resultSync";

jest.mock("../utils/resultSync", () => ({ getResultSyncState: jest.fn(), retryResultStorage: jest.fn(), startResultSync: jest.fn(), RESULT_SYNC_EVENT: "test-result-sync" }));
let root, container;
const failed = { storageError: true, storageErrorKind: "quota", storageErrorSource: "outbox:unsent", pending: 0, online: true, signedIn: true };
beforeEach(() => {
  jest.clearAllMocks();
  getResultSyncState.mockReturnValue(failed);
  startResultSync.mockReturnValue(jest.fn());
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("the quota alert remains until retry succeeds", async () => {
  retryResultStorage.mockResolvedValueOnce(failed).mockResolvedValueOnce({ ...failed, storageError: false });
  await act(async () => root.render(<ResultSyncStatus/>));
  expect(screen.getByRole("alert")).toHaveTextContent("此網站的瀏覽器儲存空間已滿");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "重試儲存" })));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "重試儲存" })));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("a display cache failure explains that the original result is retained", async () => {
  getResultSyncState.mockReturnValue({ ...failed, storageErrorSource: "cache:retained" });
  await act(async () => root.render(<ResultSyncStatus/>));
  expect(screen.getByRole("alert")).toHaveTextContent("測驗原始紀錄已保留");
  expect(screen.getByRole("alert")).toHaveTextContent("請勿清除瀏覽器資料");
});
