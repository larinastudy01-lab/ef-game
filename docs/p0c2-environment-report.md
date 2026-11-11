# P0-C2 環境與隔離報告

日期：2026-10-23。隔離環境確實建立並完成測試，現已停止服務及移除本輪新建合成資料叢集。採用本機原生 PostgreSQL／PostgREST／Supabase Auth 替代堆疊；它不是完整官方 Docker Supabase Local，也不是記憶體資料庫替身。

## 環境檢查與選擇

| 項目 | 最初狀態／版本 | 可執行結果與處理 |
| --- | --- | --- |
| Windows | x64，10.0.26200；登錄 build 26200.9711、25H2、Core | 不依登錄舊 ProductName 判斷產品名稱；16 logical processors |
| Node／npm | v24.15.0／11.12.1 | 可執行；既有專案依賴沿用 |
| Git | 2.54.0.windows.1 | 可執行；沒有 push |
| Docker／Podman／Rancher | PATH 與常見位置均未發現可用安裝 | 亦檢查服務、登錄移除清單、Docker context／named pipe，沒有容器引擎可啟動 |
| WSL | 有系統可執行檔；無 distro 登錄 | wsl --status exit 50：未安裝；未啟用系統功能、提權或重開機 |
| Supabase CLI | 初始未找到可用 binary | 下載工作區固定版 2.121.0，停用 telemetry 後 version 成功；start 實際回 DockerLifecycleInspectError（docker／podman 均不存在） |
| PostgreSQL Client／Server | 初始未找到 | 官方可攜版 17.11-5，psql／initdb／pg_ctl 可執行，實際 server 17.11 |
| PostgREST | 初始未找到 | 官方 Windows 16.5 實際執行 |
| Supabase Auth | 初始未找到 | 官方固定 tag v2.197.0 編譯，加下述 Windows listener 移植 |
| Go | 初始未找到 | 官方可攜版 go1.27.3，僅工作區內編譯工具 |
| 資源 | 初始 total RAM 15.26 GiB／free 2.71 GiB；磁碟 447.43 GiB／free 25.67 GiB | Node OS／statfs 讀值；CIM 查詢受限時未將 unknown 寫成 0；未驗證韌體虛擬化／SLAT |
| 專案設定 | 檢查既有 Supabase 設定、rebuild 與 scripts/p0/local-stack 模板 | 沒有覆寫正式 config／migration／.env；CLI 新建的空 cli-latest cache 已單獨移入私有證據目錄 |

工具搜尋不只 PATH，包含 Program Files、LocalAppData、Scoop、WinGet、專案 node_modules、服務與登錄資訊。原有使用者 .supabase 目錄只有 telemetry／traces，不能當成已安裝 CLI。

方案 A 已實際嘗試：工作區 CLI 能啟動解析測試模板，但沒有 Docker。WSL／Docker 系統需求無法在「不要求管理員、不修改全域／開機設定」限制下補足，因此沒有執行安裝腳本或啟用系統功能。方案 B／C 沒有已知獨立專案或可確認 Branch，使用者亦已說明目前沒有；沒有建立雲端／付費資源。最後採用真實本機原生服務作安全替代，已取得資料庫證據，但保留與標準 Supabase 平台的相容性限制。

