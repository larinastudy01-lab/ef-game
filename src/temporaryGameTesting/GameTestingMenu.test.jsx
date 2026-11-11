import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import GameTestingMenu from "./GameTestingMenu";

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

test("lists six assessments, all copies, all 30 training levels, and all five hat rounds", () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><GameTestingMenu /><Location /></MemoryRouter>);
  expect(screen.getAllByRole("button", { name: "開啟測驗" })).toHaveLength(6);
  const cards = screen.getAllByRole("article");
  expect(cards).toHaveLength(7);
  expect(cards.map((card) => within(card).getAllByRole("button").length)).toEqual([8, 8, 8, 8, 8, 8, 5]);
  expect(screen.getByText(/12 個測驗副本/)).toBeInTheDocument();
  fireEvent.click(within(cards[4]).getByRole("button", { name: "05 專業" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/training-linking-balloons?level=5&difficulty=expert&gameTesting=1");
  fireEvent.click(within(cards[5]).getByRole("button", { name: "05 專業" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/training-dccs?level=5&difficulty=expert&gameTesting=1");
  fireEvent.click(within(cards[3]).getByRole("button", { name: "05 專業" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/training-ari?level=5&difficulty=expert&gameTesting=1");
  fireEvent.click(within(cards[6]).getByRole("button", { name: "第 5 關 · 7 頂帽子" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/hat-sticker-game?round=5&gameTesting=1");
});

test.each([
  ["SRT", "01 葡萄", "srt", "01"],
  ["SRT", "02 蘋果", "srt", "02"],
  ["CBT", "01 荷葉", "cbt", "01"],
  ["CBT", "02 木塊", "cbt", "02"],
  ["LB", "01 石頭", "linking-balloons", "01"],
  ["LB", "02 信箱", "linking-balloons", "02"],
  ["DCCS", "01 褲子／襪子", "dccs", "01"],
  ["DCCS", "02 拖鞋／圍巾", "dccs", "02"],
  ["PM", "01 交通工具／穿戴配件", "picture-memory", "01"],
  ["PM", "02 交通工具／家具", "picture-memory", "02"],
  ["ARI", "01 小豬／綿羊", "ari", "01"],
  ["ARI", "02 乳牛／猴子", "ari", "02"],
])("%s %s opens the selected copy in isolated testing mode", (game, label, slug, version) => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><GameTestingMenu /><Location /></MemoryRouter>);
  fireEvent.click(within(screen.getByRole("group", { name: `${game} 測驗副本` })).getByRole("button", { name: label }));
  expect(screen.getByTestId("location")).toHaveTextContent(`/test-${slug}?testVersion=${version}&gameTesting=1`);
});
