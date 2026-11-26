        async function sendErrorLog(errorMsg) {
            const now = new Date();
            const payload = { date: getFormattedDate(now), time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), period: '', type: '系統報錯', content: errorMsg, category: 'error' };
            if (!getGardenKey()) return; // 還沒輸入通行碼就送不出去
            try {
                await fetch(N8N_POST_URL, {
                    method: 'POST',
                    headers: gardenHeaders(true),
                    body: JSON.stringify(payload)
                });
            } catch(e) {}
        }

        // =========================================
        // 🔑 花園通行碼：第一次打開時輸入一次，之後存在這支手機裡自動帶上
        // 程式碼裡不寫暗號，GitHub 上看不到；對不對由 n8n 判斷
        // =========================================
        const GARDEN_KEY_STORE = 'garden_key';
        function getGardenKey() {
            try { return Store.get(GARDEN_KEY_STORE) || ''; } catch (e) { return ''; }
        }
        function gardenHeaders(json) {
            const h = { 'X-Garden-Auth': getGardenKey() };
            if (json) h['Content-Type'] = 'application/json';
            return h;
        }
        function isKeyRejected(response) { return response.status === 401 || response.status === 403; }

        function showKeyModal(msg) {
            document.getElementById('key-modal-msg').innerText = msg || '';
            document.getElementById('key-submit-btn').innerText = '進入花園';
            document.getElementById('key-modal').style.display = 'flex';
        }
        // 通行碼被拒絕 (例如 n8n 換了新暗號)：清掉舊的，請重新輸入
        function handleKeyRejected() {
            try { Store.remove(GARDEN_KEY_STORE); } catch (e) {}
            showKeyModal('花園通行碼已經更換，請重新輸入');
        }

        async function submitGardenKey() {
            const input = document.getElementById('key-input');
            const btn = document.getElementById('key-submit-btn');
            const key = input.value.trim();
            if (!key) return showKeyModal('請先輸入通行碼');
            btn.innerText = '確認中...';
            try {
                // 先用這組通行碼試讀一次，n8n 說對了才存起來
                const response = await fetch(N8N_GET_URL + '?t=' + Date.now(), { headers: { 'X-Garden-Auth': key } });
                if (isKeyRejected(response)) return showKeyModal('通行碼不對，請再確認一次');
                if (!response.ok) throw new Error('網路回應異常');
                Store.set(GARDEN_KEY_STORE, key);
                input.value = '';
                closeModal('key-modal');
                loadData();
                checkRealtimeWeather();
            } catch (e) {
                showKeyModal('網路好像不太穩，請稍後再試一次');
            }
        }

        async function loadData() {
            lastLoadTime = Date.now();
            if (!getGardenKey()) return showKeyModal();
            await Store.sync(); // 💾 先和後端對一次進度 (最多等 5 秒；後端不通就用這支手機的)
            try {
                // 🌟 GET 請求帶上這支手機存的通行碼 🌟
                const response = await fetch(N8N_GET_URL + "?t=" + new Date().getTime(), {
                    headers: gardenHeaders(false)
                });
                if (isKeyRejected(response)) return handleKeyRejected();
                if (!response.ok) throw new Error("網路回應異常");
                const data = await response.json();
                recordsDB = {};
                // 🌟 濾掉系統報錯，避免錯誤被當成健康紀錄 (灌水連續天數、長出種子) 🌟
                data.filter(item => item.category !== 'error').forEach(item => {
                    const cleanDate = item.date.substring(0, 10);
                    if(!recordsDB[cleanDate]) recordsDB[cleanDate] = [];
                    recordsDB[cleanDate].push(item);
                });

                // =========================================
                // 🌟 新增：前端自動計算「連續打卡天數」 🌟
                // =========================================
                let streak = 0;
                let checkDate = new Date();
                let checkStr = getFormattedDate(checkDate);

                // 寬容機制：如果今天還沒紀錄，那從「昨天」開始檢查，避免一過半夜 12 點連續天數就歸零
                if (!recordsDB[checkStr]) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    checkStr = getFormattedDate(checkDate);
                }

                // 只要日期在資料庫裡有找到，天數就 +1，然後日期往前推一天繼續檢查
                while (recordsDB[checkStr]) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                    checkStr = getFormattedDate(checkDate);
                }
                window.consecutiveDays = streak; // 將算好的天數存為全域變數
                console.log("🎉 目前連續打卡天數:", window.consecutiveDays);

                // =========================================
                // 🌟 新增：解鎖通知與 localStorage 記憶邏輯 🌟
                // =========================================
                // 檢查是否達標 7 天，並且「還沒跳過通知」
                const hasNotified = Store.get('dog_unlocked_notified');

                // 💡 測試小撇步：統一改成 >=
                if (window.consecutiveDays >= 7 && !hasNotified) {
                    const todayDateStr = getFormattedDate(new Date());
                    // 記錄到本地，保證下次不會再跳
                    Store.set('dog_unlocked_notified', 'true');
                    Store.set('dog_unlock_date', todayDateStr);
                    addNotice('pet', 'dog_down.png');

                    // 延遲 1.5 秒再跳出，讓媽媽先進來看到漂亮的花園再給驚喜
                    setTimeout(() => {
                        document.getElementById('unlock-modal').style.display = 'flex';
                    }, 1500);
                }

                // 🌟 德國牧羊犬 30 天解鎖條件 (已移出 7 天的判斷，修正永遠不會跳通知的問題) 🌟
                const hasGsNotified = Store.get('gs_unlocked_notified');
                if (window.consecutiveDays >= 30 && !hasGsNotified) {
                    const todayDateStr = getFormattedDate(new Date());
                    Store.set('gs_unlocked_notified', 'true');
                    Store.set('gs_unlock_date', todayDateStr);
                    addNotice('pet', 'german_shepherd_bottom_left.png');
                    setTimeout(() => {
                        document.getElementById('unlock-gs-modal').style.display = 'flex';
                    }, 1500);
                }

                // 🐦 青鳥小屋 60 天解鎖
                if (window.consecutiveDays >= 60 && !Store.get('bird_unlocked_notified')) {
                    Store.set('bird_unlocked_notified', 'true');
                    Store.set('bird_unlock_date', getFormattedDate(new Date()));
                    addNotice('pet', 'birdhouse.png');
                    setTimeout(() => {
                        document.getElementById('unlock-bird-modal').style.display = 'flex';
                    }, 1500);
                }

                // 🐤 綠繡眼：只要有一天，所有紀錄項目都有記到就解鎖
                if (hasFullRecordDay() && !Store.get('greenbird_unlocked_notified')) {
                    Store.set('greenbird_unlocked_notified', 'true');
                    addNotice('pet', 'green_birdhouse.png');
                    setTimeout(() => {
                        document.getElementById('unlock-greenbird-modal').style.display = 'flex';
                    }, 1500);
                }

                updateGardenLandscape25D();
                updatePlantLogic();
                renderCalendar();

                // 🌟 更新佈告欄顯示狀態 (放在花園之後，開花時抽到的新花才會立刻上佈告欄)
                updateNoticeBoard();
                // 🥀 剛好觸發凋謝的這次上線，跳一次小視窗
                showWitherNotice();
                // 🐝 今天或昨天走路達標、還沒看過通知的，補跳蜜蜂通知
                checkBeeNotice();
                // 💡 第一次：告訴媽媽可以點太陽切換花園排列 (只提醒一次)
                if (!Store.get('layout_hint_shown') && !window.layoutHintTimer) {
                    window.layoutHintTimer = setTimeout(() => {
                        if (document.getElementById('rain-toast').classList.contains('show')) { window.layoutHintTimer = null; return; } // 下雨提醒中，下次再說
                        Store.set('layout_hint_shown', '1');
                        showTopToast('💡 連點兩下天上的太陽（晚上是月亮），可以切換花園的排列方式喔！', 8000);
                    }, 6000);
                }
            } catch (error) { sendErrorLog(`讀取失敗: ${error.message}`); }
        }

