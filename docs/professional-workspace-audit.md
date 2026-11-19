# 專業分析平台：盤點、邊界與功能保留

日期：2026-11-19。範圍為既有 React 專業端的資料讀取與呈現層；未操作正式資料庫、未部署。

## Phase 1：修改前基準

- 已完整閱讀使用者提供的六階段需求。
- 修改前已存在大量測驗、訓練、RAG、儲存修復變更；以當時工作目錄的實際內容為基準，沒有以 Git HEAD 覆蓋。
- `scripts/check-professional-boundaries.mjs --record` 記錄 138 個既有受保護檔案的 SHA-256，保存於 `professional-protected-baseline.json`。涵蓋六項測驗／訓練頁、既有 config、正式 protocol／scoring／level 模組、所有 analytics 與 Supabase SQL；測試檔除外。
- 修改前 6 組、49 項測試通過：Clinical shell、Excel round trip、助手寄信選項、ResearchTools、資料完整性、database。
- 完成後執行 `node scripts/check-professional-boundaries.mjs` 核對本次工作沒有改動上述內容。此證據只針對本次工作開始後的差異，不代表既有未提交修改已全部通過驗證。

## 原有資料流與邊界

| 範圍 | 入口／主要元件 | 資料來源與守門方式 | 本次處理 |
|---|---|---|---|
| 專業端登入 | ProtectedRoute、ClinicianRoute、ClinicianLoginPage | Supabase getUser、profiles.role；原有 clinician/medical/doctor 路由條件 | 保留；共用 Provider 不授予角色或存取權 |
| 醫療個案 | ClinicianDashboard | clinician_patient_access 依 clinician_id；patients/game_results/clinician_notes 依授權 patient_id；RLS 再確認 | 保留查詢範圍；跨帳號清除快取與未完成請求 |
| 本機結果 | readLocalResultPayloads | 原有已授權 patient_id 篩選 | 再要求明確 syncOwnerId 與目前帳號一致；未知或其他帳號本機內容不展示、不刪除。雲端紀錄照原授權讀取 |
| 備註 | clinician_notes | id、patient_id、clinician_id、note、created_at | 只使用真實欄位；沒有修改時間或測驗外鍵，不虛構這些資訊，不新增資料表欄位 |
| 提醒 | parent_reminders | reminder_type、title、message、status、read_at、created_at | 保留新增；補讀既有提醒歷程及類型、建立時間、狀態 |
| 研究 | ResearchWorkspaceContext、database.getResearchFeatureInputsFromCloud | 獨立 profiles 檢查；behavioral_task_sessions、sessions、trials、derivations、research_participants、game_results；各表 RLS | 保留獨立讀取；不把臨床患者名單塞入研究參與者集合 |
| 模型與自適應 | analytics、recommendation、ml_experiments | 既有特徵、模型、研究門檻、建議歷程及 UCB1 | 不改演算法、特徵、推薦策略或門檻；調整 UI 展開層級與研究限制說明 |
| 助手 | /api/clinical-assistant、AssistantEmailControls | 原有 bearer token、目前個案 context、寄信選項 | API 不變；移除前端 60/80 風險式建議、補比較條件與缺值；舊個案／舊帳號遲到回應不再放入目前聊天 |
| 匯出 | clinicianExcelExport、ResearchDataExports | 既有 Excel、CSV、JSON、模型／統計 export bundle | 保留；臨床 Excel 增加定義、條件、限制與安全的比較表 |

目前程式庫沒有可直接沿用的獨立「研究人員」前端角色授權矩陣；研究入口沿用原來的專業端守門，研究查詢仍由各研究表 RLS 決定。整合導覽沒有新增研究授權、寫入 consent、修改 RLS 或繞過權限。正式環境是否套用特定 research_views consent 範圍，必須以該環境實際 SQL／政策核對，不能由介面整合推定。

## 功能保留對照

