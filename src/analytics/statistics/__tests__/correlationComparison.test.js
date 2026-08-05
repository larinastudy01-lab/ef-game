import { buildFeatureCorrelationMatrix, calculateCorrelation } from "../correlations";
import { compareGroups } from "../groupComparisons";
import { benjaminiHochberg } from "../multipleComparison";

test("small samples default to Spearman and explain the method", () => {
  const result = calculateCorrelation([1, 2, 3, 4], [2, 4, 6, 8]);
  expect(result.method).toBe("spearman");
  expect(result.coefficient).toBeCloseTo(1);
  expect(result.method_reason).toMatch(/normality was not assumed/i);
});

test("missing paired values are excluded rather than converted to zero", () => {
  const result = calculateCorrelation([1, null, 3], [1, 2, 3]);
  expect(result.n).toBe(2);
});

test("feature matrix identifies method for every pair", () => {
  const matrix = buildFeatureCorrelationMatrix([
    { a: 1, b: 4 }, { a: 2, b: 3 }, { a: 3, b: 2 }, { a: 4, b: 1 },
  ], ["a", "b"]);
  expect(matrix).toHaveLength(3);
  expect(matrix.every((row) => ["pearson", "spearman"].includes(row.method))).toBe(true);
});

test("Benjamini-Hochberg adjusted values are monotonic and bounded", () => {
  const adjusted = benjaminiHochberg([{ p_value: 0.01 }, { p_value: 0.04 }, { p_value: 0.03 }]);
  expect(adjusted.every((row) => row.p_value_adjusted >= row.p_value && row.p_value_adjusted <= 1)).toBe(true);
});

test("group comparison refuses inadequate samples", () => {
  const result = compareGroups([[1, 2], [3, 4]]);
  expect(result.performed).toBe(false);
  expect(result.reason).toMatch(/at least 5/i);
});

test("non-normal independent comparison returns effect size and bootstrap CI", () => {
  const result = compareGroups([[1, 2, 3, 4, 5], [5, 6, 7, 8, 9]], { randomSeed: 7, iterations: 100 });
  expect(result.method).toBe("Mann-Whitney U");
  expect(result.effect_size.name).toBe("rank-biserial correlation");
  expect(result.confidence_interval.lower).not.toBeNull();
});

test("normal assumption must be explicit for Welch t-test", () => {
  const result = compareGroups([[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]], { distributionAssumption: "approximately_normal", iterations: 100 });
  expect(result.method).toBe("Welch t-test");
  expect(result.p_value).not.toBeNull();
  expect(result.effect_size).not.toBeNull();
});

