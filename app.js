/* ==========================================================================
   CORE APPLICATION ENGINE - SOVIA JEWELRY RING REPAIR SYSTEM
   ========================================================================== */

// --- GLOBAL APP STATE ---
const State = {
    currentUser: null,
    currentPanel: 'dashboard-panel',
    db: null,
    syncLock: false,
    activeEditId: null, // Holds transaction ID if editing
    masterData: {
        users: [],
        stores: [],
        catalog: [],
        metals: [],
        repairs: [],
        workshops: [],
        cities: [],
        payments: []
    }
};

// --- CONFIGURATIONS ---
const CONFIG = {
    DB_NAME: 'SoviaRepairDB',
    DB_VERSION: 1,
    // Google Apps Script Deploy URL
    GAS_API_URL: 'https://script.google.com/macros/s/AKfycbwaJsUPiuxnwVt2Rn_ALJrkUK8aaWwu7E5Z2F7cKkc8s5kuDCyiuif-PKs3dkUY1GJEvw/exec', 
};

// ==========================================================================
// 1. DATABASE LAYER (IndexedDB Engine)
// ==========================================================================

function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

        request.onerror = (event) => {
            showToast('Gagal memuat database lokal!', 'error');
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            State.db = event.target.result;
            resolve(State.db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create Transaction Store
            if (!db.objectStoreNames.contains('repair_transactions')) {
                db.createObjectStore('repair_transactions', { keyPath: 'repair_number' });
            }
            
            // Create Sync Queue Store
            if (!db.objectStoreNames.contains('sync_queue')) {
                db.createObjectStore('sync_queue', { autoIncrement: true });
            }

            // Create Master Stores
            const masterStores = [
                { name: 'master_users', key: 'username' },
                { name: 'master_stores', key: 'code' },
                { name: 'master_catalog', key: 'id' },
                { name: 'master_metals', key: 'id' },
                { name: 'master_repairs', key: 'id' },
                { name: 'master_workshops', key: 'id' },
                { name: 'master_cities', key: 'id' },
                { name: 'master_payments', key: 'id' }
            ];

            masterStores.forEach(store => {
                if (!db.objectStoreNames.contains(store.name)) {
                    db.createObjectStore(store.name, { keyPath: store.key });
                }
            });

            // Seed Data immediately for demo & local robustness
            const transaction = event.target.transaction;
            seedDatabase(transaction);
        };
    });
}

function seedDatabase(transaction) {
    console.log("Seeding databases with corporate defaults...");

    // 1. Predefined Users
    const userStore = transaction.objectStore('master_users');
    const defaultUsers = [
        { username: 'admin', password: 'admin123', role: 'Admin', store_code: 'ALL' },
        { username: 'sales_bekasi', password: 'sales123', role: 'Sales', store_code: 'BEK' },
        { username: 'sales_yogya', password: 'sales123', role: 'Sales', store_code: 'YOG' },
        { username: 'accounting', password: 'acc123', role: 'Accounting', store_code: 'ALL' },
        { username: 'production', password: 'prod123', role: 'Production', store_code: 'ALL' },
        { username: 'logistic', password: 'log123', role: 'Logistic', store_code: 'ALL' }
    ];
    defaultUsers.forEach(u => userStore.put(u));

    // 2. Predefined Stores
    const storeStore = transaction.objectStore('master_stores');
    const defaultStores = [
        { code: 'BEK', name: 'Bekasi Denisa', address: 'Grand Galaxy City Ruko RGB, Bekasi', phone: '6281234567890' },
        { code: 'YOG', name: 'Yogyakarta HQ', address: 'Jl. Mertosanan, Potorono, Banguntapan, Bantul', phone: '6288899911122' },
        { code: 'JKT', name: 'Jakarta Cikini', address: 'Ruko Menteng Pradana, Cikini, Jakarta Pusat', phone: '6285555444333' }
    ];
    defaultStores.forEach(s => storeStore.put(s));

    // 3. Predefined Catalog Services/Items
    const catalogStore = transaction.objectStore('master_catalog');
    const defaultCatalog = [
        { id: 'CAT-001', name: 'Ukir Laser Dalam Cincin', category: 'Jasa', price: 50000 },
        { id: 'CAT-002', name: 'Ukir Laser Luar Cincin', category: 'Jasa', price: 75000 },
        { id: 'CAT-003', name: 'Kotak Cincin Beludru Premium', category: 'Barang', price: 95000 },
        { id: 'CAT-004', name: 'Kotak Cincin Kayu Rustic', category: 'Barang', price: 150000 },
        { id: 'CAT-005', name: 'Lap Polishing Kain Microfiber', category: 'Barang', price: 15000 },
        { id: 'CAT-006', name: 'Grafir Timbul Huruf', category: 'Jasa', price: 120000 }
    ];
    defaultCatalog.forEach(c => catalogStore.put(c));

    // 4. Predefined Metal Materials
    const metalStore = transaction.objectStore('master_metals');
    const defaultMetals = [
        { id: 'MET-001', name: 'Emas Kuning 18K (75%)', price_per_gram: 1100000, custom_fee: 250000 },
        { id: 'MET-002', name: 'Emas Putih 18K (75%)', price_per_gram: 1150000, custom_fee: 300000 },
        { id: 'MET-003', name: 'Palladium 50%', price_per_gram: 750000, custom_fee: 400000 },
        { id: 'MET-004', name: 'Platinum 95%', price_per_gram: 1250000, custom_fee: 450000 },
        { id: 'MET-005', name: 'Perak 925 (Sterling Silver)', price_per_gram: 60000, custom_fee: 100000 }
    ];
    defaultMetals.forEach(m => metalStore.put(m));

    // 5. Predefined Repair Services
    const repairStore = transaction.objectStore('master_repairs');
    const defaultRepairs = [
        { id: 'REP-SRV-001', name: 'Resize Cincin Naik Ukuran', repair_fee: 120000 },
        { id: 'REP-SRV-002', name: 'Resize Cincin Turun Ukuran', repair_fee: 80000 },
        { id: 'REP-SRV-003', name: 'Poles Ulang & Chrome Rhodium', repair_fee: 100000 },
        { id: 'REP-SRV-004', name: 'Pasang Permata Zirconia Lepas', repair_fee: 60000 },
        { id: 'REP-SRV-005', name: 'Solder Cincin Patah / Retak', repair_fee: 75000 },
        { id: 'REP-SRV-006', name: 'Ubah Bentuk (Doff/Glossy)', repair_fee: 50000 }
    ];
    defaultRepairs.forEach(r => repairStore.put(r));

    // 6. Predefined Goldsmiths / Workshops
    const workshopStore = transaction.objectStore('master_workshops');
    const defaultWorkshops = [
        { id: 'WKS-001', name: 'Workshop Mertosanan Potorono', phone: '6281122334455', address: 'Potorono, Banguntapan, Bantul' },
        { id: 'WKS-002', name: 'Workshop Kotagede Sentra Emas', phone: '6285566778899', address: 'Kotagede, Yogyakarta' }
    ];
    defaultWorkshops.forEach(w => workshopStore.put(w));

    // 7. Predefined Shipping Cities & Provinces
    const cityStore = transaction.objectStore('master_cities');
    const defaultCities = [
        { id: 'CIT-001', city: 'Bantul', province: 'DI Yogyakarta', shipping_fee: 10000 },
        { id: 'CIT-002', city: 'Sleman', province: 'DI Yogyakarta', shipping_fee: 15000 },
        { id: 'CIT-003', city: 'Yogyakarta', province: 'DI Yogyakarta', shipping_fee: 12000 },
        { id: 'CIT-004', city: 'Bekasi', province: 'Jawa Barat', shipping_fee: 28000 },
        { id: 'CIT-005', city: 'Jakarta Selatan', province: 'DKI Jakarta', shipping_fee: 30000 },
        { id: 'CIT-006', city: 'Jakarta Barat', province: 'DKI Jakarta', shipping_fee: 30000 },
        { id: 'CIT-007', city: 'Bandung', province: 'Jawa Barat', shipping_fee: 25000 },
        { id: 'CIT-008', city: 'Surabaya', province: 'Jawa Timur', shipping_fee: 32000 },
        { id: 'CIT-009', city: 'Tangerang Selatan', province: 'Banten', shipping_fee: 30000 }
    ];
    defaultCities.forEach(c => cityStore.put(c));

    // 8. Predefined Payments
    const payStore = transaction.objectStore('master_payments');
    const defaultPayments = [
        { id: 'PAY-001', name: 'BCA Transfer (CV Sovia Group)' },
        { id: 'PAY-002', name: 'Mandiri Transfer (CV Sovia Group)' },
        { id: 'PAY-003', name: 'QRIS Gopay/Dana Sovia' },
        { id: 'PAY-004', name: 'Tunai Kasir Toko' }
    ];
    defaultPayments.forEach(p => payStore.put(p));

    // 9. Predefined Seed Transactions for instant demonstration
    const txnStore = transaction.objectStore('repair_transactions');
    const mockTx = {
        repair_number: 'REP-BEK-260522-133832',
        date: '2026-05-22',
        deadline: '2026-05-29',
        store_sales_name: 'Bekasi Denisa (sales_bekasi)',
        customer_name: 'Amelia Lestari',
        customer_phone: '081298765432',
        customer_address: 'Ruko Sentra Niaga Blok B-12, Bekasi Barat',
        customer_city: 'Bekasi (Jawa Barat)',
        cowok_active: 'TRUE',
        cowok_material: 'MET-001', // Emas Kuning
        cowok_weight: 4.25,
        cowok_size: '18.0',
        cowok_repair_type: 'REP-SRV-001', // Resize Naik
        cowok_engraving: 'Rian 22-05-26',
        cowok_image_url: '',
        cowok_notes: 'Harap dikerjakan halus dan rapi. Ukiran nama sejajar di bagian dalam cincin.',
        cewek_active: 'TRUE',
        cewek_material: 'MET-002', // Emas Putih
        cewek_weight: 3.10,
        cewek_size: '12.5',
        cewek_repair_type: 'REP-SRV-003', // Poles Chrome
        cewek_engraving: 'Amel 22-05-26',
        cewek_image_url: '',
        cewek_notes: 'Tolong dibersihkan permata utamanya.',
        additional_items_json: JSON.stringify([
            { name: 'Kotak Cincin Beludru Premium', qty: 1, price: 95000, subtotal: 95000 },
            { name: 'Ukir Laser Dalam Cincin', qty: 2, price: 50000, subtotal: 100000 }
        ]),
        cowok_price: 5045000, // 4.25*1.1m + 250k custom + 120k repair
        cewek_price: 3965000, // 3.10*1.15m + 300k custom + 100k repair
        additional_total: 195000,
        shipping_fee: 28000,
        total_price: 9233000,
        min_dp: 7386400, // 80%
        warranty_image_url: '',
        dp1_method: 'PAY-001',
        dp1_amount: 8000000,
        dp1_receipt_url: '',
        dp2_method: '',
        dp2_amount: 0,
        dp2_receipt_url: '',
        status: 'Synced',
        created_by: 'sales_bekasi',
        created_at: new Date('2026-05-22T13:38:32').toISOString()
    };
    txnStore.put(mockTx);
}

