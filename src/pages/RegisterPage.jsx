import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
<<<<<<< HEAD
import homeBackground from "../asset/Home_background.png";

const ROLE_OPTIONS = {
  guardian: {
    label: "家長帳號",
    shortLabel: "家長",
    description: "建立兒童檔案，查看測驗、訓練紀錄與提醒。",
  },
  clinician: {
    label: "醫療端帳號",
    shortLabel: "醫療端",
    description: "查看兒童資料、追蹤表現變化與回診提醒。",
  },
};

function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("guardian");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const goLogin = () => {
    window.location.href = "/login";
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
  };

  const getChineseError = (errorMessage = "") => {
    const text = errorMessage.toLowerCase();

    if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
      return "這個 Email 已經註冊過，請直接登入或改用其他 Email。";
    }

    if (text.includes("invalid email")) {
      return "Email 格式不正確，請重新確認。";
    }

    if (text.includes("password") && text.includes("6")) {
      return "密碼至少需要 6 位數。";
    }

    if (text.includes("password")) {
      return "密碼格式不符合規定，請重新設定。";
    }

    if (text.includes("network") || text.includes("fetch")) {
      return "目前網路連線不穩，請稍後再試。";
    }

    if (text.includes("rate limit") || text.includes("too many")) {
      return "嘗試次數過多，請稍後再試。";
    }

    return "註冊失敗，請確認資料後再試一次。";
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      showMessage("error", "請填寫 Email 與密碼。");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      showMessage("error", "Email 格式不正確，請重新確認。");
      return;
    }

    if (password.length < 6) {
      showMessage("error", "密碼至少需要 6 位數。");
      return;
    }

    setLoading(true);
    showMessage("", "");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            role,
          },
        },
      });

      if (error) {
        showMessage("error", getChineseError(error.message));
        return;
      }

      const user = data?.user;

      if (user) {
        const { error: profileError } = await supabase.from("profiles").upsert([
          {
            id: user.id,
            email: trimmedEmail,
            role,
          },
        ]);

        if (profileError) {
          showMessage("error", "帳號已建立，但個人資料建立失敗。請登入後再確認資料。");
          return;
        }
      }

      setPassword("");
      showMessage(
        "success",
        "註冊成功！如果系統已開啟 Supabase Email 驗證，請到信箱點擊確認信後再登入。"
      );
    } catch (err) {
      showMessage("error", getChineseError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <section className="register-card">
        <div className="register-icon" aria-hidden="true">
          🐝
        </div>

        <div className="register-left">
          <p className="register-kicker">動物森友會</p>
          <h1 className="register-title">建立帳號</h1>
          <p className="register-subtitle">
            只需要 Email、密碼與身分，就能開始使用幼兒執行功能評測與訓練平台。
          </p>

          <div className="role-switch" aria-label="選擇註冊身分">
            {Object.entries(ROLE_OPTIONS).map(([value, option]) => (
              <button
                key={value}
                type="button"
                className={role === value ? "role-btn active" : "role-btn"}
                onClick={() => setRole(value)}
                aria-pressed={role === value}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>

          <div className="role-info" aria-live="polite">
            <span className="role-info-badge">{ROLE_OPTIONS[role].label}</span>
            <p>{ROLE_OPTIONS[role].description}</p>
          </div>

          <div className="register-note">
            <span>✉️</span>
            <p>註冊後請留意信箱。若有驗證信，完成確認後即可登入。</p>
          </div>
        </div>

        <form className="register-form" onSubmit={handleRegister} noValidate>
          <div className="form-grid">
            <div className="field-block full-row">
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="register-input"
                type="email"
                placeholder="example@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field-block full-row">
              <label className="field-label" htmlFor="password">
                密碼
              </label>
              <input
                id="password"
                className="register-input"
                type="password"
                placeholder="至少 6 位數"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="field-block full-row">
              <label className="field-label" htmlFor="roleSelect">
                註冊身分
              </label>
              <select
                id="roleSelect"
                className="register-input register-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="guardian">家長帳號</option>
                <option value="clinician">醫療端帳號</option>
              </select>
            </div>
          </div>

          {message.text && <div className={`register-message ${message.type}`}>{message.text}</div>}

          <button className="register-submit" type="submit" disabled={loading}>
            {loading ? "註冊中..." : "建立帳號"}
          </button>

          <button className="login-link" type="button" onClick={goLogin}>
            已經有帳號？前往登入
          </button>
        </form>
      </section>

      <style>{`
        html,
        body,
        #root {
          width: 100%;
          min-height: 100%;
        }

        body {
          margin: 0;
        }

        .register-page {
          width: 100%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 44px;
          box-sizing: border-box;
          overflow: hidden;
          background-color: #7ecb55;
          background-image: url(${homeBackground}), linear-gradient(180deg, #73caff 0%, #bff0ff 32%, #78ca56 33%, #4ba744 100%);
          background-size: cover, cover;
          background-position: center, center;
          background-repeat: no-repeat;
          font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .register-card {
          position: relative;
          width: min(1040px, 100%);
          min-height: 520px;
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: 34px;
          padding: 54px 44px 38px;
          box-sizing: border-box;
          border-radius: 36px;
          background: rgba(255, 255, 240, 0.94);
          border: 6px solid #ffefad;
          box-shadow: 0 24px 46px rgba(44, 90, 44, 0.26), inset 0 0 0 2px rgba(255, 255, 255, 0.88);
        }

        .register-icon {
          position: absolute;
          top: -48px;
          left: 50%;
          width: 108px;
          height: 108px;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: linear-gradient(180deg, #fff7c7 0%, #ffe58b 100%);
          border: 5px solid #ffefad;
          box-shadow: 0 14px 25px rgba(154, 103, 19, 0.2);
          font-size: 46px;
          z-index: 2;
        }

        .register-left {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 22px 10px 18px;
        }

        .register-kicker {
          margin: 0 0 8px;
          color: #d49a06;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: 0.03em;
        }

        .register-title {
          margin: 0;
          color: #1f65ad;
          font-size: clamp(34px, 4vw, 48px);
          line-height: 1.08;
          font-weight: 950;
          letter-spacing: 0.04em;
        }

        .register-subtitle {
          margin: 16px 0 24px;
          max-width: 430px;
          color: #607957;
          font-size: 16px;
          font-weight: 850;
          line-height: 1.7;
        }

        .role-switch {
          width: 100%;
          max-width: 430px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 7px;
          border-radius: 999px;
          background: #fff1c4;
        }

        .role-btn {
          min-height: 48px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #7f6c35;
          font-size: 17px;
          font-weight: 950;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }

        .role-btn.active {
          background: linear-gradient(180deg, #fff7d7 0%, #ffd967 100%);
          color: #805000;
          box-shadow: inset 0 0 0 3px #202020, 0 8px 14px rgba(146, 96, 10, 0.18);
        }

        .role-info,
        .register-note {
          max-width: 430px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-top: 18px;
          padding: 15px 18px;
          border-radius: 22px;
          color: #526b45;
          font-size: 14px;
          font-weight: 850;
          line-height: 1.65;
        }

        .role-info {
          flex-direction: column;
          gap: 6px;
          background: rgba(232, 246, 255, 0.8);
          border: 2px solid rgba(145, 202, 235, 0.75);
        }

        .role-info-badge {
          width: fit-content;
          padding: 4px 12px;
          border-radius: 999px;
          background: #ffffff;
          color: #1f65ad;
          font-size: 13px;
          font-weight: 950;
        }

        .register-note {
          background: rgba(255, 239, 188, 0.72);
        }

        .role-info p,
        .register-note p {
          margin: 0;
        }

        .register-form {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          padding: 22px;
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.46);
          box-shadow: inset 0 0 0 2px rgba(255, 246, 205, 0.7);
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          row-gap: 18px;
        }

        .field-block {
          min-width: 0;
        }

        .full-row {
          grid-column: 1 / -1;
        }

        .field-label {
          display: block;
          margin: 0 0 8px;
          color: #236832;
          font-size: 16px;
          font-weight: 950;
        }

        .register-input {
          width: 100%;
          height: 58px;
          padding: 0 18px;
          box-sizing: border-box;
          border-radius: 18px;
          border: 2px solid #f2c75e;
          outline: none;
          background: rgba(255, 255, 255, 0.93);
          color: #233323;
          font-size: 17px;
          font-weight: 800;
          box-shadow: inset 0 2px 8px rgba(116, 91, 31, 0.05);
        }

        .register-select {
          cursor: pointer;
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, #805000 50%), linear-gradient(135deg, #805000 50%, transparent 50%);
          background-position: calc(100% - 22px) 25px, calc(100% - 15px) 25px;
          background-size: 7px 7px, 7px 7px;
          background-repeat: no-repeat;
        }

        .register-input:focus {
          background-color: #eaf2ff;
          border-color: #efbf42;
          box-shadow: 0 0 0 4px rgba(255, 221, 104, 0.28);
        }

        .register-input::placeholder {
          color: #8f8f8f;
          font-weight: 800;
        }

        .register-message {
          margin: 18px 0 0;
          padding: 12px 14px;
          border-radius: 15px;
          font-size: 14px;
          font-weight: 850;
          line-height: 1.5;
        }

        .register-message.error {
          color: #b44a31;
          background: #fff0ec;
          border: 1px solid #ffc2b5;
        }

        .register-message.success {
          color: #3d7b2f;
          background: #effbe8;
          border: 1px solid #bde4a6;
        }

        .register-submit {
          width: 100%;
          min-height: 64px;
          margin-top: 26px;
          border: 0;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffd45f 0%, #f9a91f 100%);
          color: #805000;
          font-size: 20px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 14px 20px rgba(174, 114, 18, 0.24);
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        .register-submit:hover {
          filter: brightness(1.03);
        }

        .register-submit:active,
        .role-btn:active,
        .login-link:active {
          transform: scale(0.98);
        }

        .register-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-link {
          width: fit-content;
          align-self: center;
          margin-top: 18px;
          border: 0;
          background: transparent;
          color: #1768b4;
          font-size: 16px;
          font-weight: 950;
          cursor: pointer;
        }

        @media (max-width: 900px) {
          .register-page {
            align-items: flex-start;
            overflow-y: auto;
            padding: 72px 22px 30px;
          }

          .register-card {
            min-height: auto;
            grid-template-columns: 1fr;
            gap: 20px;
            padding: 62px 28px 28px;
          }

          .register-left {
            align-items: center;
            text-align: center;
            padding: 0;
          }

          .register-subtitle,
          .role-switch,
          .role-info,
          .register-note {
            max-width: 100%;
          }

          .register-form {
            padding: 20px;
          }
        }

        @media (max-width: 620px) {
          .register-page {
            padding: 68px 14px 24px;
          }

          .register-card {
            border-radius: 30px;
            padding-left: 18px;
            padding-right: 18px;
          }

          .register-form {
            padding: 16px;
            border-radius: 24px;
          }

          .register-input {
            height: 56px;
            font-size: 16px;
          }
        }
      `}</style>
    </main>
  );
}

export default RegisterPage;

=======

function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      alert("請填寫完整資料");
      return;
    }

    // 1. 註冊 Auth 帳號
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("註冊失敗：" + error.message);
      return;
    }

    const user = data.user;

    if (!user) {
      alert("找不到使用者資料");
      return;
    }

    // 2. 建立 profiles 資料
    const { error: profileError } = await supabase
      .from("profiles")
      .insert([
        {
          id: user.id,
          email: email,
          full_name: fullName,
          role: "guardian",
        },
      ]);

    if (profileError) {
      alert("建立個人資料失敗：" + profileError.message);
      return;
    }

    alert("註冊成功！請登入");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff5e1, #ffd6a5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "20px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <h2 style={{ marginBottom: "20px" }}>家長註冊</h2>

        <input
          type="text"
          placeholder="家長姓名"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="密碼"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button onClick={handleRegister} style={buttonStyle}>
          註冊
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "15px",
  borderRadius: "10px",
  border: "1px solid #ccc",
  fontSize: "16px",
  boxSizing: "border-box",
};

const buttonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "none",
  backgroundColor: "#ff9f1c",
  color: "white",
  fontSize: "16px",
  cursor: "pointer",
};

export default RegisterPage;
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
