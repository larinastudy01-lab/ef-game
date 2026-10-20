# 蒐秘密 Research Studio 介面重構交付

本次在既有 `/research-tools` 五合一入口上重構呈現與互動，涵蓋研究總覽、研究統計、AI 行為分析、自適應建議、縱向追蹤。

## 介面變更

| 範圍 | 完成項目 |
| --- | --- |
| 共用框架 | 固定左側導覽、可收合側欄、手機導覽抽屜、置頂標頭、共用參與者／任務篩選、重新整理、品質與方法說明抽屜、亮暗模式。 |
| 品牌與遊戲說明 | 左上使用既有遊戲 Logo `public/logo192.webp`。研究路由隱藏全站設定齒輪，並移除研究標頭設定按鈕。側欄下方列出六個遊戲，逐一展開名稱、簡稱、主要規則、收集內容與紀錄欄位。 |
| 研究總覽 | 首先呈現範圍內 KPI、品質摘要、六項任務代表指標、個人趨勢及真實事件；保留原有分析與匯出入口，事件可檢視題次資料。 |
| 研究統計 | 樣本與特徵摘要在前，接續平均比較、直方圖與箱型分布，再提供可搜尋／排序的完整描述表格；相關與任務分析保留在進階區。 |
| AI 行為分析 | 顯示實際目標資料人數／20、模型狀態與限制；明確區分模擬預覽、資料不足及錯誤；保留特徵重要性、模型比較及個別解釋。 |
| 自適應建議 | 策略平均與最後 20 回合回饋比較、實際每回合回饋曲線、完整策略表及真實建議紀錄分區；持續標示模擬與非因果限制。 |
| 縱向追蹤 | 指標、測驗／訓練及難度篩選；不同條件分線，缺失與未完成保留缺口；首次／最近觀察比較、原有基準及移動平均、真實時間軸與題次詳情。 |

參與者主要顯示本機穩定的 `P-001` 等代號，識別詳情保留 UUID。代號對應保存在本機瀏覽器；換裝置或清除儲存後應以 UUID 核對。匯出內容不改成介面代號。

## 修改與新增檔案

| 檔案 | 用途 |
| --- | --- |
| `src/App.js` | 五合一與舊研究路由不顯示全站設定齒輪；原有路由重新導向保留。 |
| `src/pages/ResearchTools.jsx` | 五個研究頁面共用框架與載入狀態；保留已瀏覽頁面的各自控制狀態。 |
| `src/components/research/ResearchStudioLayout.jsx` | `ResearchLayout`、`ResearchSidebar`、`ResearchHeader`、`ResearchFilterBar`，以及品質、方法與導覽抽屜。 |
| `src/components/research/ResearchStudioUI.jsx` | 下列共用呈現元件及匿名代號 context。 |
| `src/components/research/ResearchTaskGuide.jsx` | 側欄及收合側欄抽屜中的六遊戲說明。 |
| `src/components/research/ResearchPresentation.jsx` | 研究主題 context、可共用的亮暗切換及巢狀頁面框架。 |
| `src/styles/ResearchStudio.css` | 設計 tokens、卡片、表格、側欄、抽屜、響應式、焦點及降低動態偏好。 |
| `src/utils/researchStudioPresentation.js` | 顯示代號分配、呈現用場次摘要、任務代表指標與事件標籤。 |
| `src/config/researchTaskGuide.js` | 依既有測驗頁面及 protocol 整理的規則與收集欄位文案。 |
| `src/pages/ResearchProfessionalDashboard.jsx` | 總覽版面。 |
| `src/pages/ResearchStatistics.jsx` | 統計版面。 |
| `src/pages/AIBehavioralAnalysis.jsx` | 模型與解釋版面。 |
| `src/pages/AdaptiveRecommendationResearch.jsx` | 策略比較與建議歷程版面。 |
| `src/pages/LongitudinalDashboard.jsx` | 個人追蹤版面。 |
| `src/pages/ResearchTools.test.jsx`、`src/pages/ResearchToolsPresentation.test.jsx`、`src/ResearchToolsRouting.test.jsx` | 共用範圍、導覽、舊路由、品牌、說明、抽屜與設定圖示的驗證。 |
| `src/components/research/ResearchStudioUI.test.jsx`、`src/utils/researchStudioPresentation.test.js` | 表格不可變性、焦點、題次、準備度及匿名代號驗證。 |
| `src/components/research/ResearchDataIntegrity.test.js` 及其 snapshot | 相同範圍的統計、縱向、匯出、模型及策略數值一致性驗證。 |
| `README.md`、`docs/research_professional_dashboard.md`、本文件 | 入口、呈現及交付說明。 |

共用元件包括 `PageHeader`、`SectionHeader`、`MetricCard`、`StatusIndicator`、`ResearchNotice`、`EmptyState`、`LoadingState`、`ModelStatusCard`、`ChartContainer`、`ResearchDataTable`、`ResearchDrawer`、`ResearchTimeline`、`TrialDetails`、`ParticipantLabel` 及 `ResearchTaskGuide`。

## 保留的研究功能

- 共用載入流程、雲端 API、登入及專業角色存取保護。
- 所有原始採集紀錄、缺失與排除規則、特徵定義、統計與縱向演算法。
- 既有模型目標、最少 20 位參與者條件、模型參數、資料切分與解釋流程。
- 原有固定 seed 的策略演算法、reward、建議紀錄與版本。
- 匯出檔案、欄位、順序、格式及原始研究識別代碼；表格搜尋與排序只影響畫面。
- 五合一分頁狀態、現行六項任務目錄及舊網址導向。DPT、SSG、SSS 不納入現行分析，歷史採集內容保留。

未新增套件；圖表沿用 Recharts。此次重構開始前保留的 73 個核心研究、資料與權限檔案 SHA-256 指紋比對無變更。數值一致性快照同時涵蓋三個範圍的統計／縱向／完整匯出及既有模型／策略；策略比對只略去每次執行都不同的稽核時間戳，保留所有數值結果。

## 驗證與待確認

自動化驗證結果：

- `CI=true npm test -- --watchAll=false --runInBand`：73 組、456 個測試通過，4 份一致性快照通過。
- `npm run build`：正式版建置成功；補齊圖表的軸向、樣本單位與分布說明後再次建置成功。
- 圖表說明調整後重跑 5 組研究介面及一致性測試：24 個測試、4 份快照通過。
- `npm run check:assets`：通過。
- 修改範圍 ESLint：通過，無錯誤／警告（另有 Browserslist 環境提示）。
- 73 個受保護核心檔案的 SHA-256：全部保持一致。
- `npm run check:deploy`：未通過，216.27 MiB 超過既有 190 MiB 上限。本次沒有修改容量限制、移除遊戲素材或執行部署。
- 測試中的舊版 React 測試工具／Router 提示及建置的 Browserslist 資料過期提示未影響通過結果。

瀏覽器環境未提供可控制的頁籤，因此目前尚未完成實際桌機、平板、手機視窗的視覺驗收，也未連接正式帳號操作線上資料。相關樣式與鍵盤／抽屜互動已有程式及 DOM 測試。

人工驗收應涵蓋三種視窗寬度的側欄與遊戲說明捲動、亮暗模式、圖表 tooltip、長表格水平捲動，以及正式帳號的雲端讀取和下載。臨床危急值來源與確認稽核目前仍依既有未啟用狀態呈現；沒有新增疾病風險預測。
