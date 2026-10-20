import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ResearchTaskGuide } from "./ResearchTaskGuide";
import { buildTaskFeatureRow } from "../../analytics/features";
import { matchesResearchScope, RESEARCH_TASKS, researchTaskLabel } from "../../config/researchTasks";
import { buildResearchQualityAlerts, isResearchNumber } from "../../utils/researchPresentation";
import { participantLabel, summarizeResearchRows } from "../../utils/researchStudioPresentation";
import { useResearchWorkspace } from "./ResearchWorkspaceContext";
import { ResearchAlerts, ResearchPage, ResearchThemeToggle } from "./ResearchPresentation";
import { MetricCard, ParticipantLabel, ResearchDrawer, ResearchIcon, ResearchIdentityProvider, ResearchNotice, StatusIndicator, useParticipantLabels } from "./ResearchStudioUI";

export function ResearchLayout({ tools, activeTool, children }) {
  const data = useResearchWorkspace();
  return <ResearchIdentityProvider participants={data.participants}><ResearchPage className="research-tools-page studio-root" hideToolbar><LayoutContent tools={tools} activeTool={activeTool}>{children}</LayoutContent></ResearchPage></ResearchIdentityProvider>;
}

function LayoutContent({ tools, activeTool, children }) {
  const data = useResearchWorkspace(); const labels = useParticipantLabels(); const root = useRef(null);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("research-sidebar-collapsed") === "true"; } catch { return false; } });
  const [drawer, setDrawer] = useState(""); const closeDrawer = useCallback(() => setDrawer(""), []); const [anchor, setAnchor] = useState("");
  const tool = tools.find((item) => item.id === activeTool) || tools[0];
  const rows = useMemo(() => data.inputs.map((input) => ({ ...buildTaskFeatureRow(input), ...input.sessionMetadata })).filter((row) => matchesResearchScope(row.participant_id, row.task_code, data)), [data.inputs, data.selectedParticipant, data.selectedTask]); // eslint-disable-line react-hooks/exhaustive-deps
  const quality = summarizeResearchRows(rows); const alerts = buildResearchQualityAlerts(rows);
  useEffect(() => { if (!anchor) return undefined; const show = () => { const element = root.current?.querySelector(`#${anchor}`); if (!element) return false; element.scrollIntoView?.({ behavior: "auto", block: "start" }); element.focus?.(); setAnchor(""); return true; }; if (show()) return undefined;
    const observer = new MutationObserver(show); if (root.current) observer.observe(root.current, { childList: true, subtree: true }); return () => observer.disconnect(); }, [anchor, activeTool]);
  function toggleSidebar() { setCollapsed((value) => { try { localStorage.setItem("research-sidebar-collapsed", String(!value)); } catch { /* Display preference is optional. */ } return !value; }); }
  const secondary = (action) => { closeDrawer(); if (action === "exports") { data.openTool("overview"); setAnchor("research-09"); } else setDrawer(action); };
  return <div className={`studio-layout ${collapsed ? "is-collapsed" : ""}`} ref={root}>
    <a className="studio-skip" href="#research-studio-content">跳至分析內容</a>
    <div className="studio-desktop-sidebar" aria-hidden={drawer ? true : undefined}><ResearchSidebar tools={tools} activeTool={activeTool} collapsed={collapsed} onToggle={toggleSidebar} onSecondary={secondary}/></div>
    <div className="studio-workspace" aria-hidden={drawer ? true : undefined}><ResearchHeader tool={tool} quality={quality} loading={data.loading} onMenu={() => setDrawer("navigation")} onQuality={() => setDrawer("quality")}/>
      <div className="studio-content-wrap"><ResearchFilterBar/>
        <div className="studio-scope-caption"><span><ResearchIcon name="info" size={14}/> {participantLabel(data.selectedParticipant, labels)} · {data.selectedTask === "ALL" ? "全部現行任務" : researchTaskLabel(data.selectedTask)}</span><span>研究與教育用途 · 不作臨床診斷</span></div>
        {data.excludedCount > 0 && <p className="studio-excluded-note">已排除 {data.excludedCount} 筆非現行任務紀錄；原始資料保留。</p>}
        {data.notices.length > 0 && <ResearchNotice tone="warning">{data.notices.join(" ")}</ResearchNotice>}
        <div id="research-studio-content" tabIndex={-1} className="studio-content">{children}</div>
        <footer className="studio-footer"><span>蒐秘密 Research Studio</span><span>觀察關聯、模型預測與模擬回饋均不代表因果效果。</span></footer>
      </div>
    </div>
    {drawer === "navigation" && <ResearchDrawer title="研究導覽" onClose={closeDrawer}><ResearchSidebar tools={tools} activeTool={activeTool} onSelect={closeDrawer} onSecondary={secondary} mobile/></ResearchDrawer>}
    {drawer === "quality" && <ResearchDrawer title="資料品質詳情" onClose={closeDrawer}><p className="studio-muted">依目前參與者與任務範圍；以下數量的單位為任務場次，非參與者。</p><div className="studio-kpi-grid two"><MetricCard label="任務場次" value={quality.taskSessionCount}/><MetricCard label="已完成場次" value={quality.completedCount}/><MetricCard label="核心指標缺漏" value={quality.missingCount} tone="amber"/><MetricCard label="排除題次" value={quality.excludedTrialCount ?? "—"} detail="沿用來源排除標記" tone="amber"/></div><ResearchAlerts alerts={alerts}/>
      <h3>缺漏欄位</h3><dl className="studio-detail-list">{["accuracy", "rt_mean", "rt_variability_ms"].map((key) => <div key={key}><dt>{key}</dt><dd>{rows.filter((row) => !isResearchNumber(row[key])).length} 筆未記錄</dd></div>)}</dl>
      <h3>既有排除原因</h3><dl className="studio-detail-list">{Object.entries(rows.reduce((counts, row) => { Object.entries(row.exclusion_reason_counts || {}).forEach(([reason, count]) => { counts[reason] = (counts[reason] || 0) + Number(count); }); return counts; }, {})).map(([reason, count]) => <div key={reason}><dt>{reason}</dt><dd>{count} 題次</dd></div>)}</dl>
      <ResearchNotice>非現行任務紀錄：{data.excludedCount} 筆。這是研究入口的任務範圍排除，與題次品質排除分開計數。</ResearchNotice><p>缺失欄位保持「—」。未施測不視為錯誤作答；各指標可用樣本數可能不同。</p></ResearchDrawer>}
    {drawer === "games" && <ResearchDrawer title="遊戲規則與收集資料" onClose={closeDrawer}><ResearchTaskGuide/></ResearchDrawer>}
    {drawer === "methods" && <ResearchDrawer title="研究方法與指標說明" onClose={closeDrawer}><h3>資料到研究解讀</h3><p>原始題次 → 清理與特徵 → 統計與個人趨勢 → 模型解釋 → 推薦歷程。完整 UUID 可於參與者識別詳情查看，匯出仍使用原本研究代碼。</p><h3>指標與比較</h3><p>正確率與錯誤率顯示百分比；RT 與 RT SD 顯示毫秒；正確率變化使用百分點。個人基準只作同任務與條件的描述性比較，不是常模或臨床正常範圍。</p><h3>模型與模擬</h3><p>觀察模型沿用至少 20 位具有預測目標的參與者條件。資料準備進度只反映人數，不是預測準確率。既有模型以前 30% 題次預測同任務後 70% 的行為表現。</p><p>策略模擬使用既有 Reward 與原本演算法；回饋不等於幼兒訓練成效。尚無 24 小時疾病風險或臨床危急值監測。</p><h3>顯示代碼</h3><p>P 編號只作介面識別，對應關係保留於本機瀏覽器；不改變既有匿名化、權限與研究資料。清除瀏覽器儲存或更換裝置時，應以 UUID 核對。</p><h3>資料匯出</h3><p>研究總覽保留原有 CSV／JSON 與版本清單；研究統計仍提供原有 4 份 CSV。介面排序及搜尋只改變可見順序，不改寫輸出。</p></ResearchDrawer>}
  </div>;
}

