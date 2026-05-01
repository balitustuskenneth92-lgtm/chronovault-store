// ── State ──
let products = [];
let buyers   = [];
let editingId = null;
let currentImageData = null;

const apiBase = 'https://chronovault-store.vercel.app';

// ── Load Data ──
async function loadData() {
    try {
        const watchRes = await fetch(apiBase + '/api/watches');
        products = await watchRes.json();
        const buyerRes = await fetch(apiBase + '/api/buyers');
        buyers = await buyerRes.json();

        // One-time migration: If API is empty but localStorage has data, migrate it!
        if (products.length === 0 && localStorage.getItem('cv_watches') && !localStorage.getItem('cv_migrated')) {
            products = JSON.parse(localStorage.getItem('cv_watches'));
            await fetch(apiBase + '/api/watches', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(products) });
            localStorage.setItem('cv_migrated', 'true');
        }
        if (buyers.length === 0 && localStorage.getItem('cv_buyers') && !localStorage.getItem('cv_migrated_buyers')) {
            buyers = JSON.parse(localStorage.getItem('cv_buyers'));
            await fetch(apiBase + '/api/buyers', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(buyers) });
            localStorage.setItem('cv_migrated_buyers', 'true');
        }

        renderTable(); updateStats(); renderBuyers(); updateBuyerStats();
    } catch (e) {
        console.error("Failed to load data from API. Using localStorage fallback.", e);
        products = JSON.parse(localStorage.getItem('cv_watches') || '[]');
        buyers = JSON.parse(localStorage.getItem('cv_buyers') || '[]');
        renderTable(); updateStats(); renderBuyers(); updateBuyerStats();
    }
}
loadData();

// ── Persist ──
async function save() { 
    try {
        await fetch(apiBase + '/api/watches', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(products) });
    } catch(e) {
        console.error("Failed to save to API", e);
    }
    localStorage.setItem('cv_watches', JSON.stringify(products)); 
    renderTable(); updateStats(); 
}
async function saveBuyers() { 
    try {
        await fetch(apiBase + '/api/buyers', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(buyers) });
    } catch(e) {
        console.error("Failed to save buyers to API", e);
    }
    localStorage.setItem('cv_buyers', JSON.stringify(buyers)); 
    renderBuyers(); updateBuyerStats(); 
}

// ── Helpers ──
const fmt = p => '₱' + parseFloat(p||0).toLocaleString('en-PH',{minimumFractionDigits:2});

function statusBadge(qty) {
  qty = parseInt(qty);
  if (qty <= 0) return '<span class="badge badge-out">Out of Stock</span>';
  if (qty <= 3) return '<span class="badge badge-low">Low Stock</span>';
  return '<span class="badge badge-in">In Stock</span>';
}

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => t.className = `toast toast-${type}`, 2800);
}

// ── Success Popup ──
function showSuccessPopup(title, subtitle, icon='✓') {
  document.getElementById('successPopupIcon').textContent = icon;
  document.getElementById('successPopupTitle').textContent = title;
  document.getElementById('successPopupSub').textContent = subtitle;
  const overlay = document.getElementById('successOverlay');
  overlay.classList.add('open');
  // Auto-close after 2.8s
  clearTimeout(overlay._autoClose);
  overlay._autoClose = setTimeout(() => overlay.classList.remove('open'), 2800);
}
function closeSuccessPopup() {
  document.getElementById('successOverlay').classList.remove('open');
}

// ── Section nav ──
function showSection(s, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  ['panelWatches','panelInventory','panelBuyers'].forEach(id =>
    document.getElementById(id).classList.remove('active'));
  const map = { products:'panelWatches', inventory:'panelInventory', buyers:'panelBuyers' };
  document.getElementById(map[s]).classList.add('active');
  const titles = { products:'Rolex Collection', inventory:'Inventory View', buyers:'Buyers & Sales' };
  document.getElementById('pageTitle').textContent = titles[s] || 'ChronoVault';
  const addBtn = document.getElementById('addWatchBtn');
  addBtn.style.display = s === 'buyers' ? 'none' : 'flex';
  if (s === 'buyers')    { renderBuyers(); updateBuyerStats(); }
  if (s === 'inventory') { renderInventoryGrid(); }
}

// ── Stats ──
function updateStats() {
  document.getElementById('statTotal').textContent = products.length;
  document.getElementById('statIn').textContent    = products.filter(p => p.qty > 3).length;
  document.getElementById('statLow').textContent   = products.filter(p => p.qty > 0 && p.qty <= 3).length;
  document.getElementById('statOut').textContent   = products.filter(p => p.qty <= 0).length;
  const totalValue = products.reduce((sum, p) => sum + ((parseFloat(p.price)||0) * (parseInt(p.qty)||0)), 0);
  document.getElementById('statValue').textContent = '₱' + totalValue.toLocaleString('en-PH', {minimumFractionDigits: 0, maximumFractionDigits: 0});
}

