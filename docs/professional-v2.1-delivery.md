# EF 專業分析平台 V2.1 交付紀錄

日期：2026-11-19。這份文件更新上一輪的介面呈現描述；完整原始盤點仍見 [professional-workspace-audit.md](professional-workspace-audit.md)。沒有部署。

## 1. 問題盤點與修復

本輪檢查 Clinical、五個研究分頁、共用元件、研究 API 讀取、六任務指標、Reward、品質隔離、匯出及追蹤工具。

| 原始問題 | 本輪修復 |
| --- | --- |
| Reward 使用動態座標 domain，六條線同時顯示、按陣列位置對應 | 核對定義後固定 0–1 刻度；策略版本＋實際回合對應；預設只開 UCB1 |
| 缺少策略比較與模擬條件 | 平均、累積、樣本標準差、有效／預定回合摘要；參數、種子、環境及原始回合收合 |
| AI 未建立仍有大型空狀態、重複提醒 | 共用模型狀態、真實／模擬模式分開；成功擬合後才有重要性及預測結果；保留不需模型的真實描述分析 |
| 百分比、RT、時間、缺值不一致 | 單一顯示工具，既有 clinical／research 格式入口委派；計算及匯出精度保留 |
| 品質頁 UUID、技術訊息占主畫面 | 五項有範圍的摘要、合併問題清單；分析影響及人工核對在詳情，UUID 再收合 |
| 表格過高、操作堆疊 | 預設八欄、目標 56px 列高、選取／詳情／Excel 同列；平板手機卡片保留操作 |
| 能力卡重複說明、單筆也畫大圖 | 最近有效結果、分母、核心指標及狀態優先；條件／方法收合；0／1／2／3+ 依可比較有效筆數呈現 |
| 摘要助手可能拉成底部橫條 | 原 inline left 與 CSS right 同時生效會拉伸 auto 寬度；明確 left:auto、限制寬度、右下入口及頁尾空間 |

## 2. 修改檔案清單

新增：

```text
src/utils/professionalFormatters.js
src/utils/professionalFormatters.test.js
src/utils/rewardPresentation.js
src/utils/rewardPresentation.test.js
src/components/professional/RewardSimulation.jsx
src/components/professional/ObservationResults.jsx
src/components/professional/ProfessionalV21.test.jsx
src/components/research/ResearchQualityPanel.jsx
docs/professional-v2.1-preservation-baseline.json
docs/professional-v2.1-delivery.md
```

擴充既有：

```text
scripts/check-professional-boundaries.mjs
src/components/professional/ProfessionalData.jsx
src/components/professional/ProfessionalRecords.jsx
src/components/professional/ProfessionalResearch.jsx
src/components/research/ResearchStudioLayout.jsx
src/components/research/ResearchStudioUI.jsx
src/components/research/ResearchStudioUI.test.jsx
src/components/research/ResearchPresentation.jsx
src/components/research/ResearchPresentation.test.jsx
src/pages/AdaptiveRecommendationResearch.jsx
src/pages/AIBehavioralAnalysis.jsx
src/pages/ClinicianDashboard.jsx
src/pages/LongitudinalDashboard.jsx
src/pages/ResearchProfessionalDashboard.jsx
src/pages/ResearchStatistics.jsx
src/pages/ResearchToolsPresentation.test.jsx
src/styles/ProfessionalWorkspace.css
src/utils/clinicianDashboardFormatters.js
src/utils/clinicianDashboardFormatters.test.js
src/utils/researchPresentation.js
src/utils/researchPresentation.test.js
src/utils/professionalStatus.js
src/utils/professionalReport.js
```

工作目錄原有其他修改均保留，沒有把它們歸為本輪成果。`.tmp/professional-v21-*` 為本機驗收輸出。

## 3. 功能保留對照

