export const ACTIVE_PATIENT_ID_KEY = "ef_active_patient_id";
export const ACTIVE_PATIENT_KEY = "ef_active_patient";

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

export function setActivePatient(patient) {
  const childId = patient?.childId || patient?.id || patient?.patientId;
  if (!childId) throw new Error("Cannot activate a patient without an id.");

  const normalized = {
    ...patient,
    childId,
    id: patient.id || childId,
    patientId: patient.patientId || patient.id || childId,
  };
  const serialized = JSON.stringify(normalized);

  for (const storage of availableStorages()) {
    storage.setItem(ACTIVE_PATIENT_ID_KEY, childId);
    storage.setItem(ACTIVE_PATIENT_KEY, serialized);
    for (const key of LEGACY_ID_KEYS) {
      storage.setItem(key, key.toLowerCase().includes("patient") ? normalized.patientId : childId);
    }
    for (const key of LEGACY_PROFILE_KEYS) storage.setItem(key, serialized);
  }

  return normalized;
}

export function getActivePatient() {
  for (const storage of availableStorages()) {
    const raw = storage.getItem(ACTIVE_PATIENT_KEY) || storage.getItem("currentChild");
    if (!raw) continue;
    try {
      return JSON.parse(raw);
    } catch {
      // Try the next storage when legacy data is malformed.
    }
  }
  return null;
}

export function clearActivePatient() {
  for (const storage of availableStorages()) {
    for (const key of [ACTIVE_PATIENT_ID_KEY, ACTIVE_PATIENT_KEY, ...LEGACY_ID_KEYS, ...LEGACY_PROFILE_KEYS]) {
      storage.removeItem(key);
    }
  }
}
