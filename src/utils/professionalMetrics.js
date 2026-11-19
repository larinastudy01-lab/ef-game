import { getTrialResponseState } from "../analytics/trials/validation";
import { REACTION_TIME_LIMITS_MS } from "../analytics/trials/constants";

export const numberOrNull = (value) => !["number", "string"].includes(typeof value) || (typeof value === "string" && !value.trim()) || !Number.isFinite(Number(value)) ? null : Number(value);
export const metricText = (value, unit = "", digits = 1) => numberOrNull(value) === null ? "未記錄" : `${Number(Number(value).toFixed(digits))}${unit}`;
const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");
const obj = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const pct = (n, d) => d > 0 ? n / d * 100 : null;
const bool = (...values) => values.find((value) => typeof value === "boolean");
const countField = (rows, key) => { const values = rows.map((t) => numberOrNull(t.meta[key])).filter((v) => v !== null); return values.length ? values.reduce((a, b) => a + b, 0) : null; };

function sources(record = {}) {
  const raw = obj(record.raw || record); const payload = obj(raw.payload);
  const bases = [raw, obj(payload.rawResult), obj(raw.rawResult), obj(raw.session), obj(payload.session), obj(raw.config), obj(payload.rawResult?.config), obj(payload.summary), obj(raw.summary), obj(raw.summary_data), obj(raw.clinician_metrics), obj(raw.raw_data)];
  return bases.flatMap((source) => [source, obj(source.protocol), obj(source.scoring)]);
}
const pick = (record, keys) => first(...sources(record).flatMap((source) => keys.map((key) => source[key])));
const stableSettings = (value) => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);
export function recordConditions(record = {}) {
  const mode = first(record.type, record.assessment_or_training, record.sessionMetadata?.assessment_or_training, pick(record, ["mode", "record_type"]));
  const clean = (value) => value === "-" || value === "default" || value === "未記錄" ? null : value ?? null;
  const trials = getPresentationTrials(record);
  return {
    task: clean(first(record.gameKey, record.taskCode, pick(record, ["game_id", "gameId", "task_code"]))),
    mode: ["test", "assessment"].includes(mode) ? "assessment" : mode === "training" ? "training" : null,
    difficulty: clean(first(pick(record, ["difficulty", "difficultyLabel", "difficulty_level"]), record.sessionMetadata?.difficulty_level, record.difficulty)),
    protocol: clean(first(pick(record, ["protocolVersion", "protocol_version", "protocolId"]), ...sources(record).map((s) => s.protocol?.version), record.sessionMetadata?.protocol_version,
      ...sources(record).map((s) => s.protocol && Object.keys(s.protocol).length ? `已記錄設定 ${stableSettings(s.protocol)}` : null))),
    scoring: clean(pick(record, ["scoringVersion", "scoring_version"])),
    form: ["formVersion", "taskVersion", "testVersion", "assessmentVersion", "stimulusSetId", "taskRule"].map((key) => [key, pick(record, [key])]).filter(([,value]) => value != null).map(([key,value]) => `${key}=${value}`).join("；") || null,
    timeLimit: clean(pick(record, ["answerTimeLimitMs", "answerLimitMs", "responseWindowMs", "timeLimitMs"])),
    composition: conditionComposition(trials),
  };
}
function conditionComposition(trials) {
  if (!trials.length) return null;
  const counts = {};
  trials.filter((t) => t.state.administered === true && !["background", "golden"].includes(t.meta.targetType)).forEach((t) => {
    const m = t.meta;
    const key = JSON.stringify([m.memoryCount ?? m.memorySpan ?? m.sequenceLength ?? m.length ?? null,
      m.ruleStage ?? m.ruleType ?? m.rule ?? null, m.targetType ?? m.soundType ?? null,
      m.answerTimeLimitMs ?? m.answerLimitMs ?? m.answerTimeLimit ?? null,
      m.showTime ?? m.visibleTimeMs ?? null, m.stimulusSetId ?? null, m.isReverseRule ?? null]);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts).length ? JSON.stringify(Object.fromEntries(Object.entries(counts).sort(([a],[b]) => a.localeCompare(b)))) : null;
}
export function compareRecords(previous, latest) {
  if (!previous || !latest) return { comparable: false, reasons: ["尚無前次資料"], change: null };
  const a = recordConditions(previous); const b = recordConditions(latest); const reasons = [];
  const names = { task: "任務", mode: "測驗／訓練", difficulty: "難度", protocol: "施測版本", scoring: "計分版本", form: "題本版本", timeLimit: "作答上限", composition: "題次條件組成" };
  ["task", "mode", "difficulty", "protocol", "composition"].forEach((key) => { if (a[key] == null || b[key] == null) reasons.push(`${names[key]}未完整記錄`); });
  Object.keys(names).forEach((key) => { if (a[key] !== b[key]) reasons.push(`${names[key]}不同`); });
  if (previous.patientId && latest.patientId && previous.patientId !== latest.patientId) reasons.push("個案不同");
  if (previous.participantId && latest.participantId && previous.participantId !== latest.participantId) reasons.push("參與者不同");
  const pa = describeRecord(previous); const pb = describeRecord(latest);
  if (!pa.complete || !pb.complete) reasons.push("含未完成紀錄");
  if (pa.integrityError || pb.integrityError) reasons.push("題次來源校驗失敗");
  if (pa.accuracy === null || pb.accuracy === null) reasons.push("有效結果不足");
  return { comparable: !reasons.length, reasons: [...new Set(reasons)], change: reasons.length ? null : pb.accuracy - pa.accuracy, previous: pa, latest: pb, conditions: b };
}
export function getPresentationTrials(record = {}) {
  const raw = obj(record.raw || record); const payload = obj(raw.payload); const result = obj(payload.rawResult || raw.rawResult);
  const candidates = [record.trials, raw.trials, raw.trial_logs, raw.trialLogs, raw.records, result.trials, result.records, result.trialLogs, result.trialDetails, payload.trials, raw.summary_data?.trialLogs];
  const input = candidates.find((v) => Array.isArray(v) && v.length) || [];
  return input.map((entry, index) => {
    const trial = obj(entry);
    const meta = { ...obj(trial.raw_data || trial.rawData), ...trial, ...obj(trial.taskSpecificMetadata || trial.task_specific_metadata) };
    const action = first(meta.trainingAction, meta.action, trial.actualResponse, trial.actual_response);
    let correct = bool(trial.isCorrect, trial.is_correct, trial.correct, meta.success);
    if (correct === undefined && ["hit", "correctReject", "correctRejection", "clickedRotten", "falseAlarm", "miss"].includes(action)) correct = ["hit", "correctReject", "correctRejection"].includes(action);
    const state = getTrialResponseState({ ...meta, isCorrect: correct });
    const rawReasons = trial.exclusionReasons || trial.exclusion_reasons;
    const reasons = Array.isArray(rawReasons) ? rawReasons : [];
    const explicitInvalid = trial.validTrial === false || trial.valid_trial === false;
    const responseOnly = state.timedOut && reasons.length > 0 && reasons.every((r) => ["timeout", "missing_response"].includes(r));
    const usable = state.administered === true && (typeof correct === "boolean" || state.timedOut) && meta.completed !== false && (!explicitInvalid || responseOnly);
    return { meta, index, action, correct: typeof correct === "boolean" ? correct : state.timedOut ? false : null, state, usable,
      rt: numberOrNull(first(trial.reactionTimeMs, trial.reaction_time_ms, meta.reactionTime, meta.responseTime, meta.answerTime, meta.rt)),
      key: first(trial.sourceTrialKey, trial.source_trial_key, trial.trialId, trial.trial_id),
      error: first(trial.errorType, trial.error_type, meta.wrongType), explicitInvalid };
  });
}
const group = (rows, key) => rows.reduce((map, t) => { const value = key(t); if (value == null || value === "") return map; const item = map[String(value)] ||= { correct: 0, total: 0, accuracy: null }; item.total++; item.correct += t.correct === true ? 1 : 0; item.accuracy = pct(item.correct, item.total); return map; }, {});
export function describeRecord(record = {}) {
  const task = first(record.gameKey, record.taskCode, pick(record, ["game_id", "gameId", "task_code"]));
  const trials = getPresentationTrials(record); const seen = new Set();
  const integrityError = trials.some((t) => { if (t.key == null) return false; if (seen.has(String(t.key))) return true; seen.add(String(t.key)); return false; });
  const rows = integrityError ? [] : trials.filter((t) => t.usable && !(task === "SRT" && ["background", "golden"].includes(t.meta.targetType)));
  const completeStatus = first(pick(record, ["status", "completionStatus", "completion_status"]), !record.raw ? record.completionStatus : null, record.sessionMetadata?.session_completion_status);
  const complete = ["completed", "complete", "finished", "已完成"].includes(completeStatus);
  const correct = rows.filter((t) => t.correct === true).length; const total = rows.length;
  const limits = REACTION_TIME_LIMITS_MS[task] || { minimum: 80, maximum: 120000 };
  const rts = rows.filter((t) => t.correct && !t.state.timedOut && !t.explicitInvalid && t.rt !== null && t.rt >= limits.minimum && t.rt <= limits.maximum).map((t) => t.rt);
  const rtMean = mean(rts); const rtSd = rts.length >= 2 ? Math.sqrt(rts.reduce((sum, v) => sum + (v - rtMean) ** 2, 0) / (rts.length - 1)) : null;
  const specific = {};
  if (task === "SRT") {
    const go = rows.filter((t) => ["normal", "good", "fresh"].includes(t.meta.targetType)); const noGo = rows.filter((t) => t.meta.targetType === "rotten");
    specific.hitRate = pct(go.filter((t) => t.correct).length, go.length); specific.omissionRate = pct(go.filter((t) => t.action === "miss" || t.state.timedOut).length, go.length);
    specific.commissionRate = pct(noGo.filter((t) => ["clickedRotten", "falseAlarm"].includes(t.action)).length, noGo.length); specific.goN = go.length; specific.noGoN = noGo.length;
    const half = Math.floor(rows.length / 2); specific.splitChange = rows.length >= 4 ? pct(rows.slice(half).filter((t) => t.correct).length, rows.length - half) - pct(rows.slice(0, half).filter((t) => t.correct).length, half) : null;
  }
  if (["CBT", "PM"].includes(task)) {
    const load = (t) => numberOrNull(first(t.meta.memoryCount, t.meta.memorySpan, t.meta.sequenceLength, t.meta.length, Array.isArray(t.meta.targetSequence) ? t.meta.targetSequence.length : null));
    specific.byLoad = group(rows, (t) => load(t) > 0 ? load(t) : null); const loads = rows.filter((t) => t.correct && load(t) > 0).map(load); specific.maxCorrectLoad = loads.length ? Math.max(...loads) : null;
    specific.partialScores = rows.map((t) => numberOrNull(first(t.meta.scoreValue, t.meta.partialScore, t.meta.partialCredit))).filter((v) => v !== null); specific.wrongTapCount = countField(rows, "wrongTapCount"); specific.missedTargetCount = countField(rows, "missedTargetCount");
    specific.orderErrors = rows.some((t) => t.error || t.meta.errorTypes) ? rows.filter((t) => ["sequenceError", "orderError"].includes(t.error) || numberOrNull(t.meta.errorTypes?.sequenceError) > 0).length : null;
    specific.omissions = countField(rows.map((t) => ({ ...t, meta: { count: first(t.meta.errorTypes?.miss, t.error === "miss" ? 1 : null) } })), "count");
    if (task === "CBT") {
      const sequences = rows.map((t) => ({ expected: first(t.meta.targetSequence, t.meta.sequence, t.meta.correctSequence), actual: first(t.meta.userSequence, t.meta.clickedSequence, t.meta.answer) })).filter((t) => Array.isArray(t.expected) && Array.isArray(t.actual));
      if (specific.orderErrors === null && sequences.length) specific.orderErrors = sequences.filter((t) => t.expected.length === t.actual.length && JSON.stringify(t.expected) !== JSON.stringify(t.actual) && JSON.stringify([...t.expected].sort()) === JSON.stringify([...t.actual].sort())).length;
      if (specific.omissions === null && sequences.length) specific.omissions = sequences.reduce((n,t) => n + Math.max(0, t.expected.length - t.actual.length), 0);
    }
  }
  if (task === "ARI") {
    const animalLabels = pick(record, ["stimulusAnimalLabels"]) || {};
    specific.conditions = group(rows, (t) => first(t.meta.soundAnimalLabel, t.meta.stimulusAnimalLabels?.[t.meta.soundType], animalLabels[t.meta.soundType], t.meta.soundAnimal,
      t.meta.soundType === "cat" ? "聲音角色 A（動物未記錄）" : t.meta.soundType === "dog" ? "聲音角色 B（動物未記錄）" : t.meta.soundType));
    specific.selection = group(rows, (t) => first(t.meta.selectedPosition, t.meta.clickedSide, t.meta.selectedSide));
  }
  if (["DCCS", "LB"].includes(task)) { specific.byRule = group(rows, (t) => first(t.meta.ruleStage, t.meta.ruleType, t.meta.rule)); }
  if (task === "DCCS") {
    specific.byRule = group(rows, (t) => first(t.meta.matchBy, t.meta.rule, t.meta.rule_type, t.meta.ruleStage));
    specific.byStage = group(rows, (t) => t.meta.ruleStage);
    const flagged = rows.filter((t) => typeof t.meta.isPerseverativeError === "boolean" || typeof t.meta.isOldRuleInterference === "boolean");
    specific.perseverationCount = flagged.length ? flagged.filter((t) => t.meta.isPerseverativeError === true || t.meta.isOldRuleInterference === true).length : null;
    const switched = rows.filter((t) => [t.meta.isSwitch, t.meta.wasAfterRuleSwitch, t.meta.isAfterSwitch, t.meta.isPostSwitch].includes(true)); specific.switchErrors = switched.length ? switched.filter((t) => !t.correct).length : null;
  }
  if (task === "LB") { specific.sequenceErrors = rows.some((t) => t.error != null) ? rows.filter((t) => ["sequenceError", "numberError", "colorError", "ruleSwitchError"].includes(t.error)).length : null;
    const planned = numberOrNull(pick(record, ["totalSteps", "plannedStepCount"])); const completed = numberOrNull(pick(record, ["completedSteps", "completedStepCount"])); specific.completion = planned > 0 && completed !== null && completed <= planned ? pct(completed, planned) : null;
    const stages = pick(record, ["stageRecords"]);
    specific.stageCompletion = Array.isArray(stages) ? stages.filter((stage) => stage && typeof stage === "object").map((stage) => ({ stage: first(stage.stageTitle, stage.stageId, "未記錄階段"), completed: numberOrNull(stage.completedSteps), planned: numberOrNull(stage.totalSteps) })).map((stage) => ({ ...stage, completion: stage.planned > 0 && stage.completed !== null && stage.completed <= stage.planned ? pct(stage.completed, stage.planned) : null })) : [];
  }
  const errors = rows.reduce((map, t) => { if (t.error) map[t.error] = (map[t.error] || 0) + 1; return map; }, {});
  return { task, complete, integrityError, correct: total ? correct : null, total: total || null, accuracy: pct(correct, total), rtMean, rtSd, rtN: rts.length, recordedTrials: trials.length, unknownTrials: trials.length - total, specific, errors, finishReason: pick(record, ["finishReason", "reason", "stopReason"]) || null,
    status: integrityError ? { tone: "error", label: "題次來源異常" } : !trials.length ? { tone: "neutral", label: "題次資料不足" } : !complete ? { tone: "warning", label: "完成狀態待確認" } : total !== trials.length ? { tone: "warning", label: "部分題次待確認" } : { tone: "success", label: "題次品質檢查通過" } };
}

export function taskHistory(records, task) {
  const formal = records.filter((r) => r.gameKey === task && ["test", "assessment"].includes(r.type)).sort((a, b) => new Date(b.date) - new Date(a.date));
  const valid = formal.filter((r) => { const d = describeRecord(r); return d.complete && !d.integrityError && d.total > 0; });
  const latest = valid[0] || null; const previous = latest ? valid.slice(1).find((r) => compareRecords(r, latest).comparable) || null : null;
  return { latest, previous, comparison: compareRecords(previous, latest), history: valid, otherCount: records.filter((r) => r.gameKey === task).length - valid.length };
}
