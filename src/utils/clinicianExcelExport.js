import ExcelJS from "exceljs";

// Keep JSON paths intact, including array positions and keys containing dots.
export function flattenJson(value, path = "$", rows = []) {
  if (value !== null && typeof value === "object" && Object.keys(value).length) {
    Object.entries(value).forEach(([key, child]) => {
      flattenJson(child, path + (Array.isArray(value) ? `[${key}]` : `[${JSON.stringify(key)}]`), rows);
    });
  } else {
    const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    const cell = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : value;
    // Excel limits each cell to 32,767 characters; split without dropping content.
    const parts = typeof cell === "string" ? cell.match(/[\s\S]{1,32000}/g) || [""] : [cell];
    parts.forEach((part, index) => rows.push([path, type, index + 1, part]));
  }
  return rows;
}

export function createRecordWorkbook({ patientName, age, gender, records, formatDate, notes = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EF";
  const addSheet = (name, headers, rows) => {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row.map((value) => value ?? "")));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF245B78" } };
    sheet.columns.forEach((column, index) => {
      column.width = /值|內容|欄位路徑/.test(headers[index]) ? 60 : 22;
      column.alignment = { vertical: "top", wrapText: true };
    });
    return sheet;
  };
  addSheet("個案摘要", ["項目", "值"], [
    ["個案", patientName], ["年齡", age], ["性別", gender],
    ["匯出時間", formatDate(new Date().toISOString())], ["紀錄筆數", records.length],
  ]);
  addSheet("紀錄摘要", ["紀錄 ID", "日期", "類型", "遊戲", "遊戲代碼", "能力", "難度", "分數", "星級", "正確率 (%)", "平均反應 (ms)", "正確題數", "總題數", "錯誤次數", "資料來源"],
    records.map((r) => [r.id, formatDate(r.date), r.type === "test" ? "測驗" : r.type === "training" ? "訓練" : "紀錄", r.gameName, r.gameKey, r.ability, r.difficulty, r.score, r.stars, r.accuracy, r.avgRt, r.correct, r.total, r.errors, r.sourceTable ?? r.source]));
  const trialRows = [];
  const rawRows = [];
  records.forEach((record) => {
    (Array.isArray(record.trials) ? record.trials : []).forEach((trial, index) => {
      const correct = trial?.isCorrect ?? trial?.correct ?? trial?.success;
      trialRows.push([record.id, index + 1, trial?.trialNumber ?? trial?.round ?? index + 1,
        correct === true ? "正確" : correct === false ? "錯誤" : trial?.result ?? trial?.status ?? trial?.outcome,
        trial?.reactionTime ?? trial?.responseTime ?? trial?.rt ?? trial?.reaction_time,
        trial?.difficultyLabel ?? trial?.difficultyLevel ?? trial?.difficulty ?? record.difficulty]);
      flattenJson(trial).forEach((row) => rawRows.push([record.id, "逐題", index + 1, ...row]));
    });
    if (record.raw !== undefined) flattenJson(record.raw).forEach((row) => rawRows.push([record.id, "原始紀錄", "", ...row]));
  });
  addSheet("逐題紀錄", ["紀錄 ID", "題目索引", "題號", "結果", "反應時間 (ms)", "難度"], trialRows);
  addSheet("原始資料", ["紀錄 ID", "來源", "題目索引", "欄位路徑", "資料型別", "分段", "值"], rawRows);
  if (notes.length) addSheet("比較與判讀", ["序號", "內容"], notes.map((note, index) => [index + 1, note]));
  return workbook;
}
