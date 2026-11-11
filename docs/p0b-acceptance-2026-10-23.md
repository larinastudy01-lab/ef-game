# 第一輪 P0-B 工程修正與驗收報告

日期：2026-10-23，Asia/Taipei。**本機修正與唯讀預檢已完成；隔離資料庫驗收未完成，正式驗收維持未結案，評分維持 56/100。** 使用者已確認目前沒有隔離測試環境，因此沒有建立遠端專案、寫入正式資料庫、執行正式 Migration／歷史修復、修改正式同步狀態／環境設定或部署服務。

## 1. P0-B 驗收總覽

| 項目 | 結果 | 限制 |
| --- | --- | --- |
| P0-A 實際程式與文件核對 | 完成 | 保留前輪修改，沒有重做評測規則 |
| 正式庫唯讀逐筆預檢 | 100 筆主結果、1,214 個原始紀錄完成分類 | 不是歷史資料已修復 |
| ARI 相容方案 | 兩張表的 forward／rollback SQL 草案與前置 catalog 已提供 | 未經隔離 PostgreSQL 執行 |
| 補齊工具安全修正 | 本機測試通過 | P0-B 只能對隔離合成資料 apply；正式目標硬性封鎖 |
| 完整 CRA/Jest 回歸 | **85 套件、656 測試、4 快照全部通過**，174.707 秒 | 包含前輪 632 項及新增 24 項；資料庫使用替身 |
| Node 驗收工具測試 | **24/24 通過** | 原 18 項及新增 6 項分類測試 |
| ESLint／語法／diff 檢查 | 通過 | Browserslist 提示資料庫過期，未安裝或更新套件 |
| 真實 PostgreSQL／PostgREST／JWT RLS | **28 案例全部未驗證** | 未確認可丟棄的獨立環境，未執行寫入 |
| 裝置斷線／瀏覽器重啟 | 程序已提供；未實機驗證 | 不以新 client 或記憶體模擬代替 |

成功取得的完整唯讀快照為 **2026-10-23 14:58:41（Asia/Taipei）**。收尾再次唯讀查詢時，Supabase 回報 `OAuth token refresh failed: Failed to parse server response`，因此**收尾複核未驗證**。兩次成功快照（14:53:59、14:58:41）的 100 筆主結果 payload hash 無差異；不能據此宣稱之後所有外部活動都未變動。見 [唯讀執行證據](p0b-production-readonly-verification-2026-10-23.json)。

## 2. Schema 相容性報告

真實 catalog 及 policies 見 [schema 證據](p0b-schema-evidence-2026-10-23.json)。以下兩個 CHECK 都仍只接受 `CBT, PM, SRT, SSG, LB, DCCS`：

- `behavioral_task_sessions_task_code_check`
- `behavioral_trial_derivations_task_code_check`

本機 `supabase/rebuild/04_CREATE_RESEARCH_RECOMMENDATION.sql` 的兩張表則接受 `CBT, PM, SRT, ARI, LB, DCCS`。因此不只 Task Session，Derivation 也需要相容遷移；僅修一處仍會失敗。

| 輸入代碼 | 實際用途／對應規則 | 處理方式 |
| --- | --- | --- |
| ARI | 正式六項任務之一，貓狗反向／Auditory Rule Inhibition | 唯一寫入代碼仍為 ARI；正式主結果有 4 筆、48 題 |
| ART | 目前 src 未找到實際用途，100 筆資料也沒有此代碼 | 未映射；不推定為 ARI；隔離負向測試必須拒絕 |
| SSG | 舊主結果 20 筆；目前研究任務清單已排除 | 保留舊讀取與原代碼，不自動改名或套用新 ARI 計分 |
| DPT | 舊主結果 1 筆；目前研究任務清單已排除 | 保留來源，需確認舊任務語意，不把 DPT 加入現行六任務 |
| 其他既有明示別名 | 例如 CORSI → CBT，沿用原 normalizeTaskCode | 本輪不新增猜測式別名，不修改 raw payload |

`researchTaskCodeCompatibility()` 統一工具的 current／legacy_read_only／unmapped 判定；`normalizeTaskCode()` 舊讀取行為保留。正式 parent 結果查詢與現有研究清單不改名。

草案位於 `scripts/p0/sql`，刻意沒有放進自動 Migration 目錄：

