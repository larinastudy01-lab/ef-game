// Numerical helpers are used only after sample-size/design gates pass.
export function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - polynomial * Math.exp(-(x ** 2)));
}

export const normalCdf = (value) => 0.5 * (1 + erf(value / Math.sqrt(2)));

export function logGamma(value) {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = 0.99999999999980993;
  const z = value - 1;
  coefficients.forEach((coefficient, index) => { x += coefficient / (z + index + 1); });
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a, b, x) {
  const maxIterations = 200;
  const epsilon = 3e-12;
  const tiny = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration;
    let aa = (iteration * (b - iteration) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = -((a + iteration) * (qab + iteration) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

export function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betaFraction(a, b, x)) / a
    : 1 - (front * betaFraction(b, a, 1 - x)) / b;
}

export function twoSidedTTestP(tStatistic, degreesOfFreedom) {
  if (!Number.isFinite(tStatistic) || degreesOfFreedom <= 0) return null;
  const x = degreesOfFreedom / (degreesOfFreedom + tStatistic ** 2);
  return Math.min(1, regularizedBeta(x, degreesOfFreedom / 2, 0.5));
}

export function fTestP(fStatistic, df1, df2) {
  if (!Number.isFinite(fStatistic) || df1 <= 0 || df2 <= 0) return null;
  const x = (df1 * fStatistic) / (df1 * fStatistic + df2);
  return 1 - regularizedBeta(x, df1 / 2, df2 / 2);
}

function regularizedGammaP(shape, x) {
  if (x <= 0) return 0;
  if (x < shape + 1) {
    let sum = 1 / shape;
    let term = sum;
    let adjustedShape = shape;
    for (let index = 1; index < 200; index += 1) {
      adjustedShape += 1;
      term *= x / adjustedShape;
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-12) break;
    }
    return sum * Math.exp(-x + shape * Math.log(x) - logGamma(shape));
  }
  let b = x + 1 - shape;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let index = 1; index < 200; index += 1) {
    const an = -index * (index - shape);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  return 1 - Math.exp(-x + shape * Math.log(x) - logGamma(shape)) * h;
}

export const chiSquareP = (statistic, degreesOfFreedom) =>
  statistic < 0 || degreesOfFreedom <= 0 ? null : 1 - regularizedGammaP(degreesOfFreedom / 2, statistic / 2);

