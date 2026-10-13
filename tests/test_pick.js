// 批次 3 測試：從公開題庫／主題包挑句子（Playwright + 模擬 Firebase）
let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs');
const path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'firebase-mock.js'), 'utf8');
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const URL = BASE + '/teacher/index.html';
const TEACHER_HTML = path.join(__dirname, '..', 'teacher', 'index.html');

let pass = 0, fail = 0;
function ok(cond, name, extra){ if(cond){ pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); } }

const ch = i => String.fromCharCode(0x4e00 + (i % 20000));   // 全部落在 CJK 範圍內
function sent(i, longer){
  // 短句：2 格（首字隨 i 變，保證不重複）；長句：21 個漢字
  const trad = longer ? Array.from({ length: 21 }, (_, k) => ch(i + 100 * k)) : [ch(i), ch(7000 + i)];
  return { trad, simp: trad.slice(), pinyin: trad.map(() => 'a'), es: 'es' + i, en: 'en' + i, rand: 0, id_: i };
}
// 公開題庫：130 筆；i%10==3 的太長；i==7 缺西文（無效）；最後一筆與第 0 筆重複
function poolSeed(){
  const o = {};
  for(let i = 0; i < 130; i++){
    const s = sent(i, i % 10 === 3); s.rand = (i + 0.5) / 130; delete s.id_;
    if(i === 7) delete s.es;
    if(i === 129){ const z = sent(0, false); s.trad = z.trad; s.simp = z.simp; s.pinyin = z.pinyin; }
    o['p' + i] = s;
  }
  return o;
}
function packSeed(){
  const o = {};
  // 小包：5 句，含 1 句太長、1 句與題庫第 1 句重複
  const small = [sent(1000), sent(1001), sent(1002, true), sent(1003), sent(1, false)].map(s => { delete s.rand; delete s.id_; return s; });
  o['corre_pack_0000000001'] = { kind: 'corre_pack', name: { zh: '點飲料', es: 'Pedir bebidas' }, desc: { zh: '飲料店用語', es: 'Frases de la tienda' }, order: 10, sentences: small };
  // 大包：90 句有效
  const big = Array.from({ length: 90 }, (_, i) => { const s = sent(2000 + i); delete s.rand; delete s.id_; return s; });
  o['corre_pack_0000000002'] = { kind: 'corre_pack', name: { zh: '大包', es: '' }, desc: { zh: '', es: '' }, order: 20, sentences: big };
  o['not_a_pack'] = { kind: 'other' };
  return o;
}

async function open(browser, { pro }){
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', route => {
    const u = route.request().url();
    if(u.startsWith('http://localhost')) return route.continue();
    if(/\.js(\?|$)/.test(u) || u.includes('gstatic.com/firebasejs')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return route.abort();
  });
  const seed = { 'corre-d16da': { mandarinRunnerSentences: poolSeed() }, 'subscription-48d3c': { site_content: packSeed() } };
  if(pro) seed['subscription-48d3c'].site_plans = { u1: { plan: 'year', expiresAt: Date.now() + 90 * 86400000 } };
  await page.addInitScript('window.__SEED = ' + JSON.stringify(seed) + ';');
  await page.addInitScript('Math.random = () => 0;');   // 讓公開題庫的隨機起點固定，測試可重現
  await page.addInitScript(MOCK);
  const html = fs.readFileSync(TEACHER_HTML, 'utf8').replace(/\}\)\(\);\s*<\/script>\s*<\/body>/, 'window.__teacher={get ED(){return ED;}};})();</script></body>');
  await page.route('**/teacher/index.html', r => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto(URL);
  await page.waitForSelector('#viewList:not([hidden])');
  await page.waitForFunction(() => document.querySelector('#bankList .bank'));
  return { page, errors, ctx };
}
async function openEditor(page){
  await page.click('#bankList .bank >> text=＋ 建立句庫');
  await page.waitForSelector('#viewEdit:not([hidden])');
}
const cards = page => page.$$eval('#pickList .pick-card', els => els.map(e => ({ dis: e.classList.contains('dis'), txt: e.innerText, disabledInput: e.querySelector('input').disabled })));
const status = page => page.$eval('#pickStatus', e => e.textContent);
const readsOf = (page, pid) => page.evaluate(p => window.__reads[p] || 0, pid);

