import ExcelJS from "exceljs";
import { createRecordWorkbook, flattenJson } from "./clinicianExcelExport";

test("JSON flattening preserves nested arrays, empty values and long strings", () => {
  const rows = flattenJson({ answers: [false, 0, null, {}, []], text: "字".repeat(33000) });
  expect(rows.slice(0, 5).map((row) => row[3])).toEqual([false, 0, "", "{}", "[]"]);
  expect(rows.filter((row) => row[0] === '$["text"]').map((row) => row[3]).join("")).toHaveLength(33000);
});

test("single and combined records survive an actual XLSX round trip", async () => {
  for (const count of [1, 2]) {
    const records = Array.from({ length: count }, (_, index) => ({
      id: `record-${index}`, date: "2026-09-12", type: "training", score: 0, accuracy: 0,
      correct: 0, total: 1, gameName: "規則分類任務",
      rtStd: 0, rtCV: 0.1, promptCount: 2, rtStdIncrease: 20, rtCVIncrease: 0.1,
      earlyClickCount: 3, wrongAnswerHintCount: 1, idleHintCount: 1,
      possibleConfusionCount: 2, visualConfusionCount: 1, categoryConfusionCount: 1, unrelatedWrongCount: 0,
      trials: [{ correct: false, rt: 0, answer: { selected: "=1+1" }, promptCount: 1,
        confusionAnalysis: { possibleConfusionCount: 2, visualSimilarityConfusionCount: 1, categoryConfusionCount: 1, unrelatedErrorCount: 0, errors: [{ selectedId: "PM22", matchedTargetIds: ["PM10"], type: "visual_similarity" }] } }],
      raw: { details: { answers: [0, false] } },
    }));
    const workbook = createRecordWorkbook({ patientName: "測試", age: 8, gender: "女", records, formatDate: (value) => value, notes: count > 1 ? ["比較說明"] : [] });
    const buffer = await workbook.xlsx.writeBuffer();
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(buffer);
    expect(restored.getWorksheet("紀錄摘要").rowCount).toBe(count + 1);
    expect(restored.getWorksheet("紀錄摘要").getCell("H2").value).toBe(0);
    expect(["P2", "Q2", "R2", "S2", "T2"].map((cell) => restored.getWorksheet("紀錄摘要").getCell(cell).value))
      .toEqual([0, 0.1, 2, 20, 0.1]);
    expect(["U2", "V2", "W2"].map((cell) => restored.getWorksheet("紀錄摘要").getCell(cell).value))
      .toEqual([3, 1, 1]);
    expect(["X2", "Y2", "Z2", "AA2"].map((cell) => restored.getWorksheet("紀錄摘要").getCell(cell).value))
      .toEqual([2, 1, 1, 0]);
    expect(["G2", "H2", "I2", "J2", "K2"].map((cell) => restored.getWorksheet("逐題紀錄").getCell(cell).value))
      .toEqual([1, 2, 1, 1, 0]);
    expect(restored.getWorksheet("逐題紀錄").getCell("D2").value).toBe("錯誤");
    expect(restored.getWorksheet("逐題紀錄").getCell("E2").value).toBe(0);
    const raw = restored.getWorksheet("原始資料");
    const answer = raw.getColumn(7).values.find((value) => value === "=1+1");
    expect(answer).toBe("=1+1");
    expect(Boolean(restored.getWorksheet("比較與判讀"))).toBe(count > 1);
  }
});
