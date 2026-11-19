import { compareRecords, describeRecord, recordConditions } from "../../utils/professionalMetrics";
import { formatAccuracy, formatDateTime, formatDifficulty, formatReactionTime } from "../../utils/professionalFormatters";
import { TaskMetricDetail } from "./ProfessionalData";

// UI density rule only. Three observations do not establish statistical adequacy.
export function largestComparableCount(records = []) {
  const groups = new Map();
  records.forEach((r) => {
    if (!compareRecords(r, r).comparable) return;
    const key = JSON.stringify([r.patientId || null, r.participantId || null, recordConditions(r)]);
    groups.set(key, (groups.get(key) || 0) + 1);
  });
  return records.length ? Math.max(1, ...groups.values()) : 0;
}
export function ObservationResults({ observations = [], comparableCount = observations.length, onOpen }) {
  return <div className="professional-observations"><h4>{!observations.length ? "尚無符合條件的有效紀錄" : observations.length === 1 ? "單次結果" : comparableCount === 2 ? "兩次結果比較・描述性資料" : "描述性紀錄・條件分列"}</h4>
    {observations.length > 1 && <p>尚無三筆條件一致的有效紀錄；不呈現大型趨勢圖，也不判定穩定趨勢。</p>}
    <div className="professional-observation-grid">{observations.map((item, index) => { const r = item.record, d = r ? describeRecord(r) : null; return <article key={r?.id || index}><time>{formatDateTime(item.date || r?.date)}</time><p>{r?.type === "training" ? "訓練" : r?.type === "test" || r?.type === "assessment" ? "正式測驗" : item.mode || "模式未記錄"}｜{formatDifficulty(r?.difficulty || item.difficulty, r?.gameKey)}</p>
      <strong>{item.value || (d ? formatAccuracy(d.correct, d.total) : "未記錄")}</strong>{d && <p>有效 RT {formatReactionTime(d.rtMean, { n: d.rtN })}</p>}
      {onOpen ? <button type="button" onClick={() => onOpen(item)}>查看詳細</button> : r && <details><summary>查看詳細</summary><TaskMetricDetail record={r}/><details><summary>原始來源</summary><pre>{JSON.stringify(r.raw || r, null, 2)}</pre></details></details>}
    </article>; })}</div></div>;
}
