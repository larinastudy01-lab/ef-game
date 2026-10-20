import { ChartContainer, MetricCard, PageHeader, ResearchDataTable, ResearchNotice } from "../components/research/ResearchStudioUI";
import { useResearchData, useResearchSelection, useResearchWorkspace } from "../components/research/ResearchWorkspaceContext";
import { matchesResearchScope, researchTaskLabel } from "../config/researchTasks";
import { buildResearchQualityAlerts, RESEARCH_METRICS, researchNumber, researchPercent } from "../utils/researchPresentation";
import { ResearchAlerts, ResearchPage } from "../components/research/ResearchPresentation";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildTaskFeatureRow } from "../analytics/features";
import { analyzeBehavioralStatistics, downloadCsvExports } from "../analytics/statistics";
import "../styles/ResearchStatistics.css";
import "../styles/ResearchDashboardTheme.css";

const PRIMARY_FEATURES = ["accuracy", "rt_mean", "rt_variability_ms", "error_rate"];
const LABELS = { accuracy: "正確率（%）", rt_mean: "平均反應時間 RT（ms）", rt_variability_ms: "反應時間變異（ms）", error_rate: "錯誤率（%）" };
const format = researchNumber;
const metricValue = (feature, value) => RESEARCH_METRICS[feature]?.format(value) ?? format(value);
const metricSpread = (feature, value) => ["accuracy", "error_rate"].includes(feature)
  ? `${value == null ? "—" : format(value * 100, 1)} 百分點` : metricValue(feature, value);

