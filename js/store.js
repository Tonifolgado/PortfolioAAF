/*
 * Almacenamiento de PortfolioAAF.
 *
 * Los datos son un único objeto { <id de documento>: <documento> }: documentos
 * agrupados por año ("orders-2026", "divs-2026"), más "meta" (catálogo y
 * precios), "plans" (planes y fondos) y "analysis" (texto del análisis, opcional).
 *
 * Dos modos, elegidos al arrancar:
 *   archivo   → la app se abre con serve.py (http://localhost:8000). Cada cambio
 *               se guarda en data/portfolio.json dentro de la carpeta del
 *               repositorio, y se puede subir a GitHub con un botón.
 *   navegador → cualquier otro caso (GitHub Pages, index.html abierto con doble
 *               clic). Los datos viven en el localStorage de ese navegador.
 * En modo archivo también se guarda una copia en el navegador, por seguridad.
 *
 * platform.use(nombre) devuelve los servicios que usa la app:
 *   db        → colección "ledger" con onSnapshot, doc().set() y doc().update()
 *   user      → permisos (siempre puede escribir: la app es personal)
 *   downloads → descarga de archivos generados (Excel, copias de seguridad)
 *   backup    → exportar / restaurar una copia de seguridad en JSON
 *   sync      → modo de guardado, estado y publicación en GitHub
 */
