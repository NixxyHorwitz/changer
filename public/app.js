/**
 * APICS Gateway Interactive Frontend Logic
 * Supports secure authentication via /consoleaccessor
 */

const SAMPLE_QRIS_STRING = '00020101021126570011ID.DANA.WWW011893600915303341139902090334113990303UMI51440014ID.CO.QRIS.WWW0215ID10265535024060303UMI5204504553033605802ID5925Jamaludin Phone, Komputer6015Kota Jakarta Se610512810630478D6';
const AUTH_TOKEN_KEY = 'apics_admin_session_token';

// Security Elements
const loginOverlay = document.getElementById('loginOverlay');
const dashboardContainer = document.getElementById('dashboardContainer');
const formLogin = document.getElementById('formLogin');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const loginError = document.getElementById('loginError');
const btnLogout = document.getElementById('btnLogout');

// Dashboard Elements
const rawQrisInput = document.getElementById('rawQrisInput');
const chkDynamicMode = document.getElementById('chkDynamicMode');
const customQrUrlInput = document.getElementById('customQrUrlInput');
const qrisAnalysisText = document.getElementById('qrisAnalysisText');

const chkAutoApprove = document.getElementById('chkAutoApprove');
const autoApproveDelay = document.getElementById('autoApproveDelay');
const bankName = document.getElementById('bankName');
const bankAccountNumber = document.getElementById('bankAccountNumber');
const bankAccountName = document.getElementById('bankAccountName');
const apiKey = document.getElementById('apiKey');
const secretKey = document.getElementById('secretKey');

const statQrisMode = document.getElementById('statQrisMode');
const statAutoApprove = document.getElementById('statAutoApprove');
const statTxCount = document.getElementById('statTxCount');
const statMerchantName = document.getElementById('statMerchantName');
const statMerchantCity = document.getElementById('statMerchantCity');

const testAmountInput = document.getElementById('testAmountInput');
const previewQrImg = document.getElementById('previewQrImg');
const previewMerchant = document.getElementById('previewMerchant');
const previewAmount = document.getElementById('previewAmount');
const previewCrc = document.getElementById('previewCrc');
const previewRawString = document.getElementById('previewRawString');
const qrLoading = document.getElementById('qrLoading');

const txTableBody = document.getElementById('txTableBody');
const toastEl = document.getElementById('toast');
const displayApiUrl = document.getElementById('displayApiUrl');

// Token Helpers
function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

