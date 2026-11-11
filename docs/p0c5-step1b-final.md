# 蒐秘密｜P0-C5 Step 1B 最終驗收

本輪診斷：2026-10-24T07:40:22.0630482Z～2026-10-24T07:40:30.0340248Z（UTC；臺灣日期 2026-10-24）。程式版本 8ef96ff4100533907bd4c2549a0c018b0553f345 加既有未提交工作樹；993 個來源檔 hash 記錄於私有 initial-state.json。

**BLOCKED。標準 Supabase Local 未建立；原 72 案執行 0、PASS 0、FAIL 0、BLOCKED 72。**

本輪未達核心成功標準。WSL 仍未安裝、Docker Client／Engine 在已查範圍不存在，且使用者非管理員。依使用者第 4.3 節、B2／B3 及停止條件，沒有自行安裝系統功能、UAC 提權或重啟，沒有以原生堆疊或 Mock 替代標準資料庫。

## 本輪實測結果

| 項目 | 本輪結果 | 範圍 |
| --- | --- | --- |
| WSL／Docker 唯讀診斷 | 完成 26 類診斷，Docker 三命令 UNAVAILABLE；WSL exit 1／50／1 | 取得新時間戳、系統狀態與精確錯誤 |
| 官方 Supabase Local | BLOCKED；未執行 start／status | 依本輪順序須先取得 Engine Server，沒有重用前輪 exit 1 |
| ARI Migration／Participant RLS | BLOCKED | 本輪零 DB／SQL／Auth 測試寫入 |
| 原 28＋補 34＋Participant 10 | 執行 0；PASS 0／FAIL 0／BLOCKED 72 | 每案 ID、Expected、Actual、Environment、Commit、Evidence 已列 |
| DELETE／獨立 FK 關聯 | 兩組 BLOCKED | 正確／不存在 FK、跨個案合法 ID 組合與 DELETE 皆未實測 |
| 既有前端回歸 | 86 suites／674 tests／4 snapshots PASS；failed=0 | 本輪重新執行；本機單元／元件／轉換／同步測試，不是標準平台案例 |
| 既有驗收工具 | 44 PASS／0 FAIL | 本輪重新執行六個 scripts/p0 測試檔；不是 DB 寫入 |
| 程式／評測規則保護 | 993 個既有保護檔案 SHA-256 一致 | 保留原工作樹修改；沒有更動正式規則、素材、RAG、UCB1 或 UI |
| 正式環境 | 本輪零連線／寫入／Migration／歷史補齊／Auth／Storage／部署／push | 未使用正式憑證或複製真實個案 |
| 品質分數 | 維持 56／100 | 沒有重新評分 |


前端回歸時間 2026-10-24T07:43:44.025Z～2026-10-24T07:47:51.735Z；工具回歸 2026-10-24T07:43:45.059Z～2026-10-24T07:43:54.679Z。子程序只供 loopback 127.0.0.1:59999 與無效占位 key，不提供正式憑證；CRA 可能讀本機環境檔，但顯式測試設定不由正式 .env 覆蓋。沒有啟動該埠的資料服務。回歸 PASS 不會解除標準 72 案的 BLOCKED。

## 變更與清理

沒有修改應用程式、SQL 草案、既有 migration、正式設定或先前報告。新增本輪五份 Markdown、一份機器證據；私有 .tmp/p0c5-step1b 保存唯讀診斷／回歸 runner、原始結果與 hash 基準。所有既有 src／評測／素材等保護檔案以及八份必讀文件 hash 不變。

本輪沒有建立 stack、container、volume、合成帳號或 DB，所以沒有待刪資料及待停的測試服務；保留私有檔案作證據，未使用 prune／reset 或清除其他環境。CLI 版本快取只產於本輪私有工作目錄，根設定不變。

沒有新標準資料庫實測可證明或排除 P0 缺陷；ARI／04 RLS 的平台相容性、DELETE 與獨立 FK、全部 72 案仍待。補充 runner 的標準 adapter 也未實測，不能只換 URL／cluster 標籤取得 PASS。

## 最小人工交接

由操作者依 [Microsoft 官方流程](https://learn.microsoft.com/en-us/windows/wsl/install)在管理員 PowerShell 執行 wsl --install，完成要求的重啟與 WSL2 驗證；再依 [Docker 官方流程](https://docs.docker.com/desktop/setup/install/windows-install/)安裝／啟動 Linux backend，提供實際 docker version 與 docker info 的 Server 回應。詳細命令、資源與安全核對見環境文件。這是使用者限制要求的人工作業，不是工具自動核准遭拒。

**Step 1B 尚未 PASS；不能以本輪通過為依據進入 Step 2，沒有自動進入 Step 2 或 P0-D。** 最新正式 Schema 唯讀核對仍保留待辦；任何正式 Migration／補齊仍禁止。

## 交付

| 文件 | 用途 |
| --- | --- |
| [environment](p0c5-step1b-environment.md) | 新診斷、具體錯誤、人工官方步驟 |
| [schema-rls](p0c5-step1b-schema-rls.md) | ARI／Participant／DELETE／FK 的未驗範圍 |
| [integration](p0c5-step1b-integration.md) | 原 72 每案真實狀態與版本 |
| [parity](p0c5-step1b-parity.md) | 逐面向差異未知、影響及重驗要求 |
| [machine evidence](p0c5-step1b-evidence.json) | 本輪診斷、真實回歸、來源及 artifact SHA-256 |


E1：[本輪機器證據](p0c5-step1b-evidence.json)，包含診斷、回歸與來源基準的原始 artifact SHA-256。
