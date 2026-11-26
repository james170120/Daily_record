// =========================================
// 💾 遊戲進度儲存 (Store)
// 以前進度只存在 localStorage，換手機或清資料就不見了。
// 現在照樣先存在這支手機 (讀寫即時、離線也能玩)，再同步到後端 (n8n → Supabase 的 game_progress 表)。
//
// 規則：
// - 只有 SYNCED_KEYS 裡的項目會同步；通行碼 (garden_key)、下雨提示時間 (rain_toast_last) 只留在這支手機
// - 每個項目各自記「最後修改時間」，同步時誰比較新就用誰的 (後端沒有的就把這支手機的傳上去)
// - 後端還沒設定好、或網路不通時，遊戲照常運作，下次再同步 (不會跳錯誤)
// 之後 (城市版) 新增的進度項目，只要把 key 加進 SYNCED_KEYS 即可
// =========================================
const SYNCED_KEYS = [
    // 🌸 花
    'unlocked_flowers', 'record_flowers', 'base_flowers', 'withered_flowers', 'last_wither_at',
    'flower_spots', 'latest_unlocked_flower',
    // 🐕 寵物解鎖與通知
    'dog_unlocked_notified', 'dog_unlock_date', 'gs_unlocked_notified', 'gs_unlock_date',
    'bird_unlocked_notified', 'bird_unlock_date', 'greenbird_unlocked_notified',
    // 📋 佈告欄、蜜蜂通知、偏好
    'notice_events', 'bee_notified_dates', 'garden_layout', 'layout_hint_shown',
    // 🏝️ 漂浮群島：每天開了哪朵今日之花、看過哪些島的解鎖通知
    'island_day_flowers', 'island_unlock_seen', 'unlocked_fish', 'unlocked_decor'
];

const Store = (() => {
    const META_KEY = 'store_meta';        // 每個項目最後修改時間 (毫秒)，只存在這支手機
    const FLUSH_DELAY = 2000;             // 改了之後等 2 秒再一次送出，避免連續改動一直送
    const SYNC_TIMEOUT = 5000;            // 同步最多等 5 秒，不讓花園被網路拖住
    const synced = new Set(SYNCED_KEYS);
    let meta = {};
    let dirty = new Set();
    let flushTimer = null;
    let syncing = null;
    let status = 'idle';                  // idle | ok | local (後端不可用，只存在這支手機)

    try { meta = JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch (e) { meta = {}; }
    function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {} }

    function get(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function set(key, value) {
        try { localStorage.setItem(key, String(value)); } catch (e) {}
        if (!synced.has(key)) return;
        meta[key] = Date.now();
        saveMeta();
        dirty.add(key);
        clearTimeout(flushTimer);
        flushTimer = setTimeout(() => flush(), FLUSH_DELAY);
    }
    function remove(key) {
        try { localStorage.removeItem(key); } catch (e) {}
    }

    function withTimeout(ms) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        return { signal: ctrl.signal, done: () => clearTimeout(t) };
    }

    // 把改過的項目送到後端；失敗就留著，下次再送
    async function flush(keys, onLeave) {
        clearTimeout(flushTimer);
        const list = (keys || [...dirty]).filter(k => get(k) !== null);
        if (!list.length || !getGardenKey()) return;
        const items = list.map(k => ({
            key: k, value: get(k), updated_at: new Date(meta[k] || Date.now()).toISOString()
        }));
        const to = withTimeout(SYNC_TIMEOUT);
        try {
            const res = await fetch(N8N_PROGRESS_SAVE_URL, {
                method: 'POST', headers: gardenHeaders(true), body: JSON.stringify({ items }),
                signal: to.signal, keepalive: !!onLeave
            });
            if (res.ok) { list.forEach(k => dirty.delete(k)); status = 'ok'; }
            else status = 'local';
        } catch (e) { status = 'local'; }
        to.done();
    }

    // 後端回傳可能是陣列、單一物件、或空內容，統一整理成 [{key, value, updated_at}]
    function parseRows(text) {
        if (!text || !text.trim()) return [];
        let data;
        try { data = JSON.parse(text); } catch (e) { return []; }
        if (!Array.isArray(data)) data = [data];
        return data.filter(r => r && typeof r.key === 'string' && synced.has(r.key) && r.value !== null && r.value !== undefined);
    }

    // 開啟遊戲時同步一次：後端比較新就拿後端的，這支手機比較新或後端沒有，就傳上去
    function sync() {
        if (syncing) return syncing;
        syncing = (async () => {
            if (!getGardenKey()) return;
            const to = withTimeout(SYNC_TIMEOUT);
            try {
                const res = await fetch(N8N_PROGRESS_GET_URL + '?t=' + Date.now(), { headers: gardenHeaders(false), signal: to.signal });
                if (!res.ok) { status = 'local'; return; } // 後端還沒設定好 (404) 或通行碼不對，先只用這支手機的
                const remote = {};
                parseRows(await res.text()).forEach(r => { remote[r.key] = r; });
                const push = [];
                SYNCED_KEYS.forEach(key => {
                    const r = remote[key];
                    const localVal = get(key);
                    const localTs = meta[key] || 0;
                    if (r) {
                        const remoteTs = Date.parse(r.updated_at) || 0;
                        if (localVal === null || remoteTs > localTs) {
                            if (localVal !== String(r.value)) { try { localStorage.setItem(key, String(r.value)); } catch (e) {} }
                            meta[key] = remoteTs || Date.now();
                        } else if (localTs > remoteTs && localVal !== String(r.value)) {
                            push.push(key);
                        }
                    } else if (localVal !== null) {
                        if (!meta[key]) meta[key] = Date.now(); // 第一次搬家：這支手機既有的進度整批傳上去
                        push.push(key);
                    }
                });
                saveMeta();
                status = 'ok';
                if (push.length) await flush(push);
            } catch (e) { status = 'local'; }
            finally { to.done(); }
        })().finally(() => { syncing = null; });
        return syncing;
    }

    // 離開畫面時，把還沒送出的進度送出去
    document.addEventListener('visibilitychange', () => { if (document.hidden && dirty.size) flush(null, true); });
    window.addEventListener('pagehide', () => { if (dirty.size) flush(null, true); });

    return { get, set, remove, sync, flush, get status() { return status; } };
})();
