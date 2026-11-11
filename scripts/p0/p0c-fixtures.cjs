const { randomUUID } = require('node:crypto');

// Transport fixtures only. They never generate or alter the official assessment protocol.
function syntheticResult(task, { count = task === 'LB' ? 20 : 4, patientId = randomUUID(), timeoutCount = 0, plannedCount = 0, earlyStop = false } = {}) {
  const trials = Array.from({ length: count + plannedCount }, (_, index) => {
    const planned = index >= count; const timeout = index < timeoutCount;
    const common = { trialNumber: index + 1, isCorrect: planned ? null : !timeout,
      completed: !planned, administered: !planned, responseStatus: planned ? 'not_administered' : timeout ? 'timed_out' : 'responded',
      isTimeout: timeout, reactionTime: planned ? null : timeout ? 15000 : 1000 };
    if (task === 'LB') return { ...common, stageId: index < 10 ? 'forward' : 'red-blue', stepIndex: index % 10, expectedKey: `key-${index}`, clickedKey: planned ? null : `key-${index}` };
    if (task === 'PM') return { ...common, correctIds: ['synthetic-target'], selectedIds: planned || timeout ? [] : ['synthetic-target'],
      deselectCount: index === timeoutCount ? 1 : 0, tapLogs: index === timeoutCount ? [{ action: 'select' }, { action: 'deselect' }, { action: 'select' }] : [] };
    if (task === 'CBT') return { ...common, targetSequence: [1, 2], userSequence: planned ? undefined : [1, 2], earlyStop };
    if (task === 'ARI') return { ...common, expectedTarget: 'synthetic-left', selectedTarget: planned ? null : 'synthetic-left' };
    return common;
  });
  return { resultId: `p0-acceptance-${randomUUID()}`, child: { childId: patientId }, game: { gameId: task },
    session: { mode: 'test', status: 'completed', startedAt: '2026-10-23T00:00:00.000Z', finishedAt: '2026-10-23T00:01:00.000Z' },
    summary: { totalTrials: trials.length, correctCount: count - timeoutCount, accuracy: count ? (count - timeoutCount) / count * 100 : 0 },
    trials, rawResult: { trials: structuredClone(trials), earlyStop },
    behavioral: { sessionId: randomUUID(), taskSessionId: randomUUID(), trialIds: trials.map(() => randomUUID()) } };
}
module.exports = { syntheticResult };
