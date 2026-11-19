import { researchTaskLabel } from "../utils/professionalLabels";
import { RewardSimulation } from "../components/professional/RewardSimulation";
import { formatDateTime, formatDifficulty } from "../utils/professionalFormatters";
import { MetricCard, PageHeader, ParticipantLabel, ResearchDataTable, ResearchNotice } from "../components/research/ResearchStudioUI";
import { useResearchData, useResearchSelection, useResearchWorkspace } from "../components/research/ResearchWorkspaceContext";
import { matchesResearchScope } from "../config/researchTasks";
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

  if (loading) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>自適應建議</h1><p>正在載入建議研究資料…</p></section></ResearchPage>;
  if (error) return <ResearchPage className="research-page-state"><section className="research-page-state-card"><h1>自適應建議</h1><p>{error}</p><button className="research-home-button" hidden={Boolean(workspace)} onClick={() => navigate("/clinician-dashboard")}>回主頁</button></section></ResearchPage>;
  return <ResearchPage className="adaptive-page">
    <PageHeader eyebrow="POLICY RESEARCH" title="自適應建議" description="比較既有推薦策略的模擬回饋，並追溯實際決策歷程。"/>
    <ResearchNotice tone="warning"><strong>模擬資料｜非實際研究結果。</strong>模擬使用全部六個現行任務；共用篩選套用至下方實際推薦歷程。回饋不等於幼兒訓練成效。</ResearchNotice>
    <div className="studio-kpi-grid"><MetricCard label="比較策略" value={simulation.length} detail="保留所有既有策略與版本"/><MetricCard label="每策略模擬回合" value={simulation[0]?.rounds ?? "未記錄"} tone="purple"/><MetricCard label="逐回合模擬紀錄" value={simulation.reduce((sum,item)=>sum+item.history.length,0)} detail="僅作策略流程研究" tone="amber"/><MetricCard label="實際推薦紀錄" value={history.length} detail="目前參與者與任務範圍" tone="teal"/></div>
    <RewardSimulation simulation={simulation} seed={20260730} rounds={120}/>
    <section className="studio-card"><div className="studio-section-header"><h2>建議歷程・實際資料</h2><span>實際研究紀錄</span></div>{historyNotice && <ResearchNotice tone="warning">{historyNotice}</ResearchNotice>}
      <ResearchDataTable title="實際推薦歷程" rows={history} getKey={(row)=>row.id} columns={[
        {key:"recommendation_timestamp",label:"時間",render:(row)=>formatDateTime(row.recommendation_timestamp)},
        {key:"participant_id",label:"參與者",render:(row)=><ParticipantLabel id={row.participant_id}/>},
        {key:"policy_name",label:"選用策略",render:(row)=><>{row.policy_name}<small className="studio-muted"> {row.policy_version}</small></>},
        {key:"task",label:"選擇任務",sortValue:(row)=>action(row).task_code,render:(row)=>researchTaskLabel(action(row).task_code)},
        {key:"difficulty",label:"難度",numeric:true,sortValue:(row)=>action(row).difficulty_level,render:(row)=>formatDifficulty(action(row).difficulty_level)},
        {key:"predicted_reward",label:"預測回饋",numeric:true,render:(row)=>format(row.predicted_reward)},{key:"actual_reward",label:"實際回饋",numeric:true,render:(row)=>format(row.actual_reward)},
        {key:"change",label:"表現變化",numeric:true,sortValue:(row)=>row.actual_outcome?.performance_change,render:(row)=>format(row.actual_outcome?.performance_change)},
      ]}/>
    </section>
    <details className="studio-advanced"><summary>探索安全限制與研究解讀</summary><section className="studio-card"><h3>既有探索安全限制</h3><p>每次策略決策前都會篩選可用行動。難度每次最多調整一級；若未知目前難度，僅開放第 1 至 2 級。敏感或醫療標籤不作為決策條件。</p><p>模擬回饋不等於實際幼兒訓練成效，也不能直接推論某種策略能改善認知能力。平均回饋較高不代表因果訓練效果。</p></section></details>
  </ResearchPage>;
}
