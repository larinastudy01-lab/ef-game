const objects = (record) => [record, record?.payload, record?.rawResult, record?.payload?.rawResult]
  .filter((value) => value && typeof value === "object");

const stableJson = (value) => JSON.stringify(value, (_, item) => {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return Object.keys(item).sort().reduce((sorted, key) => { sorted[key] = item[key]; return sorted; }, {});
  }
  return item;
});

// Match an attempt by an explicit identity, or exact completion time AND its
// original result data. Never round timestamps or merge by score/difficulty alone.
export function getAttemptKeys(record = {}, { cloud = false } = {}) {
  const sources = objects(record);
  const keys = new Set();
  sources.forEach((source) => {
    [source.resultId, source.result_id].filter(Boolean).forEach((id) => keys.add(`result:${id}`));
    [source.sessionId, source.session_id, source.session?.id, source.session?.sessionId]
      .filter(Boolean).forEach((id) => keys.add(`session:${id}`));
  });
  if (cloud && record.id) keys.add(`result:${record.id}`);

  const original = record.payload?.rawResult || record.rawResult || record.payload || record;
  const trials = [original.trials, original.trialLogs, original.trialRecords, original.records, original.history]
    .find((value) => Array.isArray(value) && value.length);
  const signature = trials ? stableJson(trials) : stableJson([
    original.score ?? original.summary?.score, original.accuracy ?? original.summary?.accuracy,
    original.totalTrials ?? original.summary?.totalTrials,
    original.correctCount ?? original.summary?.correctCount,
    original.avgReactionTime ?? original.avgRt ?? original.summary?.avgReactionTime,
  ]);
  // Records without any original measurements cannot establish legacy identity.
  if (!trials && signature === "[null,null,null,null,null]") return [...keys];
  const difficulty = original.difficulty ?? "";
  const times = [original.finishedAt, original.finished_at, original.completedAt, original.completed_at,
    original.endTime, original.generatedAt, original.createdAt, original.created_at,
    record.payload?.session?.finishedAt, record.session?.finishedAt];
  times.forEach((value) => {
    if (!value) return;
    const time = new Date(value).getTime();
    if (Number.isFinite(time)) keys.add(`completed:${time}:${difficulty}:${signature}`);
  });
  return [...keys];
}

export function dedupeClinicalRecords(records) {
  const parents = records.map((_, index) => index);
  const root = (index) => {
    if (parents[index] !== index) parents[index] = root(parents[index]);
    return parents[index];
  };
  const seen = new Map();
  records.forEach((record, index) => {
    const scope = JSON.stringify([String(record.patientId), record.gameKey, record.type]);
    const keys = getAttemptKeys(record.raw, { cloud: record.sourceTable === "game_results" });
    keys.forEach((key) => {
      const scoped = `${scope}|${key}`;
      if (seen.has(scoped)) parents[root(index)] = root(seen.get(scoped));
      else seen.set(scoped, index);
    });
  });
  const groups = new Map();
  records.forEach((record, index) => {
    const key = root(index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  return [...groups.values()].map((group) => {
    const priority = (r) => (r.sourceTable === "game_results" ? 2 : r.raw?.resultId ? 1 : 0);
    group.sort((a, b) => priority(b) - priority(a) || (b.trials?.length || 0) - (a.trials?.length || 0));
    const selected = group[0];
    return selected.trials?.length ? selected : { ...selected, trials: group.find((r) => r.trials?.length)?.trials || [] };
  });
}
