# 蒐秘密｜P0-C5 Step 1 環境診斷

診斷 2026-10-24T07:06:34.4325444Z～2026-10-24T07:06:44.2517995Z；CLI 嘗試 2026-10-24T07:09:02.188Z～2026-10-24T07:09:05.427Z（UTC，臺灣日期 2026-10-24）。Git 8ef96ff4100533907bd4c2549a0c018b0553f345 加既有未提交工作樹。

**BLOCKED。標準 Supabase Local 未啟動；本輪資料庫案例 PASS 0／FAIL 0／BLOCKED 72，實際執行 0。**

E1 = [本輪機器證據](p0c5-step1-evidence.json)，內含診斷、兩次 CLI 呼叫與私有原始檔 SHA-256。

## 實際工具與資源

| 工具 | 存在 | 版本 | 可正常執行 | 下一步 |
| --- | --- | --- | --- | --- |
| Docker Desktop／Engine | 未在 PATH、常見安裝路徑、登錄、服務、程序、named pipe 找到 | — | 否；CLI 實測找不到 docker／podman | 由操作者先完成 WSL／官方 Docker 前置安裝 |
| Supabase CLI | 是；專案私有 tools 目錄 | 2.121.0 | --version exit 0；start／status exit 1 | 沿用固定版；升級 CLI 不能補足缺少的容器引擎 |
| PostgreSQL Client | 是；既有可攜工具 | psql (PostgreSQL) 17.11 | psql --version exit 0；沒有標準 stack DB 可連 | 不重開 C4 原生叢集代替驗收 |
| Node.js | 是 | v24.15.0 | exit 0 | 無需安裝 |
| npm | 是 | 11.12.1 | exit 0 | 無需改依賴 |
| Git | 是 | git version 2.54.0.windows.1 | exit 0 | 保留既有未提交內容，沒有 push |
| WSL | 只有系統 wsl.exe；WSL runtime／distro 未安裝 | 無可用 runtime 版本 | --version exit 1；--status exit 50；--list --verbose exit 1 | 人工完成 WSL 安裝及所需重開機 |
| Podman／Rancher Desktop | 本次搜尋未找到 | — | 不可執行 | 兩者 Windows 方案同樣需要 Linux VM／WSL |
| QEMU／VirtualBox／nerdctl／Lima | PATH、常見位置及專案工具未發現可用安裝 | — | 未建立可用 Linux VM | 未下載新 VM；目前資源有限，不能推定可安全執行完整 stack |


主機 Microsoft Windows 11 Home 10.0.26200（build 26200），AMD Ryzen 7 260 w/ Radeon 780M Graphics，8 cores／16 logical processors。可見 RAM 15.26 GiB、當時空閒 2.64 GiB；C 槽總量 447.43 GiB、剩餘 13.17 GiB。這是單次讀值，沒有把低空閒量宣稱為官方硬性不相容。未刪除先前證據來釋放空間。

Firmware virtualization=true、hypervisor present=true；CIM 的 VMMonitor／SLAT 回 false。已存在 hypervisor 時不能單靠此值斷定硬體不支援，也不能證明 Docker backend 已可運作。Windows Home 的本輪目標是 Linux containers。

首個沙箱內 CIM 查詢遭拒，並未把空值當成零；後續經工具核准以一般使用者執行唯讀診斷取得上述實值，沒有 UAC 提權、安裝服務或變更 Windows 功能。共 21 類診斷均取得觀察結果；版本查詢失敗仍保留各自 exit code。

搜尋包括 Program Files、LocalAppData 的 DockerDesktop per-user 路徑、Scoop／WinGet、node_modules、.tmp 工具、HKLM／HKCU uninstall、WSL Lxss、Appx、服務、程序及 Docker named pipes。沒有只憑 PATH 判斷；詳細搜尋範圍及空集合見 E1。

診斷時占用的不同 TCP 埠：135、139、445、1123、5040、5354、6850、7778、13030、13031、13032、22112、24830、27036、27339、42050、49664、49665、49666、49667、49668、49677、50100、50923、51100、51291、51292、51715、51727、58415、59348。本次預定 API 55361／DB 55362／shadow 55360 均未占用；埠空閒不代表服務存在。未停止任何既有服務。

## 真實啟動嘗試

