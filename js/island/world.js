// 🏝️ 群島世界：島身、島上物件、浮石橋
//
// 效能原則：
//   - 島身（草地＋泥土＋岩石）很便宜，一開始全部建好
//   - 島上物件（樹、屋子、花）等第一次需要看到時才建（lazy build）
//   - 離鏡頭太遠的島只畫島身，不畫物件（LOD）
//   - 鎖住的島只有灰色島身＋鎖頭，完全沒有物件
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ISLANDS, BRIDGES, GRASS_TOP_Y } from './config.js';
import { modelUrl } from './models-catalog.js';
import { createPets } from './pets.js';
import { createPond } from './pond.js';
import { makeButterfly, makeBee } from './critters.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FlowerPatch, FLOWER_FILES, loadFlowerAtlas } from './flowers.js';

// ------------------------------------------
// 模型快取：同一個 .glb 只下載、解析一次
// ------------------------------------------
// 舊名字的別名；其他模型直接用目錄裡的名字，例如 getModel('tree-05')
const ALIASES = { tree: 'tree-01', rock: 'rock-04', house: 'small-red-house' };
const urlFor = (key) => modelUrl(ALIASES[key] || key);
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');  // sw.js 會快取
dracoLoader.setWorkerLimit(1);   // 解壓縮只開 1 個背景工人（預設 4 個，每個都要佔一份解碼器記憶體）
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const modelCache = {};
const modelAnims = {};   // 有動畫的模型（例如風車）
export function getModel(key) {
  if (!modelCache[key]) {
    modelCache[key] = new Promise((resolve, reject) => {
      gltfLoader.load(urlFor(key), g => {
        modelAnims[key] = g.animations || [];
        shareTextures(g.scene);
        resolve(g.scene);
      }, undefined, reject);
    });
  }
  return modelCache[key];
}

// ------------------------------------------
// 🧠 省記憶體：貼圖
//   1. 很多模型用同一張調色盤貼圖，但每個 .glb 各帶一份 → 內容一樣的只留一張
//   2. 貼圖送進顯示晶片之後，手機記憶體裡那份原圖就用不到了 → 丟掉
//      （萬一 iPhone 把畫面資源收回去，main.js 會重新整理頁面，不會黑掉）
// ------------------------------------------
const textureByHash = new Map();
let hashCanvas = null;
function textureHash(tex) {
  const img = tex.image;
  if (!img || !img.width) return null;
  try {
    hashCanvas = hashCanvas || document.createElement('canvas');
    hashCanvas.width = img.width; hashCanvas.height = img.height;
    const c = hashCanvas.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, img.width, img.height);
    c.drawImage(img, 0, 0);
    const px = c.getImageData(0, 0, img.width, img.height).data;
    let h = 2166136261;   // FNV-1a，全部像素都算，一樣才算一樣
    for (let i = 0; i < px.length; i += 1) h = Math.imul(h ^ px[i], 16777619);
    return `${img.width}x${img.height}:${h >>> 0}:${tex.flipY}:${tex.wrapS}:${tex.wrapT}:${tex.magFilter}:${tex.minFilter}:${tex.colorSpace}`;
  } catch (e) { return null; }
}
function releaseAfterUpload(tex) {
  if (tex.userData.releases) return;
  tex.userData.releases = true;
  tex.onUpdate = () => {
    const img = tex.image;
    if (img && typeof img.close === 'function') img.close();   // ImageBitmap 立刻釋放
    tex.source.data = null;                                     // 圖片元素交給瀏覽器回收
    tex.onUpdate = null;
  };
}
function shareTextures(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap']) {
        const t = m[k];
        if (!t || !t.isTexture) continue;
        const h = textureHash(t);
        if (h && textureByHash.has(h)) {
          const keep = textureByHash.get(h);
          if (keep !== t) {
            if (typeof t.image?.close === 'function') t.image.close();
            t.dispose();
            m[k] = keep;
          }
        } else {
          if (h) textureByHash.set(h, t);
          releaseAfterUpload(t);
        }
      }
    }
  });
  if (hashCanvas) { hashCanvas.width = hashCanvas.height = 1; }   // 暫存畫布也縮回去
}

