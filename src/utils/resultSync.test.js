import {
  areResultMirrorsReady, flushResultOutbox, getResultSyncState, queueGameResult, readResultOutbox,
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
  resultId: id, child: { childId: "child-1" }, game: { gameId: "ARI" },
  session: { mode: "test", status, startedAt: "2026-10-07T00:00:00Z" },
  trials: [{ isCorrect: false }], rawResult: {},
});
const acknowledged = (record) => ({ id: record.resultId, syncState: {
  gameResult: "saved", researchHierarchy: "verified",
  expectedTrialCount: record.trials.length, verifiedTrialCount: record.trials.length,
} });
const online = (value) => Object.defineProperty(navigator, "onLine", { configurable: true, value });

beforeEach(async () => {
  jest.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  jest.clearAllMocks();
  online(true);
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  saveGameResultToCloud.mockImplementation(async (record) => acknowledged(record));
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
  localStorage.setItem("ariTestResult", JSON.stringify({ resultId: record.resultId, syncStatus: "pending" }));
  online(true);
  window.dispatchEvent(new Event("online"));
  await Promise.resolve();
  await Promise.resolve();
  jest.advanceTimersByTime(0);
  await flushResultOutbox();
  expect(saveGameResultToCloud).toHaveBeenCalledWith(expect.objectContaining({ resultId: record.resultId }), { expectedOwnerId: "owner-a" });
  expect(readResultOutbox()).toHaveLength(0);
  expect(JSON.parse(localStorage.getItem("ariTestResult")).syncStatus).toBe("synced");
});

