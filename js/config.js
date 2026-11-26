        // API 連結
        const N8N_GET_URL = 'https://orthodox-oarfish.pikapod.net/webhook/get-health-records';
        const N8N_POST_URL = 'https://orthodox-oarfish.pikapod.net/webhook/health-record';
        // 💾 遊戲進度 (花、寵物解鎖、佈告欄等) 同步到後端；後端還沒設定好時遊戲照常運作
        const N8N_PROGRESS_GET_URL = 'https://orthodox-oarfish.pikapod.net/webhook/get-game-progress';
        const N8N_PROGRESS_SAVE_URL = 'https://orthodox-oarfish.pikapod.net/webhook/save-game-progress';

        let currentRecordType = ''; let currentInputCategory = ''; let selectedTimePeriod = ''; let editingRecordId = null;
        let currentDate = new Date(); let recordsDB = {};
        let targetRecordDate = getFormattedDate(new Date());

        let activeGrowingPlants = []; // 生長區的植物 ({ age, flower })
        let currentViewingIndex = 0;
        let lastLoadTime = 0;

        const startYear = 2026;

        // 🌟 將預覽開關移到全域變數，這樣所有函數都讀得到！🌟
        // 只要把這行改成 const isPreviewDog = false;
        const isPreviewDog = false; // true: 預覽模式，會直接顯示小狗與狗屋，方便測試；false: 正式模式，需達成條件才會出現


