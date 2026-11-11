import { supabase } from "./supabaseClient";
import { buildBehavioralHierarchy } from "../analytics/trials/buildBehavioralHierarchy";
import {
  syncGameResult, normalizedStoredResult, prepareBehavioralHierarchy,
  persistVerifiedBehavioralHierarchy, repairStoredBehavioralHierarchy, researchInputFromHierarchy,
} from "./behavioralSync";

export const isSupabaseConfigured = () => {
  return Boolean(
    process.env.REACT_APP_SUPABASE_URL &&
      process.env.REACT_APP_SUPABASE_ANON_KEY
  );
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user || null;
};

export const getMyProfile = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const getMyPatients = async () => {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("guardian_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getPatientById = async (patientId) => {
  const user = await getCurrentUser();
  if (!user || !patientId) return null;

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const createMyPatient = async ({
  nickname,
  fullName = "",
  birthDate,
  gender = "",
  avatar = "",
  note = "",
}) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("請先登入家長帳號。");

  const cleanNickname = String(nickname || "").trim();
  const cleanFullName = String(fullName || "").trim();
  const cleanGender = String(gender || "").trim();
  const cleanAvatar = String(avatar || "").trim();
  const cleanNote = String(note || "").trim();

  if (!cleanNickname) throw new Error("請輸入兒童暱稱。");
  if (!birthDate) throw new Error("請選擇兒童生日。");

  const { data, error } = await supabase.rpc("create_my_patient", {
    patient_nickname: cleanNickname,
    patient_full_name: cleanFullName || null,
    patient_birth_date: birthDate,
    patient_gender: cleanGender || null,
    patient_avatar: cleanAvatar || null,
    patient_note: cleanNote || null,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
};

export const updateMyPatient = async (
  patientId,
  {
    nickname,
    fullName,
    birthDate,
    gender,
    avatar,
    note,
  } = {}
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("請先登入家長帳號。");
  if (!patientId) throw new Error("缺少兒童 ID。");

  const updates = {};

  if (nickname !== undefined) updates.nickname = String(nickname || "").trim();
  if (fullName !== undefined) updates.full_name = String(fullName || "").trim() || null;
  if (birthDate !== undefined) updates.birth_date = birthDate || null;
  if (gender !== undefined) updates.gender = String(gender || "").trim() || null;
  if (avatar !== undefined) updates.avatar = String(avatar || "").trim() || null;
  if (note !== undefined) updates.note = String(note || "").trim() || null;

  if (Object.keys(updates).length === 0) return null;

  const { data, error } = await supabase
    .from("patients")
    .update(updates)
    .eq("id", patientId)
    .eq("guardian_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const deleteMyPatient = async (patientId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("請先登入家長帳號。");
  if (!patientId) throw new Error("缺少兒童 ID。");

  const { error } = await supabase
    .from("patients")
    .delete()
    .eq("id", patientId)
    .eq("guardian_id", user.id);

  if (error) throw error;
  return true;
};

export const saveGameResultToCloud = async (normalizedResult, { expectedOwnerId = null } = {}) => {
  const user = await getCurrentUser();
  if (expectedOwnerId && user?.id !== expectedOwnerId) return null;
  const patientId = normalizedResult?.child?.childId || normalizedResult?.child?.id
    || normalizedResult?.patient_id || normalizedResult?.patientId;
  if (!user || !patientId) return null;
  return syncGameResult(supabase, normalizedResult, user);
};

export const saveBehavioralHierarchyToCloud = async (normalizedResult) => {
  const user = await getCurrentUser();
  const patientId = normalizedResult?.child?.childId || normalizedResult?.child?.id;
  if (!user || !patientId) return null;
  const prepared = await prepareBehavioralHierarchy(supabase, normalizedResult);
  return persistVerifiedBehavioralHierarchy(supabase, prepared, patientId);
};

// P0-B: default read-only; writes are restricted to explicitly reviewed isolated synthetic records.
export const repairBehavioralHierarchyFromResultId = async (resultId, options = {}) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in before inspecting a historical repair.");
  return repairStoredBehavioralHierarchy(supabase, resultId, user, options);
};

export const getResultsByPatientFromCloud = async (patientId) => {
  const user = await getCurrentUser();
  if (!user || !patientId) return [];

  const profile = await getMyProfile();
  const role = String(profile?.role || "").toLowerCase();

  let query = supabase
    .from("game_results")
    .select("*")
    .eq("patient_id", patientId)
    .order("finished_at", { ascending: false });

  if (role === "guardian" || role === "parent") {
    query = query.eq("guardian_id", user.id);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};

export const getMyReminders = async (patientId) => {
  const user = await getCurrentUser();
  if (!user || !patientId) return [];

  const { data, error } = await supabase
    .from("parent_reminders")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getUnreadReminderCount = async (patientId) => {
  const user = await getCurrentUser();
  if (!user || !patientId) return 0;

  const { count, error } = await supabase
    .from("parent_reminders")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .eq("status", "unread");

  if (error) throw error;
  return count || 0;
};

export const markReminderAsRead = async (reminderId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("請先登入。");
  if (!reminderId) throw new Error("缺少提醒 ID。");

  const { data, error } = await supabase
    .from("parent_reminders")
    .update({
      status: "read",
      read_at: new Date().toISOString(),
    })
    .eq("id", reminderId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const markReminderAsDone = async (reminderId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("請先登入。");
  if (!reminderId) throw new Error("缺少提醒 ID。");

  const { data, error } = await supabase
    .from("parent_reminders")
    .update({
      status: "done",
      read_at: new Date().toISOString(),
    })
    .eq("id", reminderId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const createParentReminder = async ({
  patientId,
  reminderType = "custom",
  title = "",
  message,
}) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("請先登入醫療端帳號。");
  if (!patientId) throw new Error("缺少兒童 ID。");

  const cleanMessage = String(message || "").trim();
  const cleanTitle = String(title || "").trim();

  if (!cleanMessage) throw new Error("請輸入提醒內容。");

  const { data, error } = await supabase
    .from("parent_reminders")
    .insert([
      {
        patient_id: patientId,
        clinician_id: user.id,
        reminder_type: reminderType,
        title: cleanTitle || null,
        message: cleanMessage,
        status: "unread",
      },
    ])
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const getRemindersByPatientFromCloud = async (patientId) => {
  const user = await getCurrentUser();
  if (!user || !patientId) return [];

  const { data, error } = await supabase
    .from("parent_reminders")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getClinicianNotes = async (patientId) => {
  const user = await getCurrentUser();
  if (!user || !patientId) return [];

  const { data, error } = await supabase
    .from("clinician_notes")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createClinicianNote = async ({ patientId, note }) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("請先登入醫療端帳號。");
  if (!patientId) throw new Error("缺少兒童 ID。");

  const cleanNote = String(note || "").trim();
  if (!cleanNote) throw new Error("請輸入備註內容。");

  const { data, error } = await supabase
    .from("clinician_notes")
    .insert([
      {
        patient_id: patientId,
        clinician_id: user.id,
        note: cleanNote,
      },
    ])
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const getAssignedPatientsForClinician = async () => {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data: accessData, error: accessError } = await supabase
    .from("clinician_patient_access")
    .select("patient_id")
    .eq("clinician_id", user.id);

  if (accessError) throw accessError;

  const patientIds = [
    ...new Set((accessData || []).map((item) => item.patient_id).filter(Boolean)),
  ];

  if (patientIds.length === 0) return [];

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .in("id", patientIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getResearchFeatureInputsFromCloud = async () => {
  const user = await getCurrentUser();
  if (!user) return [];
  const profile = await getMyProfile();
  const role = String(profile?.role || "").toLowerCase();
  if (!["clinician", "medical", "doctor"].includes(role)) {
    throw new Error("Research statistics requires an authorized professional account.");
  }

  const { data, error } = await supabase
    .from("behavioral_task_sessions")
    .select(`
      id, session_id, task_code, task_name, completion_status, difficulty, total_trials,
      started_at, completed_at,
      behavioral_sessions!inner(
        id, participant_id, assessment_or_training, started_at, completed_at, session_status, source_result_id
      ),
      behavioral_trials(
        id, source_trial_key, trial_index, occurred_at, received_at, raw_data, raw_schema_version,
        behavioral_trial_derivations(*)
      )
    `)
    .order("started_at", { ascending: true });
  const behavioralInputs = error ? [] : (data || []).map((taskSession) => {
    const session = Array.isArray(taskSession.behavioral_sessions)
      ? taskSession.behavioral_sessions[0]
      : taskSession.behavioral_sessions;
    const trials = (taskSession.behavioral_trials || []).flatMap((rawTrial) => {
      const derivations = (rawTrial.behavioral_trial_derivations || [])
        .filter((derivation) => derivation.is_current !== false)
        .map((derivation) => ({ ...derivation, trial_index: derivation.trial_index ?? rawTrial.trial_index }));
      return derivations.length ? [derivations[0]] : [];
    });
    return {
      sourceResultId: session?.source_result_id || null,
      participantId: session?.participant_id || null,
      sessionId: session?.id || taskSession.session_id,
      taskSession,
      trials,
      rawTrials: (taskSession.behavioral_trials || []).map((rawTrial) => ({
        id: rawTrial.id,
        source_trial_key: rawTrial.source_trial_key,
        trial_index: rawTrial.trial_index,
        occurred_at: rawTrial.occurred_at,
        received_at: rawTrial.received_at,
        raw_data: rawTrial.raw_data,
        raw_schema_version: rawTrial.raw_schema_version,
      })),
      sessionMetadata: {
        assessment_or_training: session?.assessment_or_training,
        session_started_at: session?.started_at,
        session_completed_at: session?.completed_at,
        session_status: session?.session_status,
      },
    };
  });

  // game_results is the durable application record. Use its normalized payload
  // as a fallback when the additive behavioral sync was unavailable or failed.
  const [{ data: resultRows, error: resultError }, { data: participantRows }] = await Promise.all([
    supabase
      .from("game_results")
      .select("id, patient_id, game_id, mode, difficulty, started_at, finished_at, payload")
      .order("finished_at", { ascending: true }),
    supabase.from("research_participants").select("id, patient_id"),
  ]);

  if (error && resultError) {
    throw new Error(`研究資料與遊戲結果皆無法讀取：${error.message}; ${resultError.message}`);
  }

  const participantByPatient = new Map(
    (participantRows || []).map((row) => [String(row.patient_id), row.id])
  );
  const inputs = [...behavioralInputs];
  (resultRows || []).forEach((row) => {
    const normalized = normalizedStoredResult(row);
    const index = inputs.findIndex((input) => input.sourceResultId === row.id
      || input.sessionId === normalized.behavioral?.sessionId);
    const existing = index >= 0 ? inputs[index] : null;
    const hierarchy = buildBehavioralHierarchy({ ...normalized, behavioral: {
      ...normalized.behavioral,
      ...(existing ? { sessionId: existing.sessionId, taskSessionId: existing.taskSession.id } : {}),
    } });
    const complete = existing && existing.rawTrials.length === hierarchy.trials.length
      && existing.trials.length === hierarchy.trials.length;
    // LB/PM are re-derived IN MEMORY from preserved source data with the new
    // processing version. Other complete task datasets remain unchanged.
    if (complete && !["LB", "PM"].includes(hierarchy.taskSession.taskCode)) {
      // Same counts alone are not proof: also compare the acquired contents.
      researchInputFromHierarchy(hierarchy, existing.participantId, existing.rawTrials);
      return;
    }
    const participantId = existing?.participantId || participantByPatient.get(String(row.patient_id)) || "patient-" + row.patient_id;
    const restored = researchInputFromHierarchy(hierarchy, participantId, existing?.rawTrials || []);
    restored.researchReadStatus = "reconstructed_from_main_payload";
    if (existing) inputs[index] = restored;
    else inputs.push(restored);
  });
  if (resultError && inputs.some((input) => input.taskSession.total_trials !== input.rawTrials.length
    || input.trials.length !== input.rawTrials.length)) {
    throw new Error("Research hierarchy is incomplete and its main-result source cannot be read.");
  }
  return inputs;
};

export const getResearchExperimentHistory = async (limit = 100) => {
  const user = await getCurrentUser(); if (!user) return [];
  const profile = await getMyProfile(); const role = String(profile?.role || "").toLowerCase();
  if (!["clinician", "medical", "doctor"].includes(role)) throw new Error("Research experiment metadata requires an authorized professional account.");
  const { data, error } = await supabase.from("ml_experiments").select("*")
    .order("training_timestamp", { ascending: false }).limit(limit);
  if (error) throw error; return data || [];
};
