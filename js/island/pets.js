// 🐕🐦 寵物島：小柴犬、德國牧羊犬、青鳥、綠繡眼（低多邊形 3D，見 critters.js）
//
// 作息跟主程式一樣：
//   - 早上 6 點～晚上 8 點：小狗在島上散步，小鳥偶爾飛出去繞一圈
//   - 晚上 8～11 點（或按了🌙）：小狗回到自己的屋子門口趴著休息，頭上飄 z；小鳥停在鳥屋上
//   - 晚上 11 點～早上 6 點，或下雨：大家都躲進屋子裡（看不到）
import * as THREE from 'three';
import { GRASS_TOP_Y } from './config.js';
import { makeDog, animateDog, makeBird, animateBird, makeBirdhouse } from './critters.js';

// 腳下的小影子（所有寵物共用）
const shadowGeo = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false });

// 睡覺的 z
let zTex = null;
function zSprite() {
  if (!zTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 44px sans-serif';
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#34495e';
    g.lineWidth = 6;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeText('z', 32, 34);
    g.fillText('z', 32, 34);
    zTex = new THREE.CanvasTexture(c);
    zTex.colorSpace = THREE.SRGBColorSpace;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false }));
  sp.scale.set(0.2, 0.2, 1);
  return sp;
}

// 圖鑑介紹（js/data-pets.js 的 PET_INFO）
export function petCard(name, icon, thumbKey) {
  const p = (typeof PET_INFO !== 'undefined') ? PET_INFO.find(x => x.name === name) : null;
  return { icon, thumbKey, title: name, desc: p ? `${p.desc}\n\n💡 ${p.tip}` : '' };
}

// ---------- 作息 ----------
export function petMode({ forceNight = false, raining = false } = {}) {
  const h = new Date().getHours();
  if (raining || h >= 23 || h < 6) return 'shelter';
  if (forceNight || h >= 20) return 'rest';
  return 'active';
}

// 角度平滑轉向
function turnTo(obj, target, dt, speed = 8) {
  let d = target - obj.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  obj.rotation.y += d * Math.min(1, dt * speed);
}

// ---------- 小狗 ----------
class Dog {
  // cfg: { name, icon, style, home:{x,z}, roam, speed, canStand(x,z) }
  constructor(cfg, parent) {
    this.cfg = cfg;
    this.group = new THREE.Group();
    this.model = makeDog(cfg.style);
    Object.assign(this.model.userData, petCard(cfg.name, cfg.icon, 'pet:' + cfg.style));   // 保留 userData.anim
    this.group.add(this.model);
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.scale.set(cfg.style === 'shiba' ? 0.16 : 0.2, 1, cfg.style === 'shiba' ? 0.3 : 0.4);
    sh.position.y = 0.005;
    this.group.add(sh);
    this.z = zSprite();
    this.z.visible = false;
    this.group.add(this.z);
    parent.add(this.group);

    this.pos = new THREE.Vector2(cfg.home.x, cfg.home.z + 0.4);
    this.target = null;
    this.wait = 1 + Math.random() * 2;
    this.group.position.set(this.pos.x, GRASS_TOP_Y, this.pos.y);
    this.group.rotation.y = Math.random() * 6;
  }

  pickTarget() {
    const { home, roam, canStand } = this.cfg;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * roam;
      const x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
      if (canStand(x, z)) return new THREE.Vector2(x, z);
    }
    return null;
  }

  update(dt, t, mode) {
    this.group.visible = mode !== 'shelter';
    if (mode === 'shelter') return;

    if (mode === 'rest') {
      const door = new THREE.Vector2(this.cfg.home.x, this.cfg.home.z);
      if (this.pos.distanceTo(door) > 0.05) {
        this.walkTo(door, dt, t);
      } else {
        turnTo(this.group, 0, dt, 3);          // 趴著面向前方
        animateDog(this.model, t, 'rest');
        this.z.visible = true;
        this.z.position.set(0.1, 0.32 + Math.sin(t * 1.5) * 0.06, 0.1);
        this.z.material.opacity = 0.5 + Math.sin(t * 1.5) * 0.4;
      }
      return;
    }

    this.z.visible = false;
    if (!this.target) {
      animateDog(this.model, t, 'idle');
      this.wait -= dt;
      if (this.wait <= 0) this.target = this.pickTarget();
      return;
    }
    if (this.walkTo(this.target, dt, t)) {
      this.target = null;
      this.wait = 2 + Math.random() * 4;      // 停下來東張西望
    }
  }

  // 走一步；到了回傳 true
  walkTo(goal, dt, t) {
    this.z.visible = false;
    const d = goal.clone().sub(this.pos);
    const dist = d.length();
    const step = this.cfg.speed * dt;
    if (dist > 0.001) turnTo(this.group, Math.atan2(d.x, d.y), dt);
    if (dist <= step) this.pos.copy(goal);
    else this.pos.add(d.multiplyScalar(step / dist));
    animateDog(this.model, t, 'walk');
    this.group.position.set(this.pos.x, GRASS_TOP_Y, this.pos.y);
    return dist <= step;
  }
}

