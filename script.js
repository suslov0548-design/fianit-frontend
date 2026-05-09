// Глобальные переменные
let lastMenuItems = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Загрузка меню с сервера
async function fetchMenu(category = 'all') {
  const url = category === 'all'
    ? 'https://fianit-backend.onrender.com/api/menu'
    : `https://fianit-backend.onrender.com/api/menu?category=${category}`;
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// Рендер меню
async function renderMenu(category) {
  const container = document.getElementById('dishes-container');
  if (!container) return;
  const items = await fetchMenu(category);
  lastMenuItems = items;
  container.innerHTML = items.map(item => `
    <div class="dish-card">
      <img src="${item.imageUrl}" alt="${item.name}">
      <div class="dish-info">
        <h4>${item.name}</h4>
        <div class="price">${item.price} ₽</div>
        <button class="btn-add" onclick="addToCart(${item.id})">В корзину</button>
      </div>
    </div>
  `).join('');
}

// Фильтрация по категориям
function filterCategory(cat) {
  renderMenu(cat);
}

// Добавление в корзину
function addToCart(id) {
  const item = lastMenuItems.find(d => d.id === id);
  if (!item) return;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      quantity: 1
    });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartIcon();
}

// Обновление значка корзины
function updateCartIcon() {
  const count = cart.reduce((sum, c) => sum + c.quantity, 0);
  const countElem = document.getElementById('cart-count');
  if (countElem) countElem.textContent = count;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dishes-container')) {
    renderMenu('all');
  }
  updateCartIcon();
});