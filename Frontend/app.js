// ─── STATE ─────────────────────────────────────
let allProducts = [];
let currentCategory = null;
let cartItems = [];
let wishlist = JSON.parse(localStorage.getItem('techstore_wish')) || [];

// ─── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  
  // Checkout listeners
  ['coName', 'coLastname'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateCheckoutSummary);
  });
  document.querySelectorAll('input[name="delivery"], input[name="payment"]').forEach(radio => {
      radio.addEventListener('change', updateCheckoutSummary);
  });
  const coAgree = document.getElementById('coAgree');
  if (coAgree) coAgree.addEventListener('change', validateCheckout);
});

// ─── PAGE NAVIGATION ───────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setCategory(cat, tabEl) {
  currentCategory = cat;
  if (tabEl) {
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
  }
  applyFilters();
}

// ─── DATA LOADING ──────────────────────────────
async function loadProducts() {
  try {
    const res = await fetch('http://localhost:1337/api/products?populate=*');
    if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
    const raw = (await res.json()).data;

    // Add dummy features/tags based on category for AI
    allProducts = raw.map(p => ({
      ...p,
      price: parseFloat(p.price) || 0,
      old_price: parseFloat(p.old_price) || null,
      tags: [],
      budget: p.price < 35000 ? [0] : p.price < 70000 ? [1] : p.price < 130000 ? [2] : [3],
      os: p.brand === 'Apple' ? ['apple'] : ['android'],
      purpose: p.category === 'Ноутбуки' ? ['work'] : p.category === 'Планшеты' ? ['creative', 'media'] : ['media'],
      features: p.category === 'Планшеты' ? ['stylus', 'battery'] : ['battery'],
      e: p.category === 'Ноутбуки' ? '💻' : p.category === 'Планшеты' ? '📱' : p.category === 'Наушники' ? '🎧' : p.category === 'Мониторы' ? '🖥️' : '🖱️'
    }));

    populateBrands();
    applyFilters();
    populateHomePage();
  } catch (error) {
    console.error("Ошибка загрузки:", error);
  }
}

