/**
 * ============================================================
 * ROW POLICY MODULE - VOYAGER ENGINE (v1.1)
 * ============================================================
 * Features:
 * - Standardized Mapping: role_name
 * - Target: 1000 SA Users
 * - Integrated Feedback on Deploy
 * ============================================================
 */

Object.assign(app, {

  /* --- 1. ENTRY POINT --- */
  openRowPolicy: function () {
    this.resetViews();
    const section = document.getElementById("view-row-policy");
    
    if (section) {
      section.classList.remove("hidden");
      document.getElementById("cur-title").innerText = "Security & Row Policy";
      this.renderRowPolicyList(); 
    } else {
      console.error("❌ ID 'view-row-policy' tidak ditemukan");
    }
  },

  /* --- 2. RENDER LIST --- */
  renderRowPolicyList: async function () {
    const container = document.getElementById("row-policy-container");
    if (!container) return;

    container.innerHTML = `
      <div class="p-20 text-center animate-pulse">
        <i class="fa-solid fa-shield-halved text-4xl text-slate-200 mb-4"></i>
        <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Scanning Security Policies...</p>
      </div>`;

    const res = await this.get({ action: "read", table: "config_row_policies" });
    const policies = res.success ? (res.rows || res.data || []) : [];

    container.innerHTML = `
<div class="max-w-6xl mx-auto space-y-6 animate-fade-in">
  
  <div class="flex justify-between items-end px-4">
    <div>
      <h2 class="text-3xl font-black uppercase tracking-tighter text-slate-900">Active Policies</h2>
      <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manage row-level access for ${this.allResources?.length || 0} resources</p>
    </div>
    <button onclick="app.renderRowPolicyBuilder()" class="group flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl hover:bg-blue-600 transition-all shadow-xl active:scale-95">
      <i class="fa-solid fa-plus text-xs group-hover:rotate-90 transition-transform"></i>
      <span class="text-[10px] font-black uppercase tracking-[0.2em]">New Row Policy</span>
    </button>
  </div>

  <div class="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
    <table class="w-full text-left border-collapse">
      <thead class="bg-slate-50 border-b border-slate-100">
        <tr>
          <th class="p-6 text-[10px] font-black uppercase text-slate-400">Policy Name</th>
          <th class="p-6 text-[10px] font-black uppercase text-slate-400">Target Role</th>
          <th class="p-6 text-[10px] font-black uppercase text-slate-400">Resource</th>
          <th class="p-6 text-[10px] font-black uppercase text-slate-400">Condition</th>
          <th class="p-6 text-[10px] font-black uppercase text-slate-400 text-center">Effect</th>
          <th class="p-6 text-[10px] font-black uppercase text-slate-400 text-right">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-50">
        ${policies.length === 0 ? `
          <tr><td colspan="6" class="p-20 text-center text-xs font-bold text-slate-300 uppercase italic">No policies deployed yet.</td></tr>
        ` : policies.map(p => {
          // MAPPING FIX: Gunakan role_name untuk display label
          const roleData = this.resourceCache['roles'] || [];
          const roleObj = roleData.find(r => 
            String(r.role_name || r.ROLE_NAME).toLowerCase() === String(p.role).toLowerCase()
          );
          const roleLabel = roleObj ? (roleObj.role_name || roleObj.ROLE_NAME).toUpperCase() : String(p.role).toUpperCase();

          return `
          <tr class="hover:bg-slate-50/50 transition-colors">
            <td class="p-6">
              <div class="font-black text-slate-800 text-xs uppercase">${p.policy_name || 'Untitled'}</div>
              <div class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">PRIORITY: ${p.priority}</div>
            </td>
            <td class="p-6">
              <span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">${roleLabel}</span>
            </td>
            <td class="p-6 text-[10px] font-bold text-slate-500 uppercase">${p.resource}</td>
            <td class="p-6">
              <div class="flex items-center gap-2">
                <code class="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-600">${p.field}</code>
                <span class="text-slate-400 font-black">${p.operator}</span>
                <span class="text-slate-800 font-bold text-[10px]">${p.value}</span>
              </div>
            </td>
            <td class="p-6 text-center">
              <span class="px-3 py-1 ${String(p.can_view).toUpperCase() === 'TRUE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} rounded-lg text-[9px] font-black uppercase">
                ${String(p.can_view).toUpperCase() === 'TRUE' ? 'Visible' : 'Hidden'}
              </span>
            </td>
            <td class="p-6 text-right">
              <button onclick="app.deleteRowPolicy('${p.id || p.ID}')" class="text-slate-300 hover:text-rose-600 transition-colors p-2">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>
</div>`;
  },

  /* --- 3. RENDER BUILDER --- */
  renderRowPolicyBuilder: function () {
    const container = document.getElementById("row-policy-container");
    if (!container) return;

    const tables = (this.allResources || []).map((r) => r.id);
    const roleData = this.resourceCache['roles'] || [];
    
    // MAPPING FIX: Menggunakan role_name sebagai value
    const roleOptions = roleData.map(r => {
      const val = (r.role_name || r.ROLE_NAME || r.name || r.id).toLowerCase().trim();
      const label = (r.role_name || r.ROLE_NAME || r.name || r.id).toUpperCase();
      return `<option value="${val}">${label}</option>`;
    }).join("");

    container.innerHTML = `
<div class="max-w-6xl mx-auto space-y-8 p-10 bg-white rounded-[3rem] shadow-2xl animate-fade-in text-left border border-slate-100">
  
  <div class="flex justify-between items-center border-b pb-6">
    <div class="flex items-center gap-6">
      <button onclick="app.renderRowPolicyList()" class="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center hover:bg-slate-200 transition-all">
        <i class="fa-solid fa-arrow-left text-slate-400"></i>
      </button>
      <div>
        <h2 class="text-2xl font-black uppercase tracking-tighter text-slate-900">New Row Policy</h2>
        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configuring security guard...</p>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
    <div class="space-y-6">
      <h4 class="font-black text-[11px] uppercase tracking-widest text-blue-600 italic">🔹 Section 1 — Target</h4>
      <div class="space-y-2">
        <label class="text-[9px] font-black text-slate-400 uppercase px-1">Policy Name</label>
        <input id="policy-name" type="text" placeholder="ex: Filter Satpam" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all">
      </div>
      <div class="space-y-2">
        <label class="text-[9px] font-black text-slate-400 uppercase px-1">Apply to Role</label>
        <select id="policy-role" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">-- PILIH ROLE --</option>
          ${roleOptions}
        </select>
      </div>
      <div class="space-y-2">
        <label class="text-[9px] font-black text-slate-400 uppercase px-1">Target Resource</label>
        <select id="policy-resource" onchange="app.updatePolicyFields(this.value)" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">-- PILIH TABEL --</option>
          ${tables.map(t => `<option value="${t}">${t.toUpperCase()}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="space-y-6 border-x border-slate-50 px-10">
      <h4 class="font-black text-[11px] uppercase tracking-widest text-blue-600 italic">🔹 Section 2 — Condition</h4>
      <div class="space-y-2">
        <label class="text-[9px] font-black text-slate-400 uppercase px-1">Field</label>
        <select id="policy-field" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none">
          <option value="">-- PILIH FIELD --</option>
        </select>
      </div>
      <div class="space-y-2">
        <label class="text-[9px] font-black text-slate-400 uppercase px-1">Logic</label>
        <div class="flex gap-2">
          <select id="policy-operator" class="w-24 p-4 bg-slate-100 rounded-2xl text-xs font-black text-center outline-none">
            <option value="=">=</option>
            <option value="!=">!=</option>
            <option value=">">></option>
            <option value="<"><</option>
          </select>
          <input id="policy-value" type="text" placeholder="Value" class="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none">
        </div>
      </div>
    </div>

    <div class="space-y-6 bg-slate-50 p-8 rounded-[2.5rem]">
      <h4 class="font-black text-[11px] uppercase tracking-widest text-slate-800 italic">🔹 Section 3 — Effect</h4>
      <div class="flex gap-4 p-4 bg-white rounded-2xl shadow-sm">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="can_view" value="true" checked class="w-4 h-4 accent-emerald-500"> 
          <span class="text-[10px] font-black uppercase">Visible</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="can_view" value="false" class="w-4 h-4 accent-rose-500"> 
          <span class="text-[10px] font-black text-rose-600 uppercase">Hidden</span>
        </label>
      </div>
      <div class="space-y-2 pt-4">
        <label class="text-[9px] font-black text-slate-400 uppercase px-1">Priority (Lower = Stronger)</label>
        <input id="policy-priority" type="number" value="100" class="w-full p-4 bg-white rounded-2xl text-xs font-bold outline-none border border-slate-100">
      </div>
      <button id="btn-deploy-row" onclick="app.saveRowPolicy()" class="w-full py-5 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl mt-4 active:scale-95">
        Deploy Policy
      </button>
    </div>
  </div>
</div>`;
  },

  /* --- 4. DYNAMIC FIELD UPDATER --- */
  updatePolicyFields: async function (tableName) {
    if (!tableName) return;
    const fieldEl = document.getElementById("policy-field");
    if (fieldEl) fieldEl.innerHTML = "<option>Loading Fields...</option>";

    let schema = this.schemaCache?.[tableName]?.schema;
    if (!schema) {
      const res = await this.get({ action: "read", table: tableName, limit: 1 });
      if (res.success && res.schema) {
        if(!this.schemaCache) this.schemaCache = {};
        this.schemaCache[tableName] = { schema: res.schema };
        schema = res.schema;
      } else { alert("Gagal membedah tabel."); return; }
    }

    fieldEl.innerHTML = `<option value="">-- PILIH FIELD --</option>` + 
      Object.keys(schema).map(f => `<option value="${f}">${(schema[f]?.label || f).toUpperCase()} [${f}]</option>`).join("");
  },

  /* --- 5. SAVE ACTION --- */
  async saveRowPolicy() {
    const btn = document.getElementById("btn-deploy-row");
    
    const config = {
      policy_name: document.getElementById("policy-name").value.trim(),
      resource: document.getElementById("policy-resource").value.trim(),
      role: document.getElementById("policy-role").value.trim(), 
      field: document.getElementById("policy-field").value.trim(),
      operator: document.getElementById("policy-operator").value.trim(),
      value: document.getElementById("policy-value").value.trim(),
      can_view: document.querySelector('input[name="can_view"]:checked').value === "true",
      priority: parseInt(document.getElementById("policy-priority").value) || 100,
    };

    if (!config.policy_name || !config.resource || !config.role || !config.field || !config.value) {
      alert("⚠️ Semua data wajib diisi, Juragan!"); 
      return;
    }

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "DEPLOYING...";
    btn.classList.add("opacity-50");

    try {
      const res = await this.post({ 
        action: "create_row_policy", 
        table: "config_row_policies", 
        data: config 
      });
      
      if (res.success) {
        btn.innerText = "🚀 DEPLOYED!";
        setTimeout(() => this.renderRowPolicyList(), 800);
      } else {
        throw new Error(res.message);
      }
    } catch (err) {
      alert("Gagal: " + err.message);
      btn.disabled = false;
      btn.innerText = originalText;
      btn.classList.remove("opacity-50");
    }
  },

  /* --- 6. DELETE ACTION --- */
  async deleteRowPolicy(id) {
    if (!confirm("Hapus policy ini? Filter keamanan akan terbuka!")) return;
    
    const res = await this.post({ action: "delete", table: "config_row_policies", id: id });
    if (res.success) {
      this.renderRowPolicyList();
    } else {
      alert("Gagal menghapus: " + res.message);
    }
  }
});