// 📝 群島裡的記錄視窗：11 種項目，跟原本花園（record.html）存成一模一樣的格式
//   { date, time, period, type, content, category }（修改時多一個 id）→ POST 到 n8n
//
// 給長輩用的設計：
//   - 大按鈕、一個步驟一個畫面（先選項目 → 再填內容）
//   - 不用系統的 alert/confirm：錯誤直接寫在畫面上；數字怪怪的要「再按一次儲存」才存
//   - 時段（早／中／晚、早上／晚上）依現在時間先幫忙選好
//   - 步數：今天的話點了就直接跑 iPhone 捷徑「上傳步數」（main.js 的 startStepSync，跟舊版一樣），
//     捷徑失敗時可以改成自己輸入（openManualSteps）
//
// 用到的全域（跟原本花園共用的一般 <script>）：
//   N8N_POST_URL（config.js）、gardenHeaders / isKeyRejected / getGardenKey（api.js）、getFormattedDate（utils.js）

export const RECORD_TYPES = [
  { type: '早餐', cat: 'food', emoji: '🥪' },
  { type: '午餐', cat: 'food', emoji: '🍱' },
  { type: '晚餐', cat: 'food', emoji: '🍲' },
  { type: '點心', cat: 'food', emoji: '🍎' },
  { type: '喝水', cat: 'water', emoji: '💧' },
  { type: '胰島素', cat: 'medical', emoji: '💉' },
  { type: '吃藥', cat: 'medical', emoji: '💊' },
  { type: '步數', cat: 'steps', emoji: '👣' },
  { type: '血壓', cat: 'bp', emoji: '🩺' },
  { type: '血糖', cat: 'glucose', emoji: '🩸' },
  { type: '身體狀況', cat: 'status', emoji: '👩‍⚕️' }
];
const PERIODS = { medical: ['早', '中', '晚', '睡前'], bp: ['早上', '晚上'] };
const BP_PERIOD_TIME = { '早上': '08:00', '晚上': '20:00' };   // 血壓存代表時間（跟原本一樣）
const WATER_GOAL = 1500, BEE_STEP_GOAL = 3000;

