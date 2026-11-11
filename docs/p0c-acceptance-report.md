# 蒐秘密 P0-C 驗收報告

日期：2026-10-23（Asia/Taipei）

**總判定：BLOCKED。P0-C 未通過，禁止進入正式 Migration 與歷史補齊。** 本輪完成本機安全防護、合成資料、證據與操作文件；真實 PostgreSQL／PostgREST／Auth／RLS 驗收尚未執行。品質分數維持 **56/100**。

## 環境與執行範圍

[環境證據](p0c-environment-2026-10-23.json) 記錄 Node v24.15.0，未找到 docker、supabase、psql、podman CLI；另檢查未找到標準 Docker/PostgreSQL 安裝與已設定的 WSL distribution。沒有可確認獨立用途的資料庫、Auth、Storage、webhook 及測試憑證。

本輪透過 Supabase connector 的 list_projects 在查詢前發生 OAuth token refresh failed／Failed to parse server response；最新正式唯讀 Schema／資料刷新為 **BLOCKED**。沒有改用正式環境變數繞過。最近成功快照仍是 P0-B 的 **2026-10-23 14:58:41.987531 +08:00**，舊分類不是最新正式狀態。

本輪未安裝工具、啟動服務、建立付費／雲端專案、寫入任何 DB、修改正式 Schema/RLS/Auth/Storage/env，亦未 push 或部署。[本機模板](../scripts/p0/local-stack/supabase/config.toml) 只是準備檔，預定 PostgreSQL major 17 不等於實際環境版本；PostgreSQL/PostgREST/Auth/CLI 實際版本仍無法確認。

## 驗收結果

| 項目 | 本輪結果 | 狀態／證據 |
|---|---|---|
| 獨立資源／憑證確認 | 無可確認隔離環境 | BLOCKED；環境 JSON |
| 原 P0-B 28 項 | PASS 0、FAIL 0、BLOCKED 28、NOT RUN 0 | [逐項原 ID／名稱／期望／實際矩陣](p0c-integration-test-matrix.md) |
| ARI Migration／rollback | 沒有執行 | BLOCKED；[Schema 審查](p0c-schema-migration-review.md) |
| 普通 JWT 與 RLS 真實正負向 | 沒有執行；四帳號腳本不足以證明獨立研究 persona／撤銷 | BLOCKED；矩陣 X01/X02 |
| 階層完整性／冪等／部分失敗 | 本機替身回歸通過；無真實 DB 證據 | BLOCKED；I01–I28，X04–X12 |
| 斷線／重啟 | 原腳本含 fetch 注入／新 client；本輪未跑，沒有實體故障證據 | BLOCKED；X09–X11 |
| 正式最新唯讀盤點 | OAuth 更新失敗、未刷新 | BLOCKED；不得把舊快照當現況 |
| 本機應用回歸 | 85 套件、656 測試、4 快照通過 | PASS；[本輪執行摘要](p0c-local-verification-2026-10-23.json) |
| 驗收工具單元測試 | 44/44，含 P0-B 24 與新增 20 | PASS；同上，均不連 DB |
| ESLint／JS 語法／差異空白 | 本輪修改的 CJS 與差異檢查 | 見執行摘要；不作 SQL 引擎驗收 |
| 評測／計分／素材等價 | 871 受保護檔案，未發現非允許變更 | PASS；[來源比對](p0c-equivalence-2026-10-23.json)，非裝置計時證明 |

原案例 ID／名稱／期望由 catalog test 對照 P0-B JSON 及原腳本註冊名稱；新增情境不編入原 28 項。X01–X12 是補充驗收規格，尚未全部實作自動測試，不冒稱有 40 項實測。JUnit/TAP 的真實 DB 執行證據不存在。

## 本輪局部修改與具體程式證據

