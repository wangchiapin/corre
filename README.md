# 跑吧！漢字（Corre）

> 跑酷式的漢字學習遊戲，含句子庫管理頁

- **網址：** https://wangchiapin.github.io/corre/（管理頁：corre/manager/）
- **Firebase 專案：** corre-d16da（排行榜）；遊玩紀錄另寫到 memorma-24dab 的 `plays`、`visits`（遊戲代號 `corre`）；老師連結／班級資料在 subscription-48d3c
- **登入方式：** Google 登入（管理頁）
- **狀態：** 使用中
- **備註：** 句子庫管理工具就在本 repo 的 `manager/`（原獨立 repo `corre-sentence-manager` 已併入）。

## 三款遊戲共用的基本設定（⚙️）— 色數、比比看照這個做

跑吧、色數消消樂、比比看都在 `wangchiapin.github.io` 同一個網域，⚙️ 的基本設定存在**同一把 localStorage 鑰匙**，學生在一款設好，另兩款打開就一樣。

- **鑰匙：** `hanziGames.settings`
- **內容（JSON）：**

  | 欄位 | 值 | 預設 | 說明 |
  |---|---|---|---|
  | `v` | `1` | `1` | 格式版本 |
  | `script` | `trad`／`simp` | `trad` | 字形；介面的中文也跟著繁簡 |
  | `lang` | `es`／`en`／`zh` | `es` | 中＋西／中＋英／只有中文（介面語言和翻譯語言合一）。選 `zh` 時不顯示翻譯 |
  | `phon` | `pinyin`／`zhuyin`／`both`／`off` | `pinyin` | 拼音、注音、兩個都顯示、關 |
  | `rate` | `slow`／`normal`／`fast` | `normal` | 語速；各遊戲自己對應：跑吧 0.45／0.65／0.85、色數 0.55／0.85／1.1（比比看沒有語音，⚙️ 不放這項，但寫入時要保留原值） |

- **讀：** 讀不到或格式錯 → 用預設；個別欄位不合法 → 那一欄用預設。第一次（鑰匙不存在）可以從自己遊戲舊的設定轉過來，再寫回去（跑吧：舊的 `correLang`）。
- **寫：** 先讀出整個 JSON，只改自己有的欄位再寫回（不要把別款遊戲的欄位洗掉）。
- **同步：** 監聽 `window` 的 `storage` 事件，別的分頁改了就跟著更新（遊戲進行中可先不理）。
- **老師連結鎖定：** 老師句庫連結（`?bank=`）的字形照老師設定，⚙️ 的字形變灰、寫「🔒 老師已設定」，**不寫回**共用設定；拼音／注音學生仍可自己選。

### 介面與按鈕（三款統一）

- 介面文字雙行：上面中文（跟著 `script`），下面小字西文或英文；`lang = zh` 時只有中文。
- 按鈕一律膠囊形（`border-radius:999px`）：主要按鈕滿寬（最寬 300px）、高 54px；選項按鈕高 46px；次要按鈕同大小、透明底。
- ⚙️ 在右上角：開始／結果畫面一顆浮動的，遊戲中在標題列；按下去從中間跳出小視窗，遊戲中會先暫停、按「完成」繼續。
- 結果畫面順序：分數 → 一句評語 → 「成績已回傳給老師」（班級連結才有）→（排行榜）→ 再玩一次 → 主選單。
- 跑吧評語依完成句數：0／1–4／5–9／10–19／20 以上。
- 老師入口：單一按鈕「老師管理中心」→ `https://wangchiapin.github.io/profesor/#/home`。
- 開始畫面最下面有小小的版本號（現在 `v5-2`），用來確認手機拿到的是新版；版本號下面是版權說明（© 2026 @cadadiaunosminutos_ben_chino，2026-10-24 加入）。
- 分享連結預覽（2026-10-28）：`<head>` 有 Open Graph 標籤，根目錄的 `og.jpg`（1200x630）是貼到 LINE／WhatsApp 時顯示的縮圖；名稱來自 `og:title`「跑吧！漢字 · ¡Corre, caracteres!」。

## 句庫等級與題包（網址參數）
- 公開頁只提供 **A1／A2**（免費）；排行榜依等級分開，各看各的前 10 名。
- 付費老師的連結可加隱藏參數（玩家看不到選項）：
  - `?level=B1`（或 A1／A2）：固定用該等級。
  - `?pack=food`：用 `bank/packs.json` 裡的題包；可再加 `&level=A1` 只取該等級。題包代碼：food、shopping、time、transport、school、weather、home、people、compare。
  - B1 和題包的成績**不進公開排行榜**（班級連結的成績另有記法，由老師中心處理）。
- **班級連結**（`?class=班級碼`）也用新句庫：沒指定等級＝A1；可加 `&level=A2`、`&level=B1`、`&pack=food`、`&pack=food&level=A1`。成績回傳到老師中心時，「句庫設定名稱」`k` 依序記成 `pool-A1`／`pool-A2`／`pool-B1`／`pack-<代碼>`／`pack-<代碼>-<等級>`（舊的 `pool` 是改版前的舊公開題庫）。班級連結讀不到新句庫時會顯示錯誤，不會退回舊題庫。
- 句庫是三個檔：`bank/A1.json`、`bank/A2.json`、`bank/B1.json`（每個等級一個，遊戲只讀選到的那一級；題包沒指定等級時才三個都讀）。每個檔頭有 `level`、`count`、`generated`，句子放在 `sentences`。每句有 1–3 個主題標籤；題包規則在 `bank/packs.json`（`rule.tags` 命中任一標籤，或 `rule.grammar` 語法點完全相符）。

