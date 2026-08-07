import { supabase } from "./supabaseClient";
import { buildBehavioralHierarchy } from "../analytics/trials/buildBehavioralHierarchy";

const asIsoTimestamp = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const asJsonValue = (value) => (value === undefined ? null : value);

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

  // Phase 1 is additive. Keep game_results working even while a deployment has
  // not applied the behavioral migration yet.
  try {
    await saveBehavioralHierarchyToCloud(normalizedResult);
  } catch (behavioralError) {
    console.warn("Behavioral hierarchy sync skipped or failed:", behavioralError);
  }

  return data;
};

export const saveBehavioralHierarchyToCloud = async (normalizedResult) => {
  const user = await getCurrentUser();
  const patientId =
    normalizedResult?.child?.childId ||
    normalizedResult?.child?.id ||
    normalizedResult?.patient_id ||
    normalizedResult?.patientId;

  if (!user || !patientId) return null;

  const hierarchy = buildBehavioralHierarchy(normalizedResult);
  const { data: participant, error: participantError } = await supabase
    .from("research_participants")
    .upsert({ patient_id: patientId }, { onConflict: "patient_id" })
    .select("id")
    .single();

  if (participantError) throw participantError;

  const participantId = participant.id;
  const session = hierarchy.session;
  const task = hierarchy.taskSession;

  const { error: sessionError } = await supabase
    .from("behavioral_sessions")
    .upsert({
      id: session.sessionId,
      participant_id: participantId,
      session_type: session.sessionType,
      assessment_or_training: session.assessmentOrTraining,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      device_information: session.deviceInformation,
      task_order: session.taskOrder,
      session_status: session.sessionStatus,
      source_result_id: session.sourceResultId,
      schema_version: hierarchy.schemaVersion,
    }, { onConflict: "id" });
  if (sessionError) throw sessionError;

  const { error: taskError } = await supabase
    .from("behavioral_task_sessions")
    .upsert({
      id: task.taskSessionId,
      session_id: session.sessionId,
      task_code: task.taskCode,
      task_name: task.taskName,
      task_order_index: 1,
      difficulty: task.difficulty,
      started_at: task.startedAt,
      completed_at: task.completedAt,
      total_trials: task.totalTrials,
      correct_trials: task.correctTrials,
      incorrect_trials: task.incorrectTrials,
      mean_reaction_time_ms: task.meanReactionTime,
      completion_status: task.completionStatus,
      raw_task_data: task.rawData,
      raw_schema_version: hierarchy.schemaVersion,
    }, { onConflict: "id" });
  if (taskError) throw taskError;

  if (hierarchy.trials.length === 0) return hierarchy;

  const rawRows = hierarchy.trials.map((trial) => ({
    id: trial.trialId,
    task_session_id: task.taskSessionId,
    source_trial_key: trial.sourceTrialKey,
    trial_index: trial.trialIndex,
    occurred_at: asIsoTimestamp(trial.occurredAt),
    raw_data: trial.rawData,
    raw_schema_version: hierarchy.schemaVersion,
  }));
  const { error: rawError } = await supabase
    .from("behavioral_trials")
    .upsert(rawRows, { onConflict: "id", ignoreDuplicates: true });
  if (rawError) throw rawError;

  const derivedRows = hierarchy.trials.map((trial) => ({
    trial_id: trial.trialId,
    participant_id: participantId,
    task_name: task.taskName,
    task_code: task.taskCode,
    trial_index: trial.trialIndex,
    stimulus: asJsonValue(trial.stimulus),
    condition: trial.condition,
    difficulty: trial.difficulty,
    expected_response: asJsonValue(trial.expectedResponse),
    actual_response: asJsonValue(trial.actualResponse),
    is_correct: trial.isCorrect,
    reaction_time_ms: trial.reactionTimeMs,
    error_type: trial.errorType,
    task_specific_metadata: trial.taskSpecificMetadata,
    valid_trial: trial.validTrial,
    exclusion_reasons: trial.exclusionReasons,
    processing_version: hierarchy.processingVersion,
    is_current: true,
  }));
  const { error: derivationError } = await supabase
    .from("behavioral_trial_derivations")
    .upsert(derivedRows, { onConflict: "trial_id,processing_version" });
  if (derivationError) throw derivationError;

  return { ...hierarchy, participant: { researchParticipantId: participantId } };
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
      id, session_id, task_code, task_name, completion_status, difficulty,
      started_at, completed_at,
      behavioral_sessions!inner(
        id, participant_id, assessment_or_training, started_at, completed_at, session_status
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
  const existingSessionIds = new Set(behavioralInputs.map((input) => String(input.sessionId)));
  const fallbackInputs = [];

  (resultRows || []).forEach((row) => {
    let storedPayload = row.payload;
    if (typeof storedPayload === "string") {
      try { storedPayload = JSON.parse(storedPayload); } catch { storedPayload = {}; }
    }
    const payload = storedPayload && typeof storedPayload === "object" ? storedPayload : {};
    const normalized = {
      ...payload,
      resultId: payload.resultId || row.id,
      child: { ...(payload.child || {}), childId: payload.child?.childId || payload.child?.id || row.patient_id },
      game: { ...(payload.game || {}), gameId: payload.game?.gameId || row.game_id },
      session: {
        ...(payload.session || {}),
        mode: payload.session?.mode || row.mode,
        difficulty: payload.session?.difficulty || row.difficulty,
        startedAt: payload.session?.startedAt || row.started_at || row.finished_at,
        finishedAt: payload.session?.finishedAt || row.finished_at,
      },
    };
    const hierarchy = buildBehavioralHierarchy(normalized, {
      sessionId: payload.behavioral?.sessionId || String(row.id),
      taskSessionId: payload.behavioral?.taskSessionId || `${row.id}-task`,
    });
    if (existingSessionIds.has(String(hierarchy.session.sessionId))) return;

    const participantId = participantByPatient.get(String(row.patient_id)) || `patient-${row.patient_id}`;
    fallbackInputs.push({
      participantId,
      sessionId: hierarchy.session.sessionId,
      taskSession: {
        id: hierarchy.taskSession.taskSessionId,
        session_id: hierarchy.session.sessionId,
        task_code: hierarchy.taskSession.taskCode,
        task_name: hierarchy.taskSession.taskName,
        completion_status: hierarchy.taskSession.completionStatus,
        difficulty: hierarchy.taskSession.difficulty,
        started_at: hierarchy.taskSession.startedAt,
        completed_at: hierarchy.taskSession.completedAt,
      },
      trials: hierarchy.trials.map((trial) => ({
        trial_id: trial.trialId,
        participant_id: participantId,
        task_name: hierarchy.taskSession.taskName,
        task_code: hierarchy.taskSession.taskCode,
        trial_index: trial.trialIndex,
        stimulus: trial.stimulus,
        condition: trial.condition,
        difficulty: trial.difficulty,
        expected_response: trial.expectedResponse,
        actual_response: trial.actualResponse,
        is_correct: trial.isCorrect,
        reaction_time_ms: trial.reactionTimeMs,
        error_type: trial.errorType,
        task_specific_metadata: trial.taskSpecificMetadata,
        valid_trial: trial.validTrial,
        exclusion_reasons: trial.exclusionReasons,
        processing_version: hierarchy.processingVersion,
        is_current: true,
      })),
      rawTrials: hierarchy.trials.map((trial) => ({
        id: trial.trialId,
        source_trial_key: trial.sourceTrialKey,
        trial_index: trial.trialIndex,
        occurred_at: trial.occurredAt,
        raw_data: trial.rawData,
        raw_schema_version: hierarchy.schemaVersion,
      })),
      sessionMetadata: {
        assessment_or_training: hierarchy.session.assessmentOrTraining,
        session_started_at: hierarchy.session.startedAt,
        session_completed_at: hierarchy.session.completedAt,
        session_status: hierarchy.session.sessionStatus,
      },
    });
  });

  return [...behavioralInputs, ...fallbackInputs];
};

export const getResearchExperimentHistory = async (limit = 100) => {
  const user = await getCurrentUser(); if (!user) return [];
  const profile = await getMyProfile(); const role = String(profile?.role || "").toLowerCase();
  if (!["clinician", "medical", "doctor"].includes(role)) throw new Error("Research experiment metadata requires an authorized professional account.");
  const { data, error } = await supabase.from("ml_experiments").select("*")
    .order("training_timestamp", { ascending: false }).limit(limit);
  if (error) throw error; return data || [];
};
