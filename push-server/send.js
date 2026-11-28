// 🔔 群島花園：晚上 9 點提醒
//
// pm2 每天 13:00、21:00 各跑一次（伺服器時區是 UTC 或台灣都能對到台灣 21 點），跑完就結束：
//   1. 讀 n8n 的全部紀錄（跟群島同一個網址、同一組通行碼）
//   2. 找出開著提醒的手機（category 'push' 的紀錄，每支手機看最新一筆）
//   3. 今天（台灣日期）已經有步數 → 不送；沒有 → 送一句鼓勵＋提醒上傳步數
//
// node send.js --test   不管有沒有步數都送一次（測試用）
// node send.js --dry    只印出會做什麼，不送

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const env = process.env;
const TEST = process.argv.includes('--test');
const DRY = process.argv.includes('--dry');
const GET_URL = 'https://orthodox-oarfish.pikapod.net/webhook/get-health-records';

// 每天換一句（自己寫的，可以自由增刪；短短的，媽媽一眼看得完）
const CHEERS = [
  '今天也辛苦了，謝謝您好好照顧自己 🌸',
  '每走一步，花園就更漂亮一點 🌷',
  '慢慢來沒關係，今天也很棒喔 🌿',
  '狗狗說：今天也想跟您一起散步 🐕',
  '晚上了，喝口溫開水，好好休息 🍵',
  '您的健康，是全家最大的幸福 💛',
  '今天的您，比昨天更厲害了 ✨',
  '花園的花都在等您明天的好消息 🌼',
  '記得放鬆肩膀，深呼吸一下 🍃',
  '魚兒今天游得很開心，您也要開心喔 🐟',
  '一點一點累積，就是最好的力量 🌱',
  '今天有好好吃飯嗎？您最棒了 🍚',
  '月亮出來了，花園跟您說晚安 🌙',
  '每天記一點，身體會謝謝您的 💪',
  '蜜蜂在等步數，才能來採蜜喔 🐝'
];

function taipeiDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function log(...a) { console.log(new Date().toISOString(), ...a); }

async function main() {
  // pm2 在伺服器重開機時也會跑一次 → 只在台灣時間 21 點那一小時送，半夜不吵人
  const hour = +new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: '2-digit', hourCycle: 'h23' }).format(new Date());
  if (hour !== 21 && !TEST && !DRY) { log(`現在台灣 ${hour} 點，不是 21 點，不送`); return; }

  for (const k of ['GARDEN_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) {
    if (!env[k]) throw new Error(`.env 少了 ${k}`);
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT || 'https://james170120.github.io/Daily_record/', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  const res = await fetch(GET_URL + '?t=' + Date.now(), { headers: { 'X-Garden-Auth': env.GARDEN_KEY } });
  if (!res.ok) throw new Error('讀紀錄失敗 ' + res.status);
  const data = await res.json();
  const records = Array.isArray(data) ? data : [];

  // 每支手機最新的設定
  const devices = new Map();
  for (const r of records) {
    if (r?.category !== 'push') continue;
    let c;
    try { c = JSON.parse(r.content); } catch { continue; }
    if (!c?.device) continue;
    const prev = devices.get(c.device);
    if (!prev || (c.at || 0) > (prev.at || 0)) devices.set(c.device, c);
  }
  const targets = [...devices.values()].filter(c => c.on && c.sub?.endpoint);
  log(`開著提醒的手機：${targets.length} 支`);
  if (!targets.length) return;

  const today = taipeiDate();
  const steps = records.filter(r => r?.type === '步數' && String(r.date || '').slice(0, 10) === today);
  const uploaded = steps.length > 0;
  log(`今天 ${today} 步數紀錄：${steps.length} 筆`);
  if (uploaded && !TEST && env.ALWAYS_ENCOURAGE !== '1') { log('步數已上傳，不送'); return; }

  const day = Math.floor(Date.parse(today) / 86400000);
  const cheer = CHEERS[day % CHEERS.length];
  const payload = JSON.stringify(uploaded
    ? { title: '🌙 花園的晚安', body: cheer, url: './' }
    : { title: '🌙 花園的小提醒', body: `${cheer}\n今天的步數還沒上傳喔，點我上傳 👣`, url: './?steps=1' });

  for (const c of targets) {
    if (DRY) { log('（--dry）會送給', c.device, payload); continue; }
    try {
      const r = await webpush.sendNotification(c.sub, payload, { TTL: 3 * 3600, urgency: 'normal' });
      log('已送出', c.device, r.statusCode);
    } catch (e) {
      // 404 / 410 = 這支手機的推播地址失效了（刪了 App、關了通知），媽媽重新按 🔔 開啟就好
      log('送不出去', c.device, e.statusCode || '', e.body || e.message);
    }
  }
}

main().catch(e => { log('錯誤', e.message); process.exitCode = 1; });
