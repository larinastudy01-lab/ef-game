<<<<<<< HEAD
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../styles/GameMenuPage.css";

import gameMapBackground from "../asset/GameMap.png";
import testIcon from "../asset/test_icon.png";
import setIcon from "../asset/Set_icon.png";
import honeyIcon from "../asset/Honey.png";
import mousePointer from "../asset/mouse.png";
import profileStoneIcon from "../asset/stone.png";
import logoutTrainingIcon from "../asset/training.png";
import completionVideo from "../asset/SRT_start.mp4";

import chickenAvatar from "../asset/avatar/chicken.png";
import srtIcon from "../asset/SRT_icon.png";
import pmIcon from "../asset/PM_icon.png";
import cbtIcon from "../asset/CBT_icon.png";
import dptIcon from "../asset/DPT_icon.png";
import dccsIcon from "../asset/DCCS_icon.png";
import lbIcon from "../asset/LB_icon.png";

const COMPLETED_GAMES_STORAGE_KEY = "ef_game_completed_games";
const COMPLETED_LEVELS_STORAGE_KEY = "ef_game_completed_training_levels";
const COMPLETION_VIDEO_SEEN_KEY = "ef_game_today_training_completion_video_seen";
const DEFAULT_TRAINING_MINUTES = 15;
const MAX_LEVEL_PER_GAME = 5;
const HONEY_MISSION_STORAGE_KEY = "ef_game_honey_mission_progress";
const DAILY_TRAINING_SECONDS_STORAGE_KEY = "ef_game_today_training_seconds";

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

