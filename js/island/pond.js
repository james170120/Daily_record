// 🐟 池塘：魚平常是水面下的黑影游來游去，偶爾跳出水面才看得到是哪一種
//
// 效能：每條魚 = 1 個黑影（很便宜）＋ 1 個魚模型（只有跳起來那一秒才畫）
import * as THREE from 'three';
import { makeFish } from './critters.js';

const shadowGeo = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x0b2a3a, transparent: true, opacity: 0.45, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2
});
const ringGeo = new THREE.RingGeometry(0.7, 1, 20).rotateX(-Math.PI / 2);

const JUMP_TIME = 1.0;   // 秒

class Fish {
  constructor(info, pond, parent) {
    this.info = info;
    this.pond = pond;
    const small = info.look.roundness && info.look.roundness < 1;
    this.size = small ? 0.65 : 1;

    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.scale.set(0.06 * this.size, 1, 0.17 * this.size);
    parent.add(this.shadow);

    this.model = makeFish(info.look);
    this.model.scale.setScalar(this.size * 1.3);
    this.model.visible = false;
    parent.add(this.model);

    const a = Math.random() * Math.PI * 2, r = Math.random() * pond.radius * 0.6;
    this.pos = new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    this.heading = Math.random() * Math.PI * 2;
    this.turn = 0;
    this.speed = 0.18 + Math.random() * 0.12;
    this.nextJump = 4 + Math.random() * 14;
    this.jumpT = -1;
  }

  update(dt, t, splash) {
    const { radius, surfaceY } = this.pond;

    if (this.jumpT >= 0) {
      // 跳起來：拋物線，頭先朝上再朝下
      this.jumpT += dt;
      const u = Math.min(1, this.jumpT / JUMP_TIME);
      const x = this.pos.x + Math.sin(this.heading) * u * 0.5;
      const z = this.pos.y + Math.cos(this.heading) * u * 0.5;
      this.model.position.set(x, surfaceY + 4 * u * (1 - u) * 0.55, z);
      this.model.rotation.set(-1.0 + u * 2.0, this.heading, Math.sin(t * 20) * 0.15);
      if (u >= 1) {
        this.pos.set(x, z);
        this.model.visible = false;
        this.shadow.visible = true;
        this.jumpT = -1;
        this.nextJump = 8 + Math.random() * 16;
        splash(x, z);
      }
      return;
    }

    // 游泳：慢慢轉彎，靠近池邊就轉回來
    this.turn += (Math.random() - 0.5) * dt * 3;
    this.turn *= 0.97;
    const r = this.pos.length();
    if (r > radius * 0.72) {
      const toCenter = Math.atan2(-this.pos.x, -this.pos.y);
      let d = toCenter - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * dt * 2.5;
    }
    this.heading += this.turn * dt;
    const wiggle = Math.sin(t * 6 + this.speed * 50) * 0.15;
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.y += Math.cos(this.heading) * this.speed * dt;
    this.shadow.position.set(this.pos.x, surfaceY - 0.002, this.pos.y);
    this.shadow.rotation.y = this.heading + wiggle;

    // 時間到，而且不在池邊 → 跳！
    this.nextJump -= dt;
    if (this.nextJump <= 0 && r < radius * 0.5) {
      this.jumpT = 0;
      this.shadow.visible = false;
      this.model.visible = true;
      splash(this.pos.x, this.pos.y);
    }
  }
}

// center/radius：池塘在島上的位置與大小；surfaceY：水面高度
// fishList：已解鎖的魚（FISH_INFO 裡的項目）
export function createPond(parent, { center, radius, surfaceY }, fishList) {
  const group = new THREE.Group();
  group.position.set(center.x, 0, center.z);
  parent.add(group);

  const pond = { radius, surfaceY };
  const fish = fishList.map(info => new Fish(info, pond, group));

  // 水花：2 個圈圈輪流用
  const rings = [0, 1].map(() => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    group.add(m);
    return { mesh: m, t: 1 };
  });
  let ringIdx = 0;
  const splash = (x, z) => {
    const r = rings[ringIdx++ % rings.length];
    r.t = 0;
    r.mesh.position.set(x, surfaceY + 0.004, z);
    r.mesh.visible = true;
  };

  return {
    fish,
    update(dt, t) {
      fish.forEach(f => f.update(dt, t, splash));
      rings.forEach(r => {
        if (r.t >= 1) return;
        r.t = Math.min(1, r.t + dt / 0.8);
        r.mesh.scale.setScalar(0.05 + r.t * 0.28);
        r.mesh.material.opacity = 0.8 * (1 - r.t);
        if (r.t >= 1) r.mesh.visible = false;
      });
    }
  };
}
