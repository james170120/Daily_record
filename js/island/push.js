// 🔔 晚上 9 點提醒（網頁推播）
//
// 怎麼運作：
//   1. 媽媽按上方「🔔 提醒」→ 開啟 → iPhone 問「允許通知嗎」→ 允許
//   2. 這支手機的「推播地址」當成一筆特殊紀錄（category: 'push'）送到 n8n 存起來
//      （紀錄、月曆、今日之花都會略過 category 'push'，見 records.js groupByDate）
//   3. 家裡伺服器（push-server/）每天 21:00 讀紀錄：今天還沒有步數 → 送一句鼓勵＋提醒上傳步數
//   4. 點通知 → 打開群島，跳出「👣 上傳步數」按鈕
//
// iPhone 限制：iOS 16.4 以上，而且要從「主畫面圖示」打開（Safari 分頁收不到）。
// PUSH_PUBLIC_KEY 是 VAPID 公開金鑰，可以公開；私鑰只放在伺服器的 .env。

export const PUSH_PUBLIC_KEY = 'BMzp5trtTKGR9P5nod123nQWrSPhC8qzCVTTufYsrpLBKYOGaekO4RKKMnZnq6UnfZ4ce0PqiNSO7-EXf4dSg-I';
const DEVICE_KEY = 'island_push_device';   // 這支手機的代號（同一支手機重新開啟時，伺服器用最新那筆）
const ON_KEY = 'island_push_on';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 'ok' 可以用 | 'need-home' 要從主畫面打開 | 'old' 這支手機不支援 | 'blocked' 之前按了不允許
export function pushSupport() {
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!has) return isIOS() && !isStandalone() ? 'need-home' : 'old';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ok';
}

export function pushIsOn() {
  return localStorage.getItem(ON_KEY) === '1' && 'Notification' in window && Notification.permission === 'granted';
}

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function keyBytes(base64url) {
  const s = (base64url + '='.repeat((4 - base64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function pushRecord(on, sub) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    period: '', type: '推播設定', category: 'push',
    content: JSON.stringify({ on, device: deviceId(), at: Date.now(), sub: sub ? sub.toJSON() : null })
  };
}

// post(payload) → 'ok' | 'rejected' | 'error'（main.js 的 postRecord）
// 回傳 'ok' | 'denied' | 'unsupported' | 'error' | 'rejected'
export async function enablePush(post) {
  if (pushSupport() !== 'ok') return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_PUBLIC_KEY) });
    const r = await post(pushRecord(true, sub));
    if (r !== 'ok') return r;
    localStorage.setItem(ON_KEY, '1');
    return 'ok';
  } catch (e) {
    console.warn('push subscribe failed', e);
    return 'error';
  }
}

export async function disablePush(post) {
  const r = await post(pushRecord(false, null));
  if (r !== 'ok') return r;
  localStorage.removeItem(ON_KEY);
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (e) {}
  return 'ok';
}
