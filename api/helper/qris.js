/**
 * QRIS (Quick Response Code Indonesian Standard) EMVCo Utility
 * Handles dynamic amount injection & CRC16 checksum calculation
 * Preserves original spacing, UTF characters, and TLV length integrity.
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
 * Standard EMVCo TLV Parser
 * Parses root tags while strictly respecting length headers (spaces preserved).
 */
function parseTLV(str) {
  const tags = [];
  let i = 0;
  while (i < str.length) {
    if (i + 4 > str.length) break;
    const tag = str.substr(i, 2);
    const len = parseInt(str.substr(i + 2, 2), 10);
    if (isNaN(len)) break;
    const val = str.substr(i + 4, len);
    tags.push({ tag, len, val });
    i += 4 + len;
  }
  return tags;
}

/**
 * Mengubah QRIS Statis menjadi QRIS Dinamis dengan menginjeksi nominal otomatis (Tag 54)
 * Menjaga spasi pada nama merchant (Tag 59) dan kota (Tag 60) agar tidak merusak panjang TLV.
 * @param {string} rawQris - Raw string QRIS asli (statis/dinamis)
 * @param {number} amount - Nominal transaksi (contoh: 50000)
 * @returns {string} - Raw QRIS string dinamis siap scan
 */
function convertQrisToDynamic(rawQris, amount) {
  if (!rawQris || typeof rawQris !== 'string') return '';
  const str = rawQris.trim();
  const tags = parseTLV(str);
  if (!tags.length) return str;

  let built = '';
  const amountInt = Math.floor(Number(amount) || 0);
  const amountStr = amountInt.toString();
  const tag54 = '54' + amountStr.length.toString().padStart(2, '0') + amountStr;

  let has54 = false;
  for (const t of tags) {
    // Lewati tag CRC 63 lama (akan dihitung ulang)
    if (t.tag === '63') continue;

    // Ubah tipe inisiasi: 010211 (Statis) -> 010212 (Dinamis)
    if (t.tag === '01') {
      built += '010212';
      continue;
    }

    // Jika Tag 54 sudah ada, ganti dengan nominal baru
    if (t.tag === '54') {
      built += tag54;
      has54 = true;
      continue;
    }

    // Standar EMVCo: Tag 54 disisipkan tepat sebelum Tag 58 (Country Code 'ID')
    if (t.tag === '58' && !has54) {
      built += tag54;
      has54 = true;
    }

    // Pertahankan nilai asli tag termasuk spasi agar panjang byte tidak melenceng
    const lenStr = t.len.toString().padStart(2, '0');
    built += t.tag + lenStr + t.val;
  }

  // Fallback jika tidak ada tag 58
  if (!has54) {
    built += tag54;
  }

  // Tambahkan Tag 6304 dan kalkulasi CRC16
  built += '6304';
  const crc = calculateCRC16(built);
  return built + crc;
}

/**
 * Parsing ringkas informasi dari QRIS EMVCo
 */
function parseQrisInfo(rawQris) {
  if (!rawQris || typeof rawQris !== 'string') return null;
  const str = rawQris.trim();
  const tags = parseTLV(str);

  const info = {
    isValid: str.startsWith('000201'),
    merchantName: '',
    merchantCity: '',
    isDynamic: false,
    amount: null,
  };

  for (const t of tags) {
    if (t.tag === '01') {
      info.isDynamic = (t.val === '12');
    } else if (t.tag === '54') {
      info.amount = parseInt(t.val, 10);
    } else if (t.tag === '59') {
      info.merchantName = t.val.trim();
    } else if (t.tag === '60') {
      info.merchantCity = t.val.trim();
    }
  }

  return info;
}

/**
 * Default Template QRIS Toko User
 */
const DEFAULT_SAMPLE_QRIS = '00020101021126570011ID.DANA.WWW011893600915303341139902090334113990303UMI51440014ID.CO.QRIS.WWW0215ID10265535024060303UMI5204504553033605802ID5925Jamaludin Phone, Komputer6015Kota Jakarta Se610512810630478D6';

module.exports = {
  calculateCRC16,
  parseTLV,
  convertQrisToDynamic,
  parseQrisInfo,
  DEFAULT_SAMPLE_QRIS,
};
