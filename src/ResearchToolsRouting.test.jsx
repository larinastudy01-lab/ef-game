/* React 18 createRoot is managed explicitly so these DOM-level integration tests need act.
 * Direct DOM access verifies disclosure structure and focus anchors. */
/* eslint-disable testing-library/no-dom-import, testing-library/no-unnecessary-act, testing-library/no-node-access */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { screen } from "@testing-library/dom";
import App from "./App";

jest.mock("./components/ProtectedRoute", () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock("./components/ResultSyncStatus", () => () => null);
jest.mock("./pages/HomePage", () => () => <main>首頁</main>);
jest.mock("./pages/ResearchTools", () => () => <main>五合一研究工作台</main>);

test.each([["research-statistics", "statistics"], ["ai-behavioral-analysis", "ai"], ["adaptive-recommendation-research", "adaptive"], ["longitudinal-dashboard", "longitudinal"], ["research-professional-dashboard", "overview"]])("legacy %s bookmarks resolve to their integrated tab", async (path, view) => {
  window.history.replaceState(null, "", `/${path}`);
  const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
  try { await act(async () => root.render(<App/>)); expect(await screen.findByText("五合一研究工作台")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "開啟設定" })).not.toBeInTheDocument(); expect(container.querySelector(".app-settings-menu")).toBeNull(); expect(window.location.pathname).toBe("/research-tools"); expect(window.location.search).toBe(`?view=${view}`); }
  finally { act(() => root.unmount()); container.remove(); window.history.replaceState(null, "", "/"); }
});
