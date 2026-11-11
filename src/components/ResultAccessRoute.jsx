import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { areResultMirrorsReady, RESULT_SYNC_EVENT } from "../utils/resultSync";
import { isTemporaryGameTesting } from "../temporaryGameTesting/runtime";

const FAMILY_ROLES = ["guardian", "parent"];
const CLINICAL_ROLES = ["clinician", "medical", "doctor"];

function resultPatientId(state) {
  const result = state.resultData || state.result || {};
  const explicit = [state.childId, state.patientId, result.childId, result.patientId,
    result.patient_id, result.child?.childId, result.child?.id].filter(Boolean).map(String);
  if (new Set(explicit).size > 1) return null;
  if (explicit.length) return explicit[0];
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of ["ef_active_patient_id", "currentChildId", "selectedChildId", "currentPatientId", "selectedPatientId"]) {
      const id = storage.getItem(key);
      if (id) return id;
    }
    for (const key of ["currentChild", "selectedChild", "currentPatient", "selectedPatient", "activeChild"]) {
      let child;
      try { child = JSON.parse(storage.getItem(key)); } catch { child = null; }
      const id = child?.childId || child?.id || child?.patientId;
      if (id) return String(id);
    }
  }
  return null;
}

// Local result readers retain their legacy contracts. Authorize their entire
// render before any cached payload is read; RLS checks the selected patient.
export default function ResultAccessRoute({ children, audience = "family", allowGameTesting = false, requirePatient = true }) {
  const location = useLocation();
  const [access, setAccess] = useState({ state: "checking", ownerId: null });
  const testing = allowGameTesting && isTemporaryGameTesting();
  useEffect(() => {
    if (testing) return undefined;
    let active = true;
    let revision = 0;
    let authorizedOwner = null;
    const validate = async () => {
      const request = ++revision;
      setAccess({ state: "checking", ownerId: null });
      const finish = (state, ownerId = null) => {
        if (active && request === revision) { authorizedOwner = state === "allowed" ? ownerId : null; setAccess({ state, ownerId }); }
      };
      try {
        const auth = await supabase.auth.getUser();
        if (auth.error || !auth.data?.user) { finish("denied"); return; }
        const ownerId = auth.data.user.id;
        if (!areResultMirrorsReady(ownerId)) { finish("storage"); return; }
        const profile = await supabase.from("profiles").select("role").eq("id", ownerId).maybeSingle();
        const role = String(profile.data?.role || "").trim().toLowerCase();
        const allowed = audience === "clinical" ? CLINICAL_ROLES
          : audience === "shared" ? [...FAMILY_ROLES, ...CLINICAL_ROLES] : FAMILY_ROLES;
        if (profile.error || !allowed.includes(role)) { finish("denied"); return; }
        if (!requirePatient) { finish("allowed", ownerId); return; }
        const patientId = resultPatientId(location.state || {});
        if (!patientId) { finish("denied"); return; }
        const patient = await supabase.from("patients").select("id,guardian_id").eq("id", patientId).maybeSingle();
        if (patient.error || !patient.data || (FAMILY_ROLES.includes(role) && patient.data.guardian_id !== ownerId)) {
          finish("denied"); return;
        }
        finish("allowed", ownerId);
      } catch { finish("denied"); }
    };
    const refresh = () => { void validate(); };
    const syncChanged = () => { if (!authorizedOwner || !areResultMirrorsReady(authorizedOwner)) refresh(); };
    // Auth callbacks must return before making another Supabase auth request.
    const { data } = supabase.auth.onAuthStateChange(() => {
      ++revision;
      authorizedOwner = null;
      if (active) setAccess({ state: "checking", ownerId: null });
      window.setTimeout(() => { if (active) refresh(); }, 0);
    });
    refresh();
    window.addEventListener(RESULT_SYNC_EVENT, syncChanged);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      ++revision;
      data?.subscription?.unsubscribe();
      window.removeEventListener(RESULT_SYNC_EVENT, syncChanged);
      window.removeEventListener("focus", refresh);
    };
  }, [audience, location.key, location.state, testing, requirePatient]);

  if (testing) return children;
  if (access.state === "checking") return <div role="status">正在確認結果存取權限…</div>;
  if (access.state === "allowed" && areResultMirrorsReady(access.ownerId)) return children;
  return <div role="alert">{access.state === "storage"
    ? "本機結果尚未完成帳號隔離，暫時無法顯示。已保留原始紀錄與待傳資料，請恢復儲存空間後重新登入。"
    : "無法讀取這個個案的結果。請確認登入身分、個案授權及網路連線。"}</div>;
}
