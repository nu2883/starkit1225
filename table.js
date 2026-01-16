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

  renderTable(rows = []) {
    const head = document.getElementById("t-head");
    const body = document.getElementById("t-body");
    const emptyState = document.getElementById("empty-state");
    const btnAdd = document.getElementById("btn-add");
    const viewMode = document.getElementById("view-mode")?.value || "active";

    // --- PERMISSIONS ---
    const m = this.modes || {};
    const canAdd = m.add?.can === true || m.can_add === true;
    const canEdit = m.edit?.can === true || m.can_edit === true;
    const canDelete = m.delete?.can === true || m.can_delete === true;

    if (btnAdd) {
      viewMode === "active" && canAdd
        ? btnAdd.classList.replace("hidden", "flex")
        : btnAdd.classList.replace("flex", "hidden");
    }

    // --- FIELD DETERMINATION ---
    let fields = [];
    if (
      this.schema &&
      !Array.isArray(this.schema) &&
      Object.keys(this.schema).length > 0
    ) {
      fields = Object.keys(this.schema);
    } else if (rows.length > 0) {
      fields = Object.keys(rows[0]);
    }
    this.activeFields = fields.filter(
      (f) =>
        isNaN(f) &&
        ![
          "id",
          "is_deleted",
          "deleted_at",
          "salt",
          "password",
          "created_at",
          "created_by",
        ].includes(f)
    );

    // --- EMPTY STATE ---
    if (!rows || rows.length === 0) {
      if (body) body.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      this.renderPaginationControls();
      return;
    }
    if (emptyState) emptyState.classList.add("hidden");

    // --- SORT LOGIC ---
    const sortedRows = [...rows].sort((a, b) => {
      const tsA = new Date(a.created_at || 0).getTime() || parseInt(a.id || 0);
      const tsB = new Date(b.created_at || 0).getTime() || parseInt(b.id || 0);
      return this.tableSortDesc ? tsB - tsA : tsA - tsB; // toggle DESC/ASC
    });

    this.currentDataView = sortedRows;
    this.pagination.totalRows = sortedRows.length;
    this.pagination.totalPages = Math.ceil(
      sortedRows.length / this.pagination.perPage
    );
    if (this.pagination.currentPage > this.pagination.totalPages) {
      this.pagination.currentPage = Math.max(1, this.pagination.totalPages);
    }

    const startIdx =
      (this.pagination.currentPage - 1) * this.pagination.perPage;
    const pageRows = sortedRows.slice(
      startIdx,
      startIdx + this.pagination.perPage
    );

    // --- RENDER HEADER DENGAN TOGGLE SORT ---
    if (head) {
      head.innerHTML = `<tr>
      ${this.activeFields
        .map((f) => {
          const label =
            this.schema && this.schema[f]?.label
              ? this.schema[f].label
              : f.replace(/_/g, " ").toUpperCase();
          return `<th class="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
          ${this.escapeHTML(label)}
          <button onclick="app.toggleSort()" class="ml-1 text-xs">Sort: ${
            this.tableSortDesc ? "↓" : "↑"
          }</button>
        </th>`;
        })
        .join("")}
      <th class="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Actions</th>
    </tr>`;
    }

    // --- RENDER BODY ---
    if (body) {
      body.innerHTML = pageRows
        .map((row) => {
          return `
        <tr id="row-${
          row.id
        }" class="hover:bg-blue-50/50 border-b border-slate-100 transition-colors group">
          ${this.activeFields
            .map((f) => {
              let val = row[f] === undefined || row[f] === null ? "-" : row[f];
              if (f.toLowerCase().includes("harga") && val !== "-") {
                val = new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  minimumFractionDigits: 0,
                }).format(val);
              }
              return `<td class="p-6 font-medium text-slate-600 text-sm truncate max-w-[200px]">${this.escapeHTML(
                String(val)
              )}</td>`;
            })
            .join("")}
          <td class="p-6 text-right space-x-2 whitespace-nowrap">
            ${
              canEdit
                ? `<button data-id="${row.id}" onclick="app.handleEdit(this)" class="inline-flex items-center justify-center p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-xl shadow-sm shadow-blue-100 transition-all duration-200"><i class="fa-solid fa-pen-to-square"></i></button>`
                : ""
            }
            ${
              viewMode === "active" && canDelete
                ? `<button onclick="app.remove('${this.currentTable}', '${row.id}')" class="inline-flex items-center justify-center p-2.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl shadow-sm shadow-red-100 transition-all duration-200"><i class="fa-solid fa-trash-can"></i></button>`
                : ""
            }
          </td>
        </tr>`;
        })
        .join("");
    }

    // --- PAGINATION ---
    this.renderPaginationControls();
  },

  // --- TOGGLE SORT FUNCTION ---
  toggleSort() {
    this.tableSortDesc = !this.tableSortDesc;
    this.renderTable(this.currentDataView);
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
          class="w-10 h-10 rounded-xl text-xs font-bold transition-all ${
            i === currentPage
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
                    `<option value="${opt}" ${
                      perPage == opt ? "selected" : ""
                    }>${opt} per page</option>`
                )
                .join("")}
            </select>
          </div>
          <div class="flex flex-col text-left">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Data Statistics</span>
            <span class="text-sm text-slate-600 font-bold">
              Showing <span class="text-blue-600">${
                (currentPage - 1) * perPage + 1
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
          <button ${
            isFirst ? "disabled" : ""
          } onclick="app.gotoPage(1)" class="p-2 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 transition-all">
            <i class="fa-solid fa-angles-left text-[10px]"></i>
          </button>
          <div class="flex gap-1">${pageNumbers}</div>
          <button ${
            isLast ? "disabled" : ""
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
  async openForm(data = null) {
    this.editingId = data ? data.id : null;
    const modal = document.getElementById("f-modal");
    const container = document.getElementById("f-fields");
    if (!modal || !container) return;

    // Set judul modal
    document.getElementById("modal-title").innerText = this.editingId
      ? `EDIT ${this.currentTable.toUpperCase()}`
      : `NEW ${this.currentTable.toUpperCase()}`;
    modal.classList.replace("hidden", "flex");

    // Tentukan fields
    let fields =
      this.activeFields && this.activeFields.length > 0
        ? this.activeFields
        : Object.keys(this.schema || {});
    fields = fields.filter(
      (f) =>
        ![
          "id",
          "created_at",
          "created_by",
          "deleted_at",
          "is_deleted",
          "salt",
          "password",
        ].includes(f)
    );

    // Bangun HTML form
    let html = "";
    for (const f of fields) {
      const s =
        this.schema && this.schema[f]
          ? this.schema[f]
          : {
              type: "TEXT",
              label: f.replace(/_/g, " ").toUpperCase(),
              required: false,
            };
      if (s.hidden) continue;

      const val = data ? data[f] || "" : "";
      const isLocked =
        String(s.disabled).toLowerCase() === "true" ||
        s.type === "AUTOFILL" ||
        s.type === "FORMULA";
      const isRequired = s.required === true;
      const lockClass = isLocked
        ? "bg-slate-100 text-slate-400 border-dashed"
        : "bg-slate-50 text-slate-700";
      const labelHtml = this.escapeHTML(s.label || f.replace(/_/g, " "));
      const requiredMarker = isRequired
        ? '<span class="text-red-500 ml-1">*</span>'
        : "";

      html += `<div class="mb-4 text-left">
      <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest text-left">
        ${labelHtml}${requiredMarker}
      </label>`;

      if (s.type === "LOOKUP" && s.lookup) {
        html += `<select id="f-${f}" name="${f}" ${
          isRequired ? "required" : ""
        } onchange="app.triggerLookup('${f}', this.value)" 
                class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none bg-slate-50">
              </select>`;
      } else {
        const inputType =
          s.type === "NUMBER" || s.type === "CURRENCY"
            ? "number"
            : s.type === "DATE"
            ? "date"
            : "text";
        html += `<input id="f-${f}" name="${f}" type="${inputType}" value="${val}" 
                ${isLocked ? "disabled" : ""} 
                ${isRequired ? "required" : ""} 
                oninput="app.runLiveFormula()" 
                class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none ${lockClass}">`;
      }

      if (isLocked)
        html += `<input type="hidden" id="f-${f}-hidden" name="${f}" value="${val}">`;
      html += `</div>`;
    }

    container.innerHTML = html;

    // Populate lookup fields
    for (const f of fields) {
      const s = this.schema ? this.schema[f] : null;
      if (s?.type === "LOOKUP")
        await this.populateLookup(
          f,
          s.lookup.table,
          s.lookup.field,
          data ? data[f] : ""
        );
    }

    this.runLiveFormula();

    // --- EVENT LISTENER: Enter = commit, Escape = close ---
    if (this._formKeyHandler)
      document.removeEventListener("keydown", this._formKeyHandler);

    const keyHandler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("btn-commit")?.click(); // PASTIKAN ID BENAR
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.closeForm();
      }
    };

    this._formKeyHandler = keyHandler;
    document.addEventListener("keydown", keyHandler);
  },
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
          return `<option value="${this.escapeHTML(label)}" ${
            String(label) === String(currentVal) ? "selected" : ""
          }>${this.escapeHTML(label)}</option>`;
        })
        .join("");
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

  async save() {
    // 1. Proteksi Awal & Ambil Tombol
    const btnSave = document.getElementById("btn-commit");
    if (this.isSubmitting) return;

    const form = document.getElementById("f-fields");

    // --- 🛡️ SHIELD: VALIDASI REQUIRED (Wajib di FE sebelum tutup) ---
    const requiredInputs = form.querySelectorAll("[required]");
    let invalidFields = [];
    requiredInputs.forEach((input) => {
      if (!input.value || input.value.trim() === "") {
        const fieldLabel =
          (this.schema && this.schema[input.name]?.label) || input.name;
        invalidFields.push(fieldLabel.toUpperCase());
        input.classList.add("border-red-500", "bg-red-50");
      }
    });

    if (invalidFields.length > 0) {
      alert("❌ WAJIB DIISI:\n" + invalidFields.join("\n"));
      return;
    }

    // 2. Collect Data
    const inputs = form.querySelectorAll("input, select");
    const data = {};
    inputs.forEach((el) => {
      if (el.name) data[el.name] = el.value;
    });
    if (this.editingId) data.id = this.editingId;

    const action = this.editingId ? "update" : "create";

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
      }, 600);

      const payload = {
        action: action,
        table: this.currentTable,
        token: this.token || localStorage.getItem("sk_token"),
        ua: navigator.userAgent,
        sheet: localStorage.getItem("sk_sheet"),
        data: data,
      };

      // 3. Kirim ke Engine GAS
      const response = await fetch(DYNAMIC_ENGINE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const resultText = await response.text();
      let resultJson;
      try {
        resultJson = JSON.parse(resultText);
      } catch (e) {
        resultJson = { success: response.ok };
      }

      // 4. Feedback via Toast/Console (Bukan menghalangi penutupan form)
      if (resultJson && resultJson.success) {
        console.log("✅ SAVE_SUCCESS");
        if (typeof this.showToast === "function")
          this.showToast("Data berhasil disimpan!", "success");
        this.loadResource(true); // Refresh data di tabel
      } else {
        console.error("❌ SAVE_FAILED:", resultJson.message);
        if (typeof this.showToast === "function")
          this.showToast("Gagal: " + resultJson.message, "error");
        else alert("Gagal Simpan: " + resultJson.message);
      }
    } catch (err) {
      console.error("🔥 CRITICAL_ERROR:", err);
      if (typeof this.showToast === "function")
        this.showToast("Koneksi Error!", "error");
      this.isSubmitting = false;
    }
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