// --- UNIVERSAL INDEXEDDB READ/WRITE HELPER ---
function getLocalData(storeName) {
    return new Promise((resolve, reject) => {
        if (!State.db) return resolve([]);
        const tx = State.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function saveLocalData(storeName, dataObject) {
    return new Promise((resolve, reject) => {
        if (!State.db) return reject('Database not initialized');
        const tx = State.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(dataObject);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function deleteLocalData(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!State.db) return reject('Database not initialized');
        const tx = State.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Load all master tables to RAM cache
async function loadAllMasterDataToCache() {
    try {
        State.masterData.users = await getLocalData('master_users');
        State.masterData.stores = await getLocalData('master_stores');
        State.masterData.catalog = await getLocalData('master_catalog');
        State.masterData.metals = await getLocalData('master_metals');
        State.masterData.repairs = await getLocalData('master_repairs');
        State.masterData.workshops = await getLocalData('master_workshops');
        State.masterData.cities = await getLocalData('master_cities');
        State.masterData.payments = await getLocalData('master_payments');
    } catch (e) {
        console.error("Gagal membaca master cache: ", e);
    }
}

// ==========================================================================
// 2. AUTHENTICATION & SESSION LAYER
// ==========================================================================

function checkSession() {
    const saved = localStorage.getItem('sovia_session');
    if (saved) {
        State.currentUser = JSON.parse(saved);
        showMainApp();
    } else {
        showPortalHub();
    }
}

function handleLogin(username, password) {
    const user = State.masterData.users.find(u => u.username === username.toLowerCase() && u.password === password);
    if (user) {
        State.currentUser = user;
        localStorage.setItem('sovia_session', JSON.stringify(user));
        
        showToast('Login berhasil! Selamat bekerja.', 'success');
        showMainApp();
        return true;
    } else {
        showToast('Username atau password salah!', 'error');
        return false;
    }
}

function handleLogout() {
    State.currentUser = null;
    localStorage.removeItem('sovia_session');
    showToast('Berhasil keluar sistem.', 'info');
    showPortalHub();
}

// Verifies Admin Credentials in overlay modal (does not destroy current sales session)
function challengeAdminAccess(adminUser, adminPass) {
    const dbAdmin = State.masterData.users.find(u => u.role === 'Admin' && u.username === adminUser.toLowerCase() && u.password === adminPass);
    return !!dbAdmin;
}

// ==========================================================================
// 3. UI RENDERING & CLIENT ROUTER
// ==========================================================================

function showPortalHub() {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('hub-view').classList.remove('hidden');
}

function showLoginScreen() {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}

async function showMainApp() {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('app-layout').classList.remove('hidden');

    // Populate user profile info in sidebar
    document.getElementById('user-display-name').textContent = State.currentUser.username;
    
    // Set display store/sales description
    let storeText = 'Semua Toko';
    if (State.currentUser.store_code !== 'ALL') {
        const branch = State.masterData.stores.find(s => s.code === State.currentUser.store_code);
        storeText = branch ? branch.name : State.currentUser.store_code;
    }
    document.getElementById('user-display-role').textContent = `${State.currentUser.role} (${storeText})`;

    // Enforce role-based access to Admin navbar button
    const adminBtn = document.getElementById('menu-item-admin');
    if (State.currentUser.role === 'Admin') {
        adminBtn.style.display = 'flex';
    } else {
        adminBtn.style.display = 'none';
    }

    // Default Greeting
    document.getElementById('dashboard-user-greeting').textContent = State.currentUser.username;

    // Load static selects
    populateSalesFormSelects();

    // Reset view panel
    switchPanel('dashboard-panel');
    
    // Refresh lists
    await refreshAllData();
}

function switchPanel(panelId) {
    State.currentPanel = panelId;
    
    // Update navbar active item
    document.querySelectorAll('.menu-item').forEach(btn => {
        if (btn.dataset.target === panelId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle panels visibility
    document.querySelectorAll('.app-panel').forEach(p => {
        if (p.id === panelId) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });

    // Update Topbar Title
    let title = 'Dashboard';
    if (panelId === 'sales-panel') title = 'Sales (Formulir Repair)';
    else if (panelId === 'accounting-panel') title = 'Accounting & Invoice';
    else if (panelId === 'production-panel') title = 'Production & Workshops';
    else if (panelId === 'logistic-panel') title = 'Logistic & Delivery';
    else if (panelId === 'admin-panel') title = 'Administrator Control';

    document.getElementById('topbar-title').textContent = title;
}

// ==========================================================================
// 4. SALES FORM CONTROLLER & kalkulator
// ==========================================================================

// Populates form elements with materials, repairs, sizes, cities, etc.
function populateSalesFormSelects() {
    // 1. Ring Sizes (4.0 to 35.5 in steps of 0.5)
    const cowokSizeSelect = document.getElementById('cowok-size');
    const cewekSizeSelect = document.getElementById('cewek-size');
    
    let sizeOptions = '<option value="" disabled selected>Pilih Ukuran</option>';
    for (let s = 4.0; s <= 35.5; s += 0.5) {
        const val = s.toFixed(1);
        sizeOptions += `<option value="${val}">${val}</option>`;
    }
    cowokSizeSelect.innerHTML = sizeOptions;
    cewekSizeSelect.innerHTML = sizeOptions;

    // 2. Metals
    const cowokMetalSelect = document.getElementById('cowok-material');
    const cewekMetalSelect = document.getElementById('cewek-material');
    let metalOpts = '<option value="" disabled selected>Pilih Bahan</option>';
    State.masterData.metals.forEach(m => {
        metalOpts += `<option value="${m.id}">${m.name}</option>`;
    });
    cowokMetalSelect.innerHTML = metalOpts;
    cewekMetalSelect.innerHTML = metalOpts;

    // 3. Repairs
    const cowokRepSelect = document.getElementById('cowok-repair-type');
    const cewekRepSelect = document.getElementById('cewek-repair-type');
    let repOpts = '<option value="" disabled selected>Pilih Jenis Repair</option>';
    State.masterData.repairs.forEach(r => {
        repOpts += `<option value="${r.id}">${r.name}</option>`;
    });
    cowokRepSelect.innerHTML = repOpts;
    cewekRepSelect.innerHTML = repOpts;

    // 4. Cities
    const citySelect = document.getElementById('cust-city');
    let cityOpts = '<option value="" disabled selected>Pilih Kabupaten/Kota</option>';
    State.masterData.cities.forEach(c => {
        cityOpts += `<option value="${c.city} (${c.province})">${c.city} - ${c.province}</option>`;
    });
    citySelect.innerHTML = cityOpts;

    // 5. Payment Methods
    const dp1Method = document.getElementById('dp1-method');
    const dp2Method = document.getElementById('dp2-method');
    let payOpts = '<option value="" disabled selected>Pilih Pembayaran</option>';
    State.masterData.payments.forEach(p => {
        payOpts += `<option value="${p.id}">${p.name}</option>`;
    });
    dp1Method.innerHTML = payOpts;
    dp2Method.innerHTML = payOpts;
}

function addAdditionalItemRow(itemObject = null) {
    const tbody = document.getElementById('tbody-additional-items');
    const row = document.createElement('tr');
    
    let catalogOpts = '<option value="" disabled selected>Pilih Layanan/Barang</option>';
    State.masterData.catalog.forEach(c => {
        catalogOpts += `<option value="${c.name}">${c.name} (${c.category})</option>`;
    });

    row.innerHTML = `
        <td>
            <select class="row-item-select" required style="width:100%;">
                ${catalogOpts}
            </select>
        </td>
        <td>
            <input type="number" class="row-item-qty" min="1" value="${itemObject ? itemObject.qty : 1}" style="width:80px;">
        </td>
        <td>
            <input type="number" class="row-item-price" placeholder="0" value="${itemObject ? itemObject.price : ''}" style="width:140px;">
        </td>
        <td>
            <input type="text" class="row-item-subtotal readonly-input" readonly value="Rp 0" style="width:140px;">
        </td>
        <td>
            <button type="button" class="btn-trash-row" title="Hapus Baris"><i class="fa-regular fa-trash-can"></i></button>
        </td>
    `;

    tbody.appendChild(row);

    // If preloading existing row
    if (itemObject) {
        row.querySelector('.row-item-select').value = itemObject.name;
        recalculateRowSubtotal(row);
    }

    // Attach listeners
    row.querySelector('.row-item-select').addEventListener('change', () => {
        const selectedName = row.querySelector('.row-item-select').value;
        const catalogItem = State.masterData.catalog.find(c => c.name === selectedName);
        if (catalogItem) {
            row.querySelector('.row-item-price').value = catalogItem.price;
        }
        recalculateRowSubtotal(row);
        calculateFormPricing();
    });

    row.querySelector('.row-item-qty').addEventListener('input', () => {
        recalculateRowSubtotal(row);
        calculateFormPricing();
    });

    row.querySelector('.row-item-price').addEventListener('input', () => {
        recalculateRowSubtotal(row);
        calculateFormPricing();
    });

    row.querySelector('.btn-trash-row').addEventListener('click', () => {
        row.remove();
        calculateFormPricing();
    });
}

function recalculateRowSubtotal(row) {
    const qty = parseInt(row.querySelector('.row-item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.row-item-price').value) || 0;
    const subtotal = qty * price;
    row.querySelector('.row-item-subtotal').value = formatRupiah(subtotal);
}

// Calculate full repair pricing instantly based on selections
function calculateFormPricing() {
    let cowokPrice = 0;
    let cewekPrice = 0;
    let additionalPrice = 0;
    let shippingFee = 0;

    // 1. Ring Cowok Pricing
    const cowokActive = document.getElementById('ring-cowok-active').checked;
    if (cowokActive) {
        const materialId = document.getElementById('cowok-material').value;
        const weight = parseFloat(document.getElementById('cowok-weight').value) || 0;
        const repairId = document.getElementById('cowok-repair-type').value;

        const metal = State.masterData.metals.find(m => m.id === materialId);
        const repair = State.masterData.repairs.find(r => r.id === repairId);

        let metalPrice = 0;
        let customFee = 0;
        let repairFee = 0;

        if (metal) {
            metalPrice = metal.price_per_gram * weight;
            customFee = metal.custom_fee;
            document.getElementById('cowok-material-price-preview').textContent = 
                `Harga: ${formatRupiah(metal.price_per_gram)}/gr | Jasa: ${formatRupiah(metal.custom_fee)}`;
        } else {
            document.getElementById('cowok-material-price-preview').textContent = `Harga: Rp 0/gr | Jasa: Rp 0`;
        }

        if (repair) {
            repairFee = repair.repair_fee;
            document.getElementById('cowok-repair-fee-preview').textContent = `Biaya repair: ${formatRupiah(repair.repair_fee)}`;
        } else {
            document.getElementById('cowok-repair-fee-preview').textContent = `Biaya repair: Rp 0`;
        }

        cowokPrice = metalPrice + customFee + repairFee;
        
        // Populate calculators
        document.getElementById('calc-cowok-metal-cost').textContent = formatRupiah(metalPrice);
        document.getElementById('calc-cowok-custom-fee').textContent = formatRupiah(customFee);
        document.getElementById('calc-cowok-repair-fee').textContent = formatRupiah(repairFee);
        document.getElementById('calc-cowok-subtotal').textContent = formatRupiah(cowokPrice);
    } else {
        document.getElementById('calc-cowok-metal-cost').textContent = 'Rp 0';
        document.getElementById('calc-cowok-custom-fee').textContent = 'Rp 0';
        document.getElementById('calc-cowok-repair-fee').textContent = 'Rp 0';
        document.getElementById('calc-cowok-subtotal').textContent = 'Rp 0';
    }

    // 2. Ring Cewek Pricing
    const cewekActive = document.getElementById('ring-cewek-active').checked;
    if (cewekActive) {
        const materialId = document.getElementById('cewek-material').value;
        const weight = parseFloat(document.getElementById('cewek-weight').value) || 0;
        const repairId = document.getElementById('cewek-repair-type').value;

        const metal = State.masterData.metals.find(m => m.id === materialId);
        const repair = State.masterData.repairs.find(r => r.id === repairId);

        let metalPrice = 0;
        let customFee = 0;
        let repairFee = 0;

        if (metal) {
            metalPrice = metal.price_per_gram * weight;
            customFee = metal.custom_fee;
            document.getElementById('cewek-material-price-preview').textContent = 
                `Harga: ${formatRupiah(metal.price_per_gram)}/gr | Jasa: ${formatRupiah(metal.custom_fee)}`;
        } else {
            document.getElementById('cewek-material-price-preview').textContent = `Harga: Rp 0/gr | Jasa: Rp 0`;
        }

        if (repair) {
            repairFee = repair.repair_fee;
            document.getElementById('cewek-repair-fee-preview').textContent = `Biaya repair: ${formatRupiah(repair.repair_fee)}`;
        } else {
            document.getElementById('cewek-repair-fee-preview').textContent = `Biaya repair: Rp 0`;
        }

        cewekPrice = metalPrice + customFee + repairFee;

        // Populate calculators
        document.getElementById('calc-cewek-metal-cost').textContent = formatRupiah(metalPrice);
        document.getElementById('calc-cewek-custom-fee').textContent = formatRupiah(customFee);
        document.getElementById('calc-cewek-repair-fee').textContent = formatRupiah(repairFee);
        document.getElementById('calc-cewek-subtotal').textContent = formatRupiah(cewekPrice);
    } else {
        document.getElementById('calc-cewek-metal-cost').textContent = 'Rp 0';
        document.getElementById('calc-cewek-custom-fee').textContent = 'Rp 0';
        document.getElementById('calc-cewek-repair-fee').textContent = 'Rp 0';
        document.getElementById('calc-cewek-subtotal').textContent = 'Rp 0';
    }

    // 3. Additional Items pricing
    const rows = document.querySelectorAll('#tbody-additional-items tr');
    rows.forEach(row => {
        const qty = parseInt(row.querySelector('.row-item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.row-item-price').value) || 0;
        additionalPrice += (qty * price);
    });
    document.getElementById('calc-additional-total').textContent = formatRupiah(additionalPrice);

    // 4. Shipping Destination Fee
    const selectedCity = document.getElementById('cust-city').value;
    if (selectedCity) {
        // extract city name by finding matching string
        const cityData = State.masterData.cities.find(c => `${c.city} (${c.province})` === selectedCity);
        if (cityData) {
            shippingFee = cityData.shipping_fee;
            document.getElementById('shipping-fee-preview').textContent = `Ongkos kirim: ${formatRupiah(shippingFee)}`;
        }
    } else {
        document.getElementById('shipping-fee-preview').textContent = 'Ongkos kirim: Rp 0';
    }
    document.getElementById('calc-shipping-total').textContent = formatRupiah(shippingFee);

    // 5. Total Calculations
    const subtotalRings = cowokPrice + cewekPrice;
    document.getElementById('calc-rings-total').textContent = formatRupiah(subtotalRings);

    const grandTotal = subtotalRings + additionalPrice + shippingFee;
    document.getElementById('calc-grand-total').textContent = formatRupiah(grandTotal);

    // Min 80% Deposit
    const minDp = Math.round(grandTotal * 0.8);
    document.getElementById('calc-min-dp').textContent = formatRupiah(minDp);
}

// Generate unique Repair Number combo REP-STORECODE-YYMMDD-HHMMSS
function generateRepairID(storeCode) {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `REP-${storeCode.toUpperCase()}-${yy}${mm}${dd}-${hh}${min}${ss}`;
}

// Captures inputs into a JSON transaction object
async function getTransactionFromForm() {
    const date = document.getElementById('rep-date').value || new Date().toISOString().slice(0, 10);
    const deadline = document.getElementById('rep-deadline').value;
    
    // Retrieve base64 image values
    const cowokImg = await getImageBase64(document.getElementById('cowok-image').files[0], 'cowok-image-preview');
    const cewekImg = await getImageBase64(document.getElementById('cewek-image').files[0], 'cewek-image-preview');
    const warrantyImg = await getImageBase64(document.getElementById('warranty-image').files[0], 'warranty-image-preview');
    const dp1ReceiptImg = await getImageBase64(document.getElementById('dp1-image').files[0], 'dp1-image-preview');
    const dp2ReceiptImg = await getImageBase64(document.getElementById('dp2-image').files[0], 'dp2-image-preview');

    // Retrieve multi-row items
    const additionalRows = document.querySelectorAll('#tbody-additional-items tr');
    const additionalItems = [];
    additionalRows.forEach(row => {
        const name = row.querySelector('.row-item-select').value;
        const qty = parseInt(row.querySelector('.row-item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.row-item-price').value) || 0;
        if (name) {
            additionalItems.push({ name, qty, price, subtotal: qty * price });
        }
    });

    const cowokActive = document.getElementById('ring-cowok-active').checked;
    const cewekActive = document.getElementById('ring-cewek-active').checked;

    // Formulate object
    const tx = {
        repair_number: document.getElementById('rep-number').value,
        date: date,
        deadline: deadline,
        store_sales_name: document.getElementById('rep-sales-store').value,
        customer_name: document.getElementById('cust-name').value,
        customer_phone: document.getElementById('cust-phone').value,
        customer_address: document.getElementById('cust-address').value,
        customer_city: document.getElementById('cust-city').value,
        
        cowok_active: cowokActive ? 'TRUE' : 'FALSE',
        cowok_material: cowokActive ? document.getElementById('cowok-material').value : '',
        cowok_weight: cowokActive ? parseFloat(document.getElementById('cowok-weight').value) || 0 : 0,
        cowok_size: cowokActive ? document.getElementById('cowok-size').value : '',
        cowok_repair_type: cowokActive ? document.getElementById('cowok-repair-type').value : '',
        cowok_engraving: cowokActive ? document.getElementById('cowok-engraving').value : '',
        cowok_image_url: cowokImg || (State.activeEditId ? await getEditImage('cowok_image_url') : ''),
        cowok_notes: cowokActive ? document.getElementById('cowok-notes').value : '',
        
        cewek_active: cewekActive ? 'TRUE' : 'FALSE',
        cewek_material: cewekActive ? document.getElementById('cewek-material').value : '',
        cewek_weight: cewekActive ? parseFloat(document.getElementById('cewek-weight').value) || 0 : 0,
        cewek_size: cewekActive ? document.getElementById('cewek-size').value : '',
        cewek_repair_type: cewekActive ? document.getElementById('cewek-repair-type').value : '',
        cewek_engraving: cewekActive ? document.getElementById('cewek-engraving').value : '',
        cewek_image_url: cewekImg || (State.activeEditId ? await getEditImage('cewek_image_url') : ''),
        cewek_notes: cewekActive ? document.getElementById('cewek-notes').value : '',
        
        additional_items_json: JSON.stringify(additionalItems),
        
        // Price subtotals
        cowok_price: parseFloat(document.getElementById('calc-cowok-subtotal').textContent.replace(/[^0-9]/g, '')) || 0,
        cewek_price: parseFloat(document.getElementById('calc-cewek-subtotal').textContent.replace(/[^0-9]/g, '')) || 0,
        additional_total: parseFloat(document.getElementById('calc-additional-total').textContent.replace(/[^0-9]/g, '')) || 0,
        shipping_fee: parseFloat(document.getElementById('calc-shipping-total').textContent.replace(/[^0-9]/g, '')) || 0,
        total_price: parseFloat(document.getElementById('calc-grand-total').textContent.replace(/[^0-9]/g, '')) || 0,
        min_dp: parseFloat(document.getElementById('calc-min-dp').textContent.replace(/[^0-9]/g, '')) || 0,
        
        warranty_image_url: warrantyImg || (State.activeEditId ? await getEditImage('warranty_image_url') : ''),
        
        // DP 1 details
        dp1_method: document.getElementById('dp1-method').value || '',
        dp1_amount: parseFloat(document.getElementById('dp1-amount').value) || 0,
        dp1_receipt_url: dp1ReceiptImg || (State.activeEditId ? await getEditImage('dp1_receipt_url') : ''),
        
        // DP 2 details
        dp2_method: document.getElementById('dp2-method').value || '',
        dp2_amount: parseFloat(document.getElementById('dp2-amount').value) || 0,
        dp2_receipt_url: dp2ReceiptImg || (State.activeEditId ? await getEditImage('dp2_receipt_url') : ''),

        dp_approval: State.activeEditId ? (await getEditImage('dp_approval') || 'Pending') : 'Pending',
        pelunasan_approval: State.activeEditId ? (await getEditImage('pelunasan_approval') || 'Pending') : 'Pending',
        render_model_url: State.activeEditId ? await getEditImage('render_model_url') : '',
        render_approval: State.activeEditId ? (await getEditImage('render_approval') || 'Pending') : 'Pending',
        realpict_url: State.activeEditId ? await getEditImage('realpict_url') : '',
        realpict_approval: State.activeEditId ? (await getEditImage('realpict_approval') || 'Pending') : 'Pending',
        refund_receipt_url: State.activeEditId ? await getEditImage('refund_receipt_url') : '',
        final_pickup_status: State.activeEditId ? (await getEditImage('final_pickup_status') || 'Pending') : 'Pending',

        status: 'Pending Sync',
        created_by: State.currentUser.username,
        created_at: new Date().toISOString()
    };
    return tx;
}

// Utility to preserve base64 if user doesn't re-upload image while editing
async function getEditImage(field) {
    if (!State.activeEditId) return '';
    try {
        const txs = await getLocalData('repair_transactions');
        const match = txs.find(t => t.repair_number === State.activeEditId);
        return match ? (match[field] || '') : '';
    } catch (e) {
        return '';
    }
}

// Utility to convert file inputs to Base64 async strings
function getImageBase64(file, previewId) {
    return new Promise((resolve) => {
        if (!file) {
            // Check if preview already contains image
            const previewEl = document.getElementById(previewId);
            const img = previewEl.querySelector('img');
            if (img) return resolve(img.src);
            return resolve('');
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

// Populates form inputs for edit operations
async function populateFormForEdit(tx) {
    State.activeEditId = tx.repair_number;
    switchPanel('sales-panel');

    document.getElementById('rep-number').value = tx.repair_number;
    document.getElementById('rep-date').value = tx.date;
    document.getElementById('rep-deadline').value = tx.deadline;
    document.getElementById('rep-sales-store').value = tx.store_sales_name;
    document.getElementById('cust-name').value = tx.customer_name;
    document.getElementById('cust-phone').value = tx.customer_phone;
    document.getElementById('cust-address').value = tx.customer_address;
    document.getElementById('cust-city').value = tx.customer_city;

    // Rings cowok
    const cowokActive = tx.cowok_active === 'TRUE';
    document.getElementById('ring-cowok-active').checked = cowokActive;
    toggleRingCardActive('cowok', cowokActive);
    if (cowokActive) {
        document.getElementById('cowok-material').value = tx.cowok_material;
        document.getElementById('cowok-weight').value = tx.cowok_weight;
        document.getElementById('cowok-size').value = tx.cowok_size;
        document.getElementById('cowok-repair-type').value = tx.cowok_repair_type;
        document.getElementById('cowok-engraving').value = tx.cowok_engraving;
        document.getElementById('cowok-notes').value = tx.cowok_notes;
        setUploadPreview('cowok-image-preview', tx.cowok_image_url, 'cincin cowok');
    } else {
        resetRingCardFields('cowok');
    }

    // Rings cewek
    const cewekActive = tx.cewek_active === 'TRUE';
    document.getElementById('ring-cewek-active').checked = cewekActive;
    toggleRingCardActive('cewek', cewekActive);
    if (cewekActive) {
        document.getElementById('cewek-material').value = tx.cewek_material;
        document.getElementById('cewek-weight').value = tx.cewek_weight;
        document.getElementById('cewek-size').value = tx.cewek_size;
        document.getElementById('cewek-repair-type').value = tx.cewek_repair_type;
        document.getElementById('cewek-engraving').value = tx.cewek_engraving;
        document.getElementById('cewek-notes').value = tx.cewek_notes;
        setUploadPreview('cewek-image-preview', tx.cewek_image_url, 'cincin cewek');
    } else {
        resetRingCardFields('cewek');
    }

    // Additional items
    document.getElementById('tbody-additional-items').innerHTML = '';
    const addItems = JSON.parse(tx.additional_items_json || '[]');
    addItems.forEach(item => addAdditionalItemRow(item));

    // Warranty card
    setUploadPreview('warranty-image-preview', tx.warranty_image_url, 'kartu garansi');

    // Payments
    document.getElementById('dp1-method').value = tx.dp1_method;
    document.getElementById('dp1-amount').value = tx.dp1_amount;
    setUploadPreview('dp1-image-preview', tx.dp1_receipt_url, 'resi DP 1');

    document.getElementById('dp2-method').value = tx.dp2_method;
    document.getElementById('dp2-amount').value = tx.dp2_amount;
    setUploadPreview('dp2-image-preview', tx.dp2_receipt_url, 'resi DP 2');

    calculateFormPricing();
    
    // Smooth scroll back to form top
    document.getElementById('content-panel').scrollTo({ top: 0, behavior: 'smooth' });
}

function setUploadPreview(previewId, imgUrl, textLabel) {
    const p = document.getElementById(previewId);
    if (imgUrl) {
        p.innerHTML = `<img src="${imgUrl}" alt="Preview ${textLabel}"><span style="margin-top:6px; font-size:10px; color:var(--text-muted);">Ubah Foto</span>`;
    } else {
        p.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i><span>Klik untuk unggah foto ${textLabel}</span>`;
    }
}

function resetForm() {
    State.activeEditId = null;
    document.getElementById('repair-entry-form').reset();
    
    if (State.currentUser) {
        // Regenerate unique number
        let branchCode = State.currentUser.store_code === 'ALL' ? 'HQ' : State.currentUser.store_code;
        document.getElementById('rep-number').value = generateRepairID(branchCode);
        
        // Auto populate sales/store
        const activeStore = State.masterData.stores.find(s => s.code === State.currentUser.store_code);
        const storeDesc = activeStore ? activeStore.name : 'Corporate Headquarters';
        document.getElementById('rep-sales-store').value = `${storeDesc} (${State.currentUser.username})`;
    } else {
        document.getElementById('rep-number').value = '';
        document.getElementById('rep-sales-store').value = '';
    }

    // Reset ring checks & panels
    document.getElementById('ring-cowok-active').checked = true;
    document.getElementById('ring-cewek-active').checked = true;
    toggleRingCardActive('cowok', true);
    toggleRingCardActive('cewek', true);
    
    resetRingCardFields('cowok');
    resetRingCardFields('cewek');

    // Clear additional items table
    document.getElementById('tbody-additional-items').innerHTML = '';

    // Reset dates
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('rep-date').value = today;
    
    // Target deadline default to 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    document.getElementById('rep-deadline').value = d.toISOString().slice(0, 10);

    calculateFormPricing();
}

function resetRingCardFields(prefix) {
    document.getElementById(`${prefix}-material`).value = '';
    document.getElementById(`${prefix}-weight`).value = '';
    document.getElementById(`${prefix}-size`).value = '';
    document.getElementById(`${prefix}-repair-type`).value = '';
    document.getElementById(`${prefix}-engraving`).value = '';
    document.getElementById(`${prefix}-notes`).value = '';
    document.getElementById(`${prefix}-image`).value = '';
    setUploadPreview(`${prefix}-image-preview`, '', `cincin ${prefix}`);
}

function toggleRingCardActive(prefix, active) {
    const card = document.getElementById(`card-ring-${prefix}`);
    if (active) {
        card.classList.remove('disabled');
    } else {
        card.classList.add('disabled');
    }
}

// Validate that necessary inputs are provided correctly
function validateRepairForm() {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const city = document.getElementById('cust-city').value;
    const deadline = document.getElementById('rep-deadline').value;

    if (!deadline) {
        showToast('Mohon tentukan tanggal deadline perbaikan!', 'warning');
        return false;
    }
    if (!name || !phone || !address || !city) {
        showToast('Informasi customer dan alamat kirim wajib diisi lengkap!', 'warning');
        return false;
    }

    const cowokActive = document.getElementById('ring-cowok-active').checked;
    const cewekActive = document.getElementById('ring-cewek-active').checked;

    if (!cowokActive && !cewekActive) {
        showToast('Aktifkan minimal salah satu produk cincin (Cowok / Cewek)!', 'warning');
        return false;
    }

    if (cowokActive) {
        const material = document.getElementById('cowok-material').value;
        const weight = parseFloat(document.getElementById('cowok-weight').value) || 0;
        const size = document.getElementById('cowok-size').value;
        const repType = document.getElementById('cowok-repair-type').value;

        if (!material || weight <= 0 || !size || !repType) {
            showToast('Informasi cincin cowok belum diisi lengkap (Bahan, Berat, Ukuran, Repair)!', 'warning');
            return false;
        }
    }

    if (cewekActive) {
        const material = document.getElementById('cewek-material').value;
        const weight = parseFloat(document.getElementById('cewek-weight').value) || 0;
        const size = document.getElementById('cewek-size').value;
        const repType = document.getElementById('cewek-repair-type').value;

        if (!material || weight <= 0 || !size || !repType) {
            showToast('Informasi cincin cewek belum diisi lengkap (Bahan, Berat, Ukuran, Repair)!', 'warning');
            return false;
        }
    }

    const dp1 = parseFloat(document.getElementById('dp1-amount').value) || 0;
    const dp1Method = document.getElementById('dp1-method').value;

    if (dp1 <= 0 || !dp1Method) {
        showToast('Wajib melampirkan metode & nominal DP ke-1 minimal!', 'warning');
        return false;
    }

    return true;
}

// ==========================================================================
// 5. TRANSACTION RENDERING & HISTORY
// ==========================================================================

async function renderRepairHistory() {
    const list = await getLocalData('repair_transactions');
    const searchQuery = document.getElementById('history-search').value.toLowerCase();
    const statusFilter = document.getElementById('history-status-filter').value;
    
    // Sort transactions reverse-chronologically (newest first)
    list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    const tbody = document.getElementById('tbody-repair-history');
    tbody.innerHTML = '';

    let matchCount = 0;

    list.forEach(tx => {
        // Apply text filter
        const matchesSearch = tx.repair_number.toLowerCase().includes(searchQuery) || 
                              tx.customer_name.toLowerCase().includes(searchQuery) ||
                              tx.customer_phone.includes(searchQuery);
        
        // Apply status filter
        const matchesStatus = statusFilter === 'ALL' || tx.status === statusFilter;

        if (matchesSearch && matchesStatus) {
            matchCount++;
            
            // Format status badge
            let badgeClass = 'badge warning';
            let statusLabel = tx.status;
            if (tx.status === 'Synced') {
                badgeClass = 'badge success';
                statusLabel = 'Synced';
            } else if (tx.status === 'Completed') {
                badgeClass = 'badge primary';
                statusLabel = 'Selesai';
            } else if (tx.status === 'Draft') {
                badgeClass = 'badge';
                statusLabel = 'Draft';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${tx.repair_number}</strong></td>
                <td>${formatSimpleDate(tx.date)}</td>
                <td>${formatSimpleDate(tx.deadline)}</td>
                <td>
                    <div><strong>${tx.customer_name}</strong></div>
                    <div style="font-size:11px; color:var(--text-muted);">${tx.customer_phone}</div>
                </td>
                <td>${tx.store_sales_name.split(' (')[0]}</td>
                <td><strong>${formatRupiah(tx.total_price)}</strong></td>
                <td>${formatRupiah(tx.dp1_amount + tx.dp2_amount)}</td>
                <td><span class="${badgeClass}">${statusLabel}</span></td>
                <td>
                    <div class="action-buttons-flex">
                        <button class="action-btn-circle btn-h-progress" data-id="${tx.repair_number}" title="Detail & Progress Pelacakan" style="background: rgba(197, 168, 92, 0.15); color: var(--gold); border-color: var(--gold);"><i class="fa-solid fa-bars-progress"></i></button>
                        <button class="action-btn-circle btn-h-print-form" data-id="${tx.repair_number}" title="Cetak Form Pengerjaan"><i class="fa-solid fa-file-invoice"></i></button>
                        <button class="action-btn-circle btn-h-print-receipt" data-id="${tx.repair_number}" title="Cetak Nota"><i class="fa-solid fa-receipt"></i></button>
                        <button class="action-btn-circle btn-h-whatsapp" data-id="${tx.repair_number}" title="Kirim Resi via WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
                        <button class="action-btn-circle btn-h-edit" data-id="${tx.repair_number}" title="Edit Data"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="action-btn-circle trash btn-h-delete" data-id="${tx.repair_number}" title="Hapus"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    if (matchCount === 0) {
        tbody.innerHTML = `<tr class="table-empty-row"><td colspan="9">Tidak ada riwayat transaksi repair ditemukan.</td></tr>`;
    }

    // Bind item actions click listeners
    document.querySelectorAll('.btn-h-progress').forEach(btn => {
        btn.addEventListener('click', () => showSalesDetailModal(btn.dataset.id));
    });
    document.querySelectorAll('.btn-h-print-form').forEach(btn => {
        btn.addEventListener('click', () => showReceiptPrintModal(btn.dataset.id, 'FORM'));
    });
    document.querySelectorAll('.btn-h-print-receipt').forEach(btn => {
        btn.addEventListener('click', () => showReceiptPrintModal(btn.dataset.id, 'RECEIPT'));
    });
    document.querySelectorAll('.btn-h-whatsapp').forEach(btn => {
        btn.addEventListener('click', () => triggerWhatsAppNotification(btn.dataset.id));
    });
    document.querySelectorAll('.btn-h-edit').forEach(btn => {
        btn.addEventListener('click', () => triggerProtectedAction(btn.dataset.id, 'EDIT'));
    });
    document.querySelectorAll('.btn-h-delete').forEach(btn => {
        btn.addEventListener('click', () => triggerProtectedAction(btn.dataset.id, 'DELETE'));
    });
}

// Handles verification workflow for protected actions (Edit/Delete)
function triggerProtectedAction(repairNum, actionType) {
    if (State.currentUser.role === 'Admin') {
        executeProtectedAction(repairNum, actionType);
    } else {
        // Sales / other role requires explicit admin approval
        const modal = document.getElementById('admin-auth-modal');
        modal.classList.remove('hidden');
        document.getElementById('auth-admin-username').value = '';
        document.getElementById('auth-admin-password').value = '';
        document.getElementById('auth-error-msg').classList.add('hidden');
        
        // Define temporarily in modal element for click handlers to read
        modal.dataset.pendingNum = repairNum;
        modal.dataset.pendingAction = actionType;
    }
}

async function executeProtectedAction(repairNum, actionType) {
    const txs = await getLocalData('repair_transactions');
    const match = txs.find(t => t.repair_number === repairNum);
    if (!match) return;

    if (actionType === 'EDIT') {
        populateFormForEdit(match);
        showToast(`Form repair ${repairNum} berhasil dimuat untuk pengeditan!`, 'info');
    } else if (actionType === 'DELETE') {
        if (confirm(`Apakah Anda yakin ingin menghapus data repair ${repairNum}?`)) {
            await deleteLocalData('repair_transactions', repairNum);
            
            // Queue sync deletion task to sheets
            await queueSyncTask('DELETE_REPAIR', { repair_number: repairNum });
            
            showToast(`Repair ${repairNum} berhasil dihapus dari perangkat!`, 'success');
            await refreshAllData();
        }
    }
}

// --- RENDERING SUBSIDIARY OPERATIONAL BOARDS ---

async function renderAccountingBoard() {
    const list = await getLocalData('repair_transactions');

    // 1. Calculate P&L global stats
    let totalOmset = 0;
    let totalPiutang = 0;
    let totalHpp = 0;
    let totalLaba = 0;

    list.forEach(tx => {
        const dpTotal = (parseFloat(tx.dp1_amount) || 0) + (parseFloat(tx.dp2_amount) || 0);
        const totalPrice = parseFloat(tx.total_price) || 0;
        const outstanding = totalPrice - dpTotal;

        totalOmset += totalPrice;
        if (outstanding > 0) {
            totalPiutang += outstanding;
        }

        const hppVal = calculateTransactionHPP(tx);
        totalHpp += hppVal;
    });

    totalLaba = totalOmset - totalHpp;

    document.getElementById('acc-stat-total-omset').textContent = formatRupiah(totalOmset);
    document.getElementById('acc-stat-total-piutang').textContent = formatRupiah(totalPiutang);
    document.getElementById('acc-stat-total-hpp').textContent = formatRupiah(totalHpp);
    document.getElementById('acc-stat-total-laba').textContent = formatRupiah(totalLaba);

    // 2. Multi-priority Sorting
    function getAccountingPriorityScore(tx) {
        if (tx.dp_approval === 'Pending') {
            return 1;
        }
        if (tx.pelunasan_approval === 'Pending' && ((parseFloat(tx.dp2_amount) || 0) > 0 || tx.dp2_method)) {
            return 2;
        }
        const dp1 = parseFloat(tx.dp1_amount) || 0;
        const totalPrice = parseFloat(tx.total_price) || 0;
        if (dp1 > totalPrice && (!tx.refund_receipt_url || tx.refund_receipt_url === '' || tx.refund_receipt_url === '[Gagal Upload]')) {
            return 3;
        }
        return 4;
    }

    list.sort((a, b) => {
        const scoreA = getAccountingPriorityScore(a);
        const scoreB = getAccountingPriorityScore(b);
        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    const tbody = document.getElementById('tbody-accounting-repairs');
    tbody.innerHTML = '';

    let records = 0;

    list.forEach(tx => {
        records++;
        const dpTotal = (parseFloat(tx.dp1_amount) || 0) + (parseFloat(tx.dp2_amount) || 0);
        const totalPrice = parseFloat(tx.total_price) || 0;
        const outstanding = totalPrice - dpTotal;
        const payStatus = outstanding <= 0 ? 'Lunas' : 'Belum Lunas';
        const badgeClass = outstanding <= 0 ? 'badge success' : 'badge danger';

        const hppVal = calculateTransactionHPP(tx);

        // Build clickable thumbnails
        let mediaHtml = '<div style="display:flex; gap:6px; flex-wrap:wrap;">';
        let mediaCount = 0;
        if (tx.dp1_receipt_url && tx.dp1_receipt_url !== '[Gagal Upload Gambar]') {
            mediaHtml += `<img src="${tx.dp1_receipt_url}" class="img-thumbnail-link" data-url="${tx.dp1_receipt_url}" data-caption="Bukti DP 1 - ${tx.repair_number}" title="Bukti DP 1">`;
            mediaCount++;
        }
        if (tx.dp2_receipt_url && tx.dp2_receipt_url !== '[Gagal Upload Gambar]') {
            mediaHtml += `<img src="${tx.dp2_receipt_url}" class="img-thumbnail-link" data-url="${tx.dp2_receipt_url}" data-caption="Bukti DP 2 / Pelunasan - ${tx.repair_number}" title="Bukti DP 2 / Pelunasan">`;
            mediaCount++;
        }
        if (tx.warranty_image_url && tx.warranty_image_url !== '[Gagal Upload Gambar]') {
            mediaHtml += `<img src="${tx.warranty_image_url}" class="img-thumbnail-link" data-url="${tx.warranty_image_url}" data-caption="Kartu Garansi - ${tx.repair_number}" title="Kartu Garansi">`;
            mediaCount++;
        }
        if (tx.refund_receipt_url && tx.refund_receipt_url !== '[Gagal Upload]') {
            mediaHtml += `<img src="${tx.refund_receipt_url}" class="img-thumbnail-link" data-url="${tx.refund_receipt_url}" data-caption="Bukti Refund DP - ${tx.repair_number}" title="Bukti Refund DP">`;
            mediaCount++;
        }
        if (mediaCount === 0) {
            mediaHtml += '<span style="color:var(--text-muted); font-size:11px;">Tidak ada bukti</span>';
        }
        mediaHtml += '</div>';

        // Actions flex
        let actionsHtml = `<div class="action-buttons-flex" style="flex-direction:column; gap:4px; align-items:flex-start;">`;

        if (tx.dp_approval === 'Pending') {
            actionsHtml += `<button class="premium-btn btn-acc-approve-dp" data-id="${tx.repair_number}" style="padding: 4px 8px; font-size: 11px; width: 100%; text-align: left;"><i class="fa-solid fa-circle-check"></i> Setujui DP</button>`;
        }
        if (tx.pelunasan_approval === 'Pending' && ((parseFloat(tx.dp2_amount) || 0) > 0 || tx.dp2_method)) {
            actionsHtml += `<button class="premium-btn btn-acc-approve-pelunasan" data-id="${tx.repair_number}" style="padding: 4px 8px; font-size: 11px; width: 100%; text-align: left;"><i class="fa-solid fa-circle-check"></i> Setujui Pelunasan</button>`;
        }

        const dp1Val = parseFloat(tx.dp1_amount) || 0;
        const totalVal = parseFloat(tx.total_price) || 0;
        if (dp1Val > totalVal && (!tx.refund_receipt_url || tx.refund_receipt_url === '' || tx.refund_receipt_url === '[Gagal Upload]')) {
            actionsHtml += `
            <div style="width: 100%;">
                <label class="premium-btn btn-accent" style="padding: 4px 8px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; width: 100%; box-sizing: border-box;">
                    <i class="fa-solid fa-upload"></i> Bukti Refund
                    <input type="file" class="input-refund-file" data-id="${tx.repair_number}" accept="image/*" style="display: none;">
                </label>
            </div>`;
        }

        actionsHtml += `
            <button class="action-btn-circle btn-acc-update" data-id="${tx.repair_number}" title="Update Pembayaran / Pelunasan" style="align-self: center;"><i class="fa-solid fa-circle-dollar-to-slot"></i></button>
        </div>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${tx.repair_number}</strong></td>
            <td>${tx.customer_name}</td>
            <td>${mediaHtml}</td>
            <td>${formatRupiah(totalPrice)}</td>
            <td><strong>${formatRupiah(hppVal)}</strong></td>
            <td>${formatRupiah(dpTotal)}</td>
            <td><strong class="${outstanding > 0 ? 'text-gradient' : ''}">${formatRupiah(Math.max(0, outstanding))}</strong></td>
            <td><span class="${badgeClass}">${payStatus}</span></td>
            <td>${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    if (records === 0) {
        tbody.innerHTML = `<tr class="table-empty-row"><td colspan="9">Belum ada data keuangan.</td></tr>`;
    }

    // Attach listener to update payment DP 2 / Edit Payment
    document.querySelectorAll('.btn-acc-update').forEach(btn => {
        btn.addEventListener('click', async () => {
            const txs = await getLocalData('repair_transactions');
            const match = txs.find(t => t.repair_number === btn.dataset.id);
            if (match) {
                populateFormForEdit(match);
                showToast(`Formulir pembayaran ${match.repair_number} siap disesuaikan di Sales Tab!`, 'info');
                switchPanel('sales-panel');
            }
        });
    });

    // DP Approval Listener
    tbody.querySelectorAll('.btn-acc-approve-dp').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            showToast('Memproses approval DP...', 'info');
            try {
                const txs = await getLocalData('repair_transactions');
                const match = txs.find(t => t.repair_number === id);
                if (match) {
                    match.dp_approval = 'Approved';
                    match.status = 'Pending Sync';
                    await saveLocalData('repair_transactions', match);
                }
                
                await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: id, dp_approval: 'Approved' });
                runBackgroundSync();
                
                showToast(`DP untuk perbaikan ${id} berhasil disetujui!`, 'success');
                await renderAccountingBoard();
            } catch (err) {
                console.error(err);
                showToast('Gagal menyetujui DP.', 'error');
            }
        });
    });

    // Pelunasan Approval Listener
    tbody.querySelectorAll('.btn-acc-approve-pelunasan').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            showToast('Memproses approval pelunasan...', 'info');
            try {
                const txs = await getLocalData('repair_transactions');
                const match = txs.find(t => t.repair_number === id);
                if (match) {
                    match.pelunasan_approval = 'Approved';
                    match.status = 'Pending Sync';
                    await saveLocalData('repair_transactions', match);
                }
                
                await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: id, pelunasan_approval: 'Approved' });
                runBackgroundSync();
                
                showToast(`Pelunasan untuk perbaikan ${id} berhasil disetujui!`, 'success');
                await renderAccountingBoard();
            } catch (err) {
                console.error(err);
                showToast('Gagal menyetujui pelunasan.', 'error');
            }
        });
    });

    // Refund Upload Listener
    tbody.querySelectorAll('.input-refund-file').forEach(input => {
        input.addEventListener('change', async (e) => {
            const id = input.dataset.id;
            const file = e.target.files[0];
            if (!file) return;
            
            showToast('Membaca file & mengunggah bukti refund...', 'info');
            try {
                const base64Data = await getFileBase64(file);
                const txs = await getLocalData('repair_transactions');
                const match = txs.find(t => t.repair_number === id);
                if (match) {
                    match.refund_receipt_url = base64Data;
                    match.status = 'Pending Sync';
                    await saveLocalData('repair_transactions', match);
                }
                
                await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: id, refund_receipt_url: base64Data });
                runBackgroundSync();
                
                showToast(`Bukti refund perbaikan ${id} berhasil diunggah!`, 'success');
                await renderAccountingBoard();
            } catch (err) {
                console.error(err);
                showToast('Gagal mengunggah bukti refund.', 'error');
            }
        });
    });
}

async function renderProductionBoard() {
    const list = await getLocalData('repair_transactions');
    list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    const tbody = document.getElementById('tbody-production-list');
    tbody.innerHTML = '';
    let count = 0;

    list.forEach(tx => {
        // Filter out transactions that do not have dp_approval === 'Approved'
        if (tx.dp_approval !== 'Approved') {
            return;
        }

        count++;
        // Fetch metals & repair names
        const cowokMetal = State.masterData.metals.find(m => m.id === tx.cowok_material);
        const cowokRep = State.masterData.repairs.find(r => r.id === tx.cowok_repair_type);
        const cewekMetal = State.masterData.metals.find(m => m.id === tx.cewek_material);
        const cewekRep = State.masterData.repairs.find(r => r.id === tx.cewek_repair_type);

        const cowokDesc = tx.cowok_active === 'TRUE' ? `
            <div>${cowokMetal?.name || ''} (Sz: ${tx.cowok_size}) - ${cowokRep?.name || ''}</div>
            <div style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap;">
                ${tx.cowok_image_url && tx.cowok_image_url !== '[Gagal Upload Gambar]' ? `<img src="${tx.cowok_image_url}" class="img-thumbnail-link" data-url="${tx.cowok_image_url}" data-caption="Foto Model Cowok - ${tx.repair_number}" title="Foto Model Cowok" style="width:30px; height:30px; border-radius:4px; object-fit:cover; border:1px solid var(--border-color); cursor:pointer;">` : ''}
                ${tx.render_model_url && tx.render_model_url !== '[Gagal Upload]' ? `<img src="${tx.render_model_url}" class="img-thumbnail-link" data-url="${tx.render_model_url}" data-caption="Render 3D Cowok - ${tx.repair_number}" title="Render 3D" style="width:30px; height:30px; border-radius:4px; object-fit:cover; border:1px solid var(--border-color); cursor:pointer;">` : ''}
                ${tx.realpict_url && tx.realpict_url !== '[Gagal Upload]' ? `<img src="${tx.realpict_url}" class="img-thumbnail-link" data-url="${tx.realpict_url}" data-caption="Realpict Cowok - ${tx.repair_number}" title="Realpict" style="width:30px; height:30px; border-radius:4px; object-fit:cover; border:1px solid var(--border-color); cursor:pointer;">` : ''}
            </div>
        ` : '<em>Nonaktif</em>';

        let cewekDesc = tx.cewek_active === 'TRUE' ? `
            <div>${cewekMetal?.name || ''} (Sz: ${tx.cewek_size}) - ${cewekRep?.name || ''}</div>
            <div style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap;">
                ${tx.cewek_image_url && tx.cewek_image_url !== '[Gagal Upload Gambar]' ? `<img src="${tx.cewek_image_url}" class="img-thumbnail-link" data-url="${tx.cewek_image_url}" data-caption="Foto Model Cewek - ${tx.repair_number}" title="Foto Model Cewek" style="width:30px; height:30px; border-radius:4px; object-fit:cover; border:1px solid var(--border-color); cursor:pointer;">` : ''}
                ${tx.render_model_url && tx.render_model_url !== '[Gagal Upload]' ? `<img src="${tx.render_model_url}" class="img-thumbnail-link" data-url="${tx.render_model_url}" data-caption="Render 3D Cewek - ${tx.repair_number}" title="Render 3D" style="width:30px; height:30px; border-radius:4px; object-fit:cover; border:1px solid var(--border-color); cursor:pointer;">` : ''}
                ${tx.realpict_url && tx.realpict_url !== '[Gagal Upload]' ? `<img src="${tx.realpict_url}" class="img-thumbnail-link" data-url="${tx.realpict_url}" data-caption="Realpict Cewek - ${tx.repair_number}" title="Realpict" style="width:30px; height:30px; border-radius:4px; object-fit:cover; border:1px solid var(--border-color); cursor:pointer;">` : ''}
            </div>
        ` : '<em>Nonaktif</em>';

        // Workshop assignment
        const currentWorkshop = tx.assigned_workshop || 'Belum Ditugaskan';

        // Production Status
        let statusBadge = `<span class="badge warning">Antrean</span>`;
        if (tx.production_status === 'Active') {
            statusBadge = `<span class="badge primary">Pengerjaan</span>`;
        } else if (tx.production_status === 'Completed') {
            statusBadge = `<span class="badge success">Selesai</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${tx.repair_number}</strong></td>
            <td><div style="font-size:11px;">${cowokDesc}</div></td>
            <td><div style="font-size:11px;">${cewekDesc}</div></td>
            <td><strong>${currentWorkshop}</strong></td>
            <td>${formatSimpleDate(tx.deadline)}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="action-buttons-flex" style="flex-direction:column; gap:4px; align-items:flex-start;">
                    <div style="display:flex; gap:4px;">
                        <button class="action-btn-circle btn-prod-assign" data-id="${tx.repair_number}" title="Delegasikan Pengrajin"><i class="fa-solid fa-hammer"></i></button>
                        <button class="action-btn-circle btn-prod-complete" data-id="${tx.repair_number}" title="Tandai Selesai"><i class="fa-solid fa-circle-check"></i></button>
                    </div>
                    
                    <div style="width: 100%;">
                        <label class="premium-btn" style="padding: 4px 8px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; width: 100%; box-sizing: border-box;">
                            <i class="fa-solid fa-upload"></i> Render Model
                            <input type="file" class="input-prod-render" data-id="${tx.repair_number}" accept="image/*" style="display: none;">
                        </label>
                    </div>
                    
                    <div style="width: 100%;">
                        <label class="premium-btn btn-accent" style="padding: 4px 8px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; width: 100%; box-sizing: border-box;">
                            <i class="fa-solid fa-upload"></i> Realpict Cincin
                            <input type="file" class="input-prod-realpict" data-id="${tx.repair_number}" accept="image/*" style="display: none;">
                        </label>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (count === 0) {
        tbody.innerHTML = `<tr class="table-empty-row"><td colspan="7">Belum ada tugas pengerjaan perhiasan.</td></tr>`;
    }

    // Attach listeners
    document.querySelectorAll('.btn-prod-assign').forEach(btn => {
        btn.addEventListener('click', () => showProductionAssignModal(btn.dataset.id));
    });
    document.querySelectorAll('.btn-prod-complete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const repairNum = btn.dataset.id;
            if (confirm(`Tandai pengerjaan cincin pada transaksi ${repairNum} selesai di workshop?`)) {
                const txs = await getLocalData('repair_transactions');
                const match = txs.find(t => t.repair_number === repairNum);
                if (match) {
                    match.production_status = 'Completed';
                    match.status = 'Pending Sync';
                    await saveLocalData('repair_transactions', match);
                    await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: repairNum, production_status: 'Completed' });
                    showToast(`Repair ${repairNum} selesai pengerjaan! Diteruskan ke Logistik.`, 'success');
                    await refreshAllData();
                }
            }
        });
    });

    // Render Model File Upload Listener
    tbody.querySelectorAll('.input-prod-render').forEach(input => {
        input.addEventListener('change', async (e) => {
            const id = input.dataset.id;
            const file = e.target.files[0];
            if (!file) return;
            
            showToast('Membaca file & mengunggah render model...', 'info');
            try {
                const base64Data = await getFileBase64(file);
                const txs = await getLocalData('repair_transactions');
                const match = txs.find(t => t.repair_number === id);
                if (match) {
                    match.render_model_url = base64Data;
                    match.render_approval = 'Pending';
                    match.status = 'Pending Sync';
                    await saveLocalData('repair_transactions', match);
                }
                
                await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: id, render_model_url: base64Data, render_approval: 'Pending' });
                runBackgroundSync();
                
                showToast(`Gambar Render Model perbaikan ${id} berhasil diunggah!`, 'success');
                await refreshAllData();
            } catch (err) {
                console.error(err);
                showToast('Gagal mengunggah gambar render model.', 'error');
            }
        });
    });

    // Realpict File Upload Listener
    tbody.querySelectorAll('.input-prod-realpict').forEach(input => {
        input.addEventListener('change', async (e) => {
            const id = input.dataset.id;
            const file = e.target.files[0];
            if (!file) return;
            
            showToast('Membaca file & mengunggah realpict...', 'info');
            try {
                const base64Data = await getFileBase64(file);
                const txs = await getLocalData('repair_transactions');
                const match = txs.find(t => t.repair_number === id);
                if (match) {
                    match.realpict_url = base64Data;
                    match.realpict_approval = 'Pending';
                    match.status = 'Pending Sync';
                    await saveLocalData('repair_transactions', match);
                }
                
                await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: id, realpict_url: base64Data, realpict_approval: 'Pending' });
                runBackgroundSync();
                
                showToast(`Foto Realpict cincin perbaikan ${id} berhasil diunggah!`, 'success');
                await refreshAllData();
            } catch (err) {
                console.error(err);
                showToast('Gagal mengunggah foto realpict.', 'error');
            }
        });
    });
}

function showProductionAssignModal(repairNum) {
    let wksOptions = '<option value="" disabled selected>Pilih Pengrajin</option>';
    State.masterData.workshops.forEach(w => {
        wksOptions += `<option value="${w.name}">${w.name}</option>`;
    });

    const fields = `
        <input type="hidden" id="crud-p-repnum" value="${repairNum}">
        <div class="form-group">
            <label for="crud-p-wks">Pilih Bengkel Pengrajin (Workshop)</label>
            <select id="crud-p-wks" required>
                ${wksOptions}
            </select>
        </div>
    `;

    document.getElementById('crud-modal-title').textContent = `Delegasi Pengrajin (${repairNum})`;
    document.getElementById('crud-form-fields').innerHTML = fields;
    
    const crudModal = document.getElementById('crud-modal');
    crudModal.classList.remove('hidden');
    crudModal.dataset.crudType = 'PRODUCTION_ASSIGN';
}

async function renderLogisticBoard() {
    const list = await getLocalData('repair_transactions');
    list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    const tbody = document.getElementById('tbody-logistic-list');
    tbody.innerHTML = '';
    let count = 0;

    list.forEach(tx => {
        count++;
        const statusLabel = tx.logistic_status || 'Gudang HQ';
        const trackingNum = tx.logistic_receipt_no || 'Belum Dikirim';
        
        let badgeClass = 'badge warning';
        if (tx.logistic_status === 'Shipped') badgeClass = 'badge success';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${tx.repair_number}</strong></td>
            <td>${tx.customer_name}</td>
            <td>
                <div style="font-size:11.5px;">${tx.customer_address}</div>
                <div style="font-size:10px; color:var(--text-muted);">${tx.customer_city}</div>
            </td>
            <td>
                <div>Layanan Ekspedisi</div>
                <div style="font-size:11px; color:var(--text-muted);">Biaya: ${formatRupiah(tx.shipping_fee)}</div>
            </td>
            <td><span class="${badgeClass}">${statusLabel}</span></td>
            <td><strong>${trackingNum}</strong></td>
            <td>
                <div class="action-buttons-flex">
                    <button class="action-btn-circle btn-log-ship" data-id="${tx.repair_number}" title="Input Nomor Resi Kurir"><i class="fa-solid fa-truck-fast"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (count === 0) {
        tbody.innerHTML = `<tr class="table-empty-row"><td colspan="7">Belum ada pengiriman paket.</td></tr>`;
    }

    // Attach listeners
    document.querySelectorAll('.btn-log-ship').forEach(btn => {
        btn.addEventListener('click', () => showLogisticShipModal(btn.dataset.id));
    });
}

function showLogisticShipModal(repairNum) {
    const fields = `
        <input type="hidden" id="crud-l-repnum" value="${repairNum}">
        <div class="form-group">
            <label for="crud-l-receipt">Masukkan Nomor Resi Ekspedisi (JNE/J&T/Sicepat)</label>
            <input type="text" id="crud-l-receipt" placeholder="Contoh: JNE882201923" required>
        </div>
    `;

    document.getElementById('crud-modal-title').textContent = `Input Resi Kirim (${repairNum})`;
    document.getElementById('crud-form-fields').innerHTML = fields;
    
    const crudModal = document.getElementById('crud-modal');
    crudModal.classList.remove('hidden');
    crudModal.dataset.crudType = 'LOGISTIC_SHIP';
}

// ==========================================================================
// 6. WHATSAPP & PRINT LAYOUT BUILDER
// ==========================================================================

// Prepares and shows thermal / letterhead print layouts
async function showReceiptPrintModal(repairNum, type = 'RECEIPT') {
    const txs = await getLocalData('repair_transactions');
    const tx = txs.find(t => t.repair_number === repairNum);
    if (!tx) return;

    const modalBody = document.getElementById('print-receipt-body');
    
    // Core details rendering
    const cowokMetal = State.masterData.metals.find(m => m.id === tx.cowok_material);
    const cowokRep = State.masterData.repairs.find(r => r.id === tx.cowok_repair_type);
    const cewekMetal = State.masterData.metals.find(m => m.id === tx.cewek_material);
    const cewekRep = State.masterData.repairs.find(r => r.id === tx.cewek_repair_type);

    const isCowok = tx.cowok_active === 'TRUE';
    const isCewek = tx.cewek_active === 'TRUE';

    // Build extra items rows html
    const addItems = JSON.parse(tx.additional_items_json || '[]');
    let itemsRowsHtml = '';
    if (addItems.length > 0) {
        addItems.forEach(item => {
            itemsRowsHtml += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.qty}</td>
                    <td>${formatRupiah(item.price)}</td>
                    <td>${formatRupiah(item.subtotal)}</td>
                </tr>
            `;
        });
    } else {
        itemsRowsHtml = `<tr><td colspan="4" style="text-align:center; color:#777;">Tidak ada barang/jasa tambahan</td></tr>`;
    }

    const receiptTitle = type === 'FORM' ? 'SURAT PENGERJAAN REPAIR JEWELRY' : 'BUKTI TANDA TERIMA REPAIR';

    modalBody.innerHTML = `
        <div class="print-document">
            <div class="preview-invoice-head">
                <div class="preview-company-info">
                    <img src="https://soviajewelry.com/wp-content/uploads/2022/08/NEW-LOGO-SOVIA-COLOUR-4.png" alt="Sovia Jewelry">
                    <h3 style="margin-bottom: 2px;">SOVIA JEWELRY</h3>
                    <p>Jl. Mertosanan, Kel. Potorono, Kec. Banguntapan, Kab. Bantul, DI Yogyakarta</p>
                    <p>Telepon: +62 888-999-11122 | Web: soviajewelry.com</p>
                </div>
                <div class="preview-tx-meta">
                    <h3 style="text-transform:uppercase;">${receiptTitle}</h3>
                    <p><strong>Nomor:</strong> ${tx.repair_number}</p>
                    <p><strong>Tanggal Repair:</strong> ${formatSimpleDate(tx.date)}</p>
                    <p><strong>Target Deadline:</strong> <span style="color:#e67e22; font-weight:700;">${formatSimpleDate(tx.deadline)}</span></p>
                </div>
            </div>

            <div class="preview-cust-section">
                <h4>DATA CUSTOMER</h4>
                <div class="preview-details-grid">
                    <div class="preview-details-row">
                        <span>Nama Lengkap:</span>
                        <strong>${tx.customer_name}</strong>
                    </div>
                    <div class="preview-details-row">
                        <span>Nomor WhatsApp:</span>
                        <strong>${tx.customer_phone}</strong>
                    </div>
                    <div class="preview-details-row" style="grid-column: span 2;">
                        <span>Alamat Pengiriman:</span>
                        <strong>${tx.customer_address} (${tx.customer_city})</strong>
                    </div>
                </div>
            </div>

            <div class="preview-rings-container">
                <!-- Ring Cowok -->
                <div class="preview-ring-card" style="display: ${isCowok ? 'block' : 'none'};">
                    <h4><i class="fa-solid fa-mars"></i> DETAIL CINCIN COWOK</h4>
                    <div class="preview-ring-card-body">
                        <div class="preview-details-row">
                            <span>Bahan Logam:</span>
                            <strong>${cowokMetal ? cowokMetal.name : '-'}</strong>
                        </div>
                        <div class="preview-details-row">
                            <span>Berat Cincin:</span>
                            <strong>${tx.cowok_weight} gram</strong>
                        </div>
                        <div class="preview-details-row">
                            <span>Ukuran Cincin:</span>
                            <strong>${tx.cowok_size}</strong>
                        </div>
                        <div class="preview-details-row">
                            <span>Jenis Repair:</span>
                            <strong>${cowokRep ? cowokRep.name : '-'}</strong>
                        </div>
                        <div class="preview-details-row">
                            <span>Grafir Ukir Nama:</span>
                            <strong>${tx.cowok_engraving || 'Tidak ada'}</strong>
                        </div>
                        <div style="font-size:11.5px; margin-top:8px;">
                            <span><strong>Catatan Desain:</strong></span>
                            <div style="color:#555; background:#f9f9f9; padding:8px; border:1px solid #eee; margin-top:4px;">
                                ${tx.cowok_notes || 'Tidak ada catatan model'}
                            </div>
                        </div>
                        ${tx.cowok_image_url && type === 'FORM' ? `
                        <div style="margin-top:10px;">
                            <span><strong>Model Model Cincin:</strong></span>
                            <div class="preview-ring-model-img">
                                <img src="${tx.cowok_image_url}" alt="Model Cowok">
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Ring Cewek -->
                <div class="preview-ring-card" style="display: ${isCewek ? 'block' : 'none'};">
                    <h4><i class="fa-solid fa-venus"></i> DETAIL CINCIN CEWEK</h4>
                    <div class="preview-ring-card-body">
                        <div class="preview-details-row">
                            <span>Bahan Logam:</span>
                            <strong>${cewekMetal ? cewekMetal.name : '-'}</strong>
                        </div>
                        <div class="preview-details-row">
                            <span>Berat Cincin:</span>
                            <strong>${tx.cewek_weight} gram</strong>
                        </div>
                        <div class="preview-details-row">
                            <span>Ukuran Cincin:</span>
                            <strong>${tx.cewek_size}</strong>
                        </div>
                        <div class="preview-details-row">
                            <span>Jenis Repair:</span>
                            <strong>${cewekRep ? cewekRep.name : '-'}</strong>
                        </div>
                        <div class="preview-details-row">
                            <span>Grafir Ukir Nama:</span>
                            <strong>${tx.cewek_engraving || 'Tidak ada'}</strong>
                        </div>
                        <div style="font-size:11.5px; margin-top:8px;">
                            <span><strong>Catatan Desain:</strong></span>
                            <div style="color:#555; background:#f9f9f9; padding:8px; border:1px solid #eee; margin-top:4px;">
                                ${tx.cewek_notes || 'Tidak ada catatan model'}
                            </div>
                        </div>
                        ${tx.cewek_image_url && type === 'FORM' ? `
                        <div style="margin-top:10px;">
                            <span><strong>Model Model Cincin:</strong></span>
                            <div class="preview-ring-model-img">
                                <img src="${tx.cewek_image_url}" alt="Model Cewek">
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="preview-additional-section">
                <h4>BARANG & LAYANAN TAMBAHAN</h4>
                <table class="premium-table" style="font-size: 11px;">
                    <thead>
                        <tr>
                            <th>Nama Barang / Jasa</th>
                            <th style="width: 60px;">Qty</th>
                            <th>Harga Satuan</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRowsHtml}
                    </tbody>
                </table>
            </div>

            <div class="preview-pricing-grid">
                <div>
                    <p style="font-size: 11px; line-height: 1.5; color:#555;">
                        * **Syarat & Ketentuan Repair Cincin SOVIA JEWELRY:**<br>
                        1. Periksa kembali ukuran cincin, ukir nama, dan logam saat penerimaan resi ini.<br>
                        2. Pekerjaan disesuaikan dengan instruksi tertulis di form ini.<br>
                        3. Pengambilan barang wajib melampirkan resi fisik / digital ini.
                    </p>
                </div>
                
                <div class="preview-cost-summary">
                    <div class="preview-cost-line">
                        <span>Biaya Cincin Cowok:</span>
                        <strong>${formatRupiah(tx.cowok_price)}</strong>
                    </div>
                    <div class="preview-cost-line">
                        <span>Biaya Cincin Cewek:</span>
                        <strong>${formatRupiah(tx.cewek_price)}</strong>
                    </div>
                    <div class="preview-cost-line">
                        <span>Layanan Tambahan:</span>
                        <strong>${formatRupiah(tx.additional_total)}</strong>
                    </div>
                    <div class="preview-cost-line">
                        <span>Ongkos Kirim Paket:</span>
                        <strong>${formatRupiah(tx.shipping_fee)}</strong>
                    </div>
                    <div class="preview-cost-line total">
                        <span>Total Tagihan:</span>
                        <h3>${formatRupiah(tx.total_price)}</h3>
                    </div>
                    <div class="preview-cost-line" style="color:var(--green); font-weight:700;">
                        <span>Jumlah DP Dibayarkan:</span>
                        <strong>${formatRupiah(tx.dp1_amount + tx.dp2_amount)}</strong>
                    </div>
                    <div class="preview-cost-line" style="border-top:1px dashed rgba(0,0,0,0.1); padding-top:6px; font-weight:700;">
                        <span>Sisa Pembayaran:</span>
                        <strong>${formatRupiah(tx.total_price - (tx.dp1_amount + tx.dp2_amount))}</strong>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size:11px; text-align:center;">
                <div style="width: 150px;">
                    <p>Hormat Kami,</p>
                    <br><br><br>
                    <p><strong>(${tx.store_sales_name.split(' (')[0]})</strong></p>
                    <p>Sales Toko</p>
                </div>
                <div style="width: 150px;">
                    <p>Customer Pelanggan,</p>
                    <br><br><br>
                    <p><strong>(${tx.customer_name})</strong></p>
                    <p>Tanda Tangan</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('print-modal').classList.remove('hidden');
}

// Builds formatted WhatsApp templates and calls WA direct linking protocol
async function triggerWhatsAppNotification(repairNum) {
    const txs = await getLocalData('repair_transactions');
    const tx = txs.find(t => t.repair_number === repairNum);
    if (!tx) return;

    // Clean phone number (replace starting '0' with country code '62')
    let rawPhone = tx.customer_phone.trim().replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
        rawPhone = '62' + rawPhone.substring(1);
    }

    const dpTotal = tx.dp1_amount + tx.dp2_amount;
    const remaining = tx.total_price - dpTotal;

    // Build message body
    let msg = `*NOTA TRANSAKSI REPAIR CINCIN - SOVIA JEWELRY*\n`;
    msg += `------------------------------------------------------------\n`;
    msg += `Halo Kak *${tx.customer_name}*,\n`;
    msg += `Terima kasih telah mempercayakan perbaikan cincin Anda di SOVIA JEWELRY. Berikut adalah rincian data transaksi repair Anda:\n\n`;
    msg += `*Nomor Repair:* ${tx.repair_number}\n`;
    msg += `*Tanggal Masuk:* ${formatSimpleDate(tx.date)}\n`;
    msg += `*Target Selesai:* ${formatSimpleDate(tx.deadline)}\n`;
    msg += `*Sales Terkait:* ${tx.store_sales_name.split(' (')[0]}\n\n`;
    
    if (tx.cowok_active === 'TRUE') {
        const metal = State.masterData.metals.find(m => m.id === tx.cowok_material);
        const rep = State.masterData.repairs.find(r => r.id === tx.cowok_repair_type);
        msg += `*Cincin Cowok:* ${metal?.name || ''} (Sz: ${tx.cowok_size})\n`;
        msg += `- Layanan: ${rep?.name || ''}\n`;
        if (tx.cowok_engraving) msg += `- Ukir Nama: "${tx.cowok_engraving}"\n`;
    }
    if (tx.cewek_active === 'TRUE') {
        const metal = State.masterData.metals.find(m => m.id === tx.cewek_material);
        const rep = State.masterData.repairs.find(r => r.id === tx.cewek_repair_type);
        msg += `*Cincin Cewek:* ${metal?.name || ''} (Sz: ${tx.cewek_size})\n`;
        msg += `- Layanan: ${rep?.name || ''}\n`;
        if (tx.cewek_engraving) msg += `- Ukir Nama: "${tx.cewek_engraving}"\n`;
    }

    const addItems = JSON.parse(tx.additional_items_json || '[]');
    if (addItems.length > 0) {
        msg += `\n*Layanan/Barang Tambahan:*\n`;
        addItems.forEach(item => {
            msg += `- ${item.name} (${item.qty}x) : ${formatRupiah(item.subtotal)}\n`;
        });
    }

    msg += `\n*RINCIAN BIAYA:*\n`;
    msg += `------------------------------------------------------------\n`;
    msg += `Total Tagihan: *${formatRupiah(tx.total_price)}*\n`;
    msg += `Total DP Masuk: *${formatRupiah(dpTotal)}*\n`;
    msg += `Sisa Tagihan: *${formatRupiah(remaining)}* ${remaining <= 0 ? '(LUNAS)' : ''}\n\n`;
    msg += `Alamat Pengiriman:\n_${tx.customer_address}_\n_${tx.customer_city}_\n\n`;
    msg += `Kakak bisa memantau status repair cincin Kakak secara berkala lewat sales kami. Terima kasih! ✨\n`;
    msg += `------------------------------------------------------------\n`;
    msg += `*SOVIA JEWELRY* - Sleman, Bantul, HQ Yogyakarta`;

    const encodedText = encodeURIComponent(msg);
    
    // Direct whatsapp URL link (opens WA application instantly on mobile/desktop without prompt browser middleman)
    const waUrl = `https://wa.me/${rawPhone}?text=${encodedText}`;
    
    // Open in window
    window.open(waUrl, '_blank');
    showToast('Membuka aplikasi WhatsApp...', 'success');
}

// ==========================================================================
// 7. OFFLINE-FIRST SYNC & LOCK ENGINE
// ==========================================================================

async function queueSyncTask(action, payload) {
    const task = {
        action,
        payload,
        timestamp: new Date().toISOString()
    };
    await saveLocalData('sync_queue', task);
    await updateSyncQueueDisplay();
}

async function updateSyncQueueDisplay() {
    const queue = await getLocalData('sync_queue');
    const badge = document.getElementById('sync-badge-count');
    const statPending = document.getElementById('stat-pending-sync');
    const syncStatusText = document.getElementById('sync-queue-status');
    const syncList = document.getElementById('sync-queue-list');

    // Stats counter
    if (badge) {
        if (queue.length > 0) {
            badge.classList.remove('hidden');
            badge.textContent = queue.length;
        } else {
            badge.classList.add('hidden');
        }
    }

    if (statPending) statPending.textContent = queue.length;
    if (syncStatusText) syncStatusText.textContent = `${queue.length} item menunggu sinkronisasi`;

    // Render Queue Items Lists in Dashboard Panel
    if (syncList) {
        syncList.innerHTML = '';
        if (queue.length === 0) {
            syncList.innerHTML = '<li class="empty-list-placeholder">Tidak ada antrean tertunda.</li>';
        } else {
            queue.forEach(item => {
                const li = document.createElement('li');
                let displayTitle = item.payload.repair_number || item.payload.id || 'Master Update';
                li.innerHTML = `
                    <span><strong>${displayTitle}</strong> - ${item.action}</span>
                    <span class="queue-badge-action">Lokal</span>
                `;
                syncList.appendChild(li);
            });
        }
    }
}

// The core background engine attempting synchronization with safety locking
async function runBackgroundSync() {
    // 1. Guard check connection status
    if (!navigator.onLine) {
        setSyncLockDisplay('offline');
        return;
    }

    // 2. Lock guard prevent concurrent thread processes
    if (State.syncLock) {
        return;
    }

    // 3. Obtain Sync Queue
    const queue = await getLocalData('sync_queue');
    if (queue.length === 0) {
        setSyncLockDisplay('idle');
        return;
    }

    // Acquire lock
    State.syncLock = true;
    setSyncLockDisplay('locked');
    showToast(`Memulai sinkronisasi ${queue.length} transaksi ke Sheets...`, 'info');

    // Run item-by-item queue drains
    const tx = State.db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    
    // We fetch cursor to process FIFO
    let processedCount = 0;
    
    try {
        for (const item of queue) {
            // Push payload to GAS api
            const success = await pushDataToGAS(item.action, item.payload);
            if (success) {
                // Delete from local queue store upon success
                await deleteFromQueueByTimestamp(item.timestamp);
                processedCount++;
            } else {
                // If it fails, stop execution and try again in next cycles
                throw new Error("Gagal menyambung ke server Google");
            }
        }
        if (processedCount > 0) {
            showToast(`Berhasil sinkronisasi ${processedCount} data ke Google Sheets!`, 'success');
        }
    } catch (err) {
        console.warn("Background Sync Error: ", err);
        showToast('Sinkronisasi ditunda (masalah jaringan atau API GAS).', 'warning');
    } finally {
        // Release Lock
        State.syncLock = false;
        setSyncLockDisplay('idle');
        await refreshAllData();
    }
}

// Dynamic POST request sender to Apps Script
async function pushDataToGAS(action, payload) {
    if (!CONFIG.GAS_API_URL) {
        // Mock Mode - if URL is empty, simulate successful sync after delay to demonstrate offline success!
        return new Promise(resolve => {
            setTimeout(async () => {
                // If action is SAVE_REPAIR or UPDATE, mark transaction status as Synced in local store
                if (action === 'SAVE_REPAIR' || action === 'UPDATE_REPAIR_STATUS') {
                    const txs = await getLocalData('repair_transactions');
                    const match = txs.find(t => t.repair_number === payload.repair_number);
                    if (match) {
                        match.status = 'Synced';
                        await saveLocalData('repair_transactions', match);
                    }
                }
                resolve(true);
            }, 1000);
        });
    }

    try {
        const response = await fetch(CONFIG.GAS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({ action, payload })
        });
        const result = await response.json();
        
        if (result && result.status === 'success') {
            // Update local transaction URLs / statuses if uploaded successfully
            if ((action === 'SAVE_REPAIR' || action === 'UPDATE_REPAIR' || action === 'UPDATE_REPAIR_STATUS') && result.data) {
                const txs = await getLocalData('repair_transactions');
                const match = txs.find(t => t.repair_number === payload.repair_number);
                if (match) {
                    match.status = 'Synced';
                    if (result.data.cowok_image_url) match.cowok_image_url = result.data.cowok_image_url;
                    if (result.data.cewek_image_url) match.cewek_image_url = result.data.cewek_image_url;
                    if (result.data.warranty_image_url) match.warranty_image_url = result.data.warranty_image_url;
                    if (result.data.dp1_receipt_url) match.dp1_receipt_url = result.data.dp1_receipt_url;
                    if (result.data.dp2_receipt_url) match.dp2_receipt_url = result.data.dp2_receipt_url;

                    if (result.data.dp_approval) match.dp_approval = result.data.dp_approval;
                    if (result.data.pelunasan_approval) match.pelunasan_approval = result.data.pelunasan_approval;
                    if (result.data.render_model_url) match.render_model_url = result.data.render_model_url;
                    if (result.data.render_approval) match.render_approval = result.data.render_approval;
                    if (result.data.realpict_url) match.realpict_url = result.data.realpict_url;
                    if (result.data.realpict_approval) match.realpict_approval = result.data.realpict_approval;
                    if (result.data.refund_receipt_url) match.refund_receipt_url = result.data.refund_receipt_url;
                    if (result.data.final_pickup_status) match.final_pickup_status = result.data.final_pickup_status;
                    if (result.data.pelunasan_receipt_url) match.dp2_receipt_url = result.data.pelunasan_receipt_url;

                    if (payload.assigned_workshop !== undefined) match.assigned_workshop = payload.assigned_workshop;
                    if (payload.production_status !== undefined) match.production_status = payload.production_status;
                    if (payload.logistic_status !== undefined) match.logistic_status = payload.logistic_status;
                    if (payload.logistic_receipt_no !== undefined) match.logistic_receipt_no = payload.logistic_receipt_no;
                    if (payload.pelunasan_amount !== undefined) match.dp2_amount = payload.pelunasan_amount;
                    if (payload.pelunasan_method !== undefined) match.dp2_method = payload.pelunasan_method;
                    
                    await saveLocalData('repair_transactions', match);
                }
            }
            return true;
        }
        return false;
    } catch (e) {
        console.error("GAS Push Fail: ", e);
        return false;
    }
}

function deleteFromQueueByTimestamp(timestamp) {
    return new Promise((resolve) => {
        const tx = State.db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.openCursor();
        req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                if (cursor.value.timestamp === timestamp) {
                    cursor.delete();
                    resolve();
                } else {
                    cursor.continue();
                }
            } else {
                resolve();
            }
        };
    });
}

