import React, { act } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ClinicianDashboard from "./ClinicianDashboard";
import { supabase } from "../lib/supabaseClient";

jest.mock("../lib/supabaseClient", () => ({ supabase: { auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() }, from: jest.fn() } }));
let owner, authCallback, saveNote;
const patientRows = [{ id: "p1", nickname: "個案甲" }, { id: "p2", nickname: "個案乙" }];
const gameRows = ["SRT", "PM", "CBT", "ARI", "DCCS", "LB"].map((game_id, index) => ({
  id: `r${index}`, patient_id: "p1", game_id, mode: "test", difficulty: "normal", created_at: "2026-11-01",
  payload: { session: { status: "completed", mode: "test", difficulty: "normal" }, rawResult: { protocolVersion: "fixture-v1" },
    trials: [{ isCorrect: false, reactionTime: 500, targetType: "normal", action: "miss", memorySpan: 3 }] },
}));
beforeEach(() => {
  owner = "doctor-a"; localStorage.clear(); sessionStorage.clear(); window.confirm = jest.fn(() => true);
  window.HTMLElement.prototype.scrollIntoView = jest.fn(); saveNote = jest.fn().mockResolvedValue({ data: null, error: { message: "offline" } });
  supabase.auth.getUser.mockImplementation(async () => ({ data: { user: { id: owner } } }));
  supabase.auth.getSession.mockImplementation(async () => ({ data: { session: { user: { id: owner }, access_token: "fixture" } } }));
  supabase.auth.onAuthStateChange.mockImplementation((fn) => { authCallback = fn; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
  supabase.from.mockImplementation((table) => {
    let inserted = false;
    const rows = owner === "doctor-a" ? table === "patients" ? patientRows : table === "game_results" ? gameRows : table === "clinician_patient_access" ? patientRows.map((p) => ({ patient_id: p.id })) : [] : [];
    const query = { select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; }, insert() { inserted = true; return this; },
      single: () => inserted ? saveNote() : Promise.resolve({ data: { id: owner, full_name: owner, role: "doctor" }, error: null }),
      then: (resolve) => Promise.resolve({ data: rows, error: null }).then(resolve) };
    return query;
  });
});
afterEach(() => jest.clearAllMocks());
const mount = async () => { render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ClinicianDashboard/></MemoryRouter>); await screen.findByText("您好，doctor-a"); };
const openTab = (name) => fireEvent.click(within(screen.getByRole("navigation", { name: "個案資料選單" })).getByRole("button", { name }));

test("six task summaries remain neutral about low performance and all task/type filters still reach the default eight-column table", async () => {
  await mount();
  expect(screen.getByRole("heading", { name: "蒐秘密｜專業分析平台" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 4 }).filter((h) => ["松鼠接橡實", "圖片記憶", "跳石橋", "動物聲音辨識", "衣物分類", "幫助迷路的綿羊奶奶"].includes(h.textContent))).toHaveLength(6);
  expect(screen.queryByText("高度關注")).not.toBeInTheDocument(); expect(screen.queryByText("正常追蹤")).not.toBeInTheDocument();
  openTab(/紀錄與比較/);
  const table = screen.getByRole("table"); expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
  expect(within(table).getAllByRole("row")).toHaveLength(7);
  fireEvent.click(screen.getByRole("button", { name: /全選篩選結果/ }));
  expect(within(table).getAllByRole("checkbox").every((item) => item.checked)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "清除", exact: true }));
  expect(within(table).getAllByRole("checkbox").every((item) => !item.checked)).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /CBT 跳石橋/ }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "清除篩選" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(7);
});

test("a failed note save keeps the draft and does not create a pretend saved note; switching patients restores the correct draft", async () => {
  await mount(); openTab(/個案工具/);
  fireEvent.change(screen.getByRole("textbox", { name: "醫療備註草稿" }), { target: { value: "這是甲的人工觀察" } });
  fireEvent.click(screen.getByRole("button", { name: "儲存備註" }));
  await screen.findByText(/儲存失敗，草稿已保留：offline/);
  expect(screen.getByRole("textbox", { name: "醫療備註草稿" })).toHaveValue("這是甲的人工觀察");
  expect(screen.getByText("尚無已儲存的醫療備註。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /個案乙/ })); expect(window.confirm).toHaveBeenCalledTimes(1);
  openTab(/個案工具/); expect(screen.getByRole("textbox", { name: "醫療備註草稿" })).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: /個案甲/ })); openTab(/個案工具/);
  expect(screen.getByRole("textbox", { name: "醫療備註草稿" })).toHaveValue("這是甲的人工觀察");
});

test("an account change clears selected patient data and ignores a late note response from the previous owner", async () => {
  let finish; saveNote.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await mount(); openTab(/個案工具/);
  fireEvent.change(screen.getByRole("textbox", { name: "醫療備註草稿" }), { target: { value: "舊帳號的敏感草稿" } });
  fireEvent.click(screen.getByRole("button", { name: "儲存備註" })); await waitFor(() => expect(saveNote).toHaveBeenCalledTimes(1));
  owner = "doctor-b";
  await act(async () => authCallback("SIGNED_IN", { user: { id: owner } }));
  await screen.findByText("您好，doctor-b");
  await act(async () => finish({ data: { id: "old-note", patient_id: "p1", note: "舊帳號的敏感草稿" }, error: null }));
  expect(screen.queryByText("個案甲")).not.toBeInTheDocument(); expect(screen.queryByDisplayValue("舊帳號的敏感草稿")).not.toBeInTheDocument();
});