// ── Table render ──
function renderTable() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  const rows = products.filter(p =>
    (p.name||'').toLowerCase().includes(q) ||
    (p.category||'').toLowerCase().includes(q) ||
    (p.ref||'').toLowerCase().includes(q) ||
    (p.sku||'').toLowerCase().includes(q) ||
    (p.dial||'').toLowerCase().includes(q)
  );
  const tb = document.getElementById('productTable');
  if (!rows.length) {
    tb.innerHTML = '<tr class="empty-row"><td colspan="9">No watches found. Click <strong>Add Watch</strong> to get started.</td></tr>';
    return;
  }
  tb.innerHTML = rows.map((p,i) => {
    const thumb = p.image
      ? `<img src="${p.image}" class="watch-thumb" alt="${p.name}">`
      : `<div class="watch-thumb-placeholder">⌚</div>`;
    const caseInfo = [p.caseSize ? p.caseSize+'mm' : '', p.movement].filter(Boolean).join(' · ');
    return `<tr>
      <td style="color:var(--muted);font-size:.8rem">${i+1}</td>
      <td><div class="watch-name-cell">${thumb}<div>
        <strong>${p.name}</strong>
        ${p.dial ? `<br><span style="font-size:.72rem;color:var(--muted)">${p.dial} Dial</span>` : ''}
        ${p.sku  ? `<br><span style="font-size:.7rem;color:rgba(110,231,183,.4)">${p.sku}</span>` : ''}
      </div></div></td>
      <td><span style="color:#6ee7b7">${p.category||'—'}</span></td>
      <td><span style="font-family:monospace;font-size:.82rem;color:var(--go4)">${p.ref||'—'}</span></td>
      <td style="font-size:.8rem;color:var(--muted)">${caseInfo||'—'}</td>
      <td><strong>${p.qty}</strong></td>
      <td>${fmt(p.price)}</td>
      <td>${statusBadge(p.qty)}</td>
      <td style="display:flex;gap:.4rem;flex-wrap:wrap">
        <button class="btn btn-sm btn-stock" onclick="openStockModal('${p.id}')">📦 Stock</button>
        <button class="btn btn-sm btn-edit" onclick="editProduct('${p.id}')">✏ Edit</button>
        <button class="btn btn-sm btn-del"  onclick="deleteProduct('${p.id}')">🗑 Delete</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Inventory Grid ──
function renderInventoryGrid() {
  const q = (document.getElementById('invSearch').value || '').toLowerCase();
  const rows = products.filter(p =>
    (p.name||'').toLowerCase().includes(q) ||
    (p.category||'').toLowerCase().includes(q) ||
    (p.ref||'').toLowerCase().includes(q)
  );
  const grid = document.getElementById('invGrid');
  if (!rows.length) {
    grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:3rem">No watches found.</p>';
    return;
  }
  grid.innerHTML = rows.map(p => {
    const badgeCls = parseInt(p.qty)<=0 ? 'badge-out' : parseInt(p.qty)<=3 ? 'badge-low' : 'badge-in';
    const badgeTxt = parseInt(p.qty)<=0 ? 'Out' : parseInt(p.qty)<=3 ? 'Low' : 'In Stock';
    return `<div class="inv-card">
      <div class="inv-card-img">
        ${p.image ? `<img src="${p.image}" alt="${p.name}">` : '<div class="no-img">⌚</div>'}
        <span class="inv-card-badge badge ${badgeCls}">${badgeTxt}</span>
      </div>
      <div class="inv-card-body">
        <div class="inv-card-cat">${p.category||'Rolex'}</div>
        <div class="inv-card-name">${p.name}</div>
        <div class="inv-card-ref">${p.ref ? 'Ref. '+p.ref : '&nbsp;'}</div>
        <div class="inv-card-footer">
          <div class="inv-card-price">${fmt(p.price)}</div>
          <div class="inv-card-qty">Qty: ${p.qty}</div>
        </div>
      </div>
      <div class="inv-card-actions">
        <button class="btn btn-sm btn-stock" onclick="openStockModal('${p.id}')">📦</button>
        <button class="btn btn-sm btn-view-detail" onclick="openDetailModal('${p.id}')">👁 View</button>
        <button class="btn btn-sm btn-edit" onclick="editProduct('${p.id}')">✏ Edit</button>
        <button class="btn btn-sm btn-del"  onclick="deleteProduct('${p.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ── Detail Modal ──
function openDetailModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('detailTitle').textContent = p.name;
  const rows = [
    ['Collection', p.category], ['Reference', p.ref], ['Case Size', p.caseSize ? p.caseSize+'mm' : ''],
    ['Case Material', p.caseMat], ['Bracelet', p.bracelet], ['Dial Color', p.dial],
    ['Movement', p.movement], ['Condition', p.condition], ['SKU / Serial', p.sku],
    ['Quantity', p.qty], ['Price', fmt(p.price)]
  ].filter(r => r[1]).map(r =>
    `<div style="display:flex;justify-content:space-between;padding:.55rem 0;border-bottom:1px solid rgba(52,211,153,.08);font-size:.88rem">
      <span style="color:var(--muted)">${r[0]}</span>
      <span style="color:#fff;font-weight:600;text-align:right;max-width:60%">${r[1]}</span>
    </div>`
  ).join('');

  document.getElementById('detailBody').innerHTML = `
    ${p.image ? `<img src="${p.image}" style="width:100%;height:220px;object-fit:cover;border-radius:14px;margin-bottom:1.25rem;border:1px solid rgba(52,211,153,.2)">` : ''}
    <div style="margin-bottom:1rem">${rows}</div>
    ${p.desc ? `<div style="margin-top:1rem;padding:1rem;background:rgba(4,20,12,.6);border-radius:10px;border:1px solid var(--border);font-size:.84rem;color:var(--muted)">${p.desc}</div>` : ''}
    <div class="modal-footer" style="margin-top:1.25rem">
      <button class="btn-cancel" onclick="closeDetailModal()">Close</button>
      <button class="btn-save" onclick="editProduct('${p.id}');closeDetailModal()">✏ Edit Watch</button>
    </div>`;

  document.getElementById('detailOverlay').classList.add('open');
}
function closeDetailModal() { document.getElementById('detailOverlay').classList.remove('open'); }

// ── Add/Edit Modal ──
function openModal(title='Add Rolex Watch') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('productForm').reset();
  document.getElementById('editId').value = '';
  editingId = null;
  removeImage();
  resetScanUI();
}