test("failed and unauthenticated uploads remain pending while other records succeed", async () => {
  queueGameResult(result("failed"));
  queueGameResult(result("no-session"));
  queueGameResult(result("success"));
  saveGameResultToCloud.mockImplementation(async (record) => {
    if (record.resultId === "failed") throw new Error("Network failure");
    return record.resultId === "no-session" ? null : acknowledged(record);
  });
  await flushResultOutbox();
  expect(readResultOutbox().map((entry) => entry.result.resultId)).toEqual(["failed", "no-session"]);
  saveGameResultToCloud.mockImplementation(async (record) => acknowledged(record));
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

test("account changes archive display mirrors, preserve outbox and restore the original account", async () => {
  online(false);
  queueGameResult(result("private-a"), { ownerId: "owner-a" });
  const history = JSON.stringify([result("private-a")]);
  localStorage.setItem("efGameResults", history);
  localStorage.setItem("result:ARI:test", JSON.stringify(result("private-a")));
  sessionStorage.setItem("ariTestResult", JSON.stringify({ resultId: "private-a", trials: [{ isCorrect: false }] }));
  localStorage.setItem("currentChild", JSON.stringify({ childId: "child-1" }));
  localStorage.setItem("unrelatedPreference", "keep");
  authChanged("SIGNED_OUT", null);
  authChanged("SIGNED_IN", { user: { id: "owner-b" } });
  expect(localStorage.getItem("efGameResults")).toBeNull();
  expect(localStorage.getItem("result:ARI:test")).toBeNull();
  expect(sessionStorage.getItem("ariTestResult")).toBeNull();
  expect(localStorage.getItem("currentChild")).toBeNull();
  expect(localStorage.getItem("unrelatedPreference")).toBe("keep");
  expect(readResultOutbox()[0].ownerId).toBe("owner-a");
  expect(readResultOutbox()[0].result.trials).toEqual(result().trials);
  expect(getResultSyncState().pending).toBe(0);
  authChanged("SIGNED_IN", { user: { id: "owner-a" } });
  expect(localStorage.getItem("efGameResults")).toBe(history);
  expect(JSON.parse(sessionStorage.getItem("ariTestResult")).resultId).toBe("private-a");
  expect(readResultOutbox()).toHaveLength(1);
});

test("initial same-account session retains mirrors and legacy unassigned mirrors are kept privately", () => {
  localStorage.setItem("efGameResults", "[]");
  authChanged("INITIAL_SESSION", { user: { id: "owner-a" } });
  expect(localStorage.getItem("efGameResults")).toBe("[]");
  localStorage.removeItem("efGameResultMirrorOwner");
  localStorage.setItem("efGameResults", JSON.stringify([result("unknown-owner")]));
  authChanged("SIGNED_IN", { user: { id: "owner-b" } });
  expect(localStorage.getItem("efGameResults")).toBeNull();
  expect(localStorage.getItem("efGameResultMirrorArchive:unassigned:efGameResults")).toContain("unknown-owner");
});

test("a second tab isolates its session mirrors even after another tab changed the shared owner", () => {
  sessionStorage.setItem("ariTestResult", JSON.stringify({ resultId: "private-tab-a" }));
  localStorage.setItem("efGameResultMirrorOwner", "owner-b");
  localStorage.setItem("efGameResults", JSON.stringify([result("public-to-b")]));
  authChanged("SIGNED_IN", { user: { id: "owner-b" } });
  expect(sessionStorage.getItem("ariTestResult")).toBeNull();
  expect(sessionStorage.getItem("efGameResultMirrorArchive:owner-a:ariTestResult")).toContain("private-tab-a");
  expect(localStorage.getItem("efGameResults")).toContain("public-to-b");
});

test("a mirror removed by another tab cannot overwrite its saved archive with null", () => {
  const archivedKey = "efGameResultMirrorArchive:owner-a:efGameResults";
  const saved = JSON.stringify([result("retained-a")]);
  localStorage.setItem(archivedKey, saved);
  localStorage.setItem("efGameResults", saved);
  const originalGetItem = Storage.prototype.getItem;
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(function (key) {
    if (this === localStorage && key === "efGameResults") {
      this.removeItem(key);
      return null;
    }
    return originalGetItem.call(this, key);
  });
  authChanged("SIGNED_IN", { user: { id: "owner-b" } });
  expect(localStorage.getItem(archivedKey)).toBe(saved);
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
  acknowledge(acknowledged(result("same", "interrupted")));
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
  expect(localStorage.getItem("ariTestResult")).toBeNull();
  expect(localStorage.getItem("ef_test_ARI_completed")).toBeNull();
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

test.each([
  { id: "attempt-1" },
  { id: "attempt-1", syncState: { gameResult: "saved", researchHierarchy: "pending", expectedTrialCount: 1, verifiedTrialCount: 0 } },
  { id: "attempt-1", syncState: { gameResult: "saved", researchHierarchy: "verified", expectedTrialCount: 1, verifiedTrialCount: 0 } },
])("a partial or unverified acknowledgement retains the durable source: %j", async (response) => {
  saveGameResultToCloud.mockResolvedValue(response);
  queueGameResult(result());
  await flushResultOutbox();
  expect(readResultOutbox()).toHaveLength(1);
  expect(readResultOutbox()[0].result.trials).toEqual(result().trials);
});

test("partial failure state survives restart without clearing raw answers", async () => {
  const error = Object.assign(new Error("Research network failure"), {
    syncState: { gameResult: "saved", researchHierarchy: "pending", expectedTrialCount: 1, verifiedTrialCount: null },
  });
  saveGameResultToCloud.mockRejectedValue(error);
  queueGameResult(result());
  await flushResultOutbox();
  expect(readResultOutbox()[0].result.syncState).toEqual(error.syncState);
  stop();
  saveGameResultToCloud.mockImplementation(async (record) => acknowledged(record));
  stop = startResultSync();
  await flushResultOutbox();
  expect(readResultOutbox()).toHaveLength(0);
});


test("expanded legacy aliases stay private and return without retaining duplicate archive copies", () => {
  online(false);
  queueGameResult(result("pending-expanded"), { ownerId: "owner-a" });
  const raw = JSON.stringify({ syncOwnerId: "owner-a", childId: "child-1", trials: [{ deselectCount: 2 }] });
  const keys = ["latestPMTestResult", "pmTestResult_child-1", "pictureMemoryTestResult", "ef_pm_test_result", "LB_RESULT", "ef_test_CBT_completed_child-1", "activeChild", "ef_active_patient_id", "childrenProfiles"];
  keys.forEach((key) => localStorage.setItem(key, raw));
  authChanged("SIGNED_IN", { user: { id: "owner-b" } });
  keys.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
  expect(areResultMirrorsReady("owner-b")).toBe(true);
  expect(readResultOutbox()[0].ownerId).toBe("owner-a");
  authChanged("SIGNED_IN", { user: { id: "owner-a" } });
  keys.forEach((key) => { expect(localStorage.getItem(key)).toBe(raw); expect(localStorage.getItem("efGameResultMirrorArchive:owner-a:" + encodeURIComponent(key))).toBeNull(); });
});

test("old uncovered aliases require explicit ownership; ambiguous history is retained unassigned", () => {
  localStorage.removeItem("efGameResultMirrorVersion");
  localStorage.setItem("latestPMTestResult", JSON.stringify({ syncOwnerId: "owner-a", trials: [{ isCorrect: true }] }));
  localStorage.setItem("latestDccsTestResult", JSON.stringify({ trials: [{ isCorrect: false }] }));
  authChanged("INITIAL_SESSION", { user: { id: "owner-b" } });
  expect(localStorage.getItem("latestPMTestResult")).toBeNull();
  expect(localStorage.getItem("efGameResultMirrorArchive:owner-a:latestPMTestResult")).toContain("owner-a");
  expect(localStorage.getItem("efGameResultMirrorArchive:unassigned:latestDccsTestResult")).toContain("isCorrect");
  authChanged("SIGNED_IN", { user: { id: "owner-a" } });
  expect(localStorage.getItem("latestPMTestResult")).toContain("owner-a");
  expect(localStorage.getItem("latestDccsTestResult")).toBeNull();
});

test("failed account archival blocks result rendering and retains raw pending data for the original owner", () => {
  online(false);
  queueGameResult(result("pending-quota"), { ownerId: "owner-a" });
  const original = JSON.stringify([result("pending-quota")]);
  localStorage.setItem("efGameResults", original);
  const setItem = Storage.prototype.setItem;
  const fault = jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key.startsWith("efGameResultMirrorArchive:")) throw new DOMException("Full", "QuotaExceededError");
    return setItem.call(this, key, value);
  });
  authChanged("SIGNED_IN", { user: { id: "owner-b" } });
  expect(areResultMirrorsReady("owner-b")).toBe(false);
  expect(getResultSyncState().storageError).toBe(true);
  expect(localStorage.getItem("efGameResults")).toBe(original);
  expect(readResultOutbox()[0].result.trials).toEqual(result().trials);
  fault.mockRestore();
  authChanged("SIGNED_IN", { user: { id: "owner-a" } });
  expect(areResultMirrorsReady("owner-a")).toBe(true);
  expect(readResultOutbox()[0].ownerId).toBe("owner-a");
});

test("denied storage reads are reported even after the outbox has drained", async () => {
  queueGameResult(result("drained-storage-probe"));
  await flushResultOutbox();
  expect(readResultOutbox()).toHaveLength(0);
  expect(getResultSyncState().storageError).toBe(false);
  const read = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
  expect(getResultSyncState().storageError).toBe(true);
  read.mockRestore();
});


test("different archived history is retained exactly when a new active history is archived and acknowledged", async () => {
  const older = JSON.stringify([result("same-archive-attempt")]);
  const latestResult = { ...result("same-archive-attempt"), trials: [{ isCorrect: false }, { isCorrect: true }] };
  const latest = JSON.stringify([latestResult]);
  const archive = "efGameResultMirrorArchive:owner-a:efGameResults";
  localStorage.setItem(archive, older);
  localStorage.setItem("efGameResults", latest);
  authChanged("SIGNED_IN", { user: { id: "owner-b" } });
  expect(localStorage.getItem(archive)).toBe(latest);
  const retained = Object.keys(localStorage).find((key) => key.startsWith("efGameResultMirrorConflict:owner-a:"));
  expect(localStorage.getItem(retained)).toBe(older);
  expect(localStorage.getItem("efGameResults")).toBeNull();
  authChanged("SIGNED_IN", { user: { id: "owner-a" } });
  expect(localStorage.getItem("efGameResults")).toBe(latest);
  queueGameResult(latestResult);
  await flushResultOutbox();
  expect(localStorage.getItem(retained)).toBe(older);
});
