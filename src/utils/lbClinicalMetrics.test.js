import { getLbClinicalMetrics } from "./lbClinicalMetrics";
import { normalizeGameResult } from "./resultManager";
import { createRecordWorkbook } from "./clinicianExcelExport";

jest.mock("./resultSync", () => ({ queueGameResult: jest.fn() }));

test("LB actual reminder counts survive normalization and both local and uploaded clinical records", () => {
  const raw = { status: "interrupted", protocolVersion: "2.0.0", promptCount: 2, idleHintCount: 1, ruleErrorHintCount: 1,
    promptEvents: [{ reason: "idle", stepInLevel: 1 }, { reason: "rule_error", stepInLevel: 2 }],
    config: { answerTimeLimit: 15 }, logs: [{ isCorrect: true, hintShown: true, promptCount: 2 }, { hintShown: true, promptCount: 0 }] };
  const normalized = normalizeGameResult({ rawResult: raw, gameId: "LB", mode: "training" });
  expect(normalized.session.status).toBe("interrupted");
  const expected = { promptCount: 2, idleHintCount: 1, ruleErrorHintCount: 1, answerTimeLimit: 15, promptEvents: raw.promptEvents };
  expect(normalized.metrics).toMatchObject(expected);
  for (const record of [raw, normalized, { payload: normalized }, { payload: { metrics: normalized.metrics } }]) {
    expect(getLbClinicalMetrics(record)).toMatchObject(expected);
  }
  const book = createRecordWorkbook({ records: [{ id: "lb", ...expected }], formatDate: (value) => value });
  const sheet = book.getWorksheet("紀錄摘要");
  expect(["R2", "W2", "AB2", "AC2"].map((cell) => sheet.getCell(cell).value)).toEqual([2, 1, 1, 15]);
});

test("LB does not invent reminder counts from legacy hintShown click rows", () => {
  expect(getLbClinicalMetrics({ logs: [{ hintShown: true }, { hintShown: true }] })).toMatchObject({ promptCount: null, idleHintCount: null, ruleErrorHintCount: null });
  expect(getLbClinicalMetrics({ promptEvents: [] })).toMatchObject({ promptCount: 0, idleHintCount: 0, ruleErrorHintCount: 0 });
  expect(getLbClinicalMetrics({ logs: [{ promptCount: 1, idleHintCount: 1, ruleErrorHintCount: 0 }, { promptCount: 0, idleHintCount: 0, ruleErrorHintCount: 0 }] })).toMatchObject({ promptCount: 1, idleHintCount: 1, ruleErrorHintCount: 0 });
});
