// Read both locally saved results and the unified payload returned by the server.
export function getSrtClinicalMetrics(record = {}) {
  const raw = record.payload?.rawResult || record.rawResult || record;
  const metrics = raw.metrics || {};
  const summary = raw.scoring?.summary || raw.summary || {};
  const clinical = raw.scoring?.clinicalView || record.clinician_metrics || {};
  const longAttention = raw.longAttentionMetrics || metrics.longAttentionMetrics || summary.longAttentionMetrics || {};
  const first = longAttention.firstThird || longAttention.first || {};
  const last = longAttention.lastThird || longAttention.last || {};
  const delta = (key) => Number.isFinite(first[key]) && Number.isFinite(last[key])
    ? Number((last[key] - first[key]).toFixed(2)) : null;
  return {
    rtStd: raw.rtStd ?? metrics.rtStd ?? summary.rtStd ?? clinical.rtStd ?? null,
    rtCV: raw.rtCV ?? metrics.rtCV ?? summary.rtCV ?? clinical.rtCV ?? null,
    promptCount: raw.promptCount ?? metrics.promptCount ?? clinical.promptCount
      ?? (Array.isArray(raw.promptEvents) ? raw.promptEvents.length : null)
      ?? summary.promptCount ?? null,
    rtStdIncrease: longAttention.rtStdIncrease ?? delta("rtStd"),
    rtCVIncrease: longAttention.rtCVIncrease ?? delta("rtCV"),
    protocol: raw.protocol || null,
  };
}
