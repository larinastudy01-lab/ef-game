import { getNextSrtTestVersion, markSrtTestVersionUsed } from "./srtAssessmentVersion";
import { startTemporaryGameTesting } from "../temporaryGameTesting/runtime";

beforeEach(() => localStorage.clear());

test("selection is stable until a formal start and each child has an independent sequence", () => {
  expect(getNextSrtTestVersion("a")).toBe("01");
  expect(getNextSrtTestVersion("a")).toBe("01");
  expect(localStorage.length).toBe(0);
  markSrtTestVersionUsed("a", "01");
  expect(getNextSrtTestVersion("a")).toBe("02");
  expect(getNextSrtTestVersion("b")).toBe("01");
  markSrtTestVersionUsed("a", "02");
  expect(getNextSrtTestVersion("a")).toBe("01");
  markSrtTestVersionUsed("a", "training");
  markSrtTestVersionUsed(null, "01");
  expect(localStorage.getItem("srtTestLastVersion_a")).toBe("02");
  expect(localStorage.length).toBe(1);
});

test("QA alternation uses memory and never advances a real child's saved version", () => {
  localStorage.setItem("srtTestLastVersion_a", "01");
  startTemporaryGameTesting();
  expect(getNextSrtTestVersion("a")).toBe("01");
  markSrtTestVersionUsed("a", "01");
  expect(getNextSrtTestVersion("a")).toBe("02");
  markSrtTestVersionUsed("a", "02");
  expect(getNextSrtTestVersion("a")).toBe("01");
  expect(localStorage.getItem("srtTestLastVersion_a")).toBe("01");
});
