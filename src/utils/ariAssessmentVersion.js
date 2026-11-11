import { gameLocalStorage, gameSessionStorage } from "../temporaryGameTesting/runtime";

const storageKey = (childId) => `ariTestLastVersion_${childId}`;

// Opening the page, watching STEP and practicing never consume a version.
export function getNextAriTestVersion(childId, storage = gameLocalStorage) {
  if (!childId) return "01";
  return storage.getItem(storageKey(childId)) === "01" ? "02" : "01";
}

export function markAriTestVersionUsed(childId, version, storage = gameLocalStorage) {
  if (!childId || !["01", "02"].includes(version)) return;
  storage.setItem(storageKey(childId), version);
}

export function getAriAssessmentChild() {
  for (const storage of [gameLocalStorage, gameSessionStorage]) {
    for (const key of ["ef_active_patient", "currentChild", "selectedChild"]) {
      try {
        const child = JSON.parse(storage.getItem(key));
        const childId = child?.childId || child?.id || child?.child_id;
        if (childId) return { ...child, childId: String(childId) };
      } catch { /* Try the next legacy profile. */ }
    }
    for (const key of ["ef_active_patient_id", "currentChildId", "selectedChildId"]) {
      const childId = storage.getItem(key);
      if (childId) return { childId };
    }
  }
  return null;
}
