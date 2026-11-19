import { RESEARCH_TASK_NAMES } from "../../utils/professionalLabels";
import { RESEARCH_TASK_GUIDE } from "../../config/researchTaskGuide";
import { RESEARCH_TASK_NAMING } from "../../config/researchTasks";

export function ResearchTaskGuide({ sidebar = false }) {
  return <section className={`studio-task-guide ${sidebar ? "is-sidebar" : ""}`} aria-label="遊戲規則與收集資料">
    <h2>遊戲規則與資料</h2>
    {RESEARCH_TASK_GUIDE.map(({ code, rules, collected, fields }) => <details key={code}>
      <summary><span>{RESEARCH_TASK_NAMES[code]}</span><span className="studio-task-code">{code}</span></summary>
      <dl>
        <div><dt>英文名稱</dt><dd>{RESEARCH_TASK_NAMING[code].english}</dd></div>
        <div><dt>代碼來源</dt><dd>{code === "ARI" ? "聽覺規則抑制作業；cat／dog 為舊計分角色，實際動物須依 soundAnimal、stimulusAnimals 與 testVersion 讀取。" : RESEARCH_TASK_NAMING[code].origin}</dd></div>
        <div><dt>主要測驗規則</dt><dd>{code === "ARI" ? "依該次記錄的動物配對與 taskRule，聽到一種動物聲音後選取另一種動物；不由舊角色名稱推定刺激。" : rules}</dd></div>
        <div><dt>收集的資料</dt><dd>{collected}</dd></div>
        <div><dt>對應紀錄欄位</dt><dd><details><summary>查看欄位名稱</summary><code>{code === "ARI" ? `${fields} · soundAnimal · expectedAnimal · selectedAnimal · stimulusAnimals · stimulusAnimalLabels · testVersion · taskRule` : fields}</code></details></dd></div>
      </dl>
    </details>)}
  </section>;
}
