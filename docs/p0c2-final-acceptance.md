# P0-C2 最終驗收

判定：**BLOCKED；真實資料庫驗證 PASS**。原本被環境擋住的28項已全數真實執行通過，另34項補充通過；目前沒有本輪已實測而未修正的必要資料庫案例 FAIL。最新正式結構唯讀比對、完整平台等價性與真實瀏覽器／實體網路驗證尚未完成，因此不將本輪視為正式環境驗收完成。評分維持 **56／100**，未重跑同一套全面品質評分。

## 十三項交付回答

| # | 問題 | 結論與具體證據 |
| --- | --- | --- |
| 1 | 隔離環境建立？ | 是。獨立 PG 叢集 7699777475111413860／DB p0c2_isolated_cabffaaa4591，真實 Auth／PostgREST／RLS；已安全清理 |
| 2 | 本機或雲端？ | 本機原生 Windows 服務；非 Docker Supabase、非雲端、非正式 DB 的額外 schema；沒有建立付費資源 |
| 3 | 原28項通過幾項？ | 28／28，最終0 FAIL／BLOCKED；保留原 ID／purpose／expected 及 JUnit。第一次27／28的 fixture 缺欄已修正並完整重跑 |
| 4 | ARI Migration？ | 隔離 forward／repeat／安全 rollback／有資料拒絕 rollback 均通過 M01–M09；六項現行碼與舊 SSG 接受，ART／非法碼拒絕，NULL仍23502 |
| 5 | RLS 個案隔離？ | 現有普通帳號契約下通過 I15／I25／I26／I28、H12／X02／R01／R02；同 JWT 撤銷有效。獨立 researcher role／最小 scope 全矩陣仍未定義或未遍測 |
| 6 | Trial 完整正確可追溯？ | 合成成功案例逐欄讀回、IDs／來源／順序／版本一致；LB20重疊 stepIndex、舊 LB鍵、PM／CBT 狀態已測。來源歧義拒絕，不能推論正式1214筆已完整 |
| 7 | 同步失敗可恢復？ | I07–I20 request／ACK／部分提交、G01–G03 真程序中止／新程序恢復／並行重試通過；browser／實體斷線仍未測 |
| 8 | 補齊工具驗收？ | 合成 A–E、dryRun 0寫入、重跑冪等、舊版本保留、衝突拒絕、false synced重新驗證通過；正式 repair0 |
| 9 | 六項規則未改？ | 871受保護檔案與 baseline 8ef96ff4100533907bd4c2549a0c018b0553f345 無意外差異；六 TestPage、protocol、scoring、素材／RAG／推薦未改。物理 timing 仍需裝置驗證 |
| 10 | 新安全風險？ | 本輪無未修正的實測資料庫安全失敗；發現 participant RETURNING policy 缺陷，以最小04草案隔離修復並重測。移植 Auth／路由差異、角色 scope 未遍測、未對當下正式 catalog 比對仍是限制；私有測試工具／設定不納入 Git，服務與DB已移除 |
| 11 | 正式環境未變更？ | 本輪正式 writes／Migration／repair／status／Auth／Storage／.env／deployment／push 均0。連線子程序排除正式設定；最新遠端唯讀查詢在OAuth階段失敗，沒有獨立當下 server-state 證明 |
| 12 | P0-C2 最終？ | BLOCKED（資料庫子項 PASS）。缺少真實browser／實體網路與最新正式 catalog／標準平台等價性證據；不冒稱正式驗收完成 |
| 13 | 可提出P0-D人工核准？ | 真實 DB 測試與SQL dossier 已足供技術審查；尚不具完整正式執行核准條件。需補最新正式Schema差異、04草案審查、備份／回復與平台／權限契約限制，以及瀏覽器待驗證項目。本輪未提出執行核准、未自行P0-D |

## 本輪最小修改與真實缺陷

1. [isolated-integration.test.cjs](../scripts/p0/isolated-integration.test.cjs) 的唯一約束案例 I14：以完整合法 Raw 的新 UUID 複製列測相同來源鍵，補足必填 raw_schema_version；預期仍23505。
2. [04-participant-returning.draft.sql](../scripts/p0/sql/04-participant-returning.draft.sql)：新 Participant INSERT RETURNING 原會因 STABLE self-lookup snapshot 回42501；SELECT policy 改以同一 patient FK 授權直接判斷，其他 policy／資料／FK不動。僅隔離施加。
3. [04 rollback](../scripts/p0/sql/04-participant-returning.rollback.draft.sql)：可驗證恢復原 policy，保留已知 returning 限制；無資料刪改。
4. 本輪五份報告、公開 JUnit／結果 JSON／等價性證據。私有建置／執行工具留 .tmp/p0c2，不納入部署。

既有 P0-A／B／C runtime 修正與測試仍保留於工作區；本輪沒有重改 src、UI、評測頁、規則、計分、RAG 或推薦。完整工作區仍含先前未提交內容，未 reset／覆寫。04 是本輪新 SQL 草案，沒有加到自動正式 Migration。

## 測試與安全收尾

- 原28 real DB：28 PASS；額外 real DB：34 PASS，共62。
- 完整 CRA：85 suites／656 tests／4 snapshots PASS；Node工具44 PASS，分別保留原始log與hash。
- 871個受保護檔案 unexpected changes=[]；[等價性證據](p0c2-equivalence-2026-10-23.json) 含各正式測驗頁／protocol／scoring blob。
- 清理 2026-10-23T09:16:20.951Z PASS；僅刪新建合成叢集、停止本輪服務及移除私有 junction。清理前 foreign main／auth／patients=0；未清理既有開發資料或任何 Docker Volume。
- 最新正式唯讀盤點 BLOCKED：connector OAuth refresh 失敗；既有 P0-B 數量明確標歷史快照。正式未修復數量不能用本輪合成案例推定。
- 真 browser8項與實體網路 BLOCKED；現有 outbox 是 localStorage，沒有虛構 IndexedDB 通過。

## 文件與追溯

- [環境報告](p0c2-environment-report.md)
- [逐項整合結果與人工步驟](p0c2-integration-results.md)
- [Schema／ARI／RLS草案驗證](p0c2-schema-validation.md)
- [歷史補齊與正式待辦](p0c2-history-repair-validation.md)
- [公開62項結果／原檔SHA-256](p0c2-test-evidence-2026-10-23.json)
- [原28項實際JUnit](p0c2-original-28-2026-10-23.junit.xml)

下一步是補齊上列證據與審查，並非現在執行正式資料庫操作；正式 C類317 Trial、來源不足D類與21筆 falsely synced仍需依最新盤點處理。


所有時間為 UTC；2026-10-23 台灣時間為 UTC+8。逐案機器結果與 SHA-256 見 [驗證證據](p0c2-test-evidence-2026-10-23.json)。私人執行資料位於 .tmp/p0c2，不納入版本控制；公開文件沒有金鑰、JWT 或真實個案 payload。
