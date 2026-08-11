import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

import pageBg from "../asset/home/background.webp";
import loginBtnImg from "../asset/home/login_dashboard.webp";
import continueBtnImg from "../asset/home/login_again.webp";

const ROLE_ROUTES = {
  guardian: "/child-select",
  parent: "/child-select",
};

const CLINICIAN_ROLES = ["clinician", "medical", "doctor"];

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isContinueLoading, setIsContinueLoading] = useState(false);
  const navigate = useNavigate();

  const showMessage = (text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  };

  const getChineseAuthError = (error) => {
    const text = `${error?.message || ""}`.toLowerCase();

    if (text.includes("invalid login credentials")) {
      return "登入失敗，請確認 Email 或密碼是否正確。";
    }

    if (text.includes("email not confirmed")) {
      return "此帳號尚未完成 Email 驗證，請先到信箱確認驗證信。";
    }

    if (text.includes("too many requests") || text.includes("rate limit")) {
      return "嘗試次數過多，請稍後再試。";
    }

    if (text.includes("network") || text.includes("fetch")) {
      return "目前網路連線不穩，請稍後再試。";
    }

    return "登入失敗，請稍後再試，或確認帳號資料是否正確。";
  };

  const redirectByRole = async (userId) => {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || !profileData?.role) {
      showMessage("找不到此帳號的角色資料，請確認是否已完成註冊流程。", "error");
      return false;
    }

    const role = String(profileData.role).toLowerCase();

    if (CLINICIAN_ROLES.includes(role)) {
      await supabase.auth.signOut();
      showMessage("這裡是使用者登入入口，醫療人員請使用首頁右上角的「醫療人員入口」。", "error");
      return false;
    }

    const targetRoute = ROLE_ROUTES[role];

    if (!targetRoute) {
      showMessage("此帳號目前不是家長帳號，請確認登入入口是否正確。", "error");
      return false;
    }

    navigate(targetRoute, { replace: true });
    return true;
  };

  const handleLogin = async (event) => {
    event?.preventDefault();

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      showMessage("請先輸入 Email 和密碼。", "error");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      showMessage(getChineseAuthError(error), "error");
      setIsLoading(false);
      return;
    }

    const user = data?.user;

    if (!user) {
      showMessage("找不到使用者資料，請稍後再試。", "error");
      setIsLoading(false);
      return;
    }

    const redirected = await redirectByRole(user.id);
    if (!redirected) setIsLoading(false);
  };

  const handleContinueSession = async () => {
    setIsContinueLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      showMessage("無法確認目前登入狀態，請重新登入。", "error");
      setIsContinueLoading(false);
      return;
    }

    const user = data?.session?.user;

    if (!user) {
      showMessage("目前沒有已登入的家長帳號，請輸入 Email 和密碼登入。", "error");
      setIsContinueLoading(false);
      return;
    }

    const redirected = await redirectByRole(user.id);
    if (!redirected) setIsContinueLoading(false);
  };

  const handleResetPassword = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      showMessage("請先輸入 Email，再點選忘記密碼。", "error");
      return;
    }

    setIsResetLoading(true);
    setMessage("");

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    if (error) {
      showMessage("密碼重設信寄送失敗，請確認 Email 是否正確。", "error");
      setIsResetLoading(false);
      return;
    }

    showMessage("密碼重設信已寄出，請到信箱查看。", "success");
    setIsResetLoading(false);
  };

  const isBusy = isLoading || isResetLoading || isContinueLoading;

  return (
    <div className="login-page">
      <style>{styles}</style>

      <main className="login-stage" aria-label="使用者登入頁面">
        <section className="login-panel" aria-label="使用者登入表單">
          <header className="login-header">
            <h1>使用者登入</h1>
            <p>請輸入家長帳號資料</p>
          </header>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="field-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="請輸入 Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isBusy}
              />
            </div>

            <div className="field-group password-group">
              <div className="password-row">
                <label htmlFor="login-password">密碼</label>
                <button type="button" onClick={handleResetPassword} disabled={isBusy}>
                  {isResetLoading ? "寄送中..." : "忘記密碼？"}
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isBusy}
              />
            </div>

            {message && (
              <div className={`login-message ${messageType === "success" ? "success" : ""}`}>
                {message}
              </div>
            )}

            <button className="image-button login-submit" type="submit" disabled={isBusy}>
              <img width={1024} height={341} src={loginBtnImg} alt={isLoading ? "登入中" : "登入"} />
              <span>{isLoading ? "登入中..." : "登入"}</span>
            </button>
          </form>

          <button
            className="image-button continue-button"
            type="button"
            onClick={handleContinueSession}
            disabled={isBusy}
          >
            <img width={1024} height={341} loading="lazy" src={continueBtnImg} alt={isContinueLoading ? "確認中" : "繼續上次登入"} />
            <span>{isContinueLoading ? "確認中..." : "繼續上次登入"}</span>
          </button>
        </section>
      </main>
    </div>
  );
}

