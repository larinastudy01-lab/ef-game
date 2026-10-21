import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ResultPagePA from "./ResultPage_PA";
import ClinicianDashboard from "./ClinicianDashboard";

jest.mock("../lib/supabaseClient", () => ({ supabase: { auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() }, from: jest.fn() } }));
jest.mock("../lib/database", () => ({ getResultsByPatientFromCloud: jest.fn().mockResolvedValue([]) }));

const session = { access_token: "synthetic-token", user: { id: "registered-user", email: "registered@example.invalid" } };
const emailCalls = () => global.fetch.mock.calls.filter(([url]) => url === "/api/assistant-email");

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
  supabase.auth.getUser.mockResolvedValue({ data: { user: session.user }, error: null });
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  supabase.from.mockImplementation((table) => {
    const rows = table === "clinician_patient_access" ? [{ patient_id: "child-1" }]
      : table === "patients" ? [{ id: "child-1", nickname: "測試個案", birth_date: "2018-01-01" }] : [];
    const query = {
      select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; },
      single: async () => ({ data: { id: session.user.id, full_name: "王醫師", role: "doctor" }, error: null }),
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    };
    return query;
  });
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => url === "/api/assistant-email"
    ? { status: "accepted", recipient: session.user.email }
    : { answer: "測試個案目前資料不足以判斷長期趨勢。", sources: [{ id: "source-1", title: "測試來源", url: "https://example.invalid/source" }], ragUsed: true } }));
});
afterEach(() => { jest.clearAllMocks(); delete global.fetch; });

test("parent chat sends the completed local answer only when that question opts in", async () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[{
    pathname: "/result-pa", state: { childId: "child-1", childName: "測試兒童", gameId: "PM", resultData: { accuracy: 80 } },
  }]}><ResultPagePA /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "開啟 AI 小助手" }));
  const checkbox = await screen.findByRole("checkbox", { name: "本次問答自動寄至註冊信箱" });
  await waitFor(() => expect(checkbox).toBeEnabled());
  fireEvent.click(checkbox);
  fireEvent.change(screen.getByRole("textbox", { name: "輸入想問 AI 小助手的問題" }), { target: { value: "本次正確率是多少？" } });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  await screen.findByText(/已交寄至 registered@example.invalid/);
  expect(emailCalls()).toHaveLength(1);
  const mailed = JSON.parse(emailCalls()[0][1].body);
  expect(mailed.question).toBe("本次正確率是多少？");
  expect(mailed.answer).toContain("80%");
  expect(checkbox).not.toBeChecked();
  fireEvent.change(screen.getByRole("textbox", { name: "輸入想問 AI 小助手的問題" }), { target: { value: "下次怎麼練？" } });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  expect(screen.getByText("本次未寄送")).toBeInTheDocument();
  expect(emailCalls()).toHaveLength(1);
});

test("clinical quick questions mail the returned answer and sources, and reset the next question to opt-out", async () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ClinicianDashboard /></MemoryRouter>);
  await screen.findByText("您好，王醫師");
  fireEvent.click(screen.getByRole("button", { name: "AI 小助手" }));
  const checkbox = await screen.findByRole("checkbox", { name: "本次問答自動寄至註冊信箱" });
  await waitFor(() => expect(checkbox).toBeEnabled());
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "最近一次結果" }));
  await screen.findByText(/已交寄至 registered@example.invalid/);
  const mailed = JSON.parse(emailCalls()[0][1].body);
  expect(mailed.question).toBe("請告訴我最近一次測驗或訓練結果");
  expect(mailed.answer).toBe("測試個案目前資料不足以判斷長期趨勢。");
  expect(mailed.sources[0].title).toBe("測試來源");
  expect(checkbox).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "比較兩次測驗" }));
  await screen.findByText("本次未寄送");
  expect(emailCalls()).toHaveLength(1);
});
