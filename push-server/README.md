# garden-push：晚上 9 點提醒

群島花園的推播小程式，放在家裡伺服器（homeserver）用 pm2 排程。

- 每天台灣時間 21:00 執行一次（pm2 `--cron-restart "0 13,21 * * *"`：伺服器時區不管是 UTC 還是台灣，都會有一次落在台灣 21 點；程式只在台灣 21 點那一小時送），跑完就結束
- 讀 n8n 的紀錄 → 今天沒有步數 → 送「一句鼓勵＋步數還沒上傳」給開了 🔔 的手機
- 手機的推播地址由群島存成 `category: 'push'` 的紀錄（n8n 不用改）
- 金鑰在伺服器 `~/projects/garden-push/.env`（不進 git，格式見 `.env.example`）

## 更新

```bash
git subtree push --prefix push-server homeserver main
```

## 測試

```bash
ssh homeserver 'cd ~/projects/garden-push && node send.js --dry'    # 只看會不會送
ssh homeserver 'cd ~/projects/garden-push && node send.js --test'   # 不管步數，真的送一次
ssh homeserver 'pm2 logs garden-push --lines 30 --nostream'
```
