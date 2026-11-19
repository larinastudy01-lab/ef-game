/* eslint-disable testing-library/no-dom-import, testing-library/no-unnecessary-act, testing-library/no-node-access */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { screen } from "@testing-library/dom";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { supabase } from "../lib/supabaseClient";

jest.mock("../lib/supabaseClient", () => ({ supabase: { auth: { getUser: jest.fn(), onAuthStateChange: jest.fn() }, from: jest.fn() } }));
const ROLES = ["clinician"];
let root, container, authChanged;
function Login() { return <p>{useLocation().state?.authExpired ? "expired login" : "login"}</p>; }
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "doctor-a" } }, error: null });
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authChanged = callback; return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });
const renderPage = async () => act(async () => root.render(<MemoryRouter initialEntries={["/research-tools"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <Routes><Route path="/research-tools" element={<ProtectedRoute allowedRoles={ROLES} redirectTo="/clinician-login"><p>private research</p></ProtectedRoute>}/>
    <Route path="/clinician-login" element={<Login/>}/></Routes>
</MemoryRouter>));

test("an expired initial session opens reauthentication", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "refresh_token_not_found" } });
  await renderPage();
  expect(screen.getByText("expired login")).toBeInTheDocument();
  expect(supabase.from).not.toHaveBeenCalled();
});

test("an earlier profile response cannot reopen a page after sign-out", async () => {
  let resolveProfile;
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise((resolve) => { resolveProfile = resolve; }) }) }) });
  await renderPage();
  await act(async () => authChanged("SIGNED_OUT", null));
  await act(async () => resolveProfile({ data: { role: "clinician" }, error: null }));
  expect(screen.getByText("expired login")).toBeInTheDocument();
  expect(screen.queryByText("private research")).not.toBeInTheDocument();
});

test("auth event queries run after the callback returns and a stale account response is ignored", async () => {
  let resolveOldProfile;
  const profile = jest.fn()
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOldProfile = resolve; }))
    .mockResolvedValue({ data: { role: "guardian" }, error: null });
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: profile }) }) });
  await renderPage();
  await act(async () => authChanged("SIGNED_IN", { user: { id: "parent-b" } }));
  expect(profile).toHaveBeenCalledTimes(1);
  await act(async () => jest.runOnlyPendingTimers());
  await act(async () => resolveOldProfile({ data: { role: "clinician" }, error: null }));
  expect(screen.getByText("login")).toBeInTheDocument();
  expect(screen.queryByText("private research")).not.toBeInTheDocument();
});
