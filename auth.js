/**
 * ============================================================
 * AUTH & LICENSING ENGINE - v2.0 (THE NAVIGATOR) - OPTIMIZED
 * ============================================================
 * Juragan SaaS Sheet [2026-01-15]
 * Fitur: Dynamic Engine Routing, UA Binding, Keyboard Shortcut Ready.
 */

const BASE_MASTER_URL = 'https://script.google.com/macros/s/AKfycbzxyqu9WRYexe3L5Cq0m_akDlw6J7ZSrINpQk7XgHDN1HSyATtJCs_IQQreJSPj0TW8/exec';

const auth = {
  init() {
    const serial = localStorage.getItem('sk_serial');
    const token = localStorage.getItem('sk_token');
    this.targetEngine = localStorage.getItem('sk_engine_url');

    // --- 🚀 SYNC BRANDING AWAL ---
    // Pastikan nama aplikasi di Tab & Navbar langsung berubah saat web dibuka
    this.applyBranding();

    // Tambahkan Event Listener Keyboard secara global untuk kenyamanan user
    this.setupKeyboardListeners();

    if (!serial) {
      this.showSerial();
    } else if (!token) {
      this.showLogin();
    } else {
      document.getElementById('login-screen').classList.add('hidden');
      if (window.app && window.app.init) window.app.init();
    }
  },

  // Fitur Baru: Handler Enter Key agar user tidak perlu klik mouse
  setupKeyboardListeners() {
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const isSerialVisible = !document.getElementById('serial-box').classList.contains('hidden');
        const isLoginVisible = !document.getElementById('login-box').classList.contains('hidden');
        
        if (isSerialVisible) {
          this.verifySerial();
        } else if (isLoginVisible) {
          this.login();
        }
      }
    });
  },

  showSerial() {
    document.getElementById('serial-box').classList.remove('hidden');
    document.getElementById('login-box').classList.add('hidden');
    document.getElementById('serial-input').focus(); // Auto-focus biar bisa langsung ngetik
  },

showLogin() {
    // 1. Ambil Nama Aplikasi yang sudah disimpan saat verifikasi serial
    const savedName = localStorage.getItem('sk_app_name') || ' ';
    
    // 2. Tampilkan nama tersebut ke elemen UI (ID: display-app-name)
    const displayEl = document.getElementById('display-app-name');
    if (displayEl) {
      displayEl.innerText = savedName;
    }

    // 3. Kelola visibilitas box
    document.getElementById('login-box').classList.remove('hidden');
    document.getElementById('serial-box').classList.add('hidden');
    
    // 4. Berikan pengalaman user yang smooth (Auto-focus)
    const emailInput = document.getElementById('login-email');
    if (emailInput) emailInput.focus();

    
  },


  msg(html) {
  const el = document.getElementById('login-msg');
  if (!el) return;

  el.innerHTML = html;
  el.classList.remove('hidden');
},

hideMsg() {
  const el = document.getElementById('login-msg');
  if (!el) return;

  el.innerHTML = '';
  el.classList.add('hidden');
}
,