// ------------------------------------------
// 🌟 夜晚的燈光：不用真的光源（很耗效能），用一團柔和的光暈貼圖假裝
// ------------------------------------------
const glowTexCache = {};
function glowSprite(color, size) {
  if (!glowTexCache[color]) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.25, color + 'aa');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTexCache[color] = new THREE.CanvasTexture(c);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexCache[color], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  }));
  sp.scale.set(size, size, 1);
  return sp;
}

// 把模型縮放到指定高度、底部貼地、置中（clone 會共用幾何與材質，不會多佔記憶體）
export function placeModel(raw, targetHeight, widthStretch = 1.0) {
  const wrapper = new THREE.Group();
  const clone = raw.clone();
  const size = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3());
  const refH = size.y > 0.001 ? size.y : Math.max(size.x, size.z, 1);
  const s = targetHeight / refH;
  clone.scale.set(s * widthStretch, s, s * widthStretch);
  const box = new THREE.Box3().setFromObject(clone);
  const c = box.getCenter(new THREE.Vector3());
  clone.position.x -= c.x;
  clone.position.z -= c.z;
  clone.position.y -= box.min.y;
  clone.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  wrapper.add(clone);
  return wrapper;
}

// ------------------------------------------
// 共用材質（所有島共用，不要每座島 new 一份）
// ------------------------------------------
const rockMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, flatShading: true, roughness: 0.95 });
const LOCKED_GRASS = new THREE.Color(0xa7b1b7);
const LOCKED_DIRT = new THREE.Color(0x8a8f93);
const miniRockGeo = new THREE.DodecahedronGeometry(1, 0);
const _bm = new THREE.Matrix4();
const _m4 = new THREE.Matrix4(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s3 = new THREE.Vector3();

function makeLockSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.fill();
  g.font = '64px serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('🔒', 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.set(1.3, 1.3, 1);
  return sp;
}

// ------------------------------------------
// 島嶼物件
// ------------------------------------------
export class Island {
  constructor(cfg) {
    this.cfg = cfg;
    this.id = cfg.id;
    this.unlocked = !!cfg.unlocked;
    this.basePos = new THREE.Vector3(...cfg.pos);
    this.group = new THREE.Group();
    this.group.position.copy(this.basePos);
    this.content = null;       // 島上物件，第一次需要時才建
    this.building = null;
    this.patch = null;         // 花圃（花島才有）
    this.occupied = [];        // 不能種花的位置
    this.interactables = [];
    this.bugs = [];
    this.fireflies = null;
    this.warmLight = null;
    this.miniRocks = [];
    this.glows = [];           // 晚上會亮的光暈
    this.mixers = [];          // 會動的模型（風車）
    this.placedDecor = new Set();
    // 🪑 這座島的裝飾品位置先預留（還沒解鎖也先空著），花和小狗都會避開
    this.decor = (typeof DECOR_INFO !== 'undefined') ? DECOR_INFO.filter(d => d.island === cfg.id) : [];
    this.decor.forEach(d => this.occupied.push({ x: d.at.x, z: d.at.z, r: (d.r || 0.5) + 0.2 }));
    this._buildShell();
  }

  // 把已解鎖、還沒擺上去的裝飾品擺上島（之後解鎖新的，再呼叫一次就好）
  async applyDecor(unlocked, isNight) {
    if (!this.content) return;
    for (const d of this.decor) {
      if (!unlocked.has(d.id) || this.placedDecor.has(d.id)) continue;
      this.placedDecor.add(d.id);
      const raw = await getModel(d.model);
      const g = new THREE.Group();
      g.position.set(d.at.x, GRASS_TOP_Y, d.at.z);
      g.rotation.y = d.rot || 0;
      (d.copies || [[0, 0]]).forEach(([dx, dz]) => {
        const o = placeModel(raw, d.height);
        o.position.set(dx, 0, dz);
        g.add(o);
        if (d.animated && modelAnims[d.model]?.length) {
          const mixer = new THREE.AnimationMixer(o);
          mixer.timeScale = d.animSpeed ?? 1;   // 例如風車慢一點比較悠閒
          modelAnims[d.model].forEach(clip => mixer.clipAction(clip).play());
          this.mixers.push(mixer);
        }
      });
      if (d.glow) {
        const sp = glowSprite(d.glow.color, d.glow.size);
        sp.position.set(0, d.glow.y, 0);
        sp.visible = !!isNight;
        g.add(sp);
        this.glows.push(sp);
      }
      g.userData = { icon: d.emoji, thumbKey: 'decor:' + d.id, title: d.name, desc: d.desc + (d.glow ? '\n\n🌙 晚上會亮燈喔！' : '') };
      this.detailGroup.add(g);
      this.interactables.push(g);
      // 新擺上的裝飾品從地面「長」出來
      g.scale.setScalar(0.01);
      g.userData.growing = 0;
      this.growing = this.growing || [];
      this.growing.push(g);
    }
  }

