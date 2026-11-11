# 第一輪 P0 驗收準備與唯讀盤點（2026-10-23）

**狀態維持：本機驗證通過，正式環境驗收未完成；品質評分維持原報告 56/100。** 本次依使用者選擇，只完成唯讀盤點與驗收工具，沒有正式庫寫入、歷史修復、Schema/RPC 部署或第二輪產品修改。

## 正式庫唯讀證據

目前 `.env`、`.env.production` 與連線的蒐秘密 Supabase 專案一致。已檢查專案清單與分支清單，未辨識出可用的獨立測試專案；蒐秘密專案沒有開發分支。本機未找到 Docker、Supabase CLI 或 psql。

2026-10-23（Asia/Taipei）的 repeatable-read/read-only SQL 快照，見 [完整盤點報表](p0-history-dry-run-2026-10-23.json) 與 [可重跑 SQL](../scripts/p0/history-dry-run.sql)：

| 檢查 | 實際觀察 | 驗收意義 |
| --- | --- | --- |
| 主結果 | 100 筆 | 含已標記 synced 的紀錄，全數納入 |
| 來源 Trial | 1,214 筆，存在於 99 筆主結果 payload | 可作為補齊來源；不表示已寫入研究表 |
| 研究 Session／Task／Raw Trial／Derivation | 全部 0 筆 | 100 筆均缺研究階層；不能當成部分查詢成功 |
| 已標 synced 但缺研究階層 | 21 筆 | 必須另行盤點補齊，不會靠新 outbox 自動發現 |
| 宣告題數大於可讀原始題數 | 0 筆 | 僅是計數證據，不證明歷史內容完整 |
| 無來源 Trial | 1 筆舊 SSG 結果 | 人工核對，不得捏造 Trial |
| LB 舊來源鍵重複 | 9 筆結果，42 個重複鍵 | 含 3 筆正式評測及 6 筆舊訓練結果 |
| LB 目前來源鍵仍重複 | 6 筆舊訓練結果，12 個重複鍵 | 這 6 筆缺 stage 識別且題號重用；停止自動補寫並人工處理 |
| PM | 4 筆結果、22 題，記錄逾時 0 題 | 無歷史逾時樣本，不能聲稱歷史逾時案例已驗證 |
| PM 有取消選取、無明確重複點擊證據 | 1 題 | 新版 mapper 保留合法取消；研究表為空，無法對照實際舊衍生排除 |

另以不含參與者身分的 LB 鍵與 PM 作答欄位投影，在本機執行目前正式 mapper/pipeline：三筆正式 LB 各 20 題的新來源鍵皆唯一；六筆舊 LB 訓練仍衝突；四筆 PM 的已施測分母分別為 4、6、6、6 題，逾時率皆為 0，皆為 `available`。這是唯讀後在記憶體重算，沒有儲存新衍生值，也沒有改寫遊戲分數。

**不能由這次快照推定研究表為空的唯一原因。** 也不能推定其他裝置已無待傳資料。待傳 outbox、未同步本機原始結果及其他環境／備份不在這次全庫 SQL 範圍內。

## 真實 Schema 核對

見 [資料庫 catalog 證據](p0-database-inventory-2026-10-23.json)。真實 PostgreSQL 已存在：

- Session `UNIQUE(source_result_id)`。
- Task `UNIQUE(session_id, task_order_index)`。
- Trial `UNIQUE(task_session_id, source_trial_key)`。
- Derivation `UNIQUE(trial_id, processing_version)` 以及 `WHERE is_current` 的唯一索引。
- Trial 原始欄位不可改寫 trigger。
- 主結果及研究六張相關表的 RLS 已啟用並有 policy。

這只確認 catalog 存在，**不等於以一般 JWT 實際通過寫入、越權拒絕或斷線測試**。管理員唯讀 SQL 沒有驗證 RLS 的實際可見範圍。

發現目前 `behavioral_task_sessions_task_code_check` 接受 `CBT, PM, SRT, SSG, LB, DCCS`，未接受程式現用的 `ARI`；主結果已有 4 筆 ARI 訓練、48 題原始 Trial。依 CHECK 定義，以 `ARI` 寫入會被拒絕。這是正式驗收阻擋，不能在記憶體替身通過後忽略。

另有 20 筆舊 `SSG` 及 1 筆 `DPT` 結果（共 272 題），需確認舊任務語意及研究用途；不能直接改名為 ARI 或刪除。

## 最小遷移提案與歷史補齊程序（未套用）

ARI 相容遷移只放寬 task CHECK，保留所有既有值、資料、索引與關聯，不新增交易/RPC。本提案需先在獨立測試專案核對約束名稱、schema 版本及權限：

