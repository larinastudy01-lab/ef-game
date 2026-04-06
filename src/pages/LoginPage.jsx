import bgImg from "../asset/Home_background.png";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, Link } from "react-router-dom";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) {
      return;
    }

    console.log("開始登入...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("登入結果 data:", data);
    console.log("登入結果 error:", error);

    if (error) {
      return;
    }

    const user = data.user;

    if (!user) {
      return;
    }

    console.log("登入成功 user.id:", user.id);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    console.log("profileData:", profileData);
    console.log("profileError:", profileError);

    if (profileError || !profileData) {
      return;
    }

    if (profileData.role === "guardian") {
      navigate("/game-menu");
    } else if (profileData.role === "clinician") {
      navigate("/clinician-dashboard");
    } else {
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={leftSectionStyle}>
          <h2 style={titleStyle}>登入系統</h2>
          <p style={subtitleStyle}>請使用家長或醫療人員帳號登入</p>
        </div>

        <div style={rightSectionStyle}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <button onClick={handleLogin} style={buttonStyle}>
            登入
          </button>

          <p style={bottomTextStyle}>
            還沒有家長帳號？{" "}
            <Link to="/" style={linkStyle}>
              前往註冊
            </Link>
          </p>
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
  alignItems: "flex-start",
  padding: "80px 30px 30px",
  textAlign: "center",
  padding: "30px",
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

const cardStyle = {
  width: "100%",
  maxWidth: "980px",
  minHeight: "300px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "40px",
  background:
    "linear-gradient(180deg, rgba(255,249,242,0.96), rgba(247,236,222,0.94))",
  borderRadius: "32px",
  padding: "42px 48px",
  boxShadow: "0 16px 40px rgba(120, 90, 60, 0.12)",
  border: "2px solid rgba(181, 145, 109, 0.18)",
  backdropFilter: "blur(4px)",
  boxSizing: "border-box",
};

const leftSectionStyle = {
  flex: 1,
  textAlign: "left",
  minWidth: "240px",
};

const rightSectionStyle = {
  flex: 1.2,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const titleStyle = {
  margin: 0,
  marginBottom: "16px",
  fontSize: "48px",
  fontWeight: "800",
  color: "#4f3422",
  letterSpacing: "1px",
};

const subtitleStyle = {
  marginTop: 0,
  marginBottom: "0",
  color: "#7a6657",
  fontSize: "18px",
  lineHeight: "1.8",
};

const inputStyle = {
  width: "100%",
  padding: "18px 20px",
  marginBottom: "18px",
  borderRadius: "18px",
  border: "1.5px solid #d8c6b5",
  backgroundColor: "#f8efe6",
  fontSize: "18px",
  color: "#5b4636",
  boxSizing: "border-box",
  outline: "none",
};

const buttonStyle = {
  width: "100%",
  padding: "18px",
  borderRadius: "18px",
  border: "none",
  background: "linear-gradient(135deg, #d89b4d, #c97d2b)",
  color: "white",
  fontSize: "22px",
  fontWeight: "700",
  cursor: "pointer",
  marginTop: "8px",
  boxShadow: "0 8px 18px rgba(201, 125, 43, 0.25)",
};

const bottomTextStyle = {
  marginTop: "18px",
  textAlign: "center",
  color: "#7a6657",
  fontSize: "15px",
};

const linkStyle = {
  color: "#8b5e3c",
  textDecoration: "none",
  fontWeight: "700",
};

export default LoginPage;