# 蒐秘密｜P0-C4 標準 Supabase 相容性

產出：2026-10-24T05:29:20.388Z（UTC；臺灣日期 2026-10-24）。版本：8ef96ff4100533907bd4c2549a0c018b0553f345 加本輪未提交工作樹；逐檔 SHA-256 見[機器證據](p0c4-test-evidence-2026-10-24.json)。

環境：Windows、Node 24.15.0、Chrome 155.0.8059.85；全新原生 PostgreSQL 17.11／PostgREST 16.5／Auth v2.197.0 Windows 適配版。資料庫 p0c4_isolated_c0fc0a60735b，cluster ID 7699882706748678332；API 僅 127.0.0.1:55341。全部使用合成個案及獨立測試帳號，並非標準 Supabase 或正式環境。

**判定 BLOCKED。** 已取得新原生資料庫實證；不能以相同 SQL、同為 PostgreSQL 或模擬測試代替標準平台。未找到 Docker／Podman 或 WSL 發行版，亦未提供可確認用途的獨立雲端測試專案。未新增付費資源或變更系統管理設定。

| 項目 | 本輪原生實測 | 標準 Supabase | 最新正式環境 |
|---|---|---|---|
| PostgreSQL | 17.11，真實資料庫 | NOT RUN | BLOCKED |
| PostgREST | 16.5，真實 HTTP | NOT RUN | BLOCKED |
| Auth | v2.197.0；僅移除 Windows 不支援的 Unix listener 選項 | 非原裝整套平台，未驗等價性 | BLOCKED |
| RLS／CHECK／FK／Unique | 啟用；原 28 與補充案例實測 | NOT RUN | BLOCKED |
| Trigger／Function／RPC | 本機 catalog：58 functions、117 constraints、48 policies | NOT RUN | BLOCKED |
| JSONB／INSERT RETURNING | 精確 raw 讀回；Participant 10/10 | NOT RUN | BLOCKED |
| Kong／Storage／Realtime 等整套服務 | 自訂 loopback 路由代理；Storage API 未啟動 | NOT RUN | BLOCKED |
| 時區 | Asia/Taipei、UTF8、row_security=on | 尚未測 | 最新值未知 |

ARI Migration 演練 10/10，Participant 10/10；非法代碼、NULL、回復與重複執行保留原案例。獨立政策 rollback／forward 演練 R01 及 JWT 竄改 R02 亦通過。ARI 能寫入不代表 ART、ARI、SSG、DPT 的歷史對應已獲確認；本輪沒有推測轉碼。

證據：[migration-evidence.json](../.tmp/p0c4/migration-evidence.json)、[participant-10-attempt1.json](../.tmp/p0c4/participant-10-attempt1.json)、[catalog-readonly-local-final.json](../.tmp/p0c4/catalog-readonly-local-final.json)。隔離檢查核對實際 cluster、連線、Auth issuer、設定與外部副作用，非僅採用環境名稱；普通使用者測試不用 service role。原生 bootstrap／DDL 使用者不計作 RLS 測試身分。

正式遷移仍須在實際標準 Supabase 重跑同一案例與完整瀏覽器範圍，並對照最新正式 catalog。官方環境說明：[Supabase local development](https://supabase.com/docs/guides/local-development)、[Docker and native runtimes](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes)。
