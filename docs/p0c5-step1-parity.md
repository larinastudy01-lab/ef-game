# 蒐秘密｜P0-C5 Step 1 環境差異

診斷 2026-10-24T07:06:34.4325444Z～2026-10-24T07:06:44.2517995Z；CLI 嘗試 2026-10-24T07:09:02.188Z～2026-10-24T07:09:05.427Z（UTC，臺灣日期 2026-10-24）。Git 8ef96ff4100533907bd4c2549a0c018b0553f345 加既有未提交工作樹。

**BLOCKED；本輪未取得標準 Supabase 的資料庫行為證據，不能判定兩者等價。** E1 = [本輪機器證據](p0c5-step1-evidence.json)，內含診斷、兩次 CLI 呼叫與私有原始檔 SHA-256。

以下原生欄僅引用已保留的 C4 歷史實測。本輪沒有重啟原生堆疊，也沒有補填未取得的平台資訊。High／Critical 的未知表示遷移必要證據不足，不是已證明漏洞。

| 面向 | 原生測試堆疊（C4） | 標準 Supabase（本輪） | 嚴重程度 | 影響／正式遷移 | 處理／額外測試 |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL | 17.11 EDB Windows；C4 真實 catalog | 未啟動；實測版本 null | High | 全部 SQL／版本／extension；不能推定正式 migration 相容 | 先啟動官方容器、取 catalog；完整 72 加 FK 負向 |
| PostgREST | 16.5 真實 HTTP | 未啟動；實測版本 null | High | 錯誤／upsert／returning 及 API 行為未知 | 保留錯誤與 API 設定，重跑完整 72 |
| Auth／JWT | v2.197.0 Windows listener 適配；HS256 本機設定 | 未啟動；issuer／claims／演算法 null | Critical | 所有權限案例；未足以核准正式 migration | 使用官方 Auth 密碼登入的普通 JWT；不得移用 C4 signer 或放寬 issuer guard |
| RLS／grants | C4 原生案例通過；48 policies | catalog 未建立，未知 | Critical | 跨個案及跨 Trial 綁定，owner／definer／grant 皆需再驗 | 重跑 I15／I25／I26／I28、R01、Participant 等全部相關案例 |
| INSERT RETURNING | 舊 policy 42501；草案後 Participant 10/10 | 未執行 | High | 新 Participant 及整個同步入口可能受阻；草案未完成平台驗收 | 真實普通 JWT INSERT／upsert returning；不能改預期放行 |
| CHECK | ARI 演練 M01～M10、合法與非法碼實測 | 未執行 | High | 正式 ARI 01 migration 不可視為核准 | 同草案 forward／repeat／rollback＋原合法碼／NULL |
| Foreign Key | C4 catalog／合法關聯及跨綁測試；未單獨宣稱孤兒 FK 23503 | 未執行 | High | 關聯完整性；拒絕原因不能被 RLS 掩蓋 | 原案例加 P0C5-E-FK |
| Unique | 來源鍵 23505、重試無重複 | 未執行 | High | 重複 Trial／版本風險，未知 | I14／I20 及保留原 UUID 的重試 |
| RPC／function／trigger | C4 58 functions、既有授權／revoke 及 immutable raw 實測 | 未執行 | Critical | definer／search_path／ACL／外部副作用未確認 | 比實際定義與 grants；測普通角色，DDL 角色只作建置 |
| JSONB／NULL／timestamp | 342 實際 UI raw 與 current derived 逐欄讀回；Asia/Taipei | 未執行；時區 null | Medium | payload／日期邊界／NULL 契約未知 | 逐欄與同一 instant 比對，不能只比數量 |
| 同步重試 | 28＋34 有分段提交、ACK lost、程序重啟等原生實測 | 未執行 | High | main／研究階層部分進度不可推定相同 | 原 ID 完整重跑；保留 journal，無 global HTTP transaction 宣稱 |
| Gateway／Storage | C4 自訂 loopback 路由；只有 Storage schema 子集，API 未啟動 | 整套標準服務未啟動 | High | apikey／路由／獨立 Storage／外部副作用仍未知 | 官方 CLI containers 的版本／digest／設定與隔離核對，不複製 C4 子集冒充 |


每個未知都阻止以本輪結果核准正式 migration。沒有任何實測差異支持修改應用程式或 SQL，所以本輪沒有修改它們。啟動失敗是環境前置阻擋，未歸類為已重現的資料庫 FAIL。

目前能確認的差異是執行環境本身：C4 的自訂原生服務已移除；本輪官方 CLI 能執行，但標準容器環境未建立。這不證明任何資料庫行為相同或不同。版本與設定不明時，原 28＋補 34＋Participant 10 全部保留 BLOCKED，不能只選少數案例重驗後聲稱 72 通過。

現有 private 補充 runner 的 native-db.cjs／psql helper、attestation、Auth 取得及程序控制需接入標準環境；不得保留 C4 的 cluster ID、移植 Auth signer 或自訂 gateway 當作標準資源。確切 adapter 調整需以真實 stack 身分及輸出驗證，不能只完成靜態改寫就關閉相容性風險。

依[官方 runtime 文件](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes)，Windows 不能走官方 experimental native runtime；本輪沒有以原生重跑代替標準驗證。最新正式 schema 唯讀核對仍屬 Step 2，本輪未連線正式、未重新嘗試使用者已拒絕的 OAuth 授權。
