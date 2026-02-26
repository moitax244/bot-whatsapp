const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(express.json());

let client = null;
let wppReady = false;
let lastQr = null;

process.on('unhandledRejection', (reason) => {
  console.log('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.log('[uncaughtException]', err);
});

app.get('/', (req, res) => {
  res.json({
    ok: true,
    server: 'online',
    whatsapp: wppReady ? 'conectado' : 'conectando',
    hasQr: !!lastQr
  });
});

app.get('/qr', (req, res) => {
  if (!lastQr) return res.status(404).send('QR ainda não gerado');

  const img = Buffer.from(
    lastQr.replace(/^data:image\/png;base64,/, ''),
    'base64'
  );

  res.writeHead(200, { 'Content-Type': 'image/png' });
  res.end(img);
});

app.post('/status', async (req, res) => {
  try {
    let { telefone, status } = req.body || {};

    if (!telefone || !status) {
      return res.status(400).json({ ok: false, error: 'Envie telefone e status' });
    }

    telefone = String(telefone).replace(/\D/g, '');
    status = String(status).toLowerCase();

    if (!client || !wppReady) {
      return res.status(503).json({ ok: false, error: 'WhatsApp ainda conectando' });
    }

    let mensagem = '';
    if (status === 'confirmado') mensagem = '✅ Seu pedido foi confirmado!';
    else if (status === 'preparando') mensagem = '🍳 Seu pedido está sendo preparado!';
    else if (status === 'finalizado') mensagem = '🚚 Seu pedido saiu para entrega!';
    else mensagem = `ℹ️ Status: ${status}`;

    await client.sendText(`${telefone}@c.us`, mensagem);

    return res.json({ ok: true });
  } catch (err) {
    console.log('ERRO /status:', err);
    return res.status(500).json({ ok: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor rodando na porta', PORT);
});

wppconnect.create({
  session: 'delivery',
  autoClose: 0,
  puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  catchQR: (base64Qrimg) => {
    lastQr = base64Qrimg;
    console.log('QR atualizado');
  }
}).then((cli) => {
  client = cli;
  wppReady = true;
  console.log('WhatsApp conectado');
}).catch((err) => {
  console.log('Erro ao iniciar WPP:', err);
});