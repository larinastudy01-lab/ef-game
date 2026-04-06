import bgImg from "../asset/SRT_background.jpg";
import React, { useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

const ResultPage_SRT = ({
  mode,
  score,
  avgRT,
  rtRecords,
  trialRecords,
  totalSpawn,
  missCount,
  radarData,
  summaryData,
  starResult,
  onRestart,
  onBackToMenu,
}) => {
  const [viewRole, setViewRole] = useState("child");

  // ===== 指標 =====
  const {
    stdRT = 0,
    hitRate = 0,
    firstHalfAvg = avgRT,
    secondHalfAvg = avgRT,
    hitCount = rtRecords.length,
    fastestRT = 0,
    slowestRT = 0,
  } = summaryData || {};

  // ===== 射擊遊戲風格四大能力 =====
  const getReactionSpeed = (rt) => {
    if (rt <= 400) return 100;
    if (rt <= 500) return 92;
    if (rt <= 650) return 82;
    if (rt <= 800) return 70;
    if (rt <= 950) return 58;
    return 42;
  };

  const getAccuracy = (rate) => {
    if (rate >= 95) return 100;
    if (rate >= 90) return 92;
    if (rate >= 80) return 82;
    if (rate >= 70) return 70;
    if (rate >= 60) return 58;
    return 42;
  };

  const getConsistency = (std) => {
    if (std <= 80) return 100;
    if (std <= 120) return 90;
    if (std <= 180) return 80;
    if (std <= 240) return 68;
    if (std <= 300) return 55;
    return 40;
  };

  const getFocus = (first, second) => {
    const drop = second - first;

    if (drop <= 30) return 100;
    if (drop <= 80) return 90;
    if (drop <= 120) return 80;
    if (drop <= 180) return 65;
    if (drop <= 250) return 50;
    return 35;
  };

  const reactionSpeed = getReactionSpeed(avgRT);
  const accuracy = getAccuracy(hitRate);
  const consistency = getConsistency(stdRT);
  const focus = getFocus(firstHalfAvg, secondHalfAvg);

  // ===== 射擊遊戲風格雷達圖 =====
  const shootingRadarData = [
    { subject: "反應速度", value: reactionSpeed },
    { subject: "命中準確", value: accuracy },
    { subject: "操作穩定", value: consistency },
    { subject: "持續專注", value: focus },
  ];

  // ===== 綜合分數（給家長回饋用）=====
  const performanceScore =
    reactionSpeed * 0.35 +
    accuracy * 0.3 +
    consistency * 0.2 +
    focus * 0.15;

  const getStars = () => {
    return "⭐".repeat(starResult?.star || 1);
  };

  // ===== 家長解釋文字 =====
  const getParentFeedback = () => {
    if (performanceScore >= 85)
      return "孩子的反應速度、命中表現與持續專注都很穩定，整體表現非常良好。";
    if (performanceScore >= 70)
      return "整體表現不錯，已有良好的遊戲節奏與反應能力，可持續練習提升穩定度。";
    if (performanceScore >= 55)
      return "孩子已能完成多數任務，建議持續透過遊戲加強反應速度與專注維持。";
    return "建議多進行短時間、重複式練習，幫助孩子建立更穩定的反應與注意力表現。";
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.mainTitle}>完成了 🎉</h2>

        {/* ===== 星級評分區 ===== */}
        <div style={styles.starSection}>
          <h2 style={styles.starTitle}>本次表現評級</h2>

          <div style={styles.starRow}>
            <span style={styles.starIcon}>
              {starResult?.star >= 1 ? "⭐" : "☆"}
            </span>
            <span style={styles.starIcon}>
              {starResult?.star >= 2 ? "⭐" : "☆"}
            </span>
            <span style={styles.starIcon}>
              {starResult?.star >= 3 ? "⭐" : "☆"}
            </span>
          </div>

          <p style={styles.starLevel}>{starResult?.level}</p>
          <p style={styles.starFeedback}>{starResult?.feedback}</p>
        </div>

        {/* ===== 切換角色 ===== */}
        <div style={styles.roleSwitch}>
          <button
            style={{
              ...styles.roleBtn,
              ...(viewRole === "child" ? styles.roleBtnActive : {}),
            }}
            onClick={() => setViewRole("child")}
          >
            幼兒
          </button>

          <button
            style={{
              ...styles.roleBtn,
              ...(viewRole === "parent" ? styles.roleBtnActive : {}),
            }}
            onClick={() => setViewRole("parent")}
          >
            家長
          </button>

          <button
            style={{
              ...styles.roleBtn,
              ...(viewRole === "medical" ? styles.roleBtnActive : {}),
            }}
            onClick={() => setViewRole("medical")}
          >
            醫療
          </button>
        </div>

        {/* ================= 幼兒端 ================= */}
        {viewRole === "child" && null}

        {/* ================= 家長端 ================= */}
        {viewRole === "parent" && (
          <>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <RadarChart data={shootingRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar
                    dataKey="value"
                    stroke="#ff8c42"
                    fill="#ffb26b"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.parentBox}>
              <p style={styles.parentText}>{getParentFeedback()}</p>
            </div>
          </>
        )}

        {/* ================= 醫療端 ================= */}
        {viewRole === "medical" && (
          <>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <RadarChart data={shootingRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar
                    dataKey="value"
                    stroke="#ff8c42"
                    fill="#ffb26b"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.medicalBox}>
              <p>平均反應時間：{avgRT} ms</p>
              <p>最快反應時間：{fastestRT} ms</p>
              <p>最慢反應時間：{slowestRT} ms</p>
              <p>反應標準差：{stdRT}</p>
              <p>命中率：{hitRate}%</p>
              <p>成功次數：{hitCount}</p>
              <p>漏按次數：{missCount}</p>
              <p>前半平均：{firstHalfAvg} ms</p>
              <p>後半平均：{secondHalfAvg} ms</p>
            </div>

            <h4 style={{ marginTop: "18px", color: "#5d4037" }}>
              每次反應時間
            </h4>

            <div style={styles.table}>
              {trialRecords.map((t, i) => (
                <div key={i} style={styles.row}>
                  <span>#{t.trial}</span>
                  <span>{t.hit ? "✔" : "✘"}</span>
                  <span>{t.reactionTime || "-"}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ===== 按鈕 ===== */}
        <div style={styles.actionBtns}>
          <button style={styles.menuBtn} onClick={onBackToMenu}>
            返回選單
          </button>

          <button style={styles.btn} onClick={onRestart}>
            再玩一次
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultPage_SRT;

// ===== style =====
const styles = {
  container: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    padding: "20px",
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.18), rgba(255,255,255,0.18)),
      url(${bgImg})
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
    boxSizing: "border-box",
  },

  card: {
    width: "90%",
    maxWidth: "620px",
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(8px)",
    padding: "38px 30px",
    borderRadius: "30px",
    textAlign: "center",
    boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
    border: "2px solid rgba(255,178,107,0.2)",
  },

  mainTitle: {
    fontSize: "34px",
    color: "#5d4037",
    marginBottom: "10px",
  },

  starSection: {
    background: "#fff8ef",
    borderRadius: "24px",
    padding: "28px 24px",
    margin: "20px auto 28px",
    width: "92%",
    maxWidth: "540px",
    boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
  },

  starTitle: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#7a4f2a",
    marginBottom: "18px",
  },

  starRow: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    marginBottom: "14px",
  },

  starIcon: {
    fontSize: "52px",
    lineHeight: 1,
  },

  starLevel: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#5d4037",
    marginBottom: "10px",
  },

  starFeedback: {
    fontSize: "18px",
    color: "#7b6a58",
    lineHeight: "1.8",
  },

  roleSwitch: {
    display: "flex",
    justifyContent: "center",
    gap: "16px",
    margin: "20px 0 28px",
    flexWrap: "wrap",
  },

  roleBtn: {
    minWidth: "110px",
    padding: "14px 28px",
    borderRadius: "20px",
    border: "2px solid #f4b26b",
    backgroundColor: "#fffaf5",
    color: "#7a5a4a",
    fontSize: "20px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  roleBtnActive: {
    background: "linear-gradient(145deg, #ff9f5a, #ff8c42)",
    color: "white",
    border: "2px solid #f28b2f",
    boxShadow: "0 6px 14px rgba(255,140,66,0.3)",
  },

  star: {
    fontSize: "56px",
    marginTop: "10px",
    marginBottom: "12px",
  },

  parentStars: {
    fontSize: "46px",
    marginTop: "4px",
    marginBottom: "10px",
  },

  childText: {
    fontSize: "22px",
    marginTop: "10px",
    color: "#4e342e",
    fontWeight: "bold",
  },

  parentBox: {
    marginTop: "18px",
    background: "#fff7ef",
    borderRadius: "18px",
    padding: "16px 18px",
  },

  parentText: {
    fontSize: "18px",
    color: "#5d4037",
    lineHeight: "1.8",
    margin: 0,
  },

  medicalBox: {
    textAlign: "left",
    background: "#fff7ef",
    padding: "16px 18px",
    borderRadius: "14px",
    color: "#5d4037",
    lineHeight: "1.9",
    marginTop: "12px",
    fontSize: "17px",
  },

  table: {
    maxHeight: "220px",
    overflowY: "auto",
    marginTop: "10px",
    background: "#fffdfa",
    borderRadius: "12px",
    padding: "6px 0",
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 14px",
    borderBottom: "1px solid #eee",
    color: "#5d4037",
    fontSize: "16px",
  },

  actionBtns: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "18px",
    marginTop: "30px",
    flexWrap: "wrap",
  },

  menuBtn: {
    minWidth: "180px",
    height: "74px",
    borderRadius: "20px",
    border: "2px solid #ffb26b",
    background: "linear-gradient(145deg, #fffaf5, #fff)",
    color: "#ff8c42",
    cursor: "pointer",
    fontSize: "22px",
    fontWeight: "bold",
    boxShadow: "0 6px 14px rgba(255,178,107,0.25)",
    transition: "all 0.2s ease",
  },

  btn: {
    minWidth: "180px",
    height: "74px",
    borderRadius: "20px",
    border: "none",
    background: "linear-gradient(145deg, #ff9f5a, #ff8c42)",
    color: "white",
    cursor: "pointer",
    fontSize: "22px",
    fontWeight: "bold",
    boxShadow: "0 8px 18px rgba(255,140,66,0.35)",
    transition: "all 0.2s ease",
  },
};