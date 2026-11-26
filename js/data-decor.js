        // 🪑 島嶼裝飾品：每記錄滿一週（累計 7 天有紀錄，不用連續）就多一個
        // 每座島 5 個，共 25 個；解鎖順序由 DECOR_ORDER 決定（各島輪流，每座島都很快有新東西）
        //
        // 欄位：
        //   island  放在哪座島（js/island/config.js 的 id）
        //   model   3D 模型（models/ 裡的檔名，不含 .glb）
        //   height  放到島上的高度
        //   at      島上的位置 {x, z}；copies 可以一次擺好幾個（例如一排柵欄）
        //   glow    晚上會亮：{ y: 光點高度, size, color }
        //   r       佔地半徑（花和小狗會避開）
        const DECOR_INFO = [
            // 🌺 主花島
            { id: 'main-bench', island: 'main', name: '花園長椅', emoji: '🪑', model: 'wooden-bench-02', height: 0.42, at: { x: 2.3, z: 2.6 }, rot: -0.7, r: 0.6,
              desc: '坐在花叢旁邊的木頭長椅，最適合休息一下，看看這陣子開了哪些花。' },
            { id: 'main-lamp', island: 'main', name: '花園路燈', emoji: '🏮', model: 'vintage-street-light', height: 1.6, at: { x: 3.2, z: 0.9 }, r: 0.35,
              glow: { y: 1.5, size: 1.1, color: '#ffd27a' },
              desc: '黑色鐵柱配黃色玻璃燈罩的復古路燈，天黑之後會亮起溫暖的黃光，照亮花園小路。' },
            { id: 'main-mailbox', island: 'main', name: '花園信箱', emoji: '📫', model: 'mailbox', height: 0.7, at: { x: -0.9, z: 3.4 }, rot: 0.3, r: 0.35,
              desc: '立在彎彎木柱上的灰藍色小信箱，像是在等家人寄來的明信片。每一天的紀錄，都像寫給自己的一封信。' },
            { id: 'main-fence', island: 'main', name: '花園石柱', emoji: '🏛️', model: 'fence-04', height: 0.6, at: { x: -3.55, z: 0.9 },
              copies: [[0, -0.35], [0.3, 0.55]], r: 0.7,
              desc: '兩根灰色石頭砌成的方柱，立在花園邊上，像是花園的小門口。' },
            { id: 'main-fountain', island: 'main', name: '花園噴泉', emoji: '⛲', model: 'fountain', height: 0.8, at: { x: 0.6, z: -2.45 }, r: 0.75,
              desc: '石頭圍成的圓形噴泉，中間的水柱嘩啦啦地流。花園裡放噴泉，花草和來玩的小鳥都有水喝。' },

            // 🏡 寵物秘境
            { id: 'pet-stump', island: 'pet', name: '休息樹樁', emoji: '🪵', model: 'tree-trunk', height: 0.32, at: { x: -0.9, z: 1.25 }, r: 0.4,
              desc: '狗狗散步累了，最喜歡在這個樹樁旁邊停一下、聞一聞。' },
            { id: 'pet-gift', island: 'pet', name: '寵物禮物盒', emoji: '🎁', model: 'pixel-gift', height: 0.4, at: { x: 2.0, z: -0.95 }, rot: 0.4, r: 0.35,
              desc: '綠色的禮物盒綁著橘色的蝴蝶結，裡面裝的是小狗最愛的零食和玩具。' },
            { id: 'pet-lantern', island: 'pet', name: '狗屋提燈', emoji: '🕯️', model: 'lantern-01', height: 0.34, at: { x: -1.0, z: -0.6 }, r: 0.3,
              glow: { y: 0.18, size: 0.6, color: '#ffc35a' },
              desc: '黑色鐵框的小提燈，裡面點著一根蠟燭。放在狗屋旁邊，晚上小狗趴在門口睡覺就不怕黑了。' },
            { id: 'pet-fence', island: 'pet', name: '小木柴堆', emoji: '🪵', model: 'small-wood-pile', height: 0.35, at: { x: 2.75, z: 1.9 }, rot: 0.8, r: 0.6,
              desc: '一根根木頭整齊地堆在一起，狗狗最喜歡在旁邊聞來聞去，找找看有沒有藏起來的骨頭。' },
            { id: 'pet-bloomrock', island: 'pet', name: '開花石塊', emoji: '🌼', model: 'plant-ruin-01', height: 0.45, at: { x: -1.6, z: 2.9 }, rot: 1.2, r: 0.6,
              desc: '幾塊土黃色的大石頭，縫隙裡開出藍色、粉紅色和黃色的小花，鳥兒很喜歡停在上面曬太陽。' },

            // 💧 魚兒池塘
            { id: 'pond-bench', island: 'pond', name: '池畔長椅', emoji: '🪑', model: 'wooden-bench-02', height: 0.42, at: { x: 1.9, z: -1.75 }, rot: -0.6, r: 0.6,
              desc: '面向池塘的長椅，坐著坐著，就會看到魚兒跳出水面。' },
            { id: 'pond-boat', island: 'pond', name: '木頭小船', emoji: '🛶', model: 'rowboat', height: 0.32, at: { x: 2.45, z: 1.35 }, rot: 2.2, r: 0.65,
              desc: '停在岸邊的小木船，天氣好的時候可以划到池塘中間看荷花。' },
            { id: 'pond-lantern', island: 'pond', name: '池畔提燈', emoji: '🕯️', model: 'lantern-01', height: 0.34, at: { x: 2.55, z: -0.9 }, r: 0.3,
              glow: { y: 0.18, size: 0.6, color: '#ffc35a' },
              desc: '鐵框裡點著蠟燭的小提燈，晚上的燭光映在水面上，一閃一閃的很漂亮。' },
            { id: 'pond-lamp', island: 'pond', name: '池塘路燈', emoji: '💡', model: 'vintage-street-light', height: 1.5, at: { x: -2.6, z: 0.3 }, r: 0.35,
              glow: { y: 1.4, size: 1.0, color: '#ffd27a' },
              desc: '照亮池塘步道的路燈，晚上來散步也看得清楚。' },
            { id: 'pond-bloomrock', island: 'pond', name: '池邊開花石', emoji: '🌸', model: 'plant-ruin-02', height: 0.45, at: { x: 1.0, z: 2.9 }, rot: 0.6, r: 0.7,
              desc: '一堆土黃色的大石塊，縫隙裡開滿小花，蜻蜓最喜歡停在這裡休息。' },

            // 🌷 粉紅花海島
            { id: 'rainbow-bramble', island: 'rainbow-1', name: '野花灌木', emoji: '🌿', model: 'bramble', height: 0.6, at: { x: -2.4, z: -1.4 }, rot: 0.5, r: 0.8,
              desc: '一叢茂密的灌木，蝴蝶和蜜蜂常在這裡躲太陽。' },
            { id: 'rainbow-bench', island: 'rainbow-1', name: '花海長椅', emoji: '🪑', model: 'wooden-bench-02', height: 0.42, at: { x: 0.2, z: 2.6 }, rot: 3.1, r: 0.6,
              desc: '被花海包圍的長椅，坐下來四周都是花香。' },
            { id: 'rainbow-windmill', island: 'rainbow-1', name: '花田風車', emoji: '🌬️', model: 'pixel-windmill', height: 2.2, at: { x: -0.6, z: -2.4 }, rot: 0.4, r: 1.0, animated: true, animSpeed: 0.5,
              desc: '慢慢轉動的小風車。荷蘭的花田旁邊常有風車，以前是用來抽水、磨麵粉的。' },
            { id: 'rainbow-sprite', island: 'rainbow-1', name: '樹樁小精靈', emoji: '🌱', model: 'creature-pixel-01', height: 0.35, at: { x: 1.5, z: 0.5 }, rot: -0.8, r: 0.3,
              desc: '長得像小樹樁的花田小精靈，身上冒出兩片綠葉子。聽說每多記錄一天，牠就會多照顧一朵花。' },
            { id: 'rainbow-lamp', island: 'rainbow-1', name: '花海路燈', emoji: '💡', model: 'vintage-street-light', height: 1.5, at: { x: 2.9, z: -0.3 }, r: 0.35,
              glow: { y: 1.4, size: 1.0, color: '#ffd27a' },
              desc: '夜晚的花海也有路燈陪著，花朵在燈光下特別溫柔。' },

            // 📖 圖鑑博物館
            { id: 'museum-bench', island: 'museum', name: '博物館長椅', emoji: '🪑', model: 'wooden-bench-02', height: 0.42, at: { x: 1.8, z: 1.3 }, rot: -0.5, r: 0.6,
              desc: '看完圖鑑，坐下來回想這一路收集到的花和小動物。' },
            { id: 'museum-lamp', island: 'museum', name: '博物館路燈', emoji: '💡', model: 'vintage-street-light', height: 1.5, at: { x: -1.9, z: 1.0 }, r: 0.35,
              glow: { y: 1.4, size: 1.0, color: '#ffd27a' },
              desc: '博物館門口的路燈，晚上也歡迎大家來參觀。' },
            { id: 'museum-bloomrock', island: 'museum', name: '紀念開花石', emoji: '🌺', model: 'plant-ruin-02', height: 0.45, at: { x: -2.2, z: -1.6 }, rot: 2.0, r: 0.7,
              desc: '紀念每一個認真記錄的日子，石塊縫裡開滿了小花。' },
            { id: 'museum-gift', island: 'museum', name: '收藏禮物盒', emoji: '🎁', model: 'pixel-gift', height: 0.4, at: { x: 2.25, z: -1.2 }, rot: -0.3, r: 0.35,
              desc: '綠色盒子、橘色蝴蝶結的禮物盒，是博物館的收藏品，裡面放著第一朵花的回憶。' },
            { id: 'museum-fountain', island: 'museum', name: '博物館噴泉', emoji: '⛲', model: 'fountain', height: 0.75, at: { x: 0.1, z: 1.85 }, r: 0.75,
              desc: '博物館前的小噴泉，聽說對著它許願，下一種新花就會快點出現。' }
        ];

        // 解鎖順序：第 1 週主花島、第 2 週寵物島、第 3 週池塘島……各島輪流
        const DECOR_ORDER = (() => {
            const islands = ['main', 'pet', 'pond', 'rainbow-1', 'museum'];
            const byIsland = islands.map(id => DECOR_INFO.filter(d => d.island === id));
            const order = [];
            for (let round = 0; round < 5; round++) byIsland.forEach(list => { if (list[round]) order.push(list[round].id); });
            return order;
        })();
        const DECOR_DAYS_PER_ITEM = 7;   // 每累計 7 天有紀錄，多 1 個裝飾品