// ── Image handling (photo-only upload) ──
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    currentImageData = ev.target.result;
    const preview = document.getElementById('imgPreview');
    preview.src = currentImageData;
    preview.classList.add('show');
    document.getElementById('removeImgBtn').classList.add('show');
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  currentImageData = null;
  const preview = document.getElementById('imgPreview');
  preview.src = ''; preview.classList.remove('show');
  document.getElementById('removeImgBtn').classList.remove('show');
  document.getElementById('fImage').value = '';
}

function resetScanUI() {
  document.getElementById('aiScanningBar').style.display  = 'none';
  document.getElementById('aiResultBanner').style.display = 'none';
  document.getElementById('aiScanInput').value = '';
}

// ── Dedicated AI Scan button handler ──
function handleAIScanUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const scanBar    = document.getElementById('aiScanningBar');
  const resultBar  = document.getElementById('aiResultBanner');
  const progressEl = document.getElementById('aiScanProgress');
  scanBar.style.display   = 'flex';
  resultBar.style.display = 'none';

  const reader = new FileReader();
  reader.onload = async ev => {
    currentImageData = ev.target.result;
    // Set photo preview
    const preview = document.getElementById('imgPreview');
    preview.src = currentImageData;
    preview.classList.add('show');
    document.getElementById('removeImgBtn').classList.add('show');

    const apiKey = localStorage.getItem('cv_gemini_key') || '';

    if (apiKey) {
      // ── REAL Gemini Vision AI scan ──
      progressEl.textContent = 'Sending image to Gemini AI…';
      try {
        const result = await scanWithGemini(currentImageData, apiKey, progressEl);
        scanBar.style.display   = 'none';
        resultBar.style.display = 'flex';
        document.getElementById('aiResultText').textContent =
          `✓ Gemini AI identified: ${result.name || 'Watch'} (confidence: ${result.confidence || 'high'}) — review fields below.`;
      } catch (err) {
        scanBar.style.display   = 'none';
        resultBar.style.display = 'flex';
        resultBar.style.borderColor = 'rgba(220,38,38,.3)';
        resultBar.style.background  = 'rgba(220,38,38,.1)';
        document.getElementById('aiResultText').style.color = '#fca5a5';
        document.getElementById('aiResultText').textContent =
          `⚠ Gemini error: ${err.message} — used filename fallback instead.`;
        runAIFallback(file.name); // still fill something
      }
    } else {
      // ── Filename-based fallback with staged animation ──
      const stages = ['Reading image metadata…','Identifying watch model…','Extracting specifications…','Filling form fields…'];
      let s = 0;
      const t = setInterval(() => { progressEl.textContent = stages[s++] || stages[stages.length-1]; }, 500);
      setTimeout(() => {
        clearInterval(t);
        const detected = runAIFallback(file.name);
        scanBar.style.display   = 'none';
        resultBar.style.display = 'flex';
        resultBar.style.borderColor = 'rgba(245,158,11,.3)';
        resultBar.style.background  = 'rgba(245,158,11,.08)';
        document.getElementById('aiResultText').style.color = 'var(--go4)';
        document.getElementById('aiResultText').textContent = detected
          ? `⚠ No API key — used filename match for: ${document.getElementById('fName').value}. Add Gemini key for accuracy.`
          : '⚠ No API key — default values applied. Add your Gemini API key in AI Settings for real detection.';
      }, 2200);
    }
  };
  reader.readAsDataURL(file);
}