function setSyncLockDisplay(status) {
    const el = document.getElementById('sync-lock-status');
    if (!el) return;
    if (status === 'locked') {
        el.textContent = 'Terkunci (Sedang Sinkronisasi)';
        el.className = 'locked';
    } else if (status === 'offline') {
        el.textContent = 'Ditunda (Offline)';
        el.className = 'offline';
    } else {
        el.textContent = 'Bebas (Idle)';
        el.className = 'unlocked';
    }
}

// Watch Connection State Events
window.addEventListener('online', () => {
    updateConnectionIndicator(true);
    runBackgroundSync();
});

window.addEventListener('offline', () => {
    updateConnectionIndicator(false);
});

function updateConnectionIndicator(online) {
    const ind = document.getElementById('network-indicator');
    const dot = ind.querySelector('.status-dot');
    const text = document.getElementById('network-text');
    const dbStatus = document.getElementById('sync-db-status');
    const driveStatus = document.getElementById('sync-drive-status');

    if (online) {
        dot.className = 'status-dot online';
        text.textContent = 'Online';
        if (dbStatus) {
            dbStatus.textContent = 'Tersambung (Sheets DB)';
            dbStatus.className = 'online';
        }
        if (driveStatus) {
            driveStatus.textContent = 'Tersambung (Drive API)';
            driveStatus.className = 'online';
        }
    } else {
        dot.className = 'status-dot';
        text.textContent = 'Offline-mode';
        if (dbStatus) {
            dbStatus.textContent = 'Terputus (Mode Lokal)';
            dbStatus.className = 'offline';
        }
        if (driveStatus) {
            driveStatus.textContent = 'Terputus (Mode Lokal)';
            driveStatus.className = 'offline';
        }
    }
}

