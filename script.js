// 1. Ambil dari storage
const DYNAMIC_ENGINE_URL = localStorage.getItem("sk_engine_url");
const DYNAMIC_SHEET_ID = localStorage.getItem("sk_sheet");

function showLoading(status) {
  const loader = document.getElementById("loader"); // Pastikan ID ini ada di HTML Anda
  if (!loader) return;
  status ? loader.classList.remove("hidden") : loader.classList.add("hidden");
}

const app = {
  token: localStorage.getItem("sk_token"),
  role: localStorage.getItem("sk_role"),
  email: localStorage.getItem("sk_email"),
  currentTable: "",
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
    direction: null, // 'asc' | 'desc' | null
  },
  dashboardConfigs:
    JSON.parse(localStorage.getItem("sk_dashboard_config")) || [],
  permissions: {}, // Sekarang berbentuk Object Map
  tableSortDesc: true, // default: terbaru di atas

  async populateLookup(id, table, field, currentVal) {
    const el = document.getElementById(`f-${id}`);
    const opts = await this.getLookupOptions(table, field);
    if (el)
      el.innerHTML =
        `<option value="">-- Pilih --</option>` +
        opts
          .map(
            (opt) =>
              `<option value="${opt}" ${
                String(opt) === String(currentVal) ? "selected" : ""
              }>${opt}</option>`
          )
          .join("");
  },

  async getLookupOptions(table, field) {
    if (this.resourceCache[table])
      return [
        ...new Set(this.resourceCache[table].map((r) => r[field])),
      ].filter((v) => v);
    const res = await this.get({ action: "read", table: table });
    if (res.success) {
      this.resourceCache[table] = res.rows;
      return [...new Set(res.rows.map((r) => r[field]))].filter((v) => v);
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
        } catch (e) {}
      }
    }
  },

  syncStudioOptions(targetId = null) {
    // 1. Ambil list tabel dan pastikan ID-nya bersih (lowercase, no space)
    const tableOpts =
      '<option value="">-- Pilih Tabel --</option>' +
      (this.allResources || [])
        .map((r) => {
          const cleanId = r.id.toLowerCase().replace(/\s+/g, ""); // Paksa bersih
          return `<option value="${cleanId}">${cleanId}</option>`; // Tampilkan apa adanya (lowercase)
        })
        .join("");

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
      document
        .querySelectorAll('div[id^="st-f-"]')
        .forEach((d) => updateRow(d.id.replace("st-f-", "")));
    }
  },

  // 1. Fungsi pengisi dropdown (Hanya berikan Field ID Asli)
  populateStudioFields: function (id, tableName) {
    // 1. Ambil skema dari cache
    const resource = this.schemaCache[tableName];
    const select = document.querySelector(`#st-f-${id} .st-rel-field`);

    if (!select || !resource || !resource.schema) {
      if (select)
        select.innerHTML =
          '<option value="">-- Kolom Tidak Ditemukan --</option>';
      return;
    }

    // 2. Ambil semua key asli dari schema
    const fieldKeys = Object.keys(resource.schema);

    // 3. Render ke Dropdown
    select.innerHTML = `
    <option value="">-- Pilih Kolom --</option>
    ${fieldKeys
      .map((key) => {
        // Kita bersihkan key: kecilkan semua & hapus spasi untuk VALUE mesin
        const cleanKey = key.toLowerCase().replace(/\s+/g, "");

        // Tampilkan key yang bersih di dropdown agar Juragan tahu ID aslinya
        return `<option value="${cleanKey}">${cleanKey}</option>`;
      })
      .join("")}
  `;
  },

  toggleStudioUI(id, type) {
    const row = document.getElementById(`st-f-${id}`);
    const relUI = document.getElementById(`relasi-ui-${id}`);

    // Hapus UI Autofill lama jika ada agar tidak double
    const oldAuto = document.getElementById(`autofill-ui-${id}`);
    if (oldAuto) oldAuto.remove();

    // Sembunyikan UI Relasi standar
    relUI.classList.add("hidden");

    if (type === "LOOKUP") {
      relUI.classList.remove("hidden");
      this.syncStudioOptions(id);
    } else if (type === "AUTOFILL") {
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
      relUI.insertAdjacentHTML("afterend", html);

      // Isi data dropdown-nya
      this.syncAutofillOptions(id);
    }
  },
  async populateAutofillFields(id, tableName) {
    if (!tableName) return;
    const colSelect = document.querySelector(`#autofill-ui-${id} .st-auto-col`);
    colSelect.innerHTML = '<option value="">Loading...</option>';

    // Fetch data schema tabel sumber
    const d = await this.get({ action: "read", table: tableName, limit: 1 });
    if (d.success && d.schema) {
      colSelect.innerHTML =
        '<option value="">-- Pilih Kolom --</option>' +
        Object.keys(d.schema)
          .map((f) => `<option value="${f}">${f}</option>`)
          .join("");
    } else {
      colSelect.innerHTML = '<option value="">Gagal muat kolom</option>';
    }
  },
  syncAutofillOptions(id) {
    const row = document.getElementById(`st-f-${id}`);
    const triggerSelect = row.querySelector(".st-auto-trigger");
    const tableSelect = row.querySelector(".st-auto-table");

    // 1. Ambil semua field yang sudah dibuat di studio saat ini untuk jadi pemicu
    const currentFields = Array.from(document.querySelectorAll(".st-name"))
      .map((input) => input.value)
      .filter((v) => v !== "");

    triggerSelect.innerHTML =
      '<option value="">-- Pilih Trigger --</option>' +
      currentFields.map((f) => `<option value="${f}">${f}</option>`).join("");

    // 2. Ambil daftar tabel dari resources
    if (this.allResources) {
      tableSelect.innerHTML =
        '<option value="">-- Pilih Tabel --</option>' +
        this.allResources
          .map((r) => `<option value="${r.id}">${r.id}</option>`)
          .join("");
    }
  },

  renderSchemaData() {
    const container = document.getElementById("schema-content-area");
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
                    ${Object.entries(schema)
                      .map(([k, v]) => {
                        const isSystem = v.hidden;
                        return `
                      <tr class="group transition-all ${
                        isSystem
                          ? "bg-slate-50/40 opacity-70"
                          : "hover:bg-blue-50/30"
                      }">
                        <td class="px-8 py-5">
                          <div class="flex flex-col">
                            <span class="text-sm font-bold text-slate-800 uppercase tracking-tight group-hover:text-blue-600 transition-colors">${k}</span>
                            <div class="flex items-center gap-2 mt-1">
                               <span class="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 uppercase">${
                                 v.type || "TEXT"
                               }</span>
                               <span class="text-[9px] text-slate-400 font-medium italic">${
                                 v.label || "-"
                               }</span>
                            </div>
                          </div>
                        </td>
                        <td class="px-8 py-5 text-center">
                           <i class="fa-solid ${
                             v.hidden
                               ? "fa-eye-slash text-slate-300"
                               : "fa-eye text-emerald-500"
                           } text-sm"></i>
                        </td>
                        <td class="px-8 py-5 text-center">
                           <div class="flex justify-center gap-2">
                             <span title="Required" class="w-2 h-2 rounded-full ${
                               v.required ? "bg-blue-500" : "bg-slate-100"
                             } shadow-sm"></span>
                             <span title="Disabled" class="w-2 h-2 rounded-full ${
                               v.disabled ? "bg-orange-500" : "bg-slate-100"
                             } shadow-sm"></span>
                           </div>
                        </td>
                        <td class="px-8 py-5">
                          ${this.badgeLogic(v)}
                        </td>
                      </tr>`;
                      })
                      .join("")}
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
    if (v.lookup || v.type === "LOOKUP") {
      const table = v.lookup?.table || v.autoTable || "table";
      const field = v.lookup?.field || v.autoCol || "field";
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
    if (v.type === "AUTOFILL" || v.autoTrigger) {
      badges.push(`
            <div class="flex flex-col gap-2 bg-orange-50 p-3 rounded-2xl border border-orange-100 min-w-[180px]">
              <div class="flex items-center gap-2">
                <i class="fa-solid fa-bolt-lightning text-orange-500 text-[10px]"></i>
                <span class="text-[9px] font-black text-orange-600 uppercase tracking-tighter">Auto-Injection Flow</span>
              </div>
              <div class="flex items-center gap-2 bg-white/50 p-1.5 rounded-lg border border-orange-200/50">
                <span class="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[8px] font-black uppercase">${
                  v.autoTrigger || "trigger"
                }</span>
                <i class="fa-solid fa-arrow-right-long text-orange-300 text-[10px]"></i>
                <span class="text-[10px] font-bold text-orange-800 tracking-tight">${
                  v.autoTable || "table"
                }.${v.autoCol || "col"}</span>
              </div>
            </div>`);
    }

    // 3. FORMULA (Compute)
    if (v.type === "FORMULA" || v.formula) {
      badges.push(`
            <div class="flex flex-col gap-1.5 bg-purple-50 p-3 rounded-2xl border border-purple-100 min-w-[150px]">
              <span class="text-[9px] font-black text-purple-600 uppercase tracking-tighter flex items-center gap-2">
                <i class="fa-solid fa-calculator text-[10px]"></i> Compute Engine
              </span>
              <code class="text-[11px] font-black text-purple-900 bg-white/50 px-2 py-1 rounded border border-purple-200/50">${v.formula}</code>
            </div>`);
    }

    return badges.length > 0
      ? `<div class="flex flex-wrap gap-2">${badges.join("")}</div>`
      : `<span class="text-slate-300 text-[9px] font-bold uppercase tracking-[0.2em] italic pl-2">Standard Data</span>`;
  },

  editSchemaShortcut(tableName) {
    this.openAppStudio();
    const selector = document.getElementById("st-table-selector");
    if (selector) {
      selector.value = tableName;
      selector.dispatchEvent(new Event("change"));
    }
  },

  // Fungsi pembantu agar kode selectResource lebih bersih
  updateSidebarUI(id) {
    // 1. SAPU BERSIH: Ambil SEMUA elemen yang mungkin punya warna biru
    // Kita incar semua button di dalam nav
    document.querySelectorAll("nav button, .nav-btn").forEach((b) => {
      b.classList.remove(
        "bg-blue-600",
        "text-white",
        "shadow-lg",
        "sidebar-active"
      );
      b.classList.add("text-slate-400");
    });

    // 2. WARNAI YANG BARU: Hanya tombol yang ID-nya pas dengan menu sekarang
    const activeBtn = document.getElementById(`nav-${id}`);
    if (activeBtn) {
      activeBtn.classList.remove("text-slate-400");
      activeBtn.classList.add(
        "bg-blue-600",
        "text-white",
        "shadow-lg",
        "sidebar-active"
      );
    }

    // 3. UPDATE JUDUL
    const titleEl = document.getElementById("cur-title");
    if (titleEl) titleEl.innerText = id.replace(/_/g, " ").toUpperCase();
  },

  // Fungsi pembantu agar navigasi tidak biru semua

  // Masukkan di dalam const app = { ... }

  // --- SCHEMA SECTION ---
  viewSchemaExplorer() {
    this.resetViews();
    this.currentView = "explorer";
    this.currentTable = "SCHEMA_EXPLORER";

    // 1. UI Switch (Kamar CRUD & Studio ditutup)
    document.getElementById("view-crud")?.classList.add("hidden");
    document.getElementById("view-app-studio")?.classList.add("hidden");
    document.getElementById("view-schema-explorer")?.classList.remove("hidden");

    // --- TAMBAHAN: Sembunyikan Search Bar (Penting!) ---
    document.getElementById("search-container")?.classList.add("hidden");

    // 2. Header & Navigasi
    const titleEl = document.getElementById("cur-title");
    if (titleEl) titleEl.innerText = "SCHEMA INTELLIGENCE";

    document
      .querySelectorAll(".nav-btn, #nav-app-studio, #nav-schema-explorer")
      .forEach((b) => {
        b.classList.remove(
          "bg-blue-600",
          "text-white",
          "shadow-lg",
          "sidebar-active"
        );
        b.classList.add("text-slate-400");
      });

    const navBtn = document.getElementById("nav-schema-explorer");
    if (navBtn)
      navBtn.classList.add(
        "bg-blue-600",
        "text-white",
        "shadow-lg",
        "sidebar-active"
      );

    // 3. Render Data dengan Cleansing
    // Kita kosongkan dulu agar tidak ada data "hantu" dari proses sebelumnya
    const container = document.getElementById("schema-content-area");
    if (container) container.innerHTML = "";

    this.renderSchemaData();
  },

  // --- DASHBOARD SECTION ---

  async selectResource(id) {
    if (this.currentTable === id && this.currentView === "data") return;

    // 1. Matikan semua view (termasuk dashboard & crud)
    this.resetViews();

    // 2. Set State
    this.currentTable = id;
    this.currentView = "data";

    // 3. AKTIFKAN KEMBALI CONTAINER CRUD (Ini yang bikin tabel muncul)
    const crudView = document.getElementById("view-crud");
    const searchContainer = document.getElementById("search-container");

    if (crudView) {
      crudView.classList.remove("hidden"); // Membuka pintu utama
      crudView.style.visibility = "visible"; // Memastikan terlihat
    }
    if (searchContainer) searchContainer.classList.remove("hidden");

    // 4. Update Header Judul
    const titleEl = document.getElementById("cur-title");
    if (titleEl) titleEl.innerText = id.replace(/_/g, " ").toUpperCase();

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
    const list = document.getElementById("resource-list");
    if (!list) return;

    // Filter unik ID Tabel
    const unique = [
      ...new Map(this.allResources.map((item) => [item.id, item])).values(),
    ];

    list.innerHTML = unique
      .map(
        (r) => `
          <button onclick="app.selectResource('${r.id}')" id="nav-${r.id}" 
            class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all text-left uppercase tracking-wider">
            <i class="fa-solid fa-table text-[10px] opacity-40"></i> <span>${r.id}</span>
          </button>
        `
      )
      .join("");
  },

  // Tambahkan ke dalam objek app { ... }

  // --- RENDER DASHBOARD UTAMA BERDASARKAN CONFIG ---

  resetViews() {
    // Daftar semua container view yang ada di HTML
    const views = [
      "view-crud",
      "view-app-studio",
      "view-schema-explorer",
      "view-dashboard",
      "view-dashboard-builder", // Tambahkan ini agar tidak "nyangkut"
      "automation-builder-section",
      "view-permissions",
      "view-row-policy",
    ];

    views.forEach((v) => {
      const el = document.getElementById(v);
      if (el) el.classList.add("hidden");
    });

    // Sembunyikan juga elemen header yang spesifik untuk tabel
    document.getElementById("search-container")?.classList.add("hidden");
    document.getElementById("btn-add")?.classList.add("hidden");
    document.getElementById("view-mode")?.classList.add("hidden");
  },

  syncSidebarUI(id) {
    // 1. Bersihkan semua status active dari semua tombol navigasi
    document.querySelectorAll(".nav-btn, aside nav button").forEach((btn) => {
      btn.classList.remove("sidebar-active", "bg-[#1e293b]", "text-white");
      btn.classList.add("text-slate-400");
    });

    // 2. Cari tombol yang diklik berdasarkan ID-nya
    // id bisa berupa: 'dashboard', 'dashboard-builder', 'app-studio', atau 'NAMA_TABEL'
    const targetId = `nav-${id.toLowerCase().replace(/_/g, "-")}`;
    const activeBtn = document.getElementById(targetId);

    if (activeBtn) {
      activeBtn.classList.add("sidebar-active", "bg-[#1e293b]", "text-white");
      activeBtn.classList.remove("text-slate-400");
    }

    // 3. Update Judul di Header
    const titleMap = {
      dashboard: "Dashboard Overview",
      "dashboard-builder": "Dashboard Architect",
      "app-studio": "Table Architect",
      "schema-explorer": "Schema Explorer",
    };

    document.getElementById("cur-title").innerText =
      titleMap[id] || id.replace(/_/g, " ").toUpperCase();
  },

  hideAllSections: function () {
    // Daftar semua ID section yang ada di HTML juragan
    const sections = [
      "view-crud",
      "view-app-studio",
      "view-schema-explorer",
      "view-dashboard",
      "view-dashboard-builder",
      "automation-builder-section",
    ];

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });

    // Sembunyikan elemen header tambahan jika ada
    const search = document.getElementById("search-container");
    const btnAdd = document.getElementById("btn-add");
    if (search) search.classList.add("hidden");
    if (btnAdd) btnAdd.classList.add("hidden");
  },
  // --- PERBAIKAN TRIGGER LOOKUP & AUTOFILL (VERSI JURAGAN SAAS) ---
  // async triggerLookup(fieldId, selectedValue) {
  //   const s = this.schema[fieldId];
  //   if (!s || !selectedValue) return;

  //   // 1. Identifikasi Tabel Sumber (Tabel Kopi)
  //   const tableSource = s.lookup ? s.lookup.table : s.autoTable || "";
  //   const keyField = s.lookup ? s.lookup.field : fieldId;
  //   let sourceData = this.resourceCache[tableSource];

  //   if (sourceData) {
  //     // 2. Cari baris kopi yang dipilih
  //     const row = sourceData.find(
  //       (r) => String(r[keyField]) === String(selectedValue)
  //     );

  //     if (row) {
  //       // 3. Loop semua kolom di form Penjualan
  //       for (let key in this.schema) {
  //         const cfg = this.schema[key];

  //         // 4. CEK: Apakah kolom ini adalah AUTOFILL yang dipicu oleh fieldId ini?
  //         if (
  //           cfg.autoTrigger === fieldId ||
  //           (cfg.type === "AUTOFILL" && cfg.autoTrigger === fieldId)
  //         ) {
  //           // AMBIL NILAI: Gunakan mapping autoCol (misal: 'id') atau default ke 'key'
  //           const sourceKey = cfg.autoCol || key;
  //           const valueToFill = row[sourceKey];

  //           if (valueToFill !== undefined) {
  //             console.log(
  //               `[Autofill Success] Mengisi ${key} dengan ${valueToFill}`
  //             );
  //             this.updateFieldValue(key, valueToFill);
  //           }
  //         }
  //       }
  //     }
  //   }
  //   this.runLiveFormula();
  // },

  // 1. Fungsi Navigasi (Pastikan resetViews sudah ada di object app)
  // GANTI openAccessControl Anda dengan versi LIVE ini:
  // 1. Fungsi Navigasi (Dynamic Version)


  hideAllViews: function () {
    const views = [
      "view-crud",
      "view-app-studio",
      "view-schema-explorer",
      "view-dashboard",
      "automation-builder-section",
      "view-dashboard-builder",
      "view-permissions",
    ];
    views.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
  },

  // PERBAIKAN: Pembersihan ID Sheet dari URL
  sheet: (function () {
    const raw = localStorage.getItem("sk_sheet");
    if (!raw) return null;

    // Jika isinya URL (ada teks /d/), kita potong ambil tengahnya saja
    if (raw.includes("/d/")) {
      return raw.split("/d/")[1].split("/")[0];
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
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    }
  },

  async loadPermissions() {
    console.log("[PERMISSION] Loading...");
    const role = localStorage.getItem("sk_role");

    const res = await this.get({
      action: "read",
      table: "config_permissions",
    });

    this.permissions = {};

    if (!res.success) {
      console.warn(
        "[PERMISSION] Forbidden/Error. Menggunakan mode akses terbatas."
      );
      if (this.allResources) {
        this.allResources.forEach((r) => {
          this.permissions[r.id.toLowerCase().trim()] = {
            browse: true,
            add: false,
            edit: false,
            delete: false,
          };
        });
      }
      return true;
    }

    res.rows.forEach((p) => {
      if (!p.resource || !p.role) return;
      if (String(p.role).toLowerCase() !== role.toLowerCase()) return;

      const resource = String(p.resource).toLowerCase().trim();
      this.permissions[resource] = {
        browse: String(p.can_browse).toUpperCase() === "TRUE",
        add: String(p.can_add).toUpperCase() === "TRUE",
        edit: String(p.can_edit).toUpperCase() === "TRUE",
        delete: String(p.can_delete).toUpperCase() === "TRUE",
        policy: String(p.ownership_policy || "ALL").toUpperCase(),
      };
    });

    // console.log('[PERMISSION] Final Map:', this.permissions);
    return true;
  },

  can(resource, action) {
    if (!this.role) return false;
    if (this.role.toUpperCase() === "ADMIN") return true;

    const resKey = String(resource).toLowerCase().trim();
    const perm = this.permissions[resKey];

    if (!perm) return false;
    return perm[action] === true;
  },




  // --- FUNGSI EMERGENCY RESCUE FE (Upgrade) ---
  // --- FUNGSI EMERGENCY RESCUE FE (Fixed CORS) ---
/**
 * ============================================================
 * INTELLIGENT RESCUE ENGINE (v2)
 * ============================================================
 * Goal: Only shout when GAS is overloaded (429 / Service Limit)
 * Prevent: Spamming Master on regular client-side errors.
 * ============================================================
 */

async shoutToMaster(errorContext = null) {
  // 1. FILTER: Deteksi apakah error adalah Overload GAS
  const errorMsg = errorContext?.toString().toLowerCase() || "";
  
  // Deteksi limit GAS: Concurrent invocations, rate limit, atau HTTP 429
  const isOverload = 
    errorMsg.includes("limit") || 
    errorMsg.includes("concurrent") || 
    errorMsg.includes("too many") || 
    errorMsg.includes("429");

  if (!isOverload) {
    console.log("ℹ️ [Rescue FE] Error biasa terdeteksi. Master tidak perlu tahu.");
    return null;
  }

  // 2. ACTION: Hanya teriak jika terindikasi Overload
  try {
    const serial = localStorage.getItem("sk_serial") || "N/A";
    const failedUrl = localStorage.getItem("sk_engine_url") || "N/A";
    const email = localStorage.getItem("sk_email") || "N/A";

    const payload = {
      action: "emergency_rescue",
      serial: serial,
      failed_url: failedUrl,
      user_email: email,
      reason: "GAS_OVERLOAD_DETECTED"
    };

    console.warn("🚨 [Rescue FE] ENGINE OVERLOAD! Menghubungi Master untuk relokasi...");

    // SOLUSI CORS: Gunakan text/plain agar Master menerima payload tanpa Preflight
    const res = await fetch(BASE_MASTER_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const resultText = await res.text();
    let result;

    try {
      result = JSON.parse(resultText);
    } catch (e) {
      console.error("🔥 [Rescue FE] Master merespon tapi format rusak.");
      return null;
    }

    if (result.success && result.new_engine_url) {
      // Update engine lokal agar request berikutnya langsung ke engine baru
      localStorage.setItem("sk_engine_url", result.new_engine_url);
      console.log(`🚑 [Rescue FE] RELOKASI SUKSES! Engine Baru: ${result.new_engine_url}`);
      return result.new_engine_url;
    } else {
      console.warn("⚠️ [Rescue FE] Master menolak memberikan engine baru:", result);
    }
  } catch (err) {
    console.error("🔥 [Rescue FE] Master Engine juga sedang down atau unreachable!");
  }
  return null;
},

  async init() {
    if (!this.token) return;

    if (!this.role) this.role = localStorage.getItem("sk_role") || "";

    document.getElementById("login-screen")?.classList.add("hidden");
    document.getElementById("u-email").innerText = this.email || "";
    document.getElementById("u-role").innerText = this.role || "";

    const systemTools = document.getElementById("system-tools");
    if (systemTools) {
      this.role?.toUpperCase() === "ADMIN"
        ? systemTools.classList.remove("hidden")
        : systemTools.classList.add("hidden");
    }

    const titleEl = document.getElementById("cur-title");
    if (titleEl) titleEl.innerText = "SYNC...";

    // 1️⃣ LOAD PERMISSION
    await this.loadPermissions();
    this.loadDashboardConfig();

    // 2️⃣ LIST RESOURCE
    const resList = await this.get({ action: "listResources" });
    if (!resList.success) {
      alert("Koneksi gagal atau Token Expired");
      auth.logout();
      return;
    }

    this.allResources = resList.resources;
    this.fullAppData = {};
    this.resourceCache = {};
    this.schemaCache = {};

    // 3️⃣ LOAD SEMUA TABLE
    await Promise.all(
      this.allResources.map(async (res) => {
        try {
          const detail = await this.get({ action: "read", table: res.id });

          if (detail.success) {
            this.fullAppData[res.id] = {
              schema: detail.schema,
              rows: detail.rows,
            };

            this.resourceCache[res.id] = detail.rows;

            this.schemaCache[res.id] = {
              schema: detail.schema,
              modes: detail.modes || {
                add: this.can(res.id, "add"),
                edit: this.can(res.id, "edit"),
                delete: this.can(res.id, "delete"),
                browse: { fields: Object.keys(detail.schema) },
              },
            };
          } else {
            this.schemaCache[res.id] = {
              schema: {},
              modes: { add: false, edit: false, delete: false },
            };
          }
        } catch (e) {
          console.error(`[INIT] Error loading ${res.id}`, e);
        }
      })
    );

    // ✅ 4️⃣ INI YANG SEBELUMNYA HILANG
    await this.loadDashboardConfig();

    // 5️⃣ BARU BOLEH BUKA DASHBOARD
    this.openDashboard();
    this.renderSidebar();

    if (titleEl) titleEl.innerText = "SYSTEM READY";
  },

  // --- JEMBATAN GET: LOAD DATA ---
  async get(params = {}, retryCount = 0) {
    const MAX_RETRIES = 2;
    try {
      showLoading(true);
      let dynamicEngineUrl = localStorage.getItem("sk_engine_url");
      if (!dynamicEngineUrl) throw new Error("ENGINE_URL_NOT_FOUND");

      // Extract Sheet ID
      let sheetId = localStorage.getItem("sk_sheet") || "";
      if (sheetId.includes("/d/")) {
        sheetId = sheetId.split("/d/")[1].split("/")[0];
      }

      const token = this.token || localStorage.getItem("sk_token") || "";
      const serial = localStorage.getItem("sk_serial") || "";
      if (!token) throw new Error("TOKEN_MISSING");

      const baseParams = {
        token,
        sheet: sheetId,
        ua: navigator.userAgent,
        serial: serial,
      };

      const finalParams = { ...params };
      if (params.source === "lookup") {
        finalParams.mode = params.mode || "browse";
        finalParams.source = "lookup";
        delete finalParams.page;
        delete finalParams.per_page;
      }

      const q = new URLSearchParams({ ...finalParams, ...baseParams }).toString();

      const res = await fetch(`${dynamicEngineUrl}?${q}`, {
        method: "GET",
        credentials: "omit",
      });

      // --- TRIGER SMART SHOUT (429/503) ---
      if ((res.status === 429 || res.status === 503) && retryCount < MAX_RETRIES) {
        console.warn(`🚨 Overload detected (${res.status}). Attempt ${retryCount + 1}`);
        const newUrl = await this.shoutToMaster(`HTTP_${res.status}_OVERLOAD`);
        if (newUrl) return this.get(params, retryCount + 1);
      }

      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      
      const data = await res.json();
      showLoading(false);
      return data;

    } catch (e) {
      console.error("GET_FATAL:", e);

      // Smart Failover hanya jika Error Relevan (Koneksi Putus/Limit)
      if (retryCount < MAX_RETRIES) {
        const newUrl = await this.shoutToMaster(e); // Filter overload di sini
        if (newUrl) return this.get(params, retryCount + 1);
      }

      showLoading(false);
      return { success: false, message: e.message };
    }
  },

  // --- JEMBATAN POST: COMMIT DATA ---
  async post(arg1, arg2, retryCount = 0) {
    const MAX_RETRIES = 2;
    try {
      const dynamicEngineUrl = localStorage.getItem("sk_engine_url");
      const token = this.token || localStorage.getItem("sk_token") || "";
      const serial = localStorage.getItem("sk_serial") || "";

      let sheetId = localStorage.getItem("sk_sheet") || "";
      if (sheetId.includes("/d/")) {
        sheetId = sheetId.split("/d/")[1].split("/")[0];
      }

      let finalPayload;
      if (typeof arg1 === "object" && !arg2) {
        finalPayload = { ...arg1, token, sheet: sheetId, ua: navigator.userAgent, serial };
      } else {
        finalPayload = {
          action: arg1,
          table: this.currentTable,
          data: arg2,
          token,
          sheet: sheetId,
          ua: navigator.userAgent,
          serial,
        };
      }

      const res = await fetch(dynamicEngineUrl, {
        method: "POST",
        // TIPS: Gunakan text/plain jika GAS sering kena preflight CORS
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(finalPayload),
      });

      // --- TRIGER SMART SHOUT ---
      if ((res.status === 429 || res.status === 503) && retryCount < MAX_RETRIES) {
        console.warn(`🚨 Overload detected pada POST. Attempt ${retryCount + 1}`);
        const newUrl = await this.shoutToMaster("POST_OVERLOAD_429");
        if (newUrl) return this.post(arg1, arg2, retryCount + 1);
      }

      const result = await res.json();
      return result;

    } catch (e) {
      console.error("[SK-ERROR] Post Error:", e);

      // Rescue jika koneksi gagal & masih ada jatah retry
      if (retryCount < MAX_RETRIES) {
        const newUrl = await this.shoutToMaster(e);
        if (newUrl) return this.post(arg1, arg2, retryCount + 1);
      }

      return { success: false, message: "Koneksi ke Engine Terputus: " + e.message };
    }
  },

  /**
 * ============================================================
 * CORE DATA LOADER: loadResource
 * ============================================================
 * Fungsi utuh untuk sinkronisasi data dari Google Sheets.
 * Mendukung Schema Normalization, RLS Protection, dan Lookup Preloading.
 */
/**
 * STARKIT VOYAGER FRONTEND ENGINE - v44.4.1 (REFERENCE MODE PATCHED)
 * Memastikan tabel lookup dengan mode "reference" terdeteksi dan di-cache.
 */
async loadResource(forceRefresh = false) {
  const vm = document.getElementById("view-mode")?.value || "active";
  const btnRefresh = document.getElementById("btn-refresh");
  const btnAdd = document.getElementById("btn-add");
  const titleEl = document.getElementById("cur-title");

  /* =====================================================
   * UI START - Memberikan feedback visual kepada user
   * ===================================================== */
  if (btnRefresh) btnRefresh.classList.add("animate-spin");
  if (titleEl) {
    titleEl.innerText = "SYNC... " + this.currentTable.toUpperCase() + "...";
  }

  // Jika force refresh, kosongkan cache agar mengambil data paling fresh (RLS Update)
  if (forceRefresh) {
    this.resourceCache[this.currentTable] = [];
  }

  try {
    /* =====================================================
     * 0. LOAD TABLE UTAMA (Memicu RLS di Backend)
     * ===================================================== */
    const d = await this.get({
      action: "read",
      table: this.currentTable,
      viewMode: vm,
      ua: navigator.userAgent, // Wajib disertakan untuk validasi Security di BE
      _t: forceRefresh ? Date.now() : null,
    });

    if (btnRefresh) btnRefresh.classList.remove("animate-spin");

    if (!d || d.success !== true) {
      throw new Error(d?.message || "Invalid response");
    }

    /* =====================================================
     * 1. SCHEMA NORMALIZATION (PATUH TOTAL)
     * ===================================================== */
    const rawSchema = d.schema;
    this.schema = {};

    if (
      rawSchema &&
      typeof rawSchema === "object" &&
      !Array.isArray(rawSchema)
    ) {
      // Native schema object (v44+)
      this.schema = rawSchema;
    } else if (Array.isArray(rawSchema) && rawSchema.length >= 2) {
      // Legacy fallback (Support untuk versi lama)
      const headers = rawSchema[0];
      const configs = rawSchema[1];

      headers.forEach((h, i) => {
        let cfg = configs[i];
        if (typeof cfg === "string") {
          try {
            cfg = JSON.parse(cfg);
          } catch {
            cfg = {};
          }
        }
        this.schema[h] = { ...cfg, name: h, headerIdx: i };
      });
    }

    /* =====================================================
     * 2. MODES & ROW CACHE (TABLE AKTIF)
     * ===================================================== */
    this.modes = d.modes || {
      add: { can: true },
      edit: { can: true },
      delete: { can: true },
      browse: { can: true },
    };

    // d.rows di sini sudah disaring secara otomatis oleh BE melalui RLS
    const rows = Array.isArray(d.rows) ? d.rows : [];
    this.resourceCache[this.currentTable] = rows;

    /* =====================================================
     * 3. 🔥 LOOKUP PRELOAD ENGINE (FIXED FOR REFERENCE MODE)
     * ===================================================== */
    // Reset lookupTables agar tidak membawa dependensi dari tabel sebelumnya
    this.lookupTables = new Set(); 

    Object.values(this.schema).forEach((col) => {
      if (
        col.type === "LOOKUP" &&
        col.lookup?.table &&
        (col.lookup.mode === "browse" || col.lookup.mode === "reference")
      ) {
        this.lookupTables.add(col.lookup.table);
      }
    });

    // Jalankan pengambilan data untuk setiap tabel lookup yang ditemukan
    for (const table of this.lookupTables) {
      // Hanya ambil jika belum ada di cache atau sedang force refresh
      if (!this.resourceCache[table] || forceRefresh) {
        console.log(`🔁 Preloading lookup [${table}] dengan mode: reference/browse`);

        const ref = await this.get({
          action: "read",
          table: table,
          ua: navigator.userAgent,
          source: "lookup", // 🔑 INTENT: Memberitahu BE untuk memicu getLookupFields()
          mode: "browse",   // 🔑 MODE: Memberitahu BE ini request pembacaan data
        });

        if (ref && ref.success === true) {
          // Simpan data "clean" (tanpa kolom sensitif) ke cache
          this.resourceCache[table] = Array.isArray(ref.rows) ? ref.rows : [];
          console.log(`✅ Lookup [${table}] berhasil di-cache. Total: ${this.resourceCache[table].length} baris.`);
        } else {
          console.warn(`⚠️ Preload gagal untuk tabel: ${table}. Pastikan tabel ada di Spreadsheet.`);
          this.resourceCache[table] = [];
        }
      }
    }

    /* =====================================================
     * 4. ADD BUTTON VISIBILITY
     * ===================================================== */
    if (btnAdd) {
      const canAdd =
        this.modes?.add?.can === true || this.modes?.can_add === true;

      if (canAdd && vm === "active") {
        btnAdd.classList.replace("hidden", "flex");
      } else {
        btnAdd.classList.replace("flex", "hidden");
      }
    }

    /* =====================================================
     * 5. RENDER CORE
     * ===================================================== */
    this.renderTable(rows);

    if (titleEl) {
      titleEl.innerText = this.currentTable.replace(/_/g, " ").toUpperCase();
    }
    
    // Feedback ke log jika RLS aktif
    if (d.query_mode === "lookup") {
      console.info("🛡️ Row Level Security: Active and Applied.");
    }

  } catch (err) {
    console.error("🔥 loadResource fatal:", err);

    if (btnRefresh) btnRefresh.classList.remove("animate-spin");
    if (titleEl) titleEl.innerText = "LOAD ERROR";

    alert("Gagal memuat data: " + err.message);
  }
},

async loadDashboardConfig () {
    const response = await this.callBackend({ action: "getDashboardConfig" });
    if (response.success) {
      // Pastikan jika data di database kosong/null, kita kasih default value
      this.dashboardConfigs = response.data.map(item => ({
        ...item,
        vars: typeof item.vars === 'string' ? JSON.parse(item.vars) : (item.vars || []),
        allowed_role: item.allowed_role || "all" // Fallback jika data lama belum punya role
      }));
      this.renderDashboardBuilder();
    }
  },

//  async testShout() {
//     console.log('🚀 [Test] Memulai pengujian komunikasi ke Master...');
    
//     // Karena ini test, kita paksa kirim pesan 'OVERLOAD_TEST' 
//     // agar lolos filter 'isOverload' di fungsi shoutToMaster
//     const newEngine = await this.shoutToMaster('manual_overload_test_429');
    
//     if (newEngine) {
//       console.log('✅ [Test Result] BERHASIL: Engine baru diterima ->', newEngine);
//     } else {
//       console.error('❌ [Test Result] GAGAL: Master menolak atau tidak ada engine tersedia.');
//     }
//   }


};
app.init();

// Menjalankan test dengan timeout 1 menit (60.000 ms)
// console.log('⏳ [System] Menunggu 1 menit sebelum menjalankan Test Shout...');

// // Log hitung mundur setiap 15 detik agar Juragan tidak mengira aplikasi hang
// let secondsLeft = 60;
// const timer = setInterval(() => {
//   secondsLeft -= 15;
//   if (secondsLeft > 0) {
//     console.log(`... ${secondsLeft} detik tersisa sebelum test dimulai.`);
//   } else {
//     clearInterval(timer);
//   }
// }, 15000);

// setTimeout(() => {
//   app.testShout();
// }, 60000);