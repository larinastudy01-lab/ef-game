import { DATA_LABELS, formatMetric, formatAccuracy, formatDateTime, formatDifficulty, formatNumber, formatPercentage, formatReactionTime, missingLabel } from "./professionalFormatters";

test("display precision preserves valid denominators and distinguishes unavailable states", () => {
  expect(formatPercentage(2 / 3, { scale: "ratio", detail: false })).toBe("67%");
  expect(formatAccuracy(4, 6)).toBe("66.7%（4／6 題）");
  expect(formatPercentage(100)).toBe("100.0%");
  expect(formatReactionTime(2818.3333, { n: 4 })).toBe("2818.3 ms（n=4）");
  expect(formatReactionTime(2818.3333, { detail: false })).toBe("2818 ms");
  expect(formatReactionTime(null, { n: 0 })).toBe("無有效反應");
  expect(formatReactionTime(null, { state: "notApplicable" })).toBe("不適用");
  expect(formatReactionTime(-1)).toBe("計算失敗");
  expect(formatMetric(-123.456, " ms")).toBe("-123.5 ms"); // Signed RT change is not an absolute reaction time.
  expect(new Set(Object.keys(DATA_LABELS).map(missingLabel)).size).toBe(Object.keys(DATA_LABELS).length);
});
test("null, nonfinite and nonnumeric source types never become zero or receive a unit", () => {
  [null, undefined, "", " ", false, [], {}, NaN, Infinity].forEach((v) => {
    expect(formatNumber(v)).toBe("未記錄"); expect(formatReactionTime(v)).toBe("未記錄"); expect(formatPercentage(v)).toBe("未記錄");
  });
  expect(formatNumber("0", 1)).toBe("0.0");
});
test("list and detail timestamps use explicit Taipei time and fixed 24-hour notation", () => {
  expect(formatDateTime("2026-10-27T09:05:48Z")).toBe("2026/10/27 17:05");
  expect(formatDateTime("2026-10-27T09:05:48Z", { seconds: true })).toBe("2026/10/27 17:05:48");
  expect(formatDateTime("2026-10-27T16:00:00Z")).toBe("2026/10/28 00:00");
  expect(formatDifficulty("adaptive_span_test", "CBT")).toBe("適性廣度測驗");
  expect(formatDifficulty("normal", "PM")).toBe("中等");
  expect(formatDifficulty("normal", "unknown")).toContain("待確認");
});
