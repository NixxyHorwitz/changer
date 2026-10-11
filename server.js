/**
 * Local Development Server for APICS Gateway
 * Emulates Vercel Serverless environment on localhost
 */

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const methodsHandler = require('./api/methods');
const depositHandler = require('./api/deposit');
const statusHandler = require('./api/status');
const withdrawHandler = require('./api/withdraw');
const adminHandler = require('./api/admin');
const qrHandler = require('./api/qr');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// Polyfill helper untuk req/res di environment serverless Vercel
function adaptServerless(req, res, handler, parsedUrl, body) {
  req.query = Object.fromEntries(new URLSearchParams(parsedUrl.search || ''));
  req.body = body;

  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = function (data) {
    res.end(data);
    return res;
  };
  res.redirect = function (targetUrl) {
    res.writeHead(302, { Location: targetUrl });
    res.end();
    return res;
  };

  return handler(req, res);
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  let bodyData = '';
  req.on('data', chunk => {
    bodyData += chunk;
  });

  req.on('end', async () => {
    let parsedBody = {};
    if (bodyData) {
      try {
        parsedBody = JSON.parse(bodyData);
      } catch (e) {
        parsedBody = bodyData;
      }
    }

    // Normalisasi routing API (mendukung akhiran .php dan alias Vercel)
    const cleanPath = pathname.replace(/\.php$/i, '').replace(/\/+$/, '');

    if (cleanPath === '/api/methods' || cleanPath === '/methods') {
      return adaptServerless(req, res, methodsHandler, parsedUrl, parsedBody);
    }
    if (cleanPath === '/api/deposit' || cleanPath === '/deposit') {
      return adaptServerless(req, res, depositHandler, parsedUrl, parsedBody);
    }
    if (cleanPath === '/api/status' || cleanPath === '/status') {
      return adaptServerless(req, res, statusHandler, parsedUrl, parsedBody);
    }
    if (cleanPath === '/api/withdraw' || cleanPath === '/withdraw') {
      return adaptServerless(req, res, withdrawHandler, parsedUrl, parsedBody);
    }
    if (cleanPath === '/api/admin') {
      return adaptServerless(req, res, adminHandler, parsedUrl, parsedBody);
    }
    if (cleanPath === '/api/qr') {
      return adaptServerless(req, res, qrHandler, parsedUrl, parsedBody);
    }

    // Static Files dari /public
    let targetFile = pathname;
    if (pathname === '/consoleaccessor') {
      targetFile = 'console.html';
    } else if (pathname === '/' || pathname === '') {
      targetFile = 'index.html';
    }
    let filePath = path.join(PUBLIC_DIR, targetFile);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 APICS Mock & Custom QRIS Gateway Server Running!`);
  console.log(`📍 Web Dashboard: http://localhost:${PORT}/`);
  console.log(`🔗 API Base URL:  http://localhost:${PORT}/api`);
  console.log(`=======================================================`);
});
