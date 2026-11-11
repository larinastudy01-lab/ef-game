import { getNextLBTestVersion, markLBTestVersionUsed } from "./lbAssessmentVersion";
import { startTemporaryGameTesting } from "../temporaryGameTesting/runtime";

beforeEach(() => localStorage.clear());

test("formal use alternates 01/02 independently for each child; reading never consumes a copy", () => {
  expect(getNextLBTestVersion("a")).toBe("01");
  expect(getNextLBTestVersion("a")).toBe("01");
  expect(localStorage.length).toBe(0);
  markLBTestVersionUsed("a", "01");
  expect(getNextLBTestVersion("a")).toBe("02");
  expect(getNextLBTestVersion("b")).toBe("01");
  markLBTestVersionUsed("a", "02");
  expect(getNextLBTestVersion("a")).toBe("01");
  markLBTestVersionUsed("a", "landmark");
  markLBTestVersionUsed("a", "training");
  markLBTestVersionUsed(null, "01");
  expect(localStorage.getItem("lbTestLastVersion_a")).toBe("02");
  expect(localStorage.length).toBe(1);
});

test("QA alternation never advances the saved version of a real child", () => {
  localStorage.setItem("lbTestLastVersion_a", "01");
  startTemporaryGameTesting();
  expect(getNextLBTestVersion("a")).toBe("01");
  markLBTestVersionUsed("a", "01");
  expect(getNextLBTestVersion("a")).toBe("02");
  markLBTestVersionUsed("a", "02");
  expect(getNextLBTestVersion("a")).toBe("01");
  expect(localStorage.getItem("lbTestLastVersion_a")).toBe("01");
});
