import { supabase } from "./supabaseClient";

// Hosted Supabase must have Confirm Email disabled for signUp to return a session.
// Do not write protected profile data or report success without that session.
export async function registerWithImmediateSession({ email, password, metadata }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) throw error;

  if (!data?.user || !data?.session) {
    const sessionError = new Error("目前尚未開放註冊後直接登入，請聯絡管理者完成帳號設定。");
    sessionError.code = "SIGNUP_SESSION_REQUIRED";
    throw sessionError;
  }

  return data;
}
