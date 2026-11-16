// 跑吧！漢字：結算畫面「分享成績」＋「從分享進來」記號（ref）
// 測：按鈕位置（再玩一次之後、主選單之前）／樣式／0 分不顯示／一句話（暱稱有無 × 西英中 × 繁簡）／連結／
//     系統分享（成功、玩家關掉、出錯）／複製備案（成功、失敗）／連點只送一次／再玩一次仍可用；
//     ?ref= 進來 → visits、plays 紀錄帶 ref，沒有就不帶，不合格的值忽略，暫存壞掉不出錯
// 用法：node tests/run.js（或設定 BASE_URL 後直接執行這個檔）
const H = require('./helpers');
const { ok, KEY } = H;
const URL_SHARE = 'https://wangchiapin.github.io/corre/?ref=share';
const ST = (script, lang) => ({ [KEY]: JSON.stringify({ v: 1, script, lang, phon: 'pinyin', rate: 'normal' }) });
const STUB = `(m) => {
  window.__shared=[];window.__copied=[];
  const def=(k,v)=>Object.defineProperty(navigator,k,{value:v,configurable:true});
  def('share',(m==='none'||m==='copyfail')?undefined:async d=>{window.__shared.push(d);
    if(m==='abort'){const e=new Error('c');e.name='AbortError';throw e;}
    if(m==='error'){const e=new Error('b');e.name='NotAllowedError';throw e;}});
  def('clipboard',m==='copyfail'?{writeText:async()=>{throw new Error('no');}}:{writeText:async s=>{window.__copied.push(s);}});
  if(m==='copyfail')document.execCommand=()=>false;
}`;
const stub = (page, m) => page.evaluate('(' + STUB + ')(' + JSON.stringify(m) + ')');
// 玩到有分數（吃到第一個字 +10）再結束，進結果畫面
async function playToOver(browser, { script = 'trad', lang = 'es', name = 'Ana', qs = '' } = {}){
  const r = await H.open(browser, { ls: ST(script, lang), qs });
  await H.start(r.page, name);
  await H.botPlay(r.page, s => s.score > 0, { timeout: 60000, spd: 95 });
  await H.quit(r.page);
  return r;
}
const label = page => page.$eval('#shareBtn', e => e.innerText.replace(/\s+/g, ' ').trim());
const recs = page => page.evaluate(() => { const o = { v: [], p: [] }; (window.__hg || []).forEach(x => { if(x[0] === 'visits') o.v.push(x[2]); if(x[0] === 'plays' && x[1] === 'add') o.p.push(x[2]); }); return o; });

