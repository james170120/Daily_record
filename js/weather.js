        // =========================================
        // 🌧️ 仁武區即時天氣 (透過 n8n 問氣象署雨量站：最近 10 分鐘有雨量就算在下雨)
        // 打開花園時查一次，之後回到花園時最多每 30 分鐘再查一次
        // 測試用：網址後面加 ?rain=1 強制下雨、?rain=0 強制晴天
        // =========================================
        const WEATHER_URL = 'https://orthodox-oarfish.pikapod.net/webhook/ffaf46df-c23c-4613-8c5b-5095c84da6ea';
        let lastWeatherCheck = 0;

        async function checkRealtimeWeather() {
            lastWeatherCheck = Date.now();
            const force = new URLSearchParams(location.search).get('rain');
            if (force === '1' || force === '0') return setRain(force === '1', true); // 測試模式：每次都跳提醒
            if (!getGardenKey()) return;
            try {
                const response = await fetch(WEATHER_URL + '?t=' + Date.now(), { headers: gardenHeaders(false) });
                if (!response.ok) throw new Error('天氣回應異常 ' + response.status);
                const data = await response.json();
                setRain(data.isRaining === true);
                console.log(data.isRaining ? '🌧️ 仁武區正在下雨：' : '☀️ 仁武區沒有下雨：', data.weather_desc);
            } catch (error) {
                console.warn('無法取得天氣資料，維持原本的天氣', error);
            }
        }

        // 下雨：天空變灰、太陽變淡、畫面下起雨；停雨就把雨滴收掉
        // 剛發現下雨時，一個禮拜最多跳一次上方提醒 (10 秒)，提醒消失後動物們才跑回屋子
        const RAIN_TOAST_KEY = 'rain_toast_last';
        const RAIN_TOAST_GAP = 7 * 24 * 60 * 60 * 1000; // 一個禮拜
        function setRain(isRaining, forced) {
            const wasRaining = document.body.classList.contains('raining');
            document.body.classList.toggle('raining', isRaining);
            let layer = document.getElementById('weather-layer');
            if (!isRaining) {
                if (layer) layer.remove();
                clearTimeout(window.rainShelterTimer);
                hideRainToast();
                setRainShelter(false); // 雨停了，動物們出來
                return;
            }
            if (!wasRaining) {
                let last = 0;
                try { last = parseInt(Store.get(RAIN_TOAST_KEY) || '0', 10); } catch (e) {}
                if (forced || Date.now() - last > RAIN_TOAST_GAP) {
                    // 先跳提醒，動物們還在外面；10 秒後提醒收起來，動物們才跑回家
                    if (!forced) { try { Store.set(RAIN_TOAST_KEY, String(Date.now())); } catch (e) {} }
                    showRainToast();
                    clearTimeout(window.rainShelterTimer);
                    window.rainShelterTimer = setTimeout(() => { hideRainToast(); setRainShelter(true); }, 10000);
                } else {
                    setRainShelter(true); // 這禮拜提醒過了：動物們直接躲雨
                }
            }
            if (layer) return; // 已經在下了
            layer = document.createElement('div');
            layer.id = 'weather-layer';
            for (let i = 0; i < 120; i++) {
                const drop = document.createElement('div');
                drop.className = 'raindrop';
                drop.style.left = (-20 + Math.random() * 170) + '%'; // 雨是斜的，起點要拉寬才不會右邊沒雨
                drop.style.top = (Math.random() * -50) + 'px';
                drop.style.animationDuration = (1.5 + Math.random() * 2.0) + 's';
                drop.style.animationDelay = (Math.random() * 2) + 's';
                layer.appendChild(drop);
            }
            document.getElementById('garden-world').appendChild(layer);
        }

        // 動物們躲雨 (跟「有沒有在下雨」分開，才能等提醒結束再跑回家)
        function setRainShelter(on) {
            document.body.classList.toggle('rain-shelter', on);
            applyBirdShelter(); // 停在小屋上的鳥馬上躲進去 / 出來；小狗下一步就會走回家
        }

        // 🌧️ 上方往下滑的下雨提醒 (點一下也可以提早收起來)
        function showRainToast() {
            const t = document.getElementById('rain-toast');
            t.classList.add('show');
        }
        function hideRainToast() {
            document.getElementById('rain-toast').classList.remove('show');
        }
        function dismissRainToast() {
            if (!document.getElementById('rain-toast').classList.contains('show')) return;
            clearTimeout(window.rainShelterTimer);
            hideRainToast();
            if (document.body.classList.contains('raining')) setRainShelter(true);
        }

