export function getAriClinicalMetrics(record = {}) {
  const payload = record.payload || record;
  const raw = payload.rawResult || record.rawResult || payload;
  const metrics = payload.metrics || record.metrics || {};
  const promptEvents = Array.isArray(raw.promptEvents) ? raw.promptEvents : Array.isArray(metrics.promptEvents) ? metrics.promptEvents : null;
  const replayEvents = Array.isArray(raw.replayEvents) ? raw.replayEvents : Array.isArray(metrics.replayEvents) ? metrics.replayEvents : null;
  const trials = raw.records || raw.trials || [];
  const sum = (key) => Array.isArray(trials) && trials.some((trial) => trial[key] != null)
    ? trials.reduce((total, trial) => total + (Number(trial[key]) || 0), 0) : null;
  return {
    promptCount: raw.promptCount ?? metrics.promptCount ?? promptEvents?.length ?? sum("promptCount"),
    idleHintCount: raw.idleHintCount ?? metrics.idleHintCount ?? (promptEvents ? promptEvents.filter((event) => event.reason === "idle").length : sum("idleHintCount")),
    consecutiveErrorHintCount: raw.consecutiveErrorHintCount ?? metrics.consecutiveErrorHintCount ?? (promptEvents ? promptEvents.filter((event) => event.reason === "consecutive_errors").length : sum("consecutiveErrorHintCount")),
    replayCount: raw.replayCount ?? metrics.replayCount ?? replayEvents?.length ?? sum("replayCount"),
    promptEvents, replayEvents,
    answerTimeLimitMs: raw.protocol?.answerTimeLimit ?? metrics.answerTimeLimit ?? null,
  };
}
