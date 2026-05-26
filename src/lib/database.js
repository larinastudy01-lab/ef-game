import { supabase } from "./supabaseClient";

export const isSupabaseConfigured = () => {
  return Boolean(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY);
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user || null;
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

export const createMyPatient = async ({ nickname, birthDate, gender, avatar }) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("請先登入家長帳號。 ");

  const { data, error } = await supabase
    .from("patients")
    .insert([
      {
        guardian_id: user.id,
        nickname,
        birth_date: birthDate,
        gender,
        avatar,
      },
    ])
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const deleteMyPatient = async (patientId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("請先登入家長帳號。 ");

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
  const childId = normalizedResult?.child?.childId || normalizedResult?.child?.id;

  if (!user || !childId) return null;

  const { data, error } = await supabase
    .from("game_results")
    .upsert(
      [
        {
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
          finished_at: normalizedResult.session?.finishedAt || new Date().toISOString(),
          payload: normalizedResult,
        },
      ],
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const getResultsByPatientFromCloud = async (patientId) => {
  const user = await getCurrentUser();
  if (!user || !patientId) return [];

  const { data, error } = await supabase
    .from("game_results")
    .select("*")
    .eq("guardian_id", user.id)
    .eq("patient_id", patientId)
    .order("finished_at", { ascending: false });

  if (error) throw error;
  return data || [];
};
