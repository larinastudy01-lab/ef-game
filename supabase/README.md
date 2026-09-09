# Supabase 設定入口

更新日期：2026-09-09。SQL Editor 歷史不是 schema 的唯一來源；接受的變更須保存在 repository。先確認目標專案與備份，再依情境操作。

## 全新空白專案

依 [rebuild 清單](rebuild/README.md) 執行 01～10（包括唯讀驗證），**略過刪資料的 00**。涵蓋核心、研究、推薦、RAG、醫療申請、家長同意與帳號生命週期。

接著執行 [蜂蜜任務 migration](migrations/20260902_create_honey_mission_progress.sql)。後續 migration 核對 schema 後再套用，不要重播所有舊檔案。

## 已有資料的專案

1. 備份，記錄已套用 migration、資料表、RPC、RLS 與 Storage 設定。
2. 對照目前功能，只套缺少的變更；按 timestamp 審查 migration，但不要把 rebuild 已建立的物件再次當作全新物件建立。
3. `20260807_schema_reconciliation_and_rag.sql` 是針對較早既有 schema 的調和檔，不是目前功能的一鍵安裝。須核對目標差異。
4. 執行 [VERIFY_SCHEMA.sql](VERIFY_SCHEMA.sql)、適用的 [核心](rebuild/02_VERIFY_CORE.sql) 及 [進階](rebuild/06_VERIFY_ADVANCED.sql) 唯讀驗證；另核對後續功能自己的表及政策。
5. 用測試帳號驗證建立兒童、結果保存、醫療核准與個案授權。結構驗證不代表全部權限流程通過。

目前沒有自動辨識任意既有資料庫狀態並安全升級的一鍵工具。不能由 README 推定遠端已套用哪些檔案。`.rollback.sql` 是緊急回復用途，不屬正常安裝序列。

## 清空重建

只有確定要清空應用資料時，才依 [rebuild](rebuild/README.md) 從 00 執行。Reset 保留 Auth users，但會重建家長 profiles；原專業角色不能視為仍有效。不可用於保留資料的一般升級。

## 連線與帳號

前端 `.env` 設定 `REACT_APP_SUPABASE_URL` 與 `REACT_APP_SUPABASE_ANON_KEY`。後端金鑰放 `.env.rag`／部署環境，詳見 [主 README](../README.md#setup)。Auth 網站 URL、redirect URL 應對應前端。

正常醫療帳號經申請與管理員審核，核准角色後仍需個案授權。家長授權碼與登入密碼不同；手動改角色不代表取得所有個案存取權。

舊 [SUPABASE_SETUP.md](../SUPABASE_SETUP.md) 及 `supabase_schema.sql` 只作歷史參考，不再指導新環境安裝。