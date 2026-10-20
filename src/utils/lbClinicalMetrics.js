export function getLbClinicalMetrics(record = {}) {
  const payload = record.payload || record;
  const raw = payload.rawResult || record.rawResult || payload;
  const metrics = payload.metrics || record.metrics || {};
  const events = Array.isArray(raw.promptEvents) ? raw.promptEvents
    : Array.isArray(metrics.promptEvents) ? metrics.promptEvents : null;
  const trials = raw.logs || raw.trialLogs || raw.trials || [];
  const sum = (key) => trials.reduce((total, trial) => total + (Number(trial[key]) || 0), 0);
  const trialCount = (key) => Array.isArray(trials) && trials.some((trial) => trial[key] != null) ? sum(key) : null;
  return {
    promptCount: raw.promptCount ?? metrics.promptCount ?? events?.length ?? trialCount("promptCount"),
    idleHintCount: raw.idleHintCount ?? metrics.idleHintCount ?? (events ? events.filter((event) => event.reason === "idle").length : trialCount("idleHintCount")),
    ruleErrorHintCount: raw.ruleErrorHintCount ?? metrics.ruleErrorHintCount ?? (events ? events.filter((event) => event.reason === "rule_error").length : trialCount("ruleErrorHintCount")),
    promptEvents: events,
    answerTimeLimit: raw.config?.answerTimeLimit ?? raw.protocol?.answerTimeLimit ?? metrics.answerTimeLimit ?? null,
    timeout: raw.timeoutCount ?? (Array.isArray(trials) ? trials.filter((trial) => trial.isTimeout || trial.status === "timeout").length : null),
  };
}
