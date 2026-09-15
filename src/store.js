/* ===== Úložiště: offline-first (localStorage) + Supabase =====
   Každý záznam: { id, user_id, data:{...}, updated_at, deleted }.
   Tabulky: settings, foods, recipes, measurements, days, week_plans, shopping */
const TABLES = ['settings', 'foods', 'recipes', 'measurements', 'days', 'week_plans', 'shopping', 'prefs', 'training'];
const LS = {
  get(k, def) { try { const v = localStorage.getItem('rp:' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { localStorage.setItem('rp:' + k, JSON.stringify(v)); },
  del(k) { localStorage.removeItem('rp:' + k); }
};

const Store = {
  db: {}, outbox: [], sb: null, session: null, profile: null, clients: [], clientId: null, online: navigator.onLine, syncing: false, lastSync: null, timer: null,
  localMode() { return !CLOUD_CONFIG.url || !CLOUD_CONFIG.key; },
  load() {
    TABLES.forEach(t => { this.db[t] = LS.get('t:' + t, []); });
    this.outbox = LS.get('outbox', []);
    this.lastSync = LS.get('lastSync', null);
  },
  save(t) { LS.set('t:' + t, this.db[t]); },
  rows(t, uid) { return this.db[t].filter(r => !r.deleted && (uid === undefined || r.user_id === uid)); },
  /* aktuální uživatel, ke kterému data patří (klient sám, nebo vybraný klient trenéra) */
  ownerId() { return this.profile && this.profile.role === 'coach' ? this.clientId : this.uid(); },
  uid() { return this.session ? this.session.user.id : (this.profile ? this.profile.id : null); },
  put(t, id, data, userId) {
    const now = new Date().toISOString();
    const rec = { id, user_id: userId === undefined ? this.ownerId() : userId, data, updated_at: now, deleted: false };
    const i = this.db[t].findIndex(r => r.id === id);
    if (i >= 0) this.db[t][i] = rec; else this.db[t].push(rec);
    this.save(t); this.queue(t, rec); return rec;
  },
  remove(t, id) {
    const i = this.db[t].findIndex(r => r.id === id); if (i < 0) return;
    this.db[t][i] = { ...this.db[t][i], deleted: true, updated_at: new Date().toISOString() };
    this.save(t); this.queue(t, this.db[t][i]);
  },
  queue(t, rec) {
    if (this.localMode()) return;
    this.outbox = this.outbox.filter(o => !(o.t === t && o.rec.id === rec.id));
    this.outbox.push({ t, rec }); LS.set('outbox', this.outbox);
    clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 800);
    UI.syncBadge();
  },
  /* ---- Supabase ---- */
  async initCloud() {
    if (this.localMode()) return false;
    if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
    this.sb = window.supabase.createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.key, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await this.sb.auth.getSession();
    this.session = data.session;
    this.sb.auth.onAuthStateChange((_e, s) => { this.session = s; });
    return true;
  },
  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error; this.session = data.session;
  },
  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
    if (error) throw error;
  },
  async updatePassword(pw) { const { error } = await this.sb.auth.updateUser({ password: pw }); if (error) throw error; },
  async signOut() { if (this.sb) await this.sb.auth.signOut(); this.session = null; this.profile = null; LS.del('profile'); },
  async loadProfile() {
    if (this.localMode()) { this.profile = LS.get('profile', null); return this.profile; }
    const uid = this.uid(); if (!uid) return null;
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    if (!data) { this.profile = { id: uid, role: 'client', missing: true }; return this.profile; }
    this.profile = data;
    if (data.role === 'coach') {
      const { data: cl } = await this.sb.from('profiles').select('*').eq('coach_id', uid);
      this.clients = cl || [];
      this.clientId = LS.get('clientId', null) || (this.clients[0] && this.clients[0].id) || null;
    }
    LS.set('profile', this.profile); LS.set('clients', this.clients);
    return this.profile;
  },
  async push() {
    if (this.localMode() || !this.session || this.syncing || !navigator.onLine) return;
    this.syncing = true; UI.syncBadge();
    try {
      while (this.outbox.length) {
        const o = this.outbox[0];
        const { error } = await this.sb.from(o.t).upsert({ id: o.rec.id, user_id: o.rec.user_id, data: o.rec.data, updated_at: o.rec.updated_at, deleted: o.rec.deleted });
        if (error) { console.warn('push', o.t, error.message); this.lastError = error.message; break; }
        this.lastError = null;
        this.outbox.shift(); LS.set('outbox', this.outbox);
      }
    } finally { this.syncing = false; UI.syncBadge(); }
  },
  async pull() {
    if (this.localMode() || !this.session || !navigator.onLine) return false;
    let changed = false;
    for (const t of TABLES) {
      let q = this.sb.from(t).select('*');
      if (this.lastSync) q = q.gt('updated_at', this.lastSync);
      const { data, error } = await q;
      if (error) { console.warn('pull', t, error.message); this.lastError = error.message; continue; }
      for (const r of data) {
        const i = this.db[t].findIndex(x => x.id === r.id);
        if (i < 0) { this.db[t].push(r); changed = true; }
        else if (r.updated_at > this.db[t][i].updated_at) { this.db[t][i] = r; changed = true; }  // last-write-wins
      }
      this.save(t);
    }
    this.lastSync = new Date(Date.now() - 60000).toISOString(); LS.set('lastSync', this.lastSync);
    return changed;
  },
  async sync() { await this.push(); const ch = await this.pull(); await this.push(); UI.syncBadge(); return ch; }
};

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Nepodařilo se načíst ' + src)); document.head.appendChild(s); });
}

