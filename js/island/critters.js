// 🐕🐦🐟 低多邊形小動物：用程式組出來，風格跟 3dgarden 的模型一樣（平面著色、圓潤色塊）
//
// 為什麼不用模型檔：3dgarden 沒有狗、鳥、魚；其他免費來源格式不合或要付費。
// 之後找到合適的 .glb，只要把 makeXxx() 換成載入模型即可，行為程式不用動。
//
// 效能：每隻動物的固定部位合併成 1 個網格（用頂點顏色上色），
//       只有會動的部位（尾巴、翅膀）分開，所以一隻狗 2 次繪製、一隻鳥 3 次。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });

// 一個部位：幾何 + 顏色 + 位置/旋轉/縮放
function part(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale)
  );
  g.applyMatrix4(m);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function mesh(parts) {
  const m = new THREE.Mesh(mergeGeometries(parts), vcMat);
  m.castShadow = true;
  return m;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ball = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
const cone = (r, h, seg = 4) => new THREE.ConeGeometry(r, h, seg);

// ==========================================
// 🐕 狗（鼻子朝 +z）
// ==========================================
// style: 'shiba' | 'shepherd'
export function makeDog(style) {
  const S = style === 'shiba'
    ? { coat: 0xd9853b, cream: 0xf7e6c8, dark: 0x3b2a20, len: 0.42, h: 0.17, legH: 0.12, earH: 0.09 }
    : { coat: 0xb8743a, cream: 0xd9a56a, dark: 0x262626, len: 0.56, h: 0.2, legH: 0.16, earH: 0.12 };
  const P = [];
  const bodyY = S.legH + S.h / 2;

  // 身體
  P.push(part(box(S.h * 1.05, S.h, S.len), S.coat, [0, bodyY, 0]));
  P.push(part(box(S.h * 0.9, S.h * 0.35, S.len * 0.8), S.cream, [0, bodyY - S.h * 0.38, 0.01]));   // 肚子
  if (style === 'shepherd') {
    P.push(part(box(S.h * 1.1, S.h * 0.45, S.len * 0.7), S.dark, [0, bodyY + S.h * 0.32, -0.04]));  // 黑色馬鞍
  }
  // 腳
  const lx = S.h * 0.32, lz = S.len * 0.36;
  [[lx, lz], [-lx, lz], [lx, -lz], [-lx, -lz]].forEach(([x, z]) => {
    P.push(part(box(0.06, S.legH, 0.06), S.coat, [x, S.legH / 2, z]));
    P.push(part(box(0.065, 0.03, 0.07), S.cream, [x, 0.015, z + 0.005]));
  });
  // 頭
  const hz = S.len / 2 + 0.07, hy = bodyY + S.h * 0.55;
  const head = style === 'shiba' ? 0.17 : 0.17;
  P.push(part(box(head, head * 0.95, head), S.coat, [0, hy, hz]));
  P.push(part(box(head * 0.62, head * 0.45, head * 0.55), S.cream, [0, hy - head * 0.18, hz + head * 0.62]));   // 嘴
  if (style === 'shepherd') P.push(part(box(head * 0.66, head * 0.35, head * 0.5), S.dark, [0, hy - head * 0.08, hz + head * 0.7]));
  P.push(part(box(0.035, 0.03, 0.03), 0x111111, [0, hy - head * 0.02, hz + head * 0.9]));   // 鼻子
  [-1, 1].forEach(s => {
    P.push(part(box(0.025, 0.03, 0.01), 0x111111, [s * head * 0.25, hy + head * 0.12, hz + head * 0.5]));   // 眼睛
    P.push(part(cone(0.045, S.earH, 4), style === 'shiba' ? S.coat : S.dark,
      [s * head * 0.3, hy + head * 0.5 + S.earH / 2, hz - 0.01], [0, Math.PI / 4, s * -0.15]));         // 耳朵
    if (style === 'shiba') P.push(part(box(0.05, 0.04, 0.012), S.cream, [s * head * 0.38, hy - head * 0.1, hz + head * 0.5]));  // 柴犬白臉頰
  });

  const body = mesh(P);

  // 尾巴（分開，才能搖）
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, bodyY + S.h * 0.3, -S.len / 2);
  let tail;
  if (style === 'shiba') {
    const ring = new THREE.TorusGeometry(0.05, 0.022, 4, 8, Math.PI * 1.5);
    tail = mesh([part(ring, S.coat, [0, 0.06, 0.01], [0, Math.PI / 2, 0]), part(ball(0.025, 0), S.cream, [0, 0.11, 0.03])]);
  } else {
    tail = mesh([part(cone(0.035, 0.2, 5), S.coat, [0, -0.03, -0.09], [-1.9, 0, 0]),
                 part(cone(0.02, 0.06, 5), S.dark, [0, -0.08, -0.17], [-1.9, 0, 0])]);
  }
  tailPivot.add(tail);

  const g = new THREE.Group();
  g.add(body, tailPivot);
  g.userData.anim = { body, tailPivot, bodyY };
  return g;
}

