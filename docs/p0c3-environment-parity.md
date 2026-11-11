# P0-C3 環境一致性審查

結論：**BLOCKED，尚不足以將原生 PASS 視為標準 Supabase PASS**。已完成實際差異盤點，但標準Supabase隔離實例未建立、最新正式catalog未取得。Critical／High「未知」代表必要證據不足，不是聲稱已證明漏洞。

## 三環境比較

| 層級 | P0-C2／C3原生觀察 | 標準Supabase隔離環境 | 最新正式（唯讀） | 差異級別 | 受影響案例 | 判定／依據 |
| --- | --- | --- | --- | --- | --- | --- |
| PG build／版本 | 17.11 EDB Windows；獨立實體叢集 | 實例未建立；不填模板為實測版本 | 最新版本未知 | High | 原28＋補34 | 原生真實 SQL 通過；平台版本相同尚無證據 |
| Extension | plpgsql／pgcrypto，精確版本見本機 catalog | 未取得實際安裝清單 | 未知 | High | M01–M10、I01–I28 | 未開外部HTTP或RAG extension；不能推定正式相同 |
| API gateway／CORS／TLS | Node路由；同來源HTTP；沒有標準gateway的apikey檢查 | 未建立；須核對gateway／apikey／跨來源／TLS設定 | 未知 | High | I01–I28、Browser-01–10 | JWT/RLS由真實上游檢查；不是標準gateway等價證據 |
| PostgREST | 16.5；真實select/insert/update/upsert/returning | 實際版本／設定未取得 | 未知 | High | I01–I28、Participant-01–10 | 原生回傳與錯誤已實測；平台仍BLOCKED |
| Auth binary | v2.197.0＋私有Windows listener適配 | 官方標準服務未啟動 | 未知 | Low | Auth相關全部案例 | 適配僅移除Unix SO_REUSEPORT；此分級不涵蓋下一列JWT設定 |
| JWT／角色／claims | 本輪新HS256 issuer／secret；5普通合成帳號＋anon | 尚無實際issuer／演算法／claim契約 | 未知 | Critical | I15/I25/I26/I28、H12/X02/R01/R02、Participant、Browser-08 | 有效與偽造JWT均實測；不證明正式設定相同 |
| RLS／grants | 沿原DDL；02/03/04僅隔離施加，沒有停用RLS | 無獨立標準catalog | 未知 | Critical | 全部階層案例及Participant-01–10 | 合法及非法案例原生PASS；標準重測BLOCKED |
| Table／column／default／FK／Unique／CHECK | 原rebuild順序；18表、117 constraints；真實23505/23514/23502 | 沒有實例；不杜撰相同DDL | 未知 | High | I01–I28、M01–M10、H/X | repository相依已驗證；尚無最新正式schema比對 |
| Function／RPC／definer／search_path | catalog含58函式定義、owner／ACL／設定 | owner與grants未取得 | 未知 | Critical | 所有授權、consent、participant、source-binding案例 | 本機完整catalog留私有；不能沿用definer權限結論 |
| Migration／transaction | 同一SQL交易可回復；跨HTTP分段保存＋讀回重試 | 未建立，版本／設定未知 | 未知 | High | M01–M10、I07–I20、G01–G03 | 未宣稱跨HTTP全域原子性；ARI有資料拒絕rollback |
| UUID／JSONB／NULL／timestamp | 嚴格Raw/Derived比對、NULL保留、timestamp依同一instant比對 | 尚無平台往返 | 未知 | Medium | I01–I06、H09/H10、X03–X07、Browser-10 | 原生逐欄往返PASS，非標準平台PASS |
| TimeZone | Asia/Taipei；ISO, MDY；UTF8 | 官方文件預設UTC，實際測試實例未建立 | 當下正式設定未知 | Medium | timestamp、日期與依時間計算的欄位 | 已揭露具體差異；epoch比對通過；未做RT儀器校準 |
| Storage／外部服務 | 僅必要官方Storage schema；Storage API停用，無外部請求 | 完整服務未建立 | 未知 | Medium | Browser-01–10；完整前端尚未測 | 瀏覽器231請求均為loopback；未聲稱Storage服務通過 |
| 前端／origin／瀏覽器 | Chrome155真程序；合成完成頁載入實際模組 | 尚未以完整正式前端連獨立標準stack | 正式站點未操作 | High | Browser-01–10 | 同步子流程PASS；完整遊戲UI與正式跨來源仍BLOCKED |

P0-C2使用PG17.11／PostgREST16.5／Auth v2.197.0 listener適配；C3沿用已校驗工具，建立全新DB p0c3_isolated_1acdf11c3f9a、system ID 7699860718473927056，不是重用已清除的C2叢集。C3埠為DB55433／gateway55331／PostgREST55388／Auth55389，均loopback；寫入前重新通過resource／key／issuer／synthetic／side-effect guard。原28與補34本輪原生皆重跑，但標準環境狀態逐案仍是BLOCKED。

## 尚未建立標準環境的具體原因

重新檢查docker／podman命令與服務未找到；WSL只有系統執行檔，無已安裝distro。C2已實際以CLI2.121.0 start取得DockerLifecycleInspectError，並檢查常見安裝路徑／registry／named pipe。使用者先前未提供獨立專案或branch；沒有新建付費資源、啟用WSL、要求管理員或重開機。官方native runtime目前不支援Windows，不能把自行移植的Windows服務標為官方native。

來源：[Supabase Docker/native支援](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes)、[本機開發](https://supabase.com/docs/guides/local-development)。後續需提供可安全使用的Docker Linux runtime或獨立標準Supabase測試專案；先核對各服務/image digest、資料庫身分、獨立Auth／Storage／keys與副作用，再寫入合成資料。不得改用正式DB另一個schema。

## 時區、權限與推論限制

本輪catalog實測TimeZone=Asia/Taipei、DateStyle=ISO, MDY、client/server encoding=UTF8、row_security=on；[官方資料庫設定](https://supabase.com/docs/guides/database/postgres/configuration)說明預設UTC，但這不是當下正式設定證據。Browser-10以Date.parse比較相同instant，UUID／Raw／Derived／NULL逐欄一致；日期邊界、完整UI顯示及標準平台行為仍需重測。

04 policy直接檢查相同patient FK，與原helper對既存列的邏輯等價可由程式碼推論；原生JWT實測支持此推論，不能證明標準環境的owner、grant、function、claim、pre-request設定均相同。Windows listener差異本身屬Low，其他未確認權限設定仍屬Critical。

完整本機catalog是唯讀SQL實際執行結果：18表、58函式、48 policies、117 constraints；私有原檔hash可追溯。最新正式catalog、Migration歷程及平台版本仍未知，不沿用舊快照填寫。


逐案結果、環境、時間及原始證據 SHA-256：[機器證據](p0c3-test-evidence-2026-10-23.json)。UTC時間以Z標示；台灣時間為UTC+8。本輪未操作正式資料庫、正式Auth／Storage／環境變數，沒有push或部署。私有 .tmp/p0c3 內的憑證、profile與payload不納入Git／公開報告。