官方依據：[Supabase local development](https://supabase.com/docs/guides/local-development)、[Docker Windows prerequisites](https://docs.docker.com/desktop/setup/install/windows-install/)、[Docker permissions](https://docs.docker.com/desktop/setup/install/windows-permission-requirements/)、[WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install)。沒有把 Linux／Apple Silicon 的實驗性 native 模式宣稱為 Windows 官方支援。

## 下載與執行邊界

所有下載均存 .tmp/p0c2/tools，固定版本、檢查 ZIP 路徑越界後解壓；未將遠端安裝腳本交給 Shell 執行。沒有全域 PATH、服務、開機、UAC 管理員或雲端費用變更。沙箱外核准執行仍是一般 Windows 使用者，不代表取得系統管理員權限。

| 官方資產 | SHA-256 | 發行者校驗 |
| --- | --- | --- |
| Supabase CLI 2.121.0 release.zip | 2606459be86e12e03fb6f6b9aa12a02aa00cfe21374857ec837a09c70b837eca | GitHub release digest 相符 |
| PostgreSQL 17.11-5 Windows binary ZIP | 80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f | 官方 .zip.sha256 相符；在下載紀錄之後另行核對 |
| PostgREST v16.5 Windows ZIP | 17f595b0d8dd37473d0231417dea07c5ac9f791282ff5b017fae51ff29e5de2f | GitHub release digest 相符 |
| Go 1.27.3 Windows amd64 ZIP | f26081f438319757f8a1b46d7d0b2c5ec7583d4038e485e0aa725cfde7885fff | go.dev 官方 JSON digest 相符 |
| Supabase Auth v2.197.0 source ZIP | 359a3235b3280e8c8c175559450a07b72249504edc55b266ab9be1776470526b | 固定官方 tag、TLS 下載的觀察 hash；沒有獨立簽署的 publisher digest |

來源：[CLI release](https://github.com/supabase/cli/releases/tag/v2.121.0)、[PostgreSQL Windows](https://www.postgresql.org/download/windows/)、[EDB binaries](https://www.enterprisedb.com/download-postgresql-binaries)、[PostgREST install](https://docs.postgrest.org/en/stable/explanations/install.html)、[Auth source](https://github.com/supabase/auth/tree/v2.197.0)、[Go downloads](https://go.dev/dl/?mode=json)。

Auth 原碼在 Windows 編譯遇 unix.SetsockoptInt／SO_REUSEPORT 不可用，僅於私有來源副本 cmd/serve_cmd.go 移除該 Unix socket control、改預設 net.ListenConfig{}；沒有改 JWT、驗證、授權或資料庫邏輯。Go 使用 readonly modules、獨立 cache、CGO=0、GOMAXPROCS=2；沒有修改專案應用程式。這是有移植差異的原生 Auth，不宣稱未修改官方 binary。原始碼與適配檔均留在私有工具目錄。

initdb 初次受沙箱 restricted token 與 CP950／中文路徑限制失敗；改用一般使用者執行與指向工作區的私有 ASCII Temp junction。SQL 以 UTF-8 檔案送 psql，未修改 SQL 內容規避編碼。清理已移除 junction。初次慢速全量解壓的工具目錄保留，真正執行用另行驗證的 pg-core 目錄。

## 真實隔離識別與防護

| 識別 | 實際值 |
| --- | --- |
| DB | p0c2_isolated_cabffaaa4591 |
| PostgreSQL cluster system identifier | 7699777475111413860 |
| PostgreSQL | 127.0.0.1:55432 |
| API gateway | http://127.0.0.1:55321，Project Ref local |
| PostgREST | 127.0.0.1:55398 |
| Auth | 127.0.0.1:55399；health 200／v2.197.0 |
| 寫入測試認證 | 本輪全新 local secret、anon key、真實 Auth password-login 普通 JWT |
| 物理資料 | 工作區 .tmp/p0c2/native-pgdata，全新叢集，沒有正式資料複製 |

所有 listener 經 netstat 確認只綁 loopback。gateway 只有 HTTP 路由，JWT 驗證由真實 Auth／PostgREST 完成，RLS 由 PostgreSQL 執行。Storage API 停用，僅載入必要官方 Storage schema 相依；沒有正式 Webhook、RAG、通知或推薦 workload。

寫入前使用既有 scripts/p0/p0c-guard.cjs：比對 URL／host／DB／system identifier、實際資源與服務設定雜湊、認證來源、全新 fixture 前綴及非正式目標，不以 TEST 名稱取代驗證。子程序環境只繼承基本 OS 變數及專用測試設定；不傳正式 URL、正式 service role、個案 payload。bootstrap admin 僅設立全新合成帳號，不供 RLS runner；R02 驗證偽造 service_role claim 仍被拒絕。

## 清理及未解決環境

清理 2026-10-23T09:16:20.951Z PASS：確認 cluster ID、資料夾實際位置及 PID／binary；只有本輪 5 個合成 Auth 帳號、foreign main／auth／patients 均為 0 後，停止 Auth／PostgREST／gateway 與 PostgreSQL，移除本輪叢集及私有 junction。沒有刪除既有開發資料或 Docker Volume。工具與證據保留；舊私有設定已無可連線服務，重測必須新建隔離實例與新金鑰。

仍未解決：CUA inventory 無 app／browser，實際 getBrowser 回 No browser is available，因此不能做真實瀏覽器／實體斷線驗證；正式 Supabase connector 最新唯讀查詢在 OAuth refresh 階段失敗，沒有取得當下 catalog。既有 P0-B 快照只能當歷史依據。原生 listener 適配、路由 gateway 與 Storage API 未啟動，也限制對完整託管平台的等價性結論。


所有時間為 UTC；2026-10-23 台灣時間為 UTC+8。逐案機器結果與 SHA-256 見 [驗證證據](p0c2-test-evidence-2026-10-23.json)。私人執行資料位於 .tmp/p0c2，不納入版本控制；公開文件沒有金鑰、JWT 或真實個案 payload。
