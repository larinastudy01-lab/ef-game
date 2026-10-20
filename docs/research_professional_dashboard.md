# 醫療研究與分析工具 — 五合一工作台

## Purpose and information architecture

The shared research workspace is available at `/research-tools`. It provides five views through a persistent left sidebar: 研究總覽、研究統計、AI 行為分析、自適應建議、縱向追蹤. The overview follows the evidence chain:

```text
Raw Behavior → Feature → Trend → Model → Explanation → Recommendation
```

Overview first shows scoped participant/session KPIs, a compact quality summary, six task cards with task-specific representative metrics, a selected personal trend, and actual research events with trial details. The original ten analysis sections remain available under an expandable advanced section; original research exports remain directly accessible at the bottom.

The specialist tools render inside the shared workspace. They share authorized data loading, participant/task selection and a single display theme. Visited tabs remain mounted, preserving controls such as distribution feature and model target type.

## Data provenance by section

- Overview uses the selected anonymous participant’s latest assessment and canonical Phase 2 features.
- Task Performance shows the six existing tasks separately and discovers only actual numeric task-specific features.
- Behavioral Analysis uses Phase 1 canonical trial derivations for RT/trial/error patterns and Phase 2 early/late/stability features.
- Statistical Analysis runs `statistics_v1` for the selected participant and switches to the research statistics tab.
- AI Prediction fits observed data only when at least 20 participants form the declared future-performance target. It does not substitute synthetic performance in this unified page.
- Explainable AI uses the validation-selected model. Individual output is displayed only when the selected participant belongs to the untouched test subset.
- Adaptive Training reads observed Phase 6 decision logs. Simulation is kept in the adaptive recommendation tab.
- Longitudinal Tracking uses `longitudinal_v1` personal-baseline series and switches to the longitudinal tracking tab.
- Experiment Info reads persisted Phase 4 metadata when the migration is available; otherwise it shows in-memory versions or “Not persisted”.

## Research exports

Exports follow the selected participant and current task. Selecting all participants explicitly enables a cohort export; individual predictions remain restricted to the selected participant when a single participant is selected:

- `raw_trials.csv`: immutable Phase 1 acquisition payload plus anonymous hierarchy IDs and raw schema version.
- `task_features.csv`: Phase 2 participant × task × session feature rows.
- `participant_features.csv`: Phase 2 cross-task participant-session rows.
- `statistics.csv`: Phase 3 statistics summary.
- `prediction.csv`: selected participant’s untouched-test prediction only, when available.
- `recommendation.csv`: observed Phase 6 decision/outcome records.

Nested values are JSON-serialized and CSV-escaped. Names, nickname, email and other direct identifiers are not added. Raw and derived exports remain separate so feature/statistical/model changes do not rewrite acquisition data.

## Interpretation and unavailable states

The interface does not use normal/abnormal traffic lights, disease-risk percentages, diagnosis conclusions or normative child comparisons. It uses behavioral pattern, relative performance, personal trend, model prediction and research interpretation language.

Missing migrations, insufficient sample size, absent repeated sessions and non-test-set individual predictions are shown as unavailable states. The dashboard does not generate replacement values merely to fill a card.

## 醫療研究與分析工具呈現原則

- 五個研究工具共用減法設計、可記憶偏好的亮色／高對比暗色模式，以及鍵盤焦點提示。藍色表示觀察資料，紫色表示移動平均；紅色僅用於有來源規則的危急警示，琥珀色表示待核對，資訊提示使用藍色。個人基準不標示為臨床正常範圍。
- 正確率與錯誤率使用百分比；反應時間 RT 使用 ms；正確率差異使用百分點。正確率趨勢固定 0–100%，反應時間從 0 起算，兩種單位分開繪圖。缺失、無效及未完成場次在個人趨勢中保留缺口，不補 0、不跨缺口連線。題次曲線只呈現單一最新場次。
- 個人摘要依時間排序，比較同一參與者、任務、測驗／訓練類型及已記錄難度，附基準日期、最新日期、有效觀察數與缺失說明。條件未記錄時會明示無法確認一致性。摘要由觀察值自動整理，沒有加入未收集的用藥或生理資料。
- 資料品質提示依類型彙整，不以一般行為分數或統計離群值推論臨床異常。`ResearchAlerts` 僅接受具有已驗證標記、規則代碼、版本、判定說明及觀察版本的危急警示，並要求明確確認；新觀察需要重新確認。確認僅保留於當頁記憶體，尚未連接醫療處置或稽核紀錄。
- 現有資料未提供經驗證的臨床危急值來源，因此資料品質區明示「臨床危急值監測：尚未啟用」。正式啟用仍需整合經驗證規則、臨床來源資料及伺服器端確認紀錄。
- AI 觀察模型以前 30% 題次預測同一任務後 70% 題次的正確率，沒有提供未來 24 小時敗血症或心衰竭風險預測。少於 20 位具備目標資料的參與者時顯示模型尚未就緒；模擬預覽必須由使用者明確開啟，並持續標示來源。策略模擬與實際建議歷程維持分區呈現。