(async () => {
  const browser = await H.launch();

  console.log('\n[S1] 按鈕位置、樣式、按下去（系統分享／關掉／出錯／不支援／複製失敗／連點）');
  { const r = await playToOver(browser); const page = r.page;
    const order = await page.$$eval('#overOverlay > button', es => es.filter(e => !e.hidden).map(e => e.id));
    const i = order.indexOf('shareBtn');
    ok(i > 0 && order[i - 1] === 'restartBtn' && order[i + 1] === 'menuBtn', '分享鈕在「再玩一次」之後、「主選單」之前', order);
    ok(await page.$eval('#shareBtn', e => e.classList.contains('ghost') && !e.classList.contains('btn-restart') && getComputedStyle(e).backgroundColor === 'rgba(0, 0, 0, 0)' && parseFloat(getComputedStyle(e).borderTopWidth) >= 1), '空心外框樣式（透明底、有框）');
    ok(await label(page) === '分享成績 Compartir resultado', '按鈕文字', await label(page));
    // 系統分享成功
    await stub(page, 'ok'); await page.click('#shareBtn'); await page.waitForTimeout(250);
    const sh = await page.evaluate(() => window.__shared);
    ok(sh.length === 1 && sh[0].url === URL_SHARE, '系統分享：連結是公開頁加 ?ref=share', sh);
    ok(sh[0] && sh[0].title === '跑吧！漢字 · ¡Corre, caracteres!' && sh[0].text === '¡Soy Ana y saqué 10 puntos en 跑吧！漢字 (¡Corre, caracteres!)! ¿Puedes superarme?', '系統分享：標題與一句話', sh);
    ok((await page.evaluate(() => window.__copied)).length === 0 && await label(page) === '分享成績 Compartir resultado', '成功時不複製、按鈕文字不變');
    // 玩家關掉
    await stub(page, 'abort'); await page.click('#shareBtn'); await page.waitForTimeout(250);
    ok((await page.evaluate(() => window.__copied)).length === 0 && await label(page) === '分享成績 Compartir resultado', '玩家關掉選單：什麼都不做');
    // 出錯 → 複製
    await stub(page, 'error'); await page.click('#shareBtn'); await page.waitForTimeout(250);
    const cp = await page.evaluate(() => window.__copied);
    ok(cp.length === 1 && cp[0].endsWith('\n' + URL_SHARE) && cp[0].includes('10 puntos'), '分享出錯：改複製「一句話＋連結」', cp);
    ok(await label(page) === '已複製，可以貼給朋友 Copiado, ¡pégalo a un amigo!', '顯示已複製', await label(page));
    await page.waitForTimeout(2400);
    ok(await label(page) === '分享成績 Compartir resultado', '2 秒後復原', await label(page));
    // 不支援
    await stub(page, 'none'); await page.click('#shareBtn'); await page.waitForTimeout(250);
    ok((await page.evaluate(() => window.__copied)).length === 1, '不支援分享選單：改複製'); await page.waitForTimeout(2400);
    // 複製也失敗
    await stub(page, 'copyfail'); await page.click('#shareBtn'); await page.waitForTimeout(250);
    ok(await label(page) === '複製失敗 No se pudo copiar', '複製也失敗：顯示失敗', await label(page)); await page.waitForTimeout(2400);
    // 連點
    await stub(page, 'ok');
    await page.evaluate(() => { const b = document.getElementById('shareBtn'); b.click(); b.click(); }); await page.waitForTimeout(250);
    ok((await page.evaluate(() => window.__shared)).length === 1, '連點兩下只送一次');
    // 再玩一次仍可用
    await page.click('#restartBtn');
    await page.waitForFunction(() => document.getElementById('overOverlay').classList.contains('hidden'));
    ok(await page.$$eval('#sentence-track .slot', e => e.length) > 0, '按「再玩一次」仍然正常開新局');
    ok(r.errors.length === 0, '沒有頁面錯誤', r.errors); await r.ctx.close(); }

  console.log('\n[S2] 0 分不顯示');
  { const r = await H.open(browser, {}); await H.start(r.page, 'Ana'); await H.quit(r.page);
    ok(await r.page.$eval('#finalScore', e => e.textContent) === '0' && await H.hidden(r.page, '#shareBtn'), '0 分：看不到分享鈕'); await r.ctx.close(); }

  console.log('\n[S3] 一句話與按鈕文字：語言 × 繁簡 × 暱稱');
  const cases = [
    ['trad', 'es', '', '¡Saqué 10 puntos en 跑吧！漢字 (¡Corre, caracteres!)! ¿Puedes superarme?', '分享成績 Compartir resultado'],
    ['trad', 'en', 'Ana', 'I’m Ana and I scored 10 in 跑吧！漢字 (¡Corre, caracteres!)! Can you beat me?', '分享成績 Share my score'],
    ['trad', 'zh', 'Ana', '我是Ana，在跑吧！漢字拿到 10 分！你能超過我嗎？', '分享成績'],
    ['simp', 'zh', 'Ana', '我是Ana，在跑吧！汉字拿到 10 分！你能超过我吗？', '分享成绩'],
    ['simp', 'en', '', 'I scored 10 in 跑吧！汉字 (¡Corre, caracteres!)! Can you beat me?', '分享成绩 Share my score'],
  ];
  for(const [script, lang, name, want, lab] of cases){
    const r = await playToOver(browser, { script, lang, name });
    await stub(r.page, 'ok'); await r.page.click('#shareBtn'); await r.page.waitForTimeout(250);
    const sh = await r.page.evaluate(() => window.__shared);
    ok(sh[0] && sh[0].text === want, `一句話 ${script}/${lang}/${name ? '有暱稱' : '沒填暱稱'}`, sh);
    ok(await label(r.page) === lab, `按鈕文字 ${script}/${lang}`, await label(r.page)); await r.ctx.close();
  }

  console.log('\n[R] 從分享進來的記號（ref）寫進 visits／plays');
  async function opened(qs, init){
    const r = await H.open(browser, { hgfake: true, qs });
    if(init) await r.page.evaluate(init);
    await H.start(r.page, 'Ana'); await r.page.waitForTimeout(3000);
    r.rec = await recs(r.page); return r;
  }
  { const r = await opened('?ref=share');
    ok(r.rec.v.length === 1 && r.rec.v[0].ref === 'share', '?ref=share：訪客紀錄帶 ref', r.rec.v);
    ok(r.rec.p.length === 1 && r.rec.p[0].ref === 'share', '?ref=share：遊玩紀錄帶 ref', r.rec.p);
    ok(r.errors.length === 0, '沒有頁面錯誤', r.errors); await r.ctx.close(); }
  { const r = await opened('');
    ok(r.rec.v.length === 1 && !('ref' in r.rec.v[0]) && r.rec.p.length === 1 && !('ref' in r.rec.p[0]), '沒有 ref：紀錄不帶 ref 欄位', r.rec); await r.ctx.close(); }
  for(const [q, want] of [['?ref=SHARE', 'share'], ['?ref=Ig_story-1', 'ig_story-1'], ['?ref=' + 'a'.repeat(17), null], ['?ref=', null], ['?ref=a%20b', null], ['?ref=%3Cscript%3E', null], ['?ref=a.b', null]]){
    const r = await opened(q); const v = r.rec.v[0] || {};
    ok(want === null ? !('ref' in v) : v.ref === want, `ref 參數 ${q} → ${want}`, v); await r.ctx.close();
  }
  { const r = await H.open(browser, { hgfake: true });
    await r.page.evaluate(() => sessionStorage.setItem('hg.ref', 'share')); await r.page.reload();
    await r.page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await H.start(r.page, 'Ana'); await r.page.waitForTimeout(3000);
    const rec = await recs(r.page);
    ok(rec.v[0] && rec.v[0].ref === 'share' && rec.p[0] && rec.p[0].ref === 'share', '網址沒有 ref、分頁暫存有 → 也帶', rec); await r.ctx.close(); }
  { const r = await H.open(browser, { hgfake: true, qs: '?ref=share' });
    await r.page.addInitScript("Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked')}})");
    await r.page.reload(); await r.page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await H.start(r.page, 'Ana'); await r.page.waitForTimeout(3000);
    const rec = await recs(r.page);
    ok(rec.v[0] && rec.v[0].ref === 'share' && r.errors.length === 0, '暫存壞掉但網址有 ref：仍帶 ref、不出錯', [rec, r.errors]); await r.ctx.close(); }

  await browser.close();
  process.exit(H.result());
})();
