# P0-C2 真實資料庫整合結果

原 28 項最終 28 PASS／0 FAIL／0 BLOCKED／0 NOT RUN。另有 34 項真實資料庫補充情境 PASS，合計 62。這些數字不包含未執行的瀏覽器項目，也不把 656 項本機測試計入真實資料庫案例。

環境 p0c2_isolated_cabffaaa4591／system ID 7699777475111413860；API http://127.0.0.1:55321。Node v24.15.0，PostgreSQL 17.11／PostgREST 16.5／Auth 2.197.0 加 Windows listener 移植。原 28 項時間 2026-10-23T08:53:01.842Z 至 2026-10-23T08:54:07.289Z。環境已清理。

## 原案例，保留 ID、名稱與預期

已讀取 [P0-C 原矩陣](p0c-integration-test-matrix.md)，逐一對照 [P0-B 原案例](p0b-integration-cases-2026-10-23.json) 的 ID／purpose／expected；沒有用補充案例替換。執行同一份 [isolated-integration.test.cjs](../scripts/p0/isolated-integration.test.cjs) 原 callback。下表操作摘要對應該 callback；每一列 PASS 均來自實際 Node JUnit testcase，非預期清單。

| 原 ID | 原名稱 | SQL／API 操作摘要 | 原預期／實際結果 | 狀態 |
| --- | --- | --- | --- | --- |
| P0B-I01 | LB: full write, exact raw readback and duplicate submission | LB20、兩階段同 stepIndex；同步兩次並逐欄讀回 | One main/session/task, exact unique raw and current derivations; repeated submission retains IDs/content；實測斷言全部成立 | PASS |
| P0B-I02 | PM: full write, exact raw readback and duplicate submission | PM12 含合法取消；同步兩次並逐欄讀回 | One main/session/task, exact unique raw and current derivations; repeated submission retains IDs/content；實測斷言全部成立 | PASS |
| P0B-I03 | CBT: real schema accepts the current task code | CBT 現行碼：主結果→Session→Task→Raw→Derivation 讀回 | Main, task, raw and derived rows written; raw answer and summary unchanged；實測斷言全部成立 | PASS |
| P0B-I04 | SRT: real schema accepts the current task code | SRT 現行碼：完整階層讀回 | Main, task, raw and derived rows written; raw answer and summary unchanged；實測斷言全部成立 | PASS |
| P0B-I05 | ARI: real schema accepts the current task code | ARI 現行碼：完整階層讀回 | Main, task, raw and derived rows written; raw answer and summary unchanged；實測斷言全部成立 | PASS |
| P0B-I06 | DCCS: real schema accepts the current task code | DCCS 現行碼：完整階層讀回 | Main, task, raw and derived rows written; raw answer and summary unchanged；實測斷言全部成立 | PASS |
| P0B-I07 | game_results: one interrupted request stays pending and a new client retries | 攔截一次 main request，保留來源，新 client 重試 | No false success, source retained, a fresh client fills the complete hierarchy；實測斷言全部成立 | PASS |
| P0B-I08 | behavioral_sessions: one interrupted request stays pending and a new client retries | 攔截一次 Session request，新 client 重試 | No false success, source retained, a fresh client fills the complete hierarchy；實測斷言全部成立 | PASS |
| P0B-I09 | behavioral_task_sessions: one interrupted request stays pending and a new client retries | 攔截一次 Task request，新 client 重試 | No false success, source retained, a fresh client fills the complete hierarchy；實測斷言全部成立 | PASS |
| P0B-I10 | behavioral_trials: one interrupted request stays pending and a new client retries | 攔截一次 Raw request，新 client 重試 | No false success, source retained, a fresh client fills the complete hierarchy；實測斷言全部成立 | PASS |
| P0B-I11 | behavioral_trial_derivations: one interrupted request stays pending and a new client retries | 攔截一次 Derivation request，新 client 重試 | No false success, source retained, a fresh client fills the complete hierarchy；實測斷言全部成立 | PASS |
| P0B-I12 | lost raw insert acknowledgement retries without duplicate IDs or source keys | 真實 Raw commit 後丟棄回應，重試、核對 ID／內容 | Retry converges to 20 original raw rows and 20 current derived rows；實測斷言全部成立 | PASS |
| P0B-I13 | existing session plus partial trial checkpoint fills remaining trials | 已有 Session／7 Raw，提交完整20，補13 | Existing seven IDs/content retained, thirteen rows added；實測斷言全部成立 | PASS |
| P0B-I14 | real unique constraint rejects duplicate source key and leaves raw answers intact | 另 UUID 插入相同來源鍵，真實 UNIQUE 拒絕23505 | 23505 and no raw changes；實測斷言全部成立 | PASS |
| P0B-I15 | anonymous/other guardian cannot read or attach a raw trial to this session | anon／guardian B SELECT 與跨個案 Raw INSERT | No foreign rows visible; insertion denied; original dataset unchanged；實測斷言全部成立 | PASS |
| P0B-I16 | guardian cannot rewrite a saved raw answer through PostgREST | guardian UPDATE 已存 Raw，重讀原答案 | Stored acquisition data unchanged；實測斷言全部成立 | PASS |
| P0B-I17 | existing session survives a later main-result failure and can retry | 已有 Session 後 main request 失敗，再重試 | Previous hierarchy retained and retry completes；實測斷言全部成立 | PASS |
| P0B-I18 | full main payload with only seven committed trials stays pending and fills the remaining thirteen | 完整 main20／Raw7，確認 pending，再補13 | Main remains pending until exact twenty-row readback succeeds; existing seven rows unchanged；實測斷言全部成立 | PASS |
| P0B-I19 | final main acknowledgement failure keeps research data and retries the final status safely | 最後 main ACK request 失敗，保留研究階層後重試 | Research retained, main pending, retry verifies full data before status acknowledgement；實測斷言全部成立 | PASS |
| P0B-I20 | two simultaneous sync clients converge after retry without duplicate trials | 兩 client 同時 sync，衝突後重試精確收斂 | At least one succeeds; conflicts retry to one exact dataset；實測斷言全部成立 | PASS |
| P0B-I21 | legacy SSG remains readable without conversion to ARI | SSG 原碼儲存／讀回，不轉 ARI | Raw stored/read code stays SSG；實測斷言全部成立 | PASS |
| P0B-I22 | ART: unrecognized task code still fails the real CHECK | ART INSERT，真實 CHECK 拒絕23514 | 23514; hierarchy never falsely acknowledged；實測斷言全部成立 | PASS |
| P0B-I23 | INVALID_TASK: unrecognized task code still fails the real CHECK | INVALID_TASK INSERT，真實 CHECK 拒絕23514 | 23514; hierarchy never falsely acknowledged；實測斷言全部成立 | PASS |
| P0B-I24 | unrelated nonnegative trial-count constraint remains enforced | 負 trial count，既有 CHECK 拒絕23514 | 23514; original dataset unchanged；實測斷言全部成立 | PASS |
| P0B-I25 | authorized researcher reads the complete hierarchy while an unauthorized clinician cannot | 授權 clinician-backed research 與未授權 clinician 讀六層 | Authorized positive read on all six tables; unauthorized client sees no case rows；實測斷言全部成立 | PASS |
| P0B-I26 | own participant cannot be attached to another patient raw trial through a derivation | Derivation 跨 raw／participant INSERT 及 UPDATE，42501 | Both INSERT and UPDATE fail 42501, not an unrelated unique violation；實測斷言全部成立 | PASS |
| P0B-I27 | reviewed isolated repair is repeatable and retains old derivation versions and main status | 已審閱修復重跑，逐欄讀回、保留舊 processing version／main | Verified count/IDs/content, old version retained, historical main payload/status unchanged；實測斷言全部成立 | PASS |
| P0B-I28 | an owned participant cannot link a different patient main result through a session | Session 跨 patient source-result INSERT 及 UPDATE，42501 | INSERT/UPDATE fail 42501, not a duplicate source-result constraint；實測斷言全部成立 | PASS |

