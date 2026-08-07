export function calculateAge(birthDate, today = new Date()) {
  if (!birthDate) return "-";

  const birth = new Date(birthDate);
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

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysSince(value, now = Date.now()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatTrendRecordDate(value) {
  if (!value) return "時間未知";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
