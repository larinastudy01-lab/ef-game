import bgImg from "../asset/Home_background.png";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function ClinicianLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleClinicianLogin = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return;
    }

    const userId = data.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return;
    }

    if (profile.role !== "clinician") {
      return;
    }

    navigate("/clinician-dashboard");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: `url(${bgImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "60px 20px 40px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          background: "rgba(248, 243, 235, 0.92)",
          borderRadius: "30px",
          padding: "50px 60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "60px",
          boxShadow: "0 16px 40px rgba(80, 50, 20, 0.12)",
          backdropFilter: "blur(6px)",
        }}
      >
        {/* 左側文字 */}
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: "56px",
              fontWeight: "800",
              color: "#5A3E2B",
              marginBottom: "20px",
            }}
          >
            醫療登入
          </h1>

          <p
            style={{
              fontSize: "18px",
              color: "#7A6554",
              lineHeight: "2",
              maxWidth: "420px",
            }}
          >
            請使用醫療人員帳號登入，
            <br />
            以查看個案資料、評測結果
            <br />
            與訓練紀錄分析。
          </p>
        </div>

        {/* 右側登入區 */}
        <div style={{ flex: 1, maxWidth: "460px" }}>
          <form
            onSubmit={handleClinicianLogin}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <input
              type="email"
              placeholder="請輸入 Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                padding: "18px 20px",
                fontSize: "17px",
                borderRadius: "16px",
                border: "1.5px solid #D8C2A8",
                backgroundColor: "#E8EEF7",
                outline: "none",
                color: "#5A3E2B",
              }}
            />

            <input
              type="password"
              placeholder="請輸入密碼"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                padding: "18px 20px",
                fontSize: "17px",
                borderRadius: "16px",
                border: "1.5px solid #D8C2A8",
                backgroundColor: "#E8EEF7",
                outline: "none",
                color: "#5A3E2B",
              }}
            />

            <button
              type="submit"
              style={{
                background: "#D7903B",
                color: "white",
                border: "none",
                borderRadius: "16px",
                padding: "18px",
                fontSize: "20px",
                fontWeight: "700",
                cursor: "pointer",
                marginTop: "6px",
                boxShadow: "0 8px 18px rgba(215, 144, 59, 0.28)",
              }}
            >
              醫療登入
            </button>
          </form>

          <button
            onClick={() => navigate("/")}
            style={{
              marginTop: "18px",
              width: "100%",
              background: "transparent",
              color: "#7A5A3A",
              border: "1.5px solid #D8C2A8",
              borderRadius: "16px",
              padding: "16px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            返回首頁
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClinicianLoginPage;