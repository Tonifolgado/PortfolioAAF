/*
 * Almacenamiento local de PortfolioAAF.
 *
 * Los datos viven solo en este navegador (localStorage), en un único objeto
 * { <id de documento>: <documento> }. La app trabaja con documentos agrupados
 * por año ("orders-2026", "divs-2026"), más "meta" (catálogo y precios),
 * "plans" (planes y fondos) y "analysis" (texto del análisis, opcional).
 *
 * platform.use(nombre) devuelve los servicios que usa la app:
 *   db        → colección "ledger" con onSnapshot, doc().set() y doc().update()
 *   user      → permisos (siempre puede escribir: la app es personal)
 *   downloads → descarga de archivos generados (Excel, copias de seguridad)
 *   backup    → exportar / restaurar una copia de seguridad en JSON
 */
(() => {
  const KEY = 'portfolioaaf:ledger';
  const BACKUP_KEY = 'portfolioaaf:lastBackup';
  const FORMAT = 'PortfolioAAF';
  const listeners = new Set();

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { console.error('No se pudieron leer los datos guardados', e); return {}; }
  }
  function write(docs) {
    try { localStorage.setItem(KEY, JSON.stringify(docs)); }
    catch (e) { throw { code: 'storage_full', message: 'El navegador no ha permitido guardar los datos.' }; }
    notify(docs);
  }
  function snapshot(docs) {
    return {
      metadata: { fromCache: false },
      docs: Object.entries(docs).map(([id, d]) => ({ id, exists: true, data: () => structuredClone(d) })),
    };
  }
  function notify(docs = read()) { const s = snapshot(docs); listeners.forEach(fn => fn(s)); }

  // update(): mezcla objetos anidados; arrays y valores simples se sustituyen.
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge(target, patch) {
    const out = isObj(target) ? { ...target } : {};
    for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) ? merge(out[k], v) : v;
    return out;
  }
  const docId = path => { const [col, id] = path.split('/'); if (col !== 'ledger' || !id) throw { code: 'invalid_argument', message: path }; return id; };

  const db = {
    collection: () => ({
      onSnapshot(fn) { listeners.add(fn); setTimeout(() => fn(snapshot(read())), 0); return () => listeners.delete(fn); },
    }),
    doc: path => ({
      async set(data) { const docs = read(); docs[docId(path)] = structuredClone(data); write(docs); },
      async update(patch) { const docs = read(); const id = docId(path); docs[id] = merge(docs[id], patch); write(docs); },
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
    isEmpty() { return Object.keys(read()).length === 0; },
    async export() {
      const today = new Date().toISOString().slice(0, 10);
      const payload = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), docs: read() };
      await downloads.save({ filename: `PortfolioAAF_copia_${today}.json`, data: JSON.stringify(payload, null, 1) });
      try { localStorage.setItem(BACKUP_KEY, today); } catch (e) {}
    },
    async restore(file) {
      let payload;
      try { payload = JSON.parse(await file.text()); } catch (e) { throw { message: 'El archivo no es una copia de seguridad válida (JSON ilegible).' }; }
      if (payload?.format !== FORMAT || !isObj(payload.docs)) throw { message: 'El archivo no es una copia de seguridad de PortfolioAAF.' };
      write(structuredClone(payload.docs));
      return Object.keys(payload.docs).length;
    },
  };

  // Cambios hechos en otra pestaña del mismo navegador.
  window.addEventListener('storage', e => { if (e.key === KEY) notify(); });
  // Pide al navegador que no borre estos datos si le falta espacio.
  navigator.storage?.persist?.().catch(() => {});

  const services = { db, user: { can: () => true }, downloads, backup };
  window.platform = { use: async name => services[name] ?? null };
})();