(async () => {
  const browser = await chromium.launch();

  console.log('\n[A] 免費教師：公開題庫');
  {
    const { page, errors, ctx } = await open(browser, { pro: false });
    ok(await page.evaluate(() => window.__apps.join('|')) === '[DEFAULT]:subscription-48d3c|pool:corre-d16da', '兩個 Firebase app（預設=中心，pool=corre-d16da）');
    await openEditor(page);
    ok(await page.$eval('#pickPanel', e => e.hidden), '一開始面板收合');
    const before = await readsOf(page, 'corre-d16da');
    ok(before === 0, '還沒點之前不讀公開題庫', before);
    await page.click('#pickSrcGroup [data-value=pool]');
    await page.waitForSelector('#pickList .pick-card');
    let cs = await cards(page);
    const r1 = await readsOf(page, 'corre-d16da');
    ok(r1 === 20, '第一頁只讀 20 筆', r1);
    ok(cs.length <= 20 && cs.length >= 17, '顯示的有效句子數合理（扣掉無效/重複）', cs.length);
    ok(cs.some(c => c.dis && c.disabledInput), '太長的句子灰掉且 checkbox 不能點');
    ok(cs.filter(c => c.dis).every(c => /超過 20 字/.test(c.txt)), '灰掉的都標示「超過 20 字」');
    // 勾 3 句並加入
    const boxes = await page.$$('#pickList .pick-card:not(.dis) input');
    for(let i = 0; i < 3; i++) await boxes[i].check();
    ok((await page.$eval('#pickCount', e => e.textContent)) === '已選 3／還可加 50', '計數顯示已選 3／還可加 50', await page.$eval('#pickCount', e => e.textContent));
    await page.click('#pickAddBtn');
    ok(await page.evaluate(() => window.__teacher.ED.sentences.length) === 3, '加入 3 句');
    ok(/已加入 3 句/.test(await status(page)), '訊息：已加入 3 句', await status(page));
    ok(await page.$eval('#dirtyMark', e => !e.hidden), '標記為尚未上傳');
    cs = await cards(page);
    ok(cs.filter(c => /已在句庫裡/.test(c.txt)).length === 3, '已加入的 3 句變成「已在句庫裡」且灰掉');
    // 加入的資料不帶 rand 等多餘欄位
    const keys = await page.evaluate(() => Object.keys(window.__teacher.ED.sentences[0]).sort().join(','));
    ok(keys === 'en,es,pinyin,simp,trad', '複製進題庫的欄位乾淨', keys);
    // 載入更多到上限
    for(let i = 0; i < 8; i++){
      const hidden = await page.$eval('#pickMoreBtn', e => e.hidden);
      if(hidden) break;
      await page.click('#pickMoreBtn');
      await page.waitForFunction(() => !document.querySelector('#pickStatus').textContent.includes('載入中'));
    }
    const r2 = await readsOf(page, 'corre-d16da');
    ok(r2 === 100, '讀取總量封頂在 100 筆', r2);
    ok(await page.$eval('#pickMoreBtn', e => e.hidden), '到上限後「載入更多」消失');
    ok(/最多載入 100 句/.test(await status(page)) || /已加入/.test(await status(page)), '有顯示上限提示或前次訊息', await status(page));
    cs = await cards(page);
    const txts = cs.map(c => c.txt.split('\n')[0]);
    ok(new Set(txts).size === txts.length, '重複的句子只顯示一次');
    // 篩選
    await page.fill('#pickFilter', 'es5');
    cs = await cards(page);
    ok(cs.length > 0 && cs.every(c => /es5/.test(c.txt)), '關鍵字篩選有效', cs.length);
    await page.fill('#pickFilter', 'zzzz-no-match');
    ok((await page.$eval('#pickList', e => e.innerText)).includes('沒有符合的句子'), '沒有結果時顯示提示');
    await page.fill('#pickFilter', '');
    // 容量：免費上限 50；先把 ED 填到 49，再選 2 句應被擋
    await page.evaluate(() => { const E = window.__teacher.ED; while(E.sentences.length < 49) E.sentences.push({ trad: ['填' + E.sentences.length, 'x'], simp: ['填', 'x'], pinyin: ['a', 'b'], es: 'e', en: '' }); });
    await page.click('#pickSrcGroup [data-value=pool]'); await page.click('#pickSrcGroup [data-value=pool]');   // 收合再展開以重繪
    await page.waitForSelector('#pickList .pick-card');
    const b2 = await page.$$('#pickList .pick-card:not(.dis) input');
    await b2[0].check(); await b2[1].click();
    ok(!(await b2[1].isChecked()), '超過剩餘空位時第 2 個勾選被擋');
    ok(/最多還能再選 1 句/.test(await status(page)), '提示最多還能再選 1 句', await status(page));
    await page.click('#pickAddBtn');
    ok(await page.evaluate(() => window.__teacher.ED.sentences.length) === 50, '加到剛好 50 句');
    const b3 = await page.$$('#pickList .pick-card:not(.dis) input');
    if(b3.length) await b3[0].click();
    ok(/句庫已滿（50 句）/.test(await status(page)), '已滿時顯示句庫已滿', await status(page));
    // 儲存後資料庫內容
    await page.fill('#bankName', 'T1');
    await page.click('#saveBankBtn');
    await page.waitForFunction(() => document.querySelector('#saveStatus').textContent.includes('已上傳'));
    const saved = await page.evaluate(() => { const d = window.__DB['subscription-48d3c'].shared_banks; const k = Object.keys(d)[0]; return d[k]; });
    ok(saved.sentences.length === 50 && saved.pro === false, '免費版 50 句可上傳（非 pro）', { n: saved.sentences.length, pro: saved.pro });
    // 主題包：免費版顯示需訂閱
    const centralBefore = await page.evaluate(() => Object.keys(window.__reads).join());
    await page.click('#pickSrcGroup [data-value=pack]');
    const t = await page.$eval('#pickList', e => e.innerText);
    ok(/主題包是訂閱版功能/.test(t), '免費版點主題包：顯示需訂閱提示');
    ok(await page.$eval('#pickAddBtn', e => e.hidden) && await page.$eval('#pickAllBtn', e => e.hidden) && await page.$eval('#pickFilter', e => e.hidden), '免費版隱藏加入／篩選控制項');
    ok(await page.$eval('#pickList a', e => /wangchiapin/.test(e.href)), '有「了解訂閱」連結');
    ok(errors.filter(e => !/Failed to load resource|net::ERR/.test(e)).length === 0, '沒有 JS 錯誤', errors);
    await ctx.close();
  }

  console.log('\n[B] 訂閱教師：主題包');
  {
    const { page, errors, ctx } = await open(browser, { pro: true });
    await openEditor(page);
    await page.click('#pickSrcGroup [data-value=pack]');
    await page.waitForSelector('#packSel option', { state: 'attached' });
    const opts = await page.$$eval('#packSel option', o => o.map(x => x.textContent));
    ok(opts.length === 2, '只列出 corre_pack_ 開頭的 2 個主題包（not_a_pack 被排除）', opts);
    ok(opts[0].startsWith('點飲料') && opts[1].startsWith('大包'), '依 order 排序', opts);
    ok((await page.$eval('#packDesc', e => e.textContent)) === '飲料店用語', '顯示主題包說明');
    let cs = await cards(page);
    ok(cs.length === 5, '小包 5 句都列出', cs.length);
    ok(cs.filter(c => c.dis).length === 1, '先只有太長的 1 句灰掉', cs.filter(c => c.dis).length);
    // 先從公開題庫加入題庫第 1 句（sent(1)），讓主題包裡那句變成重複
    await page.click('#pickSrcGroup [data-value=pool]');
    await page.waitForSelector('#pickList .pick-card');
    await page.fill('#pickFilter', 'es1');
    const hit = (await page.$$('#pickList .pick-card:not(.dis)')).length;
    // 篩 es1 會有 es1、es10.. 等；只勾 es1 本身
    const all = await page.$$('#pickList .pick-card:not(.dis)');
    let picked = false;
    for(const c of all){ const t = await c.innerText(); if(/\nes1\n/.test('\n' + t.split('\n').join('\n') + '\n')){ await (await c.$('input')).check(); picked = true; break; } }
    if(picked) await page.click('#pickAddBtn');
    await page.fill('#pickFilter', '');
    await page.click('#pickSrcGroup [data-value=pack]');
    await page.waitForSelector('#packSel option', { state: 'attached' });
    cs = await cards(page);
    ok(picked && cs.filter(c => c.dis).length === 2, '與句庫重複的句子也灰掉（共 2 句不可選）', { picked, dis: cs.filter(c => c.dis).length });
    ok(cs.some(c => /已在句庫裡/.test(c.txt)), '標示「已在句庫裡」');
    // 勾選可選的 2 句加入
    const boxes = await page.$$('#pickList .pick-card:not(.dis) input');
    for(const b of boxes) await b.check();
    await page.click('#pickAddBtn');
    const n1 = await page.evaluate(() => window.__teacher.ED.sentences.length);
    ok(n1 === (picked ? 1 : 0) + 3, '加入 3 句可選句子', n1);
    // 切到大包，整包加入到上限 80
    await page.selectOption('#packSel', 'corre_pack_0000000002');
    cs = await cards(page);
    ok(cs.length === 90, '大包 90 句列出', cs.length);
    await page.click('#pickAllBtn');
    const n2 = await page.evaluate(() => window.__teacher.ED.sentences.length);
    ok(n2 === 80, '整包加入到訂閱上限 80 句', n2);
    ok(/句庫已滿（80 句），其餘沒有加入/.test(await status(page)), '訊息提示其餘未加入', await status(page));
    // 滿了之後再按整包加入
    await page.click('#pickAllBtn');
    ok(/句庫已滿（80 句），沒有空位了/.test(await status(page)), '滿了再按顯示沒有空位', await status(page));
    ok(await page.$eval('#counter', e => e.textContent) === '(80 / 80)', '計數器 80 / 80');
    // 上傳（超過 50 句 → pro）
    await page.fill('#bankName', 'Big');
    await page.click('#saveBankBtn');
    await page.waitForFunction(() => document.querySelector('#saveStatus').textContent.includes('已上傳'));
    const saved = await page.evaluate(() => { const d = window.__DB['subscription-48d3c'].shared_banks; return d[Object.keys(d)[0]]; });
    ok(saved.sentences.length === 80 && saved.pro === true, '訂閱版 80 句可上傳（pro）', { n: saved.sentences.length, pro: saved.pro });
    // 切到公開題庫再回主題包，不應重查主題包
    const rc = await page.evaluate(() => window.__reads['subscription-48d3c']);
    await page.click('#pickSrcGroup [data-value=pool]'); await page.click('#pickSrcGroup [data-value=pack]');
    ok(await page.evaluate(() => window.__reads['subscription-48d3c']) === rc, '主題包只在第一次查詢（有快取）');
    ok(errors.filter(e => !/Failed to load resource|net::ERR/.test(e)).length === 0, '沒有 JS 錯誤', errors);
    await ctx.close();
  }

  console.log('\n[C] 訂閱已過期但 plan 欄位存在 → 視同未訂閱');
  {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.route('**/*', route => { const u = route.request().url(); if(u.startsWith('http://localhost')) return route.continue(); if(/\.js(\?|$)/.test(u) || u.includes('gstatic')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); return route.abort(); });
    const seed = { 'corre-d16da': { mandarinRunnerSentences: poolSeed() }, 'subscription-48d3c': { site_content: packSeed(), site_plans: { u1: { plan: 'year', expiresAt: Date.now() - 86400000 } } } };
    await page.addInitScript('window.__SEED = ' + JSON.stringify(seed) + ';'); await page.addInitScript(MOCK);
    await page.goto(URL); await page.waitForSelector('#viewList:not([hidden])'); await page.waitForFunction(() => document.querySelector('#bankList .bank'));
    await openEditor(page);
    await page.click('#pickSrcGroup [data-value=pack]');
    ok(/主題包是訂閱版功能/.test(await page.$eval('#pickList', e => e.innerText)), '過期者看到需訂閱提示');
    await ctx.close();
  }

  console.log('\n[D] 四語介面');
  {
    const { page, ctx } = await open(browser, { pro: true });
    await openEditor(page);
    await page.click('#pickSrcGroup [data-value=pack]'); await page.waitForSelector('#packSel option', { state: 'attached' });
    const expect = {
      zh: { title: '從題庫／主題包加入', pool: '公開題庫', all: '整包加入（到上限為止）', pack: '點飲料' },
      cn: { title: '从题库／主题包加入', pool: '公开题库', all: '整包加入（到上限为止）', pack: '点饮料' },
      es: { title: 'Añadir desde el banco público / paquetes temáticos', pool: 'Banco público', all: 'Añadir todo el paquete (hasta el límite)', pack: 'Pedir bebidas' },
      en: { title: 'Add from the public pool / theme packs', pool: 'Public pool', all: 'Add the whole pack (up to the limit)', pack: 'Pedir bebidas' }
    };
    for(const l of ['cn', 'es', 'en', 'zh']){
      await page.click('#langs [data-l=' + l + ']');
      const title = await page.$eval('#pickSection h2', e => e.textContent);
      const pool = await page.$eval('#pickSrcGroup [data-value=pool]', e => e.textContent);
      const all = await page.$eval('#pickAllBtn', e => e.textContent);
      const opt = await page.$eval('#packSel option', e => e.textContent);
      ok(title === expect[l].title && pool === expect[l].pool && all === expect[l].all, l + '：標題／按鈕文案正確', { title, pool, all });
      // cn 因測試環境沒載 OpenCC，會退回繁體名稱；其他語言必須對得上
      ok(l === 'cn' ? opt.length > 0 : opt.startsWith(expect[l].pack), l + '：主題包名稱語言正確', opt);
      const raw = await page.$eval('#pickSection', e => e.innerText);
      ok(!/\b(pick|pack)[A-Z][A-Za-z]+\b/.test(raw), l + '：沒有露出未翻譯的 key', raw.match(/\b(pick|pack)[A-Z][A-Za-z]+\b/));
    }
    // 切語言後選取狀態不應被清掉
    await page.click('#langs [data-l=zh]');
    const bs = await page.$$('#pickList .pick-card:not(.dis) input'); await bs[0].check();
    await page.click('#langs [data-l=en]');
    ok(await page.$eval('#pickList .pick-card:not(.dis) input', e => e.checked), '切換語言後勾選狀態保留');
    ok(/Selected 1/.test(await page.$eval('#pickCount', e => e.textContent)), '計數文案隨語言更新', await page.$eval('#pickCount', e => e.textContent));
    await ctx.close();
  }

  // 四語 key 完整性：每種語言的 pick*/pack* key 一致
  console.log('\n[E] i18n key 完整性');
  {
    const src = fs.readFileSync(TEACHER_HTML, 'utf8');
    const langs = {};
    for(const l of ['zh', 'cn', 'es', 'en']){
      const start = src.indexOf('\n    ' + l + ':{');
      const next = ['zh', 'cn', 'es', 'en'].map(x => src.indexOf('\n    ' + x + ':{', start + 5)).filter(i => i > start).sort((a, b) => a - b)[0] || src.indexOf('  let LANG');
      const block = src.slice(start, next);
      langs[l] = new Set((block.match(/\b(pick[A-Z]\w*|pack[A-Z]\w*)\s*:/g) || []).map(s => s.replace(/\s*:$/, '')));
    }
    const base = [...langs.zh].sort().join();
    for(const l of ['cn', 'es', 'en']) ok([...langs[l]].sort().join() === base, l + ' 的 pick*/pack* key 與繁體一致', { missing: [...langs.zh].filter(k => !langs[l].has(k)), extra: [...langs[l]].filter(k => !langs.zh.has(k)) });
    ok(langs.zh.size >= 25, '共有 ' + langs.zh.size + ' 個新 key');
  }


  console.log('\n[F] 常駐訂閱規則說明 + 測試掛鉤已移除');
  {
    const src = fs.readFileSync(TEACHER_HTML, 'utf8');
    ok(!/__teacher/.test(src), '正式檔案不再含 window.__teacher');
    const { page, errors, ctx } = await open(browser, { pro: false });
    const exp = { zh: ['訂閱規則說明', '免費：1 個句庫'], cn: ['订阅规则说明', '免费：1 个句库'], es: ['Reglas de la suscripción', 'Gratis: 1 banco'], en: ['Subscription rules', 'Free: 1 bank'] };
    for(const l of ['cn', 'es', 'en', 'zh']){
      await page.click('#langs [data-l=' + l + ']');
      const title = await page.$eval('.rules', e => e.previousElementSibling.textContent);
      const items = await page.$$eval('.rules li', els => els.map(e => e.textContent));
      ok(title === exp[l][0] && items.length === 5 && items[0].startsWith(exp[l][1]) && items.every(t => t.length > 10), l + '：規則說明 5 條且文案正確', { title, items: items.length });
      ok(await page.$eval('.rules', e => e.offsetParent !== null), l + '：規則說明常駐可見（不需展開）');
    }
    const zh4 = await page.$$eval('.rules li', els => els[3].textContent);
    ok(/不會刪除任何資料/.test(zh4) && /50 句以內/.test(zh4), '到期規則與決策紀錄一致（不自動刪除、第 1 庫 50 句內有效）');
    ok(errors.filter(e => !/Failed to load resource|net::ERR/.test(e)).length === 0, '沒有 JS 錯誤', errors);
    await ctx.close();
  }

  await browser.close();
  console.log('\n結果：通過 ' + pass + '，失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