// ==========================================================================
// 8. ADMINISTRATOR CONSOLE CONTROLLER
// ==========================================================================

async function renderAdminPanels() {
    // Dynamic loading of admin lists
    await loadAdminTable('users', 'master_users', ['username', 'role', 'store_code']);
    await loadAdminTable('stores', 'master_stores', ['code', 'name', 'address', 'phone']);
    await loadAdminTable('catalog', 'master_catalog', ['id', 'name', 'category', 'price']);
    await loadAdminTable('metals', 'master_metals', ['id', 'name', 'price_per_gram', 'custom_fee']);
    await loadAdminTable('repairs', 'master_repairs', ['id', 'name', 'repair_fee']);
    await loadAdminTable('workshops', 'master_workshops', ['id', 'name', 'phone', 'address']);
    await loadAdminTable('cities', 'master_cities', ['id', 'city', 'province', 'shipping_fee']);
    await loadAdminTable('payments', 'master_payments', ['id', 'name']);
}

async function loadAdminTable(panelSuffix, storeName, keys) {
    const data = await getLocalData(storeName);
    const tbody = document.querySelector(`#table-admin-${panelSuffix} tbody`);
    if (!tbody) return;

    tbody.innerHTML = '';

    data.forEach(item => {
        const tr = document.createElement('tr');
        let cellsHtml = '';
        keys.forEach(k => {
            let val = item[k];
            // Format price variables if they are numbers
            if (typeof val === 'number' && (k.includes('price') || k.includes('fee'))) {
                val = formatRupiah(val);
            }
            cellsHtml += `<td>${val}</td>`;
        });
        
        // Target ID for key operations
        const idVal = item[keys[0]]; // usually the primary key is first key
        
        cellsHtml += `
            <td>
                <div class="action-buttons-flex">
                    <button class="action-btn-circle btn-admin-edit" data-store="${storeName}" data-id="${idVal}" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="action-btn-circle trash btn-admin-delete" data-store="${storeName}" data-id="${idVal}" title="Hapus"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tr.innerHTML = cellsHtml;
        tbody.appendChild(tr);
    });

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${keys.length + 1}" style="text-align:center; color:var(--text-muted);">Tidak ada data master terdaftar.</td></tr>`;
    }

    // Attach CRUD listeners
    tbody.querySelectorAll('.btn-admin-edit').forEach(btn => {
        btn.addEventListener('click', () => showCRUDModal(btn.dataset.store, btn.dataset.id, 'EDIT'));
    });
    tbody.querySelectorAll('.btn-admin-delete').forEach(btn => {
        btn.addEventListener('click', () => executeAdminDelete(btn.dataset.store, btn.dataset.id));
    });
}

async function executeAdminDelete(storeName, key) {
    if (confirm(`Apakah Anda yakin ingin menghapus data master ${key} dari database?`)) {
        await deleteLocalData(storeName, key);
        
        // Sync database deletions to Sheet DB
        await queueSyncTask('DELETE_MASTER_RECORD', { store_name: storeName, key: key });
        
        showToast('Data master berhasil dihapus!', 'success');
        await refreshAllData();
    }
}

// Renders CRUD Inputs dynamically based on which table is open
async function showCRUDModal(storeName, key = null, type = 'ADD') {
    const crudForm = document.getElementById('crud-form-fields');
    let fields = '';

    let record = null;
    if (key) {
        const data = await getLocalData(storeName);
        record = data.find(item => item[Object.keys(data[0])[0]] === key || item.id === key || item.username === key || item.code === key);
    }

    // 1. Users CRUD fields
    if (storeName === 'master_users') {
        fields = `
            <div class="form-group">
                <label for="c-user-name">Username (ID)</label>
                <input type="text" id="c-user-name" placeholder="E.g., andi_sales" value="${record ? record.username : ''}" ${record ? 'readonly class="readonly-input"' : ''} required>
            </div>
            <div class="form-group">
                <label for="c-user-pass">Password</label>
                <input type="password" id="c-user-pass" value="${record ? record.password : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-user-role">Role Akses</label>
                <select id="c-user-role" required>
                    <option value="Admin" ${record && record.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    <option value="Sales" ${record && record.role === 'Sales' ? 'selected' : ''}>Sales</option>
                    <option value="Accounting" ${record && record.role === 'Accounting' ? 'selected' : ''}>Accounting</option>
                    <option value="Production" ${record && record.role === 'Production' ? 'selected' : ''}>Production</option>
                    <option value="Logistic" ${record && record.role === 'Logistic' ? 'selected' : ''}>Logistic</option>
                </select>
            </div>
            <div class="form-group">
                <label for="c-user-store">Kode Store Relasi</label>
                <input type="text" id="c-user-store" placeholder="E.g., BEK or ALL" value="${record ? record.store_code : ''}" required>
            </div>
        `;
    }
    // 2. Stores CRUD fields
    else if (storeName === 'master_stores') {
        fields = `
            <div class="form-group">
                <label for="c-store-code">Kode Cabang Store</label>
                <input type="text" id="c-store-code" placeholder="E.g., BEK" value="${record ? record.code : ''}" ${record ? 'readonly class="readonly-input"' : ''} required>
            </div>
            <div class="form-group">
                <label for="c-store-name">Nama Toko Store</label>
                <input type="text" id="c-store-name" placeholder="E.g., Bekasi Denisa" value="${record ? record.name : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-store-addr">Alamat Fisik Toko</label>
                <textarea id="c-store-addr" required>${record ? record.address : ''}</textarea>
            </div>
            <div class="form-group">
                <label for="c-store-phone">No. Handphone (WA Toko)</label>
                <input type="tel" id="c-store-phone" placeholder="E.g., 6281xxxxxx" value="${record ? record.phone : ''}" required>
            </div>
        `;
    }
    // 3. Catalog CRUD fields
    else if (storeName === 'master_catalog') {
        fields = `
            <div class="form-group">
                <label for="c-cat-id">ID Katalog</label>
                <input type="text" id="c-cat-id" placeholder="E.g., CAT-007" value="${record ? record.id : ''}" ${record ? 'readonly class="readonly-input"' : ''} required>
            </div>
            <div class="form-group">
                <label for="c-cat-name">Nama Layanan / Barang</label>
                <input type="text" id="c-cat-name" placeholder="E.g., Box Cincin Bulat" value="${record ? record.name : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-cat-cat">Kategori</label>
                <select id="c-cat-cat" required>
                    <option value="Jasa" ${record && record.category === 'Jasa' ? 'selected' : ''}>Jasa</option>
                    <option value="Barang" ${record && record.category === 'Barang' ? 'selected' : ''}>Barang</option>
                </select>
            </div>
            <div class="form-group">
                <label for="c-cat-price">Harga Layanan (Rp)</label>
                <input type="number" id="c-cat-price" value="${record ? record.price : ''}" required>
            </div>
        `;
    }
    // 4. Metals CRUD fields
    else if (storeName === 'master_metals') {
        fields = `
            <div class="form-group">
                <label for="c-met-id">ID Bahan</label>
                <input type="text" id="c-met-id" placeholder="E.g., MET-006" value="${record ? record.id : ''}" ${record ? 'readonly class="readonly-input"' : ''} required>
            </div>
            <div class="form-group">
                <label for="c-met-name">Nama Bahan & Kadar Logam</label>
                <input type="text" id="c-met-name" placeholder="E.g., Emas Kuning 22K" value="${record ? record.name : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-met-price">Harga per Gram (Rp)</label>
                <input type="number" id="c-met-price" value="${record ? record.price_per_gram : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-met-fee">Biaya Pembuatan Jasa Custom (Rp)</label>
                <input type="number" id="c-met-fee" value="${record ? record.custom_fee : ''}" required>
            </div>
        `;
    }
    // 5. Repairs CRUD fields
    else if (storeName === 'master_repairs') {
        fields = `
            <div class="form-group">
                <label for="c-rep-id">ID Repair</label>
                <input type="text" id="c-rep-id" placeholder="E.g., REP-007" value="${record ? record.id : ''}" ${record ? 'readonly class="readonly-input"' : ''} required>
            </div>
            <div class="form-group">
                <label for="c-rep-name">Nama / Deskripsi Jenis Repair</label>
                <input type="text" id="c-rep-name" placeholder="E.g., Ganti Permata Tengah" value="${record ? record.name : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-rep-fee">Biaya Repair Jasa (Rp)</label>
                <input type="number" id="c-rep-fee" value="${record ? record.repair_fee : ''}" required>
            </div>
        `;
    }
    // 6. Workshops CRUD fields
    else if (storeName === 'master_workshops') {
        fields = `
            <div class="form-group">
                <label for="c-wks-id">ID Workshop</label>
                <input type="text" id="c-wks-id" placeholder="E.g., WKS-003" value="${record ? record.id : ''}" ${record ? 'readonly class="readonly-input"' : ''} required>
            </div>
            <div class="form-group">
                <label for="c-wks-name">Nama Workshop / Mitra Pengrajin</label>
                <input type="text" id="c-wks-name" value="${record ? record.name : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-wks-phone">Nomor Telepon WA</label>
                <input type="tel" id="c-wks-phone" value="${record ? record.phone : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-wks-addr">Alamat Workshop</label>
                <textarea id="c-wks-addr" required>${record ? record.address : ''}</textarea>
            </div>
        `;
    }
    // 7. Cities CRUD fields
    else if (storeName === 'master_cities') {
        fields = `
            <div class="form-group">
                <label for="c-city-id">ID Kabupaten/Kota</label>
                <input type="text" id="c-city-id" placeholder="E.g., CIT-010" value="${record ? record.id : ''}" ${record ? 'readonly class="readonly-input"' : ''} required>
            </div>
            <div class="form-group">
                <label for="c-city-name">Kabupaten / Kota</label>
                <input type="text" id="c-city-name" value="${record ? record.city : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-city-prov">Provinsi</label>
                <input type="text" id="c-city-prov" value="${record ? record.province : ''}" required>
            </div>
            <div class="form-group">
                <label for="c-city-fee">Tarif Ongkos Kirim (Rp)</label>
                <input type="number" id="c-city-fee" value="${record ? record.shipping_fee : ''}" required>
            </div>
        `;
    }
    // 8. Payments CRUD fields
    else if (storeName === 'master_payments') {
        fields = `
            <div class="form-group">
                <label for="c-pay-id">ID Pembayaran</label>
                <input type="text" id="c-pay-id" placeholder="E.g., PAY-005" value="${record ? record.id : ''}" ${record ? 'readonly class="readonly-input"' : ''} required>
            </div>
            <div class="form-group">
                <label for="c-pay-name">Metode Pembayaran</label>
                <input type="text" id="c-pay-name" placeholder="E.g., BRI Transfer SOVIA" value="${record ? record.name : ''}" required>
            </div>
        `;
    }

    document.getElementById('crud-modal-title').textContent = `${type === 'EDIT' ? 'Ubah' : 'Tambah'} Data Master`;
    crudForm.innerHTML = fields;
    
    // Attach details in modal element datasets
    const modal = document.getElementById('crud-modal');
    modal.classList.remove('hidden');
    modal.dataset.crudStore = storeName;
    modal.dataset.crudAction = type;
}

// Parses CRUD inputs and commits changes locally and lists them for sync
async function executeCRUDSubmit() {
    const modal = document.getElementById('crud-modal');
    const storeName = modal.dataset.crudStore;
    const actionType = modal.dataset.crudAction;

    let payloadObj = {};

    // Retrieve input values dynamically based on active store CRUD
    if (storeName === 'master_users') {
        payloadObj = {
            username: document.getElementById('c-user-name').value.trim(),
            password: document.getElementById('c-user-pass').value,
            role: document.getElementById('c-user-role').value,
            store_code: document.getElementById('c-user-store').value.trim().toUpperCase()
        };
    } else if (storeName === 'master_stores') {
        payloadObj = {
            code: document.getElementById('c-store-code').value.trim().toUpperCase(),
            name: document.getElementById('c-store-name').value.trim(),
            address: document.getElementById('c-store-addr').value.trim(),
            phone: document.getElementById('c-store-phone').value.trim()
        };
    } else if (storeName === 'master_catalog') {
        payloadObj = {
            id: document.getElementById('c-cat-id').value.trim(),
            name: document.getElementById('c-cat-name').value.trim(),
            category: document.getElementById('c-cat-cat').value,
            price: parseFloat(document.getElementById('c-cat-price').value) || 0
        };
    } else if (storeName === 'master_metals') {
        payloadObj = {
            id: document.getElementById('c-met-id').value.trim(),
            name: document.getElementById('c-met-name').value.trim(),
            price_per_gram: parseFloat(document.getElementById('c-met-price').value) || 0,
            custom_fee: parseFloat(document.getElementById('c-met-fee').value) || 0
        };
    } else if (storeName === 'master_repairs') {
        payloadObj = {
            id: document.getElementById('c-rep-id').value.trim(),
            name: document.getElementById('c-rep-name').value.trim(),
            repair_fee: parseFloat(document.getElementById('c-rep-fee').value) || 0
        };
    } else if (storeName === 'master_workshops') {
        payloadObj = {
            id: document.getElementById('c-wks-id').value.trim(),
            name: document.getElementById('c-wks-name').value.trim(),
            phone: document.getElementById('c-wks-phone').value.trim(),
            address: document.getElementById('c-wks-addr').value.trim()
        };
    } else if (storeName === 'master_cities') {
        payloadObj = {
            id: document.getElementById('c-city-id').value.trim(),
            city: document.getElementById('c-city-name').value.trim(),
            province: document.getElementById('c-city-prov').value.trim(),
            shipping_fee: parseFloat(document.getElementById('c-city-fee').value) || 0
        };
    } else if (storeName === 'master_payments') {
        payloadObj = {
            id: document.getElementById('c-pay-id').value.trim(),
            name: document.getElementById('c-pay-name').value.trim()
        };
    }

    // Confirm that payload values are filled
    const emptyKeys = Object.keys(payloadObj).filter(k => payloadObj[k] === '' || payloadObj[k] === null);
    if (emptyKeys.length > 0) {
        showToast('Lengkapi seluruh formulir isian master!', 'warning');
        return;
    }

    // Save locally
    await saveLocalData(storeName, payloadObj);

    // Queue sync task
    const actionKey = actionType === 'EDIT' ? 'UPDATE_MASTER_RECORD' : 'SAVE_MASTER_RECORD';
    await queueSyncTask(actionKey, { store_name: storeName, payload: payloadObj });

    showToast('Data master disimpan!', 'success');
    modal.classList.add('hidden');
    
    await refreshAllData();
}

// Delegating workshop to pengerjaan repair
async function executeProductionAssignSubmit() {
    const repNum = document.getElementById('crud-p-repnum').value;
    const assignedWks = document.getElementById('crud-p-wks').value;

    const txs = await getLocalData('repair_transactions');
    const match = txs.find(t => t.repair_number === repNum);
    
    if (match) {
        match.assigned_workshop = assignedWks;
        match.production_status = 'Active'; // Automatically moves status to active pengerjaan
        match.status = 'Pending Sync';
        await saveLocalData('repair_transactions', match);
        
        await queueSyncTask('UPDATE_REPAIR_STATUS', { 
            repair_number: repNum, 
            assigned_workshop: assignedWks, 
            production_status: 'Active' 
        });

        showToast(`Cincin ${repNum} didelegasikan ke ${assignedWks}!`, 'success');
        document.getElementById('crud-modal').classList.add('hidden');
        await refreshAllData();
    }
}

// Logistik inputting kurir tracking numbers
async function executeLogisticShipSubmit() {
    const repNum = document.getElementById('crud-l-repnum').value;
    const trackingNo = document.getElementById('crud-l-receipt').value.trim();

    const txs = await getLocalData('repair_transactions');
    const match = txs.find(t => t.repair_number === repNum);
    
    if (match && trackingNo) {
        match.logistic_receipt_no = trackingNo;
        match.logistic_status = 'Shipped';
        match.status = 'Synced'; // Simulating completed delivery
        await saveLocalData('repair_transactions', match);
        
        await queueSyncTask('UPDATE_REPAIR_STATUS', { 
            repair_number: repNum, 
            logistic_receipt_no: trackingNo, 
            logistic_status: 'Shipped',
            status: 'Completed'
        });

        showToast(`Resi kurir ${trackingNo} disimpan pada transaksi ${repNum}!`, 'success');
        document.getElementById('crud-modal').classList.add('hidden');
        await refreshAllData();
    }
}

// ==========================================================================
// 9. GENERAL REFRESH & UTILITIES
// ==========================================================================

async function refreshAllData() {
    // 1. Reload RAM cache from IndexedDB
    await loadAllMasterDataToCache();
    
    // 2. Refresh UI tables
    if (State.currentUser) {
        await renderRepairHistory();
        await renderAccountingBoard();
        await renderProductionBoard();
        await renderLogisticBoard();
        await renderAdminPanels();
        
        // Update stats
        const allTx = await getLocalData('repair_transactions');
        document.getElementById('stat-total-repairs').textContent = allTx.length;
        
        const activeProd = allTx.filter(t => t.production_status === 'Active').length;
        document.getElementById('stat-production-repairs').textContent = activeProd;

        const comp = allTx.filter(t => t.production_status === 'Completed' || t.logistic_status === 'Shipped').length;
        document.getElementById('stat-completed-repairs').textContent = comp;
    }

    // 3. Update Sync Queue logs visualizer
    await updateSyncQueueDisplay();
}

// --- UTILITY FORMATTING HELPERS ---
function formatRupiah(amount) {
    return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

function formatSimpleDate(dateString) {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatSimpleTime(timeString) {
    if (!timeString) return '';
    return timeString.substring(0, 5);
}

// Notification Toast Visualizer
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    else if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
    else if (type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <h4>${type.toUpperCase()}</h4>
            <p>${message}</p>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ==========================================================================
// 10. DOM EVENT HANDLERS BINDING
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize local databases
    await initDatabase();
    await loadAllMasterDataToCache();

    // 2. Check login state
    checkSession();

    // Set connection status label
    updateConnectionIndicator(navigator.onLine);

    // --- BINDING: PORTAL HUB & LOGIN ---
    document.getElementById('btn-enter-repair').addEventListener('click', () => {
        showLoginScreen();
    });

    document.getElementById('btn-login-back').addEventListener('click', () => {
        showPortalHub();
    });

    document.getElementById('btn-toggle-password').addEventListener('click', () => {
        const passInput = document.getElementById('login-password');
        const eyeIcon = document.getElementById('btn-toggle-password').querySelector('i');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeIcon.className = 'fa-regular fa-eye-slash';
        } else {
            passInput.type = 'password';
            eyeIcon.className = 'fa-regular fa-eye';
        }
    });

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        handleLogin(username, password);
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
            handleLogout();
        }
    });

    // --- BINDING: ROUTER NAVBAR ---
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchPanel(btn.dataset.target);
        });
    });

    document.getElementById('btn-sidebar-toggle').addEventListener('click', () => {
        document.getElementById('app-sidebar').classList.toggle('active');
    });

    // --- BINDING: DYNAMIC THEME SYSTEM TOGGLE ---
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
        const b = document.body;
        const icon = document.getElementById('btn-theme-toggle').querySelector('i');
        if (b.classList.contains('light-theme')) {
            b.className = 'dark-theme';
            icon.className = 'fa-solid fa-sun';
        } else {
            b.className = 'light-theme';
            icon.className = 'fa-solid fa-moon';
        }
    });

    // --- BINDING: QUICK ACTIONS ---
    document.getElementById('btn-quick-new-repair').addEventListener('click', () => {
        switchPanel('sales-panel');
        resetForm();
    });
    
    document.getElementById('btn-quick-sync').addEventListener('click', () => {
        runBackgroundSync();
    });
    
    document.getElementById('btn-quick-admin').addEventListener('click', () => {
        if (State.currentUser.role === 'Admin') {
            switchPanel('admin-panel');
        } else {
            showToast('Anda harus menjadi Admin untuk mengelola data master!', 'warning');
        }
    });

    document.getElementById('btn-sync-trigger').addEventListener('click', () => {
        runBackgroundSync();
    });

    // --- BINDING: SALES FORM ACTIONS ---
    document.getElementById('ring-cowok-active').addEventListener('change', (e) => {
        toggleRingCardActive('cowok', e.target.checked);
        calculateFormPricing();
    });
    
    document.getElementById('ring-cewek-active').addEventListener('change', (e) => {
        toggleRingCardActive('cewek', e.target.checked);
        calculateFormPricing();
    });

    // Live calculations inputs listeners
    const calcSelectors = [
        'cowok-material', 'cowok-weight', 'cowok-repair-type',
        'cewek-material', 'cewek-weight', 'cewek-repair-type',
        'cust-city', 'dp1-amount', 'dp2-amount'
    ];
    calcSelectors.forEach(id => {
        document.getElementById(id).addEventListener('input', () => calculateFormPricing());
        document.getElementById(id).addEventListener('change', () => calculateFormPricing());
    });

    document.getElementById('btn-add-item-row').addEventListener('click', () => {
        addAdditionalItemRow();
    });

    // Image Upload Inputs change thumbnail visualizers
    const imgUploads = ['cowok-image', 'cewek-image', 'warranty-image', 'dp1-image', 'dp2-image'];
    imgUploads.forEach(id => {
        const inp = document.getElementById(id);
        inp.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const pId = `${id}-preview`;
            const previewEl = document.getElementById(pId);
            if (file) {
                const base64Str = await getImageBase64(file, pId);
                previewEl.innerHTML = `<img src="${base64Str}" alt="Preview"><span style="margin-top:6px; font-size:10px;">Ganti Foto</span>`;
                calculateFormPricing();
            }
        });
    });

    // Actions
    document.getElementById('btn-form-delete').addEventListener('click', () => {
        if (confirm('Hapus seluruh inputan formulir ini?')) {
            resetForm();
            showToast('Seluruh kolom isian dibersihkan!', 'info');
        }
    });

    document.getElementById('btn-form-preview').addEventListener('click', async () => {
        if (!validateRepairForm()) return;
        const tx = await getTransactionFromForm();
        
        // Show Preview modal
        const modal = document.getElementById('preview-modal');
        const modalBody = document.getElementById('preview-modal-body');
        
        // Generate html preview layout (reuses print slip engine structurally)
        await showReceiptPrintModal(tx.repair_number, 'RECEIPT');
        
        // Move the HTML content inside the preview modal specifically
        modalBody.innerHTML = document.getElementById('print-receipt-body').innerHTML;
        document.getElementById('print-modal').classList.add('hidden'); // Ensure printable isn't showing
        modal.classList.remove('hidden');
    });

    document.getElementById('btn-modal-preview-close').addEventListener('click', () => {
        document.getElementById('preview-modal').classList.add('hidden');
    });
    
    document.getElementById('btn-close-preview-modal').addEventListener('click', () => {
        document.getElementById('preview-modal').classList.add('hidden');
    });

    document.getElementById('btn-modal-preview-confirm').addEventListener('click', async () => {
        document.getElementById('preview-modal').classList.add('hidden');
        document.getElementById('repair-entry-form').dispatchEvent(new Event('submit'));
    });

    // Save/Submit Form Handler
    document.getElementById('repair-entry-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!validateRepairForm()) return;

        showToast('Memproses penyimpanan formulir repair...', 'info');

        const tx = await getTransactionFromForm();
        
        // Add to local database
        await saveLocalData('repair_transactions', tx);
        
        // Put in sync queue
        const syncAction = State.activeEditId ? 'UPDATE_REPAIR' : 'SAVE_REPAIR';
        await queueSyncTask(syncAction, tx);

        showToast(`Repair Cincin ${tx.repair_number} berhasil disimpan di sistem lokal!`, 'success');
        
        // Reset and refresh
        resetForm();
        await refreshAllData();
        
        // Auto trigger background sync check
        runBackgroundSync();
    });

    // Recent History Table Filter events
    document.getElementById('history-search').addEventListener('input', () => renderRepairHistory());
    document.getElementById('history-status-filter').addEventListener('change', () => renderRepairHistory());

    // --- BINDING: MODALS CONTROLS ---
    
    // Auth password challenge modal overrides
    document.getElementById('btn-auth-cancel').addEventListener('click', () => {
        document.getElementById('admin-auth-modal').classList.add('hidden');
    });
    document.getElementById('btn-close-auth-modal').addEventListener('click', () => {
        document.getElementById('admin-auth-modal').classList.add('hidden');
    });
    
    document.getElementById('btn-auth-submit').addEventListener('click', () => {
        const user = document.getElementById('auth-admin-username').value;
        const pass = document.getElementById('auth-admin-password').value;
        
        if (challengeAdminAccess(user, pass)) {
            const modal = document.getElementById('admin-auth-modal');
            modal.classList.add('hidden');
            
            const pNum = modal.dataset.pendingNum;
            const pAction = modal.dataset.pendingAction;
            
            executeProtectedAction(pNum, pAction);
        } else {
            document.getElementById('auth-error-msg').classList.remove('hidden');
        }
    });

    // CRUD modal
    document.getElementById('btn-crud-cancel').addEventListener('click', () => {
        document.getElementById('crud-modal').classList.add('hidden');
    });
    document.getElementById('btn-close-crud-modal').addEventListener('click', () => {
        document.getElementById('crud-modal').classList.add('hidden');
    });
    document.getElementById('btn-crud-submit').addEventListener('click', (e) => {
        e.preventDefault();
        const modal = document.getElementById('crud-modal');
        const crudType = modal.dataset.crudType;
        
        if (crudType === 'PRODUCTION_ASSIGN') {
            executeProductionAssignSubmit();
        } else if (crudType === 'LOGISTIC_SHIP') {
            executeLogisticShipSubmit();
        } else {
            executeCRUDSubmit();
        }
    });

    // Admin Pane tab triggers
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Admin CRUD Addition triggers
    document.querySelectorAll('.btn-admin-add').forEach(btn => {
        btn.addEventListener('click', () => {
            let store = 'master_users';
            const type = btn.dataset.type;
            if (type === 'store') store = 'master_stores';
            else if (type === 'catalog') store = 'master_catalog';
            else if (type === 'metal') store = 'master_metals';
            else if (type === 'repair') store = 'master_repairs';
            else if (type === 'workshop') store = 'master_workshops';
            else if (type === 'city') store = 'master_cities';
            else if (type === 'payment') store = 'master_payments';

            showCRUDModal(store, null, 'ADD');
        });
    });

    // Print execution buttons
    document.getElementById('btn-print-cancel').addEventListener('click', () => {
        document.getElementById('print-modal').classList.add('hidden');
    });
    document.getElementById('btn-close-print-modal').addEventListener('click', () => {
        document.getElementById('print-modal').classList.add('hidden');
    });
    document.getElementById('btn-print-execute').addEventListener('click', () => {
        window.print();
    });

    // --- BINDING: SALES DETAIL PROGRESS MODAL ---
    const closeSalesDetail = () => {
        document.getElementById('sales-detail-modal').classList.add('hidden');
    };
    document.getElementById('btn-close-sales-detail-modal').addEventListener('click', closeSalesDetail);
    document.getElementById('btn-close-sales-detail-modal-footer').addEventListener('click', closeSalesDetail);

    // Lightbox close button
    const closeLightbox = () => {
        document.getElementById('image-lightbox-modal').classList.remove('active');
    };
    document.getElementById('btn-close-lightbox').addEventListener('click', closeLightbox);
    document.getElementById('image-lightbox-modal').addEventListener('click', (e) => {
        if (e.target.id === 'image-lightbox-modal') {
            closeLightbox();
        }
    });

    // Approval / Rejection Render Model 3D
    document.getElementById('btn-sd-approve-render').addEventListener('click', async () => {
        const modal = document.getElementById('sales-detail-modal');
        const repairNumber = modal.dataset.repairNumber;
        if (!repairNumber) return;

        showToast('Menyetujui model render 3D...', 'info');
        try {
            const txs = await getLocalData('repair_transactions');
            const match = txs.find(t => t.repair_number === repairNumber);
            if (match) {
                match.render_approval = 'Approved';
                match.status = 'Pending Sync';
                await saveLocalData('repair_transactions', match);
            }
            
            await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: repairNumber, render_approval: 'Approved' });
            runBackgroundSync();
            
            showToast(`Render Model 3D perbaikan ${repairNumber} disetujui!`, 'success');
            await showSalesDetailModal(repairNumber);
            await refreshAllData();
        } catch (err) {
            console.error(err);
            showToast('Gagal menyetujui render model.', 'error');
        }
    });

    document.getElementById('btn-sd-reject-render').addEventListener('click', async () => {
        const modal = document.getElementById('sales-detail-modal');
        const repairNumber = modal.dataset.repairNumber;
        if (!repairNumber) return;

        showToast('Menolak model render 3D...', 'info');
        try {
            const txs = await getLocalData('repair_transactions');
            const match = txs.find(t => t.repair_number === repairNumber);
            if (match) {
                match.render_approval = 'Rejected';
                match.status = 'Pending Sync';
                await saveLocalData('repair_transactions', match);
            }
            
            await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: repairNumber, render_approval: 'Rejected' });
            runBackgroundSync();
            
            showToast(`Render Model 3D perbaikan ${repairNumber} ditolak!`, 'warning');
            await showSalesDetailModal(repairNumber);
            await refreshAllData();
        } catch (err) {
            console.error(err);
            showToast('Gagal menolak render model.', 'error');
        }
    });

    // Approval / Rejection Realpict Cincin
    document.getElementById('btn-sd-approve-realpict').addEventListener('click', async () => {
        const modal = document.getElementById('sales-detail-modal');
        const repairNumber = modal.dataset.repairNumber;
        if (!repairNumber) return;

        showToast('Menyetujui realpict cincin...', 'info');
        try {
            const txs = await getLocalData('repair_transactions');
            const match = txs.find(t => t.repair_number === repairNumber);
            if (match) {
                match.realpict_approval = 'Approved';
                match.status = 'Pending Sync';
                await saveLocalData('repair_transactions', match);
            }
            
            await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: repairNumber, realpict_approval: 'Approved' });
            runBackgroundSync();
            
            showToast(`Foto Realpict perbaikan ${repairNumber} disetujui!`, 'success');
            await showSalesDetailModal(repairNumber);
            await refreshAllData();
        } catch (err) {
            console.error(err);
            showToast('Gagal menyetujui realpict cincin.', 'error');
        }
    });

    document.getElementById('btn-sd-reject-realpict').addEventListener('click', async () => {
        const modal = document.getElementById('sales-detail-modal');
        const repairNumber = modal.dataset.repairNumber;
        if (!repairNumber) return;

        showToast('Menolak realpict cincin...', 'info');
        try {
            const txs = await getLocalData('repair_transactions');
            const match = txs.find(t => t.repair_number === repairNumber);
            if (match) {
                match.realpict_approval = 'Rejected';
                match.status = 'Pending Sync';
                await saveLocalData('repair_transactions', match);
            }
            
            await queueSyncTask('UPDATE_REPAIR_STATUS', { repair_number: repairNumber, realpict_approval: 'Rejected' });
            runBackgroundSync();
            
            showToast(`Foto Realpict perbaikan ${repairNumber} ditolak!`, 'warning');
            await showSalesDetailModal(repairNumber);
            await refreshAllData();
        } catch (err) {
            console.error(err);
            showToast('Gagal menolak realpict cincin.', 'error');
        }
    });

    // File input changes for Pelunasan
    document.getElementById('sd-pelunasan-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const base64Str = await getFileBase64(file);
                document.getElementById('sd-pelunasan-base64').value = base64Str;
            } catch (err) {
                console.error(err);
                showToast('Gagal membaca berkas gambar pelunasan.', 'error');
            }
        } else {
            document.getElementById('sd-pelunasan-base64').value = '';
        }
    });

    // Submit pelunasan payment
    document.getElementById('btn-sd-submit-pelunasan').addEventListener('click', async () => {
        const modal = document.getElementById('sales-detail-modal');
        const repairNumber = modal.dataset.repairNumber;
        if (!repairNumber) return;

        const method = document.getElementById('sd-pelunasan-method').value;
        const amount = parseFloat(document.getElementById('sd-pelunasan-amount').value) || 0;
        const base64Data = document.getElementById('sd-pelunasan-base64').value;

        if (!method) {
            showToast('Harap pilih metode pembayaran pelunasan!', 'warning');
            return;
        }
        if (amount <= 0) {
            showToast('Harap masukkan nominal pelunasan yang valid!', 'warning');
            return;
        }
        if (!base64Data) {
            showToast('Harap unggah bukti transfer pelunasan!', 'warning');
            return;
        }

        showToast('Mengunggah pembayaran pelunasan...', 'info');
        try {
            const txs = await getLocalData('repair_transactions');
            const match = txs.find(t => t.repair_number === repairNumber);
            if (match) {
                match.dp2_method = method;
                match.dp2_amount = amount;
                match.dp2_receipt_url = base64Data;
                match.pelunasan_approval = 'Pending';
                match.status = 'Pending Sync';
                await saveLocalData('repair_transactions', match);
            }
            
            await queueSyncTask('UPDATE_REPAIR_STATUS', { 
                repair_number: repairNumber, 
                pelunasan_method: method, 
                pelunasan_amount: amount, 
                pelunasan_receipt_url: base64Data, 
                pelunasan_approval: 'Pending' 
            });
            runBackgroundSync();
            
            showToast(`Bukti pelunasan perbaikan ${repairNumber} berhasil diunggah! Menunggu persetujuan Keuangan.`, 'success');
            await showSalesDetailModal(repairNumber);
            await refreshAllData();
        } catch (err) {
            console.error(err);
            showToast('Gagal memproses pelunasan.', 'error');
        }
    });

    // Confirm Pickup Product
    document.getElementById('btn-sd-pickup-product').addEventListener('click', async () => {
        const modal = document.getElementById('sales-detail-modal');
        const repairNumber = modal.dataset.repairNumber;
        if (!repairNumber) return;

        if (confirm(`Konfirmasi bahwa perhiasan repair dengan nomor ${repairNumber} telah diserahterimakan secara sah kepada customer?`)) {
            showToast('Memproses serah terima...', 'info');
            try {
                const txs = await getLocalData('repair_transactions');
                const match = txs.find(t => t.repair_number === repairNumber);
                if (match) {
                    match.final_pickup_status = 'Picked Up';
                    match.status = 'Pending Sync';
                    await saveLocalData('repair_transactions', match);
                }
                
                await queueSyncTask('UPDATE_REPAIR_STATUS', { 
                    repair_number: repairNumber, 
                    final_pickup_status: 'Picked Up',
                    status: 'Completed' 
                });
                runBackgroundSync();
                
                showToast(`Serah terima perbaikan ${repairNumber} berhasil dikonfirmasi!`, 'success');
                await showSalesDetailModal(repairNumber);
                await refreshAllData();
            } catch (err) {
                console.error(err);
                showToast('Gagal memproses serah terima.', 'error');
            }
        }
    });

    // Print Final Invoice
    document.getElementById('btn-sd-print-final-invoice').addEventListener('click', () => {
        const modal = document.getElementById('sales-detail-modal');
        const repairNumber = modal.dataset.repairNumber;
        if (!repairNumber) return;
        showReceiptPrintModal(repairNumber, 'RECEIPT');
    });

    // Initialize lightbox events globally
    initLightboxEvents();

    // 3. Initiate background sync loops periodically (every 15 seconds)
    setInterval(() => {
        runBackgroundSync();
    }, 15000);

    // Initial form setup
    resetForm();
});

