/**
 * In-Memory & Stateful Store with Cold-Boot Recovery
 * Designed specifically for Vercel Serverless Functions
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_SAMPLE_QRIS } = require('./qris');

// File lokal untuk dev environment (fallback jika filesystem writeable)
const DATA_FILE = path.join(__dirname, '..', '..', '.storage.json');

// Default Configuration: AUTO_APPROVE HARUS FALSE (TIDAK BOLEH AUTO SUKSES!)
const DEFAULT_CONFIG = {
  raw_qris: process.env.CUSTOM_QRIS_RAW || DEFAULT_SAMPLE_QRIS,
  custom_qr_image_url: process.env.CUSTOM_QR_IMAGE_URL || '',
  qris_dynamic_mode: process.env.QRIS_DYNAMIC_MODE !== 'false', // Default true (injeksi nominal otomatis)
  auto_approve: false, // WAJIB FALSE: Transaksi harus menunggu konfirmasi pembayaran nyata/admin!
  auto_approve_delay: 0,
  api_key: process.env.GATEWAY_API_KEY || 'KEY_ANDA',
  secret_key: process.env.GATEWAY_SECRET_KEY || 'SECRET_ANDA',
  bank: {
    bank_name: process.env.BANK_NAME || 'BCA',
    account_number: process.env.BANK_ACCOUNT_NUMBER || '8830192837',
    account_name: process.env.BANK_ACCOUNT_NAME || 'PT GERBANG PEMBAYARAN',
    note: 'Transfer tepat sesuai nominal sampai digit terakhir agar mutasi terbaca otomatis.',
  },
};

// Global cache (persists between serverless invocations on warm instances)
let currentConfig = { ...DEFAULT_CONFIG };
let transactions = new Map();

// Coba load dari file lokal jika ada
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.config) currentConfig = { ...DEFAULT_CONFIG, ...parsed.config };
    if (Array.isArray(parsed.transactions)) {
      parsed.transactions.forEach(tx => transactions.set(tx.reference_id, tx));
    }
  }
} catch (e) {
  // Silent fail di read-only filesystem Vercel
}

function saveStore() {
  try {
    const payload = {
      config: currentConfig,
      transactions: Array.from(transactions.values()).slice(-200), // simpan 200 transaksi terakhir
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    // Di Vercel production fs write mungkin dibatasi, tapi in-memory state tetap terjaga
  }
}

function getConfig() {
  return currentConfig;
}

function updateConfig(newConfig) {
  currentConfig = {
    ...currentConfig,
    ...newConfig,
    bank: {
      ...currentConfig.bank,
      ...(newConfig.bank || {}),
    },
  };
  saveStore();
  return currentConfig;
}

/**
 * Buat reference ID unik yang membawa metadata waktu & nominal
 * Format: AST-{timestamp}-{amount}-{random}
 */
function generateReferenceId(amount) {
  const ts = Date.now();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AST-${ts}-${Math.floor(amount)}-${rand}`;
}

function addTransaction(tx) {
  // Pastikan status awal SELALU pending
  tx.status = 'pending';
  transactions.set(tx.reference_id, tx);
  saveStore();
  return tx;
}

function getTransaction(referenceId) {
  if (!referenceId) return null;
  let tx = transactions.get(referenceId);

  // Jika tidak ditemukan di memori (misal karena Vercel cold boot),
  // rekonstruksi dari format nama ID: AST-{timestamp}-{amount}-{rand}
  if (!tx && referenceId.startsWith('AST-')) {
    const parts = referenceId.split('-');
    if (parts.length >= 4) {
      const ts = parseInt(parts[1], 10);
      const amt = parseInt(parts[2], 10);
      if (!isNaN(ts) && !isNaN(amt)) {
        tx = {
          reference_id: referenceId,
          amount: amt,
          total_payment: amt,
          method: 'qris',
          status: 'pending', // Selalu PENDING, tidak boleh auto-success!
          created_at: new Date(ts).toISOString(),
          paid_at: null,
          qris_payload: '',
        };
        transactions.set(referenceId, tx);
      }
    }
  }

  // JANGAN PERNAH auto-flip ke success berdasarkan waktu!
  return tx;
}

function updateTransactionStatus(referenceId, newStatus) {
  let tx = getTransaction(referenceId);
  if (!tx) {
    // Jika belum ada di memori, buat objek transaksi baru
    tx = {
      reference_id: referenceId,
      amount: 0,
      total_payment: 0,
      method: 'qris',
      status: newStatus,
      created_at: new Date().toISOString(),
      paid_at: newStatus === 'success' ? new Date().toISOString() : null,
    };
  } else {
    tx.status = newStatus;
    if (newStatus === 'success' && !tx.paid_at) {
      tx.paid_at = new Date().toISOString();
    }
  }
  transactions.set(referenceId, tx);
  saveStore();
  return tx;
}

function getAllTransactions(limit = 50) {
  const list = Array.from(transactions.values());
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return list.slice(0, limit);
}

module.exports = {
  getConfig,
  updateConfig,
  generateReferenceId,
  addTransaction,
  getTransaction,
  updateTransactionStatus,
  getAllTransactions,
};
