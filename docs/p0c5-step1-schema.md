# 蒐秘密｜P0-C5 Step 1 Schema 與約束

診斷 2026-10-24T07:06:34.4325444Z～2026-10-24T07:06:44.2517995Z；CLI 嘗試 2026-10-24T07:09:02.188Z～2026-10-24T07:09:05.427Z（UTC，臺灣日期 2026-10-24）。Git 8ef96ff4100533907bd4c2549a0c018b0553f345 加既有未提交工作樹。

**BLOCKED；本輪 DDL／Migration／RLS 實測均為 0。** E1 = [本輪機器證據](p0c5-step1-evidence.json)，內含診斷、兩次 CLI 呼叫與私有原始檔 SHA-256。

## 實際來源審閱

依目前 supabase/README.md 及 rebuild/README.md，空白隔離環境採既有 rebuild 01→03→04→07→08→09→10；不是直接重播全部舊 migration。未執行 00 reset、RAG 05、rollback 檔或任何正式 migration。原有 migrations 中含歷史調和及 rollback，用途不同，不得自動全套執行。蜂蜜進度 migration 不屬這次研究階層必要表，未改它。

標準 Supabase 必須先由官方 stack 初始化 Auth／Storage schema，不能照搬 C4 手工建立的 Storage 相依子集來聲稱整套平台通過。此相依在標準環境尚未實測。

| 需求 | 目前程式／DDL 對應 | 本輪標準實測 |
| --- | --- | --- |
| Participant | research_participants；patient_id NOT NULL／UNIQUE／FK；SELECT／INSERT／UPDATE RLS | BLOCKED |
| Session | behavioral_sessions；participant_id／source_result_id 關聯 | BLOCKED |
| Game Result／Task Session | game_results／behavioral_task_sessions | BLOCKED |
| Raw Trial | behavioral_trials；UNIQUE(task_session_id, source_trial_key)；raw immutable trigger | BLOCKED |
| Derivation | behavioral_trial_derivations；Trial／Participant FK、processing version 與 current constraints | BLOCKED |
| Features | 既有 JS buildTaskFeatureRow／pipeline 由 Trial／Derivation 計算；沒有另造 SQL features 表 | BLOCKED |
| Recommendation 必要關聯 | ml_experiments／recommendation_decisions，沿既有 04 DDL；不執行推薦演算法 | BLOCKED |
| 授權／RPC／trigger | 01／07／08／09／10 的 profiles、patients、access／consent、audit 與函式 | BLOCKED |


來源檔 SHA-256 全列於機器證據 schemaSources。本輪只審閱，不宣稱已在標準環境建立或完整驗證相依。C4 的 18 表／58 functions／48 policies／117 constraints 是歷史原生 catalog，不能填作本次標準 catalog。

## 同步與讀回契約

[src/lib/behavioralSync.js](../src/lib/behavioralSync.js) persistVerifiedBehavioralHierarchy 以普通 client 執行 research_participants.upsert(...).select(id).single()，後續逐層保存與讀回核對 Raw IDs／來源鍵／內容及 current derivations；main 最終 ACK 依完整驗證結果。Participant RETURNING 因此是必要真實 API 驗證，不能以管理員 INSERT 成功代替。

[src/lib/database.js](../src/lib/database.js) 的研究讀取經授權角色與 RLS，從 behavioral_task_sessions／sessions／trials／derivations 讀取；缺漏時唯讀使用 game_results payload 重建，LB／PM 衍生更新在記憶體，原始資料不覆寫。上述路徑本輪沒有修改，也沒有重新連線實測。

## ARI Migration

目前 repository 04 的兩張 task_code CHECK 已含 ARI；P0-B 01 草案兼容已觀察的 legacy／current／expanded 碼集合。測試 M01 需在全新隔離 DB、確認沒有 ARI CHECK-bound row 後，明確建立已知 legacy 前置條件；不能把 repository 的 current CHECK 說成原本拒絕 ARI。

