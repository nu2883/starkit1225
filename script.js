// 1. Ambil dari storage
const DYNAMIC_ENGINE_URL = localStorage.getItem('sk_engine_url');
const DYNAMIC_SHEET_ID   = localStorage.getItem('sk_sheet');

function showLoading(status) {
  const loader = document.getElementById('loader'); // Pastikan ID ini ada di HTML Anda
  if (!loader) return;
  status ? loader.classList.remove('hidden') : loader.classList.add('hidden');
}

const app = {
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
  dataCache: {},
  widgetResults: [],
  sortState: {
    column: null,
    direction: null // 'asc' | 'desc' | null
  },
  dashboardConfigs: JSON.parse(localStorage.getItem('sk_dashboard_config')) || [],
  permissions: {}, // Sekarang berbentuk Object Map





  async populateLookup(id, table, field, currentVal) {
    const el = document.getElementById(`f-${id}`);
    const opts = await this.getLookupOptions(table, field);
    if (el) el.innerHTML = `<option value="">-- Pilih --</option>` + opts.map(opt => `<option value="${opt}" ${String(opt) === String(currentVal) ? 'selected' : ''}>${opt}</option>`).join('');
  },

  async getLookupOptions(table, field) {
    if (this.resourceCache[table]) return [...new Set(this.resourceCache[table].map(r => r[field]))].filter(v => v);
    const res = await this.get({ action: 'read', table: table });
    if (res.success) {
      this.resourceCache[table] = res.rows;
      return [...new Set(res.rows.map(r => r[field]))].filter(v => v);
    }
    return [];
  },


  updateFieldValue(id, val) {
    const el = document.getElementById(`f-${id}`);
    const hid = document.getElementById(`f-${id}-hidden`);
    if (el) el.value = val;
    if (hid) hid.value = val;
  },

  runLiveFormula() {
    for (let key in this.schema) {
      if (this.schema[key].formula) {
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







  syncStudioOptions(targetId = null) {
    // 1. Ambil list tabel dan pastikan ID-nya bersih (lowercase, no space)
    const tableOpts = '<option value="">-- Pilih Tabel --</option>' +
      (this.allResources || []).map(r => {
        const cleanId = r.id.toLowerCase().replace(/\s+/g, ''); // Paksa bersih
        return `<option value="${cleanId}">${cleanId}</option>`; // Tampilkan apa adanya (lowercase)
      }).join('');

    const updateRow = (divId) => {
      const relT = document.querySelector(`#st-f-${divId} .st-rel-table`);
      if (relT) {
        // Selalu update agar sinkron dengan resource terbaru
        relT.innerHTML = tableOpts;
      }
    };

    if (targetId) {
      updateRow(targetId);
    } else {
      document.querySelectorAll('div[id^="st-f-"]').forEach(d => updateRow(d.id.replace('st-f-', '')));
    }
  },

  // 1. Fungsi pengisi dropdown (Hanya berikan Field ID Asli)
  populateStudioFields: function (id, tableName) {
    // 1. Ambil skema dari cache
    const resource = this.schemaCache[tableName];
    const select = document.querySelector(`#st-f-${id} .st-rel-field`);

    if (!select || !resource || !resource.schema) {
      if (select) select.innerHTML = '<option value="">-- Kolom Tidak Ditemukan --</option>';
      return;
    }

    // 2. Ambil semua key asli dari schema
    const fieldKeys = Object.keys(resource.schema);

    // 3. Render ke Dropdown
    select.innerHTML = `
    <option value="">-- Pilih Kolom --</option>
    ${fieldKeys.map(key => {
      // Kita bersihkan key: kecilkan semua & hapus spasi untuk VALUE mesin
      const cleanKey = key.toLowerCase().replace(/\s+/g, '');

      // Tampilkan key yang bersih di dropdown agar Juragan tahu ID aslinya
      return `<option value="${cleanKey}">${cleanKey}</option>`;
    }).join('')}
  `;
  },

  toggleStudioUI(id, type) {
    const row = document.getElementById(`st-f-${id}`);
    const relUI = document.getElementById(`relasi-ui-${id}`);

    // Hapus UI Autofill lama jika ada agar tidak double
    const oldAuto = document.getElementById(`autofill-ui-${id}`);
    if (oldAuto) oldAuto.remove();

    // Sembunyikan UI Relasi standar
    relUI.classList.add('hidden');

    if (type === 'LOOKUP') {
      relUI.classList.remove('hidden');
      this.syncStudioOptions(id);
    } else if (type === 'AUTOFILL') {
      // BUAT 3 KOLOM DROPDOWN UNTUK AUTOFILL
      const html = `
            <div id="autofill-ui-${id}" class="p-4 bg-orange-50 rounded-xl grid grid-cols-3 gap-3 border border-orange-100 mt-2 animate-fade-in">
              <div>
                <label class="block text-[9px] font-black mb-1 text-orange-400 ">Pemicu (Dropdown)</label>
                <select class="st-auto-trigger w-full p-2 border rounded-lg text-xs font-bold bg-white focus:ring-2 ring-orange-200 outline-none">
                  <option value="">-- Pilih Trigger --</option>
                </select>
              </div>
              <div>
                <label class="block text-[9px] font-black mb-1 text-orange-400 ">Tabel Sumber</label>
                <select class="st-auto-table w-full p-2 border rounded-lg text-xs font-bold bg-white focus:ring-2 ring-orange-200 outline-none" 
                        onchange="app.populateAutofillFields('${id}', this.value)">
                  <option value="">-- Pilih Tabel --</option>
                </select>
              </div>
              <div>
                <label class="block text-[9px] font-black mb-1 text-orange-400 ">Ambil Kolom</label>
                <select class="st-auto-col w-full p-2 border rounded-lg text-xs font-bold bg-white focus:ring-2 ring-orange-200 outline-none">
                  <option value="">-- Pilih Kolom --</option>
                </select>
              </div>
            </div>`;
      relUI.insertAdjacentHTML('afterend', html);

      // Isi data dropdown-nya
      this.syncAutofillOptions(id);
    }
  },
  async populateAutofillFields(id, tableName) {
    if (!tableName) return;
    const colSelect = document.querySelector(`#autofill-ui-${id} .st-auto-col`);
    colSelect.innerHTML = '<option value="">Loading...</option>';

    // Fetch data schema tabel sumber
    const d = await this.get({ action: 'read', table: tableName, limit: 1 });
    if (d.success && d.schema) {
      colSelect.innerHTML = '<option value="">-- Pilih Kolom --</option>' +
        Object.keys(d.schema).map(f => `<option value="${f}">${f}</option>`).join('');
    } else {
      colSelect.innerHTML = '<option value="">Gagal muat kolom</option>';
    }
  },
  syncAutofillOptions(id) {
    const row = document.getElementById(`st-f-${id}`);
    const triggerSelect = row.querySelector('.st-auto-trigger');
    const tableSelect = row.querySelector('.st-auto-table');

    // 1. Ambil semua field yang sudah dibuat di studio saat ini untuk jadi pemicu
    const currentFields = Array.from(document.querySelectorAll('.st-name'))
      .map(input => input.value)
      .filter(v => v !== "");

    triggerSelect.innerHTML = '<option value="">-- Pilih Trigger --</option>' +
      currentFields.map(f => `<option value="${f}">${f}</option>`).join('');

    // 2. Ambil daftar tabel dari resources
    if (this.allResources) {
      tableSelect.innerHTML = '<option value="">-- Pilih Tabel --</option>' +
        this.allResources.map(r => `<option value="${r.id}">${r.id}</option>`).join('');
    }
  },



  renderSchemaData() {
    const container = document.getElementById('schema-content-area');
    if (!container) return;

    let html = `
          <div class="animate-fade-in pb-20 space-y-12">
            <div class="flex flex-col gap-1 border-l-4 border-blue-600 pl-6 py-2">
               <h2 class="text-3xl font-black text-slate-900 tracking-tighter uppercase">System Architecture</h2>
               <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Operational Database Schema • Live Internal Data</p>
            </div>`;

    Object.entries(this.fullAppData || {}).forEach(([tableName, content]) => {
      const schema = content.schema;
      html += `
            <div class="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div class="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/20">
                    <i class="fa-solid fa-table-cells text-white text-sm"></i>
                  </div>
                  <div>
                    <h3 class="text-lg font-black text-slate-900 uppercase tracking-tight">${tableName}</h3>
                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Table Resource</p>
                  </div>
                </div>
                
                <button onclick="app.editSchemaShortcut('${tableName}')" 
                  class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                  <i class="fa-solid fa-pen-to-square"></i>
                  UBAH SKEMA
                </button>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-[11px]">
                  <thead>
                    <tr class="text-[9px] font-black uppercase text-slate-400 tracking-[0.15em] border-b border-slate-100">
                      <th class="px-8 py-5">Field Structure</th>
                      <th class="px-8 py-5 text-center">Visibility</th>
                      <th class="px-8 py-5 text-center">Validation</th>
                      <th class="px-8 py-5">Logic Engine</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                    ${Object.entries(schema).map(([k, v]) => {
        const isSystem = v.hidden;
        return `
                      <tr class="group transition-all ${isSystem ? 'bg-slate-50/40 opacity-70' : 'hover:bg-blue-50/30'}">
                        <td class="px-8 py-5">
                          <div class="flex flex-col">
                            <span class="text-sm font-bold text-slate-800 uppercase tracking-tight group-hover:text-blue-600 transition-colors">${k}</span>
                            <div class="flex items-center gap-2 mt-1">
                               <span class="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 uppercase">${v.type || 'TEXT'}</span>
                               <span class="text-[9px] text-slate-400 font-medium italic">${v.label || '-'}</span>
                            </div>
                          </div>
                        </td>
                        <td class="px-8 py-5 text-center">
                           <i class="fa-solid ${v.hidden ? 'fa-eye-slash text-slate-300' : 'fa-eye text-emerald-500'} text-sm"></i>
                        </td>
                        <td class="px-8 py-5 text-center">
                           <div class="flex justify-center gap-2">
                             <span title="Required" class="w-2 h-2 rounded-full ${v.required ? 'bg-blue-500' : 'bg-slate-100'} shadow-sm"></span>
                             <span title="Disabled" class="w-2 h-2 rounded-full ${v.disabled ? 'bg-orange-500' : 'bg-slate-100'} shadow-sm"></span>
                           </div>
                        </td>
                        <td class="px-8 py-5">
                          ${this.badgeLogic(v)}
                        </td>
                      </tr>`;
      }).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
    });
    container.innerHTML = html + `</div>`;
  },

  badgeLogic(v) {
    let badges = [];

    // 1. LOOKUP (Relational)
    if (v.lookup || v.type === 'LOOKUP') {
      const table = v.lookup?.table || v.autoTable || 'table';
      const field = v.lookup?.field || v.autoCol || 'field';
      badges.push(`
            <div class="flex flex-col gap-1.5 bg-blue-50 p-3 rounded-2xl border border-blue-100 min-w-[150px]">
              <span class="text-[9px] font-black text-blue-600 uppercase tracking-tighter flex items-center gap-2">
                <i class="fa-solid fa-link text-[10px]"></i> Relational Lookup
              </span>
              <span class="text-[10px] font-bold text-blue-900 uppercase tracking-tighter bg-white/50 px-2 py-1 rounded border border-blue-200/50">
                ${table} <i class="fa-solid fa-chevron-right text-[8px] mx-1 opacity-30"></i> ${field}
              </span>
            </div>`);
    }

    // 2. AUTO-INJECTION (Autofill)
    if (v.type === 'AUTOFILL' || v.autoTrigger) {
      badges.push(`
            <div class="flex flex-col gap-2 bg-orange-50 p-3 rounded-2xl border border-orange-100 min-w-[180px]">
              <div class="flex items-center gap-2">
                <i class="fa-solid fa-bolt-lightning text-orange-500 text-[10px]"></i>
                <span class="text-[9px] font-black text-orange-600 uppercase tracking-tighter">Auto-Injection Flow</span>
              </div>
              <div class="flex items-center gap-2 bg-white/50 p-1.5 rounded-lg border border-orange-200/50">
                <span class="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[8px] font-black uppercase">${v.autoTrigger || 'trigger'}</span>
                <i class="fa-solid fa-arrow-right-long text-orange-300 text-[10px]"></i>
                <span class="text-[10px] font-bold text-orange-800 tracking-tight">${v.autoTable || 'table'}.${v.autoCol || 'col'}</span>
              </div>
            </div>`);
    }

    // 3. FORMULA (Compute)
    if (v.type === 'FORMULA' || v.formula) {
      badges.push(`
            <div class="flex flex-col gap-1.5 bg-purple-50 p-3 rounded-2xl border border-purple-100 min-w-[150px]">
              <span class="text-[9px] font-black text-purple-600 uppercase tracking-tighter flex items-center gap-2">
                <i class="fa-solid fa-calculator text-[10px]"></i> Compute Engine
              </span>
              <code class="text-[11px] font-black text-purple-900 bg-white/50 px-2 py-1 rounded border border-purple-200/50">${v.formula}</code>
            </div>`);
    }

    return badges.length > 0
      ? `<div class="flex flex-wrap gap-2">${badges.join('')}</div>`
      : `<span class="text-slate-300 text-[9px] font-bold uppercase tracking-[0.2em] italic pl-2">Standard Data</span>`;
  },

  editSchemaShortcut(tableName) {
    this.openAppStudio();
    const selector = document.getElementById('st-table-selector');
    if (selector) {
      selector.value = tableName;
      selector.dispatchEvent(new Event('change'));
    }
  },

  // Fungsi pembantu agar kode selectResource lebih bersih
  updateSidebarUI(id) {
    // 1. SAPU BERSIH: Ambil SEMUA elemen yang mungkin punya warna biru
    // Kita incar semua button di dalam nav
    document.querySelectorAll('nav button, .nav-btn').forEach(b => {
      b.classList.remove('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');
      b.classList.add('text-slate-400');
    });

    // 2. WARNAI YANG BARU: Hanya tombol yang ID-nya pas dengan menu sekarang
    const activeBtn = document.getElementById(`nav-${id}`);
    if (activeBtn) {
      activeBtn.classList.remove('text-slate-400');
      activeBtn.classList.add('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');
    }

    // 3. UPDATE JUDUL
    const titleEl = document.getElementById('cur-title');
    if (titleEl) titleEl.innerText = id.replace(/_/g, ' ').toUpperCase();
  },

  // Fungsi pembantu agar navigasi tidak biru semua


  // Masukkan di dalam const app = { ... }




  // --- SCHEMA SECTION ---
  viewSchemaExplorer() {
    this.resetViews();
    this.currentView = 'explorer';
    this.currentTable = 'SCHEMA_EXPLORER';

    // 1. UI Switch (Kamar CRUD & Studio ditutup)
    document.getElementById('view-crud')?.classList.add('hidden');
    document.getElementById('view-app-studio')?.classList.add('hidden');
    document.getElementById('view-schema-explorer')?.classList.remove('hidden');

    // --- TAMBAHAN: Sembunyikan Search Bar (Penting!) ---
    document.getElementById('search-container')?.classList.add('hidden');

    // 2. Header & Navigasi
    const titleEl = document.getElementById('cur-title');
    if (titleEl) titleEl.innerText = "SCHEMA INTELLIGENCE";

    document.querySelectorAll('.nav-btn, #nav-app-studio, #nav-schema-explorer').forEach(b => {
      b.classList.remove('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');
      b.classList.add('text-slate-400');
    });

    const navBtn = document.getElementById('nav-schema-explorer');
    if (navBtn) navBtn.classList.add('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');

    // 3. Render Data dengan Cleansing
    // Kita kosongkan dulu agar tidak ada data "hantu" dari proses sebelumnya
    const container = document.getElementById('schema-content-area');
    if (container) container.innerHTML = '';

    this.renderSchemaData();
  },


  // --- DASHBOARD SECTION ---

  async selectResource(id) {
    if (this.currentTable === id && this.currentView === 'data') return;

    // 1. Matikan semua view (termasuk dashboard & crud)
    this.resetViews();

    // 2. Set State
    this.currentTable = id;
    this.currentView = 'data';

    // 3. AKTIFKAN KEMBALI CONTAINER CRUD (Ini yang bikin tabel muncul)
    const crudView = document.getElementById('view-crud');
    const searchContainer = document.getElementById('search-container');

    if (crudView) {
      crudView.classList.remove('hidden'); // Membuka pintu utama
      crudView.style.visibility = 'visible'; // Memastikan terlihat
    }
    if (searchContainer) searchContainer.classList.remove('hidden');

    // 4. Update Header Judul
    const titleEl = document.getElementById('cur-title');
    if (titleEl) titleEl.innerText = id.replace(/_/g, ' ').toUpperCase();

    this.syncSidebarUI(id);

    // 5. Load Data
    if (this.resourceCache[id]) {
      this.schema = this.schemaCache[id]?.schema || {};
      this.renderTable(this.resourceCache[id]);
      this.loadResource();
    } else {
      await this.loadResource();
    }
  },
  renderSidebar() {
    const list = document.getElementById('resource-list');
    if (!list) return;

    // Filter unik ID Tabel
    const unique = [...new Map(this.allResources.map(item => [item.id, item])).values()];

    list.innerHTML = unique.map(r => `
          <button onclick="app.selectResource('${r.id}')" id="nav-${r.id}" 
            class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all text-left uppercase tracking-wider">
            <i class="fa-solid fa-table text-[10px] opacity-40"></i> <span>${r.id}</span>
          </button>
        `).join('');
  },

  // Tambahkan ke dalam objek app { ... }





  addDashboardWidgetConfig() {
    this.dashboardConfigs.push({ name: 'Widget Baru', table: '', type: 'COUNT', column: '' });
    this.renderDashboardBuilder();
  },
  // --- RENDER DASHBOARD UTAMA BERDASARKAN CONFIG ---

  resetViews() {
    // Daftar semua container view yang ada di HTML
    const views = [
      'view-crud',
      'view-app-studio',
      'view-schema-explorer',
      'view-dashboard',
      'view-dashboard-builder', // Tambahkan ini agar tidak "nyangkut"
      'automation-builder-section',
      'view-permissions'
    ];

    views.forEach(v => {
      const el = document.getElementById(v);
      if (el) el.classList.add('hidden');
    });

    // Sembunyikan juga elemen header yang spesifik untuk tabel
    document.getElementById('search-container')?.classList.add('hidden');
    document.getElementById('btn-add')?.classList.add('hidden');
    document.getElementById('view-mode')?.classList.add('hidden');
  },

  syncSidebarUI(id) {
    // 1. Bersihkan semua status active dari semua tombol navigasi
    document.querySelectorAll('.nav-btn, aside nav button').forEach(btn => {
      btn.classList.remove('sidebar-active', 'bg-[#1e293b]', 'text-white');
      btn.classList.add('text-slate-400');
    });

    // 2. Cari tombol yang diklik berdasarkan ID-nya
    // id bisa berupa: 'dashboard', 'dashboard-builder', 'app-studio', atau 'NAMA_TABEL'
    const targetId = `nav-${id.toLowerCase().replace(/_/g, '-')}`;
    const activeBtn = document.getElementById(targetId);

    if (activeBtn) {
      activeBtn.classList.add('sidebar-active', 'bg-[#1e293b]', 'text-white');
      activeBtn.classList.remove('text-slate-400');
    }

    // 3. Update Judul di Header
    const titleMap = {
      'dashboard': 'Dashboard Overview',
      'dashboard-builder': 'Dashboard Architect',
      'app-studio': 'Table Architect',
      'schema-explorer': 'Schema Explorer'
    };

    document.getElementById('cur-title').innerText = titleMap[id] || id.replace(/_/g, ' ').toUpperCase();
  },

  // --- AUTOMATION ENGINE ---
  showAutomationBuilder: function () {
    this.resetViews();
    const section = document.getElementById('automation-builder-section');
    if (section) {
      section.classList.remove('hidden');
      document.getElementById('cur-title').innerText = "Automation Engine";
      this.renderAutomationBuilder();
    } else {
      console.error("ID 'automation-builder-section' tidak ditemukan di HTML");
    }
  },

  hideAllSections: function () {
    // Daftar semua ID section yang ada di HTML juragan
    const sections = [
      'view-crud',
      'view-app-studio',
      'view-schema-explorer',
      'view-dashboard',
      'view-dashboard-builder',
      'automation-builder-section'
    ];

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    // Sembunyikan elemen header tambahan jika ada
    const search = document.getElementById('search-container');
    const btnAdd = document.getElementById('btn-add');
    if (search) search.classList.add('hidden');
    if (btnAdd) btnAdd.classList.add('hidden');
  },
  // --- PERBAIKAN TRIGGER LOOKUP & AUTOFILL (VERSI JURAGAN SAAS) ---
  async triggerLookup(fieldId, selectedValue) {
    const s = this.schema[fieldId];
    if (!s || !selectedValue) return;

    // 1. Identifikasi Tabel Sumber (Tabel Kopi)
    const tableSource = s.lookup ? s.lookup.table : (s.autoTable || '');
    const keyField = s.lookup ? s.lookup.field : fieldId;
    let sourceData = this.resourceCache[tableSource];

    if (sourceData) {
      // 2. Cari baris kopi yang dipilih
      const row = sourceData.find(r => String(r[keyField]) === String(selectedValue));

      if (row) {
        // 3. Loop semua kolom di form Penjualan
        for (let key in this.schema) {
          const cfg = this.schema[key];

          // 4. CEK: Apakah kolom ini adalah AUTOFILL yang dipicu oleh fieldId ini?
          if (cfg.autoTrigger === fieldId || (cfg.type === 'AUTOFILL' && cfg.autoTrigger === fieldId)) {

            // AMBIL NILAI: Gunakan mapping autoCol (misal: 'id') atau default ke 'key'
            const sourceKey = cfg.autoCol || key;
            const valueToFill = row[sourceKey];

            if (valueToFill !== undefined) {
              console.log(`[Autofill Success] Mengisi ${key} dengan ${valueToFill}`);
              this.updateFieldValue(key, valueToFill);
            }
          }
        }
      }
    }
    this.runLiveFormula();
  },

  // 1. Fungsi Navigasi (Pastikan resetViews sudah ada di object app)
  // GANTI openAccessControl Anda dengan versi LIVE ini:
  // 1. Fungsi Navigasi (Dynamic Version)
  async openAccessControl() {
    this.resetViews();

    const view = document.getElementById('view-permissions');
    const container = document.getElementById('permissions-content-area');
    if (view) view.classList.remove('hidden');
    document.getElementById('cur-title').innerText = "ACCESS CONTROL";

    // Tampilkan loading sebentar biar user tahu aplikasi sedang bekerja
    container.innerHTML = `<div class="p-20 text-center font-black opacity-20 animate-pulse tracking-[0.5em]">SYNCING SECURITY...</div>`;

    // AMBIL DATA LIVE DARI GOOGLE SHEETS
    const res = await this.get({ action: 'read', table: 'config_permissions' });

    if (res.success && res.rows) {
      this.renderPermissions(res.rows);
    } else {
      container.innerHTML = `<div class="p-10 text-center text-red-500 font-bold uppercase">Sync Failed: ${res.message}</div>`;
    }
  },

  // 2. Fungsi Renderer (Desain "Security Guard" Juragan)
  renderPermissions(data) {
    const container = document.getElementById('permissions-content-area');
    if (!container) return;

    // Helper agar tidak case-sensitive terhadap nama kolom di Sheets
    const getVal = (obj, key) => {
      const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
      return obj[foundKey] !== undefined ? obj[foundKey] : '';
    };

    let html = `
          <div class="animate-fade-in pb-20 space-y-8">
            <div class="flex flex-col gap-1 border-l-4 border-red-500 pl-6 py-2">
              <h2 class="text-3xl font-black text-slate-900 tracking-tighter uppercase">Security Guard</h2>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Access Control List • Policy Management</p>
            </div>

            <div class="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
              <table class="w-full text-left">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                    <th class="px-8 py-6">Resource / Table</th>
                    <th class="px-6 py-6 text-center">Role</th>
                    <th class="px-4 py-6 text-center">Browse</th>
                    <th class="px-4 py-6 text-center">Add</th>
                    <th class="px-4 py-6 text-center">Edit</th>
                    <th class="px-4 py-6 text-center">Delete</th>
                    <th class="px-8 py-6">Policy</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
        `;

    data.forEach(p => {
      const can = (val) => (String(val).toUpperCase() === 'TRUE')
        ? '<div class="w-6 h-6 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-100"><i class="fa-solid fa-check text-[10px]"></i></div>'
        : '<div class="w-6 h-6 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center mx-auto border border-slate-100"><i class="fa-solid fa-xmark text-[10px]"></i></div>';

      const role = getVal(p, 'role');
      const policy = getVal(p, 'ownership_policy');

      html += `
            <tr class="hover:bg-slate-50/50 transition-colors group">
              <td class="px-8 py-5">
                <span class="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-blue-600">${getVal(p, 'resource')}</span>
              </td>
              <td class="px-6 py-5 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}">${role}</span>
              </td>
              <td class="px-4 py-5 text-center">${can(getVal(p, 'can_browse'))}</td>
              <td class="px-4 py-5 text-center">${can(getVal(p, 'can_add'))}</td>
              <td class="px-4 py-5 text-center">${can(getVal(p, 'can_edit'))}</td>
              <td class="px-4 py-5 text-center">${can(getVal(p, 'can_delete'))}</td>
              <td class="px-8 py-5">
                <div class="flex items-center gap-2">
                  <i class="fa-solid ${policy === 'ALL' ? 'fa-globe-asia text-blue-400' : 'fa-user-lock text-orange-400'} text-xs"></i>
                  <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${policy}</span>
                </div>
              </td>
            </tr>`;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
  },



  openDashboardBuilder() {
    this.resetViews();
    this.currentView = 'dashboard-builder';

    // Panggil sync dengan ID yang sesuai dengan ID tombol di HTML (tanpa prefix nav-)
    this.syncSidebarUI('dashboard-builder');

    document.getElementById('view-dashboard-builder').classList.remove('hidden');
    this.renderDashboardBuilder();
  },

  // 3. Tambah Widget Baru (Kosong)
  addDashboardWidgetConfig: function () {
    this.dashboardConfigs.push({
      name: 'Widget Baru',
      table: '',
      type: 'COUNT',
      column: ''
    });
    this.renderDashboardBuilder();
  },

  // 4. Hapus Widget
  deleteWidgetConfig: function (index) {
    if (confirm("Hapus widget ini, juragan?")) {
      this.dashboardConfigs.splice(index, 1);
      this.renderDashboardBuilder();
    }
  },





  async saveAutomationRule() {
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;

    // 1. Ambil Data dari Form Automation
    const thenValRaw = document.getElementById('then-value').value;

    // SOLUSI: Jika diawali + atau -, tambahkan kutip satu agar Google Sheets membacanya sebagai TEXT
    const safeThenValue = (thenValRaw.startsWith('+') || thenValRaw.startsWith('-'))
      ? "'" + thenValRaw
      : thenValRaw;

    const config = {
      event: document.getElementById('auto-event').value,
      source_table: document.getElementById('auto-table').value,
      if_field: document.getElementById('if-field').value,
      if_op: document.getElementById('if-op').value,
      if_value: document.getElementById('if-value').value,
      target_table: document.getElementById('then-table').value,
      then_field: document.getElementById('then-field').value,
      then_mode: document.getElementById('then-mode').value,
      then_value: safeThenValue, // Gunakan yang sudah diproteksi
      match_field: document.getElementById('match-field').value,
      match_source: document.getElementById('match-source').value
    };

    // 2. Validasi Sederhana
    if (!config.source_table || !config.target_table || !config.match_field) {
      alert("Waduh Juragan, Tabel Sumber, Target, dan Matching Logic wajib diisi!");
      return;
    }

    // 3. Kirim ke Backend
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> DEPLOYING...';
    btn.disabled = true;

    try {
      // Pastikan table 'config_automations' atau sesuai nama di BE juragan
      const res = await this.post({
        action: 'create_automation',
        table: 'config_automations', // Pastikan nama tabel sinkron
        data: config
      });

      if (res.success) {
        alert("🚀 AUTOMATION DEPLOYED! Mesin otomasi sudah aktif.");
        this.openDashboard();
      } else {
        alert("Gagal deploy: " + res.message);
      }
    } catch (e) {
      alert("Terjadi kesalahan koneksi saat deploy engine.");
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  },
  updateAutoFields: async function (type, tableName) {
    if (!tableName) return;

    // 1. Ambil dari Cache atau Fetch
    let schema = this.schemaCache[tableName]?.schema;

    if (!schema) {
      const targetId = type === 'source' ? 'if-field' : 'then-field';
      const el = document.getElementById(targetId);
      if (el) el.innerHTML = '<option>Loading Fields...</option>';

      const res = await this.get({ action: 'read', table: tableName, limit: 1 });
      if (res.success && res.schema) {
        this.schemaCache[tableName] = { schema: res.schema };
        schema = res.schema;
      } else {
        alert("Gagal membedah tabel " + tableName);
        return;
      }
    }

    // 2. Bedah Metadata MURNI (Tanpa .toUpperCase)
    const fields = Object.keys(schema);

    const makeOptions = (withBrackets = false) => {
      return fields.map(f => {
        // Ambil label asli dari metadata, jika tidak ada pakai nama field asli
        const label = schema[f]?.label || f;
        const val = withBrackets ? `{${f}}` : f;

        // Tampilan murni: Nama Label [nama_field] 
        // Contoh: JENIS KOPI [jeniskopi]
        return `<option value="${val}">${label} [${f}]</option>`;
      }).join('');
    };

    // 3. Distribusi ke Dropdown
    if (type === 'source') {
      document.getElementById('if-field').innerHTML = `<option value="">-- PILIH FIELD --</option>` + makeOptions();
      document.getElementById('match-source').innerHTML = `<option value="">-- FIELD SUMBER --</option>` + makeOptions(true);
    } else {
      document.getElementById('then-field').innerHTML = `<option value="">-- FIELD TARGET --</option>` + makeOptions();
      document.getElementById('match-field').innerHTML = `<option value="">-- FIELD TARGET --</option>` + makeOptions();
    }

    console.log(`✅ Dropdown ${tableName} Updated secara murni!`);
  },
  renderAutomationBuilder: function () {
    const container = document.getElementById('automation-builder');
    if (!container) return;

    const tables = (this.allResources || []).map(r => r.id);

    container.innerHTML = `
<div class="max-w-6xl mx-auto space-y-10 p-10 bg-white rounded-[3rem] shadow-2xl animate-fade-in text-left">
  
  <div class="flex justify-between items-center border-b pb-6">
    <div>
      <h2 class="text-2xl font-black uppercase tracking-tighter text-slate-900">Automation Engine</h2>
      <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Smart Data-Driven Logic</p>
    </div>
    <div class="bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl flex items-center gap-2">
      <i class="fa-solid fa-microchip"></i>
      <span class="text-[10px] font-black uppercase tracking-widest">Active System</span>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-10">

    <div class="space-y-4">
      <h4 class="font-black text-[11px] uppercase tracking-widest text-blue-600 italic">1. WHEN (Source Event)</h4>
      <select id="auto-event" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold">
        <option value="CREATE">ON CREATE</option>
        <option value="UPDATE">ON UPDATE</option>
      </select>
      
      <select id="auto-table" onchange="app.updateAutoFields('source', this.value)" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-2 ring-blue-50 focus:ring-blue-500 outline-none">
        <option value="">-- PILIH TABEL SUMBER --</option>
        ${tables.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>

      <div class="pt-4 border-t border-slate-100">
         <p class="text-[9px] font-black text-slate-400 uppercase mb-2">IF CONDITION</p>
         <select id="if-field" class="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold">
            <option value="">-- PILIH FIELD --</option>
         </select>
         <div class="flex gap-2 mt-2">
            <select id="if-op" class="w-20 p-3 bg-slate-100 rounded-xl text-xs font-bold">
              <option value=">">></option><option value="=">=</option><option value="<"><</option>
            </select>
            <input id="if-value" type="text" placeholder="Value" class="flex-1 p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border">
         </div>
      </div>
    </div>

    <div class="space-y-4 border-x border-slate-50 px-10">
      <h4 class="font-black text-[11px] uppercase tracking-widest text-rose-600 italic">2. THEN (Target Action)</h4>
      <select id="then-table" onchange="app.updateAutoFields('target', this.value)" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-2 ring-rose-50 focus:ring-rose-500 outline-none">
        <option value="">-- PILIH TABEL TARGET --</option>
        ${tables.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>

      <select id="then-field" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold">
        <option value="">-- FIELD YG DIUBAH --</option>
      </select>

      <select id="then-mode" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold">
        <option value="MUTATE">MUTATE (+= / -=)</option>
        <option value="SET">SET VALUE</option>
      </select>
      
      <div class="relative">
         <input id="then-value" placeholder="Formula (ex: -{qty})" class="w-full p-4 bg-rose-50 text-rose-600 rounded-2xl font-mono font-bold text-sm outline-none">
         <p class="text-[8px] font-bold text-rose-400 mt-1 uppercase tracking-tighter">*Gunakan {field} dari tabel sumber</p>
      </div>
    </div>

    <div class="space-y-4">
      <h4 class="font-black text-[11px] uppercase tracking-widest text-slate-800 italic">3. MATCH (Linking Logic)</h4>
      <div class="p-6 bg-slate-900 rounded-[2.5rem] space-y-4 shadow-xl">
         <div>
            <label class="text-[9px] font-black text-slate-400 uppercase mb-2 block">FIELD DI TABEL TARGET</label>
            <select id="match-field" class="w-full p-3 bg-white/10 text-white rounded-xl text-xs font-bold outline-none focus:bg-white/20">
              <option value="">-- PILIH FIELD TARGET --</option>
            </select>
         </div>
         <div class="text-center"><i class="fa-solid fa-equals text-blue-500"></i></div>
         <div>
            <label class="text-[9px] font-black text-slate-400 uppercase mb-2 block">DIISI DENGAN FIELD SUMBER</label>
            <select id="match-source" class="w-full p-3 bg-white/10 text-blue-300 rounded-xl text-xs font-bold outline-none focus:bg-white/20">
              <option value="">-- PILIH FIELD SUMBER --</option>
            </select>
         </div>
      </div>
    </div>

  </div>

  <div class="flex justify-end pt-8 border-t">
    <button onclick="app.saveAutomationRule()" class="px-12 py-5 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl active:scale-95">
      🚀 Deploy Automation Engine
    </button>
  </div>
</div>
`;
  },

  async saveDashboardConfig() {
    try {
      // 1. Ambil data dari tabel
      const resRead = await this.get({ action: 'read', table: 'config_dashboard' });

      // 2. Cari baris MANA SAJA yang penting ada (karena isinya pasti cuma config dashboard)
      const existingRow = resRead.success && resRead.rows.length > 0 ? resRead.rows[0] : null;

      // 3. Jika ada baris (apapun ID-nya), kita UPDATE. Jika kosong, kita CREATE.
      const actionToDo = existingRow ? 'update' : 'create';

      // 4. Jika update, gunakan ID asli yang dari BE (si SK-XXXX itu)
      const targetId = existingRow ? existingRow.id : 'USER_DASHBOARD_1';

      const payload = {
        action: actionToDo,
        table: 'config_dashboard',
        data: {
          id: targetId,
          config_json: JSON.stringify(this.dashboardConfigs),
          updated_at: new Date().toISOString()
        }
      };

      console.log(`📡 Menembak ID: ${targetId} dengan Action: ${actionToDo}`);
      const res = await this.post(payload);

      if (res.success) {
        alert("✅ Berhasil! Sekarang datanya tidak akan duplikat lagi.");
      }
    } catch (e) { console.error(e); }
  },

  updateWidgetConfig(index, key, val) {
    this.dashboardConfigs[index][key] = val;
  },

  deleteWidgetConfig(index) {
    this.dashboardConfigs.splice(index, 1);
    this.renderDashboardBuilder();
  },
  // Fungsi khusus untuk update tabel agar skema kolomnya ikut ter-fetch
  async loadDashboardConfigs() {
    const res = await this.get({ action: 'read', table: 'config_dashboard' });
    if (res.success && res.rows.length > 0) {
      this.dashboardConfigs = JSON.parse(res.rows[0].config_json);
    } else {
      // Penjelasan: Jika baris BE berkurang/nol, kita reset local state
      this.dashboardConfigs = [];
    }
  },

  // Tambahkan helper ini jika belum ada untuk gonta-ganti menu
  hideAllViews: function () {
    const views = [
      'view-crud', 'view-app-studio', 'view-schema-explorer',
      'view-dashboard', 'automation-builder-section',
      'view-dashboard-builder', 'view-permissions'
    ];
    views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  },


  updateWidgetConfig: function (index, key, val) {
    // Simpan perubahan ke state
    this.dashboardConfigs[index][key] = val;

    // Jika yang diubah adalah 'type', render ulang karena UI berubah drastis
    if (key === 'type') {
      this.renderDashboardBuilder();
    }
    // Catatan: Untuk input teks (name, formula, unit), 
    // kita TIDAK render ulang di sini agar kursor tidak mental.
  },

  updateWidgetTable: function (index, tableName) {
    this.dashboardConfigs[index].table = tableName;
    this.dashboardConfigs[index].column = ''; // Reset kolom karena tabel ganti
    this.renderDashboardBuilder(); // Render ulang agar dropdown kolom muncul
  },

  addVariable: function (widgetIndex) {
    if (!this.dashboardConfigs[widgetIndex].vars) {
      this.dashboardConfigs[widgetIndex].vars = [];
    }

    // Berikan kode otomatis (A, B, C...)
    const nextCode = String.fromCharCode(65 + this.dashboardConfigs[widgetIndex].vars.length);

    this.dashboardConfigs[widgetIndex].vars.push({
      code: nextCode,
      table: '',
      col: ''
    });

    this.renderDashboardBuilder();
  },

  updateVar: function (wIdx, vIdx, key, val) {
    this.dashboardConfigs[wIdx].vars[vIdx][key] = val;

    // Jika ganti tabel, render ulang untuk ambil list kolomnya
    if (key === 'table') {
      this.renderDashboardBuilder();
    }
  },

  removeVar: function (wIdx, vIdx) {
    this.dashboardConfigs[wIdx].vars.splice(vIdx, 1);
    this.renderDashboardBuilder();
  },

  deleteWidget: function (index) {
    if (confirm("Hapus konfigurasi widget ini, juragan?")) {
      this.dashboardConfigs.splice(index, 1);
      this.renderDashboardBuilder();
    }
  },

  renderDashboardBuilder: function () {
    const container = document.getElementById('db-builder-container');
    if (!container) return;

    // Starter jika kosong
    if (this.dashboardConfigs.length === 0) {
      this.dashboardConfigs.push({
        name: '', table: '', type: 'COUNT', column: '',
        vars: [], formula: '', color: 'slate', unit: 'Rp', icon: 'fa-wallet'
      });
    }

    container.innerHTML = this.dashboardConfigs.map((conf, index) => {
      // 1. Persiapan Data (Cache & Safety)
      const schema = this.schemaCache[conf.table]?.schema || {};
      const columnOptions = Object.keys(schema).map(col =>
        `<option value="${col}" ${conf.column === col ? 'selected' : ''}>${col.toUpperCase().replace(/_/g, ' ')}</option>`
      ).join('');

      if (!conf.vars) conf.vars = [];

      return `
      <div class="p-8 bg-white rounded-[3rem] border border-slate-200 mb-8 shadow-sm relative overflow-hidden animate-fade-in">
        
        <div class="flex justify-between items-center mb-8">
          <div class="flex items-center gap-4 w-full">
            <div class="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xs shadow-lg">${index + 1}</div>
            <input type="text" value="${conf.name}" placeholder="Nama Widget (Contoh: Sisa Stok)"
              onchange="app.updateWidgetConfig(${index}, 'name', this.value)"
              class="bg-transparent border-none font-black text-slate-800 text-lg outline-none w-2/3 uppercase tracking-tighter">
          </div>
          <button onclick="app.deleteWidgetConfig(${index})" class="text-red-300 hover:text-red-500 transition-all p-2">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div>
            <label class="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Metode Hitung</label>
            <select onchange="app.updateWidgetConfig(${index}, 'type', this.value); app.renderDashboardBuilder();" 
              class="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-purple-500/20">
              <option value="COUNT" ${conf.type === 'COUNT' ? 'selected' : ''}>COUNT (Hitung Baris)</option>
              <option value="SUM" ${conf.type === 'SUM' ? 'selected' : ''}>SUM (Total Angka)</option>
              <option value="FORMULA" ${conf.type === 'FORMULA' ? 'selected' : ''}>FORMULA (Variabel)</option>
              <option value="URGENCY" ${conf.type === 'URGENCY' ? 'selected' : ''}>URGENCY (Stok Kritis)</option>
            </select>
          </div>

          ${conf.type !== 'FORMULA' ? `
            <div>
              <label class="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Sumber Tabel</label>
              <select onchange="app.updateWidgetTable(${index}, this.value)" 
                class="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-purple-500/20 text-blue-600">
                <option value="">-- Pilih Tabel --</option>
                ${this.allResources.map(r => `<option value="${r.id}" ${conf.table === r.id ? 'selected' : ''}>${r.id.toUpperCase()}</option>`).join('')}
              </select>
            </div>
            <div class="${conf.type === 'COUNT' ? 'opacity-30 pointer-events-none' : ''}">
              <label class="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Kolom Target</label>
              <select onchange="app.updateWidgetConfig(${index}, 'column', this.value)" 
                class="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-purple-500/20">
                <option value="">-- Pilih Kolom --</option>
                ${columnOptions}
              </select>
            </div>
          ` : `
            <div class="md:col-span-2 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center">
              <p class="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
                <i class="fa-solid fa-circle-info mr-2"></i> Mode Formula Aktif: Kelola variabel di panel bawah.
              </p>
            </div>
          `}
        </div>

        ${conf.type === 'FORMULA' ? `
          <div class="mb-8 p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 animate-slide-up">
            <div class="flex justify-between items-center mb-6">
              <h5 class="text-[10px] font-black text-blue-500 uppercase tracking-widest">Kalkulasi Lintas Tabel</h5>
              <button onclick="app.addVariable(${index})" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-slate-900 transition-all shadow-md">
                + Tambah Variabel
              </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              ${conf.vars.map((v, vIdx) => `
                <div class="bg-white p-4 rounded-2xl border border-blue-100 relative group shadow-sm">
                  <div class="flex gap-2 mb-2">
                    <input type="text" value="${v.code}" onchange="app.updateVar(${index}, ${vIdx}, 'code', this.value)" 
                      class="w-10 p-2 bg-slate-100 rounded-lg font-black text-[10px] text-center uppercase outline-none">
                    <select onchange="app.updateVar(${index}, ${vIdx}, 'table', this.value)" 
                      class="flex-1 p-2 bg-slate-50 border-none rounded-lg text-[9px] font-bold outline-none text-blue-600">
                      <option value="">Pilih Tabel...</option>
                      ${this.allResources.map(r => `<option value="${r.id}" ${v.table === r.id ? 'selected' : ''}>${r.id.toUpperCase()}</option>`).join('')}
                    </select>
                  </div>
                  <select onchange="app.updateVar(${index}, ${vIdx}, 'col', this.value)" 
                    class="w-full p-2 bg-slate-50 border-none rounded-lg text-[9px] font-bold outline-none">
                    <option value="">Pilih Kolom...</option>
                    ${Object.keys(this.schemaCache[v.table]?.schema || {}).map(c => `<option value="${c}" ${v.col === c ? 'selected' : ''}>${c.toUpperCase()}</option>`).join('')}
                  </select>
                  <button onclick="app.removeVar(${index}, ${vIdx})" class="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              `).join('')}
            </div>

            <div>
              <label class="block text-[9px] font-black text-blue-400 uppercase mb-2 ml-1 tracking-widest">Rumus Matematika</label>
              <input type="text" value="${conf.formula || ''}" placeholder="Contoh: ({A} - {B}) / {A} * 100" 
                onchange="app.updateWidgetConfig(${index}, 'formula', this.value)"
                class="w-full p-5 bg-white border-2 border-blue-200 rounded-2xl font-mono text-sm font-black text-blue-700 shadow-inner outline-none focus:border-blue-500 transition-all">
            </div>
          </div>
        ` : ''}

        <div class="pt-8 border-t border-slate-50 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label class="block text-[8px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Visual Icon</label>
            <select onchange="app.updateWidgetConfig(${index}, 'icon', this.value)" 
              class="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold outline-none">
              <option value="fa-wallet" ${conf.icon === 'fa-wallet' ? 'selected' : ''}>💰 Keuangan / Saldo</option>
              <option value="fa-cart-shopping" ${conf.icon === 'fa-cart-shopping' ? 'selected' : ''}>🛒 Penjualan / Transaksi</option>
              <option value="fa-users" ${conf.icon === 'fa-users' ? 'selected' : ''}>👥 Pelanggan / User</option>
              <option value="fa-box-archive" ${conf.icon === 'fa-box-archive' ? 'selected' : ''}>📦 Stok / Inventori</option>
              <option value="fa-chart-line" ${conf.icon === 'fa-chart-line' ? 'selected' : ''}>📈 Tren Data</option>
              <option value="fa-calculator" ${conf.icon === 'fa-calculator' ? 'selected' : ''}>🧮 Perhitungan</option>
            </select>
          </div>

          <div>
            <label class="block text-[8px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Tema Warna</label>
            <select onchange="app.updateWidgetConfig(${index}, 'color', this.value)" 
              class="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold outline-none">
              <optgroup label="Standar">
                <option value="slate" ${conf.color === 'slate' ? 'selected' : ''}>🌑 Dark Slate</option>
                <option value="blue" ${conf.color === 'blue' ? 'selected' : ''}>🔷 Ocean Blue</option>
                <option value="emerald" ${conf.color === 'emerald' ? 'selected' : ''}>🟢 Forest Green</option>
                <option value="rose" ${conf.color === 'rose' ? 'selected' : ''}>🔴 Vivid Red</option>
              </optgroup>
              <optgroup label="Premium">
                <option value="amber" ${conf.color === 'amber' ? 'selected' : ''}>🔶 Golden Amber</option>
                <option value="violet" ${conf.color === 'violet' ? 'selected' : ''}>🟣 Royal Violet</option>
                <option value="cyan" ${conf.color === 'cyan' ? 'selected' : ''}>💎 Crystal Cyan</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label class="block text-[8px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Satuan Unit</label>
            <input type="text" value="${conf.unit || 'Rp'}" placeholder="Rp / Pcs / %"
              onchange="app.updateWidgetConfig(${index}, 'unit', this.value)"
              class="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold text-center outline-none">
          </div>
        </div>

      </div>
    `;
    }).join('');
  },



  calculateAllWidgets: function () {
    if (!this.dashboardConfigs) return;

    // GUNAKAN resourceCache (sesuai properti di app juragan)
    this.widgetResults = this.dashboardConfigs.map(conf => {
      const data = this.resourceCache[conf.table] || [];

      if (conf.type === 'COUNT') {
        return data.length;
      }

      if (conf.type === 'SUM') {
        return data.reduce((acc, row) => {
          const val = parseFloat(row[conf.column]) || 0;
          return acc + val;
        }, 0);
      }

      return 0;
    });

    console.log("📊 Hasil Perhitungan Dashboard:", this.widgetResults);
  },

// --- CORE FUNCTIONS (FIXED FOR LICENSING SYSTEM) ---





  openDashboard: async function () {
    this.resetViews();
    const titleEl = document.getElementById('cur-title');
    if (titleEl) titleEl.innerText = "LOADING DATA...";

    document.getElementById('view-dashboard')?.classList.remove('hidden');

    try {
      for (const conf of this.dashboardConfigs) {
        if (conf.table && (!this.resourceCache[conf.table] || this.resourceCache[conf.table].length === 0)) {
          console.log(`📡 Menarik data otomatis untuk: ${conf.table}`);
          this.currentTable = conf.table;
          await this.loadResource(true); 
        }
      }

      if (titleEl) titleEl.innerText = "DASHBOARD ANALYTICS";
      this.calculateAllWidgets();
      this.renderDashboard();

    } catch (err) {
      console.error("Gagal memuat dashboard:", err);
    }
  },

  renderDashboard: function () {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    const colorMap = {
      slate: { bg: 'bg-slate-900', glow: 'shadow-slate-500/20', grad: 'from-slate-800 to-slate-950', txt: 'text-slate-100', icon: 'bg-slate-700 text-slate-300' },
      blue: { bg: 'bg-blue-600', glow: 'shadow-blue-500/40', grad: 'from-blue-500 to-blue-700', txt: 'text-white', icon: 'bg-blue-400/30 text-blue-100' },
      emerald: { bg: 'bg-emerald-600', glow: 'shadow-emerald-500/40', grad: 'from-emerald-500 to-emerald-700', txt: 'text-white', icon: 'bg-emerald-400/30 text-emerald-100' },
      rose: { bg: 'bg-rose-600', glow: 'shadow-rose-500/40', grad: 'from-rose-500 to-rose-700', txt: 'text-white', icon: 'bg-rose-400/30 text-rose-100' },
      amber: { bg: 'bg-amber-500', glow: 'shadow-amber-500/40', grad: 'from-amber-400 to-amber-600', txt: 'text-white', icon: 'bg-amber-300/30 text-amber-100' },
      violet: { bg: 'bg-violet-600', glow: 'shadow-violet-500/40', grad: 'from-violet-500 to-violet-700', txt: 'text-white', icon: 'bg-violet-400/30 text-violet-100' },
      cyan: { bg: 'bg-cyan-500', glow: 'shadow-cyan-500/40', grad: 'from-cyan-400 to-cyan-600', txt: 'text-white', icon: 'bg-cyan-300/30 text-cyan-100' },
      fuchsia: { bg: 'bg-fuchsia-600', glow: 'shadow-fuchsia-500/40', grad: 'from-fuchsia-500 to-fuchsia-700', txt: 'text-white', icon: 'bg-fuchsia-400/30 text-fuchsia-100' }
    };

    if (!this.dashboardConfigs || this.dashboardConfigs.length === 0) {
      container.innerHTML = `<div class="col-span-full p-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200"><i class="fa-solid fa-shapes text-4xl text-slate-200 mb-4"></i><p class="text-slate-400 font-black uppercase tracking-widest text-[10px]">Belum ada widget di rakit, juragan.</p></div>`;
      return;
    }

    container.innerHTML = this.dashboardConfigs.map((conf, index) => {
      const theme = colorMap[conf.color] || colorMap.slate;
      const rawValue = (this.widgetResults && this.widgetResults[index] !== undefined) ? this.widgetResults[index] : 0;
      const displayValue = typeof rawValue === 'number' ? rawValue.toLocaleString('id-ID') : rawValue;

      return `
      <div class="relative group animate-fade-in">
        <div class="absolute inset-0 ${theme.bg} rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-all duration-700"></div>
        <div class="relative bg-gradient-to-br ${theme.grad} p-7 rounded-[2.5rem] ${theme.glow} shadow-2xl border border-white/10 overflow-hidden min-h-[220px] flex flex-col justify-between">
          <div class="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
          <div class="absolute bottom-0 left-0 -ml-4 -mb-4 w-24 h-24 bg-black/10 rounded-full blur-2xl"></div>
          <div class="flex justify-between items-start relative z-10">
            <div class="${theme.icon} w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md border border-white/10 group-hover:scale-110 transition-transform duration-500">
              <i class="fa-solid ${conf.icon || 'fa-wallet'} text-xl"></i>
            </div>
            <div class="bg-black/10 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
               <span class="text-[9px] font-black tracking-widest ${theme.txt} opacity-80 uppercase">${conf.unit || 'VAL'}</span>
            </div>
          </div>
          <div class="mt-6 relative z-10">
            <h3 class="text-[10px] font-black tracking-[0.2em] mb-1 ${theme.txt} opacity-60 uppercase">${conf.name || 'Untitled Widget'}</h3>
            <div class="flex items-baseline gap-1"><span class="text-4xl font-black tracking-tighter ${theme.txt} drop-shadow-md">${displayValue}</span></div>
          </div>
          <div class="mt-4 flex items-center justify-between relative z-10">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-white/40 animate-pulse"></div>
              <span class="text-[8px] font-bold ${theme.txt} opacity-40 uppercase tracking-[0.15em]">${conf.type} ANALYSIS</span>
            </div>
            <i class="fa-solid fa-arrow-up-right-dots text-[10px] ${theme.txt} opacity-20 group-hover:opacity-100 transition-opacity"></i>
          </div>
        </div>
      </div>`;
    }).join('');
  },

  filterTable(query) {
    const searchTerm = query.toLowerCase();
    const rawData = this.resourceCache[this.currentTable] || [];
    if (!searchTerm) { this.renderTable(rawData); return; }
    const filtered = rawData.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm)));
    this.renderTable(filtered);
  },

// PERBAIKAN: Pembersihan ID Sheet dari URL
sheet: (function() {
        const raw = localStorage.getItem('sk_sheet');
        if (!raw) return null;
        
        // Jika isinya URL (ada teks /d/), kita potong ambil tengahnya saja
        if (raw.includes('/d/')) {
          return raw.split('/d/')[1].split('/')[0];
        }
        
        // Jika sudah ID bersih, langsung kembalikan
        return raw;
      })(),



// Helper untuk reset tombol jika gagal (Agar kode tidak berulang)
resetSaveButton(btn) {
  this.isSubmitting = false;
  if (btn) {
    btn.disabled = false;
    btn.innerText = "COMMIT DATA";
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
},
  
  openAppStudio() {
    this.resetViews();
    this.currentTable = 'APP_STUDIO';
    this.currentView = 'studio'; // Update state view

    // 1. HARD RESET UI (Tutup semua pintu view lainnya)
    document.getElementById('view-crud')?.classList.add('hidden');
    document.getElementById('view-schema-explorer')?.classList.add('hidden'); // INI KUNCINYA: Tutup Skema!
    document.getElementById('search-container')?.classList.add('hidden'); // Sembunyikan Search

    // 2. Buka Pintu Studio
    document.getElementById('view-app-studio')?.classList.remove('hidden');

    // 3. Update Header
    const titleEl = document.getElementById('cur-title');
    if (titleEl) titleEl.innerText = "APP STUDIO";

    // 4. Update Navigasi Sidebar (Sync Warna)
    document.querySelectorAll('.nav-btn, #nav-app-studio, #nav-schema-explorer').forEach(b => {
      b.classList.remove('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');
      b.classList.add('text-slate-400');
    });

    const navBtn = document.getElementById('nav-app-studio');
    if (navBtn) navBtn.classList.add('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');

    // 5. Reset & Load Field
    const fieldContainer = document.getElementById('st-fields-container');
    if (fieldContainer) fieldContainer.innerHTML = '';
    this.studioAddField();
  },
studioAddField() {
  const id = Date.now();
  const html = `
    <div id="st-f-${id}" class="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4 mb-4 animate-fade-in">
      <div class="flex justify-between items-center">
        <span class="text-[10px] font-black text-blue-600 tracking-widest uppercase">Konfigurasi Kolom</span>
        <button onclick="this.parentElement.parentElement.remove()" class="text-red-400 hover:text-red-600 transition-all">
          <i class="fa-solid fa-circle-xmark fa-lg"></i>
        </button>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-[9px] font-black mb-1 text-slate-400">ID KOLOM</label>
          <input type="text" class="st-name w-full p-3 border rounded-xl font-bold text-sm" placeholder="ex: harga_satuan" oninput="app.syncStudioOptions()">
        </div>
        <div>
          <label class="block text-[9px] font-black mb-1 text-slate-400">TIPE DATA</label>
          <select class="st-type w-full p-3 border rounded-xl font-bold text-sm bg-white" onchange="app.toggleStudioUI('${id}', this.value)">
            <option value="TEXT">TEXT</option>
            <option value="NUMBER">NUMBER</option>
            <option value="CURRENCY">CURRENCY (Rp)</option>
            <option value="DATE">DATE</option>
            <option value="LOOKUP">LOOKUP (RELASI)</option>
            <option value="AUTOFILL">AUTOFILL (OTOMATIS)</option>
            <option value="FORMULA">FORMULA</option>
          </select>
        </div>
      </div>

      <div id="relasi-ui-${id}" class="hidden p-4 bg-blue-50 rounded-xl grid grid-cols-2 gap-4 border border-blue-100">
          <div>
            <label class="block text-[9px] font-black mb-1 text-blue-400">TABEL SUMBER</label>
            <select class="st-rel-table w-full p-2 border rounded-lg text-xs font-bold bg-white" onchange="app.populateStudioFields('${id}', this.value)">
              <option value="">-- Pilih Tabel --</option>
            </select>
          </div>
          <div>
            <label class="block text-[9px] font-black mb-1 text-blue-400">KOLOM KUNCI (LABEL)</label>
            <select class="st-rel-field w-full p-2 border rounded-lg text-xs font-bold bg-white">
              <option value="">-- Pilih Kolom --</option>
            </select>
          </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-[9px] font-black mb-1 text-slate-400">LABEL TAMPILAN</label>
          <input type="text" class="st-label w-full p-3 border rounded-xl text-sm font-bold" placeholder="Contoh: Harga Satuan">
        </div>
        <div>
          <label class="block text-[9px] font-black mb-1 text-slate-400">FORMULA / REFERENCE</label>
          <input type="text" class="st-formula w-full p-3 border rounded-xl text-sm font-bold" placeholder="Contoh: {qty}*{harga}">
        </div>
      </div>

      <div class="flex flex-wrap gap-6 pt-4 border-t border-slate-200">
        <label class="flex items-center gap-2 text-[9px] font-black cursor-pointer group">
          <input type="checkbox" class="st-show w-4 h-4 rounded shadow-sm" checked> 
          <span class="group-hover:text-blue-600 transition-colors">TAMPIL</span>
        </label>
        <label class="flex items-center gap-2 text-[9px] font-black cursor-pointer group">
          <input type="checkbox" class="st-req w-4 h-4 rounded shadow-sm"> 
          <span class="group-hover:text-blue-600 transition-colors">WAJIB</span>
        </label>
        <label class="flex items-center gap-2 text-[9px] font-black cursor-pointer group text-red-500">
          <input type="checkbox" class="st-disabled w-4 h-4 rounded shadow-sm"> 
          <span class="group-hover:text-red-700 transition-colors uppercase">Lock (Read-Only)</span>
        </label>
      </div>
    </div>`;
    
  document.getElementById('st-fields-container').insertAdjacentHTML('beforeend', html);
  
  // Ambil list tabel untuk dropdown relasi
  if (this.resources) {
    const relSelect = document.querySelector(`#st-f-${id} .st-rel-table`);
    this.resources.forEach(res => {
      const opt = document.createElement('option');
      opt.value = res.id;
      opt.textContent = res.label;
      relSelect.appendChild(opt);
    });
  }

  this.syncStudioOptions(id);
  },

  


  async loadPermissions() {
    console.log('[PERMISSION] Loading...');
    const role = localStorage.getItem('sk_role');
    
    const res = await this.get({
      action: 'read',
      table: 'config_permissions'
    });

    this.permissions = {};

    if (!res.success) {
      console.warn('[PERMISSION] Forbidden/Error. Menggunakan mode akses terbatas.');
      if (this.allResources) {
        this.allResources.forEach(r => {
          this.permissions[r.id.toLowerCase().trim()] = { browse: true, add: false, edit: false, delete: false };
        });
      }
      return true;
    }

    res.rows.forEach(p => {
      if (!p.resource || !p.role) return;
      if (String(p.role).toLowerCase() !== role.toLowerCase()) return;
      
      const resource = String(p.resource).toLowerCase().trim();
      this.permissions[resource] = {
        browse: String(p.can_browse).toUpperCase() === 'TRUE',
        add: String(p.can_add).toUpperCase() === 'TRUE',
        edit: String(p.can_edit).toUpperCase() === 'TRUE',
        delete: String(p.can_delete).toUpperCase() === 'TRUE',
        policy: String(p.ownership_policy || 'ALL').toUpperCase()
      };
    });

    // console.log('[PERMISSION] Final Map:', this.permissions);
    return true;
  },

  can(resource, action) {
    if (!this.role) return false;
    if (this.role.toUpperCase() === 'ADMIN') return true;

    const resKey = String(resource).toLowerCase().trim();
    const perm = this.permissions[resKey];

    if (!perm) return false;
    return perm[action] === true;
  },




  





  async init() {
    if (!this.token) return;

    if (!this.role) this.role = localStorage.getItem('sk_role') || '';
    
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('u-email').innerText = this.email || '';
    document.getElementById('u-role').innerText = this.role || '';
    
    const systemTools = document.getElementById('system-tools');
    if (systemTools) {
      this.role?.toUpperCase() === 'ADMIN' ? 
        systemTools.classList.remove('hidden') : systemTools.classList.add('hidden');
    }

    const titleEl = document.getElementById('cur-title');
    if (titleEl) titleEl.innerText = "SYNCHRONIZING...";

    await this.loadPermissions();
    // DEBUG 1: Cek apakah permissions sudah terisi
    // console.log("DEBUG 1 - Permissions Map:", this.permissions);

    const resList = await this.get({ action: 'listResources' });
    if (!resList.success) {
      alert("Koneksi gagal atau Token Expired");
      auth.logout();
      return;
    }
    this.allResources = resList.resources;

    this.fullAppData = {};
    this.resourceCache = {};
    this.schemaCache = {};

    await Promise.all(this.allResources.map(async (res) => {
      try {
        const detail = await this.get({ action: 'read', table: res.id });
        
        if (detail.success) {
          this.fullAppData[res.id] = { schema: detail.schema, rows: detail.rows };
          this.resourceCache[res.id] = detail.rows;
          
          this.schemaCache[res.id] = {
            schema: detail.schema,
            modes: detail.modes || {
              add: this.can(res.id, 'add'),
              edit: this.can(res.id, 'edit'),
              delete: this.can(res.id, 'delete'),
              browse: { fields: Object.keys(detail.schema) }
            }
          };
          // DEBUG 2: Cek apakah rakitan modes untuk tiap tabel benar
          // console.log(`DEBUG 2 - Table ${res.id} Modes:`, this.schemaCache[res.id].modes);

        } else {
          console.warn(`[INIT] Tabel ${res.id} diblokir: ${detail.message}`);
          this.schemaCache[res.id] = { 
            schema: {}, 
            modes: { add: false, edit: false, delete: false } 
          };
        }
      } catch (e) {
        console.error(`Error loading ${res.id}`, e);
      }
    }));
    
    this.openDashboard();
    this.renderSidebar();
    if (titleEl) titleEl.innerText = "SYSTEM READY";
  },



async loadResource(forceRefresh = false) {
  const vm = document.getElementById('view-mode')?.value || 'active';
  const btnRefresh = document.getElementById('btn-refresh');
  const btnAdd = document.getElementById('btn-add');
  const titleEl = document.getElementById('cur-title');

  /* =====================================================
   * UI START
   * ===================================================== */
  if (btnRefresh) btnRefresh.classList.add('animate-spin');
  if (titleEl) {
    titleEl.innerText =
      "SYNCHRONIZING " + this.currentTable.toUpperCase() + "...";
  }

  if (forceRefresh) {
    this.resourceCache[this.currentTable] = [];
  }

  try {
    /* =====================================================
     * 0. LOAD TABLE UTAMA
     * ===================================================== */
    const d = await this.get({
      action: 'read',
      table: this.currentTable,
      viewMode: vm,
      _t: forceRefresh ? Date.now() : null
    });

    if (btnRefresh) btnRefresh.classList.remove('animate-spin');

    if (!d || d.success !== true) {
      throw new Error(d?.message || 'Invalid response');
    }

    /* =====================================================
     * 1. SCHEMA NORMALIZATION (PATUH TOTAL)
     * ===================================================== */
    const rawSchema = d.schema;
    this.schema = {};

    if (rawSchema && typeof rawSchema === 'object' && !Array.isArray(rawSchema)) {
      // Native schema object (v44+)
      this.schema = rawSchema;
    } 
    else if (Array.isArray(rawSchema) && rawSchema.length >= 2) {
      // Legacy fallback
      const headers = rawSchema[0];
      const configs = rawSchema[1];

      headers.forEach((h, i) => {
        let cfg = configs[i];
        if (typeof cfg === 'string') {
          try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
        }
        this.schema[h] = { ...cfg, name: h, headerIdx: i };
      });
    }

    console.table(this.schema);

    /* =====================================================
     * 2. MODES & ROW CACHE (TABLE AKTIF)
     * ===================================================== */
    this.modes = d.modes || {
      add:    { can: true },
      edit:   { can: true },
      delete: { can: true },
      browse: { can: true }
    };

    const rows = Array.isArray(d.rows) ? d.rows : [];
    this.resourceCache[this.currentTable] = rows;

    /* =====================================================
     * 3. 🔥 LOOKUP PRELOAD ENGINE (BENAR & AMAN)
     * ===================================================== */
    this.lookupTables = this.lookupTables || new Set();

    Object.values(this.schema).forEach(col => {
      if (
        col.type === 'LOOKUP' &&
        col.lookup?.table &&
        col.lookup.mode === 'browse'
      ) {
        this.lookupTables.add(col.lookup.table);
      }
    });

    for (const table of this.lookupTables) {
      if (!this.resourceCache[table]) {
        console.log('🔁 Preloading lookup table:', table);

        const ref = await this.get({
          action: 'read',
          table,
          source: 'lookup',   // 🔑 INTENT WAJIB
          mode: 'browse'      // 🔑 MODE WAJIB
        });

        if (ref && ref.success === true) {
          this.resourceCache[table] = Array.isArray(ref.rows) ? ref.rows : [];
        } else {
          console.warn('⚠️ Lookup preload failed:', table);
          this.resourceCache[table] = [];
        }
      }
    }

    /* =====================================================
     * 4. ADD BUTTON VISIBILITY
     * ===================================================== */
    if (btnAdd) {
      const canAdd =
        this.modes?.add?.can === true ||
        this.modes?.can_add === true;

      if (canAdd && vm === 'active') {
        btnAdd.classList.replace('hidden', 'flex');
      } else {
        btnAdd.classList.replace('flex', 'hidden');
      }
    }

    /* =====================================================
     * 5. RENDER CORE
     * ===================================================== */
    this.renderTable(rows);

    if (titleEl) {
      titleEl.innerText =
        this.currentTable.replace(/_/g, ' ').toUpperCase();
    }

  } catch (err) {
    console.error("🔥 loadResource fatal:", err);

    if (btnRefresh) btnRefresh.classList.remove('animate-spin');
    if (titleEl) titleEl.innerText = "LOAD ERROR";

    alert("Gagal memuat data");
  }
},

async save() {
    // 1. Proteksi Awal & Ambil Tombol
    const btnSave = document.getElementById('btn-commit');
    if (this.isSubmitting) return; 

    const form = document.getElementById('f-fields');
    
    // --- 🛡️ SHIELD: VALIDASI REQUIRED (Wajib di FE sebelum tutup) ---
    const requiredInputs = form.querySelectorAll('[required]');
    let invalidFields = [];
    requiredInputs.forEach(input => {
      if (!input.value || input.value.trim() === "") {
        const fieldLabel = (this.schema && this.schema[input.name]?.label) || input.name;
        invalidFields.push(fieldLabel.toUpperCase());
        input.classList.add('border-red-500', 'bg-red-50');
      }
    });

    if (invalidFields.length > 0) {
      alert("❌ WAJIB DIISI:\n" + invalidFields.join('\n'));
      return; 
    }

    // 2. Collect Data
    const inputs = form.querySelectorAll('input, select');
    const data = {};
    inputs.forEach(el => { if (el.name) data[el.name] = el.value; });
    if (this.editingId) data.id = this.editingId;

    const action = this.editingId ? 'update' : 'create';
    
    try {
      this.isSubmitting = true;
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerText = "PROSES SIMPAN...";
      }

      // --- ⚡ FILOSOFI JURAGAN: TUTUP APAPUN YANG TERJADI ---
      setTimeout(() => {
        this.closeForm(); 
        this.isSubmitting = false;
        // Tombol dikembalikan ke state awal di dalam modal yang sudah tersembunyi
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerText = "COMMIT DATA";
        }
        console.log("🚀 Optimistic Close: Form ditutup sesuai instruksi.");
      }, 1000);

      const payload = {
        action: action,
        table: this.currentTable,
        token: this.token || localStorage.getItem('sk_token'),
        ua: navigator.userAgent,
        sheet: localStorage.getItem('sk_sheet'),
        data: data
      };

      // 3. Kirim ke Engine GAS
      const response = await fetch(DYNAMIC_ENGINE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const resultText = await response.text();
      let resultJson;
      try { resultJson = JSON.parse(resultText); } catch(e) { resultJson = { success: response.ok }; }
      
      // 4. Feedback via Toast/Console (Bukan menghalangi penutupan form)
      if (resultJson && resultJson.success) {
        console.log("✅ SAVE_SUCCESS");
        if (typeof this.showToast === 'function') this.showToast("Data berhasil disimpan!", "success");
        this.loadResource(true); // Refresh data di tabel
      } else {
        console.error("❌ SAVE_FAILED:", resultJson.message);
        if (typeof this.showToast === 'function') this.showToast("Gagal: " + resultJson.message, "error");
        else alert("Gagal Simpan: " + resultJson.message);
      }

    } catch (err) {
      console.error("🔥 CRITICAL_ERROR:", err);
      if (typeof this.showToast === 'function') this.showToast("Koneksi Error!", "error");
      this.isSubmitting = false;
    }
  },

  async get(params = {}) {
  try {
    showLoading(true);
    const dynamicEngineUrl = localStorage.getItem('sk_engine_url');
    if (!dynamicEngineUrl) throw new Error('ENGINE_URL_NOT_FOUND');

    let sheetId = localStorage.getItem('sk_sheet') || '';
    if (sheetId.includes('/d/')) {
      sheetId = sheetId.split('/d/')[1].split('/')[0];
    }

    // FIX: Ambil token secara agresif
    const token = this.token || localStorage.getItem('sk_token') || '';
    // FIX: Ambil serial secara agresif
    const serial = localStorage.getItem('sk_serial') || '';

    if (!token) throw new Error('TOKEN_MISSING');

    const baseParams = {
      token,
      sheet: sheetId,
      ua: navigator.userAgent,
      serial: serial // 🔥 Kirim SN
    };

    const finalParams = { ...params };
    if (params.source === 'lookup') {
      finalParams.mode = params.mode || 'browse';
      finalParams.source = 'lookup';
      delete finalParams.page;
      delete finalParams.per_page;
    }

    const q = new URLSearchParams({ ...finalParams, ...baseParams }).toString();

    const res = await fetch(`${dynamicEngineUrl}?${q}`, {
      method: 'GET',
      credentials: 'omit'
    });

    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = await res.json();
    showLoading(false);
    return data;
  } catch (e) {
    console.error('GET_FATAL:', e);
    showLoading(false);
    return { success: false, message: e.message };
  }
},

async post(arg1, arg2) {
  try {
    // 1. RESOLVE ENGINE URL
    const dynamicEngineUrl = localStorage.getItem('sk_engine_url');

    // 2. RESOLVE TOKEN (Ambil dari instance atau storage)
    const token = this.token || localStorage.getItem('sk_token') || '';
    
    // 3. RESOLVE SERIAL
    const serial = localStorage.getItem('sk_serial') || '';

    // 4. RESOLVE SHEET ID
    let sheetId = localStorage.getItem('sk_sheet') || '';
    if (sheetId.includes('/d/')) {
      sheetId = sheetId.split('/d/')[1].split('/')[0];
    }

    console.log('[SK-DEBUG] Outbound SN:', serial);

    let finalPayload;
    // MODE OBJECT (Langsung kirim data object)
    if (typeof arg1 === 'object' && !arg2) {
      finalPayload = {
        ...arg1,
        token: token, // FIX: Jangan cuma this.token
        sheet: sheetId,
        ua: navigator.userAgent,
        serial: serial 
      };
    } 
    // MODE CRUD (Action, Data)
    else {
      finalPayload = {
        action: arg1,
        table: this.currentTable,
        data: arg2,
        token: token, // FIX: Jangan cuma this.token
        sheet: sheetId,
        ua: navigator.userAgent,
        serial: serial
      };
    }

    const res = await fetch(dynamicEngineUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload)
    });

    return await res.json();
  } catch (e) {
    console.error("[SK-ERROR] Post Error:", e);
    return { success: false, message: "Koneksi ke Engine Terputus" };
  }
},




};
app.init();