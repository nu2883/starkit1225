/**
 * 🛡️ ACCESS CONTROL ENGINE - JURAGAN SAAS SHEET
 * Version: 11.4 (Optimized UI & Search Engine)
 * Target: 1000 SA Users | Professional Policy Builder
 */

Object.assign(app, {
  // Simpan data asli untuk pencarian
  rawPermissionData: [],

  // --- 1. VIEW CONTROLLER ---
async openAccessControl() {
    this.resetViews();
    const view = document.getElementById("view-permissions");
    const container = document.getElementById("permissions-content-area");
    if (view) view.classList.remove("hidden");
    document.getElementById("cur-title").innerText = "SECURITY GUARD";

    container.innerHTML = `<div class="p-20 text-center font-black opacity-20 animate-pulse tracking-[0.5em]">SYNCING...</div>`;

    const res = await this.get({ action: "read", table: "config_permissions" });
    if (res.success && res.rows) {
      this.rawPermissionData = res.rows;
      this.renderPermissions(res.rows);
    } else {
      container.innerHTML = `<div class="p-10 text-center text-red-500 font-bold uppercase">Sync Failed</div>`;
    }
  },

  renderPermissions(data) {
    const container = document.getElementById("permissions-content-area");
    if (!container) return;

    let html = `
      <div class="animate-fade-in pb-10 space-y-4 px-2 md:px-0">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-l-4 border-red-500 pl-4 md:pl-6 mb-6">
          <div>
            <h2 class="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase">Security Studio</h2>
            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">Manage Access</p>
          </div>
          
          <div class="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div class="relative group w-full">
              <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
              <input type="text" 
                     placeholder="Search..." 
                     oninput="app.filterPermissions(this.value)"
                     class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-blue-500 transition-all shadow-sm">
            </div>
            
            <button onclick="app.openPermissionStudio()" class="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg active:scale-95">
              <i class="fa-solid fa-plus mr-1"></i> New
            </button>
          </div>
        </div>

        <div class="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-100 text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  <th class="px-6 md:px-8 py-4">Resource</th>
                  <th class="px-4 py-4 text-center">Role</th>
                  <th class="px-2 py-4 text-center text-blue-500">B</th>
                  <th class="px-2 py-4 text-center text-emerald-500">A</th>
                  <th class="px-2 py-4 text-center text-orange-500">E</th>
                  <th class="px-2 py-4 text-center text-rose-500">D</th>
                  <th class="px-6 py-4">Config</th>
                  <th class="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="permission-table-body" class="divide-y divide-slate-50">
                ${this.generateTableRows(data)}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
      
    container.innerHTML = html;
  },

  generateTableRows(data) {
    if (data.length === 0) {
      return `<tr><td colspan="8" class="p-10 text-center text-slate-300 font-bold uppercase text-[10px]">No matches found</td></tr>`;
    }

    return data.map((p) => {
      const isTrue = (v) => String(v || "").toUpperCase() === "TRUE";
      const rowId = p.id || p.ID;

      return `
        <tr class="hover:bg-slate-50/50 transition-all group">
          <td class="px-6 md:px-8 py-3 font-black text-slate-800 uppercase tracking-tighter text-xs md:text-[13px]">${p.resource || p.RESOURCE || '-'}</td>
          <td class="px-4 py-3 text-center">
            <span class="px-2 py-0.5 bg-slate-100 rounded text-[8px] font-black uppercase text-slate-500">${p.role || p.ROLE || '-'}</span>
          </td>
          <td class="px-2 py-3 text-center">${this.drawStatus(isTrue(p.can_browse || p.CAN_BROWSE))}</td>
          <td class="px-2 py-3 text-center">${this.drawStatus(isTrue(p.can_add || p.CAN_ADD))}</td>
          <td class="px-2 py-3 text-center">${this.drawStatus(isTrue(p.can_edit || p.CAN_EDIT))}</td>
          <td class="px-2 py-3 text-center">${this.drawStatus(isTrue(p.can_delete || p.CAN_DELETE))}</td>
          <td class="px-6 py-3">
             <div class="flex flex-col">
               <span class="text-[7px] font-black text-blue-500 uppercase">${p.ownership_policy || p.OWNERSHIP_POLICY || 'all'}</span>
               <span class="text-[9px] font-mono text-slate-300 truncate max-w-[150px] italic">${p.field_policy || p.FIELD_POLICY || 'FULL'}</span>
             </div>
          </td>
          <td class="px-6 py-3 text-right">
            <div class="flex justify-end gap-2">
              <button onclick='app.openPermissionStudio(${JSON.stringify(p)})' 
                      class="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all">
                 <i class="fa-solid fa-sliders text-[10px]"></i>
              </button>
              <button onclick="app.deletePermissionPolicy('${rowId}', this)" 
                      class="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-red-600 transition-all">
                 <i class="fa-solid fa-trash-can text-[10px]"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join("");
  },

// --- 3. DELETE LOGIC (FIXED & SECURE) ---
  async deletePermissionPolicy(id, el) {
    // el adalah referensi tombol yang diklik (dikirim via 'this')
    if (!id) return;
    
    if (!confirm("⚠️ Hapus policy [" + id + "], Juragan?")) return;

    // Proteksi jika el tidak terbaca, ambil fallback
    const originalContent = el ? el.innerHTML : '<i class="fa-solid fa-trash-can text-[10px]"></i>';
    
    if (el) {
      el.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin text-[10px]"></i>`;
      el.disabled = true;
      el.classList.add("opacity-50");
    }

    try {
      const res = await this.post({
        action: "delete",
        table: "config_permissions",
        data: { id: id }
      });

      if (res.success) {
        // Refresh otomatis setelah berhasil
        this.openAccessControl();
      } else {
        throw new Error(res.message || "Gagal menghapus");
      }
    } catch (err) {
      alert("❌ Deployment Error: " + err.message);
      // Kembalikan tombol ke kondisi semula jika gagal
      if (el) {
        el.innerHTML = originalContent;
        el.disabled = false;
        el.classList.remove("opacity-50");
      }
    }
  },

  // --- 4. FILTER, DRAW, STUDIO (Tetap Sama) ---
  filterPermissions(query) {
    const q = query.toLowerCase().trim();
    const filtered = this.rawPermissionData.filter(p => {
      const res = String(p.resource || p.RESOURCE || "").toLowerCase();
      const role = String(p.role || p.ROLE || "").toLowerCase();
      return res.includes(q) || role.includes(q);
    });
    document.getElementById("permission-table-body").innerHTML = this.generateTableRows(filtered);
  },

  drawStatus: (bool) => bool 
    ? `<i class="fa-solid fa-circle-check text-emerald-400 text-[10px]"></i>` 
    : `<i class="fa-solid fa-circle-xmark text-slate-200 text-[10px]"></i>`,

  // --- 4. STUDIO / MODAL LOGIC (Existing but Optimized) ---
  async openPermissionStudio(data = null) {
    this.editingId = data ? (data.id || data.ID) : null;
    const modal = document.getElementById("f-modal");
    const container = document.getElementById("f-fields");
    const commitBtn = document.getElementById("btn-commit");
    
    if (!modal || !container) return;

    document.getElementById("modal-title").innerText = this.editingId ? "ADJUST POLICY" : "NEW SECURITY POLICY";
    
    if (commitBtn) {
      commitBtn.innerText = this.editingId ? "UPDATE POLICY" : "DEPLOY POLICY";
      commitBtn.onclick = () => this.saveSecurityPolicy();
    }

    modal.classList.replace("hidden", "flex");
    container.innerHTML = `<div class="p-20 text-center font-black opacity-20 animate-pulse tracking-widest">SYNCING ROLES...</div>`;

    // Roles Loading
    let roleData = this.resourceCache?.['roles'] || [];
    if (roleData.length === 0) {
      const resRoles = await this.get({ action: "read", table: "roles" });
      if (resRoles.success) {
        roleData = resRoles.rows || resRoles.data || [];
        if(!this.resourceCache) this.resourceCache = {};
        this.resourceCache['roles'] = roleData;
      }
    }

    const tables = (this.allResources || []).map(r => r.id);
    const selectedRes = data ? (data.resource || data.RESOURCE) : "";
    const selectedRole = data ? (data.role || data.ROLE || "").toLowerCase().trim() : "";

    const roleOptions = roleData.map(r => {
      const val = (r.role_name || r.ROLE_NAME || r.name || r.id || "").toLowerCase().trim();
      const label = (r.role_name || r.ROLE_NAME || r.name || r.id || "").toUpperCase();
      return `<option value="${val}" ${selectedRole === val ? 'selected' : ''}>${label}</option>`;
    }).join("");

    let html = `
      <div class="space-y-4 text-left pb-6">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Resource Table</label>
            <select id="p-resource" onchange="app.loadColumnsForPolicy(this.value)" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none border-2 border-transparent focus:border-blue-500 transition-all">
              <option value="">-- SELECT TABLE --</option>
              ${tables.map(t => `<option value="${t}" ${selectedRes === t ? 'selected' : ''}>${t.toUpperCase()}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Apply to Role</label>
            <select id="p-role" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none border-2 border-transparent focus:border-blue-500 transition-all">
              <option value="">-- SELECT ROLE --</option>
              <option value="admin" ${selectedRole === 'admin' ? 'selected' : ''}>ADMIN</option>
              ${roleOptions}
            </select>
          </div>
        </div>

        <div class="p-4 bg-slate-900 rounded-[1.5rem] grid grid-cols-4 gap-2 text-center shadow-inner">
          ${["Browse", "Add", "Edit", "Delete"].map(act => {
            const key = `can_${act.toLowerCase()}`;
            const isChecked = data ? String(data[key] || data[key.toUpperCase()]).toUpperCase() === "TRUE" : true;
            return `
              <div>
                <label class="text-[7px] font-black text-slate-500 uppercase block mb-1">${act}</label>
                <input type="checkbox" id="p-${key}" ${isChecked ? 'checked' : ''} class="w-5 h-5 accent-blue-500 cursor-pointer">
              </div>`;
          }).join("")}
        </div>

        <div>
          <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data Ownership</label>
          <select id="p-policy" class="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none border-2 border-transparent focus:border-blue-500">
            <option value="all" ${data && (data.ownership_policy === 'all') ? 'selected' : ''}>ALL DATA (Global Access)</option>
            <option value="own" ${data && (data.ownership_policy === 'own') ? 'selected' : ''}>ONLY OWN DATA (Personal Access)</option>
          </select>
        </div>

        <div>
          <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Column Access Control</label>
          <div id="column-selector" class="flex flex-wrap gap-1.5 p-4 border-2 border-dashed border-slate-200 rounded-[1.5rem] min-h-[80px] bg-white transition-all">
            <p class="text-[10px] text-slate-400 italic font-bold">Select table first...</p>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    if (selectedRes) {
      const fieldPolicyVal = data ? (data.field_policy || data.FIELD_POLICY || "") : "";
      this.loadColumnsForPolicy(selectedRes, fieldPolicyVal);
    }
  },

  async loadColumnsForPolicy(tableName, existingPolicy = "") {
    const container = document.getElementById("column-selector");
    if (!tableName) {
      container.innerHTML = `<p class="text-[10px] text-slate-400 italic font-bold">Select table first...</p>`;
      return;
    }

    container.innerHTML = `<div class="animate-pulse text-[10px] font-black text-slate-400">READING COLUMNS...</div>`;
    
    let schema = this.schemaCache[tableName]?.schema;
    if (!schema) {
      const res = await this.get({ action: "read", table: tableName, limit: 1 });
      if (res.success && res.schema) {
        this.schemaCache[tableName] = { schema: res.schema };
        schema = res.schema;
      }
    }

    const fields = Object.keys(schema || {}).filter(f => !["id", "created_at", "created_by", "deleted_at"].includes(f));
    const allowed = existingPolicy ? String(existingPolicy).split(",").map(f => f.trim().toLowerCase()) : [];

    container.innerHTML = fields.map(f => {
      const isChecked = existingPolicy === "" || allowed.includes(f.toLowerCase());
      return `
        <label class="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer hover:border-blue-500 transition-all">
          <input type="checkbox" name="field-policy-item" value="${f}" ${isChecked ? 'checked' : ''} class="w-3 h-3 accent-blue-600">
          <span class="text-[9px] font-black text-slate-600 uppercase tracking-tighter">${f}</span>
        </label>
      `;
    }).join("");
  },

  closeForm() {
    const modal = document.getElementById("f-modal");
    const commitBtn = document.getElementById("btn-commit");
    if (modal) modal.classList.replace("flex", "hidden");
    if (commitBtn) {
      commitBtn.disabled = false;
      commitBtn.innerText = "COMMIT DATA";
      commitBtn.classList.remove("opacity-50", "cursor-not-allowed");
      commitBtn.onclick = (e) => this.save(e);
    }
  },

  async saveSecurityPolicy() {
    const btn = document.getElementById("btn-commit");
    const payload = {
      id: this.editingId || "PERM-" + new Date().getTime(),
      resource: document.getElementById("p-resource").value,
      role: document.getElementById("p-role").value,
      can_browse: document.getElementById("p-can_browse").checked ? "TRUE" : "FALSE",
      can_add: document.getElementById("p-can_add").checked ? "TRUE" : "FALSE",
      can_edit: document.getElementById("p-can_edit").checked ? "TRUE" : "FALSE",
      can_delete: document.getElementById("p-can_delete").checked ? "TRUE" : "FALSE",
      ownership_policy: document.getElementById("p-policy").value,
      field_policy: Array.from(document.querySelectorAll('input[name="field-policy-item"]:checked'))
                           .map(cb => cb.value).join(",")
    };

    if (!payload.resource || !payload.role) {
      alert("⚠️ Resource dan Role wajib dipilih, Juragan!");
      return;
    }

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "DEPLOYING...";
    btn.classList.add("opacity-50", "cursor-not-allowed");

    try {
      const res = await this.post({
        action: this.editingId ? "update" : "create",
        table: "config_permissions",
        data: payload
      });

      if (res.success) {
        btn.innerText = "🚀 DEPLOYED!";
        setTimeout(() => {
          this.closeForm();
          this.openAccessControl();
        }, 800);
      } else {
        throw new Error(res.message || "Unknown Error");
      }
    } catch (err) {
      alert("❌ Deployment Failed: " + err.message);
      btn.disabled = false;
      btn.innerText = originalText;
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    }
  },
});