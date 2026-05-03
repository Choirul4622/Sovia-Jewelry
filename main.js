/**
 * Main logic for Sovia Jewelry Repair App
 */

let validationData = {};
let currentPreviewData = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial data
        const data = await SoviaAPI.getInitialData();
        validationData = data.validationData || {};
        
        initApp(data);
        setupEventListeners();
    } catch (error) {
        console.error('Init Error:', error);
        showAlert('Gagal memuat data dari server. Pastikan URL Script benar.', 'error');
    } finally {
        document.getElementById('initialLoading').style.display = 'none';
    }
});

function initApp(data) {
    populateDropdowns();
    setDefaultDates(data.today, data.tomorrow);
}

function populateDropdowns() {
    const mappings = [
        { id: 'storeName', data: validationData.stores },
        { id: 'customerCity', data: validationData.kabupaten },
        { id: 'bahanCowok', data: validationData.bahan },
        { id: 'bahanCewek', data: validationData.bahan },
        { id: 'jenisRepairCowok', data: validationData.jenisRepair },
        { id: 'jenisRepairCewek', data: validationData.jenisRepair }
    ];

    mappings.forEach(m => {
        const select = document.getElementById(m.id);
        if (!select || !m.data) return;
        
        const unique = [...new Set(m.data.filter(i => i))].sort();
        unique.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });
    });
}

function setDefaultDates(today, tomorrow) {
    const rDate = document.getElementById('repairDate');
    const dDate = document.getElementById('deadlineDate');
    
    if (today) {
        rDate.value = today;
        rDate.min = today;
        dDate.min = today;
    }
    if (tomorrow) dDate.value = tomorrow;
}

