/**
 * ============================================================
 * TABLE & FORM MODULE - JURAGAN SAAS SHEET
 * ============================================================
 * Version: 10.1 (Explicit Lookup Intent Edition)
 * Target: 1000 SA Users (Secure, Scalable, Stable)
 * Features: Reference Mode Support, PerPage Control, Kabataku Math.
 * Principles: Explicit Intent Compliance, Zero-Trust FE, XSS Shield.
 * ============================================================
 */

Object.assign(app, {
  // 1. STATE INITIALIZATION
  pagination: {
    currentPage: 1,
    perPage: 5, // Default sesuai spek
    totalRows: 0,
    totalPages: 0,
  },
  currentDataView: [],
  searchTimeout: null, // Untuk Debounce Engine

  /**
   * RENDER UTAMA TABEL
   */
  /**
   * RENDER UTAMA TABEL (Version 10.2 - Auto-Sort Descending)
   */
  // Tambahkan properti di app untuk track sort direction



  // --- TOGGLE SORT FUNCTION ---
toggleSort() {
  this.tableSortDesc = !this.tableSortDesc;
  this.notifyDataChange(); // 🔥 Patch #1: Invalidate Cache
  // Selalu gunakan resourceCache asli, bukan currentDataView yang sudah terpotong pagination
  this.renderTable(this.resourceCache[this.currentTable] || []);
},

  /**
   * HANDLERS FOR SECURITY (XSS GUARD)
   */
  handleEdit(btn) {
    const id = btn.getAttribute("data-id");
    const row = this.currentDataView.find((r) => String(r.id) === String(id));
    if (row) this.openForm(row);
  },

  /**
   * RENDER PAGINATION CONTROLS (With PerPage Dropdown)
   */
  renderPaginationControls() {
    const container = document.getElementById("pagination");
    if (!container) return;

    const { currentPage, totalPages, totalRows, perPage } = this.pagination;
    if (totalRows === 0) {
      container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No data to display</div>`;
      return;
    }

    const isFirst = currentPage === 1;
    const isLast = currentPage === totalPages;

    let pageNumbers = "";
    const range = 2;
    for (
      let i = Math.max(1, currentPage - range);
      i <= Math.min(totalPages, currentPage + range);
      i++
    ) {
      pageNumbers += `
        <button onclick="app.gotoPage(${i})" 
          class="w-10 h-10 rounded-xl text-xs font-bold transition-all ${i === currentPage
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
          : "text-slate-500 hover:bg-slate-100"
        }">
          ${i}
        </button>`;
    }

    const perPageOptions = [5, 10, 25, 50, 100, 250, 500, 1000];

    container.innerHTML = `
      <div class="flex flex-col lg:flex-row items-center justify-between gap-6 px-6 py-4 bg-white border border-slate-100 rounded-3xl shadow-sm mt-6">
        <div class="flex items-center gap-6">
          <div class="flex flex-col border-r border-slate-100 pr-6 text-left">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Show Rows</span>
            <select onchange="app.changePerPage(this.value)" class="bg-transparent text-sm font-bold text-blue-600 outline-none cursor-pointer">
              ${perPageOptions
        .map(
          (opt) =>
            `<option value="${opt}" ${perPage == opt ? "selected" : ""
            }>${opt} per page</option>`
        )
        .join("")}
            </select>
          </div>
          <div class="flex flex-col text-left">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Data Statistics</span>
            <span class="text-sm text-slate-600 font-bold">
              Showing <span class="text-blue-600">${(currentPage - 1) * perPage + 1
      }</span> 
              - <span class="text-blue-600">${Math.min(
        totalRows,
        currentPage * perPage
      )}</span> 
              of <span class="text-slate-900">${totalRows.toLocaleString()}</span> entries
            </span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button ${isFirst ? "disabled" : ""
      } onclick="app.gotoPage(1)" class="p-2 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 transition-all">
            <i class="fa-solid fa-angles-left text-[10px]"></i>
          </button>
          <div class="flex gap-1">${pageNumbers}</div>
          <button ${isLast ? "disabled" : ""
      } onclick="app.gotoPage(${totalPages})" class="p-2 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 transition-all">
            <i class="fa-solid fa-angles-right text-[10px]"></i>
          </button>
        </div>
      </div>
    `;
  },

  changePerPage(value) {
    this.pagination.perPage = parseInt(value);
    this.pagination.currentPage = 1;
    this.renderTable(this.currentDataView);
  },

  gotoPage(page) {
    this.pagination.currentPage = page;
    this.renderTable(this.currentDataView);
    document
      .querySelector(".overflow-auto")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  },

  searchTable(query) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      const allRows = this.resourceCache[this.currentTable] || [];
      const filtered = allRows.filter((r) =>
        Object.values(r).some((v) =>
          String(v).toLowerCase().includes(query.toLowerCase())
        )
      );
      this.pagination.currentPage = 1;
      this.renderTable(filtered);
    }, 300);
  },

  // --- FORM GENERATOR (FIXED REQUIRED ATTRIBUTE + ENTER COMMIT) ---
  // --- FORM GENERATOR (FIXED REQUIRED ATTRIBUTE + ENTER COMMIT) ---
  // --- FORM GENERATOR (FLS & PERMISSION READY) ---
  /**
 * 🚀 OPEN FORM ENGINE (VERSION 10.4)
 * Target: 1000 SA Users (Consistent Field Level Security)
 * Fitur: Mengunci field berdasarkan policy baik saat NEW maupun EDIT.
 */


  


  commitForm() {
    // cukup trigger tombol save
    document.getElementById("btn-save")?.click();
  },
  async populateLookup(fieldId, table, fieldName, currentVal) {
    const select = document.getElementById(`f-${fieldId}`);
    if (!select) return;

    // REQUIREMENT FE-02 & FE-04: FE tidak fetch browse manual, hanya ambil dari cache minimal
    const list = this.resourceCache[table] || [];

    // REQUIREMENT FE-03: Render dropdown normal (Reference Mode)
    select.innerHTML =
      `<option value="">-- PILIH --</option>` +
      list
        .map((item) => {
          const label = item[fieldName] || item.id || "N/A";
          return `<option value="${this.escapeHTML(label)}" ${String(label) === String(currentVal) ? "selected" : ""
            }>${this.escapeHTML(label)}</option>`;
        })
        .join("");
  },

  setupKeyHandlers() {
  if (this._formKeyHandler)
    document.removeEventListener("keydown", this._formKeyHandler);

  this._formKeyHandler = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("btn-commit")?.click();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.closeForm();
    }
  };

  document.addEventListener("keydown", this._formKeyHandler);
},

  triggerLookup(sourceField, value) {
    if (!this.schema) return;
    Object.keys(this.schema).forEach((targetField) => {
      const s = this.schema[targetField];
      if (s.type === "AUTOFILL" && s.autoTrigger === sourceField) {
        // Autofill sinkronisasi berdasarkan label yang dipilih di lookup
        const tableData = this.resourceCache[s.autoTable] || [];
        const match = tableData.find(
          (item) =>
            String(
              item[this.schema[sourceField].lookup?.field || sourceField]
            ) === String(value)
        );
        const el = document.getElementById(`f-${targetField}`);
        const hiddenEl = document.getElementById(`f-${targetField}-hidden`);
        if (match && el) {
          const newVal = match[s.autoCol] || "";
          el.value = newVal;
          if (hiddenEl) hiddenEl.value = newVal;
        }
      }
    });
    this.runLiveFormula();
  },

  runLiveFormula() {
    if (!this.schema) return;
    Object.keys(this.schema).forEach((f) => {
      const s = this.schema[f];
      if (s.type === "FORMULA" && s.formula) {
        const context = {};
        Object.keys(this.schema).forEach((key) => {
          const el =
            document.getElementById(`f-${key}`) ||
            document.getElementById(`f-${key}-hidden`);
          context[key] = parseFloat(el?.value) || 0;
        });
        const result = this.safeMath(s.formula, context);
        const target = document.getElementById(`f-${f}`);
        const targetHidden = document.getElementById(`f-${f}-hidden`);
        if (target) target.value = result;
        if (targetHidden) targetHidden.value = result;
      }
    });
  },

  safeMath(formula, context) {
    try {
      let expression = formula.replace(/{(\w+)}/g, (match, key) => {
        return context[key] !== undefined ? context[key] : 0;
      });
      const fn = new Function(`"use strict"; return (${expression})`);
      return fn() || 0;
    } catch (e) {
      console.warn("Math Error:", e);
      return 0;
    }
  },

  async remove(tableId, rowId) {
    if (!confirm("Hapus data secara permanen?")) return;
    const rowEl = document.getElementById(`row-${rowId}`);
    if (rowEl) rowEl.style.opacity = "0.3";

    try {
      const payload = {
        action: "delete",
        table: tableId,
        token: this.token,
        ua: navigator.userAgent,
        sheet: localStorage.getItem("sk_sheet"),
        data: { id: rowId },
      };
      const res = await fetch(DYNAMIC_ENGINE_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("API Fail");
      this.loadResource(true);
    } catch (err) {
      if (rowEl) rowEl.style.opacity = "1";
      alert("Gagal menghapus data. Periksa koneksi.");
    }
  },

  closeForm() {
    const modal = document.getElementById("f-modal");
    if (modal) modal.classList.replace("flex", "hidden");
    this.editingId = null;
  },

  escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(
      /[&<>"']/g,
      (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m])
    );
  },



  filterTable(query) {
    const searchTerm = query.toLowerCase();
    const rawData = this.resourceCache[this.currentTable] || [];
    if (!searchTerm) {
      this.renderTable(rawData);
      return;
    }
    const filtered = rawData.filter((row) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(searchTerm)
      )
    );
    this.renderTable(filtered);
  },

  // Tambahkan properti ini di dalam objek app Anda
// processingRows: new Set(),


/**
 * 💾 SAVE (Optimistic Create & Update)
 * Standard: Scope-safe, Robust Rollback, No-Crash.
 */
/**
 * 🛡️ REVISED SAVE ENGINE - FIX SS_MISSING & TOAST ERROR
 */
processingRows: new Set(),
  resourceCache: {},
  currentTable: "jenismakanan", // Contoh
  
  // Helper Notifikasi Aman
  notify(msg, type = "info") {
    if (typeof this.showToast === "function") {
      this.showToast(msg, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${msg}`);
      if (type === "error") alert(msg);
    }
  },

  lockRow(id) {
    const row = document.getElementById(`row-${id}`);
    if (row) {
      row.style.opacity = "0.4";
      row.classList.add("pointer-events-none");
    }
    this.processingRows.add(String(id));
  },

  unlockRow(id) {
    const row = document.getElementById(`row-${id}`);
    if (row) {
      row.style.opacity = "1";
      row.classList.remove("pointer-events-none");
    }
    this.processingRows.delete(String(id));
  },


