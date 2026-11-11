# 蒐秘密｜P0-C5 Step 1B 環境恢復

本輪診斷：2026-10-24T07:40:22.0630482Z～2026-10-24T07:40:30.0340248Z（UTC；臺灣日期 2026-10-24）。程式版本 8ef96ff4100533907bd4c2549a0c018b0553f345 加既有未提交工作樹；993 個來源檔 hash 記錄於私有 initial-state.json。

**BLOCKED。標準 Supabase Local 未建立；原 72 案執行 0、PASS 0、FAIL 0、BLOCKED 72。**

E1：[本輪機器證據](p0c5-step1b-evidence.json)，包含診斷、回歸與來源基準的原始 artifact SHA-256。

## 本輪即時診斷

| 項目 | 實際觀察 | 狀態／下一步 |
| --- | --- | --- |
| Windows／CPU | Microsoft Windows 11 家用版 10.0.26200，build 26200，x64；AMD Ryzen 7 260 w/ Radeon 780M Graphics，8 cores／16 threads | OS 與架構已確認；不等於容器 backend 可用 |
| 虛擬化 | Firmware virtualization=true；hypervisor present=true；CIM SLAT／VMMonitor 回 false | hypervisor 下這些 false 不足以斷定硬體不支援；未動 BIOS／Windows 功能 |
| WSL --version | exit 1，明確回報未安裝 WSL | BLOCKED |
| WSL --status | exit 50，明確回報未安裝 WSL | BLOCKED |
| WSL --list --verbose | exit 1；沒有 distro | BLOCKED |
| WSL 預設版本 | Lxss 登錄沒有可讀設定 | 未建立；不能填 WSL2 |
| Docker Desktop／Engine | PATH、常見安裝／per-user 路徑、登錄、Appx、程序、服務及 named pipe 均未發現可用項目 | 不是單純判定 Desktop 尚未啟動；目前沒有可啟動對象 |
| docker --version／docker version／docker info | 三者均在 Process.Start 階段找不到執行檔；沒有程序 exit code | Client／Server／Engine 資訊皆不可取得，不能捏造 exit 1 或 Server 版本 |
| Docker context | 沒有 .docker/config.json 或 contexts/meta；DOCKER_HOST／DOCKER_CONTEXT 未設定 | 沒有已知 context 可切換；未連線任何遠端 Engine |
| 使用者權限 | WindowsPrincipal IsAdministrator=false | 沒有 UAC 提權；依使用者 4.3／B2 停止系統安裝 |
| Supabase CLI | 2.121.0，--version exit 0 | 既有官方 binary；未更新或重裝 |
| Node／npm／Git | v24.15.0／11.12.1／git version 2.54.0.windows.1 | 均 exit 0 |
| PostgreSQL Client | psql (PostgreSQL) 17.11 | 僅 client 版本；沒有本輪 server |
| RAM／C 槽 | 可見 RAM 15.26 GiB，空閒 2.4 GiB；磁碟剩餘 13.15 GiB | 單次讀值；未刪其他工作或先前證據來釋放空間 |


26 類診斷中，23 類取得觀察；三個 Docker 命令因 executable 不存在而 UNAVAILABLE。工具搜尋包含既有專案 .tmp 工具及 node_modules、Program Files、LocalAppData、Scoop／WinGet、HKLM／HKCU uninstall、Lxss／Appx、服務／程序／pipes。另以 rg 搜尋 .tmp，未找到 Docker／Podman／QEMU／VirtualBox／nerdctl 可執行檔。

當時占用 TCP 埠：135、139、445、1123、5040、5354、6850、7778、13030、13031、13032、22112、24830、27036、27339、42050、49664、49665、49666、49667、49668、49677、50100、50923、51100、51291、51292、51715、51727、58415、59348。原模板 API 55321／DB 55322／shadow 55320 均未占用；未停止任何服務。

## 停止位置與本機隔離

停在 B2／B3 的人工前置安裝。依本輪順序，必須先取得 Docker Server 正常回應才進 Step C；因此本輪沒有再次執行 supabase start／status。前一輪兩個 exit 1 是歷史證據，未抄成這次執行結果。

根 supabase/config.toml 仍不存在，既有 [本機模板](../scripts/p0/local-stack/supabase/config.toml) 未改；沒有建立新的 stack config、container、network、volume、DB、Auth 帳號、Storage 或憑證。apiUrl／DB identity／issuer／image digest 均為 null／未取得，寫入 gate 不開放。未 link、未 db push、不載入正式連線作為替代。

本輪 CLI 版本查詢工作目錄與 SUPABASE_HOME 指向 .tmp/p0c5-step1b，根 supabase/.temp/cli-latest 保持不存在；沒有重複前輪根快取副作用。Docker 診斷固定本機 named pipe，不繼承未知 Docker context。沒有接觸正式專案或建立雲端資源。

## 操作者必要步驟（本輪未執行）

1. 依 Microsoft 文件，以管理員 PowerShell 執行下列命令；它會安裝所需 Windows 功能與 Linux 發行版，並可能要求重新開機。這一步依使用者第 4.3 節／B2，必須由操作者執行。[Microsoft 官方 WSL 安裝](https://learn.microsoft.com/en-us/windows/wsl/install)

```powershell
# 僅供操作者在管理員 PowerShell 執行
wsl --install
```

2. 保存工作，依安裝程序完成重啟；重新檢查 wsl --version、wsl --status、wsl --list --verbose，確認有 WSL2 與可用發行版。若並非版本 2，先依 Microsoft 文件處理，不自動轉換未知既有 distro。
3. WSL2 正常後，從 Docker 官方 x86_64 安裝來源安裝 Docker Desktop，選 Linux containers。官方 per-user 模式可用 install --user，安裝模式本身不要求管理員，但不能略過 WSL 前置條件；首次啟動及適用條款由操作者完成。[Docker 官方 Windows 安裝](https://docs.docker.com/desktop/setup/install/windows-install/)
4. 重新執行下列唯讀查詢，須同時取得 Client 與 Server、確認 OSType=linux 及本機 endpoint。只有 --version 不足以解除阻擋。

```powershell
wsl --version
wsl --status
wsl --list --verbose
docker context show
docker version
docker info
```

5. 重新量測 RAM／磁碟與連接埠；完整 stack 可用資源仍須實際確認，不依本次空閒量推論已足夠。之後才啟動獨立官方 Supabase，將輸出留私有、核對 loopback 綁定／images digest／DB identity／獨立 Auth／Storage 與副作用，再開放合成資料寫入。

沒有為完成本輪而安裝新軟體、啟用系統功能、自行提權、重啟、關閉安全軟體或新增付費專案。
