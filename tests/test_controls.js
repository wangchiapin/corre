// 補測試：鍵盤（方向鍵、WASD、P／Esc 暫停）、拖曳（滑鼠與手指）、大魔王關卡的 🔊 重聽、下載成績圖片鈕
// 方法：用真的 Playwright 鍵盤、滑鼠、觸控事件操作；大魔王關卡用「會用鍵盤玩的機器人」真的玩到第 6 句
// 用法：node tests/run.js（或設定 BASE_URL 後直接執行這個檔）
const H = require('./helpers');
const { ok, CENTRAL } = H;

const BOSS = 'bank0000bbbb', CID = 'class0000aaaa', CID2 = 'class0000cccc';
const WORDS = [['我', '要'], ['你', '好'], ['他', '來'], ['水', '冷'], ['大', '山'], ['小', '貓'], ['紅', '茶'], ['天', '藍']];
const SENTS = WORDS.map(w => ({ trad: w, simp: w, pinyin: w.map(() => 'yào'), es: '句 ' + w.join(''), en: 's ' + w.join('') }));
const LOOKUP = {}; SENTS.forEach(s => { LOOKUP[s.trad.join('')] = s.trad; });
const SEED = {
  [CENTRAL]: {
    shared_banks: { [BOSS]: { owner: 'u1', slot: 0, name: '魔王測試', speed: 'facil', script: 'trad', boss: true, phonetic: 'pinyin', pro: true, updatedAt: 1, sentences: SENTS } },
    classes: { [CID]: { owner: 'u1', slot: 0, name: '週三班', showBoard: false, updatedAt: 1 } }
  },
  'corre-d16da': { mandarinRunnerScores: {} }
};

