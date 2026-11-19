import { useState } from "react";
import { describeRecord } from "../../utils/professionalMetrics";
import { formatAccuracy, formatDateTime, formatDifficulty, formatNumber, formatReactionTime } from "../../utils/professionalFormatters";
import { DataStatus } from "./ProfessionalData";

export function ProfessionalRecords({ records, selectedIds, onToggle, onOpen, onExport, exportingId }) {
  const [extra, setExtra] = useState(false);
  const checkbox = (r) => <input type="checkbox" aria-label={`選取 ${r.gameName} ${formatDateTime(r.date)}`} checked={selectedIds.includes(r.id)} onChange={() => onToggle(r.id)}/>;
  const actions = (r) => <div className="professional-record-actions">{checkbox(r)}<button type="button" onClick={() => onOpen(r)}>查看詳細</button><button type="button" disabled={exportingId === r.id} onClick={() => onExport(r)}>{exportingId === r.id ? "匯出中…" : "Excel"}</button></div>;
  const type = (r) => r.type === "test" ? "測驗" : r.type === "training" ? "訓練" : "類型未記錄";
  const status = (r, d) => {
    const sources = [r.raw?.payload?.rawResult, r.raw?.payload?.session, r.raw?.rawResult, r.raw].filter(Boolean);
    const rawStatus = sources.map((v) => v.status || v.completionStatus || v.completion_status).find(Boolean);
    const label = d.integrityError ? "來源待確認" : !d.complete && rawStatus ? "未完成" : d.status.tone === "success" ? "✓ 通過" : d.status.label;
    const planned = sources.map((v) => v.plannedTotalRounds ?? v.plannedTrialCount ?? v.protocol?.totalTrials).find((v) => v != null);
    return <><DataStatus compact tone={d.integrityError ? "warning" : d.status.tone}>{label}</DataStatus>{!d.complete && planned != null && <small> {d.recordedTrials}／{planned} 題已記錄</small>}</>;
  };
  return <div className="professional-records"><details className="professional-record-options"><summary>欄位設定</summary><label><input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)}/>顯示能力、原始分數、星級與資料來源</label><p>完整難度、原始 Trial 與 JSON 保留於「查看詳細」。部分給分於作業指標另列，不換算成答對題數。</p></details>
    <table className="professional-record-desktop"><thead><tr>{["日期", "任務", "模式", "難度", "正確率／有效題數", "有效 RT", "狀態", "操作", ...(extra ? ["能力", "原始分數", "星級", "資料來源"] : [])].map((v) => <th key={v} scope="col">{v}</th>)}</tr></thead><tbody>{records.map((r, index) => { const d = describeRecord(r); return <tr key={`${r.id}-${index}`}><td><time>{formatDateTime(r.date)}</time></td><td>{r.gameName}</td><td>{type(r)}</td><td title={String(r.difficulty || "未記錄")}>{formatDifficulty(r.difficulty, r.gameKey)}</td><td className="professional-nowrap">{formatAccuracy(d.correct, d.total)}</td><td className="professional-nowrap">{formatReactionTime(d.rtMean, { n: d.rtN })}</td><td>{status(r,d)}</td><td>{actions(r)}</td>{extra && <><td>{r.ability || "未記錄"}</td><td>{formatNumber(r.score)}</td><td>{formatNumber(r.stars, 0)}</td><td>{r.sourceTable}</td></>}</tr>; })}</tbody></table>
    <div className="professional-record-mobile">{records.map((r,index) => { const d=describeRecord(r); return <article key={`${r.id}-${index}`}><header><strong>{r.gameName}</strong>{status(r,d)}</header><p>{formatDateTime(r.date)}｜{type(r)}｜{formatDifficulty(r.difficulty, r.gameKey)}</p><p>正確率 {formatAccuracy(d.correct,d.total)}<br/>有效 RT {formatReactionTime(d.rtMean,{n:d.rtN})}</p>{extra && <p>{r.ability}｜分數 {formatNumber(r.score)}｜星級 {formatNumber(r.stars,0)}｜{r.sourceTable}</p>}<footer>{actions(r)}</footer></article>; })}</div>
  </div>;
}