| 功能 | 目前入口與保留方式 | 驗證範圍 |
| --- | --- | --- |
| 個案清單、搜尋、授權切換 | 醫療左側個案清單及原搜尋 | 個案／帳號切換、延遲回應與草稿隔離測試 |
| 六項摘要 | 醫療最近有效正式測驗卡；研究最近有效觀察、條件摘要收合 | 原指標測試及核心 hash |
| 正式測驗趨勢、訓練歷程 | 歷次資料；模式、難度、版本分列 | 0／1／2／3+ 與不同條件不比較 |
| 詳細紀錄、篩選、多選、比較 | 紀錄與比較；八欄表及響應式卡 | 全選、清除、任務篩選、選取、詳情及匯出回呼 |
| 分數、星級、構面、完整難度 | 欄位設定、完整紀錄、原始 JSON | 原欄位及 Excel 測試 |
| Excel、CSV、Trial | 原單筆／整合 Excel、研究匯出、逐題圖片及 JSON | Excel 結構、匯出與數值快照 |
| 家長提醒、備註 | 個案工具：原類型、自訂內容與歷程 | 備註失敗保留、切換隔離；沒有真人寫入 |
| 個案報告、複製 | 原報告及剪貼簿流程 | 客觀描述，沒有跨任務平均轉風險 |
| 研究統計 | 原完整統計表、分布、方法詳情 | 原統計、縱向與匯出快照 |
| AI | 真實資料／模擬預覽；成功擬合後顯示原模型結果 | 不偷偷替換模擬；無模型時不畫重要性圖 |
| 適性、六演算法 | 策略摘要、互動 Reward、原實際推薦歷程 | 六策略、原值對應、開關、範圍及 Tooltip |
| 縱向追蹤 | 原指標／模式／難度篩選、基準與移動平均詳情 | 原結果快照與條件隔離 |
| 品質、排除、待查 | 共用品質抽屜、原因及 UUID 收合 | 問題分級、LB 語意、Escape 及匯出導覽 |
| 方法及指標 | 共用方法入口及每筆作業詳情 | 原 registry 不變，正式數值保留 |

## 4. 共用元件及格式規則

擴充既有 `DataStatus`、`ProfessionalRecords`、`ProfessionalTaskCards`、`ResearchTaskSummaryGrid`、`ModelStatusCard`、`ResearchTrendChart`，沿用 `EmptyState`、`ResearchFindings`。`ObservationResults` 為三個趨勢入口共用的稀疏資料顯示；另外兩個新元件封裝原頁面的 Reward 與品質區塊。

`professionalFormatters.js` 是單一顯示工具；既有 `clinicianDashboardFormatters`、`researchPresentation` 保留 API 並委派。計算仍在原 analytics／professionalMetrics；匯出不採畫面四捨五入文字。

- 百分比摘要整數、詳情一位小數；明確區分 ratio 與 percent，不猜尺度。
- 正確率同步正確／有效題數；部分給分保留原始順序，計分上限回來源查核，不標成答對題數比例。
- 絕對 RT 摘要整數、詳情一位小數及有效 n；無有效反應單列。帶正負號的 RT 變化使用一般數字格式，不把負差誤認為無效 RT。
- 日期固定 Asia/Taipei、24 小時，列表 `YYYY/MM/DD HH:mm`，詳情可帶秒。
- 未記錄／不適用／未完成／資料不足／計算失敗／待人工確認／無有效反應各有標籤；缺值不補零。
- `adaptive_span_test` 顯示「適性廣度測驗」。`normal` 僅在已核對六任務 Protocol 的情境顯示「中等」；未知任務保留代碼及待確認提示。原值保留於來源。
- 品質通過為小型無底色文字；來源鍵多操作為黃色人工確認，不表示能力高低。
- 可比較條件沿用 `compareRecords`、`recordConditions`。缺版本或模式／難度／題次組成不同，不湊成趨勢。三筆只是 UI 規則。
- 指定色盤、卡片 12–16px、間距 16–24px、趨勢 260–280px、紀錄目標 56px；平板以下改卡片。像素尺寸及觸控尚未實機驗收。

## 5. 六任務指標定義

`professionalIndicators.js` 及 `professionalMetrics.js` 本輪逐 byte 不變。完整公式、來源、有效條件、模式、限制與文獻背景仍在原 registry 和「研究方法與指標說明」；下表僅提供索引。

