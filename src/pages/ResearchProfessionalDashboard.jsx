import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analyzeModelExplainability, humanizeFeature } from "../analytics/explainability";
import { buildTaskFeatureRow } from "../analytics/features";
import { analyzeParticipantLongitudinal } from "../analytics/longitudinal";
import { buildFuturePerformanceDataset } from "../analytics/ml";
import { loadRecommendationHistory } from "../analytics/recommendation";
import { downloadResearchFile } from "../analytics/researchDashboard";
import { buildUnifiedResearchExport } from "../analytics/reproducibility";
import { analyzeBehavioralStatistics } from "../analytics/statistics";
import { getMyProfile, getResearchExperimentHistory, getResearchFeatureInputsFromCloud } from "../lib/database";
import { supabase } from "../lib/supabaseClient";
import "../styles/ResearchProfessionalDashboard.css";
import "../styles/ResearchDashboardTheme.css";

const SECTIONS = ["總覽", "任務表現", "行為分析", "統計分析", "AI 預測", "可解釋 AI", "自適應訓練", "縱向追蹤", "研究資料", "模型與實驗資訊"];
const TASKS = ["CBT", "PM", "SRT", "SSG", "LB", "DCCS"];
const TASK_NAMES = { CBT: "跳石橋", PM: "圖片記憶", SRT: "松鼠接橡實", SSG: "點探測任務", LB: "連線氣球", DCCS: "卡片分類" };
const mean = (values) => { const valid = values.filter((value) => Number.isFinite(Number(value))).map(Number); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; };
const fmt = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
const date = (value) => value ? new Date(value).toLocaleDateString() : "—";
const id = (index) => `research-${String(index + 1).padStart(2, "0")}`;