// Authenticated Fetch Helper
async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`,
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearAuthToken();
    showLoginScreen('Sesi login telah berakhir atau tidak valid. Silakan login kembali.');
    throw new Error('Unauthorized');
  }
  return res;
}

function showLoginScreen(errMsg = '') {
  if (loginOverlay) loginOverlay.style.display = 'flex';
  if (dashboardContainer) dashboardContainer.style.display = 'none';
  if (loginError) {
    if (errMsg) {
      loginError.textContent = errMsg;
      loginError.style.display = 'block';
    } else {
      loginError.style.display = 'none';
    }
  }
}

function showDashboard() {
  if (loginOverlay) loginOverlay.style.display = 'none';
  if (dashboardContainer) dashboardContainer.style.display = 'flex';
}

// Init API URL based on current host
if (displayApiUrl) {
  const currentOrigin = window.location.origin;
  displayApiUrl.textContent = `${currentOrigin}/api`;
}

// Show Toast Notification
function showToast(msg, isError = false) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.background = isError ? '#EF4444' : '#10B981';
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// Format Rupiah
function formatRupiah(num) {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

// Format Date
function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ')';
  } catch (e) {
    return isoStr;
  }
}

// Analisis lokal QRIS string
function analyzeQrisString(str) {
  if (!qrisAnalysisText) return;
  if (!str || !str.trim()) {
    qrisAnalysisText.textContent = 'Masukkan kode string QRIS untuk melihat deteksi nama merchant.';
    return;
  }
  const clean = str.trim();
  const mName = clean.match(/59(\d{2})([A-Za-z0-9\s\.\-_]+)/);
  if (mName && mName[1] && mName[2]) {
    const len = parseInt(mName[1], 10);
    const name = mName[2].slice(0, len).trim();
    qrisAnalysisText.innerHTML = `Terdeteksi Merchant: <strong>${name}</strong> (EMVCo Valid)`;
  } else {
    qrisAnalysisText.textContent = clean.startsWith('000201') ? 'Format EMVCo valid terdeteksi.' : 'Peringatan: String belum diawali 000201 standar QRIS.';
  }
}

// Load Data Gateway
async function loadData(silent = false) {
  try {
    const res = await authFetch('/api/admin');
    const data = await res.json();
    if (!data.status) return;

    showDashboard();

    const cfg = data.config || {};
    const info = data.qris_info || {};
    const txs = data.transactions || [];

    if (!silent) {
      if (rawQrisInput) rawQrisInput.value = cfg.raw_qris || '';
      if (chkDynamicMode) chkDynamicMode.checked = Boolean(cfg.qris_dynamic_mode);
      if (customQrUrlInput) customQrUrlInput.value = cfg.custom_qr_image_url || '';

      if (chkAutoApprove) chkAutoApprove.checked = Boolean(cfg.auto_approve);
      if (autoApproveDelay) autoApproveDelay.value = cfg.auto_approve_delay || 15;
      if (cfg.bank) {
        if (bankName) bankName.value = cfg.bank.bank_name || '';
        if (bankAccountNumber) bankAccountNumber.value = cfg.bank.account_number || '';
        if (bankAccountName) bankAccountName.value = cfg.bank.account_name || '';
      }
      if (apiKey) apiKey.value = cfg.api_key || 'KEY_ANDA';
      if (secretKey) secretKey.value = cfg.secret_key || 'SECRET_ANDA';

      analyzeQrisString(cfg.raw_qris);
    }

    // Update Stats
    if (statQrisMode) statQrisMode.textContent = cfg.qris_dynamic_mode ? 'Dynamic Injection' : 'Static Raw';
    if (statAutoApprove) statAutoApprove.textContent = cfg.auto_approve ? `${cfg.auto_approve_delay} Detik` : 'Manual';
    if (statTxCount) statTxCount.textContent = `${txs.length} Trx`;
    if (statMerchantName) statMerchantName.textContent = info.merchantName || cfg.bank?.account_name || 'Merchant';
    if (statMerchantCity) statMerchantCity.textContent = info.merchantCity ? `Kota: ${info.merchantCity}` : 'Siap Digunakan';

    // Update Table
    renderTransactions(txs);
  } catch (err) {
    if (!silent) console.error('Failed to load gateway data:', err);
  }
}

// Render Transactions Table
function renderTransactions(txs) {
  if (!txTableBody) return;
  if (!txs || txs.length === 0) {
    txTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted" style="padding: 24px; text-align: center;">Belum ada transaksi. Silakan buat deposit di Ponzi15 untuk melihat mutasi real-time.</td>
      </tr>
    `;
    return;
  }

  let html = '';
  txs.forEach(tx => {
    const st = (tx.status || 'pending').toLowerCase();
    const amountStr = formatRupiah(tx.total_payment || tx.amount || 0);
    const methodStr = (tx.method || 'QRIS').toUpperCase();
    const ref = tx.reference_id || '-';

    html += `
      <tr>
        <td style="color: #94A3B8; font-size: 11px;">${formatDate(tx.created_at)}</td>
        <td><strong class="font-mono" style="color: #E2E8F0; font-size: 11.5px;">${ref}</strong></td>
        <td><span style="font-weight: 800; font-size: 11px;">${methodStr}</span></td>
        <td><strong style="color: #34D399; font-variant-numeric: tabular-nums;">${amountStr}</strong></td>
        <td><span class="badge-status ${st}">${st}</span></td>
        <td>
          <div class="table-btn-group">
            <button type="button" class="btn-action-icon" title="Set Success (Approve)" onclick="setStatus('${ref}', 'success')" style="color:#34D399;">✓</button>
            <button type="button" class="btn-action-icon" title="Set Pending" onclick="setStatus('${ref}', 'pending')" style="color:#FBBF24;">⏳</button>
            <button type="button" class="btn-action-icon" title="Set Expired" onclick="setStatus('${ref}', 'expired')" style="color:#F87171;">✕</button>
          </div>
        </td>
      </tr>
    `;
  });
  txTableBody.innerHTML = html;
}

