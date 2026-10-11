/**
 * QRIS (Quick Response Code Indonesian Standard) EMVCo Utility
 * Handles dynamic amount injection & CRC16 checksum calculation
 */

// CRC-16/CCITT-FALSE (Polynomial: 0x1021, Initial: 0xFFFF)
function calculateCRC16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Mengubah QRIS Statis menjadi QRIS Dinamis dengan menginjeksi nominal otomatis (Tag 54)
 * @param {string} rawQris - Raw string QRIS asli (statis/dinamis)
 * @param {number} amount - Nominal transaksi (contoh: 50000)
 * @returns {string} - Raw QRIS string dinamis siap scan
 */
function convertQrisToDynamic(rawQris, amount) {
  if (!rawQris || typeof rawQris !== 'string') return '';
  let qrisStr = rawQris.trim();

  // Bersihkan karakter aneh atau spasi
  qrisStr = qrisStr.replace(/\s+/g, '');

  // Potong tag CRC lama (6304XXXX) di bagian akhir
  if (qrisStr.length > 8 && qrisStr.slice(-8, -4) === '6304') {
    qrisStr = qrisStr.slice(0, -8);
  } else if (qrisStr.includes('6304')) {
    const lastIdx = qrisStr.lastIndexOf('6304');
    qrisStr = qrisStr.slice(0, lastIdx);
  }

  // Ubah tipe inisiasi: 010211 (Statis) -> 010212 (Dinamis)
  if (qrisStr.includes('010211')) {
    qrisStr = qrisStr.replace('010211', '010212');
  }

  // Siapkan Tag 54 (Transaction Amount)
  const amountInt = Math.floor(Number(amount) || 0);
  const amountStr = amountInt.toString();
  const lenStr = amountStr.length.toString().padStart(2, '0');
  const tag54 = '54' + lenStr + amountStr;

  // Standar EMVCo QRIS Indonesia: Tag 54 disisipkan sebelum Tag 58 (5802ID)
  if (qrisStr.includes('5802ID')) {
    const parts = qrisStr.split('5802ID');
    let partBefore = parts[0];
    
    // Hapus Tag 54 lama jika sudah pernah ada sebelum 5802ID
    partBefore = partBefore.replace(/54\d{2}\d+$/, '');
    
    qrisStr = partBefore + tag54 + '5802ID' + parts.slice(1).join('5802ID');
  } else {
    // Fallback jika tidak ada tag 5802ID
    qrisStr = qrisStr + tag54;
  }

  // Tambahkan tag CRC 6304 dan hitung checksum
  qrisStr += '6304';
  const crc = calculateCRC16(qrisStr);
  return qrisStr + crc;
}

/**
 * Parsing ringkas informasi dari QRIS EMVCo
 */
function parseQrisInfo(rawQris) {
  if (!rawQris || typeof rawQris !== 'string') return null;
  const str = rawQris.trim();
  
  const info = {
    isValid: str.startsWith('000201'),
    merchantName: '',
    merchantCity: '',
    isDynamic: str.includes('010212'),
    amount: null,
  };

  // Tag 59: Merchant Name
  const mName = str.match(/59(\d{2})([A-Za-z0-9\s\.\-_]+)/);
  if (mName && mName[1] && mName[2]) {
    const len = parseInt(mName[1], 10);
    info.merchantName = mName[2].slice(0, len).trim();
  }

  // Tag 60: Merchant City
  const mCity = str.match(/60(\d{2})([A-Za-z0-9\s\.\-_]+)/);
  if (mCity && mCity[1] && mCity[2]) {
    const len = parseInt(mCity[1], 10);
    info.merchantCity = mCity[2].slice(0, len).trim();
  }

  // Tag 54: Amount
  const mAmount = str.match(/54(\d{2})(\d+)/);
  if (mAmount && mAmount[1] && mAmount[2]) {
    const len = parseInt(mAmount[1], 10);
    info.amount = parseInt(mAmount[2].slice(0, len), 10);
  }

  return info;
}

/**
 * Default Template QRIS (Jika user belum memasukkan QRIS sendiri)
 */
const DEFAULT_SAMPLE_QRIS = '00020101021126570011ID.DANA.WWW011893600915303341139902090334113990303UMI51440014ID.CO.QRIS.WWW0215ID10265535024060303UMI5204504553033605802ID5925Jamaludin Phone, Komputer6015Kota Jakarta Se610512810630478D6';

module.exports = {
  calculateCRC16,
  convertQrisToDynamic,
  parseQrisInfo,
  DEFAULT_SAMPLE_QRIS,
};
