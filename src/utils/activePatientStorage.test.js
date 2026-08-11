import {
  ACTIVE_PATIENT_ID_KEY,
  ACTIVE_PATIENT_KEY,
  ACTIVE_PATIENT_STORAGE_VERSION,
  ACTIVE_PATIENT_VERSION_KEY,
  clearActivePatient,
  getActivePatient,
  getActivePatientId,
  setActivePatient,
} from "./activePatientStorage";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test("writes canonical and legacy active-patient keys", () => {
  const patient = setActivePatient({ id: "patient-1", nickname: "Test" });

  expect(patient.childId).toBe("patient-1");
  expect(localStorage.getItem(ACTIVE_PATIENT_ID_KEY)).toBe("patient-1");
  expect(localStorage.getItem(ACTIVE_PATIENT_VERSION_KEY)).toBe(
    String(ACTIVE_PATIENT_STORAGE_VERSION)
  );
  expect(JSON.parse(localStorage.getItem(ACTIVE_PATIENT_KEY)).nickname).toBe("Test");
  expect(sessionStorage.getItem("currentChildId")).toBe("patient-1");
  expect(localStorage.getItem("currentPatientId")).toBe("patient-1");
  expect(getActivePatient()).toMatchObject({ childId: "patient-1" });
  expect(getActivePatientId()).toBe("patient-1");
});

test("migrates a legacy profile into canonical versioned storage", () => {
  localStorage.setItem("selectedChild", JSON.stringify({ id: "legacy-1", nickname: "Legacy" }));

  expect(getActivePatient()).toMatchObject({ childId: "legacy-1", nickname: "Legacy" });
  expect(localStorage.getItem(ACTIVE_PATIENT_ID_KEY)).toBe("legacy-1");
  expect(localStorage.getItem(ACTIVE_PATIENT_VERSION_KEY)).toBe("1");
});

test("recovers and migrates an id-only legacy selection", () => {
  sessionStorage.setItem("selectedChildId", "legacy-id-only");

  expect(getActivePatient()).toMatchObject({ childId: "legacy-id-only" });
  expect(localStorage.getItem(ACTIVE_PATIENT_ID_KEY)).toBe("legacy-id-only");
});

test("ignores malformed canonical data and falls back to a valid legacy profile", () => {
  localStorage.setItem(ACTIVE_PATIENT_KEY, "{broken-json");
  localStorage.setItem("currentChild", JSON.stringify({ childId: "fallback-1" }));

  expect(getActivePatientId()).toBe("fallback-1");
});

test("clears canonical and compatible aliases", () => {
  setActivePatient({ childId: "child-1" });
  clearActivePatient();

  expect(localStorage.getItem(ACTIVE_PATIENT_ID_KEY)).toBeNull();
  expect(localStorage.getItem(ACTIVE_PATIENT_VERSION_KEY)).toBeNull();
  expect(sessionStorage.getItem("currentChild")).toBeNull();
});