根目錄 supabase/config.toml 不存在；既有 scripts/p0/local-stack/supabase/config.toml 是準備模板。沒有覆寫它。另建 .tmp/p0c5-step1/local-stack/supabase/config.toml，只變更 project_id 為 ef-game-p0c5-step1，以及上述三個埠；自動 migration／seed、外寄服務等設定沿用禁用狀態。

實際使用 .tmp/p0c2/tools/supabase-2.121.0/supabase.exe，執行：

```text
start --workdir <workspace>/.tmp/p0c5-step1/local-stack --debug
status --workdir <workspace>/.tmp/p0c5-step1/local-stack --output json
```

兩者 exit 1，stderr：

```text
failed to inspect container health: docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH
```

同時記錄 [inbucket] deprecated，建議未來改用 [local_smtp]；這不是本次阻擋原因，未為它修改既有設定。debug 中私有 supabase-home/profile 不存在，是全新未登入環境，未改用正式 profile。未產生 DB、測試帳號、金鑰、container／volume 或 image digest；不能補填平台版本。

子程序採 OS 變數白名單，不傳 SUPABASE_ACCESS_TOKEN／正式金鑰，DOCKER_HOST 固定本機 named pipe，DOCKER_CONFIG 與 SUPABASE_HOME 都是新建私有路徑。未 link、未 db push、未載入正式 .env 作為連線設定。啟動嘗試前後原模板與根 supabase/.temp 的檔案雜湊一致。先前版本診斷額外建立的 supabase/.temp/cli-latest（建立於診斷時間窗、內容 v2.122.0）已單獨移入本輪私有證據，恢復原先不存在狀態；沒有清理其他快取或設定。

CLI archive SHA-256 2606459be86e12e03fb6f6b9aa12a02aa00cfe21374857ec837a09c70b837eca 與 C2 已核對的官方 release digest 相符；本輪再次驗證壓縮包中的 exe 與實際執行 exe 相同。未宣稱本次重新向發行站取得 digest。CLI 自行提示 v2.122.0 可用；版本更新不是缺少 Docker 的解法。來源：[官方固定版](https://github.com/supabase/cli/releases/tag/v2.121.0)。

## 安全替代方案檢查

官方 start 需要 Docker 相容 runtime；官方實驗 native runtime 不支援 Windows，因此沒有再用自製 Windows 原生服務替代。[Supabase runtime 文件](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes)

已檢查 Docker、Podman、Rancher、WSL 及既有 VM 工具，沒有找到可直接啟動的安全替代。Podman Windows 透過 WSL2 guest；Rancher Windows 也要求事先安裝 WSL。[Podman 安裝](https://podman.io/docs/installation)、[Rancher 安裝](https://docs.rancherdesktop.io/getting-started/installation/)

## 必要人工解除步驟（本輪未執行）

1. 先保留工作，依 Microsoft 官方流程，由有權限的操作者在管理員 PowerShell 執行 wsl --install，按要求重新開機，再用 wsl --version、wsl --status、wsl --list --verbose 核對 WSL2。[Microsoft WSL 安裝](https://learn.microsoft.com/en-us/windows/wsl/install)
2. 從 Docker 官方 x86_64 安裝來源安裝 Docker Desktop；官方提供 per-user 模式，可用安裝程式 install --user，該模式本身不要求管理員，但不能取代尚未完成的 WSL 前置功能。完成首次啟動及適用條款確認，選 Linux containers。[Docker 官方 Windows 安裝](https://docs.docker.com/desktop/setup/install/windows-install/)
3. 執行 docker version 與 docker info，確認 server 回應且 OSType=linux；重新量測可用 RAM／磁碟，釋放工作負載由操作者自行決定。不要使用未知遠端 DOCKER_HOST。
4. 新建 run 目錄與專用 loopback Docker network，重新查埠、審閱設定後，以固定官方 CLI 啟動；完整輸出留私有。不能直接重跑本輪 attempt-standard.cjs：它刻意拒絕覆蓋已存在 workdir。
5. 先核對實際 containers／images digest／volumes／network、DB identity、Auth issuer、Storage、金鑰來源與副作用，再允許建合成身分／DDL。沿用安全 guard，不能靠把 attestation 改成 true 取得許可。

停止位置為 Step B；後續標準環境寫入一律未執行。未安裝任何新工具、未改系統設定、未取得管理員權限。
