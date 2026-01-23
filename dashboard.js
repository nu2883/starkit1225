/**
 * ============================================================
 * DASHBOARD MODULE - JURAGAN SAAS SHEET
 * ============================================================
 * Version: 10.7 (Sultan UI & Persistence Edition)
 * Principles: Data Integrity, Premium UX, Local Persistence.
 * ============================================================
 */

Object.assign(app, {
  // dashboardConfigs: Array untuk edit di Builder
  // dashboardConfig: Array aktif untuk render Dashboard utama

  /**
   * 1. SAVE TO LOCAL STORAGE & SYNC
   */
/**
 * ============================================================
 * DASHBOARD LOCAL STORAGE PERSISTENCE
 * ============================================================
 */

/**
 * 1️⃣ SAVE DASHBOARD CONFIG
 */
async saveDashboardConfig() {
  const btn = document.getElementById("btn-commit"); // ⬅️ SAMA
  if (!btn) {
    alert("❌ Tombol commit tidak ditemukan di DOM");
    return;
  }

  if (!this.dashboardConfigs || this.dashboardConfigs.length === 0) {
    alert("⚠️ Dashboard masih kosong, Juragan!");
    return;
  }

  const payload = {
    id: this.editingDashboardId || "SK-" + Date.now(),
    created_by: this.currentUser?.email || "SYSTEM",
    config_json: JSON.stringify(this.dashboardConfigs),
    updated_at: new Date().toISOString()
  };

  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerText = "DEPLOYING...";
  btn.classList.add("opacity-50", "cursor-not-allowed");

  try {
    const res = await this.post({
      action: this.editingDashboardId ? "update" : "create",
      table: "config_dashboard",
      data: payload
    });

    if (!res.success) {
      throw new Error(res.message || "Unknown Error");
    }

    // 🔐 BACKUP LOCAL (HYBRID)
    localStorage.setItem("sk_dashboard_backup", payload.config_json);

    btn.innerText = "🚀 DEPLOYED!";
    setTimeout(() => {
      btn.disabled = false;
      btn.innerText = originalText;
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    }, 800);

  } catch (err) {
    alert("❌ Deployment Failed: " + err.message);
    btn.disabled = false;
    btn.innerText = originalText;
    btn.classList.remove("opacity-50", "cursor-not-allowed");
  }
},


/**
 * 2️⃣ LOAD DASHBOARD CONFIG (ROLE AWARE + FORENSIC LOG)
 */
/**
 * =====================================================
 * 📊 LOAD DASHBOARD CONFIG (HYBRID + ROLE AWARE)
 * Source of Truth : BACKEND
 * Cache           : LocalStorage
 * =====================================================
 */
async loadDashboardConfig() {
  let finalConfig = [];
  const role = localStorage.getItem("sk_role") || "guest";

  console.group("📊 [DASHBOARD] LOAD CONFIG");
  console.log("👤 Active Role:", role);

  /* =====================================================
   * 1️⃣ LOAD DARI LOCAL STORAGE (FAST FALLBACK)
   * ===================================================== */
  try {
    const localRaw = localStorage.getItem("sk_dashboard_backup");
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed)) {
        finalConfig = parsed;
        console.log("💾 [LOCAL] Loaded:", parsed.length, "widgets");
      } else {
        console.warn("⚠️ [LOCAL] Invalid format, ignored:", parsed);
      }
    } else {
      console.log("ℹ️ [LOCAL] No local backup found");
    }
  } catch (err) {
    console.warn("🔥 [LOCAL] Corrupted LocalStorage, cleared", err);
    localStorage.removeItem("sk_dashboard_backup");
  }

  /* =====================================================
   * 2️⃣ LOAD DARI BACKEND (AUTHORITATIVE)
   * ===================================================== */
  try {
    console.log("☁️ [DB] Requesting load_dashboard...");

    const res = await this.post({
      action: "load_dashboard"
    });

    if (res?.success && Array.isArray(res.data)) {
      finalConfig = res.data;

      // 🔁 Sync ke LocalStorage
      localStorage.setItem(
        "sk_dashboard_backup",
        JSON.stringify(res.data)
      );

      console.log(
        "☁️ [DB] Loaded:",
        res.data.length,
        "widgets & synced to LocalStorage"
      );
    } else {
      console.warn("⚠️ [DB] Invalid response, fallback to local:", res);
    }
  } catch (err) {
    console.error(
      "🔥 [DB] load_dashboard failed, fallback to local",
      err
    );
  }

  /* =====================================================
   * 3️⃣ FINAL GUARD
   * ===================================================== */
  if (!Array.isArray(finalConfig)) {
    console.warn("⚠️ [FINAL] Config invalid, reset");
    finalConfig = [];
  }

  /* =====================================================
   * 4️⃣ ROLE FILTERING (UX FILTER – BE SUDAH FILTER)
   * ===================================================== */
  console.group("🔐 [ROLE FILTER]");
  const beforeCount = finalConfig.length;

  finalConfig = finalConfig.filter((conf, idx) => {
    const ar = conf.allowed_role;
    let allowed = false;

    if (!ar || ar === "all") {
      allowed = true;
    } else if (ar === role) {
      allowed = true;
    }

    console.log(
      `#${idx + 1}`,
      conf.name || "(unnamed)",
      "| allowed_role =", ar,
      "| role =", role,
      "=>",
      allowed ? "✅ SHOWN" : "❌ HIDDEN"
    );

    return allowed;
  });

  console.log(
    `📉 Filtered: ${beforeCount} → ${finalConfig.length}`
  );
  console.groupEnd();

  /* =====================================================
   * 5️⃣ STATE INJECTION
   * ===================================================== */
  this.dashboardConfig  = [...finalConfig];
  this.dashboardConfigs = [...finalConfig];

  console.log(
    "✅ [DASHBOARD] Final widgets injected:",
    finalConfig.length
  );
  console.groupEnd();

   this.openDashboard();

  return finalConfig;
}
,


  /**
   * 2. LOAD CONFIG (Mencegah Data Hilang saat Refresh)
   * Fungsi ini harus dipanggil di script.js pada bagian init()
   */

  /**
   * 3. RENDER DASHBOARD (Dengan Sinkronisasi Data Riil)
   */
