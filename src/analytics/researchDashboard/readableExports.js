import { RESEARCH_TASK_NAMES, RESEARCH_TASK_NAMING } from "../../config/researchTasks";
import { rowsToCsv } from "./exports";

const first = (...values) => values.find((value) => value !== null && value !== undefined) ?? null;
const modeLabel = (value) => ({ assessment: "測驗", training: "訓練" }[value] || value || null);
const field = (key, label, source, unit = "") => ({ key, label, source, unit });
const RAW_COLUMNS = [
  field("participant_id", "參與者代碼", "participantId"),
  field("session_id", "場次代碼", "sessionId"),
  field("task_session_id", "作業場次代碼", "taskSession.id"),
  field("task_name", "作業名稱", "研究端中文名稱對照"),
  field("task_code", "作業代碼", "taskSession.task_code"),
  field("mode", "測驗／訓練", "sessionMetadata.assessment_or_training"),
  field("test_version", "測驗版本", "raw_data.testVersion"),
  field("difficulty", "難度", "raw_data.difficulty / microDifficulty / level；缺漏時使用 taskSession.difficulty"),
  field("condition", "作業條件／規則", "raw_data.condition / ruleStage / rule / ruleType / stageId"),
  field("trial_index", "題次", "behavioral_trials.trial_index"),
  field("stimulus", "刺激內容", "CBT: targetSequence / sequence / correctSequence；PM: correctIds / memorizeItems / memoryItems；SRT: targetType；ARI: soundType / stimulus；LB: expectedKey / expectedNumber；DCCS: cardId / cardType；其他: stimulus"),
  field("expected_response", "預期作答", "CBT: targetSequence / sequence / correctSequence；PM: correctIds；SRT: shouldClick；ARI: expectedTarget / correctAnswer；LB: expectedKey / expectedNumber；DCCS: correctSide / correctPosition；缺漏時使用 expectedResponse"),
  field("actual_response", "實際作答", "CBT: userSequence / clickedSequence / answer；PM: selectedIds；SRT: trainingAction / action；ARI: selectedTarget / userAnswer / selectedPosition / selectedSide / response；LB: clickedKey / clickedNumber；DCCS: userAnswerSide / selectedPosition；缺漏時使用 actualResponse"),
  field("is_correct", "正誤", "raw_data.isCorrect / correct；true=正確，false=錯誤"),
  field("reaction_time_ms", "反應時間（ms）", "raw_data.reactionTime / responseTime / answerTime / rt", "ms"),
  field("is_timeout", "是否逾時", "raw_data.isTimeout / timeout；true=是，false=否"),
  field("occurred_at", "紀錄時間", "behavioral_trials.occurred_at / raw_data.timestamp / createdAt"),
  field("trial_id", "原始題次代碼", "behavioral_trials.id"),
  field("source_trial_key", "來源題次鍵", "behavioral_trials.source_trial_key"),
  field("raw_schema_version", "原始資料版本", "behavioral_trials.raw_schema_version"),
];

// Only known acquisition fields are exposed. Do not spread arbitrary raw payloads
// into research tables: historical payloads can contain unrelated identity fields.
const EXTRA_FIELDS = [
  ["stimulusSetId", "刺激組代碼"], ["stimulusName", "刺激名稱"], ["targetType", "刺激類型"],
  ["sequenceLength", "序列長度"], ["boardPositions", "石頭位置"], ["firstErrorPosition", "首次錯誤位置"],
  ["averageTapInterval", "平均點擊間隔（ms）"], ["promptEvents", "提示事件"], ["repeatedClickCount", "重複點擊次數"],
  ["memoryCount", "記憶數量"], ["optionCount", "選項數量"], ["firstTapTime", "首次點擊時間（ms）"],
  ["wrongTapCount", "誤點次數"], ["missedTargetCount", "漏選數量"], ["deselectCount", "取消選取次數"],
  ["tapLogs", "點擊紀錄"], ["clickLogs", "點選事件"], ["responseStatus", "作答狀態"], ["responseState", "回應狀態"],
  ["administered", "是否已施測"], ["completed", "是否完成"], ["positionX", "刺激 X 座標"], ["positionY", "刺激 Y 座標"],
  ["missed", "是否漏按"], ["falseClick", "是否誤按"], ["assisted", "是否有協助"], ["errorType", "錯誤類型"],
  ["soundType", "聲音類型"], ["correctPosition", "正確位置"], ["selectedPosition", "選取位置"],
  ["isAnticipation", "是否過早反應"], ["stageId", "關卡代碼"], ["ruleType", "規則類型"],
  ["expectedNumber", "預期數字"], ["clickedNumber", "點選數字"], ["expectedColor", "預期顏色"], ["clickedColor", "點選顏色"],
  ["selectionOrder", "選取順序"], ["isSwitch", "是否切換規則"], ["hasInterference", "是否有干擾"],
  ["cumulativeTime", "累積時間（ms）"], ["cardColor", "卡片顏色"], ["cardType", "卡片種類"], ["cue", "規則提示"],
  ["ruleStage", "規則階段"], ["switchDirection", "切換方向"], ["isAfterSwitch", "是否在切換後"],
  ["isPerseverativeError", "是否沿用舊規則"],
].map(([key, label]) => field(`raw_${key}`, label, `raw_data.${key}`, label.includes("（ms）") ? "ms" : ""));

const STIMULUS_KEYS = { CBT: ["targetSequence", "sequence", "correctSequence"], PM: ["correctIds", "memorizeItems", "memoryItems"],
  SRT: ["targetType"], ARI: ["soundType", "stimulus"], LB: ["expectedKey", "expectedNumber"], DCCS: ["cardId", "cardType"] };