逐案證據：[最終原始 JUnit](p0c2-original-28-2026-10-23.junit.xml)，及 [JSON](p0c2-test-evidence-2026-10-23.json) original28.results。JUnit 包含原始執行時間及 28 個 testcase；原檔 SHA-256 一併保留。舊 P0-C 文件的 BLOCKED 是先前階段紀錄，本文件才是本輪新結果。

第一次真實執行為 27 PASS／I14 FAIL。I14 fixture 原先遺漏 raw_schema_version，先被 NOT NULL 23502 擋住，未測到指定 UNIQUE 23505。唯一測試修改為複製完整既存合法 Raw 並只換新 UUID，再製造相同 source key；沒有修改 ID、名稱、預期或資料庫約束。修正後完整 28 項重跑全過。第一次 JSON／JUnit 保留於 .tmp/p0c2，公開 JSON 保留失敗摘要與檔案 hash，不將初次失敗隱藏或算成 PASS。

## 補充 34 項

| 案例 | SQL／API 操作摘要 | 實際結果 | 狀態 |
| --- | --- | --- | --- |
| P0C2-M01 | Ordinary Auth JWT/PostgREST ARI sync before migration | 23514; main/source retained, hierarchy not acknowledged | PASS |
| P0C2-M02 | Exact forward draft on real PostgreSQL | Both CHECKs expanded; other constraints/policies/RLS/triggers unchanged | PASS |
| P0C2-M03 | Forward repeat | Same catalog, no source data changes | PASS |
| P0C2-M04 | Rollback before ARI CHECK-bound rows exist | Exact legacy catalog restored; retained main/session not deleted | PASS |
| P0C2-M05 | Forward then retry original ARI source | 4 original raw rows verified; main/raw history unchanged except sync metadata | PASS |
| P0C2-M06 | Rollback with ARI rows retained | Safely refused; expanded CHECK and all data retained | PASS |
| P0C2-M07 | Direct ordinary-user task insertion: null | 23502 | PASS |
| P0C2-M08 | Direct ordinary-user task insertion: ART | 23514 | PASS |
| P0C2-M09 | Direct ordinary-user task insertion: INVALID_TASK | 23514 | PASS |
| P0C2-M10 | Exact restrictive binding drafts 02/03 | Applied to isolated DB only; real cross-binding tests I26/I28 still required | PASS |
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
| P0C2-X01 | Unambiguous old LB source keys/UUIDs stay unchanged during repair | 3 legacy keys/UUIDs/raw unchanged; current derivations reference retained UUIDs plus canonical provenance; repeated repair adds no raw | PASS |
| P0C2-X02 | Separate research persona gets guardian approval; actual research fallback is read-only | Independent ordinary clinician-backed research persona: denied before grant, approved by real guardian RPC, actual database.js reader restores20 from7 without writes, same JWT denied after revoke; 12 read-only HTTP requests | PASS |
| P0C2-X03 | PM real roundtrip denominator 12/0; planned 0 | {"rawCount":12,"administered":12,"timeouts":0,"rate":0,"status":"available","otherExclusion":false} | PASS |
| P0C2-X04 | PM real roundtrip denominator 12/12; planned 0 | {"rawCount":12,"administered":12,"timeouts":12,"rate":1,"status":"available","otherExclusion":false} | PASS |
| P0C2-X05 | PM real roundtrip denominator 6/2; planned 0 | {"rawCount":6,"administered":6,"timeouts":2,"rate":0.3333333333333333,"status":"available","otherExclusion":false} | PASS |
| P0C2-X06 | PM real roundtrip denominator 0/0; planned 2 | {"rawCount":2,"administered":0,"timeouts":0,"rate":null,"status":"not_calculable_no_administered_trials","otherExclusion":false} | PASS |
| P0C2-X07 | PM real roundtrip denominator 6/2; planned 0 | {"rawCount":6,"administered":6,"timeouts":2,"rate":0.3333333333333333,"status":"available","otherExclusion":true} | PASS |
| P0C2-G01 | 見實際結果及測試證據 | OS-terminated child after actual raw commit;20 raw/0 derivations; durable intent retained | PASS |
| P0C2-G02 | 見實際結果及測試證據 | New repair-batch process resumed same reviewed plan;20 exact raw/UUID/content and20 current derivations; main unchanged | PASS |
| P0C2-G03 | 見實際結果及測試證據 | Two independent repair processes plus final retry converge; source/IDs unchanged; no duplicate raw/current derivations | PASS |
| P0C2-R01 | 見實際結果及測試證據 | Rollback reproduces42501 for fresh ordinary-user UPSERT RETURNING; forward succeeds and repeats same UUID; existing visibility unchanged for two guardians, two clinicians and anonymous; no RLS disabling or data rewrites | PASS |
| P0C2-R02 | 見實際結果及測試證據 | Changed JWT role to service_role without re-signing; both real Auth and PostgREST rejected it | PASS |