(() => {
  const KEY = 'portfolioaaf:ledger';
  const BACKUP_KEY = 'portfolioaaf:lastBackup';
  const FORMAT = 'PortfolioAAF';
  const API = { headers: { 'X-PortfolioAAF': '1' } };
  const listeners = new Set();
  const syncListeners = new Set();

  let cache = {};
  const sync = { mode: 'navegador', file: null, state: 'saved', savedAt: null, error: null };

  // ---------- copia en el navegador ----------
  function readLocal() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { console.error('No se pudieron leer los datos del navegador', e); return {}; }
  }
  function writeLocal(docs) {
    try { localStorage.setItem(KEY, JSON.stringify(docs)); return true; }
    catch (e) { return false; }
  }

  // ---------- archivo data/portfolio.json (vía serve.py) ----------
  const payload = docs => ({ format: FORMAT, version: 1, savedAt: new Date().toISOString(), docs });
  let saveTimer = null, saving = null, dirty = false;
  function setSync(patch) { Object.assign(sync, patch); syncListeners.forEach(fn => fn({ ...sync })); }

  async function saveToFile() {
    clearTimeout(saveTimer); saveTimer = null;
    if (saving) { dirty = true; return saving; }
    dirty = false;
    setSync({ state: 'saving' });
    saving = fetch('/api/data', { method: 'PUT', headers: { ...API.headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload(cache)) })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `Error ${r.status}`);
        setSync({ state: 'saved', savedAt: new Date(), error: null });
      })
      .catch(e => { dirty = true; setSync({ state: 'error', error: e.message || 'Sin conexión con el servidor' }); saveTimer = setTimeout(saveToFile, 5000); })
      .finally(() => { saving = null; if (dirty && sync.state !== 'error') saveToFile(); });
    return saving;
  }
  function scheduleSave() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveToFile, 300); }

  // ---------- arranque ----------
  const ready = (async () => {
    const local = readLocal();
    if (location.protocol.startsWith('http')) {
      try {
        const r = await fetch('/api/data', API);
        const j = r.ok && r.headers.get('content-type')?.includes('json') ? await r.json() : null;
        if (j?.server) {
          sync.mode = 'archivo'; sync.file = j.file;
          if (j.data?.format === FORMAT && isObj(j.data.docs)) {
            cache = j.data.docs; writeLocal(cache);
            sync.savedAt = j.data.savedAt ? new Date(j.data.savedAt) : null;
          } else {
            // Primera vez con servidor: el archivo aún no existe. Si este navegador
            // ya tenía datos, se pasan al archivo.
            cache = local;
            if (Object.keys(cache).length) await saveToFile();
          }
          return;
        }
      } catch (e) { /* sin servidor: modo navegador */ }
    }
    cache = local;
  })();

  function write(docs) {
    cache = docs;
    const ok = writeLocal(docs);
    if (sync.mode === 'archivo') scheduleSave();
    else if (!ok) throw { code: 'storage_full', message: 'El navegador no ha permitido guardar los datos.' };
    notify();
  }
  function snapshot(docs) {
    return {
      metadata: { fromCache: false },
      docs: Object.entries(docs).map(([id, d]) => ({ id, exists: true, data: () => structuredClone(d) })),
    };
  }
  function notify() { const s = snapshot(cache); listeners.forEach(fn => fn(s)); }

  // update(): mezcla objetos anidados; arrays y valores simples se sustituyen.
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function merge(target, patch) {
    const out = isObj(target) ? { ...target } : {};
    for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) ? merge(out[k], v) : v;
    return out;
  }
  const docId = path => { const [col, id] = path.split('/'); if (col !== 'ledger' || !id) throw { code: 'invalid_argument', message: path }; return id; };

  const db = {
    collection: () => ({
      onSnapshot(fn) { listeners.add(fn); ready.then(() => fn(snapshot(cache))); return () => listeners.delete(fn); },
    }),
    doc: path => ({
      async set(data) { const docs = { ...cache }; docs[docId(path)] = structuredClone(data); write(docs); },
      async update(patch) { const docs = { ...cache }; const id = docId(path); docs[id] = merge(docs[id], patch); write(docs); },
    }),
  };

  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { status: 'saved' };
    },
  };

  const backup = {
    lastDate() { try { return localStorage.getItem(BACKUP_KEY); } catch (e) { return null; } },
    isEmpty() { return Object.keys(cache).length === 0; },
    async export() {
      const today = new Date().toISOString().slice(0, 10);
      const p = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), docs: cache };
      await downloads.save({ filename: `PortfolioAAF_copia_${today}.json`, data: JSON.stringify(p, null, 1) });
      try { localStorage.setItem(BACKUP_KEY, today); } catch (e) {}
    },
    async restore(file) {
      let p;
      try { p = JSON.parse(await file.text()); } catch (e) { throw { message: 'El archivo no es una copia de seguridad válida (JSON ilegible).' }; }
      if (p?.format !== FORMAT || !isObj(p.docs)) throw { message: 'El archivo no es una copia de seguridad de PortfolioAAF.' };
      write(structuredClone(p.docs));
      return Object.keys(p.docs).length;
    },
  };

  const syncService = {
    get mode() { return sync.mode; },
    status: () => ({ ...sync }),
    onChange(fn) { syncListeners.add(fn); return () => syncListeners.delete(fn); },
    async flush() { if (saveTimer || dirty) await saveToFile(); if (saving) await saving; if (sync.state === 'error') throw { message: sync.error }; },
    async publish() {
      if (sync.mode !== 'archivo') throw { message: 'Abre la app con serve.py para subir los datos a GitHub.' };
      await syncService.flush();
      const r = await fetch('/api/publish', { method: 'POST', ...API });
      const j = await r.json().catch(() => ({ message: `Error ${r.status}` }));
      if (!r.ok) throw j;
      return j;
    },
  };

  // Cambios hechos en otra pestaña del mismo navegador.
  window.addEventListener('storage', e => { if (e.key === KEY) { cache = readLocal(); notify(); } });
  // Aviso si se cierra la página con un guardado pendiente en el archivo.
  window.addEventListener('beforeunload', e => { if (sync.mode === 'archivo' && (saveTimer || saving || sync.state === 'error')) { saveToFile(); e.preventDefault(); e.returnValue = ''; } });
  // Pide al navegador que no borre la copia local si le falta espacio.
  navigator.storage?.persist?.().catch(() => {});

  const services = { db, user: { can: () => true }, downloads, backup, sync: syncService };
  window.platform = { use: async name => { await ready; return services[name] ?? null; } };
})();