| 任務 | 現有來源支持的內容 | 限制 |
| --- | --- | --- |
| SRT | Go 命中／漏答、No-Go 誤擊、正確 RT 平均與樣本 SD、固定前後段差 | 分母分列；不作抑制診斷 |
| PM | 負荷及整體二元正確率、原始部分分數、錯選／漏選、有效 RT | 部分分數不當作答對題；負荷不等價 |
| CBT | 最大曾答對長度、長度正確率、明確順序錯誤／遺漏、停止原因 | 不是穩定能力、記憶年齡或常模 |
| ARI | 實際聲音動物條件正確率、選擇分布、有效 RT | 缺動物來源僅列角色；不推定刺激 |
| DCCS | 顏色／種類／袋內衣物顏色、原始階段、明確切換及舊規則干擾 | 一般錯誤不能反推固著 |
| LB | 規則正確率、明確排序錯誤、完成／計畫步數、有效 RT | 缺計畫分母不推算；多操作來源待核對 |

AI 真實資料 RT 分布使用來源 `valid_trial=true` 的 RT 區間頻數，與任務指標只採正確反應的 RT 分開標示；錯誤型態未記錄不代表沒有錯誤。沒有新增模型或臨床閾值。

## 6. Reward 結果與限制

既有 `rewards.js` 的 reward_balanced_v1 為 0.55 accuracy + 0.20 efficiency + 0.15 stability + 0.10 completion；原函式最終限制為 0–1，未更動。因此圖軸固定 0、0.25、0.5、0.75、1。**介面不截斷原始來源數值。**

顯示 adapter 檢查有限數值、空值、範圍、整數／重複回合及策略／Reward 版本。合法數值字串轉為繪圖數字並提示；非法值在圖上留空、原始 JSON 保留。回合不完整不提供冒充完整策略的平均／累積／SD。摘要從原始 Reward 計算樣本 SD（n−1），測試核對原平均、逐回合來源及手算序列。

原模擬種子 20260730、120 回合，環境使用 seed＋policyIndex；六策略的公式、初始狀態及安全邊界一致，但噪音序列**不是逐回合配對相同**。介面公開各種子、建構參數與環境，不變更模擬器假造一致性。多種子或配對噪音研究需另作方法設計，單次模擬不能推論幼兒訓練或臨床成效。

六策略開關完整，預設 UCB1；曲線保留原始 Reward、不平滑。範圍只篩圖，不改全回合摘要。原最後 20 回合均值、版本及完整原始回合收合保留。

## 7. 品質分類與排除

抽屜範圍為本次全部現行任務，明示不隨個案篩選縮減；可讀＋隔離紀錄為檢查分母。通過／待確認／已確認數值範圍錯誤／資料不足為綠／黃／紅／灰；後兩類亦在分類詳情列出數量，四類可追溯。

Trial 排除僅合計可讀紀錄既有 excluded_trial_count；缺失不補零。隔離紀錄 Trial 數未知，另列，不冒充 Trial 數。排除原因可重複標記，不相加為總題數。非現行任務為獨立範圍排除。

LB 依 `taskFieldMappers.js`、`TrainingPage_LB.jsx` 和 [既有逐筆核對](p0b-acceptance-2026-10-23.md) 檢查：舊 trialId 來自 level.id 和 stepIndex；答錯後可在同一步繼續操作直到正確。新版正式題次另採 stageId＋stepIndex。舊文件列 45 個不同操作、33 個唯一舊鍵；這是既有核對證據，本輪未重新讀取正式資料庫。

不能據此刪除、去重、補流水號或把每個操作當獨立正式 Trial。原資料讀取隔離邏輯逐 byte 保留；隔離紀錄不進入研究特徵、統計、AI、縱向分析。是否影響原計分需人工比對計畫步驟、時間、wrong→correct 序列、stageRecords 與原始分數。清單提供分析影響、不可用指標、原始保留及核對待辦。

## 8. 實際執行驗證

