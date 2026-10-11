const { getTransaction, updateTransactionStatus } = require('./helper/store');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY, X-SECRET-KEY, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse Body & Query
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  const query = req.query || {};
  const refId = String(body.reference_id || query.reference_id || query.trxid || query.trx || '').trim();

  if (!refId) {
    return res.status(400).json({
      status: false,
      message: 'Parameter reference_id diperlukan',
    });
  }

  // Aksi manual approve via GET/POST query (berguna untuk testing cepat)
  const action = String(query.action || body.action || '').toLowerCase();
  if (action === 'approve' || action === 'success') {
    updateTransactionStatus(refId, 'success');
  } else if (action === 'cancel' || action === 'expired' || action === 'failed') {
    updateTransactionStatus(refId, 'expired');
  }

  // Cari transaksi
  const tx = getTransaction(refId);

  // Jika withdraw (diawali WD-)
  if (refId.startsWith('WD-')) {
    const isSuccess = tx ? tx.status === 'success' : true;
    return res.status(200).json({
      status: true,
      type: 'withdraw',
      data: {
        reference_id: refId,
        status: isSuccess ? 'success' : 'pending',
      },
    });
  }

  // Jika transaksi ditemukan
  if (tx) {
    return res.status(200).json({
      status: true,
      type: 'deposit',
      data: {
        reference_id: tx.reference_id,
        status: tx.status.toLowerCase(), // 'pending', 'success', 'expired', 'failed'
        total_payment: tx.total_payment || tx.amount,
        amount: tx.amount,
      },
    });
  }

  // Fallback jika tidak ditemukan sama sekali:
  // Asumsikan pending dengan nominal 0
  return res.status(200).json({
    status: true,
    type: 'deposit',
    data: {
      reference_id: refId,
      status: 'pending',
      total_payment: 0,
      amount: 0,
    },
  });
};
