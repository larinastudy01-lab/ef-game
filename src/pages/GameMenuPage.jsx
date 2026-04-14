import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import bgImg from "../asset/Home_background.png";

function GameMenuPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        navigate("/login");
      }
    };

    checkUser();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const games = [
    {
      id: "srt",
      title: "幫小飛鼠弟弟接住掉落的橡實",
      subtitle: "簡單反應測驗",
      color: "#FCE6B5",
      trainPath: "/training-srt",
      testPath: "/test-srt",
      description: "透過快速點擊目標，訓練與測量孩子的反應速度與專注表現。",
      available: true,
    },
    {
      id: "picture-memory",
      title: "找出兔子妹妹遺失的物品",
      subtitle: "圖片記憶遊戲",
      color: "#DDEFFF",
      trainPath: "/training-picture-memory",
      testPath: "/test-picture-memory",
      description: "透過圖片記憶與配對，訓練孩子的短期記憶與視覺辨識能力。",
      available: true,
    },
    {
      id: "dot-probe",
      title: "幫狐狸夫婦把物品上的蒼蠅趕走",
      subtitle: "抑制控制遊戲 DPT",
      color: "#E8DFFF",
      trainPath: "/training-dot-probe",
      testPath: "/test-dot-probe",
      description: "透過刺激位置判斷，觀察孩子的注意力與反應控制能力。",
      available: false,
    },
    {
      id: "working-memory",
      title: "記住跳石橋的密碼幫助鹿先生",
      subtitle: "工作記憶遊戲 CBT",
      color: "#FFE0E0",
      trainPath: "/training-cbt",
      testPath: "/test-cbt",
      description: "透過記憶與正確點擊，訓練孩子的工作記憶與資訊保持能力。",
      available: true,
    },
    {
      id: "linking-balloons",
      title: "引導迷路的綿羊奶奶回家",
      subtitle: "認知彈性遊戲 Linking Balloons",
      color: "#E3F8E2",
      trainPath: "/training-linking-balloons",
      testPath: "/test-linking-balloons",
      description: "透過規則切換與分類反應，訓練孩子的認知彈性與轉換能力。",
      available: false,
    },
    {
      id: "dccs",
      title: "幫孔雀小姐的服飾店分類混亂的衣服",
      subtitle: "認知彈性遊戲 DCCS",
      color: "#FFF0D9",
      trainPath: "/training-dccs",
      testPath: "/test-dccs",
      description: "透過顏色與形狀分類切換，觀察孩子的規則理解與切換能力。",
      available: false,
    },
  ];

  const handleNavigate = (path, available) => {
    if (!available) {
      return;
    }
    navigate(path);
  };

  return (
    <div style={pageStyle}>
      <div style={overlayStyle}>
        {/* Header */}
        <div style={headerCardStyle}>
          <div style={headerTopStyle}>
            <div>
              <h1 style={mainTitleStyle}>動物森友會</h1>
              <p style={subTitleStyle}>家長端｜請選擇想進行的遊戲模組</p>
              <p style={descStyle}>
                可依照孩子需求選擇不同遊戲，並進一步決定進入「訓練模式」或「測驗模式」。
              </p>
            </div>

            <div style={headerButtonGroupStyle}>
              <button
                onClick={() => navigate("/add-patient")}
                style={profileButtonStyle}
              >
                查看個人檔案
              </button>

              <button onClick={handleLogout} style={logoutButtonStyle}>
                登出
              </button>
            </div>
          </div>
        </div>

        {/* Section Title */}
        <div style={topRowStyle}>
          <h2 style={sectionTitleStyle}>遊戲選單</h2>
        </div>

        {/* Game Grid */}
        <div style={gridStyle}>
          {games.map((game) => (
            <div key={game.id} style={cardStyle}>
              <div>
                <div
                  style={{
                    ...badgeStyle,
                    background: game.color,
                  }}
                >
                  <span style={{ fontSize: "28px" }}>{game.emoji}</span>
                  <span>{game.subtitle}</span>
                </div>

                <h3 style={gameTitleStyle}>{game.title}</h3>
                <p style={gameDescStyle}>{game.description}</p>

                {!game.available && (
                  <div style={comingSoonStyle}>尚未開放</div>
                )}
              </div>

              <div style={buttonRowStyle}>
                <button
                  onClick={() => handleNavigate(game.trainPath, game.available)}
                  style={{
                    ...trainButtonStyle,
                    opacity: game.available ? 1 : 0.55,
                    cursor: game.available ? "pointer" : "not-allowed",
                  }}
                >
                  訓練模式
                </button>

                <button
                  onClick={() => handleNavigate(game.testPath, game.available)}
                  style={{
                    ...testButtonStyle,
                    opacity: game.available ? 1 : 0.55,
                    cursor: game.available ? "pointer" : "not-allowed",
                  }}
                >
                  測驗模式
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Styles
========================= */

const pageStyle = {
  minHeight: "100vh",
  backgroundImage: `
    linear-gradient(rgba(255, 248, 238, 0.78), rgba(255, 248, 238, 0.82)),
    url(${bgImg})
  `,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  padding: "34px 34px 60px",
  boxSizing: "border-box",
};

const overlayStyle = {
  maxWidth: "1400px",
  margin: "0 auto",
};

const headerCardStyle = {
  background: "rgba(255, 252, 247, 0.92)",
  borderRadius: "34px",
  padding: "42px 48px",
  marginBottom: "30px",
  boxShadow: "0 14px 32px rgba(120, 90, 60, 0.10)",
  border: "2px solid rgba(184, 149, 114, 0.14)",
  backdropFilter: "blur(4px)",
};

const headerTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
};

const headerButtonGroupStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const mainTitleStyle = {
  fontSize: "52px",
  fontWeight: "800",
  color: "#1D3F73",
  margin: "0 0 12px 0",
  letterSpacing: "1px",
};

const subTitleStyle = {
  fontSize: "22px",
  color: "#6A5C50",
  marginBottom: "12px",
  fontWeight: "600",
};

const descStyle = {
  fontSize: "17px",
  color: "#8A7A6B",
  lineHeight: "1.9",
  maxWidth: "920px",
  margin: 0,
};

const topRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
  gap: "20px",
  flexWrap: "wrap",
};

const sectionTitleStyle = {
  fontSize: "40px",
  fontWeight: "800",
  color: "#1D3F73",
  margin: 0,
};

const profileButtonStyle = {
  background: "linear-gradient(135deg, #6AA8FF, #3D84F5)",
  color: "white",
  border: "none",
  borderRadius: "18px",
  padding: "16px 28px",
  fontSize: "17px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(61, 132, 245, 0.25)",
};

const logoutButtonStyle = {
  background: "linear-gradient(135deg, #FF8A8A, #E45B5B)",
  color: "white",
  border: "none",
  borderRadius: "18px",
  padding: "16px 24px",
  fontSize: "16px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(228, 91, 91, 0.25)",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
  gap: "28px",
};

const cardStyle = {
  background: "rgba(255, 252, 248, 0.94)",
  borderRadius: "32px",
  padding: "30px",
  boxShadow: "0 14px 32px rgba(120, 90, 60, 0.08)",
  minHeight: "340px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  border: "1.5px solid rgba(184, 149, 114, 0.10)",
  backdropFilter: "blur(3px)",
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  borderRadius: "18px",
  padding: "10px 16px",
  fontSize: "18px",
  fontWeight: "700",
  marginBottom: "22px",
  color: "#1D3557",
};

const gameTitleStyle = {
  fontSize: "32px",
  fontWeight: "800",
  color: "#1D3557",
  marginBottom: "14px",
  lineHeight: "1.35",
};

const gameDescStyle = {
  fontSize: "18px",
  color: "#6F655E",
  lineHeight: "1.9",
  marginBottom: "18px",
};

const comingSoonStyle = {
  display: "inline-block",
  background: "#F6D7D7",
  color: "#A24B4B",
  fontSize: "15px",
  fontWeight: "700",
  padding: "8px 14px",
  borderRadius: "999px",
};

const buttonRowStyle = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
  marginTop: "10px",
};

const trainButtonStyle = {
  background: "linear-gradient(135deg, #F3B34D, #E5962D)",
  color: "white",
  border: "none",
  borderRadius: "18px",
  padding: "16px 28px",
  fontSize: "18px",
  fontWeight: "700",
  minWidth: "150px",
  boxShadow: "0 8px 20px rgba(229, 150, 45, 0.22)",
};

const testButtonStyle = {
  background: "linear-gradient(135deg, #8A72FF, #6C58E8)",
  color: "white",
  border: "none",
  borderRadius: "18px",
  padding: "16px 28px",
  fontSize: "18px",
  fontWeight: "700",
  minWidth: "150px",
  boxShadow: "0 8px 20px rgba(108, 88, 232, 0.22)",
};

export default GameMenuPage;