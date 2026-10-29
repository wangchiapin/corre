// 步驟 5-2：遊戲本身的測試（共用 ⚙️ 設定、雙行介面、干擾字、結果畫面、舊老師頁跳轉）
// 用法：node tests/run.js（或設定 BASE_URL 後直接執行這個檔）
let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs');
const MOCK = fs.readFileSync(__dirname + '/firebase-mock.js', 'utf8');
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const KEY = 'hanziGames.settings';
let pass = 0, fail = 0;
function ok(c, name, extra){ if(c){ pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); } }

const C = 'subscription-48d3c';
const BANK = 'bank00001111', CID = 'class0000aaaa', CID2 = 'class0000bbbb';
const SEED = {
  'corre-d16da': { mandarinRunnerSentences: {
    s1: { trad: ['我', '喜歡', '貓'], simp: ['我', '喜欢', '猫'], pinyin: ['wǒ', 'xǐ huān', 'māo'], es: 'Me gustan los gatos.', en: 'I like cats.', rand: 0.5 } } },
  [C]: {
    shared_banks: { [BANK]: { owner: 'u1', slot: 0, name: '干擾字測試', speed: 'facil', script: 'simp', boss: false, phonetic: 'zhuyin', pro: true, updatedAt: 1,
      sentences: [{ trad: ['我', '要', '紅茶'], simp: ['我', '要', '红茶'], pinyin: ['wǒ', 'yào', 'hóng chá'], es: 'Quiero té negro.', en: 'I want black tea.',
        decoy: ['綠茶', '咖啡'], decoySimp: ['绿茶', '咖啡'] }] } },
    classes: { [CID]: { owner: 'u1', slot: 0, name: '週三班', showBoard: false, updatedAt: 1 }, [CID2]: { owner: 'u1', slot: 1, name: '週五班', showBoard: true, updatedAt: 1 } },
    class_scores: {
      [CID2 + '_corre_pool_' + 'a'.repeat(16)]: { cid: CID2, owner: 'u1', game: 'corre', k: 'pool', h: 'a'.repeat(16), nick: 'Zed', best: 999, plays: 1, lastAt: 1, extra: {} },
      [CID2 + '_corre_' + BANK + '_' + 'b'.repeat(16)]: { cid: CID2, owner: 'u1', game: 'corre', k: BANK, h: 'b'.repeat(16), nick: 'Amy', best: 50, plays: 1, lastAt: 1, extra: {} } }
  }
};

async function open(browser, { qs = '', ls = null, speech = false } = {}){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if(u.startsWith('http://localhost')) return r.continue();
    if(/\.js(\?|$)/.test(u) || u.includes('gstatic')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return r.abort();
  });
  await page.addInitScript('window.__SEED=' + JSON.stringify(SEED) + ';');
  if(ls) await page.addInitScript('try{' + Object.keys(ls).map(k => 'localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(ls[k]) + ');').join('') + '}catch(e){}');
  if(speech) await page.addInitScript(`
    window.__rates = [];
    window.SpeechSynthesisUtterance = function(t){ this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { value: { speaking:false, pending:false, getVoices:()=>[], cancel(){}, speak(u){ window.__rates.push(u.rate); setTimeout(()=>u.onstart&&u.onstart(),5); setTimeout(()=>u.onend&&u.onend(),20); } } });
  `);
  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html' + qs);
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 15000 });
  return { page, ctx, errors };
}
const settings = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const txt = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());

