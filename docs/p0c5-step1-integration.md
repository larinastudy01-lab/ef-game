# 蒐秘密｜P0-C5 Step 1 逐案整合結果

診斷 2026-10-24T07:06:34.4325444Z～2026-10-24T07:06:44.2517995Z；CLI 嘗試 2026-10-24T07:09:02.188Z～2026-10-24T07:09:05.427Z（UTC，臺灣日期 2026-10-24）。Git 8ef96ff4100533907bd4c2549a0c018b0553f345 加既有未提交工作樹。

**BLOCKED。標準 Supabase Local 未啟動；本輪資料庫案例 PASS 0／FAIL 0／BLOCKED 72，實際執行 0。**

E1 = [本輪機器證據](p0c5-step1-evidence.json)，內含診斷、兩次 CLI 呼叫與私有原始檔 SHA-256。

所有案例環境皆為「標準 Supabase Local 尚未建立」，實際結果都是未執行，失敗原因均為 E1：缺少 Docker／Podman，且 WSL 未安裝。表格逐案保留原 ID；期望來自原 catalog／既有實際腳本的斷言。C4 歷史原生 PASS 及證據雜湊另存在機器證據 historicalNativeEvidence，未抄作本輪 PASS。

| 群組 | 原定案例 | 本輪實際執行 | PASS | FAIL | BLOCKED |
| --- | --- | --- | --- | --- | --- |
| 原始 | 28 | 0 | 0 | 0 | 28 |
| 補充 | 34 | 0 | 0 | 0 | 34 |
| Participant | 10 | 0 | 0 | 0 | 10 |
| 總計 | 72 | 0 | 0 | 0 | 72 |


## 原 28 案

| 原 ID | 案例 | 預期結果 | 實際結果／狀態 | 證據／原因 |
| --- | --- | --- | --- | --- |
| P0B-I01 | LB: full write, exact raw readback and duplicate submission | One main/session/task, exact unique raw and current derivations; repeated submission retains IDs/content | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I02 | PM: full write, exact raw readback and duplicate submission | One main/session/task, exact unique raw and current derivations; repeated submission retains IDs/content | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I03 | CBT: real schema accepts the current task code | Main, task, raw and derived rows written; raw answer and summary unchanged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I04 | SRT: real schema accepts the current task code | Main, task, raw and derived rows written; raw answer and summary unchanged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I05 | ARI: real schema accepts the current task code | Main, task, raw and derived rows written; raw answer and summary unchanged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I06 | DCCS: real schema accepts the current task code | Main, task, raw and derived rows written; raw answer and summary unchanged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I07 | game_results: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I08 | behavioral_sessions: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I09 | behavioral_task_sessions: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I10 | behavioral_trials: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I11 | behavioral_trial_derivations: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I12 | lost raw insert acknowledgement retries without duplicate IDs or source keys | Retry converges to 20 original raw rows and 20 current derived rows | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I13 | existing session plus partial trial checkpoint fills remaining trials | Existing seven IDs/content retained, thirteen rows added | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I14 | real unique constraint rejects duplicate source key and leaves raw answers intact | 23505 and no raw changes | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I15 | anonymous/other guardian cannot read or attach a raw trial to this session | No foreign rows visible; insertion denied; original dataset unchanged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I16 | guardian cannot rewrite a saved raw answer through PostgREST | Stored acquisition data unchanged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I17 | existing session survives a later main-result failure and can retry | Previous hierarchy retained and retry completes | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I18 | full main payload with only seven committed trials stays pending and fills the remaining thirteen | Main remains pending until exact twenty-row readback succeeds; existing seven rows unchanged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I19 | final main acknowledgement failure keeps research data and retries the final status safely | Research retained, main pending, retry verifies full data before status acknowledgement | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I20 | two simultaneous sync clients converge after retry without duplicate trials | At least one succeeds; conflicts retry to one exact dataset | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I21 | legacy SSG remains readable without conversion to ARI | Raw stored/read code stays SSG | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I22 | ART: unrecognized task code still fails the real CHECK | 23514; hierarchy never falsely acknowledged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I23 | INVALID_TASK: unrecognized task code still fails the real CHECK | 23514; hierarchy never falsely acknowledged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I24 | unrelated nonnegative trial-count constraint remains enforced | 23514; original dataset unchanged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I25 | authorized researcher reads the complete hierarchy while an unauthorized clinician cannot | Authorized positive read on all six tables; unauthorized client sees no case rows | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I26 | own participant cannot be attached to another patient raw trial through a derivation | Both INSERT and UPDATE fail 42501, not an unrelated unique violation | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I27 | reviewed isolated repair is repeatable and retains old derivation versions and main status | Verified count/IDs/content, old version retained, historical main payload/status unchanged | 未執行／BLOCKED | E1：無 container runtime |
| P0B-I28 | an owned participant cannot link a different patient main result through a session | INSERT/UPDATE fail 42501, not a duplicate source-result constraint | 未執行／BLOCKED | E1：無 container runtime |

