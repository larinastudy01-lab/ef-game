import { finiteNumbers, mean, median, sampleSd } from "../features/math";
import { fTestP, normalCdf, twoSidedTTestP, chiSquareP } from "./inferenceMath";
import { MIN_INFERENTIAL_SAMPLE } from "./version";

function seededRandom(seed = 20260730) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))];
}

function bootstrapDifference(left, right, statistic, options = {}) {
  const iterations = options.iterations || 1000;
  const random = seededRandom(options.randomSeed);
  const estimates = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const leftSample = Array.from({ length: left.length }, () => left[Math.floor(random() * left.length)]);
    const rightSample = Array.from({ length: right.length }, () => right[Math.floor(random() * right.length)]);
    estimates.push(statistic(leftSample) - statistic(rightSample));
  }
  estimates.sort((a, b) => a - b);
  return { lower: percentile(estimates, 0.025), upper: percentile(estimates, 0.975), method: `percentile bootstrap (${iterations}, seed ${options.randomSeed || 20260730})` };
}

function rankValues(values) {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length);
  for (let start = 0; start < indexed.length;) {
    let end = start + 1;
    while (end < indexed.length && indexed[end].value === indexed[start].value) end += 1;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) ranks[indexed[index].index] = rank;
    start = end;
  }
  return ranks;
}

const insufficient = (reason, method = null) => ({ performed: false, method, reason, p_value: null, effect_size: null, confidence_interval: null });

function welchT(left, right, options) {
  const leftMean = mean(left); const rightMean = mean(right);
  const leftSd = sampleSd(left); const rightSd = sampleSd(right);
  const leftVarianceTerm = (leftSd ** 2) / left.length;
  const rightVarianceTerm = (rightSd ** 2) / right.length;
  const standardError = Math.sqrt(leftVarianceTerm + rightVarianceTerm);
  if (!standardError) return insufficient("No variance available for Welch t-test.", "Welch t-test");
  const statistic = (leftMean - rightMean) / standardError;
  const df = ((leftVarianceTerm + rightVarianceTerm) ** 2)
    / (((leftVarianceTerm ** 2) / (left.length - 1)) + ((rightVarianceTerm ** 2) / (right.length - 1)));
  const pooledSd = Math.sqrt((((left.length - 1) * leftSd ** 2) + ((right.length - 1) * rightSd ** 2)) / (left.length + right.length - 2));
  return {
    performed: true, method: "Welch t-test", statistic, degrees_of_freedom: df,
    p_value: twoSidedTTestP(statistic, df), p_value_method: "Welch-Satterthwaite t distribution",
    difference: leftMean - rightMean,
    effect_size: { name: "Cohen d", value: pooledSd ? (leftMean - rightMean) / pooledSd : null },
    confidence_interval: bootstrapDifference(left, right, mean, options),
  };
}

function mannWhitney(left, right, options) {
  const combined = [...left, ...right];
  const ranks = rankValues(combined);
  const rankSumLeft = ranks.slice(0, left.length).reduce((total, rank) => total + rank, 0);
  const uLeft = rankSumLeft - (left.length * (left.length + 1)) / 2;
  const uRight = left.length * right.length - uLeft;
  const u = Math.min(uLeft, uRight);
  const expected = (left.length * right.length) / 2;
  const sd = Math.sqrt((left.length * right.length * (left.length + right.length + 1)) / 12);
  const z = sd ? (uLeft - expected) / sd : 0;
  return {
    performed: true, method: "Mann-Whitney U", statistic: u,
    p_value: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))), p_value_method: "normal approximation; ties reported as a limitation",
    difference: median(left) - median(right),
    effect_size: { name: "rank-biserial correlation", value: 1 - (2 * u) / (left.length * right.length) },
    confidence_interval: bootstrapDifference(left, right, median, options),
  };
}

function pairedT(left, right, options) {
  const differences = left.map((value, index) => value - right[index]);
  const differenceMean = mean(differences);
  const differenceSd = sampleSd(differences);
  const statistic = differenceSd ? differenceMean / (differenceSd / Math.sqrt(differences.length)) : null;
  if (statistic === null) return insufficient("No paired-difference variance.", "paired t-test");
  return {
    performed: true, method: "paired t-test", statistic, degrees_of_freedom: differences.length - 1,
    p_value: twoSidedTTestP(statistic, differences.length - 1), p_value_method: "Student t distribution",
    difference: differenceMean,
    effect_size: { name: "Cohen dz", value: differenceMean / differenceSd },
    confidence_interval: bootstrapDifference(differences, Array(differences.length).fill(0), mean, options),
  };
}

