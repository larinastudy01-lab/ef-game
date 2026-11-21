import { supabase } from "../lib/supabaseClient";
import { askParentAssistant, buildParentResultSnapshot } from "./parentAssistant";
import { captureClinicalApiSuggestion, saveClinicalApiBase } from "./clinicalApi";
jest.mock("../lib/supabaseClient", () => ({ supabase: { auth: { getSession: jest.fn() } } }));
const session = { user: { id: "synthetic-parent" }, access_token: "synthetic-token" };
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); window.history.replaceState({}, "", "/");
  supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
});

test("the current result snapshot omits identity and raw trials and preserves missing values", () => {
  const snapshot = buildParentResultSnapshot({ full_name: "private-name", birth_date: "2020-01-01", trials: [{ private: "raw" }], accuracy: 0, summary: { totalTrials: 10 } }, "PM", "child-a");
  expect(snapshot).toMatchObject({ patientId: "child-a", gameKey: "PM", accuracy: 0, total: 10, avgRt: null, correct: null });
  expect(JSON.stringify(snapshot)).not.toMatch(/private-name|2020-01-01|trials|raw/);
});

test("family RAG cannot send tokens or results to an unconfirmed shared destination", async () => {
  captureClinicalApiSuggestion("?aiEndpoint=https%3A%2F%2Ffamily.trycloudflare.com");
  const fetchImpl = jest.fn();
  await expect(askParentAssistant({ patientId: "child-a", question: "合成問題" }, { fetchImpl })).rejects.toThrow(/確認/);
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
});

test("confirmed parent requests carry the signed-in token and safely expose citations", async () => {
  saveClinicalApiBase("https://family.trycloudflare.com");
  const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ answer: "合成回答[來源 1]", ragUsed: true, sources: [{ title: "合成文獻", url: "javascript:alert(1)" }] }) }));
  const result = await askParentAssistant({ patientId: "child-a", question: "合成問題" }, { fetchImpl, expectedUserId: session.user.id });
  expect(fetchImpl).toHaveBeenCalledWith("https://family.trycloudflare.com/api/parent-assistant", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer synthetic-token" }) }));
  expect(result.sources[0]).toMatchObject({ citationNumber: 1, url: "" });
});

test("an account switch while waiting discards the returned answer", async () => {
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null }).mockResolvedValueOnce({ data: { session: { user: { id: "another-parent" } } }, error: null });
  await expect(askParentAssistant({ patientId: "child-a", question: "合成問題" }, { fetchImpl: async () => ({ ok: true, json: async () => ({ answer: "old-private-answer" }) }) })).rejects.toThrow(/登入狀態已變更/);
});
