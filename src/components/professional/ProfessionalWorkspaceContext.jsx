import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const Context = createContext(null);
export const useProfessionalWorkspace = () => useContext(Context);
// Sensitive selection/drafts live in memory only and are invalidated by owner.
export function ProfessionalWorkspaceProvider({ children }) {
  const [state, setState] = useState({ owner: null, patientId: "", drafts: {} });
  useEffect(() => {
    const warn = (event) => { if (Object.values(state.drafts).some((draft) => draft.trim())) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.drafts]);
  useEffect(() => {
    let active = true; let authEventSeen = false;
    const assign = (owner) => { if (active) setState((current) => current.owner === owner ? current : { owner, patientId: "", drafts: {} }); };
    supabase.auth.getUser().then(({ data }) => { if (!authEventSeen) assign(data?.user?.id || null); }).catch(() => assign(null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { authEventSeen = true; assign(session?.user?.id || null); });
    return () => { active = false; data?.subscription?.unsubscribe(); };
  }, []);
  const selectPatient = useCallback((owner, patientId) => setState((current) => current.owner === owner ? { ...current, patientId } : current), []);
  const setDraft = useCallback((owner, patientId, text) => setState((current) => current.owner === owner ? { ...current, drafts: { ...current.drafts, [patientId]: text } } : current), []);
  const value = useMemo(() => ({ ...state, selectPatient, setDraft }), [state, selectPatient, setDraft]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
