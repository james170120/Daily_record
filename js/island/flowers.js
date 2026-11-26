// 🌸 花朵看板：用原本 40 張像素花 PNG，一座島的所有花只要 1 次繪製
//
// 做法：
//   1. 把 40 張 92×92 的 PNG 拼成一張大圖（atlas），只上傳一次到 GPU
//   2. 每座花島一個 InstancedMesh，每朵花只記「位置、大小、是哪一格」
//   3. 在 shader 裡讓花永遠面向鏡頭（只繞 Y 軸轉，花莖不會歪）
//   4. 用 alpha 測試（透明的地方直接丟掉），不需要前後排序
import * as THREE from 'three';

const CELL = 96;      // 每格 96px，92px 的花置中，四周留 2px 避免相鄰的花滲色
const COLS = 8;

// 全站共用的花朵資料（js/data-flowers.js 以一般 <script> 載入）
export const FLOWER_FILES = (typeof ALL_FLOWERS !== 'undefined')
  ? ALL_FLOWERS.slice()
  : ['flower_rose.png', 'flower_sunflower.png', 'flower_tulip.png', 'flower_daisy.png'];

export function flowerName(file) {
  return (typeof FLOWER_DIC !== 'undefined' && FLOWER_DIC[file]) || '小花';
}
export function flowerInfo(file) {
  return (typeof FLOWER_INFO !== 'undefined' && FLOWER_INFO[file]) || null;
}

let atlasPromise = null;

// 建一次就好，之後所有島共用
export function loadFlowerAtlas() {
  if (atlasPromise) return atlasPromise;
  atlasPromise = (async () => {
    const rows = Math.ceil(FLOWER_FILES.length / COLS);
    const canvas = document.createElement('canvas');
    canvas.width = COLS * CELL;
    canvas.height = rows * CELL;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    await Promise.all(FLOWER_FILES.map((file, i) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const col = i % COLS, row = Math.floor(i / COLS);
        ctx.drawImage(img, col * CELL + (CELL - img.width) / 2, row * CELL + (CELL - img.height) / 2);
        resolve();
      };
      img.onerror = () => { console.warn('花朵圖片載入失敗', file); resolve(); };
      img.src = './' + file;
    })));

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;   // 像素風，放大不糊
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return { texture: tex, cols: COLS, rows };
  })();
  return atlasPromise;
}

// 所有花島共用同一個材質（夜晚色調、搖擺時間只要改一次）
let sharedMaterial = null;
export function getFlowerMaterial(atlas) {
  if (sharedMaterial) return sharedMaterial;
  sharedMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: atlas.texture },
      uCols: { value: atlas.cols },
      uRows: { value: atlas.rows },
      uTime: { value: 0 },
      uSway: { value: 0.06 },
      uTint: { value: new THREE.Color(1, 1, 1) }
    },
    vertexShader: /* glsl */`
      attribute float aCell;
      attribute float aPhase;
      uniform float uCols, uRows, uTime, uSway;
      varying vec2 vUv;
      void main() {
        vec4 origin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float s = length(instanceMatrix[0].xyz);
        // 鏡頭的右方向（壓平到水平面）→ 花只繞 Y 軸轉
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        right = normalize(vec3(right.x, 0.0, right.z) + vec3(1e-5, 0.0, 0.0));
        float sway = sin(uTime * 1.6 + aPhase) * uSway * position.y;
        vec3 wp = origin.xyz + right * (position.x + sway) * s + vec3(0.0, position.y * s, 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);

        float col = mod(aCell, uCols);
        float row = floor(aCell / uCols);
        vUv = vec2((col + uv.x) / uCols, 1.0 - (row + 1.0 - uv.y) / uRows);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform vec3 uTint;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        if (c.a < 0.5) discard;
        gl_FragColor = vec4(c.rgb * uTint, 1.0);
        #include <colorspace_fragment>
      }
    `
  });
  return sharedMaterial;
}

let haloGeo = null, haloMat = null;
function getHaloGeometry() {
  if (!haloGeo) {
    haloGeo = new THREE.RingGeometry(0.2, 0.33, 16);
    haloGeo.rotateX(-Math.PI / 2);
  }
  return haloGeo;
}
export function getHaloMaterial() {
  if (!haloMat) {
    haloMat = new THREE.MeshBasicMaterial({
      color: 0xffd54f, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide
    });
  }
  return haloMat;
}

// 一座島的花圃
export class FlowerPatch {
  constructor(atlas, capacity, flowerHeight = 0.78) {
    this.capacity = capacity;
    this.height = flowerHeight;
    this.flowers = [];   // { x, z, file, scale }

    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);   // 底部對齊地面
    this.cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.phaseAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    geo.setAttribute('aCell', this.cellAttr);
    geo.setAttribute('aPhase', this.phaseAttr);

    this.mesh = new THREE.InstancedMesh(geo, getFlowerMaterial(atlas), capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;  // 看板在 shader 裡才展開，用預設的包圍球會算錯
    this.mesh.raycast = () => {};     // 點花改用螢幕座標判斷（見 pick）

    // 金光花底下的光圈：整座島共用 1 次繪製
    this.halo = new THREE.InstancedMesh(getHaloGeometry(), getHaloMaterial(), capacity);
    this.halo.count = 0;
    this.halo.frustumCulled = false;
    this.halo.raycast = () => {};
    this.mesh.add(this.halo);
  }

  get isFull() { return this.flowers.length >= this.capacity; }

  // opts: { scale: 相對大小, halo: 是否有金色光圈, meta: 點花時要顯示的資料 }
  add(x, z, file, y, opts = {}) {
    if (this.isFull) return null;
    const i = this.flowers.length;
    const scale = this.height * (opts.scale ?? (0.88 + Math.random() * 0.26));
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale)
    );
    this.mesh.setMatrixAt(i, m);
    this.cellAttr.setX(i, Math.max(0, FLOWER_FILES.indexOf(file)));
    this.phaseAttr.setX(i, (opts.phase ?? Math.random()) * 6.28);
    this.mesh.count = i + 1;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.cellAttr.needsUpdate = true;
    this.phaseAttr.needsUpdate = true;

    if (opts.halo) {
      const h = this.halo.count;
      this.halo.setMatrixAt(h, new THREE.Matrix4().compose(
        new THREE.Vector3(x, y + 0.02, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale)));
      this.halo.count = h + 1;
      this.halo.instanceMatrix.needsUpdate = true;
    }

    const flower = { x, y, z, file, scale, meta: opts.meta || null };
    this.flowers.push(flower);
    return flower;
  }

  // 用螢幕距離找最近被點到的花（幾十朵花，比射線檢測便宜又準）
  pick(clientX, clientY, camera, width, height) {
    if (!this.mesh.visible || !this.flowers.length) return null;
    const v = new THREE.Vector3();
    let best = null, bestDepth = Infinity;
    const world = this.mesh.matrixWorld;
    for (const f of this.flowers) {
      v.set(f.x, f.y + f.scale * 0.55, f.z).applyMatrix4(world);
      const depth = v.distanceTo(camera.position);
      v.project(camera);
      if (v.z > 1) continue;
      const sx = (v.x + 1) / 2 * width;
      const sy = (1 - v.y) / 2 * height;
      // 點擊半徑隨距離縮放：近的花比較大
      const hitR = Math.max(18, 360 * f.scale / depth);
      if (Math.hypot(sx - clientX, sy - clientY) < hitR && depth < bestDepth) {
        best = f; bestDepth = depth;
      }
    }
    return best ? { flower: best, depth: bestDepth } : null;
  }
}
