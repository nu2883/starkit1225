window.Sidebar = {
    // 1. Pindahkan Meta ke properti objek agar mudah di-maintenance
    menuConfigs: {
        'appstudio': { icon: 'fa-wand-magic-sparkles', color: 'text-blue-400', label: 'APP STUDIO' },
        'schemaexplorer': { icon: 'fa-database', color: 'text-orange-400', label: 'SCHEMA EXPLORER' },
        'dashboardbuilder': { icon: 'fa-chart-pie', color: 'text-purple-400', label: 'DASHBOARD BUILDER' },
        'automation': { icon: 'fa-bolt-lightning', color: 'text-yellow-400', label: 'AUTOMATION' },
        'accesscontrol': { icon: 'fa-solid fa-shield-halved', color: 'text-red-500', label: 'ACCESS CONTROL' 
    }
    },

    // Daftar menu aktif (Urutan tampilan)
    daftarMenu: ['appstudio', 'schemaexplorer', 'dashboardbuilder', 'automation', 'accesscontrol'], 

    async init() {
        // Render shell sidebar dulu agar user bisa melihat menu
        this.render();
        // Baru load script di background agar tidak blocking
        await this.loadScripts();
    },

    async loadScripts() {
        const promises = this.daftarMenu.map(m => new Promise(res => {
            const scriptSrc = `js/${m}.js`;
            // Cek apakah script sudah ada (mencegah duplikasi tag script)
            if (document.querySelector(`script[src="${scriptSrc}"]`)) return res();
            
            const s = document.createElement('script');
            s.src = scriptSrc; 
            s.async = true;
            s.onload = () => { console.log(`✅ Loaded: ${m}.js`); res(); }; 
            s.onerror = () => { console.error(`❌ Gagal load: ${m}.js`); res(); };
            document.head.appendChild(s);
        }));
        return Promise.all(promises);
    },

    render() {
        const container = document.getElementById('sidebar-container-new');
        if (!container) return;
        
        const menuHtml = this.daftarMenu.map(m => {
            const conf = this.menuConfigs[m] || { icon: 'fa-shapes', color: 'text-slate-400', label: m.toUpperCase() };
            
            return `
                <button onclick="Sidebar.open('${m}', 'nav-${m}', '${conf.label}')" 
                    id="nav-${m}"
                    class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-left group">
                    <i class="fa-solid ${conf.icon} ${conf.color} group-hover:scale-110 transition-transform w-5 text-center"></i>
                    <span class="truncate">${conf.label}</span>
                </button>
            `;
        }).join('');

        container.innerHTML = `<div class="mt-4 border-t border-white/5 pt-4 space-y-1">${menuHtml}</div>`;
    },

    async open(moduleName, navId, title) {
        // Nama class/object modul (camelCase to PascalCase)
        const workerName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
        
        // 1. Update Title di Header
        const titleElement = document.getElementById('cur-title');
        if (titleElement) titleElement.innerText = title;

        // 2. Navigasi UI: Highlight Active State
        document.querySelectorAll('.nav-item, aside button').forEach(b => {
            b.classList.remove('bg-blue-600', 'text-white', 'bg-white/10');
            b.classList.add('text-slate-400');
        });

        const activeBtn = document.getElementById(navId);
        if (activeBtn) {
            activeBtn.classList.remove('text-slate-400');
            activeBtn.classList.add('bg-blue-600', 'text-white');
        }

        // 3. Loading State di Stage
        this.renderToStage(`
            <div class="flex flex-col items-center justify-center h-64 opacity-50 animate-pulse">
                <i class="fa-solid fa-spinner animate-spin text-3xl text-blue-600 mb-2"></i>
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Deploying ${title}...</p>
            </div>
        `);

        // 4. Lifecycle Modul
        try {
            // Pastikan modul sudah ter-load di window
            if (!window[workerName]) {
                throw new Error(`Modul ${workerName} tidak ditemukan di window object.`);
            }

            const module = window[workerName];

            // A. Ambil Template
            if (typeof module.getTemplate !== 'function') {
                throw new Error(`Modul ${workerName} tidak memiliki fungsi getTemplate()`);
            }
            const template = await module.getTemplate();
            
            // B. Masukkan ke Stage
            this.renderToStage(template);

            // C. Jalankan Init (Life-cycle)
            if (typeof module.init === 'function') {
                console.log(`🚀 Initializing ${workerName}...`);
                await module.init();
            }

        } catch (error) {
            console.error(`❌ Error switching to ${workerName}:`, error);
            this.renderToStage(`
                <div class="p-20 text-center bg-red-50 rounded-[2rem] border border-red-100 mx-6 mt-6">
                    <i class="fa-solid fa-triangle-exclamation text-red-400 text-3xl mb-4"></i>
                    <h3 class="text-sm font-black text-red-600 uppercase">Module Error</h3>
                    <p class="text-[10px] text-red-400 font-bold uppercase mt-1">${error.message}</p>
                </div>
            `);
        }
    },

    // renderToStage(htmlContent) {
    //     const stage = document.getElementById('scroll-area');
    //     if (stage) stage.innerHTML = `<div class="animate-fade-in">${htmlContent}</div>`;
    // }

    renderToStage(htmlContent) {
    const stage = document.getElementById('scroll-area');
    if (!stage) return;
    
    // Sembunyikan view standar dulu agar tidak tumpang tindih
    document.getElementById('view-crud').classList.add('hidden');
    document.getElementById('view-dashboard').classList.add('hidden');
    
    // Buat atau cari kontainer khusus konten dinamis agar tidak merusak yang lain
    let dynamicLayer = document.getElementById('dynamic-layer');
    if (!dynamicLayer) {
        dynamicLayer = document.createElement('div');
        dynamicLayer.id = 'dynamic-layer';
        stage.appendChild(dynamicLayer);
    }
    
    dynamicLayer.innerHTML = `<div class="animate-fade-in">${htmlContent}</div>`;
    dynamicLayer.classList.remove('hidden');
},


};