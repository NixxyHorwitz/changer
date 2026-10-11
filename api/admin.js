const crypto = require('crypto');
const {
  getConfig,
  updateConfig,
  getAllTransactions,
  updateTransactionStatus,
} = require('./helper/store');
const {
  convertQrisToDynamic,
  parseQrisInfo,
  DEFAULT_SAMPLE_QRIS,
} = require('./helper/qris');

// Credentials Admin Console
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'adminmemek';

function getExpectedToken() {
  return crypto.createHash('sha256').update(`${ADMIN_USER}:${ADMIN_PASS}:apics_secret_2026`).digest('hex');
}

function verifyAuth(req) {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return Boolean(token && token === getExpectedToken());
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse Body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  const action = String(body.action || '').toLowerCase();

  // 1. ENDPOINT LOGIN (Tidak perlu auth)
  if (req.method === 'POST' && action === 'login') {
    const user = String(body.username || '').trim();
    const pass = String(body.password || '').trim();

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      return res.status(200).json({
        status: true,
        message: 'Login berhasil',
        token: getExpectedToken(),
      });
    }

    return res.status(401).json({
      status: false,
      message: 'Username atau password console salah!',
    });
  }

  // 2. CHECK SECURITY AUTH UNTUK SEMUA OPERASI ADMIN
  if (!verifyAuth(req)) {
    return res.status(401).json({
      status: false,
      message: 'Akses ditolak: Silakan login terlebih dahulu melalui /consoleaccessor',
    });
  }

  const currentCfg = getConfig();

  // GET: Ambil status, konfigurasi, dan transaksi
  if (req.method === 'GET') {
    const qrisInfo = parseQrisInfo(currentCfg.raw_qris || DEFAULT_SAMPLE_QRIS);
    const txs = getAllTransactions(50);

    return res.status(200).json({
      status: true,
      config: currentCfg,
      qris_info: qrisInfo,
      transactions: txs,
    });
  }

  // POST: Aksi update config atau update transaksi
  if (req.method === 'POST') {
    // 1. Simpan Pengaturan
    if (action === 'save_config') {
      const updated = updateConfig({
        raw_qris: body.raw_qris !== undefined ? body.raw_qris : currentCfg.raw_qris,
        custom_qr_image_url: body.custom_qr_image_url !== undefined ? body.custom_qr_image_url : currentCfg.custom_qr_image_url,
        qris_dynamic_mode: body.qris_dynamic_mode !== undefined ? Boolean(body.qris_dynamic_mode) : currentCfg.qris_dynamic_mode,
        auto_approve: body.auto_approve !== undefined ? Boolean(body.auto_approve) : currentCfg.auto_approve,
        auto_approve_delay: body.auto_approve_delay !== undefined ? parseInt(body.auto_approve_delay, 10) : currentCfg.auto_approve_delay,
        api_key: body.api_key !== undefined ? body.api_key : currentCfg.api_key,
        secret_key: body.secret_key !== undefined ? body.secret_key : currentCfg.secret_key,
        bank: {
          bank_name: body.bank_name || currentCfg.bank.bank_name,
          account_number: body.account_number || currentCfg.bank.account_number,
          account_name: body.account_name || currentCfg.bank.account_name,
          note: body.bank_note || currentCfg.bank.note,
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Pengaturan gateway berhasil disimpan!',
        config: updated,
        qris_info: parseQrisInfo(updated.raw_qris),
      });
    }

    // 2. Ubah Status Transaksi (Approve / Reject / Pending)
    if (action === 'set_status') {
      const ref = String(body.reference_id || '').trim();
      const newStatus = String(body.status || 'success').toLowerCase();
      if (!ref) {
        return res.status(400).json({ status: false, message: 'reference_id diperlukan' });
      }

      const tx = updateTransactionStatus(ref, newStatus);
      return res.status(200).json({
        status: true,
        message: `Status transaksi #${ref} diubah menjadi ${newStatus}`,
        transaction: tx,
      });
    }

    // 3. Test Generate QRIS
    if (action === 'test_qris') {
      const testAmount = parseInt(body.amount, 10) || 50000;
      const baseQris = (body.raw_qris || currentCfg.raw_qris || DEFAULT_SAMPLE_QRIS).trim();
      const dynamicQris = convertQrisToDynamic(baseQris, testAmount);
      const parsed = parseQrisInfo(dynamicQris);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=16&data=${encodeURIComponent(dynamicQris)}`;

      return res.status(200).json({
        status: true,
        amount: testAmount,
        dynamic_qris: dynamicQris,
        qris_info: parsed,
        qr_url: qrUrl,
      });
    }

    return res.status(400).json({ status: false, message: 'Aksi tidak dikenal' });
  }

  return res.status(405).json({ status: false, message: 'Method not allowed' });
};
