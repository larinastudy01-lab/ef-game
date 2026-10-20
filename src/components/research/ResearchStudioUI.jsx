import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { researchDate, researchNumber, researchPercent } from "../../utils/researchPresentation";
import { assignParticipantLabels, participantLabel, RESEARCH_EVENT_LABELS } from "../../utils/researchStudioPresentation";
import { researchTaskLabel } from "../../config/researchTasks";

const IdentityContext = createContext({});
export function ResearchIdentityProvider({ participants, children }) {
  const [stored, setStored] = useState(() => { try { const saved = JSON.parse(localStorage.getItem("research-participant-labels") || "{}"); return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {}; } catch { return {}; } });
  const mapping = useMemo(() => assignParticipantLabels(participants, stored), [participants, stored]);
  useEffect(() => { if (mapping !== stored) { setStored(mapping); try { localStorage.setItem("research-participant-labels", JSON.stringify(mapping)); } catch { /* Labels still work in memory. */ } } }, [mapping, stored]);
  return <IdentityContext.Provider value={mapping}>{children}</IdentityContext.Provider>;
}
export const useParticipantLabels = () => useContext(IdentityContext);
export function ParticipantLabel({ id }) { const mapping = useParticipantLabels(); return <span title={id || undefined}>{participantLabel(id, mapping)}</span>; }

