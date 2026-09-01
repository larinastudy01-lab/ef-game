import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const STATUS = { pending:"申請已送出，等待管理員審核。", approved:"申請已核准，正在前往醫療端。", rejected:"申請未通過，請聯絡系統管理員。", suspended:"醫療帳號目前已停權。", expired:"專業資格驗證已到期，請聯絡管理員重新驗證。" };
const blank = { legalName:"", practiceCity:"", institutionName:"", department:"", declaration:false };

export default function ClinicianApplicationPage() {
  const navigate = useNavigate();
  const [user,setUser] = useState(null), [profileRole,setProfileRole] = useState(""), [application,setApplication] = useState(null);
  const [mode,setMode] = useState("register"), [auth,setAuth] = useState({name:"",email:"",password:"",confirm:""});
  const [form,setForm] = useState(blank);
  const [message,setMessage] = useState(""), [busy,setBusy] = useState(false), [loading,setLoading] = useState(true);

  async function load(activeUser) {
    if (!activeUser) { setUser(null); setProfileRole(""); setApplication(null); setLoading(false); return; }
    setUser(activeUser);
    const { data:profile } = await supabase.from("profiles").select("role").eq("id",activeUser.id).maybeSingle();
    setProfileRole(profile?.role || "");
    if (["clinician","medical","doctor"].includes(profile?.role)) { navigate("/clinician-dashboard",{replace:true}); return; }
    if(profile?.role==="admin"){navigate("/admin/clinician-applications",{replace:true});return;}
    if(["guardian","parent"].includes(profile?.role)){setApplication(null);setLoading(false);return;}
    const { data,error } = await supabase.from("clinician_applications").select("*").eq("user_id",activeUser.id).maybeSingle();
    if (error) setMessage(`無法讀取申請狀態：${error.message}`);
    setApplication(data || null);
    if (data) setForm({ legalName:data.legal_name||"", practiceCity:data.practice_city||"", institutionName:data.institution_name||"", department:data.department||"", declaration:Boolean(data.applicant_declaration) });
    setLoading(false);
  }
  // The auth subscription intentionally owns the refresh lifecycle for this page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { let alive=true; supabase.auth.getUser().then(({data})=>alive&&load(data?.user||null)); const {data:l}=supabase.auth.onAuthStateChange((_e,s)=>alive&&load(s?.user||null)); return()=>{alive=false;l?.subscription?.unsubscribe();}; },[]);

  async function submitAuth(e) {
    e.preventDefault(); setMessage("");
    if (mode==="register" && auth.password!==auth.confirm) { setMessage("兩次輸入的密碼不一致。"); return; }
    setBusy(true);
    try {
      if (mode==="register") {
        const {data,error}=await supabase.auth.signUp({email:auth.email.trim().toLowerCase(),password:auth.password,options:{data:{full_name:auth.name.trim(),account_type:"clinician_applicant"}}});
        if(error) throw error;
        if(!data.session){setMode("login");setMessage("帳號已建立。請先到信箱完成 Email 驗證，再回到此頁登入並填寫專業資料。");} else await load(data.user);
      } else {
        const {data,error}=await supabase.auth.signInWithPassword({email:auth.email.trim().toLowerCase(),password:auth.password}); if(error)throw error; await load(data.user);
      }
    } catch(error){setMessage(error?.message||"帳號操作失敗，請稍後再試。");} finally{setBusy(false);}
  }

  async function submitApplication(e) {
    e.preventDefault(); setMessage("");
    if(!form.declaration){setMessage("請勾選資料真實聲明與隱私同意。");return;}
    setBusy(true);
    try {
      const payload={user_id:user.id,legal_name:form.legalName.trim(),profession_type:"physician",profession_type_other:null,practice_city:form.practiceCity.trim(),institution_name:form.institutionName.trim(),department:form.department.trim(),license_number:null,institutional_email:null,institution_phone:null,verification_document_path:null,applicant_declaration:true,privacy_consent_at:new Date().toISOString()};
      const updatePayload={...payload}; delete updatePayload.user_id;
      const query=application?supabase.from("clinician_applications").update(updatePayload).eq("id",application.id).select().single():supabase.from("clinician_applications").insert(payload).select().single();
      const {data,error}=await query;if(error)throw error;setApplication(data);setMessage("申請已送出。核准後帳號會自動取得醫療端權限。");
    }catch(error){setMessage(error?.message||"申請送出失敗，請稍後再試。");}finally{setBusy(false);}
  }

  if(loading)return <main style={s.page}><section style={s.card}>正在讀取帳號狀態…</section></main>;
  return <main style={s.page}><section style={s.card}>
    <button style={s.link} onClick={()=>navigate("/clinician-login")}>← 返回醫療端登入</button><p style={s.eyebrow}>PROFESSIONAL ACCESS</p><h1 style={s.title}>申請醫療帳號</h1><p style={s.lead}>第一階段只需提供姓名、所在醫院與科別等基本資訊，送出後由管理員確認並開通。</p>
    {!user?<form style={s.form} onSubmit={submitAuth}><h2>{mode==="register"?"建立申請帳號":"驗證後登入"}</h2>{mode==="register"&&<Field label="真實姓名" value={auth.name} change={v=>setAuth({...auth,name:v})}/>}<Field label="Email" type="email" value={auth.email} change={v=>setAuth({...auth,email:v})}/><Field label="密碼（至少 6 個字元）" type="password" value={auth.password} change={v=>setAuth({...auth,password:v})}/>{mode==="register"&&<Field label="確認密碼" type="password" value={auth.confirm} change={v=>setAuth({...auth,confirm:v})}/>}<button style={s.primary} disabled={busy}>{busy?"處理中…":mode==="register"?"建立帳號並驗證 Email":"登入並繼續申請"}</button><button type="button" style={s.link} onClick={()=>setMode(mode==="register"?"login":"register")}>{mode==="register"?"已建立帳號或完成驗證？登入繼續":"尚未建立申請帳號？立即建立"}</button></form>
    :["guardian","parent"].includes(profileRole)?<div style={s.status}><h2>目前登入的是家長帳號</h2><p>為避免家長權限與專業權限混用，請登出後使用另一個 Email 建立醫療申請帳號。</p><button style={s.secondary} onClick={()=>supabase.auth.signOut()}>登出並建立申請帳號</button></div>
    :application&&application.status!=="needs_more_info"?<div style={s.status}><h2>{STATUS[application.status]||"申請狀態處理中"}</h2>{application.review_note&&<p>管理員說明：{application.review_note}</p>}<p>申請編號：{application.id}</p><button style={s.secondary} onClick={()=>supabase.auth.signOut()}>登出</button></div>
    :<form style={s.form} onSubmit={submitApplication}><h2>{application?"補充申請資料":"填寫醫師基本資料"}</h2>{application?.review_note&&<p style={s.note}>管理員說明：{application.review_note}</p>}<div style={s.grid}><Field label="醫師姓名" value={form.legalName} change={v=>setForm({...form,legalName:v})}/><Field label="所在縣市" value={form.practiceCity} change={v=>setForm({...form,practiceCity:v})}/><Field label="醫院／醫療機構名稱" value={form.institutionName} change={v=>setForm({...form,institutionName:v})}/><Field label="科別／部門" value={form.department} change={v=>setForm({...form,department:v})}/></div><label style={s.check}><input type="checkbox" checked={form.declaration} onChange={e=>setForm({...form,declaration:e.target.checked})}/>我確認以上基本資料正確，並同意系統為帳號審核使用。</label><button style={s.primary} disabled={busy}>{busy?"送出中…":"送出審核"}</button></form>}
    {message&&<div role="status" style={s.message}>{message}</div>}
  </section></main>;
}
function Field({label,type="text",value,change,required=true}){return <label style={s.label}>{label}<input style={s.input} type={type} value={value} required={required} onChange={e=>change(e.target.value)}/></label>}
const s={page:{minHeight:"100vh",padding:"36px 18px",boxSizing:"border-box",background:"linear-gradient(145deg,#eaf5fb,#f8fbfd)",fontFamily:'"Noto Sans TC","Microsoft JhengHei",sans-serif',color:"#173f5f"},card:{width:"min(860px,100%)",margin:"0 auto",padding:"clamp(24px,5vw,48px)",boxSizing:"border-box",borderRadius:28,background:"#fff",boxShadow:"0 18px 50px rgba(28,73,105,.14)"},eyebrow:{margin:"28px 0 4px",color:"#4a8fb8",fontWeight:800,letterSpacing:2},title:{margin:0,fontSize:"clamp(32px,6vw,48px)"},lead:{lineHeight:1.8,color:"#536b7c"},form:{display:"flex",flexDirection:"column",gap:18,marginTop:28},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16},label:{display:"flex",flexDirection:"column",gap:7,fontWeight:750,color:"#294f69"},input:{boxSizing:"border-box",width:"100%",padding:"12px 14px",border:"1px solid #bfd3df",borderRadius:11,background:"#fbfdff",fontSize:16},check:{display:"flex",gap:10,alignItems:"flex-start",lineHeight:1.6},primary:{padding:"14px 22px",border:0,borderRadius:12,background:"#236f9f",color:"white",fontSize:17,fontWeight:800,cursor:"pointer"},secondary:{padding:"11px 18px",border:"1px solid #8db4cc",borderRadius:10,background:"white",color:"#245d80",cursor:"pointer"},link:{border:0,background:"transparent",color:"#2775a5",fontWeight:700,cursor:"pointer"},message:{marginTop:20,padding:14,borderRadius:10,background:"#eef7fc",lineHeight:1.6},status:{marginTop:28,padding:24,borderRadius:16,background:"#f2f8fb",lineHeight:1.7},note:{padding:12,borderRadius:9,background:"#fff5d9"}};
