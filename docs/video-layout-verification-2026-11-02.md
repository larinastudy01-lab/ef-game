# 六項遊戲影片頁面版面驗收（2026-11-02）

本次統一六項遊戲的 Test STEP，以及 Training START／STEP／END 影片頁面。ART 對應目前專案內的 ARI。

目前六項 Test 均只有 STEP 教學影片；測驗結束使用結果卡片及完成語音，沒有 END 影片頁面。本次確認現況並保留既有結束流程，沒有新增 END 影片。實際影片頁面總數為 24（Test 6、Training 18）。

## 實際修改檔案

| 檔案 | 本次調整 |
| --- | --- |
| `src/styles/TestStepVideo.css` | Test／Training 共用尺寸系統；依可用視窗寬高等比例縮放卡片、按鈕、間距、內距及提示圖；保留影片 16:9、contain、24px 圓角與 4px #8BC8E8 邊框。 |
| `src/pages/TrainingPage_SRT.jsx` | START 影片加入共用版面、卡片、影片及按鈕區樣式標記。 |
| `src/pages/TrainingPage_PM.jsx` | START 影片及其外層容器加入共用樣式，涵蓋原本獨立的 inline style／圖片按鈕。 |
| `src/pages/TrainingPage_CBT.jsx` | 頁面內 `VideoOnlyPage` 的 START／STEP／END 全部套用共用卡片樣式，不再依 STEP／END 才啟用。 |
| `src/pages/TrainingPage_DCCS.jsx` | 頁面內 `renderVideoPage` 的 START／STEP／END 全部套用共用版面及卡片樣式。 |
| `src/pages/TrainingPage_ARI.jsx` | 三種影片頁面一律套用共用樣式；START 增加純排版用的按鈕列外層，保留原本單一跳過按鈕與滑鼠提示。 |
| `src/pages/TrainingPage_LB.jsx` | START 影片加入共用版面、卡片、影片及按鈕區樣式標記。 |
| `docs/video-layout-verification-2026-11-02.md` | 本驗收報告。 |

六項 `TestPage_*.jsx` 本次沒有新增修改；它們已引用同一份共用樣式，因此同步取得尺寸更新。工作區原先已有其他修改；本次未還原或納入那些既有修改。

## 共用元件與尺寸

保留原本各遊戲的播放元件及事件處理，將視覺統一在既有 `TestStepVideo.css` 管理。`test-video-layout`、`test-video-card`、`test-video-frame`、`test-video`、`test-video-actions` 現在是兩種模式共同使用的版面標記，名稱不代表只適用 Test。無新增遊戲狀態、計時器或資料保存程式。

- 卡片設計上限 1440 × 850px，以同一縮放單位適應視窗寬、高及安全邊界。
- 影片容器上限 1280px、固定 16:9；先扣除卡片內距、按鈕列與原有提示文字空間，再計算可用影片尺寸。
- 影片 `object-fit: contain`、圓角 24px、邊框 `4px solid #8BC8E8`。
- 按鈕設計尺寸 220 × 100px、水平間距 80px，隨卡片等比例縮小；圖片本身使用 contain。
- 原有森林背景、花草卡片圖片、圖片按鈕與滑鼠提示保留。
- ARI START 原本只有一個按鈕，照原功能保留；CBT STEP 原有提示文字另預留空間。
- CBT Training END 原本引用 `introVideo`，本次保留原影片來源，沒有替換影片內容。

以下為一般雙按鈕頁面的實測值（px，四捨五入）：

| 視窗尺寸 | 卡片 | 影片容器 | 按鈕 | 水平間距 |
| --- | --- | --- | --- | --- |
| 1920 × 1080 | 1440 × 850 | 1155.55 × 649.98 | 220 × 100 | 80 |
| 1366 × 768 | 1246.86 × 736 | 1000.61 × 562.83 | 190.48 × 86.58 | 69.27 |
| 1024 × 768 | 992 × 585.55 | 796.06 × 447.78 | 151.55 × 68.88 | 55.11 |
| 768 × 1024 | 736 × 434.44 | 590.63 × 332.22 | 112.44 × 51.11 | 40.88 |

影片最大寬度是上限；實際高度須容納同一卡片中的按鈕及內距，因此不會強制撐滿 1280px。CBT STEP 另因原有提示文字而縮小影片，可用空間計算方式相同。

## 逐遊戲驗證

