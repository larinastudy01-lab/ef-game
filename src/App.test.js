import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen } from "@testing-library/dom";
import App from "./App";

jest.mock("./components/ResultSyncStatus", () => () => null);

jest.mock("./pages/HomePage", () => function MockHomePage() {
  return <main>首頁</main>;
});

test("renders the home route", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<App />);
  });

  expect(await screen.findByText("首頁")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "開啟設定" })).toBeInTheDocument();

  await act(async () => {
    screen.getByRole("button", { name: "開啟設定" }).click();
  });

  expect(screen.getByRole("button", { name: "關閉背景音樂" })).toBeInTheDocument();

  act(() => root.unmount());
  container.remove();
});

test("typing ... opens the QA menu and non-game navigation stays inside it", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<App />); });
  await act(async () => {
    fireEvent.keyDown(document.body, { key: "." });
    fireEvent.keyDown(document.body, { key: "." });
    fireEvent.keyDown(document.body, { key: "." });
  });
  expect(await screen.findByRole("heading", { name: "遊戲測試選單" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "開啟測驗" })).toHaveLength(6);
  expect(screen.getByRole("link", { name: "結束測試" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("button", { name: "開啟設定" })).not.toBeInTheDocument();
  await act(async () => {
    window.history.pushState(null, "", "/parent-results");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(await screen.findByRole("heading", { name: "遊戲測試選單" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/game-testing");
  expect(window.location.search).toBe("?gameTesting=1");
  act(() => root.unmount());
  container.remove();
});
