import { getAriAssessmentChild, getNextAriTestVersion, markAriTestVersionUsed } from "./ariAssessmentVersion";
import { gameLocalStorage, startTemporaryGameTesting } from "../temporaryGameTesting/runtime";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

test("formal starts rotate 01 → 02 → 01 independently for each child", () => {
  expect(getNextAriTestVersion("a")).toBe("01");
  expect(getNextAriTestVersion("a")).toBe("01");
  expect(localStorage.length).toBe(0);
  markAriTestVersionUsed("a", "01");
  expect(getNextAriTestVersion("a")).toBe("02");
  expect(getNextAriTestVersion("b")).toBe("01");
  markAriTestVersionUsed("a", "02");
  expect(getNextAriTestVersion("a")).toBe("01");
  markAriTestVersionUsed("a", "training");
  markAriTestVersionUsed(null, "01");
  expect(localStorage.getItem("ariTestLastVersion_a")).toBe("02");
  expect(localStorage.length).toBe(1);
});

test("the selected child can be resolved from legacy and session profiles", () => {
  localStorage.setItem("currentChild", "invalid json");
  sessionStorage.setItem("currentChild", JSON.stringify({ id: "session-child" }));
  expect(getAriAssessmentChild()).toMatchObject({ childId: "session-child" });
  localStorage.setItem("ef_active_patient", JSON.stringify({ childId: "active-child" }));
  expect(getAriAssessmentChild()).toMatchObject({ childId: "active-child" });
});

test("QA rotation and child selection use isolated memory", () => {
  localStorage.setItem("ariTestLastVersion_a", "02");
  localStorage.setItem("currentChild", JSON.stringify({ childId: "real-child" }));
  startTemporaryGameTesting();
  expect(getAriAssessmentChild().childId).toBe("temporary-game-tester");
  expect(getNextAriTestVersion("a")).toBe("01");
  markAriTestVersionUsed("a", "01");
  expect(getNextAriTestVersion("a")).toBe("02");
  expect(gameLocalStorage.getItem("ariTestLastVersion_a")).toBe("01");
  expect(localStorage.getItem("ariTestLastVersion_a")).toBe("02");
});
