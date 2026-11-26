        // 🐟 池塘島的 5 種魚（群島與之後的成就圖鑑共用）
        // 解鎖條件：「喝水達標」的天數累計（一天的喝水紀錄加起來 ≥ 1500 ml，跟主程式吸引蝴蝶的標準一樣）
        //   不用連續，忘了喝也不會扣；解鎖過的魚會一直住在池塘裡（存在 unlocked_fish，會同步到後端）
        //   要調整門檻，改 waterDays 的數字即可（unlock 函式也一起改）
        //   unlock(p) 的 p 裡有：waterDays、counts (每天筆數)、streak (連續天數)、totalDays (有紀錄的天數)
        // look：池塘裡跳起來時的樣子（顏色、斑點、尾巴大小），給 js/island/critters.js 的 makeFish 用
        const FISH_INFO = [
            {
                id: 'kohaku', name: '紅白錦鯉', emoji: '🐟',
                waterDays: 3, unlock: (p) => p.waterDays >= 3, unlockText: '喝水達標（1500 ml）累計 3 天',
                desc: '雪白的身體上有一塊塊鮮紅色的花紋，是最經典的錦鯉品種，和「大正三色」、「昭和三色」合稱錦鯉的「御三家」。錦鯉是日本新潟一帶的農民，從一般的鯉魚裡挑出顏色特別的，一代一代培育出來的。',
                tip: '錦鯉沒有胃！吃下去的食物直接進到腸子，所以一次不能吃太多，少量多餐最健康。',
                look: { body: 0xf5f3ee, belly: 0xffffff, fin: 0xf5f3ee, spots: [
                    { color: 0xd93a2b, at: [0, 0.045, 0.06], size: 0.045 },
                    { color: 0xd93a2b, at: [0, 0.04, -0.06], size: 0.04 }] }
            },
            {
                id: 'ogon', name: '黃金錦鯉', emoji: '🐟',
                waterDays: 10, unlock: (p) => p.waterDays >= 10, unlockText: '喝水達標（1500 ml）累計 10 天',
                desc: '全身金黃色、鱗片閃閃發亮的錦鯉，日文叫「黃金」（Ogon），是第二次世界大戰後在日本培育成功的品種。在池塘裡游的時候，遠遠就看得到一道金光。',
                tip: '錦鯉的金屬光澤來自鱗片裡會反光的細小結晶，跟珍珠的光澤原理很像。',
                look: { body: 0xf2b632, belly: 0xffd966, fin: 0xf7c95a }
            },
            {
                id: 'ryukin', name: '琉金金魚', emoji: '🐠',
                waterDays: 20, unlock: (p) => p.waterDays >= 20, unlockText: '喝水達標（1500 ml）累計 20 天',
                desc: '身體圓滾滾、尾巴又長又飄逸的金魚。金魚的祖先是鯽魚，中國從一千多年前開始飼養，後來傳到日本；琉金據說是經過琉球傳進日本，所以叫「琉金」。',
                tip: '金魚的顏色會隨著環境改變，曬得到太陽的金魚，通常顏色會比較鮮豔。',
                look: { body: 0xf0702a, belly: 0xffb27a, fin: 0xf58a4a, tailScale: 1.9, roundness: 1.35 }
            },
            {
                id: 'paradise', name: '台灣鬥魚', emoji: '🐟',
                waterDays: 40, unlock: (p) => p.waterDays >= 40, unlockText: '喝水達標（1500 ml）累計 40 天',
                desc: '台灣原生的小型魚，學名叫「蓋斑鬥魚」，身上有藍綠色和紅色相間的條紋，尾鰭長長的很漂亮。以前在稻田、水溝裡很常見，現在野外已經不容易看到了。',
                tip: '台灣鬥魚有一個叫「迷鰓」的特殊器官，可以直接浮到水面吸空氣；爸爸還會吐泡泡做成「泡巢」，守護裡面的魚卵。',
                look: { body: 0x3f7fa8, belly: 0xd8623a, fin: 0xc94a3a, tailScale: 1.4, spots: [
                    { color: 0xd8623a, at: [0, 0.01, 0.02], size: 0.03 },
                    { color: 0xd8623a, at: [0, 0.01, -0.06], size: 0.03 }] }
            },
            {
                id: 'medaka', name: '青鱂魚', emoji: '🐟',
                waterDays: 60, unlock: (p) => p.waterDays >= 60, unlockText: '喝水達標（1500 ml）累計 60 天',
                desc: '身長只有 3 公分左右的小魚，眼睛大大的，身體帶一點透明的淡黃色，喜歡在水面附近成群游動。台灣的稻田、池塘裡也有原生的青鱂魚。',
                tip: '1994 年，牠的近親「日本青鱂」搭上美國的太空梭，成為第一種在太空中交配、產卵的脊椎動物，生出來的小魚都很健康！',
                look: { body: 0xd9d2a0, belly: 0xf2efd8, fin: 0xcfc58a, roundness: 0.85 }
            }
        ];
