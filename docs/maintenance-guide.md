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
- DOCX 只能在使用者按下匯出後 `import("docx")`。
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
7. DOCX 只在點擊匯出時載入並可正常下載。

## 7. 2026-08-09 驗證基線

- Jest：26 suites、104 tests 全數通過。
- Production build：成功，無 ESLint warning。
- Main bundle：58.98 kB gzip。
- Deployment：180.09 MiB，通過容量、source map、LFS 與禁止路徑檢查。
- 瀏覽器 smoke test：本次執行環境沒有可用的 in-app browser，尚待人工執行上述 7 項。
- 已知工具鏈提示：`react-scripts 5` 使用 deprecated `fs.F_OK`；規劃遷移 Vite 時處理。
