import bgImg from "../asset/Home_background.png";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function ClinicianDashboard() {
  const navigate = useNavigate();

  const [clinicianName, setClinicianName] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClinicianAndPatients();
  }, []);

  const fetchClinicianAndPatients = async () => {
    try {
      setLoading(true);

      // 1. 取得目前登入使用者
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      console.log("目前登入 user:", user);
      console.log("目前登入 user.id:", user?.id);

      if (userError || !user) {
        navigate("/login");
        return;
      }

      // 2. 抓醫療人員 profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      console.log("profileData:", profileData);
      console.log("profileError:", profileError);

      if (profileError || !profileData) {
        navigate("/login");
        return;
      }

      if (profileData.role !== "clinician") {
        navigate("/login");
        return;
      }

      setClinicianName(profileData.full_name || "醫療人員");

      // 3. 抓 access 關聯表
      const { data: accessData, error: accessError } = await supabase
        .from("clinician_patient_access")
        .select("patient_id")
        .eq("clinician_id", user.id);

      console.log("accessData:", accessData);
      console.log("accessError:", accessError);

      if (accessError) {
        return;
      }

      if (!accessData || accessData.length === 0) {
        console.log("目前沒有任何連結的孩子");
        setPatients([]);
        return;
      }

      // 4. 抽出所有 patient_id
      const patientIds = accessData.map((item) => item.patient_id);
      console.log("patientIds:", patientIds);

      // 5. 用 patient_id 去 patients 表抓孩子資料
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .in("id", patientIds)
        .order("created_at", { ascending: false });

      console.log("patientData:", patientData);
      console.log("patientError:", patientError);

      if (patientError) {
        return;
      }

      setPatients(patientData || []);
    } catch (error) {
      console.error("fetchClinicianAndPatients 發生錯誤：", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return "-";

    const today = new Date();
    const birth = new Date(birthDate);

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();

    if (today.getDate() < birth.getDate()) {
      months--;
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} 歲 ${months} 個月`;
  };

  const formatGender = (gender) => {
    if (!gender) return "未填寫";
    if (gender === "male") return "男";
    if (gender === "female") return "女";
    return gender;
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>EF 幼兒認知訓練平台</h1>
          <p style={subtitleStyle}>醫療端｜個案資料總覽</p>
        </div>

        <div style={headerRightStyle}>
          <span style={userTextStyle}>您好，{clinicianName || "醫療人員"}</span>
          <button onClick={handleLogout} style={logoutButtonStyle}>
            登出
          </button>
        </div>
      </div>

      {/* 主卡片 */}
      <div style={mainCardStyle}>
        <h2 style={sectionTitleStyle}>個案清單</h2>
        <p style={sectionDescStyle}>
          這裡會顯示目前授權給您查看的孩子資料、測驗結果與訓練紀錄。
        </p>

        {loading ? (
          <div style={emptyBoxStyle}>
            <p style={emptyTextStyle}>載入中...</p>
          </div>
        ) : patients.length === 0 ? (
          <div style={emptyBoxStyle}>
            <p style={emptyTextStyle}>目前尚未連結任何個案資料</p>
          </div>
        ) : (
          <div style={patientGridStyle}>
            {patients.map((patient) => (
              <div key={patient.id} style={patientCardStyle}>
                <div>
                  <h3 style={patientNameStyle}>{patient.nickname}</h3>
                  <p style={patientInfoStyle}>
                    <strong>出生日期：</strong>
                    {patient.birth_date || "-"}
                  </p>
                  <p style={patientInfoStyle}>
                    <strong>年齡：</strong>
                    {calculateAge(patient.birth_date)}
                  </p>
                  <p style={patientInfoStyle}>
                    <strong>性別：</strong>
                    {formatGender(patient.gender)}
                  </p>
                </div>

                <button
                  style={detailButtonStyle}
                >
                  查看個案
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- 樣式 ---------------- */

const pageStyle = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #eef4ff, #dbeafe)",
  padding: "32px",
  fontFamily: "Arial, sans-serif",
  boxSizing: "border-box",
};

const headerStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "28px 32px",
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
  color: "#1f2937",
};

const subtitleStyle = {
  margin: "8px 0 0 0",
  fontSize: "15px",
  color: "#6b7280",
};

const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const userTextStyle = {
  fontSize: "16px",
  color: "#374151",
  fontWeight: "600",
};

const logoutButtonStyle = {
  padding: "10px 18px",
  borderRadius: "12px",
  border: "none",
  backgroundColor: "#ef4444",
  color: "white",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
};

const mainCardStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: "10px",
  fontSize: "28px",
  color: "#1f2937",
};

const sectionDescStyle = {
  marginTop: 0,
  marginBottom: "24px",
  fontSize: "15px",
  color: "#6b7280",
  lineHeight: "1.7",
};

const emptyBoxStyle = {
  background: "#f9fafb",
  border: "1px dashed #d1d5db",
  borderRadius: "18px",
  padding: "28px",
  textAlign: "center",
};

const emptyTextStyle = {
  margin: 0,
  color: "#6b7280",
  fontSize: "15px",
};

const patientGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "20px",
};

const patientCardStyle = {
  background: "#f8fbff",
  border: "1px solid #dbeafe",
  borderRadius: "20px",
  padding: "22px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  minHeight: "220px",
  boxShadow: "0 6px 18px rgba(37, 99, 235, 0.06)",
};

const patientNameStyle = {
  margin: "0 0 14px 0",
  fontSize: "24px",
  color: "#1f2937",
};

const patientInfoStyle = {
  margin: "8px 0",
  fontSize: "15px",
  color: "#4b5563",
  lineHeight: "1.6",
};

const detailButtonStyle = {
  marginTop: "20px",
  padding: "12px 18px",
  borderRadius: "12px",
  border: "none",
  backgroundColor: "#2563eb",
  color: "white",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
};

export default ClinicianDashboard;