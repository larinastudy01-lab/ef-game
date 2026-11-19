/* eslint-disable testing-library/no-dom-import, testing-library/no-unnecessary-act, testing-library/no-node-access */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen } from "@testing-library/dom";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useResearchData } from "./ResearchWorkspaceContext";
import { getMyProfile, getResearchExperimentHistory, getResearchFeatureInputsFromCloud } from "../../lib/database";
import { supabase } from "../../lib/supabaseClient";
import { loadRecommendationHistory } from "../../analytics/recommendation";

jest.mock("../../lib/database", () => ({ getMyProfile: jest.fn(), getResearchFeatureInputsFromCloud: jest.fn(), getResearchExperimentHistory: jest.fn() }));
jest.mock("../../lib/supabaseClient", () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } } }));
jest.mock("../../analytics/recommendation", () => ({ loadRecommendationHistory: jest.fn() }));

function Data() {
  const data = useResearchData();
  return <><p>{data.loading ? "loading" : data.error || "loaded"}</p><button onClick={data.refresh}>retry</button></>;
}
function Login() {
  const location = useLocation();
  return <div role="status">{location.state?.authExpired ? "expired login" : "login"}</div>;
}
let root, container, authChanged;
beforeEach(() => {
  jest.clearAllMocks();
  getMyProfile.mockResolvedValue({ role: "clinician" });
  getResearchFeatureInputsFromCloud.mockResolvedValue([]);
  getResearchExperimentHistory.mockResolvedValue([]);
  loadRecommendationHistory.mockResolvedValue([]);
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authChanged = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const renderPage = async () => act(async () => root.render(<MemoryRouter initialEntries={["/research-tools"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <Routes><Route path="/research-tools" element={<Data/>}/><Route path="/clinician-login" element={<Login/>}/></Routes>
</MemoryRouter>));

test.each(["refresh_token_not_found", "refresh_token_already_used", "session_expired"])("%s opens reauthentication instead of a database permission error", async (code) => {
  getMyProfile.mockRejectedValueOnce(Object.assign(new Error("Invalid session"), { code }));
  await renderPage();
  expect(screen.getByRole("status")).toHaveTextContent("expired login");
  expect(getResearchFeatureInputsFromCloud).not.toHaveBeenCalled();
});

test("a missing session opens reauthentication", async () => {
  getMyProfile.mockResolvedValueOnce(null);
  await renderPage();
  expect(screen.getByRole("status")).toHaveTextContent("expired login");
});

test("expired research requests also open reauthentication", async () => {
  getResearchFeatureInputsFromCloud.mockRejectedValueOnce({ status: 401, message: "JWT expired" });
  await renderPage();
  expect(screen.getByRole("status")).toHaveTextContent("expired login");
});

test("a transient failure keeps the user signed in and can be retried", async () => {
  getResearchFeatureInputsFromCloud.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await renderPage();
  expect(screen.getByText(/請確認網路連線後重試/)).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "retry" })));
  expect(screen.getByText("loaded")).toBeInTheDocument();
});

test("signing out invalidates an in-flight load before it can expose results", async () => {
  let resolveInputs;
  getResearchFeatureInputsFromCloud.mockReturnValueOnce(new Promise((resolve) => { resolveInputs = resolve; }));
  await renderPage();
  await act(async () => authChanged("SIGNED_OUT", null));
  await act(async () => resolveInputs([]));
  expect(screen.getByRole("status")).toHaveTextContent("expired login");
  expect(screen.queryByText("loaded")).not.toBeInTheDocument();
});
