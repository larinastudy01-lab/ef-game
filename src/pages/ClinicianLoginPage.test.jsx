/* eslint-disable testing-library/no-dom-import, testing-library/no-unnecessary-act, testing-library/no-node-access */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen } from "@testing-library/dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClinicianLoginPage from "./ClinicianLoginPage";
import { supabase } from "../lib/supabaseClient";

jest.mock("../lib/supabaseClient", () => ({ supabase: {
  auth: { getSession: jest.fn(), signOut: jest.fn(), signInWithPassword: jest.fn() }, from: jest.fn(),
} }));
let root, container;
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "doctor" } }, error: null });
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "clinician" }, error: null }) }) }) });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const renderLogin = async (state) => act(async () => root.render(<MemoryRouter initialEntries={[{ pathname: "/clinician-login", state }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <Routes><Route path="/clinician-login" element={<ClinicianLoginPage/>}/><Route path="/research-tools" element={<p>research restored</p>}/></Routes>
</MemoryRouter>));

test("expired login replaces only the local session, preserves pending results and resumes research after sign-in", async () => {
  const key = "efGameResultOutbox:unsent";
  localStorage.setItem(key, JSON.stringify({ original: "preserved" }));
  await renderLogin({ authExpired: true, from: "/research-tools" });
  expect(screen.getByText(/登入已失效，請重新登入/)).toBeInTheDocument();
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.change(screen.getByLabelText("醫療人員 Email"), { target: { value: "doctor@example.invalid" } });
    fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "synthetic-password" } });
  });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "登入醫療端" })));
  expect(screen.getByText("research restored")).toBeInTheDocument();
  expect(localStorage.getItem(key)).toBe(JSON.stringify({ original: "preserved" }));
});

test("sign-in waits for old local-session cleanup to finish", async () => {
  let finishCleanup;
  supabase.auth.signOut.mockReturnValueOnce(new Promise((resolve) => { finishCleanup = resolve; }));
  await renderLogin({ authExpired: true });
  expect(screen.getByRole("button", { name: "正在確認登入狀態..." })).toBeDisabled();
  await act(async () => finishCleanup({ error: null }));
  expect(screen.getByRole("button", { name: "登入醫療端" })).toBeEnabled();
});

test("a rejected stored refresh token leaves a usable sign-in form with an explanation", async () => {
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: { code: "refresh_token_not_found" } });
  await renderLogin();
  expect(screen.getByText(/登入已失效，請重新登入/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "登入醫療端" })).toBeEnabled();
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
