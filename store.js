// ── State ──
let products = [];
let buyers   = [];
let cart = [];
let activeFilter = '';

const fmt = p => '₱' + parseFloat(p||0).toLocaleString('en-PH',{minimumFractionDigits:2});

const apiBase = 'https://chronovault-store.vercel.app';

// ── Load products from API (persists across sessions) ──
async function loadProducts() {
  try {
    const res = await fetch(apiBase + '/api/watches');
    products = await res.json();
  } catch (e) {
    // Fallback to localStorage if server is not available
    products = JSON.parse(localStorage.getItem('cv_watches') || '[]');
  }
  renderGrid();
  updateCartUI();
}

// ── Filter ──
function setFilter(cat, btn) {
  activeFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGrid();
}

// ── Render Grid ──
function renderGrid() {
  const q = (document.getElementById('storeSearch').value||'').toLowerCase();
  let available = products.filter(p => {
    const matchQty = parseInt(p.qty||0) > 0;
    
    let matchCat = true;
    if (activeFilter === 'Men') {
      matchCat = p.gender === "Men's";
    } else if (activeFilter === 'Women') {
      matchCat = p.gender === "Women's";
    } else if (activeFilter && activeFilter !== 'Best Deals' && activeFilter !== 'Most Expensive') {
      matchCat = p.category === activeFilter;
    }

    const matchQ   = !q || (p.name||'').toLowerCase().includes(q) ||
                     (p.category||'').toLowerCase().includes(q) ||
                     (p.ref||'').toLowerCase().includes(q);
    return matchQty && matchCat && matchQ;
  });

  if (activeFilter === 'Best Deals') {
    available.sort((a,b) => (parseFloat(a.price)||0) - (parseFloat(b.price)||0));
  } else if (activeFilter === 'Most Expensive') {
    available.sort((a,b) => (parseFloat(b.price)||0) - (parseFloat(a.price)||0));
  }

  const grid = document.getElementById('productGrid');
  if (!available.length) {
    grid.innerHTML = '<p class="empty-msg">No watches available for this filter.</p>';
    return;
  }
  grid.innerHTML = available.map(p => {
    let mainMedia = '<div class="card-placeholder">⌚</div>';
    if (p.media && p.media.length > 0) {
      if (p.media[0].type === 'video') mainMedia = `<video src="${p.media[0].data}" class="card-img" autoplay muted loop playsinline></video>`;
      else mainMedia = `<img src="${p.media[0].data}" class="card-img" alt="${p.name}">`;
    } else if (p.image) {
      mainMedia = `<img src="${p.image}" class="card-img" alt="${p.name}">`;
    }

    return `
    <div class="card" onclick="openProductDetail('${p.id}')">
      <div class="badge-stock">${p.qty} In Stock</div>
      <div class="card-img-wrap">
        ${mainMedia}
        <div class="card-overlay">
          <button class="overlay-view-btn" onclick="event.stopPropagation();openProductDetail('${p.id}')">👁 View Details</button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-cat">${p.category||'Rolex'} ${p.gender ? '· '+p.gender : ''}</div>
        <div class="card-title">${p.name}</div>
        <div class="card-ref">${p.ref ? 'Ref. '+p.ref : '&nbsp;'}</div>
        ${p.caseMat ? `<div class="card-meta">${p.caseMat}${p.caseSize?' · '+p.caseSize+'mm':''}</div>` : ''}
        <div class="card-price">${fmt(p.price||0)}</div>
        <div class="card-actions">
          <button class="btn-add" onclick="event.stopPropagation();addToCart('${p.id}')">Add to Cart</button>
          <button class="btn-buy" onclick="event.stopPropagation();buyNow('${p.id}')">Buy Now</button>
        </div>
      </div>
    </div>
  `}).join('');
}