// ── Gemini Vision API call ──
async function scanWithGemini(base64DataUrl, apiKey, progressEl) {
  progressEl.textContent = 'Finding best AI model…';

  // Fetch available models
  let modelName = 'models/gemini-2.5-flash'; // default fallback
  try {
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      const availableModels = modelsData.models || [];
      // Prefer newer flash models, fallback to pro, then whatever is available
      const preferred = availableModels.find(m => m.name.includes('gemini-3.1-flash') && m.supportedGenerationMethods?.includes('generateContent')) ||
                        availableModels.find(m => m.name.includes('gemini-3.0-flash') && m.supportedGenerationMethods?.includes('generateContent')) ||
                        availableModels.find(m => m.name.includes('gemini-2.5-flash') && m.supportedGenerationMethods?.includes('generateContent')) ||
                        availableModels.find(m => m.name.includes('gemini-2.0-flash') && m.supportedGenerationMethods?.includes('generateContent')) ||
                        availableModels.find(m => m.name.includes('gemini') && m.name.includes('flash') && m.supportedGenerationMethods?.includes('generateContent')) ||
                        availableModels.find(m => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'));
      if (preferred) {
        modelName = preferred.name;
      }
    }
  } catch (err) {
    console.warn("Could not fetch models list, using default.", err);
  }

  progressEl.textContent = `AI analyzing watch image with ${modelName.replace('models/', '')}…`;

  // Strip the data:image/...;base64, prefix
  const base64 = base64DataUrl.split(',')[1];
  const mimeType = base64DataUrl.split(';')[0].split(':')[1] || 'image/jpeg';

  const prompt = `You are a Master Horologist and an expert in luxury watches, specifically Rolex. Analyze this watch image with extreme precision and extract all visible information. Pay close attention to subtle details: text on the dial, bezel markings, crown guards, lug shapes, and bracelet style to accurately identify the specific reference number.
Return ONLY a valid JSON object — no markdown, no extra text, just the raw JSON.

Use these exact field names and allowed values:
{
  "name": "exact full model name (e.g. Rolex Submariner Date 41)",
  "category": "one of: Submariner, Daytona, GMT-Master II, Datejust, Day-Date, Explorer, Yacht-Master, Sea-Dweller, Milgauss, Sky-Dweller, Air-King, Oyster Perpetual, Other",
  "ref": "exact reference number if you can determine it based on visual cues, else empty string",
  "caseSize": "case diameter as number only (e.g. 41), estimate if not visible",
  "caseMat": "one of: Oystersteel, Yellow Gold (18k), White Gold (18k), Everose Gold (18k), Two-Tone (Steel & Gold), Platinum, Titanium",
  "bracelet": "one of: Oyster Bracelet, Jubilee Bracelet, President Bracelet, Pearlmaster Bracelet, Rubber Strap (Oysterflex), Leather Strap",
  "dial": "exact color and texture of the dial (e.g. Black, Sunburst Blue, Meteorite, Champagne)",
  "movement": "one of: Calibre 3235, Calibre 4130, Calibre 3186, Calibre 3255, Calibre 9001, Calibre 9002, Calibre 2236, Calibre 2238, Calibre 3285, Calibre 3230, Calibre 3131, Other Rolex Calibre",
  "condition": "one of: Brand New (Unworn), Excellent (Like New), Very Good, Good (Minor Wear), Fair (Visible Wear)",
  "dial_markers": "describe hour markers (e.g. Chromalight, Arabic, Roman, Diamond)",
  "bezel": "describe bezel material and type (e.g. Cerachrom, Tachymeter, Fluted, Smooth)",
  "price": estimated retail price in Philippine Pesos as integer (no symbols),
  "confidence": "high, medium, or low",
  "notes": "any other notable features visible in the image"
}

Be as accurate as possible. If you cannot determine a value with confidence, use your best expert estimate based on what is visible.`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64 } }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
  };

  progressEl.textContent = 'Processing response (High Accuracy Mode)…';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip markdown code fences if present
  const jsonText = rawText.replace(/```json\n?/gi,'').replace(/```\n?/g,'').trim();

  let parsed;
  try { parsed = JSON.parse(jsonText); }
  catch(e) { throw new Error('Could not parse AI response. Try again.'); }

  progressEl.textContent = 'Filling fields…';

  // Apply to form
  if (parsed.name)      document.getElementById('fName').value      = parsed.name;
  if (parsed.category)  document.getElementById('fCategory').value  = parsed.category;
  if (parsed.ref)       document.getElementById('fRef').value       = parsed.ref;
  if (parsed.caseSize)  document.getElementById('fCaseSize').value  = parsed.caseSize;
  if (parsed.caseMat)   document.getElementById('fCaseMat').value   = parsed.caseMat;
  if (parsed.bracelet)  document.getElementById('fBracelet').value  = parsed.bracelet;
  if (parsed.dial)      document.getElementById('fDial').value      = parsed.dial;
  if (parsed.movement)  document.getElementById('fMovement').value  = parsed.movement;
  if (parsed.condition) document.getElementById('fCondition').value = parsed.condition;
  if (parsed.price)     document.getElementById('fPrice').value     = parsed.price;
  if (!document.getElementById('fQty').value) document.getElementById('fQty').value = '1';

  // Build desc from notes
  if (parsed.notes || parsed.bezel || parsed.dial_markers) {
    const parts = [];
    if (parsed.bezel)        parts.push('Bezel: ' + parsed.bezel);
    if (parsed.dial_markers) parts.push('Markers: ' + parsed.dial_markers);
    if (parsed.notes)        parts.push(parsed.notes);
    document.getElementById('fDesc').value = parts.join(' | ');
  }

  return parsed;
}

