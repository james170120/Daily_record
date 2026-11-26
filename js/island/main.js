// 🏝️ 漂浮群島：場景、鏡頭、渲染迴圈、點擊
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { QUALITY, BUDGET } from './config.js';
import { createWorld, randomFlowerFile, getModel, placeModel } from './world.js';
import { flowerName, flowerInfo, getFlowerMaterial, loadFlowerAtlas, FLOWER_FILES } from './flowers.js';
import {
  buildBlooms, makeBloom, demoCounts, demoPicker, dateKey, addDays, prettyDate, tierFor, nextTierHint
} from './daily-bloom.js';
import { fetchRecords, tryGardenKey, createFlowerPicker, KeyRequiredError, KeyRejectedError } from './records.js';
import { ALL_MODEL_URLS } from './models-catalog.js';
import { petMode } from './pets.js';
import { animateWings } from './critters.js';
import { createGallery } from './gallery.js';
import { LATEST } from './versions.js';
import { createRecordPanel, RECORD_TYPES } from './record-panel.js';
import { createHistoryPanel } from './history-panel.js';
import { initThumbs, getThumb } from './thumbs.js';

const container = document.getElementById('canvas-container');
const statusTip = document.getElementById('status-tip');

// 下方提示列：平常每 15 秒換一句暖心小語（js/data-quotes.js）；
// 有重要提示（開花、解鎖、操作說明）時先顯示提示，停 8 秒後再回到小語
const QUOTE_EVERY = 15000, TIP_HOLD = 8000;
let lastTipAt = 0, quoteOrder = [], quoteTimer = 0;
function setTip(text) {
  statusTip.textContent = text;
  lastTipAt = Date.now();
}
function nextQuote() {
  if (typeof ENCOURAGE_QUOTES === 'undefined' || !ENCOURAGE_QUOTES.length) return;
  if (!quoteOrder.length) quoteOrder = ENCOURAGE_QUOTES.map((_, i) => i).sort(() => Math.random() - 0.5);
  statusTip.textContent = '🌤️ ' + ENCOURAGE_QUOTES[quoteOrder.pop()];
}
function startQuotes() {
  clearInterval(quoteTimer);
  quoteTimer = setInterval(() => {
    if (document.hidden || Date.now() - lastTipAt < TIP_HOLD) return;   // 重要提示還在顯示
    nextQuote();
    lastTipAt = 0;
  }, QUOTE_EVERY);
}
const DEBUG = new URLSearchParams(location.search).has('debug');

// ==========================================
// 1. 畫質（省電模式記在手機裡）
// ==========================================
let qualityKey = localStorage.getItem('island_quality') || 'normal';
let quality = QUALITY[qualityKey];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 150);
// 手機的解析度倍率本來就高，不另外開反鋸齒（省很多 GPU）
const renderer = new THREE.WebGLRenderer({
  antialias: window.devicePixelRatio <= 1, alpha: true, powerPreference: 'high-performance'
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFShadowMap;   // 比 PCFSoft 便宜很多，低多邊形風格看不出差別
container.appendChild(renderer.domElement);
initThumbs(renderer, getModel, placeModel);   // 圖鑑小圖用同一個 renderer 拍

function applyQuality() {
  quality = QUALITY[qualityKey];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxDpr));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = quality.shadows;
  dirLight.castShadow = quality.shadows;
  // 切換陰影開關後材質要重新編譯
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  const btn = document.getElementById('btn-quality');
  btn.textContent = qualityKey === 'saver' ? '⚡ 省電中' : '⚡ 省電';
  btn.classList.toggle('active', qualityKey === 'saver');
  wake();
}

// ==========================================
// 2. 光源：陰影只跟著「目前看的島」，陰影範圍小 → 品質好又便宜
// ==========================================
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x6ab04c, 0.95);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.35);
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.bias = -0.001;
scene.add(dirLight, dirLight.target);
const LIGHT_OFFSET = new THREE.Vector3(10, 18, 9);

function aimShadow(center, radius) {
  dirLight.target.position.copy(center);
  dirLight.position.copy(center).add(LIGHT_OFFSET);
  const cam = dirLight.shadow.camera;
  const r = radius + 1.5;
  cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
  cam.near = 2; cam.far = 45;
  cam.updateProjectionMatrix();
}

// ==========================================
// 3. 群島
// ==========================================
const world = createWorld(scene);
const interactables = [];   // 橋、樹、屋子等（花另外用螢幕座標判斷）
const ctx = {
  randomFlower: randomFlowerFile   // 寵物島池邊野花用
};

// 遠景雲朵
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 });
const clouds = [];
function spawnCloud(x, y, z, scale) {
  // 4 團雲合成 1 個網格（1 次繪製）
  const puffs = [[0, 0, 0, 0.9], [0.75, -0.1, 0.1, 0.68], [-0.75, -0.12, -0.05, 0.65], [0.2, 0.32, -0.1, 0.6]]
    .map(([px, py, pz, r]) => new THREE.DodecahedronGeometry(r, 0).translate(px, py, pz));
  const g = new THREE.Mesh(mergeGeometries(puffs), cloudMat);
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  scene.add(g);
  clouds.push({ mesh: g, baseX: x, speed: 0.12 + Math.random() * 0.1, range: 1.5 });
}
spawnCloud(-5.2, 3.2, -5.5, 1.15);
spawnCloud(9.5, 5.4, -17, 1.35);
spawnCloud(15.8, 2.8, -5.8, 1.05);
spawnCloud(-17, 4.4, -13, 1.2);

// ==========================================
// 4. 鏡頭與島嶼視角
// ==========================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 5.5;
controls.maxDistance = 32;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = Math.PI / 2 - 0.05;

const cameraGoal = { active: false, pos: new THREE.Vector3(), target: new THREE.Vector3() };
let currentView = 'main';
const BASE_OFFSET = new THREE.Vector3(3.6, 5.2, 10.2);
const OVERVIEW_DIR = new THREE.Vector3(3.0, 9.6, 17.8).normalize();

// 全景：自動框住所有島（之後多加島也不用改）
function overviewFrame() {
  const center = new THREE.Vector3();
  world.islands.forEach(i => center.add(i.basePos));
  center.divideScalar(world.islands.length);
  let R = 0;
  world.islands.forEach(i => { R = Math.max(R, i.basePos.distanceTo(center) + i.cfg.radius); });
  return { target: center.setY(0.6), dist: R * 2.15, radius: R };
}

function flyToView(key, immediate = false) {
  currentView = key;
  const aspect = innerWidth / innerHeight;
  const portrait = aspect < 1 ? Math.min(1.62, 0.96 / Math.max(aspect, 0.52)) : 1.0;
  let target, pos;

  if (key === 'overview') {
    const f = overviewFrame();
    target = f.target;
    pos = target.clone().addScaledVector(OVERVIEW_DIR, f.dist * portrait);
    controls.maxDistance = Math.max(32, f.dist * portrait * 1.25);
    aimShadow(f.target, f.radius);
  } else {
    const isl = world.byId[key];
    target = isl.basePos.clone().add(new THREE.Vector3(0, 0.7, 0));
    pos = target.clone().addScaledVector(BASE_OFFSET, (isl.cfg.radius / 4.35) * portrait);
    aimShadow(isl.basePos, isl.cfg.radius);
    isl.ensureContent(ctx).then(wake).catch(showLoadError);
  }

  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === key));

  if (immediate) {
    cameraGoal.active = false;
    controls.target.copy(target);
    camera.position.copy(pos);
    controls.update();
  } else {
    cameraGoal.target.copy(target);
    cameraGoal.pos.copy(pos);
    cameraGoal.active = true;
  }
  wake();
}

// ==========================================
// 5. 天氣（雨只下在鏡頭附近 → 島再多粒子數也不變）
// ==========================================
// 白天黑夜跟主程式一樣看真實時間：晚上 6 點到早上 6 點是夜晚（🌙 按鈕可以手動切換）
const isNightNow = () => { const h = new Date().getHours(); return h >= 18 || h < 6; };
let isNight = isNightNow(), isRaining = false;
const rainCount = 220;
const rainPos = new Float32Array(rainCount * 3);
for (let i = 0; i < rainCount; i++) {
  rainPos[i * 3] = (Math.random() - 0.5) * 18;
  rainPos[i * 3 + 1] = Math.random() * 11 - 2.5;
  rainPos[i * 3 + 2] = (Math.random() - 0.5) * 14;
}
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo,
  new THREE.PointsMaterial({ color: 0xaed6f1, size: 0.13, transparent: true, opacity: 0.75, depthWrite: false }));
rain.visible = false;
rain.frustumCulled = false;
scene.add(rain);

// ==========================================
// 🌌 夜空：星星（1 次繪製）＋流星（偶爾劃過，1 次繪製）
// ==========================================
const STAR_COUNT = 420;
const starPos = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  // 島浮在天空中，所以四面八方（包括腳下）都有星星
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(1 - 2 * Math.random());
  const r = 95;
  starPos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
  starPos[i * 3 + 1] = Math.cos(ph) * r - 8;
  starPos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r - 8;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  color: 0xfff8e1, size: 2.6, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false
});
const stars = new THREE.Points(starGeo, starMat);
stars.visible = false;
stars.frustumCulled = false;
scene.add(stars);

