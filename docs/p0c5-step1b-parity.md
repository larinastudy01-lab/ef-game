# 蒐秘密｜P0-C5 Step 1B 等價性

本輪診斷：2026-10-24T07:40:22.0630482Z～2026-10-24T07:40:30.0340248Z（UTC；臺灣日期 2026-10-24）。程式版本 8ef96ff4100533907bd4c2549a0c018b0553f345 加既有未提交工作樹；993 個來源檔 hash 記錄於私有 initial-state.json。

**BLOCKED；目前沒有標準 Supabase 行為可比較，不能宣稱相同或不同。** E1：[本輪機器證據](p0c5-step1b-evidence.json)，包含診斷、回歸與來源基準的原始 artifact SHA-256。

原生欄僅保留 C4 歷史觀察，不是本輪重跑。Unknown 的 High／Critical 表示必要證據不足，不代表新漏洞已被證實。

| 面向 | C4 原生歷史 | 標準 Supabase 本輪 | 嚴重程度 | 資料一致性／正式遷移影響 | SQL 調整／重新驗證 |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL／extensions | 17.11 EDB Windows；C4 真 catalog | 未知；未建 DB | High | 版本／extension／constraint 相容未確認 | 完整 catalog 與 72 重跑後才評估 SQL 調整 |
| PostgREST | 16.5 真 HTTP | 未知；未啟動 | High | upsert、returning、錯誤碼及 gateway 契約未驗 | 保留原 API 斷言及實際設定 |
| Auth JWT | v2.197.0 Windows 適配；本機 issuer／HS256 | 未知；沒有 Auth issuer／普通 JWT | Critical | 權限／role／issuer／演算法未驗 | 用標準 Auth 真實普通登入，不沿用 C4 signer |
| RLS | C4 原生 policy／grants 實測 | 未建立 catalog | Critical | 跨個案、owner／definer／ACL 未確認 | 普通 JWT 正負向、DELETE／revoke；不放寬 guard |
| INSERT RETURNING | 舊 policy 42501、草案後原生通過 | 未執行 | High | 整個同步入口受影響；04 不可當正式驗收 | 原 Participant 10、R01 全部重跑 |
| CHECK | 原生 ARI M01～M10 演練 | 未執行 | High | ARI 01 forward／rollback 不可核准 | 原合法／非法／NULL／回復斷言 |
| Foreign Key | 原生合法關聯與跨綁；無獨立孤兒 FK 通過聲明 | 未執行 | High | 完整性與 RLS 拒絕來源未釐清 | 原案加獨立 P0C5-E-FK |
| Unique | 原生 23505、冪等與無重複 | 未執行 | High | 來源鍵／UUID／版本碰撞仍未知 | I14／I20 及所有 retry 逐欄比對 |
| RPC | 原生授權／撤銷／Patient RPC 實測 | 未執行 | Critical | function owner／ACL／search_path 未知 | 實際 catalog 與普通身分完整重驗 |
| Trigger | 原生 immutable raw 與 audit 等 | 未執行 | High | 來源不可改與外部副作用未確認 | 原定義／trigger config 與拒絕後原資料核對 |
| JSONB | C4 342 raw／current derived 逐欄往返 | 未執行 | Medium | Raw／NULL／RT／版本／時間資料未驗 | 精確 UUID／JSONB／同一 instant 比對 |
| 同步重試 | 原生分段保存、ACK lost、程序重啟／並行 | 未執行 | High | 不能推論標準平台同樣收斂 | 原 72 全跑；保留 journal／pending |
| 交易／錯誤回復 | 原生單次 SQL 原子；跨 HTTP 部分進度依讀回重試 | 未執行 | High | 錯誤碼／rollback／部分提交復原未知 | 不得宣稱跨 HTTP 全域原子性；forward／rollback／恢復均重驗 |


每列是否相同、是否存在行為差異、是否需修改 SQL，目前都不可判定；全部需要真實標準環境再驗。沒有根據未測猜測去改程式、policy 或期待值。

實際確認的環境差異仍是「可執行的 C4 自訂原生服務歷史」與「本輪尚無容器 runtime」；不可把 PostgreSQL 名稱相同當等價證明。即使日後標準 Local 通過，正式服務版本／Schema／RLS 仍需 Step 2 最新唯讀核對。本輪未進 Step 2、未嘗試正式 OAuth 重新授權、未允許 P0-D。
