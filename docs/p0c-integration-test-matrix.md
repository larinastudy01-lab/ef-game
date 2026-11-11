# P0-C 隔離整合測試矩陣

**整體 BLOCKED。原 28 項：PASS 0、FAIL 0、BLOCKED 28、NOT RUN 0。** 2026-10-23 本輪沒有資料庫寫入或連線測試。

原 ID、名稱及預期逐字保留自 [P0-B catalog](p0b-integration-cases-2026-10-23.json)；不把補充情境重新湊成 28 項。
E1 = [本輪離線環境證據](p0c-environment-2026-10-23.json)：沒有可確認隔離目標／runtime，所有原案例未執行。
原腳本：[isolated-integration.test.cjs](../scripts/p0/isolated-integration.test.cjs)。
本機 catalog 測試只註冊名稱、不執行 callbacks，證明名稱／ID 對齊，不證明資料庫行為。

| ID | 測試項目（原名稱） | 預期結果（原定義） | 實際結果 | 狀態 | 證據 |
|---|---|---|---|---|---|
| P0B-I01 | LB: full write, exact raw readback and duplicate submission | One main/session/task, exact unique raw and current derivations; repeated submission retains IDs/content | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I02 | PM: full write, exact raw readback and duplicate submission | One main/session/task, exact unique raw and current derivations; repeated submission retains IDs/content | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I03 | CBT: real schema accepts the current task code | Main, task, raw and derived rows written; raw answer and summary unchanged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I04 | SRT: real schema accepts the current task code | Main, task, raw and derived rows written; raw answer and summary unchanged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I05 | ARI: real schema accepts the current task code | Main, task, raw and derived rows written; raw answer and summary unchanged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I06 | DCCS: real schema accepts the current task code | Main, task, raw and derived rows written; raw answer and summary unchanged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I07 | game_results: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I08 | behavioral_sessions: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I09 | behavioral_task_sessions: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I10 | behavioral_trials: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I11 | behavioral_trial_derivations: one interrupted request stays pending and a new client retries | No false success, source retained, a fresh client fills the complete hierarchy | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I12 | lost raw insert acknowledgement retries without duplicate IDs or source keys | Retry converges to 20 original raw rows and 20 current derived rows | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I13 | existing session plus partial trial checkpoint fills remaining trials | Existing seven IDs/content retained, thirteen rows added | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I14 | real unique constraint rejects duplicate source key and leaves raw answers intact | 23505 and no raw changes | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I15 | anonymous/other guardian cannot read or attach a raw trial to this session | No foreign rows visible; insertion denied; original dataset unchanged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I16 | guardian cannot rewrite a saved raw answer through PostgREST | Stored acquisition data unchanged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I17 | existing session survives a later main-result failure and can retry | Previous hierarchy retained and retry completes | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I18 | full main payload with only seven committed trials stays pending and fills the remaining thirteen | Main remains pending until exact twenty-row readback succeeds; existing seven rows unchanged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I19 | final main acknowledgement failure keeps research data and retries the final status safely | Research retained, main pending, retry verifies full data before status acknowledgement | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I20 | two simultaneous sync clients converge after retry without duplicate trials | At least one succeeds; conflicts retry to one exact dataset | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I21 | legacy SSG remains readable without conversion to ARI | Raw stored/read code stays SSG | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I22 | ART: unrecognized task code still fails the real CHECK | 23514; hierarchy never falsely acknowledged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I23 | INVALID_TASK: unrecognized task code still fails the real CHECK | 23514; hierarchy never falsely acknowledged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I24 | unrelated nonnegative trial-count constraint remains enforced | 23514; original dataset unchanged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I25 | authorized researcher reads the complete hierarchy while an unauthorized clinician cannot | Authorized positive read on all six tables; unauthorized client sees no case rows | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I26 | own participant cannot be attached to another patient raw trial through a derivation | Both INSERT and UPDATE fail 42501, not an unrelated unique violation | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I27 | reviewed isolated repair is repeatable and retains old derivation versions and main status | Verified count/IDs/content, old version retained, historical main payload/status unchanged | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |
| P0B-I28 | an owned participant cannot link a different patient main result through a session | INSERT/UPDATE fail 42501, not a duplicate source-result constraint | 未連線、未執行 | BLOCKED | E1；原腳本以同名 test 對應 |

## 要求與原案例的對照

