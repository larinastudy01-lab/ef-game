# P0-B 本機工具與隔離驗收操作

P0-C 起，整合測試與 `repair-batch --apply-isolated` 另需資源證據 gate；請以 [P0C-README](P0C-README.md) 的隔離確認與 attestation 為準。以下 P0-B 指令不能跳過新增 gate。

**正式庫 apply 被封鎖。沒有隔離目標時，只執行唯讀 SQL、分類和本機測試。** 本輪未提供可寫入正式庫的切換選項。正式部署／補齊需要後續獨立審查，不能藉修改環境標籤解除現有正式 project ref 的硬性封鎖。

## 唯讀預檢與報表

以經授權的管理員唯讀連線執行 `sql/00-preflight.readonly.sql`，將單一 JSON 結果保存在忽略版控的 `.tmp`／`artifacts`。這份輸入含主結果 ID、原始研究 UUID，必須保持私有，不能作為測試 Fixture。SQL 不輸出姓名、生日或原始答案，但識別碼仍屬敏感參照。

```powershell
node scripts/p0/preflight.cjs PRIVATE_SNAPSHOT.json NEW_REDACTED_REPORT.json
node scripts/p0/build-p0b-reports.cjs PRIVATE_SNAPSHOT.json NEW_OUTPUT_DIRECTORY
```

輸出 A–E 分類、全部原因標籤、100 筆摘要、21 筆同步狀態核對順序、6 筆 LB 人工清單、PM 重算及 schema catalog。`A` 僅代表來源預檢候選；所有紀錄 `applyAuthorized=false`。既有研究階層不能只憑計數被歸為 E，還須提供精確 ID／內容核對證據。

## 單筆／分批補齊演練

```powershell
# 預設唯讀。JSON 陣列內放明確的主結果 ID，可只列一筆或指定分批清單。
node scripts/p0/repair-batch.cjs PRIVATE_IDS.json PRIVATE_JOURNAL.jsonl

# 僅隔離合成資料。輸入為 [{"approved":true,"plan":<逐筆審閱過的 dry-run plan>}]。
node scripts/p0/repair-batch.cjs PRIVATE_REVIEWED_PLANS.json PRIVATE_APPLY_JOURNAL.jsonl --apply-isolated
```

程序環境：`P0_REPAIR_URL`、`P0_REPAIR_ANON_KEY`、`P0_REPAIR_ACCESS_TOKEN`。套用另需 `P0_REPAIR_ENVIRONMENT=isolated`、`P0_REPAIR_PROJECT_REF`、`P0_REPAIR_TARGET_ORIGIN`、`P0_REPAIR_CONFIRMATION=APPLY_SINGLE_SYNTHETIC_REPAIR`，且 ID 必須以 `p0-acceptance-` 起頭。套用帳號必須為來源資料的普通合成 guardian；不使用管理員權限繞過 RLS。

每筆先同步落盤與 fsync 記錄 intent，才呼叫修復。中斷後使用**原核准計畫**重跑；保留原先產生的技術 ID，每次重新讀回驗證，不以 journal 中的成功標記代替資料庫查核。來源若已變更或處理版本不同，須重新 dry-run／審閱。內容衝突停止，不覆寫 raw_data。失敗保留 journal 和已保存的部分資料；完成後仍不更新歷史主結果 syncStatus。

原始時間、RT、事件缺失不能捏造。歷史來源未記錄開始時間時，修復研究欄位保留 `null`，計畫記錄原有 header 與提議值，原始 payload 不動。完整 sourceSnapshot 及 UUID 計畫可能包含敏感資料，不得放進公開報告或版控。

## 隔離環境準備（本輪未建立／未實測）

1. 維護者確認一個可丟棄的獨立 Supabase 專案或 loopback stack，保存 project ref、URL、schema 版本和用途聲明。禁止使用正式資料或正式環境變數。此次沒有可確認的目標，所以沒有執行這一步。
2. 空白隔離環境以儲存庫既有 `supabase/rebuild` 的 01、03、04、07、08、09、10 建立相關相依結構；**不跑 00 reset**，不複製正式資料。若有既存結構，先比較 catalog，不盲目重播 create scripts。
3. 管理員依現有帳號建立／審核流程準備完全合成的 guardian A、B、各一個患者、有效且核准的 clinician C、D。只給 C 對 A 患者的有效 `research_views`／結果讀取同意，D 保持未授權。使用 `example.invalid` 測試身分，不寄真實郵件、不使用真實驗證照片。管理員建立 Fixture 的動作與權限須另列紀錄。
4. 保存前置唯讀 catalog。欲重現正式問題，僅在空白隔離環境還原兩張表原有 `SSG` 六代碼 CHECK；需記錄原始定義。執行 ARI 寫入，預期被拒絕。另在空白資料階段演練 forward → rollback → forward，核對其他 CHECK、FK、索引及 RLS 不變。
5. 確認隔離連線後，在 SQL session 設定 `p0b.environment=isolated` 與正確 `p0b.project_ref`，審閱並執行 01 draft、02／03 關聯權限 drafts。這些 session 標籤不能取代操作者對目標的確認。SQL 草案未經真實引擎驗證，不能自行套用正式庫。
6. 普通 JWT 測試另開程序，僅提供測試 anon/publishable key 和四個一般帳號 token；不提供 service role。前置檢查驗證普通 guardian 身分、患者所有權，以及 clinician 的正向／負向同意權限。

整合測試環境變數沿用原 README 的 `P0_TEST_*`，**另須** `P0_TEST_CLINICIAN_ALLOWED_TOKEN`、`P0_TEST_CLINICIAN_DENIED_TOKEN`。不得跳過未授權專業端或關聯欄位測試來取得綠燈。

```powershell
node --test --test-concurrency=1 --test-reporter=junit --test-reporter-destination=artifacts/p0b-integration.junit.xml scripts/p0/isolated-integration.test.cjs
node scripts/p0/integration-cases.cjs NEW_UNVERIFIED_EXPECTATIONS.json
```

28 個案例的目的、合成資料及預期結果見產出的 expectations catalog。它的預設狀態永遠是 `UNVERIFIED`，**不是執行結果**。實際結果須由對應 JUnit/TAP、project ref、schema 版本及逐筆讀回證據另行記錄；沒有執行就維持未驗證。

整合測試不建立管理員身分、不停用 RLS、不清表、不自動刪除 Fixture；所有主結果有 `p0-acceptance-` 前綴以利隔離環境人工核對。SQL 01 rollback 遇到已保存、舊約束不接受的 ARI 資料會停止；不可為了回滾刪除它們。02／03 rollback 只可在風險審查後移除本輪新增的 restrictive policies，不改原資料或舊 policies。

## 本機測試

```powershell
node --test scripts/p0/audit-history.test.cjs scripts/p0/isolation-guard.test.cjs scripts/p0/preflight.test.cjs
$env:CI='true'
node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand --no-cache --silent
```

本機資料替身驗證程式流程；真正 PostgreSQL constraint、PostgREST 行為、JWT/RLS、實體斷線及重啟仍要另驗收。