1. [00-preflight.readonly.sql](../scripts/p0/sql/00-preflight.readonly.sql)：同一 read-only、repeatable-read transaction 取得 catalog 與逐筆完整性 metadata。
2. [01-task-codes.draft.sql](../scripts/p0/sql/01-task-codes.draft.sql)：僅將兩張表的任務 CHECK 擴充為原六值加 ARI，保留 SSG。檢查目標聲明、約束名稱／欄位／已知定義、既有值；同交易替換、validate，並比對其他 constraint 定義未變。設定鎖與語句逾時，不改 FK、唯一索引、其他欄位限制、資料或 RLS。
3. [01-task-codes.rollback.draft.sql](../scripts/p0/sql/01-task-codes.rollback.draft.sql)：依**每張表各自的原始定義**選擇 legacy／current／expanded。若既有 ARI 等資料不符合原約束就拒絕回縮，不刪資料。交易失敗回復；有已保存 ARI 時先保留擴充約束並回復應用程式，另審查後續方案。
4. [02-derivation-binding.draft.sql](../scripts/p0/sql/02-derivation-binding.draft.sql)：新增 restrictive policies，將 derivation.trial_id 經 raw → task → session 核對 participant、task code 及權限；保留原 policies。
5. [03-session-source-binding.draft.sql](../scripts/p0/sql/03-session-source-binding.draft.sql)：新增 restrictive INSERT／UPDATE policy，避免自己的 participant 關聯到別人的主結果；無來源主結果的合法 Session 仍可保留 null。

02／03 的原因：現有目錄條件只檢查傳入 participant 是否可寫，未完整檢查來源 Trial／Game Result 的個案關係。這是靜態權限風險，**尚未以真實 JWT 重現或證明草案已封鎖**。02／03 前置檢查遇既有錯誤關聯會停止，不會偷偷轉換資料。回復只能在風險審查後移除本輪特定 `p0b_*` restrictive policies，保留資料與舊 policies；不得停用 RLS。

前置／後置核對須保存所有 CHECK、FK、索引、RLS／policies、資料列數、權限與內容 hash；實測六任務正向寫入、SSG 舊讀取、ART／無效值拒絕、非負題數等其他約束。SQL 草案尚未由真實引擎驗證，不能宣稱 Migration 可正式執行。

## 3. 歷史資料補齊清單

[100 筆逐筆分類](p0b-history-preflight-2026-10-23.json) 已保存所有問題標籤及主要類別；優先序為 D → C → B，再判定 E 或 A，不會因主問題遮蔽其他原因。

| 主要類別 | 結果數 | 原始紀錄數 | 判定 |
| --- | ---: | ---: | --- |
| A：來源結構可補齊候選 | 69 | 849 | 無目前已知鍵／語意／Schema 阻擋；仍待全域備份及隔離權限驗收 |
| B：需 Schema 相容修正 | 4 | 48 | 全為 ARI，兩個 CHECK 都阻擋 |
| C：人工核對 | 26 | 317 | 6 筆 LB 訓練／45 個操作紀錄；19 筆非空 SSG／260 個紀錄；1 筆 DPT／12 個紀錄 |
| D：來源不足 | 1 | 0 | 舊 SSG 無原始 Trial；可能未施測或缺資料，不能捏造題目 |
| E：已完整不需補齊 | 0 | 0 | 研究 Session／Task／Raw／Derivation 均為 0 |
| 合計 | **100** | **1,214** | 本輪正式補齊與狀態修改均為 **0** |

所以來源預檢候選為 849 題；通過 Schema 與其他全域條件後可擴至 **897 個原始 Trial（73 筆結果）**。另 317 個原始紀錄仍需人工處理。這是預期可處理範圍，不是正式已補齊數；**目前正式套用授權數為 0**。

逐筆資料含 main/Game Result、原始／現有 Session、Task 與 Trial IDs、遊戲／模式、來源及預期數量、研究現況、原同步狀態、UUID 完整性、來源鍵衝突、必要欄位檢查及 SHA-256。原始 ID 保存在忽略版控的 [私有 metadata 快照](../.tmp/p0b-preflight-private-v2.json)，公開交付只用 20 碼 hash 參照。該私有檔案沒有作為測試 Fixture，不複製到一般測試環境。

另有 **9 筆**缺少完整研究技術 ID，其中 A 類 5 筆；不是推定原始作答不存在。新技術 UUID 必須在 dry-run 計畫凍結、逐筆審閱後使用，中斷／重試使用同一份計畫，不重新隨機配對。既有 UUID、原始 trialId／stepIndex／levelId 及 raw_data 都保留。

**74 筆**未記錄原始開始時間。研究表允許 null，因此工具改為保留 unknown/null，計畫記錄原 header 與提議值；不以完成時間／現在時間假造開始時間。原始 payload 及 RT 不改。若是有記錄但格式無效，修復工具停止交人工核對。