## 補充 34 案

| 原 ID | 案例 | 預期結果 | 實際結果／狀態 | 證據／原因 |
| --- | --- | --- | --- | --- |
| P0C2-M01 | Ordinary Auth JWT/PostgREST ARI sync before migration | 舊六碼 CHECK 下普通 JWT 寫入 ARI 回 23514；來源及 pending 保留。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-M02 | Exact forward draft on real PostgreSQL | 精確執行 01 草案；只擴充兩張 task_code CHECK，其餘 catalog 不變。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-M03 | Forward repeat | 重跑 forward，catalog 與來源資料不變。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-M04 | Rollback before ARI CHECK-bound rows exist | 沒有受約束 ARI row 時，rollback 精確還原已保存的舊 CHECK；不刪來源。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-M05 | Forward then retry original ARI source | 再次 forward 後重試同一 ARI 來源，四筆原 UUID／raw 與完整階層一致。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-M06 | Rollback with ARI rows retained | 已有 ARI row 時安全拒絕 rollback，保留資料與擴充 CHECK。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-M07 | Direct ordinary-user task insertion: null | NULL task_code 仍受 NOT NULL 約束拒絕（23502）。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-M08 | Direct ordinary-user task insertion: ART | ART 仍回 23514，不映射成 ARI。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-M09 | Direct ordinary-user task insertion: INVALID_TASK | INVALID_TASK 仍回 23514。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-M10 | Exact restrictive binding drafts 02/03 | 精確施加 02／03 restrictive policies；配合 I26／I28 驗證跨綁拒絕。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H01 | A + falsely synced: dryRun is read-only, repair, then verified acknowledgement | dryRun 零寫入；修復後 20 筆原 IDs／順序／raw／derived 逐欄一致；僅正常完整同步才 ACK。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H02 | E: already complete repair remains idempotent and keeps old derivations | 完整資料重修具冪等性，舊衍生版本保留且不新增 raw。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H03 | Partial raw checkpoint repairs exactly the missing 13 of 20 | 原七筆 raw／UUID／內容不變，只補十三筆並驗證二十筆 current derivations。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H04 | C: LB ambiguous/unmapped source refuses automatic repair | LB 來源有歧義時拒絕自動修復，不猜映射或補造 Trial。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H05 | C: SSG ambiguous/unmapped source refuses automatic repair | SSG 來源有歧義時拒絕自動修復，不轉 ARI。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H06 | C: DPT ambiguous/unmapped source refuses automatic repair | DPT 來源有歧義時拒絕自動修復，不轉 ARI。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H07 | D: insufficient source never invents missing trials | 宣告十二題但 raw 為零，拒絕補造並保留原來源。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H08 | Conflicting source content is rejected without overwriting raw/main | 來源內容衝突時拒絕修復，不覆寫 raw 或 main。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H09 | PM timeout/cancellation/planned status survives real DB roundtrip | PM 十四個 slot、十二題已施測、三題逾時為 25%；兩題 planned 排除，raw 保留。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H10 | CBT early-stop and unadministered slots remain distinct | CBT 已施測與 planned 分開；保留 earlyStop，不補造未施測答案。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H11 | B: migrated synthetic ARI history repair is repeatable | ARI 歷史合成形狀重複修復保持四筆原 UUID／代碼／來源及 main。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-H12 | Revocation removes same-JWT and fresh-client access across six tables | 實際 guardian revoke RPC 後，同 JWT 與新 client 均無六表存取；raw insert 拒絕。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-X01 | Unambiguous old LB source keys/UUIDs stay unchanged during repair | 無歧義 LB 舊鍵／三個 UUID／raw 保留，衍生指向原 UUID，重跑無重複。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-X02 | Separate research persona gets guardian approval; actual research fallback is read-only | 獨立普通研究 persona 經 guardian 授權才可讀；實際研究 fallback 由七補讀二十且零寫入；撤銷後拒絕。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-X03 | PM real roundtrip denominator 12/0; planned 0 | PM 已施測十二題／逾時零題：0%。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-X04 | PM real roundtrip denominator 12/12; planned 0 | PM 已施測十二題／逾時十二題：100%。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-X05 | PM real roundtrip denominator 6/2; planned 0 | PM 已施測六題／逾時兩題：2/6。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-X06 | PM real roundtrip denominator 0/0; planned 2 | 只有兩個 planned：分母零，rate=null、status=not_calculable_no_administered_trials。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-X07 | PM real roundtrip denominator 6/2; planned 0 | PM 六題／逾時兩題同時有其他分析排除，逾時率仍 2/6。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-G01 | Repair child OS termination after raw commit | 真實 raw 提交後 OS 終止修復程序；二十 raw／零 derivations 與 fsync intent 保留。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-G02 | Fresh process resumes same plan and journal | 新程序沿同一核准 plan／journal 重試，原 raw／UUID／內容不變，補足二十 current derivations。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-G03 | Independent concurrent repair processes plus retry | 兩個獨立修復程序加最後重試收斂，原來源／IDs 不變且無重複。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-R01 | Participant policy rollback/forward and unchanged visibility | rollback 重現新 INSERT RETURNING 42501；forward 後成功且 UUID 冪等；五身分既有可見集合不變。 | 未執行／BLOCKED | E1：無 container runtime |
| P0C2-R02 | Forged JWT role rejected by Auth and PostgREST | 竄改普通 JWT role 而不重簽，真實 Auth 及 PostgREST 拒絕；搭配有效 JWT 正向對照。 | 未執行／BLOCKED | E1：無 container runtime |