export default function ResearchStatistics() {
  const workspace = useResearchWorkspace();
  const { inputs, loading, error } = useResearchData();
  const taskRows = useMemo(() => inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata })), [inputs]);
  const participants = useMemo(() => [...new Set(inputs.map((input) => input.participantId).filter(Boolean))], [inputs]);
  const { selectedParticipant, selectedTask, setSelectedTask } = useResearchSelection(participants);
  const [selectedFeature, setSelectedFeature] = useState("accuracy");

  const filteredRows = useMemo(() => taskRows.filter((row) => matchesResearchScope(row.participant_id, row.task_code, { selectedParticipant, selectedTask })), [taskRows, selectedParticipant, selectedTask]);
  const analysis = useMemo(() => analyzeBehavioralStatistics(filteredRows), [filteredRows]);
  const taskCodes = useMemo(() => [...new Set(taskRows.map((row) => row.task_code))].sort(), [taskRows]);
  const selectedStatistics = analysis.taskStatistics.filter((row) => row.feature === selectedFeature && (selectedTask === "ALL" || row.task_code === selectedTask));
  const primaryStatistics = analysis.taskStatistics.filter((row) => PRIMARY_FEATURES.includes(row.feature));
  const visibleCorrelations = analysis.featureCorrelations.filter((row) => row.left_feature !== row.right_feature);

  if (loading) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>研究統計</h1><p>正在載入研究統計資料…</p></section></ResearchPage>;

  return (
    <ResearchPage className="research-statistics-page">
      <PageHeader eyebrow="DESCRIPTIVE & INFERENTIAL" title="研究統計" description="先看視覺摘要與分布，再追溯完整統計資料。" actions={<button type="button" onClick={() => downloadCsvExports(analysis.exports)}>匯出 4 份 CSV 檔</button>}/>
      {error && <section className="research-error"><strong>資料尚未可用：</strong>{error}</section>}
      <section className="research-filter-bar">
        <label className="research-local-selector" hidden={Boolean(workspace)}>任務<select value={selectedTask} onChange={(event) => setSelectedTask(event.target.value)}><option value="ALL">全部任務</option>{taskCodes.map((task) => <option key={task} value={task}>{researchTaskLabel(task)}</option>)}</select></label>
        <label>分布特徵<select value={selectedFeature} onChange={(event) => setSelectedFeature(event.target.value)}>{PRIMARY_FEATURES.map((feature) => <option key={feature} value={feature}>{LABELS[feature]}</option>)}</select></label>
        <span>{filteredRows.length} 筆任務場次特徵資料</span>
      </section>
      <div className="studio-kpi-grid"><MetricCard label="有效樣本數 · 任務場次觀察" value={selectedStatistics.reduce((sum,row) => sum + row.n, 0)} detail={String(new Set(filteredRows.map((row) => row.participant_id)).size) + " 位參與者；不同任務分列"}/><MetricCard label="所選特徵缺失數" value={selectedStatistics.reduce((sum,row) => sum + row.missing_count, 0)} tone="amber"/><MetricCard label="平均數" value={selectedStatistics.length === 1 ? metricValue(selectedFeature,selectedStatistics[0].mean) : "依任務分列"} detail={LABELS[selectedFeature]}/><MetricCard label="標準差" value={selectedStatistics.length === 1 ? metricSpread(selectedFeature,selectedStatistics[0].sd) : "依任務分列"} detail="不對不同任務均值再取平均" tone="purple"/></div>
      <details className="studio-quality-strip"><summary>資料品質與缺失說明</summary><ResearchAlerts alerts={buildResearchQualityAlerts(filteredRows)}/></details>
      {new Set(filteredRows.map((row) => row.assessment_or_training)).size > 1 && <ResearchNotice tone="warning">目前範圍包含正式評測與訓練。彙整數值沿用既有統計條件；兩者不代表相同測量條件，不能直接推論訓練成效。</ResearchNotice>}
      <ChartContainer title="任務平均值比較" count={selectedStatistics.reduce((sum,row) => sum + row.n, 0)} unit={RESEARCH_METRICS[selectedFeature].unit} source="既有描述性統計 · 依任務分組" empty={!selectedStatistics.some((row) => row.n > 0)}>
        <ResponsiveContainer width="100%" height={280}><BarChart data={selectedStatistics} margin={{top:16,right:24,bottom:24,left:8}}><CartesianGrid vertical={false} stroke="var(--research-border)"/><XAxis dataKey="task_code" label={{value:"任務",position:"insideBottom",offset:-12}} tick={{fill:"var(--research-muted)"}}/><YAxis domain={RESEARCH_METRICS[selectedFeature].unit === "%" ? [0,1] : [0,"auto"]} tickFormatter={(value) => metricValue(selectedFeature,value)} width={86} tick={{fill:"var(--research-muted)"}}/><Tooltip formatter={(value) => [metricValue(selectedFeature,value),"平均數"]} contentStyle={{background:"var(--research-card)",color:"var(--research-ink)"}}/><Legend/><Bar dataKey="mean" name={LABELS[selectedFeature]} fill="var(--research-chart-observed)" isAnimationActive={false}/></BarChart></ResponsiveContainer>
        <p className="research-caption">X 軸：任務；Y 軸：{LABELS[selectedFeature]}。不同任務的規則與難度不同，此圖只描述均值，不作能力排名。</p>
      </ChartContainer>
      <section className="research-grid-two">
        <article className="research-panel"><h2>資料分布 · {LABELS[selectedFeature]}</h2><p>依任務分開呈現；比率以百分比顯示，反應時間以毫秒顯示。</p>
          {!selectedStatistics.length && <p>尚無可用的分布資料。</p>}
          {selectedStatistics.map((statistic) => <div key={statistic.task_code}><h3>{statistic.task_code} · n = {statistic.n}</h3><p>{statistic.distribution_summary}</p><p className="research-caption">來源：目前範圍之 {statistic.task_code} 任務。X 軸：{LABELS[selectedFeature]}區間；Y 軸：場次數。</p>{statistic.n === 0 && <p>目前沒有可繪製的數值觀察。</p>}<div className="research-chart"><ResponsiveContainer width="100%" height={260}><BarChart data={statistic.histogram || []}><CartesianGrid vertical={false} stroke="var(--research-border)"/><XAxis dataKey="lower" tickFormatter={(value) => metricValue(selectedFeature, value)} tick={{ fill: "var(--research-muted)" }}/><YAxis allowDecimals={false} tick={{ fill: "var(--research-muted)" }}/><Tooltip contentStyle={{ background: "var(--research-card)", borderColor: "var(--research-border)", color: "var(--research-ink)" }} labelFormatter={(value, payload) => { const bin = payload?.[0]?.payload; return bin ? metricValue(selectedFeature, bin.lower) + "–" + metricValue(selectedFeature, bin.upper) : value; }}/><Legend/><Bar dataKey="count" name="場次數" fill="var(--research-chart-observed)" isAnimationActive={false}/></BarChart></ResponsiveContainer></div></div>)}
        </article>
        <article className="research-panel"><h2>箱型圖、缺失值與離群值</h2><p>圖基離群值為統計標記，不代表臨床異常。</p>{selectedStatistics.map((statistic) => <div key={statistic.task_code}><h3>{statistic.task_code} · {LABELS[selectedFeature]} · n = {statistic.n}</h3><BoxPlot summary={statistic.box_plot} feature={selectedFeature}/><dl className="research-metric-list"><div><dt>缺失值</dt><dd>{statistic.missing_count ?? "—"}</dd></div><div><dt>圖基離群值</dt><dd>{statistic.outlier_count ?? "—"}</dd></div><div><dt>離群率</dt><dd>{researchPercent(statistic.outlier_rate)}</dd></div></dl></div>)}</article>
      </section>
      <section className="studio-card"><h2>詳細描述性統計</h2><ResearchDataTable title="描述性統計" rows={primaryStatistics} getKey={(row) => row.task_code + "-" + row.feature} columns={[
        {key:"task_code",label:"任務",render:(row)=>researchTaskLabel(row.task_code),searchValue:(row)=>researchTaskLabel(row.task_code)},
        {key:"feature",label:"特徵",render:(row)=>LABELS[row.feature] || row.feature,searchValue:(row)=>LABELS[row.feature] || row.feature},
        {key:"n",label:"樣本數",numeric:true},
        ...[ ["mean","平均數"],["median","中位數"],["sd","標準差"],["iqr","四分位距"],["min","最小值"],["max","最大值"] ].map(([key,label])=>({key,label,numeric:true,render:(row)=>["sd","iqr"].includes(key)?metricSpread(row.feature,row[key]):metricValue(row.feature,row[key])})),
        {key:"missing_count",label:"缺失數",numeric:true},
      ]}/></section>
      <details className="studio-advanced"><summary>相關性、任務比較與縱向統計</summary>
      <section className="research-panel"><h2>特徵相關矩陣</h2><p>系統會為每組特徵選擇合適方法；當樣本或分布條件不支持皮爾森相關時，改用斯皮爾曼相關，並套用 Benjamini–Hochberg FDR 校正。</p><div className="research-table-wrap"><table><thead><tr><th>特徵 A</th><th>特徵 B</th><th>樣本數</th><th>方法</th><th>係數</th><th>原始 p 值</th><th>FDR p 值</th><th>原因</th></tr></thead><tbody>{visibleCorrelations.map((row) => <tr key={`${row.left_feature}-${row.right_feature}`}><td>{LABELS[row.left_feature] || row.left_feature}</td><td>{LABELS[row.right_feature] || row.right_feature}</td><td>{row.n}</td><td>{row.method}</td><td>{format(row.coefficient)}</td><td>{format(row.p_value)}</td><td>{format(row.p_value_adjusted)}</td><td>{row.method_reason}</td></tr>)}</tbody></table></div></section>
      <section className="research-panel"><h2>任務間相關</h2><p>僅當同一匿名參與者、同一場次同時包含兩個任務時才會配對，系統不會人工製造跨任務配對。</p><div className="research-table-wrap"><table><thead><tr><th>任務 A</th><th>任務 B</th><th>指標</th><th>樣本數</th><th>方法</th><th>係數</th><th>FDR p 值</th></tr></thead><tbody>{analysis.taskCorrelations.filter((row) => row.left_task !== row.right_task).map((row) => <tr key={`${row.metric}-${row.left_task}-${row.right_task}`}><td>{researchTaskLabel(row.left_task)}</td><td>{researchTaskLabel(row.right_task)}</td><td>{LABELS[row.metric] || row.metric}</td><td>{row.n}</td><td>{row.method}</td><td>{format(row.coefficient)}</td><td>{format(row.p_value_adjusted)}</td></tr>)}</tbody></table></div></section>
      <section className="research-grid-two">
        <article className="research-panel"><h2>任務比較</h2><div className="research-task-cards">{taskCodes.map((task) => { const row = primaryStatistics.find((item) => item.task_code === task && item.feature === "accuracy"); return <div key={task}><strong>{task}</strong><span>樣本數 {row?.n || 0}</span><b>平均正確率 {researchPercent(row?.mean)}</b></div>; })}</div><p>僅呈現描述性任務模式；各任務的規則與難度結構不同。</p></article>
        <article className="research-panel"><h2>縱向變化</h2><p>{analysis.repeatedMeasuresReadiness.reason}</p><div className="research-table-wrap"><table><thead><tr><th>任務</th><th>比較</th><th>樣本數</th><th>正確率變化（百分點）</th><th>反應時間變化（ms）</th><th>反應時間變異變化（ms）</th></tr></thead><tbody>{analysis.longitudinalSummary.map((row) => <tr key={`${row.task_code}-${row.comparison}`}><td>{researchTaskLabel(row.task_code)}</td><td>{row.comparison}</td><td>{row.participant_count}</td><td>{format(row.mean_accuracy_change == null ? null : row.mean_accuracy_change * 100, 1)}</td><td>{format(row.mean_rt_change_ms)}</td><td>{format(row.mean_rt_variability_change_ms)}</td></tr>)}</tbody></table></div></article>
      </section>
      </details>
      <ResearchNotice>觀察性資料描述關聯與差異，不能建立因果關係或取代臨床診斷。</ResearchNotice>
    </ResearchPage>
  );
}