const ICONS = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  statistics: "M4 20V10 M10 20V4 M16 20v-8 M22 20H2", ai: "M9 4a3 3 0 0 0-5 3 4 4 0 0 0-1 7 4 4 0 0 0 6 5 M15 4a3 3 0 0 1 5 3 4 4 0 0 1 1 7 4 4 0 0 1-6 5 M12 3v18 M7 8l5 3 5-3 M7 16l5-3 5 3",
  adaptive: "M4 6h16 M4 18h16 M8 3v6 M16 15v6 M4 12h16 M14 9v6", longitudinal: "M3 18l5-6 5 3 8-11 M3 3v18h18",
  quality: "M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M8 12l3 3 5-6", export: "M12 3v12 M8 11l4 4 4-4 M4 16v5h16v-5",
  methods: "M4 3h6c2 0 2 2 2 2s0-2 2-2h6v17h-6c-2 0-2 1-2 1s0-1-2-1H4z M12 5v16",
  back: "M10 5l-7 7 7 7 M3 12h18", menu: "M3 6h18 M3 12h18 M3 18h18", close: "M5 5l14 14 M19 5L5 19",
  collapse: "M14 5l-7 7 7 7 M21 3v18", settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  refresh: "M20 7a9 9 0 1 0 1 9 M20 3v5h-5", info: "M12 16v-5 M12 7v1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  users: "M16 21v-3c0-4-12-4-12 0v3 M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M18 4a4 4 0 0 1 0 8 M20 15c3 1 3 3 3 6",
  check: "M5 12l4 4L20 5", warning: "M12 3L2 21h20z M12 9v5 M12 17v1", calendar: "M4 5h16v16H4z M7 2v6 M17 2v6 M4 10h16",
};
export function ResearchIcon({ name, size = 20 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name] || ICONS.info}/></svg>; }
export function StatusIndicator({ tone = "info", children }) { return <span className={`studio-status studio-status-${tone}`}><ResearchIcon name={tone === "success" ? "check" : tone === "warning" || tone === "error" ? "warning" : "info"} size={14}/>{children}</span>; }
export function PageHeader({ eyebrow, title, description, actions }) { return <header className="studio-page-header"><div>{eyebrow && <span className="studio-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="studio-actions">{actions}</div>}</header>; }
export function SectionHeader({ title, description, actions }) { return <div className="studio-section-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="studio-actions">{actions}</div>}</div>; }
export function MetricCard({ label, value, detail, icon = "statistics", tone = "blue" }) { return <article className={`studio-metric studio-metric-${tone}`}><div><span>{label}</span><ResearchIcon name={icon}/></div><strong>{value ?? "—"}</strong>{detail && <small>{detail}</small>}</article>; }
export function ResearchNotice({ children, tone = "info" }) { return <div className={`studio-notice studio-notice-${tone}`}><ResearchIcon name={tone === "warning" || tone === "error" ? "warning" : "info"} size={18}/><div>{children}</div></div>; }
export function EmptyState({ title = "尚無可用資料", description, action }) { return <div className="studio-empty"><span><ResearchIcon name="statistics" size={28}/></span><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>; }
export function LoadingState({ label = "正在載入研究資料…" }) { return <div className="studio-loading" role="status"><span>{label}</span><div className="studio-skeleton-grid" aria-hidden="true">{[1, 2, 3, 4].map((item) => <div key={item}/>)}</div><div className="studio-skeleton-chart" aria-hidden="true"/></div>; }
export function ModelStatusCard({ count, required = 20, result, error, demo = false }) {
  const status = error ? "發生錯誤" : demo ? "模擬預覽" : result ? "可使用 · 研究模型" : "資料不足";
  return <section className="studio-card studio-model-status"><SectionHeader title="模型狀態與資料準備度" actions={<StatusIndicator tone={error ? "error" : demo || !result ? "warning" : "success"}>{status}</StatusIndicator>}/>
    <div className="studio-model-status-grid"><div><strong>{result?.model_name || "觀察模型尚未建置"}</strong><p>{result?.target_definition || "以前 30% 題次預測同任務後 70% 題次的正確率"}</p><small>模型版本：{result?.model_version || "尚未提供"}</small></div><div><label htmlFor="research-model-readiness">真實資料準備度 · 人數條件</label><div className="studio-readiness"><strong>{count}</strong><span>/ {required} 位參與者</span></div><progress id="research-model-readiness" aria-label="模型資料準備進度" value={Math.min(count, required)} max={required}/><small>{count < required ? `尚缺 ${required - count} 位具有預測目標的參與者` : "已達人數門檻；實際可訓練性仍依原本模型流程判定"}。這不是模型準確率。</small></div></div>
    {demo && <ResearchNotice tone="warning">目前顯示模擬模型；上方進度仍描述真實資料，兩者分開呈現。</ResearchNotice>}{error && <ResearchNotice tone="error">模型分析失敗：{error}</ResearchNotice>}
  </section>;
}
export function ChartContainer({ title, description, count, countLabel = "筆觀察", unit, source, children, empty = false }) { const id = useId(); return <section className="studio-card studio-chart" aria-labelledby={id}><SectionHeader title={<span id={id}>{title}</span>} description={description}/><div className="studio-chart-meta"><span>{count != null ? `${count} ${countLabel}` : "依可用觀察資料"}</span>{unit && <span>單位：{unit}</span>}{source && <span>{source}</span>}</div>{empty ? <EmptyState description="目前範圍沒有可繪製的數值；不會自動補值。"/> : children}</section>; }

export function ResearchDataTable({ title, columns, rows, getKey, pageSize = 15, searchable = true }) {
  const [query, setQuery] = useState(""); const [sort, setSort] = useState({ key: "", direction: 1 }); const [page, setPage] = useState(0);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const selected = rows.map((row, index) => ({ row, index })).filter(({ row }) => !needle || columns.some((column) => String(column.searchValue ? column.searchValue(row) : row[column.key] ?? "").toLocaleLowerCase().includes(needle)));
    const column = columns.find((item) => item.key === sort.key);
    if (column) selected.sort((left, right) => { const a = column.sortValue ? column.sortValue(left.row) : left.row[column.key]; const b = column.sortValue ? column.sortValue(right.row) : right.row[column.key];
      if (a == null) return b == null ? left.index - right.index : 1; if (b == null) return -1;
      return sort.direction * (column.numeric ? Number(a) - Number(b) : String(a).localeCompare(String(b), "zh-Hant", { numeric: true })) || left.index - right.index; });
    return selected;
  }, [rows, columns, query, sort]);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize)); const currentPage = Math.min(page, pages - 1);
  return <div className="studio-data-table"><div className="studio-table-tools">{searchable && <label>搜尋<span className="studio-sr-only">{title}</span><input type="search" aria-label={`${title}搜尋`} placeholder="搜尋資料…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }}/></label>}<span>{visible.length} / {rows.length} 筆</span></div>
    <div className="studio-table-scroll" tabIndex={0} role="region" aria-label={`${title}表格`}><table><caption className="studio-sr-only">{title}</caption><thead><tr>{columns.map((column) => <th key={column.key} scope="col" className={column.numeric ? "numeric" : ""} aria-sort={sort.key === column.key ? sort.direction === 1 ? "ascending" : "descending" : "none"}><button type="button" onClick={() => { setSort((current) => ({ key: column.key, direction: current.key === column.key ? -current.direction : 1 })); setPage(0); }}>{column.label}<span aria-hidden="true">{sort.key === column.key ? sort.direction === 1 ? " ↑" : " ↓" : " ↕"}</span></button></th>)}</tr></thead><tbody>
      {visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(({ row, index }) => <tr key={getKey ? getKey(row, index) : index}>{columns.map((column) => <td key={column.key} className={column.numeric ? "numeric" : ""}>{column.render ? column.render(row) : row[column.key] ?? "—"}</td>)}</tr>)}
      {!visible.length && <tr><td colSpan={columns.length}><EmptyState title="沒有符合條件的資料" description={query ? "請調整搜尋文字。" : "調整分析範圍後再試。"}/></td></tr>}
    </tbody></table></div><div className="studio-pagination"><span>第 {currentPage + 1} / {pages} 頁</span><div><button type="button" aria-label={`${title}上一頁`} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一頁</button><button type="button" aria-label={`${title}下一頁`} disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>下一頁</button></div></div></div>;
}

