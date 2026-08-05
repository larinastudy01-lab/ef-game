import { median, sampleSd } from "../features/math";
import { DEFAULT_ROLLING_WINDOW, MIN_TREND_SESSIONS } from "./version";

const finite = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

export function addRollingFeatures(rows = [], metrics = ["accuracy", "rt_mean", "rt_variability_ms"], window = DEFAULT_ROLLING_WINDOW) {
  const ordered = [...rows].sort((a, b) => new Date(a.session_started_at || 0) - new Date(b.session_started_at || 0));
  return ordered.map((row, index) => {
    const enoughTotal = ordered.length >= MIN_TREND_SESSIONS; const enoughWindow = index + 1 >= window;
    const output = { ...row, rolling_window: window, rolling_reliable: enoughTotal && enoughWindow,
      rolling_reliability_reason: enoughTotal && enoughWindow ? null : `At least ${Math.max(MIN_TREND_SESSIONS, window)} ordered sessions are required.` };
    metrics.forEach((metric) => { const values = ordered.slice(Math.max(0, index - window + 1), index + 1).map((item) => item[metric]).filter(finite).map(Number);
      output[`${metric}_rolling_mean`] = enoughTotal && enoughWindow && values.length === window ? values.reduce((a, b) => a + b, 0) / values.length : null;
      output[`${metric}_rolling_median`] = enoughTotal && enoughWindow && values.length === window ? median(values) : null;
      output[`${metric}_rolling_variability`] = enoughTotal && enoughWindow && values.length === window ? sampleSd(values) : null;
    }); return output;
  });
}

