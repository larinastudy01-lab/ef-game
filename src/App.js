import React, {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
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
import DatabaseIcon from "./asset/database.webp";
import SetIcon from "./asset/Set_icon.webp";
import HomePage from "./pages/HomePage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import ClinicianLoginPage from "./pages/ClinicianLoginPage";
import ClinicianApplicationPage from "./pages/ClinicianApplicationPage";
import { SHOW_AVATAR_ROOM } from "./config/featureFlags";
import GameTestingControls, { useTemporaryGameTesting } from "./temporaryGameTesting/GameTestingControls";
import { GAME_TESTING_ROUTE, gameTestingUrl, isGameTestingPath } from "./temporaryGameTesting/runtime";

const GameTestingMenu = lazy(() => import("./temporaryGameTesting/GameTestingMenu"));

const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
const ResultSyncStatus = lazy(() => import("./components/ResultSyncStatus"));
const GameMenuPage = lazy(() => import("./pages/GameMenuPage"));
const ChildSelectPage = lazy(() => import("./pages/ChildSelectPage"));
const ModeSelectPage = lazy(() => import("./pages/ModeSelectPage"));
const TestMapPage = lazy(() => import("./pages/TestMapPage"));
const RestPage = lazy(() => import("./pages/RestPage"));
const Achievement = lazy(() => import("./pages/Achievement"));
const AvatarRoom = lazy(() => import("./pages/Avatar_Room"));
const Furniture = lazy(() => import("./pages/Furniture"));
const HatStickerGamePage = lazy(() => import("./pages/HatStickerGamePage"));

const AddPatient = lazy(() => import("./pages/AddPatientPage"));
const ClinicianDashboard = lazy(() => import("./pages/ClinicianDashboard"));
const AdminClinicianApplicationsPage = lazy(() => import("./pages/AdminClinicianApplicationsPage"));
const ResearchTools = lazy(() => import("./pages/ResearchTools"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ParentResultsPage = lazy(() => import("./pages/ParentResultsPage"));

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

const TrainingPageARI = lazy(() => import("./pages/TrainingPage_ARI"));
const TestPageARI = lazy(() => import("./pages/TestPage_ARI"));
const ResultPageARI = lazy(() => import("./pages/ResultPage_ARI"));

const TrainingPageDCCS = lazy(() => import("./pages/TrainingPage_DCCS"));
const TestPageDCCS = lazy(() => import("./pages/TestPage_DCCS"));
const ResultPageDCCS = lazy(() => import("./pages/ResultPage_DCCS"));

const ResultPagePA = lazy(() => import("./pages/ResultPage_PA"));
const ResultPageDC = lazy(() => import("./pages/ResultPage_DC"));

const SETTINGS_STORAGE_KEY = "efGameTrainingSettings";
const CLINICIAN_ROLES = ["clinician", "medical", "doctor"];

function ClinicianRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={CLINICIAN_ROLES} redirectTo="/clinician-login">
      {children}
    </ProtectedRoute>
  );
}

const DEFAULT_APP_SETTINGS = {
  bgmVolume: 60,
  sfxVolume: 75,
  brightness: 95,
  eyeCareMode: true,
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
  const isGameTesting = useTemporaryGameTesting();

  useEffect(() => {
    document.title = "蒐秘密";
  }, []);

  const audioRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [appSettings, setAppSettings] = useState(loadAppSettings);

  // 醫療端不播放音樂，也不顯示音樂控制按鈕
  const isClinicianPage =
    location.pathname === "/clinician-login" ||
    location.pathname === "/clinician-dashboard";
  const isResearchPage = [
    "/research-tools",
    "/research-professional-dashboard",
    "/research-statistics",
    "/ai-behavioral-analysis",
    "/adaptive-recommendation-research",
    "/longitudinal-dashboard",
  ].includes(location.pathname);
  const isSettingsPage = location.pathname === "/settings";
  const isHomePage = location.pathname === "/";

  useEffect(() => {
    setIsSettingsMenuOpen(false);
  }, [location.pathname]);

  // 判斷目前是否允許播放背景音樂
  const shouldPlayBGM =
    !isMuted &&
    !isVideoPlaying &&
    !isClinicianPage &&
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
      startTransition(() => {
        setHasUserInteracted(true);
      });
    };

    document.addEventListener("click", handleFirstInteraction, {
      once: true,
    });

    document.addEventListener("touchstart", handleFirstInteraction, {
      once: true,
      passive: true,
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
      const playPromise = audio.play();
      playPromise?.catch((error) => {
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
        // Videos start muted so browser autoplay can begin reliably. Once playback
        // has actually started, hand the audio focus to the video immediately.
        event.target.muted = false;
        audioRef.current?.pause();
        setIsVideoPlaying(true);
      }
    };

    const handleVideoStop = (event) => {
      if (event.target?.tagName === "VIDEO") {
        // A page transition can briefly contain more than one video. Only resume
        // the BGM after every video has stopped.
        const hasPlayingVideo = Array.from(document.querySelectorAll("video")).some(
          (video) => !video.paused && !video.ended
        );
        setIsVideoPlaying(hasPlayingVideo);
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
        isGameTesting ? "game-testing-active" : "",
        appSettings.eyeCareMode ? "app-eye-care" : "",
        appSettings.fontSize === "large" ? "app-font-large" : "",
        appSettings.buttonSize === "large" ? "app-button-large" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--app-brightness": isHomePage ? 1 : appSettings.brightness / 100,
      }}
    >
      <audio ref={audioRef} src={BGM} loop preload="none" />
      <GameTestingControls />

      {!isGameTesting && !isSettingsPage && !isClinicianPage && !isResearchPage && (
        <div className="app-settings-menu">
          <div className="app-header-actions">
            {isHomePage && (
              <button
                type="button"
                className="app-database-trigger"
                aria-label="開啟資料庫"
                onClick={() => navigate("/parent-results")}
              >
                <img src={DatabaseIcon} alt="" />
              </button>
            )}

          <button
            type="button"
            className="app-settings-trigger"
            aria-label="開啟設定"
            aria-expanded={isSettingsMenuOpen}
            onClick={() => setIsSettingsMenuOpen((isOpen) => !isOpen)}
          >
            <img src={SetIcon} alt="" />
          </button>
          </div>

          {isSettingsMenuOpen && (
            <div className="app-settings-popover" role="dialog" aria-label="快速設定">
              {!isClinicianPage && (
                <button
                  type="button"
                  className="app-music-toggle"
                  aria-label={isMuted ? "開啟背景音樂" : "關閉背景音樂"}
                  aria-pressed={!isMuted}
                  onClick={() => {
                    setHasUserInteracted(true);
                    setIsMuted((previousMutedState) => !previousMutedState);
                  }}
                >
                  <span>背景音樂</span>
                  <span className={`app-toggle-track ${isMuted ? "is-off" : "is-on"}`} aria-hidden="true">
                    <span className="app-toggle-thumb" />
                  </span>
                </button>
              )}
              <button
                type="button"
                className="app-open-settings"
                onClick={() => navigate("/settings")}
              >
                更多設定
              </button>
            </div>
          )}
        </div>
      )}

      <Suspense fallback={<RouteFallback />}>
      {isGameTesting && !isGameTestingPath(location.pathname) ? (
        <Navigate to={gameTestingUrl(GAME_TESTING_ROUTE)} replace />
      ) : (
      <Routes>
        <Route path={GAME_TESTING_ROUTE} element={isGameTesting ? <GameTestingMenu /> : <Navigate to="/" replace />} />
        {/* 入口 / 帳號 / 角色流程 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/clinician-login"
          element={<ClinicianLoginPage />}
        />
        <Route path="/clinician-apply" element={<ClinicianApplicationPage />} />
        <Route
          path="/admin/clinician-applications"
          element={<ProtectedRoute allowedRoles={["admin"]} redirectTo="/clinician-login"><AdminClinicianApplicationsPage /></ProtectedRoute>}
        />
        <Route path="/achievement" element={<Achievement />} />
        <Route path="/avatar-room" element={SHOW_AVATAR_ROOM ? <AvatarRoom /> : <Navigate to="/game-menu" replace />} />
        <Route path="/furniture" element={SHOW_AVATAR_ROOM ? <Furniture /> : <Navigate to="/game-menu" replace />} />
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

        {/* ARI */}
        <Route
          path="/training-ari"
          element={<TrainingPageARI />}
        />
        <Route path="/test-ari" element={<TestPageARI />} />
        <Route path="/result-ari" element={<ResultPageARI />} />

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
          element={<ClinicianRoute><ClinicianDashboard /></ClinicianRoute>}
        />
        <Route path="/research-tools" element={<ClinicianRoute><ResearchTools /></ClinicianRoute>} />
        <Route path="/research-statistics" element={<Navigate to="/research-tools?view=statistics" replace />} />
        <Route path="/ai-behavioral-analysis" element={<Navigate to="/research-tools?view=ai" replace />} />
        <Route path="/adaptive-recommendation-research" element={<Navigate to="/research-tools?view=adaptive" replace />} />
        <Route path="/longitudinal-dashboard" element={<Navigate to="/research-tools?view=longitudinal" replace />} />
        <Route path="/research-professional-dashboard" element={<Navigate to="/research-tools?view=overview" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/parent-results"
          element={<ProtectedRoute allowedRoles={["guardian", "parent"]} redirectTo="/login"><ParentResultsPage /></ProtectedRoute>}
        />

        {/* 找不到頁面時回首頁 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      )}
      </Suspense>
      {!isGameTesting && <Suspense fallback={null}><ResultSyncStatus /></Suspense>}
    </div>
  );
}

function App() {
  return (
    <Router
      basename={process.env.PUBLIC_URL || undefined}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppContent />
    </Router>
  );
}

export default App;
