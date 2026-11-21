import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import { AssistantConnectionSettings } from "../components/AssistantConnectionSettings";
import { clinicalApiUrl } from "../utils/clinicalApi";
import { supabase } from "../lib/supabaseClient";
import ClinicianLoginPage from "./ClinicianLoginPage";

jest.mock("../lib/supabaseClient", () => ({ supabase: {
  auth: { getUser: jest.fn(), getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn(), signInWithPassword: jest.fn() },
  from: jest.fn(),
} }));
const roles = ["clinician"];

test("a Pages share link keeps its destination through login and requires confirmation before sending", async () => {
  sessionStorage.clear();
  const query = "?aiEndpoint=https%3A%2F%2Fsynthetic.trycloudflare.com";
  window.history.replaceState({}, "", "/ef-game/clinician-dashboard" + query);
  supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    .mockResolvedValue({ data: { user: { id: "synthetic-doctor" } }, error: null });
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "synthetic-doctor" } }, error: null });
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "clinician" }, error: null }) }) }) });
  render(<BrowserRouter basename="/ef-game" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/clinician-login" element={<ClinicianLoginPage />} />
      <Route path="/clinician-dashboard" element={<ProtectedRoute allowedRoles={roles} redirectTo="/clinician-login"><AssistantConnectionSettings /></ProtectedRoute>} />
    </Routes>
  </BrowserRouter>);
  fireEvent.change(await screen.findByLabelText("醫療人員 Email"), { target: { value: "synthetic@example.invalid" } });
  fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "synthetic-password" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "登入醫療端" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "登入醫療端" }));
  expect(await screen.findByLabelText("AI 服務網址")).toHaveValue("https://synthetic.trycloudflare.com");
  expect(window.location.search).toBe(query);
  expect(() => clinicalApiUrl("/api/clinical-assistant")).toThrow(/確認/);
  fireEvent.click(screen.getByRole("button", { name: "確認並使用此服務" }));
  expect(clinicalApiUrl("/api/clinical-assistant")).toBe("https://synthetic.trycloudflare.com/api/clinical-assistant");
  expect(window.location.pathname).toBe("/ef-game/clinician-dashboard");
  expect(window.location.search).toBe("");
  window.history.replaceState({}, "", "/");
  sessionStorage.clear();
});
