import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./pages/HomePage", () => function MockHomePage() {
  return <main>首頁</main>;
});

test("renders the home route", async () => {
  render(<App />);

  expect(screen.getByText("載入中...")).toBeInTheDocument();
  expect(await screen.findByText("首頁")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /背景音樂/ })
  ).toBeInTheDocument();
});
