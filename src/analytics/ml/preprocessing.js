const finite = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

export function fitPreprocessor(rows = [], { scale = true, varianceThreshold = 0 } = {}) {
  const names = [...new Set(rows.flatMap((row) => Object.keys(row.features || {})))].sort();
  const stats = names.map((name) => {
    const values = rows.map((row) => row.features?.[name]).filter(finite).map(Number).sort((a, b) => a - b);
    const median = values.length ? values[Math.floor(values.length / 2)] : 0;
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const variance = values.length > 1 ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1) : 0;
    return { name, median, mean, sd: Math.sqrt(variance), variance };
  }).filter((item) => item.variance > varianceThreshold);
  return { feature_names: stats.map((item) => item.name), statistics: stats, scale,
    fitted_participants: [...new Set(rows.map((row) => row.participant_id))] };
}

export function transformRows(rows = [], fitted) {
  return rows.map((row) => ({ ...row, x: fitted.statistics.map((stat) => {
    const raw = finite(row.features?.[stat.name]) ? Number(row.features[stat.name]) : stat.median;
    return fitted.scale && stat.sd > 0 ? (raw - stat.mean) / stat.sd : raw;
  }), y: Number(row.target) }));
}

