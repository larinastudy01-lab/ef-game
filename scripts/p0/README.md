# 第一輪 P0 驗收工具

後續隔離整合測試與合成資料補齊的必要資源證據、防護及限制見 [P0C-README](P0C-README.md)。原本操作指令不取代新增的 P0-C gate。

目前狀態：本機驗證通過，正式驗收未結案。以下工具不會部署、遷移或自動修復歷史資料。

## 1. 歷史盤點（唯讀）

優先用管理員授權的唯讀 SQL 連線執行 [history-dry-run.sql](history-dry-run.sql)。它在同一個 repeatable-read、read-only transaction 內掃描全部主結果，包括已標記 `synced` 的資料；輸出只有計數及雜湊結果參照，不輸出姓名、患者 ID 或原始答案。需要保留資料庫及本機待傳資料的備份，再另行審查修復名單。SQL 不包含任何寫入或修復。

需要依目前 JavaScript 資料契約精確重算時，可執行：

```powershell
node scripts/p0/audit-history.cjs --help
# 從安全的環境設定提供 P0_AUDIT_URL、P0_AUDIT_API_KEY；
# 使用一般帳號時另提供 P0_AUDIT_ACCESS_TOKEN。不要把密鑰寫進版控。
New-Item -ItemType Directory -Force artifacts | Out-Null
node scripts/p0/audit-history.cjs --out artifacts/p0-history.json
```

此掃描器重用目前的 mapper、驗證及 feature pipeline，檢查數量、原始內容、識別碼、目前衍生版本、PM 作答狀態及 LB 來源鍵。傳輸層拒絕 POST/PATCH/PUT/DELETE，沒有 apply 選項。結果檔以 `wx` 建立，避免覆蓋既有盤點證據。HTTP 分頁並非同一資料庫快照，且只能看見憑證在 RLS 下可見的資料；**空結果不能當成全庫完整性通過**。全庫覆蓋以管理員唯讀 SQL 快照核對。

工具不讀取使用者瀏覽器／其他裝置的 outbox。那些資料須在保留原始內容、帳號綁定及待傳狀態的前提下另外盤點。報表參照仍屬假名化資料，勿直接作為公開研究匯出。

## 2. 正式規則來源等價性

```powershell
node scripts/p0/verify-equivalence.mjs
```

固定比對 P0 前的 `8ef96ff`，不以可移動的 HEAD 當基準。檢查 `src`、套件與現有 SQL，僅允許第一輪列明的 9 個研究轉換／同步檔案和測試差異，並輸出六個正式頁面、protocol、scoring 及結果正規化的 Git blob 證據。非預期變更以非零退出碼結束。這證明來源等價，不代表實機時間或正式部署驗收。

## 3. 隔離 PostgreSQL／PostgREST／RLS 整合驗收（尚未執行）

由維護者提供**可丟棄的獨立測試專案或 loopback Supabase stack**，確認 schema、權限及遷移版本後建立兩個普通 `guardian` 測試帳號及各自的測試患者。不能使用管理員／service role 代替 guardian 做 RLS 驗證，也不能複製正式兒童資料。

透過程序環境提供以下變數，不會自動讀取或覆蓋 `.env`：

| 變數 | 用途 |
| --- | --- |
| `P0_TEST_URL` | 測試專案 origin URL |
| `P0_TEST_PROJECT_REF` | 須與 URL 相同；loopback 使用 `local` |
| `P0_TEST_ISOLATION_ACK` | 明確設為 `DISPOSABLE_TEST_PROJECT` |
| `P0_TEST_ANON_KEY` | 該測試專案的 anon／publishable key |
| `P0_TEST_GUARDIAN_TOKEN` | 第一位普通 guardian 的有效 access token |
| `P0_TEST_OTHER_GUARDIAN_TOKEN` | 第二位普通 guardian 的有效 access token |
| `P0_TEST_PATIENT_ID` | 第一位 guardian 的合成測試患者 |
| `P0_TEST_OTHER_PATIENT_ID` | 第二位 guardian 的合成測試患者 |

```powershell
node --test --test-concurrency=1 scripts/p0/isolated-integration.test.cjs
```

防護會在任何 HTTP 請求前拒絕已知正式 project ref、儲存庫 `.env`／`.env.production` 內設定的主機、URL/ref 不一致或缺少隔離聲明。它不能代替維護者辨識未知專案的用途。測試使用直接匯入的正式同步函式與真實 Supabase client，寫入帶 `p0-acceptance-` 前綴的合成資料，**不會自動刪除或清表**；測完保留供人工核對。

涵蓋：LB 兩階段 20 題、PM 12 題、其他四項任務的 schema 寫入；主結果／Session／Task／Trial／衍生階層請求失敗與重試；寫入已成功但回應遺失；7 題 checkpoint 補齊到 20 題；重複同步、唯一約束；原始內容／ID／數量讀回；匿名與跨 guardian 的讀取、插入限制；原始 Trial 不可改寫。其他四項的一題 fixture 僅用來測傳輸與 task code，並非正式評測規則測試。

網路故障由 fetch 層於真實請求之前／伺服器成功回應之後注入，其他寫讀與約束均由實際 PostgreSQL/PostgREST 執行。這仍須另外實測裝置離線、程式終止再啟動、瀏覽器 outbox 恢復與專業端依同意授權讀取。新的 client instance 不等於真正重啟應用程式。

目前正式庫的 task code CHECK 接受 `SSG`、未接受 `ARI`。隔離環境如保留相同 schema，ARI case 應揭露失敗；**不得為了讓測試過關而刪除唯一約束、停用 RLS 或跳過該 case**。先審查遷移方案，僅在隔離環境驗證後再走正式部署程序。

## 4. 工具本身的本機測試

```powershell
node --test scripts/p0/audit-history.test.cjs scripts/p0/isolation-guard.test.cjs
node --check scripts/p0/isolated-integration.test.cjs
```

這些測試不連線資料庫，不可將它們的通過視為 PostgreSQL／RLS 已驗收。
# P0-B 更新

本輪新增的逐筆分類、隔離補齊防護、兩張表的 ARI Migration 草案及 28 項整合驗收，請先讀 [P0B-README.md](P0B-README.md)。整合測試現在另外需要已授權及未授權兩個 clinician token；先前的兩個 guardian 仍需保留。正式環境寫入仍被禁止。