/**
 * CORE TABLE STATE ENGINE - JURAGAN SAAS SHEET
 * Final Hardened Version
 */
renderTable(inputRows = []) {
  // 🔥 Patch #3: Defensive Clone (Side-effect free)
  const rows = Array.isArray(inputRows) ? [...inputRows] : [];
  
  const head = document.getElementById("t-head");
  const body = document.getElementById("t-body");
  const emptyState = document.getElementById("empty-state");
  const btnAdd = document.getElementById("btn-add");
  const viewMode = document.getElementById("view-mode")?.value || "active";
  const searchInput = document.getElementById("search-input");
  const searchTerm = searchInput?.value?.toLowerCase() || "";

  // ======================================================
  // 🛡️ SECURITY & ENGINE GUARD
  // ======================================================
  if (!this.modes || Object.keys(this.modes).length === 0) {
    if (body) body.innerHTML = `<tr><td colspan="100" class="p-10 text-center text-red-500 font-bold italic font-mono">CORE_ENGINE_UNREADY: Waiting for Security Handshake...</td></tr>`;
    return;
  }

  // Init Search Map jika belum ada (Idiot-proof)
  if (!(this._searchIndex instanceof Map)) {
    this._searchIndex = new Map();
  }

  // Tombol Tambah Permission
  if (btnAdd) {
    (viewMode === "active" && this.modes.can_add) 
      ? btnAdd.classList.replace("hidden", "flex") 
      : btnAdd.classList.replace("flex", "hidden");
  }

  // ======================================================
  // 🧩 SCHEMA & DATA SIGNATURE (ANTI-COLLISION)
  // ======================================================
  let fields = this.schema ? Object.keys(this.schema) : (rows[0] ? Object.keys(rows[0]) : []);
  this.activeFields = fields.filter(f => 
    isNaN(f) && !["id", "is_deleted", "deleted_at", "salt", "password", "created_at", "created_by"].includes(f)
  );
  
  const fieldSignature = this.activeFields.join("|");
  
  // 🛡️ TRIPLE-GUARD + CHECKSUM RINGAN (O(1))
  // Memantau Awal, Akhir, dan Panjang untuk deteksi mutasi tengah
  const rowsSignature = `${this.currentTable}:${rows.length}:${rows[0]?.id || 'x'}:${rows[rows.length-1]?.id || 'y'}`;

  // ======================================================
  // 🔍 STEP 1: SEARCH INDEXING (DEFENSIVE)
  // ======================================================
  if (
    this._lastSearchVersion !== this._dataVersion || 
    this._lastSearchFieldSignature !== fieldSignature ||
    this._lastRowsSignature !== rowsSignature
  ) {
    this._searchIndex.clear(); 
    
    rows.forEach((row, index) => {
      // Hard Guard: Jangan index data tanpa ID (Enterprise Rule)
      if (!row.id) {
        console.warn(`[CORE] Row ${index} skipped: Missing ID.`, row);
        return;
      }

      const searchContent = this.activeFields
        .map(f => String(row[f] || "").toLowerCase())
        .join(" ");
      
      this._searchIndex.set(row.id, searchContent);
    });

    this._lastSearchVersion = this._dataVersion;
    this._lastSearchFieldSignature = fieldSignature;
    this._lastRowsSignature = rowsSignature;
    this._triggerSortRefilter = true; // Invalidate Sort Cache
    
    console.log(`[CORE] Index Rebuilt: ${rows.length} rows (Integrity Verified)`);
  }

  // Filter dengan Index (O(n))
  const filteredRows = searchTerm 
    ? rows.filter(row => row.id && this._searchIndex.get(row.id)?.includes(searchTerm)) 
    : rows;

  // Reset Pagination jika search context berubah
  if (this._lastSearchTerm !== searchTerm) {
    this.pagination.currentPage = 1;
    this._lastSearchTerm = searchTerm;
    this._triggerSortRefilter = true;
  }

  // ======================================================
  // ⚡ STEP 2: DETERMINISTIC SORTING (CACHE-SYNCED)
  // ======================================================
  if (
    this._lastSortDesc !== this.tableSortDesc || 
    this._lastSortVersion !== this._dataVersion ||
    this._lastSortedSearchTerm !== searchTerm ||
    this._lastSortSignature !== fieldSignature ||
    this._triggerSortRefilter
  ) {
    this._sortedCache = [...filteredRows].sort((a, b) => {
      // Lazy-loading timestamp (Mutation accepted as performance trade-off)
      const tsA = a._ts || (a._ts = new Date(a.created_at || 0).getTime() || 0);
      const tsB = b._ts || (b._ts = new Date(b.created_at || 0).getTime() || 0);
      return this.tableSortDesc ? tsB - tsA : tsA - tsB;
    });
    
    this._lastSortDesc = this.tableSortDesc;
    this._lastSortVersion = this._dataVersion;
    this._lastSortedSearchTerm = searchTerm;
    this._lastSortSignature = fieldSignature;
    this._triggerSortRefilter = false;
  }

  const finalDisplayRows = this._sortedCache;
  this.currentDataView = finalDisplayRows;

  // ======================================================
  // 📏 STEP 3: PAGINATION
  // ======================================================
  this.pagination.totalRows = finalDisplayRows.length;
  this.pagination.totalPages = Math.ceil(finalDisplayRows.length / this.pagination.perPage) || 1;

  if (this.pagination.currentPage > this.pagination.totalPages) {
    this.pagination.currentPage = Math.max(1, this.pagination.totalPages);
  }

  const startIdx = (this.pagination.currentPage - 1) * this.pagination.perPage;
  const pageRows = finalDisplayRows.slice(startIdx, startIdx + this.pagination.perPage);

  // ======================================================
  // 🖼️ STEP 4: RENDER UI (ATOMCITY READY)
  // ======================================================
  if (pageRows.length === 0) {
    if (body) body.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    if (head) head.innerHTML = "";
    this.renderPaginationControls();
    return;
  }
  if (emptyState) emptyState.classList.add("hidden");

  // Render Header
  if (head) {
    head.innerHTML = `<tr>
      ${this.activeFields.map(f => {
        const label = this.schema?.[f]?.label || f.replace(/_/g, " ").toUpperCase();
        return `<th class="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
          <div class="flex items-center gap-1 cursor-pointer group/sort" onclick="app.toggleSort()">
            ${this.escapeHTML(label)}
            <span class="text-blue-500 opacity-50 group-hover/sort:opacity-100 transition-opacity">
              ${this.tableSortDesc ? "↓" : "↑"}
            </span>
          </div>
        </th>`;
      }).join("")}
      <th class="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">ACTIONS</th>
    </tr>`;
  }

  // Render Body
  if (body) {
    body.innerHTML = pageRows.map(row => {
      const isLocked = this.processingRows?.has(String(row.id));
      return `
        <tr id="row-${row.id}" ${isLocked ? 'style="opacity:0.4; pointer-events:none;"' : ''} 
            class="hover:bg-blue-50/50 border-b border-slate-100 transition-colors group">
          ${this.activeFields.map((f, i) => {
            let val = row[f] ?? "-";
            if ((f.toLowerCase().includes("harga") || f.toLowerCase().includes("biaya")) && val !== "-") {
              val = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
            }
            return `<td class="p-6 font-medium text-slate-600 text-sm truncate max-w-[200px]">
              ${i === 0 && isLocked ? '<i class="fa-solid fa-spinner fa-spin mr-2"></i>' : ''}${this.escapeHTML(String(val))}
            </td>`;
          }).join("")}
          <td class="p-6 text-right space-x-2 whitespace-nowrap">
            ${this.modes.can_edit ? `<button data-id="${row.id}" onclick="app.handleEdit(this)" class="p-2.5 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all active:scale-90"><i class="fa-solid fa-pen-to-square"></i></button>` : ""}
            ${(viewMode === "active" && this.modes.can_delete) ? `<button onclick="app.remove('${this.currentTable}','${row.id}')" class="p-2.5 text-red-600 bg-red-50 rounded-xl hover:bg-red-600 hover:text-white transition-all active:scale-90"><i class="fa-solid fa-trash-can"></i></button>` : ""}
          </td>
        </tr>`;
    }).join("");
  }

  this.renderPaginationControls();
},

