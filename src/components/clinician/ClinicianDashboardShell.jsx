const primaryButtonStyle = {
  padding: "10px 16px", borderRadius: "12px", border: "none",
  background: "linear-gradient(135deg, #2f8f70, #22785d)", color: "#fff",
  fontSize: "14px", fontWeight: "900", cursor: "pointer",
};
const secondaryButtonStyle = {
  padding: "10px 16px", borderRadius: "12px", border: "1px solid rgba(43, 108, 176, 0.28)",
  backgroundColor: "#eef7ff", color: "#1f5f8b", fontSize: "14px", fontWeight: "800", cursor: "pointer",
};

export function ClinicianDashboardHeader({ clinicianName, onAddPatient, onRefresh, onLogout }) {
  return (
    <header className="clinician-dashboard-header" style={headerStyle}>
      <div>
        <h1 style={titleStyle}>EF 幼兒認知訓練平台</h1>
        <p style={subtitleStyle}>醫療端｜個案追蹤、風險分級、回診提醒與詳細資料分析</p>
      </div>
      <div className="clinician-dashboard-header-actions" style={headerActionsStyle}>
        <span style={userTextStyle}>您好，{clinicianName || "醫療人員"}</span>
        <button type="button" onClick={onAddPatient} style={primaryButtonStyle}>＋ 新增兒童</button>
        <button type="button" onClick={onRefresh} style={secondaryButtonStyle}>重新整理</button>
        <button type="button" onClick={onLogout} style={logoutButtonStyle}>登出</button>
      </div>
    </header>
  );
}

export function AddPatientModal({ form, error, submitting, onFieldChange, onClose, onSubmit }) {
  return (
    <div style={modalBackdropStyle} role="presentation" onMouseDown={onClose}>
      <form
        style={modalStyle}
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinician-add-patient-title"
      >
        <div style={modalHeaderStyle}>
          <div>
            <h2 id="clinician-add-patient-title" style={modalTitleStyle}>新增兒童資料</h2>
            <p style={modalDescStyle}>孩子會綁定既有家長帳號，並自動授權給目前醫療人員。</p>
          </div>
          <button type="button" aria-label="關閉新增兒童視窗" onClick={onClose} disabled={submitting} style={closeButtonStyle}>×</button>
        </div>

        <label style={labelStyle}>
          家長帳號 Email（必填）
          <input type="email" value={form.guardianEmail} onChange={onFieldChange("guardianEmail")} style={inputStyle} disabled={submitting} />
        </label>
        <div style={twoColumnStyle}>
          <label style={labelStyle}>
            孩子暱稱（必填）
            <input value={form.nickname} onChange={onFieldChange("nickname")} maxLength={12} style={inputStyle} disabled={submitting} />
          </label>
          <label style={labelStyle}>
            孩子姓名（選填）
            <input value={form.fullName} onChange={onFieldChange("fullName")} style={inputStyle} disabled={submitting} />
          </label>
          <label style={labelStyle}>
            出生日期（必填）
            <input type="date" value={form.birthDate} onChange={onFieldChange("birthDate")} max={new Date().toISOString().slice(0, 10)} style={inputStyle} disabled={submitting} />
          </label>
          <label style={labelStyle}>
            性別（必填）
            <select value={form.gender} onChange={onFieldChange("gender")} style={inputStyle} disabled={submitting}>
              <option value="">請選擇</option><option value="male">男</option>
              <option value="female">女</option><option value="undisclosed">暫不透露</option>
            </select>
          </label>
        </div>

        {error && <div role="alert" style={formErrorStyle}>{error}</div>}
        <div style={modalActionsStyle}>
          <button type="button" onClick={onClose} disabled={submitting} style={cancelButtonStyle}>取消</button>
          <button type="submit" disabled={submitting} style={primaryButtonStyle}>{submitting ? "建立中..." : "建立並連結"}</button>
        </div>
      </form>
    </div>
  );
}

export function DashboardLoadError({ message, hasCachedPatients, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" style={loadErrorStyle}>
      <div style={loadErrorTextStyle}>
        <strong>資料更新失敗</strong><span>{message}</span>
        {hasCachedPatients && <small>目前先保留上一次成功載入的資料。</small>}
      </div>
      <button type="button" onClick={onRetry} style={secondaryButtonStyle}>再試一次</button>
    </div>
  );
}

const STAT_ITEMS = [
  ["patientCount", "授權病患", "目前可查看的兒童個案"],
  ["totalTests", "測驗紀錄", "正式測驗資料筆數"],
  ["totalTraining", "訓練紀錄", "訓練歷程資料筆數"],
  ["newRecords", "近 7 天新資料", "待醫療人員查看"],
  ["needFollowUp", "需要處理", "需要提醒或追蹤", true],
];