此 SQL 預檢不替代既有階層的精確 readback：若未來已有資料且只有數量相同，工具會保留人工待驗證狀態；必須再核對 UUID、關聯及內容，才能歸 E。未掃描其他裝置的 outbox／離線結果或未授權環境。

## 4. 真實資料庫整合測試報告

[28 案例的目的、資料、預期、實際結果、狀態及未解問題](p0b-integration-cases-2026-10-23.json) 逐項列出。**實際結果全部為 `NOT_RUN_NO_VERIFIED_ISOLATED_ENVIRONMENT`／`UNVERIFIED`**，不是通過，也不是資料庫失敗。

測試程式：[isolated-integration.test.cjs](../scripts/p0/isolated-integration.test.cjs)。覆蓋：

- 六任務的主結果、Session、Task、批次 raw／current derivation、原始內容讀回及重複提交。
- 各階層請求失敗、既有 Session 後主結果失敗、完整主結果但僅 7/20 raw 已保存、最後同步確認失敗、commit 後回應遺失、兩個程序競爭及重試。
- 真實唯一約束、無效任務拒絕、其他 CHECK 不被放寬、SSG 保留原碼、歷史衍生版本保留、核准計畫重複修復。
- 匿名、跨 guardian、未授權 clinician 的拒絕，以及授權 clinician 的正向讀回；不能只用空資料證明拒絕。
- 自己的 participant + 別人的 raw UUID 之 derivation INSERT／UPDATE，以及自己的 participant + 別人的 Game Result 之 Session INSERT／UPDATE，須明確失敗 `42501`，不是碰巧被唯一約束擋下。

PostgreSQL 一次批次 INSERT 是原子操作；7/20 案例以獨立七列請求建立部分既有資料，**不假稱單一 PostgreSQL 批次會部分 commit**。故障由 fetch 層注入；其餘寫入與核對需由真實 PostgREST／PostgreSQL 執行。新 client 重試不等於瀏覽器重啟。

隔離環境需四個完全合成的一般帳號（兩 guardian、兩有效 clinician）及患者／同意紀錄。管理員只負責另行建立 Fixture，須獨立記錄；一般權限測試不用 service role、不停用 RLS。操作與 JUnit 保存命令見 [P0-B 工具說明](../scripts/p0/P0B-README.md)。未建立帳號或執行真實資料庫測試，不能聲稱 RLS 已通過。更細的 consent_scope 組合與帳號生命週期也仍需權限矩陣驗收。

## 5. LB／PM 歷史資料核對

詳細證據：[LB／PM 逐筆核對](p0b-lb-pm-review-2026-10-23.json)。正式 LB 三筆各 20 題，以 stageId + stepIndex 形成 60 個唯一新來源鍵，沒有改原始 stepIndex 或順序。

六筆訓練衝突的實際根因，經原始欄位與 `TrainingPage_LB.jsx` 核對：`buildLog()` 的 `trialId = level.id + '-' + (stepIndex+1)`。答錯時同一步驟可繼續產生 wrong 操作，直到 correct 才前進；因此是**同一原始 level/step 的不同操作**，不能簡化為遺失 stage，也不能假設是重複資料。

| 結果參照 | 原始紀錄數 | 衝突舊鍵 | 原始序位 | 記錄狀態 |
| --- | ---: | --- | --- | --- |
| 02a70594edaf1f118ec0 | 7 | 2-2 | 2,3,4,5 | wrong ×3 → correct |
| 11b7a3f356f2cb10ce6e | 7 | 1-2 | 2,3,4 | wrong ×2 → correct |
| 562c7f85b3debb919db1 | 7 | 2-1-1 | 1,2,3 | wrong ×2 → correct |
| 82f9cad07a0fba614108 | 11 | 1-4-5 | 5,6 | wrong → correct |
| a6f011283a6435dc19eb | 8 | 1-2 | 2,3,4,5 | wrong ×3 → correct |
| ce7f778a5f8101d0dd2d | 5 | 2-2 | 2,3 | wrong → correct |

每組 raw hash 均互異；加上原始 levelId、stepInLevel 仍無法唯一。45 個原始操作對應 33 個唯一舊 planned-step key，差額 12。**沒有去重、刪除或自動補上流水號**。需研究者確認 operation／attempt／planned Trial 的資料契約、每個既有研究 UUID 的映射，以及版本化轉換／回復方案。不能為了湊 45 題而將所有操作視為獨立施測 Trial，也不能丟掉錯誤歷程。