const pos = page => page.evaluate(() => { const p = document.getElementById('player'); return { x: parseFloat(p.style.left), y: parseFloat(p.style.top), faceLeft: p.classList.contains('facing-left') }; });
// 按住鍵 ms 毫秒；回傳「頁面自己量到的按住時間（秒）」，用來算該走多遠
async function hold(page, keys, ms){
  keys = [].concat(keys);
  await page.evaluate(() => { window.__kd = {}; window.__dur = null; if(!window.__kRec){ window.__kRec = 1;
    window.addEventListener('keydown', e => { if(!e.repeat && !(e.key in window.__kd)) window.__kd[e.key] = performance.now(); }, true);
    window.addEventListener('keyup', e => { if(window.__dur === null && e.key in window.__kd) window.__dur = (performance.now() - window.__kd[e.key]) / 1000; }, true); } });
  for(const k of keys) await page.keyboard.down(k);
  await H.settle(ms);
  for(const k of keys.slice().reverse()) await page.keyboard.up(k);
  await H.settle(40);
  return page.evaluate(() => window.__dur);
}
const near = (v, want, tol) => Math.abs(v - want) <= tol;
const trackBox = page => page.$eval('#track', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
async function newRound(page){
  await H.quit(page);
  await page.click('#restartBtn');
  await page.waitForFunction(() => document.querySelectorAll('#sentence-track .slot').length > 0);
}

// 用機器人玩到大魔王關卡（最多試 3 次，機器人偶爾會被金幣撞死；那不是遊戲的問題）
async function reachBoss(browser, opts = {}){
  for(let i = 0; i < 3; i++){
    const r = await H.open(browser, { qs: '?bank=' + BOSS, seed: SEED, ...opts });
    await H.start(r.page);
    const s = await H.botPlay(r.page, s => s.boss, { timeout: 120000, lookup: LOOKUP, spd: 95 });
    if(s && s.boss) return r;
    await r.ctx.close();
  }
  throw new Error('機器人試了 3 次都沒玩到大魔王關卡');
}

(async () => {
  const browser = await H.launch();

  console.log('\n[1] 鍵盤：方向鍵移動、放開就停、面向');
  { const { page, ctx, errors } = await H.open(browser);
    await page.click('#diffGroup [data-value=facil]');
    await H.start(page);
    let p0 = await pos(page);
    ok(p0.x === 70 && p0.y === 50, '開局角色在 (70, 50%)', p0);
    let d = await hold(page, 'ArrowRight', 300), p1 = await pos(page);
    ok(near(p1.x - p0.x, 260 * d, 260 * d * 0.2 + 8) && p1.y === p0.y && !p1.faceLeft, '→ 往右走：約 260 px/秒 × ' + d.toFixed(2) + ' 秒，高度不變，面向右', { dx: p1.x - p0.x, d });
    d = await hold(page, 'ArrowLeft', 300); let p2 = await pos(page);
    ok(near(p1.x - p2.x, 260 * d, 260 * d * 0.2 + 8) && p2.faceLeft, '← 往左走，並面向左（facing-left）', { dx: p1.x - p2.x, d });
    d = await hold(page, 'ArrowDown', 300); let p3 = await pos(page);
    ok(near(p3.y - p2.y, 90 * d, 90 * d * 0.2 + 3) && p3.x === p2.x, '↓ 往下：約 90%/秒', { dy: p3.y - p2.y, d });
    d = await hold(page, 'ArrowUp', 300); let p4 = await pos(page);
    ok(near(p3.y - p4.y, 90 * d, 90 * d * 0.2 + 3), '↑ 往上：約 90%/秒', { dy: p3.y - p4.y, d });
    await hold(page, 'ArrowRight', 100);
    ok(!(await pos(page)).faceLeft, '再往右走 → 面向右（facing-left 拿掉）');
    const q1 = await pos(page); await H.settle(300); const q2 = await pos(page);
    ok(q1.x === q2.x && q1.y === q2.y, '放開按鍵後角色停住', [q1, q2]);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[2] 鍵盤：WASD、斜著走、相反方向抵消');
  { const { page, ctx } = await H.open(browser);
    await page.click('#diffGroup [data-value=facil]');
    await H.start(page);
    let p = await pos(page), d = await hold(page, 'd', 300), q = await pos(page);
    ok(q.x > p.x && near(q.x - p.x, 260 * d, 260 * d * 0.2 + 8), 'D 往右', { dx: q.x - p.x });
    p = q; d = await hold(page, 'a', 300); q = await pos(page);
    ok(q.x < p.x && q.faceLeft, 'A 往左', { dx: q.x - p.x });
    p = q; d = await hold(page, 's', 300); q = await pos(page);
    ok(q.y > p.y, 'S 往下', { dy: q.y - p.y });
    p = q; d = await hold(page, 'w', 300); q = await pos(page);
    ok(q.y < p.y, 'W 往上', { dy: q.y - p.y });
    p = q; d = await hold(page, 'W', 200); q = await pos(page);
    ok(q.y < p.y, '大寫 W（開著 Caps Lock）也往上', { dy: q.y - p.y });
    // 斜著走：兩個方向同時按，速度要除以 √2，不會比直走快
    await H.quit(page); await page.click('#restartBtn'); await page.waitForFunction(() => document.querySelectorAll('#sentence-track .slot').length > 0);
    p = await pos(page); d = await hold(page, ['ArrowRight', 'ArrowDown'], 300); q = await pos(page);
    const dx = q.x - p.x, dy = q.y - p.y;
    ok(dx > 0 && dy > 0 && near((dx / 260) / (dy / 90), 1, 0.25), '→＋↓ 斜著走：水平與垂直都有移動，時間比一致', { dx, dy });
    ok(near(dx, 260 * d / Math.SQRT2, 260 * d * 0.12 + 6), '斜走時水平速度約 260/√2（有正規化，不會比直走快）', { dx, expectedStraight: 260 * d });
    // 左右同時按 → 抵消
    p = await pos(page); await hold(page, ['ArrowLeft', 'ArrowRight'], 300); q = await pos(page);
    ok(Math.abs(q.x - p.x) <= 10, '← → 同時按（300 毫秒）：互相抵消，只剩按下瞬間差一格畫面的位移（單按一個方向會走約 78px）', [p.x, q.x]);
    await ctx.close(); }

  console.log('\n[3] 鍵盤：走到邊界會停住（不會跑出畫面）');
  { const { page, ctx } = await H.open(browser);
    await page.click('#diffGroup [data-value=facil]');
    await H.start(page);
    const box = await trackBox(page);
    await hold(page, 'ArrowLeft', 300);
    ok((await pos(page)).x === 24, '往左最多到 x=24', await pos(page));
    await hold(page, 'ArrowRight', 1250);
    ok(near((await pos(page)).x, 0.72 * box.w, 1), '往右最多到畫面寬度的 72%（' + Math.round(0.72 * box.w) + '）', await pos(page));
    await hold(page, 'ArrowUp', 650);
    ok((await pos(page)).y === 8, '往上最多到 8%', await pos(page));
    await hold(page, 'ArrowDown', 1100);
    ok((await pos(page)).y === 92, '往下最多到 92%', await pos(page));
    await ctx.close(); }

  console.log('\n[4] 鍵盤：P／Esc 暫停與繼續，暫停中方向鍵不動');
  { const { page, ctx } = await H.open(browser);
    await page.click('#diffGroup [data-value=facil]');
    await H.start(page);
    const paused = () => page.$eval('#pauseOverlay', e => !e.classList.contains('hidden'));
    await page.keyboard.press('p');
    ok(await paused(), '按 P → 暫停');
    let p = await pos(page); await hold(page, 'ArrowRight', 300);
    ok((await pos(page)).x === p.x, '暫停中按方向鍵：角色不動');
    await page.keyboard.press('P');
    ok(!(await paused()), '再按 P（大寫）→ 繼續');
    p = await pos(page); await hold(page, 'ArrowRight', 200);
    ok((await pos(page)).x > p.x, '繼續後方向鍵又能動');
    await page.keyboard.press('Escape');
    ok(await paused(), '按 Esc → 暫停');
    await page.keyboard.press('Escape');
    ok(!(await paused()), '再按 Esc → 繼續');
    await ctx.close(); }

  console.log('\n[5] 滑鼠拖曳：在遊戲區任何地方按住拖動，角色跟著動（手指移動量 × 1.5）');
  { const { page, ctx, errors } = await H.open(browser);
    await page.click('#diffGroup [data-value=facil]');
    await H.start(page);
    await page.waitForSelector('#track .coin');   // 遊戲每出一波金幣才會重新量一次遊戲區高度；等第一波出現再量拖曳距離
    const b = await trackBox(page), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const drag = async (dx, dy, from) => {
      const [sx, sy] = from || [cx, cy];
      await page.mouse.move(sx, sy); await page.mouse.down();
      await page.mouse.move(sx + dx, sy + dy, { steps: 10 });
      await page.mouse.up();
    };
    let p = await pos(page);
    await drag(40, 0); let q = await pos(page);
    ok(near(q.x - p.x, 60, 3) && q.y === p.y, '往右拖 40px → 角色往右 60px（1.5 倍），高度不變', { dx: q.x - p.x });
    p = q; await drag(-20, 0); q = await pos(page);
    ok(near(p.x - q.x, 30, 3) && q.faceLeft, '往左拖 20px → 往左 30px，面向左', { dx: p.x - q.x });
    p = q; await drag(0, 50); q = await pos(page);
    ok(near(q.y - p.y, 50 * 1.5 / b.h * 100, 0.8) && q.x === p.x, '往下拖 50px → 往下 ' + (50 * 1.5 / b.h * 100).toFixed(1) + '%（跟畫面高度成比例）', { dy: q.y - p.y });
    p = q; await drag(0, -30); q = await pos(page);
    ok(near(p.y - q.y, 30 * 1.5 / b.h * 100, 0.8), '往上拖 30px → 往上', { dy: p.y - q.y });
    p = q; await page.mouse.move(cx, cy); await page.mouse.move(cx + 80, cy + 80, { steps: 5 });
    ok((await pos(page)).x === p.x && (await pos(page)).y === p.y, '沒按住滑鼠、只是移動：角色不動');
    await page.mouse.move(cx, b.y - 25); await page.mouse.down(); await page.mouse.move(cx + 60, b.y - 25, { steps: 5 }); await page.mouse.up();
    ok((await pos(page)).x === p.x, '從遊戲區外面（標題列）開始拖：角色不動');
    // 邊界
    await drag(150, 0, [cx - 60, cy]); await drag(150, 0, [cx - 60, cy]);
    ok(near((await pos(page)).x, 0.72 * b.w, 1), '一直往右拖：停在畫面寬度 72%', await pos(page));
    await drag(150, 0, [cx + 100, cy]); await drag(-150, 0, [cx + 150, cy]); await drag(-150, 0, [cx + 150, cy]); await drag(-100, 0, [cx + 100, cy]);
    ok((await pos(page)).x === 24, '一直往左拖：停在 x=24', await pos(page));
    await drag(0, -200, [cx, cy + 100]); await drag(0, -200, [cx, cy + 100]);
    ok((await pos(page)).y === 8, '一直往上拖：停在 8%', await pos(page));
    await drag(0, 200, [cx, cy - 100]); await drag(0, 200, [cx, cy - 100]); await drag(0, 200, [cx, cy - 100]);
    ok((await pos(page)).y === 92, '一直往下拖：停在 92%', await pos(page));
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[6] 手指拖曳（手機觸控事件）');
  { const { page, ctx, errors } = await H.open(browser, { touch: true });
    await page.click('#diffGroup [data-value=facil]');
    await H.start(page);
    await page.waitForSelector('#track .coin');
    const b = await trackBox(page), cdp = await ctx.newCDPSession(page);
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const swipe = async (dx, dy) => {
      const sx = b.x + b.w / 2, sy = b.y + b.h / 2;
      await tp('touchStart', sx, sy);
      for(let i = 1; i <= 8; i++){ await tp('touchMove', sx + dx * i / 8, sy + dy * i / 8); await H.settle(15); }
      await tp('touchEnd');
    };
    let p = await pos(page);
    await swipe(40, 0); let q = await pos(page);
    ok(near(q.x - p.x, 60, 4), '手指往右滑 40px → 角色往右 60px', { dx: q.x - p.x });
    p = q; await swipe(0, -40); q = await pos(page);
    ok(near(p.y - q.y, 40 * 1.5 / b.h * 100, 0.8), '手指往上滑 40px → 角色往上', { dy: p.y - q.y });
    p = q; await swipe(-60, 0); q = await pos(page);
    ok(near(p.x - q.x, 90, 4) && q.faceLeft, '手指往左滑 60px → 往左 90px，面向左', { dx: p.x - q.x });
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[7] 大魔王關卡：🔊 重聽（機器人真的玩到第 6 句）');
  { const { page, ctx, errors } = await reachBoss(browser);
    const bossN = () => page.evaluate(() => window.__spoken.filter(x => x.text.length === 2).length);   // 這個句庫每句 2 字；吃金幣念的是 1 字
    ok(await page.$eval('#bossBanner', e => getComputedStyle(e).display !== 'none') && await page.$eval('#banner-wrap', e => e.classList.contains('boss-mode')), '第 5 句完成後的下一句是大魔王關卡，橫幅出現');
    ok((await page.$$eval('#sentence-track .slot .hz', e => e.map(x => x.textContent))).join('') === '？？', '大魔王關卡：還沒吃到的字不顯示（？？）');
    await page.waitForFunction(() => window.__spoken.some(x => x.text.length === 2), null, { timeout: 4000 });
    const first = await page.evaluate(() => window.__spoken.filter(x => x.text.length === 2).pop());
    ok(!!LOOKUP[first.text] && first.rate === 0.65 && first.lang === 'zh-TW', '關卡一開始自動念整句（來自這個句庫的一句）', first);
    const n0 = await bossN();
    await H.settle(700);   // 避開 0.5 秒的連按防抖
    await page.click('#replayBtn'); await H.settle(150);
    ok((await bossN()) === n0 + 1, '按 🔊 → 再念一次', [n0, await bossN()]);
    ok((await page.evaluate(() => window.__spoken.filter(x => x.text.length === 2).pop())).text === first.text, '重聽念的是同一句');
    await H.settle(600);
    await page.click('#replayBtn'); await H.settle(60); await page.click('#replayBtn'); await H.settle(150);
    ok((await bossN()) === n0 + 2, '0.5 秒內連按兩次 🔊：只念一次（防抖，不會重疊）', [n0, await bossN()]);
    await H.settle(700);
    await page.click('#replayBtn'); await H.settle(150);
    ok((await bossN()) === n0 + 3, '隔 0.5 秒後再按 → 又念一次', [n0, await bossN()]);
    // 玩完這一關：唸的那句就是畫面上要吃的那句；打敗魔王多一顆愛心上限
    const heartsBefore = await page.$eval('#hearts', e => (e.textContent.match(/♥/g) || []).length);
    const s = await H.botPlay(page, s => !s.boss, { timeout: 60000, lookup: LOOKUP, spd: 95 });
    ok(!s.over && (await H.sentenceText(page)) === first.text, '吃完魔王關的詞後，句子列顯示的就是剛才念的那句', await H.sentenceText(page));
    const heartsAfter = await page.$eval('#hearts', e => (e.textContent.match(/♥/g) || []).length);
    ok(heartsBefore === 3 && heartsAfter === 4, '打敗大魔王 → 愛心上限 3 → 4', [heartsBefore, heartsAfter]);
    ok(await page.$eval('#bossBanner', e => getComputedStyle(e).display === 'none'), '過關後魔王橫幅消失，🔊 不可用');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[8] 下載成績圖片（📥 只在不上排行榜的模式出現）');
  { // 公開頁：有排行榜、沒有下載鈕
    const { page, ctx } = await H.open(browser, { seed: SEED });
    await H.start(page, 'Pub'); await H.quit(page);
    ok(await page.$eval('#dlBtn', e => e.hidden) && !(await page.$eval('#lbListOver', e => e.hidden)), '公開頁：結果畫面有排行榜，沒有下載鈕');
    await ctx.close(); }
  const png = async (page, name) => {
    await H.start(page, name); await H.quit(page);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#dlBtn')]);
    const buf = require('fs').readFileSync(await dl.path());
    return { name: dl.suggestedFilename(), buf };
  };
  const dims = buf => ({ sig: buf.slice(0, 8).toString('hex'), w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
  const pixels = (page, buf) => page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const bg = [...x.getImageData(5, 5, 1, 1).data];
    const count = (x0, y0, w, h, f) => { const d = x.getImageData(x0, y0, w, h).data; let n = 0; for(let i = 0; i < d.length; i += 4) if(f(d[i], d[i + 1], d[i + 2])) n++; return n; };
    return { bg, scoreCyan: count(240, 330, 240, 190, (r, g, bl) => r < 90 && g > 200 && bl > 190), nameWhite: count(150, 215, 420, 60, (r, g, bl) => r > 200 && g > 230 && bl > 230) };
  }, buf.toString('base64'));
  for(const [label, qs, seed] of [['班級連結', '?class=' + CID, SEED], ['老師句庫連結', '?bank=' + BOSS, SEED], ['題包', '?pack=food', SEED]]){
    const { page, ctx, errors } = await H.open(browser, { qs, seed });
    ok(await page.$eval('#dlBtn', e => e.hidden), label + '：玩之前下載鈕是藏起來的');
    const a = await png(page, 'Ana');
    const d1 = dims(a.buf);
    ok(a.name === 'corre-hanzi-score.png', label + '：下載的檔名是 corre-hanzi-score.png', a.name);
    ok(d1.sig === '89504e470d0a1a0a' && d1.w === 720 && d1.h === 900, label + '：是 720×900 的 PNG 圖片', d1);
    const px = await pixels(page, a.buf);
    ok(px.bg[0] === 6 && px.bg[1] === 9 && px.bg[2] === 17 && px.scoreCyan > 500 && px.nameWhite > 150, label + '：圖上有深色底、青色大分數、白色玩家名字', px);
    // 另一個玩家名字 → 圖片內容不同（圖片真的帶著這局的資料）
    await page.click('#menuBtn');
    const b2 = await png(page, 'Bob');
    ok(!a.buf.equals(b2.buf), label + '：換玩家名字 → 下載的圖片內容不同', [a.buf.length, b2.buf.length]);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close();
  }

  await browser.close();
  process.exit(H.result());
})();
