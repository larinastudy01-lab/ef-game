import { ChartContainer, EmptyState, MetricCard, PageHeader, ParticipantLabel, ResearchNotice, ResearchTimeline, SectionHeader, TrialDetails } from "../components/research/ResearchStudioUI";
import { REPRESENTATIVE_METRICS, RESEARCH_TASK_DESCRIPTIONS, summarizeResearchRows } from "../utils/researchStudioPresentation";
import { useResearchData, useResearchSelection, useResearchWorkspace } from "../components/research/ResearchWorkspaceContext";
import { matchesResearchScope, RESEARCH_TASKS, RESEARCH_TASK_NAMES, researchTaskLabel, scopeResearchInputs } from "../config/researchTasks";
import { ResearchAlerts, ResearchHandoff, ResearchPage, ResearchTrendChart } from "../components/research/ResearchPresentation";
import { buildResearchQualityAlerts, buildResearchTaskContext, isResearchNumber, orderResearchRows, RESEARCH_METRICS, researchDate, researchMean, researchNumber, researchPercent } from "../utils/researchPresentation";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analyzeModelExplainability, humanizeFeature } from "../analytics/explainability";
import { buildTaskFeatureRow } from "../analytics/features";
import { analyzeParticipantLongitudinal, buildParticipantTimeline } from "../analytics/longitudinal";
import { buildFuturePerformanceDataset } from "../analytics/ml";
import { downloadResearchFile } from "../analytics/researchDashboard";
import { buildUnifiedResearchExport } from "../analytics/reproducibility";
import { analyzeBehavioralStatistics } from "../analytics/statistics";
import "../styles/ResearchProfessionalDashboard.css";
import "../styles/ResearchDashboardTheme.css";

const TASKS = RESEARCH_TASKS;
const TASK_NAMES = RESEARCH_TASK_NAMES;
const mean = researchMean;
const fmt = researchNumber;
const date = researchDate;
const id = (index) => `research-${String(index + 1).padStart(2, "0")}`;

