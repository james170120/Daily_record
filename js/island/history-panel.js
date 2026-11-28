// 📅 月曆與紀錄表（群島風格；取代原本花園 record.html 的月曆和血壓血糖表）
//   - 月曆：每天有哪些紀錄（小圖示）、早晚血壓；點日期看當天明細，可以補登那一天
//   - 紀錄表：一個月的血壓（早上／晚上，含脈搏、偏高偏低）或血糖（依量測時間）

const BP_HIGH_SYS = 140, BP_HIGH_DIA = 90, BP_LOW_SYS = 90, BP_LOW_DIA = 60;
const STEP_DETAIL_LIMIT = 5;
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

function parseBP(text) {
  const m = String(text || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const p = String(text).match(/脈搏\s*(\d+)/);
  return { sys: +m[1], dia: +m[2], pulse: p ? +p[1] : null };
}
const isHigh = (b) => b && (b.sys >= BP_HIGH_SYS || b.dia >= BP_HIGH_DIA);
const isLow = (b) => b && !isHigh(b) && (b.sys < BP_LOW_SYS || b.dia < BP_LOW_DIA);
const friendlyHour = (t) => {
  const h = parseInt(t);
  if (isNaN(h)) return '';
  if (h < 5) return `凌晨${h === 0 ? 12 : h}點`;
  if (h < 12) return `早上${h}點`;
  if (h === 12) return '中午12點';
  if (h < 18) return `下午${h - 12}點`;
  return `晚上${h - 12}點`;
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// opts: { root, getRecords(date), onAddRecord(date) }
export function createHistoryPanel(opts) {
  const card = opts.root.querySelector('.rec-card');
  let view = 'cal';          // 'cal' 月曆 | 'table' 紀錄表 | 'day' 某一天
  let tableKind = 'bp';      // 'bp' 血壓 | 'glu' 血糖
  let month = new Date(); month.setDate(1);
  let dayKey = '';
  let fromDay = '';          // 從某一天的明細點「看血壓表／血糖表」過來 → 表格下面有「← 回到這一天」

  const close = () => opts.root.classList.remove('show');
  const recs = (k) => opts.getRecords(k) || [];

  function header(title) {
    card.innerHTML = '';
    card.appendChild(el('h3', 'rec-title', title));
  }

  function tabs() {
    const row = el('div', 'rec-days');
    [['cal', '📅 月曆'], ['table', '🩺 血壓血糖表']].forEach(([v, label]) => {
      const b = el('button', 'rec-day' + (view === v ? ' on' : ''), label);
      b.addEventListener('click', () => { view = v; fromDay = ''; render(); });
      row.appendChild(b);
    });
    card.appendChild(row);
  }

  function monthNav() {
    const nav = el('div', 'his-nav');
    const prev = el('button', 'rec-chip', '‹ 上個月');
    const next = el('button', 'rec-chip', '下個月 ›');
    prev.addEventListener('click', () => { month.setMonth(month.getMonth() - 1); render(); });
    next.addEventListener('click', () => { month.setMonth(month.getMonth() + 1); render(); });
    nav.append(prev, el('div', 'his-month', `${month.getFullYear()} 年 ${month.getMonth() + 1} 月`), next);
    card.appendChild(nav);
  }

  function footer(extra) {
    const foot = el('div', 'rec-foot');
    if (extra) foot.appendChild(extra);
    const x = el('button', 'rec-cancel', '關閉');
    x.addEventListener('click', close);
    foot.appendChild(x);
    card.appendChild(foot);
  }

  // ---------- 月曆 ----------
  function renderCalendar() {
    header('📅 我的紀錄');
    tabs();
    monthNav();
    const y = month.getFullYear(), m = month.getMonth() + 1;
    const grid = el('div', 'his-cal');
    WEEK.forEach(w => grid.appendChild(el('div', 'his-week', w)));
    const first = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const now = new Date();
    const todayKey = keyOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
    for (let i = 0; i < first; i++) grid.appendChild(el('div', 'his-day empty'));
    let recordedDays = 0;
    for (let d = 1; d <= days; d++) {
      const k = keyOf(y, m, d);
      const list = recs(k);
      const cell = el('button', 'his-day' + (k === todayKey ? ' today' : '') + (list.length ? ' has' : ''));
      cell.appendChild(el('div', 'his-num', String(d)));
      if (list.length) {
        recordedDays++;
        // 小圖示：依重要程度最多 3 個
        const rules = [['💉', r => r.type === '胰島素'], ['💊', r => r.type === '吃藥'], ['🩺', r => r.type === '血壓'],
          ['🩸', r => r.type === '血糖'], ['🍽️', r => r.category === 'food'], ['💧', r => r.type === '喝水'], ['👣', r => r.type === '步數']];
        const icons = rules.filter(([, f]) => list.some(f)).map(([i]) => i).slice(0, 3).join('');
        cell.appendChild(el('div', 'his-icons', icons));
        cell.appendChild(el('div', 'his-count', `${list.length} 筆`));
      }
      cell.addEventListener('click', () => { dayKey = k; view = 'day'; render(); });
      grid.appendChild(cell);
    }
    card.appendChild(grid);
    card.appendChild(el('p', 'rec-hint', recordedDays
      ? `這個月有 ${recordedDays} 天有紀錄 🌸　點日期可以看當天記了什麼`
      : '這個月還沒有紀錄。點日期可以補登喔！'));
    footer();
  }

  // ---------- 某一天的明細 ----------
  function renderDay() {
    const [y, m, d] = dayKey.split('-').map(Number);
    header(`📅 ${m} 月 ${d} 日（${WEEK[new Date(y, m - 1, d).getDay()]}）`);
    const list = recs(dayKey);
    const order = { '早': 1, '早上': 1, '中': 2, '晚': 3, '晚上': 3, '睡前': 4 };

    const group = (title, color, types, opt = {}) => {
      const box = el('div', 'his-group');
      box.style.borderLeftColor = color;
      let items = list.filter(r => types.includes(r.type));
      const head = el('div', 'his-group-title', title + (opt.sum ? opt.sum(items) : ''));
      if (opt.table) {
        // 血壓、血糖：直接跳到那個月的血壓表／血糖表
        const go = el('button', 'his-jump', opt.table === 'bp' ? '看血壓表 ›' : '看血糖表 ›');
        go.addEventListener('click', () => {
          tableKind = opt.table;
          month = new Date(y, m - 1, 1);
          fromDay = dayKey;
          view = 'table';
          render();
        });
        head.appendChild(go);
      }
      box.appendChild(head);
      if (!items.length) { box.appendChild(el('div', 'his-empty', '沒有紀錄')); return box; }
      if (opt.byPeriod) items.sort((a, b) => (order[a.period] || 9) - (order[b.period] || 9));
      else items.sort((a, b) => String(a.time).localeCompare(String(b.time)));
      if (opt.limit && items.length > opt.limit) items = items.slice(-opt.limit);
      items.forEach(r => {
        const row = el('div', 'his-item');
        const label = types.length > 1 ? `${r.type}：` : '';
        const when = r.type === '血壓' ? (r.period || '') : opt.byPeriod ? `${r.period || ''} ${r.time || ''}` : (r.time || '');
        let text = r.content;
        if (r.type === '血壓') {
          const b = parseBP(r.content);
          if (b) text = `${b.sys}/${b.dia}` + (b.pulse ? `　脈搏 ${b.pulse}` : '') + (isHigh(b) ? '　⚠️偏高' : isLow(b) ? '　⚠️偏低' : '');
        }
        if (r.type === '喝水') text += ' ml';
        if (r.type === '步數') text += ' 步';
        if (r.type === '血糖') text += ' mg/dL';
        row.appendChild(el('span', 'his-item-text', label + text));
        row.appendChild(el('span', 'his-tag', when));
        box.appendChild(row);
      });
      return box;
    };

    const wrap = el('div', 'his-detail');
    wrap.append(
      group('🍽️ 飲食', '#f39c12', ['早餐', '午餐', '晚餐', '點心']),
      group('💧 喝水', '#3498db', ['喝水'], { sum: (it) => `（共 ${it.reduce((s, r) => s + (parseInt(r.content) || 0), 0)} ml）` }),
      group('👣 步數', '#2ecc71', ['步數'], { limit: STEP_DETAIL_LIMIT, sum: (it) => it.length ? `（最高 ${Math.max(...it.map(r => parseInt(r.content) || 0))} 步）` : '' }),
      group('🩺 血壓', '#e84393', ['血壓'], { byPeriod: true, table: 'bp' }),
      group('🩸 血糖', '#16a085', ['血糖'], { table: 'glu' }),
      group('💉 胰島素', '#e74c3c', ['胰島素'], { byPeriod: true }),
      group('💊 吃藥', '#27ae60', ['吃藥'], { byPeriod: true }),
      group('👩‍⚕️ 身體狀況', '#f1c40f', ['身體狀況'])
    );
    card.appendChild(wrap);

    const foot = el('div', 'rec-foot');
    const back = el('button', 'rec-cancel', '← 月曆');
    back.addEventListener('click', () => { view = 'cal'; render(); });
    const add = el('button', 'rec-save', '➕ 補登這一天');
    add.addEventListener('click', () => { close(); opts.onAddRecord(dayKey); });
    foot.append(back, add);
    card.appendChild(foot);
  }

  // ---------- 血壓／血糖表 ----------
  function renderTable() {
    header('🩺 血壓血糖表');
    tabs();
    monthNav();
    const kinds = el('div', 'rec-days');
    [['bp', '🩺 血壓'], ['glu', '🩸 血糖']].forEach(([k, label]) => {
      const b = el('button', 'rec-period' + (tableKind === k ? ' on' : ''), label);
      b.addEventListener('click', () => { tableKind = k; render(); });
      kinds.appendChild(b);
    });
    card.appendChild(kinds);

    const y = month.getFullYear(), m = month.getMonth() + 1;
    const days = new Date(y, m, 0).getDate();
    const table = el('table', 'his-table');
    const head = el('tr');
    (tableKind === 'bp' ? ['日期', '☀️ 早上', '🌙 晚上'] : ['日期', '🩸 血糖（量的時間）']).forEach(t => head.appendChild(el('th', '', t)));
    table.appendChild(head);
    let rows = 0;

    const bpCell = (items) => {
      const td = el('td');
      if (!items.length) { td.appendChild(el('span', 'his-dash', '—')); return td; }
      items.forEach(b => {
        const line = el('div', 'his-bp');
        line.appendChild(el('span', 'his-bp-val' + (isHigh(b) ? ' high' : isLow(b) ? ' low' : ''), `${b.sys}/${b.dia}`));
        if (isHigh(b)) line.appendChild(el('span', 'his-flag high', '偏高'));
        if (isLow(b)) line.appendChild(el('span', 'his-flag low', '偏低'));
        if (b.pulse) line.appendChild(el('span', 'his-pulse', `♡${b.pulse}`));
        td.appendChild(line);
      });
      return td;
    };

    for (let d = 1; d <= days; d++) {
      const k = keyOf(y, m, d);
      const list = recs(k);
      const dateTd = el('td', 'his-date', `${m}/${d}\n(${WEEK[new Date(y, m - 1, d).getDay()]})`);
      if (tableKind === 'bp') {
        const am = list.filter(r => r.type === '血壓' && r.period === '早上').map(r => parseBP(r.content)).filter(Boolean);
        const pm = list.filter(r => r.type === '血壓' && r.period === '晚上').map(r => parseBP(r.content)).filter(Boolean);
        if (!am.length && !pm.length) continue;
        const tr = el('tr');
        tr.append(dateTd, bpCell(am), bpCell(pm));
        table.appendChild(tr);
      } else {
        const glu = list.filter(r => r.type === '血糖' && parseInt(r.content))
          .sort((a, b) => String(a.time).localeCompare(String(b.time)));
        if (!glu.length) continue;
        const tr = el('tr');
        const td = el('td');
        glu.forEach(g => {
          const line = el('div', 'his-glu');
          line.appendChild(el('span', 'his-glu-val', `${parseInt(g.content)}`));
          line.appendChild(el('span', 'his-tag', friendlyHour(g.time)));
          td.appendChild(line);
        });
        tr.append(dateTd, td);
        table.appendChild(tr);
      }
      rows++;
    }
    if (!rows) {
      const tr = el('tr');
      const td = el('td', 'his-none', `這個月還沒有${tableKind === 'bp' ? '血壓' : '血糖'}紀錄`);
      td.colSpan = 3;
      tr.appendChild(td);
      table.appendChild(tr);
    }
    const scroller = el('div', 'his-table-wrap');
    scroller.appendChild(table);
    card.appendChild(scroller);
    card.appendChild(el('p', 'rec-hint', tableKind === 'bp'
      ? '血壓單位 mmHg，♡ 是脈搏（次／分）\n偏高：高壓 ≥ 140 或低壓 ≥ 90；偏低：高壓 < 90 或低壓 < 60'
      : '血糖單位 mg/dL，後面是量的時間'));
    let back = null;
    if (fromDay) {
      const [, fm, fd] = fromDay.split('-').map(Number);
      back = el('button', 'rec-cancel', `← 回到 ${fm}/${fd}`);
      back.addEventListener('click', () => { dayKey = fromDay; fromDay = ''; view = 'day'; render(); });
    }
    footer(back);
  }

  function render() {
    card.scrollTop = 0;
    if (view === 'day') renderDay();
    else if (view === 'table') renderTable();
    else renderCalendar();
  }

  return {
    open(which = 'cal') {
      view = which;
      fromDay = '';
      month = new Date(); month.setDate(1);
      render();
      opts.root.classList.add('show');
    },
    close
  };
}