export default function ResearchProfessionalDashboard() {
  const navigate = useNavigate(); const [inputs, setInputs] = useState([]); const [recommendations, setRecommendations] = useState([]); const [experiments, setExperiments] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState(""); const [selectedTask, setSelectedTask] = useState("CBT"); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notices, setNotices] = useState([]);
  useEffect(() => { let active = true; (async () => { try { const profile = await getMyProfile();
    if (!["clinician", "medical", "doctor"].includes(String(profile?.role || "").toLowerCase())) { navigate("/clinician-login", { replace: true }); return; }
    const data = await getResearchFeatureInputsFromCloud(); if (!active) return; setInputs(data);
    setSelectedParticipant([...new Set(data.map((item) => item.participantId).filter(Boolean))][0] || "");
    const warnings = []; try { setRecommendations(await loadRecommendationHistory(supabase)); } catch (reason) { warnings.push("建議歷程尚未可用。"); }
    try { setExperiments(await getResearchExperimentHistory()); } catch (reason) { warnings.push("實驗歷程尚未可用。"); }
    if (active) setNotices(warnings);
  } catch (reason) { if (active) setError("資料尚未可用，請確認資料庫變更與帳號存取權限。"); } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, [navigate]);
  const taskRows = useMemo(() => inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata,
    difficulty: input.taskSession?.difficulty, started_at: input.taskSession?.started_at, completed_at: input.taskSession?.completed_at })), [inputs]);
  const participants = useMemo(() => [...new Set(taskRows.map((row) => row.participant_id).filter(Boolean))].sort(), [taskRows]);
  const scopedRows = useMemo(() => taskRows.filter((row) => row.participant_id === selectedParticipant), [taskRows, selectedParticipant]);
  const scopedInputs = useMemo(() => inputs.filter((item) => item.participantId === selectedParticipant), [inputs, selectedParticipant]);
  const scopedRecommendations = useMemo(() => recommendations.filter((row) => row.participant_id === selectedParticipant), [recommendations, selectedParticipant]);
  const statistics = useMemo(() => analyzeBehavioralStatistics(scopedRows), [scopedRows]);
  const longitudinal = useMemo(() => selectedParticipant ? analyzeParticipantLongitudinal(selectedParticipant, taskRows, recommendations) : null, [selectedParticipant, taskRows, recommendations]);
  const modelState = useMemo(() => { const rows = buildFuturePerformanceDataset(inputs, .3, "accuracy"); const count = new Set(rows.map((row) => row.participant_id)).size;
    if (count < 20) return { unavailable: `目前觀察資料共 ${count} 位參與者；至少需要 20 位，才會在此工作區擬合研究模型。` };
    try { return { result: analyzeModelExplainability(rows, { targetType: "regression", demoMode: false, folds: 5 }) }; } catch (reason) { return { unavailable: reason?.message }; } }, [inputs]);
  const explanation = modelState.result; const individual = explanation?.individual_explanations.find((item) => item.participant_id === selectedParticipant) || null;
  const latestSession = latestAssessment(scopedRows); const selectedSeries = longitudinal?.task_series?.[selectedTask] || [];
  const rawTrials = scopedInputs.flatMap((input) => input.trials.map((trial) => ({ ...trial, task_code: input.taskSession?.task_code })));
  const selectedTrials = rawTrials.filter((trial) => trial.task_code === selectedTask).sort((a, b) => Number(a.trial_index || 0) - Number(b.trial_index || 0));
  const rtHistogram = histogram(rawTrials.map((trial) => trial.reaction_time_ms)); const accuracyHistogram = histogram(scopedRows.map((row) => row.accuracy), 8);
  const errors = errorCounts(rawTrials); const latestRecommendation = [...scopedRecommendations].sort((a, b) => new Date(b.recommendation_timestamp) - new Date(a.recommendation_timestamp))[0];
  const exportBundle = useMemo(() => buildUnifiedResearchExport({ inputs: scopedInputs, taskRows: scopedRows, statistics, explainability: explanation,
    recommendations: scopedRecommendations, experiments }), [scopedInputs, scopedRows, statistics, explanation, scopedRecommendations, experiments]);
  if (loading) return <main className="research-page-state"><section className="research-page-state-card"><h1>研究工作區</h1><p>正在載入研究資料…</p></section></main>;
  if (error) return <main className="research-page-state"><section className="research-page-state-card"><h1>研究工作區</h1><p>{error}</p><button onClick={() => navigate("/clinician-dashboard")}>回主頁</button></section></main>;
  return <main className="rpd-shell"><aside><h1>研究工作區</h1><p>原始行為 → 特徵 → 趨勢 → 模型 → 解釋 → 建議</p>
    <label>匿名參與者<select value={selectedParticipant} onChange={(event) => setSelectedParticipant(event.target.value)}>{participants.map((participant) => <option key={participant}>{participant}</option>)}</select></label>
    <nav>{SECTIONS.map((name, index) => <a key={name} href={`#${id(index)}`}>{String(index + 1).padStart(2, "0")} {name}</a>)}</nav>
    <button onClick={() => navigate("/clinician-dashboard")}>回主頁</button></aside>
    <div className="rpd-content"><header><p>研究原型・專業工作區 v1</p><h1>研究與專業儀表板</h1>
      <strong>僅供行為模式與研究解讀，不用於診斷、常模狀態或疾病風險估計。</strong></header>
      {notices.map((notice) => <p className="rpd-notice" key={notice}>{notice}</p>)}
      <Section index={0} title="總覽"><div className="rpd-metrics"><Metric label="最新測驗" value={date(latestSession?.session_started_at)} />
        <Metric label="整體正確率" value={fmt(mean(latestSession?.rows.map((row) => row.accuracy) || []))} /><Metric label="平均反應時間" value={`${fmt(mean(latestSession?.rows.map((row) => row.rt_mean) || []), 1)} ms`} />
        <Metric label="反應時間變異" value={`${fmt(mean(latestSession?.rows.map((row) => row.rt_variability_ms) || []), 1)} ms`} /><Metric label="已完成任務" value={latestSession?.rows.filter((row) => row.session_completion_status === "completed").length || 0} />
        <Metric label="歷史場次" value={new Set(scopedRows.map((row) => row.session_id)).size} /></div></Section>
      <Section index={1} title="任務表現"><div className="rpd-task-grid">{TASKS.map((task) => { const rows = scopedRows.filter((row) => row.task_code === task); const latest = rows.at(-1); const specifics = numericSpecifics(latest, task).slice(0, 4);
        return <article key={task}><h3>{TASK_NAMES[task]}</h3><p>場次：{rows.length}</p><b>正確率 {fmt(latest?.accuracy)}</b><b>平均反應時間 {fmt(latest?.rt_mean, 1)} ms</b>{specifics.map(([key, value]) => <small key={key}>{key}: {fmt(value)}</small>)}</article>; })}</div></Section>
      <Section index={2} title="行為分析"><div className="rpd-grid"><Chart title="反應時間分布" data={rtHistogram} dataKey="count" /><Chart title="正確率分布" data={accuracyHistogram} dataKey="count" />
        <article className="rpd-panel"><h3>題次趨勢・{selectedTask}</h3><TaskSelect value={selectedTask} onChange={setSelectedTask}/><ResponsiveContainer width="100%" height={240}><LineChart data={selectedTrials}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="trial_index"/><YAxis/><Tooltip/><Line dataKey="reaction_time_ms" stroke="#315f75" connectNulls={false}/></LineChart></ResponsiveContainer></article>
        <article className="rpd-panel"><h3>表現穩定度／前後段比較</h3>{scopedRows.filter((row) => row.task_code === selectedTask).slice(-1).map((row) => <dl key={row.task_session_id}><Pair name="反應時間變異" value={fmt(row.rt_variability_ms)} /><Pair name="題次間反應時間變化" value={fmt(row.mean_absolute_trial_to_trial_rt_change_ms)} /><Pair name="前段正確率" value={fmt(row.early_accuracy)} /><Pair name="後段正確率" value={fmt(row.late_accuracy)} /><Pair name="正確率變化" value={fmt(row.accuracy_change)} /></dl>)}</article>
        <article className="rpd-panel"><h3>錯誤模式</h3>{errors.length ? errors.map(([name, count]) => <p key={name}>{name}: <strong>{count}</strong></p>) : <p>尚無已紀錄的錯誤類別。</p>}</article></div></Section>
      <Section index={3} title="統計分析"><div className="rpd-links"><button onClick={() => navigate("/research-statistics")}>開啟完整統計分析</button></div>
        <div className="rpd-metrics"><Metric label="描述性統計列數" value={statistics.taskStatistics.length}/><Metric label="特徵相關數" value={statistics.featureCorrelations.length}/><Metric label="任務比較數" value={TASKS.filter((task) => scopedRows.some((row) => row.task_code === task)).length}/><Metric label="縱向比較數" value={statistics.longitudinalChanges.length}/></div>
        <SimpleTable headers={["任務","特徵","樣本數","平均數","中位數","標準差"]} rows={statistics.taskStatistics.slice(0, 18).map((row) => [row.task_code,row.feature,row.n,fmt(row.mean),fmt(row.median),fmt(row.sd)])}/></Section>
      <Section index={4} title="AI 預測">{modelState.unavailable ? <Unavailable text={modelState.unavailable}/> : <><div className="rpd-metrics"><Metric label="模型" value={explanation.model_name}/><Metric label="目標" value={explanation.target_definition}/><Metric label="預測值" value={fmt(individual?.prediction)}/><Metric label="機率" value={individual?.probability == null ? "不適用／不在獨立測試集" : fmt(individual.probability)}/></div>
        <p>獨立測試集指標：MAE {fmt(explanation.model_performance.mae)} ・ RMSE {fmt(explanation.model_performance.rmse)} ・ R² {fmt(explanation.model_performance.r2)}</p></>}</Section>
      <Section index={5} title="可解釋 AI">{!explanation ? <Unavailable text="尚無符合條件的觀察模型可供解釋。"/> : <div className="rpd-grid"><article className="rpd-panel"><h3>整體特徵重要性</h3>{explanation.global_importance.slice(0, 8).map((item) => <p key={item.feature}>{humanizeFeature(item.feature)} <strong>{fmt(item.normalized_importance * 100, 1)}%</strong></p>)}</article>
        <article className="rpd-panel"><h3>個別預測解釋</h3>{individual ? <><p>{individual.narrative}</p><SimpleTable headers={["特徵","數值","貢獻度"]} rows={individual.contributors.slice(0, 8).map((item) => [humanizeFeature(item.feature),fmt(item.feature_value),fmt(item.contribution)])}/></> : <p>選取的參與者不在獨立測試子集中，因此不顯示個別解釋。</p>}</article></div>}</Section>
      <Section index={6} title="自適應訓練"><div className="rpd-links"><button onClick={() => navigate("/adaptive-recommendation-research")}>開啟策略研究</button></div>{latestRecommendation ? <><div className="rpd-metrics"><Metric label="建議任務" value={latestRecommendation.selected_action?.task_code}/><Metric label="難度" value={latestRecommendation.selected_action?.difficulty_level}/><Metric label="策略" value={latestRecommendation.policy_name}/><Metric label="策略版本" value={latestRecommendation.policy_version}/><Metric label="回饋" value={fmt(latestRecommendation.actual_reward)}/></div>
        <p>原因／情境：{JSON.stringify(latestRecommendation.context)}</p><SimpleTable headers={["日期","策略","任務","難度","回饋"]} rows={scopedRecommendations.slice(0,10).map((row) => [date(row.recommendation_timestamp),row.policy_name,row.selected_action?.task_code,row.selected_action?.difficulty_level,fmt(row.actual_reward)])}/></> : <Unavailable text="此參與者尚無已紀錄的實際建議決策。"/>}</Section>
      <Section index={7} title="縱向追蹤"><div className="rpd-links"><button onClick={() => navigate("/longitudinal-dashboard")}>開啟完整縱向追蹤儀表板</button><TaskSelect value={selectedTask} onChange={setSelectedTask}/></div>
        <div className="rpd-grid"><article className="rpd-panel"><h3>測驗／訓練時間軸</h3>{longitudinal?.timeline.filter((event) => ["Assessment","Training"].includes(event.event_type)).slice(-15).map((event) => <p key={event.event_id}>{date(event.occurred_at)} ・ {event.event_type}</p>)}</article>
          <article className="rpd-panel"><h3>正確率／反應時間任務趨勢</h3><ResponsiveContainer width="100%" height={260}><LineChart data={selectedSeries.map((row,index) => ({...row,index:index+1}))}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="index"/><YAxis/><Tooltip/><Line dataKey="accuracy" stroke="#315f75"/><Line dataKey="rt_mean" stroke="#b25e34"/></LineChart></ResponsiveContainer></article></div></Section>
      <Section index={8} title="研究資料"><p>匯出檔僅包含匿名參與者代碼。原始題次 CSV 保留第一階段不可變更的採集資料，清理與衍生檔案會分開儲存。資料版本：{exportBundle.manifest.dataset_version} ・ {exportBundle.manifest.trial_count} 筆原始題次 ・ {exportBundle.manifest.excluded_trial_count} 筆排除題次。</p><div className="rpd-downloads">{Object.entries(exportBundle.files).map(([name, contents]) => <button key={name} disabled={!contents} onClick={() => downloadResearchFile(name, contents)}>{name}</button>)}</div></Section>
      <Section index={9} title="模型與實驗資訊"><div className="rpd-metrics"><Metric label="資料集版本" value={experiments[0]?.dataset_version || explanation?.data_version || "—"}/><Metric label="特徵版本" value={experiments[0]?.feature_version || explanation?.feature_version || "features_v1"}/><Metric label="模型版本" value={experiments[0]?.ml_pipeline_version || explanation?.model_version || "—"}/><Metric label="策略版本" value={latestRecommendation?.policy_version || "—"}/><Metric label="實驗代碼" value={experiments[0]?.id || "尚未儲存"}/><Metric label="訓練日期" value={date(experiments[0]?.training_timestamp)}/><Metric label="驗證方法" value={experiments[0]?.split_method || explanation?.validation_method || "—"}/></div>
        <p>模型輸出屬於行為表現研究原型，尚未完成臨床效度評估。</p></Section>
    </div></main>;
}

