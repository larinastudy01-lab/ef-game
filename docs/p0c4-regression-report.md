# 蒐秘密｜P0-C4 最小修正與回歸

產出：2026-10-24T05:29:20.388Z（UTC；臺灣日期 2026-10-24）。版本：8ef96ff4100533907bd4c2549a0c018b0553f345 加本輪未提交工作樹；逐檔 SHA-256 見[機器證據](p0c4-test-evidence-2026-10-24.json)。

環境：Windows、Node 24.15.0、Chrome 155.0.8059.85；全新原生 PostgreSQL 17.11／PostgREST 16.5／Auth v2.197.0 Windows 適配版。資料庫 p0c4_isolated_c0fc0a60735b，cluster ID 7699882706748678332；API 僅 127.0.0.1:55341。全部使用合成個案及獨立測試帳號，並非標準 Supabase 或正式環境。

**功能回歸 PASS；平台與實體條件仍 BLOCKED。**

| 成因／修改前 | 最小修正／修改後 | 實證 |
|---|---|---|
| LB finalScore、averageReactionTime 未被摘要讀取；98→0 | resultManager.normalizeGameResult 增加明確欄位 fallback；原 raw／計分函式不變 | 重測 LB 98、RT269，main／研究讀回一致 |
| CBT ratio 0.75 被家長當 0.75% | 明確 accuracyPercent 優先；缺該欄位的舊資料不推斷 | 實際重測 75%；raw ratio 0.75 留存 |
| 多個舊結果／個案別名未隔離 | resultSync.switchResultMirrors 覆蓋實際讀者別名，version2 相容處理 | 修正前 B 顯示 A；修正後拒絕 |
| quota 下封存失敗仍可能顯示原快取 | areResultMirrorsReady 與 ResultAccessRoute 在渲染前核對帳號、角色、patient RLS | 舊 profile、乾淨角色、兩分頁實測 |
| 已有不同封存可被新歷史覆蓋 | 先驗證保存舊字串至 conflict 區，再封存新資料；不自動合併／改寫 | 真瀏覽器 oldExactRetained false→true；最新也保留 |
| 鏡像失敗／空 outbox 的讀取拒絕只進 console 或一般錯誤 | reportResultStorageFailure；getResultSyncState 探測拒讀；pending 提醒勿清瀏覽器資料 | 真 quota、SecurityError 故障移除前後 |
| 授權重新整理可重設家長篩選 | routine sync 不卸載已授權頁面；App 的 FAMILY_ROLES 使用穩定常數 | 來源 UI 重現與篩選回歸、家長六項讀回 |

實際修改檔案：[src/App.js](../src/App.js)、[src/utils/resultManager.js](../src/utils/resultManager.js)、[src/utils/resultSync.js](../src/utils/resultSync.js)、[src/components/ResultAccessRoute.jsx](../src/components/ResultAccessRoute.jsx)、[src/components/ResultSyncStatus.jsx](../src/components/ResultSyncStatus.jsx)、[src/utils/resultManager.test.js](../src/utils/resultManager.test.js)、[src/utils/resultSync.test.js](../src/utils/resultSync.test.js)、[src/components/ResultAccessRoute.test.jsx](../src/components/ResultAccessRoute.test.jsx)。沒有變更六個 TestPage、任何 Protocol／Scoring、圖片／音效、RAG 或 UCB1 演算法；新授權閘門位於入口／結果渲染，未包住進行中的正式評測。正確摘要會成為後續資料輸入，不宣稱推薦輸出在所有輸入下完全相同。

新增 14 個有缺陷依據的單元案例：3 摘要／鏡像警示、5 封存／儲存案例、6 結果授權／頁面狀態案例。完整 CRA：86 suites、674 tests、4 snapshots，0 failures；驗收工具 44/44；ESLint 0 errors／0 warnings，git diff --check exit0。完整回歸牆鐘 23,942.285 秒異常偏長，未查明宿主長時間停頓原因，不作效能結論；SRT 的 480,115ms 是停頓前的獨立實測。

原 28：最終批次 28/28；補充 34：34/34；Participant：10/10。保留原案例 ID／名稱／assertions。較早 attempt2 在 Auth fixture 已被實際登出撤銷時 before-hook 失敗；attempt4 在刻意撤銷後仍套用「已授權」fixture 而失敗；attempt6 的 I18 在測試 gateway 重啟時 ECONNRESET、來源保持 pending。這些不是通過紀錄；恢復合法 fixture 與服務穩定後重跑，未刪測試或降低 assertions。

另保留 PM／SRT driver 的轉場／初次圖片就緒觀測中斷、一次角色 locator 編碼錯誤、服務未就緒及一次並行 build timeout；最後建置採獨立子程序記錄實際 exit0。長時間停頓後測試 token／anon key 過期，只續期本機合成憑證並重新產生資源審查證據，未放寬公開隔離 guard。

原 equivalence 工具的舊 allowlist 回報四個明列例外：App、ResultSyncStatus、resultManager 與新增 ResultAccessRoute；沒有把它偷偷改成零差異。原 871 保護檔中三個既有存取／顯示檔為本輪例外，其餘 868 維持基準；六評測與素材／規則原檔相同。C3 manifest 中 43 個非程式證據 hash 不變；兩個 resultSync 程式／測試 hash 是本輪已申報的修改，無未解釋證據變更。

歷史方案／回復：先 dryRun 列出 raw.finalScore／明確 accuracyPercent 與摘要欄位差異；封存完整原主結果與 checksum。若未來另獲正式核准，只對衍生摘要以 expected revision／raw hash 作 CAS，前後核對原 result／Session／Trial UUID 與 raw JSON 相同；回復以封存及 CAS 還原摘要。不得改 raw／trials、猜舊單位、刪 Trial 或先重設 synced。若要新增長期版本表，須另提 SQL／rollback 草案。本輪沒有新增 schema／RPC，也沒有執行歷史修復。

證據：[final-regression.json](../.tmp/p0c4/final-regression.json)、[static-checks-final.json](../.tmp/p0c4/static-checks-final.json)、[equivalence 原始輸出](p0c4-equivalence-2026-10-24.json)、[機器證據](p0c4-test-evidence-2026-10-24.json)。

本機格式回復注意：保留 version2 archive／conflict 與所有 outbox，不得以刪除舊鍵作回復。舊版仍有快取外洩問題，不能取消結果授權閘門作安全回復。
