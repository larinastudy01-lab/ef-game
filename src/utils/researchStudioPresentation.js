import { isResearchNumber } from "./researchPresentation";

// Local display aliases only. Research IDs and exported values remain intact.
export function assignParticipantLabels(ids, previous = {}) {
  const mapping = { ...previous };
  let next = Math.max(0, ...Object.values(mapping).filter((value) => /^P-\d+$/.test(value)).map((value) => Number(value.slice(2)))) + 1;
  const unseen = [...new Set(ids.filter(Boolean))].filter((id) => !mapping[id]).sort();
  unseen.forEach((id) => { mapping[id] = `P-${String(next++).padStart(3, "0")}`; });
  return unseen.length ? mapping : previous;
}

export const participantLabel = (id, mapping = {}) => {
  if (!id || id === "ALL") return id === "ALL" ? "全部參與者" : "尚未選擇參與者";
  const alias = mapping[id];
  return alias ? `${alias}｜匿名參與者 ${alias.slice(2)}` : "匿名參與者";
};

export function summarizeResearchRows(rows = []) {
  const completed = rows.filter((row) => row.session_completion_status === "completed");
  const valid = completed.filter((row) => isResearchNumber(row.analysis_trial_count) && Number(row.analysis_trial_count) > 0);
  const sessions = (items) => new Set(items.filter((row) => row.session_id).map((row) => `${row.participant_id}::${row.session_id}`)).size;
  const sumKnown = (key) => rows.length && rows.every((row) => isResearchNumber(row[key])) ? rows.reduce((sum, row) => sum + Number(row[key]), 0) : null;
  return { participantCount: new Set(rows.map((row) => row.participant_id).filter(Boolean)).size,
    validSessionCount: sessions(valid), assessmentCount: sessions(valid.filter((row) => row.assessment_or_training === "assessment")),
    trainingCount: sessions(valid.filter((row) => row.assessment_or_training === "training")),
    taskSessionCount: rows.length, completedCount: completed.length,
    missingCount: rows.filter((row) => !isResearchNumber(row.accuracy) || !isResearchNumber(row.rt_mean)).length,
    incompleteCount: rows.filter((row) => row.session_completion_status && row.session_completion_status !== "completed").length,
    excludedTrialCount: sumKnown("excluded_trial_count"), analysisTrialCount: sumKnown("analysis_trial_count") };
}

export const RESEARCH_EVENT_LABELS = { Assessment: "正式評測", Training: "訓練", Task: "任務紀錄", Result: "結果紀錄", Recommendation: "推薦策略" };
export const RESEARCH_TASK_DESCRIPTIONS = {
  SRT: "持續注意與反應抑制", PM: "視覺工作記憶", CBT: "視空間工作記憶",
  ARI: "聽覺規則與抑制控制", LB: "順序與規則切換", DCCS: "認知彈性與分類切換",
};

export const REPRESENTATIVE_METRICS = {
  CBT: { key: "cbt_max_correct_span", label: "最新正確記憶廣度", unit: "格" },
  PM: { key: "pm_max_correct_memory_load", label: "最新正確記憶負荷", unit: "項" },
  SRT: { key: "srt_go_accuracy", label: "最新 Go 正確率", unit: "%" },
  ARI: { key: "accuracy", label: "最新反向選擇正確率", unit: "%" },
  LB: { key: "accuracy", label: "最新規則作答正確率", unit: "%" },
  DCCS: { key: "dccs_switch_cost_ms", label: "最新規則切換成本", unit: "ms" },
};
