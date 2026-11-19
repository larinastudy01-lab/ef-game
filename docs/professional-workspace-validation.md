# 專業分析平台交付與驗收紀錄

日期：2026-11-19。搭配 [盤點、功能保留、公式與狀態規則](professional-workspace-audit.md) 閱讀。

## 已實作的結果

1. 共用品牌、左側導覽、中文任務名稱與資料呈現元件；維持既有 `/clinician-dashboard`、`/research-tools` 及研究子頁轉址。
2. 最近有效正式測驗的六張作業卡片、有效題次分母、核心指標、前次可比較結果、同條件迷你趨勢與詳細入口。
3. 8 欄預設紀錄表與手機卡片；原篩選、多選、全選、清除、分頁、個別／整合 Excel、逐題圖片及原始 JSON 保留。
4. 移除前端以 60／80 正確率和資料新舊產生的臨床風險推論；顏色描述資料品質／可判定條件，常模 schema 停用。
5. 備註失敗保留草稿；個案／頁面切換保留目前帳號的記憶體草稿；帳號切換清空資料、草稿與選取，忽略舊回應及舊 Excel 下載。
6. 提醒歷程、人工備註及客觀報告分開；只使用現有 schema 欄位。
7. 研究首頁以有效參與者、有效 Trial、完整率、六作業及有來源的觀察為主；原進階模型、統計、UCB1、縱向分析、匯出仍可展開。
8. ARI 的 cat／dog 保留為原始計分角色；顯示依 soundAnimal／stimulusAnimalLabels，沒有動物欄位時只稱角色 A／B。DCCS 雙規則依 matchBy／rule 分列，原 ruleStage 另行保留。
9. 已記錄的施測版本／設定快照供顯示層比對，沒有補寫來源版本或更改任何特徵／計分演算法。

## 實際自動驗證

| 檢查 | 結果與範圍 |
|---|---|
| 修改前基準 | 6 組、49 項通過 |
| 整合驗收 | 21 組、122 項通過；4 個快照通過 |
| 最後 DCCS／資料讀取回歸 | 5 組、52 項通過；未增加或改動計分測試的預期值 |
| 最後帳號／助手回歸 | 2 組、5 項通過 |
| 受保護內容 | 138 個既有正式測驗、訓練、協定、計分、config、analytics、Supabase 檔案的 SHA-256 與修改前一致 |
| 程式與 CSS | 本次修改元件、工具及資料讀取檔的 ESLint 通過；新增 CSS 由 PostCSS 成功解析 |
| 資產 | `npm run check:assets` 通過 |
| 正式建置 | 最終 `CI=true npm run build` 通過，輸出 Compiled successfully |
| 部署內容檢查 | `npm run check:deploy` 通過：254.13 MiB，無禁止路徑、source map、過大資產或 LFS 指標；沒有部署 |
| 本機服務 | 既有 3000 前端及 3001 API 已在執行；以瀏覽器導覽的 Accept: text/html 檢查兩個專業端路徑，均為 HTTP 200 及 React root。入口包含新的共用 Provider；臨床頁實際引用的各分割資產亦為 200。這不等於登入後資料已驗證 |

整合測試包含下列檔案，使用合成資料與 mock Supabase，沒有發送真人提醒或修改正式患者資料：

```text
src/pages/ClinicianProfessionalWorkspace.test.jsx
src/components/professional/ProfessionalWorkspaceContext.test.jsx
src/utils/professionalMetrics.test.js
src/utils/clinicianExcelExport.test.js
src/utils/clinicianDashboardFormatters.test.js
src/pages/assistantEmailFlow.test.jsx
src/pages/ResearchTools.test.jsx
src/components/research/ResearchWorkspaceContext.test.jsx
src/utils/researchPresentation.test.js
src/pages/ResearchToolsPresentation.test.jsx
src/components/research/ResearchPresentation.test.jsx
src/components/clinician/ClinicianDashboardShell.test.jsx
src/components/research/ResearchDataIntegrity.test.js
src/components/research/ResearchDataExports.test.jsx
src/components/research/ResearchStudioUI.test.jsx
src/ResearchToolsRouting.test.jsx
src/lib/database.test.js
src/components/ProtectedRouteRecovery.test.jsx
src/pages/ClinicianLoginPage.test.jsx
src/analytics/features/__tests__/featurePipeline.test.js
src/analytics/features/__tests__/taskSpecificFeatures.test.js
```

