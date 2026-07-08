import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";

import BGM from "./asset/BGM.mp3";

const HomePage = lazy(() => import("./pages/HomePage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const GameMenuPage = lazy(() => import("./pages/GameMenuPage"));
const ChildSelectPage = lazy(() => import("./pages/ChildSelectPage"));
const ModeSelectPage = lazy(() => import("./pages/ModeSelectPage"));
const TestMapPage = lazy(() => import("./pages/TestMapPage"));
const RestPage = lazy(() => import("./pages/RestPage"));
const Achievement = lazy(() => import("./pages/Achievement"));
const AvatarRoom = lazy(() => import("./pages/Avatar_Room"));
const HatStickerGamePage = lazy(() => import("./pages/HatStickerGamePage"));

const AddPatient = lazy(() => import("./pages/AddPatientPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ClinicianLoginPage = lazy(() => import("./pages/ClinicianLoginPage"));
const ClinicianDashboard = lazy(() => import("./pages/ClinicianDashboard"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const TrainingPageSRT = lazy(() => import("./pages/TrainingPage_SRT"));
const TestPageSRT = lazy(() => import("./pages/TestPage_SRT"));
const ResultPageSRT = lazy(() => import("./pages/ResultPage_SRT"));

const TrainingPagePM = lazy(() => import("./pages/TrainingPage_PM"));
const TestPagePM = lazy(() => import("./pages/TestPage_PM"));
const ResultPagePM = lazy(() => import("./pages/ResultPage_PM"));

const TrainingPageCBT = lazy(() => import("./pages/TrainingPage_CBT"));
const TestPageCBT = lazy(() => import("./pages/TestPage_CBT"));
const ResultPageCBT = lazy(() => import("./pages/ResultPage_CBT"));

const TrainingPageLB = lazy(() => import("./pages/TrainingPage_LB"));
const TestPageLB = lazy(() => import("./pages/TestPage_LB"));
const ResultPageLB = lazy(() => import("./pages/ResultPage_LB"));

const TrainingPageDPT = lazy(() => import("./pages/TrainingPage_DPT"));
const TestPageDPT = lazy(() => import("./pages/TestPage_DPT"));
const ResultPageDPT = lazy(() => import("./pages/ResultPage_DPT"));

const TrainingPageDCCS = lazy(() => import("./pages/TrainingPage_DCCS"));
const TestPageDCCS = lazy(() => import("./pages/TestPage_DCCS"));
const ResultPageDCCS = lazy(() => import("./pages/ResultPage_DCCS"));

const ResultPagePA = lazy(() => import("./pages/ResultPage_PA"));
const ResultPageDC = lazy(() => import("./pages/ResultPage_DC"));

const SETTINGS_STORAGE_KEY = "efGameTrainingSettings";

const DEFAULT_APP_SETTINGS = {
  bgmVolume: 60,
  sfxVolume: 75,
  trainingMinutes: 10,
  brightness: 72,
  eyeCareMode: true,
  parentLock: true,
  parentPin: "",
  fontSize: "normal",
  buttonSize: "large",
};

function clampNumber(value, min, max, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function sanitizeAppSettings(parsed) {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...parsed,
    bgmVolume: clampNumber(
      parsed?.bgmVolume,
      0,
      100,
      DEFAULT_APP_SETTINGS.bgmVolume
    ),
    sfxVolume: clampNumber(
      parsed?.sfxVolume,
      0,
      100,
      DEFAULT_APP_SETTINGS.sfxVolume
    ),
    brightness: clampNumber(
      parsed?.brightness,
      40,
      100,
      DEFAULT_APP_SETTINGS.brightness
    ),
    eyeCareMode:
      typeof parsed?.eyeCareMode === "boolean"
        ? parsed.eyeCareMode
        : DEFAULT_APP_SETTINGS.eyeCareMode,
    fontSize: parsed?.fontSize === "large" ? "large" : "normal",
    buttonSize: parsed?.buttonSize === "normal" ? "normal" : "large",
  };
}

function loadAppSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return saved
      ? sanitizeAppSettings(JSON.parse(saved))
      : DEFAULT_APP_SETTINGS;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

function RouteFallback() {
  return <div className="route-loading">載入中...</div>;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  const audioRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [appSettings, setAppSettings] = useState(loadAppSettings);

  // 醫療端不播放音樂，也不顯示音樂控制按鈕
  const isClinicianDashboard =
    location.pathname === "/clinician-dashboard";
  const isSettingsPage = location.pathname === "/settings";

  // 判斷目前是否允許播放背景音樂
  const shouldPlayBGM =
    !isMuted &&
    !isVideoPlaying &&
    !isClinicianDashboard &&
    hasUserInteracted;

  useEffect(() => {
    const syncSettings = (event) => {
      if (event.type === "storage" && event.key !== SETTINGS_STORAGE_KEY) {
        return;
      }

      setAppSettings(loadAppSettings());
    };

    window.addEventListener("storage", syncSettings);
    window.addEventListener("ef-game-settings-change", syncSettings);

    return () => {
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener("ef-game-settings-change", syncSettings);
    };
  }, []);

  // 初始化背景音樂
  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    audio.loop = true;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    audio.volume = appSettings.bgmVolume / 100;
  }, [appSettings.bgmVolume]);

  // 使用者第一次操作頁面後，才嘗試播放音樂
  useEffect(() => {
    const handleFirstInteraction = () => {
      setHasUserInteracted(true);
    };

    document.addEventListener("click", handleFirstInteraction, {
      once: true,
    });

    document.addEventListener("touchstart", handleFirstInteraction, {
      once: true,
    });

    document.addEventListener("keydown", handleFirstInteraction, {
      once: true,
    });

    return () => {
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("touchstart", handleFirstInteraction);
      document.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  // 根據目前頁面、靜音狀態與影片狀態控制背景音樂
  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    if (shouldPlayBGM) {
      audio.play().catch((error) => {
        console.log("BGM play blocked:", error);
      });
    } else {
      audio.pause();
    }
  }, [shouldPlayBGM]);

  // 監聽所有影片的播放、暫停與結束事件
  useEffect(() => {
    const handleVideoPlay = (event) => {
      if (event.target?.tagName === "VIDEO") {
        setIsVideoPlaying(true);
      }
    };

    const handleVideoStop = (event) => {
      if (event.target?.tagName === "VIDEO") {
        setIsVideoPlaying(false);
      }
    };

    document.addEventListener("play", handleVideoPlay, true);
    document.addEventListener("pause", handleVideoStop, true);
    document.addEventListener("ended", handleVideoStop, true);

    return () => {
      document.removeEventListener("play", handleVideoPlay, true);
      document.removeEventListener("pause", handleVideoStop, true);
      document.removeEventListener("ended", handleVideoStop, true);
    };
  }, []);

  return (
    <div
      className={[
        "app-settings-shell",
        appSettings.eyeCareMode ? "app-eye-care" : "",
        appSettings.fontSize === "large" ? "app-font-large" : "",
        appSettings.buttonSize === "large" ? "app-button-large" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--app-brightness": appSettings.brightness / 100,
      }}
    >
      <audio ref={audioRef} src={BGM} loop preload="auto" />

      {/* 醫療端頁面不顯示音樂控制按鈕 */}
      {!isClinicianDashboard && (
        <button
          type="button"
          aria-label={isMuted ? "開啟背景音樂" : "關閉背景音樂"}
          aria-pressed={isMuted}
          onClick={() => {
            setHasUserInteracted(true);
            setIsMuted((previousMutedState) => !previousMutedState);
          }}
          style={{
            position: "fixed",
            right: "24px",
            bottom: "24px",
            zIndex: 9999,
            padding: "12px 18px",
            borderRadius: "999px",
            border: "none",
            backgroundColor: isMuted ? "#9A8A78" : "#7A5A3A",
            color: "white",
            fontSize: "16px",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: "0 6px 14px rgba(0, 0, 0, 0.22)",
            transition:
              "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseDown={(event) => {
            event.currentTarget.style.transform = "scale(0.96)";
          }}
          onMouseUp={(event) => {
            event.currentTarget.style.transform = "scale(1)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = "scale(1)";
          }}
          onTouchEnd={(event) => {
            event.currentTarget.style.transform = "scale(1)";
          }}
        >
          {isMuted ? "音樂關閉" : "音樂開啟"}
        </button>
      )}

      {!isSettingsPage && (
        <button
          type="button"
          aria-label="開啟設定"
          onClick={() => navigate("/settings")}
          style={{
            position: "fixed",
            right: "24px",
            bottom: !isClinicianDashboard ? "86px" : "24px",
            zIndex: 9999,
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            border: "none",
            backgroundColor: "#ffd56e",
            color: "#6a3d08",
            fontSize: "24px",
            fontWeight: "900",
            cursor: "pointer",
            boxShadow: "0 6px 14px rgba(0, 0, 0, 0.22)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseDown={(event) => {
            event.currentTarget.style.transform = "scale(0.96)";
          }}
          onMouseUp={(event) => {
            event.currentTarget.style.transform = "scale(1)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = "scale(1)";
          }}
          onTouchEnd={(event) => {
            event.currentTarget.style.transform = "scale(1)";
          }}
        >
          ⚙
        </button>
      )}

      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* 入口 / 帳號 / 角色流程 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/clinician-login"
          element={<ClinicianLoginPage />}
        />
        <Route path="/achievement" element={<Achievement />} />
        <Route path="/avatar-room" element={<AvatarRoom />} />
        <Route
          path="/hat-sticker-game"
          element={<HatStickerGamePage />}
        />

        {/* 兒童 / 模式 / 地圖流程 */}
        <Route path="/child-select" element={<ChildSelectPage />} />
        <Route path="/mode-select" element={<ModeSelectPage />} />
        <Route path="/game-menu" element={<GameMenuPage />} />
        <Route path="/test-map" element={<TestMapPage />} />
        <Route path="/rest" element={<RestPage />} />

        {/* 共用結果頁：家長端 / 醫療端 */}
        <Route path="/result-pa" element={<ResultPagePA />} />
        <Route path="/result-dc" element={<ResultPageDC />} />

        {/* SRT */}
        <Route path="/training-srt" element={<TrainingPageSRT />} />
        <Route path="/test-srt" element={<TestPageSRT />} />
        <Route path="/result-srt" element={<ResultPageSRT />} />

        {/* 舊 SRT result route 保留 */}
        <Route
          path="/result"
          element={<Navigate to="/result-srt" replace />}
        />

        {/* Picture Memory */}
        <Route
          path="/training-picture-memory"
          element={<TrainingPagePM />}
        />
        <Route
          path="/test-picture-memory"
          element={<TestPagePM />}
        />
        <Route
          path="/result-picture-memory"
          element={<ResultPagePM />}
        />

        {/* CBT */}
        <Route path="/training-cbt" element={<TrainingPageCBT />} />
        <Route path="/test-cbt" element={<TestPageCBT />} />
        <Route path="/result-cbt" element={<ResultPageCBT />} />

        {/* Linking Balloons */}
        <Route
          path="/training-linking-balloons"
          element={<TrainingPageLB />}
        />
        <Route
          path="/test-linking-balloons"
          element={<TestPageLB />}
        />
        <Route path="/result-lb" element={<ResultPageLB />} />

        {/* Dot Probe */}
        <Route
          path="/training-dot-probe"
          element={<TrainingPageDPT />}
        />
        <Route path="/test-dot-probe" element={<TestPageDPT />} />
        <Route path="/result-dpt" element={<ResultPageDPT />} />

        {/* DCCS */}
        <Route
          path="/training-dccs"
          element={<TrainingPageDCCS />}
        />
        <Route path="/test-dccs" element={<TestPageDCCS />} />
        <Route path="/result-dccs" element={<ResultPageDCCS />} />

        {/* DCCS 舊路由 redirect */}
        <Route
          path="/training-dcss"
          element={<Navigate to="/training-dccs" replace />}
        />
        <Route
          path="/training-Dcss"
          element={<Navigate to="/training-dccs" replace />}
        />
        <Route
          path="/training-DCCS"
          element={<Navigate to="/training-dccs" replace />}
        />
        <Route
          path="/test-Dcss"
          element={<Navigate to="/test-dccs" replace />}
        />
        <Route
          path="/test-DCCS"
          element={<Navigate to="/test-dccs" replace />}
        />
        <Route
          path="/result-DCCS"
          element={<Navigate to="/result-dccs" replace />}
        />

        {/* 家長 / 醫療端 */}
        <Route path="/add-patient" element={<AddPatient />} />
        <Route
          path="/clinician-dashboard"
          element={<ClinicianDashboard />}
        />
        <Route path="/settings" element={<SettingsPage />} />

        {/* 找不到頁面時回首頁 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
