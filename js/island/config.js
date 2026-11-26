// 🏝️ 群島設定檔：新增一座島 = 在 ISLANDS 加一段設定，不用改主程式
//
// kind:
//   'flower' → 花島，可以種花，種滿後花會自動分流到下一座花島
//   'pet'    → 寵物島
// unlocked: 目前先用 true/false；第二步接上真資料後改成依連續天數判斷
// capacity: 花島最多幾朵今日之花（50 朵 ≈ 兩個月；其他島固定 10 朵野花裝飾）
// content:  島上的物件要用哪個建構函式（world.js 的 CONTENT_BUILDERS）

export const GRASS_TOP_Y = 0.3;

export const ISLANDS = [
  {
    id: 'main',
    name: '主花島',
    icon: '🌺',
    kind: 'flower',
    pos: [0, 0, 0],
    radius: 4.35,
    segments: 14,
    grass: 0x6ab04c,
    dirt: 0x8d6e63,
    bob: { speed: 1.1, phase: 0 },
    capacity: 50,
    flowerZone: { minR: 0.85, maxR: 3.8 },
    content: 'mainGarden',
    unlocked: true
  },
  {
    id: 'pet',
    name: '寵物秘境',
    icon: '🏡',
    kind: 'pet',
    pos: [12.0, 0.35, -2.2],
    radius: 3.9,
    segments: 13,
    grass: 0x58b19f,
    dirt: 0x795548,
    bob: { speed: 0.95, phase: 1.4 },
    content: 'petHaven',
    unlocked: false,   // 連續記錄 7 天（小柴犬解鎖）時打開，見 main.js 的 petUnlocks
    lockHint: '連續記錄 7 天，小柴犬就會搬來這座島'
  },
  {
    id: 'pond',
    name: '魚兒池塘',
    icon: '💧',
    kind: 'pond',
    pos: [5.6, 0.2, -11.0],
    radius: 3.6,
    segments: 13,
    grass: 0x7cc47a,
    dirt: 0x8d6e63,
    bob: { speed: 1.05, phase: 3.3 },
    content: 'pondIsland',
    unlocked: true,    // 魚的解鎖條件未定，先讓池塘島一直開著（見 js/data-fish.js）
    lockHint: '解鎖條件即將公布'
  },
  {
    id: 'museum',
    name: '圖鑑博物館',
    icon: '📖',
    kind: 'museum',
    pos: [-3.0, 0.6, -19.0],
    radius: 3.4,
    segments: 13,
    grass: 0x8bc98a,
    dirt: 0x8d6e63,
    bob: { speed: 0.9, phase: 4.2 },
    content: 'museumIsland',
    unlocked: true     // 預設打開
  },
  {
    id: 'rainbow-1',
    name: '粉紅花海島',
    icon: '🌷',
    kind: 'flower',
    pos: [-9.8, 0.55, -5.2],
    radius: 3.6,
    segments: 12,
    grass: 0x7bc47f,
    dirt: 0x8d6e63,
    bob: { speed: 1.02, phase: 2.6 },
    capacity: 50,
    flowerZone: { minR: 0.5, maxR: 3.1 },
    content: 'flowerMeadow',
    unlocked: false,
    lockHint: '主花島種滿花之後，就會長出浮石橋通到這裡'
  }
];

// 浮石橋：兩座島都解鎖後才會出現
export const BRIDGES = [
  { from: 'main', to: 'pet', stones: 5 },
  { from: 'main', to: 'pond', stones: 5 },
  { from: 'pond', to: 'museum', stones: 5 },
  { from: 'main', to: 'rainbow-1', stones: 5 }
];

// 畫質設定：省電模式給舊 iPhone 用
export const QUALITY = {
  normal: { maxDpr: 1.5, shadows: true,  idleFps: 24 },
  saver:  { maxDpr: 1.0, shadows: false, idleFps: 12 }
};

// 效能預算（?debug=1 時會顯示，超過會變紅）
export const BUDGET = { drawCalls: 80, triangles: 100000 };