可重跑：將上述路徑交給 `npm test -- --watchAll=false --runInBand --testTimeout=20000 --runTestsByPath <路徑...>`。另執行 `node scripts/check-professional-boundaries.mjs`、`npm run check:assets`、`CI=true npm run build`、`npm run check:deploy`。

沒有將本次相關測試通過宣稱為所有既有遊戲分支／整個專案的完整驗證。工作目錄開始前就存在的其他變更另行保留。

## 修改檔案清單

此清單只列本次專業端整合；部分檔案亦包含之前已完成的登入／研究讀取修正，沒有回退那些內容。

### 共用元件及狀態

```text
src/App.js
src/components/professional/ProfessionalNavigation.jsx
src/components/professional/ProfessionalWorkspaceContext.jsx
src/components/professional/ProfessionalWorkspaceContext.test.jsx
src/components/professional/ProfessionalData.jsx
src/components/professional/ProfessionalRecords.jsx
src/components/professional/ProfessionalResearch.jsx
src/styles/ProfessionalWorkspace.css
```

### 指標、顯示及匯出

```text
src/config/professionalIndicators.js
src/utils/professionalMetrics.js
src/utils/professionalMetrics.test.js
src/utils/professionalStatus.js
src/utils/professionalLabels.js
src/utils/professionalReport.js
src/utils/professionalResearch.js
src/utils/clinicianExcelExport.js
src/utils/clinicianExcelExport.test.js
src/utils/clinicianDashboardFormatters.js
src/utils/clinicianDashboardFormatters.test.js
src/utils/researchPresentation.js
src/utils/researchPresentation.test.js
src/lib/database.js
```

### 醫療端

```text
src/pages/ClinicianDashboard.jsx
src/pages/ClinicianProfessionalWorkspace.test.jsx
src/components/clinician/ClinicianDashboardShell.jsx
src/components/clinician/ClinicianDashboardShell.test.jsx
```

### 研究端

```text
src/pages/ResearchProfessionalDashboard.jsx
src/pages/ResearchStatistics.jsx
src/pages/AIBehavioralAnalysis.jsx
src/pages/AdaptiveRecommendationResearch.jsx
src/pages/LongitudinalDashboard.jsx
src/pages/ResearchTools.test.jsx
src/pages/ResearchToolsPresentation.test.jsx
src/components/research/ResearchStudioLayout.jsx
src/components/research/ResearchWorkspaceContext.jsx
src/components/research/ResearchStudioUI.jsx
src/components/research/ResearchPresentation.jsx
src/components/research/ResearchPresentation.test.jsx
src/components/research/ResearchTaskGuide.jsx
src/styles/ResearchStudio.css
```

### 保護與說明

```text
scripts/check-professional-boundaries.mjs
docs/professional-protected-baseline.json
docs/professional-workspace-audit.md
docs/professional-workspace-validation.md
```

## 真人／正式環境驗收清單

- 以正式專業帳號確認臨床個案授權、研究 consent 與 RLS；另用未授權及已撤銷帳號驗證不能讀取資料。
- 在桌面、平板及手機瀏覽器檢查卡片、導覽、表格、觸控、鍵盤焦點、抽屜、暗色模式與下載。DOM 測試不等於實際瀏覽器視覺驗收。
- 以正確權限實際儲存備註、建立提醒並確認家長端狀態；本次沒有對正式資料執行寫入。
- 人工核對歷史缺少版本、負荷、刺激與重複題次來源的紀錄；原資料未自動修補或刪除。
- 若需備註修改時間、對應測驗外鍵或獨立研究角色，須另行規劃 schema／政策；目前沒有虛構欄位。

尚未部署。臨床與研究演算法、UCB1、正式遊戲流程與 RLS 均維持工作開始時的內容。