這種訓練 buildLog 模式目前仍存在；本輪沒有改訓練規則或擅自重新定義 Trial。這是尚待處理的資料語意風險。

PM 四筆共 22 題全部明確記錄 `isTimeout=false`，不是缺欄位後推定無逾時。當前 mapper 的作答狀態分母為 6、6、4、6 題；各 timeout rate = 0，status = available。唯一合法取消紀錄的 `doubleClickCount=null`、`validTrial=true`、`exclusionReasons=[]`；未捏造 double-click 事件或 RT。

零分母回傳 null／`not_calculable_no_administered_trials`，以及 25%、100%、部分施測 33.33%、其他分析排除同時存在，均由原 P0-A 與工具單元測試覆蓋；歷史 PM 沒有逾時樣本，不能宣稱歷史逾時案例已實測。舊研究衍生表為空，前版處理版本記為 absent，而不是捏造舊值。未來新版本 `trial-normalizer-1.1.0`／`behavioral-features-js-1.1.0` 對應同一來源 hash、UUID；保留實際存在的舊版本。

## 6. 修改檔案、函式與補齊行為

本節列的是 P0-B 相對前輪的變更；工作目錄仍保留 P0-A 尚未提交的修改，不能把全部 git diff 都算成本輪。

| 檔案／函式 | 本輪修改理由 |
| --- | --- |
| `src/analytics/trials/constants.js`／`researchTaskCodeCompatibility` | 唯一的 current／legacy／unmapped 寫入判定，不新增 ART→ARI 猜測 |
| `src/lib/behavioralSync.js`／`assertIsolatedRepairExecution`、`repairStoredBehavioralHierarchy` | 預設真 dry-run；拒絕 null/字串式 dryRun；核對真實 client URL、隔離及逐筆授權；硬性封鎖正式 ref；僅允許合成前綴 |
| 同上修復函式 | 來源 snapshot／處理版本核准、凍結技術 IDs、主表／payload 題數核對、缺開始時間保留 null、儲存後再確認來源未變；不更改歷史主同步狀態 |
| `src/lib/database.js` | 更新 wrapper 的使用限制註解；正式查詢與正常同步介面保留 |
| `src/lib/database.test.js` | 前輪修復測試改成合成 ID、隔離 client、明確授權及核准計畫，保留原相容性斷言 |
| `src/lib/behavioralRepairSafety.test.js` | 新增 24 項預設唯讀、正式封鎖、過期計畫、重試、ID／raw 保存、缺時間及代碼判定測試 |
| `scripts/p0/preflight.cjs`、`preflight.test.cjs` | A–E 多原因分類與 6 項測試，不以 count 相同誤判 E |
| `scripts/p0/repair-batch.cjs` | 單筆／指定分批、預設 GET-only、逐筆 durable journal、相同計畫重試；正式 apply 無入口 |
| `scripts/p0/build-p0b-reports.cjs` | 從私有快照重跑公開假名化分類、synced、LB/PM、catalog 報表 |
| `scripts/p0/isolation-guard.cjs`／`.test.cjs` | 隔離測試需授權及未授權 clinician 的普通 JWT |
| `scripts/p0/isolated-integration.test.cjs`、`integration-cases.cjs` | 28 項真實整合程式與明確未驗證的期待／結果清單 |
| `scripts/p0/sql/*` | 唯讀預檢、兩 CHECK 草案／rollback，以及兩項關聯權限草案 |
| `scripts/p0/README.md`、`P0B-README.md` | 補齊新授權方式、Fixture 權限分離與隔離驗收指令 |
| 本報告、各 `p0b-*.json`、裝置驗收文件 | 保存可追溯結果、限制與待執行程序 |

修復前，僅 `{dryRun:false}` 即可能開始寫入，且缺歷史開始時間可能被 fallback 為完成時間；修復後，正式 ref、未確認目標、非合成 ID、無逐筆授權／核准計畫或來源變更全部停止。重試沿用凍結 ID、現有 natural key 與原始內容比對，不刪 raw，不移除唯一約束，不清歷史衍生版本。

## 7. 正式執行前檢查清單與逐筆狀態修正

[21 筆錯誤 synced 明細及順序](p0b-synced-reconciliation-2026-10-23.json)：A 11 筆、B 4 筆、C 5 筆、D 1 筆。主結果均確實存在；研究 Session／Task／Raw／Derivation 全缺。狀態不能直接批次改成 pending，也不能視原 synced 為研究完整。

