# 蒐秘密｜P0-C4 最終驗收

產出：2026-10-24T05:29:20.388Z（UTC；臺灣日期 2026-10-24）。版本：8ef96ff4100533907bd4c2549a0c018b0553f345 加本輪未提交工作樹；逐檔 SHA-256 見[機器證據](p0c4-test-evidence-2026-10-24.json)。

環境：Windows、Node 24.15.0、Chrome 155.0.8059.85；全新原生 PostgreSQL 17.11／PostgREST 16.5／Auth v2.197.0 Windows 適配版。資料庫 p0c4_isolated_c0fc0a60735b，cluster ID 7699882706748678332；API 僅 127.0.0.1:55341。全部使用合成個案及獨立測試帳號，並非標準 Supabase 或正式環境。

**總判定 BLOCKED；品質分數維持 56／100。** 已完成可安全執行的原生資料庫、實際六遊戲、資料讀回與跨帳號／故障恢復工作；必要平台、正式唯讀與裝置證據仍不齊，不能宣稱正式環境驗收完成。

| # | 必答項目 | 最終回答 |
|---:|---|---|
| 1 | P0-C4 是否通過？ | 否，BLOCKED；未達完整平台及裝置成功標準。 |
| 2 | 標準 Supabase 等價性？ | 未完成；原生實測不能替代。 |
| 3 | Participant RLS？ | 原生 10/10 加 R01 PASS，標準／最新正式仍未知。 |
| 4 | ARI Migration？ | 原生 10/10 相容；正式最新 CHECK 尚未取得。 |
| 5 | 六遊戲 E2E 各多少？ | ARI1、DCCS1、PM1、CBT2、LB2、SRT1；後兩個含修正重測，共 8 次實際結果。媒體負向項目另列 NOT RUN。 |
| 6 | Trial 完整？ | 8 次結果共 342 Raw／current Derived，逐欄核對 8/8；不是整個 fixture cluster 的總數。 |
| 7 | 跨帳號安全？ | 指定八案例及普通身分 API／RLS、8 結果 URL 通過；只限已測範圍。 |
| 8 | A pending 能恢復？ | 能；實際 20 題原 owner／ID／內容不變，最後完整同步。 |
| 9 | 斷線遺失？ | 七案例未發現原始遺失；實體 Wi-Fi／行動 OS 未驗。 |
| 10 | 重試重複？ | 同一 source 最後 main1／Session1／Task1／Raw20／Derived20，raw hash 不變。 |
| 11 | IndexedDB／儲存？ | IDB 非 outbox 儲存實作，NOT RUN；真 quota、SecurityError、清理副本及帳號 pending 皆有明確範圍與證據。 |
| 12 | 哪些實體裝置？ | 只有 Windows 主機上的真 Chrome 自動化；Android／iPadOS／實體網路與觸控未完成。 |
| 13 | 最新正式 Schema？ | 未取得；OAuth refresh parse 失敗，未繞過使用者拒絕重新授權的決定。 |
| 14 | 歷史分類有改變？ | 未知，未重算正式資料；舊 100／1214／21 等不得當最新。 |
| 15 | 還有 P0 問題？ | 本輪實測的摘要、跨帳號、quota 提示及封存覆蓋已修正；正式權限／平台差異及未測媒體故障不可宣稱已排除。 |
| 16 | 本輪修改哪些？ | 摘要轉換、鏡像隔離與錯誤回報、結果授權閘門、入口 wrappers／穩定角色常數及必要測試；完整清單見回歸報告。 |
| 17 | 評測規則不變？ | 六 TestPage／Protocol／Scoring／素材未變；實際 SRT 八分鐘，PM／CBT 時限與停止規則均保留。 |
| 18 | 正式環境有變更？ | 0 寫入／Migration／補齊／狀態重設／Auth／Storage 變更／部署／push。 |
| 19 | 具備 P0-D 核准條件？ | 尚未；沒有自動進入 P0-D，也沒有正式修復授權。 |
| 20 | 不可省略的缺證？ | 標準 Supabase、最新正式 Schema／分類、必要實體裝置與實體網路、正式音訊及破圖負向 UI；完成後同規格重驗。 |

| 驗收文件 | 用途 |
|---|---|
| [Supabase parity](p0c4-supabase-parity.md) | 平台差異及 ARI／RLS |
| [Game E2E](p0c4-game-e2e-results.md) | 實際流程與逐欄讀回 |
| [Account isolation](p0c4-account-isolation.md) | 八帳號／角色案例及封存相容性 |
| [Network／storage](p0c4-network-storage-recovery.md) | 七網路與五儲存項目 |
| [Device validation](p0c4-device-validation.md) | 真裝置待辦與人工步驟 |
| [Production schema](p0c4-production-schema-review.md) | 唯讀阻擋與歷史方案 |
| [Regression](p0c4-regression-report.md) | 修改根因、前後差異與版本證據 |
| [Machine evidence](p0c4-test-evidence-2026-10-24.json) | 時間、狀態、來源與 SHA-256 |

清理：已核對 cluster／資料路徑／PID，停止本輪服務並移除本輪合成叢集及私有 junction；狀態 PASS。保留原始 UI／DB 私有 snapshot、測試工具與瀏覽器 profile 作證據；既有開發資料及正式未動。

剩餘風險：正式平台權限與最新 Schema 尚無實證；實體行動裝置／網路、媒體故障負向未驗；離線結果詳閱採拒絕顯示、未定義離線授權政策；歷史 LB／CBT 摘要與 PM 衍生資料修正仍需只讀盤點及獨立核准。不得用 674 個單元測試替代這些證據。
