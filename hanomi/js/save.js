// Hanomi — save slots in localStorage.
const IDX = 'hanomi:index', KEY = id => 'hanomi:save:' + id;
export const Saves = {
  list() { try { return JSON.parse(localStorage.getItem(IDX) || '[]').sort((a, b) => b.updated - a.updated); } catch (e) { return []; } },
  load(id) { try { return JSON.parse(localStorage.getItem(KEY(id))); } catch (e) { return null; } },
  write(id, meta, data) {
    try {
      localStorage.setItem(KEY(id), JSON.stringify(data));
      const L = this.list().filter(s => s.id !== id); L.push(Object.assign({ id, updated: Date.now() }, meta));
      localStorage.setItem(IDX, JSON.stringify(L)); return true;
    } catch (e) { console.warn('save failed', e); return false; }
  },
  remove(id) { localStorage.removeItem(KEY(id)); localStorage.setItem(IDX, JSON.stringify(this.list().filter(s => s.id !== id))); },
  newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  settings() { try { return Object.assign({ music: 0.55, sfx: 0.8, zoom: 0, shake: true }, JSON.parse(localStorage.getItem('hanomi:settings') || '{}')); } catch (e) { return { music: 0.55, sfx: 0.8, zoom: 0, shake: true }; } },
  saveSettings(s) { localStorage.setItem('hanomi:settings', JSON.stringify(s)); },
};