function BoxPlot({ summary, feature }) {
  if (!summary || summary.min === null) return <p>尚無數值觀察資料。</p>;
  const range = summary.max - summary.min || 1;
  const position = (value) => `${((value - summary.min) / range) * 100}%`;
  return <><p className="research-caption">水平軸：{LABELS[feature]}；線段為最小至最大值，方框為 Q1–Q3，直線為中位數。</p><div className="research-boxplot" role="img" aria-label={`${LABELS[feature]}箱型圖`} title={`最小值 ${metricValue(feature, summary.min)}；Q1 ${metricValue(feature, summary.q1)}；中位數 ${metricValue(feature, summary.median)}；Q3 ${metricValue(feature, summary.q3)}；最大值 ${metricValue(feature, summary.max)}`}><div className="research-boxplot-line" /><div className="research-boxplot-box" style={{ left: position(summary.q1), width: `${((summary.q3 - summary.q1) / range) * 100}%` }} /><i style={{ left: position(summary.median) }} /><span className="min">{metricValue(feature, summary.min)}</span><span className="max">{metricValue(feature, summary.max)}</span></div><p className="research-caption">Q1：{metricValue(feature, summary.q1)}；中位數：{metricValue(feature, summary.median)}；Q3：{metricValue(feature, summary.q3)}。</p></>;
}
