const QRCode = require('qrcode');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const query = req.query || {};
  const text = String(query.data || query.text || '').trim();

  if (!text) {
    return res.status(400).send('Missing ?data= parameter');
  }

  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(svg);
  } catch (err) {
    // Fallback redirect
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=16&data=${encodeURIComponent(text)}`;
    return res.redirect(fallbackUrl);
  }
};
