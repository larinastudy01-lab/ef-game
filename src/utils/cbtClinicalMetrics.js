export function getCbtClinicalMetrics(record = {}) {
  const raw = record.payload?.rawResult || record.rawResult || record;
  const summary = raw.scoring?.summary || raw.summary || {};
  const clinical = raw.scoring?.clinicalView || raw.clinicalView || record.clinician_metrics || {};
  const trials = raw.trials || raw.history || raw.records || [];
  const count = (key) => Array.isArray(trials)
    ? trials.reduce((sum, trial) => sum + (Number(trial[key]) || 0), 0) : 0;
  const promptEvents = Array.isArray(raw.promptEvents) ? raw.promptEvents : null;
  const earlyEvents = Array.isArray(raw.earlyClickEvents) ? raw.earlyClickEvents : null;
  return {
    promptCount: raw.promptCount ?? promptEvents?.length ?? summary.promptCount ?? clinical.promptCount
      ?? (Array.isArray(trials) && trials.length ? count("promptCount") || count("idleHintCount") + count("wrongAnswerHintCount") : null),
    earlyClickCount: raw.earlyClickCount ?? earlyEvents?.length ?? summary.earlyClickCount ?? clinical.earlyClickCount
      ?? (Array.isArray(trials) && trials.length ? count("earlyClickCount") : null),
    idleHintCount: summary.totalIdleHintCount ?? summary.idleHintCount ?? clinical.totalIdleHintCount
      ?? (Array.isArray(trials) && trials.length ? count("idleHintCount") : null),
    wrongAnswerHintCount: summary.totalWrongAnswerHintCount ?? summary.wrongAnswerHintCount ?? clinical.totalWrongAnswerHintCount ?? clinical.wrongAnswerHintCount
      ?? (Array.isArray(trials) && trials.length ? count("wrongAnswerHintCount") : null),
    protocol: raw.protocol || null,
  };
}
