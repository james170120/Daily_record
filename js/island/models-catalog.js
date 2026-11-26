// 📦 3D 模型目錄（全部來自 3dgarden.app，免費可商用：https://www.3dgarden.app/licence）
//
// 用法：world.js 的 getModel('tree-05') 會自動找到這裡的檔案
// height = 放到島上時建議的高度（遊戲單位，主島半徑 4.35）
// tris   = 三角形數，挑模型時注意效能預算
// use    = 打算用在哪裡

export const MODELS = {
  // ── 樹 ─────────────────────────────
  'tree-06':        { height: 3.3, tris: 2048, use: '主島守護大樹' },
  'pine-13':        { height: 2.6, tris: 2208, use: '寵物島棲息樹（松樹）' },
  'tree-01':        { height: 3.4, tris: 396,  use: '（舊）細長樹' },
  'tree-02':        { height: 2.6, tris: 388,  use: '花島樹（一般）' },
  'tree-03':        { height: 2.2, tris: 396,  use: '花島樹（矮）' },
  'tree-05':        { height: 2.8, tris: 1088, use: '主島升級後的大樹' },
  'tree-07':        { height: 2.2, tris: 762,  use: '花島樹' },
  'tree-08':        { height: 2.4, tris: 276,  use: '秋天花島（橘）' },
  'tree-09':        { height: 2.4, tris: 396,  use: '秋天花島（橘）' },
  'pack-tree-04':   { height: 2.8, tris: 1104, use: '秋天花島地標（橘）' },
  'pine-01':        { height: 2.4, tris: 574,  use: '鳥之森' },
  'pine-03':        { height: 2.0, tris: 428,  use: '鳥之森' },
  'pine-06':        { height: 2.0, tris: 527,  use: '鳥之森' },
  'tree-trunk':     { height: 0.45, tris: 248, use: '樹樁（寵物島休息點）' },

  // ── 草與小植物（點綴、花苞小草）──────
  'grass-01':       { height: 0.35, tris: 252, use: '點綴小草' },
  'grass-03':       { height: 0.18, tris: 204, use: '點綴小草（矮）' },
  'grass-05':       { height: 0.38, tris: 410, use: '點綴小草' },
  'grass-06':       { height: 0.28, tris: 330, use: '點綴小草' },
  'grass-09':       { height: 0.12, tris: 110, use: '地面草皮' },
  'plant-01':       { height: 0.45, tris: 476, use: '花島邊緣植物' },
  'plant-02':       { height: 0.45, tris: 644, use: '花島邊緣植物' },
  'plant-03':       { height: 0.55, tris: 690, use: '花島邊緣植物' },
  'bramble':        { height: 0.6,  tris: 912, use: '島邊灌木' },
  'flower-01':      { height: 0.3,  tris: 1444, use: '3D 花叢（藍）' },
  'flower-02':      { height: 0.3,  tris: 1444, use: '3D 花叢（黃）' },
  'flower-03':      { height: 0.25, tris: 124, use: '3D 小花' },
  'flower-04':      { height: 0.3,  tris: 144, use: '3D 小花' },

  // ── 石頭 ───────────────────────────
  'rock-01':        { height: 0.6,  tris: 1038, use: '島上大石' },
  'rock-04':        { height: 0.5,  tris: 346, use: '島上石頭、浮石橋' },
  'rock-05':        { height: 0.55, tris: 1038, use: '島上大石' },
  'rock-06':        { height: 0.4,  tris: 346, use: '小石頭' },
  'plant-ruin-01':  { height: 0.55, tris: 1157, use: '稀有今日之花（開花岩）' },
  'plant-ruin-02':  { height: 0.55, tris: 2377, use: '里程碑紀念（開花岩）' },

  // ── 建築與擺設 ──────────────────────
  'small-red-house':  { height: 1.75, tris: 0,    use: '柴犬小屋' },
  'small-blue-house': { height: 1.75, tris: 2304, use: '德牧小屋' },
  'house-01':         { height: 2.0,  tris: 1662, use: '圖鑑博物館島' },
  'mailbox':          { height: 0.7,  tris: 640,  use: '佈告欄信箱（新消息）' },
  'wooden-bench-02':  { height: 0.4,  tris: 1040, use: '主島長椅' },
  'lantern-01':       { height: 0.35, tris: 908,  use: '夜晚小燈籠' },
  'vintage-street-light': { height: 1.6, tris: 160, use: '浮石橋頭路燈' },
  'fence-04':         { height: 0.5,  tris: 98,   use: '寵物島圍籬柱' },
  'fountain':         { height: 0.9,  tris: 2382, use: '水之島噴泉' },
  'rowboat':          { height: 0.45, tris: 894,  use: '水之島小船' },

  // ── 像素風（跟原本的狗、鳥比較搭）──
  'pixel-windmill':     { height: 2.6, tris: 3850, use: '步數島風車（有動畫）' },
  'pixel-palm-tree-02': { height: 2.4, tris: 1160, use: '夏天花島' },
  'pixel-gift':         { height: 0.4, tris: 890,  use: '里程碑禮物盒' },
  'creature-pixel-01':  { height: 0.35, tris: 886, use: '島上小精靈' },
  'creature-pixel-07':  { height: 0.4,  tris: 1239, use: '島上小精靈' }
};

export const modelUrl = (slug) => `./models/${slug}.glb`;
export const ALL_MODEL_URLS = Object.keys(MODELS).map(modelUrl);
