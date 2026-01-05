window.Appstudio = {
    // 1. Template Utama
    async getTemplate() {
        return `
        <div class="max-w-4xl mx-auto animate-fade-in pb-20">
            <div class="bg-white p-10 rounded-[3rem] border shadow-2xl border-slate-200">
                <div class="flex items-center justify-between mb-10">
                    <div>
                        <h3 class="text-3xl font-black text-slate-900 tracking-tighter">TABLE ARCHITECT</h3>
                        <p class="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Advanced Database Engineering</p>
                    </div>
                    <div class="px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl font-black text-[10px] border border-blue-100">MODULAR V1</div>
                </div>

                <div class="space-y-6">
                    <div class="p-8 bg-slate-900 rounded-[2.5rem] shadow-xl">
                        <label class="block text-[10px] font-black mb-3 text-slate-400 tracking-widest text-center uppercase">Identity Name</label>
                        <input id="st-table-name" type="text" placeholder="NAMA_TABEL_BARU"
                            class="w-full p-5 bg-slate-800 border-none rounded-2xl outline-none text-white font-black text-center text-xl placeholder:opacity-20 focus:ring-2 focus:ring-blue-500 transition-all uppercase">
                    </div>

                    <div id="st-fields-container" class="space-y-4"></div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                        <button onclick="Appstudio.studioAddField()"
                            class="py-5 border-4 border-dashed border-slate-100 rounded-[2rem] text-slate-300 font-black text-xs uppercase tracking-widest hover:border-blue-200 hover:text-blue-500 transition-all">
                            <i class="fa-solid fa-plus-circle mr-2"></i> Tambah Konfigurasi Kolom
                        </button>
                        
                        <button onclick="Appstudio.studioMigrate()" id="btn-migrate"
                            class="p-5 bg-blue-600 text-white rounded-[2rem] font-black shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                            <i class="fa-solid fa-dna"></i>
                            <span>GENERATE DATABASE</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <script>
             setTimeout(() => { 
                if(document.getElementById('st-fields-container').innerHTML.trim() === '') {
                    Appstudio.studioAddField();
                }
             }, 100);
        </script>
        `;
    },

    // 2. Fungsi Tambah Field
    studioAddField() {
        const id = Date.now();
        const html = `
          <div id="st-f-${id}" class="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4 mb-4 animate-fade-in relative group">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                <span class="text-[10px] font-black text-slate-400 tracking-widest uppercase">Konfigurasi Kolom</span>
              </div>
              <button onclick="this.parentElement.parentElement.remove()" class="text-slate-300 hover:text-red-500 transition-colors"><i class="fa-solid fa-circle-xmark text-lg"></i></button>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <input type="text" class="st-name w-full p-4 border-none rounded-2xl font-black text-sm shadow-sm" 
                     placeholder="ID Kolom (ex: harga_jual)" oninput="Appstudio.syncAutofillTrigger('${id}')">
              <select class="st-type w-full p-4 border-none rounded-2xl font-black text-sm shadow-sm" onchange="Appstudio.toggleStudioUI('${id}', this.value)">
                <option value="TEXT">TEXT</option>
                <option value="NUMBER">NUMBER</option>
                <option value="CURRENCY">CURRENCY (Rp)</option>
                <option value="DATE">DATE</option>
                <option value="LOOKUP">LOOKUP (RELASI)</option>
                <option value="AUTOFILL">AUTOFILL (OTOMATIS)</option>
                <option value="FORMULA">FORMULA</option>
              </select>
            </div>

            <div id="relasi-ui-${id}" class="hidden p-5 bg-blue-600 rounded-2xl grid grid-cols-2 gap-4 border border-blue-400 shadow-inner">
                <div>
                  <label class="block text-[9px] font-black mb-1 text-blue-200">TABEL SUMBER</label>
                  <select class="st-rel-table w-full p-3 border-none rounded-xl text-xs font-bold" onchange="Appstudio.populateStudioFields('${id}', this.value)"></select>
                </div>
                <div>
                  <label class="block text-[9px] font-black mb-1 text-blue-200">KOLOM KUNCI (LABEL)</label>
                  <select class="st-rel-field w-full p-3 border-none rounded-xl text-xs font-bold"><option value="">-- Pilih Kolom --</option></select>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[9px] font-black mb-1 text-slate-400 ml-2">LABEL TAMPILAN</label>
                <input type="text" class="st-label w-full p-4 border-none rounded-2xl text-sm font-bold shadow-sm" placeholder="Contoh: Harga Satuan">
              </div>
              <div>
                <label class="block text-[9px] font-black mb-1 text-slate-400 ml-2">FORMULA (OPSIONAL)</label>
                <input type="text" class="st-formula w-full p-4 border-none rounded-2xl text-sm font-bold shadow-sm" placeholder="Contoh: {qty}*{harga}">
              </div>
            </div>

            <div class="flex flex-wrap gap-6 pt-4 border-t border-slate-200">
              <label class="flex items-center gap-2 text-[10px] font-black cursor-pointer"><input type="checkbox" class="st-show w-4 h-4 rounded" checked> Tampil</label>
              <label class="flex items-center gap-2 text-[10px] font-black cursor-pointer"><input type="checkbox" class="st-req w-4 h-4 rounded"> Wajib</label>
              <label class="flex items-center gap-2 text-[10px] font-black cursor-pointer text-red-500"><input type="checkbox" class="st-disabled w-4 h-4 rounded"> Lock (Read-Only)</label>
            </div>
          </div>`;
        document.getElementById('st-fields-container').insertAdjacentHTML('beforeend', html);
        this.syncStudioOptions(id);
    },

    // 3. Handler UI Toggle
 toggleStudioUI(id, type) {
        const row = document.getElementById(`st-f-${id}`);
        const relUI = document.getElementById(`relasi-ui-${id}`);
        const lockCheck = row.querySelector('.st-disabled');
        
        // 1. Bersihkan UI Autofill lama jika ada
        const oldAuto = document.getElementById(`autofill-ui-${id}`);
        if (oldAuto) oldAuto.remove();

        // 2. RESET STATE AWAL
        relUI.classList.add('hidden');
        if (lockCheck) {
            lockCheck.disabled = false;
            lockCheck.parentElement.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        // 3. LOGIKA PROTEKSI KETAT
        if (type === 'AUTOFILL') {
            // PAKSA LOCK (Sistem yang isi)
            if (lockCheck) {
                lockCheck.checked = true;
                lockCheck.disabled = true; 
                lockCheck.parentElement.classList.add('opacity-50', 'cursor-not-allowed');
                lockCheck.parentElement.title = "Autofill wajib dikunci (Sistem)";
            }
            
            const html = `
                <div id="autofill-ui-${id}" class="p-4 bg-orange-50 rounded-xl grid grid-cols-3 gap-3 border border-orange-100 mt-2 animate-fade-in">
                    <div>
                        <label class="block text-[9px] font-black mb-1 text-orange-400 uppercase">Pemicu</label>
                        <select class="st-auto-trigger w-full p-2 border rounded-lg text-xs font-bold bg-white outline-none focus:ring-2 ring-orange-200"></select>
                    </div>
                    <div>
                        <label class="block text-[9px] font-black mb-1 text-orange-400 uppercase">Tabel Sumber</label>
                        <select class="st-auto-table w-full p-2 border rounded-lg text-xs font-bold bg-white outline-none" 
                                onchange="Appstudio.populateAutofillFields('${id}', this.value)"></select>
                    </div>
                    <div>
                        <label class="block text-[9px] font-black mb-1 text-orange-400 uppercase">Ambil Kolom</label>
                        <select class="st-auto-col w-full p-2 border rounded-lg text-xs font-bold bg-white outline-none">
                            <option value="">-- Pilih Kolom --</option>
                        </select>
                    </div>
                </div>`;
            relUI.insertAdjacentHTML('afterend', html);
            
            this.syncStudioOptions(id);
            this.syncAutofillTrigger(id);

        } else if (type === 'LOOKUP') {
            // PAKSA UNLOCK (User wajib pilih manual)
            if (lockCheck) {
                lockCheck.checked = false;
                lockCheck.disabled = true; // Matikan agar tidak bisa dicentang sengaja/tidak sengaja
                lockCheck.parentElement.classList.add('opacity-50', 'cursor-not-allowed');
                lockCheck.parentElement.title = "Lookup tidak boleh dikunci agar bisa dipilih";
            }
            relUI.classList.remove('hidden');
            this.syncStudioOptions(id);
        } else {
            // TIPE STANDAR: Berikan kebebasan pada Juragan
            if (lockCheck) {
                lockCheck.checked = false;
                lockCheck.disabled = false;
            }
        }
    },
    // 4. Sinkronisasi Dropdown Tabel
    syncStudioOptions(targetId = null) {
        const master = window.app || {};
        const resources = master.allResources || [];

        if (resources.length === 0) {
            console.warn("⚠️ Menunggu Resources Master...");
            setTimeout(() => this.syncStudioOptions(targetId), 1000);
            return;
        }

        const tableOpts = '<option value="">-- Pilih Tabel --</option>' +
            resources.map(r => `<option value="${r.id}">${r.id.toUpperCase()}</option>`).join('');

        const updateRow = (divId) => {
            const relT = document.querySelector(`#st-f-${divId} .st-rel-table`);
            if (relT) relT.innerHTML = tableOpts;
            const autoT = document.querySelector(`#autofill-ui-${divId} .st-auto-table`);
            if (autoT) autoT.innerHTML = tableOpts;
        };

        if (targetId) updateRow(targetId);
        else document.querySelectorAll('div[id^="st-f-"]').forEach(d => updateRow(d.id.replace('st-f-', '')));
    },

    // 5. Populate Kolom untuk LOOKUP
    async populateStudioFields(id, tableName) {
        const select = document.querySelector(`#st-f-${id} .st-rel-field`);
        if (!select || !tableName) return;

        const cachedData = window.app?.schemaCache?.[tableName];
        if (!cachedData || !cachedData.schema) {
            select.innerHTML = '<option value="">-- Schema Not Found --</option>';
            return;
        }

        const fieldKeys = Object.keys(cachedData.schema);
        select.innerHTML = '<option value="">-- Pilih Kolom --</option>' +
            fieldKeys.map(key => `<option value="${key}">${key}</option>`).join('');
    },

    // 6. Populate Kolom untuk AUTOFILL (Ini yang tadi macet)
    async populateAutofillFields(id, tableName) {
        const select = document.querySelector(`#autofill-ui-${id} .st-auto-col`);
        if (!select || !tableName) return;

        const cachedData = window.app?.schemaCache?.[tableName];
        if (!cachedData || !cachedData.schema) {
            select.innerHTML = '<option value="">-- Schema Not Found --</option>';
            return;
        }

        const fieldKeys = Object.keys(cachedData.schema);
        select.innerHTML = '<option value="">-- Pilih Kolom --</option>' +
            fieldKeys.map(key => `<option value="${key}">${key}</option>`).join('');
    },

    // 7. Sinkronisasi Trigger Autofill
    syncAutofillTrigger(id) {
    const triggerSelect = document.querySelector(`#autofill-ui-${id} .st-auto-trigger`);
    if (!triggerSelect) return;

    const currentFields = document.querySelectorAll('.st-name');
    let opts = '<option value="">-- Pilih Trigger --</option>';
    
    currentFields.forEach(input => {
        if (input.value) {
            // Bersihkan value agar sesuai dengan format ID Database (No Space, Lowercase)
            const cleanValue = input.value.toLowerCase().replace(/\s+/g, '');
            const displayLabel = input.value.toUpperCase();
            
            opts += `<option value="${cleanValue}">${displayLabel}</option>`;
        }
    });
    triggerSelect.innerHTML = opts;
},

    // 8. Migrate Function
    async studioMigrate() {
        const btn = document.getElementById('btn-migrate');
        const tableName = document.getElementById('st-table-name').value.trim();
        const fieldNodes = document.querySelectorAll('div[id^="st-f-"]');
        const fields = [];
        
        if (!tableName) return alert("❌ Nama Tabel Wajib Diisi!");
        if (fieldNodes.length === 0) return alert("❌ Tambahkan minimal satu kolom!");

        fieldNodes.forEach(n => {
            const colName = n.querySelector('.st-name').value.trim();
            const type = n.querySelector('.st-type').value;

            if (colName) {
                fields.push({
                    name: colName,
                    label: n.querySelector('.st-label').value || colName.toUpperCase().replace(/_/g, ' '),
                    type: type,
                    show: n.querySelector('.st-show').checked,
                    required: n.querySelector('.st-req').checked,
                    disabled: n.querySelector('.st-disabled').checked,
                    formula: n.querySelector('.st-formula').value || null,
                    // LOOKUP LOGIC
                    relTable: n.querySelector('.st-rel-table')?.value || '',
                    relField: n.querySelector('.st-rel-field')?.value || '',
                    // AUTOFILL LOGIC
                    autoTrigger: type === 'AUTOFILL' ? n.querySelector('.st-auto-trigger')?.value || '' : '',
                    autoTable: type === 'AUTOFILL' ? n.querySelector('.st-auto-table')?.value || '' : '',
                    autoCol: type === 'AUTOFILL' ? n.querySelector('.st-auto-col')?.value || '' : ''
                });
            }
        });

        btn.disabled = true;
        btn.innerText = "MIGRATING...";

        try {
            // Kita gunakan window.app.post karena fungsinya ada di Master Core (index.html)
            const res = await window.app.post('migrate', { tableName, fields });
            
            if (res.success) {
                alert("✅ Tabel '" + tableName + "' Berhasil Dilahirkan!");
                location.reload();
            } else {
                alert("❌ Gagal: " + res.message);
                btn.disabled = false;
                btn.innerText = "GENERATE DATABASE";
            }
        } catch (error) {
            console.error(error);
            alert("❌ Terjadi kesalahan koneksi.");
            btn.disabled = false;
            btn.innerText = "GENERATE DATABASE";
        }
    }
   
    
};