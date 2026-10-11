const { getConfig } = require('./helper/store');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY, X-SECRET-KEY, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const config = getConfig();
  const query = req.query || {};
  const typeFilter = String(query.type || 'all').toLowerCase();

  const methods = [
    {
      id: 1,
      type: 'qris',
      name: 'QRIS Realtime (Semua E-Wallet & Bank)',
      bank_name: '',
      account_name: config.bank.account_name || 'Merchant QRIS',
      account_number: '',
      min_deposit: 10000,
      fee_deposit: 0,
      fee_withdraw: 0,
      status: 'active',
    },
    {
      id: 2,
      type: 'bank',
      name: `${config.bank.bank_name} Transfer Virtual`,
      bank_name: config.bank.bank_name,
      account_name: config.bank.account_name,
      account_number: config.bank.account_number,
      min_deposit: 10000,
      fee_deposit: 0,
      fee_withdraw: 0,
      status: 'active',
    },
  ];

  let filtered = methods;
  if (typeFilter === 'qris') {
    filtered = methods.filter(m => m.type === 'qris');
  } else if (typeFilter === 'bank') {
    filtered = methods.filter(m => m.type === 'bank');
  }

  return res.status(200).json({
    status: true,
    message: 'Daftar metode pembayaran berhasil diambil',
    data: filtered,
    methods: filtered, // Fallback alias
  });
};
