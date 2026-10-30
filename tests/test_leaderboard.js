// 補測試：排行榜內容——上傳什麼、顯示什麼、怎麼排序（以前只測班級排行榜「有沒有列到某人」）
// 公開排行榜（mandarinRunnerScores）：只列同一個等級、分數高到低、最多 10 筆、名字當純文字；班級排行榜：只列同一個句庫
// 用法：node tests/run.js（或設定 BASE_URL 後直接執行這個檔）
const H = require('./helpers');
const { ok, KEY, CENTRAL, PUBLIC } = H;

const CID = 'class0000aaaa', CID2 = 'class0000bbbb', BANK = 'bank0000cccc';
const row = (name, score, o = {}) => Object.assign({ name, score, sentences: Math.floor(score / 40), difficulty: 'normal', script: 'trad', level: 'A1', ts: 1 }, o);
const mk = (rows) => { const o = {}; rows.forEach((r, i) => { o['s' + (i + 1000)] = r; }); return o; };
const S = (o) => JSON.stringify(Object.assign({ v: 1, script: 'trad', lang: 'es', phon: 'pinyin', rate: 'normal' }, o));

// 大名單：12 個 A1（故意亂序）、3 個 A2、1 個沒有 level 的舊資料、1 個名字像 HTML 的 A1
const BIG = [
  row('R07', 700, { sentences: 3, difficulty: 'facil' }), row('R01', 1200, { sentences: 7, difficulty: 'dificil' }), row('R12', 100), row('R05', 800), row('R03', 1000, { difficulty: 'facil' }),
  row('R10', 300), row('R02', 1100), row('R08', 600), row('R11', 200, { difficulty: 'dificil' }), row('R04', 900), row('R06', 750), row('R09', 400),
  row('A2a', 480, { level: 'A2', difficulty: 'dificil', sentences: 9 }), row('A2b', 950, { level: 'A2' }), row('A2c', 20, { level: 'A2', difficulty: 'facil' }),
  { name: 'Legacy', score: 9999, sentences: 50, difficulty: 'normal', script: 'trad', ts: 1 },
  row('<img src=x onerror=window.__xss=1>', 650)
];
const SMALL = [row('Top', 300), row('Mid', 120, { difficulty: 'dificil' }), row('Low', 60, { difficulty: 'facil' }), row('Tiny', 5), row('Other', 999, { level: 'A2' })];
const BANK_DOC = { owner: 'u1', slot: 0, name: '老師題庫', speed: 'facil', script: 'trad', boss: false, phonetic: 'pinyin', pro: true, updatedAt: 1,
  sentences: [{ trad: ['我', '要', '紅茶'], simp: ['我', '要', '红茶'], pinyin: ['wǒ', 'yào', 'hóng chá'], es: 'Quiero té negro.', en: 'I want black tea.' }] };
const cs = (cid, k, nick, best, sent, diff, game = 'corre') => ({ cid, owner: 'u1', game, k, h: nick.toLowerCase().padEnd(16, '0').slice(0, 16), nick, best, plays: 1, lastAt: 1, extra: { sent, diff } });
const seed = (pub) => ({
  [PUBLIC]: { mandarinRunnerScores: mk(pub) },
  [CENTRAL]: {
    shared_banks: { [BANK]: BANK_DOC },
    classes: { [CID]: { owner: 'u1', slot: 0, name: '不公開班', showBoard: false, updatedAt: 1 }, [CID2]: { owner: 'u1', slot: 1, name: '公開班', showBoard: true, updatedAt: 1 } },
    class_scores: {
      a1: cs(CID2, 'pool-A1', 'Amy', 90, 5, 'dificil'), a2: cs(CID2, 'pool-A1', 'Bea', 40, 2, 'normal'), a3: cs(CID2, 'pool-A1', 'Cy', 70, 3, 'facil'),
      b1: cs(CID2, 'pool-A2', 'Dan', 500, 9, 'normal'), b2: cs(CID2, 'pool-A1', 'Eve', 800, 9, 'normal', 'color'), b3: cs(CID, 'pool-A1', 'Fay', 600, 9, 'normal')
    }
  }
});

