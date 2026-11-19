import { ResearchQualityPanel } from "./ResearchQualityPanel";
import { researchTaskLabel } from "../../utils/professionalLabels";
import { ProfessionalBrand, ProfessionalClinicalLinks } from "../professional/ProfessionalNavigation";
import { IndicatorMethods } from "../professional/ProfessionalData";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ResearchTaskGuide } from "./ResearchTaskGuide";
import { buildTaskFeatureRow } from "../../analytics/features";
import { matchesResearchScope, RESEARCH_TASKS } from "../../config/researchTasks";
import { participantLabel, summarizeResearchRows } from "../../utils/researchStudioPresentation";
import { useResearchWorkspace } from "./ResearchWorkspaceContext";
import { ResearchPage, ResearchThemeToggle } from "./ResearchPresentation";
import { ParticipantLabel, ResearchDrawer, ResearchIcon, ResearchIdentityProvider, ResearchNotice, StatusIndicator, useParticipantLabels } from "./ResearchStudioUI";

export function ResearchLayout({ tools, activeTool, children }) {
  const data = useResearchWorkspace();
  return <ResearchIdentityProvider participants={data.participants}><ResearchPage className="research-tools-page studio-root" hideToolbar><LayoutContent tools={tools} activeTool={activeTool}>{children}</LayoutContent></ResearchPage></ResearchIdentityProvider>;
}

function LayoutContent({ tools, activeTool, children }) {
  const data = useResearchWorkspace(); const labels = useParticipantLabels(); const root = useRef(null);
  const [params, setParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("research-sidebar-collapsed") === "true"; } catch { return false; } });
  const [drawer, setDrawer] = useState(""); const closeDrawer = useCallback(() => setDrawer(""), []); const [anchor, setAnchor] = useState("");
  const tool = tools.find((item) => item.id === activeTool) || tools[0];
  const rows = useMemo(() => data.inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata })).filter((row) => matchesResearchScope(row.participant_id, row.task_code, data)), [data.inputs, data.selectedParticipant, data.selectedTask]); // eslint-disable-line react-hooks/exhaustive-deps
  const quality = summarizeResearchRows(rows);
  useEffect(() => { if (!anchor) return undefined; const show = () => { const element = root.current?.querySelector(`#${anchor}`); if (!element) return false; let parent = element.parentElement; while (parent) { if (parent.tagName === "DETAILS") parent.open = true; parent = parent.parentElement; } element.scrollIntoView?.({ behavior: "auto", block: "start" }); element.focus?.(); setAnchor(""); return true; }; if (show()) return undefined;
    const observer = new MutationObserver(show); if (root.current) observer.observe(root.current, { childList: true, subtree: true }); return () => observer.disconnect(); }, [anchor, activeTool]);
  function toggleSidebar() { setCollapsed((value) => { try { localStorage.setItem("research-sidebar-collapsed", String(!value)); } catch { /* Display preference is optional. */ } return !value; }); }
  const secondary = (action) => { closeDrawer(); if (action === "exports") { data.openTool("overview"); setAnchor("research-09"); } else setDrawer(action); };
  useEffect(() => {
    const panel = params.get("panel");
    if (["quality", "methods"].includes(panel)) setDrawer(panel);
    if (panel === "exports") setAnchor("research-09");
    if (["quality", "methods", "exports"].includes(panel)) setParams((current) => { const next = new URLSearchParams(current); next.delete("panel"); if (panel === "exports") next.set("view", "overview"); return next; }, { replace: true });
  }, [params, setParams]);
  return <div className={`studio-layout ${collapsed ? "is-collapsed" : ""}`} ref={root}>
    <a className="studio-skip" href="#research-studio-content">跳至分析內容</a>
    <div className="studio-desktop-sidebar" aria-hidden={drawer ? true : undefined}><ResearchSidebar tools={tools} activeTool={activeTool} collapsed={collapsed} onToggle={toggleSidebar} onSecondary={secondary}/></div>
    <div className="studio-workspace" aria-hidden={drawer ? true : undefined}><ResearchHeader tool={tool} quality={quality} loading={data.loading} onMenu={() => setDrawer("navigation")} onQuality={() => setDrawer("quality")}/>
      <div className="studio-content-wrap"><ResearchFilterBar/>
        <div className="studio-scope-caption"><span><ResearchIcon name="info" size={14}/> {participantLabel(data.selectedParticipant, labels)} · {data.selectedTask === "ALL" ? "全部現行任務" : researchTaskLabel(data.selectedTask)}</span></div>
        {data.excludedCount > 0 && <p className="studio-excluded-note">已排除 {data.excludedCount} 筆非現行任務紀錄；原始資料保留。</p>}
        {data.notices.length > 0 && <ResearchNotice tone="warning"><details><summary>{data.notices.length} 項資料載入提示</summary>{data.notices.map((notice, index) => <p key={index}>{notice}</p>)}<button type="button" onClick={() => setDrawer("quality")}>檢查資料品質</button></details></ResearchNotice>}
        <div id="research-studio-content" tabIndex={-1} className="studio-content">{children}</div>
        <footer className="studio-footer"><span>蒐秘密｜專業分析平台</span></footer>
      </div>
    </div>
    {drawer === "navigation" && <ResearchDrawer title="研究導覽" onClose={closeDrawer}><ResearchSidebar tools={tools} activeTool={activeTool} onSelect={closeDrawer} onSecondary={secondary} mobile/></ResearchDrawer>}
    {drawer === "quality" && <ResearchDrawer title="資料品質詳情" onClose={closeDrawer}><ResearchQualityPanel inputs={data.inputs} issues={data.readIssues} excludedCount={data.excludedCount}/></ResearchDrawer>}
    {drawer === "games" && <ResearchDrawer title="遊戲規則與收集資料" onClose={closeDrawer}><ResearchTaskGuide/></ResearchDrawer>}
    {drawer === "methods" && <ResearchDrawer title="研究方法與指標說明" onClose={closeDrawer}>
      <IndicatorMethods/><h3>統計方法的解讀</h3><p>尺度、研究設計、群組獨立性與假設應共同決定 Pearson 或 Spearman 等方法。既有相關分析使用樣本數、偏態、資料型態與離群值的啟發式建議，未改動其計算；此建議不等同完成方法驗證，正式推論仍需研究者確認。</p>
      <h3>資料與匯出</h3><p>逐題作答資料每列是一筆原始採集紀錄；場次摘要使用清理後的指標。欄位說明包含來源、單位與作業代碼對照，完整原始檔與版本另列於進階下載。</p>
      <h3>指標與缺漏</h3><p>正確率以百分比呈現，反應時間以毫秒呈現。「未記錄」表示來源未提供；缺漏不補成 0。統計中的有效場次數與參與者人數分開計算。</p>
      <h3>比較與模型</h3><p>個人趨勢依相同作業、測驗／訓練及難度條件比較。模型以前 30% 題次預測後 70% 表現，20 位具有預測目標的參與者是目前專案設定之資料門檻，尚待方法驗證。</p>
      <p>箱型圖呈現分布與統計離群標記，不作常態性判定。描述性變化、模型預測與模擬回饋不能用於診斷或推論訓練因果效果。</p>
      <h3>參與者代碼</h3><p>P 編號對應本機瀏覽器；匯出保留原本研究 UUID。更換裝置或清除瀏覽器儲存後，請以 UUID 核對。</p>
    </ResearchDrawer>}
  </div>;
}