const styles = `
  .login-page {
    width: 100%;
    min-height: 100vh;
    overflow: hidden;
    background-image: url(${pageBg});
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .login-stage {
    position: relative;
    width: 100vw;
    height: 100vh;
    min-height: 760px;
  }

  .login-panel {
    position: absolute;
    right: clamp(58px, 6.3vw, 112px);
    top: clamp(30px, 5.8vh, 62px);
    width: clamp(410px, 31.5vw, 520px);
    padding: clamp(28px, 3.3vh, 38px) clamp(28px, 3vw, 44px) clamp(24px, 3vh, 34px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    border-radius: clamp(30px, 3vw, 42px);
    background:
      linear-gradient(180deg, rgba(255, 253, 244, 0.88), rgba(255, 245, 222, 0.78)),
      radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0) 58%);
    border: 4px solid rgba(255, 233, 183, 0.78);
    box-shadow:
      0 20px 44px rgba(53, 77, 42, 0.18),
      0 8px 20px rgba(124, 88, 33, 0.13),
      inset 0 1px 0 rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
  }

  .login-header {
    text-align: center;
    margin-bottom: clamp(34px, 5vh, 54px);
  }

  .login-header h1 {
    margin: 0;
    color: #19628e;
    font-size: clamp(34px, 3.25vw, 48px);
    font-weight: 950;
    letter-spacing: 0.06em;
    line-height: 1.08;
    text-shadow: 0 3px 0 rgba(255, 255, 255, 0.72);
  }

  .login-header p {
    margin: 16px 0 0;
    color: #5d503f;
    font-size: clamp(15px, 1.25vw, 18px);
    font-weight: 950;
    text-shadow: 0 2px 0 rgba(255, 255, 255, 0.64);
  }

  .login-form {
    width: 100%;
  }

  .field-group {
    margin-bottom: clamp(28px, 4vh, 38px);
  }

  .password-group {
    margin-bottom: clamp(12px, 1.8vh, 18px);
  }

  .field-group label,
  .password-row label {
    color: #5f4326;
    font-size: clamp(15px, 1.2vw, 18px);
    font-weight: 950;
    text-shadow: 0 2px 0 rgba(255, 255, 255, 0.62);
  }

  .password-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .password-row button {
    border: 0;
    background: transparent;
    color: #176c99;
    font-size: clamp(13px, 1vw, 16px);
    font-weight: 950;
    cursor: pointer;
    padding: 0;
  }

  .password-row button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .field-group input {
    width: 100%;
    height: clamp(58px, 7.2vh, 72px);
    margin-top: 12px;
    padding: 0 clamp(20px, 2vw, 26px);
    border-radius: 22px;
    border: 2px solid #f2b442;
    background: rgba(234, 243, 255, 0.92);
    box-shadow: inset 0 3px 8px rgba(138, 101, 40, 0.08), 0 3px 7px rgba(149, 100, 26, 0.05);
    box-sizing: border-box;
    color: #081423;
    font-size: clamp(16px, 1.35vw, 20px);
    font-weight: 850;
    outline: none;
  }

  .field-group input::placeholder {
    color: #9aa5b2;
    font-weight: 750;
  }

  .field-group input:focus {
    border-color: #e7a94c;
    background: rgba(237, 246, 255, 0.98);
    box-shadow: 0 0 0 4px rgba(255, 217, 127, 0.24), inset 0 3px 8px rgba(138, 101, 40, 0.08);
  }

  .field-group input:disabled {
    opacity: 0.68;
  }

  .login-message {
    margin: -16px 0 16px;
    padding: 10px 14px;
    border-radius: 16px;
    background: rgba(255, 236, 205, 0.93);
    border: 2px solid #ffc46e;
    color: #9b5f11;
    font-size: 14px;
    font-weight: 850;
    line-height: 1.45;
    text-align: center;
  }

  .login-message.success {
    background: rgba(237, 248, 223, 0.96);
    border-color: #b8dc83;
    color: #4d721d;
  }

  .image-button {
    width: min(100%, 380px);
    overflow: hidden;
    border: 0;
    background: transparent;
    padding: 0;
    margin-left: auto;
    margin-right: auto;
    cursor: pointer;
    display: block;
    position: relative;
    transition: transform 0.15s ease, filter 0.15s ease;
  }

  .image-button img {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: auto;
    display: block;
    transform: translateY(-50%);
    pointer-events: none;
    user-select: none;
    filter: drop-shadow(0 7px 7px rgba(117, 75, 23, 0.18));
  }

  .image-button span {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .image-button:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.015);
    filter: brightness(1.04);
  }

  .image-button:active:not(:disabled) {
    transform: translateY(1px) scale(0.99);
  }

  .image-button:disabled {
    cursor: not-allowed;
    opacity: 0.68;
    filter: grayscale(0.12);
  }

  .login-submit {
    height: clamp(132px, 18vh, 160px);
    margin-top: 0;
  }

  .continue-button {
    width: min(100%, 330px);
    height: clamp(146px, 20vh, 176px);
    margin-top: 0;
  }

  /* The button artwork includes generous transparent space. Keep that space
     from making the form taller than a landscape tablet viewport. */
  @media (min-width: 700px) and (max-height: 820px) {
    .login-page .login-stage {
      min-height: 100vh;
    }

    .login-page .login-panel {
      top: clamp(14px, 2.5vh, 22px);
      padding-top: 20px;
      padding-bottom: 18px;
    }

    .login-panel .login-header {
      margin-bottom: 16px;
    }

    .login-panel .login-header h1 {
      font-size: clamp(30px, 3.25vw, 40px);
    }

    .login-panel .login-header p {
      margin-top: 8px;
    }

    .login-panel .field-group {
      margin-bottom: 14px;
    }

    .login-panel .password-group {
      margin-bottom: 6px;
    }

    .login-panel .field-group input {
      height: 54px;
      margin-top: 8px;
    }

    .login-panel .login-submit {
      height: 112px;
    }

    .login-panel .continue-button {
      height: 124px;
    }
  }

  @media (max-width: 1100px) {
    .login-stage {
      min-height: 720px;
    }

    .login-panel {
      right: 4.5vw;
      top: 6vh;
      width: min(45vw, 470px);
      padding-left: 26px;
      padding-right: 26px;
    }

    .login-header {
      margin-bottom: 28px;
    }

    .field-group {
      margin-bottom: 24px;
    }
  }

  @media (max-width: 900px) {
    .login-page {
      min-height: 100dvh;
      overflow: auto;
      background-image: linear-gradient(rgba(255, 248, 230, 0.48), rgba(255, 248, 230, 0.58)), url(${pageBg});
      background-position: 38% center;
      padding: 26px 16px;
      box-sizing: border-box;
    }

    .login-stage {
      width: 100%;
      height: auto;
      min-height: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    .login-panel {
      position: relative;
      right: auto;
      top: auto;
      width: min(440px, 100%);
      min-height: auto;
      padding: 34px 26px;
      border-radius: 34px;
      background: linear-gradient(180deg, rgba(255, 253, 242, 0.94), rgba(255, 245, 221, 0.92));
      border: 4px solid rgba(255, 228, 174, 0.95);
      box-shadow: 0 18px 36px rgba(94, 74, 35, 0.22);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }
  }

  @media (max-width: 480px) {
    .login-page {
      padding: 18px 12px;
      background-position: 35% center;
    }

    .login-panel {
      padding: 28px 18px;
      border-radius: 28px;
    }

    .image-button {
      width: min(320px, 96%);
    }
  }
`;

export default LoginPage;
