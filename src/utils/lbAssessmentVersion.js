import { gameLocalStorage } from "../temporaryGameTesting/runtime";

const storageKey = (childId) => `lbTestLastVersion_${childId}`;

// Opening a page, watching STEP and practice do not consume a test version.
export function getNextLBTestVersion(childId, storage = gameLocalStorage) {
  if (!childId) return "01";
  return storage.getItem(storageKey(childId)) === "01" ? "02" : "01";
}

export function markLBTestVersionUsed(childId, version, storage = gameLocalStorage) {
  if (!childId || !["01", "02"].includes(version)) return;
  storage.setItem(storageKey(childId), version);
}