const rowsOf = (page, sel) => page.$$eval(sel + ' .lb-row', es => es.map(e => ({
  rank: e.querySelector('.lb-rank').textContent, name: e.querySelector('.lb-name').textContent, diff: e.querySelector('.lb-diff').textContent,
  sent: e.querySelector('.lb-sent').textContent, score: +e.querySelector('.lb-score').textContent
})));
const pubDocs = page => page.evaluate(() => Object.values(window.__DB['corre-d16da'].mandarinRunnerScores || {}));
const waitRows = (page, sel, n = 1) => page.waitForFunction(([s, n]) => document.querySelectorAll(s + ' .lb-row').length >= n, [sel, n], { timeout: 8000 });
const desc = a => a.every((v, i) => i === 0 || a[i - 1] >= v);
// 玩一局到結束；earn>0 就用機器人賺到至少這個分數再結束
async function play(page, { name, earn = 0 } = {}){
  if(name !== undefined){ await page.fill('#nameInput', ''); if(name) await page.fill('#nameInput', name); }
  await page.click('#startBtn');
  await page.waitForFunction(() => document.querySelectorAll('#sentence-track .slot').length > 0);
  if(earn) await H.botPlay(page, s => s.score >= earn, { timeout: 60000, spd: 95 });
  await H.quit(page);
}

