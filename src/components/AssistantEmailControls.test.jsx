import React, { useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { supabase } from "../lib/supabaseClient";
import { AssistantEmailChoice, AssistantEmailStatus, useAssistantEmail } from "./AssistantEmailControls";

jest.mock("../lib/supabaseClient", () => ({ supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } } }));

const session = { access_token: "synthetic-access-token", user: { id: "user-1", email: "registered@example.invalid" } };
const accepted = () => Promise.resolve({ ok: true, json: async () => ({ status: "accepted", recipient: session.user.email }) });
let authCallback;

function Harness({ scope = "child-1" }) {
  const email = useAssistantEmail(scope);
  const counter = useRef(0);
  const ask = () => {
    const index = ++counter.current;
    const choice = email.takeChoice();
    email.deliver(choice, { messageId: `answer-${index}`, question: `問題 ${index}`, answer: `完整回答 ${index}` });
  };
  return <>
    <AssistantEmailChoice controller={email} />
    <button onClick={ask}>詢問</button>
    {Object.entries(email.deliveries).map(([id, delivery]) => <AssistantEmailStatus key={id} delivery={delivery} onRetry={() => email.retry(id)} />)}
  </>;
}

beforeEach(() => {
  supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authCallback = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  global.fetch = jest.fn().mockImplementation(accepted);
});
afterEach(() => { jest.clearAllMocks(); delete global.fetch; });

test("each question independently defaults to opt-out; choosing once sends only that question and answer", async () => {
  render(<Harness />);
  const checkbox = screen.getByRole("checkbox", { name: "本次問答自動寄至註冊信箱" });
  await waitFor(() => expect(checkbox).toBeEnabled());
  expect(checkbox).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  expect(screen.getByText("本次未寄送")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();

  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  await screen.findByText(/已交寄至 registered@example.invalid/);
  expect(checkbox).not.toBeChecked();
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe("/api/assistant-email");
  expect(options.headers.Authorization).toBe("Bearer synthetic-access-token");
  expect(JSON.parse(options.body)).toMatchObject({ sendEmail: true, question: "問題 2", answer: "完整回答 2" });
  expect(JSON.parse(options.body)).not.toHaveProperty("email");
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("failed delivery keeps the answer available and retries the identical record", async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "管理員尚未啟用問答寄信服務" }) });
  render(<Harness />);
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  await screen.findByText(/管理員尚未啟用/);
  fireEvent.click(screen.getByRole("button", { name: "重試寄送" }));
  await screen.findByText(/已交寄至/);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(global.fetch.mock.calls[1][1].body).toBe(global.fetch.mock.calls[0][1].body);
});

test("expired or switched account cannot send a previous account's record", async () => {
  render(<Harness />);
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  fireEvent.click(screen.getByRole("checkbox"));
  supabase.auth.getSession.mockResolvedValue({ data: { session: { ...session, user: { id: "other-user", email: "other@example.invalid" } } } });
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  await screen.findByText(/登入狀態已變更/);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("changing the patient clears opt-in and failed-delivery retry records", async () => {
  global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "交寄暫時失敗" }) });
  const { rerender } = render(<Harness scope="child-1" />);
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  await screen.findByRole("button", { name: "重試寄送" });
  fireEvent.click(screen.getByRole("checkbox"));
  rerender(<Harness scope="child-2" />);
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.queryByRole("button", { name: "重試寄送" })).not.toBeInTheDocument();
});

test("sign-out clears a chosen option and disables email until login", async () => {
  render(<Harness />);
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  fireEvent.click(screen.getByRole("checkbox"));
  // An auth event is outside React's event system, so wait for it inside an async act.
  const { act } = await import("react");
  await act(async () => authCallback("SIGNED_OUT", null));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("checkbox")).toBeDisabled();
});

test("anonymous sessions cannot select automatic delivery", async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  render(<Harness />);
  expect(await screen.findByText("登入後可選擇寄至註冊信箱。")).toBeInTheDocument();
  expect(screen.getByRole("checkbox")).toBeDisabled();
});
