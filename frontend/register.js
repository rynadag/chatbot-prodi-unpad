// File: frontend/register.js

document.getElementById('register-button').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value; // Ambil nilai dari dropdown
    
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    errorMessage.textContent = ''; // Kosongkan pesan
    successMessage.textContent = ''; // Kosongkan pesan

    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, role }), // Kirim ketiga data
        });

        const data = await response.json();

        if (!response.ok) {
            // Tampilkan error dari backend
            throw new Error(data.error || 'Registrasi gagal.');
        }

        // --- REGISTRASI BERHASIL ---
        successMessage.textContent = 'Registrasi berhasil! Anda akan diarahkan ke halaman login...';

        // Tunggu 2 detik, lalu arahkan ke halaman login
        setTimeout(() => {
            window.location.href = 'login.html'; 
        }, 2000);


    } catch (error) {
        errorMessage.textContent = error.message;
        console.error('Register error:', error);
    }
});