function populateHomePage() {
  // Update category counts
  const counts = {};
  allProducts.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const map = {
    'cnt-laptops': 'Ноутбуки', 'cnt-tablets': 'Планшеты',
    'cnt-headphones': 'Наушники', 'cnt-monitors': 'Мониторы', 'cnt-accessories': 'Аксессуары'
  };
  Object.entries(map).forEach(([id, cat]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${counts[cat] || 0} товаров`;
  });

  // Render top 4 products as bestsellers
  const homeGrid = document.getElementById('homeGrid');
  if (!homeGrid) return;
  const top4 = allProducts.slice(0, 4);
  homeGrid.innerHTML = top4.map((p, i) => {
    const isWished = wishlist.includes(p.id);
    return `
        <div class="product-card" style="animation-delay:${i * 0.05}s">
            <div class="card-img-wrap">
                <div class="wishlist-btn ${isWished ? 'on' : ''}" onclick="toggleWish(${p.id}, this)">${isWished ? '♥' : '♡'}</div>
                ${p.image ? `<img src="${p.image}" style="width:130px;height:130px;object-fit:contain;filter:drop-shadow(0 10px 30px rgba(0,0,0,.5));transition:transform .3s">` : `<div style="font-size:64px">${p.e}</div>`}
            </div>
            <div class="card-body">
                <div class="card-brand-row"><span class="card-brand">${p.brand || ''}</span><span class="card-sep">·</span><span class="card-cat">${p.category || ''}</span></div>
                <h3 class="card-name">${p.name}</h3>
                <div class="card-rating"><span class="stars">★★★★☆</span><span class="rv">4.5</span></div>
                <div class="card-footer">
                    <div class="card-prices">
                        <span class="price-main">${p.price.toLocaleString('ru-RU')} с.</span>
                    </div>
                    <button class="add-btn" onclick="addCart(${p.id}, this)">+</button>
                </div>
            </div>
        </div>`;
  }).join('');
}

function populateBrands() {
  const brands = [...new Set(allProducts.map(p => p.brand).filter(Boolean))];
  const container = document.getElementById('brandFilters');
  container.innerHTML = '<p class="filter-label">Бренд</p>' + brands.map(b => `
        <label class="check-item">
            <input type="checkbox" value="${b}" class="brand-filter-cb" onchange="applyFilters()">
            <div class="check-box"></div>
            <span class="check-name">${b}</span>
        </label>
    `).join('');
}

// ─── FILTERS & SEARCH ─────────────────────────
function updatePrice(v) {
  document.getElementById('priceVal').textContent = parseInt(v).toLocaleString('ru-RU');
  document.getElementById('rangeFill').style.width = (v / 300000 * 100) + '%';
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('priceFilter').value = 300000;
  updatePrice(300000);
  document.querySelectorAll('.brand-filter-cb').forEach(cb => cb.checked = false);
  document.getElementById('sortSelect').value = 'default';
  currentCategory = null;
  document.querySelectorAll('.cat-tab').forEach((t, i) => {
    if (i === 0) t.classList.add('active'); else t.classList.remove('active');
  });
  applyFilters();
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const maxPrice = parseInt(document.getElementById('priceFilter').value);
  const selectedBrands = Array.from(document.querySelectorAll('.brand-filter-cb:checked')).map(cb => cb.value);
  const sort = document.getElementById('sortSelect').value;

  let filtered = allProducts.filter(p => {
    const matchCat = !currentCategory || p.category === currentCategory;
    const matchSearch = p.name.toLowerCase().includes(search) || (p.brand && p.brand.toLowerCase().includes(search));
    const matchPrice = p.price <= maxPrice;
    const matchBrand = selectedBrands.length === 0 || selectedBrands.includes(p.brand);
    return matchCat && matchSearch && matchPrice && matchBrand;
  });

  if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);

  document.getElementById('resultsCount').innerHTML = `Найдено: <strong>${filtered.length} товаров</strong>`;
  renderGrid(filtered);
}

function renderGrid(items) {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = items.map((p, i) => {
    const isWished = wishlist.includes(p.id);
    return `
        <div class="product-card" style="animation-delay:${(i % 4) * 0.05}s">
            <div class="card-img-wrap">
                <div class="wishlist-btn ${isWished ? 'on' : ''}" onclick="toggleWish(${p.id}, this)">${isWished ? '♥' : '♡'}</div>
                ${p.image ? `<img src="${p.image}" style="width:130px;height:130px;object-fit:contain;filter:drop-shadow(0 10px 30px rgba(0,0,0,.5));transition:transform .3s" class="tab-svg">` : `<div style="font-size:64px" class="tab-svg">${p.e}</div>`}
            </div>
            <div class="card-body">
                <div class="card-brand-row"><span class="card-brand">${p.brand || 'TechStore'}</span><span class="card-sep">·</span><span class="card-cat">${p.category || ''}</span></div>
                <h3 class="card-name">${p.name}</h3>
                <div class="card-rating"><span class="stars">★★★★☆</span><span class="rv">4.5</span></div>
                <div class="card-footer">
                    <div class="card-prices">
                        <span class="price-main">${p.price.toLocaleString('ru-RU')} с.</span>
                    </div>
                    <button class="add-btn" onclick="addCart(${p.id}, this)">+</button>
                </div>
            </div>
        </div>
        `;
  }).join('');
}

// ─── CART LOGIC ──────────────────────────────
let cartOpen = false;

function toggleCart() {
  cartOpen = !cartOpen;
  document.getElementById('cartDrawer').classList.toggle('open', cartOpen);
  document.getElementById('cartOverlayBg').classList.toggle('open', cartOpen);
}

function addCart(id, btn) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  const existing = cartItems.find(x => x.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cartItems.push({ ...p, qty: 1, selected: true });
  }
  if (btn) {
    btn.textContent = '✓';
    btn.style.background = 'var(--lime)';
    btn.style.color = '#000';
    setTimeout(() => { btn.textContent = '+'; btn.style.background = ''; btn.style.color = ''; }, 900);
  }
  renderCartDrawer();
  // Open cart briefly to show it was added
  if (!cartOpen) toggleCart();
}

function updateQty(id, delta) {
  const item = cartItems.find(x => x.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cartItems = cartItems.filter(x => x.id !== id);
  renderCartDrawer();
}

function removeFromCart(id) {
  cartItems = cartItems.filter(x => x.id !== id);
  renderCartDrawer();
}

function toggleSelectAll(cb) {
  cartItems.forEach(x => x.selected = cb.checked);
  renderCartDrawer();
}

function deleteSelected() {
  cartItems = cartItems.filter(x => !x.selected);
  renderCartDrawer();
}

function renderCartDrawer() {
  const list = document.getElementById('cartItemsList');
  const footer = document.getElementById('cartDrawerFooter');
  const controls = document.querySelector('.cart-controls');
  const badge = document.getElementById('cartBadge');
  const drawerCount = document.getElementById('cartDrawerCount');
  const summaryCount = document.getElementById('cartSummaryCount');
  const summaryPrice = document.getElementById('cartSummaryPrice');

  const totalQty = cartItems.reduce((s, x) => s + x.qty, 0);
  const totalPrice = cartItems.reduce((s, x) => s + x.price * x.qty, 0);

  // Badge in nav
  badge.textContent = totalQty;
  badge.style.display = totalQty > 0 ? 'grid' : 'none';

  // Count label
  const plural = (n) => n === 1 ? 'товар' : n < 5 ? 'товара' : 'товаров';
  drawerCount.textContent = `${totalQty} ${plural(totalQty)}`;
  summaryCount.textContent = `${totalQty} ${plural(totalQty)}`;
  summaryPrice.textContent = `${totalPrice.toLocaleString('ru-RU')} с.`;

  if (cartItems.length === 0) {
    list.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">🛒</div>
        <div class="cart-empty-text">Корзина пуста</div>
        <button class="cart-empty-btn" onclick="toggleCart(); showPage('catalog')">Перейти в каталог</button>
      </div>`;
    footer.style.display = 'none';
    controls.style.display = 'none';
    document.getElementById('selectAll').checked = false;
    return;
  }

  footer.style.display = 'block';
  controls.style.display = 'flex';

  const allSelected = cartItems.every(x => x.selected);
  document.getElementById('selectAll').checked = allSelected;

  list.innerHTML = cartItems.map(item => `
        <div class="cart-item-row">
            <label class="ci-cb">
                <input type="checkbox" ${item.selected ? 'checked' : ''}
                    onchange="cartItems.find(x=>x.id===${item.id}).selected=this.checked; renderCartDrawer();">
                <div class="ci-cbbox"></div>
            </label>
            <div class="ci-img">${item.image ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:contain">` : item.e}</div>
            <div class="ci-info">
                <div class="ci-name">${item.name}</div>
                <div class="ci-brand">${item.brand || 'TechStore'} · ${item.category || ''}</div>
                <div class="ci-bottom">
                    <div class="qty-ctrl">
                        <button onclick="updateQty(${item.id}, -1)">−</button>
                        <span class="qty-num">${item.qty}</span>
                        <button onclick="updateQty(${item.id}, 1)">+</button>
                    </div>
                    <span class="ci-unit-price">${item.price.toLocaleString('ru-RU')} с./шт.</span>
                </div>
            </div>
            <div class="ci-right">
                <div class="ci-price">${(item.price * item.qty).toLocaleString('ru-RU')} с.</div>
                <div class="ci-actions">
                    <button class="ci-action-btn" title="В избранное" onclick="toggleWish(${item.id}, this)">♡</button>
                    <button class="ci-action-btn delete" title="Удалить" onclick="removeFromCart(${item.id})">🗑</button>
                </div>
            </div>
        </div>
    `).join('');
}


function toggleWish(id, btn) {
  const idx = wishlist.indexOf(id);
  if (idx === -1) {
    wishlist.push(id);
    btn.classList.add('on');
    btn.textContent = '♥';
  } else {
    wishlist.splice(idx, 1);
    btn.classList.remove('on');
    btn.textContent = '♡';
  }
  localStorage.setItem('techstore_wish', JSON.stringify(wishlist));
}

// ─── AI CHAT (DYNAMIC LOGIC) ────────────────
let userAnswers = {};
let currentStepIdx = 0;
let panelOpen = false;
let chatStarted = false;

function getNextQuestion(ans) {
  if (!ans.purpose) {
    return { id: 'purpose', q: 'Для чего вам устройство?', sub: 'Выберите один вариант', opts: [ { id: 'work', e: '💼', l: 'Работа', s: '' }, { id: 'study', e: '🎓', l: 'Учёба', s: '' }, { id: 'games', e: '🎮', l: 'Игры', s: '' }, { id: 'mixed', e: '⚡', l: 'Универсально', s: '' } ] };
  }
  if (!ans.details && ans.purpose !== 'mixed') {
    if (ans.purpose === 'work') return { id: 'details', q: 'Уточните задачи для работы', sub: 'Выберите один вариант', opts: [ { id: 'office', e: '📝', l: 'Офис', s: 'Word, Excel' }, { id: 'code', e: '💻', l: 'Программирование', s: '' }, { id: 'design', e: '🎨', l: 'Дизайн', s: 'Figma, Photoshop' } ] };
    if (ans.purpose === 'study') return { id: 'details', q: 'Специфика учёбы', sub: 'Выберите один вариант', opts: [ { id: 'online', e: '📹', l: 'Онлайн-занятия', s: '' }, { id: 'basic', e: '📚', l: 'Базовые задачи', s: 'Конспекты' } ] };
    if (ans.purpose === 'games') return { id: 'details', q: 'В какие игры играете?', sub: 'Выберите один вариант', opts: [ { id: 'light', e: '🕹️', l: 'Лёгкие', s: 'CS, Dota' }, { id: 'medium', e: '⚔️', l: 'Средние', s: '' }, { id: 'heavy', e: '🔥', l: 'Тяжёлые (AAA)', s: '' } ] };
  }
  if (!ans.budget) return { id: 'budget', q: 'Какой у вас бюджет?', sub: 'Выберите один вариант', opts: [ { id: 'low', e: '💵', l: 'До $500', s: 'До 50 000 с.' }, { id: 'mid', e: '💰', l: '$500–1000', s: '50к — 100 000 с.' }, { id: 'high', e: '💎', l: '$1000+', s: 'От 100 000 с.' } ] };
  if (!ans.priority) return { id: 'priority', q: 'Что для вас важнее всего?', sub: 'Выберите один вариант', opts: [ { id: 'perf', e: '🚀', l: 'Производительность', s: '' }, { id: 'price', e: '🏷️', l: 'Цена', s: '' }, { id: 'battery', e: '🔋', l: 'Батарея', s: '' }, { id: 'weight', e: '🪶', l: 'Лёгкость', s: '' } ] };
  if (!ans.size) return { id: 'size', q: 'Какой формат вам удобен?', sub: 'Выберите один вариант', opts: [ { id: 'compact', e: '📱', l: 'Компактный', s: '13–14″' }, { id: 'std', e: '💻', l: 'Стандартный', s: '15–16″' }, { id: 'large', e: '🖥️', l: 'Большой', s: '17″+' } ] };
  if (!ans.os && ans.budget === 'high') return { id: 'os', q: 'Предпочитаемая система?', sub: 'Выберите один вариант', opts: [ { id: 'win', e: '🪟', l: 'Windows', s: '' }, { id: 'mac', e: '🍎', l: 'macOS', s: '' }, { id: 'any', e: '🤷', l: 'Без разницы', s: '' } ] };
  return null;
}

function openChat() {
  document.getElementById('chatOverlay').classList.add('open');
  document.getElementById('chatPanel').classList.add('open');
  panelOpen = true;
  if (!chatStarted) { chatStarted = true; userAnswers = {}; currentStepIdx = 0; startChat(); }
}
function closeChat() {
  document.getElementById('chatOverlay').classList.remove('open');
  document.getElementById('chatPanel').classList.remove('open');
  panelOpen = false;
}
function overlayClick(e) { if (e.target.id === 'chatOverlay') closeChat(); }

const body = () => document.getElementById('chatBody');

function appendMsg(html, isUser = false, delay = 0) {
  return new Promise(res => setTimeout(() => {
    const d = document.createElement('div');
    d.className = 'msg ' + (isUser ? 'user' : 'ai');
    d.innerHTML = `<div class="msg-av">${isUser ? '👤' : '✦'}</div><div class="msg-bubble">${html}</div>`;
    body().appendChild(d);
    body().scrollTop = 9999;
    res();
  }, delay));
}

function typing(ms = 800) {
  return new Promise(res => {
    const d = document.createElement('div');
    d.className = 'msg ai'; d.id = '_typing';
    d.innerHTML = `<div class="msg-av">✦</div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    body().appendChild(d);
    body().scrollTop = 9999;
    setTimeout(() => { d.remove(); res(); }, ms);
  });
}