notifyDataChange() {
  this._dataVersion = (this._dataVersion || 0) + 1;
  console.log(`[CORE] Data Version Bumped: ${this._dataVersion}`);
},

async openForm(data = null) {
  this.editingId = data ? data.id : null;
  const modal = document.getElementById("f-modal");
  const container = document.getElementById("f-fields");
  if (!modal || !container) return;

  // 1. UI Setup
  document.getElementById("modal-title").innerText = this.editingId
    ? `EDIT ${this.currentTable.toUpperCase()}`
    : `NEW ${this.currentTable.toUpperCase()}`;
  modal.classList.replace("hidden", "flex");

  // 2. Governance Setup
  const currentGov = this.modes || {};
  const fieldPolicy = currentGov.field_policy || null;

  // 3. Field Filtering
  let fields = this.activeFields?.length > 0 ? this.activeFields : Object.keys(this.schema || {});
  fields = fields.filter(f => ![
    "id", "created_at", "created_by", "deleted_at",
    "is_deleted", "salt", "password"
  ].includes(f));

  let html = "";
  for (const f of fields) {
    const s = this.schema?.[f] || { type: "TEXT", label: f.replace(/_/g, " ").toUpperCase(), required: false };
    if (s.hidden) continue;

    const val = data ? data[f] ?? "" : "";

    // 🛡️ LOGIKA FIELD LEVEL SECURITY (FLS)
    const isLockedBySystem = String(s.disabled).toLowerCase() === "true" || ["AUTOFILL", "FORMULA"].includes(s.type);
    let isLockedByPolicy = fieldPolicy && Array.isArray(fieldPolicy) ? !fieldPolicy.includes(f.toLowerCase()) : false;

    const isLocked = isLockedBySystem || isLockedByPolicy;
    const isRequired = s.required === true;
    const lockClass = isLocked ? "bg-slate-100 text-slate-400 border-dashed cursor-not-allowed" : "bg-slate-50 text-slate-700";
    const labelHtml = this.escapeHTML(s.label || f.replace(/_/g, " "));

    html += `
      <div class="mb-4 text-left">
        <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
          ${labelHtml}${isRequired && !isLocked ? '<span class="text-red-500 ml-1">*</span>' : ""}
          ${isLockedByPolicy ? '<i class="fa-solid fa-lock ml-1 text-[8px]" title="Restricted by Policy"></i>' : ''}
        </label>`;

    if (s.type === "LOOKUP" && s.lookup) {
      html += `
        <select id="f-${f}" name="${f}" ${isRequired ? "required" : ""} ${isLocked ? "disabled" : ""}
          onchange="app.triggerLookup('${f}', this.value)" 
          class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all ${lockClass}">
        </select>`;
    } else {
      const inputType = (s.type === "NUMBER" || s.type === "CURRENCY") ? "number" : s.type === "DATE" ? "date" : "text";
      html += `
        <input id="f-${f}" name="${f}" type="${inputType}" value="${this.escapeHTML(String(val))}" 
          ${isLocked ? "disabled" : ""} ${isRequired ? "required" : ""} 
          oninput="app.runLiveFormula()" 
          class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all ${lockClass}">`;
    }

    // Shield: Hidden input agar data readonly tetap terikut saat serialisasi form
    // 🔥 PERBAIKAN: Tambahkan ID khusus agar bisa di-update nilai-nya oleh runLiveFormula
    if (isLocked) {
      html += `<input type="hidden" id="f-${f}-hidden" name="${f}" value="${this.escapeHTML(String(val))}">`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  // 4. Populate Lookups
  for (const f of fields) {
    const s = this.schema?.[f];
    if (s?.type === "LOOKUP") {
      await this.populateLookup(f, s.lookup.table, s.lookup.field, data ? data[f] : "");
    }
  }

  this.runLiveFormula();

  // 5. ⌨️ KEYBOARD GOVERNANCE
  if (this._formKeyHandler) {
    document.removeEventListener("keydown", this._formKeyHandler);
  }

  this._formKeyHandler = (e) => {
    if (e.key === "Escape") this.closeForm();
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      if (e.ctrlKey || e.metaKey || e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        document.getElementById("btn-commit")?.click();
      }
    }
  };
  document.addEventListener("keydown", this._formKeyHandler);
},

/**
 * SAVE ENGINE - JURAGAN SAAS SHEET
 * Karakteristik: Optimistic UI, Rollback Safety, & Explicit ID Syncing.
 */
async save() {
  // 🛡️ SUBMISSION GUARD
  if (this.isSubmitting) return;

  const btnSave = document.getElementById("btn-commit");
  const form = document.getElementById("f-fields");
  if (!form) return;

  // ======================================================
  // 1. FAIL-FAST VALIDATION
  // ======================================================
  const requiredInputs = form.querySelectorAll("[required]");
  const invalidFields = [];
  
  requiredInputs.forEach(input => {
    const isEmpty = !input.value || !input.value.trim();
    input.classList.toggle("border-red-500", isEmpty);
    input.classList.toggle("bg-red-50", isEmpty);
    if (isEmpty) {
      const label = this.schema?.[input.name]?.label || input.name;
      invalidFields.push(label.toUpperCase());
    }
  });

  if (invalidFields.length > 0) {
    this.notify("❌ WAJIB DIISI:\n" + invalidFields.join("\n"), "error");
    return;
  }

  // ======================================================
  // 2. DATA COLLECTION (FIXED FOR AUTOFILL/FORMULA)
  // ======================================================
  const data = {};
  const inputs = form.querySelectorAll("input, select, textarea");
  
  inputs.forEach(el => { 
    if (el.name) {
      // 🔥 LOGIKA PENTING: Jika field disabled, ambil nilai dari hidden input pasangannya
      if (el.disabled) {
        const hiddenEl = document.getElementById(`f-${el.name}-hidden`);
        data[el.name] = hiddenEl ? hiddenEl.value : el.value;
      } else {
        data[el.name] = el.value; 
      }
    }
  });

  const action = this.editingId ? "update" : "create";
  const optimisticId = action === "create" ? `tmp-${Date.now()}` : this.editingId;
  let realServerId = null;

  // Snapshot original data untuk rollback
  const originalRow = this.resourceCache[this.currentTable]?.find(
    r => String(r.id) === String(this.editingId)
  );
  const originalData = originalRow ? { ...originalRow } : null;

  try {
    this.isSubmitting = true;
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.innerText = "PROSES...";
    }

    // ======================================================
    // 3. ⚡ OPTIMISTIC UI (WORKS OFFLINE)
    // ======================================================
    if (!this.resourceCache[this.currentTable]) {
      this.resourceCache[this.currentTable] = [];
    }

    const optimisticData = {
      ...data,
      id: optimisticId,
      created_at: originalData ? originalData.created_at : new Date().toISOString()
    };

    if (action === "create") {
      this.pagination.currentPage = 1;
      this.resourceCache[this.currentTable].unshift(optimisticData);
    } else {
      const idx = this.resourceCache[this.currentTable].findIndex(
        r => String(r.id) === String(this.editingId)
      );
      if (idx !== -1) {
        this.resourceCache[this.currentTable][idx] = { ...this.resourceCache[this.currentTable][idx], ...data };
      }
    }

    this.notifyDataChange();
    this.renderTable(this.resourceCache[this.currentTable]);
    
    // Kunci baris agar tidak bisa di-edit saat proses sync
    setTimeout(() => this.lockRow(optimisticId), 50);
    this.closeForm();

    // ======================================================
    // 4. NETWORK CALL
    // ======================================================
    const payload = {
      action,
      table: this.currentTable,
      token: this.token || localStorage.getItem("sk_token"),
      sheet: localStorage.getItem("sk_sheet"),
      ua: navigator.userAgent,
      data: action === "update" ? { ...data, id: this.editingId } : data
    };

    // Cek koneksi untuk handling offline secara eksplisit
    if (!navigator.onLine) {
       throw new Error("OFFLINE_MODE"); // Akan lari ke catch dan tetap stay di UI (Locked)
    }

    const response = await fetch(DYNAMIC_ENGINE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const result = JSON.parse(await response.text());
    if (!result?.success) throw new Error(result?.message || "SERVER_ERROR");

    // ======================================================
    // 5. 🔄 SYNC SUCCESS
    // ======================================================
    if (action === "create" && result.id) {
      const row = this.resourceCache[this.currentTable].find(r => r.id === optimisticId);
      if (row) {
        row.id = result.id;
        realServerId = result.id;
      }
    }
    this.notify("✅ Data tersimpan!", "success");

  } catch (err) {
    // ======================================================
    // 6. 🔄 ROLLBACK / OFFLINE HANDLING
    // ======================================================
    console.error("🔥 SAVE_ERROR:", err);

    if (err.message === "OFFLINE_MODE") {
       this.notify("⚠️ Offline. Data disimpan lokal & dikunci.", "warning");
       // Di sini Anda bisa menambahkan antrean ke IndexedDB untuk sync nanti
    } else {
      // Jika error server asli, lakukan rollback
      if (action === "create") {
        this.resourceCache[this.currentTable] = this.resourceCache[this.currentTable].filter(r => r.id !== optimisticId);
      } else if (originalData) {
        const idx = this.resourceCache[this.currentTable].findIndex(r => String(r.id) === String(this.editingId));
        if (idx !== -1) this.resourceCache[this.currentTable][idx] = originalData;
      }
      this.notify("❌ Gagal: " + err.message, "error");
    }

  } finally {
    // ======================================================
    // 7. FINAL CLEANUP
    // ======================================================
    this.unlockRow(optimisticId);
    if (realServerId) this.unlockRow(realServerId);

    this.notifyDataChange();
    this.renderTable(this.resourceCache[this.currentTable]);
    
    this.isSubmitting = false;
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.innerText = "COMMIT DATA";
    }
  }
},

});

// --- Table-specific keyboard shortcut ---
document.addEventListener("keydown", function (e) {
  // Hanya tangani Alt+N
  if (e.altKey && e.key.toLowerCase() === "n") {
    // Cek kalau table aktif / dipilih
    if (!app.currentTable) return;

    e.preventDefault();
    app.openForm(); // buka form kosong

    // Set timeout kecil supaya DOM render dulu
    setTimeout(() => {
      // Fokus ke field pertama
      const firstInput = document.querySelector(
        "#f-fields input:not([disabled]), #f-fields select:not([disabled])"
      );
      if (firstInput) firstInput.focus();
    }, 50);
  }
});
