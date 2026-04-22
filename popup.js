const API_BASE_URL = "https://marketing-automation-xtd2.onrender.com";

document.addEventListener('DOMContentLoaded', async () => {
    // Views
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const dashboardView = document.getElementById('dashboard-view');
    
    // Alerts
    const loginAlert = document.getElementById('login-alert');
    const registerAlert = document.getElementById('register-alert');

    // Forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Buttons
    const prototypeBtn = document.getElementById('prototype-btn');
    const toRegisterBtn = document.getElementById('to-register');
    const toLoginBtn = document.getElementById('to-login');
    const logoutBtn = document.getElementById('logout-btn');

    const showAlert = (el, message, isSuccess = false) => {
        el.innerText = message;
        el.style.display = 'flex';
        el.className = `auth-alert ${isSuccess ? 'success' : 'error'}`;
        setTimeout(() => el.style.display = 'none', 5000);
    };

    const checkAuth = async () => {
        const { token, user } = await chrome.storage.local.get(['token', 'user']);
        if (token) {
            loginView.style.display = 'none';
            registerView.style.display = 'none';
            dashboardView.style.display = 'block';
        } else {
            dashboardView.style.display = 'none';
            loginView.style.display = 'block';
        }
    };

    await checkAuth();

    // View Switching
    toRegisterBtn.onclick = () => {
        loginView.style.display = 'none';
        registerView.style.display = 'block';
    };

    toLoginBtn.onclick = () => {
        registerView.style.display = 'none';
        loginView.style.display = 'block';
    };

    // Prototype Access (Matches Website)
    prototypeBtn.onclick = () => {
        document.getElementById('login-email').value = "test.automation@blostem.ai";
        document.getElementById('login-password').value = "blostem2026";
        prototypeBtn.style.background = 'rgba(16, 185, 129, 0.1)';
        prototypeBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    };

    // Login Handler
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('login-btn');
        
        submitBtn.disabled = true;
        submitBtn.querySelector('span').innerText = 'Authenticating...';

        try {
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);

            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                await chrome.storage.local.set({ 
                    token: data.access_token,
                    user: data.user 
                });
                await checkAuth();
            } else {
                showAlert(loginAlert, data.detail || 'Login failed. Check credentials.');
            }
        } catch (err) {
            showAlert(loginAlert, 'Connection failed. Ensure backend is running.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('span').innerText = 'Login Intelligence';
        }
    };

    // Register Handler
    registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const inviteCode = document.getElementById('reg-invite').value;
        const submitBtn = document.getElementById('register-btn');

        submitBtn.disabled = true;
        submitBtn.querySelector('span').innerText = 'Unlocking...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    email: email,
                    password: password,
                    invite_code: inviteCode
                })
            });

            const data = await response.json();
            if (response.ok) {
                showAlert(loginAlert, 'Account created! Please login.', true);
                toLoginBtn.click();
            } else {
                showAlert(registerAlert, data.detail || 'Registration failed.');
            }
        } catch (err) {
            showAlert(registerAlert, 'Server error. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('span').innerText = 'Unlock Access';
        }
    };

    // Logout Handler
    logoutBtn.onclick = async () => {
        await chrome.storage.local.remove(['token', 'user']);
        await checkAuth();
    };
});