// ── Product Detail Modal ──
function openProductDetail(id) {
  const p = products.find(x => x.id===id);
  if (!p) return;
  const specs = [
    ['Collection', p.category], ['Gender', p.gender], ['Reference No.', p.ref],
    ['Case Size',  p.caseSize ? p.caseSize+'mm' : ''],
    ['Case Material', p.caseMat], ['Bracelet / Strap', p.bracelet],
    ['Dial Color', p.dial], ['Movement', p.movement],
    ['Condition',  p.condition], ['SKU / Serial', p.sku],
    ['Stock', p.qty+' pcs available']
  ].filter(r=>r[1]);

  let mediaHtml = '<div class="pd-img-placeholder">⌚</div>';
  if (p.media && p.media.length > 0) {
    mediaHtml = `<div class="pd-media-gallery" style="display:flex;flex-direction:column;gap:1rem;">` + 
      p.media.map(m => m.type === 'video' 
        ? `<video src="${m.data}" class="pd-img" style="border-radius:14px;width:100%;object-fit:cover;" autoplay muted controls loop playsinline></video>`
        : `<img src="${m.data}" class="pd-img" style="border-radius:14px;width:100%;object-fit:cover;" alt="${p.name}">`
      ).join('') + `</div>`;
  } else if (p.image) {
    mediaHtml = `<img src="${p.image}" class="pd-img" alt="${p.name}">`;
  }

  document.getElementById('productDetailBody').innerHTML = `
    <div class="pd-layout">
      <div class="pd-left">
        ${mediaHtml}
      </div>
      <div class="pd-right">
        <div class="pd-cat">${p.category||'Rolex'}</div>
        <h2 class="pd-name">${p.name}</h2>
        ${p.ref ? `<div class="pd-ref">Ref. ${p.ref}</div>` : ''}
        <div class="pd-price">${fmt(p.price)}</div>
        <div class="pd-specs">
          ${specs.map(r=>`
            <div class="pd-spec-row">
              <span class="pd-spec-label">${r[0]}</span>
              <span class="pd-spec-value">${r[1]}</span>
            </div>`).join('')}
        </div>
        ${p.desc ? `<div class="pd-desc">${p.desc}</div>` : ''}
        <div class="pd-actions">
          <button class="pd-btn-cart" onclick="addToCart('${p.id}');closeProductDetail()">🛒 Add to Cart</button>
          <button class="pd-btn-buy"  onclick="buyNow('${p.id}');closeProductDetail()">⚡ Buy Now</button>
        </div>
      </div>
    </div>`;

  document.getElementById('productDetailOverlay').classList.add('open');
}
function closeProductDetail() { document.getElementById('productDetailOverlay').classList.remove('open'); }

// ── Cart ──
function addToCart(id) {
  const product = products.find(p=>p.id===id);
  if (!product) return;
  const existing = cart.find(item=>item.id===id);
  if (existing) {
    if (existing.cartQty >= product.qty) { showToast('Maximum stock reached.'); return; }
    existing.cartQty++;
  } else {
    cart.push({...product, cartQty:1});
  }
  updateCartUI(); showToast('✓ Added to cart!');
}

function buyNow(id) {
  cart = [];
  const product = products.find(p=>p.id===id);
  if (product) { cart.push({...product, cartQty:1}); updateCartUI(); openCheckout(); }
}

function removeFromCart(id) { cart = cart.filter(item=>item.id!==id); updateCartUI(); }

function updateItemQty(id, delta) {
  const item = cart.find(x=>x.id===id);
  if (!item) return;
  const product = products.find(p=>p.id===id);
  const newQty = item.cartQty + delta;
  if (newQty > (product?.qty||0)) { showToast('Maximum stock reached.'); return; }
  if (newQty <= 0) { removeFromCart(id); } else { item.cartQty = newQty; updateCartUI(); }
}

