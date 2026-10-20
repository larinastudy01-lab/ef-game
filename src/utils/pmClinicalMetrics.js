// Read both local results and uploaded, normalized result payloads.
export function getPmClinicalMetrics(record = {}) {
  const payload = record.payload || record;
  const raw = payload.rawResult || record.rawResult || payload;
  const summary = raw.scoring?.summary || raw.summary || {};
  const clinical = raw.scoring?.clinicalView || raw.clinicalView || record.clinician_metrics || {};
  const metrics = payload.metrics || raw.metrics || {};
  const trials = raw.trials || raw.records || payload.trials || [];
  const sum = (keys) => Array.isArray(trials) && trials.some((trial) => keys.some((key) => trial[key] != null || trial.confusionAnalysis?.[key] != null))
    ? trials.reduce((total, trial) => total + Math.max(0, ...keys.map((key) => Number(trial[key] ?? trial.confusionAnalysis?.[key]) || 0)), 0) : null;
  const read = (keys) => {
    for (const source of [raw, summary, clinical, metrics]) {
      for (const key of keys) if (source[key] != null) return Number(source[key]);
    }
    return sum(keys);
  };
  return {
    promptCount: read(["promptCount", "totalPromptCount", "idleHintCount"]),
    possibleConfusionCount: read(["possibleConfusionCount"]),
    visualConfusionCount: read(["visualSimilarityConfusionCount", "visualConfusionCount"]),
    categoryConfusionCount: read(["categoryConfusionCount"]),
    unrelatedWrongCount: read(["unrelatedErrorCount", "unrelatedWrongCount"]),
    protocolVersion: raw.protocolVersion ?? metrics.protocolVersion ?? null,
  };
}