(async () => {
  const browser = await chromium.launch();

  console.log('\n[1] 共用設定：預設值、從舊設定搬過來');
  { const { page, ctx, errors } = await open(browser);
    const s = await settings(page);
    ok(s && s.v === 1 && s.script === 'trad' && s.lang === 'es' && s.phon === 'pinyin' && s.rate === 'normal', '第一次打開寫入預設設定', s);
    ok((await txt(page, '#startBtn')) === '開始 Empezar', '開始按鈕雙行：中文＋西文', await txt(page, '#startBtn'));
    ok(await page.$eval('#teacherLink', e => e.href) === 'https://wangchiapin.github.io/profesor/#/home', '老師管理中心按鈕連到中心');
    ok(!(await page.$('#langGroup')) && !(await page.$('#scriptGroup')) && !(await page.$('#pinyinToggle')), '開始畫面不再有字形／翻譯語言，標題列沒有拼音鈕');
    ok(await page.$eval('#gearFloat', e => getComputedStyle(e).display !== 'none'), '開始畫面右上角有 ⚙️');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { ls: { correLang: 'en' } });
    ok((await settings(page)).lang === 'en', '舊的 correLang=en 搬成 lang=en');
    ok((await txt(page, '#startBtn')) === '開始 Start', '中＋英');
    await ctx.close(); }

  console.log('\n[2] ⚙️ 視窗：改設定、存回共用鑰匙、保留別款遊戲的欄位');
  { const { page, ctx } = await open(browser, { ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'es', phon: 'pinyin', rate: 'normal', other: 7 }) } });
    await page.click('#gearFloat');
    ok(await page.$eval('#setModal', e => !e.classList.contains('hidden')), '按 ⚙️ 跳出設定視窗');
    await page.click('#setScript [data-value=simp]');
    await page.click('#setLang [data-value=zh]');
    await page.click('#setPhon [data-value=both]');
    await page.click('#setRate [data-value=slow]');
    const s = await settings(page);
    ok(s.script === 'simp' && s.lang === 'zh' && s.phon === 'both' && s.rate === 'slow' && s.other === 7, '四項都存好，other 欄位保留', s);
    await page.click('#setDone');
    ok((await txt(page, '#startBtn')) === '开始', '只有中文＋簡體：開始按鈕只剩「开始」', await txt(page, '#startBtn'));
    ok(await page.$$eval('#startOverlay .dl .s', e => e.length) === 0, '只有中文：開始畫面沒有西文小字');
    ok((await txt(page, '#startOverlay h1')) === '跑吧！汉字', '標題跟著簡體');
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { ls: { [KEY]: '{bad json' } });
    ok((await settings(page)).lang === 'es', '設定壞掉時用預設值');
    await ctx.close(); }

  console.log('\n[3] 遊戲中：⚙️ 會暫停、改拼音／注音、語速');
  { const { page, ctx } = await open(browser, { speech: true });
    await page.fill('#nameInput', 'Ana');
    await page.click('#startBtn'); await page.waitForTimeout(400);
    ok(await page.$eval('#gearFloat', e => getComputedStyle(e).display === 'none'), '遊戲中浮動 ⚙️ 隱藏，用標題列那顆');
    await page.click('#gearBtn');
    ok(await page.$eval('#pauseOverlay', e => !e.classList.contains('hidden')), '遊戲中按 ⚙️ 先暫停');
    await page.click('#setPhon [data-value=zhuyin]');
    ok(/[ㄅ-ㄩ]/.test(await txt(page, '#sentence-track .slot .py')) && !/[a-z]/.test(await txt(page, '#sentence-track .slot .py')), '改成注音，句子列馬上變注音（只有注音符號）', await txt(page, '#sentence-track .slot .py'));
    const before = await page.evaluate(() => window.__rates.length);
    await page.click('#setRate [data-value=fast]'); await page.waitForTimeout(150);
    const after = await page.evaluate(() => window.__rates.length);
    ok(after === before, '換語速時不會念任何句子（沒有試聽）', { before, after });
    ok((await settings(page)).rate === 'fast', '語速「快」有存進設定', await settings(page));
    await page.click('#setDone');
    ok(await page.$eval('#pauseOverlay', e => e.classList.contains('hidden')), '按完成繼續遊戲');
    await page.evaluate(() => { document.getElementById('pauseBtn').click(); });
    await page.click('#quitBtn'); await page.waitForTimeout(300);
    ok((await txt(page, '#commentLine')) === '沒關係，再試一次！ ¡No pasa nada, inténtalo otra vez!', '0 句的評語', await txt(page, '#commentLine'));
    const order = await page.$$eval('#overOverlay > *:not([hidden])', es => es.map(e => e.id || e.tagName));
    ok(order.indexOf('commentLine') < order.indexOf('restartBtn') && order.indexOf('restartBtn') < order.indexOf('menuBtn'), '結果畫面順序：評語 → 再玩一次 → 主選單', order);
    await page.click('#menuBtn');
    ok(await page.$eval('#startOverlay', e => !e.classList.contains('hidden')) && await page.$eval('#overOverlay', e => e.classList.contains('hidden')), '主選單回到開始畫面');
    ok((await page.inputValue('#nameInput')) === 'Ana', '回主選單名字還在');
    await ctx.close(); }

  console.log('\n[4] 評語分級');
  { const { page, ctx } = await open(browser, { ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'zh', phon: 'pinyin', rate: 'normal' }) } });
    await page.click('#startBtn'); await page.waitForTimeout(150);
    await page.evaluate(() => document.getElementById('pauseBtn').click());
    await page.click('#quitBtn'); await page.waitForTimeout(150);
    ok((await txt(page, '#commentLine')) === '沒關係，再試一次！', '只有中文：評語只有中文', await txt(page, '#commentLine'));
    await ctx.close(); }
  const src = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const m = src.match(/function commentKey\(n\)\{[^}]*\}/);
  { const commentKey = new Function('return ' + m[0])();
    const got = [0, 1, 4, 5, 9, 10, 19, 20, 99].map(commentKey).join(',');
    ok(got === 'c0,c1,c1,c2,c2,c3,c3,c4,c4', '0／1–4／5–9／10–19／20 以上', got); }

  console.log('\n[5] 老師句庫連結：字形鎖定、干擾字');
  { const { page, ctx, errors } = await open(browser, { qs: '?bank=' + BANK });
    ok((await txt(page, '#startBtn')) === '开始 Empezar', '句庫是簡體 → 介面中文也變簡體', await txt(page, '#startBtn'));
    await page.click('#gearFloat');
    ok(await page.$$eval('#setScript .toggle-btn', b => b.every(x => x.disabled)), '⚙️ 字形變灰');
    ok((await txt(page, '#scriptLock')).includes('老师已设定'), '顯示「老師已設定」', await txt(page, '#scriptLock'));
    ok(await page.$eval('#setScript [data-value=simp]', e => e.classList.contains('active')), '選中的是老師設的簡體');
    await page.click('#setPhon [data-value=off]');
    ok((await settings(page)).phon === 'off' && (await settings(page)).script === 'trad', '拼音／注音學生可改並存回；字形不寫回共用設定');
    await page.click('#setPhon [data-value=pinyin]');
    await page.click('#setDone');
    await page.click('#startBtn');
    // 收集幾波金幣：除了句子的詞，干擾字應該都是老師設的（簡體那組）
    const seen = new Set();
    for(let i = 0; i < 25; i++){
      (await page.$$eval('#track .coin', cs => cs.map(c => c.textContent))).forEach(x => seen.add(x));
      await page.waitForTimeout(200);
    }
    const extra = [...seen].filter(x => !['我', '要', '红茶'].includes(x));
    ok(extra.length > 0 && extra.every(x => ['绿茶', '咖啡'].includes(x)), '干擾字先用老師設的（简体：绿茶、咖啡）', [...seen]);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[6] 班級連結：成績回傳訊息跟著介面語言');
  { const { page, ctx, errors } = await open(browser, { qs: '?class=' + CID, ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'en', phon: 'pinyin', rate: 'normal' }) } });
    await page.fill('#nameInput', 'Leo');
    await page.click('#startBtn'); await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('pauseBtn').click());
    await page.click('#quitBtn');
    await page.waitForFunction(() => document.getElementById('classMsg').innerText.includes('成績已回傳'), null, { timeout: 5000 }).catch(() => {});
    ok((await txt(page, '#classMsg')) === '✅ 成績已回傳給老師 Result sent to your teacher', '「成績已回傳給老師」中＋英', await txt(page, '#classMsg'));
    const order = await page.$$eval('#overOverlay > *:not([hidden])', es => es.map(e => e.id || e.tagName));
    ok(order.indexOf('commentLine') < order.indexOf('classMsg') && order.indexOf('classMsg') < order.indexOf('restartBtn'), '順序：評語 → 回傳訊息 → 再玩一次', order);
    const sc = Object.entries(await page.evaluate(() => window.__DB['subscription-48d3c'].class_scores || {})).filter(([k, v]) => v.cid === CID);
    ok(sc.length === 1, '成績寫進 class_scores');
    const [sid, rec] = sc[0] || [];
    ok(rec.k === 'pool-A1' && sid === CID + '_corre_pool-A1_' + rec.h, '班級連結（沒指定）：用 A1，設定記成 pool-A1，文件 id = 班級_corre_pool-A1_暱稱', [sid, rec.k]);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[6a] 2026-10-29：老師訂閱到期（寫入被拒）→ 明確提示、不出現重試鈕');
  { const { page, ctx, errors } = await open(browser, { qs: '?class=' + CID, ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'tc', phon: 'pinyin', rate: 'normal' }) } });
    await page.evaluate(() => { window.__DENY_SCORES = true; });
    await page.fill('#nameInput', 'Leo');
    await page.click('#startBtn'); await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('pauseBtn').click());
    await page.click('#quitBtn');
    await page.waitForFunction(() => document.getElementById('classMsg').innerText.includes('無法記錄') || document.getElementById('classMsg').innerText.includes('cannot save'), null, { timeout: 5000 }).catch(() => {});
    ok(/無法記錄|cannot save/.test(await txt(page, '#classMsg')), '訂閱到期：提示請通知老師', await txt(page, '#classMsg'));
    ok(await page.$eval('#classRetryBtn', b => b.hidden), '訂閱到期：不出現重試鈕');
    await ctx.close(); }

  console.log('\n[6b] 步驟 6-2：成績依句庫分開記；班級排行只比同一個句庫');
  { const { page, ctx, errors } = await open(browser, { qs: '?class=' + CID2 + '&bank=' + BANK });
    await page.fill('#nameInput', 'Leo');
    await page.click('#startBtn'); await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('pauseBtn').click());
    await page.click('#quitBtn');
    await page.waitForFunction(() => document.querySelectorAll('#lbListOver .lb-row').length > 0, null, { timeout: 5000 }).catch(() => {});
    const sc = await page.evaluate(() => window.__DB['subscription-48d3c'].class_scores);
    const mine = Object.entries(sc).find(([k, v]) => v.nick === 'Leo');
    ok(!!mine && mine[1].k === BANK && mine[0] === CID2 + '_corre_' + BANK + '_' + mine[1].h, '老師句庫：設定記成句庫碼，文件 id = 班級_corre_句庫碼_暱稱', mine);
    const names = await page.$$eval('#lbListOver .lb-name', e => e.map(x => x.textContent));
    ok(names.includes('Amy') && names.includes('Leo') && !names.includes('Zed'), '班級排行榜只列同一個句庫的成績（公開題庫的 Zed 不出現）', names);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[7] 只有中文：句子完成後不顯示翻譯');
  { const ok1 = src.includes("const translationOf = s => lang === 'zh' ? ''");
    ok(ok1, 'translationOf 在 zh 時回傳空字串'); }

  console.log('\n[8] 舊老師頁自動跳轉');
  { const ctx = await browser.newContext(); const page = await ctx.newPage();
    let target = null;
    await page.route('**/*', r => { const u = r.request().url(); if(u.startsWith('http://localhost')) return r.continue(); if(u.includes('wangchiapin.github.io/profesor')){ target = u; return r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }); } return r.abort(); });
    await page.goto(BASE + '/teacher/').catch(() => {});
    await page.waitForTimeout(500);
    ok(target === 'https://wangchiapin.github.io/profesor/', 'teacher/ 跳到老師管理中心', target);
    ok(page.url().startsWith('https://wangchiapin.github.io/profesor/#/home'), '帶 #/home', page.url());
    await ctx.close(); }

  console.log('\n[9] 新句庫：A1／A2／B1 選項（bank/A1.json、A2.json、B1.json）');
  { const bank = ['A1', 'A2', 'B1'].flatMap(L => JSON.parse(fs.readFileSync(__dirname + '/../bank/' + L + '.json', 'utf8')).sentences);
    const byLevel = L => new Set(bank.filter(x => x.level === L).map(x => x.trad.join('')));
    const firstSentence = page => page.$$eval('#sentence-track .slot .hz', e => e.map(x => x.textContent).join(''));
    ok(['A1', 'A2', 'B1'].every(L => bank.filter(x => x.level === L).length >= 100), '句庫檔：三個等級每級至少 100 句');
    ok(new Set(bank.map(x => x.trad.join(''))).size === bank.length, '句庫檔：沒有完全重複的句子');
    ok(new Set(bank.map(x => x.id)).size === bank.length, '句庫檔：編號沒有重複');
    ok(bank.every(x => x.trad.length === x.simp.length && x.trad.length === x.pinyin.length && x.es && x.en && x.tags.length && x.grammar), '句庫檔：每句繁／簡／拼音一樣長，有西文、英文、標籤、語法點');
    { const { page, ctx, errors } = await open(browser);
      ok(await page.$eval('#levelGroup [data-value="A1"]', e => !e.disabled), '原本題庫載入完成後，等級選項開放');
      ok((await txt(page, '#levelGroup .active')) === 'A1', '預設是 A1', await txt(page, '#levelGroup .active'));
      ok(await page.$$eval('#levelGroup .toggle-btn', e => e.map(x => x.dataset.value).join(',')) === 'A1,A2', '公開頁只有 A1、A2（沒有 B1，也沒有「綜合」）');
      ok(errors.length === 0, '沒有程式錯誤', errors);
      await ctx.close(); }
    for(const L of ['A1', 'A2']){
      const { page, ctx } = await open(browser);
      await page.click('#levelGroup [data-value="' + L + '"]');
      await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
      await page.click('#startBtn'); await page.waitForTimeout(300);
      const sen = await firstSentence(page);
      ok(byLevel(L).has(sen), L + '：出的句子來自新句庫的 ' + L, sen);
      await ctx.close();
    }
    { // 預設（沒選過）直接是 A1 的句子
      const { page, ctx } = await open(browser);
      await page.click('#startBtn'); await page.waitForTimeout(300);
      const sen = await firstSentence(page);
      ok(byLevel('A1').has(sen), '第一次進來沒選等級：出 A1 的句子', sen);
      await ctx.close(); }
    { // 舊使用者存過的 mix 之類無效值 → 當作 A1
      const { page, ctx } = await open(browser, { ls: { correLevel: 'mix' } });
      ok((await txt(page, '#levelGroup .active')) === 'A1', '舊的無效等級值改用 A1', await txt(page, '#levelGroup .active'));
      await ctx.close(); }
    { // 新句庫讀不到 → 用內建句子（不再讀舊 Firebase 題庫），等級選項隱藏，仍能玩
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
      await page.route('**/*', r => { const u = r.request().url();
        if(/bank\/(A1|A2|B1)\.json/.test(u)) return r.fulfill({ status: 404, body: 'no' });
        if(u.startsWith('http://localhost')) return r.continue();
        if(/\.js(\?|$)/.test(u) || u.includes('gstatic')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        return r.abort(); });
      await page.addInitScript('window.__SEED=' + JSON.stringify(SEED) + ';'); await page.addInitScript(MOCK);
      await page.goto(BASE + '/index.html');
      await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 15000 });
      await page.click('#startBtn'); await page.waitForTimeout(300);
      { const fs0 = await firstSentence(page); ok(['我喜歡吃蘋果','你叫什麼名字','今天天氣很好','這個顏色是紅色','我喜歡學中文','謝謝你的幫忙'].includes(fs0), '新句庫讀不到：改用內建句子仍能玩（不讀舊 Firebase 題庫，舊題庫的「我喜歡貓」沒出現）', fs0); }
      ok(await page.$eval('#levelField', e => getComputedStyle(e).display === 'none'), '這時隱藏等級選項');
      await ctx.close(); }
    { const { page, ctx } = await open(browser, { ls: { correLevel: 'B1' } });
      await page.waitForTimeout(500);
      ok((await txt(page, '#levelGroup .active')) === 'A1', '舊存的 B1（公開頁已不提供）→ 改回 A1', await txt(page, '#levelGroup .active'));
      await ctx.close(); }
    { const { page, ctx } = await open(browser, { ls: { correLevel: 'A2' } });
      await page.waitForTimeout(500);
      ok((await txt(page, '#levelGroup .active')) === 'A2', '記得上次選的等級（A2）', await txt(page, '#levelGroup .active'));
      await ctx.close(); }
    // 隱藏參數
    { const { page, ctx, errors } = await open(browser, { qs: '?level=B1' });
      ok(await page.$eval('#levelField', e => getComputedStyle(e).display === 'none'), '?level=B1：不顯示等級選項');
      ok(await page.$eval('#showLbBtn', e => getComputedStyle(e).display === 'none'), '?level=B1：不顯示公開排行榜按鈕');
      await page.click('#startBtn'); await page.waitForTimeout(300);
      const sen = await firstSentence(page);
      ok(byLevel('B1').has(sen), '?level=B1：出 B1 的句子', sen);
      ok(errors.length === 0, '沒有程式錯誤', errors);
      await ctx.close(); }
    { const { page, ctx } = await open(browser, { qs: '?level=A2', ls: { correLevel: 'A1' } });
      await page.click('#startBtn'); await page.waitForTimeout(300);
      ok(byLevel('A2').has(await firstSentence(page)), '?level=A2：固定出 A2（不管上次選什麼）');
      ok(await page.$eval('#levelField', e => getComputedStyle(e).display === 'none'), '?level=A2：不顯示等級選項');
      await ctx.close(); }
    { const packs = JSON.parse(fs.readFileSync(__dirname + '/../bank/packs.json', 'utf8')).packs;
      ok(packs.length >= 9 && packs.every(p => p.id && p.name['zh-TW'] && p.name.es && p.name.en && p.name['zh-CN']), '題包檔：每個題包有四種語言名稱');
      const inPack = (p, x) => p.rule.tags ? x.tags.some(t => p.rule.tags.includes(t)) : p.rule.grammar.some(g => x.grammar.endsWith(' ' + g));
      for(const [id, lv] of [['compare', ''], ['food', 'A1']]){
        const p = packs.find(q => q.id === id);
        const want = new Set(bank.filter(x => inPack(p, x) && (!lv || x.level === lv)).map(x => x.trad.join('')));
        const { page, ctx } = await open(browser, { qs: '?pack=' + id + (lv ? '&level=' + lv : '') });
        ok(await page.$eval('#levelField', e => getComputedStyle(e).display === 'none'), '?pack=' + id + '：不顯示等級選項');
        await page.click('#startBtn'); await page.waitForTimeout(300);
        const sen = await firstSentence(page);
        ok(want.has(sen), '?pack=' + id + (lv ? '&level=' + lv : '') + '：句子都在題包裡', sen);
        await ctx.close(); }
      const { page, ctx } = await open(browser, { qs: '?pack=nosuchpack' });
      await page.click('#startBtn'); await page.waitForTimeout(300);
      ok((await firstSentence(page)).length > 0, '?pack=不存在的代碼：仍能玩（退回備用題庫）');
      await ctx.close(); }
    { const { page, ctx } = await open(browser, { qs: '?class=' + CID });
      ok(await page.$eval('#levelField', e => getComputedStyle(e).display === 'none'), '班級連結：不顯示等級選項');
      await ctx.close(); }
    // 班級連結 + 等級／題包：句子來自該句庫，成績設定名稱照規則
    const packs = JSON.parse(fs.readFileSync(__dirname + '/../bank/packs.json', 'utf8')).packs;
    const inPack = (p, x) => p.rule.tags ? x.tags.some(t => p.rule.tags.includes(t)) : p.rule.grammar.some(g => x.grammar.endsWith(' ' + g));
    for(const [q, key, want] of [
      ['&level=A2', 'pool-A2', byLevel('A2')],
      ['&level=B1', 'pool-B1', byLevel('B1')],
      ['&pack=compare', 'pack-compare', new Set(bank.filter(x => inPack(packs.find(p => p.id === 'compare'), x)).map(x => x.trad.join('')))],
      ['&pack=food&level=A1', 'pack-food-A1', new Set(bank.filter(x => inPack(packs.find(p => p.id === 'food'), x) && x.level === 'A1').map(x => x.trad.join('')))],
    ]){
      const { page, ctx, errors } = await open(browser, { qs: '?class=' + CID + q });
      await page.fill('#nameInput', 'Kai');
      await page.click('#startBtn'); await page.waitForTimeout(300);
      const sen = await firstSentence(page);
      ok(want.has(sen), '班級連結 ' + q + '：句子來自對的句庫', sen);
      await page.evaluate(() => document.getElementById('pauseBtn').click());
      await page.click('#quitBtn');
      await page.waitForFunction(() => document.getElementById('classMsg').innerText.includes('成績已回傳'), null, { timeout: 5000 }).catch(() => {});
      const sc = Object.values(await page.evaluate(() => window.__DB['subscription-48d3c'].class_scores || {})).filter(v => v.cid === CID);
      ok(sc.length === 1 && sc[0].k === key, '班級連結 ' + q + '：成績設定名稱記成 ' + key, sc.map(v => v.k));
      ok(errors.length === 0, '沒有程式錯誤', errors);
      await ctx.close();
    } }

  await browser.close();
  console.log('\n通過 ' + pass + '，失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