// --- AUXILIARY HELPERS FOR ADVANCED FINANCIALS & LIGHTBOX ---

function calculateTransactionHPP(tx) {
    let cowokHpp = 0;
    if (tx.cowok_active === 'TRUE') {
        const metal = State.masterData.metals.find(m => m.id === tx.cowok_material);
        if (metal) {
            cowokHpp = (parseFloat(tx.cowok_weight) || 0) * (parseFloat(metal.price_per_gram) || 0) + ((parseFloat(metal.custom_fee) || 0) * 0.5);
        }
    }

    let cewekHpp = 0;
    if (tx.cewek_active === 'TRUE') {
        const metal = State.masterData.metals.find(m => m.id === tx.cewek_material);
        if (metal) {
            cewekHpp = (parseFloat(tx.cewek_weight) || 0) * (parseFloat(metal.price_per_gram) || 0) + ((parseFloat(metal.custom_fee) || 0) * 0.5);
        }
    }

    let cowokRepHpp = 0;
    if (tx.cowok_active === 'TRUE') {
        const rep = State.masterData.repairs.find(r => r.id === tx.cowok_repair_type);
        if (rep) {
            cowokRepHpp = (parseFloat(rep.repair_fee) || 0) * 0.4;
        }
    }

    let cewekRepHpp = 0;
    if (tx.cewek_active === 'TRUE') {
        const rep = State.masterData.repairs.find(r => r.id === tx.cewek_repair_type);
        if (rep) {
            cewekRepHpp = (parseFloat(rep.repair_fee) || 0) * 0.4;
        }
    }

    let additionalHpp = 0;
    try {
        const addItems = JSON.parse(tx.additional_items_json || '[]');
        addItems.forEach(item => {
            const catItem = State.masterData.catalog.find(c => c.name === item.name);
            const category = catItem ? catItem.category : 'Barang';
            const multiplier = category === 'Jasa' ? 0.45 : 0.60;
            additionalHpp += (parseFloat(item.price) || 0) * (parseInt(item.qty) || 0) * multiplier;
        });
    } catch (e) {
        console.error("Error parsing additional items for HPP: ", e);
    }

    return cowokHpp + cewekHpp + cowokRepHpp + cewekRepHpp + additionalHpp;
}

function getFileBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            return resolve('');
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

async function showSalesDetailModal(repairNumber) {
    const txs = await getLocalData('repair_transactions');
    const tx = txs.find(t => t.repair_number === repairNumber);
    if (!tx) {
        showToast("Transaksi tidak ditemukan!", "error");
        return;
    }

    const modal = document.getElementById('sales-detail-modal');
    modal.dataset.repairNumber = repairNumber;

    // Bind basic info
    document.getElementById('sd-repair-num').textContent = tx.repair_number;
    document.getElementById('sd-cust-name').textContent = tx.customer_name;
    document.getElementById('sd-cust-phone').textContent = tx.customer_phone;
    document.getElementById('sd-store-sales').textContent = tx.store_sales_name;
    document.getElementById('sd-date').textContent = formatSimpleDate(tx.date);
    document.getElementById('sd-deadline').textContent = formatSimpleDate(tx.deadline);

    // Bind ring cowok details
    const cowokBlock = document.getElementById('sd-cowok-block');
    if (tx.cowok_active === 'TRUE') {
        cowokBlock.classList.remove('hidden');
        const metal = State.masterData.metals.find(m => m.id === tx.cowok_material);
        const rep = State.masterData.repairs.find(r => r.id === tx.cowok_repair_type);
        document.getElementById('sd-cowok-mat').textContent = metal ? metal.name : tx.cowok_material;
        document.getElementById('sd-cowok-weight').textContent = tx.cowok_weight;
        document.getElementById('sd-cowok-size').textContent = tx.cowok_size;
        document.getElementById('sd-cowok-type').textContent = rep ? rep.name : tx.cowok_repair_type;
        document.getElementById('sd-cowok-engrave').textContent = tx.cowok_engraving || 'Tidak ada';
        document.getElementById('sd-cowok-notes').textContent = tx.cowok_notes || 'Tidak ada catatan';
    } else {
        cowokBlock.classList.add('hidden');
    }

    // Bind ring cewek details
    const cewekBlock = document.getElementById('sd-cewek-block');
    if (tx.cewek_active === 'TRUE') {
        cewekBlock.classList.remove('hidden');
        const metal = State.masterData.metals.find(m => m.id === tx.cewek_material);
        const rep = State.masterData.repairs.find(r => r.id === tx.cewek_repair_type);
        document.getElementById('sd-cewek-mat').textContent = metal ? metal.name : tx.cewek_material;
        document.getElementById('sd-cewek-weight').textContent = tx.cewek_weight;
        document.getElementById('sd-cewek-size').textContent = tx.cewek_size;
        document.getElementById('sd-cewek-type').textContent = rep ? rep.name : tx.cewek_repair_type;
        document.getElementById('sd-cewek-engrave').textContent = tx.cewek_engraving || 'Tidak ada';
        document.getElementById('sd-cewek-notes').textContent = tx.cewek_notes || 'Tidak ada catatan';
    } else {
        cewekBlock.classList.add('hidden');
    }

    // Bind financials
    const dpTotal = (parseFloat(tx.dp1_amount) || 0) + (parseFloat(tx.dp2_amount) || 0);
    const totalPrice = parseFloat(tx.total_price) || 0;
    const outstanding = totalPrice - dpTotal;

    document.getElementById('sd-total-price').textContent = formatRupiah(totalPrice);
    document.getElementById('sd-remaining-price').textContent = formatRupiah(Math.max(0, outstanding));

    // DP approval badge
    const dpApprovalBadge = document.getElementById('sd-dp-approval-badge');
    dpApprovalBadge.textContent = tx.dp_approval || 'Pending';
    if (tx.dp_approval === 'Approved') {
        dpApprovalBadge.className = 'badge success';
    } else {
        dpApprovalBadge.className = 'badge warning';
    }

    // Pelunasan approval badge
    const pelunasanApprovalBadge = document.getElementById('sd-pelunasan-approval-badge');
    if (tx.pelunasan_approval === 'Approved') {
        pelunasanApprovalBadge.textContent = 'Approved';
        pelunasanApprovalBadge.className = 'badge success';
    } else if (tx.pelunasan_approval === 'Pending' && (tx.dp2_amount > 0 || tx.dp2_receipt_url)) {
        pelunasanApprovalBadge.textContent = 'Pending';
        pelunasanApprovalBadge.className = 'badge warning';
    } else {
        pelunasanApprovalBadge.textContent = outstanding <= 0 ? 'Approved (Lunas DP)' : 'Belum Lunas';
        pelunasanApprovalBadge.className = outstanding <= 0 ? 'badge success' : 'badge secondary';
    }

    // Alur Bengkel (Workshop)
    document.getElementById('sd-assigned-workshop').textContent = tx.assigned_workshop || 'Belum Ditugaskan';

    // 3D Render block
    const renderBlock = document.getElementById('sd-render-block');
    const renderImg = document.getElementById('sd-render-img');
    const renderBadge = document.getElementById('sd-render-approval-badge');
    const renderActions = document.getElementById('sd-render-actions');

    if (tx.render_model_url && tx.render_model_url !== '' && tx.render_model_url !== '[Gagal Upload]') {
        renderBlock.classList.remove('hidden');
        renderImg.src = tx.render_model_url;
        renderImg.dataset.url = tx.render_model_url;
        renderImg.dataset.caption = `Pratinjau Desain 3D Render - ${tx.repair_number}`;
        renderBadge.textContent = tx.render_approval || 'Pending';
        
        if (tx.render_approval === 'Approved') {
            renderBadge.className = 'badge success';
            renderActions.classList.add('hidden');
        } else if (tx.render_approval === 'Rejected') {
            renderBadge.className = 'badge danger';
            renderActions.classList.add('hidden');
        } else {
            renderBadge.className = 'badge warning';
            renderActions.classList.remove('hidden');
        }
    } else {
        renderBlock.classList.add('hidden');
    }

    // Realpict block
    const realpictBlock = document.getElementById('sd-realpict-block');
    const realpictImg = document.getElementById('sd-realpict-img');
    const realpictBadge = document.getElementById('sd-realpict-approval-badge');
    const realpictActions = document.getElementById('sd-realpict-actions');

    if (tx.realpict_url && tx.realpict_url !== '' && tx.realpict_url !== '[Gagal Upload]') {
        realpictBlock.classList.remove('hidden');
        realpictImg.src = tx.realpict_url;
        realpictImg.dataset.url = tx.realpict_url;
        realpictImg.dataset.caption = `Pratinjau Foto Fisik Cincin - ${tx.repair_number}`;
        realpictBadge.textContent = tx.realpict_approval || 'Pending';

        if (tx.realpict_approval === 'Approved') {
            realpictBadge.className = 'badge success';
            realpictActions.classList.add('hidden');
        } else if (tx.realpict_approval === 'Rejected') {
            realpictBadge.className = 'badge danger';
            realpictActions.classList.add('hidden');
        } else {
            realpictBadge.className = 'badge warning';
            realpictActions.classList.remove('hidden');
        }
    } else {
        realpictBlock.classList.add('hidden');
    }

    // Pelunasan Upload Area
    const pelunasanUploadArea = document.getElementById('sd-pelunasan-upload-area');
    if (outstanding > 0 && tx.pelunasan_approval !== 'Approved') {
        pelunasanUploadArea.classList.remove('hidden');
        document.getElementById('sd-pelunasan-method').value = '';
        document.getElementById('sd-pelunasan-amount').value = Math.max(0, outstanding);
        document.getElementById('sd-pelunasan-file').value = '';
        document.getElementById('sd-pelunasan-base64').value = '';
    } else {
        pelunasanUploadArea.classList.add('hidden');
    }

    // Refund Receipt Area
    const refundPreviewArea = document.getElementById('sd-refund-preview-area');
    const refundImg = document.getElementById('sd-refund-receipt-img');
    if (outstanding < 0 && tx.refund_receipt_url && tx.refund_receipt_url !== '' && tx.refund_receipt_url !== '[Gagal Upload]') {
        refundPreviewArea.classList.remove('hidden');
        refundImg.src = tx.refund_receipt_url;
        refundImg.dataset.url = tx.refund_receipt_url;
        refundImg.dataset.caption = `Bukti Refund Kelebihan DP - ${tx.repair_number}`;
    } else {
        refundPreviewArea.classList.add('hidden');
    }

    // Serah Terima & Action Buttons
    const pickupStatusEl = document.getElementById('sd-pickup-status');
    const isPickedUp = tx.final_pickup_status === 'Picked Up';
    pickupStatusEl.textContent = isPickedUp ? 'Sudah Diambil (Selesai)' : 'Menunggu Pengambilan';
    pickupStatusEl.style.color = isPickedUp ? 'var(--green)' : 'var(--red)';

    const btnPickup = document.getElementById('btn-sd-pickup-product');
    
    // Pickup button conditions
    const isDpApproved = tx.dp_approval === 'Approved';
    const isRenderApproved = tx.render_model_url ? tx.render_approval === 'Approved' : true;
    const isRealpictApproved = tx.realpict_url ? tx.realpict_approval === 'Approved' : true;
    const isFinancialOk = outstanding <= 0 && (outstanding === 0 || tx.pelunasan_approval === 'Approved' || tx.dp1_amount >= tx.total_price);

    if (isDpApproved && isRenderApproved && isRealpictApproved && isFinancialOk && !isPickedUp) {
        btnPickup.removeAttribute('disabled');
        btnPickup.style.opacity = '1';
        btnPickup.style.cursor = 'pointer';
    } else {
        btnPickup.setAttribute('disabled', 'true');
        btnPickup.style.opacity = '0.5';
        btnPickup.style.cursor = 'not-allowed';
    }

    // Update stepper
    updateStepperProgress(tx);

    modal.classList.remove('hidden');
}

