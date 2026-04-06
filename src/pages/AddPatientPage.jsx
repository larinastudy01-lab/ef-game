import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

function AddPatientPage() {
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [patients, setPatients] = useState([]);
  const [guardianName, setGuardianName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchGuardianAndPatients();
  }, []);

  const fetchGuardianAndPatients = async () => {
    // 1. 先確認是否登入
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("請先登入");
      navigate("/login");
      return;
    }

    // 2. 取得家長資料
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profileError && profileData) {
      setGuardianName(profileData.full_name || "家長");
    }

    // 3. 取得這位家長的孩子資料
    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select("*")
      .eq("guardian_id", user.id)
      .order("created_at", { ascending: false });

    if (patientError) {
      console.error("讀取孩子資料失敗:", patientError.message);
      return;
    }

    setPatients(patientData || []);
  };

  const handleAddPatient = async () => {
    if (!nickname || !birthDate) {
      alert("請填寫孩子暱稱與出生年月日");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("請先登入");
      navigate("/login");
      return;
    }

    const { error } = await supabase.from("patients").insert([
      {
        guardian_id: user.id,
        nickname: nickname,
        birth_date: birthDate,
        gender: gender,
      },
    ]);

    if (error) {
      alert("新增孩子失敗：" + error.message);
      return;
    }

    alert("孩子資料新增成功！");
    setNickname("");
    setBirthDate("");
    setGender("");
    fetchGuardianAndPatients();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    alert("已登出");
    navigate("/login");
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return "-";
    const today = new Date();
    const birth = new Date(birthDate);

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} 歲 ${months} 個月`;
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>EF 幼兒認知訓練平台</h1>
          <p style={subtitleStyle}>家長端｜孩子資料管理</p>
        </div>

        <div style={headerRightStyle}>
          <span style={guardianTextStyle}>您好，{guardianName}</span>
          <button onClick={handleLogout} style={logoutButtonStyle}>
            登出
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={contentWrapperStyle}>
        {/* 左側：新增孩子 */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>新增孩子資料</h2>
          <p style={sectionDescStyle}>
            請先建立孩子基本資料，之後即可進行遊戲與訓練紀錄管理。
          </p>

          <input
            type="text"
            placeholder="孩子暱稱"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={inputStyle}
          />

          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            style={inputStyle}
          />

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={inputStyle}
          >
            <option value="">請選擇性別（可選）</option>
            <option value="男">男</option>
            <option value="女">女</option>
            <option value="其他">其他</option>
          </select>

          <button onClick={handleAddPatient} style={primaryButtonStyle}>
            新增孩子
          </button>
        </div>

        {/* 右側：孩子清單 */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>已建立孩子名單</h2>
          <p style={sectionDescStyle}>
            目前已建立的孩子資料會顯示在這裡。
          </p>

          {patients.length === 0 ? (
            <div style={emptyBoxStyle}>
              <p style={{ margin: 0, color: "#777" }}>尚未新增任何孩子資料</p>
            </div>
          ) : (
            <div style={patientListStyle}>
              {patients.map((patient) => (
                <div key={patient.id} style={patientCardStyle}>
                  <div>
                    <h3 style={patientNameStyle}>{patient.nickname}</h3>
                    <p style={patientInfoStyle}>
                      出生日期：{patient.birth_date}
                    </p>
                    <p style={patientInfoStyle}>
                      年齡：{calculateAge(patient.birth_date)}
                    </p>
                    <p style={patientInfoStyle}>
                      性別：{patient.gender || "未填寫"}
                    </p>
                  </div>

                  <button style={detailButtonStyle}>查看資料</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== styles ===== */

const pageStyle = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #fff5e1, #fce7c8)",
  padding: "32px",
  fontFamily: "Arial, sans-serif",
  boxSizing: "border-box",
};

const headerStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "24px 32px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "28px",
};

const titleStyle = {
  margin: 0,
  fontSize: "30px",
  fontWeight: "700",
  color: "#222",
};

const subtitleStyle = {
  margin: "8px 0 0 0",
  fontSize: "15px",
  color: "#777",
};

const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const guardianTextStyle = {
  fontSize: "16px",
  color: "#444",
  fontWeight: "600",
};

const logoutButtonStyle = {
  padding: "10px 18px",
  borderRadius: "12px",
  border: "none",
  backgroundColor: "#ef4444",
  color: "white",
  fontSize: "14px",
  cursor: "pointer",
};

const contentWrapperStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1.2fr",
  gap: "24px",
};

const cardStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: "10px",
  fontSize: "28px",
  color: "#222",
};

const sectionDescStyle = {
  marginTop: 0,
  marginBottom: "24px",
  fontSize: "15px",
  color: "#777",
  lineHeight: "1.6",
};

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  marginBottom: "16px",
  borderRadius: "14px",
  border: "1px solid #ddd",
  fontSize: "16px",
  boxSizing: "border-box",
  backgroundColor: "#fafafa",
};

const primaryButtonStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: "14px",
  border: "none",
  backgroundColor: "#f59e0b",
  color: "white",
  fontSize: "17px",
  fontWeight: "600",
  cursor: "pointer",
  marginTop: "8px",
};

const emptyBoxStyle = {
  background: "#fafafa",
  border: "1px dashed #ddd",
  borderRadius: "16px",
  padding: "24px",
  textAlign: "center",
};

const patientListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const patientCardStyle = {
  background: "#fffaf2",
  border: "1px solid #f3e0b5",
  borderRadius: "18px",
  padding: "20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const patientNameStyle = {
  margin: "0 0 10px 0",
  fontSize: "22px",
  color: "#222",
};

const patientInfoStyle = {
  margin: "4px 0",
  fontSize: "14px",
  color: "#666",
};

const detailButtonStyle = {
  padding: "10px 18px",
  borderRadius: "12px",
  border: "none",
  backgroundColor: "#2563eb",
  color: "white",
  fontSize: "14px",
  cursor: "pointer",
};

export default AddPatientPage;