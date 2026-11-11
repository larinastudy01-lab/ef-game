# P0-C2 合成歷史補齊驗證

以真實隔離 DB p0c2_isolated_cabffaaa4591 測試，所有資料由 fixture 產生；沒有複製或寫入正式 1,214 筆 Trial。原始來源、舊版本衍生資料與主結果在修復過程保留。

## A／B／C／D／E 與一致性

| 類別 | 合成情境／證據 | 驗證結果 |
| --- | --- | --- |
| A | H01：結構完整但主結果 falsely synced、研究階層0 | dryRun 0 writes；reviewed repair 建立20原 IDs／順序／內容；repeat 不重複。repair 不改 main，最後由正常 sync 完整驗證才 ACK |
| B | M01／M05、H11：ARI 舊 CHECK 不接受、4 Trial | 遷移前23514，來源保留；遷移後相同4 UUID／Raw／碼可補齊，重跑一致 |
| C | H04：同來源鍵但答案不同的 LB；H05 SSG；H06 DPT | 自動修復全部拒絕；不猜測階段、任務碼或合併作答操作 |
| D | H07：宣告12題、來源 Raw0 | 拒絕製造 Trial，仍為0 |
| E | H02：已完整，保留非 current 舊 processing version | 重跑不增加 Raw／current Derived，舊衍生版本留存 |
| 部分已存 | H03：原7／20 | 原7完整 row、UUID、received_at 保留，只補13；完整20當前衍生 |
| 內容衝突 | H08：同識別但不同原答案 | 拒絕，不覆寫 main／Raw，不 falsely verified |
| 舊 LB 可追溯 | X01：3個可證明唯一來源的舊鍵／舊 UUID | 沿用舊 Raw／UUID，Derived 記 canonicalSourceTrialKey，重跑不增加 Raw |

| 案例 | SQL／API 操作摘要 | 實際結果 | 狀態 |
| --- | --- | --- | --- |
| P0C2-H01 | A + falsely synced: dryRun is read-only, repair, then verified acknowledgement | dryRun 0 writes; 20 exact original IDs/order/raw/derived verified twice; main unchanged by repair, acknowledged only by final normal sync | PASS |
| P0C2-H02 | E: already complete repair remains idempotent and keeps old derivations | Complete source and UUIDs retained; inactive old processing version preserved; no additional raw rows | PASS |
| P0C2-H03 | Partial raw checkpoint repairs exactly the missing 13 of 20 | 7 committed raw rows/IDs/content retained, 13 filled; 20 exact current derivations | PASS |
| P0C2-H04 | C: LB ambiguous/unmapped source refuses automatic repair | Automatic repair refused; original operations/code retained; no guessed mapping or trial invention | PASS |
| P0C2-H05 | C: SSG ambiguous/unmapped source refuses automatic repair | Automatic repair refused; original operations/code retained; no guessed mapping or trial invention | PASS |
| P0C2-H06 | C: DPT ambiguous/unmapped source refuses automatic repair | Automatic repair refused; original operations/code retained; no guessed mapping or trial invention | PASS |
| P0C2-H07 | D: insufficient source never invents missing trials | Declared12/raw0 refused; raw0 retained | PASS |
| P0C2-H08 | Conflicting source content is rejected without overwriting raw/main | Conflicting source rejected; acquisition history and previous verified source unchanged | PASS |
| P0C2-H09 | PM timeout/cancellation/planned status survives real DB roundtrip | 14 raw slots, 12 administered, 3 timeout =25%; 2 planned excluded; raw and all derived fields exact | PASS |
| P0C2-H10 | CBT early-stop and unadministered slots remain distinct | 2 administered +2 planned preserved; no invented response for planned slots; earlyStop retained | PASS |
| P0C2-H11 | B: migrated synthetic ARI history repair is repeatable | ARI 4 original rows/IDs/code retained across repeated reviewed repair; main unchanged | PASS |
| P0C2-H12 | Revocation removes same-JWT and fresh-client access across six tables | Same JWT and fresh client denied all six hierarchy tables after guardian RPC; raw insert denied42501 | PASS |

## 原始與衍生資料對照

H01／H03／H09／H11、I01／I02／I27、X01 比較資料庫讀回的原始 IDs、source key、order、stepIndex、原始 response／RT／時間欄位／payload 及衍生欄位。現有 Raw 不重寫，衍生版本可追溯；不是只比較筆數。

