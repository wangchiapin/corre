// 補測試：⚙️「拼音／注音」四個值畫面上真的變、「語速」三檔真的套到唸字速度
// （以前只驗「有存進設定」，沒驗畫面和語音）
// 用法：node tests/run.js（或設定 BASE_URL 後直接執行這個檔）
const H = require('./helpers');
const { ok, KEY, CENTRAL } = H;

const BANK = 'bank0000aaaa';
const SEED = { [CENTRAL]: { shared_banks: { [BANK]: { owner: 'u1', slot: 0, name: '拼音測試', speed: 'facil', script: 'trad', boss: false, phonetic: 'pinyin', pro: true, updatedAt: 1,
  sentences: [{ trad: ['我', '要', '紅茶'], simp: ['我', '要', '红茶'], pinyin: ['wǒ', 'yào', 'hóng chá'], es: 'Quiero té negro.', en: 'I want black tea.' }] } } } };
const PY = ['wǒ', 'yào', 'hóng chá'];
const ZY = ['ㄨㄛˇ', 'ㄧㄠˋ', 'ㄏㄨㄥˊ ㄔㄚˊ'];
const S = (o) => JSON.stringify(Object.assign({ v: 1, script: 'trad', lang: 'es', phon: 'pinyin', rate: 'normal' }, o));