「通過」包含八種視窗尺寸下的幾何量測、影片載入／開始播放，以及現有事件的階段轉換檢查。

| 遊戲 | Test STEP | Test END | Training START | Training STEP | Training END |
| --- | --- | --- | --- | --- | --- |
| SRT | 通過 | 無影片，保留原結果流程 | 通過 | 通過 | 通過 |
| PM | 通過 | 無影片，保留原結果流程 | 通過 | 通過 | 通過 |
| CBT | 通過 | 無影片，保留原結果流程 | 通過 | 通過 | 通過 |
| DCCS | 通過 | 無影片，保留原結果流程 | 通過 | 通過 | 通過 |
| ART／ARI | 通過 | 無影片，保留原結果流程 | 通過 | 通過 | 通過 |
| LB | 通過 | 無影片，保留原結果流程 | 通過 | 通過 | 通過 |

版面驗證尺寸：1920×1080、1366×768、1024×768、768×1024、1180×820、820×1180、390×844、1024×600。24 頁 × 8 尺寸 = **192 次檢查，全數通過**。

量測確認卡片在視窗內且置中、卡片尺寸上限、16:9 比例、影片最大寬度、contain、邊框及圓角、按鈕尺寸及間距、影片／按鈕在卡片內，以及沒有水平或垂直溢出。另人工檢視 10 張影片實際畫面截圖，沒有發現按鈕遭遮擋或影片遭裁切。

## 功能與回歸證據

1. **正式建置**：`npm run build` 通過。
2. **資源引用**：`npm run check:assets` 通過。
3. **完整回歸**：`CI=true npm test -- --watchAll=false --runInBand`，95 組測試、761 個案例、4 個快照全部通過。
4. **最後排版修正後的 ARI 回歸**：`ariPractice.test.jsx`、`ariProtocolTiming.test.jsx` 再次通過；正式建置亦再次成功。
5. **影片載入與播放**：本機 Chrome 對 24 個實際頁面的原影片來源逐一載入、確認原生影片寬高及 readyState，並成功呼叫播放；24／24 通過。
6. **事件轉換**：以實際頁面元件取得原本的 onClick／onEnded，隔離計時與儲存後逐一呼叫跳過、下一步、播放結束事件，核對預期下一階段；70／70 通過。PM END 測試提供已完成結果作為前置資料；ARI STEP 原本無自動結束事件，保留手動前進。
7. **程式等價比對**：與本次開始前保存的 12 個頁面檔案進行 AST 比對，僅排除 className 及 ARI START 純排版外層；其餘程式完全一致。影片來源、播放屬性、事件、流程、測驗規則、適性難度、UCB1、計時及保存程式未變。

版面測試使用實際 React 元件輸出及完整樣式，在本機 Chrome 視窗尺寸環境驗證；沒有使用實體平板。事件測試為隔離的 callback／階段轉換驗證，配合既有完整回歸測試；沒有對正式資料庫進行實機提交。

## 本機驗收附件

產出位於 Git 忽略的 `artifacts/video-layout/`，供此工作區檢閱：

- [192 次版面量測資料](../artifacts/video-layout/matrix-results.json)
- [24 頁影片載入及播放資料](../artifacts/video-layout/media-results.json)
- [70 個事件轉換資料](../artifacts/video-layout/interaction-results.json)
- [僅本次 UI 修改的差異](../artifacts/video-layout/ui-only.patch)
- [SRT Training START，1920×1080](../artifacts/video-layout/Training-SRT-intro-1920x1080.png)
- [PM Training START，1366×768](../artifacts/video-layout/Training-PM-introVideo-1366x768.png)
- [CBT Training STEP，768×1024](../artifacts/video-layout/Training-CBT-stepVideo-768x1024.png)
- [DCCS Training START，768×1024](../artifacts/video-layout/Training-DCCS-video_intro-768x1024.png)
- [ARI Training START，1366×768](../artifacts/video-layout/Training-ARI-introVideo-1366x768.png)
- [LB Training START，820×1180](../artifacts/video-layout/Training-LB-introVideo-820x1180.png)
- [LB Training END，1366×768](../artifacts/video-layout/Training-LB-endingVideo-1366x768.png)

本機 QA 輔助程式位於 `.tmp/video-layout-*.cjs`，測試用 HTML 位於 `.tmp/video-layout/`，不會進入正式網站建置。