const pad = (n) => String(n).padStart(2, '0');
const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dateKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function guessPeriod(cat) {
  const h = new Date().getHours();
  if (cat === 'bp') return h < 12 ? '早上' : '晚上';
  if (cat === 'medical') return h < 11 ? '早' : h < 16 ? '中' : h < 21 ? '晚' : '睡前';
  return '';
}
function parseBP(text) {
  const m = String(text || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const p = String(text).match(/脈搏\s*(\d+)/);
  return { sys: +m[1], dia: +m[2], pulse: p ? +p[1] : null };
}
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

// opts:
//   root           視窗外框（.modal-backdrop），內容會畫在 root 的 .rec-card 裡
//   demo           展示模式：不真的上傳
//   getRecords(date)  回傳那天的紀錄陣列
//   save(payload)  真的送出（回傳 Promise<'ok' | 'rejected' | 'error'>）
//   onSaved({ payload, demo }) 存好之後（main.js 重新讀資料、讓花苞長大、顯示恭喜）
//   onStepSync()       今天的步數：交給 main.js 跑 iPhone 捷徑（展示模式不會呼叫）
export function createRecordPanel(opts) {
  const card = opts.root.querySelector('.rec-card');
  let date = dateKeyOf(new Date());
  let current = null;      // 正在填的項目 { type, cat, emoji }
  let editingId = null;
  let period = '';
  let warnedOnce = '';     // 數字怪怪的：記住警告過哪個值，再按一次才存
  let saving = false;

  const close = () => opts.root.classList.remove('show');

  // ---------- 第 1 步：選項目 ----------
  function renderPicker() {
    current = null;
    card.innerHTML = '';
    card.appendChild(el('h3', 'rec-title', '📝 要記什麼呢？'));

    // 今天／昨天（補登）
    const days = el('div', 'rec-days');
    const today = dateKeyOf(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = dateKeyOf(y);
    const choices = [[today, '今天'], [yesterday, '昨天（補登）']];
    // 從月曆點進來補登其他日子：多一個那天的按鈕
    if (date !== today && date !== yesterday) {
      const [, mm, dd] = date.split('-').map(Number);
      choices.push([date, `${mm}/${dd}（補登）`]);
      days.style.gridTemplateColumns = '1fr 1fr 1fr';
    }
    choices.forEach(([k, label]) => {
      const b = el('button', 'rec-day' + (date === k ? ' on' : ''), label);
      b.addEventListener('click', () => { date = k; renderPicker(); });
      days.appendChild(b);
    });
    card.appendChild(days);

    const recs = opts.getRecords(date) || [];
    const grid = el('div', 'rec-grid');
    RECORD_TYPES.forEach(t => {
      const n = recs.filter(r => r.type === t.type).length;
      const b = el('button', 'rec-type' + (n ? ' done' : ''));
      b.appendChild(el('span', 'rec-emoji', t.emoji));
      b.appendChild(el('span', 'rec-label', t.type));
      if (n) b.appendChild(el('span', 'rec-badge', '✓' + (n > 1 ? n : '')));
      b.addEventListener('click', () => {
        // 今天的步數：直接叫 iPhone 捷徑上傳（捷徑只拿得到今天的；補登以前的日子用手動輸入）
        if (t.cat === 'steps' && date === dateKeyOf(new Date()) && !opts.demo && opts.onStepSync) {
          close();
          opts.onStepSync();
          return;
        }
        openForm(t);
      });
      grid.appendChild(b);
    });
    card.appendChild(grid);

    const got = new Set(recs.map(r => r.type)).size;
    card.appendChild(el('p', 'rec-hint', got
      ? `${date === today ? '今天' : date === yesterday ? '昨天' : '這一天'}已經記了 ${recs.length} 筆（${got} 種項目） 👍`
      : '每記一筆，今日花苞就會長大一點 🌱'));

    const foot = el('div', 'rec-foot');
    const cal = el('button', 'rec-link', '📅 月曆和紀錄表');
    cal.addEventListener('click', () => { close(); opts.onOpenHistory?.(); });
    const x = el('button', 'rec-cancel', '關閉');
    x.addEventListener('click', close);
    foot.append(cal, x);
    card.appendChild(foot);
  }

  // ---------- 第 2 步：填內容 ----------
  function openForm(t, editRec = null) {
    current = t;
    editingId = editRec ? editRec.id : null;
    period = editRec?.period || guessPeriod(t.cat);
    warnedOnce = '';
    card.innerHTML = '';
    card.appendChild(el('h3', 'rec-title', `${t.emoji} ${t.type}${editRec ? '（修改）' : ''}`));
    if (date !== dateKeyOf(new Date())) card.appendChild(el('p', 'rec-hint', '📅 補登昨天的紀錄'));

    const form = el('div', 'rec-form');
    const fields = {};

    // 時段按鈕
    if (PERIODS[t.cat]) {
      form.appendChild(el('label', 'rec-q', t.cat === 'bp' ? '早上還是晚上量的？' : '哪個時段？'));
      const row = el('div', 'rec-periods');
      PERIODS[t.cat].forEach(p => {
        const b = el('button', 'rec-period' + (p === period ? ' on' : ''), p);
        b.addEventListener('click', () => {
          period = p;
          row.querySelectorAll('.rec-period').forEach(x => x.classList.toggle('on', x === b));
        });
        row.appendChild(b);
      });
      form.appendChild(row);
    }

    const input = (key, label, type, placeholder, value = '') => {
      form.appendChild(el('label', 'rec-q', label));
      const i = el('input', 'rec-input');
      i.type = type;
      if (type === 'number') i.inputMode = 'numeric';
      i.placeholder = placeholder;
      i.value = value;
      form.appendChild(i);
      fields[key] = i;
      return i;
    };

    if (t.cat === 'bp') {
      const bp = parseBP(editRec?.content);
      const row = el('div', 'rec-bp');
      form.appendChild(row);
      [['sys', '高壓（收縮壓）', bp?.sys], ['dia', '低壓（舒張壓）', bp?.dia], ['pulse', '脈搏（可不填）', bp?.pulse]].forEach(([k, label, v]) => {
        const box = el('div', 'rec-bp-box');
        box.appendChild(el('label', 'rec-q', label));
        const i = el('input', 'rec-input');
        i.type = 'number'; i.inputMode = 'numeric'; i.value = v ?? '';
        box.appendChild(i);
        row.appendChild(box);
        fields[k] = i;
      });
    } else {
      const v = editRec?.content || '';
      if (t.cat === 'food') input('content', `${t.type}吃了什麼？`, 'text', '例如：稀飯、青菜、蛋', v);
      if (t.cat === 'status') input('content', '身體覺得怎麼樣？', 'text', '例如：精神不錯、有點頭暈', v);
      if (t.type === '胰島素') input('content', '打了幾單位？', 'number', '輸入劑量', v);
      if (t.type === '吃藥') input('content', '吃了什麼藥？', 'text', '藥品名稱', v);
      if (t.cat === 'glucose') input('content', '血糖多少？（mg/dL）', 'number', '例如：110', v);
      if (t.cat === 'steps') input('content', '今天總共走了幾步？', 'number', '例如：3500', v);
      if (t.cat === 'water') {
        const i = input('content', '喝了多少水？（ml）', 'number', '例如：250', v);
        const quick = el('div', 'rec-quick');
        [150, 250, 350, 500].forEach(ml => {
          const b = el('button', 'rec-chip', `${ml} ml`);
          b.addEventListener('click', () => { i.value = ml; });
          quick.appendChild(b);
        });
        form.appendChild(quick);
        const total = (opts.getRecords(date) || []).filter(r => r.type === '喝水').reduce((s, r) => s + (parseInt(r.content) || 0), 0);
        form.appendChild(el('p', 'rec-hint', `${date === dateKeyOf(new Date()) ? '今天' : '那天'}已經喝了 ${total} ml，目標 ${WATER_GOAL} ml 💧`));
      }
      // 時間（血壓不用）
      input('time', '什麼時候？', 'time', '', editRec?.time || nowTime());
    }

    const msg = el('p', 'rec-msg');
    form.appendChild(msg);
    card.appendChild(form);

    // 這一天已經記過的（可以修改）
    const mine = (opts.getRecords(date) || []).filter(r => r.type === t.type);
    if (mine.length && !editRec) {
      const box = el('div', 'rec-history');
      box.appendChild(el('div', 'rec-q', `已經記過的${t.type}：`));
      mine.forEach(r => {
        const row = el('div', 'rec-hist-row');
        const when = t.cat === 'bp' ? (r.period || '') : `${r.time || ''}${r.period ? ' ' + r.period : ''}`;
        row.appendChild(el('span', 'rec-hist-text', `${when}　${r.content}`));
        if (r.id != null) {
          const e = el('button', 'rec-chip', '修改');
          e.addEventListener('click', () => openForm(t, r));
          row.appendChild(e);
        }
        box.appendChild(row);
      });
      card.appendChild(box);
    }

    const foot = el('div', 'rec-foot');
    const back = el('button', 'rec-cancel', '← 返回');
    back.addEventListener('click', renderPicker);
    const save = el('button', 'rec-save', editRec ? '🔄 更新紀錄' : '💾 儲存');
    save.addEventListener('click', () => submit(fields, msg, save));
    foot.append(back, save);
    card.appendChild(foot);
    (fields.content || fields.sys)?.focus?.();
  }

  // ---------- 檢查、送出 ----------
  async function submit(fields, msg, btn) {
    if (saving) return;
    const t = current;
    const warn = (text) => { msg.textContent = text; msg.className = 'rec-msg'; };
    const askAgain = (key, text) => {
      if (warnedOnce === key) return false;     // 已經提醒過，這次就存
      warnedOnce = key;
      msg.textContent = text + '\n確定沒問題的話，再按一次「儲存」。';
      msg.className = 'rec-msg warn';
      return true;
    };

    let content = (fields.content?.value || '').trim();
    let time = fields.time?.value || '';
    if (PERIODS[t.cat] && !period) return warn('請先選時段喔！');

    if (t.cat === 'bp') {
      const sys = parseInt(fields.sys.value), dia = parseInt(fields.dia.value);
      const pulse = parseInt(fields.pulse.value) || null;
      if (!sys || !dia) return warn('請輸入高壓和低壓兩個數字！');
      if ((sys <= dia || sys < 60 || sys > 260 || dia < 30 || dia > 160) && askAgain(`bp${sys}/${dia}`, `血壓 ${sys}/${dia} 好像怪怪的（高低壓有沒有填反？）`)) return;
      if (pulse && (pulse < 30 || pulse > 200) && askAgain(`p${pulse}`, `脈搏 ${pulse} 好像怪怪的。`)) return;
      content = `${sys}/${dia}` + (pulse ? ` 脈搏${pulse}` : '');
      time = BP_PERIOD_TIME[period];
    } else if (t.cat === 'glucose') {
      const g = parseInt(content);
      if (!g) return warn('請輸入血糖數字！');
      if ((g < 20 || g > 600) && askAgain(`g${g}`, `血糖 ${g} 好像怪怪的。`)) return;
      content = String(g);
    } else if (t.cat === 'water') {
      const ml = parseInt(content);
      if (!ml || ml <= 0) return warn('請輸入喝了多少 ml，或按上面的快速按鈕。');
      if (ml > 2000 && askAgain(`w${ml}`, `一次喝 ${ml} ml 好像有點多。`)) return;
      content = String(ml);
    } else if (t.cat === 'steps' || t.type === '胰島素') {
      const n = parseInt(content);
      if (!n && n !== 0) return warn('請輸入數字！');
      content = String(n);
    }
    if (!content) return warn('內容不能空白喔！');
    if (!time) return warn('請填時間！');

    const payload = { date, time, period: PERIODS[t.cat] ? period : '', type: t.type, content, category: t.cat };
    if (editingId != null) payload.id = editingId;

    saving = true;
    btn.textContent = '儲存中...';
    msg.textContent = '';
    try {
      if (opts.demo) {
        await new Promise(r => setTimeout(r, 300));
      } else {
        const result = await opts.save(payload);
        if (result === 'rejected') { warn('花園通行碼好像換了，請重新輸入。'); close(); opts.onKeyRejected?.(); return; }
        if (result !== 'ok') { warn('沒有存成功，網路好像不太穩，請再按一次「儲存」。'); return; }
      }
      close();
      await opts.onSaved({ payload, demo: opts.demo, message: successMessage(payload) });
    } finally {
      saving = false;
      btn.textContent = editingId != null ? '🔄 更新紀錄' : '💾 儲存';
    }
  }

  // ---------- 恭喜訊息（跟原本花園一樣的鼓勵） ----------
  function successMessage(p) {
    const recs = (opts.getRecords(p.date) || []).filter(r => r.id == null || r.id !== p.id);
    const isToday = p.date === dateKeyOf(new Date());
    let text;
    if (p.type === '喝水') {
      const total = recs.filter(r => r.type === '喝水').reduce((s, r) => s + (parseInt(r.content) || 0), 0) + (parseInt(p.content) || 0);
      text = total >= WATER_GOAL ? `太棒了！喝水目標達成！\n${isToday ? '今天' : '那天'}已經喝了 ${total} ml 💧\n喝水達標的日子，會讓池塘搬來新的魚喔！`
           : total >= 1000 ? `已經喝了 ${total} ml 囉！\n再喝一點點就達標了，繼續加油 💧`
           : `喝水紀錄好囉！已經喝了 ${total} ml，保持水分充足 💧`;
    } else if (p.type === '步數') {
      const n = parseInt(p.content) || 0;
      text = n >= BEE_STEP_GOAL ? `太厲害了！${isToday ? '今天' : '那天'}走了 ${n} 步 🐝\n勤勞的蜜蜂也跟著飛來了！` : `走了 ${n} 步，紀錄好囉！\n再多走一點，蜜蜂就會飛來 👣`;
    } else if (p.type === '血壓') {
      const bp = parseBP(p.content);
      text = `${p.period}血壓 ${bp.sys}/${bp.dia}${bp.pulse ? `、脈搏 ${bp.pulse}` : ''} 紀錄好囉！`;
      if (bp.sys >= 140 || bp.dia >= 90) text += '\n今天的數值有點偏高，記得放鬆休息一下，如果一直偏高要跟醫生說喔 🩺';
      else if (bp.sys < 90 || bp.dia < 60) text += '\n今天的數值有點偏低，起身動作慢一點，如果頭暈或一直偏低要跟醫生說喔 🩺';
      else text += '\n每天量血壓，是照顧自己最好的習慣 💗';
    } else if (p.type === '血糖') {
      text = `${friendlyHour(p.time)}血糖 ${p.content} mg/dL 紀錄好囉！\n固定量血糖，是照顧自己最好的習慣 💗`;
    } else {
      const msgs = ['太棒了！每一筆紀錄都是愛自己的證明。', '持之以恆，花園會越開越美麗！', '很棒的紀錄！今天的妳也辛苦了。', '又完成了一次紀錄，離健康目標更近一步囉！', '超讚！花苞因為妳的努力又長大了。'];
      text = msgs[Math.floor(Math.random() * msgs.length)];
    }
    if (!isToday) text += '\n（補登的紀錄也算數喔！）';
    return text;
  }

  return {
    open(onDate) {
      date = onDate || dateKeyOf(new Date());
      renderPicker();
      opts.root.classList.add('show');
    },
    // 捷徑沒成功 → 自己輸入今天的步數
    openManualSteps() {
      date = dateKeyOf(new Date());
      openForm(RECORD_TYPES.find(t => t.cat === 'steps'));
      opts.root.classList.add('show');
    },
    close
  };
}
