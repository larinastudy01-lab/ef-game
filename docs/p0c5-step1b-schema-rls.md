# 蒐秘密｜P0-C5 Step 1B Schema／RLS

本輪診斷：2026-10-24T07:40:22.0630482Z～2026-10-24T07:40:30.0340248Z（UTC；臺灣日期 2026-10-24）。程式版本 8ef96ff4100533907bd4c2549a0c018b0553f345 加既有未提交工作樹；993 個來源檔 hash 記錄於私有 initial-state.json。

**ARI、Participant、DELETE 與外鍵真實驗證全部 BLOCKED；本輪 SQL／API 資料庫操作為 0。** E1：[本輪機器證據](p0c5-step1b-evidence.json)，包含診斷、回歸與來源基準的原始 artifact SHA-256。

## 已完成的程式與草案審閱

沿既有 [Schema 對照](p0c5-step1-schema.md)再次核對現有 migration 清單、ARI 01 forward／rollback、Participant 04 forward／rollback、02 derivation binding、03 session-source binding 及 scripts/p0 的 fixture／guard。來源 hash 未變。標準環境建立前不執行 DDL，也未加入會自動部署的 migration。

現有研究資料是 research_participants、behavioral_sessions、behavioral_task_sessions、behavioral_trials、behavioral_trial_derivations、game_results；推薦必要表沿既有 ml_experiments／recommendation_decisions。Features 沿原 JS pipeline 計算，不另造簡化 SQL schema。空白本機應按已審閱 rebuild 相依順序 01→03→04→07→08→09→10，先由官方 stack 初始化 Auth／Storage；不能重播全部歷史 migration／rollback 或執行 reset 00、RAG 05。

## ARI（D1）

| 要求 | 對應原案 | 本輪實際 |
| --- | --- | --- |
| Task Session 與 Derivation 接受 ARI | M02／M05、I05 | 未建立標準 DB／BLOCKED |
| 其他合法碼與 SSG 維持有效 | I01～I06／I21 | BLOCKED |
| 非法碼／NULL 拒絕 | M07～M09、I22／I23 | BLOCKED |
| CHECK 外的 FK／Unique 保留 | I14、I26／I28 及獨立 FK 組 | BLOCKED |
| Forward 重跑與安全 rollback | M03／M04／M06 | BLOCKED |


repository 的兩張 task_code CHECK 已含 ARI；M01 的 legacy 六碼拒絕前置條件只能在核對過的全新隔離 DB 建立，不能說目前 repository 自己拒絕 ARI。保留 01 草案已知碼集合／isolated guard；有 ARI row 時不得靠刪除或轉碼完成 rollback。ART／SSG／DPT 沒有映射為 ARI。

## Participant（D2）

04 草案只把 SELECT policy 的自我回查 helper 改為 can_access_patient(patient_id)，保留原 INSERT／UPDATE、UNIQUE／FK 及其他 RLS。rollback 恢復原 policy，同時恢復已知 fresh INSERT RETURNING 限制。沒有部署到任何 DB。

Participant-01～10、I15／I25／I26／I28、H12 等普通 JWT 正負向、revoke 與跨綁驗證本輪均未執行。原十案缺少 DELETE，不能假稱包含它。

## DELETE 必要負向組：P0C5-F-DELETE

**BLOCKED；未執行。** 必須對原案例另外補測：家長 A、無個案授權 clinician、anon 嘗試刪除 B 的 Participant。先以普通 JWT 正向驗證身分及自有資料、由 B 保存 Participant／Session／Trial 關聯快照；每次 DELETE 後由 B 逐欄重查，確認沒有刪除或 cascade 影響。不得把空回傳、無效 JWT 或 service role 操作當成 RLS PASS。

## 獨立外鍵／關聯組：P0C5-E-FK（D3）

| 範圍 | 需要的實際驗證 | 本輪結果 |
| --- | --- | --- |
| 正確外鍵 | Participant→Patient、Session→Participant、Trial→Task Session、Derivation→Trial／Participant 的合法寫入與逐欄讀回 | BLOCKED |
| 不存在的外鍵 | 隔離 DDL 身分於可回復交易內以不存在 UUID 命中實際 FK，保存 constraint 名稱與 SQLSTATE；普通 API 授權路徑另測 | BLOCKED |
| 不同個案但 FK 均存在 | A Participant／B Raw、A Session／B Main 等不得因 FK 都合法就放行；保留 I26／I28 | BLOCKED |
| 同為合法 ID 但不符合關聯一致性 | Derivation task_code／participant 必須符合 Raw→Task→Session，核對 restrictive policies、保留原資料 | BLOCKED |


FK 約束驗證與一般 JWT RLS 分開記錄。API 先被 RLS 擋回不能冒充已命中 23503；DDL／bootstrap 身分的 FK 結果也不能冒充普通使用者權限測試。沒有停用 RLS、移除 Unique、放寬 CHECK 或修改期待值。

本輪沒有環境實測差異可支持修改程式或 SQL 草案。上述兩組是必要未驗範圍，未併入原 72，更沒有以規格撰寫宣稱測試通過。
