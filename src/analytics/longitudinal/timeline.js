const timestamp = (value) => { const date = new Date(value || 0); return Number.isNaN(date.getTime()) ? null : date.toISOString(); };

export function buildParticipantTimeline(participantId, taskRows = [], recommendationRows = []) {
  const participantTasks = taskRows.filter((row) => row.participant_id === participantId);
  const sessions = [...participantTasks.reduce((map, row) => {
    if (!map.has(row.session_id)) map.set(row.session_id, row); return map;
  }, new Map()).values()].map((row) => ({ event_id: `session:${row.session_id}`, participant_id: participantId,
    event_type: row.assessment_or_training === "training" ? "Training" : "Assessment", session_id: row.session_id,
    occurred_at: timestamp(row.session_started_at || row.started_at), status: row.session_completion_status || row.session_status || null,
    summary: `${row.assessment_or_training === "training" ? "Training" : "Assessment"} session` }));
  const tasks = participantTasks.map((row) => ({ event_id: `task:${row.task_session_id}`, participant_id: participantId, event_type: "Task",
    session_id: row.session_id, task_session_id: row.task_session_id, task_code: row.task_code,
    occurred_at: timestamp(row.session_started_at || row.started_at), difficulty: row.difficulty || null,
    summary: `${row.task_code} task · ${row.session_completion_status || "unknown status"}` }));
  const results = participantTasks.map((row) => ({ event_id: `result:${row.task_session_id}`, participant_id: participantId, event_type: "Result",
    session_id: row.session_id, task_session_id: row.task_session_id, task_code: row.task_code,
    occurred_at: timestamp(row.session_completed_at || row.completed_at || row.session_started_at),
    accuracy: row.accuracy, mean_rt_ms: row.rt_mean, rt_variability_ms: row.rt_variability_ms,
    summary: `${row.task_code} result · accuracy ${format(row.accuracy)} · mean RT ${format(row.rt_mean)} ms` }));
  const recommendations = recommendationRows.filter((row) => row.participant_id === participantId).map((row) => ({
    event_id: `recommendation:${row.id || row.recommendation_id}`, participant_id: participantId, event_type: "Recommendation",
    occurred_at: timestamp(row.recommendation_timestamp || row.timestamp), task_code: (row.selected_action || {}).task_code,
    difficulty: (row.selected_action || {}).difficulty_level, policy: row.policy_name || row.policy,
    actual_reward: row.actual_reward, summary: `${row.policy_name || row.policy} → ${(row.selected_action || {}).task_code || "task unavailable"}` }));
  return [...sessions, ...tasks, ...results, ...recommendations].filter((event) => event.occurred_at)
    .sort((left, right) => new Date(left.occurred_at) - new Date(right.occurred_at) || left.event_type.localeCompare(right.event_type));
}

const format = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(3) : "unavailable";

