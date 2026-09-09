import {
  getRecommendedGameIdFromDecision,
  saveTrainingSettings,
} from "./ModeSelectPage";

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

describe("saveTrainingSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  test("stores one compact canonical copy in each storage", () => {
    saveTrainingSettings({
      minutes: 20,
      trainingGameIds: ["dccs"],
      adaptiveRecommendation: { oversizedHistory: "not persisted" },
    });

    const persisted = JSON.parse(
      localStorage.getItem("ef_game_training_settings")
    );
    expect(persisted).toEqual({ minutes: 20, trainingGameIds: ["dccs"] });
    expect(localStorage.getItem("trainingSettings")).toBeNull();
    expect(sessionStorage.getItem("trainingSettings")).toBeNull();
  });

  test("does not throw when both storage quotas are exceeded", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });
    jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => saveTrainingSettings({ minutes: 20 })).not.toThrow();
    expect(saveTrainingSettings({ minutes: 20 })).toBe(false);
  });
});