## 教師版（已搬到老師管理中心）

- **老師端都在中心：** https://wangchiapin.github.io/profesor/ （repo `profesor`）：句庫編輯、干擾字、QR、班級、成績簿、學習單。
- `teacher/index.html` 只剩**自動跳轉**到中心（舊書籤還能用）。規則不再放在 repo 裡，正本在 game-kit（私人 repo）的 `firebase-rules/`。`manager/`（Ben 的句子管理工具）不變。
- **學生連結（照常可用）：** 練習 `corre/?bank=<連結碼>`；班級 `corre/?class=<班級碼>[&bank=<連結碼>]`；試玩加 `&preview=1`。句庫連結的速度、字形、Boss 關由老師設定；不上傳公開排行榜，結束時可下載成績圖片。
- **干擾字：** 句庫每句可選填 `decoy`（繁體詞陣列）、`decoySimp`（簡體；沒填就用繁體那組），最多 5 個、每個 1～4 字。遊戲每一波先出這些，不夠再從其他句子隨機補。
- **資料在中心專案 `subscription-48d3c`**（不是 corre-d16da）：`teacher_banks/{uid}`（位置表）、`shared_banks/{連結碼}`（句庫）、`classes/{cid}`、`class_scores/{cid}_corre_{句庫碼或 pool}_{暱稱雜湊}`（步驟 6-2：成績依句庫分開，班級排行只比同一個句庫）。
- **注音：** 由拼音即時轉換（`ZY` 轉換器，已用 pypinyin 比對常用讀音）。
- **Firestore 規則：** 正本在 game-kit（私人 repo）的 `firebase-rules/``subscription-48d3c.rules.txt`（中心專案不會自動部署，要整份貼進 Firebase）。

## 測試

`node tests/run.js`（Playwright＋`tests/firebase-mock.js`，見 `tests/README.md`）。

2026-10-30 補了 5 個測試檔（`test_phon_rate.js`、`test_packs.js`、`test_difficulty_audio.js`、`test_controls.js`、`test_leaderboard.js`，共用 `helpers.js`）：拼音注音四個值、語速三檔、9 個題包、難度三檔、音樂／靜音／重聽、鍵盤與拖曳、排行榜上傳與班級榜。已知待決定：網址指定 `?level=A1`／`A2` 會上傳公開榜（程式註解說不上榜）；題包加等級的句子不足 3 句時會退回內建句。


## 新增句子／題包的流程（管理工具「新句庫」模式）

1. 開 `manager/`，預設就是「📗 新句庫」。選等級（A1／A2／B1）、1–3 個標籤（17 個固定標籤）、語法點（選填），再新增句子或批次匯入。句子先放在「草稿」，只存這台電腦的瀏覽器，遊戲讀不到。
2. 已公開的句子可以在 A1／A2／B1 分頁按 ✏️ 修改（草稿裡會變成「取代某句」，可改等級），或按 🗑 標記刪除（發布時才真的移除）。
3. 題包：在「🎁 新增／修改題包」填代碼、中／西／英名稱，規則選標籤（命中任一）或語法點。題包存進草稿。
4. 按「⬇️ 下載草稿」，把檔案交給 Claude 說「發布草稿」。Claude 會跑 `game-kit/bank/import_draft.js`：併進原稿、用八千詞詞表檢查、校對拼音、更新 `bank/A1.json／A2.json／B1.json` 與 `bank/packs.json` 的句數。確認後才 commit 與推送。
5. 題包存在 `bank/packs.json`，遊戲（`?pack=`）和老師中心都讀這一份，所以新題包不用另外改老師中心。

舊的 Firebase 題庫（`mandarinRunnerSentences`）與舊主題包（`site_content` 的 `corre_pack_*`）：遊戲已不再讀取，資料還留在 Firebase 當備份；管理工具的「舊公開題庫」模式還能看，舊主題包入口已收起。

## 手機瀏覽器備註：捲動後回不到頂端（2026-10-24）
iPhone 版 Chrome 上，頁面可以捲動時，往下捲之後有時回不到最上面（Safari 正常）。
本遊戲整頁固定不捲動（`overflow:hidden`），不受影響，不需要修改。之後若新增可以捲動的畫面，請設 `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">`（不要加 `viewport-fit=cover`）並加 `html{color-scheme:light}`（見 game-kit README）。

- 老師訂閱到期（成績寫入被拒）時，結果畫面顯示「這個班級連結目前無法記錄成績，請通知老師」，不再出現重試鈕（2026-10-29，與墨龍、把、被一致）。

## 維修開關（2026-10-29）
- 只有一個開關：老師管理中心（分享區 `stats.html` 的「老師管理中心遊戲開關」，`portalStatus/center-corre`，`off:true`＝維修中）。
- 維修中時，帶 `?class=`／老師連結的學生連結顯示「🔧 維修中」，不能玩、不記成績；網址加 `?preview` 不受影響；讀不到開關就照常放行；公開玩法不受影響。
- 測試：`tests/` 裡的維修測試。
