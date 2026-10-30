// 補測試用的共用工具（檔名不是 test_ 開頭，run.js 不會把它當測試跑）
// 內容：開頁面（擋外網、假 Firebase、假語音會記下念了什麼與語速、假音訊會記下振盪器與總音量）、
//       會「用鍵盤」玩遊戲的小機器人（讀畫面上的金幣位置，按方向鍵移動），給需要真的吃到字的測試用。
let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs');
const MOCK = fs.readFileSync(__dirname + '/firebase-mock.js', 'utf8');
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const KEY = 'hanziGames.settings';
const CENTRAL = 'subscription-48d3c', PUBLIC = 'corre-d16da';

let pass = 0, fail = 0;
function ok(c, name, extra){ if(c){ pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); } }
function result(){ console.log('\n通過 ' + pass + '，失敗 ' + fail); return fail ? 1 : 0; }

const bankFile = L => JSON.parse(fs.readFileSync(__dirname + '/../bank/' + L + '.json', 'utf8')).sentences;
const allBank = () => ['A1', 'A2', 'B1'].flatMap(bankFile);
const packsFile = () => JSON.parse(fs.readFileSync(__dirname + '/../bank/packs.json', 'utf8')).packs;

// 假語音：記下每一次 speak（文字、語速、語言）到 window.__spoken；假音訊：記下建立的振盪器和接到喇叭前的總音量
const SPEECH = `
  window.__spoken = [];
  window.SpeechSynthesisUtterance = function(t){ this.text = t; };
  Object.defineProperty(window, 'speechSynthesis', { value: { speaking:false, pending:false, getVoices:()=>[], cancel(){},
    speak(u){ window.__spoken.push({ text:u.text, rate:u.rate, lang:u.lang }); setTimeout(()=>u.onstart&&u.onstart(),5); setTimeout(()=>u.onend&&u.onend(),20); } } });
`;
const AUDIO = `
  window.__osc = [];
  (function(){
    var BP = window.BaseAudioContext && BaseAudioContext.prototype; if(!BP) return;
    var co = BP.createOscillator;
    BP.createOscillator = function(){ var o = co.apply(this, arguments); window.__osc.push(o); return o; };
    var os = OscillatorNode.prototype.stop;
    OscillatorNode.prototype.stop = function(w){ if(w === undefined) this.__stopNow = true; return os.apply(this, arguments); };
    var oc = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(d){
      try{ if(d instanceof AudioDestinationNode && this instanceof GainNode){ (window.__masters = window.__masters || []).push(this); } }catch(e){}
      return oc.apply(this, arguments);
    };
  })();
`;

async function launch(){ return chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); }

// opts: qs 網址參數、ls 先塞進 localStorage 的東西、seed 假資料庫種子、speech=false 就不裝語音、noFirebase 不裝假 Firebase、
//       touch 觸控裝置、viewport、noWait 不等開始鈕可按
async function open(browser, o = {}){
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 390, height: 844 }, hasTouch: !!o.touch, isMobile: !!o.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.route('**/*', r => {
    const u = r.request().url();
    if(u.startsWith('http://localhost')) return r.continue();
    if(/\.js(\?|$)/.test(u) || u.includes('gstatic')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return r.abort();
  });
  await page.addInitScript('window.__SEED=' + JSON.stringify(o.seed || {}) + ';');
  if(o.ls) await page.addInitScript('try{' + Object.keys(o.ls).map(k => 'localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(o.ls[k]) + ');').join('') + '}catch(e){}');
  if(o.speech !== false) await page.addInitScript(SPEECH);
  await page.addInitScript(AUDIO);
  if(!o.noFirebase) await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html' + (o.qs || ''));
  if(!o.noWait) await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 15000 });
  return { page, ctx, errors };
}

const settings = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const setLS = (page, k, v) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [k, v]);
const txt = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
const sentenceText = page => page.$$eval('#sentence-track .slot .hz', e => e.map(x => x.textContent).join(''));
const hidden = (page, sel) => page.$eval(sel, e => e.classList.contains('hidden') || e.hidden || getComputedStyle(e).display === 'none');
const settle = ms => new Promise(r => setTimeout(r, ms));

// 開始一局；回傳後遊戲在跑
async function start(page, name){
  if(name) await page.fill('#nameInput', name);
  await page.click('#startBtn');
  await page.waitForFunction(() => document.querySelectorAll('#sentence-track .slot').length > 0);
}
// 按暫停 → 結束遊戲 → 到結果畫面
async function quit(page){
  await page.click('#pauseBtn');
  await page.click('#quitBtn');
  await page.waitForFunction(() => !document.getElementById('overOverlay').classList.contains('hidden'));
}

