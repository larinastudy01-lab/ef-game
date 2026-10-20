# SRT 正式測驗前試玩

正式 SRT 依使用者最新確認設定為 8 分鐘、兩種刺激：普通橡實與壞橡實，比例 3：1，每顆呈現 500 ms，出現間隔隨機 1 或 3 秒。試玩流程獨立執行，不計入正式評測的 8 分鐘；正式 Trial-level 紀錄、計分、儲存及其他任務的參數與邏輯沿用既有實作。

## 狀態與通過條件

`step → enter → demonstration → beforeTrial → trial → feedback`

通過後：`completionAudio → completion → ready → assessment`。

通過條件為 `correctStreak >= 2 && hasCorrectGo && hasCorrectNoGo`。兩次 Go 正確不會單獨通過。No-go 要等完整反應窗結束才算正確。每顆試玩橡實完整顯示 1 秒，這 1 秒內均可作答；提早點擊立即在橡實旁顯示圖像回饋並更新進度，橡實仍顯示到滿 1 秒。之後橡實與回饋圖示皆移除，空白 500 ms 再出下一顆。重複點擊不重複判題，示意題不計入連續答對次數。

錯誤後清空連續進度，待 500 ms 空白後進入額外教學暫停，示範點擊好橡實。示範橡實同樣可點，點擊時立即顯示勾勾並移除手指，但不計入題數、正確率及通過條件。示意橡實與手指動畫最多停留 1800 ms；若提示語音較長，等語音結束後才恢復出題。實際試玩題皆為獨立作答，不顯示手指、不播放教學語音。上方只保留兩格進度圖示，不顯示說明文字。

獨立題序每四題含三題 `training/acorn.webp`、一題 `training/rotten_acorn.webp`，每組洗牌，組間避免連續壞橡實。預設最多 20 題；未通過時停在 `help`，由大人協助後重新試玩或返回地圖，不直接放行。

## 設定與計時

集中設定：`src/config/srtPracticeConfig.js`（試玩版本 1.2.0）。沿用原頁面的森林背景與相同位置函式，刺激寬度 118px。試玩為「顯示 1 秒 → 空白 500 ms → 下一顆」，正式評測維持每顆 500 ms。

| 設定 | 目前值 | 狀態 |
| --- | --- | --- |
| `stimulusDurationMs` | 1000 ms | 完整顯示 1 秒，提早點擊也不提前消失 |
| `responseWindowMs` | 1000 ms | 橡實顯示期間可作答；No-go 等完整反應窗 |
| `interStimulusIntervalMs` | 1500 ms | onset-to-onset：顯示 1000 ms 加空白 500 ms |
| `feedbackDurationMs` | 500 ms | 兩題間不呈現橡實或額外回饋圖示 |
| `requiredCorrectStreak` | 2 | 同時要求兩類皆曾獨立作答正確 |
| `maxTrials` | 20 | 可調整，不自動放行 |
| `handAnimation.durationMs` | 1800 ms | 可獨立開關及調整 |
| `completionAnimationMs` | 1000 ms | 可調整 |

設定解析驗證有效計時參數，不將 null 傳入計時器。試玩的呈現、反應窗及刺激間隔均有獨立設定，紀錄中的 `protocol.timingSource` 標示為 `practice_config`，不覆寫正式評測。

呈現時間與反應窗仍可獨立配置。若反應窗較長，圖片依設定呈現時間消失，原位置的透明點擊範圍保留到反應窗結束，可依記憶位置作答；No-go 同樣等完整反應窗。反應窗不可小於呈現時間。

正常題序以 1500 ms onset-to-onset 呈現，瀏覽器動畫影格可能造成少量誤差。題前語音只在首次出題與額外教學後恢復時播放，不在每題間重播以免延長 500 ms 空白。答錯後的額外教學暫停會延後下一題，保留原有重教流程。逐題保存設定間隔與實際 `stimulusIntervalMs`。

## 語音與動畫

四個音檔維持 `src/asset/voice/` 既有內容，未新增語音。未來替換時更新 `src/config/srtPracticeConfig.js` 的匯入與 `audio.events`：

- `enterPractice`：換你開始點囉.mp3
- `operationHint`：點擊你的答案.mp3
- `beforeTrial`：題目要開始囉.mp3
- `practiceComplete`：完成囉 你實在是太棒了.mp3

語音逐一播放，`audio.enabled` 可獨立停用。播放遭拒、載入錯誤或 10 秒無結束事件時停止該音訊並繼續流程。刺激與反應窗期間不播放教學語音。離開頁面時停止音訊、移除監聽器並清除所有計時器及動畫影格。

`HandPointerHint` 沿用 `mouse.webp`，提供淡入、靠近、縮放點擊、淡出的一次有限動畫。使用 `pointer-events: none`，位於橡實旁，不遮擋刺激或攔截點擊。僅示範階段使用。`feedbackAnimationEnabled` 可獨立停用回饋動畫，亦支援系統減少動態效果設定。

## 試玩資料隔離

透過現有 `gameLocalStorage` adapter 寫入 `srtPracticeResult_${childId}`，保存該孩子最近一次試玩。遊戲測試模式沿用記憶體儲存，不寫入真實紀錄。試玩不呼叫正式的 `testAttempt.begin/checkpoint/complete` 或 `saveUnifiedResult`，不寫正式資料表、分數、通關狀態或副本機制。

記錄包含 `practice_attempt_count`、`practice_correct_count`、`practice_error_count`、`practice_timeout_count`、`practice_max_streak`、`practice_hint_count`、`practice_passed`、`practice_duration_ms`，以及每題刺激、點擊、正確性、反應時間、額外教學提示、設定及實際計時。

離開途中保存 `interrupted`；達上限保存 `assistance_required`；通過保存 `passed`。開始試玩不刪既有正式結果，正式開始時才重設快取。

## 修改檔案

- `src/pages/TestPage_SRT.jsx`：傳入現有計時、位置與兒童識別，正式入口延後至試玩通過。
- `src/components/SrtTestTutorial.jsx`：試玩狀態機、判題、上限協助、完成準備。
- `src/components/HandPointerHint.jsx`：可重用手指動畫元件。
- `src/config/srtPracticeConfig.js`：試玩參數、素材與語音觸發集中管理。
- `src/utils/srtPracticeProtocol.js`：獨立題序、進度判定、試玩紀錄與儲存。
- `src/utils/srtPracticeAudio.js`：語音錯誤、逾時及離開清理。
- `src/styles/SrtTestTutorial.css`、`src/styles/HandPointerHint.css`：試玩及手指動畫樣式。
- `src/pages/srtPractice.test.jsx`：實際流程、完整 1 秒顯示、500 ms 空白、示範與試玩立即點擊回饋、獨立反應窗、重複點擊、錯誤、上限、語音順序及正式入口隔離。
- `src/pages/srtTiming.test.jsx`：既有正式／訓練回歸測試與試玩入口隔離。
- `src/utils/srtPracticeProtocol.test.js`、`src/utils/srtPracticeAudio.test.js`：題序、通過條件、設定、儲存與音訊清理。
- `docs/srt-protocol.md`、`docs/srt-practice.md`：流程與設定文件。

既有 `src/utils/srtProtocol.js` 未修改，並沿用 `src/utils/srtProtocol.test.js` 驗證訓練與評測相關工具。
