# P0-C2 Schema、ARI 與 RLS 草案驗證

真實隔離 PostgreSQL 完成驗證；正式資料庫未變更。不是另建名稱相似的假資料表。

## 重建來源與相依順序

先由真正 Supabase Auth 執行自身 migrations，建立 auth.users／JWT 關聯。再依官方 supabase/storage v1.84.19 的 0002／0003／0004／0007／0008／0013／0014 建立應用 schema 所需的 buckets／objects／foldername；使用官方 storage.install_roles=false 選項，Storage API 未啟動，不宣稱整個 Storage 服務已測。

原封不動執行既有 supabase/rebuild/01、03、04、07、08、09、10，實際順序及 SHA-256 見公開 JSON schemaSources。未執行 reset 00 或 RAG 05；沒有停用 RLS、FK、UNIQUE 或 CHECK。Auth 管理角色只限本機；為官方 Auth grant 相依提供的 postgres 角色為 NOLOGIN／NOSUPERUSER，不擴張 public schema CREATE。

實際使用 research_participants、behavioral_sessions、behavioral_task_sessions、behavioral_trials、behavioral_trial_derivations、game_results、patients 及既有 consent／access／RPC；ml_experiments、recommendation_decisions 等必要推薦關聯亦沿用 repository DDL，未執行推薦演算法。Features 是既有 JavaScript pipeline 由 Trial／Derivation 計算，沒有發明另一個 features SQL 表。

| DDL 來源 | SHA-256 |
| --- | --- |
| supabase/storage@v1.84.19/0002-storage-schema.sql | c638dbaccf8829122fc2e05148bcb82596baf288cd497bed7a2cdaa5a4d99e09 |
| supabase/storage@v1.84.19/0003-pathtoken-column.sql | db57ad79bd7ecf1ea6a8099b38bf376886d6b2181ba65b9e9c0556ed245dea8b |
| supabase/storage@v1.84.19/0004-add-migrations-rls.sql | 05b32aad858e4644202e6ac43413cfee30e61d7e9ad51c42b082cfb21235c7bd |
| supabase/storage@v1.84.19/0007-add-rls-to-buckets.sql | c87aa8ea3c6509171728880538cc26e7233896a8f927af3bc5b351a1706610e3 |
| supabase/storage@v1.84.19/0008-add-public-to-buckets.sql | 1d881092aea62e83493f1a9c4cb4f101f3035a08d62be84a7e7970ee0c6f0f48 |
| supabase/storage@v1.84.19/0013-add-bucket-custom-limits.sql | 07d0b1e8299b70eeeda0841969772aecdbd0788eda9dbada7806afdc8ed9d06e |
| supabase/storage@v1.84.19/0014-use-bytes-for-max-size.sql | 9e34ab4fc380e1cdd4748bcac368cd628c247962bdd58f8311a44f1b29e918ec |
| supabase/rebuild/01_CREATE_AUTH_PATIENTS_RESULTS.sql | 1786c658bcd6f351dcae27665b01a82d0711547d3016a9c87a948465822b6595 |
| supabase/rebuild/03_CREATE_NOTES_REMINDERS.sql | 5896cdffe4c10876088123ba574cde5bafff772081d1d3670ee724667fe69694 |
| supabase/rebuild/04_CREATE_RESEARCH_RECOMMENDATION.sql | 6aee717fad691fe64380f1adae802a166c4c8fef6fc06a3580ef20194a476e68 |
| supabase/rebuild/07_CREATE_CLINICIAN_APPLICATIONS.sql | edc9b9055795c69a3ee2459a77c3396ca8d70e225713a921cb4b1cdd45a8df5f |
| supabase/rebuild/08_CREATE_ACCESS_CONSENT.sql | 7c8a21c04ca931c555ba95e0f92b842451aa500304c53c25a6b8d2e63c91322d |
| supabase/rebuild/09_CREATE_SECURITY_AUDIT_AND_ACCOUNT_LIFECYCLE.sql | 54da6fe73776321854629f34bc6d6907f1abcc0098f06a96092e3794dd431f5e |
| supabase/rebuild/10_FIX_PATIENT_CREATION_RPC.sql | 0f1c4a994dd0f3b172755c3eed38da5b3423a1596f4472304d881f1756bc50b4 |

## ARI forward／repeat／rollback

使用 [01 forward 草案](../scripts/p0/sql/01-task-codes.draft.sql) 與 [rollback 草案](../scripts/p0/sql/01-task-codes.rollback.draft.sql)，非直接部署正式 migration。隔離重現歷史兩張 CHECK 的六個碼，再執行現有草案，增加 ARI 成為七個可接受碼；原 SSG 保留，不把 ART／SSG／DPT 轉 ARI。

