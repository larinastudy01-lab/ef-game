import {
  ACTIVE_PATIENT_ID_KEY,
  ACTIVE_PATIENT_KEY,
  clearActivePatient,
  getActivePatient,
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
  expect(JSON.parse(localStorage.getItem(ACTIVE_PATIENT_KEY)).nickname).toBe("Test");
  expect(sessionStorage.getItem("currentChildId")).toBe("patient-1");
  expect(localStorage.getItem("currentPatientId")).toBe("patient-1");
  expect(getActivePatient()).toMatchObject({ childId: "patient-1" });
});

test("clears canonical and compatible aliases", () => {
  setActivePatient({ childId: "child-1" });
  clearActivePatient();

  expect(localStorage.getItem(ACTIVE_PATIENT_ID_KEY)).toBeNull();
  expect(sessionStorage.getItem("currentChild")).toBeNull();
});