## Participant 10 案

| 原 ID | 案例 | 預期結果 | 實際結果／狀態 | 證據／原因 |
| --- | --- | --- | --- | --- |
| Participant-01 | 合法家長建立自己的 Participant | 普通 guardian 對自己的 patient 新建 Participant 並成功 RETURNING。 | 未執行／BLOCKED | E1：無 container runtime |
| Participant-02 | 合法 INSERT 後允許 RETURNING | 同一 patient upsert returning 取得相同 UUID，沒有多餘 row。 | 未執行／BLOCKED | E1：無 container runtime |
| Participant-03 | 家長A不能建立／取得家長B Participant | A 不可代 B 建立或讀取 Participant；B 自身正向建立成功。 | 未執行／BLOCKED | E1：無 container runtime |
| Participant-04 | 匿名不能建立 Participant | 匿名 INSERT 被拒絕，沒有新增資料。 | 未執行／BLOCKED | E1：無 container runtime |
| Participant-05 | 無授權專業端不能建立個案 Participant | 無個案授權 clinician 不可建立 Participant。 | 未執行／BLOCKED | E1：無 container runtime |
| Participant-06 | SELECT 不暴露其他個案 | 兩家長可讀自己的合法資料，互不可讀對方個案。 | 未執行／BLOCKED | E1：無 container runtime |
| Participant-07 | UPDATE 不繞過個案限制（minimal與returning） | minimal PATCH 與 returning PATCH 均不可跨 patient relink，原 FK 不變。 | 未執行／BLOCKED | E1：無 container runtime |
| Participant-08 | 舊有合法 Participant 可讀 | 修正前已存在的合法 Participant 仍可讀。 | 未執行／BLOCKED | E1：無 container runtime |
| Participant-09 | rollback 前置條件與影響 | rollback 還原精確舊 policy 並重現已知限制；forward 恢復；不改來源。 | 未執行／BLOCKED | E1：無 container runtime |
| Participant-10 | API 回傳與實際 DB 內容一致 | API 回傳所有欄位與實際 PostgreSQL row JSON 一致。 | 未執行／BLOCKED | E1：無 container runtime |

## 尚未實作／執行的額外必要範圍

P0C5-F-DELETE 與 P0C5-E-FK 都是 BLOCKED，不併入原 72，也不取代原案例。規格與原因見 [Schema 報告](p0c5-step1-schema.md)。

原 28 runner 為 scripts/p0/isolated-integration.test.cjs。補充與 Participant 原 runner 仍在 .tmp/p0c4，包含 native-db.cjs 身分驗證與本機 SQL helper；不能直接換 URL 就當標準 stack runner。實例建立後需接入標準容器／DB adapter，保留原 ID、前後 catalog 比較、SQLSTATE、普通 JWT 正負向、同 UUID／raw 比對及程序恢復斷言，再完整重跑 72。這個 adapter 本輪未假造或以 Mock 取代。

本輪沒有重跑 C4 原生 72 案，也沒有為未建立的標準環境生成 PASS JUnit。只有官方 CLI 的 start／status 兩次真實呼叫及既有離線 gate 拒絕驗證；不是資料庫整合通過數。未改應用程式，因此沒有重新執行既有 674 項單元測試或把 C4 回歸當成本輪結果。
