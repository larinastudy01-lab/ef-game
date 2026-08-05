import { shuffled } from "./random";

const labelOf = (row) => String(row.target);

export function assertParticipantIsolation(folds = []) {
  folds.forEach((fold) => {
    const train = new Set(fold.train.map((row) => row.participant_id));
    fold.test.forEach((row) => {
      if (train.has(row.participant_id)) throw new Error(`Participant leakage detected: ${row.participant_id}`);
    });
  });
  return true;
}

export function participantHoldout(rows = [], testFraction = 0.2, seed = 20260730) {
  const groups = shuffled([...new Set(rows.map((row) => row.participant_id).filter(Boolean))], seed);
  if (groups.length < 3) throw new Error("At least three participants are required for development/test separation.");
  const testCount = Math.max(1, Math.min(groups.length - 2, Math.round(groups.length * testFraction)));
  const testParticipants = groups.slice(0, testCount); const testSet = new Set(testParticipants);
  const development = rows.filter((row) => !testSet.has(row.participant_id));
  const test = rows.filter((row) => testSet.has(row.participant_id));
  if (development.some((row) => testSet.has(row.participant_id))) throw new Error("Outer holdout participant leakage detected.");
  return { development, test, development_participants: groups.slice(testCount), test_participants: testParticipants };
}

/** Deterministic GroupKFold. Every row from one participant stays in one fold. */
export function groupKFold(rows = [], k = 5, seed = 20260730) {
  const groups = [...new Set(rows.map((row) => row.participant_id).filter(Boolean))];
  if (groups.length < 2) throw new Error("At least two participants are required.");
  const count = Math.min(k, groups.length);
  const buckets = Array.from({ length: count }, () => []);
  shuffled(groups, seed).forEach((group, index) => buckets[index % count].push(group));
  const folds = buckets.map((testGroups) => {
    const testSet = new Set(testGroups);
    return { train: rows.filter((row) => !testSet.has(row.participant_id)), test: rows.filter((row) => testSet.has(row.participant_id)), test_participants: testGroups };
  });
  assertParticipantIsolation(folds);
  return folds;
}

/** Greedy StratifiedGroupKFold for classification; stratification remains group-safe. */
export function stratifiedGroupKFold(rows = [], k = 5, seed = 20260730) {
  const grouped = rows.reduce((map, row) => {
    map.set(row.participant_id, [...(map.get(row.participant_id) || []), row]); return map;
  }, new Map());
  if (grouped.size < 2) throw new Error("At least two participants are required.");
  const count = Math.min(k, grouped.size);
  const buckets = Array.from({ length: count }, () => ({ groups: [], labels: {} }));
  const groupEntries = shuffled([...grouped.entries()], seed).sort((a, b) => b[1].length - a[1].length);
  groupEntries.forEach(([group, groupRows]) => {
    const labels = groupRows.reduce((acc, row) => ({ ...acc, [labelOf(row)]: (acc[labelOf(row)] || 0) + 1 }), {});
    const bucket = buckets.reduce((best, candidate) => {
      const score = Object.entries(labels).reduce((sum, [label, amount]) => sum + (candidate.labels[label] || 0) * amount, 0) + candidate.groups.length * 0.001;
      return !best || score < best.score ? { value: candidate, score } : best;
    }, null).value;
    bucket.groups.push(group); Object.entries(labels).forEach(([label, amount]) => { bucket.labels[label] = (bucket.labels[label] || 0) + amount; });
  });
  const folds = buckets.map(({ groups }) => { const set = new Set(groups); return {
    train: rows.filter((row) => !set.has(row.participant_id)), test: rows.filter((row) => set.has(row.participant_id)), test_participants: groups,
  }; });
  assertParticipantIsolation(folds); return folds;
}
