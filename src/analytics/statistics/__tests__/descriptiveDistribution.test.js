import { calculateDescriptiveStatistics } from "../descriptive";
import { analyzeDistribution, buildHistogram } from "../distributions";

test("descriptive statistics report N, central tendency, spread and missingness", () => {
  const [result] = calculateDescriptiveStatistics([
    { accuracy: 0.5 }, { accuracy: 0.75 }, { accuracy: 1 }, { accuracy: null },
  ], ["accuracy"]);
  expect(result.n).toBe(3);
  expect(result.mean).toBe(0.75);
  expect(result.median).toBe(0.75);
  expect(result.min).toBe(0.5);
  expect(result.max).toBe(1);
  expect(result.missing_count).toBe(1);
  expect(result.distribution_summary).toMatch(/normality was not assumed/i);
});

test("histogram retains every numeric observation", () => {
  const histogram = buildHistogram([1, 2, 3, 4, 100]);
  expect(histogram.reduce((total, bin) => total + bin.count, 0)).toBe(5);
});

test("Tukey outlier summary does not delete observations", () => {
  const result = analyzeDistribution([1, 1, 2, 2, 2, 3, 100]);
  expect(result.count).toBe(7);
  expect(result.outlier_count).toBe(1);
  expect(result.box_plot.outliers).toEqual([100]);
});

