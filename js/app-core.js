const BASE_URL = 'https://script.google.com/macros/s/AKfycbxh1foEg_C7IlblKyZC-o4MtQblzFplUz6_CzZijJtk-cBE91oY-hS0gGJ8eK0wW-smjA/exec';

window.app = {
  token: localStorage.getItem('sk_token'),
  role: localStorage.getItem('sk_role'),
  email: localStorage.getItem('sk_email'),
  currentTable: '',
  schema: {},
  modes: {},
  editingId: null,
  isSubmitting: false,
  resourceCache: {},
  schemaCache: {},
  allResources: [],
  fullAppData: {},
  dashboardConfigs: JSON.parse(localStorage.getItem('sk_dashboard_config')) || [],
  widgetResults: [],

  async init() {
    if (!this.token) return;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('u-email').innerText = this.email;
    document.getElementById('u-role').innerText = this.role;
    document.getElementById('u-avatar').innerText = this.email.charAt(0).toUpperCase();

    if (this.role === 'admin') document.getElementById('system-tools').classList.remove('hidden');

    document.getElementById('cur-title').innerText = 'INITIALIZING SYSTEM...';

    const [resList, _, permRes] = await Promise.all([
      this.get({ action: 'listResources' }),
      this.loadDashboardConfigs(),
      this.get({ action: 'read', table: 'config_permissions' })
    ]);

    if (permRes && permRes.success) {
      this.permMatrix = permRes.rows.filter(r => r.resource && !String(r.resource).includes('{'));
    }

    if (!resList || !resList.success) return;
    this.allResources = resList.resources;

    await Promise.all(resList.resources.map(async (res) => {
      const detail = await this.get({ action: 'read', table: res.id });
      if (detail && detail.success) {
        this.resourceCache[res.id] = detail.rows || [];
        this.schemaCache[res.id] = { schema: detail.schema || {}, modes: detail.modes || { add: { can: false } } };
        this.fullAppData[res.id] = { schema: detail.schema || {}, rows: detail.rows || [], modes: detail.modes || { add: { can: false } } };
      }
    }));

    this.renderSidebar();
    document.getElementById('cur-title').innerText = 'SYSTEM READY';
    this.openDashboard();
  },

  async get(params) {
    try {
      const q = new URLSearchParams({ ...params, token: this.token }).toString();
      const res = await fetch(`${BASE_URL}?${q}`);
      return await res.json();
    } catch (e) { return { success: false, message: "Koneksi Terputus" }; }
  },

  async post(arg1, arg2) {
    try {
      let finalPayload;
      if (typeof arg1 === 'object' && !arg2) {
        finalPayload = { ...arg1, token: this.token };
      } else {
        finalPayload = { action: arg1, table: this.currentTable, data: arg2, token: this.token };
      }
      const res = await fetch(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(finalPayload)
      });
      return await res.json();
    } catch (e) { return { success: false, message: "Koneksi Terputus" }; }
  },

  async login() {
    const btn = document.getElementById('btn-login');
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    btn.innerText = "AUTHORIZING...";
    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, password: pass })
      });
      const res = await response.json();
      if (res.success) {
        localStorage.setItem('sk_token', res.token);
        localStorage.setItem('sk_role', res.role);
        localStorage.setItem('sk_email', email);
        location.reload();
      } else { alert("Akses Ditolak!"); btn.innerText = "AUTHORIZE"; }
    } catch (e) { alert("Gagal terhubung ke server!"); btn.innerText = "AUTHORIZE"; }
  },

  logout() { localStorage.clear(); location.reload(); },

  toggleSidebar() {
    const sb = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sb.classList.contains('sidebar-closed')) {
      sb.classList.replace('sidebar-closed', 'sidebar-open');
      overlay.classList.remove('hidden');
    } else {
      sb.classList.replace('sidebar-open', 'sidebar-closed');
      overlay.classList.add('hidden');
    }
  },

  resetViews() {
    ['view-crud', 'view-dashboard', 'search-container', 'btn-add', 'view-mode'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('sidebar-active'));
  },

  renderSidebar() {
    const list = document.getElementById('resource-list');
    const unique = [...new Map(this.allResources.map(r => [r.id, r])).values()];
    list.innerHTML = unique.map(r => `
      <button onclick="app.selectResource('${r.id}')" id="db-${r.id}" class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-all text-left">
        <i class="fa-solid fa-database text-[11px] opacity-50"></i><span class="truncate">${r.id}</span>
      </button>`).join('');
  }
};