import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ChildSelectPage.css";
import PageBackground from "../asset/home/choice_ch.webp";
import CardFrame from "../asset/home/card.webp";
import StartButton from "../asset/home/start.webp";
import BuildStartButton from "../asset/home/bu_start.webp";
import DeleteButton from "../asset/home/delete.webp";
import ReturnButton from "../asset/return.webp";
import { getMyPatients, createMyPatient, deleteMyPatient } from "../lib/database";
import AddButton from "../asset/home/add.webp";
import BearAvatar from "../asset/avatar/bear.webp";
import ChickenAvatar from "../asset/avatar/chicken.webp";
import DeerAvatar from "../asset/avatar/deer.webp";
import FoxAvatar from "../asset/avatar/fox.webp";
import MeerkatsAvatar from "../asset/avatar/meerkats.webp";
import PeacockAvatar from "../asset/avatar/peacock.webp";
import RabbitAvatar from "../asset/avatar/rabbit.webp";
import SheepAvatar from "../asset/avatar/sheep.webp";
import { setActivePatient } from "../utils/activePatientStorage";

/**
 * ChildSelectPage.jsx
 *
 * 兒童角色卡選擇頁
 * - 使用 choice_ch.webp 純森林背景，避免背景內建大卡片與標題造成疊字
 * - 前景重新建立主卡片、標題、兒童數量與角色卡
 * - 兒童角色卡固定橫式排列，超過寬度時使用橫向滑桿
 * - 新增表單使用 asset/avatar 動物頭像
 * - 建立並開始按鈕使用 asset/home/bu_start.webp
 */

const STORAGE_KEYS = {
  children: "childrenProfiles",
  patients: "patients",
  currentChild: "currentChild",
  currentChildId: "currentChildId",
};

const CHILD_GAME_CACHE_PREFIX = "childGameCache";

const MAX_CHILD_AGE = 18;

const GAME_CACHE_KEY_PATTERNS = [
  /^current(Game|Test|Training|Trial|Level|Question)/i,
  /^selected(Game|Mode|Level|Difficulty)/i,
  /^active(Game|Test|Training|Trial)/i,
  /^last(Game|Test|Training|Trial)/i,
  /^pending(Game|Test|Training|Trial)/i,
  /^temp(Game|Test|Training|Trial)/i,
  /^practice(Game|Test|Training|Trial)/i,
  /^test(Game|Training)?(Session|State|Cache|Draft|Progress|Answers|History|Result)/i,
  /^training(Game)?(Session|State|Cache|Draft|Progress|Answers|History|Result)/i,
  /^ef_game_.*(completed|stars|stage|level|training|honey|today)/i,
  /^ef_(latest_results|ai_recommendation|current_test_flow)/i,
  /completed_training_levels/i,
  /training.*level.*(completed|stars)/i,
  /honey_mission|today_training|training_duration/i,
  /^(SRT|PM|CBT|SSG|DCCS|LB)[_-].*(session|state|cache|draft|progress|answers|history|current|temp|trial|round|pending|result)$/i,
  /^(srt|pm|cbt|ssg|dccs|lb)[_-].*(session|state|cache|draft|progress|answers|history|current|temp|trial|round|pending|result)$/i,
  /^(SRT|PM|CBT|SSG|DCCS|LB|srt|pm|cbt|ssg|dccs|lb).*level.*(completed|stars)$/i,
  /(session|state|cache|draft|progress|answers|history|current|temp|trial|round|pending|result)[_-]?(SRT|PM|CBT|SSG|DCCS|LB)$/i,
  /(session|state|cache|draft|progress|answers|history|current|temp|trial|round|pending|result)[_-]?(srt|pm|cbt|ssg|dccs|lb)$/i,
];

const PRESERVED_CACHE_KEY_PATTERNS = [
  /settings?$/i,
  /profiles?$/i,
  /patients?$/i,
  /children/i,
  /currentChild/i,
  /parentPin/i,
  /volume/i,
  /music/i,
  /sound/i,
];

const AVATAR_OPTIONS = [
  { key: "fox", label: "狐狸", src: FoxAvatar, legacy: "🦊" },
  { key: "bear", label: "小熊", src: BearAvatar, legacy: "🐻" },
  { key: "chicken", label: "小雞", src: ChickenAvatar, legacy: "🐤" },
  { key: "deer", label: "小鹿", src: DeerAvatar, legacy: "🦌" },
  { key: "rabbit", label: "兔子", src: RabbitAvatar, legacy: "🐰" },
  { key: "peacock", label: "孔雀", src: PeacockAvatar, legacy: "🦚" },
  { key: "sheep", label: "綿羊", src: SheepAvatar, legacy: "🐑" },
  { key: "meerkats", label: "狐獴", src: MeerkatsAvatar, legacy: "🐿️" },
];

const DEFAULT_CHILDREN = [];

const legacyAvatarMap = AVATAR_OPTIONS.reduce((map, avatar) => {
  map[avatar.legacy] = avatar.key;
  return map;
}, {});
legacyAvatarMap["🐼"] = "meerkats";