| 檔案／函式 | 之前 → 現在 | 限制 |
|---|---|---|
| [p0c-guard.cjs](../scripts/p0/p0c-guard.cjs)：assertP0CIsolation、requireP0CIsolation | 原先 URL/ref/旗標防護 → 加入人工獨立資源證據、24h review、版本、檔案 realpath/SHA-256、API key 指紋、正式憑證比對及普通 JWT issuer/role/expiry/不同帳號檢查 | 離線解碼不驗 JWT 簽章；人工證據不能自動證實實體資源；仍需 server getUser／正向 RLS |
| [isolated-integration.test.cjs](../scripts/p0/isolated-integration.test.cjs) 初始化 | 基本目標 guard → 在任何 client/HTTP 前增加 P0-C gate；28 名稱與 callbacks 保留 | 不改期望、不減案例；未執行 DB tests |
| [repair-batch.cjs](../scripts/p0/repair-batch.cjs)：main；guard 的 assertRepairUsesReviewedIdentity | apply 既有逐筆合成／owner 防護 → 建 client 前再驗同一隔離證據，repair URL/key/token 必須等於已審閱 TEST 組 | 預設仍 dryRun；保留 fsync journal、原計畫／ID、歷史主狀態；無正式 apply 開關 |
| [01-task-codes.draft.sql](../scripts/p0/sql/01-task-codes.draft.sql) codes 預檢 | SQL NULL 可能跳過集合拒絕 → 明確以 codes is null 拒絕 | 只改草案；沒有 SQL engine／遷移通過宣稱 |
| [p0c-fixtures.cjs](../scripts/p0/p0c-fixtures.cjs)：syntheticResult | 新增完全程式生成 LB、PM、CBT、ARI 測試形狀與 UUID | 不複製正式 payload；不生成正式評測規則；尚未接入補充 DB 情境 |
| [p0c-preflight.cjs](../scripts/p0/p0c-preflight.cjs)：report；[build-p0c-matrix.cjs](../scripts/p0/build-p0c-matrix.cjs) | 可重跑的離線版本探測／BLOCKED 報告／原 ID 對照 | 不建立 client、不送 HTTP、不可能自行產生整體 PASS；新輸出檔保護既有證據 |
| p0c-guard.test／p0c-fixtures.test／p0c-catalog.test | 新增 20 項單元驗證 | 沒有 DB 呼叫，不替代整合測試 |
| local-stack config／attestation.example、P0C-README | 獨立 workdir、port、關閉副作用服務與故意無法通過的證據範本 | 未啟動、未經 CLI 驗證；不可直接改旗標冒充檢查 |

本輪沒有再修改 src 正式程式。前輪 P0 的 9 個分析／同步檔案仍在工作區；等價檢查以固定 Git baseline 排除明列的 P0 研究／同步檔案及測試，其餘 871 檔案未變。六項 TestPage、protocol、scoring、刺激素材／比例／時限／題數／順序／停止／試玩／副本抽取不因本輪改動。UI、RAG、UCB1、推薦、部署設定未修改。

## 十二項問題的回答

1. **P0-C 真正通過？否，BLOCKED。**
2. **28 項全部真實 DB 測試完成？否，0/28 執行，28 BLOCKED。**
3. **ARI Schema 真實 Migration 通過？否。** 僅草案檢閱及一處 NULL 拒絕修正。
4. **RLS 已擋跨患者讀寫？尚未證實。** 保留負向腳本／關聯草案，待真實普通 JWT 與正向對照。
5. **Trial 完整／斷線／重啟測試通過？僅本機程式層通過；真實 DB／實體網路／程序重啟未驗證。**
6. **21 筆錯誤 synced 有方案？有舊快照去識別核對清單、順序與逐筆凍結計畫規格；尚未獲正式執行核准。** 不重設正式狀態。
7. **A849＋B48 具備補齊條件？仍是條件式候選。** A 待隔離／最新來源／計畫驗收；B 另待兩張 ARI CHECK 與 ARI 修復驗收；未補齊。
8. **C317 人工分類明確？維持 LB6/45、SSG19/260、DPT1/12；全部凍結，尚未解決語意。**
9. **新增風險？有未驗證工具相容性／權限契約／補充覆蓋缺口；沒有新發現且已由正式 DB 證實的漏洞。** 離線 attestation 不能替代真實隔離；SQL／RLS 仍需引擎驗收。舊快照有時效限制。
10. **修改正式評測規則？沒有。** 871 檔等價檢查及既有回歸通過；裝置計時未實測。
11. **正式資料庫完全未更動？本輪沒有任何正式 DB/Schema/Auth/Storage 寫入或部署。** 唯讀 connector 在查詢前失敗。
12. **可進入 P0-D 正式前審查？目前不能核准。** 可以保留規格準備；隔離實測、最新盤點、備份／回復與資料契約缺口解決後再審查。

## 尚未通過與停止條件

沒有獨立資源／有效普通身分時不得嘗試 DB 寫入；OAuth 失敗後不使用舊快照填入最新結果；遷移前後完整 catalog、原 28 案、補充 X01–X12 與清理／回復演練缺任一項均維持 P0-C 未通過。21 筆歷史同步、897 筆條件式候選、317 筆人工項目均保持原始資料與狀態。
後續環境與執行規格見 [P0C-README](../scripts/p0/P0C-README.md)，歷史核對順序見 [準備度文件](p0c-history-readiness.md)。