export function DashboardStats({ stats }) {
  return (
    <section className="clinician-dashboard-stats" style={statsGridStyle}>
      {STAT_ITEMS.map(([key, title, desc, danger]) => (
        <div key={key} style={{ ...statCardStyle, ...(danger ? statCardDangerStyle : {}) }}>
          <p style={statTitleStyle}>{title}</p><h2 style={statValueStyle}>{stats[key]}</h2>
          <p style={statDescStyle}>{desc}</p>
        </div>
      ))}
    </section>
  );
}

// These components own only dashboard chrome. Authentication, Supabase writes,
// and clinical calculations deliberately remain in the page/controller layer.
const headerStyle = { position: "relative", zIndex: 1, background: "linear-gradient(135deg, rgba(255, 253, 244, 0.98), rgba(240, 248, 255, 0.94))", borderRadius: "28px", padding: "22px 28px", boxShadow: "0 18px 44px rgba(51, 65, 85, 0.12)", border: "1px solid rgba(148, 163, 184, 0.26)", borderTop: "5px solid rgba(43, 108, 176, 0.82)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", marginBottom: "18px" };
const titleStyle = { margin: 0, fontSize: "30px", fontWeight: "900", color: "#1f5f8b", letterSpacing: "0.4px" };
const subtitleStyle = { margin: "8px 0 0", fontSize: "15px", color: "#64748b", fontWeight: "700" };
const headerActionsStyle = { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" };
const userTextStyle = { fontSize: "15px", color: "#334155", fontWeight: "700" };
const logoutButtonStyle = { ...primaryButtonStyle, background: "#8b6f61", fontWeight: "800" };
const modalBackdropStyle = { position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: "20px", background: "rgba(30, 41, 59, 0.46)", backdropFilter: "blur(5px)" };
const modalStyle = { width: "min(620px, calc(100vw - 32px))", maxHeight: "calc(100vh - 40px)", overflow: "auto", padding: "24px", border: "1px solid rgba(148, 163, 184, 0.3)", borderRadius: "24px", background: "#fffdf6", boxShadow: "0 28px 70px rgba(15, 23, 42, 0.3)" };
const modalHeaderStyle = { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "20px" };
const modalTitleStyle = { margin: 0, color: "#245b70", fontSize: "24px" };
const modalDescStyle = { margin: "7px 0 0", color: "#64748b", lineHeight: 1.5 };
const closeButtonStyle = { width: "38px", height: "38px", border: 0, borderRadius: "50%", background: "#eef2f7", color: "#475569", fontSize: "24px", cursor: "pointer" };
const twoColumnStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" };
const labelStyle = { display: "grid", gap: "7px", marginBottom: "14px", color: "#475569", fontSize: "14px", fontWeight: "850" };
const inputStyle = { width: "100%", minHeight: "44px", boxSizing: "border-box", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "12px", background: "#fff", color: "#1e293b", fontSize: "15px" };
const formErrorStyle = { marginTop: "4px", padding: "10px 12px", borderRadius: "12px", background: "#fff1f2", color: "#a12b3a", fontWeight: "800" };
const modalActionsStyle = { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" };
const cancelButtonStyle = { ...secondaryButtonStyle, borderColor: "#cbd5e1", background: "#fff", color: "#475569" };
const loadErrorStyle = { position: "relative", zIndex: 2, marginBottom: "16px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", border: "1px solid #f4a6a6", borderRadius: "16px", background: "rgba(255, 241, 241, 0.97)", color: "#8f2929", boxShadow: "0 10px 22px rgba(127, 29, 29, 0.08)" };
const loadErrorTextStyle = { display: "grid", gap: "3px" };
const statsGridStyle = { position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "repeat(5, minmax(150px, 1fr))", gap: "14px", marginBottom: "18px" };
const statCardStyle = { background: "rgba(255, 253, 244, 0.96)", borderRadius: "22px", padding: "16px 18px", boxShadow: "0 14px 30px rgba(51, 65, 85, 0.10)", border: "1px solid rgba(148, 163, 184, 0.22)", borderLeft: "5px solid rgba(43, 108, 176, 0.42)" };
const statCardDangerStyle = { border: "1px solid #fecaca", borderLeft: "5px solid #ef4444", background: "#fff8f8" };
const statTitleStyle = { margin: 0, color: "#64748b", fontSize: "14px", fontWeight: "800" };
const statValueStyle = { margin: "8px 0 4px", color: "#1f5f8b", fontSize: "30px" };
const statDescStyle = { margin: 0, color: "#7c5b2a", fontSize: "13px" };