const safeParse = (value, fallback = null) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const formatDateForInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalDateParts = (value) => {
  if (!value) return null;

  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const localDate = new Date(year, month - 1, day);
  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day, localDate };
};

const getAgeFromLocalDate = (value, now = new Date()) => {
  const birthday = parseLocalDateParts(value);
  if (!birthday) return "";

  let age = now.getFullYear() - birthday.year;
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  if (currentMonth < birthday.month || (currentMonth === birthday.month && currentDay < birthday.day)) {
    age -= 1;
  }

  return age >= 0 ? age : "";
};

const getBirthdayLimits = () => {
  const today = new Date();
  const oldestAllowed = new Date(today);
  oldestAllowed.setFullYear(today.getFullYear() - MAX_CHILD_AGE);

  return {
    min: formatDateForInput(oldestAllowed),
    max: formatDateForInput(today),
  };
};

const isBirthdayAllowed = (birthdayValue) => {
  const birthday = parseLocalDateParts(birthdayValue);
  if (!birthday) return false;

  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birthday.localDate > todayOnly) return false;

  const age = getAgeFromLocalDate(birthdayValue, today);
  return age !== "" && age >= 0 && age <= MAX_CHILD_AGE;
};

const shouldClearGameCacheKey = (key, storageType = "session") => {
  if (!key) return false;
  if (key === STORAGE_KEYS.children || key === STORAGE_KEYS.patients) return false;
  if (storageType === "local" && PRESERVED_CACHE_KEY_PATTERNS.some((pattern) => pattern.test(key))) return false;
  return GAME_CACHE_KEY_PATTERNS.some((pattern) => pattern.test(key));
};

const clearStorageKeys = (storage, storageType) => {
  if (!storage) return;

  const keysToRemove = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (shouldClearGameCacheKey(key, storageType)) keysToRemove.push(key);
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
};

const clearGameplayCacheForChildSwitch = () => {
  clearStorageKeys(sessionStorage, "session");
  clearStorageKeys(localStorage, "local");
};

const getChildGameCacheKey = (childId) => `${CHILD_GAME_CACHE_PREFIX}_${childId}`;

const snapshotGameplayCacheForChild = (childId) => {
  if (!childId) return;

  const cache = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (shouldClearGameCacheKey(key, "local")) {
      cache[key] = localStorage.getItem(key);
    }
  }

  localStorage.setItem(getChildGameCacheKey(childId), JSON.stringify(cache));
};

const restoreGameplayCacheForChild = (childId) => {
  if (!childId) return;

  const cache = safeParse(localStorage.getItem(getChildGameCacheKey(childId)), {});
  if (!cache || typeof cache !== "object" || Array.isArray(cache)) return;

  Object.entries(cache).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      localStorage.setItem(key, value);
    }
  });
};

