import { RESEARCH_TASK_GUIDE } from "../../config/researchTaskGuide";
import { RESEARCH_TASK_NAMES } from "../../config/researchTasks";

export function ResearchTaskGuide({ sidebar = false }) {
  return <section className={`studio-task-guide ${sidebar ? "is-sidebar" : ""}`} aria-label="遊戲規則與收集資料">
    <h2>遊戲規則與資料</h2>
    <p>展開查看遊戲名稱、簡稱、測驗規則及收集內容。</p>
    {RESEARCH_TASK_GUIDE.map(({ code, rules, collected, fields }) => <details key={code}>
      <summary><span className="studio-task-code">{code}</span><span>{RESEARCH_TASK_NAMES[code]}</span></summary>
      <dl>
        <div><dt>遊戲名稱／簡稱</dt><dd>{RESEARCH_TASK_NAMES[code]}（{code}）</dd></div>
        <div><dt>主要測驗規則</dt><dd>{rules}</dd></div>
        <div><dt>收集的資料</dt><dd>{collected}</dd></div>
        <div><dt>對應紀錄欄位</dt><dd><code>{fields}</code></dd></div>
      </dl>
    </details>)}
    <p>各遊戲另保留參與者與場次代碼、測驗／訓練模式、難度、題次及時間資訊。欄位依模式與紀錄版本而異；未收集者保留缺失，不補值。</p>
  </section>;
}
