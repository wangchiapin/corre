# 測試

用 Playwright 開真正的瀏覽器測教師頁，Firebase 用 `firebase-mock.js`（記憶體內的替身）取代，**不會碰到真的資料庫**。

## 執行

```
npm i -D playwright && npx playwright install chromium   # 第一次
node tests/run.js
```

`run.js` 會自己開靜態伺服器，依序跑 `tests/test_*.js`，有任何一項失敗就以非 0 結束。

## 內容

| 檔案 | 測什麼 |
|---|---|
| `test_pick.js` | 教師頁「從公開題庫／主題包加入」：分頁與讀取上限（100 筆）、超過 20 字灰掉、重複、50／80 句上限、訂閱／免費／過期的差別、四語介面與文案完整性、常駐訂閱規則說明 |
| `test_wrap.js` | 公開題庫隨機起點靠近尾端時，會繞回開頭補滿一頁 |

## 沒有涵蓋的

- **Firestore 安全規則**：模擬器不驗規則。請用非管理員的 Gmail 在實機測（管理員會繞過規則）。
- QR code、學習單 PDF、班級成績冊：以前有測試，但舊檔已遺失，尚未重寫。
- 模擬環境沒有載入 OpenCC／pinyin-pro，所以不測繁簡轉換與拼音結果。
