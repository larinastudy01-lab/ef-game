export function getDccsClinicalMetrics(record = {}) {
  const payload = record.payload || record;
  const raw = payload.rawResult || record.rawResult || payload;
  const metrics = payload.metrics || record.metrics || {};
  const trials = raw.trialLogs || raw.records || raw.trials || [];
  const events = Array.isArray(raw.promptEvents) ? raw.promptEvents : Array.isArray(metrics.promptEvents) ? metrics.promptEvents : null;
  const sumPrompts = Array.isArray(trials) && trials.some((trial) => trial.promptCount != null)
    ? trials.reduce((total, trial) => total + (Number(trial.promptCount) || 0), 0) : null;
  return {
    promptCount: raw.promptCount ?? metrics.promptCount ?? events?.length ?? sumPrompts,
    promptEvents: events,
    timeout: raw.timeoutCount ?? metrics.timeoutCount ?? null,
    answerTimeLimitMs: raw.protocol?.answerTimeLimitMs ?? metrics.answerTimeLimitMs ?? null,
    reverseRuleTrials: raw.reverseRuleTrials ?? metrics.reverseRuleTrials ?? null,
    windEvents: raw.windEvents ?? metrics.windEvents ?? null,
  };
}