export function ResearchSidebar({ tools, activeTool, collapsed = false, onToggle, onSelect, onSecondary, mobile = false }) {
  const data = useResearchWorkspace(); const navigate = useNavigate();
  function keyboard(event, index) { const next = ["ArrowDown", "ArrowRight"].includes(event.key) ? (index + 1) % tools.length : ["ArrowUp", "ArrowLeft"].includes(event.key) ? (index + tools.length - 1) % tools.length : event.key === "Home" ? 0 : event.key === "End" ? tools.length - 1 : null;
    if (next == null) return; event.preventDefault(); data.openTool(tools[next].id); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus(); }
  return <aside className={`studio-sidebar ${mobile ? "is-mobile" : ""}`} aria-label="研究側邊導覽"><div className="studio-brand"><img className="studio-brand-logo" src={`${process.env.PUBLIC_URL}/logo192.webp`} alt="蒐秘密遊戲 Logo" width="44" height="44"/><div className={collapsed ? "studio-sr-only" : ""}><strong>蒐秘密</strong><span>Research Studio</span></div></div>
    <div className="studio-nav-caption" aria-hidden="true">{collapsed ? "研究" : "研究分析"}</div><nav role="tablist" aria-orientation="vertical" aria-label="研究工具">{tools.map((tool, index) => <button type="button" role="tab" key={tool.id} id={`research-tool-${tool.id}${mobile ? "-mobile" : ""}`} aria-controls={`research-panel-${tool.id}`} aria-selected={activeTool === tool.id} tabIndex={activeTool === tool.id ? 0 : -1} title={collapsed ? tool.label : undefined} onClick={() => { data.openTool(tool.id); onSelect?.(); }} onKeyDown={(event) => keyboard(event, index)}><ResearchIcon name={tool.id}/><span className={collapsed ? "studio-sr-only" : "studio-nav-label"}>{tool.label}</span></button>)}</nav>
    <div className="studio-nav-caption" aria-hidden="true">{collapsed ? "工具" : "資料與方法"}</div><div className="studio-secondary-nav">{[["quality", "資料品質"], ["exports", "研究資料匯出"], ["methods", "研究方法與指標說明"]].map(([id, label]) => <button key={id} type="button" title={collapsed ? label : undefined} onClick={() => onSecondary(id)}><ResearchIcon name={id === "exports" ? "export" : id}/><span className={collapsed ? "studio-sr-only" : "studio-nav-label"}>{label}</span></button>)}</div>
    {collapsed ? <div className="studio-secondary-nav studio-guide-shortcut"><button type="button" title="遊戲規則與收集資料" aria-label="遊戲規則與收集資料" onClick={() => onSecondary("games")}><ResearchIcon name="methods"/></button></div> : <ResearchTaskGuide sidebar/>}
    <div className="studio-sidebar-bottom"><button type="button" title="返回醫療首頁" onClick={() => navigate("/clinician-dashboard")}><ResearchIcon name="back"/><span className={collapsed ? "studio-sr-only" : ""}>返回醫療首頁</span></button>{!mobile && <button type="button" onClick={onToggle} aria-label={collapsed ? "展開側邊導覽" : "收合側邊導覽"} aria-expanded={!collapsed}><ResearchIcon name="collapse"/><span className={collapsed ? "studio-sr-only" : ""}>收合導覽</span></button>}</div>
  </aside>;
}

