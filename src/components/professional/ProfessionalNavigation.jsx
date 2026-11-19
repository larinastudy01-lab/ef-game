import { useNavigate } from "react-router-dom";
import "../../styles/ProfessionalWorkspace.css";

export const RESEARCH_LINKS = [["overview", "研究總覽"], ["statistics", "研究統計"], ["ai", "AI 行為分析"], ["adaptive", "自適應訓練分析"], ["longitudinal", "縱向追蹤"]];
export function ProfessionalBrand({ collapsed = false }) {
  return <div className="professional-brand"><img src={`${process.env.PUBLIC_URL}/logo192.webp`} alt="蒐秘密遊戲 Logo" width="40" height="40"/>{!collapsed && <div><strong>蒐秘密｜專業分析平台</strong><small>Clinical &amp; Research Workspace</small></div>}</div>;
}
export function ProfessionalClinicalLinks({ active = "", collapsed = false, onSelect }) {
  const navigate = useNavigate();
  const select = (section) => onSelect ? onSelect(section) : navigate(`/clinician-dashboard?section=${section}`);
  return <div className="professional-clinical-links"><button type="button" title="總覽儀表板" aria-current={active === "overview" ? "page" : undefined} onClick={() => select("overview")}>{collapsed ? "總覽" : "總覽儀表板"}</button><p>{collapsed ? "個案" : "個案工作區"}</p>{[["patients", "個案清單"], ["trend", "六項能力與歷次趨勢"], ["records", "測驗／訓練詳細資料"], ["tools", "個案追蹤工具"]].map(([id, label]) => <button type="button" key={id} title={label} aria-current={active === id ? "page" : undefined} onClick={() => select(id)}>{collapsed ? label.slice(0, 2) : label}</button>)}</div>;
}
export function ProfessionalNavigation({ active, onSelect, onLeave }) {
  const navigate = useNavigate();
  const go = (url) => { if (!onLeave || onLeave()) navigate(url); };
  return <aside className="professional-navigation" aria-label="專業分析平台導覽"><ProfessionalBrand/><ProfessionalClinicalLinks active={active} onSelect={onSelect}/><p>研究工作區</p>{RESEARCH_LINKS.map(([id, label]) => <button type="button" key={id} onClick={() => go(`/research-tools?view=${id}`)}>{label}</button>)}<p>資料與說明</p>{[["quality", "資料品質"], ["exports", "研究資料匯出"], ["methods", "研究方法與指標說明"]].map(([id, label]) => <button type="button" key={id} onClick={() => go(`/research-tools?panel=${id}`)}>{label}</button>)}</aside>;
}
