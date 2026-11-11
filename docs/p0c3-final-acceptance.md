# P0-C3 最終工程驗收

**最終BLOCKED，品質分數維持56／100。** 本輪解決了真瀏覽器執行阻擋，取得原生DB與Chrome的新證據，並修正一項實測共享快取問題；仍沒有標準Supabase等價驗證或最新正式Schema，完整遊戲UI／實體網路／行動裝置也未驗收。因此尚不能提出完整P0-D執行核准，更未執行正式Migration／repair／部署。

## 十八項回答

| # | 問題 | 判定／證據 |
| --- | --- | --- |
| 1 | P0-C3 PASS？ | 否，BLOCKED；已測最終範圍沒有未修正FAIL，但必要環境／權限／完整流程證據缺失 |
| 2 | 原生與標準Supabase足夠等價？ | 否；[差異矩陣](p0c3-environment-parity.md)列版本、JWT、gateway、roles／grants／RLS、timezone與服務差異，Critical／High未解 |
| 3 | Participant returning修正驗證？ | 原生10/10及原R01 PASS，合法／非法／minimal PATCH／returning／rollback／逐欄讀回均實測；標準平台仍BLOCKED，見[RLS](p0c3-rls-validation.md) |
| 4 | 真瀏覽器斷線／重啟／同步？ | Chrome155真程序的合成完成與實際同步模組10/10 PASS；完整正式遊戲UI與標準API／實體網路未測，見[瀏覽器](p0c3-browser-recovery-tests.md) |
| 5 | 實體裝置完成哪些？ | Windows主機headless Chrome自動化完成；Windows人工實體切網、Android、iPadOS／iOS未驗證，有人工步驟；沒有RT儀器校準 |
| 6 | 最新正式Schema取得？ | 否；OAuth refresh parse失敗，使用者暫不重新授權；[唯讀報告](p0c3-production-schema-readonly.md)不冒充新snapshot |
| 7 | ARI migration仍適用？ | repository／原生演練適用；當下正式未知。01 forward／repeat／安全rollback與有ARI拒絕rollback都重跑PASS，需最新catalog確認 |
| 8 | 28＋34哪些重跑？ | 本輪新原生DB全部62重跑PASS、原ID／預期保留；標準環境仍需按[影響表](p0c3-regression-impact.md)重跑，不沿用這62為平台PASS |
| 9 | 避免缺題／重複／錯置？ | 已測原生及browser子流程中數量、IDs／key／順序／Raw／Derived逐欄一致，部分失敗與ACK遺失／並行能重試；標準平台／完整UI仍待驗證 |
| 10 | 舊100筆主結果最新狀態？ | 未知，100是舊快照；沒有最新唯讀資料，不推定仍100或已修復 |
| 11 | 舊1214 Trial分類改變？ | 未知；仍僅引用舊A849/B48/C317/D0/E0待重查，未用真實資料寫入測試 |
| 12 | 舊21筆synced不一致仍在？ | 未知；保留原清單，不重設正式狀態；合成false synced修復／ACK通過不代表正式已修 |
| 13 | 317人工核對保留？ | 是，舊清單LB45/SSG260/DPT12不改、不自動轉碼或編造題目；最新數量待查 |
| 14 | 新P0風險？ | 有：有效Browser-08發現B讀到A本機結果鏡像；已在resultSync做最小帳號封存修正，重跑PASS＋4回歸。完整舊路由／裝置與權限契約仍有驗證限制，不宣稱整個隱私面已結案 |
| 15 | 六項正式規則不變？ | 是，[871檔等價性](p0c3-equivalence-2026-10-23.json)unexpected=[]；正式頁面／protocol／scoring／素材／副本／RAG／UCB1未改 |
| 16 | 正式環境完全未改？ | 本輪writes、migration、repair、狀態、Auth／Storage、.env、deployment、push均0；正式工具在OAuth前置失敗，未取得獨立當下server-state證明 |
| 17 | 可提出P0-D人工核准？ | 尚不具完整執行核准條件；可審閱草案與新證據，正式備份／最新snapshot／相容平台與合法修復路徑仍缺；見[審查包](p0c3-production-readiness.md) |
| 18 | 必要前置作業？ | 最新唯讀連線與分類、標準隔離stack／62＋Participant及browser重測、完整UI／必要裝置、scope契約、備份／可恢復性與migration／repair正式權限審查；逐項補齊後另行授權P0-D |

## 本輪結果與修改

原28/28、原補34/34、Participant10/10及Chrome同步子流程10/10 PASS；完整回歸85套件／660測試／4快照，工具44 PASS，ESLint／diff檢查PASS。新四項回歸有Browser-08實測依據，未新增評測規則。原28[JUnit](p0c3-original-28-2026-10-23.junit.xml)與[機器結果](p0c3-test-evidence-2026-10-23.json)保留實際時間／目標及hash。

實際產品修改只有[src/utils/resultSync.js](../src/utils/resultSync.js)的switchResultMirrors與auth callback；[測試](../src/utils/resultSync.test.js)四項新增；[05 readonly SQL](../scripts/p0/sql/05-production-catalog.readonly.sql)只在local驗證。沒有改六項遊戲UI或正式SQL；04草案仍原檔未變。初次無效fixture／JSX／舊session的測試錯誤、有效快取FAIL及修正後重測均保留，沒有只挑成功結果。

## 清理與保留

清理2026-10-23T14:26:18.657Z PASS；核對cluster ID 7699860718473927056、實際資料路徑及服務PID後，只停止本輪Auth／PostgREST／gateway與PG，刪本輪新合成叢集及私有junction。foreign main／Auth／patients=0。清理前合成main80／Raw1177／current Derived1170／all Derived1172／Auth5；這些包含負向與部分fixture，不是正式100／1214，也不表示整個測試叢集均synced。

工具、私人合成profile／失敗pending與日誌留供稽核，沒有清空使用者瀏覽器／既有開發資料、Docker volume或C2證據；舊local服務已不存在。C2輸入artifact hashes全部不變。私人profile含本輪local登入資料，不納入Git或部署；不能把這些合成profile當正式使用者工作階段。

## 七份交付

- [環境一致性](p0c3-environment-parity.md)
- [Participant RLS](p0c3-rls-validation.md)
- [瀏覽器與裝置](p0c3-browser-recovery-tests.md)
- [正式Schema唯讀](p0c3-production-schema-readonly.md)
- [回歸與62項影響表](p0c3-regression-impact.md)
- [正式遷移審查包](p0c3-production-readiness.md)
- 本最終驗收報告


逐案結果、環境、時間及原始證據 SHA-256：[機器證據](p0c3-test-evidence-2026-10-23.json)。UTC時間以Z標示；台灣時間為UTC+8。本輪未操作正式資料庫、正式Auth／Storage／環境變數，沒有push或部署。私有 .tmp/p0c3 內的憑證、profile與payload不納入Git／公開報告。