export function ResearchHeader({ tool, quality, loading, onMenu, onQuality }) {
  const navigate = useNavigate();
  return <header className="studio-header"><div className="studio-header-title"><button type="button" className="studio-mobile-menu" aria-label="開啟研究導覽" onClick={onMenu}><ResearchIcon name="menu"/></button><div><div className="studio-breadcrumb">Research Studio <span>/</span> {tool.english}</div><h1>{tool.label}</h1></div></div>
    <div className="studio-header-actions"><button type="button" className="studio-quality-trigger" onClick={onQuality} aria-label="開啟資料品質詳情"><StatusIndicator tone={quality.missingCount || quality.incompleteCount ? "warning" : "info"}>{loading ? "資料載入中" : quality.missingCount || quality.incompleteCount ? "資料待核對" : "資料品質"}</StatusIndicator></button><ResearchThemeToggle/><button type="button" title="返回醫療首頁" aria-label="回醫療主頁" onClick={() => navigate("/clinician-dashboard")}><ResearchIcon name="back"/></button><span className="studio-user"><span>R</span><span>專業研究端</span></span></div>
  </header>;
}

export function ResearchFilterBar() {
  const data = useResearchWorkspace(); const labels = useParticipantLabels();
  const [expanded, setExpanded] = useState(() => window.matchMedia?.("(min-width: 768px)").matches ?? true);
  useEffect(() => { const media = window.matchMedia?.("(min-width: 768px)"); const change = (event) => setExpanded(event.matches); media?.addEventListener?.("change", change); return () => media?.removeEventListener?.("change", change); }, []);
  return <section className="studio-filter-bar" aria-label="共用分析範圍"><button className="studio-filter-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><ResearchIcon name="adaptive"/>分析範圍 {expanded ? "收合" : "展開"}</button>
    <div className="studio-filter-body" hidden={!expanded}><label>研究參與者<select aria-label="匿名參與者" value={data.selectedParticipant} disabled={data.loading} onChange={(event) => data.setSelectedParticipant(event.target.value)}>{!data.participants.length && <option value="">尚無參與者</option>}<option value="ALL">全部參與者</option>{data.participants.map((id) => <option key={id} value={id}>{participantLabel(id, labels)}</option>)}</select></label>
      <label>研究任務<select aria-label="任務" value={data.selectedTask} onChange={(event) => data.setSelectedTask(event.target.value)}><option value="ALL">全部現行任務</option>{RESEARCH_TASKS.map((task) => <option key={task} value={task}>{researchTaskLabel(task)}</option>)}</select></label>
      <div className="studio-filter-note"><span>跨功能保留範圍</span><small>AI 以所選任務的全體資料建模；個別解釋依參與者篩選。</small></div><button type="button" className="studio-refresh" disabled={data.loading} onClick={data.refresh}><ResearchIcon name="refresh" size={16}/>重新整理資料</button>
    </div>{data.selectedParticipant && data.selectedParticipant !== "ALL" && <details className="studio-id-details"><summary>參與者識別詳情</summary><ParticipantLabel id={data.selectedParticipant}/><code>{data.selectedParticipant}</code><small>顯示編號對應本機瀏覽器；研究 UUID 與匯出保持原值。</small></details>}
  </section>;
}
