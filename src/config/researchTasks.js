import { TASK_CODES, normalizeTaskCode } from "../analytics/trials/constants";

export const RESEARCH_TASKS = TASK_CODES;
export const RESEARCH_TASK_NAMES = Object.freeze({
  CBT: "石頭記憶", PM: "圖片記憶", SRT: "反應抑制", ARI: "貓狗反向",
  LB: "幫助迷路的綿羊奶奶", DCCS: "物品規則分類",
});
export const researchTaskLabel = (code) => RESEARCH_TASK_NAMES[code] ? `${RESEARCH_TASK_NAMES[code]}（${code}）` : "未提供現行任務";

export const RESEARCH_TASK_NAMING = Object.freeze({
  CBT: { english: "Corsi Block Tapping", origin: "沿用 Corsi 方塊敲擊作業名稱；本專案以石頭呈現。" },
  PM: { english: "Picture Memory", origin: "依圖片記憶作業的英文名稱取首字母。" },
  SRT: { english: "Simple Reaction Task", origin: "沿用早期反應作業代碼；現行作業包含反應抑制，測驗使用水果、訓練使用橡實。" },
  ARI: { english: "Auditory Rule Inhibition", origin: "專案依聽覺規則抑制作業命名，對應貓狗反向選擇。" },
  LB: { english: "Linking Balloons", origin: "沿用早期連線遊戲代碼；現行內容為依規則連結門牌。" },
  DCCS: { english: "Dimensional Change Card Sort", origin: "沿用向度改變卡片分類作業名稱；本專案以物品分類呈現。" },
});
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