| 驗證要求 | 原 ID／補足範圍 | 本輪結果 |
| --- | --- | --- |
| Migration 前 ARI 拒絕 | P0C2-M01，預期 23514 | BLOCKED |
| Forward、重跑、之後 ARI 寫入 | M02／M03／M05 | BLOCKED |
| 其他合法任務／舊 SSG | P0B-I01～I06／I21 | BLOCKED |
| 非法代碼 | M08／M09；I22／I23 | BLOCKED |
| NULL | M07，預期 23502 | BLOCKED |
| Foreign Key | 既有正向關聯；另需孤兒 FK 負向案例，不以 RLS 拒絕冒充 FK 命中 | BLOCKED |
| Unique | I14，預期 23505；I20 冪等 | BLOCKED |
| RLS／無關 CHECK／catalog 不變 | I15／I24／I25／I26／I28、M02／M10 | BLOCKED |
| 安全 rollback | M04 可回復、M06 有 ARI 時拒絕；不刪資料／不轉碼 | BLOCKED |


01 forward／rollback 均保留 isolated target guard、已知 CHECK 形狀檢查及資料相容先決條件；未將 ART／SSG／DPT 映射 ARI。回復必須依各張 CHECK 的已保存碼集合；有資料會被舊 CHECK 排除時拒絕回復。這是原草案審閱結論，不是本輪 SQL 語法或執行 PASS。

## Participant INSERT RETURNING

04 草案只把 research_participants_select_related 的 SELECT USING 從回查本表的 can_read_research_participant(id) 改為相同 patient FK 授權的 can_access_patient(patient_id)，保留原 INSERT／UPDATE、FK／UNIQUE 及其他政策。rollback 還原舊 policy，也會恢復已知 fresh INSERT RETURNING 限制；兩份仍是草案，未部署。

既有 Participant-01～10 全部標準實測 BLOCKED；本輪 F 要求的撤銷後讀取可對應 H12，但既有十案沒有 DELETE。另列 P0C5-F-DELETE（BLOCKED）：普通 A、無授權 clinician、anon 對他人 Participant 執行 DELETE，配合同 JWT 合法正向讀取及 B 的前後資料／關聯逐欄核對；不能只看空回傳或 HTTP 成功。原十個 ID 不重新編號。

FK 額外驗證列 P0C5-E-FK（BLOCKED）：隔離 DDL 角色在可回復交易內驗證實際 FK 對孤兒關聯拒絕，且 ordinary API 路徑另測授權與合法關聯。要明確區分 constraint 測試身分及 ordinary JWT RLS 身分，不能用 service role 宣稱 RLS 通過。兩個缺口是待驗範圍，不代表本輪已發現資料庫缺陷。

## 寫入前隔離檢查

| 項目 | 實際可確認結果 |
| --- | --- |
| API URL | 只有計畫值 http://127.0.0.1:55361；沒有 running endpoint 證據 |
| PG host／Database／cluster | 只有預定 host 127.0.0.1:55362；Database／cluster 未建立，實值 null |
| Auth／Storage | 標準服務未啟動；issuer／資源歸屬／服務版本未確認 |
| 測試帳號／憑證 | 沒有建立帳號或產生憑證；沒有傳入正式／service role key |
| 官方資源身分 | CLI binary 校驗通過；container images／network／volumes 不存在 |
| 正式連線可能性 | 子程序沒有正式憑證或 hosted target；固定 local Docker pipe；未 link；仍不等於 runtime attestation 通過 |
| 最終寫入 gate | 拒絕；沒有任何 app／Auth／Storage／DDL 測試寫入 |


P0C5-GATE01 實際以空設定呼叫既有 requireP0CIsolation，取得 P0C_ATTESTATION_FILE is required 的預期拒絕；PASS 僅限離線 gate 行為，沒有 DB client／HTTP，不能算入標準 72 案。未知的獨立 Auth／Storage 不填 true。
