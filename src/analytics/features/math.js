export const finiteNumbers = (values = []) =>
  values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite);

export const sum = (values = []) => finiteNumbers(values).reduce((total, value) => total + value, 0);

export const mean = (values = []) => {
  const numbers = finiteNumbers(values);
  return numbers.length ? sum(numbers) / numbers.length : null;
};

export const median = (values = []) => {
  const numbers = finiteNumbers(values).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
};

export const sampleSd = (values = []) => {
  const numbers = finiteNumbers(values);
  if (numbers.length < 2) return numbers.length === 1 ? 0 : null;
  const average = mean(numbers);
  return Math.sqrt(numbers.reduce((total, value) => total + ((value - average) ** 2), 0) / (numbers.length - 1));
};

export const quantile = (values = [], probability) => {
  const numbers = finiteNumbers(values).sort((a, b) => a - b);
  if (!numbers.length) return null;
  if (numbers.length === 1) return numbers[0];
  const position = (numbers.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return numbers[lower + 1] === undefined
    ? numbers[lower]
    : numbers[lower] + fraction * (numbers[lower + 1] - numbers[lower]);
};

export const iqr = (values = []) => {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  return q1 === null || q3 === null ? null : q3 - q1;
};

export const coefficientOfVariation = (values = []) => {
  const average = mean(values);
  const sd = sampleSd(values);
  return average === null || average === 0 || sd === null ? null : sd / average;
};

export const rate = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;

export const linearSlope = (values = []) => {
  const points = values
    .map((value, index) => ({ x: index, y: Number(value) }))
    .filter((point) => Number.isFinite(point.y));
  if (points.length < 2) return null;
  const xMean = mean(points.map((point) => point.x));
  const yMean = mean(points.map((point) => point.y));
  const denominator = points.reduce((total, point) => total + ((point.x - xMean) ** 2), 0);
  if (denominator === 0) return null;
  return points.reduce(
    (total, point) => total + ((point.x - xMean) * (point.y - yMean)),
    0
  ) / denominator;
};

export const pearsonCorrelation = (left = [], right = []) => {
  const pairs = left.map((value, index) => [Number(value), Number(right[index])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) return null;
  const xMean = mean(pairs.map(([x]) => x));
  const yMean = mean(pairs.map(([, y]) => y));
  const numerator = pairs.reduce((total, [x, y]) => total + ((x - xMean) * (y - yMean)), 0);
  const xSpread = Math.sqrt(pairs.reduce((total, [x]) => total + ((x - xMean) ** 2), 0));
  const ySpread = Math.sqrt(pairs.reduce((total, [, y]) => total + ((y - yMean) ** 2), 0));
  return xSpread && ySpread ? numerator / (xSpread * ySpread) : null;
};

export function describe(values = []) {
  const numbers = finiteNumbers(values);
  return {
    count: numbers.length,
    mean: mean(numbers),
    median: median(numbers),
    sd: sampleSd(numbers),
    min: numbers.length ? Math.min(...numbers) : null,
    max: numbers.length ? Math.max(...numbers) : null,
    iqr: iqr(numbers),
    cv: coefficientOfVariation(numbers),
  };
}
