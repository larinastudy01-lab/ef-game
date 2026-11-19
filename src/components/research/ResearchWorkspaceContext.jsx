import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyProfile, getResearchExperimentHistory, getResearchFeatureInputsFromCloud } from "../../lib/database";
import { loadRecommendationHistory } from "../../analytics/recommendation";
import { supabase } from "../../lib/supabaseClient";
import { prepareResearchInputs, prepareResearchRecommendations } from "../../config/researchTasks";
import { isSessionExpiredError, researchLoadErrorMessage } from "../../lib/authErrors";

const WorkspaceContext = createContext(null);
const INITIAL_DATA = { inputs: [], recommendations: [], experiments: [], notices: [], readIssues: [], excludedCount: 0, loading: true, error: "", errorDetails: null };
export const useResearchWorkspace = () => useContext(WorkspaceContext);

export function useResearchData() {
  const workspace = useResearchWorkspace();
  const navigate = useNavigate();
  const [data, setData] = useState(INITIAL_DATA);
  const [revision, setRevision] = useState(0);
  const ownerRef = useRef(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (workspace) return undefined;
    let active = true;
    const requestLogin = () => {
      if (!active) return;
      active = false;
      setData({ ...INITIAL_DATA, loading: false });
      navigate("/clinician-login", { replace: true, state: { authExpired: true, from: "/research-tools" } });
    };
    const { data: authListener } = supabase.auth?.onAuthStateChange?.((event, session) => {
      if (event === "SIGNED_OUT") requestLogin();
      else if (session?.user?.id && ownerRef.current && session.user.id !== ownerRef.current) {
        active = false;
        ownerRef.current = session.user.id;
        setData({ ...INITIAL_DATA });
        setRevision((value) => value + 1);
      }
      else if (session?.user?.id) ownerRef.current = session.user.id;
    }) || {};
    setData((current) => ({ ...current, loading: true, error: "" }));
    (async () => {
      let stage = "確認醫療帳號";
      try {
        const profile = await getMyProfile();
        if (!active) return;
        if (!profile) { requestLogin(); return; }
        if (profile.id && ownerRef.current && profile.id !== ownerRef.current) {
          setData({ ...INITIAL_DATA }); setRevision((value) => value + 1); return;
        }
        ownerRef.current = profile.id || null;
        if (!["clinician", "medical", "doctor"].includes(String(profile?.role || "").toLowerCase())) {
          navigate("/clinician-login", { replace: true }); return;
        }
        stage = "讀取研究資料";
        const [inputState, historyState, experimentState] = await Promise.allSettled([
          getResearchFeatureInputsFromCloud({ includeDiagnostics: true }), loadRecommendationHistory(supabase), getResearchExperimentHistory(),
        ]);
        if (!active) return;
        const expired = [inputState, historyState, experimentState].find((state) =>
          state.status === "rejected" && isSessionExpiredError(state.reason));
        if (expired) throw expired.reason;
        if (inputState.status === "rejected") throw inputState.reason;
        stage = "整理研究紀錄";
        const source = inputState.value || [];
        const readIssues = Array.isArray(source) ? [] : source.issues || [];
        const { inputs, excludedCount } = prepareResearchInputs(Array.isArray(source) ? source : source.inputs);
        const notices = [];
        if (readIssues.length) notices.push(`有 ${readIssues.length} 筆歷史紀錄未通過題次來源校驗，暫未納入研究分析；其他紀錄可正常分析，原始資料已保留。`);
        if (historyState.status === "rejected") notices.push("建議歷程尚未可用。");
        if (experimentState.status === "rejected") notices.push("實驗歷程尚未可用。");
        stage = "整理建議歷程";
        setData({ inputs, excludedCount, recommendations: prepareResearchRecommendations(historyState.status === "fulfilled" ? historyState.value || [] : []),
          experiments: experimentState.status === "fulfilled" ? experimentState.value || [] : [], notices, readIssues, loading: false, error: "", errorDetails: null });
      } catch (reason) {
        if (!active) return;
        if (isSessionExpiredError(reason)) { requestLogin(); return; }
        const errorDetails = { stage, code: reason?.code || reason?.name || "UNKNOWN", message: reason?.message || "未提供錯誤說明" };
        console.error("Research data loading failed:", { ...errorDetails, stack: reason?.stack });
        setData({ ...INITIAL_DATA, loading: false, error: researchLoadErrorMessage(reason), errorDetails });
      }
    })();
    return () => { active = false; authListener?.subscription?.unsubscribe(); };
  }, [workspace, navigate, revision]);
  return workspace || { ...data, refresh };
}

export function useResearchSelection(participants = [], defaultTask = "ALL") {
  const workspace = useResearchWorkspace();
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [selectedTask, setSelectedTask] = useState(defaultTask);
  useEffect(() => {
    if (!workspace && selectedParticipant !== "ALL" && !participants.includes(selectedParticipant)) setSelectedParticipant(participants[0] || "");
  }, [workspace, participants, selectedParticipant]);
  return workspace || { selectedParticipant, setSelectedParticipant, selectedTask, setSelectedTask };
}

export function ResearchWorkspaceProvider({ children, openTool }) {
  const data = useResearchData();
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [selectedTask, setSelectedTask] = useState("ALL");
  const participants = useMemo(() => [...new Set(data.inputs.map((input) => input.participantId).filter(Boolean))].sort(), [data.inputs]);
  useEffect(() => {
    if (selectedParticipant !== "ALL" && !participants.includes(selectedParticipant)) setSelectedParticipant(participants[0] || "");
  }, [participants, selectedParticipant]);
  const value = useMemo(() => ({ ...data, participants, selectedParticipant, setSelectedParticipant, selectedTask, setSelectedTask, openTool }),
    [data, participants, selectedParticipant, selectedTask, openTool]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