// ── Filename-based fallback (used when no API key) ──
function runAIFallback(filename) {
  const fn = (filename || '').toLowerCase();
  const db = [
    { test:/sub/i,        name:'Rolex Submariner Date 41',  category:'Submariner',    ref:'126610LN',   caseMat:'Oystersteel',           caseSize:'41', bracelet:'Oyster Bracelet',    dial:'Black Chromalight',  movement:'Calibre 3235', condition:'Brand New (Unworn)', price:750000 },
    { test:/daytona/i,    name:'Rolex Cosmograph Daytona',  category:'Daytona',       ref:'116500LN',   caseMat:'Oystersteel',           caseSize:'40', bracelet:'Oyster Bracelet',    dial:'White Panda',        movement:'Calibre 4130', condition:'Brand New (Unworn)', price:1200000 },
    { test:/gmt/i,        name:'Rolex GMT-Master II',       category:'GMT-Master II', ref:'126710BLRO', caseMat:'Oystersteel',           caseSize:'40', bracelet:'Jubilee Bracelet',   dial:'Black',              movement:'Calibre 3285', condition:'Brand New (Unworn)', price:900000 },
    { test:/datejust/i,   name:'Rolex Datejust 41',         category:'Datejust',      ref:'126334',     caseMat:'Oystersteel',           caseSize:'41', bracelet:'Jubilee Bracelet',   dial:'Silver',             movement:'Calibre 3235', condition:'Brand New (Unworn)', price:600000 },
    { test:/day.?date/i,  name:'Rolex Day-Date 40',         category:'Day-Date',      ref:'228238',     caseMat:'Yellow Gold (18k)',     caseSize:'40', bracelet:'President Bracelet', dial:'Champagne',          movement:'Calibre 3255', condition:'Brand New (Unworn)', price:2500000 },
    { test:/explorer/i,   name:'Rolex Explorer II 42',      category:'Explorer',      ref:'226570',     caseMat:'Oystersteel',           caseSize:'42', bracelet:'Oyster Bracelet',    dial:'White',              movement:'Calibre 3285', condition:'Brand New (Unworn)', price:550000 },
    { test:/yacht/i,      name:'Rolex Yacht-Master 40',     category:'Yacht-Master',  ref:'116621',     caseMat:'Two-Tone (Steel & Gold)',caseSize:'40', bracelet:'Oyster Bracelet',    dial:'Rhodium',            movement:'Calibre 3135', condition:'Brand New (Unworn)', price:850000 },
    { test:/sea.?dwell/i, name:'Rolex Sea-Dweller 43',      category:'Sea-Dweller',   ref:'126600',     caseMat:'Oystersteel',           caseSize:'43', bracelet:'Oyster Bracelet',    dial:'Black',              movement:'Calibre 3235', condition:'Brand New (Unworn)', price:950000 },
    { test:/milgauss/i,   name:'Rolex Milgauss 40',         category:'Milgauss',      ref:'116400GV',   caseMat:'Oystersteel',           caseSize:'40', bracelet:'Oyster Bracelet',    dial:'Black Z-Blue',       movement:'Calibre 3131', condition:'Brand New (Unworn)', price:700000 },
    { test:/sky.?dwell/i, name:'Rolex Sky-Dweller 42',      category:'Sky-Dweller',   ref:'326933',     caseMat:'Two-Tone (Steel & Gold)',caseSize:'42', bracelet:'Jubilee Bracelet',   dial:'White',              movement:'Calibre 9001', condition:'Brand New (Unworn)', price:1800000 },
    { test:/air.?king/i,  name:'Rolex Air-King 40',         category:'Air-King',      ref:'126900',     caseMat:'Oystersteel',           caseSize:'40', bracelet:'Oyster Bracelet',    dial:'Black',              movement:'Calibre 3230', condition:'Brand New (Unworn)', price:480000 },
    { test:/oyster/i,     name:'Rolex Oyster Perpetual 41', category:'Oyster Perpetual',ref:'124300',   caseMat:'Oystersteel',           caseSize:'41', bracelet:'Oyster Bracelet',    dial:'Candy Green',        movement:'Calibre 3230', condition:'Brand New (Unworn)', price:420000 },
  ];
  const match = db.find(d => d.test.test(fn));
  const fill  = match || { name:'Rolex Watch', category:'Submariner', ref:'', caseMat:'Oystersteel', caseSize:'41', bracelet:'Oyster Bracelet', dial:'Black', movement:'Calibre 3235', condition:'Brand New (Unworn)', price:'' };
  document.getElementById('fName').value      = fill.name;
  document.getElementById('fCategory').value  = fill.category;
  document.getElementById('fRef').value       = fill.ref;
  document.getElementById('fCaseMat').value   = fill.caseMat;
  document.getElementById('fCaseSize').value  = fill.caseSize;
  document.getElementById('fBracelet').value  = fill.bracelet;
  document.getElementById('fDial').value      = fill.dial;
  document.getElementById('fMovement').value  = fill.movement;
  document.getElementById('fCondition').value = fill.condition;
  if (fill.price) document.getElementById('fPrice').value = fill.price;
  if (!document.getElementById('fQty').value) document.getElementById('fQty').value = '1';
  return !!match;
}

