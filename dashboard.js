const Dashboard = {
    async open() {
        app.resetViews();
        document.getElementById('cur-title').innerText = "LOADING DATA...";
        document.getElementById('view-dashboard')?.classList.remove('hidden');

        // Tarik data untuk widget jika belum ada
        for (const conf of app.dashboardConfigs) {
            if (conf.table && !app.resourceCache[conf.table]) {
                app.currentTable = conf.table;
                await CRUD.loadResource();
            }
        }
        
        document.getElementById('cur-title').innerText = "DASHBOARD ANALYTICS";
        this.render();
    },

    render() {
        const container = document.getElementById('dashboard-container');
        if (!container) return;

        container.innerHTML = app.dashboardConfigs.map((conf, index) => {
            const data = app.resourceCache[conf.table] || [];
            const value = conf.type === 'SUM' 
                ? data.reduce((a, b) => a + (parseFloat(b[conf.column]) || 0), 0)
                : data.length;

            return `
                <div class="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${conf.name}</p>
                    <h2 class="text-3xl font-black text-slate-900 mt-2">${value.toLocaleString('id-ID')}</h2>
                </div>
            `;
        }).join('');
    }
};