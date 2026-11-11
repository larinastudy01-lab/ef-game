import { RESEARCH_TASK_GUIDE } from "../../config/researchTaskGuide";
import { RESEARCH_TASK_NAMES, RESEARCH_TASK_NAMING } from "../../config/researchTasks";

export function ResearchTaskGuide({ sidebar = false }) {
  return <section className={`studio-task-guide ${sidebar ? "is-sidebar" : ""}`} aria-label="遊戲規則與收集資料">
    <h2>遊戲規則與資料</h2>
    {RESEARCH_TASK_GUIDE.map(({ code, rules, collected, fields }) => <details key={code}>
      <summary><span>{RESEARCH_TASK_NAMES[code]}</span><span className="studio-task-code">{code}</span></summary>
      <dl>
        <div><dt>英文名稱</dt><dd>{RESEARCH_TASK_NAMING[code].english}</dd></div>
        <div><dt>代碼來源</dt><dd>{RESEARCH_TASK_NAMING[code].origin}</dd></div>
        <div><dt>主要測驗規則</dt><dd>{rules}</dd></div>
        <div><dt>收集的資料</dt><dd>{collected}</dd></div>
        <div><dt>對應紀錄欄位</dt><dd><details><summary>查看欄位名稱</summary><code>{fields}</code></details></dd></div>
      </dl>
    </details>)}
  </section>;
}
