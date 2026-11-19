import { humanizeFeature } from "../utils/professionalLabels";
import { AvailableBehaviorAnalysis, ResearchFindings } from "../components/professional/ProfessionalResearch";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ModelStatusCard, PageHeader, ResearchNotice, useParticipantLabels } from "../components/research/ResearchStudioUI";
import { participantLabel } from "../utils/researchStudioPresentation";
import { useResearchData, useResearchSelection, useResearchWorkspace } from "../components/research/ResearchWorkspaceContext";
import { scopeResearchInputs } from "../config/researchTasks";
import { researchNumber, researchPercent } from "../utils/researchPresentation";
import { ResearchPage } from "../components/research/ResearchPresentation";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeModelExplainability } from "../analytics/explainability";
import { buildFuturePerformanceDataset, generateSyntheticDataset, toPerformanceCategory } from "../analytics/ml";
import "../styles/AIBehavioralAnalysis.css";
import "../styles/ResearchDashboardTheme.css";

const number = researchNumber;

export default function AIBehavioralAnalysis() {
  const navigate = useNavigate();
  const workspace = useResearchWorkspace();
  const participantLabels = useParticipantLabels();
  const { inputs: allInputs, loading, error } = useResearchData();
  const participants = useMemo(() => [...new Set(allInputs.map((input) => input.participantId).filter(Boolean))], [allInputs]);
  const { selectedParticipant, selectedTask } = useResearchSelection(participants);
  const inputs = useMemo(() => scopeResearchInputs(allInputs, { selectedTask }, { cohort: true }), [allInputs, selectedTask]);
  const [targetType, setTargetType] = useState("regression");
  const [selectedKey, setSelectedKey] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  const prepared = useMemo(() => {
    const observed = buildFuturePerformanceDataset(inputs, 0.3, "accuracy");
    const participantCount = new Set(observed.map((row) => row.participant_id)).size;
    const useDemo = demoMode;
    const base = useDemo ? generateSyntheticDataset({ participants: 40, targetType }) : observed;
    return { rows: targetType === "classification" && !useDemo ? toPerformanceCategory(base, 0.7) : base, useDemo, observedParticipantCount: participantCount };
  }, [inputs, targetType, demoMode]);

  const resultState = useMemo(() => { if (!prepared.useDemo && prepared.observedParticipantCount < 20) return { unavailable: `目前只有 ${prepared.observedParticipantCount} 位參與者具備預測目標資料，至少需要 20 位才會擬合觀察模型。` }; try { return { result: analyzeModelExplainability(prepared.rows,
    { targetType, demoMode: prepared.useDemo, includeComparison: true, folds: 5 }) }; }
  catch (reason) { return { error: reason?.message || "無法完成模型解釋分析。" }; } }, [prepared, targetType]);
  const result = resultState.result;
  const visibleExplanations = useMemo(() => (result?.individual_explanations || []).filter((item) => prepared.useDemo || selectedParticipant === "ALL" || item.participant_id === selectedParticipant), [result, selectedParticipant, prepared.useDemo]);
  const selected = useMemo(() => visibleExplanations.find((item,index) => `${item.participant_id}::${item.session_id}::${index}` === selectedKey) || visibleExplanations[0] || null, [visibleExplanations, selectedKey]);

  if (loading) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>AI 行為分析</h1><p>正在載入行為模型…</p></section></ResearchPage>;
  if (error) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>AI 行為分析</h1><p>資料尚未可用，請確認資料庫變更與帳號存取權限已完成設定。</p><button className="research-home-button" hidden={Boolean(workspace)} onClick={() => navigate("/clinician-dashboard")}>回主頁</button></section></ResearchPage>;
  return <ResearchPage className="xai-page">
    <PageHeader eyebrow="PREDICTION & EXPLAINABILITY" title="AI 行為分析" description="檢視建模條件、獨立測試表現及個別預測的特徵貢獻。"/>
    <section className="xai-controls" aria-label="分析資料模式"><div className="studio-actions"><button type="button" aria-pressed={!demoMode} onClick={() => { setDemoMode(false); setSelectedKey(""); }}>真實資料</button><button type="button" aria-pressed={demoMode} onClick={() => { setDemoMode(true); setSelectedKey(""); }}>模擬預覽</button></div><label>結果類型<select value={targetType} onChange={(event) => { setTargetType(event.target.value); setSelectedKey(""); }}><option value="regression">未來正確率（迴歸）</option><option value="classification">未來表現分類（研究門檻）</option></select></label></section>
    {demoMode && <ResearchNotice tone="warning"><strong>模擬資料，不代表真實幼兒分析結果。</strong>僅供分析流程預覽，不會儲存為正式個案或研究結果。</ResearchNotice>}
    <ModelStatusCard count={prepared.observedParticipantCount} result={result} error={resultState.error} demo={demoMode}/>
    {!demoMode && <><ResearchFindings inputs={allInputs.filter((input) => (selectedParticipant === "ALL" || input.participantId === selectedParticipant) && (selectedTask === "ALL" || (input.taskSession?.task_code || input.taskSession?.taskCode) === selectedTask))}/><AvailableBehaviorAnalysis inputs={allInputs.filter((input) => (selectedParticipant === "ALL" || input.participantId === selectedParticipant) && (selectedTask === "ALL" || (input.taskSession?.task_code || input.taskSession?.taskCode) === selectedTask))}/></>}
    {result && <>
    <section className="xai-meta">
      <article><span>模型版本</span><strong>{result.model_version}</strong></article><article><span>資料版本</span><strong>{result.data_version}</strong></article>
      <article><span>樣本數</span><strong>{result.sample_size} 筆／{result.participant_count} 位參與者</strong></article><article><span>驗證方法</span><strong>{result.validation_method}</strong></article>
    </section>
    <section className="xai-grid"><article className="xai-card"><h2>預測與模型表現</h2><dl>
      <div><dt>選用模型</dt><dd>{result.model_name}</dd></div><div><dt>預測目標</dt><dd>{result.target_definition}</dd></div>
      {targetType === "classification" ? <><div><dt>平衡正確率</dt><dd>{number(result.model_performance.balanced_accuracy)}</dd></div><div><dt>F1 分數</dt><dd>{number(result.model_performance.f1)}</dd></div><div><dt>ROC-AUC</dt><dd>{number(result.model_performance.roc_auc)}</dd></div></>
        : <><div><dt>MAE</dt><dd>{number(result.model_performance.mae)}</dd></div><div><dt>RMSE</dt><dd>{number(result.model_performance.rmse)}</dd></div><div><dt>R²</dt><dd>{number(result.model_performance.r2)}</dd></div></>}</dl></article>
      <article className="xai-card"><h2>重要性穩定度</h2><strong className={`xai-stability ${result.importance_stability.stability_label}`}>{result.importance_stability.stability_label === "stable" ? "穩定" : "尚未穩定"}</strong>
        <p>{result.importance_stability.disclosure}</p><p>主要特徵穩定率：{number(result.importance_stability.top_feature_stability_rate * 100, 1)}%</p></article></section>
    <ChartContainer title="特徵重要性" count={result.global_importance.slice(0,12).length} countLabel="項特徵" unit="相對重要性（%）" source={prepared.useDemo ? "模擬模型" : "獨立測試模型解釋"}>
      <ResponsiveContainer width="100%" height={320}><BarChart layout="vertical" data={result.global_importance.slice(0,12)} margin={{top:8,right:24,bottom:16,left:8}}><CartesianGrid horizontal={false} stroke="var(--research-border)"/><XAxis type="number" domain={[0,1]} tickFormatter={(value)=>researchPercent(value)} tick={{fill:"var(--research-muted)"}}/><YAxis type="category" dataKey="feature" width={180} tickFormatter={humanizeFeature} tick={{fill:"var(--research-muted)",fontSize:12}}/><Tooltip formatter={(value)=>[researchPercent(value),"相對重要性"]} labelFormatter={humanizeFeature} contentStyle={{background:"var(--research-card)",color:"var(--research-ink)"}}/><Legend/><Bar dataKey="normalized_importance" name="相對重要性" fill="var(--research-chart-observed)" isAnimationActive={false}/></BarChart></ResponsiveContainer><p className="research-caption">X 軸：相對重要性；Y 軸：既有行為特徵。重要性不代表因果效果。</p>
    </ChartContainer>
    <details className="studio-advanced"><summary>整體模型解釋、方法與特徵數值</summary><section className="xai-card"><h2>整體模型解釋</h2><p>{result.method_note}</p><table><thead><tr><th>行為特徵</th><th>重要性</th><th>方法</th><th>平均排名</th></tr></thead><tbody>
      {result.global_importance.slice(0, 12).map((item) => { const stability = result.importance_stability.summary.find((value) => value.feature === item.feature); return <tr key={item.feature}><td>{humanizeFeature(item.feature)}</td><td>{number(item.normalized_importance * 100, 1)}%</td><td>{item.method}</td><td>{number(stability?.mean_rank, 1)}</td></tr>; })}
    </tbody></table>{result.shap_summary && <><h3>SHAP 摘要・以訓練平均值為參考</h3><table><thead><tr><th>特徵</th><th>平均 |SHAP|</th><th>平均帶符號 SHAP</th><th>輸出尺度</th></tr></thead><tbody>
      {result.shap_summary.slice(0, 12).map((item) => <tr key={item.feature}><td>{humanizeFeature(item.feature)}</td><td>{number(item.mean_absolute_shap)}</td><td>{number(item.mean_signed_shap)}</td><td>{item.output_scale}</td></tr>)}</tbody></table></>}</section></details>
    <section className="xai-card"><h2>個別預測解釋</h2>{!visibleExplanations.length && <p>所選參與者不在獨立測試集，暫無可顯示的個別解釋。</p>}<label>匿名參與者與場次<select value={selected ? `${selected.participant_id}::${selected.session_id}::${visibleExplanations.indexOf(selected)}` : ""} onChange={(event) => setSelectedKey(event.target.value)}>
      {visibleExplanations.map((item,index) => <option key={`${item.participant_id}::${item.session_id}::${index}`} value={`${item.participant_id}::${item.session_id}::${index}`}>{participantLabel(item.participant_id, participantLabels)} · 場次 {index+1}</option>)}</select></label>
      {selected && <><details className="studio-id-details"><summary>預測場次識別詳情</summary><code>{selected.participant_id} · {selected.session_id}</code></details><div className="xai-prediction"><span>模型預測 <strong>{targetType === "regression" ? researchPercent(selected.prediction) : number(selected.prediction, 0)}</strong></span>
        <span>研究分類機率／模型信心度 <strong>{selected.probability == null ? "迴歸模型不適用" : `${researchPercent(selected.probability)} / ${researchPercent(selected.confidence)}`}</strong></span></div>
        <div className="professional-findings"><h3>個別觀察摘要</h3><p>{prepared.useDemo ? "模擬流程預覽；不代表真實參與者發現。" : selected.narrative}</p><h4>資料證據</h4><p>預測來源：{participantLabel(selected.participant_id, participantLabels)}；獨立測試場次。下方特徵貢獻以目前模型輸出為準。</p><h4>解讀限制</h4><p>模型關聯不代表因果；研究分類門檻不是臨床能力或風險分級。</p></div><div className="xai-grid"><Contributor title="主要正向貢獻特徵" rows={selected.top_positive_contributors} />
          <Contributor title="主要負向貢獻特徵" rows={selected.top_negative_contributors} /></div></>}
    </section>
    <details className="studio-advanced"><summary>模型方法與限制</summary><section className="xai-limit"><strong>{result.limitation_notice}</strong><p>{result.interpretation_guardrail}</p></section></details></>}
  </ResearchPage>;
}

function Contributor({ title, rows }) { return <article><h3>{title}</h3>{rows.length ? <table><thead><tr><th>特徵</th><th>數值</th><th>貢獻度</th></tr></thead><tbody>
  {rows.map((item) => <tr key={item.feature}><td>{humanizeFeature(item.feature)}</td><td>{number(item.feature_value)}</td><td>{number(item.contribution)}</td></tr>)}</tbody></table> : <p>此方向尚無貢獻特徵。</p>}</article>; }
