// 🌸 今日之花：一天的紀錄合成一朵花，島上一朵花 = 一天
//
// 規則：
//   - 每筆紀錄還是 1 顆種子（今天的種子在主島的「今日花苞」裡長大）
//   - 過了半夜 12 點，昨天的種子合成一朵「今日之花」種到島上
//   - 當天記越多，花越特別（見 TIERS）；沒記的那天沒有花，但不扣分
//   - 島上的花永久保留，點一下可以看到那天的日期和紀錄筆數
//
// 同一天永遠開出同一朵花、種在同一個位置（用日期當亂數種子），
// 所以不用另外存「哪天開了什麼花」，換手機也一樣。

export const TIERS = [
  { min: 1, key: 'small', label: '小花',     scale: 0.70, halo: false },
  { min: 4, key: 'big',   label: '大朵花',   scale: 0.92, halo: false },
  { min: 8, key: 'gold',  label: '金光花',   scale: 1.06, halo: true  }
];

export function tierFor(count) {
  let t = null;
  for (const tier of TIERS) if (count >= tier.min) t = tier;
  return t;
}

// 下一個等級還差幾筆（給今日花苞的鼓勵文字用）
export function nextTierHint(count) {
  const next = TIERS.find(t => count < t.min);
  return next ? { tier: next, need: next.min - count } : null;
}

// ---------- 日期 ----------
export function dateKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}
export function prettyDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const w = '日一二三四五六'[new Date(y, m - 1, d).getDay()];
  return `${m} 月 ${d} 日（${w}）`;
}

// ---------- 用日期當種子的亂數 ----------
export function seededRandom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function () {   // mulberry32
    h |= 0; h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 主函式 ----------
// countsByDate: { '2026-11-25': 6, ... }  每天的紀錄筆數
// today:        今天的日期 key（今天的不開花，留在花苞）
// pickFlower:   (date, tier) => { file, isNew }，決定那天開哪種花（見 records.js）
export function buildBlooms(countsByDate, today, pickFlower) {
  return Object.keys(countsByDate)
    .filter(k => k < today && countsByDate[k] > 0)
    .sort()
    .map(date => makeBloom(date, countsByDate[date], pickFlower));
}

export function makeBloom(date, count, pickFlower) {
  const rng = seededRandom('bloom:' + date);
  const tier = tierFor(count);
  const { file, isNew } = pickFlower(date, tier);
  return {
    date,
    count,
    tier,
    file,
    isNew,         // 這天抽到新的花種
    rng            // 決定位置用，同一天永遠同一個位置
  };
}

// 展示模式用：從全部的花裡依日期挑
export function demoPicker(flowerFiles) {
  return (date) => {
    const rng = seededRandom('demo-flower:' + date);
    return { file: flowerFiles[Math.floor(rng() * flowerFiles.length)], isNew: false };
  };
}

// ---------- 展示用假資料（第二步換成真正的紀錄）----------
export function demoCounts(today, days = 45) {
  const rng = seededRandom('demo-mom');
  const out = {};
  for (let i = days; i >= 1; i--) {
    const k = addDays(today, -i);
    const r = rng();
    if (r < 0.12) continue;                       // 偶爾忘了記
    out[k] = r < 0.45 ? 1 + Math.floor(rng() * 3)  // 1–3 筆
           : r < 0.85 ? 4 + Math.floor(rng() * 4)  // 4–7 筆
           : 8 + Math.floor(rng() * 4);            // 8–11 筆
  }
  out[today] = 2;
  return out;
}
