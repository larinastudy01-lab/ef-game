import { formatDateTime } from "./professionalFormatters";
export function calculateAge(birthDate, today = new Date()) {
  if (!birthDate) return "未記錄";

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(today.getTime()) || birth > today) return "未記錄";
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }

  return `${years} 歲 ${months} 個月`;
}

export function formatGender(gender) {
  if (!gender) return "未填寫";
  if (gender === "male") return "男";
  if (gender === "female") return "女";
  return gender;
}

export function formatDate(value, includeSeconds = false) {
  return formatDateTime(value, { seconds: includeSeconds });
}

export function daysSince(value, now = Date.now()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatTrendRecordDate(value) { return formatDateTime(value); }
