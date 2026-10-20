import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import HatStickerGamePage from "../pages/HatStickerGamePage";
import { startTemporaryGameTesting } from "./runtime";

test("directly plays hat round five, previews a reward and never changes real collections", async () => {
  jest.useFakeTimers();
  localStorage.setItem("hatStickerCollection_real-child", "original");
  const localBefore = { ...localStorage };
  const sessionBefore = { ...sessionStorage };
  startTemporaryGameTesting();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let randomIndex = 0;
  const random = jest.spyOn(Math, "random").mockImplementation(() => {
    randomIndex += 1;
    // Sticker/answer choose index 0. Six swaps between slots 0 and 6 end
    // back at slot 0.
    return randomIndex <= 2 || randomIndex % 2 === 1 ? 0 : 0.99;
  });
  try {
    await act(async () => root.render(
      <MemoryRouter initialEntries={[{ pathname: "/hat-sticker-game", search: "?round=5&gameTesting=1", state: { rewardSessionId: "qa-round-5" } }]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HatStickerGamePage />
      </MemoryRouter>
    ));
    expect(screen.getAllByRole("button", { name: /選擇第/ })).toHaveLength(7);
    act(() => fireEvent.click(screen.getByRole("button", { name: /開始/ })));
    await act(async () => jest.advanceTimersByTime(3000));
    for (let index = 0; index < 6; index += 1) {
      await act(async () => jest.advanceTimersByTime(440));
    }
    await act(async () => jest.advanceTimersByTime(250));
    act(() => fireEvent.click(screen.getByRole("button", { name: "選擇第 1 頂帽子" })));
    expect(screen.getAllByText(/你獲得了「蜂蜜小熊」/).length).toBeGreaterThan(0);
    expect({ ...localStorage }).toEqual(localBefore);
    expect({ ...sessionStorage }).toEqual(sessionBefore);
  } finally {
    act(() => root.unmount());
    container.remove();
    random.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});