// 流星：一條尾巴漸淡的光（畫在一張長條貼圖上）
const meteorTex = (() => {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 16;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.75, 'rgba(255,244,214,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(0, 8); g.lineTo(240, 2); g.arc(248, 8, 6, -Math.PI / 2, Math.PI / 2); g.lineTo(240, 14); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const meteor = new THREE.Mesh(
  new THREE.PlaneGeometry(13, 0.7),
  new THREE.MeshBasicMaterial({ map: meteorTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
);
meteor.visible = false;
meteor.frustumCulled = false;
scene.add(meteor);
const meteorState = { active: false, t: 0, next: 3, start: new THREE.Vector3(), dir: new THREE.Vector3() };
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3(), _toCam = new THREE.Vector3(), _yAxis = new THREE.Vector3(), _basis = new THREE.Matrix4();

function startMeteor() {
  // 出現在鏡頭看得到的天空上方，往斜下方劃過
  camera.getWorldDirection(_fwd);
  _right.crossVectors(_fwd, camera.up).normalize();
  _up.crossVectors(_right, _fwd).normalize();
  const side = Math.random() < 0.5 ? -1 : 1;
  meteorState.start.copy(camera.position).addScaledVector(_fwd, 70)
    .addScaledVector(_right, side * (8 + Math.random() * 22))
    .addScaledVector(_up, 16 + Math.random() * 10);
  meteorState.dir.copy(_right).multiplyScalar(-side).addScaledVector(_up, -0.55).normalize();
  meteorState.t = 0;
  meteorState.active = true;
  meteor.visible = true;
}

function updateSky(t, dt) {
  stars.visible = isNight;
  meteor.visible = isNight && meteorState.active;
  if (!isNight) { meteorState.active = false; return; }
  starMat.opacity = 0.75 + Math.sin(t * 1.3) * 0.15;   // 微微閃爍

  if (!meteorState.active) {
    meteorState.next -= dt;
    if (meteorState.next <= 0) startMeteor();
    return;
  }
  // 劃過約 1 秒：先亮起來、再淡掉
  meteorState.t += dt;
  const u = meteorState.t / 1.3;
  if (u >= 1) {
    meteorState.active = false;
    meteor.visible = false;
    meteorState.next = 6 + Math.random() * 12;     // 每 6～18 秒一顆
    return;
  }
  meteor.position.copy(meteorState.start).addScaledVector(meteorState.dir, u * 30);
  // 長條的 x 軸沿著飛行方向、面向鏡頭
  _toCam.subVectors(camera.position, meteor.position).normalize();
  _yAxis.crossVectors(_toCam, meteorState.dir).normalize();
  const zAxis = _toCam.crossVectors(meteorState.dir, _yAxis).normalize();
  _basis.makeBasis(meteorState.dir, _yAxis, zAxis);
  meteor.quaternion.setFromRotationMatrix(_basis);
  meteor.material.opacity = Math.min(1, Math.sin(u * Math.PI) * 1.6);
}

function setNight(on) {
  isNight = on;
  document.getElementById('btn-time').textContent = on ? '☀️ 白天' : '🌙 夜晚';
  ctx.isNight = on;
  applySky();
}

// 白天／夜晚 × 晴天／下雨 → 天空顏色、光線、花的色調、螢火蟲、路燈
function applySky() {
  const on = isNight, wet = isRaining;
  document.body.classList.toggle('night', on);
  document.body.classList.toggle('raining', wet);
  dirLight.intensity = (on ? 0.32 : 1.35) * (wet ? 0.55 : 1);
  dirLight.color.setHex(on ? 0x90caf9 : (wet ? 0xdfe6ee : 0xfff5e0));
  hemiLight.intensity = (on ? 0.35 : 0.95) * (wet ? 0.8 : 1);
  const tint = on ? [0.5, 0.55, 0.75] : wet ? [0.82, 0.85, 0.9] : [1, 1, 1];
  loadFlowerAtlas().then(a => getFlowerMaterial(a).uniforms.uTint.value.setRGB(...tint));
  world.islands.forEach(i => {
    if (i.fireflies) i.fireflies.points.visible = on && !wet;   // 下雨螢火蟲不出來
    if (i.warmLight) i.warmLight.intensity = on ? 2.6 : 0;
    i.glows.forEach(g => { g.visible = on; });                 // 路燈、燈籠亮起來
  });
  rain.visible = wet;
  document.getElementById('btn-rain').textContent = wet ? '🌤️ 停雨' : '🌧️ 下雨';
  wake();
}

// 🌧️ 真實天氣：跟主程式一樣問 n8n（氣象署仁武區雨量站，最近 10 分鐘有雨就算下雨）
//   打開時查一次，之後回到群島最多每 30 分鐘再查一次
//   測試用：網址加 ?rain=1 強制下雨、?rain=0 強制晴天
let lastWeatherCheck = 0;
function setRaining(on, announce) {
  const was = isRaining;
  isRaining = on;
  applySky();
  if (announce && on && !was) setTip('🌧️ 仁武區現在正在下雨，小動物們都躲進屋子裡了');
  if (announce && !on && was) setTip('🌤️ 雨停了，小動物們出來散步囉');
}
async function checkWeather() {
  lastWeatherCheck = Date.now();
  const force = new URLSearchParams(location.search).get('rain');
  if (force === '1' || force === '0') { setRaining(force === '1', true); return; }
  if (DEMO || typeof WEATHER_URL === 'undefined' || !getGardenKey()) return;
  try {
    const res = await fetch(WEATHER_URL + '?t=' + Date.now(), { headers: gardenHeaders(false) });
    if (!res.ok) throw new Error('天氣回應異常 ' + res.status);
    const data = await res.json();
    setRaining(data.isRaining === true, true);
  } catch (e) {
    console.warn('無法取得天氣資料，維持原本的天氣', e);
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - lastWeatherCheck > 30 * 60 * 1000) checkWeather();
});

// ==========================================
// 6. 種花：主島滿了 → 種到下一座花島；都滿了 → 解鎖新花島
// ==========================================
const flowerIslands = world.islands.filter(i => i.cfg.kind === 'flower');

// 紀錄資料：{ 日期: 筆數 }
// 正式：讀 n8n 的真紀錄。網址加 ?demo=1 → 用假資料，並顯示「記一筆／過一天」測試按鈕
const DEMO = new URLSearchParams(location.search).has('demo');
let today = dateKey(new Date());
let counts = {};
let picker = null;           // 決定每天開哪種花
let recordsByDate = null;    // 每天的紀錄明細（判斷綠繡眼用；沒網路時是 null）
let lastFetch = 0;

// 🐕🐦 寵物解鎖：跟主程式同一套條件。主程式已經解鎖過的（存在進度裡）也算
function streakDays() {
  let d = today, n = 0;
  if (!counts[d]) d = addDays(d, -1);     // 今天還沒記不會馬上歸零
  while (counts[d] > 0) { n++; d = addDays(d, -1); }
  return n;
}
function hasFullDay() {
  if (!recordsByDate || typeof FULL_DAY_TYPES === 'undefined') return false;
  return Object.values(recordsByDate).some(recs => FULL_DAY_TYPES.every(t => recs.some(r => r.type === t)));
}
// 💧 喝水達標天數：一天的喝水紀錄加起來 ≥ 1500 ml（跟主程式吸引蝴蝶的標準一樣），不用連續
const WATER_GOAL_ML = 1500;
const WATER_CACHE_KEY = 'island_water_days';   // 沒網路時用上次算好的天數
function countWaterDays() {
  if (DEMO) return 0;
  if (!recordsByDate) return parseInt(localStorage.getItem(WATER_CACHE_KEY)) || 0;
  const n = Object.values(recordsByDate).filter(recs =>
    recs.filter(r => r.type === '喝水').reduce((s, r) => s + (parseInt(r.content) || 0), 0) >= WATER_GOAL_ML
  ).length;
  try { localStorage.setItem(WATER_CACHE_KEY, String(n)); } catch (e) {}
  return n;
}

// 🪑 裝飾品：每累計 7 天有紀錄（不用連續）多 1 個，順序見 js/data-decor.js 的 DECOR_ORDER
function totalRecordDays() {
  return Object.keys(counts).filter(k => counts[k] > 0).length;
}
function computeDecorUnlocked() {
  if (typeof DECOR_ORDER === 'undefined') return new Set();
  if (DEMO) return new Set(DECOR_ORDER);
  const saved = new Set(JSON.parse(Store.get('unlocked_decor') || '[]'));
  const weeks = Math.floor(totalRecordDays() / DECOR_DAYS_PER_ITEM);
  const fresh = DECOR_ORDER.slice(0, weeks).filter(id => !saved.has(id));
  if (fresh.length) {
    fresh.forEach(id => saved.add(id));
    Store.set('unlocked_decor', JSON.stringify([...saved]));
    const items = fresh.map(id => DECOR_INFO.find(d => d.id === id));
    const where = (d) => world.byId[d.island]?.cfg.name || '';
    // 一次解鎖很多個（例如第一次打開）就合成一則通知，不要連跳好幾個視窗
    if (items.length === 1) {
      const d = items[0];
      announce_(getThumb('decor:' + d.id), `新的裝飾品：${d.name}！`,
        `記錄滿 ${weeks} 週了，「${where(d)}」多了一個${d.name}。\n\n${d.desc}`);
    } else {
      announce_('🎁', `收到 ${items.length} 個新的裝飾品！`,
        `已經記錄滿 ${weeks} 週，島上多了：\n\n` + items.map(d => `${d.emoji} ${d.name}（${where(d)}）`).join('\n') +
        '\n\n到各個島上看看，或打開「📖 圖鑑」的裝飾頁。');
    }
  }
  return saved;
}

// 🐟 魚的解鎖：條件寫在 js/data-fish.js 的 unlock
// 解鎖過的魚記在 unlocked_fish（會同步到後端），之後就一直住在池塘，不會因為資料讀不到而消失
function progressInfo() {
  return {
    counts, recordsByDate, streak: streakDays(), waterDays: ctx.waterDays || 0,
    totalDays: Object.keys(counts).filter(k => counts[k] > 0).length
  };
}
function computeFishUnlocked() {
  if (typeof FISH_INFO === 'undefined') return [];
  if (DEMO) return FISH_INFO.slice();
  const saved = new Set(JSON.parse(Store.get('unlocked_fish') || '[]'));
  const p = progressInfo();
  const fresh = FISH_INFO.filter(f => !saved.has(f.id) && typeof f.unlock === 'function' && f.unlock(p));
  if (fresh.length) {
    fresh.forEach(f => {
      saved.add(f.id);
      announce_(getThumb('fish:' + f.id), `新朋友搬進池塘：${f.name}！`,
        `喝水達標的日子累積到 ${f.waterDays} 天，${f.name}搬進了魚兒池塘 ${f.emoji}\n\n` +
        '平常是水面下的黑影，耐心看，牠偶爾會跳出水面喔！');
    });
    Store.set('unlocked_fish', JSON.stringify([...saved]));
  }
  return FISH_INFO.filter(f => saved.has(f.id));
}

function computePetUnlocks() {
  if (DEMO) return { shiba: true, gs: true, bluebird: true, greenbird: true };
  const s = streakDays();
  const flag = (k) => Store.get(k) === 'true';
  return {
    shiba: s >= 7 || flag('dog_unlocked_notified'),
    gs: s >= 30 || flag('gs_unlocked_notified'),
    bluebird: s >= 60 || flag('bird_unlocked_notified'),
    greenbird: flag('greenbird_unlocked_notified') || hasFullDay()
  };
}

async function loadRecords() {
  if (DEMO) {
    counts = demoCounts(today, 75);   // 75 天：主島 50 朵種滿，花海島也開始有花
    fillDemoRecords();
    picker = { pick: demoPicker(FLOWER_FILES), save() {}, newlyUnlocked: [] };
    return { offline: false };
  }
  // ⚠️ 不從後端拉進度：記錄頁（record.html，舊版花園）直接改手機裡的進度、沒有記修改時間，
  //    如果這裡用後端的舊資料蓋過去，媽媽剛抽到的花可能會不見。兩邊都讀同一支手機的資料最安全。
  const r = await fetchRecords();
  counts = r.counts;
  recordsByDate = r.recordsByDate;
  picker = createFlowerPicker(r.recordsByDate);
  lastFetch = Date.now();
  return r;
}

// 一朵今日之花依序找位置：前一座島滿了才換下一座，遇到鎖住的島就解鎖它
async function placeBloom(bloom, { announce = false } = {}) {
  for (const isl of flowerIslands) {
    if (!isl.unlocked) await unlockIsland(isl, announce);
    await isl.ensureContent(ctx);
    if (!isl.isFull) {
      isl.plantBloom(bloom);
      return isl;
    }
  }
  return null;   // 所有花島都滿了（之後在 config.js 多加花島）
}

// 解鎖通知只跳一次：記住已經看過哪些島
const SEEN_KEY = 'island_unlock_seen';
// 展示模式（?demo=1）只存在這支手機的另一個位置，完全不碰媽媽的進度，也不會同步到後端
const progressGet = (k) => DEMO ? localStorage.getItem('demo_' + k) : Store.get(k);
const progressSet = (k, v) => DEMO ? localStorage.setItem('demo_' + k, v) : Store.set(k, v);
const seenUnlocks = new Set(JSON.parse(progressGet(SEEN_KEY) || '[]'));

async function unlockIsland(island, announce) {
  island.unlock();
  await island.ensureContent(ctx);
  for (const b of world.bridges) if (b.ready && !b.built) await b.build(interactables);
  buildViewButtons();
  if (announce && !seenUnlocks.has(island.id)) {
    seenUnlocks.add(island.id);
    progressSet(SEEN_KEY, JSON.stringify([...seenUnlocks]));
    announce_(island.cfg.icon, `解鎖新島嶼：${island.cfg.name}！`,
      island.cfg.kind === 'pet'
        ? '連續記錄滿 7 天，小柴犬搬到寵物島了！\n點上方的「🏡 寵物秘境」去看看牠。'
        : '前一座花島已經開滿了花，浮石橋長出來了！\n之後的今日之花會種到這座新島上。');
  }
  wake();
}

// 開啟中先排隊，等畫面出來、關掉一個再跳下一個
let booting = true;
const pendingAnnouncements = [];
function announce_(icon, title, desc) {
  pendingAnnouncements.push(() => openModal(icon, title, desc));
  if (!booting && !modal.classList.contains('show')) pendingAnnouncements.shift()();
}
function announceNewFlowers() {
  picker.newlyUnlocked.splice(0).forEach(file => {
    const info = flowerInfo(file);
    announce_('🎉', `抽到新的花：${flowerName(file)}！`,
      '記得越多的日子，越容易開出新品種的花。' + (info ? `\n\n花語：${info.lang}` : ''));
  });
}

function totalBloomDays() {
  return flowerIslands.reduce((s, i) => s + i.flowerCount, 0);
}

// 🌱 今日花苞：今天記越多，芽長越高
function updateBud() {
  const bud = world.byId.main.bud;
  const n = counts[today] || 0;
  if (!bud) return;
  bud.sprout.visible = n > 0;
  bud.sprout.scale.setScalar(0.2 + Math.min(n, 11) * 0.045);

  const tier = tierFor(n);
  const hint = nextTierHint(n);
  let desc;
  if (n === 0) {
    desc = '今天還沒有紀錄。\n記一筆，花苞就會冒出芽來 🌱';
  } else {
    desc = `今天已經記了 ${n} 筆！\n明天會開成一朵「${tier.label}」。`;
    if (hint) desc += `\n\n再記 ${hint.need} 筆，就會變成「${hint.tier.label}」${hint.tier.halo ? ' ✨' : ''}`;
  }
  bud.group.userData.desc = desc;
  wake();
}

function bloomCardText(f) {
  const info = flowerInfo(f.file);
  const lang = info ? `\n\n花語：${info.lang}\n${info.desc}` : '';
  if (!f.meta) return '島上的野花。' + lang;
  const b = f.meta;
  return `📅 ${prettyDate(b.date)}\n那天記了 ${b.count} 筆，開出「${b.tier.label}」${b.tier.halo ? ' ✨' : ''}` +
    (b.isNew ? '\n🎉 這一天抽到了新品種！' : '') + lang;
}

// 從主程式記完回到群島：重新讀一次今天的筆數，花苞馬上長大
// 換日了（過了半夜）就重新整理，讓昨天的今日之花開出來
async function refreshToday() {
  if (DEMO) return;
  if (!stepSyncPending && Date.now() - lastFetch < 20000) return;
  if (dateKey(new Date()) !== today) { location.reload(); return; }
  try {
    const r = await fetchRecords();
    lastFetch = Date.now();
    counts = r.counts;
    recordsByDate = r.recordsByDate;
    updateBud();
    if (stepSyncPending) {
      stepSyncPending = false;
      const steps = (recordsByDate?.[today] || []).filter(x => x.type === '步數').map(x => parseInt(x.content) || 0);
      const max = steps.length ? Math.max(...steps) : 0;
      if (max > stepsBeforeSync) {
        openModal('👣', '步數收到了！', `今天已經走了 ${max} 步` + (max >= 3000 ? '，勤勞的蜜蜂也飛來了 🐝' : '，繼續加油 👣'));
        checkNewUnlocks();
      } else {
        openModal('👣', '還沒收到步數', '捷徑好像還沒跑完，或沒有成功。\n可以等一下再回來看，或按「📝 記錄」→「步數」自己輸入。');
      }
    }
  } catch (e) { /* 沒網路就維持原樣 */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshToday(); });

// --- 測試按鈕：模擬過了一天 ---

async function passOneDay() {
  const n = counts[today] || 0;
  const finished = today;
  today = addDays(today, 1);
  counts[today] = 0;
  updateBud();
  if (n === 0) {
    setTip(`${prettyDate(finished)} 沒有紀錄，沒關係，今天再加油 🌤️`);
    return;
  }
  const bloom = makeBloom(finished, n, picker.pick);
  const isl = await placeBloom(bloom, { announce: true });
  if (!isl) {
    openModal('🌼', '所有花島都開滿了', '之後會有更多花島可以解鎖！');
    return;
  }
  if (currentView !== isl.id) flyToView(isl.id);
  setTip(`🌸 ${prettyDate(finished)} 的今日之花開了：${flowerName(bloom.file)}（${bloom.tier.label}）· 花園共 ${totalBloomDays()} 天`);
  wake();
}

// ==========================================
// 7. HUD：島嶼按鈕由設定檔自動產生
// ==========================================
function buildViewButtons() {
  const row = document.getElementById('view-row');
  row.innerHTML = '';
  const make = (key, label) => {
    const b = document.createElement('button');
    b.className = 'hud-btn' + (key === currentView ? ' active' : '');
    b.dataset.view = key;
    b.textContent = label;
    b.addEventListener('click', () => flyToView(key));
    row.appendChild(b);
  };
  world.islands.filter(i => i.unlocked).forEach(i => make(i.id, `${i.cfg.icon} ${i.cfg.name}`));
  make('overview', '☁️ 群島全景');
}

const modal = document.getElementById('info-modal');
let isPaused = false;
// icon 可以是：emoji 文字、圖片檔名（.png）、小圖（data:）、或還在拍的小圖（Promise）
function setModalIcon(icon) {
  const iconEl = document.getElementById('modal-icon');
  iconEl.textContent = '';
  if (icon && typeof icon.then === 'function') {
    iconEl.textContent = '⏳';
    icon.then(setModalIcon).catch(() => { iconEl.textContent = '✨'; });
    return;
  }
  if (/\.png$|^data:image\//.test(icon)) {
    const img = document.createElement('img');
    img.src = icon;
    img.alt = '';
    img.style.cssText = 'width:96px;height:96px;object-fit:contain;' + (/\.png$/.test(icon) ? 'image-rendering:pixelated;' : '');
    iconEl.appendChild(img);
  } else {
    iconEl.textContent = icon;
  }
}
function openModal(icon, title, desc) {
  setModalIcon(icon);
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-desc').textContent = desc;
  modal.classList.add('show');
  controls.update();
  renderer.render(scene, camera);   // 先畫好一張當背景，再暫停
  isPaused = true;   // 彈窗打開時 3D 完全停止
}
document.getElementById('modal-close-btn').addEventListener('click', () => {
  modal.classList.remove('show');
  isPaused = false;
  wake();
  if (pendingAnnouncements.length) setTimeout(() => pendingAnnouncements.shift()(), 400);
  else if (reloadAfterModal) location.reload();   // 記錄後島上有新東西（新寵物、魚、裝飾品、補登昨天）
});

// ==========================================
// 📝 記錄（js/island/record-panel.js）
// ==========================================
let reloadAfterModal = false;
let stepSyncPending = false, stepsBeforeSync = 0;
const demoRecords = {};   // 展示模式：記在這裡，不上傳

// 展示模式：依假資料的每天筆數，生出看起來像真的紀錄（月曆、紀錄表才有東西看）
function fillDemoRecords() {
  const samples = [
    ['早餐', 'food', '', () => '稀飯、荷包蛋、青菜'], ['午餐', 'food', '', () => '糙米飯、滷雞腿、炒高麗菜'],
    ['晚餐', 'food', '', () => '魚湯、地瓜葉'], ['喝水', 'water', '', (r) => String([250, 300, 500][Math.floor(r * 3)])],
    ['血壓', 'bp', '早上', (r) => `${118 + Math.floor(r * 30)}/${72 + Math.floor(r * 18)} 脈搏${68 + Math.floor(r * 15)}`],
    ['血糖', 'glucose', '', (r) => String(95 + Math.floor(r * 70))], ['吃藥', 'medical', '早', () => '降血壓藥'],
    ['步數', 'steps', '', (r) => String(1500 + Math.floor(r * 4000))], ['胰島素', 'medical', '晚', () => '8'],
    ['血壓', 'bp', '晚上', (r) => `${122 + Math.floor(r * 26)}/${75 + Math.floor(r * 15)} 脈搏${70 + Math.floor(r * 12)}`],
    ['身體狀況', 'status', '', () => '精神不錯']
  ];
  const times = ['07:30', '12:10', '18:20', '09:00', '08:00', '07:45', '08:30', '16:00', '21:00', '20:00', '10:00'];
  Object.keys(counts).forEach(date => {
    let seed = 0;
    for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    demoRecords[date] = Array.from({ length: Math.min(counts[date], samples.length) }, (_, i) => {
      const [type, category, period, make] = samples[i];
      return { id: date + i, date, time: type === '血壓' ? (period === '早上' ? '08:00' : '20:00') : times[i], period, type, category, content: make(rnd()) };
    });
  });
}

function recordsFor(date) {
  if (DEMO) return demoRecords[date] || [];
  return recordsByDate?.[date] || [];
}

async function postRecord(payload) {
  try {
    const res = await fetch(N8N_POST_URL, { method: 'POST', headers: gardenHeaders(true), body: JSON.stringify(payload) });
    if (isKeyRejected(res)) return 'rejected';
    return res.ok ? 'ok' : 'error';
  } catch (e) {
    return 'error';
  }
}

// 記錄之後，看看有沒有解鎖新東西（寵物、魚、裝飾品）→ 有的話跳通知，關掉後重新整理讓它們出現
function checkNewUnlocks() {
  const before = {
    pets: JSON.stringify(ctx.petUnlocks || {}),
    fish: (ctx.fishUnlocked || []).length,
    decor: (ctx.decorUnlocked || new Set()).size
  };
  ctx.waterDays = countWaterDays();
  const pets = computePetUnlocks();
  const fish = computeFishUnlocked();
  const decor = computeDecorUnlocked();
  if (JSON.stringify(pets) !== before.pets || fish.length !== before.fish || decor.size !== before.decor) {
    reloadAfterModal = true;
    if (JSON.stringify(pets) !== before.pets) announce_('🐾', '有新朋友搬來寵物島了！', '連續記錄的日子到了，關掉這個視窗後，到寵物島看看牠吧！');
  }
}

const recordPanel = createRecordPanel({
  root: document.getElementById('rec-modal'),
  demo: DEMO,
  getRecords: recordsFor,
  save: postRecord,
  onOpenHistory: () => openHistory(),
  onKeyRejected: () => { Store.remove('garden_key'); askGardenKey('花園通行碼已經更換，請重新輸入').then(() => location.reload()); },
  onStepSyncStart: () => {
    stepSyncPending = true;
    const steps = recordsFor(today).filter(x => x.type === '步數').map(x => parseInt(x.content) || 0);
    stepsBeforeSync = steps.length ? Math.max(...steps) : 0;
  },
  async onSaved({ payload, demo, message }) {
    const isNew = payload.id == null;
    if (demo) {
      const list = demoRecords[payload.date] = demoRecords[payload.date] || [];
      if (isNew) {
        list.push({ ...payload, id: Date.now() });
        counts[payload.date] = (counts[payload.date] || 0) + 1;
      } else {
        const i = list.findIndex(r => r.id === payload.id);
        if (i >= 0) list[i] = { ...payload };
      }
    } else {
      try {
        const r = await fetchRecords();
        lastFetch = Date.now();
        counts = r.counts;
        recordsByDate = r.recordsByDate;
      } catch (e) { if (isNew) counts[payload.date] = (counts[payload.date] || 0) + 1; }
    }
    updateBud();
    if (payload.date === today && currentView !== 'main') flyToView('main');
    const n = counts[today] || 0;
    const tail = payload.date === today ? `\n\n🌱 今天已經記了 ${n} 筆，今日花苞又長大了！` : '';
    openModal(RECORD_TYPES.find(t => t.type === payload.type)?.emoji || '📝', '紀錄好囉！',
      message + tail + (demo ? '\n\n（展示模式：沒有真的上傳）' : ''));
    if (payload.date !== today) reloadAfterModal = !demo;     // 補登昨天：昨天的今日之花要重新開
    if (!demo) checkNewUnlocks();
  }
});

async function needKey() {
  if (DEMO || getGardenKey()) return false;
  await askGardenKey('');
  location.reload();
  return true;
}
async function openRecordPanel(date) {
  if (await needKey()) return;
  recordPanel.open(date);
}
const historyPanel = createHistoryPanel({
  root: document.getElementById('his-modal'),
  getRecords: recordsFor,
  onAddRecord: (date) => openRecordPanel(date)
});
async function openHistory() {
  if (await needKey()) return;
  historyPanel.open();
}
document.getElementById('btn-rec').addEventListener('click', () => openRecordPanel());
document.getElementById('btn-hist').addEventListener('click', openHistory);

// 📖 圖鑑：花／寵物／魚／裝飾品（新增分頁見 js/island/gallery.js 的 GALLERY_TABS）
function galleryState() {
  const unlockedFlowers = DEMO
    ? new Set(typeof ALL_FLOWERS !== 'undefined' ? ALL_FLOWERS : [])
    : new Set(JSON.parse(Store.get('unlocked_flowers') || 'null') ||
              (typeof DEFAULT_UNLOCKED_FLOWERS !== 'undefined' ? DEFAULT_UNLOCKED_FLOWERS : []));
  const bloomCount = {};
  world.islands.forEach(i => i.patch && i.cfg.kind === 'flower' &&
    i.patch.flowers.forEach(f => { bloomCount[f.file] = (bloomCount[f.file] || 0) + 1; }));
  return {
    demo: DEMO,
    unlockedFlowers, bloomCount,
    petUnlocks: ctx.petUnlocks || {},
    fishUnlocked: new Set((ctx.fishUnlocked || []).map(f => f.id)),
    decorUnlocked: ctx.decorUnlocked || new Set(),
    waterDays: ctx.waterDays || 0,
    totalDays: totalRecordDays(),
    getThumb,
    islandName: (id) => world.byId[id] ? `${world.byId[id].cfg.icon} ${world.byId[id].cfg.name}` : id
  };
}
const gallery = createGallery({
  modal: document.getElementById('gal-modal'),
  tabs: document.getElementById('gal-tabs'),
  body: document.getElementById('gal-body'),
  count: document.getElementById('gal-count')
}, galleryState, (it) => {
  const pic = it.img || (it.thumbKey ? getThumb(it.thumbKey, !it.unlocked) : it.emoji);
  if (it.unlocked) openModal(pic, it.name, it.desc + (it.tip ? `

💡 ${it.tip}` : ''));
  else openModal(it.img || it.thumbKey ? pic : '❓', '???', `還沒有收集到。

解鎖條件：${it.lockText}`);
});
function openGallery(tab) { gallery.open(tab); }
document.getElementById('btn-gallery').addEventListener('click', () => openGallery());
document.getElementById('gal-close').addEventListener('click', () => {
  gallery.close();
  if (!booting && pendingAnnouncements.length) setTimeout(() => pendingAnnouncements.shift()(), 400);   // 看完改版紀錄，接著顯示解鎖通知
});

// 🎉 改版大驚喜：改版後第一次打開，跳出一次說明（?whatsnew=1 可以再看一次）
const newModal = document.getElementById('new-modal');
const SEEN_VERSION_KEY = (DEMO ? 'demo_' : '') + 'island_seen_version';
function queueWhatsNew() {
  const force = new URLSearchParams(location.search).has('whatsnew');
  if (!force && localStorage.getItem(SEEN_VERSION_KEY) === LATEST.id) return;
  pendingAnnouncements.unshift(() => {   // 排在所有解鎖通知前面
    document.getElementById('new-text').textContent = LATEST.popup;
    newModal.classList.add('show');
    renderer.render(scene, camera);
    isPaused = true;
  });
}
function closeWhatsNew(thenGallery) {
  localStorage.setItem(SEEN_VERSION_KEY, LATEST.id);
  newModal.classList.remove('show');
  isPaused = false;
  wake();
  if (thenGallery) openGallery('versions');
  else if (pendingAnnouncements.length) setTimeout(() => pendingAnnouncements.shift()(), 400);
}
document.getElementById('new-ok').addEventListener('click', () => closeWhatsNew(false));
document.getElementById('new-more').addEventListener('click', () => closeWhatsNew(true));

// 🔑 花園通行碼（跟主程式同一組；在主程式輸入過，這裡就不會出現）
const keyModal = document.getElementById('key-modal');
function askGardenKey(msg) {
  return new Promise((resolve) => {
    document.getElementById('key-msg').textContent = msg || '';
    keyModal.classList.add('show');
    const input = document.getElementById('key-input');
    const btn = document.getElementById('key-submit');
    btn.onclick = async () => {
      const key = input.value.trim();
      if (!key) { document.getElementById('key-msg').textContent = '請先輸入通行碼'; return; }
      btn.textContent = '確認中...';
      try {
        const r = await tryGardenKey(key);
        input.value = '';
        keyModal.classList.remove('show');
        resolve(r);
      } catch (e) {
        document.getElementById('key-msg').textContent =
          e instanceof KeyRejectedError ? '通行碼不對，請再確認一次' : '網路好像不太穩，請稍後再試一次';
      } finally {
        btn.textContent = '進入花園';
      }
    };
  });
}

document.getElementById('btn-time').addEventListener('click', () => setNight(!isNight));
document.getElementById('btn-rain').addEventListener('click', () => setRaining(!isRaining, false));
document.getElementById('btn-nextday').addEventListener('click', () => passOneDay().catch(showLoadError));
document.getElementById('btn-quality').addEventListener('click', () => {
  qualityKey = qualityKey === 'saver' ? 'normal' : 'saver';
  localStorage.setItem('island_quality', qualityKey);
  applyQuality();
});

// ==========================================
// 8. 點擊與長按
//    - 長按 1 秒：看介紹（花、寵物、裝飾品、屋子、池塘…），手指下會有一圈慢慢填滿
//    - 輕點：飛到那座島；點博物館直接打開圖鑑；點到東西只提示「長按看介紹」
//    長輩容易誤觸，所以介紹視窗不再一點就跳出來
// ==========================================
const LONG_PRESS_MS = 1000;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downX = 0, downY = 0, downAt = 0, pointerIsDown = false;
let pressTimer = 0, pressFired = false, activePointers = 0;
const ring = document.getElementById('press-ring');

function isShown(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}
function findData(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData && o.userData.title) return o.userData;
  return null;
}
function islandOf(obj) {
  for (let o = obj; o; o = o.parent) {
    const isl = world.islands.find(i => i.group === o);
    if (isl) return isl;
  }
  return null;
}

// 手指下面是什麼
function pickAt(x, y) {
  pointer.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const all = [...interactables, ...world.islands.flatMap(i => i.interactables)].filter(isShown);
  const objHit = raycaster.intersectObjects(all, true)[0];

  let flowerHit = null;
  for (const isl of world.islands) {
    if (!isl.patch || !isl.content || !isl.content.visible) continue;
    const h = isl.patch.pick(x, y, camera, innerWidth, innerHeight);
    if (h && (!flowerHit || h.depth < flowerHit.depth)) flowerHit = { ...h, island: isl };
  }
  if (flowerHit && (!objHit || flowerHit.depth < objHit.distance + 0.3)) {
    return { kind: 'flower', flower: flowerHit.flower, island: flowerHit.island };
  }
  if (objHit) {
    const d = findData(objHit.object);
    if (d) return { kind: d.openGallery ? 'gallery' : 'object', data: d, island: islandOf(objHit.object) };
  }
  const islandHit = raycaster.intersectObjects(world.islands.map(i => i.grassMesh), false)[0];
  if (islandHit) return { kind: 'island', island: world.byId[islandHit.object.userData.islandId] };
  return null;
}

// 長按：打開介紹
function showInfo(hit) {
  if (!hit) return;
  if (hit.kind === 'flower') {
    const f = hit.flower;
    openModal(f.file, flowerName(f.file) + (f.meta?.tier.halo ? ' ✨' : ''), bloomCardText(f));
  } else if (hit.kind === 'gallery') {
    openGallery();
  } else if (hit.kind === 'object') {
    const d = hit.data;
    openModal(d.thumbKey ? getThumb(d.thumbKey) : d.icon, d.title, d.desc);
  } else if (hit.kind === 'island' && !hit.island.unlocked) {
    openModal('🔒', `${hit.island.cfg.name}（尚未解鎖）`, hit.island.cfg.lockHint || '繼續記錄就會解鎖！');
  }
}

// 輕點：飛過去
function handleTap(hit) {
  if (!hit) return;
  if (hit.kind === 'gallery') { openGallery(); return; }
  const isl = hit.island;
  if (isl && !isl.unlocked) { setTip(`🔒 ${isl.cfg.name}還沒解鎖，長按看看怎麼解鎖`); return; }
  if (isl && isl.id !== currentView) { flyToView(isl.id); return; }
  if (hit.kind === 'object' && hit.data.forceRefresh && treeTapped()) return;
  if (hit.kind === 'flower' || hit.kind === 'object') setTip('👆 手指按住 1 秒，就能看介紹喔');
}

// 🌳 大樹連點 5 下（每下間隔 2 秒內）：抓最新版重新開啟，跟舊版花園一樣
let treeTaps = 0, treeTapTimer = 0;
function treeTapped() {
  treeTaps++;
  clearTimeout(treeTapTimer);
  if (treeTaps >= 5) {
    treeTaps = 0;
    setTip('🔄 正在更新到最新版...');
    const go = () => {
      const q = new URLSearchParams(location.search);
      q.set('v', Date.now());
      location.replace(location.pathname + '?' + q.toString());
    };
    const sw = navigator.serviceWorker;
    if (!sw) { go(); return true; }
    sw.getRegistration()
      .then(r => r && r.update())
      .catch(() => {})
      .finally(go);
    setTimeout(go, 3000);   // 網路卡住也不要等太久
    return true;
  }
  treeTapTimer = setTimeout(() => { treeTaps = 0; }, 2000);
  if (treeTaps >= 3) { setTip(`🌳 再點 ${5 - treeTaps} 下就會更新`); return true; }
  return false;
}

function cancelPress() {
  clearTimeout(pressTimer);
  pressTimer = 0;
  ring.classList.remove('show');
}

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', (e) => {
  activePointers++;
  pointerIsDown = true;
  wake();
  if (activePointers > 1) { cancelPress(); return; }   // 兩指縮放，不算長按
  downX = e.clientX; downY = e.clientY; downAt = performance.now();
  pressFired = false;
  // 0.2 秒後才出現圈圈，輕點的時候不會閃一下
  ring.style.left = e.clientX + 'px';
  ring.style.top = e.clientY + 'px';
  pressTimer = setTimeout(() => {
    ring.classList.add('show');
    pressTimer = setTimeout(() => {
      ring.classList.remove('show');
      pressFired = true;
      showInfo(pickAt(downX, downY));
    }, LONG_PRESS_MS - 200);
  }, 200);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (pressTimer && Math.hypot(e.clientX - downX, e.clientY - downY) > 10) cancelPress();   // 在拖曳轉視角
});
window.addEventListener('pointerup', () => { activePointers = Math.max(0, activePointers - 1); pointerIsDown = activePointers > 0; wake(); });
window.addEventListener('pointercancel', () => { activePointers = 0; pointerIsDown = false; cancelPress(); });
renderer.domElement.addEventListener('pointerup', (e) => {
  const wasPress = pressTimer !== 0 || pressFired;
  cancelPress();
  if (pressFired || !wasPress) return;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
  if (performance.now() - downAt > LONG_PRESS_MS) return;
  handleTap(pickAt(e.clientX, e.clientY));
});

