const { addTransaction } = require('./helper/store');

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
      success: false,
      message: 'Method not allowed. Use POST.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  const amount = parseInt(body.amount, 10) || 0;
  if (amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Nominal withdraw tidak valid.',
    });
  }

  const fee = 3000 + Math.ceil(amount * 0.05); // Fixed 3000 + 5%
  const netReceived = Math.max(0, amount - fee);
  const refId = `WD-AST-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const txData = {
    reference_id: refId,
    type: 'withdraw',
    amount: amount,
    fee: fee,
    net_received: netReceived,
    status: 'Pending',
    bank_name: body.bank_name || '',
    account_number: body.account_number || '',
    account_name: body.account_name || '',
    created_at: new Date().toISOString(),
  };

  addTransaction(txData);

  return res.status(200).json({
    success: true,
    message: 'Permintaan penarikan dana berhasil diproses.',
    data: {
      reference_id: refId,
      amount: amount,
      fee: fee,
      net_received: netReceived,
      status: 'Pending',
    },
  });
};
