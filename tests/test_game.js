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
const BANK = 'bank00001111', CID = 'class0000aaaa';
const SEED = {
  'corre-d16da': { mandarinRunnerSentences: {
    s1: { trad: ['我', '喜歡', '貓'], simp: ['我', '喜欢', '猫'], pinyin: ['wǒ', 'xǐ huān', 'māo'], es: 'Me gustan los gatos.', en: 'I like cats.', rand: 0.5 } } },
  [C]: {
    shared_banks: { [BANK]: { owner: 'u1', slot: 0, name: '干擾字測試', speed: 'facil', script: 'simp', boss: false, phonetic: 'zhuyin', pro: true, updatedAt: 1,
      sentences: [{ trad: ['我', '要', '紅茶'], simp: ['我', '要', '红茶'], pinyin: ['wǒ', 'yào', 'hóng chá'], es: 'Quiero té negro.', en: 'I want black tea.',
        decoy: ['綠茶', '咖啡'], decoySimp: ['绿茶', '咖啡'] }] } },
    classes: { [CID]: { owner: 'u1', slot: 0, name: '週三班', showBoard: false, updatedAt: 1 } }
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
    ok(await page.$eval('#teacherLink', e => e.href) === 'https://wangchiapin.github.io/profesor/#/settings', '老師管理中心按鈕連到中心');
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
    ok((await txt(page, '#sentence-track .slot .py')).includes('ㄨㄛˇ'), '改成注音，句子列馬上變注音', await txt(page, '#sentence-track .slot .py'));
    await page.click('#setRate [data-value=fast]'); await page.waitForTimeout(150);
    const rates = await page.evaluate(() => window.__rates);
    ok(rates[rates.length - 1] === 1.1, '語速「快」→ rate 1.1（按下去會試聽）', rates);
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
    ok(await page.evaluate(() => Object.keys(window.__DB['subscription-48d3c'].class_scores || {}).length) === 1, '成績寫進 class_scores');
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
    ok(page.url().startsWith('https://wangchiapin.github.io/profesor/#/settings'), '帶 #/settings', page.url());
    await ctx.close(); }

  await browser.close();
  console.log('\n通過 ' + pass + '，失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
