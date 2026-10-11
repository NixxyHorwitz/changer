# 🚀 APICS Payment Gateway — Mock & Custom QRIS Serverless

Projek gateway serverless siap deploy ke **Vercel** untuk menggantikan API payment (seperti Astelas/Gateway) pada website **Ponzi15**, dengan fitur utama **QRIS kustom milik Anda sendiri** (mendukung auto-injeksi nominal dinamis EMVCo atau string QRIS statis).

---

## 🌟 Fitur Utama

1. **Custom QRIS String Milik Anda Sendiri**
   - Masukkan kode string QRIS toko/merchant Anda sendiri (BCA, DANA, GoPay, Shopee, LinkAja, QRIS All Payment, dll).
2. **Dynamic Amount Injection (EMVCo Tag 54)**
   - Jika diaktifkan, sistem secara cerdas menyisipkan nominal deposit (Tag 54) ke dalam kode QRIS statis Anda dan menghitung ulang CRC16 (Tag 63) secara otomatis.
   - Hasilnya: Pengguna yang memindai QRIS di aplikasi mobile banking / e-wallet akan melihat **nominal pembayaran otomatis terkunci sesuai tagihan deposit tanpa perlu mengetik manual**.
3. **Auto-Approve / Mutasi Otomatis**
   - Transaksi yang berstatus *Pending* akan otomatis berubah menjadi *Success* setelah interval delay (default 15 detik), sehingga ketika `cron/auto_status.php` atau tombol "Cek Status" di `pay.php` berjalan, saldo user langsung masuk otomatis!
4. **Rich Web Dashboard & Simulator**
   - Terdapat dashboard kontrol di root domain (`/`), di mana Anda bisa:
     - Mengubah raw QRIS string & preview langsung QR codenya.
     - Melakukan tes nominal dan scan langsung pakai smartphone Anda.
     - Memantau log transaksi real-time dari website Ponzi15.
     - Mengubah status transaksi secara manual (Approve / Reject).
5. **Full Backward Compatibility dengan Ponzi15**
   - Mendukung rute `.php` (`/methods.php`, `/deposit.php`, `/status.php`, `/withdraw.php`) maupun clean URL (`/api/methods`, `/api/deposit`, `/api/status`, `/api/withdraw`).

---

## 📁 Struktur File

```
apics/
├── api/
│   ├── deposit.js          # Handler pembuatan deposit (QRIS & Bank)
│   ├── methods.js          # Handler daftar metode pembayaran
│   ├── status.js           # Handler pengecekan status transaksi mutasi
│   ├── withdraw.js         # Handler penarikan dana
│   ├── qr.js               # Generator gambar QR code (SVG / redirect)
│   ├── admin.js            # API controller untuk Web Dashboard
│   └── helper/
│       ├── qris.js         # EMVCo Tag 54 parser & CRC16 calculator
│       └── store.js        # State manager & cold-boot recovery
├── public/
│   ├── index.html          # Web Dashboard & QRIS Configurator
│   ├── style.css           # Styling Cyber FinTech Modern
│   └── app.js              # Interaksi frontend real-time
├── server.js               # Local development server (port 3000)
├── vercel.json             # Konfigurasi routing & rewrites Vercel
├── package.json            # Node.js dependencies
└── README.md               # Dokumentasi
```

---

## ⚡ Cara Menjalankan Lokal

```bash
# Pindah ke folder apics
cd apics

# Install dependensi
npm install

# Jalankan server
node server.js
```
Akses di browser: `http://localhost:3000/`

---

## 🚀 Cara Deploy ke Vercel

### Metode 1: Menggunakan Vercel CLI (Paling Cepat)
1. Buka terminal di folder `apics`:
   ```bash
   cd apics
   npm i -g vercel   # Jika belum install
   vercel deploy --prod
   ```
2. Ikuti instruksi di terminal. Setelah selesai, Anda akan mendapatkan URL produksi seperti:
   `https://apics-gateway.vercel.app`

### Metode 2: Menggunakan GitHub
1. Upload folder `apics` ini ke repositori GitHub baru Anda.
2. Buka [Vercel Dashboard](https://vercel.com) -> Klik **Add New Project**.
3. Import repositori GitHub tersebut.
4. Klik **Deploy**. Selesai!

---

## 🔗 Cara Menghubungkan ke Ponzi15

Setelah Vercel aktif dan memiliki URL (misal: `https://apics-gateway.vercel.app`):

1. **Ubah di Database MySQL Ponzi15**:
   Update kolom `payment_api_base` di tabel `settings` baris `id=1`:
   ```sql
   UPDATE settings SET payment_api_base = 'https://apics-gateway.vercel.app/api' WHERE id = 1;
   ```
   *(Atau melalui panel Admin di menu Pengaturan Web)*.

2. **Selesai!**
   - `deposit.php` akan otomatis memanggil `https://apics-gateway.vercel.app/api/methods.php` & `/api/deposit.php`.
   - `pay.php` akan menerima data QRIS dinamis Anda dan menampilkan QR code.
   - `cron/auto_status.php` akan mengecek ke `https://apics-gateway.vercel.app/api/status.php` dan mengupdate saldo user otomatis!
