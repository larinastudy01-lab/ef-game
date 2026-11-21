import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "./LoginPage";
import ChildSelectPage from "./ChildSelectPage";
import ParentResultsPage from "./ParentResultsPage";
import { supabase } from "../lib/supabaseClient";
import { getMyPatients, getResultsByPatientFromCloud } from "../lib/database";
import { getResultsByChild } from "../utils/resultManager";
import { getActivePatientId } from "../utils/activePatientStorage";

jest.mock("../lib/supabaseClient", () => ({ supabase: { auth: {
  signInWithPassword: jest.fn(), getSession: jest.fn(), signOut: jest.fn(), resetPasswordForEmail: jest.fn(),
}, from: jest.fn() } }));
jest.mock("../lib/database", () => ({
  getMyPatients: jest.fn(), getResultsByPatientFromCloud: jest.fn(), createMyPatient: jest.fn(), deleteMyPatient: jest.fn(), isSupabaseConfigured: () => true,
}));
jest.mock("../utils/resultManager", () => ({ getResultsByChild: jest.fn() }));
const children = [
  { id: "synthetic-child-a", nickname: "測試孩子甲", birth_date: "2020-01-01", guardian_id: "synthetic-parent" },
  { id: "synthetic-child-b", nickname: "測試孩子乙", birth_date: "2021-02-02", guardian_id: "synthetic-parent" },
];
const result = (id, mode, accuracy, status = "completed") => ({
  id, game_id: "DCCS", game_name: id, mode, accuracy, score: accuracy, stars: 3, total_trials: 10,
  finished_at: "2026-11-20T01:00:00Z", payload: { session: { status } },
});
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "synthetic-parent" } }, error: null });
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "synthetic-parent" } } }, error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: "guardian" }, error: null }) }) }) });
  getMyPatients.mockResolvedValue(children);
  getResultsByPatientFromCloud.mockResolvedValue([]);
  getResultsByChild.mockReturnValue([]);
});
function SelectedChild() { return <p>已選擇：{useLocation().state?.childId}</p>; }
function openLogin(state) {
  return render(<MemoryRouter initialEntries={[{ pathname: "/login", state }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/child-select" element={<ChildSelectPage />} />
      <Route path="/mode-select" element={<SelectedChild />} />
      <Route path="/parent-results" element={<ParentResultsPage />} />
    </Routes>
  </MemoryRouter>);
}
function openResults() { return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ParentResultsPage /></MemoryRouter>); }
function signIn() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "synthetic@example.invalid" } });
  fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: /^登入/ }));
}

test.each(["guardian", "parent"])("%s login loads children and preserves the selected child for the next page", async role => {
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { role }, error: null }) }) }) });
  openLogin(); signIn();
  const child = await screen.findByRole("button", { name: "選擇 測試孩子甲" });
  await waitFor(() => expect(child).toBeEnabled());
  fireEvent.click(child);
  expect(await screen.findByText("已選擇：synthetic-child-a")).toBeInTheDocument();
  expect(getActivePatientId()).toBe("synthetic-child-a");
});

test("continue session returns a parent to the requested results page", async () => {
  openLogin({ from: "/parent-results" });
  fireEvent.click(screen.getByRole("button", { name: /繼續上次登入/ }));
  expect(await screen.findByRole("heading", { name: "孩子的成績" })).toBeInTheDocument();
  expect(await screen.findByLabelText("孩子")).toHaveValue("synthetic-child-a");
});

test("invalid login shows a useful error and never loads children", async () => {
  supabase.auth.signInWithPassword.mockResolvedValueOnce({ data: null, error: { message: "Invalid login credentials" } });
  openLogin(); signIn();
  expect(await screen.findByText(/請確認 Email 或密碼/)).toBeVisible();
  expect(getMyPatients).not.toHaveBeenCalled();
});

test("a clinician account is rejected from the parent entry", async () => {
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: "clinician" }, error: null }) }) }) });
  openLogin(); signIn();
  expect(await screen.findByText(/醫療人員請使用/)).toBeVisible();
  expect(supabase.auth.signOut).toHaveBeenCalled();
  expect(getMyPatients).not.toHaveBeenCalled();
});

test("results keep test and training separate, exclude incomplete attempts from totals, and switch children", async () => {
  getResultsByPatientFromCloud.mockImplementation(async id => id === "synthetic-child-a"
    ? [result("甲測驗", "test", 80), result("甲訓練", "training", 60), result("甲未完成", "test", 10, "interrupted")]
    : [result("乙測驗", "test", 95)]);
  openResults();
  await screen.findByLabelText("孩子");
  fireEvent.click(screen.getByRole("button", { name: "測驗" }));
  expect(await screen.findByRole("heading", { name: "甲測驗" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "甲訓練" })).toBeNull();
  expect(screen.getByText(/已保留 10 題作答紀錄/)).toBeVisible();
  const summary = screen.getByRole("region", { name: "測試孩子甲的成績摘要" });
  expect(within(summary).getByText("1")).toBeVisible();
  expect(within(summary).getByText("80%")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "訓練" }));
  expect(screen.getByRole("heading", { name: "甲訓練" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "甲測驗" })).toBeNull();
  fireEvent.change(screen.getByLabelText("孩子"), { target: { value: "synthetic-child-b" } });
  fireEvent.click(screen.getByRole("button", { name: "測驗" }));
  expect(await screen.findByRole("heading", { name: "乙測驗" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "甲測驗" })).toBeNull();
});

test("a cloud outage shows this child's local records with an explicit notice", async () => {
  getResultsByPatientFromCloud.mockRejectedValue(new Error("Synthetic offline check"));
  getResultsByChild.mockImplementation(id => id === "synthetic-child-a" ? [result("本機甲測驗", "test", 70)] : []);
  openResults();
  await screen.findByLabelText("孩子");
  fireEvent.click(screen.getByRole("button", { name: "測驗" }));
  expect(await screen.findByRole("heading", { name: "本機甲測驗" })).toBeVisible();
  expect(screen.getByText(/雲端成績暫時無法同步/)).toBeVisible();
  expect(getResultsByChild).toHaveBeenCalledWith("synthetic-child-a");
});

test("an older child request cannot replace the newly selected child's records", async () => {
  let finishFirst;
  getResultsByPatientFromCloud.mockImplementation(id => id === "synthetic-child-a"
    ? new Promise(resolve => { finishFirst = resolve; }) : Promise.resolve([result("乙最新測驗", "test", 90)]));
  openResults();
  await screen.findByLabelText("孩子");
  await waitFor(() => expect(getResultsByPatientFromCloud).toHaveBeenCalledWith("synthetic-child-a"));
  fireEvent.change(screen.getByLabelText("孩子"), { target: { value: "synthetic-child-b" } });
  fireEvent.click(screen.getByRole("button", { name: "測驗" }));
  expect(await screen.findByRole("heading", { name: "乙最新測驗" })).toBeVisible();
  finishFirst([result("甲遲到的測驗", "test", 20)]);
  await waitFor(() => expect(screen.queryByRole("heading", { name: "甲遲到的測驗" })).toBeNull());
  expect(screen.getByRole("heading", { name: "乙最新測驗" })).toBeVisible();
});
