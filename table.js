/**
 * TABLE MODULE - JURAGAN SAAS SHEET
 * Target: 1000 SA Users - Secure & Scalable CRUD
 */
Object.assign(app, {
renderTable(rows) {
    const head = document.getElementById('t-head');
    const body = document.getElementById('t-body');
    const emptyState = document.getElementById('empty-state');
    const btnAdd = document.getElementById('btn-add');
    const viewMode = document.getElementById('view-mode')?.value || 'active';

    // SINKRONISASI MODES (Fallback ke Log DEBUG Juragan: can_add, dll)
    const m = this.modes || {};
    const canAdd = (m.add?.can === true) || (m.can_add === true);
    const canEdit = (m.edit?.can === true) || (m.can_edit === true);
    const canDelete = (m.delete?.can === true) || (m.can_delete === true);

    if (btnAdd) {
      (viewMode === 'active' && canAdd) ? btnAdd.classList.replace('hidden', 'flex') : btnAdd.classList.replace('flex', 'hidden');
    }

    // --- 1. FIELD DETERMINATION (Anti 0, 1, 2, 3) ---
    let fields = [];
    
    // Jika schema ada dan berbentuk Object (bukan Array)
    if (this.schema && !Array.isArray(this.schema) && Object.keys(this.schema).length > 0) {
      fields = Object.keys(this.schema);
    } 
    // Jika schema tidak valid, ambil dari data baris pertama
    else if (rows && rows.length > 0) {
      fields = Object.keys(rows[0]);
    }

    // Filter final: buang angka dan kolom sistem
    fields = fields.filter(f => 
      isNaN(f) && !['id', 'is_deleted', 'deleted_at', 'salt', 'password', 'created_at', 'created_by'].includes(f)
    );

    if (!rows || rows.length === 0) {
      if (body) body.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    // --- 2. RENDER HEADER ---
    if (head) {
      head.innerHTML = `<tr>
        ${fields.map(f => {
          const label = (this.schema && this.schema[f]?.label) ? this.schema[f].label : f.replace(/_/g, ' ').toUpperCase();
          return `<th class="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">${label}</th>`;
        }).join('')}
        <th class="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
      </tr>`;
    }

    // --- 3. RENDER BODY ---
    if (body) {
      body.innerHTML = rows.map(row => {
        const rowStr = JSON.stringify(row).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        return `
          <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition-colors">
            ${fields.map(f => {
              let val = (row[f] === undefined || row[f] === null) ? '-' : row[f];
              if (f.toLowerCase().includes('harga') && val !== '-') {
                val = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
              }
              return `<td class="p-6 font-medium text-slate-600 text-sm">${val}</td>`;
            }).join('')}
            <td class="p-6 text-right space-x-2 whitespace-nowrap">
              ${canEdit ? `<button onclick="app.openForm(${rowStr})" class="p-2 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all"><i class="fa-solid fa-pen"></i></button>` : ''}
              ${(viewMode === 'active' && canDelete) ? `<button onclick="app.remove('${this.currentTable}', '${row.id}')" class="p-2 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"><i class="fa-solid fa-trash"></i></button>` : ''}
            </td>
          </tr>`;
      }).join('');
    }
  },

  async openForm(data = null) {
    this.editingId = data ? data.id : null;
    const modal = document.getElementById('f-modal');
    const container = document.getElementById('f-fields');
    if (!modal || !container) return;

    document.getElementById('modal-title').innerText = this.editingId ? `EDIT ${this.currentTable.toUpperCase()}` : `NEW ${this.currentTable.toUpperCase()}`;
    modal.classList.replace('hidden', 'flex');
    
    // --- AMBIL FIELD SECARA AMAN ---
    let fields = [];
    if (this.schema && !Array.isArray(this.schema) && Object.keys(this.schema).length > 0) {
      fields = Object.keys(this.schema);
    } else {
      const rows = this.resourceCache[this.currentTable] || [];
      fields = rows.length > 0 ? Object.keys(rows[0]) : (data ? Object.keys(data) : []);
    }

    fields = fields.filter(f => isNaN(f) && !['id', 'created_at', 'created_by', 'deleted_at', 'is_deleted', 'salt', 'password'].includes(f));

    if (fields.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400">No fields detected. Check your Sheet headers.</div>`;
      return;
    }

    let html = '';
    for (const f of fields) {
      // Pastikan s adalah object, jangan biarkan undefined
      const s = (this.schema && !Array.isArray(this.schema) && this.schema[f]) ? this.schema[f] : { type: 'TEXT', label: f.replace(/_/g, ' ').toUpperCase() };
      if (s.hidden) continue;

      const val = data ? (data[f] || '') : '';
      const isLocked = (String(s.disabled).toLowerCase() === 'true') || (s.type === 'AUTOFILL') || (s.type === 'FORMULA');
      const lockClass = isLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-dashed' : 'bg-slate-50 text-slate-700';

      html += `<div class="mb-4">
        <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">${s.label || f.replace(/_/g, ' ')}</label>`;

      if (s.type === 'LOOKUP' && s.lookup) {
        html += `<select id="f-${f}" name="${f}" onchange="app.triggerLookup('${f}', this.value)" class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none ${lockClass}"><option value="">-- PILIH --</option></select>`;
      } else {
        const inputType = (s.type === 'NUMBER' || s.type === 'CURRENCY') ? 'number' : (s.type === 'DATE' ? 'date' : 'text');
        html += `<input id="f-${f}" name="${f}" type="${inputType}" value="${val}" ${isLocked ? 'disabled' : ''} oninput="app.runLiveFormula()" class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none ${lockClass}">`;
      }
      if (isLocked) html += `<input type="hidden" id="f-${f}-hidden" name="${f}" value="${val}">`;
      html += `</div>`;
    }
    container.innerHTML = html;

    // Lookups & Formulas
    for (const f of fields) {
      const s = (this.schema && !Array.isArray(this.schema)) ? this.schema[f] : null;
      if (s?.type === 'LOOKUP') await this.populateLookup(f, s.lookup.table, s.lookup.field, data ? data[f] : '');
    }
    this.runLiveFormula();
  },

  async populateLookup(fieldId, table, fieldName, currentVal) {
    const select = document.getElementById(`f-${fieldId}`);
    if (!select) return;
    const list = this.resourceCache[table] || [];
    select.innerHTML = `<option value="">-- Pilih --</option>` + 
      list.map(item => `<option value="${item[fieldName]}" ${String(item[fieldName]) === String(currentVal) ? 'selected' : ''}>${item[fieldName]}</option>`).join('');
  },

  triggerLookup(sourceField, value) {
    if (!this.schema) return;
    Object.keys(this.schema).forEach(targetField => {
      const s = this.schema[targetField];
      if (s.type === 'AUTOFILL' && s.autoTrigger === sourceField) {
        const tableData = this.resourceCache[s.autoTable] || [];
        const match = tableData.find(item => String(item[this.schema[sourceField].lookup?.field || sourceField]) === String(value));
        const el = document.getElementById(`f-${targetField}`);
        const hiddenEl = document.getElementById(`f-${targetField}-hidden`);
        if (match && el) {
          const newVal = match[s.autoCol] || '';
          el.value = newVal;
          if (hiddenEl) hiddenEl.value = newVal;
        }
      }
    });
    this.runLiveFormula();
  },

runLiveFormula() {
    if (!this.schema) return;
    Object.keys(this.schema).forEach(f => {
      const s = this.schema[f];
      if (s.type === 'FORMULA' && s.formula) {
        try {
          const solved = s.formula.replace(/{(\w+)}/g, (m, key) => {
            // Ambil nilai dari input atau hidden input (untuk field yang di-lock)
            const el = document.getElementById(`f-${key}`) || document.getElementById(`f-${key}-hidden`);
            const val = parseFloat(el?.value) || 0;
            return val;
          });
          
          const result = new Function(`return ${solved}`)();
          const target = document.getElementById(`f-${f}`);
          const targetHidden = document.getElementById(`f-${f}-hidden`);
          
          if (target) target.value = result;
          if (targetHidden) targetHidden.value = result;
        } catch (e) {
          // Formula belum lengkap, abaikan error
        }
      }
    });
  },

  closeForm() {
    const modal = document.getElementById('f-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.editingId = null;
  },

  async remove(tableId, rowId) {
    if (!confirm('Hapus data ini?')) return;
    const titleEl = document.getElementById('cur-title');
    const originalTitle = titleEl ? titleEl.innerText : "SYSTEM READY";
    try {
      if (titleEl) titleEl.innerText = "DELETING...";
      const payload = {
        action: 'delete',
        table: tableId,
        token: this.token,
        sheet: localStorage.getItem('sk_sheet'),
        data: { id: rowId }
      };
      await fetch(DYNAMIC_ENGINE_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });
      setTimeout(async () => {
        await this.loadResource(true);
        if (titleEl) titleEl.innerText = originalTitle;
        alert("Berhasil dihapus!");
      }, 1000);
    } catch (err) {
      console.error("Remove Error:", err);
      alert("Gagal menghapus data.");
      if (titleEl) titleEl.innerText = originalTitle;
    }
  },
});