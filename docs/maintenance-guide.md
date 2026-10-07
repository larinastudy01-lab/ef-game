# 維護與驗證指南

更新日期：2026-08-09

本文件記錄目前專案的重要維護邊界。修改前先確認所屬責任，修改後執行文末驗證流程。

## 1. 重要架構邊界

```text
React routes
  -> ProtectedRoute（頁面進入體驗）
  -> page/controller（查詢、狀態與業務流程）
  -> presentation components（純畫面與事件轉發）
  -> Supabase Auth + RLS（真正的資料授權）
```

- `src/App.js`：路由與全站設定，不放臨床查詢邏輯。
- `src/components/ProtectedRoute.jsx`：驗證登入與角色，但不能取代 RLS。
- `src/pages/ClinicianDashboard.jsx`：醫療端流程 controller；新增畫面區塊時，優先放到 `src/components/clinician/`。
- `src/lib/database.js`：Supabase 資料存取入口。
- `supabase/migrations/`：資料授權與 schema 的可追蹤來源。

## 2. 權限與醫療資料

醫療／研究路由允許 `clinician`、`medical`、`doctor`。前端 route guard 只負責避免未授權頁面短暫顯示；資料表、RPC 與 Storage 必須另外用 Supabase RLS、`auth.uid()`、`is_professional()` 和 `can_access_patient()` 驗證。

修改權限時必須同時確認：

1. React route 是否需要角色限制。
2. 頁面查詢是否只取得必要欄位。
3. RLS 是否限制到本人或已連結病患。
4. RPC 是否撤銷 public 權限並只授權 authenticated。
5. React client 不得出現 service-role key。

驗證失敗應採 fail-closed，不可先渲染病患資料再導頁。

## 3. 瀏覽器儲存與舊版相容

目前兒童／病患身分統一由 `src/utils/activePatientStorage.js` 管理：

- Canonical keys：`ef_active_patient`、`ef_active_patient_id`。
- Schema version：`ef_active_patient_version=1`。
- 舊版 aliases 暫時採 write-through，因部分遊戲頁仍直接讀取舊 key。
- 讀到舊 profile、ID-only 資料或損壞 canonical JSON 時，會使用有效備援並嘗試 migration。
- localStorage 無法寫入時會嘗試 sessionStorage。

不要在新程式直接新增另一組 `currentChild*` 或 `selectedPatient*` key。移除 legacy aliases 前，必須先用 `rg` 確認所有遊戲頁都已搬到 canonical API。

兒童遊戲快照格式：

```json
{
  "version": 1,
  "childId": "patient-id",
  "values": {}
}
```

還原時必須核對 `childId`，避免把一位兒童的未完成進度套到另一位兒童。

## 4. 元件拆分原則

展示元件可以接收資料和 callback，但不應直接：

- 建立 Supabase client 或查詢病患資料。
- 修改評分、風險、建議或研究公式。
- 自行決定登入與角色授權。
- 建立新的 localStorage 相容 key。

`ClinicianDashboardShell.jsx` 目前負責 header、新增兒童 modal、錯誤提示和統計卡；資料行為仍由 dashboard controller 負責。後續優先拆分病患清單、紀錄表格、趨勢區與 AI 助手。

## 5. 效能與部署

- 頁面使用 `React.lazy`；醫療 route guard 也必須保持 lazy，避免 Supabase 進入首頁 bundle。
- Excel 只能在使用者按下匯出後 `import("../utils/clinicianExcelExport")`。
- BGM 使用 `preload="none"`。
- GitHub Actions 直接部署 `build/`，不依賴 tracked `site/`。
- `scripts/check-deployment.mjs` 預設限制 build 190 MiB、單檔 24 MiB，並拒絕 source map、LFS pointer 和禁止目錄；可用 `MAX_DEPLOYMENT_MIB`、`MAX_ASSET_MIB` 明確調整。

