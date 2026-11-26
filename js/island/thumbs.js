// 🖼️ 圖鑑小圖：直接把島上「真正的 3D 模型」拍成一張小照片
//   - 已解鎖：彩色照片，跟島上看到的一模一樣
//   - 還沒解鎖：深色剪影（看得出形狀，但不知道顏色）
// 用主畫面同一個 renderer 畫到小畫布上（不另外開 WebGL，舊 iPhone 比較吃得消），拍過的會記住。
//
// key 的格式：'pet:shiba' / 'pet:shepherd' / 'pet:bluebird' / 'pet:greenbird' / 'fish:<id>' / 'decor:<id>'
import * as THREE from 'three';
import { makeDog, makeBird, makeFish } from './critters.js';

const SIZE = 160;
let renderer = null, getModel = null, placeModel = null;
const cache = new Map();
let queue = Promise.resolve();   // 一次拍一張，避免互相干擾

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(2, 4, 3);
scene.add(sun);
const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 200);
const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x55636e });

export function initThumbs(r, gm, pm) { renderer = r; getModel = gm; placeModel = pm; }

async function build(key) {
  const [kind, id] = key.split(':');
  if (kind === 'pet') {
    if (id === 'shiba' || id === 'shepherd') return { obj: makeDog(id), dir: [0.9, 0.55, 1.4] };
    return { obj: makeBird(id), dir: [0.9, 0.35, 1.3] };
  }
  if (kind === 'fish') {
    const f = FISH_INFO.find(x => x.id === id);
    return { obj: makeFish(f.look), dir: [1, 0.35, 0.15] };   // 魚看側面
  }
  if (kind === 'decor') {
    const d = DECOR_INFO.find(x => x.id === id);
    const raw = await getModel(d.model);
    const g = new THREE.Group();
    (d.copies || [[0, 0]]).forEach(([dx, dz]) => {
      const o = placeModel(raw, d.height);
      o.position.set(dx, 0, dz);
      g.add(o);
    });
    return { obj: g, dir: [0.9, 0.6, 1.3] };
  }
  throw new Error('未知的圖鑑圖：' + key);
}

function shoot({ obj, dir }, silhouette) {
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
  const d = new THREE.Vector3(...dir).normalize();
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 0.8;   // 拍近一點，小格子裡看得清楚
  cam.position.copy(sphere.center).addScaledVector(d, dist);
  cam.near = dist / 50; cam.far = dist * 4;
  cam.updateProjectionMatrix();
  cam.lookAt(sphere.center);

  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  scene.overrideMaterial = silhouette ? silhouetteMat : null;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(SIZE * SIZE * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  scene.overrideMaterial = null;
  scene.remove(obj);
  rt.dispose();

  // WebGL 的畫面是上下顛倒的，翻回來
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    img.data.set(px.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

// 拿一張小圖（Promise<dataURL>）
export function getThumb(key, silhouette = false) {
  const ck = key + (silhouette ? '#s' : '');
  if (!cache.has(ck)) {
    const p = queue.then(async () => shoot(await build(key), silhouette));
    queue = p.catch(() => {});
    cache.set(ck, p);
  }
  return cache.get(ck);
}
