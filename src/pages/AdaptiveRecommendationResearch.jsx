import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadRecommendationHistory, runPolicySimulation } from "../analytics/recommendation";
import { getMyProfile } from "../lib/database";
import { supabase } from "../lib/supabaseClient";
import "../styles/AdaptiveRecommendationResearch.css";
import "../styles/ResearchDashboardTheme.css";

const format = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
const action = (row) => row?.selected_action || {};

export default function AdaptiveRecommendationResearch() {
  const navigate = useNavigate(); const [history, setHistory] = useState([]); const [loading, setLoading] = useState(true); const [historyNotice, setHistoryNotice] = useState("");
  useEffect(() => { let active = true; (async () => { try { const profile = await getMyProfile();
    if (!["clinician", "medical", "doctor"].includes(String(profile?.role || "").toLowerCase())) { navigate("/clinician-login", { replace: true }); return; }
    try { const rows = await loadRecommendationHistory(supabase); if (active) setHistory(rows); }
    catch (reason) { if (active) setHistoryNotice("尚無法取得實際建議歷程，請確認資料庫變更與存取權限。"); }
  } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, [navigate]);
  const simulation = useMemo(() => runPolicySimulation({ rounds: 120, seed: 20260730 }), []);
  if (loading) return <main className="research-page-state"><section className="research-page-state-card"><h1>自適應建議</h1><p>正在載入建議研究資料…</p></section></main>;
  return <main className="adaptive-page"><header className="adaptive-header"><div><p>研究原型・自適應建議 v1</p>
    <h1>自適應建議</h1><span>比較基準策略與演算法自適應建議。</span></div>
    <button onClick={() => navigate("/clinician-dashboard")}>回主頁</button></header>
    <section className="adaptive-warning"><strong>模擬結果與實際歷程分開呈現。</strong>
      <span>模擬結果不代表實際幼兒訓練成效，不可解讀為某策略能改善認知能力的證據。</span></section>
    <section className="adaptive-card"><h2>策略比較・模擬</h2><table><thead><tr><th>策略</th><th>版本</th><th>回合數</th><th>平均回饋</th><th>最後 20 回合平均</th><th>狀態</th></tr></thead><tbody>
      {simulation.map((item) => <tr key={item.policy_version}><td>{item.policy}</td><td>{item.policy_version}</td><td>{item.rounds}</td><td>{format(item.mean_reward)}</td><td>{format(item.final_20_mean_reward)}</td><td><strong>模擬</strong></td></tr>)}</tbody></table></section>
    <section className="adaptive-meta"><article><span>基準策略 1</span><strong>隨機</strong></article><article><span>基準策略 2</span><strong>符合現有規則</strong></article>
      <article><span>可選行動</span><strong>訓練任務</strong></article><article><span>回饋版本</span><strong>reward_balanced_v1</strong></article></section>
    <section className="adaptive-card"><h2>建議歷程・實際資料</h2>{historyNotice && <p className="adaptive-notice">{historyNotice}</p>}
      {!history.length ? <p>尚無已儲存的實際建議紀錄；模擬資料不會複製至此區域。</p>
        : <table><thead><tr><th>時間</th><th>參與者</th><th>選用策略</th><th>選擇任務</th><th>難度</th><th>預測回饋</th><th>實際回饋</th><th>表現變化</th></tr></thead><tbody>
          {history.map((row) => <tr key={row.id}><td>{new Date(row.recommendation_timestamp).toLocaleString()}</td><td>{row.participant_id}</td><td>{row.policy_name}<small>{row.policy_version}</small></td>
            <td>{action(row).task_code || "—"}</td><td>{action(row).difficulty_level || "—"}</td><td>{format(row.predicted_reward)}</td><td>{format(row.actual_reward)}</td>
            <td>{format(row.actual_outcome?.performance_change)}</td></tr>)}</tbody></table>}</section>
    <section className="adaptive-card"><h2>探索安全限制</h2><p>每次策略決策前都會篩選可用行動。難度每次最多調整一級；若未知目前難度，僅開放第 1至2 級。敏感或醫療標籤不會作為決策條件。</p></section>
  </main>;
}