export default function ResearchProfessionalDashboard() {
  const navigate = useNavigate();
  const workspace = useResearchWorkspace();
  const { inputs: allInputs, recommendations, experiments, loading, error } = useResearchData();
  const participants = useMemo(() => [...new Set(allInputs.map((input) => input.participantId).filter(Boolean))].sort(), [allInputs]);
  const { selectedParticipant, setSelectedParticipant, selectedTask, setSelectedTask } = useResearchSelection(participants, "CBT");
  const inputs = useMemo(() => scopeResearchInputs(allInputs, { selectedTask }, { cohort: true }), [allInputs, selectedTask]);
  const openTool = (tool, path) => workspace ? workspace.openTool(tool) : navigate(path);
  const taskRows = useMemo(() => inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata,
    difficulty: input.taskSession?.difficulty, started_at: input.taskSession?.started_at, completed_at: input.taskSession?.completed_at })), [inputs]);
  const scopedRows = useMemo(() => taskRows.filter((row) => selectedParticipant === "ALL" || row.participant_id === selectedParticipant), [taskRows, selectedParticipant]);
  const scopedInputs = useMemo(() => inputs.filter((item) => selectedParticipant === "ALL" || item.participantId === selectedParticipant), [inputs, selectedParticipant]);
  const scopedRecommendations = useMemo(() => recommendations.filter((row) => matchesResearchScope(row.participant_id, row.selected_action?.task_code, { selectedParticipant, selectedTask })), [recommendations, selectedParticipant, selectedTask]);
  const statistics = useMemo(() => analyzeBehavioralStatistics(scopedRows), [scopedRows]);
  const longitudinal = useMemo(() => selectedParticipant && selectedParticipant !== "ALL" ? analyzeParticipantLongitudinal(selectedParticipant, taskRows, recommendations) : null, [selectedParticipant, taskRows, recommendations]);
  const modelState = useMemo(() => { const rows = buildFuturePerformanceDataset(inputs, .3, "accuracy"); const count = new Set(rows.map((row) => row.participant_id)).size;
    if (count < 20) return { unavailable: `目前觀察資料共 ${count} 位參與者；至少需要 20 位，才會在此工作區擬合研究模型。` };
    try { return { result: analyzeModelExplainability(rows, { targetType: "regression", demoMode: false, folds: 5 }) }; } catch (reason) { return { unavailable: reason?.message }; } }, [inputs]);
  const explanation = modelState.result; const individual = explanation?.individual_explanations.find((item) => item.participant_id === selectedParticipant) || null;
  const [trendMetric, setTrendMetric] = useState("accuracy");
  const summary = summarizeResearchRows(scopedRows);
  const recentEvents = useMemo(() => [...new Set(scopedRows.map((row) => row.participant_id).filter(Boolean))].flatMap((participant) => buildParticipantTimeline(participant, scopedRows, scopedRecommendations)).sort((a,b) => new Date(a.occurred_at) - new Date(b.occurred_at)), [scopedRows, scopedRecommendations]);
  const latestSession = selectedParticipant === "ALL" ? null : latestAssessment(scopedRows);
  const taskContext = buildResearchTaskContext(selectedParticipant === "ALL" ? [] : scopedRows, selectedTask);
  const selectedSeries = taskContext.rows;
  const rawTrials = scopedInputs.flatMap((input) => input.trials.map((trial) => ({ ...trial, task_code: input.taskSession?.task_code })));
  const latestTaskInput = [...scopedInputs].filter((input) => (input.taskSession?.task_code || input.taskSession?.taskCode) === selectedTask)
    .sort((a, b) => new Date(a.sessionMetadata?.session_started_at || 0) - new Date(b.sessionMetadata?.session_started_at || 0)).at(-1);
  const selectedTrials = [...(latestTaskInput?.trials || [])].sort((a, b) => Number(a.trial_index || 0) - Number(b.trial_index || 0))
    .map((trial) => ({ ...trial, reaction_time_ms: trial.valid_trial === false || !isResearchNumber(trial.reaction_time_ms) || Number(trial.reaction_time_ms) < 0 ? null : Number(trial.reaction_time_ms) }));
  const rtHistogram = histogram(selectedTrials.map((trial) => trial.reaction_time_ms)); const accuracyHistogram = histogram(selectedSeries.map((row) => isResearchNumber(row.accuracy) ? row.accuracy * 100 : null), 8);
  const errors = errorCounts(rawTrials); const latestRecommendation = [...scopedRecommendations].sort((a, b) => new Date(b.recommendation_timestamp) - new Date(a.recommendation_timestamp))[0];
  const scopedExplanation = useMemo(() => explanation ? { ...explanation, individual_explanations: explanation.individual_explanations.filter((item) => selectedParticipant === "ALL" || item.participant_id === selectedParticipant) } : null, [explanation, selectedParticipant]);
  const exportBundle = useMemo(() => buildUnifiedResearchExport({ inputs: scopedInputs, taskRows: scopedRows, statistics, explainability: scopedExplanation,
    recommendations: scopedRecommendations, experiments }), [scopedInputs, scopedRows, statistics, scopedExplanation, scopedRecommendations, experiments]);
  if (loading) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>研究工作區</h1><p>正在載入研究資料…</p></section></ResearchPage>;
  if (error) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>研究工作區</h1><p>{error}</p><button className="research-home-button" hidden={Boolean(workspace)} onClick={() => navigate("/clinician-dashboard")}>回主頁</button></section></ResearchPage>;
  return <ResearchPage className="research-overview-page">
    <PageHeader eyebrow="RESEARCH OVERVIEW" title="研究總覽" description="從有效資料、任務表現到個人軌跡，掌握目前研究範圍。"/>
    {!workspace && <div className="studio-actions"><label>匿名參與者<select value={selectedParticipant} onChange={(event) => setSelectedParticipant(event.target.value)}>{participants.map((participant) => <option key={participant}>{participant}</option>)}</select></label><TaskSelect value={selectedTask} onChange={setSelectedTask}/></div>}
    <div className="studio-kpi-grid"><MetricCard label="參與者數量" value={summary.participantCount} icon="users" detail="目前分析範圍"/><MetricCard label="有效研究場次" value={summary.validSessionCount} icon="calendar" detail="有已完成且可分析的任務" tone="teal"/><MetricCard label="正式評測場次" value={summary.assessmentCount} icon="statistics" detail="依既有場次類型"/><MetricCard label="訓練場次" value={summary.trainingCount} icon="adaptive" detail="與正式評測分開計數" tone="purple"/></div>
    <div className="studio-quality-strip" aria-label="資料品質摘要"><span>資料品質</span><span>已完成 {summary.completedCount} 筆任務場次</span><span>核心指標缺漏 {summary.missingCount} 筆</span><span>已排除 {summary.excludedTrialCount ?? "—"} 題次</span><details><summary>檢視說明</summary><ResearchAlerts alerts={buildResearchQualityAlerts(scopedRows)}/><p>有效研究場次指至少有一項已完成且有分析題次的任務；各特徵可用樣本數仍依原本統計輸出。</p></details></div>
    <SectionHeader title="六項任務表現概況" description="各任務保留自己的代表指標；「—」表示目前範圍沒有可用數值。"/>
    <div className="studio-task-grid">{TASKS.map((task) => { const rows = orderResearchRows(scopedRows.filter((row) => row.task_code === task)); const latest = rows.at(-1); const metric = REPRESENTATIVE_METRICS[task]; const value = latest?.[metric.key]; return <article className="studio-task-card" key={task}><span className="studio-task-code">{task}</span><h3>{TASK_NAMES[task]}</h3><p>{RESEARCH_TASK_DESCRIPTIONS[task]}</p><div className="studio-task-value">{metric.unit === "%" ? researchPercent(value) : fmt(value, metric.unit === "ms" ? 1 : 0)}{metric.unit !== "%" && isResearchNumber(value) ? <small> {metric.unit}</small> : null}</div><small>{metric.label}</small><footer><span>{rows.filter((row) => row.session_completion_status === "completed" && row.analysis_trial_count > 0).length} 個有效任務場次</span><button type="button" onClick={() => { setSelectedTask(task); openTool("statistics", "/research-statistics"); }}>詳細分析<span className="studio-sr-only"> {task}</span></button></footer>{latest && <details><summary>最近紀錄與衍生指標</summary><p><ParticipantLabel id={latest.participant_id}/> · {date(latest.session_started_at)}</p><dl className="studio-detail-list">{numericSpecifics(latest, task).map(([key,value]) => <div key={key}><dt>{humanizeFeature(key)}</dt><dd>{fmt(value)}</dd></div>)}</dl></details>}</article>; })}</div>
    <ChartContainer title="近期表現趨勢" count={selectedSeries.filter((row) => isResearchNumber(row[trendMetric])).length} unit={RESEARCH_METRICS[trendMetric].unit} source={selectedTask === "ALL" ? "待選任務" : researchTaskLabel(selectedTask)}>
      <div className="studio-actions"><label>趨勢指標<select value={trendMetric} onChange={(event) => setTrendMetric(event.target.value)}>{Object.entries(RESEARCH_METRICS).map(([key,value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><button type="button" onClick={() => openTool("longitudinal", "/longitudinal-dashboard")}>開啟縱向追蹤</button></div>
      {selectedParticipant === "ALL" || selectedTask === "ALL" ? <EmptyState title="選擇單一參與者與任務" description="個人趨勢依同任務、類型與難度比較；不將不同對象混成一條曲線。"/> : <ResearchTrendChart data={selectedSeries} metric={trendMetric}/>}
    </ChartContainer>
    {selectedParticipant !== "ALL" && selectedTask !== "ALL" && <ResearchHandoff context={taskContext} taskLabel={researchTaskLabel(selectedTask)}/>}
    <section className="studio-card"><SectionHeader title="最近研究紀錄" description="來自既有評測、訓練、結果與推薦事件。"/><ResearchTimeline events={recentEvents} inputs={scopedInputs}/></section>
    {latestTaskInput && <details className="studio-advanced"><summary>最新場次題次詳情 · {researchTaskLabel(selectedTask)}</summary><section className="studio-card"><TrialDetails input={latestTaskInput}/></section></details>}
    <details className="studio-advanced"><summary>進階分析、模型與版本資訊</summary>
    <Section index={0} title="總覽"><div className="rpd-metrics"><Metric label="最新測驗" value={date(latestSession?.session_started_at)} />
        <Metric label="任務平均正確率（未加權）" value={researchPercent(mean(latestSession?.rows.map((row) => row.accuracy) || []))} /><Metric label="平均反應時間（RT）" value={`${fmt(mean(latestSession?.rows.map((row) => row.rt_mean) || []), 1)} ms`} />
        <Metric label="反應時間變異" value={`${fmt(mean(latestSession?.rows.map((row) => row.rt_variability_ms) || []), 1)} ms`} /><Metric label="已完成任務" value={latestSession?.rows.filter((row) => row.session_completion_status === "completed").length || 0} />
        <Metric label="歷史場次" value={new Set(scopedRows.map((row) => row.session_id)).size} /></div></Section>
<Section index={1} title="任務表現"><div className="rpd-task-grid">{(selectedTask === "ALL" ? TASKS : [selectedTask]).map((task) => { const rows = orderResearchRows(scopedRows.filter((row) => row.task_code === task)); const latest = rows.at(-1); const specifics = numericSpecifics(latest, task).slice(0, 4);
        return <article key={task}><h3>{task} · {TASK_NAMES[task]}</h3><p>{selectedParticipant === "ALL" && latest ? `最近對象：${latest.participant_id} · ` : ""}場次：{rows.length} · 最近 {date(latest?.session_started_at)}</p><b>正確率 {researchPercent(latest?.accuracy)}</b><b>平均反應時間（RT）{fmt(latest?.rt_mean, 1)} ms</b>{specifics.map(([key, value]) => <small key={key}>{key}: {fmt(value)}</small>)}</article>; })}</div></Section>
<Section index={2} title="行為分析">{selectedTask === "ALL" || selectedParticipant === "ALL" ? <p className="research-caption">請選擇單一參與者與任務，查看場次分布、題次趨勢與錯誤模式。</p> : <div className="rpd-grid"><Chart title={`${selectedTask} 最新場次反應時間分布（ms）`} data={rtHistogram} dataKey="count" xLabel="反應時間 RT（ms）" source="最新任務場次" /><Chart title={`${selectedTask} 同條件歷史正確率分布（%）`} data={accuracyHistogram} dataKey="count" xLabel="正確率（%）" source="同條件歷史場次" />
        <article className="rpd-panel"><h3>最新場次題次趨勢・{selectedTask}</h3><TaskSelect value={selectedTask} onChange={setSelectedTask}/><p className="research-caption">來源：最新任務場次，共 {selectedTrials.length} 題次；X 軸為題次，Y 軸為 RT（ms）。排除題次保留缺口。</p><ResponsiveContainer width="100%" height={240}><LineChart data={selectedTrials}><CartesianGrid vertical={false} stroke="var(--research-border)"/><XAxis dataKey="trial_index" tick={{ fill: "var(--research-muted)" }}/><YAxis domain={[0, "auto"]} unit=" ms" width={85} tick={{ fill: "var(--research-muted)" }}/><Tooltip contentStyle={{ background: "var(--research-card)", color: "var(--research-ink)" }}/><Legend/><Line type="linear" name="反應時間（ms）" dataKey="reaction_time_ms" stroke="var(--research-chart-observed)" connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></article>
        <article className="rpd-panel"><h3>最新場次穩定度／前後段比較</h3>{taskContext.latest && <dl><Pair name="反應時間變異（ms）" value={fmt(taskContext.latest.rt_variability_ms)} /><Pair name="題次間反應時間變化（ms）" value={fmt(taskContext.latest.mean_absolute_trial_to_trial_rt_change_ms)} /><Pair name="前段正確率" value={researchPercent(taskContext.latest.early_accuracy)} /><Pair name="後段正確率" value={researchPercent(taskContext.latest.late_accuracy)} /><Pair name="正確率變化（百分點）" value={isResearchNumber(taskContext.latest.accuracy_change) ? fmt(taskContext.latest.accuracy_change * 100, 1) : "—"} /></dl>}</article>
        <article className="rpd-panel"><h3>錯誤模式</h3>{errors.length ? errors.map(([name, count]) => <p key={name}>{name}: <strong>{count}</strong></p>) : <p>尚無已紀錄的錯誤類別。</p>}</article></div>}</Section>
<Section index={3} title="統計分析"><div className="rpd-links"><button onClick={() => openTool("statistics", "/research-statistics")}>開啟完整統計分析</button></div>
        <div className="rpd-metrics"><Metric label="描述性統計列數" value={statistics.taskStatistics.length}/><Metric label="特徵相關數" value={statistics.featureCorrelations.length}/><Metric label="任務比較數" value={TASKS.filter((task) => scopedRows.some((row) => row.task_code === task)).length}/><Metric label="縱向比較數" value={statistics.longitudinalChanges.length}/></div>
        <SimpleTable headers={["任務","特徵","樣本數","平均數","中位數","標準差"]} rows={statistics.taskStatistics.slice(0, 18).map((row) => { const definition = RESEARCH_METRICS[row.feature]; return [row.task_code, definition ? `${definition.label}（${definition.unit}）` : row.feature, row.n, definition ? definition.format(row.mean) : fmt(row.mean), definition ? definition.format(row.median) : fmt(row.median), definition?.unit === "%" ? `${isResearchNumber(row.sd) ? fmt(row.sd * 100, 1) : "—"} 百分點` : fmt(row.sd)]; })}/></Section>
<Section index={4} title="AI 預測"><p>以前 30% 題次預測同一任務後 70% 題次正確率；不代表未來 24 小時臨床風險。</p>{modelState.unavailable ? <Unavailable text={modelState.unavailable}/> : <><div className="rpd-metrics"><Metric label="模型" value={explanation.model_name}/><Metric label="目標" value={explanation.target_definition}/><Metric label="預測正確率" value={researchPercent(individual?.prediction)}/><Metric label="研究分類機率" value={individual?.probability == null ? "不適用／不在獨立測試集" : researchPercent(individual.probability)}/></div>
        <p>獨立測試集指標：MAE {fmt(explanation.model_performance.mae)} ・ RMSE {fmt(explanation.model_performance.rmse)} ・ R² {fmt(explanation.model_performance.r2)}</p></>}</Section>
<Section index={5} title="可解釋 AI">{!explanation ? <Unavailable text="尚無符合條件的觀察模型可供解釋。"/> : <div className="rpd-grid"><article className="rpd-panel"><h3>整體特徵重要性</h3>{explanation.global_importance.slice(0, 8).map((item) => <p key={item.feature}>{humanizeFeature(item.feature)} <strong>{fmt(item.normalized_importance * 100, 1)}%</strong></p>)}</article>
        <article className="rpd-panel"><h3>個別預測解釋</h3>{individual ? <><p>{individual.narrative}</p><SimpleTable headers={["特徵","數值","貢獻度"]} rows={individual.contributors.slice(0, 8).map((item) => [humanizeFeature(item.feature),fmt(item.feature_value),fmt(item.contribution)])}/></> : <p>選取的參與者不在獨立測試子集中，因此不顯示個別解釋。</p>}</article></div>}</Section>
<Section index={6} title="自適應訓練"><div className="rpd-links"><button onClick={() => openTool("adaptive", "/adaptive-recommendation-research")}>開啟策略研究</button></div>{latestRecommendation ? <><div className="rpd-metrics"><Metric label="建議任務" value={latestRecommendation.selected_action?.task_code}/><Metric label="難度" value={latestRecommendation.selected_action?.difficulty_level}/><Metric label="策略" value={latestRecommendation.policy_name}/><Metric label="策略版本" value={latestRecommendation.policy_version}/><Metric label="回饋" value={fmt(latestRecommendation.actual_reward)}/></div>
        <p>原因／情境：{JSON.stringify(latestRecommendation.context)}</p><SimpleTable headers={["日期","策略","任務","難度","回饋"]} rows={scopedRecommendations.slice(0,10).map((row) => [date(row.recommendation_timestamp),row.policy_name,row.selected_action?.task_code,row.selected_action?.difficulty_level,fmt(row.actual_reward)])}/></> : <Unavailable text="此參與者尚無已紀錄的實際建議決策。"/>}</Section>
<Section index={7} title="縱向追蹤"><div className="rpd-links"><button onClick={() => openTool("longitudinal", "/longitudinal-dashboard")}>開啟完整縱向追蹤儀表板</button><TaskSelect value={selectedTask} onChange={setSelectedTask}/></div>
        <div className="rpd-grid"><article className="rpd-panel"><h3>測驗／訓練時間軸</h3>{longitudinal?.timeline.filter((event) => ["Assessment","Training"].includes(event.event_type)).slice(-15).map((event) => <p key={event.event_id}>{date(event.occurred_at)} ・ {event.event_type}</p>)}</article>
          <article className="rpd-panel">{selectedTask === "ALL" || selectedParticipant === "ALL" ? <p className="research-caption">請選擇單一參與者與任務，查看個人趨勢。</p> : <><ResearchTrendChart title="正確率趨勢" data={selectedSeries} metric="accuracy"/><ResearchTrendChart title="平均反應時間（RT）趨勢" data={selectedSeries} metric="rt_mean"/></>}</article></div></Section>
<Section index={9} title="模型與實驗資訊"><div className="rpd-metrics"><Metric label="資料集版本" value={experiments[0]?.dataset_version || explanation?.data_version || "—"}/><Metric label="特徵版本" value={experiments[0]?.feature_version || explanation?.feature_version || "features_v1"}/><Metric label="模型版本" value={experiments[0]?.ml_pipeline_version || explanation?.model_version || "—"}/><Metric label="策略版本" value={latestRecommendation?.policy_version || "—"}/><Metric label="實驗代碼" value={experiments[0]?.id || "尚未儲存"}/><Metric label="訓練日期" value={date(experiments[0]?.training_timestamp)}/><Metric label="驗證方法" value={experiments[0]?.split_method || explanation?.validation_method || "—"}/></div>
        <p>模型輸出屬於行為表現研究原型，尚未完成臨床效度評估。</p></Section>
    </details>
    <Section index={8} title="研究資料"><p>匯出檔僅包含匿名參與者代碼。原始題次 CSV 保留第一階段不可變更的採集資料，清理與衍生檔案會分開儲存。資料版本：{exportBundle.manifest.dataset_version} ・ {exportBundle.manifest.trial_count} 筆原始題次 ・ {exportBundle.manifest.excluded_trial_count} 筆排除題次。</p><div className="rpd-downloads">{Object.entries(exportBundle.files).map(([name, contents]) => <button key={name} disabled={!contents} onClick={() => downloadResearchFile(name, contents)}>{name}</button>)}</div></Section>
    <ResearchNotice>研究資料僅用於行為模式與研究解讀。描述性變化、模型預測與模擬回饋不等於診斷或訓練因果效果。</ResearchNotice>
  </ResearchPage>;
}

function Section({ index, title, children }) { return <section id={id(index)} className="rpd-section" tabIndex={-1}><h2>{String(index + 1).padStart(2,"0")} {title}</h2>{children}</section>; }
function Metric({ label, value }) { return <article><span>{label}</span><strong>{value ?? "—"}</strong></article>; }
function Pair({ name, value }) { return <div><dt>{name}</dt><dd>{value}</dd></div>; }
function TaskSelect({ value, onChange }) { const workspace = useResearchWorkspace(); return <select hidden={Boolean(workspace)} className="research-local-selector" aria-label="選擇研究任務" value={value} onChange={(event) => onChange(event.target.value)}>{TASKS.map((task) => <option key={task} value={task}>{task} · {TASK_NAMES[task]}</option>)}</select>; }
function Chart({ title, data, dataKey, xLabel, source }) { return <article className="rpd-panel"><h3>{title}</h3><p className="research-caption">來源：{source}，共 {data.reduce((count, row) => count + (row[dataKey] || 0), 0)} 筆觀察。X 軸：{xLabel}區間；Y 軸：筆數。</p>{!data.length && <Unavailable text="目前沒有可繪製的數值觀察。"/>}<ResponsiveContainer width="100%" height={240}><BarChart data={data}><CartesianGrid vertical={false} stroke="var(--research-border)"/><XAxis dataKey="bin" tick={{ fill: "var(--research-muted)" }}/><YAxis allowDecimals={false} tick={{ fill: "var(--research-muted)" }}/><Tooltip contentStyle={{ background: "var(--research-card)", color: "var(--research-ink)" }}/><Legend/><Bar dataKey={dataKey} name="筆數" fill="var(--research-chart-observed)" isAnimationActive={false}/></BarChart></ResponsiveContainer></article>; }
function SimpleTable({ headers, rows }) { return <div className="rpd-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row,index) => <tr key={index}>{row.map((cell,i) => <td key={i}>{cell ?? "—"}</td>)}</tr>)}</tbody></table></div>; }
function Unavailable({ text }) { return <p className="rpd-unavailable">{text}</p>; }
function latestAssessment(rows) { const assessments = rows.filter((row) => row.assessment_or_training === "assessment"); if (!assessments.length) return null;
  const latestId = [...assessments].sort((a,b) => new Date(b.session_started_at) - new Date(a.session_started_at))[0].session_id; return { session_id: latestId,
    session_started_at: assessments.find((row) => row.session_id === latestId)?.session_started_at, rows: assessments.filter((row) => row.session_id === latestId) }; }
function histogram(values, bins = 10) { const nums = values.filter(isResearchNumber).map(Number); if (!nums.length) return [];
  const min = Math.min(...nums); const max = Math.max(...nums); const width = (max - min || 1) / bins; return Array.from({length:bins},(_,index) => { const lower=min+index*width; const upper=index===bins-1?max:min+(index+1)*width;
    return { bin: `${fmt(lower,2)}–${fmt(upper,2)}`, count: nums.filter((value) => value>=lower && (index===bins-1?value<=upper:value<upper)).length }; }); }
function errorCounts(trials) { const counts = trials.reduce((map, trial) => { const key = trial.error_type || (trial.is_correct === false ? "incorrect_unspecified" : null); if (key) map[key]=(map[key]||0)+1; return map; },{}); return Object.entries(counts).sort((a,b) => b[1]-a[1]); }
function numericSpecifics(row, task) { if (!row) return []; const prefix=({CBT:"cbt_",PM:"pm_",SRT:"srt_",ARI:"ari_",LB:"lb_",DCCS:"dccs_"})[task];
  return Object.entries(row).filter(([key,value]) => key.startsWith(prefix) && isResearchNumber(value)); }
