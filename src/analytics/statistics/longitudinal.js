import { mean } from "../features/math";
import { MIN_INFERENTIAL_SAMPLE } from "./version";

const time = (row) => new Date(row.session_started_at || row.started_at || row.completed_at || 0).getTime();

export function calculateLongitudinalChanges(rows = []) {
  const assessmentRows = rows.filter((row) =>
    (row.assessment_or_training || row.session_mode || "assessment") === "assessment"
  );
  const groups = assessmentRows.reduce((map, row) => {
    const key = `${row.participant_id}::${row.task_code}`;
    map.set(key, [...(map.get(key) || []), row]);
    return map;
  }, new Map());

  return [...groups.values()].flatMap((participantTaskRows) => {
    const ordered = [...participantTaskRows].sort((left, right) => time(left) - time(right));
    return ordered.slice(1).map((current, index) => {
      const previous = ordered[index];
      return {
        participant_id: current.participant_id,
        task_code: current.task_code,
        from_session_id: previous.session_id,
        to_session_id: current.session_id,
        from_assessment_number: index + 1,
        to_assessment_number: index + 2,
        elapsed_days: Number.isFinite(time(current)) && Number.isFinite(time(previous))
          ? (time(current) - time(previous)) / 86400000
          : null,
        accuracy_change: difference(current.accuracy, previous.accuracy),
        rt_change_ms: difference(current.rt_mean, previous.rt_mean),
        rt_variability_change_ms: difference(current.rt_variability_ms, previous.rt_variability_ms),
        error_rate_change: difference(current.error_rate, previous.error_rate),
        interpretation: "Observed within-participant difference pattern; no causal improvement claim is implied.",
      };
    });
  });
}

const difference = (current, previous) => {
  const left = Number(current); const right = Number(previous);
  return Number.isFinite(left) && Number.isFinite(right) ? left - right : null;
};

export function summarizeLongitudinalChanges(changes = []) {
  const groups = changes.reduce((map, change) => {
    const key = `${change.task_code}::${change.from_assessment_number}->${change.to_assessment_number}`;
    map.set(key, [...(map.get(key) || []), change]);
    return map;
  }, new Map());
  return [...groups.values()].map((rows) => ({
    task_code: rows[0].task_code,
    comparison: `Assessment ${rows[0].from_assessment_number} to ${rows[0].to_assessment_number}`,
    participant_count: rows.length,
    mean_accuracy_change: mean(rows.map((row) => row.accuracy_change)),
    mean_rt_change_ms: mean(rows.map((row) => row.rt_change_ms)),
    mean_rt_variability_change_ms: mean(rows.map((row) => row.rt_variability_change_ms)),
    inferential_test_performed: false,
    inferential_reason: rows.length < MIN_INFERENTIAL_SAMPLE
      ? `Fewer than ${MIN_INFERENTIAL_SAMPLE} paired participants; descriptive comparison only.`
      : "statistics_v1 reports descriptive longitudinal changes; an inferential paired analysis requires a prespecified research design and complete participant alignment.",
  }));
}

export function assessRepeatedMeasuresReadiness(rows = []) {
  const assessmentRows = rows.filter((row) => (row.assessment_or_training || "assessment") === "assessment");
  const counts = assessmentRows.reduce((map, row) => {
    const key = `${row.participant_id}::${row.task_code}`;
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  const completeThreeTimepointUnits = [...counts.values()].filter((count) => count >= 3).length;
  return {
    ready: completeThreeTimepointUnits >= MIN_INFERENTIAL_SAMPLE,
    complete_three_timepoint_participant_task_units: completeThreeTimepointUnits,
    minimum_required: MIN_INFERENTIAL_SAMPLE,
    reason: completeThreeTimepointUnits >= MIN_INFERENTIAL_SAMPLE
      ? "Potentially eligible; verify protocol comparability, missingness, and prespecified repeated-measures model before testing."
      : "Insufficient complete participant-task units for repeated-measures analysis; no significance test was run.",
  };
}

