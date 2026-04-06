import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import bgImage from "../asset/SRT_background.jpg";
import clickSfx from "../asset/Click_SRT.mp3";

import {
  calculatePMStars,
  calculatePMDetails,
  getPMPerformanceLabel,
} from "../utils/pmScoring";

export default function ResultPage_PM() {
  const navigate = useNavigate();
  const location = useLocation();

  const records = location.state?.records || [];
  const [activeTab, setActiveTab] = useState("child"); // child / parent / clinician

  const playClick = () => {
    const audio = new Audio(clickSfx);
    audio.play().catch(() => {});
  };

  const stars = useMemo(() => calculatePMStars(records), [records]);
  const details = useMemo(() => calculatePMDetails(records), [records]);
  const performanceLabel = useMemo(() => getPMPerformanceLabel(records), [records]);

  const childMessage = useMemo(() => {
    if (stars === 3) return "表現超棒";
    if (stars === 2) return "表現不錯";
    if (stars === 1) return "繼續加油";
    return "再試一次";
  }, [stars]);

  const childSubMessage = useMemo(() => {
    if (stars === 3) return "你記住了好多圖片，真的很厲害！";
    if (stars === 2) return "有掌握到節奏，再多練習會更棒！";
    if (stars === 1) return "你很努力喔，再挑戰一次看看吧！";
    return "別擔心，我們再玩一次就會更熟悉！";
  }, [stars]);

  const handleRetry = () => {
    playClick();
    navigate("/test-picture-memory");
  };

  const handleBackMenu = () => {
    playClick();
    navigate("/game-menu");
  };

  return (
    <div style={styles.page(bgImage)}>
      <div style={styles.overlay}>
        <div style={styles.mainCard}>
          <h1 style={styles.topTitle}>完成了 🎉</h1>

          {/* ===== 中央評級卡 ===== */}
          <div style={styles.resultBox}>
            <h2 style={styles.resultTitle}>本次表現評級</h2>

            <div style={styles.starRow}>
              {Array.from({ length: 3 }).map((_, index) => (
                <span key={index} style={styles.star}>
                  {index < stars ? "⭐" : "☆"}
                </span>
              ))}
            </div>

            <div style={styles.resultLabel}>{childMessage}</div>
            <p style={styles.resultSubText}>{childSubMessage}</p>
          </div>

          {/* ===== 身分切換 ===== */}
          <div style={styles.tabRow}>
            <button
              style={{
                ...styles.tabButton,
                ...(activeTab === "child" ? styles.tabButtonActive : {}),
              }}
              onClick={() => {
                playClick();
                setActiveTab("child");
              }}
            >
              幼兒
            </button>

            <button
              style={{
                ...styles.tabButton,
                ...(activeTab === "parent" ? styles.tabButtonActive : {}),
              }}
              onClick={() => {
                playClick();
                setActiveTab("parent");
              }}
            >
              家長
            </button>

            <button
              style={{
                ...styles.tabButton,
                ...(activeTab === "clinician" ? styles.tabButtonActive : {}),
              }}
              onClick={() => {
                playClick();
                setActiveTab("clinician");
              }}
            >
              醫療
            </button>
          </div>

          {/* ===== 幼兒端 ===== */}
          {activeTab === "child" && (
            <div style={styles.infoPanel}>
            </div>
          )}

          {/* ===== 家長端 ===== */}
          {activeTab === "parent" && (
            <div style={styles.infoPanel}>
              <h3 style={styles.sectionTitle}>家長摘要</h3>

              <div style={styles.summaryGrid}>
                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>表現評語</p>
                  <p style={styles.summaryValueText}>{performanceLabel}</p>
                </div>

                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>最高通關</p>
                  <p style={styles.summaryValueNumber}>
                    {details.highestPassedLevel > 0
                      ? `第 ${details.highestPassedLevel} 關`
                      : "未通關"}
                  </p>
                </div>

                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>記憶容量</p>
                  <p style={styles.summaryValueNumber}>{details.memorySpan}</p>
                </div>

                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>正確率</p>
                  <p style={styles.summaryValueNumber}>{details.accuracyPercent}%</p>
                </div>
              </div>
            </div>
          )}

          {/* ===== 醫療端 ===== */}
          {activeTab === "clinician" && (
            <div style={styles.infoPanel}>
              <h3 style={styles.sectionTitle}>詳細資料</h3>

              <div style={styles.summaryGrid}>
                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>總關卡數</p>
                  <p style={styles.summaryValueNumber}>{details.totalLevels}</p>
                </div>

                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>答對關卡</p>
                  <p style={styles.summaryValueNumber}>{details.correctCount}</p>
                </div>

                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>平均作答時間</p>
                  <p style={styles.summaryValueNumber}>
                    {details.averageReactionTime} ms
                  </p>
                </div>

                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>平均首點時間</p>
                  <p style={styles.summaryValueNumber}>
                    {details.averageFirstTapTime || 0} ms
                  </p>
                </div>

                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>錯誤點擊次數</p>
                  <p style={styles.summaryValueNumber}>{details.wrongTapCount}</p>
                </div>

                <div style={styles.summaryCard}>
                  <p style={styles.summaryLabel}>取消次數</p>
                  <p style={styles.summaryValueNumber}>{details.deselectCount}</p>
                </div>
              </div>

              <div style={styles.tableCard}>
                <h4 style={styles.tableTitle}>每關紀錄</h4>

                {details.levelSummaries?.length === 0 ? (
                  <p style={styles.noDataText}>目前沒有紀錄</p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>關卡</th>
                          <th style={styles.th}>記憶數量</th>
                          <th style={styles.th}>結果</th>
                          <th style={styles.th}>超時</th>
                          <th style={styles.th}>作答時間</th>
                          <th style={styles.th}>錯誤點擊</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.levelSummaries.map((item, index) => (
                          <tr key={index}>
                            <td style={styles.td}>第 {item.level} 關</td>
                            <td style={styles.td}>{item.memoryCount}</td>
                            <td style={styles.td}>
                              {item.isCorrect ? "答對" : "答錯"}
                            </td>
                            <td style={styles.td}>{item.isTimeout ? "是" : "否"}</td>
                            <td style={styles.td}>{item.reactionTime} ms</td>
                            <td style={styles.td}>{item.wrongTapCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 底部按鈕 ===== */}
          <div style={styles.bottomButtonRow}>
            <button style={styles.outlineButton} onClick={handleBackMenu}>
              返回選單
            </button>

            <button style={styles.mainButton} onClick={handleRetry}>
              再玩一次
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: (bgImage) => ({
    minHeight: "100vh",
    width: "100%",
    backgroundImage: `url(${bgImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }),

  overlay: {
    minHeight: "100vh",
    width: "100%",
    background: "rgba(255,255,255,0.18)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
  },

  mainCard: {
    width: "100%",
    maxWidth: "540px",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: "32px",
    padding: "34px 36px 30px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
    textAlign: "center",
  },

  topTitle: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#6B4B3E",
    marginBottom: "22px",
  },

  resultBox: {
    backgroundColor: "#F2EBE3",
    borderRadius: "26px",
    padding: "34px 24px 28px",
    boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
    marginBottom: "24px",
  },

  resultTitle: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#7A4F2B",
    marginBottom: "18px",
  },

  starRow: {
    fontSize: "52px",
    marginBottom: "14px",
    letterSpacing: "4px",
  },

  star: {
    margin: "0 2px",
  },

  resultLabel: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#6B4B3E",
    marginBottom: "10px",
  },

  resultSubText: {
    fontSize: "18px",
    color: "#7B6A5E",
    lineHeight: 1.7,
    margin: 0,
  },

  tabRow: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    marginBottom: "22px",
    flexWrap: "wrap",
  },

  tabButton: {
    minWidth: "88px",
    padding: "12px 22px",
    borderRadius: "18px",
    border: "1.5px solid #F39A4C",
    backgroundColor: "#fff",
    color: "#7A5A47",
    fontSize: "18px",
    fontWeight: "800",
    cursor: "pointer",
    transition: "0.2s",
  },

  tabButtonActive: {
    backgroundColor: "#F89A4B",
    color: "#fff",
    boxShadow: "0 8px 18px rgba(248,154,75,0.35)",
  },

  infoPanel: {
    marginBottom: "26px",
  },

  childBigText: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#6B4B3E",
    marginBottom: "10px",
  },

  childSmallText: {
    fontSize: "18px",
    color: "#7B6A5E",
    lineHeight: 1.8,
    margin: 0,
  },

  sectionTitle: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#6B4B3E",
    marginBottom: "18px",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },

  summaryCard: {
    backgroundColor: "#FFF9F4",
    borderRadius: "20px",
    padding: "18px 14px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
  },

  summaryLabel: {
    fontSize: "15px",
    color: "#8A6A55",
    fontWeight: "700",
    marginBottom: "8px",
  },

  summaryValueNumber: {
    fontSize: "24px",
    fontWeight: "900",
    color: "#6B4B3E",
    margin: 0,
  },

  summaryValueText: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#6B4B3E",
    margin: 0,
  },

  tableCard: {
    backgroundColor: "#FFF9F4",
    borderRadius: "22px",
    padding: "18px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
    marginTop: "10px",
  },

  tableTitle: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#6B4B3E",
    marginBottom: "14px",
  },

  noDataText: {
    fontSize: "17px",
    color: "#7B6A5E",
    margin: 0,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "560px",
  },

  th: {
    backgroundColor: "#F7E9D7",
    color: "#6B4B3E",
    fontSize: "15px",
    fontWeight: "800",
    padding: "12px 10px",
    borderBottom: "2px solid #EAD8C4",
    textAlign: "center",
  },

  td: {
    fontSize: "15px",
    color: "#6B4B3E",
    padding: "12px 10px",
    borderBottom: "1px solid #F0E1D1",
    textAlign: "center",
  },

  bottomButtonRow: {
    display: "flex",
    justifyContent: "center",
    gap: "14px",
    flexWrap: "wrap",
    marginTop: "4px",
  },

  outlineButton: {
    minWidth: "146px",
    backgroundColor: "#fff",
    color: "#F0893F",
    border: "1.8px solid #F0A15B",
    borderRadius: "18px",
    padding: "16px 26px",
    fontSize: "18px",
    fontWeight: "800",
    cursor: "pointer",
  },

  mainButton: {
    minWidth: "146px",
    backgroundColor: "#F79345",
    color: "#fff",
    border: "none",
    borderRadius: "18px",
    padding: "16px 26px",
    fontSize: "18px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(247,147,69,0.30)",
  },
};