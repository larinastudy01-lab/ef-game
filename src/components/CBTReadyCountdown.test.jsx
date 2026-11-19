import React, { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import CBTReadyCountdown from "./CBTReadyCountdown";

beforeEach(() => jest.useFakeTimers());
afterEach(() => { cleanup(); jest.useRealTimers(); });

test("shows every number for a full second and completes once in StrictMode", () => {
  const onComplete = jest.fn();
  render(<StrictMode><CBTReadyCountdown onComplete={onComplete} /></StrictMode>);
  for (const count of [5, 4, 3, 2, 1]) {
    expect(screen.getByRole("timer")).toHaveTextContent(String(count));
    act(() => jest.advanceTimersByTime(999));
    expect(screen.getByRole("timer")).toHaveTextContent(String(count));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
  }
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("0")).toBeNull();
  act(() => jest.advanceTimersByTime(10000));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test("uses the latest callback without restarting and cancels on unmount", () => {
  const previous = jest.fn();
  const latest = jest.fn();
  const { rerender, unmount } = render(<CBTReadyCountdown onComplete={previous} />);
  act(() => jest.advanceTimersByTime(1000));
  rerender(<CBTReadyCountdown onComplete={latest} />);
  for (let second = 0; second < 4; second += 1) act(() => jest.advanceTimersByTime(1000));
  expect(previous).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledTimes(1);
  unmount();

  const cancelled = jest.fn();
  const view = render(<CBTReadyCountdown onComplete={cancelled} />);
  act(() => jest.advanceTimersByTime(1000));
  view.unmount();
  act(() => jest.advanceTimersByTime(10000));
  expect(cancelled).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
