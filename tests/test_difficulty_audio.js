// 補測試：難度三檔（簡單／普通／困難）真的改變金幣速度和出金幣間隔、音樂開關、一鍵靜音
// 方法：量金幣在畫面上實際移動的速度（像素／秒）和每一波出現的時間；用假的 AudioContext 記錄背景音樂的振盪器和總音量
// 用法：node tests/run.js（或設定 BASE_URL 後直接執行這個檔）
const H = require('./helpers');
const { ok, KEY, CENTRAL } = H;

const BANK = 'bank0000dddd';
const SEED = { [CENTRAL]: { shared_banks: { [BANK]: { owner: 'u1', slot: 0, name: '困難班', speed: 'dificil', script: 'trad', boss: false, phonetic: 'pinyin', pro: true, updatedAt: 1,
  sentences: [{ trad: ['我', '要', '紅茶'], simp: ['我', '要', '红茶'], pinyin: ['wǒ', 'yào', 'hóng chá'], es: 'Quiero té negro.', en: 'I want black tea.' }] } } } };
const S = (o) => JSON.stringify(Object.assign({ v: 1, script: 'trad', lang: 'es', phon: 'pinyin', rate: 'normal' }, o));

// 開始前先掛好觀察器，記錄每個金幣加進畫面的時間；開始後量第一個金幣的移動速度和第 1、2 波的間隔
async function measure(page){
  await page.evaluate(() => {
    window.__ct = [];
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if(n.classList && n.classList.contains('coin')) window.__ct.push(performance.now()); })))
      .observe(document.getElementById('track'), { childList: true });
  });
  await page.click('#startBtn');
  const tClick = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => window.__ct.length > 0, null, { timeout: 8000 });
  // 第一個金幣離玩家還很遠的時候量速度（0.7 秒內它不會被吃到）
  const sp = await page.evaluate(() => new Promise(res => {
    const c = document.querySelector('#track .coin');
    const x = () => parseFloat((c.style.translate || '0').split('px')[0]);
    const x1 = x(), t1 = performance.now();
    setTimeout(() => res({ speed: (x1 - x()) / ((performance.now() - t1) / 1000) }), 700);
  }));
  // 等到出現第 3 波，取前兩個間隔中較短的那個（電腦偶爾卡一下只會讓間隔變長，不會變短）
  const waves = ct => ct.reduce((w, t) => { if(!w.length || t - w[w.length - 1] > 300) w.push(t); return w; }, []);
  await page.waitForFunction(ct0 => { const w = []; window.__ct.forEach(t => { if(!w.length || t - w[w.length - 1] > 300) w.push(t); }); return w.length >= 3; }, 0, { timeout: 12000 });
  const w = waves(await page.evaluate(() => window.__ct));
  return { speed: sp.speed, first: w[0] - tClick, interval: Math.min(w[1] - w[0], w[2] - w[1]) };
}
const squares = page => page.evaluate(() => window.__osc.filter(o => o.type === 'square').length);
const pads = page => page.evaluate(() => window.__osc.filter(o => o.type === 'sawtooth' && o.frequency.value < 120).map(o => !!o.__stopNow));
const master = page => page.evaluate(() => (window.__masters || []).map(g => g.gain.value));

