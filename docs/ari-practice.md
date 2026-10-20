# ARI 正式評測前試玩

既有 `/test-ari` 頁面保留原本遊戲初始畫面與 STEP 影片介面，流程為「初始畫面 → STEP 影片 → 互動教學試玩 → 正式評測」。點擊「進入遊戲」顯示原 STEP 影片；影片結束、跳過或下一步後，直接透過 `AriPractice` 呈現試玩階段。通過並完整播放完成語音後，點擊「開始挑戰」才呼叫原本的 `startTest()`。正式題目、時限、計分、儲存及結果頁維持原流程。

## 題目與輪數

- 每組第一個聲音隨機選貓或狗，答對後一定換成另一種聲音。
- 貓叫選狗、狗叫選貓；連續兩題正確才通過。
- 任一題錯誤會清空兩顆星星，結束本組並重新隨機開始下一組。
- `MAX_PRACTICE_ROUNDS = 3` 定義在 `src/components/AriPractice.jsx`。三組均未通過才顯示協助提示，因此每組最多兩題，總計最多六題。技術播放失敗及重播不計入輪數。
- 協助提示提供重新試玩與重看既有 STEP 影片；影片結束、跳過或下一步皆回到完整重設的試玩，不直接進正式測驗。
- 試玩答案僅存在元件記憶體，不呼叫正式評測紀錄、計分、localStorage 或資料庫 API。

## 狀態與聲音

`initializing → intro → question_prompt → stimulus_playing → answer_prompt → awaiting_answer → feedback`，之後進下一題、`completed` 或 `assistance_required`。

每段錄音必須收到 `ended` 才繼續。重播只播放當題動物聲音，暫停作答與重播按鈕，不重建題目。播放失敗、被瀏覽器擋下或逾時時，顯示「再播一次」並從失敗的錄音重試；不跳過刺激或完成錄音。卸載會取消聲音及所有試玩計時器。

全部素材以專案既有 import 打包：

- `src/asset/ARI/ARI_background.webp`、`cat.webp`、`dog.webp`、`cat.mp3`、`dog.mp3`
- `src/asset/mouse.webp`、`src/asset/voice.webp`
- `src/asset/voice/換你開始點囉.mp3`（專案的實際檔名）
- `src/asset/voice/題目要開始囉.mp3`
- `src/asset/voice/點擊你的答案.mp3`
- `src/asset/voice/完成囉 你實在是太棒了.mp3`

`mouse.webp` 實際為手指引導圖，維持原圖並朝畫面外側，避免指向任何動物。動畫與版面樣式僅套用試玩階段。

## 驗證

`src/pages/ariPractice.test.jsx` 覆蓋語音順序、兩種第一題、相反規則、星星重置、重播與重複提交、三輪協助、重新試玩、STEP 返回、音訊錯誤恢復、完成錄音鎖定、卸載與 StrictMode。

`src/pages/ariProtocolTiming.test.jsx` 經試玩後再驗證正式 20 題、5 秒時限與原本的訓練規則。

實機還需確認瀏覽器的自動播放政策及手機／平板／電腦版面；若政策阻擋首段自動播放，使用畫面上的「再播一次」恢復。
