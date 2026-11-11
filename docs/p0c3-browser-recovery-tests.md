# P0-C3 真實瀏覽器與裝置恢復驗證

**同步子流程10／10 PASS；完整正式遊戲UI／標準Supabase／實體網路與行動裝置仍BLOCKED**。使用已安裝Google Chrome 155.0.8059.85，Playwright Core 1.64.1，Windows 10.0.26200 x64。這是Chrome真實headless程序及persistent profile，不是Node模擬localStorage或用新Node client冒充瀏覽器重啟。

## 環境與測試邊界

時間 2026-10-23T14:21:20.061Z 至 2026-10-23T14:21:44.262Z；API／Auth只連http://127.0.0.1:55331，DB p0c3_isolated_1acdf11c3f9a。測試頁由webpack載入當下儲存庫真正resultManager／resultSync／database／ResultSyncStatus，包含本輪最小快取修正。按鈕完成程式生成合成作答，走實際normalize、durable outbox、主結果與研究階層；沒有操作六項正式遊戲的刺激／試玩／答案按鈕，沒有修改UI或規則。

SDK環境由測試build明確注入新local URL／anon key，未載入正式.env。真實password sign-in取得ordinary JWT；bootstrap管理JWT未傳瀏覽器。CSP限self，Playwright攔截僅允許同origin；最終231請求、外部請求0。Storage API未啟動／未呼叫，沒有正式通知或其他外部整合。未記錄含JWT的HAR／trace。

## 十項結果

| 案例 | 目的 | 網路／故障條件 | 實際結果 | 狀態 |
| --- | --- | --- | --- | --- |
| Browser-01 | 正常合成完成、持久化與完整同步 | online loopback | {"resultId":"p0-acceptance-1108e1fc-71a5-4924-ae57-390ee501baf8","raw":20,"currentDerivations":20,"sessionId":"dd0313db-18ec-4ca3-b4a8-94c6c5efa68f","taskId":"ceafe2a0-e4e7-4e4f-9c04-45102050fdd9","allContractFieldsCompared":true} | PASS |
| Browser-02 | 上傳前離線保留與恢復 | Chrome context offline then online (not physical adapter) | {"resultId":"p0-acceptance-de5fd67b-e491-406c-9fb8-43a8d406973b","raw":20,"currentDerivations":20,"sessionId":"dd7d4874-31d6-4667-ba54-1da152e1165c","taskId":"4801bdf8-8999-409d-b512-fb364962b418","allContractFieldsCompared":true,"offlinePendingRetained":true} | PASS |
| Browser-03 | main成功／研究失敗後補齊 | browser request abort on hierarchy mutations | {"resultId":"p0-acceptance-1411a5bd-b414-4414-868c-9f2825369f7b","raw":20,"currentDerivations":20,"sessionId":"94b66e8c-b3ba-4efc-a01f-8c5061098ecd","taskId":"117392ea-164d-43f5-b83c-364f0aea16db","allContractFieldsCompared":true,"mainSavedWhileResearchPending":true} | PASS |
| Browser-04 | 重新整理保留pending與原ID | browser hierarchy abort across reload | {"resultId":"p0-acceptance-96cdc5d9-d211-4a3a-9c78-d3bce35cc400","raw":20,"currentDerivations":20,"sessionId":"3a0c17da-c2f1-41cd-9887-615372613bba","taskId":"7557b3a4-58d5-4d63-a67b-22ebf9bd7092","allContractFieldsCompared":true,"actualPageReload":true} | PASS |
| Browser-05 | 關閉真實Chrome程序、重開同profile恢復 | persistent Chrome profile; hierarchy abort before close | {"resultId":"p0-acceptance-03b759f0-5b02-4f37-a699-ee92b31c3f35","raw":20,"currentDerivations":20,"sessionId":"cc84d319-6d05-4eb0-a4ba-27789ac241e7","taskId":"40a33746-86a9-470d-b7f3-735abaf2dc19","allContractFieldsCompared":true,"actualBrowserProcessClosedAndRelaunched":true,"persistentAuthSameOwner":true} | PASS |
| Browser-06 | 兩分頁共享Web Locks、同步重送 | two real pages, shared persistent origin | {"resultId":"p0-acceptance-4c6c812d-671f-4194-a92b-108e6ce5973a","raw":20,"currentDerivations":20,"sessionId":"380a85f1-b56a-4288-b171-8aa6853054f8","taskId":"2e2499cf-0cfd-4f22-acd0-23b39da09ca3","allContractFieldsCompared":true,"webLocksSupported":true,"bothTabsDrained":true} | PASS |
| Browser-07 | 伺服器commit但瀏覽器ACK遺失 | route.fetch real raw commit then abort response | {"resultId":"p0-acceptance-bc05c674-f555-4b50-a8b0-8d0108266327","raw":20,"currentDerivations":20,"sessionId":"f61e3c94-ff2b-4dea-a5a5-f17a053fd93b","taskId":"eb185f48-4f54-4c50-9cde-75587f5f98ab","allContractFieldsCompared":true,"realCommitAcknowledgementLost":true} | PASS |
| Browser-08 | 帳號A待傳→B不能讀寫→A恢復 | real Auth signOut/setSession with pending source | {"resultId":"p0-acceptance-bb290bda-b637-47b1-92f1-8fff0643cf13","raw":20,"currentDerivations":20,"sessionId":"0cb56f82-f1cc-4c2b-87cc-ce732180763a","taskId":"a420e339-3539-4ce7-bd65-4a037bbb4b25","allContractFieldsCompared":true,"otherAccountCannotReadOrUpload":true,"pendingPreservedForOwner":true} | PASS |
| Browser-09 | 儲存quota異常須明示未保存 | actual Storage API throws QuotaExceededError for outbox | {"resultId":"p0-acceptance-e8d4f3c8-a132-4cec-8eca-c2dc9c3ee452","raw":20,"currentDerivations":20,"sessionId":"a7ce22ec-4dc5-48ea-92c4-7a7ebf596622","taskId":"0cecce2b-4e90-4b2b-a97f-8c343ba0f268","allContractFieldsCompared":true,"explicitStorageError":true,"noFalseDurableAcknowledgement":true,"storageInterface":"localStorage; not IndexedDB"} | PASS |
| Browser-10 | Session／main／Raw／Derived完整欄位讀回 | online after PM timeout/planned synthetic source | {"resultId":"p0-acceptance-30fc056a-60b0-482a-b796-58d322e72ab9","raw":14,"currentDerivations":14,"sessionId":"cade6b0e-fb8d-42e6-91c4-05184d7bdb5c","taskId":"e8105483-34a8-4f30-855b-ba1dcbae53d2","allContractFieldsCompared":true,"rtCorrectnessTimeoutOrderVersionsCompared":true,"administered":12,"timeouts":3,"planned":2} | PASS |