function updateStepperProgress(tx) {
    const steps = [
        document.getElementById('step-1'),
        document.getElementById('step-2'),
        document.getElementById('step-3'),
        document.getElementById('step-4'),
        document.getElementById('step-5'),
        document.getElementById('step-6'),
        document.getElementById('step-7')
    ];
    
    // Clear all previous classes
    steps.forEach(step => {
        if (step) {
            step.classList.remove('active', 'completed');
        }
    });

    const isDpApproved = tx.dp_approval === 'Approved';
    const hasRender = tx.render_model_url && tx.render_model_url !== '' && tx.render_model_url !== '[Gagal Upload]';
    const isRenderApproved = tx.render_approval === 'Approved';
    const isProdCompleted = tx.production_status === 'Completed';
    const hasRealpict = tx.realpict_url && tx.realpict_url !== '' && tx.realpict_url !== '[Gagal Upload]';
    const isRealpictApproved = tx.realpict_approval === 'Approved';
    
    const dpTotal = (parseFloat(tx.dp1_amount) || 0) + (parseFloat(tx.dp2_amount) || 0);
    const totalPrice = parseFloat(tx.total_price) || 0;
    const outstanding = totalPrice - dpTotal;
    const isPaid = outstanding <= 0 && (outstanding === 0 || tx.pelunasan_approval === 'Approved' || tx.dp1_amount >= tx.total_price);
    const isPickedUp = tx.final_pickup_status === 'Picked Up';

    let currentStepIndex = 0; // 0-indexed

    // Step 1: Input Repair (Always Completed)
    steps[0].classList.add('completed');
    currentStepIndex = 1;

    // Step 2: Approval DP
    if (isDpApproved) {
        steps[1].classList.add('completed');
        currentStepIndex = 2;
    } else {
        steps[1].classList.add('active');
    }

    // Step 3: Desain 3D
    if (isDpApproved) {
        if (hasRender && isRenderApproved) {
            steps[2].classList.add('completed');
            currentStepIndex = 3;
        } else if (hasRender) {
            steps[2].classList.add('active');
        } else {
            steps[2].classList.add('active'); // active waiting for upload
        }
    }

    // Step 4: Produksi
    if (isDpApproved && isRenderApproved) {
        if (isProdCompleted) {
            steps[3].classList.add('completed');
            currentStepIndex = 4;
        } else {
            steps[3].classList.add('active');
        }
    }

    // Step 5: Realpict
    if (isDpApproved && isRenderApproved && isProdCompleted) {
        if (hasRealpict && isRealpictApproved) {
            steps[4].classList.add('completed');
            currentStepIndex = 5;
        } else {
            steps[4].classList.add('active');
        }
    }

    // Step 6: Pelunasan
    if (isDpApproved && isRenderApproved && isProdCompleted && isRealpictApproved) {
        if (isPaid) {
            steps[5].classList.add('completed');
            currentStepIndex = 6;
        } else {
            steps[5].classList.add('active');
        }
    }

    // Step 7: Selesai / Pickup
    if (isDpApproved && isRenderApproved && isProdCompleted && isRealpictApproved && isPaid) {
        if (isPickedUp) {
            steps[6].classList.add('completed');
            currentStepIndex = 7;
        } else {
            steps[6].classList.add('active');
        }
    }

    // Set stepper track width dynamically based on progress
    // There are 6 track segments between 7 steps
    const percent = Math.min(100, Math.max(0, ((currentStepIndex - 1) / 6) * 100));
    const track = document.getElementById('sales-stepper-track');
    if (track) {
        track.style.width = `${percent}%`;
    }
}

function initLightboxEvents() {
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('.img-thumbnail-link');
        if (target) {
            const url = target.dataset.url || target.src;
            const caption = target.dataset.caption || target.title || 'Pratinjau Gambar';
            
            const modal = document.getElementById('image-lightbox-modal');
            const img = document.getElementById('lightbox-img');
            const cap = document.getElementById('lightbox-caption');
            
            if (modal && img) {
                img.src = url;
                if (cap) cap.textContent = caption;
                modal.classList.add('active');
            }
        }
    });
}

