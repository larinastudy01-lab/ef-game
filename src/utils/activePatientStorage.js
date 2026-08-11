export const ACTIVE_PATIENT_ID_KEY = "ef_active_patient_id";
export const ACTIVE_PATIENT_KEY = "ef_active_patient";
export const ACTIVE_PATIENT_VERSION_KEY = "ef_active_patient_version";
export const ACTIVE_PATIENT_STORAGE_VERSION = 1;

const LEGACY_ID_KEYS = [
  "currentChildId", "selectedChildId", "childId",
  "selectedPatientId", "currentPatientId",
];
const LEGACY_PROFILE_KEYS = [
  "currentChild", "selectedChild", "activeChild",
  "selectedPatient", "currentPatient",
];

const availableStorages = () => {
  if (typeof window === "undefined") return [];
  return [window.localStorage, window.sessionStorage].filter(Boolean);
};

const safeGet = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeParseObject = (value) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
};

const normalizePatient = (patient) => {
  if (!patient || typeof patient !== "object" || Array.isArray(patient)) return null;
  const rawId = patient.childId || patient.id || patient.patientId;
  if (rawId === null || rawId === undefined || String(rawId).trim() === "") return null;

  const childId = String(rawId);
  return {
    ...patient,
    childId,
    id: patient.id || childId,
    patientId: patient.patientId || patient.id || childId,
  };
};

const writePatientToStorage = (storage, normalized, serialized) => {
  try {
    storage.setItem(ACTIVE_PATIENT_VERSION_KEY, String(ACTIVE_PATIENT_STORAGE_VERSION));
    storage.setItem(ACTIVE_PATIENT_ID_KEY, normalized.childId);
    storage.setItem(ACTIVE_PATIENT_KEY, serialized);

    // Legacy aliases remain write-through until every game page reads the
    // canonical keys. Removing them early would orphan existing user flows.
    for (const key of LEGACY_ID_KEYS) {
      storage.setItem(
        key,
        key.toLowerCase().includes("patient") ? normalized.patientId : normalized.childId
      );
    }
    for (const key of LEGACY_PROFILE_KEYS) storage.setItem(key, serialized);
    return true;
  } catch {
    // Private browsing or quota limits can disable one storage while the other
    // remains available, so callers should continue trying the fallback store.
    return false;
  }
};

export function setActivePatient(patient) {
  const normalized = normalizePatient(patient);
  if (!normalized) throw new Error("Cannot activate a patient without an id.");

  const serialized = JSON.stringify(normalized);
  // Do not use Array#some here: it would stop after localStorage succeeds and
  // leave sessionStorage aliases stale for pages that still read that store.
  const writeResults = availableStorages().map((storage) =>
    writePatientToStorage(storage, normalized, serialized)
  );
  const wroteToStorage = writeResults.some(Boolean);

  if (!wroteToStorage) {
    throw new Error("Active patient could not be saved in browser storage.");
  }
  return normalized;
}

export function getActivePatient() {
  const storages = availableStorages();

  for (const storage of storages) {
    const candidateKeys = [ACTIVE_PATIENT_KEY, ...LEGACY_PROFILE_KEYS];
    for (const key of candidateKeys) {
      const normalized = normalizePatient(safeParseObject(safeGet(storage, key)));
      if (!normalized) continue;

      // Reading an old alias also migrates it to the versioned canonical keys.
      // Migration is best-effort so a full storage quota never blocks gameplay.
      try {
        setActivePatient(normalized);
      } catch {
        // The valid in-memory profile is still safe to return.
      }
      return normalized;
    }
  }

  // Some early releases stored only an id. Preserve navigation in that case;
  // the full profile will be refreshed from Supabase on the selection page.
  for (const storage of storages) {
    for (const key of [ACTIVE_PATIENT_ID_KEY, ...LEGACY_ID_KEYS]) {
      const childId = safeGet(storage, key)?.trim();
      if (!childId) continue;
      const normalized = normalizePatient({ childId });
      try {
        setActivePatient(normalized);
      } catch {
        // Return the reconstructed identity even when migration cannot persist.
      }
      return normalized;
    }
  }

  return null;
}

export function getActivePatientId() {
  return getActivePatient()?.childId || null;
}

export function clearActivePatient() {
  const allKeys = [
    ACTIVE_PATIENT_VERSION_KEY,
    ACTIVE_PATIENT_ID_KEY,
    ACTIVE_PATIENT_KEY,
    ...LEGACY_ID_KEYS,
    ...LEGACY_PROFILE_KEYS,
  ];

  for (const storage of availableStorages()) {
    for (const key of allKeys) {
      try {
        storage.removeItem(key);
      } catch {
        // Clearing one unavailable storage must not prevent clearing the other.
      }
    }
  }
}
