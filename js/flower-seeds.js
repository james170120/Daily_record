        // =========================================
        // 🌸 花朵抽卡：每筆紀錄綁定一朵花
        // 開花 (滿 6 小時) 時抽卡並記住，移盆 (滿 8 小時) 後花園裡長的就是同一朵
        // =========================================
        // 捷徑上傳的步數會帶 period: '捷徑'，用來跟手動輸入區分
        const SHORTCUT_PERIOD = '捷徑';
        function isShortcutStep(r) { return r.type === '步數' && r.period === SHORTCUT_PERIOD; }

        function getRecordKey(date, r) {
            return r.id != null ? `id:${r.id}` : `${date}|${r.time}|${r.type}|${r.content}`;
        }

        // 抽一朵花：95% 從已解鎖的花挑、5% 解鎖一朵新花
        function drawRandomFlower() {
            const unlocked = JSON.parse(Store.get('unlocked_flowers')) || [...DEFAULT_UNLOCKED_FLOWERS];
            const locked = ALL_FLOWERS.filter(f => !unlocked.includes(f));
            if (locked.length > 0 && Math.random() < 0.05) {
                const file = locked[Math.floor(Math.random() * locked.length)];
                unlocked.push(file);
                Store.set('unlocked_flowers', JSON.stringify(unlocked));
                // 🌟 記錄最新獲得的花朵，供佈告欄顯示 🌟
                Store.set('latest_unlocked_flower', JSON.stringify({ file, date: getFormattedDate(new Date()) }));
                addNotice('flower', file);
                console.log("🎉 解鎖新花朵！", file);
                return { file, isNew: true };
            }
            return { file: unlocked[Math.floor(Math.random() * unlocked.length)], isNew: false };
        }

        // 讀取「紀錄 → 花朵」對照表；第一次升級時，把舊版花園排程依序配給已移盆的紀錄，保留原本的花
        function loadRecordFlowers(records) {
            const saved = JSON.parse(Store.get('record_flowers') || 'null');
            if (saved) return saved;

            const map = {};
            const legacy = JSON.parse(Store.get('garden_flower_list')) || [];
            if (legacy.length >= 4) Store.set('base_flowers', JSON.stringify(legacy.slice(0, 4)));
            records.filter(r => r.age >= 8).forEach((r, i) => {
                if (legacy[4 + i]) map[r.key] = { file: legacy[4 + i], isNew: false };
            });
            Store.set('record_flowers', JSON.stringify(map));
            return map;
        }

        // 花園一開始就有的 4 朵保底花
        function getBaseFlowers() {
            const saved = JSON.parse(Store.get('base_flowers') || 'null');
            if (saved) return saved;
            Store.set('base_flowers', JSON.stringify(DEFAULT_UNLOCKED_FLOWERS));
            return [...DEFAULT_UNLOCKED_FLOWERS];
        }

        // 算出花園目前的狀態：生長區有哪些、花園裡要開哪些花 (花園與盆栽頁共用)
        function computeGardenState() {
            const now = new Date();
            const records = [];
            Object.keys(recordsDB).forEach(date => {
                // 👣 捷徑上傳的步數一天只算一顆種子 (只留當天最早那筆)；手動輸入和其他紀錄不受限制
                const extraAutoSteps = new Set(recordsDB[date].filter(isShortcutStep)
                    .sort((a, b) => String(a.time).localeCompare(String(b.time))).slice(1));
                recordsDB[date].forEach(r => {
                    if (extraAutoSteps.has(r)) return;
                    const dt = new Date(`${date}T${r.time}:00`);
                    if (!isNaN(dt.getTime()) && dt.getFullYear() >= 2026 && dt <= now) {
                        records.push({ key: getRecordKey(date, r), dt, age: (now - dt) / (1000 * 60 * 60) });
                    }
                });
            });
            records.sort((a, b) => a.dt - b.dt);

            // 開花 (滿 6 小時) 還沒抽過花的紀錄，現在抽 (沒在 6~8 小時打開 App 的，移盆時補抽)
            const recordFlowers = loadRecordFlowers(records);
            let changed = false;
            records.forEach(rec => {
                if (rec.age >= 6 && !recordFlowers[rec.key]) {
                    recordFlowers[rec.key] = drawRandomFlower();
                    changed = true;
                }
                rec.flower = recordFlowers[rec.key] || null;
            });
            if (changed) Store.set('record_flowers', JSON.stringify(recordFlowers));

            // 花園裡所有種過的花 (保底花 + 已移盆的花)，plantedAt = 種進花園的時間
            const harvested = records.filter(r => r.age >= 8);
            const allGardenFlowers = getBaseFlowers().map((file, i) => ({ key: `base:${i}`, file, plantedAt: 0 }))
                .concat(harvested.map(r => ({ key: r.key, file: r.flower.file, plantedAt: r.dt.getTime() + FLOWER_TRANSPLANT_MS })));

            const withered = applyWithering(allGardenFlowers, now.getTime());
            const alive = allGardenFlowers.filter(f => !withered.has(f.key));
            const spots = assignFlowerSpots(alive);

            return {
                growing: records.filter(r => r.age < 8),
                gardenFlowers: alive.map(f => ({ file: f.file, spot: spots[f.key] })),
                gardenCount: alive.length
            };
        }

        // =========================================
        // 🥀 凋謝系統：每 24 小時強制隨機凋謝 2 朵花 (花園至少保留 4 朵)
        // 只影響花園裡看得到的花；圖鑑、已解鎖的花、抽卡紀錄都不受影響
        // =========================================
        const DAY_MS = 24 * 60 * 60 * 1000;
        const FLOWER_TRANSPLANT_MS = 8 * 60 * 60 * 1000;
        const WITHER_PER_DAY = 2;
        const MIN_GARDEN_FLOWERS = 4; // 花園至少保留幾朵，不會凋謝光
        let pendingWitherCount = 0;   // 這次上線剛凋謝的朵數，畫完花園後跳小視窗通知

        function showWitherNotice() {
            if (pendingWitherCount <= 0) return;
            document.getElementById('wither-count').innerText = pendingWitherCount;
            document.getElementById('wither-modal').style.display = 'flex';
            pendingWitherCount = 0;
        }

        function applyWithering(gardenFlowers, nowMs) {
            const withered = JSON.parse(Store.get('withered_flowers') || '[]');
            let lastWitherAt = parseInt(Store.get('last_wither_at'));
            // 第一次使用凋謝系統：從現在開始計時，不會一升級就凋謝
            if (!lastWitherAt) {
                Store.set('last_wither_at', String(nowMs));
                return new Set(withered);
            }

            let witherCount = 0;
            // 每滿 24 小時凋謝一次；好幾天沒開 App 就一次補算，每次只從「當時已經種進花園」的花裡挑
            while (nowMs - lastWitherAt >= DAY_MS) {
                lastWitherAt += DAY_MS;
                const candidates = gardenFlowers.filter(f => f.plantedAt <= lastWitherAt && !withered.includes(f.key));
                for (let i = 0; i < WITHER_PER_DAY && candidates.length > MIN_GARDEN_FLOWERS; i++) {
                    const idx = Math.floor(Math.random() * candidates.length);
                    withered.push(candidates[idx].key);
                    candidates.splice(idx, 1);
                    witherCount++;
                }
            }

            if (witherCount > 0 || lastWitherAt !== parseInt(Store.get('last_wither_at'))) {
                Store.set('withered_flowers', JSON.stringify(withered));
                Store.set('last_wither_at', String(lastWitherAt));
            }
            if (witherCount > 0) {
                // 凋謝只會在這裡算一次 (結果已存起來)，所以小視窗也只會跳這一次
                pendingWitherCount += witherCount;
            }
            return new Set(withered);
        }

        // 每朵花在花園裡有固定位置；凋謝的花讓出位置，新花優先補進最靠近中間的空位
        function assignFlowerSpots(aliveFlowers) {
            const spots = JSON.parse(Store.get('flower_spots') || '{}');
            const aliveKeys = new Set(aliveFlowers.map(f => f.key));
            Object.keys(spots).forEach(k => { if (!aliveKeys.has(k)) delete spots[k]; });

            const used = new Set(Object.values(spots));
            let next = 0;
            aliveFlowers.forEach(f => {
                if (spots[f.key] != null) return;
                while (used.has(next)) next++;
                spots[f.key] = next;
                used.add(next);
            });
            Store.set('flower_spots', JSON.stringify(spots));
            return spots;
        }

        function growthStageEmoji(age) {
            if (age >= 4) return '🌿';
            if (age >= 2) return '🌱';
            return '🌰';
        }

