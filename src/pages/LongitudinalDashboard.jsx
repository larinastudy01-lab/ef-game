import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildTaskFeatureRow } from "../analytics/features";
import { analyzeParticipantLongitudinal } from "../analytics/longitudinal";
import { loadRecommendationHistory } from "../analytics/recommendation";
import { getMyProfile, getResearchFeatureInputsFromCloud } from "../lib/database";
import { supabase } from "../lib/supabaseClient";
import "../styles/LongitudinalDashboard.css";
import "../styles/ResearchDashboardTheme.css";

const TASKS = ["CBT", "PM", "SRT", "SSG", "LB", "DCCS"];
const TASK_LABELS = { CBT: "跳石橋", PM: "圖片記憶", SRT: "松鼠接橡實", SSG: "點探測任務", LB: "連線氣球", DCCS: "卡片分類" };
const format = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
const date = (value) => value ? new Date(value).toLocaleDateString() : "—";

export default function LongitudinalDashboard() {
  const navigate = useNavigate(); const [rows, setRows] = useState([]); const [recommendations, setRecommendations] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState(""); const [selectedTask, setSelectedTask] = useState("CBT");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [logNotice, setLogNotice] = useState("");
  useEffect(() => { let active = true; (async () => { try { const profile = await getMyProfile();
    if (!["clinician", "medical", "doctor"].includes(String(profile?.role || "").toLowerCase())) { navigate("/clinician-login", { replace: true }); return; }
    const inputs = await getResearchFeatureInputsFromCloud(); if (!active) return;
    const featureRows = inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata,
      difficulty: input.taskSession?.difficulty, started_at: input.taskSession?.started_at, completed_at: input.taskSession?.completed_at }));
    setRows(featureRows); setSelectedParticipant([...new Set(featureRows.map((row) => row.participant_id).filter(Boolean))][0] || "");
    try { setRecommendations(await loadRecommendationHistory(supabase)); } catch (reason) { if (active) setLogNotice("尚無法取得建議歷程，請確認資料庫變更與存取權限。"); }
  } catch (reason) { if (active) setError(reason?.message || "無法載入縱向追蹤資料。"); }
  finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, [navigate]);
  const participants = useMemo(() => [...new Set(rows.map((row) => row.participant_id).filter(Boolean))].sort(), [rows]);
  const analysis = useMemo(() => selectedParticipant ? analyzeParticipantLongitudinal(selectedParticipant, rows, recommendations) : null,
    [selectedParticipant, rows, recommendations]);
  const series = analysis?.task_series?.[selectedTask] || [];
  const chartData = series.map((row, index) => ({ ...row, label: date(row.session_started_at), session_number: index + 1 }));
  const summary = analysis?.feature_summary.tasks.find((item) => item.task_code === selectedTask);
  if (loading) return <main className="research-page-state"><section className="research-page-state-card"><h1>縱向追蹤儀表板</h1><p>正在載入縱向追蹤資料…</p></section></main>;
  if (error) return <main className="research-page-state"><section className="research-page-state-card"><h1>縱向追蹤儀表板</h1><p>資料尚未可用，請確認資料庫變更與帳號存取權限已完成設定。</p><button onClick={() => navigate("/clinician-dashboard")}>回主頁</button></section></main>;
  return <main className="long-page"><header className="long-header"><div><p>研究原型・縱向追蹤 v1</p><h1>縱向追蹤儀表板</h1>
    <span>追蹤同一參與者在測驗、訓練與建議過程中的行為變化。</span></div><button onClick={() => navigate("/clinician-dashboard")}>回主頁</button></header>
    <section className="long-warning"><strong>僅與個人基準比較。</strong><span>{analysis?.comparison_reference || "尚未選擇參與者。"}</span></section>
    <section className="long-controls"><label>匿名參與者<select value={selectedParticipant} onChange={(event) => setSelectedParticipant(event.target.value)}>
      {participants.map((participant) => <option key={participant}>{participant}</option>)}</select></label><label>任務<select value={selectedTask} onChange={(event) => setSelectedTask(event.target.value)}>
        {TASKS.map((task) => <option key={task} value={task}>{TASK_LABELS[task]}</option>)}</select></label></section>
    {!analysis ? <section className="long-card"><p>尚無可用的標準化參與者場次資料。</p></section> : <>
      <section className="long-meta"><article><span>場次總數</span><strong>{analysis.feature_summary.session_count}</strong></article>
        <article><span>測驗場次</span><strong>{analysis.feature_summary.assessment_session_count}</strong></article><article><span>訓練場次</span><strong>{analysis.feature_summary.training_session_count}</strong></article>
        <article><span>混合效應模型準備度</span><strong>{analysis.mixed_effects_readiness.ready ? "架構已就緒，尚未擬合" : "資料不足"}</strong></article></section>
      <section className="long-card"><h2>整體時間軸</h2><div className="long-timeline">{analysis.timeline.map((event) => <article key={event.event_id}><time>{date(event.occurred_at)}</time>
        <strong>{event.event_type}</strong><span>{event.summary}</span></article>)}</div></section>
      <section className="long-grid"><TrendCard title="正確率趨勢" data={chartData} metric="accuracy" rolling="accuracy_rolling_mean" />
        <TrendCard title="平均反應時間趨勢" data={chartData} metric="rt_mean" rolling="rt_mean_rolling_mean" />
        <TrendCard title="反應時間變異趨勢" data={chartData} metric="rt_variability_ms" rolling="rt_variability_ms_rolling_mean" />
        <section className="long-card"><h2>{TASK_LABELS[selectedTask]}任務趨勢摘要</h2><p>{summary?.session_count || 0} 個任務場次・{summary?.training_count || 0} 個訓練場次</p>
          <p>每 30 天訓練頻率：{format(summary?.training_frequency_per_30_days)}</p><table><thead><tr><th>指標</th><th>基準</th><th>最新</th><th>絕對變化</th><th>相對變化</th><th>每場次斜率</th></tr></thead><tbody>
            {(summary?.metrics || []).map((metric) => <tr key={metric.metric}><td>{metric.metric}</td><td>{format(metric.baseline_value)}</td><td>{format(metric.latest_value)}</td><td>{format(metric.absolute_change)}</td>
              <td>{metric.relative_change === null ? "—" : `${format(metric.relative_change * 100, 1)}%`}</td><td title={metric.reliability_reason || ""}>{format(metric.trend_slope_per_session)}</td></tr>)}</tbody></table></section></section>
      <section className="long-grid"><section className="long-card"><h2>訓練歷程</h2><EventTable events={analysis.timeline.filter((event) => event.event_type === "Training" || (event.event_type === "Task" && series.some((row) => row.session_id === event.session_id && row.assessment_or_training === "training")))} /></section>
        <section className="long-card"><h2>建議歷程</h2>{logNotice && <p className="long-notice">{logNotice}</p>}<EventTable events={analysis.timeline.filter((event) => event.event_type === "Recommendation")} /></section></section>
      <section className="long-card"><h2>統計建模準備度</h2><p>{analysis.mixed_effects_readiness.reason}</p><code>{analysis.mixed_effects_readiness.planned_structure}</code>
        <p><strong>目前尚未擬合混合效應模型，也未報告推論統計結果。</strong></p></section>
      <section className="long-limit">{analysis.interpretation_guardrail}</section></>}
  </main>;
}

function TrendCard({ title, data, metric, rolling }) { return <section className="long-card"><h2>{title}</h2>{data.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={data}>
  <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="session_number"/><YAxis/><Tooltip labelFormatter={(value) => `第 ${value} 場`}/><Legend/>
  <Line type="monotone" dataKey={metric} name="觀察值" stroke="#315f75" connectNulls={false}/><Line type="monotone" dataKey={rolling} name="移動平均（3 個可靠場次）" stroke="#b25e34" connectNulls={false}/></LineChart></ResponsiveContainer> : <p>尚無可用的任務場次。</p>}</section>; }
function EventTable({ events }) { return events.length ? <table><thead><tr><th>日期</th><th>類型</th><th>任務</th><th>詳細資訊</th></tr></thead><tbody>{events.map((event) => <tr key={event.event_id}><td>{date(event.occurred_at)}</td><td>{event.event_type}</td><td>{event.task_code || "—"}</td><td>{event.summary}</td></tr>)}</tbody></table> : <p>尚無紀錄事件。</p>; }
