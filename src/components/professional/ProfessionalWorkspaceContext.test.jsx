import React, { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProfessionalWorkspaceProvider, useProfessionalWorkspace } from "./ProfessionalWorkspaceContext";
import { supabase } from "../../lib/supabaseClient";
jest.mock("../../lib/supabaseClient", () => ({ supabase: { auth: { getUser: jest.fn(), onAuthStateChange: jest.fn() } } }));
function Probe() { const workspace = useProfessionalWorkspace(); return <><span>{workspace.owner || "no-owner"}:{workspace.patientId || "no-selection"}:{Object.values(workspace.drafts).join("")}</span><button onClick={() => { workspace.selectPatient("owner-a", "patient-a"); workspace.setDraft("owner-a", "patient-a", "private draft"); }}>select</button></>; }
test("shared selection and drafts survive child remounts but clear on identity change", async () => {
  let callback;
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } } });
  supabase.auth.onAuthStateChange.mockImplementation((fn) => { callback = fn; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
  const { rerender } = render(<ProfessionalWorkspaceProvider><Probe key="clinical"/></ProfessionalWorkspaceProvider>);
  await screen.findByText("owner-a:no-selection:"); fireEvent.click(screen.getByRole("button", { name: "select" }));
  expect(screen.getByText("owner-a:patient-a:private draft")).toBeInTheDocument();
  rerender(<ProfessionalWorkspaceProvider><Probe key="research"/></ProfessionalWorkspaceProvider>);
  expect(screen.getByText("owner-a:patient-a:private draft")).toBeInTheDocument();
  act(() => callback("SIGNED_IN", { user: { id: "owner-b" } }));
  expect(screen.getByText("owner-b:no-selection:")).toBeInTheDocument(); expect(localStorage.length).toBe(0);
});