function updateCartUI() {
  const totalCount = cart.reduce((s,i)=>s+i.cartQty,0);
  document.getElementById('cartCount').textContent = totalCount;
  const itemsEl = document.getElementById('cartItems');
  if (!cart.length) {
    itemsEl.innerHTML = '<p style="color:var(--muted);text-align:center;margin-top:2rem">Your cart is empty.</p>';
    document.getElementById('cartTotalVal').textContent = '₱0.00';
    return;
  }
  itemsEl.innerHTML = cart.map(item=>`
    <div class="cart-item">
      ${item.image ? `<img src="${item.image}" class="cart-item-img">` : `<div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem">⌚</div>`}
      <div class="cart-item-details">
        <div class="cart-item-title">${item.name}</div>
        <div class="cart-item-price">${fmt(item.price)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateItemQty('${item.id}',-1)">−</button>
          <span class="qty-val">${item.cartQty}</span>
          <button class="qty-btn" onclick="updateItemQty('${item.id}',1)">+</button>
          <button class="qty-btn" onclick="removeFromCart('${item.id}')" style="margin-left:.25rem;color:#fca5a5">✕</button>
        </div>
      </div>
    </div>`).join('');
  const total = cart.reduce((s,i)=>s+((i.price||0)*i.cartQty),0);
  document.getElementById('cartTotalVal').textContent = fmt(total);
}

function openCart()  { document.getElementById('cartOverlay').classList.add('open'); }
function closeCart() { document.getElementById('cartOverlay').classList.remove('open'); }

function openCheckout() {
  if (!cart.length) { showToast('Cart is empty!'); return; }
  closeCart();
  const summary = document.getElementById('checkoutSummary');
  summary.innerHTML = cart.map(item=>`
    <div class="checkout-summary-item">
      ${item.image ? `<img src="${item.image}" class="cs-img">` : `<div class="cs-img" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem">⌚</div>`}
      <div class="cs-details">
        <div class="cs-title">${item.name} <span style="color:var(--em4)">x${item.cartQty}</span></div>
        <div class="cs-ref">${item.ref ? 'Ref. '+item.ref : ''}</div>
      </div>
      <div class="cs-price">${fmt(item.price*item.cartQty)}</div>
    </div>`).join('');
  document.getElementById('checkoutOverlay').classList.add('open');
}
function closeCheckout() { document.getElementById('checkoutOverlay').classList.remove('open'); }

// ── Checkout — writes back to API so data persists ──
async function processCheckout(e) {
  e.preventDefault();
  const buyerName    = document.getElementById('cName').value.trim();
  const buyerEmail   = document.getElementById('cEmail').value.trim();
  const buyerContact = document.getElementById('cPhone').value.trim();
  const buyerAddr    = document.getElementById('cAddress').value.trim();
  const saleDate     = new Date().toISOString().split('T')[0];

  // Re-fetch latest data from server to avoid stale stock
  try {
    const [watchRes, buyerRes] = await Promise.all([
      fetch(apiBase + '/api/watches'),
      fetch(apiBase + '/api/buyers')
    ]);
    products = await watchRes.json();
    buyers   = await buyerRes.json();
  } catch (err) {
    // fallback: use current in-memory state
  }

  // Validate stock
  for (let item of cart) {
    const p = products.find(x=>x.id===item.id);
    if (!p || p.qty < item.cartQty) { showToast(`Sorry, ${item.name} is out of stock.`); return; }
  }

  // Build new buyer records
  cart.forEach(item => {
    for (let i=0;i<item.cartQty;i++) {
      buyers.push({
        id: Date.now().toString()+Math.random().toString(36).substr(2,5),
        buyerName,buyerContact,buyerEmail,buyerAddr,
        watchId:item.id,watchName:item.name,watchRef:item.ref,
        salePrice:item.price,saleDate,payStatus:'Paid',
        notes:'Order placed via Storefront.'
      });
    }
    const p = products.find(x=>x.id===item.id);
    if (p) p.qty -= item.cartQty;
  });

  // Persist everything back to server
  try {
    await fetch(apiBase + '/api/checkout', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ newBuyers: buyers, newWatches: products })
    });
  } catch (err) {
    // Fallback to localStorage if server is unavailable
    localStorage.setItem('cv_buyers',  JSON.stringify(buyers));
    localStorage.setItem('cv_watches', JSON.stringify(products));
  }

  cart=[]; updateCartUI(); renderGrid(); closeCheckout();
  document.getElementById('checkoutForm').reset();
  showToast('✓ Order placed! We will contact you soon.');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

// Close overlays on backdrop click
document.getElementById('cartOverlay').addEventListener('click', function(e){ if(e.target===this) closeCart(); });
document.getElementById('checkoutOverlay').addEventListener('click', function(e){ if(e.target===this) closeCheckout(); });
document.getElementById('productDetailOverlay').addEventListener('click', function(e){ if(e.target===this) closeProductDetail(); });

// Init — load from API
loadProducts();
