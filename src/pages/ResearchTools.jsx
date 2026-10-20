import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ResearchLayout } from "../components/research/ResearchStudioLayout";
import { EmptyState, LoadingState, ResearchNotice } from "../components/research/ResearchStudioUI";
import { ResearchWorkspaceProvider, useResearchWorkspace } from "../components/research/ResearchWorkspaceContext";

import "../styles/ResearchTools.css";
import "../styles/ResearchStudio.css";

const TOOLS = [
  { id: "overview", english: "Research Overview", label: "研究總覽", Component: lazy(() => import("./ResearchProfessionalDashboard")) },
  { id: "statistics", english: "Research Statistics", label: "研究統計", Component: lazy(() => import("./ResearchStatistics")) },
  { id: "ai", english: "AI Behavior Analysis", label: "AI 行為分析", Component: lazy(() => import("./AIBehavioralAnalysis")) },
  { id: "adaptive", english: "Adaptive Recommendations", label: "自適應建議", Component: lazy(() => import("./AdaptiveRecommendationResearch")) },
  { id: "longitudinal", english: "Longitudinal Tracking", label: "縱向追蹤", Component: lazy(() => import("./LongitudinalDashboard")) },
];

export default function ResearchTools() {
  const [params, setParams] = useSearchParams();
  const activeTool = TOOLS.some((tool) => tool.id === params.get("view")) ? params.get("view") : "overview";
  const [visited, setVisited] = useState(() => new Set([activeTool]));
  useEffect(() => { setVisited((current) => current.has(activeTool) ? current : new Set([...current, activeTool])); }, [activeTool]);
  const openTool = useCallback((tool) => {
    if (!TOOLS.some((item) => item.id === tool)) return;
    setVisited((current) => new Set([...current, tool]));
    setParams((current) => { const next = new URLSearchParams(current); next.set("view", tool); return next; });
  }, [setParams]);
  return <ResearchWorkspaceProvider openTool={openTool}><Workspace activeTool={activeTool} visited={visited}/></ResearchWorkspaceProvider>;
}

function Workspace({ activeTool, visited }) {
  const data = useResearchWorkspace();
  return <ResearchLayout tools={TOOLS} activeTool={activeTool}>
    {data.loading ? <LoadingState label="正在載入共用研究資料…"/> : data.error ? <ResearchNotice tone="error"><div role="alert"><h2>資料尚未就緒</h2><p>{data.error}</p><button type="button" onClick={data.refresh}>重試載入</button></div></ResearchNotice>
      : TOOLS.map(({ id, Component }) => <section key={id} id={`research-panel-${id}`} role="tabpanel" aria-labelledby={`research-tool-${id}`} hidden={activeTool !== id} className="research-tools-panel">
        {(visited.has(id) || activeTool === id) && <Suspense fallback={<LoadingState label="正在載入分析工具…"/>}><Component/></Suspense>}
      </section>)}
    {!data.loading && !data.error && !data.inputs.length && <EmptyState title="尚無研究場次" description="資料來源未提供目前可分析的任務紀錄。"/>}
  </ResearchLayout>;
}
