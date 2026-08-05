import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../styles/GameMenuPage.css";
import useTemporaryTestUnlock from "../utils/useTemporaryTestUnlock";

import gameMapBackground from "../asset/GameMap.webp";
import mousePointer from "../asset/mouse.webp";
import completionVideo from "../asset/mp4/start.mp4";

import chickenAvatar from "../asset/avatar/chicken.webp";
import starAsset from "../asset/home/icon/一星_no_bg.webp";
import honeycombAsset from "../asset/honeycomb_no_bg.webp";
import honeyAsset from "../asset/Honey.webp";
import pawLockedAsset from "../asset/home/icon/關卡 灰_no_bg.webp";
import pawActiveAsset from "../asset/home/icon/關卡 黃_no_bg.webp";
import pawDoneAsset from "../asset/home/icon/關卡 綠_no_bg.webp";
import srtIcon from "../asset/SRT/SRT_icon.webp";
import pmIcon from "../asset/PM_icon.webp";
import cbtIcon from "../asset/CBT_icon.webp";
import ssgIcon from "../asset/SSG/cat.webp";
import dccsIcon from "../asset/DCCS_icon.webp";
import lbIcon from "../asset/LB_icon.webp";
import storyIcon from "../asset/home/story.webp";
import testIcon from "../asset/home/test.webp";
import goalIcon from "../asset/home/goal.webp";
import avatarHomeImg from "../asset/home/avatar_home.webp";

const COMPLETED_LEVELS_STORAGE_KEY = "ef_game_completed_training_levels";
const COMPLETION_VIDEO_SEEN_KEY = "ef_game_today_training_completion_video_seen";
const TRAINING_MENU_SESSION_STORAGE_KEY = "ef_game_training_menu_session";
const DEFAULT_TRAINING_MINUTES = 15;
const MAX_LEVEL_PER_GAME = 5;
const HONEY_MISSION_STORAGE_KEY = "ef_game_honey_mission_progress";
const DAILY_TRAINING_SECONDS_STORAGE_KEY = "ef_game_today_training_seconds";
const CURRENT_CHILD_STORAGE_KEYS = ["currentChild", "selectedChild", "currentPatient", "selectedPatient"];

const HONEY_MISSION_CONFIGS = [
  { round: 1, requiredDays: 3, requiredStars: 50, dailyStarCap: 18, resetAfterDays: 3 },
  { round: 2, requiredDays: 5, requiredStars: 70, dailyStarCap: 18, resetAfterDays: 3 },
  { round: 3, requiredDays: 7, requiredStars: 90, dailyStarCap: 18, resetAfterDays: 5 },
  { round: 4, requiredDays: 10, requiredStars: 120, dailyStarCap: 18, resetAfterDays: 5 },
  { round: 5, requiredDays: 14, requiredStars: 150, dailyStarCap: 18, resetAfterDays: 5 },
];

const ABILITY_LABELS = {
  inhibition: "專注",
  workingMemory: "記憶",
  flexibility: "規則",
};

const LEVEL_COPY = {
  1: "暖身",
  2: "小挑戰",
  3: "再挑戰",
  4: "很專心",
  5: "小高手",
};

const PAGE_SIZE = 6;

const FULL_ROUTE_POINTS = [
  { x: 11, y: 78 },
  { x: 25, y: 68 },
  { x: 39, y: 61 },
  { x: 54, y: 58 },
  { x: 70, y: 64 },
  { x: 84, y: 64 },
];

const safeParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readJsonArray = (key) => {
  const value = safeParse(localStorage.getItem(key), []);
  return Array.isArray(value) ? value : [];
};

const createTrainingMenuSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const readTrainingMenuSessionId = (locationState = {}) => {
  const shouldStartFreshSession =
    (locationState?.mode === "training" && locationState?.fromResult !== true) ||
    locationState?.resetTrainingMenuSession === true;

  if (shouldStartFreshSession) {
    const sessionId = createTrainingMenuSessionId();
    sessionStorage.setItem(TRAINING_MENU_SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  }

  const existingSessionId = sessionStorage.getItem(TRAINING_MENU_SESSION_STORAGE_KEY);
  if (existingSessionId) return existingSessionId;

  const sessionId = createTrainingMenuSessionId();
  sessionStorage.setItem(TRAINING_MENU_SESSION_STORAGE_KEY, sessionId);
  return sessionId;
};

const readSelectedChild = () => {
  if (typeof window === "undefined") return null;

  for (const key of CURRENT_CHILD_STORAGE_KEYS) {
    const value = safeParse(localStorage.getItem(key), null);
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }

  return null;
};

const getDailyTrainingSecondsKey = (todayKey) => `${DAILY_TRAINING_SECONDS_STORAGE_KEY}_${todayKey}`;

const readTodayTrainingSeconds = (todayKey) => {
  const keys = [
    getDailyTrainingSecondsKey(todayKey),
    DAILY_TRAINING_SECONDS_STORAGE_KEY,
    `training_duration_seconds_${todayKey}`,
    `trainingTime_${todayKey}`,
  ];

  for (const key of keys) {
    const seconds = Number(localStorage.getItem(key));
    if (Number.isFinite(seconds) && seconds >= 0) return Math.floor(seconds);
  }

  return 0;
};

const writeTodayTrainingSeconds = (todayKey, seconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  localStorage.setItem(getDailyTrainingSecondsKey(todayKey), String(safeSeconds));
  localStorage.setItem(DAILY_TRAINING_SECONDS_STORAGE_KEY, String(safeSeconds));
};

const formatTrainingDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (minutes <= 0) return `${remainingSeconds} 秒`;
  return `${minutes} 分 ${String(remainingSeconds).padStart(2, "0")} 秒`;
};

const getTodayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const getDaysBetween = (fromDateKey, toDateKey) => {
  if (!fromDateKey || !toDateKey) return 0;

  const fromTime = new Date(`${fromDateKey}T00:00:00`).getTime();
  const toTime = new Date(`${toDateKey}T00:00:00`).getTime();

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return 0;
  return Math.max(0, Math.floor((toTime - fromTime) / 86400000));
};

const getHoneyMissionConfig = (round = 1) => {
  const missionRound = Math.max(1, Number(round) || 1);
  return HONEY_MISSION_CONFIGS.find((item) => item.round === missionRound) || HONEY_MISSION_CONFIGS[HONEY_MISSION_CONFIGS.length - 1];
};

const createHoneyMissionProgress = (round = 1) => ({
  round: Math.max(1, Number(round) || 1),
  dailyStars: {},
  effectiveTrainingDays: [],
  lastEffectiveTrainingDate: null,
});

const normalizeHoneyMissionProgress = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createHoneyMissionProgress(1);

  return {
    round: Math.max(1, Number(value.round) || 1),
    dailyStars: value.dailyStars && typeof value.dailyStars === "object" && !Array.isArray(value.dailyStars)
      ? value.dailyStars
      : {},
    effectiveTrainingDays: Array.isArray(value.effectiveTrainingDays) ? value.effectiveTrainingDays : [],
    lastEffectiveTrainingDate: value.lastEffectiveTrainingDate || null,
  };
};

const saveHoneyMissionProgress = (progress) => {
  localStorage.setItem(HONEY_MISSION_STORAGE_KEY, JSON.stringify(progress));
};

const updateHoneyMissionProgress = ({ todayKey, earnedStarsToday, completedCountToday }) => {
  const current = normalizeHoneyMissionProgress(safeParse(localStorage.getItem(HONEY_MISSION_STORAGE_KEY), null));
  const config = getHoneyMissionConfig(current.round);
  const inactiveDays = getDaysBetween(current.lastEffectiveTrainingDate, todayKey);
  const shouldReset = current.lastEffectiveTrainingDate && inactiveDays > config.resetAfterDays;
  const progress = shouldReset ? createHoneyMissionProgress(current.round) : current;

  const countedStarsToday = Math.min(config.dailyStarCap, Math.max(0, Number(earnedStarsToday) || 0));
  progress.dailyStars[todayKey] = Math.max(Number(progress.dailyStars[todayKey]) || 0, countedStarsToday);

  const isEffectiveDay = completedCountToday >= 3 || countedStarsToday >= 6;
  if (isEffectiveDay) {
    progress.effectiveTrainingDays = [...new Set([...progress.effectiveTrainingDays, todayKey])].sort();
    progress.lastEffectiveTrainingDate = todayKey;
  }

  const totalStars = Object.values(progress.dailyStars).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const effectiveDays = progress.effectiveTrainingDays.length;
  const unlocked = totalStars >= config.requiredStars && effectiveDays >= config.requiredDays;

  saveHoneyMissionProgress(progress);

  return {
    ...config,
    round: progress.round,
    totalStars,
    effectiveDays,
    unlocked,
    progressPercent: Math.min(100, Math.round(Math.min(totalStars / config.requiredStars, effectiveDays / config.requiredDays) * 100)),
    remainingStars: Math.max(0, config.requiredStars - totalStars),
    remainingDays: Math.max(0, config.requiredDays - effectiveDays),
    countedStarsToday,
    resetNotice: shouldReset,
  };
};

