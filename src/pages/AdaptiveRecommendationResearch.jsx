import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, MetricCard, PageHeader, ParticipantLabel, ResearchDataTable, ResearchNotice, StatusIndicator } from "../components/research/ResearchStudioUI";
import { useResearchData, useResearchSelection, useResearchWorkspace } from "../components/research/ResearchWorkspaceContext";
import { matchesResearchScope, researchTaskLabel } from "../config/researchTasks";
import { researchNumber } from "../utils/researchPresentation";
import { ResearchPage } from "../components/research/ResearchPresentation";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { runPolicySimulation } from "../analytics/recommendation";
import "../styles/AdaptiveRecommendationResearch.css";
import "../styles/ResearchDashboardTheme.css";

const format = researchNumber;
const action = (row) => row?.selected_action || {};

export default function AdaptiveRecommendationResearch() {
  const navigate = useNavigate();
  const workspace = useResearchWorkspace();
  const { recommendations, loading, error, notices } = useResearchData();
  const participants = useMemo(() => [...new Set(recommendations.map((row) => row.participant_id).filter(Boolean))], [recommendations]);
  const { selectedParticipant, selectedTask } = useResearchSelection(participants);
  const history = useMemo(() => recommendations.filter((row) => matchesResearchScope(row.participant_id, row.selected_action?.task_code, { selectedParticipant, selectedTask })), [recommendations, selectedParticipant, selectedTask]);
  const historyNotice = notices.find((notice) => notice.includes("建議歷程"));
  const simulation = useMemo(() => runPolicySimulation({ rounds: 120, seed: 20260730 }), []);
  const roundData = useMemo(() => (simulation[0]?.history || []).map((row,index) => ({ round: row.round, ...Object.fromEntries(simulation.map((policy,policyIndex) => ["reward_"+policyIndex, policy.history[index]?.actual_reward ?? null])) })), [simulation]);
  if (loading) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>自適應建議</h1><p>正在載入建議研究資料…</p></section></ResearchPage>;
  if (error) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>自適應建議</h1><p>{error}</p><button className="research-home-button" hidden={Boolean(workspace)} onClick={() => navigate("/clinician-dashboard")}>回主頁</button></section></ResearchPage>;
  return <ResearchPage className="adaptive-page">
    <PageHeader eyebrow="POLICY RESEARCH" title="自適應建議" description="比較既有推薦策略的模擬回饋，並追溯實際決策歷程。"/>
    <ResearchNotice tone="warning"><strong>模擬資料｜非實際研究結果。</strong>模擬使用全部六個現行任務；共用篩選套用至下方實際推薦歷程。回饋不等於幼兒訓練成效。</ResearchNotice>
    <div className="studio-kpi-grid"><MetricCard label="比較策略" value={simulation.length} detail="保留所有既有策略與版本"/><MetricCard label="每策略模擬回合" value={simulation[0]?.rounds ?? "—"} tone="purple"/><MetricCard label="逐回合模擬紀錄" value={simulation.reduce((sum,item)=>sum+item.history.length,0)} detail="僅作策略流程研究" tone="amber"/><MetricCard label="實際推薦紀錄" value={history.length} detail="目前參與者與任務範圍" tone="teal"/></div>
    <div className="studio-grid-two">
      <ChartContainer title="策略平均回饋比較" count={simulation.length} countLabel="項策略" unit="原始 Reward" source="固定種子的策略模擬">
        <ResponsiveContainer width="100%" height={320}><BarChart data={simulation} margin={{top:16,right:16,bottom:32,left:4}}><CartesianGrid vertical={false} stroke="var(--research-border)"/><XAxis dataKey="policy" tick={{fill:"var(--research-muted)",fontSize:11}} interval={0} angle={-18} textAnchor="end" height={64}/><YAxis domain={[(min)=>Math.min(0,min),(max)=>Math.max(0,max)]} tick={{fill:"var(--research-muted)"}}/><Tooltip formatter={(value,name)=>[format(value),name]} contentStyle={{background:"var(--research-card)",color:"var(--research-ink)"}}/><Legend/><Bar dataKey="mean_reward" name="平均回饋" fill="var(--research-chart-observed)" isAnimationActive={false}/><Bar dataKey="final_20_mean_reward" name="最後 20 回合平均" fill="var(--research-chart-secondary)" isAnimationActive={false}/></BarChart></ResponsiveContainer><p className="research-caption">X 軸：推薦策略；Y 軸：既有 Reward。未修改回饋定義或將高回饋解讀為訓練效果。</p>
      </ChartContainer>
      <ChartContainer title="回合回饋趨勢" count={roundData.length} countLabel="回合" unit="原始 Reward" source="原始逐回合模擬紀錄" empty={!roundData.length}>
        <ResponsiveContainer width="100%" height={320}><LineChart data={roundData} margin={{top:16,right:16,bottom:16,left:4}}><CartesianGrid vertical={false} stroke="var(--research-border)"/><XAxis dataKey="round" label={{value:"回合",position:"insideBottom",offset:-8}} tick={{fill:"var(--research-muted)"}}/><YAxis domain={[(min)=>Math.min(0,min),(max)=>Math.max(0,max)]} tick={{fill:"var(--research-muted)"}}/><Tooltip formatter={(value,name)=>[format(value),name]} contentStyle={{background:"var(--research-card)",color:"var(--research-ink)"}}/><Legend/>{simulation.map((policy,index)=><Line key={policy.policy_version} type="linear" dataKey={"reward_"+index} name={policy.policy} stroke={["var(--research-chart-observed)","var(--research-chart-secondary)","#3f927e","#b37b28","#c76a6a","#73839a"][index]} strokeDasharray={index%2?"5 3":undefined} dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer><p className="research-caption">X 軸：回合；Y 軸：該回合實際產生的模擬回饋。保留波動，不加平滑或補值。</p>
      </ChartContainer>
    </div>
    <section className="studio-card"><h2>策略比較・模擬</h2><ResearchDataTable title="策略詳細資料" rows={simulation} getKey={(row)=>row.policy_version} columns={[
      {key:"policy",label:"策略"},{key:"policy_version",label:"版本"},{key:"rounds",label:"回合數",numeric:true},{key:"mean_reward",label:"平均回饋",numeric:true,render:(row)=>format(row.mean_reward)},{key:"final_20_mean_reward",label:"最後 20 回合平均",numeric:true,render:(row)=>format(row.final_20_mean_reward)},{key:"status",label:"狀態",render:()=> <StatusIndicator tone="warning">模擬</StatusIndicator>},
    ]}/><p className="research-caption">基準策略包含 Random 與 Rule-based；Reward 版本：reward_balanced_v1。所有策略使用原本演算法與安全行動邊界。</p></section>
    <section className="studio-card"><div className="studio-section-header"><h2>建議歷程・實際資料</h2><StatusIndicator>實際研究紀錄</StatusIndicator></div>{historyNotice && <ResearchNotice tone="warning">{historyNotice}</ResearchNotice>}
      <ResearchDataTable title="實際推薦歷程" rows={history} getKey={(row)=>row.id} columns={[
        {key:"recommendation_timestamp",label:"時間",render:(row)=>new Date(row.recommendation_timestamp).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"})},
        {key:"participant_id",label:"參與者",render:(row)=><ParticipantLabel id={row.participant_id}/>},
        {key:"policy_name",label:"選用策略",render:(row)=><>{row.policy_name}<small className="studio-muted"> {row.policy_version}</small></>},
        {key:"task",label:"選擇任務",sortValue:(row)=>action(row).task_code,render:(row)=>researchTaskLabel(action(row).task_code)},
        {key:"difficulty",label:"難度",numeric:true,sortValue:(row)=>action(row).difficulty_level,render:(row)=>action(row).difficulty_level ?? "—"},
        {key:"predicted_reward",label:"預測回饋",numeric:true,render:(row)=>format(row.predicted_reward)},{key:"actual_reward",label:"實際回饋",numeric:true,render:(row)=>format(row.actual_reward)},
        {key:"change",label:"表現變化",numeric:true,sortValue:(row)=>row.actual_outcome?.performance_change,render:(row)=>format(row.actual_outcome?.performance_change)},
      ]}/>
    </section>
    <details className="studio-advanced"><summary>探索安全限制與研究解讀</summary><section className="studio-card"><h3>既有探索安全限制</h3><p>每次策略決策前都會篩選可用行動。難度每次最多調整一級；若未知目前難度，僅開放第 1 至 2 級。敏感或醫療標籤不作為決策條件。</p><p>模擬回饋不等於實際幼兒訓練成效，也不能直接推論某種策略能改善認知能力。平均回饋較高不代表因果訓練效果。</p></section></details>
  </ResearchPage>;
}