async verifySerial() {
  const input = document.getElementById('serial-input');
  const serial = input.value.trim();

  if (!serial) {
    this.msg('Serial wajib diisi');
    return;
  }

  this.msg('Verifikasi Lisensi & Status Engine...');

  try {
    const res = await fetch(BASE_MASTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'verifySerial',
        serial: serial
      })
    });

    const data = await res.json();
    // console.log('[VERIFY SERIAL RESPONSE]', data);

    // ❌ SERIAL TIDAK VALID
    if (!data || data.ok !== true) {
      this.msg(data?.message || 'Serial tidak valid / Expired');
      return;
    }

    const status = String(data.status || '').toLowerCase().trim();

    // 🚨 BELUM AKTIVASI → HARD LOCK + LINK AKTIVASI
    if (status === '') {
      localStorage.clear();

this.msg(`
  <div class="space-y-2 text-center">
    <div class="text-red-600 font-black text-sm">
      🚫 LISENSI BELUM DIAKTIVASI
    </div>

    <div class="text-slate-600 text-[11px] normal-case leading-relaxed">
      Engine dalam kondisi terkunci.<br>
      Silakan lakukan aktivasi lisensi terlebih dahulu.
    </div>

    <a
      href="https://nu2883.github.io/starkit1225/LP"
      target="_blank"
      class="inline-block mt-2 text-blue-600 font-black text-[11px] underline hover:text-blue-800 normal-case"
    >
      👉 Klik di sini untuk Aktivasi Lisensi
    </a>
  </div>
`);


      return;
    }

    // ❌ STATUS TIDAK SAH
    if (status !== 'trial' && status !== 'aktif') {
      this.msg(`
        <span class="text-red-600 font-black">
          Status lisensi tidak valid. Hubungi admin.
        </span>
      `);
      return;
    }

    // ❌ ENGINE BELUM SIAP
    if (!data.sheet || !data.engine_url) {
      this.msg(`
        <span class="text-red-600 font-black">
          Engine belum dikonfigurasi. Hubungi admin.
        </span>
      `);
      return;
    }

    // ✅ AMAN → SIMPAN
    localStorage.setItem('sk_serial', serial);
    localStorage.setItem('sk_sheet', data.sheet);
    localStorage.setItem('sk_engine_url', data.engine_url);
    localStorage.setItem('sk_status', status);

    const finalAppName = data.appName || 'Starkit';
    localStorage.setItem('sk_app_name', finalAppName);

    this.targetEngine = data.engine_url;

    this.msg(
      status === 'trial'
        ? '🧪 Mode TRIAL aktif'
        : '✅ Lisensi AKTIF & Engine Terhubung'
    );

    setTimeout(() => {
      this.hideMsg?.();
      this.showLogin();
    }, 800);

  } catch (err) {
    console.error(err);
    this.msg('❌ Gagal koneksi ke Master Server');
  }
}



,

  async login() {
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-pass');
    const btn = document.getElementById('btn-login-action');
    
    const sheet = localStorage.getItem('sk_sheet');
    const engineUrl = localStorage.getItem('sk_engine_url');

    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const pass = passEl.value.trim();

    if (!email || !pass) return this.msg("Email & Password wajib diisi!");
    if (!engineUrl) return this.msg("Engine tidak ditemukan. Reset Serial.");

    btn.innerText = "AUTHORIZING...";
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
      const response = await fetch(engineUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'login',
          email: email,
          password: pass,
          sheet: sheet,
          ua: navigator.userAgent
        })
      });

      const res = await response.json();

      if (res.success) {
        localStorage.setItem('sk_token', res.token);
        localStorage.setItem('sk_role', res.role);
        localStorage.setItem('sk_email', email);
        this.msg("Akses Diterima! Memuat Dashboard...");
        setTimeout(() => location.reload(), 500); 
      } else {
        this.msg("Gagal: " + res.message);
        btn.innerText = "AUTHORIZE";
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    } catch (e) {
      this.msg("CORS Error! Cek Deployment Engine.");
      btn.innerText = "AUTHORIZE";
      btn.disabled = false;
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  },

  resetSerial() {
    if (!confirm('Hapus lisensi ini?')) return;
    localStorage.clear();
    location.reload();
  },

  logout() {
    localStorage.removeItem('sk_token');
    localStorage.removeItem('sk_role');
    localStorage.removeItem('sk_email');
    location.reload();
  },
  
  /**
 * FUNGSI SINKRONISASI BRANDING
 * Mengambil Nama Aplikasi dari LocalStorage dan menerapkannya ke UI
 */
applyBranding() {
  const savedName = localStorage.getItem('sk_app_name') || 'STARKIT';
  
  // 1. Ubah Title Browser (Tab)
  document.title = savedName.toUpperCase();

  // 2. Ubah Nama di Navbar
  const navName = document.getElementById('nav-app-name');
  if (navName) {
    navName.innerText = savedName.toUpperCase();
  }

  // 3. Ubah Nama di Login Screen (jika ada)
  const displayEl = document.getElementById('display-app-name');
  if (displayEl) {
    displayEl.innerText = savedName.toUpperCase();
  }
}


};

window.addEventListener('load', () => auth.init());