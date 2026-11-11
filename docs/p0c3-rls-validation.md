# P0-C3 Participant INSERT RETURNING 驗證

**原生環境10／10 PASS；標準Supabase等價驗證BLOCKED**。實際執行時間 2026-10-23T13:55:54.602Z 至 2026-10-23T13:55:56.805Z，目標 p0c3_isolated_1acdf11c3f9a／http://127.0.0.1:55331。沒有使用Service Role做權限測試。

## 根因、最小SQL與合法邊界

原SELECT policy：USING(public.can_read_research_participant(id))。該STABLE SECURITY DEFINER helper回查research_participants；新INSERT RETURNING時看不到剛插入列，合法guardian也回42501。INSERT policy原本要求patient.guardian_id=auth.uid()；UPDATE原USING／WITH CHECK維持原樣。

修正只把SELECT USING改為public.can_access_patient(patient_id)，不讓所有authenticated讀全部Participant。patient_id仍NOT NULL＋UNIQUE＋FK；原INSERT、UPDATE、其他階層policy、grant均未移除。實際SQL：[04 forward](../scripts/p0/sql/04-participant-returning.draft.sql)、[04 rollback](../scripts/p0/sql/04-participant-returning.rollback.draft.sql)；原DDL與helper見[rebuild04](../supabase/rebuild/04_CREATE_RESEARCH_RECOMMENDATION.sql)。

| 案例 | 要求／實際API | 狀態 | 實際結果 |
| --- | --- | --- | --- |
| Participant-01 | 合法家長建立自己的 Participant | PASS | Real INSERT SELECT succeeds after old42501; ordinary guardian JWT |
| Participant-02 | 合法 INSERT 後允許 RETURNING | PASS | UPSERT SELECT returns the same UUID and own patient; no extra row |
| Participant-03 | 家長A不能建立／取得家長B Participant | PASS | Cross INSERT42501; cross SELECT empty; guardian B positive INSERT succeeds |
| Participant-04 | 匿名不能建立 Participant | PASS | Anonymous INSERT42501; no row added |
| Participant-05 | 無授權專業端不能建立個案 Participant | PASS | Ordinary ungranted clinician INSERT42501 |
| Participant-06 | SELECT 不暴露其他個案 | PASS | Positive own reads + negative foreign reads for both guardians |
| Participant-07 | UPDATE 不繞過個案限制（minimal與returning） | PASS | Both minimal and returning cross-patient UPDATE refused; original patient FK unchanged |
| Participant-08 | 舊有合法 Participant 可讀 | PASS | Unmodified prior legitimate participant still readable |
| Participant-09 | rollback 前置條件與影響 | PASS | Exact prior policy restored; fresh returning42501 reproduced; forward recovers; no source rewrite |
| Participant-10 | API 回傳與實際 DB 內容一致 | PASS | All returned columns match real PostgreSQL row JSON |

Participant-07包含不要求RETURNING的minimal PATCH，以及UPDATE SELECT；使用B另一個尚無Participant的patient避免UNIQUE碰撞掩蓋RLS。拒絕且原patient FK不動；當次摘要未另存此項SQLSTATE，不補造錯誤碼。原I26／I28另完整重跑並確認各自跨綁INSERT／UPDATE42501。

## 身分與回復

家長A／B、無授權clinician與anon皆經真實PostgREST，已搭配家長正向SELECT防止無效JWT造成假通過。Participant-09 rollback還原已觀察policy後重現新INSERT SELECT42501，再forward成功；舊合法Participant可讀。Participant-10把API所有回傳欄位與實際PostgreSQL row JSON逐欄比對。

另重跑P0C2-R01確認兩家長、兩clinician與anon既存可見集合前後不變；H12／X02驗證真實guardian授權、撤銷後同JWT與fresh client不可讀寫；R02偽造role不重新簽章被Auth／PostgREST拒絕。研究persona使用現行clinician角色契約，沒有發明researcher角色，也沒有驗證所有scope的最小組合。

rollback先檢查isolated target與已知policy；會恢復新Participant RETURNING失敗的已知限制，不刪資料。04未修改、未加入正式migration或部署。PostgreSQL會依操作套用SELECT及寫入policy，依據[PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)與[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。

仍待：最新正式policy／helper／owner／grants／JWT契約，以及同SQL在標準隔離Supabase的重測；目前無法宣稱04已在正式平台驗收。


逐案結果、環境、時間及原始證據 SHA-256：[機器證據](p0c3-test-evidence-2026-10-23.json)。UTC時間以Z標示；台灣時間為UTC+8。本輪未操作正式資料庫、正式Auth／Storage／環境變數，沒有push或部署。私有 .tmp/p0c3 內的憑證、profile與payload不納入Git／公開報告。