```sql
-- 審查提案；本輪未執行。僅供隔離環境驗證後制定正式遷移。
begin;
alter table public.behavioral_task_sessions
  drop constraint behavioral_task_sessions_task_code_check;
alter table public.behavioral_task_sessions
  add constraint behavioral_task_sessions_task_code_check
  check (task_code in ('CBT','PM','SRT','SSG','ARI','LB','DCCS')) not valid;
alter table public.behavioral_task_sessions
  validate constraint behavioral_task_sessions_task_code_check;
commit;
```

相容性：保留 SSG，新增 ARI；不轉換任何歷史 task code，不改正式規則。風險：`ALTER TABLE` 取得鎖，正式執行前需確認表大小、流量與鎖等待設定。交易內失敗全部回復。上線後若已產生 ARI 資料，**不得為回滾刪除資料或直接恢復排除 ARI 的約束**；先回復應用程式、保留擴充 CHECK。只有確認 ARI 行數為零，才可另行審查恢復原約束。此提案不解決舊 SSG/DPT 任務語意或第二輪跨參與者關聯權限。

歷史補齊須依序進行：

1. 備份主結果、研究原始／衍生資料與本機待傳資料；記錄快照時間、結果參照、原始內容雜湊及處理版本。
2. 重新執行全庫唯讀盤點，逐筆使用既有 `repairBehavioralHierarchyFromResultId(id, {dryRun:true})` 確認 ID/鍵匹配、原始內容與預期數量。不能只依 `synced` 篩選。
3. 將六筆 LB 訓練鍵衝突、一筆無原始 Trial、舊 SSG/DPT 語意及任何原始內容衝突交由人工審查。不得猜測 stage、捏造資料或覆寫既有 raw_data。
4. 隔離環境以備份的合成等價資料演練補齊、重複執行及衍生版本回復；保存原有 Trial UUID／來源鍵，新衍生使用 `trial-normalizer-1.1.0`，舊衍生版本保留。
5. 另行審核可套用名單後，由來源 guardian 在正確權限下逐筆 opt-in 修復；不可拿管理員結果直接冒充使用者套用。既有 repair 函式**不會把歷史主結果重寫為 verified**，必須另存驗證證據，不能依舊 synced 值結案。
6. 讀回比對 Session/Task/Trial 的數量、識別碼及原始內容，再比較各 PM 指標版本。失敗保留資料、原因及重試名單。回復只恢復經驗證的先前 `is_current` 衍生版本旗標；保留新增原始列與衍生列，不做回滾刪除。

## 評測等價性與工具驗證

[來源等價性報告](p0-equivalence-2026-10-23.json) 固定比對 P0 前 commit `8ef96ff4100533907bd4c2549a0c018b0553f345`。871 個受保護檔案無非預期變更；六項正式頁面、計分／protocol、結果正規化、素材、推薦、RAG、既有 SQL 與套件均未改動。報告附正式頁面及計分相關 Git blob。

本次只新增 `scripts/p0` 驗收工具、工具測試與這些證據文件；未修改第一輪產品邏輯。工具的本機測試 18/18 通過，整合測試檔語法檢查及 ESLint 通過。正式 PostgreSQL/PostgREST/RLS 的寫入測試尚未執行，不能算通過。

本次重新執行完整 CRA/Jest 回歸：**84 個套件、632 項測試、4 個快照全部通過**，232.452 秒。相較前一份 631 項紀錄，多出前次最後加入且僅跑過局部測試的 legacy revision CAS 競爭測試，這次已包含在完整回歸中。命令為 `CI=true node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand --no-cache --silent`。沒有操作正式資料庫的測試。

隔離整合測試涵蓋與執行方式見 [工具說明](../scripts/p0/README.md)。測試不會指向已知正式主機，不會刪除資料，測試資料有專用前綴。HTTP 故障注入不等於真實裝置斷網；新 client 重試不等於應用程式重啟，這兩項仍須實機驗收。

來源等價性與現有 fake-timer 測試可證明規則及邏輯未變動；不能替代正式部署版本、實體裝置的刺激呈現與計時驗證。

## 第二輪隱私修正的準備範圍

本輪未開始第二輪產品修改。後續以結果頁路由及 payload 擁有者查核、共享裝置儲存隔離、研究匯出去識別化、Trial/Derivation 與參與者的關聯權限為範圍。登出與切換帳號的清理必須先區分可清快取和未獲研究完整確認的原始待傳資料，保留原帳號綁定；不能為避免洩漏而直接刪除 outbox，亦不能讓另一帳號接手上傳。

正式庫 security advisor 另回報 [function search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) 與 [SECURITY DEFINER 執行權限](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)相關警示；需在第二輪逐函式核對呼叫意圖與 auth 檢查，不能僅因警示就批次撤銷正常功能權限。本輪沒有依 advisor 修改正式權限。

正式結案仍待：獨立資料庫整合成功、真實 RLS 權限驗收、ARI CHECK 相容遷移演練與審核、歷史補齊名單及衍生對照、斷網／重啟實測，以及家長／專業／研究三端讀回核對。未重新提高品質分數。
