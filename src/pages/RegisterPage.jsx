import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

import pageBg from "../asset/home/dashboard_background.webp";
import registerBtnImg from "../asset/home/register.webp";

function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [isLoading, setIsLoading] = useState(false);

  const showMessage = (text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  };

  const getChineseRegisterError = (error) => {
    const text = `${error?.message || ""}`.toLowerCase();

    if (text.includes("already registered") || text.includes("already been registered")) {
      return "這個 Email 已經註冊過了，請直接登入。";
    }

    if (text.includes("password") && text.includes("6")) {
      return "密碼至少需要 6 個字元。";
    }

    if (text.includes("invalid email")) {
      return "Email 格式不正確，請重新確認。";
    }

    if (text.includes("too many requests") || text.includes("rate limit")) {
      return "嘗試次數過多，請稍後再試。";
    }

    if (text.includes("network") || text.includes("fetch")) {
      return "目前網路連線不穩，請稍後再試。";
    }

    return "註冊失敗，請稍後再試，或確認資料是否正確。";
  };

  const handleRegister = async (event) => {
    event?.preventDefault();

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      showMessage("請完整填寫家長姓名、Email、密碼與確認密碼。", "error");
      return;
    }

    if (password.length < 6) {
      showMessage("密碼至少需要 6 個字元。", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("兩次輸入的密碼不一致，請重新確認。", "error");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          role: "guardian",
        },
      },
    });

    if (error) {
      showMessage(getChineseRegisterError(error), "error");
      setIsLoading(false);
      return;
    }

    const user = data?.user;

    if (!user) {
      showMessage("註冊已送出，請到信箱確認驗證信後再登入。", "success");
      setIsLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert([
      {
        id: user.id,
        email: cleanEmail,
        full_name: cleanName,
        role: "guardian",
      },
    ]);

    if (profileError) {
      showMessage("帳號已建立，但家長資料建立失敗，請稍後登入或聯絡管理者。", "error");
      setIsLoading(false);
      return;
    }

    showMessage("註冊成功！請到信箱確認驗證信，完成後即可登入。", "success");
    setIsLoading(false);
  };


  return (
    <div className="register-page">
      <style>{styles}</style>

      <main className="register-stage" aria-label="家長註冊頁面">
        <section className="register-panel" aria-label="家長註冊表單">

          <header className="register-header">
            <h1>家長註冊</h1>
            <p>建立家長帳號後即可管理孩子資料</p>
          </header>

          <form className="register-form" onSubmit={handleRegister}>
            <div className="field-group">
              <label htmlFor="register-name">家長姓名</label>
              <input
                id="register-name"
                type="text"
                placeholder="請輸入家長姓名"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                disabled={isLoading}
              />
            </div>

            <div className="field-group">
              <label htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                placeholder="請輸入 Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="field-group">
              <label htmlFor="register-password">密碼</label>
              <input
                id="register-password"
                type="password"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            <div className="field-group password-confirm-group">
              <label htmlFor="register-confirm-password">確認密碼</label>
              <input
                id="register-confirm-password"
                type="password"
                placeholder="請再次輸入密碼"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            {message && (
              <div className={`register-message ${messageType === "success" ? "success" : ""}`}>
                {message}
              </div>
            )}

            <button className="image-button register-submit" type="submit" disabled={isLoading}>
              <img width={1024} height={341} src={registerBtnImg} alt={isLoading ? "註冊中" : "註冊"} />
              <span>{isLoading ? "註冊中..." : "註冊"}</span>
            </button>
          </form>

        </section>
      </main>
    </div>
  );
}