(async () => {
  const browser = await H.launch();

  console.log('\n[1] 公開排行榜（開始畫面 🏆）：只列這個等級、分數由高到低、最多 10 筆');
  { const { page, ctx, errors } = await H.open(browser, { seed: seed(BIG) });
    await page.click('#showLbBtn');
    ok(!(await page.$eval('#lbOverlay', e => e.classList.contains('hidden'))), '按 🏆 → 排行榜視窗打開');
    await waitRows(page, '#lbListMain', 10);
    const rows = await rowsOf(page, '#lbListMain');
    const a1 = BIG.filter(r => r.level === 'A1').map(r => r.score).sort((a, b) => b - a).slice(0, 10);
    ok(rows.length === 10, '12+ 筆 A1 成績只列前 10 筆', rows.length);
    ok(rows.map(r => r.rank).join() === '1,2,3,4,5,6,7,8,9,10', '名次欄是 1～10');
    ok(JSON.stringify(rows.map(r => r.score)) === JSON.stringify(a1) && desc(rows.map(r => r.score)), '分數正好是 A1 最高的 10 個，由高到低', rows.map(r => r.score));
    ok(!rows.some(r => /A2|Legacy/.test(r.name)) && !rows.some(r => r.score === 9999 || r.score === 950), '不列 A2 的成績，也不列沒有等級的舊資料');
    ok(rows[0].name === 'R01' && rows[0].diff === '困難' && rows[0].sent === '7句' && rows[0].score === 1200, '第一名那列：名字 R01、難度「困難」、「7句」、1200', rows[0]);
    ok(rows[2].name === 'R03' && rows[2].diff === '簡單', '第三名 R03 是簡單難度 → 顯示「簡單」', rows[2]);
    ok(rows[1].diff === '普通', '一般難度顯示「普通」', rows[1]);
    ok((await H.txt(page, '#lbLvlMain')) === '· A1', '標題旁標示等級「· A1」');
    ok(rows.some(r => r.name === '<img src=x onerror=window.__xss=1>') && (await page.$$eval('#lbListMain img', e => e.length)) === 0, '名字像 HTML 的成績，整串字原樣顯示成文字（沒有變成圖片標籤）');
    ok(await page.evaluate(() => window.__xss === undefined), '名字裡的 onerror 沒有被執行');
    await page.click('#lbCloseBtn');
    ok(await page.$eval('#lbOverlay', e => e.classList.contains('hidden')), '按關閉 → 視窗收起來');
    // 切到 A2：只列 A2
    await page.click('#levelGroup [data-value=A2]');
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.click('#showLbBtn'); await waitRows(page, '#lbListMain', 3);
    const r2 = await rowsOf(page, '#lbListMain');
    ok(r2.map(r => r.name).join() === 'A2b,A2a,A2c' && r2.map(r => r.score).join() === '950,480,20', '切到 A2：只列 A2 的 3 筆，高到低（950、480、20）', r2);
    ok((await H.txt(page, '#lbLvlMain')) === '· A2', '標題旁變成「· A2」');
    ok(r2[1].diff === '困難' && r2[1].sent === '9句', 'A2 第二名：困難、9句', r2[1]);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[2] 排行榜是空的／Firebase 讀不到時的訊息');
  { const { page, ctx } = await H.open(browser, { seed: seed([]) });
    await page.click('#showLbBtn');
    await page.waitForFunction(() => document.querySelector('#lbListMain .lb-msg') && !/載入中/.test(document.querySelector('#lbListMain .lb-msg').textContent), null, { timeout: 5000 });
    ok((await H.txt(page, '#lbListMain')) === '還沒有成績，搶第一！ Todavía no hay puntuaciones. ¡Sé el primero!', '沒有成績：顯示「還沒有成績，搶第一！」', await H.txt(page, '#lbListMain'));
    await ctx.close(); }
  { const { page, ctx, errors } = await H.open(browser, { noFirebase: true });
    await page.click('#showLbBtn');
    await page.waitForFunction(() => document.querySelector('#lbListMain .lb-msg') && !/載入中/.test(document.querySelector('#lbListMain .lb-msg').textContent), null, { timeout: 5000 });
    ok((await H.txt(page, '#lbListMain')).startsWith('排行榜暫時無法使用。'), '沒有 Firebase：顯示「排行榜暫時無法使用」', await H.txt(page, '#lbListMain'));
    await page.click('#lbCloseBtn');
    await play(page, { name: 'Solo' });
    await page.waitForFunction(() => document.querySelector('#lbListOver .lb-msg') && !/載入中/.test(document.querySelector('#lbListOver .lb-msg').textContent), null, { timeout: 5000 });
    ok((await H.txt(page, '#lbListOver')).startsWith('排行榜暫時無法使用。') && (await H.txt(page, '#finalScore')) === '0', '沒有 Firebase：結果畫面也只是顯示無法使用，遊戲照常結束');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[3] 玩完上傳：寫進資料庫的內容、結果畫面的排名');
  { const { page, ctx, errors } = await H.open(browser, { seed: seed(SMALL) });
    await page.click('#diffGroup [data-value=facil]');
    await play(page, { name: '  Bot  ', earn: 20 });
    await waitRows(page, '#lbListOver', 5);
    const fs = +(await H.txt(page, '#finalScore')), fn = +(await H.txt(page, '#finalSentences'));
    const mine = (await pubDocs(page)).filter(d => d.name === 'Bot');
    ok(fs >= 20 && mine.length === 1, '機器人賺到 ' + fs + ' 分，資料庫新增 1 筆（名字去掉前後空白）', mine);
    const d = mine[0] || {};
    ok(d.score === fs && d.sentences === fn && d.difficulty === 'facil' && d.script === 'trad' && d.level === 'A1' && typeof d.ts === 'number' && d.ts > 0, '寫入內容：分數＝畫面上的分數、句數、難度 facil、字形 trad、等級 A1、時間戳', d);
    const rows = await rowsOf(page, '#lbListOver');
    const wantRank = 1 + SMALL.filter(r => r.level === 'A1' && r.score > fs).length;
    ok(rows.length === 5 && desc(rows.map(r => r.score)), '結果畫面：這個等級 4 筆舊成績＋這局，共 5 列、分數由高到低', rows);
    ok(rows.findIndex(r => r.name === 'Bot') + 1 === wantRank && rows[wantRank - 1].rank === String(wantRank) && rows[wantRank - 1].score === fs, '這局排在第 ' + wantRank + ' 名，分數與畫面一致', rows[wantRank - 1]);
    ok(rows[wantRank - 1].diff === '簡單' && rows[wantRank - 1].sent === fn + '句', '這一列顯示「簡單」和「' + fn + '句」', rows[wantRank - 1]);
    ok(!rows.some(r => r.name === 'Other'), '別的等級（A2）的 999 分不會出現在 A1 排行裡');
    ok((await H.txt(page, '#lbLvlOver')) === '· A1', '結果畫面排行榜標示「· A1」');

    // 0 分也會上傳；沒填名字用預設「Jugador」；難度、名字長度
    await page.click('#menuBtn');
    await page.click('#diffGroup [data-value=normal]');
    await play(page, { name: '' });
    await waitRows(page, '#lbListOver', 6);
    let docs = await pubDocs(page);
    ok(docs.some(x => x.name === 'Jugador' && x.score === 0 && x.sentences === 0 && x.difficulty === 'normal'), '沒填名字、0 分：照樣上傳，名字用預設「Jugador」，難度 normal', docs.slice(-1));
    const last = await rowsOf(page, '#lbListOver');
    ok(last[last.length - 1].name === 'Jugador' && last[last.length - 1].score === 0 && last[last.length - 1].diff === '普通', '0 分排在最後一名，顯示「普通」', last[last.length - 1]);
    await page.click('#menuBtn');
    await page.click('#diffGroup [data-value=dificil]');
    await page.fill('#nameInput', '');
    await page.click('#nameInput'); await page.keyboard.type('ABCDEFGHIJKLMNOPQRST');
    await play(page);
    docs = await pubDocs(page);
    ok(docs.some(x => x.name === 'ABCDEFGHIJKLMNOP' && x.difficulty === 'dificil'), '名字最多 16 個字（輸入 20 個字只存前 16 個），難度 dificil 照實記錄', docs.map(x => x.name).filter(n => /^ABC/.test(n)));
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[4] 字形、等級、語言跟著成績記錄');
  { const { page, ctx } = await H.open(browser, { seed: seed(SMALL), ls: { [KEY]: S({ script: 'simp', lang: 'zh' }) } });
    await page.click('#diffGroup [data-value=dificil]');
    await play(page, { name: 'Sim' });
    await waitRows(page, '#lbListOver', 5);
    const d = (await pubDocs(page)).find(x => x.name === 'Sim');
    ok(d && d.script === 'simp' && d.difficulty === 'dificil' && d.level === 'A1', '簡體字形 → script=simp', d);
    const r = (await rowsOf(page, '#lbListOver')).find(x => x.name === 'Mid');
    ok(r && r.diff === '困难', '簡體介面：排行榜的難度字樣也是簡體（困难）', r);
    await ctx.close(); }
  { const { page, ctx } = await H.open(browser, { seed: seed(SMALL), ls: { [KEY]: S({ lang: 'zh' }) } });
    await play(page, { name: '' });
    await waitRows(page, '#lbListOver', 5);
    ok((await pubDocs(page)).some(x => x.name === '玩家'), '只有中文介面、沒填名字 → 預設名字「玩家」');
    await ctx.close(); }
  { const { page, ctx } = await H.open(browser, { seed: seed(SMALL) });
    await page.click('#levelGroup [data-value=A2]');
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await play(page, { name: 'Lv2' });
    await waitRows(page, '#lbListOver', 2);
    const d = (await pubDocs(page)).find(x => x.name === 'Lv2');
    ok(d && d.level === 'A2', '選 A2 玩 → level=A2', d);
    const rows = await rowsOf(page, '#lbListOver');
    ok(rows.map(r => r.name).join() === 'Other,Lv2' && (await H.txt(page, '#lbLvlOver')) === '· A2', '結果畫面只列 A2 的成績（Other 999 分在前、這局 0 分在後），標示「· A2」', rows);
    await ctx.close(); }

  console.log('\n[5] 網址指定等級／老師句庫：哪些會上公開排行榜');
  { // ?level=A2：實際上會上傳（等級 A2）
    const { page, ctx } = await H.open(browser, { qs: '?level=A2', seed: seed(SMALL) });
    await play(page, { name: 'UrlA2' });
    await waitRows(page, '#lbListOver', 2);
    const d = (await pubDocs(page)).find(x => x.name === 'UrlA2');
    ok(d && d.level === 'A2' && !(await page.$eval('#lbListOver', e => e.hidden)), '?level=A2：照樣上公開排行榜（level=A2），結果畫面有排行榜', d);
    await ctx.close(); }
  for(const [label, qs] of [['?level=B1', '?level=B1'], ['老師句庫 ?bank=', '?bank=' + BANK]]){
    const { page, ctx } = await H.open(browser, { qs, seed: seed(SMALL) });
    const before = (await pubDocs(page)).length;
    await play(page, { name: 'NoBoard' });
    ok((await pubDocs(page)).length === before && (await pubDocs(page)).every(x => x.name !== 'NoBoard'), label + '：不寫進公開排行榜', before);
    ok(await page.$eval('#lbListOver', e => e.hidden) && await page.$eval('#lbHeadingOver', e => e.hidden), label + '：結果畫面不顯示排行榜');
    await ctx.close();
  }

  console.log('\n[6] 班級排行榜：只列同一個班、同一個句庫，分數高到低；累計成績只升不降');
  { const { page, ctx, errors } = await H.open(browser, { qs: '?class=' + CID2, seed: seed(SMALL) });
    await page.click('#diffGroup [data-value=facil]');
    await play(page, { name: 'Leo' });
    await waitRows(page, '#lbListOver', 4);
    const rows = await rowsOf(page, '#lbListOver');
    ok(rows.map(r => r.name).join() === 'Amy,Cy,Bea,Leo' && rows.map(r => r.score).join() === '90,70,40,0', '班級榜：Amy 90、Cy 70、Bea 40、Leo 0，由高到低（沒有別班、別款遊戲、別的句庫）', rows);
    ok(rows[0].diff === '困難' && rows[0].sent === '5句' && rows[1].diff === '簡單' && rows[1].sent === '3句' && rows[2].diff === '普通', '每列的難度和句數來自當時記下的資料', rows);
    ok((await H.txt(page, '#lbHeadingOver')).includes('班級排行榜'), '標題是「班級排行榜」');
    // 第二局：賺到分數 → best 變成這局分數、plays=2
    await page.click('#restartBtn');
    await page.waitForFunction(() => document.querySelectorAll('#sentence-track .slot').length > 0);
    await H.botPlay(page, s => s.score >= 20, { timeout: 60000, spd: 95 });
    await H.quit(page);
    await page.waitForFunction(() => document.getElementById('classMsg').innerText.includes('成績已回傳'));
    const fs = +(await H.txt(page, '#finalScore'));
    const rec = async () => Object.values(await page.evaluate(() => window.__DB['subscription-48d3c'].class_scores)).filter(v => v.nick.toLowerCase() === 'leo');
    let r = await rec();
    ok(r.length === 1 && r[0].best === fs && r[0].plays === 2 && r[0].extra.diff === 'facil' && fs >= 20, '第二局賺 ' + fs + ' 分：同一筆紀錄 best 更新、plays=2、extra 記下這局難度', r);
    // 第三局：分數比較低 → best 不降、plays=3；暱稱大小寫不同仍算同一個人
    await page.click('#menuBtn');
    await page.fill('#nameInput', 'LEO ');
    await page.click('#startBtn');
    await page.waitForFunction(() => document.querySelectorAll('#sentence-track .slot').length > 0);
    await H.quit(page);
    await page.waitForFunction(() => document.getElementById('classMsg').innerText.includes('成績已回傳'));
    r = await rec();
    ok(r.length === 1 && r[0].best === fs && r[0].plays === 3 && r[0].nick === 'LEO', '第三局 0 分（暱稱換大寫）：仍是同一筆，best 不降（' + fs + '）、plays=3、暱稱更新', r);
    await waitRows(page, '#lbListOver', 4);
    const rows3 = await rowsOf(page, '#lbListOver');
    ok(rows3.find(x => x.name === 'LEO').score === fs && desc(rows3.map(x => x.score)), '班級榜上 LEO 顯示的是最高分 ' + fs, rows3);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { const { page, ctx } = await H.open(browser, { qs: '?class=' + CID, seed: seed(SMALL) });
    await play(page, { name: 'Zoe' });
    await page.waitForFunction(() => document.getElementById('classMsg').innerText.includes('成績已回傳'));
    ok(await page.$eval('#lbListOver', e => e.hidden) && await page.$eval('#lbHeadingOver', e => e.hidden), '老師沒開放排行榜的班級：結果畫面不顯示排行榜');
    await ctx.close(); }

  await browser.close();
  process.exit(H.result());
})();
