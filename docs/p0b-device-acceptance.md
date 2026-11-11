# P0-B 裝置斷線／重啟驗收程序

狀態：**未實機執行**。目前只有程式層模擬測試；不得把 fake timer、新 client 或記憶體資料替身當成瀏覽器重啟與 PostgreSQL 驗收。

## 前置條件與證據

使用獨立測試 Supabase、本機測試站台、全新瀏覽器 profile，以及完全合成的 guardian／患者。先通過 `scripts/p0/isolation-guard.cjs` 的目標檢查，再以**獨立程序環境**指定測試 URL/key 啟動既有網站；不編輯 `.env`、`.env.production`，不部署。確認 Network 面板的 auth／REST 主機均屬測試專案後才開始。

保留裝置、OS、瀏覽器版本、project ref、git revision、schema versions、案例 ID、施測原始筆數 N、全部原始 Trial、summary、來源與研究 UUID、故障時點、重試紀錄及家長／專業／研究端讀回。只用合成資料。內容比對應用同一個 JSON canonicalizer 在前後兩端比較；不要把 SQL JSONB 字串雜湊直接當成 JS JSON.stringify 雜湊。

目前 outbox 是 **localStorage** 的 `efGameResultOutbox:` 前綴項目，不是 IndexedDB。下面只讀取，不刪除或改寫待傳資料：

```javascript
Object.keys(localStorage)
  .filter(k => k.startsWith('efGameResultOutbox:'))
  .map(k => JSON.parse(localStorage.getItem(k)))
  .map(e => ({ resultId: e.result.resultId, ownerId: e.ownerId,
    trialCount: e.result.trials.length, syncStatus: e.result.syncStatus,
    syncState: e.result.syncState, activeTabId: e.activeTabId }));
```

任何案例都不能透過清除 storage、刪除資料列、停用 RLS、換成 service role 或更改正式評測規則取得通過。遊戲實際提前停止時以取得的 N 為準，不捏造固定題數。

## 操作案例

| ID | 實際操作 | 必須觀察的預期結果 | 實際結果 |
| --- | --- | --- | --- |
| G01 | 完成遊戲前在 DevTools 切 Offline，讓遊戲依原規則完成 | outbox 保有 N 筆原始 Trial、pending；不顯示同步成功。恢復網路後精確讀回 N 筆 | 未驗證 |
| G02 | 允許 game_results 寫入，封鎖 behavioral_sessions／trials／derivations REST 請求 | 主結果 saved、研究 pending；outbox 不清除，原始內容完整。解除封鎖後補齊 | 未驗證 |
| G03 | 在隔離代理中讓 INSERT 已送達伺服器，丟棄回應；保存代理記錄 | 不能以錯誤回應宣稱沒寫入，也不能標完整；重試不增加 UUID／source key，內容相同 | 未驗證 |
| G04 | G01/G02 的 pending 狀態重新整理頁面 | 原始資料、帳號綁定與 pending 仍存在。已完成結果不被降級成新作答；未完成項依既有恢復規則標 interrupted | 未驗證 |
| G05 | 關閉所有測試站分頁，退出瀏覽器程序，再開啟相同 profile、登入原 guardian | 舊 pending 可恢復；保存施測資料，解除 stale tab/lock 後重試一次且不重複 | 未驗證 |
| G06 | 同一測試帳號、同一 result 同時開兩個分頁恢復同步 | CAS／鎖競爭不得覆蓋較新作答；最終一筆主結果、一組研究資料，ID／內容一致 | 未驗證 |
| G07 | 故障期間重複切換 Offline/Online，必要時等待現有 30 秒重試週期 | 不因單次失敗永久消失；成功只在主結果、Session、Task、全部 raw/current derivation 核對後成立 | 未驗證 |
| G08 | 在獨立 profile 限制 localStorage 或以測試攔截令 setItem 拋出 QuotaExceededError | 明確 storageError、保存失敗不得被誤認已持久化；已有 pending 不清除；恢復空間後可重試 | 未驗證 |
| G09 | 單獨模擬 IndexedDB 不可用／配額不足 | 記錄影響範圍；不能把此結果當成 localStorage outbox 的容量測試 | 未驗證 |
| G10 | pending 期間登出 A、登入 B，再回 A | B 看不到或接手上傳 A 的原始結果；A 的待傳資料不被登出清理刪除，回到 A 後重試 | 未驗證 |

G03 的 fetch 故障注入已在整合測試程式準備，但代理／真實裝置的丟回應仍需執行。一般 DevTools「封鎖請求」通常是在送出前阻擋，不能當成伺服器已 commit、回應遺失的證據。

G08 若完全沒有可用持久儲存，不能無條件保證關閉瀏覽器後仍保存。必須實測儲存錯誤是否正確阻止假成功、使用者是否能保留目前結果並重試；無法復原的情形列為驗收失敗，不得假造已保存的 Trial。現有 `resultSync.test.js` 有 quota 拋錯與 storageError 測試，但未替代此實機案例。

## 通過與收尾

逐筆以來源 result ID 查主結果與研究階層，核對 UUID 集合、原始 JSON、外鍵／參與者關係、目前與歷史處理版本及 expected/verified count。家長、授權專業／研究帳號各自用普通 JWT 查詢；未授權帳號須拒絕。保存 JUnit/TAP、代理與瀏覽器記錄；有任何缺題、重複、內容差異或假成功就保留 pending 與失敗原因。

只有隔離合成資料可以在驗收留存期後清理；先輸出證據、精確確認 project ref、測試前綴、Fixture 所有權及外鍵依賴。此程序沒有提供自動刪除、清表或正式資料清理命令。
