import { act } from "react";
import { createRoot } from "react-dom/client";
import { screen } from "@testing-library/dom";
import App from "./App";

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
  expect(
    screen.getByRole("button", { name: /背景音樂/ })
  ).toBeInTheDocument();

  act(() => root.unmount());
  container.remove();
});