const createChildId = () => `child_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const avatarFileToKey = (value) => {
  if (!value) return "";
  const text = String(value);
  if (text.startsWith("http") || text.startsWith("data:")) return "";
  return text.replace(/\.webp$/i, "").replace(/\.jpg$/i, "").replace(/\.jpeg$/i, "");
};

const normalizeAvatarKey = (value, index = 0) => {
  if (!value) return AVATAR_OPTIONS[index % AVATAR_OPTIONS.length].key;
  if (AVATAR_OPTIONS.some((avatar) => avatar.key === value)) return value;
  return legacyAvatarMap[value] || AVATAR_OPTIONS[index % AVATAR_OPTIONS.length].key;
};

const getAvatarOption = (key) => AVATAR_OPTIONS.find((avatar) => avatar.key === key) || AVATAR_OPTIONS[0];

const calculateAge = (child) => {
  if (child.age) return Number(child.age);
  const rawBirthday = child.birthday || child.birthDate || child.birth_date || child.dob;
  if (!rawBirthday) return "";

  return getAgeFromLocalDate(rawBirthday);
};

const getLastPlayedAt = (child) => {
  const records = [
    ...(Array.isArray(child.testRecords) ? child.testRecords : []),
    ...(Array.isArray(child.trainingRecords) ? child.trainingRecords : []),
    ...(Array.isArray(child.results) ? child.results : []),
  ];

  const recordTimes = records
    .map((record) => record.playedAt || record.completedAt || record.createdAt || record.updatedAt)
    .filter(Boolean)
    .map((time) => new Date(time).getTime())
    .filter((time) => !Number.isNaN(time));

  if (recordTimes.length > 0) return new Date(Math.max(...recordTimes)).toISOString();
  return child.lastPlayedAt || child.last_played_at || child.updatedAt || child.updated_at || child.created_at || "";
};

const getTodayStatus = (child) => {
  const today = new Date().toDateString();
  const records = [
    ...(Array.isArray(child.testRecords) ? child.testRecords : []),
    ...(Array.isArray(child.trainingRecords) ? child.trainingRecords : []),
  ];

  const hasRecordToday = records.some((record) => {
    const time = record.playedAt || record.completedAt || record.createdAt;
    return time && new Date(time).toDateString() === today;
  });

  return hasRecordToday ? "今日已開始" : "今日尚未開始";
};

const formatLastPlayed = (value) => {
  if (!value) return "尚未遊玩";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未遊玩";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const normalizeChild = (child, index = 0) => {
  const childId = child.childId || child.id || child.patientId || createChildId();
  const nickname = child.nickname || child.name || child.displayName || `小冒險家 ${index + 1}`;
  const age = calculateAge(child);
  const avatarIcon = normalizeAvatarKey(
    child.avatarIcon ||
      child.avatarKey ||
      child.avatarName ||
      avatarFileToKey(child.avatar) ||
      avatarFileToKey(child.avatar_url),
    index
  );

  const rawAvatar = child.avatar || child.avatarUrl || child.avatar_url || "";
  const avatarImageUrl = String(rawAvatar).startsWith("http") || String(rawAvatar).startsWith("data:") ? rawAvatar : "";

  return {
    ...child,
    childId,
    id: child.id || childId,
    nickname,
    name: nickname,
    birthday: child.birthday || child.birthDate || child.birth_date || "",
    birthDate: child.birthDate || child.birth_date || child.birthday || "",
    age,
    avatar: avatarImageUrl,
    avatarIcon,
    avatarKey: avatarIcon,
    lastPlayedAt: getLastPlayedAt(child),
    testRecords: Array.isArray(child.testRecords) ? child.testRecords : [],
    trainingRecords: Array.isArray(child.trainingRecords) ? child.trainingRecords : [],
  };
};

const getInitialChildren = () => {
  const childrenProfiles = safeParse(localStorage.getItem(STORAGE_KEYS.children), []);
  const patients = safeParse(localStorage.getItem(STORAGE_KEYS.patients), []);
  const source = Array.isArray(childrenProfiles) && childrenProfiles.length > 0 ? childrenProfiles : patients;

  if (!Array.isArray(source) || source.length === 0) {
    localStorage.setItem(STORAGE_KEYS.children, JSON.stringify(DEFAULT_CHILDREN));
    return DEFAULT_CHILDREN;
  }

  const normalized = source.map(normalizeChild);
  localStorage.setItem(STORAGE_KEYS.children, JSON.stringify(normalized));
  return normalized;
};

const mergeCloudPatientsWithLocalCache = (cloudPatients = []) => {
  const localChildren = safeParse(localStorage.getItem(STORAGE_KEYS.children), []);
  const normalizedCloud = Array.isArray(cloudPatients) ? cloudPatients.map(normalizeChild) : [];
  const normalizedLocal = Array.isArray(localChildren) ? localChildren.map(normalizeChild) : [];

  const cloudIds = new Set(normalizedCloud.map((child) => child.childId));
  const localOnlyChildren = normalizedLocal.filter(
    (child) => child.syncStatus === "local-only" && !cloudIds.has(child.childId)
  );

  return [...localOnlyChildren, ...normalizedCloud];
};

const ChildSelectPage = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState(getInitialChildren);
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({
    nickname: "",
    birthday: "",
    gender: "",
    avatarIcon: "fox",
  });

  const currentChildId = localStorage.getItem(STORAGE_KEYS.currentChildId);
  const birthdayLimits = getBirthdayLimits();

  const saveChildren = (nextChildren) => {
    const normalized = nextChildren.map(normalizeChild);
    setChildren(normalized);
    localStorage.setItem(STORAGE_KEYS.children, JSON.stringify(normalized));
  };

  useEffect(() => {
    let ignore = false;

    const loadCloudPatients = async () => {
      setIsSyncing(true);
      try {
        const cloudPatients = await getMyPatients();
        if (ignore) return;

        const merged = mergeCloudPatientsWithLocalCache(cloudPatients);
        setChildren(merged);
        localStorage.setItem(STORAGE_KEYS.children, JSON.stringify(merged));
      } catch (error) {
        console.warn("Supabase 兒童資料讀取失敗，改用本機快取：", error);
      } finally {
        if (!ignore) setIsSyncing(false);
      }
    };

    loadCloudPatients();

    return () => {
      ignore = true;
    };
  }, []);

  const saveCurrentChild = (child) => {
    return setActivePatient(child);
  };

  const selectChild = (child) => {
    if (isSyncing) return;

    const previousChildId = localStorage.getItem(STORAGE_KEYS.currentChildId);
    const childToSave = { ...child, selectedAt: new Date().toISOString() };

    if (previousChildId && previousChildId !== child.childId) {
      snapshotGameplayCacheForChild(previousChildId);
      clearGameplayCacheForChildSwitch();
    }

    saveCurrentChild(childToSave);
    restoreGameplayCacheForChild(child.childId);
    navigate("/mode-select", {
      state: {
        childId: child.childId,
        currentChildId: child.childId,
        child: childToSave,
      },
    });
  };

  const openAddChildModal = () => {
    setErrorMessage("");
    setIsAdding(true);
  };

  const handleAddChild = async (event) => {
    event.preventDefault();
    const nickname = formData.nickname.trim();

    if (!nickname) {
      setErrorMessage("請先輸入兒童暱稱");
      return;
    }

    if (!formData.birthday) {
      setErrorMessage("請選擇兒童生日，方便系統計算年齡");
      return;
    }

    if (!formData.gender) {
      setErrorMessage("請選擇兒童性別，方便後續常模與資料欄位一致");
      return;
    }

    if (!isBirthdayAllowed(formData.birthday)) {
      setErrorMessage(`生日不可晚於今天，且兒童年齡不可大於 ${MAX_CHILD_AGE} 歲`);
      return;
    }

    const avatarIcon = normalizeAvatarKey(formData.avatarIcon, children.length);
    setIsSyncing(true);
    setErrorMessage("");

    try {
      const cloudPatient = await createMyPatient({
        nickname,
        birthDate: formData.birthday,
        gender: formData.gender,
        avatar: `${avatarIcon}.webp`,
      });

      const newChild = normalizeChild(cloudPatient, children.length);
      const nextChildren = [newChild, ...children.filter((item) => item.childId !== newChild.childId)];

      saveChildren(nextChildren);
      saveCurrentChild(newChild);
      setFormData({ nickname: "", birthday: "", gender: "", avatarIcon: "fox" });
      setIsAdding(false);
      navigate("/mode-select", {
        state: {
          childId: newChild.childId,
          currentChildId: newChild.childId,
          child: newChild,
        },
      });
    } catch (error) {
      console.warn("Supabase 新增兒童失敗，改存本機資料：", error);

      const localChild = normalizeChild(
        {
          childId: createChildId(),
          nickname,
          name: nickname,
          birthday: formData.birthday,
          gender: formData.gender,
          avatarIcon,
          avatarKey: avatarIcon,
          lastPlayedAt: "",
          testRecords: [],
          trainingRecords: [],
          aiTrainingProfile: {},
          fatigueProfile: {},
          growthBadges: [],
          createdAt: new Date().toISOString(),
          syncStatus: "local-only",
        },
        children.length
      );

      const nextChildren = [...children, localChild];
      saveChildren(nextChildren);
      saveCurrentChild(localChild);
      setFormData({ nickname: "", birthday: "", gender: "", avatarIcon: "fox" });
      setIsAdding(false);
      setErrorMessage("目前雲端連線失敗，已先暫存在本機。請確認 Supabase 設定後再重新登入同步。");
      navigate("/mode-select", {
        state: {
          childId: localChild.childId,
          currentChildId: localChild.childId,
          child: localChild,
        },
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const removeChild = async (event, childId) => {
    event.stopPropagation();

    if (isSyncing) return;

    const childToRemove = children.find((item) => item.childId === childId);
    if (!childToRemove) return;

    const previousChildren = children;
    const wasCurrentChild = localStorage.getItem(STORAGE_KEYS.currentChildId) === childId;
    const previousCurrentChild = localStorage.getItem(STORAGE_KEYS.currentChild);
    const nextChildren = children.filter((item) => item.childId !== childId);

    setIsSyncing(true);
    setErrorMessage("");

    try {
      if (!childToRemove?.syncStatus && childToRemove?.id && !String(childToRemove.id).startsWith("child_")) {
        await deleteMyPatient(childToRemove.id);
      }

      saveChildren(nextChildren);

      if (wasCurrentChild) {
        snapshotGameplayCacheForChild(childId);
        localStorage.removeItem(STORAGE_KEYS.currentChildId);
        localStorage.removeItem(STORAGE_KEYS.currentChild);
        localStorage.removeItem("selectedChildId");
        localStorage.removeItem("childId");
        localStorage.removeItem("selectedPatientId");
        localStorage.removeItem("currentPatientId");
        localStorage.removeItem("selectedChild");
        localStorage.removeItem("activeChild");
        localStorage.removeItem("selectedPatient");
        localStorage.removeItem("currentPatient");
        sessionStorage.removeItem(STORAGE_KEYS.currentChildId);
        sessionStorage.removeItem(STORAGE_KEYS.currentChild);
        sessionStorage.removeItem("selectedChildId");
        sessionStorage.removeItem("childId");
        sessionStorage.removeItem("selectedPatientId");
        sessionStorage.removeItem("currentPatientId");
        sessionStorage.removeItem("selectedChild");
        sessionStorage.removeItem("activeChild");
        sessionStorage.removeItem("selectedPatient");
        sessionStorage.removeItem("currentPatient");
        clearGameplayCacheForChildSwitch();
      }

      localStorage.removeItem(getChildGameCacheKey(childId));
    } catch (error) {
      console.warn("Supabase 刪除兒童資料失敗：", error);
      saveChildren(previousChildren);
      if (wasCurrentChild && previousCurrentChild) {
        localStorage.setItem(STORAGE_KEYS.currentChildId, childId);
        localStorage.setItem(STORAGE_KEYS.currentChild, previousCurrentChild);
      }
      setErrorMessage("刪除失敗，請確認網路或稍後再試。");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <main className="child-select-page">
      <style>{`
        .child-select-page {
          min-height: 100vh;
          width: 100%;
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(10px, 1.3vw, 20px);
          background-image: url(${PageBackground});
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
          color: #65401a;
        }

        .child-select-page * { box-sizing: border-box; }
        .child-select-page button { font-family: inherit; cursor: pointer; }
        .child-select-page button:disabled {
          cursor: not-allowed;
          opacity: 0.62;
          filter: grayscale(0.25);
          transform: none !important;
        }

        .child-back-button {
          position: fixed;
          top: clamp(14px, 2vw, 26px);
          left: clamp(14px, 2vw, 26px);
          z-index: 10;
          display: inline-flex;
          align-items: center;
          width: clamp(58px, 6vw, 76px);
          height: clamp(58px, 6vw, 76px);
          min-height: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: #5b3514;
          font-size: clamp(1rem, 1.25vw, 1.2rem);
          font-weight: 950;
          letter-spacing: 0.04em;
          box-shadow: none;
          text-shadow: 0 2px 0 rgba(255, 246, 212, 0.72);
          transition: transform 0.16s ease, filter 0.16s ease;
        }

        .child-back-button img { width: 100%; height: 100%; object-fit: contain; }

        .child-back-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.04);
        }

        .child-back-button:active {
          transform: translateY(2px);
          box-shadow:
            0 4px 0 rgba(98, 58, 18, 0.22),
            inset 0 0 0 3px rgba(255, 250, 223, 0.58);
        }

        .child-back-icon {
          font-size: 1.35em;
          line-height: 1;
        }

        .child-board {
          width: min(1210px, 84vw);
          min-height: min(690px, 83vh);
          position: relative;
          transform: translateY(clamp(42px, 6vh, 58px));
          display: flex;
          flex-direction: column;
          padding: clamp(30px, 3.4vw, 54px) clamp(44px, 4.7vw, 76px);
          border-radius: 36px;
          background:
            linear-gradient(180deg, rgba(255, 249, 230, 0.93) 0%, rgba(255, 239, 197, 0.9) 100%);
          border: 8px solid rgba(225, 157, 54, 0.9);
          box-shadow:
            0 18px 36px rgba(92, 58, 18, 0.22),
            inset 0 0 0 4px rgba(255, 255, 255, 0.5);
        }

        .child-board::before {
          content: "";
          position: absolute;
          inset: 22px;
          border: 2px dashed rgba(212, 148, 49, 0.54);
          border-radius: 25px;
          pointer-events: none;
        }

        .child-tag {
          position: relative;
          z-index: 1;
          width: fit-content;
          min-width: 158px;
          padding: 8px 24px 9px;
          margin: 0 0 10px 8px;
          border-radius: 17px;
          background: linear-gradient(180deg, #e6bd6d 0%, #c08135 100%);
          color: #5a3414;
          font-size: clamp(1.08rem, 1.45vw, 1.5rem);
          font-weight: 950;
          text-align: center;
          text-shadow: 0 2px 0 rgba(255, 237, 188, 0.72);
          border: 3px solid #f3ca79;
          box-shadow: 0 5px 0 rgba(112, 69, 22, 0.25), inset 0 0 0 2px rgba(255, 239, 195, 0.55);
        }

        .child-header {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: start;
        }

        .child-title h1 {
          margin: 0;
          color: #a96b0d;
          font-size: clamp(3.05rem, 5vw, 5.25rem);
          line-height: 0.95;
          letter-spacing: 0.1em;
          font-weight: 950;
          text-shadow:
            0 4px 0 #ffffff,
            0 8px 0 rgba(110, 78, 16, 0.28),
            2px 2px 0 #6e4a0d;
        }

        .child-title h1 span { color: #78a62d; }

        .child-subtitle {
          margin: 13px 0 0;
          font-size: clamp(1rem, 1.25vw, 1.2rem);
          font-weight: 950;
          color: #684723;
          letter-spacing: 0.04em;
        }

        .child-count-sign {
          width: clamp(118px, 9.2vw, 148px);
          min-height: clamp(104px, 8.5vw, 136px);
          display: grid;
          place-items: center;
          border-radius: 30px 30px 24px 24px;
          background:
            radial-gradient(circle at 50% 18%, rgba(255, 237, 190, 0.9) 0 30%, transparent 31%),
            linear-gradient(180deg, #f1c373 0%, #d39542 100%);
          border: 4px solid #f5d091;
          color: #573513;
          box-shadow: 0 8px 0 rgba(129, 77, 20, 0.28), inset 0 0 0 7px rgba(255, 229, 169, 0.48);
          text-align: center;
        }

        .child-count-sign strong {
          display: block;
          color: #08679a;
          font-size: clamp(2.45rem, 3.7vw, 4rem);
          line-height: 0.9;
          font-weight: 950;
          text-shadow: 0 2px 0 rgba(255,255,255,0.75);
        }

        .child-count-sign span {
          display: block;
          margin-top: 6px;
          font-size: clamp(0.95rem, 1.18vw, 1.18rem);
          font-weight: 950;
        }

        .child-card-area {
          position: relative;
          z-index: 1;
          flex: 1;
          width: 100%;
          display: flex;
          flex-wrap: nowrap;
          gap: clamp(24px, 3vw, 38px);
          align-items: stretch;
          margin-top: clamp(24px, 2.8vw, 40px);
          padding: 2px 20px 18px;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          scroll-padding-inline: 20px;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
        }

        .child-card-area::-webkit-scrollbar {
          height: 14px;
        }

        .child-card-area::-webkit-scrollbar-track {
          border-radius: 999px;
          background: rgba(216, 151, 53, 0.18);
          border: 2px solid rgba(230, 180, 95, 0.28);
        }

        .child-card-area::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: linear-gradient(90deg, #e8b760 0%, #c9822e 100%);
          border: 3px solid rgba(255, 246, 222, 0.9);
        }

        .child-card-list {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: nowrap;
          gap: clamp(24px, 3vw, 38px);
          align-items: stretch;
        }

        .role-card,
        .add-role-card,
        .empty-role-card {
          flex: 0 0 clamp(420px, 38vw, 510px);
          width: clamp(420px, 38vw, 510px);
          min-height: clamp(318px, 34vh, 374px);
          position: relative;
          border-radius: 30px;
          background-image: url(${CardFrame});
          background-size: 100% 100%;
          background-position: center;
          background-repeat: no-repeat;
          background-color: transparent;
          border: 0;
          box-shadow: none;
          overflow: hidden;
          scroll-snap-align: start;
        }

        .role-card.is-selected .role-ribbon { display: block; }

        .role-ribbon {
          display: none;
          position: absolute;
          top: 22px;
          right: -42px;
          width: 170px;
          padding: 9px 0;
          transform: rotate(45deg);
          background: linear-gradient(180deg, #ffbb43 0%, #ef8d1a 100%);
          color: #fff;
          font-size: 0.96rem;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-align: center;
          box-shadow: 0 4px 12px rgba(98, 59, 17, 0.22);
          z-index: 3;
        }

        .role-card-main,
        .empty-role-content {
          width: 100%;
          min-height: clamp(228px, 24vh, 274px);
          display: grid;
          justify-items: center;
          align-content: center;
          gap: 12px;
          padding: clamp(34px, 4vh, 48px) 24px 8px;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: center;
          position: relative;
          z-index: 2;
        }

        .role-avatar-frame,
        .empty-icon-frame {
          width: clamp(98px, 7.8vw, 116px);
          height: clamp(98px, 7.8vw, 116px);
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: linear-gradient(180deg, #fff1c5 0%, #e4b461 100%);
          border: 5px solid #c47b24;
          box-shadow: inset 0 0 0 5px rgba(255, 247, 218, 0.75), 0 10px 18px rgba(99, 58, 17, 0.14);
          overflow: hidden;
        }

        .role-avatar {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 240, 184, 0.92);
          overflow: hidden;
        }

        .role-avatar img,
        .avatar-choice img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .empty-sprout {
          font-size: clamp(3.1rem, 4.2vw, 3.75rem);
          filter: drop-shadow(0 5px 0 rgba(104, 75, 18, 0.12));
        }

        .role-name,
        .empty-role-content h2,
        .add-role-card strong {
          margin: 0;
          color: #0e6b9e;
          font-size: clamp(1.68rem, 2.25vw, 2.25rem);
          font-weight: 950;
          letter-spacing: 0.06em;
        }

        .role-meta {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 9px;
        }

        .role-meta span {
          padding: 6px 16px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          border: 2px solid rgba(220, 169, 83, 0.62);
          color: #68431a;
          font-size: 1rem;
          font-weight: 950;
        }

        .role-last-played,
        .empty-role-content p,
        .add-role-card span {
          margin: 0;
          color: #6b4b26;
          font-size: clamp(0.98rem, 1.25vw, 1.1rem);
          font-weight: 900;
          line-height: 1.55;
        }

        .role-actions {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          padding: 0 clamp(22px, 2.5vw, 34px) clamp(30px, 4vh, 42px);
          position: relative;
          z-index: 2;
        }

        .image-button,
        .image-submit {
          border: 0;
          background: transparent;
          padding: 0;
          transition: transform 0.16s ease, filter 0.16s ease;
        }

        .image-button:hover,
        .image-submit:hover,
        .add-role-card:hover {
          transform: translateY(-2px);
          filter: brightness(1.04);
        }

        .image-button img,
        .image-submit img {
          display: block;
          height: auto;
          user-select: none;
          pointer-events: none;
        }

        .start-img { width: clamp(145px, 14vw, 205px); }
        .delete-img { width: clamp(90px, 9vw, 128px); }
        .build-start-img { width: min(318px, 88vw); }

        .add-role-card {
          display: grid;
          place-items: center;
          align-content: center;
          gap: 16px;
          padding: clamp(42px, 5vh, 58px) 28px clamp(64px, 7vh, 82px);
          color: #614019;
          transition: transform 0.16s ease, filter 0.16s ease;
        }

        .add-icon-frame {
          width: clamp(108px, 8.8vw, 132px);
          height: clamp(108px, 8.8vw, 132px);
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .add-icon-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 9px 6px rgba(103, 64, 22, 0.14));
        }

        .empty-role-card { display: grid; }

        .empty-role-content {
          min-height: 100%;
          padding: clamp(42px, 5vh, 58px) 28px clamp(68px, 7vh, 84px);
        }

        .form-overlay {
          position: fixed;
          inset: 0;
          z-index: 20;
          display: grid;
          place-items: center;
          padding: 22px;
          background: rgba(53, 35, 15, 0.35);
          backdrop-filter: blur(5px);
        }

        .form-card {
          width: min(620px, 94vw);
          max-height: min(92dvh, 760px);
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          position: relative;
          display: flex;
          flex-direction: column;
          padding: clamp(24px, 3.1vw, 40px);
          border-radius: 30px;
          background: rgba(255, 248, 226, 0.98);
          border: 5px solid #e3a445;
          box-shadow: 0 24px 55px rgba(63, 40, 14, 0.28);
        }

        .form-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 52px;
          height: 52px;
          border: 0;
          border-radius: 50%;
          background: #ffe29d;
          color: #835016;
          font-size: 2.2rem;
          line-height: 1;
          font-weight: 950;
        }

        .form-card h2 {
          margin: 0;
          color: #0e6b9e;
          font-size: clamp(2.15rem, 4vw, 3rem);
          font-weight: 950;
        }

        .form-card p {
          margin: 12px 0 18px;
          color: #68431a;
          font-size: 1.08rem;
          font-weight: 900;
          line-height: 1.6;
        }

        .form-error {
          padding: 12px 14px;
          border-radius: 16px;
          background: #fff0e4;
          color: #a04520;
          border: 2px solid #f2ad83;
          font-weight: 950;
        }

        .form-card label {
          display: grid;
          gap: 8px;
          margin-top: 14px;
          color: #68431a;
          font-weight: 950;
        }

        .form-card input,
        .form-card select {
          width: 100%;
          min-height: 50px;
          padding: 0 14px;
          border-radius: 16px;
          border: 2px solid #dfb66c;
          background: #fffdf2;
          color: #5e3b18;
          font-size: 1rem;
          outline: none;
        }

        .avatar-picker {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 18px;
        }

        .avatar-choice {
          min-height: 72px;
          aspect-ratio: 1.7 / 1;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 18px;
          background: #fff4c5;
          border: 2px solid #dfb66c;
          box-shadow: inset 0 0 0 3px rgba(255,255,255,0.45);
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .avatar-choice img {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          object-fit: cover;
        }

        .avatar-choice:hover { transform: translateY(-2px); }

        .avatar-choice.is-active {
          background: #ffdf78;
          border-color: #e39b27;
          box-shadow: 0 0 0 4px rgba(255, 221, 119, 0.48), inset 0 0 0 3px rgba(255,255,255,0.45);
        }

        .form-actions {
          display: flex;
          justify-content: center;
          margin-top: 24px;
        }

        @media (max-width: 1180px) {
          .child-select-page { overflow-y: auto; align-items: flex-start; }
          .child-board { width: min(100%, 980px); min-height: auto; }
          .child-card-area,
          .child-card-list { gap: clamp(20px, 4vw, 34px); }
          .role-card,
          .add-role-card,
          .empty-role-card {
            flex-basis: clamp(380px, 58vw, 500px);
            width: clamp(380px, 58vw, 500px);
          }
        }

        @media (max-width: 860px) {
          .child-board { padding: 28px 22px; }
          .child-header { grid-template-columns: 1fr; }
          .child-count-sign { width: 116px; min-height: 102px; }
          .child-card-area {
            padding-inline: 20px;
            scroll-padding-inline: 20px;
          }
          .avatar-picker { gap: 14px; }
          .role-card,
          .add-role-card,
          .empty-role-card {
            flex-basis: clamp(330px, 78vw, 450px);
            width: clamp(330px, 78vw, 450px);
          }
        }

        @media (max-width: 860px) and (orientation: portrait) {
          .form-overlay {
            place-items: stretch;
            padding: 0;
          }

          .form-card {
            width: 100%;
            min-height: 100dvh;
            max-height: none;
            border-radius: 0;
            border-width: 0;
            padding: 78px 22px max(28px, env(safe-area-inset-bottom));
          }

          .form-close {
            position: fixed;
            top: max(14px, env(safe-area-inset-top));
            right: 14px;
            z-index: 1;
          }
        }

        @media (max-width: 560px) {
          .child-select-page { padding: 8px; }
          .child-board { border-radius: 24px; padding: 22px 14px; border-width: 5px; }
          .child-board::before { inset: 14px; }
          .child-title h1 { font-size: 2.55rem; letter-spacing: 0.04em; }
          .child-subtitle { font-size: 0.95rem; }
          .role-card, .add-role-card, .empty-role-card {
            flex-basis: min(318px, 84vw);
            width: min(318px, 84vw);
            min-height: 300px;
          }
          .child-card-area,
          .child-card-list { gap: 14px; }
          .role-actions { gap: 8px; padding: 0 14px 30px; }
          .avatar-picker {
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
          }
          .build-start-img { width: min(286px, 82vw); }
          .child-back-button {
            top: 10px;
            left: 10px;
            min-height: 42px;
            padding: 0 14px;
            border-width: 3px;
            font-size: 0.95rem;
          }
        }
      `}</style>

      <button type="button" className="child-back-button" onClick={() => navigate("/")} aria-label="回到上一頁">
        <img src={ReturnButton} alt="" />
      </button>

      <section className="child-board" aria-label="兒童角色卡選擇" aria-busy={isSyncing}>
        <div className="child-tag">選擇角色</div>

        <header className="child-header">
          <div className="child-title">
            <h1>兒童角色<span>卡</span></h1>
            <p className="child-subtitle">點擊卡片後，會進入測驗 / 訓練選擇頁。{isSyncing ? "｜雲端同步中..." : ""}</p>
          </div>

          <div className="child-count-sign" aria-label={`目前有 ${children.length} 位兒童`}>
            <div>
              <strong>{children.length}</strong>
              <span>位兒童</span>
            </div>
          </div>
        </header>

        <section className="child-card-area">
          {children.length === 0 ? (
            <article className="empty-role-card" aria-label="尚未新增兒童">
              <div className="empty-role-content">
                <div className="empty-icon-frame" aria-hidden="true">
                  <span className="empty-sprout">🌱</span>
                </div>
                <h2>尚未新增兒童</h2>
                <p>
                  請先建立孩子的基本資料，
                  <br />
                  以便未來測驗與訓練紀錄能正確保存。
                </p>
              </div>
            </article>
          ) : (
            <div className="child-card-list">
              {children.map((child) => {
                const isSelected = currentChildId === child.childId;
                const displayAge = child.age ? `${child.age} 歲` : "年齡未設定";
                const avatar = getAvatarOption(child.avatarIcon);

                return (
                  <article className={`role-card ${isSelected ? "is-selected" : ""}`} key={child.childId}>
                    <span className="role-ribbon">目前使用中</span>
                    <button
                      type="button"
                      className="role-card-main"
                      onClick={() => selectChild(child)}
                      aria-label={`選擇 ${child.nickname || child.name}`}
                      disabled={isSyncing}
                    >
                      <div className="role-avatar-frame">
                        <div className="role-avatar" aria-hidden="true">
                          <img src={child.avatar || avatar.src} alt="" />
                        </div>
                      </div>

                      <h2 className="role-name">{child.nickname || child.name}</h2>
                      <div className="role-meta">
                        <span>{displayAge}</span>
                        <span>{getTodayStatus(child)}</span>
                      </div>
                      <p className="role-last-played">最近遊玩：{formatLastPlayed(child.lastPlayedAt)}</p>
                    </button>

                    <div className="role-actions">
                      <button type="button" className="image-button" onClick={() => selectChild(child)} aria-label="開始任務" disabled={isSyncing}>
                        <img width={1024} height={341} src={StartButton} alt="開始任務" className="start-img" />
                      </button>

                      <button type="button" className="image-button" onClick={(event) => removeChild(event, child.childId)} aria-label="移除角色" disabled={isSyncing}>
                        <img width={1024} height={341} loading="lazy" src={DeleteButton} alt="移除" className="delete-img" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <button type="button" className="add-role-card" onClick={openAddChildModal} aria-label="新增小冒險家" disabled={isSyncing}>
            <span className="add-icon-frame" aria-hidden="true">
              <img width={138} height={125} loading="lazy" src={AddButton} alt="" />
            </span>
            <strong>新增小冒險家</strong>
            <span>建立新的兒童角色卡</span>
          </button>
        </section>
      </section>

      {isAdding && (
        <section className="form-overlay" role="dialog" aria-modal="true">
          <form className="form-card" onSubmit={handleAddChild}>
            <button type="button" className="form-close" onClick={() => setIsAdding(false)} aria-label="關閉">
              ×
            </button>

            <h2>新增小冒險家</h2>
            <p>建立新的兒童角色卡，之後星星、測驗與訓練紀錄會分開保存。</p>

            {errorMessage && <div className="form-error">{errorMessage}</div>}

            <label>
              暱稱
              <input
                type="text"
                value={formData.nickname}
                placeholder="例如：小小睿"
                onChange={(event) => setFormData((prev) => ({ ...prev, nickname: event.target.value }))}
              />
            </label>

            <label>
              生日
              <input
                type="date"
                value={formData.birthday}
                min={birthdayLimits.min}
                max={birthdayLimits.max}
                onChange={(event) => setFormData((prev) => ({ ...prev, birthday: event.target.value }))}
              />
            </label>

            <label>
              性別
              <select
                value={formData.gender}
                onChange={(event) => setFormData((prev) => ({ ...prev, gender: event.target.value }))}
              >
                <option value="" disabled>請選擇</option>
                <option value="女">女</option>
                <option value="男">男</option>
                <option value="其他 / 不透露">其他 / 不透露</option>
              </select>
            </label>

            <div className="avatar-picker" aria-label="選擇頭像">
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  type="button"
                  key={avatar.key}
                  className={formData.avatarIcon === avatar.key ? "avatar-choice is-active" : "avatar-choice"}
                  onClick={() => setFormData((prev) => ({ ...prev, avatarIcon: avatar.key }))}
                  aria-label={`選擇${avatar.label}頭像`}
                >
                  <img loading="lazy" src={avatar.src} alt="" />
                </button>
              ))}
            </div>

            <div className="form-actions">
              <button type="submit" className="image-submit" aria-label="建立並開始" disabled={isSyncing}>
                <img width={1024} height={341} src={BuildStartButton} alt="建立並開始" className="build-start-img" />
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
};

export default ChildSelectPage;
