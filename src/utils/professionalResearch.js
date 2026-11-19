import { describeRecord, recordConditions } from "./professionalMetrics";

// The research input remains independent of the clinical patient selection.
export function researchPresentationRecord(input = {}) {
  const session = input.taskSession || {};
  const metadata = input.sessionMetadata || {};
  return { id: session.id || input.taskSessionId, participantId: input.participantId, gameKey: session.task_code || session.taskCode || input.taskCode,
    type: metadata.assessment_or_training === "training" ? "training" : metadata.assessment_or_training === "assessment" ? "test" : null,
    date: metadata.session_started_at || session.started_at, difficulty: session.difficulty,
    trials: input.trials || [], raw: { ...(session.raw_data || session.rawData || {}), ...session, ...metadata, ...(input.presentationMetadata || {}), status: session.completionStatus || session.completion_status || session.status || metadata.session_status,
      protocolVersion: input.presentationMetadata?.protocolVersion || metadata.protocol_version || session.protocolVersion || session.protocol_version || session.raw_data?.protocolVersion } };
}
export function summarizeProfessionalResearch(inputs = []) {
  const records = inputs.map(researchPresentationRecord); const descriptions = records.map(describeRecord);
  const valid = records.filter((r, i) => descriptions[i].complete && !descriptions[i].integrityError && descriptions[i].total > 0);
  const validTrials = descriptions.reduce((sum, d) => sum + (d.complete && !d.integrityError ? d.total || 0 : 0), 0);
  const recordedTrials = descriptions.reduce((sum, d) => sum + d.recordedTrials, 0);
  return { records, validParticipantCount: new Set(valid.map((r) => r.participantId).filter(Boolean)).size,
    validTrials, recordedTrials, completeness: recordedTrials ? validTrials / recordedTrials * 100 : null,
    completeTaskCount: descriptions.filter((d) => d.complete).length, taskCount: records.length };
}
export function researchConditionGroups(records) {
  const groups = new Map();
  records.forEach((r) => { const d = describeRecord(r); if (!d.complete || d.integrityError || !d.total) return;
    const c = recordConditions(r); const key = JSON.stringify(c); const group = groups.get(key) || { conditions: c, records: [], correct: 0, total: 0, participants: new Set() };
    group.records.push(r); group.correct += d.correct; group.total += d.total; group.participants.add(r.participantId); groups.set(key, group);
  });
  return [...groups.values()];
}
