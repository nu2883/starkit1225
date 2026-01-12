/**
 * ============================================================
 * AUTH & LICENSING ENGINE - v2.0 (THE NAVIGATOR)
 * ============================================================
 * Juragan SaaS Sheet [2026-01-12]
 * Fitur: Dynamic Engine Routing, UA Binding, Auto-Provisioning Ready.
 */

// 1. URL MASTER tetap satu (Resepsionis Utama)
const BASE_MASTER_URL = 'https://script.google.com/macros/s/AKfycbzxyqu9WRYexe3L5Cq0m_akDlw6J7ZSrINpQk7XgHDN1HSyATtJCs_IQQreJSPj0TW8/exec';

const auth = {
  // Dipanggil saat halaman load
  init() {
    const serial = localStorage.getItem('sk_serial');
    const token = localStorage.getItem('sk_token');
    
    // Engine URL sekarang diambil dinamis dari memori browser
    this.targetEngine = localStorage.getItem('sk_engine_url');

    if (!serial) {
      this.showSerial();
    } else if (!token) {
      this.showLogin();
    } else {
      // Jika sudah login, sembunyikan screen login
      document.getElementById('login-screen').classList.add('hidden');
    }
  },

  showSerial() {
    document.getElementById('serial-box').classList.remove('hidden');
    document.getElementById('login-box').classList.add('hidden');
  },

  showLogin() {
    document.getElementById('login-box').classList.remove('hidden');
    document.getElementById('serial-box').classList.add('hidden');
  },

  msg(text) {
    const el = document.getElementById('login-msg');
    if (el) {
      el.textContent = text;
      el.classList.remove('hidden');
    }
  },

  /**
   * TAHAP 1: VERIFIKASI SERIAL (Tanya Master harus ke Engine mana)
   */
  async verifySerial() {
    const input = document.getElementById('serial-input');
    const serial = input.value.trim();
    
    if (!serial) return this.msg('Serial wajib diisi');
    this.msg('Verifikasi Lisensi & Mencari Engine...');

    try {
      const res = await fetch(BASE_MASTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'verifySerial', serial })
      });

      const data = await res.json();

      if (data.ok && data.sheet && data.engine_url) {
        // SIMPAN KOORDINAT ENGINE SECARA DINAMIS
        localStorage.setItem('sk_serial', serial);
        localStorage.setItem('sk_sheet', data.sheet); 
        localStorage.setItem('sk_engine_url', data.engine_url); // <--- INI KUNCINYA
        
        this.targetEngine = data.engine_url;
        this.msg('Lisensi Aktif & Engine Terhubung!');
        setTimeout(() => this.showLogin(), 800);
      } else {
        this.msg(data.message || 'Serial tidak valid / Expired');
      }
    } catch (err) {
      this.msg('Gagal koneksi ke Master Server');
    }
  },

  /**
   * TAHAP 2: LOGIN (Menembak Engine yang Tepat)
   */
  async login() {
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-pass');
    const btn = document.getElementById('btn-login-action');
    
    // Ambil data yang tersimpan di storage
    const sheet = localStorage.getItem('sk_sheet');
    const engineUrl = localStorage.getItem('sk_engine_url');

    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const pass = passEl.value.trim();

    if (!email || !pass) return alert("Lengkapi data login!");
    if (!engineUrl) return alert("Engine tidak ditemukan. Silakan masukkan ulang serial.");

    btn.innerText = "AUTHORIZING...";
    btn.disabled = true;

    try {
      // 🟢 DISIPLIN: Menembak URL Engine milik klien, BUKAN BASE_APP_URL statis
      const response = await fetch(engineUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'login',
          email: email,
          password: pass,
          sheet: sheet,
          ua: navigator.userAgent // WAJIB untuk Obsidian Core Session Binding
        })
      });

      const res = await response.json();

      if (res.success) {
        localStorage.setItem('sk_token', res.token);
        localStorage.setItem('sk_role', res.role);
        localStorage.setItem('sk_email', email);
        location.reload(); 
      } else {
        alert("Gagal: " + res.message);
        btn.innerText = "AUTHORIZE";
        btn.disabled = false;
      }
    } catch (e) {
      alert("CORS/Connection Error ke Engine! Cek Deployment URL Engine Anda.");
      btn.innerText = "AUTHORIZE";
      btn.disabled = false;
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
  }
};

// Jalankan init saat script dimuat
window.addEventListener('load', () => auth.init());