import { buildRecommendationContext, buildRecommendationOutcome } from "../onlineRecommendation";

describe("online recommendation adapters", () => {
  test("normalizes percentage accuracy and builds per-task history", () => {
    const context = buildRecommendationContext([{ session: { mode: "training", difficulty: "L3" },
      game: { gameId: "srt" }, summary: { accuracy: 80, avgReactionTime: 750 } }], 3);
    expect(context.recent_accuracy).toBe(0.8);
    expect(context.current_difficulty).toBe(3);
    expect(context.previous_task).toBe("SRT");
    expect(context.task_history.SRT.training_count).toBe(1);
  });

  test("converts a unified result into a bounded reward outcome", () => {
    const outcome = buildRecommendationOutcome({ resultId: "r1", summary: { accuracy: 125, avgReactionTime: 500 },
      metrics: { reactionTimes: [400, 600] } });
    expect(outcome.accuracy).toBe(1);
    expect(outcome.rt_variability_ms).toBe(100);
    expect(outcome.source_result_id).toBe("r1");
  });
});
