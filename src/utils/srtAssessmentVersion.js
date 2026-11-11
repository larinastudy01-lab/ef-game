import { gameLocalStorage } from "../temporaryGameTesting/runtime";

const storageKey = (childId) => `srtTestLastVersion_${childId}`;

// Reading/preparing a test never consumes a version. Only a formal start does.
export function getNextSrtTestVersion(childId, storage = gameLocalStorage) {
  if (!childId) return "01";
  const lastVersion = storage.getItem(storageKey(childId));
  return lastVersion === "01" ? "02" : "01";
}

export function markSrtTestVersionUsed(childId, version, storage = gameLocalStorage) {
  if (!childId || !["01", "02"].includes(version)) return;
  storage.setItem(storageKey(childId), version);
}