// ---------- 小鳥 ----------
class Bird {
  // cfg: { name, icon, style, perch: Vector3, islandRadius }
  constructor(cfg, parent) {
    this.cfg = cfg;
    this.model = makeBird(cfg.style);
    Object.assign(this.model.userData, petCard(cfg.name, cfg.icon, 'pet:' + cfg.style));   // 保留 userData.anim
    this.model.scale.setScalar(1.4);
    parent.add(this.model);
    this.model.position.copy(cfg.perch);
    this.model.rotation.y = Math.random() * 6;
    this.state = 'perch';
    this.nextFlight = 1 + Math.random() * 4;   // 打開群島很快就飛第一次
    this.route = [];
  }

  planRoute() {
    const R = this.cfg.islandRadius;
    const pts = [];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = R * (0.4 + Math.random() * 0.9);
      pts.push(new THREE.Vector3(Math.cos(a) * r, 1.8 + Math.random() * 1.8, Math.sin(a) * r));
    }
    pts.push(this.cfg.perch.clone());
    return pts;
  }

  update(dt, t, mode) {
    this.model.visible = mode !== 'shelter';
    if (mode === 'shelter') { this.state = 'perch'; this.model.position.copy(this.cfg.perch); return; }

    if (this.state === 'perch') {
      animateBird(this.model, t + this.cfg.perch.x, false);
      this.model.position.y = this.cfg.perch.y + Math.max(0, Math.sin(t * 9)) * 0.012;
      if (Math.random() < dt * 0.15) this.model.rotation.y += (Math.random() - 0.5) * 2;   // 偶爾轉頭
      if (mode !== 'active') return;
      this.nextFlight -= dt;
      if (this.nextFlight <= 0) { this.state = 'fly'; this.route = this.planRoute(); }
      return;
    }

    // 飛行中：照路線飛，飛完回鳥屋；天黑了直接飛回家
    if (mode !== 'active' && this.route.length > 1) this.route = [this.cfg.perch.clone()];
    const goal = this.route[0];
    const d = goal.clone().sub(this.model.position);
    const dist = d.length();
    const step = 1.3 * dt;
    animateBird(this.model, t, true);
    if (dist <= step) {
      this.model.position.copy(goal);
      this.route.shift();
      if (!this.route.length) {
        this.state = 'perch';
        this.nextFlight = 20 + Math.random() * 25;
      }
      return;
    }
    turnTo(this.model, Math.atan2(d.x, d.z), dt, 6);
    this.model.position.add(d.multiplyScalar(step / dist));
  }
}

// ---------- 建立寵物島上的寵物 ----------
// unlocks: { shiba, gs, bluebird, greenbird }
// layout:  屋子、樹的位置（由 world.js 傳進來）
export function createPets(content, island, unlocks, layout) {
  const R = island.cfg.radius;
  const blocked = layout.blocked;   // [{x,z,r}]
  const canStand = (x, z) => Math.hypot(x, z) < R - 0.45 && !blocked.some(b => Math.hypot(x - b.x, z - b.z) < b.r);
  const pets = [];
  const interactables = [];

  if (unlocks.shiba) {
    const dog = new Dog({ name: '小柴犬', icon: '🐕', style: 'shiba', speed: 0.45, roam: 1.6, home: layout.shibaDoor, canStand }, content);
    pets.push(dog); interactables.push(dog.model);
  }
  if (unlocks.gs) {
    const gs = new Dog({ name: '德國牧羊犬', icon: '🐕', style: 'shepherd', speed: 0.55, roam: R, home: layout.gsDoor, canStand }, content);
    pets.push(gs); interactables.push(gs.model);
  }

  const addBird = (style, houseName, houseIcon, at, roof, wall, birdName, birdIcon) => {
    const house = makeBirdhouse(roof, wall);
    house.position.set(at.x, GRASS_TOP_Y, at.z);
    house.rotation.y = Math.atan2(-at.x, 4 - at.z) * 0.6;   // 大致面向鏡頭
    house.userData = petCard(houseName, houseIcon);
    content.add(house);
    interactables.push(house);
    const bird = new Bird({
      name: birdName, icon: birdIcon, style, islandRadius: R,
      perch: new THREE.Vector3(at.x, GRASS_TOP_Y + 1.19, at.z)
    }, content);
    pets.push(bird); interactables.push(bird.model);
  };
  if (unlocks.bluebird) addBird('bluebird', '青鳥小屋', '🏠', layout.bluebirdHouse, 0xc0392b, 0xb98a5a, '東藍鴝（青鳥）', '🐦');
  if (unlocks.greenbird) addBird('greenbird', '綠繡眼小木屋', '🏠', layout.greenbirdHouse, 0xa93226, 0x9c7a4e, '綠繡眼', '🐦');

  return {
    interactables,
    count: pets.length,
    update(dt, t, mode) { pets.forEach(p => p.update(dt, t, mode)); }
  };
}