function setupEventListeners() {
    // Navigation
    document.getElementById('navSubmit').addEventListener('click', () => {
        showSection('submissionSection');
        setActiveNav('navSubmit');
    });
    document.getElementById('navSearch').addEventListener('click', () => {
        showSection('searchSection');
        setActiveNav('navSearch');
    });

    document.getElementById('navDashboard').addEventListener('click', () => {
        showSection('dashboardSection');
        setActiveNav('navDashboard');
        loadDashboard();
    });

    document.getElementById('refreshDashboard').addEventListener('click', loadDashboard);

    // Form logic
    document.getElementById('repairForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('previewBtn').addEventListener('click', handlePreview);
    document.getElementById('resetBtn').addEventListener('click', () => {
        if(confirm('Reset form?')) {
            document.getElementById('repairForm').reset();
            currentPreviewData = null;
        }
    });

    // Search logic
    document.getElementById('doSearch').addEventListener('click', async () => {
        const query = document.getElementById('searchQuery').value;
        if (!query) return showAlert('Masukkan nomor repair', 'error');

        try {
            document.getElementById('initialLoading').style.display = 'flex';
            const result = await SoviaAPI.searchRepair(query);
            const resultsDiv = document.getElementById('searchResults');
            
            if (result.success) {
                const d = result.data;
                const statusClass = d.Status === 'Selesai' ? 'badge-success' : 'badge-warning';
                resultsDiv.innerHTML = `
                    <div class="card fade-in" style="margin-top: 20px; border-left: 5px solid var(--primary);">
                        <div class="card-content">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                                <div>
                                    <h3 style="color: var(--primary); margin-bottom: 5px;">${d.repairNumber || query}</h3>
                                    <span class="${statusClass}" style="padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                                        ${d.Status || 'Proses'}
                                    </span>
                                </div>
                                <div style="text-align: right;">
                                    <p style="font-size: 0.8rem; color: var(--text-muted);">Deadline</p>
                                    <p style="font-weight: 600;">${d.deadlineDate || '-'}</p>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px;">
                                <div>
                                    <p style="font-size: 0.75rem; color: var(--text-muted);">Customer</p>
                                    <p style="font-weight: 500;">${d.customerName || '-'}</p>
                                </div>
                                <div>
                                    <p style="font-size: 0.75rem; color: var(--text-muted);">Store</p>
                                    <p style="font-weight: 500;">${d.storeName || '-'}</p>
                                </div>
                                <div>
                                    <p style="font-size: 0.75rem; color: var(--text-muted);">Total Tagihan</p>
                                    <p style="color: var(--primary); font-weight: 700;">Rp ${(parseFloat(d.totalHarga) || 0).toLocaleString('id-ID')}</p>
                                </div>
                                <div>
                                    <p style="font-size: 0.75rem; color: var(--text-muted);">DP Minimal</p>
                                    <p style="color: var(--success); font-weight: 700;">Rp ${(parseFloat(d.dpMinimal) || 0).toLocaleString('id-ID')}</p>
                                </div>
                            </div>

                            <div style="margin-top: 20px; display: flex; gap: 10px;">
                                <button class="btn btn-secondary" style="flex: 1; padding: 10px;" onclick="window.open('${d.viewUrl || '#'}', '_blank')">
                                    <i class="fas fa-file-pdf"></i> Lihat Invoice
                                </button>
                                <button class="btn btn-primary" style="flex: 1; padding: 10px;" onclick="location.href='https://wa.me/${d.customerPhone}?text=Halo%20${d.customerName},%20status%20repair%20${d.repairNumber}%20adalah%20${d.Status}'">
                                    <i class="fab fa-whatsapp"></i> Hubungi
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                resultsDiv.innerHTML = `<p style="color: var(--error); text-align: center;">${result.message}</p>`;
            }
        } catch (error) {
            showAlert('Pencarian gagal: ' + error.message, 'error');
        } finally {
            document.getElementById('initialLoading').style.display = 'none';
        }
    });

    // File uploads
    document.getElementById('fileCowok').addEventListener('change', (e) => uploadToDrive(e.target, 'gambarModelCowok'));
    document.getElementById('fileCewek').addEventListener('change', (e) => uploadToDrive(e.target, 'gambarModelCewek'));

    // Collapsible cards
    document.querySelectorAll('.card-header').forEach(header => {
        header.addEventListener('click', () => {
            const target = document.getElementById(header.dataset.target);
            if (target) {
                const isHidden = target.style.display === 'none';
                target.style.display = isHidden ? 'block' : 'none';
            }
        });
    });
}

async function uploadToDrive(fileInput, targetId) {
    const file = fileInput.files[0];
    if (!file) return;

    const btn = fileInput.nextElementSibling;
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const base64 = await toBase64(file);
        const result = await SoviaAPI.uploadFile(base64, file.name);
        
        if (result.success) {
            document.getElementById(targetId).value = result.viewUrl;
            showAlert('Gambar berhasil diupload!', 'success');
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.classList.add('btn-success');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showAlert('Upload gagal: ' + error.message, 'error');
        btn.innerHTML = '<i class="fas fa-times"></i>';
    } finally {
        setTimeout(() => {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
            btn.classList.remove('btn-success');
        }, 2000);
    }
}

async function loadDashboard() {
    try {
        document.getElementById('initialLoading').style.display = 'flex';
        const result = await SoviaAPI.getAllRepairs();
        const tbody = document.getElementById('dashboardTableBody');
        
        if (result.success) {
            tbody.innerHTML = '';
            result.data.forEach(d => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--glass-border)';
                tr.style.fontSize = '0.9rem';
                
                const statusClass = d.Status === 'Selesai' ? 'badge-success' : 'badge-warning';
                
                tr.innerHTML = `
                    <td style="padding: 12px 8px; font-weight: 500;">${d.repairNumber}</td>
                    <td style="padding: 12px 8px;">${d.customerName}</td>
                    <td style="padding: 12px 8px;">${d.storeName}</td>
                    <td style="padding: 12px 8px;">${d.deadlineDate || '-'}</td>
                    <td style="padding: 12px 8px;">
                        <span class="${statusClass}" style="padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">
                            ${d.Status || 'Proses'}
                        </span>
                    </td>
                    <td style="padding: 12px 8px;">
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="openRepairDetail('${d.repairNumber}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            showAlert('Gagal memuat dashboard: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('Error dashboard: ' + error.message, 'error');
    } finally {
        document.getElementById('initialLoading').style.display = 'none';
    }
}

async function handlePreview() {
    const formData = gatherFormData();
    try {
        document.getElementById('initialLoading').style.display = 'flex';
        const result = await SoviaAPI.previewData(formData);
        if (result.success) {
            currentPreviewData = result.data;
            showPreview(result.data);
        } else {
            showAlert(result.message, 'error');
        }
    } catch (error) {
        showAlert('Gagal membuat preview: ' + error.message, 'error');
    } finally {
        document.getElementById('initialLoading').style.display = 'none';
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = gatherFormData();
    
    try {
        document.getElementById('initialLoading').style.display = 'flex';
        const result = await SoviaAPI.processForm(formData);
        if (result.success) {
            showAlert('Data berhasil disimpan! Nomor: ' + result.data.repairNumber, 'success');
            document.getElementById('repairForm').reset();
            currentPreviewData = null;
        } else {
            showAlert(result.message, 'error');
        }
    } catch (error) {
        showAlert('Gagal menyimpan: ' + error.message, 'error');
    } finally {
        document.getElementById('initialLoading').style.display = 'none';
    }
}

function showPreview(data) {
    const body = document.getElementById('previewBody');
    body.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <p><strong>Nomor:</strong> ${data.repairNumber}</p>
                <p><strong>Customer:</strong> ${data.customerName}</p>
                <p><strong>Tanggal:</strong> ${data.repairDate}</p>
            </div>
            <div>
                <p><strong>Store:</strong> ${data.storeName}</p>
                <p><strong>Total:</strong> Rp ${data.totalHarga.toLocaleString('id-ID')}</p>
                <p><strong>DP Minimal:</strong> Rp ${data.dpMinimal.toLocaleString('id-ID')}</p>
            </div>
        </div>
    `;
    document.getElementById('previewModal').style.display = 'block';
}

window.openRepairDetail = async (repairNumber) => {
    document.getElementById('navSearch').click();
    document.getElementById('searchQuery').value = repairNumber;
    document.getElementById('doSearch').click();
};

// Helpers
function showSection(id) {
    ['submissionSection', 'searchSection', 'dashboardSection'].forEach(s => {
        document.getElementById(s).style.display = s === id ? 'block' : 'none';
    });
}

function setActiveNav(id) {
    ['navSubmit', 'navSearch', 'navDashboard'].forEach(n => {
        const btn = document.getElementById(n);
        if (n === id) {
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-secondary');
        } else {
            btn.classList.add('btn-secondary');
            btn.classList.remove('btn-primary');
        }
    });
}

function showAlert(msg, type) {
    const container = document.getElementById('alertContainer');
    container.textContent = msg;
    container.className = `alert alert-${type}`;
    container.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => container.style.display = 'none', 5000);
}

function gatherFormData() {
    const form = document.getElementById('repairForm');
    const fd = new FormData(form);
    const data = {};
    fd.forEach((value, key) => data[key] = value);
    return data;
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