// ── Save product ──
function saveProduct(e) {
  e.preventDefault();
  const p = {
    id:       editingId || Date.now().toString(),
    name:     document.getElementById('fName').value.trim(),
    ref:      document.getElementById('fRef').value.trim(),
    category: document.getElementById('fCategory').value,
    caseSize: document.getElementById('fCaseSize').value,
    caseMat:  document.getElementById('fCaseMat').value,
    bracelet: document.getElementById('fBracelet').value,
    dial:     document.getElementById('fDial').value.trim(),
    movement: document.getElementById('fMovement').value,
    condition:document.getElementById('fCondition').value,
    qty:      parseInt(document.getElementById('fQty').value),
    price:    parseFloat(document.getElementById('fPrice').value),
    sku:      document.getElementById('fSku').value.trim(),
    desc:     document.getElementById('fDesc').value.trim(),
    image:    currentImageData || (editingId ? (products.find(x=>x.id===editingId)||{}).image : null),
  };
  if (editingId) {
    products = products.map(x => x.id===editingId ? p : x);
    save(); closeModal();
    showSuccessPopup('Watch Updated!', `"${p.name}" has been successfully updated.`, '✏️');
  } else {
    products.push(p);
    save(); closeModal();
    showSuccessPopup('Watch Added!', `"${p.name}" has been added to ChronoVault!`, '⌚');
  }
}

// ── Edit ──
function editProduct(id) {
  const p = products.find(x => x.id===id);
  if (!p) return;
  editingId = id;
  document.getElementById('editId').value   = id;
  document.getElementById('fName').value    = p.name||'';
  document.getElementById('fRef').value     = p.ref||'';
  document.getElementById('fCategory').value= p.category||'';
  document.getElementById('fCaseSize').value= p.caseSize||'';
  document.getElementById('fCaseMat').value = p.caseMat||'';
  document.getElementById('fBracelet').value= p.bracelet||'';
  document.getElementById('fDial').value    = p.dial||'';
  document.getElementById('fMovement').value= p.movement||'';
  document.getElementById('fCondition').value=p.condition||'';
  document.getElementById('fQty').value     = p.qty??0;
  document.getElementById('fPrice').value   = p.price??0;
  document.getElementById('fSku').value     = p.sku||'';
  document.getElementById('fDesc').value    = p.desc||'';
  if (p.image) {
    currentImageData = p.image;
    const preview = document.getElementById('imgPreview');
    preview.src = p.image; preview.classList.add('show');
    document.getElementById('removeImgBtn').classList.add('show');
  } else { removeImage(); }
  openModal('Edit Rolex Watch');
}

function deleteProduct(id) {
  if (!confirm('Remove this watch from ChronoVault?')) return;
  products = products.filter(x => x.id!==id);
  save(); showToast('Watch removed.','error');
}

// ── Buyers ──
function populateWatchSelect() {
  const sel = document.getElementById('sSoldWatch');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select watch from inventory…</option>';
  products.forEach(p => sel.innerHTML += `<option value="${p.id}" data-ref="${p.ref||''}">${p.name}${p.ref?' ('+p.ref+')':''}</option>`);
  if (cur) sel.value = cur;
}

document.addEventListener('change', function(e) {
  if (e.target.id === 'sSoldWatch') {
    const opt = e.target.selectedOptions[0];
    document.getElementById('sSoldRef').value = opt ? (opt.dataset.ref||'') : '';
    const p = products.find(x => x.id===e.target.value);
    if (p && !document.getElementById('sEditId').value)
      document.getElementById('sSalePrice').value = p.price||'';
  }
});