  _buildShell() {
    const { radius: r, segments, grass } = this.cfg;
    this.grassMat = new THREE.MeshStandardMaterial({ color: grass, flatShading: true, roughness: 0.9 });

    this.grassMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, 0.6, segments), this.grassMat);
    this.grassMesh.receiveShadow = true;
    this.grassMesh.userData.islandId = this.id;
    this.group.add(this.grassMesh);

    // 泥土層＋底下的岩石尖錐：合成 1 個網格（用頂點顏色分顏色），少 1 次繪製
    const dirtGeo = new THREE.CylinderGeometry(r * 0.93, r * 0.7, 0.95, Math.max(8, segments - 2)).toNonIndexed();
    dirtGeo.translate(0, -0.76, 0);
    const rockGeo = new THREE.ConeGeometry(r * 0.7, r * 0.76, Math.max(7, segments - 4)).toNonIndexed();
    rockGeo.rotateX(Math.PI);
    rockGeo.translate(0, -1.235 - r * 0.38, 0);
    [dirtGeo, rockGeo].forEach(g => {
      g.deleteAttribute('uv');
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    });
    this.dirtVerts = dirtGeo.attributes.position.count;
    const under = new THREE.Mesh(mergeGeometries([dirtGeo, rockGeo]),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    this.underMesh = under;
    this.group.add(under);

    // 周圍漂浮的小碎石：3 顆用同一個 InstancedMesh，1 次繪製
    this.miniRockMesh = new THREE.InstancedMesh(miniRockGeo, rockMat, 3);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.7;
      const d = r + 0.75 + Math.random() * 0.4;
      this.miniRocks.push({
        x: Math.cos(a) * d, z: Math.sin(a) * d, baseY: -1.1 - Math.random() * 0.9,
        s: 0.26 + Math.random() * 0.18, rotY: Math.random() * 6,
        speed: 1.2 + Math.random(), offset: Math.random() * 6
      });
    }
    this.group.add(this.miniRockMesh);
    this.updateMiniRocks(0);

    this._applyLockLook();
  }

  updateMiniRocks(t) {
    this.miniRocks.forEach((m, i) => {
      _m4.compose(_v3.set(m.x, m.baseY + Math.sin(t * m.speed + m.offset) * 0.16, m.z),
        _q.setFromEuler(_e.set(0, m.rotY, 0)), _s3.setScalar(m.s));
      this.miniRockMesh.setMatrixAt(i, _m4);
    });
    this.miniRockMesh.instanceMatrix.needsUpdate = true;
  }

  // 泥土顏色（鎖住時變灰）；岩石尖錐固定灰色
  _paintUnder(dirtColor) {
    const col = this.underMesh.geometry.attributes.color;
    const dirt = new THREE.Color(dirtColor), rock = new THREE.Color(0x7f8c8d);
    for (let i = 0; i < col.count; i++) {
      const c = i < this.dirtVerts ? dirt : rock;
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  _applyLockLook() {
    if (this.unlocked) {
      this.grassMat.color.setHex(this.cfg.grass);
      this._paintUnder(this.cfg.dirt);
      if (this.lockSprite) { this.group.remove(this.lockSprite); this.lockSprite = null; }
    } else {
      this.grassMat.color.copy(LOCKED_GRASS);
      this._paintUnder(LOCKED_DIRT);
      if (!this.lockSprite) {
        this.lockSprite = makeLockSprite();
        this.lockSprite.position.set(0, 1.6, 0);
        this.group.add(this.lockSprite);
      }
    }
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this._applyLockLook();
  }

  // 第一次需要時才建島上物件
  ensureContent(ctx) {
    if (!this.unlocked) return Promise.resolve(null);
    if (this.content) return Promise.resolve(this.content);
    if (!this.building) {
      this.building = (async () => {
        const content = new THREE.Group();
        // 細節（裝飾品、寵物、魚）另外放一組：遠的島整組不畫，省很多繪製次數
        this.detailGroup = new THREE.Group();
        content.add(this.detailGroup);
        await CONTENT_BUILDERS[this.cfg.content](this, content, ctx);
        this.content = content;
        this.group.add(content);
        if (ctx.decorUnlocked) await this.applyDecor(ctx.decorUnlocked, ctx.isNight);
        return content;
      })().catch(err => {
        this.building = null;
        throw err;
      });
    }
    return this.building;
  }

  // 島上小空地的種花位置
  // rng：傳入用日期當種子的亂數，同一天的花永遠種在同一個位置
  randomFreeSpot(rng = Math.random, gap = 0.38) {
    const { minR, maxR } = this.cfg.flowerZone || { minR: 0.5, maxR: this.cfg.radius - 0.6 };
    for (let k = 0; k < 60; k++) {
      const rr = Math.sqrt(minR * minR + rng() * (maxR * maxR - minR * minR)); // 面積均勻
      const th = rng() * Math.PI * 2;
      const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
      const g = k < 40 ? gap : gap * 0.6;   // 真的擠不下時允許靠近一點
      if (!this.occupied.some(s => Math.hypot(x - s.x, z - s.z) < Math.max(s.r, g))) return { x, z };
    }
    return null;
  }

  // 種一朵今日之花（bloom 來自 daily-bloom.js）
  plantBloom(bloom) {
    if (!this.patch || this.patch.isFull) return null;
    const spot = this.randomFreeSpot(bloom.rng);
    if (!spot) return null;
    const f = this.patch.add(spot.x, spot.z, bloom.file, GRASS_TOP_Y, {
      scale: bloom.tier.scale * (0.94 + bloom.rng() * 0.12),
      halo: bloom.tier.halo,
      phase: bloom.rng(),
      meta: bloom
    });
    if (f) this.occupied.push({ x: spot.x, z: spot.z, r: 0.38 });
    return f;
  }

  get flowerCount() { return this.patch ? this.patch.flowers.length : 0; }
  get isFull() { return !this.patch || this.patch.isFull; }
}

// ------------------------------------------
// 島上的小生物（蝴蝶蜜蜂、螢火蟲）
// ------------------------------------------
// 黃色 → 蜜蜂，其他顏色 → 那個顏色的蝴蝶
function addBug(island, content, color, radius, speed, height) {
  const mesh = color === 0xf1c40f ? makeBee() : makeButterfly(color);
  mesh.scale.setScalar(2.0);
  island.detailGroup.add(mesh);
  island.bugs.push({ mesh, radius, speed, height, angle: Math.random() * Math.PI * 2 });
}

const ffMat = new THREE.PointsMaterial({ color: 0xffeaa7, size: 0.16, transparent: true, opacity: 0.92, depthWrite: false });
function addFireflies(island, content, count, maxR) {
  const pos = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const r = 0.5 + Math.random() * maxR, a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 0.6 + Math.random() * 2.1;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seeds.push({ baseY: pos[i * 3 + 1], speed: 1.5 + Math.random() * 2, phase: Math.random() * 6 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, ffMat);
  pts.visible = false;
  content.add(pts);
  island.fireflies = { points: pts, seeds };
}

function addRocks(island, content, rock, list, block = true) {
  list.forEach(p => {
    const o = placeModel(rock, p.h);
    o.position.set(p.x, GRASS_TOP_Y, p.z);
    o.rotation.y = p.rot;
    content.add(o);
    if (block) island.occupied.push({ x: p.x, z: p.z, r: 0.55 });
  });
}

function addInteractable(island, obj, data) {
  obj.userData = data;
  island.interactables.push(obj);
}

// 🌼 非花島的野花裝飾：固定 10 朵，避開屋子、樹、裝飾品；用島名當亂數種子，每次打開位置都一樣
const WILD_FLOWERS = 10;
function plantWildFlowers(island, content, atlas, extraBlocked = []) {
  let h = 0;
  for (const ch of island.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const rng = () => { h = (h * 1664525 + 1013904223) | 0; return (h >>> 0) / 4294967296; };
  extraBlocked.forEach(b => island.occupied.push(b));
  island.patch = new FlowerPatch(atlas, WILD_FLOWERS, 0.55);
  content.add(island.patch.mesh);
  for (let i = 0; i < WILD_FLOWERS; i++) {
    const spot = island.randomFreeSpot(rng, 0.5);
    if (!spot) break;
    island.patch.add(spot.x, spot.z, FLOWER_FILES[Math.floor(rng() * FLOWER_FILES.length)], GRASS_TOP_Y, { phase: rng() });
    island.occupied.push({ x: spot.x, z: spot.z, r: 0.35 });
  }
}

// 每座島「島上有什麼」：新增島的種類就在這裡加一個建構函式
const CONTENT_BUILDERS = {
  async mainGarden(island, content, ctx) {
    const [tree, rock, atlas] = await Promise.all([getModel('tree-06'), getModel('rock'), loadFlowerAtlas()]);

    const mainTree = placeModel(tree, 3.3);
    mainTree.position.set(-0.65, GRASS_TOP_Y, -0.75);
    addInteractable(island, mainTree, {
      icon: '🌳', title: '主花島守護大樹',
      desc: '見證每日健康紀錄成長的大樹！主花島種滿花之後，浮石橋就會通到新的花島。',
      forceRefresh: true   // 連點 5 下：強制更新（main.js handleTap）
    });
    content.add(mainTree);
    island.occupied.push({ x: -0.65, z: -0.75, r: 1.45 });

    addRocks(island, content, rock, [
      { x: -2.6, z: -1.3, h: 0.60, rot: 0.5 },
      { x: -1.7, z: 2.85, h: 0.45, rot: 3.8 }
    ]);

    island.patch = new FlowerPatch(atlas, island.cfg.capacity);
    content.add(island.patch.mesh);

    // 🌱 今日花苞：今天記的種子在這裡長大，過了半夜才開成今日之花
    const plant = await getModel('plant-01');
    const bud = new THREE.Group();
    bud.position.set(1.15, GRASS_TOP_Y, 1.55);
    const mound = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x6d4c41, flatShading: true, roughness: 1 })
    );
    mound.position.y = 0.04;
    mound.receiveShadow = true;
    bud.add(mound);
    const sprout = placeModel(plant, 1);
    sprout.position.y = 0.08;
    bud.add(sprout);
    addInteractable(island, bud, { icon: '🌱', title: '今日花苞', desc: '' });
    content.add(bud);
    island.bud = { group: bud, sprout };
    island.occupied.push({ x: 1.15, z: 1.55, r: 0.75 });

    addBug(island, content, 0x9b59b6, 2.3, 0.85, 1.5);
    addBug(island, content, 0xf1c40f, 1.7, -1.25, 1.2);
    addFireflies(island, content, 24, 3.7);
  },

  async petHaven(island, content, ctx) {
    const unlocks = ctx.petUnlocks || {};
    const [tree, rock, house, blueHouse, atlas] = await Promise.all([
      getModel('pine-13'), getModel('rock'), getModel('house'),
      unlocks.gs ? getModel('small-blue-house') : null, loadFlowerAtlas()
    ]);

    // 柴犬的紅屋頂小屋
    // 寵物島配置（鏡頭從 +z 方向看過來）：
    //   後排：松樹（左後）、紅屋子（中後）；右側：藍犬舍；左前：水池；鳥屋在左邊和前面
    const cottage = placeModel(house, 1.75);
    cottage.position.set(0.45, GRASS_TOP_Y, -1.75);
    cottage.rotation.y = -0.35;
    addInteractable(island, cottage, {
      icon: '🏡🐕', title: '溫馨狗屋',
      desc: '小柴犬的家！白天牠會在附近散步，晚上 8 點回到門口趴著休息，11 點以後和下雨天就進屋睡覺。'
    });
    content.add(cottage);

    // 德牧的藍屋頂犬舍（連續 30 天解鎖）
    if (blueHouse) {
      const kennel = placeModel(blueHouse, 1.6);
      kennel.position.set(2.45, GRASS_TOP_Y, 0.35);
      kennel.rotation.y = -1.25;
      addInteractable(island, kennel, {
        icon: '🏠🐕‍🦺', title: '守衛犬舍',
        desc: '德國牧羊犬的家。牠會以犬舍為中心，在整座寵物島上巡邏一大圈。'
      });
      content.add(kennel);
    }

    const petTree = placeModel(tree, 2.6);
    petTree.position.set(-1.85, GRASS_TOP_Y, -1.65);
    addInteractable(island, petTree, { icon: '🌲🐦', title: '秘境棲息樹', desc: '綠繡眼與青鳥最喜歡停靠的安靜樹梢。' });
    content.add(petTree);

    const rocks = [
      { x: -2.05, z: 0.35, h: 0.44, rot: 1.2 },
      { x: 0.35, z: 2.15, h: 0.36, rot: 2.7 },
      { x: 2.5, z: -1.9, h: 0.42, rot: 4.1 }
    ];
    addRocks(island, content, rock, rocks, false);

    // 🐕🐦 寵物（依解鎖狀態出現）
    const layout = {
      shibaDoor: { x: 0.2, z: -0.75 },
      gsDoor: { x: 1.45, z: 0.85 },
      bluebirdHouse: { x: -2.95, z: -0.55 },
      greenbirdHouse: { x: -0.6, z: 2.75 },
      blocked: [
        ...island.decor.map(d => ({ x: d.at.x, z: d.at.z, r: d.r || 0.4 })),   // 裝飾品（含還沒解鎖的預留位置）
        { x: 0.45, z: -1.75, r: 1.0 },                  // 紅屋子
        ...(blueHouse ? [{ x: 2.45, z: 0.35, r: 0.95 }] : []),
        { x: -1.85, z: -1.65, r: 0.6 },                 // 樹
        { x: -2.95, z: -0.55, r: 0.35 }, { x: -0.6, z: 2.75, r: 0.35 },
        ...rocks.map(r => ({ x: r.x, z: r.z, r: 0.4 }))
      ]
    };
    island.pets = createPets(island.detailGroup, island, unlocks, layout);
    plantWildFlowers(island, content, atlas, layout.blocked.map(b => ({ ...b, r: b.r + 0.15 })));
    island.interactables.push(...island.pets.interactables);

    island.warmLight = new THREE.PointLight(0xffb74d, 0, 6.2);
    island.warmLight.position.set(0.3, 1.25, -0.9);
    content.add(island.warmLight);

    addBug(island, content, 0x38bdf8, 1.6, 1.05, 1.35);
    addFireflies(island, content, 16, 2.9);
  },

  // 💧 池塘島：大池塘＋5 種魚（解鎖條件見 js/data-fish.js）
  async pondIsland(island, content, ctx) {
    const [tree, rock, reed, atlas] = await Promise.all([
      getModel('tree-03'), getModel('rock'), getModel('grass-05'), loadFlowerAtlas()
    ]);
    const P = { x: -0.2, z: 0.35, r: 1.95 };

    // 池塘：外圈泥土＋水面（略低於草地）
    const bank = new THREE.Mesh(
      new THREE.CylinderGeometry(P.r + 0.18, P.r + 0.1, 0.06, 18),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63, flatShading: true, roughness: 1 }));
    bank.position.set(P.x, GRASS_TOP_Y + 0.005, P.z);
    bank.receiveShadow = true;
    content.add(bank);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(P.r, P.r - 0.05, 0.06, 18),
      new THREE.MeshStandardMaterial({ color: 0x3aa7d8, roughness: 0.2, metalness: 0.1, flatShading: true }));
    water.position.set(P.x, GRASS_TOP_Y + 0.02, P.z);
    water.receiveShadow = true;
    content.add(water);
    island.pondWater = water;
    island.occupied.push({ x: P.x, z: P.z, r: P.r + 0.3 });

    // 荷葉（合成 1 個網格）
    const padGeos = [[0.9, 0.6], [-1.1, -0.5], [0.4, -1.2], [-0.6, 1.1]].map(([x, z], i) => {
      const g = new THREE.CylinderGeometry(0.17, 0.17, 0.012, 9, 1, false, 0.4, Math.PI * 1.8).toNonIndexed();
      g.rotateY(i * 1.7);
      g.translate(P.x + x, GRASS_TOP_Y + 0.055, P.z + z);
      return g;
    });
    const pads = new THREE.Mesh(mergeGeometries(padGeos),
      new THREE.MeshStandardMaterial({ color: 0x4f9d3a, flatShading: true, side: THREE.DoubleSide }));
    content.add(pads);

    // 池邊蘆葦
    [[1.7, 1.2, 0.5], [1.85, 0.6, 0.42], [-2.0, -0.3, 0.48], [-1.6, 1.6, 0.4]].forEach(([x, z, h]) => {
      const o = placeModel(reed, h);
      o.position.set(P.x + x, GRASS_TOP_Y, P.z + z);
      o.rotation.y = x * 3;
      content.add(o);
    });

    // 岸邊的樹（長椅、燈籠、小船等是每週解鎖的裝飾品，見 js/data-decor.js）
    const t = placeModel(tree, 2.2);
    t.position.set(-1.9, GRASS_TOP_Y, -2.0);
    content.add(t);
    addRocks(island, content, rock, [{ x: 0.9, z: -2.5, h: 0.4, rot: 1.0 }, { x: -2.6, z: 1.6, h: 0.36, rot: 2.3 }], false);

    // 池畔野花（避開池塘、樹、石頭、裝飾品）
    plantWildFlowers(island, content, atlas, [{ x: -1.9, z: -2.0, r: 0.7 }, { x: 0.9, z: -2.5, r: 0.5 }, { x: -2.6, z: 1.6, r: 0.5 }]);

    // 🐟 魚
    const living = (ctx.fishUnlocked || []);
    island.pond = createPond(island.detailGroup, { center: P, radius: P.r - 0.1, surfaceY: GRASS_TOP_Y + 0.052 }, living);

    // 點池塘：看看現在住了哪些魚
    const all = (typeof FISH_INFO !== 'undefined') ? FISH_INFO : [];
    const have = new Set(living.map(f => f.id));
    const next = all.find(f => !have.has(f.id));
    const days = ctx.waterDays || 0;
    const nextHint = next
      ? `\n\n💧 喝水達標（1500 ml）已經累計 ${days} 天\n再 ${Math.max(1, next.waterDays - days)} 天，就會有新的魚搬進來！`
      : '\n\n🎉 5 種魚都到齊了！';
    addInteractable(island, water, {
      icon: '🐟', title: '魚兒的池塘',
      desc: (living.length
        ? `現在住在池塘裡的魚（${living.length} / ${all.length} 種）：\n\n` +
          living.map(f => `${f.emoji} ${f.name}`).join('\n') +
          '\n\n水面下的黑影就是牠們，耐心看一下，偶爾會跳出水面喔！'
        : `池塘裡還沒有魚。\n一共有 ${all.length} 種魚等著搬進來。`) + nextHint
    });

    addBug(island, content, 0x7ed6df, 1.8, 0.9, 1.3);
    addFireflies(island, content, 18, 3.0);
  },

  // 📖 圖鑑博物館：點博物館或招牌就打開圖鑑（花／寵物／魚／裝飾品）
  async museumIsland(island, content, ctx) {
    const [house, pine, atlas] = await Promise.all([getModel('house-01'), getModel('pine-03'), loadFlowerAtlas()]);
    const museum = placeModel(house, 2.3);
    museum.position.set(0, GRASS_TOP_Y, -0.7);
    content.add(museum);
    island.occupied.push({ x: 0, z: -0.7, r: 1.5 });

    // 浮在博物館上方的招牌（大字，長輩一眼看懂可以點）
    const c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.roundRect(8, 8, 496, 144, 40); g.fill();
    g.strokeStyle = '#2ecc71'; g.lineWidth = 10; g.stroke();
    g.fillStyle = '#2c3e50';
    g.font = 'bold 72px "Noto Sans TC", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('📖 圖鑑', 256, 84);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    sign.scale.set(1.9, 0.6, 1);
    sign.position.set(0, 2.7, -0.1);
    content.add(sign);
    island.sign = sign;

    const open = { icon: '📖', title: '圖鑑博物館', openGallery: true };
    museum.userData = open;
    sign.userData = open;
    island.interactables.push(museum, sign);

    [[-2.2, -2.1], [2.0, -2.3]].forEach(([x, z]) => {
      const p = placeModel(pine, 1.9);
      p.position.set(x, GRASS_TOP_Y, z);
      content.add(p);
      island.occupied.push({ x, z, r: 0.6 });
    });

    plantWildFlowers(island, content, atlas);
    addFireflies(island, content, 12, 2.8);
  },

  async flowerMeadow(island, content, ctx) {
    const [tree, rock, atlas] = await Promise.all([getModel('tree'), getModel('rock'), loadFlowerAtlas()]);

    const t = placeModel(tree, 2.1, 1.2);
    t.position.set(1.2, GRASS_TOP_Y, -1.5);
    addInteractable(island, t, { icon: '🌸', title: island.cfg.name, desc: '主花島種滿之後，新開的花會飄到這座島上繼續生長。' });
    content.add(t);
    island.occupied.push({ x: 1.2, z: -1.5, r: 1.1 });

    addRocks(island, content, rock, [{ x: -2.1, z: 1.0, h: 0.42, rot: 2.2 }]);

    island.patch = new FlowerPatch(atlas, island.cfg.capacity);
    content.add(island.patch.mesh);

    addBug(island, content, 0xff7eb3, 1.9, 0.95, 1.4);
    addFireflies(island, content, 14, 2.9);
  }
};

