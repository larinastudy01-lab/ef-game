import { assignParticipantLabels, participantLabel, summarizeResearchRows } from "./researchStudioPresentation";

test("display aliases are independent of load order and never renumber existing participants", () => {
  const first = assignParticipantLabels(["uuid-b", "uuid-a"]);
  expect(first).toEqual(assignParticipantLabels(["uuid-a", "uuid-b"]));
  const next = assignParticipantLabels(["uuid-0", "uuid-b", "uuid-a"], first);
  expect(next["uuid-a"]).toBe("P-001"); expect(next["uuid-b"]).toBe("P-002"); expect(next["uuid-0"]).toBe("P-003");
  expect(first["uuid-0"]).toBeUndefined(); expect(participantLabel("uuid-a", next)).toBe("P-001｜匿名參與者 001");
  expect(assignParticipantLabels(["uuid-b"], next)).toBe(next);
});

test("quality counts keep sample units distinct and unknown source counts unavailable", () => {
  const rows = [
    { participant_id: "a", session_id: "s1", session_completion_status: "completed", analysis_trial_count: 3, excluded_trial_count: 1, assessment_or_training: "assessment", accuracy: .5, rt_mean: 500 },
    { participant_id: "a", session_id: "s1", session_completion_status: "completed", analysis_trial_count: 2, excluded_trial_count: 0, assessment_or_training: "assessment", accuracy: .8, rt_mean: 600 },
    { participant_id: "a", session_id: "s2", session_completion_status: "interrupted", analysis_trial_count: 0, excluded_trial_count: 2, assessment_or_training: "training", accuracy: null, rt_mean: null },
    { participant_id: "b", session_id: "s1", session_completion_status: "completed", analysis_trial_count: 4, excluded_trial_count: 0, assessment_or_training: "training", accuracy: .7, rt_mean: null },
  ];
  expect(summarizeResearchRows(rows)).toMatchObject({ participantCount: 2, validSessionCount: 2, assessmentCount: 1, trainingCount: 1, taskSessionCount: 4, completedCount: 3, missingCount: 2, excludedTrialCount: 3 });
  expect(summarizeResearchRows([{ accuracy: null }]).excludedTrialCount).toBeNull();
  expect(summarizeResearchRows([]).excludedTrialCount).toBeNull();
});
