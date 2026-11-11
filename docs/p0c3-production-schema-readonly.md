# P0-C3 最新正式Schema唯讀驗證

**BLOCKED，未取得本輪最新正式Schema或歷史分類。** 本輪連線檢查日期為2026-10-23（台灣）；最初list_projects嘗試未另存秒級時間，紀錄生成於2026-10-23T14:34:59.091Z，不把生成時間冒充正式snapshot時間。

實際工具回應：OAuth token refresh failed: Failed to parse server response。失敗發生於OAuth階段，未送SQL。這不能單獨判定token已過期、被撤銷或服務端故障；沒有繞過Auth、猜Token、改驗證設定或尋找額外高權限。使用者已明確回覆「目前不重新授權，保留唯讀驗證待辦」，本輪停止相應驗證，不再要求重新登入，也不換正式service-role key。

## 最新狀態不能確認的項目

| 要求 | 本輪實際結果 |
| --- | --- |
| PostgreSQL／PostgREST／Auth版本、Extension | BLOCKED／未知 |
| Table／Column／Default／NULL／FK／Unique／CHECK | BLOCKED／未知 |
| RLS USING／WITH CHECK、grant、Function definer／search_path | BLOCKED／未知 |
| Trigger／Index／Migration歷程 | BLOCKED／未知 |
| ARI目前是否仍拒絕 | 未知；不能由舊CHECK或新本機PASS推定 |
| Participant returning原問題目前是否仍存在 | 未知；本輪只在隔離復現與修正 |
| P0-B 01/02/03及C2 04能否直接用於當下正式 | 尚無相容性結論；草案仍有正式目標封鎖 |
| 主結果／研究階層／Trial／false synced最新數量 | 未取得 |
| 新增、修復及A–E變化 | 未取得 |

## 已準備且只在本機驗證的唯讀蒐證

新增[05-production-catalog.readonly.sql](../scripts/p0/sql/05-production-catalog.readonly.sql)：REPEATABLE READ READ ONLY、30秒statement timeout、取得catalog／settings／grants／function／trigger／index及migration relation存在性，最後rollback。只對本輪local DB執行，transaction_read_only=on，18表／58函式／48 policies／117 constraints。原檔hash見機器證據；這是SQL可執行性證據，不是正式快照。

未來合法唯讀連線恢復後才可取得新catalog，另用官方list_migrations取得Migration歷程；若缺權限列人工待辦，不自動升權。完整function body可能含敏感常值，原始catalog應保存在受控私有位置，先審閱再公開。資料分類沿既有[00 readonly preflight](../scripts/p0/sql/00-preflight.readonly.sql)在同一已授權snapshot執行，原payload／IDs只留私有；重新算A–E／expected與stored Raw／Derived，不能只比總數。

## 唯一可引用的歷史數字

舊P0-B快照：2026-10-23 06:58:41.987531Z（台灣14:58:41.987531）。A69／849，B4／48，C26／317，D1／0，E0；合計100主結果／1214來源Trial；21 falsely synced為A11/B4/C5/D1。C類LB45／SSG260／DPT12繼續保留人工核對，不猜任務代碼／階段／ordinal。不知道這些數字現在是否改變。

原始證據與待核對清單見[P0-B報告](p0b-acceptance-2026-10-23.md)、[歷史preflight](p0b-history-preflight-2026-10-23.json)、[synced盤點](p0b-synced-reconciliation-2026-10-23.json)。本輪正式writes／migration／repair／status／Auth／Storage變更均0，沒有將真實1214筆複製到本輪測試。


逐案結果、環境、時間及原始證據 SHA-256：[機器證據](p0c3-test-evidence-2026-10-23.json)。UTC時間以Z標示；台灣時間為UTC+8。本輪未操作正式資料庫、正式Auth／Storage／環境變數，沒有push或部署。私有 .tmp/p0c3 內的憑證、profile與payload不納入Git／公開報告。
