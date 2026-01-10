/**
 * PERBAIKAN.JS - MODUL INISIALISASI & PERMISSION
 * Juragan SaaS Sheet - 2026
 */
Object.assign(app, {

  async init() {
    if (!this.token) return;

    console.log("[SYSTEM] Initializing modules...");

    // 1. UI Setup
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('u-email').innerText = this.email || '';
    document.getElementById('u-role').innerText = this.role || '';
    document.getElementById('u-avatar').innerText = this.email ? this.email.charAt(0).toUpperCase() : '?';

    if (this.role === 'admin') {
      document.getElementById('system-tools')?.classList.remove('hidden');
    }

    const titleEl = document.getElementById('cur-title');
    if (titleEl) titleEl.innerText = "LOADING PERMISSIONS...";

    // 2. 🔐 WAJIB: Load Permission agar Lookup & Autofill tidak terblokir
    await this.loadPermissions();

    if (titleEl) titleEl.innerText = "FETCHING RESOURCES...";

    // 3. Load Resources & Dashboard Config
    const [resList] = await Promise.all([
      this.get({ action: 'listResources' }),
      this.loadDashboardConfigs()
    ]);

    if (!resList.success) {
      console.error("Gagal mengambil list resources");
      return;
    }

    this.allResources = resList.resources;
    this.fullAppData = {};
    this.resourceCache = {};
    this.schemaCache = {};

    // 4. Pre-fetch SEMUA data untuk kebutuhan LOOKUP & AUTOFILL
    // Kita download semua data ke memory agar dropdown tidak kosong bagi non-admin
    await Promise.all(resList.resources.map(async (res) => {
      const detail = await this.get({ action: 'read', table: res.id });
      if (detail.success) {
        // Data untuk mesin Lookup/Autofill
        this.fullAppData[res.id] = { 
          schema: detail.schema, 
          rows: detail.rows 
        };
        // Data untuk Cache Tabel
        this.resourceCache[res.id] = detail.rows;
        this.schemaCache[res.id] = {
          schema: detail.schema,
          modes: detail.modes || { add: { can: true } }
        };
      }
    }));

    // 5. Finalisasi UI
    this.renderSidebar();
    if (titleEl) titleEl.innerText = "SYSTEM READY";
    this.openDashboard();
    
    console.log("[SYSTEM] All modules loaded successfully.");
  },

  // Fungsi penunjang Permission (Jika belum ada di script lain)
  can(resource, action) {
    if (!this.permissions) return false;
    return this.permissions[resource]?.[action] === true;
  }
});