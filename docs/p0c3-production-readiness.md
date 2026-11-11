# P0-C3 正式遷移與歷史補齊審查包

**審查包草案已備；必要正式證據仍缺，尚不具P0-D執行核准條件。** 本文件不是操作授權，不包含可直接對正式環境執行的解除封鎖腳本。即使後續C3 PASS，仍須另得使用者明確P0-D授權。

## Gate與Migration順序草案

| 順序 | 審查／未來操作 | 本輪證據／目前狀態 |
| --- | --- | --- |
| 0 | 合法唯讀取得最新DDL、版本／roles、Migration歷程與A–E快照，對照草案hash | BLOCKED：OAuth／使用者暫不重新授權；不能以舊snapshot代替 |
| 1 | 備份範圍、完成證據、可恢復性、維護窗與稽核核准 | NOT PROVIDED／未做正式備份或復原 |
| 2 | 在獨立標準Supabase還原相容DDL，以合成資料重跑原28＋補34／Participant10／Browser與必要裝置 | BLOCKED；本輪僅原生與同步子流程PASS |
| 3 | 審閱04 Participant SELECT修正；確認INSERT／UPDATE、helper、角色與grants仍符合草案前置 | 原生10PASS／rollbackPASS；正式未知 |
| 4 | 審閱01兩張CHECK擴充ARI，保存各表原CHECK，不轉ART／SSG／DPT | M01–M09原生PASS；正式未知 |
| 5 | 審閱02 Derivation／03 Session來源綁定；先檢查所有既存不一致再施加restrictive policies | I26／I28真實42501PASS；正式待前檢 |
| 6 | migration後唯讀核對catalog、非目標約束／policy／trigger不變、合法／非法碼與權限 | 先在標準隔離完成；正式執行須另核准 |
| 7 | 凍結最新逐筆plan／來源hash／UUID，先小批A，再B；保留完整journal／失敗來源 | 工具目前只接受isolated，沒有正式apply開關 |
| 8 | 逐筆核對Raw／Derived、研究讀回、main與ACK；再決定是否擴批 | 不因Session已存在或synced標籤略過；不把筆數相同當完整 |

草案：[01](../scripts/p0/sql/01-task-codes.draft.sql)、[01 rollback](../scripts/p0/sql/01-task-codes.rollback.draft.sql)、[02](../scripts/p0/sql/02-derivation-binding.draft.sql)、[03](../scripts/p0/sql/03-session-source-binding.draft.sql)、[04](../scripts/p0/sql/04-participant-returning.draft.sql)、[04 rollback](../scripts/p0/sql/04-participant-returning.rollback.draft.sql)、[05唯讀catalog](../scripts/p0/sql/05-production-catalog.readonly.sql)。這些寫入草案的isolated guard目前刻意拒絕正式；未來正式版本／目標防護／執行權限仍需另行設計、code review、隔離演練及人工核准，不能只換URL或刪guard。

## 歷史修復資料包

最新分類、可補齊筆數與21筆synced的當下狀態均未取得。舊快照僅作待重查清單：A69／849；B4／48；C26／317（LB45／SSG260／DPT12）；D1／0；E0。A+B897 Trial僅有條件候選，不是已核准或已修復。見[最新唯讀狀態](p0c3-production-schema-readonly.md)及[P0-B清單](p0b-history-preflight-2026-10-23.json)。

未來每筆plan應包含私有result ID、owner／patient綁定、來源payload／每Trial hash、完整UUID／舊鍵對照、預期Trial數、既存Raw／current Derived、缺少項目、排除理由、processing version及核准人／時間。C類不得猜階段／合併操作；D類不得造Trial。補齊保留原始Raw與非current舊版本；修復工具不直接改歷史main狀態，只有另行核准的正常同步在完整讀回後才能ACK falsely synced。

每筆mutation前fsync intent；失敗保留計畫／journal／outbox／部分提交，用相同IDs重試並重新讀回，不依journal成功字樣略過。內容或owner不一致停止該筆且不得覆寫。現有repair-batch拒絕正式目標；大量正式資料需另審合法owner執行路徑或經審查的有限權限RPC，不能用Service Role繞RLS作權限證明。本輪沒有新增正式RPC／交易。

## 備份、回復與不可逆風險

正式前須提出涵蓋main原payload、Participant／Session／Task、immutable Raw、全部Derived版本、consent／owner關聯及DDL／constraints／RLS／function／trigger／index／grant的備份範圍與加密保存／存取人。需有完成時間、涵蓋範圍／hash／PITR時間點及可恢復性證據；本輪均未取得。受控正式資料復原演練的環境、敏感資料權限與可能費用須另行核准，不能把真實個案資料還原到本輪合成測試stack。

ARI已寫入時01 rollback會拒絕；優先保留expanded CHECK／資料，只回退應用程式，不能刪ARI或改成SSG。04 rollback會恢復fresh INSERT RETURNING失敗，必須先評估停寫／保留pending來源。02/03移除restrictive policy會恢復跨關聯風險，不能當成自動安全回復。CHECK驗證與ALTER POLICY可能等待表鎖／阻擋寫入；草案timeout不是零停機保證，須先核對實際資料量、鎖與維護窗。

每批以來源hash、before／after數量與IDs／內容差異、processing version、SQLSTATE及核准plan追蹤；有不一致即停後續批次，保留現場資料，不清表、不回寫猜測答案。不可只回復資料表數量或清除失敗來源。

## 必要人工核准事項

恢復既有唯讀連線（目前使用者暫緩）；提供獨立標準stack及必要裝置；確認研究persona／scope契約；審查新快取封存與未知owner回復；最新schema相容性與04 policy；正式備份／還原／權限路徑；明確核准的migration hash、目標、維護窗、批次與停止條件。以上未齊，本輪不提出P0-D執行核准，更不自動執行。


逐案結果、環境、時間及原始證據 SHA-256：[機器證據](p0c3-test-evidence-2026-10-23.json)。UTC時間以Z標示；台灣時間為UTC+8。本輪未操作正式資料庫、正式Auth／Storage／環境變數，沒有push或部署。私有 .tmp/p0c3 內的憑證、profile與payload不納入Git／公開報告。
