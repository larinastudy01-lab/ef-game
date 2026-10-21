# 小助手每次問答的註冊信箱寄送

家長端與醫療端的小助手都提供「本次問答自動寄至註冊信箱」。每次詢問預設不勾選；勾選後，該次回答產生完成便自動交寄，下一題恢復不勾選。文字輸入及快捷問題都使用同一個選擇。

## 使用行為

- 寄送本次問題、完整回答、詢問時間、紀錄編號與本次提供的來源。醫療端的備援回覆會附上備援說明。
- 收件人固定為目前登入帳號在 Supabase Auth 的註冊信箱。醫療端使用醫療人員自己的信箱，不使用個案或家長的聯絡信箱。
- 回答旁顯示「本次未寄送」、「正在交寄」、「已交寄」或失敗原因。失敗可按「重試寄送」，不必重新詢問或再次產生回答。
- 寄送失敗不移除聊天室回答。切換帳號或個案會清除尚未使用的勾選與舊的重試操作；取得回答時若已切換對象，舊選擇不會啟動寄送。
- 「已交寄」代表 Resend 已接受請求，不代表收件匣已送達。請另查看收件匣、垃圾郵件及 Resend 寄送事件。

本功能不另外建立聊天紀錄資料表或長期寄送佇列；頁面內的問答與重試狀態保留至對話清除、切換或離開該頁面。寄信選擇不跨次詢問或跨帳號保存。

## 啟用 Resend

1. 在 Resend 建立寄件網域並完成驗證。正式寄給註冊使用者時，使用已驗證網域的寄件地址；測試寄件網域有收件限制，不能當作正式設定。見 [Resend 網域說明](https://resend.com/docs/dashboard/domains/introduction)。
2. 建立可寄信的 Resend API key，於後端 `.env.rag` 或部署環境加入：

```dotenv
RESEND_API_KEY=re_your_key
ASSISTANT_EMAIL_FROM=Forest Assistant <assistant@your-verified-domain.example>
ASSISTANT_EMAIL_RATE_MAX=10
```

3. 確認既有 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 與允許來源設定正確，重啟 `npm run server`。這些設定及 Resend key 都僅供後端使用，不能使用 `REACT_APP_` 前綴或打包進前端。
4. 在家長端及醫療端各以測試帳號完成一次未勾選、一次勾選的問答。確認未勾選時沒有寄送請求；勾選時信件只到當前帳號的註冊信箱，且內容與畫面相符。
5. 在 Resend 檢查接受、送達或退信事件，確認實際收件；再測試寄信失敗後重試及下一題恢復不寄送。

未設定 key 或寄件地址時，API 回傳明確的服務未啟用訊息，不會顯示已交寄。本機功能完成不等於部署環境已啟用服務。

## 後端與權限

`POST /api/assistant-email` 使用既有 CORS 與 Supabase 驗證流程，再依帳號限流；預設每帳號每分鐘最多 10 個請求，可用 `ASSISTANT_EMAIL_RATE_MAX` 調整。家長與醫療角色可使用此寄信端點，原本的臨床 AI API 仍限制醫療角色。

後端以 `auth.getUser(token)` 查證使用者，再取得該使用者的 Email，不採用請求中的 `to`、`email` 或個案信箱作收件人。見 [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)。

寄送請求須明確包含 `sendEmail: true`，另有 `requestId`、`askedAt`、`question`、`answer`、`sources`、`fallback`。寄送的是使用者端提交的問答副本，不視為不可修改的醫療紀錄。服務只傳送純文字，不將問答內容當成 HTML，也不在信件標題加入個案姓名。

後端呼叫固定的 Resend Email API，並以「查證帳號 ID 與本次紀錄 ID」建立穩定的 Idempotency-Key。頁面內重試沿用相同時間、問題與回答；Resend 的去重有效期為 24 小時，超過有效期不能保證重試不重複寄送。跨帳號使用相同紀錄編號會產生不同 key。見 [Resend 寄信 API](https://resend.com/docs/api-reference/emails/send-email) 與 [Idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)。

寄送失敗只回傳可理解的錯誤，不向前端暴露寄信金鑰或供應商原始錯誤。伺服器等待 Resend 最多 15 秒，前端等待寄信端點最多 20 秒，不自動循環重寄。

## 驗證

```powershell
npm run test:api
npm test -- --watchAll=false --runInBand --runTestsByPath src/components/AssistantEmailControls.test.jsx src/pages/assistantEmailFlow.test.jsx
npm run check
```

自動驗證涵蓋預設不寄送、逐題選擇、家長本機回覆、醫療 API 回覆與來源、註冊信箱防竄改、原醫療權限、登入失效、切換對象、失敗重試、穩定去重 key、來源網址與不可信 HTML、服務未設定及供應商錯誤。測試使用合成資料及寄信替身，不會寄送真實郵件；實際送達仍須於設定後完成收件驗證。
