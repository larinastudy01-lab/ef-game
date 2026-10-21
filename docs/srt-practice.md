# SRT 正式測驗前試玩

正式 SRT 依使用者最新確認設定為 8 分鐘、兩種刺激：普通橡實與壞橡實，比例 3：1，每顆呈現 500 ms，出現間隔隨機 1 或 3 秒。試玩流程獨立執行，不計入正式評測的 8 分鐘；正式 Trial-level 紀錄、計分、儲存及其他任務的參數與邏輯沿用既有實作。

## 狀態與通過條件

`step → enter → demonstration（好橡實規則）→ rules（壞橡實規則）→ beforeTrial → trial → feedback`

通過後：`completionAudio → completion → ready（自動銜接）→ assessmentIntro → assessment`。不再顯示「開始遊戲／開始測驗」圖示；播放「你學會了！準備開始挑戰吧！」，短暫停留後自動接續正式規則與開始語音。

通過條件為 `correctStreak >= 2 && hasCorrectGo && hasCorrectNoGo`。兩次 Go 正確不會單獨通過。No-go 要等完整反應窗結束才算正確。每顆試玩橡實完整顯示 2 秒，這 2 秒內均可作答；提早點擊立即更新進度，答對不顯示勾勾，錯誤保留葉子提示，橡實仍顯示到滿 2 秒。之後橡實與錯誤提示皆移除，空白至少 500 ms，且回饋語音結束後才出下一顆。重複點擊不重複判題，示意題不計入連續答對次數。

錯誤後清空連續進度，橡實消失且反應窗結束後播放對應錯誤提示，再播放重試語音並進入額外教學暫停，示範點擊好橡實。示範橡實同樣可點，點擊時立即移除橡實與手指，但不顯示勾勾，也不計入題數、正確率及通過條件。示意橡實最多停留 2000 ms，手指動畫維持 1800 ms；若提示語音較長，等語音結束後才恢復出題。實際試玩題皆為獨立作答，不顯示手指，刺激與反應窗期間不播放語音。上方只保留兩格進度圖示，不顯示說明文字。

獨立題序每四題含三題 `training/acorn.webp`、一題 `training/rotten_acorn.webp`，每組洗牌，組間避免連續壞橡實。預設最多 20 題；未通過時停在 `help`，由大人協助後重新試玩或返回地圖，不直接放行。

## 設定與計時

集中設定：`src/config/srtPracticeConfig.js`（試玩版本 1.5.0），語音素材集中在 `src/config/srtAudioConfig.js`。沿用原頁面的森林背景與相同位置函式，刺激寬度 118px。試玩為「顯示 2 秒 → 空白至少 500 ms 並等回饋語音結束 → 下一顆」，正式評測維持每顆 500 ms。

| 設定 | 目前值 | 狀態 |
| --- | --- | --- |
| `stimulusDurationMs` | 2000 ms | 完整顯示 2 秒，提早點擊也不提前消失 |
| `responseWindowMs` | 2000 ms | 橡實顯示期間可作答；No-go 等完整反應窗 |
| `interStimulusIntervalMs` | 2500 ms | 最短 onset-to-onset；語音較長時延後下一題 |
| `feedbackDurationMs` | 500 ms | 兩題間不呈現橡實或額外回饋圖示 |
| `requiredCorrectStreak` | 2 | 同時要求兩類皆曾獨立作答正確 |
| `maxTrials` | 20 | 可調整，不自動放行 |
| `handAnimation.durationMs` | 1800 ms | 可獨立開關及調整 |
| `completionAnimationMs` | 1000 ms | 通過語音後短暫停留，保留閉嘴小雞，再自動銜接 |

設定解析驗證有效計時參數，不將 null 傳入計時器。試玩的呈現、反應窗及刺激間隔均有獨立設定，紀錄中的 `protocol.timingSource` 標示為 `practice_config`，不覆寫正式評測。

呈現時間與反應窗仍可獨立配置。若反應窗較長，圖片依設定呈現時間消失，原位置的透明點擊範圍保留到反應窗結束，可依記憶位置作答；No-go 同樣等完整反應窗。反應窗不可小於呈現時間。

題序以 2500 ms 為最短 onset-to-onset，回饋語音與額外教學暫停可延後下一題，瀏覽器動畫影格也可能造成少量誤差。題前準備語音只在首次出題與額外教學後恢復時播放。逐題保存設定間隔與實際 `stimulusIntervalMs`。

## 語音與動畫

使用 `src/asset/voice/` 現有錄音，依建議語意選用；缺少完全相同文案的項目使用最接近的錄音。未來替換時更新 `src/config/srtAudioConfig.js` 的匯入與 `events`：

| 事件 | 錄音 |
| --- | --- |
| `enterPractice` | 小松鼠要收集橡實囉！一起來幫忙吧！.mp3 |
| `ruleGo` | 看到好的橡實，就快快點！.mp3 |
| `ruleNoGo` | 看到壞掉的橡實，千萬不要點喔！.mp3 |
| `beforeTrial` | 準備好了嗎？看仔細，開始囉！.mp3 |
| `correct` | 太棒了！你真厲害！.mp3 |
| `wrongNoGo` | 哎呀！壞掉的橡實不能撿喔！.mp3 |
| `missedGo` | 看到好的橡實，要快快點擊喔！.mp3 |
| `retry` | 沒關係，我們再試一次！.mp3 |
| `practiceComplete` | 你學會了！準備開始挑戰吧！.mp3 |
| `assessmentComplete` | 完成囉！你真的很努力！.mp3 |

