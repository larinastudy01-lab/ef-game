import React, { useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import HomePage from "./pages/HomePage";
import RegisterPage from "./pages/RegisterPage";
import GameMenuPage from "./pages/GameMenuPage";
import ChildSelectPage from "./pages/ChildSelectPage";
import ModeSelectPage from "./pages/ModeSelectPage";
import TestMapPage from "./pages/TestMapPage";
import RestPage from "./pages/RestPage";

import AddPatient from "./pages/AddPatientPage";
import LoginPage from "./pages/LoginPage";
import ClinicianLoginPage from "./pages/ClinicianLoginPage";
import ClinicianDashboard from "./pages/ClinicianDashboard";
import SettingsPage from "./pages/SettingsPage";

import TrainingPage_SRT from "./pages/TrainingPage_SRT";
import TestPage_SRT from "./pages/TestPage_SRT";
import ResultPage_SRT from "./pages/ResultPage_SRT";

import TrainingPage_PM from "./pages/TrainingPage_PM";
import TestPage_PM from "./pages/TestPage_PM";
import ResultPage_PM from "./pages/ResultPage_PM";

import TrainingPage_CBT from "./pages/TrainingPage_CBT";
import TestPage_CBT from "./pages/TestPage_CBT";
import ResultPage_CBT from "./pages/ResultPage_CBT";

import TrainingPage_LB from "./pages/TrainingPage_LB";
import TestPage_LB from "./pages/TestPage_LB";
import ResultPage_LB from "./pages/ResultPage_LB";

import TrainingPage_DPT from "./pages/TrainingPage_DPT";
import TestPage_DPT from "./pages/TestPage_DPT";
import ResultPage_DPT from "./pages/ResultPage_DPT";

import TrainingPage_DCCS from "./pages/TrainingPage_DCCS";
import TestPage_DCCS from "./pages/TestPage_DCCS";
import ResultPage_DCCS from "./pages/ResultPage_DCCS";

import ResultPage_PA from "./pages/ResultPage_PA";
import ResultPage_DC from "./pages/ResultPage_DC";

import BGM from "./asset/BGM.mp3";

function App() {
  const audioRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.35;
    audio.loop = true;

    const startAudio = () => {
      if (!isMuted && !isVideoPlaying) {
        audio.play().catch((err) => {
          console.log("Autoplay blocked:", err);
        });
      }

      document.removeEventListener("click", startAudio);
    };

    document.addEventListener("click", startAudio);

    return () => {
      document.removeEventListener("click", startAudio);
    };
  }, [isMuted, isVideoPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted || isVideoPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.log("BGM play blocked:", err);
      });
    }
  }, [isMuted, isVideoPlaying]);

  useEffect(() => {
    const handleVideoPlay = (e) => {
      if (e.target.tagName === "VIDEO") {
        setIsVideoPlaying(true);

        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
    };

    const handleVideoStop = (e) => {
      if (e.target.tagName === "VIDEO") {
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
    <Router>
      <audio ref={audioRef} src={BGM} loop />

      <button
        onClick={() => setIsMuted((prev) => !prev)}
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
          boxShadow: "0 6px 14px rgba(0,0,0,0.22)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.96)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {isMuted ? "音樂關閉" : "音樂開啟"}
      </button>

      <Routes>
        {/* 入口 / 帳號 / 角色流程 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/clinician-login" element={<ClinicianLoginPage />} />

        {/* 兒童 / 模式 / 地圖流程 */}
        <Route path="/child-select" element={<ChildSelectPage />} />
        <Route path="/mode-select" element={<ModeSelectPage />} />
        <Route path="/game-menu" element={<GameMenuPage />} />
        <Route path="/test-map" element={<TestMapPage />} />
        <Route path="/rest" element={<RestPage />} />

        {/* 共用結果頁：家長端 / 醫療端 */}
        <Route path="/result-pa" element={<ResultPage_PA />} />
        <Route path="/result-dc" element={<ResultPage_DC />} />

        {/* SRT */}
        <Route path="/training-srt" element={<TrainingPage_SRT />} />
        <Route path="/test-srt" element={<TestPage_SRT />} />
        <Route path="/result-srt" element={<ResultPage_SRT />} />

        {/* 舊 SRT result route 保留 */}
        <Route path="/result" element={<Navigate to="/result-srt" replace />} />

        {/* Picture Memory */}
        <Route path="/training-picture-memory" element={<TrainingPage_PM />} />
        <Route path="/test-picture-memory" element={<TestPage_PM />} />
        <Route path="/result-picture-memory" element={<ResultPage_PM />} />

        {/* CBT */}
        <Route path="/training-cbt" element={<TrainingPage_CBT />} />
        <Route path="/test-cbt" element={<TestPage_CBT />} />
        <Route path="/result-cbt" element={<ResultPage_CBT />} />

        {/* Linking Balloons */}
        <Route
          path="/training-linking-balloons"
          element={<TrainingPage_LB />}
        />
        <Route path="/test-linking-balloons" element={<TestPage_LB />} />
        <Route path="/result-lb" element={<ResultPage_LB />} />

        {/* Dot Probe */}
        <Route path="/training-dot-probe" element={<TrainingPage_DPT />} />
        <Route path="/test-dot-probe" element={<TestPage_DPT />} />
        <Route path="/result-dpt" element={<ResultPage_DPT />} />

        {/* DCCS */}
        <Route path="/training-dccs" element={<TrainingPage_DCCS />} />
        <Route path="/test-dccs" element={<TestPage_DCCS />} />
        <Route path="/result-dccs" element={<ResultPage_DCCS />} />

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
        <Route path="/clinician-dashboard" element={<ClinicianDashboard />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* 找不到頁面時回首頁 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;