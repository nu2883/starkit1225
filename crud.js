const CRUD = {
    async loadResource(forceRefresh = false) {
        const btn = document.getElementById('btn-refresh');
        if (btn) btn.classList.add('animate-spin');
        
        const d = await app.get({
            action: 'read', 
            table: app.currentTable,
            viewMode: document.getElementById('view-mode')?.value || 'active'
        });

        if (btn) btn.classList.remove('animate-spin');

        if (d?.success) {
            app.schema = d.schema || {};
            app.modes = d.modes || {};
            app.rowsRaw = d.rows || [];
            app.applyPermissions();
            this.renderTable(app.rowsRaw);
        }
    },

    renderTable(rows) {
        const body = document.getElementById('t-body');
        const head = document.getElementById('t-head');
        const fields = app.modes?.browse?.fields || [];

        head.innerHTML = `<tr>${fields.map(f => `
            <th class="p-6 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">${app.schema[f]?.label || f}</th>
        `).join('')}<th class="p-6 text-right text-[10px] font-black uppercase text-slate-400">Actions</th></tr>`;

        body.innerHTML = rows.map(row => `
            <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition-colors group">
                ${fields.map(f => `<td class="p-6 text-xs font-bold text-slate-600">${row[f] || '-'}</td>`).join('')}
                <td class="p-6 text-right">
                    <button onclick='app.openForm(${JSON.stringify(row)})' 
                        class="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 shadow-sm">
                        Edit
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async openForm(data = null) {
        app.editingId = data ? (data.id || data.rowId) : null;
        document.getElementById('modal-title').innerText = app.editingId ? 'EDIT ENTRY' : 'NEW ENTRY';

        const fields = app.editingId ? app.modes.edit.fields : app.modes.add.fields;
        const container = document.getElementById('f-fields');
        document.getElementById('f-modal').classList.replace('hidden', 'flex');

        // Skeleton Loading
        container.innerHTML = fields.map(() => `
            <div class="mb-4 animate-pulse">
                <div class="h-3 w-20 bg-slate-200 rounded mb-2"></div>
                <div class="h-12 bg-slate-100 rounded-2xl"></div>
            </div>`).join('');

        let html = '';
        for (const f of fields) {
            const s = app.schema[f] || { type: 'text', label: f };
            const val = data ? (data[f] || '') : '';

            const isLocked = (String(s.disabled).toLowerCase() === 'true') || 
                             (s.formula && String(s.formula) !== "null") || 
                             (s.type === 'AUTOFILL');
            
            const lockClass = isLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-dashed opacity-75' : 'bg-slate-50 text-slate-700';

            html += `<div class="mb-4">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">
                    ${s.label} ${s.required ? '<span class="text-red-500">*</span>' : ''} 
                    ${isLocked ? '<i class="fa-solid fa-lock ml-1 text-slate-300"></i>' : ''}
                </label>`;

            if (s.type === 'lookup' && s.lookup) {
                html += `<select id="f-${f}" onchange="app.triggerLookup('${f}', this.value)" 
                    class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all ${lockClass}">
                    <option value="">-- Pilih --</option>
                </select>`;
            } else {
                const type = (s.type === 'number' || s.type === 'currency') ? 'number' : (s.type === 'date' ? 'date' : 'text');
                html += `<input id="f-${f}" type="${type}" value="${val}" ${isLocked ? 'disabled' : ''} oninput="app.runLiveFormula()" 
                    class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all ${lockClass}">`;
            }
            if (isLocked) html += `<input type="hidden" id="f-${f}-hidden" value="${val}">`;
            html += `</div>`;
        }
        container.innerHTML = html;

        // Populate & Trigger
        for (const f of fields) {
            const s = app.schema[f];
            if (s?.type === 'lookup' && s.lookup) {
                const currentVal = data ? data[f] : '';
                await app.populateLookup(f, s.lookup.table, s.lookup.field, currentVal);
                if (currentVal) await app.triggerLookup(f, currentVal);
            }
        }
        app.runLiveFormula();
    },

    async save(e) {
        if (e) e.preventDefault();
        if (app.isSubmitting) return;

        const btn = document.getElementById('btn-commit');
        const fields = app.editingId ? app.modes.edit.fields : app.modes.add.fields;
        const data = { rowId: app.editingId };

        fields.forEach(f => {
            const input = document.getElementById(`f-${f}`);
            const hidden = document.getElementById(`f-${f}-hidden`);
            if (hidden) data[f] = hidden.value;
            else if (input) data[f] = input.value;
        });

        app.isSubmitting = true;
        btn.innerText = "SAVING...";

        const res = await app.post(app.editingId ? 'update' : 'create', data);

        app.isSubmitting = false;
        btn.innerText = "COMMIT DATA";

        if (res.success) {
            this.closeForm();
            this.loadResource();
        } else {
            alert("Gagal menyimpan data!");
        }
    },

    closeForm() {
        document.getElementById('f-modal').classList.replace('flex', 'hidden');
    }
};