(async () => {
  const browser = await H.launch();

  console.log('\n[1] 難度按鈕：簡單／普通／困難，預設普通，選了會亮起來');
  { const { page, ctx } = await H.open(browser);
    ok(await page.$$eval('#diffGroup .toggle-btn', b => b.map(x => x.dataset.value).join(',')) === 'facil,normal,dificil', '三個按鈕：facil、normal、dificil');
    ok((await H.txt(page, '#diffGroup [data-value=facil]')) === '簡單 Fácil' && (await H.txt(page, '#diffGroup [data-value=normal]')) === '普通 Normal' && (await H.txt(page, '#diffGroup [data-value=dificil]')) === '困難 Difícil', '按鈕文字：簡單／普通／困難（雙行）');
    ok((await page.$eval('#diffGroup .active', e => e.dataset.value)) === 'normal', '預設是普通');
    for(const v of ['facil', 'dificil', 'normal']){
      await page.click('#diffGroup [data-value=' + v + ']');
      ok((await page.$$eval('#diffGroup .active', e => e.map(x => x.dataset.value))).join() === v, '點「' + v + '」→ 只有它亮起來');
    }
    await page.click('#diffGroup [data-value=dificil]');
    await H.start(page);
    await H.quit(page);
    await page.click('#menuBtn');
    ok((await page.$eval('#diffGroup .active', e => e.dataset.value)) === 'dificil', '玩完回主選單，難度還停在上次選的困難');
    await ctx.close(); }
  { const { page, ctx } = await H.open(browser, { ls: { [KEY]: S({ script: 'simp' }) } });
    ok((await H.txt(page, '#diffGroup [data-value=facil]')) === '简单 Fácil' && (await H.txt(page, '#diffGroup [data-value=dificil]')) === '困难 Difícil', '簡體字形：按鈕變「简单／困难」');
    await ctx.close(); }

  console.log('\n[2] 三檔難度真的不一樣：金幣移動速度（px/秒）和出金幣的間隔');
  const got = {};
  for(const [v, spd, itv] of [['facil', 95, 2000], ['normal', 135, 1750], ['dificil', 185, 1500]]){
    const { page, ctx, errors } = await H.open(browser);
    await page.click('#diffGroup [data-value=' + v + ']');
    const m = await measure(page);
    got[v] = m;
    ok(Math.abs(m.speed - spd) <= 12, v + '：金幣實際速度約 ' + spd + ' px/秒', Math.round(m.speed));
    ok(m.interval >= itv - 80 && m.interval <= itv + 130, v + '：每波金幣間隔約 ' + itv + ' 毫秒', Math.round(m.interval));
    ok(m.first >= itv - 100 && m.first <= itv + 300, v + '：開始後約 ' + itv + ' 毫秒出現第一波', Math.round(m.first));
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close();
  }
  ok(got.facil.speed < got.normal.speed && got.normal.speed < got.dificil.speed, '速度：簡單 < 普通 < 困難', [got.facil, got.normal, got.dificil].map(x => Math.round(x.speed)));
  ok(got.facil.interval > got.normal.interval && got.normal.interval > got.dificil.interval, '間隔：簡單 > 普通 > 困難（越難金幣越密）', [got.facil, got.normal, got.dificil].map(x => Math.round(x.interval)));

  console.log('\n[3] 老師句庫指定困難：難度選項隱藏，速度就是困難的速度');
  { const { page, ctx } = await H.open(browser, { qs: '?bank=' + BANK, seed: SEED });
    ok(await page.$eval('#diffGroup', e => e.parentElement.hidden), '老師句庫：不顯示難度選項');
    const m = await measure(page);
    ok(Math.abs(m.speed - 185) <= 12 && m.interval >= 1420 && m.interval <= 1630, '老師設困難 → 金幣約 185 px/秒、間隔約 1500 毫秒', { speed: Math.round(m.speed), interval: Math.round(m.interval) });
    await ctx.close(); }

  console.log('\n[4] 背景音樂開關（🎵）');
  { const { page, ctx, errors } = await H.open(browser);
    ok(await page.$eval('#musicToggle', e => e.classList.contains('on')), '一開始音樂開關是亮的（開）');
    await H.start(page);
    await H.settle(1300);
    const a1 = await squares(page);
    ok(a1 >= 3, '音樂開著：琶音振盪器一直產生（1.3 秒內 ≥ 3 個）', a1);
    ok((await pads(page)).length === 2 && (await pads(page)).every(x => !x), '背景低音有 2 個振盪器正在跑');
    await H.settle(1000);
    const a2 = await squares(page);
    ok(a2 >= a1 + 2, '再過 1 秒，琶音還在增加', [a1, a2]);

    await page.click('#musicToggle');
    ok(!(await page.$eval('#musicToggle', e => e.classList.contains('on'))), '按下去 → 開關熄掉');
    await H.settle(600);
    const b1 = await squares(page);
    await H.settle(1300);
    const b2 = await squares(page);
    ok(b1 === b2, '音樂關掉後，琶音不再產生新的聲音（1.3 秒內都沒有）', [b1, b2]);
    ok((await pads(page)).every(x => x), '背景低音的振盪器真的被停掉（不是只調小音量）', await pads(page));

    await page.click('#musicToggle');
    ok(await page.$eval('#musicToggle', e => e.classList.contains('on')), '再按 → 開關亮起來');
    await H.settle(1300);
    const c1 = await squares(page);
    ok(c1 >= b2 + 3, '重新打開後琶音又開始產生', [b2, c1]);
    ok((await pads(page)).length === 4 && (await pads(page)).slice(2).every(x => !x), '低音重新建立新的振盪器');

    // 暫停時音樂不該繼續產生新的音
    await page.click('#pauseBtn'); await H.settle(400);
    const p1 = await squares(page);
    await H.settle(1200);
    const p2 = await squares(page);
    ok(p1 === p2, '暫停中：琶音不再產生', [p1, p2]);
    await page.click('#resumeBtn'); await H.settle(1200);
    ok((await squares(page)) >= p2 + 2, '按繼續 → 琶音又開始');

    // 關掉音樂 → 結束 → 再玩一次，仍然是關的
    await page.click('#musicToggle'); await H.settle(500);
    await H.quit(page);
    await page.click('#restartBtn');
    await page.waitForFunction(() => document.querySelectorAll('#sentence-track .slot').length > 0);
    const r1 = await squares(page);
    await H.settle(1300);
    ok((await squares(page)) === r1 && !(await page.$eval('#musicToggle', e => e.classList.contains('on'))), '關掉音樂後「再玩一次」：音樂維持關閉，沒有新的琶音', [r1, await squares(page)]);
    await page.click('#musicToggle'); await H.settle(1200);
    ok((await squares(page)) >= r1 + 2, '在新的一局把音樂打開 → 有聲音');

    // 遊戲結束：音樂停止
    await H.quit(page); await H.settle(600);
    const e1 = await squares(page);
    await H.settle(1200);
    ok((await squares(page)) === e1, '遊戲結束後音樂停止', [e1, await squares(page)]);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { const { page, ctx } = await H.open(browser, { qs: '?nomusic=1' });
    ok(!(await page.$eval('#musicToggle', e => e.classList.contains('on'))), '?nomusic=1：開關一開始就是關的');
    await H.start(page); await H.settle(1300);
    ok((await squares(page)) === 0, '?nomusic=1：整局都沒有琶音');
    await page.click('#musicToggle'); await H.settle(1200);
    ok((await squares(page)) >= 2, '?nomusic=1：手動打開之後有聲音');
    await ctx.close(); }

  console.log('\n[5] 一鍵靜音（左下角 🔊／🔇）：總音量歸零、記住、不影響念字');
  { const { page, ctx, errors } = await H.open(browser);
    ok((await H.txt(page, '#hgMute')) === '🔊' && (await page.$eval('#hgMute', e => e.getAttribute('aria-pressed'))) === 'false', '一開始是 🔊（沒靜音）');
    await page.click('#diffGroup [data-value=facil]');
    await H.start(page);
    await H.settle(700);
    ok((await master(page))[0] === 1, '沒靜音：總音量是 1', await master(page));
    await page.click('#hgMute');
    ok((await H.txt(page, '#hgMute')) === '🔇' && (await page.$eval('#hgMute', e => e.getAttribute('aria-pressed'))) === 'true', '按下去 → 變 🔇、aria-pressed=true');
    ok(await page.evaluate(() => localStorage.getItem('hg.mute.corre')) === '1', '靜音狀態存進 localStorage（hg.mute.corre=1）');
    await page.waitForFunction(() => window.__masters && window.__masters.length && window.__masters.every(g => g.gain.value === 0), null, { timeout: 3000 }).catch(() => {});
    ok((await master(page)).every(v => v === 0), '靜音：所有聲音經過的總音量是 0', await master(page));
    ok(await page.$eval('#pauseOverlay', e => e.classList.contains('hidden')), '按靜音鈕不會讓遊戲暫停或誤觸遊戲區');
    // 靜音只關音樂和音效，念字的語音要照常
    const n0 = await page.evaluate(() => window.__spoken.length);
    await H.botPlay(page, s => s.nSpoken > n0, { timeout: 45000, spd: 95 });
    ok((await page.evaluate(() => window.__spoken.length)) > n0, '靜音中吃到金幣，字還是照常念出來');
    await page.click('#hgMute');
    ok((await H.txt(page, '#hgMute')) === '🔊' && await page.evaluate(() => localStorage.getItem('hg.mute.corre')) === '0', '再按 → 回到 🔊、存成 0');
    await page.waitForFunction(() => window.__masters.every(g => g.gain.value === 1), null, { timeout: 3000 }).catch(() => {});
    ok((await master(page)).every(v => v === 1), '取消靜音：總音量回到 1', await master(page));
    // 記住：靜音後重新整理，新的一局音量一開始就是 0
    await page.click('#hgMute');
    await page.reload(); await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    ok((await H.txt(page, '#hgMute')) === '🔇', '重新整理後按鈕還是 🔇（記住了）');
    await H.start(page); await H.settle(700);
    ok((await master(page)).length > 0 && (await master(page)).every(v => v === 0), '重新整理後開新的一局：音量從頭就是 0', await master(page));
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  await browser.close();
  process.exit(H.result());
})();
