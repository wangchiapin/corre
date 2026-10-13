let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs');
const MOCK = fs.readFileSync(__dirname + '/firebase-mock.js', 'utf8');
const ch = i => String.fromCharCode(0x4e00 + (i % 20000));
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext()).newPage();
  await page.route('**/*', r => { const u = r.request().url(); if(u.startsWith('http://localhost')) return r.continue(); if(/\.js(\?|$)/.test(u) || u.includes('gstatic')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); return r.abort(); });
  const pool = {};
  for(let i = 0; i < 30; i++){ const t = [ch(i), ch(7000 + i)]; pool['p' + String(i).padStart(2, '0')] = { trad: t, simp: t, pinyin: ['a', 'b'], es: 'es' + i, en: '', rand: (i + 0.5) / 30 }; }
  await page.addInitScript('Math.random = () => 0.9;');            // 起點在 27/30 之後，只剩 3 筆，必須繞回
  await page.addInitScript('window.__SEED=' + JSON.stringify({ 'corre-d16da': { mandarinRunnerSentences: pool } }) + ';');
  await page.addInitScript(MOCK);
  await page.goto((process.env.BASE_URL || 'http://localhost:8765') + '/teacher/index.html');
  await page.waitForFunction(() => document.querySelector('#bankList .bank'));
  await page.click('#bankList .bank >> text=＋ 建立句庫');
  await page.click('#pickSrcGroup [data-value=pool]');
  await page.waitForSelector('#pickList .pick-card');
  await page.waitForFunction(() => !document.querySelector('#pickStatus').textContent.includes('載入中'));
  const n1 = (await page.$$('#pickList .pick-card')).length;
  const names = await page.$$eval('#pickList .pick-card .es', e => e.map(x => x.textContent));
  console.log('第一頁張數', n1, '| 前 3', names.slice(0, 3).join(','), '| 繞回後', names.slice(3, 6).join(','));
  console.log('讀取數', await page.evaluate(() => window.__reads['corre-d16da']), '| 載入更多按鈕隱藏', await page.$eval('#pickMoreBtn', e => e.hidden));
  const ok = n1 === 20 && names[0] === 'es27' && names[3] === 'es0';
  console.log(ok ? 'PASS 繞回開頭補滿 20 筆，且沒有重複' : 'FAIL', new Set(names).size === names.length ? '(無重複)' : '(有重複!)');
  await b.close(); process.exit(ok ? 0 : 1);
})();