const styles = `
  .register-page {
    width: 100%;
    min-height: 100vh;
    overflow: hidden;
    background-image: url(${pageBg});
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .register-stage {
    position: relative;
    width: 100vw;
    height: 100vh;
    min-height: 820px;
  }

  .register-panel {
    position: absolute;
    right: clamp(58px, 6.3vw, 112px);
    top: clamp(18px, 3.6vh, 42px);
    width: clamp(410px, 31.5vw, 520px);
    padding: clamp(26px, 3.1vh, 36px) clamp(28px, 3vw, 44px) clamp(24px, 3vh, 34px);
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

  .register-avatar {
    width: clamp(66px, 5.8vw, 92px);
    height: clamp(66px, 5.8vw, 92px);
    margin: 0 auto clamp(20px, 2.5vh, 28px);
    border-radius: 50%;
    background: radial-gradient(circle at 35% 28%, #fffce3 0%, #fff2aa 55%, #ffd66e 100%);
    border: 6px solid rgba(255, 255, 255, 0.92);
    box-shadow: 0 10px 22px rgba(97, 70, 28, 0.18), inset 0 -4px 8px rgba(234, 169, 56, 0.18);
    display: grid;
    place-items: center;
    font-size: clamp(32px, 3vw, 44px);
  }

  .register-header {
    text-align: center;
    margin-bottom: clamp(22px, 3.2vh, 36px);
  }

  .register-header h1 {
    margin: 0;
    color: #19628e;
    font-size: clamp(34px, 3.25vw, 48px);
    font-weight: 950;
    letter-spacing: 0.06em;
    line-height: 1.08;
    text-shadow: 0 3px 0 rgba(255, 255, 255, 0.72);
  }

  .register-header p {
    margin: 14px 0 0;
    color: #5d503f;
    font-size: clamp(15px, 1.25vw, 18px);
    font-weight: 950;
    text-shadow: 0 2px 0 rgba(255, 255, 255, 0.64);
  }

  .register-form {
    width: 100%;
  }

  .field-group {
    margin-bottom: clamp(18px, 2.7vh, 28px);
  }

  .password-confirm-group {
    margin-bottom: clamp(24px, 3.2vh, 34px);
  }

  .field-group label {
    color: #5f4326;
    font-size: clamp(15px, 1.2vw, 18px);
    font-weight: 950;
    text-shadow: 0 2px 0 rgba(255, 255, 255, 0.62);
  }

  .field-group input {
    width: 100%;
    height: clamp(56px, 6.8vh, 68px);
    margin-top: 10px;
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

  .register-message {
    margin: -12px 0 16px;
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

  .register-message.success {
    background: rgba(237, 248, 223, 0.96);
    border-color: #b8dc83;
    color: #4d721d;
  }

  .image-button {
    width: min(100%, 300px);
    border: 0;
    background: transparent;
    padding: 0;
    margin-left: auto;
    margin-right: auto;
    cursor: pointer;
    display: block;
    position: relative;
    transition: transform 0.15s ease, filter 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .image-button img {
    width: 100%;
    height: auto;
    display: block;
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

  .image-button:hover:not(:disabled),
  .image-button:focus-visible:not(:disabled) {
    transform: translateY(-2px) scale(1.015);
    filter: brightness(1.04);
    outline: none;
  }

  .image-button:active:not(:disabled) {
    transform: translateY(1px) scale(0.99);
  }

  .image-button:disabled {
    cursor: not-allowed;
    opacity: 0.68;
    filter: grayscale(0.12);
  }

  .register-submit {
    margin-top: 0;
  }


  @media (max-width: 1100px) {
    .register-stage {
      min-height: 780px;
    }

    .register-panel {
      right: 4.5vw;
      top: 3vh;
      width: min(45vw, 470px);
      padding-left: 26px;
      padding-right: 26px;
    }

    .register-header {
      margin-bottom: 24px;
    }

    .field-group {
      margin-bottom: 18px;
    }
  }

  @media (max-width: 900px) {
    .register-page {
      min-height: 100dvh;
      overflow: auto;
      background-image: linear-gradient(rgba(255, 248, 230, 0.48), rgba(255, 248, 230, 0.58)), url(${pageBg});
      background-position: 38% center;
      padding: 26px 16px;
      box-sizing: border-box;
    }

    .register-stage {
      width: 100%;
      height: auto;
      min-height: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    .register-panel {
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
    .register-page {
      padding: 18px 12px;
      background-position: 35% center;
    }

    .register-panel {
      padding: 28px 18px;
      border-radius: 28px;
    }

    .image-button {
      width: min(260px, 94%);
    }
  }
`;

export default RegisterPage;