const EXPECTED_KEYS = { CBT: ["targetSequence", "sequence", "correctSequence"], PM: ["correctIds"], SRT: ["shouldClick"],
  ARI: ["expectedTarget", "correctAnswer"], LB: ["expectedKey", "expectedNumber"], DCCS: ["correctSide", "correctPosition"] };
const ACTUAL_KEYS = { CBT: ["userSequence", "clickedSequence", "answer"], PM: ["selectedIds"], SRT: ["trainingAction", "action"],
  ARI: ["selectedTarget", "userAnswer", "selectedPosition", "selectedSide", "response"], LB: ["clickedKey", "clickedNumber"], DCCS: ["userAnswerSide", "selectedPosition"] };
const pick = (raw, keys = [], fallback) => first(...keys.map((key) => raw[key]), raw[fallback]);

export function buildReadableTrialTable(inputs = []) {
  const rows = inputs.flatMap((input) => (input.rawTrials || []).map((trial) => {
    const raw = trial.raw_data && typeof trial.raw_data === "object" ? trial.raw_data : {};
    const code = input.taskSession?.task_code;
    return { participant_id: input.participantId, session_id: input.sessionId, task_session_id: input.taskSession?.id,
      task_name: RESEARCH_TASK_NAMES[code] || code, task_code: code, mode: modeLabel(input.sessionMetadata?.assessment_or_training),
      test_version: first(raw.testVersion), difficulty: first(raw.difficulty, raw.microDifficulty, raw.level, input.taskSession?.difficulty),
      condition: first(raw.condition, raw.ruleStage, raw.rule, raw.ruleType, raw.stageId),
      trial_index: trial.trial_index, stimulus: pick(raw, STIMULUS_KEYS[code], "stimulus"),
      expected_response: pick(raw, EXPECTED_KEYS[code], "expectedResponse"), actual_response: pick(raw, ACTUAL_KEYS[code], "actualResponse"),
      is_correct: first(raw.isCorrect, raw.correct), reaction_time_ms: first(raw.reactionTime, raw.responseTime, raw.answerTime, raw.rt),
      is_timeout: first(raw.isTimeout, raw.timeout), occurred_at: first(trial.occurred_at, raw.timestamp, raw.createdAt),
      trial_id: trial.id, source_trial_key: trial.source_trial_key, raw_schema_version: trial.raw_schema_version,
      ...Object.fromEntries(EXTRA_FIELDS.map(({ key }) => [key, first(raw[key.slice(4)])])),
    };
  }));
  return { rows, columns: [...RAW_COLUMNS, ...EXTRA_FIELDS.filter(({ key }) => rows.some((row) => row[key] !== null))] };
}

const SUMMARY_COLUMNS = [
  field("participant_id", "參與者代碼", "task_features.participant_id"), field("session_id", "場次代碼", "task_features.session_id"),
  field("task_session_id", "作業場次代碼", "task_features.task_session_id"), field("task_name", "作業名稱", "研究端中文名稱對照"),
  field("task_code", "作業代碼", "task_features.task_code"), field("mode", "測驗／訓練", "task_features.assessment_or_training"),
  field("session_started_at", "場次開始時間", "task_features.session_started_at"), field("difficulty", "難度", "task_features.difficulty"),
  field("session_completion_status", "完成狀態", "task_features.session_completion_status"),
  field("total_trial_count", "總題次數", "task_features.total_trial_count"), field("analysis_trial_count", "分析題次數", "task_features.analysis_trial_count"),
  field("excluded_trial_count", "排除題次數", "task_features.excluded_trial_count"),
  field("accuracy_percent", "正確率（%）", "task_features.accuracy × 100", "%"),
  field("rt_mean", "平均反應時間（ms）", "task_features.rt_mean", "ms"),
];

export function readableTableCsv({ columns, rows }) {
  const projected = rows.map((row) => Object.fromEntries(columns.map(({ key, label }) => [label, row[key] ?? null])));
  return projected.length ? rowsToCsv(projected) : columns.map(({ label }) => label).join(",");
}

export function buildReadableResearchExport({ inputs = [], taskRows = [] } = {}) {
  const trials = buildReadableTrialTable(inputs);
  const summary = { columns: SUMMARY_COLUMNS, rows: taskRows.map((row) => ({ ...row, task_name: RESEARCH_TASK_NAMES[row.task_code] || row.task_code,
    mode: modeLabel(row.assessment_or_training), accuracy_percent: row.accuracy == null ? null : row.accuracy * 100 })) };
  const dictionary = [...trials.columns.map((column) => ({ 檔案: "逐題作答資料.csv", 欄位: column.label, 來源或定義: column.source, 單位: column.unit })),
    ...SUMMARY_COLUMNS.map((column) => ({ 檔案: "場次摘要.csv", 欄位: column.label, 來源或定義: column.source, 單位: column.unit })),
    ...Object.entries(RESEARCH_TASK_NAMING).map(([code, naming]) => ({ 檔案: "作業代碼對照", 欄位: `${RESEARCH_TASK_NAMES[code]}（${code}）`,
      來源或定義: `${naming.english}；${naming.origin}`, 單位: "" })),
    { 檔案: "逐題作答資料.csv", 欄位: "空白與陣列", 來源或定義: "空白表示來源未記錄；false 與 0 保留。序列與事件以 JSON 儲存在各自欄位。只展開原始採集內容，不以清理後資料補值；原始完整內容可另行下載。", 單位: "" }];
  return { trials, summary, files: { "逐題作答資料.csv": readableTableCsv(trials), "場次摘要.csv": readableTableCsv(summary), "欄位說明.csv": rowsToCsv(dictionary) } };
}
