import { averageFiniteRounded } from "./numericUtils";

describe("numeric utilities", () => {
  test("averages finite numbers and rounds the result", () => {
    expect(averageFiniteRounded([10, 11, 12])).toBe(11);
    expect(averageFiniteRounded([10, 11])).toBe(11);
  });

  test("ignores non-numeric and non-finite values", () => {
    expect(averageFiniteRounded([10, NaN, Infinity, "20"])).toBe(10);
    expect(averageFiniteRounded([])).toBe(0);
  });
});