renderDashboard: function () {
  const container = document.getElementById("dashboard-container");
  if (!container) return;

  /* =====================================================
   * 1️⃣ RESOLVE USER ROLE (LS → MEMORY → FALLBACK)
   * ===================================================== */
  const userRole =
    (this.currentUser && this.currentUser.role) ||
    localStorage.getItem("sk_role") ||
    "guest";

  console.group("📊 [DASHBOARD] RENDER");
  console.log("👤 User Role:", userRole);
  console.log("🔐 Permissions:", this.permissions);

  const colorMap = {
    slate: {
      bg: "bg-slate-900",
      glow: "shadow-slate-500/20",
      grad: "from-slate-800 to-slate-950",
      txt: "text-slate-100",
      icon: "bg-slate-700 text-slate-300",
    },
    blue: {
      bg: "bg-blue-600",
      glow: "shadow-blue-500/40",
      grad: "from-blue-500 to-blue-700",
      txt: "text-white",
      icon: "bg-blue-400/30 text-blue-100",
    },
    emerald: {
      bg: "bg-emerald-600",
      glow: "shadow-emerald-500/40",
      grad: "from-emerald-500 to-emerald-700",
      txt: "text-white",
      icon: "bg-emerald-400/30 text-emerald-100",
    },
    rose: {
      bg: "bg-rose-600",
      glow: "shadow-rose-500/40",
      grad: "from-rose-500 to-rose-700",
      txt: "text-white",
      icon: "bg-rose-400/30 text-rose-100",
    },
    amber: {
      bg: "bg-amber-500",
      glow: "shadow-amber-500/40",
      grad: "from-amber-400 to-amber-600",
      txt: "text-white",
      icon: "bg-amber-300/30 text-amber-100",
    },
    violet: {
      bg: "bg-violet-600",
      glow: "shadow-violet-500/40",
      grad: "from-violet-500 to-violet-700",
      txt: "text-white",
      icon: "bg-violet-400/30 text-violet-100",
    },
    cyan: {
      bg: "bg-cyan-500",
      glow: "shadow-cyan-500/40",
      grad: "from-cyan-400 to-cyan-600",
      txt: "text-white",
      icon: "bg-cyan-300/30 text-cyan-100",
    },
    fuchsia: {
      bg: "bg-fuchsia-600",
      glow: "shadow-fuchsia-500/40",
      grad: "from-fuchsia-500 to-fuchsia-700",
      txt: "text-white",
      icon: "bg-fuchsia-400/30 text-fuchsia-100",
    },
  };

  /* =====================================================
   * 2️⃣ FILTER DASHBOARD (ROLE + TABLE PERMISSION)
   * ===================================================== */
  const configs = (this.dashboardConfig || []).filter((conf, idx) => {
    /* ---------- ROLE CHECK ---------- */
    if (conf.allowed_role && conf.allowed_role !== "all") {
      const allowedRoles = String(conf.allowed_role)
        .split(",")
        .map(r => r.trim().toLowerCase());

      if (!allowedRoles.includes(userRole.toLowerCase())) {
        console.warn(
          `⛔ [${idx + 1}] HIDDEN (ROLE)`,
          conf.name,
          "| allowed:",
          conf.allowed_role,
          "| user:",
          userRole
        );
        return false;
      }
    }

    /* ---------- PERMISSION CHECK ---------- */
    const perm = this.permissions?.[conf.table];

    if (!perm || perm.browse !== true) {
      console.warn(
        `⛔ [${idx + 1}] HIDDEN (PERMISSION)`,
        conf.name,
        "| table:",
        conf.table,
        "| perm:",
        perm
      );
      return false;
    }

    console.log(
      `✅ [${idx + 1}] SHOWN`,
      conf.name,
      "| table:",
      conf.table
    );
    return true;
  });

  /* =====================================================
   * 3️⃣ EMPTY STATE + ONE-TIME RETRY
   * ===================================================== */
  if (configs.length === 0) {

    // 🔁 Retry 1x setelah 2 detik (khusus race condition)
    if (!this._dashboardRetryOnce) {
      this._dashboardRetryOnce = true;

      console.warn(
        "⏳ [DASHBOARD] Tidak ada widget lolos filter. Retry 1x dari LocalStorage dalam 2 detik..."
      );

      setTimeout(() => {
        try {
          const cached = localStorage.getItem("sk_dashboard_backup");
          if (cached) {
            const parsed = JSON.parse(cached);

            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(
                "♻️ [DASHBOARD] Reloaded dashboard config from LocalStorage:",
                parsed.length
              );
              this.dashboardConfig = parsed;
              this.renderDashboard();
              return;
            }
          }
          console.warn("⚠️ [DASHBOARD] LocalStorage kosong / invalid saat retry.");
        } catch (err) {
          console.error("❌ [DASHBOARD] Gagal parse LocalStorage:", err);
        }
      }, 2000);

      console.groupEnd();
      return;
    }

    // 🧱 Final empty state (tidak retry lagi)
    container.innerHTML = `
      <div class="col-span-full p-20 text-center bg-slate-50 rounded-[3rem]
        border-2 border-dashed border-slate-200">
        <i class="fa-solid fa-shapes text-4xl text-slate-200 mb-4"></i>
        <p class="text-slate-400 font-black uppercase tracking-widest text-[10px]">
          Tidak ada widget yang diizinkan untuk role ini.
        </p>
      </div>`;
    console.groupEnd();
    return;
  }

  /* =====================================================
   * 4️⃣ RENDER WIDGET
   * ===================================================== */
  container.innerHTML = configs
    .map((conf) => {
      const theme = colorMap[conf.color] || colorMap.slate;
      const tableData = this.resourceCache[conf.table] || [];

      let calculatedValue = 0;

      if (conf.type === "SUM") {
        calculatedValue = tableData.reduce(
          (acc, row) => acc + (parseFloat(row[conf.column]) || 0),
          0
        );
      } else if (conf.type === "COUNT") {
        calculatedValue = tableData.length;
      } else if (conf.type === "AVG" && tableData.length > 0) {
        const sum = tableData.reduce(
          (acc, row) => acc + (parseFloat(row[conf.column]) || 0),
          0
        );
        calculatedValue = sum / tableData.length;
      }

      const displayValue = calculatedValue.toLocaleString("id-ID");

      return `
      <div class="relative group animate-fade-in">
        <div class="absolute inset-0 ${theme.bg}
          rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40
          transition-all duration-700"></div>

        <div class="relative bg-gradient-to-br ${theme.grad}
          p-7 rounded-[2.5rem] ${theme.glow}
          shadow-2xl border border-white/10 overflow-hidden
          min-h-[220px] flex flex-col justify-between">

          <div class="flex justify-between items-start">
            <div class="${theme.icon}
              w-12 h-12 rounded-2xl flex items-center justify-center">
              <i class="fa-solid ${conf.icon || "fa-wallet"}"></i>
            </div>
            <span class="text-[9px] ${theme.txt} opacity-60 uppercase">
              ${conf.unit || "DATA"}
            </span>
          </div>

          <div>
            <h3 class="text-[10px] ${theme.txt} opacity-60 uppercase">
              ${conf.name || "Untitled"}
            </h3>
            <span class="text-4xl font-black ${theme.txt}">
              ${displayValue}
            </span>
          </div>
        </div>
      </div>`;
    })
    .join("");

  console.log("✅ [DASHBOARD] Rendered widgets:", configs.length);
  console.groupEnd();
},


  /**
   * 2. SYNC TO CLOUD (Engine GAS)
   * Gunakan fungsi ini jika Juragan ingin mempermanenkan data ke Google Sheets.
   */
  async syncDashboardToCloud() {
    try {
      showLoading(true);

      // Ambil baris yang sudah ada untuk mendapatkan ID unik (mencegah duplikasi)
      const resRead = await this.get({
        action: "read",
        table: "config_dashboard",
      });

      // Filter untuk membuang baris Label/Header
      const dataRows = (resRead.rows || []).filter(
        (r) =>
          typeof r.config_json === "string" && r.config_json.startsWith("[")
      );

      const existingRow = dataRows.length > 0 ? dataRows[0] : null;
      const actionToDo = existingRow ? "update" : "create";
      const targetId = existingRow ? existingRow.id : "DASH_MAIN_01";

      const payload = {
        action: actionToDo,
        table: "config_dashboard",
        data: {
          id: targetId,
          config_json: JSON.stringify(this.dashboardConfigs),
          updated_at: new Date().toISOString(),
        },
      };

      console.log(`📡 [CLOUD] Action: ${actionToDo} | ID: ${targetId}`);
      const res = await this.post(payload);

      if (res.success) {
        alert("🚀 Sinkronisasi Cloud Berhasil! Data aman di Google Sheets.");
      }
    } catch (e) {
      console.error("🔥 Cloud Sync Gagal:", e);
      alert("Gagal sinkron ke cloud. Cek koneksi.");
    } finally {
      showLoading(false);
    }
  },

  /**
   * 3. OPEN DASHBOARD
   */
  openDashboard() {
    this.resetViews();
    this.currentTable = "DASHBOARD";
    this.currentView = "dashboard";

    document.getElementById("view-crud")?.classList.add("hidden");
    document.getElementById("view-app-studio")?.classList.add("hidden");
    document.getElementById("view-schema-explorer")?.classList.add("hidden");
    document.getElementById("search-container")?.classList.add("hidden");

    const dashboardView = document.getElementById("view-dashboard");
    if (dashboardView) dashboardView.classList.remove("hidden");

    const titleEl = document.getElementById("cur-title");
    if (titleEl) titleEl.innerText = "DASHBOARD ANALYTICS";

    // Visual Navigation
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.remove("sidebar-active", "bg-blue-600", "text-white");
      b.classList.add("text-slate-400");
    });
    document.getElementById("nav-dashboard")?.classList.add("sidebar-active");

    this.renderDashboard();
  },

  /**
   * 4. LOAD CONFIG (Hybrid: Cache + LocalStorage Backup)
   */
  /**
   * LOAD CONFIG (Hybrid: Cache + LocalStorage Backup)
   * Memastikan data 'sk_dashboard_backup' ditarik ke memori saat aplikasi start.
   */

  /**
   * 5. RENDER DASHBOARD (Apple-Style UI)
   */

  /**
   * 6. BUILDER FUNCTIONS
   */
  openDashboardBuilder() {
    this.resetViews();
    this.currentView = "dashboard-builder";
    this.syncSidebarUI("dashboard-builder");
    document
      .getElementById("view-dashboard-builder")
      ?.classList.remove("hidden");
    this.renderDashboardBuilder();
  },

  addDashboardWidgetConfig() {
    // Gunakan array dashboardConfigs untuk proses edit
    if (!this.dashboardConfigs) this.dashboardConfigs = [];
    this.dashboardConfigs.push({
      name: "Widget Baru",
      table: "",
      type: "COUNT",
      column: "",
      color: "blue",
      icon: "fa-solid fa-chart-line",
    });
    this.renderDashboardBuilder();
  },