// 狗的動作：walk = 走路彈跳＋搖尾巴；rest = 趴下
export function animateDog(dog, t, state) {
  const a = dog.userData.anim;
  if (state === 'rest') {
    a.body.position.y = -0.06;
    a.body.scale.set(1.08, 0.7, 1);
    a.tailPivot.rotation.y = Math.sin(t * 1.2) * 0.15;
    a.tailPivot.position.y = a.bodyY * 0.6;
    return;
  }
  a.body.scale.set(1, 1, 1);
  a.tailPivot.position.y = a.bodyY + 0.05;
  const walking = state === 'walk';
  a.body.position.y = walking ? Math.abs(Math.sin(t * 11)) * 0.025 : 0;
  a.body.rotation.x = walking ? Math.sin(t * 11) * 0.04 : 0;
  a.tailPivot.rotation.y = Math.sin(t * (walking ? 14 : 6)) * 0.45;
}

// ==========================================
// 🐦 小鳥（嘴巴朝 +z）
// ==========================================
// style: 'greenbird'（綠繡眼）| 'bluebird'（東藍鴝）
export function makeBird(style) {
  const S = style === 'greenbird'
    ? { back: 0x8fb33a, chest: 0xe3d44b, belly: 0xd9dccf, beak: 0x3a3a3a, ring: 0xffffff }
    : { back: 0x3d6fd6, chest: 0xe0793a, belly: 0xf4f1ea, beak: 0x2a2a2a, ring: null };
  const P = [];
  P.push(part(ball(0.07, 0), S.back, [0, 0.08, 0], [0, 0, 0], [1, 0.95, 1.25]));     // 身體
  P.push(part(ball(0.055, 0), S.chest, [0, 0.07, 0.035], [0, 0, 0], [0.95, 0.9, 0.9])); // 胸口
  P.push(part(ball(0.04, 0), S.belly, [0, 0.045, 0.02]));
  P.push(part(ball(0.05, 0), S.back, [0, 0.15, 0.06]));                                // 頭
  P.push(part(cone(0.016, 0.05, 4), S.beak, [0, 0.145, 0.115], [Math.PI / 2, 0, 0]));   // 嘴
  [-1, 1].forEach(s => {
    if (S.ring) P.push(part(new THREE.TorusGeometry(0.014, 0.006, 3, 8), S.ring, [s * 0.04, 0.16, 0.08], [0, s * Math.PI / 2.6, 0]));  // 綠繡眼的白眼圈
    P.push(part(box(0.012, 0.014, 0.012), 0x111111, [s * 0.043, 0.16, 0.08]));       // 眼睛
    P.push(part(box(0.01, 0.04, 0.01), 0x8a6a4a, [s * 0.025, 0.02, 0.0]));            // 腳
  });
  P.push(part(box(0.06, 0.012, 0.09), S.back, [0, 0.09, -0.11], [0.35, 0, 0]));        // 尾巴
  const body = mesh(P);

  const wing = (s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.055, 0.1, 0);
    pivot.add(mesh([part(box(0.012, 0.06, 0.11), S.back, [s * 0.01, -0.01, -0.01], [0, 0, s * 0.15])]));
    return pivot;
  };
  const wl = wing(-1), wr = wing(1);
  const g = new THREE.Group();
  g.add(body, wl, wr);
  g.userData.anim = { body, wl, wr };
  return g;
}

export function animateBird(bird, t, flying) {
  const a = bird.userData.anim;
  if (flying) {
    const f = Math.sin(t * 28) * 1.1;
    a.wl.rotation.z = -0.3 - f; a.wr.rotation.z = 0.3 + f;
    a.body.rotation.x = -0.15;
  } else {
    a.wl.rotation.z = 0; a.wr.rotation.z = 0;
    a.body.rotation.x = Math.sin(t * 2.3) > 0.92 ? 0.35 : 0;   // 偶爾低頭啄一下
  }
}