function Section({ index, title, children }) { return <section id={id(index)} className="rpd-section"><h2>{String(index + 1).padStart(2,"0")} {title}</h2>{children}</section>; }
function Metric({ label, value }) { return <article><span>{label}</span><strong>{value ?? "—"}</strong></article>; }
function Pair({ name, value }) { return <div><dt>{name}</dt><dd>{value}</dd></div>; }
function TaskSelect({ value, onChange }) { return <select value={value} onChange={(event) => onChange(event.target.value)}>{TASKS.map((task) => <option key={task} value={task}>{TASK_NAMES[task]}</option>)}</select>; }
function Chart({ title, data, dataKey }) { return <article className="rpd-panel"><h3>{title}</h3><ResponsiveContainer width="100%" height={240}><BarChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="bin"/><YAxis/><Tooltip/><Bar dataKey={dataKey} fill="#477988"/></BarChart></ResponsiveContainer></article>; }
function SimpleTable({ headers, rows }) { return <div className="rpd-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row,index) => <tr key={index}>{row.map((cell,i) => <td key={i}>{cell ?? "—"}</td>)}</tr>)}</tbody></table></div>; }
function Unavailable({ text }) { return <p className="rpd-unavailable">{text}</p>; }
function latestAssessment(rows) { const assessments = rows.filter((row) => row.assessment_or_training === "assessment"); if (!assessments.length) return null;
  const latestId = [...assessments].sort((a,b) => new Date(b.session_started_at) - new Date(a.session_started_at))[0].session_id; return { session_id: latestId,
    session_started_at: assessments.find((row) => row.session_id === latestId)?.session_started_at, rows: assessments.filter((row) => row.session_id === latestId) }; }
function histogram(values, bins = 10) { const nums = values.filter((value) => Number.isFinite(Number(value))).map(Number); if (!nums.length) return [];
  const min = Math.min(...nums); const max = Math.max(...nums); const width = (max - min || 1) / bins; return Array.from({length:bins},(_,index) => { const lower=min+index*width; const upper=index===bins-1?max:min+(index+1)*width;
    return { bin: `${fmt(lower,2)}–${fmt(upper,2)}`, count: nums.filter((value) => value>=lower && (index===bins-1?value<=upper:value<upper)).length }; }); }
function errorCounts(trials) { const counts = trials.reduce((map, trial) => { const key = trial.error_type || (trial.is_correct === false ? "incorrect_unspecified" : null); if (key) map[key]=(map[key]||0)+1; return map; },{}); return Object.entries(counts).sort((a,b) => b[1]-a[1]); }
function numericSpecifics(row, task) { if (!row) return []; const prefix=({CBT:"cbt_",PM:"pm_",SRT:"srt_",SSG:"ssg_",LB:"lb_",DCCS:"dccs_"})[task];
  return Object.entries(row).filter(([key,value]) => key.startsWith(prefix) && Number.isFinite(Number(value))); }
