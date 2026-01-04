/**
 * AUTOMATION MODULE
 * Menangani logic Engine Otomasi
 */
window.Automation = {
    // A. Template UI untuk Stage
    async getTemplate() {
        // Ambil list tabel untuk dropdown
        const tables = (app.allResources || []).map(r => r.id);

        return `
        <div class="p-6 max-w-6xl mx-auto">
            <div id="automation-builder" class="space-y-10 p-10 bg-white rounded-[3rem] shadow-2xl text-left border border-slate-100">
                <div class="flex justify-between items-center border-b pb-6">
                    <div>
                        <h2 class="text-2xl font-black uppercase tracking-tighter text-slate-900">Automation Engine</h2>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Smart Data-Driven Logic</p>
                    </div>
                    <div class="bg-yellow-50 text-yellow-600 px-4 py-2 rounded-2xl flex items-center gap-2">
                        <i class="fa-solid fa-bolt-lightning animate-pulse"></i>
                        <span class="text-[10px] font-black uppercase tracking-widest">Logic Ready</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div class="space-y-4">
                        <h4 class="font-black text-[11px] uppercase tracking-widest text-blue-600 italic">1. WHEN (Source)</h4>
                        <select id="auto-event" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-none outline-none ring-1 ring-slate-100 focus:ring-blue-500">
                            <option value="CREATE">ON CREATE</option>
                            <option value="UPDATE">ON UPDATE</option>
                        </select>
                        <select id="auto-table" onchange="Automation.updateFields('source', this.value)" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-2 ring-blue-50 focus:ring-blue-500 outline-none">
                            <option value="">-- PILIH TABEL SUMBER --</option>
                            ${tables.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                        <div class="pt-4 border-t border-slate-100">
                             <p class="text-[9px] font-black text-slate-400 uppercase mb-2">IF CONDITION</p>
                             <select id="if-field" class="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"><option value="">-- FIELD --</option></select>
                             <div class="flex gap-2 mt-2">
                                <select id="if-op" class="w-20 p-3 bg-slate-100 rounded-xl text-xs font-bold">
                                    <option value=">">></option><option value="=">=</option><option value="<"><</option>
                                </select>
                                <input id="if-value" type="text" placeholder="Value" class="flex-1 p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border">
                             </div>
                        </div>
                    </div>

                    <div class="space-y-4 border-x border-slate-50 px-10">
                        <h4 class="font-black text-[11px] uppercase tracking-widest text-rose-600 italic">2. THEN (Target)</h4>
                        <select id="then-table" onchange="Automation.updateFields('target', this.value)" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-2 ring-rose-50 focus:ring-rose-500 outline-none">
                            <option value="">-- TABEL TARGET --</option>
                            ${tables.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                        <select id="then-field" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold"><option value="">-- FIELD --</option></select>
                        <select id="then-mode" class="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold">
                            <option value="MUTATE">MUTATE (+= / -=)</option>
                            <option value="SET">SET VALUE</option>
                        </select>
                        <input id="then-value" placeholder="Formula (ex: -{qty})" class="w-full p-4 bg-rose-50 text-rose-600 rounded-2xl font-mono font-bold text-sm outline-none">
                    </div>

                    <div class="space-y-4">
                        <h4 class="font-black text-[11px] uppercase tracking-widest text-slate-800 italic">3. MATCH (Link)</h4>
                        <div class="p-6 bg-slate-900 rounded-[2.5rem] space-y-4">
                            <select id="match-field" class="w-full p-3 bg-white/10 text-white rounded-xl text-xs font-bold border-none outline-none"><option value="">-- FIELD TARGET --</option></select>
                            <div class="text-center"><i class="fa-solid fa-equals text-blue-500"></i></div>
                            <select id="match-source" class="w-full p-3 bg-white/10 text-blue-300 rounded-xl text-xs font-bold border-none outline-none"><option value="">-- FIELD SUMBER --</option></select>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end pt-8 border-t">
                    <button onclick="Automation.save(event)" class="px-12 py-5 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95">
                        🚀 Deploy Engine
                    </button>
                </div>
            </div>
        </div>`;
    },

    // B. Lifecycle Init
    async init() {
        console.log("Automation Module Ready!");
    },

    // C. Logic Helper: Update Dropdown
    async updateFields(type, tableName) {
        if (!tableName) return;
        let schema = app.schemaCache[tableName]?.schema;
        if (!schema) {
            const res = await app.get({ action: 'read', table: tableName, limit: 1 });
            if (res.success) schema = res.schema;
        }
        
        const fields = Object.keys(schema || {});
        const options = (wrap = false) => fields.map(f => `<option value="${wrap ? '{'+f+'}' : f}">${schema[f]?.label || f} [${f}]</option>`).join('');

        if (type === 'source') {
            document.getElementById('if-field').innerHTML = '<option value="">-- FIELD --</option>' + options();
            document.getElementById('match-source').innerHTML = '<option value="">-- FIELD --</option>' + options(true);
        } else {
            document.getElementById('then-field').innerHTML = '<option value="">-- FIELD --</option>' + options();
            document.getElementById('match-field').innerHTML = '<option value="">-- FIELD --</option>' + options();
        }
    },

    // D. Action: Save
    async save(e) {
        const btn = e.target.closest('button');
        const originalText = btn.innerHTML;
        const valRaw = document.getElementById('then-value').value;
        const safeVal = (valRaw.startsWith('+') || valRaw.startsWith('-')) ? "'" + valRaw : valRaw;

        const config = {
            event: document.getElementById('auto-event').value,
            source_table: document.getElementById('auto-table').value,
            if_field: document.getElementById('if-field').value,
            if_op: document.getElementById('if-op').value,
            if_value: document.getElementById('if-value').value,
            target_table: document.getElementById('then-table').value,
            then_field: document.getElementById('then-field').value,
            then_mode: document.getElementById('then-mode').value,
            then_value: safeVal,
            match_field: document.getElementById('match-field').value,
            match_source: document.getElementById('match-source').value
        };

        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> DEPLOYING...';
        btn.disabled = true;

        const res = await app.post({ action: 'create_automation', table: 'config_automations', data: config });
        
        if (res.success) {
            alert("🚀 DEPLOY BERHASIL!");
        } else {
            alert("Gagal: " + res.message);
        }

        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};