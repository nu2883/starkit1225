/**
 * TABLE MODULE - JURAGAN SAAS SHEET
 */
Object.assign(app, {
renderTable(rows) {
    const head = document.getElementById('t-head');
    const body = document.getElementById('t-body');
    const emptyState = document.getElementById('empty-state');
    const viewMode = document.getElementById('view-mode')?.value || 'active';

    // 1. DYNAMIC FIELDS FALLBACK
    // Jika BE tidak kirim modes.browse, kita ambil key dari data pertama sebagai kolom
    let fields = [];
    if (this.modes && this.modes.browse && this.modes.browse.fields) {
      fields = this.modes.browse.fields;
    } else if (rows && rows.length > 0) {
      // Ambil semua key kecuali ID dan is_deleted jika schema/modes kosong
      fields = Object.keys(rows[0]).filter(k => k !== 'id' && k !== 'is_deleted');
      console.warn("Using dynamic fields because modes.browse is missing.");
    }

    // 2. UI LOGIC: Jika data kosong total
    if (!rows || rows.length === 0) {
      if (body) body.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');

    // 3. RENDER HEADER
    if (head) {
      head.innerHTML = `<tr>
        ${fields.map(f => `
          <th class="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
            ${this.schema && this.schema[f] ? this.schema[f].label : f.replace(/_/g, ' ')}
          </th>`).join('')}
        <th class="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
      </tr>`;
    }

    // 4. RENDER BODY
    if (body) {
      body.innerHTML = rows.map(row => {
        const rowStr = JSON.stringify(row).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        
        return `
          <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition-colors">
            ${fields.map(f => {
              let val = (row[f] === undefined || row[f] === null) ? '-' : row[f];
              const s = this.schema ? this.schema[f] : null;

              if (s?.type === 'currency' && val !== '-') {
                val = new Intl.NumberFormat('id-ID', { 
                  style: 'currency', currency: 'IDR', minimumFractionDigits: 0 
                }).format(val);
              }
              return `<td class="p-6 font-medium text-slate-600 text-sm">${val}</td>`;
            }).join('')}
            
            <td class="p-6 text-right space-x-2 whitespace-nowrap">
              ${(this.modes?.edit?.can || !this.modes) ? 
                `<button onclick="app.openForm(${rowStr})" class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">
                  <i class="fa-solid fa-pen"></i>
                </button>` : ''}
              
          ${viewMode === 'active' && (this.modes?.delete?.can || !this.modes) ? 
  `<button 
     onclick="app.remove('${this.currentTable}', '${row.id}')"
     class="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all">
     <i class="fa-solid fa-trash"></i>
   </button>` 
: ''}
            </td>
          </tr>`;
      }).join('');
    }
    
  },

  async openForm(data = null) {
    this.editingId = data ? data.id : null;
    const modal = document.getElementById('f-modal');
    const container = document.getElementById('f-fields');
    const title = document.getElementById('modal-title');

    if (!modal || !container) return;

    // 1. UI Setup & Skeleton Loading
    this.editingId = data ? data.id : null;
    title.innerText = this.editingId ? `EDIT ${this.currentTable.toUpperCase()}` : `NEW ${this.currentTable.toUpperCase()}`;
    modal.classList.replace('hidden', 'flex');
    
    // Ambil fields berdasarkan permission (ADD/EDIT)
    const fields = (this.editingId ? this.modes?.edit?.fields : this.modes?.add?.fields) || Object.keys(this.schema);
    
    // Render Loading State
    container.innerHTML = fields.map(() => `
      <div class="mb-4 animate-pulse">
        <div class="h-3 w-20 bg-slate-200 rounded mb-2"></div>
        <div class="h-12 bg-slate-100 rounded-2xl"></div>
      </div>`).join('');

    // 2. Build Form Berdasarkan Metadata Baris Ke-2
    let html = '';
    for (const f of fields) {
      const s = this.schema[f] || { type: 'TEXT', label: f };
      if (['id', 'created_at', 'created_by', 'deleted_at'].includes(f) || s.hidden) continue;

      const val = data ? (data[f] || '') : '';
      
      // LOGIKA LOCKING: Lock jika disabled di sheet, tipe AUTOFILL, atau FORMULA
      const isLocked = (String(s.disabled).toLowerCase() === 'true') || 
                       (s.type === 'AUTOFILL') || 
                       (s.type === 'FORMULA') ||
                       (s.formula && String(s.formula) !== "null");
      
      const lockClass = isLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-dashed opacity-75' : 'bg-slate-50 text-slate-700';

      html += `<div class="mb-4">
        <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">
          ${s.label || f} ${s.required ? '<span class="text-red-500">*</span>' : ''}
          ${isLocked ? '<i class="fa-solid fa-lock ml-1 text-slate-300 text-[8px]"></i>' : ''}
        </label>`;

      // Render berdasarkan tipe (LOOKUP jadi SELECT, lainnya INPUT)
      if (s.type === 'LOOKUP' && s.lookup) {
        html += `<select id="f-${f}" name="${f}" onchange="app.triggerLookup('${f}', this.value)" 
                  class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all ${lockClass}">
                  <option value="">-- PILIH --</option>
                </select>`;
      } else {
        const inputType = (s.type === 'NUMBER' || s.type === 'CURRENCY') ? 'number' : (s.type === 'DATE' ? 'date' : 'text');
        html += `<input id="f-${f}" name="${f}" type="${inputType}" value="${val}" 
                  ${isLocked ? 'disabled' : ''} 
                  oninput="app.runLiveFormula()" 
                  class="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all ${lockClass}">`;
      }

      // Hidden input untuk menyimpan data yang ter-lock (agar tidak hilang saat POST)
      if (isLocked) html += `<input type="hidden" id="f-${f}-hidden" name="${f}" value="${val}">`;
      html += `</div>`;
    }
    container.innerHTML = html;

    // 3. Populate Data & Triggers (Async)
    for (const f of fields) {
      const s = this.schema[f];
      if (s?.type === 'LOOKUP' && s.lookup) {
        const currentVal = data ? data[f] : '';
        await this.populateLookup(f, s.lookup.table, s.lookup.field, currentVal);
        if (currentVal) await this.triggerLookup(f, currentVal);
      }
    }
    this.runLiveFormula();
  },

  // --- SUPPORTING ENGINES ---

  async populateLookup(fieldId, table, fieldName, currentVal) {
    const select = document.getElementById(`f-${fieldId}`);
    if (!select) return;
    const list = this.resourceCache[table] || [];
    select.innerHTML = `<option value="">-- Pilih --</option>` + 
      list.map(item => `<option value="${item[fieldName]}" ${item[fieldName] == currentVal ? 'selected' : ''}>${item[fieldName]}</option>`).join('');
  },

  triggerLookup(sourceField, value) {
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
    Object.keys(this.schema).forEach(f => {
      const s = this.schema[f];
      if (s.type === 'FORMULA' && s.formula) {
        try {
          const solved = s.formula.replace(/{(\w+)}/g, (m, key) => {
            const el = document.getElementById(`f-${key}`) || document.getElementById(`f-${key}-hidden`);
            return parseFloat(el?.value) || 0;
          });
          const result = new Function(`return ${solved}`)();
          const target = document.getElementById(`f-${f}`);
          const targetHidden = document.getElementById(`f-${f}-hidden`);
          if (target) target.value = result;
          if (targetHidden) targetHidden.value = result;
        } catch (e) {}
      }
    });
  },

  closeForm() {
    const modal = document.getElementById('f-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    this.editingId = null;
  },

async remove(tableId, rowId) {
  if (!confirm('Hapus data ini?')) return;

  const titleEl = document.getElementById('cur-title');
  const originalTitle = titleEl ? titleEl.innerText : "SYSTEM READY";

  try {
    if (titleEl) titleEl.innerText = "DELETING...";

    const payload = {
      action: 'delete',          // 🔥 INI KUNCINYA
      table: tableId,
      token: this.token,
      sheet: localStorage.getItem('sk_sheet'),
      data: {
        id: rowId                // 🔥 backend isi deleted_at sendiri
      }
    };

    console.log("DELETE PAYLOAD:", payload);

    await fetch(BASE_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(payload)
    });

    this.closeForm();
    await this.loadResource(true);

    alert("Berhasil dihapus!");
  } catch (err) {
    console.error("Remove Error:", err);
    alert("Gagal menghapus data.");
  } finally {
    if (titleEl) titleEl.innerText = originalTitle;
  }
},



});