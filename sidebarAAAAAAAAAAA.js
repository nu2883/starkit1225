window.Sidebar = {
    daftarMenu: ['dashboard'],
    isCollapsed: false, // Untuk desktop (mini sidebar)
    isMobileOpen: false, // Untuk mobile (overlay)

    async init() {
        await this.loadScripts();
        this.render();
        this.open('dashboard');
    },

    async loadScripts() {
        const promises = this.daftarMenu.map(m => new Promise(res => {
            const s = document.createElement('script');
            s.src = `js/${m}.js`; s.onload = res; document.head.appendChild(s);
        }));
        return Promise.all(promises);
    },

    // KOMANDAN TOGGLE: Menangani Desktop (Mini) & Mobile (Slide)
    toggle() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            this.isMobileOpen = !this.isMobileOpen;
            sidebar.classList.toggle('-translate-x-full', !this.isMobileOpen);
            overlay.classList.toggle('hidden', !this.isMobileOpen);
        } else {
            this.isCollapsed = !this.isCollapsed;
            if (this.isCollapsed) {
                sidebar.classList.replace('w-72', 'w-20');
                document.querySelectorAll('.nav-text').forEach(t => t.classList.add('hidden'));
                document.getElementById('brand-full').classList.add('hidden');
                document.getElementById('brand-mini').classList.remove('hidden');
            } else {
                sidebar.classList.replace('w-20', 'w-72');
                document.querySelectorAll('.nav-text').forEach(t => t.classList.remove('hidden'));
                document.getElementById('brand-full').classList.remove('hidden');
                document.getElementById('brand-mini').classList.add('hidden');
            }
        }
    },

    render() {
    const menuHtml = this.daftarMenu.map(m => `
        <div id="nav-${m}" onclick="Sidebar.open('${m}')" 
             class="group flex items-center px-6 py-4 mx-2 mb-2 rounded-2xl cursor-pointer transition-all text-slate-400 hover:text-white hover:bg-indigo-600/20">
            <div class="w-6 h-6 flex-shrink-0 flex items-center justify-center font-bold text-xs bg-slate-800 rounded-lg group-hover:bg-indigo-500 transition-colors">${m[0].toUpperCase()}</div>
            <span class="nav-text ml-4 text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-opacity">${m}</span>
        </div>
    `).join('');

    document.getElementById('sidebar').innerHTML = `
        <div class="p-6 mb-6 flex items-center">
            <div id="brand-mini" class="hidden w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black italic">JS</div>
            <h2 id="brand-full" class="text-2xl font-black italic tracking-tighter text-white">JURAGAN.</h2>
        </div>

        <nav class="flex-none">${menuHtml}</nav>

        <div class="flex-1 overflow-y-auto no-scrollbar py-4">
            <p class="nav-text text-[10px] font-black uppercase tracking-[0.2em] px-8 py-2 opacity-40 text-white mt-2">Databases</p>
            <div id="resource-list" class="space-y-1">
                </div>
        </div>

        <div class="p-6 border-t border-slate-800 bg-slate-900">
            <div onclick="Auth.logout()" class="flex items-center justify-center md:justify-start cursor-pointer text-red-400 hover:text-red-500 transition-colors">
                <div class="w-6 h-6 flex items-center justify-center text-lg">👋</div>
                <span class="nav-text ml-4 text-[10px] font-bold uppercase tracking-widest">Logout</span>
            </div>
        </div>
    `;
},

    open(name) {
        const workerName = name.charAt(0).toUpperCase() + name.slice(1);
        this.daftarMenu.forEach(m => {
            const el = document.getElementById(`nav-${m}`);
            if(el) el.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg');
        });

        const activeEl = document.getElementById(`nav-${name}`);
        if(activeEl) activeEl.classList.add('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-500/20');

        document.getElementById('menu-title').innerText = name;
        if (window.innerWidth < 768 && this.isMobileOpen) this.toggle();
        
        document.getElementById('content').innerHTML = '';
        if(window[workerName]) window[workerName].render();
    }
};