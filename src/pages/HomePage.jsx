<<<<<<< HEAD
import { useNavigate } from "react-router-dom";

import homeBackground from "../asset/home/background.png";
import loginButton from "../asset/home/login.png";
import registerButton from "../asset/home/register.png";
import medicalLoginButton from "../asset/home/dc_register.png";

const CLINICIAN_LOGIN_ROUTE = "/clinician-login";

function HomePage() {
  const navigate = useNavigate();

  const goGameLogin = () => {
    navigate("/login", { state: { role: "child" } });
  };

  const goRegister = () => {
    navigate("/register");
  };

  const goMedicalLogin = () => {
    navigate(CLINICIAN_LOGIN_ROUTE);
  };

  return (
    <main className="home-login-page" aria-label="動物森友會登入首頁">
      <style>{`
        html,
        body,
        #root {
          width: 100%;
          height: 100%;
          margin: 0;
        }

        .home-login-page {
          position: relative;
          width: 100vw;
          height: 100vh;
          min-height: 100vh;
          overflow: hidden;
          font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
          background: #9edcf7;
          isolation: isolate;
        }

        .home-login-page::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          background-image: url(${homeBackground});
          background-size: cover;
          background-position: center center;
          background-repeat: no-repeat;
        }

        .home-login-page::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            radial-gradient(circle at 50% 9%, rgba(255, 255, 255, 0.1), transparent 30%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(42, 75, 31, 0.05));
          pointer-events: none;
        }

        .home-button-area {
          position: absolute;
          left: 50%;
          bottom: clamp(44px, 7.4vh, 88px);
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(22px, 4.2vw, 72px);
          transform: translateX(-50%);
          width: min(860px, 76vw);
        }

        .home-image-button {
          appearance: none;
          border: 0;
          padding: 0;
          margin: 0;
          background: transparent;
          cursor: pointer;
          filter: drop-shadow(0 12px 12px rgba(91, 52, 18, 0.22));
          transition: transform 0.16s ease, filter 0.16s ease;
          -webkit-tap-highlight-color: transparent;
          z-index: 10;
        }

        .home-image-button:hover,
        .home-image-button:focus-visible {
          transform: translateY(-4px) scale(1.035);
          filter: drop-shadow(0 15px 14px rgba(91, 52, 18, 0.28)) brightness(1.04);
          outline: none;
        }

        .home-image-button:active {
          transform: translateY(1px) scale(0.985);
        }

        .home-image-button img {
          display: block;
          width: clamp(190px, 20vw, 300px);
          height: auto;
          user-select: none;
          pointer-events: none;
        }

        .home-image-button.is-medical {
          position: fixed;
          right: clamp(22px, 4vw, 58px);
          bottom: clamp(24px, 5vh, 58px);
          z-index: 20;
        }

        .home-image-button.is-medical img {
          width: clamp(96px, 9.5vw, 146px);
        }

        @media (max-width: 980px) {
          .home-button-area {
            width: min(720px, 82vw);
            gap: 20px;
          }

          .home-image-button img {
            width: clamp(160px, 26vw, 240px);
          }

          .home-image-button.is-medical {
            right: 24px;
            bottom: 24px;
          }

          .home-image-button.is-medical img {
            width: 96px;
          }
        }

        @media (max-width: 720px) {
          .home-login-page::before {
            background-position: center center;
          }

          .home-button-area {
            bottom: 28px;
            width: calc(100vw - 28px);
            flex-direction: column;
            gap: 10px;
          }

          .home-image-button img {
            width: min(250px, 72vw);
          }

          .home-image-button.is-medical {
            position: fixed;
            right: 16px;
            bottom: 16px;
          }

          .home-image-button.is-medical img {
            width: min(118px, 34vw);
          }
        }
      `}</style>

      <section className="home-button-area" aria-label="登入與註冊按鈕">
        <button
          type="button"
          className="home-image-button is-login"
          onClick={goGameLogin}
          aria-label="遊戲登入"
        >
          <img src={loginButton} alt="遊戲登入" draggable="false" />
        </button>

        <button
          type="button"
          className="home-image-button is-register"
          onClick={goRegister}
          aria-label="註冊"
        >
          <img src={registerButton} alt="註冊" draggable="false" />
        </button>
      </section>

      <button
        type="button"
        className="home-image-button is-medical"
        onClick={goMedicalLogin}
        aria-label="醫療人員登入"
      >
        <img src={medicalLoginButton} alt="醫療人員登入" draggable="false" />
      </button>
    </main>
  );
}

