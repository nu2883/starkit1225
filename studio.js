/**
 * ============================================================
 * STUDIO MODULE - JURAGAN SAAS SHEET
 * ============================================================
 * Version: 10.1 (Explicit Lookup Intent Edition)
 * Target: 1000 SA Users (Secure & Scalable)
 * Features: Reference Mode for Lookup, Autofill Sync, Schema Migration.
 * Principles: Explicit Intent, Secure by Design, Zero-Side-Channel.
 * ============================================================
 */

Object.assign(app, {
  // --- NAVIGATION ---
  openAppStudio() {
    this.resetViews();
    this.currentTable = 'APP_STUDIO';
    this.currentView = 'studio';

    document.getElementById('view-crud')?.classList.add('hidden');
    document.getElementById('view-schema-explorer')?.classList.add('hidden');
    document.getElementById('search-container')?.classList.add('hidden');
    document.getElementById('view-app-studio')?.classList.remove('hidden');

    const titleEl = document.getElementById('cur-title');
    if (titleEl) titleEl.innerText = "APP STUDIO";

    document.querySelectorAll('.nav-btn, #nav-app-studio, #nav-schema-explorer').forEach(b => {
      b.classList.remove('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');
      b.classList.add('text-slate-400');
    });

    const navBtn = document.getElementById('nav-app-studio');
    if (navBtn) navBtn.classList.add('bg-blue-600', 'text-white', 'shadow-lg', 'sidebar-active');

    const fieldContainer = document.getElementById('st-fields-container');
    if (fieldContainer) fieldContainer.innerHTML = '';
    this.studioAddField();
  },

  // --- UI DYNAMICS ---
  toggleStudioUI(id, type) {
    const row = document.getElementById(`st-f-${id}`);
    const relUI = document.getElementById(`relasi-ui-${id}`);
    const lockCheckbox = row.querySelector('.st-disabled');

    const oldAuto = document.getElementById(`autofill-ui-${id}`);
    if (oldAuto) oldAuto.remove();

    relUI.classList.add('hidden');

    // Logic: Autofill & Formula wajib Locked/Disabled secara default
    if (type === 'AUTOFILL' || type === 'FORMULA') {
      if (lockCheckbox) lockCheckbox.checked = true;
    }

    if (type === 'LOOKUP') {
      relUI.classList.remove('hidden');
      this.syncStudioOptions(id); 
    } else if (type === 'AUTOFILL') {
      const html = `
            <div id="autofill-ui-${id}" class="p-4 bg-orange-50 rounded-xl grid grid-cols-3 gap-3 border border-orange-100 mt-2 animate-fade-in">
              <div>
                <label class="block text-[9px] font-black mb-1 text-orange-400">Pemicu (Dropdown)</label>
                <select class="st-auto-trigger w-full p-2 border rounded-lg text-xs font-bold bg-white focus:ring-2 ring-orange-200 outline-none">
                  <option value="">-- Pilih Trigger --</option>
                </select>
              </div>
              <div>
                <label class="block text-[9px] font-black mb-1 text-orange-400">Tabel Sumber</label>
                <select class="st-auto-table w-full p-2 border rounded-lg text-xs font-bold bg-white focus:ring-2 ring-orange-200 outline-none" 
                        onchange="app.populateAutofillFields('${id}', this.value)">
                  <option value="">-- Pilih Tabel --</option>
                </select>
              </div>
              <div>
                <label class="block text-[9px] font-black mb-1 text-orange-400">Ambil Kolom</label>
                <select class="st-auto-col w-full p-2 border rounded-lg text-xs font-bold bg-white focus:ring-2 ring-orange-200 outline-none">
                  <option value="">-- Pilih Kolom --</option>
                </select>
              </div>
            </div>`;
      relUI.insertAdjacentHTML('afterend', html);
      this.syncAutofillOptions(id);
    }
  },

  // Fungsi untuk sinkronisasi ID ke Label & Validasi DB Rule
  handleIdInput(id, rawValue) {
    const row = document.getElementById(`st-f-${id}`);
    if (!row) return;

    const nameInput = row.querySelector('.st-name');
    const labelInput = row.querySelector('.st-label');

    // 1. Validasi Aturan DB (Hanya boleh huruf, angka, dan underscore)
    const dbFriendlyRegex = /^[a-z0-9_]*$/;
    
    if (!dbFriendlyRegex.test(rawValue)) {
      alert("Aturan DB: Gunakan huruf kecil, angka, atau underscore saja (tanpa spasi/simbol)!");
      // Bersihkan karakter terlarang secara otomatis
      nameInput.value = rawValue.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      return;
    }

    // 2. Otomatis isi Label Tampilan (Manusiawi)
    // Contoh: "harga_satuan" jadi "Harga Satuan"
    const humanLabel = rawValue
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    labelInput.value = humanLabel;

    // 3. Jalankan sync bawaan studio
    this.syncStudioOptions(id);
  },

studioAddField() {
    const id = Date.now();
    const html = `
      <div id="st-f-${id}" class="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4 mb-4 animate-fade-in">
        <div class="flex justify-between items-center">
          <span class="text-[10px] font-black text-blue-600 tracking-widest uppercase">Konfigurasi Kolom</span>
          <button onclick="this.parentElement.parentElement.remove()" class="text-red-400 hover:text-red-600 transition-all">
            <i class="fa-solid fa-circle-xmark fa-lg"></i>
          </button>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[9px] font-black mb-1 text-slate-400">ID KOLOM (SNAKE_CASE)</label>
            <input type="text" 
                   class="st-name w-full p-3 border rounded-xl font-bold text-sm focus:ring-2 ring-blue-100 outline-none" 
                   placeholder="ex: harga_satuan" 
                   oninput="app.handleIdInput('${id}', this.value)">
          </div>
          <div>
            <label class="block text-[9px] font-black mb-1 text-slate-400">TIPE DATA</label>
            <select class="st-type w-full p-3 border rounded-xl font-bold text-sm bg-white" onchange="app.toggleStudioUI('${id}', this.value)">
              <option value="TEXT">TEXT</option>
              <option value="NUMBER">NUMBER</option>
              <option value="CURRENCY">CURRENCY (Rp)</option>
              <option value="DATE">DATE</option>
              <option value="LOOKUP">LOOKUP (RELASI)</option>
              <option value="AUTOFILL">AUTOFILL (OTOMATIS)</option>
              <option value="FORMULA">FORMULA</option>
            </select>
          </div>
        </div>

        <div id="relasi-ui-${id}" class="hidden p-4 bg-blue-50 rounded-xl grid grid-cols-2 gap-4 border border-blue-100">
            <div>
              <label class="block text-[9px] font-black mb-1 text-blue-400">TABEL SUMBER</label>
              <select class="st-rel-table w-full p-2 border rounded-lg text-xs font-bold bg-white" onchange="app.populateStudioFields('${id}', this.value)">
                <option value="" disabled selected>-- Pilih Tabel --</option>
              </select>
            </div>
            <div>
              <label class="block text-[9px] font-black mb-1 text-blue-400">KOLOM KUNCI (LABEL)</label>
              <select class="st-rel-field w-full p-2 border rounded-lg text-xs font-bold bg-white">
                <option value="" disabled selected>-- Pilih Kolom --</option>
              </select>
            </div>
            <div class="col-span-2 pt-2 border-t border-blue-200">
              <label class="flex items-center gap-2 text-[9px] font-black cursor-pointer text-indigo-600">
                <input type="checkbox" class="st-lookup-ref w-4 h-4 rounded shadow-sm" checked>
                <span class="uppercase">Lookup sebagai Referensi (Read-Only)</span>
              </label>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[9px] font-black mb-1 text-slate-400">LABEL TAMPILAN</label>
            <input type="text" class="st-label w-full p-3 border rounded-xl text-sm font-bold bg-white" placeholder="Contoh: Harga Satuan">
          </div>
          <div>
            <label class="block text-[9px] font-black mb-1 text-slate-400">FORMULA / REFERENCE</label>
            <input type="text" class="st-formula w-full p-3 border rounded-xl text-sm font-bold bg-white" placeholder="Contoh: {qty}*{harga}">
          </div>
        </div>

        <div class="flex flex-wrap gap-6 pt-4 border-t border-slate-200">
          <label class="flex items-center gap-2 text-[9px] font-black cursor-pointer group">
            <input type="checkbox" class="st-show w-4 h-4 rounded shadow-sm" checked> 
            <span class="group-hover:text-blue-600 transition-colors uppercase">Tampil</span>
          </label>
          <label class="flex items-center gap-2 text-[9px] font-black cursor-pointer group">
            <input type="checkbox" class="st-req w-4 h-4 rounded shadow-sm"> 
            <span class="group-hover:text-blue-600 transition-colors uppercase">Wajib</span>
          </label>
          <label class="flex items-center gap-2 text-[9px] font-black cursor-pointer group text-red-500">
            <input type="checkbox" class="st-disabled w-4 h-4 rounded shadow-sm"> 
            <span class="group-hover:text-red-700 transition-colors uppercase font-bold">Lock (Read-Only)</span>
          </label>
        </div>
      </div>`;
      
    document.getElementById('st-fields-container').insertAdjacentHTML('beforeend', html);
    this.syncStudioOptions(id);
  },

  syncAutofillOptions(id) {
    const row = document.getElementById(`st-f-${id}`);
    if (!row) return;

    const triggerSelect = row.querySelector('.st-auto-trigger');
    const tableSelect = row.querySelector('.st-auto-table');

    if (triggerSelect) {
      const currentVal = triggerSelect.value;
      const currentFields = Array.from(document.querySelectorAll('.st-name'))
        .map(input => input.value.replace(/\s+/g, '').toLowerCase()) 
        .filter(v => v !== "");

      triggerSelect.innerHTML = '<option value="">-- Pilih Trigger --</option>' +
        currentFields.map(f => `<option value="${f}">${f.toUpperCase()}</option>`).join('');
      triggerSelect.value = currentVal;
    }

    if (tableSelect) { 
      const resources = this.resources || this.allResources || [];
      const currentVal = tableSelect.value;
      tableSelect.innerHTML = '<option value="">-- Pilih Tabel --</option>' +
        resources.map(r => `<option value="${r.id}">${r.name || r.id}</option>`).join('');
      tableSelect.value = currentVal;
    }
  },

async studioMigrate() {
  const btn = document.getElementById('btn-migrate');
  const tableName = document.getElementById('st-table-name').value;
  const fieldNodes = document.querySelectorAll('div[id^="st-f-"]');
  const fields = [];

  if (!tableName) {
    alert("Nama Tabel Wajib!");
    return;
  }

  let validationError = false;

  fieldNodes.forEach(n => {
    const rawName = n.querySelector('.st-name').value;
    const colName = rawName.replace(/\s+/g, '').toLowerCase();
    const type = n.querySelector('.st-type').value;

    // === LOOKUP ===
    const rTable = n.querySelector('.st-rel-table')?.value || null;
    const rField = n.querySelector('.st-rel-field')?.value || null;
    const lookupModeCheckbox = n.querySelector('.st-lookup-ref');

    // === AUTOFILL (FORCE SYNC) ===
    if (type === 'AUTOFILL') {
      // 🔥 INI KUNCI: PAKSA FE SYNC VALUE SEBELUM DIBACA
      this.syncAutofillOptions(n.id.replace('st-f-', ''));
    }

    const autoTrigger = type === 'AUTOFILL'
      ? n.querySelector('.st-auto-trigger')?.value || null
      : null;

    const autoTable = type === 'AUTOFILL'
      ? n.querySelector('.st-auto-table')?.value || null
      : null;

    const autoCol = type === 'AUTOFILL'
      ? n.querySelector('.st-auto-col')?.value || null
      : null;

    // === VALIDATION ===
    if (type === 'LOOKUP' && (!rTable || !rField)) {
      alert(`Kolom "${colName}" LOOKUP belum lengkap!`);
      validationError = true;
    }

    if (type === 'AUTOFILL' && (!autoTrigger || !autoTable || !autoCol)) {
      alert(`Kolom "${colName}" AUTOFILL belum lengkap!`);
      console.error("AUTOFILL INVALID:", { colName, autoTrigger, autoTable, autoCol });
      validationError = true;
    }

    // === PUSH FIELD (INTENT-DRIVEN) ===
    fields.push({
      name: colName,
      label: n.querySelector('.st-label').value || colName.toUpperCase().replace(/_/g, ' '),
      type,
      show: n.querySelector('.st-show').checked,
      required: n.querySelector('.st-req').checked,
      disabled: n.querySelector('.st-disabled').checked,
      formula: n.querySelector('.st-formula')?.value || null,

      lookup: (type === 'LOOKUP') ? {
        table: rTable,
        field: rField,
        mode: lookupModeCheckbox?.checked ? 'reference' : 'browse'
      } : null,

      autoTrigger,
      autoTable,
      autoCol
    });
  });

  if (validationError) return;

  btn.innerText = "MIGRATING...";
  btn.disabled = true;

  try {
    const response = await fetch(DYNAMIC_ENGINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'migrate',
        token: this.token || localStorage.getItem('sk_token'),
        sheet: localStorage.getItem('sk_sheet'),
        ua: navigator.userAgent,
        data: { tableName, fields }
      })
    });

    const res = await response.json();
    if (!res.success) throw new Error(res.message);

    alert(`🚀 Sukses! Tabel "${tableName}" berhasil dibuat.`);
    setTimeout(() => location.reload(), 800);

  } catch (err) {
    alert("Gagal: " + err.message);
    btn.innerText = "🚀 BIRTH NEW TABLE";
    btn.disabled = false;
  }
}
,

  syncStudioOptions(id) {
    const resources = this.resources || this.allResources || [];
    
    if (id) {
      const relSelect = document.querySelector(`#st-f-${id} .st-rel-table`);
      if (relSelect) {
        const currentVal = relSelect.value;
        relSelect.innerHTML = '<option value="" disabled selected>-- Pilih Tabel --</option>' +
          resources.map(r => `<option value="${r.id}">${r.name || r.id}</option>`).join('');
        if(currentVal) relSelect.value = currentVal;
      }
    }

    const triggers = document.querySelectorAll('.st-auto-trigger');
    triggers.forEach(sel => {
        const parentRow = sel.closest('div[id^="st-f-"]');
        if (parentRow) {
          const currentId = parentRow.id.replace('st-f-', '');
          this.syncAutofillOptions(currentId);
        }
    });
  }
});