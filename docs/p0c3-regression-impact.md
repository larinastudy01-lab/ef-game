# P0-C3 回歸影響與原案例重跑

本輪新建叢集、Auth／埠與Participant policy復驗，故原28＋補34皆重跑。沒有以新Participant／Browser測試替代原案例。C3原28的ID／名稱／預期逐字比對P0-B catalog一致；最終執行 2026-10-23T13:56:36.390Z 至 2026-10-23T13:58:35.791Z，[原始JUnit](p0c3-original-28-2026-10-23.junit.xml)。補34的各批時間、操作、結果見機器證據additional34.batches／results。

## 逐項影響表

| 原ID | 原目的／操作 | 重跑理由 | 是否重跑 | 本輪原生 | 標準Supabase | 證據索引 |
| --- | --- | --- | --- | --- | --- | --- |
| P0B-I01 | LB: full write, exact raw readback and duplicate submission | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I01 |
| P0B-I02 | PM: full write, exact raw readback and duplicate submission | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I02 |
| P0B-I03 | CBT: real schema accepts the current task code | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I03 |
| P0B-I04 | SRT: real schema accepts the current task code | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I04 |
| P0B-I05 | ARI: real schema accepts the current task code | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I05 |
| P0B-I06 | DCCS: real schema accepts the current task code | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I06 |
| P0B-I07 | game_results: one interrupted request stays pending and a new client retries | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I07 |
| P0B-I08 | behavioral_sessions: one interrupted request stays pending and a new client retries | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I08 |
| P0B-I09 | behavioral_task_sessions: one interrupted request stays pending and a new client retries | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I09 |
| P0B-I10 | behavioral_trials: one interrupted request stays pending and a new client retries | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I10 |
| P0B-I11 | behavioral_trial_derivations: one interrupted request stays pending and a new client retries | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I11 |
| P0B-I12 | lost raw insert acknowledgement retries without duplicate IDs or source keys | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I12 |
| P0B-I13 | existing session plus partial trial checkpoint fills remaining trials | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I13 |
| P0B-I14 | real unique constraint rejects duplicate source key and leaves raw answers intact | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I14 |
| P0B-I15 | anonymous/other guardian cannot read or attach a raw trial to this session | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I15 |
| P0B-I16 | guardian cannot rewrite a saved raw answer through PostgREST | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I16 |
| P0B-I17 | existing session survives a later main-result failure and can retry | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I17 |
| P0B-I18 | full main payload with only seven committed trials stays pending and fills the remaining thirteen | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I18 |
| P0B-I19 | final main acknowledgement failure keeps research data and retries the final status safely | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I19 |
| P0B-I20 | two simultaneous sync clients converge after retry without duplicate trials | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I20 |
| P0B-I21 | legacy SSG remains readable without conversion to ARI | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I21 |
| P0B-I22 | ART: unrecognized task code still fails the real CHECK | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I22 |
| P0B-I23 | INVALID_TASK: unrecognized task code still fails the real CHECK | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I23 |
| P0B-I24 | unrelated nonnegative trial-count constraint remains enforced | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I24 |
| P0B-I25 | authorized researcher reads the complete hierarchy while an unauthorized clinician cannot | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I25 |
| P0B-I26 | own participant cannot be attached to another patient raw trial through a derivation | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I26 |
| P0B-I27 | reviewed isolated repair is repeatable and retains old derivation versions and main status | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I27 |
| P0B-I28 | an owned participant cannot link a different patient main result through a session | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0B-I28 |
| P0C2-M01 | Ordinary Auth JWT/PostgREST ARI sync before migration | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M01 |
| P0C2-M02 | Exact forward draft on real PostgreSQL | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M02 |
| P0C2-M03 | Forward repeat | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M03 |
| P0C2-M04 | Rollback before ARI CHECK-bound rows exist | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M04 |
| P0C2-M05 | Forward then retry original ARI source | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M05 |
| P0C2-M06 | Rollback with ARI rows retained | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M06 |
| P0C2-M07 | Direct ordinary-user task insertion: null | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M07 |
| P0C2-M08 | Direct ordinary-user task insertion: ART | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M08 |
| P0C2-M09 | Direct ordinary-user task insertion: INVALID_TASK | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M09 |
| P0C2-M10 | Exact restrictive binding drafts 02/03 | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-M10 |
| P0C2-H01 | A + falsely synced: dryRun is read-only, repair, then verified acknowledgement | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H01 |
| P0C2-H02 | E: already complete repair remains idempotent and keeps old derivations | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H02 |
| P0C2-H03 | Partial raw checkpoint repairs exactly the missing 13 of 20 | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H03 |
| P0C2-H04 | C: LB ambiguous/unmapped source refuses automatic repair | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H04 |
| P0C2-H05 | C: SSG ambiguous/unmapped source refuses automatic repair | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H05 |
| P0C2-H06 | C: DPT ambiguous/unmapped source refuses automatic repair | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H06 |
| P0C2-H07 | D: insufficient source never invents missing trials | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H07 |
| P0C2-H08 | Conflicting source content is rejected without overwriting raw/main | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H08 |
| P0C2-H09 | PM timeout/cancellation/planned status survives real DB roundtrip | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H09 |
| P0C2-H10 | CBT early-stop and unadministered slots remain distinct | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H10 |
| P0C2-H11 | B: migrated synthetic ARI history repair is repeatable | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H11 |
| P0C2-H12 | Revocation removes same-JWT and fresh-client access across six tables | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-H12 |
| P0C2-X01 | Unambiguous old LB source keys/UUIDs stay unchanged during repair | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-X01 |
| P0C2-X02 | Separate research persona gets guardian approval; actual research fallback is read-only | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-X02 |
| P0C2-X03 | PM real roundtrip denominator 12/0; planned 0 | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-X03 |
| P0C2-X04 | PM real roundtrip denominator 12/12; planned 0 | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-X04 |
| P0C2-X05 | PM real roundtrip denominator 6/2; planned 0 | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-X05 |
| P0C2-X06 | PM real roundtrip denominator 0/0; planned 2 | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-X06 |
| P0C2-X07 | PM real roundtrip denominator 6/2; planned 0 | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-X07 |
| P0C2-G01 | OS-terminated child after actual raw commit;20 raw/0 derivations; durable intent retained | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-G01 |
| P0C2-G02 | New repair-batch process resumed same reviewed plan;20 exact raw/UUID/content and20 current derivations; main unchanged | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-G02 |
| P0C2-G03 | Two independent repair processes plus final retry converge; source/IDs unchanged; no duplicate raw/current derivations | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-G03 |
| P0C2-R01 | Rollback reproduces42501 for fresh ordinary-user UPSERT RETURNING; forward succeeds and repeats same UUID; existing visibility unchanged for two guardians, two clinicians and anonymous; no RLS disabling or data rewrites | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-R01 |
| P0C2-R02 | Changed ordinary JWT role without resigning; real Auth and PostgREST reject | 新隔離DB／Auth／Participant policy；標準平台差異仍未解 | 是（原生） | PASS | BLOCKED | p0c3-test-evidence-2026-10-23.json # P0C2-R02 |