| 檢查 | 結果 |
| --- | --- |
| 最終整合測試 | 24 組、141 項通過，4 個既有快照通過且未更新 |
| 數值及互動 | 缺值不補零；Taipei 日期；有分母的正確率；RT n；Reward 六策略／原值／重排／異常值／SD／開關／回合範圍／Tooltip；AI 兩模式；0／1／2／3+；未完成計畫題數及單列操作 |
| 既有功能回歸 | 個案／帳號／草稿隔離、登入恢復、API 讀取、Excel／CSV、原始題次、研究導覽／抽屜、統計／模型／模擬數值快照 |
| 保護邊界 | 138 個原核心檔案＋5 個額外指標／匯出／資料／權限檔案 hash 一致 |
| ESLint | 本輪元件／頁面／格式工具 0 error、0 warning；Browserslist 資料庫舊版提示來自工具鏈 |
| CSS | PostCSS 成功解析 155 條規則 |
| 資產 | npm run check:assets 通過 |
| 正式建置 | CI=true npm run build：Compiled successfully，exit 0 |
| 部署內容 | npm run check:deploy 通過；254.16 MiB，無禁止路徑、source map、過大資產或 LFS 指標；未部署 |
| 本機路徑 | Accept:text/html 的 /clinician-dashboard 與 /research-tools 均 HTTP 200、包含 React root；不代表登入後資料畫面已通過 |

測試證據：`.tmp/professional-v21-final.json`、`.tmp/professional-v21-final-tests.log`；建置：`.tmp/professional-v21-build.log`。首輪 43 項通過；中途 138／139 通過，失敗是品質詳情「缺失欄位」標題改動，恢復該標題後最終全通過。測試使用合成資料／mock，沒有發送真人訊息或寫入正式個案。

最終 24 組測試為上一輪交付文件所列 21 組，加上 professionalFormatters、rewardPresentation、ProfessionalV21。原研究快照未重錄。測試工具輸出包含既有 React act 棄用／非同步警告及故意模擬資料讀取失敗的 console 訊息，不是正式系統錯誤。沒有宣稱整個專案所有測試皆已執行。

## 9. BLOCKED 及人工待辦

- **BLOCKED：登入後桌面、平板、手機的像素／觸控驗收。** Computer Use 發現標題像專案的 Chrome 視窗實際為 ChatGPT 對話，沒有對它輸入。嘗試選取另一 Chrome 視窗確認網址時，自動核准審查拒絕，理由是該視窗為 YouTube、超出專案授權。本輪停止該 UI 操作，未繞過。需允許開新專案分頁驗收，或使用者自行開專案頁。
- **BLOCKED：正式 RLS、真人跨帳號存取、雲端備註／提醒寫入及實際下載後開檔。** 本輪不使用真人登入、不寫正式資料；mock 測試與 hash 不能取代正式環境驗證。
- LB 操作事件／正式 Trial 契約及版本化修復，需研究者確認；保留隔離，不擅自轉換。
- 20 位參與者為現有頁面設定，已標「目前專案設定之資料門檻，尚待方法驗證」。樣本充分性、同齡常模及臨床分級未驗證。
- 原相關分析自動建議依樣本數、偏態及離群比例，沒有只靠常態檢定；仍未檢查完整設計／尺度假設。原演算法不改，方法區提示需研究者確認。
- 本地 clinician_notes schema 僅 created_at，無 updated_at；保留建立時間及修改時間未提供說明，未捏造欄位。

## 10. 資料及核心邊界

沒有更改資料庫 schema、RLS、正式紀錄、六任務規則／計分／難度升降、UCB1、Reward 定義、素材或語音。沒有新臨床風險門檻、跨任務 EF 總分或部署。

執行 `node scripts/check-professional-boundaries.mjs` 可重驗 138 個原核心檔案及本輪開始時新增保護的五個檔案：professionalMetrics.js、professionalIndicators.js、clinicianExcelExport.js、database.js、ResearchWorkspaceContext.jsx。兩份基準各自保留，沒有重錄覆蓋原基準。