// ==========================================
// 9. 渲染迴圈：有人在操作 → 60fps；沒在動 → 降到 24fps（省電 12fps）
//    App 切到背景、彈窗打開 → 完全不畫
// ==========================================
let rafId = 0, lastFrame = 0, lastWake = 0;
function wake() {
  lastWake = performance.now();
  if (!rafId && !document.hidden) rafId = requestAnimationFrame(loop);
}
controls.addEventListener('start', () => { cameraGoal.active = false; wake(); });
controls.addEventListener('change', wake);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; }
  else wake();
});

const LOD_FACTOR = 9;    // 鏡頭距離 > 島半徑 × 9 就不畫島上物件（只剩島身）
const DETAIL_DIST = 14;  // 裝飾品、寵物、魚：不是正在看的島，距離超過 14 就不畫
const tmpV = new THREE.Vector3();
const flowerMat = { ref: null };
loadFlowerAtlas().then(a => { flowerMat.ref = getFlowerMaterial(a); });

let frameDt = 0, lastT = 0;
function updateWorld(t) {
  frameDt = lastT ? Math.min(0.1, t - lastT) : 0;   // 秒；最多 0.1，切回 App 時寵物不會瞬移
  lastT = t;
  for (const isl of world.islands) {
    isl.group.position.y = isl.basePos.y + Math.sin(t * isl.cfg.bob.speed + isl.cfg.bob.phase) * 0.13;
    isl.updateMiniRocks(t);
    if (isl.lockSprite) isl.lockSprite.position.y = 1.6 + Math.sin(t * 2) * 0.08;
    if (!isl.content) continue;

    const dist = camera.position.distanceTo(tmpV.copy(isl.basePos));
    isl.content.visible = dist < isl.cfg.radius * LOD_FACTOR;
    if (!isl.content.visible) continue;
    // 第二層細節：裝飾品、寵物、魚只畫「正在看的島」和很近的島
    const showDetail = isl.id === currentView || dist < DETAIL_DIST;
    isl.detailGroup.visible = showDetail;

    if (showDetail) isl.bugs.forEach(b => {
      b.angle += 0.015 * b.speed;
      b.mesh.position.set(Math.cos(b.angle) * b.radius, b.height + Math.sin(t * 4) * 0.15, Math.sin(b.angle) * b.radius);
      // 頭朝飛的方向（繞圈的切線），翅膀拍動
      const s = Math.sign(b.speed);
      b.mesh.rotation.y = Math.atan2(-Math.sin(b.angle) * s, Math.cos(b.angle) * s);
      animateWings(b.mesh, t + b.radius);
    });
    if (isNight && isl.fireflies) {
      const arr = isl.fireflies.points.geometry.attributes.position.array;
      isl.fireflies.seeds.forEach((s, i) => { arr[i * 3 + 1] = s.baseY + Math.sin(t * s.speed + s.phase) * 0.22; });
      isl.fireflies.points.geometry.attributes.position.needsUpdate = true;
    }
    if (isNight && isl.warmLight) isl.warmLight.intensity = 2.4 + Math.sin(t * 5) * 0.28;
    if (showDetail) {
      if (isl.pets) isl.pets.update(frameDt, t, petMode({ forceNight: isNight, raining: isRaining }));
      if (isl.pond) isl.pond.update(frameDt, t);
      isl.mixers.forEach(m => m.update(frameDt));
    }
    if (isl.growing?.length) {
      isl.growing = isl.growing.filter(g => {
        g.userData.growing = Math.min(1, g.userData.growing + frameDt * 1.6);
        const u = g.userData.growing;
        g.scale.setScalar(Math.max(0.01, 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2)));   // 彈一下
        return u < 1;
      });
    }
  }

  for (const b of world.bridges) b.update(t, frameDt);
  clouds.forEach(c => { c.mesh.position.x = c.baseX + Math.sin(t * c.speed) * c.range; });
  updateSky(t, frameDt);
  if (flowerMat.ref) flowerMat.ref.uniforms.uTime.value = t;

  if (isRaining) {
    rain.position.set(controls.target.x, 0, controls.target.z);
    const arr = rainGeo.attributes.position.array;
    for (let i = 0; i < rainCount; i++) {
      arr[i * 3 + 1] -= 0.23;
      if (arr[i * 3 + 1] < -2.5) arr[i * 3 + 1] = 8.5;
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
}

function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (isPaused) { cancelAnimationFrame(rafId); rafId = 0; return; }

  const busy = cameraGoal.active || pointerIsDown || isRaining || meteorState.active || (now - lastWake < 1500);
  const fps = busy ? 60 : quality.idleFps;
  if (now - lastFrame < 1000 / fps - 2) return;   // 120Hz 螢幕也最多畫 60 張
  frameStats(now);
  lastFrame = now;

  updateWorld(now / 1000);

  if (cameraGoal.active) {
    camera.position.lerp(cameraGoal.pos, 0.08);
    controls.target.lerp(cameraGoal.target, 0.08);
    if (camera.position.distanceTo(cameraGoal.pos) < 0.04 && controls.target.distanceTo(cameraGoal.target) < 0.04) {
      camera.position.copy(cameraGoal.pos);
      controls.target.copy(cameraGoal.target);
      cameraGoal.active = false;
    }
  }
  controls.update();
  renderer.render(scene, camera);
}

