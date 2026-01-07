/**
 * STARKIT VOYAGER - APP ENGINE
 * Pusat kendali navigasi, state, dan komunikasi API
 */
const BASE_URL = 'https://script.google.com/macros/s/AKfycbxh1foEg_C7IlblKyZC-o4MtQblzFplUz6_CzZijJtk-cBE91oY-hS0gGJ8eK0wW-smjA/exec';

window.app = {
    token: localStorage.getItem('sk_token'),
    role: localStorage.getItem('sk_role'),
    email: localStorage.getItem('sk_email'),
    currentTable: '',
    schema: {},
    modes: {},
    editingId: null,
    resourceCache: {},
    rowsRaw: [],
    allResources: [],

    async init() {
        if (!this.token) return;
        
        // Sembunyikan login & Set UI Identity
        document.getElementById('login-screen')?.classList.add('hidden');
        
        // Gunakan Optional Chaining (?.) agar tidak error jika element belum ada
        if(document.getElementById('u-email')) document.getElementById('u-email').innerText = this.email;
        if(document.getElementById('u-role')) document.getElementById('u-role').innerText = this.role;
        if(document.getElementById('u-avatar')) document.getElementById('u-avatar').innerText = (this.email || '?').charAt(0).toUpperCase();

        // 1. Ambil Resource (Daftar Tabel)
        // Catatan: Pastikan di GAS (Backend) action-nya adalah 'getResources' atau 'listResources'
        const res = await this.get({ action: 'getResources' }); 
        if (res?.success) {
            this.allResources = res.resources;
            this.renderSidebar();
            this.openDashboard();
        }
    },

    async get(params) {
        try {
            const q = new URLSearchParams({ ...params, token: this.token }).toString();
            const res = await fetch(`${BASE_URL}?${q}`);
            return await res.json();
        } catch (e) { return { success: false, message: "Koneksi Terputus" }; }
    },

    async post(action, data) {
        try {
            const res = await fetch(BASE_URL, {
                method: 'POST',
                // Pastikan format body sesuai dengan yang diterima doPost di GAS
                body: JSON.stringify({ action, table: this.currentTable, data, token: this.token })
            });
            return await res.json();
        } catch (e) { return { success: false }; }
    },

    // --- FORM AUTOMATION ---
    async populateLookup(id, table, field, currentVal) {
        const el = document.getElementById(`f-${id}`);
        if (!el) return;
        
        let sourceData = this.resourceCache[table];
        if (!sourceData) {
            const res = await this.get({ action: 'read', table: table });
            if (res.success) {
                this.resourceCache[table] = res.rows;
                sourceData = res.rows;
            }
        }

        if (sourceData) {
            const opts = [...new Set(sourceData.map(r => r[field]))].filter(v => v);
            el.innerHTML = `<option value="">-- Pilih --</option>` + 
                opts.map(opt => `<option value="${opt}" ${String(opt) === String(currentVal) ? 'selected' : ''}>${opt}</option>`).join('');
        }
    },

    async triggerLookup(fieldId, selectedValue) {
        const s = this.schema[fieldId];
        if (!s || !selectedValue) return;

        const tableSource = s.lookup ? s.lookup.table : (s.autoTable || '');
        const keyField = s.lookup ? s.lookup.field : fieldId;
        let sourceData = this.resourceCache[tableSource];

        if (sourceData) {
            const row = sourceData.find(r => String(r[keyField]) === String(selectedValue));
            if (row) {
                for (let key in this.schema) {
                    const cfg = this.schema[key];
                    if (cfg.autoTrigger === fieldId) {
                        const sourceKey = cfg.autoCol || key;
                        this.updateFieldValue(key, row[sourceKey]);
                    }
                }
            }
        }
        this.runLiveFormula();
    },

    runLiveFormula() {
        for (let key in this.schema) {
            if (this.schema[key].formula && this.schema[key].formula !== "null") {
                let formula = this.schema[key].formula;
                let solved = formula.replace(/{(\w+)}/g, (match, f) => {
                    const el = document.getElementById(`f-${f}`);
                    const hid = document.getElementById(`f-${f}-hidden`);
                    return (hid ? hid.value : el?.value) || 0;
                });
                try {
                    const result = eval(solved);
                    this.updateFieldValue(key, result);
                } catch (e) { }
            }
        }
    },

    updateFieldValue(id, val) {
        const el = document.getElementById(`f-${id}`);
        const hid = document.getElementById(`f-${id}-hidden`);
        if (el) el.value = val;
        if (hid) hid.value = val;
    },

    // --- NAVIGATION ---
    toggleSidebar() {
        const sb = document.getElementById('main-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sb) return;

        const isOpen = sb.classList.contains('sidebar-open');
        if (isOpen) {
            sb.classList.replace('sidebar-open', 'sidebar-closed');
            overlay?.classList.add('hidden');
        } else {
            sb.classList.replace('sidebar-closed', 'sidebar-open');
            overlay?.classList.remove('hidden');
        }
    },

    openDashboard() {
        document.getElementById('view-crud')?.classList.add('hidden');
        document.getElementById('search-container')?.classList.add('hidden');
        document.getElementById('btn-add')?.classList.add('hidden');
        
        document.getElementById('view-dashboard')?.classList.remove('hidden');
        document.getElementById('cur-title').innerText = "DASHBOARD";
        
        if (window.Dashboard) Dashboard.open();
    },

    async selectResource(id) {
        this.currentTable = id;
        document.getElementById('view-dashboard')?.classList.add('hidden');
        
        document.getElementById('view-crud')?.classList.remove('hidden');
        document.getElementById('search-container')?.classList.remove('hidden');
        document.getElementById('btn-add')?.classList.remove('hidden');
        
        document.getElementById('cur-title').innerText = id.replace(/_/g, ' ').toUpperCase();
        
        // Sinkronisasi Sidebar Active UI
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('sidebar-active'));
        document.getElementById(`db-${id}`)?.classList.add('sidebar-active');

        if (window.CRUD) await CRUD.loadResource();
    },

    renderSidebar() {
        const list = document.getElementById('resource-list');
        if(!list) return;
        
        list.innerHTML = this.allResources.map(r => `
            <button onclick="app.selectResource('${r.id}')" id="db-${r.id}"
                class="nav-btn w-full flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-[11px] tracking-widest uppercase text-slate-400 hover:bg-white/5 transition-all text-left">
                <i class="fa-solid fa-database text-[10px] opacity-40"></i>
                <span class="truncate">${r.id}</span>
            </button>
        `).join('');
    },

    // Bridge ke modul CRUD (Pastikan crud.js sudah ter-load)
    save: (e) => window.CRUD && CRUD.save(e),
    openForm: (d) => window.CRUD && CRUD.openForm(d),
    closeForm: () => window.CRUD && CRUD.closeForm(),
    loadResource: (force) => window.CRUD && CRUD.loadResource(force),
    filterTable: (q) => window.CRUD && CRUD.filterTable(q),
    logout() { localStorage.clear(); location.reload(); }
};

// Start
app.init();