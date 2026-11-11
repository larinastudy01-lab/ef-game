# P0-C 安全預檢與隔離驗收工具

**目前 BLOCKED；沒有可確認的隔離資料庫，本輪沒有啟動 stack、建立雲端專案或執行 DB 寫入。禁止正式 Migration／補齊／部署。**
本文件是準備與後續隔離操作規格，不是完成證據。交付總表見 [驗收報告](../../docs/p0c-acceptance-report.md)。

## 目前可執行的離線工作

在儲存庫根目錄執行；輸出必須是新檔，避免覆蓋既有證據：

```powershell
node scripts/p0/p0c-preflight.cjs NEW_ENVIRONMENT_REPORT.json
# BLOCKED 時程序碼 2。只查 --version、讀本機檔案；不建 client、不發 HTTP。
node scripts/p0/build-p0c-matrix.cjs NEW_BLOCKED_MATRIX.md
node --test scripts/p0/audit-history.test.cjs scripts/p0/isolation-guard.test.cjs scripts/p0/preflight.test.cjs scripts/p0/p0c-guard.test.cjs scripts/p0/p0c-fixtures.test.cjs scripts/p0/p0c-catalog.test.cjs
$env:CI='true'
node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand --no-cache --silent
node scripts/p0/verify-equivalence.mjs --out NEW_EQUIVALENCE_REPORT.json
```

preflight 即使離線 gate 接受證據，也不會輸出整體 PASS；它不證明資料庫正在執行、服務版本相符或簽章有效。矩陣產生器只產生 BLOCKED，不能把期望目錄轉成執行成功。catalog test 不執行測試 callback／before／HTTP。

## 獨立本機環境的準備模板（未啟動、未由 CLI 驗證）

[local-stack/supabase/config.toml](local-stack/supabase/config.toml) 使用獨立 project_id `ef-game-p0c-isolated`、API 55321／DB 55322／shadow 55320，DB major 17 是**預定**而非實際版本。關閉自動 migrations/seed、public signup、Realtime、Studio、analytics、edge runtime；沒有 env()、正式 key 或對外 SMTP。Storage 保留為獨立本機服務，不能因此省略資源檢查。

