import { getRecommendedGameIdFromDecision } from "./ModeSelectPage";

describe("getRecommendedGameIdFromDecision", () => {
  test("maps the adaptive recommendation task to a selectable game id", () => {
    expect(
      getRecommendedGameIdFromDecision({ selected_action: { task_code: "DCCS" } })
    ).toBe("dccs");
  });

  test("rejects missing or unsupported recommendation tasks", () => {
    expect(getRecommendedGameIdFromDecision(null)).toBeNull();
    expect(
      getRecommendedGameIdFromDecision({ selected_action: { task_code: "OTHER" } })
    ).toBeNull();
  });
});