| 要求 | 原案例 | 尚需補充 |
|---|---|---|
| C1 階層／來源資料 | I01–I06、I13–I14、I18、I26、I28 | X12：全部關聯、序號、處理版本與研究端往返逐欄核對 |
| C2 同步／失敗／重試 | I07–I13、I17–I20 | X09–X11：修復程序真重啟、跨程序並行、實體故障 |
| C3 PostgREST／權限 | I15–I16、I25–I26、I28 | X01–X02：獨立研究 persona、撤銷與全部 REST/RPC 路徑 |
| C4 歷史／相容／舊版本 | I13、I18、I21、I27 | X03–X08、X12：遷移、ARI 修復、舊鍵、衝突、fallback、狀態／順序 |
| D 合成資料完整性 | I01–I06、I27 | 新 p0c-fixtures.cjs 提供 LB/PM/CBT/ARI 離線資料；尚未接入並實測 X04/X08 |
| E 身分隔離 | I15–I16、I25–I26、I28 | 四個普通帳號並未涵蓋獨立研究 persona；不可冒稱六角色已測 |
| G 故障／回復 | I07–I14、I18–I20、I26–I28 | 明確區分 fetch 注入、部分合成 checkpoint 與實體斷線／程序故障 |

下表是額外需求的**驗收規格**；並非已存在且已執行的自動測試。

| 補充 ID | 測試項目 | 原 28 項的缺口 | 預期結果 | 狀態 | 證據／限制 |
|---|---|---|---|---|---|
| P0C-X01 | 獨立研究人員 persona；有／無授權，各層正負向讀寫 | I25 使用 clinician，不能當作獨立研究人員；目前 role 契約未定義 researcher | 先決定普通帳號對研究用途的權限契約；禁止 admin/service role 代替 | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X02 | 撤銷授權後，同 JWT／新 client 立即重查所有階層與寫入 | I25 只有既有授權正負向；未呼叫 revoke_patient_access | 前次可讀、撤銷後不可讀寫；直接 REST/RPC 一併驗證 | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X03 | 兩張 ARI CHECK 的 forward、重跑、rollback、再 forward | I05 僅驗證目前 code 可寫，不驗證遷移本身 | 遷移前 ARI 拒絕；遷移後接受；其他 CHECK/FK/Unique/RLS/trigger 不變；有 ARI 時拒絕不安全 rollback | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X04 | ARI 歷史形狀合成資料的審閱計畫與重複補齊 | I27 只有 LB；不得拿真實 ARI payload 當 Fixture | 保留主結果、原 UUID、來源；兩次補齊逐欄一致，衍生版本可追溯 | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X05 | 舊 LB stepIndex 鍵／原 UUID 已存在時的相容補齊 | I13/I18 為目前來源鍵，未涵蓋舊鍵遷移 | 可證明同一來源才沿用；內容有歧義停止；不得刪舊 raw 或改寫唯一約束 | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X06 | 來源鍵或 UUID 相同但 raw 內容不同 | I14 是資料庫唯一約束；不等於補齊流程的內容衝突 | 修復拒絕，主結果不得 falsely verified；既存來源完全不變 | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X07 | 真實研究端 fallback：已存在 Session、缺少部分 Trial | I13/I18 補齊；沒有以研究讀取入口實測 | 有授權讀取補齊來源；計數、順序及內容一致；讀取本身不寫入 | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X08 | PM 逾時／未施測與 CBT 提前停止的真實資料庫往返 | I02 無逾時、I03 為 transport-only；離線 Fixture 不代表 DB 通過 | 保留原事件；只計已施測的逾時母體；零母體 null；RT 排除不抹除逾時；CBT 不新增未施測答案 | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X09 | 修復 child process 在部分提交後被終止，再以原 journal/plan 重啟 | I07–I11 是 fetch 中斷加新 client；I27 無程序中止 | intent 已 fsync；原 IDs 恢復；不信任成功標籤；每筆重新完整讀回 | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X10 | 兩個獨立程序並行修復同一來源 | I20 為同程序兩個 client 的同步 | 衝突後安全重試；唯一來源無重複；不覆寫來源或舊衍生版本 | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X11 | 實體網路中斷／回復與應用程式或瀏覽器重啟 | Node fetch 注入不能等同實體斷線／共享裝置驗收 | 待傳資料保留、身分綁定、回復後逐筆驗證；不能先清 outbox | BLOCKED | 規格／人工步驟待實作執行；E1 |
| P0C-X12 | 逐筆完整資料契約與合成清理演練 | verify 已比 raw UUID/內容、數量、摘要；尚未逐欄比全部關聯/ordinal/版本與實際清理 | 比 Session/Main/Participant/Task/Trial IDs、代碼、ordinal、key、刺激/答案/正確/RT/timeout/admin/version；清理只限核對過的隔離資源 | BLOCKED | 規格／人工步驟待實作執行；E1 |

## 下次執行的證據要求

每項須留下目標 ref/origin、真實 PostgreSQL/PostgREST/Auth/CLI 版本、Schema catalog 前後摘要、普通身分與授權狀態、精確 SQLSTATE、資料提交檢查點、去識別讀回差異及 JUnit/TAP。
一般使用者測試不得帶 service role。負向測試須搭配同身分正向讀取，避免把無效 JWT 或空資料當成 RLS 成功。
部分 Trial 情境是額外提交七筆 checkpoint；不聲稱 PostgreSQL 單一 INSERT batch 會部分提交。
證據含身分識別碼時留在忽略版控的 artifacts/p0c；公開報告只保留雜湊參照與狀態。
