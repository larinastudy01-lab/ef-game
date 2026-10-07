// DOM events need React's current act with this native-root harness; the installed
// React Testing Library still wraps them in deprecated react-dom/test-utils act.
/* eslint-disable testing-library/no-dom-import, testing-library/no-unnecessary-act, testing-library/no-node-access */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen } from "@testing-library/dom";
import { supabase } from "../lib/supabaseClient";
import RegisterPage from "./RegisterPage";
import ClinicianApplicationPage from "./ClinicianApplicationPage";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const user = { id: "new-user" };
const session = { user, access_token: "test-session" };
let container;
let root;
let upsert;

beforeEach(() => {
  jest.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  upsert = jest.fn().mockResolvedValue({ error: null });
  supabase.from.mockReturnValue({ upsert });
  supabase.auth.signUp.mockResolvedValue({ data: { user, session }, error: null });
  supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});

async function renderPage(Page) {
  await act(async () => root.render(<Page />));
}

async function submitParent() {
  act(() => {
    fireEvent.change(screen.getByLabelText("家長姓名"), { target: { value: " 王家長 " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Parent@example.com" } });
    fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("確認密碼"), { target: { value: "password123" } });
  });
  await act(async () => fireEvent.submit(container.querySelector("form")));
}

async function submitClinician() {
  act(() => {
    fireEvent.change(screen.getByLabelText("真實姓名"), { target: { value: "陳醫師" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Doctor@example.com" } });
    fireEvent.change(screen.getByLabelText("密碼（至少 6 個字元）"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("確認密碼"), { target: { value: "password123" } });
  });
  await act(async () => fireEvent.submit(container.querySelector("form")));
}

function mockApplicantQueries(application = null) {
  supabase.from.mockImplementation(table => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: table === "profiles" ? { role: "clinician_applicant" } : application,
        error: null,
      }),
    };
    return query;
  });
}

test("parent registration with an immediate session saves the profile and enters child selection", async () => {
  await renderPage(RegisterPage);
  await submitParent();
  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: "parent@example.com", password: "password123",
    options: { data: { full_name: "王家長", role: "guardian" } },
  });
  expect(upsert).toHaveBeenCalledWith([{ id: user.id, email: "parent@example.com", full_name: "王家長", role: "guardian" }]);
  expect(mockNavigate).toHaveBeenCalledWith("/child-select", { replace: true });
});

test.each([
  { user, session: null },
  { user: null, session: null },
])("registration without a session does not write protected profile data or navigate", async data => {
  supabase.auth.signUp.mockResolvedValue({ data, error: null });
  await renderPage(RegisterPage);
  await submitParent();
  expect(screen.getByText(/目前尚未開放註冊後直接登入/)).toBeInTheDocument();
  expect(supabase.from).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(container.querySelector('button[type="submit"]')).not.toBeDisabled();
});

test("a thrown signup network error restores the registration form", async () => {
  supabase.auth.signUp.mockRejectedValue(new Error("Failed to fetch"));
  await renderPage(RegisterPage);
  await submitParent();
  expect(screen.getByText("目前網路連線不穩，請稍後再試。")).toBeInTheDocument();
  expect(container.querySelector('button[type="submit"]')).not.toBeDisabled();
  expect(upsert).not.toHaveBeenCalled();
});

test("a rejected signup does not enter the system", async () => {
  supabase.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: new Error("User already registered") });
  await renderPage(RegisterPage);
  await submitParent();
  expect(screen.getByText("這個 Email 已經註冊過了，請直接登入。")).toBeInTheDocument();
  expect(upsert).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("a profile write failure keeps the parent informed instead of navigating", async () => {
  upsert.mockResolvedValue({ error: new Error("profile unavailable") });
  await renderPage(RegisterPage);
  await submitParent();
  expect(screen.getByText(/家長資料建立失敗/)).toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(container.querySelector('button[type="submit"]')).not.toBeDisabled();
});

test("clinician signup enters the application form without granting clinician access", async () => {
  mockApplicantQueries();
  await renderPage(ClinicianApplicationPage);
  await submitClinician();
  expect(screen.getByRole("heading", { name: "填寫醫師基本資料" })).toBeInTheDocument();
  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: "doctor@example.com", password: "password123",
    options: { data: { full_name: "陳醫師", account_type: "clinician_applicant" } },
  });
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("clinician signup without a session keeps protected application data unread", async () => {
  supabase.auth.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
  await renderPage(ClinicianApplicationPage);
  await submitClinician();
  expect(screen.getByText(/目前尚未開放註冊後直接登入/)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "建立申請帳號" })).toBeInTheDocument();
  expect(supabase.from).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("an existing pending clinician application still requires administrator review", async () => {
  mockApplicantQueries({ id: "application-id", status: "pending" });
  await renderPage(ClinicianApplicationPage);
  await submitClinician();
  expect(screen.getByRole("heading", { name: "申請已送出，等待管理員審核。" })).toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("auth callbacks return synchronously and defer protected queries until after the auth lock", async () => {
  jest.useFakeTimers();
  mockApplicantQueries();
  await renderPage(ClinicianApplicationPage);
  const onAuth = supabase.auth.onAuthStateChange.mock.calls[0][0];
  expect(onAuth("SIGNED_IN", session)).toBeUndefined();
  expect(supabase.from).not.toHaveBeenCalled();
  await act(async () => jest.runOnlyPendingTimers());
  expect(screen.getByRole("heading", { name: "填寫醫師基本資料" })).toBeInTheDocument();
});
