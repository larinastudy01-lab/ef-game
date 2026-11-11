# 蒐秘密｜P0-C4 最新正式 Schema 唯讀審查

產出：2026-10-24T05:29:20.388Z（UTC；臺灣日期 2026-10-24）。版本：8ef96ff4100533907bd4c2549a0c018b0553f345 加本輪未提交工作樹；逐檔 SHA-256 見[機器證據](p0c4-test-evidence-2026-10-24.json)。

環境：Windows、Node 24.15.0、Chrome 155.0.8059.85；全新原生 PostgreSQL 17.11／PostgREST 16.5／Auth v2.197.0 Windows 適配版。資料庫 p0c4_isolated_c0fc0a60735b，cluster ID 7699882706748678332；API 僅 127.0.0.1:55341。全部使用合成個案及獨立測試帳號，並非標準 Supabase 或正式環境。

**BLOCKED。** 2026-10-23T15:14:51Z 嘗試既有 Supabase list_projects，回覆「OAuth token refresh failed: Failed to parse server response」。使用者已選擇暫不重新授權，本輪沒有改用其他特權 credential 或繞過驗證。

| 檢查 | 最新正式結果 |
|---|---|
| Schema／Migration history／Column type／Default／NULL | BLOCKED |
| ARI CHECK 是否仍阻擋 | UNKNOWN／BLOCKED |
| Participant INSERT RETURNING／UPDATE 綁定政策 | UNKNOWN／BLOCKED |
| FK／Unique／RLS／Trigger／Function／RPC／Index | BLOCKED |
| main／Raw／研究階層目前數量 | UNKNOWN，不套用歷史快照 |
| 錯標 synced 21 筆是否仍存在 | UNKNOWN |
| A／B／C／D／E 最新分類 | 未重算；UNKNOWN |

100 筆 main、1,214 Trial、21 筆錯標 synced，以及 A69／B4／C26／D1／E0 只是先前歷史快照，絕非本輪最新正式結果。合成原生資料庫的任何數字也不能替代正式盤點。

可安全完成的是 repository／本機 catalog 及既有 SQL 草案的演練。正式連線恢復後，先以唯讀交易執行 [05-production-catalog.readonly.sql](../scripts/p0/sql/05-production-catalog.readonly.sql)，另取得 migration history，確認 ARI／Participant 政策與所有關聯；再以原 dryRun／reconciliation 工具重算分類與錯標 synced 清單。未取得資料前，不產生可自動套用的正式 repair plan。

本輪新增的 LB 摘要／CBT 百分比問題，也只對新結果修正轉換。歷史需另作只讀差異表，不能直接乘 100 猜舊資料單位。未執行正式 SQL、Migration、歷史補齊、狀態重設、Auth／Storage 變更、部署或 push，均為 0。
