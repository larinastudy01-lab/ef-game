// Presentation copy checked against current TestPage_* acquisition records and task protocols.
// This catalog describes existing fields; it does not collect data or change task rules.
export const RESEARCH_TASK_GUIDE = [
  {
    code: "CBT",
    rules: "觀看石頭依序亮起，再依原順序點選；序列長度隨測驗進程增加。",
    collected: "目標與作答序列、序列長度、石頭位置、正誤與錯誤位置、反應時間與點擊間隔、逾時、提示及重複點擊紀錄。",
    fields: "targetSequence · userSequence · sequenceLength · boardPositions · firstErrorPosition · reactionTime · averageTapInterval · isTimeout · promptEvents · repeatedClickCount",
  },
  {
    code: "PM",
    rules: "先記住圖片，再從選項中找出剛才出現的圖片；依題目指定的記憶數量作答。",
    collected: "目標與已選圖片 ID、記憶數量、選項數、正誤、反應時間與首次點擊時間、誤點、漏選、取消選取、逾時及點擊紀錄。",
    fields: "correctIds · selectedIds · memoryCount · optionCount · isCorrect · reactionTime · firstTapTime · wrongTapCount · missedTargetCount · deselectCount · isTimeout · tapLogs",
  },
  {
    code: "SRT",
    rules: "一般橡實出現時點選，腐壞橡實出現時抑制點擊；訓練模式另有金色橡實，規則依模式與難度區分。",
    collected: "橡實類型與位置、實際動作、正誤、反應時間、漏按／誤按及輔助介入紀錄。",
    fields: "targetType · positionX · positionY · missed · action / trainingAction · isCorrect · reactionTime · errorType · falseClick · assisted",
  },
  {
    code: "ARI",
    rules: "聽到貓叫選狗、聽到狗叫選貓，依相反動物規則選取圖片；同時記錄圖片左右位置。",
    collected: "聲音類型、預期與所選動物、正確與所選位置、正誤、反應時間、逾時與過早反應紀錄。",
    fields: "soundType · expectedTarget · selectedTarget · correctPosition · selectedPosition · isCorrect · reactionTime · timeout · isAnticipation",
  },
  {
    code: "LB",
    rules: "依當前關卡指定的數字正序、倒序或紅藍交替規則，依序連結門牌，幫助綿羊奶奶找到路。",
    collected: "關卡與規則、預期與點選的門牌／數字／顏色、選取順序、規則切換與干擾標記、正誤、逐步反應與累積時間。",
    fields: "stageId · ruleType · expectedKey / clickedKey · expectedNumber / clickedNumber · expectedColor / clickedColor · selectionOrder · isSwitch · hasInterference · reactionTime · cumulativeTime",
  },
  {
    code: "DCCS",
    rules: "依當前提示將物品按顏色或種類分類；切換規則後，改用新規則選取正確分類位置。",
    collected: "卡片顏色與種類、提示與規則階段、正確與所選位置、正誤、反應時間、切換方向、干擾及沿用舊規則的錯誤。",
    fields: "cardColor · cardType · cue · ruleStage · correctSide · userAnswerSide · isCorrect · reactionTime · switchDirection · isAfterSwitch · isPerseverativeError",
  },
];
