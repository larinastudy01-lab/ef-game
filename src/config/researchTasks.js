import { TASK_CODES, normalizeTaskCode } from "../analytics/trials/constants";

export const RESEARCH_TASKS = TASK_CODES;
export const RESEARCH_TASK_NAMES = Object.freeze({
  CBT: "石頭記憶", PM: "圖片記憶", SRT: "橡實反應", ARI: "貓狗反向",
  LB: "幫助迷路的綿羊奶奶", DCCS: "物品規則分類",
});
export const researchTaskLabel = (code) => RESEARCH_TASK_NAMES[code] ? `${code} · ${RESEARCH_TASK_NAMES[code]}` : "未提供現行任務";
export const isCurrentResearchTask = (code) => RESEARCH_TASKS.includes(normalizeTaskCode(code));

/** Only current tasks enter research analysis. Acquisition payloads are never rewritten. */
export function prepareResearchInputs(records = []) {
  const inputs = records.flatMap((record) => {
    const code = normalizeTaskCode(record.taskSession?.task_code || record.taskSession?.taskCode);
    if (!RESEARCH_TASKS.includes(code)) return [];
    return [{ ...record, taskSession: { ...record.taskSession, task_code: code, taskCode: code, task_name: RESEARCH_TASK_NAMES[code] } }];
  });
  return { inputs, excludedCount: records.length - inputs.length };
}

export function prepareResearchRecommendations(records = []) {
  return records.flatMap((record) => {
    const action = record.selected_action || {};
    const code = normalizeTaskCode(action.task_code);
    if (!RESEARCH_TASKS.includes(code)) return [];
    const context = record.context || {};
    return [{ ...record, selected_action: { ...action, task_code: code },
      available_actions: (record.available_actions || []).filter((item) => isCurrentResearchTask(item.task_code))
        .map((item) => ({ ...item, task_code: normalizeTaskCode(item.task_code) })),
      context: { ...context, previous_task: isCurrentResearchTask(context.previous_task) ? normalizeTaskCode(context.previous_task) : null,
        task_history: Object.fromEntries(Object.entries(context.task_history || {}).filter(([task]) => isCurrentResearchTask(task))
          .map(([task, history]) => [normalizeTaskCode(task), history])) } }];
  });
}

export const matchesResearchScope = (participant, task, scope) =>
  (!scope.selectedParticipant || scope.selectedParticipant === "ALL" || scope.selectedParticipant === participant)
  && (scope.selectedTask === "ALL" || scope.selectedTask === task);

export function scopeResearchInputs(inputs, scope, { cohort = false } = {}) {
  return inputs.filter((input) => matchesResearchScope(input.participantId, input.taskSession?.task_code,
    cohort ? { ...scope, selectedParticipant: "ALL" } : scope));
}
