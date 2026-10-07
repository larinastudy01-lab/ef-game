import {
  flushResultOutbox, getResultSyncState, queueGameResult, readResultOutbox,
  recoverInterruptedResults, registerLiveAttempt, RESULT_OUTBOX_PREFIX,
  startResultSync, unregisterLiveAttempt,
} from "./resultSync";
import { getPatientById, saveGameResultToCloud } from "../lib/database";
import { supabase } from "../lib/supabaseClient";

jest.mock("../lib/database", () => ({ getPatientById: jest.fn(), saveGameResultToCloud: jest.fn() }));
jest.mock("../lib/supabaseClient", () => ({
  supabase: { auth: { onAuthStateChange: jest.fn() } },
}));

let authChanged;
let stop;
const result = (id = "attempt-1", status = "completed") => ({
  resultId: id, child: { childId: "child-1" }, game: { gameId: "SSG" },
  session: { mode: "test", status, startedAt: "2026-10-07T00:00:00Z" },
  trials: [{ isCorrect: false }], rawResult: {},
});
const online = (value) => Object.defineProperty(navigator, "onLine", { configurable: true, value });

beforeEach(async () => {
  jest.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  jest.clearAllMocks();
  online(true);
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  saveGameResultToCloud.mockResolvedValue({ id: "cloud-row" });
  getPatientById.mockResolvedValue(null);
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authChanged = callback;
    callback("INITIAL_SESSION", { user: { id: "owner-a" } });
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  stop = startResultSync();
  await flushResultOutbox();
});

afterEach(async () => {
  await flushResultOutbox();
  stop();
  jest.clearAllTimers();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("offline records persist; the online event automatically uploads the same ID", async () => {
  online(false);
  const record = result();
  queueGameResult(record);
  await flushResultOutbox();
  expect(saveGameResultToCloud).not.toHaveBeenCalled();
  expect(readResultOutbox()).toHaveLength(1);
  localStorage.setItem("ssgTestResult", JSON.stringify({ resultId: record.resultId, syncStatus: "pending" }));
  online(true);
  window.dispatchEvent(new Event("online"));
  await Promise.resolve();
  await Promise.resolve();
  jest.advanceTimersByTime(0);
  await flushResultOutbox();
  expect(saveGameResultToCloud).toHaveBeenCalledWith(expect.objectContaining({ resultId: record.resultId }), { expectedOwnerId: "owner-a" });
  expect(readResultOutbox()).toHaveLength(0);
  expect(JSON.parse(localStorage.getItem("ssgTestResult")).syncStatus).toBe("synced");
});

test("failed and unauthenticated uploads remain pending while other records succeed", async () => {
  queueGameResult(result("failed"));
  queueGameResult(result("no-session"));
  queueGameResult(result("success"));
  saveGameResultToCloud.mockImplementation(async (record) => {
    if (record.resultId === "failed") throw new Error("Network failure");
    return record.resultId === "no-session" ? null : { id: record.resultId };
  });
  await flushResultOutbox();
  expect(readResultOutbox().map((entry) => entry.result.resultId)).toEqual(["failed", "no-session"]);
  saveGameResultToCloud.mockResolvedValue({ id: "cloud-row" });
  jest.advanceTimersByTime(30000);
  await flushResultOutbox();
  expect(readResultOutbox()).toHaveLength(0);
});

test("pending attempts survive reopening and wait for their original account", async () => {
  queueGameResult(result(), { ownerId: "owner-a" });
  authChanged("SIGNED_IN", { user: { id: "owner-b" } });
  await flushResultOutbox();
  expect(saveGameResultToCloud).not.toHaveBeenCalled();
  stop();
  stop = startResultSync();
  await flushResultOutbox();
  expect(saveGameResultToCloud).toHaveBeenCalledTimes(1);
  expect(readResultOutbox()).toHaveLength(0);
});

test("unbound offline records upload only after the database verifies the child's guardian", async () => {
  queueGameResult(result("unbound"), { ownerId: null });
  getPatientById.mockResolvedValue({ id: "child-1", guardian_id: "owner-b" });
  await flushResultOutbox();
  expect(saveGameResultToCloud).not.toHaveBeenCalled();
  expect(readResultOutbox()[0].ownerId).toBeNull();
  getPatientById.mockResolvedValue({ id: "child-1", guardian_id: "owner-a" });
  await flushResultOutbox();
  expect(saveGameResultToCloud).toHaveBeenCalledWith(expect.objectContaining({ resultId: "unbound" }), { expectedOwnerId: "owner-a" });
  expect(readResultOutbox()).toHaveLength(0);
});

test("an older upload cannot remove a newer completion of the same attempt", async () => {
  let acknowledge;
  saveGameResultToCloud.mockImplementationOnce(() => new Promise((resolve) => { acknowledge = resolve; }));
  queueGameResult(result("same", "interrupted"));
  const uploading = flushResultOutbox();
  await Promise.resolve();
  queueGameResult({ ...result("same"), trials: [{ isCorrect: true }, { isCorrect: false }] });
  acknowledge({ id: "same" });
  await uploading;
  expect(saveGameResultToCloud).toHaveBeenCalledTimes(2);
  expect(saveGameResultToCloud.mock.calls[1][0].trials).toHaveLength(2);
  expect(readResultOutbox()).toHaveLength(0);
});

test("recovery preserves answers and marks abandoned drafts interrupted without unlocking tests", async () => {
  online(false);
  queueGameResult(result("draft", "in_progress"), { ownerId: "owner-a", activeTabId: "old-tab" });
  jest.advanceTimersByTime(61000);
  await recoverInterruptedResults();
  const [entry] = readResultOutbox();
  expect(entry.activeTabId).toBeNull();
  expect(entry.result.session.status).toBe("interrupted");
  expect(entry.result.trials).toEqual([{ isCorrect: false }]);
  expect(localStorage.getItem("ssgTestResult")).toBeNull();
  expect(localStorage.getItem("ef_test_SSG_completed")).toBeNull();
});

test("live attempts, including a background tab holding a lock, are not recovered", async () => {
  online(false);
  registerLiveAttempt("live");
  queueGameResult(result("live", "in_progress"), { activeTabId: "old-tab" });
  queueGameResult(result("background", "in_progress"), { activeTabId: "another-tab" });
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    query: jest.fn().mockResolvedValue({ held: [{ name: "ef-game-attempt:background" }], pending: [] }),
  } });
  jest.advanceTimersByTime(120000);
  await recoverInterruptedResults();
  expect(readResultOutbox().every((entry) => entry.activeTabId)).toBe(true);
  unregisterLiveAttempt("live");
});

test("pending records are not limited to the 200-record display history", async () => {
  online(false);
  for (let index = 0; index < 205; index += 1) queueGameResult(result(`attempt-${index}`));
  await flushResultOutbox();
  expect(readResultOutbox()).toHaveLength(205);
});

test("storage failure is reported and never treated as a successful local save", () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
  expect(() => queueGameResult(result())).toThrow("QuotaExceededError");
  expect(getResultSyncState().storageError).toBe(true);
});

test("a damaged outbox entry is preserved while valid records still upload", async () => {
  localStorage.setItem(`${RESULT_OUTBOX_PREFIX}damaged`, "{broken");
  queueGameResult(result());
  await flushResultOutbox();
  expect(localStorage.getItem(`${RESULT_OUTBOX_PREFIX}damaged`)).toBe("{broken");
  expect(saveGameResultToCloud).toHaveBeenCalledTimes(1);
});