=======
import bgImg from "../asset/Home_background.png";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      <div style={mainCardStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>動物森友會</h1>
          <p style={subtitleStyle}>
            提供幼兒執行功能（Executive Function）相關之訓練與測驗，協助家長與醫療人員追蹤孩子的表現、訓練歷程與發展狀況。
          </p>
        </div>

        <div style={gridStyle}>
          {/* 家長端 */}
          <div style={guardianCardStyle}>
            <h2 style={sectionTitleStyle}>家長端</h2>
            <p style={sectionTextStyle}>
              建立孩子資料、進入遊戲訓練與測驗，未來可查看孩子的遊戲歷程與表現結果。
            </p>

            <div style={buttonGroupStyle}>
              <button
                onClick={() => navigate("/login")}
                style={guardianLoginButtonStyle}
              >
                家長登入
              </button>

              <button
                onClick={() => navigate("/register")}
                style={guardianRegisterButtonStyle}
              >
                家長註冊
              </button>
            </div>
          </div>

          {/* 醫療端 */}
          <div style={clinicianCardStyle}>
            <h2 style={sectionTitleStyle}>醫療人員端</h2>
            <p style={sectionTextStyle}>
              查看授權個案之基本資料，未來可延伸串接測驗結果、訓練紀錄與追蹤分析。
            </p>

            <button
              onClick={() => navigate("/clinician-login")}
              style={clinicianButtonStyle}
            >
              醫療登入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* styles */
const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "40px 20px",
  boxSizing: "border-box",
  backgroundImage: `
    linear-gradient(rgba(255,255,255,0.08), rgba(255,255,255,0.08)),
    url(${bgImg})
  `,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
};

const mainCardStyle = {
  width: "100%",
  maxWidth: "1150px",
  background:
    "linear-gradient(180deg, rgba(255,249,242,0.95), rgba(247,236,222,0.93))",
  borderRadius: "32px",
  padding: "56px",
  boxShadow: "0 18px 40px rgba(120, 90, 60, 0.14)",
  border: "2px solid rgba(181, 145, 109, 0.18)",
  backdropFilter: "blur(4px)",
  boxSizing: "border-box",
};

const headerStyle = {
  marginBottom: "50px",
};

const titleStyle = {
  fontSize: "46px",
  fontWeight: "800",
  color: "#4f3422",
  marginBottom: "18px",
};

const subtitleStyle = {
  fontSize: "20px",
  color: "#7a6657",
  lineHeight: "1.9",
  maxWidth: "850px",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "30px",
};

const guardianCardStyle = {
  background: "rgba(255, 247, 239, 0.92)",
  borderRadius: "24px",
  padding: "35px",
  border: "1.5px solid #E6D2BD",
  boxShadow: "0 8px 20px rgba(120, 90, 60, 0.06)",
};

const clinicianCardStyle = {
  background: "rgba(255, 247, 239, 0.92)",
  borderRadius: "24px",
  padding: "35px",
  border: "1.5px solid #E6D2BD",
  boxShadow: "0 8px 20px rgba(90, 110, 140, 0.06)",
};

const sectionTitleStyle = {
  fontSize: "32px",
  fontWeight: "800",
  color: "#4f3422",
  marginBottom: "14px",
};

const sectionTextStyle = {
  fontSize: "17px",
  color: "#7a6657",
  lineHeight: "1.9",
  marginBottom: "28px",
};

const buttonGroupStyle = {
  display: "flex",
  gap: "14px",
  flexWrap: "wrap",
};

const guardianLoginButtonStyle = {
  background: "linear-gradient(135deg, #d89b4d, #c97d2b)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "14px 28px",
  fontSize: "17px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(201, 125, 43, 0.22)",
};

const guardianRegisterButtonStyle = {
  background: "#fffaf5",
  color: "#6b4b32",
  border: "2px solid #caa27c",
  borderRadius: "14px",
  padding: "14px 28px",
  fontSize: "17px",
  fontWeight: "700",
  cursor: "pointer",
};

const clinicianButtonStyle = {
  background: "linear-gradient(135deg, #d89b4d, #c97d2b)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "14px 28px",
  fontSize: "17px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(201, 125, 43, 0.22)",
};

>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
export default HomePage;