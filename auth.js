const Auth = {
    async login() {
        const btn = document.getElementById('btn-login');
        const emailEl = document.getElementById('login-email');
        const passEl = document.getElementById('login-pass');
        if (!emailEl || !passEl) return;

        const email = emailEl.value;
        const pass = passEl.value;

        btn.innerText = "AUTHORIZING...";
        try {
            const response = await fetch(BASE_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'login', email, password: pass })
            });
            const res = await response.json();
            if (res.success) {
                localStorage.setItem('sk_token', res.token);
                localStorage.setItem('sk_role', res.role);
                localStorage.setItem('sk_email', email);
                location.reload();
            } else {
                alert("Akses Ditolak!");
                btn.innerText = "AUTHORIZE";
            }
        } catch (e) {
            alert("Gagal terhubung ke server!");
            btn.innerText = "AUTHORIZE";
        }
    },

    logout() {
        localStorage.clear();
        location.reload();
    }
};