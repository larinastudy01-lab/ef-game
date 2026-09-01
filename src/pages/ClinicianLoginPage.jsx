import bgImg from "../asset/Home_background.webp";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const CLINICIAN_ROLES = ["clinician", "medical", "doctor", "醫療人員"];

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isClinicianRole(role) {
  return CLINICIAN_ROLES.includes(normalizeRole(role));
}

function ClinicianLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getProfileRole = useCallback(async (userId) => {
    if (!userId) {
      return { role: null, error: new Error("Missing user id") };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    return { role: profile?.role ?? null, error };
  }, []);

  const redirectByRole = useCallback(async (role) => {
    if (normalizeRole(role) === "admin") {
      navigate("/admin/clinician-applications", { replace: true });
      return;
    }
    if (isClinicianRole(role)) {
      navigate("/clinician-dashboard", { replace: true });
      return;
    }

    // The clinician portal is an independent entry point. If a parent/child
    // session is still active, clear it and keep showing the clinician login
    // form instead of sending the user back to the game menu.
    await supabase.auth.signOut();
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user || !isMounted) return;

        const { role, error: profileError } = await getProfileRole(session.user.id);

        if (!isMounted) return;

        if (profileError || !role) {
          await supabase.auth.signOut();
          return;
        }

        await redirectByRole(role);
      } catch (error) {
        console.error("Failed to validate existing clinician session:", error);
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [getProfileRole, redirectByRole]);

  const getLoginErrorMessage = (error) => {
    const rawMessage = error?.message?.toLowerCase() || "";

    if (rawMessage.includes("invalid login credentials")) {
      return "帳號不存在或密碼錯誤，請確認後再試。";
    }

    if (rawMessage.includes("email not confirmed")) {
      return "此帳號尚未完成 Email 驗證，請先至信箱完成確認。";
    }

    if (rawMessage.includes("too many requests")) {
      return "登入嘗試次數過多，請稍後再試。";
    }

    return "登入失敗，請確認帳號狀態或聯絡系統管理者。";
  };

  const handleClinicianLogin = async (e) => {
    e.preventDefault();

    if (isLoading) return;

    const normalizedEmail = email.trim().toLowerCase();
    setMessage("");

    if (!normalizedEmail || !password) {
      setMessage("請先輸入醫療人員 Email 與密碼。只限醫療端帳號登入。");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data?.user) {
        setMessage(getLoginErrorMessage(error));
        return;
      }

      const { role, error: profileError } = await getProfileRole(data.user.id);

      if (profileError || !role) {
        await supabase.auth.signOut();
        setMessage("找不到此帳號的權限資料，請聯絡系統管理者建立醫療人員權限。");
        return;
      }

      if (!isClinicianRole(role) && normalizeRole(role) !== "admin") {
        await supabase.auth.signOut();
        setPassword("");
        setMessage("此頁面僅供醫療人員使用。家長帳號請返回首頁，改由家長入口登入。");
        return;
      }

      navigate("/clinician-dashboard", { replace: true });
    } catch (error) {
      console.error("Clinician login failed:", error);
      setMessage("登入流程發生異常，請稍後再試或聯絡系統管理者。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="clinician-login-page">
      <style>{`
        .clinician-login-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 38px;
          box-sizing: border-box;
          background-image:
            linear-gradient(120deg, rgba(246, 251, 255, 0.82), rgba(234, 243, 250, 0.72)),
            url(${bgImg});
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          overflow: hidden;
          font-family: "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;
        }

        .clinician-login-shell {
          width: min(1080px, 100%);
          min-height: 560px;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 34px;
          align-items: stretch;
          padding: 42px;
          border-radius: 34px;
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(144, 174, 199, 0.45);
          box-shadow: 0 24px 60px rgba(28, 68, 96, 0.22);
          backdrop-filter: blur(8px);
          box-sizing: border-box;
        }

        .clinician-info-panel {
          padding: 36px;
          border-radius: 28px;
          background: linear-gradient(145deg, #f7fbff, #eaf4fb);
          border: 1px solid rgba(137, 174, 204, 0.42);
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }

        .clinician-badge {
          width: fit-content;
          padding: 9px 16px;
          border-radius: 999px;
          background: rgba(41, 103, 151, 0.1);
          border: 1px solid rgba(41, 103, 151, 0.22);
          color: #245d86;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .clinician-title {
          margin: 24px 0 14px;
          color: #173f5f;
          font-size: 48px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .clinician-subtitle {
          margin: 0;
          color: #4f6475;
          font-size: 18px;
          line-height: 1.8;
          font-weight: 650;
        }

        .permission-list {
          margin-top: 30px;
          display: grid;
          gap: 14px;
        }

        .permission-item {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 16px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.76);
          border: 1px solid rgba(139, 170, 194, 0.32);
        }

        .permission-icon {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #dceef8;
          color: #20577d;
          font-size: 21px;
        }

        .permission-title {
          color: #244d69;
          font-size: 16px;
          font-weight: 900;
        }

        .permission-text {
          margin-top: 3px;
          color: #667989;
          font-size: 14px;
          line-height: 1.55;
          font-weight: 600;
        }

        .login-card {
          padding: 34px;
          border-radius: 28px;
          background: #ffffff;
          border: 1px solid rgba(154, 180, 201, 0.46);
          box-shadow: 0 16px 34px rgba(39, 83, 116, 0.13);
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }

        .form-header {
          margin-bottom: 24px;
          text-align: left;
        }

        .medical-mark {
          width: 64px;
          height: 64px;
          margin-bottom: 16px;
          border-radius: 20px;
          background: linear-gradient(145deg, #e9f5fb, #cfe8f6);
          border: 1px solid rgba(55, 113, 155, 0.24);
          color: #1f628f;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
        }

        .form-title {
          margin: 0;
          color: #163b59;
          font-size: 30px;
          font-weight: 900;
        }

        .form-subtitle {
          margin: 8px 0 0;
          color: #6b7e8c;
          font-size: 15px;
          line-height: 1.6;
          font-weight: 650;
        }

        .clinician-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group label {
          display: block;
          margin-bottom: 8px;
          color: #244d69;
          font-size: 15px;
          font-weight: 900;
        }

        .input-group input {
          width: 100%;
          padding: 15px 16px;
          border-radius: 16px;
          border: 1.8px solid #c8d9e6;
          background: #fbfdff;
          color: #233746;
          font-size: 16px;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .input-group input:focus {
          border-color: #4289b8;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(66, 137, 184, 0.13);
        }

        .notice-box {
          margin-top: 4px;
          padding: 13px 14px;
          border-radius: 16px;
          background: #f3f8fc;
          border: 1px solid rgba(92, 139, 174, 0.28);
          color: #516b7e;
          font-size: 14px;
          line-height: 1.55;
          font-weight: 700;
        }

        .error-message {
          padding: 13px 14px;
          border-radius: 16px;
          background: #fff4f0;
          border: 1px solid #f2b59f;
          color: #a13e21;
          font-size: 14px;
          line-height: 1.55;
          font-weight: 800;
        }

        .primary-button,
        .secondary-button {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }

        .primary-button {
          margin-top: 4px;
          border: 0;
          background: linear-gradient(135deg, #235d87, #3f8fbf);
          color: white;
          box-shadow: 0 12px 22px rgba(36, 93, 134, 0.24);
        }

        .primary-button:hover:not(:disabled),
        .secondary-button:hover {
          transform: translateY(-1px);
        }

        .primary-button:disabled {
          opacity: 0.72;
          cursor: not-allowed;
        }

        .secondary-button {
          margin-top: 14px;
          border: 1.8px solid #c9d9e5;
          background: #ffffff;
          color: #315a75;
        }

        @media (max-width: 900px) {
          .clinician-login-page {
            padding: 22px;
            overflow: auto;
          }

          .clinician-login-shell {
            grid-template-columns: 1fr;
            padding: 24px;
            gap: 20px;
            min-height: auto;
          }

          .clinician-info-panel,
          .login-card {
            padding: 26px;
          }

          .clinician-title {
            font-size: 38px;
          }
        }

        @media (max-width: 560px) {
          .clinician-login-page {
            padding: 14px;
          }

          .clinician-login-shell {
            padding: 16px;
            border-radius: 24px;
          }

          .clinician-info-panel,
          .login-card {
            padding: 22px;
            border-radius: 22px;
          }

          .clinician-title {
            font-size: 32px;
          }

          .clinician-subtitle {
            font-size: 16px;
          }
        }
      `}</style>

      <main className="clinician-login-shell" aria-label="醫療端登入頁面">
        <section className="clinician-info-panel">
          <div className="clinician-badge">Medical Portal Only</div>
          <h1 className="clinician-title">醫療端登入</h1>
          <p className="clinician-subtitle">
            此入口提供醫療人員查看兒童測驗資料、訓練紀錄、追蹤摘要與回診提醒。若您是家長，請返回首頁使用家長入口登入。
          </p>

          <div className="permission-list" aria-label="醫療端權限說明">
            <div className="permission-item">
              <div className="permission-icon">□</div>
              <div>
                <div className="permission-title">醫療人員專用帳號</div>
                <div className="permission-text">
                  醫療端帳號由管理者建立與授權，非 clinician role 帳號將無法進入後台。
                </div>
              </div>
            </div>

            <div className="permission-item">
              <div className="permission-icon">✓</div>
              <div>
                <div className="permission-title">登入後進入 Clinician Dashboard</div>
                <div className="permission-text">
                  成功驗證後會直接進入醫療端儀表板，便於查看病患與兒童資料。
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="login-card">
          <div className="form-header">
            <div className="medical-mark">＋</div>
            <h2 className="form-title">醫療人員登入</h2>
            <p className="form-subtitle">
              請使用管理者核發的 Email 與密碼登入。此頁面不提供一般家長帳號登入。
            </p>
          </div>

          <form onSubmit={handleClinicianLogin} className="clinician-form">
            <div className="input-group">
              <label htmlFor="clinician-email">醫療人員 Email</label>
              <input
                id="clinician-email"
                type="email"
                placeholder="example@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="clinician-password">密碼</label>
              <input
                id="clinician-password"
                type="password"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="notice-box">
              醫療人員帳號需由管理者建立。若無法登入，請確認帳號是否已被授權為 clinician role。
            </div>

            {message && <div className="error-message">{message}</div>}

            <button type="submit" className="primary-button" disabled={isLoading}>
              {isLoading ? "驗證中..." : "登入醫療端"}
            </button>
          </form>

          <button type="button" onClick={() => navigate("/")} className="secondary-button">
            返回首頁 / 家長入口
          </button>
          <button type="button" onClick={() => navigate("/clinician-apply")} className="secondary-button">
            申請醫療帳號
          </button>
        </section>
      </main>
    </div>
  );
}

export default ClinicianLoginPage;
