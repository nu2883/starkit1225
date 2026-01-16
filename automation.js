Object.assign(app, {
  // --- AUTOMATION ENGINE ---
  showAutomationBuilder: function () {
    this.resetViews();
    const section = document.getElementById("automation-builder-section");
    if (section) {
      section.classList.remove("hidden");
      document.getElementById("cur-title").innerText = "Automation Engine";
      this.renderAutomationBuilder();
    } else {
      console.error("ID 'automation-builder-section' tidak ditemukan di HTML");
    }
  },

  async saveAutomationRule() {
    const btn = event.target.closest("button");
    const originalText = btn.innerHTML;

    // 1. Ambil Data dari Form Automation
    const thenValRaw = document.getElementById("then-value").value;

    // SOLUSI: Jika diawali + atau -, tambahkan kutip satu agar Google Sheets membacanya sebagai TEXT
    const safeThenValue =
      thenValRaw.startsWith("+") || thenValRaw.startsWith("-")
        ? "'" + thenValRaw
        : thenValRaw;

    const config = {
      event: document.getElementById("auto-event").value,
      source_table: document.getElementById("auto-table").value,
      if_field: document.getElementById("if-field").value,
      if_op: document.getElementById("if-op").value,
      if_value: document.getElementById("if-value").value,
      target_table: document.getElementById("then-table").value,
      then_field: document.getElementById("then-field").value,
      then_mode: document.getElementById("then-mode").value,
      then_value: safeThenValue, // Gunakan yang sudah diproteksi
      match_field: document.getElementById("match-field").value,
      match_source: document.getElementById("match-source").value,
    };

    // 2. Validasi Sederhana
    if (!config.source_table || !config.target_table || !config.match_field) {
      alert(
        "Waduh Juragan, Tabel Sumber, Target, dan Matching Logic wajib diisi!"
      );
      return;
    }

    // 3. Kirim ke Backend
    btn.innerHTML =
      '<i class="fa-solid fa-spinner animate-spin"></i> DEPLOYING...';
    btn.disabled = true;

    try {
      // Pastikan table 'config_automations' atau sesuai nama di BE juragan
      const res = await this.post({
        action: "create_automation",
        table: "config_automations", // Pastikan nama tabel sinkron
        data: config,
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
      const targetId = type === "source" ? "if-field" : "then-field";
      const el = document.getElementById(targetId);
      if (el) el.innerHTML = "<option>Loading Fields...</option>";

      const res = await this.get({
        action: "read",
        table: tableName,
        limit: 1,
      });
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
      return fields
        .map((f) => {
          // Ambil label asli dari metadata, jika tidak ada pakai nama field asli
          const label = schema[f]?.label || f;
          const val = withBrackets ? `{${f}}` : f;

          // Tampilan murni: Nama Label [nama_field]
          // Contoh: JENIS KOPI [jeniskopi]
          return `<option value="${val}">${label} [${f}]</option>`;
        })
        .join("");
    };

    // 3. Distribusi ke Dropdown
    if (type === "source") {
      document.getElementById("if-field").innerHTML =
        `<option value="">-- PILIH FIELD --</option>` + makeOptions();
      document.getElementById("match-source").innerHTML =
        `<option value="">-- FIELD SUMBER --</option>` + makeOptions(true);
    } else {
      document.getElementById("then-field").innerHTML =
        `<option value="">-- FIELD TARGET --</option>` + makeOptions();
      document.getElementById("match-field").innerHTML =
        `<option value="">-- FIELD TARGET --</option>` + makeOptions();
    }

    console.log(`✅ Dropdown ${tableName} Updated secara murni!`);
  },
  renderAutomationBuilder: function () {
    const container = document.getElementById("automation-builder");
    if (!container) return;

    const tables = (this.allResources || []).map((r) => r.id);

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
        ${tables.map((t) => `<option value="${t}">${t}</option>`).join("")}
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
        ${tables.map((t) => `<option value="${t}">${t}</option>`).join("")}
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
});
