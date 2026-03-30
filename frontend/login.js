// File: frontend/login.js

document.getElementById('login-button').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    errorMessage.textContent = ''; // Kosongkan pesan error

    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            // Tampilkan error dari backend (misal: "Email atau password salah.")
            throw new Error(data.error || 'Login gagal.');
        }

        // --- LOGIN BERHASIL ---
        
        // 1. Simpan token dan role di localStorage browser
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userRole', data.role);

        // 2. Arahkan pengguna berdasarkan rolenya
        if (data.role === 'admin') {
            window.location.href = 'admin.html'; // Arahkan admin ke admin.html
        } else {
            window.location.href = 'index.html'; // Arahkan user biasa ke index.html
        }

    } catch (error) {
        errorMessage.textContent = error.message;
        console.error('Login error:', error);
    }
});