renderDashboardBuilder: function () {
    const container = document.getElementById("db-builder-container");
    if (!container) return;

    // Ambil data roles dari cache untuk dropdown
    const availableRoles = this.resourceCache.roles || [];

    // Starter jika kosong
    if (this.dashboardConfigs.length === 0) {
      this.dashboardConfigs.push({
        name: "",
        table: "",
        type: "COUNT",
        column: "",
        vars: [],
        formula: "",
        color: "slate",
        unit: "Rp",
        icon: "fa-wallet",
        allowed_role: "all" // Default semua role bisa lihat
      });
    }

    container.innerHTML = this.dashboardConfigs
      .map((conf, index) => {
        // 1. Persiapan Data (Cache & Safety)
        const schema = this.schemaCache[conf.table]?.schema || {};
        const columnOptions = Object.keys(schema)
          .map(
            (col) =>
              `<option value="${col}" ${
                conf.column === col ? "selected" : ""
              }>${col.toUpperCase().replace(/_/g, " ")}</option>`
          )
          .join("");

        if (!conf.vars) conf.vars = [];

        return `
      <div class="p-8 bg-white rounded-[3rem] border border-slate-200 mb-8 shadow-sm relative overflow-hidden animate-fade-in">
        
        <div class="flex justify-between items-center mb-8">
          <div class="flex items-center gap-4 w-full">
            <div class="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xs shadow-lg">${
              index + 1
            }</div>
            <input type="text" value="${
              conf.name
            }" placeholder="Nama Widget (Contoh: Sisa Stok)"
              onchange="app.updateWidgetConfig(${index}, 'name', this.value)"
              class="bg-transparent border-none font-black text-slate-800 text-lg outline-none w-2/3 uppercase tracking-tighter">
          </div>
          <button onclick="app.deleteWidgetConfig(${index})" class="text-red-300 hover:text-red-500 transition-all p-2">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div>
            <label class="block text-[9px] font-black text-indigo-500 uppercase mb-2 ml-2 tracking-widest">
              <i class="fa-solid fa-shield-halved mr-1"></i> Izin Akses Role
            </label>
            <select onchange="app.updateWidgetConfig(${index}, 'allowed_role', this.value)" 
              class="w-full p-4 bg-indigo-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-indigo-500/20 text-indigo-700">
              <option value="all" ${conf.allowed_role === 'all' ? 'selected' : 'all'}>🌍 SEMUA ROLE</option>
              ${availableRoles.map(r => {
                const rName = r.role_name || r.name;
                return `<option value="${rName}" ${conf.allowed_role === rName ? 'selected' : ''}>🔐 ${rName.toUpperCase()}</option>`;
              }).join("")}
            </select>
          </div>

          <div>
            <label class="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Metode Hitung</label>
            <select onchange="app.updateWidgetConfig(${index}, 'type', this.value); app.renderDashboardBuilder();" 
              class="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-purple-500/20">
              <option value="COUNT" ${
                conf.type === "COUNT" ? "selected" : ""
              }>COUNT (Hitung Baris)</option>
              <option value="SUM" ${
                conf.type === "SUM" ? "selected" : ""
              }>SUM (Total Angka)</option>
              <option value="FORMULA" ${
                conf.type === "FORMULA" ? "selected" : ""
              }>FORMULA (Variabel)</option>
              <option value="URGENCY" ${
                conf.type === "URGENCY" ? "selected" : ""
              }>URGENCY (Stok Kritis)</option>
            </select>
          </div>

          ${
            conf.type !== "FORMULA"
              ? `
            <div>
              <label class="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Sumber Tabel</label>
              <select onchange="app.updateWidgetTable(${index}, this.value)" 
                class="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-purple-500/20 text-blue-600">
                <option value="">-- Pilih Tabel --</option>
                ${this.allResources
                  .map(
                    (r) =>
                      `<option value="${r.id}" ${
                        conf.table === r.id ? "selected" : ""
                      }>${r.id.toUpperCase()}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="${
              conf.type === "COUNT" ? "opacity-30 pointer-events-none" : ""
            }">
              <label class="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Kolom Target</label>
              <select onchange="app.updateWidgetConfig(${index}, 'column', this.value)" 
                class="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-purple-500/20">
                <option value="">-- Pilih Kolom --</option>
                ${columnOptions}
              </select>
            </div>
          `
              : `
            <div class="md:col-span-2 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center">
              <p class="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
                <i class="fa-solid fa-circle-info mr-2"></i> Mode Formula Aktif: Kelola variabel di panel bawah.
              </p>
            </div>
          `
          }
        </div>

        ${
          conf.type === "FORMULA"
            ? `
          <div class="mb-8 p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 animate-slide-up">
            <div class="flex justify-between items-center mb-6">
              <h5 class="text-[10px] font-black text-blue-500 uppercase tracking-widest">Kalkulasi Lintas Tabel</h5>
              <button onclick="app.addVariable(${index})" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-slate-900 transition-all shadow-md">
                + Tambah Variabel
              </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              ${conf.vars
                .map(
                  (v, vIdx) => `
                <div class="bg-white p-4 rounded-2xl border border-blue-100 relative group shadow-sm">
                  <div class="flex gap-2 mb-2">
                    <input type="text" value="${
                      v.code
                    }" onchange="app.updateVar(${index}, ${vIdx}, 'code', this.value)" 
                      class="w-10 p-2 bg-slate-100 rounded-lg font-black text-[10px] text-center uppercase outline-none">
                    <select onchange="app.updateVar(${index}, ${vIdx}, 'table', this.value)" 
                      class="flex-1 p-2 bg-slate-50 border-none rounded-lg text-[9px] font-bold outline-none text-blue-600">
                      <option value="">Pilih Tabel...</option>
                      ${this.allResources
                        .map(
                          (r) =>
                            `<option value="${r.id}" ${
                              v.table === r.id ? "selected" : ""
                            }>${r.id.toUpperCase()}</option>`
                        )
                        .join("")}
                    </select>
                  </div>
                  <select onchange="app.updateVar(${index}, ${vIdx}, 'col', this.value)" 
                    class="w-full p-2 bg-slate-50 border-none rounded-lg text-[9px] font-bold outline-none">
                    <option value="">Pilih Kolom...</option>
                    ${Object.keys(this.schemaCache[v.table]?.schema || {})
                      .map(
                        (c) =>
                          `<option value="${c}" ${
                            v.col === c ? "selected" : ""
                          }>${c.toUpperCase()}</option>`
                      )
                      .join("")}
                  </select>
                  <button onclick="app.removeVar(${index}, ${vIdx})" class="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              `
                )
                .join("")}
            </div>

            <div>
              <label class="block text-[9px] font-black text-blue-400 uppercase mb-2 ml-1 tracking-widest">Rumus Matematika</label>
              <input type="text" value="${
                conf.formula || ""
              }" placeholder="Contoh: ({A} - {B}) / {A} * 100" 
                onchange="app.updateWidgetConfig(${index}, 'formula', this.value)"
                class="w-full p-5 bg-white border-2 border-blue-200 rounded-2xl font-mono text-sm font-black text-blue-700 shadow-inner outline-none focus:border-blue-500 transition-all">
            </div>
          </div>
        `
            : ""
        }

        <div class="pt-8 border-t border-slate-50 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label class="block text-[8px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Visual Icon</label>
            <select onchange="app.updateWidgetConfig(${index}, 'icon', this.value)" 
              class="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold outline-none">
              <option value="fa-wallet" ${conf.icon === "fa-wallet" ? "selected" : ""}>💰 Keuangan / Saldo</option>
              <option value="fa-cart-shopping" ${conf.icon === "fa-cart-shopping" ? "selected" : ""}>🛒 Penjualan / Transaksi</option>
              <option value="fa-users" ${conf.icon === "fa-users" ? "selected" : ""}>👥 Pelanggan / User</option>
              <option value="fa-box-archive" ${conf.icon === "fa-box-archive" ? "selected" : ""}>📦 Stok / Inventori</option>
              <option value="fa-chart-line" ${conf.icon === "fa-chart-line" ? "selected" : ""}>📈 Tren Data</option>
              <option value="fa-calculator" ${conf.icon === "fa-calculator" ? "selected" : ""}>🧮 Perhitungan</option>
            </select>
          </div>

          <div>
            <label class="block text-[8px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Tema Warna</label>
            <select onchange="app.updateWidgetConfig(${index}, 'color', this.value)" 
              class="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold outline-none">
              <optgroup label="Standar">
                <option value="slate" ${conf.color === "slate" ? "selected" : ""}>🌑 Dark Slate</option>
                <option value="blue" ${conf.color === "blue" ? "selected" : ""}>🔷 Ocean Blue</option>
                <option value="emerald" ${conf.color === "emerald" ? "selected" : ""}>🟢 Forest Green</option>
                <option value="rose" ${conf.color === "rose" ? "selected" : ""}>🔴 Vivid Red</option>
              </optgroup>
              <optgroup label="Premium">
                <option value="amber" ${conf.color === "amber" ? "selected" : ""}>🔶 Golden Amber</option>
                <option value="violet" ${conf.color === "violet" ? "selected" : ""}>🟣 Royal Violet</option>
                <option value="cyan" ${conf.color === "cyan" ? "selected" : ""}>💎 Crystal Cyan</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label class="block text-[8px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Satuan Unit</label>
            <input type="text" value="${conf.unit || "Rp"}" placeholder="Rp / Pcs / %"
              onchange="app.updateWidgetConfig(${index}, 'unit', this.value)"
              class="w-full p-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold text-center outline-none">
          </div>
        </div>

      </div>
    `;
      })
      .join("");
  },

  // FUNGSI HANDLER BARU UNTUK ROLE
  updateWidgetRoles: function(index, selectElement) {
    const selectedOptions = Array.from(selectElement.selectedOptions).map(opt => opt.value);
    this.dashboardConfigs[index].allowed_roles = selectedOptions;
    console.log(`🛡️ Role Updated for Widget ${index}:`, selectedOptions);
  },

  deleteWidgetConfig(index) {
    if (confirm("Hapus widget ini, Juragan?")) {
      this.dashboardConfigs.splice(index, 1);
      this.renderDashboardBuilder();
    }
  },



  updateWidgetConfig: function (index, key, val) {
    // Simpan perubahan ke state
    this.dashboardConfigs[index][key] = val;

    // Jika yang diubah adalah 'type', render ulang karena UI berubah drastis
    if (key === "type") {
      this.renderDashboardBuilder();
    }
    // Catatan: Untuk input teks (name, formula, unit),
    // kita TIDAK render ulang di sini agar kursor tidak mental.
  },

  updateWidgetTable: function (index, tableName) {
    this.dashboardConfigs[index].table = tableName;
    this.dashboardConfigs[index].column = ""; // Reset kolom karena tabel ganti
    this.renderDashboardBuilder(); // Render ulang agar dropdown kolom muncul
  },

  addVariable: function (widgetIndex) {
    if (!this.dashboardConfigs[widgetIndex].vars) {
      this.dashboardConfigs[widgetIndex].vars = [];
    }

    // Berikan kode otomatis (A, B, C...)
    const nextCode = String.fromCharCode(
      65 + this.dashboardConfigs[widgetIndex].vars.length
    );

    this.dashboardConfigs[widgetIndex].vars.push({
      code: nextCode,
      table: "",
      col: "",
    });

    this.renderDashboardBuilder();
  },

  updateVar: function (wIdx, vIdx, key, val) {
    this.dashboardConfigs[wIdx].vars[vIdx][key] = val;

    // Jika ganti tabel, render ulang untuk ambil list kolomnya
    if (key === "table") {
      this.renderDashboardBuilder();
    }
  },

  removeVar: function (wIdx, vIdx) {
    this.dashboardConfigs[wIdx].vars.splice(vIdx, 1);
    this.renderDashboardBuilder();
  },

  deleteWidget: function (index) {
    if (confirm("Hapus konfigurasi widget ini, juragan?")) {
      this.dashboardConfigs.splice(index, 1);
      this.renderDashboardBuilder();
    }
  },

  calculateAllWidgets: function () {
    if (!this.dashboardConfigs) return;

    // GUNAKAN resourceCache (sesuai properti di app juragan)
    this.widgetResults = this.dashboardConfigs.map((conf) => {
      const data = this.resourceCache[conf.table] || [];

      if (conf.type === "COUNT") {
        return data.length;
      }

      if (conf.type === "SUM") {
        return data.reduce((acc, row) => {
          const val = parseFloat(row[conf.column]) || 0;
          return acc + val;
        }, 0);
      }

      return 0;
    });

    console.log("📊 Hasil Perhitungan Dashboard:", this.widgetResults);
  },
});
