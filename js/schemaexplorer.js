window.Schemaexplorer = {
async getTemplate() {
        const master = window.app;
        const allData = master.fullAppData || {};
        
        let html = `
        <div class="p-6 space-y-3"> <div class="flex flex-col gap-1 border-l-4 border-orange-500 pl-6 py-1 mb-4">
               <h2 class="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">System Architecture</h2>
               <p class="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">Operational Database Schema</p>
            </div>`;

        if (Object.keys(allData).length === 0) {
            html += `<div class="p-10 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <p class="font-black text-slate-400 uppercase tracking-widest text-[10px]">Belum ada tabel</p>
                     </div>`;
        }

        Object.entries(allData).forEach(([tableName, content]) => {
            const schema = content.schema || {};
            html += `
            <details class="group bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
                <summary class="list-none cursor-pointer px-6 py-3 bg-slate-50 border-b border-transparent group-open:border-slate-200 flex justify-between items-center hover:bg-slate-100/50 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center shadow-md group-open:bg-orange-600 transition-colors">
                            <i class="fa-solid fa-table-cells text-white text-xs"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-black text-slate-900 uppercase tracking-tight">${tableName}</h3>
                            <p class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                <span class="text-orange-500">${Object.keys(schema).length} Fields</span>
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3">
                       <button onclick="window.app.editSchemaShortcut('${tableName}')" 
    class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase transition-all active:scale-95">
    EDIT
</button>
                        <i class="fa-solid fa-chevron-down text-slate-300 text-[10px] group-open:rotate-180 transition-transform duration-300"></i>
                    </div>
                </summary>

                <div class="overflow-x-auto bg-white">
                    <table class="w-full text-left text-[11px] border-collapse">
                        <thead>
                            <tr class="text-[8px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-slate-50/50">
                                <th class="px-6 py-3">Field</th>
                                <th class="px-4 py-3 text-center w-16">View</th>
                                <th class="px-4 py-3 text-center w-16">Rules</th>
                                <th class="px-6 py-3">Logic</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            ${Object.entries(schema).map(([k, v]) => `
                                <tr class="group/row transition-all ${v.hidden ? 'bg-slate-50/30 opacity-60' : 'hover:bg-blue-50/20'}">
                                    <td class="px-6 py-2"> <div class="flex flex-col">
                                            <span class="text-[12px] font-bold text-slate-700 uppercase leading-tight">${k}</span>
                                            <span class="text-[8px] text-slate-400 font-medium">${v.type || 'TEXT'} • ${v.label || '-'}</span>
                                        </div>
                                    </td>
                                    <td class="px-4 py-2 text-center">
                                        <i class="fa-solid ${v.hidden ? 'fa-eye-slash text-slate-300' : 'fa-eye text-emerald-500'} text-[10px]"></i>
                                    </td>
                                    <td class="px-4 py-2">
                                        <div class="flex justify-center gap-1.5">
                                            <span title="Req" class="w-1.5 h-1.5 rounded-full ${v.required ? 'bg-blue-500' : 'bg-slate-200'}"></span>
                                            <span title="Lock" class="w-1.5 h-1.5 rounded-full ${v.disabled ? 'bg-orange-500' : 'bg-slate-200'}"></span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-2">
                                        ${this.badgeLogic(v)}
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </details>`;
        });
        return html + `</div>`;
    },
    badgeLogic(v) {
        let badges = [];
        if (v.lookup || v.type === 'LOOKUP') {
            const table = v.lookup?.table || v.relTable || 'table';
            const field = v.lookup?.field || v.relField || 'field';
            badges.push(`
                <div class="flex flex-col gap-1.5 bg-blue-50 p-3 rounded-2xl border border-blue-100 min-w-[150px]">
                    <span class="text-[9px] font-black text-blue-600 uppercase tracking-tighter flex items-center gap-2">
                        <i class="fa-solid fa-link text-[10px]"></i> Relational Lookup
                    </span>
                    <span class="text-[10px] font-bold text-blue-900 uppercase tracking-tighter bg-white/50 px-2 py-1 rounded border border-blue-200/50">
                        ${table} <i class="fa-solid fa-chevron-right text-[8px] mx-1 opacity-30"></i> ${field}
                    </span>
                </div>`);
        }

        if (v.type === 'AUTOFILL' || v.autoTrigger) {
            badges.push(`
                <div class="flex flex-col gap-2 bg-orange-50 p-3 rounded-2xl border border-orange-100 min-w-[180px]">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-bolt-lightning text-orange-500 text-[10px]"></i>
                        <span class="text-[9px] font-black text-orange-600 uppercase tracking-tighter">Auto-Injection Flow</span>
                    </div>
                    <div class="flex items-center gap-2 bg-white/50 p-1.5 rounded-lg border border-orange-200/50">
                        <span class="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[8px] font-black uppercase">${v.autoTrigger || 'trigger'}</span>
                        <i class="fa-solid fa-arrow-right-long text-orange-300 text-[10px]"></i>
                        <span class="text-[10px] font-bold text-orange-800 tracking-tight">${v.autoTable || 'table'}.${v.autoCol || 'col'}</span>
                    </div>
                </div>`);
        }

        if (v.type === 'FORMULA' || v.formula) {
            badges.push(`
                <div class="flex flex-col gap-1.5 bg-purple-50 p-3 rounded-2xl border border-purple-100 min-w-[150px]">
                    <span class="text-[9px] font-black text-purple-600 uppercase tracking-tighter flex items-center gap-2">
                        <i class="fa-solid fa-calculator text-[10px]"></i> Compute Engine
                    </span>
                    <code class="text-[11px] font-black text-purple-900 bg-white/50 px-2 py-1 rounded border border-purple-200/50">${v.formula}</code>
                </div>`);
        }

        return badges.length > 0
            ? `<div class="flex flex-wrap gap-2">${badges.join('')}</div>`
            : `<span class="text-slate-300 text-[9px] font-bold uppercase tracking-[0.2em] italic pl-2">Standard Data</span>`;
    }
};