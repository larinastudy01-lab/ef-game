import { supabase } from "./supabaseClient";

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

  const { data, error } = await supabase
    .from("patients")
    .insert([
      {
        guardian_id: user.id,
        nickname: cleanNickname,
        full_name: cleanFullName || null,
        birth_date: birthDate,
        gender: cleanGender || null,
        avatar: cleanAvatar || null,
        note: cleanNote || null,
      },
    ])
    .select("*")
    .single();

  if (error) throw error;
  return data;
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

export const saveGameResultToCloud = async (normalizedResult) => {
  const user = await getCurrentUser();
  const childId =
    normalizedResult?.child?.childId ||
    normalizedResult?.child?.id ||
    normalizedResult?.patient_id ||
    normalizedResult?.patientId;

  if (!user || !childId) return null;

  const payload = {
    id: normalizedResult.resultId,
    patient_id: childId,
    guardian_id: user.id,
    game_id: normalizedResult.game?.gameId || null,
    game_name: normalizedResult.game?.gameName || null,
    mode: normalizedResult.session?.mode || null,
    difficulty: normalizedResult.session?.difficulty || null,
    score: normalizedResult.summary?.score ?? 0,
    stars: normalizedResult.summary?.stars ?? 0,
    accuracy: normalizedResult.summary?.accuracy ?? 0,
    avg_reaction_time: normalizedResult.summary?.avgReactionTime ?? 0,
    total_trials: normalizedResult.summary?.totalTrials ?? 0,
    correct_count: normalizedResult.summary?.correctCount ?? 0,
    error_count: normalizedResult.summary?.errorCount ?? 0,
    started_at: normalizedResult.session?.startedAt || null,
    finished_at:
      normalizedResult.session?.finishedAt || new Date().toISOString(),
    payload: normalizedResult,
  };

  if (!payload.id) {
    payload.id = `${payload.game_id || "game"}-${payload.mode || "session"}-${childId}-${Date.now()}`;
  }

  const { data, error } = await supabase
    .from("game_results")
    .upsert([payload], { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
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