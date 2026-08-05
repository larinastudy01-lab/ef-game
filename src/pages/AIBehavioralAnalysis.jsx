import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeModelExplainability, humanizeFeature } from "../analytics/explainability";
import { buildFuturePerformanceDataset, generateSyntheticDataset, toPerformanceCategory } from "../analytics/ml";
import { getMyProfile, getResearchFeatureInputsFromCloud } from "../lib/database";
import "../styles/AIBehavioralAnalysis.css";
import "../styles/ResearchDashboardTheme.css";

const number = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

export default function AIBehavioralAnalysis() {
  const navigate = useNavigate(); const [inputs, setInputs] = useState([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [targetType, setTargetType] = useState("regression"); const [selectedKey, setSelectedKey] = useState("");
  useEffect(() => { let active = true; (async () => { try {
    const profile = await getMyProfile(); if (!["clinician", "medical", "doctor"].includes(String(profile?.role || "").toLowerCase())) {
      navigate("/clinician-login", { replace: true }); return;
    }
    const data = await getResearchFeatureInputsFromCloud(); if (active) setInputs(data);
  } catch (reason) { if (active) setError(reason?.message || "行為模型資料無法載入。"); }
  finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, [navigate]);

  const prepared = useMemo(() => {
    const observed = buildFuturePerformanceDataset(inputs, 0.3, "accuracy");
    const participantCount = new Set(observed.map((row) => row.participant_id)).size;
    const useDemo = participantCount < 20;
    const base = useDemo ? generateSyntheticDataset({ participants: 40, targetType }) : observed;
    return { rows: targetType === "classification" && !useDemo ? toPerformanceCategory(base, 0.7) : base, useDemo, observedParticipantCount: participantCount };
  }, [inputs, targetType]);

  const resultState = useMemo(() => { try { return { result: analyzeModelExplainability(prepared.rows,
    { targetType, demoMode: prepared.useDemo, includeComparison: true, folds: 5 }) }; }
  catch (reason) { return { error: reason?.message || "無法完成模型解釋分析。" }; } }, [prepared, targetType]);
  const result = resultState.result;
  const selected = useMemo(() => { if (!result?.individual_explanations?.length) return null;
    return result.individual_explanations.find((item) => `${item.participant_id}::${item.session_id}` === selectedKey) || result.individual_explanations[0];
  }, [result, selectedKey]);

  if (loading) return <main className="research-page-state"><section className="research-page-state-card"><h1>AI 行為分析</h1><p>正在載入行為模型…</p></section></main>;
  if (error || resultState.error) return <main className="research-page-state"><section className="research-page-state-card"><h1>AI 行為分析</h1><p>資料尚未可用，請確認資料庫變更與帳號存取權限已完成設定。</p><button onClick={() => navigate("/clinician-dashboard")}>回主頁</button></section></main>;
  return <main className="xai-page">
    <header className="xai-header"><div><p>研究原型・模型解釋 v1</p><h1>AI 行為分析</h1>
      <span>解釋行為表現模型為何產生目前的預測結果。</span></div><button onClick={() => navigate("/clinician-dashboard")}>回主頁</button></header>
    {prepared.useDemo && <section className="xai-demo"><strong>示範／模擬資料</strong><span>僅供驗證分析流程，這些數值不代表研究發現。</span></section>}
    <section className="xai-controls"><label>結果類型<select value={targetType} onChange={(event) => { setTargetType(event.target.value); setSelectedKey(""); }}>
      <option value="regression">未來正確率（迴歸）</option><option value="classification">未來表現分類（研究門檻）</option></select></label></section>
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
    <section className="xai-card"><h2>整體模型解釋</h2><p>{result.method_note}</p><table><thead><tr><th>行為特徵</th><th>重要性</th><th>方法</th><th>平均排名</th></tr></thead><tbody>
      {result.global_importance.slice(0, 12).map((item) => { const stability = result.importance_stability.summary.find((value) => value.feature === item.feature); return <tr key={item.feature}><td>{humanizeFeature(item.feature)}</td><td>{number(item.normalized_importance * 100, 1)}%</td><td>{item.method}</td><td>{number(stability?.mean_rank, 1)}</td></tr>; })}
    </tbody></table>{result.shap_summary && <><h3>SHAP 摘要・以訓練平均值為參考</h3><table><thead><tr><th>特徵</th><th>平均 |SHAP|</th><th>平均帶符號 SHAP</th><th>輸出尺度</th></tr></thead><tbody>
      {result.shap_summary.slice(0, 12).map((item) => <tr key={item.feature}><td>{humanizeFeature(item.feature)}</td><td>{number(item.mean_absolute_shap)}</td><td>{number(item.mean_signed_shap)}</td><td>{item.output_scale}</td></tr>)}</tbody></table></>}</section>
    <section className="xai-card"><h2>個別預測解釋</h2><label>匿名參與者與場次<select value={selected ? `${selected.participant_id}::${selected.session_id}` : ""} onChange={(event) => setSelectedKey(event.target.value)}>
      {result.individual_explanations.map((item) => <option key={`${item.participant_id}::${item.session_id}`} value={`${item.participant_id}::${item.session_id}`}>{item.participant_id} · {item.session_id}</option>)}</select></label>
      {selected && <><div className="xai-prediction"><span>模型預測 <strong>{number(selected.prediction)}</strong></span>
        <span>機率／信心度 <strong>{selected.probability === null ? "迴歸模型不適用" : `${number(selected.probability * 100, 1)}% / ${number(selected.confidence * 100, 1)}%`}</strong></span></div>
        <p className="xai-narrative">{selected.narrative}</p><div className="xai-grid"><Contributor title="主要正向貢獻特徵" rows={selected.top_positive_contributors} />
          <Contributor title="主要負向貢獻特徵" rows={selected.top_negative_contributors} /></div></>}
    </section>
    <section className="xai-limit"><h2>模型限制</h2><strong>{result.limitation_notice}</strong><p>{result.interpretation_guardrail}</p>
      <p>預測僅描述行為表現的模式與關聯，不能用來建立診斷、因果關係或訓練成效。</p></section>
  </main>;
}

function Contributor({ title, rows }) { return <article><h3>{title}</h3>{rows.length ? <table><thead><tr><th>特徵</th><th>數值</th><th>貢獻度</th></tr></thead><tbody>
  {rows.map((item) => <tr key={item.feature}><td>{humanizeFeature(item.feature)}</td><td>{number(item.feature_value)}</td><td>{number(item.contribution)}</td></tr>)}</tbody></table> : <p>此方向尚無貢獻特徵。</p>}</article>; }
