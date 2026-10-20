import {
  createGameTestingShortcut, gameLocalStorage, gameSessionStorage,
  isTemporaryGameTesting, resetGameTestingMemory, startTemporaryGameTesting,
} from "./runtime";
import { createTestAttempt } from "../utils/useTestAttempt";
import { saveUnifiedResult } from "../utils/resultManager";
import { queueGameResult } from "../utils/resultSync";
import { awardTrainingCoins } from "../utils/economyManager";
import { completeActiveRecommendation } from "../analytics/recommendation/onlineRecommendation";

jest.mock("../lib/database", () => ({ saveGameResultToCloud: jest.fn() }));
jest.mock("../lib/supabaseClient", () => ({ supabase: { auth: {} } }));
jest.mock("../utils/economyManager", () => ({ awardTrainingCoins: jest.fn() }));
jest.mock("../analytics/recommendation/onlineRecommendation", () => ({ completeActiveRecommendation: jest.fn() }));

const snapshot = (storage) => Object.fromEntries(Object.keys(storage).map((key) => [key, storage.getItem(key)]));

test("normal play continues using browser storage", () => {
  expect(isTemporaryGameTesting()).toBe(false);
  gameLocalStorage.setItem("normal-result", "original");
  gameSessionStorage.setItem("normal-session", "original");
  expect(localStorage.getItem("normal-result")).toBe("original");
  expect(sessionStorage.getItem("normal-session")).toBe("original");
});

test("QA isolates writes, deletions, identity and result synchronization from both real stores", () => {
  localStorage.setItem("currentChild", JSON.stringify({ id: "real-child" }));
  localStorage.setItem("cbtTestResult", "real-result");
  localStorage.setItem("efGameResultOutbox:existing", "real-pending-upload");
  sessionStorage.setItem("activeHatSession_real-child", "real-session");
  const beforeLocal = snapshot(localStorage);
  const beforeSession = snapshot(sessionStorage);

  startTemporaryGameTesting();
  expect(JSON.parse(gameLocalStorage.getItem("currentChild")).id).toBe("temporary-game-tester");
  expect(gameLocalStorage.getItem("cbtTestResult")).toBeNull();
  gameLocalStorage.setItem("cbtTestResult", "preview-result");
  gameSessionStorage.setItem("activeHatSession_real-child", "preview-session");
  gameLocalStorage.removeItem("efGameResultOutbox:existing");

  for (const gameId of ["SRT", "PM", "CBT", "ARI", "LB", "DCCS"]) {
    const attempt = createTestAttempt({ gameId });
    attempt.begin();
    attempt.checkpoint({ trials: [{ correct: true }] });
    const rawResult = attempt.complete({ score: 100, trials: [{ correct: true }] });
    attempt.interrupt();
    for (const mode of ["test", "training"]) {
      const normalized = saveUnifiedResult({ gameId, mode, rawResult });
      expect(normalized.game.gameId).toBe(gameId);
      queueGameResult(normalized);
    }
  }
  expect(awardTrainingCoins).not.toHaveBeenCalled();
  expect(completeActiveRecommendation).not.toHaveBeenCalled();
  expect(snapshot(localStorage)).toEqual(beforeLocal);
  expect(snapshot(sessionStorage)).toEqual(beforeSession);

  resetGameTestingMemory();
  expect(gameLocalStorage.getItem("cbtTestResult")).toBeNull();
  expect(gameSessionStorage.getItem("activeHatSession_real-child")).toBeNull();
  gameLocalStorage.clear();
  gameSessionStorage.clear();
  expect(snapshot(localStorage)).toEqual(beforeLocal);
  expect(snapshot(sessionStorage)).toEqual(beforeSession);
});

test("refreshing a marked game URL retains QA isolation without storing a mode flag", () => {
  window.history.replaceState(null, "", "/training-cbt?gameTesting=1&level=5");
  jest.isolateModules(() => {
    const runtime = require("./runtime");
    expect(runtime.isTemporaryGameTesting()).toBe(true);
    runtime.gameLocalStorage.setItem("refresh-preview", "temporary");
    expect(localStorage.getItem("refresh-preview")).toBeNull();
  });
  window.history.replaceState(null, "", "/");
});

test("the ... shortcut ignores form input, held keys, modifiers and interrupted sequences", () => {
  const open = jest.fn();
  const handler = createGameTestingShortcut(open);
  const input = document.createElement("input");
  const press = (key = ".", options = {}) => handler({ key, target: document.body, preventDefault: jest.fn(), ...options });
  press(); press(); press();
  expect(open).toHaveBeenCalledTimes(1);
  press(".", { target: input }); press(".", { target: input }); press(".", { target: input });
  press(".", { repeat: true }); press(".", { ctrlKey: true });
  press(); press("a"); press(); press();
  expect(open).toHaveBeenCalledTimes(1);
  press();
  expect(open).toHaveBeenCalledTimes(2);
});
