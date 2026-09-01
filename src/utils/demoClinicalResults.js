const ALL_RESULTS_KEY = "efGameResults";
const MAX_LOCAL_RESULTS = 200;
const MAX_DEMO_TRIALS_PER_RESULT = 4;

const GAME_META = {
  SRT: {
    gameName: "松鼠接橡實",
    abilityLabel: "反應速度 / 抑制控制",
    difficulties: ["easy-1", "easy-2", "medium-1", "medium-2", "hard-1"],
  },
  PM: {
    gameName: "圖片記憶",
    abilityLabel: "工作記憶",
    difficulties: ["Lv.1", "Lv.2", "Lv.3", "Lv.4", "Lv.5", "Lv.6", "Lv.7"],
  },
  CBT: {
    gameName: "跳石橋",
    abilityLabel: "序列記憶 / 注意維持",
    difficulties: ["easy1", "easy2", "normal1", "normal2", "hard1"],
  },
  SSG: {
    gameName: "動物聲音辨識",
    abilityLabel: "選擇性注意 / 抑制控制",
    difficulties: ["easy", "normal", "hard"],
  },
  DCCS: {
    gameName: "衣物分類",
    abilityLabel: "認知彈性",
    difficulties: ["level1", "level2", "level3", "level4", "level5", "level6"],
  },
  LB: {
    gameName: "幫助迷路的綿羊奶奶",
    abilityLabel: "排序能力 / 規則理解",
    difficulties: ["veryEasy", "easy", "normal", "hard", "veryHard"],
  },
};

const GAME_KEYS = Object.keys(GAME_META);

