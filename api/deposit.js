const { getConfig, generateReferenceId, addTransaction } = require('./helper/store');
const { convertQrisToDynamic, DEFAULT_SAMPLE_QRIS } = require('./helper/qris');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY, X-SECRET-KEY, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      message: 'Method not allowed. Use POST.',
    });
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

  const amount = parseInt(body.amount, 10);
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      status: false,
      message: 'Nominal deposit tidak valid (amount harus angka > 0)',
    });
  }

  const method = String(body.method || 'qris').toLowerCase();
  const methodId = parseInt(body.method_id, 10) || (method === 'qris' ? 1 : 2);
  const config = getConfig();

  // Buat Reference ID unik yang membawa timestamp & nominal
  const refId = generateReferenceId(amount);

  let finalQris = '';
  let qrCodeUrl = '';

  if (method === 'qris') {
    const baseQris = (config.raw_qris || DEFAULT_SAMPLE_QRIS).trim();

    if (config.qris_dynamic_mode) {
      // Injeksi nominal otomatis ke Tag 54 + hitung ulang CRC16
      finalQris = convertQrisToDynamic(baseQris, amount);
    } else {
      // Gunakan raw QRIS apa adanya dari user
      finalQris = baseQris;
    }

    if (config.custom_qr_image_url) {
      qrCodeUrl = config.custom_qr_image_url;
    } else {
      // Render gambar QRIS via QRServer publik berkualitas tinggi
      qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=16&data=${encodeURIComponent(finalQris)}`;
    }
  }

  const bankData = {
    bank_name: config.bank.bank_name || 'BCA',
    account_number: config.bank.account_number || '',
    account_name: config.bank.account_name || '',
    note: config.bank.note || 'Transfer tepat sesuai nominal sampai digit terakhir agar mudah divalidasi.',
  };

  const transactionData = {
    reference_id: refId,
    plat_order_num: refId,
    method: method,
    method_id: methodId,
    method_name: method === 'qris' ? 'QRIS Realtime' : `${bankData.bank_name} Transfer`,
    amount: amount,
    fee: 0,
    unique_code: 0,
    total_payment: amount,
    balance_received: amount,
    status: 'pending',
    qr_code_url: qrCodeUrl,
    qris_payload: finalQris,
    pay_url: '',
    provider: 'ASTELAS',
    bank: bankData,
    created_at: new Date().toISOString(),
    paid_at: null,
  };

  // Simpan ke store
  addTransaction(transactionData);

  return res.status(200).json({
    status: true,
    message: 'Deposit created successfully',
    data: transactionData,
  });
};