H09：PM 14 個來源槽位、12已施測、3逾時＝25%，2未施測不進分母；合法 deselect 原事件保留。X03–X07 的實際 DB 往返進一步驗證12/0＝0%、12/12＝100%、6/2＝33.333…%、零已施測回 null／not_calculable_no_administered_trials，以及另有重複點擊排除時逾時仍計數。H10 保留 CBT 2已施測＋2 planned 與 earlyStop，不製造 planned 的答案；這些是衍生修正，正式題數／時間／分數不變。

早期補充測試曾將 JavaScript 巢狀 undefined 與 JSON 省略欄位直接比較而失敗；修正測試比較為 JSON 持久化契約後重新執行，全批 H01–H12 於 history-real-attempt3.json 通過。沒有因此改寫 fixture 原答案或產品資料。早期紀錄保留且不列為通過證據。

## 研究讀取後備與撤銷

X02 編譯實際 src/lib/database.js，只將 Supabase client 注入已驗證隔離 SDK；沒有載入正式 client 模組。真實研究 persona 先被拒絕，guardian RPC 授權後，實際 getResearchFeatureInputsFromCloud 對 main20／Raw7 資料讀取回20 Raw＋20 Derived 的記憶體後備。HTTP wrapper 只容許 GET／HEAD，12個請求；資料庫仍7 Raw，讀取不偷偷補寫。撤銷後相同 JWT 回空，H12 另核對六表存取及寫入42501。

這個 persona 使用現有 clinician 契約，不聲稱已有獨立 researcher role 或已測遍所有 scope 組合。

## 中斷、重啟與並行

| 案例 | SQL／API 操作摘要 | 實際結果 | 狀態 |
| --- | --- | --- | --- |
| P0C2-G01 | 見實際結果及測試證據 | OS-terminated child after actual raw commit;20 raw/0 derivations; durable intent retained | PASS |
| P0C2-G02 | 見實際結果及測試證據 | New repair-batch process resumed same reviewed plan;20 exact raw/UUID/content and20 current derivations; main unchanged | PASS |
| P0C2-G03 | 見實際結果及測試證據 | Two independent repair processes plus final retry converge; source/IDs unchanged; no duplicate raw/current derivations | PASS |

G01 是真實 OS 程序終止，intent／checkpoint 先 fsync；G02 執行新的 repair-batch 程序與相同凍結 plan／IDs；G03 兩程序初始 exit [1,0] 後再 retry exit0，完整讀回收斂，沒有多出 Raw／current Derived，主結果不動。這證明工具程序的恢復，尚不代表 browser 關閉／裝置故障。

## 正式歷史盤點仍待處理

正式歷史補齊＝0；正式 synced 狀態修改＝0。以下僅是先前 P0-B 快照，不是本輪最新查詢：2026-10-23 06:58:41.987531 UTC（台灣14:58:41.987531）。最新查詢被 OAuth refresh 阻擋。

| 舊快照類別 | 主結果 | 原始 Trial | 後續 |
| --- | --- | --- | --- |
| A | 69 | 849 | 重做最新 dryRun／逐筆來源與授權核對後才可提出補齊 |
| B | 4 | 48 | 先完成正式 ARI 草案人工審查 |
| C | 26 | 317 | LB45／SSG260／DPT12 保留人工研究契約核對 |
| D | 1 | 0 | 來源不足，不補造 |
| E | 0 | 0 | 不能以本輪合成 E 類通過推定正式已有完整資料 |

舊快照21筆 falsely synced＝A11／B4／C5／D1；A＋B共897 Trial 僅為有條件候選，並非已修復。舊 LB45個操作與33個來源鍵存在歧義時，不能用新增流水號將操作假裝成獨立題目，也不能猜 ARI／時間／答案。下一輪仍須明確來源對照與人工作業契約。

## 清理證據

本輪清理前全為合成資料：main101、Raw1144、current Derivations1137、all Derivations1140、Auth5；所有 foreign counts0。這與舊正式100／1214是不同資料集。負向／部分提交 fixture 刻意不完整，不能把整個測試叢集宣稱全 synced。

清理前 Raw 集合 SHA-256：8b139d16f9df1f4d382d742315ffa11f9d52f1f1235df38cbbd6074ac42c9fdc。確認本輪專屬叢集／路徑後移除合成 DB、停服務與移除 junction；證據保留。未刪正式、既有開發資料或 Docker volume。


所有時間為 UTC；2026-10-23 台灣時間為 UTC+8。逐案機器結果與 SHA-256 見 [驗證證據](p0c2-test-evidence-2026-10-23.json)。私人執行資料位於 .tmp/p0c2，不納入版本控制；公開文件沒有金鑰、JWT 或真實個案 payload。
