// 句庫檢查（不用瀏覽器，純 Node）：node tests/check_bank.js [--write-meta] [--coverage]
// 檢查 bank/A1.json、A2.json、B1.json（三個等級各一個檔）的格式、有沒有完全重複的句子、用字是否超過等級（只警告）、
// 題包（bank/packs.json）和檔頭的數量對不對。有「錯誤」就以非 0 結束；「警告」不會讓它失敗。
//   --write-meta  先把各檔檔頭 count、題包 count／byLevel 依句子重算再寫回，然後再檢查；
//                 可加 --date=YYYY-MM-DD 把有變動的檔案的檔頭 generated 設成那天
//   --coverage    印出每一課的句數，方便挑出句子最少的語法點
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const PACKS = path.join(root, 'bank/packs.json');
const TOCFL = path.join(root, 'bank/ref/tocfl-levels.json');
const LEVELS = ['A1', 'A2', 'B1'];
const FILES = Object.fromEntries(LEVELS.map(L => [L, path.join(root, 'bank/' + L + '.json')]));
const BOOK = { A1: '1', A2: '2', B1: '3' };
const CAP = { A1: 'L1', A2: 'L2', B1: 'L3' };            // 用字上限：入門級／基礎級／進階級
const ORDER = ['N1', 'N2', 'L1', 'L2', 'L3', 'L4', 'L5'];
const MAX_CHARS = 20;
const args = process.argv.slice(2);
const dateArg = (args.find(a => a.startsWith('--date=')) || '').slice(7);

const banks = Object.fromEntries(LEVELS.map(L => [L, JSON.parse(fs.readFileSync(FILES[L], 'utf8'))]));
const packs = JSON.parse(fs.readFileSync(PACKS, 'utf8'));
const S = LEVELS.flatMap(L => banks[L].sentences);
const bank = { count: S.length };   // 相容舊寫法（檔頭總數）

if (args.includes('--write-meta')) {
  for (const L of LEVELS) {
    const b = banks[L], n = b.sentences.length;
    const changed = b.count !== n;
    b.format = 'corre-sentences'; b.version = 3; b.level = L; b.count = n;
    if (dateArg && changed) b.generated = dateArg;
    // 固定欄位順序
    const out = { format: b.format, version: b.version, level: b.level, generated: b.generated, count: b.count, sentences: b.sentences };
    fs.writeFileSync(FILES[L], JSON.stringify(out));
  }
  for (const p of packs.packs) {
    const hit = s => (p.rule.tags && s.tags.some(t => p.rule.tags.includes(t))) ||
      (p.rule.grammar && p.rule.grammar.includes(s.grammar.replace(/^當代\d-L\d+ /, '')));
    const m = S.filter(hit);
    p.count = m.length; p.byLevel = LEVELS.map(L => m.filter(s => s.level === L).length);
  }
  fs.writeFileSync(PACKS, JSON.stringify(packs, null, 1));
}

const errors = [], warns = [];
const err = (id, m) => errors.push(id + '：' + m), warn = (id, m) => warns.push(id + '：' + m);

// 標籤清單（bank/ref/tags.json，新增句子只能用這裡的標籤）
const known = new Set(JSON.parse(fs.readFileSync(path.join(root, 'bank/ref/tags.json'), 'utf8')).tags);

// 詞表
let level = null;
if (fs.existsSync(TOCFL)) {
  const j = JSON.parse(fs.readFileSync(TOCFL, 'utf8'));
  level = {}; ORDER.forEach(n => (j.levels[n] || []).forEach(w => { if (!(w in level)) level[w] = n; }));
}
const idx = n => ORDER.indexOf(n);

