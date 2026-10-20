import { prepareResearchInputs, prepareResearchRecommendations, RESEARCH_TASKS, RESEARCH_TASK_NAMES, scopeResearchInputs } from "./researchTasks";

test("research accepts only the six current tasks and never relabels retired protocols", () => {
  const raw = { task_name: "historical acquisition value" };
  const records = [...RESEARCH_TASKS, "DPT", "SSG", "SSS", "UNKNOWN"].map((code) => ({ participantId: "a", taskSession: { task_code: code }, rawTrials: [raw] }));
  const result = prepareResearchInputs(records);
  expect(result.excludedCount).toBe(4);
  expect(result.inputs.map((item) => item.taskSession.task_code)).toEqual(RESEARCH_TASKS);
  expect(result.inputs.find((item) => item.taskSession.task_code === "ARI").taskSession.task_name).toBe("貓狗反向");
  expect(result.inputs[0].rawTrials[0]).toBe(raw);
  expect(records[0].taskSession.task_name).toBeUndefined();
  expect(RESEARCH_TASK_NAMES.ARI).not.toMatch(/點探測|Sound.Symbol/i);
});

test("established aliases normalize before analysis, without admitting removed task codes", () => {
  expect(prepareResearchInputs([{ taskSession: { taskCode: "picture_memory" } }]).inputs[0].taskSession.task_code).toBe("PM");
  expect(prepareResearchInputs([{ taskSession: { taskCode: "ssg" } }]).inputs).toEqual([]);
});

test("recommendations exclude retired decisions and their task history and available actions", () => {
  const records = ["ARI", "DPT", "SSG", "SSS"].map((task_code) => ({ selected_action: { task_code }, context: { previous_task: "DPT", task_history: { ARI: { training_count: 2 }, SSG: {} } }, available_actions: [{ task_code: "ARI" }, { task_code: "SSS" }] }));
  const result = prepareResearchRecommendations(records);
  expect(result).toHaveLength(1);
  expect(result[0].context).toEqual({ previous_task: null, task_history: { ARI: { training_count: 2 } } });
  expect(result[0].available_actions).toEqual([{ task_code: "ARI" }]);
  expect(records[0].context.previous_task).toBe("DPT");
});

test("shared scope filters participant exports while cohort model training retains all participants", () => {
  const inputs = prepareResearchInputs(["a", "b"].flatMap((participantId) => ["CBT", "ARI"].map((task_code) => ({ participantId, taskSession: { task_code } })))).inputs;
  const scope = { selectedParticipant: "a", selectedTask: "ARI" };
  expect(scopeResearchInputs(inputs, scope)).toHaveLength(1);
  expect(scopeResearchInputs(inputs, scope, { cohort: true })).toHaveLength(2);
});