export function ResearchSidebar({ tools, activeTool, collapsed = false, onToggle, onSelect, onSecondary, mobile = false }) {
  const data = useResearchWorkspace(); const navigate = useNavigate();
  function keyboard(event, index) { const next = ["ArrowDown", "ArrowRight"].includes(event.key) ? (index + 1) % tools.length : ["ArrowUp", "ArrowLeft"].includes(event.key) ? (index + tools.length - 1) % tools.length : event.key === "Home" ? 0 : event.key === "End" ? tools.length - 1 : null;
    if (next == null) return; event.preventDefault(); data.openTool(tools[next].id); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus(); }
  return <aside className={`studio-sidebar ${mobile ? "is-mobile" : ""}`} aria-label="研究側邊導覽"><ProfessionalBrand collapsed={collapsed}/><ProfessionalClinicalLinks collapsed={collapsed}/>
    <div className="studio-nav-caption" aria-hidden="true">{collapsed ? "研究" : "研究工作區"}</div><nav role="tablist" aria-orientation="vertical" aria-label="研究工具">{tools.map((tool, index) => <button type="button" role="tab" key={tool.id} id={`research-tool-${tool.id}${mobile ? "-mobile" : ""}`} aria-controls={`research-panel-${tool.id}`} aria-selected={activeTool === tool.id} tabIndex={activeTool === tool.id ? 0 : -1} title={collapsed ? tool.label : undefined} onClick={() => { data.openTool(tool.id); onSelect?.(); }} onKeyDown={(event) => keyboard(event, index)}><ResearchIcon name={tool.id}/><span className={collapsed ? "studio-sr-only" : "studio-nav-label"}>{tool.label}</span></button>)}</nav>
    <div className="studio-nav-caption" aria-hidden="true">{collapsed ? "工具" : "資料與說明"}</div><div className="studio-secondary-nav">{[["quality", "資料品質"], ["exports", "研究資料匯出"], ["methods", "研究方法與指標說明"]].map(([id, label]) => <button key={id} type="button" title={collapsed ? label : undefined} onClick={() => onSecondary(id)}><ResearchIcon name={id === "exports" ? "export" : id}/><span className={collapsed ? "studio-sr-only" : "studio-nav-label"}>{label}</span></button>)}</div>
    {collapsed ? <div className="studio-secondary-nav studio-guide-shortcut"><button type="button" title="遊戲規則與收集資料" aria-label="遊戲規則與收集資料" onClick={() => onSecondary("games")}><ResearchIcon name="methods"/></button></div> : <ResearchTaskGuide sidebar/>}
    <div className="studio-sidebar-bottom"><button type="button" title="返回醫療首頁" onClick={() => navigate("/clinician-dashboard")}><ResearchIcon name="back"/><span className={collapsed ? "studio-sr-only" : ""}>返回醫療首頁</span></button>{!mobile && <button type="button" onClick={onToggle} aria-label={collapsed ? "展開側邊導覽" : "收合側邊導覽"} aria-expanded={!collapsed}><ResearchIcon name="collapse"/><span className={collapsed ? "studio-sr-only" : ""}>收合導覽</span></button>}</div>
  </aside>;
}

