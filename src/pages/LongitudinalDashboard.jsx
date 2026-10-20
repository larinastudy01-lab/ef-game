import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, EmptyState, MetricCard, PageHeader, ResearchDataTable, ResearchNotice, ResearchTimeline } from "../components/research/ResearchStudioUI";
import { humanizeFeature } from "../analytics/explainability";
import { useResearchData, useResearchSelection, useResearchWorkspace } from "../components/research/ResearchWorkspaceContext";
import { matchesResearchScope, RESEARCH_TASKS, RESEARCH_TASK_NAMES, researchTaskLabel } from "../config/researchTasks";
import { buildResearchQualityAlerts, buildResearchTaskContext, isResearchNumber, orderResearchRows, validMetric, RESEARCH_METRICS, researchDate, researchNumber } from "../utils/researchPresentation";
import { ResearchAlerts, ResearchHandoff, ResearchPage, ResearchTrendChart } from "../components/research/ResearchPresentation";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildTaskFeatureRow } from "../analytics/features";
import { analyzeParticipantLongitudinal, taskSpecificMetricNames } from "../analytics/longitudinal";
import { addRollingFeatures } from "../analytics/longitudinal/rolling";
import "../styles/LongitudinalDashboard.css";
import "../styles/ResearchDashboardTheme.css";

const TASKS = RESEARCH_TASKS;
const TASK_LABELS = RESEARCH_TASK_NAMES;
const format = researchNumber;
const date = researchDate;