語音逐一播放，試玩的 `audio.enabled` 可獨立停用。試玩播放遭拒、載入錯誤或 10 秒無結束事件時停止該音訊並繼續流程。刺激與反應窗期間不播放語音；較長反應窗也會完整結束後才播回饋。通過時直接播放通過語音，省略該題的答對語音，避免重複鼓勵。

試玩通過後自動銜接正式評測準備，依序重播 `ruleGo → ruleNoGo → beforeTrial`，三段皆收到播放完成事件後才建立正式 attempt、啟動 8 分鐘計時及刺激排程。若播放遭拒、錯誤或逾時，停在「測驗準備」並提供重新播放，時間不會自行開始。正式作答全程沒有刺激、答對、誤點或漏點語音；結束時先固定成績與測驗結束時間，再播放 `assessmentComplete`，不計入測驗時長。離開頁面時停止音訊、移除監聽器並清除所有計時器及動畫影格，語音或短暫停留期間離開也不會延遲觸發正式測驗。

「測驗準備」採左側規則圖示、右側 `src/asset/chicken.webp` 全身小雞的版面。好橡實搭配 `mouse.webp` 點擊動畫，壞橡實上疊紅色叉叉；播放時標示目前講解的規則，下方文字與語音同步切換。窄螢幕改為規則在上、小雞在下。前段試玩播放 `ruleNoGo` 時也會顯示壞橡實與叉叉，語音結束後收起；此示範不接受作答或計入試玩題數，正式反應期間不顯示提示圖示。

每段旁白皆搭配放大的小雞，以 `chicken.webp`（張嘴）與 `chicken01.webp`（閉嘴）交替呈現說話效果。兩張圖片共用固定顯示區域，不改變版面尺寸，也不新增 JavaScript 計時器。規則語音播放失敗時，畫面保留的小雞維持閉嘴；系統要求減少動態效果時也顯示閉嘴版本。

試玩沒有主要教學圖示時，小雞放大置中，保留上方進度空間。有好橡實、手指或壞橡實叉叉時，教學圖示與小雞使用分開區域：寬螢幕左右排列、窄螢幕上下排列，避免互相遮擋。規則介紹與結果頁的小雞也加大，結果頁保留圖示與按鈕的排列空間。語音播放完成或失敗後收起試玩／結果小雞，正式反應期間不顯示。進入詳細結果會先停止完成語音。示範、答對與通過皆不再顯示綠色勾勾。

`HandPointerHint` 沿用 `mouse.webp`，提供淡入、靠近、縮放點擊、淡出的一次有限動畫，手指落點對準好橡實。使用 `pointer-events: none`，不攔截點擊。僅示範階段使用。`feedbackAnimationEnabled` 可獨立停用回饋動畫，亦支援系統減少動態效果設定。

## 試玩資料隔離

透過現有 `gameLocalStorage` adapter 寫入 `srtPracticeResult_${childId}`，保存該孩子最近一次試玩。遊戲測試模式沿用記憶體儲存，不寫入真實紀錄。試玩不呼叫正式的 `testAttempt.begin/checkpoint/complete` 或 `saveUnifiedResult`，不寫正式資料表、分數、通關狀態或副本機制。

記錄包含 `practice_attempt_count`、`practice_correct_count`、`practice_error_count`、`practice_timeout_count`、`practice_max_streak`、`practice_hint_count`、`practice_passed`、`practice_duration_ms`，以及每題刺激、點擊、正確性、反應時間、額外教學提示、設定及實際計時。

離開途中保存 `interrupted`；達上限保存 `assistance_required`；通過保存 `passed`。開始試玩不刪既有正式結果，正式開始時才重設快取。

## 修改檔案

- `src/pages/TestPage_SRT.jsx`：傳入現有計時、位置與兒童識別，正式入口延後至試玩通過。
- `src/components/SrtTestTutorial.jsx`：試玩狀態機、判題、上限協助、完成準備。
- `src/components/HandPointerHint.jsx`：可重用手指動畫元件。
- `src/config/srtPracticeConfig.js`：試玩參數、素材與語音觸發集中管理。
- `src/config/srtAudioConfig.js`：試玩與正式評測語音檔、開始前播放順序。
- `src/utils/srtPracticeProtocol.js`：獨立題序、進度判定、試玩紀錄與儲存。
- `src/utils/srtPracticeAudio.js`：語音錯誤、逾時及離開清理。
- `src/styles/SrtTestTutorial.css`、`src/styles/HandPointerHint.css`：試玩及手指動畫樣式。
- `src/pages/srtPractice.test.jsx`：實際流程、完整 2 秒顯示、500 ms 空白、示範與試玩立即點擊回饋、獨立反應窗、重複點擊、錯誤、上限、語音順序及正式入口隔離。
- `src/pages/srtTiming.test.jsx`：既有正式／訓練回歸測試與試玩入口隔離。
- `src/pages/srtAssessmentAudio.test.jsx`：正式語音完成關卡、播放失敗重試、八分鐘計時、正式反應靜音與離頁清理。
- `src/utils/srtPracticeProtocol.test.js`、`src/utils/srtPracticeAudio.test.js`：題序、通過條件、設定、儲存與音訊清理。
- `docs/srt-protocol.md`、`docs/srt-practice.md`：流程與設定文件。

既有 `src/utils/srtProtocol.js` 未修改，並沿用 `src/utils/srtProtocol.test.js` 驗證訓練與評測相關工具。