function openSaleModal() {
  populateWatchSelect();
  document.getElementById('sSaleDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('saleTitleEl').textContent = '💰 Record Sale';
  document.getElementById('saleOverlay').classList.add('open');
}
function closeSaleModal() {
  document.getElementById('saleOverlay').classList.remove('open');
  document.getElementById('saleForm').reset();
  document.getElementById('sEditId').value = '';
}

function saveSale(e) {
  e.preventDefault();
  const sId = document.getElementById('sEditId').value;
  const watchId = document.getElementById('sSoldWatch').value;
  const p = products.find(x => x.id===watchId)||{};
  const entry = {
    id: sId || Date.now().toString(),
    buyerName:    document.getElementById('sBuyerName').value.trim(),
    buyerContact: document.getElementById('sBuyerContact').value.trim(),
    buyerEmail:   document.getElementById('sBuyerEmail').value.trim(),
    buyerAddr:    document.getElementById('sBuyerAddr').value.trim(),
    watchId, watchName: p.name||document.getElementById('sSoldWatch').selectedOptions[0]?.text||'',
    watchRef:  document.getElementById('sSoldRef').value.trim(),
    salePrice: parseFloat(document.getElementById('sSalePrice').value),
    saleDate:  document.getElementById('sSaleDate').value,
    payStatus: document.getElementById('sPayStatus').value,
    notes:     document.getElementById('sSaleNotes').value.trim(),
  };
  if (sId) {
    buyers = buyers.map(x => x.id===sId ? entry : x);
    showToast('✓ Sale record updated!');
  } else {
    buyers.push(entry);
    if (p.id) { p.qty = Math.max(0,(p.qty||0)-1); save(); }
    showToast('✓ Sale recorded successfully!');
  }
  saveBuyers(); closeSaleModal();
}

function renderBuyers() {
  const q = (document.getElementById('buyerSearch')?.value||'').toLowerCase();
  const rows = buyers.filter(b =>
    b.buyerName.toLowerCase().includes(q) ||
    (b.watchName||'').toLowerCase().includes(q) ||
    (b.watchRef||'').toLowerCase().includes(q) ||
    (b.payStatus||'').toLowerCase().includes(q)
  );
  const tb = document.getElementById('buyerTable');
  if (!rows.length) {
    tb.innerHTML = '<tr class="empty-row"><td colspan="8">No sales recorded yet. Click <strong>Record Sale</strong> to add one.</td></tr>';
    return;
  }
  const sc = { Paid:'sale-status-paid', Pending:'sale-status-pending', Cancelled:'sale-status-cancelled' };
  tb.innerHTML = rows.map((b,i) => {
    const initials = b.buyerName.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    const dateStr = b.saleDate ? new Date(b.saleDate).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—';
    return `<tr>
      <td style="color:var(--muted);font-size:.8rem">${i+1}</td>
      <td><div class="buyer-cell">
        <div class="buyer-avatar">${initials}</div>
        <div><strong>${b.buyerName}</strong>${b.buyerContact?`<br><span style="font-size:.72rem;color:var(--muted)">${b.buyerContact}</span>`:''}</div>
      </div></td>
      <td><strong style="font-size:.88rem">${b.watchName||'—'}</strong></td>
      <td><span style="font-family:monospace;font-size:.82rem;color:var(--go4)">${b.watchRef||'—'}</span></td>
      <td><strong>${fmt(b.salePrice)}</strong></td>
      <td style="font-size:.82rem;color:var(--muted)">${dateStr}</td>
      <td><span class="badge ${sc[b.payStatus]||'sale-status-pending'}">${b.payStatus||'Pending'}</span></td>
      <td style="display:flex;gap:.4rem;flex-wrap:wrap">
        <button class="btn btn-sm btn-edit" onclick="editSale('${b.id}')">✏ Edit</button>
        <button class="btn btn-sm btn-del"  onclick="deleteSale('${b.id}')">🗑 Delete</button>
      </td>
    </tr>`;
  }).join('');
}

function editSale(id) {
  const b = buyers.find(x=>x.id===id); if(!b) return;
  populateWatchSelect();
  document.getElementById('sEditId').value       = b.id;
  document.getElementById('sBuyerName').value    = b.buyerName;
  document.getElementById('sBuyerContact').value = b.buyerContact||'';
  document.getElementById('sBuyerEmail').value   = b.buyerEmail||'';
  document.getElementById('sBuyerAddr').value    = b.buyerAddr||'';
  document.getElementById('sSoldWatch').value    = b.watchId||'';
  document.getElementById('sSoldRef').value      = b.watchRef||'';
  document.getElementById('sSalePrice').value    = b.salePrice||'';
  document.getElementById('sSaleDate').value     = b.saleDate||'';
  document.getElementById('sPayStatus').value    = b.payStatus||'';
  document.getElementById('sSaleNotes').value    = b.notes||'';
  document.getElementById('saleTitleEl').textContent = '✏ Edit Sale Record';
  document.getElementById('saleOverlay').classList.add('open');
}

function deleteSale(id) {
  if (!confirm('Delete this sale record?')) return;
  buyers = buyers.filter(x=>x.id!==id);
  saveBuyers(); showToast('Sale record deleted.','error');
}

function updateBuyerStats() {
  const paid = buyers.filter(b=>b.payStatus==='Paid');
  document.getElementById('bStatTotal').textContent   = buyers.length;
  document.getElementById('bStatPaid').textContent    = paid.length;
  document.getElementById('bStatPending').textContent = buyers.filter(b=>b.payStatus==='Pending').length;
  const rev = paid.reduce((s,b)=>s+(b.salePrice||0),0);
  document.getElementById('bStatRev').textContent = '₱'+rev.toLocaleString('en-PH',{minimumFractionDigits:0});
}

function signOut() {
  if (confirm('Sign out of ChronoVault?')) window.location.href = 'login.html';
}

// ── Modal overlay close ──
document.getElementById('modalOverlay').addEventListener('click', function(e){ if(e.target===this) closeModal(); });
document.getElementById('saleOverlay').addEventListener('click', function(e){ if(e.target===this) closeSaleModal(); });
document.getElementById('detailOverlay').addEventListener('click', function(e){ if(e.target===this) closeDetailModal(); });
document.getElementById('stockOverlay').addEventListener('click', function(e){ if(e.target===this) closeStockModal(); });

// ── Quick Stock Update ──
let stockTargetId  = null;
let stockPendingQty = null;

function openStockModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  stockTargetId  = id;
  stockPendingQty = parseInt(p.qty) || 0;

  document.getElementById('stockWatchName').textContent = p.name;
  document.getElementById('stockWatchRef').textContent  = p.ref ? 'Ref. ' + p.ref : (p.sku || '');
  document.getElementById('stockCurrentVal').textContent = stockPendingQty;
  document.getElementById('stockNewQty').value = '';
  document.getElementById('stockPreviewRow').style.display = 'none';
  document.getElementById('stockPreviewVal').textContent = '';
  document.getElementById('stockOverlay').classList.add('open');
}