M10 的記錄是施加 02／03 草案當下；隨後原 I26／I28 已實際確認 INSERT／UPDATE 均拒絕 42501，完成其後續驗證。各批次 executedAt、資料庫及實際結果見公開 JSON；私有各原檔及雜湊列在 artifacts。

## 權限與故障證據的範圍

五個合成帳號＝家長 A／B、授權／未授權 clinician、獨立 research persona；另加匿名 client。皆用真正 Auth password-login 普通 JWT。現有系統沒有獨立 researcher role，因此研究 persona 仍使用既有 clinician role，經 guardian 真實 request／accept／revoke RPC；沒有為了測試發明研究角色。現行同意 RPC 預設授四種 scope，本輪未證明每一種最小 scope 組合。

I15／I25／I26／I28 驗證跨個案讀寫；H12 驗證撤銷後同 JWT 與新 client 讀六層都不可見、Raw INSERT 42501；X02 另驗證實際 database.js 研究讀取入口及撤銷。R02 更改普通 JWT claim 而不重新簽章，真實 Auth 回403、PostgREST 回401/PGRST301。RLS runner 沒有 service-role key。

I07–I11 為真實 DB 前的 fetch request 失敗注入；I12 為真實 commit 後遺失 ACK。G01 是 OS 確實終止 child process，已提交20 Raw／0 Derived；G02 由新 repair-batch 程序沿原 durable intent／reviewed plan 補齊。G03 為兩個獨立程序，初始 exit [1,0]，最後 retry exit0，精確收斂。這不代表每個並行請求第一次均成功，也不是瀏覽器／實體斷線測試。

