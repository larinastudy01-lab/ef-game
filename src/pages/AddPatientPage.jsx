import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import homeBackground from "../asset/Home_background.png";

import bearAvatar from "../asset/avatar/bear.png";
import chickenAvatar from "../asset/avatar/chicken.png";
import deerAvatar from "../asset/avatar/deer.png";
import foxAvatar from "../asset/avatar/fox.png";
import meerkatsAvatar from "../asset/avatar/meerkats.png";
import peacockAvatar from "../asset/avatar/peacock.png";
import rabbitAvatar from "../asset/avatar/rabbit.png";
import sheepAvatar from "../asset/avatar/sheep.png";

const avatarOptions = [
  { key: "bear", label: "小熊", fileName: "bear.png", image: bearAvatar },
  { key: "chicken", label: "小雞", fileName: "chicken.png", image: chickenAvatar },
  { key: "deer", label: "小鹿", fileName: "deer.png", image: deerAvatar },
  { key: "fox", label: "狐狸", fileName: "fox.png", image: foxAvatar },
  { key: "meerkats", label: "狐獴", fileName: "meerkats.png", image: meerkatsAvatar },
  { key: "peacock", label: "孔雀", fileName: "peacock.png", image: peacockAvatar },
  { key: "rabbit", label: "小兔", fileName: "rabbit.png", image: rabbitAvatar },
  { key: "sheep", label: "綿羊", fileName: "sheep.png", image: sheepAvatar },
];

const genderOptions = [
  { value: "", label: "請選擇性別" },
  { value: "男", label: "男" },
  { value: "女", label: "女" },
  { value: "不透露", label: "暫不透露" },
];


const MIN_PATIENT_AGE = 2;
const MAX_PATIENT_AGE = 18;

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseLocalDateOnly = (dateValue) => {
  if (!dateValue) return null;

  const [yearText, monthText, dayText] = dateValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
};

const getTodayDateOnly = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
};

const calculateAge = (birthDateValue) => {
  const birth = parseLocalDateOnly(birthDateValue);
  if (!birth) return null;

  const today = getTodayDateOnly();

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, birth, today };
};

const isValidAvatarKey = (key) => avatarOptions.some((item) => item.key === key);

const getSupabaseErrorMessage = (error) => {
  if (!error) return "新增失敗，請稍後再試。";

  const message = error.message || "";

  if (message.includes("avatar")) {
    return "新增失敗：patients table 可能還沒有 avatar 欄位，請先在 Supabase 新增 avatar 欄位。";
  }

  if (message.includes("birth_date")) {
    return "新增失敗：生日欄位無法寫入，請確認 patients table 有 birth_date 欄位。";
  }

  if (message.includes("clinician_id")) {
    return "新增失敗：無法綁定醫療端帳號，請確認 patients table 有 clinician_id 欄位。";
  }

  if (message.includes("age")) {
    return "新增失敗：年齡欄位無法寫入，請確認 patients table 的 age 欄位為數字型態。";
  }

  if (message.includes("permission") || message.includes("row-level security") || message.includes("RLS")) {
    return "新增失敗：目前沒有新增權限，請確認 Supabase patients table 的 RLS 政策。";
  }

  return `新增失敗：${message}`;
};