| 案例 | SQL／API 操作摘要 | 實際結果 | 狀態 |
| --- | --- | --- | --- |
| P0C2-M01 | Ordinary Auth JWT/PostgREST ARI sync before migration | 23514; main/source retained, hierarchy not acknowledged | PASS |
| P0C2-M02 | Exact forward draft on real PostgreSQL | Both CHECKs expanded; other constraints/policies/RLS/triggers unchanged | PASS |
| P0C2-M03 | Forward repeat | Same catalog, no source data changes | PASS |
| P0C2-M04 | Rollback before ARI CHECK-bound rows exist | Exact legacy catalog restored; retained main/session not deleted | PASS |
| P0C2-M05 | Forward then retry original ARI source | 4 original raw rows verified; main/raw history unchanged except sync metadata | PASS |
| P0C2-M06 | Rollback with ARI rows retained | Safely refused; expanded CHECK and all data retained | PASS |
| P0C2-M07 | Direct ordinary-user task insertion: null | 23502 | PASS |
| P0C2-M08 | Direct ordinary-user task insertion: ART | 23514 | PASS |
| P0C2-M09 | Direct ordinary-user task insertion: INVALID_TASK | 23514 | PASS |
| P0C2-M10 | Exact restrictive binding drafts 02/03 | Applied to isolated DB only; real cross-binding tests I26/I28 still required | PASS |

兩張 CHECK 的完整 before／after、其他 constraints／policies／RLS／triggers catalog 保留於 .tmp/p0c2/migration-evidence.json；公開 JSON 收錄測試結果與原檔 hash。M02／M03／M04 的斷言比對 catalog，除這兩張 CHECK 外無其他變化。原 I01–I06 六項現行任務碼實測全部接受，I21 保留舊 SSG，I22／I23／M08／M09 非法碼仍23514，M07 NULL 23502，I24 原非負數 CHECK 仍23514。

M04 在尚無受 CHECK 約束的 ARI row 時安全還原；保留先前 main／session。M06 有 ARI row 後 rollback 拒絕，資料與新約束不動；不得靠刪除 ARI 或改碼完成 rollback。草案的 isolated target guard／lock timeout 仍保留，不能直接對正式環境執行。

## 跨資料關聯限制

既有 02 derivation binding／03 source-result binding 草案只在隔離資料庫施加。原 I26／I28 以普通 JWT 驗證跨 Raw／Participant 及跨 Patient／主結果的 INSERT／UPDATE 都是 RLS 42501，沒有以不相關 UNIQUE 失敗代替。原資料、UUID、Foreign Key 及唯一約束保留。

## 本輪發現的真實相容性缺陷：Participant INSERT RETURNING

第一次建置後，合法 guardian 新建自有 patient 的 research_participants upsert().select() 回42501。根因是 SELECT policy 呼叫 STABLE can_read_research_participant(id)，內部回查同一資料表；INSERT RETURNING 的 snapshot 看不到剛插入的新 row。既有 participant 的查詢成功不能證明新建也成功。

最小 [04 forward 草案](../scripts/p0/sql/04-participant-returning.draft.sql) 只將 research_participants_select_related 的 USING 由 can_read_research_participant(id) 改成 can_access_patient(patient_id)，直接檢查同一 non-null patient FK 的授權。這是展開既有 helper 的相同權限條件；未改 INSERT／UPDATE policy、其他表或任何作答資料。草案檢查原 policy 的角色、cmd、PERMISSIVE 與已知 qual，未知 schema 拒絕。

R01 真實驗證：rollback 回原 policy 可重現新資料42501；forward 後新 upsert returning 成功、重跑保持同 UUID；既有資料對兩家長、兩 clinician 與匿名的可見集合前後一致。原 I15／I25／I26／I28 及 H12／X02 更驗證個案隔離與撤銷。沒有關閉 RLS。

[04 rollback 草案](../scripts/p0/sql/04-participant-returning.rollback.draft.sql) 僅恢復已觀察的舊 SELECT policy，不刪資料；會恢復已知 fresh-insert returning 限制，必須在正式審查時明列。兩份04檔只放 scripts/p0/sql，不加入自動正式 Migration。

## 尚待正式審查

最新正式 catalog 查詢受 connector OAuth refresh 阻擋；本輪沒有聲稱從當下正式環境完整 clone。現有 repository DDL 與舊 P0-B 只讀快照可支持本次測試，仍需在 P0-D 之前重新唯讀核對當下 CHECK／policy／function／trigger／grant／版本漂移，以及備份、遷移鎖定、回復先決條件。

04 是新發現且僅在隔離驗證的 SQL 草案；正式環境的相同缺陷是否仍存在，須最新 catalog 比對。原生 Auth listener／gateway 與標準 Supabase 堆疊差異也需審查。所有正式 migration、repair、狀態變更仍為0；本文件不授權 P0-D 執行。


所有時間為 UTC；2026-10-23 台灣時間為 UTC+8。逐案機器結果與 SHA-256 見 [驗證證據](p0c2-test-evidence-2026-10-23.json)。私人執行資料位於 .tmp/p0c2，不納入版本控制；公開文件沒有金鑰、JWT 或真實個案 payload。