function setProgress(step, total = 5) {
  const pct = step === 0 ? 0 : Math.min(100, Math.round((step / total) * 100));
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent = pct + '%';
}

async function startChat() {
  await appendMsg('Привет! 👋 Я <strong>AI-помощник TechStore</strong>.', false, 200);
  await typing(700);
  await appendMsg('Помогу выбрать устройство под ваши задачи. Начнём?', false);

  const wrap = document.createElement('div');
  wrap.innerHTML = `<button class="start-btn" onclick="this.parentElement.remove();startQuiz()">🚀 Начать подбор</button>`;
  body().appendChild(wrap);
  body().scrollTop = 9999;
}

async function startQuiz() {
  await appendMsg('Отлично! 🎯', true);
  await typing(500);
  showNextQuestion();
}

function showNextQuestion() {
  const q = getNextQuestion(userAnswers);
  if (!q) { askFinalQuestion(); return; }

  let totalSteps = 5;
  if (userAnswers.purpose === 'mixed') totalSteps -= 1;
  if (userAnswers.budget === 'high') totalSteps += 1;
  setProgress(Math.min(currentStepIdx + 1, totalSteps), totalSteps);

  const block = document.createElement('div');
  block.className = 'q-block';
  block.dataset.idx = currentStepIdx;
  block.dataset.qid = q.id;

  block.innerHTML = `
    <div class="q-num">Вопрос ${currentStepIdx + 1}</div>
    <div class="q-title">${q.q}</div>
    <div class="q-sub">${q.sub}</div>
    <div class="q-options">
      ${q.opts.map((o, i) => `
        <label class="q-option" data-id="${o.id}" onclick="pick(this, ${currentStepIdx})">
          <div class="q-check"><div class="q-check-mark"></div></div>
          <span class="q-emoji">${o.e}</span>
          <span class="q-lbl">${o.l}<small>${o.s}</small></span>
        </label>
      `).join('')}
    </div>
    <button class="q-next" disabled id="qnext${currentStepIdx}" onclick="advance(${currentStepIdx})">Далее →</button>
  `;
  body().appendChild(block);
  body().scrollTop = 9999;
}

