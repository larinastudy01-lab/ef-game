# SRT 正式測驗前試玩

正式測驗固定 8 分鐘，使用 test01 葡萄或 test02 蘋果，每四題三個好水果、一個壞水果；正式呈現 500 ms，出現間隔隨機 1 或 3 秒。同一孩子在同一瀏覽器依 01 → 02 → 01 輪替，正式開始才記錄使用版本，詳見 [SRT 刺激與結果紀錄](srt-protocol.md)。

試玩沿用本次測驗版本的圖片、文字與 `src/asset/voice/SRT_副本/` 錄音，不使用 training 橡實。訓練頁只使用 `SRT/training/` 素材。試玩不計入正式測驗時間、題數或成績。

## 狀態與通過條件

`step（原本 SRT_step.mp4）→ enter → demonstration（好水果規則）→ rules（壞水果規則）→ beforeTrial → trial → feedback`

01、02 與訓練暫時共同使用原本的 `src/asset/optimized/mp4/SRT_step.mp4`，不另外顯示水果規則畫面。影片播完或按下「跳過動畫／下一步」後停止影片並進入試玩；離頁也會停止影片。影片、旁白及測驗／訓練過程均無背景音樂。

通過後：`completionAudio → completion → ready → assessmentIntro → assessment`。播放「太棒了！你學會怎麼玩了！」，短暫停留後自動接續正式規則與開始語音。

通過條件為 `correctStreak >= 2 && hasCorrectGo && hasCorrectNoGo`。只正確點到兩個好水果不會通過；壞水果要等完整反應窗結束才算正確。

每個試玩水果完整顯示 2 秒，期間可作答；提早點擊立即更新進度，答對不顯示勾勾，錯誤保留葉子提示，水果仍顯示到滿 2 秒。之後刺激與錯誤提示皆移除，空白至少 500 ms，且回饋語音結束後才出下一題。重複點擊不重複判題，示意題不計入通過條件。

錯誤會清空連續進度。反應窗結束後播放對應錯誤提示、重試語音，再示範點擊好水果。示範可點擊，點擊後移除水果與手指，但不計分。示範最多顯示 2000 ms，手指動畫 1800 ms；語音較長時等語音結束才恢復出題。實際試玩題不顯示手指，反應窗期間不播放語音。上方只有兩格進度圖示。

試玩使用獨立題序，每四題三個好水果、一個壞水果，每組洗牌，組間避免連續壞水果。最多 20 題，未通過時停在 `help`，由大人協助後重新試玩或返回地圖，不直接放行。

## 設定與計時

共用計時設定為 `src/config/srtPracticeConfig.js`，測驗頁透過 config 傳入 `src/config/srtAssessmentConfig.js` 的本次版本、圖片與完整語音事件。沿用森林背景與位置函式，刺激寬度 118px。元件的橡實預設值供舊有獨立呼叫相容；正式測驗入口一律傳入 01 或 02。

| 設定 | 目前值 |
| --- | --- |
| `stimulusDurationMs` | 2000 ms，提早點擊不提前消失 |
| `responseWindowMs` | 2000 ms，壞水果等完整反應窗 |
| `interStimulusIntervalMs` | 2500 ms 最短 onset-to-onset，語音可延後下一題 |
| `feedbackDurationMs` | 500 ms |
| `requiredCorrectStreak` | 2，且兩種刺激皆曾獨立答對 |
| `maxTrials` | 20 |
| `handAnimation.durationMs` | 1800 ms |
| `completionAnimationMs` | 1000 ms，通過語音後自動銜接 |

設定解析驗證有效計時參數，不將 null 傳入計時器；`protocol.timingSource` 標為 `practice_config`。反應窗不可小於呈現時間；若反應窗較長，圖片消失後原位置仍可依記憶點擊直到反應窗結束。逐題保存設定間隔與實際 `stimulusIntervalMs`。

## 語音與動畫

以下錄音皆位於 `src/asset/voice/SRT_副本/`，集中在 `src/config/srtAssessmentConfig.js`。

| 事件 | 錄音（水果依版本為葡萄或蘋果） |
| --- | --- |
| `enterPractice` | 一起來收集葡萄吧！／一起來收集蘋果吧！ |
| `ruleGo`、`missedGo` | 看到好的水果，要記得點一下喔！ |
| `ruleNoGo` | 看到好的水果，就快快點一下！看到壞掉的水果，不要點喔！ |
| `beforeTrial` | 準備好了嗎？看仔細，開始囉！ |
| `correct` | 太棒了！你做對了！ |
| `wrongNoGo` | 壞掉的水果不能收集喔！再看仔細一點！ |
| `retry` | 沒關係，我們再試一次！ |
| `practiceComplete` | 太棒了！你學會怎麼玩了！ |
| `assessmentComplete` | 完成囉！謝謝你幫忙收集葡萄！／太棒啦！謝謝你幫忙收集蘋果！ |

語音逐一播放，可獨立停用試玩語音。試玩播放遭拒、載入錯誤或 10 秒未結束時停止音訊並繼續；反應窗完整結束後才播放回饋。通過時直接播放通過語音，省略該題答對語音。

正式準備依序播放 `ruleGo → ruleNoGo → beforeTrial`，三段皆播放完成後才建立正式 attempt、記錄使用版本並啟動 8 分鐘計時。失敗或逾時時停在測驗準備，提供重播，不消耗版本。正式作答全程沒有刺激、答對、誤點或漏點語音；固定結束時間與成績後才播放完成語音。

規則圖示使用本次水果，好水果搭配 `mouse.webp` 點擊動畫，壞水果疊紅叉。旁白以 `chicken.webp` 與 `chicken01.webp` 交替呈現；寬螢幕圖示與小雞左右排列，窄螢幕上下排列，沒有教學圖示時小雞置中。正式作答期間不顯示小雞、手指或叉叉。動畫支援系統減少動態效果設定。

離頁停止音訊、移除監聽器並清除計時器及動畫影格，避免延遲開始正式測驗。進入詳細結果先停止完成語音。

## 試玩資料隔離與驗證

透過 `gameLocalStorage` 寫入 `srtPracticeResult_<childId>`，保存最近一次試玩。遊戲測試模式只寫記憶體。試玩不呼叫正式 `testAttempt.begin/checkpoint/complete` 或 `saveUnifiedResult`，不寫正式成績或推進副本輪替。

結果保存 `testVersion`、`stimulusSetId`、`stimulusName`，以及 `practice_attempt_count`、`practice_correct_count`、`practice_error_count`、`practice_timeout_count`、`practice_max_streak`、`practice_hint_count`、`practice_passed`、`practice_duration_ms` 與逐題反應、教學提示及計時資訊。離頁記錄 `interrupted`；達上限記錄 `assistance_required`；通過記錄 `passed`。開始試玩不刪既有正式結果，正式開始才重設快取。

`src/pages/srtPractice.test.jsx` 驗證兩版本完整教學與試玩流程；`src/pages/srtAssessmentAudio.test.jsx` 驗證正式語音關卡、失敗重播、八分鐘計時、結果版本與離頁清理；`src/pages/srtTiming.test.jsx` 驗證 01／02 交替、訓練隔離與刺激計時；`src/utils/srtAssessmentVersion.test.js` 驗證每位孩子的獨立輪替及 QA 隔離。既有 practice protocol、audio 與 SRT protocol 單元測試繼續驗證共用邏輯。
