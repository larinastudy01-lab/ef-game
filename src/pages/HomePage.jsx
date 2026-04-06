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

export default HomePage;