window.pick = function (el, qIdx) {
  const block = el.closest('.q-block');
  block.querySelectorAll('.q-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('qnext' + qIdx).disabled = false;
}

window.advance = async function (idx) {
  const block = document.querySelector(`[data-idx="${idx}"]`);
  const selOpt = block.querySelector('.q-option.selected');
  const optId = selOpt.dataset.id;
  const qId = block.dataset.qid;
  const lbl = selOpt.querySelector('.q-lbl').childNodes[0].nodeValue.trim();

  userAnswers[qId] = optId;

  block.querySelectorAll('.q-option').forEach(o => { o.style.pointerEvents = 'none'; if (!o.classList.contains('selected')) o.style.opacity = '0.35'; });
  block.querySelector('.q-next').remove();

  await appendMsg(lbl, true, 100);
  await typing(500);

  currentStepIdx++;
  showNextQuestion();
}

// ─── AI FINAL QUESTION + STRAPI SAVE ──────────
async function askFinalQuestion() {
  setProgress(100, 100);
  await typing(600);
  await appendMsg('Отлично! Почти готово 🎯', false);
  await typing(500);

  const block = document.createElement('div');
  block.className = 'q-block';
  block.dataset.idx = 99;
  block.dataset.qid = 'final';
  block.innerHTML = `
    <div class="q-num">Финальный вопрос</div>
    <div class="q-title">Что-то ещё желаете добавить к подбору?</div>
    <div class="q-sub">Есть ли особые пожелания?</div>
    <div class="q-options">
      <label class="q-option" data-id="yes" onclick="pick(this, 99)">
        <div class="q-check"><div class="q-check-mark"></div></div>
        <span class="q-emoji">✏️</span>
        <span class="q-lbl">Да, есть пожелания<small>Напишу сам</small></span>
      </label>
      <label class="q-option" data-id="no" onclick="pick(this, 99)">
        <div class="q-check"><div class="q-check-mark"></div></div>
        <span class="q-emoji">🚀</span>
        <span class="q-lbl">Нет, показывай результат<small>Всё ответил</small></span>
      </label>
    </div>
    <button class="q-next" disabled id="qnext99" onclick="handleFinalAnswer(this.closest('.q-block'))">Далее →</button>
  `;
  body().appendChild(block);
  body().scrollTop = 9999;
}

async function handleFinalAnswer(block) {
  const sel = block.querySelector('.q-option.selected');
  if (!sel) return;
  const choice = sel.dataset.id;

  block.querySelector('.q-next').remove();
  block.querySelectorAll('.q-option').forEach(o => {
    o.style.pointerEvents = 'none';
    if (!o.classList.contains('selected')) o.style.opacity = '0.35';
  });

  if (choice === 'yes') {
    await appendMsg('Да, есть пожелания', true, 100);
    await typing(400);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; gap:8px; margin:8px 0;';
    wrap.innerHTML = `
      <input id="extraWish" type="text" placeholder="Например: нужна подсветка клавиатуры..."
        style="flex:1; padding:10px 14px; border-radius:12px; border:1px solid var(--border);
               background:var(--surface2); color:var(--text); font-size:14px; outline:none;">
      <button onclick="submitWithExtra()"
        style="padding:10px 18px; background:var(--lime); color:#000; border:none;
               border-radius:12px; font-weight:600; cursor:pointer; white-space:nowrap;">→ Готово</button>
    `;
    body().appendChild(wrap);

    // Enter key support
    wrap.querySelector('#extraWish').addEventListener('keydown', e => {
      if (e.key === 'Enter') submitWithExtra();
    });

    body().scrollTop = 9999;
  } else {
    await appendMsg('Нет, показывай результат', true, 100);
    await saveSessionToStrapi('');
    await showResult();
  }
}

async function submitWithExtra() {
  const input = document.getElementById('extraWish');
  const extra = (input ? input.value.trim() : '') || '';
  userAnswers.extra = extra;

  // Remove input UI
  const wrap = input ? input.closest('div') : null;
  if (wrap) wrap.remove();

  await appendMsg(extra || 'Без дополнений', true, 100);
  await typing(600);
  await saveSessionToStrapi(extra);
  await showResult();
}

async function saveSessionToStrapi(extra) {
  try {
    const res = await fetch('http://localhost:1337/api/ai-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          purpose:  userAnswers.purpose  || '',
          details:  userAnswers.details  || '',
          budget:   userAnswers.budget   || '',
          priority: userAnswers.priority || '',
          size:     userAnswers.size     || '',
          os:       userAnswers.os       || '',
          extra:    extra || ''
        }
      })
    });
    if (!res.ok) console.warn('Strapi вернул ошибку:', res.status);
    else console.log('Сессия сохранена в Strapi ✓');
  } catch (e) {
    console.warn('Strapi недоступен, сессия не сохранена:', e.message);
  }
}