每個LB案例為獨立20 Raw，兩階段stepIndex重疊；Browser-10為14來源槽位＝12已施測、3逾時、2 planned。全程比Session／main／task／trial IDs、來源鍵／序號、原Raw／summary與所有當前Derived欄位，包括RT、correctness、timeout、metadata及處理版本；timestamp比相同instant。每場保留獨立完成時間與IDs，沒有以去重誤合併其他場次。

Browser-02為真Chrome context offline，非OS網卡或飛航模式。Browser-03於瀏覽器攔截研究mutation，main已saved、研究pending且原Trial保留，再補齊。Browser-05用persistent context.close關閉其Chrome程序，再launch新程序讀回同profile；Browser-06是兩個真分頁共享Web Locks。Browser-07先route.fetch完成真正Raw commit，再abort瀏覽器回應，實際遺失ACK1次，重試無重複。

Browser-09是在真Chrome的Storage.prototype.setItem對outbox拋QuotaExceededError，驗證實際ResultSyncStatus出alert、未假稱保存，恢復後補傳。實作是localStorage，沒有IndexedDB可宣稱通過；未壓滿實體裝置容量，也未驗證所有站台儲存權限被拒的完整流程。

## 實測發現、修正與早期測試問題

有效attempt3為9 PASS／Browser-08 FAIL：B的雲端讀取被RLS擋住、也不上傳A outbox，但getAllUnifiedResults仍讀到A的共享快取。最小修改[src/utils/resultSync.js](../src/utils/resultSync.js)的switchResultMirrors：依各storage自己的owner marker封存顯示鏡像與current／selected child，精確字串確認後才移出原key，原帳號回來可還原；outbox永不移除。未知舊owner資料進unassigned封存，不猜配給新帳號。新[src/utils/resultSync.test.js](../src/utils/resultSync.test.js)四項回歸涵蓋切換／回復、未知舊owner、第二分頁sessionStorage，以及別頁已移除key不能以null覆寫封存。

attempt4與最新attempt5全10 PASS；最新還加入timestamp instant比對，page error0。封存是應用程式讀取邊界，不是加密或同origin惡意程式防護；完整結果路由、其他舊快取讀者、共享裝置與多種儲存權限組合仍需完整前端驗收。

更早attempt1不採計：fixture相同完成時間被原去重契約辨識同場、測試webpack誤用classic JSX造成元件錯誤；修正測試設定為CRA相同automatic runtime。attempt2重播已登出session遭真Auth拒絕；改每次真密碼登入，沒有繞過驗證。保留各次紀錄，不把早期PASS累加成最終通過數。

測試頁pending畫面：[PNG](p0c3-browser-pending.png)。這是合成完成頁，畫面不能取代資料庫逐欄驗證。

## 實體裝置人工步驟

| 裝置 | 已完成 | 尚未驗證 |
| --- | --- | --- |
| Windows桌面 | 真Chrome headless、offline emulation、reload／整程序重啟／雙頁／storage fault | 人工完整遊戲UI、實體網路切換／斷線與站台儲存限制：BLOCKED |
| Android手機／平板 | 沒有可控制且已授權的設備 | 全項BLOCKED；未用viewport模擬代替 |
| iPadOS／iOS | 沒有可控制且已授權的設備 | 全項BLOCKED；未聲稱Safari已測 |

人工執行：先建全新已核對獨立標準stack與前端、僅用合成A/B帳號；以專用profile檢查Auth/API/Storage所有目標。完成一場正式遊戲UI流程，在測試裝置切Wi-Fi／飛航模式，於pending時背景切換、refresh、關閉瀏覽器與重新啟動，再恢復網路，逐欄核對Session／main／Raw／Derived與同步狀態；另做兩頁、A待傳→B→A、儲存權限及容量異常。不要切換共用工作機網路影響其他服務，也不要對正式站點操作。每項留OS／browser版本、時間、條件、筆數與差異；測試後僅清理已確認的合成資料。

本輪沒有研究級RT精度校準；同步欄位往返正確不能證明量測儀器精度。


逐案結果、環境、時間及原始證據 SHA-256：[機器證據](p0c3-test-evidence-2026-10-23.json)。UTC時間以Z標示；台灣時間為UTC+8。本輪未操作正式資料庫、正式Auth／Storage／環境變數，沒有push或部署。私有 .tmp/p0c3 內的憑證、profile與payload不納入Git／公開報告。
