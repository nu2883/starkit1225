window.Accesscontrol = {
    originalData: [], // Simpan data asli di sini

    async getTemplate() {
        return `
        <div class="p-8 max-w-7xl mx-auto animate-fade-in">
            <div class="flex items-center justify-between mb-8 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-red-500/20">
                <div class="flex items-center gap-6">
                    <div class="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/30">
                        <i class="fa-solid fa-shield-halved text-red-500 text-2xl"></i>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-white uppercase tracking-tighter italic">Security Guard</h2>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Live Sync • Row-Level Protection</p>
                    </div>
                </div>
                <button  class="disabled px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-red-900/40">
                    <i class="fa-solid fa-shield-check mr-2"></i> Sync Changes
                </button>
            </div>

            <div class="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-slate-50 border-b border-slate-200">
                            <th class="p-6 text-[9px] font-black uppercase text-slate-400 text-center w-16">No</th>
                            <th class="p-6 text-[9px] font-black uppercase text-slate-400">Resource & Role</th>
                            <th class="p-4 text-[9px] font-black uppercase text-slate-400 text-center">Browse</th>
                            <th class="p-4 text-[9px] font-black uppercase text-slate-400 text-center">Add</th>
                            <th class="p-4 text-[9px] font-black uppercase text-slate-400 text-center">Edit</th>
                            <th class="p-4 text-[9px] font-black uppercase text-slate-400 text-center">Delete</th>
                            <th class="p-6 text-[9px] font-black uppercase text-slate-400">Ownership Policy</th>
                        </tr>
                    </thead>
                    <tbody id="permission-matrix-body" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>`;
    },

    async init() {
        await this.loadPermissionMatrix();
    },

    async loadPermissionMatrix() {
        const body = document.getElementById('permission-matrix-body');
        if (!body) return;
        body.innerHTML = `<tr><td colspan="7" class="p-20 text-center"><i class="fa-solid fa-spinner animate-spin text-slate-200 text-4xl"></i></td></tr>`;

        const res = await app.get({ action: 'read', table: 'config_permissions' });
        
        if (res.success && res.rows) {
            // Filter hanya data murni (abaikan baris label JSON)
            this.originalData = res.rows.filter(r => r.resource && !String(r.resource).includes('{'));
            
            let html = '';
            this.originalData.forEach((row, index) => {
                html += `
                <tr class="hover:bg-slate-50/50 transition-colors" data-index="${index}">
                    <td class="p-6 text-center text-[10px] font-black text-slate-300">${index + 1}</td>
                    <td class="p-6">
                        <div class="flex flex-col">
                            <span class="font-black text-slate-800 uppercase text-xs">${row.resource}</span>
                            <span class="text-[9px] font-bold text-red-500 uppercase italic">${row.role}</span>
                        </div>
                    </td>
                    ${['can_browse', 'can_add', 'can_edit', 'can_delete'].map(col => {
                        const isChecked = String(row[col] || row[col.replace('can_', '').toUpperCase()]).toUpperCase() === 'TRUE';
                        return `
                        <td class="p-4 text-center">
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" data-col="${col}" class="sr-only peer" ${isChecked ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                            </label>
                        </td>`;
                    }).join('')}
                    <td class="p-6">
                        <select class="policy-select bg-slate-50 border-none text-[10px] font-bold rounded-lg p-2 outline-none w-full">
                            <option value="ALL" ${row.ownership_policy === 'ALL' ? 'selected' : ''}>ALL ACCESS</option>
                            <option value="OWNER" ${row.ownership_policy === 'OWNER' ? 'selected' : ''}>OWNER ONLY</option>
                        </select>
                    </td>
                </tr>`;
            });
            body.innerHTML = html;
        }
    },

    async savePermissions(e) {
        const btn = e.target.closest('button');
        const originalText = btn.innerHTML;
        const rowElements = document.querySelectorAll('#permission-matrix-body tr');
        
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> COMPARING...';
        btn.disabled = true;

        let changedCount = 0;

        try {
            for (let tr of rowElements) {
                const idx = tr.dataset.index;
                const original = this.originalData[idx];

                const current = {
                    resource: original.resource,
                    role: original.role,
                    can_browse: tr.querySelector('[data-col="can_browse"]').checked,
                    can_add: tr.querySelector('[data-col="can_add"]').checked,
                    can_edit: tr.querySelector('[data-col="can_edit"]').checked,
                    can_delete: tr.querySelector('[data-col="can_delete"]').checked,
                    ownership_policy: tr.querySelector('.policy-select').value
                };

                // CEK PERUBAHAN: Hanya kirim jika ada yang beda
                const isChanged = 
                    String(original.can_browse).toUpperCase() !== String(current.can_browse).toUpperCase() ||
                    String(original.can_add).toUpperCase() !== String(current.can_add).toUpperCase() ||
                    String(original.can_edit).toUpperCase() !== String(current.can_edit).toUpperCase() ||
                    String(original.can_delete).toUpperCase() !== String(current.can_delete).toUpperCase() ||
                    original.ownership_policy !== current.ownership_policy;

                if (isChanged) {
                    console.log(`Updating row: ${current.resource} [${current.role}]`);
                    await app.post({ 
                        action: 'update', 
                        table: 'config_permissions', 
                        data: current 
                    });
                    changedCount++;
                }
            }

            alert(changedCount > 0 ? `🚀 Berhasil sinkron ${changedCount} baris yang berubah!` : "Tidak ada perubahan yang perlu disimpan, Juragan.");
            if (changedCount > 0) this.loadPermissionMatrix();
        } catch (err) {
            alert("Gagal sinkron data.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};