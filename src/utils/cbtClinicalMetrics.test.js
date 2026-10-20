import { getCbtClinicalMetrics } from "./cbtClinicalMetrics";

test("medical CBT event counts survive unified payloads and preserve zero values", () => {
  const rawResult = { promptCount: 2, earlyClickCount: 0, promptEvents: [{ type: "idle_mouse" }, { type: "wrong_answer_hint" }],
    scoring: { summary: { totalIdleHintCount: 1, totalWrongAnswerHintCount: 1 } },
  };
  expect(getCbtClinicalMetrics({ payload: { rawResult } })).toMatchObject({
    promptCount: 2, earlyClickCount: 0, idleHintCount: 1, wrongAnswerHintCount: 1,
  });
});

test("trial-only medical results retain hint totals without conflating early clicks with answer errors", () => {
  expect(getCbtClinicalMetrics({ history: [
    { promptCount: 3, idleHintCount: 2, wrongAnswerHintCount: 1, earlyClickCount: 4 },
    { promptCount: 0, idleHintCount: 0, wrongAnswerHintCount: 0, earlyClickCount: 0 },
  ] })).toMatchObject({ promptCount: 3, earlyClickCount: 4, idleHintCount: 2, wrongAnswerHintCount: 1 });
});
