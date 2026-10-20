import { createContext, useContext, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RESEARCH_METRICS, researchDate, researchNumber, validMetric } from "../../utils/researchPresentation";
import "../../styles/ResearchClinicalTheme.css";

const ResearchPageContext = createContext(false);
const ResearchThemeContext = createContext(null);
export function ResearchThemeToggle() { const display = useContext(ResearchThemeContext); return display ? <button type="button" aria-label="暗色模式" title="切換亮色／暗色模式" aria-pressed={display.theme === "dark"} onClick={display.toggleTheme}>暗色模式</button> : null; }

function initialTheme() {
  try { const saved = localStorage.getItem("research-display-theme"); if (["light", "dark"].includes(saved)) return saved; } catch { /* Storage is optional. */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ResearchPage({ className, children, hideToolbar = false }) {
  const embedded = useContext(ResearchPageContext);
  const [theme, setTheme] = useState(initialTheme);
  function toggleTheme() { const next = theme === "dark" ? "light" : "dark"; setTheme(next); try { localStorage.setItem("research-display-theme", next); } catch { /* Storage is optional. */ } }
  if (embedded) return <section className={`${className} research-embedded`}>{children}</section>;
  return <ResearchPageContext.Provider value={true}><ResearchThemeContext.Provider value={{ theme, toggleTheme }}><main className={className} data-research-theme={theme}>
    {!hideToolbar && <div className="research-display-toolbar"><span>醫療研究與分析工具</span><ResearchThemeToggle/></div>}
    {children}
  </main></ResearchThemeContext.Provider></ResearchPageContext.Provider>;
}

/** Only explicitly validated clinical rules may produce a critical alert. */
export function ResearchAlerts({ alerts = [] }) {
  const [acknowledged, setAcknowledged] = useState({});
  const sorted = [...alerts].map((alert) => ({ ...alert, severity: alert.severity === "critical" && !(alert.validatedClinicalRule && alert.ruleId && alert.ruleVersion && alert.thresholdLabel && alert.observationVersion) ? "warning" : alert.severity }))
    .sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] ?? 2) - ({ critical: 0, warning: 1, info: 2 }[b.severity] ?? 2));
  return <section className="research-review" aria-label="警示與資料品質">
    <div className="research-review-heading"><h2>警示與資料品質</h2><span>{sorted.some((alert) => alert.severity === "critical") ? "危急警示依已驗證規則呈現" : "臨床危急值監測：尚未啟用"}</span></div>
    {!sorted.length && <p>目前沒有資料品質提示。行為表現不作為臨床危急值判定。</p>}
    {sorted.map((alert) => { const key = JSON.stringify([alert.id, alert.ruleId, alert.ruleVersion, alert.observationVersion, alert.message]); const critical = alert.severity === "critical"; return <article key={key} className={`research-alert research-alert-${alert.severity}`} role={critical && !acknowledged[key] ? "alert" : "status"}>
      <strong><span aria-hidden="true">{critical ? "!" : alert.severity === "warning" ? "△" : "i"}</span> {critical ? "危急警示" : alert.severity === "warning" ? "待核對" : "資訊"} · {alert.title}</strong><p>{alert.message}</p>
      {critical && <><p>判定規則：{alert.thresholdLabel} · {alert.ruleId} / {alert.ruleVersion}</p><button type="button" disabled={Boolean(acknowledged[key])} onClick={() => setAcknowledged((current) => ({ ...current, [key]: true }))}>{acknowledged[key] ? "本頁已確認" : "確認危急警示"}</button><small>確認僅記錄於本頁，不代表處置完成或已寫入醫療紀錄。</small></>}
    </article>; })}
  </section>;
}

