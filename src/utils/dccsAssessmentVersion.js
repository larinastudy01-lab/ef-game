import { gameLocalStorage } from "../temporaryGameTesting/runtime";

const storageKey = (childId) => `dccsTestLastVersion_${childId}`;

// Page opening, STEP and practice do not consume a copy.
export function getNextDccsTestVersion(childId, storage = gameLocalStorage) {
  if (!childId) return "01";
  return storage.getItem(storageKey(childId)) === "01" ? "02" : "01";
}

export function markDccsTestVersionUsed(childId, version, storage = gameLocalStorage) {
  if (!childId || !["01", "02"].includes(version)) return;
  storage.setItem(storageKey(childId), version);
}
