// 📖 圖鑑（圖鑑博物館島、上方「📖 圖鑑」按鈕都會打開）
//
// 每一頁 = GALLERY_TABS 裡的一項。之後要新增圖鑑（例如蜜蜂、鳥之森），
// 在 GALLERY_TABS 加一項就好：
//   {
//     id: 'bees', label: '🐝 蜜蜂',
//     items: (s) => BEE_INFO.map(b => ({
//       name: b.name, emoji: b.emoji,           // 或 img: '圖片檔.png'
//       unlocked: ...,                           // 已解鎖 → 顯示；沒解鎖 → ???
//       desc: b.desc, tip: b.tip,                // 點進去看到的介紹
//       lockText: '解鎖條件說明', sub: '格子下面的小字（可省略）'
//     }))
//   }
// s（目前狀態）由 main.js 的 galleryState() 提供。
// 不是格子的頁面（例如改版紀錄）：給 render() 自己畫內容，count() 是上方小字。

import { VERSIONS } from './versions.js';

export const GALLERY_TABS = [
  {
    id: 'flowers', label: '🌸 花',
    items: (s) => (typeof ALL_FLOWERS !== 'undefined' ? ALL_FLOWERS : []).map(file => {
      const info = (typeof FLOWER_INFO !== 'undefined' && FLOWER_INFO[file]) || {};
      const n = s.bloomCount[file] || 0;
      return {
        name: (typeof FLOWER_DIC !== 'undefined' && FLOWER_DIC[file]) || file,
        img: file,
        unlocked: s.unlockedFlowers.has(file),
        desc: (info.lang ? `花語：${info.lang}\n\n` : '') + (info.desc || '介紹準備中'),
        tip: info.tip || '',
        lockText: '開出今日之花時，有機會遇見新品種（記得越多，機會越大）',
        sub: n ? `島上 ${n} 朵` : ''
      };
    })
  },
  {
    id: 'pets', label: '🐾 寵物',
    items: (s) => [
      ['小柴犬', '🐕', 'shiba', 'shiba', '連續紀錄 7 天'],
      ['德國牧羊犬', '🐕', 'gs', 'shepherd', '連續紀錄 30 天'],
      ['東藍鴝（青鳥）', '🐦', 'bluebird', 'bluebird', '連續紀錄 60 天'],
      ['綠繡眼', '🐦', 'greenbird', 'greenbird', '一天內 11 種項目全部都有紀錄']
    ].map(([name, emoji, key, model, lockText]) => {
      const p = (typeof PET_INFO !== 'undefined') ? PET_INFO.find(x => x.name === name) : null;
      return { name, emoji, thumbKey: 'pet:' + model, unlocked: !!s.petUnlocks[key], desc: p?.desc || '', tip: p?.tip || '', lockText };
    })
  },
  {
    id: 'fish', label: '🐟 魚',
    items: (s) => (typeof FISH_INFO !== 'undefined' ? FISH_INFO : []).map(f => ({
      name: f.name, emoji: f.emoji, thumbKey: 'fish:' + f.id, unlocked: s.fishUnlocked.has(f.id), desc: f.desc, tip: f.tip,
      lockText: f.unlockText + (s.demo ? '' : `\n目前已經累計 ${s.waterDays} 天，再 ${Math.max(0, f.waterDays - s.waterDays)} 天 💧`)
    }))
  },
  {
    id: 'decor', label: '🪑 裝飾',
    items: (s) => (typeof DECOR_ORDER !== 'undefined' ? DECOR_ORDER : []).map((id, i) => {
      const d = DECOR_INFO.find(x => x.id === id);
      const week = i + 1;
      return {
        name: d.name, emoji: d.emoji, thumbKey: 'decor:' + id, unlocked: s.decorUnlocked.has(id),
        desc: `📍 ${s.islandName(d.island)}\n\n${d.desc}` + (d.glow ? '\n\n🌙 晚上會亮燈喔！' : ''),
        tip: '', sub: `第 ${week} 週`,
        lockText: `記錄滿 ${week} 週（累計 ${week * DECOR_DAYS_PER_ITEM} 天有紀錄）` +
          (s.demo ? '' : `\n目前已經累計 ${s.totalDays} 天，再 ${Math.max(0, week * DECOR_DAYS_PER_ITEM - s.totalDays)} 天 📅`)
      };
    })
  },
  {
    id: 'versions', label: '📜 改版',
    count: () => '花園長大的故事',
    render: () => {
      const list = document.createElement('div');
      list.className = 'ver-list';
      VERSIONS.forEach((v, i) => {
        const card = document.createElement('div');
        card.className = 'ver-card' + (i === 0 ? ' newest' : '');
        card.innerHTML = '<div class="ver-icon"></div><div><div class="ver-title"></div><div class="ver-date"></div><div class="ver-text"></div></div>';
        card.querySelector('.ver-icon').textContent = v.icon;
        card.querySelector('.ver-title').textContent = v.title + (i === 0 ? ' 🆕' : '');
        card.querySelector('.ver-date').textContent = v.date;
        card.querySelector('.ver-text').textContent = v.text;
        list.appendChild(card);
      });
      return list;
    }
  }
  // ⬇️ 之後新增的圖鑑加在這裡
];

