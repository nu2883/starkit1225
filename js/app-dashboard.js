Object.assign(window.app, {
  async openDashboard() {
    this.resetViews();
    const titleEl = document.getElementById('cur-title');
    titleEl.innerText = "LOADING DATA...";
    document.getElementById('view-dashboard').classList.remove('hidden');
    document.getElementById('nav-dashboard').classList.add('sidebar-active');

    for (const conf of this.dashboardConfigs) {
      if (conf.table && (!this.resourceCache[conf.table] || this.resourceCache[conf.table].length === 0)) {
        this.currentTable = conf.table;
        await this.loadResource(true);
      }
    }
    titleEl.innerText = "DASHBOARD ANALYTICS";
    this.calculateAllWidgets();
    this.renderDashboard();
  },

  calculateAllWidgets() {
    this.widgetResults = this.dashboardConfigs.map(conf => {
      const data = this.resourceCache[conf.table] || [];
      if (conf.type === 'COUNT') return data.length;
      if (conf.type === 'SUM') return data.reduce((acc, row) => acc + (parseFloat(row[conf.column]) || 0), 0);
      return 0;
    });
  },

  renderDashboard() {
    const container = document.getElementById('dashboard-container');
    const colorMap = {
      blue: { grad: 'from-blue-500 to-blue-700', icon: 'bg-blue-400/30' },
      emerald: { grad: 'from-emerald-500 to-emerald-700', icon: 'bg-emerald-400/30' },
      slate: { grad: 'from-slate-800 to-slate-950', icon: 'bg-slate-700' }
    };

    container.innerHTML = this.dashboardConfigs.map((conf, index) => {
      const theme = colorMap[conf.color] || colorMap.slate;
      const val = this.widgetResults[index] || 0;
      return `
        <div class="relative group animate-fade-in">
          <div class="relative bg-gradient-to-br ${theme.grad} p-7 rounded-[2.5rem] shadow-2xl border border-white/10 min-h-[220px] flex flex-col justify-between text-white">
            <div class="flex justify-between items-start">
              <div class="${theme.icon} w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10">
                <i class="fa-solid ${conf.icon || 'fa-wallet'} text-xl"></i>
              </div>
              <span class="text-[9px] font-black uppercase opacity-80">${conf.unit || 'VAL'}</span>
            </div>
            <div class="mt-6">
              <h3 class="text-[10px] font-black tracking-widest opacity-60 uppercase">${conf.name}</h3>
              <span class="text-4xl font-black tracking-tighter">${val.toLocaleString('id-ID')}</span>
            </div>
            <div class="mt-4 flex items-center gap-2 opacity-40 text-[8px] font-bold uppercase">
              <div class="w-2 h-2 rounded-full bg-white animate-pulse"></div>${conf.type} ANALYSIS
            </div>
          </div>
        </div>`;
    }).join('');
  },

  async loadDashboardConfigs() {
    const res = await this.get({ action: 'read', table: 'config_dashboard' });
    if (res && res.success && res.rows.length > 0) {
      this.dashboardConfigs = JSON.parse(res.rows[0].config_json);
      localStorage.setItem('sk_dashboard_config', res.rows[0].config_json);
    }
  }
});