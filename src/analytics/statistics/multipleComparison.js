export function benjaminiHochberg(results = [], pValueField = "p_value") {
  const eligible = results.map((result, index) => ({ result, index, p: Number(result?.[pValueField]) }))
    .filter((item) => Number.isFinite(item.p) && item.p >= 0 && item.p <= 1)
    .sort((left, right) => left.p - right.p);
  const adjusted = Array(results.length).fill(null);
  let runningMinimum = 1;
  for (let index = eligible.length - 1; index >= 0; index -= 1) {
    const candidate = Math.min(1, (eligible[index].p * eligible.length) / (index + 1));
    runningMinimum = Math.min(runningMinimum, candidate);
    adjusted[eligible[index].index] = runningMinimum;
  }
  return results.map((result, index) => ({
    ...result,
    p_value_adjusted: adjusted[index],
    multiple_comparison_method: eligible.length > 1 ? "Benjamini-Hochberg FDR" : "not_required",
    significant_after_correction: adjusted[index] === null ? null : adjusted[index] < 0.05,
  }));
}

