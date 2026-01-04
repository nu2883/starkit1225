window.Dashboardbuilder = {
    // 1. Template Kerangka Panggung
    async getTemplate() {
        return `
            <div id="view-dashboard-builder" class="p-8 animate-fade-in">
                <div class="flex justify-between items-center mb-10">
                    <div>
                        <h2 class="text-2xl font-black text-slate-800 tracking-tighter uppercase">Dashboard Builder</h2>
                        <p class="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Rakit analitik lintas tabel juragan</p>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="Dashboardbuilder.addWidget()" class="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:scale-105 transition-all shadow-lg shadow-slate-200">
                            <i class="fa-solid fa-plus mr-2"></i> Tambah Widget
                        </button>
                        <button onclick="app.saveDashboardConfig()" class="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase hover:scale-105 transition-all shadow-lg shadow-blue-200">
                            <i class="fa-solid fa-floppy-disk mr-2"></i> Simpan Konfigurasi
                        </button>
                    </div>
                </div>
                <div id="db-builder-container"></div>
            </div>
        `;
    },

async init() {
        const container = document.getElementById('db-builder-container');
        if (!container) return;

        // Tampilkan status loading selagi mengecek data
        container.innerHTML = `
            <div class="p-20 text-center animate-pulse">
                <i class="fa-solid fa-database text-slate-200 text-4xl mb-4"></i>
                <p class="text-slate-400 font-black uppercase tracking-widest text-[10px]">Memeriksa Data Database...</p>
            </div>`;

        try {
            // 1. Panggil fungsi load dari app.js
            if (window.app && typeof app.loadDashboardConfigs === 'function') {
                await app.loadDashboardConfigs();
            }

            // 2. CEK DATA: Jika app.dashboardConfigs masih undefined atau kosong
            if (!app.dashboardConfigs || app.dashboardConfigs.length === 0) {
                console.log("⚠️ Data belum ada di database.");
                
                // Tampilkan pesan bahwa data kosong, jangan panggil this.render() yang standar
                container.innerHTML = `
                    <div class="p-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                        <i class="fa-solid fa-folder-open text-slate-200 text-4xl mb-4"></i>
                        <p class="text-slate-400 font-black uppercase tracking-widest text-[10px]">Belum ada konfigurasi tersimpan, juragan.</p>
                        <p class="text-[9px] text-slate-300 mt-2 uppercase font-bold">Klik tombol "Tambah Widget" di atas untuk mulai rakit.</p>
                    </div>`;
                return; // BERHENTI DI SINI, jangan render widget
            }

            // 3. JIKA DATA ADA: Baru panggil render
            console.log("✅ Data ditemukan, memulai render...");
            this.render();

        } catch (err) {
            console.error("Gagal inisialisasi:", err);
            container.innerHTML = `<p class="text-red-500 text-center text-xs font-bold">ERROR: GAGAL MENGHUBUNGKAN KE DATABASE</p>`;
        }
    },

    render() {
        const container = document.getElementById('db-builder-container');
        if (!container) return;

        // JANGAN push otomatis di sini. 
        // Cek apakah data benar-benar kosong setelah loading selesai.
        if (!app.dashboardConfigs || app.dashboardConfigs.length === 0) {
            container.innerHTML = `
                <div class="p-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 animate-fade-in">
                    <div class="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4">
                        <i class="fa-solid fa-layer-group text-slate-300 text-2xl"></i>
                    </div>
                    <h3 class="text-slate-800 font-black uppercase tracking-tighter text-sm mb-1">Belum ada widget tersimpan</h3>
                    <p class="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Klik tombol "Tambah Widget" untuk mulai merakit dashboard juragan.</p>
                </div>`;
            return;
        }

        // Jika ada data, baru kita gambar list widgetnya
        container.innerHTML = app.dashboardConfigs.map((conf, index) => {
            const schema = app.schemaCache[conf.table]?.schema || {};
            const columnOptions = Object.keys(schema).map(col =>
                `<option value="${col}" ${conf.column === col ? 'selected' : ''}>${col.toUpperCase().replace(/_/g, ' ')}</option>`
            ).join('');

            if (!conf.vars) conf.vars = [];

            return `
            <div class="p-8 bg-white rounded-[3rem] border border-slate-200 mb-8 shadow-sm relative overflow-hidden animate-fade-in">
                <div class="flex justify-between items-center mb-8">
                    <div class="flex items-center gap-4 w-full">
                        <div class="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xs shadow-lg">${index + 1}</div>
                        <input type="text" value="${conf.name}" placeholder="Nama Widget..."
                            onchange="Dashboardbuilder.updateConfig(${index}, 'name', this.value)"
                            class="bg-transparent border-none font-black text-slate-800 text-lg outline-none w-2/3 uppercase tracking-tighter">
                    </div>
                    <button onclick="Dashboardbuilder.deleteWidget(${index})" class="text-red-300 hover:text-red-500 transition-all p-2">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div>
                        <label class="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Metode Hitung</label>
                        <select onchange="Dashboardbuilder.updateConfig(${index}, 'type', this.value)" 
                            class="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-purple-500/20">
                            <option value="COUNT" ${conf.type === 'COUNT' ? 'selected' : ''}>COUNT (Hitung Baris)</option>
                            <option value="SUM" ${conf.type === 'SUM' ? 'selected' : ''}>SUM (Total Angka)</option>
                            <option value="FORMULA" ${conf.type === 'FORMULA' ? 'selected' : ''}>FORMULA (Variabel)</option>
                            <option value="URGENCY" ${conf.type === 'URGENCY' ? 'selected' : ''}>URGENCY (Stok Kritis)</option>
                        </select>
                    </div>

                    ${conf.type !== 'FORMULA' ? `
                        <div>
                            <label class="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Sumber Tabel</label>
                            <select onchange="Dashboardbuilder.updateTable(${index}, this.value)" 
                                class="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-purple-500/20 text-blue-600">
                                <option value="">-- Pilih Tabel --</option>
                                ${app.allResources.map(r => `<option value="${r.id}" ${conf.table === r.id ? 'selected' : ''}>${r.id.toUpperCase()}</option>`).join('')}
                            </select>
                        </div>
                        <div class="${conf.type === 'COUNT' ? 'opacity-30 pointer-events-none' : ''}">
                            <label class="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Kolom Target</label>
                            <select onchange="Dashboardbuilder.updateConfig(${index}, 'column', this.value)" 
                                class="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-purple-500/20">
                                <option value="">-- Pilih Kolom --</option>
                                ${columnOptions}
                            </select>
                        </div>
                    ` : `
                        <div class="md:col-span-2 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center">
                            <p class="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
                                <i class="fa-solid fa-circle-info mr-2"></i> Mode Formula Aktif: Kelola variabel di panel bawah.
                            </p>
                        </div>
                    `}
                </div>

                ${conf.type === 'FORMULA' ? this.renderFormulaSection(conf, index) : ''}

                <div class="pt-8 border-t border-slate-50 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label class="block text-[8px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Visual Icon</label>
                        <select onchange="Dashboardbuilder.updateConfig(${index}, 'icon', this.value)" 
                            class="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold outline-none">
                            <option value="fa-wallet" ${conf.icon === 'fa-wallet' ? 'selected' : ''}>💰 Keuangan</option>
                            <option value="fa-cart-shopping" ${conf.icon === 'fa-cart-shopping' ? 'selected' : ''}>🛒 Penjualan</option>
                            <option value="fa-users" ${conf.icon === 'fa-users' ? 'selected' : ''}>👥 Pelanggan</option>
                            <option value="fa-box-archive" ${conf.icon === 'fa-box-archive' ? 'selected' : ''}>📦 Stok</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[8px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Tema Warna</label>
                        <select onchange="Dashboardbuilder.updateConfig(${index}, 'color', this.value)" 
                            class="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold outline-none">
                            <option value="slate" ${conf.color === 'slate' ? 'selected' : ''}>🌑 Slate</option>
                            <option value="blue" ${conf.color === 'blue' ? 'selected' : ''}>🔷 Blue</option>
                            <option value="emerald" ${conf.color === 'emerald' ? 'selected' : ''}>🟢 Emerald</option>
                            <option value="rose" ${conf.color === 'rose' ? 'selected' : ''}>🔴 Rose</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[8px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Satuan Unit</label>
                        <input type="text" value="${conf.unit || 'Rp'}" onchange="Dashboardbuilder.updateConfig(${index}, 'unit', this.value)"
                            class="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold text-center outline-none">
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    // Sub-render untuk Formula agar kode tidak terlalu panjang
    renderFormulaSection(conf, index) {
        return `
            <div class="mb-8 p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 animate-slide-up">
                <div class="flex justify-between items-center mb-6">
                    <h5 class="text-[10px] font-black text-blue-500 uppercase tracking-widest">Kalkulasi Lintas Tabel</h5>
                    <button onclick="Dashboardbuilder.addVar(${index})" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-slate-900 transition-all shadow-md">+ Tambah Variabel</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    ${conf.vars.map((v, vIdx) => `
                        <div class="bg-white p-4 rounded-2xl border border-blue-100 relative group shadow-sm">
                            <div class="flex gap-2 mb-2">
                                <input type="text" value="${v.code}" onchange="Dashboardbuilder.updateVar(${index}, ${vIdx}, 'code', this.value)" class="w-10 p-2 bg-slate-100 rounded-lg font-black text-[10px] text-center uppercase outline-none">
                                <select onchange="Dashboardbuilder.updateVar(${index}, ${vIdx}, 'table', this.value)" class="flex-1 p-2 bg-slate-50 border-none rounded-lg text-[9px] font-bold outline-none text-blue-600">
                                    <option value="">Pilih Tabel...</option>
                                    ${app.allResources.map(r => `<option value="${r.id}" ${v.table === r.id ? 'selected' : ''}>${r.id.toUpperCase()}</option>`).join('')}
                                </select>
                            </div>
                            <select onchange="Dashboardbuilder.updateVar(${index}, ${vIdx}, 'col', this.value)" class="w-full p-2 bg-slate-50 border-none rounded-lg text-[9px] font-bold outline-none">
                                <option value="">Pilih Kolom...</option>
                                ${Object.keys(app.schemaCache[v.table]?.schema || {}).map(c => `<option value="${c}" ${v.col === c ? 'selected' : ''}>${c.toUpperCase()}</option>`).join('')}
                            </select>
                            <button onclick="Dashboardbuilder.removeVar(${index}, ${vIdx})" class="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    `).join('')}
                </div>
                <div>
                    <label class="block text-[9px] font-black text-blue-400 uppercase mb-2 ml-1 tracking-widest">Rumus Matematika</label>
                    <input type="text" value="${conf.formula || ''}" placeholder="Contoh: ({A} - {B}) / {A} * 100" onchange="Dashboardbuilder.updateConfig(${index}, 'formula', this.value)" class="w-full p-5 bg-white border-2 border-blue-200 rounded-2xl font-mono text-sm font-black text-blue-700 shadow-inner outline-none">
                </div>
            </div>`;
    },


    // Logika Helper
    updateConfig(index, key, val) {
        app.dashboardConfigs[index][key] = val;
        if (key === 'type') this.render();
    },
    updateTable(index, val) {
        app.dashboardConfigs[index].table = val;
        app.dashboardConfigs[index].column = '';
        this.render();
    },
    addWidget() {
        app.dashboardConfigs.push({ name: 'Widget Baru', table: '', type: 'COUNT', column: '', vars: [], formula: '', color: 'slate', unit: 'Rp', icon: 'fa-wallet' });
        this.render();
    },
    deleteWidget(index) {
        if (confirm("Hapus widget ini, juragan?")) {
            app.dashboardConfigs.splice(index, 1);
            this.render();
        }
    },
    addVar(wIdx) {
        const nextCode = String.fromCharCode(65 + app.dashboardConfigs[wIdx].vars.length);
        app.dashboardConfigs[wIdx].vars.push({ code: nextCode, table: '', col: '' });
        this.render();
    },
    updateVar(wIdx, vIdx, key, val) {
        app.dashboardConfigs[wIdx].vars[vIdx][key] = val;
        if (key === 'table') this.render();
    },
    removeVar(wIdx, vIdx) {
        app.dashboardConfigs[wIdx].vars.splice(vIdx, 1);
        this.render();
    }
};