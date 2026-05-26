<<<<<<< HEAD
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // 開發時若尚未建立 .env，畫面仍可啟動，但登入/雲端資料功能會失敗並顯示錯誤。
  console.warn("Supabase 尚未設定：請在專案根目錄建立 .env，填入 REACT_APP_SUPABASE_URL 與 REACT_APP_SUPABASE_ANON_KEY。");
}

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder-anon-key");
=======
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
