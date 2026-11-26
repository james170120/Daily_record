// 📒 真實紀錄 → 每天的筆數 → 今日之花
//
// 跟主程式（index.html）共用：
//   - 同一個 n8n 讀取網址（N8N_GET_URL，在 js/config.js）
//   - 同一組花園通行碼（localStorage 的 garden_key，主程式輸入過這裡就不用再輸入）
//   - 同一套計算規則：系統報錯不算；捷徑上傳的步數一天只算 1 筆
//   - 同一份「已解鎖的花」（unlocked_flowers），抽到新花兩邊都看得到
// 這些全域函式來自 index.html 也在用的一般 <script>：
//   getGardenKey / gardenHeaders / isKeyRejected（api.js）、Store（store.js）、
//   getRecordKey / isShortcutStep（flower-seeds.js）、ALL_FLOWERS / DEFAULT_UNLOCKED_FLOWERS（data-flowers.js）

import { seededRandom } from './daily-bloom.js';

const CACHE_KEY = 'island_counts_cache';     // 沒網路時用上次的資料（只存每天筆數，不存內容）
const DAY_FLOWERS_KEY = 'island_day_flowers'; // { 日期: { file, isNew } }，已開過的今日之花

export class KeyRequiredError extends Error {}
export class KeyRejectedError extends Error {}

// ---------- 讀紀錄 ----------
// 回傳 { counts: {日期: 筆數}, recordsByDate: {日期: [紀錄]}, offline: 是否用快取 }
export async function fetchRecords(key = getGardenKey()) {
  if (!key) throw new KeyRequiredError();
  try {
    const res = await fetch(N8N_GET_URL + '?t=' + Date.now(), { headers: { 'X-Garden-Auth': key } });
    if (isKeyRejected(res)) throw new KeyRejectedError();
    if (!res.ok) throw new Error('網路回應異常 ' + res.status);
    const data = await res.json();
    const recordsByDate = groupByDate(data);
    const counts = countPerDay(recordsByDate);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(counts)); } catch (e) {}
    return { counts, recordsByDate, offline: false };
  } catch (err) {
    if (err instanceof KeyRejectedError) throw err;
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached) return { counts: cached, recordsByDate: null, offline: true };
    throw err;
  }
}

// 先試一次通行碼，對了才存（跟主程式的 submitGardenKey 一樣）
export async function tryGardenKey(key) {
  const result = await fetchRecords(key);
  Store.set('garden_key', key);
  return result;
}

export function groupByDate(data) {
  const out = {};
  (Array.isArray(data) ? data : []).filter(r => r && r.category !== 'error' && r.date).forEach(r => {
    const d = String(r.date).substring(0, 10);
    (out[d] = out[d] || []).push(r);
  });
  return out;
}

export function countPerDay(recordsByDate) {
  const counts = {};
  Object.keys(recordsByDate).forEach(date => {
    const recs = recordsByDate[date];
    const auto = recs.filter(isShortcutStep).length;
    counts[date] = recs.length - Math.max(0, auto - 1);   // 捷徑步數一天只算 1 筆
  });
  return counts;
}

// ---------- 今日之花要開哪一種 ----------
// 1. 已經開過的日子 → 永遠是同一朵（存在 island_day_flowers，會同步到後端）
// 2. 主程式那天已經幫紀錄抽過花 → 用那天抽到的花（有抽到新花的話優先用新花）
// 3. 都沒有 → 現在抽：從已解鎖的花挑；記越多，抽到新花的機率越高
const NEW_FLOWER_CHANCE = { small: 0.05, big: 0.10, gold: 0.20 };

export function createFlowerPicker(recordsByDate) {
  const dayFlowers = JSON.parse(Store.get(DAY_FLOWERS_KEY) || '{}');
  const recordFlowers = JSON.parse(Store.get('record_flowers') || '{}');
  let changed = false;
  const newlyUnlocked = [];

  function unlockedList() {
    return JSON.parse(Store.get('unlocked_flowers') || 'null') || [...DEFAULT_UNLOCKED_FLOWERS];
  }

  function pick(date, tier) {
    if (dayFlowers[date]) return dayFlowers[date];
    const rng = seededRandom('flower:' + date);
    let choice = null;

    // 主程式抽過的花
    const recs = recordsByDate?.[date] || [];
    const drawn = recs.map(r => recordFlowers[getRecordKey(date, r)]).filter(Boolean);
    if (drawn.length) {
      const fresh = drawn.filter(f => f.isNew);
      const pool = fresh.length ? fresh : drawn;
      const f = pool[Math.floor(rng() * pool.length)];
      choice = { file: f.file, isNew: !!f.isNew };
    }

    // 現在抽
    if (!choice) {
      const unlocked = unlockedList();
      const locked = ALL_FLOWERS.filter(f => !unlocked.includes(f));
      if (locked.length && rng() < (NEW_FLOWER_CHANCE[tier.key] || 0.05)) {
        const file = locked[Math.floor(rng() * locked.length)];
        unlocked.push(file);
        Store.set('unlocked_flowers', JSON.stringify(unlocked));
        Store.set('latest_unlocked_flower', JSON.stringify({ file, date }));
        newlyUnlocked.push(file);
        choice = { file, isNew: true };
      } else {
        choice = { file: unlocked[Math.floor(rng() * unlocked.length)], isNew: false };
      }
    }

    dayFlowers[date] = choice;
    changed = true;
    return choice;
  }

  function save() {
    if (changed) Store.set(DAY_FLOWERS_KEY, JSON.stringify(dayFlowers));
    changed = false;
  }

  return { pick, save, newlyUnlocked };
}
