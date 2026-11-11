# P0-C Schema 與遷移審查

**結論：BLOCKED；沒有執行 Migration，沒有取得真實引擎驗收證據。禁止套用正式庫。**

## 證據時效與 Schema 來源

本輪 Supabase 連線在 OAuth 更新階段失敗，最新正式 Schema 查詢未執行。以下正式定義僅來自 [P0-B catalog](p0b-schema-evidence-2026-10-23.json)，快照時間為 **2026-10-23 14:58:41.987531 +08:00**，不能視為目前正式庫已再次確認。
本機 [04_CREATE_RESEARCH_RECOMMENDATION.sql](../supabase/rebuild/04_CREATE_RESEARCH_RECOMMENDATION.sql) 為另一份程式證據，不能取代正式 catalog。未將正式資料匯入測試。

| 對象 | P0-B 正式快照 | 本機／擬議行為 | 實測狀態 |
|---|---|---|---|
| behavioral_task_sessions_task_code_check | CBT、PM、SRT、SSG、LB、DCCS | draft 加入 ARI，保留 SSG | BLOCKED |
| behavioral_trial_derivations_task_code_check | CBT、PM、SRT、SSG、LB、DCCS | draft 加入 ARI，保留 SSG | BLOCKED |
| 現行任務 | 六項頁面／constants 使用 ARI | ARI 原碼保存；不轉為 ART/SSG/DPT | 本機程式比對；DB BLOCKED |
| 舊 SSG／DPT | 歷史原碼保留 | 沒有經驗證的語意對照，不轉成 ARI；DPT 不因此加入 CHECK | 人工凍結 |

## 最小草案與本輪修改

[01-task-codes.draft.sql](../scripts/p0/sql/01-task-codes.draft.sql) 只替換上述兩個 CHECK，擴為七代碼聯集。它不執行原始資料 UPDATE/DELETE，不移除唯一約束。每次要求隔離 session 標籤、非正式 ref、已知 CHECK 結構及代碼集合；在單一 transaction 中修改、驗證，並比對這兩張表其餘 constraint 定義。lock_timeout=5s、statement_timeout=60s。

本輪只將 `codes not in (...)` 改為 **`codes is null or codes not in (...)`**，避免空集合在 SQL 三值邏輯下跳過預檢。這是草案的拒絕條件修正，不代表 SQL 已由 PostgreSQL 解析／執行通過。沒有新增自動部署 migration 檔，也未更動 supabase/migrations。

GUC `p0b.environment`／`p0b.project_ref` 是操作者聲明，不是伺服器身分證明；必須先完成資源、實際連線與副作用審查。它們不能授權正式操作。

## 隔離環境驗證與回復規格（均未執行）

1. 用空白、獨立 Auth/DB/Storage 的隔離 stack，從儲存庫結構腳本建立 Schema；不跑 reset，不帶正式 payload。以兩張六代碼 CHECK 重現舊狀態，保存完整 catalog、表筆數與合成資料雜湊。
2. 普通 guardian 經 PostgREST 嘗試 ARI，確認是預期 CHECK 的 23514，而非權限／JWT／其他約束失敗。有效 LB/PM/CBT/SRT/DCCS 與舊 SSG 需有正向基線。
3. 空資料階段執行 forward → 重跑 → rollback → forward，確認 rollback 恢復各表**實際原集合**；不可假定兩表原本相同。保存每次 SQL 輸出與 catalog 差異。
4. 寫入合成 ARI 後再試 rollback，若舊集合不接受 ARI，預期安全拒絕。保留資料，維持擴充 CHECK；或整個未提交演練 transaction 回復。禁止刪 ARI、改碼或先清表來取得 rollback 成功。
5. 前後比較所有 CHECK/FK/Unique/index/RLS/policy/trigger/function/grant 定義與有效狀態、舊資料雜湊及查詢結果；兩張表以外的權限物件也須比對。草案內的 constraint 比對不能代替這份全 catalog 驗證。
6. 驗證負題數仍 23514、重複來源鍵仍 23505、跨患者關聯仍 42501，並與正向用例對照；研究、家長、專業查詢不能退化。

[01-task-codes.rollback.draft.sql](../scripts/p0/sql/01-task-codes.rollback.draft.sql) 只在資料符合欲恢復的原集合時回復 CHECK；不刪資料。回復目標集合需由保存的原 catalog 指定。真正的 rollback 行為、鎖定時間、PostgREST schema cache 及服務版本相容性仍為 BLOCKED。

## RLS 關聯草案與未解風險

| 草案 | 限縮的資料關聯 | 相容／回復注意 | 驗收 |
|---|---|---|---|
| [02-derivation-binding](../scripts/p0/sql/02-derivation-binding.draft.sql) | derivation → raw → task → session 的 participant 與 task_code 必須一致；讀寫再檢查相應權限 | 新增 restrictive policies，保留原 policies；既有錯鏈先停止。回復只可在審查後移除新增三個具名 policy，不動資料 | I26 + X01/X02/X12 BLOCKED |
| [03-session-source-binding](../scripts/p0/sql/03-session-source-binding.draft.sql) | Session 的非空 source_result_id 與 participant 須屬同患者／當前 guardian | 原契約仍允許 null source；新增兩個 restrictive policies。回復只移除這兩個具名 policy；不能藉回復掩蓋跨患者漏洞 | I28 + X12 BLOCKED |

本輪未修改正式 policy。這兩份草案也未在真實引擎執行；是否因 RLS 子查詢互相依賴、舊 policies、grants 或 trigger 而阻擋合法資料，仍待實測。不能僅因語法看似合理就宣告安全。

程式中的 can_read_research_participant 透過 can_access_patient 判斷，而本機角色集合沒有獨立 researcher。研究用途、consent_scope 中 research_views 與撤銷後行為必須明確對照，不能把 I25 的「有授權 clinician」名稱當作已驗證獨立研究角色；也不能假定存在 consent_scope 就等於每條讀取路徑都有檢查。此處是待核對的權限契約風險，尚未證實為目前正式庫漏洞。

## 正式執行門檻

須先滿足 [P0-C 報告](p0c-acceptance-report.md) 全部條件，包括原 28 項與補充權限／資料契約實測、最新唯讀快照、備份可還原演練、逐筆來源及計畫核准。即使隔離驗收日後 PASS，也仍需獨立正式變更審查；本輪不提供正式執行核准。
