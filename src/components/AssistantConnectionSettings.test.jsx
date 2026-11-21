import { fireEvent, render, screen } from "@testing-library/react";
import { AssistantConnectionSettings } from "./AssistantConnectionSettings";
import { clinicalApiUrl } from "../utils/clinicalApi";
beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, "", "/"); });
test("shows a suggested destination for confirmation and preserves the current route", () => {
  window.history.replaceState({}, "", "/clinician-dashboard?patient=synthetic&aiEndpoint=https%3A%2F%2Fdemo.trycloudflare.com");
  render(<AssistantConnectionSettings />);
  expect(screen.getByLabelText("AI 服務網址")).toHaveValue("https://demo.trycloudflare.com");
  expect(() => clinicalApiUrl("/api/clinical-assistant")).toThrow();
  fireEvent.click(screen.getByText("確認並使用此服務"));
  expect(clinicalApiUrl("/api/clinical-assistant")).toBe("https://demo.trycloudflare.com/api/clinical-assistant");
  expect(window.location.search).toBe("?patient=synthetic");
});
test("invalid destinations are rejected without changing API routing", () => {
  render(<AssistantConnectionSettings />);
  fireEvent.change(screen.getByLabelText("AI 服務網址"), { target: { value: "http://remote.example" } });
  fireEvent.click(screen.getByText("確認並使用此服務"));
  expect(screen.getByRole("alert")).toHaveTextContent("網址不正確");
  expect(clinicalApiUrl("/api/clinical-assistant")).toBe("/api/clinical-assistant");
});
