import { clampNumber, getTodayKey, safeParse } from "./trainingDataUtils";

describe("training data utilities", () => {
  test("parses JSON and preserves the requested fallback", () => {
    expect(safeParse('{"level":2}')).toEqual({ level: 2 });
    expect(safeParse("invalid", [])).toEqual([]);
    expect(safeParse("", null)).toBeNull();
  });

  test("clamps numeric values", () => {
    expect(clampNumber(5, 1, 10)).toBe(5);
    expect(clampNumber(-2, 1, 10)).toBe(1);
    expect(clampNumber(20, 1, 10)).toBe(10);
    expect(clampNumber("invalid", 1, 10)).toBe(1);
  });

  test("creates a local calendar date key", () => {
    expect(getTodayKey(new Date(2026, 7, 7, 23, 59))).toBe("2026-08-07");
  });
});