function scoreProducts() {
  const ans = userAnswers;
  return allProducts.map(p => {
    let s = 50;
    let notes = [];

    // Бюджет
    if (ans.budget === 'low') {
       if (p.price <= 60000) { s += 25; notes.push('Лучший вариант в бюджете'); }
       else s -= 30;
    } else if (ans.budget === 'mid') {
       if (p.price > 50000 && p.price <= 110000) { s += 25; notes.push('Идеально в бюджете'); }
       else if (p.price <= 50000) s += 10;
       else s -= 20;
    } else if (ans.budget === 'high') {
       if (p.price > 100000) { s += 25; notes.push('Бескомпромиссный выбор'); }
       else s += 5;
    }

    // Задачи (purpose / details)
    if (ans.purpose === 'games') {
       if (p.name.includes('ROG') || p.name.includes('Legion') || p.name.includes('Odyssey') || p.brand === 'ASUS') { s += 20; notes.push('Отлично подходит для игр'); }
       if (ans.details === 'heavy' && p.price > 100000) s += 10;
    }
    if (ans.details === 'design' || ans.purpose === 'work') {
       if (p.brand === 'Apple' || p.name.includes('Pro') || p.name.includes('Ultra')) { s += 20; notes.push('Хватает для дизайна и рендера'); }
    }
    if (ans.purpose === 'study' || ans.details === 'office') {
       if (p.price < 90000) s += 15;
       if (p.brand === 'Apple' || p.category === 'Планшеты') { s += 15; notes.push('Отличная батарея для учёбы'); }
    }

    // Приоритет
    if (ans.priority === 'perf' && p.price > 90000) s += 15;
    if (ans.priority === 'price' && p.price < 65000) s += 15;
    if (ans.priority === 'battery' && (p.brand === 'Apple' || p.category === 'Планшеты')) s += 15;
    if (ans.priority === 'weight' && (p.name.includes('Air') || p.category === 'Планшеты')) s += 15;

    // Размер
    if (ans.size === 'compact' && (p.name.includes('13') || p.name.includes('14') || p.category === 'Планшеты')) s += 15;
    if (ans.size === 'std' && (p.name.includes('15') || p.name.includes('16'))) s += 15;
    if (ans.size === 'large' && (p.name.includes('17') || p.category === 'Мониторы')) s += 15;

    // ОС
    if (ans.os === 'mac' && p.brand === 'Apple') s += 25;
    else if (ans.os === 'mac') s -= 30;
    if (ans.os === 'win' && p.brand !== 'Apple' && p.category === 'Ноутбуки') s += 25;
    else if (ans.os === 'win') s -= 30;

    return { ...p, score: Math.min(99, Math.max(10, s + Math.floor(Math.random() * 10))), note: notes[0] || 'Хороший баланс' };
  }).sort((a, b) => b.score - a.score);
}