// ==========================================
// 10. 效能監看（網址加 ?debug=1）
// ==========================================
const debugEl = document.getElementById('debug-panel');
let statFrames = 0, statSince = 0;
function frameStats(now) {
  if (!DEBUG) return;
  statFrames++;
  if (now - statSince < 500) return;
  const fps = Math.round(statFrames * 1000 / (now - statSince));
  statFrames = 0; statSince = now;
  const { calls, triangles } = renderer.info.render;
  const bad = (v, max) => v > max ? ' style="color:#ff6b6b"' : '';
  debugEl.innerHTML =
    `FPS ${fps}<br><span${bad(calls, BUDGET.drawCalls)}>繪製 ${calls} / ${BUDGET.drawCalls}</span><br>` +
    `<span${bad(triangles, BUDGET.triangles)}>三角形 ${triangles.toLocaleString()}</span><br>` +
    `DPR ${renderer.getPixelRatio()} · 陰影 ${quality.shadows ? '開' : '關'}`;
}
if (DEBUG) {
  debugEl.style.display = 'block';
  // 只有 ?debug=1 才開放，方便在主控台測試
  window.__island = {
    world, ctx, camera, countWaterDays, computeFishUnlocked, meteorState,
    setRecords(r) { recordsByDate = r; }
  };
}