Windows 本機 Supabase 需要 CLI 與 Docker 相容 runtime；安裝、CLI 版本選定與啟動尚未完成。操作前依 [官方本機開發文件](https://supabase.com/docs/guides/local-development) 與 [設定參考](https://supabase.com/docs/guides/local-development/cli/config) 核對實際安裝版本，記錄精確 CLI／container image digest／PostgreSQL／PostgREST／Auth 版本；不要把模板值當實測值。

後續在已安裝工具、確認埠未被其他專案使用，並審閱設定後才可能使用：

```powershell
# 以下僅為未執行的準備指令；不會 link 或 push 到雲端。
docker network create -o 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1' ef-game-p0c-local-network
supabase start --workdir scripts/p0/local-stack --network-id ef-game-p0c-local-network
```

獨立網路需先確認不存在同名其他用途網路。確認 API/DB 僅綁 loopback；不發布到 LAN／公網。CLI start/status 可能顯示 local keys，輸出保留私有、不得貼入 Git／報告。若 CLI 不接受模板或服務依賴不符，停止並修正模板；本輪尚未驗證這兩個指令或模板的引擎相容性。不得改用正式環境變數、supabase link、db push、既有雲端 project 或自行建立付費資源。

在**新且空白**本機 DB 中，人工審閱儲存庫 supabase/rebuild 的 01、03、04、07、08、09、10 結構相依；不使用 00_RESET_PUBLIC_APP.sql、不複製正式資料、不啟動 RAG／推薦作業。先保留 catalog，再依 [Schema 審查](../../docs/p0c-schema-migration-review.md) 演練兩張舊 CHECK 及 01/02/03 drafts。服務建立與 SQL 連線每一步均須核對實際 DB／容器身分，SQL session 標籤不是隔離證明。

## 開啟寫入測試前的隔離證據

以 [attestation.example.json](local-stack/attestation.example.json) 為結構範本；其 false／UNVERIFIED／placeholder 故意無法通過。不要直接全改 true。人工檢查並保存：

- resource_identity：實際 project ref/origin、Docker project/容器/volume/network 或專案資源歸屬、DB 身分與精確服務版本。
- service_configuration：Auth issuer、獨立金鑰來源、Storage、郵件／簡訊關閉、無正式 Storage/Auth 連線；API 只綁 loopback 或經審閱的獨立雲端。
- database_side_effects：資料表／trigger/function/webhook/排程清單，確認沒有外部正式通知、推薦、RAG 或其他副作用；只有合成資料。

證據放 `.tmp/p0c/` 或 `artifacts/p0c/`，去除秘密與原始個資，填實際相對路徑及 SHA-256；guard 會檢查 realpath 與 hash，並要求 24 小時內 review、reviewer、精確 target、versions、API key fingerprint、獨立資源與清理計畫。證據內容仍需人工核實，hash 只證明檔案未變，不自動證明陳述真實。

只在目前 shell 提供 **P0_TEST_*** 變數：URL、PROJECT_REF（loopback 為 local）、ISOLATION_ACK=DISPOSABLE_TEST_PROJECT、ANON_KEY、GUARDIAN_TOKEN、OTHER_GUARDIAN_TOKEN、PATIENT_ID、OTHER_PATIENT_ID、CLINICIAN_ALLOWED_TOKEN、CLINICIAN_DENIED_TOKEN，以及 **P0C_ATTESTATION_FILE**。不得改正式 .env。不得用 dotenv 載入正式設定做 fallback。

[p0c-guard.cjs](p0c-guard.cjs) 先沿用 URL／正式 project 硬封鎖，再查資源證據、版本、API key hash、不同使用者與 JWT role/issuer/expiry；拒絕本機正式設定中重用的憑證、service-role JWT 或 sb_secret_ key。JWT 離線解碼不是簽章驗證；原整合腳本 before 階段還須以 getUser 驗證服務端身分、profiles.role、患者所有權與 clinician 正負向存取，全部通過才開始資料寫入。所有使用者測試只使用 anon/publishable API key + ordinary authenticated JWT。

## 合成身分與資料

管理員只可在已核對隔離 stack 內建立完全合成帳號、患者及授權；不寄真實郵件、不使用真實照片／payload。管理設定操作另記錄，權限測試程序不得持有 service key。

原 28 案準備 guardian A/B、各一患者、approved clinician A/B；只授權 clinician A 讀 A 的結果。另準備獨立研究用途 persona 與匿名 client。**目前 role CHECK 沒有 researcher，不能隨意加角色或改用 admin 代替**；先確認研究用途與 scope 契約，再實作 X01。撤銷授權 X02 需由家長以現有 revoke_patient_access 路徑操作後，重查同 JWT／新 client。沒有完成這些步驟不算六角色驗收。

[p0c-fixtures.cjs](p0c-fixtures.cjs) 僅程式生成 LB 兩階段相同 stepIndex、PM 取消／逾時／未施測、CBT 提前停止、ARI 代碼等資料；來源前綴 p0-acceptance-，含固定於該物件的研究 UUID，raw 與 trials 各自保留。資料內容不是正式題目生成器，不能推導正式規則。DB 補齊前先 dryRun，再人工核准該合成計畫。不要把正式盤點 JSON 或真實 plan 當 Fixture。

## 真實測試（目前不可執行）

原 [isolated-integration.test.cjs](isolated-integration.test.cjs) 保留 28 個名稱／ID。新增 gate 在建 client 前執行；缺證據即停止，不能用減少測試或改期望目錄取得 PASS。

```powershell
# 僅在上述全部隔離／身分／Schema 審查完成後；這次未執行。
node --test --test-concurrency=1 --test-reporter=junit --test-reporter-destination=artifacts/p0c-integration.junit.xml scripts/p0/isolated-integration.test.cjs
```

輸出 JUnit 是私有執行紀錄，失敗訊息仍須人工檢查／去識別後才可分享。每次用新輸出檔／run ID，不覆蓋前次證據。原28之外的 X01–X12 仍須實作或依人工程序實測，見 [矩陣](../../docs/p0c-integration-test-matrix.md)。I07–I11 的 fetch 故障、I18 的七筆獨立原子 checkpoint、I20 的同程序 clients，均不得宣稱實體斷線／整個程序 crash／跨程序並行已測。

## 單筆／分批演練、失敗與回復

沿用 [P0-B dryRun/journal 操作](P0B-README.md)。repair-batch 預設唯讀；apply-isolated 現在額外要求同一份 P0-C attestation，P0_REPAIR_URL 必須等於已審閱 origin，REPAIR_ANON_KEY 與 REPAIR_ACCESS_TOKEN 必須是同組 TEST_ANON_KEY／TEST_GUARDIAN_TOKEN。既有每筆 approved plan、owner、來源快照、合成 ID 前綴與正式 ref 封鎖仍保留，未提供正式 apply 開關。

每筆在 mutation 前 fsync intent；失敗保留 journal、原始 payload、部分階層與 outbox。使用**同一核准 plan／IDs**重新啟動，不因 journal 顯示成功而略過讀回；來源有變化或 raw 衝突立即停止，不覆寫。歷史主結果狀態不由這個工具更新。X09 的實際 child process 終止與重啟尚未完成。

沒有新增 DB transaction/RPC。同步是分段持久化、逐層驗證與重試，不能宣稱跨 HTTP 請求的全域原子性。PostgreSQL 單批原子提交與多請求部分進度需分別驗收。

## 合成資料清理與避免誤連

原測試故意保留具前綴的 Fixture 供讀回檢查；本輪不自動 DELETE、DROP 或 RESET。結束後先存 evidence／計畫／journal，再確認實際 project_id、origin、容器及 volumes 清單與本次 run 一致。
專用本機 stack 可在核對 CLI 當前 stop 語意後，僅停止此 workdir 的 stack；保留資料供失敗調查。要銷毀合成資料，另核對具體專用 volume IDs 與掛載，再清理這些精確資源，不能使用 docker volume prune／全域 reset。若有其他資料或歸屬不明即停止；獨立雲端只可按合成 ID 清理並重新讀回，不能清表或刪共用 Auth/Storage。
清理流程目前僅為規格，尚未實測，因此 X12 維持 BLOCKED。不提供會誤刪未知資源的一鍵清理指令。