| 原功能 | 整合後位置／行為 |
|---|---|
| 新增已授權兒童、刷新、登出 | 專業端頁首；仍需原一次性家長授權碼 |
| 個案搜尋及狀態篩選 | 個案清單；原風險選項改為資料異常、待確認、品質通過、資料不足 |
| 六項摘要與點選趨勢 | 六項作業卡片；最近有效正式測驗、分母、核心指標、比較條件、詳細入口 |
| 測驗／訓練與六遊戲複選 | 紀錄與比較；保留所有原篩選與分頁，不裁切原始紀錄 |
| 原始分數、星級、能力、來源欄位 | 紀錄表「欄位設定」及完整詳情；預設表格 8 欄 |
| 多筆勾選、全選篩選結果、清除 | 紀錄與比較；仍可輸出整合 Excel |
| 兩次測驗比較 | 新共用比較元件；條件不同／缺少版本時並列數值但不算變化 |
| Trial 圖片、座標、單題問答、JSON | 選取紀錄後的原有詳細／逐題展開區，完整保留 |
| 醫療備註 | 個案追蹤工具；失敗保留草稿，不建立假成功紀錄；依個案保留本次記憶體草稿 |
| 家長提醒 | 個案追蹤工具；保留所有既有模板、新增與訊息內容，新增歷程列表 |
| 個案摘要／複製 | 個案追蹤工具；客觀資料、人工紀錄與追蹤提醒分開 |
| 研究統計與研究篩選 | 研究工作區；仍維持共用 participant/task filter 及原有 tab 狀態 |
| AI 模型、模擬預覽、特徵重要性、SHAP | AI 頁；模擬明確標示，方法／詳細數值可展開，實際資料證據獨立呈現 |
| UCB1、推薦、難度歷程、回饋 | 自適應頁；原內容與策略保留 |
| 縱向趨勢、基準、移動平均、事件時間軸 | 縱向頁；版本／條件不同分列，條件不明不跨次連線；既有演算法明細保留 |
| 研究 CSV／JSON／原始資料下載 | 「資料與說明 → 研究資料匯出」；直接開啟總覽的匯出展開區 |
| 資料品質與歷史重複來源紀錄 | 研究品質抽屜；保留之前修正的隔離及診斷，不改寫 LB 原始操作 |

## Phase 2–5：實作結構

- `professionalIndicators.js`：六項指標登錄、來源欄位、公式、有效規則、適用範圍、文獻／作業／UI 定義類型及驗證狀態；常模 schema 完整停用。
- `professionalMetrics.js`：獨立顯示層重算；原始資料不變；缺值不補零；正式完成狀態必須有來源；比較條件須完整。
- `professionalLabels.js`：專業端統一中文名稱；ARI 舊 cat／dog 特徵只稱角色 A／B，不臆測實際動物。
- `professionalStatus.js`、`ProfessionalData`：四態顏色與文字、指標卡、詳情、比較與方法共用。
- `ProfessionalNavigation`：共用品牌、臨床導覽與研究入口；既有 URL 及獨立守門保留。
- `ProfessionalWorkspaceContext`：只在記憶體保存帳號綁定的目前個案與草稿；頁面切換保留，身份變更清除；不持久化病患資料。
- `ProfessionalRecords`：8 欄預設表格、選配原始欄位、手機卡片；原有選取／開啟／匯出回呼不變。
- `professionalReport.js`：客觀結果、資料限制、人工備註、實際提醒分開；不生成總能力分數或風險分類。
- `professionalResearch.js`、`ProfessionalResearch`：研究資料自己的參與者／題次分母；作業、模式、條件分組；小樣本亦只陳述可追溯的資料證據。
- `ProfessionalWorkspace.css` 與研究 token：專業端作用域；左導覽、1440px 內容、卡片、手機呈現；不影響家長／兒童遊戲頁。

## 指標規則

