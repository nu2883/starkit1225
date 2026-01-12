/**
 * SIDEBAR & NAVIGATION MODULE - JURAGAN SAAS SHEET
 */
Object.assign(app, {

    async init() {
        if (!this.token) return;

        // 1. UI Setup Awal
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('u-email').innerText = this.email || '';
        document.getElementById('u-role').innerText = this.role || '';

        const titleEl = document.getElementById('cur-title');
        if (titleEl) titleEl.innerText = "SYNCHRONIZING...";

        // 2. Ambil List Resource
        const resList = await this.get({ action: 'listResources' });
        if (!resList.success) {
            alert("Koneksi gagal atau Token Expired");
            return;
        }
        this.allResources = resList.resources;

        // 3. Load Permissions
        await this.loadPermissions();

        this.fullAppData = {};
        this.resourceCache = {};
        this.schemaCache = {};

        // 4. Pre-fetch Data dengan Filter Soft Delete & Handling Akses Staff
        await Promise.all(this.allResources.map(async (res) => {
            try {
                const detail = await this.get({ action: 'read', table: res.id });

                if (detail.success) {
                    this.fullAppData[res.id] = { schema: detail.schema, rows: detail.rows };

                    // Filter Soft Delete agar data terhapus tidak muncul di lookup/tabel
                    this.resourceCache[res.id] = detail.rows.filter(row => !row.deleted_at);

                    this.schemaCache[res.id] = {
                        schema: detail.schema,
                        modes: detail.modes || { add: { can: this.can(res.id, 'add') } }
                    };
                } else {
                    // Jika Staff diblokir, kita beri array kosong agar .map di populateLookup tidak error
                    console.warn(`[INIT] Akses Tabel ${res.id} terbatas untuk role ${this.role}`);
                    this.resourceCache[res.id] = [];
                    this.schemaCache[res.id] = { schema: {}, modes: { add: { can: false } } };
                }
            } catch (e) {
                console.error(`Error loading ${res.id}`, e);
                this.resourceCache[res.id] = [];
            }
        }));

        // 5. Render Akhir
        this.renderSidebar();
        if (titleEl) titleEl.innerText = "SYSTEM READY";
        this.openDashboard();
    },
    // 1. RENDER SIDEBAR: Menampilkan list tabel & Membuka Engineering Lab jika ADMIN
    renderSidebar() {
        const list = document.getElementById('resource-list');
        const tools = document.getElementById('system-tools'); // Container Engineering Lab

        if (!list) return;

        // Filter unik ID Tabel agar tidak double
        const unique = [...new Map(this.allResources.map(item => [item.id, item])).values()];

        // Render list tabel ke resource-list
        list.innerHTML = unique.map(r => `
      <button onclick="app.selectResource('${r.id}')" id="nav-${r.id}" 
        class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all text-left uppercase tracking-wider text-slate-400">
        <i class="fa-solid fa-table text-[10px] opacity-40"></i> <span>${r.id}</span>
      </button>
    `).join('');

        // 🔥 KONTROL TAMPILAN ENGINEERING LAB (ADMIN ONLY)
        if (tools) {
            if (this.role && String(this.role).toUpperCase() === 'ADMIN') {
                tools.classList.remove('hidden');
                console.log("[SIDEBAR] Engineering Lab Unlocked for Admin");
            } else {
                tools.classList.add('hidden');
            }
        }
    },

    // 2. SELECT RESOURCE: Perpindahan antar tabel
    async selectResource(id) {
        if (this.currentTable === id && this.currentView === 'data') return;

        // 1. Matikan semua view (termasuk dashboard & crud)
        if (typeof this.resetViews === 'function') this.resetViews();

        // 2. Set State
        this.currentTable = id;
        this.currentView = 'data';

        // 3. AKTIFKAN KEMBALI CONTAINER CRUD
        const crudView = document.getElementById('view-crud');
        const searchContainer = document.getElementById('search-container');

        if (crudView) {
            crudView.classList.remove('hidden');
            crudView.style.visibility = 'visible';
        }
        if (searchContainer) searchContainer.classList.remove('hidden');

        // 4. Update UI Sidebar (Warna Tombol & Judul)
        this.updateSidebarUI(id);

        // 5. Load Data dengan Proteksi Cache
        if (this.resourceCache && this.resourceCache[id]) {
            this.schema = (this.schemaCache && this.schemaCache[id]?.schema) || {};
            this.renderTable(this.resourceCache[id]);
            this.loadResource(true); // Tetap refresh background
        } else {
            await this.loadResource(true);
        }
    },

    // 3. UPDATE SIDEBAR UI: Logika pewarnaan tombol aktif
    updateSidebarUI(id) {
        // 1. SAPU BERSIH warna biru di semua tombol nav
        document.querySelectorAll('nav button, .nav-btn').forEach(b => {
            b.classList.remove('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');
            b.classList.add('text-slate-400');
        });

        // 2. WARNAI YANG BARU: Hanya tombol yang aktif sekarang
        const targetId = (id === 'dashboard') ? 'nav-dashboard' : `nav-${id}`;
        const activeBtn = document.getElementById(targetId);

        if (activeBtn) {
            activeBtn.classList.remove('text-slate-400');
            activeBtn.classList.add('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');
        }

        // 3. UPDATE JUDUL HEADER
        const titleEl = document.getElementById('cur-title');
        if (titleEl) {
            titleEl.innerText = id.replace(/_/g, ' ').toUpperCase();
        }
    },

    // Fungsi sinkronisasi tambahan jika dibutuhkan oleh fungsi lain
    syncSidebarUI(id) {
        this.updateSidebarUI(id);
    }
});