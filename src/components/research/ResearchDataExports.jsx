import { useMemo } from "react";
import { buildReadableResearchExport } from "../../analytics/researchDashboard/readableExports";
import { downloadResearchFile } from "../../analytics/researchDashboard";
import { ResearchDataTable } from "./ResearchStudioUI";

const display = (value) => value == null ? "—" : typeof value === "boolean" ? value ? "是" : "否" : typeof value === "object" ? JSON.stringify(value) : String(value);

export function ResearchDataExports({ inputs, taskRows, exportBundle }) {
  const readable = useMemo(() => buildReadableResearchExport({ inputs, taskRows }), [inputs, taskRows]);
  const columns = readable.trials.columns.map((column) => ({ ...column,
    numeric: ["trial_index", "reaction_time_ms"].includes(column.key),
    render: (row) => column.key === "is_correct" ? row.is_correct == null ? "—" : row.is_correct ? "正確" : "錯誤" : display(row[column.key]),
  }));
  return <>
    <p>{readable.trials.rows.length} 筆原始題次 · {readable.summary.rows.length} 筆作業場次</p>
    <div className="rpd-downloads studio-primary-exports">{Object.entries(readable.files).map(([name, contents]) => <button type="button" key={name}
      disabled={name === "逐題作答資料.csv" ? !readable.trials.rows.length : name === "場次摘要.csv" ? !taskRows.length : false}
      onClick={() => downloadResearchFile(name, `\uFEFF${contents}`)}>{name.replace(".csv", "")}（CSV）</button>)}</div>
    <details className="studio-advanced studio-trial-preview"><summary>預覽逐題作答資料</summary>
      {readable.trials.rows.length ? <ResearchDataTable title="原始逐題作答" columns={columns} rows={readable.trials.rows} getKey={(row, index) => row.trial_id || `${row.task_session_id}-${index}`}/>
        : <p>目前範圍尚無原始題次資料。</p>}
    </details>
    <details className="studio-advanced"><summary>完整原始資料、分析檔與版本</summary>
      <p>原始紀錄與清理後資料分開提供。資料版本：{exportBundle.manifest.dataset_version}。</p>
      <div className="rpd-downloads">{Object.entries(exportBundle.files).map(([name, contents]) => <button type="button" key={name} disabled={!contents} onClick={() => downloadResearchFile(name, contents)}>{name}</button>)}</div>
    </details>
  </>;
}
