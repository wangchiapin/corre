/* 模擬 Firebase compat SDK（記憶體內；依 projectId 分開存放；可記錄讀取次數）。
   由測試腳本在載入頁面前先設定 window.__SEED = { projectId: { collection: { docId: data } } } */
(function(){
  const SEED = window.__SEED || {};
  const DB = {};
  window.__reads = {};
  Object.keys(SEED).forEach(pid => {
    DB[pid] = {};
    Object.keys(SEED[pid]).forEach(c => {
      DB[pid][c] = {};
      Object.keys(SEED[pid][c]).forEach(d => { DB[pid][c][d] = JSON.parse(JSON.stringify(SEED[pid][c][d])); });
    });
  });
  const user = window.__USER || { uid: 'u1', email: 'teacher@example.com', displayName: 'T', isAnonymous: false };
  const clone = v => JSON.parse(JSON.stringify(v));
  const col = (pid, c) => (DB[pid] = DB[pid] || {}, DB[pid][c] = DB[pid][c] || {});

  function docSnap(pid, c, id){
    const data = col(pid, c)[id];
    return { id, exists: data !== undefined, data: () => (data === undefined ? undefined : clone(data)), _c: c };
  }
  function Query(pid, c, filters, order, after, lim){
    const q = {
      where: (f, op, v) => Query(pid, c, filters.concat([[f, op, v]]), order, after, lim),
      orderBy: f => Query(pid, c, filters, f, after, lim),
      startAfter: s => Query(pid, c, filters, order, s, lim),
      limit: n => Query(pid, c, filters, order, after, n),
      get: async () => {
        let ids = Object.keys(col(pid, c));
        ids = ids.filter(id => filters.every(([f, op, v]) => {
          const x = col(pid, c)[id][f];
          if(x === undefined) return false;
          if(op === '==') return x === v;
          if(op === '>=') return x >= v;
          if(op === '>') return x > v;
          if(op === '<') return x < v;
          if(op === '<=') return x <= v;
          return false;
        }));
        if(order){
          ids = ids.filter(id => col(pid, c)[id][order] !== undefined);
          ids.sort((a, b) => col(pid, c)[a][order] - col(pid, c)[b][order] || (a < b ? -1 : 1));
        }
        if(after){ const i = ids.indexOf(after.id); ids = i >= 0 ? ids.slice(i + 1) : ids; }
        if(lim != null) ids = ids.slice(0, lim);
        window.__reads[pid] = (window.__reads[pid] || 0) + Math.max(1, ids.length);
        const docs = ids.map(id => docSnap(pid, c, id));
        return { docs, empty: docs.length === 0, size: docs.length, forEach: fn => docs.forEach(fn) };
      }
    };
    return q;
  }
  function makeFirestore(pid){
    const fs = {
      collection: c => Object.assign(Query(pid, c, [], null, null, null), {
        add: async d => { const id = 'auto' + Math.random().toString(36).slice(2, 10); col(pid, c)[id] = clone(d); return { id }; },
        doc: id => ({
          id,
          get: async () => { window.__reads[pid] = (window.__reads[pid] || 0) + 1; return docSnap(pid, c, id); },
          set: async d => { if(window.__DENY_SCORES && c === 'class_scores') throw { code: 'permission-denied' }; col(pid, c)[id] = clone(d); },
          update: async d => { if(!col(pid, c)[id]) throw { code: 'not-found' }; Object.assign(col(pid, c)[id], clone(d)); },
          delete: async () => { delete col(pid, c)[id]; }
        })
      }),
      batch: () => {
        const ops = [];
        return {
          set: (ref, d) => { ops.push(() => ref.set(d)); },
          delete: ref => { ops.push(() => ref.delete()); },
          commit: async () => { for(const o of ops) await o(); }
        };
      }
    };
    return fs;
  }
  function makeAuth(){
    let cb = null;
    return {
      currentUser: user,
      authStateReady: () => Promise.resolve(),
      signInAnonymously: async () => ({ user }),
      onAuthStateChanged: fn => { cb = fn; setTimeout(() => fn(user), 0); },
      getRedirectResult: () => Promise.resolve(),
      signInWithPopup: async () => { if(cb) cb(user); },
      signInWithRedirect: async () => {},
      signOut: async () => { if(cb) cb(null); }
    };
  }
  const apps = {};
  window.firebase = {
    initializeApp(cfg, name){
      const n = name || '[DEFAULT]';
      if(apps[n]) throw new Error('app exists: ' + n);
      const fs = makeFirestore(cfg.projectId), au = makeAuth();
      apps[n] = { name: n, options: cfg, firestore: () => fs, auth: () => au };
      window.__apps = Object.keys(apps).map(k => k + ':' + apps[k].options.projectId);
      return apps[n];
    },
    app: n => apps[n || '[DEFAULT]'],
    auth: Object.assign(() => apps['[DEFAULT]'].auth(), { GoogleAuthProvider: function(){} }),
    firestore: Object.assign(() => apps['[DEFAULT]'].firestore(), { FieldValue: { serverTimestamp: () => Date.now() } })
  };
  window.__DB = DB;
})();