// 畫出圖鑑視窗
// el: { modal, tabs, body, count }；getState(): 目前狀態；showDetail(item): 點格子後顯示介紹
export function createGallery(el, getState, showDetail) {
  let current = GALLERY_TABS[0].id;

  function render() {
    const s = getState();
    el.tabs.innerHTML = '';
    GALLERY_TABS.forEach(tab => {
      const b = document.createElement('button');
      b.className = 'gal-tab' + (tab.id === current ? ' active' : '');
      b.textContent = tab.label;
      b.addEventListener('click', () => { current = tab.id; render(); });
      el.tabs.appendChild(b);
    });

    const tab = GALLERY_TABS.find(t => t.id === current);
    if (tab.render) {
      el.count.textContent = tab.count ? tab.count(s) : '';
      el.body.innerHTML = '';
      el.body.appendChild(tab.render(s));
      el.body.scrollTop = 0;
      return;
    }
    const items = tab.items(s);
    const got = items.filter(i => i.unlocked).length;
    el.count.textContent = `已收集 ${got} / ${items.length}`;

    el.body.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'achv-grid';
    items.forEach(it => {
      const cell = document.createElement('button');
      cell.className = 'achv-cell' + (it.unlocked ? '' : ' locked');
      const icon = document.createElement('div');
      icon.className = 'achv-icon';
      // 圖片：花用原本的像素圖；寵物、魚、裝飾品用島上真正的 3D 模型拍的小圖
      // 還沒解鎖 → 剪影（看得出形狀，看不出顏色）
      const img = document.createElement('img');
      img.alt = '';
      img.className = 'achv-img' + (it.unlocked ? '' : ' sil');
      if (it.img) {
        img.src = it.img;
        icon.appendChild(img);
      } else if (it.thumbKey && s.getThumb) {
        icon.appendChild(img);
        s.getThumb(it.thumbKey, !it.unlocked).then(url => { img.src = url; }).catch(() => { icon.textContent = it.unlocked ? it.emoji : '❓'; });
      } else {
        icon.textContent = it.unlocked ? it.emoji : '❓';
      }
      const name = document.createElement('div');
      name.className = 'achv-name';
      name.textContent = it.unlocked ? it.name : '???';
      cell.append(icon, name);
      if (it.sub) {
        const sub = document.createElement('div');
        sub.className = 'achv-sub';
        sub.textContent = it.sub;
        cell.appendChild(sub);
      }
      cell.addEventListener('click', () => { el.modal.classList.remove('show'); showDetail(it); });
      grid.appendChild(cell);
    });
    el.body.appendChild(grid);
    el.body.scrollTop = 0;
  }

  return {
    open(tabId) {
      if (tabId) current = tabId;
      render();
      el.modal.classList.add('show');
    },
    close() { el.modal.classList.remove('show'); }
  };
}
