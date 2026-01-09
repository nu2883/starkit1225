Object.assign(window.app, {
  async selectResource(id) {
    this.resetViews();
    document.getElementById('view-crud').classList.remove('hidden');
    document.getElementById('search-container').classList.remove('hidden');
    document.getElementById('view-mode').classList.remove('hidden');
    document.getElementById(`db-${id}`)?.classList.add('sidebar-active');
    this.currentTable = id;
    document.getElementById('cur-title').innerText = id.replace(/_/g, ' ').toUpperCase();
    
    const cached = this.schemaCache[id];
    if (cached && this.resourceCache[id]) {
      this.schema = cached.schema;
      this.modes = cached.modes;
      this.applyPermissions();
      this.renderTable(this.resourceCache[id]);
      this.loadResource(); 
    } else {
      await this.loadResource();
    }
  },

  async loadResource(forceRefresh = false) {
    const btnRefresh = document.getElementById('btn-refresh');
    btnRefresh.classList.add('animate-spin');
    const d = await this.get({
      action: 'read',
      table: this.currentTable,
      viewMode: document.getElementById('view-mode').value
    });
    btnRefresh.classList.remove('animate-spin');
    if (d && d.success) {
      this.schema = d.schema;
      this.modes = d.modes;
      this.resourceCache[this.currentTable] = d.rows;
      this.rowsRaw = d.rows;
      this.applyPermissions();
      this.renderTable(d.rows);
    }
  },

  renderTable(rows) {
    const head = document.getElementById('t-head');
    const body = document.getElementById('t-body');
    const emptyState = document.getElementById('empty-state');
    if (!rows || rows.length === 0) {
      body.innerHTML = ''; head.innerHTML = ''; emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');
    const fields = this.modes.browse.fields || [];
    const canEdit = this.can('edit');
    const canDelete = this.can('delete');

    head.innerHTML = `<tr>${fields.map(f => `<th class="p-6 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">${this.schema[f]?.label || f}</th>`).join('')}${ (canEdit || canDelete) ? '<th class="p-6 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Actions</th>' : ''}</tr>`;
    
    body.innerHTML = rows.map(row => {
      const cells = fields.map(f => `<td class="p-6 font-medium text-slate-600 text-xs">${row[f] || '-'}</td>`).join('');
      const actions = `<td class="p-6 text-right space-x-1">
        ${canEdit ? `<button onclick='app.openForm(${JSON.stringify(row).replace(/'/g, "&apos;")})' class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">Edit</button>` : ''}
        ${canDelete ? `<button onclick="app.remove('${row.id}')" class="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all">Delete</button>` : ''}
      </td>`;
      return `<tr class="hover:bg-blue-50/40 border-b border-slate-100 transition-colors">${cells}${ (canEdit || canDelete) ? actions : ''}</tr>`;
    }).join('');
  },

  async openForm(data = null) {
    this.editingId = data ? data.id : null;
    document.getElementById('modal-title').innerText = this.editingId ? 'EDIT ENTRY' : 'NEW ENTRY';
    const fields = this.editingId ? this.modes.edit.fields : this.modes.add.fields;
    const container = document.getElementById('f-fields');
    document.getElementById('f-modal').classList.replace('hidden', 'flex');

    let html = '';
    for (const f of fields) {
      const s = this.schema[f] || { type: 'text', label: f };
      const val = data ? data[f] : '';
      const isLocked = (String(s.disabled).toLowerCase() === 'true') || s.formula || (s.type === 'AUTOFILL');
      const lockClass = isLocked ? 'bg-slate-100 cursor-not-allowed opacity-75' : 'bg-slate-50';

      html += `<div class="mb-4">
        <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">${s.label} ${isLocked ? '<i class="fa-solid fa-lock ml-1"></i>' : ''}</label>`;
      
      if (s.type === 'lookup') {
        html += `<select id="f-${f}" onchange="app.triggerLookup('${f}', this.value)" class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all ${lockClass}"><option value="">-- Pilih --</option></select>`;
      } else {
        const type = (s.type === 'number' || s.type === 'currency') ? 'number' : (s.type === 'date' ? 'date' : 'text');
        html += `<input id="f-${f}" type="${type}" value="${val}" ${isLocked ? 'disabled' : ''} oninput="app.runLiveFormula()" class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all ${lockClass}">`;
      }
      if (isLocked) html += `<input type="hidden" id="f-${f}-hidden" value="${val}">`;
      html += `</div>`;
    }
    container.innerHTML = html;
    
    for (const f of fields) {
      const s = this.schema[f];
      if (s?.type === 'lookup' && s.lookup) {
        const currentVal = data ? data[f] : '';
        await this.populateLookup(f, s.lookup.table, s.lookup.field, currentVal);
        if (currentVal) await this.triggerLookup(f, currentVal);
      }
    }
    this.runLiveFormula();
  },

  async populateLookup(fieldId, targetTable, targetField, selectedVal) {
    const res = this.resourceCache[targetTable] || [];
    const select = document.getElementById(`f-${fieldId}`);
    if (!select) return;
    const options = [...new Set(res.map(r => r[targetField]))].filter(Boolean);
    select.innerHTML = `<option value="">-- Pilih --</option>` + options.map(opt => `<option value="${opt}" ${opt == selectedVal ? 'selected' : ''}>${opt}</option>`).join('');
  },

  async triggerLookup(sourceField, value) {
    const tableSchema = this.schema;
    for (const f in tableSchema) {
      const s = tableSchema[f];
      if (s.type === 'AUTOFILL' && s.autofill && s.autofill.lookup_field === sourceField) {
        const targetTable = s.autofill.table;
        const targetData = this.resourceCache[targetTable]?.find(r => r[s.autofill.match_field] == value);
        const finalVal = targetData ? targetData[s.autofill.get_field] : '';
        const input = document.getElementById(`f-${f}`);
        const hidden = document.getElementById(`f-${f}-hidden`);
        if (input) input.value = finalVal;
        if (hidden) hidden.value = finalVal;
      }
    }
    this.runLiveFormula();
  },

  runLiveFormula() {
    const fields = this.editingId ? this.modes.edit.fields : this.modes.add.fields;
    let scope = {};
    fields.forEach(f => {
      const el = document.getElementById(`f-${f}`);
      const val = el ? el.value : '';
      scope[f] = isNaN(val) || val === '' ? val : parseFloat(val);
    });

    fields.forEach(f => {
      const s = this.schema[f];
      if (s && s.formula) {
        try {
          let formula = s.formula;
          for (const key in scope) {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            formula = formula.replace(regex, typeof scope[key] === 'string' ? `'${scope[key]}'` : scope[key]);
          }
          const result = new Function(`return ${formula}`)();
          const input = document.getElementById(`f-${f}`);
          const hidden = document.getElementById(`f-${f}-hidden`);
          if (input) input.value = result;
          if (hidden) hidden.value = result;
          scope[f] = result;
        } catch (e) {}
      }
    });
  },

  async save(e) {
    if (this.isSubmitting) return;
    const btn = document.getElementById('btn-commit');
    const fields = this.editingId ? this.modes.edit.fields : this.modes.add.fields;
    const data = { id: this.editingId };
    
    fields.forEach(f => {
      const hid = document.getElementById(`f-${f}-hidden`);
      const el = document.getElementById(`f-${f}`);
      data[f] = hid ? hid.value : (el ? el.value : '');
    });

    if (!this.editingId) {
      btn.disabled = true; btn.innerText = "⏳ PROSES SIMPAN..."; btn.classList.replace('bg-blue-600', 'bg-amber-500');
      this.post('create', data).then(res => { if (res.success) this.loadResource(); });
      setTimeout(() => {
        btn.innerText = "✅ BERHASIL!"; btn.classList.replace('bg-amber-500', 'bg-emerald-500');
        setTimeout(() => {
          btn.disabled = false; btn.innerText = "COMMIT DATA";
          btn.classList.remove('bg-emerald-500'); btn.classList.add('bg-blue-600');
        }, 500);
      }, 500);
      fields.forEach(f => {
        const el = document.getElementById(`f-${f}`);
        const s = this.schema[f];
        if (el && !s.formula && s.type !== 'AUTOFILL') el.value = '';
      });
    } else {
      this.isSubmitting = true; btn.innerText = "UPDATING...";
      const res = await this.post('update', data);
      if (res.success) { this.closeForm(); this.loadResource(); }
      this.isSubmitting = false; btn.innerText = "COMMIT DATA";
    }
  },

  async remove(id) {
    const mode = document.getElementById('view-mode').value;
    const msg = mode === 'trash' ? "Hapus Permanen?" : "Pindahkan ke Trash?";
    if (!confirm(msg)) return;
    const action = mode === 'trash' ? 'delete' : 'trash';
    const res = await this.post(action, { id });
    if (res.success) this.loadResource();
  },

  filterTable(val) {
    const filtered = this.rowsRaw.filter(r => JSON.stringify(r).toLowerCase().includes(val.toLowerCase()));
    this.renderTable(filtered);
  },

  applyPermissions() {
    const btnAdd = document.getElementById('btn-add');
    if (this.can('add')) { btnAdd.classList.remove('hidden'); btnAdd.style.display = 'flex'; }
    else { btnAdd.classList.add('hidden'); btnAdd.style.display = 'none'; }
  },

  can(action) {
    const rule = this.permMatrix?.find(r => String(r.resource).toLowerCase() === this.currentTable.toLowerCase() && String(r.role).toLowerCase() === this.role.toLowerCase());
    const map = { add: 'can_add', edit: 'can_edit', delete: 'can_delete', browse: 'can_browse' };
    return rule ? String(rule[map[action]]).toUpperCase() === 'TRUE' : false;
  },

  closeForm() { document.getElementById('f-modal').classList.replace('flex', 'hidden'); }
});