import { describe, finiteNumbers, iqr, mean, median, sampleSd } from "../features/math";

export function calculateSkewness(values = []) {
  const numbers = finiteNumbers(values);
  if (numbers.length < 3) return null;
  const average = mean(numbers);
  const sd = sampleSd(numbers);
  if (!sd) return 0;
  const n = numbers.length;
  return (n / ((n - 1) * (n - 2))) * numbers.reduce(
    (total, value) => total + (((value - average) / sd) ** 3),
    0
  );
}

export function calculateBoxPlot(values = []) {
  const numbers = finiteNumbers(values).sort((a, b) => a - b);
  if (!numbers.length) return { min: null, q1: null, median: null, q3: null, max: null, lowerFence: null, upperFence: null, outliers: [] };
  const spread = iqr(numbers);
  const q1 = percentile(numbers, 0.25);
  const q3 = percentile(numbers, 0.75);
  const lowerFence = q1 - 1.5 * spread;
  const upperFence = q3 + 1.5 * spread;
  return {
    min: Math.min(...numbers), q1, median: median(numbers), q3, max: Math.max(...numbers),
    lowerFence, upperFence,
    outliers: numbers.filter((value) => value < lowerFence || value > upperFence),
  };
}

function percentile(numbers, probability) {
  if (!numbers.length) return null;
  const position = (numbers.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return numbers[lower + 1] === undefined ? numbers[lower] : numbers[lower] + fraction * (numbers[lower + 1] - numbers[lower]);
}

export function buildHistogram(values = [], requestedBins = null) {
  const numbers = finiteNumbers(values);
  if (!numbers.length) return [];
  const minimum = Math.min(...numbers);
  const maximum = Math.max(...numbers);
  if (minimum === maximum) return [{ lower: minimum, upper: maximum, count: numbers.length }];
  const spread = iqr(numbers);
  const fdWidth = spread > 0 ? (2 * spread) / Math.cbrt(numbers.length) : null;
  const binCount = requestedBins || Math.max(1, Math.min(50,
    fdWidth ? Math.ceil((maximum - minimum) / fdWidth) : Math.ceil(Math.sqrt(numbers.length))
  ));
  const width = (maximum - minimum) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: minimum + index * width,
    upper: index === binCount - 1 ? maximum : minimum + (index + 1) * width,
    count: 0,
  }));
  numbers.forEach((value) => {
    const index = Math.min(binCount - 1, Math.floor((value - minimum) / width));
    bins[index].count += 1;
  });
  return bins;
}

export function analyzeDistribution(values = [], totalCount = values.length) {
  const numbers = finiteNumbers(values);
  const boxPlot = calculateBoxPlot(numbers);
  const skewness = calculateSkewness(numbers);
  return {
    ...describe(numbers),
    missing_count: Math.max(0, totalCount - numbers.length),
    missing_rate: totalCount > 0 ? Math.max(0, totalCount - numbers.length) / totalCount : null,
    skewness,
    histogram: buildHistogram(numbers),
    box_plot: boxPlot,
    outlier_count: boxPlot.outliers.length,
    outlier_rate: numbers.length ? boxPlot.outliers.length / numbers.length : null,
    distribution_summary: numbers.length < 3
      ? "Insufficient observations to characterize distribution shape."
      : `${skewness !== null && Math.abs(skewness) < 1 ? "Relatively symmetric" : "Skewed"} pattern; normality was not assumed.`,
  };
}

