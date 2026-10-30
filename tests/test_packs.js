// 補測試：9 個題包每一個都開局驗證（以前只測 compare、food）
// 驗：句子都在題包裡（連續好幾局）、掉下來的干擾字也來自題包、各等級組合、班級連結的成績名稱、不上公開排行榜
// 用法：node tests/run.js（或設定 BASE_URL 後直接執行這個檔）
const H = require('./helpers');
const { ok, CENTRAL } = H;

const CID = 'class0000aaaa';
const SEED = { [CENTRAL]: { classes: { [CID]: { owner: 'u1', slot: 0, name: '週三班', showBoard: false, updatedAt: 1 } } }, 'corre-d16da': { mandarinRunnerScores: {} } };
const bank = H.allBank(), packs = H.packsFile();
const inPack = (p, x) => p.rule.tags ? x.tags.some(t => p.rule.tags.includes(t)) : p.rule.grammar.some(g => x.grammar.endsWith(' ' + g));
const rowsOf = (p, lv) => bank.filter(x => inPack(p, x) && (!lv || x.level === lv));
const joined = x => x.trad.join('');

(async () => {
  const browser = await H.launch();
  const ids = ['food', 'shopping', 'time', 'transport', 'school', 'weather', 'home', 'people', 'compare'];

  console.log('\n[1] 題包清單：檔案裡正好是這 9 個，而且每個在句庫裡真的有句子');
  ok(packs.length === 9 && ids.every(id => packs.some(p => p.id === id)) && packs.every(p => ids.includes(p.id)), '題包檔有 9 個題包，代碼就是 ' + ids.join('、'), packs.map(p => p.id));
  ok(packs.every(p => rowsOf(p).length >= 3), '每個題包在句庫中至少有 3 句（少於 3 句遊戲會退回內建句子）', packs.map(p => p.id + ':' + rowsOf(p).length));
  ok(packs.every(p => rowsOf(p).length === p.count), '題包檔的 count 與句庫實際命中的句數一致', packs.map(p => p.id + ':' + p.count + '/' + rowsOf(p).length));

  console.log('\n[2] 每個題包開局：連續 4 局的句子都在題包裡，干擾字也來自題包');
  for(const id of ids){
    const p = packs.find(q => q.id === id);
    const want = new Set(rowsOf(p).map(joined));
    const words = new Set(rowsOf(p).flatMap(x => x.trad));
    const { page, ctx, errors } = await H.open(browser, { qs: '?pack=' + id, seed: SEED });
    ok(await page.$eval('#levelField', e => getComputedStyle(e).display === 'none'), '?pack=' + id + '：不顯示等級選項');
    ok(await page.$eval('#showLbBtn', e => getComputedStyle(e).display === 'none'), '?pack=' + id + '：不顯示公開排行榜按鈕');
    const seen = [];
    await H.start(page);
    seen.push(await H.sentenceText(page));
    // 這一局的金幣：全部都該是題包裡出現過的詞
    const coins = new Set();
    for(let i = 0; i < 12; i++){ (await page.$$eval('#track .coin', cs => cs.map(c => c.textContent))).forEach(x => coins.add(x)); await H.settle(300); }
    for(let k = 0; k < 3; k++){
      await H.quit(page);
      await page.click('#restartBtn');
      await page.waitForFunction(() => document.querySelectorAll('#sentence-track .slot').length > 0);
      seen.push(await H.sentenceText(page));
    }
    ok(seen.every(s => want.has(s)), '?pack=' + id + '（' + p.name['zh-TW'] + '）：連續 4 局的句子都在題包裡', seen.filter(s => !want.has(s)));
    ok(new Set(seen).size >= 2 || want.size < 3, '?pack=' + id + '：4 局不是一直同一句（有隨機抽句）', seen);
    ok(coins.size > 0 && [...coins].every(c => words.has(c)), '?pack=' + id + '：掉下來的金幣（含干擾字）都來自題包的詞', [...coins].filter(c => !words.has(c)));
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close();
  }

  console.log('\n[3] 題包 × 等級：句子同時符合題包和等級');
  for(const p of packs){
    for(const lv of ['A1', 'A2', 'B1']){
      const want = new Set(rowsOf(p, lv).map(joined));
      if(want.size < 3) continue;   // 少於 3 句的組合另外測（[4]）
      const { page, ctx } = await H.open(browser, { qs: '?pack=' + p.id + '&level=' + lv, seed: SEED });
      await H.start(page);
      const s = await H.sentenceText(page);
      ok(want.has(s), '?pack=' + p.id + '&level=' + lv + '：句子在「題包∩等級」裡', s);
      await ctx.close();
    }
  }

  console.log('\n[4] 題包某等級句子少於 3 句：退回內建句子，仍能玩（目前的行為）');
  { const thin = [];
    for(const p of packs) for(const lv of ['A1', 'A2', 'B1']) if(rowsOf(p, lv).length < 3) thin.push([p.id, lv, rowsOf(p, lv).length]);
    ok(thin.length > 0, '句庫裡確實有「題包＋等級」少於 3 句的組合（用來驗這個行為）', thin);
    const DEFAULTS = ['我喜歡吃蘋果', '你叫什麼名字', '今天天氣很好', '這個顏色是紅色', '我喜歡學中文', '謝謝你的幫忙'];
    for(const [id, lv, n] of thin){
      const { page, ctx, errors } = await H.open(browser, { qs: '?pack=' + id + '&level=' + lv, seed: SEED });
      await H.start(page);
      const s = await H.sentenceText(page);
      ok(DEFAULTS.includes(s), '?pack=' + id + '&level=' + lv + '（只有 ' + n + ' 句）→ 出的是內建句子，不是當成空題庫卡住', s);
      ok(errors.length === 0, '沒有程式錯誤', errors);
      await ctx.close();
    } }

  console.log('\n[5] 題包不上公開排行榜、可下載成績圖');
  for(const id of ['food', 'weather', 'people']){
    const { page, ctx } = await H.open(browser, { qs: '?pack=' + id, seed: SEED });
    await H.start(page, 'Pat');
    await H.quit(page);
    ok(await page.$eval('#lbListOver', e => e.hidden) && await page.$eval('#lbHeadingOver', e => e.hidden), '?pack=' + id + '：結果畫面沒有排行榜');
    ok(!(await page.$eval('#dlBtn', e => e.hidden)) && !(await page.$eval('#noRecordMsg', e => e.hidden)), '?pack=' + id + '：顯示「不會上排行榜」說明和下載圖片鈕');
    const n = await page.evaluate(() => Object.keys(window.__DB['corre-d16da'].mandarinRunnerScores || {}).length);
    ok(n === 0, '?pack=' + id + '：沒有寫進公開排行榜', n);
    await ctx.close();
  }

  console.log('\n[6] 班級連結 + 每個題包：成績設定名稱記成 pack-代碼、句子來自題包');
  for(const id of ids){
    const p = packs.find(q => q.id === id);
    const want = new Set(rowsOf(p).map(joined));
    const { page, ctx, errors } = await H.open(browser, { qs: '?class=' + CID + '&pack=' + id, seed: SEED });
    await H.start(page, 'Kai');
    const s = await H.sentenceText(page);
    ok(want.has(s), '班級連結 &pack=' + id + '：句子在題包裡', s);
    await page.click('#pauseBtn'); await page.click('#quitBtn');
    await page.waitForFunction(() => document.getElementById('classMsg').innerText.includes('成績已回傳'), null, { timeout: 8000 }).catch(() => {});
    const sc = Object.values(await page.evaluate(() => window.__DB['subscription-48d3c'].class_scores || {})).filter(v => v.cid === CID);
    ok(sc.length === 1 && sc[0].k === 'pack-' + id && sc[0].game === 'corre', '班級連結 &pack=' + id + '：成績記成 pack-' + id, sc.map(v => v.k));
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close();
  }

  await browser.close();
  process.exit(H.result());
})();