export function ResearchDrawer({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; const panel = ref.current; panel?.focus();
    function keydown(event) { if (event.key === "Escape") { event.preventDefault(); onClose(); } if (event.key !== "Tab") return;
      const items = [...panel.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"],summary')].filter((item) => !item.closest("[hidden]") && (!item.closest("details:not([open])") || item.tagName === "SUMMARY"));
      if (!items.length) { event.preventDefault(); return; } const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus(); }
    } panel?.addEventListener("keydown", keydown); return () => { panel?.removeEventListener("keydown", keydown); previous?.focus(); }; }, [onClose]);
  const id = useId();
  return <div className="studio-drawer-backdrop" onClick={onClose}><section ref={ref} className="studio-drawer" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} onClick={(event) => event.stopPropagation()}><header><h2 id={id}>{title}</h2><button type="button" aria-label={`關閉${title}`} onClick={onClose}><ResearchIcon name="close"/></button></header><div className="studio-drawer-body">{children}</div></section></div>;
}

export function TrialDetails({ input }) {
  if (!input) return <EmptyState title="未提供題次資料"/>;
  const columns = [ { key: "trial_index", label: "題次", numeric: true }, { key: "is_correct", label: "作答", render: (row) => row.is_correct == null ? "—" : row.is_correct ? "正確" : "錯誤" },
    { key: "reaction_time_ms", label: "RT（ms）", numeric: true, render: (row) => researchNumber(row.reaction_time_ms, 1) }, { key: "valid_trial", label: "分析狀態", render: (row) => row.valid_trial === false ? "已排除" : row.valid_trial === true ? "可用" : "未標記" },
    { key: "exclusion_reasons", label: "排除原因", render: (row) => (row.exclusion_reasons || []).join("、") || "—" },
    { key: "details", label: "原始與衍生資料", render: (row) => { const raw = input.rawTrials?.find((item) => item.trial_index === row.trial_index); return <details><summary>檢視資料</summary><pre>{JSON.stringify({ acquisition: raw || null, derivation: row }, null, 2)}</pre></details>; } } ];
  return <><ResearchNotice>以下僅檢視既有題次資料，不修改採集內容或排除規則。</ResearchNotice><ResearchDataTable title="題次紀錄" columns={columns} rows={input.trials || []}/></>;
}

export function ResearchTimeline({ events = [], inputs = [], limit = 8 }) {
  const [expanded, setExpanded] = useState(false); const [selected, setSelected] = useState(null); const close = () => setSelected(null);
  const ordered = [...events].reverse(); const visible = expanded ? ordered : ordered.slice(0, limit);
  return <>{!events.length ? <EmptyState title="尚無研究事件" description="目前分析範圍沒有已記錄的事件。"/> : <ol className="studio-timeline">{visible.map((event) => <li key={event.event_id}><span className="studio-timeline-dot"><ResearchIcon name={event.event_type === "Recommendation" ? "adaptive" : "calendar"} size={16}/></span><div><time>{researchDate(event.occurred_at)}</time><strong>{RESEARCH_EVENT_LABELS[event.event_type] || event.event_type}</strong><p>{event.task_code ? researchTaskLabel(event.task_code) : "研究場次"}{event.difficulty != null ? ` · 難度 ${event.difficulty}` : ""}{event.accuracy != null ? ` · 正確率 ${researchPercent(event.accuracy)}` : ""}</p></div><button type="button" onClick={() => setSelected(event)}>詳情<span className="studio-sr-only"> {researchDate(event.occurred_at)} {RESEARCH_EVENT_LABELS[event.event_type]} {event.task_code}</span></button></li>)}</ol>}
    {events.length > limit && <button type="button" className="studio-text-button" onClick={() => setExpanded((value) => !value)}>{expanded ? "收合紀錄" : `顯示全部 ${events.length} 筆事件`}</button>}
    {selected && <ResearchDrawer title="研究事件詳情" onClose={close}><dl className="studio-detail-list">{Object.entries(selected).filter(([, value]) => value != null).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl><h3>題次紀錄</h3><TrialDetails input={inputs.find((input) => input.taskSession?.id === selected.task_session_id)}/></ResearchDrawer>}
  </>;
}