export function ResearchHeader({ tool, quality, loading, onMenu, onQuality }) {
  const navigate = useNavigate();
  return <header className="studio-header"><div className="studio-header-title"><button type="button" className="studio-mobile-menu" aria-label="開啟研究導覽" onClick={onMenu}><ResearchIcon name="menu"/></button><div><div className="studio-breadcrumb">Clinical &amp; Research Workspace <span>/</span> {tool.english}</div><h1>{tool.label}</h1></div></div>
    <div className="studio-header-actions"><button type="button" className="studio-quality-trigger" onClick={onQuality} aria-label="開啟資料品質詳情"><StatusIndicator tone={quality.missingCount || quality.incompleteCount ? "warning" : "info"}>{loading ? "資料載入中" : quality.missingCount || quality.incompleteCount ? "資料待核對" : "資料品質"}</StatusIndicator></button><ResearchThemeToggle/><button type="button" title="返回醫療首頁" aria-label="回醫療主頁" onClick={() => navigate("/clinician-dashboard")}><ResearchIcon name="back"/></button><span className="studio-user"><span>R</span><span>研究工作區</span></span></div>
  </header>;
}

export function ResearchFilterBar() {
  const data = useResearchWorkspace(); const labels = useParticipantLabels();
  const [expanded, setExpanded] = useState(() => window.matchMedia?.("(min-width: 768px)").matches ?? true);
  useEffect(() => { const media = window.matchMedia?.("(min-width: 768px)"); const change = (event) => setExpanded(event.matches); media?.addEventListener?.("change", change); return () => media?.removeEventListener?.("change", change); }, []);
  return <section className="studio-filter-bar" aria-label="共用分析範圍"><button className="studio-filter-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><ResearchIcon name="adaptive"/>分析範圍 {expanded ? "收合" : "展開"}</button>
    <div className="studio-filter-body" hidden={!expanded}><label>研究參與者<select aria-label="匿名參與者" value={data.selectedParticipant} disabled={data.loading} onChange={(event) => data.setSelectedParticipant(event.target.value)}>{!data.participants.length && <option value="">尚無參與者</option>}<option value="ALL">全部參與者</option>{data.participants.map((id) => <option key={id} value={id}>{participantLabel(id, labels)}</option>)}</select></label>
      <label>研究任務<select aria-label="任務" value={data.selectedTask} onChange={(event) => data.setSelectedTask(event.target.value)}><option value="ALL">全部現行任務</option>{RESEARCH_TASKS.map((task) => <option key={task} value={task}>{researchTaskLabel(task)}</option>)}</select></label>
      <button type="button" className="studio-refresh" disabled={data.loading} onClick={data.refresh}><ResearchIcon name="refresh" size={16}/>重新整理資料</button>
    </div>{data.selectedParticipant && data.selectedParticipant !== "ALL" && <details className="studio-id-details"><summary>參與者識別詳情</summary><ParticipantLabel id={data.selectedParticipant}/><code>{data.selectedParticipant}</code><small>顯示編號對應本機瀏覽器；研究 UUID 與匯出保持原值。</small></details>}
  </section>;
}