// ==========================================
// 11. 啟動
// ==========================================
function showLoadError(err) {
  console.error('載入失敗:', err);
  setTip(`❌ 載入失敗：${err?.message || err}`);
  lastTipAt = Infinity;   // 錯誤訊息不要被小語蓋掉
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  flyToView(currentView, true);
});

// 手機閒置時，一次一個慢慢把所有模型存進快取（sw.js 會收起來）
// 之後解鎖新島就不用等下載，沒網路也能看；只做一次
function precacheModelsWhenIdle() {
  if (!('serviceWorker' in navigator) || localStorage.getItem('island_models_cached') === MODELS_VERSION) return;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  const queue = ALL_MODEL_URLS.slice();
  const next = () => {
    const url = queue.shift();
    if (!url) { localStorage.setItem('island_models_cached', MODELS_VERSION); return; }
    fetch(url).catch(() => {}).finally(() => idle(next));
  };
  setTimeout(() => idle(next), 5000);   // 開啟 5 秒後才開始，不跟第一眼搶網路
}
const MODELS_VERSION = String(ALL_MODEL_URLS.length);

// 讀紀錄；沒有通行碼或通行碼被換掉 → 請媽媽輸入
async function loadRecordsWithKey() {
  try {
    return await loadRecords();
  } catch (e) {
    if (e instanceof KeyRequiredError || e instanceof KeyRejectedError) {
      if (e instanceof KeyRejectedError) Store.remove('garden_key');
      const r = await askGardenKey(e instanceof KeyRejectedError ? '花園通行碼已經更換，請重新輸入' : '');
      counts = r.counts;
      recordsByDate = r.recordsByDate;
      picker = createFlowerPicker(r.recordsByDate);
      lastFetch = Date.now();
      return r;
    }
    throw e;
  }
}

