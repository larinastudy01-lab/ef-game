import { ENABLE_TEMPORARY_GAME_TESTING } from "../config/featureFlags";

export const GAME_TESTING_ROUTE = "/game-testing";
export const GAME_TESTING_QUERY = "gameTesting";
const listeners = new Set();
const memoryLocal = new Map();
const memorySession = new Map();
let active = ENABLE_TEMPORARY_GAME_TESTING && typeof window !== "undefined" && (
  new URLSearchParams(window.location.search).get(GAME_TESTING_QUERY) === "1" ||
  window.location.pathname.replace(/\/$/, "").endsWith(GAME_TESTING_ROUTE)
);

export const isTemporaryGameTesting = () => active;
export const subscribeToGameTesting = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Use a fictional child, never a selected patient's identity or saved progress.
export function resetGameTestingMemory() {
  memoryLocal.clear();
  memorySession.clear();
  const child = { id: "temporary-game-tester", childId: "temporary-game-tester", name: "遊戲測試" };
  memoryLocal.set("currentChild", JSON.stringify(child));
  memoryLocal.set("currentChildId", child.id);
  memorySession.set("currentChild", JSON.stringify(child));
}

export function startTemporaryGameTesting() {
  if (!ENABLE_TEMPORARY_GAME_TESTING) return;
  resetGameTestingMemory();
  active = true;
  listeners.forEach((listener) => listener());
}

if (active) resetGameTestingMemory();

function memoryStorage(map) {
  return {
    get length() { return map.size; },
    key: (index) => Array.from(map.keys())[index] ?? null,
    getItem: (key) => map.get(String(key)) ?? null,
    setItem: (key, value) => { map.set(String(key), String(value)); },
    removeItem: (key) => { map.delete(String(key)); },
    clear: () => map.clear(),
  };
}

// Explicit adapters keep game caches in memory during QA. Normal play uses the
// original browser storage; nothing on window or Storage.prototype is patched.
function gameStorage(kind, map) {
  const memory = memoryStorage(map);
  const current = () => active || typeof window === "undefined" ? memory : window[kind];
  return new Proxy({}, {
    get: (_, key) => {
      const storage = current();
      const value = storage[key];
      return typeof value === "function" ? value.bind(storage) : value;
    },
    ownKeys: () => active ? Array.from(map.keys()) : Object.keys(current()),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}

export const gameLocalStorage = gameStorage("localStorage", memoryLocal);
export const gameSessionStorage = gameStorage("sessionStorage", memorySession);

export function gameTestingUrl(path) {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set(GAME_TESTING_QUERY, "1");
  return `${pathname}?${params}`;
}

const GAME_PATHS = new Set([
  GAME_TESTING_ROUTE, "/hat-sticker-game",
  ...["srt", "picture-memory", "cbt", "linking-balloons", "ari", "dccs"].flatMap(
    (id) => [`/test-${id}`, `/training-${id}`]
  ),
  ...["srt", "picture-memory", "cbt", "lb", "ari", "dccs"].map((id) => `/result-${id}`),
]);
export const isGameTestingPath = (path) => GAME_PATHS.has(path);

export function createGameTestingShortcut(open) {
  let dots = 0;
  let lastTime = 0;
  return (event) => {
    const editing = event.target?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
    if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || editing) {
      dots = 0;
      return;
    }
    const now = Date.now();
    dots = event.key === "." ? (now - lastTime <= 1500 ? dots + 1 : 1) : 0;
    lastTime = now;
    if (dots === 3) {
      dots = 0;
      event.preventDefault();
      open();
    }
  };
}
