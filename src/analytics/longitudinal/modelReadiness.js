import { MIXED_EFFECTS_MIN_PARTICIPANTS, MIXED_EFFECTS_MIN_REPEATS } from "./version";

export function assessMixedEffectsReadiness(taskRows = []) {
  const counts = taskRows.reduce((map, row) => { const key = `${row.participant_id}::${row.task_code}`; map.set(key, (map.get(key) || 0) + 1); return map; }, new Map());
  const eligibleUnits = [...counts.entries()].filter(([, count]) => count >= MIXED_EFFECTS_MIN_REPEATS);
  const participants = new Set(eligibleUnits.map(([key]) => key.split("::")[0])).size; const ready = participants >= MIXED_EFFECTS_MIN_PARTICIPANTS;
  return { ready, model_fitted: false, eligible_participants: participants, eligible_participant_task_units: eligibleUnits.length,
    minimum_participants: MIXED_EFFECTS_MIN_PARTICIPANTS, minimum_repeated_sessions: MIXED_EFFECTS_MIN_REPEATS,
    planned_structure: "outcome ~ session_time + session_type + difficulty + (1 | participant_id)",
    reason: ready ? "Architecture-ready only. A prespecified protocol, missingness audit and server-side statistical implementation are required before fitting."
      : `Insufficient repeated data: requires at least ${MIXED_EFFECTS_MIN_PARTICIPANTS} participants with ${MIXED_EFFECTS_MIN_REPEATS}+ comparable repeated observations. No mixed-effects result was produced.` };
}