async function start() {
  if (DEMO) document.querySelectorAll('.demo-only').forEach(b => b.style.display = '');
  applyQuality();
  buildViewButtons();
  flyToView('main', true);
  setNight(isNight);   // 一打開就照真實時間顯示白天或夜晚
  if (location.protocol === 'file:') {
    setTip('⚠️ 請透過本機伺服器開啟以載入模型');
    return;
  }
  try {
    // 先只建主島（第一眼看到的），同時讀紀錄
    setTip('讀取紀錄中...');
    const [, rec] = await Promise.all([world.byId.main.ensureContent(ctx), loadRecordsWithKey()]);

    // 把過去每一天的今日之花依序種上去（主島滿了會自動解鎖下一座花島）
    for (const bloom of buildBlooms(counts, today, picker.pick)) await placeBloom(bloom, { announce: true });
    picker.save();
    announceNewFlowers();
    updateBud();

    // 寵物島：小柴犬解鎖（連續 7 天）就打開
    ctx.petUnlocks = computePetUnlocks();
    ctx.waterDays = countWaterDays();
    ctx.fishUnlocked = computeFishUnlocked();
    ctx.decorUnlocked = computeDecorUnlocked();
    for (const isl of world.islands) if (isl.content) await isl.applyDecor(ctx.decorUnlocked, isNight);
    if (ctx.petUnlocks.shiba) await unlockIsland(world.byId.pet, true);
    const days = totalBloomDays();
    setTip(rec.offline
      ? `📴 沒有網路，先顯示上次的花園（${days} 天的花）`
      : days ? `花園已經開了 ${days} 天的花 · 長按花朵 1 秒，看看是哪一天開的`
             : '今天記下第一筆，明天就會開出第一朵今日之花 🌱');
    startQuotes();   // 之後每 15 秒換一句暖心小語
    checkWeather();  // 接上真實天氣（下雨提示會先顯示 8 秒）
    for (const isl of world.islands) if (isl.unlocked) await isl.ensureContent(ctx);
    for (const b of world.bridges) await b.build(interactables);
    setNight(isNight);
    wake();
    booting = false;
    queueWhatsNew();
    if (pendingAnnouncements.length) setTimeout(() => pendingAnnouncements.shift()(), 1200);
    precacheModelsWhenIdle();
  } catch (err) {
    showLoadError(err);
  }
}
start();
