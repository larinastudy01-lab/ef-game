# 蒐秘密｜P0-C4 裝置驗收

產出：2026-10-24T05:29:20.388Z（UTC；臺灣日期 2026-10-24）。版本：8ef96ff4100533907bd4c2549a0c018b0553f345 加本輪未提交工作樹；逐檔 SHA-256 見[機器證據](p0c4-test-evidence-2026-10-24.json)。

環境：Windows、Node 24.15.0、Chrome 155.0.8059.85；全新原生 PostgreSQL 17.11／PostgREST 16.5／Auth v2.197.0 Windows 適配版。資料庫 p0c4_isolated_c0fc0a60735b，cluster ID 7699882706748678332；API 僅 127.0.0.1:55341。全部使用合成個案及獨立測試帳號，並非標準 Supabase 或正式環境。

**實體裝置總驗收 BLOCKED。**

| 裝置／項目 | 已執行 | 未執行 | 判定 |
|---|---|---|---|
| Windows Chrome 155 | 真瀏覽器程序、完整六遊戲、兩分頁、持久 profile 關閉重開、Web Storage、瀏覽器 offline／HTTP 注入 | 實體 Wi-Fi 切換、實體聲音、人工觸控／前後景與計時精度 | 瀏覽器自動化 PASS；裝置項目未結案 |
| Android 手機／平板 | 無可取得的實體設備 | 全部裝置案例 | BLOCKED |
| iPadOS Safari | 無設備與可操作 Safari | 全部裝置案例 | BLOCKED |

人工執行前先提供可由裝置連線的獨立測試前端及 Supabase。手機的 127.0.0.1 指手機本身，不能拿本輪 loopback 當已具備的手機測試服務；不得改連正式 URL。記錄裝置／OS／瀏覽器版本、前端 commit、Project ID、API／Auth／Storage 來源與測試個案識別碼，通過隔離確認才寫入。

1. 普通家長 A 登入、選擇合成個案；依正常地圖完成六項試玩與正式流程，SRT 真正八分鐘，錄製開始／結束牆鐘。
2. 每項保存後逐欄比對 main／Session／Task／Raw／Derived；家長讀回與未授權 B／專業／研究拒讀。
3. 在下一個合成測驗提交前關 Wi-Fi，核對原始 pending；切至背景、關閉瀏覽器、重新啟動，核對 ID 與 raw hash。
4. 登出 A、登入 B，核對沒有代傳／顯示；返回 A 再開 Wi-Fi，確認完整研究 ACK 後才清除 pending。
5. 多次重送及兩頁並行，核對 unique key、內容與數量；撤銷專業授權後再請求必須由 RLS 拒讀。
6. 在專用可丟棄 profile 做儲存錯誤／清理測試，保留原始備份，核對不可復原警示。

待執行記錄：裝置、測試人、開始／結束、案例 ID、預期／實際、PASS／FAIL、截圖、DB 讀回 hash、缺陷與重測版本；目前全部實體欄位 NOT RUN，不以 viewport 或 UA 偽裝代替。