function AddPatientPage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [avatarKey, setAvatarKey] = useState("bear");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const todayMaxBirthday = useMemo(() => getLocalDateString(), []);

  const selectedAvatar = useMemo(
    () => avatarOptions.find((item) => item.key === avatarKey) || avatarOptions[0],
    [avatarKey]
  );

  const agePreview = useMemo(() => {
    if (!birthDate) return "選擇生日後，系統會自動計算年齡，未來可用於常模比較。";

    const ageInfo = calculateAge(birthDate);
    if (!ageInfo) return "生日格式不正確。";
    if (ageInfo.years < 0) return "生日不能是未來日期。";
    if (ageInfo.years < MIN_PATIENT_AGE || ageInfo.years > MAX_PATIENT_AGE) {
      return `目前約 ${ageInfo.years} 歲 ${ageInfo.months} 個月。建議建檔年齡範圍為 ${MIN_PATIENT_AGE}-${MAX_PATIENT_AGE} 歲。`;
    }

    return `目前約 ${ageInfo.years} 歲 ${ageInfo.months} 個月，之後可用於年齡分組與常模比較。`;
  }, [birthDate]);

  const validateForm = () => {
    const cleanNickname = nickname.trim();
    const ageInfo = calculateAge(birthDate);

    if (!cleanNickname) return "請輸入孩子暱稱。";
    if (cleanNickname.length > 12) return "暱稱請控制在 12 個字以內。";
    if (!birthDate) return "請選擇孩子生日。";
    if (!ageInfo) return "生日格式不正確，請重新選擇。";
    if (ageInfo.birth > ageInfo.today) return "生日不能是未來日期。";
    if (!Number.isInteger(ageInfo.years)) return "年齡資料異常，請重新選擇生日。";
    if (ageInfo.years < MIN_PATIENT_AGE || ageInfo.years > MAX_PATIENT_AGE) {
      return `建檔年齡需介於 ${MIN_PATIENT_AGE}-${MAX_PATIENT_AGE} 歲，請確認生日是否正確。`;
    }
    if (!gender) return "請選擇性別；若不想提供，可選擇「暫不透露」。";
    if (!isValidAvatarKey(avatarKey)) return "頭像資料異常，請重新選擇一個孩子頭像。";

    return "";
  };

  const handleAddPatient = async (event) => {
    event.preventDefault();

    if (submitLockRef.current || isSubmitting) return;

    setFormError("");
    setSuccessMessage("");

    const errorText = validateForm();
    if (errorText) {
      setFormError(errorText);
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const {
        data: { user } = {},
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        setFormError("請先登入醫療端帳號，再新增孩子資料。");
        navigate("/login", { replace: true });
        return;
      }

      const ageInfo = calculateAge(birthDate);
      if (!ageInfo || !Number.isInteger(ageInfo.years) || ageInfo.years < MIN_PATIENT_AGE || ageInfo.years > MAX_PATIENT_AGE) {
        setFormError(`年齡需介於 ${MIN_PATIENT_AGE}-${MAX_PATIENT_AGE} 歲，請重新確認生日。`);
        return;
      }

      const payload = {
        clinician_id: user.id,
        nickname: nickname.trim(),
        birth_date: birthDate,
        age: ageInfo.years,
        gender,
        avatar: selectedAvatar.key,
      };

      const { error } = await supabase.from("patients").insert([payload]);

      if (error) {
        setFormError(getSupabaseErrorMessage(error));
        return;
      }

      setSuccessMessage("孩子資料新增成功，正在前往孩子選擇頁。完成後即可開始測驗或訓練。");

      setTimeout(() => {
        navigate("/child-select", { replace: true });
      }, 650);
    } catch (error) {
      setFormError(getSupabaseErrorMessage(error));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-patient-page" style={pageStyle}>
      <style>{responsiveStyle}</style>
      <main className="add-patient-shell" style={shellStyle}>
        <section className="add-patient-panel" style={introPanelStyle}>
          <button type="button" onClick={() => navigate(-1)} disabled={isSubmitting} style={isSubmitting ? secondaryButtonDisabledStyle : backButtonStyle}>
            ← 返回
          </button>

          <div style={avatarPreviewWrapStyle} aria-hidden="true">
            <img src={selectedAvatar.image} alt="" style={avatarPreviewStyle} />
          </div>

          <p style={eyebrowStyle}>家長端｜新增兒童</p>
          <h1 style={titleStyle}>建立孩子的小小檔案</h1>
          <p style={descStyle}>
            只需要填寫暱稱、生日、性別與頭像。平台不會要求身分證、地址或其他不必要的敏感資料。
          </p>

          <div style={privacyBoxStyle}>
            <strong>資料保護提醒</strong>
            <span>孩子資料僅供家長與授權醫療端查看，後續測驗與訓練紀錄也會綁定此孩子檔案。</span>
          </div>
        </section>

        <section className="add-patient-panel" style={formCardStyle}>
          <div className="add-patient-form-header" style={formHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>新增孩子資料</h2>
              <p style={sectionDescStyle}>生日會用於計算年齡，未來可支援常模比較與醫療端追蹤。</p>
            </div>
            <button type="button" onClick={() => navigate("/dashboard")} disabled={isSubmitting} style={isSubmitting ? secondaryButtonDisabledStyle : secondaryButtonStyle}>
              稍後再新增
            </button>
          </div>

          <form onSubmit={handleAddPatient} noValidate>
            <label style={labelStyle} htmlFor="nickname">
              孩子暱稱 <span style={requiredStyle}>必填</span>
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              disabled={isSubmitting}
              placeholder="例如：Honey、小太陽"
              maxLength={12}
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="birthDate">
              生日 <span style={requiredStyle}>必填</span>
            </label>
            <input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              disabled={isSubmitting}
              max={todayMaxBirthday}
              style={inputStyle}
            />
            <p style={helperTextStyle}>{agePreview}</p>

            <label style={labelStyle} htmlFor="gender">
              性別 <span style={requiredStyle}>必填</span>
            </label>
            <select id="gender" value={gender} onChange={(event) => setGender(event.target.value)} disabled={isSubmitting} style={inputStyle}>
              {genderOptions.map((option) => (
                <option key={option.label} value={option.value} disabled={!option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label style={labelStyle}>
              選擇頭像 <span style={requiredStyle}>必填</span>
            </label>
            <div className="add-patient-avatar-grid" style={avatarGridStyle}>
              {avatarOptions.map((option) => {
                const isSelected = avatarKey === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAvatarKey(option.key)}
                    disabled={isSubmitting}
                    style={isSelected ? avatarButtonActiveStyle : avatarButtonStyle}
                    aria-pressed={isSelected}
                  >
                    <img src={option.image} alt={option.label} style={avatarImageStyle} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>

            {formError && <div style={errorBoxStyle}>{formError}</div>}
            {successMessage && <div style={successBoxStyle}>{successMessage}</div>}

            <button type="submit" disabled={isSubmitting} style={isSubmitting ? primaryButtonDisabledStyle : primaryButtonStyle}>
              {isSubmitting ? "新增中..." : "新增孩子並儲存"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

const responsiveStyle = `
  .add-patient-page,
  .add-patient-page *,
  .add-patient-page *::before,
  .add-patient-page *::after {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  @media (max-width: 1023px) {
    .add-patient-shell {
      grid-template-columns: 1fr !important;
      align-items: stretch !important;
      min-height: auto !important;
    }

    .add-patient-panel {
      padding: 24px !important;
    }
  }

  @media (max-width: 720px) {
    .add-patient-page {
      padding: 16px !important;
      background-attachment: scroll !important;
    }

    .add-patient-shell {
      gap: 18px !important;
    }

    .add-patient-form-header {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .add-patient-panel {
      border-radius: 26px !important;
      padding: 20px !important;
    }
  }
`;

const pageStyle = {
  minHeight: "100vh",
  backgroundImage: `linear-gradient(90deg, rgba(255, 246, 224, 0.82), rgba(255, 246, 224, 0.48)), url(${homeBackground})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
  padding: "28px",
  boxSizing: "border-box",
  fontFamily: "Arial, 'Noto Sans TC', sans-serif",
};

const shellStyle = {
  width: "min(1120px, 100%)",
  minHeight: "calc(100vh - 56px)",
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "0.88fr 1.12fr",
  gap: "26px",
  alignItems: "center",
};

const introPanelStyle = {
  background: "rgba(255, 255, 248, 0.92)",
  border: "4px solid rgba(255, 218, 99, 0.72)",
  borderRadius: "34px",
  padding: "30px",
  boxShadow: "0 18px 42px rgba(74, 51, 20, 0.16)",
  backdropFilter: "blur(8px)",
};

const formCardStyle = {
  background: "rgba(255, 255, 248, 0.95)",
  border: "4px solid rgba(255, 220, 113, 0.68)",
  borderRadius: "34px",
  padding: "30px",
  boxShadow: "0 18px 42px rgba(74, 51, 20, 0.16)",
  backdropFilter: "blur(8px)",
};

const backButtonStyle = {
  border: "2px solid rgba(139, 108, 60, 0.18)",
  background: "rgba(255,255,255,0.78)",
  color: "#5c4328",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: "900",
  cursor: "pointer",
  touchAction: "manipulation",
  marginBottom: "24px",
};

const avatarPreviewWrapStyle = {
  width: "128px",
  height: "128px",
  borderRadius: "38px",
  background: "linear-gradient(180deg, #fff7c2, #ffd75f)",
  border: "5px solid #ffffff",
  boxShadow: "0 12px 26px rgba(74, 51, 20, 0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "20px",
  overflow: "hidden",
};

const avatarPreviewStyle = {
  width: "112px",
  height: "112px",
  objectFit: "contain",
};

const eyebrowStyle = {
  margin: "0 0 8px",
  color: "#b45309",
  fontSize: "15px",
  fontWeight: "900",
};

const titleStyle = {
  margin: "0 0 14px",
  color: "#2f2418",
  fontSize: "38px",
  lineHeight: "1.2",
  fontWeight: "900",
};

const descStyle = {
  margin: 0,
  color: "#6f5b43",
  fontSize: "16px",
  lineHeight: "1.8",
  fontWeight: "700",
};

const privacyBoxStyle = {
  marginTop: "24px",
  background: "linear-gradient(180deg, rgba(255, 248, 217, 0.96), rgba(255, 236, 178, 0.86))",
  border: "3px solid rgba(255, 212, 88, 0.7)",
  borderRadius: "24px",
  padding: "18px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  color: "#7c3f08",
  lineHeight: "1.7",
  fontWeight: "700",
};

const formHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "12px",
};

const sectionTitleStyle = {
  margin: "0 0 8px",
  color: "#2f2418",
  fontSize: "30px",
  fontWeight: "900",
};

const sectionDescStyle = {
  margin: 0,
  color: "#7b6a55",
  fontSize: "15px",
  lineHeight: "1.7",
  fontWeight: "600",
};

const secondaryButtonStyle = {
  flexShrink: 0,
  border: "2px solid rgba(245, 158, 11, 0.32)",
  background: "rgba(255,255,255,0.82)",
  color: "#92400e",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: "900",
  cursor: "pointer",
  touchAction: "manipulation",
};

const secondaryButtonDisabledStyle = {
  ...secondaryButtonStyle,
  cursor: "not-allowed",
  opacity: 0.58,
};

const labelStyle = {
  display: "block",
  margin: "18px 0 8px",
  color: "#3f3020",
  fontSize: "15px",
  fontWeight: "900",
};

const requiredStyle = {
  color: "#dc2626",
  fontSize: "12px",
  marginLeft: "4px",
};

const inputStyle = {
  width: "100%",
  padding: "15px 18px",
  borderRadius: "18px",
  border: "2px solid rgba(244, 190, 80, 0.45)",
  fontSize: "16px",
  boxSizing: "border-box",
  backgroundColor: "rgba(255,255,255,0.9)",
  color: "#3f3020",
  outline: "none",
  boxShadow: "inset 0 2px 8px rgba(74, 51, 20, 0.04)",
  touchAction: "manipulation",
};

const helperTextStyle = {
  margin: "8px 0 0",
  color: "#7b6a55",
  fontSize: "13px",
  lineHeight: "1.6",
  fontWeight: "700",
};

const avatarGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
  gap: "12px",
};

const avatarButtonStyle = {
  border: "2px solid rgba(244, 190, 80, 0.36)",
  borderRadius: "22px",
  background: "rgba(255,255,255,0.82)",
  color: "#5c4328",
  padding: "10px 8px",
  minHeight: "104px",
  fontWeight: "900",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  touchAction: "manipulation",
};

const avatarButtonActiveStyle = {
  ...avatarButtonStyle,
  background: "linear-gradient(180deg, #fff7c2, #ffd75f)",
  border: "3px solid rgba(245, 158, 11, 0.75)",
  boxShadow: "0 8px 18px rgba(245, 158, 11, 0.22)",
};

const avatarImageStyle = {
  width: "62px",
  height: "62px",
  objectFit: "contain",
  borderRadius: "999px",
};

const errorBoxStyle = {
  marginTop: "18px",
  background: "#fef2f2",
  border: "2px solid #fecaca",
  color: "#b91c1c",
  borderRadius: "16px",
  padding: "13px 15px",
  lineHeight: "1.6",
  fontWeight: "800",
};

const successBoxStyle = {
  marginTop: "18px",
  background: "#ecfdf5",
  border: "2px solid #bbf7d0",
  color: "#047857",
  borderRadius: "16px",
  padding: "13px 15px",
  lineHeight: "1.6",
  fontWeight: "800",
};

const primaryButtonStyle = {
  width: "100%",
  padding: "16px",
  borderRadius: "20px",
  border: "3px solid rgba(255,255,255,0.9)",
  background: "linear-gradient(180deg, #ffc53d, #f59e0b)",
  color: "white",
  fontSize: "17px",
  fontWeight: "900",
  cursor: "pointer",
  marginTop: "20px",
  boxShadow: "0 8px 0 rgba(177, 111, 12, 0.22), 0 14px 24px rgba(245,158,11,0.25)",
  touchAction: "manipulation",
};

const primaryButtonDisabledStyle = {
  ...primaryButtonStyle,
  cursor: "not-allowed",
  opacity: 0.65,
};

export default AddPatientPage;