// ==========================================
// 🦋 蝴蝶、🐝 蜜蜂（頭朝 +z）
// ==========================================
export function makeButterfly(color) {
  const c = new THREE.Color(color);
  const edge = c.clone().multiplyScalar(0.55);   // 翅膀邊緣深一點
  const body = mesh([
    part(box(0.018, 0.018, 0.12), 0x2d2d2d, [0, 0, 0]),
    part(ball(0.016, 0), 0x2d2d2d, [0, 0.004, 0.065]),
    part(box(0.004, 0.004, 0.05), 0x2d2d2d, [-0.012, 0.02, 0.09], [-0.6, 0, 0.25]),   // 觸角
    part(box(0.004, 0.004, 0.05), 0x2d2d2d, [0.012, 0.02, 0.09], [-0.6, 0, -0.25])
  ]);
  const wing = (s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.01, 0, 0);
    pivot.add(mesh([
      part(box(0.11, 0.004, 0.1), c, [s * 0.06, 0, 0.03], [0, s * -0.25, 0]),          // 上翅
      part(box(0.03, 0.005, 0.09), edge, [s * 0.11, 0, 0.04], [0, s * -0.25, 0]),
      part(box(0.075, 0.004, 0.075), c, [s * 0.045, 0, -0.045], [0, s * 0.35, 0])      // 下翅
    ]));
    return pivot;
  };
  const wl = wing(-1), wr = wing(1);
  const g = new THREE.Group();
  g.add(body, wl, wr);
  g.userData.anim = { wl, wr, flap: 16, amp: 1.0 };
  return g;
}

export function makeBee() {
  const P = [part(ball(0.045, 1), 0xf5c518, [0, 0, 0], [0, 0, 0], [0.85, 0.8, 1.25])];   // 黃色身體
  [-0.022, 0.018].forEach(z => P.push(part(box(0.08, 0.075, 0.016), 0x222222, [0, 0, z])));   // 黑色條紋
  P.push(part(ball(0.028, 0), 0x222222, [0, 0.005, 0.06]));                               // 頭
  P.push(part(cone(0.012, 0.03, 4), 0x222222, [0, 0, -0.068], [-Math.PI / 2, 0, 0]));       // 尾針
  const body = mesh(P);
  const wing = (s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.015, 0.035, 0.01);
    pivot.add(mesh([part(box(0.06, 0.004, 0.04), 0xe8f4fb, [s * 0.03, 0, 0], [0, s * -0.3, 0])]));
    return pivot;
  };
  const wl = wing(-1), wr = wing(1);
  const g = new THREE.Group();
  g.add(body, wl, wr);
  g.userData.anim = { wl, wr, flap: 45, amp: 0.6 };
  return g;
}

// 拍翅膀
export function animateWings(bug, t) {
  const a = bug.userData.anim;
  const f = Math.sin(t * a.flap) * a.amp;
  a.wl.rotation.z = f;
  a.wr.rotation.z = -f;
}

// 鳥屋（柱子＋小屋＋屋頂，合成 1 個網格）
export function makeBirdhouse(roofColor, wallColor) {
  return mesh([
    part(box(0.07, 0.75, 0.07), 0x7a5230, [0, 0.375, 0]),
    part(box(0.3, 0.28, 0.26), wallColor, [0, 0.89, 0]),
    part(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), 0x2d1e12, [0, 0.9, 0.131], [Math.PI / 2, 0, 0]),
    part(box(0.12, 0.015, 0.06), 0x7a5230, [0, 0.82, 0.16]),
    part(cone(0.27, 0.16, 4), roofColor, [0, 1.11, 0], [0, Math.PI / 4, 0], [1, 1, 0.9])
  ]);
}

// ==========================================
// 🐟 魚（頭朝 +z）
// ==========================================
// pattern: { body, belly, spots:[{color, at:[x,y,z], size}], fin, tailScale, roundness }
export function makeFish(look) {
  const P = [];
  const round = look.roundness || 1;
  P.push(part(new THREE.OctahedronGeometry(0.1, 1), look.body, [0, 0, 0], [0, 0, 0], [0.55 * round, 0.7 * round, 1.3]));
  P.push(part(new THREE.OctahedronGeometry(0.07, 1), look.belly || look.body, [0, -0.025, 0.01], [0, 0, 0], [0.6 * round, 0.5, 1.2]));
  (look.spots || []).forEach(s => P.push(part(ball(s.size, 0), s.color, s.at, [0, 0, 0], [0.7, 0.6, 1])));
  const ts = look.tailScale || 1;
  P.push(part(cone(0.07 * ts, 0.11 * ts, 4), look.fin || look.body, [0, 0, -0.16 - 0.03 * ts], [-Math.PI / 2, 0, 0], [0.25, 1, 1.1]));
  P.push(part(cone(0.03, 0.07, 3), look.fin || look.body, [0, 0.07 * round, -0.02], [0, 0, 0], [0.3, 1, 1.5]));   // 背鰭
  [-1, 1].forEach(s => P.push(part(box(0.016, 0.016, 0.016), 0x111111, [s * 0.04 * round, 0.02, 0.09])));        // 眼睛
  return mesh(P);
}
