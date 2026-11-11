# 蒐秘密｜P0-C4 網路與儲存恢復

產出：2026-10-24T05:29:20.388Z（UTC；臺灣日期 2026-10-24）。版本：8ef96ff4100533907bd4c2549a0c018b0553f345 加本輪未提交工作樹；逐檔 SHA-256 見[機器證據](p0c4-test-evidence-2026-10-24.json)。

環境：Windows、Node 24.15.0、Chrome 155.0.8059.85；全新原生 PostgreSQL 17.11／PostgREST 16.5／Auth v2.197.0 Windows 適配版。資料庫 p0c4_isolated_c0fc0a60735b，cluster ID 7699882706748678332；API 僅 127.0.0.1:55341。全部使用合成個案及獨立測試帳號，並非標準 Supabase 或正式環境。

**NET-01～07、STORE-02～05 在下列明確範圍 PASS；STORE-01 NOT RUN。** 實際 Chrome、Web Storage 與真 HTTP／PostgreSQL；斷線及故障注入不等於實體 Wi-Fi／磁碟耗盡。

| ID | 方法與實際結果 | 判定 |
|---|---|---|
| NET-01 | 真 LB 正式最後提交前 context offline；20 題原始 outbox 保留，DB main=0 | PASS |
| NET-02 | HTTP 中止研究寫入；main saved／research pending，未清除 source | PASS |
| NET-03 | 研究仍失敗時真 reload；原 ID／20 題不變 | PASS |
| NET-04 | 關閉整個 persistent Chrome，重開同 profile；owner／ID／raw 不變 | PASS |
| NET-05 | route.fetch 已讓伺服器 commit Raw，再丟棄回應；DB Raw20／Derived0，仍 pending | PASS |
| NET-06 | 兩個真分頁同時恢復，自動 worker／Web Locks 收斂；main1／Session1／Task1／Raw20／Derived20 | PASS |
| NET-07 | 120,073ms 真瀏覽器 offline，跨四個 30 秒 worker 週期；原始來源不變，最後可重送 | PASS；不代表數日離線 |
| STORE-01 | 對 IndexedDB.open 注入失敗但呼叫數=0；結果 outbox 使用 localStorage，沒有可驗的 IDB 寫入流程 | NOT RUN／不適用此實作 |
| STORE-02 | 連續正式遊戲達到實際瀏覽器 per-origin quota；完成原始來源仍可同步，鏡像失敗有明確警示 | PASS；非 OS 磁碟耗盡 |
| STORE-03 | getItem／setItem SecurityError 故障注入；空 outbox 也明確提示，隱藏快取；移除故障後恢復 | PASS |
| STORE-04 | 獨立匿名 context 的不同 tagged pending 副本，用 Chrome origin-storage API 清除；20→0，清理前警告不可復原 | PASS；不是新遊戲完成 |
| STORE-05 | 同一筆實際 LB pending 經 A→登出→B→A，原始資料不刪、不錯置，最後完整同步 | PASS |

Raw commit 後及最終恢復的 SHA-256 同為 49cdebc37538e0b4a33f7643cc6343cc43eb98ddf4565569722c8f50f90e3195。核對 UUID、階段來源鍵、逐題 raw、衍生全部欄位，沒有只以筆數當 ACK。

真實 quota 的處理沒有壓縮、改計分或清空 outbox。為繼續其餘測試，曾將已核對 DB 的合成重複顯示別名作私有完整備份，再只移除冗餘副本以恢復容量；canonical 副本、雲端與所有 pending 保留。這是人工測試介入，不宣稱產品會自動擴容。

STORE-04 僅清除獨立、禁止所有 HTTP mutation 的匿名 context，原瀏覽器 profile 及 DB 未動。使用者若真的清除尚未上傳的原始 outbox，通常無法由空白裝置復原；應在成功上傳前保留瀏覽器資料。本輪已在 pending 訊息加入這項提示。

證據：[net-02-03-browser.json](../.tmp/p0c4/net-02-03-browser.json)、[net-04-real-browser-restart.json](../.tmp/p0c4/net-04-real-browser-restart.json)、[net-05-browser.json](../.tmp/p0c4/net-05-browser.json)、[net-06-browser.json](../.tmp/p0c4/net-06-browser.json)、[recovery-db-final-recovered.json](../.tmp/p0c4/recovery-db-final-recovered.json)、[store-03-browser.json](../.tmp/p0c4/store-03-browser.json)、[store-01-04-browser.json](../.tmp/p0c4/store-01-04-browser.json)。
