        // 🌟 40 種花的中英文對照表 (全站共用，新增花朵只要改這裡) 🌟
        const FLOWER_DIC = {
            'flower_camellia.png': '山茶花', 'flower_carnation.png': '康乃馨', 'flower_cherryblossom.png': '櫻花',
            'flower_chrysanthemum.png': '菊花', 'flower_daffodil.png': '水仙', 'flower_daisy.png': '雛菊',
            'flower_dandelion.png': '蒲公英', 'flower_hibiscus.png': '扶桑花', 'flower_hydrangea.png': '繡球花',
            'flower_iris.png': '鳶尾花', 'flower_jasmine.png': '茉莉花', 'flower_lavender.png': '薰衣草',
            'flower_lily.png': '百合', 'flower_lotus.png': '蓮花', 'flower_magnolia.png': '木蘭花',
            'flower_marigold.png': '萬壽菊', 'flower_morningglory.png': '牽牛花', 'flower_orchid.png': '蘭花',
            'flower_peony.png': '牡丹', 'flower_poppy.png': '罌粟花', 'flower_rose.png': '玫瑰',
            'flower_sunflower.png': '向日葵', 'flower_tulip.png': '鬱金香', 'flower_violet.png': '香堇菜',
            'flower_begonia.png': '秋海棠', 'flower_bellflower.png': '桔梗', 'flower_bluebell.png': '藍鈴花',
            'flower_cosmos.png': '波斯菊', 'flower_pansy.png': '三色堇', 'flower_plumeria.png': '雞蛋花',
            'flower_snapdragon.png': '金魚草', 'flower_zinnia.png': '百日菊',
            // 🌟 第 7 批新增 (4 種)
            'flower_dahlia.png': '大麗花', 'flower_hyacinth.png': '風信子', 
            'flower_crocus.png': '番紅花', 'flower_geranium.png': '天竺葵',
            // 🌟 第 8 批新增 (4 種)
            'flower_freesia.png': '小蒼蘭', 'flower_snowdrop.png': '雪花蓮', 
            'flower_amaryllis.png': '孤挺花', 'flower_primrose.png': '報春花'
        };
        const ALL_FLOWERS = Object.keys(FLOWER_DIC);

        // 🌈 每種花花瓣的主要顏色 (色相 0~360，從圖片算出來的；null = 白色花)，彩虹排列用
        // 之後新增花朵時，記得在這裡補上它的顏色，沒補的會排在彩虹最後面
        const FLOWER_HUE = {
            amaryllis: 1, begonia: 353, bellflower: 265, bluebell: 245, camellia: 355, carnation: 354, cherryblossom: 336,
            chrysanthemum: 39, cosmos: 330, crocus: 272, daffodil: 46, dahlia: 344, daisy: null, dandelion: 44, freesia: 39,
            geranium: 348, hibiscus: 351, hyacinth: 253, hydrangea: 227, iris: 252, jasmine: null, lavender: 271, lily: null,
            lotus: 328, magnolia: 340, marigold: 28, morningglory: 248, orchid: 322, pansy: 317, peony: 320, plumeria: 37,
            poppy: 358, primrose: 321, rose: 357, snapdragon: 344, snowdrop: null, sunflower: 44, tulip: 354, violet: 253, zinnia: 8
        };
        // 彩虹順序：紅 → 橘 → 黃 → 白 → 粉 → 紫 → 藍
        function rainbowKey(file) {
            const name = file.replace('flower_', '').replace('.png', '');
            if (!(name in FLOWER_HUE)) return 999;
            const h = FLOWER_HUE[name];
            if (h === null) return 75;          // 白色花排在黃色和粉色中間
            if (h >= 345) return h - 360;       // 偏紫的紅 → 排在最前面
            if (h <= 70) return h;              // 紅、橘、黃
            return 80 + (345 - h);              // 粉 → 紫 → 藍
        }
        // 花園排列：'rainbow' 彩虹 (預設) / 'random' 自然隨機；點太陽或月亮切換
        function getGardenLayout() {
            try { return Store.get('garden_layout') || 'rainbow'; } catch (e) { return 'rainbow'; }
        }

        // 🌸 圖鑑點花朵時顯示的介紹 (lang = 花語、desc = 介紹、tip = 小知識)
        // 還沒寫介紹的花，小視窗會顯示「介紹準備中」，之後一朵一朵補上即可
        const FLOWER_INFO = {
            'flower_carnation.png': {
                lang: '母愛、感恩、健康長壽',
                desc: '康乃馨原產於地中海沿岸，已經有兩千多年的栽培歷史。粉紅色的康乃馨是母親節最具代表性的花，代表對媽媽滿滿的感謝與愛。',
                tip: '康乃馨插在花瓶裡可以維持大約兩個星期，是很耐放的花，就像媽媽的愛一樣長長久久 💗'
            },
            'flower_camellia.png': {
                lang: '理想的愛、謙讓',
                desc: '山茶花原產於中國和日本，在冬末春初開花。天氣越冷，它的花反而開得越鮮豔，是寒冬裡很亮眼的花。',
                tip: '我們喝的茶，是用茶樹的葉子做的，而茶樹跟山茶花是同一家族的親戚喔！'
            },
            'flower_cherryblossom.png': {
                lang: '生命、幸福',
                desc: '櫻花在春天盛開，整棵樹開滿粉白色的花，但花期只有一到兩個星期。台灣的阿里山、武陵農場都是有名的賞櫻地點。',
                tip: '櫻花的花瓣尖端有一個小缺口，可以用這個特徵分辨櫻花和梅花、桃花。'
            },
            'flower_chrysanthemum.png': {
                lang: '高潔、長壽',
                desc: '菊花在秋天開花，在中國已經栽培了三千多年，和梅、蘭、竹並稱為「四君子」，代表不怕風霜的好品格。',
                tip: '常喝的菊花茶，是用特別的食用菊花曬乾泡的，喝起來有淡淡的清香。'
            },
            'flower_daffodil.png': {
                lang: '吉祥、自信',
                desc: '水仙在冬天到早春開花，香氣清雅。過年時很多家庭會擺一盆水仙，象徵新的一年好運到來。',
                tip: '水仙整株都有毒，尤其是球根，長得有點像洋蔥，千萬不能誤食喔！'
            },
            'flower_daisy.png': {
                lang: '天真、和平、希望',
                desc: '雛菊小巧可愛，看起來像一朵花，其實中間黃色的部分和外圈白色花瓣，是由很多很多朵小花組合起來的。',
                tip: '雛菊的英文 Daisy 來自「白天的眼睛」，因為它白天張開、晚上會合起來休息。'
            },
            'flower_dandelion.png': {
                lang: '自由、勇敢',
                desc: '蒲公英先開出黃色的小花，花謝後變成白色的絨毛球。風一吹，每顆種子都帶著小降落傘飛向遠方。',
                tip: '蒲公英的嫩葉可以吃，在歐洲常拿來做沙拉。'
            },
            'flower_hibiscus.png': {
                lang: '熱情、新鮮的愛',
                desc: '扶桑花是熱帶的花，在台灣的路邊、圍籬很常見，一年四季都會開。它也是馬來西亞的國花。',
                tip: '扶桑的一朵花通常只開一天，但整株會不停冒出新的花苞，所以看起來一直都有花。'
            },
            'flower_hydrangea.png': {
                lang: '希望、團圓',
                desc: '繡球花在初夏開花，一大球是由許多小花聚在一起組成的，圓滾滾的很像古代的繡球，所以叫這個名字。',
                tip: '繡球花的顏色會隨著土壤改變：酸性土壤開藍色，鹼性土壤開粉紅色，像會變魔術一樣！'
            },
            'flower_iris.png': {
                lang: '好消息、信心',
                desc: '一般認為，鳶尾花的花瓣展開的樣子很像鳶鳥的尾巴，因此得名。它在春天開花，顏色有紫、藍、白、黃等。',
                tip: '名畫家梵谷畫過一幅《鳶尾花》，1987 年拍賣時，創下了當時全世界最貴畫作的紀錄！'
            },
            'flower_jasmine.png': {
                lang: '純潔、忠貞',
                desc: '茉莉花是白色的小花，夏天開花，香氣非常濃郁，尤其到了傍晚和晚上更香。',
                tip: '茉莉花茶是把茉莉花和茶葉放在一起，讓茶葉慢慢吸收花香做成的。'
            },
            'flower_lavender.png': {
                lang: '等待、寧靜',
                desc: '薰衣草原產於地中海沿岸，法國普羅旺斯整片紫色的薰衣草田非常有名。很多人覺得聞到它的香味，心情就會放鬆下來。',
                tip: '把曬乾的薰衣草裝進小布袋，放在衣櫃或枕頭旁，就能有淡淡的香氣。'
            },
            'flower_lily.png': {
                lang: '純潔、百年好合',
                desc: '百合花大又香，常用在婚禮上。它的球根由許多鱗片一層層抱合在一起，所以叫做「百合」。',
                tip: '我們吃的百合（煮甜湯或炒菜用的），就是食用百合的球根鱗片。'
            },
            'flower_lotus.png': {
                lang: '清廉、純潔',
                desc: '蓮花在夏天開花，雖然長在泥水裡，花卻乾乾淨淨，古人稱讚它「出淤泥而不染」。台南白河是有名的賞蓮地方。',
                tip: '蓮花全身都是寶：蓮藕、蓮子都可以吃，荷葉還能拿來包糯米飯。'
            },
            'flower_magnolia.png': {
                lang: '高貴、自然之美',
                desc: '木蘭花是地球上最古老的開花植物之一，在恐龍時代就已經存在了。許多品種在早春先開花，之後才長出葉子。',
                tip: '木蘭出現的時間比蜜蜂還早，所以最早幫它傳花粉的是甲蟲喔！'
            },
            'flower_marigold.png': {
                lang: '健康、長壽',
                desc: '萬壽菊開著橘黃色的大花球，花期很長、很好照顧，名字也很吉祥，代表健康長壽。',
                tip: '在墨西哥的亡靈節，人們會用大量橘色的萬壽菊布置，相信它鮮豔的顏色和香味，能為思念的家人指引回家的路。'
            },
            'flower_morningglory.png': {
                lang: '愛情永固、活力',
                desc: '牽牛花是會爬藤的植物，花朵像小喇叭。它在清晨開花，到了中午花就會合起來。',
                tip: '因為只在早上開，日本人叫它「朝顏」，意思是早晨的臉。'
            },
            'flower_orchid.png': {
                lang: '高雅、幸福飛來',
                desc: '圖上的是蝴蝶蘭，花朵像一隻隻展翅的蝴蝶。台灣被稱為「蝴蝶蘭王國」，種出的蘭花外銷到全世界。',
                tip: '蝴蝶蘭的花期很長，在家裡通常可以開一到三個月，照顧得好還能更久。'
            },
            'flower_peony.png': {
                lang: '富貴、圓滿',
                desc: '牡丹花朵又大又豐滿，被稱為「花中之王」，自古就是富貴吉祥的象徵。洛陽的牡丹自古就特別有名。',
                tip: '牡丹和芍藥長得很像：牡丹是木本，冬天枝幹還在；芍藥是草本，冬天地上部分會枯掉。'
            },
            'flower_poppy.png': {
                lang: '安慰、紀念',
                desc: '圖上紅色的花叫「虞美人」，是罌粟家族裡專門種來觀賞的花，花瓣薄得像紙，風一吹就輕輕搖曳。',
                tip: '在歐洲，人們會在胸前別一朵紅色的罌粟花，用來紀念戰爭中犧牲的人。'
            },
            'flower_rose.png': {
                lang: '愛情、美麗',
                desc: '玫瑰是全世界最受歡迎的花之一，不同顏色有不同意思：紅色代表熱愛、粉紅色代表感謝、黃色代表友誼。',
                tip: '玫瑰的刺是從莖的表皮長出來的，所以用手就能把刺輕輕掰下來。'
            },
            'flower_sunflower.png': {
                lang: '光明、忠誠',
                desc: '向日葵還年輕時，花苞會跟著太陽從東轉到西。長大開花後，大多就固定面向東方，迎接早晨的太陽。',
                tip: '向日葵的大花盤其實是由上千朵小花組成的，中間的小花之後會結成一顆顆葵花子。'
            },
            'flower_tulip.png': {
                lang: '博愛、體貼',
                desc: '鬱金香是春天的球根花，原產於中亞和土耳其一帶，後來在荷蘭大受歡迎，成為荷蘭的代表花。',
                tip: '四百年前的荷蘭曾經很瘋鬱金香，據說最稀有的品種，一顆球根的價格可以買下一棟運河旁的房子！'
            },
            'flower_violet.png': {
                lang: '誠實、謙虛',
                desc: '香堇菜是春天開的紫色小花，花朵小巧、香氣淡雅，常常一叢一叢長在草地上，歐洲人還會用它做香水。',
                tip: '它跟圖鑑裡的三色堇是同一個家族的親戚，仔細看花的形狀很像喔！'
            },
            'flower_begonia.png': {
                lang: '親切、溫和',
                desc: '秋海棠是台灣很常見的盆栽花，花色有紅、粉、白等，很好照顧，放在窗台或陽台就能開得很漂亮。',
                tip: '秋海棠的葉子左右兩邊大小不一樣，是它很特別的地方，下次可以仔細看看。'
            },
            'flower_bellflower.png': {
                lang: '永恆的愛、真誠',
                desc: '桔梗開著紫色或白色的星形花朵，還沒開的花苞圓鼓鼓的，像一顆顆小氣球。',
                tip: '桔梗的根可以吃，韓國有名的小菜「桔梗根」就是用它做的。'
            },
            'flower_bluebell.png': {
                lang: '感謝、謙遜',
                desc: '藍鈴花在春天開花，英國的森林裡常常整片開滿藍紫色的花，像鋪了一層藍色地毯。',
                tip: '藍鈴花的花朵都垂向同一邊，看起來就像一串掛著的小鈴鐺。'
            },
            'flower_cosmos.png': {
                lang: '純潔、少女的心',
                desc: '波斯菊花瓣輕柔，顏色有粉、白、紫紅，很好種。台灣冬天休耕的稻田，常種成一大片波斯菊花海。',
                tip: '雖然名字叫「波斯」，但它其實來自墨西哥喔！'
            },
            'flower_pansy.png': {
                lang: '思念、沉思',
                desc: '三色堇的花瓣有好幾種顏色，中間的花紋看起來很像一張小臉，在涼爽的冬春季節開花。',
                tip: '三色堇的英文 Pansy 來自法文「思念」，所以它也代表想念一個人。'
            },
            'flower_plumeria.png': {
                lang: '孕育希望、新生',
                desc: '雞蛋花白色的花瓣中間是黃色，看起來就像一顆煎蛋，所以叫雞蛋花。它香氣很濃，夏天開得最多。',
                tip: '在夏威夷，人們常用雞蛋花串成花環，送給來訪的客人表示歡迎。'
            },
            'flower_snapdragon.png': {
                lang: '豐盛、好運',
                desc: '金魚草的花一朵朵沿著花莖往上開，顏色很多，花的形狀像一隻隻小金魚。',
                tip: '輕輕捏一下金魚草花朵的兩側，它的「嘴巴」就會張開，好像在說話！'
            },
            'flower_zinnia.png': {
                lang: '思念遠方的朋友',
                desc: '百日菊的花期很長，從夏天一直開到秋天，可以開上一百天左右，所以叫做「百日菊」。',
                tip: '2016 年，太空人在國際太空站成功種出開花的百日菊，還拍照分享給地球上的大家看！'
            },
            'flower_dahlia.png': {
                lang: '華麗、優雅',
                desc: '大麗花原產於墨西哥，也是墨西哥的國花。它的花瓣層層疊疊，品種多到有好幾萬種。',
                tip: '大麗花的根是肥肥的塊根，冬天可以挖起來收好，隔年春天再種下去。'
            },
            'flower_hyacinth.png': {
                lang: '重生、喜悅',
                desc: '風信子是春天的球根花，一根花莖上密密麻麻開滿小花，香氣非常濃郁。',
                tip: '風信子可以水耕：把球根放在裝水的瓶口，就能看著白白的根一天天長出來。'
            },
            'flower_crocus.png': {
                lang: '青春的喜悅',
                desc: '番紅花是早春最早開的花之一，有時候雪還沒融化，它就從雪地裡冒出頭來了。',
                tip: '很貴的香料「番紅花」，是用秋天開花的品種的紅色柱頭（花蕊）做的，一公斤要用掉大約十五萬到二十萬朵花！'
            },
            'flower_geranium.png': {
                lang: '幸福就在身邊',
                desc: '天竺葵的花一球一球的，顏色鮮豔、花期很長。在歐洲，家家戶戶的窗台上常擺滿天竺葵。',
                tip: '有些天竺葵的葉子揉一揉，會散發出特別的香味。'
            },
            'flower_freesia.png': {
                lang: '純潔、天真',
                desc: '小蒼蘭原產於南非，香氣清甜，花朵沿著花莖往同一邊排成一排，很有特色。',
                tip: '因為香味很好聞，小蒼蘭常被用來做香水和香皂。'
            },
            'flower_snowdrop.png': {
                lang: '希望、安慰',
                desc: '雪花蓮在冬末開花，白色的小花垂著頭，像一滴雪花掛在枝頭上，告訴大家春天快來了。',
                tip: '科學家從雪花蓮的球根裡找到一種成分，後來被做成治療失智症（阿茲海默症）的藥物。'
            },
            'flower_amaryllis.png': {
                lang: '美麗、自信',
                desc: '孤挺花在春天開花，一根又粗又長的花莖從葉子中間獨自挺立，頂端開出好幾朵大喇叭花，一般認為這就是「孤挺花」名字的由來。',
                tip: '孤挺花的球根可以種很多年，每年春天都會再開花，很好照顧。'
            },
            'flower_primrose.png': {
                lang: '青春、希望',
                desc: '報春花在冬末早春開花，是春天最早開的花之一，好像在告訴大家「春天來了」，所以叫報春花。',
                tip: '它的英文名字 Primrose，一般認為來自拉丁文「最早的玫瑰」，不過它其實跟玫瑰一點親戚關係都沒有喔！'
            }
        };
        // 預設解鎖 4 種經典花朵：玫瑰、向日葵、鬱金香、雛菊
        const DEFAULT_UNLOCKED_FLOWERS = ['flower_rose.png', 'flower_sunflower.png', 'flower_tulip.png', 'flower_daisy.png'];