// Ubah Status Transaksi
window.setStatus = async function (ref, status) {
  try {
    const res = await authFetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_status', reference_id: ref, status: status }),
    });
    const d = await res.json();
    if (d.status) {
      showToast(`Transaksi #${ref} diubah ke ${status}!`);
      loadData(true);
    } else {
      showToast(d.message || 'Gagal mengubah status', true);
    }
  } catch (e) {
    showToast('Koneksi gagal', true);
  }
};

// Run QRIS Tester
async function runTestQris() {
  if (!testAmountInput || !rawQrisInput) return;
  const amt = parseInt(testAmountInput.value, 10) || 50000;
  const raw = rawQrisInput.value.trim();

  if (qrLoading) qrLoading.style.display = 'flex';

  try {
    const res = await authFetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'test_qris',
        amount: amt,
        raw_qris: raw,
      }),
    });
    const d = await res.json();
    if (d.status) {
      if (previewQrImg) previewQrImg.src = d.qr_url;
      if (previewMerchant) previewMerchant.textContent = d.qris_info?.merchantName || 'Merchant Terdeteksi';
      if (previewAmount) previewAmount.textContent = formatRupiah(amt);
      if (previewCrc) previewCrc.textContent = d.dynamic_qris.slice(-4);
      if (previewRawString) previewRawString.textContent = d.dynamic_qris;
    }
  } catch (err) {
    console.error('Test QRIS error:', err);
  } finally {
    if (qrLoading) qrLoading.style.display = 'none';
  }
}

// ── EVENT LISTENERS ──

// 1. LOGIN FORM HANDLER
if (formLogin) {
  formLogin.addEventListener('submit', async e => {
    e.preventDefault();
    loginError.style.display = 'none';
    const user = loginUser.value.trim();
    const pass = loginPass.value.trim();

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username: user,
          password: pass,
        }),
      });

      const d = await res.json();
      if (d.status && d.token) {
        setAuthToken(d.token);
        showToast('Login berhasil! Selamat datang di Console.');
        await loadData(false);
        runTestQris();
      } else {
        loginError.textContent = d.message || 'Username atau password salah!';
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.textContent = 'Gagal menghubungi server.';
      loginError.style.display = 'block';
    }
  });
}

// 2. LOGOUT BUTTON
if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    clearAuthToken();
    showLoginScreen();
    showToast('Berhasil keluar dari console.');
  });
}

// 3. QRIS SETTINGS FORM
if (rawQrisInput) {
  rawQrisInput.addEventListener('input', () => {
    analyzeQrisString(rawQrisInput.value);
  });
}

const btnPasteSample = document.getElementById('btnPasteSample');
if (btnPasteSample) {
  btnPasteSample.addEventListener('click', () => {
    if (rawQrisInput) {
      rawQrisInput.value = SAMPLE_QRIS_STRING;
      analyzeQrisString(SAMPLE_QRIS_STRING);
      showToast('Contoh QRIS DANA toko Anda berhasil dimasukkan!');
      runTestQris();
    }
  });
}