// ===== 用鍵盤玩的機器人 =====
// lookup：{ 句子連在一起的字 → 詞陣列 }，大魔王關卡看不到字、只聽得到整句，機器人靠「聽到的整句」查出目前該吃哪一個詞
const STATE_JS = () => {
  const tr = document.getElementById('track'), pl = document.getElementById('player');
  const num = s => parseFloat(s) || 0;
  const coins = [...tr.querySelectorAll('.coin')].filter(c => !/pop-/.test(c.className)).map(c => {
    const m = (c.style.translate || '').match(/-?[\d.]+/);
    return { t: c.textContent, cx: (m ? parseFloat(m[0]) : num(c.style.left)) + c.offsetWidth / 2, y: num(c.style.top), w: c.offsetWidth };
  });
  const sp = window.__spoken || [];
  return {
    coins, px: num(pl.style.left), py: num(pl.style.top), lanes: tr.querySelectorAll('.lane-divider').length + 1,
    slots: [...document.querySelectorAll('#sentence-track .slot')].map(s => ({ hz: s.querySelector('.hz').textContent, st: s.classList.contains('stamped') })),
    over: !document.getElementById('overOverlay').classList.contains('hidden'),
    paused: !document.getElementById('pauseOverlay').classList.contains('hidden'),
    hearts: document.querySelectorAll('#hearts .lost').length,
    boss: document.getElementById('banner-wrap').classList.contains('boss-mode'),
    score: +document.getElementById('score').textContent,
    done: /^\d+\/(\d+)$/.test(document.getElementById('progressLabel').textContent) && document.getElementById('progressLabel').textContent.split('/')[0] === document.getElementById('progressLabel').textContent.split('/')[1],
    lastSpoken: sp.length ? sp[sp.length - 1].text : '', spoken: sp.slice(-8).map(x => x.text), nSpoken: sp.length
  };
};
async function botStep(page, held, lookup, spd){
  const s = await page.evaluate(STATE_JS);
  if(s.over || s.paused || !s.slots.length) return { s, held };
  const idx = s.slots.filter(x => x.st).length;
  let target = idx < s.slots.length ? s.slots[idx].hz : null;
  if(target === '？'){
    // 大魔王：往回找最近一次「念出整句」（長度等於句子字數的那句）
    const toks = lookup && Object.keys(lookup).length ? findBossTokens(s, lookup) : null;
    target = toks ? toks[idx] : null;
  }
  let want = null;
  if(target && !s.done){
    const ahead = s.coins.filter(c => c.t === target && c.cx > s.px + 5);
    const ok2 = ahead.filter(c => !s.coins.some(o => o !== c && Math.abs(o.y - c.y) < 1 && o.cx < c.cx && o.cx > s.px - 45));
    ok2.sort((a, b) => a.cx - b.cx);
    if(ok2.length) want = ok2[0].y;
  }
  if(want === null){
    // 沒有可吃的：躲到最安全的橫排（前方最近的金幣最遠的那一排）
    let best = null;
    for(let i = 0; i < s.lanes; i++){
      const y = (i + 0.5) / s.lanes * 100;
      const near = Math.min(1e9, ...s.coins.filter(c => Math.abs(c.y - y) < 1 && c.cx > s.px - 45).map(c => c.cx - s.px));
      if(!best || near > best.near + 40 || (Math.abs(near - best.near) <= 40 && Math.abs(y - s.py) < Math.abs(best.y - s.py))) best = { y, near };
    }
    want = best ? best.y : s.py;
  }
  let dir = Math.abs(s.py - want) < 3 ? null : (s.py < want ? 'ArrowDown' : 'ArrowUp');
  if(dir || held){
    // 往前模擬 1.8 秒：「照原計畫移動」「原地不動」哪一個不會撞到別的金幣（碰撞範圍比一排還寬）就選哪一個
    const yTol = 100 / s.lanes * 0.55 + 2, v = spd * 1.25;
    const sim = d => {
      let y = s.py, hits = 0;
      for(let t = 0; t <= 1.8; t += 0.05){
        if(d && Math.abs(y - want) > 1.5) y += (d === 'ArrowDown' ? 1 : -1) * 90 * 0.05;
        for(const c of s.coins){
          if(c.t === target && Math.abs(c.y - want) < 1) continue;
          if(Math.abs(c.cx - v * t - s.px) < c.w / 2 + 16 && Math.abs(c.y - y) < yTol) hits++;
        }
      }
      return hits;
    };
    const mv = dir ? sim(dir) : 0, st = sim(null);
    if(dir && mv > 0 && st < mv) dir = null;
  }
  if(held !== dir){
    if(held) await page.keyboard.up(held);
    if(dir) await page.keyboard.down(dir);
    held = dir;
  }
  return { s, held };
}
function findBossTokens(s, lookup){
  // 往回找最近一次「念出整句」（吃到金幣時念的是單一個詞，不算）
  for(const t of s.spoken.slice().reverse()) if(lookup[t] && lookup[t].length === s.slots.length) return lookup[t];
  return null;
}
// 一直玩到 until(state) 成立（或逾時）；回傳最後的狀態
async function botPlay(page, until, { timeout = 90000, lookup = null, spd = 135 } = {}){
  const t0 = Date.now();
  let held = null, last = null;
  try{
    while(Date.now() - t0 < timeout){
      const r = await botStep(page, held, lookup, spd);
      held = r.held; last = r.s;
      if(until(last)) break;
      if(last.over) break;
      await settle(30);
    }
  }finally{
    if(held) await page.keyboard.up(held).catch(() => {});
  }
  return last;
}

module.exports = { chromium, fs, BASE, KEY, CENTRAL, PUBLIC, ok, result, bankFile, allBank, packsFile, launch, open, settings, setLS, txt, sentenceText, hidden, settle, start, quit, botPlay, STATE_JS };