export default function LongitudinalDashboard() {
  const navigate = useNavigate();
  const workspace = useResearchWorkspace();
  const { inputs, recommendations, loading, error, notices } = useResearchData();
  const rows = useMemo(() => inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata,
    difficulty: input.taskSession?.difficulty, started_at: input.taskSession?.started_at, completed_at: input.taskSession?.completed_at })), [inputs]);
  const participants = useMemo(() => [...new Set(rows.map((row) => row.participant_id).filter(Boolean))].sort(), [rows]);
  const { selectedParticipant, setSelectedParticipant, selectedTask, setSelectedTask } = useResearchSelection(participants, "CBT");
  const logNotice = notices.find((notice) => notice.includes("建議歷程"));
  const taskRows = useMemo(() => rows.filter((row) => selectedTask === "ALL" || row.task_code === selectedTask), [rows, selectedTask]);
  const scopedRecommendations = useMemo(() => recommendations.filter((row) => matchesResearchScope(row.participant_id, row.selected_action?.task_code, { selectedParticipant, selectedTask })), [recommendations, selectedParticipant, selectedTask]);
  const analysis = useMemo(() => selectedParticipant && selectedParticipant !== "ALL" ? analyzeParticipantLongitudinal(selectedParticipant, taskRows, scopedRecommendations) : null,
    [selectedParticipant, taskRows, scopedRecommendations]);
  const taskContext = buildResearchTaskContext(rows.filter((row) => row.participant_id === selectedParticipant), selectedTask);
  const series = taskContext.rows;
  const chartData = addRollingFeatures(series);
  const summary = analysis?.feature_summary.tasks.find((item) => item.task_code === selectedTask);
  const [metric, setMetric] = useState("accuracy"); const [mode, setMode] = useState("ALL"); const [difficulty, setDifficulty] = useState("ALL");
  const individualRows = useMemo(() => orderResearchRows(rows.filter((row) => row.participant_id === selectedParticipant && row.task_code === selectedTask)), [rows, selectedParticipant, selectedTask]);
  const specificMetrics = useMemo(() => taskSpecificMetricNames(individualRows, selectedTask), [individualRows, selectedTask]);
  const metricAvailable = [...Object.keys(RESEARCH_METRICS), ...specificMetrics].includes(metric);
  const difficulties = [...new Set(individualRows.map((row) => String(row.difficulty ?? "未記錄")))].sort((a,b)=>a.localeCompare(b,"zh-Hant",{numeric:true}));
  const plottedRows = individualRows.filter((row) => (mode === "ALL" || row.assessment_or_training === mode) && (difficulty === "ALL" || String(row.difficulty ?? "未記錄") === difficulty));
  const groups = [...new Set(plottedRows.map((row) => (row.assessment_or_training || "unknown") + "::" + String(row.difficulty ?? "未記錄")))];
  const valueFor = (row) => row.session_completion_status && row.session_completion_status !== "completed" ? null : RESEARCH_METRICS[metric] ? validMetric(row[metric],metric) ? Number(row[metric]) : null : isResearchNumber(row[metric]) ? Number(row[metric]) : null;
  const metricDefinition = RESEARCH_METRICS[metric] || { label: humanizeFeature(metric), unit: metric.endsWith("_ms") ? "ms" : "原始尺度", format: (value)=>format(value) };
  const plot = plottedRows.map((row,index)=>({ ...row, point:index+1, ...Object.fromEntries(groups.map((group,groupIndex)=>["series_"+groupIndex, group === (row.assessment_or_training || "unknown")+"::"+String(row.difficulty ?? "未記錄") ? valueFor(row) : null])) }));
  const groupLabel = (group) => { const [kind,level] = group.split("::"); return ({assessment:"正式評測",training:"訓練"}[kind] || "類型未記錄") + " · 難度 " + level; };
  const comparisons = groups.map((group)=>{const observed=plottedRows.filter((row)=>(row.assessment_or_training || "unknown")+"::"+String(row.difficulty ?? "未記錄") === group && valueFor(row)!==null);return {group,label:groupLabel(group),count:observed.length,first:observed[0],latest:observed.at(-1)};});
  if (loading) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>縱向追蹤儀表板</h1><p>正在載入縱向追蹤資料…</p></section></ResearchPage>;
  if (error) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>縱向追蹤儀表板</h1><p>資料尚未可用，請確認資料庫變更與帳號存取權限已完成設定。</p><button className="research-home-button" hidden={Boolean(workspace)} onClick={() => navigate("/clinician-dashboard")}>回主頁</button></section></ResearchPage>;
  return <ResearchPage className="long-page">
    <PageHeader eyebrow="WITHIN-PARTICIPANT RESEARCH" title="縱向追蹤" description="以同一參與者的觀察紀錄，區分評測、訓練與難度條件。"/>
    {!workspace && <section className="long-controls"><label>匿名參與者<select value={selectedParticipant} onChange={(event)=>setSelectedParticipant(event.target.value)}>{participants.map((participant)=><option key={participant}>{participant}</option>)}</select></label><label>任務<select value={selectedTask} onChange={(event)=>setSelectedTask(event.target.value)}>{TASKS.map((task)=><option key={task} value={task}>{researchTaskLabel(task)}</option>)}</select></label></section>}
    {!analysis ? <section className="studio-card"><EmptyState title="選擇單一參與者" description="個人縱向分析需指定研究對象；可於上方範圍選擇器切換。"/></section> : <>
      <div className="studio-kpi-grid"><MetricCard label="場次總數" value={analysis.feature_summary.session_count} icon="calendar"/><MetricCard label="正式評測次數" value={analysis.feature_summary.assessment_session_count}/><MetricCard label="訓練次數" value={analysis.feature_summary.training_session_count} tone="purple"/><MetricCard label="模型準備狀態" value={analysis.mixed_effects_readiness.ready ? "架構就緒" : "資料不足"} detail="混合效應模型尚未擬合" tone="amber"/></div>
      <ChartContainer title="個人縱向表現" count={plottedRows.filter((row)=>valueFor(row)!==null).length} unit={metricDefinition.unit} source={selectedTask === "ALL" ? "請選擇單一任務" : researchTaskLabel(selectedTask)}>
        <div className="studio-local-filters"><label>追蹤指標<select value={metric} onChange={(event)=>setMetric(event.target.value)}>{!metricAvailable && <option value={metric}>{humanizeFeature(metric)}（此任務未提供）</option>}{[...Object.keys(RESEARCH_METRICS),...specificMetrics].map((key)=><option key={key} value={key}>{RESEARCH_METRICS[key]?.label || humanizeFeature(key)}</option>)}</select></label><label>資料類型<select value={mode} onChange={(event)=>setMode(event.target.value)}><option value="ALL">正式評測與訓練分列</option><option value="assessment">正式評測</option><option value="training">訓練</option></select></label><label>難度條件<select value={difficulty} onChange={(event)=>setDifficulty(event.target.value)}><option value="ALL">全部難度分列</option>{difficulty !== "ALL" && !difficulties.includes(difficulty) && <option value={difficulty}>{difficulty}（此範圍未提供）</option>}{difficulties.map((level)=><option key={level}>{level}</option>)}</select></label></div>
        {selectedTask === "ALL" ? <EmptyState title="選擇單一研究任務" description="不同任務不會混成同一條表現曲線。"/> : !metricAvailable || !plottedRows.some((row)=>valueFor(row)!==null) ? <EmptyState title="目前條件沒有可用指標" description="請調整資料類型或難度；不會靜默更改你的選擇。"/> : <><ResponsiveContainer width="100%" height={320}><LineChart data={plot} margin={{top:16,right:24,bottom:20,left:8}}><CartesianGrid vertical={false} stroke="var(--research-border)"/><XAxis dataKey="point" label={{value:"場次（依時間排序）",position:"insideBottom",offset:-12}} tick={{fill:"var(--research-muted)"}}/><YAxis domain={metricDefinition.unit === "%" ? [0,1] : [(min)=>Math.min(0,min),(max)=>Math.max(0,max)]} tickFormatter={metricDefinition.unit === "%" ? metricDefinition.format : undefined} width={80} tick={{fill:"var(--research-muted)"}}/><Tooltip labelFormatter={(value,payload)=>"第 "+value+" 場 · "+date(payload?.[0]?.payload?.session_started_at)} formatter={(value,name)=>[metricDefinition.format(value)+ (metricDefinition.unit === "ms" ? " ms" : ""),name]} contentStyle={{background:"var(--research-card)",color:"var(--research-ink)"}}/><Legend/>{groups.map((group,index)=><Line key={group} type="linear" dataKey={"series_"+index} name={groupLabel(group)} stroke={["var(--research-chart-observed)","var(--research-chart-secondary)","#3f927e","#b37b28"][index%4]} strokeDasharray={group.startsWith("training")?"6 4":undefined} dot={{r:4}} strokeWidth={2} connectNulls={false} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer><p className="research-caption">X 軸：時間排序場次；Y 軸：{metricDefinition.label}（{metricDefinition.unit}）。正式評測用實線、訓練用虛線；難度各自分列。缺失與未完成紀錄保留缺口。</p></>}
      </ChartContainer>
      {selectedTask !== "ALL" && <section className="studio-card"><h2>首次與最近觀察 · 條件分列</h2><ResearchDataTable title="評測與訓練條件比較" rows={comparisons} columns={[
        {key:"label",label:"來源與難度"},{key:"count",label:"有效觀察數",numeric:true},{key:"first_date",label:"首次日期",sortValue:(row)=>row.first?.session_started_at,render:(row)=>date(row.first?.session_started_at)},{key:"first_value",label:"首次值（"+metricDefinition.unit+"）",numeric:true,sortValue:(row)=>row.first?valueFor(row.first):null,render:(row)=>metricDefinition.format(row.first?valueFor(row.first):null)},
        {key:"latest_date",label:"最近日期",sortValue:(row)=>row.latest?.session_started_at,render:(row)=>date(row.latest?.session_started_at)},{key:"latest_value",label:"最近值（"+metricDefinition.unit+"）",numeric:true,sortValue:(row)=>row.latest?valueFor(row.latest):null,render:(row)=>metricDefinition.format(row.latest?valueFor(row.latest):null)},
      ]}/><p className="research-caption">僅列出各條件的實際首筆與末筆觀察，不合併計算評測與訓練差異，也不推論因果效果。</p></section>}
      {selectedTask !== "ALL" && <><ResearchHandoff context={taskContext} taskLabel={researchTaskLabel(selectedTask)}/><details className="studio-advanced"><summary>既有個人基準、移動平均與趨勢摘要</summary><div className="studio-grid-two"><TrendCard title="正確率趨勢" data={chartData} metric="accuracy" rolling="accuracy_rolling_mean"/><TrendCard title="平均反應時間趨勢" data={chartData} metric="rt_mean" rolling="rt_mean_rolling_mean"/><TrendCard title="反應時間變異趨勢" data={chartData} metric="rt_variability_ms" rolling="rt_variability_ms_rolling_mean"/></div><section className="studio-card"><h2>{TASK_LABELS[selectedTask]}任務趨勢摘要</h2><p>{summary?.session_count || 0} 個任務場次 · {summary?.training_count || 0} 個訓練場次 · 每 30 天訓練頻率 {format(summary?.training_frequency_per_30_days)}</p><ResearchDataTable title="個人基準摘要" rows={taskContext.metrics} columns={[
        {key:"metric",label:"指標",render:(row)=>RESEARCH_METRICS[row.metric].label},{key:"baseline_value",label:"個人基準",numeric:true,render:(row)=>RESEARCH_METRICS[row.metric].format(row.baseline_value)},{key:"latest_value",label:"最新",numeric:true,render:(row)=>RESEARCH_METRICS[row.metric].format(row.latest_value)},{key:"absolute_change",label:"變化（百分點／ms）",numeric:true,render:(row)=>format(row.absolute_change === null ? null : row.absolute_change*(RESEARCH_METRICS[row.metric].unit === "%"?100:1),1)},{key:"observation_count",label:"有效觀察數",numeric:true},
      ]}/></section></details></>}
      <section className="studio-card"><h2>研究事件時間軸</h2><ResearchTimeline events={analysis.timeline} inputs={inputs}/></section>
      <details className="studio-advanced"><summary>訓練歷程、建議紀錄與統計建模準備度</summary><div className="studio-grid-two"><section className="studio-card"><h2>訓練歷程</h2><ResearchTimeline events={analysis.timeline.filter((event)=>event.event_type === "Training" || (event.event_type === "Task" && series.some((row)=>row.session_id === event.session_id && row.assessment_or_training === "training")))} inputs={inputs}/></section><section className="studio-card"><h2>建議歷程</h2>{logNotice && <ResearchNotice tone="warning">{logNotice}</ResearchNotice>}<ResearchTimeline events={analysis.timeline.filter((event)=>event.event_type === "Recommendation")} inputs={inputs}/></section></div><section className="studio-card"><h2>統計建模準備度</h2><p>{analysis.mixed_effects_readiness.reason}</p><code>{analysis.mixed_effects_readiness.planned_structure}</code><p>目前尚未擬合混合效應模型，也未報告推論統計結果。</p></section></details>
      <details className="studio-quality-strip"><summary>與目前分析相關的資料品質</summary><ResearchAlerts alerts={buildResearchQualityAlerts(rows.filter((row)=>matchesResearchScope(row.participant_id,row.task_code,{selectedParticipant,selectedTask})))}/></details>
      <ResearchNotice>{analysis.interpretation_guardrail}</ResearchNotice>
    </>}
  </ResearchPage>;
}
function TrendCard(props) { return <section className="studio-card"><ResearchTrendChart {...props}/></section>; }