const btnClearQris = document.getElementById('btnClearQris');
if (btnClearQris) {
  btnClearQris.addEventListener('click', () => {
    if (rawQrisInput) {
      rawQrisInput.value = '';
      analyzeQrisString('');
    }
  });
}

const btnRunTest = document.getElementById('btnRunTest');
if (btnRunTest) {
  btnRunTest.addEventListener('click', runTestQris);
}

// Chips amount
document.querySelectorAll('.chip-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (testAmountInput) testAmountInput.value = btn.dataset.val;
    runTestQris();
  });
});

// Save QRIS Settings
const formQrisSettings = document.getElementById('formQrisSettings');
if (formQrisSettings) {
  formQrisSettings.addEventListener('submit', async e => {
    e.preventDefault();
    const raw = rawQrisInput ? rawQrisInput.value.trim() : '';
    const dyn = chkDynamicMode ? chkDynamicMode.checked : true;
    const customImg = customQrUrlInput ? customQrUrlInput.value.trim() : '';

    try {
      const res = await authFetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          raw_qris: raw,
          qris_dynamic_mode: dyn,
          custom_qr_image_url: customImg,
        }),
      });
      const d = await res.json();
      if (d.status) {
        showToast('Konfigurasi QRIS berhasil disimpan!');
        loadData(false);
        runTestQris();
      } else {
        showToast(d.message || 'Gagal menyimpan', true);
      }
    } catch (err) {
      showToast('Koneksi gagal', true);
    }
  });
}

// Save Bank & Automation Settings
const formBankSettings = document.getElementById('formBankSettings');
if (formBankSettings) {
  formBankSettings.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          auto_approve: chkAutoApprove ? chkAutoApprove.checked : true,
          auto_approve_delay: autoApproveDelay ? parseInt(autoApproveDelay.value, 10) || 15 : 15,
          bank_name: bankName ? bankName.value.trim() : 'BCA',
          account_number: bankAccountNumber ? bankAccountNumber.value.trim() : '',
          account_name: bankAccountName ? bankAccountName.value.trim() : '',
          api_key: apiKey ? apiKey.value.trim() : 'KEY_ANDA',
          secret_key: secretKey ? secretKey.value.trim() : 'SECRET_ANDA',
        }),
      });
      const d = await res.json();
      if (d.status) {
        showToast('Pengaturan Otomasi & Bank berhasil disimpan!');
        loadData(false);
      } else {
        showToast(d.message || 'Gagal menyimpan', true);
      }
    } catch (err) {
      showToast('Koneksi gagal', true);
    }
  });
}

// Copy Raw String Button
const btnCopyRawQris = document.getElementById('btnCopyRawQris');
if (btnCopyRawQris) {
  btnCopyRawQris.addEventListener('click', () => {
    const text = previewRawString ? previewRawString.textContent : '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Payload QRIS berhasil disalin!');
    });
  });
}

// Copy API URL Button
const btnCopyApiUrl = document.getElementById('btnCopyApiUrl');
if (btnCopyApiUrl) {
  btnCopyApiUrl.addEventListener('click', () => {
    const url = displayApiUrl ? displayApiUrl.textContent : '';
    navigator.clipboard.writeText(url).then(() => {
      showToast('URL API berhasil disalin! Silakan pasang di Ponzi15.');
    });
  });
}

const btnRefreshTx = document.getElementById('btnRefreshTx');
if (btnRefreshTx) {
  btnRefreshTx.addEventListener('click', () => {
    loadData(true);
    showToast('Tabel transaksi diperbarui!');
  });
}

// Initial Boot Check
if (getAuthToken()) {
  loadData(false).then(() => {
    runTestQris();
  }).catch(() => {
    showLoginScreen();
  });
} else {
  showLoginScreen();
}

// Polling interval 5 detik untuk mutasi transaksi jika sudah login
setInterval(() => {
  if (getAuthToken() && dashboardContainer && dashboardContainer.style.display !== 'none') {
    loadData(true);
  }
}, 5000);
