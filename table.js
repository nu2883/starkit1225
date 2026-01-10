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
                `<button onclick="app.remove('${row.id}')" class="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all">
                  <i class="fa-solid fa-trash"></i>
                </button>` : ''}
            </td>
          </tr>`;
      }).join('');
    }
  },


});