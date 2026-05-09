(function() {
    // ---------- API ----------
    const API_BASE = 'https://fianit-backend.onrender.com/api';

    // ---------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ----------
    let menuItems = [];      // загружается с API
    let notifications = JSON.parse(localStorage.getItem('notifications')) || [];
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    let users = JSON.parse(localStorage.getItem('users')) || [];
    let cart = JSON.parse(localStorage.getItem('foodCart')) || [];
    let useBonuses = false;

    // ---------- ЗАГРУЗКА МЕНЮ ИЗ API ----------
    async function loadMenu() {
        try {
            const response = await fetch(API_BASE + '/menu');
            const data = await response.json();
            // Преобразуем imageUrl → img для совместимости
            menuItems = data.map(item => ({
                ...item,
                img: item.imageUrl
            }));
            renderMenu();
        } catch (err) {
            console.error('Ошибка загрузки меню', err);
            const container = document.getElementById('menuContainer');
            if (container) container.innerHTML = '<p class="text-center text-muted">Не удалось загрузить меню</p>';
        }
    }

    // ---------- УВЕДОМЛЕНИЯ ----------
    function showNotification(message, type = 'info') {
        const id = Date.now();
        const notification = { id, message, type, read: false, timestamp: new Date().toLocaleTimeString() };
        notifications.unshift(notification);
        if (notifications.length > 20) notifications.pop();
        localStorage.setItem('notifications', JSON.stringify(notifications));
        
        const container = document.getElementById('notificationContainer');
        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} fs-5"></i>
            <span>${message}</span>
        `;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 5000);
        updateNotificationsDropdown();
    }

    function updateNotificationsDropdown() {
        const dropdown = document.getElementById('notificationsDropdown');
        const unread = notifications.filter(n => !n.read).length;
        dropdown.innerHTML = `
            <button class="btn btn-outline-secondary position-relative" type="button" data-bs-toggle="dropdown" style="border-radius: 40px;">
                <i class="bi bi-bell"></i>
                ${unread > 0 ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">${unread}</span>` : ''}
            </button>
            <div class="dropdown-menu dropdown-menu-end notifications-dropdown p-0">
                <div class="p-3 border-bottom"><strong>Уведомления</strong></div>
                <div id="notificationsList">
                    ${notifications.length === 0 ? '<div class="p-3 text-muted text-center">Нет уведомлений</div>' : 
                      notifications.slice(0, 10).map(n => `
                        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markNotificationRead(${n.id})">
                            <div class="d-flex align-items-start gap-2">
                                <i class="bi bi-${n.type === 'success' ? 'check-circle text-success' : n.type === 'error' ? 'exclamation-circle text-danger' : 'info-circle text-info'}"></i>
                                <div>
                                    <div class="small">${n.message}</div>
                                    <div class="text-muted small">${n.timestamp}</div>
                                </div>
                            </div>
                        </div>
                      `).join('')}
                </div>
                ${notifications.length > 0 ? '<div class="p-2 text-center border-top"><button class="btn btn-sm btn-link" onclick="markAllNotificationsRead()">Отметить все прочитанными</button></div>' : ''}
            </div>
        `;
    }

    window.markNotificationRead = function(id) {
        const notif = notifications.find(n => n.id === id);
        if (notif) notif.read = true;
        localStorage.setItem('notifications', JSON.stringify(notifications));
        updateNotificationsDropdown();
    };
    window.markAllNotificationsRead = function() {
        notifications.forEach(n => n.read = true);
        localStorage.setItem('notifications', JSON.stringify(notifications));
        updateNotificationsDropdown();
    };

    // ---------- ВАЛИДАЦИЯ ТЕЛЕФОНА ----------
    function validatePhone(phone) {
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        const patterns = [/^\+7\d{10}$/, /^8\d{10}$/, /^7\d{10}$/];
        return patterns.some(p => p.test(cleaned));
    }
    function formatPhone(phone) {
        let cleaned = phone.replace(/[\s\-\(\)]/g, '');
        if (cleaned.startsWith('8')) cleaned = '+7' + cleaned.slice(1);
        if (cleaned.startsWith('7') && !cleaned.startsWith('+')) cleaned = '+' + cleaned;
        return cleaned;
    }

    // ---------- ПОЛЬЗОВАТЕЛИ ----------
    if (!users.find(u => u.email === 'admin@foodfly.ru')) {
        users.push({ id: 0, name: 'Администратор', email: 'admin@foodfly.ru', phone: '+79000000000', password: 'admin123', bonuses: 0, role: 'admin', orders: [] });
    }
    if (!users.find(u => u.email === 'guest@foodfly.ru')) {
        users.push({ id: 1, name: 'Гость', email: 'guest@foodfly.ru', phone: '+79001234567', password: '123456', bonuses: 150, role: 'user', promoFirstUsed: false, orders: [
            { date: '15.04.2025', total: 1200, bonusesEarned: 60, address: 'ул. Ленина, 1', payment: 'card' },
            { date: '10.04.2025', total: 890, bonusesEarned: 45, address: 'пр. Мира, 5', payment: 'cash' }
        ]});
    }
    users.forEach(u => { if (u.promoFirstUsed === undefined) u.promoFirstUsed = false; });
    localStorage.setItem('users', JSON.stringify(users));

    function saveUsers() { localStorage.setItem('users', JSON.stringify(users)); }
    function saveCurrentUser() {
        if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
        else localStorage.removeItem('currentUser');
    }
    function saveCart() { localStorage.setItem('foodCart', JSON.stringify(cart)); }

    // ---------- МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ ----------
    const authModal = new bootstrap.Modal(document.getElementById('authModal'));
    document.getElementById('authModal').addEventListener('show.bs.modal', () => {
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
        document.getElementById('loginError').textContent = '';
        document.getElementById('regError').textContent = '';
        document.getElementById('phoneError').textContent = '';
        document.getElementById('regPhone').classList.remove('is-invalid');
        const loginTab = new bootstrap.Tab(document.getElementById('login-tab'));
        loginTab.show();
    });
    document.getElementById('authModal').addEventListener('hidden.bs.modal', () => {
        updateAuthUI();
        updateCartUI();
    });

    function updateAuthUI() {
        const authBlock = document.getElementById('authBlock');
        if (currentUser) {
            const user = users.find(u => u.email === currentUser.email);
            const isAdmin = user?.role === 'admin';
            authBlock.innerHTML = `
                <div class="d-flex gap-2">
                    ${isAdmin ? `<button class="btn btn-outline-secondary" id="adminBtn"><i class="bi bi-shield-lock"></i></button>` : ''}
                    <button class="btn btn-outline-custom" id="profileBtn"><i class="bi bi-person-circle me-1"></i>${currentUser.name.split(' ')[0]}${isAdmin ? ' <span class="admin-badge ms-1">admin</span>' : ''}</button>
                </div>
            `;
            document.getElementById('profileBtn').addEventListener('click', () => {
                showProfile();
                new bootstrap.Modal(document.getElementById('profileModal')).show();
            });
            if (isAdmin) {
                document.getElementById('adminBtn').addEventListener('click', () => {
                    showAdminPanel();
                    new bootstrap.Modal(document.getElementById('adminModal')).show();
                });
            }
        } else {
            authBlock.innerHTML = `<button class="btn btn-outline-custom" id="loginBtn"><i class="bi bi-box-arrow-in-right me-1"></i>Войти</button>`;
            document.getElementById('loginBtn').addEventListener('click', () => authModal.show());
        }
    }

    function showProfile() {
        if (!currentUser) return;
        const user = users.find(u => u.email === currentUser.email);
        let ordersHtml = user.orders?.length ? user.orders.map(o => 
            `<li class="list-group-item d-flex justify-content-between"><span>${o.date} — ${o.total} ₽ (+${o.bonusesEarned} бон.)</span><span class="text-muted small">${o.address || '—'}</span></li>`
        ).join('') : '<li class="list-group-item text-muted">Нет заказов</li>';
        document.getElementById('profileContent').innerHTML = `
            <div class="text-center mb-4">
                <i class="bi bi-person-circle display-1 text-accent"></i>
                <h4 class="mt-2">${user.name} ${user.role === 'admin' ? '<span class="admin-badge">Админ</span>' : ''}</h4>
                <p class="text-muted">${user.email} · ${user.phone}</p>
                <div class="bg-light p-3 rounded-4 mt-3">
                    <span class="fw-bold">Бонусный баланс:</span>
                    <span class="fs-3 text-accent d-block">${user.bonuses} баллов</span>
                </div>
            </div>
            <h6>История заказов</h6>
            <ul class="list-group list-group-flush">${ordersHtml}</ul>
        `;
    }

    function showAdminPanel() {
        const adminContent = document.getElementById('adminContent');
        const userList = users.filter(u => u.role !== 'admin');
        adminContent.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead><tr><th>ID</th><th>Имя</th><th>Email</th><th>Телефон</th><th>Бонусы</th><th>Заказы</th><th>Действия</th></tr></thead>
                    <tbody>
                        ${userList.map(u => `
                            <tr>
                                <td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.phone}</td>
                                <td><span class="fw-bold">${u.bonuses}</span></td><td>${u.orders?.length || 0}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary me-1" onclick="adjustBonuses(${u.id}, 50)"><i class="bi bi-plus-circle"></i></button>
                                    <button class="btn btn-sm btn-outline-warning" onclick="adjustBonuses(${u.id}, -50)"><i class="bi bi-dash-circle"></i></button>
                                    <button class="btn btn-sm btn-outline-info ms-1" onclick="viewUserOrders(${u.id})"><i class="bi bi-eye"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div id="userOrdersView" class="mt-3"></div>
        `;
    }

    window.adjustBonuses = function(userId, amount) {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        user.bonuses = Math.max(0, user.bonuses + amount);
        saveUsers();
        if (currentUser && currentUser.email === user.email) {
            currentUser.bonuses = user.bonuses;
            saveCurrentUser();
        }
        showNotification(`Бонусы пользователя ${user.name} ${amount > 0 ? 'увеличены' : 'уменьшены'} на ${Math.abs(amount)}`, 'success');
        showAdminPanel();
    };

    window.viewUserOrders = function(userId) {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        const viewDiv = document.getElementById('userOrdersView');
        viewDiv.innerHTML = `
            <h6>Заказы пользователя ${user.name}</h6>
            ${user.orders?.length ? user.orders.map(o => 
                `<div class="border-bottom py-2">${o.date} — ${o.total} ₽ (бонусов: ${o.bonusesEarned}) | ${o.address || '—'} | ${o.payment || '—'}</div>`
            ).join('') : '<p class="text-muted">Нет заказов</p>'}
        `;
    };

    // ---------- РЕНДЕР МЕНЮ ----------
    function renderMenu() {
        const container = document.getElementById('menuContainer');
        if (!container) return;
        container.innerHTML = menuItems.map(item => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100">
                    <img src="${item.img}" class="card-img-top" alt="${item.name}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="card-title fw-bold">${item.name}</h5>
                            <span class="fw-bold text-accent">${item.price} ₽</span>
                        </div>
                        <p class="card-text text-muted small">${item.weight || '250 г'}</p>
                        <button class="btn btn-primary-custom w-100 add-to-cart" data-id="${item.id}">
                            <i class="bi bi-cart-plus me-1"></i>В корзину
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', addToCartHandler));
    }

    function addToCartHandler(e) {
        const id = Number(e.currentTarget.dataset.id);
        const item = menuItems.find(i => i.id === id);
        if (!item) return;
        const existing = cart.find(i => i.id === id);
        if (existing) existing.quantity += 1;
        else cart.push({ ...item, quantity: 1 });
        saveCart();
        updateCartUI();
        showNotification(`Добавлено: ${item.name}`, 'success');
    }

    // ---------- КОРЗИНА ----------
    function updateCartCount() { document.getElementById('cartCount').textContent = cart.reduce((sum, i) => sum + i.quantity, 0); }

    function renderCart() {
        const container = document.getElementById('cartItemsContainer');
        if (!container) return;
        if (cart.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-4">Корзина пуста</p>';
            document.getElementById('cartBonusInfo').innerHTML = '';
            document.getElementById('cartTotal').textContent = '0 ₽';
            return;
        }
        let subtotal = 0;
        container.innerHTML = cart.map(item => {
            subtotal += item.price * item.quantity;
            return `<div class="cart-item">
                <img src="${item.img || item.imageUrl || 'https://via.placeholder.com/60'}" alt="${item.name}">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${item.price} ₽</div>
                </div>
                <div class="cart-item-controls">
                    <button class="decr-item" data-id="${item.id}">−</button>
                    <span>${item.quantity}</span>
                    <button class="incr-item" data-id="${item.id}">+</button>
                </div>
            </div>`;
        }).join('');

        let userBonuses = 0;
        if (currentUser) {
            const user = users.find(u => u.email === currentUser.email);
            if (user) userBonuses = user.bonuses;
        }
        const maxDiscount = Math.min(userBonuses, Math.floor(subtotal * 0.5));
        const discount = useBonuses ? maxDiscount : 0;
        const total = subtotal - discount;

        document.getElementById('cartBonusInfo').innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span><i class="bi bi-gift me-1"></i>Ваши бонусы:</span>
                <span class="fw-bold">${userBonuses} баллов</span>
            </div>
            ${userBonuses > 0 ? `
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="useBonusesCheck" ${useBonuses ? 'checked' : ''}>
                <label class="form-check-label" for="useBonusesCheck">Списать бонусы (макс. ${maxDiscount} ₽)</label>
            </div>` : '<p class="text-muted small mb-0">Войдите, чтобы копить и тратить бонусы</p>'}
            ${useBonuses ? `<p class="text-success small mt-2">Скидка за бонусы: −${discount} ₽</p>` : ''}
        `;
        document.getElementById('cartTotal').textContent = total + ' ₽';

        document.querySelectorAll('.incr-item').forEach(b => b.addEventListener('click', () => changeQuantity(b.dataset.id, 1)));
        document.querySelectorAll('.decr-item').forEach(b => b.addEventListener('click', () => changeQuantity(b.dataset.id, -1)));
        const check = document.getElementById('useBonusesCheck');
        if (check) check.addEventListener('change', e => { useBonuses = e.target.checked; renderCart(); });
    }

    function changeQuantity(id, delta) {
        const item = cart.find(i => i.id == id);
        if (!item) return;
        item.quantity += delta;
        if (item.quantity <= 0) cart = cart.filter(i => i.id != id);
        saveCart();
        updateCartUI();
    }
    function updateCartUI() { renderCart(); updateCartCount(); }

    // ---------- ОФОРМЛЕНИЕ ЗАКАЗА ----------
    let appliedPromo = null;
    const checkoutModal = new bootstrap.Modal(document.getElementById('checkoutModal'));

    function updateCheckoutModal() {
        if (cart.length === 0) { checkoutModal.hide(); return; }
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        let promoDiscount = (appliedPromo && appliedPromo.code === 'FIRST20') ? Math.round(subtotal * 0.2) : 0;
        const user = currentUser ? users.find(u => u.email === currentUser.email) : null;
        const userBonuses = user ? user.bonuses : 0;
        const maxBonusDiscount = Math.min(userBonuses, Math.floor((subtotal - promoDiscount) * 0.5));
        const bonusDiscount = useBonuses ? maxBonusDiscount : 0;
        const finalTotal = subtotal - promoDiscount - bonusDiscount;

        document.getElementById('checkoutItemCount').textContent = cart.reduce((sum, i) => sum + i.quantity, 0);
        document.getElementById('checkoutSubtotal').textContent = subtotal + ' ₽';
        document.getElementById('promoDiscountRow').style.display = promoDiscount > 0 ? 'flex' : 'none';
        document.getElementById('promoDiscountAmount').textContent = `-${promoDiscount} ₽`;
        document.getElementById('bonusDiscountRow').style.display = bonusDiscount > 0 ? 'flex' : 'none';
        document.getElementById('bonusDiscountAmount').textContent = `-${bonusDiscount} ₽`;
        document.getElementById('checkoutFinalTotal').textContent = finalTotal + ' ₽';

        const bonusesWillEarn = Math.floor(finalTotal * 0.05);
        document.getElementById('bonusEarnInfo').textContent = currentUser ?
            `После заказа вам будет начислено ${bonusesWillEarn} бонусов (5% от оплаченной суммы)` :
            'Войдите в аккаунт, чтобы копить бонусы';
    }

    document.getElementById('applyPromoBtn').addEventListener('click', () => {
        const promoInput = document.getElementById('checkoutPromo');
        const code = promoInput.value.trim().toUpperCase();
        const feedback = document.getElementById('promoFeedback');
        if (code !== 'FIRST20') {
            feedback.textContent = 'Недействительный промокод';
            feedback.className = 'form-text text-danger';
            return;
        }
        const user = users.find(u => u.email === currentUser.email);
        if (!user) return;
        if (user.orders && user.orders.length > 0) {
            feedback.textContent = 'Промокод FIRST20 доступен только для первого заказа';
            feedback.className = 'form-text text-warning';
            return;
        }
        if (user.promoFirstUsed) {
            feedback.textContent = 'Вы уже использовали промокод FIRST20';
            feedback.className = 'form-text text-warning';
            return;
        }
        appliedPromo = { code: 'FIRST20', discount: 20 };
        feedback.textContent = 'Промокод FIRST20 применён! Скидка 20%';
        feedback.className = 'form-text text-success';
        promoInput.disabled = true;
        document.getElementById('applyPromoBtn').disabled = true;
        showNotification('Промокод FIRST20 активирован! Скидка 20%', 'success');
        updateCheckoutModal();
    });

    document.getElementById('checkoutBtn').addEventListener('click', () => {
        if (cart.length === 0) { showNotification('Корзина пуста', 'warning'); return; }
        if (!currentUser) { showNotification('Для оформления заказа необходимо войти', 'warning'); return; }
        appliedPromo = null;
        const promoInput = document.getElementById('checkoutPromo');
        promoInput.value = '';
        promoInput.disabled = false;
        document.getElementById('applyPromoBtn').disabled = false;
        document.getElementById('promoFeedback').textContent = '';
        updateCheckoutModal();
        checkoutModal.show();
    });

    document.getElementById('confirmOrderBtn').addEventListener('click', () => {
        const address = document.getElementById('checkoutAddress').value.trim();
        if (!address) {
            document.getElementById('checkoutAddress').classList.add('is-invalid');
            return;
        }
        document.getElementById('checkoutAddress').classList.remove('is-invalid');
        const payment = document.getElementById('checkoutPayment').value;
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        let promoDiscount = (appliedPromo && appliedPromo.code === 'FIRST20') ? Math.round(subtotal * 0.2) : 0;
        const user = users.find(u => u.email === currentUser.email);
        const maxBonusDiscount = Math.min(user.bonuses, Math.floor((subtotal - promoDiscount) * 0.5));
        const bonusDiscount = useBonuses ? maxBonusDiscount : 0;
        const finalTotal = subtotal - promoDiscount - bonusDiscount;
        const bonusesEarned = Math.floor(finalTotal * 0.05);

        user.bonuses = user.bonuses - bonusDiscount + bonusesEarned;
        if (!user.orders) user.orders = [];
        const promoUsedNow = (appliedPromo && appliedPromo.code === 'FIRST20');
        if (promoUsedNow) { user.promoFirstUsed = true; }
        user.orders.unshift({
            date: new Date().toLocaleDateString('ru'),
            total: finalTotal,
            bonusesEarned: bonusesEarned,
            address: address,
            payment: payment,
            promoApplied: promoUsedNow ? 'FIRST20' : null
        });
        if (user.orders.length > 5) user.orders.pop();
        currentUser.bonuses = user.bonuses;
        if (promoUsedNow) currentUser.promoFirstUsed = true;
        saveUsers();
        saveCurrentUser();
        showNotification(`Заказ на сумму ${finalTotal} ₽ оформлен! Начислено ${bonusesEarned} бонусов.`, 'success');
        cart = [];
        useBonuses = false;
        appliedPromo = null;
        saveCart();
        updateCartUI();
        updateAuthUI();
        checkoutModal.hide();
    });

    document.getElementById('checkoutModal').addEventListener('hidden.bs.modal', () => {
        appliedPromo = null;
        const promoInput = document.getElementById('checkoutPromo');
        promoInput.value = '';
        promoInput.disabled = false;
        document.getElementById('applyPromoBtn').disabled = false;
        document.getElementById('promoFeedback').textContent = '';
    });

    // ---------- САЙДБАР КОРЗИНЫ ----------
    const sidebar = document.getElementById('cartSidebar'), overlay = document.getElementById('cartOverlay');
    document.getElementById('cartToggle').addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('open'); });
    document.getElementById('closeCart').addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); });
    overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); });

    // ---------- АВТОРИЗАЦИЯ ----------
    document.getElementById('loginForm').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPassword').value;
        const user = users.find(u => u.email === email && u.password === pass);
        if (user) {
            currentUser = { name: user.name, email: user.email, phone: user.phone, bonuses: user.bonuses, role: user.role, promoFirstUsed: user.promoFirstUsed };
            saveCurrentUser();
            authModal.hide();
            showNotification(`С возвращением, ${user.name}!`, 'success');
        } else {
            document.getElementById('loginError').textContent = 'Неверный email или пароль';
        }
    });

    document.getElementById('registerForm').addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const pass = document.getElementById('regPassword').value;
        if (!validatePhone(phone)) {
            document.getElementById('regPhone').classList.add('is-invalid');
            document.getElementById('phoneError').textContent = 'Введите корректный номер (+7XXXXXXXXXX)';
            return;
        }
        document.getElementById('regPhone').classList.remove('is-invalid');
        if (users.find(u => u.email === email)) {
            document.getElementById('regError').textContent = 'Пользователь с таким email уже существует';
            return;
        }
        const formattedPhone = formatPhone(phone);
        const newUser = {
            id: Date.now(), name, email, phone: formattedPhone, password: pass,
            bonuses: 100, role: 'user', orders: [], promoFirstUsed: false
        };
        users.push(newUser);
        saveUsers();
        currentUser = { name, email, phone: formattedPhone, bonuses: 100, role: 'user', promoFirstUsed: false };
        saveCurrentUser();
        authModal.hide();
        showNotification(`Добро пожаловать, ${name}! Вам начислено 100 приветственных бонусов`, 'success');
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        currentUser = null;
        saveCurrentUser();
        updateAuthUI();
        bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
        updateCartUI();
        showNotification('Вы вышли из аккаунта', 'info');
    });

    // ---------- СТАРТ ----------
    loadMenu();
    updateCartUI();
    updateAuthUI();
    updateNotificationsDropdown();
})();