import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildTaskFeatureRow } from "../analytics/features";
import { analyzeBehavioralStatistics, downloadCsvExports } from "../analytics/statistics";
import { getMyProfile, getResearchFeatureInputsFromCloud } from "../lib/database";
import "../styles/ResearchStatistics.css";
import "../styles/ResearchDashboardTheme.css";

const PRIMARY_FEATURES = ["accuracy", "rt_mean", "rt_variability_ms", "error_rate"];
const LABELS = { accuracy: "正確率", rt_mean: "平均反應時間", rt_variability_ms: "反應時間變異", error_rate: "錯誤率" };
const format = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

export default function ResearchStatistics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskRows, setTaskRows] = useState([]);
  const [selectedTask, setSelectedTask] = useState("ALL");
  const [selectedFeature, setSelectedFeature] = useState("accuracy");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const profile = await getMyProfile();
        if (!["clinician", "medical", "doctor"].includes(String(profile?.role || "").toLowerCase())) {
          navigate("/clinician-login", { replace: true });
          return;
        }
        const inputs = await getResearchFeatureInputsFromCloud();
        if (!active) return;
        setTaskRows(inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata })));
      } catch (loadError) {
        if (active) setError("資料尚未可用，請確認資料庫變更與帳號存取權限。");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  const filteredRows = useMemo(() => selectedTask === "ALL" ? taskRows : taskRows.filter((row) => row.task_code === selectedTask), [taskRows, selectedTask]);
  const analysis = useMemo(() => analyzeBehavioralStatistics(filteredRows), [filteredRows]);
  const taskCodes = useMemo(() => [...new Set(taskRows.map((row) => row.task_code))].sort(), [taskRows]);
  const selectedStatistic = analysis.taskStatistics.find((row) => row.feature === selectedFeature && (selectedTask === "ALL" || row.task_code === selectedTask));
  const primaryStatistics = analysis.taskStatistics.filter((row) => PRIMARY_FEATURES.includes(row.feature));
  const visibleCorrelations = analysis.featureCorrelations.filter((row) => row.left_feature !== row.right_feature).slice(0, 30);

  if (loading) return <main className="research-page-state"><section className="research-page-state-card"><h1>研究統計</h1><p>正在載入研究統計資料…</p></section></main>;

  return (
    <main className="research-statistics-page">
      <header className="research-statistics-header">
        <div><p className="research-eyebrow">研究原型・統計分析 v1</p><h1>研究統計</h1><p>檢視描述性模式、特徵關聯、任務差異與縱向變化。</p></div>
        <div className="research-header-actions"><button type="button" onClick={() => downloadCsvExports(analysis.exports)}>匯出 4 份 CSV 檔</button><button type="button" onClick={() => navigate("/clinician-dashboard")}>回主頁</button></div>
      </header>
      <aside className="research-ethics-notice">本系統目前僅供研究與教育用途，分析結果不能取代標準化心理衡鑑或臨床診斷。結果僅描述關聯、差異或模式；觀察性資料不能建立因果關係。</aside>
      {error && <section className="research-error"><strong>資料尚未可用：</strong>{error}<br />請確認 Phase 1 migration 已套用且目前帳號具有已指派 participant 的 RLS 權限。</section>}
      <section className="research-filter-bar">
        <label>任務<select value={selectedTask} onChange={(event) => setSelectedTask(event.target.value)}><option value="ALL">全部任務</option>{taskCodes.map((task) => <option key={task}>{task}</option>)}</select></label>
        <label>分布特徵<select value={selectedFeature} onChange={(event) => setSelectedFeature(event.target.value)}>{PRIMARY_FEATURES.map((feature) => <option key={feature} value={feature}>{LABELS[feature]}</option>)}</select></label>
        <span>{filteredRows.length} 筆任務場次特徵資料</span>
      </section>
      <section className="research-panel"><h2>描述性統計</h2><div className="research-table-wrap"><table><thead><tr><th>任務</th><th>特徵</th><th>樣本數</th><th>平均數</th><th>中位數</th><th>標準差</th><th>四分位距</th><th>最小值</th><th>最大值</th><th>缺失數</th></tr></thead><tbody>{primaryStatistics.map((row) => <tr key={`${row.task_code}-${row.feature}`}><td>{row.task_code}</td><td>{LABELS[row.feature] || row.feature}</td><td>{row.n}</td><td>{format(row.mean)}</td><td>{format(row.median)}</td><td>{format(row.sd)}</td><td>{format(row.iqr)}</td><td>{format(row.min)}</td><td>{format(row.max)}</td><td>{row.missing_count}</td></tr>)}</tbody></table></div></section>
      <section className="research-grid-two">
        <article className="research-panel"><h2>資料分布</h2><p>{selectedStatistic?.distribution_summary || "尚無可用的分布資料。"}</p><div className="research-chart"><ResponsiveContainer width="100%" height={260}><BarChart data={selectedStatistic?.histogram || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="lower" tickFormatter={(value) => format(value, 2)} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#1f5f8b" /></BarChart></ResponsiveContainer></div></article>
        <article className="research-panel"><h2>箱型圖、缺失值與離群值</h2><BoxPlot summary={selectedStatistic?.box_plot} /><dl className="research-metric-list"><div><dt>缺失值</dt><dd>{selectedStatistic?.missing_count ?? "—"}</dd></div><div><dt>圖基離群值</dt><dd>{selectedStatistic?.outlier_count ?? "—"}</dd></div><div><dt>離群率</dt><dd>{format(selectedStatistic?.outlier_rate)}</dd></div></dl></article>
      </section>
      <section className="research-panel"><h2>特徵相關矩陣</h2><p>系統會為每組特徵選擇合適方法；當樣本或分布條件不支持皮爾森相關時，改用斯皮爾曼相關，並套用 Benjamini–Hochberg FDR 校正。</p><div className="research-table-wrap"><table><thead><tr><th>特徵 A</th><th>特徵 B</th><th>樣本數</th><th>方法</th><th>係數</th><th>原始 p 值</th><th>FDR p 值</th><th>原因</th></tr></thead><tbody>{visibleCorrelations.map((row) => <tr key={`${row.left_feature}-${row.right_feature}`}><td>{LABELS[row.left_feature] || row.left_feature}</td><td>{LABELS[row.right_feature] || row.right_feature}</td><td>{row.n}</td><td>{row.method}</td><td>{format(row.coefficient)}</td><td>{format(row.p_value)}</td><td>{format(row.p_value_adjusted)}</td><td>{row.method_reason}</td></tr>)}</tbody></table></div></section>
      <section className="research-panel"><h2>任務間相關</h2><p>僅當同一匿名參與者、同一場次同時包含兩個任務時才會配對，系統不會人工製造跨任務配對。</p><div className="research-table-wrap"><table><thead><tr><th>任務 A</th><th>任務 B</th><th>指標</th><th>樣本數</th><th>方法</th><th>係數</th><th>FDR p 值</th></tr></thead><tbody>{analysis.taskCorrelations.filter((row) => row.left_task !== row.right_task).map((row) => <tr key={`${row.metric}-${row.left_task}-${row.right_task}`}><td>{row.left_task}</td><td>{row.right_task}</td><td>{LABELS[row.metric] || row.metric}</td><td>{row.n}</td><td>{row.method}</td><td>{format(row.coefficient)}</td><td>{format(row.p_value_adjusted)}</td></tr>)}</tbody></table></div></section>
      <section className="research-grid-two">
        <article className="research-panel"><h2>任務比較</h2><div className="research-task-cards">{taskCodes.map((task) => { const row = primaryStatistics.find((item) => item.task_code === task && item.feature === "accuracy"); return <div key={task}><strong>{task}</strong><span>樣本數 {row?.n || 0}</span><b>平均正確率 {format(row?.mean)}</b></div>; })}</div><p>僅呈現描述性任務模式；各任務的規則與難度結構不同。</p></article>
        <article className="research-panel"><h2>縱向變化</h2><p>{analysis.repeatedMeasuresReadiness.reason}</p><div className="research-table-wrap"><table><thead><tr><th>任務</th><th>比較</th><th>樣本數</th><th>正確率變化</th><th>反應時間變化</th><th>反應時間變異變化</th></tr></thead><tbody>{analysis.longitudinalSummary.map((row) => <tr key={`${row.task_code}-${row.comparison}`}><td>{row.task_code}</td><td>{row.comparison}</td><td>{row.participant_count}</td><td>{format(row.mean_accuracy_change)}</td><td>{format(row.mean_rt_change_ms)}</td><td>{format(row.mean_rt_variability_change_ms)}</td></tr>)}</tbody></table></div></article>
      </section>
    </main>
  );
}

function BoxPlot({ summary }) {
  if (!summary || summary.min === null) return <p>尚無數值觀察資料。</p>;
  const range = summary.max - summary.min || 1;
  const position = (value) => `${((value - summary.min) / range) * 100}%`;
  return <div className="research-boxplot" aria-label="Box plot"><div className="research-boxplot-line" /><div className="research-boxplot-box" style={{ left: position(summary.q1), width: `${((summary.q3 - summary.q1) / range) * 100}%` }} /><i style={{ left: position(summary.median) }} /><span className="min">{format(summary.min, 2)}</span><span className="max">{format(summary.max, 2)}</span></div>;
}