const seenText = new Map(), seenId = new Set(), counters = {};
for (const s of S) {
  const id = s.id || '(沒有編號)';
  if (!LEVELS.includes(s.level)) { err(id, '等級不是 A1／A2／B1'); continue; }
  if (seenId.has(s.id)) err(id, '編號重複'); seenId.add(s.id);
  const m = /^(A1|A2|B1)-(\d{3,})$/.exec(s.id || '');
  if (!m || m[1] !== s.level) err(id, '編號格式不對（要像 A1-101）');
  else (counters[s.level] = counters[s.level] || []).push(+m[2]);
  for (const k of ['trad', 'simp', 'pinyin']) if (!Array.isArray(s[k]) || !s[k].length) err(id, k + ' 不是有內容的陣列');
  if (!Array.isArray(s.trad) || !Array.isArray(s.simp) || !Array.isArray(s.pinyin)) continue;
  if (s.trad.length !== s.simp.length || s.trad.length !== s.pinyin.length) err(id, '繁／簡／拼音長度不一樣');
  if (!s.es || !String(s.es).trim()) err(id, '缺西文');
  if (!s.en || !String(s.en).trim()) err(id, '缺英文');
  const text = s.trad.join('');
  if (/[\s，。！？、,.!?；：]/.test(text)) err(id, '句子裡不能有空白或標點');
  if (text.length > MAX_CHARS) err(id, '超過 ' + MAX_CHARS + ' 字');
  s.trad.forEach((t, i) => {
    if (!t || /\s/.test(t)) err(id, '第 ' + (i + 1) + ' 個詞是空的或含空白');
    if (s.simp[i] && s.simp[i].length !== t.length) err(id, '簡體第 ' + (i + 1) + ' 個詞長度和繁體不同');
    const sy = String(s.pinyin[i] || '').split(' ').filter(Boolean);
    if (sy.length !== t.length) err(id, '拼音第 ' + (i + 1) + ' 個詞（' + t + '）音節數和字數不同');
  });
  if (!Array.isArray(s.tags) || s.tags.length < 1 || s.tags.length > 3) err(id, '標籤要 1–3 個');
  else s.tags.forEach(t => { if (!known.has(t)) err(id, '不在標籤清單裡：' + t); });
  const g = /^當代([123])-L(\d+) (.+)$/.exec(s.grammar || '');
  if (!g) err(id, '語法點格式要像「當代1-L1 A不A」');
  else if (g[1] !== BOOK[s.level]) err(id, '語法點的冊別和等級對不上');
  if (seenText.has(text)) err(id, '和 ' + seenText.get(text) + ' 完全重複：' + text); else seenText.set(text, id);
  // 用字等級（只警告）：詞在上限內，或每個字都出現在上限內的某個詞裡，或是這句要練的語法詞本身
  if (level) {
    const cap = idx(CAP[s.level]);
    s.trad.forEach(t => {
      const lv = level[t];
      if (lv && idx(lv) <= cap) return;
      if (g && g[3].includes(t)) return;
      const ok = [...t].every(c => Object.keys(level).some(w => idx(level[w]) <= cap && w.includes(c)));
      if (!ok) warn(id, '「' + t + '」' + (lv ? '是' + lv + '（超過 ' + CAP[s.level] + '）' : '不在八千詞表裡'));
    });
  }
}
// 編號要連續
for (const L of LEVELS) {
  const a = (counters[L] || []).slice().sort((x, y) => x - y);
  a.forEach((n, i) => { if (n !== i + 1) { err(L, '編號不連續（第 ' + (i + 1) + ' 個是 ' + n + '）'); a.length = 0; } });
}
// 檔頭與題包數量
for (const L of LEVELS) {
  const b = banks[L];
  if (b.level !== L) err(L + '.json', '檔頭 level 不是 ' + L);
  if (b.count !== b.sentences.length) err(L + '.json', '檔頭 count 是 ' + b.count + '，實際 ' + b.sentences.length + '（可用 --write-meta 重算）');
  b.sentences.forEach(x => { if (x.level !== L) err(x.id || '(沒有編號)', '放錯檔案：等級是 ' + x.level + '，卻在 ' + L + '.json'); });
}
for (const p of packs.packs) {
  const hit = s => (p.rule.tags && s.tags.some(t => p.rule.tags.includes(t))) ||
    (p.rule.grammar && p.rule.grammar.includes((s.grammar || '').replace(/^當代\d-L\d+ /, '')));
  const m = S.filter(hit), by = LEVELS.map(L => m.filter(s => s.level === L).length);
  if (p.count !== m.length || p.byLevel.join() !== by.join()) err('題包 ' + p.id, '數量對不上（可用 --write-meta 重算）');
}

if (args.includes('--coverage')) {
  const cov = {};
  S.forEach(s => { const k = (s.grammar || '').split(' ')[0]; cov[k] = (cov[k] || 0) + 1; });
  const lessons = [];
  for (const b of [1, 2, 3]) for (let l = 1; l <= 15; l++) { const k = '當代' + b + '-L' + l; if (b === 3 && l > 12) break; lessons.push([k, cov[k] || 0]); }
  console.log('每課句數（少的在前）：'); lessons.sort((a, b) => a[1] - b[1]).forEach(([k, n]) => console.log('  ' + k + '：' + n));
  const t = {}; S.forEach(s => s.tags.forEach(x => t[x] = (t[x] || 0) + 1));
  console.log('標籤句數：', JSON.stringify(t));
}

console.log('句庫：' + S.length + ' 句（' + LEVELS.map(L => L + ' ' + S.filter(s => s.level === L).length).join('、') + '）');
if (warns.length) { console.log('警告 ' + warns.length + ' 項：'); warns.slice(0, 60).forEach(w => console.log('  ⚠ ' + w)); }
if (errors.length) { console.log('錯誤 ' + errors.length + ' 項：'); errors.slice(0, 60).forEach(e => console.log('  ✗ ' + e)); process.exit(1); }
console.log('✓ 檢查通過');
