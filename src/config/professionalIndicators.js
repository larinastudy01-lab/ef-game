// Presentation definitions only. Never used to change task scoring or progression.
export const PROFESSIONAL_TASKS = {
  SRT: { name: "松鼠接橡實", construct: "持續注意與反應抑制相關行為", core: "命中率", limitation: "整體正確率不等同抑制能力；Go 與 No-Go 分開計算。" },
  PM: { name: "圖片記憶", construct: "視覺工作記憶", core: "各負荷表現", limitation: "不同負荷不可視為等價；最高答對負荷不是穩定記憶廣度或記憶年齡。" },
  CBT: { name: "跳石橋", construct: "視空間序列記憶", core: "最大正確廣度", limitation: "依既有正式連錯兩次停止規則；不同長度的整體正確率不可直接比較。" },
  ARI: { name: "動物聲音辨識", construct: "聽覺規則選擇與反應控制", core: "依聲音條件正確率", limitation: "依 soundAnimal／stimulusAnimalLabels 呈現實際動物；cat／dog 僅是舊計分角色，缺少動物欄位時不推定刺激。" },
  DCCS: { name: "衣物分類", construct: "規則切換與認知彈性", core: "各規則階段正確率", limitation: "一般錯誤不等同固著；僅使用明確舊規則干擾標記。" },
  LB: { name: "幫助迷路的綿羊奶奶", construct: "順序操作與規則遵循", core: "各規則正確率", limitation: "規劃能力指標尚未驗證；未記錄計畫步數時不推算完成比例。" },
};

const literature = {
  SRT: { title: "Psychometric Properties of a Combined Go/No-go and Continuous Performance Task across Childhood", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10041761/" },
  DCCS: { title: "Zelazo (2006), The Dimensional Change Card Sort", url: "https://www.nature.com/articles/nprot.2006.46" },
};
const definition = (task, name, formula, source, limitations, kind = "task_rule") => ({
  task, name, description: PROFESSIONAL_TASKS[task].construct, formula, source,
  validTrialRules: "已施測、有明確結果；排除重複、未完成、未施測及已標記無效題。RT 僅取答對、非逾時、通過既有 RT 品質界限的實際反應。",
  applicableMode: "正式測驗與訓練分開；不同難度、版本、規則組成不合併比較",
  limitations, reference: literature[task] || null, kind,
  validationStatus: "描述性作業指標；本平台尚無常模、臨床分類或診斷效度",
});
export const INDICATOR_DEFINITIONS = [
  definition("SRT", "命中率／漏答率", "Go 答對／Go 已施測已知結果；Go 漏答／同分母 × 100%", "targetType, trainingAction/action, isCorrect, timedOut", "Go 目標類型必須明確。漏答可納入分母，不能因缺 RT 排除。", "literature_informed"),
  definition("SRT", "誤擊率", "No-Go 誤擊／No-Go 已施測已知結果 × 100%", "targetType=rotten, clickedRotten/falseAlarm", "No-Go 不要求 RT；分母為 No-Go，不是全部題次。", "literature_informed"),
  definition("SRT", "正確 RT／RT 標準差", "正確有效 RT 的平均；樣本標準差（n−1，至少 2 題）", "reactionTime/responseTime/reaction_time_ms, validTrial", "無反應、逾時、錯誤與無效反應不納入。", "literature_informed"),
  definition("SRT", "前後段變化", "依原始施測順序；前 floor(N/2) 題與其餘題的正確率差（百分點）", "所有已施測、結果已知的題次", "奇數題中間題歸後半；至少 4 題；此為固定 UI 規則，非疲勞診斷。", "ui_rule"),
  definition("PM", "負荷別正確率／部分給分", "每個 memoryCount 的答對／有效題；部分得分保留原始 scoreValue（不轉為二元正確）", "memoryCount/memorySpan, isCorrect, scoreValue, wrongTapCount, missedTargetCount", "不提供未定義的穩定最高負荷；不同負荷不直接等價。"),
  definition("CBT", "最大正確廣度／長度別正確率", "明確答對題中最大的序列長度；各長度答對／有效題", "memorySpan/sequenceLength/targetSequence, isCorrect", "不是智商或常模分數；提前終止只顯示實際 finishReason。"),
  definition("ARI", "條件別正確率／選擇分布", "各 soundType 的答對／有效題；各 selectedPosition 的實際選擇次數", "soundType, selectedPosition/clickedSide, errorType", "不生成不存在的刺激條件或注意偏誤指數。"),
  definition("DCCS", "階段正確率／切換後錯誤", "各 ruleStage 的答對／有效題；明確切換後題次的錯誤數", "matchBy/rule/rule_type（實際分類規則）, ruleStage（原始階段）, isSwitch/isPostSwitch, isCorrect", "服裝種類、顏色與袋內衣物顏色依原始規則名稱呈現。", "literature_informed"),
  definition("DCCS", "明確舊規則干擾", "isPerseverativeError 或 isOldRuleInterference=true 的題次數", "明確布林標記；缺值保持未記錄", "不以一般錯誤反推固著或疾病。", "task_rule"),
  definition("LB", "規則正確率／順序錯誤／完成比例", "各 ruleType 答對／有效操作；明確順序錯誤次數；已完成步數／明確計畫步數", "ruleType/rule, errorType, completedSteps, totalSteps", "重複操作保持原始順序；缺計畫分母不推算；不作規劃能力診斷。"),
];

// Reserved schema, deliberately disabled. UI never classifies performance from it.
export const NORMATIVE_SCORING = Object.freeze({ enabled: false, ageGroup: null, task: null, scoreDefinition: null, referencePopulation: null, percentile: null, validityStatus: "unvalidated", classificationRule: null });
