import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import GameMenuPage from "./pages/GameMenuPage";
import TrainingPage_SRT from "./pages/TrainingPage_SRT";
import TestPage_SRT from "./pages/TestPage_SRT";
import ResultPage from "./pages/ResultPage_SRT";
import TestPage_PM from "./pages/TestPage_PM";
import AddPatient from "./pages/AddPatientPage";
import LoginPage from "./pages/LoginPage";
import ClinicianLoginPage from "./pages/ClinicianLoginPage";
import ClinicianDashboard from "./pages/ClinicianDashboard";
import ResultPage_PM from "./pages/ResultPage_PM";
import TestPage_CBT from "./pages/TestPage_CBT";
import BGM from "./asset/BGM.mp3";

function App() {
  const audioRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.35;
    audio.loop = true;

    const startAudio = () => {
      audio.play().catch((err) => {
        console.log("Autoplay blocked:", err);
      });
      document.removeEventListener("click", startAudio);
    };

    document.addEventListener("click", startAudio);

    return () => {
      document.removeEventListener("click", startAudio);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  return (
    <Router>
      {/* 背景音樂（不影響版面） */}
      <audio ref={audioRef} src={BGM} autoPlay loop />

      {/* 音樂按鈕（固定在右上，不包住整頁） */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
          padding: "10px 16px",
          borderRadius: "12px",
          border: "none",
          backgroundColor: "#7A5A3A",
          color: "white",
          fontSize: "16px",
          cursor: "pointer",
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
        }}
      >
        {isMuted ? "🔇 音樂關閉" : "🎵 音樂開啟"}
      </button>

      {/* 頁面路由 */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game-menu" element={<GameMenuPage />} />
        <Route path="/training-srt" element={<TrainingPage_SRT />} />
        <Route path="/test-srt" element={<TestPage_SRT />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/test-picture-memory" element={<TestPage_PM />} />
        <Route path="/add-patient" element={<AddPatient />} />
        <Route path="/login" element={<LoginPage/>} />
        {/* 醫療人員登入 */}
        <Route path="/clinician-login" element={<ClinicianLoginPage />} />
        {/* 醫療人員後台 */}
        <Route path="/clinician-dashboard" element={<ClinicianDashboard />} />
        <Route path="/result-picture-memory" element={<ResultPage_PM />} />
        <Route path="/test-working-memory" element={<TestPage_CBT />} />
      </Routes>
    </Router>
  );
}

export default App;