// ------------------------------------------
// 浮石橋
// ------------------------------------------
export class Bridge {
  constructor(cfg, a, b) {
    this.cfg = cfg;
    this.a = a; this.b = b;
    this.group = new THREE.Group();
    this.stones = [];
    this.built = false;

    // 橋頭在島邊緣，留一塊空地不種花
    const dir = new THREE.Vector3().subVectors(b.basePos, a.basePos).setY(0).normalize();
    this.start = a.basePos.clone().addScaledVector(dir, a.cfg.radius + 0.2);
    this.end = b.basePos.clone().addScaledVector(dir, -(b.cfg.radius + 0.2));
    this.start.y = a.basePos.y + 0.22;
    this.end.y = b.basePos.y + 0.22;
    this.side = new THREE.Vector3(-dir.z, 0, dir.x);
    a.occupied.push({ x: dir.x * (a.cfg.radius - 0.7), z: dir.z * (a.cfg.radius - 0.7), r: 1.1 });
    b.occupied.push({ x: -dir.x * (b.cfg.radius - 0.7), z: -dir.z * (b.cfg.radius - 0.7), r: 1.1 });
  }

  get ready() { return this.a.unlocked && this.b.unlocked; }

  // 一座橋的 5 顆石頭用 InstancedMesh：不管幾顆都只有 1 次繪製
  async build(interactables) {
    if (this.built || !this.ready) return;
    this.built = true;
    const rock = await getModel('rock');
    const template = placeModel(rock, 0.36, 2.35);
    template.updateMatrixWorld(true);
    const n = this.cfg.stones;
    const card = {
      icon: '🪨✨', title: '空中浮石橋',
      desc: `連接「${this.a.cfg.name}」與「${this.b.cfg.name}」的懸浮靈石。點另一座島就能飛過去！`
    };
    this.parts = [];
    template.traverse(o => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, n);
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.userData = card;
      this.group.add(im);
      interactables.push(im);
      this.parts.push({ mesh: im, inner: o.matrixWorld.clone() });
    });
    for (let i = 0; i < n; i++) {
      const ratio = (i + 0.5) / n;
      const p = new THREE.Vector3().lerpVectors(this.start, this.end, ratio);
      p.addScaledVector(this.side, Math.sin(ratio * Math.PI) * 0.42);
      this.stones.push({ pos: p, rotY: i * 1.15 + 0.3, baseY: p.y, phase: i * 0.85, pop: 0 });
    }
    this.update(0, 0);
  }

  // 波浪起伏＋新橋長出來的動畫
  update(t, dt) {
    if (!this.parts) return;
    this.stones.forEach((st, i) => {
      st.pop = Math.min(1, st.pop + dt * 1.2);
      _v3.set(st.pos.x, st.baseY + Math.sin(t * 1.6 + st.phase) * 0.08 - (1 - st.pop) * 1.5, st.pos.z);
      _m4.compose(_v3, _q.setFromEuler(_e.set(0, st.rotY, 0)), _s3.setScalar(Math.max(0.01, st.pop)));
      this.parts.forEach(pt => {
        pt.mesh.setMatrixAt(i, _bm.multiplyMatrices(_m4, pt.inner));
        pt.mesh.instanceMatrix.needsUpdate = true;
      });
    });
  }
}

export function createWorld(scene) {
  const islands = ISLANDS.map(cfg => new Island(cfg));
  const byId = Object.fromEntries(islands.map(i => [i.id, i]));
  islands.forEach(i => scene.add(i.group));
  const bridges = BRIDGES.map(cfg => new Bridge(cfg, byId[cfg.from], byId[cfg.to]));
  bridges.forEach(b => scene.add(b.group));
  return { islands, byId, bridges };
}

export function randomFlowerFile() {
  return FLOWER_FILES[Math.floor(Math.random() * FLOWER_FILES.length)];
}