標準平台的gateway／Auth／role／grant與最新DDL未確認，影響多數案例，未來應完整重跑原28並按本表補34；不能把這次原生PASS轉填標準PASS。新Participant10及Browser10也必須在相容平台重測。

## 最小程式修改與新增回歸

本輪僅改[src/utils/resultSync.js](../src/utils/resultSync.js)的switchResultMirrors及auth callback，與[src/utils/resultSync.test.js](../src/utils/resultSync.test.js)四項測試。解決有效Browser-08發現的共享顯示快取；來源outbox、原Trial、IDs與正式規則不改。四項測試涵蓋：A/B切換與原帳號還原；同帳號重開／未知舊owner；第二分頁自己的sessionStorage；另一分頁先移走key時不以null覆寫封存。

其他新增是測試頁／Playwright私有runner、唯讀SQL及報告。既有04 RLS forward／rollback與01/02/03沒有本輪改寫，未加入正式Migration。C2輸入35個artifact的SHA-256逐一驗證未被覆寫。

## 回歸結果與規則保護

- 最終完整CRA：**85套件／660測試／4快照PASS**，185.592秒；比C2增加4個有實測缺陷依據的測試。
- Node驗收工具：44／44 PASS。
- resultSync.js／test ESLint與git diff --check PASS。Browserslist資料較舊提示沒有導致失敗，未擴大更新依賴。
- [871個受保護檔案等價性](p0c3-equivalence-2026-10-23.json)：unexpectedChangedFiles=[]；六正式TestPage、protocol／scoring／副本／素材、RAG／UCB1未改。前輪P0允許的研究／同步改動仍在，未reset既有工作區。
- 實測原生62、Participant10、瀏覽器子流程10的最終結果無未修正FAIL；早期測試設定錯誤及有效Browser-08失敗保留，沒有累加進PASS。

回歸不能替代完整UI／裝置／標準平台／最新正式catalog驗證。封存讀取邊界與未知owner回復仍應納入完整共享裝置驗收，不宣稱同origin資料已加密。


逐案結果、環境、時間及原始證據 SHA-256：[機器證據](p0c3-test-evidence-2026-10-23.json)。UTC時間以Z標示；台灣時間為UTC+8。本輪未操作正式資料庫、正式Auth／Storage／環境變數，沒有push或部署。私有 .tmp/p0c3 內的憑證、profile與payload不納入Git／公開報告。
