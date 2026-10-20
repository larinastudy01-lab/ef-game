import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyProfile, getResearchExperimentHistory, getResearchFeatureInputsFromCloud } from "../../lib/database";
import { loadRecommendationHistory } from "../../analytics/recommendation";
import { supabase } from "../../lib/supabaseClient";
import { prepareResearchInputs, prepareResearchRecommendations } from "../../config/researchTasks";

const WorkspaceContext = createContext(null);
const INITIAL_DATA = { inputs: [], recommendations: [], experiments: [], notices: [], excludedCount: 0, loading: true, error: "" };
export const useResearchWorkspace = () => useContext(WorkspaceContext);

export function useResearchData() {
  const workspace = useResearchWorkspace();
  const navigate = useNavigate();
  const [data, setData] = useState(INITIAL_DATA);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (workspace) return undefined;
    let active = true;
    setData((current) => ({ ...current, loading: true, error: "" }));
    (async () => {
      try {
        const profile = await getMyProfile();
        if (!active) return;
        if (!["clinician", "medical", "doctor"].includes(String(profile?.role || "").toLowerCase())) {
          navigate("/clinician-login", { replace: true }); return;
        }
        const [inputState, historyState, experimentState] = await Promise.allSettled([
          getResearchFeatureInputsFromCloud(), loadRecommendationHistory(supabase), getResearchExperimentHistory(),
        ]);
        if (!active) return;
        if (inputState.status === "rejected") throw inputState.reason;
        const { inputs, excludedCount } = prepareResearchInputs(inputState.value || []);
        const notices = [];
        if (historyState.status === "rejected") notices.push("建議歷程尚未可用。");
        if (experimentState.status === "rejected") notices.push("實驗歷程尚未可用。");
        setData({ inputs, excludedCount, recommendations: prepareResearchRecommendations(historyState.status === "fulfilled" ? historyState.value || [] : []),
          experiments: experimentState.status === "fulfilled" ? experimentState.value || [] : [], notices, loading: false, error: "" });
      } catch (reason) {
        if (active) setData({ ...INITIAL_DATA, loading: false, error: "資料尚未可用，請確認資料庫與帳號存取權限。" });
      }
    })();
    return () => { active = false; };
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
