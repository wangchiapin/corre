# 跑吧！漢字（Corre）

> 跑酷式的漢字學習遊戲，含句子庫管理頁

- **網址：** https://wangchiapin.github.io/corre/（管理頁：corre/manager/）
- **Firebase 專案：** corre-d16da
- **登入方式：** Google 登入（管理頁）
- **狀態：** 使用中
- **備註：** 句子庫管理工具就在本 repo 的 `manager/`（原獨立 repo `corre-sentence-manager` 已併入）。

## 教師版（老師自建句庫）

- **老師編輯頁：** `teacher/index.html`（遊戲首頁的「教師版」按鈕連過去）。Google 登入，建立句庫、批次匯入、試玩、複製學生連結。介面有繁體、簡體、西班牙文、英文。
- **學生連結：** `https://wangchiapin.github.io/corre/?bank=<連結碼>`。速度、字體、Boss 關由老師設定，學生不能改；不上傳排行榜，結束時可下載成績圖片。
- **資料在中心專案 `subscription-48d3c`**（不是 corre-d16da）：`teacher_banks/{uid}`（位置表）、`shared_banks/{連結碼}`（句庫）。老師登入、`site_members`、`site_plans` 與色數消消樂共用，訂閱開通與管理都在 `cadadiaunosminutos-share-zone` 的 `stats.html`。
- **額度：** 免費 1 個句庫、每庫 50 句；訂閱（月訂、年訂、試用）最多 5 個句庫、每庫 80 句；每句最多 20 個漢字。訂閱到期後，只有第 1 個庫（50 句以內）的連結繼續有效。
- **注音：** 全站可用。遊戲 HUD 的按鈕在「拼音／注音／拼+注／關」間切換（教師連結由老師在句庫設定指定顯示方式，學生只能開關）。注音由拼音即時轉換（`ZY` 轉換器，已用 pypinyin 比對常用讀音）。
- **QR code（免費）：** 每個句庫可產生 QR 圖片，可下載或用手機分享（`teacher/qrcode.js` = qrcode-generator 1.4.4，MIT）。
- **學習單 PDF（訂閱版）：** 選翻譯語言（西／英）、是否顯示拼音／注音、是否加「排列句子」練習（含答案頁）。在瀏覽器用 canvas 畫成 A4 圖片頁再包成 PDF，不需後端。
- **班級成績冊（訂閱版）：** 老師在教師頁建立最多 3 個班級（人數不限），取得學生連結 `?class=<班級碼>`（可加 `&bank=<句庫碼>`）。學生輸入暱稱（必填）玩完後成績自動回傳；同暱稱（不分大小寫與空白）合併、只留最高分；老師可開關「班級排行榜」、匯出 CSV、刪除或清空成績。資料：`teacher_classes/{uid}`、`classes/{cid}`、`class_scores/{cid}_{game}_{暱稱雜湊}`。訂閱到期後學生無法回傳，老師仍可查看與匯出。
- **Firestore 規則：** 新增的規則內容見 `teacher/firestore.rules.txt`，要貼到中心專案 `subscription-48d3c` 的規則裡（這個 repo 不會自動部署）。

