# LB 正式測驗前的兩段試玩

已整合至 `src/pages/TestPage_LB.jsx`，不需要新增路由。沿用正式測驗的背景、小屋、木牌及按鈕；開始畫面以 `LB_icon.webp` 放大裁切素材內建透明邊緣，填滿圓形框。試玩與正式作答底部只保留移除／送出按鈕，不顯示進度數字或說明文字；原有語音與示範流程保留。

## 狀態切換與核心邏輯

```text
開始 → STEP（播完、跳過或下一步）
     → practiceMode1：黃色 1 → 2 → 3 → 4 → 5
     → practiceMode2：黃色 1 → 藍色 2 → 黃色 3 → 藍色 4 → 黃色 5 → 藍色 6
     → formalMode：原本的兩段正式測驗
```

每段試玩都必須由幼兒完整選取並按「送出答案」。逐項比對木牌 key，同時檢查數字、顏色及順序；送出後會共用正式測驗的 `walk.webp` 動畫，沿本次選取順序前進。全對時奶奶走回小屋，動畫結束後播放完成語音，播畢再自動切換下一段；錯答播放路線後恢復作答並保留選取供修改。動畫期間鎖住操作，不揭露正解，不寫入成績。

兩段試玩共用 `handleNumberClick`、`handleUndoLastSelection` 與 `handleSubmitStage`。移除會取消最後一張；再次點擊已選取木牌，也保留原本取消該木牌的操作。未選足指定數量時，送出按鈕維持停用。

## 檔案與 React 元件

| 檔案 | 用途 |
| --- | --- |
| `src/pages/TestPage_LB.jsx` | STEP 銜接、三種 mode、共用 `DoorplateButton` 與操作按鈕、試玩檢核與正式測驗資料隔離 |
| `src/utils/lbPracticeProtocol.js` | `practiceMode1`／`practiceMode2`／`formalMode` 名稱、目標序列、干擾牌、分散排列 |
| `src/utils/useLBPracticeFlow.js` | React hook：進場、短暫示範、換手、5 秒提醒、完成切換與離頁清理 |
| `src/utils/lbPracticeAudio.js` | 四個舊語音的匯入、依序播放、錯誤與取消處理 |
| `src/styles/LBPractice.css` | 僅套用於試玩的滑鼠動畫、選取標記、響應式木牌尺寸 |
| `src/pages/lbPracticeFlow.test.jsx` | 操作、語音時序、錯答重試、完整正式測驗回歸測試 |

正式測驗的計分從 `startGame()` 呼叫 `testAttempt.begin()` 才開始，會清空試玩選取及計時；試玩不呼叫正式紀錄的 checkpoint／完成儲存。原本兩段正式測驗、送出後奶奶移動與計分均保留。正式測驗兩關之間不再顯示規則說明頁，對答案動畫結束後直接進入下一關。

## 音效時機

| 時機 | 素材 |
| --- | --- |
| 每段試玩進場，先鎖住操作 | `題目要開始囉.mp3` |
| 短暫示範完畢，播完後開放操作 | `換你開始點囉.mp3` |
| 可作答期間連續 5 秒未操作 | `點擊你的答案.mp3` |
| 按送出且完整序列正確 | `完成囉 你實在是太棒了.mp3` |

提醒在每次選牌、移除、錯答送出或點擊空白處後重新計時。每個停頓區間只提醒一次；下一次操作後重新啟用。提醒不顯示滑鼠，操作時會停止尚未播完的提醒，避免與完成語音重疊。

正常情況依 `ended` 事件接續，播放錯誤或 autoplay 被拒絕時繼續流程；若媒體沒有結束事件，12 秒後停止並繼續。切換試玩、進入正式測驗或離開頁面時，會停止舊語音並取消計時器。

## mouse 示範

使用既有 `src/asset/mouse.webp`。滑鼠依木牌的百分比位置，以 `left/top` 的 650ms CSS transition 移動，並用 550ms 縮放動畫模擬按下，木牌同步短暫顯示選取勾號。

試玩一示範黃色 1，試玩二示範黃色 1、藍色 2。依使用者確認，示範完成會清空示範選取，讓幼兒自行從頭完成整段；示範期間不能作答。換手語音播放前隱藏滑鼠，正式作答不顯示答案指引。

木牌隨機分配到互相分離的散點位置，同一段操作期間保持位置固定，右下角留給小屋；尺寸隨螢幕寬高縮放。

## 驗證與預覽

```powershell
npm test -- --watchAll=false --runInBand --runTestsByPath src/pages/lbPracticeFlow.test.jsx src/pages/lbProtocolTiming.test.jsx
npm run check:assets
npm run build
```

本機開發預覽：`http://localhost:3000/test-linking-balloons?gameTesting=1`。此參數使用專案既有的臨時測試隔離，不會儲存兒童正式結果。按「開始」後可看完或跳過 STEP，直接測試兩段試玩。

目前工具環境無可連線瀏覽器，因此尚未完成實機視覺與聽音驗收；互動、音訊事件及正式紀錄隔離由自動化測試驗證。

本次驗證：上述兩組共 24 項測試、素材匯入檢查及核心元件 ESLint 均通過。額外執行 `npm run check:deploy` 時，目前整包建置為 216.15 MiB，超過專案設定的 190 MiB 上限；尚未發布。