目前 `site/` 與未引用的 `src/asset/fonts/Regular.ttf` 尚未刪除，因 material deletion 仍需明確批准。兩者都不是 production build 的來源。

## 6. 必跑驗證

一般修改：

```bash
npm run check
```

這會依序執行資產引用、完整 Jest 測試、production build 與部署檢查。權限、儲存 migration 或分析公式變更時，必須另外新增對應測試，不能只依靠 build 成功。

人工瀏覽器 smoke test：

1. 首頁可載入，設定按鈕可開關。
2. 設定頁儲存後返回，離頁後沒有延遲跳轉或 console warning。
3. 未登入直接進入 `/clinician-dashboard` 會導向 `/clinician-login`。
4. 家長帳號不能開啟醫療／研究頁。
5. 醫療帳號可開啟六個受保護路由，登出後立即失去存取權。
6. 切換兒童後，未完成進度與結果不會跨兒童出現。
7. Excel 只在點擊匯出時載入並可正常下載。

## 7. 2026-08-09 驗證基線

- Jest：26 suites、104 tests 全數通過。
- Production build：成功，無 ESLint warning。
- Main bundle：58.98 kB gzip。
- Deployment：180.09 MiB，通過容量、source map、LFS 與禁止路徑檢查。
- 瀏覽器 smoke test：本次執行環境沒有可用的 in-app browser，尚待人工執行上述 7 項。
- 已知工具鏈提示：`react-scripts 5` 使用 deprecated `fs.F_OK`；規劃遷移 Vite 時處理。

## 8. 測驗本機保存與自動補傳

- 六種正式測驗共用 `src/utils/useTestAttempt.js`：開始時保存，每題作答後更新快照；離開頁面時記為 `interrupted`。完成與中斷都保留同一個 `resultId`、session ID 與 trial ID。
- `src/utils/resultSync.js` 以 `efGameResultOutbox:<resultId>` 保存待上傳資料。此佇列不受 `efGameResults` 最近 200 筆的顯示上限影響；切換兒童或重設測驗流程也不會刪除它。
- 完成結果（包括訓練結果）先寫入本機佇列，再嘗試上傳。連線恢復、登入／更新登入狀態、回到頁面或每 30 秒會觸發補傳；只有 `game_results` 回覆成功才移除待上傳紀錄並標示 `synced`。失敗或未登入會保留資料。
- 佇列綁定原家長帳號，上傳前再核對 Supabase 登入者。帳號不同時保留原資料；若離線初始登入尚未取得帳號，會先從資料庫確認兒童的 `guardian_id` 才能綁定。以 `resultId` upsert，重試不會新增另一筆。上傳途中若快照更新，舊回覆不會刪除新版。
- 正在進行的測驗每 15 秒更新存活時間，並在支援的瀏覽器使用 Web Locks 保護背景分頁。重新開啟時回收失去分頁的快照；未支援 Web Locks 的瀏覽器，其他分頁的快照超過 60 秒未更新才視為中斷。
- 中斷快照不寫入完成／解鎖用的 legacy keys。雲端 payload 與行為資料表保留 `interrupted`；家長與醫療端標示未完成，完成次數、平均與趨勢只使用完成紀錄。
- 本機容量不足或瀏覽器禁止儲存時，畫面會提示儲存失敗。不可把 sessionStorage 備援當成已完成永久本機保存。

網站開著且網路／登入／資料庫權限有效時，連線恢復就會觸發上傳。所有分頁關閉時，網頁程式不能繼續執行，會在下次開啟網站後補傳；清除網站資料、使用無痕模式，或尚未完成寫入就當機，仍可能失去本機資料。本功能不包含離線載入整個網站、恢復原遊戲畫面，或在瀏覽器完全關閉後背景上傳。`game_results.payload` 已能存放狀態，不需要新增資料表。

驗證至少涵蓋離線後重連、重新開啟、帳號切換、上傳失敗、舊上傳回覆／新快照競爭、超過 200 筆待上傳、儲存失敗，以及中斷紀錄不計入完成成績。
