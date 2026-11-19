# 本機儲存與研究頁登入恢復

研究頁載入失敗時，依實際錯誤區分登入失效、權限不足、資料庫尚未設定與暫時連線失敗。無效 refresh token、缺少 session 或資料請求遭到登入驗證拒絕時，導向醫療登入頁，清除該瀏覽器的登入 session；重新登入後返回研究頁。待上傳測驗紀錄不會因重新登入被清除。

儲存警告依來源分開追蹤：待上傳原始紀錄、顯示快取、帳號鏡像切換與中斷恢復。只有對應操作重試成功才解除該項警告；另一筆結果成功寫入不會掩蓋舊錯誤。警告提供「重試儲存」，原有焦點、恢復連線及定期檢查也會重試。雲端完整驗證成功、釋放 outbox 空間後，再嘗試失敗的本機寫入。

快取重試不重複發獎或建立新測驗，會合併當下的歷史資料，避免覆蓋較新的結果。已上傳的結果保留已驗證同步狀態。跨帳號重試受原帳號限制，顯示快取須等帳號鏡像隔離完成；暫時遊戲測試模式不執行真實紀錄重試。分頁鎖查詢不可用時使用既有心跳恢復規則。

若儲存權限仍被拒絕，或上傳後容量仍不足，警告會保留並顯示原因。此修正不自動清空瀏覽器資料、歷史封存或尚未上傳的來源。全頁重新整理後，尚未成功寫入持久儲存、僅保留在記憶體的資料仍可能遺失。

回歸案例位於 `src/utils/resultSync.test.js`、`src/utils/resultManager.test.js`、`src/components/ResultSyncStatus.test.jsx`、`src/components/ProtectedRouteRecovery.test.jsx`、`src/components/research/ResearchWorkspaceContext.test.jsx`、`src/pages/ClinicianLoginPage.test.jsx` 及 `src/lib/database.test.js`。測試使用合成資料與模擬服務，未對正式帳號或資料庫寫入。

GitHub Pages 由 `.github/workflows/deploy-pages.yml` 發布；本機程式碼修改需經該部署流程後，正式網站才會取得新行為。

2026-11-19 驗證：與本次變更相關的 10 組、96 項測試通過（`--runInBand --testTimeout=15000`），ESLint 與差異格式檢查通過。完整回歸試跑曾遇到研究頁測試逾時，以及 LB 成就流程期待紅色按鈕、現行遊戲顯示黃色按鈕的不一致；研究頁單獨重跑通過，LB 遊戲顏色不在本次修改範圍，完整回歸未宣稱全部通過。
