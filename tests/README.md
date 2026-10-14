# 測試

用 Playwright 開真正的瀏覽器測遊戲，Firebase 用 `firebase-mock.js`（記憶體內的替身）取代，**不會碰到真的資料庫**。

## 執行

```
npm i -D playwright && npx playwright install chromium   # 第一次
node tests/run.js
```

`run.js` 會自己開靜態伺服器，依序跑 `tests/test_*.js`，有任何一項失敗就以非 0 結束。

## 內容

| 檔案 | 測什麼 |
|---|---|
| `test_game.js` | 遊戲本身（步驟 5-2）：共用 ⚙️ 設定 `hanziGames.settings`（預設、從 `correLang` 搬過來、保留別款欄位、壞掉時用預設）、雙行介面（中＋西／中＋英／只有中文、繁簡）、遊戲中 ⚙️ 暫停與注音／語速、結果畫面評語與順序、主選單、老師句庫連結字形鎖定與干擾字、班級成績回傳訊息、舊 `teacher/` 自動跳轉 |

舊的教師頁測試（`test_pick.js`、`test_wrap.js`）已拿掉：教師頁搬到老師管理中心（repo `profesor`），那邊有自己的測試。

## 沒有涵蓋的

- **Firestore 安全規則**：模擬器不驗規則。請用非管理員的 Gmail 在實機測（管理員會繞過規則）。
- QR code、學習單 PDF、班級成績冊：以前有測試，但舊檔已遺失，尚未重寫。
- 模擬環境沒有載入 OpenCC／pinyin-pro，所以不測繁簡轉換與拼音結果。
