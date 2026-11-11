import { SRT_DIFFICULTY_ORDER, SRT_TRAINING_SETTINGS } from "../utils/srtProtocol";
import { PM_DIFFICULTY_ORDER, PM_TRAINING_CONFIG } from "../utils/pmProtocol";
import { CBT_DIFFICULTY_ORDER, CBT_TRAINING_CONFIG } from "../utils/cbtProtocol";
import { LB_DIFFICULTY_ORDER, LB_TRAINING_CONFIG } from "../utils/lbProtocol";
import { ARI_DIFFICULTY_ORDER, ARI_TRAINING_CONFIG } from "../utils/ariProtocol";

import { DCCS_DIFFICULTY_ORDER, DCCS_TRAINING_CONFIG } from "../utils/dccsTrainingProtocol";
import { SRT_ASSESSMENT_VERSIONS } from "../config/srtAssessmentConfig";
import { CBT_ASSESSMENT_VERSIONS } from "../config/cbtAssessmentConfig";
import { LB_ASSESSMENT_VERSIONS } from "../config/lbAssessmentConfig";
import { DCCS_ASSESSMENT_VERSIONS } from "../config/dccsAssessmentVersions";
import { PM_ASSESSMENT_VERSIONS } from "../config/pmStimulusConfig";
import { ARI_ASSESSMENT_VERSIONS } from "../config/ariAssessmentConfig";

const protocolLevels = (order, config) => order.map((difficulty, index) => ({
  level: index + 1, difficulty, label: config[difficulty].label || config[difficulty].difficultyLabel,
}));

const assessmentVersions = (versions) => Object.values(versions).map(({ testVersion, stimulusName }) => ({
  version: testVersion, label: stimulusName,
}));

export const GAME_TESTING_CATALOG = [
  { id: "SRT", name: "橡實反應", description: "注意力與抑制控制", slug: "srt",
    versions: assessmentVersions(SRT_ASSESSMENT_VERSIONS),
    levels: protocolLevels(SRT_DIFFICULTY_ORDER, SRT_TRAINING_SETTINGS) },
  { id: "PM", name: "圖片記憶", description: "記住圖片，找出相同物品", slug: "picture-memory",
    versions: assessmentVersions(PM_ASSESSMENT_VERSIONS),
    levels: protocolLevels(PM_DIFFICULTY_ORDER, PM_TRAINING_CONFIG) },
  { id: "CBT", name: "石頭記憶", description: "觀察並重現石頭路線", slug: "cbt",
    versions: assessmentVersions(CBT_ASSESSMENT_VERSIONS),
    levels: protocolLevels(CBT_DIFFICULTY_ORDER, CBT_TRAINING_CONFIG) },
  { id: "ARI", name: "貓狗反向", description: "聽聲音，選出相反的動物", slug: "ari",
    versions: assessmentVersions(ARI_ASSESSMENT_VERSIONS),
    levels: protocolLevels(ARI_DIFFICULTY_ORDER, ARI_TRAINING_CONFIG) },
  { id: "LB", name: "幫助迷路的綿羊奶奶", description: "順序、顏色交替與規則切換", slug: "linking-balloons",
    versions: assessmentVersions(LB_ASSESSMENT_VERSIONS),
    levels: protocolLevels(LB_DIFFICULTY_ORDER, LB_TRAINING_CONFIG) },
  { id: "DCCS", name: "物品規則分類", description: "依顏色或種類分類，練習轉換規則", slug: "dccs",
    versions: assessmentVersions(DCCS_ASSESSMENT_VERSIONS),
    levels: protocolLevels(DCCS_DIFFICULTY_ORDER, DCCS_TRAINING_CONFIG) },
];
