import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResultAccessRoute from "./ResultAccessRoute";
import { supabase } from "../lib/supabaseClient";
import { areResultMirrorsReady } from "../utils/resultSync";

let mockAuthChanged;
jest.mock("../lib/supabaseClient", () => ({ supabase: { auth: {
  getUser: jest.fn(), onAuthStateChange: jest.fn((callback) => {
    mockAuthChanged = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
}, from: jest.fn() } }));
jest.mock("../utils/resultSync", () => ({ areResultMirrorsReady: jest.fn(), RESULT_SYNC_EVENT: "ef-game-result-sync" }));
jest.mock("../temporaryGameTesting/runtime", () => ({ isTemporaryGameTesting: () => false }));

let patient;
beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation((callback) => { mockAuthChanged = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
  localStorage.clear(); sessionStorage.clear();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } } });
  areResultMirrorsReady.mockReturnValue(true);
  patient = { id: "child-a", guardian_id: "owner-a" };
  supabase.from.mockImplementation((table) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
    data: table === "profiles" ? { role: "guardian" } : patient,
  }) }) }) }));
});

function open(props = {}, child = <div>private trial history</div>) {
  return render(<MemoryRouter initialEntries={[{ pathname: "/result-pa", state: { childId: "child-a" } }]}>
    <ResultAccessRoute {...props}>{child}</ResultAccessRoute>
  </MemoryRouter>);
}

test("authorized guardian can render only after real-user and patient checks", async () => {
  open();
  expect(screen.queryByText("private trial history")).toBeNull();
  expect(await screen.findByText("private trial history")).toBeInTheDocument();
  expect(supabase.from).toHaveBeenCalledWith("patients");
});

test("foreign or revoked patient cannot fall back to a local private result", async () => {
  patient = null;
  localStorage.setItem("latestPMTestResult", JSON.stringify({ childId: "child-a", score: 94 }));
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("無法讀取");
  expect(screen.queryByText("private trial history")).toBeNull();
});

test("a claimed local clinical role does not grant clinical result access", async () => {
  localStorage.setItem("userRole", "clinician");
  open({ audience: "clinical" });
  expect(await screen.findByRole("alert")).toHaveTextContent("無法讀取");
  expect(supabase.from).not.toHaveBeenCalledWith("patients");
});

test("failed storage isolation refuses to render retained original-owner mirrors", async () => {
  areResultMirrorsReady.mockReturnValue(false);
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("帳號隔離");
  expect(screen.queryByText("private trial history")).toBeNull();
  expect(supabase.from).not.toHaveBeenCalled();
});

test("an old pending authorization cannot reveal results after account replacement", async () => {
  let resolveOld;
  supabase.auth.getUser.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  open();
  await waitFor(() => expect(supabase.auth.getUser).toHaveBeenCalled());
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-b" } } });
  patient = null;
  await act(async () => { mockAuthChanged("SIGNED_IN", { user: { id: "owner-b" } }); });
  expect(await screen.findByRole("alert")).toHaveTextContent("無法讀取");
  await act(async () => { resolveOld({ data: { user: { id: "owner-a" } } }); });
  expect(screen.queryByText("private trial history")).toBeNull();
});

test("routine outbox notifications preserve an authorized result page selection", async () => {
  function Selection() { const [value, setValue] = useState(0); return <button onClick={() => setValue(value + 1)}>selection {value}</button>; }
  open({}, <Selection />);
  const button = await screen.findByRole("button", { name: "selection 0" });
  await act(async () => { button.click(); });
  await act(async () => { window.dispatchEvent(new CustomEvent("ef-game-result-sync")); });
  expect(screen.getByRole("button", { name: "selection 1" })).toBeInTheDocument();
});
