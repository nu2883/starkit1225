/**
 * AUTH & LICENSING ENGINE - Juragan SaaS Sheet
 * Menangani Verifikasi Serial dan Login User
 */

// URL Master untuk cek Serial/Lisensi
const BASE_MASTER_URL = 'https://script.google.com/macros/s/AKfycbzxyqu9WRYexe3L5Cq0m_akDlw6J7ZSrINpQk7XgHDN1HSyATtJCs_IQQreJSPj0TW8/exec';
// URL App untuk Login (Gunakan URL Web App Voyager Anda)
const BASE_APP_URL    = 'https://script.google.com/macros/s/AKfycbzYycnldXTaimSg8NZ5dbCk-Xn4sqtQXho1Hq0S0Au-KuoFhsEBiXsWqTeTryOBhRsU/exec';

const auth = {
  // Dipanggil saat halaman load
  init() {
    const serial = localStorage.getItem('sk_serial');
    const token = localStorage.getItem('sk_token');

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
    el.textContent = text;
    el.classList.remove('hidden');
  },

  // Fungsi Verifikasi Lisensi (Serial)
  async verifySerial() {
    const input = document.getElementById('serial-input');
    const serial = input.value.trim();
    
    if (!serial) return this.msg('Serial wajib diisi');
    this.msg('Verifikasi Lisensi...');

    try {
      const res = await fetch(BASE_MASTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'verifySerial', serial })
      });

      const data = await res.json();

      if (data.ok && data.sheet) {
        localStorage.setItem('sk_serial', serial);
        localStorage.setItem('sk_sheet', data.sheet); 
        this.msg('Lisensi Aktif!');
        setTimeout(() => this.showLogin(), 800);
      } else {
        this.msg(data.message || 'Serial tidak valid / Expired');
      }
    } catch (err) {
      this.msg('Gagal koneksi ke Master Server');
    }
  },

  // Fungsi Login (Membawa data Sheet dari Serial)
  async login() {
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-pass');
    const btn = document.getElementById('btn-login-action');
    const sheet = localStorage.getItem('sk_sheet');

    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const pass = passEl.value.trim();

    if (!email || !pass) return alert("Lengkapi data login!");
    if (!sheet) return alert("Link database hilang, silakan ganti serial.");

    btn.innerText = "AUTHORIZING...";
    btn.classList.add('btn-loading');

    try {
      const response = await fetch(BASE_APP_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'login',
          email: email,
          password: pass,
          sheet: sheet // Penting: Mengirimkan database hasil verifikasi serial
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
        btn.classList.remove('btn-loading');
      }
    } catch (e) {
      alert("CORS/Connection Error! Cek deployment Script Anda.");
      btn.innerText = "AUTHORIZE";
      btn.classList.remove('btn-loading');
    }
  },

  resetSerial() {
    if (!confirm('Hapus lisensi ini?')) return;
    localStorage.clear();
    location.reload();
  },

  logout() {
    // Hanya hapus sesi login, simpan serialnya biar gak repot ketik ulang
    localStorage.removeItem('sk_token');
    localStorage.removeItem('sk_role');
    localStorage.removeItem('sk_email');
    location.reload();
  }
};

// Jalankan init saat script dimuat
window.addEventListener('load', () => auth.init());