export function ResearchHandoff({ context, taskLabel }) {
  const mode = { assessment: "測驗", training: "訓練" }[context.latest?.assessment_or_training] || "未記錄類型";
  return <section className="research-handoff" aria-label="資料摘要"><h2>資料摘要 · {taskLabel}</h2>
    {!context.latest ? <p>尚無此任務的觀察資料。</p> : <><p>{mode} · 難度 {context.latest.difficulty ?? "未記錄"} · 最近紀錄 {researchDate(context.latest.session_started_at || context.latest.started_at)}。僅比較同一參與者、任務、類型與難度；未記錄的條件無法確認一致性。</p>
      <ul>{context.metrics.map((item) => { const definition = RESEARCH_METRICS[item.metric]; const change = item.absolute_change; return <li key={item.metric}><strong>{definition.label}</strong>：最新 {definition.format(item.latest_value)}{definition.unit === "ms" ? " ms" : ""}；個人基準 {definition.format(item.baseline_value)}{definition.unit === "ms" ? " ms" : ""}（{researchDate(item.baseline_date)}）。{change === null ? "可比較資料不足，暫不判讀變化。" : `較基準${change > 0 ? "增加" : change < 0 ? "減少" : "持平"}${change === 0 ? "" : ` ${researchNumber(Math.abs(change) * (definition.unit === "%" ? 100 : 1), 1)} ${definition.unit === "%" ? "個百分點" : "ms"}`}；共 ${item.observation_count} 筆有效觀察。`}</li>; })}</ul>
      <p className="research-caption">依現有觀察資料自動整理；未包含用藥或生理數據。AI 行為預測的時間範圍依研究目標定義，尚未提供未來 24 小時臨床風險預測。</p></>}
  </section>;
}

export function ResearchTrendChart({ data = [], metric, rolling, title }) {
  const definition = RESEARCH_METRICS[metric];
  const chartData = data.map((row, index) => ({ ...row, session_number: index + 1, [metric]: validMetric(row[metric], metric) ? Number(row[metric]) : null,
    ...(rolling ? { [rolling]: validMetric(row[rolling], metric) ? Number(row[rolling]) : null } : {}) }));
  const baseline = chartData.find((row) => row[metric] !== null);
  return <article className="research-trend"><h3>{title || definition.label}</h3>
    {baseline ? <><div role="img" aria-label={`${title || definition.label}，單位 ${definition.unit}；以首筆有效觀察作為個人基準。`}><ResponsiveContainer width="100%" height={260}><LineChart data={chartData} margin={{ top: 10, right: 24, bottom: 10, left: 5 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--research-border)"/><XAxis dataKey="session_number" name="場次" tick={{ fill: "var(--research-muted)" }}/>
      <YAxis domain={definition.unit === "%" ? [0, 1] : [0, "auto"]} tickFormatter={definition.unit === "%" ? (value) => `${Math.round(value * 100)}%` : undefined} unit={definition.unit === "ms" ? " ms" : undefined} width={85} tick={{ fill: "var(--research-muted)" }}/>
      <Tooltip labelFormatter={(value, payload) => `第 ${value} 場 · ${researchDate(payload?.[0]?.payload?.session_started_at)}`} formatter={(value, name) => [`${definition.format(value)}${definition.unit === "ms" ? " ms" : ""}`, name]} contentStyle={{ background: "var(--research-card)", borderColor: "var(--research-border)", color: "var(--research-ink)" }}/><Legend/>
      <ReferenceLine y={baseline[metric]} stroke="var(--research-muted)" strokeDasharray="5 5"/>
      <Line type="linear" dataKey={metric} name="觀察值" stroke="var(--research-chart-observed)" strokeWidth={2} connectNulls={false} isAnimationActive={false}/>
      {rolling && <Line type="linear" dataKey={rolling} name="移動平均（3 場）" stroke="var(--research-chart-secondary)" strokeDasharray="6 3" connectNulls={false} isAnimationActive={false}/>}
    </LineChart></ResponsiveContainer></div><p className="research-caption">X 軸：時間排序場次；Y 軸：{definition.label}（{definition.unit}）。來源：目前選取範圍內同條件的 {chartData.filter((row) => row[metric] !== null).length} 筆有效觀察。虛線：個人基準 {definition.format(baseline[metric])}{definition.unit === "ms" ? " ms" : ""}（{researchDate(baseline.session_started_at)}）。缺失值保留缺口；基準不代表臨床正常範圍。</p></> : <p>尚無有效的{definition.label}觀察資料。</p>}
  </article>;
}
