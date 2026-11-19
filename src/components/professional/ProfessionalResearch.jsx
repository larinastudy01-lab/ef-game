import { describeRecord } from "../../utils/professionalMetrics";
import { PROFESSIONAL_TASKS } from "../../config/professionalIndicators";
import { formatMetric as metricText, finiteNumber, formatPercentage, formatDateTime } from "../../utils/professionalFormatters";
import { ResearchDataTable, TrialDetails } from "../research/ResearchStudioUI";
import { researchConditionGroups, summarizeProfessionalResearch } from "../../utils/professionalResearch";
import { coreValue, DataStatus, TaskMetricDetail } from "./ProfessionalData";

export function ResearchFindings({ inputs, demo = false }) {
  const summary = summarizeProfessionalResearch(inputs); const groups = researchConditionGroups(summary.records);
  const populated = Object.keys(PROFESSIONAL_TASKS).filter((task) => groups.some((g) => g.conditions.task === task));
  return <section className="professional-findings" aria-label="觀察摘要與證據"><h3>{demo ? "實際資料摘要（與模擬模型分開）" : "目前可確認的研究觀察"}</h3><dl><dt>觀察摘要</dt><dd>{summary.validTrials ? `目前有 ${populated.length} 種作業具備可描述的完成紀錄；尚未據此推論個人的整體能力。` : "目前沒有完成狀態與有效題次皆可確認的資料，不產生研究發現。"}</dd><dt>資料證據</dt><dd>有效參與者 {summary.validParticipantCount} 位；有效題次 {summary.validTrials}/{summary.recordedTrials}。有效題次占已記錄題次 {metricText(summary.completeness, "%")}。{populated.map((task) => <span key={task}> {task}：{groups.filter((g) => g.conditions.task === task).reduce((n,g) => n + g.records.length, 0)} 筆完成任務。</span>)}</dd><dt>解讀限制</dt><dd>完整率僅描述已讀取紀錄，不是六項作業的計畫完成率。不同模式、負荷、難度與版本須分開分析；小樣本、缺少條件或只有一次測量時，暫不判定變化。模擬資料、模型重要性與研究門檻不構成臨床風險分級。</dd></dl></section>;
}
export function AvailableBehaviorAnalysis({ inputs = [] }) {
  const summary = summarizeProfessionalResearch(inputs);
  const rows = Object.entries(PROFESSIONAL_TASKS).map(([task, definition]) => {
    const selected = inputs.filter((input) => (input.taskSession?.task_code || input.taskSession?.taskCode) === task);
    const trials = selected.flatMap((input) => input.trials || []);
    const usable = trials.filter((t) => t.valid_trial === true);
    const rts = usable.map((t) => finiteNumber(t.reaction_time_ms)).filter((v) => v !== null && v >= 0);
    const bins = [0, 500, 1000, 2000, 5000, Infinity].slice(0, -1).map((lower, index) => {
      const upper = [500, 1000, 2000, 5000, Infinity][index];
      return `${lower}–${upper === Infinity ? "以上" : upper} ms：${rts.filter((v) => v >= lower && v < upper).length}`;
    });
    const errors = trials.reduce((map, t) => { const type = t.error_type || t.task_specific_metadata?.errorType || t.raw_data?.errorType; if (type) map[String(type)] = (map[String(type)] || 0) + 1; return map; }, {});
    return { task, name: definition.name, records: selected.length, available: `${usable.length}／${trials.length} 題`, rt: rts.length ? bins.join("；") : "無有效反應", errors: Object.entries(errors).map(([type, n]) => `${type}：${n}`).join("；") || "未記錄錯誤型態" };
  });
  return <section className="studio-card"><h2>目前可用的分析・真實資料</h2><p>資料完整率 {formatPercentage(summary.completeness, { detail: false })}（{summary.validTrials}／{summary.recordedTrials} 已記錄題次）；以下為來源已標示可用的題次分布，不需 AI 模型。</p>
    <ResearchDataTable title="描述性統計與行為分布" rows={rows} searchable={false} columns={[{ key: "name", label: "任務" }, { key: "records", label: "紀錄數", numeric: true }, { key: "available", label: "來源可用／原始題次" }, { key: "rt", label: "RT 分布（左含右不含）" }, { key: "errors", label: "原始錯誤型態" }]}/>
    <details><summary>六項任務指標與試次層級特徵</summary><ResearchTaskSummaryGrid inputs={inputs} />{inputs.map((input, index) => <details key={input.taskSession?.id || index}><summary>{PROFESSIONAL_TASKS[input.taskSession?.task_code]?.name || "任務"}・場次 {index + 1} 題次特徵</summary><TrialDetails input={input}/></details>)}</details>
    <p className="research-caption">只描述目前選取範圍；RT 分布依來源 valid_trial，與只採正確反應的任務 RT 指標分列。不同難度、模式及版本未合併推論；未記錄的錯誤型態不代表沒有錯誤。</p></section>;
}
export function ResearchTaskSummaryGrid({ inputs, onDetail }) {
  const summary = summarizeProfessionalResearch(inputs);
  return <div className="professional-task-grid">{Object.entries(PROFESSIONAL_TASKS).map(([task, definition]) => {
    const records = summary.records.filter((r) => r.gameKey === task); const groups = researchConditionGroups(records);
    const latest = groups.flatMap((g) => g.records).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    const d = latest ? describeRecord(latest) : null;
    return <article className="professional-task-card" key={task}><header><h3>{definition.name}</h3><span>{task}</span></header><p>{definition.construct}</p><small>最近有效紀錄：{formatDateTime(latest?.date)}</small><strong className="professional-value">{metricText(d?.accuracy, "%", 0)}</strong><span>正確／有效題：{d ? `${d.correct}／${d.total}` : "資料不足"}｜{latest?.type === "training" ? "訓練" : latest ? "正式測驗" : "未記錄"}</span><p>{definition.core}：{coreValue(d)}</p><DataStatus compact tone={d ? "success" : "neutral"}>{d ? "✓ 可供描述" : "資料不足"}</DataStatus>
      <details><summary>各施測條件與本次指標</summary><p>{records.length} 筆任務紀錄、{groups.length} 組條件；首頁為最近一筆觀察，各條件加權摘要如下。{definition.limitation}</p>{!groups.length && <p>需確認完成狀態與有效題次；原始資料仍可匯出。</p>}{groups.map((g,index) => <section key={index}><h4>{g.conditions.mode === "training" ? "訓練" : "正式測驗"}｜{g.conditions.difficulty || "難度未記錄"}｜版本 {g.conditions.protocol || "未記錄"}</h4><p>{metricText(g.correct/g.total*100,"%")}（{g.correct}/{g.total}）｜{g.records.length} 筆、{g.participants.size} 位</p><details><summary>最近一筆原始場次的作業指標</summary><TaskMetricDetail record={[...g.records].sort((a,b) => new Date(b.date) - new Date(a.date))[0]}/></details></section>)}</details>{onDetail && <footer><button type="button" onClick={() => onDetail(task)}>詳細分析<span className="studio-sr-only"> {task}</span></button></footer>}</article>;
  })}</div>;
}
