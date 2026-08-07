import {
  calculateAge,
  daysSince,
  formatDate,
  formatGender,
  formatTrendRecordDate,
} from "./clinicianDashboardFormatters";

describe("clinician dashboard formatters", () => {
  test("calculates age in completed years and months", () => {
    expect(calculateAge("2020-10-20", new Date("2026-08-07T12:00:00"))).toBe("5 歲 9 個月");
    expect(calculateAge(null)).toBe("-");
  });

  test("formats stored gender values", () => {
    expect(formatGender("male")).toBe("男");
    expect(formatGender("female")).toBe("女");
    expect(formatGender("other")).toBe("other");
    expect(formatGender("")).toBe("未填寫");
  });

  test("returns fallbacks for invalid dates", () => {
    expect(formatDate("invalid")).toBe("-");
    expect(formatTrendRecordDate("invalid")).toBe("invalid");
    expect(daysSince("invalid")).toBeNull();
  });

  test("calculates completed days since a timestamp", () => {
    const now = new Date("2026-08-07T12:00:00Z").getTime();
    expect(daysSince("2026-08-05T11:00:00Z", now)).toBe(2);
  });
});