const LEGACY_KEYS = {
  SRT: { test: "srtTestResult", training: "srtTrainingResult" },
  PM: { test: "pmTestResult", training: "pmTrainingResult" },
  CBT: { test: "cbtTestResult", training: "cbtTrainingResult" },
  SSG: { test: "ssgTestResult", training: "ssgTrainingResult" },
  DCCS: { test: "dccsTestResult", training: "dccsTrainingResult" },
  LB: { test: "lbTestResult", training: "lbTrainingResult" },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pick(values) {
  return values[randomInt(0, values.length - 1)];
}

function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeSetJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getPatientId(patient = {}, fallbackIndex = 0) {
  return String(
    patient.id ||
      patient.patient_id ||
      patient.patientId ||
      patient.childId ||
      patient.child_id ||
      `demo-patient-${fallbackIndex + 1}`
  );
}

function getPatientName(patient = {}, fallbackIndex = 0) {
  return (
    patient.nickname ||
    patient.full_name ||
    patient.name ||
    patient.childName ||
    `Demo Child ${fallbackIndex + 1}`
  );
}

function getStars(accuracy) {
  if (accuracy >= 85) return 3;
  if (accuracy >= 65) return 2;
  return 1;
}

function getPerformanceLevel(accuracy) {
  if (accuracy >= 85) return "stable";
  if (accuracy >= 65) return "developing";
  return "needsSupport";
}

function buildTrials({ gameKey, totalTrials, correctCount, avgReactionTime, difficulty }) {
  return Array.from({ length: totalTrials }, (_, index) => {
    const isCorrect = index < correctCount;
    const reactionTime = Math.max(
      180,
      Math.round(avgReactionTime + randomInt(-420, 620))
    );

    return {
      trialNumber: index + 1,
      trialIndex: index + 1,
      gameKey,
      difficulty,
      difficultyLabel: difficulty,
      isCorrect,
      correct: isCorrect,
      success: isCorrect,
      reactionTime,
      responseTime: reactionTime,
      targetType: pick(["target", "distractor", "switch", "memory"]),
      selectedAnswer: isCorrect ? "correct" : pick(["wrong", "timeout", "miss"]),
      timeout: !isCorrect && Math.random() < 0.18,
      assisted: Math.random() < 0.16,
      wrongTapCount: isCorrect ? 0 : randomInt(0, 2),
    };
  }).sort(() => Math.random() - 0.5);
}

function buildDemoResult({ patient, patientIndex, index }) {
  const gameKey = GAME_KEYS[index % GAME_KEYS.length];
  const meta = GAME_META[gameKey];
  const mode = Math.random() < 0.7 ? "training" : "test";
  const difficulty = pick(meta.difficulties);
  const totalTrials = randomInt(12, 36);
  const accuracy = randomInt(42, 98);
  const correctCount = Math.round((accuracy / 100) * totalTrials);
  const errorCount = Math.max(totalTrials - correctCount, 0);
  const avgReactionTime = randomInt(520, 3200);
  const score = clamp(Math.round(accuracy * 0.78 + randomInt(2, 22)), 0, 100);
  const stars = getStars(accuracy);
  const patientId = getPatientId(patient, patientIndex);
  const patientName = getPatientName(patient, patientIndex);
  const createdAt = new Date(
    Date.now() - randomInt(0, 89) * 24 * 60 * 60 * 1000 - randomInt(0, 7200) * 1000
  ).toISOString();
  const allTrials = buildTrials({
    gameKey,
    totalTrials,
    correctCount,
    avgReactionTime,
    difficulty,
  });
  const trials = allTrials.slice(0, MAX_DEMO_TRIALS_PER_RESULT);
  const randomClickCount = trials.reduce(
    (sum, trial) => sum + (trial.wrongTapCount || 0),
    0
  );
  const resultId = `demo-${patientId}-${gameKey}-${mode}-${createdAt}-${index}`;

  const rawResult = {
    resultId,
    gameId: gameKey,
    gameKey,
    gameName: meta.gameName,
    mode,
    difficulty,
    score,
    stars,
    accuracy,
    accuracyPercent: accuracy,
    avgReactionTime,
    totalTrials,
    correctCount,
    errorCount,
    performanceLevel: getPerformanceLevel(accuracy),
    recommendedAction:
      accuracy >= 85 ? "increaseDifficulty" : accuracy < 60 ? "decreaseDifficulty" : "keep",
    trials,
    generatedAt: createdAt,
    childId: patientId,
    childName: patientName,
    __demoSeed: true,
  };

  return {
    schemaVersion: "demo-1.0.0",
    resultId,
    createdAt,
    child: {
      childId: patientId,
      id: patientId,
      name: patientName,
      age: patient.age ?? null,
      gender: patient.gender ?? null,
    },
    game: {
      gameId: gameKey,
      gameName: meta.gameName,
      abilityType: meta.abilityLabel,
      abilityLabel: meta.abilityLabel,
    },
    session: {
      mode,
      difficulty,
      startedAt: createdAt,
      finishedAt: createdAt,
      totalPlayTime: randomInt(80, 520),
      route: mode === "training" ? `/training-${gameKey.toLowerCase()}` : `/test-${gameKey.toLowerCase()}`,
    },
    summary: {
      score,
      stars,
      accuracy,
      accuracyPercent: accuracy,
      avgReactionTime,
      totalTrials,
      correctCount,
      errorCount,
      performanceLevel: rawResult.performanceLevel,
      difficultyLabel: difficulty,
    },
    metrics: {
      errorTypes: {
        wrongAnswer: errorCount,
        randomClick: randomClickCount,
      },
      fatigueLevel: accuracy < 60 ? "high" : accuracy < 75 ? "medium" : "low",
      recommendedDifficulty: rawResult.recommendedAction,
    },
    ai: {
      parentSummary: `${meta.gameName} demo result: accuracy ${accuracy}%, score ${score}.`,
      suggestedAction: rawResult.recommendedAction,
      aiSummary: {
        action: rawResult.recommendedAction,
        source: "demo-seed",
      },
      warningLevel: accuracy < 60 ? "warning" : "normal",
    },
    visibility: {
      visibleRoles: ["child", "parent", "clinician"],
      hideMedicalResult: false,
    },
    trials,
    rawResult,
    __demoSeed: true,
  };
}

export function seedClinicianDashboardDemoResults({
  patients = [],
  count = 100,
  replaceDemo = true,
} = {}) {
  if (typeof window === "undefined" || !window.localStorage) return [];

  if (replaceDemo) {
    clearClinicianDashboardDemoResults();
  }

  const safePatients = Array.isArray(patients) && patients.length > 0
    ? patients
    : [{ id: "demo-patient", nickname: "Demo Child" }];
  const safeCount = clamp(Math.round(Number(count) || 100), 1, MAX_LOCAL_RESULTS);
  const existingResults = safeParse(window.localStorage.getItem(ALL_RESULTS_KEY), []);
  const keptResults = replaceDemo
    ? existingResults.filter((item) => !item?.__demoSeed)
    : existingResults;
  let demoResults = Array.from({ length: safeCount }, (_, index) =>
    buildDemoResult({
      patient: safePatients[index % safePatients.length],
      patientIndex: index % safePatients.length,
      index,
    })
  );

  const writeDemoResults = (results) => {
    const nextResults = [...results, ...keptResults]
      .filter((item) => item?.resultId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, MAX_LOCAL_RESULTS);

    safeSetJson(ALL_RESULTS_KEY, nextResults);
  };

  try {
    writeDemoResults(demoResults);
  } catch (error) {
    if (error?.name !== "QuotaExceededError") throw error;

    const fallbackCount = [60, 30, 12].find((candidate) => candidate < demoResults.length) || 6;
    demoResults = demoResults.slice(0, fallbackCount);
    writeDemoResults(demoResults);
  }

  demoResults.slice(0, GAME_KEYS.length).forEach((result) => {
    const gameKey = result.game?.gameId;
    const mode = result.session?.mode || "training";
    const legacyKey = LEGACY_KEYS[gameKey]?.[mode];
    const childId = result.child?.childId || "demo-patient";

    try {
      safeSetJson(`result:${gameKey}:${mode}`, result);
      safeSetJson(`result:${childId}:${gameKey}:${mode}`, result);
      if (legacyKey) {
        safeSetJson(legacyKey, result.rawResult || result);
      }
    } catch (error) {
      if (error?.name !== "QuotaExceededError") throw error;
    }
  });

  return demoResults;
}

export function clearClinicianDashboardDemoResults() {
  if (typeof window === "undefined" || !window.localStorage) return;

  const existingResults = safeParse(window.localStorage.getItem(ALL_RESULTS_KEY), []);
  if (Array.isArray(existingResults)) {
    const nextResults = existingResults.filter((item) => !item?.__demoSeed);
    window.localStorage.setItem(ALL_RESULTS_KEY, JSON.stringify(nextResults));
  }

  Object.entries(LEGACY_KEYS).forEach(([gameKey, modes]) => {
    Object.entries(modes).forEach(([mode, legacyKey]) => {
      const unifiedKey = `result:${gameKey}:${mode}`;
      const unifiedValue = safeParse(window.localStorage.getItem(unifiedKey), null);
      const legacyValue = safeParse(window.localStorage.getItem(legacyKey), null);

      if (unifiedValue?.__demoSeed || unifiedValue?.rawResult?.__demoSeed) {
        window.localStorage.removeItem(unifiedKey);
      }

      if (legacyValue?.__demoSeed) {
        window.localStorage.removeItem(legacyKey);
      }
    });
  });

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith("result:")) continue;

    const value = safeParse(window.localStorage.getItem(key), null);
    if (value?.__demoSeed || value?.rawResult?.__demoSeed) {
      window.localStorage.removeItem(key);
    }
  }
}

export function getClinicalDemoSeedCountFromUrl(search = "") {
  const params = new URLSearchParams(search);
  const raw = params.get("seedClinicalDemo") || params.get("seedDemoResults");
  if (!raw) return 0;
  if (raw === "true" || raw === "yes") return 100;
  return clamp(Math.round(Number(raw) || 100), 1, MAX_LOCAL_RESULTS);
}
