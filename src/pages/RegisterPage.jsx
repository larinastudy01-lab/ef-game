import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      alert("請填寫完整資料");
      return;
    }

    // 1. 註冊 Auth 帳號
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("註冊失敗：" + error.message);
      return;
    }

    const user = data.user;

    if (!user) {
      alert("找不到使用者資料");
      return;
    }

    // 2. 建立 profiles 資料
    const { error: profileError } = await supabase
      .from("profiles")
      .insert([
        {
          id: user.id,
          email: email,
          full_name: fullName,
          role: "guardian",
        },
      ]);

    if (profileError) {
      alert("建立個人資料失敗：" + profileError.message);
      return;
    }

    alert("註冊成功！請登入");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff5e1, #ffd6a5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "20px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <h2 style={{ marginBottom: "20px" }}>家長註冊</h2>

        <input
          type="text"
          placeholder="家長姓名"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
        />

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

        <button onClick={handleRegister} style={buttonStyle}>
          註冊
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "15px",
  borderRadius: "10px",
  border: "1px solid #ccc",
  fontSize: "16px",
  boxSizing: "border-box",
};

const buttonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "none",
  backgroundColor: "#ff9f1c",
  color: "white",
  fontSize: "16px",
  cursor: "pointer",
};

export default RegisterPage;