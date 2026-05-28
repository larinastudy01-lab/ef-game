import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const mockChildren = [
  {
    id: "child-1",
    name: "小蜜",
    age: 5,
    avatar: "/asset/avatar/bear.png",
    todayTestDone: true,
    todayTrainingDone: false,
    lastActivity: {
      type: "測驗",
      game: "反應力小蜜蜂",
      date: "今天 10:20",
      summary: "反應速度穩定，答題時能保持專注。",
      parentText: "孩子今天在反應任務中表現穩定，能聽到指令後做出正確反應。",
    },
    trend: "improving",
    trendText: "本週有進步",
    trendDetail: "最近幾次反應速度比上週更穩定，可以持續練習注意力與反應控制。",
    todaySuggestion: "建議進行 5 分鐘反應力訓練",
    clinicianNotice: "醫療端建議：本週可觀察孩子在轉換規則時是否容易分心。",
    followUp: "下次回診：2026/05/20",
  },
  {
    id: "child-2",
    name: "波波",
    age: 4,
    avatar: "/asset/avatar/rabbit.png",
    todayTestDone: false,
    todayTrainingDone: true,
    lastActivity: {
      type: "訓練",
      game: "圖像記憶小任務",
      date: "昨天 18:40",
      summary: "記憶表現良好，但中途需要較多鼓勵。",
      parentText: "孩子能記住大部分圖片位置，但遇到較多物件時會稍微猶豫。",
    },
    trend: "stable",
    trendText: "表現穩定",
    trendDetail: "整體表現維持穩定，建議不要一次增加太多難度。",
    todaySuggestion: "建議完成今日測驗，了解目前狀態",
    clinicianNotice: "暫無新的醫療端提醒。",
    followUp: "目前沒有安排回診",
  },
];

const trendStyleMap = {
  improving: {
    label: "本週有進步",
    color: "#2f8f5b",
    bg: "#e8f7ee",
  },
  stable: {
    label: "表現穩定",
    color: "#7a5c22",
    bg: "#fff5d9",
  },
  watch: {
    label: "需觀察",
    color: "#b45b3e",
    bg: "#fff0ea",
  },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedChildId, setSelectedChildId] = useState(mockChildren[0]?.id);

  const selectedChild = useMemo(() => {
    return mockChildren.find((child) => child.id === selectedChildId) || mockChildren[0];
  }, [selectedChildId]);

  const completionText = useMemo(() => {
    if (selectedChild.todayTestDone && selectedChild.todayTrainingDone) {
      return "今天測驗與訓練都完成了，孩子今日任務很完整。";
    }

    if (selectedChild.todayTestDone && !selectedChild.todayTrainingDone) {
      return "今天已完成測驗，還可以安排一小段訓練。";
    }

    if (!selectedChild.todayTestDone && selectedChild.todayTrainingDone) {
      return "今天已完成訓練，建議補上測驗了解目前狀態。";
    }

    return "今天尚未完成測驗與訓練，可以先從短時間任務開始。";
  }, [selectedChild]);

  const trendInfo = trendStyleMap[selectedChild.trend] || trendStyleMap.stable;

  return (
    <div style={styles.page}>
      <div style={styles.backgroundOverlay} />

      <main style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Parent Dashboard</p>
            <h1 style={styles.title}>孩子今日狀況總覽</h1>
            <p style={styles.subtitle}>
              快速了解孩子今天是否完成任務、最近表現，以及是否有醫療端提醒。
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link to="/" style={styles.secondaryButton}>
              回首頁
            </Link>
            <Link to="/GameMenuPage" style={styles.primaryButton}>
              開始任務
            </Link>
          </div>
        </header>

        <section style={styles.layout}>
          <aside style={styles.childPanel}>
            <div style={styles.panelTitleRow}>
              <h2 style={styles.sectionTitle}>孩子列表</h2>
              <Link to="/AddPatientPage" style={styles.smallLink}>
                新增孩子
              </Link>
            </div>

            <div style={styles.childList}>
              {mockChildren.map((child) => {
                const isActive = child.id === selectedChildId;

                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setSelectedChildId(child.id)}
                    style={{
                      ...styles.childCard,
                      ...(isActive ? styles.childCardActive : {}),
                    }}
                  >
                    <img
                      src={child.avatar}
                      alt={child.name}
                      style={styles.childAvatar}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />

                    <div style={styles.childInfo}>
                      <strong style={styles.childName}>{child.name}</strong>
                      <span style={styles.childMeta}>{child.age} 歲</span>
                    </div>

                    <span
                      style={{
                        ...styles.childStatusDot,
                        backgroundColor:
                          child.todayTestDone || child.todayTrainingDone ? "#76b87d" : "#e09b73",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </aside>

          <section style={styles.mainPanel}>
            <div style={styles.profileCard}>
              <div style={styles.profileLeft}>
                <div style={styles.avatarCircle}>
                  <img
                    src={selectedChild.avatar}
                    alt={selectedChild.name}
                    style={styles.profileAvatar}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>

                <div>
                  <p style={styles.cardLabel}>目前查看</p>
                  <h2 style={styles.childHeading}>{selectedChild.name}</h2>
                  <p style={styles.parentSentence}>{completionText}</p>
                </div>
              </div>

              <div
                style={{
                  ...styles.trendBadge,
                  color: trendInfo.color,
                  background: trendInfo.bg,
                }}
              >
                <span>{trendInfo.icon}</span>
                {selectedChild.trendText}
              </div>
            </div>

            <div style={styles.summaryGrid}>
              <div style={styles.statusCard}>
                <p style={styles.cardLabel}>今日完成狀態</p>

                <div style={styles.checkRow}>
                  <span style={selectedChild.todayTestDone ? styles.doneIcon : styles.pendingIcon}>
                    {selectedChild.todayTestDone ? "✓" : "!"}
                  </span>
                  <div>
                    <strong>今日測驗</strong>
                    <p style={styles.smallText}>
                      {selectedChild.todayTestDone
                        ? "已完成，可以查看孩子今天的基本狀態。"
                        : "尚未完成，建議先安排一個短測驗。"}
                    </p>
                  </div>
                </div>

                <div style={styles.checkRow}>
                  <span
                    style={selectedChild.todayTrainingDone ? styles.doneIcon : styles.pendingIcon}
                  >
                    {selectedChild.todayTrainingDone ? "✓" : "!"}
                  </span>
                  <div>
                    <strong>今日訓練</strong>
                    <p style={styles.smallText}>
                      {selectedChild.todayTrainingDone
                        ? "已完成，孩子今天有進行能力練習。"
                        : "尚未完成，可選擇短時間訓練。"}
                    </p>
                  </div>
                </div>
              </div>

              <div style={styles.statusCard}>
                <p style={styles.cardLabel}>最近一次表現</p>
                <h3 style={styles.cardTitle}>
                  {selectedChild.lastActivity.type}｜{selectedChild.lastActivity.game}
                </h3>
                <p style={styles.smallText}>{selectedChild.lastActivity.date}</p>
                <p style={styles.parentSentence}>{selectedChild.lastActivity.parentText}</p>
              </div>

              <div style={styles.statusCard}>
                <p style={styles.cardLabel}>簡單成長趨勢</p>
                <h3 style={styles.cardTitle}>{selectedChild.trendText}</h3>
                <p style={styles.parentSentence}>{selectedChild.trendDetail}</p>
              </div>
            </div>

            <div style={styles.bottomGrid}>
              <div style={styles.recommendCard}>
                <div>
                  <p style={styles.cardLabel}>今日建議訓練</p>
                  <h3 style={styles.cardTitle}>{selectedChild.todaySuggestion}</h3>
                  <p style={styles.parentSentence}>
                    建議以短時間、低壓力的方式進行。訓練關卡可以給少量必要提示或稱讚，
                    但測驗關卡不加入干擾與提示。
                  </p>
                </div>

                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={() => navigate("/GameMenuPage")}
                >
                  前往訓練
                </button>
              </div>

              <div style={styles.noticeCard}>
                <p style={styles.cardLabel}>醫療端提醒 / 回診通知</p>
                <h3 style={styles.cardTitle}>需要留意的地方</h3>
                <p style={styles.parentSentence}>{selectedChild.clinicianNotice}</p>
                <div style={styles.followUpBox}>{selectedChild.followUp}</div>
              </div>
            </div>
          </section>
        </section>
      </main>

      <button
        type="button"
        style={styles.aiAssistant}
        onClick={() => navigate("/AIAssistantPage")}
        aria-label="開啟 AI 小助手"
      >
        <img
          src="/assist.png"
          alt="AI 小助手"
          style={styles.aiIcon}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <span>
          AI 小助手
          <small>看不懂數據可以問我</small>
        </span>
      </button>
    </div>
  );
}

const styles = {
  page: {
    position: "relative",
    minHeight: "100vh",
    overflow: "hidden",
    backgroundImage: 'url("/Home_background.png")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    fontFamily:
      '"Noto Sans TC", "Microsoft JhengHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    color: "#4d3b2f",
  },
  backgroundOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(120deg, rgba(255,248,231,0.92), rgba(255,242,216,0.82), rgba(255,255,255,0.72))",
    zIndex: 0,
  },
  container: {
    position: "relative",
    zIndex: 1,
    width: "min(1180px, calc(100% - 40px))",
    margin: "0 auto",
    padding: "36px 0 110px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "24px",
    marginBottom: "24px",
  },
  eyebrow: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 800,
    color: "#d58b45",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "6px 0 8px",
    fontSize: "36px",
    lineHeight: 1.2,
    color: "#4b382c",
  },
  subtitle: {
    margin: 0,
    fontSize: "16px",
    color: "#7d6656",
  },
  headerActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "999px",
    padding: "12px 22px",
    background: "linear-gradient(135deg, #f5a85b, #f0c15d)",
    color: "#fff",
    fontWeight: 900,
    fontSize: "15px",
    textDecoration: "none",
    boxShadow: "0 10px 22px rgba(199, 126, 45, 0.24)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    border: "2px solid rgba(207, 151, 90, 0.35)",
    borderRadius: "999px",
    padding: "10px 20px",
    background: "rgba(255, 255, 255, 0.7)",
    color: "#7b5a3f",
    fontWeight: 800,
    fontSize: "15px",
    textDecoration: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: "22px",
    alignItems: "start",
  },
  childPanel: {
    background: "rgba(255, 255, 255, 0.78)",
    border: "1px solid rgba(222, 177, 111, 0.28)",
    borderRadius: "28px",
    padding: "20px",
    boxShadow: "0 18px 36px rgba(125, 86, 45, 0.12)",
    backdropFilter: "blur(8px)",
  },
  panelTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "20px",
    color: "#4b382c",
  },
  smallLink: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#d58b45",
    textDecoration: "none",
  },
  childList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  childCard: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: "20px",
    border: "2px solid transparent",
    background: "rgba(255, 250, 241, 0.9)",
    cursor: "pointer",
    textAlign: "left",
  },
  childCardActive: {
    borderColor: "#f0b45f",
    background: "#fff5df",
    boxShadow: "0 10px 20px rgba(191, 128, 50, 0.16)",
  },
  childAvatar: {
    width: "46px",
    height: "46px",
    objectFit: "contain",
  },
  childInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  childName: {
    fontSize: "16px",
    color: "#4b382c",
  },
  childMeta: {
    fontSize: "13px",
    color: "#8b7564",
  },
  childStatusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  mainPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  profileCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "22px",
    borderRadius: "30px",
    background: "rgba(255, 255, 255, 0.82)",
    border: "1px solid rgba(222, 177, 111, 0.28)",
    boxShadow: "0 18px 36px rgba(125, 86, 45, 0.12)",
    backdropFilter: "blur(8px)",
  },
  profileLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  avatarCircle: {
    width: "82px",
    height: "82px",
    borderRadius: "50%",
    background: "#fff1cf",
    display: "grid",
    placeItems: "center",
    border: "4px solid rgba(240, 180, 95, 0.35)",
  },
  profileAvatar: {
    width: "62px",
    height: "62px",
    objectFit: "contain",
  },
  cardLabel: {
    margin: "0 0 6px",
    fontSize: "13px",
    fontWeight: 900,
    color: "#d58b45",
    letterSpacing: "0.04em",
  },
  childHeading: {
    margin: "0 0 6px",
    fontSize: "28px",
    color: "#4b382c",
  },
  parentSentence: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.7,
    color: "#6f5a4a",
  },
  trendBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "999px",
    padding: "10px 16px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
  },
  statusCard: {
    minHeight: "190px",
    padding: "20px",
    borderRadius: "26px",
    background: "rgba(255, 255, 255, 0.82)",
    border: "1px solid rgba(222, 177, 111, 0.26)",
    boxShadow: "0 14px 28px rgba(125, 86, 45, 0.1)",
  },
  checkRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    marginTop: "14px",
  },
  doneIcon: {
    flex: "0 0 auto",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#e8f7ee",
    color: "#2f8f5b",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },
  pendingIcon: {
    flex: "0 0 auto",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#fff0e8",
    color: "#c56f43",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },
  smallText: {
    margin: "4px 0 0",
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#846d5c",
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: "19px",
    color: "#4b382c",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: "16px",
  },
  recommendCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "22px",
    borderRadius: "28px",
    background: "linear-gradient(135deg, rgba(255, 248, 228, 0.94), rgba(255, 255, 255, 0.82))",
    border: "1px solid rgba(222, 177, 111, 0.3)",
    boxShadow: "0 14px 28px rgba(125, 86, 45, 0.1)",
  },
  noticeCard: {
    padding: "22px",
    borderRadius: "28px",
    background: "rgba(255, 255, 255, 0.82)",
    border: "1px solid rgba(222, 177, 111, 0.26)",
    boxShadow: "0 14px 28px rgba(125, 86, 45, 0.1)",
  },
  followUpBox: {
    marginTop: "14px",
    padding: "12px 14px",
    borderRadius: "18px",
    background: "#fff4de",
    color: "#7a5c22",
    fontWeight: 900,
  },
  aiAssistant: {
    position: "fixed",
    left: "24px",
    bottom: "24px",
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    border: "none",
    borderRadius: "24px",
    padding: "12px 16px",
    background: "rgba(255, 255, 255, 0.92)",
    color: "#4b382c",
    boxShadow: "0 16px 34px rgba(91, 61, 31, 0.2)",
    cursor: "pointer",
    fontWeight: 900,
  },
  aiIcon: {
    width: "46px",
    height: "46px",
    objectFit: "contain",
  },
};

styles.aiAssistant.span = {
  display: "flex",
  flexDirection: "column",
};

const responsiveStyle = document.createElement("style");
responsiveStyle.innerHTML = `
  @media (max-width: 980px) {
    main {
      width: min(100% - 28px, 1180px) !important;
    }

    [style*="grid-template-columns: 280px 1fr"] {
      grid-template-columns: 1fr !important;
    }

    [style*="grid-template-columns: repeat(3"] {
      grid-template-columns: 1fr !important;
    }

    [style*="grid-template-columns: 1.15fr 0.85fr"] {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 720px) {
    header {
      flex-direction: column !important;
      align-items: flex-start !important;
    }

    h1 {
      font-size: 28px !important;
    }

    button[aria-label="開啟 AI 小助手"] {
      left: 14px !important;
      bottom: 14px !important;
      right: 14px !important;
      justify-content: center !important;
    }
  }
`;

if (typeof document !== "undefined" && !document.getElementById("dashboard-responsive-style")) {
  responsiveStyle.id = "dashboard-responsive-style";
  document.head.appendChild(responsiveStyle);
}