const FULL_ROUTE_POINTS = [
  { x: 24, y: 72 },
  { x: 33, y: 66 },
  { x: 44, y: 60 },
  { x: 56, y: 54 },
  { x: 69, y: 48 },
  { x: 82, y: 43 },
  { x: 88, y: 52 },
  { x: 80, y: 62 },
  { x: 68, y: 69 },
  { x: 55, y: 75 },
  { x: 67, y: 80 },
  { x: 80, y: 70 },
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
    text.includes("dpt")
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
  if (text.includes("dpt") || text.includes("dot") || text.includes("專注小幫手") || text.includes("小蟲")) return "dpt";
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

const getPlannedStageCount = (minutes, selectedAbilityCount, maxCount) => {
  let count = 8;

  if (minutes <= 8) count = 4;
  else if (minutes <= 12) count = 5;
  else if (minutes <= 18) count = 7;
  else if (minutes <= 24) count = 9;
  else if (minutes <= 35) count = 10;
  else count = 12;

  const minimum = Math.max(3, selectedAbilityCount * 2);
  return Math.min(Math.max(count, minimum), maxCount, FULL_ROUTE_POINTS.length);
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

const isGameCompletedFromStorage = (gameId) => {
  const completedGames = readJsonArray(COMPLETED_GAMES_STORAGE_KEY);

  return (
    completedGames.includes(gameId) ||
    localStorage.getItem(`ef_game_${gameId}_completed`) === "true" ||
    localStorage.getItem(`ef_game_${gameId}_training_completed`) === "true" ||
    localStorage.getItem(`training_${gameId}_completed`) === "true" ||
    localStorage.getItem(`${gameId}_training_completed`) === "true"
  );
};

const isTrainingStageCompletedFromStorage = (stage) => {
  const completedLevels = readJsonArray(COMPLETED_LEVELS_STORAGE_KEY);

  return (
    completedLevels.includes(stage.stageId) ||
    completedLevels.includes(`${stage.gameId}-${stage.level}`) ||
    completedLevels.includes(`${stage.todayKey}-${stage.gameId}-${stage.level}`) ||
    localStorage.getItem(`ef_game_${stage.stageId}_completed`) === "true" ||
    localStorage.getItem(`ef_game_${stage.gameId}_level_${stage.level}_completed`) === "true" ||
    localStorage.getItem(`training_${stage.gameId}_level_${stage.level}_completed`) === "true" ||
    localStorage.getItem(`${stage.gameId}_training_level_${stage.level}_completed`) === "true" ||
    isGameCompletedFromStorage(stage.gameId)
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
    `${stage.gameId}-${stage.level}`,
    `${stage.todayKey}-${stage.gameId}-${stage.level}`,
    `${stage.gameId}_L${stage.level}`,
    stage.gameId,
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
    `ef_game_${stage.gameId}_level_${stage.level}_stars`,
    `training_${stage.gameId}_level_${stage.level}_stars`,
    `${stage.gameId}_training_level_${stage.level}_stars`,
    `ef_game_${stage.gameId}_stars`,
    `${stage.gameId}_stars`,
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
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showCompletionVideo, setShowCompletionVideo] = useState(false);
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
        const displayName =
          metadata.username ||
          metadata.name ||
          metadata.full_name ||
          metadata.child_name ||
          user.email?.split("@")[0] ||
          "小冒險家";

        if (isMounted) setUserProfileName(displayName);
      } catch {
        if (isMounted) navigate("/login", { replace: true });
=======
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import bgImg from "../asset/Home_background.png";

function GameMenuPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        navigate("/login");
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
      }
    };

    checkUser();
<<<<<<< HEAD

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
      id: "dpt",
      ability: "inhibition",
      shortName: "DPT",
      title: "小蟲",
      icon: dptIcon,
      trainPath: "/training-dot-probe",
      testPath: "/test-dot-probe",
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
  const trainingSettings = useMemo(() => getTrainingSettings(location.state), [location.state, storageRefreshToken]);
  const trainingMinutes = useMemo(() => getTrainingMinutes(trainingSettings), [trainingSettings]);
  const selectedTrainingGames = useMemo(
    () => getSelectedTrainingGames(trainingSettings, trainingGames),
    [trainingGames, trainingSettings]
  );
  const selectedTrainingLabel = useMemo(() => {
    return selectedTrainingGames.map((game) => game.shortName).join("、") || "自動安排";
  }, [selectedTrainingGames]);

  const dailyTrainingStages = useMemo(() => {
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
        stageId: `${todayKey}-${stages.length + 1}-${game.id}-L${level}`,
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
  }, [selectedTrainingGames, todayKey, trainingGames, trainingMinutes]);

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
        index === 0 || completedStageIds.includes(dailyTrainingStages[index - 1].stageId);
      const unlocked = completed || previousCompleted;

      stateMap[stage.stageId] = {
        completed,
        unlocked,
        active: unlocked && !completed,
        stars: completed ? clampStarCount(stageStarMap[stage.stageId]) : 0,
      };

      return stateMap;
    }, {});
  }, [completedStageIds, dailyTrainingStages, stageStarMap]);

  const visibleRoutePoints = useMemo(
    () => dailyTrainingStages.map((stage) => ({ x: stage.mapX, y: stage.mapY })),
    [dailyTrainingStages]
  );
  const routePath = createCurvedRoutePath(visibleRoutePoints);
  const currentStage = useMemo(
    () => dailyTrainingStages.find((stage) => stageStateMap[stage.stageId]?.active) || dailyTrainingStages.find((stage) => stageStateMap[stage.stageId]?.unlocked) || dailyTrainingStages[0],
    [dailyTrainingStages, stageStateMap]
  );

  const closeCompletionVideo = () => {
    localStorage.setItem(`${COMPLETION_VIDEO_SEEN_KEY}_${todayKey}`, "true");
    setShowCompletionVideo(false);
  };

  const openParentResult = () => {
    navigate("/result-pa", {
      state: {
        fromTrainingMap: true,
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
    const stageState = stageStateMap[stage.stageId];
    if (!stageState?.unlocked) {
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
        trainingLevel: stage.level,
        trainingStageId: stage.stageId,
        trainingOrder: stage.globalOrder,
        trainingTotal: dailyTrainingStages.length,
        trainingGameId: stage.id,
        trainingAbility: stage.ability,
        abilityLabel: stage.abilityLabel,
        difficultyLabel: stage.difficultyLabel,
        todayKey,
        trainingMinutes,
        trainingSettings,
        selectedTrainingGameIds: selectedTrainingGames.map((game) => game.id),
        dailyTrainingPlan: dailyTrainingStages.map((item) => ({
          stageId: item.stageId,
          gameId: item.id,
          title: item.title,
          level: item.level,
          trainPath: item.trainPath,
          ability: item.ability,
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
          color: #3f2d1c;
          background: #8fd8f5;
        }

        .training-stage-bg {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background-image:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(54, 112, 54, 0.12)),
            var(--game-map-bg);
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
          background:
            radial-gradient(circle at 20% 18%, rgba(255, 247, 188, 0.28), transparent 18%),
            radial-gradient(circle at 82% 20%, rgba(255, 255, 255, 0.22), transparent 20%),
            linear-gradient(180deg, rgba(30, 103, 66, 0.03), rgba(31, 89, 45, 0.14));
          pointer-events: none;
        }

        .training-map-layout {
          position: fixed;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }

        .training-left-panel {
          position: absolute;
          left: max(22px, env(safe-area-inset-left));
          top: max(22px, env(safe-area-inset-top));
          z-index: 12;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          pointer-events: auto;
        }

        .training-back-button,
        .training-parent-button,
        .training-avatar-button,
        .training-profile-actions button {
          min-height: 44px;
          border: 0;
          border-radius: 999px;
          font-weight: 950;
          cursor: pointer;
          transition: transform 0.16s ease, filter 0.16s ease, box-shadow 0.16s ease;
        }

        .training-back-button:hover,
        .training-parent-button:hover,
        .training-round-button:hover,
        .training-avatar-button:hover,
        .training-profile-actions button:hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        .training-back-button {
          width: clamp(58px, 5.2vw, 76px);
          height: clamp(58px, 5.2vw, 76px);
          min-height: 0;
          padding: 0;
          display: grid;
          place-items: center;
          border: 6px solid #ffd669;
          color: #7b5228;
          font-size: clamp(2rem, 3vw, 2.8rem);
          line-height: 1;
          background: radial-gradient(circle at 35% 25%, #fff6c6 0 28%, #ffd867 29% 68%, #edb042 69% 100%);
          box-shadow: inset 0 -8px 0 rgba(143, 86, 18, 0.18), 0 10px 18px rgba(58, 91, 48, 0.22);
        }

        .training-profile-card {
          position: fixed;
          left: max(26px, env(safe-area-inset-left));
          bottom: max(28px, env(safe-area-inset-bottom));
          z-index: 10;
          width: clamp(170px, 15vw, 220px);
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          padding: clamp(12px, 1.2vw, 16px);
          border: 0;
          border-radius: 24px;
          background: rgba(255, 249, 224, 0.94);
          box-shadow: 0 14px 24px rgba(53, 84, 42, 0.2), inset 0 -5px 0 rgba(162, 119, 55, 0.12);
          backdrop-filter: blur(8px);
        }

        .training-profile-avatar {
          width: clamp(92px, 9vw, 128px);
          height: clamp(92px, 9vw, 128px);
          display: grid;
          place-items: center;
          border: 4px solid #ffd56a;
          border-radius: 50%;
          background: linear-gradient(180deg, #fff9cf, #fff1a9);
          overflow: hidden;
          box-shadow: 0 10px 18px rgba(95, 70, 31, 0.18), inset 0 -4px 0 rgba(156, 99, 22, 0.1);
        }

        .training-profile-avatar img {
          width: 92%;
          height: 92%;
          object-fit: contain;
        }

        .training-profile-card h1 {
          margin: 0;
          max-width: 100%;
          font-size: clamp(0.9rem, 1.1vw, 1rem);
          font-weight: 950;
          color: #6c4c2a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .training-avatar-button {
          display: none;
        }

        .training-profile-actions {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }

        .training-profile-actions button {
          min-height: clamp(40px, 3.5vw, 48px);
          padding: 5px 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 3px solid rgba(255, 255, 255, 0.88);
          border-radius: 15px;
          background: linear-gradient(180deg, #fff0a9, #f6c158);
          color: #654522;
          font-size: clamp(0.72rem, 0.9vw, 0.86rem);
          font-weight: 950;
          box-shadow: inset 0 -4px 0 rgba(148, 86, 18, 0.16), 0 6px 12px rgba(72, 78, 36, 0.16);
        }

        .training-profile-actions button:last-child {
          background: linear-gradient(180deg, #ffd09d, #ee9d45);
        }

        .training-profile-action-icon {
          width: clamp(22px, 2vw, 28px);
          height: clamp(22px, 2vw, 28px);
          object-fit: contain;
          flex: 0 0 auto;
        }

        .training-badge-card {
          position: fixed;
          left: max(18px, env(safe-area-inset-left));
          bottom: max(18px, env(safe-area-inset-bottom));
          z-index: 9;
          width: min(270px, 25vw);
          padding: 12px;
          border: 4px solid rgba(255, 255, 255, 0.82);
          border-radius: 24px;
          background: rgba(255, 250, 223, 0.84);
          box-shadow: 0 14px 26px rgba(53, 84, 42, 0.18), inset 0 -5px 0 rgba(162, 119, 55, 0.1);
          backdrop-filter: blur(8px);
          pointer-events: auto;
        }

        .training-badge-header,
        .training-badge-card h2,
        .training-badge-list {
          display: none;
        }

        .training-plan-summary {
          margin: 0;
          padding: 8px 10px;
          border-radius: 16px;
          background: rgba(255, 241, 185, 0.82);
          color: #6a5138;
          font-size: 0.86rem;
          font-weight: 950;
          line-height: 1.35;
          text-align: center;
        }

        .honey-progress-card {
          position: absolute;
          top: max(20px, env(safe-area-inset-top));
          left: 50%;
          z-index: 13;
          width: min(610px, 46vw);
          min-height: 106px;
          padding: 18px 28px;
          display: grid;
          grid-template-columns: clamp(70px, 5.8vw, 96px) 1fr;
          align-items: center;
          gap: clamp(20px, 3vw, 42px);
          border: 0;
          border-radius: 34px;
          background: rgba(255, 249, 226, 0.95);
          box-shadow: 0 15px 28px rgba(53, 84, 42, 0.2), inset 0 -6px 0 rgba(162, 119, 55, 0.1);
          transform: translateX(-50%);
          pointer-events: auto;
          backdrop-filter: blur(8px);
        }

        .honey-progress-icon {
          width: 100%;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 8px 10px rgba(123, 77, 17, 0.18));
        }

        .honey-progress-content {
          min-width: 0;
          display: grid;
          gap: 8px;
        }

        .honey-progress-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .honey-progress-title {
          color: #6c4c2a;
          font-size: clamp(0.9rem, 1.05vw, 1rem);
          font-weight: 950;
          white-space: nowrap;
        }

        .honey-progress-count {
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 226, 126, 0.72);
          color: #7a4d16;
          font-size: clamp(0.72rem, 0.9vw, 0.86rem);
          font-weight: 950;
          white-space: nowrap;
        }

        .honey-progress-subtext {
          margin: 0;
          color: #72583b;
          font-size: clamp(0.72rem, 0.9vw, 0.84rem);
          font-weight: 850;
          line-height: 1.25;
        }

        .honey-progress-track {
          position: relative;
          height: clamp(24px, 2.2vw, 34px);
          overflow: hidden;
          border: 4px solid rgba(218, 218, 218, 0.95);
          border-radius: 999px;
          background: #fff;
          box-shadow: inset 0 3px 6px rgba(85, 73, 53, 0.18), 0 2px 0 rgba(255, 255, 255, 0.88);
        }

        .honey-progress-track::after {
          content: "";
          position: absolute;
          inset: 3px;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), transparent 58%);
          pointer-events: none;
        }

        .honey-progress-fill {
          width: var(--honey-progress);
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(180deg, #ffc760, #f7a42a 58%, #df7e18);
          box-shadow: inset 0 -4px 0 rgba(138, 75, 14, 0.14), 0 0 14px rgba(255, 187, 61, 0.38);
          transition: width 0.32s ease;
        }

        .training-right-tools {
          position: absolute;
          right: max(18px, env(safe-area-inset-right));
          top: max(18px, env(safe-area-inset-top));
          z-index: 12;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          pointer-events: auto;
        }

        .training-parent-button {
          color: #fff;
          min-height: 44px;
          padding: 0 17px;
          background: linear-gradient(180deg, #78caff, #3685dd);
          box-shadow: inset 0 -5px 0 rgba(0, 0, 0, 0.16), 0 9px 16px rgba(40, 95, 48, 0.2);
        }

        .training-icon-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .training-round-button {
          width: clamp(54px, 4.5vw, 70px);
          height: clamp(54px, 4.5vw, 70px);
          display: grid;
          place-items: center;
          border: 4px solid #ffd25f;
          border-radius: 50%;
          background: #fff3ba;
          box-shadow: inset 0 -5px 0 rgba(160, 100, 20, 0.14), 0 9px 16px rgba(53, 84, 42, 0.18);
          cursor: pointer;
          transition: transform 0.16s ease, filter 0.16s ease, box-shadow 0.16s ease;
        }

        .training-round-button img {
          width: 72%;
          height: 72%;
          object-fit: contain;
        }

        .training-route-svg {
          position: absolute;
          inset: 0;
          z-index: 2;
          width: 100%;
          height: 100%;
          pointer-events: none;
          filter: drop-shadow(0 7px 7px rgba(56, 79, 40, 0.16));
        }

        .training-route-shadow,
        .training-route-main,
        .training-route-leaves {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .training-route-shadow {
          stroke: rgba(96, 65, 35, 0.42);
          stroke-width: 7.2;
        }

        .training-route-main {
          stroke: rgba(239, 202, 126, 0.9);
          stroke-width: 5.4;
        }

        .training-route-leaves {
          stroke: rgba(255, 248, 210, 0.8);
          stroke-width: 1.7;
          stroke-dasharray: 1 6;
        }

        .training-stage-node {
          position: absolute;
          left: var(--node-x);
          top: var(--node-y);
          z-index: 5;
          width: clamp(66px, 5.8vw, 88px);
          height: clamp(66px, 5.8vw, 88px);
          transform: translate(-50%, -50%);
          border: 0;
          background: transparent;
          cursor: pointer;
          display: grid;
          place-items: center;
          padding: 0;
          pointer-events: auto;
          transition: transform 0.16s ease;
        }

        .training-stage-node:hover,
        .training-stage-node:focus-visible {
          transform: translate(-50%, -50%) scale(1.045);
          outline: none;
        }

        .training-stage-node.is-locked {
          cursor: not-allowed;
        }

        .training-stage-node.is-shaking .training-stage-circle {
          animation: lockedShake 0.42s ease-in-out;
        }

        .training-stage-circle {
          position: relative;
          width: clamp(62px, 5.4vw, 82px);
          height: clamp(62px, 5.4vw, 82px);
          display: grid;
          place-items: center;
          border: 5px solid rgba(255, 246, 205, 0.96);
          border-radius: 50%;
          background:
            radial-gradient(circle at 38% 24%, rgba(255, 255, 255, 0.68) 0 15%, transparent 16%),
            radial-gradient(circle at 50% 42%, #ffc56b 0 38%, #c47a34 39% 72%, #7a4c2d 73% 100%);
          box-shadow: inset 0 -9px 0 rgba(80, 42, 18, 0.18), 0 11px 18px rgba(54, 78, 36, 0.25);
          transition: filter 0.16s ease, box-shadow 0.16s ease;
        }

        .training-stage-node.is-completed .training-stage-circle {
          background:
            radial-gradient(circle at 38% 24%, rgba(255, 255, 255, 0.7) 0 15%, transparent 16%),
            radial-gradient(circle at 50% 42%, #98ef72 0 38%, #43b95a 39% 72%, #24733c 73% 100%);
        }

        .training-stage-node.is-active .training-stage-circle {
          background:
            radial-gradient(circle at 38% 24%, rgba(255, 255, 255, 0.72) 0 15%, transparent 16%),
            radial-gradient(circle at 50% 42%, #ffe071 0 38%, #ffad3f 39% 72%, #da6a22 73% 100%);
          animation: trainingActiveGlow 1.7s ease-in-out infinite;
        }

        .training-stage-node.is-locked .training-stage-circle {
          filter: grayscale(0.72) saturate(0.62) brightness(0.9);
          opacity: 0.88;
        }

        .training-stage-node:hover .training-stage-circle,
        .training-stage-node:focus-visible .training-stage-circle {
          box-shadow: inset 0 -9px 0 rgba(80, 42, 18, 0.18), 0 12px 18px rgba(54, 78, 36, 0.25), 0 0 0 8px rgba(255, 244, 159, 0.34), 0 0 22px rgba(255, 235, 98, 0.54);
        }

        .training-stage-number {
          display: none;
          position: absolute;
          top: -9px;
          left: -7px;
          z-index: 4;
          min-width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          padding: 0 6px;
          border: 3px solid rgba(255, 250, 219, 0.96);
          border-radius: 999px;
          background: linear-gradient(180deg, #fff9c8, #f5c75d);
          color: #6e421e;
          font-size: 0.82rem;
          font-weight: 1000;
          box-shadow: 0 5px 10px rgba(72, 78, 36, 0.2);
        }

        .training-stage-icon-wrap {
          display: grid;
          place-items: center;
          width: 62%;
          height: 62%;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.42);
          overflow: hidden;
          box-shadow: inset 0 -3px 0 rgba(111, 81, 32, 0.08);
        }

        .training-stage-icon-wrap img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .training-stage-lock {
          position: absolute;
          right: -5px;
          bottom: 12px;
          z-index: 5;
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #fff6ce;
          box-shadow: 0 5px 10px rgba(72, 78, 36, 0.2);
          font-size: 0.98rem;
        }

        .training-stage-stars {
          position: absolute;
          left: 50%;
          bottom: clamp(-21px, -1.55vw, -15px);
          z-index: 6;
          min-width: 66px;
          min-height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 1px;
          padding: 2px 8px 3px;
          border: 3px solid rgba(255, 250, 219, 0.98);
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255, 246, 189, 0.98), rgba(247, 189, 71, 0.96));
          box-shadow: inset 0 -3px 0 rgba(146, 88, 21, 0.14), 0 7px 11px rgba(58, 82, 35, 0.18);
          color: #ffe05d;
          font-size: clamp(0.78rem, 1.1vw, 1rem);
          line-height: 1;
          text-shadow: -1px 0 #7c4b16, 0 1px #7c4b16, 1px 0 #7c4b16, 0 -1px #7c4b16, 0 0 3px rgba(110, 65, 14, 0.55);
          transform: translateX(-50%);
          pointer-events: none;
        }

        .training-stage-stars.is-empty {
          color: rgba(255, 255, 255, 0.75);
          background: rgba(115, 92, 56, 0.28);
          border-color: rgba(255, 255, 255, 0.7);
          text-shadow: 0 1px 0 rgba(68, 51, 30, 0.34);
        }

        .training-stage-node.is-completed .training-stage-stars {
          animation: trainingStarPop 0.36s ease-out both;
        }

        .current-stage-companion {
          position: absolute;
          left: calc(var(--node-x) + 4.5%);
          top: calc(var(--node-y) + 6%);
          z-index: 8;
          width: clamp(48px, 4.8vw, 72px);
          transform: translate(-50%, -50%) rotate(-18deg);
          display: grid;
          justify-items: center;
          pointer-events: none;
          animation: mouseTapHint 1.25s ease-in-out infinite;
        }

        .current-stage-companion img {
          width: 100%;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 8px 10px rgba(50, 72, 35, 0.25));
        }

        .current-stage-companion span {
          display: none;
        }

        .training-helper-card {
          display: none;
          position: absolute;
          left: 50%;
          bottom: max(16px, env(safe-area-inset-bottom));
          z-index: 8;
          width: min(390px, 36vw);
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          border: 4px solid rgba(255, 255, 255, 0.86);
          border-radius: 26px;
          background: rgba(255, 250, 223, 0.88);
          box-shadow: 0 14px 26px rgba(53, 84, 42, 0.18), inset 0 -5px 0 rgba(162, 119, 55, 0.1);
          transform: translateX(-50%);
          backdrop-filter: blur(8px);
          pointer-events: auto;
        }

        .training-helper-avatar-frame {
          width: 56px;
          height: 56px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border: 4px solid #fff7bf;
          border-radius: 18px;
          background: #fff8d9;
          overflow: hidden;
          box-shadow: inset 0 -4px 0 rgba(165, 112, 35, 0.12), 0 6px 10px rgba(82, 61, 28, 0.14);
        }

        .training-helper-avatar-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .training-helper-card h2 {
          margin: 0;
          font-size: 1rem;
        }

        .training-helper-card p {
          margin: 2px 0 0;
          color: #6a5138;
          font-size: 0.85rem;
          line-height: 1.35;
          font-weight: 850;
        }

        @keyframes trainingStarPop {
          0% { transform: translateX(-50%) scale(0.72); opacity: 0; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }

        @keyframes trainingActiveGlow {
          0%, 100% {
            box-shadow: inset 0 -9px 0 rgba(80, 42, 18, 0.18), 0 11px 18px rgba(54, 78, 36, 0.25), 0 0 0 0 rgba(255, 226, 92, 0.44);
          }
          50% {
            box-shadow: inset 0 -9px 0 rgba(80, 42, 18, 0.18), 0 11px 18px rgba(54, 78, 36, 0.25), 0 0 0 14px rgba(255, 226, 92, 0);
          }
        }

        @keyframes companionFloat {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
        }

        @keyframes lockedShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }

        @keyframes mouseTapHint {
          0%, 100% { transform: translate(-50%, -50%) rotate(-18deg) scale(1); }
          48% { transform: translate(-50%, -50%) rotate(-18deg) scale(0.9); }
          70% { transform: translate(-50%, -50%) rotate(-18deg) scale(1.06); }
        }

        @media (max-width: 1180px), (max-height: 760px) {
          .training-stage-node {
            width: clamp(58px, 5.1vw, 76px);
            height: clamp(58px, 5.1vw, 76px);
          }

          .training-stage-circle {
            width: clamp(56px, 4.9vw, 72px);
            height: clamp(56px, 4.9vw, 72px);
            border-width: 4px;
          }

          .honey-progress-card {
            width: min(530px, 46vw);
          }

          .training-badge-card {
            width: 230px;
          }

          .training-helper-card {
            width: min(350px, 34vw);
          }
        }

        @media (max-width: 900px) {
          .training-map-layout {
            overflow-y: auto;
            pointer-events: auto;
          }

          .training-left-panel {
            top: 10px;
            left: 10px;
          }

          .training-profile-card {
            width: 140px;
            left: 10px;
            bottom: 10px;
            border-radius: 20px;
            padding: 10px;
          }

          .training-profile-avatar {
            width: 78px;
            height: 78px;
          }

          .training-profile-card h1 {
            display: none;
          }

          .training-profile-actions button {
            min-height: 34px;
            font-size: 0;
          }

          .training-badge-card {
            display: none;
          }

          .training-right-tools {
            top: 10px;
            right: 10px;
          }

          .training-helper-card {
            left: 10px;
            right: 10px;
            bottom: 10px;
            width: auto;
            max-width: 420px;
            transform: none;
          }

          .honey-progress-card {
            top: 66px;
            width: calc(100vw - 24px);
          }

          .current-stage-companion {
            width: 58px;
          }
        }

        @media (max-width: 640px) {
          .training-back-button,
          .training-parent-button {
            min-height: 38px;
            padding: 0 12px;
            font-size: 0.82rem;
          }

          .training-icon-actions {
            gap: 6px;
          }

          .training-round-button {
            width: 46px;
            height: 46px;
            border-width: 3px;
          }

          .honey-progress-card {
            top: 58px;
            width: calc(100vw - 18px);
            padding: 8px 10px 10px;
            border-radius: 22px;
          }

          .honey-progress-header {
            gap: 8px;
          }

          .honey-progress-title {
            font-size: 0.86rem;
          }

          .honey-progress-count {
            font-size: 0.74rem;
            padding: 4px 7px;
          }

          .honey-progress-subtext {
            font-size: 0.72rem;
          }

          .training-helper-card {
            display: none;
          }

          .training-stage-node {
            width: 56px;
            height: 56px;
          }

          .training-stage-circle {
            width: 54px;
            height: 54px;
            border-width: 3px;
          }

          .training-stage-number {
            min-width: 23px;
            height: 23px;
            font-size: 0.72rem;
          }

          .training-stage-stars {
            min-width: 54px;
            font-size: 0.7rem;
            bottom: -17px;
          }

          .current-stage-companion {
            width: 46px;
          }
        }

        .training-stage-number,
        .training-helper-card {
          display: none !important;
        }
      `}</style>

      <section
        className="training-stage-bg"
        style={{ "--game-map-bg": `url(${gameMapBackground})` }}
        aria-label="森林訓練地圖"
      >
        <div className="training-map-layout">
          <aside className="training-left-panel" aria-label="個人資料與徽章">
            <button
              type="button"
              className="training-back-button"
              onClick={() => navigate("/mode-select")}
              aria-label="返回"
            >
              ‹
            </button>

            <section className="training-profile-card">
              <span className="training-profile-avatar">
                <img src={chickenAvatar} alt="目前頭像" />
              </span>
              <h1>{userProfileName}</h1>
              <button type="button" className="training-avatar-button" onClick={() => navigate("/child-select")}>
                選擇頭像
              </button>
              <div className="training-profile-actions">
                <button type="button" onClick={() => navigate("/add-patient")} aria-label="查看個人檔案">
                  <img className="training-profile-action-icon" src={profileStoneIcon} alt="" />
                  <span>查看檔案</span>
                </button>
                <button type="button" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }} aria-label="登出">
                  <img className="training-profile-action-icon" src={logoutTrainingIcon} alt="" />
                  <span>登出</span>
                </button>
              </div>
            </section>

            <section className="training-badge-card">
              <div className="training-badge-header">
                <span>徽章成就</span>
                <b>2 / 5</b>
              </div>
              <h2>我的徽章牆</h2>
              <p className="training-plan-summary">{trainingMinutes} 分鐘 · {selectedTrainingLabel}</p>
              <div className="training-badge-list">
                <article className="training-badge-item"><img src={cbtIcon} alt="" />森林新手</article>
                <article className="training-badge-item"><img src={srtIcon} alt="" />專注小幫手</article>
                <article className="training-badge-item locked"><img src={dptIcon} alt="" />反應小松鼠</article>
                <article className="training-badge-item locked"><img src={pmIcon} alt="" />記憶收藏家</article>
                <article className="training-badge-item locked"><img src={dccsIcon} alt="" />規則小隊長</article>
              </div>
            </section>
          </aside>

          <section className="honey-progress-card" aria-label="蜂蜜進度">
            <img className="honey-progress-icon" src={honeyIcon} alt="蜂蜜" />
            <div className="honey-progress-content">
              <div className="honey-progress-header">
                <span className="honey-progress-title">蜂蜜任務</span>
                <span className="honey-progress-count">{honeyProgress.totalStars} / {honeyProgress.requiredStars} 顆</span>
              </div>
              <div className="honey-progress-track" role="progressbar" aria-valuenow={honeyProgress.progressPercent} aria-valuemin="0" aria-valuemax="100">
                <div className="honey-progress-fill" style={{ "--honey-progress": `${honeyProgress.progressPercent}%` }} />
              </div>
              <p className="honey-progress-subtext">今日練習 {formatTrainingDuration(todayTrainingSeconds)} · 有效天數 {honeyProgress.effectiveDays} / {honeyProgress.requiredDays} 天</p>
            </div>
          </section>

          <aside className="training-right-tools" aria-label="功能按鈕">
            <button type="button" className="training-parent-button" onClick={openParentResult}>
              給大人看結果
            </button>

            <div className="training-icon-actions">
              <button
                type="button"
                className="training-round-button"
                onClick={() => setShowTestPanel(true)}
                aria-label="打開測驗選單"
              >
                <img src={testIcon} alt="" />
              </button>
              <button
                type="button"
                className="training-round-button"
                onClick={() => navigate("/settings")}
                aria-label="設定"
              >
                <img src={setIcon} alt="" />
              </button>
            </div>
          </aside>

          <svg className="training-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="training-route-shadow" d={routePath} />
            <path className="training-route-main" d={routePath} />
            <path className="training-route-leaves" d={routePath} />
          </svg>

          {dailyTrainingStages.map((stage) => {
            const stageState = stageStateMap[stage.stageId] || {};
            const stateClass = stageState.completed
              ? "is-completed"
              : stageState.active
                ? "is-active"
                : "is-locked";

            const starCount = clampStarCount(stageState.stars);
            const starText = "★".repeat(starCount);

            return (
              <button
                key={stage.stageId}
                type="button"
                className={`training-stage-node ${stateClass} ${lockedHintStageId === stage.stageId ? "is-shaking" : ""}`}
                onClick={() => handleTrainingStageClick(stage)}
                aria-label={`${stage.title} 第 ${stage.level} 關，${stageState.unlocked ? "進入訓練" : "尚未解鎖"}${starCount > 0 ? `，已得到 ${starCount} 顆星` : ""}`}
                style={{ "--node-x": `${stage.mapX}%`, "--node-y": `${stage.mapY}%` }}
              >
                <span className="training-stage-circle">
                  <span className="training-stage-number" aria-hidden="true">{stage.globalOrder}</span>
                  <span className="training-stage-icon-wrap" aria-hidden="true">
                    <img src={stage.icon} alt="" />
                  </span>
                  {!stageState.unlocked && <span className="training-stage-lock" aria-hidden="true">🔒</span>}
                  <span className={`training-stage-stars ${starCount === 0 ? "is-empty" : ""}`} aria-hidden="true">
                    {starCount > 0 ? starText : "☆ ☆ ☆"}
                  </span>
                </span>
              </button>
            );
          })}

          {currentStage && (
            <div
              className="current-stage-companion"
              style={{ "--node-x": `${currentStage.mapX}%`, "--node-y": `${currentStage.mapY}%` }}
              aria-hidden="true"
            >
              <img src={mousePointer} alt="" />
              <span>點這裡</span>
            </div>
          )}

          <aside className="training-helper-card">
            <span className="training-helper-avatar-frame">
              <img src={chickenAvatar} alt="皮皮" />
            </span>
            <div>
              <h2>皮皮在等你</h2>
              <p>點亮亮圈圈，沿著小路繼續前進！</p>
            </div>
          </aside>
        </div>
      </section>

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

      {showTestPanel && (
        <div className="modal-backdrop" onClick={() => setShowTestPanel(false)}>
          <section className="test-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowTestPanel(false)}
              aria-label="關閉測驗選單"
            >
              ×
            </button>
            <img className="test-panel-icon" src={testIcon} alt="" />
            <h2>選擇測驗</h2>
            <p>地圖是今日訓練；正式測驗從這裡開始。</p>

            <div className="test-choice-grid">
              {trainingGames.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => navigate(game.testPath)}
                >
                  <img src={game.icon} alt="" />
                  <strong>{game.shortName}</strong>
                  <span>{game.title}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default GameMenuPage;
=======
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const games = [
    {
      id: "srt",
      title: "幫小飛鼠弟弟接住掉落的橡實",
      subtitle: "簡單反應測驗",
      color: "#FCE6B5",
      trainPath: "/training-srt",
      testPath: "/test-srt",
      description: "透過快速點擊目標，訓練與測量孩子的反應速度與專注表現。",
      available: true,
    },
    {
      id: "picture-memory",
      title: "找出兔子妹妹遺失的物品",
      subtitle: "圖片記憶遊戲",
      color: "#DDEFFF",
      trainPath: "/training-picture-memory",
      testPath: "/test-picture-memory",
      description: "透過圖片記憶與配對，訓練孩子的短期記憶與視覺辨識能力。",
      available: true,
    },
    {
      id: "dot-probe",
      title: "幫狐狸夫婦把物品上的蒼蠅趕走",
      subtitle: "抑制控制遊戲 DPT",
      color: "#E8DFFF",
      trainPath: "/training-dot-probe",
      testPath: "/test-dot-probe",
      description: "透過刺激位置判斷，觀察孩子的注意力與反應控制能力。",
      available: false,
    },
    {
      id: "working-memory",
      title: "記住跳石橋的密碼幫助鹿先生",
      subtitle: "工作記憶遊戲 CBT",
      color: "#FFE0E0",
      trainPath: "/training-cbt",
      testPath: "/test-cbt",
      description: "透過記憶與正確點擊，訓練孩子的工作記憶與資訊保持能力。",
      available: true,
    },
    {
      id: "linking-balloons",
      title: "引導迷路的綿羊奶奶回家",
      subtitle: "認知彈性遊戲 Linking Balloons",
      color: "#E3F8E2",
      trainPath: "/training-linking-balloons",
      testPath: "/test-linking-balloons",
      description: "透過規則切換與分類反應，訓練孩子的認知彈性與轉換能力。",
      available: false,
    },
    {
      id: "dccs",
      title: "幫孔雀小姐的服飾店分類混亂的衣服",
      subtitle: "認知彈性遊戲 DCCS",
      color: "#FFF0D9",
      trainPath: "/training-dccs",
      testPath: "/test-dccs",
      description: "透過顏色與形狀分類切換，觀察孩子的規則理解與切換能力。",
      available: false,
    },
  ];

  const handleNavigate = (path, available) => {
    if (!available) {
      return;
    }
    navigate(path);
  };

  return (
    <div style={pageStyle}>
      <div style={overlayStyle}>
        {/* Header */}
        <div style={headerCardStyle}>
          <div style={headerTopStyle}>
            <div>
              <h1 style={mainTitleStyle}>動物森友會</h1>
              <p style={subTitleStyle}>家長端｜請選擇想進行的遊戲模組</p>
              <p style={descStyle}>
                可依照孩子需求選擇不同遊戲，並進一步決定進入「訓練模式」或「測驗模式」。
              </p>
            </div>

            <div style={headerButtonGroupStyle}>
              <button
                onClick={() => navigate("/add-patient")}
                style={profileButtonStyle}
              >
                查看個人檔案
              </button>

              <button onClick={handleLogout} style={logoutButtonStyle}>
                登出
              </button>
            </div>
          </div>
        </div>

        {/* Section Title */}
        <div style={topRowStyle}>
          <h2 style={sectionTitleStyle}>遊戲選單</h2>
        </div>

        {/* Game Grid */}
        <div style={gridStyle}>
          {games.map((game) => (
            <div key={game.id} style={cardStyle}>
              <div>
                <div
                  style={{
                    ...badgeStyle,
                    background: game.color,
                  }}
                >
                  <span style={{ fontSize: "28px" }}>{game.emoji}</span>
                  <span>{game.subtitle}</span>
                </div>

                <h3 style={gameTitleStyle}>{game.title}</h3>
                <p style={gameDescStyle}>{game.description}</p>

                {!game.available && (
                  <div style={comingSoonStyle}>尚未開放</div>
                )}
              </div>

              <div style={buttonRowStyle}>
                <button
                  onClick={() => handleNavigate(game.trainPath, game.available)}
                  style={{
                    ...trainButtonStyle,
                    opacity: game.available ? 1 : 0.55,
                    cursor: game.available ? "pointer" : "not-allowed",
                  }}
                >
                  訓練模式
                </button>

                <button
                  onClick={() => handleNavigate(game.testPath, game.available)}
                  style={{
                    ...testButtonStyle,
                    opacity: game.available ? 1 : 0.55,
                    cursor: game.available ? "pointer" : "not-allowed",
                  }}
                >
                  測驗模式
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Styles
========================= */

const pageStyle = {
  minHeight: "100vh",
  backgroundImage: `
    linear-gradient(rgba(255, 248, 238, 0.78), rgba(255, 248, 238, 0.82)),
    url(${bgImg})
  `,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  padding: "34px 34px 60px",
  boxSizing: "border-box",
};

const overlayStyle = {
  maxWidth: "1400px",
  margin: "0 auto",
};

const headerCardStyle = {
  background: "rgba(255, 252, 247, 0.92)",
  borderRadius: "34px",
  padding: "42px 48px",
  marginBottom: "30px",
  boxShadow: "0 14px 32px rgba(120, 90, 60, 0.10)",
  border: "2px solid rgba(184, 149, 114, 0.14)",
  backdropFilter: "blur(4px)",
};

const headerTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
};

const headerButtonGroupStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const mainTitleStyle = {
  fontSize: "52px",
  fontWeight: "800",
  color: "#1D3F73",
  margin: "0 0 12px 0",
  letterSpacing: "1px",
};

const subTitleStyle = {
  fontSize: "22px",
  color: "#6A5C50",
  marginBottom: "12px",
  fontWeight: "600",
};

const descStyle = {
  fontSize: "17px",
  color: "#8A7A6B",
  lineHeight: "1.9",
  maxWidth: "920px",
  margin: 0,
};

const topRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
  gap: "20px",
  flexWrap: "wrap",
};

const sectionTitleStyle = {
  fontSize: "40px",
  fontWeight: "800",
  color: "#1D3F73",
  margin: 0,
};

const profileButtonStyle = {
  background: "linear-gradient(135deg, #6AA8FF, #3D84F5)",
  color: "white",
  border: "none",
  borderRadius: "18px",
  padding: "16px 28px",
  fontSize: "17px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(61, 132, 245, 0.25)",
};

const logoutButtonStyle = {
  background: "linear-gradient(135deg, #FF8A8A, #E45B5B)",
  color: "white",
  border: "none",
  borderRadius: "18px",
  padding: "16px 24px",
  fontSize: "16px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(228, 91, 91, 0.25)",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
  gap: "28px",
};

const cardStyle = {
  background: "rgba(255, 252, 248, 0.94)",
  borderRadius: "32px",
  padding: "30px",
  boxShadow: "0 14px 32px rgba(120, 90, 60, 0.08)",
  minHeight: "340px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  border: "1.5px solid rgba(184, 149, 114, 0.10)",
  backdropFilter: "blur(3px)",
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  borderRadius: "18px",
  padding: "10px 16px",
  fontSize: "18px",
  fontWeight: "700",
  marginBottom: "22px",
  color: "#1D3557",
};

const gameTitleStyle = {
  fontSize: "32px",
  fontWeight: "800",
  color: "#1D3557",
  marginBottom: "14px",
  lineHeight: "1.35",
};

const gameDescStyle = {
  fontSize: "18px",
  color: "#6F655E",
  lineHeight: "1.9",
  marginBottom: "18px",
};

const comingSoonStyle = {
  display: "inline-block",
  background: "#F6D7D7",
  color: "#A24B4B",
  fontSize: "15px",
  fontWeight: "700",
  padding: "8px 14px",
  borderRadius: "999px",
};

const buttonRowStyle = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
  marginTop: "10px",
};

const trainButtonStyle = {
  background: "linear-gradient(135deg, #F3B34D, #E5962D)",
  color: "white",
  border: "none",
  borderRadius: "18px",
  padding: "16px 28px",
  fontSize: "18px",
  fontWeight: "700",
  minWidth: "150px",
  boxShadow: "0 8px 20px rgba(229, 150, 45, 0.22)",
};

const testButtonStyle = {
  background: "linear-gradient(135deg, #8A72FF, #6C58E8)",
  color: "white",
  border: "none",
  borderRadius: "18px",
  padding: "16px 28px",
  fontSize: "18px",
  fontWeight: "700",
  minWidth: "150px",
  boxShadow: "0 8px 20px rgba(108, 88, 232, 0.22)",
};

export default GameMenuPage;
>>>>>>> c6f22a2f424662c5364c50484a73204c14e3c37d
