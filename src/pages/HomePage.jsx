import { useNavigate } from "react-router-dom";

import homeBackground from "../asset/home/dashboard_background.webp";
import loginButton from "../asset/home/login.webp";
import registerButton from "../asset/home/register.webp";
import medicalLoginButton from "../asset/home/dc_register.webp";

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

        .home-background {
          position: absolute;
          inset: 0;
          z-index: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
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
          bottom: clamp(34px, 6.2vh, 76px);
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(32px, 4vw, 64px);
          transform: translateX(-50%);
          width: min(1060px, 92vw);
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
          flex: 1 1 0;
          width: 100%;
          height: clamp(96px, 10vw, 142px);
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
          width: 100%;
          height: 100%;
          object-fit: contain;
          user-select: none;
          pointer-events: none;
        }

        .home-image-button.is-medical img {
          width: 100%;
        }

        @media (max-width: 980px) {
          .home-button-area {
            width: min(820px, 90vw);
            gap: 24px;
          }

          .home-image-button {
            height: clamp(82px, 14vw, 118px);
          }
        }

        @media (max-width: 720px) {
          .home-background {
            object-position: center center;
          }

          .home-button-area {
            bottom: 20px;
            width: calc(100vw - 24px);
            flex-direction: column;
            gap: 8px;
          }

          .home-image-button img,
          .home-image-button.is-medical img {
            width: min(240px, 68vw);
          }

          .home-image-button {
            flex: 0 0 auto;
            width: min(240px, 68vw);
            height: 80px;
          }
        }
      `}</style>

      <img
        className="home-background"
        src={homeBackground}
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        draggable="false"
      />

      <section className="home-button-area" aria-label="登入、註冊與醫療人員登入按鈕">
        <button
          type="button"
          className="home-image-button is-register"
          onClick={goRegister}
          aria-label="註冊"
        >
          <img
            width={1024}
            height={341}
            decoding="async"
            src={registerButton}
            alt="註冊"
            draggable="false"
          />
        </button>

        <button
          type="button"
          className="home-image-button is-login"
          onClick={goGameLogin}
          aria-label="遊戲登入"
        >
          <img
            width={1024}
            height={341}
            decoding="async"
            src={loginButton}
            alt="遊戲登入"
            draggable="false"
          />
        </button>

        <button
          type="button"
          className="home-image-button is-medical"
          onClick={goMedicalLogin}
          aria-label="醫療人員登入"
        >
          <img
            width={1024}
            height={341}
            decoding="async"
            src={medicalLoginButton}
            alt="醫療人員登入"
            draggable="false"
          />
        </button>
      </section>
    </main>
  );
}

export default HomePage;
