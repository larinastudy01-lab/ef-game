import { linearSlope } from "../features/math";
import { MIN_TREND_SESSIONS } from "./version";

const CORE_METRICS = ["accuracy", "rt_mean", "rt_variability_ms"];
const finite = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

function summarizeMetric(rows, metric) {
  const values = rows.map((row) => row[metric]).filter(finite).map(Number); const baseline = values[0] ?? null; const latest = values.at(-1) ?? null;
  const absolute = baseline === null || latest === null ? null : latest - baseline;
  return { metric, baseline_value: baseline, latest_value: latest, absolute_change: absolute,
    relative_change: absolute === null || baseline === 0 ? null : absolute / Math.abs(baseline),
    trend_slope_per_session: values.length >= MIN_TREND_SESSIONS ? linearSlope(values) : null,
    trend_reliable: values.length >= MIN_TREND_SESSIONS, observation_count: values.length,
    reliability_reason: values.length >= MIN_TREND_SESSIONS ? null : `Fewer than ${MIN_TREND_SESSIONS} valid sessions; trend slope is withheld.` };
}

export function taskSpecificMetricNames(rows, taskCode) {
  const taskPrefix = ({ CBT: "cbt_", PM: "pm_", SRT: "srt_", SSG: "ssg_", LB: "lb_", DCCS: "dccs_" })[taskCode];
  if (!taskPrefix) return [];
  const metrics = new Set();
  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (key.startsWith(taskPrefix) && finite(value)) metrics.add(key);
    });
  });
  return [...metrics].sort();
}

export function buildLongitudinalFeatureSummary(participantId, taskRows = []) {
  const rows = taskRows.filter((row) => row.participant_id === participantId).sort((a, b) => new Date(a.session_started_at || 0) - new Date(b.session_started_at || 0));
  const tasks = new Map();
  const assessmentSessions = new Set();
  const trainingSessions = new Set();
  rows.forEach((row) => {
    if (!tasks.has(row.task_code)) tasks.set(row.task_code, { rows: [], assessmentCount: 0, trainingRows: [] });
    const task = tasks.get(row.task_code);
    task.rows.push(row);
    if (row.assessment_or_training === "assessment") {
      task.assessmentCount += 1;
      assessmentSessions.add(row.session_id);
    } else if (row.assessment_or_training === "training") {
      task.trainingRows.push(row);
      trainingSessions.add(row.session_id);
    }
  });
  const byTask = [...tasks.keys()].sort().map((taskCode) => {
    const task = tasks.get(taskCode); const metrics = [...CORE_METRICS, ...taskSpecificMetricNames(task.rows, taskCode)];
    return { task_code: taskCode, session_count: task.rows.length, assessment_count: task.assessmentCount,
      training_count: task.trainingRows.length,
      training_frequency_per_30_days: frequency(task.trainingRows),
      metrics: metrics.map((metric) => summarizeMetric(task.rows, metric)) };
  });
  return { participant_id: participantId, session_count: new Set(rows.map((row) => row.session_id)).size,
    assessment_session_count: assessmentSessions.size,
    training_session_count: trainingSessions.size, tasks: byTask };
}

function frequency(rows) { if (!rows.length) return 0; if (rows.length === 1) return null;
  const times = rows.map((row) => new Date(row.session_started_at || 0).getTime()).filter(Number.isFinite).sort();
  const days = (times.at(-1) - times[0]) / 86400000; return days > 0 ? rows.length / days * 30 : null; }