舊矩陣補充規格對照：P0C-X01→本輪 X02（現有 clinician 契約，獨立 researcher role 仍無契約）；X02→H12／X02；X03→M01–M10；X04→H11；X05→X01／H04；X06→H08；X07→X02；X08→H09–H10／X03–X07；X09→G01–G02；X10→G03；X11 的實體故障／瀏覽器仍 BLOCKED；X12 的來源／ID／順序／processing version 及 Raw／Derived 內容見 I01–I06／I27、H01／H03／H09／H11、X01／X02。補充規格未冒充原 28 案，也未將未測角色或實體故障標示通過。

## 真實瀏覽器人工驗收清單：8 項 BLOCKED

原因：CUA inventory 無可用 browser，getBrowser 實際失敗。未啟動前端，沒有把 Node client／程序恢復當成裝置測試。下一次先建立全新已驗證隔離 stack；用獨立 browser profile、合成帳號與專用前端 child-process URL／key，不修改正式 .env，確認 DevTools 所有 API 只連該隔離來源後操作。

| 人工項目 | 操作與通過條件 | 狀態 |
| --- | --- | --- |
| 完成後立即離線 | 合成評測完成瞬間只對測試 profile 啟用離線，確認原結果／outbox 保留；恢復後逐欄完整讀回 | BLOCKED |
| main 成功／研究失敗 | 僅攔截隔離研究 API；main 保存與 research pending 分開；不得清理必要來源 | BLOCKED |
| 重新整理 | pending 時 refresh；來源仍在，重試只補缺題 | BLOCKED |
| 關閉／重開 | pending 時關閉 profile，再開相同 profile；outbox 保留且可補齊 | BLOCKED |
| 多分頁 | 同合成結果兩頁同步；衝突後重試保留同 IDs／內容，不重複 | BLOCKED |
| 恢復網路 | 只切測試 profile online；確認 main ACK 在完整研究讀回之後 | BLOCKED |
| 本機保存介面 | 實際契約是 localStorage 的 efGameResultOutbox，檢查其內容保留與重試；沒有 IndexedDB 實作可宣稱已驗證 | BLOCKED |
| 儲存不足 | 在獨立測試 profile 可回復地製造 quota failure；不得顯示假成功或移除原始來源，清除測試占用後重試 | BLOCKED |

## 回歸與未執行範圍

完整 CRA：85 suites／656 tests／4 snapshots PASS（254.426 秒）；Node 工具44／44 PASS。原始 log 在 .tmp/p0c2/cra-regression.log、tool-regression.log，SHA-256 見 artifacts。這些回歸檢查是本機證據，與真實資料庫 62 案分開。

本輪最終資料庫案例無未修正 FAIL；剩餘 BLOCKED 為上述瀏覽器／實體故障、最新正式 catalog 唯讀比對及完整標準平台等價性。沒有執行正式 Migration、歷史補齊、部署、真實資料寫入或全平台 Storage／OAuth provider 測試。


所有時間為 UTC；2026-10-23 台灣時間為 UTC+8。逐案機器結果與 SHA-256 見 [驗證證據](p0c2-test-evidence-2026-10-23.json)。私人執行資料位於 .tmp/p0c2，不納入版本控制；公開文件沒有金鑰、JWT 或真實個案 payload。