async function showResult() {
  setProgress(100, 100);
  await appendMsg('Анализирую ваши ответы... ✦', false);
  await typing(1200);

  const ranked = scoreProducts();
  const top = ranked.slice(0, 4); // 3-5 моделей
  if (top.length === 0) return;
  const best = top[0];

  await appendMsg(`Вот лучшие варианты для вас! Топ-выбор: <strong>${best.brand} ${best.name}</strong> 🎯`, false);

  const cards = top.map((p, i) => `
    <div class="r-card" onclick="showPage('catalog'); document.getElementById('searchInput').value='${p.name}'; applyFilters(); closeChat();">
      <div class="r-img">${p.image ? `<img src="${p.image}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;">` : p.e}</div>
      <div class="r-info">
        <div class="r-brand">${p.brand}</div>
        <div class="r-name">${p.name}</div>
        <div class="match-row" style="margin-top:6px; align-items:center;">
            <span style="font-size:11px; font-weight:600; color:var(--text); opacity:0.8;">💡 ${p.note}</span>
            <span class="mpct" style="font-size:12px">${p.score}%</span>
        </div>
        <div class="match-bar" style="margin-top:4px"><div class="match-fill" style="width:${p.score}%"></div></div>
      </div>
      <div class="r-price">${p.price.toLocaleString('ru-RU')} с.</div>
    </div>
  `).join('');

  const rb = document.createElement('div');
  rb.className = 'result-block';
  rb.innerHTML = `
    <div class="result-header">
      <div class="result-icon">🎯</div>
      <div class="result-meta">
        <div class="r-label">ФИНАЛЬНЫЙ РЕЗУЛЬТАТ</div>
        <h3>Лучшие модели под ваши задачи</h3>
      </div>
    </div>
    <div class="r-cards">${cards}</div>
    <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="r-cta" style="flex:1; font-size:12px; padding:10px; margin-top:0;" onclick="closeChat()">Сравнить</button>
        <button class="r-cta" style="flex:1; font-size:12px; padding:10px; margin-top:0; background:var(--surface2); color:var(--text)" onclick="alert('Отправка запроса AI... (в разработке)')">Задать вопрос AI</button>
    </div>
  `;
  body().appendChild(rb);
  body().scrollTop = 9999;
}