## 五合一入口與任務範圍

| 原網址 | 導向分頁 |
| --- | --- |
| `/research-professional-dashboard` | `/research-tools?view=overview` |
| `/research-statistics` | `/research-tools?view=statistics` |
| `/ai-behavioral-analysis` | `/research-tools?view=ai` |
| `/adaptive-recommendation-research` | `/research-tools?view=adaptive` |
| `/longitudinal-dashboard` | `/research-tools?view=longitudinal` |

醫療首頁改為單一「開啟五合一研究工作台」入口。舊網址保留重新導向，整合入口維持專業角色存取保護。側欄支援上下／左右方向鍵、Home 與 End；桌機可收合，手機使用具焦點限制與 Escape 關閉的導覽抽屜。

現行任務目錄集中於 `src/config/researchTasks.js`：CBT 石頭記憶、PM 圖片記憶、SRT 橡實反應、ARI 貓狗反向、LB 幫助迷路的綿羊奶奶、DCCS 物品規則分類。研究入口以此清單篩選資料與建議紀錄，排除 DPT、SSG、SSS 及未知任務；不將舊任務強制改標為 ARI，也不改寫資料庫與歷史原始採集內容。ARI 不再標示為點探測任務或 Sound-Symbol Game。

參與者、任務與亮暗模式共用，資料只載入一次，可手動重新整理。統計與研究匯出依選取範圍執行；AI 以所選任務的全體參與者訓練，個別解釋依參與者篩選，避免將個別個案誤作訓練母群。自適應策略模擬固定使用現行六項任務，另明示上方篩選僅套用至實際建議歷程。個人基準摘要需選擇單一參與者與任務。


## Research Studio 介面元件與呈現

- 使用固定側欄、置頂標頭、共用篩選器與響應式卡片。品牌圖使用既有 `public/logo192.webp`；研究入口不顯示全站齒輪或研究標頭設定按鈕。
- 側欄下方列出 CBT、PM、SRT、ARI、LB、DCCS 的可展開遊戲名稱、簡稱、主要規則、收集內容及對應紀錄欄位。文案集中於 `src/config/researchTaskGuide.js`，不控制遊戲或採集邏輯。側欄收合時改由說明抽屜檢視。
- `ResearchStudioUI` 提供卡片、狀態、圖表容器、可搜尋／排序／分頁的表格、抽屜、真實事件時間軸與題次詳情。缺失仍顯示「—」。
- 參與者主要顯示 `P-001` 等本機穩定代號；完整 UUID 位於識別詳情。清除瀏覽器資料或換裝置後應以 UUID 核對，匯出仍使用原始研究代碼。
- 統計先顯示樣本及目前特徵摘要、分布與圖，再提供完整描述表格；多任務不合併平均。AI 資料準備度為實際具目標人數／20，與模型準確率分開。
- 策略比較呈現原有 seed 的平均回饋、最後 20 回合平均及實際每回合回饋，不做曲線平滑。縱向主圖以資料類型及難度分列，不混合正式評測與訓練。
- 所有新增樣式集中於 `ResearchStudio.css` 的研究範圍，沿用 Recharts，未新增套件。完整交付與檢查紀錄見 [介面重構報告](research-studio-ui-refactor.md)。
