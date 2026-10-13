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
- **Firestore 規則：** 新增的規則內容見 `teacher/firestore.rules.txt`，要貼到中心專案 `subscription-48d3c` 的規則裡（這個 repo 不會自動部署）。