function adjustStockBy(delta) {
  const cur = parseInt(document.getElementById('stockCurrentVal').textContent) || 0;
  stockPendingQty = Math.max(0, cur + delta);
  document.getElementById('stockCurrentVal').textContent = stockPendingQty;
  document.getElementById('stockPreviewRow').style.display = 'none';
  document.getElementById('stockNewQty').value = '';
  // Colour feedback
  const el = document.getElementById('stockCurrentVal');
  el.style.color = stockPendingQty === 0 ? '#fca5a5' : stockPendingQty <= 3 ? 'var(--go4)' : '#6ee7b7';
}

function applyExactStock() {
  const raw = parseInt(document.getElementById('stockNewQty').value);
  if (isNaN(raw) || raw < 0) { showToast('Enter a valid quantity.', 'error'); return; }
  stockPendingQty = raw;
  document.getElementById('stockPreviewRow').style.display = 'flex';
  document.getElementById('stockPreviewVal').textContent = stockPendingQty;
  document.getElementById('stockPreviewVal').style.color =
    stockPendingQty === 0 ? '#fca5a5' : stockPendingQty <= 3 ? 'var(--go4)' : '#6ee7b7';
}

async function saveStock() {
  if (stockTargetId === null || stockPendingQty === null) return;
  const p = products.find(x => x.id === stockTargetId);
  if (!p) return;
  const oldQty = p.qty;
  p.qty = stockPendingQty;
  await save();
  closeStockModal();
  showSuccessPopup('Stock Updated!', `"${p.name}" stock set to ${stockPendingQty} pcs.`, '📦');
  // Refresh inventory grid if visible
  const inv = document.getElementById('panelInventory');
  if (inv && inv.classList.contains('active')) renderInventoryGrid();
}

function closeStockModal() {
  document.getElementById('stockOverlay').classList.remove('open');
  stockTargetId  = null;
  stockPendingQty = null;
}

// ── Clear AI scan ──
function clearAIScan() {
  resetScanUI();
  removeImage();
  ['fName','fRef','fDial','fSku','fDesc'].forEach(id => document.getElementById(id).value = '');
  ['fCategory','fCaseMat','fBracelet','fMovement','fCondition'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fCaseSize').value = '';
  document.getElementById('fPrice').value = '';
  document.getElementById('fQty').value = '';
  // Reset result banner style
  const rb = document.getElementById('aiResultBanner');
  rb.style.borderColor = ''; rb.style.background = '';
  document.getElementById('aiResultText').style.color = '';
  showToast('Scan cleared — fields reset.', 'error');
}

// ── API Key management ──
function saveApiKey() {
  const key = document.getElementById('geminiApiKey').value.trim();
  localStorage.setItem('cv_gemini_key', key);
  const status = document.getElementById('apiKeyStatus');
  if (key.length > 20) {
    status.textContent = '✓ Gemini AI key saved & active';
    status.style.color = '#6ee7b7';
  } else if (key.length > 0) {
    status.textContent = '⚠ Key looks too short — check it';
    status.style.color = 'var(--go4)';
  } else {
    status.textContent = 'No key — filename fallback active';
    status.style.color = 'var(--muted)';
  }
}

function toggleApiKey() {
  const body    = document.getElementById('apiKeyBody');
  const chevron = document.getElementById('apiKeyChevron');
  const open = body.style.display === 'none';
  body.style.display      = open ? 'flex' : 'none';
  chevron.style.transform = open ? 'rotate(180deg)' : '';
}

function initApiKey() {
  const saved = localStorage.getItem('cv_gemini_key') || '';
  document.getElementById('geminiApiKey').value = saved;
  const status = document.getElementById('apiKeyStatus');
  if (saved.length > 20) {
    status.textContent = '✓ Gemini AI ready';
    status.style.color = '#6ee7b7';
  } else {
    status.textContent = 'No key — filename fallback active';
    status.style.color = 'var(--muted)';
  }
}

// ── Init ──
renderTable(); updateStats(); updateBuyerStats(); initApiKey();

