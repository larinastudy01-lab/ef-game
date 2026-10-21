import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import GameTestingMenu from "./GameTestingMenu";

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

test("lists six assessments, all 30 training levels, and all five hat rounds", () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><GameTestingMenu /><Location /></MemoryRouter>);
  expect(screen.getAllByRole("button", { name: "開啟測驗" })).toHaveLength(6);
  const cards = screen.getAllByRole("article");
  expect(cards).toHaveLength(7);
  expect(cards.map((card) => within(card).getAllByRole("button").length)).toEqual([6, 6, 6, 6, 6, 6, 5]);
  fireEvent.click(within(cards[4]).getByRole("button", { name: "05 專業" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/training-linking-balloons?level=5&difficulty=expert&gameTesting=1");
  fireEvent.click(within(cards[5]).getByRole("button", { name: "05 專業" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/training-dccs?level=5&difficulty=expert&gameTesting=1");
  fireEvent.click(within(cards[3]).getByRole("button", { name: "05 專業" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/training-ari?level=5&difficulty=expert&gameTesting=1");
  fireEvent.click(within(cards[6]).getByRole("button", { name: "第 5 關 · 7 頂帽子" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/hat-sticker-game?round=5&gameTesting=1");
});
