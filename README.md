# 跑吧！漢字（Corre）

> 跑酷式的漢字學習遊戲，含句子庫管理頁

- **網址：** https://wangchiapin.github.io/corre/（管理頁：corre/manager/）
- **Firebase 專案：** corre-d16da
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
  | `rate` | `slow`／`normal`／`fast` | `normal` | 語速；各遊戲自己對應：跑吧 0.75／0.92／1.1、色數 0.55／0.85／1.1（比比看沒有語音，⚙️ 不放這項，但寫入時要保留原值） |

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
- 老師入口：單一按鈕「👩‍🏫 老師管理中心」→ `https://wangchiapin.github.io/profesor/#/settings`。
- 開始畫面最下面有小小的版本號（現在 `v5-2`），用來確認手機拿到的是新版。

## 教師版（已搬到老師管理中心）

- **老師端都在中心：** https://wangchiapin.github.io/profesor/ （repo `profesor`）：句庫編輯、干擾字、QR、班級、成績簿、學習單。
- `teacher/index.html` 只剩**自動跳轉**到中心（舊書籤還能用）。`teacher/firestore.rules.txt` 保留當規則參考。`manager/`（Ben 的句子管理工具）不變。
- **學生連結（照常可用）：** 練習 `corre/?bank=<連結碼>`；班級 `corre/?class=<班級碼>[&bank=<連結碼>]`；試玩加 `&preview=1`。句庫連結的速度、字形、Boss 關由老師設定；不上傳公開排行榜，結束時可下載成績圖片。
- **干擾字：** 句庫每句可選填 `decoy`（繁體詞陣列）、`decoySimp`（簡體；沒填就用繁體那組），最多 5 個、每個 1～4 字。遊戲每一波先出這些，不夠再從其他句子隨機補。
- **資料在中心專案 `subscription-48d3c`**（不是 corre-d16da）：`teacher_banks/{uid}`（位置表）、`shared_banks/{連結碼}`（句庫）、`classes/{cid}`、`class_scores/{cid}_corre_{句庫碼或 pool}_{暱稱雜湊}`（步驟 6-2：成績依句庫分開，班級排行只比同一個句庫）。
- **注音：** 由拼音即時轉換（`ZY` 轉換器，已用 pypinyin 比對常用讀音）。
- **Firestore 規則：** 見 `teacher/firestore.rules.txt`（中心專案不會自動部署）。

## 測試

`node tests/run.js`（Playwright＋`tests/firebase-mock.js`，見 `tests/README.md`）。