const getTrainingSettings = (locationState = {}) => {
  const stateSettings = locationState?.trainingSettings;

  if (stateSettings && typeof stateSettings === "object") {
    return stateSettings;
  }

  const keys = [
    "ef_game_training_settings",
    "trainingSettings",
    "parentTrainingSettings",
    "settings_training",
    "ef_training_settings",
  ];

  for (const key of keys) {
    const value = safeParse(localStorage.getItem(key)) || safeParse(sessionStorage.getItem(key));
    if (value && typeof value === "object") return value;
  }

  return {};
};

const getTrainingMinutes = (settings) => {
  const candidates = [
    settings.minutes,
    settings.trainingMinutes,
    settings.trainingTime,
    settings.sessionMinutes,
    settings.durationMinutes,
    settings.duration,
    settings.dailyTrainingMinutes,
  ];

  const value = candidates.map(Number).find((item) => Number.isFinite(item) && item > 0);
  return value || DEFAULT_TRAINING_MINUTES;
};

const normalizeAbilityValue = (value) => {
  const text = String(value || "").toLowerCase();

  if (
    text.includes("inhib") ||
    text.includes("抑制") ||
    text.includes("專注") ||
    text.includes("反應") ||
    text.includes("srt") ||
    text.includes("ssg")
  ) {
    return "inhibition";
  }

  if (
    text.includes("memory") ||
    text.includes("記憶") ||
    text.includes("工作") ||
    text.includes("pm") ||
    text.includes("cbt")
  ) {
    return "workingMemory";
  }

  if (
    text.includes("flex") ||
    text.includes("彈性") ||
    text.includes("規則") ||
    text.includes("轉換") ||
    text.includes("dccs") ||
    text.includes("lb")
  ) {
    return "flexibility";
  }

  return null;
};

const getSelectedAbilities = (settings) => {
  const candidates = [
    settings.trainingAbilities,
    settings.selectedAbilities,
    settings.abilityFocus,
    settings.focusAbilities,
    settings.abilities,
    settings.trainingAbility,
  ];

  const rawValues = candidates.flatMap((value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") {
      return Object.entries(value)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([key]) => key);
    }
    return [value];
  });

  const normalized = rawValues.map(normalizeAbilityValue).filter(Boolean);
  const unique = [...new Set(normalized)];

  return unique.length > 0 ? unique : ["inhibition", "workingMemory", "flexibility"];
};

const normalizeGameIdValue = (value) => {
  const text = String(value || "").toLowerCase();

  if (text.includes("srt") || text.includes("反應小松鼠") || text.includes("橡實")) return "srt";
  if (text.includes("pm") || text.includes("picture") || text.includes("記憶收藏家") || text.includes("圖片")) return "pm";
  if (text.includes("cbt") || text.includes("石頭") || text.includes("石橋")) return "cbt";
  if (text.includes("ssg") || text.includes("dot") || text.includes("專注小幫手") || text.includes("小蟲")) return "ssg";
  if (text.includes("dccs") || text.includes("規則小隊長") || text.includes("分類")) return "dccs";
  if (text === "lb" || text.includes("linking") || text.includes("balloon") || text.includes("順序切換") || text.includes("路標")) return "lb";

  return null;
};

const getRawSettingValues = (settings, keys) => {
  return keys.flatMap((key) => {
    const value = settings?.[key];

    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") {
      return Object.entries(value)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([settingKey]) => settingKey);
    }

    return [value];
  });
};

const getSelectedTrainingGames = (settings, trainingGames) => {
  const directValues = getRawSettingValues(settings, [
    "trainingGameIds",
    "selectedTrainingGameIds",
    "selectedTrainingItems",
    "trainingItems",
    "gameIds",
    "games",
    "abilities",
    "selectedAbilities",
  ]);

  const selectedGameIds = [
    ...new Set(directValues.map(normalizeGameIdValue).filter(Boolean)),
  ];

  if (selectedGameIds.length > 0) {
    return selectedGameIds
      .map((gameId) => trainingGames.find((game) => game.id === gameId))
      .filter(Boolean);
  }

  const selectedAbilityGroups = getSelectedAbilities(settings);
  return trainingGames.filter((game) => selectedAbilityGroups.includes(game.ability));
};

const getRecommendedTrainingPlan = (settings, trainingGames) => {
  const rawPlan = Array.isArray(settings?.trainingLevelPlan)
    ? settings.trainingLevelPlan
    : Array.isArray(settings?.dailyTrainingPlan)
      ? settings.dailyTrainingPlan
      : [];

  const gameUseCount = {};

  return rawPlan
    .map((item, index) => {
      const rawGameId =
        typeof item === "string"
          ? item
          : item?.gameId || item?.id || item?.trainingGameId || item?.game;
      const gameId = normalizeGameIdValue(rawGameId);
      const game = trainingGames.find((candidate) => candidate.id === gameId);

      if (!game) return null;

      const explicitLevel =
        typeof item === "object" && item !== null
          ? item.level || item.trainingLevel || item.difficultyLevel
          : null;
      const nextLevel = explicitLevel || (gameUseCount[game.id] || 0) + 1;
      const safeLevel = Math.min(MAX_LEVEL_PER_GAME, Math.max(1, Number(nextLevel) || 1));

      gameUseCount[game.id] = Math.max(gameUseCount[game.id] || 0, safeLevel);

      return {
        ...game,
        gameId: game.id,
        level: safeLevel,
        plannedOrder: Number(item?.order || item?.trainingOrder || index + 1),
        recommendationScore:
          typeof item === "object" && item !== null ? item.recommendationScore ?? null : null,
        averageScore:
          typeof item === "object" && item !== null ? item.averageScore ?? null : null,
        resultCount:
          typeof item === "object" && item !== null ? item.resultCount ?? 0 : 0,
        source:
          typeof item === "object" && item !== null ? item.source || "training-plan" : "legacy-training-plan",
      };
    })
    .filter(Boolean)
    .slice(0, 12);
};

const getPlannedStageCount = (minutes, selectedAbilityCount, maxCount) => {
  let count = 15;

  if (minutes <= 8) count = 6;
  else if (minutes <= 12) count = 12;
  else count = 15;

  const minimum = Math.max(PAGE_SIZE, selectedAbilityCount * 2);
  return Math.min(Math.max(count, minimum), maxCount);
};

const pickRoutePoints = (count) => {
  if (count <= 1) return [FULL_ROUTE_POINTS[0]];

  const last = FULL_ROUTE_POINTS.length - 1;
  return Array.from({ length: count }, (_, index) => {
    const routeIndex = Math.round((index * last) / (count - 1));
    return FULL_ROUTE_POINTS[routeIndex];
  });
};

const createCurvedRoutePath = (points) => {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;

    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
};

const isTrainingStageCompletedFromStorage = (stage) => {
  const completedLevels = readJsonArray(COMPLETED_LEVELS_STORAGE_KEY);

  return (
    completedLevels.includes(stage.stageId) ||
    localStorage.getItem(`ef_game_${stage.stageId}_completed`) === "true"
  );
};

const clampStarCount = (value) => {
  const stars = Number(value);
  if (!Number.isFinite(stars)) return 0;
  return Math.min(3, Math.max(0, Math.round(stars)));
};

const readStarFromObject = (source, stage) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) return 0;

  const starKeys = [
    stage.stageId,
  ];

  for (const key of starKeys) {
    const value = source[key];
    if (typeof value === "object" && value !== null) {
      const nestedStar = clampStarCount(value.stars ?? value.star ?? value.rating ?? value.scoreStars);
      if (nestedStar > 0) return nestedStar;
    }

    const directStar = clampStarCount(value);
    if (directStar > 0) return directStar;
  }

  return 0;
};

const getTrainingStageStarsFromStorage = (stage, completed) => {
  const directKeys = [
    `ef_game_${stage.stageId}_stars`,
  ];

  for (const key of directKeys) {
    const stars = clampStarCount(localStorage.getItem(key));
    if (stars > 0) return stars;
  }

  const objectKeys = [
    "ef_game_training_stage_stars",
    "ef_game_stage_stars",
    "ef_game_level_stars",
    "trainingStageStars",
    "trainingLevelStars",
    "gameStars",
  ];

  for (const key of objectKeys) {
    const stars = readStarFromObject(safeParse(localStorage.getItem(key), {}), stage);
    if (stars > 0) return stars;
  }

  return completed ? 1 : 0;
};

function GameMenuPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isTestUnlockEnabled = useTemporaryTestUnlock();
  const selectedChild = useMemo(() => location.state?.child || readSelectedChild(), [location.state]);
  const [showCompletionVideo, setShowCompletionVideo] = useState(false);
  const [showStoryVideo, setShowStoryVideo] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [lockedHintStageId, setLockedHintStageId] = useState(null);
  const [userProfileName, setUserProfileName] = useState("小冒險家");
  const [completedStageIds, setCompletedStageIds] = useState([]);
  const [stageStarMap, setStageStarMap] = useState({});
  const [storageRefreshToken, setStorageRefreshToken] = useState(0);
  const [todayTrainingSeconds, setTodayTrainingSeconds] = useState(() => readTodayTrainingSeconds(getTodayKey()));
  const lockedHintTimeoutRef = useRef(null);
  const [honeyProgress, setHoneyProgress] = useState(() => updateHoneyMissionProgress({
    todayKey: getTodayKey(),
    earnedStarsToday: 0,
    completedCountToday: 0,
  }));

  useEffect(() => {
    setShowStoryVideo(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        const user = data?.user ?? null;

        if (error || !user) {
          if (isMounted) navigate("/login", { replace: true });
          return;
        }

        const metadata = user.user_metadata || {};
        const selectedChild = readSelectedChild();
        const displayName =
          selectedChild?.nickname ||
          selectedChild?.name ||
          selectedChild?.full_name ||
          metadata.username ||
          metadata.name ||
          metadata.full_name ||
          metadata.child_name ||
          user.email?.split("@")[0] ||
          "小冒險家";

        if (isMounted) {
          setUserProfileName(displayName);
        }
      } catch {
        if (isMounted) navigate("/login", { replace: true });
      }
    };

    checkUser();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const trainingGames = useMemo(() => [
    {
      id: "srt",
      ability: "inhibition",
      shortName: "SRT",
      title: "橡實",
      icon: srtIcon,
      trainPath: "/training-srt",
      testPath: "/test-srt",
    },
    {
      id: "ssg",
      ability: "inhibition",
      shortName: "SSG",
      title: "聲音符號",
      icon: ssgIcon,
      trainPath: "/training-ssg",
      testPath: "/test-ssg",
    },
    {
      id: "pm",
      ability: "workingMemory",
      shortName: "PM",
      title: "圖片",
      icon: pmIcon,
      trainPath: "/training-picture-memory",
      testPath: "/test-picture-memory",
    },
    {
      id: "cbt",
      ability: "workingMemory",
      shortName: "CBT",
      title: "石橋",
      icon: cbtIcon,
      trainPath: "/training-cbt",
      testPath: "/test-cbt",
    },
    {
      id: "dccs",
      ability: "flexibility",
      shortName: "DCCS",
      title: "分類",
      icon: dccsIcon,
      trainPath: "/training-dccs",
      testPath: "/test-dccs",
    },
    {
      id: "lb",
      ability: "flexibility",
      shortName: "LB",
      title: "路標",
      icon: lbIcon,
      trainPath: "/training-linking-balloons",
      testPath: "/test-linking-balloons",
    },
  ], []);

  const todayKey = useMemo(() => getTodayKey(), []);
  const [trainingMenuSessionId] = useState(() => readTrainingMenuSessionId(location.state));
  const trainingSettings = useMemo(() => {
    void storageRefreshToken;
    return getTrainingSettings(location.state);
  }, [location.state, storageRefreshToken]);
  const trainingMinutes = useMemo(() => getTrainingMinutes(trainingSettings), [trainingSettings]);
  const selectedTrainingGames = useMemo(
    () => getSelectedTrainingGames(trainingSettings, trainingGames),
    [trainingGames, trainingSettings]
  );
  const recommendedTrainingPlan = useMemo(
    () => getRecommendedTrainingPlan(trainingSettings, trainingGames),
    [trainingGames, trainingSettings]
  );
  const selectedTrainingLabel = useMemo(() => {
    return selectedTrainingGames.map((game) => game.shortName).join("、") || "自動安排";
  }, [selectedTrainingGames]);

  const dailyTrainingStages = useMemo(() => {
    if (recommendedTrainingPlan.length > 0) {
      const plannedPoints = pickRoutePoints(recommendedTrainingPlan.length);

      return recommendedTrainingPlan.map((planItem, index) => {
        const point = plannedPoints[index];

        return {
          ...planItem,
          stageId: `${todayKey}-${trainingMenuSessionId}-${index + 1}-${planItem.id}-L${planItem.level}`,
          todayKey,
          routeIndex: index,
          globalOrder: index + 1,
          difficultyLabel: LEVEL_COPY[planItem.level] || `第 ${planItem.level} 關`,
          mapX: point.x,
          mapY: point.y,
          abilityLabel: ABILITY_LABELS[planItem.ability] || planItem.title,
        };
      });
    }

    const availableGames = selectedTrainingGames.length > 0 ? selectedTrainingGames : trainingGames;
    const maxPossibleStages = availableGames.length * MAX_LEVEL_PER_GAME;
    const targetCount = getPlannedStageCount(trainingMinutes, availableGames.length, maxPossibleStages);
    const plannedPoints = pickRoutePoints(targetCount);
    const gameUseCount = {};
    const stages = [];
    let gameCursor = 0;
    let guard = 0;

    while (stages.length < targetCount && guard < 300) {
      const selectableGames = availableGames.filter((game) => (gameUseCount[game.id] || 0) < MAX_LEVEL_PER_GAME);

      if (selectableGames.length === 0) break;

      const game = selectableGames[gameCursor % selectableGames.length];
      const level = (gameUseCount[game.id] || 0) + 1;
      const point = plannedPoints[stages.length];

      stages.push({
        ...game,
        gameId: game.id,
        stageId: `${todayKey}-${trainingMenuSessionId}-${stages.length + 1}-${game.id}-L${level}`,
        todayKey,
        routeIndex: stages.length,
        globalOrder: stages.length + 1,
        level,
        difficultyLabel: LEVEL_COPY[level],
        mapX: point.x,
        mapY: point.y,
        abilityLabel: ABILITY_LABELS[game.ability] || game.title,
      });

      gameUseCount[game.id] = level;
      gameCursor += 1;
      guard += 1;
    }

    return stages;
  }, [recommendedTrainingPlan, selectedTrainingGames, todayKey, trainingGames, trainingMenuSessionId, trainingMinutes]);

  useEffect(() => {
    const refreshLocalStorageBackedState = () => {
      setTodayTrainingSeconds(readTodayTrainingSeconds(todayKey));
      setStorageRefreshToken((value) => value + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshLocalStorageBackedState();
    };

    window.addEventListener("focus", refreshLocalStorageBackedState);
    window.addEventListener("pageshow", refreshLocalStorageBackedState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshLocalStorageBackedState);
      window.removeEventListener("pageshow", refreshLocalStorageBackedState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [todayKey]);

  useEffect(() => {
    let lastTickTime = Date.now();

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.max(1, Math.floor((now - lastTickTime) / 1000));
      lastTickTime = now;

      if (document.visibilityState === "hidden") return;

      const nextSeconds = readTodayTrainingSeconds(todayKey) + elapsedSeconds;
      writeTodayTrainingSeconds(todayKey, nextSeconds);
      setTodayTrainingSeconds(nextSeconds);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [todayKey]);

  useEffect(() => {
    const refreshCompletedStages = () => {
      const completedIds = [];
      const nextStageStarMap = {};

      dailyTrainingStages.forEach((stage) => {
        const completed = isTrainingStageCompletedFromStorage(stage);
        const stars = getTrainingStageStarsFromStorage(stage, completed);

        if (completed) completedIds.push(stage.stageId);
        nextStageStarMap[stage.stageId] = stars;
      });

      setCompletedStageIds(completedIds);
      setStageStarMap(nextStageStarMap);

      const earnedStarsToday = dailyTrainingStages.reduce((sum, stage) => sum + clampStarCount(nextStageStarMap[stage.stageId]), 0);
      setHoneyProgress(updateHoneyMissionProgress({
        todayKey,
        earnedStarsToday,
        completedCountToday: completedIds.length,
      }));

      const allPlannedStagesCompleted =
        dailyTrainingStages.length > 0 && completedIds.length === dailyTrainingStages.length;
      const videoAlreadySeen = localStorage.getItem(`${COMPLETION_VIDEO_SEEN_KEY}_${todayKey}`) === "true";

      if (allPlannedStagesCompleted && !videoAlreadySeen) {
        setShowCompletionVideo(true);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshCompletedStages();
    };

    refreshCompletedStages();
    window.addEventListener("storage", refreshCompletedStages);
    window.addEventListener("focus", refreshCompletedStages);
    window.addEventListener("pageshow", refreshCompletedStages);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("storage", refreshCompletedStages);
      window.removeEventListener("focus", refreshCompletedStages);
      window.removeEventListener("pageshow", refreshCompletedStages);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [dailyTrainingStages, todayKey]);

  const stageStateMap = useMemo(() => {
    return dailyTrainingStages.reduce((stateMap, stage, index) => {
      const completed = completedStageIds.includes(stage.stageId);
      const previousCompleted =
        index === 0 || dailyTrainingStages.slice(0, index).every((item) => completedStageIds.includes(item.stageId));
      const unlocked = isTestUnlockEnabled || completed || previousCompleted;

      stateMap[stage.stageId] = {
        completed,
        unlocked,
        active: unlocked && !completed,
        stars: completed ? clampStarCount(stageStarMap[stage.stageId]) : 0,
      };

      return stateMap;
    }, {});
  }, [completedStageIds, dailyTrainingStages, isTestUnlockEnabled, stageStarMap]);

  const currentStage = useMemo(
    () => dailyTrainingStages.find((stage) => stageStateMap[stage.stageId]?.active) || dailyTrainingStages.find((stage) => stageStateMap[stage.stageId]?.unlocked) || dailyTrainingStages[0],
    [dailyTrainingStages, stageStateMap]
  );

  const currentPageIndex = useMemo(() => {
    if (!dailyTrainingStages.length) return 0;

    const firstIncompleteIndex = dailyTrainingStages.findIndex((stage) => !stageStateMap[stage.stageId]?.completed);
    const targetIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : dailyTrainingStages.length - 1;
    return Math.floor(targetIndex / PAGE_SIZE);
  }, [dailyTrainingStages, stageStateMap]);

  const visibleDailyStages = useMemo(() => {
    const pageStartIndex = currentPageIndex * PAGE_SIZE;
    return dailyTrainingStages.slice(pageStartIndex, pageStartIndex + PAGE_SIZE).map((stage, index) => {
      const point = FULL_ROUTE_POINTS[index] || FULL_ROUTE_POINTS[FULL_ROUTE_POINTS.length - 1];
      return {
        ...stage,
        mapX: point.x,
        mapY: point.y,
      };
    });
  }, [currentPageIndex, dailyTrainingStages]);

  const visibleRoutePoints = useMemo(
    () => visibleDailyStages.map((stage) => ({ x: stage.mapX, y: stage.mapY })),
    [visibleDailyStages]
  );
  const routePath = createCurvedRoutePath(visibleRoutePoints);

  const earnedStarsTotal = useMemo(() => {
    return dailyTrainingStages.reduce((sum, stage) => {
      const stageState = stageStateMap[stage.stageId] || {};
      return sum + clampStarCount(stageState.stars);
    }, 0);
  }, [dailyTrainingStages, stageStateMap]);

  const maxStarsTotal = Math.max(30, dailyTrainingStages.length * 3);

  const closeCompletionVideo = () => {
    localStorage.setItem(`${COMPLETION_VIDEO_SEEN_KEY}_${todayKey}`, "true");
    setShowCompletionVideo(false);
  };

  const closeStoryVideo = () => {
    setShowStoryVideo(false);
  };

  const openTestMap = () => {
    navigate("/test-map", {
      state: {
        child: selectedChild,
        fromGameMenu: true,
        todayKey,
      },
    });
  };

  useEffect(() => {
    return () => {
      if (lockedHintTimeoutRef.current) {
        window.clearTimeout(lockedHintTimeoutRef.current);
      }
    };
  }, []);

  const handleTrainingStageClick = (stage) => {
    const stageIndex = dailyTrainingStages.findIndex((item) => item.stageId === stage.stageId);
    const previousStagePassed =
      stageIndex <= 0 ||
      dailyTrainingStages
        .slice(0, stageIndex)
        .every((item) => stageStateMap[item.stageId]?.completed);
    const stageState = stageStateMap[stage.stageId];

    if (!isTestUnlockEnabled && (!stageState?.unlocked || !previousStagePassed)) {
      setLockedHintStageId(stage.stageId);

      if (lockedHintTimeoutRef.current) {
        window.clearTimeout(lockedHintTimeoutRef.current);
      }

      lockedHintTimeoutRef.current = window.setTimeout(() => {
        setLockedHintStageId((current) => (current === stage.stageId ? null : current));
        lockedHintTimeoutRef.current = null;
      }, 720);
      return;
    }

    navigate(`${stage.trainPath}?level=${stage.level}&stage=${stage.stageId}`, {
      state: {
        child: selectedChild,
        currentChild: selectedChild,
        childId: selectedChild?.childId || selectedChild?.id || null,
        trainingLevel: stage.level,
        trainingStageId: stage.stageId,
        trainingOrder: stage.globalOrder,
        trainingTotal: dailyTrainingStages.length,
        trainingGameId: stage.id,
        trainingAbility: stage.ability,
        abilityLabel: stage.abilityLabel,
        difficultyLabel: stage.difficultyLabel,
        recommendationScore: stage.recommendationScore ?? null,
        recommendationResultCount: stage.resultCount ?? 0,
        trainingPlanSource: stage.source || "rotation",
        todayKey,
        trainingMinutes,
        trainingMenuSessionId,
        trainingSettings,
        temporaryTestUnlock: isTestUnlockEnabled,
        selectedTrainingGameIds: selectedTrainingGames.map((game) => game.id),
        dailyTrainingPlan: dailyTrainingStages.map((item) => ({
          stageId: item.stageId,
          gameId: item.id,
          title: item.title,
          level: item.level,
          trainPath: item.trainPath,
          ability: item.ability,
          recommendationScore: item.recommendationScore ?? null,
          resultCount: item.resultCount ?? 0,
          source: item.source || "rotation",
        })),
      },
    });
  };

  return (
    <main className="game-menu-page training-map-page-v2">
      <style>{`
        html,
        body,
        #root {
          width: 100%;
          min-height: 100%;
          margin: 0;
        }

        .training-map-page-v2 {
          width: 100vw;
          height: 100vh;
          min-height: 100vh;
          overflow: hidden;
          font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
          color: #4a3017;
          background: #8fd8f5;
        }

        .training-stage-bg {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background-image: var(--game-map-bg);
          background-size: cover;
          background-position: center center;
          background-repeat: no-repeat;
          isolation: isolate;
        }

        .training-stage-bg::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(42, 101, 47, 0.06));
          pointer-events: none;
        }

        .temporary-test-unlock-badge {
          position: fixed;
          left: 50%;
          bottom: 14px;
          z-index: 50;
          transform: translateX(-50%);
          padding: 8px 16px;
          border: 2px solid rgba(255, 255, 255, 0.9);
          border-radius: 999px;
          background: rgba(176, 45, 45, 0.92);
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          box-shadow: 0 6px 16px rgba(58, 30, 20, 0.24);
          pointer-events: none;
        }

        .training-map-layout {
          position: fixed;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }

        .map-home-button,
        .map-player-button,
        .map-setting-button,
        .map-story-button,
        .medical-reminder-card,
        .map-bottom-button,
        .badge-panel-button,
        .training-stage-node {
          pointer-events: auto;
        }

        .map-home-button {
          position: absolute;
          left: max(22px, env(safe-area-inset-left));
          top: max(18px, env(safe-area-inset-top));
          z-index: 20;
          width: clamp(74px, 5.5vw, 98px);
          height: clamp(74px, 5.5vw, 98px);
          border: 6px solid #f8d577;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #fff8d7 0%, #ffe7a2 58%, #efbf56 100%);
          color: #9a5f11;
          font-size: clamp(2.1rem, 3vw, 3rem);
          box-shadow: inset 0 -7px 0 rgba(143, 85, 16, 0.18), 0 10px 20px rgba(68, 79, 38, 0.24);
          cursor: pointer;
        }

        .map-top-progress {
          position: absolute;
          top: max(22px, env(safe-area-inset-top));
          left: 50%;
          z-index: 18;
          width: min(640px, 36vw);
          height: clamp(76px, 5.8vw, 104px);
          padding: 12px 28px;
          display: grid;
          grid-template-columns: clamp(58px, 4.5vw, 78px) 1fr clamp(58px, 4.5vw, 78px);
          align-items: center;
          gap: 18px;
          border: 5px solid rgba(255, 240, 174, 0.98);
          border-radius: 34px;
          background: linear-gradient(180deg, rgba(255, 251, 222, 0.97), rgba(255, 225, 151, 0.94));
          box-shadow: inset 0 -6px 0 rgba(151, 96, 24, 0.12), 0 12px 22px rgba(55, 78, 42, 0.18);
          transform: translateX(-50%);
          pointer-events: auto;
        }

        .map-progress-star,
        .map-progress-gift {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 5px 5px rgba(116, 73, 17, 0.2));
        }

        .map-progress-gift {
          font-size: clamp(2.4rem, 3.6vw, 4rem);
          display: grid;
          place-items: center;
        }

        .map-progress-track {
          height: clamp(30px, 2.4vw, 42px);
          padding: 4px;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffe19c, #a45e1b);
          box-shadow: inset 0 3px 6px rgba(72, 42, 10, 0.32), 0 3px 0 rgba(255, 255, 255, 0.62);
          overflow: hidden;
          position: relative;
        }

        .map-progress-fill {
          position: absolute;
          inset: 4px auto 4px 4px;
          width: var(--star-progress);
          border-radius: 999px;
          background: linear-gradient(180deg, #fff07b, #f6be26 52%, #c47a20);
          box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.45), inset 0 -4px 0 rgba(104, 56, 13, 0.15);
          transition: width 0.3s ease;
        }

        .map-progress-text {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          font-size: clamp(1.1rem, 1.6vw, 1.65rem);
          font-weight: 1000;
          color: #fff8d4;
          text-shadow: -2px 0 #7e4b19, 0 2px #7e4b19, 2px 0 #7e4b19, 0 -2px #7e4b19;
          letter-spacing: 1px;
        }

        .map-title-board {
          position: absolute;
          top: clamp(122px, 11vw, 170px);
          left: 50%;
          z-index: 13;
          width: min(590px, 34vw);
          text-align: center;
          transform: translateX(-50%);
          pointer-events: none;
        }

        .map-title-wood {
          min-height: clamp(58px, 4.8vw, 82px);
          display: grid;
          place-items: center;
          border: 5px solid rgba(132, 82, 31, 0.28);
          border-radius: 18px;
          background:
            radial-gradient(circle at 8% 18%, rgba(76, 137, 33, 0.95) 0 9px, transparent 10px),
            radial-gradient(circle at 92% 18%, rgba(76, 137, 33, 0.95) 0 9px, transparent 10px),
            linear-gradient(180deg, #c8842c 0%, #a45e1d 52%, #7b4319 100%);
          box-shadow: inset 0 4px 0 rgba(255, 214, 129, 0.38), inset 0 -5px 0 rgba(82, 43, 17, 0.22), 0 10px 16px rgba(50, 69, 35, 0.2);
        }

        .map-title-wood h1 {
          margin: 0;
          color: #fffdf0;
          font-size: clamp(2rem, 3vw, 3.2rem);
          font-weight: 1000;
          letter-spacing: 0.06em;
          text-shadow: -3px 0 #7d4516, 0 3px #7d4516, 3px 0 #7d4516, 0 -3px #7d4516, 0 6px 0 rgba(104, 54, 14, 0.25);
        }

        .map-title-subtitle {
          margin: -4px auto 0;
          width: 88%;
          padding: 12px 18px 16px;
          border-radius: 0 0 28px 28px;
          background: rgba(255, 242, 201, 0.94);
          color: #8b4c18;
          font-size: clamp(1rem, 1.35vw, 1.35rem);
          font-weight: 950;
          box-shadow: inset 0 -5px 0 rgba(135, 80, 20, 0.1), 0 8px 14px rgba(64, 67, 37, 0.14);
        }

        .map-player-button {
          position: absolute;
          right: max(24px, env(safe-area-inset-right));
          top: max(22px, env(safe-area-inset-top));
          z-index: 20;
          min-width: clamp(180px, 14vw, 260px);
          height: clamp(66px, 5.2vw, 90px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 8px 18px 8px 12px;
          border: 5px solid #f6d071;
          border-radius: 999px;
          background: linear-gradient(180deg, #fff8d8, #ffd98a);
          box-shadow: inset 0 -6px 0 rgba(137, 80, 18, 0.14), 0 10px 18px rgba(53, 72, 42, 0.2);
          color: #7b4317;
          cursor: pointer;
        }

        .map-player-avatar {
          width: clamp(46px, 3.7vw, 64px);
          height: clamp(46px, 3.7vw, 64px);
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #fff0a4;
          overflow: hidden;
          box-shadow: inset 0 -4px 0 rgba(146, 86, 18, 0.14);
        }

        .map-player-avatar img {
          width: 92%;
          height: 92%;
          object-fit: contain;
        }

        .map-player-name {
          flex: 1;
          min-width: 0;
          font-size: clamp(1.05rem, 1.4vw, 1.45rem);
          font-weight: 1000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .map-player-caret {
          font-size: 1.5rem;
          color: #a65d13;
        }



        .map-setting-button {
          position: absolute;
          right: max(34px, env(safe-area-inset-right));
          top: clamp(116px, 9vw, 132px);
          z-index: 19;
          width: clamp(72px, 5.2vw, 96px);
          min-height: clamp(72px, 5.2vw, 96px);
          border: 5px solid #f7d677;
          border-radius: 28px;
          display: grid;
          place-items: center;
          gap: 2px;
          background: linear-gradient(180deg, #fff9d8, #ffd98b);
          color: #754719;
          font-weight: 1000;
          box-shadow: inset 0 -6px 0 rgba(137, 80, 18, 0.14), 0 10px 18px rgba(53, 72, 42, 0.2);
          cursor: pointer;
        }

        .map-setting-button span:first-child {
          font-size: clamp(1.9rem, 2.5vw, 2.7rem);
          line-height: 1;
        }

        .map-setting-button span:last-child {
          font-size: clamp(0.82rem, 0.95vw, 1rem);
        }

        .profile-modal-card {
          width: min(90vw, 520px);
          padding: 30px;
          border: 6px solid #f6d071;
          border-radius: 34px;
          background: linear-gradient(180deg, rgba(255, 250, 224, 0.98), rgba(255, 229, 167, 0.98));
          color: #6f3f16;
          box-shadow: inset 0 -8px 0 rgba(137, 80, 18, 0.12), 0 24px 60px rgba(85, 60, 20, 0.28);
          position: relative;
          text-align: center;
        }

        .profile-modal-avatar {
          width: 112px;
          height: 112px;
          margin: 0 auto 12px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #fff0a4;
          box-shadow: inset 0 -6px 0 rgba(146, 86, 18, 0.14), 0 10px 18px rgba(86, 64, 28, 0.18);
          overflow: hidden;
        }

        .profile-modal-avatar img {
          width: 92%;
          height: 92%;
          object-fit: contain;
        }

        .profile-modal-card h2 {
          margin: 0 0 8px;
          font-size: clamp(1.8rem, 2.8vw, 2.5rem);
          font-weight: 1000;
        }

        .profile-modal-name {
          margin: 0 0 18px;
          font-size: clamp(1.35rem, 2vw, 1.8rem);
          font-weight: 1000;
          color: #8a4e19;
        }

        .profile-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 18px;
        }

        .profile-stat-card {
          padding: 14px 10px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.58);
          box-shadow: inset 0 -4px 0 rgba(137, 80, 18, 0.08);
        }

        .profile-stat-card strong {
          display: block;
          font-size: 1.45rem;
          color: #fff;
          text-shadow: -2px 0 #8b5518, 0 2px #8b5518, 2px 0 #8b5518, 0 -2px #8b5518;
        }

        .profile-stat-card span {
          display: block;
          margin-top: 4px;
          font-weight: 900;
        }

        .map-story-button {
          position: absolute;
          right: max(34px, env(safe-area-inset-right));
          top: clamp(218px, 15vw, 244px);
          z-index: 17;
          width: clamp(78px, 5.5vw, 104px);
          min-height: clamp(78px, 5.5vw, 104px);
          border: 5px solid #f7d677;
          border-radius: 30px;
          display: grid;
          place-items: center;
          gap: 2px;
          background: linear-gradient(180deg, #fff9d8, #ffd98b);
          color: #754719;
          font-weight: 1000;
          box-shadow: inset 0 -6px 0 rgba(137, 80, 18, 0.14), 0 10px 18px rgba(53, 72, 42, 0.2);
          cursor: pointer;
        }

        .map-story-button span:first-child {
          font-size: clamp(1.8rem, 2.6vw, 2.8rem);
          line-height: 1;
        }

        .map-story-button span:last-child {
          font-size: clamp(0.86rem, 1.05vw, 1.05rem);
        }

        .medical-reminder-card {
          position: absolute;
          left: max(28px, env(safe-area-inset-left));
          top: clamp(126px, 13vh, 170px);
          z-index: 18;
          width: min(330px, 26vw);
          padding: 16px 18px;
          border: 5px solid #f6d071;
          border-radius: 26px;
          background: linear-gradient(180deg, rgba(255, 250, 224, 0.97), rgba(255, 225, 151, 0.95));
          color: #704018;
          box-shadow: inset 0 -6px 0 rgba(137, 80, 18, 0.12), 0 12px 22px rgba(55, 78, 42, 0.2);
          text-align: left;
          cursor: pointer;
        }

        .medical-reminder-card h2 {
          margin: 0 0 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: clamp(1.05rem, 1.35vw, 1.4rem);
          font-weight: 1000;
        }

        .medical-reminder-badge {
          min-width: 28px;
          height: 28px;
          padding: 0 8px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          background: #e45c3f;
          color: #fff;
          font-size: 0.95rem;
          box-shadow: 0 4px 8px rgba(109, 53, 20, 0.18);
        }

        .medical-reminder-empty,
        .medical-reminder-error {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.45;
          font-weight: 800;
        }

        .medical-reminder-error {
          color: #a2472e;
        }

        .medical-reminder-preview {
          display: grid;
          gap: 7px;
        }

        .medical-reminder-preview-item {
          min-width: 0;
          padding: 8px 10px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.58);
          box-shadow: inset 0 -3px 0 rgba(137, 80, 18, 0.08);
        }

        .medical-reminder-preview-item strong {
          display: block;
          font-size: 0.95rem;
          font-weight: 1000;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .medical-reminder-preview-item span {
          display: block;
          margin-top: 3px;
          font-size: 0.82rem;
          font-weight: 800;
          color: #8c5a26;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .medical-reminder-modal-card {
          width: min(92vw, 660px);
          max-height: 82vh;
          overflow: auto;
          padding: 30px;
          border: 6px solid #f6d071;
          border-radius: 34px;
          background: linear-gradient(180deg, rgba(255, 250, 224, 0.98), rgba(255, 229, 167, 0.98));
          color: #6f3f16;
          box-shadow: inset 0 -8px 0 rgba(137, 80, 18, 0.12), 0 24px 60px rgba(85, 60, 20, 0.28);
          position: relative;
        }

        .medical-reminder-modal-card h2 {
          margin: 0 0 16px;
          text-align: center;
          font-size: clamp(1.8rem, 2.8vw, 2.5rem);
          font-weight: 1000;
        }

        .medical-reminder-list {
          display: grid;
          gap: 14px;
        }

        .medical-reminder-list-item {
          padding: 16px 18px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.62);
          box-shadow: inset 0 -4px 0 rgba(137, 80, 18, 0.08);
        }

        .medical-reminder-list-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
          font-weight: 1000;
        }

        .medical-reminder-list-message {
          margin: 0;
          color: #704018;
          font-size: 1rem;
          font-weight: 800;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .medical-reminder-list-meta {
          margin-top: 10px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #8c5a26;
          font-size: 0.9rem;
          font-weight: 900;
        }

        .map-sign-board {
          position: absolute;
          right: 16%;
          top: 43%;
          z-index: 6;
          padding: 14px 34px;
          border-radius: 8px;
          background: linear-gradient(180deg, #e7b564, #c78536);
          color: #5b3212;
          font-size: clamp(1rem, 1.25vw, 1.35rem);
          font-weight: 1000;
          transform: rotate(-4deg);
          box-shadow: inset 0 4px 0 rgba(255, 222, 149, 0.35), inset 0 -4px 0 rgba(91, 45, 12, 0.18), 0 8px 12px rgba(51, 68, 37, 0.22);
          pointer-events: none;
        }

        .map-carrot-bubble {
          position: absolute;
          left: 57%;
          top: 38%;
          z-index: 8;
          width: clamp(96px, 7vw, 140px);
          height: clamp(70px, 5.1vw, 100px);
          display: grid;
          place-items: center;
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 8px 16px rgba(66, 82, 49, 0.18);
          pointer-events: none;
        }

        .map-carrot-bubble::after {
          content: "";
          position: absolute;
          left: 22px;
          bottom: -12px;
          border-width: 14px 12px 0 0;
          border-style: solid;
          border-color: rgba(255, 255, 255, 0.92) transparent transparent transparent;
        }

        .map-carrot-bubble span {
          font-size: clamp(2.4rem, 3.6vw, 4.2rem);
        }

        .training-route-svg {
          position: absolute;
          inset: 0;
          z-index: 2;
          width: 100%;
          height: 100%;
          pointer-events: none;
          filter: drop-shadow(0 6px 6px rgba(74, 65, 38, 0.18));
        }

        .training-route-shadow,
        .training-route-main,
        .training-route-leaves {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .training-route-shadow {
          stroke: rgba(75, 51, 28, 0.34);
          stroke-width: 6;
          stroke-dasharray: 1 5;
        }

        .training-route-main {
          stroke: rgba(236, 185, 93, 0.74);
          stroke-width: 4;
          stroke-dasharray: 1 5;
        }

        .training-route-leaves {
          display: none;
        }

        .training-stage-node {
          position: absolute;
          left: var(--node-x);
          top: var(--node-y);
          z-index: 10;
          width: clamp(118px, 8.2vw, 164px);
          min-height: clamp(142px, 9.2vw, 182px);
          transform: translate(-50%, -50%);
          border: 0;
          background: transparent;
          cursor: pointer;
          display: grid;
          justify-items: center;
          align-content: start;
          padding: 0;
          transition: transform 0.16s ease, filter 0.16s ease;
        }

        .training-stage-node:hover,
        .training-stage-node:focus-visible {
          transform: translate(-50%, -50%) scale(1.045);
          outline: none;
          filter: drop-shadow(0 0 14px rgba(255, 233, 90, 0.55));
        }

        .training-stage-node.is-locked {
          cursor: not-allowed;
        }

        .training-stage-node.is-shaking .training-stage-paw {
          animation: lockedShake 0.42s ease-in-out;
        }

        .training-stage-paw-wrap {
          position: relative;
          width: clamp(108px, 7.4vw, 150px);
          height: clamp(92px, 6.2vw, 126px);
          display: grid;
          place-items: center;
        }

        .training-stage-paw {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 9px 8px rgba(70, 76, 43, 0.24));
          user-select: none;
          pointer-events: none;
        }

        .training-stage-number {
          position: absolute;
          left: 50%;
          top: 55%;
          transform: translate(-50%, -50%);
          z-index: 2;
          color: #ffffff;
          font-size: clamp(2.5rem, 3.2vw, 4rem);
          font-weight: 1000;
          line-height: 1;
          text-shadow: -3px 0 rgba(62, 62, 49, 0.55), 0 3px rgba(62, 62, 49, 0.55), 3px 0 rgba(62, 62, 49, 0.55), 0 -3px rgba(62, 62, 49, 0.55), 0 5px 0 rgba(80, 54, 22, 0.18);
        }

        .training-stage-node.is-active .training-stage-number {
          color: #fff9dc;
          text-shadow: -3px 0 #9b6818, 0 3px #9b6818, 3px 0 #9b6818, 0 -3px #9b6818, 0 5px 0 rgba(111, 65, 12, 0.22);
        }

        .training-stage-stars {
          margin-top: -2px;
          min-height: 42px;
          display: flex;
          justify-content: center;
          gap: 7px;
        }

        .training-stage-stars img {
          width: clamp(36px, 2.6vw, 50px);
          height: clamp(36px, 2.6vw, 50px);
          object-fit: contain;
          filter: drop-shadow(0 4px 3px rgba(73, 62, 32, 0.24));
        }

        .training-stage-stars .empty-star {
          filter: grayscale(1) opacity(0.62) drop-shadow(0 3px 2px rgba(73, 62, 32, 0.18));
        }

        .training-stage-node.is-completed .training-stage-stars {
          animation: trainingStarPop 0.36s ease-out both;
        }

        .map-mouse-guide {
          position: absolute;
          left: var(--mouse-x);
          top: var(--mouse-y);
          z-index: 14;
          width: clamp(58px, 4.2vw, 82px);
          height: auto;
          transform: translate(24px, -108px) rotate(-12deg);
          filter: drop-shadow(0 9px 8px rgba(50, 43, 28, 0.28));
          pointer-events: none;
          animation: mouseGuideTap 1.15s ease-in-out infinite;
        }

        .training-stage-lock {
          position: absolute;
          left: 50%;
          bottom: -6px;
          z-index: 4;
          transform: translateX(-50%);
          font-size: clamp(1.3rem, 2vw, 2rem);
          filter: drop-shadow(0 4px 3px rgba(58, 53, 39, 0.25));
        }

        .current-stage-companion,
        .training-helper-card,
        .training-left-panel,
        .training-profile-card,
        .training-badge-card,
        .training-right-tools,
        .honey-progress-card {
          display: none !important;
        }

        .map-bottom-nav {
          position: absolute;
          left: max(60px, env(safe-area-inset-left));
          bottom: max(22px, env(safe-area-inset-bottom));
          z-index: 18;
          display: flex;
          gap: clamp(18px, 2vw, 34px);
          pointer-events: auto;
        }

        .map-bottom-button {
          width: clamp(140px, 10vw, 190px);
          min-height: clamp(78px, 5.6vw, 104px);
          display: grid;
          place-items: center;
          gap: 2px;
          padding: 8px 18px;
          border: 5px solid #f6d071;
          border-radius: 28px;
          background: linear-gradient(180deg, #fff9da, #ffe1a0);
          color: #7d4618;
          font-size: clamp(1rem, 1.25vw, 1.3rem);
          font-weight: 1000;
          box-shadow: inset 0 -7px 0 rgba(137, 80, 18, 0.13), 0 10px 18px rgba(47, 70, 42, 0.22);
          cursor: pointer;
        }

        .map-bottom-button span:first-child {
          font-size: clamp(2rem, 2.9vw, 3.2rem);
          line-height: 1;
        }

        .map-bottom-button.avatar-room-menu-button {
          width: clamp(140px, 10vw, 190px);
          padding: 6px 12px;
        }

        .avatar-room-menu-icon {
          width: clamp(88px, 6.4vw, 122px);
          height: clamp(88px, 6.4vw, 122px);
          object-fit: contain;
          display: block;
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
        }

        .homey-menu-icon {
          width: clamp(88px, 6.4vw, 122px);
          height: clamp(88px, 6.4vw, 122px);
          object-fit: contain;
          filter: drop-shadow(0 7px 7px rgba(64, 46, 20, 0.2));
          user-select: none;
          pointer-events: none;
        }

        .story-homey-icon {
          width: clamp(86px, 6.1vw, 118px);
          height: clamp(86px, 6.1vw, 118px);
        }

        .bottom-homey-icon {
          width: clamp(104px, 7.6vw, 148px);
          height: clamp(104px, 7.6vw, 148px);
        }

        .map-treasure-card {
          position: absolute;
          right: max(34px, env(safe-area-inset-right));
          bottom: max(24px, env(safe-area-inset-bottom));
          z-index: 18;
          min-width: clamp(300px, 18vw, 390px);
          min-height: clamp(82px, 6vw, 112px);
          display: grid;
          grid-template-columns: clamp(92px, 6.5vw, 128px) 1fr;
          align-items: center;
          gap: 16px;
          padding: 8px 22px 8px 14px;
          border: 5px solid #f3c766;
          border-radius: 28px;
          background: linear-gradient(180deg, #ffeba7, #e8ad58);
          color: #714018;
          box-shadow: inset 0 -7px 0 rgba(137, 80, 18, 0.13), 0 10px 18px rgba(47, 70, 42, 0.22);
          cursor: pointer;
        }

        .map-treasure-chest {
          font-size: clamp(3rem, 5vw, 5.2rem);
          line-height: 1;
          filter: drop-shadow(0 8px 6px rgba(70, 58, 35, 0.22));
        }

        .map-treasure-text strong {
          display: block;
          font-size: clamp(1.15rem, 1.45vw, 1.55rem);
          font-weight: 1000;
        }

        .map-treasure-count {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 3px;
          font-size: clamp(1.25rem, 1.8vw, 1.9rem);
          font-weight: 1000;
          color: #ffffff;
          text-shadow: -2px 0 #8b5518, 0 2px #8b5518, 2px 0 #8b5518, 0 -2px #8b5518;
        }

        .map-treasure-count img {
          width: clamp(34px, 2.4vw, 46px);
          height: clamp(34px, 2.4vw, 46px);
          object-fit: contain;
        }


        /* homey icon borderless override */
        .map-story-button,
        .map-bottom-button {
          border: 0;
          background: transparent;
          box-shadow: none;
          padding: 0;
          border-radius: 0;
          min-height: auto;
          width: auto;
          display: grid;
          place-items: center;
        }

        .map-story-button {
          width: clamp(94px, 6.8vw, 130px);
          min-height: clamp(94px, 6.8vw, 130px);
        }

        .map-bottom-button {
          width: clamp(116px, 8.2vw, 160px);
          min-height: clamp(116px, 8.2vw, 160px);
        }

        .map-story-button:hover,
        .map-story-button:focus-visible,
        .map-bottom-button:hover,
        .map-bottom-button:focus-visible {
          transform: scale(1.06);
          outline: none;
          filter: drop-shadow(0 8px 12px rgba(72, 58, 26, 0.18));
        }

        @keyframes trainingStarPop {
          0% { transform: scale(0.72); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes lockedShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }

        @keyframes mouseGuideTap {
          0%, 100% { transform: translate(24px, -108px) rotate(-12deg) scale(1); }
          50% { transform: translate(8px, -88px) rotate(-12deg) scale(0.94); }
        }

        @media (max-width: 1180px), (max-height: 760px) {
          .map-title-board { top: 118px; width: min(500px, 38vw); }
          .map-title-wood h1 { font-size: clamp(1.7rem, 2.6vw, 2.6rem); }
          .map-title-subtitle { font-size: 0.98rem; padding: 9px 12px 12px; }
          .training-stage-node { width: clamp(96px, 7.4vw, 132px); min-height: 132px; }
          .training-stage-paw-wrap { width: clamp(92px, 6.8vw, 124px); height: clamp(78px, 5.8vw, 104px); }
          .training-stage-number { font-size: clamp(2rem, 2.8vw, 3.2rem); }
          .training-stage-stars img { width: 34px; height: 34px; }
        }

        @media (max-width: 900px) {
          .training-map-layout { overflow: hidden; }
          .map-top-progress { width: min(470px, 54vw); left: 52%; }
          .map-title-board { width: min(430px, 52vw); }
          .map-player-button { min-width: 140px; }
          .map-player-name { max-width: 90px; }
          .map-setting-button { top: 92px; right: 18px; }
          .map-story-button { top: 174px; }
          .medical-reminder-card { top: 154px; left: 14px; width: min(270px, 36vw); padding: 12px 14px; }
          .map-bottom-nav { left: 14px; gap: 10px; }
          .map-bottom-button { width: 96px; min-height: 74px; border-radius: 20px; font-size: 0.86rem; }
          .map-treasure-card { min-width: 210px; grid-template-columns: 72px 1fr; }
        }

        @media (max-width: 640px) {
          .map-home-button { width: 58px; height: 58px; border-width: 4px; font-size: 1.8rem; }
          .map-top-progress { top: 12px; left: 58%; width: 54vw; height: 58px; padding: 7px 12px; grid-template-columns: 38px 1fr 38px; gap: 8px; border-radius: 22px; }
          .map-progress-track { height: 28px; }
          .map-title-board { top: 82px; width: 62vw; }
          .map-title-wood { min-height: 46px; border-radius: 14px; }
          .map-title-wood h1 { font-size: 1.25rem; }
          .map-title-subtitle { width: 92%; font-size: 0.76rem; padding: 7px 8px 9px; }
          .map-player-button { right: 8px; top: 12px; min-width: 92px; height: 54px; padding: 6px; border-width: 4px; }
          .map-player-avatar { width: 38px; height: 38px; }
          .map-player-name { display: none; }
          .map-setting-button { right: 10px; top: 74px; width: 58px; min-height: 58px; border-radius: 18px; border-width: 4px; }
          .map-setting-button span:last-child { display: none; }
          .map-story-button { right: 10px; top: 136px; width: 58px; min-height: 58px; border-radius: 18px; }
          .map-story-button span:last-child { display: none; }
          .medical-reminder-card { left: 10px; top: auto; bottom: 112px; width: min(270px, 68vw); padding: 10px 12px; border-width: 4px; }
          .medical-reminder-card h2 { font-size: 0.95rem; margin-bottom: 5px; }
          .medical-reminder-preview-item { display: none; }
        }


        @media (max-width: 900px) {
          .map-bottom-button {
            width: clamp(92px, 13vw, 124px);
            min-height: clamp(92px, 13vw, 124px);
            border: 0;
            background: transparent;
            box-shadow: none;
            padding: 0;
          }

          .bottom-homey-icon {
            width: clamp(88px, 12vw, 116px);
            height: clamp(88px, 12vw, 116px);
          }
        }

        @media (max-width: 640px) {
          .map-story-button {
            width: 78px;
            min-height: 78px;
            border: 0;
            background: transparent;
            box-shadow: none;
            padding: 0;
          }

          .story-homey-icon {
            width: 76px;
            height: 76px;
          }

          .map-bottom-button {
            width: 82px;
            min-height: 82px;
            border: 0;
            background: transparent;
            box-shadow: none;
            padding: 0;
          }

          .bottom-homey-icon {
            width: 80px;
            height: 80px;
          }
        }

      `}</style>

      <section
        className="training-stage-bg"
        style={{ "--game-map-bg": `url(${gameMapBackground})` }}
        aria-label={`森林訓練地圖，第 ${currentPageIndex + 1} 頁，${selectedTrainingLabel}，今日練習 ${formatTrainingDuration(todayTrainingSeconds)}，蜂蜜任務 ${honeyProgress.totalStars} 顆星`}
      >
        {isTestUnlockEnabled && <div className="temporary-test-unlock-badge">測試解鎖中</div>}
        <div className="training-map-layout">
          <svg className="training-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="training-route-shadow" d={routePath} />
            <path className="training-route-main" d={routePath} />
            <path className="training-route-leaves" d={routePath} />
          </svg>

          <button
            type="button"
            className="map-home-button"
            onClick={() => navigate("/mode-select")}
            aria-label="回首頁"
          >
            🏠
          </button>

          <section className="map-top-progress" aria-label="蜂巢收集進度">
            <img width={512} height={512} className="map-progress-star" src={honeycombAsset} alt="蜂巢" />
            <div className="map-progress-track" role="progressbar" aria-valuenow={earnedStarsTotal} aria-valuemin="0" aria-valuemax={maxStarsTotal}>
              <div className="map-progress-fill" style={{ "--star-progress": `${Math.min(100, Math.round((earnedStarsTotal / maxStarsTotal) * 100))}%` }} />
              <span className="map-progress-text">{earnedStarsTotal} / {maxStarsTotal}</span>
            </div>
            <img width={476} height={472} loading="lazy" className="map-progress-gift" src={honeyAsset} alt="蜂蜜" />
          </section>

          <button type="button" className="map-player-button" onClick={() => setShowProfilePanel(true)} aria-label="開啟個人資料">
            <span className="map-player-avatar" aria-hidden="true">
              <img width={512} height={512} loading="lazy" src={chickenAvatar} alt="" />
            </span>
            <span className="map-player-name">{userProfileName}</span>
            <span className="map-player-caret" aria-hidden="true">›</span>
          </button>

          <button type="button" className="map-setting-button" onClick={() => navigate("/settings")} aria-label="開啟設定">
            <span aria-hidden="true">⚙️</span>
            <span>設定</span>
          </button>

          <button type="button" className="map-story-button" onClick={() => setShowStoryVideo(true)} aria-label="播放故事影片">
            <img width={1024} height={1024} loading="lazy" className="homey-menu-icon story-homey-icon" src={storyIcon} alt="" aria-hidden="true" />
          </button>

          {visibleDailyStages.map((stage) => {
            const stageState = stageStateMap[stage.stageId] || {};
            const stateClass = stageState.completed
              ? "is-completed"
              : stageState.active
                ? "is-active"
                : "is-locked";

            const starCount = clampStarCount(stageState.stars);
            const pawAsset = stageState.completed ? pawDoneAsset : stageState.active ? pawActiveAsset : pawLockedAsset;

            return (
              <button
                key={stage.stageId}
                type="button"
                className={`training-stage-node ${stateClass} ${lockedHintStageId === stage.stageId ? "is-shaking" : ""}`}
                onClick={() => handleTrainingStageClick(stage)}
                aria-label={`${stage.title} 第 ${stage.level} 關，${stageState.unlocked ? "進入訓練" : "尚未解鎖"}${starCount > 0 ? `，已得到 ${starCount} 顆星` : ""}`}
                style={{ "--node-x": `${stage.mapX}%`, "--node-y": `${stage.mapY}%` }}
              >
                <span className="training-stage-paw-wrap">
                  <img loading="lazy" className="training-stage-paw" src={pawAsset} alt="" />
                  <span className="training-stage-number" aria-hidden="true">{stage.globalOrder}</span>
                  {!stageState.unlocked && <span className="training-stage-lock" aria-hidden="true">🔒</span>}
                </span>
                <span className="training-stage-stars" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <img width={512} height={512} loading="lazy"
                      key={`${stage.stageId}-star-${index}`}
                      src={starAsset}
                      alt=""
                      className={index < starCount ? "" : "empty-star"}
                    />
                  ))}
                </span>
              </button>
            );
          })}

          {currentStage && stageStateMap[currentStage.stageId]?.active && visibleDailyStages.some((stage) => stage.stageId === currentStage.stageId) && (
            <img width={1024} height={1024} loading="lazy"
              className="map-mouse-guide"
              src={mousePointer}
              alt=""
              aria-hidden="true"
              style={{
                "--mouse-x": `${visibleDailyStages.find((stage) => stage.stageId === currentStage.stageId)?.mapX || currentStage.mapX}%`,
                "--mouse-y": `${visibleDailyStages.find((stage) => stage.stageId === currentStage.stageId)?.mapY || currentStage.mapY}%`,
              }}
            />
          )}

          <nav className="map-bottom-nav" aria-label="地圖功能">
            <button type="button" className="map-bottom-button" onClick={openTestMap} aria-label="進入測驗">
              <img width={1024} height={1024} loading="lazy" className="homey-menu-icon bottom-homey-icon" src={testIcon} alt="" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="map-bottom-button"
              onClick={() => navigate("/achievement")}
              aria-label="查看成就"
            >
              <img width={1024} height={1024} loading="lazy" className="homey-menu-icon bottom-homey-icon" src={goalIcon} alt="" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="map-bottom-button avatar-room-menu-button"
              onClick={() => navigate("/avatar-room", { state: { from: "/game-menu" } })}
              aria-label="進入角色小屋"
            >
              <img width={500} height={500} loading="lazy" className="avatar-room-menu-icon" src={avatarHomeImg} alt="" aria-hidden="true" draggable={false} />
            </button>
          </nav>
        </div>      </section>

      {showCompletionVideo && (
        <div className="modal-backdrop completion-video-backdrop">
          <section
            className="completion-video-panel"
            aria-label="今日訓練完成影片"
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "relative",
              width: "min(86vw, 920px)",
              maxHeight: "86vh",
              padding: "22px",
              borderRadius: "28px",
              background: "rgba(255, 250, 228, 0.96)",
              boxShadow: "0 24px 60px rgba(85, 60, 20, 0.28)",
            }}
          >
            <button
              type="button"
              className="modal-close"
              onClick={closeCompletionVideo}
              aria-label="關閉完成影片"
            >
              ×
            </button>
            <video
              className="completion-video"
              src={completionVideo}
              autoPlay
              controls
              playsInline
              onEnded={closeCompletionVideo}
              style={{
                display: "block",
                width: "100%",
                maxHeight: "76vh",
                borderRadius: "20px",
                objectFit: "contain",
                background: "#000",
              }}
            />
          </section>
        </div>
      )}

      {showStoryVideo && (
        <div className="modal-backdrop completion-video-backdrop" onClick={closeStoryVideo}>
          <section
            className="completion-video-panel"
            aria-label="故事影片"
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "relative",
              width: "min(86vw, 920px)",
              maxHeight: "86vh",
              padding: "22px",
              borderRadius: "28px",
              background: "rgba(255, 250, 228, 0.96)",
              boxShadow: "0 24px 60px rgba(85, 60, 20, 0.28)",
            }}
          >
            <button type="button" className="modal-close" onClick={closeStoryVideo} aria-label="關閉故事影片">
              ×
            </button>
            <video
              className="completion-video"
              src={completionVideo}
              autoPlay
              controls
              playsInline
              onEnded={closeStoryVideo}
              style={{
                display: "block",
                width: "100%",
                maxHeight: "76vh",
                borderRadius: "20px",
                objectFit: "contain",
                background: "#000",
              }}
            />
          </section>
        </div>
      )}

      {showProfilePanel && (
        <div className="modal-backdrop" onClick={() => setShowProfilePanel(false)}>
          <section className="profile-modal-card" onClick={(event) => event.stopPropagation()} aria-label="個人資料">
            <button type="button" className="modal-close" onClick={() => setShowProfilePanel(false)} aria-label="關閉個人資料">
              ×
            </button>
            <div className="profile-modal-avatar" aria-hidden="true">
              <img width={512} height={512} loading="lazy" src={chickenAvatar} alt="" />
            </div>
            <h2>個人資料</h2>
            <p className="profile-modal-name">{userProfileName}</p>
            <div className="profile-stat-grid" aria-label="今日進度">
              <div className="profile-stat-card">
                <strong>{earnedStarsTotal}</strong>
                <span>今日星星</span>
              </div>
              <div className="profile-stat-card">
                <strong>{completedStageIds.length}</strong>
                <span>完成關卡</span>
              </div>
              <div className="profile-stat-card">
                <strong>{formatTrainingDuration(todayTrainingSeconds)}</strong>
                <span>練習時間</span>
              </div>
              <div className="profile-stat-card">
                <strong>{honeyProgress.round}</strong>
                <span>蜂蜜任務</span>
              </div>
            </div>
          </section>
        </div>
      )}


    </main>
  );
}

export default GameMenuPage;