| 作業 | 顯示層公式與資料規則 | 不推論的項目 |
|---|---|---|
| SRT | 明確 Go 的命中／Go 已施測有結果題；Go miss／相同分母；No-Go clickedRotten 或 falseAlarm／No-Go 分母；答對非逾時且有效 RT 的均值與樣本 SD；依實際順序前 floor(N/2) 與其餘題正確率差，N≥4 | 整體正確率不等同抑制能力；golden 遊戲獎勵／背景操作不當作正式 Go 題 |
| PM | 各 memoryCount／memorySpan 的正確／有效題；部分分數僅讀取實際 scoreValue／partialScore／partialCredit；保留錯選、漏選；最高曾答對負荷只作描述 | 不推算不存在的部分給分、不把最高負荷稱穩定廣度或記憶年齡 |
| CBT | 正確題最大實際序列長度；長度別分母；明確順序錯誤／漏選；有完整 expected/actual 陣列時才以同項不同順序及缺少項目補描述 | 不改正式連錯兩次停止；不以不同序列長度的整體正確率判定能力 |
| ARI | 實際 soundAnimal／stimulusAnimalLabels 的正確率（缺少動物資料才保留聲音角色）、選擇位置次數、明確錯誤種類、正確有效 RT | 不生成一致／不一致刺激或注意偏誤指數 |
| DCCS | ruleStage／rule 分列顏色、種類、袋色及原始雙規則；明確切換後錯誤；僅 isPerseverativeError／isOldRuleInterference 的明確布林標記 | 一般錯誤不當成固著；既有遊戲判定欄位的定義不由 UI 改寫 |
| LB | ruleType 別正確率、明確序列／規則錯誤、有效 RT；只有明確 completedSteps／totalSteps 才算完成比例；stageRecords 各自列出已記錄階段 | 不由已觀察步驟猜完整計畫分母；不臆測規劃能力；重複來源原始操作不去重、不重編 |

共同規則：無已知結果／無已施測證據、未施測、未完成或明確無效題不納入有效正確率分母；明確逾時有作答結果時可納入正確率分母，但不納入 RT。有效 RT 沿用既有 `REACTION_TIME_LIMITS_MS` 取得品質界限，不更改它。沒有可算的 RT 顯示未記錄；SD 少於兩題不計算。數值比例均顯示百分比，跨次相減顯示百分點。

比較需相同任務、同一對象、模式、難度、明確施測版本（或來源確實記錄的完整施測設定快照）與實際題次條件組成。計分版本、題本／任務版本、作答上限如有差異也不判定；不同條件只並列。條件組成包含實際負荷、規則、目標／聲音類型、作答／呈現時間、stimulusSetId 與反向規則。沒有聲稱此嚴格規則消除了所有疲勞、裝置或練習效應。

## 四態規則

| 狀態 | 背景／文字 | 使用條件 |
|---|---|---|
| 綠 | #E2F1E8／#246B49 | 明確題次結果與來源品質檢查通過；不因答對率高就稱正常 |
| 黃 | #FFF1D7／#98640C | 完成狀態／部分資料待核對、比較條件不同或缺漏；不代表低能力 |
| 紅 | #F9E2E1／#AC3633 | 實際來源重複、儲存／載入／系統錯誤；不代表孩子的能力異常 |
| 灰 | #E8EBEF／#52606D | 無資料、無法判定、一般數值描述 |

`NORMATIVE_SCORING.enabled=false`。年齡群、作業、分數定義、參照群體、百分等級、效度、分類規則均預留為空，沒有虛構常模。既有研究模型分類門檻只保留其研究身分。

## 來源登錄的限制

SRT 背景參考：研究原文 [Psychometric Properties of a Combined Go/No-go and Continuous Performance Task across Childhood](https://pmc.ncbi.nlm.nih.gov/articles/PMC10041761/)。DCCS 背景參考：[Zelazo (2006)](https://www.nature.com/articles/nprot.2006.46)。這些文獻支持作業背景及描述指標的選擇，不驗證本平台的遊戲改編、介面規則或臨床分類。PM／CBT／ARI／LB 目前登錄為本作業欄位及規則，沒有冒稱已具臨床效度。

## 必須人工／正式環境確認的項目

- 真人專業帳號的 Supabase RLS、被撤銷／未授權個案、研究 consent，以及真實帳號切換。自動測試使用合成 fixture，沒有操作正式患者或資料庫。
- 桌面、平板與手機實際瀏覽器的字級、捲動、鍵盤／觸控、下載檔案流程及暗色模式。已提供響應式 CSS 與 DOM 互動測試，但不以 DOM 測試冒稱完成真人瀏覽器視覺驗收。
- 在正式權限下建立提醒、儲存備註及讀取歷程；本次僅以 mock 驗證寫入結果與錯誤處理。
- 需要對應測驗外鍵、備註修改時間或獨立研究角色時，另行設計 schema 與權限；本次不新增不存在的欄位。
- 歷史缺少施測版本、負荷或題次來源鍵的紀錄仍需人工核對；不自動補版本、改題號或修改原始來源。