以下是**未來執行方案**，本輪沒有套用：

1. 完成正式備份與實際還原演練，涵蓋主結果、研究層與所有仍 pending 的原始本機資料；記錄時間、範圍、hash、存取限制及還原負責人。
2. 恢復 Supabase 唯讀授權並重新 dry-run 全部 100 筆；對照 21 筆明細、原始 UUID、內容 hash、74 筆開始時間缺口與所有人工 hold。
3. 在獨立環境完成兩 CHECK 的前後相容、rollback（含拒絕破壞已保存 ARI 的回縮）及 RLS 正負向測試；審查 SQL、鎖等待、schema drift 和索引／其他欄位不變。
4. 原則上先審閱 A 11 筆 synced 候選，再處理 B 4 筆的 schema 阻擋；C 5／D 1 保留 hold。100 筆其他候選也必須逐筆批准，不能以全域管理員冒充來源 guardian。
5. 凍結每筆來源 snapshot、ID 映射、舊衍生版本旗標及既有研究 header。分小批執行、落盤 intent；失敗保留原始資料與部分研究資料，再用同計畫重試。來源改變則重新審閱。
6. 每筆完成 Session、Task、raw、current derivation 的 count／UUID／關聯／JSON 精確 readback，並以**最新來源**再次核對。
7. 只有第 6 步成功後，另行審核的正式執行器才能以 guardian + 來源 revision CAS 更新最終同步 metadata；保留所有原始作答、score、未知欄位。無 revision 的舊紀錄用 NULL adoption guard，CAS 不成立就重讀，不強制覆寫。保存前後狀態差異、驗證證據與執行人。本輪工具**沒有正式執行器，也不更新主表狀態**。
8. 驗證家長、專業、研究三端及 [裝置驗收程序](p0b-device-acceptance.md)，包含 Offline、commit 後丟回應、重整、真正退出瀏覽器、跨分頁、恢復網路與 localStorage 配額不足。IndexedDB 情境另記，不代替 localStorage outbox。
9. 回復先前衍生版本時，只依保存的 lineage／旗標清單逐筆恢復 `is_current` 並再次核對；保留新增 raw 和版本列。若失敗，狀態維持待處理，不假稱完整。RLS 放寬式 rollback 需另行審查風險。

上述前置條件目前沒有全部通過，因此不能進入正式 Migration／分批補齊。現有套用入口的正式 ref 硬性封鎖也必須由未來獨立審查流程處理，不能在此輪改旗標跳過。

## 8. 最終結論與未通過項目

1. **P0-B 尚未符合「工程準備與隔離驗收完成」標準。** 本機修正、逐筆分類、工具、草案及程序完成；隔離實測未完成。
2. **正式 Schema 仍不相容 ARI。** 兩張表的 CHECK 都未更動。
3. **100 筆並非全部可安全自動補齊。** A 69 筆是來源候選，B 4 筆有 schema 阻擋，C 26／D 1 需人工或來源恢復；全域備份與權限條件均待完成。
4. **1,214 個原始紀錄中，849 為目前候選；條件通過後再納入 ARI 48，合計 897。** 另 317 暫停，沒有捏造或刪除原始 Trial。
5. **21 筆 synced 已有逐筆安全方案，尚未修復正式狀態。** 先研究核對，後 CAS 更新；不是全部改 pending。
6. **LB 六筆仍需研究語意與 ID 映射人工審核。** 同一步驟的 wrong→correct 操作不能自動去重或擴張施測 Trial 定義。
7. **目前不能進入正式資料庫遷移與分批補齊。** 缺隔離整合、備份還原、權限驗收及人工決議；收尾唯讀權杖也需恢復。
8. **未通過項目：** 28 項真實 DB／PostgREST／RLS、Migration／rollback 實測、Fixture 普通權限與同意範圍、裝置 Offline／重啟／quota、三端正式版本讀回、歷史人工轉換及最後正式庫唯讀復核。

六項正式評測的規則、計分、素材、停止條件、副本抽取及 UI 均未改；RAG／UCB1／訓練難度沒有變更。[來源等價性證據](p0b-equivalence-2026-10-23.json) 固定比對 P0 前 `8ef96ff`，871 個受保護檔案無非預期差異。這不等於正式部署或實體計時已驗收。

補充風險：目前研究階層為多階段寫入，沒有新增資料庫交易／RPC。程序之間的競爭、衍生版本啟用空窗與來源更新仍須真實隔離測試；本機 readback／重試通過不構成 PostgreSQL 序列化或原子交易的證明。
