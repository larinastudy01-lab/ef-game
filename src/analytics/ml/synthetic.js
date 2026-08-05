import { seededRandom } from "./random";

const gaussian = (random) => Math.sqrt(-2 * Math.log(Math.max(random(), 1e-9))) * Math.cos(2 * Math.PI * random());

/** Pipeline validation only. Never use these records as research findings. */
export function generateSyntheticDataset({ participants = 60, sessionsPerParticipant = 2, targetType = "regression", seed = 20260730 } = {}) {
  const random = seededRandom(seed); const rows = [];
  for (let participant = 0; participant < participants; participant += 1) {
    const ability = gaussian(random);
    for (let session = 0; session < sessionsPerParticipant; session += 1) {
      const earlyAccuracy = Math.max(0, Math.min(1, 0.65 + ability * 0.12 + gaussian(random) * 0.08));
      const earlyRt = Math.max(150, 850 - ability * 90 + gaussian(random) * 70);
      const continuous = Math.max(0, Math.min(1, 0.18 + earlyAccuracy * 0.72 - earlyRt * 0.00008 + gaussian(random) * 0.05));
      rows.push({ participant_id: `SYNTHETIC_P${String(participant).padStart(3, "0")}`, session_id: `DEMO_S${session}`,
        features: { early_accuracy: earlyAccuracy, early_rt_mean: earlyRt, early_rt_variability_ms: Math.abs(80 + gaussian(random) * 25) },
        target: targetType === "classification" ? Number(continuous >= 0.65) : continuous,
        target_definition: targetType === "classification" ? "DEMO_future_accuracy_category" : "DEMO_future_accuracy",
        data_mode: "synthetic_demo" });
    }
  }
  return rows;
}