function wilcoxon(left, right, options) {
  const differences = left.map((value, index) => value - right[index]).filter((value) => value !== 0);
  if (differences.length < MIN_INFERENTIAL_SAMPLE) return insufficient("Fewer than five non-zero paired differences.", "Wilcoxon signed-rank");
  const ranks = rankValues(differences.map(Math.abs));
  const positive = ranks.reduce((total, rank, index) => total + (differences[index] > 0 ? rank : 0), 0);
  const negative = ranks.reduce((total, rank, index) => total + (differences[index] < 0 ? rank : 0), 0);
  const expected = differences.length * (differences.length + 1) / 4;
  const sd = Math.sqrt(differences.length * (differences.length + 1) * (2 * differences.length + 1) / 24);
  const z = sd ? (positive - expected) / sd : 0;
  return {
    performed: true, method: "Wilcoxon signed-rank", statistic: Math.min(positive, negative),
    p_value: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))), p_value_method: "normal approximation",
    difference: median(differences),
    effect_size: { name: "matched-pairs rank-biserial", value: (positive - negative) / (positive + negative) },
    confidence_interval: bootstrapDifference(differences, Array(differences.length).fill(0), median, options),
  };
}

function oneWayAnova(groups) {
  const all = groups.flat(); const grandMean = mean(all);
  const between = groups.reduce((total, group) => total + group.length * ((mean(group) - grandMean) ** 2), 0);
  const within = groups.reduce((total, group) => total + group.reduce((subtotal, value) => subtotal + ((value - mean(group)) ** 2), 0), 0);
  const df1 = groups.length - 1; const df2 = all.length - groups.length;
  const statistic = (between / df1) / (within / df2);
  return { performed: true, method: "one-way ANOVA", statistic, degrees_of_freedom: [df1, df2], p_value: fTestP(statistic, df1, df2), p_value_method: "F distribution", effect_size: { name: "eta squared", value: between / (between + within) }, confidence_interval: null, confidence_interval_reason: "Omnibus eta-squared CI is not estimated in statistics_v1." };
}

function kruskalWallis(groups) {
  const combined = groups.flat(); const ranks = rankValues(combined);
  let offset = 0;
  const rankSums = groups.map((group) => {
    const total = ranks.slice(offset, offset + group.length).reduce((sum, rank) => sum + rank, 0);
    offset += group.length;
    return total;
  });
  const statistic = (12 / (combined.length * (combined.length + 1)))
    * rankSums.reduce((total, rankSum, index) => total + (rankSum ** 2) / groups[index].length, 0)
    - 3 * (combined.length + 1);
  const df = groups.length - 1;
  return { performed: true, method: "Kruskal-Wallis", statistic, degrees_of_freedom: df, p_value: chiSquareP(statistic, df), p_value_method: "chi-square approximation", effect_size: { name: "epsilon squared", value: Math.max(0, (statistic - groups.length + 1) / (combined.length - groups.length)) }, confidence_interval: null, confidence_interval_reason: "Omnibus epsilon-squared CI is not estimated in statistics_v1." };
}

export function compareGroups(rawGroups = [], options = {}) {
  const groups = rawGroups.map(finiteNumbers);
  if (groups.length < 2) return insufficient("At least two real, study-authorized groups are required.");
  if (groups.some((group) => group.length < MIN_INFERENTIAL_SAMPLE)) {
    return insufficient(`Each group requires at least ${MIN_INFERENTIAL_SAMPLE} observations.`);
  }
  const paired = Boolean(options.paired);
  if (paired && (groups.length !== 2 || groups[0].length !== groups[1].length)) {
    return insufficient("Paired comparison requires two equally sized, participant-aligned groups.");
  }
  const approximatelyNormal = options.distributionAssumption === "approximately_normal";
  let result;
  if (groups.length === 2 && paired) result = approximatelyNormal ? pairedT(groups[0], groups[1], options) : wilcoxon(groups[0], groups[1], options);
  else if (groups.length === 2) result = approximatelyNormal ? welchT(groups[0], groups[1], options) : mannWhitney(groups[0], groups[1], options);
  else result = approximatelyNormal ? oneWayAnova(groups) : kruskalWallis(groups);
  return {
    ...result,
    group_sizes: groups.map((group) => group.length),
    assumption: approximatelyNormal ? "approximately_normal explicitly supplied" : "normality not assumed",
    interpretation_guardrail: "Result describes a difference pattern; observational group differences do not establish causation.",
  };
}

