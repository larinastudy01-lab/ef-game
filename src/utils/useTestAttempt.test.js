import { act } from "react";
import { createRoot } from "react-dom/client";
import { createTestAttempt, useTestAttempt } from "./useTestAttempt";
import { readResultOutbox } from "./resultSync";
import { buildBehavioralHierarchy } from "../analytics/trials/buildBehavioralHierarchy";

jest.mock("../lib/database", () => ({ saveGameResultToCloud: jest.fn().mockResolvedValue(null) }));
jest.mock("../lib/supabaseClient", () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } } }));
jest.mock("./economyManager", () => ({ awardTrainingCoins: jest.fn() }));
jest.mock("../analytics/recommendation/onlineRecommendation", () => ({ completeActiveRecommendation: jest.fn() }));

const child = { childId: "child-1", guardian_id: "owner-a" };
function renderRecorder(gameId) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: null };
  function Harness() {
    result.current = useTestAttempt({ gameId });
    return null;
  }
  act(() => { root.render(<Harness />); });
  return { result, unmount: () => act(() => root.unmount()) };
}
beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("currentChild", JSON.stringify(child));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test("begin and every answer persist an incomplete attempt with stable behavioral IDs", () => {
  const attempt = createTestAttempt({ gameId: "CBT", route: "/test-cbt" });
  const first = attempt.begin(child);
  expect(readResultOutbox()[0].result.session.finishedAt).toBeNull();
  attempt.checkpoint({ trials: [{ correct: false, reactionTime: 1234 }] });
  const firstTrialId = readResultOutbox()[0].result.behavioral.trialIds[0];
  attempt.checkpoint({ trials: [{ correct: false, reactionTime: 1234 }, { correct: true }] });
  const [entry] = readResultOutbox();
  expect(entry.result.resultId).toBe(first.resultId);
  expect(entry.result.behavioral.trialIds[0]).toBe(firstTrialId);
  expect(entry.result.trials).toHaveLength(2);
  expect(localStorage.getItem("cbtTestResult")).toBeNull();
  attempt.interrupt();
});

test("failed performance can finish; completion retains the attempt and original account", () => {
  const attempt = createTestAttempt({ gameId: "SSG" });
  const first = attempt.begin(child);
  attempt.checkpoint({ trials: [{ isCorrect: false }] });
  const partial = readResultOutbox()[0].result;
  const final = attempt.complete({ score: 0, stars: 0, trials: [{ isCorrect: false }] });
  const [entry] = readResultOutbox();
  expect(final.resultId).toBe(first.resultId);
  expect(entry.result.behavioral).toEqual(partial.behavioral);
  expect(entry.result.session.status).toBe("completed");
  expect(entry.activeTabId).toBeNull();
  expect(entry.ownerId).toBe("owner-a");
  attempt.interrupt();
  expect(readResultOutbox()[0].result.session.status).toBe("completed");
});

test("unmount and closing the page preserve incomplete answers without legacy completion keys", () => {
  const { result, unmount } = renderRecorder("PM");
  act(() => {
    result.current.begin();
    result.current.checkpoint({ trials: [{ isCorrect: true, reactionTime: 1500 }] });
  });
  unmount();
  const [entry] = readResultOutbox();
  expect(entry.result.session.status).toBe("interrupted");
  expect(entry.result.trials).toHaveLength(1);
  expect(localStorage.getItem("pmTestResult")).toBeNull();
  const hierarchy = buildBehavioralHierarchy(entry.result);
  expect(hierarchy.session.sessionStatus).toBe("interrupted");
  expect(hierarchy.taskSession.completionStatus).toBe("interrupted");
});

test("pagehide marks interruption; starting again creates a separate attempt", () => {
  const { result, unmount } = renderRecorder("DCCS");
  act(() => { result.current.begin(); });
  const firstId = readResultOutbox()[0].result.resultId;
  act(() => { window.dispatchEvent(new Event("pagehide")); result.current.begin(); });
  expect(readResultOutbox()).toHaveLength(2);
  expect(readResultOutbox().find((entry) => entry.result.resultId === firstId).result.session.status).toBe("interrupted");
  unmount();
});
