# Supabase 網路資料庫連接設定

## 1. 建立 Supabase 專案
到 Supabase 建立新專案後，進入 Project Settings → API，複製：

- Project URL
- anon public key

## 2. 建立 `.env`
把 `.env.example` 複製成 `.env`，填入：

```env
REACT_APP_SUPABASE_URL=https://你的-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=你的-anon-public-key
```

修改 `.env` 後請重新啟動 React：

```bash
npm start
```

## 3. 建立資料表
到 Supabase → SQL Editor，貼上 `supabase_schema.sql` 全部內容並執行。

這份 SQL 會建立：

- `profiles`：帳號角色，例如 guardian / clinician
- `patients`：孩子資料
- `game_results`：測驗與訓練結果
- `clinician_patient_access`：醫療端可查看哪些孩子
- `clinician_notes`：醫療端備註
- `parent_reminders`：醫療端提醒家長

## 4. 目前已串接的地方

- `RegisterPage.jsx`：註冊後寫入 `profiles`
- `LoginPage.jsx` / `ClinicianLoginPage.jsx`：登入後依角色分流
- `ChildSelectPage.jsx`：孩子角色卡優先讀寫 Supabase `patients`，失敗時保留 localStorage 備援
- `resultManager.js`：每次遊戲結果會先存 localStorage，再非同步同步到 Supabase `game_results`
- `ClinicianDashboard.jsx`：會讀取 `game_results` 結果資料

## 5. 醫療端看得到孩子資料的方法
目前醫療端只會看到 `clinician_patient_access` 有授權的孩子。

可以先在 Supabase SQL Editor 手動新增授權：

```sql
insert into public.clinician_patient_access (clinician_id, patient_id)
values ('醫療端使用者 uuid', '孩子 patient uuid');
```

之後可以再做成家長端「授權醫療人員」按鈕。
