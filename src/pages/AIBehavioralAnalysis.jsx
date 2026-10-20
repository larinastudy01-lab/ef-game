import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, EmptyState, ModelStatusCard, PageHeader, ResearchNotice, useParticipantLabels } from "../components/research/ResearchStudioUI";
import { participantLabel } from "../utils/researchStudioPresentation";
import { useResearchData, useResearchSelection, useResearchWorkspace } from "../components/research/ResearchWorkspaceContext";
import { scopeResearchInputs } from "../config/researchTasks";
import { researchNumber, researchPercent } from "../utils/researchPresentation";
import { ResearchPage } from "../components/research/ResearchPresentation";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeModelExplainability, humanizeFeature } from "../analytics/explainability";
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
    {prepared.useDemo && <section className="xai-demo"><strong>模擬資料｜非實際研究結果</strong><span>僅供驗證分析流程，這些數值不代表研究發現。</span></section>}
    <ResearchNotice>觀察模型以前 30% 題次預測同任務後 70% 題次。分類門檻為研究設定，不代表臨床正常範圍。</ResearchNotice>
    <section className="xai-controls"><label>結果類型<select value={targetType} onChange={(event) => { setTargetType(event.target.value); setSelectedKey(""); }}>
      <option value="regression">未來正確率（迴歸）</option><option value="classification">未來表現分類（研究門檻）</option></select></label>
      <button type="button" aria-pressed={demoMode} onClick={() => { setDemoMode((value) => !value); setSelectedKey(""); }}>{demoMode ? "返回實際觀察資料" : "使用模擬資料預覽"}</button></section>
    <ModelStatusCard count={prepared.observedParticipantCount} result={result} error={resultState.error} demo={demoMode}/>
    {!result ? <section className="studio-card"><EmptyState title={resultState.error ? "模型分析暫時無法使用" : "觀察模型尚未就緒"} description={resultState.unavailable || resultState.error}/><p className="research-caption">模型表現、特徵重要性與個別預測解釋須等待模型資料條件滿足；可由上方手動開啟模擬預覽。</p></section> : <>
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
      <ResponsiveContainer width="100%" height={360}><BarChart layout="vertical" data={result.global_importance.slice(0,12)} margin={{top:8,right:24,bottom:16,left:8}}><CartesianGrid horizontal={false} stroke="var(--research-border)"/><XAxis type="number" domain={[0,1]} tickFormatter={(value)=>researchPercent(value)} tick={{fill:"var(--research-muted)"}}/><YAxis type="category" dataKey="feature" width={180} tickFormatter={humanizeFeature} tick={{fill:"var(--research-muted)",fontSize:12}}/><Tooltip formatter={(value)=>[researchPercent(value),"相對重要性"]} labelFormatter={humanizeFeature} contentStyle={{background:"var(--research-card)",color:"var(--research-ink)"}}/><Legend/><Bar dataKey="normalized_importance" name="相對重要性" fill="var(--research-chart-observed)" isAnimationActive={false}/></BarChart></ResponsiveContainer><p className="research-caption">X 軸：相對重要性；Y 軸：既有行為特徵。重要性不代表因果效果。</p>
    </ChartContainer>
    <section className="xai-card"><h2>整體模型解釋</h2><p>{result.method_note}</p><table><thead><tr><th>行為特徵</th><th>重要性</th><th>方法</th><th>平均排名</th></tr></thead><tbody>
      {result.global_importance.slice(0, 12).map((item) => { const stability = result.importance_stability.summary.find((value) => value.feature === item.feature); return <tr key={item.feature}><td>{humanizeFeature(item.feature)}</td><td>{number(item.normalized_importance * 100, 1)}%</td><td>{item.method}</td><td>{number(stability?.mean_rank, 1)}</td></tr>; })}
    </tbody></table>{result.shap_summary && <><h3>SHAP 摘要・以訓練平均值為參考</h3><table><thead><tr><th>特徵</th><th>平均 |SHAP|</th><th>平均帶符號 SHAP</th><th>輸出尺度</th></tr></thead><tbody>
      {result.shap_summary.slice(0, 12).map((item) => <tr key={item.feature}><td>{humanizeFeature(item.feature)}</td><td>{number(item.mean_absolute_shap)}</td><td>{number(item.mean_signed_shap)}</td><td>{item.output_scale}</td></tr>)}</tbody></table></>}</section>
    <section className="xai-card"><h2>個別預測解釋</h2>{!visibleExplanations.length && <p>所選參與者不在獨立測試集，暫無可顯示的個別解釋。</p>}<label>匿名參與者與場次<select value={selected ? `${selected.participant_id}::${selected.session_id}::${visibleExplanations.indexOf(selected)}` : ""} onChange={(event) => setSelectedKey(event.target.value)}>
      {visibleExplanations.map((item,index) => <option key={`${item.participant_id}::${item.session_id}::${index}`} value={`${item.participant_id}::${item.session_id}::${index}`}>{participantLabel(item.participant_id, participantLabels)} · 場次 {index+1}</option>)}</select></label>
      {selected && <><details className="studio-id-details"><summary>預測場次識別詳情</summary><code>{selected.participant_id} · {selected.session_id}</code></details><div className="xai-prediction"><span>模型預測 <strong>{targetType === "regression" ? researchPercent(selected.prediction) : number(selected.prediction, 0)}</strong></span>
        <span>研究分類機率／模型信心度 <strong>{selected.probability == null ? "迴歸模型不適用" : `${researchPercent(selected.probability)} / ${researchPercent(selected.confidence)}`}</strong></span></div>
        <p className="xai-narrative">{selected.narrative}</p><div className="xai-grid"><Contributor title="主要正向貢獻特徵" rows={selected.top_positive_contributors} />
          <Contributor title="主要負向貢獻特徵" rows={selected.top_negative_contributors} /></div></>}
    </section>
    <section className="xai-limit"><h2>模型限制</h2><strong>{result.limitation_notice}</strong><p>{result.interpretation_guardrail}</p>
      <p>預測僅描述行為表現的模式與關聯，不能用來建立診斷、因果關係或訓練成效。</p></section></>}
  </ResearchPage>;
}

function Contributor({ title, rows }) { return <article><h3>{title}</h3>{rows.length ? <table><thead><tr><th>特徵</th><th>數值</th><th>貢獻度</th></tr></thead><tbody>
  {rows.map((item) => <tr key={item.feature}><td>{humanizeFeature(item.feature)}</td><td>{number(item.feature_value)}</td><td>{number(item.contribution)}</td></tr>)}</tbody></table> : <p>此方向尚無貢獻特徵。</p>}</article>; }