// ─── CHECKOUT LOGIC ────────────────────────────

function openCheckout() {
  const selectedItems = cartItems.filter(x => x.selected);
  if (selectedItems.length === 0) {
    alert('Выберите товары для оформления заказа');
    return;
  }
  if (cartOpen) toggleCart();
  showPage('checkout');
  coStep(1); // Reset to step 1
  renderCheckout();
}

function renderCheckout() {
  const selectedItems = cartItems.filter(x => x.selected);
  const list = document.getElementById('coItemsList');
  
  if (selectedItems.length === 0) {
    list.innerHTML = '<p style="color:var(--muted)">Нет выбранных товаров.</p>';
    updateCheckoutSummary();
    return;
  }

  list.innerHTML = selectedItems.map(item => `
    <div class="co-item-row">
      <div class="co-item-img">${item.image ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:contain;border-radius:12px;">` : item.e}</div>
      <div class="co-item-info">
        <div class="co-item-name">${item.name}</div>
        <div class="co-item-meta">
          <span class="co-item-stock">В наличии</span>
          <span class="co-item-sku">Арт: ${item.id.toString().padStart(6, '0')}</span>
        </div>
        <div class="co-item-qty-row">
          <div class="co-qty-ctrl">
            <button onclick="updateCheckoutQty(${item.id}, -1)">−</button>
            <span class="co-qty-num">${item.qty}</span>
            <button onclick="updateCheckoutQty(${item.id}, 1)">+</button>
          </div>
          <span class="co-item-unit-price">${item.price.toLocaleString('ru-RU')} с./шт.</span>
        </div>
      </div>
      <div class="co-item-right">
        <div class="co-item-price">${(item.price * item.qty).toLocaleString('ru-RU')} с.</div>
        <button class="co-item-remove" onclick="removeCheckoutItem(${item.id})">✕</button>
      </div>
    </div>
  `).join('');

  updateCheckoutSummary();
}

function updateCheckoutQty(id, delta) {
  updateQty(id, delta);
  renderCheckout();
}

function removeCheckoutItem(id) {
  removeFromCart(id);
  
  // if no items left, might want to redirect back to catalog
  const selectedItems = cartItems.filter(x => x.selected);
  if (selectedItems.length === 0) {
      showPage('catalog');
  } else {
      renderCheckout();
  }
}

function updateCheckoutSummary() {
  const selectedItems = cartItems.filter(x => x.selected);
  
  const totalQty = selectedItems.reduce((s, x) => s + x.qty, 0);
  const totalSub = selectedItems.reduce((s, x) => s + x.price * x.qty, 0);
  
  document.getElementById('coSumQty').textContent = `${totalQty} шт.`;
  document.getElementById('coSumSubtotal').textContent = `${totalSub.toLocaleString('ru-RU')} с.`;
  
  // Update name if filled
  const nameEl = document.getElementById('coName');
  const lastnameEl = document.getElementById('coLastname');
  const name = (nameEl && nameEl.value) || (lastnameEl && lastnameEl.value) 
      ? `${nameEl.value} ${lastnameEl ? lastnameEl.value : ''}`.trim() 
      : '—';
  document.getElementById('coSumName').textContent = name;

  // Update delivery
  const delRadio = document.querySelector('input[name="delivery"]:checked');
  document.getElementById('coSumDelivery').textContent = delRadio && delRadio.value === 'courier' ? 'Курьерская доставка' : 'Самовывоз';
  
  // Show/Hide address field based on delivery
  const addressField = document.getElementById('coAddressField');
  if (addressField) {
      addressField.style.display = delRadio && delRadio.value === 'courier' ? 'flex' : 'none';
  }
  
  // Update payment
  const payRadio = document.querySelector('input[name="payment"]:checked');
  let payText = 'Банк. карта';
  if (payRadio) {
      if (payRadio.value === 'cash') payText = 'Наличными';
      if (payRadio.value === 'installment') payText = 'Рассрочка';
  }
  document.getElementById('coSumPayment').textContent = payText;
  
  document.getElementById('coSumTotal').textContent = `${totalSub.toLocaleString('ru-RU')} с.`;
  
  validateCheckout();
}

function coStep(stepNum) {
  for (let i = 1; i <= 4; i++) {
    const body = document.getElementById(`coStep${i}Body`);
    const num = document.getElementById(`coNum${i}`);
    const title = document.getElementById(`coTitle${i}`);
    
    if (body) {
      if (i === stepNum) {
          // Add a small delay for smooth opening
          body.style.display = 'block';
          body.style.animation = 'msgIn .3s ease both';
      } else {
          body.style.display = 'none';
      }
    }
    
    if (num) {
      num.classList.remove('active', 'done');
      if (i === stepNum) num.classList.add('active');
      else if (i < stepNum) num.classList.add('done');
    }
    
    if (title) {
      title.classList.remove('muted');
      if (i !== stepNum) title.classList.add('muted');
    }
  }
}

function validateCheckout() {
  const agree = document.getElementById('coAgree');
  const isAgreed = agree ? agree.checked : false;
  const selectedItems = cartItems.filter(x => x.selected);
  const btn = document.getElementById('coPlaceBtn');
  
  if (isAgreed && selectedItems.length > 0) {
    btn.classList.add('ready');
    btn.disabled = false;
  } else {
    btn.classList.remove('ready');
    btn.disabled = true;
  }
}

function placeOrder() {
  const btn = document.getElementById('coPlaceBtn');
  if (!btn.classList.contains('ready')) return;
  
  alert('Заказ успешно оформлен! Спасибо за покупку.');
  
  // clear from cart
  cartItems = cartItems.filter(x => !x.selected);
  renderCartDrawer();
  
  // redirect
  showPage('home');
}