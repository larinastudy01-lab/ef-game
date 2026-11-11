import { getNextDccsTestVersion, markDccsTestVersionUsed } from "./dccsAssessmentVersion";
import { resetGameTestingMemory, startTemporaryGameTesting } from "../temporaryGameTesting/runtime";

beforeEach(() => localStorage.clear());

test("copy selection is stable before formal use and alternates independently for each child", () => {
  expect(getNextDccsTestVersion("a")).toBe("01");
  expect(getNextDccsTestVersion("a")).toBe("01");
  expect(localStorage.length).toBe(0);
  for (const [used, next] of [["01", "02"], ["02", "01"], ["01", "02"]]) {
    markDccsTestVersionUsed("a", used);
    expect(getNextDccsTestVersion("a")).toBe(next);
    expect(getNextDccsTestVersion("b")).toBe("01");
  }
  markDccsTestVersionUsed("a", "training");
  markDccsTestVersionUsed("a", "03");
  markDccsTestVersionUsed(null, "01");
  expect(localStorage.getItem("dccsTestLastVersion_a")).toBe("01");
  expect(getNextDccsTestVersion(null)).toBe("01");
});

test("QA copy history stays in memory and cannot change a real child's saved version", () => {
  localStorage.setItem("dccsTestLastVersion_a", "02");
  startTemporaryGameTesting();
  resetGameTestingMemory();
  expect(getNextDccsTestVersion("a")).toBe("01");
  markDccsTestVersionUsed("a", "01");
  expect(getNextDccsTestVersion("a")).toBe("02");
  expect(localStorage.getItem("dccsTestLastVersion_a")).toBe("02");
  resetGameTestingMemory();
  expect(getNextDccsTestVersion("a")).toBe("01");
});
