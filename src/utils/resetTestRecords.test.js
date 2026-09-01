import { resetTestRecords } from "./resetTestRecords";

describe("resetTestRecords", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test("removes every CBT key used by the test page and test map", () => {
    const childId = "child-1";
    const keys = [
      "cbtTestResult",
      "latestCBTTestResult",
      "ef_cbt_test_result",
      "ef_game_cbt_test_result",
      "ef_test_CBT_completed",
      `cbtTestResult_${childId}`,
      `ef_cbt_test_result_${childId}`,
      `ef_test_CBT_completed_${childId}`,
      `result:${childId}:CBT:test`,
      "result:CBT:test",
    ];

    keys.forEach((key) => {
      localStorage.setItem(key, JSON.stringify({ completed: true }));
      sessionStorage.setItem(key, JSON.stringify({ completed: true }));
    });

    resetTestRecords(childId);

    keys.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull();
      expect(sessionStorage.getItem(key)).toBeNull();
    });
  });

  test("removes only the selected child's unified test history", () => {
    const records = [
      { resultId: "selected-test", child: { childId: "child-1" }, session: { mode: "test" } },
      { resultId: "other-test", child: { childId: "child-2" }, session: { mode: "test" } },
      { resultId: "selected-training", child: { childId: "child-1" }, session: { mode: "training" } },
    ];
    localStorage.setItem("efGameResults", JSON.stringify(records));

    resetTestRecords("child-1");

    expect(JSON.parse(localStorage.getItem("efGameResults"))).toEqual([
      records[1],
      records[2],
    ]);
  });
});