// 讀句子列每一格 .py 的內容與結構
const readPy = page => page.$$eval('#sentence-track .slot .py', es => es.map(e => ({
  text: e.textContent, zy: e.classList.contains('zy'), two: e.classList.contains('two'),
  kids: [...e.children].map(c => ({ t: c.textContent, zy: c.classList.contains('zy') }))
})));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const browser = await H.launch();

  console.log('\n[1] 拼音／注音：開遊戲時就照存好的設定顯示（四個值）');
  for(const v of ['pinyin', 'zhuyin', 'both', 'off']){
    const { page, ctx, errors } = await H.open(browser, { qs: '?bank=' + BANK, seed: SEED, ls: { [KEY]: S({ phon: v }) } });
    await H.start(page);
    const py = await readPy(page);
    if(v === 'pinyin') ok(py.length === 3 && eq(py.map(x => x.text), PY) && py.every(x => !x.zy && !x.two), '拼音：每格顯示拼音（wǒ／yào／hóng chá），不是注音', py);
    if(v === 'zhuyin') ok(py.length === 3 && eq(py.map(x => x.text), ZY) && py.every(x => x.zy && !/[a-zǒàó]/i.test(x.text)), '注音：每格顯示注音符號（ㄨㄛˇ／ㄧㄠˋ／ㄏㄨㄥˊ ㄔㄚˊ），沒有拉丁字母', py);
    if(v === 'both') ok(py.length === 3 && py.every(x => x.two && x.kids.length === 2 && !x.kids[0].zy && x.kids[1].zy) && eq(py.map(x => x.kids[0].t), PY) && eq(py.map(x => x.kids[1].t), ZY), '兩個都顯示：上面拼音、下面注音', py);
    if(v === 'off') ok(py.length === 3 && py.every(x => x.text === ''), '關：每格都沒有拼音也沒有注音', py);
    ok((await H.sentenceText(page)) === '我要紅茶', '漢字照常顯示（' + v + '）');
    await page.click('#gearBtn');
    ok((await page.$eval('#setPhon .active', e => e.dataset.value)) === v, '⚙️ 裡亮起來的是 ' + v);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close();
  }

  console.log('\n[2] 遊戲中在 ⚙️ 切換四個值：句子列馬上跟著變，設定存回去');
  { const { page, ctx } = await H.open(browser, { qs: '?bank=' + BANK, seed: SEED });
    await H.start(page);
    ok(eq((await readPy(page)).map(x => x.text), PY), '一開始預設是拼音');
    await page.click('#gearBtn');
    ok(await page.$eval('#pauseOverlay', e => !e.classList.contains('hidden')) , '按 ⚙️ 會暫停');
    for(const [v, check] of [
      ['zhuyin', py => eq(py.map(x => x.text), ZY) && py.every(x => x.zy)],
      ['both', py => py.every(x => x.two && x.kids.length === 2) && eq(py.map(x => x.kids[1].t), ZY)],
      ['off', py => py.every(x => x.text === '')],
      ['pinyin', py => eq(py.map(x => x.text), PY) && py.every(x => !x.zy && !x.two)]
    ]){
      await page.click('#setPhon [data-value=' + v + ']');
      const py = await readPy(page);
      ok(check(py), '按「' + v + '」→ 句子列馬上變成對的樣子', py);
      ok((await H.settings(page)).phon === v && (await page.$eval('#setPhon .active', e => e.dataset.value)) === v, '「' + v + '」存進設定，按鈕亮起來');
    }
    // 關掉之後再回來，要真的變回來（不是只改一次）
    await page.click('#setPhon [data-value=zhuyin]');
    await page.click('#setDone');
    ok(eq((await readPy(page)).map(x => x.text), ZY), '按完成回到遊戲，仍是注音');
    await ctx.close(); }

  console.log('\n[3] 注音選好之後重新整理：新一局還是注音（公開頁、真句庫）');
  { const bank = H.allBank();
    const { page, ctx } = await H.open(browser);
    await page.click('#gearFloat'); await page.click('#setPhon [data-value=zhuyin]'); await page.click('#setDone');
    await page.reload(); await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await H.start(page);
    const sen = await H.sentenceText(page), row = bank.find(x => x.trad.join('') === sen), py = await readPy(page);
    ok(!!row && py.length === row.pinyin.length, '句子列格數＝句庫該句的詞數', sen);
    ok(py.every(x => x.zy && /^[ㄅ-ㄩˊˇˋ˙ ]+$/.test(x.text)), '每格都是注音符號', py.map(x => x.text));
    ok(py.every((x, i) => x.text.split(' ').length === row.pinyin[i].split(' ').length), '每格注音的音節數＝該詞拼音的音節數（沒有漏字）');
    await ctx.close(); }

  console.log('\n[4] 語速：存好的設定真的套到唸字的速度（慢 0.45／正常 0.65／快 0.85）');
  // 公開頁、簡單難度（金幣慢，機器人比較好吃到）；吃到任何一個金幣就會唸那個字
  const eatOne = async (page) => {
    const n0 = await page.evaluate(() => window.__spoken.length);
    const s = await H.botPlay(page, s => s.nSpoken > n0, { timeout: 45000, spd: 95 });
    return s;
  };
  const lastRate = page => page.evaluate(() => { const a = window.__spoken; return a.length ? a[a.length - 1] : null; });
  for(const [rate, want] of [['slow', 0.45], ['fast', 0.85]]){
    const { page, ctx } = await H.open(browser, { ls: { [KEY]: S({ rate }) } });
    await page.click('#diffGroup [data-value=facil]');
    await H.start(page);
    await eatOne(page);
    const sp = await lastRate(page);
    ok(sp && sp.rate === want && sp.text.length > 0 && sp.lang === 'zh-TW', '設定「' + rate + '」→ 念出「' + (sp && sp.text) + '」時語速是 ' + want, sp);
    await ctx.close();
  }
  { const { page, ctx, errors } = await H.open(browser);
    await page.click('#diffGroup [data-value=facil]');
    await H.start(page);
    await eatOne(page);
    let sp = await lastRate(page);
    ok(sp && sp.rate === 0.65, '預設（正常）→ 語速 0.65', sp);
    // 遊戲中在 ⚙️ 改，下一次念就套用新的
    for(const [v, want] of [['slow', 0.45], ['fast', 0.85], ['normal', 0.65]]){
      await page.click('#gearBtn');
      await page.click('#setRate [data-value=' + v + ']');
      await page.click('#setDone');
      await page.waitForFunction(() => document.getElementById('pauseOverlay').classList.contains('hidden'));
      await eatOne(page);
      sp = await lastRate(page);
      ok(sp && sp.rate === want, '遊戲中改成「' + v + '」→ 下一次念字語速變 ' + want, sp);
    }
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  await browser.close();
  process.exit(H.result());
})();
