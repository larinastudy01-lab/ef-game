import { getResultCompletionStatus, isCompletedResult } from "./resultCompletion";

test("interrupted local and cloud payloads do not count as completed results", () => {
  const interrupted = { session: { status: "interrupted" }, summary: { score: 0 } };
  expect(isCompletedResult(interrupted)).toBe(false);
  expect(isCompletedResult({ payload: interrupted })).toBe(false);
  expect(isCompletedResult({ completionStatus: "interrupted" })).toBe(false);
  expect(getResultCompletionStatus({ rawResult: { status: "aborted" } })).toBe("interrupted");
});

test("a completed zero score and legacy records remain completed", () => {
  expect(isCompletedResult({ session: { status: "completed" }, summary: { score: 0 } })).toBe(true);
  expect(isCompletedResult({ score: 0, status: "已完成" })).toBe(true);
});
